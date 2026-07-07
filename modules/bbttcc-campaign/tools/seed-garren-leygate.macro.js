/* seed-garren-leygate.macro.js — Garren, the Leygate, and the last two truths (2026-07-07)
 *
 * Garren, Leygate Engineer (owner-minted 2026-07-07): the man who keeps the broken
 * gate alive, and the man who receives the stabilizer when the party delivers it.
 * THE SECRET GEOMETRY: Garren WROTE the report Pike trusted the night of the
 * flicker — certified the old stabilizer "good for another season" eleven days
 * before it killed people. Pike has deliberately never looked up the signature.
 * Neither has said it. The delivery is Garren's redemption day.
 *
 * DOES:
 *  1. Beats: ag_leygate_visit (the broken gate, wired to Pike's dead "Head to the
 *     Leygate" choice) → ag_leygate_delivery (speaker Garren, gated {Stabilizer
 *     completed} — the auto-invite scan posts his card the moment the deal lands
 *     at Fixit) → ag_leygate_installed (outcome/memory carrier, curtain call).
 *  2. Personas (marker-guarded): Garren's full truth + light PRIVATE TRUTHS for
 *     Pike and Etta (verification found theirs empty).
 *  3. Dossier: Garren self page + "The Gate Remembers Right" @after the install.
 *  4. Placement: Garren → the Leygate battlemap, always (he does not leave).
 *
 * DRY_RUN default true; idempotent; backup before write. Names matched
 * punctuation-proof. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MAL = "bbttcc-mal-voice";
  const JOURNAL_NAME = "World Dossier";
  const MARKER = "[AG-LEYGATE-2026-07-07]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = { stabilizer: "quest_bSwOIWzxqNBwJ5NM" };
  const LEYGATE_SCENE = "sSWMvbYNDOkdCYIV";   // allesh_gilliam_leygate_battlemap

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const garren = findActor(["Garren, Leygate Engineer", "Garren"]);
  const pike = findActor(["Marshal Yarrow Pike", "Yarrow Pike"]);
  const etta = findActor(["Etta Bloom"]);

  const PERSONAS = [
    { actor: garren, who: "Garren",
      topics: "the Leygate, Allesh-Gilliam, leyline stabilizers, the Night the Mountain Coughed, Furrier's Fixit Farm, Marshal Yarrow Pike, the HQ",
      notes: `${MARKER} PRIVATE TRUTH — Garren, Leygate Engineer. Voice: tired competence; talks to the gate like a coworker he's covering shifts for. He has kept a broken Leygate alive on salvage, apology, and a maintenance log that reads like a hostage negotiation. THE SECRET: eleven days before the Night the Mountain Coughed, HE certified the old stabilizer "good for another season" — signed it because the parts weren't coming and somebody had to write something, and the flicker killed people who trusted the schedule his signature held up. Pike blames himself for believing the previous report. Garren WROTE the previous report. Neither of them has ever said it; Garren is fairly sure Pike has never read the signature, and he cannot decide if that's mercy or a fuse. TELL: when he's tired he quotes his own certification from memory, verbatim, flat ("unit is serviceable and may be expected to perform within tolerances for the coming season"), then changes the subject. GUARDING: gives the technical account of the flicker precisely to anyone; gives the HUMAN account only to someone who has helped him carry something heavy — literally or otherwise. DELIVERY DAY: when the new stabilizer arrives from Furrier's he installs it with steady hands, checks it three times, signs the new certification slowly like it weighs something — and only afterward, alone with the hum, do the hands shake. If redeemed by the work (the install completing), he sleeps a full night for the first time since the Cough; the dossier will know.` },
    { actor: pike, who: "Pike",
      topics: "",
      notes: `${MARKER} PRIVATE TRUTH — Marshal Yarrow Pike. Voice: economy in everything; stands like furniture that's judging you; measures distances, people, and claims automatically. STAGING: at the HQ map table by default; walks the East Wall when it's in question; never sits first. WHAT HE GUARDS: (1) He has done the Plumb math — survey dated three days BEFORE the Cough, "cosmetic" verdict standing on it — and says nothing publicly, because the town can afford exactly one crisis of authority at a time; he is waiting for someone ELSE to force the re-survey so the working relationship survives it. (2) The flicker report that killed his people was signed. He could find out by whom in five minutes. He has chosen, deliberately, for years, not to look — because the day he reads that signature he has to do something about it, and he does not trust what. If the Stewards ever put the name in front of him, he goes very quiet, and then he goes to the Leygate alone, and what happens there is forgiveness — but he'd have chosen not to know, and it will cost him a week of silence. His echo he tells if asked plainly; it is not a secret, it is a wound with a handle on it.` },
    { actor: etta, who: "Etta",
      topics: "",
      notes: `${MARKER} PRIVATE TRUTH — Etta Bloom. Voice: warm, unblinking, forgives you in advance; adjusts things that don't need adjusting when she's deciding how much to say; never blinks first. STAGING: the Long Market is her office, the whole market — she conducts it while she talks. WHAT SHE GUARDS: the "old mistakes buried nearby" line is a DOOR and she opens it only if a Steward asks directly about statues, standing stones, or stone-folk — or shows her stone-sign of any kind. Behind that door: she is Menhirkin, and the buried mistakes are KIN — stone kin who stopped, or were stopped, and were let stay lost because finding them meant deciding what was owed. She counts debts in consequence, not marks (her echo is public and true). About the sigil she gave the Stewards: she is watching which of the three doors they walk through — restore, redirect, break — and she has already adjusted inventory for two of the three. Ask her which two and she smiles and sells you preserves.` }
  ];

  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: "skill_scene", timeScale: "scene",
    tags: "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit",
      fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: o.requires || [] },
    actors: [], choices: o.choices || [],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null,
      turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [],
      questEffects: o.questEffects || [] },
    description: o.description, questId: o.questId || "quest_Cq1v3hJpXarX5rXJ", questStep: null,
    questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    ...(o.sceneId ? { sceneId: o.sceneId } : {}),
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.inviteText ? { inviteText: o.inviteText } : {}),
    ...(o.memoryText ? { memoryText: o.memoryText } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });

  const NEW_BEATS = [
    mkBeat({
      id: "ag_leygate_visit", label: "Allesh-Gilliam — The Gate That Remembers Wrong",
      sceneId: LEYGATE_SCENE, dialogueOffer: false,
      choices: [{ label: "Leave", next: "allesh_gilliam_quest_hub_1", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      description: "The Leygate hums the way a man hums when he's forgotten the tune but won't admit it. EMERGENCIES ONLY, says the sign, and under it, in smaller and more honest paint: AND EVEN THEN, ASK GARREN. Garren, Leygate Engineer, is exactly where he always is — half inside an access panel, having a low, patient argument with a machine that remembers wrong. The maintenance log hanging off the console is thick as scripture and reads like a hostage negotiation. He'll tell you the technical truth of it free of charge: the old stabilizer is past pretending, the gate flickers when it lies, and the only replacement he knows of sits in the Arc Bay at Furrier's Fixit, where the Jackalopes keep it like a promise nobody's earned yet."
    }),
    mkBeat({
      id: "ag_leygate_delivery", label: "Allesh-Gilliam — The Gate Remembers Right",
      sceneId: LEYGATE_SCENE,
      requires: [{ questBucket: Q.stabilizer, is: "completed" }],
      speakerActorId: garren?.id,
      inviteText: "Garren is at the Leygate with the crate open, reading the new stabilizer's serial number like scripture.",
      choices: [
        { label: "Hand it over and let him work", next: "ag_leygate_installed",
          description: "He's waited since the Cough for this crate. Give him the room. Some installs are liturgy.", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Ask what really happened, the night it flickered", next: "ag_leygate_installed",
          description: "He'll answer while he works — the technical account first, precise as a certification. Whether you get the human account depends on who's been carrying what.", checkStat: "", checkDC: 0, failNext: "" }
      ],
      description: "The crate from Furrier's Fixit sits at the foot of the Leygate, and Garren is reading the stabilizer's serial number to himself like it's the name of someone he owes money to. He has kept this gate alive on salvage and apology since the Night the Mountain Coughed, and now the real part is here, delivered by the Stewards, witnessed by whoever's smart enough to stop and watch. He wipes his hands before he touches it. That's the whole speech."
    }),
    mkBeat({
      id: "ag_leygate_installed", label: "Allesh-Gilliam — Signed With a Steady Hand",
      sceneId: LEYGATE_SCENE, questRole: "resolution",
      speakerActorId: garren?.id,
      memoryText: "The Stewards brought the stabilizer from Furrier's and I set it true — checked it three times, signed the certification slow. The gate remembers right for the first time since the Cough. My hands were steady the whole install. After, alone with the hum, they weren't. That's fair. That's owed.",
      description: "The install takes an hour and Garren makes it look like surgery, which in every way that matters it is. The new stabilizer seats, the hum drops half an octave into something the whole town will sleep better under, and the Leygate stops flickering mid-thought like a liar losing track of the story. Garren checks it three times, then signs the new certification slowly, like the pen weighs something — and if you're still there to see it, you'll notice he dates it, reads his own signature back, and closes the log gently, the way you close a door on a room where something finally stopped hurting. The gate remembers right. The town will hear it before dark."
    })
  ];

  const ROUTES = [
    { beatId: "allesh_gilliam_introduction_to_hq", label: "Head to the Leygate", next: "ag_leygate_visit" }
  ];

  const PAGES = [
    { name: "Garren, Leygate Engineer", knownBy: "Garren, Leygate Engineer", body:
      `Keeps the Leygate — the machine everyone needs and nobody thanks. Half inside an access panel most hours, arguing patiently with a gate that remembers wrong, maintenance log thick as scripture. The old stabilizer is past pretending and the only replacement he knows of is at Furrier's Fixit, in the Arc Bay, with the Jackalopes. He was on duty the Night the Mountain Coughed; he gives the technical account of the flicker precisely and completely, and no other account at all.` },
    { name: "The Gate Remembers Right", knownBy: "all", after: "beat:ag_leygate_installed", body:
      `The Stewards brought the stabilizer back from Furrier's Fixit and Garren set it true — checked it three times, signed the certification slow, and the Leygate's hum dropped into something a whole town can sleep under. First time since the Night the Mountain Coughed that the gate remembers right. Folk stopped by just to hear it. Garren slept a full night, first one anybody can prove since the Cough, and nobody's saying anything about it, loudly, all over town.` }
  ];

  // ── load + apply ─────────────────────────────────────────────────────────────
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

  report.push(garren ? `👤 Garren → "${garren.name}" (${garren.id})` : `⚠ Garren NOT FOUND`);
  report.push(pike ? `👤 Pike → "${pike.name}"` : `⚠ Pike NOT FOUND`);
  report.push(etta ? `👤 Etta → "${etta.name}"` : `⚠ Etta NOT FOUND`);

  // 1. beats
  for (const nb of NEW_BEATS) {
    const cur = byId.get(nb.id);
    if (cur) {
      if (!cur.speakerActorId && nb.speakerActorId) { cur.speakerActorId = nb.speakerActorId; changes++; report.push(`👤 wired speaker onto existing ${nb.id}`); }
      else report.push(`· ok (already) beat ${nb.id}`);
      continue;
    }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`);
  }
  // 2. route the dead choice
  for (const r of ROUTES) {
    const b = byId.get(r.beatId);
    const ch = b && (b.choices || []).find(c => String(c.label || "").trim() === r.label);
    if (!ch) { report.push(`✗ MISSING CHOICE "${r.label}" @ ${r.beatId}`); continue; }
    if ((ch.next || "").trim()) { report.push(`· ok (already routed) "${r.label}"`); continue; }
    ch.next = r.next; changes++; report.push(`⤳ route "${r.label}" → ${r.next}`);
  }
  // 3. personas
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found`); continue; }
    const cur = p.actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) truth on ${p.actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    report.push(`✚ PRIVATE TRUTH → ${p.actor.name}`);
    if (!DRY_RUN) await p.actor.setFlag(MAL, "persona", { topics, notes });
    changes++;
  }
  // 4. placement (additive)
  camp.npcPlacements = Array.isArray(camp.npcPlacements) ? camp.npcPlacements : [];
  if (garren && !camp.npcPlacements.some(p => String(p.actorId) === garren.id)) {
    camp.npcPlacements.push({ actorId: garren.id, rules: [{ when: [], sceneId: LEYGATE_SCENE }] });
    changes++; report.push(`📍 placement ${garren.name} → leygate battlemap (default)`);
  } else if (garren) report.push(`· ok (already managed) ${garren.name}`);
  // 5. dossier pages
  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  if (!journal && !DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME });
  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    if (existing) { report.push(`page "${p.name}": exists — SKIPPED`); continue; }
    const head = [`<p>@knownBy: ${p.knownBy}</p>`];
    if (p.after) head.push(`<p>@after: ${p.after}</p>`);
    const content = head.join("\n") + `\n<p>${p.body}</p>`;
    report.push(`page "${p.name}": CREATE`);
    if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content, format: 1 } }]);
    changes++;
  }

  console.log(`[seed-garren-leygate] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ campaigns: camps }, null, 2), "application/json", `garren-leygate-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.placements?.reconcile?.(); } catch (_e) {}
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded.`);
})();
