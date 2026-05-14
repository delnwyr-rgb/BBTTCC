// BBTTCC — Retro-apply Class L1 Aptitudes (Phase A companion, 2026-05-04)
// ─────────────────────────────────────────────────────────────────────────────
// Phase A's stamp-class-l1-aptitudes.macro.js stamps the new transfer-AEs onto
// the compendium-side T1 anchor items. That fixes new characters created from
// this point forward, but does NOT retro-apply to characters who already have
// the anchor item embedded on their actor (Foundry doesn't propagate AE adds
// from compendium docs to actor-side copies).
//
// This macro walks every world Actor, finds any embedded item whose name
// matches one of the 9 canonical T1 anchors, and adds the missing AEs (combat
// + armor) directly onto that actor-side item. Idempotent via the same
// 2026-05-04 sentinel used by the compendium stamp.
//
// Aurablade extra: stamps the meleeAttrOption flag onto the actor-side
// Aurablade Core Features item too.
//
// DRY_RUN = true to preview without writing.
// ─────────────────────────────────────────────────────────────────────────────

const STAMP_TAG = "2026-05-04";
const DRY_RUN = false;

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
const PLAN_BY_ANCHOR = new Map(PLAN.map(p => [p.anchor, p]));

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
      mode:     2,
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

  const report = [];
  let actorsTouched = 0, aesAdded = 0, flagsSet = 0;

  for (const actor of game.actors ?? []) {
    if (!actor || !Array.isArray(actor.items?.contents) && !actor.items) continue;

    let touchedThisActor = false;

    for (const item of (actor.items?.contents ?? [...(actor.items ?? [])])) {
      const plan = PLAN_BY_ANCHOR.get(item.name);
      if (!plan) continue;

      // Detect already-stamped AEs by sentinel
      const existingAEs = item.effects?.contents ?? [...(item.effects ?? [])];
      const has = (skillKey) => existingAEs.some(e =>
        e?.flags?.fourththing?.aptitudeStamp === STAMP_TAG &&
        e?.flags?.fourththing?.aptitudeKind  === skillKey
      );

      const newAEs = [];
      if (!has(plan.combat)) newAEs.push(buildAE(plan.anchor, plan.combat));
      if (!has(plan.armor))  newAEs.push(buildAE(plan.anchor, plan.armor));

      let flagOp = null;
      if (plan.extraFlag) {
        const cur = foundry.utils.getProperty(item, plan.extraFlag.path);
        if (cur !== plan.extraFlag.value) flagOp = plan.extraFlag;
      }

      if (!newAEs.length && !flagOp) continue;

      if (DRY_RUN) {
        report.push(`+ [${actor.name}] ${item.name}: would add ${newAEs.length} AE(s)${flagOp ? " + flag" : ""}`);
        touchedThisActor = true;
        aesAdded += newAEs.length;
        if (flagOp) flagsSet++;
        continue;
      }

      if (newAEs.length) {
        await item.createEmbeddedDocuments("ActiveEffect", newAEs);
        aesAdded += newAEs.length;
      }
      if (flagOp) {
        await item.update({ [flagOp.path]: flagOp.value });
        flagsSet++;
      }

      report.push(`✓ [${actor.name}] ${item.name}: +${newAEs.length} AE${flagOp ? " + flag" : ""}`);
      touchedThisActor = true;
    }

    if (touchedThisActor) actorsTouched++;
  }

  console.group("[retro-apply-class-l1-aptitudes]");
  if (report.length) report.forEach(r => console.log(r));
  else console.log("Nothing to do — all actors already current.");
  console.groupEnd();

  ui.notifications.info(
    `Retro-apply${DRY_RUN ? " (DRY RUN)" : ""}: ${actorsTouched} actors touched, ${aesAdded} AEs added, ${flagsSet} flags set.`
  );
})();
