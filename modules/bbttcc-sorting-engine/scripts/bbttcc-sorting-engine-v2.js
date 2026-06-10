/**
 * Bad Eden Sorting Engine v2 — Tree of Life descent (Option A: pure Sorting Engine).
 *
 * Step 4 of the v2 sprint, REWRITTEN 2026-04-23 for Option A schema.
 * Replaces the picker-era thin-adapter version with a full quiz-scoring engine.
 *
 * Architecture:
 *   1. Wizard collects 20 quiz answers as a flat map: { questionId: answerKey }
 *   2. scoreQuiz() sums the trait deltas across all answer tags → traitMap
 *   3. Per-category resolvers score each option from spec.resolverWeights × traitMap
 *   4. Resolvers fire in dependency order (alignment first; ancestry/occult get alignment bonuses)
 *   5. runFullDescent() orchestrates and returns { build, rankings, traitMap, pillarTally }
 *   6. Wizard shows "Your descent suggests…" review screen, player accepts or tweaks
 *   7. Wizard hands the confirmed build back to its OWN apply infrastructure
 *      (persistIdentityFlags + createMissingIdentityItems in character-wizard.js)
 *   8. This module's writePillarTally() seeds the AAE drift engine
 *
 * Heritage + Faculties (Option B per designer 2026-04-23):
 *   Engine does NOT resolve heritage or faculties. Heritage = player picks from the
 *   resolved ancestry's filtered list at the review screen. Faculties = player
 *   allocates the starting array. Both stations' quiz answers still feed the trait
 *   pool, but station outputs are explicit player picks.
 *
 * Public API (via game.bbttcc.sortingEngineV2):
 *   getSpec()                                  — returns loaded spec JSON
 *   isReady()                                  — true when spec is loaded
 *   scoreQuiz(answers)                         — pure; returns traitMap
 *   resolveAlignment / Ancestry / Occult / Philosophy / Archetype / Crew / Class / Doctrine
 *                                              — pure; per-category resolvers
 *   runFullDescent(answers)                    — orchestrator; returns full suggested build
 *   computePillarTally(answers)                — pure; returns { mercy, severity, neutral }
 *   classifyPillarTally(tally)                 — pure; returns label string
 *   previewPillarTallyAtStep8(answers)         — pure; tally over questions in stations 1..8
 *   assembleWizardInputs(confirmedBuild, overrides) — restructure for wizard apply flow
 *   writePillarTally(actor, tally)             — actor write; AAE drift seed
 */

const MOD_ID = "bbttcc-sorting-engine";
const SPEC_PATH = `modules/${MOD_ID}/data/bbttcc_sorting_engine_v2_full_spec.json`;

const LOG  = (...a) => console.log(`[${MOD_ID}]`, ...a);
const WARN = (...a) => console.warn(`[${MOD_ID}]`, ...a);
const ERR  = (...a) => console.error(`[${MOD_ID}]`, ...a);

/** @type {object|null} */
let SPEC = null;

// ============================================================================
// Init — load spec JSON
// ============================================================================

