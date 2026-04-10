const MOD_TERR = "bbttcc-territory";

const FACILITY_PRESETS = {
  bunker: {
    tier: 1,
    size: "small",
    structureDefenseRating: 3,
    hitTrack: "light,heavy,breached,destroyed",
    opModifiers: {
      violenceDefense: 1,
      logisticsDefense: 1,
      moraleBonus: 1
    },
    raidBonuses: {
      defenderDcBonus: 1,
      attackerExtraOpCost: { violence: 1, logistics: 0 },
      maxDefenderUnits: 2,
      notes:
        "Attacks against a bunker pay +1 OP (Violence) to attempt a breach. Defenders gain +1 to raid DC while inside."
    },
    travelEncounterEffects: {
      encounterTierAdjust: 0,
      hazardMitigation: "shelter-from-weather",
      description:
        "Provides shelter from Tier 1 weather/ambient hazards if travel encounters route through this hex."
    },
    integration: {
      autoApplyRaidBonuses: true,
      autoApplyTurnEffects: true,
      upgradesRaw: `[
  {
    "key": "reinforced-walls",
    "name": "Reinforced Walls",
    "tier": 1,
    "structureDefenseRatingBonus": 1,
    "opCost": { "logistics": 1, "economy": 1 },
    "description": "Add extra plating, bracing, or stonework. Increases SDR by +1."
  }
]`,
      turnEffectsRaw: `[
  {
    "key": "facility-op-upkeep",
    "description": "If the bunker is maintained, gain +0 Economy OP per turn. If neglected, it may degrade.",
    "opDelta": { "economy": 0, "logistics": 0 }
  }
]`,
      resolutionHooksRaw: `{
  "onDestroyedOutcome": "salt_the_earth",
  "onCapturedOutcome": "best_friends_integration"
}`
    }
  },

  tower: {
    tier: 1,
    size: "medium",
    structureDefenseRating: 2,
    hitTrack: "light,heavy,breached,destroyed",
    opModifiers: {
      intrigueDefense: 1,
      softPowerDefense: 1
    },
    raidBonuses: {
      defenderDcBonus: 2,
      attackerExtraOpCost: { violence: 0, logistics: 1 },
      maxDefenderUnits: 3,
      notes:
        "Tower provides elevated lines of sight and propaganda channels. Defenders gain +2 raid DC; attackers pay +1 OP (Logistics) to neutralize the tower."
    },
    travelEncounterEffects: {
      encounterTierAdjust: 0,
      hazardMitigation: "early-warning",
      description:
        "Provides early warning; reduce the chance of being surprised by hostile encounters in this hex."
    },
    integration: {
      autoApplyRaidBonuses: true,
      autoApplyTurnEffects: true,
      upgradesRaw: `[
  {
    "key": "signal-booster",
    "name": "Signal Booster",
    "tier": 1,
    "structureDefenseRatingBonus": 0,
    "opCost": { "logistics": 1, "economy": 1 },
    "description": "Extends the tower’s communication range. Grants advantage on Intel/Recon raid maneuvers launched from this hex."
  }
]`,
      turnEffectsRaw: `[
  {
    "key": "tower-softpower-broadcast",
    "description": "Broadcasts faction presence from the tower. +1 Soft Power OP per turn while operational.",
    "opDelta": { "economy": 0, "logistics": 0 }
  }
]`,
      resolutionHooksRaw: `{
  "onDestroyedOutcome": "retribution_subjugation",
  "onCapturedOutcome": "liberation"
}`
    }
  },

  castle: {
    tier: 2,
    size: "large",
    structureDefenseRating: 5,
    hitTrack: "light,heavy,breached,destroyed",
    opModifiers: {
      violenceDefense: 2,
      logisticsDefense: 2,
      economyBonus: 1,
      logisticsBonus: 1,
      moraleBonus: 1,
      loyaltyBonus: 1
    },
    raidBonuses: {
      defenderDcBonus: 3,
      attackerExtraOpCost: { violence: 2, logistics: 1 },
      maxDefenderUnits: 5,
      notes:
        "Heavily fortified stronghold. Defenders gain +3 raid DC while inside. Attackers pay +2 OP (Violence) and +1 OP (Logistics) to mount a full assault."
    },
    travelEncounterEffects: {
      encounterTierAdjust: 0,
      hazardMitigation: "supply-hub",
      description:
        "Acts as a regional supply node. Travel starting from or ending in this hex may reduce effective OP costs via Logistics effects."
    },
    integration: {
      autoApplyRaidBonuses: true,
      autoApplyTurnEffects: true,
      upgradesRaw: `[
  {
    "key": "gatehouse",
    "name": "Gatehouse",
    "tier": 1,
    "structureDefenseRatingBonus": 1,
    "opCost": { "logistics": 1, "economy": 2 },
    "description": "Reinforced gates, murder holes, and kill zones. Increases SDR by +1 and grants an additional defender slot for raids."
  }
]`,
      turnEffectsRaw: `[
  {
    "key": "castle-economy-hub",
    "description": "The castle functions as a trade and logistics hub. +1 Economy and +1 Logistics OP per turn while held.",
    "opDelta": { "economy": 1, "logistics": 1 }
  }
]`,
      resolutionHooksRaw: `{
  "onDestroyedOutcome": "salt_the_earth",
  "onCapturedOutcome": "best_friends_integration"
}`
    }
  }
};

