// Roll for Initiation — ft-progression.js  v0.2.0
// Foundation progression pass: initiation, aptitude ranks, active effects

// ─── Constants ────────────────────────────────────────────────────────────────

// Tier derived from level
export function tierForLevel(level) {
  if (level >= 16) return 4;
  if (level >= 11) return 3;
  if (level >= 6)  return 2;
  return 1;
}

// Skill points awarded at these levels (2 points each)
export const SKILL_POINT_LEVELS = new Set([3, 6, 9, 12, 15, 18, 20]);

// Stat points: 1 per level
export function statPointsAtLevel(level) { return level; }

// Subclass feature levels (Sprint F — April 2026).
// Canonical cadence for all Sprint F subclasses: L1 / L5 / L9 / L13 / L17.
// Subclass JSONs use <h3>Level N: Feature Name</h3> headers at these levels.
// Feature granting is currently MANUAL (player drags features from subclass item).
// Wizard Step 0 (next sprint) will parse these headers and auto-grant on level up.
export const SUBCLASS_FEATURE_LEVELS = new Set([1, 5, 9, 13, 17]);

// ─── Skill rank milestones ────────────────────────────────────────────────────

export const SKILL_RANK_DATA = {
  0: { label: "Untrained",  color: "#546e7a", bonus: 0,
       mechanic: null,
       desc: "No special training. Natural 1+1 is always a fumble." },
  1: { label: "Trained",    color: "#78909c", bonus: 1,
       mechanic: "no_fumble",
       desc: "+1. Natural 1+1 no longer auto-fails." },
  2: { label: "Proficient", color: "#4a90d9", bonus: 2,
       mechanic: "reroll_low",
       desc: "+2. Reroll the lowest die, keep new result." },
  3: { label: "Expert",     color: "#27ae60", bonus: 3,
       mechanic: "floor_4",
       desc: "+3. Neither die can show below 4." },
  4: { label: "Master",     color: "#e8c84a", bonus: 4,
       mechanic: "3d10_drop",
       desc: "+4. Roll 3d10, drop the lowest." },
  5: { label: "Legendary",  color: "#eb5757", bonus: 5,
       mechanic: "legendary",
       desc: "+5. Once per scene: auto-succeed DC ≤ 20, or add +10 to roll." }
};

// Scene tracking for legendary — keyed by actorId+skillKey
const _legendaryUsed = new Map();

export function legendaryUsed(actorId, skillKey) {
  return _legendaryUsed.get(`${actorId}:${skillKey}`) ?? false;
}

export function markLegendaryUsed(actorId, skillKey) {
  _legendaryUsed.set(`${actorId}:${skillKey}`, true);
}

export function resetLegendaryOnSceneChange() {
  _legendaryUsed.clear();
}

// ─── Skill roll with rank mechanics ───────────────────────────────────────────

// Explode a single d10 chain: every 10 banks +1 Surge and rolls another d10.
async function explodeFromBase(baseValue) {
  let total = 0;
  const explosions = [];
  let value = baseValue;
  while (value === 10) {
    const ex = new Roll("1d10");
    await ex.evaluate();
    value = ex.total;
    total += value;
    explosions.push(value);
  }
  return { bonus: total, explosions };
}

// `allowSurge` (default true) gates the per-die explosion chain. Foes that the
// GM hasn't enabled Surge for pass `false` so their checks roll plain Nd10 —
// no exploding dice fed into the total, nothing banked (playtest 2026-06-09).
export async function skillRollWithRank(actor, { attribute, skill, label = "", allowSurge = true } = {}) {
  const rawSys   = actor.system?.system ?? actor.system;
  const attrVal  = rawSys?.attributes?.[attribute]?.value ?? 2;
  const rank     = rawSys?.skills?.[skill]?.value ?? 0;
  // Clamp rank for table lookup so legacy over-cap source values (e.g. 9)
  // resolve to the Legendary tier instead of falling back to "Untrained".
  // The roll formula still uses the raw rank as the numeric bonus.
  const rankClamped = Math.max(0, Math.min(5, Number(rank) || 0));
  const rankData = SKILL_RANK_DATA[rankClamped] ?? SKILL_RANK_DATA[0];

  // Collect AE bonuses for skill AND attribute. Attribute walk added so Fury
  // Aura (system.attributes.violence.value +1) lifts violence-keyed Aptitudes —
  // previously only Engage/Steward rolls picked up attribute AEs.
  const aeSkillBonus = getAEBonusForSkill(actor, skill);
  const { bonus: aeAttrBonus, contribs: aeAttrContribs } = getAEBonusForAttr(actor, attribute);
  const aeBonus    = aeSkillBonus + aeAttrBonus;
  // Radiation Sickness — flat penalty to every aptitude check. Read from the
  // system helper (exposed on game.fourththing) so the threshold ladder stays
  // single-source; defaults to 0 if unavailable.
  const radPenalty = game.fourththing?.radiationBite?.(actor)?.rollPenalty ?? 0;
  // Use raw rank for the additive numeric bonus so chat-card math still
  // reflects the stored value; rankData.bonus reflects the clamped table.
  const totalBonus = attrVal + Number(rank) + aeBonus - radPenalty;

  // Master (rank 4) and Legendary (rank 5+) roll 3d10 keep best 2. Everyone else rolls 2d10.
  const poolSize = rankClamped >= 4 ? 3 : 2;
  const formula  = `${poolSize}d10 + ${totalBonus}`;

  const roll = new Roll(formula);
  await roll.evaluate();
  const baseDice = (roll.terms[0]?.results ?? []).map(r => r.result);

  // Double-ten on base dice = "act again this turn" bonus action.
  const baseTenCount = baseDice.filter(v => v === 10).length;
  const doubleTen    = baseTenCount >= 2;

  // Fumble (rank 0 only): every base die is a 1.
  const isFumble = rank === 0 && baseDice.length > 0 && baseDice.every(v => v === 1);

  // Apply rank mechanics to get the "adjusted" per-die value before explosion bonuses.
  // - floor_4 (rank 3): bump any sub-4 up to 4. Explosion triggers on the ORIGINAL die only.
  // - reroll_low (rank 2): reroll lowest die; if higher, replace. A rerolled 10 still explodes.
  const explodeTriggers = [...baseDice];  // values used to decide if a die explodes
  const adjusted        = [...baseDice];  // values used for the base sum
  let rerollNote = null;

  if (rankData.mechanic === "floor_4") {
    for (let i = 0; i < adjusted.length; i++) adjusted[i] = Math.max(4, adjusted[i]);
  }

  // Shape B reroll grants — passive items granting reroll-lowest/highest on
  // this check (e.g. "advantage on Body checks" from a heritage feat).
  // Doesn't stack with rank mechanics: if rank already triggers reroll-low,
  // the rank reroll wins and AE grants are noted but don't fire a second time.
  const aeRerollGrants = collectRerolls(actor, { context: "check", skill, attribute });
  const aeRerollLowSource  = aeRerollGrants.find(g => g.mode === "reroll-lowest")?.sourceItemName;
  const aeRerollHighSource = aeRerollGrants.find(g => g.mode === "reroll-highest")?.sourceItemName;

  if (rankData.mechanic === "reroll_low" || aeRerollLowSource) {
    const minVal = Math.min(...adjusted);
    const minIdx = adjusted.indexOf(minVal);
    const reroll = new Roll("1d10");
    await reroll.evaluate();
    const rerollVal = reroll.total;
    const srcTag = rankData.mechanic === "reroll_low"
      ? "Proficient"
      : aeRerollLowSource;
    if (rerollVal > minVal) {
      adjusted[minIdx]        = rerollVal;
      explodeTriggers[minIdx] = rerollVal;   // reroll can explode
      rerollNote = `↑ rerolled ${minVal} → ${rerollVal} (${srcTag})`;
    } else {
      rerollNote = `↑ rerolled ${minVal} → ${rerollVal} kept original (${srcTag})`;
    }
  } else if (aeRerollHighSource) {
    // Reroll-highest from a passive (e.g. enemy aura imposes disadvantage).
    const maxVal = Math.max(...adjusted);
    const maxIdx = adjusted.indexOf(maxVal);
    const reroll = new Roll("1d10");
    await reroll.evaluate();
    const rerollVal = reroll.total;
    if (rerollVal < maxVal) {
      adjusted[maxIdx]        = rerollVal;
      explodeTriggers[maxIdx] = rerollVal;
      rerollNote = `↓ rerolled ${maxVal} → ${rerollVal} (${aeRerollHighSource})`;
    } else {
      rerollNote = `↓ rerolled ${maxVal} → ${rerollVal} kept original (${aeRerollHighSource})`;
    }
  }

  // Chain explosions per die. Master/Legendary: even dropped dice explode and bank Surge.
  const dieResults = [];
  let surgeBanked = 0;
  for (let i = 0; i < baseDice.length; i++) {
    const { bonus, explosions } = allowSurge
      ? await explodeFromBase(explodeTriggers[i])
      : { bonus: 0, explosions: [] };
    surgeBanked += explosions.length;
    dieResults.push({ base: adjusted[i], explosions, chainTotal: adjusted[i] + bonus });
  }

  // Keep best 2 chain totals for rank 4+ pools; otherwise keep everything.
  const sortedForKeep = [...dieResults].sort((a, b) => b.chainTotal - a.chainTotal);
  const kept          = poolSize === 3 ? sortedForKeep.slice(0, 2) : dieResults;
  const keptSum       = kept.reduce((s, d) => s + d.chainTotal, 0);
  const total         = keptSum + totalBonus;

  // Bank Surge on the actor (explosions from ALL dice, including dropped).
  if (surgeBanked > 0) {
    const curSurge = rawSys?.resources?.surge?.value ?? 0;
    await actor.update({ "system.resources.surge.value": curSurge + surgeBanked });
  }

  // Flag bonus-action availability so the sheet can show an "Act Again" button.
  if (doubleTen) {
    await actor.setFlag("fourththing", "bonusActionAvailable", true);
  }

  // Mechanic note for the chat card.
  let mechNote = null;
  if (poolSize === 3) mechNote = "3d10 keep best 2";
  else if (rankData.mechanic === "floor_4") {
    const floorAdd = adjusted.reduce((s, v, i) => s + (v - baseDice[i]), 0);
    if (floorAdd > 0) mechNote = `floor 4 (+${floorAdd})`;
  }

  return { total, roll, rank, rankData, attrVal, aeBonus, totalBonus, radPenalty,
           aeSkillBonus, aeAttrBonus, aeAttrContribs,
           isFumble, mechNote, rerollNote, formula, label, skill, attribute,
           surgeBanked, doubleTen, dieResults, kept };
}

// ─── AE bonus helpers ─────────────────────────────────────────────────────────

// V14 canon is `change.type === "add"` but legacy AEs (e.g. class L1 aptitude
// stamps from 2026-05-04) still use the numeric `change.mode === 2`. Foundry's
// core prepareData honors both via shim, but our custom walkers must also
// accept both shapes or armor/combat grants on existing class anchors stay
// invisible to the sheet (root cause of A1 — wizard armor proficiency bug).
const _isAddChange = (change) => change?.type === "add" || change?.mode === 2;

