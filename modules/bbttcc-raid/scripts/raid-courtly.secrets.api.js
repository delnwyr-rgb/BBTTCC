// modules/bbttcc-raid/scripts/raid-courtly.secrets.api.js
//
// Bad Eden — Courtly Intrigue Secrets API (Phase C)
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
//                | "clearScandal" | "favorPlus1" | "favorShift" | …
//                — MAY be a compound "a+b" string (2026-07-12): multiple
//                effects fire in order on a single play. effectKeys (array)
//                mirrors it; single-key legacy items keep working unchanged.
//     effectKeys: ["rollPlus2", "coverTracks"]   (optional mirror array)
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
    "favorShift",
    // ── Content Sprint batch 2 (2026-06-13) — new keys, composed from the same
    //    scenario primitives (queueRollMod / dealInfluenceDamage / raiseSuspicion
    //    / adjustFavor). No new scenario methods required.
    "rollPlus3",
    "influenceDmg3",
    "coverTracks",
    "favorPlus2",
    "doubleAgent",
    // ── Secret-extraction expansion (2026-07-12) — new keys composed from the
    //    same scenario primitives; all non-interactive (no courtier picker) so
    //    they chain cleanly inside compound "a+b" secrets.
    "oppRollMinus2",
    "stirThePot",
    "discardStolen",
    "freezePurse"
  ]);

  // Human-readable one-liner per effect key — single source of truth for the
  // faction Assets sheet + any Play UI. Keep in sync with the handlers below.
  const EFFECT_INFO = Object.freeze({
    rollPlus2:     "Queue +2 to your next courtly roll",
    forceReroll:   "Force your opponent to reroll their next exchange",
    influenceDmg2: "Deal 2 Influence damage outside an exchange",
    clearScandal:  "Clear your own Scandal flag",
    favorPlus1:    "+1 Favor with a chosen courtier (your side)",
    favorShift:    "−1 Favor with two courtiers (toward your opponent)",
    rollPlus3:     "Queue +3 to your next courtly roll",
    influenceDmg3: "Deal 3 Influence damage outside an exchange",
    coverTracks:   "−2 Suspicion",
    favorPlus2:    "+2 Favor with a chosen courtier (your side)",
    doubleAgent:   "Flip a courtier — −1 to the opponent, +1 to you",
    oppRollMinus2: "Queue −2 to your opponent's next courtly roll",
    stirThePot:    "+2 Suspicion — destabilize the court (defection favors the influence leader)",
    discardStolen: "Your opponent discards a random STOLEN secret",
    freezePurse:   "No OP may be spent by either side next exchange"
  });

  // A secret's effect field may be compound: "rollPlus2+coverTracks" (or
  // comma-separated, or an array). Normalize to an array of VALID keys.
  function normEffectKeys(v) {
    const parts = Array.isArray(v) ? v : String(v || "").split(/[+,]/);
    const out = [];
    for (const p of parts) {
      const k = String(p || "").trim();
      if (k && EFFECT_KEYS.includes(k) && !out.includes(k)) out.push(k);
    }
    return out;
  }

  function describeEffect(key) {
    const keys = normEffectKeys(key);
    if (keys.length > 1) return keys.map(k => EFFECT_INFO[k] || k).join(" + ");
    return EFFECT_INFO[String(key || "")] || String(key || "");
  }

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
    const srcMeta = source.flags?.[MOD_R]?.secret || {};
    const effectKeys = normEffectKeys(srcMeta.effectKeys ?? srcMeta.effectKey ?? opts.effectKeys ?? opts.effectKey);
    if (!effectKeys.length) {
      ui.notifications?.error?.(`Courtly secrets: no valid effectKey in "${srcMeta.effectKeys ?? srcMeta.effectKey ?? opts.effectKeys ?? opts.effectKey ?? ""}".`);
      return null;
    }
    const effectKey = effectKeys.join("+");   // display/back-compat form

    const scenario = _scenario();
    const raidId = scenario?.getState?.()?.attackerId
      ? `${scenario.getState().attackerId}::${scenario.getState().defenderId}`
      : (opts.raidId || "");

    const baseData = source.toObject();
    delete baseData._id;
    foundry.utils.mergeObject(baseData, {
      flags: {
        [MOD_R]: {
          secret: { acquisition, effectKey, effectKeys, raidId, acquiredAt: Date.now() }
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

  // ── Content Sprint batch 2 (2026-06-13) new handlers ──────────────────────
  async function _effectRollPlus3(actor, side, scenario) {
    scenario.queueRollMod(side.side, 3, `secret:rollPlus3:${actor.name}`);
    return { effect: "rollPlus3", queued: "+3 to next roll" };
  }
  async function _effectInfluenceDmg3(actor, side, scenario) {
    const result = await scenario.dealInfluenceDamage(side.oppSide, 3, `secret:influenceDmg3:${actor.name}`);
    return { effect: "influenceDmg3", oppInfluenceAfter: result };
  }
  async function _effectCoverTracks(actor, side, scenario) {
    await scenario.raiseSuspicion(-2, `secret:coverTracks:${actor.name}`);
    return { effect: "coverTracks", suspicion: "-2" };
  }
  async function _effectFavorPlus2(actor, side, scenario) {
    const courtier = await _pickCourtier("Choose courtier — +2 favor toward your side");
    if (!courtier) return { effect: "favorPlus2", cancelled: true };
    await scenario.adjustFavor(courtier.id, side.factionId, +2);
    return { effect: "favorPlus2", courtier: courtier.name };
  }
  async function _effectDoubleAgent(actor, side, scenario) {
    const courtier = await _pickCourtier("Choose courtier — flip them: −1 from opponent, +1 to you");
    if (!courtier) return { effect: "doubleAgent", cancelled: true };
    await scenario.adjustFavor(courtier.id, side.oppFactionId, -1);
    await scenario.adjustFavor(courtier.id, side.factionId, +1);
    return { effect: "doubleAgent", courtier: courtier.name };
  }

  // ── Secret-extraction expansion (2026-07-12) new handlers ─────────────────
  async function _effectOppRollMinus2(actor, side, scenario) {
    scenario.queueRollMod(side.oppSide, -2, `secret:oppRollMinus2:${actor.name}`);
    return { effect: "oppRollMinus2", queued: `−2 to opponent's (${side.oppSide}) next roll` };
  }
  async function _effectStirThePot(actor, side, scenario) {
    await scenario.raiseSuspicion(2, `secret:stirThePot:${actor.name}`);
    return { effect: "stirThePot", suspicion: "+2" };
  }
  async function _effectDiscardStolen(actor, side, scenario) {
    const discarded = await scenario.discardSecret(side.oppSide, { acquisition: "stolen" });
    return { effect: "discardStolen", discarded: discarded || "nothing to discard" };
  }
  async function _effectFreezePurse(actor, side, scenario) {
    const lock = scenario.lockSpend(1, 0);
    return { effect: "freezePurse", lock };
  }

  const HANDLERS = Object.freeze({
    rollPlus2:     _effectRollPlus2,
    forceReroll:   _effectForceReroll,
    influenceDmg2: _effectInfluenceDmg2,
    clearScandal:  _effectClearScandal,
    favorPlus1:    _effectFavorPlus1,
    favorShift:    _effectFavorShift,
    rollPlus3:     _effectRollPlus3,
    influenceDmg3: _effectInfluenceDmg3,
    coverTracks:   _effectCoverTracks,
    favorPlus2:    _effectFavorPlus2,
    doubleAgent:   _effectDoubleAgent,
    oppRollMinus2: _effectOppRollMinus2,
    stirThePot:    _effectStirThePot,
    discardStolen: _effectDiscardStolen,
    freezePurse:   _effectFreezePurse
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

    const effectKeys = normEffectKeys(secretMeta.effectKeys ?? secretMeta.effectKey);
    if (!effectKeys.length || effectKeys.some(k => !HANDLERS[k])) {
      ui.notifications?.error?.(`Courtly secrets: unknown effectKey "${secretMeta.effectKeys ?? secretMeta.effectKey ?? ""}".`);
      return { ok: false, error: "no-handler" };
    }
    const effectKey = effectKeys.join("+");

    // Compound secrets fire their effects IN ORDER. Cancelling the FIRST
    // effect (courtier-picker dialogs) aborts the whole play with the item
    // intact; cancelling a LATER one merely skips it — earlier effects have
    // already landed, so the secret is consumed regardless.
    const results = [];
    let applied = 0;
    for (const k of effectKeys) {
      let r;
      try { r = await HANDLERS[k](actor, side, scenario); }
      catch (e) {
        console.warn(TAG, `handler "${k}" failed`, e);
        ui.notifications?.error?.(`Courtly secrets: effect "${k}" errored — see console.`);
        if (applied === 0) return { ok: false, error: "handler-threw" };
        results.push({ effect: k, errored: true });
        continue;
      }
      if (r?.cancelled) {
        if (applied === 0) return { ok: false, cancelled: true };
        results.push({ effect: k, skipped: "cancelled" });
        continue;
      }
      applied++;
      results.push(r);
    }
    const result = (results.length === 1) ? results[0] : { effects: results };

    // Consume item, fire suspicion bump, broadcast.
    await actor.deleteEmbeddedDocuments("Item", [item.id]);
    if (secretMeta.acquisition === "stolen") {
      try { await scenario.raiseSuspicion(2, `played stolen secret: ${item.name}`); } catch (e) { console.warn(TAG, e); }
    }
    await ChatMessage.create({
      content: `<p><b>${esc(actor.name)}</b> plays the secret <b>${esc(item.name)}</b> <small style="opacity:.7;">(${esc(secretMeta.acquisition)})</small></p><p>${esc(JSON.stringify(result))}</p>`,
      speaker: { alias: "Bad Eden Courtly Intrigue" }
    }).catch(() => {});
    try { Hooks.callAll("bbttcc:courtly:state", { scenario, state: scenario.getState() }); } catch (_e) {}

    // Phase F — broadcast secret-play VFX to all clients (chip pulse + chat).
    try {
      const evt = {
        kind: "secret-play",
        ts: Date.now(),
        actorId: actor.id,
        actorName: actor.name,
        itemName: item.name,
        acquisition: secretMeta.acquisition,
        effectKey
      };
      Hooks.callAll("bbttcc:courtly:vfx", evt);
      if (game?.socket?.emit) {
        game.socket.emit(`module.${MOD_R}`, { t: "courtlyHook", hook: "bbttcc:courtly:vfx", payload: evt });
      }
    } catch (_e) {}

    return { ok: true, effect: effectKey, result };
  }

  function _install() {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.raid ??= {};
    game.bbttcc.api.raid.courtlySecrets = {
      addSecret, playSecret, getSecrets, enforceCap, EFFECT_KEYS, EFFECT_INFO, describeEffect, normEffectKeys
    };
  }

  // Dual install per [[bbttcc-api-exposure-pattern]] — script-load AND ready.
  _install();
  Hooks.once("ready", () => {
    _install();
    console.log(TAG, "Phase C secrets API ready → game.bbttcc.api.raid.courtlySecrets");
  });
})();
