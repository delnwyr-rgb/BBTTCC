/* BBTTCC — Hex Conditions Enhancer (conditions only)
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

  // --- queued turn effects → conditions --------------------------------------

  async function syncQueuedTurnEffectsToConditions(){
    try {
      const docs = listAllHexDocsOnAllScenes();
      for (const d of docs) {
        const doc = d.document ?? d;
        const tf  = doc.flags?.[MOD_T];
        if (!tf) continue;
        const pending = get(tf, "turn.pending", {});
        if (!pending) continue;

        if (Number(pending.radiationRisk || 0) > 0) {
          await setCondition(doc, "Radiated", true);
        }

        if (pending.cleanseCorruption) {
          await setCondition(doc, "Radiated", false);
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
      const res = await orig(args);
      await syncQueuedTurnEffectsToConditions();
      return res;
    };

    log("Wrapped raid.consumeQueuedTurnEffects for hex condition auto-sync");
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
      listConditionsOnScene
    });
  }

  function install(){
    publishAPIs();
    installQueuedEffectsWrapper();
    log("ready");
  }

  Hooks.once("ready", install);
  try {
    if (game?.ready) install();
  } catch {}
})();
