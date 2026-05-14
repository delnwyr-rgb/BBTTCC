// bbttcc-aae/module.js
// Adaptive Adversary Engine (AAE) — Political Pressure + Moral Profile
//
// v1.1 — Adds Political Philosophy canon + applyPoliticalImpact() pipeline
// - Political philosophy is identity state: flags.bbttcc-aae.politicalPhilosophy on characters
// - Faction drift state stored on faction actor flags.bbttcc-aae: { driftScore, severityState, lastPoliticalImpacts, politicalPhilosophyOverride }
//
// NOTE: This file preserves the original Moral Profile generator (POC) and extends the API.
//       No schema migrations; all writes are safe, additive flags.

const MODULE_ID = "bbttcc-aae";
const TAG = "[bbttcc-aae]";

const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const DRIFT_MIN = -100;
const DRIFT_MAX =  100;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function clampAxis(v) { return clamp(v, -1, 1); }
function clamp01(v) { return clamp(v, 0, 1); }

function _normStr(v) { return String(v ?? "").trim(); }
function _tagArray(v) {
  if (Array.isArray(v)) return v.map(s => _normStr(s)).filter(Boolean);
  return _normStr(v).split(/\s+/g).map(s => s.trim()).filter(Boolean);
}

const POLITICAL_PHILOSOPHIES = {
  marxist: {
    key: "marxist",
    label: "Marxist / Communist",
    happiness: "Collective emancipation through eliminating exploitation and alienation.",
    suffering: "Exploitation, alienation, and manufactured scarcity."
  },
  liberal: {
    key: "liberal",
    label: "Liberal",
    happiness: "Protected autonomy and consent under transparent rules.",
    suffering: "Rights violations, coercion, and exclusion from due process."
  },
  social_democratic: {
    key: "social_democratic",
    label: "Social Democratic",
    happiness: "Material security, dignity, and preventable harm reduction.",
    suffering: "Preventable suffering, abandonment, and unchecked inequality."
  },
  libertarian: {
    key: "libertarian",
    label: "Libertarian",
    happiness: "Freedom from coercion; voluntary association and exchange.",
    suffering: "Coercion, imposed authority, and forced redistribution."
  },
  authoritarian: {
    key: "authoritarian",
    label: "Authoritarian / Statist",
    happiness: "Order, predictability, and safety through hierarchy.",
    suffering: "Chaos, fragmentation, and disobedience."
  },
  theocratic: {
    key: "theocratic",
    label: "Theocratic",
    happiness: "Alignment with transcendent moral truth.",
    suffering: "Heresy, corruption, and desecration."
  },
  fascist: {
    key: "fascist",
    label: "Fascist",
    happiness: "Mythic unity, strength, and dominance.",
    suffering: "Weakness, pluralism, and dissent."
  },
  anarchist: {
    key: "anarchist",
    label: "Anarchist",
    happiness: "Mutual aid and voluntary cooperation without hierarchy.",
    suffering: "Domination, imposed hierarchy, and coercion."
  }
};

function listPoliticalPhilosophies() {
  return Object.values(POLITICAL_PHILOSOPHIES).map(p => ({
    key: p.key,
    label: p.label,
    happiness: p.happiness,
    suffering: p.suffering
  }));
}

function getPoliticalPhilosophy(actor) {
  if (!actor) return null;
  const k = actor.getFlag(MODULE_ID, "politicalPhilosophy");
  return _normStr(k) || null;
}

async function setPoliticalPhilosophy(actor, key) {
  if (!actor) throw new Error(`[${MODULE_ID}] setPoliticalPhilosophy requires an Actor`);
  const k = _normStr(key);
  if (k && !POLITICAL_PHILOSOPHIES[k]) throw new Error(`[${MODULE_ID}] Unknown philosophy key '${k}'`);
  await actor.setFlag(MODULE_ID, "politicalPhilosophy", k || null);
  return k || null;
}

