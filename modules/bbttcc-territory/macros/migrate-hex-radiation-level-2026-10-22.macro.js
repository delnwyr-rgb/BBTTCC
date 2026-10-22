// Bad Eden — Migrate to ONE radiation switch (2026-10-22)
// ─────────────────────────────────────────────────────────────────────────────
// GM macro, idempotent. DRY_RUN = true prints the change list and writes nothing.
//
// 1. HEXES (every scene): fold the old ways of marking radiation into the hex
//    Radiation level (flags.bbttcc-territory.mods.radiation, 0–3):
//      "Radiated" tag → ≥1 · "Contaminated" tag/modifier → ≥2 · "Radiation Zone" modifier → 3
//      old mods.radiation above 3 → 3
//    then re-stamp through api.territory.radiation.patch (Radiated tag + the Contaminated /
//    Radiation Zone production modifier follow the level; the stray Contaminated TAG goes).
//    Hexes whose production modifiers change get their resources recomputed.
// 2. GEAR (master-content items pack + world items + every actor's copy):
//      Rad Suit (Mk II / Mk III) → flags.bbttcc.radiationResist = true (Mk I already had it)
//      Rad‑Bloom Injector        → a real consume spec: Use = radiation RP to 0
// Factions keep whatever RP they hold (Stewards take exposure from now on).
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const DRY_RUN = true;

  if (!game.user?.isGM) { ui.notifications?.error("GM only."); return; }
  const MOD = "bbttcc-territory";
  const radApi = game.bbttcc?.api?.territory?.radiation;
  if (!radApi?.patch) { ui.notifications?.error("api.territory.radiation missing — deploy + reload first."); return; }

  const low = (s) => String(s || "").trim().toLowerCase();
  const isHex = (f) => f && (f.isHex === true || low(f.kind) === "territory-hex");
  const lines = [];

  // ── 1. Hexes ───────────────────────────────────────────────────────────────
  let hexChanged = 0, hexScanned = 0;
  const recompute = [];
  for (const sc of game.scenes) {
    const updates = [];
    for (const d of sc.drawings) {
      const f = d.flags?.[MOD];
      if (!isHex(f)) continue;
      hexScanned++;
      const conds = (Array.isArray(f.conditions) ? f.conditions : []).map(low);
      const mods  = (Array.isArray(f.modifiers) ? f.modifiers : []).map(low);
      let lv = Math.max(0, Math.round(Number(f.mods?.radiation) || 0));
      if (conds.includes("radiated")) lv = Math.max(lv, 1);
      if (conds.includes("contaminated") || mods.includes("contaminated")) lv = Math.max(lv, 2);
      if (mods.includes("radiation zone") || mods.includes("radiation zone (low)")) lv = 3;
      lv = Math.min(3, lv);
      const p = radApi.patch(f, lv);
      const same = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());
      const sameMods = Number(f.mods?.radiation ?? 0) === p.mods.radiation || (f.mods?.radiation === undefined && lv === 0);
      if (sameMods && same(f.conditions, p.conditions) && same(f.modifiers, p.modifiers)) continue;
      hexChanged++;
      const before = `rad=${f.mods?.radiation ?? "—"} tags=[${(f.conditions || []).filter(radApi.isRadTag).join(",")}] mods=[${(f.modifiers || []).filter(radApi.isRadTag).join(",")}]`;
      lines.push(`HEX ${sc.name} › ${f.name || d.text || d.id}: ${before} → level ${lv}`);
      // Any change to the production modifiers (incl. a hex that carried BOTH) moves its yield.
      if (!same(f.modifiers, p.modifiers)) recompute.push(d);
      updates.push({ _id: d.id, [`flags.${MOD}.mods`]: p.mods, [`flags.${MOD}.conditions`]: p.conditions, [`flags.${MOD}.modifiers`]: p.modifiers });
    }
    if (updates.length && !DRY_RUN) await sc.updateEmbeddedDocuments("Drawing", updates);
  }
  if (!DRY_RUN) {
    const rc = game.bbttcc?.api?.territory?.recomputeHexResources;
    if (typeof rc === "function") for (const d of recompute) { try { await rc(d, { source: "radiation-migration" }); } catch (e) { console.warn("recompute failed", d.id, e); } }
  }

  // ── 2. Gear ────────────────────────────────────────────────────────────────
  const RADBLOOM_CONSUME = { effects: [{ kind: "track", op: "set", track: "radiation", formula: "0" }], decrement: true, target: "self" };
  function gearPatch(it) {
    const n = String(it.name || "");
    if (/^Rad Suit \(Mk (II|III)\)$/i.test(n) && it.flags?.bbttcc?.radiationResist !== true)
      return { "flags.bbttcc.radiationResist": true };
    if (/^Rad.Bloom Injector$/i.test(n) && !it.getFlag?.("fourththing", "rfi.item.consume"))
      return { "flags.fourththing.rfi.item.consume": RADBLOOM_CONSUME };
    return null;
  }
  let gearChanged = 0;
  const pack = game.packs.get("bbttcc-master-content.items");
  if (pack) {
    const wasLocked = pack.locked;
    const docs = await pack.getDocuments();
    const ups = [];
    for (const it of docs) { const p = gearPatch(it); if (p) { ups.push({ _id: it.id, ...p }); lines.push(`PACK ${it.name}: ${Object.keys(p).join(", ")}`); } }
    gearChanged += ups.length;
    if (ups.length && !DRY_RUN) {
      if (wasLocked) await pack.configure({ locked: false });
      await Item.updateDocuments(ups, { pack: pack.collection });
      if (wasLocked) await pack.configure({ locked: true });
    }
  }
  const worldUps = [];
  for (const it of game.items) { const p = gearPatch(it); if (p) { worldUps.push({ _id: it.id, ...p }); lines.push(`WORLD ${it.name}: ${Object.keys(p).join(", ")}`); } }
  gearChanged += worldUps.length;
  if (worldUps.length && !DRY_RUN) await Item.updateDocuments(worldUps);
  for (const A of game.actors) {
    const ups = [];
    for (const it of A.items) { const p = gearPatch(it); if (p) { ups.push({ _id: it.id, ...p }); lines.push(`ACTOR ${A.name} › ${it.name}: ${Object.keys(p).join(", ")}`); } }
    gearChanged += ups.length;
    if (ups.length && !DRY_RUN) await A.updateEmbeddedDocuments("Item", ups);
  }

  const head = `[radiation-migration] ${DRY_RUN ? "DRY RUN — nothing written" : "APPLIED"}: ${hexChanged}/${hexScanned} hexes, ${gearChanged} gear item(s), ${recompute.length} resource recompute(s)`;
  console.log(head + "\n" + lines.join("\n"));
  ui.notifications?.info(head);
  return { dryRun: DRY_RUN, hexChanged, hexScanned, gearChanged, recompute: recompute.length, lines };
})();
