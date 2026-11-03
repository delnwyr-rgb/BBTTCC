/**
 * patch-binah-bitter-sea-2026-11-02.macro.js — THE BITTER SEA: the Binah lamp's quest (Dave 2026-11-02; design doc Claude Doc
 * 3ujnM2eLcn3MzsjwN3cCyS). Binah was the one sephira no beat could light, and Gloomgill waits for all ten. A DIVE EXPEDITION (Dave:
 * "this should be a dive expedition. Using our underwater pressure and vertical tableau system") at Odaroloc Depths — the reservoir one
 * hex downriver of Chuckle Creek, where the three grief towns' losses come to rest. The Keeper is Winnie's Echo (Pearl's daughter,
 * Chuckle Creek); Thaarlbriindt guards the sluice (Dave: "Keep as guardian").
 *   start   binah_river_card — autoFire once Chuckle Creek, Soft Landing and Stillwater are all closed; reveals Odaroloc Depths
 *   arrival binah_surface    — the hex's arrival; "Take her down." = worldEffects.dive reef (needs a sub — players BUY one: Rig Builder)
 *   reef    binah_reef  → deep binah_deep → "Suit up and go out" = worldEffects.depthExposure (the pressure bites outside the hull)
 *   sluice  binah_sluice — name what each town lost (Insight DC 14 ×3) = Understood · open the sluice (Logistics OP 16) = Released
 *           (Winnie goes with the water; ⚙ Chuckle Creek −1) · carry it up = Carried (⚙ +1 Stress each) · break the dam (Violence OP 12)
 *           = Drowned (no lamp; hex Darkness +1; the sluice stays for next month)
 *   closer  binah_lamp — integrates the Conceptual Binah spark seated at Odaroloc Depths; +15 Faith/Culture; quest complete
 * Also: the quest's data-layer def + script (story.data.saveQuest), the hex arrival (hexOverrides), the registry row quest_bitter_sea.
 * Idempotent (rerun = 0). DRY_RUN first. Backups → Data/bbttcc-exports/. GM only.
 */
