/**
 * fix-dead-ae-skill-keys.macro.js
 *
 * Phase 1 of the D&D-vocab scrub sprint (2026-04-28).
 *
 * Many ancestry/heritage items carry Active Effects with `change.key` values
 * inherited from a dnd5e-shaped schema:
 *     system.skills.<dnd-slug>.bonuses.check
 * The RFI engine reads:
 *     system.skills.<rfi-slug>.value     (with change.type === "add")
 * Result: those AEs apply to nothing — the bonus is silently dead.
 *
 * This macro walks every item in every master-content (and bbttcc-*) pack,
 * finds AE changes whose key matches the dnd5e shape, and rewrites them to the
 * RFI shape — slug + subpath both.
 *
 * Default mode: DRY RUN. Prints a per-item diff to console + a chat summary.
 * Flip APPLY = true after reviewing the dry-run report, then re-run.
 *
 * Idempotent: re-running after APPLY is safe — already-rewritten keys are no-ops.
 *
 * Slug remap is sourced from systems/fourththing/ft-translation.js lines 92-109.
 * Subpath remap is universal: `.bonuses.check` → `.value`.
 */

(async () => {
  const APPLY = true;  // ← flip to true after reviewing the dry-run

  // dnd5e skill slug → RFI native skill slug
  // (from ft-translation.js skills section, conservative best-fit picks)
  const SLUG_REMAP = {
    acr: "athletics",        // Acrobatics → Athletics (Intrigue)
    ani: "empathy",          // Animal Handling → Empathy (Presence)
    arc: "occult",           // Arcana → Occult (Mind)
    ath: "athletics",        // Athletics → Athletics (Violence)
    dec: "stealth",          // Deception → Stealth (Presence)
    his: "lore",             // History → Lore (Mind)
    ins: "insight",          // Insight → Insight (Soul)
    itm: "intimidation",     // Intimidation → Intimidation (Presence)
    inv: "investigation",    // Investigation → Investigation (Mind)
    med: "faith",            // Medicine → Faith (Soul)
    nat: "lore",             // Nature → Lore (Mind)
    prc: "perception",       // Perception → Perception (Mind)
    prf: "performance",      // Performance → Performance (Presence)
    per: "diplomacy",        // Persuasion → Diplomacy (Presence)
    rel: "faith",            // Religion → Faith (Soul)
    slt: "tinkering",        // Sleight of Hand → Tinkering (Intrigue)
    ste: "stealth",          // Stealth → Stealth (Intrigue)
    sur: "athletics",        // Survival → Athletics (Body)
  };

  // RFI skills that already use their full slug — pass through unchanged
  // (defensive: if a key was hand-authored as system.skills.insight.bonuses.check
  // we still need the subpath fix.)
  const RFI_SKILL_SLUGS = new Set([
    "brawl","melee","firearms","athletics",
    "stealth","hacking","tinkering","streetwise",
    "diplomacy","intimidation","empathy","performance",
    "perception","investigation","lore","occult",
    "faith","meditation","ritual","insight",
    "plating","weave","warding",
  ]);

  // Match either dnd5e shape OR an RFI slug with the wrong subpath
  // Captures: 1=slug, 2=subpath remainder (everything after the slug)
  const KEY_RE = /^system\.skills\.([a-z]+)(\..+)$/;

  const PACK_FILTER = /^(bbttcc-master-content|bbttcc-)/;

  const report = {
    apply: APPLY,
    scannedItems: 0,
    affectedItems: 0,
    affectedChanges: 0,
    bySlug: {},          // dnd-slug or 'subpath-only' → count
    examples: [],        // first 30 patches for chat
    errors: [],
  };

  const remapKey = (key) => {
    const m = KEY_RE.exec(key);
    if (!m) return null;
    const [, slug, rest] = m;

    let newSlug = slug;
    let slugTouched = false;
    if (SLUG_REMAP[slug] !== undefined) {
      newSlug = SLUG_REMAP[slug];
      slugTouched = true;
    } else if (!RFI_SKILL_SLUGS.has(slug)) {
      // Unknown slug — bail, don't guess
      return null;
    }

    // Subpath: anything other than ".value" gets normalized to ".value"
    let newRest = rest;
    let subTouched = false;
    if (rest !== ".value") {
      newRest = ".value";
      subTouched = true;
    }

    if (!slugTouched && !subTouched) return null;
    const newKey = `system.skills.${newSlug}${newRest}`;
    return { newKey, slugTouched, subTouched, oldSlug: slug };
  };

  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!PACK_FILTER.test(pack.metadata.id)) continue;

    let docs;
    try {
      docs = await pack.getDocuments();
    } catch (e) {
      report.errors.push(`getDocuments failed: ${pack.metadata.id} — ${e.message}`);
      continue;
    }

    for (const item of docs) {
      report.scannedItems++;
      const effects = item.effects?.contents ?? [];
      if (!effects.length) continue;

      const effectPatches = [];
      let itemTouched = false;

      for (const effect of effects) {
        const oldChanges = effect.changes ?? [];
        if (!oldChanges.length) continue;

        const newChanges = [];
        let effectTouched = false;

        for (const change of oldChanges) {
          const remap = remapKey(change.key);
          if (!remap) {
            newChanges.push(change.toObject ? change.toObject() : { ...change });
            continue;
          }

          effectTouched = true;
          report.affectedChanges++;
          const tag = remap.slugTouched ? remap.oldSlug : "subpath-only";
          report.bySlug[tag] = (report.bySlug[tag] ?? 0) + 1;

          if (report.examples.length < 30) {
            report.examples.push({
              pack: pack.metadata.id,
              item: item.name,
              effect: effect.name,
              old: change.key,
              new: remap.newKey,
              type: change.type,
              value: change.value,
            });
          }

          newChanges.push({
            ...(change.toObject ? change.toObject() : change),
            key: remap.newKey,
            // Engine requires type:"add" — preserve existing if already add,
            // otherwise leave alone (don't change semantics, just the key shape).
          });
        }

        if (effectTouched) {
          effectPatches.push({ _id: effect.id, changes: newChanges });
          itemTouched = true;
        }
      }

      if (itemTouched) {
        report.affectedItems++;
        if (APPLY && effectPatches.length) {
          try {
            await item.updateEmbeddedDocuments("ActiveEffect", effectPatches);
          } catch (e) {
            report.errors.push(`update failed: ${pack.metadata.id} / ${item.name} — ${e.message}`);
          }
        }
      }
    }
  }

  // ── Console output ─────────────────────────────────────────────────────────
  console.group(`%c[fix-dead-ae-skill-keys] ${APPLY ? "APPLIED" : "DRY RUN"}`,
                "font-weight:bold;color:#0af");
  console.log("scanned items :", report.scannedItems);
  console.log("affected items:", report.affectedItems);
  console.log("affected changes:", report.affectedChanges);
  console.log("by old slug   :", report.bySlug);
  if (report.examples.length) {
    console.table(report.examples);
  }
  if (report.errors.length) {
    console.warn("errors:", report.errors);
  }
  console.groupEnd();

  // ── Chat card summary ──────────────────────────────────────────────────────
  const sampleRows = report.examples.slice(0, 10).map(e =>
    `<tr><td>${e.item}</td><td><code>${e.old}</code></td><td>→</td><td><code>${e.new}</code></td></tr>`
  ).join("");

  const slugRows = Object.entries(report.bySlug).sort((a,b) => b[1]-a[1])
    .map(([k,v]) => `<tr><td><code>${k}</code></td><td>${v}</td></tr>`).join("");

  const html = `
    <div style="border:1px solid #555;padding:8px;border-radius:4px;background:rgba(0,0,0,0.15);">
      <h3 style="margin:0 0 4px 0;">${APPLY ? "✅ Applied" : "🔎 Dry run"}: dead AE skill keys</h3>
      <div style="font-size:0.9em;opacity:0.8;">scanned <b>${report.scannedItems}</b> items · affected <b>${report.affectedItems}</b> · changes touched <b>${report.affectedChanges}</b></div>
      ${slugRows ? `<table style="width:100%;margin-top:6px;font-size:0.9em;"><thead><tr><th>old slug</th><th>count</th></tr></thead><tbody>${slugRows}</tbody></table>` : ""}
      ${sampleRows ? `<details style="margin-top:6px;"><summary>first ${Math.min(10, report.examples.length)} patches</summary><table style="width:100%;font-size:0.85em;"><thead><tr><th>item</th><th>old</th><th></th><th>new</th></tr></thead><tbody>${sampleRows}</tbody></table></details>` : ""}
      ${report.errors.length ? `<div style="margin-top:6px;color:#f66;">errors: ${report.errors.length} — see console</div>` : ""}
      ${!APPLY ? `<div style="margin-top:6px;font-style:italic;opacity:0.85;">Flip <code>APPLY = true</code> at the top of the macro and re-run to commit.</div>` : ""}
    </div>
  `;

  ChatMessage.create({ content: html, whisper: [game.user.id] });
})();
