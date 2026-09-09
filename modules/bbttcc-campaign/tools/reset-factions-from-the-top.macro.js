/* reset-factions-from-the-top.macro.js — factions back to Tier 0 for a
 * From-The-Top run (2026-09-08, owner request; supersedes the tier half of
 * patch-green-ring-and-tier-reset 2026-09-04).
 *
 * What a bare "tier = 0" leaves behind, and what this macro closes:
 *   · OP caps never lower on their own → rebanded to T0 (50 marks/bucket),
 *     but never below what is banked (no confiscation) — via
 *     api.factions.tier.set.
 *   · The Story Director's factionTierFloor re-promotes coalition factions on
 *     the next turn tick → CLEAR_FLOORS zeroes it (and the steward level floor
 *     + latched level prompts, so a fresh run prompts again).
 *   · Surviving VP re-satisfies the Identity gate (VP ≥ 5 = "rising") and the
 *     stability streak carries over → ZERO_PROGRESS zeroes VP/unity and the
 *     progression snapshots.
 *   · Turn output still on the map → CLEAR_ROUTES_AND_BU zeroes the factions'
 *     Build Units and strips trade/supply route edges (both ends + pending)
 *     on every scene; REPAIR_INTEGRATION pulls any hex over the 0–6 cap back
 *     to 6 (a founding activity used to write 7/6).
 *   NOT touched (deliberately — holdings are the world, not the faction's
 *   ledger): hex ownership and integration progress ≤ 6, garrisons, opBank
 *   marks, morale, loyalty, darkness, sparks, warLogs history (a
 *   "tier_reduce" milestone is appended), learned maneuvers/unlocks, quest
 *   tracks. For a true rewind use 💾 Save Games (golden master).
 *
 * Writes tier 0 explicitly (never unsetFlag — a missing tier is backfilled
 * from the VP badge on the next turn). Backs up every touched faction's
 * flags to a JSON download first. Idempotent. DRY_RUN default true. Run as GM.
 * Marker: [FACTIONS-FROM-THE-TOP-2026-09-08]
 */
