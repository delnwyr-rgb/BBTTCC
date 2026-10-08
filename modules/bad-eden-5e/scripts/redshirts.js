/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · redshirts.js — The Crashtest Redshirts (the GM self-test)
 * ─────────────────────────────────────────────────────────────────────────────
 * A disposable squad, one per Bad Eden class, built DIRECTLY (no advancement
 * dialogs) plus a few bestiary foes, dropped on a scratch scene and marched
 * through the engine checklist: pools, costs, upcasting, limits, Mastery,
 * attacks and damage, Surge paths, rests, the instability table, 0 HP.
 *
 *   game.badEden5e.redshirts.build()      make (or remake) the squad + range
 *   game.badEden5e.redshirts.run()        build if needed, then the gauntlet
 *   game.badEden5e.redshirts.teardown()   delete everything it made
 *
 * Every step logs PASS / FAIL with the numbers it saw; the summary goes to the
 * console and a GM-whispered chat card. GM only — it creates scenes and combats.
 * ───────────────────────────────────────────────────────────────────────────── */
import { MOD, TRADITIONS, castingFor, costAt, traditionOf, setPoints } from "./casting.js";

const TAG = `${MOD} | redshirts`;
const FOLDER = "The Crashtest Redshirts";
const SCENE = "Crashtest Range";
const PACK = (p) => game.packs.get(`${MOD}.${p}`);

// One per class. `path` / `doctrine` are surge-powers keys; `mastery` is the
// skill that gets the Mastery flag for the reliable-talent check.
const SQUAD = [
  { name: "Redshirt Theurge",    cls: "theurge",    level: 5, path: "aurablade", doctrine: "stillheart",
    abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 16, cha: 14 }, weapon: "Hex-Script Pistol", mastery: "arc" },
  { name: "Redshirt Gearwright", cls: "gearwright", level: 5, path: "linguist",  doctrine: "annotator",
    abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }, weapon: "Laser Pistol, Rad", mastery: "inv" },
  { name: "Redshirt Warden",     cls: "warden",     level: 5, path: "bulwark",   doctrine: "mountain",
    abilities: { str: 16, dex: 12, con: 16, int: 8,  wis: 14, cha: 10 }, weapon: "Hand Axe", mastery: "ath",
    // one technique per rider kind (scripts/riders.js): bank · impose · temp HP · strain · bank-to-ally
    techniques: ["Calculated Risk", "Controlled Aggression", "Relentless Advance", "Darkness Hardened", "Pressure Transference"] },
  { name: "Redshirt Vigilant",   cls: "vigilant",   level: 5, path: "wyrdlens",  doctrine: "truth",
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 10 }, weapon: "Combat Knife", mastery: "prc" }
];
// Road Bandit = the punching bag; the other two carry rich npcAuto automation (save/attack riders + GM reminders).
const FOES = ["Road Bandit", "Crystal Lurker", "Slippage Wraith"];

const log = (...a) => console.log(TAG, ...a);
// dnd5e keeps advancement as an array in some builds and an id-keyed object in others.
const advs = (sys) => { const a = sys?.advancement; return Array.isArray(a) ? a : Object.values(a ?? {}); };
const OVERRIDE = CONST.ACTIVE_EFFECT_CHANGE_TYPES?.OVERRIDE ?? CONST.ACTIVE_EFFECT_MODES?.OVERRIDE ?? 5;

/* ── Building ─────────────────────────────────────────────────────────────── */

async function folderFor(type) {
  return game.folders.find(f => f.type === type && f.name === FOLDER)
    ?? Folder.create({ name: FOLDER, type, color: "#b03a2e" });
}

async function indexed(pack, fields) {
  const p = PACK(pack);
  if (!p) throw new Error(`pack ${MOD}.${pack} is not registered`);
  return [...await p.getIndex({ fields })];
}

/** Feature grants a class/subclass hands out by `level`: ItemGrants outright, the first N of each ItemChoice pool. */
async function grantsUpTo(doc, level, originId) {
  const out = [];
  for (const adv of advs(doc.system)) {
    if (adv.type === "ItemGrant" && (adv.level ?? 0) <= level) {
      for (const it of adv.configuration?.items ?? []) out.push([it.uuid, `${originId}.${adv._id}`]);
    } else if (adv.type === "ItemChoice") {
      let n = 0;
      for (const [lvl, c] of Object.entries(adv.configuration?.choices ?? {})) if (Number(lvl) <= level) n += Number(c.count) || 0;
      for (const it of (adv.configuration?.pool ?? []).slice(0, n)) out.push([it.uuid, `${originId}.${adv._id}`]);
    }
  }
  const docs = [];
  for (const [uuid, origin] of out) {
    const d = await fromUuid(uuid).catch(() => null);
    if (!d) { console.warn(TAG, "missing grant", uuid); continue; }
    const data = d.toObject();
    foundry.utils.setProperty(data, "flags.dnd5e.advancementOrigin", origin);
    docs.push(data);
  }
  return docs;
}

