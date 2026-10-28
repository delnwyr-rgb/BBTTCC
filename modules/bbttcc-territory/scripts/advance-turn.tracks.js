// modules/bbttcc-territory/scripts/advance-turn.tracks.js
// Bad Eden — Advance Turn Tracks Wrapper
//
// This wrapper runs AFTER the base territory.advanceTurn({apply:true}) logic.
// It handles:
//  - Radiation decay + spread
//  - Cleanup (Purified hexes clear Radiated/Contaminated + Darkness bonus drop)
//  - Cleanup aura (Purified hex cleans neighbors)
//  - Radiation bleed-off for factions resting in Purified hexes
//  - Darkness track from Radiated hexes
//  - Darkness thresholds (4/7/10) narrative pings
//  - Darkness → Morale pressure  (retired 2026-10-18, ruling 19: faction Morale is gone)
//  - Loyalty drift + OP stability (Phase 1)
//  - Loyalty unrest + Defense DC modifiers (Phase 2)
//  - Integration → Population modifiers
//  - Unity recompute (Spark + aligned hexes)
//  - Build Units from Materials pips (per faction, per turn)
//  - Trade Routes → Logistics OP (adjacency-based, active scene)
//
// Victory VP gain, resistance, and badges are handled by
//   bbttcc-factions/scripts/bbttcc-victory.enhancer.js
// and not touched here.