// ── Item-name aptitude grants (2026-06-06) ───────────────────────────────────
// OWNER-TUNABLE: techniques/feats whose presence on an actor grants flat
// aptitude bonuses, keyed by item name (lowercased prefix match — catches
// both "Spark Sense" and "Spark Sense (1/Soma Break)"). Same code-table
// pattern as CREW_MANEUVER_GRANTS: no LevelDB pack edit needed, the bonus
// rides the AE column on the sheet and every skill roll automatically, and
// vanishes if the item is removed. Playtest 2026-06-06: Spark Sense should
// provide +1 Occult and didn't (the pack item carries no Active Effect).
export const ITEM_APTITUDE_GRANTS = {
  "spark sense": { occult: 1 },
};
function _itemAptitudeGrants(actor) {
  const out = {};
  for (const item of actor?.items ?? []) {
    const n = String(item.name ?? "").toLowerCase().trim();
    for (const [nameKey, grants] of Object.entries(ITEM_APTITUDE_GRANTS)) {
      if (!n.startsWith(nameKey)) continue;
      for (const [skill, v] of Object.entries(grants)) {
        out[skill] = (out[skill] ?? 0) + (Number(v) || 0);
      }
    }
  }
  return out;
}

// Get total Active Effect bonus for a specific skill key
export function getAEBonusForSkill(actor, skillKey) {
  let bonus = _itemAptitudeGrants(actor)[skillKey] ?? 0;
  for (const effect of actor.appliedEffects ?? []) {
    if (effect.disabled) continue;
    for (const change of effect.changes ?? []) {
      if (change.key === `system.skills.${skillKey}.value` && _isAddChange(change)) {
        bonus += Number(change.value) || 0;
      }
    }
  }
  return bonus;
}

// Get total Active Effect bonus for a specific attribute key (mirrors skill helper).
// Used by skillRollWithRank so attribute-keyed buffs (Fury Aura → violence +1) land
// on Aptitude rolls, not just on Engage/Steward rolls.
export function getAEBonusForAttr(actor, attrKey) {
  let bonus = 0;
  const contribs = [];
  for (const effect of actor.appliedEffects ?? []) {
    if (effect.disabled) continue;
    const src = effect.parent?.name ?? effect.name ?? "Passive";
    for (const change of effect.changes ?? []) {
      if (change.key === `system.attributes.${attrKey}.value` && _isAddChange(change)) {
        const v = Number(change.value) || 0;
        if (!v) continue;
        bonus += v;
        contribs.push({ src, label: attrKey, value: v });
      }
    }
  }
  return { bonus, contribs };
}

// Get all active skill bonuses as a map { skillKey: totalBonus }
export function getAllSkillAEBonuses(actor) {
  const bonuses = _itemAptitudeGrants(actor); // item-name grants (Spark Sense etc.)
  for (const effect of actor.appliedEffects ?? []) {
    if (effect.disabled) continue;
    for (const change of effect.changes ?? []) {
      if (change.key?.startsWith("system.skills.") && change.key.endsWith(".value") && _isAddChange(change)) {
        const skill = change.key.split(".")[2];
        bonuses[skill] = (bonuses[skill] ?? 0) + (Number(change.value) || 0);
      }
    }
  }
  return bonuses;
}

// Get all active attribute bonuses
export function getAllAttrAEBonuses(actor) {
  const bonuses = {};
  for (const effect of actor.appliedEffects ?? []) {
    if (effect.disabled) continue;
    for (const change of effect.changes ?? []) {
      if (change.key?.startsWith("system.attributes.") && change.key.endsWith(".value") && _isAddChange(change)) {
        const attr = change.key.split(".")[2];
        bonuses[attr] = (bonuses[attr] ?? 0) + (Number(change.value) || 0);
      }
    }
  }
  return bonuses;
}

// ─── Reroll grants (Shape B passive engine) ──────────────────────────────────
// Items declare reroll grants under flags.fourththing.rerolls = [{
//   context: "save"|"defense"|"attack"|"check"|"initiative"|"death-save"
//          |"concentration"|"opportunity-attack"|"alignment-shift"
//          |"spark-id"|"forced-movement"|"attacked-by",
//   skill?: "stealth"|...,            // narrows context=check/attack
//   attribute?: "violence"|"body"|...,// narrows context=check/save/defense
//   mode: "reroll-lowest"|"reroll-highest",
//   vs?: "poison"|"fear"|...,         // surface in chat as "applies if vs X"
//   note?: "while in caravan towns"   // GM-only narrative gate, never auto-evaluates
// }]
//
// Roll-time call: collectRerolls(actor, { context, skill?, attribute? })
// Returns a list of matching grants (each tagged with sourceItemName).
//
// `attacked-by` direction is NOT yet wired — it requires target-context (the
// attacker queries the target's grants). Phase 2 of the reroll sprint.
// Id-keyed reroll grants for techniques whose imported items carry no
// flags.fourththing.rerolls (audit 2026-06-07: Anchor Point promised
// reroll-lowest vs push/prone/Shaken/charm and granted nothing).
const ID_REROLL_GRANTS = {
  bbttcc_feat_anchor_point: [
    { context: "save",            mode: "reroll-lowest", vs: "being pushed, pulled, knocked prone, Shaken, or charmed", note: "Anchor Point" },
    { context: "check",           mode: "reroll-lowest", vs: "being pushed, pulled, knocked prone, Shaken, or charmed", note: "Anchor Point" },
    { context: "forced-movement", mode: "reroll-lowest", note: "Anchor Point" }
  ]
};

export function collectRerolls(actor, query = {}) {
  const out = [];
  const items = actor?.items ?? [];
  const wantContext   = query.context;
  const wantSkill     = query.skill ?? null;
  const wantAttribute = query.attribute ?? null;
  for (const item of items) {
    const grants = item.flags?.fourththing?.rerolls
      ?? ID_REROLL_GRANTS[String(item.system?.identifier ?? "")];
    if (!Array.isArray(grants) || grants.length === 0) continue;
    for (const g of grants) {
      if (!g || !g.context || !g.mode) continue;
      // context match — exact, OR "check" matches anything skill/attribute-shaped
      const ctxMatch = g.context === wantContext
        || (g.context === "check" && (wantContext === "check" || wantContext === "save" || wantContext === "attack"));
      if (!ctxMatch) continue;
      // narrowers: if grant specifies a skill, query must match (or no skill in query yet)
      if (g.skill     && wantSkill     && g.skill     !== wantSkill)     continue;
      if (g.attribute && wantAttribute && g.attribute !== wantAttribute) continue;
      // grant is more specific than query? skip — the grant is for a different roll
      if (g.skill     && !wantSkill)     continue;
      if (g.attribute && !wantAttribute) continue;
      out.push({
        mode: g.mode,
        sourceItemName: item.name,
        sourceItemId:   item.id,
        vs:   g.vs ?? null,
        note: g.note ?? null
      });
    }
  }
  // CL Annotation one-shot grants — pushed by Annotator's Edit dialog onto the
  // target's `flags.fourththing.annotationPending` (integer count). Each pending
  // grant offers a reroll-lowest on attribute / save / attack / check rolls.
  // Consumed via `consumeAnnotationReroll(actor, applied)` after the roll path
  // runs applyRerollGrants. Lost if the engine doesn't apply (e.g., the
  // existing roll was already optimal) — acceptable v1 trade.
  const annoPending = Number(actor?.flags?.fourththing?.annotationPending) || 0;
  if (annoPending > 0) {
    const ctxOk = !wantContext
      || wantContext === "check" || wantContext === "save" || wantContext === "attack"
      || wantContext === "caster-check";
    if (ctxOk) {
      out.push({
        mode: "reroll-lowest",
        sourceItemName: "Annotation (Cosmic Linguist)",
        sourceItemId: null,
        _annotation: true
      });
    }
  }
  // Shadow Courier — Spend Pace · Reroll. One-shot reroll-lowest armed by the
  // Pace dialog (flags.fourththing.combat.paceReroll). Skill checks only, so it
  // only surfaces on the "check" context (attributeTest). Consumed via
  // consumePaceReroll after applyRerollGrants; cleared by _onFtNewTurn if unused.
  if (actor?.flags?.fourththing?.combat?.paceReroll && wantContext === "check") {
    out.push({
      mode: "reroll-lowest",
      sourceItemName: "Pace (Shadow Courier)",
      sourceItemId: null,
      _paceReroll: true
    });
  }
  // Ancestry one-shot reroll grants (Sefirot Attunement, Qliphothic Saturation).
  // Single slot at flags.fourththing.ancestry.oneShotReroll = { mode, source,
  // attribute?, skill? }. Optionally scoped; armed by the ability dialog, cleared
  // by consumeAncestryReroll. Check-context only (these are skill/attribute checks).
  const ancR = actor?.flags?.fourththing?.ancestry?.oneShotReroll;
  if (ancR && wantContext === "check"
      && (!ancR.attribute || ancR.attribute === wantAttribute)
      && (!ancR.skill     || ancR.skill === wantSkill)) {
    out.push({
      mode: ancR.mode || "reroll-lowest",
      sourceItemName: ancR.source || "Ancestry",
      sourceItemId: null,
      _ancestryReroll: true
    });
  }
  // Aid / Rallying Words — banked reroll-lowest grants on the roller's
  // flags.fourththing.aidBanked array (pushed by Aid, Rallying Words, Rally to Me,
  // Unity Flourish, Conductor's Crescendo). Each entry = one reroll-lowest on a
  // check / save / attack. ONE entry is popped via consumeAidReroll if used.
  const _aid = actor?.flags?.fourththing?.aidBanked;
  if (Array.isArray(_aid) && _aid.some(b => b?.kind === "reroll-lowest")) {
    const ctxOk = !wantContext || wantContext === "check" || wantContext === "save"
               || wantContext === "attack" || wantContext === "caster-check";
    if (ctxOk) out.push({ mode: "reroll-lowest", sourceItemName: "Aid (Rallying Words)", sourceItemId: null, _aid: true });
  }
  return out;
}

// Consume a CL Annotation pending grant if the just-applied reroll list
// includes one. Call AFTER applyRerollGrants resolves.
export async function consumeAnnotationReroll(actor, applied) {
  if (!actor || !Array.isArray(applied) || !applied.length) return;
  const used = applied.some(a =>
    a?.source === "Annotation (Cosmic Linguist)"
    || a?.sourceItemName === "Annotation (Cosmic Linguist)"
  );
  if (!used) return;
  const cur = Number(actor.flags?.fourththing?.annotationPending) || 0;
  if (cur <= 0) return;
  try { await actor.update({ "flags.fourththing.annotationPending": Math.max(0, cur - 1) }); }
  catch (e) { console.warn("Annotation consume failed", e); }
}

// Consume the Shadow Courier Pace reroll one-shot if it was used on the just-
// applied reroll list. Call AFTER applyRerollGrants, alongside
// consumeAnnotationReroll. The flag is a single-use boolean (not a count).
export async function consumePaceReroll(actor, applied) {
  if (!actor || !Array.isArray(applied) || !applied.length) return;
  const used = applied.some(a =>
    a?.source === "Pace (Shadow Courier)" || a?.sourceItemName === "Pace (Shadow Courier)"
  );
  if (!used) return;
  try { await actor.update({ "flags.fourththing.combat.-=paceReroll": null }); }
  catch (e) { console.warn("Pace reroll consume failed", e); }
}

// Consume the single-slot ancestry reroll one-shot if it was used on the just-
// applied reroll list. Call AFTER applyRerollGrants, alongside the others.
export async function consumeAncestryReroll(actor, applied) {
  if (!actor || !Array.isArray(applied) || !applied.length) return;
  const src = actor.flags?.fourththing?.ancestry?.oneShotReroll?.source;
  if (!src) return;
  const used = applied.some(a => a?.source === src || a?.sourceItemName === src);
  if (!used) return;
  try { await actor.update({ "flags.fourththing.ancestry.-=oneShotReroll": null }); }
  catch (e) { console.warn("Ancestry reroll consume failed", e); }
}

