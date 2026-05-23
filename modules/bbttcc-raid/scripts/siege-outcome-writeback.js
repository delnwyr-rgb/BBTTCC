// bbttcc-raid/scripts/siege-outcome-writeback.js
// SIEGE_RAID_TYPE_SPEC.md §8 — Phase F.1: the outcome write-back engine.
//
// Until now every siege outcome only SET state.status + fired bbttcc:siege:outcome (for the
// D.3 VFX banner). NOTHING changed the campaign world. F.1 closes that gap: it subscribes to
// bbttcc:siege:outcome (GM-only, single writer) and runs the §8 9-row matrix —
//   • hex ownership → attacker + "Sacked"/"Treachery" modifiers + improvement-ledger entry
//   • faction morale deltas (+ DRAIN state.pendingMoraleDeltas[] — the mid-siege deltas E.3/E.4
//     recorded that have no terminal hook to carry them)
//   • Buffer refund (% of remainder → op.commit credit; OP→marks ×10, softPower→softpower)
//   • stockpile theft (won_sack), defender stockpile war-cost (lost_hold)
//   • intent-driven Holdings handling on a taken hex (capture / destroy / scatter — NON-destructive:
//     "destroyed"/"scattered" are flagged + removed from the hex roster, actors are NOT deleted)
//   • siege_resolved War Log saga entry pushed to BOTH factions with full narrativeBeats[]
//   • clear the hex siege flag + faction back-refs + end-of-siege chat card
//
// Decisions (2026-05-23): Holdings = intent-driven inline (sack→capture / raze→destroy /
// capture→capture); "Sacked" modifier is permanent for now (add-turn recorded, 30d auto-expiry
// deferred). F.2 Champion Death Cascade, F.3 Event Deck content, F.4 player HUD layer on after.

