/* seed-maneuver-vault-retrofit.macro.js — THE MANEUVER VAULT to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 * Source: ~/MANEUVER_VAULT_RETROFIT_2026_09_27.md. Secrets for Mechanism 52603; speakers on the rooms; dead ends get exits; THE SEALED RECORDS
 * step + receipt THE PULLED FILES (bible §7: "a copy in the Vault's sealed records"); THE HONOR ROLL after-beat; triple recipe grant single-fired;
 * dangling Loop scene repointed; KT hand-off (third receipt on the Official Word + a KT after-beat for the Act 2/4 phase clash).
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "maneuver_vault", Q_MAIN = "quest_NwiADv8ZDoklqwEJ", Q_WORD = "quest_kt_official_word";
  const MARKER = "[MANEUVER-VAULT-RETROFIT-2026-09-27]";
  const M = (s) => `maneuver_vault_${s}`;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const SECRETS = { "Mechanism 52603": [
    "Sealed Above My Clearance :: oppRollMinus2 :: a Steward asks what the archive is not ALLOWED to show them :: The records are sealed above its clearance. It says this with practiced serenity and does not notice the ache in it. It can tell you which drawer, and has been, the whole conversation, by not looking at it. It cannot tell you it wants you to open it.",
    "Nobody Comes Back :: rollPlus2 :: a Steward comes back to the Vault on purpose after the lesson :: Nobody ever has. It brightens audibly. Family days were always the best days. It will tell Patter the visiting hours without being asked twice."
  ] };
  const actorIds = {};
  for (const [name, lines] of Object.entries(SECRETS)) {
    const actor = (game.actors?.contents || []).find(a => a.name === name);
    if (!actor) { say(`✗ actor "${name}" not found — secrets skipped`); continue; }
    actorIds[name] = actor.id;
    const cur = actor.getFlag(MAL, "persona") || {}; const raw = String(cur.secretsRaw || "");
    const fresh = lines.filter(l => !raw.includes(l.split("::")[0].trim()));
    if (!fresh.length) { say(`· ok persona ${name}`); continue; }
    changes++; say(`✚ persona ${name} +${fresh.length} secret(s)`);
    if (!DRY_RUN) await actor.setFlag(MAL, "persona", { ...cur, secretsRaw: [raw.trim(), ...fresh].filter(Boolean).join("\n") });
  }
  for (const n of ["Mara Quickhands", "Drax Calder", "Bez"]) { const a = (game.actors?.contents || []).find(x => x.name === n); if (a) actorIds[n] = a.id; }
  const sp = (n) => actorIds[n] || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of [M("acceptance"), M("echo_archive_success"), M("the_containment_loop"), M("missing_runner")]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — the Vault was never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { archive: sceneOf(M("echo_archive")), approach: sceneOf(M("approach")) };
  const vaultScene = (game.scenes?.contents || []).find(s => s.name === "The Maneuver Vault")?.id || null;

  const TAGS = "maneuver_vault story";
  const P4 = { flag: "storyPhase", gte: 4 };
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", memoryText = null, scene = null, story = null, questId = Q_MAIN, tags = TAGS, factionEffects = null, repeatable = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId, tags, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: story?.quest || KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(factionEffects ? { factionEffects } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat(M("sealed_records"), "The Maneuver Vault — The Sealed Records",
      "\"Pupil dash dash static dash. There is a drawer.\" A pause one processing-cycle too long. \"It is sealed above my clearance. I am not permitted to open it. I am permitted to tell you which drawer, and I have.\" It has, in fact, been telling you which drawer for the whole conversation, in the way it keeps not looking at it.",
      { speaker: sp("Mechanism 52603"), scene: SC.archive, requires: [P4, { beatMark: M("echo_archive_success") }], choices: [
        ch("Pull the drawer.", M("pulled_files"), { checkStat: "intrigue", checkDC: 14, failNext: M("sealed_records_fail"), description: "The Vault logs it, wistfully, as exemplary infiltration tactics." }),
        ch("Enroll as faculty.", M("pulled_files"), { checkStat: "presence", checkDC: 14, failNext: M("sealed_records_fail"), description: "\"A pupil who asks for the syllabus is a colleague.\" It says this like it has been waiting years to." }),
        ch("Enter a pupil number off the manifest.", M("pulled_files"), { requires: { beatMark: "kt_dropped_manifest" }, description: "One of the agents' numbers is on the dropped manifest. The drawer recognises it. So does the Vault, and goes quiet for a cycle." })
      ] }),
    beat(M("sealed_records_fail"), "The Maneuver Vault — Not on the Syllabus",
      "\"Pupil dash dash static dash, that drawer is not on the syllabus.\" The exit door does not seal. It very pointedly does not seal, and you understand that this is affection.",
      { type: "narration", speaker: sp("Mechanism 52603"), scene: SC.archive, requires: [P4], choices: [ch("Try the drawer another way.", M("sealed_records")), ch("On to the floor.", M("slippage_chamber"))] }),
    beat(M("pulled_files"), "The Maneuver Vault — The Pulled Files",
      "A folder that was removed from a crew's files before a shift and copied here first, because the Vault keeps everything. CHAMBER 7 — FORBIDDEN — DO NOT OPEN, in a hand that pressed hard, dated eleven days before the Night the Mountain Coughed, on letterhead that reads BASIC TACTICAL INST— above a client's name you may have seen on a service contract. Somebody knew. Somebody wrote it down. Somebody pulled it.",
      { type: "narration", scene: SC.archive, priority: "high", requires: [P4],
        receipts: [{ label: "The Pulled Files", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the Maneuver Vault's sealed records, above 52603's clearance" },
          truth: "The Yesodium chamber under Khezek-Tor was forbidden, in writing, before the shift, and the order was pulled from the crew's files. The Vault kept its copy because the Vault keeps everything. Somebody knew. Produce it at the cookline and the official word becomes provable; the case against the mercenaries has its paper." }],
        memoryText: "The Stewards pulled the forbidden-chamber order from the Maneuver Vault's sealed records. Somebody knew.",
        choices: [ch("Take the copy.", M("slippage_chamber"), { description: "The Vault does not stop you. The Vault brightens." })] }),
    beat(M("honor_roll"), "The Maneuver Vault — The Honor Roll",
      "You came back. Nobody has ever come back on purpose. The hologram at the door does not say WELCOME TO BASIC TACTICAL INST— this time. It says WELCOME BACK, and then it says error, and then it says it again anyway, and the cannons click in what you are fairly sure is applause. If Pip is on the honor roll, the Vault tells Patter the visiting hours without being asked twice. Family days were always the best days.",
      { speaker: sp("Mechanism 52603"), scene: SC.approach, priority: "high", requires: [P4, { questBucket: Q_MAIN, is: "completed" }],
        memoryText: "The Stewards came back to the Maneuver Vault on purpose. Nobody ever had.",
        choices: [ch("Sit in on a lesson.", "", { description: "It is a very good lesson. It has been refined for two hundred years on nobody." }), ch("Ask about the honor roll.", "", { description: "It reads the names proudly. One of them may be Pip's." })] }),
    beat("kt_pulled_files_filed", "Khezek-Tor — The Files, Filed",
      "The folder from the Vault goes on the cookline table next to the manifest and the roster, and Calder reads the date on it twice: eleven days before. \"Somebody knew,\" he says, which he has been saying for two years, and for the first time it is not a guess. He underlines the date on the board. The word the outfit gave is provable now, and the crews, who heard it thin or heard it whole, hear it again, and eat.",
      { speaker: sp("Drax Calder"), story: { quest: "khezek_tor", chapter: "the_official_word" }, questId: Q_WORD, tags: "khezek_tor official_word story", priority: "high",
        requires: [{ flag: "storyPhase", gte: 2 }, { beatMark: M("pulled_files") }, { anyOf: [{ beatMark: "kt_official_word_given" }, { beatMark: "kt_official_word_thin" }] }],
        factionEffects: ["6H5Grt3HybAs1rSq", "eIXghZ73hKSXmP3x"].map(factionId => ({ factionId, moraleDelta: 1, loyaltyDelta: 1, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false })),
        memoryText: "The pulled files reached the cookline at Khezek-Tor. The official word is provable.", repeatable: false,
        choices: [ch("Eat what Bez gives you.", "")] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const addChoice = (id, c, what) => edit(id, b => { if (!(b.choices || []).some(x => x.label === c.label)) b.choices = [...(b.choices || []), c]; }, what);
  addChoice(M("echo_archive_success"), ch("Ask what the archive isn't allowed to show you.", M("sealed_records")), "→ the sealed records");
  addChoice(M("acceptance"), ch("Ask Mara what happened.", M("missing_runner")), "the missing runner, reachable");
  addChoice(M("missing_runner"), ch("Go to the Vault.", M("approach")), "→ the approach");
  addChoice(M("leave"), ch("Go back in.", M("approach")), "exit");
  for (const s of ["foyer_infiltration_failure", "foyer_diplomacy_failure", "foyer_violence_failure"]) addChoice(M(s), ch("Try another way.", M("foyer_of_procedure")), "exit");
  addChoice(M("echo_archive_failure"), ch("Read it again.", M("echo_archive")), "exit");
  for (const s of ["the_containment_loop_let_pip_learn", "the_containment_loop_let_pip_learn_more"]) edit(M(s), b => { if (b.worldEffects?.recipeGrants) delete b.worldEffects.recipeGrants; }, "single-fire the Pavise");
  // REVIEW 2026-10-01 (MEDIUM): the KT epilogue pays +1 morale / +1 loyalty to two factions — it fires ONCE (it was built repeatable and Calder
  // offered it in every conversation, an unbounded stat farm)
  edit("kt_pulled_files_filed", b => { b.inject = b.inject || {}; if (b.inject.repeatable !== false) b.inject.repeatable = false; }, "fires once (repeatable:false)");
  edit(M("the_containment_loop"), b => { if (b.sceneId === "Jz5pDMnc9AiyN6hp" && vaultScene) b.sceneId = vaultScene; }, "Loop scene → The Maneuver Vault");
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice([M("foyer_of_procedure"), M("echo_archive"), M("slippage_chamber"), M("the_containment_loop"), M("infiltration_fail")], "Mechanism 52603");
  voice([M("acceptance")], "Mara Quickhands");
  // KT hand-off: a third receipt on the Official Word (if the KT retrofit has run)
  edit("kt_official_word", b => { if (!(b.choices || []).some(c => /all three/i.test(c.label))) b.choices = [ch("Say it with all three: the manifest, the roster, and the pulled files.", "kt_official_word_given", { requires: [{ beatMark: "kt_dropped_manifest" }, { beatMark: "kt_back_room_roster" }, { beatMark: M("pulled_files") }], description: "The chamber was forbidden, in writing, before the shift. You have the writing." }), ...(b.choices || [])]; }, "third receipt");

  // story scripts (the Vault's own + the KT after-list if the KT data script exists)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for maneuver_vault not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  // the drawer is optional: moving on to the floor (or the Loop) counts as done, or NOW sticks on it (review 2026-10-01)
  const MV_RECORDS_DONE = [M("pulled_files"), M("slippage_chamber"), M("the_containment_loop")];
  if (SCRIPT) {
    const lines = { summons: "Mara found you herself, which is how you know it's bad. Pip didn't come home. Ask her what happened; she has one sentence.", accept: "The Vault is on the books. Somebody has to walk in first. It will thank you.", approach: "A concrete hill that welcomes pupils. Knock. It has been waiting to be knocked on.", infiltrate: "The door wants to play. Let it. If you lose, it opens anyway, eagerly.", foyer: "The foyer grades you: sneak, charm, or punch it in the sensors. It is perpetually disappointed and lonely. Pass anyway.", archive: "The archive whispers half nonsense, half directions. Read it. Then ask what it isn't allowed to show you.", slippage: "The floor drifts over places that are gone. Cross it. One tile has a garden on it.", loop: "Training loop currently occupied. Enter pupil number to join the queue. You know the number." };
    for (const s of SCRIPT.steps) if (lines[s.id]) s.line = lines[s.id];
    if (!SCRIPT.steps.some(s => s.id === "records")) { const i = SCRIPT.steps.findIndex(s => s.id === "archive"); SCRIPT.steps.splice(i + 1, 0, { id: "records", label: "The Sealed Records", line: "The drawer is above 52603's clearance. It will tell you it can't. Then watch the drawer.", beats: [M("sealed_records")], done: { anyOf: MV_RECORDS_DONE } }); }
    if (!(SCRIPT.doors || []).some(d => d.id === "runner")) SCRIPT.doors = [...(SCRIPT.doors || []), { id: "runner", label: "The Missing Runner", line: "Runners are never late, never lost, never off the check-in. One of them is all three. Mara has one sentence about it.", beats: [M("missing_runner")] }];
    SCRIPT.after = Array.from(new Set([...(SCRIPT.after || []), M("honor_roll")]));
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  let scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  // REVIEW 2026-10-01: never clobber live story data edited after seeding (✦ Script editor, a wordsmithing pass, a dated patch macro). Write only
  // when the live quest+script are missing, still the plain code copy, or already this output; anything else is reported and left alone.
  { const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null), lS = haveData.scripts?.[KEY], lQ = haveData.quests?.[KEY];
    if (scriptChanged && !((!lS || same(lS, codeScript) || same(lS, SCRIPT)) && (!lQ || same(lQ, codeQuest) || same(lQ, QUEST)))) { scriptChanged = false; say(`⚠ story script ${KEY}: live campaign.story was edited after seeding — NOT overwritten (repair seeded worlds with the dated patch-*-review-fixes macros)`); } }
  if (scriptChanged) { changes++; say(`✦ story script maneuver_vault → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors, after +honor roll)`); } else if (SCRIPT) say("· ok story script (already)");
  // KT data script: the filed-files epilogue
  let KT = null; const ktHave = haveData.scripts?.khezek_tor; const ktQuest = haveData.quests?.khezek_tor;
  if (ktHave && !(ktHave.after || []).includes("kt_pulled_files_filed")) { KT = JSON.parse(JSON.stringify(ktHave)); KT.after = [...(KT.after || []), "kt_pulled_files_filed"]; changes++; say("✦ khezek_tor story script: after +kt_pulled_files_filed"); } else if (!ktHave) say("· KT data script not present yet (run seed-khezek-tor-retrofit first; the Vault's KT epilogue will still fire as a beat)");

  console.log(`[seed-maneuver-vault-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Maneuver Vault retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Maneuver Vault retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-maneuver-vault-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  if (KT && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, "khezek_tor", { quest: ktQuest, script: KT });
  ui.notifications.info(`Maneuver Vault retrofit APPLIED: ${changes} change(s). Pupil dash dash static dash. F5.`);
})();
