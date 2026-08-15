/* repair-ae-fold-and-dup-changes.macro.js — 2026-08-15
 * BATTLE #4 of the aptitude-corruption saga, and the one that explains the
 * other three. Pairs with the ROOT fix in systems/fourththing/module.js
 * (ftSourceSystem + source-rendered sheet inputs + single-count roll math).
 *
 * ── THE ROOT CAUSE ────────────────────────────────────────────────────────
 * `fourththing` registers NO DataModel — it is a template.json system. So
 * Foundry's TypeDataField.initialize() returns `deepClone(value)`: actor.system
 * is a PLAIN OBJECT that applyActiveEffects() mutates in place. Therefore:
 *   • actor.system.skills.X.value is DERIVED (source + every live AE), and
 *   • the guard used in every sheet _prepareContext —
 *       rawSys?.toObject ? rawSys.toObject() : JSON.parse(JSON.stringify(rawSys))
 *     — ALWAYS took the JSON branch (plain objects have no toObject), so the
 *     sheet context was derived.
 * The steward/NPC sheets render `<input name="system.skills.X.value">` and
 * `<input name="system.attributes.X.value">` from that context, and the sheets
 * are `submitOnChange` — so EVERY edit of ANY field on the sheet posted all 24
 * aptitude inputs back carrying source+AE. The AE bonus folded into source,
 * permanently, once per sheet edit. (The 2026-05-20 "disable ft-edit-only
 * fields" guard used a descendant selector `.ft-edit-only input`, and the rank
 * input carries the class ITSELF — so it was never disabled.)
 *   Pura Vida: insight base 1, AE +4 → 1+4=5 → 5+4=9. Two sheet edits.
 *   Brexit the Terrible: athletics AE +3 → 8; diplomacy/intimidation/lore +1 → 6.
 * Skills with no AE never moved — which is exactly why every previous
 * investigation concluded "the writers are fine". They were.
 *
 * ── THE SECOND DEFECT (data) ──────────────────────────────────────────────
 * A class/ancestry mechanizer ran TWICE over the master-content packs: it
 * appended a duplicate `+2` copy of every `+1` skill change and re-decorated
 * the effect name, leaving "(Insight (Soul) (Soul) Edge)". So Dream-Sense
 * grants +3 Insight instead of +1, Sefirot Attunement +3 Perception, etc.
 * That is why Pura Vida's fold was +4 a pop instead of +2.
 *
 * ── WHAT THIS MACRO DOES (DRY by default) ─────────────────────────────────
 *  1. UNFOLD — reverses the ratchet on world actors. For each actor it sums
 *     the live `add` AEs per skill, then finds every fold-count n where
 *     (source − n×AE) lands in 0..5 for ALL that actor's AE-bearing skills
 *     (the whole form posts at once, so n is the same for every skill). It
 *     reports the full ladder and applies the LARGEST valid n, unless the
 *     actor is listed in OVERRIDES below.
 *  2. DEDUPE — drops duplicate `system.skills.*.value` add-changes from every
 *     AE on world actors' embedded items, and collapses doubled "(Attr) (Attr)"
 *     label repeats in effect names.
 *  3. PACKS — the same dedupe against the loaded compendium packs listed in
 *     PACKS (unlock → update → relock, via the API — safe while the world
 *     runs; do NOT stop/rsync for this).
 * ORDER MATTERS: step 1 must run before 2/3, because the unfold arithmetic
 * uses the CURRENT (still-duplicated) AE totals. The macro enforces this.
 *
 * Idempotent: re-running after a successful apply finds nothing (unfold only
 * fires when a valid n ≥ 1 exists). Run as GM, once per instance (ember +
 * foundry both host the same world id but separate data).
 */
