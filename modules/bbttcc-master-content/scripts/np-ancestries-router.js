/* Bad Eden Master Content — NP Ancestries Router Registration
 *
 * Registers the four non-playable ancestry tier feats (Dragon, Devil/Infernal,
 * Angel/Empyrean, Eidolon/Outsider) with the fourththing system's native
 * CHAR_OPT_ABILITIES dispatch table. Identifiers must match the values
 * authored by tools/create-np-ancestries.macro.js.
 *
 * Once registered, each tier feat:
 *  - shows a ▶ Use button on the actor sheet (gated by isActionableFeature)
 *  - clicking routes through dispatchFeatureAction → openCharOptAbility
 *    → opens the per-scene / per-soma-break / info dialog
 *  - flag-tracks usage at flags.fourththing.disciplineUsed.{key}
 *    (auto-resets on Soma Break per module.js somaBreak action)
 *
 * Type vocabulary (per ft-class-automation.js:2965-2970):
 *   "info"            → passive — _openInfoOnlyAbility (no tracking)
 *   "scene"           → 1/Scene Break — _openPerSceneAbility (player resets)
 *   "soma-break"      → 1/Soma Break — _openSomaBreakAbility (auto-reset)
 *   "soma-break-tier" → Tier uses/Soma Break — _openTierUsesPerSomaBreak
 *
 * Action cost is inferred from the leading words of `body` ("Action —",
 * "Bonus action —", "Reaction —") per _inferActionCostFromBody at line 4059.
 *
 * 2026-05-15 — NPC Affiliation Integration sprint, Phase F follow-on (fourththing-native rework).
 */

