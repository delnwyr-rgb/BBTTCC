/* seed-stillwater-v2.macro.js — STILLWATER to the Chuckle Creek template (2026-09-25). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/STILLWATER_SCRIPT_2026_09_25.md (Dave 2026-09-25: "the template WORKS — apply it to the rest"), bible draft 2.
 * Builds ON the 2026-08-18 seeder (seed-stillwater.macro.js) — this one checks the arrival exists.
 *
 *  1. NPC actors + Mal-voice personas with armed secrets: Cal Pruett, May Farrow, Bucky Sorrel, Amos Teague.
 *  2. Seven new beats (lemonade, bandstand, today's paper, the permit, the permit marker, the platform, the waving) with
 *     speakers, checks, story declarations, worldEffects.meters (+1 stillwaterCrack, capped 4) and the Parade Permit
 *     receipt. Existing beats get small edits (names, speakers; rung 2 reconciled to the bible — May SAW DENNY OFF and
 *     holds his unpunched ticket; a hidden 4th choice "Bring the bar down" on the choice beat gated on the permit).
 *  3. The quest's STORY SCRIPT written to campaign.story (Layer 2 data — editable on the Quests tab ✦ Script; wins over
 *     the shipped code script by key). Quest def carries evergreen:true + hex Odaroloc River.d.
 *
 * Idempotent: marker-guarded personas; beats by id (existing edits re-applied only if text differs).
 * Backs up the campaigns setting before writing. F5 afterwards, then run setup-town-hub for "stillwater" once the map exists.
 */
