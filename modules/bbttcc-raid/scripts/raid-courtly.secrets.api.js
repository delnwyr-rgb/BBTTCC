// modules/bbttcc-raid/scripts/raid-courtly.secrets.api.js
//
// BBTTCC — Courtly Intrigue Secrets API (Phase C)
// Spec: bbttcc-raid/COURTLY_INTRIGUE_SPEC.md §4.3
//
// Secrets are Items (type "feat") that live in:
//   * The bbttcc-master-content.courtly-secrets compendium (templates)
//   * A faction actor's items collection (held secrets)
//
// Each secret carries:
//   flags.bbttcc-raid.secret = {
//     acquisition: "earned" | "stolen",
//     effectKey:   "rollPlus2" | "forceReroll" | "influenceDmg2"
//                | "clearScandal" | "favorPlus1" | "favorShift",
//     raidId:      <scenario instance id, optional>,
//     acquiredAt:  <timestamp ms>
//   }
//
// API on game.bbttcc.api.raid.courtlySecrets:
//   addSecret(actorId, sourceDocOrUuid, opts)  → created Item or null
//   playSecret(actorId, itemId, opts)          → { ok, effect, result }
//   getSecrets(actorId)                        → Item[]
//   enforceCap(actor, n=5)                     → number dropped
//   EFFECT_KEYS                                → frozen list
//
// Dispatch is keyed off effectKey (locked design decision 2026-05-21) so
// new effects extend by adding a key + handler, not a name-string switch.
// Stolen secrets bump suspicion +2 on play; Earned add 0.

