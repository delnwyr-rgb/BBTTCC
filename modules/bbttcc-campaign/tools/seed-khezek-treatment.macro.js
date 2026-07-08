/* seed-khezek-treatment.macro.js — Khezek Tor gets the treatment (2026-07-07)
 *
 * Owner-locked design: BRENNIG TAMSIN quartermasters the Lift Hall — Father
 * Tamsin's brother, the patient Greeley stitched in the dark the Night the
 * Mountain Coughed; visiting him is the Confessor's innocent cover story.
 * ALL THREE consequence guns wired (Soil-Keeps-Books pattern): The Sink Widens
 * (open), The Compound Cough (exploit → the sick go to Greeley), The Brace
 * Groans (exploit). THE PILGRIM gets a name — Pilgrim Wick, the cult courier
 * from Verna's ledger, placed at the Vacancy until the Confessor's Debt
 * resolves (then the channel burns and Wick stops coming). Sable Nine's six
 * fixed points = the Lost-Statues map (dossier side).
 *
 * ALSO: Drax/Sable/Brennig speaker wiring + invites; mine + shipment decision
 * beats become conversations; 6 outcome memoryTexts; gates (sub-quests need
 * the hex active, scenes need their quest active); dialogueOffer:false on
 * routing beats + Q&A leaves; quest_scene returning-voice rewrite (was a
 * word-for-word dup of main_scene); hub staging rewrites; outcome prose
 * cleanup; typo fixes; statue hooks; acceptance one-liners; placements.
 *
 * DRY_RUN default true; idempotent; backup before write. Actors resolve
 * punctuation-proof; re-run after minting Brennig / Pilgrim Wick.
 * Companion: bbttcc-mal-voice/tools/seed-khezek-dossier.macro.js
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = {
    kt: "quest_LJAmlim7oUtlMPiC", mine: "quest_A050y4VtoZFzOfGz", shipment: "quest_2Gs2dsKhv7G1OYBl",
    confessor: "quest_ag_confessors_debt",
    sink: "quest_kt_sink_watch", cough: "quest_kt_compound_cough", brace: "quest_kt_brace_strain"
  };
  const SCENES = {
    maw: "AnP4O2Bqb07BKMWB", brace: "vw3RLRww4wZhjuGh", liftHall: "q6ORNXShsP2gUIs1",
    vacancy: "5hxWnWm1sawwC3Ch"
  };

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const drax = findActor(["Drax Calder", "Drax Caulder", "Foreman Calder", "Foreman Drax Calder"]);
  const sable = findActor(["Sable Nine", "Sable 9"]);
  const brennig = findActor(["Brennig Tamsin", "Brennig", "Quartermaster Brennig"]);
  const wick = findActor(["Pilgrim Wick", "Wick", "The Pilgrim"]);

  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: "skill_scene", timeScale: "scene",
    tags: o.tags || "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit",
      fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: o.requires || [] },
    actors: [], choices: o.choices || [],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null,
      turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [],
      questEffects: o.questEffects || [] },
    description: o.description, questId: o.questId || Q.kt, questStep: null,
    questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    ...(o.sceneId ? { sceneId: o.sceneId } : {}),
    ...(o.storyChain ? { storyChain: o.storyChain } : {}),
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });
  const req = (questBucket, is) => ({ questBucket, is });
  const reqNot = (questBucket, isNot) => ({ questBucket, isNot });

  // ── speaker / invite / memory wiring (fill-if-empty) ───────────────────────
  const WIRE = [
    { id: "khezek_tor_drax_calder_convo", speaker: drax,
      inviteText: "Foreman Calder is at the Brace. He says don't pretend it's clean work — but come anyway." },
    { id: "khezek_tor_sable_nine_convo", speaker: sable,
      inviteText: "Sable Nine has a point on the map that won't hold still. They'd rather show you than say it." },
    { id: "khezek_tor_mine_that_answered_back", speaker: drax,
      inviteText: "Calder wants you below. The new shaft broke into something, and he won't call it a cavern." },
    { id: "khezek_tor_darkness_shipment", speaker: brennig,
      inviteText: "Quartermaster Brennig has a crate on the bench that won't stop humming, and a manifest that won't stop lying about it." },
    { id: "khezek_tor_mine_that_answered_back_seal", speaker: drax,
      memoryText: "They paid out of their own banks to seal the breach. Output dipped; nobody died. First clean work I've seen on this mountain." },
    { id: "khezek_tor_mine_that_answered_back_exploit", speaker: drax,
      memoryText: "They doubled output and let the mountain pay for it. Sickness in the compound, the Brace one bad day closer. I'm keeping a list of names." },
    { id: "khezek_tor_mine_that_answered_back_open", speaker: sable,
      memoryText: "They dynamited the deep silence open. The map has a new center now, and it is very patient. I chart the edges of it nightly." },
    { id: "khezek_tor_darkness_shipment_standardize", speaker: brennig,
      memoryText: "Sacred handling protocols on every crate now. Slower, calmer; no more soured dreams riding out with the ore. My manifest finally tells the truth." },
    { id: "khezek_tor_darkness_shipment_rite", speaker: brennig,
      memoryText: "Puppets, of all things — but the stone got the vibe. Word went round the galleries: these ones actually get mines." },
    { id: "khezek_tor_darkness_shipment_ignore", speaker: brennig,
      memoryText: "The humming crates keep rolling. Some folks got sick. The ledgers have never looked better, and I have never liked them less." }
  ];

  // ── gates ────────────────────────────────────────────────────────────────────
  const GATES = [
    { beatId: "khezek_tor_mine_that_answered_back_quest_acceptance", add: [req(Q.kt, "active"), reqNot(Q.mine, "active"), reqNot(Q.mine, "completed")] },
    { beatId: "khezek_tor_darkness_shipment_quest_acceptance", add: [req(Q.kt, "active"), reqNot(Q.shipment, "active"), reqNot(Q.shipment, "completed")] },
    { beatId: "khezek_tor_mine_that_answered_back", add: [req(Q.mine, "active")] },
    { beatId: "khezek_tor_darkness_shipment", add: [req(Q.shipment, "active")] }
  ];

  // ── dialogueOffer:false ──────────────────────────────────────────────────────
  const NO_OFFER = [
    "khezek_tor_quest_acceptance", "khezek_tor_main_scene", "khezek_tor_quest_scene",
    "khezek_tor_the_maw", "khezek_tor_the_lift_hall", "khezek_tor_the_brace",
    "khezek_tor_mine_that_answered_back_quest_acceptance", "khezek_tor_darkness_shipment_quest_acceptance",
    "khezek_tor_drax_calder_convo_1", "khezek_tor_drax_calder_convo_2",
    "khezek_tor_drax_calder_convo_3", "khezek_tor_drax_calder_convo_echo",
    "khezek_tor_sable_nine_convo_1", "khezek_tor_sable_nine_convo_2",
    "khezek_tor_sable_nine_convo_3", "khezek_tor_sable_nine_convo_echo"
  ];

  // ── consequence marks: outcomes open the marker quests ──────────────────────
  const MARKS = [
    { beatId: "khezek_tor_mine_that_answered_back_open", questId: Q.sink, text: "The deep silence is open, and it is very patient." },
    { beatId: "khezek_tor_mine_that_answered_back_exploit", questId: Q.cough, text: "The compound started coughing the week output doubled." },
    { beatId: "khezek_tor_mine_that_answered_back_exploit", questId: Q.brace, text: "The Brace took the extra load without a word. That's not the same as taking it well." }
  ];

  // ── text: rewrites (marker-guarded REPLACE) ─────────────────────────────────
  const REWRITES = [
    { beatId: "khezek_tor_quest_scene", marker: "meets you at the switchback", text:
      "The grind of Khezek-Tor meets you at the switchback — floodlights burning their permanent warning, ore carts in procession, the mountain's patience audible underneath all of it. The Maw, the Lift Hall, and the Brace all keep their own kind of watch, and all three know your face by now." },
    { beatId: "khezek_tor_drax_calder_convo", marker: "measuring you against the chalk marks", text:
      "Calder doesn't shake hands; he's already measuring you against the chalk marks on the Brace. The ledger behind him is rock, chalk, and arithmetic older than the coalition, and every line on it is somebody's shift, somebody's tonnage, or somebody's name. He'll talk while he works. He never stops working." },
    { beatId: "khezek_tor_sable_nine_convo", marker: "folded like secrets", text:
      "Sable Nine's maps stay folded like secrets until they decide you should see one move. The charting table is bolted down — the charts aren't, because Sable re-pins them every morning to wherever the mine has moved things overnight. They look at you the way they look at anomalies: with professional delight and a sharpened pencil." },
    { beatId: "khezek_tor_mine_that_answered_back_seal", marker: "everyone underground knows who paid", text:
      "The seal holds. The rumble is gone; the mountain sits easier, and everyone underground knows who paid for that — the Stewards, out of their own banks, with output down and not one name added to any list. Calder chalked the shift on the Brace ledger himself and underlined nothing, which from Calder is a medal." },
    { beatId: "khezek_tor_mine_that_answered_back_exploit", marker: "went two places", text:
      "The surplus went two places: the ledgers, and the Allesh-Gilliam Leygate's footings — Khezek ore is shoring up the coalition's front door, and the numbers are genuinely beautiful. The compound's cough went a third place, quieter, bed to bed. Calder keeps the tonnage on one side of his chalk ledger and a list of names on the other, and he has stopped explaining what the second column is for." }
  ];
  const TYPO_FIXES = [
    { beatId: "khezek_tor_sable_nine_convo_1", from: "cklear", to: "clear" },
    { beatId: "khezek_tor_sable_nine_convo_1", from: "relax him", to: "relax them" }
  ];
  // as-designed introductions + statue hooks (APPEND, marker-guarded)
  const APPENDS = [
    { beatId: "khezek_tor_the_lift_hall", marker: "Brennig", text:
      "\n\nThe Lift Hall has a quartermaster now, or rather it always did and the paperwork finally admits it: Brennig Tamsin — yes, THAT Tamsin's brother, the one who lived — runs the crates, the counts, and the cage schedule from a desk built out of two pallets and a door. There's a scar along his jaw he calls the mountain's receipt. His brother the Father visits more than any parish requires, which Brennig puts down to guilt and love, in whichever order. He is wrong about the order, and about a third thing he doesn't know to count." },
    { beatId: "khezek_tor_the_maw", marker: "no pick ever carved", text:
      "\n\nThe whispers get one detail consistent: miners who've been below Level Four swear the shaft walls hold outlines of standing figures no pick ever carved. Management calls it mineral banding. The miners call it company." },
    { beatId: "khezek_tor_mine_that_answered_back", marker: "pillar collapse", text:
      "\n\nA survey photo pinned in the Maw shows the new shaft's mouth flanked by two upright shapes the caption calls \"pillar collapse.\" Nobody who has seen the photo believes the caption. Nobody has taken the photo down either." }
  ];
  const FILL_DESCRIPTIONS = [
    { beatId: "khezek_tor_quest_acceptance", text: "You agreed to take Khezek Tor's measure — the mine hex, the coalition's Yesodium source, the mountain that feeds everyone and asks for more than it admits. If Lyrenn teaches patience, Khezek Tor teaches limits." },
    { beatId: "khezek_tor_mine_that_answered_back_quest_acceptance", text: "You agreed to go below. The new shaft broke into something on Level Four, and Foreman Calder — a man not given to poetry — refuses to call it a cavern. The mine answered back. Someone has to decide what Khezek Tor says next." },
    { beatId: "khezek_tor_darkness_shipment_quest_acceptance", text: "You agreed to look at the shipment problem: Yesodium crates that hum, sometimes, and sour the dreams of whoever hauls them. Quartermaster Brennig's manifest says everything is fine. Quartermaster Brennig's face says the manifest is lying." }
  ];

  // ── new beats: the three consequence chains ─────────────────────────────────
  const NEW_BEATS = [
    mkBeat({
      id: "khezek_sink_widens", label: "Khezek Tor — The Sink Widens",
      storyChain: "sink_watch", questRole: "resolution", tags: "foreshadow.lost_statues",
      sceneId: SCENES.maw,
      requires: [req(Q.sink, "active")],
      questEffects: [{ action: "complete", questId: Q.sink, beatId: "", state: "completed", text: "The sink is becoming a doorway, patiently. The first thing visible through it: a garden of stone figures, facing away." }],
      description: "Sable Nine's nightly charts have been saying it for weeks and now anyone can see it: the opened sink below Level Four is wider, rounder, more DELIBERATE — less a wound in the rock and more a doorway taking its time. The Darkness reading ticks up again; 'and maybe rising' has quietly become 'rising.' And on the clearest watch of the month, lamps out, Sable got the first true look through it and wrote one line in the log with a steady hand: a garden of stone figures, facing away. They have not turned around. Sable checks every night whether that's still true." }),
    mkBeat({
      id: "khezek_compound_cough", label: "Khezek Tor — The Compound Cough",
      storyChain: "compound_cough", questRole: "resolution",
      sceneId: SCENES.liftHall,
      requires: [req(Q.cough, "active")],
      questEffects: [{ action: "complete", questId: Q.cough, beatId: "", state: "completed", text: "The illness has a name now — the Compound Cough — and a road: over the ridge, to the Waiting Room." }],
      description: "It started as a rasp in the bunkhouses the week output doubled, and now it has a name — the Compound Cough — a bed count, and a road. The worst cases go over the ridge to Allesh-Gilliam, to the clinic-turned-bar with the good light, where Doc Greeley stitches, listens, and adds each chart to a growing folder she has labeled, in her tidy prescription hand, OWED. Calder's chalk ledger has the same names in the same order. Neither of them planned that. Both of them noticed. The cough is not getting better on its own — and everyone underground knows exactly which decision it is the receipt for." }),
    mkBeat({
      id: "khezek_upper_galleries", label: "Khezek Tor — The Upper Galleries",
      questId: Q.confessor, dialogueOffer: false,
      requires: [req(Q.confessor, "active")],
      choices: [{ label: "Withdraw quietly", next: "khezek_tor_quest_scene", description: "You have seen enough, and more importantly, nothing has seen you. Keep it that way.", checkStat: "", checkDC: 0, failNext: "" }],
      description: "You followed the courier's route up past the numbered levels, past the toll post where the coin changes hands and no questions do, and there it is — the cult's forward camp, seen from a ridge at a respectful distance. It is nothing like a raider camp. Shielded plating mounted in neat courses along the old access shaft. Tools racked. Wards glowing the same directional glow as the sigil Etta pressed into your hands. Figures moving with the unhurried precision of people doing TECHNICAL WORSHIP — maintenance as liturgy, liturgy as maintenance, no visible difference and clearly no intended one. They sing at the wrong hours, quietly, in a working rhythm. Packs go up the mountain full and come down empty; whatever is being built up here is being built to STAY. And past the camp, where the shaft bends coastward, the route continues — down the same heading the survey stations shake about, toward the stretch of nothing that gets visited far too regularly to be nothing. The whisper has a destination. You are looking at the first waypoint, and the road does not end here." }),
    mkBeat({
      id: "khezek_brace_groans", label: "Khezek Tor — The Brace Groans",
      storyChain: "brace_strain", questRole: "resolution",
      sceneId: SCENES.brace,
      requires: [req(Q.brace, "active")],
      questEffects: [{ action: "complete", questId: Q.brace, beatId: "", state: "completed", text: "The whole gallery heard it. Not failure — a warning shot. The mountain clearing its throat." }],
      description: "Third shift heard it first: a sound out of the Brace like a ship's hull remembering the sea — long, low, and structural. Every pick in the gallery stopped mid-swing. It held. It holds. But Calder walked the whole span with a lamp and a lump of chalk, and the marks he made are closer together than they have ever been, and when someone asked him what the sound was he said 'the mountain clearing its throat' in the voice of a man who knows exactly what gets cleared out of throats. The extra load is being carried. Nothing about that sentence says 'gladly,' and nothing about it says 'forever.'" })
  ];

  // ── load + apply ─────────────────────────────────────────────────────────────
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  report.push(drax ? `👤 Drax → "${drax.name}"` : `⚠ Drax NOT FOUND`);
  report.push(sable ? `👤 Sable → "${sable.name}"` : `⚠ Sable NOT FOUND`);
  report.push(brennig ? `👤 Brennig → "${brennig.name}"` : `⚠ Brennig NOT FOUND (mint + re-run to wire the Lift Hall)`);
  report.push(wick ? `👤 Wick → "${wick.name}"` : `⚠ Pilgrim Wick NOT FOUND (mint + re-run for placement)`);

  for (const [qid, name, desc] of [
    [Q.sink, "Khezek Tor — The Sink Watch", "The opened deep is becoming a doorway, patiently. Sable charts its edges nightly and has started noting which direction the stone figures face."],
    [Q.cough, "Khezek Tor — The Compound Cough", "The illness that came with doubled output. Calder keeps the list of names; Greeley keeps the folder marked OWED. Somebody, eventually, keeps the promise."],
    [Q.brace, "Khezek Tor — The Brace Strain", "The Brace took the extra load without a word. The mountain has since cleared its throat. If it fails, the hex changes. Permanently."]
  ]) {
    if (!quests[qid]) { quests[qid] = { id: qid, v: 1, name, description: desc, tags: [], createdTs: 0, updatedTs: 0 }; changes++; report.push(`✚ quest registered: ${name}`); }
    else report.push(`· ok (already) quest ${qid}`);
  }

  for (const w of WIRE) {
    const b = byId.get(w.id);
    if (!b) { report.push(`✗ MISSING BEAT ${w.id}`); continue; }
    if (w.speaker && !b.speakerActorId) { b.speakerActorId = w.speaker.id; changes++; report.push(`👤 speaker ${w.speaker.name} @ ${w.id}`); }
    if (w.inviteText && !b.inviteText) { b.inviteText = w.inviteText; changes++; report.push(`💬 inviteText @ ${w.id}`); }
    if (w.memoryText && !b.memoryText) { b.memoryText = w.memoryText; changes++; report.push(`🧠 memoryText @ ${w.id}`); }
  }
  for (const g of GATES) {
    const b = byId.get(g.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${g.beatId}`); continue; }
    b.inject = b.inject || {};
    const arr = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []);
    let did = false;
    for (const add of g.add) {
      if (!arr.some(r => r && r.questBucket === add.questBucket && r.is === add.is && r.isNot === add.isNot)) { arr.push(add); did = true; }
    }
    if (did) { b.inject.requires = arr; changes++; report.push(`🔒 gates @ ${g.beatId}`); }
    else report.push(`· ok (already) gates @ ${g.beatId}`);
  }
  for (const id of NO_OFFER) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING BEAT ${id}`); continue; }
    if (b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; report.push(`🚪 dialogueOffer:false @ ${id}`); }
  }
  for (const m of MARKS) {
    const b = byId.get(m.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${m.beatId}`); continue; }
    b.worldEffects = b.worldEffects || {}; b.worldEffects.questEffects = b.worldEffects.questEffects || [];
    if (b.worldEffects.questEffects.some(e => e && e.questId === m.questId)) { report.push(`· ok (already) mark ${m.questId} @ ${m.beatId}`); continue; }
    b.worldEffects.questEffects.push({ action: "accept", questId: m.questId, beatId: "", state: "active", text: m.text });
    changes++; report.push(`🌑 consequence mark ${m.questId} @ ${m.beatId}`);
  }
  for (const rw of REWRITES) {
    const b = byId.get(rw.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${rw.beatId}`); continue; }
    if (String(b.description || "").includes(rw.marker)) { report.push(`· ok (already) rewrite @ ${rw.beatId}`); continue; }
    b.description = rw.text; changes++; report.push(`✎ rewrite @ ${rw.beatId}`);
  }
  for (const t of TYPO_FIXES) {
    const b = byId.get(t.beatId);
    if (!b || !String(b.description || "").includes(t.from)) { report.push(`· ok (already) typo @ ${t.beatId}`); continue; }
    b.description = b.description.split(t.from).join(t.to); changes++; report.push(`✎ typo fix @ ${t.beatId}`);
  }
  for (const p of APPENDS) {
    const b = byId.get(p.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${p.beatId}`); continue; }
    if (String(b.description || "").includes(p.marker)) { report.push(`· ok (already) append @ ${p.beatId}`); continue; }
    b.description = String(b.description || "") + p.text; changes++; report.push(`✚ append @ ${p.beatId}`);
  }
  for (const f of FILL_DESCRIPTIONS) {
    const b = byId.get(f.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${f.beatId}`); continue; }
    if (String(b.description || "").trim()) { report.push(`· ok (has text) ${f.beatId}`); continue; }
    b.description = f.text; changes++; report.push(`✎ description filled @ ${f.beatId}`);
  }
  for (const nb of NEW_BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok (already) beat ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`);
  }
  // placements (additive)
  camp.npcPlacements = Array.isArray(camp.npcPlacements) ? camp.npcPlacements : [];
  const managed = new Set(camp.npcPlacements.map(p => String(p.actorId || "")));
  const PLACE = [
    [drax, [{ when: [], sceneId: SCENES.brace }], "the Brace"],
    [sable, [{ when: [], sceneId: SCENES.maw }], "the Maw"],
    [brennig, [{ when: [], sceneId: SCENES.liftHall }], "the Lift Hall"],
    // Wick haunts the Vacancy only while the Confessor's channel is un-resolved —
    // resolve the Debt and the pilgrim simply stops coming.
    [wick, [{ when: [reqNot(Q.confessor, "completed")], sceneId: SCENES.vacancy }], "the Vacancy (until the Debt resolves)"]
  ];
  for (const [actor, rules, label] of PLACE) {
    if (!actor) continue;
    if (managed.has(actor.id)) { report.push(`· ok (already managed) ${actor.name}`); continue; }
    camp.npcPlacements.push({ actorId: actor.id, rules });
    changes++; report.push(`📍 placement ${actor.name} → ${label}`);
  }

  console.log(`[seed-khezek-treatment] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ quests, campaigns: camps }, null, 2), "application/json", `khezek-treatment-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.placements?.reconcile?.(); } catch (_e) {}
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded. Run seed-khezek-dossier (mal-voice) next.`);
})();
