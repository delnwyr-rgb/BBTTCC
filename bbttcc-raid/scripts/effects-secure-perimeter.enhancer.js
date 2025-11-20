// v1.0.0 — Secure Perimeter (mechanical):
// Adds "Strategic Position" to the target hex drawing and queues +1 Defense.
// Safe to load after compat-bridge.js. Extends/creates EFFECTS.secure_perimeter.

(() => {
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc/secure-perimeter]";

  function whenRaidReady(cb, tries=0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 60) return console.warn(TAG,"raid API not ready after timeout");
      setTimeout(()=>whenRaidReady(cb, tries+1), 250);
    };
    if (game?.ready) go(); else Hooks.on("ready", go);
  }

  async function queueSecurePerimeter({ targetUuid, defenseDelta = 1 }) {
    if (!targetUuid) return "No target";
    const docRef = await fromUuid(targetUuid);
    const doc = docRef?.document ?? docRef;
    if (!doc) return "Bad target UUID";

    const f = foundry.utils.duplicate(doc.flags?.[MOD_T] || {});
    const pend = foundry.utils.getProperty(f, "turn.pending") || {};

    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers)
      ? pend.repairs.addModifiers.slice() : [];
    if (!pend.repairs.addModifiers.includes("Strategic Position")) {
      pend.repairs.addModifiers.push("Strategic Position");
    }

    pend.defenseDelta = Number(pend.defenseDelta || 0) + Number(defenseDelta || 0);

    await doc.update({ [`flags.${MOD_T}.turn.pending`]: pend });
    return `Queued: add "Strategic Position" • +${defenseDelta} Defense`;
  }

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    const base = E.secure_perimeter?.apply;

    E.secure_perimeter = Object.assign({}, E.secure_perimeter, {
      kind: "strategic",
      band: "standard",
      label: E.secure_perimeter?.label || "Secure Perimeter",
      cost:  E.secure_perimeter?.cost  || { logistics: 2, violence: 1 },
      async apply({ entry }) {
        let msg = "";
        if (typeof base === "function") {
          try { msg = String(await base({ entry })) || ""; } catch(e) { console.warn(TAG,"base apply", e); }
        }
        const m2 = await queueSecurePerimeter({ targetUuid: entry?.targetUuid, defenseDelta: 1 });
        return [msg, m2].filter(Boolean).join(" • ") || "Secure Perimeter queued.";
      }
    });

    console.log(TAG, "installed (Strategic Position tag +1 Defense).");
  });
})();
