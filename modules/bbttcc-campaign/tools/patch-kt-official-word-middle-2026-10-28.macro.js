/**
 * patch-kt-official-word-middle-2026-10-28.macro.js — Dave, 10-28: the dropped manifest did nothing for the Official Word
 * on its own (only "with the manifest AND the roster" reached the full ending; manifest-only fell to the thin one).
 * Ruling: "Go with A, the middle ending. Leave it possible to get the full ending if they come back with the roster."
 *   · NEW kt_official_word_partial — "Say it, with the manifest in your hands." (manifest, no roster): names read out,
 *     no why; Calder points at the doc's half. Does NOT complete the quest (it stays active).
 *   · NEW kt_official_word_return — "The cookline — finish the Official Word" (hub + the cookline door), once the partial
 *     was given and the roster is in hand → "Say it whole." → kt_official_word_given (the full ending, completes).
 *   · "Say it with what you have." hides while the manifest is in hand (it IS the manifest now) — the thin ending stays
 *     for a table that speaks with nothing.
 *   · kt_pulled_files_filed (Act 4) also opens after the partial, with its own line; the Quest Log gets a step
 *     "The Rest of the Word" (skipped unless the partial was given).
 * New prose is Claude's draft. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const J = (x) => JSON.stringify(x);
  const report = []; const conflicts = []; let changes = 0;
  const OW = "quest_kt_official_word", MAN = "kt_dropped_manifest", ROSTER = "kt_back_room_roster";
  const PART = "kt_official_word_partial", RET = "kt_official_word_return", GIVEN = "kt_official_word_given", THIN = "kt_official_word_thin";
  const word = byId("kt_official_word"), given = byId(GIVEN);
  if (!word || !given || !byId(THIN)) return ui.notifications.error("Official Word beats missing — nothing changed.");
  const C = (o) => ({ description: "", checkStat: "", checkDC: 0, failNext: "", ...o });
  const newBeat = (id, label, description, choices) => {
    const b = JSON.parse(J(given));
    Object.assign(b, { id, label, description, choices, worldEffects: {}, story: { quest: "khezek_tor", chapter: "the_official_word" },
      inject: { ...(b.inject || {}), requires: [{ flag: "storyPhase", gte: 2 }, { questBucket: OW, is: "active" }] } });
    delete b.questRole; return b;
  };

  // 1) the middle ending + the way back
  if (!byId(PART)) {
    beats.push(newBeat(PART, "Khezek-Tor — The Official Word, Half Said",
      "The outfit says it with one dead man's paperwork in its hands. The names come off the manifest out loud, one at a time, and the cookline hears every one of them. Nobody can say yet why those names went down there, or who sent them. Calder chalks the names on the board and leaves room underneath. \"That's half of it,\" he says. \"The doc kept the other half.\" Bez starts serving again.",
      [C({ label: "Eat what Bez gives you.", next: "" })]));
    changes++; report.push(`+ ${PART} (the quest stays open)`);
  }
  if (!byId(RET)) {
    beats.push(newBeat(RET, "Khezek-Tor — The Official Word, Finished",
      "You come back to the cookline with Doc Greeley's roster folded into the manifest. Calder sees it and puts the chalk down. Bez stops serving, the second time in living memory. The room under the names on the board is still there, waiting.",
      [C({ label: "Say it whole.", next: GIVEN }), C({ label: "Not tonight.", next: "" })]));
    changes++; report.push(`+ ${RET}`);
  }

  // 2) the manifest-only choice (and thin hides while the manifest is in hand)
  for (const hid of ["kt_official_word", "ans_kt_official_word_let_calder_say_it"]) {
    const h = byId(hid); if (!h) { conflicts.push(`${hid}: not found`); continue; }
    h.choices = Array.isArray(h.choices) ? h.choices : [];
    if (!h.choices.some(c => c?.next === PART)) {
      const at = h.choices.findIndex(c => c?.next === THIN);
      const ch = C({ label: "Say it, with the manifest in your hands.", next: PART, requires: [{ beatMark: MAN }, { beatMark: ROSTER, not: true }] });
      if (at >= 0) h.choices.splice(at, 0, ch); else h.choices.push(ch);
      changes++; report.push(`+ ${hid}: "Say it, with the manifest in your hands." → ${PART}`);
    }
    const thin = h.choices.find(c => c?.next === THIN);
    const want = [{ beatMark: MAN, not: true }];
    if (thin && J(thin.requires || null) !== J(want)) { thin.requires = want; changes++; report.push(`✎ ${hid}: "${thin.label}" hides while the manifest is in hand`); }
  }

  // 3) the doors back (hub + the cookline door)
  const RET_REQ = [{ questBucket: OW, is: "active" }, { beatMark: PART }, { beatMark: ROSTER }, { beatMark: GIVEN, not: true }];
  const door = (hostId, beforeRe, label) => {
    const h = byId(hostId); if (!h) return conflicts.push(`${hostId}: not found`);
    h.choices = Array.isArray(h.choices) ? h.choices : [];
    if (h.choices.some(c => c?.next === RET)) return;
    const at = h.choices.findIndex(c => beforeRe.test(String(c?.label || "").trim()));
    const ch = C({ label, next: RET, requires: RET_REQ, description: "You have Doc Greeley's half now. Say the Official Word whole." });
    if (at >= 0) h.choices.splice(at, 0, ch); else h.choices.push(ch);
    changes++; report.push(`+ ${hostId}: "${label}" → ${RET}`);
  };
  door("khezek_tor_quest_scene", /^call it a day$/i, "The cookline — finish the Official Word");
  door("khezek_tor_camp_door_exterior", /^go in$/i, "Finish the Official Word");

  // 4) Act 4's pulled files know about the half-said word
  const pf = byId("kt_pulled_files_filed");
  if (pf) {
    const any = (pf.inject?.requires || []).find(r => r && Array.isArray(r.anyOf));
    if (any && !any.anyOf.some(r => r?.beatMark === PART)) { any.anyOf.push({ beatMark: PART }); changes++; report.push(`✎ kt_pulled_files_filed: opens after the half-said word too`); }
    const SPAN = `{{#played ${GIVEN}}}{{else}}{{#mark ${PART}}}The word the outfit gave at the cookline had names and no why. Now it has a folder and a date, and the crews who heard the names hear the reason, and eat.{{/mark}}{{/played}}`;
    if (!String(pf.description || "").includes(`{{#mark ${PART}}}`)) { pf.description = String(pf.description || "") + SPAN; changes++; report.push(`✎ kt_pulled_files_filed: a line for the half-said word`); }
  } else conflicts.push("kt_pulled_files_filed: not found");

  // 5) the Quest Log
  const sc = camp.story?.scripts?.khezek_tor;
  if (sc && Array.isArray(sc.steps) && !sc.steps.some(s => s?.id === "whole")) {
    const at = sc.steps.findIndex(s => s?.id === "oword");
    const oword = sc.steps[at];
    if (oword && !(oword.done?.anyOf || []).includes(PART)) { oword.done = { anyOf: [...(oword.done?.anyOf || []), PART] }; }
    sc.steps.splice(at + 1, 0, { id: "whole", label: "The Rest of the Word", group: "word", chapter: "the_official_word", optional: true,
      line: "Bring Doc Greeley's roster from the Waiting Room in Allesh-Gilliam, and finish the Official Word at the cookline.",
      beats: [RET], done: { anyOf: [GIVEN, THIN] },
      logged: "You read the names at the cookline. Doc Greeley's roster finished the word." });
    changes++; report.push("+ Quest Log step \"The Rest of the Word\" (after The Official Word)");
  } else if (!sc) conflicts.push("story script khezek_tor not found");

  console.log(`[kt official word middle 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktOwMiddle = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-ow-middle-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the half-said word, and the way back to finish it.`);
})();
