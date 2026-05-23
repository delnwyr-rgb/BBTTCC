// bbttcc-raid/scripts/siege-champion-cascade.js
// SIEGE_RAID_TYPE_SPEC.md §8 — Phase F.2: the Champion Death Cascade (the Patroclus loop).
//
// Subscribes bbttcc:siege:championDeath (fires from the Duel + Trojan Sinon, relayed via
// siegeHook). GM-only single writer. When a champion falls:
//   • attacker dies → Buffer.violence −20, attacker morale −2, and 30% of each OTHER *absent*
//     attacker champion flips to `active` (vengeance — Achilles answers Patroclus)
//   • defender dies → defender morale −2, 30% of each OTHER *absent* defender champion flips to
//     `active` (the wall rallies), and the CURRENT layer's threshold is weakened 10% (mourns →
//     breaches more easily)
// then fires bbttcc:siege:cascade (+relay) for the VFX banner + posts a consequences chat card.
//
// SPEC NOTE: §8 pseudocode (line 542) said attacker-death flips others → "absent" (grief), but
// the prose below it (line 551, "Achilles … flip to active") + the Iliad premise + the running
// memory all describe RALLY (absent → active). The prose/memory win — death GALVANIZES the side.
//
// Morale is applied IMMEDIATELY via factions.bumpMorale (a faction-level atomic API, not siege
// state) so the hit lands the moment the champion falls — F.1's siege-state single-writer rule
// only governs the shared hex flag, which this handler also re-reads-mutates-persists once.
//
// RACE NOTE: Hooks.callAll does NOT await async handlers, so any firing site that writes siege
// state AFTER firing championDeath would clobber this cascade's persist. The Duel fires it last
// (safe); the Trojan Sinon path was reordered to fire championDeath after its outcome write so
// the cascade is always the last writer.

