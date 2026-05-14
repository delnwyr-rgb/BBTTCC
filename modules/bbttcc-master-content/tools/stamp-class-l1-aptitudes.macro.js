// BBTTCC — Class L1 Aptitude Stamp (Phase A, 2026-05-04)
// ─────────────────────────────────────────────────────────────────────────────
// Each of the 9 canonical classes should grant:
//   • one combat aptitude (melee or brawl) at rank +1
//   • one armor aptitude (plating, weave, or warding) at rank +1
// when the player gains their Tier-1 anchor feature at L1.
//
// Audit (2026-05-04) showed only Bulwark and Shadow Courier ship a skill AE
// today (Athletics +1 / Stealth+Tinkering +1 respectively); no class grants a
// combat aptitude OR an armor aptitude. Defense engine resistance grants on
// armor (Rad Suits, Steelweave, etc.) are gated by armor-skill rank ≥ 1, so
// without these grants resistances stay dormant.
//
// This macro stamps two transfer-AEs onto each class's T1 anchor item in the
// live `bbttcc-master-content.classes` pack. Aurablade additionally receives
// `flags.fourththing.aurablade.meleeAttrOption = "presence"` so a future
// roll-path UI can offer the violence-or-presence swap on melee rolls.
//
// Idempotent: AEs are stamped with sentinel
// `flags.fourththing.aptitudeStamp = "2026-05-04"`. Re-runs are skipped per-AE.
//
// DRY_RUN = true to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.classes";
const STAMP_TAG = "2026-05-04";
const DRY_RUN = false;

// Anchor name → grants. Names match the live pack (audited 2026-05-04).
const PLAN = [
  { anchor: "Bulwark — Tier 1: Founding Stance",                 combat: "melee", armor: "plating" },
  { anchor: "Aurablade: Core Features",                          combat: "melee", armor: "weave",
    extraFlag: { path: "flags.fourththing.aurablade.meleeAttrOption", value: "presence" } },
  { anchor: "Cosmic Linguist: Core Features",                    combat: "brawl", armor: "weave" },
  { anchor: "Pactkeeper: Core Features",                         combat: "brawl", armor: "warding" },
  { anchor: "Dreamwalker: Tier 1 — Oneiric Reservoir",           combat: "brawl", armor: "weave" },
  { anchor: "Harmony Marshal: Tier 1 — Harmony Initiate",        combat: "melee", armor: "warding" },
  { anchor: "Soul-Smith: Tier 1 — Sanctified Forge Initiate",    combat: "melee", armor: "plating" },
  { anchor: "Wyrdlens Adept: Tier 1 — Lens Read",                combat: "brawl", armor: "weave" },
  { anchor: "Shadow Courier — Tier 1: Liminal Operator",         combat: "brawl", armor: "weave" }
];

const SKILL_LABEL = {
  melee: "Melee", brawl: "Brawl", firearms: "Firearms",
  plating: "Plating", weave: "Weave", warding: "Warding"
};

function buildAE(anchorName, skillKey) {
  return {
    name: `Class L1: ${SKILL_LABEL[skillKey]} +1`,
    img:  "icons/skills/melee/sword-stylized-blue.webp",
    type: "base",
    changes: [{
      key:      `system.skills.${skillKey}.value`,
      value:    "1",
      mode:     2,        // ADD — V14 also accepts "type":"add"
      priority: 10
    }],
    disabled: false,
    transfer: true,
    description: `Granted by ${anchorName} at Tier 1.`,
    flags: {
      fourththing: {
        passiveAuthored: true,
        aptitudeStamp:   STAMP_TAG,
        aptitudeAnchor:  anchorName,
        aptitudeKind:    skillKey
      }
    }
  };
}

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error(`Cannot unlock ${PACK_ID}: ${e.message}`); }
  }

  const docs = await pack.getDocuments();
  const report = [];
  let stamped = 0, skipped = 0, missing = 0;

  for (const row of PLAN) {
    const item = docs.find(d => d.name === row.anchor);
    if (!item) {
      report.push(`✗ MISSING anchor: ${row.anchor}`);
      missing++;
      continue;
    }

    // Discover already-stamped AEs by sentinel
    const existing = (item.effects ?? []).map(e => e.toObject ? e.toObject() : e);
    const has = (skillKey) => existing.some(e =>
      e?.flags?.fourththing?.aptitudeStamp === STAMP_TAG &&
      e?.flags?.fourththing?.aptitudeKind  === skillKey
    );

    const newAEs = [];
    if (!has(row.combat)) newAEs.push(buildAE(row.anchor, row.combat));
    if (!has(row.armor))  newAEs.push(buildAE(row.anchor, row.armor));

    // Aurablade extra flag — set if missing.
    let flagOp = null;
    if (row.extraFlag) {
      const cur = foundry.utils.getProperty(item, row.extraFlag.path);
      if (cur !== row.extraFlag.value) flagOp = { path: row.extraFlag.path, value: row.extraFlag.value };
    }

    if (!newAEs.length && !flagOp) {
      report.push(`· ${row.anchor.padEnd(58)} already stamped`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      report.push(`+ ${row.anchor.padEnd(58)} would add ${newAEs.length} AE(s)${flagOp ? " + flag" : ""}`);
      stamped++;
      continue;
    }

    if (newAEs.length) {
      await item.createEmbeddedDocuments("ActiveEffect", newAEs);
    }
    if (flagOp) {
      await item.update({ [flagOp.path]: flagOp.value });
    }
    report.push(`✓ ${row.anchor.padEnd(58)} +${newAEs.length} AE${flagOp ? " + flag" : ""}`);
    stamped++;
  }

  console.group("[stamp-class-l1-aptitudes]");
  report.forEach(r => console.log(r));
  console.groupEnd();

  ui.notifications.info(
    `L1 aptitude stamp${DRY_RUN ? " (DRY RUN)" : ""}: stamped ${stamped}, skipped ${skipped}, missing ${missing}.`
  );
})();