// Consume ONE banked Aid / Rallying-Words reroll-lowest if it was used on the
// just-applied reroll list. Call AFTER applyRerollGrants, alongside the others.
// (Makes Aid, Rallying Words, and all Harmony Marshal rally abilities auto-fire.)
export async function consumeAidReroll(actor, applied) {
  if (!actor || !Array.isArray(applied) || !applied.length) return;
  const used = applied.some(a => a?.source === "Aid (Rallying Words)" || a?.sourceItemName === "Aid (Rallying Words)");
  if (!used) return;
  const banked = Array.isArray(actor.flags?.fourththing?.aidBanked) ? [...actor.flags.fourththing.aidBanked] : [];
  const i = banked.findIndex(b => b?.kind === "reroll-lowest");
  if (i < 0) return;
  banked.splice(i, 1);
  try { await actor.update({ "flags.fourththing.aidBanked": banked }); }
  catch (e) { console.warn("Aid reroll consume failed", e); }
}

// Apply reroll grants to a freshly-evaluated Roll. Mutates dieResults in
// place (reroll-lowest replaces lowest if higher; reroll-highest replaces
// highest if lower). Returns { applied: [{mode, before, after, source}],
// adjustedTotal: number } so the caller can rebuild flavor.
//
// `roll`         — Foundry Roll object (already evaluated)
// `bonusDelta`   — flat bonus already added into roll.total (so we can recompute)
// `grants`       — array from collectRerolls()
// `formulaBase`  — string base formula used (for chat display)
export async function applyRerollGrants(roll, grants, bonusDelta = 0) {
  const applied = [];
  if (!grants?.length) return { applied, adjustedTotal: roll.total };

  // Walk d10 results in the first dice term (all fourththing rolls use 2d10/2d10x10 + N)
  const term = roll.terms?.[0];
  if (!term?.results?.length) return { applied, adjustedTotal: roll.total };

  const baseDice = term.results.slice(0, 2); // explosions sit at index ≥2

  const hasRerollLow  = grants.some(g => g.mode === "reroll-lowest");
  const hasRerollHigh = grants.some(g => g.mode === "reroll-highest");

  if (hasRerollLow) {
    const minIdx = baseDice[0].result <= baseDice[1].result ? 0 : 1;
    const before = baseDice[minIdx].result;
    const reroll = new Roll("1d10"); await reroll.evaluate();
    const after  = reroll.total;
    if (after > before) {
      baseDice[minIdx].result = after;
      const src = grants.find(g => g.mode === "reroll-lowest");
      applied.push({ mode: "reroll-lowest", before, after, source: src?.sourceItemName ?? "Passive" });
    }
  }
  if (hasRerollHigh) {
    const maxIdx = baseDice[0].result >= baseDice[1].result ? 0 : 1;
    const before = baseDice[maxIdx].result;
    const reroll = new Roll("1d10"); await reroll.evaluate();
    const after  = reroll.total;
    if (after < before) {
      baseDice[maxIdx].result = after;
      const src = grants.find(g => g.mode === "reroll-highest");
      applied.push({ mode: "reroll-highest", before, after, source: src?.sourceItemName ?? "Passive" });
    }
  }

  if (!applied.length) return { applied, adjustedTotal: roll.total };

  // Recompute total: sum of (potentially-rerolled) base dice + explosion dice + bonusDelta
  const baseSum     = baseDice.reduce((s, d) => s + d.result, 0);
  const explodeSum  = (term.results.slice(2) ?? []).reduce((s, d) => s + d.result, 0);
  const adjustedTotal = baseSum + explodeSum + bonusDelta;
  // Patch the roll's _total so toMessage() shows the new value
  try { roll._total = adjustedTotal; } catch (_) {}
  return { applied, adjustedTotal };
}

// ─── Resource grants (Phase D passive engine) ────────────────────────────────
// Items declare resource grants under flags.fourththing.resourceGrants = [{
//   cadence:  "per-soma-break"|"per-scene"|"per-scene-start"|"per-scene-end"
//          |"per-scenario"|"per-campaign-start"|"per-strategic-turn"
//          |"on-condition" (Chunk 6 territory),
//   resource: "violence-op"|"intrigue-op"|"soft-power-op"|"diplomacy-op"
//          |"economy-op"|"non-lethal-op"|"faith-op"|"logistics-op"
//          |"siege-op"|"body-op"|"frame-die"|"ruin-charge"|"pace"|"package"
//          |"surge"|"clarity"|"integrity"|"integrity-temp"|"stress",
//   amount: number | "refill",
//   target: "self"|"faction"|"ally" (default "faction" for *-op, "self" for others),
//   note?: "narrative GM-only gate"
// }]
//
// Engine API:
//   collectResourceGrants(actor, cadence) → list of {grant, sourceItemName, sourceItemId}
//   fireResourceGrants(actor, cadence)   → applies all matching grants, returns
//                                            a summary {fired:[...], errors:[...]}
//
// `on-condition` is NOT fired by this engine — Chunk 6 trigger registry handles it.

// Map per-item resource names → underlying data path / opBank key.
const _OP_POOL_MAP = {
  "violence-op":   "violence",
  "intrigue-op":   "intrigue",
  "soft-power-op": "softpower",
  "diplomacy-op":  "diplomacy",
  "economy-op":    "economy",
  "non-lethal-op": "nonlethal",
  "faith-op":      "faith",
  "logistics-op":  "logistics",
  "siege-op":      "siege",
  "body-op":       "body",
  "soul-op":       "soul"
};
const _SELF_RESOURCE_PATH = {
  "frame-die":      "system.resources.frameDice.current",
  "ruin-charge":    "system.resources.ruinCharges.current",
  "pace":           "system.resources.pace.current",
  "package":        "system.resources.package.current",
  "surge":          "system.resources.surge.value",
  "clarity":        "system.magic.clarity.value",
  "integrity":      "system.derived.integrity.value",
  "integrity-temp": "system.derived.integrity.temp",
  "stress":         "system.derived.stress.value"
};
const _SELF_RESOURCE_MAX_PATH = {
  "frame-die":   "system.resources.frameDice.max",
  "ruin-charge": "system.resources.ruinCharges.max",
  "pace":        "system.resources.pace.max",
  "package":     "system.resources.package.max",
  "clarity":     "system.magic.clarity.max",
  "integrity":   "system.derived.integrity.max",
  "stress":      "system.derived.stress.max"
};

export function collectResourceGrants(actor, cadence) {
  const out = [];
  for (const item of actor?.items ?? []) {
    const grants = item.flags?.fourththing?.resourceGrants;
    if (!Array.isArray(grants)) continue;
    for (const g of grants) {
      if (!g || g.cadence !== cadence) continue;
      out.push({ grant: g, sourceItemName: item.name, sourceItemId: item.id });
    }
  }
  return out;
}

async function _applyOneGrant(actor, grant) {
  const { resource, amount } = grant;
  const target = grant.target ?? (_OP_POOL_MAP[resource] ? "faction" : "self");

  // FACTION OP grants — resolve to faction document, mutate opBank
  if (target === "faction" && _OP_POOL_MAP[resource]) {
    const factionId = actor.getFlag?.("bbttcc-factions", "factionId");
    if (!factionId) return { ok: false, reason: "no faction linked", resource, amount };
    const faction = game.actors?.get(factionId);
    if (!faction) return { ok: false, reason: `faction ${factionId} not found`, resource, amount };
    const bank = foundry.utils.duplicate(faction.flags?.["bbttcc-factions"]?.opBank ?? {});
    const pool = _OP_POOL_MAP[resource];
    const before = Number(bank[pool]) || 0;
    bank[pool] = before + Number(amount);
    await faction.update({ "flags.bbttcc-factions.opBank": bank });
    return { ok: true, target: `faction:${faction.name}`, resource, pool, amount, before, after: bank[pool] };
  }

  // SELF grants — direct path update (with refill semantics for "amount: refill")
  if (target === "self" && _SELF_RESOURCE_PATH[resource]) {
    const path = _SELF_RESOURCE_PATH[resource];
    const maxPath = _SELF_RESOURCE_MAX_PATH[resource];
    let value;
    if (amount === "refill" || amount === "max") {
      if (!maxPath) return { ok: false, reason: `no max path for ${resource}`, resource };
      value = Number(foundry.utils.getProperty(actor, maxPath)) || 0;
    } else {
      const before = Number(foundry.utils.getProperty(actor, path)) || 0;
      const max    = maxPath ? Number(foundry.utils.getProperty(actor, maxPath)) || Infinity : Infinity;
      value = Math.min(max, before + Number(amount));
    }
    await actor.update({ [path]: value });
    return { ok: true, target: "self", resource, amount, after: value };
  }

  // Ally grants — v1 doesn't auto-fire; surface in chat as a GM hint
  if (target === "ally" || (typeof grant.target === "object" && grant.target?.ally)) {
    return { ok: false, reason: "ally targeting deferred — GM applies manually", resource, amount };
  }

  return { ok: false, reason: `unknown resource/target combo: ${resource}/${JSON.stringify(grant.target)}`, resource };
}

export async function fireResourceGrants(actor, cadence) {
  const matches = collectResourceGrants(actor, cadence);
  const fired   = [];
  const skipped = [];
  for (const m of matches) {
    const result = await _applyOneGrant(actor, m.grant);
    const tag = `${m.sourceItemName}: ${m.grant.resource} ${m.grant.amount}`;
    if (result.ok) fired.push({ ...result, source: m.sourceItemName, note: m.grant.note ?? null });
    else skipped.push({ ...result, source: m.sourceItemName, tag });
  }
  return { fired, skipped, cadence };
}

// ─── Triggers engine (Phase C) ───────────────────────────────────────────────
// Items declare triggers under flags.fourththing.triggers = [{
//   event:    "on-attack-hit"|"on-damage-taken"|"on-skill-fail"
//          |"on-self-or-ally-hit"|"on-would-drop-to-zero"|"on-soma-break"
//          |"on-move"|"on-delivery"|"on-agreement"|"on-cast"|... (closed enum, see survey),
//   predicate?: { tag?:[...], dieMin?:N, scope?:"self"|"ally"|"enemy", typeMatch?:"melee"|"radiant"|... },
//   limit?:    { window:"turn"|"round"|"scene"|"soma-break"|"short-rest"|"session", uses:N },
//   effect:    { kind, args } where kind ∈ {
//                "grant-resource"     args:{resource, amount, target?}
//                "extra-damage"       args:{dieFormula, type}
//                "queued-reroll"      args:{context, mode}    // queued for next matching roll
//                "spend-and-survive"  args:{resource, amount}
//                "add-temp-integrity" args:{amount, target?, radius?}
//                "chat-prompt"        args:{templateKey, body?}  // GM-resolves manually
//              }
// }]
//
// on-cast (2026-08-17) — fires once per RESOLVED manifestation, from
// castManifestation's single exit (every gate rejection returns long before it).
//   tags   — stance ("hermetic"/"chaos"/"ascendant"), outcome ("success"/"fail",
//            plus "misfire"), reach ("reach" + "reach-surge"/"reach-bloodDebt"),
//            "miracle", tier ("t1".."t4"), stability ("instant"/"sustained"/
//            "bound"/"enduring"), and the cast's intent + channel.
//   amount — the manifestation's TIER, so {amountMin:3} = "T3 or above".
//   maxDie — highest single die on the cast roll, as on-attack-hit does.
// e.g. {event:"on-cast", predicate:{tag:["chaos"]}, limit:{window:"scene",uses:1},
//       effect:{kind:"grant-resource", args:{resource:"surge", amount:1}}}
//
// Engine API:
//   collectTriggers(actor, event)      → list of {trigger, sourceItemName, sourceItemId}
//   fireTriggers(actor, event, payload) → matches predicates, enforces limits,
//                                          dispatches effects, returns {fired, skipped}
//
// Limit tracking: actor.flags.fourththing.triggerUsage = {
//   "<itemId>:<eventIndex>": { window, count, sceneId/round/turn/etc.scoped }
// }

