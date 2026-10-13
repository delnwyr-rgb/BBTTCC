// Bad Eden — Retro-apply Class L1 Aptitudes (Phase A companion, 2026-05-04)
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
  { anchor: "Bulwark — Tier 1: Founding Stance", id: "BlwkClassFt01abc",                 combat: "melee", armor: "plating" },
  { anchor: "Aurablade: Core Features", id: "SnNMVlFK9hAUbO5U",                          combat: "melee", armor: "fitting",
    extraFlag: { path: "flags.fourththing.aurablade.meleeAttrOption", value: "presence" } },
  { anchor: "Cosmic Linguist: Core Features", id: "l4s5F3CMg7bo0Lb2",                    combat: "brawl", armor: "fitting" },
  { anchor: "Pactkeeper: Core Features", id: "v2PteOnTErjsVZ66",                         combat: "brawl", armor: "bracing" },
  { anchor: "Dreamwalker: Tier 1 — Oneiric Reservoir", id: "91dc5101e44cc01b",           combat: "brawl", armor: "fitting" },
  { anchor: "Harmony Marshal: Tier 1 — Harmony Initiate", id: "N37iOrOh5fD9r3gY",        combat: "melee", armor: "bracing" },
  { anchor: "Soul-Smith: Tier 1 — Sanctified Forge Initiate", id: "6Xip1ZQnwdQxH1NT",    combat: "melee", armor: "plating" },
  { anchor: "Wyrdlens Adept: Tier 1 — Lens Read", id: "9HNxUBStk9ZQcVo1",                combat: "brawl", armor: "fitting" },
  { anchor: "Shadow Courier — Tier 1: Liminal Operator", id: "ShdwClassFt01abc",         combat: "brawl", armor: "fitting" }
];
const PLAN_BY_ANCHOR = new Map(PLAN.map(p => [p.anchor, p]));

