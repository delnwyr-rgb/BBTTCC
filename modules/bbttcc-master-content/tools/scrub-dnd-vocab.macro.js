// Bad Eden — D&D Vocab Scrub (2026-05-16)
// ─────────────────────────────────────────────────────────────────────────────
// Rewrites D&D tool/kit/skill names in compendium item descriptions to the
// Roll for Initiation aptitude vocabulary. Driven by the same need that
// originally added the "Tinker's Tools → Tinkering" alias to ft-progression's
// skill-grant parser: feature text should read in FT language end-to-end so
// players don't carry hidden D&D-isms onto their sheets, and so the parser's
// grant-detection lands cleanly.
//
// Coverage:
//   • Tool / kit / supplies / instrument phrases (most common D&D-ism)
//   • D&D-only skill names that don't already match an FT aptitude
//   • Leaves "proficiency in/with X" framing alone — the parser handles both
//
// Idempotent: stamps `flags.fourththing.vocabScrub = STAMP_TAG` on items it
// rewrites. Re-runs skip stamped items. Set DRY_RUN = true (default) to
// preview; flip to false to commit.
//
// Targets: classes, subclasses, doctrines, ancestries, ancestry_feats,
// heritages, character-archetypes, crew-types, sephirothic-alignments,
// occult-associations, enlightenment-levels. Missing packs are skipped.
// ─────────────────────────────────────────────────────────────────────────────

const DRY_RUN = true;
const STAMP_TAG = "2026-05-16";

const PACK_IDS = [
  "bbttcc-master-content.classes",
  "bbttcc-master-content.subclasses",
  "bbttcc-master-content.doctrines",
  "bbttcc-master-content.ancestries",
  "bbttcc-master-content.ancestry_feats",
  "bbttcc-master-content.heritages",
  "bbttcc-character-options.character-archetypes",
  "bbttcc-character-options.crew-types",
  "bbttcc-character-options.sephirothic-alignments",
  "bbttcc-character-options.occult-associations",
  "bbttcc-character-options.enlightenment-levels"
];

// Tool / kit / supplies / instrument phrases. Match the whole "X's Tools"
// form so partial matches don't leak. `\b` boundaries + `['’]s` covers both
// straight and curly apostrophes (common in pasted-in D&D text).
const TOOL_PHRASES = [
  // [regex source (case-insensitive), replacement]
  ["tinker['’]s tools",         "the Tinkering aptitude"],
  ["thieves['’]? tools",        "the Tinkering aptitude"],
  ["smith['’]s tools",          "the Plating aptitude"],
  ["mason['’]s tools",          "the Plating aptitude"],
  ["leatherworker['’]s tools",  "the Plating aptitude"],
  ["carpenter['’]s tools",      "the Plating aptitude"],
  ["weaver['’]s tools",         "the Weave aptitude"],
  ["jeweler['’]s tools",        "the Tinkering aptitude"],
  ["cartographer['’]s tools",   "the Lore aptitude"],
  ["navigator['’]s tools",      "the Lore aptitude"],
  ["glassblower['’]s tools",    "the Tinkering aptitude"],
  ["potter['’]s tools",         "the Tinkering aptitude"],
  ["woodcarver['’]s tools",     "the Tinkering aptitude"],
  ["cobbler['’]s tools",        "the Tinkering aptitude"],
  ["alchemist['’]s supplies",   "the Occult aptitude"],
  ["calligrapher['’]s supplies","the Lore aptitude"],
  ["painter['’]s supplies",     "the Performance aptitude"],
  ["herbalism kit",             "the Faith aptitude"],
  ["disguise kit",              "the Stealth aptitude"],
  ["forgery kit",               "the Stealth aptitude"],
  ["poisoner['’]s kit",         "the Stealth aptitude"],
  ["musical instrument",        "the Performance aptitude"],
  ["gaming set",                "the Streetwise aptitude"],
  ["vehicles \\(land\\)",       "the Athletics aptitude"],
  ["vehicles \\(water\\)",      "the Athletics aptitude"]
];