const _TRIGGER_USAGE_FLAG = "triggerUsage";

function _ftWindowKey(window) {
  // Returns the current "window key" for rate-limit reset detection.
  // Different windows use different scoping — scene id, combat round, etc.
  switch (window) {
    case "turn":         return `turn:${game.combat?.id ?? "none"}:${game.combat?.round ?? 0}:${game.combat?.turn ?? 0}`;
    case "round":        return `round:${game.combat?.id ?? "none"}:${game.combat?.round ?? 0}`;
    case "scene":        return `scene:${game.scenes?.current?.id ?? "none"}`;
    case "soma-break":   // resets when actor takes Soma Break (cleared in somaBreak action)
    case "short-rest":   return `rest:${window}`;
    case "session":      return `session`;     // never auto-resets; GM clears manually
    default:             return `unknown:${window}`;
  }
}

export function collectTriggers(actor, event) {
  const out = [];
  for (const item of actor?.items ?? []) {
    const triggers = item.flags?.fourththing?.triggers;
    if (!Array.isArray(triggers)) continue;
    for (let i = 0; i < triggers.length; i++) {
      const t = triggers[i];
      if (!t || t.event !== event) continue;
      out.push({ trigger: t, sourceItemName: item.name, sourceItemId: item.id, triggerIndex: i });
    }
  }
  return out;
}

function _matchPredicate(t, payload) {
  const p = t.predicate;
  if (!p) return true;
  // Tag match — predicate.tag is an array; payload.tags is an array. Any-overlap.
  if (Array.isArray(p.tag) && p.tag.length) {
    const payloadTags = Array.isArray(payload?.tags) ? payload.tags : [];
    if (!p.tag.some(tag => payloadTags.includes(tag))) return false;
  }
  // Die threshold — payload.maxDie is the highest single die value in the roll.
  if (Number.isFinite(p.dieMin)) {
    const maxDie = Number(payload?.maxDie ?? 0);
    if (maxDie < p.dieMin) return false;
  }
  // Damage/movement amount threshold. 2026-05-20 — also check cumulative
  // (e.g. movementUsedFt this turn) so piecewise on-move events that don't
  // individually clear the threshold can still fire when the per-turn total
  // does. Used by Shadow Courier Liminal Operator ("move 30+ ft on your
  // turn → +1 Pace"). The trigger's limit:{window:"turn", uses:1} stops it
  // from firing multiple times in the same turn.
  if (Number.isFinite(p.amountMin)) {
    const amount = Number(payload?.amount ?? 0);
    const cumulative = Number(payload?.cumulativeFt ?? 0);
    if (Math.max(amount, cumulative) < p.amountMin) return false;
  }
  // Scope (self/ally/enemy of the trigger subject)
  if (p.scope && payload?.scope && p.scope !== payload.scope) return false;
  return true;
}

async function _checkAndConsumeLimit(actor, sourceItemId, triggerIndex, limit) {
  if (!limit?.window) return { allowed: true };
  const key = `${sourceItemId}:${triggerIndex}`;
  const usage = actor.getFlag("fourththing", _TRIGGER_USAGE_FLAG) ?? {};
  const windowKey = _ftWindowKey(limit.window);
  const current = usage[key];
  const usedInWindow = (current?.windowKey === windowKey) ? Number(current.count) || 0 : 0;
  if (usedInWindow >= Number(limit.uses ?? 1)) return { allowed: false, reason: `${limit.uses}/${limit.window} used` };
  // Reserve a use
  const updated = { ...usage, [key]: { windowKey, count: usedInWindow + 1, at: Date.now() } };
  await actor.setFlag("fourththing", _TRIGGER_USAGE_FLAG, updated);
  return { allowed: true };
}

async function _dispatchEffect(actor, effect, source, payload) {
  const kind = effect?.kind;
  const args = effect?.args ?? {};
  switch (kind) {
    case "grant-resource": {
      // Reuse Chunk 5 single-grant logic by synthesizing a per-campaign-start grant
      // and calling _applyOneGrant indirectly via fireResourceGrants. Simpler:
      // do an inline OP-bank bump for now; structured to extend later.
      const POOL = {
        "violence-op":"violence","intrigue-op":"intrigue","soft-power-op":"softpower",
        "diplomacy-op":"diplomacy","economy-op":"economy","non-lethal-op":"nonlethal",
        "faith-op":"faith","logistics-op":"logistics","siege-op":"siege","body-op":"body","soul-op":"soul"
      };
      const target = args.target ?? (POOL[args.resource] ? "faction" : "self");
      if (target === "faction" && POOL[args.resource]) {
        const factionId = actor.getFlag?.("bbttcc-factions", "factionId");
        const faction = factionId ? game.actors?.get(factionId) : null;
        if (!faction) return { ok:false, reason:"no faction linked" };
        const bank = foundry.utils.duplicate(faction.flags?.["bbttcc-factions"]?.opBank ?? {});
        const pool = POOL[args.resource];
        bank[pool] = (Number(bank[pool]) || 0) + Number(args.amount);
        await faction.update({ "flags.bbttcc-factions.opBank": bank });
        return { ok:true, summary:`+${args.amount} ${args.resource} → ${faction.name}` };
      }
      if (target === "self") {
        const SELF_PATH = {
          "frame-die":"system.resources.frameDice.current",
          "ruin-charge":"system.resources.ruinCharges.current",
          "pace":"system.resources.pace.current",
          "package":"system.resources.package.current",
          "surge":"system.resources.surge.value",
          "clarity":"system.magic.clarity.value",
          "integrity":"system.derived.integrity.value",
          "stress":"system.derived.stress.value"
        };
        const path = SELF_PATH[args.resource];
        if (!path) return { ok:false, reason:`unknown self resource ${args.resource}` };
        const before = Number(foundry.utils.getProperty(actor, path)) || 0;
        await actor.update({ [path]: before + Number(args.amount) });
        return { ok:true, summary:`+${args.amount} ${args.resource} → self` };
      }
      return { ok:false, reason:`unsupported target ${target}` };
    }
    case "add-temp-integrity": {
      const path = "system.derived.integrity.temp";
      const before = Number(foundry.utils.getProperty(actor, path)) || 0;
      await actor.update({ [path]: before + Number(args.amount) });
      return { ok:true, summary:`+${args.amount} temp Integrity` };
    }
    case "extra-damage":
    case "queued-reroll":
    case "spend-and-survive": {
      // These need integration into the live roll/damage flow — for v1 we
      // surface as a chat prompt so the GM can apply manually. Engine will
      // route them properly in Phase 2.
      const desc = kind === "extra-damage"   ? `Extra damage: ${args.dieFormula} ${args.type ?? ""}`
                 : kind === "queued-reroll"  ? `Reroll queued: ${args.mode} on next ${args.context}`
                 : kind === "spend-and-survive" ? `Spend ${args.amount} ${args.resource} → survive at 1`
                 : kind;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p style="font-size:0.78rem"><b>${source}</b> triggered: ${desc} <span style="opacity:0.6">(GM resolves)</span></p>`,
        whisper: [game.user.id]
      });
      return { ok:true, summary:`${kind} → GM prompted` };
    }
    case "chat-prompt": {
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p style="font-size:0.78rem"><b>${source}</b> triggered. ${args.body ?? "GM resolves."}</p>`,
        whisper: [game.user.id]
      });
      return { ok:true, summary:`chat-prompt fired` };
    }
    default:
      return { ok:false, reason:`unknown effect kind ${kind}` };
  }
}

