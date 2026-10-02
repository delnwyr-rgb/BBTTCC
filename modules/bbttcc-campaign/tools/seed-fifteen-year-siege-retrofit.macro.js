/* seed-fifteen-year-siege-retrofit.macro.js — THE FIFTEEN-YEAR SIEGE to the Chuckle Creek template (2026-09-30). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/FIFTEEN_YEAR_SIEGE_RETROFIT_2026_09_30.md; the commanders' own personas (THE TEA, YEAR ZERO, THE LEDGER — seeded 07-13, never
 * played as beats). NEW actor Dilly Marsh (the market's opinion; the biscuit tin on the trench's account). New beats: THE PIE TALLY, THE CULVERT
 * GATE (the turn — Thursday tea, no terms, the Steward is the first witness) + sit/fail, YEAR ZERO (receipt THE YEAR-ZERO ENTRY; spends
 * THE CLAUSE from the Gift), THE THURSDAY CLAUSE (hidden route to Mediate), the school bell door, THE FIRST PUBLIC THURSDAY after.
 * Armed secrets on Pell / Alderwick. Idempotent; backs up the campaigns setting.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "fifteen_year_siege", Q = "quest_fifteen_year_siege";
  const MARKER = "[SIEGE-RETROFIT-2026-09-30]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const actors = game.actors?.contents || [];

  // ── 1. cast ────────────────────────────────────────────────────────────────
  const DILLY = { name: "Dilly Marsh", topics: "meat pies, the market, both sides, credit, the biscuit tin, Thursdays, oranges, the school bell, what the market thinks",
    notes: `${MARKER} PRIVATE TRUTH — Dilly Marsh sells meat pies on both sides of the oldest siege in the world, trench Thursdays and wall Thursdays alternating, and has done since she was nine and the stall was her mother's. She keeps a tally: who buys, on whose account, how many. VOICE: fast, cheerful, counting under everything; talks to the trench and the wall in exactly the same voice, which is the whole point of her. WHAT SHE KNOWS: one tin of biscuits every Thursday on the trench's account and a quarter of tea on the wall's, same stall, same afternoon, fifteen years less two, and where the culvert gate is. She has never said so. She thinks everybody knows and nobody says, which is the town's whole religion. WHAT THE MARKET THINKS (if asked plainly): nobody wants it to END. They want it to stop being a SECRET. YEAR ZERO: before her time; her gran sold oranges once, exactly once, and never again, and never said why. TELLS: gives the trench's change in wall coin and the wall's in trench coin, on purpose; counts on her fingers when she is lying, which is never about pies.`,
    secrets: [
      "The Biscuit Order :: rollPlus2 :: a Steward buys a second pie and asks who else buys on credit :: One tin of biscuits, Thursdays, on the trench's account; a quarter of tea, Thursdays, on the wall's; same stall, same hour, since the walkout year. She has never once said it aloud. She says it now, counting on her fingers.",
      "What the Market Thinks :: favorPlus1 :: a Steward asks the market's opinion instead of the commanders' :: Nobody wants it to end. They want it to stop being a secret. The market has been waiting fifteen years for someone to ask."
    ] };
  const ARM = {
    "Commander Ostrid Pell": { secrets: [
      "The Tea :: favorPlus1 :: someone both commanders have come to trust, or who has plainly worked it out, says the word Thursday :: Every Thursday after market close, in the old culvert gate between the lines, he takes tea with Warden Alderwick. Fifteen years less two. They have never once discussed terms. That is the rule. It has not occurred to him that the rule is the treaty.",
      "Year Zero :: rollPlus2 :: the tea is known and a Steward asks about the basket :: He carried it himself, a junior officer: oranges, and paperwork under the ribbon he was ordered not to read. In his locked drawer, one orange dried to the size and weight of a question. He is not afraid of remembering. He is afraid it was small."
    ] },
    "Warden Bee Alderwick": { secrets: [
      "The Tea :: favorPlus1 :: someone both commanders have come to trust, or who has plainly worked it out, says the word Thursday :: Her kettle, his biscuits since the walkout year, the culvert gate, no terms. She has protected him from exposure for fifteen years and never wondered what she was protecting on her side, because the answer is nothing, and the secret is simply theirs.",
      "The Ledger :: rollPlus2 :: the tea is known and a Steward asks what her grandmother wrote :: The day-ledger's last entry, in a hand pressed hard enough to tear: Refused the basket at the gate. Paperwork under the ribbon — GIFT-DEBT, the old kind. Better besieged than beholden. Her grandmother READ it first. Bee has decided every morning since that she was right."
    ] }
  };
  const actorIds = {};
  let dilly = actors.find(a => a.name === DILLY.name);
  if (!dilly) { say(`✚ CREATE actor "${DILLY.name}"`); changes++; if (!DRY_RUN) dilly = await Actor.create({ name: DILLY.name, type: "npc" }); }
  if (dilly) { actorIds.dilly = dilly.id; const cur = dilly.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona Dilly Marsh +2 secrets"); if (!DRY_RUN) await dilly.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), DILLY.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), DILLY.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...DILLY.secrets].filter(Boolean).join("\n") }); } else say("· ok persona Dilly Marsh"); }
  for (const [name, arm] of Object.entries(ARM)) {
    const a = actors.find(x => x.name === name); if (!a) { say(`✗ actor "${name}" not found — secrets skipped`); continue; }
    actorIds[name] = a.id; const cur = a.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    if (raw.includes(MARKER)) { say(`· ok secrets ${name}`); continue; }
    changes++; say(`✚ secrets ${name} +${arm.secrets.length}`);
    if (!DRY_RUN) await a.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), `${MARKER}`, ...arm.secrets].filter(Boolean).join("\n") });
  }
  const PELL = actorIds["Commander Ostrid Pell"] || null, BEE = actorIds["Warden Bee Alderwick"] || null, DIL = actorIds.dilly || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["siege_market_day", "siege_commander_camp", "siege_commander_town", "siege_doors", "siege_mediate", "siege_charter"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Siege was never seeded here.`);

  const TAGS = "fifteen_year_siege story";
  const P3 = { flag: "storyPhase", gte: 3 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, story = null, repeatable = false } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("siege_pie_tally", "Market Day — The Pie Tally",
      "Dilly Marsh has sold meat pies on both sides of this siege since she was nine, trench Thursdays and wall Thursdays alternating, and she keeps a tally in a book that is fatter than either commander's. Who buys. On whose account. How many. She gives the trench its change in wall coin and the wall its change in trench coin, on purpose, and nobody has said a word about it in fifteen years, because saying things is not what this town does. \"Second pie's cheaper,\" she says. \"Everybody's is.\"",
      { speaker: DIL, requires: [P3, { beatMark: "siege_market_day" }], choices: [
        ch("Buy a second pie and ask who else buys on credit.", "", { description: "She counts on her fingers, which she only does when it isn't about pies. \"One tin of biscuits, Thursdays, trench's account. Quarter of tea, Thursdays, wall's. Same stall. Same hour. Since the walkout year.\" She has never said it aloud before. She looks surprised at herself." }),
        ch("Ask what the market thinks.", "", { description: "\"Nobody wants it to END,\" she says, as if you'd asked whether water was wet. \"They want it to stop being a SECRET.\" Behind her, the whole market has gone slightly quieter, in the way of a room that has waited fifteen years for somebody to ask." }),
        ch("Ask about Year Zero.", "", { description: "\"Before my time. My gran sold oranges once, though.\" A pause exactly the length of an orange. \"Once.\"" })
      ] }),
    beat("siege_culvert_gate", "Thursday — The Culvert Gate",
      "Market close. The stalls fold. The bell in the counterweight tower rings the truce out, and if you follow the biscuit tin instead of the crowd it leads down, between the lines, to an old culvert gate with a kettle in it. Warden Alderwick has the kettle. Commander Pell has the tin. There is a third chair, which has never been sat in, and which they have never moved. They see you at the same moment. Fifteen years of the most careful institution on the coast holds its breath, and the kettle, unforgivably, starts to sing.",
      { speaker: BEE, priority: "high", timePoints: 1, requires: [P3, { beatMark: "siege_pie_tally" }, { beatMark: "siege_commander_camp" }, { beatMark: "siege_commander_town" }],
        memoryText: "The Stewards found the commanders of the Fifteen-Year Siege at their Thursday tea in the culvert gate, and were the first witnesses in fifteen years.",
        choices: [
          ch("Sit down in the third chair.", "siege_culvert_sit", { checkStat: "presence", checkDC: 13, failNext: "siege_culvert_fail", description: "You do not ask. Asking would be terms." }),
          ch("Stand in the doorway and say nothing.", "", { description: "They finish the pot. They discuss the drainage, the children, the weather coming off the sea. Nobody says terms. When the pot is empty the Warden rinses three cups, and you understand that you are now part of the Thursday, and that this was a decision." }),
          ch("Back out before they finish looking.", "", { description: "You'll be back. It's Thursday every week; that's the institution." })
        ] }),
    beat("siege_culvert_sit", "The Culvert Gate — The Third Chair",
      "Pell pours. He does it without looking at you, the way you'd pour for family. \"The rule,\" he says, to the kettle, \"is no terms.\" Alderwick: \"Fifteen years less two.\" Pell: \"The walkout year.\" Alderwick: \"He came back with biscuits.\" Pell: \"I did not explain.\" Alderwick: \"He has not explained since.\" They have said this before, to each other, every Thursday, and it is a liturgy, and you are the first congregation. Neither of them has noticed that this is the whole treaty already, unsigned, with biscuits. You notice.",
      { speaker: PELL, requires: [P3, { beatMark: "siege_culvert_gate" }], choices: [
        ch("Ask about the basket.", "siege_year_zero", { description: "Both cups stop halfway. \"Which basket,\" says Pell, who knows exactly which basket." }),
        ch("Ask about the drainage.", "", { description: "Forty minutes. Genuinely fascinating. He has drawings. She corrects one of them and he lets her." }),
        ch("Say it: this is the treaty.", "", { description: "The silence has biscuits in it. \"That,\" says Alderwick eventually, \"would be a term.\" And pours you another." })
      ] }),
    beat("siege_culvert_fail", "The Culvert Gate — The Wrong Chair",
      "You sit, and it is the wrong chair; it is the tin's chair, and Pell moves the tin with a courtesy that would stop a cavalry charge, and for one hour you are told about trench drainage in a level of detail that constitutes a defensive work. No terms are discussed. No year zero is mentioned. At the end the Warden rinses two cups and hands you the third to rinse yourself, which is either an insult or an initiation, and in this town it is both.",
      { speaker: BEE, requires: [P3, { beatMark: "siege_culvert_gate" }], choices: [
        ch("Come back next Thursday.", "", { description: "There is always a next Thursday. That is the institution." }),
        ch("Ask about the basket anyway.", "siege_year_zero", { description: "Pell's hand goes to his coat, where the drawer key is." })
      ] }),
    beat("siege_year_zero", "Year Zero — The Basket at the Gate",
      "Pell tells it to the kettle. A junior officer, an enormous basket, oranges from somewhere no orange should have survived, and paperwork under the ribbon he was ordered not to read. The Warden's grandmother refused it at the gate. The siege began before the basket finished rotting. He has one orange left, in a locked drawer, dried to the size and weight of a question. Alderwick says nothing for a long time and then recites, without breathing, the day-ledger's last entry in her grandmother's hand: Refused the basket at the gate. Paperwork under the ribbon, GIFT-DEBT, the old kind, the kind you don't climb out of. Better besieged than beholden. \"She read it first,\" Alderwick says. \"She knew exactly what it would cost. She chose this. On purpose.\" Pell looks at the orange he is not holding. \"I never read it. I have been grateful for fifteen years that I never read it.\"",
      { speaker: PELL, priority: "high", requires: [P3, { beatMark: "siege_culvert_gate" }],
        memoryText: "Year zero of the Siege: a gift basket with a gift-debt clause under the ribbon, refused at the gate by a warden who read it first.",
        receipts: [{ label: "The Year-Zero Entry", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Warden Alderwick's grandmother's day-ledger" }, truth: "Refused the basket at the gate. Paperwork under the ribbon — GIFT-DEBT, the old kind. Better besieged than beholden. The only documented refusal of paper like this in living memory, and the reason a fifteen-year siege exists. Lay it beside the Gift's clause and the hand is the same." }],
        choices: [
          ch("Lay the Gift's clause beside the entry.", "", { requires: { beatMark: "trojan_paperwork" }, description: "Same paper. Same language. The signature that will not be read, and the hand pressed hard enough to tear, fifteen years apart on the same table. Alderwick puts her cup down very carefully. \"Then it wasn't pride,\" she says. \"It was the same sender.\" Pell says nothing, because the orange in his drawer has just become evidence." }),
          ch("Read the entry aloud to them both.", "", { description: "You are the first person to say it out loud in fifteen years who is not the Warden's grandmother. Pell stands up for it. Nobody knows why." }),
          ch("Back to the market. It's still Thursday.", "")
        ] }),
    beat("siege_thursday_clause", "The Treaty Is One Line Long",
      "You say it in the culvert gate, with the kettle on: the treaty already exists. It has a rule and a day and biscuits. All it needs is to be written down, once, in one line, and witnessed, which you have already done. Alderwick looks at Pell. Pell looks at the tin. \"Thursdays,\" he says, \"as before.\" She writes it. That is the whole clause. The nine days and four drafts that follow are for the notary.",
      { speaker: BEE, requires: [P3, { beatMark: "siege_culvert_gate" }], choices: [ch("Take it to the table.", "siege_mediate")] }),
    beat("siege_school_bell", "The Counterweight Tower — The School Bell",
      "The tower that would drop the counterweight has a school in it, and the school has a bell, and the bell rings the market truce at nine and out at four, and the children ring it, in a rota, and the rota is the most fought-over document in the siege. Today it is a girl of eight with a serious face who tells you the bell has never been late, and that if it were the whole war would stop, and that she has thought about it.",
      { requires: [P3, { beatMark: "siege_market_day" }], repeatable: true, choices: [
        ch("Ask to ring it.", "", { description: "\"No.\" She is right." }),
        ch("Ask what she'd do if it stopped.", "", { description: "\"Everyone would have to talk.\" She says it the way you'd say the sea would come in." })
      ] }),
    beat("siege_first_public_thursday", "The First Public Thursday",
      "The Thursday after, the tin and the kettle are on the wall, in the market, at the stall, in daylight, and the whole coast pretends it is not the biggest news of the decade. Dilly Marsh charges them both trench prices and wall prices and gives the change back in the wrong coin, and the third chair is there, and it is yours, and nobody says terms, because the rule stands. The siege, or the festival, or the garden, or whatever it is now, continues. Thursdays, as before.",
      { speaker: DIL, requires: [P3, { questBucket: Q, is: "completed" }],
        memoryText: "The commanders of the Fifteen-Year Siege took their tea in public for the first time; the third chair is the Stewards'.",
        choices: [ch("Sit down.", "", { description: "The pie is cheaper the second time. Everybody's is." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  // the third pie goes to Dilly
  edit("siege_market_day", b => {
    const c = (b.choices || []).find(x => /another meat pie/i.test(x.label)); if (c && !c.next) { c.next = "siege_pie_tally"; c.label = "Buy another meat pie and ask the pie-seller what the market thinks"; }
    if (!(b.choices || []).some(x => x.next === "siege_school_bell")) b.choices = [...(b.choices || []), ch("Climb the counterweight tower (the school bell)", "siege_school_bell")];
  }, "third choice → the Pie Tally; school bell door");
  // both commanders can be asked about Thursdays, once the market has talked
  for (const id of ["siege_commander_camp", "siege_commander_town"]) edit(id, b => {
    if (!(b.choices || []).some(x => x.next === "siege_culvert_gate")) b.choices = [ch("Say the word Thursday and watch what happens to the teacup.", "siege_culvert_gate", { requires: { beatMark: "siege_pie_tally" }, description: "The cup stops. \"Market close,\" is all that is said, and it is said to the cup." }), ...(b.choices || [])];
  }, "hidden route to the Culvert Gate");
  // the doors beat learns the one-line treaty
  edit("siege_doors", b => {
    if (!(b.choices || []).some(x => x.next === "siege_thursday_clause")) b.choices = [ch("Say it: the treaty already exists. Write it down.", "siege_thursday_clause", { requires: { beatMark: "siege_culvert_gate" }, description: "Thursdays, as before." }), ...(b.choices || [])];
  }, "hidden fifth way: the Thursday clause");
  // voices on the endings
  for (const [id, sp] of [["siege_mediate", BEE], ["siege_charter", PELL], ["siege_join", PELL], ["siege_break", BEE]]) edit(id, b => { if (!b.speakerActorId && sp) b.speakerActorId = sp; }, "speaker");

  // REVIEW 2026-10-01 (MEDIUM): receipt-exchange / roll-outcome beats carry speakers (or a high priority) and were gated only on the beat
  // before them, so a conversation or the Director could play them without the receipt or the roll. Routing-only now: the choice's own gate
  // mirrored into inject.requires (added, never removed) + dialogueOffer:false. A route never consults inject.requires, so every authored
  // choice still lands. Keep in sync with tools/patch-template-review-fixes-b-2026-10-01.macro.js.
  const routingOnly = (id, conds, what) => edit(id, b => { b.inject = b.inject || {}; const cur = Array.isArray(b.inject.requires) ? b.inject.requires.slice() : (b.inject.requires && typeof b.inject.requires === "object" ? [b.inject.requires] : []); const have = new Set(cur.map(c => JSON.stringify(c))); for (const c of conds) if (!have.has(JSON.stringify(c))) { cur.push(c); have.add(JSON.stringify(c)); } b.inject.requires = cur; if (b.dialogueOffer !== false) b.dialogueOffer = false; }, what);
  for (const id of ["siege_culvert_sit", "siege_culvert_fail"]) routingOnly(id, [P3, { beatMark: "siege_culvert_gate" }], "the presence-13 chair's outcome: routing-only");
  // ── 3. story script ────────────────────────────────────────────────────────
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for fifteen_year_siege not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    SCRIPT.giver = "A Thursday. Market day at the oldest siege still manned. The pie-seller knows more than either commander.";
    SCRIPT.steps = [
      { id: "market", label: "Market Day", line: "It's Thursday. Buy a meat pie and take in the oldest siege in the world. Then buy a second one; everybody's is cheaper.", beats: ["siege_market_day"] },
      { id: "pies", label: "The Pie Tally", line: "Dilly Marsh sells to both sides and keeps a book fatter than the commanders'. Ask who buys on credit. Ask what the market thinks.", beats: ["siege_pie_tally"] },
      { id: "commanders", label: "Both Commanders", line: "Pell in the trench, Alderwick on the wall. Hear both. Say the word Thursday to each and watch the teacup.", beats: ["siege_commander_camp", "siege_commander_town"], done: { allOf: ["siege_commander_camp", "siege_commander_town"] } },
      { id: "gate", label: "The Culvert Gate", line: "Market close. Follow the biscuit tin, not the crowd. There is a third chair. It has never been sat in. Do not ask; asking would be terms.", beats: ["siege_culvert_gate", "siege_culvert_sit", "siege_culvert_fail"], done: { mark: "siege_culvert_gate" } },
      { id: "year_zero", label: "Year Zero", line: "Ask about the basket. He carried it. Her grandmother read what was under the ribbon and chose the siege on purpose. Bring the Gift's clause if you have it.", beats: ["siege_year_zero"], done: { mark: "siege_year_zero" } },
      { id: "doors", label: "Ending the Siege", line: "It could end. Four ways, and a fifth if you were at the tea: the treaty is already one line long.", beats: ["siege_doors"], done: { quest: KEY } }
    ];
    SCRIPT.doors = [
      { id: "bell", label: "The School Bell", line: "The counterweight tower has a school in it and the school has a bell and the bell has never been late. Ask the girl what would happen if it were.", beats: ["siege_school_bell"] }
    ];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), "siege_first_public_thursday"]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script fifteen_year_siege → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-fifteen-year-siege-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Fifteen-Year Siege retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Fifteen-Year Siege retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-siege-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Fifteen-Year Siege retrofit APPLIED: ${changes} change(s). Thursdays, as before. F5.`);
})();
