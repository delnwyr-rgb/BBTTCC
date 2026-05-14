// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Phase 7 survey: caster-discipline kit + subclass per-uses
// ─────────────────────────────────────────────────────────────────────────────
// Phase 6 surfaced the 16 ladder items shipped by the discipline pilot
// (Initiation 1/6/11/16 + Tier 1/2/3/4 across CL/WL/DW/PK).
//
// Phase 6's survey ALSO revealed buried per-uses in the older class-kit and
// subclass items for the same four disciplines (Sapphire/Quiet/Thousand for
// Dreamwalker, Foresight/Truth/Mercy refractions for Wyrdlens, civic-charge /
// resonance-pool / etc.). Those are Phase 7.
//
// This survey:
//   • walks `bbttcc-master-content.classes`
//   • matches anything whose identifier starts with one of the 4 discipline
//     prefixes BUT excludes the 16 Phase 6 ladder identifiers
//   • dumps full descTail (1800 chars) per flagged item so callout text can
//     be hand-curated without a second round-trip
//
// USAGE
//   1. Open F12 console as GM.
//   2. Paste this whole file. Hit Enter.
//   3. Copy globalThis.__phase7Survey back to Claude.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID = "bbttcc-master-content.classes";

  // Identifier prefixes that mark a discipline (lowercase + dash/underscore tolerant)
  const DISCIPLINE_PREFIXES = [
    "cosmic_linguist",
    "cosmic-linguist",
    "wyrdlens",
    "dreamwalker",
    "pactkeeper",
  ];

  // The 16 Phase 6 identifiers — exclude so we don't re-survey what's done
  const PHASE6_DONE = new Set([
    "cl_init1_true_name_touch", "cl_init6_translation", "cl_mode_sentence", "cl_word_that_was",
    "wyrdlens_adept_tier_1_lens_read", "wyrdlens_adept_tier_2_probability_overlay", "wl_mode_refraction", "wl_tikkun_sight",
    "dw_t1_oneiric_reservoir", "dw_t2_dream_cache", "dw_mode_walking_lane", "dw_shared_dream",
    "pk_init1_the_bargain", "pk_init6_renegotiate", "pk_mode_sealed_pact", "pk_ledger_day",
  ]);

  const PER_USE_CHECKS = [
    ["1/scene",     /\b1\s*\/\s*scene|once per scene/i],
    ["1/SB",        /\b1\s*\/\s*(soma\s*break|sb)|once per (soma break|long rest)|per long rest/i],
    ["1/short",     /\b1\s*\/\s*(short rest|sr)|once per short rest/i],
    ["1/turn",      /\b1\s*\/\s*(strategic\s*turn|turn)|per (strategic\s*)?turn/i],
    ["1/round",     /\b1\s*\/\s*round|once per round/i],
    ["1/scenario",  /1\s*\/\s*scenario|once per scenario/i],
    ["expend",      /\bexpend|spend a|spend [0-9]/i],
    ["reaction",    /\bas a reaction\b/i],
    ["trigger",     /\bwhen you (crit|succeed|fail|are hit|drop to|roll|use|cast|manifest)/i],
    ["stance",      /\bstance|while.*held|signature mode/i],
    ["passive",     /\bproficiency in|skill rank \+|max(imum)?\s+is\s+\+|\+\d+ to/i],
  ];

  const pack = game.packs.get(PACK_ID);
  if (!pack) { console.error(`Pack ${PACK_ID} not found.`); return; }
  const idx = await pack.getIndex({ fields: ["name", "type"] });

  const grouped = {};
  let totalMatched = 0, totalFlagged = 0;

  for (const e of idx) {
    const doc = await pack.getDocument(e._id);
    const ident = (doc.system?.identifier ?? "").toLowerCase();
    if (!DISCIPLINE_PREFIXES.some(p => ident.startsWith(p))) continue;
    if (PHASE6_DONE.has(ident)) continue;

    const desc = doc.system?.description?.value ?? "";
    const textOnly = desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const markers = [];
    for (const [tag, re] of PER_USE_CHECKS) {
      if (re.test(textOnly)) markers.push(tag);
    }
    const alreadySurfaced = /data-ft-per-use=/.test(desc);

    // Group by leading discipline prefix
    const key =
      ident.startsWith("cosmic_linguist") || ident.startsWith("cosmic-linguist") ? "cosmic_linguist"
      : ident.startsWith("wyrdlens")   ? "wyrdlens"
      : ident.startsWith("dreamwalker") ? "dreamwalker"
      : ident.startsWith("pactkeeper") ? "pactkeeper"
      : "_other";

    (grouped[key] ??= []).push({
      name: doc.name,
      identifier: doc.system?.identifier ?? "",
      type: doc.type,
      markers,
      alreadySurfaced,
      descTail: textOnly.slice(-1800),
    });
    totalMatched++;
    if (markers.length && !alreadySurfaced) totalFlagged++;
  }

  console.log(`\n%c=== Phase 7 survey: ${totalMatched} matched, ${totalFlagged} flagged ===`, "color:#88ccff;font-weight:bold");
  for (const [key, items] of Object.entries(grouped)) {
    const flagged = items.filter(i => i.markers.length && !i.alreadySurfaced);
    console.groupCollapsed(`${key} — ${items.length} matched, ${flagged.length} flagged`);
    for (const item of items) {
      const tag = item.alreadySurfaced
        ? "[surfaced]"
        : (item.markers.length ? `[${item.markers.join(",")}]` : "[—]");
      console.log(`  ${item.name} ${tag}`);
      console.log(`    id=${item.identifier} type=${item.type}`);
      console.log(`    ${item.descTail}`);
    }
    console.groupEnd();
  }

  console.log("\n%c=== FULL JSON BLOB (copy this) ===", "color:#88ff88;font-weight:bold");
  console.log(grouped);
  globalThis.__phase7Survey = { pack: PACK_ID, grouped };
  console.log("\nAlso stored at globalThis.__phase7Survey for easy copy.");
})();