const BINAH_PATCH = (() => {
  const Q = "bitter_sea", QREG = "quest_bitter_sea", HEX = "Odaroloc Depths";
  const mark = (id) => ({ beatMark: id }), not = (id) => ({ beatMark: id, not: true });
  const GRIEF = [{ questBucket: "quest_chuckle_creek", is: "completed" }, { questBucket: "quest_soft_landing", is: "completed" }, { questBucket: "quest_stillwater", is: "completed" }];
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const chk = (label, stat, dc, next, failNext, extra = {}) => ch(label, next, "", { checkStat: stat, checkDC: dc, failNext, ...extra });
  const fe = (o) => ({ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false, ...o });
  const TICK = { depthExposure: { tick: true } };
  const beat = (id, label, description, choices, o = {}) => ({
    id, label, type: o.type || "dialog", timeScale: "scene", timePoints: 0, questId: QREG, tags: `quest.bitter_sea,spark.binah${o.tags ? "," + o.tags : ""}`, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: o.repeatable === true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [mark("binah_river_card")], evergreen: true, ...(o.autoFire ? { autoFire: true } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: "", priority: "background", story: { quest: Q, ...(o.role ? { role: o.role } : {}) }, choices, worldEffects: o.worldEffects || {}, sceneId: o.sceneId || "",
    where: o.where || HEX
  });
  const REEF = "Scene.4ZfR7WsbXImEnn9m", DEEP = "Scene.FTcDSXNIObBEug2K";
  const BEATS = [
    beat("binah_river_card", "The River Takes It Down",
      "The river is busy this morning, in a way rivers aren't. Past the last camp, one after another, three things go by at the same unhurried pace, all going the same way: a cassette with its label bleached to nothing, a foam glove giving a slow wave at nobody, a bell clapper that should sink and doesn't.\n\nThey aren't drifting. They're being delivered.\n\nDownriver, past Chuckle Creek, the water goes deep and very still: Odaroloc Depths, where the old reservoir drowned a valley the year the dam stopped mattering. Whatever is collecting the towns' leftovers is down there.",
      [ch("Noted.", "")], { requires: [...GRIEF], autoFire: true, role: "start", where: "anywhere",
        worldEffects: { revealHexes: [HEX], questEffects: [{ action: "accept", questId: QREG, beatId: "", state: "active", text: "The Bitter Sea." }] } }),
    beat("binah_surface", "Odaroloc Depths — The Bitter Sea",
      "{{#played binah_lamp}}The reservoir lies flat and clean under the sky. Somewhere below, a lamp is burning where a sluice used to be.{{else}}A dam that stopped mattering a long time ago, and behind it a reservoir that never got the news. The water is black and perfectly still; the river comes in at one end and simply stops being a river. A buoy rides in the middle of it with a hand-lettered sign: SORTING — DO NOT DISTURB — W.\n\nWhatever is down there, you need a hull that goes under to reach it.{{/played}}",
      [ch("Take her down.", "", "Dive to the reef.", { worldEffects: { dive: { band: "reef", hexName: HEX, then: "binah_reef" } }, requires: [not("binah_lamp")] }), ch("Not yet.", "")],
      { repeatable: true, type: "exploration" }),
    beat("binah_reef", "The Reef — Green Water",
      "Green water, and the sub's lights cutting cones through it. The three things from the river hang in the beam at the same slow pace, sinking now, all toward the same place below. And below — far below, at the edge of the light — a figure at a table, sorting. She doesn't look up. She has the patience of someone who has been doing one job for a very long time and has decided to be good at it.",
      [ch("Follow her down.", "", "Dive to the deep.", { worldEffects: { dive: { band: "deep", hexName: HEX, then: "binah_deep" } } }), ch("Surface.", "", "", { worldEffects: { dive: { surface: true } } })],
      { repeatable: true, sceneId: REEF }),
    beat("binah_deep", "The Deep — The Drowned Main Street",
      "The reservoir floor was a town once. A main street runs under the silt toward a sluice gate the size of a church door, and in front of it someone has made a sorting table out of a pew. Winnie's Echo works at it: Pearl's daughter, from Chuckle Creek, the one who was always just off-screen. She is very much on-screen now. Things come down the river and she sorts them.\n\nAt the gate, facing it, stands Thaarlbriindt. He doesn't face you. He has been facing that gate for a long time, and he is not going to stop for visitors.\n\nThe hull groans once, comfortably. Outside it, at this depth, the water would not be comfortable at all.",
      [ch("Suit up and go out to her.", "binah_sluice", "Outside the hull the pressure bites unless your suit is rated for it.", { worldEffects: { depthExposure: { outside: true } } }), ch("Surface.", "", "", { worldEffects: { dive: { surface: true } } })],
      { repeatable: true, sceneId: DEEP }),
    beat("binah_sluice", "The Sluice — Winnie's Table",
      "Winnie looks up when your boots touch the silt. \"You're from upstream. You've got upstream all over you.\" Three things on her table, still wet from a river that is all water: the tape, the glove, the clapper. \"Everything the towns couldn't hold comes down here. Somebody has to sort it or the river chokes. Say what it was, and it stays sorted. Don't, and it goes round again.\"\n\nBehind her, Thaarlbriindt has not moved, except that he is listening now.\n\n⚙ GM: each attempt out here bites — breath, then crush (deep) — for anyone not in a pressure-rated suit. Back aboard refills the air.",
      [ch("The tape (Chuckle Creek).", "binah_obj_tape", "", { requires: [not("binah_named_tape")] }),
       ch("The glove (Soft Landing).", "binah_obj_glove", "", { requires: [not("binah_named_glove")] }),
       ch("The clapper (Stillwater).", "binah_obj_clapper", "", { requires: [not("binah_named_clapper")] }),
       ch("It's understood.", "binah_understood", "All three named.", { requires: [mark("binah_named_tape"), mark("binah_named_glove"), mark("binah_named_clapper")] }),
       chk("Open the sluice and let it all go", "op.logistics", 16, "binah_released", "binah_obj_sinks"),
       ch("Carry it back up with us.", "binah_carried"),
       chk("Break the dam", "op.violence", 12, "binah_drowned", "binah_obj_sinks"),
       ch("Back aboard.", "binah_deep", "", { worldEffects: { depthExposure: { outside: false } } })],
      { repeatable: true, sceneId: DEEP }),
    beat("binah_obj_tape", "The Tape",
      "A cassette. On the label, in Pearl's hand, long gone to sun: SEASON ONE — FOR WINNIE. Winnie holds it like a receipt. \"She played it so nobody had to say it.\"",
      [chk("Say what it held · Insight DC 14", "insight", 14, "binah_named_tape", "binah_obj_sinks"), ch("Put it down for now.", "binah_sluice")], { repeatable: true, sceneId: DEEP, worldEffects: TICK }),
    beat("binah_obj_glove", "The Glove",
      "A foam glove, the kind that makes a punch land soft. \"Soft Landing made the whole world into this,\" Winnie says, turning it over. \"So nobody ever had to feel one land.\"",
      [chk("Say what it held · Insight DC 14", "insight", 14, "binah_named_glove", "binah_obj_sinks"), ch("Put it down for now.", "binah_sluice")], { repeatable: true, sceneId: DEEP, worldEffects: TICK }),
    beat("binah_obj_clapper", "The Clapper",
      "A bell clapper, wrapped in cloth so the bell would never ring. \"Stillwater kept everything still,\" Winnie says, \"so nothing could start that would have to end.\"",
      [chk("Say what it held · Insight DC 14", "insight", 14, "binah_named_clapper", "binah_obj_sinks"), ch("Put it down for now.", "binah_sluice")], { repeatable: true, sceneId: DEEP, worldEffects: TICK }),
    beat("binah_named_tape", "The Tape — Sorted", "You say it plainly: a mother kept a show running so she'd never have to hear that her daughter was gone. Winnie writes it in the ledger, one line, and sets the tape down on the sorted side of the pew. It stays.", [ch("Back to the table.", "binah_sluice")], { sceneId: DEEP }),
    beat("binah_named_glove", "The Glove — Sorted", "You say it: a town that softened every blow until nobody remembered what being hit was for. Winnie writes it down. The glove stays where she puts it.", [ch("Back to the table.", "binah_sluice")], { sceneId: DEEP }),
    beat("binah_named_clapper", "The Clapper — Sorted", "You say it: a town that held its breath so long it forgot it was holding it. Winnie writes it down, and for a moment the clapper rings once against the pew, very quietly, all on its own.", [ch("Back to the table.", "binah_sluice")], { sceneId: DEEP }),
    beat("binah_obj_sinks", "It Goes Round Again", "It slips. The current takes it back toward the gate, and Winnie sighs the way a clerk sighs at a form filled in wrong. \"It'll come round again. Everything does.\" Thaarlbriindt shifts his weight. He has seen this before.", [ch("Back to the table.", "binah_sluice")], { repeatable: true, sceneId: DEEP, worldEffects: TICK }),
    beat("binah_understood", "Understood", "Winnie closes the ledger. \"That's the whole job,\" she says. \"Saying what it was. Most people want to fix it. You can't fix it. You can only say it, and then it stays put.\" She tears out the page and hands it to you, which a clerk never does. Behind her, for the first time, Thaarlbriindt turns around. He looks at the three sorted things on the pew, then at you, and he steps aside from the gate.",
      [ch("Go to the gate.", "binah_lamp")], { sceneId: DEEP, worldEffects: { receipts: [{ label: "The Sluice Ledger", effectKey: "rollPlus3", acquisition: "earned", source: { name: "Winnie's Echo, at the sluice in Odaroloc Depths" }, truth: "One line for everything the three grief towns lost, in Winnie's hand: what the tape held, what the glove held, what the clapper held. Proof that someone said it out loud." }] } }),
    beat("binah_released", "Released", "You open the sluice. It takes everything, sorted and unsorted together, out through the gate in one long exhale, and the reservoir drops a hand's width all at once. Winnie goes with it. She doesn't fight it. She waves, the way the glove waved, and is gone downstream before you can decide what to say.\n\nThaarlbriindt watches the empty table for a long time. Then he steps aside from the gate.\n\n⚙ GM: Chuckle Creek's Loyalty −1 (Pearl feels it). No receipt.",
      [ch("Go to the gate.", "binah_lamp")], { sceneId: DEEP }),
    beat("binah_carried", "Carried", "You take the three things back aboard. They are heavier than they look and they stay that way: nobody aboard sleeps well for a while, and nobody says why. Winnie watches you load them with an expression you'll think about later. \"Well,\" she says. \"Somebody has to.\" Thaarlbriindt steps aside from the gate.\n\n⚙ GM: each Steward takes 1 Stress.",
      [ch("Go to the gate.", "binah_lamp")], { sceneId: DEEP }),
    beat("binah_drowned", "Drowned", "The dam goes. The reservoir goes with it, out over the valley in a brown roar, and everything on Winnie's table — sorted, unsorted, the ledger, the pew — is buried under a yard of mud before the water has finished leaving. Winnie is gone. So is the lamp, if there was one; there is nothing here now but silt and a gate with nothing behind it.\n\nThaarlbriindt is still facing it. He does not turn around.\n\n⚙ GM: the Binah spark stays dark. The river refills the reservoir by next month; the sluice is there to try again.",
      [ch("Surface.", "", "", { worldEffects: { depthExposure: { outside: false }, dive: { surface: true } } })], { repeatable: true, sceneId: DEEP, worldEffects: { hexDarkness: { delta: 1, hexName: HEX } } }),
    beat("binah_lamp", "The Lamp at the Sluice", "Behind the gate, where the river finally stops being a river, there is a lamp in a niche of drowned stone, and it lights as you reach it: not bright, but steady, the colour of the inside of an eyelid. Binah. Understanding — the kind that holds a shape so other things can stand on it. Thaarlbriindt settles back to face the gate, and for the first time it looks less like a guard post than a chair.",
      [ch("Surface.", "", "", { worldEffects: { depthExposure: { outside: false }, dive: { surface: true } } })],
      { role: "closer", sceneId: DEEP, worldEffects: { hexSpark: [{ action: "integrate", hexName: HEX }], factionEffects: [fe({ opDeltas: { faith: 15, culture: 15 } })], questEffects: [{ action: "complete", questId: QREG, state: "completed", text: "The Bitter Sea: Binah lit at Odaroloc Depths." }] } })
  ];
  const QUEST = { name: "The Bitter Sea", act: 3, keystone: false, hex: HEX, registryId: QREG, chapters: {}, evergreen: true };
  const SCRIPT = { giver: "the river, which is delivering", description: "Below Chuckle Creek the three grief towns' losses come to rest in a drowned reservoir, and someone down there is sorting them.",
    steps: [
      { id: "river", label: "The River Takes It Down", line: "Ride down to Odaroloc Depths, below Chuckle Creek.", beats: ["binah_river_card", "binah_surface"], milestone: true, logged: "Three things from the grief towns floated past, all going to Odaroloc Depths.", done: { mark: "binah_surface" } },
      { id: "dive", label: "The Bitter Sea", line: "Take a submersible down to the reservoir floor.", beats: ["binah_reef", "binah_deep"], logged: "You took a sub down into the drowned valley and found Winnie's Echo sorting at a sluice gate.", done: { mark: "binah_deep" } },
      { id: "sluice", label: "Winnie's Table", line: "Go out to Winnie at the sluice and say what each town lost.", beats: ["binah_sluice", "binah_obj_tape", "binah_obj_glove", "binah_obj_clapper", "binah_named_tape", "binah_named_glove", "binah_named_clapper", "binah_obj_sinks", "binah_understood", "binah_released", "binah_carried", "binah_drowned"], logged: "You went out of the hull to Winnie's table.", done: { anyOf: ["binah_understood", "binah_released", "binah_carried"] } },
      { id: "lamp", label: "The Lamp", line: "Go through the gate.", beats: ["binah_lamp"], milestone: true, logged: "Binah is lit at Odaroloc Depths.", done: { mark: "binah_lamp" } }
    ] };
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
    const report = [], conflicts = []; let changes = 0;
    for (const nb of BEATS) { if (beats.some(b => b && b.id === nb.id)) { report.push(`· ok ${nb.id}`); continue; } beats.push(nb); changes++; report.push(`✚ ${nb.id}: ${nb.label}`); }
    return { changes, report, conflicts };
  }
  return { apply, QUEST, SCRIPT, Q, QREG, HEX, BEATS };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = BINAH_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw)); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = BINAH_PATCH.apply(camp); let extra = 0;
  // the hex arrival
  const hex = game.scenes.contents.flatMap(s => [...s.drawings]).find(d => d.flags?.["bbttcc-territory"]?.name === BINAH_PATCH.HEX);
  if (!hex) conflicts.push(`${BINAH_PATCH.HEX} hex not found`);
  else { camp.hexOverrides = camp.hexOverrides || {}; const ov = camp.hexOverrides[hex.uuid] = camp.hexOverrides[hex.uuid] || {}; const l = Array.isArray(ov.onEnterBeatIds) ? ov.onEnterBeatIds : []; if (!l.includes("binah_surface")) { ov.onEnterBeatIds = [...l, "binah_surface"]; extra++; report.push(`✚ ${BINAH_PATCH.HEX}: arrival → binah_surface`); } }
  const st = api.story.data.get(cid); const needQuest = !st?.quests?.[BINAH_PATCH.Q]; if (needQuest) { extra++; report.push(`✚ story data: quest + script "${BINAH_PATCH.QUEST.name}"`); }
  const qRaw = game.settings.get(NS, "quests"); const qWasStr = typeof qRaw === "string"; const QR = JSON.parse(qWasStr ? qRaw : JSON.stringify(qRaw || {}));
  const needReg = !QR[BINAH_PATCH.QREG]; if (needReg) { extra++; report.push(`✚ registry: ${BINAH_PATCH.QREG}`); }
  const total = changes + extra;
  console.log(`[binah bitter sea 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${total} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__binah = { dry: DRY_RUN, changes: total, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${total} change(s); see console.`);
  if (!total) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-binah-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (changes || hex) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (needQuest) await api.story.data.saveQuest(cid, BINAH_PATCH.Q, { quest: BINAH_PATCH.QUEST, script: BINAH_PATCH.SCRIPT });
  if (needReg) { const now = Date.now(); QR[BINAH_PATCH.QREG] = { id: BINAH_PATCH.QREG, v: 1, name: BINAH_PATCH.QUEST.name, description: `<p>${BINAH_PATCH.SCRIPT.description}</p>`, tags: [], createdTs: now, updatedTs: now, status: "active", giver: BINAH_PATCH.SCRIPT.giver, nextLine: BINAH_PATCH.SCRIPT.steps[0].line }; await game.settings.set(NS, "quests", qWasStr ? JSON.stringify(QR) : QR); }
  ui.notifications.info(`Applied ${total} change(s) — the Bitter Sea is waiting.`);
})();