(async () => {
  const DRY_RUN = false;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const Q = "quest_stillwater", KEY = "stillwater", METER = "stillwaterCrack", HEX = "Odaroloc River.d";
  const MARKER = "[STILLWATER-V2-2026-09-25]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  // ── 1. personas ────────────────────────────────────────────────────────────
  const PERSONAS = [
    { name: "Cal Pruett", create: { type: "npc" },
      topics: "the band, the song, Saints, the downbeat, the count, the bar, the bandstand, the parade, the permit, the floats, Main Street, the tuba, the set list, Sunday, Halloween, the town, waving, May Farrow, Bucky, Amos, the paper",
      notes: `${MARKER} PRIVATE TRUTH — Cal Pruett leads the Stillwater town band. On Sunday, October 31, 2077, the Halloween parade, the band was on the pickup into "When the Saints Go Marching In" when the horizon lit, and Cal held the downbeat, and nobody let it fall. He is still on the bandstand with his arm at the top of the beat; the band is mid-bar, cheeks puffed; when his arm twitches the whole kerb waves a little faster. He conducts the town without knowing it. VOICE: courtly, sunburnt, beaming, SO glad you came, "we're just about to" (he never says what). He can talk; the band can't. He can say the title of the song but not the next word of it. "On my count" — there is no count; his arm shakes and he has never noticed. Not a villain — a man who held a beat to keep a street from screaming and never found the bar line. The parade permit (ONE DAY ONLY, expires midnight) is nailed to his bandstand post at eye level; he has not looked at it since. Costume: a bandleader's coat, which is not a costume, which is the joke. Funny first: the tuba player's watering eyes.`,
      secrets: [
        "The Song :: stirThePot :: a Steward asks what the song IS, not why it stopped :: \"'When the Saints.' Oh, when the—\" and the next word doesn't come, and he laughs, and tries again, and it doesn't come.",
        "On My Count :: rollPlus2 :: a Steward asks him to bring the bar down :: \"On my count.\" There is no count. His arm shakes. He has never once noticed that his arm shakes."
      ],
      courtDoor: "they bring the parade permit and ask him to bring the bar down with the town watching — to finish the song, not to stop it" },
    { name: "May Farrow", create: { type: "npc" },
      topics: "the 4:10, the train, the platform, the bench, the clock, her watch, Denny, the ticket, up the line, lemonade, the parade, Sunday, the after, waiting, the schedule, Bucky, the ghostbuster suit",
      notes: `${MARKER} PRIVATE TRUTH — May Farrow is on the platform bench, coat buttoned, hands in her lap, entirely content. She walked her son Denny (nineteen, dressed as a ghostbuster for the parade) down to the station on Sunday, October 31, 2077, to see him off on the 4:10 to his first job up the line. The 4:10 was late. Denny crossed Main Street for a lemonade from Bucky's stand before it came, and the horizon lit while he was in the parade. He is dead. She has his ticket, unpunched, and she checks her watch against the station clock, and the clock agrees with her: it is always almost 4:10. VOICE: warm, unhurried, specific; talks about Denny with the ease of someone expecting to be interrupted by an arrival any second. She cannot perceive the after; the subject slides off. If a Steward SITS on the bench and says nothing until 4:10 she will say "it's late" for the first time in two hundred years, and then "it's never late", and check her watch. Never breaks the bit on her own. Funny first: she has opinions about Bucky's prices.`,
      secrets: [
        "The Ticket :: stirThePot :: a Steward asks what she's HOLDING, not who she's waiting for :: she shows you: one ticket, up the line, unpunched. \"He'll want this. He's just getting a lemonade.\"",
        "The After :: rollPlus2 :: a Steward sits on the bench and says nothing until 4:10 :: it is always almost 4:10. She notices you noticing. \"It's late,\" she says, for the first time in two hundred years, and then, \"it's never late,\" and checks her watch."
      ] },
    { name: "Bucky Sorrel", create: { type: "npc" },
      topics: "lemonade, five cents, the concession, the parade route, buttons, change, the ledger, the cash box, the nickel, the ghostbuster, prices, refunds, the parade, the band, business",
      notes: `${MARKER} PRIVATE TRUTH — Bucky Sorrel, nine, paper hat, runs the lemonade stand on Main Street and, by his own account, the EXCLUSIVE PARADE ROUTE CONCESSION. Five cents. No refunds. He takes whatever you've got ("this is a button," he says of a mark, not unkindly) and gives change in buttons, and keeps a ledger with one page. Ferociously polite; a tycoon. The lemonade was made before the Shattering and is the best thing anyone has tasted since. There is a nickel in his cash box from a customer in a ghostbuster suit (Denny Farrow) who said he'd be right back for his change; Bucky has had it right here for two hundred years and will say so cheerfully. He will tell you the parade has STARTED, it's ON, can't you hear it — and it's true, the band has been holding one chord since you arrived. Funny first, always; he is the comedic engine of the town and should never be made sad on purpose.`,
      secrets: [
        "The Concession :: oppRollMinus2 :: a Steward asks when the parade STARTS :: \"It's started! It's on! Can't you hear it?\" And you realise the band has been holding one chord since you arrived.",
        "The Change :: rollPlus2 :: a Steward asks whose nickel that is :: \"Fella in the ghostbuster suit. He's coming back. I got his change right here.\" He has had it right here for two hundred years."
      ] },
    { name: "Amos Teague", create: { type: "npc" },
      topics: "the Sentinel, the paper, the edition, the headline, ink, the date, today, tomorrow, the press, the parade, the train, the band, news, the after",
      notes: `${MARKER} PRIVATE TRUTH — Amos Teague prints the Stillwater Sentinel and hands it out on the corner with ink to the elbows. One edition: HALLOWEEN PARADE TODAY — BAND TO PLAY 'SAINTS' — FLOATS AT 3, TRAIN AT 4:10 — Sunday, October 31, 2077. The ink is wet. It is always wet. "Never needed a second." VOICE: cheerful, proud, inky, a small-town newspaperman who loves a headline. If a Steward reads him the date off his own front page his face tries to do something and can't: "That's right. That's today." He is the one person in Stillwater who, shown a piece of the AFTER, will SEE it — and age, in a minute, on the kerb, and know everything, and be the only one who does (the seeded rung-3 beat). Until then he does not know that. In the Covenant ending he becomes the interpreter. Costume: a fedora with a PRESS card in the band, which is not a costume, which is the joke.`,
      secrets: [
        "The Date :: rollPlus2 :: a Steward reads him the date off his own front page :: his face does something. Tries to. \"That's right,\" he says. \"That's today.\" He does not look at the paper again while you are there."
      ] }
  ];
  const actorIds = {};
  for (const p of PERSONAS) {
    let actor = (game.actors?.contents || []).find(a => a.name === p.name);
    if (!actor) { say(`✚ CREATE actor "${p.name}"`); changes++; if (!DRY_RUN) actor = await Actor.create({ name: p.name, type: p.create.type }); }
    if (!actor) continue;
    actorIds[p.name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { say(`· ok persona ${p.name}`); continue; }
    const next = { ...cur };
    next.topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    next.notes  = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    if (p.secrets.length) { const raw = String(cur.secretsRaw || ""); const fresh = p.secrets.filter(l => !raw.includes(l.split("::")[0].trim())); if (fresh.length) next.secretsRaw = [raw.trim(), ...fresh].filter(Boolean).join("\n"); }
    if (p.courtDoor && !String(cur.courtDoor || "").trim()) next.courtDoor = p.courtDoor;
    changes++; say(`✚ persona ${p.name} +${p.secrets.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", next);
  }
  const sp = (n) => actorIds[n] || null;

  // ── 2. beats ───────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  if (!byId.get("stillwater_arrival")) return ui.notifications.error("Run seed-stillwater.macro.js (2026-08-18) first — the town has never been seeded.");

  const TAGS = "stillwater grief_refusals story discovery";
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, meters = null, receipts = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, questEffects = null, outcomes = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q, tags: TAGS, politicalTags: "",
    description, outcomes: outcomes || { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority,
    ...(speaker ? { speakerActorId: speaker } : {}),
    ...(story ? { story } : { story: { quest: KEY } }),
    ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(meters ? { meters } : {}), ...(receipts ? { receipts } : {}), ...(questEffects ? { questEffects } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const crack = (n = 1) => [{ key: METER, delta: n, max: 4, min: 0 }];

  const NEW = [
    beat("stillwater_lemonade", "Stillwater — The Lemonade Monopoly",
      "The card table has a hand-lettered sign: LEMONADE 5¢ — EXCLUSIVE PARADE ROUTE CONCESSION — NO REFUNDS. Bucky Sorrel, nine, paper hat, regards you the way a bank regards a loan. You offer a mark. He holds it to the light. \"This is a button,\" he says, not unkindly, and gives you a cup and four buttons change, and writes something in a ledger that has one page. The lemonade is perfect. It is the best thing you have tasted since the Shattering, and it was made before it.",
      { speaker: sp("Bucky Sorrel"), meters: crack(1), choices: [
        ch("\"When does the parade start?\"", "", { checkStat: "mind", checkDC: 12, failNext: "stillwater_lemonade_fail", description: "\"It's started! It's on! Can't you hear it?\" The band has been holding one chord since you arrived." }),
        ch("Haggle.", "", { checkStat: "presence", checkDC: 14, failNext: "stillwater_lemonade_fail", description: "He comes down to four cents and looks at you with new respect." }),
        ch("\"Whose nickel is that?\"", "", { description: "\"Fella in the ghostbuster suit. He's coming back. I got his change right here.\" Ask how long ago." })
      ] }),
    beat("stillwater_bandstand", "Stillwater — The Downbeat",
      "The band is on the bandstand, mid-bar. Cheeks puffed, sticks up, the tuba player's eyes watering with the concentration of it. Above them Cal Pruett, sunburnt and beaming, arm at the very top of the beat. \"So glad you came!\" he says, without lowering it. \"You're just in time. We're just about to.\" He does not say what. Behind him, when his arm twitches, the whole kerb waves a little faster.",
      { speaker: sp("Cal Pruett"), meters: crack(1), choices: [
        ch("\"What's the song?\"", "", { description: "\"'When the Saints.' Oh, when the—\" The next word doesn't come. He laughs and tries again." }),
        ch("\"Bring it down. On your count.\"", "", { checkStat: "mind", checkDC: 12, failNext: "stillwater_bandstand_fail", description: "\"On my count.\" There is no count. You see his arm shake. You see that he doesn't." }),
        ch("Hum the next bar for him.", "", { checkStat: "presence", checkDC: 12, failNext: "stillwater_bandstand_fail", description: "The tuba player's eyes go wide. Something in the chord moves a quarter-tone and settles back. Cal laughs like you've told a joke." })
      ] }),
    // failed-check landings (outcomes.failure is a ROUTE, not prose — lint C05/G02): one line each, then back to the town
    beat("stillwater_lemonade_fail", "Stillwater — The Price Goes Up",
      "The price goes up a button. Bucky writes it in the ledger. The ledger still has one page. \"No refunds,\" he says, kindly, and the lemonade is still perfect.",
      { type: "narration", speaker: sp("Bucky Sorrel"), choices: [ch("Pay the button.", "", { description: "He gives you three buttons change." })] }),
    beat("stillwater_bandstand_fail", "Stillwater — The Town, Politely, Waves",
      "You get it wrong, or he doesn't hear it, or the chord swallows it. Cal beams. \"So glad you came!\" The town, politely, waves. His arm is still up.",
      { type: "narration", speaker: sp("Cal Pruett"), choices: [ch("Wave back.", "", { description: "They wave more." })] }),
    beat("stillwater_paper", "Stillwater — Today's Paper",
      "Amos Teague has a canvas bag and ink to the elbows and hands you the Stillwater Sentinel like it's a gift, which, here, it is. HALLOWEEN PARADE TODAY — BAND TO PLAY 'SAINTS' — FLOATS AT 3, TRAIN AT 4:10. Sunday, October 31, 2077. The ink comes off on your thumb. It is still wet. It is always still wet. \"One edition,\" Amos says proudly. \"Never needed a second.\"",
      { speaker: sp("Amos Teague"), meters: crack(1), choices: [
        ch("Read him the date out loud.", "", { description: "His face does something. Tries to. \"That's right. That's today.\"" }),
        ch("\"What's tomorrow's headline?\"", "", { description: "He laughs. \"Same as today's, I expect.\" He doesn't hear himself." }),
        ch("Keep the paper.", "", { description: "The ink is wet in your pocket. It stays wet. It's a piece of the before; rung three wants a piece of the after." })
      ] }),
    beat("stillwater_platform", "Stillwater — The Platform",
      "One bench. One clock, at 4:08. One board, hand-set letters: ARRIVING — 4:10 — UP THE LINE. The rails run out of town in both directions and stop being rails about a hundred yards out, where the grass has had two hundred years. You check your own watch. It disagrees. The clock does not care. It is 4:08, and it is about to be 4:10, and it has been about to be 4:10 since the horizon lit.",
      { meters: crack(1), choices: [ch("Sit on the bench.", "", { description: "It's a good bench. Somebody is already on it, hands in her lap, and she is glad you came." }), ch("Walk the rails out.", "", { description: "A hundred yards. Then grass. Then the Ynnermire, which has opinions." })] }),
    beat("stillwater_waving", "Stillwater — The Waving",
      "Everybody waves. Not warily, not for advantage, just waving, from porches and kerbs and the tops of floats. You wave back. They wave more. You wave again, and they wave again, and it is genuinely lovely, and then you wave a third time and the third wave comes back slower, from every porch at once, like a town that has just, for a second, remembered something, and that is the only sad thing the kerb will ever do.",
      { meters: crack(1), choices: [ch("Wave once more.", "", { description: "Back to speed. Whatever it was, it's gone. They are so glad you came." })] }),
    beat("stillwater_permit", "Stillwater — The Permit",
      "It's nailed to the bandstand post at eye level, where a permit goes so the sheriff can see it. TOWN OF STILLWATER — PARADE PERMIT — MAIN STREET — SUNDAY OCTOBER 31 2077 — VALID ONE DAY ONLY — EXPIRES MIDNIGHT. Clerk's stamp. Cal's signature, countersigned, big and happy. It is the only thing in Stillwater that admits a day can end, and it has been expired for two hundred years, and nobody has taken it down because nobody has looked at it since.",
      { speaker: sp("Cal Pruett"), requires: { flag: METER, gte: 3 }, choices: [
        ch("Take the permit.", "stillwater_parade_permit"),
        ch("Show Cal the expiry.", "", { description: "He reads it. His arm shakes. \"Well,\" he says. \"Well.\" The permit stays on the post." }),
        ch("Leave it.", "", { description: "Nothing changes. Which is what everyone here has chosen for two hundred years." })
      ] }),
    beat("stillwater_parade_permit", "Stillwater — The Parade Permit",
      "One day only. The clerk's stamp is a little crooked, the way a real stamp is. On the back, in pencil, the band's set list, and Saints is last, and underlined, because it is always last. It is the only piece of paper in Stillwater that knows what midnight is.",
      { type: "narration", priority: "high", meters: crack(1), receipts: [
        { label: "The Parade Permit", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the bandstand post" },
          truth: "Stillwater held a parade on Sunday, October 31, 2077, under a permit valid one day only, expiring midnight. The only thing in town that admits a day can end; the set list on the back has Saints last. Produce it at the bandstand and Cal can bring the bar down with the town's consent — the band finishes the song, which is a funeral hymn, which it always was; produce it to Father Tamsin and he sees a permit for one day of grief left uncashed for two hundred years; the Circuit Riders will accept a dated municipal document as corroboration of the night." }
      ], choices: [ch("Pocket it.", "")] })
  ];
  for (const nb of NEW) {
    const cur = byId.get(nb.id);
    if (cur) { say(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}${nb.inject?.requires ? ` (gated ${METER} ≥ ${nb.inject.requires.gte})` : ""}`);
  }

  // existing-beat edits
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  edit("stillwater_arrival", b => {
    b.speakerActorId = sp("Amos Teague") || b.speakerActorId || null;
    b.story = { quest: KEY, role: "start" };
    if (!/Amos/.test(b.description)) b.description = b.description.replace(/and tomorrow it will say the same\./, "and tomorrow it will say the same. The paper is Amos Teague's; he prints one edition. The kid at the card table is Bucky Sorrel, the lemonade is five cents, and he will tell you it's the exclusive concession. Up Main Street the band is mid-bar. It takes a minute to notice that everyone on the kerb is in costume — mechs, elves, two ghostbusters, a bandleader's coat — and that nobody, anywhere, is treating it as a costume.");
    b.worldEffects = { ...(b.worldEffects || {}), meters: crack(0) };
  }, "Amos + Bucky named, speaker, story start");
  edit("stillwater_crack_1", b => { b.speakerActorId = sp("Bucky Sorrel") || b.speakerActorId || null; }, "Bucky speaks");
  edit("stillwater_crack_2", b => {
    b.speakerActorId = sp("May Farrow") || b.speakerActorId || null;
    if (!/Denny/.test(b.description)) b.description = b.description.replace(/She is waiting for the 4:10, and for her son, who is on it\. She tells you about him/, "Her name is May Farrow. She is waiting for the 4:10, which is her son Denny's train: she walked him down to see him off, and he crossed Main Street for a lemonade before it came, and he'll be right back. She has his ticket. It's unpunched. She tells you about him");
  }, "May + Denny named, the ticket (bible: she saw him off), May speaks");
  edit("stillwater_crack_3", b => {
    b.speakerActorId = sp("Amos Teague") || b.speakerActorId || null;
    if (!/Amos/.test(b.description)) b.description = b.description.replace(/One man looks at the thing in your hand/, "One man — Amos Teague, ink to the elbows, the paper still under his arm — looks at the thing in your hand");
  }, "Amos is the one who sees it");
  edit("stillwater_crack_4", b => { b.speakerActorId = sp("Cal Pruett") || b.speakerActorId || null; }, "Cal speaks");
  edit("stillwater_choice", b => {
    if (!(b.choices || []).some(c => /Bring the bar down/i.test(c.label))) b.choices = [...(b.choices || []), ch("Bring the bar down.", "stillwater_ring_the_bell", { requires: { beatMark: "stillwater_parade_permit" }, description: "Hand Cal the permit. He brings the bar down with the town watching, and the band plays Saints through to the end, which is what that song is for. May stands up during the last chorus." })];
  }, "hidden 4th choice (the permit)");
  for (const [id, ending] of [["stillwater_ring_the_bell", "ring_the_bell"], ["stillwater_covenant", "covenant"], ["stillwater_harvest", "harvest"]]) {
    edit(id, b => { b.story = { quest: KEY, role: "closer", ending }; if (ending === "ring_the_bell") b.worldEffects = { ...(b.worldEffects || {}), meters: [{ key: "wendigoRung", delta: -1, min: 0 }] }; }, `closer · ending ${ending}`);
  }

  // ── 3. the story script (Layer 2 data) ─────────────────────────────────────
  const SCRIPT = {
    quest: { name: "Stillwater", act: 2, keystone: false, evergreen: true, hex: HEX, registryId: Q, chapters: {} },   // evergreen: a grief town never closes with its act
    script: {
      giver: "nobody. A Sunday that doesn't end, and a boy with a lemonade stand",
      description: "Cut grass, percolator coffee, a kid selling lemonade at a card table. People wave, not warily, just waving. The band is mid-bar. It is the most unsettling thing you have felt in a long time, because nothing here is wounded or watching. Everyone is in costume and nobody has mentioned it. Somebody hands you today's paper. Check the date.",
      steps: [
        { id: "arrive", label: "A Sunday That Doesn't End", line: "Exhale first. Somebody hands you today's paper. Check the date.", beats: ["stillwater_arrival"] },
        { id: "lemonade", label: "The Lemonade Monopoly", line: "Five cents, exclusive concession, change in buttons. Ask Bucky when the parade starts.", beats: ["stillwater_lemonade"] },
        { id: "bandstand", label: "The Downbeat", line: "The band is mid-bar and Cal Pruett's arm is up. Ask what the song is. Then ask what the next word is.", beats: ["stillwater_bandstand"] },
        { id: "c1", label: "The Topic Slides Off", line: "It slides off every time. Try it four ways. Then go find the man with the newspapers.", beats: ["stillwater_crack_1"] },
        { id: "paper", label: "Today's Paper", line: "Amos Teague prints one edition. Read him the date out loud and watch his face try.", beats: ["stillwater_paper"] },
        { id: "c2", label: "The Woman at the Station", line: "May Farrow's watch agrees with the station clock. Sit with her till 4:10. It's always almost 4:10.", beats: ["stillwater_crack_2"] },
        { id: "c3", label: "One of Them Sees It", line: "Show Amos a piece of the after. Stay with him while it lands.", beats: ["stillwater_crack_3"] },
        { id: "permit", label: "The Permit", line: "The parade permit is nailed to the bandstand post. Read the small print. One day only.", beats: ["stillwater_permit"], done: { mark: "stillwater_parade_permit" } },
        { id: "c4", label: "The Wall Is Thinning", line: "The bubble is failing on its own schedule. Decide whether anybody gets told first.", beats: ["stillwater_crack_4"] },
        { id: "choice", label: "What You Do With the News", line: "Ring the bell, keep the covenant, or harvest it. You're carrying the news, and the news is the apocalypse.", beats: ["stillwater_choice"], done: { anyOf: ["stillwater_ring_the_bell", "stillwater_covenant", "stillwater_harvest"] } }
      ],
      doors: [
        { id: "lemonade", label: "The Lemonade Stand", line: "Five cents. He takes marks. He gives change in buttons.", beats: ["stillwater_lemonade"] },
        { id: "platform", label: "The Platform", line: "One bench, one clock, one board that says ARRIVING. Check your own watch.", beats: ["stillwater_platform"] },
        { id: "waving", label: "The Waving", line: "Everybody waves. Wave back. See what the third wave does.", beats: ["stillwater_waving"] }
      ],
      after: [], chapters: {}
    }
  };
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const haveData = storyApi?.get?.(campaignId) || {};
  const have = haveData.scripts?.[KEY];
  const questChanged = JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(SCRIPT.quest);
  const scriptChanged = JSON.stringify(have || null) !== JSON.stringify(SCRIPT.script) || questChanged;
  if (scriptChanged) { changes++; say(`✦ story script ${KEY} → campaign.story (${SCRIPT.script.steps.length} steps, ${SCRIPT.script.doors.length} doors, hex ${HEX}, evergreen)`); } else say("· ok story script (already)");

  // ── report / write ─────────────────────────────────────────────────────────
  console.log(`[seed-stillwater-v2] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Stillwater v2 DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Stillwater v2: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-stillwater-v2-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, SCRIPT);
  ui.notifications.info(`Stillwater v2 APPLIED: ${changes} change(s). So glad you came. F5.`);
})();
