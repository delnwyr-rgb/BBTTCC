#!/usr/bin/env node
/* lint-bestiary.mjs — offline lint of a LIVE `npcs` pack dump (NPC Pack v1). `bin/ft-lint-bestiary` symlinks here.
 * Usage: ft-lint-bestiary <npcs.jsonl> [--assets assets.txt] [--rule A1,M1] [--folder substr] [--json out.json] [--quiet] [--all]
 *   Default scope skips "Test PCs" + "Testing Characters" (player test rigs — out of scope, ruled 2026-10-06); --all includes them.
 *   dumps: `bin/ft-dump-pack npcs x.jsonl` · `bin/ft-dump-pack --assets assets.txt`   (ember live = canonical)
 * Exit 1 when any ERROR-level hit remains.
 *
 * Rules (sev):
 *   A1 W  actor has no portrait / token art (default, mystery-man, grey core svg, or missing file)
 *   A2 I  …and an unwired art file on the box matches its name (a cheap fix)
 *   I1 E  broken image link (actor, token or embedded item) — file not on the live server   [needs --assets]
 *   I2 W  embedded item uses a grey core `icons/svg/*` or `systems/dnd5e/*.svg` icon (want full-colour webp or BBTTCC art)
 *   T1 E  lineage flag on a non-`npc` actor, or a `npc` in a Bestiary folder with no lineage
 *   T2 W  named NPC (`character` in an NPC folder) without flags.bbttcc-auto-link.entityKind:"npc" — skips foe rules
 *   T3 W  `role` holds a title, not a role (role vocab: brute caster hardened stealth scout support striker controller skirmisher)
 *   T4 W  duplicate actor (same name, same folder)
 *   L1 E  lineage signature broken: missing signature resist/vuln/condition-immunity, or creatureType ≠ lineage's
 *   L2 W  no Lineage Trait item (wild/hex-touched/pre-fall/sephirotic/dream/revenant trait name, mortal banner trait, qliphothic "Aura of")
 *   L3 W  no weapon deals the lineage's signature damage type
 *   B1 I  stored Integrity ≠ runtime max (harmless since the threat chassis fills fresh monsters to max — informational)
 *   B4 E  monster has no weapon item — it cannot hurt anyone in automated play
 *   B2 W  weapon damage dice outside the tier budget (mean of dice, before faculty; Stress-track weapons may run to ½ the floor)
 *   B3 E  tier × bracket coverage hole (every tier needs light, medium, heavy AND boss — ruled 2026-10-06)
 *   M1 W  ability states a mechanic in prose but nothing automates it (no manifestation / triggers / damageParts / AE / consume)
 *   M2 W  weapon carries a rider in `system.effect` text with no manifestation block to apply it
 *   M3 I  animated (flags.autoanimations) but mechanically inert — it looks like it did something
 *   M4 E  automation data the system can't execute (npcAuto rule / weapon manifestation fails npc-auto-schema.mjs)
 *   S1 W  shell: fewer than 2 items, or no biography
 *   P1 W  bounty off the approved rubric (tierBase 5/10/20/40 × bracket light 1 · medium 1.5 · heavy 2 · boss 3)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUDGET, LIMITED_RE, meanDice, budgetFor, trackOf } from "./threat-budget.mjs";
import { validateNpcAuto, validateWeaponManifestation, statesList } from "./npc-auto-schema.mjs";

const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const FILE = argv.find((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
if (!FILE) { console.error("usage: ft-lint-bestiary <npcs.jsonl> [--assets assets.txt] [--rule A1,M1] [--folder s] [--json out] [--quiet]"); process.exit(2); }
const OUT_OF_SCOPE = argv.includes("--all") ? null : /^(Test PCs|Testing Characters)(\/|$)/;
const ONLY = opt("--rule")?.split(","), FOLDER = opt("--folder")?.toLowerCase(), QUIET = argv.includes("--quiet");
const ASSETS = opt("--assets") ? new Set(fs.readFileSync(opt("--assets"), "utf8").split("\n").filter(Boolean)) : null;

// ── lineage signatures: read straight from the builder so the lint can never drift from it ─────────────
const HERE = path.dirname(fileURLToPath(import.meta.url));
const builderSrc = fs.readFileSync(path.join(HERE, "../../bbttcc-auto-link/scripts/monster-builder.js"), "utf8");
const block = builderSrc.slice(builderSrc.indexOf("const MORTAL_BANNERS"), builderSrc.indexOf("const LINEAGE_BY_KEY"));
const { LINEAGES, MORTAL_BANNERS, QLIPHOTH } = new Function(`${block}; return { LINEAGES, MORTAL_BANNERS, QLIPHOTH };`)();
const LIN = Object.fromEntries(LINEAGES.map(l => [l.key, l]));

// ── load ────────────────────────────────────────────────────────────────────────────────────────────────
const recs = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const folders = Object.fromEntries(recs.filter(r => r.k.startsWith("!folders!")).map(r => [r.v._id, r.v]));
const fpath = id => { const s = []; for (let f = folders[id]; f; f = folders[f.folder]) s.unshift(f.name); return s.join("/") || "(root)"; };
const actors = recs.filter(r => r.k.startsWith("!actors!")).map(r => r.v);
const items = {}; for (const r of recs.filter(r => r.k.startsWith("!actors.items!"))) (items[r.k.split("!")[2].split(".")[0]] ??= []).push(r.v);
const effects = {}; for (const r of recs.filter(r => r.k.startsWith("!actors.items.effects!"))) { const [a, i] = r.k.split("!")[2].split("."); (effects[`${a}.${i}`] ??= []).push(r.v); }

const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
const ROLES = new Set(["brute", "caster", "hardened", "stealth", "scout", "support", "striker", "controller", "skirmisher", ""]);
const BRACKETS = ["light", "medium", "heavy", "boss"];
const BOUNTY = { tier: [5, 10, 20, 40], br: { light: 1, medium: 1.5, heavy: 2, boss: 3 } };
const MECH = /\b(DC\s*\d+|\d+d\d+|[A-Z][a-z]+ check|save|saving|prone|staggered|restrained|blinded|shaken|charmed|compelled|burning|stunned|frightened|poisoned|push(ed)?|pull(ed)?|teleport|resistance|immune|regain|heal|temporary Integrity|reroll|advantage|disadvantage|aura|reaction|half Integrity|recharge)\b/i;
const DEFAULT_IMG = s => !s || /mystery-man|^icons\/svg\/|^systems\/dnd5e\/.*\.svg$|token-?default/i.test(s);
const exists = s => !ASSETS || !s || /^https?:/.test(s) || ASSETS.has(decodeURIComponent(s).replace(/^\/+/, ""));
const descOf = i => String(i.system?.description?.value ?? i.system?.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// the About panel's bio (system.biography.notes, 2026-10-06) first; legacy homes after
const bioOf = a => String(a.system?.biography?.notes || a.system?.details?.biography?.value || a.system?.details?.biography || a.system?.notes || "").replace(/<[^>]+>/g, "").trim();
// a manifestation block counts only when it DOES something — the seeders stamped empty default blocks on every monster
// weapon (2026-10-06: 0/138 live), which the old "has keys" test mistook for automation
const liveManifest = m => !!m && (!!statesList(m.appliedStates?.states).length || !!(m.appliedEffects?.modifiers || []).length
  || !!(m.appliedEffects?.resists || []).length || !!(m.appliedEffects?.immunes || []).length || !!m.resolution?.saveAttribute);
const automated = (a, i) => liveManifest(i.system?.manifestation) || !!i.flags?.fourththing?.triggers?.length || !!i.flags?.fourththing?.npcAuto
  || !!i.system?.damageParts?.length || !!(effects[`${a._id}.${i._id}`] || []).length || !!i.flags?.fourththing?.rfi?.item?.consume
  || !!i.flags?.fourththing?.automation || !!i.flags?.fourththing?.passives?.aura || !!i.flags?.fourththing?.passives?.checkBonus || !!i.flags?.fourththing?.passives?.ranks;   // pass-7 passives count (2026-10-07)

// art index for A2: file basenames on the box, normalised
const artIndex = ASSETS ? [...ASSETS].filter(p => /^(art|modules\/bbttcc-[^/]+\/art)\//.test(p) && /\.(webp|png|jpe?g)$/i.test(p)) : [];
const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function artFor(name) {
  const full = norm(name); const exact = artIndex.filter(p => norm(path.basename(p).replace(/\.\w+$/, "")).replace(/\d+$/, "") === full);
  if (exact.length) return exact.slice(0, 3);
  const key = norm(name.replace(/^(the|dr\.?|captain|sergeant|mayor|brother|purser|harbourmaster|lady|lieutenant|miss)\s+/i, "").split(/[,(—-]/)[0]);
  if (key.length < 6) return [];
  return artIndex.filter(p => norm(path.basename(p).replace(/\.\w+$/, "")).startsWith(key)).slice(0, 3);
}

// ── rules ───────────────────────────────────────────────────────────────────────────────────────────────
const hits = [];
const hit = (rule, sev, a, msg, item) => { if (!ONLY || ONLY.includes(rule)) hits.push({ rule, sev, actor: a.name, id: a._id, folder: fpath(a.folder), item: item?.name, msg }); };
const coverage = {};
for (const a of actors) {
  const f = fpath(a.folder); if (FOLDER && !f.toLowerCase().includes(FOLDER)) continue;
  if (OUT_OF_SCOPE?.test(f)) continue;
  const its = items[a._id] || [], rfi = a.flags?.fourththing?.rfi?.actor || {}, lin = rfi.lineage, isRig = a.type === "rig";
  const bestiaryFolder = /Bad Eden Monsters|Qliphothic Bestiary/.test(f), npcFolder = /Bad Eden NPCs|Quest NPCs|NPCs and Spares/.test(f);

  // art
  if (!isRig && (DEFAULT_IMG(a.img) || DEFAULT_IMG(a.prototypeToken?.texture?.src) || !exists(a.img) || !exists(a.prototypeToken?.texture?.src))) {
    hit("A1", "W", a, `no ${DEFAULT_IMG(a.img) || !exists(a.img) ? "portrait" : ""}${DEFAULT_IMG(a.prototypeToken?.texture?.src) ? " token" : ""}`.replace(/  /, " "));
    const cand = artFor(a.name); if (cand.length) hit("A2", "I", a, `unwired art on the box: ${cand.join(" · ")}`);
  }
  for (const [what, src] of [["portrait", a.img], ["token", a.prototypeToken?.texture?.src]]) if (!exists(src)) hit("I1", "E", a, `broken ${what}: ${src}`);
  for (const i of its) {
    if (!exists(i.img)) hit("I1", "E", a, `broken icon: ${i.img}`, i);
    else if (/^icons\/svg\/|^systems\/dnd5e\/.*\.svg$/.test(i.img || "")) hit("I2", "W", a, `grey icon ${i.img}`, i);
  }

  // type consistency
  if (lin && a.type !== "npc") hit("T1", "E", a, `lineage "${lin}" on a ${a.type}`);
  if (!lin && a.type === "npc" && bestiaryFolder) hit("T1", "E", a, "npc in a Bestiary folder with no lineage");
  if (a.type === "character" && npcFolder && a.flags?.["bbttcc-auto-link"]?.entityKind !== "npc") hit("T2", "W", a, "named NPC without entityKind:\"npc\" (no foe tier bonus, PC Last Stand)");
  if (lin && !ROLES.has(String(a.system?.role ?? "").toLowerCase())) hit("T3", "W", a, `role is a title: "${a.system.role}"`);

  // shells
  if (!isRig && (its.length < 2 || bioOf(a).length < 20)) hit("S1", "W", a, `shell — ${its.length} item(s)${bioOf(a).length < 20 ? ", no bio" : ""}`);

  // lineage
  if (lin) {
    const L = LIN[lin], tier = ROMAN[rfi.tier] || Number(a.system?.details?.tier) || 1, br = rfi.bracket;
    (coverage[tier] ??= new Set()).add(br);
    if (!L) hit("L1", "E", a, `unknown lineage "${lin}"`);
    else {
      const def = a.system?.defenses || {}, has = (arr, x) => (arr || []).map(String).some(v => v === x || v.startsWith(x + ":"));
      const grants = its.flatMap(i => [...(i.flags?.fourththing?.grants?.resists || [])]);
      const miss = [...L.resist.filter(x => !has(def.resistances, x) && !grants.includes(x)).map(x => `resist ${x}`),
                    ...L.vuln.filter(x => !has(def.vulnerabilities, x)).map(x => `vuln ${x}`),
                    ...L.condImm.filter(x => !(a.system?.conditionImmunities || []).includes(x)).map(x => `immune ${x}`)];
      if (miss.length) hit("L1", "E", a, `signature missing: ${miss.join(", ")}`);
      const ct = a.flags?.fourththing?.creatureType; if (ct && !String(ct).split(",").includes(L.creatureType)) hit("L1", "E", a, `creatureType "${ct}" ≠ ${lin}'s "${L.creatureType}"`);
      if (!ct) hit("L1", "E", a, `no creatureType (want "${L.creatureType}")`);
      const traitName = lin === "mortal" ? MORTAL_BANNERS[rfi.subLineage]?.trait?.name : L.trait?.name;
      const hasTrait = lin === "qliphothic" ? its.some(i => /^Aura of/i.test(i.name)) : traitName ? its.some(i => i.name.toLowerCase().includes(traitName.toLowerCase())) : true;
      if (!hasTrait) hit("L2", "W", a, `no Lineage Trait item ("${lin === "qliphothic" ? "Aura of <Vice>" : traitName ?? `banner "${rfi.subLineage}" has no trait`}")`);
      const wtypes = its.filter(i => i.type === "weapon").map(i => String(i.system?.damage?.type || "").split(":")[0]);
      if (wtypes.length && !wtypes.includes(L.damageType)) hit("L3", "W", a, `no ${L.damageType} weapon (has ${[...new Set(wtypes)].join("/")})`);
    }
    // runtime vs stored Integrity
    const s = a.system || {}, b = Number(s.attributes?.body?.value) || 0, Lv = Math.max(1, Number(s.details?.level) || 1);
    const real = 10 + 3 * b + (Lv - 1) * (3 + Math.floor(b / 2)), stored = Number(s.derived?.integrity?.max) || 0;
    if (stored && stored !== real) hit("B1", "I", a, `stored Integrity ${stored}; pre-chassis runtime ${real}`);
    if (!its.some(i => i.type === "weapon")) hit("B4", "E", a, "no weapon — harmless in automated play");
    for (const w of its.filter(i => i.type === "weapon")) {
      const track = trackOf(w), m = meanDice(w.system?.damage?.formula), [lo, cap] = budgetFor(tier, LIMITED_RE.test(w.name), track);
      if (m && (m < lo || m > cap)) hit("B2", "W", a, `${w.system.damage.formula} (mean ${m}) outside T${tier}${track === "stress" ? " Stress-track" : ""} budget ${lo}–${cap}`, w);
    }
    const pb = rfi.price?.bounty, want = Math.ceil(BOUNTY.tier[tier - 1] * (BOUNTY.br[br] ?? 1) / 5) * 5;   // marks round UP to 5
    if (pb == null) hit("P1", "W", a, `no bounty (rubric ${want})`); else if (Number(pb) !== want) hit("P1", "W", a, `bounty ${pb} ≠ rubric ${want}`);
  }

  // automation (abilities on every non-rig actor)
  if (!isRig) for (const i of its) {
    const isAbility = ["feat", "feature", "power"].includes(i.type), d = descOf(i);
    if (isAbility && MECH.test(d) && !automated(a, i) && !/^(class|subclass|species)$/.test(i.type))
      hit("M1", "W", a, `prose-only mechanic: "${d.match(MECH)[0]}" — ${d.slice(0, 90)}`, i);
    if (i.type === "weapon" && String(i.system?.effect || "").replace(/<[^>]+>/g, "").trim() && !automated(a, i))
      hit("M2", "W", a, `rider is text only: ${String(i.system.effect).replace(/<[^>]+>/g, "").slice(0, 90)}`, i);
    if (i.flags?.autoanimations && isAbility && !automated(a, i)) hit("M3", "I", a, "animates but does nothing", i);
    for (const prob of [...validateNpcAuto(i.flags?.fourththing?.npcAuto), ...(i.type === "weapon" && liveManifest(i.system?.manifestation) ? validateWeaponManifestation(i.system.manifestation) : [])])
      hit("M4", "E", a, prob, i);
  }
}
// duplicates
const seen = {}; for (const a of actors) { const k = `${a.folder}|${a.name}`; (seen[k] ??= []).push(a); }
for (const g of Object.values(seen)) if (g.length > 1 && (!FOLDER || fpath(g[0].folder).toLowerCase().includes(FOLDER))) hit("T4", "W", g[0], `${g.length} copies in ${fpath(g[0].folder)}`);
// coverage
const covActor = { name: "(pack)", _id: "-", folder: null };
for (const t of [1, 2, 3, 4]) for (const br of BRACKETS) if (!coverage[t]?.has(br)) hit("B3", "E", covActor, `no T${t} ${br}`);

// ── report ──────────────────────────────────────────────────────────────────────────────────────────────
const byRule = {}; for (const h of hits) byRule[h.rule] = (byRule[h.rule] || 0) + 1;
const errs = hits.filter(h => h.sev === "E").length;
console.log(`lint-bestiary — ${actors.length} actors · ${hits.length} hit(s), ${errs} ERROR · ${JSON.stringify(Object.fromEntries(Object.entries(byRule).sort()))}${ASSETS ? "" : "  (no --assets: I1/A2 skipped)"}`);
if (!QUIET) {
  hits.sort((a, b) => a.rule.localeCompare(b.rule) || a.folder.localeCompare(b.folder) || a.actor.localeCompare(b.actor));
  for (const h of hits) console.log(`  ${h.rule} ${h.sev} ${h.folder} › ${h.actor}${h.item ? ` › ${h.item}` : ""} — ${h.msg}`);
}
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(hits, null, 1));
process.exit(errs ? 1 : 0);