export async function fireTriggers(actor, event, payload = {}) {
  const matches = collectTriggers(actor, event);
  const fired   = [];
  const skipped = [];
  for (const m of matches) {
    if (!_matchPredicate(m.trigger, payload)) {
      skipped.push({ source: m.sourceItemName, reason: "predicate failed" });
      continue;
    }
    const limitCheck = await _checkAndConsumeLimit(actor, m.sourceItemId, m.triggerIndex, m.trigger.limit);
    if (!limitCheck.allowed) {
      skipped.push({ source: m.sourceItemName, reason: limitCheck.reason });
      continue;
    }
    const result = await _dispatchEffect(actor, m.trigger.effect, m.sourceItemName, payload);
    if (result.ok) fired.push({ source: m.sourceItemName, summary: result.summary });
    else skipped.push({ source: m.sourceItemName, reason: result.reason });
  }
  // Centralized chat surface — post a single purple "Triggers fired" card per
  // event when anything fires. The chat-prompt and dispatcher-internal posts
  // (extra-damage / queued-reroll / spend-and-survive) remain separate so the
  // GM gets distinct prompts; the summary card just reports what auto-applied.
  if (fired.length) {
    const eventLabel = String(event ?? "").replace(/^on-/, "").replace(/-/g, " ");
    const lines = fired.map(f =>
      `<div style="font-size:0.8rem;color:#1a1a1a;margin:0.15rem 0">• <b>${f.source}</b> <span style="color:#444">— ${f.summary}</span></div>`
    ).join("");
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="border-left:4px solid #6b3fa0;padding:0.5rem 0.7rem;background:#ede0f5;border-radius:3px;color:#1a1a1a">
                  <div style="font-size:0.85rem;color:#6b3fa0;font-weight:700;margin-bottom:0.25rem;letter-spacing:0.02em">⚡ Triggered: ${eventLabel}</div>
                  ${lines}
                </div>`
    });
  }
  return { fired, skipped, event };
}

// Reset all soma-break-windowed trigger usage on an actor (called from somaBreak).
export async function resetSomaBreakTriggerLimits(actor) {
  const usage = actor.getFlag("fourththing", _TRIGGER_USAGE_FLAG) ?? {};
  const cleaned = {};
  for (const [key, val] of Object.entries(usage)) {
    if (val?.windowKey === "rest:soma-break") continue;
    cleaned[key] = val;
  }
  await actor.setFlag("fourththing", _TRIGGER_USAGE_FLAG, cleaned);
}

// ─── Bad Eden Technique picker ─────────────────────────────────────────────────
// Pool: 59 feats in the "Bad Eden Feats" folder of bbttcc-master-content.items.
const BBTTCC_FEATS_PACK   = "bbttcc-master-content.items";
const BBTTCC_FEATS_FOLDER = "QbGNBV70xh9pF0eh";

async function getBBTTCCTechniqueOptions(actor) {
  const pack = game.packs.get(BBTTCC_FEATS_PACK);
  if (!pack) return { options: [], error: `Pack ${BBTTCC_FEATS_PACK} not found` };
  // Full docs, not just the index — the picker shows each technique's synopsis
  // (playtest 2026-06-06: players couldn't see what their choices do).
  const docs = (await pack.getDocuments({ folder: BBTTCC_FEATS_FOLDER, type: "feat" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const ownedNames = new Set((actor.items ?? []).map(i => i.name));
  const options = docs.map(d => ({
    uuid: d.uuid,
    name: d.name,
    description: String(d.system?.description?.value ?? "")
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    owned: ownedNames.has(d.name),
  }));
  return { options, error: null };
}

// ─── Apply Path Features ─────────────────────────────────────────────────────
// Imports class-core and chosen-subclass feature items from the compendium onto
// the actor. Skips anything already on the actor (dedup by name). Safe to run
// repeatedly — useful at tier-ups or to backfill pre-wizard characters.

async function _resolveCompendiumSource(item) {
  return item?._stats?.compendiumSource
      ?? item?.flags?.core?.sourceId
      ?? null;
}

async function _findClassFeaturesFolder(pack, classRootFolderId) {
  const all = pack.folders?.contents ?? [...(pack.folders ?? [])];
  return all.find(f => f.name === "Class Features" && (f.folder?.id ?? f.folder) === classRootFolderId) ?? null;
}

// ─── Canonical unlock-level derivation ────────────────────────────────────────
// Single source of truth for "at what level does this feature unlock?" Every
// caller (the runtime path-features filter + the stamp-prerequisite-levels
// migration macro + future auto-grant hooks) routes through this function so
// new content authoring conventions only need to be taught here.
//
// Returns { tier, level } — either may be null when the corresponding signal
// wasn't found. Preference order:
//   1. system.prerequisites.level (canonical, set by the migration)
//   2. Structured fields (identifier, requirements) parsed for tier/level
//   3. Item name parsed for tier/level
//   4. Rich-text description parsed for "(Nth Level)" / <h3>Level N: …</h3>

const _TIER_PATTERNS = [
  /\bTier\s*0*([1-4])\b/i,
  /_tier\s*0*([1-4])\b/i,
  /\bInitiation\s*0*([1-4])\b/i
];
const _LEVEL_PATTERNS = [
  /\bL\s*0*(\d{1,2})\b(?!\w)/,
  /_l\s*0*(\d{1,2})(?:_|\b)/i,
  /\bLevel\s*0*(\d{1,2})\b/i
];
const _DESC_LEVEL_PATTERNS = [
  /\(\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*level\s*\)/i,
  /<h[1-6][^>]*>\s*Level\s+(\d{1,2})\s*[:.\-]/i,
  /\bAt\s+(\d{1,2})(?:st|nd|rd|th)?\s+level\b/i,
  /\bLevel\s+(\d{1,2})\s*Feature\b/i,
  /\bLevel\s+(\d{1,2})\s*[—–-]\s*[A-Z]/i  // "Level 3 — Escalation" header (Aurablade doctrine cadence)
];

function _scanMax(sources, patterns) {
  let max = null;
  for (const src of sources) {
    const s = String(src ?? "");
    if (!s) continue;
    for (const re of patterns) {
      const m = s.match(re);
      if (!m) continue;
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v) && (max === null || v > max)) max = v;
    }
  }
  return max;
}

export function deriveItemUnlockLevel(item) {
  const sys = item?.system ?? {};
  const stampedLevel = Number(sys.prerequisites?.level);
  const structured = [item?.name, sys.identifier, sys.requirements];
  const desc = sys.description?.value ?? "";

  const tier = _scanMax([...structured, desc], _TIER_PATTERNS);
  // requirements often carries "(6th level)" prose alongside description; the
  // reducer's Math.max means a higher prose-derived gate self-heals a stale
  // stamped level of 1 (Pactkeeper / Cosmic Linguist Initiation playtest bug).
  const level = [
    Number.isFinite(stampedLevel) && stampedLevel > 0 ? stampedLevel : null,
    _scanMax(structured, _LEVEL_PATTERNS),
    _scanMax([desc, sys.requirements], _DESC_LEVEL_PATTERNS)
  ].reduce((a, b) => (b === null ? a : (a === null ? b : Math.max(a, b))), null);

  return { tier, level };
}

export async function applyPathFeatures(actor) {
  if (!actor) return { imported: [], skipped: [], error: "No actor" };

  const classItem = actor.items.find(i => i.type === "class");
  if (!classItem) return { imported: [], skipped: [], error: "No class on actor — run the wizard or drag a class first" };

  const classSrcUuid = await _resolveCompendiumSource(classItem)
    ?? actor.getFlag?.("bbttcc-character-options", "nativeLinks")?.classUuid
    ?? actor.getFlag?.("bbttcc-character-options", "classUuid")
    ?? actor.getFlag?.("bbttcc-auto-link", "nativeLinks")?.classUuid;
  if (!classSrcUuid) return { imported: [], skipped: [], error: "Class item has no compendium source" };

  const classDoc = await fromUuid(classSrcUuid);
  if (!classDoc?.pack) return { imported: [], skipped: [], error: `Cannot resolve class from ${classSrcUuid}` };

  const pack = game.packs.get(classDoc.pack);
  if (!pack) return { imported: [], skipped: [], error: `Pack ${classDoc.pack} not found` };

  const classRootFolderId = classDoc.folder?.id ?? classDoc.folder ?? null;

  const targetFolderIds = new Set();
  const classFeatFolder = classRootFolderId ? await _findClassFeaturesFolder(pack, classRootFolderId) : null;
  if (classFeatFolder) targetFolderIds.add(classFeatFolder.id);

  let subclassFolderName = null;
  const subclassItem = actor.items.find(i => i.type === "subclass");
  if (subclassItem) {
    const sSrc = await _resolveCompendiumSource(subclassItem)
      ?? actor.getFlag?.("bbttcc-character-options", "nativeLinks")?.subclassUuid
      ?? actor.getFlag?.("bbttcc-character-options", "subclassUuid")
      ?? actor.getFlag?.("bbttcc-auto-link", "nativeLinks")?.subclassUuid;
    if (sSrc) {
      const sDoc = await fromUuid(sSrc);
      const sFolder = sDoc?.folder?.id ?? sDoc?.folder;
      if (sFolder) {
        targetFolderIds.add(sFolder);
        subclassFolderName = sDoc?.folder?.name ?? null;
      }
    }
  }

  if (!targetFolderIds.size) {
    return { imported: [], skipped: [], error: `No feature folders found for ${classDoc.name}${subclassItem ? " / " + subclassItem.name : ""} — this class may not have discrete feature items yet (narrative-only stub)` };
  }

  const index = await pack.getIndex({
    fields: ["folder", "type", "name", "system.identifier", "system.requirements", "system.prerequisites.level"]
  });
  const candidatesAll = index.filter(e => e.type === "feat" && targetFolderIds.has(e.folder));

  const actorLevel = (actor.system?.system ?? actor.system)?.details?.level ?? 1;
  const currentTier = tierForLevel(actorLevel);

  // Load every candidate's full doc once so we can also scan the rich-text
  // description for level cues (Pactkeeper et al. encode "(4th Level)" in the
  // body rather than in any structured field). One Promise.all up front is
  // cheaper than re-fetching the survivors after filtering.
  const docsAll = await Promise.all(candidatesAll.map(e => pack.getDocument(e._id)));

  const survivors = [];
  for (let i = 0; i < candidatesAll.length; i++) {
    const e = candidatesAll[i];
    const d = docsAll[i];
    if (!d) continue;
    const { tier: tierGate, level: lvlGate } = deriveItemUnlockLevel(d);
    if (tierGate !== null && tierGate > currentTier) continue;
    if (lvlGate !== null && lvlGate > actorLevel) continue;
    survivors.push({ entry: e, doc: d });
  }

  const ownedNames = new Set((actor.items ?? []).map(i => i.name));
  const toImport = survivors.filter(s => !ownedNames.has(s.entry.name));
  const skipped  = survivors.filter(s =>  ownedNames.has(s.entry.name)).map(s => s.entry.name);

  if (!toImport.length) return { imported: [], skipped, error: null };

  const data = toImport.map(({ doc }) => {
    const obj = doc.toObject();
    delete obj._id;
    return obj;
  });
  const created = await actor.createEmbeddedDocuments("Item", data);
  return { imported: created.map(c => c.name), skipped, error: null, subclassFolderName };
}

// ─── Level up ─────────────────────────────────────────────────────────────────

// Signature manifestations (system.manifestation.isSignature === true) auto-level
// their tier in tandem with the steward. Called on a tier-up: bump any signature
// manifestation whose tier trails the steward's new tier up to match. Never
// lowers a manually higher-tier item, never touches authored damage/effects —
// tier alone raises DC / Clarity cost / reach / misfire scaling. Returns the
// names of bumped items so the level-up chat note can report them.
export async function levelSignatureManifestations(actor, newTier) {
  const target = Math.max(1, Math.min(4, Number(newTier) || 1));
  const updates = [];
  const bumped  = [];
  for (const item of actor?.items ?? []) {
    const mf = item.system?.manifestation;
    if (!mf || mf.isSignature !== true) continue;
    const cur = Math.max(1, Math.min(4, Number(mf.tier) || 1));
    if (cur >= target) continue;
    updates.push({ _id: item.id, "system.manifestation.tier": target });
    bumped.push(item.name);
  }
  if (updates.length) {
    try { await actor.updateEmbeddedDocuments("Item", updates); }
    catch (e) { console.warn("ft-progression: signature manifestation tier-up failed", e); }
  }
  return bumped;
}

export async function levelUp(actor) {
  const rawSys  = actor.system?.system ?? actor.system;
  const current = rawSys?.details?.level ?? 1;
  const newLevel = current + 1;
  const newTier  = tierForLevel(newLevel);
  const oldTier  = tierForLevel(current);
  const tierUp   = newTier > oldTier;

  const gainSkillPts = SKILL_POINT_LEVELS.has(newLevel) ? 2 : 0;

  // Bad Eden Technique: granted at aptitude-point levels (3/6/9/12/15/18/20)
  let techOpts = null;
  if (gainSkillPts) {
    const { options, error } = await getBBTTCCTechniqueOptions(actor);
    if (error) console.warn("ft-progression levelUp: technique picker skipped —", error);
    else techOpts = options;
  }

  // Build dialog content
  const tierNote = tierUp
    ? `<div style="padding:0.4rem 0.5rem;background:rgba(232,200,74,0.12);border:1px solid rgba(232,200,74,0.3);border-radius:4px;margin-bottom:0.5rem;color:#e8c84a;font-size:0.82rem">
        ✦ Tier Up! You are now <b>Tier ${newTier}</b>. New path principles may be available — click <b>⊕ Apply Path Features</b> on the Steward tab to import any you're missing.
       </div>` : "";

  const skillNote = gainSkillPts
    ? `<p style="color:#6fcf97;font-size:0.78rem;margin:0.3rem 0">You gain <b>${gainSkillPts} aptitude points</b> to spend on the Aptitudes tab.</p>` : "";

  // Radio list with per-technique synopsis + 📖 content-link (playtest
  // 2026-06-06 — replaces the bare <select> nobody could evaluate).
  const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const techRows = techOpts ? techOpts.map(t => {
    const synopsis = t.description
      ? (t.description.length > 170 ? t.description.slice(0, 167) + "…" : t.description)
      : "";
    return `
      <label style="display:flex;gap:0.45rem;align-items:flex-start;padding:0.3rem 0.4rem;border-radius:4px;border:1px solid rgba(255,255,255,0.06);margin:0.15rem 0;${t.owned ? "opacity:0.45;" : "cursor:pointer;"}">
        <input type="radio" name="techniqueChoice" value="${t.uuid}"${t.owned ? " disabled" : ""} style="margin-top:0.2rem;flex:none"/>
        <span style="flex:1;min-width:0">
          <span style="display:flex;justify-content:space-between;gap:0.4rem;align-items:baseline">
            <b>${_esc(t.name)}${t.owned ? " (owned)" : ""}</b>
            <a class="content-link" draggable="true" data-uuid="${t.uuid}" data-link data-tooltip="Open ${_esc(t.name)}" style="flex:none;font-size:0.72rem"><i class="fas fa-book-open"></i></a>
          </span>
          ${synopsis ? `<span style="display:block;font-size:0.72rem;opacity:0.7;line-height:1.35" data-tooltip="${_esc(t.description)}">${_esc(synopsis)}</span>` : ""}
        </span>
      </label>`;
  }).join("") : "";
  const techField = techOpts ? `
        <div class="ft-cast-field" style="margin-top:0.5rem">
          <label>✦ Pick a <b>Bad Eden Technique</b> (in addition to the stat bump):</label>
          <div style="max-height:250px;overflow-y:auto;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:0.25rem 0.35rem;background:rgba(0,0,0,0.15)">
            <label style="display:flex;gap:0.45rem;align-items:center;padding:0.25rem 0.4rem;cursor:pointer"><input type="radio" name="techniqueChoice" value="" checked/> <i>— skip —</i></label>
            ${techRows}
          </div>
          <p style="font-size:0.72rem;opacity:0.6;margin:0.2rem 0 0">${techOpts.length} available · owned greyed · 📖 opens the full technique · hover a synopsis for the full text</p>
        </div>` : "";

  const attrNames = ["Violence", "Intrigue", "Presence", "Body", "Mind", "Soul"];
  const attrKeys  = ["violence", "intrigue", "presence", "body", "mind", "soul"];
  const attrOpts  = attrKeys.map((k, i) => {
    const cur = rawSys?.attributes?.[k]?.value ?? 2;
    return `<option value="${k}">${attrNames[i]} (currently ${cur}${cur >= 10 ? " — at cap" : ""})</option>`;
  }).join("");

  return new Promise((resolve) => {
    new Dialog({
      title: `Advance Initiation — Depth ${newLevel}`,
      content: `<div class="ft-cast-dialog">
        ${tierNote}
        <div class="ft-preview-stats" style="margin-bottom:0.6rem">
          <span class="ft-prev-stat"><span class="ft-prev-label">Initiation</span>
            <span class="ft-prev-val ft-clarity">${current} → ${newLevel}</span></span>
          <span class="ft-prev-stat"><span class="ft-prev-label">Tier</span>
            <span class="ft-prev-val" style="color:${tierUp ? '#e8c84a' : '#c0d4ff'}">
              ${tierUp ? `${oldTier} → ${newTier}` : newTier}</span></span>
        </div>
        <p style="font-size:0.8rem;opacity:0.7;margin:0 0 0.6rem">
          Gain <b>+1 attribute point</b> — allocate it to any faculty below.
        </p>
        <div class="ft-cast-field">
          <label>Increase which faculty?</label>
          <select name="attrChoice">${attrOpts}</select>
        </div>
        ${skillNote}
        ${techField}
      </div>`,
      buttons: {
        levelUp: {
          icon: "<i class='fas fa-arrow-up'></i>",
          label: `Advance to ${newLevel}`,
          callback: async (html) => {
            const attrKey = html.find("[name='attrChoice']").val();
            const cur     = rawSys?.attributes?.[attrKey]?.value ?? 2;
            const newVal  = Math.min(10, cur + 1);

            // Snapshot Integrity max BEFORE the level/attr update so we can
            // grant the delta as a level-up boon (preserves existing damage).
            const oldIntegrityMax = Number(actor.system?.system?.derived?.integrity?.max
                                       ?? actor.system?.derived?.integrity?.max) || 0;
            const oldIntegrityVal = Number(actor.system?.system?.derived?.integrity?.value
                                       ?? actor.system?.derived?.integrity?.value) || 0;

            const updates = {
              "system.details.level":      newLevel,
              "system.details.tier":       newTier,
              [`system.attributes.${attrKey}.value`]: newVal,
            };

            if (gainSkillPts) {
              const curSP = rawSys?.details?.skillPoints ?? 0;
              updates["system.details.skillPoints"] = curSP + gainSkillPts;
            }

            await actor.update(updates);

            // Apply Integrity top-up: new max - old max, added to current
            // value (clamped to new max). Damage carries forward; ramp shows up.
            const newIntegrityMax = Number(actor.system?.system?.derived?.integrity?.max
                                       ?? actor.system?.derived?.integrity?.max) || 0;
            const integrityGain = Math.max(0, newIntegrityMax - oldIntegrityMax);
            if (integrityGain > 0) {
              const topped = Math.min(newIntegrityMax, oldIntegrityVal + integrityGain);
              await actor.update({ "system.derived.integrity.value": topped });
            }

            // Grant chosen Bad Eden Technique (aptitude-point levels only)
            let grantedTechName = null;
            // Radio list (2026-06-06): read the CHECKED radio — bare .val()
            // on a radio group returns the first input, not the selection.
            const techUuid = html.find("[name='techniqueChoice']:checked").val();
            if (techUuid) {
              try {
                const src = await fromUuid(techUuid);
                if (src) {
                  const data = src.toObject();
                  delete data._id;
                  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
                  grantedTechName = created?.name ?? src.name;
                }
              } catch (e) {
                console.error("ft-progression: failed to grant technique", techUuid, e);
                ui.notifications.warn(`${actor.name}: technique grant failed — see console`);
              }
            }

            // Auto-grant any newly-unlocked path/doctrine principles + aptitude
            // ranks. Idempotent: applyPathFeatures dedupes by name and
            // applySkillGrantsFromFeatures dedupes by skill key.
            let autoGranted = { imported: [], grantedSkills: [] };
            try {
              const pf = await applyPathFeatures(actor);
              if (pf?.imported?.length) autoGranted.imported = pf.imported;
              const sk = await applySkillGrantsFromFeatures(actor);
              if (Array.isArray(sk) && sk.length) autoGranted.grantedSkills = sk;
              const promoted = await promoteStampedAptitudeAEs(actor);
              if (Array.isArray(promoted) && promoted.length) {
                for (const p of promoted) {
                  if (!autoGranted.grantedSkills.includes(p.skill)) autoGranted.grantedSkills.push(p.skill);
                }
              }
            } catch (e) {
              console.error("ft-progression: post-levelUp auto-grant failed", e);
            }

            // Signature manifestations climb in tier with their steward (phase 1
            // — tier only). Only on an actual tier-up, not on every level.
            let signatureLeveled = [];
            if (tierUp) {
              try { signatureLeveled = await levelSignatureManifestations(actor, newTier); }
              catch (e) { console.error("ft-progression: signature manifestation tier-up failed", e); }
            }

            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div class="fourththing-roll">
                <div class="ft-roll-header">
                  <span class="ft-roll-name">✦ Initiation Advanced: ${actor.name}</span>
                  <span class="ft-defense-pill">Depth ${newLevel}${tierUp ? ` · Tier ${newTier}` : ""}</span>
                </div>
                <p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.8">
                  ${attrKey.charAt(0).toUpperCase() + attrKey.slice(1)} increased to ${newVal}.
                  ${integrityGain > 0 ? `<br/>✦ <b>+${integrityGain} Integrity max</b> (${oldIntegrityMax} → ${newIntegrityMax}).` : ""}
                  ${gainSkillPts ? `<br/>+${gainSkillPts} aptitude points gained.` : ""}
                  ${grantedTechName ? `<br/>Technique gained: <b>${grantedTechName}</b>.` : ""}
                  ${autoGranted.imported.length ? `<br/>✦ New principles: <b>${autoGranted.imported.join(", ")}</b>.` : ""}
                  ${autoGranted.grantedSkills.length ? `<br/>✦ Aptitude rank 1: <b>${autoGranted.grantedSkills.join(", ")}</b>.` : ""}
                  ${signatureLeveled.length ? `<br/>✦ Signature manifestations advanced to <b>Tier ${newTier}</b>: ${signatureLeveled.join(", ")}.` : ""}
                </p>
              </div>`
            });

            resolve({ attrKey, newVal, newLevel, newTier, tierUp, gainSkillPts, grantedTechName, autoGranted, signatureLeveled });
          }
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "levelUp"
    }).render(true);
  });
}

