/**
 * patch-courier-recognition-2026-11-03.macro.js — THE COURIER GETS RECOGNISED ON SCREEN (failure pass 2026-11-03, live-caught at the
 * Khezek-Tor toll post). "You know this man — the pilgrim keeping vigil at the Vacancy" and "You don't know him. Verna might." on the
 * three courier cards (kt_courier_has_a_face, ag_tallow_courier_hit / _miss) routed straight to the KT hub — the realisation that the
 * courier IS Wick lived only in the button subtitle ("The guest in the corner. The bed he never slept in.") and never got a card.
 * Same shape as the dead-end sweeps: each reply → one shared answer beat (`ans_kt_courier_*`) whose text is the old subtitle,
 * routing-only (dialogueOffer:false, no questId, act-2 gate, evergreen, moment/0), and the answer leads on to the hub exactly as the
 * button did. The answer's own button is the hub's way in, so nothing routes back into a parent.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const COURIER_RECOGNITION = (() => {
  const PARENTS = ["kt_courier_has_a_face", "ag_tallow_courier_hit", "ag_tallow_courier_miss"];
  const HUB = "khezek_tor_quest_scene";
  const ANSWERS = [
    { re: /^You know this man/, id: "ans_kt_courier_you_know_this_man", label: "Khezek Tor — You Know This Man", go: "Back down to the switchback." },
    { re: /^You don't know him\. Verna might/, id: "ans_kt_courier_verna_might", label: "Khezek Tor — Verna Might", go: "Back down to the switchback." }
  ];
  function apply(camp) {
    if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
    const byId = new Map(camp.beats.map(b => [b.id, b]));
    const report = [], conflicts = []; let changes = 0;
    if (!byId.has(HUB)) { conflicts.push(`${HUB} not found`); return { changes, report, conflicts }; }
    for (const pid of PARENTS) {
      const p = byId.get(pid); if (!p) { conflicts.push(`${pid} not found`); continue; }
      for (const A of ANSWERS) {
        const c = (p.choices || []).find(x => x && A.re.test(String(x.label || ""))); if (!c) continue;
        let a = byId.get(A.id);
        if (!a) {
          const text = String(c.description || "").trim(); if (!text) { conflicts.push(`${pid}: "${c.label}" has no subtitle text`); continue; }
          a = { id: A.id, label: A.label, type: "dialog", tags: p.tags || "", politicalTags: "", speakerActorId: null, sceneId: p.sceneId || null,
            hexName: p.hexName ?? null, targetHexUuid: p.targetHexUuid ?? null,
            outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, worldEffects: {}, refs: {},
            playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
            description: text, choices: [{ label: A.go, next: HUB, description: "", checkStat: "", checkDC: 0, failNext: "" }],
            dialogueOffer: false, timeScale: "moment", timePoints: 0,
            inject: { repeatable: true, oncePerHex: false, evergreen: true, requires: [{ flag: "storyPhase", gte: 2 }] } };
          camp.beats.splice(camp.beats.indexOf(p) + 1, 0, a); byId.set(A.id, a); changes++; report.push(`✚ ${A.id}`);
        }
        if (c.next !== A.id) { c.next = A.id; c.description = ""; changes++; report.push(`  ${pid}: "${c.label.slice(0, 30)}" → ${A.id}`); }
      }
    }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = COURIER_RECOGNITION;
} else (async () => {
  const DRY_RUN = (globalThis.__courierRecDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = COURIER_RECOGNITION.apply(camp);
  console.log(`[courier recognition 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__courierRec = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-courier-recognition-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — the courier is recognised on screen (${changes}).`);
})();
