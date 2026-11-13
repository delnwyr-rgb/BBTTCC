/*
 * rewrite-stale-surge-text-2026-11-13.macro.js — the Surge repricing (Dave 2026-11-12, commit eff2e42e) changed the
 * engine and the menu (systems/fourththing/module.js _FT_SURGE_MENU) but left the OLD spend text inside class /
 * subclass bodies: "max-die crit", "a freed reaction" (the code frees the BONUS action), old heal formulas
 * ("1d8 + tier", "2d8 + tier", "Tier d6") and old prices ("Bulwark Stance (6)" …). This macro swaps those exact
 * strings for the new wording in system.description.value of:
 *   - pack bbttcc-master-content.classes          (top-level class / subclass items)
 *   - pack bbttcc-master-content.npcs             (embedded class items on NPC actors)
 *   - pack bbttcc-master-content.playtest-actors  (embedded class items on playtest actors)
 *   - world actors (embedded items) + world items  (the same class items copied onto Stewards / NPCs)
 *   - flags["bbttcc-campaign"].revealKit.items on pack + world actors (hidden kits granted on reveal — Jeargan's Bulwark)
 * Exact-substring replacements only; every new string is free of its old string, so a second run = 0.
 * Unlinked scene tokens whose delta overrides items are REPORTED only (their base actor is fixed above).
 *
 * Not touched on purpose: Blood Hymn "Final Crescendo … Surge fills to its cap" (the L18 capstone really still fills
 * the bank — ft-class-automation.js openBloodHymnFinalCrescendo → ftAddBurn(actor, ftBurnMax(actor))); Wyrdlens Lens
 * Read "count as one tier of Identification" (strategic layer, not Tier Surge).
 *
 * DRY RUN by default. globalThis.__staleSurgeTextDry = false applies.
 * Before any write, a JournalEntry "Stale Surge text backup 2026-11-13" stores the before-description of every touched
 * item. Report → globalThis.__staleSurgeTextReport {DRY_RUN, changes, byRule, tokens, errors}.
 */
