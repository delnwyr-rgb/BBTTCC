/* ============================================================================
 * Bad Eden — Purge stale hex turn-requests  (GM macro, one-time repair)
 * ----------------------------------------------------------------------------
 * Until 2026-10-01 api.turn.processRequests "removed" a handled hex request by
 * writing the reduced object back with setFlag — which MERGES, so nothing was
 * ever removed and every request re-applied on every Apply turn (Loyalty +1 /
 * Darkness −2 per turn for cleanseCorruption, status re-forced, etc.).
 * The engine now unsets handled keys, but requests that were ALREADY applied
 * are still sitting on live hexes and would be applied ONE more time on the
 * first post-fix Advance Turn. Run this BEFORE that turn.
 *
 * What it does, per hex with flags["bbttcc-territory"].requests:
 *   • a known key WITH evidence it was already applied  → unset (stale)
 *       cleanseCorruption — a "cleanse_corruption" entry in the hex dossier
 *       statusSet         — hex status already equals the requested status
 *       destroyHex        — hex already flagged destroyed
 *       clearRockslide    — neither Difficult Terrain nor Blocked Pass present
 *   • a known key with NO such evidence → kept (genuinely pending; the fixed
 *     engine applies it once and removes it)
 *   • any other key → never touched
 * It also REPORTS how many times cleanseCorruption was applied per hex (dossier
 * count; the dossier is capped, so this is a floor). Extra applications = n − 1.
 *
 * DRY_RUN = true  -> report only (no writes). Set false to apply.
 * REVERT_EXTRA_LOYALTY = false -> when true (and DRY_RUN false), also subtracts
 *   the extra cleanse applications (n − 1) from mods.loyalty. Darkness is NOT
 *   restored (it was clamped at 0, the true value is unknowable). Owner ruling.
 * Idempotent: a second run finds nothing stale. Run in each live world.
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set to false to actually write
  const REVERT_EXTRA_LOYALTY = false;   // <-- owner ruling; see header
  const MODT = "bbttcc-territory";
  const REVERT_MARK = "requestsRepair";  // stamps the loyalty revert so it never runs twice

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const has = (arr, name) => (Array.isArray(arr) ? arr : []).some(m => String(m).toLowerCase() === name.toLowerCase());
  const rows = [];
  for (const sc of game.scenes ?? []) {
    for (const d of sc.drawings ?? []) {
      const tf = d.flags?.[MODT];
      const req = tf?.requests;
      if (!req || typeof req !== "object" || !Object.keys(req).length) continue;

      const imps = Array.isArray(tf.improvements) ? tf.improvements : [];
      const cleanses = imps.filter(e => e?.source?.activity === "cleanse_corruption").length;
      const stale = [], pending = [], other = [];
      for (const key of Object.keys(req)) {
        if (key === "cleanseCorruption") (cleanses > 0 ? stale : pending).push(key);
        else if (key === "statusSet") (String(tf.status || "unclaimed") === String(req.statusSet) ? stale : pending).push(key);
        else if (key === "destroyHex") (tf.destroyed === true ? stale : pending).push(key);
        else if (key === "clearRockslide") ((!has(tf.modifiers, "Difficult Terrain") && !has(tf.modifiers, "Blocked Pass")) ? stale : pending).push(key);
        else other.push(key);
      }
      const extra = (stale.includes("cleanseCorruption") && !tf[REVERT_MARK]?.loyaltyReverted) ? Math.max(0, cleanses - 1) : 0;
      rows.push({ d, scene: sc.name, name: String(tf.name || d.text || d.id).replace(/\s+/g, " ").trim(), stale, pending, other, cleanses, extra, loyalty: Number(tf.mods?.loyalty || 0) });
    }
  }

  let unset = 0, reverted = 0;
  console.group("%c[purge-stale-hex-requests]", "font-weight:bold");
  for (const r of rows) {
    console.log(
      `${r.name}  [scene: ${r.scene}]` +
      `  stale=${r.stale.join(",") || "∅"}  pending(kept)=${r.pending.join(",") || "∅"}  other(kept)=${r.other.join(",") || "∅"}` +
      (r.cleanses ? `  cleanse applied ×${r.cleanses}${r.cleanses >= 2 ? ` (≥${r.cleanses - 1} extra: Loyalty +${r.cleanses - 1}, Darkness −${2 * (r.cleanses - 1)} before clamp)` : ""}  mods.loyalty now ${r.loyalty}` : "")
    );
    if (DRY_RUN) continue;
    for (const key of r.stale) { await r.d.unsetFlag(MODT, `requests.${key}`); unset += 1; }
    if (REVERT_EXTRA_LOYALTY && r.extra > 0) {
      const mods = foundry.utils.deepClone(r.d.flags?.[MODT]?.mods || {});
      mods.loyalty = Number(mods.loyalty || 0) - r.extra;
      await r.d.setFlag(MODT, "mods", mods);
      await r.d.setFlag(MODT, REVERT_MARK, { loyaltyReverted: r.extra, ts: Date.now() });
      reverted += 1;
      console.log(`   ↳ mods.loyalty ${r.loyalty} → ${mods.loyalty} (reverted ${r.extra} extra cleanse application(s))`);
    }
  }
  const staleTotal = rows.reduce((n, r) => n + r.stale.length, 0);
  const pendingTotal = rows.reduce((n, r) => n + r.pending.length, 0);
  console.log(`hexes with requests: ${rows.length} · stale keys: ${staleTotal} · pending kept: ${pendingTotal}` + (DRY_RUN ? "" : ` · unset: ${unset} · loyalty reverted on: ${reverted}`));
  console.groupEnd();

  ui.notifications.info(
    DRY_RUN
      ? `Stale hex requests (dry run): ${staleTotal} stale key(s) on ${rows.filter(r => r.stale.length).length} hex(es), ${pendingTotal} pending kept — see console. Set DRY_RUN=false to apply.`
      : `Stale hex requests: unset ${unset} key(s)${REVERT_EXTRA_LOYALTY ? `, loyalty reverted on ${reverted} hex(es)` : ""}. ${pendingTotal} pending kept.`
  );
})();