// ─── Skill rank up ────────────────────────────────────────────────────────────

export async function openSpendSkillPoints(actor) {
  const rawSys   = actor.system?.system ?? actor.system;
  const points   = rawSys?.details?.skillPoints ?? 0;
  // ⚠ Read SOURCE ranks (toObject), never derived — same fix as the pip
  // handler _onFtSetSkillRank. Derived rank = source + live AEs, so a skill
  // with an ancestry/heritage "+1 <skill>" AE showed its CURRENT one rank
  // high, and clicking +1 wrote (derived+1) into SOURCE — folding the AE
  // bonus into source while the AE stayed live on top (the "extra point when
  // I spend" bug, Rank Test / Furrykin +1 Athletics, 2026-07-13). The AE keeps
  // displaying in the AE column; source must not absorb it.
  const srcRoot  = actor.toObject().system;
  const skills   = srcRoot?.system?.skills ?? srcRoot?.skills ?? {};

  if (points <= 0) {
    return ui.notifications.warn(`${actor.name}: No aptitude points available.`);
  }

  const skillList = Object.entries(skills).map(([key, skill]) => {
    const rank = skill.value ?? 0;
    const rd   = SKILL_RANK_DATA[rank] ?? SKILL_RANK_DATA[0];
    const next = SKILL_RANK_DATA[rank + 1];
    const canUp = rank < 5;
    return { key, label: skill.label, attribute: skill.attribute, rank, rankLabel: rd.label,
             color: rd.color, canUp, nextLabel: next?.label ?? "Max" };
  });

  const rows = skillList.map(s => `
    <tr data-skill="${s.key}" class="ft-skill-point-row ${s.canUp ? '' : 'maxed'}">
      <td style="padding:0.25rem 0.4rem">
        <span style="font-size:0.8rem;color:#d8e4ff">${s.label}</span>
        <span style="font-size:0.65rem;opacity:0.45;margin-left:0.3rem">(${s.attribute})</span>
      </td>
      <td style="padding:0.25rem 0.4rem;text-align:center">
        <span style="color:${s.color};font-size:0.75rem;font-weight:600">${s.rankLabel}</span>
        <span style="opacity:0.4;font-size:0.7rem"> (${s.rank})</span>
      </td>
      <td style="padding:0.25rem 0.4rem;text-align:right">
        ${s.canUp ? `<button type="button" class="ft-res-btn ft-skill-up-btn" data-skill="${s.key}" style="font-size:0.7rem">
          +1 → ${s.nextLabel}
        </button>` : '<span style="opacity:0.3;font-size:0.7rem">Max</span>'}
      </td>
    </tr>`).join("");

  // Pending rank-ups captured by the +1 button handlers and read by Apply.
  // Closure state instead of DOM-scraping: survives the v11→v14 render-hook
  // + jQuery/HTMLElement divergence that previously left this dialog inert
  // on Foundry v14 (legacy Dialog now renders as DialogV2).
  const pending   = {};                          // skillKey -> newRank
  const baseRanks = {};                           // skillKey -> stored rank
  for (const [k, v] of Object.entries(skills)) baseRanks[k] = v.value ?? 0;

  const dialog = new Dialog({
    title: `Spend Aptitude Points (${points} available)`,
    content: `<div class="ft-cast-dialog">
      <p style="font-size:0.78rem;opacity:0.65;margin:0 0 0.5rem">
        Each rank costs 1 point. Rank milestones unlock mechanics:
        Rank 2 = reroll low · Rank 3 = floor 4 · Rank 4 = 3d10 drop · Rank 5 = legendary
      </p>
      <div id="ft-sp-remaining" style="font-size:0.82rem;font-weight:600;color:#e8c84a;margin-bottom:0.5rem">
        Points remaining: <span id="ft-sp-val">${points}</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;font-size:0.65rem;opacity:0.5;padding:0.2rem 0.4rem">Aptitude</th>
          <th style="font-size:0.65rem;opacity:0.5;padding:0.2rem 0.4rem">Current</th>
          <th style="font-size:0.65rem;opacity:0.5;padding:0.2rem 0.4rem;text-align:right">Upgrade</th>
        </tr></thead>
        <tbody id="ft-skill-table">${rows}</tbody>
      </table>
    </div>`,
    buttons: {
      apply: { label: "Apply", callback: async () => {
        // Read pending upgrades from closure state (not the DOM) so Apply
        // works regardless of which render hook fired or whether the dialog
        // handed us jQuery or a raw HTMLElement.
        const updates = {};
        for (const [sk, newRank] of Object.entries(pending)) {
          updates[`system.skills.${sk}.value`] = newRank;
        }
        const spSpent = Object.keys(updates).length;
        if (spSpent > 0) {
          updates["system.details.skillPoints"] = Math.max(0, points - spSpent);
          await actor.update(updates);
          ui.notifications.info(`${actor.name}: ${spSpent} aptitude rank${spSpent > 1 ? 's' : ''} increased.`);
        }
      }},
      close: { label: "Cancel" }
    },
    default: "apply"
  });

  dialog.render(true);

  // Wire up the +1 buttons after render. Foundry v14 renders legacy Dialog
  // through DialogV2, which fires `renderDialogV2` with a raw HTMLElement —
  // NOT `renderDialog` with jQuery. Hook BOTH and normalize the payload to a
  // plain Element so the buttons work on v11–v14. (Same trap as the campaign
  // HexChrome dialog hooks.) Only the first matching render wires it.
  let wired = false;
  const wire = (d, htmlOrEl) => {
    if (d !== dialog || wired) return;
    const root = htmlOrEl?.jquery ? htmlOrEl[0] : (htmlOrEl?.[0] ?? htmlOrEl);
    if (!root?.querySelectorAll) return;
    wired = true;

    let remaining = points;
    const remEl = root.querySelector("#ft-sp-val");

    root.querySelectorAll(".ft-skill-up-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sk = btn.dataset.skill;
        if (btn.dataset.upgraded === "1" || remaining <= 0) return;

        const newRank = (baseRanks[sk] ?? 0) + 1;
        pending[sk] = newRank;                         // captured for Apply
        const rd = SKILL_RANK_DATA[newRank] ?? SKILL_RANK_DATA[5];

        btn.dataset.upgraded = "1";
        btn.dataset.newRank  = String(newRank);
        btn.textContent = newRank >= 5 ? "✓ Legendary" : `✓ → ${rd.label}`;
        btn.style.background  = "rgba(39,174,96,0.2)";
        btn.style.borderColor = "rgba(39,174,96,0.5)";
        btn.style.color       = "#6fcf97";
        if (newRank >= 5) btn.disabled = true;

        const rowSpan = root.querySelector(`tr[data-skill="${sk}"] td:nth-child(2) span:first-child`);
        if (rowSpan) { rowSpan.textContent = rd.label; rowSpan.style.color = rd.color; }

        remaining--;
        if (remEl) remEl.textContent = String(remaining);
        if (remaining <= 0) {
          root.querySelectorAll(".ft-skill-up-btn:not([data-upgraded='1'])")
              .forEach((b) => { b.disabled = true; });
        }
      });
    });
  };
  Hooks.once("renderDialog", wire);
  Hooks.once("renderDialogV2", wire);
}

