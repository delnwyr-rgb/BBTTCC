/* patch-market-templates-frames-2026-10-16.macro.js — TEMPLATES OUT OF THE MARKET, FIVE FRAMES STAMPED (Dave, 2026-10-16):
 *  "Hmmm, what do those actually do partner?" → "Let's make it so my friend!"
 *
 *  A. The seven rig TEMPLATES (War Rig / Forge Facility / Garrison Fort / Sail Barge / Landspeeder / Motorspeeder /
 *     Speeder Bike Template) are GM authoring kits: `flags.fourththing.rigGear.subtype = "rig-template"` + a
 *     `rigTemplate.config` that, dropped on a blank Rig, imports the named Frame AND every weapon / system / output
 *     from the items pack by name, then deletes itself. They carry no tier or price, so the market sold them as
 *     Standard Issue — a free Forge Facility Template installs 2900 marks of frame and fittings. They leave the
 *     catalog (every entry whose doc is a rig-template, plus the Gloomgill Boss Template if it ever got listed).
 *     The parts are sold separately and the rig builder seeds loadouts on its own.
 *  B. Five real frames were saved as `feat` docs and missed the 2026-10-12 untiered vehicle pass, so they had no
 *     tier / price: stamped by bracket to match their siblings (personal 250 · medium 750 · siege 2250; gunnery
 *     frames pay Violence like the War Rig, rubric §7; the rest Economy; sale-back 40%).
 *       Recon Drone Frame          T I   250 Econ   (personal, hull 5)
 *       Oathbound Courser Frame    T I   250 Econ   (personal, hull 8)
 *       Iron Howdah Frame          T II  750 Viol   (medium hybrid, mounted gunnery)
 *       Trade Hall Frame           T II  750 Econ   (medium stationary, 2 outputs)
 *       Hex-Cannon Platform Frame  T III 2250 Viol  (siege, hull 60, two main mounts)
 *     Doc type stays `feat` (a type change on a compendium doc is not worth the risk; the rig engine reads the
 *     rigGear/rigFrame flags, not the type).
 *
 *  Idempotent; DRY_RUN default true; backs up the catalog setting + the five docs' flags before writing. GM only.
 *  Needs the items pack unlocked for the write — the macro unlocks, writes, re-locks.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const MOD = "bbttcc-market", PACK_ID = "bbttcc-master-content.items";
  const report = []; let changes = 0;

  /* ── A. templates out of the catalog ───────────────────────────────────── */
  const TEMPLATE_IDS = new Set(["ZorepCPrkcUUZYo1", "TLuZhcCmu40SVlUi", "AlrCJ2mrtDiCXoEX", "k566v6k8JWX90wco", "WHPnMEceFupUUFul", "GDWKGmsKpkUPM8YV", "KRGPX9wpeUwsnX4n", "92rNBW1YfczhzciF"]);
  const catalogRaw = game.settings.get(MOD, "catalog") || [];
  const catalog = foundry.utils.deepClone(Array.isArray(catalogRaw) ? catalogRaw : []);
  const drop = [];
  for (const e of catalog) {
    if (String(e?.kind || "").toLowerCase() !== "gear") continue;
    const uuid = String(e?.uuid || ""); const id = uuid.split(".").pop();
    let isTemplate = TEMPLATE_IDS.has(id);
    if (!isTemplate && uuid) { try { const d = await fromUuid(uuid); isTemplate = d?.getFlag?.("fourththing", "rigGear")?.subtype === "rig-template"; } catch (_e) {} }
    if (isTemplate) drop.push(e);
  }
  const kept = catalog.filter(e => !drop.includes(e));
  if (drop.length) { changes += drop.length; for (const e of drop) report.push(`✚ catalog: drop "${e.name}" (${e.vendorId || "no vendor"})`); }
  else report.push("· ok catalog: no template entries left");

  /* ── B. the five frames ────────────────────────────────────────────────── */
  const STAMPS = {
    "7PlJJAaaLlFpMn8k": { name: "Recon Drone Frame",         tier: "I",   marks: 250,  currency: "economy",  note: "TI personal frame (feat-type frames pass 2026-10-16)" },
    "jbm7nX3uPr1X091l": { name: "Oathbound Courser Frame",   tier: "I",   marks: 250,  currency: "economy",  note: "TI personal frame (feat-type frames pass 2026-10-16)" },
    "IeosEiXUMCmzIzBV": { name: "Iron Howdah Frame",         tier: "II",  marks: 750,  currency: "violence", note: "TII medium frame · mounted gunnery pays Violence (rubric §7) (feat-type frames pass 2026-10-16)" },
    "NYQHu4gf3uVJZoCo": { name: "Trade Hall Frame",          tier: "II",  marks: 750,  currency: "economy",  note: "TII medium stationary frame (feat-type frames pass 2026-10-16)" },
    "3rJrXO5lj21nO0nt": { name: "Hex-Cannon Platform Frame", tier: "III", marks: 2250, currency: "violence", note: "TIII siege frame · gunnery pays Violence (rubric §7) (feat-type frames pass 2026-10-16)" }
  };
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(`Pack ${PACK_ID} not found.`);
  const updates = []; const before = {};
  for (const [id, s] of Object.entries(STAMPS)) {
    const doc = await pack.getDocument(id).catch(() => null);
    if (!doc) { report.push(`⚠ ${s.name}: ${id} not in ${PACK_ID}`); continue; }
    if (doc.name !== s.name) { report.push(`⚠ ${id}: name is "${doc.name}", expected "${s.name}" — skipped`); continue; }
    const cur = doc.getFlag("fourththing", "rfi")?.item || {};
    before[id] = foundry.utils.deepClone(doc.flags?.fourththing ?? {});
    if (cur.tier === s.tier && Number(cur.price?.marks) === s.marks && cur.price?.currency === s.currency && cur.frame === "vehicle") { report.push(`· ok ${s.name}: already T${s.tier} ${s.marks} ${s.currency}`); continue; }
    const price = { marks: s.marks, currency: s.currency, gmOverride: s.currency !== "economy", altCurrencies: {}, split: null, rarityMult: 1.0, notes: s.note, bound: "free", saleBack: Math.floor(s.marks * 0.4) };
    updates.push({ doc, data: { "flags.fourththing.rfi.item.tier": s.tier, "flags.fourththing.rfi.item.frame": "vehicle", "flags.fourththing.rfi.item.price": price } });
    changes++; report.push(`✚ ${s.name}: T${cur.tier || "—"} ${cur.price?.marks ?? "—"} → T${s.tier} ${s.marks} ${s.currency} (sale-back ${price.saleBack})`);
  }

  console.log(`[patch-market-templates-frames] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Templates/frames DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Templates/frames: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify({ catalog: catalogRaw, frameFlagsBefore: before }), "text/json", `backup-market-catalog-and-frame-flags-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  if (drop.length) await game.settings.set(MOD, "catalog", kept);
  if (updates.length) {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { for (const u of updates) await u.doc.update(u.data); }
    finally { if (wasLocked) await pack.configure({ locked: true }); }
  }
  ui.notifications.info(`Templates/frames APPLIED: ${drop.length} catalog entries dropped, ${updates.length} frames stamped. The Arc Bay sells parts, not kits.`);
})();
