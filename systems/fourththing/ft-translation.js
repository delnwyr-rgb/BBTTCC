// Roll for Initiation — ft-translation.js  v0.3.0
// Foundation pass: imported-text translation — legacy D&D terms → Roll for Initiation vocabulary
//
// Used in:
//   - character-sheet.hbs  (ftTranslate Handlebars helper)
//   - module.js            (ASI detection + TierEngine recalc stub)
//
// v0.3.0 (2026-04-29) — D&D-vocab scrub Phase 2:
//   - Soma Break canon: short/long rest variants → Soma Break
//   - PB standalone → tier
//   - Per-attribute "save" without "throw" (e.g., "Wisdom save" → "Soul check")
//   - Resistance/immunity/vulnerability + bare D&D damage type (no "damage" suffix)
//   - healer's kit → medkit
//   - opportunity attacks plural-preserving via function replacer
//   - Reordered saving-throw rules ABOVE bare-attribute rules (specific-first;
//     prior order made the per-attribute saving throw rules dead code)

// ─── Attribute name map ───────────────────────────────────────────────────────

export const ATTR_MAP = {
  // Full names
  "Strength":     "Violence",
  "Dexterity":    "Intrigue",
  "Constitution": "Body",
  "Intelligence": "Mind",
  "Wisdom":       "Soul",
  "Charisma":     "Presence",
  // Abbreviations
  "STR": "VIO",
  "DEX": "INT",
  "CON": "BOD",
  "INT": "MND",
  "WIS": "SOL",
  "CHA": "PRE",
  // Lowercase
  "str": "violence",
  "dex": "intrigue",
  "con": "body",
  "int": "mind",
  "wis": "soul",
  "cha": "presence",
};

// D&D → Roll For Initiation attribute key for system writes
export const STAT_TO_FT = {
  str: "violence", dex: "intrigue", con: "body",
  int: "mind",     wis: "soul",     cha: "presence"
};

// ─── Full term replacement table ─────────────────────────────────────────────
// Order matters — more specific phrases before shorter ones.

