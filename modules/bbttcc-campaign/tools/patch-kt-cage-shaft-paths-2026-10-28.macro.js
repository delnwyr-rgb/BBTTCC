/**
 * patch-kt-cage-shaft-paths-2026-10-28.macro.js — Dave, 10-28: "I did the mind test, and got the receipt. I didn't get the
 * climb down the rope test. Don't I still need to climb down there and pull it up? What's the fiction here for reading
 * the plans getting the manifest?"
 * kt_cage_shaft's three choices all went straight to the manifest, and the way each one happened sat in the button
 * subtitle (shown BEFORE the pick). Now:
 *   · Climb down with the rope (Body 12) → ans "the rope goes slack … a hand, and in the hand, paper" → Bring it up.
 *   · Read the chart first (Mind 12) → ans: the chart says where the cage stopped, to the rung — PREPARATION, not the
 *     manifest. Then: climb down to that rung (Body 8 — you know where you're going) · send the cage down empty · come back.
 *   · Send the cage down empty → ans "it comes back up with the manifest on its floor. Nobody put it there." → Bring it up.
 * Every manifest route ends in kt_dropped_manifest as before; the parent's subtitles are cleared (they gave it away).
 * Answer beats follow the dead-end-sweep shape. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
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
  const report = []; const conflicts = []; let changes = 0;
  const PID = "kt_cage_shaft", MAN = "kt_dropped_manifest", FAIL = "kt_cage_shaft_fail";
  const parent = byId(PID);
  if (!parent || !byId(MAN) || !byId(FAIL)) return ui.notifications.error("kt_cage_shaft / manifest / fail beat missing.");
  const ch = (re) => (parent.choices || []).find(c => re.test(String(c?.label || "")));
  const rope = ch(/^Climb down with the rope/), chart = ch(/^Read the chart first/), cage = ch(/^Send the cage down empty/);
  if (!rope || !chart || !cage) return ui.notifications.error("kt_cage_shaft choices not as expected — nothing changed.");
  const C = (o) => ({ description: "", checkStat: "", checkDC: 0, failNext: "", ...o });
  const ans = (id, name, text, choices) => ({
    id, label: `Khezek-Tor — The Cage Shaft — ${name}`, type: "dialog", tags: String(parent.tags || ""), politicalTags: "",
    speakerActorId: parent.speakerActorId || null, sceneId: parent.sceneId || null, hexName: null, targetHexUuid: null,
    outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, refs: {},
    playerFacing: !!parent.playerFacing, playerFacingDialog: !!parent.playerFacingDialog, dialogPlayerFacing: !!parent.dialogPlayerFacing,
    playerFacingContent: !!parent.playerFacingContent, showToPlayers: !!parent.showToPlayers,
    description: text, choices, inject: { repeatable: true, evergreen: true, requires: [{ flag: "storyPhase", gte: 2 }] },
    dialogueOffer: false, timeScale: "moment", timePoints: 0, worldEffects: {}
  });
  const BRING = C({ label: "Bring it up.", next: MAN });
  const PLAN = [
    { c: rope, id: "ans_kt_cage_shaft_rope", name: "The Rope",
      fallback: "Four rungs below Four the rope goes slack in your hands and there is a hand, and in the hand, paper.",
      choices: () => [BRING] },
    { c: chart, id: "ans_kt_cage_shaft_chart", name: "The Chart",
      fallback: "The chart says where the cage stopped that night, to the rung. Sable has never told anyone that they know.",
      tail: " Now you know exactly how far down. Somebody still has to go and get it.",
      choices: () => [
        C({ label: "Climb down to that rung.", next: "ans_kt_cage_shaft_rope", checkStat: "body", checkDC: 8, failNext: FAIL, description: "You know where you're going." }),
        C({ label: "Send the cage down empty.", next: "ans_kt_cage_shaft_cage" }),
        C({ label: "Come back with better rope.", next: "" }) ] },
    { c: cage, id: "ans_kt_cage_shaft_cage", name: "The Empty Cage",
      fallback: "It comes back up with the manifest on its floor. Nobody put it there. Sable goes very still and writes down the time.",
      choices: () => [BRING] }
  ];
  for (const p of PLAN) {
    if (p.c.next !== p.id) {
      const text = (String(p.c.description || "").trim() || p.fallback) + (p.tail || "");
      p.text = text; p.c.next = p.id; p.c.description = "";
      changes++; report.push(`✎ ${PID}: "${p.c.label}" → ${p.id}${p.c.checkStat ? ` (${p.c.checkStat} ${p.c.checkDC}, fail → ${p.c.failNext})` : ""}`);
    }
    if (!byId(p.id)) {
      beats.push(ans(p.id, p.name, p.text || (p.fallback + (p.tail || "")), p.choices()));
      changes++; report.push(`+ ${p.id}`);
    }
  }

  console.log(`[kt cage shaft paths 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktCagePaths = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-cage-paths-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the chart shows the way; somebody still goes down.`);
})();
