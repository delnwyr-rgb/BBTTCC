/* seed-cadence-retrofit.macro.js — THE CADENCE to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/CADENCE_RETROFIT_2026_09_30.md; worksheet ruling 09-16 (Culture/Soft-Power-only floor; the order; the next-step lines kept);
 * dossier canon (Maestra Velvetine Marr: the war-drummer's echo, "the silence is the encore"; Tempo: 4/4, the 'hm', a refused card is the
 * saddest object in the world). ADDS: Tempo in person at the gate (a comeback check with a fail that squares the bar), THE TERMS with the
 * quartermaster, THE DRUM (the turn — the Maestra's echo, told once, at her tempo), the viewing mound, THE PARADE (Stillwater's parade
 * permit spent: a parade is a floor with a direction — a fourth way off the floor), receipt THE MAESTRA'S TERMS on a style win, meters set
 * on every floor outcome (respect / tribute / uncontested), speakers on every Cadence beat, personas (the Maestra's was empty) + secrets.
 * Idempotent; backs up the campaigns setting. F5 after.
 *
 * REVIEW FIXES 2026-10-01 (GAME_REVIEW_2026_09_30, HIGH): cadence_parade (the quest closer: +10 culture to the coalition, the Maestra's
 * Terms, Out-Danced removed, a raid owed) gated only on storyPhase ≥ 2 while carrying storyChain + priority high + the Maestra — the Director
 * and any Maestra conversation could play it in Act 2 before the floor, the border show or the permit. It is now gated on its one route
 * (GATE_PARADE: the viewing mound played + the Stillwater parade permit) and dialogueOffer:false. The mound's "Show Tempo the Parade Permit"
 * choice still routes there (a route never consults inject.requires). Re-runs reconcile an already-seeded beat additively.
 * Already-seeded worlds: tools/patch-template-review-fixes-2026-10-01.macro.js does the same repair in one run.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "cadence", Q = "quest_cadence";
  const MARKER = "[CADENCE-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => { const want = cands.map(norm); return (game.actors?.contents || []).find(a => want.includes(norm(a.name))) || null; };

  // ── 1. personas ────────────────────────────────────────────────────────────
  const PERSONAS = [
    { cands: ["Maestra Velvetine Marr", "Maestra Velvetine Mar", "Velvetine Marr", "The Maestra", "Maestra"], who: "the Maestra",
      topics: "the floor, the declaration, rhythm, face, the crew, the four figures, respect, terms, refreshments, the drum (once), steel (never), the next target (guarded)",
      notes: `${MARKER} PRIVATE TRUTH — Maestra Velvetine Marr, of the Cadence. Voice: warm, unhurried command; discusses dance exclusively in the vocabulary of siegecraft (a routine is 'an assault', a good crowd is 'favorable terrain', applause is 'terms'). Her crew has never thrown a punch and she enforces this the way other commanders enforce discipline under fire, because it IS the discipline: the moment steel appears, the Cadence has lost, whatever happens next. HER ECHO (told plainly, once, at her tempo, to someone who asks with genuine curiosity what the drum was for): she was a war-drummer, years back, keeping time for a column of soldiers, good ones, brave ones, and on the third day of a siege she noticed that EVERYONE, both walls, was moving to her drum. The blades were incidental. The drum was the army. She walked out of that war with the drum. ON WINNING UGLY: she does not retaliate; she withdraws in formation, in silence, and lets the region do the rest: 'the silence is the encore.' ON A PARADE PERMIT: a parade is a floor with a direction; she will take one as terms. GUARDS: never names the next target ('the card arrives when the card arrives'); never mocks a graceful loser. TELLS: counts anything she's assessing in fours under her breath; when moved she stops keeping time entirely, which her crew regards with the alarm other units reserve for incoming fire.`,
      secrets: [
        "The Drum Was the Army :: favorPlus1 :: a Steward asks, with genuine curiosity, what the drum was FOR :: On the third day of a siege both walls were moving to her drum. The blades were incidental. She walked out of that war with the drum and has been taking territory that rebuilds overnight ever since: face, regard, the story a hex tells about itself.",
        "The Card Arrives When the Card Arrives :: coverTracks :: a Steward asks who is next :: She never names the next target. She will, if pressed kindly, say who it ISN'T, and a list of who it isn't is a kind of map."
      ] },
    { cands: ["Tempo"], who: "Tempo",
      topics: "the declaration, the card, the count, the program, the viewing mound, refreshments, the collection, the drawer",
      notes: `${MARKER} ADDENDUM — Tempo, on the cards: letters every declaration by hand, on stock they will not name the source of, and keeps every REFUSED card in a drawer, because a refused card is the saddest object in the world and the invitation stands; paper is patient. Can say who refused, when, and whether they answered later. Every one of them answered later. On a comeback landed well in conversation: applauds, twice, warmly, and means it. On a sentence that comes out in three beats: 'hm.'`,
      secrets: [
        "Paper Is Patient :: stirThePot :: a Steward refuses the card to Tempo's face, or asks about the drawer :: A refused card is the saddest object in the world and Tempo keeps every one; he can tell you who refused, when, and whether they answered later. Every one of them did.",
        "The Purest Form :: rollPlus2 :: a Steward asks what Tempo is proudest of :: The border programmes: playing to an audience that is pretending not to watch. He can tell you which of your sentries are humming, by name, and which figure."
      ] }
  ];
  const actorIds = {};
  for (const P of PERSONAS) {
    const a = findActor(P.cands); if (!a) { say(`✗ actor not found: ${P.who} (persona skipped)`); continue; }
    actorIds[P.who] = a.id;
    const cur = a.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${P.who}`); continue; }
    changes++; say(`✚ persona ${P.who} +${P.secrets.length} secrets`);
    if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), P.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), P.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...P.secrets].filter(Boolean).join("\n") });
  }
  const MAESTRA = actorIds["the Maestra"] || null, TEMPO = actorIds["Tempo"] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["cadence_declaration", "cadence_battle", "cadence_win_style", "cadence_win_ugly", "cadence_lose", "cadence_refuse", "cadence_rematch", "cadence_border_show", "cadence_cameo", "cadence_cameo_spent"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Cadence was never seeded here.`);

  const TAGS = "cadence story";
  const P2 = { flag: "storyPhase", gte: 2 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, meters = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, questId = Q, repeatable = false, extraFx = null, hexName = null, offer = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}), ...(hexName ? { hexName } : {}),
    ...(offer === false ? { dialogueOffer: false } : {}),   // a routing-only node: never a conversation moment
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(meters ? { meters } : {}), ...(extraFx || {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  // the parade is reached ONLY from the viewing mound's permit choice — keep in sync with tools/patch-template-review-fixes-2026-10-01.macro.js
  const GATE_PARADE = [P2, { beatMark: "cadence_viewing_mound" }, { beatMark: "stillwater_parade_permit" }];

  const NEW = [
    beat("cadence_tempo_at_the_gate", "The Cadence — The Courier",
      "He is unarmed, on foot, in full sequin, and he has walked through your gate mid-alarm and handed the card to whoever was holding the biggest weapon, and complimented the fortifications, and he is now waiting. Everything he says comes out in four beats. \"The Cadence sends its compliments. The floor is built at dusk. The terms are on the card, hm.\" You will learn later that the 'hm' squares the bar and that he does not know he does it. He has never once been harmed doing this, a statistic he attributes to good tailoring.",
      { speaker: TEMPO, requires: [P2], choices: [
        ch("Ask who lettered the card.", "", { description: "\"I did. Every one. By hand. Hm.\" He looks at the card in your hand the way other people look at their children." }),
        ch("Land a comeback.", "cadence_tempo_applause", { checkStat: "presence", checkDC: 13, failNext: "cadence_tempo_hm", description: "He is a metronome you can interrogate. Say something worth applauding." }),
        ch("Take the card. We'll read the terms.", "cadence_the_terms"),
        ch("Refuse it to his face.", "cadence_refuse", { description: "He does not argue. He sets the card down on the nearest flat surface, squares it to the edge, and leaves. The invitation stands. Paper is patient." })
      ] }),
    beat("cadence_tempo_applause", "The Cadence — Applause, Twice",
      "He applauds. Twice, warmly, and he means it, and then he stops, because three would be too many and he can feel that in his hands. \"That's two,\" he says, which is also four beats. \"They'll like you on the floor.\" He leaves the card. He does not leave the compliment; he takes that with him, for the Maestra.",
      { speaker: TEMPO, requires: [P2], memoryText: "Tempo, herald of the Cadence, applauded a Steward twice at the gate.", choices: [ch("Read the terms.", "cadence_the_terms")] }),
    beat("cadence_tempo_hm", "The Cadence — Hm",
      "Your comeback comes out in three beats. There is a silence exactly one beat long, and then, kindly, from the courier: \"hm.\" The bar is square now. You have been metered. He hands you the card anyway; the card was never in question.",
      { speaker: TEMPO, requires: [P2], choices: [ch("Read the terms.", "cadence_the_terms")] }),
    beat("cadence_the_terms", "The Cadence — The Terms",
      "The quartermaster reads the card aloud at supper, because it is genuinely beautiful and someone should. Time: dusk. Place: your own ground; they build the floor. Terms: CULTURE and SOFT POWER only. Face is the territory. Style is the ordnance. There is a line at the bottom in a smaller hand: NO WEAPON HAS EVER APPEARED IN ANY ACCOUNT OF US, ANYWHERE, EVER. The quartermaster reads it twice and then says the thing everybody is thinking, which is that this is the most frightening sentence anyone has ever read at this table.",
      { type: "narration", requires: [P2], choices: [
        ch("Meet them on the floor.", "cadence_battle"),
        ch("Ask the quartermaster about the collection.", "cadence_collection", { description: "There is a collection. Nobody has agreed to discuss it." }),
        ch("Refuse.", "cadence_refuse")
      ] }),
    beat("cadence_collection", "The Cadence — The Quartermaster's Collection",
      "A cigar box, in the stores, under the manifests, that everyone has agreed not to discuss. Cards. All of them: the declaration, and then, if it comes to that, the rematches, one per turn, each one lettered by hand on stock nobody can source, each one scented with confidence. The quartermaster does not collect anything else. The quartermaster has arranged them by date. \"They're all in one hand,\" the quartermaster says, which is the first time anyone has said anything about the collection out loud, and then closes the box.",
      { type: "narration", requires: [P2], choices: [
        ch("Take one to the floor for luck.", "cadence_battle", { description: "The quartermaster lets you. The quartermaster watches you leave with it." }),
        ch("Close the box.", "", { description: "Nobody discusses it." })
      ] }),
    beat("cadence_the_drum", "The Cadence — The Drum",
      "After the floor there are refreshments, because there are always refreshments; the Cadence considers a floor without refreshments a rout. The Maestra takes hers standing. She counts the crowd in fours under her breath, and then someone asks her, with genuine curiosity and no angle at all, what the drum was for. She stops counting. Her crew notices this the way other units notice incoming fire. And she tells it, once, at her tempo: a column of soldiers, good ones, brave ones; the third day of a siege; the moment she noticed that everyone, both walls, was moving to her drum. \"The blades were incidental,\" she says. \"The drum was the army.\" She walked out of that war with the drum. Then she starts counting again, and her crew breathes out.",
      { speaker: MAESTRA, priority: "high", timePoints: 1, requires: [P2, { anyOf: [{ beatMark: "cadence_win_style" }, { beatMark: "cadence_lose" }, { beatMark: "cadence_parade" }] }],
        memoryText: "The Maestra told the Stewards, once, what the drum was for: the drum was the army.",
        choices: [
          ch("Ask why they never draw steel.", "", { description: "\"Because the moment steel appears we have lost, whatever happens next. That isn't a rule. It's the whole discipline.\"" }),
          ch("Ask her to keep time for you.", "", { description: "She declines, kindly. \"You have your own tempo. I heard it on the floor. Don't let anyone drum over it.\"" }),
          ch("Ask who's next.", "", { description: "\"The card arrives when the card arrives.\" A pause, four beats. \"It isn't Lyrenn.\"" })
        ] }),
    beat("cadence_viewing_mound", "The Cadence — The Viewing Mound",
      "It has a name now, the mound; it has steps cut into it, and a rope, and a woman selling something hot in paper. Attendance is up from three hexes. Tempo is on the mound, not performing, watching the audience watch the border, and he is happier than you have ever seen a person be about anything. \"This is the purest form,\" he says. \"An audience that is pretending not to watch, hm.\" He can tell you which of your sentries are humming. By name. And which figure.",
      { speaker: TEMPO, requires: [P2, { flag: "cadenceUncontested", eq: 1 }], repeatable: true, choices: [
        ch("Buy a refreshment.", "", { description: "It is very good, and it costs a mark, and the woman selling it is from the Cadence, and the mark is tribute, and everyone on the mound knows it." }),
        ch("Ask which sentries are humming.", "", { description: "He tells you. You knew two of the names. The third is the sergeant who says she hates it." }),
        ch("Show Tempo the Parade Permit.", "cadence_parade", { requires: { beatMark: "stillwater_parade_permit" }, description: "He reads it in four beats. Then he reads it again. Then he applauds, twice, and goes down the mound at something close to a run, to find the Maestra." }),
        ch("Answer at last. Take the floor.", "cadence_battle")
      ] }),
    beat("cadence_parade", "The Cadence — The Parade",
      "\"A parade,\" the Maestra says, holding the permit at arm's length like terms of surrender, \"is a floor with a direction.\" She accepts it as terms. The border performance ends that night and begins again at dawn as a route: the Cadence in front, speakers on carts, your own people walking behind because it is genuinely impossible not to, the hex Out-Danced for the last time and by its own consent. Somewhere along the route the sergeant who says she hates it is singing. The Maestra calls the floor at the far gate, formally, on cardstock, and presents the crew's respect, which is not a metaphor: one raid, of your choosing, with the Cadence on your side.",
      { speaker: MAESTRA, priority: "high", timePoints: 1, requires: GATE_PARADE, offer: false, story: { quest: KEY, role: "closer", ending: "parade" },
        memoryText: "The Stewards answered the Cadence with a parade permit; the border performance became a route, and the Cadence's respect is owed.",
        meters: [{ key: "cadenceRespect", set: 1 }, { key: "cadenceUncontested", set: 0 }, { key: "cadenceTribute", set: 0 }],
        receipts: [{ label: "The Maestra's Terms", effectKey: "favorPlus2", acquisition: "earned", source: { name: "Maestra Velvetine Marr, on cardstock" }, truth: "One engagement, full crew, their side of the floor. Produced at any muster it is binding: the Cadence dances where this card says. Morale arrives like weather." }],
        extraFx: { questEffects: [{ action: "complete", questId: Q, beatId: "", state: "completed", text: "A parade is a floor with a direction — the Cadence took the permit as terms; their respect (and one owed cameo) is yours." }], hexModifiers: [{ remove: ["Out-Danced"] }], factionEffects: [{ factionId: "@coalition", moraleDelta: 1, loyaltyDelta: 0, unityDelta: 1, darknessDelta: 0, opDeltas: { culture: 10 }, allowOvercap: false }] } })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoiceFirst = (b, c) => { if (!(b.choices || []).some(x => x.label === c.label || (c.next && x.next === c.next))) b.choices = [c, ...(b.choices || [])]; };
  const addChoice = (b, c) => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; };
  const setMeters = (b, rows) => { b.worldEffects = b.worldEffects || {}; const cur = b.worldEffects.meters || []; for (const r of rows) if (!cur.some(x => x.key === r.key)) cur.push(r); b.worldEffects.meters = cur; };

  edit("cadence_declaration", b => { if (TEMPO) b.speakerActorId = b.speakerActorId || TEMPO; addChoiceFirst(b, ch("Talk to the courier.", "cadence_tempo_at_the_gate")); for (const c of b.choices) if (c.next === "cadence_battle") c.next = "cadence_the_terms"; }, "Tempo speaks; the courier; Accept → the terms");
  edit("cadence_battle", b => { if (MAESTRA) b.speakerActorId = b.speakerActorId || MAESTRA; }, "the Maestra speaks");
  edit("cadence_win_style", b => {
    if (MAESTRA) b.speakerActorId = b.speakerActorId || MAESTRA;
    setMeters(b, [{ key: "cadenceRespect", set: 1 }, { key: "cadenceTribute", set: 0 }, { key: "cadenceUncontested", set: 0 }]);
    b.worldEffects = b.worldEffects || {};
    if (!(b.worldEffects.receipts || []).some(r => r.label === "The Maestra's Terms")) b.worldEffects.receipts = [...(b.worldEffects.receipts || []), { label: "The Maestra's Terms", effectKey: "favorPlus2", acquisition: "earned", source: { name: "Maestra Velvetine Marr, on cardstock" }, truth: "One engagement, full crew, their side of the floor. Produced at any muster it is binding: the Cadence dances where this card says. Morale arrives like weather." }];
    addChoiceFirst(b, ch("Stay for the refreshments.", "cadence_the_drum"));
  }, "the Maestra speaks; THE MAESTRA'S TERMS; respect set; refreshments → the drum");
  edit("cadence_win_ugly", b => { setMeters(b, [{ key: "cadenceRespect", set: 0 }, { key: "cadenceTribute", set: 0 }, { key: "cadenceUncontested", set: 0 }]); }, "meters cleared (the silence is the encore)");
  edit("cadence_lose", b => { if (MAESTRA) b.speakerActorId = b.speakerActorId || MAESTRA; setMeters(b, [{ key: "cadenceTribute", set: 1 }]); addChoiceFirst(b, ch("Stay for the refreshments.", "cadence_the_drum")); }, "the Maestra speaks; tribute set; refreshments → the drum");
  edit("cadence_refuse", b => { setMeters(b, [{ key: "cadenceUncontested", set: 1 }]); }, "uncontested set");
  edit("cadence_rematch", b => { if (TEMPO) b.speakerActorId = b.speakerActorId || TEMPO; }, "Tempo speaks");
  edit("cadence_border_show", b => { if (TEMPO) b.speakerActorId = b.speakerActorId || TEMPO; addChoiceFirst(b, ch("Go up to the viewing mound.", "cadence_viewing_mound")); }, "Tempo speaks; the viewing mound");
  edit("cadence_cameo", b => { if (MAESTRA) b.speakerActorId = b.speakerActorId || MAESTRA; }, "the Maestra speaks");
  edit("cadence_cameo_spent", b => { setMeters(b, [{ key: "cadenceRespect", set: 0 }]); }, "respect spent");
  // REVIEW FIXES 2026-10-01 — reconcile an already-seeded parade (adds missing conditions, never removes one)
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  edit("cadence_parade", b => { ensureReq(b, GATE_PARADE); if (b.dialogueOffer !== false) b.dialogueOffer = false; }, "gated on the mound + the permit; routing-only");

  // REVIEW 2026-10-01 (MEDIUM): receipt-exchange / roll-outcome beats carry speakers (or a high priority) and were gated only on the beat
  // before them, so a conversation or the Director could play them without the receipt or the roll. Routing-only now: the choice's own gate
  // mirrored into inject.requires (added, never removed) + dialogueOffer:false. A route never consults inject.requires, so every authored
  // choice still lands. Keep in sync with tools/patch-template-review-fixes-b-2026-10-01.macro.js.
  const routingOnly = (id, conds, what) => edit(id, b => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; if (b.dialogueOffer !== false) b.dialogueOffer = false; }, what);
  for (const id of ["cadence_tempo_applause", "cadence_tempo_hm"]) routingOnly(id, [P2, { beatMark: "cadence_tempo_at_the_gate" }], "the presence-13 comeback's outcome: routing-only");
  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for cadence not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.giver = "Tempo, herald of the Cadence, at the gate at golden hour, in full sequin, unarmed";
    SCRIPT.steps = [
      { id: "card", label: "A Formal Declaration of Rhythm", line: "A courier in sequins is at the gate with a card. The scent is confidence. Talk to him before you decide; everything he says comes out in four beats.", beats: ["cadence_declaration"] },
      // only the ENTRY beat: listing the roll's success/fail outcomes made NOW pre-pick one (review 2026-10-01); cand() falls back to the routed frontier
      { id: "courier", label: "The Courier", line: "He lettered the card himself. Land a comeback and he applauds twice. Refuse him and he leaves the card anyway; paper is patient.", beats: ["cadence_tempo_at_the_gate"], done: { anyOf: ["cadence_tempo_applause", "cadence_tempo_hm", "cadence_the_terms", "cadence_refuse"] } },
      { id: "terms", label: "The Terms", line: "Let the quartermaster read the card at supper. Culture and Soft Power only. The last line is the frightening one.", beats: ["cadence_the_terms"], done: { anyOf: ["cadence_the_terms", "cadence_refuse", "cadence_battle"] } },
      { id: "floor", label: "The Floor", line: "They build the floor in an hour and arrive exactly on time. Find the pocket of the beat and do not leave it. Nobody draws steel. Nobody.", beats: ["cadence_battle"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly", "cadence_lose", "cadence_parade"] } },
      { id: "rematch", label: "The Rematch", group: "again", line: "Cardstock with the turn, like weather. The tribute stands until you dance.", beats: ["cadence_rematch"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly", "cadence_parade"] } },
      { id: "border", label: "The Border Performance", group: "again", line: "They're performing at breakfast now. A viewing mound has infrastructure. Go up it; Tempo is happier there than anywhere.", beats: ["cadence_border_show"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly", "cadence_parade"] } },
      { id: "mound", label: "The Viewing Mound", group: "again", line: "Refreshments cost a mark and the mark is tribute. If you are carrying a parade permit, this is where it is worth something.", beats: ["cadence_viewing_mound"], done: { anyOf: ["cadence_win_style", "cadence_win_ugly", "cadence_parade"] } }
    ];
    SCRIPT.doors = [
      { id: "collection", label: "The Quartermaster's Collection", line: "There is a cigar box under the manifests that nobody discusses. Every card is in one hand.", beats: ["cadence_collection"] },
      { id: "drum", label: "The Drum", line: "After the floor there are refreshments. Ask the Maestra, with no angle at all, what the drum was for. Her crew will watch you like incoming fire.", beats: ["cadence_the_drum"] },
      { id: "cameo", label: "The Cadence Honors the Floor", line: "The Cadence owes you a raid. Name the target when you need morale like a weather system.", beats: ["cadence_cameo", "cadence_cameo_spent"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "cadence_the_drum", "cadence_cameo"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script cadence → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +drum/cameo)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-cadence-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Cadence retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Cadence retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-cadence-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Cadence retrofit APPLIED: ${changes} change(s). The drum was the army. F5.`);
})();
