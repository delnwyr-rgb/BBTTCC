/* patch-jeargan-manifest-line-2026-10-26.macro.js — Jeargan didn't walk off; he came BACK to make them stop (Dave, 2026-10-26).
 *  Why: Wick = Jeargan (ruled 2026-10-25) — on the night he raced back to the mine to warn them, and was too late.
 *   The Name Under the Thumb's manifest read "WALKED OFF SHIFT… UP THE HAUL ROAD" and "his nerve broke" — a deserter, not a warning.
 *   EDIT  ninth_guest_the_name   manifest line + the prose after it: signed off early, came back running, SAID STOP, too late by minutes.
 *   EDIT  ninth_guest_the_name   Receipt "Jeargan's Line" truth to match.
 *   EDIT  story.scripts.lost_statues  "when one of them walked off his" → "when one of them left his".
 *  Idempotent; DRY_RUN default true; backs up `campaigns`; true copy via JSON (deepClone once made a write silently no-op). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  // replace `from` with `to` in obj[field]; ok if `to` already there
  const rep = (where, obj, field, from, to, note) => { if (!obj) return report.push(`⚠ ${where}: not found`); const d = String(obj[field] || "");
    if (d.includes(to)) return report.push(`· ok ${where}: ${note}`);
    if (d.includes(from)) { obj[field] = d.replace(from, to); changes++; return report.push(`✚ ${where}: ${note}`); }
    report.push(`⚠ ${where}: baseline ${field} not found for "${note}" — left alone`); };

  const ID = "ninth_guest_the_name", b = byId.get(ID);
  rep(ID, b, "description",
    "The twelfth is struck through in the foreman's hand: WALKED OFF SHIFT 9:40 PM. UP THE HAUL ROAD. SHOUTING.",
    "The twelfth is struck through in the foreman's hand: SIGNED OFF EARLY 8:15 PM. CAME BACK UP THE HAUL ROAD 9:40 PM, RUNNING. SHOUTING. SAID STOP.",
    "manifest line: came back, said stop");
  rep(ID, b, "description",
    "and on the night itself his nerve broke and he ran to tell the crew to get out. He was most of the way up the road when the mountain went.",
    "and on the night itself he went home early, and somewhere on the road home the dream turned over, and he came back running to make them stop. He was most of the way up the road when the mountain went. Too late by minutes.",
    "prose: he ran back to warn them, too late");
  const r = (b?.worldEffects?.receipts || []).find(x => x && x.label === "Jeargan's Line");
  rep(`${ID} receipt`, r, "truth",
    "struck from the sign-off at 9:40 PM on October 31, 2077 for running up the haul road to warn the crew.",
    "struck from the sign-off on October 31, 2077: he went home early, then came back up the haul road at 9:40 PM, running and shouting for the crew to stop. He was too late by minutes.",
    "Receipt truth: came back to warn them");

  rep("story.scripts.lost_statues", camp.story?.scripts?.lost_statues, "description",
    "when one of them walked off his:", "when one of them left his:", "the statues' script: left, not walked off");

  console.log(`[jeargan manifest line 2026-10-26] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-jeargan-manifest-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Jeargan came back to say stop.`);
})();