(async () => {
  const DRY_RUN = true;                  // <-- set false to apply
  const DO_UNFOLD = true;
  const DO_DEDUPE_ACTORS = true;
  const DO_DEDUPE_PACKS  = true;
  const PACKS = ["bbttcc-master-content.classes", "bbttcc-master-content.ancestries"];

  // actorName → { skillKey: correctedSourceRank }. Wins over the ladder.
  // Pura Vida is a fresh L1 tutorial steward: 3 free picks at rank 1, so
  // insight 5 is impossible — the n=2 rung is the true one.
  const OVERRIDES = {
    "Pura Vida": { insight: 1, perception: 0 }
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");

  const SKILL_RE = /^system\.skills\.([a-zA-Z0-9_]+)\.value$/;
  const CAP = 5;
  const changesOf = (eff) => eff?.system?.changes ?? eff?.changes ?? [];
  const isAdd = (c) => c?.type === "add" || c?.mode === 2;
  const num = (v) => Number(String(v ?? "").replace(/^\+/, "")) || 0;
  const out = [];
  const say = (s) => { out.push(s); console.log(s); };

  say(`=== AE fold / duplicate-change repair — ${DRY_RUN ? "DRY RUN" : "APPLY"} ===`);

  // ── 1. UNFOLD ────────────────────────────────────────────────────────────
  let unfolded = 0;
  if (DO_UNFOLD) {
    say("\n── 1. Folded source ranks ──");
    for (const actor of game.actors.contents) {
      if (!["character", "npc"].includes(actor.type)) continue;
      const src = actor.toObject().system ?? {};
      const skills = src.system?.skills ?? src.skills ?? {};

      // Live add-AE total per skill (enabled effects only — a disabled AE
      // contributes nothing to the derived value the sheet rendered).
      const ae = {};
      for (const eff of actor.appliedEffects ?? []) {
        if (eff.disabled) continue;
        for (const c of changesOf(eff)) {
          const m = SKILL_RE.exec(String(c.key ?? ""));
          if (!m || !isAdd(c)) continue;
          ae[m[1]] = (ae[m[1]] ?? 0) + num(c.value);
        }
      }
      const keys = Object.keys(ae).filter(k => ae[k] > 0 && skills[k] !== undefined);
      if (!keys.length) continue;

      // Valid fold counts: every AE-bearing skill must land in 0..CAP.
      const valid = [];
      for (let n = 1; n <= 6; n++) {
        const cand = {};
        let ok = true;
        for (const k of keys) {
          const v = Number(skills[k]?.value ?? 0) - n * ae[k];
          if (v < 0 || v > CAP) { ok = false; break; }
          cand[k] = v;
        }
        if (ok) valid.push({ n, cand });
      }
      const overCap = keys.some(k => Number(skills[k]?.value ?? 0) > CAP);
      if (!valid.length) {
        if (overCap) say(`  ⚠ ${actor.name}: over-cap but no consistent unfold — repair by hand. ` +
                         keys.map(k => `${k}=${skills[k]?.value} (AE +${ae[k]})`).join(", "));
        continue;
      }
      const ladder = valid.map(v => `n=${v.n} → ${keys.map(k => `${k} ${v.cand[k]}`).join(", ")}`).join("  |  ");
      const pick = OVERRIDES[actor.name] ?? valid[valid.length - 1].cand;
      const updates = {};
      for (const [k, v] of Object.entries(pick)) {
        if (skills[k] === undefined) continue;
        if (Number(skills[k]?.value ?? 0) === v) continue;
        updates[`system.skills.${k}.value`] = v;
      }
      if (!Object.keys(updates).length) continue;
      say(`  ${overCap ? "🔥" : "•"} ${actor.name}`);
      say(`      now:    ${keys.map(k => `${k}=${skills[k]?.value} (AE +${ae[k]})`).join(", ")}`);
      say(`      ladder: ${ladder}`);
      say(`      ${OVERRIDES[actor.name] ? "OVERRIDE" : "applying"}: ${Object.entries(updates).map(([p, v]) => `${p.split(".")[2]}→${v}`).join(", ")}`);
      if (!DRY_RUN) await actor.update(updates);
      unfolded++;
    }
    if (!unfolded) say("  (nothing folded)");
  }

  // ── shared dedupe ────────────────────────────────────────────────────────
  // Drops repeat `system.skills.*.value` add-changes (keeps the FIRST — the
  // mechanizer appended its "+2" copy second) and collapses "(X) (X)" in names.
  function planFix(eff) {
    const changes = changesOf(eff);
    const seen = new Set();
    const next = [];
    const dropped = [];
    for (const c of changes) {
      const m = SKILL_RE.exec(String(c.key ?? ""));
      if (m && isAdd(c)) {
        if (seen.has(c.key)) { dropped.push(`${c.key}=${c.value}`); continue; }
        seen.add(c.key);
      }
      next.push(foundry.utils.deepClone(c));
    }
    const newName = String(eff.name ?? "").replace(/\((\w+)\)\s*\(\1\)/g, "($1)");
    if (!dropped.length && newName === eff.name) return null;
    const data = { _id: eff.id };
    if (dropped.length) data["system.changes"] = next;
    if (newName !== eff.name) data.name = newName;
    return { data, dropped, newName };
  }

  // ── 2. actor-embedded AEs ────────────────────────────────────────────────
  let actorFixes = 0;
  if (DO_DEDUPE_ACTORS) {
    say("\n── 2. Duplicate changes on world actors ──");
    for (const actor of game.actors.contents) {
      for (const item of actor.items) {
        const ops = [];
        for (const eff of item.effects) {
          const plan = planFix(eff);
          if (!plan) continue;
          say(`  • ${actor.name} → ${item.name} → "${eff.name}"` +
              (plan.dropped.length ? `\n      drop: ${plan.dropped.join(", ")}` : "") +
              (plan.newName !== eff.name ? `\n      name → ${plan.newName}` : ""));
          ops.push(plan.data);
          actorFixes++;
        }
        if (ops.length && !DRY_RUN) await item.updateEmbeddedDocuments("ActiveEffect", ops);
      }
      // Actor-level AEs too (rare, but they apply the same way).
      const aops = [];
      for (const eff of actor.effects) {
        const plan = planFix(eff);
        if (!plan) continue;
        say(`  • ${actor.name} → (actor AE) "${eff.name}"`);
        aops.push(plan.data);
        actorFixes++;
      }
      if (aops.length && !DRY_RUN) await actor.updateEmbeddedDocuments("ActiveEffect", aops);
    }
    if (!actorFixes) say("  (clean)");
  }

  // ── 3. compendium packs ──────────────────────────────────────────────────
  let packFixes = 0;
  if (DO_DEDUPE_PACKS) {
    say("\n── 3. Duplicate changes in compendium packs ──");
    for (const packId of PACKS) {
      const pack = game.packs.get(packId);
      if (!pack) { say(`  ⚠ pack not found: ${packId}`); continue; }
      const wasLocked = pack.locked;
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
      try {
        const docs = await pack.getDocuments();
        for (const doc of docs) {
          const ops = [];
          for (const eff of doc.effects ?? []) {
            const plan = planFix(eff);
            if (!plan) continue;
            say(`  • ${packId} → ${doc.name} → "${eff.name}"` +
                (plan.dropped.length ? `\n      drop: ${plan.dropped.join(", ")}` : "") +
                (plan.newName !== eff.name ? `\n      name → ${plan.newName}` : ""));
            ops.push(plan.data);
            packFixes++;
          }
          if (ops.length && !DRY_RUN) await doc.updateEmbeddedDocuments("ActiveEffect", ops);
        }
      } finally {
        if (!DRY_RUN && wasLocked) await pack.configure({ locked: true });
      }
    }
    if (!packFixes) say("  (clean)");
  }

  say(`\n=== ${DRY_RUN ? "WOULD FIX" : "FIXED"}: ${unfolded} actor rank set(s), ${actorFixes} actor AE(s), ${packFixes} pack AE(s) ===`);
  if (DRY_RUN) say("Set DRY_RUN = false to apply.");

  await ChatMessage.create({
    whisper: [game.user.id],
    content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">🧰 AE fold / dup-change repair — ${DRY_RUN ? "DRY" : "APPLIED"}</span></div>` +
             `<pre style="font-size:0.68rem;max-height:22rem;overflow:auto;white-space:pre-wrap">${foundry.utils.escapeHTML(out.join("\n"))}</pre></div>`
  });
})();