/** The proficiencies a class's level-1 Trait advancements grant (plus the first N of each choice). */
function traitsOf(classDoc) {
  const picked = [];
  for (const adv of advs(classDoc.system)) {
    if (adv.type !== "Trait" || (adv.level ?? 0) > 1) continue;
    picked.push(...(adv.configuration?.grants ?? []));
    for (const ch of adv.configuration?.choices ?? []) picked.push(...(ch.pool ?? []).slice(0, Number(ch.count) || 0));
  }
  const update = { "system.traits.weaponProf.value": [], "system.traits.armorProf.value": [] };
  for (const t of picked) {
    const [kind, key] = String(t).split(":");
    if (kind === "saves") update[`system.abilities.${key}.proficient`] = 1;
    else if (kind === "skills") update[`system.skills.${key}.value`] = 1;
    else if (kind === "weapon") update["system.traits.weaponProf.value"].push(key);
    else if (kind === "armor") update["system.traits.armorProf.value"].push(key);
    else if (kind === "tool") update[`system.tools.${key}`] = { value: 1, ability: "int" };
  }
  return update;
}

function surgePathData(pathKey, doctrineKey) {
  const SP = "surge-powers";
  const def = game.surgePowers?.paths?.data?.[pathKey];
  if (!def) return null;
  const doc = def.doctrines?.[doctrineKey];
  return {
    name: doc ? `${def.name} (${doc.name})` : def.name, type: "feat", img: def.img || "icons/svg/mystery-man.svg",
    system: { description: { value: `<p><em>${def.tagline ?? ""}</em></p>${def.entry?.description ?? ""}${doc ? `<h3>Doctrine: ${doc.name}</h3>${doc.perk?.description ?? ""}` : ""}` } },
    flags: { [SP]: { path: { key: pathKey, ...(doc ? { doctrine: doctrineKey } : {}) } } }
  };
}

async function buildRedshirt(spec, folder) {
  const classes = await indexed("classes", ["system.identifier"]);
  const classEntry = classes.find(e => e.system?.identifier === spec.cls);
  if (!classEntry) throw new Error(`no class with identifier ${spec.cls}`);
  const classDoc = await PACK("classes").getDocument(classEntry._id);
  const classData = classDoc.toObject();
  classData.system.levels = spec.level;
  // HP: max at 1st, average after — dnd5e derives hp.max from this map.
  const hp = advs(classData.system).find(a => a.type === "HitPoints");
  if (hp) hp.value = Object.fromEntries(Array.fromRange(spec.level, 1).map(l => [l, l === 1 ? "max" : "avg"]));

  const subs = await indexed("subclasses", ["system.classIdentifier"]);
  const subEntry = subs.find(e => e.system?.classIdentifier === spec.cls);
  const subDoc = subEntry && spec.level >= 3 ? await PACK("subclasses").getDocument(subEntry._id) : null;

  const items = [classData];
  items.push(...await grantsUpTo(classDoc, spec.level, classData._id));
  if (subDoc) {
    const subData = subDoc.toObject();
    items.push(subData, ...await grantsUpTo(subDoc, spec.level, subData._id));
  }

  // Powers: every cantrip we can carry plus two per castable level, inside "powers known".
  const trad = classDoc.flags?.[MOD]?.casting?.tradition;
  if (trad) {
    const method = TRADITIONS[trad].method;
    const known = Number(advs(classData.system).find(a => a.type === "ScaleValue" && a.configuration?.identifier === "powers-known")
      ?.configuration?.scale?.[String(spec.level)]?.value) || 6;
    const maxLevel = Math.max(1, Math.ceil(spec.level / 2));
    const all = (await indexed("powers", ["system.method", "system.level"])).filter(e => e.system?.method === method);
    const pick = [];
    for (let lvl = 0; lvl <= maxLevel; lvl++) pick.push(...all.filter(e => e.system.level === lvl).slice(0, lvl === 0 ? 3 : 2));
    for (const e of pick.slice(0, known + 3)) items.push((await PACK("powers").getDocument(e._id)).toObject());
  }

  const gear = await indexed("gear", ["type"]);
  const w = gear.find(e => e.name === spec.weapon);
  if (w) { const wd = (await PACK("gear").getDocument(w._id)).toObject(); wd.system.equipped = true; items.push(wd); }
  const path = surgePathData(spec.path, spec.doctrine);
  if (path) items.push(path);
  if (spec.techniques?.length) {
    const feats = await indexed("features", ["name"]);
    for (const name of spec.techniques) {
      const e = feats.find(x => x.name === name);
      if (!e) { console.warn(TAG, "no technique named", name); continue; }
      items.push((await PACK("features").getDocument(e._id)).toObject());
    }
  }

  for (const it of items) { delete it._id; delete it.folder; }

  const actor = await Actor.create({
    name: spec.name, type: "character", folder: folder.id,
    img: "icons/svg/mystery-man.svg",
    system: { abilities: Object.fromEntries(Object.entries(spec.abilities).map(([k, v]) => [k, { value: v }])) },
    prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY, texture: { src: "icons/svg/mystery-man.svg" } },
    items,
    effects: [{
      name: `Mastery: ${CONFIG.DND5E.skills[spec.mastery]?.label ?? spec.mastery}`, img: "icons/svg/upgrade.svg", transfer: false,
      changes: [{ key: `flags.${MOD}.mastery.${spec.mastery}`, mode: OVERRIDE, value: "1" }]
    }],
    flags: { [MOD]: { redshirt: spec.cls } }
  });
  await actor.update({ ...traitsOf(classDoc), [`system.skills.${spec.mastery}.value`]: 2 });
  await actor.update({ "system.attributes.hp.value": actor.system.attributes.hp.max });
  return actor;
}

