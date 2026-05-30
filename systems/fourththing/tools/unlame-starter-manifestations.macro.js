/**
 * Un-lame the RFI Starter Manifestations  (2026-05-29)
 * ----------------------------------------------------
 * The 48 starter manifestations shipped with gorgeous fiction but ZERO
 * mechanical teeth: damage 0, no conditions, no area. This macro gives each
 * one a fiction-matched mechanic AND fixes the "disco-ball bug" — items whose
 * text implies an area but whose `area.shape` is "none" (so they only ever hit
 * one target).
 *
 * SAFE: runs in your live world via the Foundry API (pack.getDocuments() +
 * doc.update()). No pack redeploy, no LevelDB surgery. Idempotent — re-running
 * just re-applies the same values.
 *
 * HOW TO USE:
 *   1. Set DRY_RUN = true, run it once, read the console (F12) summary.
 *   2. If it looks good, set DRY_RUN = false and run again to apply.
 *   3. The pack must be UNLOCKED (right-click the compendium → Toggle Edit Lock).
 *
 * Mechanical vocabulary (engine-validated):
 *   conditions : staggered scarred calmed blinded prone shaken burning
 *                restrained charmed compelled
 *   dmg types  : kinetic energy poison psychic sephirotic qliphothic radiation
 *   tracks     : integrity stress radiation
 *   save attrs : violence intrigue presence body mind soul
 *   areas      : sphere cone line cube cylinder  (size in feet)
 *   mod stats  : guard evasion resolve initiative
 */

const DRY_RUN = true;                 // ← flip to false to actually write
const PACK_ID = "fourththing.starter-manifestations";

// ── builders ───────────────────────────────────────────────────────────────
// Conditions applied on hit / failed save. Control conditions save each round.
const S = (states, { save = "body", dur = "1-round", each = false } = {}) => ({
  "system.manifestation.appliedStates": {
    states: Array.isArray(states) ? states : [states],
    duration: dur, saveEachRound: each, saveAttribute: save,
    saveDcMode: "cast-dc", saveDcFixed: 15, saveAttributeOverrides: {}
  }
});
// Ward / buff (modifiers to guard/evasion/resolve). Carries a scene duration via
// an empty-states appliedStates block so the AE doesn't evaporate in one round.
const WARD = (modifiers, { dur = "scene" } = {}) => ({
  "system.manifestation.appliedStates": {
    states: [], duration: dur, saveEachRound: false, saveAttribute: "body",
    saveDcMode: "cast-dc", saveDcFixed: 15, saveAttributeOverrides: {}
  },
  "system.manifestation.appliedEffects": { modifiers, resists: [], immunes: [] }
});
const AREA  = (shape, size) => ({ "system.manifestation.area": { shape, size } });
const RFT   = (n)           => ({ "system.manifestation.rangeFt": n });
const TGT   = (t)           => ({ "system.target": t });
// Power damage rides system.damageRoll (the cast engine ignores the legacy string).
const PDMG  = (number, die, type, { attr = "", track = "integrity", flavor = "" } = {}) =>
  ({ "system.damageRoll": { op: "damage", number, die, attribute: attr, type, flavor, track } });
// Weapon damage rides system.damage.formula (attackTest).
const WDMG  = (formula, type, { attr = "violence", track = "integrity", flavor = "" } = {}) =>
  ({ "system.damage": { formula, attribute: attr, type, damageFlavor: flavor, track } });

const u = (...parts) => Object.assign({}, ...parts);

