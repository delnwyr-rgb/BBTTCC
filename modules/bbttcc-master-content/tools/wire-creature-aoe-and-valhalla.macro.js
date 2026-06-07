// wire-creature-aoe-and-valhalla.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// Playtest 2026-06-06 batch:
//   (1) AREA — stamps `system.manifestation.area` onto the wired AoE creature
//       abilities (matched by item NAME) so the Strike button now drops a
//       placeable template + auto-targets everyone caught (engage-path support
//       shipped in module.js the same day). Frag Grenade finally has a template.
//   (2) ICONS — fills in button images for abilities whose MAP entry was null
//       (Gilbert's three) or that still wear a generic icons/* placeholder.
//   (3) VALHALLA SPARK ADEPT — rewrites "Yesodic Ward" and "Disorienting
//       Pulse (Recharge 5–6)" from narrative features into automated POWER
//       items (the NPC sheet's Cast button runs the full castManifestation
//       pipeline: template, per-target saves, damage Apply buttons, ward AEs).
//
// DRY_RUN=true first — it PRINTS each matched item incl. the CURRENT description
// text of the two Valhalla abilities so you can sanity-check the authored stats
// (tunable in VALHALLA below) against the original prose. Set DRY_RUN=false to
// apply. F5 afterwards. NON-DESTRUCTIVE elsewhere: only touches listed names.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const ICON_BASE = "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons";

  // ── (1) AoE areas, by item name. shape: "sphere" (radius) | "cone".
  //     Matches the curated CONV table in build-npc-actions.mjs.
  const AREAS = {
    "Moment Shear (Recharge 5–6)":            { shape: "sphere", size: 20 },
    "Ruin-Spore Exhalation (Recharge 5–6)":   { shape: "cone",   size: 15 },
    "Wrong-Wave":                             { shape: "sphere", size: 10 },
    "Concession Catastrophe (Recharge 5-6)":  { shape: "sphere", size: 20 },
    "Not Ready For Guests!":                  { shape: "sphere", size: 20 },
    "Fragmentation Grenade (1/Day)":          { shape: "sphere", size: 10 }
  };

  // ── (2) Icon fill-ins (these had icon:null in animate-npc-embedded MAP, or
  //     report as imageless at the table). Applied when img is empty/generic.
  const ICONS = {
    "Concession Catastrophe (Recharge 5-6)":  "BBTTCC_button_icon_bomb_1.png",
    "Not Ready For Guests!":                  "BBTTCC_button_icon_fear_1.png",
    "Weaponized Shame":                       "BBTTCC_button_icon_speech_2.png",
    "Fragmentation Grenade (1/Day)":          "BBTTCC_button_icon_bomb_1.png",
    "Yesodic Ward":                           "BBTTCC_button_icon_shield_1.png",
    "Disorienting Pulse (Recharge 5–6)":      "BBTTCC_button_icon_mental.png"
  };

  // ── (3) Valhalla Spark Adept rewires. OWNER-TUNABLE — DRY RUN prints the
  //     items' current description text; adjust dice/DC/effects to match.
  const VALHALLA = {
    "Disorienting Pulse (Recharge 5–6)": {
      type: "power",
      system: {
        intent: "presence", channel: "soul", mode: "hermetic",
        clarityRequired: 0, noiseGain: 0,
        activation: { type: "action", consumePool: false },
        target: "multiple", range: "near",
        damageRoll: { op: "damage", number: 2, die: "d6", attribute: "", type: "psychic", flavor: "", track: "stress" },
        damageParts: [],
        tags: ["npc-action-wired", "aoe", "recharge-5-6"],
        category: "manifestation",
        manifestation: {
          tier: 1, family: "working", form: "field", function: "command",
          stability: "instant", interactionModel: "event",
          concept: "A pulse of yesodic static that scrambles inner footing.",
          costType: "none", costValue: 0, duration: "instant",
          targetText: "Each creature within 15 ft.", rangeAreaText: "15-ft. radius pulse",
          rangeFt: 15, scale: "personal",
          area: { shape: "sphere", size: 15 },
          activation: { type: "action", consumePool: false },
          resolution: {
            shape: "save", saveAttribute: "soul",
            saveDcMode: "fixed", saveDcFixed: 14, onSave: "half", saveByPrompt: false
          },
          appliedStates: {
            states: { staggered: true },
            duration: "1-round", saveEachRound: true,
            saveAttribute: "soul", saveDcMode: "fixed", saveDcFixed: 14,
            saveAttributeOverrides: {}
          },
          appliedEffects: { modifiers: [], resists: [], immunes: [] }
        },
        description: { value: "<p><strong>Area Attack (Recharge 5–6).</strong> Each creature within 15 ft. saves <strong>Soul</strong> vs DC 14. Hit: <code>2d6</code> psychic (Stress); half on success. On a failure the target is also <em>staggered</em> until the end of its next turn (save each round).</p><p><em>The Spark flares wrong — every inner compass spins at once.</em></p>", chat: "" }
      }
    },
    "Yesodic Ward": {
      type: "power",
      system: {
        intent: "presence", channel: "soul", mode: "hermetic",
        clarityRequired: 0, noiseGain: 0,
        activation: { type: "bonus", consumePool: false },
        target: "single", range: "near",
        damageRoll: { op: "none", number: 0, die: "d6", attribute: "", type: "sephirotic", flavor: "", track: "integrity" },
        damageParts: [],
        tags: ["npc-action-wired", "ward", "beneficial"],
        category: "manifestation",
        manifestation: {
          tier: 1, family: "working", form: "sigil", function: "protect",
          stability: "stable", interactionModel: "mark",
          concept: "A foundation-sigil that steadies whoever it is laid upon.",
          costType: "none", costValue: 0, duration: "scene",
          targetText: "Self or one ally within reach", rangeAreaText: "Touch / self",
          rangeFt: 5, scale: "personal",
          area: { shape: "none", size: 0 },
          activation: { type: "bonus", consumePool: false },
          resolution: { shape: "auto" },
          appliedStates: {
            states: {}, duration: "1-scene", saveEachRound: false,
            saveAttribute: "body", saveDcMode: "fixed", saveDcFixed: 14,
            saveAttributeOverrides: {}
          },
          appliedEffects: {
            modifiers: [ { stat: "guard", op: "+", value: 1 }, { stat: "resolve", op: "+", value: 1 } ],
            resists: ["qliphothic"],
            immunes: []
          }
        },
        description: { value: "<p><strong>Ward (bonus action).</strong> Lay a yesodic sigil on yourself or one ally within reach: <strong>+1 Guard, +1 Resolve</strong> and <strong>resist qliphothic</strong> damage for the scene (visible Active Effect; buffs auto-apply).</p><p><em>Foundation holds, even here.</em></p>", chat: "" }
      }
    }
  };

  const isPlaceholder = (img) => !img || /^icons\//.test(decodeURIComponent(img));

  const updatesFor = (actor) => {
    const ups = [];
    for (const it of actor.items) {
      const u = {};
      const area = AREAS[it.name];
      if (area) {
        const cur = it.system?.manifestation?.area;
        if (!(cur?.shape === area.shape && Number(cur?.size) === area.size)) {
          u["system.manifestation.area"] = { shape: area.shape, size: area.size };
        }
      }
      const icon = ICONS[it.name];
      if (icon && isPlaceholder(it.img)) u["img"] = ICON_BASE + "/" + icon;
      const v = VALHALLA[it.name];
      if (v && it.type !== "power") {
        // Foundry v14: type changes require the system field force-replaced
        // (the "==" prefix operator), not diff-merged.
        u["type"] = v.type;
        u["==system"] = v.system;
        // Print the original prose so the authored stats can be verified.
        const txt = (it.system?.description?.value ?? it.system?.body ?? "").replace(/<[^>]*>/g, " ").trim();
        console.log(`── ${actor.name} · ${it.name} — ORIGINAL TEXT:\n${txt || "(no description found)"}\n`);
      }
      if (Object.keys(u).length) { u._id = it.id; ups.push(u); }
    }
    return ups;
  };

  let worldActors = 0, worldItems = 0, packActors = 0, packItems = 0;
  // npcs compendium actors (kept in sync where present)
  const pack = game.packs.get("bbttcc-master-content.npcs");
  if (pack) {
    const wasLocked = pack.locked;
    if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
    for (const actor of await pack.getDocuments()) {
      const ups = updatesFor(actor);
      if (!ups.length) continue;
      packActors++; packItems += ups.length;
      console.log(`[pack] ${actor.name}: ${ups.map(u => actor.items.get(u._id)?.name).join(", ")}`);
      if (!DRY_RUN) await actor.updateEmbeddedDocuments("Item", ups);
    }
    if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
  }
  // world NPC actors
  for (const actor of game.actors) {
    if (actor.type !== "npc" && actor.type !== "character") continue;
    const ups = updatesFor(actor);
    if (!ups.length) continue;
    worldActors++; worldItems += ups.length;
    console.log(`[world] ${actor.name}: ${ups.map(u => actor.items.get(u._id)?.name).join(", ")}`);
    if (!DRY_RUN) await actor.updateEmbeddedDocuments("Item", ups);
  }
  console.log(`=== wire-creature-aoe-and-valhalla ${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} ===`);
  console.log(`world: ${worldActors} actors / ${worldItems} items · pack: ${packActors} actors / ${packItems} items`);
  ui.notifications.info(`${DRY_RUN ? "[DRY RUN] " : ""}AoE/icon/Valhalla wiring: world ${worldItems} items, pack ${packItems} items.${DRY_RUN ? " Check console, then set DRY_RUN=false." : " F5 to load."}`);
})();
