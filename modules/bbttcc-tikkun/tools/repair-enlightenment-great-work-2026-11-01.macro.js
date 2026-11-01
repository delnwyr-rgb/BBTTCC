/**
 * repair-enlightenment-great-work-2026-11-01.macro.js — Dave, 11-01: "we got bumped to Enlightened. That's a pretty big
 * enlightenment ladder jump, from 0-100 in one go" → "Yes to both, and all of the stewards should have gotten the effect."
 *
 * What went wrong (live, ember): brewing Young Gearbox's forgotten coffee (rc_gearbox_coffee, worldEffects.sparkGrants
 * recalcitrant_cafe) wrote Marginalia's FIRST-EVER spark as integrated → the ladder read 1/1 → Enlightened in one step. And the
 * grant reached Marginalia alone: _coalitionStewards read only the faction `roster` flag, not the Steward's own
 * flags.bbttcc-factions.factionId (Toblerone, Brexit the Terrible).
 *
 * Code fixes shipped with this macro (deploy + pm2 restart + hard reload BEFORE running it):
 *   • systems/fourththing/module.js — the Great Work is never smaller than THREE sparks (rung divides by max(held, 3))
 *   • bbttcc-campaign world-mutation-engine.js — _coalitionStewards unions roster + stewardsOf(factionId)
 * This macro repairs the world:
 *   1. GRANT — every coalition Steward (campaign factions, both membership links) missing the café spark gets it, created +
 *      integrated through api.tikkun.markSparkPhase (the same write the coffee makes; the ladder steps on the fixed formula).
 *   2. RECOMPUTE — every coalition Steward's Enlightenment is SET to the rung the corrected formula gives (Stewards only — NPCs keep
 *      their hand-set levels; this is the one place the ladder
 *      is allowed to go DOWN: Marginalia Enlightened → Awakening). Qliphothic Stewards are left alone.
 * Idempotent (rerun = 0). DRY_RUN first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const SPARK = { key: "recalcitrant_cafe", name: "The Recalcitrant Cafe", note: "Young Gearbox's forgotten coffee, brewed after eating everywhere." };
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const ENL = game.fourththing?.enlightenment;
  const TK = game.bbttcc?.api?.tikkun;
  if (!ENL?.rungForSparks || !ENL?.set || !TK?.markSparkPhase) return ui.notifications.error("APIs missing (fourththing.enlightenment / api.tikkun) — hard-reload after the deploy + restart.");
  if (ENL.GREAT_WORK !== 3) return ui.notifications.error(`Client runs the OLD formula (GREAT_WORK=${ENL.GREAT_WORK}) — pm2 restart + hard reload first, then rerun.`);
  const capi = game.bbttcc.api.campaign; const cid = capi.getActiveCampaignId(); const camp = capi.getCampaign(cid);
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const fids = Array.from(new Set([].concat(camp.factionIds || [], camp.factionId ? [camp.factionId] : []).map(x => String(x || "").replace(/^Actor\./, "")).filter(Boolean)));
  const MODF = "bbttcc-factions";
  const stewards = new Map();
  for (const fid of fids) {
    const F = game.actors.get(fid); if (!F) continue;
    for (const entry of (F.getFlag(MODF, "roster") || [])) { const id = String((typeof entry === "string" ? entry : (entry?.uuid || entry?.id)) || "").replace(/^Actor\./, ""); const a = game.actors.get(id); if (a?.type === "character") stewards.set(a.id, a); }
    for (const a of game.actors.contents) if (a.type === "character" && !a.getFlag(MODF, "isFaction") && String(a.flags?.[MODF]?.factionId || "") === fid) stewards.set(a.id, a);
  }
  const report = []; let changes = 0;
  report.push(`coalition factions: ${fids.map(f => game.actors.get(f)?.name || f).join(", ")} → ${stewards.size} Steward(s): ${[...stewards.values()].map(a => a.name).join(", ")}`);
  // 1 · GRANT the café spark to every coalition Steward missing it
  const grants = [];
  for (const a of stewards.values()) {
    const map = a.getFlag("bbttcc-tikkun", "sparks") || {};
    const have = map[SPARK.key] || Object.values(map).find(sp => sp && sp.key === SPARK.key);
    if (have?.integrated) { report.push(`· ok ${a.name} holds ${SPARK.name}`); continue; }
    grants.push(a); changes++; report.push(`✚ ${a.name}: ${SPARK.name} created + integrated`);
  }
  // 2 · RECOMPUTE the coalition Stewards' levels from the corrected formula (down is allowed here). Stewards ONLY — NPC
  //     characters (Father Tamsin, Mara, Furrier, Old Gearbox, The General) carry hand-set levels from the GM Edit panel, not Sparks.
  const fixes = [];
  for (const a of stewards.values()) {
    const level = ENL.level(a); if (level === "qliphothic") continue;
    const t = ENL.tally(a);
    const willGrant = grants.includes(a);
    const after = { total: t.total + (willGrant ? 1 : 0), integrated: t.integrated + (willGrant ? 1 : 0) };
    const want = ENL.LADDER[ENL.rungForSparks(after)];
    if (want === level) continue;
    fixes.push({ a, want }); changes++;
    report.push(`${ENL.LADDER.indexOf(want) < ENL.LADDER.indexOf(level) ? "▼" : "▲"} ${a.name}: ${ENL.LABELS[level]} → ${ENL.LABELS[want]} (${after.integrated}/${Math.max(after.total, ENL.GREAT_WORK)} of the Great Work)`);
  }
  console.log(`[repair enlightenment great work 2026-11-01] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__repairEnlightenment = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already repaired.");
  // apply: levels FIRST (so the grant's own ladder step lands on an already-correct rung), then the grants
  for (const { a, want } of fixes) await ENL.set(a, want);
  for (const a of grants) await TK.markSparkPhase({ actorId: a.id, sparkKey: SPARK.key, phase: "integrated", create: true, note: SPARK.note });
  await new Promise(r => setTimeout(r, 1500));
  // the grant's hook may have stepped a level again — re-assert the formula on everyone touched
  for (const a of new Set([...fixes.map(f => f.a), ...grants])) { const want = ENL.LADDER[ENL.rungForSparks(ENL.tally(a))]; if (ENL.level(a) !== want && ENL.level(a) !== "qliphothic") await ENL.set(a, want); }
  await ChatMessage.create({ speaker: { alias: "Bad Eden" }, whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
    content: `<div style="border-left:3px solid #e8c84a;padding:.35em .6em;background:rgba(232,200,74,.08);">✦ <b>The Great Work, re-measured</b> — the ladder now divides by at least three sparks.<ul style="margin:.3em 0 0 1em">${report.filter(l => /^[✚▼▲]/.test(l)).map(l => `<li>${foundry.utils.escapeHTML(l)}</li>`).join("")}</ul></div>` });
  ui.notifications.info(`Applied ${changes} change(s) — ${grants.length} spark grant(s), ${fixes.length} level(s) re-measured.`);
})();
