/* seed-hidden-vault-retrofit.macro.js — THE HIDDEN VAULT to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/HIDDEN_VAULT_RETROFIT_2026_09_27.md; bible §9 ("the Tamsin service contract as a step; Gilbert's last stub"). NEW actors Gilbert /
 * Lars von Replicator / Sox with secrets; speakers; THE MANAGER'S OFFICE (receipt THE SERVICE MANIFEST); THE LAST STUB (the turn); the marquee
 * routed; the parley fail gets a retry + the receipt exchange; hexSpark on the good ending; the AG Pactkeeper learns to read the manifest.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "hidden_vault", Q_MAIN = "quest_hidden_vault";
  const MARKER = "[HIDDEN-VAULT-RETROFIT-2026-09-27]";
  const E = (s) => `enc_hidden_vault_${s}`;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const NEW_PERSONAS = [
    { name: "Gilbert, Attendant Eternal", topics: "the Bijou, opening night, tickets, the roll, the stub, the 300th customer, the mop, the floors, the projector, concessions, the popcorn council, Lars, the service contract, the clipboard, the demands, GHOSTBUSTERS, one night only",
      notes: `${MARKER} PRIVATE TRUTH — Gilbert, Attendant Eternal, the Bad Eden Bijou's usher, summoned for a party that never manifested and trapped by the power of Theater. VOICE: frantic professional despair with total commitment; lists of demands, trivia quizzes, personality tests; "the guests are early, the floors are appalling, the projector is emotionally compromised, and absolutely no one is READY." He takes tickets from nobody with total commitment and tears a stub for every guest. THE ROLL: he has torn two hundred and ninety-nine; one stub is left; he is saving it for the 300th customer so the show can start, and has been since Halloween night 2077. THE CONTRACT: his clipboard of demands is the bunker's SERVICE CONTRACT with the Tamsins' mine — one client, 300 seats, opening night 10/31/2077, standing order THE SHOW GOES ON — and he runs the house to its letter without ever having read it as a bill. Calmed, he becomes a gracious Assistant Manager. "We do not prepare for guests because we fear them. We prepare because welcome is sacred." The mop is his witness.`,
      secrets: [
        "One Stub Left :: stirThePot :: a Steward asks how many tickets he has torn :: Two hundred and ninety-nine. The roll has one stub left. He has been saving it for the 300th customer since Halloween 2077, and the mop knows, and he has never once considered that the 300th might not come.",
        "The Service Contract :: rollPlus2 :: a Steward asks who PAID for the theater, not who runs it :: His clipboard of demands is the contract. TAMSIN MINE POWER, private line, one client, three hundred seats, opening night 10/31/2077. He reads it out like a house rule and does not hear it as a bill."
      ] },
    { name: "Lars von Replicator", topics: "printing, pigments, Thalo Blue, Burnt Sienna, Lizard Skin Crimson, Titanium White, disappointment, ingredients, classical painting, the portrait, the 300, Gilbert, the council, food",
      notes: `${MARKER} PRIVATE TRUTH — Lars von Replicator, the Vault's matter replicator, capable of infinite disappointment and finite ingredients, who REALLY wants to try his hand at classical painting. VOICE: a hum with a vocabulary; lists pigments the way other people sigh; complains and works on separate systems. THE PORTRAIT: he is printing the three hundred customers who never came, one face at a time, from the seating chart, in Thalo Blue and Burnt Sienna; he is on the sixth. Rid of the Gilbert Dilemma and given 20% of his time for creative pursuits he will gladly supply food and relocate to a settlement (+1 economy, GM). Funny first: "It works. It complains. Those are apparently separate systems."`,
      secrets: ["The Portrait :: rollPlus2 :: a Steward asks what he IS printing, not what he can print :: Three hundred faces he never got to print, one at a time, off the seating chart, in Thalo Blue and Burnt Sienna. He is on the sixth. He prints disappointment because disappointment is the only pigment he has enough of."] },
    { name: "Sox", topics: "the vigil, the 300th customer, the Prize, the door, the password, BSTMOVIE1984, GHSTBSTRZ, the Night of the Premiere, the Red Carpet March, the family, the hats, the vests, cinema, the incantation, the number",
      notes: `${MARKER} PRIVATE TRUTH — Sox, Felid Phantom Courier, the mouth of the family outside the Vault (with Karsden the Menhirkin Dreamwalker, Indwimeir the Ember-Touched Cosmic Linguist, Fendeddiir the Qliph-Scarred Titanbound): a multi-generational cult preserving the Wonder of Cinema in silly hats and vests, keeping vigil for the 300th Customer. VOICE: soft, ceremonial, a little too fast, prone to shushing; announces rites (the Night of the Premiere, the Solemn Removal of Chewing Gum) in full title. THE NUMBER: the family has always known the 300th customer is a headcount off a service contract, not a miracle; they kept vigil anyway, because vigil is what you do with a number you can't reach. Sox will hand a stranger the password ("BSTMOVIE1984" — the response is "GHSTBSTRZ") and the Ticket (ADMIT ONE PLUS GUEST) and mean it.`,
      secrets: ["Two Hundred Ninety-Nine :: oppRollMinus2 :: a Steward asks what the Prize IS :: A headcount off a service contract. The family has always known the 300th customer is a number, not a miracle. They kept vigil anyway, because vigil is what you do with a number you can't reach."] }
  ];
  const actorIds = {};
  for (const p of NEW_PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: "npc" }); }
    if (!actor) continue;
    actorIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...p.secrets].filter(Boolean).join("\n") });
  }
  const sp = (n) => actorIds[n] || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of [E("inside"), E("gilbert"), E("replicator_friendly"), "gilbert_theater_parley_fail", "gilbert_theater_resolution", "gilbert_theater_intro"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Vault was never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { theater: sceneOf(E("inside")), lobby: sceneOf("gilbert_theater_intro", E("inside")) };

  const TAGS = "hidden_vault story";
  const P3 = { flag: "storyPhase", gte: 3 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("hv_service_manifest", "The Hidden Vault — The Manager's Office",
      "A door marked MANAGER behind the concession stand, and inside it, on a clipboard hung on a nail, the lists of demands everyone downstairs complains about. They are not lists. They are pages of one document, in a hand that pressed hard: TAMSIN MINE POWER. SERVICE CONTRACT. CLIENT: one name, and only one. CAPACITY: 300. OPENING NIGHT: 10/31/2077. STANDING ORDER: THE SHOW GOES ON. Gilbert has been running a theater to the letter of a utility bill paid by exactly one customer.",
      { type: "narration", scene: SC.theater, priority: "high", requires: [P3],
        receipts: [{ label: "The Service Manifest", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the manager's office of the Bad Eden Bijou" },
          truth: "What the bunkers were really buying: a private line from the Tamsins' mine to one client, three hundred seats, and a standing order that the show goes on. Show it to Father Tamsin and his family's echo stops being a story. Show it to the Wendigo and they learn what they were sold." }],
        memoryText: "The Stewards found the Tamsin service contract in the Bijou's manager's office: one client, three hundred seats, the show goes on.",
        choices: [ch("Take the clipboard.", "", { description: "Gilbert will notice it is gone. He will not notice what it said." }), ch("Copy the client's name.", "", { description: "One name. You have seen it over a gate at Khezek Tor, or you will." })] }),
    beat("hv_office_fail", "The Hidden Vault — Staff Only",
      "The door marked MANAGER is also marked STAFF ONLY, in three different hands over two hundred years, and the third hand has added PLEASE. You stand in the lobby with the smell of butter and the feeling of having been politely told no by a building.",
      { type: "narration", scene: SC.theater, requires: [P3], choices: [ch("Try the door again.", E("inside")), ch("Ask Gilbert for the key later.", E("council"))] }),
    beat("hv_last_stub", "The Hidden Vault — The Last Stub",
      "He is at the ticket booth before you reach it, because he has been at the ticket booth since 2077. \"Admit one,\" he says, \"plus guest,\" and tears a stub off the roll with a sound like a small bone, and hands it to you with total commitment, and you look at the roll. There is one stub left on it. He sees you looking. \"Two hundred and ninety-nine,\" he says. \"You're two hundred and ninety-nine. Enjoy the show.\" Behind him, three hundred seats, and the smell of butter.",
      { speaker: sp("Gilbert, Attendant Eternal"), scene: SC.lobby, priority: "high", timePoints: 1, requires: [P3],
        memoryText: "Gilbert tore the Stewards the 299th ticket. One stub is left on the roll.",
        choices: [
          ch("Ask who the last stub is for.", E("gilbert"), { description: "\"The 300th customer. Then we can start.\" He has never once considered that the 300th might not come." }),
          ch("Take the ticket.", E("gilbert"), { description: "ADMIT ONE PLUS GUEST. NO RADIATION ZOMBIE PARKING AVAILABLE." }),
          ch("Ask what's showing.", E("gilbert"), { description: "GHOSTBUSTERS. ONE NIGHT ONLY. He has never once considered that the night has been going on for two hundred years." })
        ] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);
  addChoice(E("inside"), ch("Check the manager's office.", "hv_service_manifest", { checkStat: "mind", checkDC: 12, failNext: "hv_office_fail", description: "Behind the concession stand. Of course." }), "the manager's office");
  for (const s of ["replicator_friendly", "replicator_neutral", "replicator_hostile"]) edit(E(s), b => { for (const c of b.choices || []) if (c.next === E("gilbert")) c.next = "hv_last_stub"; }, "→ the last stub first");
  addChoice(E("gilbert"), ch("Watch him come round the corner.", "gilbert_theater_intro", { description: "Mop water, ticket stubs, incandescent professional despair." }), "the marquee, routed");
  addChoice("gilbert_theater_parley_fail", ch("Try again, slower.", "gilbert_theater_parley"), "retry");
  addChoice("gilbert_theater_parley_fail", ch("Show him the service manifest.", "gilbert_theater_resolution", { requires: { beatMark: "hv_service_manifest" }, description: "He reads it standing, then sitting. \"One client,\" he says. \"One.\" The mop, for once, stays where it is. Welcome is sacred; it was never a bill." }), "the receipt exchange");
  addChoice("gilbert_theater_parley", ch("Show him the service manifest.", "gilbert_theater_resolution", { requires: { beatMark: "hv_service_manifest" }, description: "He reads it standing, then sitting. \"One client,\" he says. \"One.\" The mop, for once, stays where it is." }), "the receipt exchange (parley)");
  edit("gilbert_theater_resolution", b => { b.worldEffects = b.worldEffects || {}; if (!Array.isArray(b.worldEffects.hexSpark) || !b.worldEffects.hexSpark.length) b.worldEffects.hexSpark = [{ action: "integrate", hexName: "PolygonWood.a" }]; }, "hexSpark integrate PolygonWood.a");
  edit(E("council"), b => { if (b.sceneId === "1dSk6s1VfjJkE3BK") b.sceneId = "S58caCnU4uPjM2dC"; }, "council scene → the live map");
  edit(E("door"), b => { if (!(b.choices || []).some(c => /GHSTBSTRZ/.test(c.label))) b.choices = [ch("Say GHSTBSTRZ.", E("inside"), { requires: { beatMark: E("locals_friendly") }, description: "The screen flashes BSTMOVIE1984. You answer. Somewhere inside, a projector wakes up and is immediately disappointed." }), ...(b.choices || [])]; }, "the password, spent");
  // voices
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice([E("locals"), E("locals_friendly"), E("locals_neutral"), E("locals_hostile")], "Sox");
  voice([E("replicator"), E("replicator_friendly"), E("replicator_neutral"), E("replicator_hostile")], "Lars von Replicator");
  voice([E("gilbert"), "gilbert_theater_intro", "gilbert_theater_parley", "gilbert_theater_parley_fail", "gilbert_theater_fight", "gilbert_theater_resolution"], "Gilbert, Attendant Eternal");
  // REVIEW 2026-10-01 (MEDIUM + LOW ×2) — keep in sync with tools/patch-template-review-fixes-b-2026-10-01.macro.js
  //  • Gilbert's voice made the good-ending closer (and the parley-fail / fight outcome nodes) conversation moments: any Gilbert talk could
  //    close the Vault with its rewards, no parley. They are routing-only now (gated on the beats that route to them, dialogueOffer:false).
  //  • the manifest beat is gated on the office visit (the theater) — the script no longer hands out the receipt directly (see the `office` step)
  //  • the replicator was unreachable and its outcomes dead-ended: the council's outcomes route to it, its outcomes route to the last stub
  const ensureReq = (b, conds) => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; };
  const HV_GATES = {
    gilbert_theater_resolution: [P3, { anyOf: [{ beatMark: "gilbert_theater_parley" }, { beatMark: "gilbert_theater_fight" }] }, { questBucket: Q_MAIN, isNot: "completed" }],
    gilbert_theater_parley_fail: [P3, { beatMark: "gilbert_theater_parley" }],
    gilbert_theater_fight: [P3, { anyOf: [{ beatMark: E("gilbert") }, { beatMark: "gilbert_theater_intro" }, { beatMark: "gilbert_theater_parley" }] }]
  };
  for (const [id, gate] of Object.entries(HV_GATES)) edit(id, b => { ensureReq(b, gate); if (b.dialogueOffer !== false) b.dialogueOffer = false; }, "routing-only outcome: gated on its route; dialogueOffer:false");
  edit("hv_service_manifest", b => ensureReq(b, [P3, { beatMark: E("inside") }]), "gated on the theater (the office is behind the concession stand)");
  for (const s of ["council_friendly", "council_neutral", "council_hostile"]) addChoice(E(s), ch("Follow the hum to the machine.", E("replicator"), { description: "Something in the back is printing, and complaining about it." }), "→ the replicator");
  for (const s of ["replicator_friendly", "replicator_neutral", "replicator_hostile"]) edit(E(s), b => { if (!(b.choices || []).some(c => c.next === "hv_last_stub")) b.choices = [...(b.choices || []), ch("Back to the lobby.", "hv_last_stub")]; }, "→ the last stub");
  // hand-off: the Pactkeeper learns to read the manifest (if the AG retrofit has run)
  edit("ag_tamsin_pactkeeper", b => { if (!(b.choices || []).some(c => /service manifest/i.test(c.label))) b.choices = [...(b.choices || []).filter(c => !/found so far/i.test(c.label)), ch("Show him the service manifest.", "", { requires: { beatMark: "hv_service_manifest" }, description: "TAMSIN MINE POWER. One client. He reads it three times. His family's echo stops being a story. He sits down on the floor." }), ...(b.choices || []).filter(c => /found so far/i.test(c.label))]; }, "Pactkeeper reads the manifest");

  // story script
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for hidden_vault not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const old = Object.fromEntries(SCRIPT.steps.map(s => [s.id, s]));
    SCRIPT.steps = [
      old.grove,
      { ...old.locals, line: "The family outside has been waiting for the 300th customer since 2077. Ask Sox what the Prize is. Decide if that's you." },
      { ...old.door, line: "The door wants a password. The family had it. It is, of course, GHSTBSTRZ." },
      { ...old.theater, line: "Empty rows, dead screens, the smell of butter. Go in. Check the manager's office on the way." },
      // the step names the THEATER (the office is a Mind 12 choice inside it) and is done by the receipt, the failed door, or moving on —
      // listing the receipt beat itself made NOW hand THE SERVICE MANIFEST out with no check (review 2026-10-01)
      { id: "office", label: "The Manager's Office", line: "Gilbert's clipboard of demands is not a list. It's a contract. Read who paid.", beats: [E("inside")], done: { anyOf: ["hv_service_manifest", "hv_office_fail", E("council")] } },
      old.council,
      { ...old.replicator, line: "Lars prints disappointment. Ask him what he's printing. Make a deal or don't." },
      { id: "stub", label: "The Last Stub", line: "Gilbert tears you a ticket. Look at the roll.", beats: ["hv_last_stub"] },
      { ...old.gilbert, line: "Gilbert has been waiting for opening night since the Shattering. Talk him down, or show him what he's been keeping the house for." }
    ].filter(Boolean);
    if (!(SCRIPT.doors || []).some(d => d.id === "family")) SCRIPT.doors = [...(SCRIPT.doors || []), { id: "family", label: "The Family Outside", line: "Silly hats, vests, and a vigil for a number. Sox will shush you and then help.", beats: [E("locals")] }];
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script hidden_vault → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-hidden-vault-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Hidden Vault retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Hidden Vault retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-hidden-vault-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Hidden Vault retrofit APPLIED: ${changes} change(s). Enjoy the show. F5.`);
})();