const NP_ABILITIES = {
  // ── Dragon (4) ─────────────────────────────────────────────────────────
  "dragon-wyrmling": {
    type: "info", level: 1,
    label: "Dragon: Wyrmling Scales (Tier 1)",
    body: "Your scales count as light armor (AC 12 + Dex). When struck by a melee attack, the attacker takes 1 fire damage on a hit. (Passive — this card is a reminder of the rule.)"
  },
  "dragon-adolescent": {
    type: "scene", level: 1, actionCost: "action",
    label: "Dragon: Adolescent Breath (Tier 2)",
    body: "Action — exhale a 15-ft cone of elemental fury. 2d6 fire damage, Dex save (DC 8 + Tier + Body) for half. Damage type chosen at character creation: fire / cold / lightning / acid / poison. (1/Scene Break.)"
  },
  "dragon-elder": {
    type: "soma-break", level: 1, actionCost: "bonus",
    label: "Dragon: Elder Wing (Tier 3)",
    body: "Bonus action — gain a fly speed equal to your walking speed (passive). Once per Soma Break you may take the Dash action as a bonus action while flying."
  },
  "dragon-ancient": {
    type: "info", level: 1,
    label: "Dragon: Ancient Aura (Tier 4)",
    body: "Hostile creatures within 30 ft that can see you must succeed a Wisdom save (DC 8 + Tier + Presence) at the start of their turn or be Frightened of you until the end of their next turn. Once frightened by your aura, a creature is immune for 24 hours. (Passive aura — fires automatically; this card is a reminder of the rule.)"
  },

  // ── Devil / Infernal (4) ───────────────────────────────────────────────
  "devil-lesser": {
    type: "info", level: 1,
    label: "Devil: Lesser Brand (Tier 1)",
    body: "You know the Infernal language and gain proficiency in Persuasion or Deception (your choice). Resistance to fire damage. (Passive.)"
  },
  "devil-pactbinder": {
    type: "soma-break", level: 1, actionCost: "action",
    label: "Devil: Pactbinder (Tier 2)",
    body: "Action — when you secure a willing verbal agreement with a creature, both parties become magically bound for 24 hours. Breaking the pact deals 4d6 psychic damage to the breaker. (1/Soma Break.)"
  },
  "devil-archduke": {
    type: "info", level: 1,
    label: "Devil: Archduke's Tongue (Tier 3)",
    body: "When you make a Charisma (Persuasion or Deception) check, you may roll twice and take the better. You also know whenever a creature within 30 ft tells a deliberate lie. (Passive.)"
  },
  "devil-sovereign": {
    type: "soma-break", level: 1, actionCost: "action",
    label: "Devil: Sovereign of Hells (Tier 4)",
    body: "Action — compel a creature you have made eye contact with to obey one direct command (Wis save DC 8 + Tier + Presence to resist). The command must not be self-destructive. Your fire resistance becomes immunity. (1/Soma Break.)"
  },

  // ── Angel / Empyrean (4) ──────────────────────────────────────────────
  "angel-lesser": {
    type: "info", level: 1,
    label: "Angel: Empyrean Spark (Tier 1)",
    body: "You know the Celestial language. Resistance to radiant damage. You can shed dim light in a 10-ft radius at will. (Passive.)"
  },
  "angel-grace": {
    type: "soma-break-tier", level: 1, actionCost: "action",
    label: "Angel: Grace Touch (Tier 2)",
    body: "Action — touch a creature; restore HP equal to 1d6 + your Spirit modifier. The healing also ends one disease or one effect inflicting blindness or deafness. (Tier uses per Soma Break.)"
  },
  "angel-seraph": {
    type: "soma-break-tier", level: 1, actionCost: "bonus",
    label: "Angel: Seraphic Wings (Tier 3)",
    body: "Bonus action — manifest radiant wings; gain a fly speed equal to your walking speed for 1 minute. (Tier uses per Soma Break.)"
  },
  "angel-archon": {
    type: "soma-break", level: 1, actionCost: "action",
    label: "Angel: Archon's Word (Tier 4)",
    body: "Action — speak a word of binding truth. Creatures of your choice within 30 ft must Cha save (DC 8 + Tier + Spirit) or be unable to speak a deliberate lie for 1 minute. Your radiant resistance becomes immunity. (1/Soma Break.)"
  },

  // ── Eidolon / Outsider (4) ────────────────────────────────────────────
  "eidolon-lesser": {
    type: "info", level: 1,
    label: "Eidolon: Outsider Cast (Tier 1)",
    body: "You do not need to eat, sleep, or breathe. You appear subtly wrong to careful observers (Perception DC 15 to notice). Resistance to psychic damage. (Passive.)"
  },
  "eidolon-whisper": {
    type: "scene", level: 1, actionCost: "bonus",
    label: "Eidolon: Whisper Walk (Tier 2)",
    body: "Bonus action — step sideways out of consensus reality; you become invisible and pass through one wall up to 5 ft thick before reappearing on the other side. Concentration not required. (1/Scene Break.)"
  },
  "eidolon-voice": {
    type: "scene", level: 1, actionCost: "action",
    label: "Eidolon: Concept-Voice (Tier 3)",
    body: "Action — name a single concept (a fear, a memory, a desire). One creature within 30 ft that can hear you takes 4d6 psychic damage and is Charmed or Frightened by the named concept until the end of your next turn (Wis save DC 8 + Tier + Presence for half damage and to negate the condition). (1/Scene Break.)"
  },
  "eidolon-sovereign": {
    type: "soma-break", level: 1, actionCost: "action",
    label: "Eidolon: Sovereign of Things (Tier 4)",
    body: "Action — declare an object within 60 ft to be 'one of yours.' For 24 hours that object cannot be used effectively against you (attack rolls with it have disadvantage; spells cast through it must save vs your spell DC or fizzle). Your psychic resistance becomes immunity. (1/Soma Break.)"
  }
};

function _registerNPAncestries(loud = true) {
  const cls = game.fourththing?._classAutomation;
  if (!cls?.CHAR_OPT_ABILITIES || !cls?.FEATURE_ROUTER) {
    // Silent on the first script-load attempt — the fourththing system isn't
    // initialized yet at module-eval time, so this branch is expected. The
    // Hooks.once("ready") install below will succeed and log success.
    // Only warn when the ready-hook install ALSO fails, which would mean the
    // fourththing system never initialized at all.
    if (loud) console.warn("[bbttcc-master-content/np-ancestries] fourththing._classAutomation still not loaded at ready — NP ancestry router registration skipped.");
    return 0;
  }
  let added = 0;
  for (const [id, spec] of Object.entries(NP_ABILITIES)) {
    cls.CHAR_OPT_ABILITIES[id] = spec;
    cls.FEATURE_ROUTER[id] = "char_opt_lookup";
    added++;
  }
  console.log(`[bbttcc-master-content/np-ancestries] Registered ${added} NP ancestry abilities into fourththing CHAR_OPT_ABILITIES + FEATURE_ROUTER.`);
  return added;
}

// Install at script-load AND ready to survive load-order races
// (per [[bbttcc-api-exposure-pattern]]). The script-load attempt is silent
// on failure since the fourththing system likely isn't initialized yet.
_registerNPAncestries(false);
Hooks.once("ready", () => _registerNPAncestries(true));