// Tag weights (v1)
const TAG_WEIGHTS = {
  marxist: {
    redistributive: +2, collective_ownership: +3, unionized: +2, mutual_aid: +1, anti_exploitation: +3,
    privatization: -2, profit_extraction: -3, austerity: -2, coercive: -1, surveillance: -1, censorship: -1,
    procedural_violation: -1, purge: -2
  },
  liberal: {
    rights_respected: +3, due_process: +3, consent: +2, repression: -3, transparency: +2, pluralism: +1,
    coercive: -2, surveillance: -2, censorship: -3, procedural_violation: -3, collective_punishment: -3, purge: -2
  },
  social_democratic: {
    harm_reduction: +3, welfare: +2, redistributive: +2, mutual_aid: +2, regulation: +1,
    austerity: -3, privatization: -2, coercive: -1, surveillance: -1, censorship: -1, procedural_violation: -1
  },
  libertarian: {
    voluntary: +3, deregulation: +2, privatization: +1, consent: +2, decentralize: +1,
    coercive: -3, repression: -3, surveillance: -2, censorship: -3, redistributive: -2, regulation: -2, taxation: -2, procedural_violation: -1
  },
  authoritarian: {
    order: +3, enforcement: +2, coercive: +2, surveillance: +2, censorship: +1, emergency_powers: +2,
    decentralize: -2, civil_disobedience: -3, mutiny: -3, pluralism: -1
  },
  theocratic: {
    doctrine: +3, sacred_law: +3, ritual: +2, purification: +2, censorship: +1, enforcement: +1,
    heresy: -3, profanation: -3, pluralism: -2, secular_compromise: -2
  },
  fascist: {
    unity: +3, domination: +2, purge: +3, coercive: +2, surveillance: +2, censorship: +2, scapegoat: +3,
    pluralism: -3, dissent: -3, mercy: -2, compromise: -2
  },
  anarchist: {
    mutual_aid: +3, decentralize: +2, voluntary: +2, direct_action: +2, repression: -3, solidarity: +2,
    coercive: -3, surveillance: -3, censorship: -3, hierarchy: -2, enforcement: -2, centralize: -2
  }
};

function _scoreTagsForPhilosophy(philosophyKey, tags = []) {
  const w = TAG_WEIGHTS[philosophyKey] || {};
  let score = 0;
  for (const t of tags) score += Number(w[t] ?? 0) || 0;
  return score;
}

function _severityFromScore(score) {
  if (score >= 2) return "affirmation_minor";
  if (score <= -5) return "dissonance_critical";
  if (score <= -2) return "dissonance_major";
  if (score < 0) return "dissonance_minor";
  return "neutral";
}

function _bandForSeverity(sev) {
  if (sev === "affirmation_minor") return "affirmation";
  if (sev === "dissonance_minor") return "minor";
  if (sev === "dissonance_major") return "major";
  if (sev === "dissonance_critical") return "critical";
  return "neutral";
}

function _driftDeltaForSeverity(sev) {
  switch (sev) {
    case "affirmation_minor":   return -5;
    case "dissonance_minor":    return +5;
    case "dissonance_major":    return +12;
    case "dissonance_critical": return +25;
    default: return 0;
  }
}

function _severityStateFromDriftScore(driftScore) {
  const a = Math.abs(Number(driftScore) || 0);
  if (a <= 15) return "stable";
  if (a <= 35) return "strained";
  if (a <= 65) return "fractured";
  return "rupturing";
}

function _malFactionLine({ centerKey, severity, tags }) {
  const tagStr = tags.slice(0, 6).join(" ");
  const band = _bandForSeverity(severity);

  const lines = {
    marxist: {
      affirmation: "The structure bent. Not enough — but it bent.",
      minor: "Relief was delivered. Ownership was not.",
      major: "You are managing exploitation now. Efficiently.",
      critical: "You no longer threaten the machine. You operate it."
    },
    liberal: {
      affirmation: "Process held. Rights survived contact with urgency.",
      minor: "Procedure was bent — for understandable reasons.",
      major: "Emergency logic is becoming standard practice.",
      critical: "You govern by exception now. The rules still exist; they just don’t apply."
    },
    social_democratic: {
      affirmation: "Less harm. More dignity. No one needed to be sacrificed.",
      minor: "Not everyone was protected. The ledger noticed.",
      major: "You are budgeting pain now.",
      critical: "Suffering has become a policy tool."
    },
    libertarian: {
      affirmation: "No one was compelled. Not by you.",
      minor: "Choice existed. Leverage did too.",
      major: "Power consolidated without interference.",
      critical: "Freedom has owners now. You know their names."
    },
    authoritarian: {
      affirmation: "Order restored. Predictability returned.",
      minor: "Authority hesitated. Disorder noticed.",
      major: "Obedience persists without conviction.",
      critical: "The structure holds. Belief does not."
    },
    theocratic: {
      affirmation: "Doctrine guided action. The sacred held.",
      minor: "Interpretation softened the law.",
      major: "Compromise has entered the canon.",
      critical: "The sacred has become symbolic."
    },
    fascist: {
      affirmation: "Unity hardened. Purpose clarified through exclusion.",
      minor: "Weakness was spared. Dissent persisted.",
      major: "The myth requires reinforcement.",
      critical: "Purpose collapses inward. Enemies must be found."
    },
    anarchist: {
      affirmation: "No authority crystallized. Mutual aid held.",
      minor: "Informal leadership emerged. Watch it.",
      major: "Structure is stabilizing. Authority is returning.",
      critical: "Hierarchy reasserted itself. It always does."
    }
  };

  const base = (lines[centerKey] && lines[centerKey][band]) ? lines[centerKey][band] : `Politics moved (${POLITICAL_PHILOSOPHIES[centerKey]?.label || centerKey}).`;
  return tagStr ? `${base} [${tagStr}]` : base;
}

