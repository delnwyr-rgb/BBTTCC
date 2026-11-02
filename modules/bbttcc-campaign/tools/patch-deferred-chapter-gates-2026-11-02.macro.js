/**
 * patch-deferred-chapter-gates-2026-11-02.macro.js — click-through (2026-11-02): Act 2 could never reach Act 3.
 * The Act 3 card waits on `lyrenn_hex_settles`, and Lyrenn's settle required the Forest That Will Not Be Fought and the Gentle Pest
 * chapters to be COMPLETED — but every beat of both was deferred to the expansion pile on 2026-10-21 (patch-defer-expansion: an
 * appended `{flag:"storyPhase", gte:9}`, original kept on `beat._deferred`). A deferred chapter can never complete in the base game.
 *
 * Sweep: any beat or choice `requires` row `{questBucket: X, is: "completed"}` where X is a CHAPTER (or quest) whose beats are ALL
 * deferred comes off. The removed rows are kept on `beat._deferredGates` / `choice._deferredGates` (same convention as `_deferred`)
 * so restoring the expansion can put them back. Rows that ask a deferred chapter NOT to be completed (`isNot`) are always true and stay.
 * Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const DEFERRED_GATES_PATCH = (() => {
  const isDeferred = (b) => !!b?._deferred || (Array.isArray(b?.inject?.requires) && b.inject.requires.some(r => r && r.flag === "storyPhase" && Number(r.gte) >= 9));
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    // registry id → {quest, chapter} from the campaign's story data
    const reg = new Map();
    for (const [qk, q] of Object.entries(camp.story?.quests || {})) {
      if (q?.registryId) reg.set(String(q.registryId), { quest: qk, chapter: null });
      for (const [ck, ch] of Object.entries(q?.chapters || {})) if (ch?.registryId) reg.set(String(ch.registryId), { quest: qk, chapter: ck });
    }
    const beatsOf = (r) => beats.filter(b => b?.story?.quest === r.quest && (r.chapter ? b.story?.chapter === r.chapter : true));
    const deadIds = new Set();
    for (const [rid, r] of reg) { const bs = beatsOf(r); if (bs.length && bs.every(isDeferred)) deadIds.add(rid); }
    report.push(`· ${deadIds.size} chapter/quest id(s) are wholly deferred: ${[...deadIds].map(id => { const r = reg.get(id); return `${r.quest}${r.chapter ? "/" + r.chapter : ""}`; }).join(", ")}`);
    const strip = (holder, where, list) => {
      const arr = Array.isArray(list) ? list : (list && typeof list === "object" ? [list] : null); if (!arr) return null;
      const keep = [], gone = [];
      for (const row of arr) { if (row && row.questBucket != null && row.is === "completed" && deadIds.has(String(row.questBucket))) gone.push(row); else keep.push(row); }
      if (!gone.length) return null;
      holder._deferredGates = [...(Array.isArray(holder._deferredGates) ? holder._deferredGates : []), ...gone];
      changes += gone.length; report.push(`✚ ${where}: ${gone.length} gate(s) on a deferred chapter removed (${gone.map(g => { const r = reg.get(String(g.questBucket)); return r ? `${r.quest}/${r.chapter || "-"}` : g.questBucket; }).join(", ")})`);
      return keep;
    };
    for (const b of beats) {
      if (!b || isDeferred(b)) continue;                          // a deferred beat keeps its own gates — it is part of the pile
      const k = strip(b, b.id, b.inject?.requires); if (k) b.inject.requires = k;
      for (const c of (b.choices || [])) { const kc = strip(c, `${b.id} "${String(c?.label || "").slice(0, 40)}"`, c?.requires); if (kc) c.requires = kc; }
    }
    if (!changes) report.push("· nothing to change");
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = DEFERRED_GATES_PATCH;
} else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = DEFERRED_GATES_PATCH.apply(camp);
  console.log(`[deferred chapter gates 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__deferredGates = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-deferred-chapter-gates-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — no gate waits on a deferred chapter.`);
})();
