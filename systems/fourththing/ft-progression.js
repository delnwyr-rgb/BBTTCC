// Roll for Initiation — ft-progression.js  v0.2.0
// Foundation progression pass: initiation, aptitude ranks, active effects

import { isMonster } from "./actor-kind.js";
import { MARKS_PER_OP } from "./rfi-pricing.js";   // the one OP↔marks authority

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
  // ⚠ SOURCE reads — same fix as attributeTest (2026-08-15). Derived
  // `actor.system` is already AE-applied, and the getAEBonusFor* sweep below
  // adds the same Active Effects again, so every AE landed twice (and an AE
  // could lift the roll into the next rank mechanic / suppress the rank-0
  // fumble). Base faculty + rank come from source; AEs apply exactly once.
  const srcRoot  = (typeof actor.toObject === "function" ? actor.toObject() : actor)?.system;
  const srcSys   = srcRoot?.system ?? srcRoot ?? {};
  const attrVal  = srcSys?.attributes?.[attribute]?.value ?? 2;
  const rank     = srcSys?.skills?.[skill]?.value ?? 0;
  // Monsters have no aptitude requirements (owner ruling 2026-09-04): a wolf
  // is never "untrained" with its own teeth. A bestiary creature with no stored
  // rank rolls with Trained-tier mechanics (no fumble) and the label "Innate";
  // the numeric bonus stays at the stored value so no stat block gets a buff.
  let innate = false;
  try { innate = !(Number(rank) > 0) && isMonster(actor); } catch (_e) {}
  // Clamp rank for table lookup so legacy over-cap source values (e.g. 9)
  // resolve to the Legendary tier instead of falling back to "Untrained".
  // The roll formula still uses the raw rank as the numeric bonus.
  const rankClamped = Math.max(innate ? 1 : 0, Math.min(5, Number(rank) || 0));
  const rankData = innate
    ? { ...(SKILL_RANK_DATA[1] ?? SKILL_RANK_DATA[0]), label: "Innate", bonus: 0 }
    : (SKILL_RANK_DATA[rankClamped] ?? SKILL_RANK_DATA[0]);

  // Collect AE bonuses for skill AND attribute. Attribute walk added so Fury
  // Aura (system.attributes.violence.value +1) lifts violence-keyed Aptitudes —
  // previously only Engage/Steward rolls picked up attribute AEs.
  const aeSkillBonus = getAEBonusForSkill(actor, skill);
  const { bonus: aeAttrBonus, contribs: aeAttrContribs } = getAEBonusForAttr(actor, attribute);
  const aeBonus    = aeSkillBonus + aeAttrBonus;
  // Radiation Sickness — flat penalty to every aptitude check. Read from the
  // system helper (exposed on game.fourththing) so the threshold ladder stays
  // single-source; defaults to 0 if unavailable.
  const radPenalty = (game.fourththing?.radiationBite?.(actor)?.rollPenalty ?? 0)
                   + (game.fourththing?.strainBite?.(actor)?.rollPenalty ?? 0);   // Strain (techniques R1, 2026-09-21)
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
  const isFumble = !innate && rank === 0 && baseDice.length > 0 && baseDice.every(v => v === 1);

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

  // Bank Surge on the actor (explosions from ALL dice, including dropped) —
  // through the system's one banking path so the tier cap, foe gate and Harmony
  // harvest apply here exactly like every other bank (was a raw uncapped write
  // until 2026-10-05). surgeBanked becomes what was ACTUALLY banked, so the chat
  // card's "+N Surge banked" never overstates a full pool.
  if (surgeBanked > 0) {
    const bank = game.fourththing?.bankSurge;
    if (typeof bank === "function") {
      surgeBanked = await bank(actor, surgeBanked);
    } else {
      const curSurge = rawSys?.resources?.surge?.value ?? 0;
      await actor.update({ "system.resources.surge.value": curSurge + surgeBanked });
    }
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
// Techniques R1 canon (2026-09-21): "you gain a skill rank in X; if you already
// have it, its rank rises by one instead" = +1 to that aptitude either way.
// `choice: [a, b]` rows resolve to whichever of the two the actor ranks higher
// (ties → the first). Tool "ranks" from the 5e port map onto the aptitude that
// covers the work (thieves' tools → tinkering, artisan's/tinker's tools → tinkering).
export const ITEM_APTITUDE_GRANTS = {
  "spark sense":          { occult: 1 },
  "breach specialist":    { tinkering: 1 },
  "improvised engineer":  { tinkering: 1 },
  "rig hand":             { tinkering: 1 },
  "medic of the wastes":  { faith: 1 },
  "scavenger savant":     { investigation: 1 },
  "calm the mob":         { choice: ["diplomacy", "intimidation"] },
  "threat assessment":    { choice: ["perception", "investigation"] },
  "weatherwise":          { choice: ["athletics", "lore"] },
};
function _itemAptitudeGrants(actor) {
  const out = {};
  const rawSys = actor?.system?.system ?? actor?.system;
  for (const item of actor?.items ?? []) {
    const n = String(item.name ?? "").toLowerCase().trim();
    for (const [nameKey, grants] of Object.entries(ITEM_APTITUDE_GRANTS)) {
      if (!n.startsWith(nameKey)) continue;
      for (const [skill, v] of Object.entries(grants)) {
        if (skill === "choice" && Array.isArray(v) && v.length) {
          const pick = [...v].sort((a, b) => (Number(rawSys?.skills?.[b]?.value) || 0) - (Number(rawSys?.skills?.[a]?.value) || 0))[0];
          out[pick] = (out[pick] ?? 0) + 1;
          continue;
        }
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
// Techniques audit R4 (2026-09-21): every reroll-shaped technique lives here,
// id-keyed, so the engine reads it whether or not the pack item was restamped
// (restamp-techniques.macro.js mirrors the same rows onto
// flags.fourththing.rerolls for the sheet's Passives panel). `vs` is a
// narrative gate surfaced in chat; `when` is an ENGINE gate evaluated by
// _grantWhenOk (belowHalfIntegrity · armored · unmoved · firstRound).
export const ID_REROLL_GRANTS = {
  bbttcc_feat_anchor_point: [
    { context: "save",            mode: "reroll-lowest", vs: "being pushed, pulled, knocked prone, Shaken, or charmed", note: "Anchor Point" },
    { context: "check",           mode: "reroll-lowest", vs: "being pushed, pulled, knocked prone, Shaken, or charmed", note: "Anchor Point" },
    { context: "forced-movement", mode: "reroll-lowest", note: "Anchor Point" }
  ],
  bbttcc_feat_combat_instinct:    [ { context: "initiative", mode: "reroll-lowest", note: "Combat Instinct" } ],
  bbttcc_feat_danger_close:       [ { context: "initiative", mode: "reroll-lowest", when: "belowHalfIntegrity", note: "Danger Close — below half Integrity" },
                                    { context: "check", attribute: "intrigue", mode: "reroll-lowest", when: "belowHalfIntegrity", note: "Danger Close — below half Integrity" } ],
  bbttcc_feat_darkness_hardened:  [ { context: "defense", mode: "reroll-lowest", vs: "being Shaken", note: "Darkness Hardened" } ],
  bbttcc_feat_grave_calm:         [ { context: "defense", mode: "reroll-lowest", vs: "being Shaken", note: "Grave Calm — on a success an ally within 2 squares gets the same on their next save" } ],
  bbttcc_feat_ironclad_training:  [ { context: "defense", mode: "reroll-lowest", vs: "being knocked prone", when: "armored", note: "Ironclad Training — armor or shield" } ],
  bbttcc_feat_enduring_focus:     [ { context: "check", attribute: "body", mode: "reroll-lowest", vs: "maintaining a Clarity hold", note: "Enduring Focus" } ],
  bbttcc_feat_overwatch_discipline: [ { context: "attack", mode: "reroll-lowest", vs: "reaction strikes", when: "unmoved", note: "Overwatch Discipline — you have not moved this turn" } ],
  bbttcc_feat_quickdraw_protocol: [ { context: "attack", mode: "reroll-lowest", vs: "your first attack with a weapon drawn on initiative", when: "firstRound", note: "Quickdraw Protocol — first round" } ],
  bbttcc_feat_shadow_advantage:   [ { context: "attack", mode: "reroll-lowest", vs: "a creature that has not yet acted this round (once per round)", note: "Shadow Advantage" } ],
  bbttcc_feat_situational_mastery: [ { context: "attack", mode: "reroll-lowest", vs: "your first attack roll — or pick the first defense check / +2 squares instead", when: "firstRound", note: "Situational Mastery — start of combat" },
                                     { context: "defense", mode: "reroll-lowest", vs: "your first defense check — if that was your pick", when: "firstRound", note: "Situational Mastery — start of combat" } ],
  bbttcc_feat_strike_and_fade:    [ { context: "check", skill: "stealth", mode: "reroll-lowest", vs: "after Strike and Fade ends in dim light, darkness, or cover", note: "Strike and Fade" } ],
  bbttcc_feat_vaultbreaker:       [ { context: "check", mode: "reroll-lowest", vs: "locating hidden doors, panels, caches, and secret compartments", note: "Vaultbreaker" } ],
  bbttcc_feat_leyline_attunement: [ { context: "initiative", mode: "reroll-lowest", vs: "the first combat after attuning (Resonant Warning)", note: "Leyline Attunement" },
                                    { context: "check", skill: "athletics", mode: "reroll-lowest", vs: "one check per hour of travel (Guidance of the Current)", note: "Leyline Attunement" },
                                    { context: "check", skill: "stealth", mode: "reroll-lowest", vs: "one check per hour of travel (Quiet Step)", note: "Leyline Attunement" } ],
  bbttcc_feat_sure_recitation:    [ { context: "caster-check", mode: "reroll-lowest", note: "Sure Recitation" } ]
};
// ENGINE gates for `when` (evaluated at roll time; false = the grant sits out).
// ── Token / side helpers for positional predicates and auras (2026-10-07) ──
// Canvas-aware but canvas-tolerant: with no scene or no token the positional
// predicates fail closed and auras contribute nothing.
export function ftTokenOf(actor) {
  if (!actor) return null;
  try { return actor.getActiveTokens?.()[0] ?? canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id) ?? null; }
  catch (_e) { return null; }
}
export function ftSquaresBetween(a, b) {
  const ta = a?.document ? a : ftTokenOf(a), tb = b?.document ? b : ftTokenOf(b);
  if (!ta || !tb) return Infinity;
  const sq = Number(canvas?.scene?.grid?.distance) || 5;
  try { return Math.round(canvas.grid.measurePath([ta.center, tb.center]).distance / sq); }
  catch (_e) { return Math.round(Math.hypot(ta.center.x - tb.center.x, ta.center.y - tb.center.y) / (canvas?.grid?.size || 100)); }
}
export function ftDisposition(actor) {
  const t = ftTokenOf(actor);
  return t?.document?.disposition ?? (actor?.type === "character" ? 1 : -1);
}
export const ftSameSide = (a, b) => ftDisposition(a) === ftDisposition(b);
/** Every placed token with an actor other than `actor`, with its distance in squares and side. */
export function ftNearbyActors(actor, { radius = Infinity, who = "all" } = {}) {
  const me = ftTokenOf(actor); if (!me) return [];
  const out = [];
  for (const t of canvas?.tokens?.placeables ?? []) {
    const a = t.actor; if (!a || a.id === actor.id) continue;
    if ((a.system?.system ?? a.system)?.derived?.integrity?.value <= 0) continue;
    const same = (t.document?.disposition ?? -1) === (me.document?.disposition ?? 1);
    if (who === "allies" && !same) continue;
    if (who === "enemies" && same) continue;
    const squares = ftSquaresBetween(me, t);
    if (squares > radius) continue;
    out.push({ actor: a, token: t, squares, ally: same });
  }
  return out;
}
/** Dim light or artificial light within 30 ft: scene darkness ≥ 0.5, or a light source (ambient or token) within 6 squares. */
function _ftDimOrNearLight(actor) {
  const me = ftTokenOf(actor); if (!me) return false;
  const dark = Number(canvas?.scene?.environment?.darknessLevel ?? canvas?.scene?.darkness ?? 0);
  if (dark >= 0.5) return true;
  const sq = Number(canvas?.scene?.grid?.distance) || 5, px = canvas?.grid?.size || 100;
  const near = (x, y) => Math.hypot(me.center.x - x, me.center.y - y) / px * sq <= 30;
  for (const l of canvas?.lighting?.placeables ?? []) { const c = l.document?.config; if ((c?.bright > 0 || c?.dim > 0) && !l.document?.hidden && near(l.document.x, l.document.y)) return true; }
  for (const t of canvas?.tokens?.placeables ?? []) { const l = t.document?.light; if ((l?.bright > 0 || l?.dim > 0) && near(t.center.x, t.center.y)) return true; }
  return false;
}
// ENGINE gates for `when` (evaluated at roll time; false = the grant sits out).
// `when` is a string or an array of strings (all must hold). `query.target` is
// the roll's target when the caller knows it (attackTest, trigger payloads).
// Vocabulary (also validated by lint-items / the pass builders):
//   belowHalfIntegrity · atOneIntegrity · aboveHalfIntegrity · armored · unmoved · firstRound
//   carryingSoul (Shadow Courier package carried) · airborne
//   targetDamaged · targetBloodied · targetGrounded · adjacentAlly · allyAdjacentToTarget
//   dimLightOrNearLight
export const REROLL_WHEN_VOCAB = ["belowHalfIntegrity", "atOneIntegrity", "aboveHalfIntegrity", "armored", "unmoved", "firstRound",
  "carryingSoul", "airborne", "targetDamaged", "targetBloodied", "targetGrounded", "adjacentAlly", "allyAdjacentToTarget", "dimLightOrNearLight"];
function _grantWhenOk(actor, when, query = {}) {
  if (Array.isArray(when)) return when.every(w => _grantWhenOk(actor, w, query));
  const rawSys = actor?.system?.system ?? actor?.system;
  const target = query?.target?.actor ?? query?.target ?? null;
  const tSys   = target?.system?.system ?? target?.system;
  const integ  = (s) => ({ v: Number(s?.derived?.integrity?.value) || 0, m: Number(s?.derived?.integrity?.max) || 0 });
  switch (String(when)) {
    case "belowHalfIntegrity": { const { v, m } = integ(rawSys); return m > 0 && v < m / 2; }
    case "atOneIntegrity":     { const { v } = integ(rawSys); return v === 1; }
    case "aboveHalfIntegrity": { const { v, m } = integ(rawSys); return m > 0 && v > m / 2; }
    case "armored":
      return (actor?.items ?? []).some(i => (i.type === "armor" && (i.system?.equipped ?? i.flags?.fourththing?.equipped ?? true))
                                          || /\bshield\b/i.test(String(i.name ?? "")) && (i.system?.equipped ?? i.flags?.fourththing?.equipped ?? true));
    case "unmoved":
      return (Number(rawSys?.actions?.movementUsedFt) || 0) === 0;
    case "firstRound":
      return !!game.combat?.started && Number(game.combat?.round ?? 0) <= 1;
    case "carryingSoul": case "carryingPackage":
      return rawSys?.resources?.package?.carried === true;
    case "airborne":
      return !!rawSys?.conditions?.airborne;
    case "targetDamaged":  { if (!tSys) return false; const { v, m } = integ(tSys); return m > 0 && v < m; }
    case "targetBloodied": { if (!tSys) return false; const { v, m } = integ(tSys); return m > 0 && v <= m / 2; }
    case "targetGrounded": return !!tSys && !tSys?.conditions?.airborne;
    case "adjacentAlly":
      return ftNearbyActors(actor, { radius: 1, who: "allies" }).length > 0;
    case "allyAdjacentToTarget":
      return !!target && ftNearbyActors(actor, { who: "allies" }).some(n => ftSquaresBetween(n.token, target) <= 1);
    case "dimLightOrNearLight":
      return _ftDimOrNearLight(actor);
    default:
      return true;
  }
}

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
      // Techniques R4 (2026-09-21): "defense" and "save" are the same roll family
      // (Guard / Evasion / Resolve checks and manifestation saves); "initiative"
      // is queried by FourthThingCombat.rollInitiative.
      const ctxMatch = g.context === wantContext
        || (g.context === "check" && (wantContext === "check" || wantContext === "save" || wantContext === "attack"))
        || (g.context === "save" && wantContext === "defense")
        || (g.context === "defense" && wantContext === "save");
      if (!ctxMatch) continue;
      if (g.when && !_grantWhenOk(actor, g.when, query)) continue;
      if (g.defense && query.defense && g.defense !== query.defense) continue;
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
  // AURAS (2026-10-07) — reroll grants radiated by nearby actors' items
  // (flags.fourththing.passives.aura.rerolls). Same matching rules as own grants.
  for (const src of collectAuraSources(actor)) {
    for (const g of src.aura.rerolls ?? []) {
      if (!g || !g.mode) continue;
      const ctx = g.context || "check";
      const ctxMatch = ctx === wantContext
        || (ctx === "check" && (wantContext === "check" || wantContext === "save" || wantContext === "attack"))
        || (ctx === "save" && wantContext === "defense") || (ctx === "defense" && wantContext === "save");
      if (!ctxMatch) continue;
      if (g.skill     && wantSkill     && g.skill     !== wantSkill)     continue;
      if (g.attribute && wantAttribute && g.attribute !== wantAttribute) continue;
      if (g.skill && !wantSkill) continue;
      if (g.attribute && !wantAttribute) continue;
      if (g.when && !_grantWhenOk(actor, g.when, query)) continue;
      out.push({ mode: g.mode, sourceItemName: `${src.actor.name} · ${src.item.name}`, sourceItemId: null, vs: g.vs ?? null, note: g.note ?? null, _aura: true });
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
      || wantContext === "caster-check" || wantContext === "defense";
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
               || wantContext === "attack" || wantContext === "caster-check"
               || wantContext === "defense" || wantContext === "initiative";
    // Label carries the banker (Aid · Tactical Reserve · Pressure Tested · a
    // technique card …) so the chat line says who paid for the reroll.
    const _first = _aid.find(b => b?.kind === "reroll-lowest");
    const _label = _first?.from && _first.from !== "Aid" ? `Banked: ${_first.from}` : "Aid (Rallying Words)";
    if (ctxOk) out.push({ mode: "reroll-lowest", sourceItemName: _label, sourceItemId: null, _aid: true });
  }
  // Hard Lessons (technique): after a failed defense check, reroll-lowest on
  // defense checks until the end of your next turn. Armed by
  // resolveManifestationSave; round-scoped so nothing needs clearing.
  if (wantContext === "defense" || wantContext === "save") {
    const hl = actor?.flags?.fourththing?.hardLessons;
    if (hl && (!game.combat?.started || Number(game.combat?.round ?? 0) <= (Number(hl.round) || 0) + 1)) {
      out.push({ mode: "reroll-lowest", sourceItemName: "Hard Lessons", sourceItemId: null });
    }
  }
  return out;
}


// ─── Passive readers added 2026-10-07 (regimen pass 7) ────────────────────────
// flags.fourththing.passives.aura = { radius, who:"allies"|"all"|"enemies", includeSelf?, requires?:{equipped?,active?},
//   rerolls:[{context,skill?,attribute?,vs,mode,when?}], checkBonus:[{context?,skill?,attribute?,bonus,note}],
//   defenseBonus:{guard?,evasion?,resolve?}, walkSquares?, ignoreForcedMovementSquares?, note }
// flags.fourththing.passives.ranks = { <skill>: N }            → added to the SOURCE rank on every roll
// flags.fourththing.passives.checkBonus = [{context?,skill?,attribute?,bonus,when?,note}] → flat, itemised on the card
// actor.flags.fourththing.aidBanked[] may hold { kind:"bonus", bonus, context?, skill?, attribute?, from } — consumed at roll time
function _auraRequiresOk(item, aura) {
  const r = aura?.requires; if (!r) return true;
  if (r.equipped && item.system?.equipped === false) return false;
  if ((r.active || r.lit) && item.flags?.fourththing?.auraActive !== true) return false;
  return true;
}
/** Every aura covering `actor` right now: [{ actor: source, item, aura, squares }]. */
export function collectAuraSources(actor) {
  const out = [];
  if (!actor) return out;
  const consider = (src, ally, squares) => {
    for (const item of src.items ?? []) {
      const aura = item.flags?.fourththing?.passives?.aura;
      if (!aura || !_auraRequiresOk(item, aura)) continue;
      if (squares > (Number(aura.radius) || 2)) continue;
      const who = aura.who || "allies";
      if (src.id !== actor.id) {
        if (who === "allies" && !ally) continue;
        if (who === "enemies" && ally) continue;
      } else if (!aura.includeSelf) continue;
      out.push({ actor: src, item, aura, squares });
    }
  };
  consider(actor, true, 0);
  for (const n of ftNearbyActors(actor)) consider(n.actor, n.ally, n.squares);
  return out;
}
const _bonusCtxOk = (ctx, want) => !ctx || ctx === want
  || (ctx === "check" && (want === "check" || want === "save" || want === "attack"))
  || (ctx === "save" && want === "defense") || (ctx === "defense" && want === "save");
/** Flat roll bonuses for this roll: own passives.checkBonus, aura checkBonus, banked bonuses. */
export function collectCheckBonuses(actor, query = {}) {
  const out = [];
  if (!actor) return out;
  const want = query.context || "check", skill = query.skill ?? null, attribute = query.attribute ?? null;
  const match = (g) => {
    if (!g || !Number(g.bonus)) return false;
    if (!_bonusCtxOk(g.context, want)) return false;
    if (g.skill && skill && g.skill !== skill) return false;
    if (g.attribute && attribute && g.attribute !== attribute) return false;
    if (g.skill && !skill) return false;
    if (g.attribute && !attribute) return false;
    if (g.when && !_grantWhenOk(actor, g.when, query)) return false;
    return true;
  };
  for (const item of actor.items ?? []) for (const g of item.flags?.fourththing?.passives?.checkBonus ?? []) if (match(g)) out.push({ bonus: Number(g.bonus), source: item.name, note: g.note ?? null });
  for (const src of collectAuraSources(actor)) for (const g of src.aura.checkBonus ?? []) if (match(g)) out.push({ bonus: Number(g.bonus), source: `${src.actor.name} · ${src.item.name}`, note: g.note ?? null, _aura: true });
  const banked = actor.flags?.fourththing?.aidBanked;
  if (Array.isArray(banked)) banked.forEach((b, i) => { if (b?.kind === "bonus" && match({ ...b, when: null })) out.push({ bonus: Number(b.bonus), source: `Banked: ${b.from || b.source || "ally"}`, note: b.note ?? null, _bankedIndex: i }); });
  return out;
}
/** Drop the banked bonus entries that were just applied. */
export async function consumeBankedBonus(actor, applied) {
  const idx = (applied ?? []).map(a => a?._bankedIndex).filter(i => Number.isInteger(i)).sort((a, b) => b - a);
  if (!idx.length) return;
  const banked = Array.isArray(actor.flags?.fourththing?.aidBanked) ? [...actor.flags.fourththing.aidBanked] : [];
  for (const i of idx) banked.splice(i, 1);
  try { await actor.update({ "flags.fourththing.aidBanked": banked }); } catch (e) { console.warn("banked bonus consume failed", e); }
}
/** Aura-granted defense bonus for one defense ("guard" | "evasion" | "resolve"). */
export function auraDefenseBonus(actor, which) {
  let n = 0;
  for (const s of collectAuraSources(actor)) n += Number(s.aura.defenseBonus?.[which]) || (which === "guard" ? Number(s.aura.guardBonus) || 0 : 0);
  return n;
}
/** Aura-granted extra walk, in squares. */
export function auraWalkSquares(actor) {
  let n = 0; for (const s of collectAuraSources(actor)) n += Number(s.aura.walkSquares) || 0; return n;
}
/** Squares of forced movement an aura lets this actor shrug off. */
export function auraIgnoreForcedSquares(actor) {
  let n = 0; for (const s of collectAuraSources(actor)) n += Number(s.aura.ignoreForcedMovementSquares) || 0; return n;
}
/** Skill rank grants from items (passives.ranks) — { skill: N }. */
export function rankGrantsOf(actor) {
  const out = {};
  for (const item of actor?.items ?? []) for (const [k, v] of Object.entries(item.flags?.fourththing?.passives?.ranks ?? {})) if (Number(v)) out[k] = (out[k] || 0) + Number(v);
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
  const used = applied.some(a => /^Banked: |^Aid \(Rallying Words\)$/.test(String(a?.source ?? a?.sourceItemName ?? "")));
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
  "logistics-op":  "logistics"
  // siege/body/soul are NOT among the nine OP channels — no bank key for them.
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

  // FACTION OP grants — authored in OP ("+1 Intrigue OP"), the bank holds
  // MARKS. Commit through the factions OP authority: it converts nothing, so
  // convert here with the one ratio; it enforces the caps and relays to the GM
  // when this seat doesn't own the faction actor.
  if (target === "faction" && _OP_POOL_MAP[resource]) {
    const factionId = actor.getFlag?.("bbttcc-factions", "factionId");
    if (!factionId) return { ok: false, reason: "no faction linked", resource, amount };
    const faction = game.actors?.get(factionId);
    if (!faction) return { ok: false, reason: `faction ${factionId} not found`, resource, amount };
    const opApi = game.bbttcc?.api?.op;
    if (!opApi?.commit) return { ok: false, reason: "OP API unavailable", resource, amount };
    const pool = _OP_POOL_MAP[resource];
    const marks = Math.round((Number(amount) || 0) * (opApi.OP_TO_MARKS ?? MARKS_PER_OP));
    if (!marks) return { ok: false, reason: `no amount for ${resource}`, resource, amount };
    const res = await opApi.commit(faction.id, { [pool]: marks }, {
      source: "resource-grant", label: `${grant.sourceItemName ?? "Resource grant"} — ${pool}`
    });
    if (!res?.committed) return { ok: false, reason: res?.error || "OP commit refused (cap?)", resource, amount, marks };
    return { ok: true, target: `faction:${faction.name}`, resource, pool, amount, marks };
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

// ─── Triggers engine (Phase C; events + kinds widened 2026-10-07, regimen pass 7) ───────────
// Items declare triggers under flags.fourththing.triggers = [{
//   event:    see TRIGGER_EVENTS below. Fired by module.js:
//             on-attack-hit / on-attack-miss (attacker; payload.target) · on-missed-by (the one missed; target = attacker)
//             on-incoming-damage (victim, PRE-write; kinds may return data.newAmount) · on-ally-incoming-damage (allies in radius)
//             on-damage-taken / on-self-or-ally-hit (victim, post-write) · on-ally-hit / on-self-or-ally-hit (allies; target = victim)
//             on-would-drop-to-zero (pre-write; data.holdAt1) · on-drop-to-zero · on-adjacent-drop (everyone within 1 sq; target = fallen)
//             on-skill-fail / on-skill-success (payload.rollArgs, target) · on-agreement (passed social check) · on-search (Perception/Investigation)
//             on-save-fail / on-save-success (the saver; target = caster) · on-soma-break · on-move · on-forced-movement (data.resist)
//             on-delivery · on-cast · on-turn-start · on-turn-end · on-enemy-turn-end-adjacent / on-ally-turn-end-adjacent · on-help-action (Aid; target = ally)
//   predicate?: { tag?:[...], dieMin?:N, amountMin?:N, scope?:"self"|"ally"|"enemy", movedMinFt?:N, when?: <reroll when vocab, string|array> },
//   limit?:    { window:"turn"|"round"|"scene"|"soma-break"|"short-rest"|"session", uses:N },
//   radius?:   squares, for the ally events (default 6),
//   offer?:    true → an Offer card with a button; the limit is consumed only when the player accepts,
//   effect:    { kind, args } where kind ∈ TRIGGER_EFFECT_KINDS:
//                "grant-resource"     {resource, amount, target?:"self"|"target"|"allies"|"faction"}
//                "extra-damage"       {dieFormula, type, ignoreResists?}            (needs payload.target)
//                "add-temp-integrity" {amount, target?, radius?}   "heal" {amount, track?, target?, radius?}
//                "apply-state"        {key, duration?, save?:{attr,dc}, target?}
//                "modify-incoming-damage" {mode:"half"|"minus"|"zero"|"multiply", amount?, multiplier?}  (on-incoming-damage events; offer → refund)
//                "survive-at-1" / "spend-and-survive" {resource?, amount?}          (on-would-drop-to-zero)
//                "resist-forced-movement" {}                                         (on-forced-movement)
//                "bank-reroll"        {target?, radius?, count?, context?, skill?, attribute?, note?}
//                "bank-bonus"         {bonus, target?, radius?, context?, skill?, attribute?, note?}
//                "impose"             {target?:"target"}        "remove-condition" {keys:[...], target?}
//                "displace-token"     {who:"target"|"self", squares, mode:"push"|"pull"|"shift"}
//                "apply-ae"           {name?, rounds?|minutes?, changes?:[{key,value,mode?}], surge?:{kind,resistType?,drFlat?}, target?}
//                "bank-counter"       {counter, delta?, max?}   "spend-counter" {counter, per:{dieFormula?|flat?}, type?, max?}
//                "reroll-failed-check" {}   (offer-only; on-skill-fail)   "reaction-attack" {reachSquares?} (offer-only; on-missed-by etc.)
//                "queued-reroll"      args:{context, mode}      // still a GM whisper
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

function _matchPredicate(t, payload, actor = null) {
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
  // 2026-10-07 — "moved ≥ N ft this turn AND <event>" (Avalanche Kinetic Inversion / Shockwave Arrival).
  if (Number.isFinite(p.movedMinFt)) {
    const used = Number((actor?.system?.system ?? actor?.system)?.actions?.movementUsedFt) || 0;
    if (used < p.movedMinFt) return false;
  }
  // 2026-10-07 — the reroll `when` vocabulary works on triggers too (string or array; target-aware).
  if (p.when && actor && !_grantWhenOk(actor, p.when, { target: payload?.target ?? null })) return false;
  return true;
}

async function _checkAndConsumeLimit(actor, sourceItemId, triggerIndex, limit, consume = true) {
  if (!limit?.window) return { allowed: true };
  const key = `${sourceItemId}:${triggerIndex}`;
  const usage = actor.getFlag("fourththing", _TRIGGER_USAGE_FLAG) ?? {};
  const windowKey = _ftWindowKey(limit.window);
  const current = usage[key];
  const usedInWindow = (current?.windowKey === windowKey) ? Number(current.count) || 0 : 0;
  // uses may be "tier" (2026-10-07): tier-many uses per window.
  const maxUses = limit.uses === "tier" ? Math.max(1, Number((actor.system?.system ?? actor.system)?.details?.tier) || 1) : Number(limit.uses ?? 1);
  if (usedInWindow >= maxUses) return { allowed: false, reason: `${maxUses}/${limit.window} used` };
  // Reserve a use
  if (!consume) return { allowed: true, consume: async () => { const u2 = actor.getFlag("fourththing", _TRIGGER_USAGE_FLAG) || {}; await actor.setFlag("fourththing", _TRIGGER_USAGE_FLAG, { ...u2, [key]: { windowKey, count: usedInWindow + 1, at: Date.now() } }); } };
  const updated = { ...usage, [key]: { windowKey, count: usedInWindow + 1, at: Date.now() } };
  await actor.setFlag("fourththing", _TRIGGER_USAGE_FLAG, updated);
  return { allowed: true };
}

// "(GM resolves)" prompts must reach the GMs, not just the seat that fired them.
function _gmAndMe() {
  const gms = ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [];
  return [...new Set([...gms, game.user.id])];
}

// Self-resource paths shared by grant-resource / survive-at-1 / spend-and-survive.
const _TRIGGER_SELF_PATH = {
  "frame-die":   "system.resources.frameDice.current",
  "ruin-charge": "system.resources.ruinCharges.current",
  "pace":        "system.resources.pace.current",
  "surge":       "system.resources.surge.value",
  "clarity":     "system.magic.clarity.value",
  "integrity":   "system.derived.integrity.value",
  "stress":      "system.derived.stress.value",
  "temp-integrity": "system.derived.integrity.temp"
};
// Kinds that only make sense as a player's choice AFTER the fact: they always post an Offer card.
const OFFER_ONLY_KINDS = new Set(["reroll-failed-check", "reaction-attack"]);
export const TRIGGER_EFFECT_KINDS = ["grant-resource", "add-temp-integrity", "apply-state", "heal", "extra-damage", "queued-reroll", "spend-and-survive", "chat-prompt",
  "modify-incoming-damage", "survive-at-1", "resist-forced-movement", "bank-reroll", "bank-bonus", "impose", "displace-token", "apply-ae", "remove-condition",
  "bank-counter", "spend-counter", "reroll-failed-check", "reaction-attack", "negate-condition"];
export const TRIGGER_EVENTS = ["on-ally-turn-end-adjacent", "on-attack-hit", "on-attack-miss", "on-missed-by", "on-damage-taken", "on-incoming-damage", "on-ally-incoming-damage", "on-ally-hit", "on-self-or-ally-hit",
  "on-skill-fail", "on-skill-success", "on-agreement", "on-search", "on-save-fail", "on-save-success", "on-would-drop-to-zero", "on-drop-to-zero", "on-adjacent-drop",
  "on-soma-break", "on-move", "on-forced-movement", "on-delivery", "on-cast", "on-turn-start", "on-turn-end", "on-enemy-turn-end-adjacent", "on-help-action", "on-would-gain-condition", "on-ally-forced-movement"];

// Resolve who an effect lands on. "self" (default) · "target" (payload.target) · "allies" (allies within args.radius squares, incl. self unless excludeSelf).
function _effectTargets(actor, args, payload) {
  const t = args?.target ?? "self";
  if (t === "target") { const tg = payload?.target?.actor ?? payload?.target ?? null; return tg ? [tg] : []; }
  if (t === "allies") {
    const list = ftNearbyActors(actor, { radius: Number(args.radius) || 6, who: "allies" }).map(n => n.actor);
    return args.excludeSelf ? list : [actor, ...list];
  }
  if (t === "enemies") return ftNearbyActors(actor, { radius: Number(args.radius) || 6, who: "enemies" }).map(n => n.actor);
  return [actor];
}
const _rollTotal = async (v) => (typeof v === "number" ? v : (await new Roll(String(v || "0")).evaluate()).total);

async function _dispatchEffect(actor, effect, source, payload, sourceItemId = null) {
  const kind = effect?.kind;
  const args = effect?.args ?? {};
  const srcItem = (sourceItemId && actor.items?.get?.(sourceItemId)) || null;
  switch (kind) {
    case "grant-resource": {
      // Faction OP grants share _applyOneGrant (marks conversion, caps, GM relay).
      const target = args.target ?? (_OP_POOL_MAP[args.resource] ? "faction" : "self");
      if (target === "faction" && _OP_POOL_MAP[args.resource]) {
        const r = await _applyOneGrant(actor, { resource: args.resource, amount: args.amount, target: "faction", sourceItemName: source });
        if (!r.ok) return { ok:false, reason: r.reason };
        return { ok:true, summary:`+${r.marks} ${r.pool} marks → ${r.target.replace(/^faction:/, "")}` };
      }
      const path = _TRIGGER_SELF_PATH[args.resource];
      if (!path) return { ok:false, reason:`unknown resource ${args.resource}` };
      const who = _effectTargets(actor, { target: target === "self" ? "self" : target, radius: args.radius }, payload);
      if (!who.length) return { ok:false, reason:`no ${target} for grant-resource` };
      for (const a of who) {
        const before = Number(foundry.utils.getProperty(a, path)) || 0;
        const maxV = Number(foundry.utils.getProperty(a, path.replace(/\.(current|value)$/, ".max")));
        let next = before + Number(args.amount);
        if (Number.isFinite(maxV) && maxV > 0 && next > maxV) next = maxV;
        if (next < 0) next = 0;
        if (next === before) return { ok:false, reason:`${args.resource} already at ${before}` };
        if (a.id === actor.id || a.isOwner || game.user.isGM) await a.update({ [path]: next });
        else { const gx = game.bbttcc?.api?.gmExec; if (gx?.call) await gx.call("ft-set-path", { targetUuid: a.uuid, path, value: next }); }
      }
      return { ok:true, summary:`+${args.amount} ${args.resource} → ${who.map(a => a.name).join(", ")}` };
    }
    case "add-temp-integrity": {
      const who = _effectTargets(actor, args, payload);
      if (!who.length) return { ok:false, reason:"no target for temp Integrity" };
      const amt = await _rollTotal(args.amount);
      for (const a of who) { try { await game.fourththing.tempIntegrity.grant(a, amt, source, { quiet: true }); } catch (_e) {} }
      return { ok:true, summary:`+${amt} temp Integrity → ${who.map(a => a.name).join(", ")}` };
    }
    // ── REGIMEN step 3 (2026-10-06): kinds that used to only whisper the GM now EXECUTE when the event carries a target
    //    (attackTest's on-attack-hit payload now includes `target`). Without a target they fall through to the whisper.
    case "apply-state": {
      const tgt = payload?.target?.actor ?? payload?.target ?? (args.target === "self" ? actor : null);
      if (!tgt || !args.key) break;
      const mf = { appliedStates: { states: [args.key], duration: args.duration || "1-round", saveEachRound: args.duration === "until-saved", saveAttribute: args.save?.attr } };
      if (args.save?.attr) {
        mf.resolution = { saveAttribute: args.save.attr, saveDcMode: "fixed", saveDcFixed: Number(args.save.dc) || 13, onSave: "negate", statesOnFail: true };
        const post = game.fourththing?._postSavePromptCard;
        if (post && srcItem) { await post(actor, tgt, srcItem, mf, { op: "none" }, { castDc: mf.resolution.saveDcFixed }); return { ok:true, summary:`${args.key} save card → ${tgt.name}` }; }
      }
      await game.fourththing.applyManifestationStates(actor, tgt, srcItem || { name: source }, mf, { castDc: 15 });
      return { ok:true, summary:`${args.key} → ${tgt.name}` };
    }
    case "heal": {
      const who = _effectTargets(actor, args, payload);
      if (!who.length) return { ok:false, reason:"no target to heal" };
      const amt = await _rollTotal(args.amount);
      for (const a of who) await game.fourththing.rolls._applyDamageToActor(a, amt, { op: "heal", track: args.track || "integrity" });
      return { ok:true, summary:`+${amt} ${args.track || "Integrity"} → ${who.map(a => a.name).join(", ")}` };
    }
    case "extra-damage": {
      const tgt = payload?.target?.actor ?? payload?.target;
      if (tgt && args.dieFormula) {
        const roll = await new Roll(String(args.dieFormula)).evaluate();
        const type = String(args.type || "kinetic").toLowerCase();
        await game.fourththing.rolls._applyDamageToActor(tgt, roll.total, { op: "damage", track: ["psychic", "qliphothic"].includes(type) ? "stress" : "integrity", damageType: type, ignoreResists: !!args.ignoreResists });
        return { ok:true, summary:`+${roll.total} ${type} → ${tgt.name}` };
      }
    }
    // falls through to the GM whisper when there is no target to hit
    case "queued-reroll": {
      // These need integration into the live roll/damage flow — for v1 we
      // surface as a chat prompt so the GM can apply manually. Engine will
      // route them properly in Phase 2.
      const desc = kind === "extra-damage"   ? `Extra damage: ${args.dieFormula} ${args.type ?? ""}`
                 : kind === "queued-reroll"  ? `Reroll queued: ${args.mode} on next ${args.context}`
                 : kind;
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p style="font-size:0.78rem"><b>${source}</b> triggered: ${desc} <span style="opacity:0.6">(GM resolves)</span></p>`,
        whisper: _gmAndMe()
      });
      return { ok:true, summary:`${kind} → GM prompted` };
    }
    case "chat-prompt": {
      ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p style="font-size:0.78rem"><b>${source}</b> triggered. ${args.body ?? "GM resolves."}</p>`,
        whisper: _gmAndMe()
      });
      return { ok:true, summary:`chat-prompt fired` };
    }
    // ── 2026-10-07 (regimen pass 7) — kinds that EXECUTE ──────────────────────────────────────────────
    case "modify-incoming-damage": {
      // Fired from the damage pipeline BEFORE the write (on-incoming-damage / on-ally-incoming-damage).
      // payload.amount is the post-resistance damage; data.newAmount is what the pipeline writes.
      const amount = Number(payload?.amount) || 0;
      if (!(amount > 0)) return { ok:false, reason:"no damage to modify" };
      let next = amount;
      const mode = args.mode || "half";
      if (mode === "half") next = Math.floor(amount / 2);
      else if (mode === "zero") next = 0;
      else if (mode === "minus") {
        const tier = Math.max(1, Number((actor.system?.system ?? actor.system)?.details?.tier) || 1);
        const minus = typeof args.amount === "number" ? args.amount : (await new Roll(String(args.amount || "0").replace(/@tier/g, String(tier))).evaluate()).total;
        next = Math.max(0, amount - (Number(minus) || 0));
      }
      else if (mode === "multiply") next = Math.floor(amount * (Number(args.multiplier) || 1));
      if (next === amount) return { ok:false, reason:"no change" };
      // Offer mode (post-hoc): the damage already landed — refund the difference as healing.
      if (payload?._accepted) {
        const victim = payload?.target?.actor ?? payload?.target ?? actor;
        await game.fourththing.rolls._applyDamageToActor(victim, amount - next, { op: "heal", track: payload?.track || "integrity" });
        return { ok:true, summary:`${victim.name}: ${amount} → ${next} (${amount - next} refunded)` };
      }
      return { ok:true, summary:`incoming ${amount} → ${next}`, data: { newAmount: next } };
    }
    case "survive-at-1":
    case "spend-and-survive": {
      // on-would-drop-to-zero: optionally spend a self resource, then hold the track at 1 (data.holdAt1 → pipeline).
      if (args.resource) {
        const path = _TRIGGER_SELF_PATH[args.resource];
        if (!path) return { ok:false, reason:`unknown resource ${args.resource}` };
        const have = Number(foundry.utils.getProperty(actor, path)) || 0, cost = Number(args.amount) || 1;
        if (have < cost) return { ok:false, reason:`needs ${cost} ${args.resource} (has ${have})` };
        await actor.update({ [path]: have - cost });
        return { ok:true, summary:`spent ${cost} ${args.resource} → holds at 1`, data: { holdAt1: true } };
      }
      return { ok:true, summary:`holds at 1`, data: { holdAt1: true } };
    }
    case "resist-forced-movement":
    case "negate-condition": {
      // on-forced-movement / on-would-gain-condition: data.resist → the caller refuses the shove / skips the condition.
      return { ok:true, summary: kind === "negate-condition" ? `condition refused` : `forced movement refused`, data: { resist: true } };
    }
    case "bank-reroll": {
      const who = _effectTargets(actor, args, payload);
      if (!who.length) return { ok:false, reason:"no one to bank a reroll for" };
      const n = Math.max(1, Number(args.count) || 1);
      for (const a of who) for (let i = 0; i < n; i++) await game.fourththing.aid.bank(a, { from: actor.name, source, mode: args.mode || "reroll-lowest", context: args.context ?? null, skill: args.skill ?? null, attribute: args.attribute ?? null, note: args.note ?? null });
      return { ok:true, summary:`${n > 1 ? n + " rerolls" : "a reroll"} banked → ${who.map(a => a.name).join(", ")}` };
    }
    case "bank-bonus": {
      const who = _effectTargets(actor, args, payload);
      if (!who.length) return { ok:false, reason:"no one to bank a bonus for" };
      for (const a of who) await game.fourththing.aid.bank(a, { kind: "bonus", from: actor.name, source, bonus: Number(args.bonus) || 1, context: args.context ?? null, skill: args.skill ?? null, attribute: args.attribute ?? null, note: args.note ?? null });
      return { ok:true, summary:`+${args.bonus} banked → ${who.map(a => a.name).join(", ")}` };
    }
    case "impose": {
      const who = _effectTargets(actor, { target: args.target || "target" }, payload);
      if (!who.length) return { ok:false, reason:"no target to impose on" };
      for (const a of who) await game.fourththing.impose.apply(a, { source, note: args.note || "" });
      return { ok:true, summary:`Imposed → ${who.map(a => a.name).join(", ")}` };
    }
    case "displace-token": {
      const r = await game.fourththing.triggers.displace(actor, payload?.target?.actor ?? payload?.target ?? null, args, source);
      return r?.ok ? { ok:true, summary: r.summary } : { ok:false, reason: r?.reason || "displace failed" };
    }
    case "apply-ae": {
      const who = _effectTargets(actor, args, payload);
      if (!who.length) return { ok:false, reason:"no target for the effect" };
      const ae = {
        name: args.name || source, img: srcItem?.img || "icons/svg/aura.svg", origin: srcItem?.uuid ?? actor.uuid,
        duration: args.minutes ? { seconds: Number(args.minutes) * 60 } : { rounds: Math.max(1, Number(args.rounds) || 1) },
        changes: (args.changes ?? []).map(c => ({ key: c.key, mode: Number(c.mode ?? CONST.ACTIVE_EFFECT_MODES.ADD), value: String(c.value), priority: 20 })),
        flags: { fourththing: { ...(args.flags ?? {}), ...(args.surge ? { surge: args.surge } : {}), fromTrigger: source } }
      };
      for (const a of who) {
        if (a.id === actor.id && (a.isOwner || game.user.isGM)) await a.createEmbeddedDocuments("ActiveEffect", [ae]);
        else await game.fourththing.applyEffectsToTarget(a, [ae], []);
      }
      return { ok:true, summary:`${ae.name} → ${who.map(a => a.name).join(", ")}` };
    }
    case "remove-condition": {
      const who = _effectTargets(actor, args, payload);
      const keys = Array.isArray(args.keys) ? args.keys : [args.key].filter(Boolean);
      if (!who.length || !keys.length) return { ok:false, reason:"nothing to remove" };
      const cleared = [];
      for (const a of who) for (const k of keys) {
        const sys = a.system?.system ?? a.system;
        if (!sys?.conditions?.[k]) continue;
        if (k === "imposed") await game.fourththing.impose.clear(a, source);
        else if (a.isOwner || game.user.isGM) await game.fourththing.toggleCondition(a, k);
        else await game.fourththing.applyEffectsToTarget(a, [], [], { flags: {} });   // non-owner: GM relay handles conditions via the standard path
        cleared.push(`${a.name}: ${k}`);
      }
      return cleared.length ? { ok:true, summary:`cleared ${cleared.join(", ")}` } : { ok:false, reason:"no such condition" };
    }
    case "bank-counter": {
      if (!srcItem || !args.counter) return { ok:false, reason:"bank-counter needs its item + counter name" };
      const cur = Number(srcItem.flags?.fourththing?.counters?.[args.counter]) || 0;
      const max = Number.isFinite(Number(args.max)) ? Number(args.max) : Infinity;
      const next = Math.max(0, Math.min(max, cur + (Number(args.delta) || 1)));
      if (next === cur) return { ok:false, reason:`${args.counter} already at ${cur}` };
      await srcItem.update({ [`flags.fourththing.counters.${args.counter}`]: next });
      return { ok:true, summary:`${args.counter} ${cur} → ${next}` };
    }
    case "spend-counter": {
      if (!srcItem || !args.counter) return { ok:false, reason:"spend-counter needs its item + counter name" };
      const tgt = payload?.target?.actor ?? payload?.target ?? null;
      const cur = Number(srcItem.flags?.fourththing?.counters?.[args.counter]) || 0;
      if (!(cur > 0)) return { ok:false, reason:`${args.counter} is empty` };
      if (!tgt) return { ok:false, reason:"no target to spend on" };
      const spend = Math.min(cur, Number(args.max) || cur);
      const per = args.per ?? {};
      const formula = per.dieFormula ? Array.from({ length: spend }, () => String(per.dieFormula)).join(" + ") : String((Number(per.flat) || 1) * spend);
      const roll = await new Roll(formula).evaluate();
      const type = String(args.type || "kinetic").toLowerCase();
      await game.fourththing.rolls._applyDamageToActor(tgt, roll.total, { op: "damage", track: ["psychic", "qliphothic"].includes(type) ? "stress" : "integrity", damageType: type });
      await srcItem.update({ [`flags.fourththing.counters.${args.counter}`]: cur - spend });
      return { ok:true, summary:`spent ${spend} ${args.counter}: +${roll.total} ${type} → ${tgt.name}` };
    }
    case "reroll-failed-check": {
      // Offer-only: re-run the check that just failed with the same arguments (payload.rollArgs from attributeTest).
      const ra = payload?.rollArgs;
      if (!ra) return { ok:false, reason:"no roll to retry" };
      const tgt = ra.targetUuid ? await fromUuid(ra.targetUuid).catch(() => null) : null;
      await game.fourththing.rolls.attributeTest(actor, { attribute: ra.attribute, skill: ra.skill || null, label: `${ra.label || "Check"} — ${source} reroll`, dc: ra.dc ?? null, target: tgt?.actor ?? tgt ?? null, kind: ra.kind || "tactical", _noFailTriggers: true });
      return { ok:true, summary:`${ra.label || "check"} rerolled` };
    }
    case "reaction-attack": {
      const tgt = payload?.target?.actor ?? payload?.target ?? null;
      if (!tgt) return { ok:false, reason:"no one to strike" };
      const r = await game.fourththing.triggers.reactionStrike(actor, tgt, args, source);
      return r?.ok ? { ok:true, summary: r.summary } : { ok:false, reason: r?.reason || "no strike" };
    }
    default:
      return { ok:false, reason:`unknown effect kind ${kind}` };
  }
  return { ok:false, reason:`${kind}: nothing to apply` };
}

// ── Offer cards (2026-10-07) ───────────────────────────────────────────────────
// A trigger with `offer:true` (or an offer-only kind) does not auto-fire: the owner (or GM) gets a
// chat card with a button. Accepting re-checks the limit, dispatches the effect and only THEN burns
// the use — declining costs nothing (the pass-5 "consume-on-accept" gap).
function _serialisePayload(payload = {}) {
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "target") { const a = v?.actor ?? v; out.targetUuid = a?.uuid ?? null; continue; }
    if (v === undefined || typeof v === "function") continue;
    try { JSON.stringify(v); out[k] = v; } catch (_e) {}
  }
  return out;
}
async function _postOfferCard(actor, m, payload, event, fireId = null) {
  const eff = m.trigger.effect ?? {};
  const what = m.trigger.offerText || eff.args?.body || ({
    "reroll-failed-check": "Reroll the check you just failed",
    "reaction-attack": "Make a reaction Strike",
    "modify-incoming-damage": "Reduce the damage you just took",
    "displace-token": "Shift position",
    "bank-reroll": "Bank a reroll", "bank-bonus": "Bank a bonus", "impose": "Impose on the target",
    "apply-ae": "Apply the effect", "remove-condition": "Shake the condition", "heal": "Heal", "add-temp-integrity": "Gain temporary Integrity",
    "grant-resource": "Gain the resource", "spend-counter": "Spend the banked points", "survive-at-1": "Hold at 1 Integrity"
  }[eff.kind] ?? eff.kind);
  const limitNote = m.trigger.limit ? ` <span style="opacity:0.65">(${m.trigger.limit.uses ?? 1}/${m.trigger.limit.window})</span>` : "";
  const owners = Object.entries(actor.ownership ?? {}).filter(([, l]) => l >= 3).map(([id]) => id).filter(id => id !== "default");
  const msg = await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: [...new Set([...owners, ..._gmAndMe()])],
    content: `<div class="fourththing-roll ft-trigger-offer" style="border-left:4px solid #6b3fa0;padding:0.45rem 0.6rem;background:#ede0f5;border-radius:3px;color:#1a1a1a">
      <div style="font-size:0.82rem;color:#6b3fa0;font-weight:700">⚡ ${m.sourceItemName}${limitNote}</div>
      <div style="font-size:0.78rem;margin:0.2rem 0">${what}</div>
      <button type="button" class="ft-trigger-accept" style="font-size:0.78rem;line-height:1.6;margin-top:0.15rem">Use ${m.sourceItemName}</button>
    </div>`,
    flags: { fourththing: { triggerOffer: { actorUuid: actor.uuid, itemId: m.sourceItemId, triggerIndex: m.triggerIndex, event, fireId, payload: _serialisePayload(payload), used: false } } }
  });
  return msg;
}
/** Accept an Offer card (button handler lives in module.js). */
export async function acceptTriggerOffer(message) {
  const off = message?.flags?.fourththing?.triggerOffer;
  if (!off) return { ok:false, reason:"not an offer" };
  if (off.used) return { ok:false, reason:"already used" };
  const actor = (await fromUuid(off.actorUuid).catch(() => null)); const a = actor?.actor ?? actor;
  if (!a) return { ok:false, reason:"actor gone" };
  if (!(game.user.isGM || a.isOwner)) return { ok:false, reason:"not yours to accept" };
  const item = a.items.get(off.itemId); const t = item?.flags?.fourththing?.triggers?.[off.triggerIndex];
  if (!t) return { ok:false, reason:"trigger gone" };
  const limitCheck = await _checkAndConsumeLimit(a, off.itemId, off.triggerIndex, t.limit, false);
  if (!limitCheck.allowed) return { ok:false, reason: limitCheck.reason };
  const payload = { ...off.payload, _accepted: true };
  if (off.payload?.targetUuid) { const tg = await fromUuid(off.payload.targetUuid).catch(() => null); payload.target = tg?.actor ?? tg ?? null; }
  let result; try { result = await _dispatchEffect(a, t.effect, item.name, payload, off.itemId); } catch (e) { result = { ok:false, reason: e?.message || "threw" }; }
  if (result.ok) {
    try { await limitCheck.consume?.(); } catch (_e) {}
    try { await message.update({ "flags.fourththing.triggerOffer.used": true, content: message.content.replace(/<button[\s\S]*?<\/button>/, `<div style="font-size:0.78rem;color:#2f6b2f">✔ ${result.summary}</div>`) }); } catch (_e) {}
    // 2026-10-07: sibling Offers from the same event (e.g. Wind-Read + Ward of the Gale + Reactor Shield Cape on one hit) are retired — one reaction per event.
    if (off.fireId) for (const sib of game.messages.contents) {
      const so = sib.flags?.fourththing?.triggerOffer;
      if (!so || sib.id === message.id || so.used || so.fireId !== off.fireId || so.actorUuid !== off.actorUuid) continue;
      try { await sib.update({ "flags.fourththing.triggerOffer.used": true, content: sib.content.replace(/<button[\s\S]*?<\/button>/, `<div style="font-size:0.78rem;opacity:0.6">— superseded by ${item.name}</div>`) }); } catch (_e) {}
    }
  } else ui.notifications?.warn?.(`${item.name}: ${result.reason}`);
  return result;
}