const SKILL_LABEL = {
  melee: "Melee", brawl: "Brawl", firearms: "Firearms",
  plating: "Plating", fitting: "Fitting", bracing: "Bracing"
};
// Owner rename 2026-08-22: weave→fitting (light), warding→bracing (medium).
// Stamps written before the rename carry a key the actor schema no longer has;
// migrateLegacyStamps() rewrites them in place instead of stacking a duplicate.
const LEGACY_SKILL_ALIASES = { weave: "fitting", warding: "bracing", weaver: "fitting" };
function migrateLegacyStamps(effects) {
  const ops = [];
  for (const e of effects) {
    const kind = e?.flags?.fourththing?.aptitudeKind;
    const to   = LEGACY_SKILL_ALIASES[kind];
    if (!e?.flags?.fourththing?.aptitudeStamp || !to) continue;
    const changes = (e.changes ?? []).map(c => ({
      ...c, key: String(c.key ?? "").replace(`system.skills.${kind}.value`, `system.skills.${to}.value`)
    }));
    ops.push({ _id: e._id ?? e.id, name: `Class L1: ${SKILL_LABEL[to]} +1`, changes,
               "flags.fourththing.aptitudeKind": to, from: kind, to });
  }
  return ops;
}

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
  let actorsTouched = 0, aesAdded = 0, flagsSet = 0, promotedRanks = 0;
  const needsPromote = new Set();
  const matchedAnchors = [], unmatched = [];
  // Actor-side copies may be renamed; the character wizard stamps the pack
  // source on every granted item, so match on that too.
  const PLAN_BY_ID = new Map(PLAN.map(p => [p.id, p]));
  const sourceIdOf = (item) => item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId ?? null;
  const planBySource = (item) => {
    const src = String(sourceIdOf(item) ?? "");
    const m = src.match(/\.Item\.([A-Za-z0-9]+)$/);
    return m ? PLAN_BY_ID.get(m[1]) ?? null : null;
  };
  const looksLikeClassFeature = (item) =>
    !!item?.flags?.fourththing?.grantedByClass || /tier 1|core features/i.test(String(item?.name ?? ""));

  for (const actor of game.actors ?? []) {
    if (!actor || !Array.isArray(actor.items?.contents) && !actor.items) continue;

    let touchedThisActor = false;

    for (const item of (actor.items?.contents ?? [...(actor.items ?? [])])) {
      const plan = PLAN_BY_ANCHOR.get(item.name) ?? planBySource(item);
      if (!plan) { if (looksLikeClassFeature(item)) unmatched.push(`[${actor.name}] ${item.type} "${item.name}" src=${sourceIdOf(item) ?? "—"}`); continue; }
      matchedAnchors.push(`[${actor.name}] ${item.name}`);

      // Rewrite pre-rename stamps (weave/warding) onto the current keys first.
      const migrate = migrateLegacyStamps((item.effects?.contents ?? [...(item.effects ?? [])]).map(e => e.toObject ? e.toObject() : e));
      if (migrate.length) {
        if (DRY_RUN) report.push(`~ [${actor.name}] ${item.name}: would migrate ${migrate.map(o => `${o.from}→${o.to}`).join(", ")}`);
        else {
          await item.updateEmbeddedDocuments("ActiveEffect", migrate.map(({ from, to, ...op }) => op));
          report.push(`~ [${actor.name}] ${item.name}: migrated ${migrate.map(o => `${o.from}→${o.to}`).join(", ")}`);
        }
        touchedThisActor = true;
        needsPromote.add(actor);
      }

      // Detect already-stamped AEs by sentinel (post-migration view)
      const existingAEs = item.effects?.contents ?? [...(item.effects ?? [])];
      const has = (skillKey) => existingAEs.some(e =>
        e?.flags?.fourththing?.aptitudeStamp === STAMP_TAG &&
        e?.flags?.fourththing?.aptitudeKind  === skillKey
      );

      const newAEs = [];
      if (!has(plan.combat)) newAEs.push(buildAE(plan.anchor, plan.combat));
      if (!has(plan.armor))  newAEs.push(buildAE(plan.anchor, plan.armor));
      // Any actor carrying an anchor gets a promote pass — a stamp that was
      // added but never promoted (pre-rename casters) still needs its rank.
      needsPromote.add(actor);

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

  // Promote the stamps into SOURCE ranks (the rank pips + armor gate read
  // source). Same routine chargen finalize runs; ledger-guarded, idempotent.
  const promote = game.fourththing?.promoteStampedAptitudeAEs ?? game.fourththing?._progression?.promoteStampedAptitudeAEs;
  if (!promote) report.push("! game.fourththing.promoteStampedAptitudeAEs missing — ranks NOT promoted (system too old?)");
  else if (!DRY_RUN) {
    for (const actor of needsPromote) {
      try {
        const out = await promote(actor);
        for (const p of (out ?? [])) { report.push(`★ [${actor.name}] ${p.skill} ${p.from}→${p.to} (${p.source})`); promotedRanks++; }
      } catch (e) { report.push(`! [${actor.name}] promote failed: ${e.message}`); console.error(e); }
    }
  } else report.push(`~ would run promote pass on ${needsPromote.size} actor(s)`);

  console.group("[retro-apply-class-l1-aptitudes]");
  if (report.length) report.forEach(r => console.log(r));
  else console.log("Nothing to do — all actors already current.");
  console.log(`Anchors matched: ${matchedAnchors.length}`); matchedAnchors.forEach(m => console.log("  ✓", m));
  if (!matchedAnchors.length) console.warn("No actor carries a recognised Tier 1 anchor — nothing to stamp. Candidate class features seen:");
  unmatched.forEach(u => console.log("  ?", u));
  console.groupEnd();

  ui.notifications.info(
    `Retro-apply${DRY_RUN ? " (DRY RUN)" : ""}: ${actorsTouched} actors touched, ${aesAdded} AEs added, ${flagsSet} flags set, ${promotedRanks} ranks promoted.`
  );
})();
