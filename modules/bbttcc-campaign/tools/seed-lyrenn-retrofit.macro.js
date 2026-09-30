/* seed-lyrenn-retrofit.macro.js — LYRENN to the Chuckle Creek template (2026-09-27). RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Source: ~/LYRENN_RETROFIT_2026_09_27.md. Armed secrets for Elsin + Rowan; NEW actor Wren Ashby (the Water Choir's first soprano);
 * speakers on the speakerless; the R7 vault line ("not by my mother, not by hers") finally lands; receipt THE VAULT LABEL; the
 * WHISPER made audible (bible §9: a beat where a hex says what it was told). Three steps added to the script.
 * Idempotent; backs up the campaigns setting. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  const KEY = "lyrenn", Q_MAIN = "quest_JqCdOo0l6X8K2EcE";
  const MARKER = "[LYRENN-RETROFIT-2026-09-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  const SECRETS = {
    "Elsin Quade": [
      "The Farm That Died :: rollPlus2 :: a Steward asks, with respect, where she farmed before Lyrenn :: Quotas, mandates, force-feeding the ground, and the ground DIED. Not failed. Died. A place where nothing argues back any more, and she can find it on a map without looking. She is in Lyrenn to farm as apology.",
      "Permissions Are Tests :: stirThePot :: a Steward asks whether she would LET them plant the red thread :: \"No one has agreed not to.\" She does not forbid it. She watches, hard, because some permissions are tests, and she has not yet decided which kind this one is."
    ],
    "Rowan-of-the-Loam": [
      "I Was Pressure :: rollPlus2 :: a Steward asks, with the right kind of quiet, whether Rowan was ever someone :: \"I don't think I was someone. I think I was pressure.\" Something the soil needed to say, wearing a person. They do not know what happens if the soil finishes the sentence.",
      "The Soil Stopped Talking :: oppRollMinus2 :: a Steward mentions statues or standing stones :: Rowan goes down on one knee, palm flat. The soil around the statues STOPPED TALKING — the opposite of Lyrenn, which will not shut up. The lean of the red-thread sprouts goes toward that silence."
    ]
  };
  const WREN = { name: "Wren Ashby", topics: "the Water Choir, the channels, the basins, the flat one, the stone hand, listening, grading, the curve, that one night, singing, the clipboard, Elsin, Rowan",
    notes: `${MARKER} PRIVATE TRUTH — Wren Ashby, nine, first soprano of the Water Choir and the one with the clipboard. VOICE: terrifying and correct; eyes shut while talking; grades everything, including you, on a curve; never says 'why' because the Choir doesn't do why, it does toward. The Choir is eleven children in eleven channels conducting the water by listening harder. WHAT SHE KNOWS: which basin is flat (the one with the stone hand in it), that it has been flat since that one night, on purpose, and that the children are not allowed to fix it — nobody told them that, they just know. After the red thread is planted the flat basin has WORDS (the whisper: you were lied to, be what they made you) and the children stand very still and let the water say them. Wren will point coastward without opening her eyes. She will not name the Mountain; the Choir only knows toward. Funny first: the clipboard, the curve, 'everybody listens wrong at first.'`,
    secrets: ["One Basin Flat :: rollPlus2 :: a Steward asks WHICH basin is flat instead of why :: The one with the stone hand in it. \"It's been flat since that one night. On purpose. We're not allowed to fix it. Nobody said that. We just know.\""] };
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
  let wren = (game.actors?.contents || []).find(a => a.name === WREN.name);
  if (!wren) { say(`✚ CREATE actor "${WREN.name}"`); changes++; if (!DRY_RUN) wren = await Actor.create({ name: WREN.name, type: "npc" }); }
  if (wren) { actorIds[WREN.name] = wren.id; const cur = wren.getFlag(MAL, "persona") || {}; if (!String(cur.notes || "").includes(MARKER)) { changes++; say("✚ persona Wren Ashby +1 secret"); if (!DRY_RUN) await wren.setFlag(MAL, "persona", { ...cur, topics: [String(cur.topics || "").trim(), WREN.topics].filter(Boolean).join(", "), notes: [String(cur.notes || "").trim(), WREN.notes].filter(Boolean).join("\n\n"), secretsRaw: [String(cur.secretsRaw || "").trim(), ...WREN.secrets].filter(Boolean).join("\n") }); } else say("· ok persona Wren Ashby"); }
  const sp = (n) => actorIds[n] || null;

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  for (const need of ["lyrenn_seed_vault", "lyrenn_water_choir", "lyrenn_red_thread_planting", "lyrenn_green_ring", "lyrenn_hex_settles"]) if (!byId.get(need)) return ui.notifications.error(`Beat ${need} missing — Lyrenn was never seeded here.`);
  const sceneOf = (...ids) => { for (const id of ids) { const s = byId.get(id)?.sceneId; if (s) return String(s).replace(/^Scene\./, ""); } return null; };
  const SC = { choir: sceneOf("lyrenn_water_choir"), vault: sceneOf("lyrenn_seed_vault") };

  const TAGS = "lyrenn story";
  const beat = (id, label, description, { type = "dialog", speaker = null, choices = null, receipts = null, requires = null, timePoints = 0, priority = "background", scene = null } = {}) => ({
    id, label, type, timeScale: "scene", timePoints, questId: Q_MAIN, tags: TAGS, politicalTags: "",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", ...(requires ? { requires } : {}) },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    storyChain: KEY, priority, ...(scene ? { sceneId: scene } : {}), ...(speaker ? { speakerActorId: speaker } : {}),
    story: { quest: KEY },
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { ...(receipts ? { receipts } : {}) }
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });
  const P2 = { flag: "storyPhase", gte: 2 };

  const NEW = [
    beat("lyrenn_choir_children", "Lyrenn — The Choir Grades You",
      "The Water Choir is eleven children standing in eleven channels with their eyes shut, and the water is singing, and they are conducting it by listening harder. The tallest one is nine and has a clipboard. \"You're listening wrong,\" she says, without opening her eyes. \"Everybody does at first. We grade on a curve.\"",
      { speaker: sp("Wren Ashby"), scene: SC.choir, requires: [P2], choices: [
        ch("\"Which basin is flat?\"", "", { checkStat: "mind", checkDC: 12, failNext: "lyrenn_choir_children_fail", description: "The one with the stone hand in it. \"Since that one night. On purpose. We're not allowed to fix it. Nobody said that. We just know.\"" }),
        ch("Hum along.", "", { checkStat: "presence", checkDC: 12, failNext: "lyrenn_choir_children_fail", description: "They let you. One of the channels changes key to meet you, and eleven children nod without opening their eyes." }),
        ch("\"Who's in charge?\"", "", { description: "\"Nobody. That's the point of a choir.\"" })
      ] }),
    beat("lyrenn_choir_children_fail", "Lyrenn — A C",
      "Wren writes something on the clipboard. \"C,\" she says. \"You can retake it. Everybody retakes it.\" The water, kindly, changes the subject.",
      { type: "narration", speaker: sp("Wren Ashby"), scene: SC.choir, requires: [P2], choices: [ch("Retake it.", "lyrenn_choir_children")] }),
    beat("lyrenn_vault_label", "Lyrenn — The Label",
      "Meticulous script on brown paper, the same hand as every jar in the vault, older than Elsin: RED THREAD. GATHERED WHERE THE STANDING STONES WENT QUIET. A direction under it, and a date that is the only one in the vault. Elsin reads it over your shoulder and does not say anything for long enough that you look up.",
      { type: "narration", speaker: sp("Elsin Quade"), scene: SC.vault, priority: "high", requires: [P2],
        receipts: [{ label: "The Vault Label", effectKey: "rollPlus2", acquisition: "earned", source: { name: "the red-thread jar in Lyrenn's seed vault" },
          truth: "Lyrenn's own hand recorded where the standing stones went quiet, and when. Show it to Sable Nine and her six points get a seventh; show it to Etta Bloom and she goes still, because it is her kin's address; hold it beside the Forest of Early Tifaret's heading and the Lost Statues have a direction." }],
        choices: [ch("Keep the label. Plant the seeds.", "lyrenn_red_thread_planting"), ch("Keep the label. Leave the seeds.", "")] }),
    beat("lyrenn_whisper", "Lyrenn — What the Land Was Told",
      "The flat basin isn't flat any more. It has words. The children are not singing them; they are standing very still with their eyes shut while the water does, and the water says, in a voice made of a channel and a stone hand, what it was told that one night: <i>you were lied to. You were always lied to. Be what they made you.</i> It does not say who told it. The Choir only knows toward, not what.",
      { speaker: sp("Wren Ashby"), scene: SC.choir, priority: "high", timePoints: 1, requires: [P2, { beatMark: "lyrenn_red_thread_planting" }], choices: [
        ch("\"Where did it come from?\"", "", { description: "\"Toward,\" says Wren. \"Not what. We don't do what.\" She points, coastward, without opening her eyes." }),
        ch("Tell it it wasn't lied to.", "", { checkStat: "presence", checkDC: 14, failNext: "lyrenn_whisper_fail", description: "The basin comes up a quarter-tone. Eleven children exhale together." }),
        ch("Write it down.", "", { description: "Rowan, behind you, on one knee: \"Every hex that went dark heard something first. Now you've heard it too.\"" })
      ] }),
    beat("lyrenn_whisper_fail", "Lyrenn — Politely Flat",
      "It stays flat. Politely. The way a person stays seated when you've asked them to dance and they have decided to spare you. Wren makes a mark on the clipboard that is not a grade.",
      { type: "narration", speaker: sp("Wren Ashby"), scene: SC.choir, requires: [P2], choices: [ch("Listen anyway.", "", { description: "It says it again. It will say it as long as anybody listens." })] })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id}`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id}`); };
  edit("lyrenn_seed_vault", b => {
    b.speakerActorId = sp("Elsin Quade") || b.speakerActorId || null;
    if (!/not by hers/i.test(b.description)) b.description = b.description.replace(/No one has planted those in years\.\s*\/?\s*\n*\s*No one has agreed not to\./, "Nobody has planted those. Not in years: ever. \"Not by my mother,\" Elsin says, from the top of the hatch, \"not by hers.\" She has never once asked to see what's down here and she is, visibly, itching to look. Nobody has agreed not to, either.");
    if (!/not by hers/i.test(b.description)) b.description += "\n\nNobody has planted those. Not in years: ever. \"Not by my mother,\" Elsin says, from the top of the hatch, \"not by hers.\" She has never once asked to see what's down here and she is, visibly, itching to look.";
    if (!(b.choices || []).some(c => c.next === "lyrenn_vault_label")) b.choices = [...(b.choices || []).filter(c => c.label !== "Leave"), ch("Take the label off the red-thread jar.", "lyrenn_vault_label"), ...(b.choices || []).filter(c => c.label === "Leave")];
  }, "R7 line (not by my mother, not by hers) + the label + Elsin speaks");
  edit("lyrenn_green_ring", b => {
    if (!String(b.description || "").trim()) b.description = "The Green Ring is a radial field around the old grain elevator, furrows running out from it like a clock with too many hands, and every furrow bends, very slightly, around an empty plinth at the centre where something stood. Nobody says what. The bend is in the soil, not the planting; whoever ploughs here ploughs around it without deciding to. Rowan is on one knee at the plinth with a palm flat on the ground, and does not look up.";
    if (!(b.choices || []).some(c => /plinth/i.test(c.label))) b.choices = [ch("Ask Rowan about the plinth.", "lyrenn_rowan_of_the_loam_convo", { description: "They go very still. \"The soil around them stopped talking.\"" }), ...(b.choices || [])];
    b.speakerActorId = b.speakerActorId || sp("Rowan-of-the-Loam") || null;
  }, "a description, the plinth, Rowan speaks");
  edit("lyrenn_seed_vault_fail_reading", b => {
    b.inject = b.inject || {}; if (!b.inject.requires) b.inject.requires = [P2];
    // its routes pointed at lyrenn_main_scene — the ACT 1 hub, sealed once Act 2 opens (lint S01). Retry the vault; withdraw to the Act 2 hub.
    for (const c of b.choices || []) { if (c.failNext === "lyrenn_main_scene") c.failNext = "lyrenn_quest_scene"; if (c.next === "lyrenn_main_scene") c.next = "lyrenn_quest_scene"; }
  }, "act gate + routes off the sealed Act 1 hub");
  const voice = (ids, name) => { for (const id of ids) edit(id, b => { if (!b.speakerActorId && sp(name)) b.speakerActorId = sp(name); }, `speaker ${name}`); };
  voice(["lyrenn_elsin_quade_convo_1", "lyrenn_elsin_quade_convo_2", "lyrenn_elsin_quade_convo_3", "lyrenn_elsin_quade_convo_echo", "lyrenn_seed_vault_inspect_arcana", "lyrenn_seed_vault_inspect_nature", "lyrenn_seed_vault_darkness_sensitivity", "lyrenn_seed_vault_fail_reading", "lyrenn_the_gentle_pest", "lyrenn_the_gentle_pest_acceptance", "lyrenn_the_gentle_pest_try_again", "lyrenn_gentle_pest_teach_fail"], "Elsin Quade");
  voice(["lyrenn_rowan_of_the_loam_convo_1", "lyrenn_rowan_of_the_loam_convo_2", "lyrenn_rowan_of_the_loam_convo_3", "lyrenn_rowan_of_the_loam_convo_echo", "lyrenn_forest_will_not_be_fought", "lyrenn_forest_will_not_be_fought_quest_acceptance", "lyrenn_forest_will_not_be_fought_force", "lyrenn_forest_will_not_be_fought_negotiate_fail", "lyrenn_forest_will_not_be_fought_redirect_fail", "lyrenn_red_thread_planting", "lyrenn_red_thread_sprouted", "lyrenn_soil_keeps_books", "lyrenn_the_field_that_remembers_you", "lyrenn_the_field_that_remembers_you_intro"], "Rowan-of-the-Loam");
  voice(["lyrenn_water_choir", "lyrenn_water_choir_inspect_perception", "lyrenn_water_choir_inspect_insight", "lyrenn_water_choir_inspect_arcana", "lyrenn_water_choir_try_again", "lyrenn_water_choir_reading"], "Wren Ashby");

  const storyApi = game.bbttcc?.api?.campaign?.story?.data;
  const code = storyApi?.code?.() || { quests: {}, scripts: {} };
  const codeQuest = code.quests?.[KEY], codeScript = code.scripts?.[KEY];
  if (!codeQuest || !codeScript) say("✗ code story for lyrenn not readable — story script NOT written (hard-reload and re-run)");
  const QUEST = codeQuest ? JSON.parse(JSON.stringify(codeQuest)) : null;
  const SCRIPT = codeScript ? JSON.parse(JSON.stringify(codeScript)) : null;
  if (SCRIPT) {
    const has = (id) => SCRIPT.steps.some(s => s.id === id);
    const insertAfter = (afterId, st) => { if (has(st.id)) return; const i = SCRIPT.steps.findIndex(s => s.id === afterId); if (i >= 0) SCRIPT.steps.splice(i + 1, 0, st); else SCRIPT.steps.push(st); };
    insertAfter("second", { id: "choir", label: "The Choir Grades You", line: "The Water Choir's children are grading your listening. Ask which basin is flat. Not why.", beats: ["lyrenn_choir_children"] });
    const vault = SCRIPT.steps.find(s => s.id === "vault"); if (vault) vault.line = "Elsin will open the vault now. Not by her mother, not by hers. Stand next to her when she finds out what's down there.";
    insertAfter("vault", { id: "label", label: "The Label", line: "The red-thread jar has a label in Lyrenn's own hand. It says where the stones went quiet. Take it.", beats: ["lyrenn_vault_label"], done: { mark: "lyrenn_vault_label" } });
    insertAfter("label", { id: "whisper", label: "What the Land Was Told", line: "After the planting the flat basin has words. Stand in the Choir and hear what the land was told.", beats: ["lyrenn_whisper"] });
    const doorLine = { choir: "The Water Choir is tuning to you. Stand in it and listen. The children will grade you.", elsin: "Elsin will answer what you ask. She'd rather answer it once. Ask about the vault and watch her not ask back.", rowan: "Rowan is listening to the ground. Ask what's loud. Then ask what's quiet.", ring: "The Green Ring listens. Walk it. Mind the plinth." };
    for (const d of (SCRIPT.doors || [])) if (doorLine[d.id]) d.line = doorLine[d.id];
  }
  const haveData = storyApi?.get?.(campaignId) || {};
  const questChanged = QUEST && JSON.stringify(haveData.quests?.[KEY] || null) !== JSON.stringify(QUEST);
  const scriptChanged = SCRIPT && (JSON.stringify(haveData.scripts?.[KEY] || null) !== JSON.stringify(SCRIPT) || questChanged);
  if (scriptChanged) { changes++; say(`✦ story script lyrenn → campaign.story (${SCRIPT.steps.length} steps, ${SCRIPT.doors.length} doors)`); } else if (SCRIPT) say("· ok story script (already)");

  console.log(`[seed-lyrenn-retrofit] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Lyrenn retrofit DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Lyrenn retrofit: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-lyrenn-retrofit-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (scriptChanged && storyApi?.saveQuest) await storyApi.saveQuest(campaignId, KEY, { quest: QUEST, script: SCRIPT });
  ui.notifications.info(`Lyrenn retrofit APPLIED: ${changes} change(s). We grade on a curve. F5.`);
})();