export const FT_TERM_MAP = [
  // ── Derived stats ─────────────────────────────────────────────────────────
  [/\bhit points?\b/gi,           "Integrity"],
  [/\bHP\b/g,                     "Integrity"],
  [/\barmor class\b/gi,           "Guard"],
  [/\bAC\b/g,                     "Guard"],
  [/\binitiative\b/gi,            "Initiative (Intrigue)"],
  [/\bspeed\b/gi,                 "movement"],
  [/\bpassive perception\b/gi,    "passive Perception"],

  // ── Magic / spellcasting ───────────────────────────────────────────────────
  [/\bspell slots?\b/gi,          "Clarity points"],
  [/\bspell save DC\b/gi,         "Resolve DC"],
  [/\bspell attack bonus\b/gi,    "magic attack bonus"],
  [/\bspellcasting ability\b/gi,  "primary Channel"],
  [/\bconcentration\b/gi,         "Clarity hold"],
  [/\bcantrip\b/gi,               "minor manifestation"],
  [/\bcantrips?\b/gi,             "minor manifestations"],
  [/\bspell\b/gi,                 "manifestation"],
  [/\bspells\b/gi,                "manifestations"],
  [/\bsorcery points?\b/gi,       "Clarity points"],
  [/\bki points?\b/gi,            "Clarity points"],

  // ── Saving throws (specific phrases BEFORE bare attribute names) ──────────
  // Compound forms must run first; bare-name rules below would otherwise
  // mutate "Strength" inside "Strength saving throw" and break the match.
  [/\bStrength saving throws?\b/gi,     "Violence check"],
  [/\bDexterity saving throws?\b/gi,    "Intrigue check"],
  [/\bConstitution saving throws?\b/gi, "Body check"],
  [/\bIntelligence saving throws?\b/gi, "Mind check"],
  [/\bWisdom saving throws?\b/gi,       "Soul check"],
  [/\bCharisma saving throws?\b/gi,     "Presence check"],
  // Saves without the explicit "throw" word (e.g., "Wisdom save")
  [/\bStrength saves?\b/gi,          "Violence check"],
  [/\bDexterity saves?\b/gi,         "Intrigue check"],
  [/\bConstitution saves?\b/gi,      "Body check"],
  [/\bIntelligence saves?\b/gi,      "Mind check"],
  [/\bWisdom saves?\b/gi,            "Soul check"],
  [/\bCharisma saves?\b/gi,          "Presence check"],
  [/\bsaving throws?\b/gi,           "defense check"],

  // ── Ability scores (bare names — must run AFTER compound saving-throw rules) ─
  [/\bStrength\b/g,               "Violence"],
  [/\bDexterity\b/g,              "Intrigue"],
  [/\bConstitution\b/g,           "Body"],
  [/\bIntelligence\b/g,           "Mind"],
  [/\bWisdom\b/g,                 "Soul"],
  [/\bCharisma\b/g,               "Presence"],

  // ── Proficiency ───────────────────────────────────────────────────────────
  [/\bproficiency bonus\b/gi,     "skill rank bonus"],
  [/\bgain proficiency in\b/gi,   "gain a skill rank in"],
  [/\bproficient in\b/gi,         "skilled in"],
  [/\bproficiency\b/gi,           "skill rank"],
  [/\bexpertise\b/gi,             "mastery"],
  [/\bjack of all trades\b/gi,    "adaptive competence"],
  [/\bPB\b/g,                     "tier"],

  // ── Skills (5E → FT equivalents) ─────────────────────────────────────────
  [/\bAcrobatics\b/g,     "Athletics (Intrigue)"],
  [/\bAnimal Handling\b/g,"Empathy (Presence)"],
  [/\bArcana\b/g,         "Occult (Mind)"],
  [/\bAthletics\b/g,      "Athletics (Violence)"],
  [/\bDeception\b/g,      "Stealth (Presence)"],
  [/\bHistory\b/g,        "Lore (Mind)"],
  [/\bInsight\b/g,        "Insight (Soul)"],
  [/\bIntimidation\b/g,   "Intimidation (Presence)"],
  [/\bInvestigation\b/g,  "Investigation (Mind)"],
  [/\bMedicine\b/g,       "Faith (Soul)"],
  [/\bNature\b/g,         "Lore (Mind)"],
  [/\bPerception\b/g,     "Perception (Mind)"],
  [/\bPerformance\b/g,    "Performance (Presence)"],
  [/\bPersuasion\b/g,     "Diplomacy (Presence)"],
  [/\bReligion\b/g,       "Faith (Soul)"],
  [/\bSleight of Hand\b/g,"Tinkering (Intrigue)"],
  [/\bStealth\b/g,        "Stealth (Intrigue)"],
  [/\bSurvival\b/g,       "Athletics (Body)"],

  // ── Combat ─────────────────────────────────────────────────────────────────
  [/\bhit dice?\b/gi,             "Body dice"],
  [/\bbonus action\b/gi,          "Bonus action"],
  [/\bopportunity attacks?\b/gi,  m => m.toLowerCase().endsWith("s") ? "reaction strikes" : "reaction strike"],
  [/\bsneak attack\b/gi,          "precision strike"],
  [/\bdeath saving throw\b/gi,    "last stand check"],
  [/\btemporary hit points?\b/gi, "temporary Integrity"],
  [/\bfighting style\b/gi,        "combat style"],
  [/\bhealer'?s kit\b/gi,         "medkit"],

  // ── Rest mechanics → Soma Break (canon since 2026-04-19) ──────────────────
  // Specific compound forms first so per-Soma-Break phrasing stays clean.
  [/\b1\/short rest\b/gi,         "1/Soma Break"],
  [/\b1\/long rest\b/gi,          "1/Soma Break"],
  [/\bonce per short rest\b/gi,   "once per Soma Break"],
  [/\bonce per long rest\b/gi,    "once per Soma Break"],
  [/\bper short rest\b/gi,        "per Soma Break"],
  [/\bper long rest\b/gi,         "per Soma Break"],
  [/\bshort rests?\b/gi,          "Soma Break"],
  [/\blong rests?\b/gi,           "Soma Break"],

  // ── Conditions (5E → FT) ──────────────────────────────────────────────────
  [/\bincapacitated\b/gi, "Staggered"],
  [/\bfrightened\b/gi,    "Shaken"],
  [/\bexhaustion\b/gi,    "Stress"],

  // ── Damage types (RFI fold — elementals collapse to energy) ──────────────
  // damageFlavor preservation happens in the content-sweep pass, not here.
  [/\b(?:fire|cold|lightning|acid|thunder) damage\b/gi, "energy damage"],
  [/\bradiant damage\b/gi,                              "sephirotic damage"],
  [/\b(?:necrotic|darkness) damage\b/gi,                "qliphothic damage"],
  [/\b(?:bludgeoning|piercing|slashing|force) damage\b/gi, "kinetic damage"],

  // Resistance / immunity / vulnerability + bare D&D type (no "damage" suffix).
  // Capture group preserves the "resistance to" / "immune to" / etc. lead-in so
  // we don't have to enumerate every phrasing variant individually.
  [/\b(resistance to|resistant to|immune to|immunity to|vulnerable to|vulnerability to) (?:bludgeoning|piercing|slashing|force)\b/gi, "$1 kinetic"],
  [/\b(resistance to|resistant to|immune to|immunity to|vulnerable to|vulnerability to) (?:fire|cold|lightning|acid|thunder)\b/gi, "$1 energy"],
  [/\b(resistance to|resistant to|immune to|immunity to|vulnerable to|vulnerability to) radiant\b/gi, "$1 sephirotic"],
  [/\b(resistance to|resistant to|immune to|immunity to|vulnerable to|vulnerability to) (?:necrotic|darkness)\b/gi, "$1 qliphothic"],

  // ── General 5E scaffolding ────────────────────────────────────────────────
  [/\bability score improvement\b/gi, "attribute advancement"],
  [/\bability score\b/gi,            "attribute"],
  [/\bability check\b/gi,            "attribute check"],
  [/\bclass features?\b/gi,          "path principles"],
  [/\bsubclass\b/gi,                "doctrine"],
  [/\bclass\b/gi,                   "path"],
  [/\bfeature\b/gi,                  "principle"],
  [/\btrait\b/gi,                    "trait"],
  [/\bbackground\b/gi,               "background"],
  [/\blanguage\b/gi,                 "language"],
  [/\bDarkvision\b/g,                "low-light vision"],
  [/\bDungeon Master\b/gi,           "GM"],
  [/\bDM\b/g,                        "GM"],
];

// ─── Translation function ─────────────────────────────────────────────────────

/**
 * Apply FT_TERM_MAP substitutions to an HTML string.
 * Skips content inside HTML tags (only replaces text nodes).
 * Returns the translated string.
 */
export function ftTranslate(html) {
  if (!html) return html;
  // Split on HTML tags, only replace in text segments
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag; // leave HTML tags untouched
    let result = text;
    for (const [pattern, replacement] of FT_TERM_MAP) {
      result = result.replace(pattern, replacement);
    }
    return result;
  });
}

