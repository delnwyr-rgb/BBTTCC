/* seed-lyrenn-blast-treatment.macro.js — Lyrenn Act 2 feeds the spine (owner rulings 2026-09-13)
 *
 * "That One Night Where Everyone Felt Kinda Weird." It happens ON the Turn Advance (turn 1 → 2);
 * nobody knows it came from the Mountain — only the Seal chain (vs_* / khezek_tor_*seal*) may name
 * it. Every Lyrenn thread becomes a symptom of the night; the players can walk the towns in any
 * order because the flag is set by the Advance itself. Spec: ~/LYRENN_ACT2_REFRAME_2026_09_13.md.
 *
 * What this seeds (idempotent, DRY_RUN default, backs up `campaigns` before writing):
 *   1. `a2_that_one_night` — the door beat (campaign PHASE_DOOR_BEATS[2]): accepts THE VALHAULAN
 *      SPINE quest (= the blast flag), darkness +1 on the coalition, Fallout Bloom → Lyrenn,
 *      Damaged Infrastructure → Allesh-Gilliam.
 *   2. `{ questBucket: <spine>, is:"active" }` on the six Act 2 hubs.
 *   3. Prose per the spec §2 (Elsin / Pest / Forest / Rowan / Field / Choir / Vault / Words); AG's
 *      East Wall intro reworded off "the Mountain"; a report of any other beat that names it.
 *   4. `lyrenn_water_choir_reading` (worldEffects.hexReading) reachable from every successful
 *      Choir inspect; Seed Vault gated on the Gentle Pest completed (R7).
 *   5. Red Thread planting: +Red Thread Field, −Fallout Bloom; Hex Aligns: −Fallout Bloom (safety);
 *      East Wall Success: −Damaged Infrastructure.
 * Needs the engine of the same day: World Modifier rows with op/modifiers/hexName (editor-visible),
 * worldEffects.hexReading, MOD_RESOURCE, LANE_HEX_BONUS.byModifier, PHASE_DOOR_BEATS.
 */
