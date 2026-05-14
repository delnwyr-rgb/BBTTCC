// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Phase 5: Bulk D&D-vocab text scrub
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent — sentinel `data-ft-phase5-vocab-scrub="v1"` stamped at top of
// every patched description on first pass.
//
// CONFIG: set DRY_RUN=true at the top to preview changes without writing
// (logs every item that WOULD be patched). Set false to actually write.
//
// Walks every bbttcc-* Item pack (Item docs only) + every actor's items.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const DRY_RUN = false;          // ← flip to true for a no-write preview
  const SENTINEL = "data-ft-phase5-vocab-scrub=\"v1\"";

  // RFI canon mapping — keep in sync with project_rfi_terminology_canon.md.
  //
  // Order matters: longer / more specific phrases first to avoid clobbering
  // (e.g. "Dexterity saving throw" before bare "Dexterity").
  //
  // Each row: [pattern (RegExp or string), replacement, label]
  // RegExp uses /gi unless explicitly /g for case-sensitive.
  const REPLACERS = [
    // ── 1. TODO markers from prior translation passes ────────────────────
    [/\s*\[TODO\(adv-call\)\]/g, "", "todo_adv"],
    [/\s*\[TODO\(pb-call\)\]/g, "", "todo_pb"],
    [/\s*\[TODO\([a-z\-]+\)\]/g, "", "todo_other"],

    // ── 2. Doubled parentheticals from prior translation: "(Mind) (Mind)" ──
    // Run multiple times to catch (Mind) (Mind) (Mind) chains.
    [/\(([A-Z][a-z]+)\)\s+\(\1\)/g, "($1)", "doubled_parens"],
    [/\(([A-Z][a-z]+)\)\s+\(\1\)/g, "($1)", "doubled_parens_pass2"],
    [/\(([A-Z][a-z]+)\)\s+\(\1\)/g, "($1)", "doubled_parens_pass3"],

    // ── 3. Recovery windows ─────────────────────────────────────────────
    [/\b(\d+)\s*\/\s*Short Rest\s*;\s*recharges on Soma Break\b/gi, "$1/Soma Break", "rest_count_short_recharge"],
    [/\b(\d+)\s*\/\s*Long Rest\s*;\s*recharges on Soma Break\b/gi, "$1/Soma Break", "rest_count_long_recharge"],
    [/\b(\d+)\s*\/\s*Short or Long Rest\b/gi, "$1/Soma Break", "rest_count_short_or_long"],
    [/\b(\d+)\s*\/\s*Short Rest\b/gi, "$1/Soma Break", "rest_count_short"],
    [/\b(\d+)\s*\/\s*Long Rest\b/gi, "$1/Soma Break", "rest_count_long"],
    [/\bonce per long rest\b/gi, "1/Soma Break", "once_per_long_rest"],
    [/\bonce per short rest\b/gi, "1/Soma Break", "once_per_short_rest"],
    [/\bonce per short or long rest\b/gi, "1/Soma Break", "once_per_short_or_long"],
    [/\b(\d+) times per long rest\b/gi, "$1/Soma Break", "n_times_long_rest"],
    [/\b(\d+) times per short rest\b/gi, "$1/Soma Break", "n_times_short_rest"],
    [/\b(short or long rest)\b/gi, "Soma Break", "short_or_long_rest"],
    [/\b(short rest)\b/gi, "Soma Break", "short_rest"],
    [/\b(long rest)\b/gi, "Soma Break", "long_rest"],

    // ── 4. PB → tier ────────────────────────────────────────────────────
    // Order: longer first.
    [/\bproficiency bonus \(PB\)\b/gi, "tier", "pb_full_paren"],
    [/\bproficiency bonus\b/gi, "tier", "pb_full"],
    [/\b\+PB\b/g, "+tier", "pb_plus"],
    [/\bPB\/Long Rest\b/gi, "tier uses / Soma Break", "pb_long_rest"],
    [/\bPB\/Short Rest\b/gi, "tier uses / Soma Break", "pb_short_rest"],
    [/\b\+ PB\b/g, "+ tier", "pb_plus_space"],
    // Bare "PB" only when surrounded by whitespace/punctuation; avoid
    // accidentally hitting things like "PBCT" or part of words.
    [/(?<![A-Za-z])PB(?![A-Za-z])/g, "tier", "pb_bare"],

    // ── 5. Advantage / disadvantage ─────────────────────────────────────
    // RFI canon: advantage → reroll the lowest die; disadvantage → roll 3d10 keep lowest 2.
    [/\bhave advantage on\b/gi, "reroll the lowest die on", "have_adv_on"],
    [/\bhas advantage on\b/gi, "rerolls the lowest die on", "has_adv_on"],
    [/\bgains advantage on\b/gi, "rerolls the lowest die on", "gains_adv_on"],
    [/\bgain advantage on\b/gi, "reroll the lowest die on", "gain_adv_on"],
    [/\badvantage on\b/gi, "reroll-lowest on", "adv_on_short"],
    [/\bwith advantage\b/gi, "rerolling the lowest die", "with_adv"],
    [/\bhave disadvantage on\b/gi, "roll 3d10 keep lowest 2 on", "have_disadv_on"],
    [/\bhas disadvantage on\b/gi, "rolls 3d10 keep lowest 2 on", "has_disadv_on"],
    [/\bdisadvantage on\b/gi, "3d10 keep lowest 2 on", "disadv_on"],
    [/\bwith disadvantage\b/gi, "rolling 3d10 keep lowest 2", "with_disadv"],

    // ── 6. D&D ability names → RFI attributes ────────────────────────────
    // Mapping: STR→Violence, DEX→Intrigue, CON→Body, WIS→Soul, CHA→Presence, INT→Mind.
    // Saving throws / saves → defense checks. Hit `<Stat> saving throw` BEFORE bare ability.
    [/\bStrength saving throw(s?)\b/gi, "Violence defense check$1", "str_save"],
    [/\bDexterity saving throw(s?)\b/gi, "Intrigue defense check$1", "dex_save"],
    [/\bConstitution saving throw(s?)\b/gi, "Body defense check$1", "con_save"],
    [/\bWisdom saving throw(s?)\b/gi, "Soul defense check$1", "wis_save"],
    [/\bCharisma saving throw(s?)\b/gi, "Presence defense check$1", "cha_save"],
    [/\bIntelligence saving throw(s?)\b/gi, "Mind defense check$1", "int_save"],
    [/\bStrength save(s?)\b/gi, "Violence defense check$1", "str_savep"],
    [/\bDexterity save(s?)\b/gi, "Intrigue defense check$1", "dex_savep"],
    [/\bConstitution save(s?)\b/gi, "Body defense check$1", "con_savep"],
    [/\bWisdom save(s?)\b/gi, "Soul defense check$1", "wis_savep"],
    [/\bCharisma save(s?)\b/gi, "Presence defense check$1", "cha_savep"],
    [/\bIntelligence save(s?)\b/gi, "Mind defense check$1", "int_savep"],
    [/\bStrength check(s?)\b/gi, "Violence check$1", "str_check"],
    [/\bDexterity check(s?)\b/gi, "Intrigue check$1", "dex_check"],
    [/\bConstitution check(s?)\b/gi, "Body check$1", "con_check"],
    [/\bWisdom check(s?)\b/gi, "Soul check$1", "wis_check"],
    [/\bCharisma check(s?)\b/gi, "Presence check$1", "cha_check"],
    [/\bIntelligence check(s?)\b/gi, "Mind check$1", "int_check"],
    [/\bStrength modifier\b/gi, "Violence modifier", "str_mod"],
    [/\bDexterity modifier\b/gi, "Intrigue modifier", "dex_mod"],
    [/\bConstitution modifier\b/gi, "Body modifier", "con_mod"],
    [/\bWisdom modifier\b/gi, "Soul modifier", "wis_mod"],
    [/\bCharisma modifier\b/gi, "Presence modifier", "cha_mod"],
    [/\bIntelligence modifier\b/gi, "Mind modifier", "int_mod"],
    // Bare 3-letter shorthand (heritage Lineage-Lean cards). Case-sensitive
    // because we don't want to clobber filename fragments etc.
    [/\bSTR\b/g, "VIO (Violence)", "str_short"],
    [/\bDEX\b/g, "INTR (Intrigue)", "dex_short"],
    [/\bCON\b/g, "BOD (Body)", "con_short"],
    [/\bWIS\b/g, "SOUL", "wis_short"],
    [/\bCHA\b/g, "PRE (Presence)", "cha_short"],
    [/\bINT\b/g, "MND (Mind)", "int_short"],
    // Mixed-case standalone (e.g. "Dex" in "DC = 8 + tier + Dex")
    [/\b(Dex)(?![a-z])/g, "Intrigue", "dex_mixed"],
    [/\b(Con)(?![a-z])/g, "Body", "con_mixed"],
    [/\b(Str)(?![a-z])/g, "Violence", "str_mixed"],
    [/\b(Wis)(?![a-z])/g, "Soul", "wis_mixed"],
    [/\b(Cha)(?![a-z])/g, "Presence", "cha_mixed"],

    // ── 7. HP / Hit Points ──────────────────────────────────────────────
    [/\bhit points\b/gi, "Integrity", "hit_points"],
    [/\bhit point\b/gi, "Integrity", "hit_point_singular"],
    [/\bHP\b/g, "Integrity", "hp_short"],
    [/\bHit Die\b/g, "Hit Die", "hit_die_keep"],   // no-op (kept as-is, RFI uses Hit Dice)

    // ── 8. Exhaustion → Stress (RFI canon) ──────────────────────────────
    [/\bone level of exhaustion\b/gi, "one level of Stress", "one_exhaustion"],
    [/\b(\d+) levels? of exhaustion\b/gi, "$1 levels of Stress", "n_exhaustion"],
    [/\bexhausted\b/gi, "Stressed", "exhausted"],
    [/\bexhaustion\b/gi, "Stress", "exhaustion_bare"],

    // ── 9. Death saves → Last Stand ─────────────────────────────────────
    [/\bdeath saving throw(s?)\b/gi, "Last Stand roll$1", "death_saves"],
    [/\bdeath save(s?)\b/gi, "Last Stand roll$1", "death_savep"],

    // ── 10. Generic terms ───────────────────────────────────────────────
    [/\bability score(s?)\b/gi, "attribute$1", "ability_score"],
    [/\bability check(s?)\b/gi, "attribute check$1", "ability_check"],
    [/\bskill check(s?)\b/gi, "skill check$1", "skill_check_keep"],   // no-op
    [/\bspell save DC\b/gi, "manifestation DC", "spell_save_dc"],
    [/\bspell slot(s?)\b/gi, "manifestation slot$1", "spell_slot"],
    [/\bcantrip(s?)\b/gi, "Tier-0 manifestation$1", "cantrip"],
    [/\bspellcasting ability\b/gi, "manifestation aptitude", "spellcast_abil"],
    [/\binitiative roll\b/gi, "initiative", "init_roll"],

    // ── 11. Action keywords (mostly OK, but a few D&D-isms slip through) ──
    [/\bDisengage action\b/g, "Disengage", "disengage_action"],
    [/\bDash action\b/g, "Dash", "dash_action"],
  ];

  const SCAN_TYPES = new Set(["feat", "feature", "weapon", "armor", "gear", "power", "class", "subclass", "race", "species"]);

  const ensureSentinel = (val) =>
    val.includes(SENTINEL) ? val : `<div ${SENTINEL} style="display:none"></div>\n${val}`;

  const scrub = (val) => {
    if (!val) return { value: val, hits: {} };
    const hits = {};
    let out = val;
    for (const [pat, repl, label] of REPLACERS) {
      const before = out;
      out = out.replace(pat, repl);
      if (before !== out) {
        const matches = before.match(pat instanceof RegExp ? pat : new RegExp(pat, "g"));
        hits[label] = (hits[label] ?? 0) + (matches ? matches.length : 1);
      }
    }
    return { value: out, hits };
  };

  // ── Pack pass ────────────────────────────────────────────────────────────
  let packTouched = 0, packSkipped = 0, packAlreadyClean = 0;
  const totalHits = {};
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (!SCAN_TYPES.has(doc.type)) continue;
        const orig = doc.system?.description?.value ?? "";
        if (!orig) continue;
        if (orig.includes(SENTINEL)) { packAlreadyClean++; continue; }
        const { value: scrubbed, hits } = scrub(orig);
        if (Object.keys(hits).length === 0) {
          packSkipped++;
          continue;
        }
        const newVal = ensureSentinel(scrubbed);
        if (DRY_RUN) {
          console.log(`  [DRY] [${pack.metadata.id}] ${doc.name}: ${JSON.stringify(hits)}`);
        } else {
          await doc.update({ "system.description.value": newVal });
          console.log(`  ✓ [${pack.metadata.id}] ${doc.name}: ${JSON.stringify(hits)}`);
        }
        packTouched++;
        for (const k in hits) totalHits[k] = (totalHits[k] ?? 0) + hits[k];
      }
    } catch (e) { console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`); }
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: true });
  }

  // ── Actor pass ──────────────────────────────────────────────────────────
  let actorTouched = 0, actorAlreadyClean = 0, actorSkipped = 0;
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (!SCAN_TYPES.has(item.type)) continue;
      const orig = item.system?.description?.value ?? "";
      if (!orig) continue;
      if (orig.includes(SENTINEL)) { actorAlreadyClean++; continue; }
      const { value: scrubbed, hits } = scrub(orig);
      if (Object.keys(hits).length === 0) { actorSkipped++; continue; }
      const newVal = ensureSentinel(scrubbed);
      if (DRY_RUN) {
        console.log(`  [DRY] [actor:${actor.name}] ${item.name}: ${JSON.stringify(hits)}`);
      } else {
        await item.update({ "system.description.value": newVal });
        console.log(`  ✓ [actor:${actor.name}] ${item.name}: ${JSON.stringify(hits)}`);
      }
      actorTouched++;
      for (const k in hits) totalHits[k] = (totalHits[k] ?? 0) + hits[k];
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n=== Phase 5 D&D vocab scrub — totals by category ===");
  for (const [k, n] of Object.entries(totalHits).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`);
  }
  console.log(`\nPack: ${packTouched} touched, ${packSkipped} clean already (no D&D vocab), ${packAlreadyClean} previously scrubbed.`);
  console.log(`Actor: ${actorTouched} touched, ${actorSkipped} clean, ${actorAlreadyClean} previously scrubbed.`);

  ui.notifications.info(
    DRY_RUN
      ? `Phase 5 scrub DRY RUN: ${packTouched + actorTouched} items WOULD be patched. See console.`
      : `Phase 5 scrub complete: ${packTouched + actorTouched} items patched. See console for breakdown.`
  );
  console.log("DONE");
})();
