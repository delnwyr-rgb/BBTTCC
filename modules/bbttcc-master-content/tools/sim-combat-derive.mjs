// sim-combat-derive.mjs — the actor half of bin/ft-sim-combat (sim-combat.mjs imports it): recompute Steward / NPC / monster
// derived stats from a pack dump with the LIVE formulas (module.js prepareDerivedData, threat-chassis.js, attackTest).
// Read-only; no CLI of its own. Installed from the 2026-11-12 combat balance review (scratch foes.mjs / derive.mjs).
import fs from "node:fs";
import { THREAT_CHASSIS } from "../../../systems/fourththing/threat-chassis.js";
const FAC = ["violence", "intrigue", "presence", "body", "mind", "soul"];
const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
// The chassis table is the LIVE one (combat balance 2026-11-12: imported, not copied, so it can't drift). The sim only
// reads th.tier / th.bracket from here and swaps th.defense out for its own CONFIG.chassis row (additive, so it cancels).
const C = THREAT_CHASSIS;
const ALIAS = { elite: "heavy", minion: "light", standard: "medium" };
const TRACK = { kinetic: "integrity", electrical: "integrity", thermal: "integrity", chemical: "integrity", poison: "integrity", psychic: "stress", sephirotic: "integrity", qliphothic: "stress", radiation: "radiation" };
const INT_BR = { vanguard: ["bulwark", "titanbound", "breaker", "aurablade", "harmony_marshal", "harmonymarshal"], mid: ["shadowjack", "shadow_courier", "soul_smith", "phantom_courier"], caster: ["dreamwalker", "wyrdlens_adept", "cosmic_linguist", "pactkeeper"] };
const BR_BASE = { vanguard: 4, mid: 3, caster: 2 }, STR_BASE = { vanguard: 2, mid: 3, caster: 4 };
const RANK_SCALE = { 0: [0, 0], 1: [0.5, 0], 2: [1, 0], 3: [1, 1], 4: [1, 2], 5: [1, 3] };
const WEIGHT = { light: "fitting", "light-cloth": "fitting", medium: "bracing", heavy: "plating" };
const WORN = new Set(["trinket", "pin", "lens", "boots", "implant", "wondrous", "ring", "amulet", "bracelet", "mask", "costume", "worn"]);
const STRIKER = ["aurablade", "bulwark", "harmony marshal", "shadow courier"];
const tierForLevel = L => L >= 16 ? 4 : L >= 11 ? 3 : L >= 6 ? 2 : 1;