// Phrase rewrites — convert D&D tool/access-grant phrasings into the
// "proficiency / skill rank in X" framing the parser recognizes. Each entry
// is a [regex, replacement function] pair. Replacement runs case-aware:
// the helper preserves leading-cap of the matched verb so "Grants" stays
// "Grants" while "grants" stays "grants".
const PHRASE_REWRITES = [
  // "grants access to" / "grant access to" → "grants a skill rank in"
  [/(grants?)\s+access\s+to\b/gi, (_m, verb) => `${verb} a skill rank in`],
  // "gains access to" / "gain access to" → "gains a skill rank in"
  [/(gains?)\s+access\s+to\b/gi, (_m, verb) => `${verb} a skill rank in`],
  // "has access to" / "have access to" → "is trained in" / "are trained in"
  [/\bhas\s+access\s+to\b/gi, () => "is trained in"],
  [/\bhave\s+access\s+to\b/gi, () => "are trained in"]
];

// D&D-only skill names. Word-boundary substitution; case-insensitive match,
// Title Case replacement. Skills already matching an FT aptitude
// (Athletics/Stealth/Perception/Investigation/Insight/Intimidation/Performance)
// are left alone.
const SKILL_RENAMES = [
  ["persuasion",      "Diplomacy"],
  ["religion",        "Faith"],
  ["medicine",        "Faith"],
  ["arcana",          "Occult"],
  ["history",         "Lore"],
  ["nature",          "Lore"],
  ["acrobatics",      "Athletics"],
  ["deception",       "Stealth"],
  ["sleight of hand", "Tinkering"],
  ["survival",        "Athletics"]
];

function scrub(html) {
  if (!html || typeof html !== "string") return { out: html, hits: [] };
  let out = html;
  const hits = [];
  for (const [src, repl] of TOOL_PHRASES) {
    const re = new RegExp(src, "gi");
    out = out.replace(re, (m) => { hits.push(`${m} → ${repl}`); return repl; });
  }
  for (const [re, fn] of PHRASE_REWRITES) {
    out = out.replace(re, (...args) => {
      const result = fn(...args);
      hits.push(`${args[0]} → ${result}`);
      return result;
    });
  }
  for (const [src, repl] of SKILL_RENAMES) {
    const re = new RegExp(`\\b${src}\\b`, "gi");
    out = out.replace(re, (m) => { hits.push(`${m} → ${repl}`); return repl; });
  }
  return { out, hits };
}

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const report = [];
  let totalItems = 0, rewritten = 0, stamped = 0, skipped = 0;

  for (const packId of PACK_IDS) {
    const pack = game.packs.get(packId);
    if (!pack) { report.push(`✗ MISSING pack: ${packId}`); continue; }

    if (pack.locked) {
      try { await pack.configure({ locked: false }); }
      catch (e) { report.push(`✗ Cannot unlock ${packId}: ${e.message}`); continue; }
    }

    const docs = await pack.getDocuments();
    report.push(`── ${packId} (${docs.length} items)`);

    for (const item of docs) {
      totalItems++;

      if (item.flags?.fourththing?.vocabScrub === STAMP_TAG) {
        skipped++;
        continue;
      }

      const desc = item.system?.description?.value ?? "";
      const { out, hits } = scrub(desc);
      if (!hits.length) continue;

      report.push(`  ${item.name}`);
      for (const h of hits) report.push(`    · ${h}`);

      if (DRY_RUN) {
        rewritten++;
        continue;
      }

      try {
        await item.update({
          "system.description.value": out,
          "flags.fourththing.vocabScrub": STAMP_TAG
        });
        rewritten++;
        stamped++;
      } catch (e) {
        report.push(`    ✗ update failed: ${e.message}`);
      }
    }
  }

  console.group("[scrub-dnd-vocab]");
  report.forEach(r => console.log(r));
  console.groupEnd();

  const tag = DRY_RUN ? "DRY RUN" : "applied";
  ui.notifications.info(
    `Vocab scrub (${tag}): ${rewritten}/${totalItems} item descriptions rewritten, ${skipped} already-stamped skipped${DRY_RUN ? "" : `, ${stamped} stamped`}.`
  );
})();
