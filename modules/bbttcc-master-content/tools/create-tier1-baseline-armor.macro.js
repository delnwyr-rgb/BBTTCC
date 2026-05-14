// BBTTCC — Tier I Baseline Armor Kit (+ one T2 Heavy companion)
// ─────────────────────────────────────────────────────────────────────────────
// Purpose: fill the chargen / level-1 armor gap. Existing armor pool was
// top-heavy (mostly Tier IV signature plate, plus Septhide & Rad Suit Mk I
// at Tier II) — leaving Stewards with nothing affordable on day one and
// no heavy option at all for Bulwark-pattern paths.
//
// This macro authors:
//   • 6 Tier-I baseline pieces — one per wear-class. RFI-clean (no signature
//     abilities, no upkeep, no harmonization). These are "what's on the rack
//     in any town." Cheap or starting-issue.
//   • 1 Tier-II Heavy companion — so Bulwarks have an early-aspiration piece
//     that matches Septhide Vestments / Rad Suit Mk I in tier weight.
//
// Chargen-gear policy (recommended companion rule, GM-facing):
//   At character creation a Steward may pick:
//     – ONE Tier-I baseline piece, free, OR
//     – ONE Tier-II piece (Septhide Vestments / Rad Suit Mk I / Steelweave
//       Hauberk) at half cost, representing inherited or signed-out gear.
//
// Items land in `bbttcc-master-content.items` under a "T1 Baseline Armor"
// folder (created if absent). Idempotent — names already present are
// skipped unless FORCE = true.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const FOLDER_NAME = "T1 Baseline Armor";
const DRY_RUN = false;
const FORCE   = false;

const ITEMS = [
  // ── 1 ── Light / weave ────────────────────────────────────────────────────
  {
    name: "Drifter's Weave",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "armor", origin: "looted", bound: "free",
      signature: "Cloth that's already walked further than you have.",
      lore: "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p>"
        + "<p><b>Standard Issue.</b> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>",
      materialOf: ["road-canvas", "quilted-liner"]
    },
    system: {
      guardBonus: 1, evasionBonus: 1, resolveBonus: 0,
      armorSkill: "weave",
      equipped: false,
      resistances: [],
      tags: ["t1-baseline", "light", "cloth"]
    }
  },

  // ── 2 ── Medium / plating ─────────────────────────────────────────────────
  {
    name: "Patrolman's Plate",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "armor", origin: "looted", bound: "free",
      signature: "Issued, dented, returned, reissued. Honest metal.",
      lore: "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p>"
        + "<p><b>Standard Issue.</b> No signature, no harmonization, no questions asked at the gate.</p>",
      materialOf: ["scrap-steel", "gambeson", "leather-strap"]
    },
    system: {
      guardBonus: 2, evasionBonus: 0, resolveBonus: 0,
      armorSkill: "plating",
      equipped: false,
      resistances: [],
      tags: ["t1-baseline", "medium", "plate"]
    }
  },

  // ── 3 ── Heavy / plating (Bulwark identity at T1) ────────────────────────
  {
    name: "Bulwark Hauberk",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "armor", origin: "looted", bound: "free",
      signature: "Heavy enough to remind you you're standing somewhere on purpose.",
      lore: "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p>"
        + "<p><b>Standard Issue.</b> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>",
      materialOf: ["mail", "rivet-plate", "padded-coat"]
    },
    system: {
      guardBonus: 2, evasionBonus: 0, resolveBonus: 1,
      armorSkill: "plating",
      equipped: false,
      resistances: [],
      tags: ["t1-baseline", "heavy", "mail", "plate"]
    }
  },

  // ── 4 ── Shield / warding ─────────────────────────────────────────────────
  {
    name: "Pressed Buckler",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "shield", origin: "looted", bound: "free",
      signature: "A round of stamped steel and the conviction to hold it up.",
      lore: "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p>"
        + "<p><b>Standard Issue.</b> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>",
      materialOf: ["sheet-steel", "leather-cuff"]
    },
    system: {
      guardBonus: 1, evasionBonus: 0, resolveBonus: 0,
      armorSkill: "warding",
      equipped: false,
      resistances: [],
      tags: ["t1-baseline", "shield", "buckler"]
    }
  },

  // ── 5 ── Robe / weave (caster-leaning) ────────────────────────────────────
  {
    name: "Initiate's Robe",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "armor", origin: "given", bound: "free",
      signature: "Plain cloth. The hem remembers the floor of the room you left.",
      lore: "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p>"
        + "<p><b>Standard Issue.</b> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>",
      materialOf: ["sept-cloth", "corded-belt"]
    },
    system: {
      guardBonus: 0, evasionBonus: 1, resolveBonus: 1,
      armorSkill: "weave",
      equipped: false,
      resistances: [],
      tags: ["t1-baseline", "robe", "cloth", "caster"]
    }
  },

  // ── 6 ── Worker's Leathers / weave (utility) ──────────────────────────────
  {
    name: "Worker's Leathers",
    targetType: "armor",
    rfi: {
      tier: "I", frame: "armor", origin: "looted", bound: "free",
      signature: "Built for the kind of day where something might fall on you.",
      lore: "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p>"
        + "<p><b>Standard Issue.</b> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p>",
      materialOf: ["work-leather", "rivet-strap", "tool-loop"]
    },
    system: {
      guardBonus: 1, evasionBonus: 1, resolveBonus: 0,
      armorSkill: "weave",
      equipped: false,
      resistances: [],
      tags: ["t1-baseline", "light", "leather", "utility"]
    }
  },

  // ── 7 ── T2 Heavy companion (Bulwark aspiration tier) ─────────────────────
  // Pairs with Septhide Vestments (T2 weave) and Rad Suit Mk I (T2 weave) so
  // every wear-class has at least one Tier II option Stewards can buy or
  // start with under the chargen-gear policy.
  {
    name: "Steelweave Hauberk",
    targetType: "armor",
    rfi: {
      tier: "II", frame: "armor", origin: "looted", bound: "free",
      signature: "Mail laced with reactive thread. The thread complains. The mail does not.",
      lore: "<p>A heavy hauberk woven through with a fine tension-thread of reactive yesodium-doped wire, cut and rivetted by a journeyman armorer in one of the older Bad Eden plate-houses. The weave snags incoming force a half-beat before it lands, redistributing it into the wearer's stance instead of their ribs. Heavy. Expensive. Worth it.</p>"
        + "<p><b>Reactive Lacing.</b> While worn, once per Soma Break the wearer may shift one die of incoming kinetic damage into Stress instead of Integrity. GM-adjudicated; tap the item's use tracker when spent. No upkeep, no harmonization — the thread does the thinking.</p>",
      materialOf: ["mail", "yesodium-thread", "rivet-plate"]
    },
    // Defense engine reads flags.fourththing.grants — NOT rfi.item.grants.
    // Rad Suits use the structured {type, flavor?} shape; matching it here.
    grants: { resistances: [{ type: "kinetic" }] },
    system: {
      guardBonus: 3, evasionBonus: 0, resolveBonus: 1,
      armorSkill: "plating",
      equipped: false,
      resistances: ["kinetic"],
      uses: { max: 1, spent: 0 },
      tags: ["t2-aspiration", "heavy", "mail", "plate", "reactive"]
    }
  }
];

