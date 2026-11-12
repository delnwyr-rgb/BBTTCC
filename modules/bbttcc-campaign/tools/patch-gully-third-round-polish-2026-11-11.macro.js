/*
 * patch-gully-third-round-polish-2026-11-11.macro.js — Dave (2026-11-11) polish: rc_gully_third_round takes Dave's text.
 * Typos fixed: "very few … actually knows" → "know", "proceeded me" → "preceded me", nested quotes made single ('Thirty Meters…',
 * 'seen'), "STUFF IT GARY" → "STUFF IT, GARY", "myself friends" → "myself, friends", "So - That's" → "So — that's",
 * "thousand watt" → "thousand-watt"; the long speech runs as one multi-paragraph quote.
 * Ember Bad Eden. globalThis.__thirdDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__thirdDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "rc_gully_third_round");
  if (!b) throw new Error("rc_gully_third_round missing");
  const TEXT = [
    "You buy the third round. He pours it himself, strikes a pose, and begins to soliloquize.",
    "“I am from goat country.” Someone at a nearby table mutters under their breath. “STUFF IT, GARY. No one cares what you think when you’re that color.”",
    "“So, GOAT COUNTRY. Addresses like ‘Thirty Meters Past The Little Chickens.’ Humble beginnings, to say the least.” He takes a sip of The Amber Thing, does NOT change color, and continues. “Everybody down there knows a Chupacabra story, my ducks, but of course very few from any settled hex actually know a Chupacabra. Same with the Jackalopes and our Very Furry Kin. Suffice it to say, when I left home to seek fame and fortune and bartending school, I was taken aback by the … reactions I got. Three towns in a row put up a sign: CHUPACABRA SEEN. I wasn’t ‘seen.’ I was applying for jobs.",
    "“Well, eventually, my reputation preceded me in a more positive way. I mean, I tended bar in a town that voted, twice, to run me out. Both times the vote lost, because the only roof in town that didn't leak was mine. Someone wrote a play about it. I was flattered. It wasn’t a good play.",
    "“So — that's where I'm from. Allow me to introduce myself, friends. Dougan. Dougan Marsh.” And he raises a glass to himself with a thousand-watt smile."
  ].join("\n\n");
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("third round: Dave's text"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("THIRD " + JSON.stringify(report));
  return report;
})();