async function buildFoe(name, folder) {
  const idx = await indexed("monsters", ["name"]);
  const e = idx.find(x => x.name === name);
  if (!e) { console.warn(TAG, "no foe named", name); return null; }
  const data = (await PACK("monsters").getDocument(e._id)).toObject();
  delete data._id;
  data.folder = folder.id;
  foundry.utils.setProperty(data, `flags.${MOD}.redshirt`, "foe");
  foundry.utils.setProperty(data, "prototypeToken.disposition", CONST.TOKEN_DISPOSITIONS.HOSTILE);
  return Actor.create(data);
}

async function buildScene(actors, foes) {
  const old = game.scenes.find(s => s.name === SCENE);
  if (old) await old.delete();
  const scene = await Scene.create({
    name: SCENE, width: 2000, height: 1200, grid: { size: 100, type: CONST.GRID_TYPES.SQUARE },
    tokenVision: false, fog: { exploration: false }, backgroundColor: "#243b2a", padding: 0, navigation: true
  });
  const tokens = [];
  actors.forEach((a, i) => tokens.push(a.getTokenDocument({ x: 300, y: 200 + i * 200 })));
  foes.forEach((a, i) => tokens.push(a.getTokenDocument({ x: 1500, y: 300 + i * 200 })));
  const docs = await Promise.all(tokens);
  await scene.createEmbeddedDocuments("Token", docs.map(t => t.toObject()));
  return scene;
}

function squad() { return game.actors.filter(a => a.flags?.[MOD]?.redshirt && a.flags[MOD].redshirt !== "foe"); }
function foes() { return game.actors.filter(a => a.flags?.[MOD]?.redshirt === "foe"); }

export async function teardown() {
  if (!game.user.isGM) return ui.notifications?.warn?.("Redshirts: GM only.");
  for (const c of game.combats.filter(c => c.scene?.name === SCENE)) await c.delete();
  const scene = game.scenes.find(s => s.name === SCENE);
  if (scene) await scene.delete();
  const ids = game.actors.filter(a => a.flags?.[MOD]?.redshirt).map(a => a.id);
  if (ids.length) await Actor.deleteDocuments(ids);
  for (const f of game.folders.filter(f => f.name === FOLDER)) await f.delete();
  log("torn down");
}

export async function build() {
  if (!game.user.isGM) return ui.notifications?.warn?.("Redshirts: GM only.");
  await teardown();
  const folder = await folderFor("Actor");
  const actors = [];
  for (const spec of SQUAD) actors.push(await buildRedshirt(spec, folder));
  const enemies = (await Promise.all(FOES.map(n => buildFoe(n, folder)))).filter(Boolean);
  const scene = await buildScene(actors, enemies);
  log(`built ${actors.length} redshirts, ${enemies.length} foes, scene ${scene.name}`);
  return { actors, foes: enemies, scene };
}

/* ── The gauntlet ─────────────────────────────────────────────────────────── */

