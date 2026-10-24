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

// ============================================================================
// Z-scored resolution (2026-10-23)
// ============================================================================
//
// Raw scores favour options with more weights, or weights on traits most answers hand out (discipline,
// independence, the station signals every answer at a station gives): The World / Bulwark won for being
// well-fed, Wheel of Fortune / Rosicrucian could never win because a twin scored the same traits plus more.
// With spec.scoring.normalize === "z", each option is scored as (raw − its mean) / its spread, where mean
// and spread are exact under uniform answering. Designed weights are untouched; an option wins when YOUR
// answers favour it more than an average descent does. No `scoring` block = the old raw behaviour.

const _STATS = new WeakMap();   // weightMap object → Map(optionName → { mu, sd })

/** Exact mean / sd of one option's raw score when every question is answered uniformly at random. */
function _optionStats(spec, weights, signalMult, maxStation = Infinity) {
  let mu = 0, variance = 0;
  for (const station of spec.stations) {
    if (station.index > maxStation) continue;
    for (const q of station.questions) {
      const xs = q.answers.map(a => {
        let x = 0;
        for (const [trait, w] of Object.entries(weights)) {
          if (trait.startsWith("_")) continue;
          let v = a.tags?.[trait] || 0;
          if (signalMult !== 1 && trait.endsWith("_signal")) v *= signalMult;
          x += v * w;
        }
        return x;
      });
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      mu += m;
      variance += xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
    }
  }
  return { mu, sd: Math.sqrt(variance) || 1 };
}

function _statsFor(spec, weightMap, signalMult) {
  let byName = _STATS.get(weightMap);
  if (!byName) { byName = new Map(); _STATS.set(weightMap, byName); }
  return (name) => {
    const key = `${name}|${signalMult}`;
    if (!byName.has(key)) byName.set(key, _optionStats(spec, weightMap[name], signalMult));
    return byName.get(key);
  };
}

const _isZ = (spec) => spec?.scoring?.normalize === "z";

/**
 * Score every option in a weight map against the trait pool. Returns ranked list (descending).
 * @param {Record<string, number>} traitMap
 * @param {Record<string, Record<string, number>>} weightMap — { OptionName: { trait: weight } }
 * @param {object} [opts]
 * @param {number} [opts.signalMultiplier=1] — multiplier applied to *_signal traits (alignment uses 2)
 * @param {object} [opts.spec] — when its scoring.normalize is "z", scores are z-scored per option
 * @returns {Array<{ name: string, score: number, raw: number, sd?: number }>}
 */
export function resolveCategory(traitMap, weightMap, opts = {}) {
  const signalMult = opts.signalMultiplier || 1;
  const stats = _isZ(opts.spec) ? _statsFor(opts.spec, weightMap, signalMult) : null;
  const ranked = [];

  for (const [optName, optWeights] of Object.entries(weightMap || {})) {
    if (optName.startsWith("_")) continue; // skip metadata fields like _comment
    if (!optWeights || typeof optWeights !== "object") continue;

    let raw = 0;
    for (const [trait, weight] of Object.entries(optWeights)) {
      if (trait.startsWith("_")) continue; // skip metadata fields
      let traitValue = traitMap[trait] || 0;
      if (signalMult !== 1 && trait.endsWith("_signal")) traitValue *= signalMult;
      raw += traitValue * weight;
    }
    if (stats) {
      const { mu, sd } = stats(optName);
      ranked.push({ name: optName, score: (raw - mu) / sd, raw, sd });
    } else {
      ranked.push({ name: optName, score: raw, raw });
    }
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
    // Bonuses are authored in raw points; on a z-scored item they count in that option's own spread.
    return bonus ? { ...item, score: item.score + (item.sd ? bonus / item.sd : bonus), alignmentBonus: bonus } : item;
  });
  adjusted.sort((a, b) => b.score - a.score);
  return adjusted;
}

// ============================================================================
// Per-category resolvers (thin wrappers over resolveCategory)
// ============================================================================

/** Sefirot a NEW operative cannot anchor to. Yesod unlocks at the end of the first campaign arc
 *  (Dave, 2026-10-19): the engine never suggests it and the wizard never lists it. The spec keeps
 *  its weights so unlocking later is one entry removed from this list. */
export const LOCKED_ALIGNMENTS = Object.freeze(["Yesod"]);
export const isAlignmentLocked = (name) => LOCKED_ALIGNMENTS.includes(String(name || ""));