(async () => {
  const DRY_RUN = true;                  // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  const cid = api?.getActiveCampaignId?.();
  const rawC = game.settings.get(NS, "campaigns"); const cStr = typeof rawC === "string";
  const camps = cStr ? JSON.parse(rawC) : foundry.utils.deepClone(rawC);
  const camp = camps?.[cid];
  if (!camp) return ui.notifications.error("No active campaign.");
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [String(b?.id), b]));
  const report = []; let changes = 0;

  // ── ids ──
  const SPINE = String(byId.get("vs_overture")?.questId || "").trim();
  if (!SPINE) return ui.notifications.error("vs_overture has no questId — cannot find The Valhaulan Spine quest.");
  const Q = { lyrenn: "quest_JqCdOo0l6X8K2EcE", pest: "quest_uMKbX648SllKTpEH", forest: "quest_feX6WHsBXuVbtjMM", field: "quest_0HBaQXGlhFvNke2B" };
  const factionIds = [...new Set([].concat(camp.factionIds || [], camp.factionId ? [camp.factionId] : []).map(x => String(x || "").replace(/^Actor\./, "")).filter(Boolean))];
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => { const want = cands.map(norm); return game.actors.find(a => want.includes(norm(a.name))) || null; };
  const elsin = findActor(["Elsin Quade"]), rowan = findActor(["Rowan of the Loam", "Rowan-of-the-Loam"]);

  // ── helpers ──
  const P = (t) => `<p>${t}</p>`;
  const stripTags = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const setDesc = (id, html, why) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } if (String(b.description || "") === html) { report.push(`· ok ${id}`); return; } b.description = html; changes++; report.push(`✎ ${id}: ${why || "description replaced"}`); };
  const appendDesc = (id, html) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } if (String(b.description || "").includes(stripTags(html).slice(0, 40))) { report.push(`· ok ${id} (appended already)`); return; } b.description = String(b.description || "") + html; changes++; report.push(`✎+ ${id}: paragraph appended`); };
  const replaceIn = (id, re, text) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } const cur = String(b.description || ""); if (!re.test(cur)) { report.push(`· ok ${id} (phrase not present)`); return; } b.description = cur.replace(re, text); changes++; report.push(`✎~ ${id}: phrase reworded`); };
  const setInvite = (id, text) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } if (b.inviteText === text) { report.push(`· ok ${id} (invite)`); return; } b.inviteText = text; changes++; report.push(`✉ ${id}: invite line`); };
  const addGate = (id, cond) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } b.inject = (b.inject && typeof b.inject === "object") ? b.inject : {}; const reqs = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []); if (reqs.some(c => c && JSON.stringify(c) === JSON.stringify(cond))) { report.push(`· ok ${id} (gate)`); return; } reqs.push(cond); b.inject.requires = reqs; changes++; report.push(`🔒 ${id}: + ${JSON.stringify(cond)}`); };
  const setFx = (id, key, value) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {}; if (JSON.stringify(b.worldEffects[key]) === JSON.stringify(value)) { report.push(`· ok ${id} (${key})`); return; } b.worldEffects[key] = value; changes++; report.push(`⚙ ${id}: worldEffects.${key} = ${JSON.stringify(value)}`); };
  const addChoice = (id, choice) => { const b = byId.get(id); if (!b) { report.push(`✗ MISSING ${id}`); return; } b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(c => c && String(c.next) === String(choice.next))) { report.push(`· ok ${id} (choice → ${choice.next})`); return; } b.choices.push(Object.assign({ description: "", checkStat: "", checkDC: 0, failNext: "" }, choice)); changes++; report.push(`↳ ${id}: + choice "${choice.label}" → ${choice.next}`); };
  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: o.type || "dialog", timeScale: "scene", tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: !!o.repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: o.requires || [] },
    actors: [], choices: o.choices || [],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: Object.assign({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] }, o.worldEffects || {}),
    description: o.description, questId: o.questId || Q.lyrenn, questStep: o.questStep ?? null, questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    playerFacing: o.playerFacing !== false, playerFacingDialog: o.playerFacing !== false,
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });
  const addBeat = (nb) => { if (byId.has(nb.id)) { report.push(`· ok (exists) beat ${nb.id}`); return byId.get(nb.id); } camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id} — ${nb.label}`); return nb; };

  // ── 1) the door beat ──
  addBeat(mkBeat({
    id: "a2_that_one_night", label: "That One Night Where Everyone Felt Kinda Weird", type: "dialog", tags: "act2 opener night",
    questId: SPINE, dialogueOffer: false, choices: [{ label: "Noted.", next: "", description: "" }],
    description: P("Nobody agrees on the hour, only that it was the same hour for everyone. You woke — every steward, every hand in every rig, every dog in Bad Eden — with the feeling of having been <i>looked at</i>, and then it passed, and then it didn't. Animals were wrong all the next day. The irrigation at Lyrenn played one note flat. The wall crews at Allesh-Gilliam swear the East Wall's lean grew overnight, and the overseers at Khezek-Tor will not say what the ore tallies did.")
      + P("Something bad has happened somewhere. It is showing up everywhere. Nobody can point at a direction. By morning the words start arriving."),
    worldEffects: {
      questEffects: [{ action: "accept", questId: SPINE, beatId: "a2_that_one_night", state: "active", text: "That one night. Everyone felt it; nobody can name it." }],
      factionEffects: factionIds.map(fid => ({ factionId: fid, moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 1, opDeltas: {} })),
      worldModifiers: [   // editor-visible rows (Beat Editor → World Effects → Hex states); hexName targets a town the GM is nowhere near
        { key: "fallout_bloom", label: "Fallout Bloom", op: "add", enabled: true, durationTurns: 0, hexName: "Lyrenn", modifiers: ["Fallout Bloom"] },                          // the rows went wild (R2)
        { key: "state_damaged_infrastructure", label: "Damaged Infrastructure", op: "add", enabled: true, durationTurns: 0, hexName: "Allesh-Gilliam", modifiers: ["Damaged Infrastructure"] }   // the East Wall's lean (R4)
      ]
    }
  }));

  // ── 2) the gate everywhere ──
  const GATE = { questBucket: SPINE, is: "active" };
  for (const id of ["lyrenn_quest_acceptance", "lyrenn_word_channels", "lyrenn_word_treeline", "allesh_gilliam_the_east_wall_intro", "khezek_tor_valhaulan_seal_quest_acceptance", "vs_overture"]) addGate(id, GATE);

  // ── 3) prose ──
  setInvite("lyrenn_elsin_quade_convo", "Elsin Quade is wiping her hands on her apron by the Green Ring. The rows came up wrong the morning after that one night, and she'd like to say so once.");
  setDesc("lyrenn_elsin_quade_convo", P("Elsin Quade took your measure over one firm handshake and zero wasted words. Her position, delivered like a soil report: the land was hurt that one night — the one everyone felt and nobody can name — and it is reading you now. You can force food out of hurt ground, or you can listen and be fed longer — and she is watching, professionally, to see if you caught the difference. She'll answer what you ask. She'd rather answer it once."), "Elsin — hurt land, aimed lesson");
  setDesc("lyrenn_elsin_quade_convo_1", P("She gestures at the rows — stalks head-high in a month, half of it seed and chaff. [annoyed] “Wild growth isn't yield. Push three harvests out of this now and you lose thirty later.” [exhales sharply] “If you need short-term yields — then say that plainly. I respect honesty over idealism.”"), "Elsin 1 — wild growth, doctrine kept");
  setDesc("lyrenn_elsin_quade_convo_2", P("She doesn't answer immediately. “Look at the channels — something's in them. Then look at the vault with me.” A beat. “Fewer sudden mandates.” She will clearly not say “help” twice."), "Elsin 2 — the ask");
  replaceIn("lyrenn_word_channels", /something has been tearing up the east irrigation channels\./i, "something has been tearing up the east irrigation channels since that one night.");
  setDesc("lyrenn_the_gentle_pest_acceptance", P("You agreed to look into whatever has been tearing up the east irrigation channels. Elsin thinks it came in from the scrub that one night. Her one condition: patience first, shovel later. Ideally never the shovel."), "Pest acceptance — since that night");
  appendDesc("lyrenn_the_gentle_pest", P("They are not digging in. They are digging <i>through</i> — every channel points the same way: toward the Green Ring, toward the town, toward the fence with your banner on it."));
  setDesc("lyrenn_forest_will_not_be_fought_quest_acceptance", P("You agreed to deal with the treeline that rearranges paths overnight and has started editing the fence line — since that one night, and always toward Lyrenn. Local doctrine is in the name: the forest will not be fought."), "Forest acceptance — toward Lyrenn");
  appendDesc("lyrenn_forest_will_not_be_fought", P("It is not correcting you. It is correcting for something behind it."));
  replaceIn("lyrenn_word_treeline", /'Trees\. Moving\. Come\.'/, "'Trees. Moving. Come.' — and, pressed smaller underneath: 'Toward you.'");
  setDesc("lyrenn_rowan_of_the_loam_convo", P("Rowan of the Loam studied you like a half-remembered dream and then went back to listening to the ground. The crops already know you, they said — which was new. The soil has been loud since that one night — a wrong note under everything, like a bell struck and left ringing. But where you walk it goes quiet. Rowan noticed that before you did. Rowan doesn't rush it. Rowan doesn't rush anything."), "Rowan — wrongness, and hope");
  setDesc("lyrenn_rowan_of_the_loam_convo_1", P("Rowan winces. “You are.” They press soil. “You're… organizing the roots.” A small breath. “And the roots are grateful to have somewhere to go.”"), "Rowan 1");
  appendDesc("lyrenn_the_field_that_remembers_you_intro", P("Ask Rowan when the field first knelt and you get the same answer everyone gives: that one night."));
  appendDesc("lyrenn_water_choir", P("Since that night it has been playing one basin flat, on purpose, like a held finger on a string. When you step close it stops — relieved, or worried, or both."));
  appendDesc("lyrenn_seed_vault", P("“It's never been opened. Not by my mother, not by hers.” She does not look at you. “The rows have gone wild since that one night, and wild isn't yield. I need something that grows true in hurt ground — and I need someone standing next to me when I find out what's down there.” She has clearly rehearsed not saying please. The red-thread section hums before you reach it."));
  appendDesc("lyrenn_hex_settles", P("The wrong note under the ground is still there. It's just not under Lyrenn any more."));
  // AG: off the Mountain
  replaceIn("allesh_gilliam_the_east_wall_intro", /the Night the Mountain Coughed\.\s*Nobody's found daylight between the two\./i, "that one night. The one everyone felt and nobody can name. Nobody's found daylight between the two.");
  replaceIn("allesh_gilliam_the_east_wall_intro", /the Night the Mountain Coughed/gi, "that one night");
  // Two more pre-reveal mentions (dry run 2026-09-13). The Plumb Office is ACT 1 content (storyPhase ≥ 1) —
  // it must not reference a night that hasn't happened yet, so the joke stands on its own; the leygate
  // delivery can land before Khezek-Tor, so it says "that one night". "The Wall Stands Straight" is gated on
  // the Seal quest COMPLETED — by then the Mountain is known, and it keeps its line.
  replaceIn("allesh_gilliam_plumb_office_intro", /three days before the Night the Mountain Coughed, and he will not re-survey it/i, "once, and he will not re-survey it");
  replaceIn("ag_leygate_delivery", /since the Night the Mountain Coughed/i, "since that one night");
  // sweep: who else names the Mountain outside the Seal chain? (post-reveal beats are allowed to)
  const MAY_NAME_IT = new Set(["allesh_gilliam_wall_stands_straight"]);
  for (const b of camp.beats) { if (/^vs_|^khezek_tor_.*seal/.test(String(b.id)) || MAY_NAME_IT.has(String(b.id))) continue; if (/mountain coughed/i.test(stripTags(b.description) + " " + String(b.label || "") + " " + String(b.inviteText || ""))) report.push(`⚠ names the Mountain: ${b.id} — ${b.label}`); }

  // ── 4) the Choir reads; the Vault waits ──
  addBeat(mkBeat({
    id: "lyrenn_water_choir_reading", label: "Lyrenn - Water Choir - What It's Saying", type: "outcome_trigger", repeatable: true, dialogueOffer: false,
    questId: Q.lyrenn, questStep: 95,
    description: P("You stop trying to understand it and let it tune to you. It takes a while. Then, in the only language it has — pitch, patience, and which basin goes quiet when — the Choir tells you three things."),
    worldEffects: { hexReading: { hexName: "Lyrenn", voice: "The Water Choir" } },
    choices: [{ label: "Listen again", next: "lyrenn_water_choir_reading" }, { label: "Leave", next: "lyrenn_quest_scene" }]
  }));
  for (const id of ["lyrenn_water_choir_inspect_perception", "lyrenn_water_choir_inspect_insight", "lyrenn_water_choir_inspect_arcana"]) addChoice(id, { label: "Listen to what it's saying", next: "lyrenn_water_choir_reading", description: "Stop inspecting. Let it tune." });
  addGate("lyrenn_seed_vault", { questBucket: Q.pest, is: "completed" });

  // ── 5) modifiers land and lift ──
  const WM = (key, label, op, hexName, modifiers) => ({ key, label, op, enabled: true, durationTurns: 0, hexName, modifiers });
  setFx("lyrenn_red_thread_planting", "worldModifiers", [WM("red_thread_field", "Red Thread Field", "add", "Lyrenn", ["Red Thread Field"]), WM("fallout_bloom", "Fallout Bloom", "remove", "Lyrenn", ["Fallout Bloom"])]);
  setFx("lyrenn_hex_settles", "worldModifiers", [WM("fallout_bloom", "Fallout Bloom", "remove", "Lyrenn", ["Fallout Bloom"])]);
  setFx("allesh_gilliam_east_wall_success", "worldModifiers", [WM("state_damaged_infrastructure", "Damaged Infrastructure", "remove", "Allesh-Gilliam", ["Damaged Infrastructure"])]);

  console.group(`[seed-lyrenn-blast] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s) · spine quest ${SPINE} · coalition ${factionIds.length}`); report.forEach(r => console.log(" ", r)); console.groupEnd();
  if (!elsin || !rowan) report.push("⚠ Elsin/Rowan actor not found by name — invites still patched by beat id.");
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged; see console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try { const stamp = new Date().toISOString().replace(/[:.]/g, "-"); (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(cStr ? JSON.parse(rawC) : rawC), "application/json", `backup-campaigns-before-lyrenn-blast-${stamp}.json`); }
  catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "campaigns", cStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Lyrenn blast treatment applied (${changes} change(s)). Backup downloaded.`);
})();
