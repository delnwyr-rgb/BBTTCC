/* seed-category-b.macro.js — Category-B: the new beats + bookend wiring (2026-07-04)
 *
 * Play-order framing (owner, 2026-07-04): Fates & Destinies is the FIRST quest —
 * the "PCs are incarnating" cosmology class that leads into the training zone and
 * then the cold open. Gloomgill is the FINAL quest — he shows up after the
 * Valhaulan Raid (Thatwards Ho! Finale) is complete, when the PCs actually have
 * answers to his questions.
 *
 * WHAT IT DOES:
 *  1. CREATES 8 beats: 3 hub-closure speaker beats (Fixit/Lyrenn/Khezek settle),
 *     the Yarrow Pike Allesh-Gilliam closure, and 4 Gloomgill exam terminals.
 *     Speakers resolve BY NAME at run time — wired if the actor exists, seeded
 *     without and logged if not (safe to run before/after actor minting).
 *  2. GLOOMGILL: entry beats gated on {finale completed}; quiz Correct-chain
 *     Q1→…→Q10→passed; Fight→fought; intro-scene Leave→fled.
 *  3. FATES: questRole:start on slide 1; slide 9→10; slide 10 self-route bug →
 *     routes to incarnate; incarnate completes the quest; audio remap 4/5/6.
 *  4. SEAL↔TRIANGLE: seal_break TPK placeholder → "the heading is lit" rewrite;
 *     Rotating Chapel approach gated on {Seal completed}.
 *
 * DRY_RUN default true; idempotent (skips existing beats/values; only fills empty
 * routes except the known slide-10 self-route bug); backs up campaigns setting
 * before writing. Run as GM with "Thatward's Ho!" active.
 * Companion: bbttcc-mal-voice/tools/seed-seal-ending-pages.macro.js (dossier pages).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = {
    fixitMain: "quest_nrkJabUwZOLAJFYn", stabilizer: "quest_bSwOIWzxqNBwJ5NM", prisoner: "quest_uDuNp2yQxbuKkHx7",
    lyrennMain: "quest_JqCdOo0l6X8K2EcE", forest: "quest_feX6WHsBXuVbtjMM", pest: "quest_uMKbX648SllKTpEH", field: "quest_0HBaQXGlhFvNke2B",
    khezekMain: "quest_LJAmlim7oUtlMPiC", mine: "quest_A050y4VtoZFzOfGz", shipment: "quest_2Gs2dsKhv7G1OYBl", seal: "quest_AL1aIXiljxPUBH2e",
    ag: "quest_Cq1v3hJpXarX5rXJ", gloomgill: "quest_5obLcPkexYRVZqlg", fates: "quest_ycEa0uXzTzsbK4qP", finale: "quest_thatwards_ho_finale"
  };

  // speaker candidates, tried in order (exact match, case-insensitive)
  const SPEAKERS = {
    mara: ["Mara Quickhands"],
    rowan: ["Rowan of the Loam", "Rowan"],
    drax: ["Drax Calder", "Foreman Calder", "Overseer Calder"],
    pike: ["Yarrow Pike", "Marshall Yarrow", "Marshall Pike"],
    gloomgill: ["Gloomgill", "He That Was Oannes"]
  };
  const findActor = (cands) => {
    for (const n of cands) {
      const a = game.actors.find(x => String(x.name).trim().toLowerCase() === n.toLowerCase());
      if (a) return a;
    }
    return null;
  };

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
    description: o.description, questId: o.questId, questStep: null, questRole: o.questRole || "resolution",
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.inviteText ? { inviteText: o.inviteText } : {}),
    ...(o.memoryText ? { memoryText: o.memoryText } : {}),
    ...(o.handoff ? { handoff: o.handoff } : {})
  });

  const req = (questBucket, is) => ({ questBucket, is });
  const reqNot = (questBucket, isNot) => ({ questBucket, isNot });
  const complete = (questId, text) => ({ action: "complete", questId, beatId: "", state: "completed", text });

  const actors = {
    mara: findActor(SPEAKERS.mara), rowan: findActor(SPEAKERS.rowan), drax: findActor(SPEAKERS.drax),
    pike: findActor(SPEAKERS.pike), gloomgill: findActor(SPEAKERS.gloomgill)
  };

  const NEW_BEATS = [
    mkBeat({
      id: "fixit_hex_settles", label: "Furrier's Fixit Farm — The Farm Settles",
      questId: Q.fixitMain,
      requires: [req(Q.stabilizer, "completed"), req(Q.prisoner, "completed"), reqNot(Q.fixitMain, "completed")],
      speakerActorId: actors.mara?.id,
      inviteText: "Mara's leaning on the Counter with two glasses already poured. That's either a thank-you or a proposition.",
      memoryText: "The Farm settled its accounts with the Stewards — stabilizer humming, rite closed, ledger honest. I poured for that.",
      handoff: { beatId: "fixit_intro_scene", text: "The Farm carries on around you, unaudited. Where to?" },
      questEffects: [complete(Q.fixitMain, "The Fixit Farm has stopped auditioning you.")],
      description: "The Fixit Farm has stopped auditioning you. The stabilizer hums in the Arc Bay like a satisfied appliance, the rite is closed, and the Ledger — the real one, the one Mara keeps behind her eyes — has your names in the column that buys drinks. Furrier's still won't come out of the back. That's not about you. Probably."
    }),
    mkBeat({
      id: "lyrenn_hex_settles", label: "Lyrenn — The Hex Aligns",
      questId: Q.lyrennMain,
      requires: [req(Q.forest, "completed"), req(Q.pest, "completed"), req(Q.field, "completed"), reqNot(Q.lyrennMain, "completed")],
      speakerActorId: actors.rowan?.id,
      inviteText: "Rowan's waiting where the green ring meets the road, holding what appears to be a ceremonial vegetable.",
      memoryText: "Lyrenn settled while the Stewards were here — forest, field, and the gentle one, all squared. The root-net hums easier now.",
      questEffects: [complete(Q.lyrennMain, "Lyrenn has decided you can stay, which in Lyrenn is a legal outcome.")],
      description: "Lyrenn has decided you can stay, which in Lyrenn is a legal outcome. The forest keeps its negotiated line, the field remembers you fondly (it says so, out loud, which takes getting used to), and the pest situation is handled by a local with alarming enthusiasm. Rowan calls it alignment. The root-net calls it — nothing. It's finally quiet."
    }),
    mkBeat({
      id: "khezek_hex_settles", label: "Khezek Tor — The Mountain Squares Up",
      questId: Q.khezekMain,
      requires: [req(Q.mine, "completed"), req(Q.shipment, "completed"), req(Q.seal, "completed"), reqNot(Q.khezekMain, "completed")],
      speakerActorId: actors.drax?.id,
      inviteText: "Calder's posted the day's tonnage on the board. Under it, in chalk: STEWARDS — SEE ME. Underlined once. He's not a two-underline man.",
      memoryText: "The mountain's ledger balanced while they were here — mine answered, shipment settled, Seal decided. Khezek Tor doesn't say thank you. It says 'see me.'",
      questEffects: [complete(Q.khezekMain, "Khezek Tor's ledger balances. Calder wipes the board — that's the whole ceremony.")],
      description: "Khezek Tor runs on tonnage, grudges, and things underground answering back — and for the first time in living memory all three are accounted for. The mine's arrangement holds, the DARKNESS ships on schedule (sometimes; as agreed), and the Seal question is answered in whatever way you answered it. Calder wipes the board. That's the whole ceremony."
    }),
    mkBeat({
      id: "allesh_gilliam_pike_closure", label: "Allesh-Gilliam — Pike Updates the Map",
      questId: Q.ag,
      requires: [req(Q.stabilizer, "completed"), reqNot(Q.ag, "completed")],
      speakerActorId: actors.pike?.id,
      inviteText: "Marshall Pike is doing the thing where he pretends he wasn't watching the road you came in on.",
      memoryText: "Sent the new Stewards to the Fixit Farm on a hunch. Hunch paid. Three hexes stopped feeling like a dare.",
      questEffects: [complete(Q.ag, "Three hexes, one working leygate, and your names on Pike's map.")],
      description: "Pike heard about the stabilizer before you got back — of course he did; the man runs on other people's news. Three hexes, one working leygate, and a wall that's still bowing but now bowing on record. He doesn't say he was testing you with that first errand. He just updates the map, and the map now has your names on it."
    }),
    // — Gloomgill: the FINAL exam (post-finale). Terminals = memory-carriers.
    mkBeat({
      id: "gloomgill_passed", label: "Gloomgill — Examined and Found Adequate",
      questId: Q.gloomgill, speakerActorId: actors.gloomgill?.id,
      memoryText: "I asked them everything, at the end. They had answers — earned ones, with receipts. Passed. I granted the last fact as a prize.",
      questEffects: [complete(Q.gloomgill, "Examined by a god's leftover about everything you just lived through — and passed.")],
      description: "The last question lands and — you have answers. Real ones, earned the hard way, with receipts. He That Was Oannes closes the book, satisfied. You have been examined by a god's leftover about everything you just lived through, and passed. Gloomgill grants you one final fact — the one you didn't ask for — delivered like a prize you can't return. The gill-light follows you out. He insists that's an honor. This time, it might be."
    }),
    mkBeat({
      id: "gloomgill_failed", label: "Gloomgill — Reapplication Accepted",
      questId: Q.gloomgill, speakerActorId: actors.gloomgill?.id,
      memoryText: "I asked them everything, at the end. They lived it and still couldn't say what it meant. Disappointing. Reapplication accepted.",
      questEffects: [complete(Q.gloomgill, "You lived through all of it and still failed the exam.")],
      description: "You lived through all of it and still failed the exam. Gloomgill isn't angry, he's disappointed, which is worse and he knows it. The material, he notes, was your own lives. Reapplication accepted whenever you've done the reflecting — he does not say how, or where, or whether he'll look like a mire next time."
    }),
    mkBeat({
      id: "gloomgill_fought", label: "Gloomgill — The Water Fought Back",
      questId: Q.gloomgill, speakerActorId: actors.gloomgill?.id,
      memoryText: "They answered the final exam with violence. The water and I disagreed with them, pedantically. Logged as a win.",
      questEffects: [complete(Q.gloomgill, "You fought the thing that was Oannes. Nobody won, which he logs as a win.")],
      description: "You fought the thing that was Oannes. The water fought back, pedantically. Nobody won, which Gloomgill logs as a win. What's left behind is a grudge with excellent memory and gills — and the exam, he mentions while leaving, is merely postponed."
    }),
    mkBeat({
      id: "gloomgill_fled", label: "Gloomgill — Declining the Material",
      questId: Q.gloomgill, speakerActorId: actors.gloomgill?.id,
      memoryText: "They walked out of the final exam. I will describe this, forever, to everyone, as 'declining the material.'",
      questEffects: [complete(Q.gloomgill, "You walked out of the final exam. Your grade did not.")],
      description: "You walked out of the final exam. Gloomgill will describe this, forever, to everyone, as 'declining the material.' The mire lets you go. Your grade does not."
    })
  ];

  // ---- patches ----------------------------------------------------------------
  const SEAL_BREAK_MARKER = "The seal breaks like a promise";
  const SEAL_BREAK_TEXT = "The seal breaks like a promise — quietly, then all at once, then in everyone else's direction. What was held is now headed, coastward, down the same line the survey stations have been shaking about, and every needle on the Triangle wakes up screaming at once. Khezek Tor holds — barely, loudly, at a cost the mountain will be invoicing for years. Nobody dies who didn't volunteer. But the heading is lit now, burning-map bright, and whatever runs supply to that stretch of nothing knows the door just unlocked itself from your side.";

  const GATES = [
    { beatId: "map_rotating_chapel_approach", add: req(Q.seal, "completed") },
    { beatId: "gloomgill_intro", add: req(Q.finale, "completed") },
    { beatId: "gloomgill_intro_scene", add: req(Q.finale, "completed") }
  ];

  const ROUTES = [
    // Gloomgill exam flow (fill only if empty)
    ...Array.from({ length: 9 }, (_, i) => ({ beatId: `gloomgill_question_${i + 1}`, label: "Correct", next: `gloomgill_question_${i + 2}` })),
    { beatId: "gloomgill_question_10", label: "Correct", next: "gloomgill_passed" },
    ...Array.from({ length: 10 }, (_, i) => ({ beatId: `gloomgill_question_${i + 1}`, label: "Incorrect", next: "gloomgill_incorrect" })),
    { beatId: "gloomgill_intro_scene", label: "Leave", next: "gloomgill_fled" },
    { beatId: "fates_and_destinies_9", label: "Progress Slide", next: "fates_and_destinies_10" }
  ];
  const NEXT_PATCHES = [ { beatId: "gloomgill_fight", next: "gloomgill_fought" } ];
  // known bug: slide 10 routes to ITSELF — repoint only if it still self-routes
  const SELF_ROUTE_FIX = { beatId: "fates_and_destinies_10", label: "Progress Slide", next: "fates_and_destinies_incarnate" };

  const FATES_AUDIO_REMAP = { // slide id -> correct filename
    fates_and_destinies_4: "bbttcc_gottgait_voice_track_fates_destinies_4.mp3",
    fates_and_destinies_5: "bbttcc_gottgait_voice_track_fates_destinies_5.mp3",
    fates_and_destinies_6: "bbttcc_gottgait_voice_track_fates_destinies_6.mp3"
  };

  // ---- load + apply -------------------------------------------------------------
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  for (const k of Object.keys(actors))
    report.push(actors[k] ? `👤 speaker ${k} → "${actors[k].name}" (${actors[k].id})` : `⚠ speaker ${k} NOT FOUND (beat seeds without speaker — re-run after minting to wire)`);

  // 1. create beats
  for (const nb of NEW_BEATS) {
    const cur = byId.get(nb.id);
    if (cur) {
      // wire speaker onto an existing seeded beat if it was missing and now resolves
      if (!cur.speakerActorId && nb.speakerActorId) { cur.speakerActorId = nb.speakerActorId; changes++; report.push(`👤 wired speaker onto existing ${nb.id}`); }
      else report.push(`· ok (already) beat ${nb.id}`);
      continue;
    }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat ${nb.id}${nb.speakerActorId ? "" : " (no speaker yet)"}`);
  }

  // 2. gates
  for (const g of GATES) {
    const b = byId.get(g.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${g.beatId}`); continue; }
    b.inject = b.inject || {};
    const cur = b.inject.requires;
    const arr = Array.isArray(cur) ? cur : (cur ? [cur] : []);
    const has = arr.some(r => r && r.questBucket === g.add.questBucket && r.is === g.add.is);
    if (has) { report.push(`· ok (already) gate ${g.beatId}`); continue; }
    arr.push(g.add); b.inject.requires = arr;
    changes++; report.push(`🔒 gate ${g.beatId} += ${JSON.stringify(g.add)}`);
  }

  // 3. routes (fill-if-empty)
  for (const r of ROUTES) {
    const b = byId.get(r.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${r.beatId}`); continue; }
    const ch = (b.choices || []).find(c => String(c.label || "").trim() === r.label);
    if (!ch) { report.push(`✗ MISSING CHOICE "${r.label}" @ ${r.beatId}`); continue; }
    if ((ch.next || "").trim()) { report.push(`· ok (already routed) "${r.label}" @ ${r.beatId}`); continue; }
    if (!byId.get(r.next)) { report.push(`✗ ROUTE TARGET MISSING ${r.next}`); continue; }
    ch.next = r.next; changes++; report.push(`⤳ route "${r.label}" → ${r.next} @ ${r.beatId}`);
  }
  for (const p of NEXT_PATCHES) {
    const b = byId.get(p.beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${p.beatId}`); continue; }
    if ((b.next || "").trim()) { report.push(`· ok (already) next @ ${p.beatId}`); continue; }
    b.next = p.next; changes++; report.push(`⤳ next → ${p.next} @ ${p.beatId}`);
  }
  { // slide-10 self-route bug
    const b = byId.get(SELF_ROUTE_FIX.beatId);
    const ch = b && (b.choices || []).find(c => String(c.label || "").trim() === SELF_ROUTE_FIX.label);
    if (ch && ch.next === SELF_ROUTE_FIX.beatId) { ch.next = SELF_ROUTE_FIX.next; changes++; report.push(`🐛 fixed self-route: slide 10 → incarnate`); }
    else report.push(`· ok (already) slide-10 route`);
  }

  // 4. fates lifecycle + audio
  { const b = byId.get("fates_and_destinies_1");
    if (b && b.questRole !== "start") { b.questRole = "start"; changes++; report.push(`✚ questRole:start @ fates_and_destinies_1`); }
    else report.push(`· ok (already) fates start role`); }
  { const b = byId.get("fates_and_destinies_incarnate");
    if (b) {
      b.worldEffects = b.worldEffects || {}; b.worldEffects.questEffects = b.worldEffects.questEffects || [];
      if (!b.worldEffects.questEffects.some(e => e && e.questId === Q.fates && e.action === "complete")) {
        b.worldEffects.questEffects.push(complete(Q.fates, "Class dismissed. Go be born."));
        if (!b.questRole) b.questRole = "resolution";
        changes++; report.push(`✚ complete ${Q.fates} @ fates_and_destinies_incarnate`);
      } else report.push(`· ok (already) fates complete`);
    } else report.push(`✗ MISSING BEAT fates_and_destinies_incarnate`); }
  for (const [beatId, fname] of Object.entries(FATES_AUDIO_REMAP)) {
    const b = byId.get(beatId);
    if (!b?.audio?.src) { report.push(`✗ no audio src @ ${beatId}`); continue; }
    const cur = decodeURIComponent(b.audio.src);
    if (cur.endsWith("/" + fname)) { report.push(`· ok (already) audio @ ${beatId}`); continue; }
    b.audio.src = cur.replace(/[^/]+$/, fname);
    changes++; report.push(`🎵 audio ${beatId} → ${fname}`);
  }

  // 5. seal_break rewrite
  { const b = byId.get("khezek_tor_the_vaulhaulan_seal_break");
    if (!b) report.push(`✗ MISSING BEAT khezek_tor_the_vaulhaulan_seal_break`);
    else if (String(b.description || "").includes(SEAL_BREAK_MARKER)) report.push(`· ok (already) seal_break rewrite`);
    else { b.description = SEAL_BREAK_TEXT; changes++; report.push(`✎ seal_break description → "the heading is lit" rewrite`); } }

  console.log(`[seed-category-b] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do — all rows already present.");

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ campaigns: camps }, null, 2), "application/json", `category-b-backup-${stamp}.json`);
  } catch (e) {
    console.error(e);
    return ui.notifications.error("Backup failed — aborting without writing.");
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded. Run the mal-voice seal-pages seeder next.`);
})();
