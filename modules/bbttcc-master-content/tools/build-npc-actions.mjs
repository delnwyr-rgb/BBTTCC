#!/usr/bin/env node
// Wire narrative save/damage NPC abilities into clickable weapon-type items.
// ─────────────────────────────────────────────────────────────────────────────
// The fourththing NPC sheet only renders a "Strike" button (→ ftOpenEngageDialog
// → attack roll vs target defense → Apply Damage card) for items of type
// "weapon". Many bestiary NPCs carry their save/AoE attacks as type "feature"
// (category "principle") = pure narrative text the GM has to roll & apply by
// hand. This converts the genuinely-active, DAMAGE-bearing ones in place,
// mirroring the makeSaveItem shape from seed-bestiary-attacks.macro.js. Passives,
// on-hit riders, auras, and control-only (no-damage) saves are intentionally
// left as narrative features.
//
// Writes the ClassicLevel npcs pack directly (the bundled `fvtt package pack`
// iterator is broken under Node 24 here). Each item is rewritten under its OWN
// !actors.items!<actorId>.<itemId> key, same _id — the parent actor's items[]
// holds only _id strings, so no parent update is needed.
//
//   node build-npc-actions.mjs            # DRY: print before/after, no writes
//   node build-npc-actions.mjs --apply    # write changes into the pack
// ─────────────────────────────────────────────────────────────────────────────

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const APPLY = process.argv.includes("--apply");
const here  = dirname(fileURLToPath(import.meta.url));
const PACK  = resolve(here, "..", "packs", "npcs");
const require = createRequire(import.meta.url);
let ClassicLevel;
for (const p of ["classic-level","/opt/homebrew/lib/node_modules/@foundryvtt/foundryvtt-cli/node_modules/classic-level"]) { try { ({ ClassicLevel } = require(p)); break; } catch {} }
if (!ClassicLevel) throw new Error("classic-level not found");

// Save-ability → target defense the GM rolls against in the engage dialog.
const SAVE_TO_DEFENSE = {
  con:"Resolve", dex:"Evasion", wis:"Resolve", str:"Guard", int:"Resolve", cha:"Resolve",
  body:"Resolve", presence:"Resolve", mind:"Resolve", soul:"Resolve",
  violence:"Guard", intrigue:"Evasion"
};

