/* patch-morale-to-loyalty-2026-10-20.macro.js — MORALE → LOYALTY on every beat (ruling 19 follow-through, Dave 2026-10-20)
 *  Faction Morale was retired 2026-10-18 (ruling 19); the engine already ignores factionEffects[].moraleDelta, but 62 beats still
 *  carried a non-zero morale buff/debuff that silently did nothing. This folds each one into loyaltyDelta on the same row:
 *    · loyalty 0            → loyalty = morale                                   (the common case)
 *    · same sign, both set  → loyalty = the larger magnitude (the blessed hex max-rule — no inflation)
 *    · opposite signs       → loyalty is kept as authored, morale dropped, row listed in the report for Dave's eye
 *  then zeroes moraleDelta on every row so lint E02 goes quiet. Also rewrites the eight "Morale −2;" summary lines and two GM notes
 *  that name morale as a cost; the Cadence's "morale like a weather system" is prose about a marching band and stays.
 *  Every edit guarded by the live baseline. DRY_RUN default true; GM only; backs up `campaigns`.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; let changes = 0;
  const ok = (m) => report.push("· ok " + m);
  const add = (m) => { changes++; report.push("✚ " + m); };
  const warn = (m) => report.push("⚠ " + m);
  const B = (id) => { const b = byId.get(id); if (!b) warn(`${id}: beat missing`); return b; };
  const rep = (id, from, to, field = "description") => {
    const b = B(id); if (!b) return;
    const cur = String(b[field] || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id}.${field} already reads the new text`);
    if (!cur.includes(from)) return warn(`${id}.${field}: baseline not found — skipped`);
    b[field] = cur.replace(from, to); add(`${id}.${field}: text`);
  };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  // ── 1. fold moraleDelta into loyaltyDelta on every factionEffects row ──
  let folded = 0, maxed = 0, kept = 0, zeroed = 0;
  for (const b of camp.beats) {
    const rows = b?.worldEffects?.factionEffects;
    if (!Array.isArray(rows)) continue;
    rows.forEach((r, i) => {
      if (!r || typeof r !== "object" || !("moraleDelta" in r)) return;
      const m = num(r.moraleDelta), l = num(r.loyaltyDelta);
      const tag = `${b.id}.factionEffects[${i}] (${r.factionId || "?"})`;
      if (m !== 0) {
        if (l === 0) { r.loyaltyDelta = m; folded++; add(`${tag}: morale ${m} → loyalty ${m}`); }
        else if (Math.sign(m) === Math.sign(l)) {
          const v = Math.sign(l) * Math.max(Math.abs(m), Math.abs(l));
          if (v !== l) { r.loyaltyDelta = v; maxed++; add(`${tag}: morale ${m} + loyalty ${l} → loyalty ${v} (max-rule)`); }
          else { kept++; add(`${tag}: morale ${m} dropped, loyalty ${l} already carries it`); }
        }
        else { kept++; add(`${tag}: ⚑ opposite signs — morale ${m} dropped, loyalty ${l} kept as authored`); }
      }
      if (r.moraleDelta !== 0) { r.moraleDelta = 0; zeroed++; if (m === 0) add(`${tag}: moraleDelta ${JSON.stringify(r.moraleDelta)} → 0`); }
    });
  }
  report.push(`· fold summary — ${folded} moved · ${maxed} max-ruled · ${kept} dropped (loyalty already set) · ${zeroed} rows zeroed`);

  // ── 2. the summary lines that still say Morale ──
  for (const [id, who] of [
    ["rc_pike_soured", "Allesh-Gilliam's"], ["rc_etta_soured", "Allesh-Gilliam's"], ["rc_tamsin_soured", "Allesh-Gilliam's"],
    ["rc_elsin_soured", "Lyrenn's"], ["rc_bez_soured", "Khezek Tor's"], ["rc_drax_soured", "Khezek Tor's"], ["rc_gully_soured", "the Farm's"],
  ]) rep(id, `Morale −2; ${who} standing slips a step.`, `Loyalty −2; ${who} standing slips a step.`);
  rep("ag_plumb_to_the_wall", "Coalition morale +1, loyalty +1.", "Coalition loyalty +1.");

  // ── 3. the two GM notes that name morale as the cost ──
  rep("chuckle_cancelled", "expect a morale/relationship cost with any faction that valued this place", "expect a loyalty/relationship cost with any faction that valued this place");
  rep("soft_landing_harden", "apply the morale and relationship cost, and note that", "apply the loyalty and relationship cost, and note that");

  console.log(`[patch-morale-to-loyalty] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Morale → Loyalty DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Morale → Loyalty: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-morale-to-loyalty-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Morale → Loyalty APPLIED: ${changes} change(s). Loyalty is the indicator now.`);
})();
