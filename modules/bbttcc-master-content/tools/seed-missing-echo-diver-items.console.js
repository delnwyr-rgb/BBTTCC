// Seed any missing Echo-Diver items into bbttcc-master-content.ancestries.
// Idempotent — skips already-present (matched by system.identifier).
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const SENTINEL_ED = "data-ft-canon-echo-diver=\"v1\"";

  const ITEMS = [
    {
      _id: "ECHODIVERSPC0001",
      name: "Echo-Diver",
      type: "species",
      identifier: "echo_diver",
      requirements: "",
      level: null,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Echo_Diver_1.png",
      bbttccFlag: { kind: "echo_diver", feature: "core", lineage: "Echo-Diver", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL_ED} style="display:none"></div>
<p><em>"The lions are gone. The wolves are gone. The kings are gone. We're still here. Think about what that means."</em></p>
<p>Echo-Divers are the rats of the new world — and they say it with pride. A rat survives what a lion can't. A rat is already moving when the ceiling falls. A rat threads a collapsing vault without ever touching a trigger plate.</p>
<p><strong>Creature Type.</strong> Humanoid (Echo-Diver). <strong>Size.</strong> Medium. <strong>Speed.</strong> 30 ft.</p>
<p><strong>Temporal Flinch (1/Soma Break).</strong> You experience the next two seconds as a constant, faint pre-echo. You are <strong>immune to the Surprised condition</strong> while conscious. As a reaction, when you or a creature within 10 ft of you would be hit by an attack you can see, you may move yourself or that creature 5 ft — if this moves the target out of the attack's range or line, the attack misses.</p>
<p><strong>Niche Survivor.</strong> You need roughly half the food, water, and air a comparable Medium creature needs. Reroll the lowest die on Body checks against suffocation, starvation, dehydration, or extreme temperature (auto-fires). You can squeeze through gaps and hold stillness that shouldn't work, and you know it.</p>
<p><strong>Vault Sight.</strong> Darkvision 60 ft. Reroll the lowest die on Perception checks to notice unstable structure, active traps, trigger plates, load-bearing failures, or Spark / chronoflux residue (auto-fires).</p>
<p><em>Your Echo-Diver heritage grants additional features through advancements (Temporal Afterimage, Strategic Hooks) at character creation.</em></p>`,
      callout: {
        label: "Echo-Diver: Time-Sense", recovery: "1/Soma Break (Temporal Flinch) + 3 always-on passives", action: "Picker (Temporal Flinch · Niche Survivor · Vault Sight · Cannot Be Surprised)",
        summary: "Click to open the 4-slot picker. Niche Survivor (Body reroll vs environment) and Vault Sight (Perception reroll vs traps/structure/Spark) auto-fire on matching rolls. Surprise immunity surfaces as a Defenses pill.",
        key: "echoDiverTimeSense"
      }
    },
    {
      _id: "ECHODIVABYSSAL01",
      name: "Echo-Diver (Abyssal): Tide Recall",
      type: "feat",
      identifier: "echo_diver_abyssal_tier1",
      requirements: "Echo-Diver (Abyssal)",
      level: null,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Echo_Diver_1.png",
      bbttccFlag: { kind: "echo_diver", feature: "tide_recall", lineage: "Abyssal", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL_ED} style="display:none"></div>
<p><em>"The last thing anyone thinks before they drown stays in the water with them. You can hear it."</em></p>
<p><strong>Tide Recall (1/Soma Break).</strong> Touch a surface, creature, or object. The GM tells you one true thing from its recent past. The lookback window scales with your tier — Tier 1: last 24 hours · Tier 2: last week · Tier 3: last year · Tier 4: anything that ever happened to it. The GM may colour the answer; they may not lie.</p>`,
      callout: {
        label: "Tide Recall", recovery: "1/Soma Break", action: "Action (touch)",
        summary: "Touch any surface/creature/object; GM tells you one true thing from its recent past, lookback scales with character tier (24h / week / year / anything).",
        key: "echoDivAbyssalTideRecall"
      }
    },
    {
      _id: "ECHODIVEMPYREAN1",
      name: "Echo-Diver (Empyrean): Stormread",
      type: "feat",
      identifier: "echo_diver_empyrean_tier1",
      requirements: "Echo-Diver (Empyrean)",
      level: null,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Echo_Diver_1.png",
      bbttccFlag: { kind: "echo_diver", feature: "stormread", lineage: "Empyrean", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL_ED} style="display:none"></div>
<p><em>"It's not that you're faster. It's that the moment is slower, on your side of it."</em></p>
<p><strong>Stormread Initiative (passive).</strong> Flat +2 bonus to initiative — auto-applied via system.derived.initiative.bonus.</p>
<p><strong>Stormread (1/Soma Break).</strong> Bonus action — deliver a warning to one willing ally within 30 feet who can hear and understand you. That ally may immediately use their reaction to move up to half their speed without provoking reaction strikes.</p>`,
      callout: {
        label: "Stormread", recovery: "1/Soma Break (active) + passive +2 init", action: "Picker (Stormread · Stormread Initiative)",
        summary: "Active: bonus-action ally warning grants them a half-speed reaction-move w/o provoking. Passive: +2 initiative auto-applied.",
        key: "echoDivEmpyreanStormread"
      }
    },
    {
      _id: "ECHODIVTELLURIAN",
      name: "Echo-Diver (Tellurian): Stone Patience",
      type: "feat",
      identifier: "echo_diver_tellurian_tier1",
      requirements: "Echo-Diver (Tellurian)",
      level: null,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Echo_Diver_1.png",
      bbttccFlag: { kind: "echo_diver", feature: "stone_patience", lineage: "Tellurian", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL_ED} style="display:none"></div>
<p><em>"You are harder to move than most people are willing to try for."</em></p>
<p><strong>Object Sense (passive).</strong> You passively know, without rolling, the approximate age and structural integrity of any object you touch.</p>
<p><strong>Stone Patience (1/Soma Break).</strong> Bonus action — anchor yourself until the start of your next turn. You cannot be moved against your will, knocked Prone, or made Shaken. Forced-movement effects targeting you fail cleanly; the aggressor knows it.</p>`,
      callout: {
        label: "Stone Patience", recovery: "1/Soma Break (active) + passive object sense", action: "Picker (Stone Patience · Object Sense)",
        summary: "Active: bonus-action anchor — immune to forced movement, Prone, Shaken until next turn. Passive: GM tells you age & structural integrity of any object you touch.",
        key: "echoDivTellurianStonePatience"
      }
    },
  ];

  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`Pack not found: ${PACK_ID}`); return; }

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  const existing = new Set();
  try {
    const docs = await pack.getDocuments();
    for (const d of docs) {
      const id = d.system?.identifier;
      if (id) existing.add(id);
    }
  } catch (e) { console.warn(`pack scan failed: ${e.message}`); }

  let created = 0, skipped = 0;
  const Cls = pack.documentClass;
  for (const it of ITEMS) {
    if (existing.has(it.identifier)) { skipped++; console.log(`  SKIP ${it.identifier}`); continue; }
    const descValue = it.base + "\n" + calloutFor(it.callout);
    const data = {
      _id: it._id, name: it.name, type: it.type, img: it.img, folder: FOLDER_ID,
      system: {
        description: { value: descValue, chat: "" },
        source: { custom: "Bad Eden", rules: "2024", revision: 2, book: "", license: "" },
        advancement: {},
        identifier: it.identifier,
        requirements: it.requirements,
        prerequisites: { items: [], repeatable: false, level: it.level },
        uses: { spent: 0, recovery: [], max: "" },
        activities: {}, category: "feature", tags: [],
        type: { value: "", subtype: "" },
        properties: []
      },
      effects: [],
      flags: { dnd5e: { originType: it.type === "species" ? "species" : "feat" }, bbttcc: it.bbttccFlag },
      ownership: { default: 0 }
    };
    try {
      await Cls.create(data, { pack: PACK_ID, keepId: true });
      created++;
      console.log(`  CREATED  ${it.name}  [${it._id}]`);
    } catch (e) {
      console.error(`  FAIL  ${it.identifier} — ${e.message}`);
    }
  }
  if (wasLocked) await pack.configure({ locked: true });
  ui.notifications.info(`Echo-Diver seed: ${created} created, ${skipped} already present.`);
  console.log("DONE");
})();