(() => {
  const TAG  = "[bbttcc-advanceTurnTracks]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";

  const clamp = (v,min,max) => Math.max(min, Math.min(max, Number(v || 0)));
  const gmIds = () => game.users.filter(u => u.isGM).map(u => u.id) ?? [];
// Table announcements (2026-10-12): Apply-time turn cards, track updates and raid round cards used
// to be hard-whispered to the GM list, so players never saw a Turn go by. World setting
// bbttcc-territory.tableAnnouncements decides: "public" (default) = whole table, "gm" = whisper.
const tableAudience = () => { try { if (game.settings.get("bbttcc-territory", "tableAnnouncements") === "gm") return (game.users ?? []).filter(u => u.isGM).map(u => u.id); } catch (_e) {} return []; };
  const facActors = () => (game.actors?.contents ?? []).filter(a => a.getFlag?.(MODF,"isFaction"));

  function isSephirothic(tf){
    const k = String(
      tf?.sephirotKey ||
      tf?.sephirotName ||
      tf?.sephirotUuid || ""
    ).toLowerCase();
    return ["keter","chokhmah","binah","chesed","geburah","gevurah","tiferet","netzach","hod","yesod","malkuth"].includes(k);
  }

  // --- Flag canonicalization ---
  // Some legacy pipelines accidentally store track data under:
  //   flags.bbttcc-factions["bbttcc-factions"].{morale,loyalty,victory}
  // Canonical is:
  //   flags.bbttcc-factions.{morale,loyalty,victory}
  async function normalizeFactionFlags(A){
    const f = A?.flags?.[MODF] || {};
    const nested = f?.[MODF];
    if (!nested || typeof nested !== "object") return false;

    const updates = {};
    // (morale canonicalization dropped — retired 2026-10-18, ruling 19)
    if (f.loyalty === undefined && nested.loyalty !== undefined) updates[`flags.${MODF}.loyalty`] = Number(nested.loyalty);
    if (f.victory === undefined && nested.victory !== undefined) updates[`flags.${MODF}.victory`] = nested.victory;

    // Remove the nested container to prevent future drift
    updates[`flags.${MODF}.${MODF}`] = null;

    if (!Object.keys(updates).length) return false;
    await A.update(updates);
    return true;
  }

  // --- Trend (Loyalty) warLog reconciliation ---
  // Some legacy turn pipelines write a fixed "Trend: Loyalty→1%" summary
  // even when the underlying flags did not change (e.g., due to rounding).
  // This pass rewrites (or appends) a Trend entry based on actual stored deltas.
  // (Morale dropped from the line — retired 2026-10-18, ruling 19.)
  async function reconcileTrendWarLog(A, beforeLoyalty, minIdx = Infinity) {
    try {
      if (!A) return;
      const afterLoyalty = Number(A.getFlag(MODF, "loyalty") ?? 0);
      const dl = afterLoyalty - Number(beforeLoyalty ?? 0);

      const wl = Array.isArray(A.getFlag(MODF, "warLogs")) ? A.getFlag(MODF, "warLogs").slice() : [];
      const now = Date.now();
      const date = (new Date(now)).toLocaleString();
      // Absolute after-values with the track-pass delta labelled (2026-10-01) — the old
      // "Morale→-1%" replaced turn-extensions' absolute line with a bare delta.
      const sg = n => (n > 0 ? `+${n}` : `${n}`);
      const summary = `Trend: Loyalty→${afterLoyalty}% (Δ${sg(dl)})`;

      // Find most recent Trend entry near "now" and rewrite it; otherwise append a new one.
      let idx = -1;
      for (let i = wl.length - 1; i >= 0; i--) {
        const e = wl[i] || {};
        const s = String(e.summary || "");
        if (!s.includes("Trend:")) continue;

        const ts = Number(e.ts || 0);
        // Only rewrite a Trend entry written during THIS turn (2026-10-01) — falling back to
        // "the last Trend" overwrote an earlier turn's history in place.
        // (turn-extensions' Trend line carries no ts — minIdx = warLog length before this
        // Advance marks it as this turn's.)
        if ((ts && (now - ts) < 5 * 60 * 1000) || i >= minIdx) idx = i;
        break;
      }

      if (idx >= 0) {
        wl[idx] = { ...wl[idx], ts: wl[idx].ts ?? now, date: wl[idx].date ?? date, type: wl[idx].type || "turn", summary };
      } else {
        wl.push({ ts: now, date, type: "turn", activity: "trend", summary });
      }

      await A.update({ [`flags.${MODF}.warLogs`]: wl });
    } catch (e) {
      console.warn(TAG, "Trend reconcile failed", e);
    }
  }

  // ===========================================================================
  // RADIATION DECAY + SPREAD
  // ===========================================================================

  const RAD_SPREAD_THRESHOLD = 3;
  const RAD_SPREAD_CHANCE    = 0.25;
  const RAD_MAX_NEIGHBORS    = 6;

  // World-wide, document-based (2026-10-01): these tracks used canvas placeables, so they only
  // ran on whatever scene the advancing GM was viewing. Hex docs + geometry from the document.
  function isHexDoc(doc) {
    const tf = doc?.flags?.[MODT];
    return !!tf && (tf.isHex === true || tf.kind === "territory-hex");
  }
  function docCenter(doc) {
    const w = Number(doc?.shape?.width || 0), h = Number(doc?.shape?.height || 0);
    return { x: Number(doc?.x || 0) + w / 2, y: Number(doc?.y || 0) + h / 2 };
  }
  // Adjacent hexes only: nearest six within ~1.1 × the hex's bounding size (ring 2 is ≥ 1.5×).
  function hexNeighborsOf(doc, all) {
    const c = docCenter(doc);
    const size = Math.max(Number(doc?.shape?.width || 0), Number(doc?.shape?.height || 0));
    const limit = size > 0 ? size * 1.1 : Infinity;
    return all
      .filter(o => o.id !== doc.id)
      .map(o => { const oc = docCenter(o); return { o, dist: Math.hypot(oc.x - c.x, oc.y - c.y) }; })
      .filter(e => e.dist <= limit)
      .sort((a,b) => a.dist - b.dist)
      .slice(0, RAD_MAX_NEIGHBORS)
      .map(e => e.o);
  }
  function hexDocsByScene() {
    const out = [];
    for (const sc of game.scenes ?? []) {
      const hexes = (sc.drawings?.contents ?? Array.from(sc.drawings ?? [])).filter(isHexDoc);
      if (hexes.length) out.push({ sc, hexes });
    }
    return out;
  }

  async function doRadiationDecayAndSpread() {
    const updates = [];
    const lines   = [];

    // One switch (owner ruling 2026-10-22): the hex Radiation level (mods.radiation, 0–3) does NOT
    // fade on its own — only cleanup (Purify, maneuvers, the GM) lowers it. A level-3 hex still
    // spreads: each turn, 25% per neighbour to raise a clean neighbour to level 1.
    const radApi = game.bbttcc?.api?.territory?.radiation;
    if (!radApi) { console.warn(TAG, "radiation api missing — spread skipped"); return; }
    for (const { sc, hexes } of hexDocsByScene()) {
      const seeds = hexes.filter(d => radApi.level(d) >= RAD_SPREAD_THRESHOLD);
      const raised = new Set();
      for (const src of seeds) {
        for (const n of hexNeighborsOf(src, hexes)) {
          if (raised.has(n.id) || radApi.level(n) >= 1) continue;
          if (Math.random() > RAD_SPREAD_CHANCE) continue;
          raised.add(n.id);
          const p = radApi.patch(n.flags?.[MODT] || {}, 1);
          updates.push(n.update({
            [`flags.${MODT}.mods`]: p.mods,
            [`flags.${MODT}.conditions`]: p.conditions,
            [`flags.${MODT}.modifiers`]: p.modifiers
          }, { parent: sc }));
          lines.push(`• <b>${foundry.utils.escapeHTML(n.name ?? n.text ?? n.id)}</b>: Radiation spread (now Radiated)`);
        }
      }
    }

    if (updates.length) await Promise.allSettled(updates);

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Radiation Update</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Radiation" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // CLEANUP: PURIFIED HEXES + DARKNESS BONUS DROP
  // ===========================================================================

  const CLEANUP_DARKNESS_DROP = 2;

  // A level-2/3 hex carried a production modifier; once it is cleaned, resources must follow.
  async function recomputeCleaned(docs) {
    const rc = game.bbttcc?.api?.territory?.recomputeHexResources;
    if (typeof rc !== "function") return;
    for (const d of docs) { try { await rc(d, { source: "radiation-cleanup" }); } catch (e) { console.warn(TAG, "recompute after cleanup failed", d?.id, e); } }
  }

  async function doCleanupPurified() {
    const cleansedByFaction = new Map();
    const updates = [];
    const hot = [];

    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MODT]; if (!tf) continue;
        const conds = Array.isArray(tf.conditions) ? tf.conditions.slice() : [];
        if (!conds.includes("Purified")) continue;

        const fid = String(tf.factionId || tf.ownerId || "");
        if (!fid) continue;

        // Purified → radiation level 0 (the one switch; its tags + production modifier come off with it).
        const p = game.bbttcc.api.territory.radiation.patch(tf, 0);
        if (game.bbttcc.api.territory.radiation.level(tf) >= 2) hot.push(d);

        updates.push(
          d.update({
            [`flags.${MODT}.conditions`]: p.conditions,
            [`flags.${MODT}.mods`]: p.mods,
            [`flags.${MODT}.modifiers`]: p.modifiers
          }, { parent: sc })
        );

        const list = cleansedByFaction.get(fid) || [];
        list.push(d.name ?? d.text ?? d.id);
        cleansedByFaction.set(fid, list);
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    await recomputeCleaned(hot);

    const gm = gmIds();
    const lines = [];

    for (const [fid, names] of cleansedByFaction.entries()) {
      const A = game.actors.get(fid); if (!A) continue;
      const box = foundry.utils.duplicate(A.getFlag(MODF, "darkness") || {});
      const before = typeof box.global === "number" ? box.global : 0;
      const after  = Math.max(0, before - CLEANUP_DARKNESS_DROP);
      if (after === before) continue;
      box.global = after;
      await A.update({ [`flags.${MODF}.darkness`]: box });
      lines.push(
        `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Cleansed ${names.length} hex${names.length>1?"es":""} `
        + `(${names.map(n=>foundry.utils.escapeHTML(n)).join(", ")}) — Darkness ↓ ${before} → ${after}`
      );
    }

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Cleanup Update</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Cleanup" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // CLEANUP AURA: PURIFIED HEX CLEANS NEIGHBORS
  // ===========================================================================

  async function doCleanupAura() {
    const gm = gmIds();
    const lines = [];

    for (const { sc, hexes } of hexDocsByScene()) {
      const sources = hexes.filter(d => {
        const conds = d.flags?.[MODT]?.conditions;
        return Array.isArray(conds) && conds.includes("Purified");
      });

      if (!sources.length) continue;

      const updates = [];
      const hot = [];
      for (const src of sources) {
        const nbrs = hexNeighborsOf(src, hexes);
        const cleaned = [];

        for (const n of nbrs) {
          const tf = n.flags?.[MODT] || {};
          const radApi = game.bbttcc.api.territory.radiation;
          if (radApi.level(tf) < 1) continue;
          const p = radApi.patch(tf, 0);
          if (radApi.level(tf) >= 2) hot.push(n);

          updates.push(n.update({
            [`flags.${MODT}.conditions`]: p.conditions,
            [`flags.${MODT}.mods`]: p.mods,
            [`flags.${MODT}.modifiers`]: p.modifiers
          }, { parent: sc }));

          cleaned.push(n.name ?? n.text ?? n.id);
        }

        if (cleaned.length) {
          const srcName = src.name ?? src.text ?? src.id;
          lines.push(
            `• <b>${foundry.utils.escapeHTML(srcName)}</b>: Aura cleansed → `
            + cleaned.map(x=>foundry.utils.escapeHTML(x)).join(", ")
          );
        }
      }

      if (updates.length) await Promise.allSettled(updates);
      await recomputeCleaned(hot);
    }

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Cleanup Aura</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Cleanup" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // RADIATION BLEED-OFF: PURIFIED HEXES → FACTION RP
  // ===========================================================================

  async function doRadiationBleedPurifiedActors() {
    const rad = game.bbttcc?.api?.radiation;
    if (!rad || typeof rad.get !== "function" || typeof rad.set !== "function") {
      return; // Radiation module not active
    }

    const facs = facActors();
    const gm   = gmIds();
    const lines = [];

    // Pre-scan scenes & hexes: all Purified hexes, once
    const allHexes = [];
    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MODT];
        if (!tf) continue;
        const conds = Array.isArray(tf.conditions) ? tf.conditions : [];
        if (!conds.includes("Purified")) continue;
        allHexes.push({ doc: d, tf, conds });
      }
    }
    if (!allHexes.length) return;

    for (const A of facs) {
      let purifiedCount = 0;
      for (const { tf } of allHexes) {
        const owner = tf.factionId || tf.ownerId;
        if (String(owner) === String(A.id)) purifiedCount++;
      }
      if (!purifiedCount) continue;

      const before = rad.get(A);
      if (!before || before <= 0) continue;

      const drop  = Math.min(before, purifiedCount);
      const after = await rad.set(A.id, before - drop);

      lines.push(
        `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Radiation cleansed `
        + `−${drop} (from ${before} → ${after}) `
        + `via ${purifiedCount} Purified hex${purifiedCount>1?"es":""}`
      );
    }

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Radiation Cleansing (Purified Hexes)</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Radiation" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // DARKNESS TRACK (FROM RADIATED HEXES)
  // ===========================================================================

  const DARK_CAP = 10;

  // DARKNESS BANDS (owner ruling 2026-10-28) — every band bites, and each includes the ones below it:
  //   1–3 Shaded     income −5% next turn
  //   4–6 Shadowed   income −10%, Loyalty −1 a turn (and no upward drift), the unrest roll opens
  //   7–9 Intrusion  income −15%, Loyalty −1, unrest, and the dark leaks: one neighbouring hex's
  //                  Radiation +1 each turn (Radiated → Contaminated), a neighbour's before your own
  //   10  Calamity   income −20%, Loyalty −2, unrest, the leak, and your least loyal hex loses 2
  //                  integration and turns Hostile
  // (Travel DC +2, Qliphothic spikes and leyline rot at 7+ are unchanged.)
  const DARK_BANDS = [
    { min: 10, key: "calamity",  label: "Calamity",  incomePct: -20, loyalty: -2 },
    { min: 7,  key: "intrusion", label: "Intrusion", incomePct: -15, loyalty: -1 },
    { min: 4,  key: "shadowed",  label: "Shadowed",  incomePct: -10, loyalty: -1 },
    { min: 1,  key: "shaded",    label: "Shaded",    incomePct: -5,  loyalty: 0 }
  ];
  function factionDarkness(A) {
    const box = A?.getFlag?.(MODF, "darkness");
    return Math.max(0, Math.min(DARK_CAP, Number((box && typeof box === "object") ? box.global : box) || 0));
  }
  function darknessBand(g) {
    const n = Number(g) || 0;
    return DARK_BANDS.find(b => n >= b.min) || { min: 0, key: "clear", label: "Clear", incomePct: 0, loyalty: 0 };
  }
  function ownsHex(fid, tf){ const o = tf?.factionId || tf?.ownerId; return String(o) === String(fid); }
  function isRadiated(tf){ return Number(tf?.mods?.radiation || 0) > 0; }   // the hex Radiation level (2026-10-22)
  // Dark ground (owner ruling 2026-10-28: "make Hex Darkness feed Domain Darkness"): a held hex at Darkness 3+ adds +1
  // to its Domain each turn, like radiated ground (the two stack: +1 each). 1–2 pips are a warning only.
  const HEX_DARK_FEED = 3;
  function isDarkGround(tf){ return Number(tf?.mods?.darkness || 0) >= HEX_DARK_FEED; }

  async function doDarknessTrack() {
    const facs = facActors();
    const gm   = gmIds();
    const lines = [];

    for (const A of facs) {
      let ownedRadiated = 0, ownedDark = 0, blessed = 0;
      for (const sc of game.scenes ?? []) {
        for (const d of sc.drawings ?? []) {
          const tf = d.flags?.[MODT]; if (!tf) continue;
          if (!ownsHex(A.id, tf)) continue;
          if (isRadiated(tf)) ownedRadiated++;
          if (isDarkGround(tf)) ownedDark++;
          // Sanctum Expansion (2026-09-09): each Blessed Ground hex you hold is −1 Darkness per turn.
          if (Array.isArray(tf.modifiers) && tf.modifiers.some(m => String(m).toLowerCase() === "blessed ground")) blessed++;
        }
      }

      const box = foundry.utils.duplicate(A.getFlag(MODF, "darkness") || {});
      let g = typeof box.global === "number"
        ? box.global
        : (typeof box === "number" ? box : 0);

      const before = g;
      // Owner ruling 2026-10-28: Darkness does NOT fade on its own — "Darkness is the reason to cooperate; it
      // should be real." It falls only through deliberate work: Blessed Ground (below), cleansing a hex, the
      // rites and councils in the planner, story beats. (A clean Domain used to shed 1 a turn for free.)
      if (ownedRadiated > 0) g = Math.min(DARK_CAP, g + 1);
      if (ownedDark > 0)     g = Math.min(DARK_CAP, g + 1);
      if (blessed > 0)       g = Math.max(0, g - blessed);

      if (g !== before) {
        const next = (typeof box === "object" && box) ? box : {};
        next.global = g;
        await A.update({ [`flags.${MODF}.darkness`]: next });
        const dir = (g > before) ? "↑" : "↓";
        lines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Darkness ${dir} ${before} → ${g}`
          + (ownedRadiated>0 ? ` (radiated hexes: ${ownedRadiated})` : "") + (ownedDark>0 ? ` (dark ground, Darkness ${HEX_DARK_FEED}+: ${ownedDark})` : "") + (blessed>0 ? ` (Blessed Ground: ${blessed})` : "")
        );
      }
    }

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Darkness Update</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Darkness" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // DARKNESS THRESHOLDS (4/7/10) — NARRATIVE PINGS
  // ===========================================================================

  // Bands with teeth (owner ruling 2026-10-28) — Intrusion leaks Radiation into a neighbouring hex,
  // Calamity breaks the Domain's least loyal hex. Income / Loyalty bites live in doLoyaltyPhase1,
  // the unrest roll in doLoyaltyPhase2. Both rows also land in the Domains' war logs.
  async function _darkWarLog(A, summary, extra = {}) {
    try {
      const wl = Array.isArray(A.getFlag(MODF, "warLogs")) ? A.getFlag(MODF, "warLogs").slice() : [];
      wl.push({ ts: Date.now(), date: new Date().toLocaleString(), type: "turn", activity: "darkness_band", summary, ...extra });
      await A.update({ [`flags.${MODF}.warLogs`]: wl });
    } catch (e) { console.warn(TAG, "darkness war log failed", e); }
  }

  async function doDarknessThresholds() {
    const facs = facActors();
    const lines4 = [];
    const lines7 = [];
    const lines10 = [];
    const radApi = game.bbttcc?.api?.territory?.radiation;
    const byScene = hexDocsByScene();
    const leaked = new Set();   // one leak per hex per turn, whoever's Darkness caused it

    for (const A of facs) {
      const g = factionDarkness(A);
      const band = darknessBand(g);
      const name = foundry.utils.escapeHTML(A.name);

      if (g >= 4 && g <= 6) {
        lines4.push(`• <b>${name}</b> (Darkness ${g}, Shadowed): income ${band.incomePct}%, Loyalty ${band.loyalty} a turn, unrest stirs`);
      }

      // INTRUSION (7+) — the dark leaks: one hex next to the Domain's ground gains a Radiation level
      // (Radiated → Contaminated, never past 2 from this), a neighbour's hex before the Domain's own.
      if (g >= 7) {
        let pick = null;
        if (radApi) {
          const outside = [], inside = [];
          for (const { hexes } of byScene) {
            const mine = hexes.filter(d => String(d.flags?.[MODT]?.factionId || d.flags?.[MODT]?.ownerId) === String(A.id));
            if (!mine.length) continue;
            for (const h of mine) {
              for (const n of hexNeighborsOf(h, hexes)) {
                if (leaked.has(n.id) || radApi.level(n) >= 2) continue;
                const own = String(n.flags?.[MODT]?.factionId || n.flags?.[MODT]?.ownerId) === String(A.id);
                (own ? inside : outside).push({ n });
              }
              if (!leaked.has(h.id) && radApi.level(h) < 2) inside.push({ n: h });
            }
          }
          const pool = outside.length ? outside : inside;
          if (pool.length) pick = pool[Math.floor(Math.random() * pool.length)].n;
        }
        if (pick) {
          leaked.add(pick.id);
          const before = radApi.level(pick);
          const after = await radApi.set(pick, before + 1, { source: "darkness_intrusion" });
          const hexName = pick.flags?.[MODT]?.name || pick.text || pick.name || pick.id;
          const ownerId = pick.flags?.[MODT]?.factionId || pick.flags?.[MODT]?.ownerId;
          const B = ownerId ? game.actors.get(String(ownerId)) : null;
          const rung = after >= 2 ? "Contaminated" : "Radiated";
          lines7.push(`• <b>${name}</b> (Darkness ${g}, Intrusion): the dark leaks into <b>${foundry.utils.escapeHTML(hexName)}</b> — Radiation ${before} → ${after} (${rung})${B && B.id !== A.id ? `, held by ${foundry.utils.escapeHTML(B.name)}` : ""}`);
          await _darkWarLog(A, `Darkness ${g} (Intrusion): the dark leaked into ${hexName} — Radiation ${before} → ${after} (${rung}).`, { hexUuid: pick.uuid });
          if (B && B.id !== A.id) await _darkWarLog(B, `${A.name}'s Darkness leaked into ${hexName} — Radiation ${before} → ${after} (${rung}). A radiated hex raises your Darkness every turn until it is cleansed.`, { hexUuid: pick.uuid, sourceFactionId: A.id });
        } else {
          lines7.push(`• <b>${name}</b> (Darkness ${g}, Intrusion): income ${band.incomePct}%, Loyalty ${band.loyalty} a turn — no clean hex left nearby to leak into`);
        }
      }

      // CALAMITY (10) — the Domain's least loyal hex breaks: integration −2 and Hostile Population.
      if (g >= 10) {
        const owned = ownedHexDocs(A);
        const hex = owned.slice().sort((a, b) => hexLoyaltyScore(a.flags?.[MODT] || {}) - hexLoyaltyScore(b.flags?.[MODT] || {}))[0];
        if (hex) {
          const tf = hex.flags?.[MODT] || {};
          const integ = foundry.utils.duplicate(tf.integration || {});
          const pBefore = Number(integ.progress ?? tf.integrationProgress ?? 0) || 0;
          integ.progress = Math.max(0, pBefore - 2);
          const mods = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
          const addHostile = !mods.includes("Hostile Population");
          if (addHostile) mods.push("Hostile Population");
          const patch = { [`flags.${MODT}.integration`]: integ, [`flags.${MODT}.modifiers`]: mods };
          if (tf.integrationProgress !== undefined) patch[`flags.${MODT}.integrationProgress`] = integ.progress;
          await hex.update(patch, { parent: hex.parent });
          if (addHostile) {
            try { const rec = game?.bbttcc?.api?.territory?.recordHexModifierTransition; if (typeof rec === "function") await rec(hex, "Hostile Population", "added", { activity: "darkness_calamity", factionId: A.id }, `calamity:${hex.id}:${Date.now()}`); } catch (_e) {}
          }
          const hexName = tf.name || hex.text || hex.name || hex.id;
          lines10.push(`• <b>${name}</b> (Darkness ${g}): <span style="color:#b22222"><b>Calamity</b></span> — ${foundry.utils.escapeHTML(hexName)} integration ${pBefore} → ${integ.progress}${addHostile ? ", now Hostile" : ""}`);
          await _darkWarLog(A, `Darkness ${g} (Calamity): ${hexName} breaks — integration ${pBefore} → ${integ.progress}${addHostile ? ", Hostile Population" : ""}.`, { hexUuid: hex.uuid });
        }
      }
    }

    const mk = async (title, arr) => arr.length && ChatMessage.create({
      content: `<p><b>${title}</b></p>${arr.join("<br/>")}`,
      whisper: tableAudience(),
      speaker: { alias: "Bad Eden Darkness" }
    }).catch(()=>{});

    await mk("Darkness — Shadowed (4–6)", lines4);
    await mk("Darkness — Intrusion (7–9)", lines7);
    await mk("Darkness — Calamity (10)", lines10);
  }

  // ===========================================================================
  // DARKNESS → MORALE PRESSURE — RETIRED 2026-10-18 (ruling 19)
  // ===========================================================================
  // Faction Morale is no longer a game meter. This pass used to move
  // flags.bbttcc-factions.morale −1 per turn under Darkness ≥ 1 (unless
  // bonuses.nextTurn.noMoraleLoss) and +1 toward 50 at Darkness 0, then whisper a
  // "Morale Update (Darkness)" card. It did nothing else, so it is now a no-op;
  // Darkness pressure reaches the table through Stress / Extension instead.
  async function doDarknessMorale() { /* retired 2026-10-18, ruling 19 */ }

  // ===========================================================================
  // LOYALTY PHASE 1 — DRIFT + OP STABILITY
  // ===========================================================================

  // ===========================================================================
  // HEX LOYALTY → FACTION LOYALTY (owner ruling 2026-09-12)
  // "Faction loyalty is, more or less, an aggregate of its hexes." Each hex has a
  // loyalty SCORE = mods.loyalty (the signed running total the sweep, repair
  // requests and ⚗ fuel side effects write) + the loyalty the modifier registry
  // promises (Loyal Population +2, Hostile Population −2, Well-Maintained +1,
  // Damaged Infrastructure −1). The mean score across owned hexes, clamped to
  // ±3, is a per-turn PULL on faction loyalty, applied before drift/penalties
  // so a territory worked by pressed gangs drags the faction down every turn
  // and a loyal, well-kept one lifts it. Hexes with no score contribute 0.
  // ===========================================================================
  // Hex loyalty score is a FACT owned by territory main.js (2026-09-12) — read it, never re-derive it.
  function hexLoyaltyScore(tf) { const fn = game.bbttcc?.facts?.hex?.loyaltyScore; return (typeof fn === "function") ? fn(tf) : 0; }
  function ownedHexDocs(A) {
    const out = [];
    for (const sc of game.scenes ?? []) for (const d of sc.drawings ?? []) { const tf = d.flags?.[MODT]; if (!tf) continue; if (String(tf.factionId || tf.ownerId) === String(A.id)) out.push(d); }
    return out;
  }
  async function doHexLoyaltyPull() {
    const facs = facActors(); const gm = gmIds(); const lines = []; const updates = [];
    for (const A of facs) {
      const owned = ownedHexDocs(A); if (!owned.length) continue;
      const scores = owned.map(d => hexLoyaltyScore(d.flags?.[MODT] || {}));
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const pull = Math.max(-3, Math.min(3, Math.round(mean)));
      if (!pull) continue;
      const before = Number(A.getFlag(MODF, "loyalty") ?? 50); const after = clamp(before + pull, 0, 100);
      if (after === before) continue;
      updates.push(A.update({ [`flags.${MODF}.loyalty`]: after }));
      lines.push(`• <b>${foundry.utils.escapeHTML(A.name)}</b>: territory pull ${pull > 0 ? "+" : ""}${pull} (mean hex loyalty ${Math.round(mean * 10) / 10} over ${owned.length} hex${owned.length === 1 ? "" : "es"}) — Loyalty ${before}→${after}`);
    }
    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) await ChatMessage.create({ content: `<p><b>Territory → Loyalty</b></p>${lines.join("<br/>")}`, whisper: tableAudience(), speaker: { alias: "Bad Eden Loyalty" } }).catch(() => {});
  }

  // ===========================================================================
  // SHARING PRESSURE (owner ruling 2026-09-12, target T7)
  // The exchange engine keeps a ledger of Allied Sends and trades on both
  // factions (api.factions.sharing). A faction that has BORROWED (received a
  // net Allied Send) in three or more consecutive world turns is becoming a
  // client: −1 Loyalty per turn while the streak holds, and the GM sees it.
  // Lending costs nothing — the trace is the lever, the story spends it.
  // ===========================================================================
  async function doSharingPressure() {
    const api = game.bbttcc?.api?.factions?.sharing; if (!api?.get) return;
    const facs = facActors(); const gm = gmIds(); const lines = []; const updates = [];
    for (const A of facs) {
      let st = null; try { st = api.get(A.id); } catch (_e) { st = null; }
      if (!st || Number(st.borrowStreak) < 3) continue;
      const before = Number(A.getFlag(MODF, "loyalty") ?? 50); const after = clamp(before - 1, 0, 100);
      if (after !== before) updates.push(A.update({ [`flags.${MODF}.loyalty`]: after }));
      const patrons = Object.entries(st.borrowedFrom || {}).sort((a, b) => b[1].marks - a[1].marks).slice(0, 2).map(([, v]) => v.name).join(", ");
      lines.push(`• <b>${foundry.utils.escapeHTML(A.name)}</b> has borrowed ${st.borrowStreak} turns running${patrons ? ` (mostly from ${foundry.utils.escapeHTML(patrons)})` : ""} — the sheet is starting to call it a client state. Loyalty ${before}→${after}.`);
      try { const wl = (A.getFlag(MODF, "warLogs") || []).slice(); wl.push({ ts: Date.now(), date: new Date().toLocaleString(), type: "turn", activity: "sharing_pressure", summary: `Client-state pressure: borrowed ${st.borrowStreak} turns running — Loyalty ${before}→${after}.` }); updates.push(A.setFlag(MODF, "warLogs", wl)); } catch (_e) {}
    }
    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) await ChatMessage.create({ content: `<p><b>Sharing Pressure</b></p>${lines.join("<br/>")}`, whisper: tableAudience(), speaker: { alias: "Bad Eden Loyalty" } }).catch(() => {});
  }

  async function doLoyaltyPhase1() {
    const facs = facActors();
    const gm   = gmIds();
    const lines = [];
    const updates = [];

    for (const A of facs) {
      let L = Number(A.getFlag(MODF, "loyalty") ?? 50);
      const before = L;
      const band = darknessBand(factionDarkness(A));   // Darkness bands (2026-10-28)

      // Shadowed and worse: the people stop coming back on their own — no upward drift, and the band's pull.
      let drift = L < 50 ? +1 : (L > 50 ? -1 : 0);
      if (band.loyalty < 0 && drift > 0) drift = 0;
      L = clamp(L + drift + band.loyalty, 0, 100);

      let bonus = 0;
      if (L < 15)      bonus = -20;
      else if (L < 30) bonus = -10;
      else if (L > 85) bonus = +10;
      else if (L > 70) bonus = +5;
      bonus += band.incomePct;

      const bonusStored = Number(A.getFlag(MODF, "bonuses")?.nextTurn?.opGainPct ?? 0) || 0;
      if (L !== before || bonus !== bonusStored) {   // a band that lifted must clear its old penalty too
        // SET, never add (2026-09-21): the band IS the value for the next Advance — a running sum doubled the penalty
        // whenever the phase ran twice between expiries (Errata read −40% at loyalty 25; the band says −10%).
        updates.push(A.update({
          [`flags.${MODF}.loyalty`]: L,
          [`flags.${MODF}.bonuses.nextTurn.opGainPct`]: bonus
        }));

        lines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: `
          + `Loyalty ${L>before?"↑":L<before?"↓":""} ${before}→${L} `
          + `(Stability ${bonus>=0?"+":""}${bonus}% income next turn`
          + (band.min > 0 ? `; Darkness ${factionDarkness(A)} — ${band.label}: ${band.incomePct}% income${band.loyalty ? `, Loyalty ${band.loyalty}` : ""}` : "")
          + `)`
        );
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Loyalty Update</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Loyalty" }
      }).catch(()=>{});
    }
  }

  // ===========================================================================
  // LOYALTY PHASE 2 — UNREST + DEFENSE DC
  // ===========================================================================

  async function doLoyaltyPhase2() {
    const facs = facActors();
    const gm   = gmIds();
    const lines = [];
    const updates = [];
    const pick = arr => arr[Math.floor(Math.random()*arr.length)];

    for (const A of facs) {
      const L = Number(A.getFlag(MODF, "loyalty") ?? 50);
      const owned = [];

      for (const sc of game.scenes ?? []) {
        for (const d of sc.drawings ?? []) {
          const tf = d.flags?.[MODT];
          if (!tf) continue;
          const owner = tf.factionId || tf.ownerId;
          if (String(owner) === String(A.id)) owned.push(d);
        }
      }

      // Unrest risk — strikes the LEAST loyal hex (2026-09-12), and its odds follow that hex's
      // loyalty score (owner ruling, same day): base 10% at score 0, ±5% per point, clamped
      // 2%–60%. A work-gang hex at −2 riots at 20%; a Loyal Population hex at +2 sits at 2%.
      // The roll happens when faction loyalty is under 30 (the old gate) OR when the lowest hex
      // is at −3 or worse — a hostile-enough hex can riot even under a faction that is doing fine.
      const lowest = () => owned.slice().sort((a, b) => hexLoyaltyScore(a.flags?.[MODT] || {}) - hexLoyaltyScore(b.flags?.[MODT] || {}))[0];
      const lowScore = owned.length ? hexLoyaltyScore(lowest().flags?.[MODT] || {}) : 0;
      const unrestOdds = clamp(0.10 - 0.05 * lowScore, 0.02, 0.60);
      // The Town Militia, STANDING (STORY FLOW D-3, 2026-09-17): the garrison absorbs the FIRST unrest / infrastructure
      // strike on a home hex each turn (once per Advance; recorded on the militia flag)
      const militiaAbsorb = async (hex, what) => {
        try {
          const api = game.bbttcc?.api?.raid?.militia; if (!api?.state) return false;
          const ms = api.state(A); if (ms.rung < 3) return false;
          const nowTurn = (() => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch (_e) { return 0; } })();   // the world clock (worldState.turn)
          if (ms.absorbedTurn && ms.absorbedTurn === nowTurn) return false;
          const hn = String(hex?.flags?.[MODT]?.name || hex?.text || "").replace(/[\s\u00a0]+/g, " ").trim().toLowerCase();
          if (!ms.hexes.some(h => String(h).toLowerCase() === hn)) return false;
          await api.set(A, { absorbedTurn: nowTurn });
          lines.push(`• ${A.name}: the Town Militia (standing) absorbed the ${what} strike on ${hex.text || hex.name} this turn`);
          return true;
        } catch (_e) { return false; }
      };
      // #63 (2026-10-28): the militia only spends its once-per-turn absorb on a strike that would DO something — a hex
      // that already carries Hostile Population gains nothing, and the absorb used to burn on it.
      const _alreadyHostile = (h) => { const m = h?.flags?.[MODT]?.modifiers; return Array.isArray(m) && m.includes("Hostile Population"); };
      // Shadowed Darkness (4+) opens the roll too (2026-10-28) — fear does what low Loyalty does.
      const darkUnrest = factionDarkness(A) >= 4;
      if (owned.length > 0 && (L < 30 || lowScore <= -3 || darkUnrest) && Math.random() < unrestOdds && !_alreadyHostile(lowest()) && !(await militiaAbsorb(lowest(), "unrest"))) {
        const hex = lowest();
        const tf  = foundry.utils.deepClone(hex.flags[MODT] || {});
        tf.modifiers = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
        if (!tf.modifiers.includes("Hostile Population")) {
          tf.modifiers.push("Hostile Population");
          updates.push(hex.update({ [`flags.${MODT}`]: tf }, { parent: hex.parent }));
          lines.push(
            `• ${A.name}: <b>Unrest</b> — ${hex.text||hex.name} gained <i>Hostile Population</i> (faction Loyalty ${L}${darkUnrest ? `, Darkness ${factionDarkness(A)}` : ""}; hex score ${lowScore}, odds ${Math.round(unrestOdds * 100)}%)`
          );
          // Hex Dossier — record loyalty-driven unrest event.
          try {
            const modRecorder = game?.bbttcc?.api?.territory?.recordHexModifierTransition;
            if (typeof modRecorder === "function") {
              await modRecorder(hex, "Hostile Population", "added", { activity: "loyalty_unrest", factionId: A.id || "" }, `unrest:${hex.id}:${Date.now()}`);
            }
          } catch (eL) { /* non-fatal */ }
        }
      }

      // Extra bad: infra damage — also the least loyal hex, odds base 25% ±5%/point, 5%–75% (2026-09-12)
      const infraOdds = clamp(0.25 - 0.05 * lowScore, 0.05, 0.75);
      const _alreadyDamaged = (h) => { const m = h?.flags?.[MODT]?.modifiers; return Array.isArray(m) && m.includes("Damaged Infrastructure"); };   // #63
      if (L < 15 && owned.length > 0 && Math.random() < infraOdds && !_alreadyDamaged(lowest()) && !(await militiaAbsorb(lowest(), "infrastructure"))) {
        const hex = lowest();
        const tf  = foundry.utils.deepClone(hex.flags[MODT] || {});
        tf.modifiers = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
        if (!tf.modifiers.includes("Damaged Infrastructure")) {
          tf.modifiers.push("Damaged Infrastructure");
          updates.push(hex.update({ [`flags.${MODT}`]: tf }, { parent: hex.parent }));
          lines.push(
            `• ${A.name}: <b>Infrastructure</b> — ${hex.text||hex.name} gained <i>Damaged Infrastructure</i> (faction Loyalty ${L}; hex score ${lowScore}, odds ${Math.round(infraOdds * 100)}%)`
          );
          // Hex Dossier — record loyalty-driven infra damage.
          try {
            const modRecorder = game?.bbttcc?.api?.territory?.recordHexModifierTransition;
            if (typeof modRecorder === "function") {
              await modRecorder(hex, "Damaged Infrastructure", "added", { activity: "loyalty_unrest_infra", factionId: A.id || "" }, `infra:${hex.id}:${Date.now()}`);
            }
          } catch (eL) { /* non-fatal */ }
        }
      }

      // Defense DC bonus/penalty
      let dcBonus = 0;
      if (L < 15)      dcBonus = -2;
      else if (L < 30) dcBonus = -1;
      else if (L > 85) dcBonus = +2;
      else if (L > 70) dcBonus = +1;

      if (dcBonus !== 0) {
        updates.push(A.update({
          [`flags.${MODF}.bonuses.nextTurn.defenseDC`]: dcBonus   // SET, never add (2026-09-21) — see opGainPct
        }));
        lines.push(
          `• ${A.name}: Defense DC ${dcBonus>0?"+":""}${dcBonus} next raid (Loyalty ${L})`
        );
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Loyalty Stability Effects</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Loyalty" }
      }).catch(()=>{});
    }
  }

  // ===========================================================================
  // INTEGRATION → POPULATION MODIFIERS
  // ===========================================================================

  function normalizePopModifiers(mods) {
    const out = Array.isArray(mods) ? mods.slice() : [];
    const hasHostileSnake = out.includes("hostile_population");
    const hasHostileTitle = out.includes("Hostile Population");
    const hasLoyalSnake   = out.includes("loyal_population");
    const hasLoyalTitle   = out.includes("Loyal Population");

    const filtered = out.filter(m => m !== "hostile_population" && m !== "loyal_population");

    if (hasHostileSnake && !hasHostileTitle) filtered.push("Hostile Population");
    if (hasLoyalSnake   && !hasLoyalTitle)   filtered.push("Loyal Population");

    return filtered;
  }

  async function doIntegrationPopulationShift() {
    const gm = gmIds();
    const lines = [];
    const updates = [];

    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MODT]; if (!tf) continue;
        const integ = tf.integration;
        const prog = Number(integ?.progress ?? 0);
        if (!prog || prog <= 0) continue;

        let mods = normalizePopModifiers(tf.modifiers);
        let changed = false;

        if (prog >= 3) {
          const beforeLen = mods.length;
          mods = mods.filter(m => m !== "Hostile Population");
          if (mods.length !== beforeLen) changed = true;
        }

        if (prog >= 5) {
          if (!mods.includes("Loyal Population")) {
            mods.push("Loyal Population");
            changed = true;
          }
        }

        if (!changed) continue;

        const hexName = d.name ?? d.text ?? d.id;
        const beforeMods = Array.isArray(tf.modifiers) ? tf.modifiers.map(String) : [];
        updates.push(
          d.update({ [`flags.${MODT}.modifiers`]: mods }, { parent: sc })
        );
        lines.push(
          `• <b>${foundry.utils.escapeHTML(hexName)}</b>: Integration ${prog}/6 `
          + `→ population mood adjusted (${mods.join(", ")||"no modifiers"})`
        );
        // Hex Dossier — record integration-driven population mood diffs.
        try {
          const modRecorder = game?.bbttcc?.api?.territory?.recordHexModifierTransition;
          if (typeof modRecorder === "function") {
            const beforeSet = new Set(beforeMods);
            const afterSet  = new Set(mods.map(String));
            const dedupePrefix = `pop_shift:${d.id}:${Date.now()}`;
            for (const m of afterSet) {
              if (!beforeSet.has(m)) {
                await modRecorder(d, m, "added", { activity: "integration_population_shift" }, `${dedupePrefix}:add:${m}`);
              }
            }
            for (const m of beforeSet) {
              if (!afterSet.has(m)) {
                await modRecorder(d, m, "removed", { activity: "integration_population_shift" }, `${dedupePrefix}:rm:${m}`);
              }
            }
          }
        } catch (eL) { /* non-fatal */ }
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Integration Population Update</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Integration" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // UNITY RECOMPUTE (Spark + aligned hexes)
  // ===========================================================================

  function readAlign(tf) {
    const k =
      tf?.sephirahKey ??
      tf?.sephirah ??
      tf?.sephirotKey ??
      tf?.sephirotName ??
      tf?.sephirotUuid ??
      "";
    return String(k || "").toLowerCase();
  }

  function countAligned(fid) {
    const tally = {};
    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MODT]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId;
        if (String(owner) !== String(fid)) continue;
        const k = readAlign(tf);
        if (!k) continue;
        tally[k] = (tally[k] || 0) + 1;
      }
    }
    const best = Object.entries(tally).sort((a,b)=>b[1]-a[1])[0];
    return best ? { key: best[0], count: best[1] } : { key:null, count:0 };
  }

  // retired 2026-10-18, ruling 18: Unity meter removed; kept for reference, never called.
  // eslint-disable-next-line no-unused-vars
  async function doUnityRecompute() {
    const tikkun = game.bbttcc?.api?.tikkun;
    const facs = facActors();
    const ups  = [];

    for (const A of facs) {
      const gated = (tikkun && typeof tikkun.hasSpark === "function")
        ? await tikkun.hasSpark(A, "sparkOfMercy_Chesed")
        : false;

      const { count } = countAligned(A.id);
      const unityPct = gated ? Math.min(100, count * 10) : 0;

      const victory = foundry.utils.duplicate(A.getFlag(MODF, "victory") || {});
      if (Number(victory.unity || 0) !== unityPct) {
        victory.unity = unityPct;
        ups.push(A.update({ [`flags.${MODF}.victory`]: victory }));
      }
    }

    if (ups.length) await Promise.allSettled(ups);
  }

  // ===========================================================================
  // BUILD UNITS FROM MATERIALS PIPS
  // ===========================================================================

  async function doBuildUnitsFromMaterials() {
    const facs = facActors();
    if (!facs.length) return;

    // Tally Materials pips per faction from owned hexes
    const matsByFaction = new Map();
    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MODT];
        if (!tf) continue;
        const owner = tf.factionId || tf.ownerId;
        if (!owner) continue;
        const resources = (game.bbttcc?.facts?.hex?.resources ? game.bbttcc.facts.hex.resources(tf) : (tf.resources || {}));   // facts (2026-09-12)
        const mats = Number(resources.materials || 0);
        if (!mats) continue;
        const cur = matsByFaction.get(owner) || 0;
        matsByFaction.set(owner, cur + mats);
      }
    }

    if (!matsByFaction.size) return;

    const gm = gmIds();
    const lines = [];

    for (const [fid, totalMats] of matsByFaction.entries()) {
      const A = game.actors.get(fid);
      if (!A) continue;

      const gain = Math.floor(totalMats / 2); // every 2 Materials pips → 1 BU
      if (!gain) continue;

      const before = Number(A.getFlag(MODF, "buildUnits") ?? 0);
      const after  = before + gain;

      const warLogs = Array.isArray(A.getFlag(MODF,"warLogs")) ? A.getFlag(MODF,"warLogs").slice() : [];
      warLogs.push({ ts: Date.now(), type: "buildUnits", summary: `Build Units +${gain} (from ${totalMats} Materials pips)` });
      await A.update({
        [`flags.${MODF}.buildUnits`]: after,
        [`flags.${MODF}.warLogs`]: warLogs
      });

      lines.push(
        `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Build Units +${gain} `
        + `(now ${after}; Materials pips: ${totalMats})`
      );
    }

    if (lines.length && gm.length) {
      await ChatMessage.create({
        content: `<p><b>Build Units Generated</b></p>${lines.join("<br/>")}`,
        whisper: tableAudience(),
        speaker: { alias: "Bad Eden Economy" }
      }).catch(()=>{});
    }
  }

  // ===========================================================================
  // TRADE ROUTES → LOGISTICS OP (ADJACENCY-BASED, ACTIVE SCENE)
  // ===========================================================================

  // Trade routes → Logistics OP. Counts STORED EDGES through facts.routes.trade (2026-09-12) —
  // the nearest-six adjacency guess this used to make was the third counter for one fact.
  // Grant unchanged: +1 OP (10 marks) of logistics per two routes, capped by the faction's
  // logistics cap (facts.faction.caps).
  async function doTradeRouteLogisticsBonus() {
    const count = game.bbttcc?.facts?.routes?.trade; if (typeof count !== "function") return;
    const mpo = Number(game.bbttcc?.api?.op?.OP_TO_MARKS) || Number(game.fourththing?.constants?.MARKS_PER_OP);   // rule unit
    if (!(mpo > 0)) return;
    const gm = gmIds(); const lines = [];
    for (const A of facActors()) {
      const routeCount = Number(count(A.id)) || 0;
      const bonus = Math.floor(routeCount / 2); if (bonus <= 0) continue;
      const bank = foundry.utils.duplicate(A.getFlag(MODF, "opBank") || {});
      const before = Number(bank.logistics || 0);
      const cap = Number(game.bbttcc?.facts?.faction?.caps?.(A)?.logistics) || 0;
      const after = cap > 0 ? Math.min(cap, before + bonus * mpo) : before + bonus * mpo;
      if (after === before) continue;
      // #11 (2026-10-28): through op.commit's queue as a +delta (writing the cloned bank raced the end-hook credits).
      const op = game.bbttcc?.api?.op;
      if (op && typeof op.commit === "function") {
        const r = await op.commit(A.id, { logistics: after - before }, { source: "trade_routes", label: "Trade route logistics", noDiscount: true });
        if (r?.ok === false) continue;
      } else { bank.logistics = after; await A.update({ [`flags.${MODF}.opBank`]: bank }); }
      const warLogs = Array.isArray(A.getFlag(MODF, "warLogs")) ? A.getFlag(MODF, "warLogs").slice() : [];
      warLogs.push({ ts: Date.now(), type: "logisticsRoute", summary: `Trade Routes: ${routeCount} → Logistics +${after - before} marks` });
      await A.update({ [`flags.${MODF}.warLogs`]: warLogs });
      lines.push(`• <b>${foundry.utils.escapeHTML(A.name)}</b>: Trade Routes ${routeCount} → Logistics ${before}→${after} marks`);
    }
    if (lines.length && gm.length) await ChatMessage.create({ content: `<p><b>Trade Route Logistics Bonus</b></p>${lines.join("<br/>")}`, whisper: tableAudience(), speaker: { alias: "Bad Eden Economy" } }).catch(() => {});
  }

  // ===========================================================================
  // LEYLINES: PURITY DRIFT (Darkness ↔ Sephirotic alignment)
  // ===========================================================================

  // Tikkun Dividend — guarded cross-module read (0 when campaign module absent).
  function _tikkunBonus() {
    try { return Number(game.bbttcc?.api?.campaign?.tikkun?.get?.() ?? 0) || 0; } catch (_e) { return 0; }
  }

  async function doLeylinePurityDrift() {
    // World-wide (2026-10-01) — was the viewed scene's placeables only.
    const draws = [];
    for (const sc of game.scenes ?? []) for (const d of sc.drawings ?? []) draws.push(d);
    if (!draws.length) return;

    const updates = [];

    for (const d of draws) {
      const tf = d.flags?.[MODT];
      if (!tf?.leylines) continue;

      const ley = foundry.utils.deepClone(tf.leylines);
      let purity = Number(ley.purity || 0);

      const fid = tf.factionId || tf.ownerId;
      const fac = fid ? game.actors.get(fid) : null;
      const darkBox = fac?.getFlag?.(MODF, "darkness") || {};
      const darkness = Number(darkBox.global ?? 0);

      // Darkness corrupts the grid
      if (darkness >= 7 && purity > -5) purity -= 1;

      // Sephirotic alignment heals (only when low darkness). The Tikkun
      // Dividend (arc-1 legacy meter, bbttcc-campaign) raises the healing
      // threshold — land redeemed kindly keeps healing under heavier shade.
      else if (darkness <= 3 + _tikkunBonus() && isSephirothic(tf) && purity < 5) purity += 1;

      if (purity !== Number(ley.purity || 0)) {
        ley.purity = purity;
        updates.push(
          d.update({ [`flags.${MODT}.leylines`]: ley }, { parent: d.parent })
        );
      }
    }

    if (updates.length) await Promise.allSettled(updates);
  }

  // ===========================================================================
  // WRAPPER INSTALL
  // ===========================================================================

  Hooks.once("ready", () => {
    const terr = game.bbttcc?.api?.territory;
    if (!terr || typeof terr.advanceTurn !== "function") {
      return console.warn(TAG, "territory.advanceTurn not found; run after world is ready.");
    }
    if (terr.__bbttccTracksWrapped) {
      return console.log(TAG, "AdvanceTurn track wrapper already installed.");
    }

    const base = terr.advanceTurn.bind(terr);

    terr.advanceTurn = async function wrappedAdvanceTurn(args = {}) {
      const __wlLenBefore = new Map();
      if (args?.apply) for (const A of facActors()) {
        try { const wl = A.getFlag(MODF, "warLogs"); __wlLenBefore.set(String(A.id), Array.isArray(wl) ? wl.length : 0); } catch {}
      }
      const res = await base(args).catch(e => {
        console.warn(TAG, "base advanceTurn error", e);
        return { changed:false, rows:[], error:true };
      });

      // Skip the track pass when the base turn did not run (turn lock → skipped) or threw
      // (2026-10-01): a second Advance click otherwise ran every track twice.
      if (!args?.apply || res?.skipped || res?.error) return res;

      try {
        // Canonicalize any legacy nested track flags before applying track logic.
        for (const A of facActors()) { try { await normalizeFactionFlags(A); } catch {} }

        // Snapshot loyalty BEFORE this track pass (for truthful Trend logs)
        const __bbttccTrendBefore = new Map();
        for (const A of facActors()) {
          try {
            __bbttccTrendBefore.set(String(A.id), {
              loyalty: Number(A.getFlag(MODF, "loyalty") ?? 0)
            });
          } catch {}
        }

        await doRadiationDecayAndSpread();
        await doCleanupPurified();
        await doCleanupAura();
        await doRadiationBleedPurifiedActors();
        await doDarknessTrack();
        await doLeylinePurityDrift();
        await doDarknessThresholds();
        // await doDarknessMorale();  // retired 2026-10-18, ruling 19: faction Morale is no longer a game meter
        await doHexLoyaltyPull();     // territory mood pulls faction loyalty (2026-09-12)
        await doLoyaltyPhase1();
        await doLoyaltyPhase2();
        await doSharingPressure();    // client-state drag after 3 borrowing turns (2026-09-12, T7)
        await doIntegrationPopulationShift();
        // await doUnityRecompute();   // retired 2026-10-18, ruling 18: Unity is no longer a game meter
        await doBuildUnitsFromMaterials();
        await doTradeRouteLogisticsBonus();

        // Reconcile the per-turn Trend warLog entry based on actual deltas
        for (const A of facActors()) {
          const b = __bbttccTrendBefore.get(String(A.id)) || { loyalty: 0 };
          await reconcileTrendWarLog(A, b.loyalty, __wlLenBefore.get(String(A.id)) ?? Infinity);
        }

      } catch (e) {
        console.warn(TAG, "AdvanceTurn track pass failed:", e);
      }

      return res;
    };

    terr.__bbttccTracksWrapped = true;
    console.log(TAG, "AdvanceTurn track wrapper installed.");
  });
})();
