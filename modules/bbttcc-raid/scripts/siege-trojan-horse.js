// bbttcc-raid/scripts/siege-trojan-horse.js
// SIEGE_RAID_TYPE_SPEC.md §7 (attacker table) — Phase E.4: Trojan Horse + Sinon Mode.
//
// The T4 Intrigue gambit that can end a siege without razing a layer. A 3-roll gate:
//   1. Sneak    — Intrigue vs the defender's Suspicion DC (scales with watching champions)
//   2. Sabotage — Faith OR Diplomacy (flavor pick)
//   3. Breach   — Violence
// ALL pass → the final layer opens from within → `won_trojan_horse`.
// ANY fail  → −50% forces (Buffer halved) + Buffer −40 + attacker −2 morale; the siege grinds on.
//
// Sinon Mode (optional force multiplier): commit one ACTIVE attacker Champion as a sacrifice.
// Their status flips to `dead` IMMEDIATELY (the death + cascade fire as-if the ruse succeeded),
// and in exchange every roll gets +5, OR one roll of the player's choice auto-succeeds. The
// sacrificed Champion's name binds to the outcome forever (mythic gravity). The champion dies
// whether or not the gambit then succeeds.
//
// Launch surfaces: the Siege HUD "🐴 Trojan" button (GM) + game.bbttcc.api.siege.openTrojanHorseDialog,
// and the strategic catalog entry (apply → dialog), mirroring the Champion Duel's pattern.