export async function fireTriggers(actor, event, payload = {}) {
  const matches = collectTriggers(actor, event);
  const fireId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;   // sibling Offers from one event supersede each other on accept
  const fired   = [];
  const skipped = [];
  const offered = [];
  for (const m of matches) {
    if (!_matchPredicate(m.trigger, payload, actor)) {
      skipped.push({ source: m.sourceItemName, reason: "predicate failed" });
      continue;
    }
    // 2026-10-06: the limited use is consumed AFTER a successful dispatch — a failed/errored effect no longer burns it
    const limitCheck = await _checkAndConsumeLimit(actor, m.sourceItemId, m.triggerIndex, m.trigger.limit, false);
    if (!limitCheck.allowed) {
      skipped.push({ source: m.sourceItemName, reason: limitCheck.reason });
      continue;
    }
    // Offers: post the card and move on — nothing fires until the player accepts.
    if (m.trigger.offer === true || OFFER_ONLY_KINDS.has(m.trigger.effect?.kind)) {
      try { await _postOfferCard(actor, m, payload, event, fireId); offered.push({ source: m.sourceItemName }); }
      catch (e) { skipped.push({ source: m.sourceItemName, reason: e?.message || "offer failed" }); }
      continue;
    }
    let result; try { result = await _dispatchEffect(actor, m.trigger.effect, m.sourceItemName, payload, m.sourceItemId); } catch (e) { result = { ok: false, reason: e?.message || "threw" }; }
    if (result.ok) { fired.push({ source: m.sourceItemName, summary: result.summary, data: result.data ?? null }); try { await limitCheck.consume?.(); } catch (_e) {} }
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
  // Merged data for the caller: the LOWEST newAmount wins; holdAt1 / resist are ORs.
  const data = {};
  for (const f of fired) for (const [k, v] of Object.entries(f.data ?? {})) {
    if (k === "newAmount") data.newAmount = Math.min(data.newAmount ?? Infinity, Number(v));
    else data[k] = data[k] || v;
  }
  return { fired, skipped, offered, event, data };
}

/** Fire `event` on every ally of `victim` within `radius` squares (per-trigger `radius` wins), with the victim as the payload target. */
export async function fireAllyTriggers(victim, event, payload = {}, { radius = 6 } = {}) {
  const results = [];
  if (!victim || !canvas?.ready) return results;
  for (const n of ftNearbyActors(victim, { who: "allies" })) {
    const mine = collectTriggers(n.actor, event);
    if (!mine.length) continue;
    const reach = Math.max(...mine.map(m => Number(m.trigger.radius) || radius));
    if (n.squares > reach) continue;
    results.push(await fireTriggers(n.actor, event, { ...payload, target: victim, scope: "ally", squares: n.squares }));
  }
  return results;
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

export async function applyPathFeatures(actor, opts = {}) {
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

  let classRootFolderId = classDoc.folder?.id ?? classDoc.folder ?? null;
  if (!classRootFolderId) { try { const idx = await pack.getIndex({ fields: ["folder"] }); classRootFolderId = (idx.get?.(classDoc.id) ?? idx.find?.(e => e._id === classDoc.id))?.folder ?? null; } catch (_e) {} }

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
    let sDoc = sSrc ? await fromUuid(sSrc) : null;
    // No source on the embedded subclass (wizard-era or hand-dragged copies) → find it in the class pack BY NAME
    // (2026-09-21: Marginalia's Annotator had no source, so its 3rd-level features were never offered).
    if (!sDoc) {
      try {
        const idx = await pack.getIndex({ fields: ["type", "name", "folder"] });
        const hit = idx.find(e => e.type === "subclass" && String(e.name).trim() === String(subclassItem.name).trim());
        if (hit) sDoc = await pack.getDocument(hit._id);
      } catch (_e) {}
    }
    if (sDoc) {
      let sFolder = sDoc?.folder?.id ?? sDoc?.folder ?? null;
      // A compendium document fetched by uuid can come back with folder = null while the pack INDEX knows it
      // (live 2026-09-21: Marginalia's Annotator resolved fine, folder null, so its 3rd-level features were never
      // offered). The index is the authority for where a pack entry lives.
      if (!sFolder) {
        try {
          const idx = await pack.getIndex({ fields: ["type", "name", "folder"] });
          const hit = idx.get?.(sDoc.id) ?? idx.find?.(e => e._id === sDoc.id) ?? idx.find?.(e => e.type === "subclass" && String(e.name).trim() === String(subclassItem.name).trim());
          sFolder = hit?.folder ?? null;
        } catch (_e) {}
      }
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

  // Level provenance (2026-09-08): stamp what a level-up imports so the
  // minus button can find it again. Precedent: flags.fourththing.grantedByHeritage.
  const stampLevel = Number(opts?.stampLevel);
  const data = toImport.map(({ doc }) => {
    const obj = doc.toObject();
    delete obj._id;
    if (Number.isFinite(stampLevel) && stampLevel > 0) foundry.utils.setProperty(obj, "flags.fourththing.grantedAtLevel", stampLevel);
    return obj;
  });
  const created = await actor.createEmbeddedDocuments("Item", data);
  return { imported: created.map(c => c.name), importedIds: created.map(c => c.id), skipped, error: null, subclassFolderName };
}

// ─── Starter manifestation kits ──────────────────────────────────────────────
// Grants the path+doctrine starter manifestation kit: every item in the
// master-content pack stamped `flags.fourththing.starterKit` whose `path`
// matches the actor's class identifier and whose `doctrine` is empty (path
// core) or matches the actor's subclass identifier. Kit sizes live in the
// authored data, not here (non-TCC combos ship 2 core + 1 signature = 3,
// TCC combos 5 core + 3 signatures = 8). Idempotent — dedupes by item name.
const STARTER_KIT_PACK = "bbttcc-master-content.items";

export async function grantStarterManifestations(actor) {
  if (!actor) return { imported: [], skipped: [], error: "No actor" };
  const classItem = actor.items.find(i => i.type === "class");
  const pathId = String(classItem?.system?.identifier ?? "").trim();
  if (!pathId) return { imported: [], skipped: [], error: "No class with an identifier on actor" };
  const doctrineId = String(actor.items.find(i => i.type === "subclass")?.system?.identifier ?? "").trim();

  const pack = game.packs.get(STARTER_KIT_PACK);
  if (!pack) return { imported: [], skipped: [], error: `Pack ${STARTER_KIT_PACK} not found` };

  const index = await pack.getIndex({ fields: ["name", "type", "flags.fourththing.starterKit"] });
  const wanted = index.filter(e => {
    const kit = foundry.utils.getProperty(e, "flags.fourththing.starterKit")
             ?? e["flags.fourththing.starterKit"] ?? null;
    if (!kit || kit.path !== pathId) return false;
    return !kit.doctrine || kit.doctrine === doctrineId;
  });
  if (!wanted.length) return { imported: [], skipped: [], error: null };

  const ownedNames = new Set((actor.items ?? []).map(i => i.name));
  const toImport = wanted.filter(e => !ownedNames.has(e.name));
  const skipped  = wanted.filter(e =>  ownedNames.has(e.name)).map(e => e.name);
  if (!toImport.length) return { imported: [], skipped, error: null };

  const docs = await Promise.all(toImport.map(e => pack.getDocument(e._id)));
  const data = docs.filter(Boolean).map(d => {
    const obj = d.toObject();
    delete obj._id;
    delete obj.folder;
    return obj;
  });
  const created = await actor.createEmbeddedDocuments("Item", data);
  return { imported: created.map(c => c.name), skipped, error: null };
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
  // ⚠ SOURCE reads (never derived) for anything written back: derived faculty =
  // source + live AEs, so writing derived+1 folded the AE into the stored value
  // while the AE stayed live on top (the faculty ratchet). Same rule as
  // levelDown / openSpendSkillPoints.
  const readSrc = () => { const r = actor.toObject().system; return r?.system ?? r ?? {}; };
  const src     = readSrc();
  const current = Number(src?.details?.level ?? rawSys?.details?.level) || 1;
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
    const cur = src?.attributes?.[k]?.value ?? 2;
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
            // Re-read source NOW — the dialog may have sat open while the sheet changed.
            const srcNow  = readSrc();
            const cur     = Number(srcNow?.attributes?.[attrKey]?.value ?? 2);
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
              const curSP = Number(srcNow?.details?.skillPoints) || 0;
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
            let grantedTechId = null;
            // Radio list (2026-06-06): read the CHECKED radio — bare .val()
            // on a radio group returns the first input, not the selection.
            const techUuid = html.find("[name='techniqueChoice']:checked").val();
            if (techUuid) {
              try {
                const src = await fromUuid(techUuid);
                if (src) {
                  const data = src.toObject();
                  delete data._id;
                  foundry.utils.setProperty(data, "flags.fourththing.grantedAtLevel", newLevel);
                  const [created] = await actor.createEmbeddedDocuments("Item", [data]);
                  grantedTechName = created?.name ?? src.name;
                  grantedTechId = created?.id ?? null;
                }
              } catch (e) {
                console.error("ft-progression: failed to grant technique", techUuid, e);
                ui.notifications.warn(`${actor.name}: technique grant failed — see console`);
              }
            }

            // Auto-grant any newly-unlocked path/doctrine principles + aptitude
            // ranks. Idempotent: applyPathFeatures dedupes by name and
            // applySkillGrantsFromFeatures dedupes by skill key.
            let autoGranted = { imported: [], importedIds: [], grantedSkills: [] };
            try {
              const pf = await applyPathFeatures(actor, { stampLevel: newLevel });
              if (pf?.imported?.length) autoGranted.imported = pf.imported;
              if (pf?.importedIds?.length) autoGranted.importedIds = pf.importedIds;
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
            const signatureBumps = [];
            if (tierUp) {
              // Record where each signature sat BEFORE the bump — the minus
              // button restores exactly that, not "one tier down".
              for (const it of actor.items) {
                const mf = it.system?.manifestation;
                if (mf?.isSignature === true && (Number(mf.tier) || 1) < newTier) signatureBumps.push({ id: it.id, from: Math.max(1, Number(mf.tier) || 1) });
              }
              try { signatureLeveled = await levelSignatureManifestations(actor, newTier); }
              catch (e) { console.error("ft-progression: signature manifestation tier-up failed", e); }
            }

            // Level ledger (2026-09-08, owner request "take Marginalia from 2 back
            // to 1"): everything this level granted, keyed by level, so
            // levelDown() can reverse it exactly. Levels gained before the
            // ledger existed fall back to inference (see levelDown).
            try {
              await actor.update({ [`flags.fourththing.levelGrants.${newLevel}`]: {
                v: 1, ts: Date.now(),
                attrKey, attrFrom: cur, attrTo: newVal,
                skillPointsGranted: gainSkillPts,
                techniqueItemId: grantedTechId,
                importedFeatureIds: autoGranted.importedIds,
                grantedSkills: autoGranted.grantedSkills.slice(),
                signatureBumps,
                integrityTopUp: integrityGain
              } });
            } catch (e) { console.warn("ft-progression: level ledger write failed", e); }

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

// ─── Level DOWN (2026-09-08, owner request) ───────────────────────────────────
// GM-only. Removes the CURRENT level and everything it granted:
//   · ledger levels (gained since 2026-09-08): exact reversal from
//     flags.fourththing.levelGrants[L] — faculty point, aptitude points
//     (unspent first, then the latest rank spends LIFO), technique + imported
//     path features (by id), rank-1 grants, signature manifestation tiers.
//   · pre-ledger levels: inference — items stamped grantedAtLevel L, feats whose
//     unlock gate sits above the new level/tier, signatures above the new tier;
//     the GM picks which faculty to lower (nothing recorded which one rose).
// Derived values (Integrity/Stress max, Clarity max, Pace, class-ability
// gates) fall out on their own from the new level. Also re-arms the Director's
// level prompt and resets Epic convergence when dropping under 18.
export async function levelDown(actor) {
  if (!game.user?.isGM) return ui.notifications.warn("Only the GM can lower Initiation.");
  if (!actor) return null;
  const rawSys  = actor.system?.system ?? actor.system;
  const srcRoot = actor.toObject().system;
  const src     = srcRoot?.system ?? srcRoot ?? {};
  const current = Number(src?.details?.level ?? rawSys?.details?.level) || 1;
  if (current <= 1) return ui.notifications.warn(`${actor.name} is already at Initiation 1.`);
  const target   = current - 1;
  const oldTier  = tierForLevel(current);
  const newTier  = tierForLevel(target);
  const tierDown = newTier < oldTier;
  const _esc = (x) => foundry.utils.escapeHTML(String(x ?? ""));

  const ledgerAll = actor.getFlag?.("fourththing", "levelGrants") || {};
  const ledger = ledgerAll?.[current] && typeof ledgerAll[current] === "object" ? ledgerAll[current] : null;

  // ── faculty ───────────────────────────────────────────────────────────────
  const attrNames = { violence: "Violence", intrigue: "Intrigue", presence: "Presence", body: "Body", mind: "Mind", soul: "Soul" };
  const attrs = src?.attributes ?? {};
  let attrHtml = "";
  if (ledger) {
    const k = ledger.attrKey;
    const gained = Number(ledger.attrTo) > Number(ledger.attrFrom);
    attrHtml = gained
      ? `<div class="ft-ld-row">▾ <b>${_esc(attrNames[k] || k)}</b> ${_esc(attrs?.[k]?.value ?? "?")} → ${_esc(Math.max(1, (Number(attrs?.[k]?.value) || 2) - 1))} <span class="ft-ld-muted">(the faculty raised at this level)</span></div>`
      : `<div class="ft-ld-row ft-ld-muted">no faculty point to reclaim (${_esc(attrNames[k] || k)} was already at cap)</div>`;
  } else {
    const opts = Object.keys(attrNames).map(k =>
      `<option value="${k}">${attrNames[k]} (currently ${_esc(attrs?.[k]?.value ?? 2)})</option>`).join("");
    attrHtml = `<div class="ft-ld-row"><label>▾ Lower which faculty by 1? <select name="attrChoice"><option value="">— skip —</option>${opts}</select></label>
      <div class="ft-ld-muted">no record of which faculty rose at Initiation ${current} (gained before the ledger existed) — your call</div></div>`;
  }

  // ── aptitude points ───────────────────────────────────────────────────────
  const ptsGranted = ledger ? (Number(ledger.skillPointsGranted) || 0) : (SKILL_POINT_LEVELS.has(current) ? 2 : 0);
  const unspent = Number(src?.details?.skillPoints) || 0;
  const spendsAll = Array.isArray(actor.getFlag?.("fourththing", "skillSpends")) ? actor.getFlag("fourththing", "skillSpends").slice() : [];
  const fromUnspent = Math.min(unspent, ptsGranted);
  let shortfall = ptsGranted - fromUnspent;
  const revertSpends = [];
  // Running rank per skill — two spends on one skill must revert two ranks,
  // not both compute "source − 1" (which collapsed them into one).
  const runRank = {};
  for (let i = spendsAll.length - 1; i >= 0 && shortfall > 0; i--) {
    const sp = spendsAll[i];
    const curRank = runRank[sp.skill] ?? (Number(src?.skills?.[sp.skill]?.value) || 0);
    if (curRank <= 0) continue;
    runRank[sp.skill] = curRank - 1;
    revertSpends.push({ idx: i, skill: sp.skill, from: curRank, to: curRank - 1 });
    shortfall--;
  }
  let ptsHtml = "";
  if (ptsGranted) {
    ptsHtml = `<div class="ft-ld-row">▾ Reclaim <b>${ptsGranted} aptitude points</b>: ${fromUnspent} from the unspent pool` +
      (revertSpends.length ? `, ${revertSpends.length} by reverting the latest rank spends: ${revertSpends.map(r => `<b>${_esc(r.skill)}</b> ${r.from}→${r.to}`).join(", ")}` : "") +
      (shortfall > 0 ? ` — <span class="ft-ld-warn">${shortfall} point${shortfall === 1 ? "" : "s"} can't be located (spent before the ledger existed); lower a rank by hand if you want it back</span>` : "") +
      `</div>`;
  }

  // ── items to remove ───────────────────────────────────────────────────────
  const removeRows = new Map(); // id -> {name, why}
  for (const it of actor.items) {
    const stamped = Number(it.getFlag?.("fourththing", "grantedAtLevel"));
    if (Number.isFinite(stamped) && stamped === current) removeRows.set(it.id, { name: it.name, why: `granted at Initiation ${current}` });
  }
  if (ledger) {
    if (ledger.techniqueItemId && actor.items.get(ledger.techniqueItemId)) removeRows.set(ledger.techniqueItemId, { name: actor.items.get(ledger.techniqueItemId).name, why: "technique picked at this level" });
    for (const id of (ledger.importedFeatureIds || [])) if (actor.items.get(id)) removeRows.set(id, { name: actor.items.get(id).name, why: "path feature imported at this level" });
  } else {
    // Inference: anything whose unlock gate the new level no longer satisfies.
    for (const it of actor.items) {
      if (it.type !== "feat" || removeRows.has(it.id)) continue;
      const stamped = Number(it.getFlag?.("fourththing", "grantedAtLevel"));
      if (Number.isFinite(stamped) && stamped > 0 && stamped <= target) continue; // known to predate this level
      const { tier: tg, level: lg } = deriveItemUnlockLevel(it);
      if ((lg !== null && lg > target) || (tg !== null && tg > newTier)) removeRows.set(it.id, { name: it.name, why: `unlocks at ${lg !== null ? `level ${lg}` : `tier ${tg}`}` });
    }
  }
  const itemsHtml = removeRows.size
    ? [...removeRows.entries()].map(([id, r]) =>
        `<label class="ft-ld-row ft-ld-check"><input type="checkbox" name="rm" value="${_esc(id)}" checked/> <b>${_esc(r.name)}</b> <span class="ft-ld-muted">— ${_esc(r.why)}</span></label>`).join("")
    : `<div class="ft-ld-row ft-ld-muted">no items to remove</div>`;

  // ── rank-1 grants from features (ledger only) ─────────────────────────────
  const grantRows = (ledger?.grantedSkills || []).filter(k => (Number(src?.skills?.[k]?.value) || 0) === 1);
  const grantsHtml = grantRows.length
    ? grantRows.map(k => `<label class="ft-ld-row ft-ld-check"><input type="checkbox" name="rank0" value="${_esc(k)}" checked/> <b>${_esc(k)}</b> rank 1 → 0 <span class="ft-ld-muted">— granted by a feature at this level</span></label>`).join("")
    : "";

  // ── signature manifestations ──────────────────────────────────────────────
  const sigRows = [];
  if (tierDown) {
    const known = new Map((ledger?.signatureBumps || []).map(b => [b.id, Math.max(1, Number(b.from) || 1)]));
    for (const it of actor.items) {
      const mf = it.system?.manifestation;
      if (!mf || mf.isSignature !== true) continue;
      const cur = Math.max(1, Math.min(4, Number(mf.tier) || 1));
      const to = known.has(it.id) ? known.get(it.id) : newTier;
      if (cur > to) sigRows.push({ id: it.id, name: it.name, from: cur, to });
    }
  }
  const sigHtml = sigRows.length
    ? `<div class="ft-ld-row">▾ Signature manifestations back to <b>Tier ${newTier}</b>: ${sigRows.map(r => `<b>${_esc(r.name)}</b> T${r.from}→T${r.to}`).join(", ")}</div>` : "";

  const epicReset = target < 18 && !!actor.getFlag?.("bbttcc-epic", "converged");

  const content = `<div class="ft-cast-dialog ft-ld">
    <style>
      .ft-ld .ft-ld-row { padding: .25rem .35rem; border-bottom: 1px solid rgba(255,255,255,.06); font-size: .8rem; line-height: 1.4; }
      .ft-ld .ft-ld-check { display: flex; gap: .4rem; align-items: baseline; cursor: pointer; }
      .ft-ld .ft-ld-muted { opacity: .65; font-size: .74rem; }
      .ft-ld .ft-ld-warn { color: #f5a623; }
      .ft-ld h4 { margin: .5rem 0 .2rem; font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
    </style>
    <div class="ft-preview-stats" style="margin-bottom:.4rem">
      <span class="ft-prev-stat"><span class="ft-prev-label">Initiation</span><span class="ft-prev-val" style="color:#f87171">${current} → ${target}</span></span>
      <span class="ft-prev-stat"><span class="ft-prev-label">Tier</span><span class="ft-prev-val" style="color:${tierDown ? "#f87171" : "#c0d4ff"}">${tierDown ? `${oldTier} → ${newTier}` : newTier}</span></span>
    </div>
    <p class="ft-ld-muted" style="margin:0 0 .3rem">${ledger ? "This level has a ledger — the reversal below is exact." : "No ledger for this level (gained before 2026-09-08) — the list below is inferred; untick anything you want to keep."}</p>
    <h4>Faculty</h4>${attrHtml}
    ${ptsGranted ? `<h4>Aptitude points</h4>${ptsHtml}` : ""}
    <h4>Items removed</h4>${itemsHtml}
    ${grantsHtml ? `<h4>Aptitude ranks granted by features</h4>${grantsHtml}` : ""}
    ${sigHtml ? `<h4>Signature manifestations</h4>${sigHtml}` : ""}
    <h4>Automatic</h4>
    <div class="ft-ld-row ft-ld-muted">Integrity, Stress and Clarity maxima, Pace and class-ability gates recompute from the new level. The Story Director's level prompt is re-armed.${epicReset ? " <span class='ft-ld-warn'>Epic convergence is reset (dropping under 18).</span>" : ""}</div>
  </div>`;

  return new Promise((resolve) => {
    new Dialog({
      title: `Withdraw Initiation — ${actor.name} ${current} → ${target}`,
      content,
      buttons: {
        down: {
          icon: "<i class='fas fa-arrow-down'></i>",
          label: `Remove Initiation ${current}`,
          callback: async (html) => {
            try {
              const $h = html?.find ? html : $(html);
              const updates = { "system.details.level": target, "system.details.tier": newTier };
              const removed = [];

              // faculty
              let attrKey = ledger ? (Number(ledger.attrTo) > Number(ledger.attrFrom) ? ledger.attrKey : null) : String($h.find("[name='attrChoice']").val() || "");
              if (attrKey && attrs?.[attrKey]) {
                const curA = Number(attrs[attrKey].value) || 2;
                updates[`system.attributes.${attrKey}.value`] = Math.max(1, curA - 1);
                removed.push(`${attrNames[attrKey] || attrKey} ${curA} → ${Math.max(1, curA - 1)}`);
              }

              // aptitude points
              if (ptsGranted) {
                updates["system.details.skillPoints"] = Math.max(0, unspent - fromUnspent);
                if (fromUnspent) removed.push(`${fromUnspent} unspent aptitude point${fromUnspent === 1 ? "" : "s"}`);
                const spends = spendsAll.slice();
                for (const r of revertSpends.slice().sort((a, b) => b.idx - a.idx)) {
                  updates[`system.skills.${r.skill}.value`] = r.to;
                  spends.splice(r.idx, 1);
                  removed.push(`${r.skill} rank ${r.from} → ${r.to}`);
                }
                if (revertSpends.length) updates["flags.fourththing.skillSpends"] = spends;
              }

              // rank-1 grants
              for (const k of $h.find("[name='rank0']:checked").map((_i, el) => el.value).get()) {
                if ((Number(src?.skills?.[k]?.value) || 0) === 1) { updates[`system.skills.${k}.value`] = 0; removed.push(`${k} rank 1 → 0`); }
              }

              // ledger entry closed (null = absent; v14 has no nested "-=" delete)
              if (ledger) updates[`flags.fourththing.levelGrants.${current}`] = null;

              await actor.update(updates);

              // items
              const ids = $h.find("[name='rm']:checked").map((_i, el) => el.value).get().filter(id => actor.items.get(id));
              if (ids.length) {
                const names = ids.map(id => actor.items.get(id)?.name).filter(Boolean);
                await actor.deleteEmbeddedDocuments("Item", ids);
                removed.push(`items: ${names.join(", ")}`);
              }

              // signatures
              if (sigRows.length) {
                await actor.updateEmbeddedDocuments("Item", sigRows.map(r => ({ _id: r.id, "system.manifestation.tier": r.to })));
                removed.push(`signatures → ${sigRows.map(r => `${r.name} T${r.to}`).join(", ")}`);
              }

              // director + epic
              try { await game.bbttcc?.api?.campaign?.director?.rearmLevelPrompt?.(actor.id); } catch (_e) {}
              if (epicReset) { try { await game.fourththing?.epic?.resetConvergence?.(actor); } catch (_e) {} }

              ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor }),
                whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
                content: `<div class="fourththing-roll">
                  <div class="ft-roll-header">
                    <span class="ft-roll-name">▾ Initiation Withdrawn: ${_esc(actor.name)}</span>
                    <span class="ft-defense-pill">Depth ${target}${tierDown ? ` · Tier ${newTier}` : ""}</span>
                  </div>
                  <p style="margin:.2rem 0;font-size:.82rem;opacity:.8">${removed.length ? removed.map(_esc).join("<br/>") : "No grants to reverse."}${ledger ? "" : "<br/><i>inferred (no ledger for this level)</i>"}</p>
                </div>`
              });
              ui.notifications.info(`${actor.name}: Initiation ${current} → ${target}.`);
              resolve({ target, newTier, removed });
            } catch (e) {
              console.error("ft-progression: levelDown failed", e);
              ui.notifications.error(`${actor.name}: level down failed — see console.`);
              resolve(null);
            }
          }
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "cancel"
    }).render(true);
  });
}

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
          // Spend ledger (2026-09-08): levelDown reclaims points LIFO from here
          // when the unspent pool can't cover what the removed level granted.
          try {
            const prior = actor.getFlag?.("fourththing", "skillSpends");
            const spends = Array.isArray(prior) ? prior.slice() : [];
            const lvlNow = Number(rawSys?.details?.level) || 1;
            for (const [sk, newRank] of Object.entries(pending)) {
              spends.push({ level: lvlNow, skill: sk, from: Number(skills?.[sk]?.value) || 0, to: Number(newRank) || 0, ts: Date.now() });
            }
            updates["flags.fourththing.skillSpends"] = spends.slice(-200);
          } catch (_eLedger) {}
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
  "warding":       "bracing",
  "weave":         "fitting",
  "bracing":       "bracing",
  "fitting":       "fitting",
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
  "weaver":        "fitting",
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