(() => {
  globalThis.__bbttcc_siege_outcome_writeback_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const MOD_T = "bbttcc-territory";
  const TAG = "[bbttcc/siege-writeback]";

  const _currentTurn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };
  const _nm = (id) => game.actors?.get?.(id)?.name || id || "—";

  // buffer category (camelCase) → opBank category (lowercase). Others map 1:1.
  const BUFFER_TO_OPBANK = { violence: "violence", logistics: "logistics", economy: "economy", softPower: "softpower", diplomacy: "diplomacy", faith: "faith", intrigue: "intrigue" };

  // ── §8 outcome matrix ─────────────────────────────────────────────────────
  // attackerWins drives the "took the hex" branch. holdings: how the defender's rigs/bosses are
  // treated when the attacker takes the hex (byIntent / byIntentHalf / preserve / none).
  const MATRIX = {
    won_storm:          { win: true,  transferHex: true,  modifiers: ["Sacked"],              atkMorale: +1, defMorale: -3, refundPct: 0,    holdings: "byIntent",     ledger: "siege_storm",        label: "Carried by Storm" },
    won_sack:           { win: true,  transferHex: false, modifiers: ["Sacked"],              atkMorale: 0,  defMorale: -1, refundPct: 1.0,  holdings: "none",         ledger: "siege_sack",         label: "The Place is Sacked",      stealStockpilePct: 0.5 },
    won_surrender:      { win: true,  transferHex: true,  modifiers: [],                      atkMorale: +1, defMorale: 0,  refundPct: 0.5,  holdings: "preserve",     ledger: "siege_surrender",    label: "The Garrison Yields" },
    won_trojan_horse:   { win: true,  transferHex: true,  modifiers: ["Sacked", "Treachery"], atkMorale: +1, defMorale: -2, refundPct: 0.25, holdings: "byIntentHalf", ledger: "siege_trojan_horse",  label: "The Gates Open from Within" },
    lost_hold:          { win: false, transferHex: false, modifiers: [],                      atkMorale: -1, defMorale: +1, refundPct: 0,    holdings: "none",         ledger: "siege_hold",         label: "The Siege is Broken",      defStockpileDelta: -15 },
    lost_supply_crisis: { win: false, transferHex: false, modifiers: [],                      atkMorale: -2, defMorale: 0,  refundPct: 0,    holdings: "none",         ledger: "siege_supply_crisis", label: "Supply Crisis", atkHoldingsLost: "1d4" },
    lost_pyrrhic:       { win: true,  transferHex: true,  modifiers: ["Sacked"],              atkMorale: -1, defMorale: -1, refundPct: 0,    holdings: "byIntentHalf", ledger: "siege_pyrrhic",       label: "A Pyrrhic Victory" },
    lost_relieved:      { win: false, transferHex: false, modifiers: [],                      atkMorale: -2, defMorale: 0,  refundPct: 0,    holdings: "none",         ledger: "siege_relieved",      label: "Relief Breaks the Siege",  relieverMorale: +1 },
    abandoned:          { win: false, transferHex: false, modifiers: [],                      atkMorale: -1, defMorale: 0,  refundPct: 0,    holdings: "none",         ledger: "siege_abandoned",     label: "The Siege is Abandoned" }
  };

  // ── small guarded helpers ─────────────────────────────────────────────────
  async function _bumpMorale(factionId, delta, reason){
    if (!factionId || !delta) return;
    try {
      const fn = game.bbttcc?.api?.factions?.bumpMorale;
      if (typeof fn === "function") await fn({ factionId, delta });
      else console.warn(TAG, "factions.bumpMorale unavailable; skipped morale", { factionId, delta, reason });
    } catch (e) { console.warn(TAG, "bumpMorale failed", reason, e); }
  }

  async function _refundBuffer(factionId, buffer, pct){
    if (!factionId || !(pct > 0)) return { refunded: 0 };
    const deltas = {}; let refunded = 0;
    for (const [bk, ok] of Object.entries(BUFFER_TO_OPBANK)) {
      const op = Math.round((Number(buffer?.[bk]) || 0) * pct);   // OP units
      if (op > 0) { deltas[ok] = (deltas[ok] || 0) + op * 10; refunded += op; }   // ×10 = marks
    }
    if (!refunded) return { refunded: 0 };
    try {
      const fn = game.bbttcc?.api?.op?.commit;
      if (typeof fn === "function") await fn(factionId, deltas, { source: "siege", label: "Siege Buffer refund", allowOvercap: false });
      else console.warn(TAG, "op.commit unavailable; refund skipped", deltas);
    } catch (e) { console.warn(TAG, "buffer refund failed", e); }
    return { refunded };
  }

  function _hexFlags(hexDoc){ return foundry.utils.duplicate(hexDoc.flags?.[MOD_T] || {}); }

  async function _transferHexAndModifiers(hexDoc, { newOwnerId, addModifiers, turn }){
    const tf = _hexFlags(hexDoc);
    if (newOwnerId) tf.factionId = newOwnerId;
    if (addModifiers?.length) {
      tf.modifiers = Array.isArray(tf.modifiers) ? tf.modifiers : [];
      tf.modifierHistory = tf.modifierHistory && typeof tf.modifierHistory === "object" ? tf.modifierHistory : {};
      for (const m of addModifiers) {
        if (!tf.modifiers.includes(m)) tf.modifiers.push(m);
        // Record add-turn for audit; 30d auto-expiry is deferred (modifiers are permanent today).
        tf.modifierHistory[m] = Object.assign({}, tf.modifierHistory[m], { addedTurn: turn, addedTs: Date.now(), source: "siege" });
      }
    }
    await hexDoc.update({ [`flags.${MOD_T}`]: tf });
  }

  // Intent → holdings disposition for a taken hex.
  function _modeForIntent(intent){
    return ({ sack: "capture", raze: "destroy", capture: "capture" })[intent] || "capture";
  }

  // Apply holdings disposition. NON-destructive: "destroy"/"scatter" flag the actor + drop it
  // from the hex roster but never delete it. "capture" reassigns factionOwnerId to the attacker.
  async function _handleHoldings(hexDoc, { plan, attackerId, intent, turn, siegeId }){
    if (plan === "none") return { summary: "holdings untouched" };
    const S = globalThis.__bbttccSiegeState;
    const holdings = (S?.hexHoldings?.(hexDoc)) || { rigIds: [], bossIds: [] };
    const rigIds = Array.isArray(holdings.rigIds) ? holdings.rigIds.slice() : [];
    const bossIds = Array.isArray(holdings.bossIds) ? holdings.bossIds.slice() : [];
    const all = [...rigIds.map(id => ({ id, kind: "rig" })), ...bossIds.map(id => ({ id, kind: "boss" }))];
    if (!all.length) return { summary: "no holdings at hex" };

    if (plan === "preserve") return { summary: `${all.length} holding(s) preserved (defender withdraws)` };

    const effMode = _modeForIntent(intent);
    // byIntentHalf (Trojan / Pyrrhic): preserve half, apply the intent mode to the rest.
    let preserveSet = new Set();
    if (plan === "byIntentHalf") {
      const keep = Math.ceil(all.length / 2);
      preserveSet = new Set(all.slice(0, keep).map(h => h.id));
    }

    const counts = { capture: 0, destroy: 0, scatter: 0, preserve: 0 };
    const keepRig = new Set(), keepBoss = new Set();   // ids that stay in the hex roster
    for (const h of all) {
      if (preserveSet.has(h.id)) { counts.preserve++; (h.kind === "rig" ? keepRig : keepBoss).add(h.id); continue; }
      const actor = game.actors?.get?.(h.id);
      const mode = effMode; // "capture" | "destroy"  (scatter reserved for future event-driven dispersal)
      try {
        if (mode === "capture") {
          if (actor) await actor.update({ "system.identity.factionOwnerId": attackerId, [`flags.${MOD_R}.siegeFate`]: { fate: "captured", by: attackerId, siegeId, turn } });
          counts.capture++; (h.kind === "rig" ? keepRig : keepBoss).add(h.id);   // captured → stays, now attacker's
        } else { // destroy
          if (actor) await actor.update({ [`flags.${MOD_R}.siegeFate`]: { fate: "destroyed", siegeId, turn } });
          counts.destroy++;   // dropped from roster
        }
      } catch (e) { console.warn(TAG, `holding ${mode} failed for ${h.id}`, e); }
    }

    // Rebuild the hex holdings roster (captured + preserved remain; destroyed/scattered removed).
    try {
      const tf = _hexFlags(hexDoc);
      tf.holdings = Object.assign({}, tf.holdings, {
        rigIds: rigIds.filter(id => keepRig.has(id)),
        bossIds: bossIds.filter(id => keepBoss.has(id)),
        lastUpdated: Date.now()
      });
      await hexDoc.update({ [`flags.${MOD_T}`]: tf });
    } catch (e) { console.warn(TAG, "holdings roster rebuild failed", e); }

    const parts = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
    return { summary: parts.join(", ") || "no holdings affected", counts };
  }

  async function _stealStockpile(attackerId, defenderId, pct){
    if (!attackerId || !defenderId || !(pct > 0)) return { stolen: 0 };
    try {
      const stock = game.bbttcc?.api?.factions?.stockpile;
      const atk = game.actors?.get?.(attackerId), def = game.actors?.get?.(defenderId);
      if (!stock?.list || !stock?.adjust || !atk || !def) return { stolen: 0 };
      const items = stock.list(def) || [];
      let stolen = 0;
      for (const it of items) {
        const qty = Math.floor((Number(it.qty) || 0) * pct);
        if (qty <= 0) continue;
        await stock.adjust(atk, it.key, qty);
        await stock.adjust(def, it.key, -qty);
        stolen += qty;
      }
      return { stolen };
    } catch (e) { console.warn(TAG, "stockpile theft failed", e); return { stolen: 0 }; }
  }

  async function _adjustStockpileTotal(factionId, delta){
    // lost_hold "defender stockpile −15 (war cost)" — best-effort flat shave across items.
    if (!factionId || !delta) return;
    try {
      const stock = game.bbttcc?.api?.factions?.stockpile;
      const actor = game.actors?.get?.(factionId);
      if (!stock?.list || !stock?.adjust || !actor) return;
      let remaining = Math.abs(delta);
      for (const it of (stock.list(actor) || [])) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(it.qty) || 0);
        if (take > 0) { await stock.adjust(actor, it.key, -take); remaining -= take; }
      }
    } catch (e) { console.warn(TAG, "stockpile war-cost shave failed", e); }
  }

  async function _recordLedger(hexDoc, { state, cfg, turn }){
    try {
      const fn = game.bbttcc?.api?.territory?.recordHexImprovement;
      if (typeof fn !== "function") return;
      await fn(hexDoc, {
        kind: cfg.ledger,
        label: `Siege resolved — ${cfg.label}`,
        description: `Siege ${state.siegeId} ended on turn ${turn} (${cfg.label}). ${(state.narrativeBeats || []).length} beats in the saga.`,
        source: { activity: "siege_resolve", factionId: state.attackerFactionId, siegeId: state.siegeId },
        after: { status: state.status, beats: (state.narrativeBeats || []).slice(-30) },
        reversible: false,
        dedupeKey: `siege:${state.siegeId}:${state.status}`
      });
    } catch (e) { console.warn(TAG, "ledger record failed", e); }
  }

  async function _pushSaga(factionId, role, { state, cfg, hexUuid, turn }){
    const actor = game.actors?.get?.(factionId);
    if (!actor) return;
    try {
      const wl = Array.isArray(actor.getFlag(MOD_F, "warLogs")) ? actor.getFlag(MOD_F, "warLogs").slice() : [];
      wl.push({
        ts: Date.now(), date: (new Date()).toLocaleString(),
        type: "siege", activity: "siege_resolved",
        summary: `Siege ${cfg.label} (${role}) — turn ${turn}.`,
        siegeId: state.siegeId, hexUuid, role, status: state.status,
        narrativeBeats: (state.narrativeBeats || []).slice()   // the full saga, retold
      });
      await actor.update({ [`flags.${MOD_F}.warLogs`]: wl });
    } catch (e) { console.warn(TAG, `war-log saga push failed (${role})`, e); }
  }

  async function _chatCard({ state, cfg, hexName, refunded, holdingsSummary }){
    const beats = (state.narrativeBeats || []).slice(-8);
    const beatList = beats.map(b => `<li style="margin:0;">${foundry.utils.escapeHTML(b.title || b.kind || "—")}</li>`).join("");
    const color = cfg.win ? "#d9a441" : "#9a9a9a";
    await ChatMessage.create({
      content: `<div class="bbttcc-siege-outcome" style="border:1px solid ${color};border-radius:6px;padding:.5rem .7rem;">
        <h3 style="margin:0 0 .25rem;color:${color};">🏰 ${foundry.utils.escapeHTML(cfg.label)} — ${foundry.utils.escapeHTML(hexName || "Siege")}</h3>
        <div style="font-size:0.85em;color:#bbb;">
          ${cfg.transferHex ? "Hex taken. " : ""}${cfg.modifiers?.length ? `Modifiers: ${cfg.modifiers.join(", ")}. ` : ""}${refunded ? `Buffer refund: +${refunded} OP. ` : ""}${holdingsSummary && holdingsSummary !== "no holdings at hex" ? `Holdings: ${holdingsSummary}.` : ""}
        </div>
        ${beats.length ? `<details style="margin-top:.35rem;"><summary style="cursor:pointer;color:${color};font-size:0.82em;">Siege Saga (${(state.narrativeBeats || []).length} beats)</summary><ul style="margin:.25rem 0 0;padding-left:1.1rem;font-size:0.8em;color:#ccc;">${beatList}</ul></details>` : ""}
      </div>`
    });
  }

  // ── the write-back ────────────────────────────────────────────────────────
  const _processing = new Set();   // in-memory lock against same-tick double-fire

  async function applyOutcomeWriteback(payload){
    if (!game.user?.isGM) return;   // single writer — shared hex/faction docs
    const S = globalThis.__bbttccSiegeState;
    if (!S) return;
    const hexUuid = payload?.hexUuid;
    const siegeId = payload?.siegeId;
    if (!hexUuid || !siegeId) return;
    if (_processing.has(siegeId)) return;
    _processing.add(siegeId);
    try {
      const state = await S.getSiegeState(hexUuid);
      if (!state) return;                       // already cleared (idempotent — second fire no-ops)
      if (state._writtenBack) return;
      const cfg = MATRIX[state.status];
      if (!cfg) { console.warn(TAG, "no matrix row for status", state.status); return; }

      const turn = _currentTurn();
      const ref = await fromUuid(hexUuid);
      const hexDoc = ref?.document ?? ref ?? null;
      const attackerId = state.attackerFactionId || null;
      const defenderId = (hexDoc && S.hexOwner) ? (S.hexOwner(hexDoc) || null) : null;   // read BEFORE transfer
      const intent = state.intent || "sack";

      // 1. Drain mid-siege pending morale deltas (E.3 relief −1 / E.4 trojan −2).
      for (const d of (state.pendingMoraleDeltas || [])) await _bumpMorale(d.factionId, d.delta, d.reason || "pending");

      // 2. Matrix morale.
      await _bumpMorale(attackerId, cfg.atkMorale, "outcome_attacker");
      await _bumpMorale(defenderId, cfg.defMorale, "outcome_defender");
      if (cfg.relieverMorale && payload.callingFactionId) await _bumpMorale(payload.callingFactionId, cfg.relieverMorale, "relieving_faction");

      // 3. Buffer refund.
      const { refunded } = await _refundBuffer(attackerId, state.buffer, cfg.refundPct);

      // 4. Hex ownership + modifiers (+ ledger).
      let holdingsSummary = "holdings untouched";
      if (hexDoc) {
        if (cfg.transferHex || cfg.modifiers?.length) {
          await _transferHexAndModifiers(hexDoc, { newOwnerId: cfg.transferHex ? attackerId : null, addModifiers: cfg.modifiers, turn });
        }
        // 5. Holdings (only when the attacker actually takes/sacks the place).
        if (cfg.win && cfg.holdings !== "none") {
          const r = await _handleHoldings(hexDoc, { plan: cfg.holdings, attackerId, intent, turn, siegeId });
          holdingsSummary = r.summary;
        }
        await _recordLedger(hexDoc, { state, cfg, turn });
      }

      // 6. Stockpile (won_sack theft / lost_hold war cost).
      if (cfg.stealStockpilePct) await _stealStockpile(attackerId, defenderId, cfg.stealStockpilePct);
      if (cfg.defStockpileDelta) await _adjustStockpileTotal(defenderId, cfg.defStockpileDelta);

      // 7. War Log saga to BOTH factions (full narrativeBeats[]).
      if (attackerId) await _pushSaga(attackerId, "attacker", { state, cfg, hexUuid, turn });
      if (defenderId && defenderId !== attackerId) await _pushSaga(defenderId, "defender", { state, cfg, hexUuid, turn });

      // 8. Chat card with the retold saga.
      await _chatCard({ state, cfg, hexName: ref?.name || hexDoc?.name, refunded, holdingsSummary });

      // 9. Clear the siege flag + faction back-refs (the campaign moves on).
      try { await S.clearState(hexUuid); } catch (e) { console.warn(TAG, "clearState failed", e); }
      for (const [fid, flag] of [[attackerId, "activeSieges"], [defenderId, "defendingSieges"]]) {
        const a = fid && game.actors?.get?.(fid);
        if (!a) continue;
        try {
          const next = (a.getFlag(MOD_F, flag) || []).filter(u => u !== hexUuid);
          await a.update({ [`flags.${MOD_F}.${flag}`]: next });
        } catch (e) { console.warn(TAG, `back-ref cleanup failed (${flag})`, e); }
      }

      Hooks.callAll("bbttcc:siege:writtenBack", { siegeId, hexUuid, status: state.status });
      console.log(TAG, `wrote back ${state.status} for ${siegeId} (refund ${refunded} OP, holdings: ${holdingsSummary}).`);
    } catch (err) {
      console.error(TAG, "write-back failed", err);
      ui.notifications?.error?.("Siege outcome write-back failed — see console.");
    } finally {
      _processing.delete(siegeId);
    }
  }

  // ── install ───────────────────────────────────────────────────────────────
  function _install(){
    if (!globalThis.__bbttcc_siege_writeback_hook_installed) {
      Hooks.on("bbttcc:siege:outcome", applyOutcomeWriteback);
      globalThis.__bbttcc_siege_writeback_hook_installed = true;
    }
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.applyOutcomeWriteback = (hexUuid) => {
      const S = globalThis.__bbttccSiegeState;
      const hit = S?.listActiveSieges?.().find(s => s.hexUuid === hexUuid);
      return applyOutcomeWriteback({ hexUuid, siegeId: hit?.siege?.siegeId });
    };
    game.bbttcc.api.siege.OUTCOME_MATRIX = MATRIX;
  }
  Hooks.once("ready", () => { _install(); console.log(TAG, "Outcome write-back ready (F.1)."); });
  if (game?.ready) _install();

  console.log(TAG, "loaded");
})();