function readFactionDriftState(factionActor) {
  const driftScore = Number(factionActor?.getFlag(MODULE_ID, "driftScore") ?? 0) || 0;
  const severityState = String(factionActor?.getFlag(MODULE_ID, "severityState") || _severityStateFromDriftScore(driftScore));
  const overrideKey = _normStr(factionActor?.getFlag(MODULE_ID, "politicalPhilosophyOverride"));
  const lastImpacts = factionActor?.getFlag(MODULE_ID, "lastPoliticalImpacts") || [];
  return { driftScore, severityState, overrideKey: overrideKey || null, lastImpacts: Array.isArray(lastImpacts) ? lastImpacts : [] };
}

async function writeFactionDriftState(factionActor, patch = {}) {
  if (!factionActor) return;
  const cur = readFactionDriftState(factionActor);

  const nextScore = (patch.driftScore != null) ? Number(patch.driftScore) : cur.driftScore;
  const nextSeverity = patch.severityState || _severityStateFromDriftScore(nextScore);
  const nextOverride = (patch.overrideKey !== undefined) ? (patch.overrideKey ? String(patch.overrideKey) : "") : (cur.overrideKey || "");
  const nextImpacts = (patch.lastImpacts != null) ? patch.lastImpacts : cur.lastImpacts;

  await factionActor.setFlag(MODULE_ID, "driftScore", clamp(nextScore, DRIFT_MIN, DRIFT_MAX));
  await factionActor.setFlag(MODULE_ID, "severityState", String(nextSeverity));
  await factionActor.setFlag(MODULE_ID, "politicalPhilosophyOverride", nextOverride || "");
  await factionActor.setFlag(MODULE_ID, "lastPoliticalImpacts", Array.isArray(nextImpacts) ? nextImpacts : []);
}

function _resolveActorByIdOrUuid(idOrUuid) {
  const v = _normStr(idOrUuid);
  if (!v) return null;
  if (v.includes(".")) {
    try { return fromUuidSync(v); } catch { return null; }
  }
  return game.actors?.get?.(v) || null;
}

function _safeGetFlag(actor, scope, key) {
  try {
    if (!actor?.getFlag) return null;
    return actor.getFlag(scope, key);
  } catch {
    // scope not active / invalid, or actor not ready
    return null;
  }
}

function _extractActorIdFromRosterEntry(ent) {
  if (!ent) return null;
  // Common shapes we’ve used across BBTTCC over time
  const candidates = [
    ent.actorId,
    ent.id,
    ent._id,
    ent.uuid,
    ent.actorUuid,
    ent.actorUUID
  ].map(v => String(v || "").trim()).filter(Boolean);

  for (const c of candidates) {
    // If it’s a UUID, we’ll resolve later; if it’s an ID, we can resolve directly.
    return c;
  }
  return null;
}