// ─── Skill proficiency auto-grant from feature text ──────────────────────────

const SKILL_PROFICIENCY_MAP = {
  // 5E skill → FT skill key
  "athletics":     "athletics",
  "acrobatics":    "athletics",
  "stealth":       "stealth",
  "perception":    "perception",
  "investigation": "investigation",
  "insight":       "insight",
  "intimidation":  "intimidation",
  "persuasion":    "diplomacy",
  "diplomacy":     "diplomacy",
  "religion":      "faith",
  "medicine":      "faith",
  "arcana":        "occult",
  "history":       "lore",
  "nature":        "lore",
  "performance":   "performance",
  "deception":     "stealth",
  "sleight of hand": "tinkering",
  "survival":      "athletics",
  "empathy":       "empathy",
  "hacking":       "hacking",
  "tinkering":     "tinkering",
  "lore":          "lore",
  "occult":        "occult",
  "ritual":        "ritual",
  "meditation":    "meditation",
  "streetwise":    "streetwise",
  "firearms":      "firearms",
  "brawl":         "brawl",
  "melee":         "melee",
  "warding":       "warding",
  "weave":         "weave",
  "plating":       "plating",
  "faith":         "faith",
  // Tool/kit aliases (D&D vocab that the scrub macro hasn't rewritten yet).
  // The strip below removes "'s tools" / "'s kit" / "'s supplies" suffixes
  // and falls through to these singular-noun keys.
  "thieves":       "tinkering",
  "tinker":        "tinkering",
  "smith":         "plating",
  "mason":         "plating",
  "leatherworker": "plating",
  "weaver":        "weave",
  "carpenter":     "plating",
  "jeweler":       "tinkering",
  "cartographer":  "lore",
  "navigator":     "lore",
  "herbalism":     "faith",
  "alchemist":     "occult",
  "calligrapher":  "lore",
  "disguise":      "stealth",
  "forgery":       "stealth",
  "poisoner":      "stealth",
};

