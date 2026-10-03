/* patch-fixit-early-alliance-2026-10-02.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * OWNER RULING 2026-10-02 (option 3) — an EARLIER way to earn the Jackalope alliance at Furrier's Fixit Farm. Until now the only
 * source was the Vault rescue closers (patch-vault-allies), which also complete the Vault, so the pre-Vault Route Board (allied hard
 * gate, patch-template-review-fixes-c) could never be reached. THE LATE RUN (~/FIXIT_EARLY_ALLIANCE_2026_10_02.md): Mara asks the
 * Stewards to carry Uncle Thistle to his own wake exactly late enough. Repairs the ALREADY-SEEDED live campaign the same way
 * seed-fixit-retrofit now seeds a fresh world. Run AFTER patch-vault-allies and patch-template-review-fixes-c-2026-10-02.
 *
 *  BEATS (added if missing; an existing one keeps its text — gates / routing-only flag / allied rows are made whole, additively)
 *   • fixit_late_run_offer    — Mara at the Counter (Acts 2–3, after her Counter conversation, Vault unfinished, once-only)
 *   • fixit_late_run_road     — Patter keeps time; Body or Presence DC 12 → success / fail   (routing-only)
 *   • fixit_late_run_success  — "Allies." coalition ↔ Jackalopes ALLIED (the patch-vault-allies row shape) + receipt THE LATE PEG (routing-only)
 *   • fixit_late_run_fail     — on time, horribly; no alliance                                (routing-only)
 *   • fixit_late_run_declined — Pip takes it ("I'm always on time")                           (routing-only)
 *  STORY SCRIPT (campaign.story, edited IN PLACE — `after`, doors and wordsmithed lines kept)
 *   • fixit_farm: step "laterun" inserted after the MYSTERY Bin (act 3 → it seals once Act 4 opens)
 *  The Vault closers are NOT touched: setStatus is absolute, so their allied rows on an already-allied coalition write allied → allied.
 *
 * Idempotent: a second APPLY reports 0 changes.
 *
 * HOW TO RUN: 1) hard-reload; 2) run as-is (DRY_RUN = true) → read the console (F12) report; 3) set DRY_RUN = false, run again
 *   (a backup-campaigns-before-fixit-early-alliance-<ts>.json downloads first); 4) F5. Then export a fresh bundle and run
 *   `bin/ft-lint-campaign <bundle>` and `bin/ft-replay-story <export> --act=6`.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["fixit_general_store_coversation", "fixit_backstairs_exterior", "fixit_mystery_bin"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — run seed-fixit-retrofit (not this patch) on this world.`);

  // ── helpers (same as patch -c / the seeder) ───────────────────────────────
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  const reqsOf = (x) => Array.isArray(x) ? x : (x && typeof x === "object" ? [x] : []);

  // ── constants + builders — VERBATIM from seed-fixit-retrofit ──────────────
  const KEY = "fixit_farm", Q_MAIN = "quest_nrkJabUwZOLAJFYn", Q_VAULT = "quest_NwiADv8ZDoklqwEJ";
  const P2 = { flag: "storyPhase", gte: 2 };
  const TAGS = "fixit_farm story";
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, fx = null, dialogueOffer = null, story = null, requires = null, timePoints = 0, priority = "background", memoryText = null, scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: story || { quest: KEY }, ...(memoryText ? { memoryText } : {}), ...(dialogueOffer === false ? { dialogueOffer: false } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}), ...(fx || {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const LATE_RUN_IDS = ["fixit_late_run_offer", "fixit_late_run_road", "fixit_late_run_success", "fixit_late_run_fail", "fixit_late_run_declined"];
  const LATE_RUN_STEP = { id: "laterun", label: "The Late Run", act: 3, line: "Uncle Thistle was late to everything, including his birth. He's due at his own wake at dusk. No runner will make him late. You are not runners.", beats: ["fixit_late_run_offer", "fixit_late_run_road"], done: { anyOf: ["fixit_late_run_success", "fixit_late_run_fail", "fixit_late_run_declined"] } };
  function LATE_RUN_BEATS({ beat, ch, P2, SC, mara, patter, JACKALOPES, Q_VAULT }) {
    const A23 = [P2, { flag: "storyPhase", lte: 3 }];
    const REASON = "The Stewards ran Uncle Thistle late to his own wake";
    const ALLY_ROWS = [   // the shape patch-vault-allies puts on the Vault rescue closers
      { sourceFactionId: "@coalition", targetFactionId: JACKALOPES, setStatus: "allied", reason: REASON },
      { sourceFactionId: JACKALOPES, targetFactionId: "@coalition", setStatus: "allied", reason: REASON }
    ];
    const out = [
      beat("fixit_late_run_offer", "Furrier's Fixit Farm — The Late Run",
        "There is a crate on the Counter. It is long, and it is Uncle Thistle. Mara does not lower her voice. \"Thistle was late to everything. His own birth. Both weddings. The war, briefly.\" The coin flips. \"He's due at his own wake at dusk, in the Gullywasher, and the family wants him late one more time. Out of respect.\" The coin stops. \"No runner will carry him. Runners are never late; it goes on the board. You are not runners.\" Late enough to be Thistle, she says. Not so late it's rude. She will know.",
        { speaker: mara, scene: SC.counter, priority: "high", requires: [...A23, { beatMark: "fixit_general_store_coversation" }, { questBucket: Q_VAULT, isNot: "completed" }],
          memoryText: "Mara asked the Stewards to carry Uncle Thistle to his own wake, late. Runners are never late; the Stewards are not runners.", choices: [
          ch("Take the crate.", "fixit_late_run_road", { description: "He is heavier than he looks. Patter falls in beside you with a pocket watch and no intention of helping." }),
          ch("Decline. Respectfully.", "fixit_late_run_declined", { description: "Mara nods like you've confirmed something about yourselves." })
        ] }),
      beat("fixit_late_run_road", "Furrier's Fixit Farm — Killing Time",
        "The Gullywasher is four minutes' walk from the Counter. You have two hours to be exactly the right amount of late. Patter checks the watch every eleven seconds and juggles with the other hand. Uncle Thistle says nothing, which the family insists is new.",
        { speaker: patter, scene: SC.yard, dialogueOffer: false, requires: [...A23, { beatMark: "fixit_late_run_offer" }],
          memoryText: "Patter kept time while the Stewards killed it, carrying Uncle Thistle to his wake.", choices: [
          ch("Take the long way. Past the cows.", "fixit_late_run_success", { checkStat: "body", checkDC: 12, failNext: "fixit_late_run_fail", description: "Round the paddock with a dead Jackalope on your shoulders. Somewhere in the back of the Farm a door opens an inch toward the cows, and closes again." }),
          ch("Stop for a drink in his honour. Several.", "fixit_late_run_success", { checkStat: "presence", checkDC: 12, failNext: "fixit_late_run_fail", description: "Three bars, all of them the Gullywasher's side door. Dougan pours one for the crate and drinks it for him." }),
          ch("Just walk there.", "fixit_late_run_fail", { description: "Four minutes, on the dot. Patter looks at the watch, then at you, then at the sky." })
        ] }),
      beat("fixit_late_run_success", "Furrier's Fixit Farm — Fashionably Dead",
        "You come through the Gullywasher's door forty minutes late, which the family agrees afterwards was exactly Thistle. A cousin weeps with relief. Patter is handed a beer and finally puts the watch away. Mara chalks a runner's peg, LATE, the only one on the coast that has ever said it, and hangs it on the crate. Then she looks at you for a long time, which at the Counter costs money, and says the word she gives once: \"Allies.\" (⚙ GM: the Jackalopes are ALLIES now; the Back Stairs and the Generator Hall open to the Stewards.)",
        { speaker: mara, scene: SC.gully, dialogueOffer: false, requires: [...A23, { beatMark: "fixit_late_run_road" }, { beatMark: "fixit_late_run_fail", not: true }],
          memoryText: "The Stewards carried Uncle Thistle to his own wake exactly late enough. The Jackalopes call the Stewards Allies now.",
          receipts: [{ label: "The LATE Peg", effectKey: "rollPlus2", acquisition: "earned", source: { name: "Mara Quickhands, in chalk" },
            truth: "A runner's peg chalked LATE in Mara's hand, the only Jackalope peg that has ever said it; it hung on Uncle Thistle's crate at his wake. Show it at any Jackalope counter and the pause gets shorter. Show it to Patter and she will tell you which routes on the board are actually running, and which one isn't." }],
          fx: { relationshipEffects: ALLY_ROWS },
          choices: [
            ch("Raise a glass to Thistle.", "", { description: "Late, as is traditional." }),
            ch("Ask Mara what the peg is worth.", "", { description: "\"Nothing. That's what makes it expensive.\"" })
          ] }),
      beat("fixit_late_run_fail", "Furrier's Fixit Farm — Punctual",
        "The long way was a shortcut, or the drinks went down fast, or you simply walked. Somehow, horribly, you arrive on time. The Gullywasher goes quiet the way a room does when a joke dies on stage, and somebody stops the clock out of pure embarrassment. \"He was never on time in his LIFE,\" a cousin says, and it is the cruellest thing anyone says about Thistle all day. Mara thanks you for the carry, which is worse, and does not say the other word. (⚙ GM: no alliance; the Back Stairs stay shut. There will be another way in.)",
        { type: "narration", speaker: mara, scene: SC.gully, dialogueOffer: false, requires: [...A23, { beatMark: "fixit_late_run_road" }, { beatMark: "fixit_late_run_success", not: true }],
          memoryText: "The Stewards carried Uncle Thistle to his own wake ON TIME. The family has not forgiven it.",
          choices: [ch("Apologise to the crate.", "", { description: "Thistle, consistent to the last, does not get back to you." })] }),
      beat("fixit_late_run_declined", "Furrier's Fixit Farm — Pip Takes It",
        "\"Pip,\" says Mara, and Pip is already there, cap backwards, lifting his end. \"I'll have him there on time,\" he says. \"I'm always on time.\" The whole family groans. Patter chalks the route on the board anyway, in her own hand, just in case.",
        { type: "narration", speaker: mara, scene: SC.counter, dialogueOffer: false, requires: [...A23, { beatMark: "fixit_late_run_offer" }, { beatMark: "fixit_late_run_road", not: true }],
          memoryText: "The Stewards turned down Uncle Thistle's last run. Pip took it, and was on time.",
          choices: [ch("Watch him go.", "", { description: "Pip is on time. Of course he is. The family will talk about it for years." })] })
    ];
    // the way in survives the Farm settling first (quest-closed seals the step beats; evergreen exempts them — the act / Vault gates still bound it)
    for (const b of out) if (b.id === "fixit_late_run_offer" || b.id === "fixit_late_run_road") b.inject.evergreen = true;
    return out;
  }

  // ── world lookups (the seeder's, without the persona pass) ───────────────
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { yard: sceneOf("fixit_town_walk"), counter: sceneOf("fixit_general_store_coversation"), gully: sceneOf("fixit_gullywasher_welcome", "fixit_gullywasher_interior_convo") };
  const ALLY = reqsOf(byId.get("fixit_backstairs_exterior")?.inject?.requires).find(r => r && r.relation && r.is === "allied") || null;
  if (!ALLY) say("⚠ fixit_backstairs_exterior has no allied gate (patch-vault-allies never ran here?) — the Late Run still sets ALLIED, but nothing waits on it yet; run patch-vault-allies + patch-template-review-fixes-c");
  const JACKALOPES = ALLY?.relation || "U5YaO2p189LBMvVq";
  if (!game.actors?.get?.(JACKALOPES)) say(`⚠ Jackalopes faction actor ${JACKALOPES} not in this world — the allied rows will not apply until it is`);
  const actorByName = (n) => (game.actors?.contents || []).find(a => a.name === n)?.id || null;
  const spOr = (name, beatId) => actorByName(name) || byId.get(beatId)?.speakerActorId || null;

  // ── 1. beats ──────────────────────────────────────────────────────────────
  say("— Fixit: THE LATE RUN (the pre-Vault way to the alliance) —");
  const NEW = LATE_RUN_BEATS({ beat, ch, P2, SC, mara: spOr("Mara Quickhands", "fixit_general_store_coversation"), patter: spOr("Patter", "fixit_pip_and_patter_convo"), JACKALOPES, Q_VAULT });
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }
  for (const def of NEW) edit(def.id, b => {
    b.inject = b.inject || {}; if (b.inject.repeatable !== false) b.inject.repeatable = false;
    const r = reqsOf(b.inject.requires).slice();
    for (const need of def.inject.requires || []) if (!r.some(x => JSON.stringify(x) === JSON.stringify(need))) r.push({ ...need });
    if (JSON.stringify(r) !== JSON.stringify(b.inject.requires)) b.inject.requires = r;
    if (def.dialogueOffer === false && b.dialogueOffer !== false) b.dialogueOffer = false;
    if (def.inject.evergreen === true && b.inject.evergreen !== true) b.inject.evergreen = true;
    const rows = def.worldEffects?.relationshipEffects; if (Array.isArray(rows)) { b.worldEffects = b.worldEffects || {}; const have = Array.isArray(b.worldEffects.relationshipEffects) ? b.worldEffects.relationshipEffects : []; const add = rows.filter(n => !have.some(h => String(h?.sourceFactionId) === n.sourceFactionId && String(h?.targetFactionId) === n.targetFactionId && String(h?.setStatus) === "allied")); if (add.length) b.worldEffects.relationshipEffects = [...have, ...add]; }
  }, "the Late Run: once-only / gates / routing-only / allied rows");
  // the Vault closers stay as they are — report what they do so the GM can see the overlap is harmless
  for (const id of ["maneuver_vault_pip_shaken", "maneuver_vault_pip_changed"]) {
    const b = byId.get(id); const rows = Array.isArray(b?.worldEffects?.relationshipEffects) ? b.worldEffects.relationshipEffects : [];
    say(b ? `· ${id}: ${rows.filter(r => String(r?.setStatus) === "allied").length} allied row(s) — setStatus is absolute, so after the Late Run it re-sets allied → allied (no regress)` : `⚠ missing ${id} (patch-vault-allies / the Vault seeder never ran here?)`);
  }
  const beatChanges = changes;

  // ── 2. story script (campaign.story, edited in place) ─────────────────────
  camp.story = camp.story && typeof camp.story === "object" ? camp.story : { quests: {}, scripts: {} };
  camp.story.scripts = camp.story.scripts || {};
  const scriptKeysChanged = [];
  const editScript = (key, fn, what) => {
    const sc = camp.story.scripts[key];
    if (!sc || !Array.isArray(sc.steps)) return say(`✗ campaign.story.scripts.${key} missing — its seeder never wrote the story data here; re-run that seeder instead`);
    const before = JSON.stringify(sc); const afterBefore = JSON.stringify(sc.after || []);
    fn(sc);
    if (JSON.stringify(sc.after || []) !== afterBefore) { say(`✗ ${key}: \`after\` changed unexpectedly — NOT writing this script`); camp.story.scripts[key] = JSON.parse(before); return; }
    if (JSON.stringify(sc) !== before) { changes++; scriptKeysChanged.push(key); say(`✦ story script ${key}: ${what}`); } else say(`· ok story script ${key}`);
  };
  editScript("fixit_farm", sc => {
    if (sc.steps.some(s => s && (s.id === "laterun" || (Array.isArray(s.beats) && s.beats.includes("fixit_late_run_offer"))))) return;
    let i = sc.steps.findIndex(s => s && s.id === "bin");
    if (i < 0) { const j = sc.steps.findIndex(s => s && ["prisoner", "load", "settles"].includes(s.id)); i = j < 0 ? sc.steps.length - 1 : j - 1; }
    sc.steps.splice(i + 1, 0, JSON.parse(JSON.stringify(LATE_RUN_STEP)));
  }, "step \"The Late Run\" after the MYSTERY Bin (the NOW card points at it before the Vault)");

  // ── 3. report / write ─────────────────────────────────────────────────────
  console.log(`[patch-fixit-early-alliance-2026-10-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Fixit early alliance DRY RUN: ${changes} change(s) — see console (F12). Set DRY_RUN = false to apply.`);
  if (!changes) return ui.notifications.info("Fixit early alliance: nothing to do.");
  if (beatChanges || scriptKeysChanged.length) {
    try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-fixit-early-alliance-${Date.now()}.json`); }
    catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  // re-save each changed script through the story API so the engine re-applies campaign.story now (and storyUpdated fires)
  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  for (const key of scriptKeysChanged) { try { if (storyApi?.saveQuest) await storyApi.saveQuest(campaignId, key, { script: camp.story.scripts[key] }); } catch (e) { console.warn(`[patch-fixit-early-alliance] saveQuest ${key} failed (data is written; F5 applies it)`, e); } }
  ui.notifications.info(`Fixit early alliance APPLIED: ${changes} change(s). Late, as is traditional. F5.`);
})();
