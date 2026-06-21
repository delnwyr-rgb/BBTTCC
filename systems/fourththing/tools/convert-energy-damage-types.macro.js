/**
 * Convert retired broad "energy" damage type → the energy family
 * (electrical / thermal / chemical) on stored data.
 *
 * The system already maps energy forward LAZILY at read/apply time
 * (_ftAliasEnergyDamage), so combat works without this. This macro is OPTIONAL
 * hygiene — it rewrites the stored JSON so sheets/editors show the new types
 * directly and the legacy "energy" string stops lingering in the data.
 *
 * Touches WORLD actors + their embedded items (manifestations/weapons), and
 * (optionally) unlocked Actor/Item compendia. Never touches locked packs.
 * Idempotent. DRY_RUN by default — flip to false to write.
 *
 * Mapping (matches systems/fourththing/module.js _ftAliasEnergyDamage):
 *   energy + cold/ice/frost            → thermal:cold
 *   energy + fire/hot/flame/heat/burn  → thermal:hot
 *   energy + acid                      → chemical:acid
 *   energy + base/alkaline/caustic     → chemical:base
 *   energy + thunder/lightning/bare    → electrical (flat)
 *   broad "energy" DEFENSE (no flavor) → electrical + thermal + chemical
 */
const DRY_RUN = true;
const INCLUDE_COMPENDIA = false;   // set true to also rewrite unlocked packs

function alias(type, flavor) {
  const t = String(type ?? "").toLowerCase();
  if (t !== "energy") return { type: t, flavor: String(flavor ?? "") };
  const f = String(flavor ?? "").toLowerCase();
  if (["cold","ice","frost"].includes(f))                  return { type: "thermal",  flavor: "cold" };
  if (["fire","hot","flame","heat","burn"].includes(f))    return { type: "thermal",  flavor: "hot"  };
  if (f === "acid")                                        return { type: "chemical", flavor: "acid" };
  if (["base","alkaline","caustic"].includes(f))           return { type: "chemical", flavor: "base" };
  return { type: "electrical", flavor: "" };
}

// ── defense arrays ──────────────────────────────────────────────────────────
function convertDefenseList(arr) {
  if (!Array.isArray(arr)) return { out: arr, changed: false };
  const out = [];
  let changed = false;
  const push = (e) => { const k = JSON.stringify(e); if (!out.some(x => JSON.stringify(x) === k)) out.push(e); };
  for (const e of arr) {
    const isStr = typeof e === "string";
    const type = isStr ? e.toLowerCase() : String(e?.type ?? "").toLowerCase();
    const flavor = isStr ? "" : String(e?.flavor ?? "");
    if (type !== "energy") { push(e); continue; }
    changed = true;
    if (!flavor) { for (const t of ["electrical","thermal","chemical"]) push(t); continue; }  // broad → all 3
    const a = alias("energy", flavor);
    push(a.flavor ? { type: a.type, flavor: a.flavor } : a.type);
  }
  return { out, changed };
}

function convertDefenses(defenses) {
  if (!defenses || typeof defenses !== "object") return null;
  const upd = {}; let any = false;
  for (const key of ["resistances","immunities","vulnerabilities"]) {
    const r = convertDefenseList(defenses[key]);
    if (r.changed) { upd[`system.defenses.${key}`] = r.out; any = true; }
  }
  return any ? upd : null;
}

// ── item damage data ────────────────────────────────────────────────────────
function convertItemUpdate(item) {
  const sys = item.system ?? {};
  const upd = {};
  const dr = sys.damageRoll;
  if (dr && String(dr.type ?? "").toLowerCase() === "energy") {
    const a = alias(dr.type, dr.flavor);
    upd["system.damageRoll.type"] = a.type;
    upd["system.damageRoll.flavor"] = a.flavor;
  }
  if (Array.isArray(sys.damageParts) && sys.damageParts.some(p => String(p?.type ?? "").toLowerCase() === "energy")) {
    upd["system.damageParts"] = sys.damageParts.map(p => {
      if (String(p?.type ?? "").toLowerCase() !== "energy") return p;
      const a = alias(p.type, p.flavor);
      return { ...p, type: a.type, flavor: a.flavor };
    });
  }
  const chainType = sys.manifestation?.chain?.damageType;
  if (String(chainType ?? "").toLowerCase() === "energy") {
    upd["system.manifestation.chain.damageType"] = alias("energy", "").type;
  }
  return Object.keys(upd).length ? upd : null;
}

async function processActor(actor, scope, rows) {
  const sys = actor.system?.system ?? actor.system;
  const defUpd = convertDefenses(sys?.defenses);
  if (defUpd) rows.push({ scope, kind: "actor-defenses", doc: actor, name: actor.name, upd: defUpd });
  for (const item of actor.items) {
    const iu = convertItemUpdate(item);
    if (iu) rows.push({ scope, kind: "item", doc: item, name: `${actor.name} › ${item.name}`, upd: iu });
  }
}

async function run() {
  const rows = [];
  for (const a of game.actors) await processActor(a, "world", rows);

  // World-level (unowned) items
  for (const item of game.items) {
    const iu = convertItemUpdate(item);
    if (iu) rows.push({ scope: "world", kind: "item", doc: item, name: item.name, upd: iu });
  }

  if (INCLUDE_COMPENDIA) {
    for (const pack of game.packs) {
      if (pack.locked) continue;
      if (pack.documentName === "Actor") {
        for (const a of await pack.getDocuments()) await processActor(a, `pack:${pack.collection}`, rows);
      } else if (pack.documentName === "Item") {
        for (const item of await pack.getDocuments()) {
          const iu = convertItemUpdate(item);
          if (iu) rows.push({ scope: `pack:${pack.collection}`, kind: "item", doc: item, name: item.name, upd: iu });
        }
      }
    }
  }

  if (!rows.length) { ui.notifications.info("Convert energy: nothing to do — no stored 'energy' damage/defenses found."); return; }

  console.log(`[convert-energy] ${DRY_RUN ? "DRY RUN — would update" : "UPDATING"} ${rows.length} doc(s):`);
  for (const r of rows) console.log(`  • [${r.scope}] ${r.kind}: ${r.name}`, r.upd);

  if (DRY_RUN) { ui.notifications.warn(`Convert energy: DRY RUN — ${rows.length} doc(s) would change. See console (F12). Set DRY_RUN=false to apply.`); return; }

  let ok = 0;
  for (const r of rows) { try { await r.doc.update(r.upd); ok++; } catch (e) { console.warn("[convert-energy] failed", r.name, e); } }
  ui.notifications.info(`Convert energy: updated ${ok}/${rows.length} doc(s).`);
}

run();