(() => {
  globalThis.__bbttcc_siege_trojan_horse_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const TAG = "[bbttcc/siege-trojan]";
  const VIOLET = "#a78bfa";

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
  const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const _roll = async () => (await new Roll("1d20").evaluate()).total;

  function _relayHook(hook, payload){
    Hooks.callAll(hook, payload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook, payload }); } catch (_e) {}
  }

  function _resolveSiegeEntry({ hexUuid, siegeId } = {}){
    const S = globalThis.__bbttccSiegeState;
    if (!S?.listActiveSieges) return null;
    const sieges = S.listActiveSieges();
    if (hexUuid) return sieges.find(e => e.hexUuid === hexUuid) || null;
    if (siegeId) return sieges.find(e => e.siege?.siegeId === siegeId) || null;
    if (sieges.length === 1) return sieges[0];
    return null;
  }

  // ─── Resolution ──────────────────────────────────────────────────────────

  async function _resolve(entry, cfg){
    const api = _siege();
    const S = globalThis.__bbttccSiegeState;
    const hexUuid = entry.hexUuid;
    const turn = _currentTurn();
    const { sneakDC, sabotageDC, breachDC, sabotageCat, sinon, sinonChampId, sinonMode, sinonAutoKey } = cfg;

    // 1. Sinon sacrifice FIRST — persists the death so the outcome write below re-reads it.
    //    The championDeath HOOK is fired LAST (see end of fn): Hooks.callAll doesn't await async
    //    handlers, so firing it before the outcome write would let the F.2 cascade's state persist
    //    get clobbered by step 3's setState. Firing it after makes the cascade the last writer.
    let sinonName = null, sinonDeathPayload = null;
    if (sinon && sinonChampId) {
      const cur = entry.siege;
      const ok = await api.applyChampionStatusChange({ siegeId: cur.siegeId, championId: sinonChampId, newStatus: "dead", source: "trojan_horse_sinon", side: "attacker" });
      if (ok) {
        sinonName = _nm(sinonChampId);
        sinonDeathPayload = { siegeId: cur.siegeId, hexUuid, championId: sinonChampId, side: "attacker", source: "trojan_horse_sinon" };
      }
    }

    // 2. The three rolls (1d20 each; Sinon adds +5 to all, or auto-succeeds one).
    const defs = [
      { key: "sneak",    label: "Sneak past the watch",  cat: "Intrigue",  dc: sneakDC },
      { key: "sabotage", label: "Sabotage the defences", cat: sabotageCat, dc: sabotageDC },
      { key: "breach",   label: "Breach from within",    cat: "Violence",  dc: breachDC }
    ];
    const results = [];
    for (const d of defs) {
      const auto = sinon && sinonMode === "auto" && sinonAutoKey === d.key;
      if (auto) { results.push({ ...d, auto: true, total: d.dc, pass: true }); continue; }
      const base = await _roll();
      const bonus = (sinon && sinonMode === "all") ? 5 : 0;
      const total = base + bonus;
      results.push({ ...d, auto: false, base, bonus, total, pass: total >= d.dc });
    }
    const allPass = results.every(r => r.pass);

    // 3. Apply the outcome to fresh state (post-Sinon).
    const state = await api.getState(hexUuid);
    if (!state) return ui.notifications?.warn?.("No active siege on that hex.");

    if (sinonName) {
      S.appendNarrativeBeat(state, {
        turn, kind: "trojan_sinon",
        title: `${sinonName} enters the gates`,
        description: "A champion gives their life to carry the ruse through the gate.",
        actorIds: [sinonChampId]
      });
    }

    let bufferShaved = 0, halved = 0;
    if (allPass) {
      // The gates open from within — every remaining layer falls at once.
      (state.layers || []).forEach(l => {
        if (!l.breached) { l.breached = true; l.breachedAtTurn = turn; l.breachedBy = "trojan_horse"; }
      });
      state.currentLayerIdx = Math.max(0, (state.layers || []).length - 1);
      state.status = "won_trojan_horse";
      state.endedTurn = turn;
      state._suggestConvene = false;
      S.appendNarrativeBeat(state, {
        turn, kind: "trojan_horse",
        title: "The gates open from within",
        description: `Trojan Horse succeeds — ${results.map(r => `${r.label} ${r.auto ? "AUTO" : r.total}≥${r.dc}`).join(", ")}. The place falls by treachery (won_trojan_horse).`,
        payload: { results, sinon: !!sinonName }
      });
      await api.setState(hexUuid, state);
      _relayHook("bbttcc:siege:trojanHorse", { siegeId: state.siegeId, hexUuid, success: true, sinon: !!sinonName, championId: sinonChampId || null });
      _relayHook("bbttcc:siege:outcome", { siegeId: state.siegeId, hexUuid, status: "won_trojan_horse" });
    } else {
      // The ruse is discovered — heavy cost, but the siege continues.
      bufferShaved = S.shaveBuffer(state.buffer, 40).shaved;
      for (const k of Object.keys(state.buffer)) {
        const cut = Math.floor((state.buffer[k] || 0) / 2);  // −50% forces
        state.buffer[k] -= cut; halved += cut;
      }
      const failed = results.filter(r => !r.pass).map(r => r.label).join(", ");
      if (state.attackerFactionId) S.recordMoraleDelta(state, { factionId: state.attackerFactionId, delta: -2, reason: "trojan_horse_failed", turn });
      S.appendNarrativeBeat(state, {
        turn, kind: "trojan_failed",
        title: "The ruse is discovered",
        description: `Trojan Horse FAILS (${failed}). Forces halved (−${halved} OP), Buffer −${bufferShaved}, attacker −2 morale (applied in Phase F).`,
        payload: { results, sinon: !!sinonName, bufferShaved, halved }
      });
      await api.setState(hexUuid, state);
      _relayHook("bbttcc:siege:trojanHorse", { siegeId: state.siegeId, hexUuid, success: false, sinon: !!sinonName, championId: sinonChampId || null });
      _relayHook("bbttcc:siege:trojanFailed", { siegeId: state.siegeId, hexUuid, bufferShaved, halved });
    }

    // 4. Chat card.
    const rollRows = results.map(r =>
      `<div style="display:flex;justify-content:space-between;font-size:0.85em;"><span>${_esc(r.label)} <i style="color:#999;">(${_esc(r.cat)})</i></span><span style="color:${r.pass ? "#88cc55" : "#ff7a7a"};">${r.auto ? "AUTO ✓" : `${r.total} vs DC ${r.dc} ${r.pass ? "✓" : "✗"}`}</span></div>`
    ).join("");
    await ChatMessage.create({
      content: `<div class="bbttcc-siege-trojan" style="border:1px solid ${VIOLET};border-radius:6px;padding:.5rem .7rem;">
        <h3 style="margin:0 0 .25rem;color:${VIOLET};">🐴 Trojan Horse — ${_esc(entry.hexName || "Siege")}</h3>
        ${sinonName ? `<div style="color:${VIOLET};font-style:italic;margin-bottom:.25rem;">${_esc(sinonName)} enters the gates — and does not return.</div>` : ""}
        ${rollRows}
        <div style="margin-top:.3rem;font-weight:700;color:${allPass ? VIOLET : "#ff7a7a"};">${allPass ? "THE GATES OPEN FROM WITHIN" : "THE RUSE IS UNDONE"}</div>
        ${allPass ? "" : `<div style="font-size:0.82em;color:#aaa;">Forces halved (−${halved}) · Buffer −${bufferShaved} · attacker −2 morale</div>`}
      </div>`
    });

    ui.notifications?.info?.(allPass ? "Trojan Horse SUCCEEDS — won_trojan_horse." : "Trojan Horse fails — heavy losses.");
    api.refreshHud?.();

    // Sinon: fire championDeath + cascade LAST, after the outcome write above (race-safe).
    // On a win the siege is already cleared by F.1's outcome write-back → cascade applies morale
    // only and skips siege-state effects; on a fail it applies the full cascade to the live siege.
    if (sinonDeathPayload) _relayHook("bbttcc:siege:championDeath", sinonDeathPayload);
  }

  // ─── Dialog ────────────────────────────────────────────────────────────────

  async function openTrojanHorseDialog(opts = {}){
    if (!game.user?.isGM) return ui.notifications?.warn?.("Only the GM can adjudicate a Trojan Horse.");
    const S = globalThis.__bbttccSiegeState;
    const sieges = S?.listActiveSieges?.() || [];
    if (!sieges.length) return ui.notifications?.warn?.("No active siege.");

    let entry = _resolveSiegeEntry(opts);
    if (!entry) { entry = sieges[0]; if (sieges.length > 1) ui.notifications?.info?.(`Multiple sieges active — using ${entry.hexName}. Pass {hexUuid} to target another.`); }

    const state = entry.siege;
    const watchers = (state.defenderChampions || []).filter(c => c.status === "active").length;
    const sneakDC = 10 + watchers;  // the watching champions ARE the Suspicion
    const atkChamps = (state.attackerChampions || []).filter(c => c.status === "active");
    const champOpts = atkChamps.map(c => `<option value="${c.actorId}">${_esc(_nm(c.actorId))}</option>`).join("");

    const content = `
      <div style="display:flex;flex-direction:column;gap:.5rem;font-size:0.9rem;">
        <div style="color:${VIOLET};">Siege: <b>${_esc(entry.hexName || "—")}</b> — the gambit at the gate.</div>
        <fieldset style="border:1px solid #555;border-radius:4px;padding:.3rem .5rem;">
          <legend>The three rolls (1d20 vs DC)</legend>
          <label style="display:flex;justify-content:space-between;align-items:center;">Sneak — Intrigue vs Suspicion <input type="number" name="sneakDC" value="${sneakDC}" style="width:55px;"></label>
          <label style="display:flex;justify-content:space-between;align-items:center;margin-top:.2rem;">Sabotage —
            <span><select name="sabotageCat" style="width:90px;"><option value="Faith">Faith</option><option value="Diplomacy">Diplomacy</option></select>
            <input type="number" name="sabotageDC" value="12" style="width:55px;"></span></label>
          <label style="display:flex;justify-content:space-between;align-items:center;margin-top:.2rem;">Breach — Violence <input type="number" name="breachDC" value="12" style="width:55px;"></label>
          <div style="font-size:0.74rem;color:#999;margin-top:.2rem;">Suspicion DC defaults to 10 + ${watchers} watching champion(s).</div>
        </fieldset>
        <fieldset style="border:1px solid ${VIOLET};border-radius:4px;padding:.3rem .5rem;">
          <legend style="color:${VIOLET};">Sinon Mode (optional)</legend>
          ${atkChamps.length
            ? `<label><input type="checkbox" name="sinon"> Sacrifice a Champion (dies regardless of outcome)</label>
               <div class="ft-sinon-body" style="display:none;margin-top:.3rem;padding-left:.4rem;border-left:2px solid ${VIOLET};">
                 <label style="display:block;">Champion<br><select name="sinonChamp" style="width:100%;">${champOpts}</select></label>
                 <label style="display:block;margin-top:.25rem;"><input type="radio" name="sinonMode" value="all" checked> +5 to all three rolls</label>
                 <label style="display:block;"><input type="radio" name="sinonMode" value="auto"> Auto-succeed one roll:
                   <select name="sinonAuto" style="width:110px;"><option value="sneak">Sneak</option><option value="sabotage">Sabotage</option><option value="breach">Breach</option></select></label>
               </div>`
            : `<div style="color:#999;font-style:italic;">No active attacker Champion to sacrifice.</div>`}
        </fieldset>
      </div>`;

    new Dialog({
      title: "🐴 Trojan Horse",
      content,
      buttons: {
        resolve: {
          icon: '<i class="fas fa-horse"></i>',
          label: "Spring the Ruse",
          callback: async (html) => {
            const root = html[0] ?? html;
            const num = (n, d) => { const v = parseInt(root.querySelector(`[name="${n}"]`)?.value, 10); return Number.isFinite(v) ? v : d; };
            const sinon = !!root.querySelector('[name="sinon"]')?.checked;
            const cfg = {
              sneakDC: num("sneakDC", sneakDC),
              sabotageDC: num("sabotageDC", 12),
              breachDC: num("breachDC", 12),
              sabotageCat: root.querySelector('[name="sabotageCat"]')?.value || "Faith",
              sinon,
              sinonChampId: sinon ? (root.querySelector('[name="sinonChamp"]')?.value || null) : null,
              sinonMode: root.querySelector('[name="sinonMode"]:checked')?.value || "all",
              sinonAutoKey: root.querySelector('[name="sinonAuto"]')?.value || "sneak"
            };
            if (sinon && !cfg.sinonChampId) return ui.notifications?.warn?.("Pick a champion to sacrifice, or uncheck Sinon Mode.");
            try { await _resolve(entry, cfg); }
            catch (e) { console.error(TAG, "resolve failed", e); ui.notifications?.error?.("Trojan Horse resolution failed — see console."); }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "resolve",
      render: (html) => {
        const root = html[0] ?? html;
        const cb = root.querySelector('[name="sinon"]');
        const body = root.querySelector('.ft-sinon-body');
        if (cb && body) cb.addEventListener("change", () => { body.style.display = cb.checked ? "block" : "none"; });
      }
    }).render(true);
  }

  // ─── Catalog registration + API ───────────────────────────────────────────

  whenRaidReady((api) => {
    const E = api.EFFECTS;
    E.trojan_horse = Object.assign({}, E.trojan_horse, {
      kind: "strategic",
      key: "trojan_horse",
      label: "Trojan Horse",
      tier: 4,
      band: "legendary",
      cost: { intrigue: 40, diplomacy: 20, softPower: 20 },
      raidTypes: ["siege"],
      siegeTrojanHorse: true,
      text: "A T4 Intrigue gambit: a 3-roll gate (sneak/sabotage/breach) that can end a siege from within. Sinon Mode sacrifices a Champion for a force multiplier.",
      async apply(){ await openTrojanHorseDialog({}); return "Trojan Horse dialog opened."; }
    });
    // Strategic-throughput alias so a planner commit surfaces the dialog (GM resolves the gamble).
    if (api.STRATEGIC_THROUGHPUT) {
      api.STRATEGIC_THROUGHPUT.trojan_horse = async (ctx) => { await openTrojanHorseDialog({ hexUuid: ctx?.targetUuid }); return { ok: true, summary: "Trojan Horse dialog opened (resolve the gamble)." }; };
    }
    console.log(TAG, "trojan_horse registered (catalog + throughput).");
  });

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.openTrojanHorseDialog = openTrojanHorseDialog;
    console.log(TAG, "Trojan Horse ready (E.4).");
  });

  console.log(TAG, "loaded");
})();
