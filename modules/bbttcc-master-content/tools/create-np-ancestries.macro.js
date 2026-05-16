/* BBTTCC — Create Non-Playable Ancestries content (Dragon, Devil, Angel, Eidolon)
 *
 * One-shot macro. Run from Foundry: paste into a Script Macro and execute.
 * Idempotent: skips ancestries whose base species already exists in the pack.
 *
 * Creates 20 items (4 ancestries × 1 base species + 4 tier feat features) in:
 *   bbttcc-master-content.ancestries
 *
 * Pairs with:
 *   - bbttcc-raid/scripts/affiliation-op-table.enhancer.js
 *     (ANCESTRY_TABLE has matching keys: dragon, devil/infernal, angel/empyrean,
 *      eidolon/outsider — engine resolves both base + tier-suffixed names)
 *   - NPC sheet "Affiliations" card + Ancestry chooser button (via bbttcc-auto-link)
 *
 * 2026-05-15 NPC Affiliation Integration sprint, Phase F.
 */
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error?.(`Pack ${PACK_ID} not found.`);
  if (pack.locked) return ui.notifications?.error?.(`Pack ${PACK_ID} is locked. Unlock in Compendium settings, then re-run.`);

  // -------- Per-ancestry definitions --------
  // Each ancestry: identifier (lowercase slug — matches engine table), label,
  // size, lore, then 4 tier feature objects (T1..T4). Op-contribution flag is
  // the static-table fallback in case someone disables the engine table.

  const NP = [
    {
      id: "dragon", name: "Dragon", img: "icons/creatures/abilities/dragon-fire-breath-orange.webp",
      size: "med",
      lore: "Born of a draconic bloodline — winged scion of the eldest skies. Wyrmling whelps grow into ancient sovereigns whose mere presence rewrites the weather.",
      opFlag: { violence: 2, logistics: 1 },
      tiers: [
        { id: "dragon_wyrmling",       name: "Dragon: Wyrmling Scales",
          desc: "<p><strong>Wyrmling Scales.</strong> Your scales count as light armor (AC 12 + Dex). When struck by a melee attack, the attacker takes 1 fire damage on a hit.</p>" },
        { id: "dragon_adolescent",     name: "Dragon: Adolescent Breath",
          desc: "<p><strong>Adolescent Breath (1/Scene Break).</strong> Exhale a 15-ft cone of elemental fury. 2d6 fire damage, Dex save (DC 8 + Tier + Body) for half. Damage type chosen at character creation: fire / cold / lightning / acid / poison.</p>",
          uses: { max: "1", period: "sr" } },
        { id: "dragon_elder",          name: "Dragon: Elder Wing",
          desc: "<p><strong>Elder Wing.</strong> Gain a fly speed equal to your walking speed. Once per Soma Break you may take the Dash action as a bonus action while flying.</p>",
          uses: { max: "1", period: "lr" } },
        { id: "dragon_ancient",        name: "Dragon: Ancient Aura",
          desc: "<p><strong>Ancient Aura.</strong> Hostile creatures within 30 ft that can see you must succeed a Wisdom save (DC 8 + Tier + Presence) at the start of their turn or be Frightened of you until the end of their next turn. Once frightened by your aura, a creature is immune for 24 hours.</p>" }
      ]
    },
    {
      id: "devil", name: "Devil (Infernal)", img: "icons/creatures/magical/spirit-fire-orange.webp",
      size: "med",
      lore: "Infernal bloodline — bound to the Hells through pact, descent, or curse. Cunning negotiators whose smiles always cost more than the asking price.",
      opFlag: { violence: 1, intrigue: 1 },
      tiers: [
        { id: "devil_lesser",          name: "Devil: Lesser Brand",
          desc: "<p><strong>Lesser Brand.</strong> You know the Infernal language and gain proficiency in Persuasion or Deception (your choice). Resistance to fire damage.</p>" },
        { id: "devil_pactbinder",      name: "Devil: Pactbinder",
          desc: "<p><strong>Pactbinder (1/Soma Break).</strong> When you secure a willing verbal agreement with a creature, both parties become magically bound for 24 hours. Breaking the pact deals 4d6 psychic damage to the breaker.</p>",
          uses: { max: "1", period: "lr" } },
        { id: "devil_archduke",        name: "Devil: Archduke's Tongue",
          desc: "<p><strong>Archduke's Tongue.</strong> When you make a Charisma (Persuasion or Deception) check, you may roll twice and take the better. You also know whenever a creature within 30 ft tells a deliberate lie.</p>" },
        { id: "devil_sovereign",       name: "Devil: Sovereign of Hells",
          desc: "<p><strong>Sovereign of Hells (1/Soma Break).</strong> Compel a creature you have made eye contact with to obey one direct command (Wis save DC 8 + Tier + Presence to resist). The command must not be self-destructive. Your fire resistance becomes immunity.</p>",
          uses: { max: "1", period: "lr" } }
      ]
    },
    {
      id: "angel", name: "Angel (Empyrean)", img: "icons/magic/holy/angel-winged-humanoid-blue.webp",
      size: "med",
      lore: "Empyrean lineage — celestial blood that sings in the marrow. Diplomats, healers, witnesses; the Pleroma is their kindred and their burden.",
      opFlag: { diplomacy: 1, faith: 1 },
      tiers: [
        { id: "angel_lesser",          name: "Angel: Empyrean Spark",
          desc: "<p><strong>Empyrean Spark.</strong> You know the Celestial language. Resistance to radiant damage. You can shed dim light in a 10-ft radius at will.</p>" },
        { id: "angel_grace",           name: "Angel: Grace Touch",
          desc: "<p><strong>Grace Touch (Tier uses/Soma Break).</strong> Touch a creature as an action; restore HP equal to 1d6 + your Spirit modifier. The healing also ends one disease or one effect inflicting blindness or deafness.</p>",
          uses: { max: "@details.tier", period: "lr" } },
        { id: "angel_seraph",          name: "Angel: Seraphic Wings",
          desc: "<p><strong>Seraphic Wings.</strong> Manifest radiant wings as a bonus action; gain a fly speed equal to your walking speed for 1 minute. Usable Tier times per Soma Break.</p>",
          uses: { max: "@details.tier", period: "lr" } },
        { id: "angel_archon",          name: "Angel: Archon's Word",
          desc: "<p><strong>Archon's Word (1/Soma Break).</strong> Speak a word of binding truth as an action. Creatures of your choice within 30 ft must Cha save (DC 8 + Tier + Spirit) or be unable to speak a deliberate lie for 1 minute. Your radiant resistance becomes immunity.</p>",
          uses: { max: "1", period: "lr" } }
      ]
    },
    {
      id: "eidolon", name: "Eidolon (Outsider)", img: "icons/magic/perception/silhouette-stealth-shadow.webp",
      size: "med",
      lore: "Catch-all lineage for things from outside — dream-born, void-touched, conceptual entities wearing flesh as costume. Reality is a suggestion they entertain politely.",
      opFlag: { intrigue: 1, faith: 1 },
      tiers: [
        { id: "eidolon_lesser",        name: "Eidolon: Outsider Cast",
          desc: "<p><strong>Outsider Cast.</strong> You do not need to eat, sleep, or breathe. You appear subtly wrong to careful observers (Perception DC 15 to notice). Resistance to psychic damage.</p>" },
        { id: "eidolon_whisper",       name: "Eidolon: Whisper Walk",
          desc: "<p><strong>Whisper Walk (1/Scene Break).</strong> Step sideways out of consensus reality as a bonus action; you become invisible and pass through one wall up to 5 ft thick before reappearing on the other side. Concentration not required.</p>",
          uses: { max: "1", period: "sr" } },
        { id: "eidolon_voice",         name: "Eidolon: Concept-Voice",
          desc: "<p><strong>Concept-Voice (1/Scene Break).</strong> Name a single concept as an action (a fear, a memory, a desire). One creature within 30 ft that can hear you takes 4d6 psychic damage and is Charmed or Frightened by the named concept until the end of your next turn (Wis save DC 8 + Tier + Presence for half damage and to negate the condition).</p>",
          uses: { max: "1", period: "sr" } },
        { id: "eidolon_sovereign",     name: "Eidolon: Sovereign of Things",
          desc: "<p><strong>Sovereign of Things (1/Soma Break).</strong> Declare an object within 60 ft to be 'one of yours.' For 24 hours that object cannot be used effectively against you (attack rolls with it have disadvantage; spells cast through it must save vs your spell DC or fizzle). Your psychic resistance becomes immunity.</p>",
          uses: { max: "1", period: "lr" } }
      ]
    }
  ];

  // -------- Helpers --------
  // Generate exactly 16 lowercase-alphanumeric chars — Foundry's strict ID
  // format. Avoids any version-specific quirks of foundry.utils.randomID()
  // (some versions ignore the length arg or include disallowed chars).
  function _id16() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 16; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  }

  // `_stats.lastModifiedBy` requires a real User ID (16-char alphanumeric).
  // The cryptidkin sample literal "BBTTCCANCv2APPLY" is exactly 16 chars and
  // passes the regex by coincidence, but mismatched-length markers fail
  // validation. Use the current user's ID for safety.
  const STAMP = {
    "_stats": {
      compendiumSource: null, duplicateSource: null, exportSource: null,
      coreVersion: "13.351", systemId: "fourththing", systemVersion: "1.0.0",
      createdTime: Date.now(), modifiedTime: Date.now(),
      lastModifiedBy: game.user?.id || _id16()
    },
    "ownership": { "default": 0 }
  };

  function tierFeatDoc(ancestry, tierIdx, tierDef) {
    // No dnd5e-style system.uses — fourththing routes per-use via
    // FEATURE_ROUTER → CHAR_OPT_ABILITIES (see
    // bbttcc-master-content/scripts/np-ancestries-router.js). The identifier
    // below is what the router matches on. Soma Break / Scene Break tracking
    // is flag-based at flags.fourththing.disciplineUsed.{key}.
    //
    // Critical for sheet rendering (verified vs. native Menhirkin pattern):
    //   - system.category: "technique"   → buckets into the Techniques section
    //                                      where the ▶ Use button renders.
    //                                      "feature" silently sends items to
    //                                      the "other" group with no button.
    //   - flags.fourththing.principleSource: "ancestry"
    //                                    → routes the item into the Ancestry
    //                                      group on the Principles tab (see
    //                                      module.js _groupForFeature line 5498).
    return {
      _id: _id16(),
      name: tierDef.name,
      type: "feat",
      img: ancestry.img,
      system: {
        description: { value: tierDef.desc, chat: "" },
        source: { custom: "BBTTCC", rules: "2024", revision: 1, book: "", license: "" },
        advancement: {},
        identifier: tierDef.id.replace(/_/g, "-"),
        requirements: ancestry.name,
        prerequisites: { items: [], repeatable: false, level: null },
        uses: { spent: 0, recovery: [], max: "" },
        activities: {},
        category: "technique",
        tags: [],
        type: { value: "", subtype: "" },
        properties: []
      },
      effects: [],
      flags: {
        dnd5e: { originType: "feat" },
        bbttcc: {
          kind: ancestry.id, lineage: ancestry.name,
          feature: tierDef.id.split("_").slice(1).join("_"),
          tierLevel: tierIdx, version: "1.0.0", date: "2026-05-15",
          npAncestry: true
        },
        fourththing: { principleSource: "ancestry" }
      },
      ...STAMP
    };
  }

  function baseSpeciesDoc(ancestry, tierItemUuids) {
    // Build advancement: Size + 4 ItemGrants for the tier features
    const advancement = [
      {
        _id: _id16(),
        type: "Size",
        configuration: { sizes: [ancestry.size] },
        level: 0, title: "", hint: `${ancestry.name} (size: ${ancestry.size}).`, value: {}
      },
      ...tierItemUuids.map((uuid, i) => ({
        _id: _id16(),
        type: "ItemGrant",
        configuration: { items: [{ uuid, optional: false }], optional: false, spell: null },
        value: {}, level: 0,
        title: `${ancestry.name} Tier ${i + 1}`,
        hint: `Grants the tier ${i + 1} ${ancestry.name} feature.`
      }))
    ];

    return {
      _id: _id16(),
      name: ancestry.name,
      type: "species",
      img: ancestry.img,
      system: {
        description: { value: `<p><em>${ancestry.lore}</em></p>`, chat: "" },
        source: { custom: "BBTTCC", rules: "2024", revision: 1, book: "", license: "" },
        advancement,
        identifier: ancestry.id,
        category: "ancestry",
        properties: [],
        tags: [],
        type: { value: "humanoid", subtype: ancestry.name }
      },
      effects: [],
      flags: {
        dnd5e: { originType: "species" },
        // bbttcc.kind MUST be "ancestry" (not the ancestry slug) — that's the
        // bucket label the BBTTCC integration looks for; matches Menhirkin's
        // canonical shape. The ancestry slug lives on flags.bbttcc.lineage.
        bbttcc: {
          kind: "ancestry",
          lineage: ancestry.id,
          version: "1.0.0",
          date: "2026-05-15",
          npAncestry: true
        },
        // principleSource is what _groupForFeature reads to route descendant
        // items into the Ancestry group on the Principles tab.
        fourththing: { principleSource: "ancestry" },
        // Per-item OP-contribution override (mirrors engine static table)
        "bbttcc-factions": { opContribution: ancestry.opFlag }
      },
      ...STAMP
    };
  }

  // -------- Idempotency check --------
  const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier"] });
  const existingByIdent = new Set(idx.map(e => String(foundry.utils.getProperty(e, "system.identifier") || "")));

  const summary = [];
  for (const ancestry of NP) {
    // No top-level skip on existing — fall through to Phase 1 (per-tier patch)
    // and Phase 2 (base species patch). Both phases are individually idempotent
    // and IN-PLACE patch existing items so re-runs heal the rendering chain.

    // Phase 1: create the 4 tier feats first so we can capture their UUIDs.
    // If a tier feat already exists, UPDATE its uses/description in place so
    // re-runs pick up content changes (e.g. adding the uses pip).
    const tierUuids = [];
    let tierFail = null;
    let tierUpdated = 0;
    for (let i = 0; i < ancestry.tiers.length; i++) {
      const tierDef = ancestry.tiers[i];
      const ident = tierDef.id.replace(/_/g, "-");

      if (existingByIdent.has(ident)) {
        const found = idx.find(e => String(foundry.utils.getProperty(e, "system.identifier") || "") === ident);
        if (found?._id) {
          tierUuids.push(`Compendium.${PACK_ID}.Item.${found._id}`);
          // In-place patch: refresh uses + description + critical sheet-render
          // fields (category, principleSource) so existing items get the fix
          // without delete + recreate.
          try {
            const live = await pack.getDocument(found._id);
            const data = tierFeatDoc(ancestry, i + 1, tierDef);
            await live.update({
              "system.uses": data.system.uses,
              "system.description.value": data.system.description.value,
              "system.category": data.system.category,
              "flags.fourththing.principleSource": "ancestry"
            });
            tierUpdated++;
          } catch (e) {
            console.warn("BBTTCC NP-Ancestries — tier in-place update failed", tierDef, e);
          }
        }
        continue;
      }

      try {
        const data = tierFeatDoc(ancestry, i + 1, tierDef);
        const created = await Item.create(data, { pack: PACK_ID });
        if (!created?.uuid) throw new Error("Item.create returned no uuid");
        tierUuids.push(created.uuid);
      } catch (e) {
        tierFail = `tier ${i + 1} (${tierDef.id}): ${e?.message || e}`;
        console.error("BBTTCC NP-Ancestries — tier create failed", tierDef, e);
        break;
      }
    }

    if (tierFail) {
      summary.push(`• ${ancestry.name} — ERROR creating ${tierFail}`);
      continue;
    }
    if (tierUuids.length !== 4) {
      summary.push(`• ${ancestry.name} — ERROR: only ${tierUuids.length}/4 tier feats prepared. Aborting base species creation.`);
      continue;
    }

    // Phase 2: base species — create OR patch in place if already present.
    // The patch normalizes flags.bbttcc.kind ("ancestry") + system.category
    // ("ancestry") + flags.fourththing.principleSource ("ancestry") on
    // existing pack items so re-runs heal the rendering chain.
    const baseExists = existingByIdent.has(ancestry.id);
    if (baseExists) {
      const found = idx.find(e => String(foundry.utils.getProperty(e, "system.identifier") || "") === ancestry.id);
      let basePatched = false;
      if (found?._id) {
        try {
          const live = await pack.getDocument(found._id);
          const data = baseSpeciesDoc(ancestry, tierUuids);
          await live.update({
            "system.category": data.system.category,
            "flags.bbttcc.kind": "ancestry",
            "flags.bbttcc.lineage": ancestry.id,
            "flags.fourththing.principleSource": "ancestry",
            "flags.bbttcc-factions.opContribution": ancestry.opFlag
          });
          basePatched = true;
        } catch (e) {
          console.warn("BBTTCC NP-Ancestries — base in-place update failed", ancestry, e);
        }
      }
      summary.push(`• ${ancestry.name} — base existed${basePatched ? " + patched (kind/category/principleSource)" : ""}; ${tierUpdated}/4 tier feats patched`);
      continue;
    }

    try {
      await Item.create(baseSpeciesDoc(ancestry, tierUuids), { pack: PACK_ID });
      summary.push(`• ${ancestry.name} — CREATED (1 base + 4 tier feats)`);
    } catch (e) {
      summary.push(`• ${ancestry.name} — ERROR creating base species: ${e?.message || e}`);
      console.error("BBTTCC NP-Ancestries — base species create failed", ancestry, e);
    }
  }

  const msg = `BBTTCC NP Ancestries macro complete:\n${summary.join("\n")}`;
  console.log(msg);
  ChatMessage.create({ content: `<pre>${msg.replace(/</g, "&lt;")}</pre>`, whisper: [game.user.id] });
  ui.notifications?.info?.("BBTTCC NP Ancestries macro complete — see chat for summary.");
})();
