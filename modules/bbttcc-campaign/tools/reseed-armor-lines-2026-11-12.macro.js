/*
 * reseed-armor-lines-2026-11-12.macro.js — Dave (2026-11-12): armor moves from light/medium/heavy to four faculty-gated
 * LINES (guard-body, guard-intrigue, resolve-soul, resolve-mind). This stamps every armor item for the "lines" model:
 *   - system.armorSlot  body | shield | helm | boots | necklace | ring
 *   - system.armorLine  (body armor only) guard-body | guard-intrigue | resolve-soul | resolve-mind
 *   - body armor value  = 1 + item tier (TI 2 · TII 3 · TIII 4 · TIV 5 — so T1 / Inlaid / Circuited / Crowned = 2/3/4/5),
 *                         on its line's defense only (the other defense → 0)
 *   - shields           flat 1 on Guard or Resolve (never graded — graded shields keep only their resists)
 *   - accessories       +1 on Guard or Resolve
 *   - evasionBonus → 0; the worn −1 Intrigue penalty rows (flags.fourththing.passives.checkBonus) removed
 *   - resistances untouched
 *   - Maul / Greatsword families gain the "two-handed" tag (Dave: two-handed = no shield)
 * Where: every Item compendium, world items, and the embedded items of every NON-MONSTER actor in the world and in
 * every Actor compendium (monsters keep the weights model — ruling 2026-09-04 — so their hides are left alone).
 * Before writing, a JournalEntry "Armor re-seed backup 2026-11-12" stores each touched document's old values.
 *
 * DRY RUN by default. globalThis.__armorReseedDry = false applies. globalThis.__armorReseedFlip = true also sets the
 * world setting fourththing.armorModel to "lines" after a successful apply. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__armorReseedDry !== false;
  const FLIP = globalThis.__armorReseedFlip === true;
  const report = { DRY_RUN, rows: [], weapons: [], skippedMonsters: 0, errors: [] };

  // <classify>
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
  const tagsOf = (s) => (Array.isArray(s?.tags) ? s.tags : []).map(t => String(t).toLowerCase());
  const tierOf = (it) => {
    const t = it?.flags?.fourththing?.rfi?.item?.tier ?? it?.system?.tier;
    return Math.max(1, Math.min(4, ROMAN[String(t ?? "").toUpperCase()] || Number(t) || 1));
  };
  function classifyArmor(it) {
    const s = it.system ?? {}, tags = tagsOf(s), name = String(it.name ?? "").toLowerCase();
    const has = (...ks) => ks.some(k => tags.includes(k));
    const G = Number(s.guardBonus) || 0, R = Number(s.resolveBonus) || 0;
    // slot
    let slot = "body";
    if (has("shield")) slot = "shield";
    else if (has("helm", "helmet", "hat", "hood")) slot = "helm";
    else if (has("footwear", "boots") || s.frame === "footwear") slot = "boots";
    else if (has("ring")) slot = "ring";
    else if (has("amulet", "necklace", "pendant") || /amulet|necklace|pendant/.test(name)) slot = "necklace";
    else if (/\bscarf\b|t-shirt|\bshirt\b/.test(name)) slot = "necklace";   // light vestments that are trinkets, not armor
    // defense the piece protects
    const resolveish = has("robe", "caster", "warding", "vestment", "sept", "sept-blessed", "vigil", "ceremonial", "light-cloth") || /robe|cassock|mantle|vestment|surplice|blazer|\bsept|targe/.test(name);
    // Dominant stat decides; a robe/vestment/sept/warding piece that gives ANY Resolve is Resolve armor (so graded copies
    // follow their base — Septhide); shields: the targe is the Resolve shield, other shields follow the dominant stat
    // with ties going to Resolve only when warded.
    let defense = R > G ? "resolve" : (G > R ? "guard" : (resolveish ? "resolve" : "guard"));
    if (slot !== "shield" && R > 0 && resolveish && !has("heavy", "plate", "mail")) defense = "resolve";
    if (slot === "shield" && /targe/.test(name)) defense = "resolve";
    const out = { slot, line: "", defense, guard: 0, resolve: 0 };
    if (slot === "body") {
      if (defense === "guard") out.line = has("light", "fitting") && !has("heavy", "medium", "plate", "mail", "hazmat") ? "guard-intrigue" : "guard-body";
      else out.line = (has("robe", "caster") || /robe|blazer|scholar|academic/.test(name)) ? "resolve-mind" : "resolve-soul";
      const v = 1 + tierOf(it);
      out[defense] = v;
    } else {
      out[defense] = 1;
    }
    return out;
  }
  const isTwoHandedFamily = (it) => it.type === "weapon" && /\bmaul\b|greatsword/i.test(String(it.name ?? ""));
  // </classify>

  function planArmor(it) {
    if (it.type !== "armor") return null;
    const s = it.system ?? {}, c = classifyArmor(it), u = {};
    if (s.armorSlot !== c.slot) u["system.armorSlot"] = c.slot;
    if ((s.armorLine ?? "") !== c.line) u["system.armorLine"] = c.line;
    if ((Number(s.guardBonus) || 0) !== c.guard) u["system.guardBonus"] = c.guard;
    if ((Number(s.resolveBonus) || 0) !== c.resolve) u["system.resolveBonus"] = c.resolve;
    if (Number(s.evasionBonus) || 0) u["system.evasionBonus"] = 0;
    const cb = it.flags?.fourththing?.passives?.checkBonus;
    if (Array.isArray(cb) && cb.some(g => g?.worn === true && g?.attribute === "intrigue" && Number(g?.bonus) < 0)) {
      u["flags.fourththing.passives.checkBonus"] = cb.filter(g => !(g?.worn === true && g?.attribute === "intrigue" && Number(g?.bonus) < 0));
    }
    return { c, u, before: { guardBonus: s.guardBonus ?? 0, resolveBonus: s.resolveBonus ?? 0, evasionBonus: s.evasionBonus ?? 0, armorSlot: s.armorSlot ?? "", armorLine: s.armorLine ?? "", checkBonus: cb ?? null } };
  }
  function planWeapon(it) {
    if (!isTwoHandedFamily(it)) return null;
    const tags = Array.isArray(it.system?.tags) ? it.system.tags : [];
    if (tags.map(t => String(t).toLowerCase()).includes("two-handed")) return null;
    return { u: { "system.tags": [...tags, "two-handed"] }, before: { tags } };
  }
  const isMonster = (a) => {
    try { const k = game.fourththing?.actorKind?.(a); if (k) return k === "monster"; } catch (_e) {}
    return a?.type === "npc";
  };

  const backup = [];
  async function handle(it, where) {
    const pa = planArmor(it), pw = planWeapon(it);
    const p = pa ?? pw; if (!p) return;
    if (pa) report.rows.push({ where, name: it.name, slot: pa.c.slot, line: pa.c.line || "—", G: pa.c.guard, R: pa.c.resolve, was: `G${pa.before.guardBonus} R${pa.before.resolveBonus}`, change: Object.keys(pa.u).length ? "update" : "already" });
    if (pw) report.weapons.push({ where, name: it.name });
    if (!Object.keys(p.u).length) return;
    backup.push({ uuid: it.uuid, where, name: it.name, before: p.before });
    if (!DRY_RUN) await it.update(p.u);
  }

  try {
    // 1) Item compendiums
    for (const pack of game.packs.filter(p => p.documentName === "Item")) {
      const docs = await pack.getDocuments();
      if (!docs.some(d => planArmor(d) || planWeapon(d))) continue;
      const wasLocked = pack.locked;
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
      for (const d of docs) { try { await handle(d, `pack:${pack.collection}`); } catch (e) { report.errors.push(`${pack.collection} ${d.name}: ${e.message}`); } }
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: true });
    }
    // 2) World items
    for (const it of game.items) { try { await handle(it, "world-item"); } catch (e) { report.errors.push(`world ${it.name}: ${e.message}`); } }
    // 3) World actors (non-monster)
    for (const a of game.actors) {
      if (isMonster(a)) { report.skippedMonsters++; continue; }
      for (const it of a.items) { try { await handle(it, `actor:${a.name}`); } catch (e) { report.errors.push(`${a.name} ${it.name}: ${e.message}`); } }
    }
    // 4) Actor compendiums (non-monster)
    for (const pack of game.packs.filter(p => p.documentName === "Actor")) {
      const docs = await pack.getDocuments();
      const targets = docs.filter(a => !isMonster(a) && a.items.some(i => planArmor(i) || planWeapon(i)));
      report.skippedMonsters += docs.filter(isMonster).length;
      if (!targets.length) continue;
      const wasLocked = pack.locked;
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
      for (const a of targets) for (const it of a.items) { try { await handle(it, `${pack.collection}:${a.name}`); } catch (e) { report.errors.push(`${pack.collection} ${a.name} ${it.name}: ${e.message}`); } }
      if (!DRY_RUN && wasLocked) await pack.configure({ locked: true });
    }
  } catch (e) { report.errors.push(`fatal: ${e.message}`); }

  if (!DRY_RUN && backup.length) {
    try {
      await JournalEntry.create({ name: "Armor re-seed backup 2026-11-12", pages: [{ name: "before", type: "text",
        text: { content: `<pre>${foundry.utils.escapeHTML ? foundry.utils.escapeHTML(JSON.stringify(backup, null, 1)) : JSON.stringify(backup, null, 1).replace(/</g, "&lt;")}</pre>` } }] });
    } catch (e) { report.errors.push(`backup journal: ${e.message}`); }
  }
  if (!DRY_RUN && FLIP && !report.errors.length) {
    try { await game.settings.set("fourththing", "armorModel", "lines"); report.flipped = true; } catch (e) { report.errors.push(`flip: ${e.message}`); }
  }

  const upd = report.rows.filter(r => r.change === "update").length;
  console.log(`[armor re-seed] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${report.rows.length} armor docs (${upd} to update), ${report.weapons.length} two-handed weapon tags, ${report.skippedMonsters} monsters skipped, ${report.errors.length} errors`);
  console.table(report.rows);
  if (report.weapons.length) console.table(report.weapons);
  if (report.errors.length) console.warn("[armor re-seed] errors", report.errors);
  globalThis.__armorReseedReport = report;
  ui.notifications?.info(`Armor re-seed ${DRY_RUN ? "dry run" : "applied"}: ${upd} armor updates, ${report.weapons.length} weapon tags${report.flipped ? ", armorModel → lines" : ""}${report.errors.length ? `, ${report.errors.length} ERRORS (console)` : ""}.`);
})();