function _resolveRosterActors({ factionActor, actorIds = [] } = {}) {
  const resolved = [];
  const seen = new Set();

  // 1) Explicit actorIds passed from caller
  for (const a of (actorIds || [])) {
    const act = _resolveActorByIdOrUuid(a);
    if (act && !seen.has(act.id)) { seen.add(act.id); resolved.push(act); }
  }
  if (resolved.length) return resolved;

  // 2) Prefer faction actor's roster (bbttcc-factions.roster)
  try {
    const roster =
      _safeGetFlag(factionActor, "bbttcc-factions", "roster") ||
      factionActor?.flags?.["bbttcc-factions"]?.roster ||
      null;

    if (Array.isArray(roster) && roster.length) {
      for (const ent of roster) {
        const ref = _extractActorIdFromRosterEntry(ent);
        if (!ref) continue;

        let act = null;
        if (ref.includes(".")) {
          try { act = fromUuidSync(ref); } catch { act = null; }
        } else {
          act = game.actors?.get?.(ref) || null;
        }

        if (act && !seen.has(act.id)) {
          seen.add(act.id);
          resolved.push(act);
        }
      }
      if (resolved.length) return resolved;
    }
  } catch (e) {
    warn("_resolveRosterActors: roster resolve failed", e);
  }

  // 3) Fallback: scan all actors and infer membership via known factionId flags
  const all = Array.from(game.actors?.contents || []);
  for (const a of all) {
    const t = String(a.type || "").toLowerCase();
    if (t && !(t.includes("character") || t === "pc" || t === "npc")) continue;

    const fid =
      _normStr(_safeGetFlag(a, "bbttcc-aae", "factionId")) ||
      _normStr(_safeGetFlag(a, "bbttcc-auto-link", "factionId")) ||
      _normStr(_safeGetFlag(a, "bbttcc-character-options", "factionId")) ||
      _normStr(_safeGetFlag(a, "bbttcc-core", "factionId")) ||
      _normStr(_safeGetFlag(a, "bbttcc-factions", "factionId")) ||
      "";

    if (fid && factionActor && fid === factionActor.id) {
      if (!seen.has(a.id)) { seen.add(a.id); resolved.push(a); }
    }
  }

  return resolved;
}


