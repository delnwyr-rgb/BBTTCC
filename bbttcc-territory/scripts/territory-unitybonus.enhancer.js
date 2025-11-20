// bbttcc-territory/enhancers/territory-unitybonus.enhancer.js
// Unity Bonus from Sephirothic Alignment + Sparks (Phase 3B rule) with DEV overrides.
// - Normal rule: if a faction controls >=3 hexes aligned to the same Sephirah AND has an integrated Spark
//   of that pillar, award that Sephirah's Unity bonus for this turn (OP deltas or temp caps).
// - DEV overrides (per-faction): flags['bbttcc-factions'].victory.unityDev
//     { prefer:'netzach'|'tiferet'|..., minAligned:3, bypassSparkGate:false, force:false }
//     • prefer: pick this pillar when multiple qualify; if none qualify, it can be used with minAligned/force to test
//     • minAligned: threshold for this faction (default 3)
//     • bypassSparkGate: skip spark requirement (testing)
//     • force: award even if alignment count is below minAligned (testing)
//
// Adds helper: game.bbttcc.api.territory.getUnityBonusReport(factionId)
//
// Mapping source: User’s Guide sephiroth table (Unity column).
// OP channels per pillar & magnitudes (can be overridden per-faction via victory.unityMap).
(() => {
  const TAG = "[bbttcc-territory/unitybonus]";
  const MOD_TERR = "bbttcc-territory";
  const MOD_FACTIONS = "bbttcc-factions";

  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  const clone = x => foundry.utils.deepClone(x);
  const get = (obj, path, dflt) => { try { return foundry.utils.getProperty(obj, path) ?? dflt; } catch { return dflt; } };
  const setActorFlag = async (A, path, value) => {
    try { await A.update({ [`flags.${path}`]: value }); } catch(e) { console.warn(TAG, "setFlag fail", path, e); }
  };

  const DEFAULT_SEPHIRAH_TO_OP = {
    chokmah: "economy",   // "Tech" → Economy by default
    binah:   "intrigue",
    chesed:  null,        // healing effectiveness → no OP delta
    gevurah: "violence",
    tiferet: "culture",
    netzach: "all",
    hod:     "faith",
    yesod:   "diplomacy",
    malkuth: null,        // territory control → log only
    keter:   "caps"       // +1 to all caps (temp)
  };

  const DEFAULT_MAGNITUDE = {
    chokmah: 3,
    binah:   3,
    chesed:  0,
    gevurah: 3,
    tiferet: 3,
    netzach: 2,   // +2 to all OPs
    hod:     3,
    yesod:   2,
    malkuth: 0,
    keter:   1    // +1 to all caps
  };

  const PILLARS = ["keter","chokmah","binah","chesed","gevurah","tiferet","netzach","hod","yesod","malkuth"];

  function zeroOps() {
    return { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 };
  }
  function addOps(a,b) {
    const out = clone(a);
    for (const k of OP_KEYS) out[k] = (out[k]||0) + (b[k]||0);
    return out;
  }
  function fmtOpsRow(ops){
    return OP_KEYS.filter(k => (ops[k]||0)>0).map(k => `<b>${ops[k]}</b> ${k}`).join(" • ") || "—";
  }
  const cap = s => (s||"").charAt(0).toUpperCase() + String(s||"").slice(1);

  // --------- state readers ---------
  function collectFactionAlignedHexCounts(factionId) {
    const counts = {}; // { sephirahKey: n }
    for (const sc of (game.scenes ?? [])) {
      for (const obj of [ ...(sc.drawings ?? []), ...(sc.tiles ?? []) ]) {
        const tf = obj.flags?.[MOD_TERR]; if (!tf) continue;
        const owner = tf.factionId || tf.ownerId || "";
        if (String(owner) !== String(factionId)) continue;
        const fromKey = String(tf.sephirahKey || tf.sephirah || "").toLowerCase();
        const fromUuid = String(tf.sephirotUuid||"").toLowerCase().match(/keter|chokmah|binah|chesed|gevurah|tiferet|netzach|hod|yesod|malkuth/);
        const key = fromKey || (fromUuid ? fromUuid[0] : "");
        if (!key) continue;
        counts[key] = (counts[key]||0) + 1;
      }
    }
    return counts;
  }

  function factionHasSparkFor(A, key) {
    const k = String(key||"").toLowerCase();
    if (!k) return false;
    const arr = get(A, `flags.${MOD_FACTIONS}.victory.sparks`, null);
    if (Array.isArray(arr) && arr.some(e => String(e?.key||"").toLowerCase()===k && Number(e?.count||0)>0)) return true;
    const integ = get(A, `flags.${MOD_FACTIONS}.tikkun.integrated`, null);
    if (integ && integ[k]) return true;
    const smap = get(A, `flags.${MOD_FACTIONS}.sparks`, null);
    if (smap && Number(smap[k]||0) > 0) return true;
    return false;
  }

  function computeUnityDeltaFor(A, key) {
    const sephToOp = { ...DEFAULT_SEPHIRAH_TO_OP, ...(get(A, `flags.${MOD_FACTIONS}.victory.unityMap`, {})||{}) };
    const mag = DEFAULT_MAGNITUDE[key] || 0;
    const channel = sephToOp[key] || null;
    const ops = zeroOps();

    if (channel === "all" && mag > 0) {
      for (const k of OP_KEYS) ops[k] += mag;
      return { ops, caps:null, note:`${cap(key)} (+${mag} all OPs)` };
    }
    if (channel === "caps" && mag > 0) {
      return { ops, caps: { all:+mag }, note:`${cap(key)} (+${mag} to all caps this turn)` };
    }
    if (channel && mag > 0 && OP_KEYS.includes(channel)) {
      ops[channel] += mag;
      return { ops, caps:null, note:`${cap(key)} (+${mag} ${channel})` };
    }
    return { ops, caps:null, note:`${cap(key)} (no OP delta; bonus handled elsewhere)` };
  }

  // -------- selection logic with dev overrides --------
  function chooseSephirah(A, counts) {
    const dev = get(A, `flags.${MOD_FACTIONS}.victory.unityDev`, {}) || {};
    const minAligned = Math.max(1, Number(dev.minAligned ?? 3));
    const prefer = (String(dev.prefer||"").toLowerCase());
    const force = !!dev.force;
    const bypassSparkGate = !!dev.bypassSparkGate;

    // Candidate entries meeting threshold
    let entries = Object.entries(counts).filter(([k,n]) => n >= minAligned);

    const hasSpark = (key) => bypassSparkGate || factionHasSparkFor(A, key);

    if (force && prefer) {
      // Force: pick preferred regardless of counts; spark gate may be bypassed per flag
      if (!PILLARS.includes(prefer)) return { any:false, reason:"DEV prefer not a valid sephirah", sephirah:null, count:0 };
      if (!hasSpark(prefer)) return { any:false, reason:"Spark gate failed (DEV force) — set bypassSparkGate or add spark", sephirah:null, count:0 };
      return { any:true, sephirah:prefer, count:counts[prefer]||0 };
    }

    // If we have candidates, pick the one with a spark; tie-break by count desc
    if (entries.length) {
      entries.sort((a,b)=>b[1]-a[1]);
      const withSpark = entries.find(([k]) => hasSpark(k));
      if (withSpark) return { any:true, sephirah:withSpark[0], count:withSpark[1] };
      // no spark among candidates
      return { any:false, reason:"No matching Spark integrated", sephirah:null, count:0 };
    }

    // No one met threshold: allow DEV prefer if it meets minAligned (or if minAligned lowered)
    if (prefer && PILLARS.includes(prefer)) {
      const cnt = counts[prefer] || 0;
      if (cnt >= minAligned && hasSpark(prefer)) return { any:true, sephirah:prefer, count:cnt };
      return { any:false, reason:`Not enough aligned hexes for preferred (${prefer}: ${cnt}/${minAligned})`, sephirah:null, count:cnt };
    }

    return { any:false, reason:"Not enough aligned hexes", sephirah:null, count:0 };
  }

  // -------- public API --------
  async function getUnityBonusReport(factionId) {
    const A = game.actors.get(String(factionId));
    if (!A) return { any:false, reason:"No faction", sephirah:null, count:0, delta:zeroOps(), note:"" };

    const counts = collectFactionAlignedHexCounts(A.id);
    const pick = chooseSephirah(A, counts);
    if (!pick.any) return { any:false, reason:pick.reason, sephirah:null, count:pick.count||0, delta:zeroOps(), note:"" };

    const calc = computeUnityDeltaFor(A, pick.sephirah);
    return { any:true, sephirah:pick.sephirah, count:pick.count, delta:calc.ops, caps:calc.caps, note:calc.note };
  }

  // -------- wrap advanceOPRegen --------
  function installOnce() {
    const terr = game.bbttcc?.api?.territory;
    if (!terr) return void console.warn(TAG, "territory API not ready");

    terr.getUnityBonusReport = getUnityBonusReport;

    if (typeof terr.advanceOPRegen !== "function") {
      return void console.warn(TAG, "advanceOPRegen not found; Unity bonus will not auto-apply.");
    }

    const orig = terr.advanceOPRegen;
    terr.advanceOPRegen = async function wrappedAdvanceOPRegen({ apply=false, factionId=null } = {}) {
      const res = await orig({ apply, factionId });

      try {
        const targets = factionId ? [game.actors.get(String(factionId))].filter(Boolean)
                                  : (game.actors?.contents ?? []).filter(a => a.getFlag?.(MOD_FACTIONS,"isFaction")===true);
        const rows = [];

        for (const A of targets) {
          const report = await getUnityBonusReport(A.id);
          if (!report.any) continue;

          const note = `Unity Bonus — ${cap(report.sephirah)} (${report.count} aligned hexes)`;

          if (apply) {
            if (report.delta && Object.values(report.delta).some(v=>v>0)) {
              const bank = clone(get(A, `flags.${MOD_FACTIONS}.opBank`, {}));
              const newBank = addOps(bank, report.delta);
              await setActorFlag(A, `${MOD_FACTIONS}.opBank`, newBank);
            }
            if (report.caps?.all) {
              const caps = clone(get(A, `flags.${MOD_FACTIONS}.victory.tempCapBonus`, {}));
              caps.all = (Number(caps.all||0) + Number(report.caps.all||0));
              await setActorFlag(A, `${MOD_FACTIONS}.victory.tempCapBonus`, caps);
            }
            const war = clone(get(A, `flags.${MOD_FACTIONS}.warLogs`, [])) || [];
            const deltaStr = fmtOpsRow(report.delta);
            war.push({ type:"turn", date:(new Date()).toLocaleString(), summary: `${note}: ${deltaStr}` });
            await setActorFlag(A, `${MOD_FACTIONS}.warLogs`, war);
          } else {
            const deltaStr = fmtOpsRow(report.delta);
            await ChatMessage.create({
              content: `<p><i>Unity Bonus (Dry)</i> — <b>${foundry.utils.escapeHTML(A.name)}</b>: ${note}<br/>${deltaStr||"—"}</p>`,
              whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
              speaker: { alias: "BBTTCC Unity" }
            });
          }

          rows.push({ factionId:A.id, factionName:A.name, sephirah:report.sephirah, delta:report.delta, applied:!!apply });
        }

        if (rows.length) {
          res.rows = [...(res.rows||[]), ...rows];
          res.changed = res.changed || apply;
        }
      } catch (e) {
        console.warn(TAG, "Unity wrapper failed", e);
      }

      return res;
    };

    console.log(TAG, "Unity bonus enhancer installed (with DEV overrides).");
  }

  Hooks.once("ready", installOnce);
  if (game?.ready) installOnce();
  Hooks.on("canvasReady", installOnce);
})();