export function resolveAlignment(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  // Sefirot signals get ×2 in alignment per trait declaration's weightInAlignmentResolver.
  const ranked = resolveCategory(traitMap, spec.resolverWeights.alignment, { signalMultiplier: 2, spec })
    .filter(r => !isAlignmentLocked(r.name));
  return { best: ranked[0] || null, ranked };
}

export function resolveAncestry(traitMap, spec = SPEC, alignmentResult = null) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  let ranked = resolveCategory(traitMap, spec.resolverWeights.ancestry, { spec });
  ranked = applyAlignmentBonuses(ranked, "ancestry", spec.alignmentBonuses, alignmentResult);
  return { best: ranked[0] || null, ranked };
}

export function resolveOccult(traitMap, spec = SPEC, alignmentResult = null) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  let ranked = resolveCategory(traitMap, spec.resolverWeights.occult, { spec });
  ranked = applyAlignmentBonuses(ranked, "occult", spec.alignmentBonuses, alignmentResult);
  return { best: ranked[0] || null, ranked };
}

export function resolvePhilosophy(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.philosophy, { spec });
  return { best: ranked[0] || null, ranked };
}

export function resolveArchetype(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.archetype, { spec });
  return { best: ranked[0] || null, ranked };
}

export function resolveCrew(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.crew, { spec });
  return { best: ranked[0] || null, ranked };
}

export function resolveClass(traitMap, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  const ranked = resolveCategory(traitMap, spec.resolverWeights.class, { spec });
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
  const ranked = resolveCategory(traitMap, classDoctrines, { spec });
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
 *
 * TRAIT LEAN (2026-10-23): with spec.pillarReadout.traitLean, an untagged answer leans by what it says
 * (its mercy-side tags vs its severity-side tags) instead of by which station asked it — station position
 * alone gave every player mercy 6 / severity 6, so the readout was "Balanced" for everyone. The tally also
 * carries `lean`: how far the answers' (mercy − severity) total sits from an average descent over the same
 * questions, in standard deviations. classifyPillarTally reads `lean` when present.
 * @param {Record<string, string>} answers
 * @param {object} [spec=SPEC]
 * @returns {{mercy:number, severity:number, neutral:number, lean?:number}}
 */
export function computePillarTally(answers, spec = SPEC) {
  if (!spec) throw new Error(`${MOD_ID}: spec not loaded`);
  let mercy = 0, severity = 0, neutral = 0;
  const defaults = spec.pillarTagScheme.defaultsBySefirahPillar;
  const tl = spec.pillarReadout?.traitLean;
  const side = (a, traits) => (traits || []).reduce((s, t) => s + (a.tags?.[t] || 0), 0);
  const tilt = (a) => side(a, tl.mercyTraits) - side(a, tl.severityTraits);
  let raw = 0, mu = 0, variance = 0;

  for (const station of spec.stations) {
    const stationDefault = defaults[station.pillar] || "neutral";
    for (const q of station.questions) {
      const key = answers?.[q.id];
      if (!key) continue;
      const answer = q.answers.find(a => a.key === key);
      if (!answer) continue;
      let tag = answer.pillarTag;
      if (!tag && tl) { const t = tilt(answer); tag = t > 0 ? "mercy" : t < 0 ? "severity" : "neutral"; }
      tag ||= stationDefault;
      if (tag === "mercy") mercy++;
      else if (tag === "severity") severity++;
      else neutral++;
      if (tl) {
        const xs = q.answers.map(tilt), m = xs.reduce((s, x) => s + x, 0) / xs.length;
        raw += tilt(answer); mu += m; variance += xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
      }
    }
  }
  const tally = { mercy, severity, neutral };
  if (tl) tally.lean = variance > 0 ? Math.round(((raw - mu) / Math.sqrt(variance)) * 100) / 100 : 0;
  return tally;
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
  const tl = spec.pillarReadout.traitLean;
  if (tl && typeof tally?.lean === "number") {
    if (tally.lean >= tl.tiltZ) return labels.tiltingMercy;
    if (tally.lean <= -tl.tiltZ) return labels.tiltingSeverity;
    return labels.balanced;
  }
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
 * Write the pillar tally to actor flags.
 * 🟡 DORMANT (write-only): intended as the AAE political-drift seed, but nothing
 * reads flags.bbttcc-sorting-engine.pillarTally yet — the quiz's Mercy/Severity
 * lean has no mechanical effect until a reader lands. Left dormant on purpose
 * (housekeeping 2026-10-02) — keep writing it; build a reader only on an owner ask.
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
  LOCKED_ALIGNMENTS,
  isAlignmentLocked,
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