(async () => {
  const DRY_RUN = globalThis.__staleSurgeTextDry !== false;

  // <plan> — pure (no Foundry globals): the offline harness extracts this block and runs it against the dumps.
  // [id, old, new]. Order matters only where one old string contains another (the long max-die lines run first).
  const RULES = [
    // max-die crit → max-dice one-shot (code primes `max-dice`; consumed only on a hit — module.js C7/C2)
    ["stairtrap-maxdie", "your next Strike lands as a max-die crit and knocks the target Prone; if it drops them, you regain a freed action.",
                         "your next Strike that hits rolls max damage dice; the target is knocked Prone and you gain a freed bonus action."],
    ["cataclysm-maxdie", "your next Strike lands as a max-die crit, and foes in reach are knocked Prone.",
                         "your next Strike that hits rolls max damage dice, and foes in reach are knocked Prone."],
    ["crash-maxdie",     "your next Strike lands as a max-die crit; the target is Staggered.",
                         "your next Strike that hits rolls max damage dice; the target is Staggered."],
    ["foreclose-maxdie", "your next Strike lands as a max-die crit and ignores resistances.",
                         "your next Strike that hits rolls max damage dice and ignores resistances."],
    ["compound-maxdie",  "your next Strike lands as a max-die critical.",
                         "your next Strike that hits rolls max damage dice."],
    // freed reaction → freed bonus action (code sets bonusActionAvailable — module.js C13)
    ["freed-reaction",   "a freed reaction", "a freed bonus action"],
    ["rally-to-me",      "<em>and</em> frees a reaction.", "<em>and</em> gains a freed bonus action."],
    ["shared-breath",    "and they may take a reaction right now.", "and they gain a freed bonus action."],
    // heals (ruling 1: dice × Tier — module.js C8)
    ["forge-weld-heal",  "repair an ally — 1d8 + tier integrity.", "repair an ally — 1d6 × tier integrity."],
    ["remembered-heal",  "an ally heals 1d8 + tier and gains DR.", "an ally heals 2d6 × tier and gains DR."],
    ["deepsalvage-heal", "restore an ally hard — 2d8 + tier integrity", "restore an ally hard — 3d6 × tier integrity"],
    ["shoulder-heal",    "heal an ally Tier d6;", "heal an ally 1d6 × Tier;"],
    // Flank & Strike (sc-flank, loose ends 11-13): the code primes snap-strike (adds a die, keep best 2) + doomstrike
    // (+Tier d6, sixes explode, consumed on a hit) — module.js _FT_SURGE_MENU sc-flank / the courier base spend
    ["flank-strike",     "reposition, then your next Strike reroll the lowest die <em>and</em> +Tier d6.",
                         "reposition, then your next Strike adds a die (keep the best 2) <em>and</em> gains +Tier d6 (sixes explode; kept through a miss)."],
    // prices (menu cost now — module.js _FT_SURGE_MENU)
    ...[
      ["Bulwark Stance", 6, 3], ["Anchor", 5, 2], ["Mass Aegis", 8, 6], ["Sanctum", 9, 6],
      ["Ghoststep", 3, 2], ["Flank &amp; Strike", 5, 3], ["Delivered", 5, 6],
      ["Radiant Pause", 3, 6], ["Shared Face", 3, 2],
      ["Impose a Reading", 3, 2], ["Revision", 5, 2],
      ["The Exposure", 5, 3], ["None Lost", 5, 6],
      ["Sovereign Writ", 8, 5], ["Res Judicata", 5, 3]
    ].map(([n, a, b]) => [`price:${n.replace("&amp;", "&")}`, `<strong>${n}</strong> (${a})`, `<strong>${n}</strong> (${b})`])
  ];

  // → { text, hits: {ruleId: count} } ; text unchanged when no rule matched
  function rewriteText(text) {
    if (typeof text !== "string" || !text) return { text, hits: {} };
    let out = text; const hits = {};
    for (const [id, from, to] of RULES) {
      if (!out.includes(from)) continue;
      const parts = out.split(from);
      hits[id] = parts.length - 1;
      out = parts.join(to);
    }
    return { text: out, hits };
  }

  // item source → null | { updates, hits }
  function planItem(item) {
    const before = item?.system?.description?.value;
    const { text, hits } = rewriteText(before);
    if (text === before) return null;
    return { updates: { "system.description.value": text }, hits };
  }
  // actor source → null | { items (full new revealKit.items array), ops: [{itemId, itemName, before, hits}] }
  // flags["bbttcc-campaign"].revealKit.items = hidden kit item docs granted on reveal (bbttcc-campaign module.js
  // _grantRevealKits) — e.g. Jeargan's Bulwark class body; left stale they'd be created with the old text later.
  function planRevealKit(actor) {
    const kit = actor?.flags?.["bbttcc-campaign"]?.revealKit;
    if (!kit || !Array.isArray(kit.items)) return null;
    const ops = [];
    const items = kit.items.map(it => {
      const p = planItem(it); if (!p) return it;
      ops.push({ itemId: it?._id ?? null, itemName: it?.name, before: it.system.description.value, hits: p.hits });
      return { ...it, system: { ...it.system, description: { ...it.system.description, value: p.updates["system.description.value"] } } };
    });
    return ops.length ? { items, ops } : null;
  }
  // </plan>

  // ── Foundry side ─────────────────────────────────────────────────────────────────────────────────────────
  const report = { DRY_RUN, changes: [], byRule: {}, tokens: [], errors: [] };
  const plans = [];   // { kind: "item"|"embedded"|"revealKit", doc (Item or Actor), where, ops: [{itemId, itemName, before, updates, hits}] }
  const bump = hits => { for (const [k, n] of Object.entries(hits)) report.byRule[k] = (report.byRule[k] ?? 0) + n; };

  const considerItem = (doc, where, pack) => {
    try {
      const src = doc.toObject(); const p = planItem(src);
      if (p) plans.push({ kind: "item", doc, where, pack, ops: [{ itemId: src._id, itemName: src.name, before: src.system.description.value, ...p }] });
    } catch (e) { report.errors.push(`${where} ${doc?.name}: plan failed — ${e.message}`); }
  };
  const considerActor = (doc, where, pack) => {
    try {
      const src = doc.toObject(); const ops = [];
      for (const it of src.items ?? []) { const p = planItem(it); if (p) ops.push({ itemId: it._id, itemName: it.name, before: it.system.description.value, ...p }); }
      if (ops.length) plans.push({ kind: "embedded", doc, where, pack, ops });
      const kp = planRevealKit(src);
      if (kp) plans.push({ kind: "revealKit", doc, where: `${where}:revealKit`, pack, ops: kp.ops, kitItems: kp.items });
    } catch (e) { report.errors.push(`${where} ${doc?.name}: plan failed — ${e.message}`); }
  };

  const PACKS = [
    ["bbttcc-master-content.classes", "Item"],
    ["bbttcc-master-content.npcs", "Actor"],
    ["bbttcc-master-content.playtest-actors", "Actor"]
  ];
  const packs = [];
  for (const [id, type] of PACKS) {
    const pack = game.packs.get(id);
    if (!pack) { report.errors.push(`pack ${id} not found`); continue; }
    packs.push(pack);
    const docs = await pack.getDocuments();
    for (const d of docs) (type === "Item" ? considerItem : considerActor)(d, `pack:${id}`, pack);
  }
  for (const a of game.actors) considerActor(a, "world:actor", null);
  for (const i of game.items) considerItem(i, "world:item", null);

  // unlinked tokens whose delta overrides items — report only
  for (const sc of game.scenes ?? []) for (const t of sc.tokens ?? []) {
    try {
      if (t.actorLink || !t.actor) continue;
      const dItems = t.delta?._source?.items ?? t._source?.delta?.items ?? [];
      for (const it of dItems) if (planItem(it)) report.tokens.push({ scene: sc.name, token: t.name, item: it.name });
    } catch (e) { report.errors.push(`token ${sc.name} ${t.name}: ${e.message}`); }
  }

  for (const p of plans) for (const op of p.ops) {
    bump(op.hits);
    report.changes.push({ where: p.where, doc: p.doc.name, item: op.itemName, rules: Object.entries(op.hits).map(([k, n]) => n > 1 ? `${k}×${n}` : k).join(", ") });
  }

  if (!DRY_RUN && plans.length) {
    // 1) backup BEFORE any write — abort the run if it can't be written
    const backup = plans.flatMap(p => p.ops.map(op => ({ uuid: p.doc.uuid, where: p.where, doc: p.doc.name, itemId: op.itemId, item: op.itemName, before: op.before })));
    const base = "Stale Surge text backup 2026-11-13";
    let n = 1; while (game.journal.getName(n === 1 ? base : `${base} (pass ${n})`)) n++;
    let backedUp = false;
    try {
      const esc = s => (foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s) : s.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
      await JournalEntry.create({ name: n === 1 ? base : `${base} (pass ${n})`, pages: [{ name: "before", type: "text", text: { content: `<pre>${esc(JSON.stringify(backup, null, 1))}</pre>` } }] });
      backedUp = true;
    } catch (e) { report.errors.push(`backup journal failed — NOTHING applied: ${e.message}`); }

    if (backedUp) {
      const unlocked = [];
      try {
        for (const pack of packs) if (pack.locked && plans.some(p => p.pack === pack)) { await pack.configure({ locked: false }); unlocked.push(pack); }
        for (const p of plans) {
          try {
            if (p.kind === "item") await p.doc.update(p.ops[0].updates);
            else if (p.kind === "revealKit") await p.doc.update({ "flags.bbttcc-campaign.revealKit.items": p.kitItems });
            else await p.doc.updateEmbeddedDocuments("Item", p.ops.map(op => ({ _id: op.itemId, ...op.updates })));
          } catch (e) { report.errors.push(`${p.where} ${p.doc.name}: ${e.message}`); }
        }
      } finally {
        for (const pack of unlocked) { try { await pack.configure({ locked: true }); } catch (e) { report.errors.push(`relock ${pack.collection}: ${e.message}`); } }
      }
    }
  }

  console.log(`[stale surge text] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${plans.length} docs, ${report.changes.length} item bodies, ${report.tokens.length} unlinked token items (reported only), ${report.errors.length} errors`);
  console.table(report.changes);
  console.table(report.byRule);
  if (report.tokens.length) console.table(report.tokens);
  if (report.errors.length) console.warn("[stale surge text] errors", report.errors);
  globalThis.__staleSurgeTextReport = report;
  ui.notifications?.info(`Stale Surge text ${DRY_RUN ? "dry run" : "applied"}: ${report.changes.length} item bodies on ${plans.length} docs${report.errors.length ? `, ${report.errors.length} ERRORS (console)` : ""}.`);
})();
