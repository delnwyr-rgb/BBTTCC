/* Bad Eden — Hex Conditions Enhancer (conditions only)
 * - Persistent per-hex conditions on bbttcc-territory hexes
 * - Auto-syncs from queued turn effects (radiation, cleanse, destroy)
 *
 * Conditions live on hex drawings/tiles under:
 *   flags["bbttcc-territory"].conditions : string[]
 */

(() => {
  const TAG   = "[bbttcc-hex-conditions]";
  const MOD_T = "bbttcc-territory";

  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  const arr = (x)=> Array.isArray(x) ? x : (x ? [x] : []);
  const dedupe = (a)=> [...new Set(a)];
  const get = (o,p,d)=>{ try { return foundry.utils.getProperty(o,p) ?? d; } catch { return d; } };

  async function resolveDoc(uuidOrDoc){
    if (!uuidOrDoc) return null;

    if (uuidOrDoc instanceof foundry.abstract.Document) return uuidOrDoc;
    if (uuidOrDoc.document instanceof foundry.abstract.Document) return uuidOrDoc.document;

    if (typeof uuidOrDoc === "string") {
      try {
        if (fromUuid) {
          const doc = await fromUuid(uuidOrDoc);
          if (doc) return doc;
        }
      } catch {}
      const sc = canvas?.scene;
      if (sc) {
        const d = sc.drawings?.get(uuidOrDoc) ?? sc.tiles?.get(uuidOrDoc);
        if (d) return d;
      }
      return null;
    }

    if (typeof uuidOrDoc === "object" && uuidOrDoc.uuid && fromUuid) {
      try {
        const doc = await fromUuid(uuidOrDoc.uuid);
        if (doc) return doc;
      } catch {}
    }

    return null;
  }

  async function readConditions(doc){
    const raw = await doc.getFlag(MOD_T, "conditions");
    return arr(raw);
  }

  async function writeConditions(doc, list){
    const clean = dedupe(arr(list));
    await doc.setFlag(MOD_T, "conditions", clean);
    return clean;
  }

  // --- core mutators ---------------------------------------------------------

  async function setCondition(uuid, name, on=true){
    const doc = await resolveDoc(uuid);
    if (!doc || !name) return false;
    const list = await readConditions(doc);
    const has = list.includes(name);
    if (on && !has) list.push(name);
    if (!on && has) list.splice(list.indexOf(name), 1);
    await writeConditions(doc, list);
    return true;
  }

  async function toggleCondition(uuid, name){
    const doc = await resolveDoc(uuid);
    if (!doc || !name) return false;
    const list = await readConditions(doc);
    const has = list.includes(name);
    if (has) list.splice(list.indexOf(name), 1);
    else list.push(name);
    await writeConditions(doc, list);
    return true;
  }

  async function clearCondition(uuid, name){
    return setCondition(uuid, name, false);
  }

  async function clearAllConditions(uuid){
    const doc = await resolveDoc(uuid);
    if (!doc) return false;
    await writeConditions(doc, []);
    return true;
  }

  async function hasCondition(uuid, name){
    const doc = await resolveDoc(uuid);
    if (!doc || !name) return false;
    const list = await readConditions(doc);
    return list.includes(name);
  }

  async function getConditions(uuid){
    const doc = await resolveDoc(uuid);
    if (!doc) return [];
    return readConditions(doc);
  }

  function listAllHexDocsOnAllScenes(){
    const hits = [];
    for (const sc of game.scenes ?? []) {
      for (const d of sc.drawings ?? []) {
        const flags = d.flags?.[MOD_T];
        if (!flags) continue;
        hits.push(d);
      }
      for (const t of sc.tiles ?? []) {
        const flags = t.flags?.[MOD_T];
        if (!flags) continue;
        hits.push(t);
      }
    }
    return hits;
  }

  function listConditionsOnScene(filter=null){
    const out = [];
    const layerDrawings = canvas?.drawings?.placeables ?? canvas?.drawings ?? [];
    for (const d of layerDrawings) {
      const doc   = d.document ?? d;
      const flags = doc.flags?.[MOD_T];
      if (!flags) continue;
      const conds = arr(flags.conditions);
      if (filter && !conds.includes(filter)) continue;
      const name =
        flags.name ??
        doc.text ??
        doc.getFlag(MOD_T, "name") ??
        doc.id;
      out.push({ uuid: doc.uuid, name, conditions: conds.slice() });
    }
    return out;
  }

  // --- hex Radiation level — THE one switch (owner ruling 2026-10-22) ---------
  // flags.bbttcc-territory.mods.radiation, 0–3, is the only input. Everything else is
  // stamped FROM it so the readers that still look at tags keep working:
  //   1 Radiated        — "Radiated" condition (darkness track, map hazard)
  //   2 Contaminated    — + the "Contaminated" production modifier (−50%)
  //   3 Radiation Zone  — + the "Radiation Zone" production modifier (−75%) instead
  // Nobody sets those tags by hand any more; legacy names written by beats/maneuvers are
  // translated into a level by fromNames() below.
  const RAD_MAX = 3;
  const RAD_LADDER = [
    { level: 0, name: "Clean" },
    { level: 1, name: "Radiated" },
    { level: 2, name: "Contaminated",   modifier: "Contaminated" },
    { level: 3, name: "Radiation Zone", modifier: "Radiation Zone" }
  ];
  const RAD_TAGS = ["radiated", "contaminated", "radiation zone", "radiation zone (low)"];
  const isRadTag = (s) => RAD_TAGS.includes(String(s || "").trim().toLowerCase());

  function clampRad(n){ return Math.max(0, Math.min(RAD_MAX, Math.round(Number(n) || 0))); }

  // Level of a hex (doc, placeable or its bbttcc-territory flags object).
  function radiationLevel(x){
    const doc = x?.document ?? x;
    const tf = doc?.flags?.[MOD_T] ?? doc ?? {};
    return clampRad(tf?.mods?.radiation);
  }

  // Pure: the { mods, conditions, modifiers } a hex should carry at level n.
  function radiationPatch(tf, n){
    const level = clampRad(n);
    const mods = Object.assign({}, (tf?.mods && typeof tf.mods === "object") ? tf.mods : {}, { radiation: level });
    const conditions = arr(tf?.conditions).filter(c => !isRadTag(c));
    if (level >= 1) conditions.push("Radiated");
    const modifiers = arr(tf?.modifiers).filter(m => !isRadTag(m));
    const rung = RAD_LADDER[level];
    if (rung.modifier) modifiers.push(rung.modifier);
    return { level, mods, conditions: dedupe(conditions), modifiers: dedupe(modifiers) };
  }

  async function setRadiationLevel(uuidOrDoc, n, { source = "" } = {}){
    const doc = await resolveDoc(uuidOrDoc);
    if (!doc) return null;
    const tf = doc.flags?.[MOD_T] ?? {};
    const before = radiationLevel(tf);
    const p = radiationPatch(tf, n);
    await doc.update({
      [`flags.${MOD_T}.mods`]: p.mods,
      [`flags.${MOD_T}.conditions`]: p.conditions,
      [`flags.${MOD_T}.modifiers`]: p.modifiers
    }, { parent: doc.parent });
    // The production modifier changed → resources must follow (what regen reads).
    if ((before >= 2) !== (p.level >= 2) || (before === 3) !== (p.level === 3)) {
      try { const rc = game.bbttcc?.api?.territory?.recomputeHexResources; if (typeof rc === "function") await rc(doc, { source: source || "radiation" }); } catch (_e) {}
    }
    if (before !== p.level) Hooks.callAll("bbttcc:hexRadiationChanged", { doc, before, after: p.level, source });
    return p.level;
  }

  // Legacy names → a level. Writers that still add/remove "Contaminated" / "Radiation Zone" /
  // "Radiated" (beats' hexModifiers, raid maneuvers) call this, then drop those names from
  // their own lists. Adding raises to that rung; removing any of them cleans the hex.
  function fromNames(current, add = [], remove = []){
    const low = (a) => arr(a).map(s => String(s || "").trim().toLowerCase());
    const A = low(add), R = low(remove);
    let next = clampRad(current);
    if (R.some(isRadTag)) next = 0;
    if (A.includes("radiation zone") || A.includes("radiation zone (low)")) next = Math.max(next, 3);
    else if (A.includes("contaminated")) next = Math.max(next, 2);
    else if (A.includes("radiated")) next = Math.max(next, 1);
    return { level: next, touched: A.some(isRadTag) || R.some(isRadTag) };
  }

  const radiationApi = { MAX: RAD_MAX, LADDER: RAD_LADDER, level: radiationLevel, patch: radiationPatch, set: setRadiationLevel, fromNames, isRadTag };

  // --- queued turn effects → conditions --------------------------------------

  // Snapshot of every hex's turn.pending, taken BEFORE the consumer runs (2026-10-01): the
  // consumer chain deletes turn.pending, so reading it afterwards found nothing to sync.
  function snapshotPending(){
    const snap = [];
    for (const d of listAllHexDocsOnAllScenes()) {
      const doc = d.document ?? d;
      const pending = get(doc.flags?.[MOD_T] || {}, "turn.pending", null);
      if (pending && typeof pending === "object" && Object.keys(pending).length) snap.push({ doc, pending: foundry.utils.duplicate(pending) });
    }
    return snap;
  }

  async function syncQueuedTurnEffectsToConditions(snap = null){
    try {
      const rows = snap || snapshotPending();
      for (const { doc, pending } of rows) {
        if (!pending) continue;

        if (Number(pending.radiationRisk || 0) > 0) {
          await setRadiationLevel(doc, Math.max(1, radiationLevel(doc)), { source: "turn:radiationRisk" });
        }

        if (pending.cleanseCorruption) {
          await setRadiationLevel(doc, 0, { source: "turn:cleanse" });
          await setCondition(doc, "Purified", true);
        }

        if (pending.destroyHex) {
          await setCondition(doc, "Corrupted", true);
        }
      }
    } catch (err) {
      warn("Error syncing queued turn effects to hex conditions", err);
    }
  }

  function installQueuedEffectsWrapper(){
    const raid = game.bbttcc?.api?.raid;
    if (!raid || typeof raid.consumeQueuedTurnEffects !== "function") return;
    if (raid._bbttccHexConditionsWrapped) return;
    raid._bbttccHexConditionsWrapped = true;

    const orig = raid.consumeQueuedTurnEffects.bind(raid);
    raid.consumeQueuedTurnEffects = async function wrappedConsumeQueuedTurnEffects(args = {}){
      const snap = snapshotPending();
      const res = await orig(args);
      await syncQueuedTurnEffectsToConditions(snap);
      return res;
    };

    log("Wrapped raid.consumeQueuedTurnEffects for hex condition auto-sync");
    return true;
  }
  // whenRaidReady-style retry (2026-10-01): if the raid consumer is not defined yet at this
  // script's ready hook the wrapper used to stay uninstalled for the session.
  function installQueuedEffectsWrapperWithRetry(tries = 0){
    if (installQueuedEffectsWrapper() || game.bbttcc?.api?.raid?._bbttccHexConditionsWrapped) return;
    if (tries < 20) setTimeout(() => installQueuedEffectsWrapperWithRetry(tries + 1), 500);
  }

  // --- publish API -----------------------------------------------------------

  function publishAPIs(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= game.bbttcc.api.territory || {};

    Object.assign(game.bbttcc.api.territory, {
      setCondition,
      toggleCondition,
      clearCondition,
      clearAllConditions,
      hasCondition,
      getConditions,
      listConditionsOnScene,
      radiation: radiationApi
    });
  }

  function install(){
    publishAPIs();
    installQueuedEffectsWrapperWithRetry();
    log("ready");
  }

  Hooks.once("ready", install);
  try {
    if (game?.ready) install();
  } catch {}
})();
