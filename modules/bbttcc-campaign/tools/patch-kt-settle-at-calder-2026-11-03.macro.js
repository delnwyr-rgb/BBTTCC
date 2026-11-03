/**
 * patch-kt-settle-at-calder-2026-11-03.macro.js — "GO AND SEE CALDER" GOES SOMEWHERE (failure pass 2026-11-03, live-caught after the
 * seal was restored). The Khezek-Tor step "The Mountain Squares Up" (khezek_hex_settles — completes the town quest and gates Act 3)
 * had no way in: no button, door, table row or autoFire. Its quest-log line says "STEWARDS, SEE ME, in chalk, underlined once. Go and
 * see Calder." — but Calder's menu (The Brace → Drax Calder Convo) never offered it. Only the GM Slate ▶ / Resume "Run next" could play it.
 * Calder's menu gets "STEWARDS, SEE ME — the chalkboard." → khezek_hex_settles, gated exactly like the settle beat itself (the mine
 * chapter + the Sealed Shaft closed, the town quest still open, Act 2+), placed above Leave.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const KT_SETTLE_AT_CALDER = (() => {
  const HOST = "khezek_tor_drax_calder_convo", TARGET = "khezek_hex_settles", LABEL = "STEWARDS, SEE ME — the chalkboard.";
  function apply(camp) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    const host = beats.find(b => b?.id === HOST), tgt = beats.find(b => b?.id === TARGET);
    if (!host || !tgt) { conflicts.push(`${!host ? HOST : TARGET} not found`); return { changes, report, conflicts }; }
    const requires = JSON.parse(JSON.stringify(Array.isArray(tgt.inject?.requires) ? tgt.inject.requires : []));
    host.choices = host.choices || [];
    const cur = host.choices.find(c => c?.next === TARGET);
    if (!cur) {
      const at = host.choices.findIndex(c => /^\W*leave/i.test(String(c?.label || "")) && !c.next);
      const ch = { label: LABEL, next: TARGET, description: "", checkStat: "", checkDC: 0, failNext: "", requires };
      if (at >= 0) host.choices.splice(at, 0, ch); else host.choices.push(ch);
      changes++; report.push(`✚ ${HOST}: "${LABEL}" → ${TARGET}`);
    } else if (JSON.stringify(cur.requires || []) !== JSON.stringify(requires)) { cur.requires = requires; changes++; report.push(`✚ ${HOST}: gate synced`); }
    return { changes, report, conflicts };
  }
  return { apply };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = KT_SETTLE_AT_CALDER;
} else (async () => {
  const DRY_RUN = (globalThis.__ktSettleDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = KT_SETTLE_AT_CALDER.apply(camp);
  console.log(`[kt settle at calder 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktSettle = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-settle-at-calder-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — Calder has the chalkboard (${changes}).`);
})();