const FACILITY_HIT_TRACK_OPTIONS = [
  { key: "light", label: "Light" },
  { key: "heavy", label: "Heavy" },
  { key: "breached", label: "Breached" },
  { key: "destroyed", label: "Destroyed" },
  { key: "shaken", label: "Shaken" },
  { key: "wounded", label: "Wounded" },
  { key: "broken", label: "Broken" },
  { key: "banished", label: "Banished" },
  { key: "offline", label: "Offline" },
  { key: "collapsed", label: "Collapsed" }
];

const FACILITY_HAZARD_TAG_OPTIONS = [
  { key: "shelter-from-weather", label: "Shelter from Weather" },
  { key: "radiation-safe", label: "Radiation Safe" },
  { key: "early-warning", label: "Early Warning" },
  { key: "supply-hub", label: "Supply Hub" },
  { key: "med-bay", label: "Med Bay" },
  { key: "reinforced-shell", label: "Reinforced Shell" },
  { key: "concealed", label: "Concealed" },
  { key: "warded", label: "Warded" },
  { key: "signal-screened", label: "Signal Screened" }
];

const FACILITY_RESOLUTION_OUTCOMES = [
  { key: "", label: "—" },
  { key: "salt_the_earth", label: "Salt the Earth" },
  { key: "best_friends_integration", label: "Best Friends Integration" },
  { key: "liberation", label: "Liberation" },
  { key: "retribution_subjugation", label: "Retribution / Subjugation" },
  { key: "justice_reformation", label: "Justice / Reformation" }
];

const FACILITY_UPGRADE_PRESETS = [
  {
    key: "reinforced-walls",
    name: "Reinforced Walls",
    tier: 1,
    structureDefenseRatingBonus: 1,
    opCost: { logistics: 1, economy: 1 },
    description: "Extra plating, bracing, or stonework. Increases SDR by +1."
  },
  {
    key: "signal-booster",
    name: "Signal Booster",
    tier: 1,
    structureDefenseRatingBonus: 0,
    opCost: { logistics: 1, economy: 1 },
    description: "Extends communication reach and improves awareness."
  },
  {
    key: "gatehouse",
    name: "Gatehouse",
    tier: 1,
    structureDefenseRatingBonus: 1,
    opCost: { logistics: 1, economy: 2 },
    description: "Reinforced entryworks; harder to crack in a siege."
  },
  {
    key: "watch-grid",
    name: "Watch Grid",
    tier: 1,
    structureDefenseRatingBonus: 0,
    opCost: { logistics: 1, intrigue: 1 },
    description: "Observation nets and signal posts improve early warning."
  },
  {
    key: "deep-stores",
    name: "Deep Stores",
    tier: 2,
    structureDefenseRatingBonus: 0,
    opCost: { economy: 2, logistics: 1 },
    description: "Stockpiles, reserve fuel, and ammo caches support operations."
  }
];

const FACILITY_TURN_EFFECT_PRESETS = [
  {
    key: "facility-op-upkeep",
    name: "Facility Upkeep",
    opDelta: { economy: 0, logistics: 0 },
    description: "Maintenance pulse. Usually neutral unless tuned."
  },
  {
    key: "tower-softpower-broadcast",
    name: "Broadcast Hub",
    opDelta: { softpower: 1 },
    description: "Projects faction presence and messaging while operational."
  },
  {
    key: "castle-economy-hub",
    name: "Economy Hub",
    opDelta: { economy: 1, logistics: 1 },
    description: "Trade and logistics center while held."
  },
  {
    key: "healing-clinic",
    name: "Healing Clinic",
    opDelta: { nonlethal: 1, faith: 1 },
    description: "Medical and recovery support improves survivability."
  },
  {
    key: "training-yard",
    name: "Training Yard",
    opDelta: { violence: 1 },
    description: "Produces readiness and disciplined force projection."
  }
];

function safeClone(v) {
  return foundry.utils.duplicate(v);
}

function safeParseJson(raw, fallback) {
  if (typeof raw !== "string" || !raw.trim()) return safeClone(fallback);
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[bbttcc-facility-console] JSON parse failed", err);
    return safeClone(fallback);
  }
}

