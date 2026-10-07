#!/usr/bin/env node
/* lint-items.mjs — the bestiary lint's sibling for EVERY other content pack: finds mechanics that live only in prose (owner ask
 * 2026-10-06: "apply the same regimen to items, techniques, class abilities, manifestations, Path items"). `bin/ft-lint-items` symlinks here.
 * Reads the engines FROM SOURCE (ft-class-automation routers/tables, ft-progression grants, module.js derives, raid handlers) so
 * "automated" means "something executes it", never "a flag exists". Exit 1 on any ERROR.
 *
 *   P1 W  prose-only mechanic: the text states a rule and no engine data carries it (shape + engine hint per hit)
 *   I1 W  technique with mechanic text but only card routing (no TECHNIQUE_EFFECTS / grant / derive row)
 *   I2 W  triggers that are only chat-prompts (looks automated, executes nothing)
 *   I5 I  dead flag families nothing reads (bbttcc.opEffects/opHooks/hexHooks/tikkunHooks/tierLevel/subclassKey/featureKey)
 *   I6 W  power with no payload — E when its effect text is EMPTY (nothing to automate until it's written)
 *   I7 W  weapon rider prose (system.effect) with no live manifestation states/save
 *   I8 E  doctrine with no rules text · W doctrine key with no apply()/throughput handler
 *   I9 W  character-options tier feat with no bonuses and no AE (Strategic/Tactical lines nothing reads)
 *   I10 W foreign item type (not in fourththing template.json)
 *   I11 I mechanic-bearing feat/feature with empty system.identifier (nothing id-keyed can attach)
 *   I13 E automation data the engines can't execute: bad rerolls context/mode, grants entry shape, npcAuto schema
 *   I14 I calling Trick text with no per-use route
 */
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
import { validateNpcAuto } from "./npc-auto-schema.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const PACKS = argv.find((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!PACKS) { console.error("usage: ft-lint-items <packs-dir of *.jsonl live dumps> [--pack items,classes] [--rule P1,I7] [--json out] [--quiet]\n  dumps: bin/ft-dump-pack <pack> <dir>/<pack>.jsonl (character-options packs as co-<name>.jsonl)"); process.exit(2); }
const ONLY_PACK = opt("--pack")?.split(","), ONLY_RULE = opt("--rule")?.split(","), QUIET = argv.includes("--quiet"), JSON_OUT = opt("--json");
const read = (p) => fs.readFileSync(p, "utf8");

// ─── Engine tables ───────────────────────────────────────────────────────────
const CA = read(path.join(ROOT, "systems/fourththing/ft-class-automation.js"));
const PR = read(path.join(ROOT, "systems/fourththing/ft-progression.js"));
const MJ = read(path.join(ROOT, "systems/fourththing/module.js"));