// Curated conversion table. Keyed by itemId (stable across the pack).
//   shape  : "radius" | "cone" | "single"   (cosmetic — drives effect text)
//   size   : AoE size in ft (ignored for single)
//   range  : delivery range in ft (token reach; converted to 5-ft squares)
//   dice   : bare damage dice (engage dialog adds `attribute`)
//   dmgType: RFI-7 canon (kinetic/energy/sephirotic/qliphothic/psychic/poison/radiation)
//   saveAttr: original save attribute → mapped to a target defense
//   dc     : cosmetic DC label (engage dialog rolls 2d10x10 + intent + skill)
//   intent/skill/attribute: feed the engage dialog's attack-roll + damage bonus
//   rider  : the non-damage effect text the GM still applies by hand
//   note   : prefix shown before the area/target line (triggers, recharge, etc.)
const CONV = {
  // ── Slippage Wraith ──────────────────────────────────────────────────────
  "9hq5jwIj5YSBrdoq": { // Phase Drain
    name:"Phase Drain", shape:"single", range:30, dice:"4d8", dmgType:"qliphothic",
    saveAttr:"body", dc:15, intent:"intrigue", skill:"weave", attribute:"soul",
    flavor:"It flickers to where you'll be standing, and drinks the difference.",
    rider:"On a failed save the wraith then teleports to an unoccupied space within 5 ft. of the target. On a success, half damage and no teleport." },
  "kkxg5fSVnhh8kTth": { // Moment Shear (Recharge 5–6)
    name:"Moment Shear (Recharge 5–6)", shape:"radius", size:20, range:20, dice:"4d6", dmgType:"psychic",
    saveAttr:"soul", dc:15, intent:"intrigue", skill:"weave", attribute:"soul",
    flavor:"A second too late, a second too early — both happen to you at once.",
    subject:"Each creature of the wraith's choice within 20 ft.", recharge:"5–6",
    rider:"On a failure, the target is also slowed until the end of its next turn (movement halved, no reactions, action OR bonus action — not both)." },

  // ── Qlipothic Shambler ───────────────────────────────────────────────────
  "ReRUEvQKRWLufsT0": { // Ruin-Spore Exhalation (Recharge 5–6)
    name:"Ruin-Spore Exhalation (Recharge 5–6)", shape:"cone", size:15, range:15, dice:"4d8", dmgType:"qliphothic",
    saveAttr:"body", dc:14, intent:"violence", skill:"warding", attribute:"body",
    flavor:"Black pollen, and the smell of a garden that gave up.",
    recharge:"5–6",
    rider:"On a failure, the target also cannot regain Integrity until the start of the shambler's next turn." },
  "FRERAKpsHN6qI7ZK": { // Wrong-Wave (death pulse)
    name:"Wrong-Wave", shape:"radius", size:10, range:10, dice:"1d6", dmgType:"qliphothic",
    saveAttr:"soul", dc:13, intent:"soul", skill:"warding", attribute:"soul",
    flavor:"The wrongness spills out of the hole where it used to be.",
    subject:"Each creature within 10 ft.",
    trigger:"Triggers when the Shambler is reduced to 0 Integrity." },

  // ── Gilbert ────────────────────────────────────────────────────────────────
  "6pjsOmieJwcWWD5M": { // Concession Catastrophe (Recharge 5-6)
    name:"Concession Catastrophe (Recharge 5-6)", shape:"radius", size:20, range:60, dice:"6d8", dmgType:"energy",
    saveAttr:"intrigue", dc:16, intent:"presence", skill:"performance", attribute:"presence",
    flavor:"Boiling butter, hard candy, carbonation spray, and nostalgic malice.",
    recharge:"5–6",
    rider:"The area becomes difficult terrain until the end of Gilbert's next turn." },
  "iVo9KSoEY6vRaxsy": { // Not Ready For Guests!
    name:"Not Ready For Guests!", shape:"radius", size:20, range:20, dice:"3d6", dmgType:"energy",
    saveAttr:"presence", dc:16, intent:"presence", skill:"performance", attribute:"presence",
    flavor:"A panic pulse — the theater is NOT ready for guests.",
    subject:"Each enemy within 20 ft.", trigger:"Triggers the first time Gilbert is reduced below 80 Integrity.",
    rider:"On a failure, the target is also pushed up to 15 ft. Gilbert then gains 15 temporary Integrity." },
  "lnLWOPl9xEJ0qaYy": { // Weaponized Shame
    name:"Weaponized Shame", shape:"single", range:60, dice:"4d8", dmgType:"psychic",
    saveAttr:"soul", dc:16, intent:"presence", skill:"performance", attribute:"presence",
    flavor:"Customer-service dread, weaponized.",
    rider:"On a failure, the target is rattled until the end of its next turn (disadvantage on its next attack roll or attribute check)." },

  // ── Razor Raider ────────────────────────────────────────────────────────────
  "RbBG55PdHSQgb0SF": { // Fragmentation Grenade (1/Day)
    name:"Fragmentation Grenade (1/Day)", shape:"radius", size:10, range:60, dice:"4d6", dmgType:"kinetic",
    saveAttr:"dex", dc:13, intent:"violence", skill:"firearms", attribute:"violence",
    flavor:"Pull pin. Throw. Apologize later.",
    uses:"1/Day" }
};

