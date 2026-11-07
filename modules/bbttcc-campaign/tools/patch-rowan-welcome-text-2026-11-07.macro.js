/*
 * patch-rowan-welcome-text-2026-11-07.macro.js — Dave 2026-11-07: new text for "Lyrenn — Rowan Introduces You to the Ground"
 * (lyrenn_rowan_welcome). Quotes normalised to straight quotes to match the rest of the card.
 * Ember Bad Eden. globalThis.__rowanWelcomeDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__rowanWelcomeDry !== false, report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, id = C.getActiveCampaignId(), c = C.getCampaign(id), beats = foundry.utils.deepClone(c.beats);
  const b = beats.find(x => x.id === "lyrenn_rowan_welcome"); if (!b) throw new Error("beat not found");
  const TEXT = [
    "You find Rowan of the Loam standing in a fallow row, doing nothing at all, doing it with total commitment.",
    "Whatever, the vegetables here look fantastic.",
    "They study you like a half-remembered dream, and NOT like they are tripping balls and not sharing.",
    "Then they crouch, press one palm flat to the soil, and gesture — unhurried, kinda wavy armed — for you to do the same.",
    "You have been told they are like this without any drugs at all. But everyone here is clearly on SOMETHING, and so anything they say should be taken with a grain of something potent.",
    "Being around THEM kind of feels like being high.",
    "The ground is warm where it should be cool. Under the warmth, very faint, a rhythm, like gentle breathing.",
    "\"Lyrenn likes to know the vibe of new people,\" Rowan says. \"Now it knows yours.\"",
    "They straighten up and give you the rarest thing in Bad Eden: a smile with nothing behind it but the smile.",
    "You were not prepared for how happy and relieved the smile seems to make you.",
    "\"Welcome to Lyrenn. Walk gently the first week. It notices manners.\"",
    "They also give advice that makes sense!",
    "Right. No drugs. L. Ron Hubbard said the same thing."
  ].join("\n\n");
  if (b.description !== TEXT) { b.description = TEXT; report.changed.push("description"); }
  if (!DRY_RUN && report.changed.length) await C.saveCampaign(id, { ...c, beats });
  console.log("ROWANWELCOME " + JSON.stringify(report));
  return report;
})();