function normalizeCsvOrArray(value) {
  if (Array.isArray(value)) return value.map((s) => String(s || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const key = String(value || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function titleize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, function (m) { return m.toUpperCase(); });
}

function optionPoolWithSelection(baseOptions, selectedKeys) {
  const selected = uniqueStrings(selectedKeys);
  const map = new Map();
  for (const opt of baseOptions || []) map.set(opt.key, { key: opt.key, label: opt.label || titleize(opt.key) });
  for (const key of selected) if (!map.has(key)) map.set(key, { key: key, label: titleize(key) });
  const values = Array.from(map.values());
  return {
    all: values,
    selected: selected.map((key) => {
      const found = map.get(key) || { key: key, label: titleize(key) };
      return { key: found.key, label: found.label };
    }),
    available: values.filter((opt) => !selected.includes(opt.key))
  };
}

function normalizeUpgrade(raw) {
  const opCost = raw && typeof raw.opCost === "object" ? raw.opCost : {};
  return {
    key: String(raw?.key || "custom-upgrade").trim() || "custom-upgrade",
    name: String(raw?.name || raw?.key || "Custom Upgrade").trim() || "Custom Upgrade",
    tier: Number(raw?.tier ?? 1) || 1,
    structureDefenseRatingBonus: Number(raw?.structureDefenseRatingBonus ?? 0) || 0,
    opCost: {
      violence: Number(opCost.violence ?? 0) || 0,
      economy: Number(opCost.economy ?? 0) || 0,
      logistics: Number(opCost.logistics ?? 0) || 0,
      intrigue: Number(opCost.intrigue ?? 0) || 0,
      faith: Number(opCost.faith ?? 0) || 0,
      softpower: Number(opCost.softpower ?? opCost.softPower ?? 0) || 0
    },
    description: String(raw?.description || "").trim()
  };
}

function normalizeTurnEffect(raw) {
  const opDelta = raw && typeof raw.opDelta === "object" ? raw.opDelta : {};
  return {
    key: String(raw?.key || "custom-effect").trim() || "custom-effect",
    name: String(raw?.name || raw?.key || "Custom Effect").trim() || "Custom Effect",
    description: String(raw?.description || "").trim(),
    opDelta: {
      violence: Number(opDelta.violence ?? 0) || 0,
      nonlethal: Number(opDelta.nonlethal ?? 0) || 0,
      intrigue: Number(opDelta.intrigue ?? 0) || 0,
      economy: Number(opDelta.economy ?? 0) || 0,
      softpower: Number(opDelta.softpower ?? opDelta.softPower ?? 0) || 0,
      diplomacy: Number(opDelta.diplomacy ?? 0) || 0,
      logistics: Number(opDelta.logistics ?? 0) || 0,
      culture: Number(opDelta.culture ?? 0) || 0,
      faith: Number(opDelta.faith ?? 0) || 0
    }
  };
}

function upgradePresetOptions() {
  return FACILITY_UPGRADE_PRESETS.map((preset) => ({ key: preset.key, label: preset.name }));
}

function turnEffectPresetOptions() {
  return FACILITY_TURN_EFFECT_PRESETS.map((preset) => ({ key: preset.key, label: preset.name }));
}

const _appApi = foundry?.applications?.api || {};
const AppV2 = _appApi.ApplicationV2 || globalThis.Application || Application;
const HBM = _appApi.HandlebarsApplicationMixin || ((Base) => class extends Base {});

export class BBTTCCFacilityConsole extends HBM(AppV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-facility-console",
    window: {
      title: "BBTTCC Facility Config",
      icon: "fas fa-fort-awesome"
    },
    position: {
      width: 820,
      height: "auto"
    },
    classes: ["bbttcc", "bbttcc-facility-config", "sheet"],
    resizable: true
  };

  static PARTS = {
    body: {
      template: "modules/bbttcc-facility-console/templates/facility-config-app.hbs"
    }
  };

  constructor({ hexUuid }, options = {}) {
    super(options);
    this.hexUuid = hexUuid;
    this._hex = null;
    this._abort = null;
  }

  async _getHex() {
    if (this._hex) return this._hex;
    if (!this.hexUuid) return null;
    try {
      const doc = await fromUuid(this.hexUuid);
      this._hex = doc ?? null;
      return this._hex;
    } catch (err) {
      console.error("[bbttcc-facility-console] Failed to resolve hex:", this.hexUuid, err);
      return null;
    }
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const hex = await this._getHex();
    if (!hex) {
      ui.notifications?.error(
        "BBTTCC Facility: Could not resolve hex for facility console."
      );
    }

    const facilitiesRoot = hex?.flags?.[MOD_TERR]?.facilities ?? {};
    const flags = safeClone(facilitiesRoot.primary ?? {}) || {};
    const parsedUpgrades = Array.isArray(flags.upgrades)
      ? flags.upgrades.map(normalizeUpgrade)
      : safeParseJson(flags.integration?.upgradesRaw, []).map(normalizeUpgrade);
    const parsedTurnEffects = Array.isArray(flags.integration?.turnEffects)
      ? flags.integration.turnEffects.map(normalizeTurnEffect)
      : safeParseJson(flags.integration?.turnEffectsRaw, []).map(normalizeTurnEffect);
    const parsedHooks = flags.integration?.resolutionHooks && typeof flags.integration.resolutionHooks === "object"
      ? safeClone(flags.integration.resolutionHooks)
      : safeParseJson(flags.integration?.resolutionHooksRaw, {});
    const hitTrack = uniqueStrings(normalizeCsvOrArray(flags.hitTrack).length ? normalizeCsvOrArray(flags.hitTrack) : ["light", "heavy", "breached", "destroyed"]);
    const hazardMitigation = uniqueStrings(normalizeCsvOrArray(flags.travelEncounterEffects?.hazardMitigation));

    const bbttcc = {
      version: flags.version ?? "0.1",
      facilityType: flags.facilityType ?? "bunker",
      tier: flags.tier ?? 1,
      size: flags.size ?? "small",
      structureDefenseRating: flags.structureDefenseRating ?? 3,
      hitTrack: hitTrack,

      opModifiers: {
        violenceDefense: flags.opModifiers?.violenceDefense ?? 0,
        faithDefense: flags.opModifiers?.faithDefense ?? 0,
        intrigueDefense: flags.opModifiers?.intrigueDefense ?? 0,
        logisticsDefense: flags.opModifiers?.logisticsDefense ?? 0,
        softPowerDefense: flags.opModifiers?.softPowerDefense ?? 0,
        economyBonus: flags.opModifiers?.economyBonus ?? 0,
        logisticsBonus: flags.opModifiers?.logisticsBonus ?? 0,
        unityBonus: flags.opModifiers?.unityBonus ?? 0,
        moraleBonus: flags.opModifiers?.moraleBonus ?? 0,
        loyaltyBonus: flags.opModifiers?.loyaltyBonus ?? 0
      },

      raidBonuses: {
        defenderDcBonus: flags.raidBonuses?.defenderDcBonus ?? 0,
        attackerExtraOpCost: {
          violence: flags.raidBonuses?.attackerExtraOpCost?.violence ?? 0,
          logistics: flags.raidBonuses?.attackerExtraOpCost?.logistics ?? 0
        },
        maxDefenderUnits: flags.raidBonuses?.maxDefenderUnits ?? 0,
        notes: flags.raidBonuses?.notes ?? ""
      },

      travelEncounterEffects: {
        encounterTierAdjust: flags.travelEncounterEffects?.encounterTierAdjust ?? 0,
        hazardMitigation: hazardMitigation,
        description: flags.travelEncounterEffects?.description ?? ""
      },

      hazards: {
        radiation: flags.hazards?.radiation ?? 0,
        corruption: flags.hazards?.corruption ?? 0,
        instability: flags.hazards?.instability ?? 0,
        notes: flags.hazards?.notes ?? ""
      },

      hexBinding: {
        sceneId: flags.hexBinding?.sceneId ?? "",
        hexUuid: this.hexUuid,
        territoryId: flags.hexBinding?.territoryId ?? "",
        notes: flags.hexBinding?.notes ?? ""
      },

      integration: {
        autoApplyRaidBonuses: flags.integration?.autoApplyRaidBonuses ?? true,
        autoApplyTurnEffects: flags.integration?.autoApplyTurnEffects ?? true,
        upgradesRaw: JSON.stringify(parsedUpgrades, null, 2),
        turnEffectsRaw: JSON.stringify(parsedTurnEffects, null, 2),
        resolutionHooksRaw: JSON.stringify(parsedHooks ?? {}, null, 2)
      }
    };

    const hitTrackOptions = optionPoolWithSelection(FACILITY_HIT_TRACK_OPTIONS, bbttcc.hitTrack);
    const hazardOptions = optionPoolWithSelection(FACILITY_HAZARD_TAG_OPTIONS, bbttcc.travelEncounterEffects.hazardMitigation);

    return {
      ...context,
      hex,
      bbttcc,
      isBunker: bbttcc.facilityType === "bunker",
      isTower: bbttcc.facilityType === "tower",
      isCastle: bbttcc.facilityType === "castle",
      hitTrackCsv: bbttcc.hitTrack.join(", "),
      selectedHitTrack: hitTrackOptions.selected,
      availableHitTrackOptions: hitTrackOptions.available,
      selectedHazardMitigation: hazardOptions.selected,
      availableHazardOptions: hazardOptions.available,
      upgrades: parsedUpgrades,
      turnEffects: parsedTurnEffects,
      upgradePresetOptions: upgradePresetOptions(),
      turnEffectPresetOptions: turnEffectPresetOptions(),
      resolutionHooks: {
        onDestroyedOutcome: parsedHooks?.onDestroyedOutcome || "",
        onCapturedOutcome: parsedHooks?.onCapturedOutcome || ""
      },
      destroyedOutcomeOptions: FACILITY_RESOLUTION_OUTCOMES.map((opt) => ({ key: opt.key, label: opt.label, selected: opt.key === (parsedHooks?.onDestroyedOutcome || "") })),
      capturedOutcomeOptions: FACILITY_RESOLUTION_OUTCOMES.map((opt) => ({ key: opt.key, label: opt.label, selected: opt.key === (parsedHooks?.onCapturedOutcome || "") }))
    };
  }

  _syncHitTrackField(form) {
    const chips = Array.from(form.querySelectorAll(".bbttcc-hit-track-chip[data-key]"));
    const values = chips.map((el) => el.dataset.key).filter(Boolean);
    const hidden = form.querySelector('[name="flags.bbttcc-facility.hitTrack"]');
    if (hidden) hidden.value = values.join(", ");
  }

  _syncHazardField(form) {
    const chips = Array.from(form.querySelectorAll(".bbttcc-hazard-chip[data-key]"));
    const values = chips.map((el) => el.dataset.key).filter(Boolean);
    const hidden = form.querySelector('[name="flags.bbttcc-facility.travelEncounterEffects.hazardMitigation"]');
    if (hidden) hidden.value = values.join(", ");
  }

  _syncUpgradesField(form) {
    const rows = Array.from(form.querySelectorAll(".bbttcc-facility-upgrade-row"));
    const upgrades = rows.map((row) => normalizeUpgrade({
      key: row.querySelector('[data-field="key"]')?.value,
      name: row.querySelector('[data-field="name"]')?.value,
      tier: row.querySelector('[data-field="tier"]')?.value,
      structureDefenseRatingBonus: row.querySelector('[data-field="structureDefenseRatingBonus"]')?.value,
      opCost: {
        violence: row.querySelector('[data-field="costViolence"]')?.value,
        economy: row.querySelector('[data-field="costEconomy"]')?.value,
        logistics: row.querySelector('[data-field="costLogistics"]')?.value,
        intrigue: row.querySelector('[data-field="costIntrigue"]')?.value,
        faith: row.querySelector('[data-field="costFaith"]')?.value,
        softpower: row.querySelector('[data-field="costSoftpower"]')?.value
      },
      description: row.querySelector('[data-field="description"]')?.value
    }));
    const hidden = form.querySelector('[name="flags.bbttcc-facility.integration.upgradesRaw"]');
    if (hidden) hidden.value = JSON.stringify(upgrades, null, 2);
  }

  _syncTurnEffectsField(form) {
    const rows = Array.from(form.querySelectorAll(".bbttcc-facility-turn-effect-row"));
    const effects = rows.map((row) => normalizeTurnEffect({
      key: row.querySelector('[data-field="key"]')?.value,
      name: row.querySelector('[data-field="name"]')?.value,
      description: row.querySelector('[data-field="description"]')?.value,
      opDelta: {
        violence: row.querySelector('[data-field="violence"]')?.value,
        nonlethal: row.querySelector('[data-field="nonlethal"]')?.value,
        intrigue: row.querySelector('[data-field="intrigue"]')?.value,
        economy: row.querySelector('[data-field="economy"]')?.value,
        softpower: row.querySelector('[data-field="softpower"]')?.value,
        diplomacy: row.querySelector('[data-field="diplomacy"]')?.value,
        logistics: row.querySelector('[data-field="logistics"]')?.value,
        culture: row.querySelector('[data-field="culture"]')?.value,
        faith: row.querySelector('[data-field="faith"]')?.value
      }
    }));
    const hidden = form.querySelector('[name="flags.bbttcc-facility.integration.turnEffectsRaw"]');
    if (hidden) hidden.value = JSON.stringify(effects, null, 2);
  }

  _syncResolutionHooksField(form) {
    const hooks = {
      onDestroyedOutcome: form.querySelector('[name="bbttcc.ui.onDestroyedOutcome"]')?.value || "",
      onCapturedOutcome: form.querySelector('[name="bbttcc.ui.onCapturedOutcome"]')?.value || ""
    };
    const hidden = form.querySelector('[name="flags.bbttcc-facility.integration.resolutionHooksRaw"]');
    if (hidden) hidden.value = JSON.stringify(hooks, null, 2);
  }

  _buildUpgradeRow(upgrade) {
    const u = normalizeUpgrade(upgrade || {});
    return `
      <article class="bbttcc-facility-upgrade-row">
        <div class="bbttcc-inline-grid bbttcc-grid-upgrade-top">
          <div class="field"><label>Key</label><input type="text" data-field="key" value="${foundry.utils.escapeHTML(u.key)}"></div>
          <div class="field"><label>Name</label><input type="text" data-field="name" value="${foundry.utils.escapeHTML(u.name)}"></div>
          <div class="field"><label>Tier</label><input type="number" min="0" data-field="tier" value="${u.tier}"></div>
          <div class="field"><label>SDR Bonus</label><input type="number" data-field="structureDefenseRatingBonus" value="${u.structureDefenseRatingBonus}"></div>
        </div>
        <div class="bbttcc-inline-grid bbttcc-grid-upgrade-costs">
          <div class="field"><label>Violence</label><input type="number" data-field="costViolence" value="${u.opCost.violence}"></div>
          <div class="field"><label>Economy</label><input type="number" data-field="costEconomy" value="${u.opCost.economy}"></div>
          <div class="field"><label>Logistics</label><input type="number" data-field="costLogistics" value="${u.opCost.logistics}"></div>
          <div class="field"><label>Intrigue</label><input type="number" data-field="costIntrigue" value="${u.opCost.intrigue}"></div>
          <div class="field"><label>Faith</label><input type="number" data-field="costFaith" value="${u.opCost.faith}"></div>
          <div class="field"><label>Soft Power</label><input type="number" data-field="costSoftpower" value="${u.opCost.softpower}"></div>
        </div>
        <div class="bbttcc-row-actions-grid">
          <div class="field full"><label>Description</label><textarea data-field="description" rows="2">${foundry.utils.escapeHTML(u.description)}</textarea></div>
          <div class="bbttcc-row-actions"><button type="button" class="bbttcc-button secondary" data-action="remove-upgrade">Remove</button></div>
        </div>
      </article>`;
  }

  _buildTurnEffectRow(effect) {
    const e = normalizeTurnEffect(effect || {});
    return `
      <article class="bbttcc-facility-turn-effect-row">
        <div class="bbttcc-inline-grid bbttcc-grid-effect-top">
          <div class="field"><label>Key</label><input type="text" data-field="key" value="${foundry.utils.escapeHTML(e.key)}"></div>
          <div class="field"><label>Name</label><input type="text" data-field="name" value="${foundry.utils.escapeHTML(e.name)}"></div>
        </div>
        <div class="field full"><label>Description</label><textarea data-field="description" rows="2">${foundry.utils.escapeHTML(e.description)}</textarea></div>
        <div class="bbttcc-inline-grid bbttcc-grid-effect-costs">
          <div class="field"><label>Violence</label><input type="number" data-field="violence" value="${e.opDelta.violence}"></div>
          <div class="field"><label>Nonlethal</label><input type="number" data-field="nonlethal" value="${e.opDelta.nonlethal}"></div>
          <div class="field"><label>Intrigue</label><input type="number" data-field="intrigue" value="${e.opDelta.intrigue}"></div>
          <div class="field"><label>Economy</label><input type="number" data-field="economy" value="${e.opDelta.economy}"></div>
          <div class="field"><label>Soft Power</label><input type="number" data-field="softpower" value="${e.opDelta.softpower}"></div>
          <div class="field"><label>Diplomacy</label><input type="number" data-field="diplomacy" value="${e.opDelta.diplomacy}"></div>
          <div class="field"><label>Logistics</label><input type="number" data-field="logistics" value="${e.opDelta.logistics}"></div>
          <div class="field"><label>Culture</label><input type="number" data-field="culture" value="${e.opDelta.culture}"></div>
          <div class="field"><label>Faith</label><input type="number" data-field="faith" value="${e.opDelta.faith}"></div>
        </div>
        <div class="bbttcc-row-actions"><button type="button" class="bbttcc-button secondary" data-action="remove-turn-effect">Remove</button></div>
      </article>`;
  }

  _applyPresetToForm(form, preset) {
    if (!form || !preset) return;

    const set = (name, value) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = !!value;
      } else {
        el.value = value;
      }
    };

    set("flags.bbttcc-facility.tier", preset.tier);
    set("flags.bbttcc-facility.size", preset.size);
    set("flags.bbttcc-facility.structureDefenseRating", preset.structureDefenseRating);
    set("flags.bbttcc-facility.hitTrack", preset.hitTrack);

    const hitWrap = form.querySelector(".bbttcc-hit-track-selected");
    if (hitWrap) {
      hitWrap.innerHTML = "";
      uniqueStrings(normalizeCsvOrArray(preset.hitTrack)).forEach((key) => {
        const chip = document.createElement("span");
        chip.className = "bbttcc-pill bbttcc-hit-track-chip";
        chip.dataset.key = key;
        chip.innerHTML = `${foundry.utils.escapeHTML(titleize(key))} <button type="button" data-action="remove-hit-track" data-key="${foundry.utils.escapeHTML(key)}">×</button>`;
        hitWrap.appendChild(chip);
      });
      this._syncHitTrackField(form);
    }

    if (preset.opModifiers) {
      set("flags.bbttcc-facility.opModifiers.violenceDefense", preset.opModifiers.violenceDefense ?? 0);
      set("flags.bbttcc-facility.opModifiers.faithDefense", preset.opModifiers.faithDefense ?? 0);
      set("flags.bbttcc-facility.opModifiers.intrigueDefense", preset.opModifiers.intrigueDefense ?? 0);
      set("flags.bbttcc-facility.opModifiers.logisticsDefense", preset.opModifiers.logisticsDefense ?? 0);
      set("flags.bbttcc-facility.opModifiers.softPowerDefense", preset.opModifiers.softPowerDefense ?? 0);
      set("flags.bbttcc-facility.opModifiers.economyBonus", preset.opModifiers.economyBonus ?? 0);
      set("flags.bbttcc-facility.opModifiers.logisticsBonus", preset.opModifiers.logisticsBonus ?? 0);
      set("flags.bbttcc-facility.opModifiers.unityBonus", preset.opModifiers.unityBonus ?? 0);
      set("flags.bbttcc-facility.opModifiers.moraleBonus", preset.opModifiers.moraleBonus ?? 0);
      set("flags.bbttcc-facility.opModifiers.loyaltyBonus", preset.opModifiers.loyaltyBonus ?? 0);
    }

    if (preset.raidBonuses) {
      set("flags.bbttcc-facility.raidBonuses.defenderDcBonus", preset.raidBonuses.defenderDcBonus ?? 0);
      set("flags.bbttcc-facility.raidBonuses.attackerExtraOpCost.violence", preset.raidBonuses.attackerExtraOpCost?.violence ?? 0);
      set("flags.bbttcc-facility.raidBonuses.attackerExtraOpCost.logistics", preset.raidBonuses.attackerExtraOpCost?.logistics ?? 0);
      set("flags.bbttcc-facility.raidBonuses.maxDefenderUnits", preset.raidBonuses.maxDefenderUnits ?? 0);
      set("flags.bbttcc-facility.raidBonuses.notes", preset.raidBonuses.notes ?? "");
    }

    if (preset.travelEncounterEffects) {
      set("flags.bbttcc-facility.travelEncounterEffects.encounterTierAdjust", preset.travelEncounterEffects.encounterTierAdjust ?? 0);
      set("flags.bbttcc-facility.travelEncounterEffects.description", preset.travelEncounterEffects.description ?? "");
      set("flags.bbttcc-facility.travelEncounterEffects.hazardMitigation", preset.travelEncounterEffects.hazardMitigation ?? "");
      const wrap = form.querySelector(".bbttcc-hazard-selected");
      if (wrap) {
        wrap.innerHTML = "";
        uniqueStrings(normalizeCsvOrArray(preset.travelEncounterEffects.hazardMitigation)).forEach((key) => {
          const chip = document.createElement("span");
          chip.className = "bbttcc-pill bbttcc-hazard-chip";
          chip.dataset.key = key;
          chip.innerHTML = `${foundry.utils.escapeHTML(titleize(key))} <button type="button" data-action="remove-hazard" data-key="${foundry.utils.escapeHTML(key)}">×</button>`;
          wrap.appendChild(chip);
        });
        this._syncHazardField(form);
      }
    }

    if (preset.integration) {
      set("flags.bbttcc-facility.integration.autoApplyRaidBonuses", preset.integration.autoApplyRaidBonuses ?? true);
      set("flags.bbttcc-facility.integration.autoApplyTurnEffects", preset.integration.autoApplyTurnEffects ?? true);
      set("flags.bbttcc-facility.integration.upgradesRaw", preset.integration.upgradesRaw ?? "[]");
      set("flags.bbttcc-facility.integration.turnEffectsRaw", preset.integration.turnEffectsRaw ?? "[]");
      set("flags.bbttcc-facility.integration.resolutionHooksRaw", preset.integration.resolutionHooksRaw ?? "{}");

      const upgradeWrap = form.querySelector(".bbttcc-upgrades-list");
      if (upgradeWrap) {
        upgradeWrap.innerHTML = "";
        safeParseJson(preset.integration.upgradesRaw ?? "[]", []).map(normalizeUpgrade).forEach((upgrade) => {
          upgradeWrap.insertAdjacentHTML("beforeend", this._buildUpgradeRow(upgrade));
        });
        this._syncUpgradesField(form);
      }
      const effectWrap = form.querySelector(".bbttcc-turn-effects-list");
      if (effectWrap) {
        effectWrap.innerHTML = "";
        safeParseJson(preset.integration.turnEffectsRaw ?? "[]", []).map(normalizeTurnEffect).forEach((effect) => {
          effectWrap.insertAdjacentHTML("beforeend", this._buildTurnEffectRow(effect));
        });
        this._syncTurnEffectsField(form);
      }
      const hooks = safeParseJson(preset.integration.resolutionHooksRaw ?? "{}", {});
      set("bbttcc.ui.onDestroyedOutcome", hooks.onDestroyedOutcome ?? "");
      set("bbttcc.ui.onCapturedOutcome", hooks.onCapturedOutcome ?? "");
      this._syncResolutionHooksField(form);
    }
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);

    const root = this.element[0] ?? this.element;
    if (!root) return;

    if (this._abort) {
      try { this._abort.abort(); } catch {}
    }
    this._abort = new AbortController();
    const sig = this._abort.signal;

    const form = root.querySelector("form.bbttcc-facility-config-form");

    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.(".bbttcc-button.primary");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      if (!form) return;
      this._handleSave(form);
    }, { capture: true, signal: sig });

    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.(".bbttcc-button.preset");
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      if (!form) return;

      const typeEl = form.querySelector('[name="flags.bbttcc-facility.facilityType"]');
      const type = typeEl?.value ?? "bunker";
      const preset = FACILITY_PRESETS[type];
      if (!preset) {
        ui.notifications?.info?.("No template defined for this facility type.");
        return;
      }
      this._applyPresetToForm(form, preset);
      ui.notifications?.info?.(`Applied ${type} template — adjust as needed, then Save.`);
    }, { capture: true, signal: sig });

    root.addEventListener("click", (ev) => {
      const addHitTrack = ev.target.closest?.('[data-action="add-hit-track"]');
      if (addHitTrack && form) {
        ev.preventDefault(); ev.stopPropagation();
        const select = form.querySelector('[name="bbttcc.ui.hitTrackPicker"]');
        const wrap = form.querySelector('.bbttcc-hit-track-selected');
        const key = select?.value;
        if (key && wrap && !wrap.querySelector(`[data-key="${CSS.escape(key)}"]`)) {
          const chip = document.createElement('span');
          chip.className = 'bbttcc-pill bbttcc-hit-track-chip';
          chip.dataset.key = key;
          chip.innerHTML = `${foundry.utils.escapeHTML(titleize(key))} <button type="button" data-action="remove-hit-track" data-key="${foundry.utils.escapeHTML(key)}">×</button>`;
          wrap.appendChild(chip);
          this._syncHitTrackField(form);
        }
        return;
      }
      const removeHitTrack = ev.target.closest?.('[data-action="remove-hit-track"]');
      if (removeHitTrack && form) {
        ev.preventDefault(); ev.stopPropagation();
        removeHitTrack.closest('.bbttcc-hit-track-chip')?.remove();
        this._syncHitTrackField(form);
        return;
      }
      const addHazard = ev.target.closest?.('[data-action="add-hazard"]');
      if (addHazard && form) {
        ev.preventDefault(); ev.stopPropagation();
        const select = form.querySelector('[name="bbttcc.ui.hazardPicker"]');
        const wrap = form.querySelector('.bbttcc-hazard-selected');
        const key = select?.value;
        if (key && wrap && !wrap.querySelector(`[data-key="${CSS.escape(key)}"]`)) {
          const chip = document.createElement('span');
          chip.className = 'bbttcc-pill bbttcc-hazard-chip';
          chip.dataset.key = key;
          chip.innerHTML = `${foundry.utils.escapeHTML(titleize(key))} <button type="button" data-action="remove-hazard" data-key="${foundry.utils.escapeHTML(key)}">×</button>`;
          wrap.appendChild(chip);
          this._syncHazardField(form);
        }
        return;
      }
      const removeHazard = ev.target.closest?.('[data-action="remove-hazard"]');
      if (removeHazard && form) {
        ev.preventDefault(); ev.stopPropagation();
        removeHazard.closest('.bbttcc-hazard-chip')?.remove();
        this._syncHazardField(form);
        return;
      }
      const addUpgrade = ev.target.closest?.('[data-action="add-upgrade"]');
      if (addUpgrade && form) {
        ev.preventDefault(); ev.stopPropagation();
        const select = form.querySelector('[name="bbttcc.ui.upgradePreset"]');
        const key = select?.value;
        const preset = FACILITY_UPGRADE_PRESETS.find((item) => item.key === key);
        const wrap = form.querySelector('.bbttcc-upgrades-list');
        if (wrap) {
          wrap.insertAdjacentHTML('beforeend', this._buildUpgradeRow(preset || {}));
          this._syncUpgradesField(form);
        }
        return;
      }
      const removeUpgrade = ev.target.closest?.('[data-action="remove-upgrade"]');
      if (removeUpgrade && form) {
        ev.preventDefault(); ev.stopPropagation();
        removeUpgrade.closest('.bbttcc-facility-upgrade-row')?.remove();
        this._syncUpgradesField(form);
        return;
      }
      const addTurnEffect = ev.target.closest?.('[data-action="add-turn-effect"]');
      if (addTurnEffect && form) {
        ev.preventDefault(); ev.stopPropagation();
        const select = form.querySelector('[name="bbttcc.ui.turnEffectPreset"]');
        const key = select?.value;
        const preset = FACILITY_TURN_EFFECT_PRESETS.find((item) => item.key === key);
        const wrap = form.querySelector('.bbttcc-turn-effects-list');
        if (wrap) {
          wrap.insertAdjacentHTML('beforeend', this._buildTurnEffectRow(preset || {}));
          this._syncTurnEffectsField(form);
        }
        return;
      }
      const removeTurnEffect = ev.target.closest?.('[data-action="remove-turn-effect"]');
      if (removeTurnEffect && form) {
        ev.preventDefault(); ev.stopPropagation();
        removeTurnEffect.closest('.bbttcc-facility-turn-effect-row')?.remove();
        this._syncTurnEffectsField(form);
      }
    }, { capture: true, signal: sig });

    root.addEventListener('change', (ev) => {
      if (!form) return;
      const target = ev.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest('.bbttcc-facility-upgrade-row')) this._syncUpgradesField(form);
      if (target.closest('.bbttcc-facility-turn-effect-row')) this._syncTurnEffectsField(form);
      if (target.matches('[name="bbttcc.ui.onDestroyedOutcome"], [name="bbttcc.ui.onCapturedOutcome"]')) this._syncResolutionHooksField(form);
    }, { capture: true, signal: sig });

    this._syncHitTrackField(form);
    this._syncHazardField(form);
    this._syncUpgradesField(form);
    this._syncTurnEffectsField(form);
    this._syncResolutionHooksField(form);
  }

  async _handleSave(formElem) {
    const hex = await this._getHex();
    if (!hex) return;

    this._syncHitTrackField(formElem);
    this._syncHazardField(formElem);
    this._syncUpgradesField(formElem);
    this._syncTurnEffectsField(formElem);
    this._syncResolutionHooksField(formElem);

    const fd = new FormData(formElem);
    const raw = {};
    for (const [k, v] of fd.entries()) raw[k] = v;

    const cbKeys = [
      'flags.bbttcc-facility.integration.autoApplyRaidBonuses',
      'flags.bbttcc-facility.integration.autoApplyTurnEffects'
    ];
    for (const key of cbKeys) raw[key] = raw[key] === 'on' || raw[key] === 'true' || raw[key] === true;

    const expanded = foundry.utils.expandObject(raw);
    const input = expanded.flags?.['bbttcc-facility'] ?? {};

    input.hitTrack = uniqueStrings(normalizeCsvOrArray(input.hitTrack));
    input.travelEncounterEffects ??= {};
    input.travelEncounterEffects.hazardMitigation = uniqueStrings(normalizeCsvOrArray(input.travelEncounterEffects.hazardMitigation));

    const int = input.integration ?? {};
    const upgrades = safeParseJson(int.upgradesRaw ?? '[]', []).map(normalizeUpgrade);
    const turnEffects = safeParseJson(int.turnEffectsRaw ?? '[]', []).map(normalizeTurnEffect);
    const resolutionHooks = safeParseJson(int.resolutionHooksRaw ?? '{}', {});

    int.upgradesRaw = JSON.stringify(upgrades, null, 2);
    int.turnEffectsRaw = JSON.stringify(turnEffects, null, 2);
    int.resolutionHooksRaw = JSON.stringify(resolutionHooks, null, 2);
    int.turnEffects = turnEffects;
    int.resolutionHooks = resolutionHooks;
    input.integration = int;
    input.upgrades = upgrades;

    const facilitiesRoot = hex.flags?.[MOD_TERR]?.facilities ?? {};
    const currentPrimary = facilitiesRoot.primary ?? {};
    const facilities = safeClone(facilitiesRoot);
    facilities.primary = foundry.utils.mergeObject(currentPrimary, input, {
      inplace: false,
      overwrite: true
    });

    await hex.update({ [`flags.${MOD_TERR}.facilities`]: facilities });

    ui.notifications?.info('BBTTCC Facility updated for this hex.');
    this.close();
  }
}

Hooks.on('ready', () => {
  game.bbttcc ??= {};
  game.bbttcc.apps ??= {};
  game.bbttcc.apps.FacilityConsole = BBTTCCFacilityConsole;
  console.debug('[bbttcc-facility-console] FacilityConsole registered on game.bbttcc.apps');
});