function buildSystem(c) {
  const targetDefense = SAVE_TO_DEFENSE[c.saveAttr] ?? "Resolve";
  const track = (c.dmgType === "psychic" || c.dmgType === "qliphothic") ? "stress" : "integrity";
  const sq = Math.max(1, Math.round((c.range ?? c.size ?? 5) / 5));
  const single = c.shape === "single";

  // cadence suffix: "Recharge 5–6." | "1/Day." | ""
  const cadence = c.recharge ? ("Recharge " + c.recharge + ".") : (c.uses ? (c.uses + ".") : "");

  // who/where the attack lands — `subject` overrides for full control
  let areaLabel;
  if (c.subject) {
    areaLabel = c.subject;
  } else if (single) {
    areaLabel = "One target within " + c.range + " ft.";
  } else {
    const base = "Each creature in a " + c.size + "-ft. " + c.shape;
    areaLabel = (c.range && c.range !== c.size) ? (base + " within " + c.range + " ft.") : base;
  }

  // plain-text effect line (shown in the engage dialog)
  const effectParts = [
    areaLabel + " rolls vs " + targetDefense + " (DC " + c.dc + ").",
    single ? "" : "Half damage on success.",
    c.rider ?? "",
    c.trigger ?? "",
    cadence
  ].filter(Boolean);
  const effectLine = effectParts.join(" ");

  // HTML description (rendered on the sheet)
  let descHtml = "<p><strong>" + (single ? "Save Attack." : "Area Attack.") + "</strong> " +
    areaLabel + " rolls <strong>" + targetDefense + "</strong> vs DC " + c.dc + ". " +
    "Hit: <code>" + c.dice + "</code> " + c.dmgType + " + " + c.attribute + (single ? "" : "; half on success") + ".";
  if (c.rider)   descHtml += " " + c.rider;
  if (c.trigger) descHtml += "<br/><em>" + c.trigger + "</em>";
  if (cadence)   descHtml += "<br/><em>" + cadence + "</em>";
  descHtml += "</p>";
  if (c.flavor)  descHtml += "<p><em>" + c.flavor + "</em></p>";

  return {
    category: "ranged",
    intent: c.intent, skill: c.skill,
    damage: { formula: c.dice, attribute: c.attribute, type: c.dmgType, damageFlavor: "", track },
    range: { short: sq, long: sq },
    tags: ["translated","5e-port","npc-action-wired", c.shape === "single" ? "single" : "aoe", `shape-${c.shape}`],
    effect: effectLine.trim(),
    flavor: c.flavor ?? "",
    description: { value: descHtml, chat: "" }
  };
}

const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();

const ops = [];
for await (const [key, it] of db.iterator()) {
  if (!key.startsWith("!actors.items!")) continue;
  const c = CONV[it._id];
  if (!c) continue;
  const sys = buildSystem(c);
  // shallow-merge the rfi.item flag block, preserving any existing keys
  const prevFlags = it.flags || {};
  const prevFt    = prevFlags.fourththing || {};
  const prevRfi   = prevFt.rfi || {};
  const prevItem  = prevRfi.item || {};
  const flags = {
    ...prevFlags,
    fourththing: {
      ...prevFt,
      rfi: {
        ...prevRfi,
        item: { ...prevItem, frame: c.shape === "single" ? "save-single" : "save", wiredFrom: "feature" }
      }
    }
  };
  const next = {
    ...it,
    name: c.name ?? it.name,
    type: "weapon",
    system: sys,
    flags,
    _stats: { ...(it._stats||{}), modifiedTime: Date.now() }
  };
  ops.push({ key, before: it, after: next, c });
}

console.log(`\n${APPLY ? "APPLYING" : "DRY RUN"} — ${ops.length} conversions\n`);
for (const o of ops) {
  console.log(`■ ${o.after.name}  (${o.before.type} → ${o.after.type})`);
  console.log(`   dmg ${o.after.system.damage.formula} ${o.after.system.damage.type} → ${o.after.system.damage.track}; intent=${o.after.system.intent} skill=${o.after.system.skill} attr=${o.after.system.damage.attribute}`);
  console.log(`   effect: ${o.after.system.effect}`);
}

if (APPLY) {
  const batch = db.batch();
  for (const o of ops) batch.put(o.key, o.after);
  await batch.write();
  console.log(`\n✔ wrote ${ops.length} items to ${PACK}`);
} else {
  console.log(`\n(dry run — re-run with --apply to write)`);
}
await db.close();