(async () => {
  const DRY_RUN       = true;          // <-- set false to apply
  const SCOPE         = "coalition";   // "coalition" = the active campaign's factions · "all" = every faction actor
  const ZERO_PROGRESS = true;          // VP/unity → 0, progression.victory/stability snapshots reset
  const CLEAR_FLOORS  = true;          // directorState.factionTierFloor/stewardLevelFloor → 0, levelPrompts cleared
  const CLEAR_ROUTES_AND_BU = true;    // faction Build Units → 0; trade/supply routes stripped from every hex the faction owns (both ends + pending)
  const REPAIR_INTEGRATION  = true;    // any hex with integration progress > 6 → 6 (the 0–6 track's cap)
  const NS = "bbttcc-campaign", MODF = "bbttcc-factions";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const tierApi = game.bbttcc?.api?.factions?.tier;
  if (!tierApi?.set) return ui.notifications.error("api.factions.tier.set missing — reload after deploying bbttcc-factions.");
  const isFaction = a => { try { return !!a?.getFlag(MODF, "isFaction") || a?.system?.details?.type?.value === "faction" || !!a?.flags?.[MODF]?.opBank; } catch (_e) { return false; } };

  // ── resolve factions ──────────────────────────────────────────────────────
  let factions = [];
  if (SCOPE === "all") {
    factions = game.actors.filter(isFaction);
  } else {
    const capi = game.bbttcc?.api?.campaign;
    const cid = capi?.getActiveCampaignId?.() || game.settings.get(NS, "activeCampaignId");
    const camp = cid ? capi?.getCampaign?.(cid) : null;
    if (!camp) return ui.notifications.error("No active campaign — set SCOPE = \"all\" or activate one.");
    const refs = [...(Array.isArray(camp.factionIds) ? camp.factionIds : []), camp.factionId].filter(Boolean);
    const seen = new Set();
    for (const ref of refs) {
      let a = null; const s = String(ref);
      try { a = s.startsWith("Actor.") ? await fromUuid(s) : game.actors.get(s); } catch (_e) {}
      if (a?.id && !seen.has(a.id)) { seen.add(a.id); factions.push(a); }
    }
  }
  if (!factions.length) return ui.notifications.warn("No factions resolved.");

  // ── plan ──────────────────────────────────────────────────────────────────
  const report = [];
  const plan = [];
  for (const f of factions) {
    const flags = f.flags?.[MODF] || {};
    const tier = Number(flags.tier ?? 0) || 0;
    const vp = Number(flags.victory?.vp) || 0, unity = Number(flags.victory?.unity) || 0;
    const hasProg = !!(flags.progression && (flags.progression.victory || flags.progression.stability));
    const needTier = tier !== 0 || (flags.opCaps && Object.values(flags.opCaps).some(v => Number(v) > 50 && true));
    const needProg = ZERO_PROGRESS && (vp || unity || hasProg);
    if (!needTier && !needProg) { report.push(`· ok ${f.name}: already T0${ZERO_PROGRESS ? ", no progress to clear" : ""}`); continue; }
    report.push(`✚ ${f.name}: tier ${tier} → 0${needProg ? ` · VP ${vp}→0 · unity ${unity}→0 · progression cleared` : ""}`);
    plan.push({ f, needTier, needProg });
  }
  // hex-side work (routes + integration cap), planned across EVERY scene
  const MOD_T = "bbttcc-territory";
  const factionIds = new Set(factions.map(f => f.id));
  const hexOps = [];   // { scene, updates: [{_id, ...}], notes: [] }
  let routesCleared = 0, buCleared = 0, integFixed = 0;
  if (CLEAR_ROUTES_AND_BU || REPAIR_INTEGRATION) {
    for (const scene of game.scenes) {
      const updates = [];
      for (const d of scene.drawings) {
        const f = d.flags?.[MOD_T];
        if (!f) continue;
        const upd = { _id: d.id };
        let touched = false;
        if (CLEAR_ROUTES_AND_BU) {
          const owned = factionIds.has(String(f.factionId || f.ownerId || ""));
          const routes = Array.isArray(f.routes) ? f.routes : [];
          const pendR = Array.isArray(f.turn?.pending?.routes) ? f.turn.pending.routes : [];
          // strip edges on the owned hex, AND edges on any hex that point at an owned hex
          const pointsAtOwned = (r) => { try { const o = fromUuidSync(r?.hexUuid); return factionIds.has(String(o?.flags?.[MOD_T]?.factionId || o?.flags?.[MOD_T]?.ownerId || "")); } catch (_e) { return false; } };
          const keepRoutes = owned ? [] : routes.filter(r => !pointsAtOwned(r));
          const keepPend = owned ? [] : pendR.filter(r => !pointsAtOwned(r));
          if (keepRoutes.length !== routes.length) { upd[`flags.${MOD_T}.routes`] = keepRoutes; routesCleared += routes.length - keepRoutes.length; touched = true; }
          if (keepPend.length !== pendR.length) { const pend = foundry.utils.deepClone(f.turn?.pending || {}); pend.routes = keepPend; upd[`flags.${MOD_T}.turn.pending`] = pend; touched = true; }
        }
        if (REPAIR_INTEGRATION) {
          const p = Number(f.integration?.progress);
          if (Number.isFinite(p) && p > 6) { upd[`flags.${MOD_T}.integration.progress`] = 6; integFixed++; touched = true; }
        }
        if (touched) updates.push(upd);
      }
      if (updates.length) hexOps.push({ scene, updates });
    }
    if (CLEAR_ROUTES_AND_BU) for (const f of factions) if ((Number(f.getFlag(MODF, "buildUnits")) || 0) > 0) buCleared++;
    if (routesCleared || buCleared || integFixed) report.push(`✚ Hexes/BU: ${routesCleared} route edge(s) stripped across ${hexOps.length} scene(s) · BU zeroed on ${buCleared} faction(s) · integration capped on ${integFixed} hex(es)`);
    else report.push("· ok hexes: no routes to strip, no BU banked, no integration over cap");
  }

  let ds = null;
  if (CLEAR_FLOORS) {
    try { ds = game.settings.get(NS, "directorState") || {}; if (typeof ds === "string") ds = JSON.parse(ds); } catch (_e) { ds = {}; }
    const fl = Number(ds.factionTierFloor) || 0, sl = Number(ds.stewardLevelFloor) || 0, lp = Object.keys(ds.levelPrompts || {}).length;
    if (fl || sl || lp) report.push(`✚ Director floors: factionTierFloor ${fl}→0 · stewardLevelFloor ${sl}→0 · ${lp} latched level prompt(s) cleared`);
    else { report.push("· ok Director floors already 0"); ds = null; }
  }

  console.log(`[reset-factions-from-the-top] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${plan.length} faction(s)${ds ? " + director floors" : ""}${hexOps.length ? ` + ${hexOps.length} scene(s) of hexes` : ""}\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`From-the-top DRY RUN: ${plan.length} faction(s)${ds ? " + floors" : ""}${hexOps.length ? ` + ${hexOps.length} scene(s)` : ""} would change (see console).`);
  if (!plan.length && !ds && !hexOps.length && !buCleared) return ui.notifications.info("From-the-top: nothing to do.");

  // ── backup ────────────────────────────────────────────────────────────────
  try {
    const backup = { kind: "factions-from-the-top-backup", ts: new Date().toISOString(),
      factions: plan.map(p => ({ id: p.f.id, name: p.f.name, flags: foundry.utils.deepClone(p.f.flags?.[MODF] || {}) })),
      directorState: ds ? foundry.utils.deepClone(ds) : null,
      hexes: hexOps.map(h => ({ sceneId: h.scene.id, drawings: h.updates.map(u => ({ id: u._id, flags: foundry.utils.deepClone(h.scene.drawings.get(u._id)?.flags?.[MOD_T] || {}) })) })) };
    saveDataToFile(JSON.stringify(backup, null, 2), "application/json", `backup-factions-from-the-top-${Date.now()}.json`);
  } catch (e) { console.warn("[reset-factions-from-the-top] backup failed (continuing)", e); }

  // ── apply ─────────────────────────────────────────────────────────────────
  let n = 0;
  for (const { f, needTier, needProg } of plan) {
    if (needProg) {
      const victory = foundry.utils.deepClone(f.getFlag(MODF, "victory") || {});
      victory.vp = 0; victory.unity = 0;
      const upd = { [`flags.${MODF}.victory`]: victory };
      const prog = foundry.utils.deepClone(f.getFlag(MODF, "progression") || {});
      if (prog.victory) prog.victory = { tierFromBadge: 0, meetsNextTier: false, badge: "none" };
      if (prog.stability) prog.stability = { stableTurns: 0, maxOverextDuringSpan: 0 };
      upd[`flags.${MODF}.progression`] = prog;
      await f.update(upd);
    }
    if (needTier) {
      const res = await tierApi.set(f, 0, { note: "From-the-top reset" });
      if (!res?.ok) console.warn("[reset-factions-from-the-top] tier set failed for", f.name, res);
    }
    n++;
  }
  if (ds) {
    ds.factionTierFloor = 0; ds.stewardLevelFloor = 0; ds.levelPrompts = {};
    await game.settings.set(NS, "directorState", ds);
  }
  for (const { scene, updates } of hexOps) {
    try { await scene.updateEmbeddedDocuments("Drawing", updates); }
    catch (e) { console.warn("[reset-factions-from-the-top] hex update failed on", scene.name, e); }
  }
  if (CLEAR_ROUTES_AND_BU) for (const f of factions) { try { if ((Number(f.getFlag(MODF, "buildUnits")) || 0) > 0) await f.setFlag(MODF, "buildUnits", 0); } catch (_e) {} }
  ui.notifications.info(`From-the-top: ${n} faction(s) reset to Tier 0${ds ? ", Director floors cleared" : ""}${routesCleared ? `, ${routesCleared} route edge(s) stripped` : ""}${buCleared ? `, BU zeroed ×${buCleared}` : ""}${integFixed ? `, integration capped ×${integFixed}` : ""}. Backup downloaded.`);
})();
