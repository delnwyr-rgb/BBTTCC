// Bad Eden — Phase 7 Seed: Technomagical Items (2026-05-10)
// ─────────────────────────────────────────────────────────────────────────────
// Seeds 17 technomagical items into game.items (world). Each item carries:
//   - flags.fourththing.rfi.item   (tier, frame, bound, materialOf recipe)
//   - flags.fourththing.rfi.item.tech (kind, charges, fuel, attunement, etc.)
// Prices auto-stamp via the preCreateItem hook in rfi-pricing.js (× 2 tech
// multiplier). Run price-audit.macro.js afterward to confirm clean state.
//
// Every recipe includes ≥ 1 unit of one of yesodium / witness-glass /
// hex-glyph-plate / pre-fall-component (rubric §6 validator).
//
// Knobs:
//   DRY_RUN — true: log what would be created, don't write
//   SKIP_EXISTING — true: don't recreate items whose name already exists
//
// Items land in `game.items` (world). Move them into a pack later via
// drag-drop or a separate pack-seed macro.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const DRY_RUN = false;
  const SKIP_EXISTING = true;

  // ── 17-item roster — keep recipes synced with the materials roster in
  // bbttcc-master-content and the §6 validator (≥ 1 required tech material per
  // recipe: yesodium / witness-glass / hex-glyph-plate / pre-fall-component).
  const ITEMS = [
    // ────────────────────────────── T1 (5) ──────────────────────────────
    {
      name: "Septlight Lantern",
      type: "gear",
      img:  "icons/sundries/lights/lantern-iron-yellow.webp",
      blurb: "A hex-glass lantern that burns on stored Yesodium light. Three rests of bright, septlight-clean illumination per charge cycle.",
      rfi:  { tier: "I", frame: "tool", bound: "free",
              materialOf: [{ key: "yesodium", qty: 1 }, { key: "witness-glass", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 3, max: 3, recoverPer: "soma-break" },
              failure: "inert", origin: "septcraft" }
    },
    {
      name: "Witness-Decoy Pin",
      type: "gear",
      img:  "icons/sundries/misc/pin-bronze.webp",
      blurb: "Snap the pin — for one round, a witness-glass simulacrum walks where you stood. Single use; the pin shatters.",
      rfi:  { tier: "I", frame: "consumable", bound: "free", charges: 1,
              materialOf: [{ key: "witness-glass", qty: 1 }, { key: "brass-thumb-bell", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 1, max: 1, recoverPer: "manual" },
              failure: "inert", origin: "hex-script" }
    },
    {
      name: "Hex-Script Tinder Box",
      type: "gear",
      img:  "icons/sundries/lights/torch-brown.webp",
      blurb: "A tin box stamped with hex-glyphs. The fire it kindles refuses mundane extinguishment until the scribed mark is broken.",
      rfi:  { tier: "I", frame: "tool", bound: "free",
              materialOf: [{ key: "hex-glyph-plate", qty: 1 }, { key: "ash-wood", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 5, max: 5, recoverPer: "scene" },
              failure: "misfire", origin: "hex-script" }
    },
    {
      name: "Prayer-Resin Censer",
      type: "gear",
      img:  "icons/sundries/lights/incense-burner-brass.webp",
      blurb: "A brass censer whose smoke carries soft-power blessings. Three sanctifications per day; the area resists profanation.",
      rfi:  { tier: "I", frame: "sigil", bound: "free",
              materialOf: [{ key: "prayer-resin", qty: 2 }, { key: "witness-glass", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 3, max: 3, recoverPer: "soma-break" },
              failure: "drain", origin: "septcraft" }
    },
    {
      name: "Vow-Bone Stamp",
      type: "gear",
      img:  "icons/sundries/documents/document-sealed-tan.webp",
      blurb: "Press the carved bone into oath-ink and a document becomes a vow. Breaking the vow blackens the seal — and the breaker.",
      rfi:  { tier: "I", frame: "sigil", bound: "free",
              materialOf: [{ key: "vow-bone", qty: 1 }, { key: "oath-ink", qty: 1 }, { key: "witness-glass", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 1, max: 1, recoverPer: "soma-break" },
              failure: "drain", origin: "septcraft" }
    },

    // ────────────────────────────── T2 (5) ──────────────────────────────
    {
      name: "Hex-Script Pistol",
      type: "weapon",
      img:  "icons/weapons/guns/gun-pistol-flintlock.webp",
      blurb: "A rad-iron flintlock that burns Yesodium dust per shot. Each round inscribes the wound with a small, vicious hex.",
      rfi:  { tier: "II", frame: "weapon", bound: "free",
              materialOf: [{ key: "yesodium", qty: 1 }, { key: "rad-iron", qty: 2 }, { key: "hex-iron-cleat", qty: 1 }] },
      tech: { kind: "fueled",  fuel: { materialKey: "yesodium", perActivation: 1 },
              failure: "misfire", origin: "hex-script" },
      damage:  { formula: "3d6", type: "kinetic" },
      range:   { short: 6, long: 18 }
    },
    {
      name: "Pre-Fall Comm Bead (paired)",
      type: "gear",
      img:  "icons/commodities/gems/pearl-water.webp",
      blurb: "Two crystalline beads, manufactured before the Fall. Pair-linked — speak into one, the other hums in your partner's ear. Range: line-of-thought across one hex.",
      rfi:  { tier: "III", frame: "tool", bound: "attuned",
              materialOf: [{ key: "pre-fall-component", qty: 1 }, { key: "focused-crystal", qty: 1 }] },
      tech: { kind: "linked", charges: { value: 0, max: 0, recoverPer: "manual" },
              attunement: { required: true, slots: 1 },
              failure: "inert", origin: "pre-fall" }
    },
    {
      name: "Witness-Glass Scope",
      type: "gear",
      img:  "icons/tools/scribal/spyglass-bronze.webp",
      blurb: "A short hand-scope. Through the witness-glass lens, illusion thins and concealment glows the color of its weave.",
      rfi:  { tier: "II", frame: "tool", bound: "attuned",
              materialOf: [{ key: "witness-glass", qty: 2 }, { key: "focusing-lens", qty: 1 }] },
      tech: { kind: "attuned", attunement: { required: true, slots: 1 },
              failure: "drain", origin: "witness-forge" }
    },
    {
      name: "Sept-Hush Amulet",
      type: "armor",
      img:  "icons/equipment/neck/amulet-runed-tan.webp",
      blurb: "A worn amulet that swallows sound around the wearer. Three scenes of silence per rest; speech still passes, but boots and breath do not.",
      rfi:  { tier: "II", frame: "armor", bound: "attuned",
              materialOf: [{ key: "witness-glass", qty: 1 }, { key: "sept-tuning-fork", qty: 1 }, { key: "memory-resin", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 3, max: 3, recoverPer: "soma-break" },
              attunement: { required: true, slots: 1 },
              failure: "drain", origin: "septcraft" },
      armor: { guardBonus: 0, evasionBonus: 1, resolveBonus: 1 }
    },
    {
      name: "Vow-Bound Cuffs",
      type: "gear",
      img:  "icons/equipment/wrist/manacles-iron.webp",
      blurb: "Cold-iron cuffs scribed with a vow of stillness. The wearer cannot lie, attack, or flee until they accept the oath, fulfill it, or break it (and themselves).",
      rfi:  { tier: "II", frame: "tool", bound: "free",
              materialOf: [{ key: "vow-bone", qty: 1 }, { key: "cold-iron", qty: 2 }, { key: "sacred-gold", qty: 1 }, { key: "witness-glass", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 1, max: 1, recoverPer: "manual" },
              failure: "drain", origin: "septcraft" }
    },

    // ────────────────────────────── T3 (4) ──────────────────────────────
    {
      name: "Soulbound Hex-Reaver",
      type: "weapon",
      img:  "icons/weapons/swords/sword-broad-engraved-red.webp",
      blurb: "A black-bladed reaver, etched with the wielder's true name. Speaks softly when drawn. Refuses any other grip.",
      rfi:  { tier: "III", frame: "weapon", bound: "soulbound",
              materialOf: [{ key: "hex-glyph-plate", qty: 2 }, { key: "heart-iron", qty: 3 }, { key: "vow-bound-edge", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 5, max: 5, recoverPer: "rest" },
              attunement: { required: true, slots: 1 },
              failure: "drain", origin: "witness-forge", signature: "true-name" },
      damage:  { formula: "3d6 + 3", type: "kinetic" },
      range:   { short: 1, long: 1 }
    },
    {
      name: "Pre-Fall Scanner",
      type: "gear",
      img:  "icons/tools/navigation/compass-brass-blue.webp",
      blurb: "A relic-scanner. Sweep a hex and the device names what's hidden — radiation, waystones, buried tech, sleeping things. Three sweeps per day.",
      rfi:  { tier: "III", frame: "tool", bound: "attuned",
              materialOf: [{ key: "pre-fall-component", qty: 1 }, { key: "focused-crystal", qty: 2 }, { key: "memory-resin", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 3, max: 3, recoverPer: "soma-break" },
              attunement: { required: true, slots: 1 },
              failure: "misfire", origin: "pre-fall" }
    },
    {
      name: "Dream-Cache Regulator",
      type: "gear",
      img:  "icons/magic/control/hypnosis-mesmerism-eye.webp",
      blurb: "A small sigil-pendant tuned to a Dreamwalker's echo-reservoir. Stabilizes banking, prevents spillover during Soma Break.",
      rfi:  { tier: "III", frame: "sigil", bound: "attuned",
              materialOf: [{ key: "tree-of-life-shard", qty: 1 }, { key: "yesodium", qty: 1 }, { key: "marrow-tincture", qty: 1 }, { key: "witness-resin", qty: 1 }] },
      tech: { kind: "attuned", attunement: { required: true, slots: 1 },
              failure: "drain", origin: "septcraft" }
    },
    {
      name: "Oath-Anchor Stone",
      type: "gear",
      img:  "icons/sundries/gaming/rune-stone-tan.webp",
      blurb: "A carved anchorstone bound to a treaty. While the stone is intact, the treaty holds; cracking it pings every signatory across the hex.",
      rfi:  { tier: "III", frame: "sigil", bound: "free",
              materialOf: [{ key: "vow-bone", qty: 1 }, { key: "anchorstone", qty: 2 }, { key: "sacred-gold", qty: 1 }, { key: "witness-glass", qty: 1 }] },
      tech: { kind: "charged", charges: { value: 1, max: 1, recoverPer: "week" },
              failure: "drain", origin: "septcraft" }
    },

    // ────────────────────────────── T4 (3) ──────────────────────────────
    {
      name: "Vow-Bound Forge Core",
      type: "gear",
      img:  "icons/sundries/lights/candle-pillar-white.webp",
      blurb: "A siege-class forge core, bound by oath to a single faction. Installed in a hex, it grants forge-wide crafting bonuses and a Yesodium-burning hum that locals can hear from a mile out.",
      rfi:  { tier: "IV", frame: "sigil", bound: "soulbound",
              materialOf: [{ key: "yesodium", qty: 3 }, { key: "tree-of-life-shard", qty: 1 }, { key: "pre-fall-component", qty: 1 }, { key: "vow-bone", qty: 1 }] },
      tech: { kind: "fueled", fuel: { materialKey: "yesodium", perActivation: 3 },
              attunement: { required: true, slots: 2 },
              failure: "drain", origin: "witness-forge", signature: "siege-bond" }
    },
    {
      name: "Pre-Fall Transmitter",
      type: "gear",
      img:  "icons/sundries/lights/lantern-bullseye-blue.webp",
      blurb: "A relic-grade transmitter. Encrypts faction-wide comms across an entire hex; pre-Fall pattern, Witness-shielded against detection.",
      rfi:  { tier: "IV", frame: "tool", bound: "attuned",
              materialOf: [{ key: "pre-fall-component", qty: 2 }, { key: "hex-glyph-plate", qty: 1 }, { key: "witness-glass", qty: 1 }] },
      tech: { kind: "linked", attunement: { required: true, slots: 1 },
              shielded: true, failure: "inert", origin: "pre-fall" }
    },
    {
      name: "Apex Hex-Engine",
      type: "gear",
      img:  "icons/magic/lightning/orb-ball-blue.webp",
      blurb: "A drum-sized core of Yesodium and pre-Fall salvage. Installed in a war-rig, it transforms the chassis into something the world remembers.",
      rfi:  { tier: "IV", frame: "sigil", bound: "attuned",
              materialOf: [{ key: "yesodium", qty: 2 }, { key: "pre-fall-component", qty: 1 }, { key: "heart-coil", qty: 2 }, { key: "soft-alloy", qty: 3 }] },
      tech: { kind: "fueled", fuel: { materialKey: "yesodium", perActivation: 1 },
              attunement: { required: true, slots: 1 },
              failure: "drain", origin: "pre-fall", signature: "apex-core" }
    }
  ];

  // ── Build creation payloads ──
  const payloads = [];
  for (const it of ITEMS) {
    const existing = SKIP_EXISTING && game.items.find(i => i.name === it.name);
    if (existing) {
      console.debug(`[seed-tech] skip ${it.name} — already exists`);
      continue;
    }

    // Compose the flag-bag. Per the rfi-pricing.js storage convention, tech
    // lives nested INSIDE `flags.fourththing.rfi.item.tech`.
    const rfiItem = { ...it.rfi, tech: it.tech };

    // System data by type.
    const system = (() => {
      if (it.type === "weapon") {
        return {
          category:  "melee",  // updated below if ranged
          intent:    "violence",
          skill:     it.range && it.range.short > 1 ? "firearms" : "melee",
          damage:    { formula: it.damage?.formula || "2d6", attribute: "violence", type: it.damage?.type || "kinetic", track: "integrity" },
          range:     it.range || { short: 1, long: 1 },
          tags:      ["tech"],
          effect:    "",
          flavor:    "",
          description: { value: `<p>${it.blurb}</p>`, chat: "" }
        };
      }
      if (it.type === "armor") {
        return {
          guardBonus:    it.armor?.guardBonus || 0,
          evasionBonus:  it.armor?.evasionBonus || 0,
          resolveBonus:  it.armor?.resolveBonus || 0,
          resistances:   [],
          armorSkill:    "weave",
          equipped:      false,
          tags:          ["tech"],
          category:      "armor",
          source:        "Phase 7 Seed (2026-05-10)",
          description:   { value: `<p>${it.blurb}</p>`, chat: "" }
        };
      }
      // gear default
      return {
        slot:        "misc",
        tags:        ["tech"],
        category:    "gear",
        source:      "Phase 7 Seed (2026-05-10)",
        description: { value: `<p>${it.blurb}</p>`, chat: "" }
      };
    })();

    // Range > 1 ⇒ ranged weapon
    if (it.type === "weapon" && it.range?.short > 1) system.category = "ranged";

    payloads.push({
      name: it.name,
      type: it.type,
      img:  it.img,
      system,
      flags: {
        fourththing: {
          rfi: {
            item: rfiItem
          }
        }
      }
    });
  }

  // ── Create ──
  console.log(`[seed-tech] ${DRY_RUN ? "DRY-RUN" : "WET-RUN"} will create ${payloads.length} item(s)`);
  if (payloads.length) {
    console.table(payloads.map(p => ({ name: p.name, type: p.type, tier: p.flags.fourththing.rfi.item.tier, frame: p.flags.fourththing.rfi.item.frame })));
  }

  if (!DRY_RUN && payloads.length) {
    const created = await Item.createDocuments(payloads);
    console.log(`[seed-tech] created ${created.length} item(s) in game.items`);
    ui.notifications?.info(`Seeded ${created.length} technomagical item(s). Run price-audit.macro.js to confirm pricing.`);
  } else if (DRY_RUN) {
    ui.notifications?.info(`DRY-RUN: would create ${payloads.length} technomagical item(s). Flip DRY_RUN = false to commit.`);
  } else {
    ui.notifications?.info("No new items — all 17 already exist (SKIP_EXISTING).");
  }
})();