(() => {
  const MOD_R = "bbttcc-raid";
  const TAG   = "[bbttcc-raid/courtly-secrets]";
  const CAP_PER_FACTION = 5;

  const EFFECT_KEYS = Object.freeze([
    "rollPlus2",
    "forceReroll",
    "influenceDmg2",
    "clearScandal",
    "favorPlus1",
    "favorShift"
  ]);

  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  function _scenario() {
    return game?.bbttcc?.api?.raid?._lastCourtly || null;
  }

  function _holderSide(actor, scenario) {
    if (!scenario) return null;
    const st = scenario.getState?.();
    if (!st) return null;
    if (actor.id === st.attackerId) return { side: "A", oppSide: "D", factionId: st.attackerId, oppFactionId: st.defenderId };
    if (actor.id === st.defenderId) return { side: "D", oppSide: "A", factionId: st.defenderId, oppFactionId: st.attackerId };
    return null;
  }

  function getSecrets(actorId) {
    const a = game.actors?.get(String(actorId || "").replace(/^Actor\./, ""));
    if (!a) return [];
    return (a.items?.contents || []).filter(i => i.flags?.[MOD_R]?.secret);
  }

  async function enforceCap(actor, n = CAP_PER_FACTION) {
    if (!actor) return 0;
    const held = (actor.items?.contents || []).filter(i => i.flags?.[MOD_R]?.secret);
    if (held.length <= n) return 0;
    held.sort((a, b) => Number(a.flags?.[MOD_R]?.secret?.acquiredAt || 0) - Number(b.flags?.[MOD_R]?.secret?.acquiredAt || 0));
    const drop = held.slice(0, held.length - n);
    await actor.deleteEmbeddedDocuments("Item", drop.map(i => i.id));
    return drop.length;
  }

  async function addSecret(actorId, sourceDocOrUuid, opts = {}) {
    const actor = game.actors?.get(String(actorId || "").replace(/^Actor\./, ""));
    if (!actor) { ui.notifications?.error?.("Courtly secrets: actor not found."); return null; }

    let source = sourceDocOrUuid;
    if (typeof source === "string") {
      try { source = await foundry.utils.fromUuid(source); }
      catch (e) { console.warn(TAG, "fromUuid failed", e); }
    }
    if (!source) { ui.notifications?.error?.("Courtly secrets: source secret not found."); return null; }

    const acquisition = (opts.acquisition === "stolen") ? "stolen" : "earned";
    const effectKey = String(source.flags?.[MOD_R]?.secret?.effectKey || opts.effectKey || "");
    if (!EFFECT_KEYS.includes(effectKey)) {
      ui.notifications?.error?.(`Courtly secrets: unknown effectKey "${effectKey}".`);
      return null;
    }

    const scenario = _scenario();
    const raidId = scenario?.getState?.()?.attackerId
      ? `${scenario.getState().attackerId}::${scenario.getState().defenderId}`
      : (opts.raidId || "");

    const baseData = source.toObject();
    delete baseData._id;
    foundry.utils.mergeObject(baseData, {
      flags: {
        [MOD_R]: {
          secret: { acquisition, effectKey, raidId, acquiredAt: Date.now() }
        }
      }
    });

    const [created] = await actor.createEmbeddedDocuments("Item", [baseData]);
    await enforceCap(actor);
    try { Hooks.callAll("bbttcc:courtly:state", { scenario, state: scenario?.getState?.() || null }); } catch (_e) {}
    return created;
  }

  // ─── Effect handlers (keyed off effectKey) ────────────────────────────────
  async function _effectRollPlus2(actor, side, scenario) {
    scenario.queueRollMod(side.side, 2, `secret:rollPlus2:${actor.name}`);
    return { effect: "rollPlus2", queued: "+2 to next roll" };
  }
  async function _effectForceReroll(actor, side, scenario) {
    scenario.queueReroll(side.oppSide, `secret:forceReroll:${actor.name}`);
    return { effect: "forceReroll", queued: `opponent (${side.oppSide}) rerolls next exchange` };
  }
  async function _effectInfluenceDmg2(actor, side, scenario) {
    const result = await scenario.dealInfluenceDamage(side.oppSide, 2, `secret:influenceDmg2:${actor.name}`);
    return { effect: "influenceDmg2", oppInfluenceAfter: result };
  }
  async function _effectClearScandal(actor, side, scenario) {
    const ok = await scenario.clearScandal(side.side, `secret:clearScandal:${actor.name}`);
    return { effect: "clearScandal", ok };
  }
  async function _effectFavorPlus1(actor, side, scenario) {
    const courtier = await _pickCourtier("Choose courtier — +1 favor toward your side");
    if (!courtier) return { effect: "favorPlus1", cancelled: true };
    await scenario.adjustFavor(courtier.id, side.factionId, +1);
    return { effect: "favorPlus1", courtier: courtier.name };
  }
  async function _effectFavorShift(actor, side, scenario) {
    const c1 = await _pickCourtier("Choose first courtier — −1 favor toward opponent");
    if (!c1) return { effect: "favorShift", cancelled: true };
    const c2 = await _pickCourtier("Choose second courtier — −1 favor toward opponent");
    if (!c2) return { effect: "favorShift", cancelled: true };
    await scenario.adjustFavor(c1.id, side.oppFactionId, -1);
    await scenario.adjustFavor(c2.id, side.oppFactionId, -1);
    return { effect: "favorShift", courtiers: [c1.name, c2.name] };
  }

  async function _pickCourtier(prompt) {
    const tokens = (canvas?.tokens?.placeables || []).filter(t => t.document?.flags?.[MOD_R]?.tableauActor === true && t.actor);
    if (tokens.length === 0) { ui.notifications?.warn?.("No tableau courtiers on this scene."); return null; }
    const opts = tokens.map(t => `<option value="${esc(t.actor.id)}">${esc(t.actor.name)}</option>`).join("");
    return new Promise(resolve => {
      new Dialog({
        title: "Courtly Secret",
        content: `<form><p>${esc(prompt)}</p><div class="form-group"><label>Courtier</label><select name="cid">${opts}</select></div></form>`,
        buttons: {
          ok: { label: "Choose", callback: html => {
            const id = html[0].querySelector("[name=cid]").value;
            resolve(game.actors.get(id) || null);
          }},
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }, { width: 320 }).render(true);
    });
  }

  const HANDLERS = Object.freeze({
    rollPlus2:     _effectRollPlus2,
    forceReroll:   _effectForceReroll,
    influenceDmg2: _effectInfluenceDmg2,
    clearScandal:  _effectClearScandal,
    favorPlus1:    _effectFavorPlus1,
    favorShift:    _effectFavorShift
  });

  async function playSecret(actorId, itemId, opts = {}) {
    const actor = game.actors?.get(String(actorId || "").replace(/^Actor\./, ""));
    if (!actor) { ui.notifications?.error?.("Courtly secrets: actor not found."); return { ok: false, error: "no-actor" }; }
    const item = actor.items?.get(itemId);
    if (!item) { ui.notifications?.error?.("Courtly secrets: secret not found on holder."); return { ok: false, error: "no-item" }; }
    const secretMeta = item.flags?.[MOD_R]?.secret;
    if (!secretMeta) { ui.notifications?.error?.("Courtly secrets: item is not a secret."); return { ok: false, error: "not-a-secret" }; }

    const scenario = _scenario();
    if (!scenario) { ui.notifications?.error?.("Courtly secrets: no active courtly scenario."); return { ok: false, error: "no-scenario" }; }

    const side = _holderSide(actor, scenario);
    if (!side) { ui.notifications?.error?.("Courtly secrets: holder is not attacker or defender of the active scenario."); return { ok: false, error: "side-mismatch" }; }

    const effectKey = String(secretMeta.effectKey || "");
    const handler = HANDLERS[effectKey];
    if (!handler) { ui.notifications?.error?.(`Courtly secrets: unknown effectKey "${effectKey}".`); return { ok: false, error: "no-handler" }; }

    let result;
    try { result = await handler(actor, side, scenario); }
    catch (e) { console.warn(TAG, "handler failed", e); ui.notifications?.error?.("Courtly secrets: effect handler errored — see console."); return { ok: false, error: "handler-threw" }; }

    if (result?.cancelled) return { ok: false, cancelled: true };

    // Consume item, fire suspicion bump, broadcast.
    await actor.deleteEmbeddedDocuments("Item", [item.id]);
    if (secretMeta.acquisition === "stolen") {
      try { await scenario.raiseSuspicion(2, `played stolen secret: ${item.name}`); } catch (e) { console.warn(TAG, e); }
    }
    await ChatMessage.create({
      content: `<p><b>${esc(actor.name)}</b> plays the secret <b>${esc(item.name)}</b> <small style="opacity:.7;">(${esc(secretMeta.acquisition)})</small></p><p>${esc(JSON.stringify(result))}</p>`,
      speaker: { alias: "BBTTCC Courtly Intrigue" }
    }).catch(() => {});
    try { Hooks.callAll("bbttcc:courtly:state", { scenario, state: scenario.getState() }); } catch (_e) {}

    return { ok: true, effect: effectKey, result };
  }

  function _install() {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.raid ??= {};
    game.bbttcc.api.raid.courtlySecrets = {
      addSecret, playSecret, getSecrets, enforceCap, EFFECT_KEYS
    };
  }

  // Dual install per [[bbttcc-api-exposure-pattern]] — script-load AND ready.
  _install();
  Hooks.once("ready", () => {
    _install();
    console.log(TAG, "Phase C secrets API ready → game.bbttcc.api.raid.courtlySecrets");
  });
})();
