// bbttcc-raid/scripts/siege-champion-duel.js
// SIEGE_RAID_TYPE_SPEC.md §5 + §6 — Phase D.4: Champion Duel.
//
// The Iliad "champions on the wall" moment. Issue a 1v1 challenge between an active
// attacker Champion and an active defender Champion. Resolution writes the loser's new
// status (wounded / dead) back to siege state via the shipped applyChampionStatusChange,
// fires bbttcc:siege:championDuel (+ championDeath on a kill) for VFX/HUD, and posts a
// chat card. The Champion Death CASCADE (§8 — grief/rally flips, next-layer threshold
// weakening) stays Phase F; D.4 fires the event the cascade will subscribe to.
//
// Launch surfaces: the Siege HUD "⚔ Duel" button (GM) and game.bbttcc.api.siege.openChampionDuelDialog.
// (The spec's uiHandler hook isn't a real dispatch in this build, so the duel is API+HUD-driven;
// the catalog entry is registered for discoverability and routes its apply() to the dialog.)

(() => {
  globalThis.__bbttcc_siege_champion_duel_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const TAG = "[bbttcc/siege-duel]";

  function whenRaidReady(cb, tries = 0){
    const go = () => {
      const api = game?.bbttcc?.api?.raid || game?.modules?.get?.(MOD_R)?.api?.raid;
      if (api?.EFFECTS) return cb(api);
      if (tries > 80) return console.warn(TAG, "raid API not ready");
      setTimeout(() => whenRaidReady(cb, tries + 1), 250);
    };
    if (globalThis.Hooks) Hooks.once("ready", go); else go();
  }

  const _siege = () => game.bbttcc?.api?.siege || null;
  const _nm = (id) => game.actors?.get?.(id)?.name || id || "—";
  const _currentTurn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };

  function _resolveSiegeEntry({ hexUuid, siegeId } = {}){
    const S = globalThis.__bbttccSiegeState;
    if (!S?.listActiveSieges) return null;
    const sieges = S.listActiveSieges();
    if (hexUuid) return sieges.find(e => e.hexUuid === hexUuid) || null;
    if (siegeId) return sieges.find(e => e.siege?.siegeId === siegeId) || null;
    if (sieges.length === 1) return sieges[0];
    return null; // ambiguous — caller decides
  }

  // ─── Resolution ──────────────────────────────────────────────────────────

  async function _resolveDuel(entry, atkId, defId, mode, lethal){
    const api = _siege();
    const state = entry.siege;
    const siegeId = state.siegeId;
    const hexUuid = entry.hexUuid;
    const turn = _currentTurn();

    // Determine winner/loser.
    let winnerSide, rolls = null, margin = 0;
    if (mode === "attacker" || mode === "defender") {
      winnerSide = mode;
    } else {
      // Roll it: 1d20 each, reroll ties.
      let a, d, guard = 0;
      do {
        a = (await new Roll("1d20").evaluate()).total;
        d = (await new Roll("1d20").evaluate()).total;
      } while (a === d && guard++ < 5);
      winnerSide = a >= d ? "attacker" : "defender";
      margin = Math.abs(a - d);
      rolls = { attacker: a, defender: d };
    }

    const winnerId = winnerSide === "attacker" ? atkId : defId;
    const loserId  = winnerSide === "attacker" ? defId : atkId;
    const loserSide = winnerSide === "attacker" ? "defender" : "attacker";

    // Fate: lethal toggle, or a decisive roll (margin ≥ 10), kills; otherwise a wound.
    const fate = (lethal || (mode === "roll" && margin >= 10)) ? "dead" : "wounded";

    // 1. Duel narrative beat (write first; applyChampionStatusChange re-reads fresh after).
    try {
      const fresh = await api.getState(hexUuid);
      if (fresh) {
        api.appendNarrativeBeat(fresh, {
          turn,
          kind: "champion_duel",
          title: `${_nm(winnerId)} bests ${_nm(loserId)}`,
          description: `${rolls ? `Duel rolls — ${_nm(atkId)} ${rolls.attacker} vs ${_nm(defId)} ${rolls.defender}. ` : "Outcome declared. "}${_nm(loserId)} is ${fate}.`,
          actorIds: [winnerId, loserId],
          payload: { winnerId, loserId, winnerSide, loserSide, fate, rolls }
        });
        await api.setState(hexUuid, fresh);
      }
    } catch (e) { console.warn(TAG, "duel beat persist failed", e); }

    // 2. Write the loser's status (this also appends a champion_status beat + persists + fires championStatus).
    await api.applyChampionStatusChange({ siegeId, championId: loserId, newStatus: fate, source: "champion_duel", side: loserSide });

    // 3. Fire duel + (on a kill) death events — relay so VFX/HUD react on every client.
    const duelPayload = { siegeId, hexUuid, winnerId, loserId, winnerSide, loserSide, fate, rolls };
    Hooks.callAll("bbttcc:siege:championDuel", duelPayload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook: "bbttcc:siege:championDuel", payload: duelPayload }); } catch (_e) {}
    if (fate === "dead") {
      const deathPayload = { siegeId, hexUuid, championId: loserId, side: loserSide, source: "champion_duel" };
      Hooks.callAll("bbttcc:siege:championDeath", deathPayload); // Phase F: cascade subscribes here
      try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook: "bbttcc:siege:championDeath", payload: deathPayload }); } catch (_e) {}
    }

    // 4. Chat card.
    const rollLine = rolls ? `<div style="font-size:0.85em;color:#aaa;">${_nm(atkId)} rolled <b>${rolls.attacker}</b> · ${_nm(defId)} rolled <b>${rolls.defender}</b></div>` : "";
    await ChatMessage.create({
      content: `<div class="bbttcc-siege-duel" style="border:1px solid #d9a441;border-radius:6px;padding:.5rem .7rem;">
        <h3 style="margin:0 0 .25rem;color:#d9a441;">⚔ Champion Duel</h3>
        <div><b>${_nm(winnerId)}</b> defeats <b>${_nm(loserId)}</b> — ${loserSide} champion is <b style="color:${fate === "dead" ? "#ff5555" : "#ffaa55"};">${fate.toUpperCase()}</b>.</div>
        ${rollLine}
      </div>`
    });

    ui.notifications?.info?.(`Duel: ${_nm(winnerId)} defeats ${_nm(loserId)} (${fate}).`);
    _siege()?.refreshHud?.();
  }

  // ─── Dialog ────────────────────────────────────────────────────────────────

  async function openChampionDuelDialog(opts = {}){
    if (!game.user?.isGM) return ui.notifications?.warn?.("Only the GM can adjudicate a Champion Duel.");
    const S = globalThis.__bbttccSiegeState;
    const sieges = S?.listActiveSieges?.() || [];
    if (!sieges.length) return ui.notifications?.warn?.("No active siege to duel in.");

    let entry = _resolveSiegeEntry(opts);
    // Ambiguous (multiple sieges, none specified) → use the first and note it.
    if (!entry) { entry = sieges[0]; if (sieges.length > 1) ui.notifications?.info?.(`Multiple sieges active — using ${entry.hexName}. Pass {hexUuid} to target another.`); }

    const state = entry.siege;
    const atk = (state.attackerChampions || []).filter(c => c.status === "active");
    const def = (state.defenderChampions || []).filter(c => c.status === "active");
    if (!atk.length || !def.length) {
      return ui.notifications?.warn?.(`Champion Duel needs an ACTIVE champion on both sides (attacker ${atk.length}, defender ${def.length}). Populate faction.flags.bbttcc-factions.championRoster.`);
    }

    const opts2 = (arr) => arr.map(c => `<option value="${c.actorId}">${foundry.utils.escapeHTML(_nm(c.actorId))}</option>`).join("");
    const content = `
      <div style="display:flex;flex-direction:column;gap:.5rem;font-size:0.9rem;">
        <div style="color:#d9a441;">Siege: <b>${foundry.utils.escapeHTML(entry.hexName || "—")}</b></div>
        <label>Attacker champion<br><select name="atk" style="width:100%;">${opts2(atk)}</select></label>
        <label>Defender champion<br><select name="def" style="width:100%;">${opts2(def)}</select></label>
        <fieldset style="border:1px solid #555;border-radius:4px;padding:.3rem .5rem;">
          <legend>Resolution</legend>
          <label style="display:block;"><input type="radio" name="mode" value="roll" checked> Roll it (1d20 each; margin ≥ 10 is lethal)</label>
          <label style="display:block;"><input type="radio" name="mode" value="attacker"> Attacker wins (declared)</label>
          <label style="display:block;"><input type="radio" name="mode" value="defender"> Defender wins (declared)</label>
        </fieldset>
        <label><input type="checkbox" name="lethal"> Lethal — the loser dies (not merely wounded)</label>
      </div>`;

    new Dialog({
      title: "⚔ Champion Duel",
      content,
      buttons: {
        resolve: {
          icon: '<i class="fas fa-khanda"></i>',
          label: "Resolve Duel",
          callback: async (html) => {
            const root = html[0] ?? html;
            const atkId = root.querySelector('[name="atk"]')?.value;
            const defId = root.querySelector('[name="def"]')?.value;
            const mode = root.querySelector('[name="mode"]:checked')?.value || "roll";
            const lethal = !!root.querySelector('[name="lethal"]')?.checked;
            if (!atkId || !defId) return ui.notifications?.warn?.("Pick a champion for each side.");
            try { await _resolveDuel(entry, atkId, defId, mode, lethal); }
            catch (e) { console.error(TAG, "resolve failed", e); ui.notifications?.error?.("Duel resolution failed — see console."); }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "resolve"
    }).render(true);
  }

  // ─── Catalog registration + API ───────────────────────────────────────────

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    E.siege_champion_duel = Object.assign({}, E.siege_champion_duel, {
      kind: "maneuver",
      key: "siege_champion_duel",
      label: "Champion Duel",
      tier: 1,
      raidTypes: ["siege"],
      fireMode: "anytime",
      cost: { anytime: 2 },
      siegeManeuver: true,
      text: "Issue a 1v1 challenge between active Champions. The loser is wounded or slain.",
      description: "<p>Issue a duel challenge to an enemy Champion. Pick an active Champion on each side; resolve by roll or GM ruling. The loser is <b>wounded</b> (half budget; may recover) or <b>slain</b> (permanent — triggers the death cascade in Phase F).</p>",
      meta: { engine: "siege", layer: "tactical", availability: "standard" },
      // No real uiHandler dispatch in this build — apply() opens the dialog if the console fires it.
      async apply(){ await openChampionDuelDialog({}); return "Champion Duel dialog opened."; }
    });
    console.log(TAG, "siege_champion_duel registered (maneuver catalog).");
  });

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.openChampionDuelDialog = openChampionDuelDialog;
    console.log(TAG, "Champion Duel ready (D.4).");
  });

  console.log(TAG, "loaded");
})();