class Report {
  constructor() { this.rows = []; }
  add(step, ok, detail = "") { this.rows.push({ step, ok: !!ok, detail: String(detail) }); log(`${ok ? "PASS" : "FAIL"} · ${step}${detail ? ` — ${detail}` : ""}`); }
  async step(name, fn) {
    try { const r = await fn(); if (Array.isArray(r)) this.add(name, r[0], r[1]); else this.add(name, r !== false, ""); }
    catch (e) { this.add(name, false, e?.message ?? e); console.error(TAG, name, e); }
  }
  get summary() { const f = this.rows.filter(r => !r.ok).length; return `${this.rows.length - f}/${this.rows.length} passed${f ? `, ${f} FAILED` : ""}`; }
  html() {
    return `<div class="be5e-redshirts"><h3>The Crashtest Redshirts</h3><p><b>${this.summary}</b></p><ol style="padding-left:1.2em">${this.rows.map(r =>
      `<li style="color:${r.ok ? "#4caf50" : "#ff5252"}"><b>${r.ok ? "PASS" : "FAIL"}</b> ${r.step}${r.detail ? `<br><small>${foundry.utils.escapeHTML(r.detail)}</small>` : ""}</li>`).join("")}</ol></div>`;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const power = (actor, trad, level) => actor.items.find(i => traditionOf(i) === trad && Number(i.system.level) === level && i.system.activities?.size);
const target = (token) => {
  const t = token ? canvas.tokens?.get(token.id) : null;
  if (t) t.setTarget(true, { user: game.user, releaseOthers: true });
  else for (const x of [...(game.user.targets ?? [])]) x.setTarget(false, { user: game.user, releaseOthers: false });
};
const tokenOf = (scene, actor) => scene.tokens.find(t => t.actorId === actor.id);

export async function run({ rebuild = false } = {}) {
  if (!game.user.isGM) return ui.notifications?.warn?.("Redshirts: GM only.");
  if (rebuild || !squad().length || !game.scenes.find(s => s.name === SCENE)) await build();
  const scene = game.scenes.find(s => s.name === SCENE);
  await scene.view();
  await sleep(500);
  const R = new Report();
  const [theurge, gearwright, warden, vigilant] = SQUAD.map(s => game.actors.find(a => a.name === s.name));
  const foe = foes()[0];
  const foeToken = tokenOf(scene, foe);

  // Combat
  await R.step("combat starts with everyone in it", async () => {
    for (const c of game.combats.filter(c => c.scene?.id === scene.id)) await c.delete();
    const combat = await Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", scene.tokens.map(t => ({ tokenId: t.id, actorId: t.actorId, sceneId: scene.id })));
    await combat.rollAll({ messageOptions: { create: false } }).catch(() => combat.rollAll());
    await combat.startCombat();
    return [combat.combatants.size === scene.tokens.size && combat.started, `${combat.combatants.size} combatants, round ${combat.round}`];
  });

  // Pools
  for (const [actor, trad] of [[theurge, "flow"], [gearwright, "artifice"], [warden, "flow"], [vigilant, "flow"]]) {
    await R.step(`${actor.name}: ${TRADITIONS[trad].pointsLabel} pool`, async () => {
      await setPoints(actor, trad, { value: 999 });
      const c = castingFor(actor)[trad];
      return [c && c.max > 0 && c.value === c.max, c ? `${c.value}/${c.max}, max power level ${c.maxPowerLevel}, ability ${c.ability}` : "no casting"];
    });
  }

  // Casting: cantrip free, level 1 costs 2, upcast to 2 costs 3, empty pool blocks, too-high level blocks.
  const cast = async (actor, item, usage = {}) => {
    const act = item.system.activities.contents[0];
    const before = castingFor(actor)[traditionOf(item)].value;
    // A shift-click event makes dnd5e skip the dialog of the attack/heal roll it starts after use().
    const r = await act.use({ ...usage, event: { shiftKey: true } }, { configure: false }, { create: true });
    await sleep(150);
    return { before, after: castingFor(actor)[traditionOf(item)].value, used: !!r };
  };
  for (const [actor, trad] of [[theurge, "flow"], [gearwright, "artifice"]]) {
    target(foeToken);
    await R.step(`${actor.name}: cantrip costs nothing`, async () => {
      const p = power(actor, trad, 0); if (!p) return [false, "no cantrip"];
      const r = await cast(actor, p); return [r.used && r.after === r.before, `${p.name}: ${r.before} → ${r.after}`];
    });
    await R.step(`${actor.name}: level-1 power costs ${costAt(1)}`, async () => {
      const p = power(actor, trad, 1); if (!p) return [false, "no level-1 power"];
      const r = await cast(actor, p); return [r.used && r.before - r.after === costAt(1), `${p.name}: ${r.before} → ${r.after}`];
    });
    await R.step(`${actor.name}: upcast level-1 → 2 costs ${costAt(2)}`, async () => {
      const p = power(actor, trad, 1);
      const r = await cast(actor, p, { be5eLevel: 2 }); return [r.used && r.before - r.after === costAt(2), `${p.name}: ${r.before} → ${r.after}`];
    });
    await R.step(`${actor.name}: empty pool blocks a cast`, async () => {
      const p = power(actor, trad, 1);
      await setPoints(actor, trad, { value: 0 });
      const r = await cast(actor, p);
      await setPoints(actor, trad, { value: 999 });
      return [!r.used && r.after === 0, `use() returned ${r.used ? "a result" : "nothing"}, points ${r.before} → ${r.after}`];
    });
    await R.step(`${actor.name}: over-level upcast blocks`, async () => {
      const p = power(actor, trad, 1);
      const c = castingFor(actor)[trad];
      const r = await cast(actor, p, { be5eLevel: c.maxPowerLevel + 1 });
      return [!r.used && r.after === r.before, `asked level ${c.maxPowerLevel + 1} (max ${c.maxPowerLevel}), points ${r.before} → ${r.after}`];
    });
  }

  // Mastery = reliable talent on the flagged skill, and only there.
  for (const spec of SQUAD) {
    const actor = game.actors.find(a => a.name === spec.name);
    await R.step(`${actor.name}: Mastery floors ${spec.mastery} at 10`, async () => {
      const rolls = await actor.rollSkill({ skill: spec.mastery }, { configure: false }, { create: false });
      const roll = rolls?.[0];
      const other = Object.keys(CONFIG.DND5E.skills).find(k => k !== spec.mastery);
      const plain = (await actor.rollSkill({ skill: other }, { configure: false }, { create: false }))?.[0];
      return [roll?.options?.reliableTalent === true && !plain?.options?.reliableTalent,
        `${spec.mastery}: ${roll?.formula} (reliableTalent=${roll?.options?.reliableTalent}); ${other}: reliableTalent=${!!plain?.options?.reliableTalent}`];
    });
  }

  // Attack + damage through core dnd5e, applied to a foe.
  await R.step(`${warden.name}: weapon attack and damage land on ${foe.name}`, async () => {
    const weapon = warden.items.find(i => i.type === "weapon");
    const act = weapon?.system.activities.find(a => a.type === "attack");
    if (!act) return [false, "no attack activity"];
    target(foeToken);
    const hpBefore = foe.system.attributes.hp.value;
    const atk = await act.rollAttack({}, { configure: false }, { create: true });
    const dmg = await act.rollDamage({}, { configure: false }, { create: true });
    const descs = (dmg ?? []).map(r => ({ value: r.total, type: r.options?.type }));
    const total = descs.reduce((s, d) => s + (d.value ?? 0), 0);
    // Resistances count: the bestiary's kinetic resistances became b/p/s resistance.
    const expected = (foe.calculateDamage?.(descs) ?? descs).reduce((s, d) => s + (d.value ?? 0), 0);
    await foe.applyDamage(descs);
    const hpAfter = foe.system.attributes.hp.value;
    return [atk?.length && total > 0 && hpAfter === Math.max(0, hpBefore - expected),
      `${weapon.name}: attack ${atk?.[0]?.total}, damage ${total} (${expected} after resistances), foe HP ${hpBefore} → ${hpAfter}`];
  });

  // Riders (scripts/riders.js): the engine directly, then through the converted techniques.
  const RD = game.badEden5e?.riders;
  const useFeat = async (actor, name, extra = {}) => {
    const feat = actor.items.find(i => i.name === name);
    const act = feat?.system.activities?.contents?.[0];
    if (!feat) throw new Error(`no feat "${name}" on ${actor.name}`);
    if (!feat.flags?.[MOD]?.riders) throw new Error(`"${name}" carries no riders — rebuild the features pack`);
    if (!act) throw new Error(`"${name}" has no activity`);
    return act.use({ event: { shiftKey: true }, ...extra }, { configure: false }, { create: true });
  };
  const attackRoll = async (actor) => {
    const weapon = actor.items.find(i => i.type === "weapon") ?? actor.items.find(i => i.system?.activities?.find?.(a => a.type === "attack"));
    const act = weapon?.system.activities.find(a => a.type === "attack");
    if (!act) throw new Error(`${actor.name} has no attack activity`);
    const rolls = await act.rollAttack({}, { configure: false }, { create: false });
    return rolls?.[0];
  };
  const advOf = (roll) => roll?.options?.advantageMode ?? roll?.options?.advantage ?? null;
  await R.step(`${warden.name}: banked advantage rides the next attack`, async () => {
    await warden.unsetFlag(MOD, "bank").catch(() => {});
    await RD.bank(warden, 1, "Gauntlet");
    target(foeToken);
    const roll = await attackRoll(warden);
    await sleep(200);
    const left = Number(warden.flags?.[MOD]?.bank?.advantage) || 0;
    const adv = roll?.hasAdvantage ?? (advOf(roll) === 1);
    const plain = await attackRoll(warden);
    return [adv && !(plain?.hasAdvantage) && left === 0, `advantage=${adv} (mode ${advOf(roll)}), then plain=${!!plain?.hasAdvantage}, banked left ${left}`];
  });
  // Foes are unlinked tokens: riders land on the TOKEN's actor, as they do in play.
  const foeActor = foeToken.actor ?? foe;
  const clearImposed = async (a) => { for (const e of a.effects.filter(e => e.statuses?.has?.(RD.IMPOSED))) await e.delete(); };
  await R.step(`${foe.name}: Imposed → its next attack at disadvantage, then clear`, async () => {
    await clearImposed(foeActor);
    await RD.impose(foeActor, "Gauntlet");
    const had = foeActor.effects.some(e => e.statuses?.has?.(RD.IMPOSED));
    target(tokenOf(scene, warden));
    const roll = await attackRoll(foeActor);
    await sleep(200);
    const dis = roll?.hasDisadvantage ?? (advOf(roll) === -1);
    const gone = !foeActor.effects.some(e => e.statuses?.has?.(RD.IMPOSED));
    return [had && dis && gone, `imposed=${had}, disadvantage=${dis} (mode ${advOf(roll)}), cleared=${gone}`];
  });
  await R.step(`${warden.name}: strain → one level of exhaustion`, async () => {
    await warden.update({ "system.attributes.exhaustion": 0 });
    await RD.strain(warden, 1, "Gauntlet");
    await sleep(400);   // dnd5e syncs the exhaustion attribute through its status effect
    const lvl = Number(warden.system.attributes.exhaustion) || 0;
    await warden.update({ "system.attributes.exhaustion": 0 });
    return [lvl === 1, `exhaustion ${lvl}`];
  });
  await R.step(`${warden.name}: Calculated Risk (feat) banks advantage on use`, async () => {
    await warden.unsetFlag(MOD, "bank").catch(() => {});
    await useFeat(warden, "Calculated Risk");
    await sleep(300);
    const held = Number(warden.flags?.[MOD]?.bank?.advantage) || 0;
    await warden.unsetFlag(MOD, "bank").catch(() => {});
    return [held === 1, `banked ${held}`];
  });
  await R.step(`${warden.name}: Controlled Aggression (feat) Imposes the target`, async () => {
    await clearImposed(foeActor);
    target(foeToken);
    await useFeat(warden, "Controlled Aggression");
    await sleep(300);
    const has = foeActor.effects.some(e => e.statuses?.has?.(RD.IMPOSED));
    await clearImposed(foeActor);
    return [has, `foe (token actor) imposed=${has}`];
  });
  await R.step(`${warden.name}: Pressure Transference (feat) banks advantage for a targeted ally`, async () => {
    await theurge.unsetFlag(MOD, "bank").catch(() => {});
    target(tokenOf(scene, theurge));
    await useFeat(warden, "Pressure Transference");
    await sleep(300);
    const held = Number(theurge.flags?.[MOD]?.bank?.advantage) || 0;
    await theurge.unsetFlag(MOD, "bank").catch(() => {});
    return [held === 1, `${theurge.name} banked ${held}`];
  });
  await R.step(`${warden.name}: Relentless Advance (feat) = temp HP equal to proficiency`, async () => {
    await warden.update({ "system.attributes.hp.temp": 0 });
    const feat = warden.items.find(i => i.name === "Relentless Advance");
    const act = feat?.system.activities?.contents?.[0];
    if (!act || act.type !== "heal") return [false, `activity ${act?.type ?? "missing"}`];
    target(tokenOf(scene, warden));
    const rolls = await act.rollDamage({}, { configure: false }, { create: false });
    const total = (rolls ?? []).reduce((s, r) => s + (r.total ?? 0), 0);
    await warden.applyTempHP(total);
    const temp = Number(warden.system.attributes.hp.temp) || 0;
    const prof = Number(warden.system.attributes.prof) || 0;
    return [temp === prof && total === prof, `heal activity (${rolls?.[0]?.options?.type ?? "?"}) rolled ${total}, temp HP ${temp}, prof ${prof}`];
  });
  await R.step(`${warden.name}: Darkness Hardened (feat) adds exhaustion on use`, async () => {
    await warden.update({ "system.attributes.exhaustion": 0 });
    await useFeat(warden, "Darkness Hardened");
    await sleep(600);
    const lvl = Number(warden.system.attributes.exhaustion) || 0;
    await warden.update({ "system.attributes.exhaustion": 0 });
    return [lvl === 1, `exhaustion ${lvl}`];
  });
  target(null);

  // Monster automation (converter npcAuto slice + scripts/reminders.js).
  const wraith = foes().find(a => a.name === "Slippage Wraith");
  const lurker = foes().find(a => a.name === "Crystal Lurker");
  const wraithTok = wraith && tokenOf(scene, wraith), lurkerTok = lurker && tokenOf(scene, lurker);
  const newCards = (since) => game.messages.contents.slice(since).filter(m => /⚑/.test(m.content));
  await R.step("Staggered and Imposed statuses are registered", async () =>
    [["be5e-staggered", "be5e-imposed"].every(id => CONFIG.statusEffects.some(s => s.id === id)), CONFIG.statusEffects.filter(s => /be5e/.test(s.id)).map(s => s.id).join(", ")]);
  await R.step("Slippage Wraith: Moment Shear is a save activity with a linked condition effect", async () => {
    const a = wraithTok?.actor ?? wraith; const feat = a?.items.find(i => /Moment Shear/.test(i.name));
    const act = feat?.system.activities?.contents?.[0];
    const fx = act?.effects?.map(e => e.effect).filter(Boolean) ?? [];
    return [act?.type === "save" && !!act.save?.dc?.formula && fx.length > 0, `${feat?.name ?? "missing"}: ${act?.type} DC ${act?.save?.dc?.formula} save ${[...(act?.save?.ability ?? [])].join("/")}; effects ${fx.map(e => `${e.name}[${[...e.statuses].join(",")}]`).join(", ") || "none"}`];
  });
  await R.step("Slippage Wraith: Rift Claw attack carries the No Reactions rider", async () => {
    const a = wraithTok?.actor ?? wraith; const w = a?.items.find(i => i.name === "Rift Claw");
    const act = w?.system.activities?.find(x => x.type === "attack");
    const fx = act?.effects?.map(e => e.effect).filter(Boolean) ?? [];
    return [fx.some(e => /No Reactions/.test(e.name)), `effects ${fx.map(e => e.name).join(", ") || "none"}; flavour "${act?.description?.chatFlavor ?? ""}"`];
  });
  await R.step("Crystal Lurker: Crystal Spike hit rider = ongoing damage effect", async () => {
    const a = lurkerTok?.actor ?? lurker; const w = a?.items.find(i => i.name === "Crystal Spike");
    const act = w?.system.activities?.find(x => x.type === "attack");
    const fx = act?.effects?.map(e => e.effect).filter(Boolean) ?? [];
    return [fx.some(e => /Ongoing/.test(e.name)), `effects ${fx.map(e => e.name).join(", ") || "none"}`];
  });
  await R.step("a monster's condition effect applies to a redshirt", async () => {
    const a = wraithTok?.actor ?? wraith; const feat = a?.items.find(i => /Moment Shear/.test(i.name));
    const src = feat?.system.activities?.contents?.[0]?.effects?.[0]?.effect;
    if (!src) return [false, "no effect to apply"];
    const data = src.toObject(); delete data._id; data.origin = feat.uuid;
    const [made] = await vigilant.createEmbeddedDocuments("ActiveEffect", [data]);
    const has = vigilant.effects.has(made?.id); const statuses = [...(made?.statuses ?? [])];
    await made?.delete();
    return [has, `${src.name} → ${vigilant.name} (${statuses.join(",") || "no status"}), then removed`];
  });
  await R.step("GM reminder on the Wraith's turn start", async () => {
    const combat = game.combat; if (!combat || !wraithTok) return [false, "no combat/wraith"];
    const since = game.messages.size;
    const idx = combat.turns.findIndex(c => c.tokenId === wraithTok.id);
    if (idx < 0) return [false, "wraith not in combat"];
    await combat.update({ turn: idx });
    await sleep(800);
    const cards = newCards(since).filter(m => /Start of Slippage Wraith/.test(m.content));
    return [cards.length === 1 && /selfTurnStart|Slippage Wraith:/.test(cards[0].content), `${cards.length} card(s); ${cards[0]?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160) ?? ""}`];
  });
  await R.step("GM reminder when the Lurker drops to 0 HP", async () => {
    const a = lurkerTok?.actor ?? lurker; if (!a) return [false, "no lurker"];
    const since = game.messages.size; const max = a.system.attributes.hp.max;
    await a.applyDamage([{ value: 999, type: "force" }]);
    await sleep(600);
    const cards = newCards(since).filter(m => /takes .* damage/.test(m.content));
    await a.update({ "system.attributes.hp.value": max });
    return [cards.length >= 1 && /At 0 HP/.test(cards.map(m => m.content).join("")), `${cards.length} card(s); ${cards[0]?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160) ?? ""}`];
  });
  await R.step("GM reminder when the Wraith is attacked", async () => {
    const since = game.messages.size;
    target(wraithTok);
    await attackRoll(warden);
    await sleep(600);
    const cards = newCards(since).filter(m => /is attacked by/.test(m.content));
    target(null);
    return [cards.length === 1, `${cards.length} card(s); ${cards[0]?.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 160) ?? ""}`];
  });

  // Surge paths.
  for (const spec of SQUAD) {
    const actor = game.actors.find(a => a.name === spec.name);
    await R.step(`${actor.name}: Surge path ${spec.path} (${spec.doctrine}) has entries`, async () => {
      const paths = game.surgePowers?.paths;
      const have = paths?.of?.(actor) ?? [];
      const entries = paths?.entries?.(actor) ?? [];
      return [have.length === 1 && have[0].key === spec.path && have[0].doctrine === spec.doctrine && entries.length > 0,
        `${have.map(p => `${p.key}/${p.doctrine}`).join(", ") || "none"}; ${entries.length} entries`];
    });
  }

  // Rests: short refills the short-rest tradition only; long refills everything and clears the limit marks.
  await R.step("short rest refills Artifice, not the Flow", async () => {
    await setPoints(theurge, "flow", { value: 1 });
    await setPoints(gearwright, "artifice", { value: 1 });
    await theurge.shortRest({ dialog: false, chat: false });
    await gearwright.shortRest({ dialog: false, chat: false });
    await sleep(300);
    const f = castingFor(theurge).flow, a = castingFor(gearwright).artifice;
    const flowShort = TRADITIONS.flow.rest === "short", artShort = TRADITIONS.artifice.rest === "short";
    return [(flowShort ? f.value === f.max : f.value === 1) && (artShort ? a.value === a.max : a.value === 1),
      `Flow ${f.value}/${f.max} (rest=${TRADITIONS.flow.rest}), Artifice ${a.value}/${a.max} (rest=${TRADITIONS.artifice.rest})`];
  });
  await R.step("long rest refills every pool", async () => {
    await setPoints(theurge, "flow", { value: 1 });
    await setPoints(gearwright, "artifice", { value: 1 });
    await theurge.longRest({ dialog: false, chat: false, newDay: true });
    await gearwright.longRest({ dialog: false, chat: false, newDay: true });
    await sleep(300);
    const f = castingFor(theurge).flow, a = castingFor(gearwright).artifice;
    return [f.value === f.max && a.value === a.max, `Flow ${f.value}/${f.max}, Artifice ${a.value}/${a.max}`];
  });

  // The Instability Table draws.
  await R.step("the Instability Table draws a result", async () => {
    const idx = await indexed("tables", ["name"]);
    const t = idx[0] && await PACK("tables").getDocument(idx[0]._id);
    if (!t) return [false, "no table"];
    const d = await t.draw({ displayChat: false });
    return [d?.results?.length > 0, `${t.name}: ${d?.results?.map(r => r.name || r.text || r.description).join(" / ")}`];
  });

  // 0 HP and back.
  await R.step(`${vigilant.name}: lethal damage stops at 0 HP, healing restores`, async () => {
    const max = vigilant.system.attributes.hp.max;
    await vigilant.applyDamage([{ value: 999, type: "bludgeoning" }]);
    const zero = vigilant.system.attributes.hp.value;
    await vigilant.update({ "system.attributes.hp.value": max });
    return [zero === 0 && vigilant.system.attributes.hp.value === max, `${max} → ${zero} → ${vigilant.system.attributes.hp.value}`];
  });

  target(null);
  await ChatMessage.create({ content: R.html(), whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Crashtest Redshirts" } });
  log(R.summary);
  console.table(R.rows);
  return R;
}

export const redshirts = { build, run, teardown, squad, foes, SQUAD, FOES };