Hooks.once("init", async () => {
  try {
    const resp = await fetch(SPEC_PATH);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} loading spec`);
    SPEC = await resp.json();
    if (SPEC.schemaVersion !== 2) {
      WARN(`spec schemaVersion=${SPEC.schemaVersion}; this resolver expects schemaVersion=2 (Option A). Behavior undefined.`);
    }
    LOG(`v2 spec loaded — version ${SPEC.version}, ${SPEC.stations?.length || 0} stations, approach=${SPEC.approach}`);
  } catch (e) {
    ERR("failed to load v2 spec at", SPEC_PATH, e);
  }
});

// ============================================================================
// scoreQuiz — sum trait deltas across all answered questions
// ============================================================================

/**
 * Convert a flat answers map into a trait sum.
 * @param {Record<string, string>} answers — { questionId: answerKey }, e.g. { K1: "A", K2: "C", C1: "B", ... }
 * @param {object} [spec=SPEC]
 * @returns {Record<string, number>} traitMap
 */
export function scoreQuiz(answers, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  if (!answers || typeof answers !== "object") return {};

  const traitMap = {};
  for (const station of spec.stations) {
    for (const q of station.questions) {
      const key = answers[q.id];
      if (!key) continue;
      const answer = q.answers.find(a => a.key === key);
      if (!answer) continue;
      for (const [trait, delta] of Object.entries(answer.tags || {})) {
        traitMap[trait] = (traitMap[trait] || 0) + delta;
      }
    }
  }
  return traitMap;
}

// ============================================================================
// Generic per-category resolver
// ============================================================================

/**
 * Score every option in a weight map against the trait pool. Returns ranked list (descending).
 * @param {Record<string, number>} traitMap
 * @param {Record<string, Record<string, number>>} weightMap — { OptionName: { trait: weight } }
 * @param {object} [opts]
 * @param {number} [opts.signalMultiplier=1] — multiplier applied to *_signal traits (alignment uses 2)
 * @returns {Array<{ name: string, score: number }>}
 */
export function resolveCategory(traitMap, weightMap, opts = {}) {
  const signalMult = opts.signalMultiplier || 1;
  const ranked = [];

  for (const [optName, optWeights] of Object.entries(weightMap || {})) {
    if (optName.startsWith("_")) continue; // skip metadata fields like _comment
    if (!optWeights || typeof optWeights !== "object") continue;

    let score = 0;
    for (const [trait, weight] of Object.entries(optWeights)) {
      if (trait.startsWith("_")) continue; // skip metadata fields
      let traitValue = traitMap[trait] || 0;
      if (signalMult !== 1 && trait.endsWith("_signal")) traitValue *= signalMult;
      score += traitValue * weight;
    }
    ranked.push({ name: optName, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/**
 * Apply alignmentBonuses rules (e.g., Sephirotic Scion +3 if alignment ∈ {Tiphareth/Binah/Keter}).
 * @param {Array<{name, score}>} ranked
 * @param {string} category — "ancestry" or "occult"
 * @param {object} alignmentBonuses — spec.alignmentBonuses
 * @param {object|null} alignmentResult — { best: { name }, ranked }
 * @returns {Array<{name, score, alignmentBonus?}>}
 */
function applyAlignmentBonuses(ranked, category, alignmentBonuses, alignmentResult) {
  if (!alignmentBonuses || !alignmentResult?.best?.name) return ranked;
  const alignName = alignmentResult.best.name;

  const adjusted = ranked.map(item => {
    const key = `${category}.${item.name}`;
    const rules = alignmentBonuses[key];
    if (!rules) return item;
    let bonus = 0;
    for (const rule of rules) {
      if (rule.ifAlignmentIn?.includes(alignName)) bonus += (rule.bonus || 0);
    }
    return bonus ? { ...item, score: item.score + bonus, alignmentBonus: bonus } : item;
  });
  adjusted.sort((a, b) => b.score - a.score);
  return adjusted;
}

// ============================================================================
// Per-category resolvers (thin wrappers over resolveCategory)
// ============================================================================

export function resolveAlignment(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  // Sefirot signals get ×2 in alignment per trait declaration's weightInAlignmentResolver.
  const ranked = resolveCategory(traitMap, spec.resolverWeights.alignment, { signalMultiplier: 2 });
  return { best: ranked[0] || null, ranked };
}

export function resolveAncestry(traitMap, spec = SPEC, alignmentResult = null) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  let ranked = resolveCategory(traitMap, spec.resolverWeights.ancestry);
  ranked = applyAlignmentBonuses(ranked, "ancestry", spec.alignmentBonuses, alignmentResult);
  return { best: ranked[0] || null, ranked };
}

export function resolveOccult(traitMap, spec = SPEC, alignmentResult = null) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  let ranked = resolveCategory(traitMap, spec.resolverWeights.occult);
  ranked = applyAlignmentBonuses(ranked, "occult", spec.alignmentBonuses, alignmentResult);
  return { best: ranked[0] || null, ranked };
}

export function resolvePhilosophy(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.philosophy);
  return { best: ranked[0] || null, ranked };
}

export function resolveArchetype(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.archetype);
  return { best: ranked[0] || null, ranked };
}

export function resolveCrew(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.crew);
  return { best: ranked[0] || null, ranked };
}

export function resolveClass(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.class);
  return { best: ranked[0] || null, ranked };
}

/**
 * Doctrine resolver — filters by resolved class first, then scores the class's doctrines.
 */
export function resolveDoctrine(traitMap, spec = SPEC, classResult = null) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const className = classResult?.best?.name;
  if (!className) return { best: null, ranked: [], note: "no class resolved — cannot pick doctrine" };
  const classDoctrines = spec.resolverWeights.doctrine?.[className];
  if (!classDoctrines || typeof classDoctrines !== "object") {
    return { best: null, ranked: [], note: `no doctrines defined for class ${className}` };
  }
  const ranked = resolveCategory(traitMap, classDoctrines);
  return { best: ranked[0] || null, ranked };
}

// ============================================================================
// Orchestrator — full descent
// ============================================================================

/**
 * Run the full descent: score the quiz, fire all resolvers in dependency order,
 * compute pillar tally, return the suggested build for the review screen.
 *
 * Heritage and Faculties are explicit player picks (Option B) — engine returns
 * null for those slots; wizard's review screen prompts the player.
 *
 * @param {Record<string, string>} answers — flat { questionId: answerKey } map for all 20 questions
 * @param {object} [spec=SPEC]
 * @returns {{
 *   build: object,
 *   rankings: object,
 *   traitMap: Record<string, number>,
 *   pillarTally: { mercy: number, severity: number, neutral: number },
 *   classification: string
 * }}
 */
export function runFullDescent(answers, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);

  const traitMap = scoreQuiz(answers, spec);

  // Resolver order matters: alignment first (its result feeds ancestry + occult bonuses).
  const alignment   = resolveAlignment(traitMap, spec);
  const ancestry    = resolveAncestry(traitMap, spec, alignment);
  const occult      = resolveOccult(traitMap, spec, alignment);
  const philosophy  = resolvePhilosophy(traitMap, spec);
  const archetype   = resolveArchetype(traitMap, spec);
  const crew        = resolveCrew(traitMap, spec);
  const cls         = resolveClass(traitMap, spec);
  const doctrine    = resolveDoctrine(traitMap, spec, cls);

  const pillarTally = computePillarTally(answers, spec);
  const classification = classifyPillarTally(pillarTally, spec);

  return {
    build: {
      archetype:  archetype.best,
      ancestry:   ancestry.best,
      heritage:   null,             // Option B — player picks at review screen
      crew:       crew.best,
      path:       cls.best,         // canonical: "path" in Bad Eden, "class" in code
      doctrine:   doctrine.best,
      philosophy: philosophy.best,
      occult:     occult.best,
      alignment:  alignment.best,
      faculties:  null              // Option B — player allocates at review screen
    },
    rankings: {
      archetype:  archetype.ranked,
      ancestry:   ancestry.ranked,
      crew:       crew.ranked,
      path:       cls.ranked,
      doctrine:   doctrine.ranked,
      philosophy: philosophy.ranked,
      occult:     occult.ranked,
      alignment:  alignment.ranked
    },
    traitMap,
    pillarTally,
    classification
  };
}

// ============================================================================
// Pillar tally — Option A: derives from answer tags' sefirah default + per-answer override
// ============================================================================

/**
 * Compute pillar tally from a (possibly partial) answer map.
 * Each answered question contributes 1 to mercy/severity/neutral based on its
 * answer's pillarTag (if present) or its sefirah's default pillar.
 * @param {Record<string, string>} answers
 * @param {object} [spec=SPEC]
 * @returns {{mercy:number, severity:number, neutral:number}}
 */
export function computePillarTally(answers, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  let mercy = 0, severity = 0, neutral = 0;
  const defaults = spec.pillarTagScheme.defaultsBySefirahPillar;

  for (const station of spec.stations) {
    const stationDefault = defaults[station.pillar] || "neutral";
    for (const q of station.questions) {
      const key = answers?.[q.id];
      if (!key) continue;
      const answer = q.answers.find(a => a.key === key);
      if (!answer) continue;
      const tag = answer.pillarTag || stationDefault;
      if (tag === "mercy") mercy++;
      else if (tag === "severity") severity++;
      else neutral++;
    }
  }
  return { mercy, severity, neutral };
}

/**
 * Preview tally using only answers from questions in stations 1..8 (Keter through Hod).
 * Wizard step-8 readout chip.
 */
export function previewPillarTallyAtStep8(answers, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const filtered = {};
  for (let i = 0; i < 8; i++) {
    const station = spec.stations[i];
    if (!station) continue;
    for (const q of station.questions) {
      if (answers?.[q.id]) filtered[q.id] = answers[q.id];
    }
  }
  return computePillarTally(filtered, spec);
}

/**
 * Convert tally into a display label per pillarReadout.classification rules.
 */
export function classifyPillarTally(tally, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const { balancedWithin, tiltThreshold, labels } = spec.pillarReadout.classification;
  const diff = tally.mercy - tally.severity;
  if (Math.abs(diff) <= balancedWithin) return labels.balanced;
  if (diff >= tiltThreshold) return labels.tiltingMercy;
  if (diff <= -tiltThreshold) return labels.tiltingSeverity;
  return labels.balanced;
}

// ============================================================================
// Wizard input adapter — confirmed build → existing wizard's selections shape
// ============================================================================

/**
 * Reshape a confirmed build (suggestion + player overrides) into the input shape
 * the existing wizard infrastructure expects. The wizard then resolves
 * names → pack items via its own option-loading code, and calls
 * persistIdentityFlags + createMissingIdentityItems.
 *
 * @param {object} confirmedBuild — { archetype: {name}, ancestry: {name}, heritage: {name},
 *                                    crew, path, doctrine, philosophy, occult, alignment,
 *                                    faculties: { violence, intrigue, ... } }
 * @returns {{
 *   selections: { archetype?, crew?, sephirot?, occult?, political? },
 *   ancestries: object[] | null,
 *   heritage: object | null,
 *   path: object | null,
 *   doctrine: object | null,
 *   faculties: object | null
 * }}
 */
export function assembleWizardInputs(confirmedBuild) {
  if (!confirmedBuild) return { selections: {}, ancestries: null, heritage: null, path: null, doctrine: null, faculties: null };

  const selections = {};
  if (confirmedBuild.archetype)   selections.archetype  = confirmedBuild.archetype;
  if (confirmedBuild.crew)        selections.crew       = confirmedBuild.crew;
  if (confirmedBuild.alignment)   selections.sephirot   = confirmedBuild.alignment;   // wizard uses key "sephirot"
  if (confirmedBuild.occult)      selections.occult     = confirmedBuild.occult;
  if (confirmedBuild.philosophy)  selections.political  = confirmedBuild.philosophy;  // wizard uses key "political"

  return {
    selections,
    ancestries: confirmedBuild.ancestry ? [confirmedBuild.ancestry] : null,
    heritage:   confirmedBuild.heritage  || null,
    path:       confirmedBuild.path      || null,
    doctrine:   confirmedBuild.doctrine  || null,
    faculties:  confirmedBuild.faculties || null
  };
}

// ============================================================================
// Finalize — the one actor write this module owns
// ============================================================================

/**
 * Write the pillar tally to actor flags (AAE drift seed).
 * Identity flags + item imports are NOT written here — the wizard owns those.
 */
export async function writePillarTally(actor, tally) {
  if (!actor) throw new Error(`${MOD_ID}: writePillarTally called without actor`);
  await actor.setFlag(MOD_ID, "pillarTally", tally);
  LOG(`pillar tally written for ${actor.name}`, tally);
  return tally;
}

// ============================================================================
// Public API
// ============================================================================

const BBTTCCSortingEngineV2 = {
  MOD_ID,
  getSpec: () => SPEC,
  isReady: () => SPEC != null,
  // pure scoring + resolution
  scoreQuiz,
  resolveCategory,
  resolveAlignment,
  resolveAncestry,
  resolveOccult,
  resolvePhilosophy,
  resolveArchetype,
  resolveCrew,
  resolveClass,
  resolveDoctrine,
  runFullDescent,
  // pillar tally
  computePillarTally,
  previewPillarTallyAtStep8,
  classifyPillarTally,
  // wizard handoff
  assembleWizardInputs,
  writePillarTally
};

Hooks.once("ready", () => {
  game.bbttcc ??= {};
  game.bbttcc.sortingEngineV2 = BBTTCCSortingEngineV2;
  if (!SPEC) WARN("ready hook fired but spec did not load — v2 will not function");
  else if (SPEC.schemaVersion !== 2) WARN(`spec schemaVersion=${SPEC.schemaVersion}; expected 2 (Option A)`);
});

export default BBTTCCSortingEngineV2;
