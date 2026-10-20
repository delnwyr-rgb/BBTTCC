/* patch-r2-road-2026-10-20.macro.js — Story Review Ledger ROUND 2, "Act 2 the road" rows 1–10 (all Accept, Dave 2026-10-20).
 *
 *   1  fixit_gullywasher_interior_convo   the Q&A door assumes you have met Gully (the welcome stays the first meeting)
 *   2  fixit_general_store_coversation / fixit_weeping_prisoner / fixit_power_station_conversation   the three hub set-ups out of the
 *      staccato template, the Ledger's drafts verbatim (facts kept, pivot pairs gone)
 *   3  khezek_tor_town_walk   the cookline walk starts at the shift change (the arrival intro already said the floodlights)
 *   4  lyrenn_water_choir / khezek_tor_main_scene / lyrenn_the_field_that_remembers_you_burn_the_field   pivot pairs + the burn outcome
 *   5  lyrenn_forest_will_not_be_fought_force_burn   the campaign's heaviest Lyrenn penalty gets its paragraph (Dave's edit of the draft:
 *      "Lyrenn will pay for this. Then you.")
 *   6  khezek_tor_the_brace / _the_maw / _the_lift_hall / _darkness_shipment   the Khezek door set rewritten at the same length in the
 *      Maw's register (the Maw = the Ledger sample verbatim; Dave: "Let's please do it and I will come behind with wordsmithing");
 *      the Brennig Tamsin paragraphs and the Night the Mountain Coughed paragraph are kept word for word
 *   7  enc_circuit_riders_colossus   Dennis in sentence case (only the Captain announces in caps)
 *   8  vs_bridge_triangle / khezek_tor_the_vaulhaulan_seal_break   the coastward end of the heading is the LANDING, not the camp
 *   9  fixit_pip_and_patter_convo   "unless you already know which is which."
 *  10  khezek_tor_quest_acceptance   "while they were settling the first hexes"
 *
 *  Every edit guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const rep = (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: baseline text not found for "${note}"`); return; }
    b.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };
  // full rewrite, guarded by how the live text starts (so a later hand edit is never overwritten)
  const setDesc = (id, startsWith, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d === to) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.startsWith(startsWith)) { report.push(`⚠ ${id}: baseline start not found for "${note}"`); return; }
    b.description = to; changes++; report.push(`✚ ${id}: ${note}`);
  };
  const repChoice = (id, labelRe, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const c = (b.choices || []).find(x => labelRe.test(String(x?.label || "")));
    if (!c) { report.push(`⚠ ${id}: choice ${labelRe} not found`); return; }
    const d = String(c.description || "");
    if (d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.includes(from)) { report.push(`⚠ ${id}: choice baseline not found for "${note}"`); return; }
    c.description = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`);
  };

  /* 1 · the Q&A door has met him */
  rep("fixit_gullywasher_interior_convo",
    "There is a Chupacabra standing behind the bar, washing glasses. Oh shit he's the bartender. The Q&A person. The being worth seeing.\n\nThat was not on your post-Apocalyptic 5D bingo card this morning.",
    "Gully is behind the bar, washing a glass that was already clean, which is where Gully is. He raises one eyebrow by way of a menu.",
    "the Q&A door assumes you have met Gully");

  /* 2 · three hub set-ups */
  setDesc("fixit_general_store_coversation", "The Counter is a slab of reinforced metal worn smooth at the edges.",
    "The Counter is a slab of reinforced metal worn smooth at the edges, and every transaction at the Farm passes over it: parts, promises, information. There is no price list. Mara, or whoever stands here, looks at you for a while and then quotes weight, the weight of what you are to them, and the Counter hums faintly under it, the way a ledger would if ledgers hummed.",
    "the Counter, one paragraph");
  setDesc("fixit_weeping_prisoner", "The thief is moved to a back room.",
    "The thief has been moved to a back room, hands still bound, bleeding but not gravely. The Jackalopes are not angry, which is worse; they are quiet, and they are looking at you. Mara gestures lightly. \"This is your territory. What does justice look like?\" The thief says it wasn't for him. That might be true.",
    "the prisoner, one paragraph");
  setDesc("fixit_power_station_conversation", "Heat hits first.",
    "Heat first, then noise. The Generator Hall is a cathedral of vibration, turbines spinning under thick housing, and Old Gearbox moves through it like a priest in ritual space. The upgrades are recent and careful: redundant shielding, extra dampeners, the work of someone getting ready for more load than the Hall has ever carried, or a surge, or a hit. You are not allowed in here unescorted, and an invitation is not casual.",
    "the Generator Hall, one paragraph");

  /* 3 · the cookline walk starts at the shift change */
  rep("khezek_tor_town_walk",
    "You hear Khezek Tor before you see it. A low, constant vibration — stone grinding against memory. Floodlights burning day and night. Not for visibility. For warning.\n\nBut at the shift change, the mountain shows you its other face: the cookline.",
    "At the shift change, the mountain shows you its other face: the cookline.",
    "the walk opens at the cookline");

  /* 4 · pivot pairs + the burn */
  rep("lyrenn_water_choir", "It is not music with rhythm.\n\nIt is music with patience.", "It is music, but with patience where the rhythm should be.", "the Choir's patience line");
  rep("khezek_tor_main_scene", "Floodlights burn day and night.\n\nNot for visibility.\n\nFor warning.", "Floodlights burn day and night, for warning, not for seeing by.", "floodlights, one line");
  setDesc("lyrenn_the_field_that_remembers_you_burn_the_field", "Flame races too quickly.",
    "Flame runs faster than it should, the plants scream once, all together, and then the field is quiet. The air out there is simple now. Too simple, Rowan says, and does not say anything else to you for a day.",
    "the burn outcome, one paragraph");

  /* 5 · the forest burns from a distance */
  setDesc("lyrenn_forest_will_not_be_fought_force_burn", "From your vantage you watch the flames begin. And that is all there is to it.",
    "From your vantage you watch the flames begin, and the forest does not run. It stands and burns and keeps its line to the last trunk, which is how you find out the fence was never the point. By morning the Water Choir has gone flat by a whole tone, the Green Ring's furrows have turned their backs on the path you walk, and Rowan is standing in the ash with their palm on the ground, listening to something that is no longer there. Lyrenn will pay for this. Then you.",
    "the force-burn gets its paragraph");

  /* 6 · the Khezek door set */
  setDesc("khezek_tor_the_brace", "A massive reinforcement structure groans under its own ambition.",
    "The Brace is a reinforcement structure the size of a chapel, and it groans under its own ambition: iron struts layered over timber, stone plugs wedged against a collapse that already happened once. On purpose, if you believe the oldest chalk. The mountain shut its own mouth on the people who owned it, centuries back, and the Brace is where the advance crew wedged that mouth open again. Chalk covers every beam, measurements and angles and names, and under the chalk the warning sigils overlap older warnings in a hand nobody living writes. When the mine is quiet, the Brace shifts. Never enough to fall. Always enough to remind everyone it could, and that if it does the mountain will not simply collapse; the hex will change, and stay changed.<p>The Brace went up after the Night the Mountain Coughed — the last crew's night, before your time, when somebody opened a Yesodium chamber wrong and the gallery wall came off. Half the town thinks the mountain did it on purpose. The other half won't say.</p>",
    "the Brace in the Maw's register");
  setDesc("khezek_tor_the_maw", "The mouth of the shaft is wider than comfort requires.",
    "The mouth of the shaft is wider than comfort requires. Timbers creak, metal groans, and cold air climbs out of it like the breath of something asleep. The primary shaft goes deeper than the original survey ever dared to write down; the level markers hang crooked, and Level Four is scratched over twice, once by the survey that stopped counting the night the mountain closed itself, back in the bunker years, and once by Calder. Below that there is no official numbering. The walls are veined with ore that glows the way a memory glows, in pulses, and when the mine rests the whispers come up, not words, more the shape words make before anyone has decided to say them. Nobody goes below Four alone any more. Not since the leaning started. The one thing every whisper agrees on: the shaft walls hold the outlines of standing figures no pick ever carved. Management calls it mineral banding. The miners call it company.",
    "the Maw, the Ledger sample");
  setDesc("khezek_tor_the_lift_hall", "The Lift Hall never stops moving.",
    "The Lift Hall never stops moving. Chains rattle, platforms rise and fall, and the ore carts roll through in a procession with no visible beginning. Rig components wait in ordered stacks, pristine beside the raw stone, and the workers rotate through so fast that their faces blur into one tired, competent face. Authority down here is simple: someone decides, or everyone dies. The air tastes metallic and electric, and not from the tools; it is the taste of something that could happen. The Yesodium shipments are marked with care, handled with gloves, and spoken to, sometimes, by people who would deny it upstairs.\n\nThe Lift Hall has a quartermaster now, or rather it always did and the paperwork finally admits it: Brennig Tamsin — yes, THAT Tamsin's brother; there were three, and the middle one leaned into the cage shaft after a dropped manifest and is, technically, still on the manifest — runs the crates, the counts, and the cage schedule from a desk built out of two pallets and a door. There's a scar along his jaw he calls the mountain's receipt. His brother the Father visits more than any parish requires, which Brennig puts down to guilt and love, in whichever order. He is wrong about the order, and about a third thing he doesn't know to count.",
    "the Lift Hall in the Maw's register");
  setDesc("khezek_tor_darkness_shipment", "Ore crates from Khezek-Tor hum faintly during transit.",
    "Ore crates out of Khezek-Tor hum faintly in transit, and it is not an ominous hum so much as an unsettled one, the sound of something that has not been told where it is going. Mishandle a crate and the trouble stays local and strange: arguments break out within earshot, lights flicker, dreams go sour for a night. Nobody here calls the ore cursed. The word they use is framed, as in improperly, as in somebody has been carrying it like cargo when it has opinions about that.\n\nBrennig has a theory he shares only after the second crate: Yesodium is proud. In the bunker years it sat under one family who sold it to one client and let the rest of it idle while the valley went hungry, and it has not forgotten being taken for granted. “You don’t have to like the stone,” he says. “You have to notice it.”",
    "the Shipment in the Maw's register");

  /* 7 · Dennis, sentence case */
  repChoice("enc_circuit_riders_colossus", /nervous about/i, "\"EVERYTHING. THAT'S WHAT MAKES IT A GOOD RIDER. PROBABLY.\" He hears himself. \"NOT PROBABLY.\"", "\"Everything. That's what makes it a good Rider. Probably.\" He hears himself. \"Not probably.\"", "Dennis: everything, sentence case");
  repChoice("enc_circuit_riders_colossus", /ask its name/i, "\"PROVISIONALLY, THE COLOSSUS.\"", "\"Provisionally, the Colossus.\"", "Dennis: provisionally, sentence case");

  /* 8 · the coastward end is the landing */
  rep("vs_bridge_triangle", "coastward, ending at a stretch of nothing that gets visited far too regularly to be nothing.", "coastward, ending on the coast, at a landing that gets visited far too regularly to be nothing.", "the Triangle ends at the landing");
  rep("khezek_tor_the_vaulhaulan_seal_break", "and whatever runs supply to that stretch of nothing knows the door just unlocked itself from your side.", "and whatever runs supply down that line knows the door just unlocked itself from your side.", "the seal break: down that line");

  /* 9 · Pip and Patter */
  rep("fixit_pip_and_patter_convo", "impossible to tell apart unless you already know\n\n", "impossible to tell apart unless you already know which is which.\n\n", "which is which");

  /* 10 · no design jargon in a player line */
  rep("khezek_tor_quest_acceptance", "while they were standing up the six-tier hexes", "while they were settling the first hexes", "settling the first hexes");

  console.log(`[r2 road 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-r2-road-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — round 2, the road.`);
})();
