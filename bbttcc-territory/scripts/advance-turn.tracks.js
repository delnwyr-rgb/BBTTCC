// modules/bbttcc-territory/scripts/advance-turn.tracks.js
// BBTTCC — Advance Turn Tracks Wrapper
//
// This wrapper runs AFTER the base territory.advanceTurn({apply:true}) logic.
// It handles:
//  - Radiation decay + spread
//  - Cleanup (Purified hexes clear Radiated/Contaminated + Darkness bonus drop)
//  - Cleanup aura (Purified hex cleans neighbors)
//  - Radiation bleed-off for factions resting in Purified hexes
//  - Darkness track from Radiated hexes
//  - Darkness thresholds (4/7/10) narrative pings
//  - Darkness → Morale pressure
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
  const facActors = () => (game.actors?.contents ?? []).filter(a => a.getFlag?.(MODF,"isFaction"));

  // ===========================================================================
  // RADIATION DECAY + SPREAD
  // ===========================================================================

  const RAD_DECAY_PER_TURN   = 1;
  const RAD_SPREAD_THRESHOLD = 3;
  const RAD_SPREAD_CHANCE    = 0.25;
  const RAD_MAX_NEIGHBORS    = 6;

  function neighborsOfDraw(draw, all) {
    const { x:cx, y:cy } = draw.center;
    return all
      .filter(d => d.id !== draw.id)
      .map(d => ({ d, dist: Math.hypot(d.center.x - cx, d.center.y - cy) }))
      .sort((a,b) => a.dist - b.dist)
      .slice(0, RAD_MAX_NEIGHBORS)
      .map(e => e.d);
  }

  async function doRadiationDecayAndSpread() {
    const draws = canvas?.drawings?.placeables ?? [];
    if (!draws.length) return;

    const neighborMap = new Map();
    for (const d of draws) neighborMap.set(d.id, neighborsOfDraw(d, draws));

    const updates = [];
    const lines   = [];
    const seeds   = [];

    for (const d of draws) {
      const tf   = d.document.flags?.[MODT] || {};
      const mods = (typeof tf.mods === "object" && tf.mods) ? foundry.utils.duplicate(tf.mods) : {};
      const conds = Array.isArray(tf.conditions) ? tf.conditions.slice() : [];
      const name  = d.document.name ?? d.document.text ?? d.id;

      let rPrev = Number(mods.radiation || 0);
      let rNext = rPrev;

      if (rPrev > 0) {
        rNext = Math.max(0, rPrev - RAD_DECAY_PER_TURN);
        mods.radiation = rNext;

        if (rNext === 0 && conds.includes("Radiated")) {
          const newConds = conds.filter(c => c !== "Radiated");
          updates.push(d.document.update({
            [`flags.${MODT}.mods`]: mods,
            [`flags.${MODT}.conditions`]: newConds
          }, { parent: d.document.parent ?? null }));
          lines.push(`• <b>${foundry.utils.escapeHTML(name)}</b>: Radiation cleared`);
        } else {
          updates.push(d.document.update({
            [`flags.${MODT}.mods`]: mods
          }, { parent: d.document.parent ?? null }));
          lines.push(`• <b>${foundry.utils.escapeHTML(name)}</b>: Radiation −${RAD_DECAY_PER_TURN} (now ${rNext})`);
        }
      }

      if (rNext >= RAD_SPREAD_THRESHOLD) seeds.push(d);
    }

    for (const src of seeds) {
      const nbrs = neighborMap.get(src.id) || [];
      for (const n of nbrs) {
        if (Math.random() > RAD_SPREAD_CHANCE) continue;

        const tfN   = n.document.flags?.[MODT] || {};
        const modsN = (typeof tfN.mods === "object" && tfN.mods) ? foundry.utils.duplicate(tfN.mods) : {};
        let condsN  = Array.isArray(tfN.conditions) ? tfN.conditions.slice() : [];
        const nameN = n.document.name ?? n.document.text ?? n.id;

        if (!condsN.includes("Radiated")) condsN.push("Radiated");
        modsN.radiation = Math.max(1, Number(modsN.radiation || 0));

        updates.push(n.document.update({
          [`flags.${MODT}.mods`]: modsN,
          [`flags.${MODT}.conditions`]: [...new Set(condsN)]
        }, { parent: n.document.parent ?? null }));

        lines.push(`• <b>${foundry.utils.escapeHTML(nameN)}</b>: Radiation spread`);
      }
    }

    if (updates.length) await Promise.allSettled(updates);

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Radiation Update</b></p>${lines.join("<br/>")}`,
        whisper: gmIds(),
        speaker: { alias: "BBTTCC Radiation" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // CLEANUP: PURIFIED HEXES + DARKNESS BONUS DROP
  // ===========================================================================

  const CLEANUP_DARKNESS_DROP = 2;

  async function doCleanupPurified() {
    const cleansedByFaction = new Map();
    const updates = [];

    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const tf = d.flags?.[MODT]; if (!tf) continue;
        const conds = Array.isArray(tf.conditions) ? tf.conditions.slice() : [];
        if (!conds.includes("Purified")) continue;

        const fid = String(tf.factionId || tf.ownerId || "");
        if (!fid) continue;

        const nextConds = conds.filter(c => c !== "Radiated" && c !== "Contaminated");
        const mods = (typeof tf.mods === "object" && tf.mods) ? foundry.utils.duplicate(tf.mods) : {};
        if (Number(mods.radiation || 0) !== 0) mods.radiation = 0;

        updates.push(
          d.update({
            [`flags.${MODT}.conditions`]: nextConds,
            [`flags.${MODT}.mods`]: mods
          }, { parent: sc })
        );

        const list = cleansedByFaction.get(fid) || [];
        list.push(d.name ?? d.text ?? d.id);
        cleansedByFaction.set(fid, list);
      }
    }

    if (updates.length) await Promise.allSettled(updates);

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
        whisper: gm,
        speaker: { alias: "BBTTCC Cleanup" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // CLEANUP AURA: PURIFIED HEX CLEANS NEIGHBORS
  // ===========================================================================

  function neighborsDrawings(draw, all) {
    const { x:cx, y:cy } = draw.center;
    return all
      .filter(d => d.id !== draw.id)
      .map(d => ({ d, dist: Math.hypot(d.center.x - cx, d.center.y - cy) }))
      .sort((a,b) => a.dist - b.dist)
      .slice(0, 6)
      .map(e => e.d);
  }

  async function doCleanupAura() {
    const gm = gmIds();
    const lines = [];

    for (const sc of game.scenes ?? []) {
      const draws = sc.drawings ?? [];
      const placeables = draws.map(d => d.object).filter(Boolean);
      const sources = placeables.filter(o => {
        const tf = o?.document?.flags?.[MODT]; if (!tf) return false;
        const conds = Array.isArray(tf.conditions) ? tf.conditions : [];
        return conds.includes("Purified");
      });

      if (!sources.length) continue;

      const updates = [];
      for (const src of sources) {
        const nbrs = neighborsDrawings(src, placeables);
        const cleaned = [];

        for (const n of nbrs) {
          const tf = n.document.flags?.[MODT] || {};
          const hadConds = Array.isArray(tf.conditions) ? tf.conditions.slice() : [];
          const willClear = hadConds.includes("Contaminated") || hadConds.includes("Radiated");
          if (!willClear) continue;

          const nextConds = hadConds.filter(c => c !== "Contaminated" && c !== "Radiated");
          const mods = (typeof tf.mods === "object" && tf.mods) ? foundry.utils.duplicate(tf.mods) : {};
          if (Number(mods.radiation || 0) !== 0) mods.radiation = 0;

          updates.push(n.document.update({
            [`flags.${MODT}.conditions`]: nextConds,
            [`flags.${MODT}.mods`]: mods
          }, { parent: n.document.parent ?? null }));

          cleaned.push(n.document.name ?? n.document.text ?? n.id);
        }

        if (cleaned.length) {
          const srcName = src.document.name ?? src.document.text ?? src.id;
          lines.push(
            `• <b>${foundry.utils.escapeHTML(srcName)}</b>: Aura cleansed → `
            + cleaned.map(x=>foundry.utils.escapeHTML(x)).join(", ")
          );
        }
      }

      if (updates.length) await Promise.allSettled(updates);
    }

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Cleanup Aura</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Cleanup" }
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
        whisper: gm,
        speaker: { alias: "BBTTCC Radiation" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // DARKNESS TRACK (FROM RADIATED HEXES)
  // ===========================================================================

  const DARK_CAP = 10;
  function ownsHex(fid, tf){ const o = tf?.factionId || tf?.ownerId; return String(o) === String(fid); }
  function isRadiated(tf){ return Array.isArray(tf?.conditions) && tf.conditions.includes("Radiated"); }

  async function doDarknessTrack() {
    const facs = facActors();
    const gm   = gmIds();
    const lines = [];

    for (const A of facs) {
      let ownedRadiated = 0;
      for (const sc of game.scenes ?? []) {
        for (const d of sc.drawings ?? []) {
          const tf = d.flags?.[MODT]; if (!tf) continue;
          if (ownsHex(A.id, tf) && isRadiated(tf)) ownedRadiated++;
        }
      }

      const box = foundry.utils.duplicate(A.getFlag(MODF, "darkness") || {});
      let g = typeof box.global === "number"
        ? box.global
        : (typeof box === "number" ? box : 0);

      const before = g;
      if (ownedRadiated > 0) g = Math.min(DARK_CAP, g + 1);
      else                   g = Math.max(0, g - 1);

      if (g !== before) {
        const next = (typeof box === "object" && box) ? box : {};
        next.global = g;
        await A.update({ [`flags.${MODF}.darkness`]: next });
        const dir = (g > before) ? "↑" : "↓";
        lines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Darkness ${dir} ${before} → ${g}`
          + (ownedRadiated>0 ? ` (radiated hexes: ${ownedRadiated})` : "")
        );
      }
    }

    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Darkness Update</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Darkness" }
      }).catch(() => {});
    }
  }

  // ===========================================================================
  // DARKNESS THRESHOLDS (4/7/10) — NARRATIVE PINGS
  // ===========================================================================

  async function doDarknessThresholds() {
    const facs = facActors();
    const gm   = gmIds();
    const lines4 = [];
    const lines7 = [];
    const lines10 = [];

    for (const A of facs) {
      const box = A.getFlag(MODF, "darkness") || {};
      const g   = typeof box.global === "number" ? box.global : 0;

      if (g >= 4 && g <= 6) {
        lines4.push(`• <b>${foundry.utils.escapeHTML(A.name)}</b>: Night terrors, unrest omens (Shadowed 4–6)`);
      }
      if (g >= 7 && g <= 9) {
        lines7.push(`• <b>${foundry.utils.escapeHTML(A.name)}</b>: Intrusion — neighboring hexes marked <i>Contaminated</i>`);
      }
      if (g >= 10) {
        lines10.push(`• <b>${foundry.utils.escapeHTML(A.name)}</b>: <span style="color:#b22222"><b>Regional Calamity</b></span> — corruption wave`);
      }
    }

    const mk = async (title, arr) => arr.length && ChatMessage.create({
      content: `<p><b>${title}</b></p>${arr.join("<br/>")}`,
      whisper: gm,
      speaker: { alias: "BBTTCC Darkness" }
    }).catch(()=>{});

    await mk("Darkness Event (4–6)", lines4);
    await mk("Darkness Intrusion (7–9)", lines7);
    await mk("Darkness Calamity (10)", lines10);
  }

  // ===========================================================================
  // DARKNESS → MORALE PRESSURE
  // ===========================================================================

  async function doDarknessMorale() {
    const facs  = facActors();
    const gm    = gmIds();
    const lines = [];
    const ups   = [];

    for (const A of facs) {
      const box = A.getFlag(MODF, "darkness") || {};
      const g   = typeof box.global === "number" ? box.global : 0;
      let m     = Number(A.getFlag(MODF, "morale") ?? 50);

      const before = m;
      if (g >= 1) m = clamp(m - 1, 0, 100);
      else if (g === 0 && m < 50) m = clamp(m + 1, 0, 100);

      if (m !== before) {
        ups.push(A.update({ [`flags.${MODF}.morale`]: m }));
        const arrow = m > before ? "↑" : "↓";
        lines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Morale ${arrow} ${before}% → ${m}% (Darkness ${g})`
        );
      }
    }

    if (ups.length) await Promise.allSettled(ups);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Morale Update (Darkness)</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Darkness" }
      }).catch(()=>{});
    }
  }

  // ===========================================================================
  // LOYALTY PHASE 1 — DRIFT + OP STABILITY
  // ===========================================================================

  async function doLoyaltyPhase1() {
    const facs = facActors();
    const gm   = gmIds();
    const lines = [];
    const updates = [];

    for (const A of facs) {
      let L = Number(A.getFlag(MODF, "loyalty") ?? 50);
      const before = L;

      const drift = L < 50 ? +1 : (L > 50 ? -1 : 0);
      L = clamp(L + drift, 0, 100);

      let bonus = 0;
      if (L < 15)      bonus = -20;
      else if (L < 30) bonus = -10;
      else if (L > 85) bonus = +10;
      else if (L > 70) bonus = +5;

      if (drift !== 0 || bonus !== 0) {
        const flags = foundry.utils.duplicate(A.flags?.[MODF] || {});
        flags.loyalty = L;
        const nt = flags.bonuses?.nextTurn ?? {};
        nt.opGainPct = Number(nt.opGainPct || 0) + bonus;
        flags.bonuses = { ...(flags.bonuses || {}), nextTurn: nt };
        updates.push(A.update({ [`flags.${MODF}`]: flags }));

        lines.push(
          `• <b>${foundry.utils.escapeHTML(A.name)}</b>: `
          + `Loyalty ${drift>0?"↑":drift<0?"↓":""} ${before}→${L} `
          + `(Stability ${bonus>=0?"+":""}${bonus}% OP next turn)`
        );
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Loyalty Update</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Loyalty" }
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

      // Unrest risk
      if (L < 30 && owned.length > 0 && Math.random() < 0.10) {
        const hex = pick(owned);
        const tf  = foundry.utils.deepClone(hex.flags[MODT] || {});
        tf.modifiers = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
        if (!tf.modifiers.includes("Hostile Population")) {
          tf.modifiers.push("Hostile Population");
          updates.push(hex.update({ [`flags.${MODT}`]: tf }, { parent: hex.parent }));
          lines.push(
            `• ${A.name}: <b>Unrest</b> — ${hex.text||hex.name} gained <i>Hostile Population</i> (Loyalty ${L})`
          );
        }
      }

      // Extra bad: infra damage
      if (L < 15 && owned.length > 0 && Math.random() < 0.25) {
        const hex = pick(owned);
        const tf  = foundry.utils.deepClone(hex.flags[MODT] || {});
        tf.modifiers = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
        if (!tf.modifiers.includes("Damaged Infrastructure")) {
          tf.modifiers.push("Damaged Infrastructure");
          updates.push(hex.update({ [`flags.${MODT}`]: tf }, { parent: hex.parent }));
          lines.push(
            `• ${A.name}: <b>Infrastructure</b> — ${hex.text||hex.name} gained <i>Damaged Infrastructure</i> (Loyalty ${L})`
          );
        }
      }

      // Defense DC bonus/penalty
      let dcBonus = 0;
      if (L < 15)      dcBonus = -2;
      else if (L < 30) dcBonus = -1;
      else if (L > 85) dcBonus = +2;
      else if (L > 70) dcBonus = +1;

      if (dcBonus !== 0) {
        const flags = foundry.utils.deepClone(A.flags?.[MODF] || {});
        const nt = flags.bonuses?.nextTurn ?? {};
        nt.defenseDC = Number(nt.defenseDC || 0) + dcBonus;
        flags.bonuses = { ...(flags.bonuses || {}), nextTurn: nt };
        updates.push(A.update({ [`flags.${MODF}`]: flags }));
        lines.push(
          `• ${A.name}: Defense DC ${dcBonus>0?"+":""}${dcBonus} next raid (Loyalty ${L})`
        );
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Loyalty Stability Effects</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Loyalty" }
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
        updates.push(
          d.update({ [`flags.${MODT}.modifiers`]: mods }, { parent: sc })
        );
        lines.push(
          `• <b>${foundry.utils.escapeHTML(hexName)}</b>: Integration ${prog}/6 `
          + `→ population mood adjusted (${mods.join(", ")||"no modifiers"})`
        );
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length) {
      await ChatMessage.create({
        content: `<p><b>Integration Population Update</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Integration" }
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
        const resources = tf.resources || {};
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

      const flags = foundry.utils.duplicate(A.flags?.[MODF] || {});
      flags.buildUnits = after;

      const warLogs = Array.isArray(flags.warLogs) ? flags.warLogs : [];
      warLogs.push({
        ts: Date.now(),
        type: "buildUnits",
        summary: `Build Units +${gain} (from ${totalMats} Materials pips)`
      });
      flags.warLogs = warLogs;

      await A.update({ [`flags.${MODF}`]: flags });

      lines.push(
        `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Build Units +${gain} `
        + `(now ${after}; Materials pips: ${totalMats})`
      );
    }

    if (lines.length && gm.length) {
      await ChatMessage.create({
        content: `<p><b>Build Units Generated</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Economy" }
      }).catch(()=>{});
    }
  }

  // ===========================================================================
  // TRADE ROUTES → LOGISTICS OP (ADJACENCY-BASED, ACTIVE SCENE)
  // ===========================================================================

  function isTradeHubHex(tf) {
    const mods = Array.isArray(tf.modifiers) ? tf.modifiers : [];
    const type = String(tf.type || "").toLowerCase();
    // Port or Trade Hub hex
    if (mods.includes("Trade Hub")) return true;
    if (type.includes("port")) return true;
    return false;
  }

  async function doTradeRouteLogisticsBonus() {
    const scene = canvas?.scene;
    const placeables = canvas?.drawings?.placeables ?? [];
    if (!scene || !placeables.length) return;

    const byFactionRoutes = new Map(); // factionId -> Set of "idA|idB"

    for (const hub of placeables) {
      const tfHub = hub.document.flags?.[MODT];
      if (!tfHub) continue;
      const owner = tfHub.factionId || tfHub.ownerId;
      if (!owner) continue;
      if (!isTradeHubHex(tfHub)) continue;

      const neighbors = neighborsDrawings(hub, placeables);
      for (const n of neighbors) {
        const tfN = n.document.flags?.[MODT];
        if (!tfN) continue;
        const ownerN = tfN.factionId || tfN.ownerId;
        if (String(ownerN) !== String(owner)) continue;

        const status = String(tfN.status || "").toLowerCase();
        if (status === "unclaimed") continue; // only working routes on held territory

        const key = [hub.id, n.id].sort().join("|");
        const set = byFactionRoutes.get(owner) || new Set();
        set.add(key);
        byFactionRoutes.set(owner, set);
      }
    }

    if (!byFactionRoutes.size) return;

    const gm = gmIds();
    const lines = [];

    for (const [fid, set] of byFactionRoutes.entries()) {
      const A = game.actors.get(fid);
      if (!A) continue;

      const routeCount = set.size;
      const bonus = Math.floor(routeCount / 2); // every 2 routes → +1 Logistics OP
      if (!bonus) continue;

      const flags = foundry.utils.duplicate(A.flags?.[MODF] || {});
      const bank  = flags.opBank || {};
      const before = Number(bank.logistics || 0);
      const after  = before + bonus;
      bank.logistics = after;
      flags.opBank   = bank;

      const warLogs = Array.isArray(flags.warLogs) ? flags.warLogs : [];
      warLogs.push({
        ts: Date.now(),
        type: "logisticsRoute",
        summary: `Trade Routes: ${routeCount} → Logistics +${bonus}`
      });
      flags.warLogs = warLogs;

      await A.update({ [`flags.${MODF}`]: flags });

      lines.push(
        `• <b>${foundry.utils.escapeHTML(A.name)}</b>: Trade Routes ${routeCount} `
        + `→ Logistics OP +${bonus} (now ${after})`
      );
    }

    if (lines.length && gm.length) {
      await ChatMessage.create({
        content: `<p><b>Trade Route Logistics Bonus</b></p>${lines.join("<br/>")}`,
        whisper: gm,
        speaker: { alias: "BBTTCC Economy" }
      }).catch(()=>{});
    }
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
      const res = await base(args).catch(e => {
        console.warn(TAG, "base advanceTurn error", e);
        return { changed:false, rows:[], error:true };
      });

      if (!args?.apply) return res;

      try {
        await doRadiationDecayAndSpread();
        await doCleanupPurified();
        await doCleanupAura();
        await doRadiationBleedPurifiedActors();
        await doDarknessTrack();
        await doDarknessThresholds();
        await doDarknessMorale();
        await doLoyaltyPhase1();
        await doLoyaltyPhase2();
        await doIntegrationPopulationShift();
        await doUnityRecompute();
        await doBuildUnitsFromMaterials();
        await doTradeRouteLogisticsBonus();
      } catch (e) {
        console.warn(TAG, "AdvanceTurn track pass failed:", e);
      }

      return res;
    };

    terr.__bbttccTracksWrapped = true;
    console.log(TAG, "AdvanceTurn track wrapper installed.");
  });
})();
