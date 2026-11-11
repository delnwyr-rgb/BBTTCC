/*
 * patch-east-wall-no-receipts-2026-11-11.macro.js — Dave (2026-11-11): receipts are courtly secrets with a purpose and a
 * place to be played; the East Wall's two ("The Lean Began That One Night", "The Twice-Patched Section") have nowhere to
 * be spent. "I don't think the wall gives receipts. I think we remove the Listen to the Wall choice there. Plumb is the
 * one who talks to the wall, and the info he provides counts as a success for the purpose of Pike."
 *
 *  1. allesh_gilliam_east_wall_listen (the Talk-with-the-wall offer) retired: dialogueOffer off, inject gated on storyPhase ≥ 99 (kept, not deleted, so old saves that point at it still resolve).
 *  2. ag_plumb_to_the_wall: no receipts; "the same place yours went" goes (the Stewards no longer listened first); the GM
 *     note says Plumb's report counts as one success at Pike's tally.
 *  3. ag_east_wall_tally: Plumb at the wall counts as one success; three or more → The Wall Stands Proper.
 *  4. The East Wall actor: mal-voice armed secrets disarmed (moved to persona.secretsRawRetired) — talking to it hands
 *     out nothing.
 *  5. Any Domain holding the two wall receipts loses them (playtest copies).
 *
 * Ember Bad Eden. globalThis.__eastWallDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__eastWallDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const get = (id) => { const b = beats.find(x => x.id === id); if (!b) throw new Error(id + " not found"); return b; };

  const listen = get("allesh_gilliam_east_wall_listen");
  if (listen.dialogueOffer !== false) { listen.dialogueOffer = false; report.changed.push("listen: dialogueOffer off"); }
  listen.inject = listen.inject || {};
  const req = Array.isArray(listen.inject.requires) ? listen.inject.requires : [];
  if (!req.some(r => r?.flag === "storyPhase" && Number(r.gte) >= 99)) {
    listen.inject.requires = [...req.filter(r => r?.flag !== "storyPhase"), { flag: "storyPhase", gte: 99 }];   // retired: no act reaches 99
    report.changed.push("listen: inject gated off");
  }

  const walk = get("ag_plumb_to_the_wall");
  if (String(walk.description).includes(" — the same place yours went —")) {
    walk.description = walk.description.replace(" — the same place yours went —", "");
    report.changed.push("plumb: 'the same place yours went' removed");
  }
  const OLD_GM = /<i>⚙ GM: the wall's two armed secrets are now the party's as Receipts[^<]*<\/i>/;
  const NEW_GM = "<i>⚙ GM: what Plumb brings back counts as one success when the Stewards tally the wall with Pike. Allesh-Gilliam gains \"The Architect Is Paying Attention\" (Well-Maintained, +1 defense). Coalition loyalty +1.</i>";
  if (OLD_GM.test(walk.description)) { walk.description = walk.description.replace(OLD_GM, NEW_GM); report.changed.push("plumb: GM note"); }
  if (Array.isArray(walk.worldEffects?.receipts) && walk.worldEffects.receipts.length) {
    report.removedReceipts = walk.worldEffects.receipts.map(r => r.label);
    walk.worldEffects.receipts = [];
    report.changed.push("plumb: receipts removed");
  }

  const tally = get("ag_east_wall_tally");
  const OLD_T = "count the successes (Survey / Crew / Read, one each). Three → The Wall Stands Proper.";
  const NEW_T = "count the successes (Survey / Crew / Read, one each — and one more if Aldous Plumb went to the wall and talked to it). Three or more → The Wall Stands Proper.";
  if (String(tally.description).includes(OLD_T)) { tally.description = tally.description.replace(OLD_T, NEW_T); report.changed.push("tally: Plumb counts"); }
  for (const ch of (tally.choices || [])) {
    if (/^Three — /.test(String(ch.label || ""))) { const nl = String(ch.label).replace(/^Three — /, "Three or more — "); if (nl !== ch.label) { ch.label = nl; report.changed.push("tally: 'Three or more' choice"); } }
  }

  const wall = game.actors.get("ltBUl1UTtF2cOoM2") || game.actors.getName("The East Wall");
  const persona = wall?.flags?.["bbttcc-mal-voice"]?.persona || null;
  if (persona?.secretsRaw) {
    report.changed.push("wall: secrets disarmed");
    if (!DRY_RUN) await wall.update({ "flags.bbttcc-mal-voice.persona.secretsRawRetired": persona.secretsRaw, "flags.bbttcc-mal-voice.persona.secretsRaw": "" });
  }

  const NAMES = ["The Lean Began That One Night", "The Twice-Patched Section"];
  for (const a of game.actors.contents) {
    const hits = a.items.filter(i => i.flags?.["bbttcc-raid"]?.secret && NAMES.some(n => String(i.name).startsWith(n)));
    if (!hits.length) continue;
    report.changed.push(`${a.name}: ${hits.length} wall receipt(s) removed`);
    if (!DRY_RUN) await a.deleteEmbeddedDocuments("Item", hits.map(i => i.id));
  }

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("EASTWALL " + JSON.stringify(report));
  return report;
})();
