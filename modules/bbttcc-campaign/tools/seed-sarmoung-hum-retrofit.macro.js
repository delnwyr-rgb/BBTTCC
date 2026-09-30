/* seed-sarmoung-hum-retrofit.macro.js — THE SARMOUNG HUM, inside Tier 1 only (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/SARMOUNG_HUM_RETROFIT_2026_09_27.md. The Hum is UNSCRIPTED BY RULING (09-15) and the Revelation Ladder's Tier 1 forbids naming,
 * rewarding, meters, receipts, closers. This seeder therefore does only: Bit/Coll speakers on the two tent beats (their personas + court secrets
 * already exist), an exit that survives Act 1, and one COUNTABLE (non-rewarding) exit on each of rungs 2–6. No script, no receipt, no roles.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const bit = (game.actors?.contents || []).find(a => a.name === "Scavenger — Bit"), coll = (game.actors?.contents || []).find(a => a.name === "Scavenger — Coll");
  if (!bit || !coll) say("✗ Bit / Coll actors not found — speakers skipped");

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  if (!byId.get("hum_quiet_tent")) return ui.notifications.error("hum_quiet_tent missing — the Hum was never seeded here.");
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);

  edit("hum_quiet_tent", b => { if (!b.speakerActorId && bit) b.speakerActorId = bit.id; }, "Bit speaks");
  edit("hum_quiet_tent_ask", b => { if (!b.speakerActorId && coll) b.speakerActorId = coll.id; }, "Coll speaks");
  addChoice("hum_quiet_tent", ch("On to wherever the road goes.", "", { description: "The woman changes the water in the basin nobody uses. Bit puts his boots back on. Nobody says goodbye; it's a tent." }), "an exit that survives Act 1");
  // countable, not rewarding
  addChoice("hum_loud_revival", ch("Count the seats.", "", { description: "Three hundred. You count twice. The town has eighty people in it and the singing is excellent." }), "countable exit");
  addChoice("hum_quiet_decline", ch("Ask after their dead in return.", "", { description: "They tell you the number, and they are glad to have been asked, and they still don't eat." }), "countable exit");
  addChoice("hum_loud_echo", ch("Ask the smith what she knew how to do.", "", { description: "\"Everything I do. Hands-first. She didn't know my name.\" He goes back to work and hits it harder than it needs." }), "countable exit");
  addChoice("hum_quiet_ledger", ch("Read the tally down.", "", { description: "The numbers only ever go down. The most recent cut is not recent. You do not add one." }), "countable exit");
  addChoice("hum_loud_handwriting", ch("Stand there a while longer.", "", { description: "It keeps not spelling anything for exactly as long as you stand there. Then you leave, and it is still not spelling anything." }), "countable exit");

  console.log(`[seed-sarmoung-hum-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Sarmoung Hum (Tier 1) DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Sarmoung Hum: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-hum-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Sarmoung Hum (Tier 1) APPLIED: ${changes} change(s). Noted. F5.`);
})();