export function load(DIR, f) {
  const rows = fs.readFileSync(`${DIR}/${f}`, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
  const actors = [], items = {}, aeA = {}, aeI = {};
  for (const r of rows) {
    const [, coll, id] = r.k.split("!");
    if (coll === "actors") actors.push(r.v);
    else if (coll === "actors.items") { const [a] = id.split("."); (items[a] ??= []).push(r.v); }
    else if (coll === "actors.effects") { const [a] = id.split("."); (aeA[a] ??= []).push(r.v); }
    else if (coll === "actors.items.effects") { const [a, i] = id.split("."); ((aeI[a] ??= {})[i] ??= []).push(r.v); }
  }
  return { actors, items, aeA, aeI };
}
const rowsOf = e => (Array.isArray(e?.changes) && e.changes.length ? e.changes : (e?.system?.changes || []));
const isAdd = ch => ch.type === "add" || Number(ch.mode) === 2;

export function actorKind(a) {
  if (a.flags?.["bbttcc-factions"]?.isFaction === true || String(a.system?.details?.type?.value || "").toLowerCase() === "faction") return "faction";
  const ek = String(a.flags?.["bbttcc-auto-link"]?.entityKind || "").toLowerCase();
  if (["rig", "facility", "monster", "npc"].includes(ek)) return ek;
  const r = a.flags?.fourththing?.rfi?.actor; if (r && (r.lineage || r.bestiary)) return "monster";
  return a.type === "rig" ? "rig" : a.type === "character" ? "steward" : a.type === "npc" ? "npc" : a.type;
}
function threatFor(a, kind) {
  if (kind !== "monster") return null;
  const rfi = a.flags?.fourththing?.rfi?.actor ?? {}, sys = a.system ?? {};
  const tier = Math.max(1, Math.min(4, ROMAN[rfi.tier] || Number(rfi.tier) || Number(sys.details?.tier) || 1));
  const raw = String(rfi.bracket || "medium").toLowerCase();
  const bracket = C.bracket[raw] ? raw : (ALIAS[raw] || "medium");
  const B = C.bracket[bracket], t = tier - 1;
  return { tier, bracket, bracketRaw: rfi.bracket || null, attack: C.attack[t], damage: C.damage[t], defense: C.defense[t], rank: C.rank[t], pool: B.pool[t], strikes: B.strikes[t], legendary: B.legendary?.[t] ?? 0 };
}
const meanDice = f => { let m = 0; for (const x of String(f || "").replace(/\s+/g, "").matchAll(/(\d*)d(\d+)/g)) m += Number(x[1] || 1) * (Number(x[2]) + 1) / 2; const fl = String(f || "").replace(/\s+/g, "").replace(/(\d*)d(\d+)(x\d+|kh\d+|kl\d+)?/g, "").match(/[+-]\d+/g); return m + (fl ? fl.reduce((s, v) => s + Number(v), 0) : 0); };
function aliasType(t, fl) { t = String(t || "kinetic").toLowerCase().split(":")[0]; if (t !== "energy") return t; fl = String(fl || "").toLowerCase(); return /cold|ice|frost|fire|hot|flame|heat|burn/.test(fl) ? "thermal" : /acid|base|alkal|caust/.test(fl) ? "chemical" : "electrical"; }
const trackFor = (track, type) => TRACK[type] || ((track === "stress" || track === "radiation") ? track : "integrity");

export function derive(a, D) {
  const kind = actorKind(a);
  const sys = structuredClone(a.system || {});
  const its = D.items[a._id] || [];
  // AE application (actor effects + transferred item effects), add rows only
  const effs = [...(D.aeA[a._id] || [])];
  for (const it of its) for (const e of (D.aeI[a._id]?.[it._id] || [])) if (e.transfer !== false) effs.push(e);
  const ae = { guard: 0, resolve: 0, evasion: 0, integrity: 0, stress: 0 };
  for (const e of effs) { if (e.disabled) continue; for (const ch of rowsOf(e)) { if (!isAdd(ch)) continue; const v = Number(ch.value) || 0;
    let m; if ((m = String(ch.key).match(/^system\.attributes\.(\w+)\.value$/)) && sys.attributes?.[m[1]]) sys.attributes[m[1]].value = (Number(sys.attributes[m[1]].value) || 0) + v;
    else if ((m = String(ch.key).match(/^system\.skills\.(\w+)\.value$/))) { sys.skills ??= {}; sys.skills[m[1]] ??= { value: 0 }; if (typeof sys.skills[m[1]] !== "object") sys.skills[m[1]] = { value: Number(sys.skills[m[1]]) || 0 }; sys.skills[m[1]].value = (Number(sys.skills[m[1]].value) || 0) + v; }
    else if ((m = String(ch.key).match(/^system\.derived\.(guard|resolve|evasion|integrity|stress)\.aeBonus$/))) ae[m[1]] += v; } }
  const A = Object.fromEntries(FAC.map(k => [k, Number(sys.attributes?.[k]?.value) || 0]));
  const sk = k => Number(sys.skills?.[k]?.value ?? sys.skills?.[k] ?? 0) || 0;
  if (a.type === "character") { const pl = sk("plating"), br = Math.max(sk("bracing"), pl), fi = Math.max(sk("fitting"), br); sys.skills ??= {}; if (sys.skills.bracing) sys.skills.bracing.value = br; if (sys.skills.fitting) sys.skills.fitting.value = fi; }
  const L = Math.max(1, Number(sys.details?.level) || 1);
  let br = "mid"; const cls = its.find(i => i.type === "class");
  for (const it of its) { if (it.type !== "class") continue; const id = String(it.system?.identifier || "").toLowerCase().replace(/-/g, "_"); for (const [k, ids] of Object.entries(INT_BR)) if (ids.includes(id)) { br = k; break; } }
  const th = threatFor(a, kind);
  const idf = id => its.some(i => String(i.system?.identifier || "") === id);
  let intMax = 10 + 3 * A.body + (L - 1) * (BR_BASE[br] + Math.floor(A.body / 2));
  if (idf("bbttcc_feat_grim_persistence")) intMax += 2 * L;
  if (idf("hardened-frame")) intMax += 2 * L;
  const intPreChassis = intMax;
  const tierNow = tierForLevel(L);
  let strikes = cls && STRIKER.some(n => String(cls.name).toLowerCase().startsWith(n)) ? tierNow : 1, legendary = 0;
  if (th) { intMax = Math.max(1, Math.round(intMax * th.pool)); strikes = th.strikes; legendary = th.legendary; }
  intMax = Math.max(1, intMax + ae.integrity);
  let strMax = 10 + 2 * A.mind + A.soul + (L - 1) * (STR_BASE[br] + Math.floor(A.mind / 2));
  const strPreChassis = strMax;
  if (th) strMax = Math.max(1, Math.round(strMax * th.pool));
  strMax = Math.max(1, strMax + ae.stress);
  let guard = 10 + A.violence + A.body, resolve = 10 + A.presence + A.soul, wouldEv = 10 + A.intrigue + A.body + ae.evasion;
  // armor
  const monster = kind === "monster";
  const gateSkill = it => { for (const t of it.system?.tags || []) { const k = WEIGHT[String(t).toLowerCase()]; if (k) return k; } return ["fitting", "bracing", "plating"].includes(it.system?.armorSkill) ? it.system.armorSkill : "fitting"; };
  const statRaw = (it, stat) => { let v; for (const e of (D.aeI[a._id]?.[it._id] || [])) { if (e.disabled) continue; for (const ch of rowsOf(e)) if (ch.key === `flags.fourththing.grant.${stat}`) v = (v ?? 0) + (Number(ch.value) || 0); } return v !== undefined ? v : (Number(it.system?.[{ guard: "guardBonus", evasion: "evasionBonus", resolve: "resolveBonus" }[stat]]) || 0); };
  const fold = (g, e) => e <= 0 ? g : Math.max(g, e) + Math.floor(Math.min(g, e) / 2);
  const slot = it => { const fr = it.flags?.fourththing?.rfi?.item?.frame || "", tg = (it.system?.tags || []).map(t => String(t).toLowerCase()); return fr === "shield" || tg.includes("shield") ? "shield" : fr === "footwear" || tg.includes("footwear") ? "feet" : tg.includes("helm") ? "head" : fr === "vestment" ? "vestment" : "body"; };
  const worn = its.filter(i => i.type === "armor" && i.system?.equipped !== false);
  let counted = worn;
  if (!monster) { const best = new Map(); for (const it of worn) { const [mu, fl] = RANK_SCALE[sk(gateSkill(it))] || RANK_SCALE[0]; const sc = [fold(statRaw(it, "guard"), statRaw(it, "evasion")), statRaw(it, "resolve")].reduce((n, r) => n + Math.round(r * mu) + (r > 0 ? fl : 0), 0); const s = slot(it), c = best.get(s); if (!c || sc > c.sc) best.set(s, { it, sc }); } counted = [...best.values()].map(b => b.it); }
  let armorG = 0, armorR = 0;
  const armorNames = [];
  for (const it of counted) { const rank = monster ? Math.max(2, sk(gateSkill(it))) : sk(gateSkill(it)); const [mu, fl] = RANK_SCALE[rank] || RANK_SCALE[0];
    const rg = fold(statRaw(it, "guard"), statRaw(it, "evasion")), re = statRaw(it, "evasion"), rr = statRaw(it, "resolve");
    const g = Math.round(rg * mu) + (rg > 0 ? fl : 0), e = Math.round(re * mu) + (re > 0 ? fl : 0), r = Math.round(rr * mu) + (rr > 0 ? fl : 0);
    armorG += g; armorR += r; wouldEv += e; armorNames.push(`${it.name}(+${g}/+${r}@r${rank})`); }
  for (const it of its) { if (it.type !== "gear" || !WORN.has(String(it.system?.slot || "")) || !it.flags?.fourththing?.equipped) continue; const g = fold(statRaw(it, "guard"), statRaw(it, "evasion")); armorG += g; armorR += statRaw(it, "resolve"); wouldEv += statRaw(it, "evasion"); }
  guard += armorG; resolve += armorR;
  for (const it of its) { const db = it.flags?.fourththing?.passives?.defenseBonus; if (db && typeof db === "object") { guard += fold(Number(db.guard) || 0, Number(db.evasion) || 0); resolve += Number(db.resolve) || 0; } }
  if (th?.defense) { guard += th.defense; resolve += th.defense; wouldEv += th.defense; }
  guard += ae.guard; resolve += ae.resolve;
  let folded = 0; if (kind !== "steward" && wouldEv > guard) { folded = wouldEv - guard; guard = wouldEv; }
  // resistances
  const res = new Set((sys.defenses?.resistances || []).map(String)), imm = new Set((sys.defenses?.immunities || []).map(String)), vul = new Set((sys.defenses?.vulnerabilities || []).map(String));
  for (const it of its) { for (const r of (it.flags?.fourththing?.grants?.resists || [])) res.add(String(r)); if (it.type === "armor" && it.system?.equipped !== false) for (const r of it.system?.resistances || []) res.add(String(r)); }
  for (const e of effs) { if (e.disabled) continue; for (const ch of rowsOf(e)) if (/grant\.(resists|resistances)$/.test(ch.key) || ch.key === "system.traits.dr.value") String(ch.value).split(/[,\s]+/).filter(Boolean).forEach(r => res.add(r)); }
  for (const S of [res, imm, vul]) if (S.has("energy")) { S.delete("energy"); ["electrical", "thermal", "chemical"].forEach(t => S.add(t)); }
  // strikes: weapons (non-rig)
  const detailsTier = Math.max(1, Math.min(4, Number(sys.details?.tier) || 1));
  const isFoe = a.type === "npc" || a.flags?.["bbttcc-auto-link"]?.entityKind === "npc" || (a.prototypeToken?.disposition === -1);
  const weapons = its.filter(i => i.type === "weapon" && !i.flags?.fourththing?.rigGear).map(w => {
    const type = aliasType(w.system?.damage?.type, w.system?.damage?.damageFlavor);
    const track = trackFor(String(w.system?.damage?.track || "").toLowerCase(), type);
    const intent = FAC.includes(String(w.system?.intent || "").toLowerCase()) ? String(w.system.intent).toLowerCase() : "violence";
    const skill = String(w.system?.skill || "melee");
    let rank = sk(skill); if (th && rank < th.rank) rank = th.rank;
    const grade = Number(w.flags?.fourththing?.grade?.attack) || 0;
    const atk = A[intent] + rank + (isFoe ? detailsTier : 0) + (th?.attack || 0) + grade;
    const f = String(w.system?.damage?.formula || "");
    const parts = (w.system?.damageParts || []).filter(p => p?.formula);
    const res0 = w.system?.manifestation?.resolution || {};
    const saveFirst = w.flags?.fourththing?.manifested !== true && (res0.mode === "save" || res0.shape === "save") && !!res0.saveAttribute;
    const na = w.flags?.fourththing?.npcAuto || {};
    const limited = !!na.recharge || /recharge|1\/day|1\/scene|once per/i.test(w.name);
    const dmgMean = meanDice(f) + A[intent] + (th?.damage || 0) + parts.reduce((s, p) => s + meanDice(p.formula), 0);
    const man = w.system?.manifestation || {};
    const st = man.appliedStates || {};
    const mtier = Math.max(1, Math.min(4, Number(man.tier) || 1));
    const saveDc = res0.saveDcMode === "fixed" && Number(res0.saveDcFixed) ? Number(res0.saveDcFixed) : 11 + 2 * mtier + Math.max(A.mind, A.soul);
    const areaSize = Number(man.area?.size) || 0;
    const rangedCat = /ranged|thrown/.test(String(w.system?.category || ""));
    return { name: w.name, formula: f, type, track, intent, skill, rank, atk, dmgMean: +dmgMean.toFixed(1), diceMean: meanDice(f), saveFirst, limited, ultimate: !!na.requires?.ownerBloodied,
      parts: parts.map(p => ({ formula: p.formula, type: aliasType(p.type || p.damageType || type, p.damageFlavor) })),
      saveAttr: String(res0.saveAttribute || "").toLowerCase() || null, saveDc, onSave: res0.onSave || "half",
      area: areaSize > 0 && man.area?.shape && man.area.shape !== "none", areaSize,
      states: (Array.isArray(st.states) ? st.states : st.states ? String(st.states).split(/[,\s]+/).filter(Boolean) : []).map(String), stateDur: st.duration || "1-round", saveEachRound: !!st.saveEachRound, stateSaveAttr: st.saveAttribute || res0.saveAttribute || null,
      recharge: na.recharge || (/1\/scene|1\/day|once per/i.test(w.name) ? { mode: "combat" } : null),
      ranged: rangedCat, grade, nonlethal: !!w.system?.nonlethal || (w.system?.tags || []).some(t => /mercy|nonlethal/i.test(t)),
      isForm: w.flags?.fourththing?.manifested === true, formTier: mtier };
  });
  const powers = its.filter(i => i.type === "power").length;
  const autoRules = its.reduce((n, i) => n + (i.flags?.fourththing?.npcAuto?.rules?.length || 0), 0);
  return { id: a._id, name: a.name, type: a.type, kind, level: L, detailsTier, rfiTier: a.flags?.fourththing?.rfi?.actor?.tier ?? null, th, attrs: A, facSum: FAC.reduce((s, k) => s + A[k], 0), facMax: Math.max(...FAC.map(k => A[k])), intBracket: br,
    intPre: intPreChassis, strPre: strPreChassis, intMax, strMax, guard, resolve, folded, armor: armorNames, res: [...res], imm: [...imm], vul: [...vul], weapons, powers, autoRules, strikes, legendary, isFoe,
    storedInt: a.system?.derived?.integrity?.max ?? null, disposition: a.prototypeToken?.disposition, cls: cls ? String(cls.system?.identifier || cls.name || "").toLowerCase() : null, clsName: cls ? cls.name : null, skills: Object.fromEntries(Object.entries(sys.skills || {}).map(([k, v]) => [k, Number(v?.value ?? v) || 0])), bloodied: its.filter(i=>i.type==="weapon").flatMap(i => (i.flags?.fourththing?.npcAuto?.rules || []).filter(r => r.on === "bloodied")).length };
}