// ── the upgrade table — keyed by exact item name ────────────────────────────
const UP = {
  // ---- weapons (strike a foe; appliedStates land on the hit) ----
  "Mercy's Edge":         u(WDMG("1d6","psychic",{attr:"presence",track:"stress",flavor:"the cut between, not through"}), S("shaken",{save:"soul"})),
  "Repaired Memory":      u(WARD([{stat:"guard",op:"+",value:2}])),                        // self/ally breastplate
  "Lucid Standard":       u(AREA("sphere",30), S("calmed",{save:"soul",dur:"until-saved",each:true})),
  "Wayhound Companion":   u(WDMG("1d6","kinetic",{attr:"intrigue",flavor:"phantom bite"}), S("restrained",{save:"body"})),
  "Hearing-Field":        u(AREA("sphere",30), S("shaken",{save:"soul"})),
  "Scribe's Familiar":    u(WDMG("1d4","psychic",{attr:"intrigue",track:"stress"}), WARD([{stat:"evasion",op:"-",value:2}])),
  "Marshal's Mantle":     u(AREA("sphere",20), S("calmed",{save:"soul",dur:"until-saved",each:true})),
  "Long Ledger":          u(S("shaken",{save:"soul"})),
  "Standing Oath":        u(WARD([{stat:"resolve",op:"+",value:2}])),
  "Dream-Twin":           u(WARD([{stat:"evasion",op:"+",value:2}])),
  "Threshold Cloak":      u(WARD([{stat:"evasion",op:"+",value:2}])),
  "Reliquary Vow":        u(WARD([{stat:"resolve",op:"+",value:2}])),
  "Cadence Standard":     u(AREA("sphere",30), S("calmed",{save:"soul",dur:"until-saved",each:true})),
  "Court of Seven":       u(AREA("sphere",20), S("compelled",{save:"soul",dur:"until-saved",each:true})),
  "Wrath-Brand":          u(WDMG("2d6","energy",{attr:"violence",flavor:"righteous heat"}), S("burning",{save:"body"})),
  "Pressure Front":       u(WDMG("2d6","kinetic",{attr:"violence",flavor:"advancing weight"}), AREA("cone",15), S("prone",{save:"body"})),
  "Carry-the-Unsayable":  u(AREA("sphere",30), S("shaken",{save:"soul"})),
  "Wall of My People":    u(AREA("sphere",30), WARD([{stat:"guard",op:"+",value:2}])),
  "Anvil Stance":         u(WDMG("1d6","kinetic",{attr:"violence",flavor:"ground-driven"}), S("staggered",{save:"body"})),
  "Borrowed Bastion":     u(WDMG("2d6","kinetic",{attr:"violence",flavor:"brutalist plate"}), S("staggered",{save:"body"})),
  "Witness Flame":        u(AREA("sphere",30), S("shaken",{save:"soul"})),
  "Marginalia Drift":     u(S("restrained",{save:"body"})),
  "Sigil of Seeing":      u(WARD([{stat:"evasion",op:"+",value:1}])),
  "Living Glossary":      u(S("compelled",{save:"soul",dur:"until-saved",each:true})),
  "Apprentice's Echo":    u(WARD([{stat:"guard",op:"+",value:2}])),
  "Memory-Bramble":       u(AREA("sphere",30), S("calmed",{save:"soul",dur:"until-saved",each:true})),
  "Mercy Arc":            u(WDMG("2d6","sephirotic",{attr:"presence",flavor:"radiant"}), S("shaken",{save:"soul"})),
  "Dread Crown":          u(WDMG("1d4","psychic",{attr:"presence",track:"stress",flavor:"the weight of being looked at"}), AREA("sphere",20), S("shaken",{save:"soul"})),
  "Atlas Prism":          u(WARD([{stat:"evasion",op:"+",value:1}])),

  // ---- powers (cast; area genuinely fans to everyone in the template) ----
  "Footnote":             u(PDMG(1,"d4","psychic",{attr:"mind",track:"stress"}), S("shaken",{save:"mind"})),
  "Threshold Receipt":    u(RFT(30), WARD([{stat:"evasion",op:"+",value:1}])),
  "Penalty Clause":       u(PDMG(2,"d6","qliphothic",{attr:"soul",track:"stress",flavor:"the lie cuts him"}), S("shaken",{save:"soul"})),
  "Correspondence Strike":u(PDMG(2,"d6","energy",{attr:"mind",flavor:"sympathetic break"}), S("staggered",{save:"body"})),
  "Sleep-Loop":           u(S("charmed",{save:"soul",dur:"until-saved",each:true})),
  "Mirrorstep":           u(WARD([{stat:"evasion",op:"+",value:2}])),
  "Borrowed Face":        u(WARD([{stat:"evasion",op:"+",value:1}])),
  "Italic Emphasis":      u(WARD([{stat:"resolve",op:"+",value:2}])),
  "Lensing":              u(PDMG(1,"d4","psychic",{attr:"mind",track:"stress"}), S("shaken",{save:"mind"})),
  "Cite Precedent":       u(S("calmed",{save:"soul",dur:"until-saved",each:true})),
  "Impossible Second Self":u(WARD([{stat:"evasion",op:"+",value:1}])),
  "Strikethrough":        u(PDMG(1,"d6","psychic",{attr:"mind",track:"stress"}), S("shaken",{save:"mind"})),
  "Measured Breath Accord":u(AREA("sphere",30), S("calmed",{save:"soul",dur:"until-saved",each:true})),   // disco-ball-class fix (target:"area")
  "Hearth-Nail Covenant": u(AREA("sphere",15), WARD([{stat:"guard",op:"+",value:2}])),                    // target:"area"
  "Margin Note: Not Yet": u(S("staggered",{save:"mind"})),
  "Bind Witness":         u(S("compelled",{save:"soul",dur:"until-saved",each:true})),
  "Clause Lantern":       u(AREA("sphere",30), S("shaken",{save:"soul"})),                                 // target:"area"
  "Wide Angle":           u(WARD([{stat:"evasion",op:"+",value:2}])),
  "Angle of Witness":     u(WARD([{stat:"evasion",op:"-",value:2}]))                                       // exposes the target
};

// ── run ─────────────────────────────────────────────────────────────────────
const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); }
else {
  if (!DRY_RUN && pack.locked) {
    ui.notifications.warn("Pack is locked — right-click the compendium → Toggle Edit Lock, then re-run.");
  } else {
    const docs = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, d]));
    let hit = 0, miss = [], applied = [];
    for (const [name, data] of Object.entries(UP)) {
      const doc = byName.get(name);
      if (!doc) { miss.push(name); continue; }
      hit++;
      const summary = Object.keys(data).map(k => k.replace("system.manifestation.","mf.").replace("system.","")).join(", ");
      applied.push(`✦ ${name} → ${summary}`);
      if (!DRY_RUN) { try { await doc.update(data); } catch (e) { console.error(`update failed for ${name}`, e); } }
    }
    console.log("%c=== Un-lame Starter Manifestations ===","font-weight:bold;font-size:14px");
    console.log(`${DRY_RUN ? "DRY RUN (nothing written)" : "APPLIED"} — ${hit}/${Object.keys(UP).length} matched in pack of ${docs.length}.`);
    console.log(applied.join("\n"));
    if (miss.length) console.warn("NOT FOUND in pack (name drift?):\n" + miss.join("\n"));
    const extra = docs.filter(d => !UP[d.name]).map(d => d.name);
    if (extra.length) console.warn("In pack but NOT in upgrade table:\n" + extra.join("\n"));
    ui.notifications[DRY_RUN ? "info" : "info"](`${DRY_RUN ? "DRY RUN" : "Applied"}: ${hit} manifestations un-lamed. See console (F12) for the full report.`);
  }
}
