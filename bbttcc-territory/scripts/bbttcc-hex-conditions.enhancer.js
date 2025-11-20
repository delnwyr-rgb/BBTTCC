/* BBTTCC — Hex Conditions Enhancer v1.0
 * Adds persistent per-hex conditions and auto-wires them to queued turn effects.
 *
 * Conditions live on hex drawings/tiles under:
 *   flags["bbttcc-territory"].conditions : string[]
 *
 * Auto-mapping (from queued turn effects in compat-bridge):
 *   - if hex.turn.pending.radiationRisk > 0      → add "Radiated"
 *   - if hex.turn.pending.cleanseCorruption      → remove "Radiated", add "Purified"
 *   - if hex.turn.pending.destroyHex             → add "Corrupted" (until actual delete)
 *
 * Public API (game.bbttcc.api.territory.*):
 *   - setCondition(uuid, name, on=true)
 *   - toggleCondition(uuid, name)
 *   - clearCondition(uuid, name)
 *   - clearAllConditions(uuid)
 *   - hasCondition(uuid, name)
 *   - getConditions(uuid)
 *   - listConditionsOnScene(filter?)
 */

(() => {
  const TAG   = "[bbttcc-hex-conditions]";
  const MOD_T = "bbttcc-territory";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  // ---------- utilities ----------
  const arr = (x)=> Array.isArray(x) ? x : (x ? [x] : []);
  const dedupe = (a)=> [...new Set(a)];
  const get = (o,p,d)=>{ try { return foundry.utils.getProperty(o,p) ?? d; } catch { return d; } };

  async function resolveDoc(uuidOrDoc){
    if (!uuidOrDoc) return null;
    if (uuidOrDoc.document || uuidOrDoc.update) return uuidOrDoc; // already a DocumentLike
    try {
      const d = await fromUuid(uuidOrDoc);
      return d?.document ?? d ?? null;
    } catch { return null; }
  }

  async function readConditions(doc){
    if (!doc) return [];
    const flags = doc?.flags?.[MOD_T] ?? {};
    return arr(flags.conditions).map(String);
  }

  async function writeConditions(doc, list){
    if (!doc) return false;
    const out = dedupe(arr(list).map(String).filter(Boolean));
    await doc.update({ [`flags.${MOD_T}.conditions`]: out }, { parent: doc.parent ?? null });
    return true;
  }

  async function setCondition(uuid, name, on=true){
    const doc = await resolveDoc(uuid);
    if (!doc) return false;
    const list = await readConditions(doc);
    const has = list.includes(name);
    if (on && !has) list.push(name);
    if (!on && has) list.splice(list.indexOf(name), 1);
    return writeConditions(doc, list);
  }

  async function toggleCondition(uuid, name){
    const doc = await resolveDoc(uuid);
    if (!doc) return false;
    const list = await readConditions(doc);
    const has = list.includes(name);
    if (has) list.splice(list.indexOf(name), 1);
    else list.push(name);
    return writeConditions(doc, list);
  }

  async function clearCondition(uuid, name){
    return setCondition(uuid, name, false);
  }

  async function clearAllConditions(uuid){
    const doc = await resolveDoc(uuid);
    if (!doc) return false;
    return writeConditions(doc, []);
  }

  async function hasCondition(uuid, name){
    const doc = await resolveDoc(uuid);
    if (!doc) return false;
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
      for (const d of sc.drawings ?? []) if (d.flags?.[MOD_T]) hits.push(d);
      for (const t of sc.tiles ?? [])    if (t.flags?.[MOD_T]) hits.push(t);
    }
    return hits;
  }

  function listConditionsOnScene(filter=null){
    const out = [];
    for (const d of (canvas?.drawings ?? [])) {
      const tf = d.document?.flags?.[MOD_T];
      if (!tf) continue;
      const conds = arr(tf.conditions);
      if (!filter || conds.includes(filter)) out.push({ uuid: d.document.uuid, name: d.document.name ?? d.document.text ?? d.id, conditions: conds.slice() });
    }
    // tiles (optional, uncomment if you also mark tiles as hexes)
    // for (const t of (canvas?.tiles ?? [])) { ... }
    return out;
  }

  // ---------- publish API ----------
  function publishAPI(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= game.bbttcc.api.territory || {};

    Object.assign(game.bbttcc.api.territory, {
      setCondition, toggleCondition, clearCondition, clearAllConditions,
      hasCondition, getConditions, listConditionsOnScene
    });
  }

  // ---------- auto-hook: apply queued turn effects → set conditions ----------
  function installQueuedEffectsWrapper(){
    const raid = game.bbttcc?.api?.raid;
    if (!raid || typeof raid.consumeQueuedTurnEffects !== "function") {
      return warn("raid.consumeQueuedTurnEffects not found; auto-conditions idle.");
    }
    if (raid.__hexConditionsWrapped) return;

    const base = raid.consumeQueuedTurnEffects.bind(raid);

    raid.consumeQueuedTurnEffects = async function wrapped(args){
      try {
        // BEFORE base clears turn.pending, consume relevant condition signals
        const updates = [];
        for (const sc of game.scenes ?? []) {
          const drawings = sc.drawings ?? [];
          for (const d of drawings) {
            const tf = d.flags?.[MOD_T];
            if (!tf || !tf.turn?.pending) continue;
            const pend = tf.turn.pending;

            // Map queued signals → conditions
            let list = arr(tf.conditions).slice();

            if (Number(pend.radiationRisk || 0) > 0) {
              if (!list.includes("Radiated")) list.push("Radiated");
            }
            if (pend.cleanseCorruption === true) {
              // Purification clears radiation and marks purified
              list = list.filter(c => c !== "Radiated");
              if (!list.includes("Purified")) list.push("Purified");
            }
            if (pend.destroyHex === true) {
              if (!list.includes("Corrupted")) list.push("Corrupted");
            }

            // Write if changed
            const newList = dedupe(list);
            const prev = arr(tf.conditions);
            const changed = newList.length !== prev.length || newList.some((c, i) => c !== prev[i]);
            if (changed) {
              updates.push(d.update({ [`flags.${MOD_T}.conditions`]: newList }, { parent: sc }));
              // optional GM whisper
              try {
                await ChatMessage.create({
                  content: `<p><b>Hex Updated</b> — ${foundry.utils.escapeHTML(d.name ?? d.text ?? d.id)}<br/>Conditions: ${newList.join(", ") || "—"}</p>`,
                  whisper: game.users?.filter(u=>u.isGM).map(u=>u.id) ?? [],
                  speaker: { alias: "BBTTCC Territory" }
                });
              } catch {}
            }
          }
        }
        if (updates.length) await Promise.allSettled(updates);
      } catch (e) {
        warn("pre-apply condition mapping failed:", e);
      }

      // Now call the base to apply and clear queued flags
      const res = await base(args).catch(e => {
        warn("consumeQueuedTurnEffects failed (base):", e);
        return null;
      });
      return res;
    };

    raid.__hexConditionsWrapped = true;
    log("Auto-conditions wrapper installed on raid.consumeQueuedTurnEffects.");
  }

  // ---------- optional: afterTravel hook (can be extended later) ----------
  // Example: on failed travel encounter in hazardous terrain, add a soft "Radiated" tag if desired.
  // Hooks.on("bbttcc:afterTravel", async ({ to, success }) => {
  //   if (!success) {
  //     try { const doc = to?.document ?? to; if (doc?.update) await setCondition(doc, "Hazard"); } catch {}
  //   }
  // });

  // ---------- init ----------
  function install(){
    publishAPI();
    installQueuedEffectsWrapper();
    log("ready");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();
