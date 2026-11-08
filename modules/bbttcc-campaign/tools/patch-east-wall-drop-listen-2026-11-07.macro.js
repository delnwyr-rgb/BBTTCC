/*
 * patch-east-wall-drop-listen-2026-11-07.macro.js — Dave 2026-11-07 at the East Wall: "I'd like to get rid of the Listen to the Wall
 * choice. That's now Plumb's job … Plumb is how the Stewards get the Wall to give up the receipts." (ag_plumb_to_the_wall already
 * grants both of the wall's secrets as Receipts.) The wall is still won on three successes (Survey / Crew / Read → the tally).
 *   • allesh_gilliam_the_east_wall_intro loses "Listen to the wall".
 *   • the allesh_gilliam story script's East Wall step stops listing allesh_gilliam_east_wall_listen.
 *   The beat itself stays in the campaign, unreachable (deleting it is Dave's call).
 * Ember Bad Eden. globalThis.__wallListenDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__wallListenDry !== false, report = { DRY_RUN, changed: [] };
  const LISTEN = "allesh_gilliam_east_wall_listen";
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats), story = foundry.utils.deepClone(c.story || {});
  const intro = beats.find(b => b.id === "allesh_gilliam_the_east_wall_intro");
  if (!intro) throw new Error("allesh_gilliam_the_east_wall_intro not found");
  const n0 = (intro.choices || []).length;
  intro.choices = (intro.choices || []).filter(x => x.next !== LISTEN);
  if (intro.choices.length !== n0) report.changed.push("East Wall: Listen choice removed");
  for (const st of Object.values(story?.scripts?.allesh_gilliam?.steps || {})) {
    if (Array.isArray(st?.beats) && st.beats.includes(LISTEN)) { st.beats = st.beats.filter(x => x !== LISTEN); report.changed.push("allesh_gilliam script step: listen beat dropped"); }
  }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats, story });
  console.log("WALLLISTEN " + JSON.stringify(report));
  return report;
})();