function objKeys(src, startRe, endRe = /\n\};/) {
  const m = src.match(startRe); if (!m) return [];
  const seg = src.slice(m.index + m[0].length);
  const end = seg.search(endRe);
  const body = seg.slice(0, end);
  return [...body.matchAll(/^\s*"?([A-Za-z0-9_\-]+)"?\s*:/gm)].map(x => x[1]);
}
const FEATURE_ROUTER = (() => {
  const m = CA.match(/export const FEATURE_ROUTER = \{([\s\S]*?)\n\};/);
  const o = {};
  for (const x of m[1].matchAll(/^\s*"([^"]+)"\s*:\s*"([^"]+)"/gm)) o[x[1]] = x[2];
  return o;
})();
const NAME_ROUTER = (() => {
  const m = CA.match(/export const NAME_ROUTER = \[([\s\S]*?)\n\];/);
  return [...m[1].matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)].map(x => [x[1], x[2]]);
})();
const RETIRED = new Set(["bulwark_frame_pool","bulwark_ruin","bulwark_stance","cosmic_linguist_authority","pactkeeper_civic_charge"]);
const HIDDEN = new Set(["shadow_courier_crossing","shadow_courier_package"]);
// CHAR_OPT_ABILITIES: key -> type (info | soma-break | strategic-turn | scene | multi …)
const CHAR_OPT = (() => {
  const m = CA.match(/export const CHAR_OPT_ABILITIES = \{([\s\S]*?)\n\};/);
  const body = m[1]; const o = {};
  const re = /^  "([^"]+)":\s*\{/gm; let x;
  while ((x = re.exec(body))) {
    const tail = body.slice(x.index, x.index + 600);
    const t = tail.match(/\btype:\s*"([^"]+)"/);
    const multi = /\babilities:\s*\[/.test(tail);
    o[x[1]] = multi ? "multi" : (t ? t[1] : "?");
  }
  return o;
})();
const TECHNIQUE_EFFECTS = new Set(objKeys(CA, /export const TECHNIQUE_EFFECTS = \{/));
const TECHNIQUE_IDS = new Set([...(CA.match(/export const TECHNIQUE_IDS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g))].map(x => x[1]));
const ANCESTRY_CUSTOM = new Set(objKeys(CA, /const ANCESTRY_CUSTOM = \{/));
const ID_REROLL = new Set(objKeys(PR, /export const ID_REROLL_GRANTS = \{/));
const ITEM_APT = new Set([...(PR.match(/const ITEM_APTITUDE_GRANTS = \{([\s\S]*?)\n\};/)[1].matchAll(/"([^"]+)"\s*:/g))].map(x => x[1].toLowerCase()));
// id-keyed derives in module.js / ft-progression.js (bbttcc_feat_* literals outside the TECHNIQUE_IDS list)
const DERIVE_IDS = new Set([...(MJ + PR).matchAll(/"(bbttcc_feat_[a-z_]+)"/g)].map(x => x[1]));
// Surge
// surge key wiring is read from module.js: a key is wired when _FT_SURGE_MENU / _ftSurgeExecute mention it outside GM_DEFERRED_KEYS
const SURGE_SRC = MJ;
const GM_DEFERRED = new Set([...(SURGE_SRC.match(/GM_DEFERRED_KEYS\s*=\s*new Set\(\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(x => x[1]));
const SURGE = new Proxy({}, { get: (_, k) => typeof k === "string" ? { wired: new RegExp(`["'\`]${k}["'\`]`).test(SURGE_SRC) && !GM_DEFERRED.has(k), sets: GM_DEFERRED.has(k) ? ["GM_DEFERRED_KEYS"] : [], modSets: [], literal: false } : undefined });
// Courtly secrets
const SEC = read(path.join(ROOT, "modules/bbttcc-raid/scripts/raid-courtly.secrets.api.js"));
const EFFECT_KEYS = new Set([...SEC.match(/const EFFECT_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/)[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
// Doctrines: executing files = apply handlers / throughput handlers / raid console post-commit
function walk(d, acc = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (/node_modules|\/packs\/|\/tools\/|\/data\//.test(p)) continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc); else if (f.endsWith(".js")) acc.push(p);
  }
  return acc;
}
const RAID_FILES = [...walk(path.join(ROOT, "modules/bbttcc-raid")), ...walk(path.join(ROOT, "modules/bbttcc-factions")), ...walk(path.join(ROOT, "modules/bbttcc-campaign")), ...walk(path.join(ROOT, "modules/bbttcc-territory"))];
const EXEC_SRC = RAID_FILES.filter(f => {
  const s = read(f);
  return /\.apply *= *(async )?function|apply: *(async )?function|apply: *async|async apply\(|throughput: *\(|__THROUGHPUT|\bt: *\(c\) *=>/.test(s) || /module\.raid-console\.js$/.test(f);
}).map(f => read(f)).join("\n")
  // the strategic-throughput bundle executes many doctrine keys by name without the apply()/throughput markers above
  + "\n" + (fs.existsSync(path.join(ROOT, "modules/bbttcc-raid/scripts/strategic-throughput.js")) ? read(path.join(ROOT, "modules/bbttcc-raid/scripts/strategic-throughput.js")) : "");
const RC = read(path.join(ROOT, "modules/bbttcc-raid/scripts/module.raid-console.js"));
const CREW_GRANTS = new Set([...(RC.match(/const CREW_MANEUVER_GRANTS = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*"([^"]+)":/gm))].map(x => x[1].toLowerCase()));
const OCCULT_GRANTS = new Set([...(RC.match(/const OCCULT_MANEUVER_GRANTS = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*"([^"]+)":/gm))].map(x => x[1].toLowerCase()));

// ─── Text + shape detection ──────────────────────────────────────────────────
const strip = (h) => String(h || "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const MECH = [
  /[+−-]\s?\d+\b/, /\b\d*d\d+\b/, /\bDC\s?\d+/i, /\brolls? vs\b/i, /\badvantage\b/i, /\bdisadvantage\b/i, /\breroll/i,
  /\bresist(s|ance|ant)?\b/i, /\bimmun(e|ity)/i, /\b(Shaken|Imposed|Prone|Charmed|Frightened|Stunned|Restrained|Blinded|Paralyzed|Poisoned|Grappled|Dazed|Slowed|Surprised|Staggered)\b/,
  /\b(once|1x?)\s?(\/|per)\s?(scene|Soma Break|turn|round|session|chapter|day|raid|strategic turn)/i, /\b\d+\s?(\/|per)\s?(scene|Soma Break|turn)/i,
  /\b(skill|aptitude) rank/i, /\brank in\b/i, /\bgain (a|one|1|\d+) (rank|skill|bonus|use|die|dice)/i, /\btemp(orary)? Integrity/i, /\bregain\b/i, /\bheal(s|ing)?\b \d|\bheal(s|ing)? \w+ \d|\bheals?\b/i,
  /\b\d+ ?(ft|feet|squares?)\b/i, /\bspeed\b/i, /\binitiative\b/i, /\bdamage\b/i, /\bOPs?\b/, /\bmarks\b/i, /\bDarkness [+−-]|\bMorale [+−-]|[+−-]\s?\d+ (Darkness|Morale|Alarm|favor|Suspicion)/i,
  /\bClarity\b/, /\bSurge\b/, /\bStrain\b/, /\bFrame Dice\b/, /\bcap\b.*\b(raise|lower|\+|−|-)\b/i, /\bignore\b/i, /\bhalf (damage|speed|cost)/i, /\bdouble\b/i, /\bfree\b (action|cast|use|reroll)/i,
  /\bTactical:\s*(?!—)\S/, /\bStrategic:\s*(?!—)\S/, /\bPassive:\s*\S/i, /\bAction:\s*\S/i, /\bReaction:\s*\S/i
];
const hasMechanic = (t) => MECH.some(r => r.test(t));
const SHAPES = [
  ["reroll",    /\breroll/i],
  ["save",      /\bDC\s?\d+|\brolls? vs\b|\bsaving throw|\bsave\b|\bdefense check\b/i],
  ["condition", /\b(Shaken|Imposed|Prone|Charmed|Frightened|Stunned|Restrained|Blinded|Paralyzed|Poisoned|Grappled|Dazed|Slowed|Surprised|Staggered|Rallied|Resupplied)\b/],
  ["resist",    /\bresist(s|ance|ant)?\b|\bimmun(e|ity)|\bDR\b/i],
  ["damage",    /\bdamage\b|\b\d*d\d+\b/i],
  ["movement",  /\bspeed\b|\b\d+ ?(ft|feet|squares?)\b|\bclimb|\bfly\b|\bswim|\bteleport|\bmove (at|through)|\bdifficult terrain/i],
  ["aura",      /\baura\b|\ballies within\b|\bwithin \d+ (ft|feet|squares)|\bradius\b|\bearshot/i],
  ["reaction",  /\breaction\b|\bwhen (you|an ally|a creature|a foe|an enemy) (is|are|would|takes?|drops?|misses?|hits?)|\bafter (you|an ally) (fail|miss|succeed)|\bon a (hit|miss|failure|success)/i],
  ["resource",  /\bClarity\b|\bSurge\b|\bStrain\b|\bFrame Dice\b|\btemp(orary)? Integrity|\bregain\b|\bheal|\bIntegrity\b|\bPace\b|\bBurn\b|\buses? per\b|\bcharges?\b/i],
  ["economy",   /\bOPs?\b|\bmarks\b|\bEconomy\b|\bLogistics\b|\bIntrigue OP|\bViolence OP|\bSoft Power\b|\bDiplomacy OP|\bfaction\b|\bstrategic turn\b|\bDarkness\b|\bMorale\b|\bAlarm\b|\bfavor\b|\bSuspicion\b|\bcap\b|\braid\b|\bhex\b|\btrade route|\bsupply/i],
  ["bonus",     /[+−-]\s?\d+\b|\badvantage\b|\bdisadvantage\b|\bskill rank|\baptitude\b|\brank in\b|\bbonus\b|\bpenalty\b/i],
  ["downtime",  /\bSoma Break\b|\bscene break\b|\bbetween (scenes|sessions|turns)\b|\bdowntime\b|\bcraft|\brepair\b|\brest\b/i],
  ["narrative", /\bGM (truthfully|answers|picks|adjudicates|decides)|\bask (one|the GM)|\blearn (one|the)|\byou know\b|\bsense\b|\bdetect\b|\bread the room\b|\bstory\b/i],
];
const SHAPE_PRIORITY = ["empty","save","condition","reroll","resist","damage","movement","aura","reaction","resource","bonus","economy","downtime","narrative"];
function shapesOf(t) {
  const hits = SHAPES.filter(([s, r]) => r.test(t)).map(([s]) => s);
  if (/No rules text registered/i.test(t)) hits.unshift("empty");
  hits.sort((a, b) => SHAPE_PRIORITY.indexOf(a) - SHAPE_PRIORITY.indexOf(b));
  return hits.length ? hits : ["other"];
}
const shapeOf = (t) => shapesOf(t)[0];
const HINT = {
  empty: "doctrine has NO rules text at all — author the text first (lint: D1)",
  reroll: "flags.fourththing.rerolls (collectRerolls) or ID_REROLL_GRANTS row",
  save: "manifestation.save / weapon appliedStates (rider save) — strike riders need a weapon-side appliedStates reader (new)",
  condition: "manifestation.appliedStates.states or trigger effect {kind:'apply-state'} (new trigger effect kind)",
  resist: "flags.fourththing.grants.resistances / conditionImmunities (ftComputeDefenses) or AE",
  damage: "triggers effect extra-damage / damageRoll on a power",
  movement: "flags.fourththing.passives.movement (walkBonus/climb/fly/swim) or FT_FEAT_MOVE_GRANTS",
  aura: "new: generic ally-radius AE (reuse _ftCreateAllyAE + AURA_STATES pattern)",
  reaction: "flags.fourththing.triggers {event,predicate,effect} — add missing event kinds where needed",
  resource: "flags.fourththing.resourceGrants (cadence) or triggers grant-resource / add-temp-integrity",
  economy: "bbttcc-character-options.bonuses (OP via recalcActor) / raid EFFECTS apply or throughput bundle / factionEffects",
  bonus: "ActiveEffect changes (system.skills.X.value, system.derived.{guard,evasion,resolve}.aeBonus, initiative) or passives",
  downtime: "new: Soma-Break / scene-break hook (resourceGrants cadence covers refills only)",
  narrative: "generic_per_use card (FEATURE_ROUTER) — GM-adjudicated; no engine",
  other: "new",
};

// ─── Dump loading ────────────────────────────────────────────────────────────
function loadPack(file) {
  const L = read(path.join(PACKS, file)).split("\n").filter(Boolean).map(l => JSON.parse(l));
  const folders = new Map(L.filter(r => r.k.startsWith("!folders!")).map(r => [r.v._id, r.v]));
  const items = L.filter(r => r.k.startsWith("!items!")).map(r => r.v);
  const effs = new Map();
  for (const r of L.filter(r => r.k.startsWith("!items.effects!"))) {
    const parent = r.k.slice("!items.effects!".length).split(".")[0];
    if (!effs.has(parent)) effs.set(parent, []);
    effs.get(parent).push(r.v);
  }
  return { folders, items, effs };
}
function folderPath(folders, id) {
  const out = []; let cur = folders.get(id);
  while (cur) { out.unshift(cur.name); cur = folders.get(cur.folder); }
  return out.join(" / ");
}
const nonEmpty = (a) => Array.isArray(a) ? a.length > 0 : (a && typeof a === "object" ? Object.keys(a).length > 0 : !!a);

// ─── Per-item automation check ───────────────────────────────────────────────
function carriers(pack, v, effs) {
  const c = [];
  const ff = v.flags?.fourththing || {};
  const id = String(v.system?.identifier || "");
  const name = String(v.name || "");
  const aes = effs.get(v._id) || [];
  if (aes.some(e => (e.system?.changes || e.changes || []).length)) c.push("ae-changes");
  if (aes.some(e => e.flags?.fourththing?.applyOnUse)) c.push("applyOnUse-ae");
  if (nonEmpty(ff.rerolls)) c.push("rerolls");
  if (nonEmpty(ff.triggers)) {
    const kinds = ff.triggers.map(t => t?.effect?.kind);
    c.push(kinds.every(k => k === "chat-prompt") ? "triggers(chat-prompt only)" : "triggers");
  }
  if (nonEmpty(ff.resourceGrants)) c.push("resourceGrants");
  if (nonEmpty(ff.grants)) c.push("grants");
  if (nonEmpty(ff.passives)) c.push("passives");
  if (ff.rfi?.item?.consume) c.push("consume");
  if (ff.discipline && (nonEmpty(ff.discipline.passive) || nonEmpty(ff.discipline.mode))) c.push("discipline");
  // routers
  // Runtime-populated routes (two loops at the bottom of ft-class-automation.js):
  // TECHNIQUE_IDS -> "technique_use" (wins), CHAR_OPT keys -> "char_opt_lookup" (only if no literal route).
  let h = TECHNIQUE_IDS.has(id) ? "technique_use" : (FEATURE_ROUTER[id] || (CHAR_OPT[id] ? "char_opt_lookup" : null));
  if (!h) for (const [frag, hh] of NAME_ROUTER) if (name.includes(frag)) { h = hh; break; }
  if (h && !RETIRED.has(h) && !HIDDEN.has(h)) {
    if (h === "passive_info") c.push("router:passive_info");
    else if (h === "generic_per_use") c.push("router:generic_per_use");
    else if (h === "char_opt_lookup") { const t = CHAR_OPT[id]; c.push(t === "info" ? "char_opt:info" : `char_opt:${t}`); }
    else if (h === "technique_use") c.push(TECHNIQUE_EFFECTS.has(id) ? "technique_effect" : "technique:card-only");
    else c.push(`router:${h}`);
  }
  if (ID_REROLL.has(id)) c.push("ID_REROLL_GRANTS");
  if (ITEM_APT.has(name.toLowerCase().replace(/^technique:\s*/i, "").trim())) c.push("ITEM_APTITUDE_GRANTS");
  if (DERIVE_IDS.has(id) && !TECHNIQUE_EFFECTS.has(id)) c.push("id-derive(module.js)");
  if (ANCESTRY_CUSTOM.has(id)) c.push("ancestry_custom");
  // powers / weapons
  if (v.type === "power" || v.type === "weapon") {
    const mf = v.system?.manifestation || {};
    const st = mf.appliedStates?.states;
    if ((Array.isArray(st) && st.length) || (st && typeof st === "object" && Object.values(st).some(Boolean))) c.push("appliedStates");
    const ae = mf.appliedEffects;
    if (ae && ((ae.modifiers || []).length || (ae.resists || []).length || (ae.immunes || []).length)) c.push("appliedEffects");
    const dr = v.system?.damageRoll;
    if (dr && dr.op && dr.op !== "none" && Number(dr.number) > 0) c.push(`damageRoll:${dr.op}`);
    if (mf.save?.enabled) c.push("save");
    if (mf.chain?.enabled) c.push("chain");
    if (mf.area && mf.area.shape && mf.area.shape !== "none") c.push("area");
    if (v.type === "weapon" && String(v.system?.damage || "").trim()) c.push("weapon-damage");
  }
  if (v.type === "armor") {
    const s = v.system || {};
    if (Number(s.guardBonus) || Number(s.evasionBonus) || Number(s.resolveBonus)) c.push("armor-defense");
    if ((s.resistances || []).length) c.push("armor-resist");
  }
  if (v.type === "species" || v.type === "race") c.push("species-base");
  if (v.type === "class") c.push("class-anchor");
  if (v.type === "subclass") c.push("subclass-anchor");
  // pack-specific engines
  if (pack === "surge-abilities") {
    const k = ff.surgeKey; const s = SURGE[k];
    if (s && (s.wired || s.sets.some(x => x !== "GM_DEFERRED_KEYS") || s.modSets.length || s.literal)) c.push("surge-engine");
    else if (s) c.push("surge:gm-deferred");
  }
  if (pack === "courtly-secrets") {
    const ek = String(v.flags?.["bbttcc-raid"]?.secret?.effectKey || "");
    const keys = ek.split("+").map(x => x.trim()).filter(Boolean);
    if (keys.length && keys.every(k => EFFECT_KEYS.has(k))) c.push("secret-effectKey");
    else if (keys.length) c.push("secret:unknown-key");
  }
  if (pack === "doctrines") {
    const key = String(v.flags?.bbttcc?.key || "").toLowerCase();
    if (key && new RegExp("(^|[^a-z0-9_])" + key + "([^a-z0-9_]|$)", "m").test(EXEC_SRC)) c.push("raid-apply/throughput");
  }
  const bco = v.flags?.["bbttcc-character-options"];
  if (bco && nonEmpty(bco.bonuses)) c.push("co-bonuses(OP)");
  if (bco?.option?.key && pack === "co-crew-types") {
    const n = name.replace(/^Crew Type:\s*/i, "").replace(/\s*\(Tier \d\)/i, "").trim().toLowerCase();
    if (CREW_GRANTS.has(n)) c.push("crew-maneuver-grants");
  }
  if (pack === "co-occult-associations") {
    const n = name.replace(/^Occult Association:\s*/i, "").replace(/\s*\(Tier \d\)/i, "").replace(/\s*\/\s*/g, "/").trim().toLowerCase();
    if ([...OCCULT_GRANTS].some(g => g.replace(/\s*\/\s*/g, "/") === n)) c.push("occult-maneuver-grants");
  }
  if (pack === "co-npc-callings" && ff.calling) c.push("calling:attach-only");
  return c;
}
// Carriers that count as real automation (vs. a card / info dialog / attach-only / anchor).
const WEAK = new Set(["router:passive_info", "router:generic_per_use", "char_opt:info", "technique:card-only", "triggers(chat-prompt only)", "surge:gm-deferred", "secret:unknown-key", "calling:attach-only", "class-anchor", "subclass-anchor", "species-base", "crew-maneuver-grants", "occult-maneuver-grants"]);
const isAutomated = (c) => c.some(x => !WEAK.has(x));

function ownerOf(pack, v, folders) {
  const b = v.flags?.bbttcc || {}; const bco = v.flags?.["bbttcc-character-options"]?.option || {};
  return b.subclassIdentifier || b.classIdentifier || b.lineage || b.family || bco.key || v.flags?.fourththing?.path || v.flags?.fourththing?.calling?.key || folderPath(folders, v.folder) || v.system?.source?.custom || "";
}


// ─── Lint run ────────────────────────────────────────────────────────────────
const TEMPLATE_TYPES = new Set(Object.keys(JSON.parse(read(path.join(ROOT, "systems/fourththing/template.json"))).Item).filter(k => k !== "types"));
const REROLL_CONTEXTS = new Set([...PR.matchAll(/context:\s*"([a-z-]+)"/g)].map(m => m[1]));
const REROLL_MODES = new Set(["reroll-lowest", "reroll-highest"]);
const hits = [];
const hit = (rule, sev, pack, v, msg) => { if (ONLY_RULE && !ONLY_RULE.includes(rule)) return; hits.push({ rule, sev, pack, id: v._id, name: v.name, type: v.type, msg }); };
const PACK_FILES = fs.readdirSync(PACKS).filter(f => f.endsWith(".jsonl")).filter(f => !/^npcs/.test(f)).sort();
const summary = {};
for (const file of PACK_FILES) {
  const pack = file.replace(/\.jsonl$/, ""); if (ONLY_PACK && !ONLY_PACK.includes(pack)) continue;
  const { folders, items, effs } = loadPack(file);
  const S = summary[pack] = { total: items.length, mech: 0, automated: 0, prose: 0 };
  for (const v of items) {
    const isAnchor = ["class","subclass","species","race"].includes(v.type) || String(v.system?.category||"") === "heritage";
    const text = [strip(v.system?.description?.value), strip(v.system?.effect), strip(v.flags?.bbttcc?.effects?.text)].filter(Boolean).join(" ");
    const mech = hasMechanic(text), c = carriers(pack, v, effs), auto = isAutomated(c);
    if (mech) S.mech++; if (auto) S.automated++;
    const ff = v.flags?.fourththing || {}, id = String(v.system?.identifier || "");
    if (mech && !auto && !isAnchor) { S.prose++; const sh = shapeOf(text); hit("P1", "W", pack, v, `prose-only [${sh}] → ${HINT[sh]} :: ${text.slice(0, 110)}`); }
    if (c.includes("technique:card-only") && mech) hit("I1", "W", pack, v, `technique ${id} routes to a card only`);
    if (c.includes("triggers(chat-prompt only)")) hit("I2", "W", pack, v, "triggers are chat-prompts only");
    const b = v.flags?.bbttcc || {}; const dead = ["opEffects","opHooks","hexHooks","tikkunHooks","opDiscounts","tierLevel","subclassKey","featureKey"].filter(k => b[k] !== undefined);
    if (dead.length) hit("I5", "I", pack, v, `dead flags: bbttcc.${dead.join(", bbttcc.")}`);
    if (v.type === "power" && !c.some(x => /appliedStates|appliedEffects|damageRoll|^save$/.test(x))) { const eff = strip(v.system?.effect); hit("I6", eff ? "W" : "E", pack, v, eff ? `power with prose effect, no payload :: ${eff.slice(0, 90)}` : "power with EMPTY effect text and no payload"); }
    if (v.type === "weapon" && /DC\s?\d|rolls? vs|Shaken|Staggered|Prone|Restrained|Blinded|Charmed|Compelled|Imposed|push|knock/i.test(strip(v.system?.effect)) && !c.some(x => /appliedStates|^save$/.test(x)) && !nonEmpty(ff.npcAuto)) hit("I7", "W", pack, v, `weapon rider is prose only :: ${strip(v.system?.effect).slice(0, 90)}`);
    if (pack === "doctrines") { const t = strip(v.flags?.bbttcc?.effects?.text), d = strip(v.system?.description?.value); const rules = /No rules text registered/i.test(t) ? "" : (t || d.replace(/^[^.]*\bcost\b[^.]*\.?\s*/i, "")); if (!rules || /No rules text registered/i.test(d)) hit("I8", "E", pack, v, "doctrine has no rules text (only a cost line, or none)"); else if (!c.includes("raid-apply/throughput") && mech) hit("I8", "W", pack, v, `doctrine key "${v.flags?.bbttcc?.key}" has no apply()/throughput handler`); }
    if (/^co-(crew-types|occult-associations)$/.test(pack) && /\(Tier \d\)/.test(v.name) && !c.some(x => /co-bonuses|ae-changes|char_opt:(?!info)/.test(x)) && mech) hit("I9", "W", pack, v, "tier feat: Strategic/Tactical lines with no bonuses and no AE");
    if (!TEMPLATE_TYPES.has(v.type)) hit("I10", "W", pack, v, `foreign item type "${v.type}" — fourththing sheets/engines skip it`);
    if (["feat","feature"].includes(v.type) && mech && !id && !/^(courtly-secrets|co-npc-callings)$/.test(pack)) hit("I11", "I", pack, v, "mechanic text but empty system.identifier");
    for (const r of (Array.isArray(ff.rerolls) ? ff.rerolls : [])) { if (!REROLL_CONTEXTS.has(r?.context)) hit("I13", "E", pack, v, `rerolls.context "${r?.context}" unknown (engine: ${[...REROLL_CONTEXTS].join("/")})`); if (!REROLL_MODES.has(r?.mode)) hit("I13", "E", pack, v, `rerolls.mode "${r?.mode}"`); }
    for (const [k, arr] of Object.entries(ff.grants || {})) if (Array.isArray(arr)) for (const e of arr) if (!(typeof e === "string" || (e && typeof e === "object" && e.type))) hit("I13", "E", pack, v, `grants.${k} entry ${JSON.stringify(e)} — want "type" or {type, flavor}`);
    for (const p of validateNpcAuto(ff.npcAuto)) hit("I13", "E", pack, v, `npcAuto: ${p}`);
    if (pack === "co-npc-callings" && /Trick/i.test(text) && c.length === 1 && c[0] === "calling:attach-only") hit("I14", "I", pack, v, "calling Trick is prose with no per-use route");
  }
}
const byRule = {}; for (const h of hits) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
const errs = hits.filter(h => h.sev === "E").length;
console.log(`lint-items — ${Object.values(summary).reduce((n, s) => n + s.total, 0)} items in ${Object.keys(summary).length} packs · ${hits.length} hit(s), ${errs} ERROR · ${JSON.stringify(Object.fromEntries(Object.entries(byRule).sort()))}`);
console.log("  pack".padEnd(28) + "total  mech  auto  PROSE"); for (const [k, s] of Object.entries(summary)) console.log(`  ${k.padEnd(26)}${String(s.total).padStart(5)} ${String(s.mech).padStart(5)} ${String(s.automated).padStart(5)} ${String(s.prose).padStart(6)}`);
if (!QUIET) { hits.sort((a, b) => a.rule.localeCompare(b.rule) || a.pack.localeCompare(b.pack) || a.name.localeCompare(b.name)); for (const h of hits) console.log(`  ${h.rule} ${h.sev} ${h.pack} › ${h.name} [${h.type}] — ${h.msg}`); }
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, hits }, null, 1));
process.exit(errs ? 1 : 0);
