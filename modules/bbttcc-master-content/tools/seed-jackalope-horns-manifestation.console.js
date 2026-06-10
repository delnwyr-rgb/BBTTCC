// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Seed Horns of Bad Luck (Jackalope Manifestation)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent.
//
// Three jobs:
//   1. Author "Horns of Bad Luck" weapon item (1d6 kinetic, piercing flavor)
//      in bbttcc-master-content.items, marked as Tier-I manifestation
//      (origin: crafted, signature, bound: soulbound).
//   2. Add an ItemGrant advancement row to Cryptidkin Heritage: Jackalope
//      (identifier `cryptidkin_jackalope_heritage`) so new characters get
//      Horns automatically when the wizard / heritage swap fires.
//   3. Walk all actors who already have Jackalope heritage but are missing
//      Horns; auto-import a copy.
//
// Idempotent on all three. Pack scan keys: identifier-based.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const HORNS_ID = "HORNSBADLUCK0001";   // 16-char alphanum (Foundry constraint)
  const HORNS_IDENT = "horns_of_bad_luck";
  const HERITAGE_IDENT = "cryptidkin_jackalope_heritage";
  const ITEMS_PACK = "bbttcc-master-content.items";
  const ADV_ROW_ID = "ckjackhornsadv01";

  // Build the Horns weapon body (RFI canon + manifestation flag).
  const buildHornsData = () => ({
    _id: HORNS_ID,
    name: "Horns of Bad Luck",
    type: "weapon",
    img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Cryptidkin_Jackalope_1.png",
    system: {
      description: {
        value:
`<p><em>"You aren't sure when you grew them. They were waiting for you when you stopped pretending."</em></p>
<p><strong>Natural Attack.</strong> Bonus action — make a melee unarmed strike with your horns. Deals <strong>1d6 kinetic damage</strong> (piercing flavor) on a hit.</p>
<p><strong>Bad-Luck Omens.</strong> When violence escalates around you, the GM may describe unsettling omens tied to your presence — a mirror crack, a dropped knife, a candle going out the wrong direction.</p>
<p><strong>Manifestation (Tier I, soulbound).</strong> These horns are part of you. They cannot be sundered, lost, or stolen — they vanish on your death and reappear on the next Jackalope to inherit the bloodline's luck.</p>`,
        chat: ""
      },
      identifier: HORNS_IDENT,
      source: { custom: "Bad Eden", rules: "2024", revision: 1, book: "", license: "" },
      category: "melee",
      intent: "violence",
      skill: "melee",
      damage: { formula: "1d6", attribute: "", type: "kinetic", damageFlavor: "piercing", track: "integrity" },
      range: { short: 1, long: 1 },
      tags: ["natural", "unarmed", "manifestation", "jackalope"],
      effect: "",
      flavor: "Jackalope-native bone-crown.",
      manifestation: {
        tier: 1, family: "form", concept: "Jackalope bloodline horns",
        form: "weapon", function: "harm", stability: "soulbound", interactionModel: "weapon",
        costType: "none", costValue: 0, costText: "",
        duration: "permanent", durationText: "permanent (regrows on lineage transfer)",
        triggerText: "", scale: "personal", targetText: "single target",
        rangeAreaText: "melee", maintenanceCost: "",
        riskText: "Bad-luck omens follow you when violence escalates nearby.",
        pathResonance: "Jackalope heritage / luck-thievery", fictionalPermission: "Heritage-granted",
        gmCalibration: "Tier I bound natural weapon — never escalates without explicit player cost.",
        mechanicalHook: "1d6 kinetic (piercing) on hit; bonus action.",
        signature: "Horns of Bad Luck",
        thirdThing: "Omens follow when violence escalates.",
        opCost: { pool: "", value: 0 }
      }
    },
    effects: [],
    flags: {
      fourththing: {
        rfi: {
          item: {
            tier: "I",
            footprint: 1,
            reach: "5",
            frame: "weapon",
            signature: "Horns of Bad Luck",
            origin: "crafted",
            originator: null,
            bound: "soulbound",
            upkeep: { mode: "passive", per: "none" },
            misfire: { tierClamp: true, table: null },
            signals: {},
            lore: "Jackalope-native bone-crown manifestation."
          }
        },
        grantedByHeritage: "cryptidkin_jackalope_heritage"
      }
    },
    ownership: { default: 0 }
  });

  // ─── Job 1: Author Horns in items pack ────────────────────────────────────
  const itemsPack = game.packs.get(ITEMS_PACK);
  if (!itemsPack) { ui.notifications.error(`Pack not found: ${ITEMS_PACK}`); return; }
  const wasItemsLocked = itemsPack.locked;
  if (wasItemsLocked) await itemsPack.configure({ locked: false });

  const itemsDocs = await itemsPack.getDocuments();
  const existingHorns = itemsDocs.find(d => d.system?.identifier === HORNS_IDENT);
  if (!existingHorns) {
    try {
      await itemsPack.documentClass.create(buildHornsData(), { pack: ITEMS_PACK, keepId: true });
      console.log(`  ✓ CREATED Horns of Bad Luck in ${ITEMS_PACK} [${HORNS_ID}]`);
    } catch (e) {
      console.error(`  FAIL creating Horns: ${e.message}`);
      if (wasItemsLocked) await itemsPack.configure({ locked: true });
      return;
    }
  } else {
    console.log(`  · SKIP Horns already present [${existingHorns.id}]`);
  }
  if (wasItemsLocked) await itemsPack.configure({ locked: true });

  // Resolve the Horns UUID (whether just-created or already-present)
  const hornsUuid = existingHorns
    ? existingHorns.uuid
    : `Compendium.${ITEMS_PACK}.Item.${HORNS_ID}`;

  // ─── Job 2: Add ItemGrant row to Jackalope heritage ──────────────────────
  let heritageDoc = null;
  let heritagePack = null;
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const docs = await pack.getDocuments();
    const found = docs.find(d => d.system?.identifier === HERITAGE_IDENT);
    if (found) { heritageDoc = found; heritagePack = pack; break; }
  }
  if (!heritageDoc) {
    ui.notifications.error(`Jackalope heritage item not found in any bbttcc-* pack.`);
    return;
  }

  const wasHeritageLocked = heritagePack.locked;
  if (wasHeritageLocked) await heritagePack.configure({ locked: false });

  const advRaw = heritageDoc.system?.advancement ?? {};
  const advRows = Array.isArray(advRaw) ? [...advRaw] : Object.values(advRaw);
  const alreadyHasGrant = advRows.some(row =>
    row?.type === "ItemGrant" &&
    (row.configuration?.items ?? []).some(it => it.uuid === hornsUuid)
  );

  if (!alreadyHasGrant) {
    advRows.push({
      _id: ADV_ROW_ID,
      type: "ItemGrant",
      configuration: {
        items: [{ uuid: hornsUuid, optional: false }],
        optional: false,
        spell: null
      },
      value: {},
      level: 0,
      title: "Horns of Bad Luck (Manifestation)",
      hint: "Grant the Jackalope-only Tier I natural-weapon manifestation."
    });
    await heritageDoc.update({ "system.advancement": advRows });
    console.log(`  ✓ ADDED ItemGrant row to Jackalope heritage [${heritagePack.metadata.id}]`);
  } else {
    console.log(`  · SKIP heritage already has Horns ItemGrant`);
  }
  if (wasHeritageLocked) await heritagePack.configure({ locked: true });

  // ─── Job 3: Backfill Horns onto existing Jackalope actors ────────────────
  const hornsTemplate = (await fromUuid(hornsUuid))?.toObject();
  if (!hornsTemplate) {
    console.warn(`  Could not resolve Horns at ${hornsUuid} for backfill — skipping.`);
  } else {
    let actorOK = 0;
    for (const actor of game.actors) {
      const hasJackalope = actor.items.find(i => i.system?.identifier === HERITAGE_IDENT);
      if (!hasJackalope) continue;
      const hasHorns = actor.items.find(i => i.system?.identifier === HORNS_IDENT);
      if (hasHorns) continue;
      const obj = foundry.utils.deepClone(hornsTemplate);
      delete obj._id;
      foundry.utils.setProperty(obj, "flags.fourththing.grantedByHeritage", HERITAGE_IDENT);
      try {
        await actor.createEmbeddedDocuments("Item", [obj]);
        actorOK++;
        console.log(`  [${actor.name}] backfilled Horns of Bad Luck`);
      } catch (e) {
        console.warn(`  [${actor.name}] backfill failed: ${e.message}`);
      }
    }
    console.log(`  Backfilled ${actorOK} Jackalope actor(s) with Horns of Bad Luck.`);
  }

  ui.notifications.info(`Jackalope Horns seed complete. See console for details.`);
  console.log("DONE");
})();
