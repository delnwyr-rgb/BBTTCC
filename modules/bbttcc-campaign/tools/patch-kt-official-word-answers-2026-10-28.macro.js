/**
 * patch-kt-official-word-answers-2026-10-28.macro.js — Dave, 10-28: "ask whose place it is is a dead end question on the
 * Place Where Tamsin Sets thread."
 * Engine fact (dead-end sweep, 10-26): a choice with `next: ""` ENDS the chain and its `description` is only the button
 * subtitle. The Official Word's three talk scenes were written that way — every question ended the scene, and the answers
 * (even the bench payoff, Brennig telling Night One) only ever showed as subtitles:
 *   · kt_official_word_open (Calder at the Brace) · kt_brennig_desk (the Warehouse) · kt_place_setting (the cookline bench)
 * Each answer becomes a routing-only answer beat `ans_<parent>_<slug>` (sweep rules: dialogueOffer:false, no questId/story,
 * storyPhase ≥ 2 + evergreen, timeScale "moment" / 0 points, no effects) whose text is the old subtitle and whose choices
 * are the parent's OTHER choices (never back into the parent — re-entry re-applies its effects) plus a way out. The
 * parent's button keeps its label and loses the subtitle (it gave the answer away). Checked choices keep their check: the
 * answer beat is the SUCCESS route, failNext unchanged. Kept as endings: "Say nothing and eat." (the bench's own exit).
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
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
  const C = (x) => JSON.parse(JSON.stringify(x));
  const report = []; const conflicts = []; let changes = 0;

  // parent → { title (for labels), exit (the way out added to every answer), answers: [{ re, slug, name, exitOnly? }] }
  const SPEC = {
    kt_official_word_open: { title: "Khezek-Tor — Nobody Said Anything", exit: "Leave him to his work.", answers: [
      { re: /^"What do the crews need to hear first\?"/, slug: "first", name: "What the crews need first" },
      { re: /^Ask about the three missing names/, slug: "missing_names", name: "The three missing names" },
      { re: /^Sit down\./, slug: "sit_down", name: "Sit down" } ] },
    kt_brennig_desk: { title: "Khezek-Tor — Brennig's Desk", exit: "Leave him to his counting.", answers: [
      { re: /^Help him count\./, slug: "count", name: "Help him count" },
      { re: /^Ask about the middle brother\./, slug: "middle_brother", name: "The middle brother" },
      { re: /^Ask where the manifest is\./, slug: "where_manifest", name: "Where the manifest is" } ] },
    kt_place_setting: { title: "Khezek-Tor — The Place Setting", exit: "Say nothing and eat.", answers: [
      { re: /^Ask whose place it is\./, slug: "whose_place", name: "Whose place it is" },
      { re: /^Put the dropped manifest on the plate\./, slug: "the_manifest", name: "The manifest on the plate", exitOnly: "Eat what Bez gives you." } ] }
  };

  for (const [pid, spec] of Object.entries(SPEC)) {
    const parent = byId(pid); if (!parent) { conflicts.push(`${pid}: not found`); continue; }
    const chs = Array.isArray(parent.choices) ? parent.choices : [];
    // 1) rewire the parent's choices; collect the answer texts
    const made = [];
    for (const a of spec.answers) {
      const ch = chs.find(c => a.re.test(String(c?.label || "")));
      if (!ch) { conflicts.push(`${pid}: choice ${a.re} not found`); continue; }
      const id = `ans_${pid}_${a.slug}`;
      if (ch.next === id) { made.push({ a, id, text: null, ch }); continue; }
      if (String(ch.next || "").trim()) { conflicts.push(`${pid}: "${ch.label}" already routes to ${ch.next} — left alone`); continue; }
      const text = String(ch.description || "").trim();
      if (!text) { conflicts.push(`${pid}: "${ch.label}" has no answer text`); continue; }
      ch.next = id; ch.description = "";
      changes++; report.push(`✎ ${pid}: "${ch.label}" → ${id}`);
      made.push({ a, id, text, ch });
    }
    // 2) build each answer beat (choices = the parent's OTHER choices, after rewiring, + the exit)
    for (const m of made) {
      if (byId(m.id)) continue;
      if (m.text == null) { conflicts.push(`${m.id}: parent routes here but the beat is missing`); continue; }
      const exitLabel = m.a.exitOnly || spec.exit;
      let choices;
      if (m.a.exitOnly) choices = [];
      else choices = chs.filter(c => c !== m.ch && !(String(c?.label || "").trim() === exitLabel)).map(C);
      choices.push({ label: exitLabel, next: "", description: "", checkStat: "", checkDC: 0, failNext: "" });
      const b = {
        id: m.id, label: `${spec.title} — ${m.a.name}`, type: "dialog", tags: String(parent.tags || ""), politicalTags: "",
        speakerActorId: parent.speakerActorId || null, sceneId: parent.sceneId || null, hexName: null, targetHexUuid: null,
        outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, refs: {},
        playerFacing: !!parent.playerFacing, playerFacingDialog: !!parent.playerFacingDialog, dialogPlayerFacing: !!parent.dialogPlayerFacing,
        playerFacingContent: !!parent.playerFacingContent, showToPlayers: !!parent.showToPlayers,
        description: m.text, choices,
        inject: { repeatable: true, evergreen: true, requires: [{ flag: "storyPhase", gte: 2 }] },
        dialogueOffer: false, timeScale: "moment", timePoints: 0, worldEffects: {}
      };
      beats.push(b); changes++;
      report.push(`+ ${m.id} (${choices.length} choice(s): ${choices.map(c => c.label).join(" · ")})`);
    }
  }

  console.log(`[kt official word answers 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktOwAnswers = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-ow-answers-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the Official Word's questions get answers.`);
})();
