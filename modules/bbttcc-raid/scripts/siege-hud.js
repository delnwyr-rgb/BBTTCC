// bbttcc-raid/scripts/siege-hud.js
// SIEGE_RAID_TYPE_SPEC.md §5 — Phase D.1: on-canvas Siege HUD + Convene Breach Scene spine.
//
// Mirrors raid-courtly.hud.js plumbing (DOM panel on document.body, _swapPanel +
// _ftMakeHudDraggable, debounced _renderAll on hooks). Data source is the live siege
// registry — game.bbttcc.api.siege.list() — so no open console is required; the HUD
// surfaces whenever ≥1 active siege exists.
//
// GM sees a control panel with a "⚔ Convene Breach Scene" button per siege. Convene:
//   1. GM views the current layer's bound scene (if set) + broadcasts siegeSceneSwap so
//      players follow.
//   2. Opens the raid console with siege context.
//   3. Fires bbttcc:siege:convene + relays via siegeHook socket (D.3 VFX subscribes).
// Non-GM clients see the same status read-only (no Convene button).

(() => {
  globalThis.__bbttcc_siege_hud_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const TAG = "[bbttcc/siege-hud]";

  // Siege palette
  const BRONZE = "#d9a441";
  const SUPPLY_COLOR = { supplied: "#6fcf6f", harassed: "#ffaa55", severed: "#ff5555" };

  let _el = null;
  let _renderTimer = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

  function _siegeApi() { return game.bbttcc?.api?.siege || null; }

  function _activeSieges() {
    const api = _siegeApi();
    if (!api?.list) return [];
    try { return api.list() || []; } catch (e) { console.warn(TAG, "list() failed", e); return []; }
  }

  function _bufferTotal(buffer) {
    return Object.values(buffer || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  }

  function _champCounts(arr) {
    const a = Array.isArray(arr) ? arr : [];
    return {
      active: a.filter(c => c.status === "active").length,
      wounded: a.filter(c => c.status === "wounded").length,
      dead: a.filter(c => c.status === "dead").length,
      total: a.length
    };
  }

  function _champStrip(s) {
    const A = _champCounts(s.attackerChampions), D = _champCounts(s.defenderChampions);
    if (!A.total && !D.total) return "";
    const fmt = (c) => `⚔${c.active}${c.wounded ? ` ·${c.wounded}<span style="color:#ffaa55;">✚</span>` : ""}${c.dead ? ` ·${c.dead}<span style="color:#ff5555;">☠</span>` : ""}`;
    return `<div title="active · wounded ✚ · dead ☠" style="margin-top:.3rem;display:flex;justify-content:space-between;font-size:0.66rem;color:#bbb;">
        <span>atk ${fmt(A)}</span><span>def ${fmt(D)}</span></div>`;
  }

  // ─── HTML builders ──────────────────────────────────────────────────────────

  function _layersStrip(siege) {
    const layers = Array.isArray(siege.layers) ? siege.layers : [];
    if (!layers.length) return `<span style="color:#888;font-style:italic;">no layers</span>`;
    return layers.map((l, i) => {
      const cur = i === (siege.currentLayerIdx ?? 0);
      const name = (() => {
        const a = game.actors?.get?.(l.structureActorId);
        return a?.name || l.layerId || `Layer ${i + 1}`;
      })();
      let style = "padding:1px 6px;border-radius:8px;font-size:0.68rem;border:1px solid #444;color:#aaa;background:#1a1a22;";
      let mark = "";
      if (l.breached) {
        style = "padding:1px 6px;border-radius:8px;font-size:0.68rem;border:1px solid #6a3030;color:#ff7a7a;background:#241416;text-decoration:line-through;";
        mark = " ✗";
      } else if (cur) {
        style = `padding:1px 6px;border-radius:8px;font-size:0.68rem;border:1px solid ${BRONZE};color:${BRONZE};background:#2a2310;font-weight:600;box-shadow:0 0 6px rgba(217,164,65,0.4);`;
        mark = " ◄";
      }
      return `<span title="${esc(name)}${l.transitionRule ? " — " + esc(l.transitionRule) : ""}" style="${style}">${esc(name)}${mark}</span>`;
    }).join(" ");
  }

  // F.4 — player-facing helpers.
  function _turn() { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } }
  function _bufColor(pct) { return pct > 50 ? "#6fcf6f" : (pct >= 25 ? "#ffaa55" : "#ff5555"); }

  // The last few siege beats — the saga-so-far ticker (read-only, all clients).
  function _beatsFooter(s) {
    const beats = Array.isArray(s.narrativeBeats) ? s.narrativeBeats.slice(-3) : [];
    if (!beats.length) return "";
    const rows = beats.map(b => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">• ${esc(b.title || b.kind || "—")}</div>`).join("");
    return `<div title="Recent siege beats" style="margin-top:.35rem;padding-top:.3rem;border-top:1px solid #2a2518;font-size:0.64rem;color:#9a9a8a;line-height:1.35;">${rows}</div>`;
  }

  function _siegeRow(entry, isGM) {
    const s = entry.siege;
    const supply = String(s.supplyStatus || "supplied");
    const sc = SUPPLY_COLOR[supply] || "#aaa";
    const total = _bufferTotal(s.buffer);
    const start = Number(s.bufferStartingTotal || 0);
    const pct = start > 0 ? Math.round(100 * clamp(total, 0, start) / start) : 0;
    const atk = game.actors?.get?.(s.attackerFactionId);
    const interd = (s.interdictedHexIds || []).length;
    const reliefWaves = (s.reliefWaves || []).filter(w => !w.resolved);
    const reliefPending = reliefWaves.length;
    const reliefArrived = reliefWaves.filter(w => w.arrived).length;
    const bufColor = _bufColor(pct);
    const graceLeft = (supply === "severed" && s.supplySeveredAtTurn != null)
      ? Math.max(0, (s.gracePeriodTurns ?? 2) - (_turn() - s.supplySeveredAtTurn))
      : null;

    // Auto-suggest pip — scaffold. Lit when state._suggestConvene is set (D.2 Bombard accrual
    // will toggle this); dim otherwise. Never auto-fires — convening stays a GM gesture.
    const pipLit = s._suggestConvene === true;
    const pip = `<span title="${pipLit ? "Breach Scene suggested (Bombard accrual)" : "Convene when ready (GM gesture)"}" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${pipLit ? BRONZE : "#333"};box-shadow:${pipLit ? `0 0 8px ${BRONZE}` : "none"};"></span>`;

    const canDuel = _champCounts(s.attackerChampions).active > 0 && _champCounts(s.defenderChampions).active > 0;
    // Relief button only shows when a wave is in flight; it lights up once a wave has arrived.
    const reliefBtn = reliefPending
      ? `<button type="button" data-act="relieve" data-hex="${esc(entry.hexUuid)}" title="${reliefArrived ? "Convene the Relief Scene (relief has arrived)" : "Relief is still en route — convene early to pre-empt"}" style="flex:1;padding:3px 6px;background:#101a2a;color:${reliefArrived ? "#88bbff" : "#5a6a8a"};border:1px solid ${reliefArrived ? "#88bbff" : "#2a4a6a"};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;opacity:${reliefArrived ? "1" : "0.6"};box-shadow:${reliefArrived ? "0 0 8px rgba(136,187,255,0.5)" : "none"};">🛡 Relieve</button>`
      : "";
    const gmBtns = isGM
      ? `<div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:5px;">
          <button type="button" data-act="convene" data-hex="${esc(entry.hexUuid)}" style="flex:2;padding:3px 6px;background:#2a2310;color:${BRONZE};border:1px solid ${BRONZE};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;">⚔ Convene</button>
          <button type="button" data-act="duel" data-hex="${esc(entry.hexUuid)}" title="${canDuel ? "Issue a Champion Duel" : "Needs an active champion on both sides"}" style="flex:1;padding:3px 6px;background:#2a2310;color:${canDuel ? "#ff9a9a" : "#7a6a4a"};border:1px solid ${canDuel ? "#ff9a9a" : "#5a4a2a"};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;opacity:${canDuel ? "1" : "0.55"};">Duel</button>
          ${reliefBtn}
          <button type="button" data-act="trojan" data-hex="${esc(entry.hexUuid)}" title="Trojan Horse (T4 Intrigue gambit)" style="flex:1;padding:3px 6px;background:#1a1530;color:#a78bfa;border:1px solid #6d5aa8;border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;">🐴 Trojan</button>
        </div>`
      : "";

    const statusChip = (label, color) => `<span style="font-size:0.66rem;padding:1px 5px;border:1px solid ${color};border-radius:8px;color:${color};">${esc(label)}</span>`;

    return `<div data-hex="${esc(entry.hexUuid)}" style="padding:.4rem .5rem;border:1px solid #3a3322;border-radius:5px;background:rgba(30,26,16,0.5);margin-bottom:.4rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <span style="font-weight:600;color:#f0e6d0;font-size:0.8rem;">${esc(entry.hexName || "Siege")}</span>
        <span style="display:flex;align-items:center;gap:5px;">${pip}<span style="font-size:0.66rem;color:#999;">${esc(s.sizeProfile || "standard")}</span></span>
      </div>
      <div style="margin:.3rem 0 2px;display:flex;justify-content:space-between;font-size:0.7rem;color:#ccc;">
        <span style="color:${BRONZE};">Buffer</span>
        <span>${total}${start > 0 ? `/${start}` : ""} OP</span>
      </div>
      <div style="position:relative;height:7px;background:#1a1a22;border:1px solid #333;border-radius:3px;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${bufColor};box-shadow:0 0 6px ${bufColor};transition:width .3s;"></div>
      </div>
      <div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
        ${statusChip(`supply: ${supply}${graceLeft != null ? ` · grace ${graceLeft}` : ""}`, sc)}
        ${interd ? statusChip(`${interd} cut`, "#ff7a7a") : ""}
        ${reliefArrived ? `<span style="font-size:0.66rem;padding:1px 5px;border:1px solid #88bbff;border-radius:8px;color:#cfe2ff;background:#101a2a;box-shadow:0 0 8px rgba(136,187,255,0.5);font-weight:600;">relief here ×${reliefArrived}</span>` : (reliefPending ? statusChip(`relief ×${reliefPending}`, "#88bbff") : "")}
        ${atk ? `<span style="font-size:0.66rem;color:#888;">vs ${esc(atk.name)}</span>` : ""}
      </div>
      <div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:4px;">${_layersStrip(s)}</div>
      ${_champStrip(s)}
      ${_beatsFooter(s)}
      ${gmBtns}
    </div>`;
  }

  function _buildHtml(sieges, isGM) {
    const rows = sieges.map(e => _siegeRow(e, isGM)).join("");
    return `<div id="ft-siege-hud" style="position:fixed;right:12px;top:60px;z-index:120;width:288px;padding:.5rem .7rem;background:rgba(22,19,12,0.93);color:#e8e2d4;border:1px solid ${BRONZE};border-radius:6px;font-family:'Signika',sans-serif;font-size:0.82rem;box-shadow:0 0 16px rgba(217,164,65,0.22),0 4px 12px rgba(0,0,0,0.5);backdrop-filter:blur(2px);pointer-events:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
        <span style="color:${BRONZE};font-weight:600;letter-spacing:.04em;">⚔ Sieges</span>
        <span style="font-size:0.7rem;color:#999;">${sieges.length} active</span>
      </div>
      ${rows}
    </div>`;
  }

  // ─── Convene Breach Scene ─────────────────────────────────────────────────

  async function convene(hexUuid) {
    const api = _siegeApi();
    if (!api) return ui.notifications?.warn?.("Siege API not available.");
    const state = await api.getState(hexUuid);
    if (!state) return ui.notifications?.warn?.("No active siege on that hex.");

    const idx = state.currentLayerIdx ?? 0;
    const layer = (state.layers || [])[idx] || null;
    const sceneId = layer?.sceneId || null;

    // 1. Scene swap (if the current layer has a bound scene).
    if (sceneId) {
      const scene = game.scenes?.get?.(sceneId);
      if (scene) {
        try { await scene.view(); } catch (e) { console.warn(TAG, "scene.view failed", e); }
        // Broadcast so non-GM clients follow the GM to the breach scene.
        try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeSceneSwap", sceneId }); } catch (_e) {}
      } else {
        ui.notifications?.warn?.(`Layer scene ${sceneId} not found — opening console without scene swap.`);
      }
    } else {
      ui.notifications?.info?.("Current layer has no bound scene (set one in the planner layer editor). Opening raid console only.");
    }

    // 2. Open the raid console with siege context.
    try {
      await game.bbttcc?.api?.raid?.openConsole?.({ factionId: state.attackerFactionId, siegeId: state.siegeId, layerIdx: idx });
    } catch (e) { console.warn(TAG, "openConsole failed", e); }

    // 3. Narrative beat + hook + relay. Clear the auto-suggest pip — the GM acted on it.
    try {
      state._suggestConvene = false;
      api.appendNarrativeBeat(state, {
        turn: game.bbttcc?.api?.world?.getState?.()?.turn ?? null,
        kind: "convene",
        title: `Breach Scene convened — layer ${idx + 1}`,
        description: `GM convened the tactical breach on ${layer ? (game.actors?.get?.(layer.structureActorId)?.name || layer.layerId) : "current layer"}.`
      });
      await api.setState(hexUuid, state);
    } catch (e) { console.warn(TAG, "narrativeBeat persist failed", e); }

    const payload = { siegeId: state.siegeId, hexUuid, layerIdx: idx, sceneId };
    Hooks.callAll("bbttcc:siege:convene", payload);
    try { game.socket?.emit?.(`module.${MOD_R}`, { t: "siegeHook", hook: "bbttcc:siege:convene", payload }); } catch (_e) {}

    _scheduleRender();
  }

  // ─── Render plumbing ──────────────────────────────────────────────────────

  function _bind(el) {
    if (!el || !game.user?.isGM) return;
    el.querySelectorAll('button[data-act="convene"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        if (hex) convene(hex).catch(e => { console.error(TAG, "convene failed", e); ui.notifications?.error?.("Convene failed — see console."); });
      });
    });
    el.querySelectorAll('button[data-act="duel"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        const fn = game.bbttcc?.api?.siege?.openChampionDuelDialog;
        if (typeof fn === "function") fn({ hexUuid: hex });
        else ui.notifications?.warn?.("Champion Duel not available (siege-champion-duel.js not loaded?).");
      });
    });
    el.querySelectorAll('button[data-act="relieve"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        const fn = game.bbttcc?.api?.siege?.conveneRelief;
        if (typeof fn === "function") fn({ hexUuid: hex }).catch(e => { console.error(TAG, "conveneRelief failed", e); ui.notifications?.error?.("Convene Relief failed — see console."); });
        else ui.notifications?.warn?.("Relief Scene not available (siege-relief.js not loaded?).");
      });
    });
    el.querySelectorAll('button[data-act="trojan"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        const fn = game.bbttcc?.api?.siege?.openTrojanHorseDialog;
        if (typeof fn === "function") fn({ hexUuid: hex });
        else ui.notifications?.warn?.("Trojan Horse not available (siege-trojan-horse.js not loaded?).");
      });
    });
  }

  function _teardown() {
    if (_el) { try { _el.remove(); } catch (_) {} _el = null; }
  }

  function _renderAll() {
    const sieges = _activeSieges();
    if (!sieges.length) return _teardown();
    const isGM = !!game.user?.isGM;
    const html = _buildHtml(sieges, isGM);

    const tpl = document.createElement("div");
    tpl.innerHTML = html;
    const fresh = tpl.firstElementChild;
    if (!_el || !document.body.contains(_el)) {
      _el = fresh;
      document.body.appendChild(_el);
    } else {
      _el.innerHTML = fresh.innerHTML;
    }
    _bind(_el);
    const drag = globalThis._ftMakeHudDraggable;
    if (typeof drag === "function") drag(_el, { storageKey: "siege:hud:panel", collapsedLabel: "⚔ Sieges" });
  }

  function _scheduleRender() {
    if (_renderTimer) clearTimeout(_renderTimer);
    _renderTimer = setTimeout(() => { _renderTimer = null; try { _renderAll(); } catch (e) { console.warn(TAG, "render failed", e); } }, 60);
  }

  // ─── Hooks ────────────────────────────────────────────────────────────────
  Hooks.on("canvasReady", _scheduleRender);
  Hooks.on("canvasTearDown", _teardown);
  Hooks.on("bbttcc:siege:begin", _scheduleRender);
  Hooks.on("bbttcc:siege:ticked", _scheduleRender);
  Hooks.on("bbttcc:siege:convene", _scheduleRender);
  Hooks.on("bbttcc:siege:interdicted", _scheduleRender);
  Hooks.on("bbttcc:siege:counterInterdicted", _scheduleRender);
  Hooks.on("bbttcc:siege:sortie", _scheduleRender);
  Hooks.on("bbttcc:siege:layerBreached", _scheduleRender);
  Hooks.on("bbttcc:siege:championDuel", _scheduleRender);
  Hooks.on("bbttcc:siege:championStatus", _scheduleRender);
  Hooks.on("bbttcc:siege:championDeath", _scheduleRender);
  Hooks.on("bbttcc:siege:cascade", _scheduleRender);
  Hooks.on("bbttcc:siege:event", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefCalled", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefArrives", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefConvene", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefRepulsed", _scheduleRender);
  Hooks.on("bbttcc:siege:trojanHorse", _scheduleRender);
  Hooks.on("bbttcc:siege:trojanFailed", _scheduleRender);
  Hooks.on("bbttcc:siege:outcome", _scheduleRender);

  function _install() {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.convene = convene;
    game.bbttcc.api.siege.refreshHud = _scheduleRender;
  }
  Hooks.once("ready", () => { _install(); _scheduleRender(); console.log(TAG, "Siege HUD loaded (D.1)."); });
  if (game?.ready) { _install(); _scheduleRender(); }
})();
