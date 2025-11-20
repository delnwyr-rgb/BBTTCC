// modules/bbttcc-raid/scripts/effects-integration-activities.enhancer.js
// BBTTCC — Strategic Activities → Integration Track Enhancer
//
// When certain Strategic Activities fire (Develop Infrastructure, etc.),
// this enhancer bumps the integration.progress of the target hex.
//
// It wraps existing EFFECTS entries; it does NOT replace compat-bridge or
// the Resolution Engine. Safe to load alongside other EFFECT enhancers.

(() => {
  const MOD_RAID = "bbttcc-raid";
  const MOD_TERR = "bbttcc-territory";
  const TAG      = "[bbttcc/effects-integration-activities]";

  function clampProgress(v) {
    v = Number.isFinite(v) ? Number(v) : 0;
    if (v < 0) v = 0;
    if (v > 6) v = 6;
    return Math.round(v);
  }

  function stageKeyFromProgress(progress) {
    const p = clampProgress(progress);
    if (p >= 6) return "integrated";
    if (p === 5) return "settled";
    if (p >= 3) return "developing";
    if (p >= 1) return "outpost";
    return "wild";
  }

  function stageLabelFromKey(key) {
    const map = {
      wild: "Untouched Wilderness",
      outpost: "Foothold / Outpost",
      developing: "Developing Territory",
      settled: "Settled Province",
      integrated: "Integrated Heartland"
    };
    return map[key] || "—";
  }

  async function bumpIntegrationForTarget(entry, cfg = {}) {
    const targetUuid = entry?.targetUuid;
    if (!targetUuid) return "";

    let ref;
    try {
      ref = await fromUuid(targetUuid);
    } catch (e) {
      console.warn(TAG, "Failed to resolve targetUuid for integration bump:", targetUuid, e);
      return "";
    }
    const doc = ref?.document ?? ref;
    if (!doc?.setFlag) return "";

    let integ = await doc.getFlag(MOD_TERR, "integration");
    if (integ == null) integ = {};

    const prev = clampProgress(integ.progress ?? 0);
    let next = prev;

    const setAtLeast = (cfg.setAtLeast !== undefined && cfg.setAtLeast !== null)
      ? Number(cfg.setAtLeast)
      : null;
    const add = Number(cfg.add || 0);

    if (setAtLeast !== null && Number.isFinite(setAtLeast)) {
      next = Math.max(next, setAtLeast);
    }
    if (add) next += add;

    next = clampProgress(next);
    if (next === prev) {
      // No change; nothing to log.
      return "";
    }

    integ.progress = next;
    const hist = Array.isArray(integ.history) ? integ.history.slice() : [];
    hist.push({
      ts: Date.now(),
      source: "strategic_activity",
      activity: String(entry?.activity || entry?.activityKey || cfg.key || "unknown"),
      prev,
      next
    });
    integ.history = hist.slice(-20);

    try {
      await doc.setFlag(MOD_TERR, "integration", integ);
    } catch (e) {
      console.warn(TAG, "Failed to write integration flag on target hex:", targetUuid, e);
      return "";
    }

    const stageKey = stageKeyFromProgress(next);
    const stageLabel = stageLabelFromKey(stageKey);
    console.log(TAG, "Integration bumped from strategic activity", {
      hex: doc.name ?? doc.text ?? doc.id,
      prev,
      next,
      stageKey,
      activity: entry?.activity || entry?.activityKey || cfg.key
    });

    // Small note to append to effect messages / war logs
    const delta = next - prev;
    const sign = delta >= 0 ? "+" : "";
    return `Integration ${sign}${delta} (now ${next}/6 – ${stageLabel})`;
  }

  function whenRaidReady(cb, tries = 0) {
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_RAID)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG, "raid API not ready after timeout");
      setTimeout(() => whenRaidReady(cb, tries + 1), 250);
    };
    if (game?.ready) go(); else Hooks.once("ready", go);
  }

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    if (!E) {
      console.warn(TAG, "No EFFECTS registry found; aborting.");
      return;
    }

    // Activity → integration bump mapping.
    // Only applied if the key exists in EFFECTS.
    const MAP = {
      // Wilderness pipeline (future-proof: these may be added later)
      establish_outpost:          { setAtLeast: 1, add: 0 },
      develop_outpost:            { add: 1 },
      upgrade_outpost_settlement: { setAtLeast: 3, add: 0 },

      // Existing dev-ish activities in compat-bridge/EFFECTS
      develop_infrastructure:     { add: 1 },
      develop_infrastructure_std: { add: 1 },
      reconstruction_drive:       { add: 1 },
      reconstruction_drive_std:   { add: 1 },
      expand_territory:           { setAtLeast: 1, add: 0 }
    };

    const wrap = (key, cfg) => {
      const spec = E[key];
      if (!spec || typeof spec.apply !== "function") return;

      const baseApply = spec.apply;
      E[key] = Object.assign({}, spec, {
        async apply(args = {}) {
          let msg = "";
          try {
            msg = await baseApply(args);
          } catch (e) {
            console.warn(TAG, `base apply() failed for ${key}:`, e);
            msg = msg || "(base effect failed; see console)";
          }

          let integMsg = "";
          try {
            integMsg = await bumpIntegrationForTarget(args.entry || args, { ...cfg, key });
          } catch (e) {
            console.warn(TAG, `integration bump failed for ${key}:`, e);
          }

          return [msg, integMsg].filter(Boolean).join(" • ");
        }
      });

      console.log(TAG, `Integration hook installed on strategic activity '${key}'.`, cfg);
    };

    for (const [key, cfg] of Object.entries(MAP)) {
      if (E[key]) wrap(key, cfg);
    }

    console.log(TAG, "Enhancer ready: wired strategic activities → integration where available.");
  });

})();