(() => {
  globalThis.__bbttcc_siege_champion_cascade_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const TAG = "[bbttcc/siege-cascade]";

  const GRIEF_RALLY_CHANCE = 0.30;
  const THRESHOLD_WEAKEN = 0.10;
  const ATTACKER_BUFFER_HIT = 20;   // Buffer.violence
  const MORALE_HIT = -2;

  const _nm = (id) => game.actors?.get?.(id)?.name || id || "a champion";
  const _currentTurn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };

  function _relayHook(hook, payload){
    Hooks.callAll(hook, payload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  async function _bumpMorale(factionId, delta, reason){
    if (!factionId || !delta) return;
    try {
      const fn = game.bbttcc?.api?.factions?.bumpMorale;
      if (typeof fn === "function") await fn({ factionId, delta });
      else console.warn(TAG, "factions.bumpMorale unavailable; morale skipped", { factionId, delta, reason });
    } catch (e) { console.warn(TAG, "bumpMorale failed", reason, e); }
  }

  async function _hexDocFromUuid(uuid){
    try { const ref = await fromUuid(uuid); return ref?.document ?? ref ?? null; } catch { return null; }
  }

  const _done = new Set();          // dedupe: a champion only falls once (siegeId:championId)
  const _processing = new Set();    // serialize rapid deaths on the same siege

  async function onChampionDeath(payload){
    if (!game.user?.isGM) return;   // single writer — shared hex/faction docs
    const S = globalThis.__bbttccSiegeState;
    if (!S) return;
    const { siegeId, hexUuid, championId, side } = payload || {};
    if (!siegeId || !championId || (side !== "attacker" && side !== "defender")) return;

    const deathKey = `${siegeId}:${championId}`;
    if (_done.has(deathKey)) return;
    _done.add(deathKey);

    // Serialize against another death resolving on the same siege.
    while (_processing.has(siegeId)) await new Promise(r => setTimeout(r, 40));
    _processing.add(siegeId);
    try {
      const turn = _currentTurn();
      const hexDoc = hexUuid ? await _hexDocFromUuid(hexUuid) : null;

      // Faction whose champion fell (morale hit + who rallies).
      const factionId = side === "attacker"
        ? (await S.getSiegeState(hexUuid))?.attackerFactionId || null
        : (hexDoc && S.hexOwner ? S.hexOwner(hexDoc) || null : null);

      // Morale lands immediately (faction-level, independent of siege state).
      await _bumpMorale(factionId, MORALE_HIT, `${side}_champion_falls`);

      // Siege-state effects (Buffer / rally / threshold) only while the siege is still active.
      const state = await S.getSiegeState(hexUuid);
      const rallied = [];
      let bufferHit = 0, thresholdWeakened = false;

      if (state && state.status === "active") {
        const roster = side === "attacker" ? (state.attackerChampions || []) : (state.defenderChampions || []);

        // Buffer.violence −20 on an attacker loss.
        if (side === "attacker") {
          const before = Number(state.buffer?.violence) || 0;
          state.buffer.violence = Math.max(0, before - ATTACKER_BUFFER_HIT);
          bufferHit = before - state.buffer.violence;
        }

        // Rally: each OTHER absent champion on the fallen side has a 30% chance to return.
        for (const c of roster) {
          if (c.actorId === championId) continue;
          if (c.status === "absent" && Math.random() < GRIEF_RALLY_CHANCE) {
            c.status = "active";
            c.reason = side === "attacker" ? "cascade_vengeance" : "cascade_rally";
            rallied.push(c.actorId);
          }
        }

        // Defender loss weakens the current layer (the wall mourns → easier to breach).
        if (side === "defender") {
          const layer = (state.layers || [])[state.currentLayerIdx ?? 0];
          if (layer && layer.thresholdPct != null) {
            layer.thresholdPct = Math.min(0.95, Number(layer.thresholdPct) + THRESHOLD_WEAKEN);
            thresholdWeakened = true;
          }
        }

        S.appendNarrativeBeat(state, {
          turn,
          kind: "champion_falls",
          title: `${_nm(championId)} falls`,
          description: `${side === "attacker" ? `Buffer −${bufferHit} Violence; ` : ""}${rallied.length ? `${rallied.map(_nm).join(", ")} ${side === "attacker" ? "rise for vengeance" : "rally to the wall"}; ` : ""}${thresholdWeakened ? "the wall mourns (threshold −10%); " : ""}${side} morale −2.`.trim(),
          actorIds: [championId, ...rallied],
          payload: { side, championId, rallied, bufferHit, thresholdWeakened }
        });
        await S.setSiegeState(hexUuid, state);
      }

      // Broadcast the cascade beat (VFX banner + HUD refresh) + post a consequences chat card.
      const cascadePayload = { siegeId, hexUuid, side, championId, rallied, bufferHit, thresholdWeakened };
      _relayHook("bbttcc:siege:cascade", cascadePayload);
      await _chatCard(cascadePayload);

      console.log(TAG, `cascade for ${_nm(championId)} (${side}): buffer −${bufferHit}, ${rallied.length} rallied, threshold ${thresholdWeakened ? "−10%" : "n/a"}.`);
    } catch (err) {
      console.error(TAG, "cascade failed", err);
    } finally {
      _processing.delete(siegeId);
    }
  }

  async function _chatCard({ side, championId, rallied, bufferHit, thresholdWeakened }){
    const color = side === "attacker" ? "#ff9a9a" : "#88bbff";
    const lines = [];
    if (side === "attacker" && bufferHit) lines.push(`Buffer −${bufferHit} Violence`);
    lines.push(`${side === "attacker" ? "Attacker" : "Defender"} morale −2`);
    if (rallied.length) lines.push(`<b style="color:${color};">${rallied.map(_nm).map(foundry.utils.escapeHTML).join(", ")}</b> ${side === "attacker" ? "rise for vengeance" : "rally to the wall"}`);
    if (thresholdWeakened) lines.push("The wall mourns — current layer threshold −10%");
    await ChatMessage.create({
      content: `<div class="bbttcc-siege-cascade" style="border:1px solid ${color};border-radius:6px;padding:.5rem .7rem;">
        <h3 style="margin:0 0 .25rem;color:${color};">☠ ${foundry.utils.escapeHTML(_nm(championId))} Falls</h3>
        <ul style="margin:.1rem 0 0;padding-left:1.1rem;font-size:0.85em;color:#ccc;">${lines.map(l => `<li>${l}</li>`).join("")}</ul>
      </div>`
    });
  }

  function _install(){
    if (!globalThis.__bbttcc_siege_cascade_hook_installed) {
      Hooks.on("bbttcc:siege:championDeath", onChampionDeath);
      globalThis.__bbttcc_siege_cascade_hook_installed = true;
    }
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    // Debug/manual trigger.
    game.bbttcc.api.siege.runChampionCascade = onChampionDeath;
  }
  Hooks.once("ready", () => { _install(); console.log(TAG, "Champion Death Cascade ready (F.2)."); });
  if (game?.ready) _install();

  console.log(TAG, "loaded");
})();