// Parse feature description HTML and extract skill proficiencies
export function extractSkillGrantsFromFeature(featureDesc) {
  if (!featureDesc) return [];
  const text = featureDesc.replace(/<[^>]+>/g, " ").toLowerCase();
  const grants = [];

  // Choice-grant guard: skill grants phrased as a player CHOICE ("+1 skill rank
  // in two of {Diplomacy, Insight, …}", "choose one of the following", "either
  // X or Y") are resolved by a dedicated picker (e.g. the Pactkeeper L1 "Bargain"
  // button), NOT a flat auto-grant of every listed skill. Without this guard the
  // wizard granted ALL listed skills (and greyed them in the aptitude picker),
  // then the picker double-granted on top. Detect choice phrasing in the captured
  // skill list and skip it — the picker is the single source of truth.
  const CHOICE_GRANT_RE = /\b(?:one|two|three|four|five|\d+)\s+of\b|\bany\b|\beither\b|\bchoos\w*\b|\bof the following\b|[{}]/;

  // Match patterns like "proficiency in/with X and Y" or "gain proficiency in/with X".
  // "with" covers D&D tool/kit phrasing ("proficient with Tinker's Tools") that
  // the scrub macro may not have rewritten yet.
  const patterns = [
    /profici(?:ency|ent) (?:in|with) ([^.<]+)/g,
    /gain(?:s)? (?:a )?(?:skill rank|rank) in ([^.<]+)/g,
    /trained (?:in|with) ([^.<]+)/g,
    /skill rank in ([^.<]+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1].trim();
      // Skip player-choice grants — resolved by a dedicated picker, not auto-granted here.
      if (CHOICE_GRANT_RE.test(raw)) continue;
      // Split on "&", "and", ","
      const parts = raw.split(/[&,]|\band\b/).map(s => s.trim());
      for (const part of parts) {
        // Strip "'s tools / 's kit / 's supplies / kit / tools / supplies"
        // suffixes so "tinker's tools" → "tinker" and falls through the
        // SKILL_PROFICIENCY_MAP tool aliases below.
        const normalized = part
          .replace(/['’]s\b/i, "")
          .replace(/\b(tools?|kit|supplies|set|instrument)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();
        for (const [keyword, ftSkill] of Object.entries(SKILL_PROFICIENCY_MAP)) {
          if (normalized.includes(keyword)) {
            if (!grants.includes(ftSkill)) grants.push(ftSkill);
          }
        }
      }
    }
  }
  return [...new Set(grants)];
}

// Apply skill grants from an actor's features — sets rank 1 if currently 0
export async function applySkillGrantsFromFeatures(actor) {
  // Read SOURCE ranks (toObject), never derived: derived includes live AEs,
  // so a skill with source 0 + a +1 AE read as 1 and silently skipped its
  // grant (and every writer below must compare against what update() writes).
  const _srcRoot = actor.toObject().system;
  const skills  = _srcRoot?.system?.skills ?? _srcRoot?.skills ?? {};
  const updates = {};
  const granted = [];

  for (const item of Array.from(actor.items ?? [])) {
    const desc = item.system?.description?.value ?? "";
    const skillGrants = extractSkillGrantsFromFeature(desc);
    for (const sk of skillGrants) {
      if (skills[sk] !== undefined && (skills[sk]?.value ?? 0) === 0) {
        updates[`system.skills.${sk}.value`] = 1;
        granted.push(sk);
      }
    }
  }

  // Pactkeeper — Initiation 1 "The Bargain". Canon authored this grant as a
  // 2-of-4 player choice, but per design decision 2026-05-25 the four L1
  // aptitudes are auto-granted in full (no picker pill). The feature prose
  // ("…+1 skill rank in two of {Diplomacy, Insight, Intimidation, Lore}") trips
  // the choice-grant guard in extractSkillGrantsFromFeature, so the loop above
  // skips it — we grant the full set explicitly here. Idempotent: rank set to 1
  // only when currently 0, identical semantics to the feature-text loop.
  const _isPactkeeper = Array.from(actor.items ?? [])
    .some(it => it.type === "class" && it.system?.identifier === "pactkeeper");
  if (_isPactkeeper) {
    for (const sk of ["diplomacy", "insight", "intimidation", "lore"]) {
      if (skills[sk] !== undefined && (skills[sk]?.value ?? 0) === 0) {
        updates[`system.skills.${sk}.value`] = 1;
        if (!granted.includes(sk)) granted.push(sk);
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }
  // 2026-05-20 — Defensive clamp. Several wizard playtest characters
  // (A3G5 et al.) came out with `skill.value > 5` (one reported at 22).
  // Source of the stacker is still unknown — the writers in this file
  // never write above 5 — but the symptom is real. Sweep here after
  // every grant pass so chargen exit is always ≤5.
  await clampSkillRanksToCap(actor);
  return granted;
}

// Promote stamped class-L1 / heritage aptitude AEs into source skill ranks.
// The 2026-05-04 stamp macro put combat+armor grants on class T1 anchors as
// transfer-AEs (key: system.skills.<x>.value, mode 2/+1). That made the bonus
// invisible to the rank-pip UI (which reads source via toObject) and to the
// armor gate (same source read). This function runs at chargen finalize: it
// walks actor items for any AE bearing flags.fourththing.aptitudeStamp,
// converts the +N into a source rank write (max 5), and disables the AE on
// the embedded item copy so it can't double-apply. Idempotent — safe to
// re-run; converted AEs stay disabled and are skipped on subsequent passes.
export async function promoteStampedAptitudeAEs(actor) {
  // ⚠ ROOT-CAUSE FIX 2026-07-13 (the recurring "1 dot + ancestry bonus → rank
  // maxes at 5" bug). Two invariants this function must hold:
  //   1. Read SOURCE ranks (toObject), never derived — derived includes every
  //      live AE (the stamp being promoted AND unrelated passives), so each
  //      pass compounded: 1 dot + stamp + passive read as 3, wrote 4, …
  //   2. Promote each grant EXACTLY ONCE PER ACTOR, tracked in an actor-flag
  //      ledger keyed by (item name | skill). The old guard was "disable the
  //      AE" — but heritage/ancestry/class swaps DELETE and RE-IMPORT their
  //      granting items with fresh ENABLED stamps, so every swap re-promoted
  //      onto the already-promoted source. The ledger survives item churn.
  //      (Re-promoting after a swap to a DIFFERENT grant with its own name is
  //      allowed — consistent with the bridge's no-revoke-on-swap policy.)
  const _srcRoot = actor.toObject().system;
  const skills  = _srcRoot?.system?.skills ?? _srcRoot?.skills ?? {};
  const ledger  = foundry.utils.deepClone(actor.getFlag("fourththing", "aptitudePromotions") ?? {});
  let ledgerDirty = false;
  const updates = {};
  const promoted = [];
  const aeDisableOps = []; // [{ item, effectId }]
  const _ledgerKey = (itemName, skillKey) =>
    `${String(itemName ?? "").toLowerCase().replace(/\s+/g, " ").trim()}|${skillKey}`;

  for (const item of Array.from(actor.items ?? [])) {
    for (const effect of Array.from(item.effects ?? [])) {
      if (!effect.flags?.fourththing?.aptitudeStamp) continue;
      let touched = false;
      for (const change of effect.changes ?? []) {
        const isAdd = change?.type === "add" || change?.mode === 2;
        if (!isAdd) continue;
        const m = String(change.key ?? "").match(/^system\.skills\.([a-zA-Z0-9_]+)\.value$/);
        if (!m) continue;
        const skillKey = m[1];
        if (skills[skillKey] === undefined) continue;
        const delta = Number(change.value) || 0;
        if (!delta) continue;
        touched = true;                       // this is a promotable stamp change —
        const lk = _ledgerKey(item.name, skillKey);
        if (ledger[lk]) continue;             // already promoted once; just ensure the AE ends disabled
        const currentSource = Number(updates[`system.skills.${skillKey}.value`] ?? skills[skillKey]?.value ?? 0);
        const newSource = Math.max(0, Math.min(5, currentSource + delta));
        if (newSource !== currentSource) {
          updates[`system.skills.${skillKey}.value`] = newSource;
          promoted.push({ skill: skillKey, from: currentSource, to: newSource, source: item.name });
        }
        ledger[lk] = { delta, item: item.name, at: Date.now() };
        ledgerDirty = true;
      }
      // Disable EVERY promotable stamp that is still enabled — including ones
      // skipped via the ledger (a re-imported stamp must not stay live on top
      // of its promoted rank).
      if (touched && !effect.disabled) aeDisableOps.push({ item, effectId: effect.id });
    }
  }

  if (Object.keys(updates).length > 0 || ledgerDirty) {
    await actor.update({ ...updates, "flags.fourththing.aptitudePromotions": ledger });
  }
  for (const op of aeDisableOps) {
    try {
      await op.item.updateEmbeddedDocuments("ActiveEffect", [{ _id: op.effectId, disabled: true }]);
    } catch (e) {
      console.warn(`[fourththing] promoteStampedAptitudeAEs: failed to disable stamp AE on "${op.item?.name}" — the ledger will prevent re-promotion, but the AE may display doubled until disabled by hand`, e);
    }
  }
  // 2026-05-20 — Defensive clamp. The per-skill min(5, …) inside the loop
  // protects against a single delta over 5, but doesn't catch source ranks
  // that arrived corrupt (e.g. existing `system.skills.X.value:22`). Sweep
  // after the promote pass to guarantee post-state ≤5 everywhere.
  await clampSkillRanksToCap(actor);
  return promoted;
}

// 2026-05-20 — Defensive sweep: clamps every `system.skills.X.value` on the
// actor to `cap` (default 5 = Legendary). Idempotent — no writes when
// nothing's over cap. Returns array of `{ skill, from, to }` for chat
// surfaces / debug. Wired into applySkillGrantsFromFeatures + promoteStamped-
// AptitudeAEs so chargen exit + level-up paths can't leak above 5.
// Standalone repair macro at bbttcc-master-content/tools.
export async function clampSkillRanksToCap(actor, cap = 5) {
  if (!actor) return [];
  // Read SOURCE ranks (toObject), never derived — clamping the derived value
  // (source + live AEs) into source RAISED source whenever AEs pushed the
  // display over cap (e.g. source 4 + two +1 AEs = 6 → wrote source 5).
  const _srcRoot = actor.toObject().system;
  const skills  = _srcRoot?.system?.skills ?? _srcRoot?.skills ?? {};
  const updates = {};
  const clamped = [];
  for (const [key, skill] of Object.entries(skills)) {
    const cur = Number(skill?.value ?? 0);
    if (Number.isFinite(cur) && cur > cap) {
      updates[`system.skills.${key}.value`] = cap;
      clamped.push({ skill: key, from: cur, to: cap });
    }
  }
  if (Object.keys(updates).length > 0) {
    try { await actor.update(updates); }
    catch (e) { console.warn("[fourththing] clampSkillRanksToCap update failed", e); }
  }
  return clamped;
}

// ─── Aurablade conditional AE management ─────────────────────────────────────
// Aura-state and Burn-band changes both reshape which AEs the steward carries.
// The canon (Aurablade Phase 1.5 doc) defines THREE layers:
//   1. Passive — always on while the aura is active
//   2. Engaged — adds on at Burn 2–3
//   3. Overheated — adds on at Burn 4+
// We materialize each as its own AE with `flags.fourththing.auraEffect: true`
// and `flags.fourththing.aurablade.layer: passive|engaged|overheated`. Sync
// runs on every aura change AND every Burn change so the table sees real
// numbers move when the player commits.
//
// Statlines below are canonical *proxies* — the canon mostly speaks in narrative
// ("on hit: prone", "auto-succeed save") which is wired in
// `ft-class-automation.js::openAurabladeAction` and `applyManifestationStates`.
// The AE numbers here are the auto-on numeric grants (Guard, attribute, skill
// bumps) — what shows up as a number on the sheet the moment the aura/band
// triggers, so the steward can actually feel the escalation in roll math.

// Layer 1 — Passive (always-on while aura active)
export const AURA_EFFECTS = {
  fury: [
    { key: "system.attributes.violence.value", mode: 2, value: 1, label: "Fury Aura — Violence +1 (canon: +1 melee weapon damage)" },
  ],
  resolve: [
    // Canon caveat: +1 Guard only while not-moved-this-turn. Modeled here as
    // always-on +1 for simplicity; the "moved-this-turn" gate would need a
    // hook in the movement path to suppress.
    { key: "system.derived.guard.value",   mode: 2, value: 1, label: "Resolve Aura — Guard +1 (canon: while you haven't moved)" },
  ],
  mercy: [
    // Mercy's passive is the permission to deal nonlethal damage; no number.
    // We grant +1 Soul as a thematic proxy for healing/protection potency.
    { key: "system.attributes.soul.value", mode: 2, value: 1, label: "Mercy Aura — Soul +1 (nonlethal permission unlocked)" },
  ],
  dread: [
    // Dread's passive is a zone effect on nearby enemies (3d10kl2 morale).
    // We grant +1 Intimidation as the local representative of that pressure.
    { key: "system.skills.intimidation.value", mode: 2, value: 1, label: "Dread Aura — Intimidation +1 (enemies w/in 5 ft: morale dis.)" },
  ],
};

// Layer 2 — Engaged (Burn 2-3) layered on top of passive.
export const ENGAGED_EFFECTS = {
  fury: [
    { key: "system.attributes.violence.value", mode: 2, value: 1, label: "Fury Engaged — +1 Violence (canon: +tier melee damage on hit)" },
  ],
  resolve: [
    { key: "system.derived.guard.value",   mode: 2, value: 1, label: "Resolve Engaged — +1 Guard (canon: OAs vs you at disadvantage)" },
    { key: "system.derived.resolve.value", mode: 2, value: 1, label: "Resolve Engaged — +1 Resolve (canon: ignore forced movement 10 ft)" },
  ],
  mercy: [
    { key: "system.attributes.soul.value", mode: 2, value: 1, label: "Mercy Engaged — +1 Soul (canon: reduce / redirect ally damage)" },
  ],
  dread: [
    { key: "system.skills.intimidation.value", mode: 2, value: 1, label: "Dread Engaged — +1 Intimidation (canon: Shaken on hit; no reactions)" },
  ],
};

// Layer 3 — Overheated (Burn 4+) layered on top of passive + engaged.
export const OVERHEATED_EFFECTS = {
  fury: [
    { key: "system.attributes.violence.value", mode: 2, value: 1, label: "Fury Overheated — +1 Violence (canon: knockdown + deny reactions)" },
  ],
  resolve: [
    { key: "system.derived.guard.value",   mode: 2, value: 2, label: "Resolve Overheated — +2 Guard (canon: lock position; auto-save)" },
  ],
  mercy: [
    { key: "system.attributes.soul.value", mode: 2, value: 1, label: "Mercy Overheated — +1 Soul (canon: prevent drop; Last-Stand)" },
  ],
  dread: [
    { key: "system.skills.intimidation.value", mode: 2, value: 2, label: "Dread Overheated — +2 Intimidation (canon: 3d10kl2 on ALL saves)" },
  ],
};

const AURA_EFFECT_PREFIX = "ft-aura-";

// Sync ALL aurablade AE layers based on the actor's current aura + burn state.
// Optional `overrideAura` is used by callers that have JUST set a new aura
// state but want to be defensive about read-after-write ordering.
export async function syncAurabladeEffects(actor, overrideAura = null) {
  if (!actor) return;

  const rawSys = actor.system?.system ?? actor.system ?? {};
  const aura = overrideAura ?? rawSys?.resources?.aura?.state ?? "none";
  const burn = Number(rawSys?.resources?.burn?.current ?? 0) || 0;

  // Wipe ALL aura-managed AEs and rebuild from the current state. This keeps
  // the layer cake consistent even after schema edits or hand-tinkering.
  const toDelete = Array.from(actor.effects ?? [])
    .filter(e => e.name?.startsWith(AURA_EFFECT_PREFIX) || e.flags?.fourththing?.auraEffect)
    .map(e => e.id);
  if (toDelete.length) {
    try { await actor.deleteEmbeddedDocuments("ActiveEffect", toDelete); }
    catch (_e) {}
  }

  if (aura === "none" || !AURA_EFFECTS[aura]) return;

  const creates = [];
  const makeAE = (layer, changes, label) => ({
    name: `${AURA_EFFECT_PREFIX}${layer}-${aura}`,
    icon: layer === "overheated"
      ? "icons/magic/fire/explosion-fireball-medium-orange.webp"
      : layer === "engaged"
        ? "icons/magic/fire/flame-burning-fence.webp"
        : "icons/magic/light/beam-rays-orange-small.webp",
    changes,
    disabled: false,
    flags: { fourththing: { auraEffect: true, aura, aurablade: { layer } } },
    duration: {},
  });

  // Layer 1 — always on while aura is active.
  creates.push(makeAE("passive", AURA_EFFECTS[aura], "Passive"));

  // Layer 2 — Engaged (Burn 2-3+).
  if (burn >= 2 && ENGAGED_EFFECTS[aura]) {
    creates.push(makeAE("engaged", ENGAGED_EFFECTS[aura], "Engaged"));
  }

  // Layer 3 — Overheated (Burn 4+).
  if (burn >= 4 && OVERHEATED_EFFECTS[aura]) {
    creates.push(makeAE("overheated", OVERHEATED_EFFECTS[aura], "Overheated"));
  }

  if (creates.length) {
    try { await actor.createEmbeddedDocuments("ActiveEffect", creates); }
    catch (e) { console.warn("[fourththing] aurablade AE sync create failed", e); }
  }
}

// Back-compat shim — existing callers pass (actor, newAura) when changing aura.
// Delegates to the layered sync; the newAura overrides actor state for the
// brief moment between update + AE-rebuild.
export async function syncAuraEffects(actor, newAura) {
  return syncAurabladeEffects(actor, newAura ?? null);
}