function _computeDistribution(actors = []) {
  const counts = {};
  let total = 0;

  for (const a of actors) {
    const k = _normStr(_safeGetFlag(a, MODULE_ID, "politicalPhilosophy"));
    if (!k || !POLITICAL_PHILOSOPHIES[k]) continue;
    counts[k] = (counts[k] || 0) + 1;
    total += 1;
  }

  const dist = Object.entries(counts)
    .map(([k, c]) => ({ key: k, label: POLITICAL_PHILOSOPHIES[k]?.label || k, count: c, pct: total ? Math.round((c / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const plurality = dist[0]?.key || null;
  const pluralityPct = dist[0]?.pct || 0;

  return { total, dist, plurality, pluralityPct };
}

async function applyPoliticalImpact({ factionId, actorIds = [], tags = [], source = null } = {}) {
  const fId = _normStr(factionId);
  const tagList = _tagArray(tags);

  if (!fId) return { ok: false, reason: "missing_factionId" };
  if (!tagList.length) return { ok: false, reason: "no_tags" };

  const factionActor = game.actors?.get?.(fId) || _resolveActorByIdOrUuid(fId);
  if (!factionActor) return { ok: false, reason: "faction_not_found" };

  const rosterActors = _resolveRosterActors({ factionActor, actorIds });
  const dist = _computeDistribution(rosterActors);

  const overrideKey = _normStr(_safeGetFlag(factionActor, MODULE_ID, "politicalPhilosophyOverride"));
  const centerKey = overrideKey || dist.plurality || null;

  if (!centerKey || !POLITICAL_PHILOSOPHIES[centerKey]) {
    const state = readFactionDriftState(factionActor);
    const line = `Political pressure noted (no center philosophy). [${tagList.slice(0,6).join(" ")}]`;
    const nextImpacts = [line, ...state.lastImpacts].slice(0, 6);
    await writeFactionDriftState(factionActor, { lastImpacts: nextImpacts });
    return { ok: true, reason: "no_center", tags: tagList, distribution: dist };
  }

  const centerScore = _scoreTagsForPhilosophy(centerKey, tagList);
  let severity = _severityFromScore(centerScore);

  const perActor = [];
  let majorOrWorse = 0;
  let withPhilo = 0;

  for (const a of rosterActors) {
    const pk = _normStr(_safeGetFlag(a, MODULE_ID, "politicalPhilosophy"));
    if (!pk || !POLITICAL_PHILOSOPHIES[pk]) continue;
    withPhilo += 1;
    const s = _scoreTagsForPhilosophy(pk, tagList);
    const sev = _severityFromScore(s);
    perActor.push({ actorId: a.id, name: a.name, philosophy: pk, score: s, severity: sev });
    if (sev === "dissonance_major" || sev === "dissonance_critical") majorOrWorse += 1;
  }

  // Minority pressure should not be hair-trigger at small roster sizes.
  // If roster < 6, require at least 2 major+ objections.
  // Otherwise use the 25% ratio rule.
  const minorityPressure = (withPhilo > 0)
    ? ((withPhilo >= 6) ? ((majorOrWorse / withPhilo) >= 0.25) : (majorOrWorse >= 2))
    : false;


  if (minorityPressure) {
    if (severity === "dissonance_minor") severity = "dissonance_major";
    else if (severity === "dissonance_major") severity = "dissonance_critical";
  }

  const cur = readFactionDriftState(factionActor);
  let delta = _driftDeltaForSeverity(severity);
  if (minorityPressure && delta > 0) delta += 2;

  const nextScore = clamp((cur.driftScore || 0) + delta, DRIFT_MIN, DRIFT_MAX);
  const nextState = _severityStateFromDriftScore(nextScore);

  const line = _malFactionLine({ centerKey, severity, tags: tagList });
  const nextImpacts = [line, ...cur.lastImpacts].slice(0, 6);

  await writeFactionDriftState(factionActor, {
    driftScore: nextScore,
    severityState: nextState,
    lastImpacts: nextImpacts,
    overrideKey: overrideKey || ""
  });

  const out = {
    ok: true,
    factionId: factionActor.id,
    centerKey,
    centerLabel: POLITICAL_PHILOSOPHIES[centerKey]?.label,
    tags: tagList,
    centerScore,
    severity,
    minorityPressure,
    driftDelta: delta,
    driftScoreBefore: cur.driftScore,
    driftScoreAfter: nextScore,
    severityState: nextState,
    distribution: dist,
    perActor,
    source
  };

  log("applyPoliticalImpact", out);
  return out;
}

// ---------------------------------------------------------------------------
// Original Moral Profile Engine (POC) preserved below
// ---------------------------------------------------------------------------

function emptyAxes() {
  return {
    orderFreedom: 0,
    hierarchyHorizontal: 0,
    mercySeverity: 0,
    materialSpiritual: 0,
    collectiveIndividual: 0,
    stabilityFlux: 0
  };
}

function baselineStrategy() {
  return {
    violence: 0.5,
    nonLethal: 0.5,
    intrigue: 0.5,
    economy: 0.5,
    softPower: 0.5,
    diplomacy: 0.5,
    faith: 0.5,
    occult: 0.5
  };
}

function addAxes(target, delta) {
  for (const k of Object.keys(target)) if (delta[k] != null) target[k] += delta[k];
}

function addStrategy(target, delta) {
  for (const k of Object.keys(target)) if (delta[k] != null) target[k] += delta[k];
}

// Existing AXIS_DELTAS / STRATEGY_DELTAS are intentionally retained from your prior module.
// (No changes needed for political pressure runtime.)

function getItemKeysForMappings(name) {
  const keys = [];
  for (const [cat, map] of Object.entries(AXIS_DELTAS)) {
    for (const itemName of Object.keys(map)) {
      if (name.startsWith(itemName)) keys.push({ category: cat, itemName });
    }
  }
  return keys;
}

function deriveVirtues(values) {
  let primary = "Balance";
  if (values.orderFreedom > 0.4) primary = "Freedom";
  else if (values.orderFreedom < -0.4) primary = "Order";
  if (values.mercySeverity > 0.4) primary = "Discipline/Severity";
  else if (values.mercySeverity < -0.4) primary = "Mercy";

  let missing = "Integration";
  if (primary === "Freedom") missing = "Order / Structure (Binah/Chokmah blend)";
  else if (primary === "Order") missing = "Freedom / Autonomy (Netzach/Hod blend)";
  else if (primary === "Discipline/Severity") missing = "Mercy (Chesed)";
  else if (primary === "Mercy") missing = "Justice/Boundaries (Gevurah)";

  return { primaryVirtue: primary, missingVirtue: missing };
}

function makeHappinessDefinition(values) {
  const bits = [];
  if (values.orderFreedom > 0.3) bits.push("people are free from imposed authority");
  else if (values.orderFreedom < -0.3) bits.push("society is orderly and predictable");

  if (values.mercySeverity > 0.3) bits.push("wrongdoing is met with decisive consequences");
  else if (values.mercySeverity < -0.3) bits.push("mistakes are met with compassion and reform");

  if (values.collectiveIndividual < -0.3) bits.push("the community thrives together");
  else if (values.collectiveIndividual > 0.3) bits.push("individual potential can flourish");

  if (values.materialSpiritual > 0.3) bits.push("the world reflects deeper spiritual truths");
  else if (values.materialSpiritual < -0.3) bits.push("everyone’s material needs are met");

  if (!bits.length) bits.push("people can live according to their nature without being broken by the world");
  return "Happiness, to this faction, is when " + bits.join(", and ") + ".";
}

function makeSufferingDefinition(values) {
  const bits = [];
  if (values.orderFreedom > 0.3) bits.push("people are trapped under rigid hierarchies");
  else if (values.orderFreedom < -0.3) bits.push("chaos undermines safety and duty");

  if (values.mercySeverity > 0.3) bits.push("weakness and betrayal go unpunished");
  else if (values.mercySeverity < -0.3) bits.push("cruelty and vengeance define justice");

  if (values.collectiveIndividual < -0.3) bits.push("the many devour the individual");
  else if (values.collectiveIndividual > 0.3) bits.push("everyone is isolated and alone");

  if (values.materialSpiritual > 0.3) bits.push("the sacred is profaned or ignored");
  else if (values.materialSpiritual < -0.3) bits.push("poverty and scarcity grind people down");

  if (!bits.length) bits.push("people are forced to live in ways that betray their core values");
  return "Suffering, to this faction, is when " + bits.join(", and ") + ".";
}

const AAE_API = {
  // Political canon + helpers
  POLITICAL_PHILOSOPHIES,
  listPoliticalPhilosophies,
  getPoliticalPhilosophy,
  setPoliticalPhilosophy,

  // Faction drift + impact
  readFactionDriftState,
  writeFactionDriftState,
  applyPoliticalImpact,

  // Existing Moral Profile API
  async generateMoralProfile(factionActor) {
    if (!factionActor) throw new Error(`[${MODULE_ID}] generateMoralProfile requires an Actor`);

    const axes = emptyAxes();
    const strat = baselineStrategy();

    const items = Array.from(factionActor.items ?? []);
    for (const it of items) {
      const name = String(it.name || "");
      const matches = getItemKeysForMappings(name);

      for (const { category, itemName } of matches) {
        const axisDelta = AXIS_DELTAS[category]?.[itemName];
        const stratDelta = STRATEGY_DELTAS[category]?.[itemName];
        if (axisDelta) addAxes(axes, axisDelta);
        if (stratDelta) addStrategy(strat, stratDelta);
      }
    }

    for (const k of Object.keys(axes)) axes[k] = clampAxis(axes[k]);
    for (const k of Object.keys(strat)) strat[k] = clamp01(strat[k]);

    const { primaryVirtue, missingVirtue } = deriveVirtues(axes);
    const happinessDefinition = makeHappinessDefinition(axes);
    const sufferingDefinition = makeSufferingDefinition(axes);

    const temptationVectors = [];
    if (primaryVirtue === "Freedom") temptationVectors.push("Frame any compromise or structure as a return to oppression.");
    if (primaryVirtue === "Discipline/Severity") temptationVectors.push("Offer fast, harsh solutions and call mercy 'weakness'.");
    if (primaryVirtue === "Mercy") temptationVectors.push("Exploit their compassion with bad-faith actors and martyr traps.");

    const profile = {
      factionId: factionActor.id,
      values: axes,
      strategy: strat,
      happinessDefinition,
      sufferingDefinition,
      primaryVirtue,
      missingVirtue,
      temptationVectors
    };

    await factionActor.setFlag(MODULE_ID, "moralProfile", profile);
    return profile;
  },

  getMoralProfile(factionActor) {
    if (!factionActor) return null;
    return factionActor.getFlag(MODULE_ID, "moralProfile") || null;
  },

  suggestPreferredOps(factionActor) {
    const profile = this.getMoralProfile(factionActor);
    if (!profile) return [];

    const strat = profile.strategy;
    const entries = Object.entries(strat);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3).map(([type, weight]) => ({ type, weight }));
  }
};

// ---------------------------------------------------------------------------
// Foundry wiring
// ---------------------------------------------------------------------------

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = AAE_API;
  console.log(`[${MODULE_ID}] init (AAE ready)`);
});

Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc || { api: {} };
  game.bbttcc.api.aae = AAE_API;
  console.log(`[${MODULE_ID}] ready (exposed as game.bbttcc.api.aae)`);
});
