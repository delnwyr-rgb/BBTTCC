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
  const ICON_BASE = "art/bbttcc/GOTTGAIT/Bad Eden%20Button%20Icons";

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
    const convs = [];   // type conversions — delete+recreate (see applyTo)
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
        // v14: in-place type updates trip the ForcedReplacement guard — and
        // even "==system" crashes in the unlinked-token delta cascade. So:
        // delete + re-create with keepId (type never "changes").
        convs.push({ it, v });
        // Print the original prose so the authored stats can be verified.
        const txt = (it.system?.description?.value ?? it.system?.body ?? "").replace(/<[^>]*>/g, " ").trim();
        console.log(`── ${actor.name} · ${it.name} — ORIGINAL TEXT:\n${txt || "(no description found)"}\n`);
      }
      if (Object.keys(u).length) { u._id = it.id; ups.push(u); }
    }
    return { ups, convs };
  };
  const applyTo = async (actor, { ups, convs }) => {
    if (ups.length && !DRY_RUN) await actor.updateEmbeddedDocuments("Item", ups);
    for (const { it, v } of convs) {
      console.log(`[conv] ${actor.name} · ${it.name}: ${it.type} → ${v.type}`);
      if (DRY_RUN) continue;
      const data = it.toObject();
      data.type = v.type;
      data.system = v.system;
      await it.delete();
      await actor.createEmbeddedDocuments("Item", [data], { keepId: true });
    }
  };

  let worldActors = 0, worldItems = 0, packActors = 0, packItems = 0;
  // npcs compendium actors (kept in sync where present)
  const pack = game.packs.get("bbttcc-master-content.npcs");
  if (pack) {
    const wasLocked = pack.locked;
    if (wasLocked && !DRY_RUN) await pack.configure({ locked: false });
    for (const actor of await pack.getDocuments()) {
      const r = updatesFor(actor);
      if (!r.ups.length && !r.convs.length) continue;
      packActors++; packItems += r.ups.length + r.convs.length;
      console.log(`[pack] ${actor.name}: ${[...r.ups.map(u => actor.items.get(u._id)?.name), ...r.convs.map(c => c.it.name)].join(", ")}`);
      await applyTo(actor, r);
    }
    if (wasLocked && !DRY_RUN) await pack.configure({ locked: true });
  }
  // world actors — npc + character + BOSS (first run missed bosses: the
  // Valhaulan Spark Adept / Gilbert tier live as type "boss").
  for (const actor of game.actors) {
    if (!["npc", "character", "boss"].includes(actor.type)) continue;
    const r = updatesFor(actor);
    if (!r.ups.length && !r.convs.length) continue;
    worldActors++; worldItems += r.ups.length + r.convs.length;
    console.log(`[world] ${actor.name}: ${[...r.ups.map(u => actor.items.get(u._id)?.name), ...r.convs.map(c => c.it.name)].join(", ")}`);
    await applyTo(actor, r);
  }

  // ── Diagnostic: where do the target names actually live, and why were any
  //    skipped? Prints every world item matching a target name with its
  //    actor type + skip reason — so a 0-hit run explains itself.
  {
    const targets = new Set([...Object.keys(AREAS), ...Object.keys(ICONS), ...Object.keys(VALHALLA)]);
    console.log("── diagnostic: target-name locations across ALL world actors ──");
    for (const actor of game.actors) {
      for (const it of actor.items) {
        if (!targets.has(it.name)) continue;
        const reasons = [];
        const area = AREAS[it.name];
        if (area) {
          const cur = it.system?.manifestation?.area;
          reasons.push((cur?.shape === area.shape && Number(cur?.size) === area.size) ? "area ✓ already set" : "area MISSING");
        }
        const icon = ICONS[it.name];
        if (icon) reasons.push(isPlaceholder(it.img) ? "icon would apply" : `icon skipped (img=${it.img?.slice(0, 40)})`);
        if (VALHALLA[it.name]) reasons.push(it.type === "power" ? "valhalla ✓ already power" : `valhalla CONVERT (type=${it.type})`);
        console.log(`  [${actor.type}] ${actor.name} · ${it.name} → ${reasons.join(" · ")}`);
      }
    }
  }
  console.log(`=== wire-creature-aoe-and-valhalla ${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} ===`);
  console.log(`world: ${worldActors} actors / ${worldItems} items · pack: ${packActors} actors / ${packItems} items`);
  ui.notifications.info(`${DRY_RUN ? "[DRY RUN] " : ""}AoE/icon/Valhalla wiring: world ${worldItems} items, pack ${packItems} items.${DRY_RUN ? " Check console, then set DRY_RUN=false." : " F5 to load."}`);
})();