// ─── ASI detection ────────────────────────────────────────────────────────────

const ASI_PATTERN = /\+(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)/gi;

/**
 * Scan an HTML description for Ability Score Improvement patterns.
 * Returns array of { stat: "str", amount: 2 } objects, or [] if none found.
 */
export function detectASIs(html) {
  if (!html) return [];
  const results = [];
  let match;
  while ((match = ASI_PATTERN.exec(html)) !== null) {
    const amount = parseInt(match[1]);
    const dndKey = match[2].toLowerCase().slice(0, 3);
    const ftKey  = STAT_TO_FT[dndKey];
    if (ftKey) results.push({ stat: dndKey, ftAttr: ftKey, amount });
  }
  ASI_PATTERN.lastIndex = 0; // reset global regex
  return results;
}

/**
 * Apply ASI bumps to an actor directly.
 * Called when player confirms the ASI dialog.
 */
export async function applyASIs(actor, asis) {
  const rawSys = actor.system?.system ?? actor.system;
  const updates = {};
  for (const { ftAttr, amount } of asis) {
    const current = rawSys?.attributes?.[ftAttr]?.value ?? 2;
    updates[`system.attributes.${ftAttr}.value`] = Math.min(10, current + amount);
  }
  if (Object.keys(updates).length) await actor.update(updates);
}
