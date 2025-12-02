// modules/bbttcc-territory/scripts/territory-build-units.enhancer.js
// BBTTCC — Build Unit Consumption Engine
//
// Uses Build Units stored on factions at:
//   flags["bbttcc-factions"].buildUnits
//
// Exposes API on game.bbttcc.api.territory.buildUnits:
//   - get(factionOrId) -> number
//   - canAfford({ factionId, cost })
//   - spendForAction({ factionId?, hexUuid, action, costOverride?, note? })
//
// Supported actions (MVP):
//   - "fortify" → ensures "Fortified" modifier on the hex
//   - "repair"  → removes "Damaged Infrastructure" modifier on the hex
//   - "asset"   → placeholder; just spends BUs + logs (for future asset system)

(() => {
  const TAG   = "[bbttcc-territory/build-units]";
  const MODF  = "bbttcc-factions";
  const MODT  = "bbttcc-territory";

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    const id = String(aOrId).replace(/^Actor\./, "");
    return game.actors?.get(id) ?? null;
  }

  function buOf(actor) {
    const A = asActor(actor);
    if (!A) return 0;
    return Number(A.getFlag(MODF, "buildUnits") ?? 0);
  }

  async function setBU(actor, value) {
    const A = asActor(actor);
    if (!A) return 0;
    const v = Math.max(0, Math.floor(Number(value || 0)));
    await A.setFlag(MODF, "buildUnits", v);
    return v;
  }

  async function appendWarLog(A, entry) {
    const flags = foundry.utils.duplicate(A.flags?.[MODF] || {});
    const war = Array.isArray(flags.warLogs) ? flags.warLogs.slice() : [];
    war.push({
      ts: Date.now(),
      type: "buildUnits",
      ...entry
    });
    flags.warLogs = war;
    await A.update({ [`flags.${MODF}`]: flags });
  }

  async function resolveHexDoc(hexUuidOrDoc) {
    if (!hexUuidOrDoc) return null;
    if (hexUuidOrDoc.document || hexUuidOrDoc.update) return hexUuidOrDoc;
    try {
      const d = await fromUuid(hexUuidOrDoc);
      return d?.document ?? d ?? null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Cost configuration
  // ---------------------------------------------------------------------------

  function getCosts() {
    const fort = game.settings.get(MODT, "buildUnitCostFortify") ?? 2;
    const rep  = game.settings.get(MODT, "buildUnitCostRepair") ?? 1;
    const asset = game.settings.get(MODT, "buildUnitCostAsset") ?? 3;
    return {
      fortify: Math.max(0, Number(fort || 0)),
      repair:  Math.max(0, Number(rep || 0)),
      asset:   Math.max(0, Number(asset || 0))
    };
  }

  // ---------------------------------------------------------------------------
  // Core spend function
  // ---------------------------------------------------------------------------

  async function spendForAction({
    factionId = null,
    hexUuid   = null,
    action    = "fortify",
    costOverride = null,
    note      = ""
  } = {}) {
    const hexDoc = await resolveHexDoc(hexUuid);
    if (!hexDoc) {
      ui.notifications?.error?.("Build Units: Hex not found (bad UUID).");
      return { ok:false, reason:"no-hex" };
    }

    const tf = hexDoc.flags?.[MODT] || {};
    const ownerId = factionId || tf.factionId || tf.ownerId || null;
    const A = ownerId ? asActor(ownerId) : null;
    if (!A) {
      ui.notifications?.warn?.("Build Units: No owning faction found for this hex.");
      return { ok:false, reason:"no-faction" };
    }

    const costs = getCosts();
    const actionKey = String(action || "fortify").toLowerCase();
    const baseCost = costs[actionKey] ?? 0;
    const cost = costOverride != null ? Number(costOverride || 0) : baseCost;

    if (cost <= 0) {
      ui.notifications?.warn?.("Build Units: Cost is zero; nothing to spend.");
      return { ok:false, reason:"zero-cost" };
    }

    const before = buOf(A);
    if (before < cost) {
      ui.notifications?.warn?.(
        `Build Units: ${A.name} has only ${before} BU, but ${cost} are required for ${actionKey}.`
      );
      return { ok:false, reason:"insufficient-bu", before, cost };
    }

    // Spend BUs
    const after = await setBU(A, before - cost);

    // Apply hex-side effects per action
    const hexName = hexDoc.name ?? hexDoc.text ?? hexDoc.id;
    let hexChanged = false;
    const newFlags = foundry.utils.duplicate(tf);

    if (actionKey === "fortify") {
      let mods = Array.isArray(newFlags.modifiers) ? newFlags.modifiers.slice() : [];
      if (!mods.includes("Fortified")) {
        mods.push("Fortified");
        newFlags.modifiers = mods;
        hexChanged = true;
      }
    } else if (actionKey === "repair") {
      let mods = Array.isArray(newFlags.modifiers) ? newFlags.modifiers.slice() : [];
      const beforeLen = mods.length;
      mods = mods.filter(m => m !== "Damaged Infrastructure");
      if (mods.length !== beforeLen) {
        newFlags.modifiers = mods;
        hexChanged = true;
      }
    } else if (actionKey === "asset") {
      // Placeholder for future Asset system — just spend BUs + log
      // You can later extend: newFlags.assets = [...(newFlags.assets||[]), {key,name,...}]
    }

    if (hexChanged) {
      await hexDoc.update({ [`flags.${MODT}`]: newFlags }, { parent: hexDoc.parent ?? null });
    }

    // War log + GM card
    const summaryPieces = [
      `Action: ${actionKey}`,
      `Hex: ${foundry.utils.escapeHTML(hexName)}`,
      `BUs −${cost} (${before} → ${after})`
    ];
    if (note) summaryPieces.push(`Note: ${note}`);

    await appendWarLog(A, {
      activity: "buildUnitsSpend",
      summary: summaryPieces.join(" | "),
      factionId: A.id,
      hexUuid: hexDoc.uuid,
      action: actionKey,
      buBefore: before,
      buAfter: after,
      cost
    });

    const gm = game.users.filter(u => u.isGM).map(u => u.id) ?? [];
    if (gm.length) {
      await ChatMessage.create({
        content: `<p><b>Build Units Spent — ${foundry.utils.escapeHTML(A.name)}</b><br/>${summaryPieces.join("<br/>")}</p>`,
        whisper: gm,
        speaker: { alias: "BBTTCC Economy" }
      }).catch(() => {});
    }

    console.log(TAG, `Spent ${cost} BU for ${actionKey} on`, hexName, "→", A.name, {
      before, after
    });

    return { ok:true, action:actionKey, cost, before, after, hexChanged };
  }

  // ---------------------------------------------------------------------------
  // API publish
  // ---------------------------------------------------------------------------

  function publishAPI() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= game.bbttcc.api || {};
    game.bbttcc.api.territory ??= game.bbttcc.api.territory || {};

    const existing = game.bbttcc.api.territory.buildUnits || {};

    game.bbttcc.api.territory.buildUnits = {
      ...existing,
      get: buOf,
      canAfford: ({ factionId, cost }) => {
        const A = asActor(factionId);
        if (!A) return false;
        return buOf(A) >= Number(cost || 0);
      },
      spendForAction
    };

    console.log(TAG, "Published API at game.bbttcc.api.territory.buildUnits");
  }

  // ---------------------------------------------------------------------------
  // Settings & install
  // ---------------------------------------------------------------------------

  Hooks.once("init", () => {
    // World-level BU cost settings (tweakable later)
    game.settings.register(MODT, "buildUnitCostFortify", {
      name: "Build Unit Cost: Fortify Hex",
      hint: "Number of Build Units required to add the Fortified modifier to a hex.",
      scope: "world",
      config: true,
      type: Number,
      default: 2
    });

    game.settings.register(MODT, "buildUnitCostRepair", {
      name: "Build Unit Cost: Repair Hex",
      hint: "Number of Build Units required to remove the Damaged Infrastructure modifier from a hex.",
      scope: "world",
      config: true,
      type: Number,
      default: 1
    });

    game.settings.register(MODT, "buildUnitCostAsset", {
      name: "Build Unit Cost: Construct Asset",
      hint: "Number of Build Units required to construct a major Asset tied to a hex (placeholder for future Asset system).",
      scope: "world",
      config: true,
      type: Number,
      default: 3
    });
  });

  Hooks.once("ready", () => {
    publishAPI();
  });
})();