// ── Driver ────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  const Folder = foundry.documents?.Folder ?? globalThis.Folder;
  let folder = pack.folders?.find(f => f.name === FOLDER_NAME);
  if (!folder && !DRY_RUN) {
    folder = await Folder.create(
      { name: FOLDER_NAME, type: "Item", color: "#5a8c5a" },
      { pack: PACK_ID }
    );
  }

  await pack.getIndex();
  const docs = await pack.getDocuments();
  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available — is the fourththing system active?");

  const created = [];
  const skipped = [];

  for (const row of ITEMS) {
    const exists = docs.find(d => d.name === row.name);
    if (exists && !FORCE) { skipped.push(row.name); continue; }

    const defaults = RfiItems.defaults({ type: row.targetType, system: {}, getFlag: () => null });
    const rfiFlag = { ...defaults, ...row.rfi };

    const flags = { fourththing: { rfi: { item: rfiFlag } } };
    if (row.grants) flags.fourththing.grants = row.grants;

    const itemData = {
      name:   row.name,
      type:   row.targetType,
      img:    row.img ?? "icons/svg/mystery-man.svg",
      system: row.system ?? {},
      flags
    };
    if (folder?.id) itemData.folder = folder.id;

    if (!DRY_RUN) await Item.create(itemData, { pack: PACK_ID });
    created.push(row.name);
  }

  ui.notifications.info(
    `T1 Baseline Armor seeded: created ${created.length}, skipped ${skipped.length}` +
    (DRY_RUN ? " (DRY RUN)" : "")
  );
  console.log("[t1-baseline-armor] created:", created);
  if (skipped.length) console.log("[t1-baseline-armor] skipped (existing):", skipped);
})();
