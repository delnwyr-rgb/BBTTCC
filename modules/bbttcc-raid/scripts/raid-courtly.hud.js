// modules/bbttcc-raid/scripts/raid-courtly.hud.js
//
// Bad Eden — Courtly Intrigue Phase B HUD
// Spec: bbttcc-raid/COURTLY_INTRIGUE_SPEC.md §3.4 (Holographic UI panels)
// Substrate: bbttcc-raid/TABLEAU_SUBSTRATE.md
//
// Three floating, dragabble, on-canvas panels bound to the active raid
// console's __courtlyScenario:
//   1. Influence + Suspicion (top-left, cyan)
//   2. Courtier Roster        (right edge, cyan)
//   3. Secrets & Leverage     (bottom-left, violet, holder-only in Phase B)
//
// Activation gate (all three required):
//   * An open raid console has __courtlyScenario instantiated
//   * The active scene has flags.bbttcc-raid.tableau.enabled === true
//
// Phase B reads suspicion/courtBonus/secrets defensively (?? 0 / empty) so
// Phase C drops real data in with no HUD churn. Opposing-faction Secrets
// view is deferred to Phase C per locked decision 2026-05-21.

(() => {
  const MOD_R = "bbttcc-raid";
  const MODF  = "bbttcc-factions";
  const TAG   = "[bbttcc-raid/courtly-hud]";

  // CYAN is centralized: the Influence + Roster panels carry .ft-hud-acc-cyan,
  // which sets --ft-hud-accent (fallback keeps the old colour if the shared
  // stylesheet fails to load). VIOLET stays a literal — it's also painted onto
  // the cyan Influence panel as a secret-drop hint (see drag outline below), so
  // it can't ride the panel's accent variable.
  const CYAN   = "var(--ft-hud-accent, #5ce1e6)";
  const VIOLET = "#a78bfa";
  const ATK_COLOR = "#ffb15a";
  const DEF_COLOR = "#5cb8ff";

  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

  // ─── State ────────────────────────────────────────────────────────────────
  let _infEl = null, _rosEl = null, _secEl = null;
  let _renderTimer = null;
  // Phase F polish — cached values for change-detection / value-flash.
  let _lastInfA = null, _lastInfD = null, _lastSusp = null;

  // ─── Console / scenario discovery ─────────────────────────────────────────
  function _ftActiveCourtlyConsole() {
    const set = globalThis.__bbttccRaidOpenConsoles;
    if (!set?.size) return null;
    for (const app of set) {
      if (!app?.rendered) continue;
      if (app.__courtlyScenario && typeof app.__courtlyScenario.getState === "function") return app;
    }
    return null;
  }

  function _courtlyMaxFromRow(app) {
    const rounds = Array.isArray(app?.vm?.rounds) ? app.vm.rounds : [];
    for (let i = rounds.length - 1; i >= 0; i--) {
      const m = rounds[i]?.meta?.scenario;
      if (m && m.kind === "courtly") {
        return { maxA: Number(m.maxA || 0), maxD: Number(m.maxD || 0) };
      }
    }
    return { maxA: 0, maxD: 0 };
  }

  function _isTableauEnabled() {
    return canvas?.scene?.flags?.[MOD_R]?.tableau?.enabled === true;
  }

  function _viewerCtx(state) {
    if (game.user?.isGM) return "gm";
    const fid = game.user?.character?.flags?.[MODF]?.factionId
            ?? game.user?.character?.flags?.[MOD_R]?.factionId
            ?? null;
    if (!fid) return null;
    if (fid === state?.attackerId) return "attacker";
    if (fid === state?.defenderId) return "defender";
    return null;
  }

  // ─── HTML builders ────────────────────────────────────────────────────────
  function _bar(label, color, value, max, extra = "") {
    const pct = max > 0 ? Math.round(100 * clamp(value, 0, max) / max) : 0;
    return `
      <div style="display:flex;flex-direction:column;gap:2px;min-width:0;">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#ccc;">
          <span style="color:${color};font-weight:600;">${esc(label)}</span>
          <span>${value}${max > 0 ? `/${max}` : ""} ${extra}</span>
        </div>
        <div style="position:relative;height:8px;background:#1a1a22;border:1px solid #333;border-radius:3px;overflow:hidden;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${color};box-shadow:0 0 6px ${color};"></div>
        </div>
      </div>`;
  }

  function _buildInfluenceHtml(app, state) {
    const { maxA, maxD } = _courtlyMaxFromRow(app);
    const A = game.actors.get(state.attackerId);
    const D = game.actors.get(state.defenderId);
    const atkName = A?.name || "Attacker";
    const defName = D?.name || "Defender";
    const suspicion = clamp(state.suspicion ?? 0, 0, 10);
    const cbA = Number(state.courtBonusA ?? 0);
    const cbD = Number(state.courtBonusD ?? 0);
    const round = Number(state.round || 0);
    const outcome = String(state.outcome || "ongoing");

    const susColor = suspicion >= 8 ? "#ff5555" : suspicion >= 5 ? "#ffaa55" : "#88cc55";
    const scandalA = state.scandalOnA ? `<span title="Scandal: −2 next exchange" style="color:#ff7a7a;">⚠</span>` : "";
    const scandalD = state.scandalOnD ? `<span title="Scandal: −2 next exchange" style="color:#ff7a7a;">⚠</span>` : "";
    const cbChip = (n, color, side) => n === 0 ? "" :
      `<span title="Court Bonus" style="font-size:0.7rem;padding:1px 5px;border:1px solid ${color};border-radius:8px;color:${color};">★ ${side} ${n > 0 ? "+" : ""}${n}</span>`;
    const outChip = outcome === "ongoing" ? "" :
      `<span style="font-size:0.7rem;padding:1px 6px;background:#3a2a1a;color:#ffd28a;border:1px solid #ffd28a;border-radius:3px;">${esc(outcome.toUpperCase())}</span>`;

    return `<div id="ft-courtly-influence" class="ft-hud-panel ft-hud-acc-cyan" style="position:fixed;left:12px;top:60px;width:300px;padding:.5rem .7rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
        <span style="color:${CYAN};font-weight:600;letter-spacing:.04em;">⚜ Courtly Intrigue</span>
        <span style="font-size:0.72rem;color:#999;">Round ${round}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem;">
        ${_bar(`${atkName} ${scandalA}`, ATK_COLOR, state.influenceA ?? 0, maxA)}
        ${_bar(`${defName} ${scandalD}`, DEF_COLOR, state.influenceD ?? 0, maxD)}
      </div>
      <div style="margin-top:.45rem;display:flex;flex-direction:column;gap:2px;">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#ccc;">
          <span style="color:${susColor};font-weight:600;">Suspicion</span>
          <span>${suspicion}/10</span>
        </div>
        <div style="position:relative;height:8px;background:#1a1a22;border:1px solid #333;border-radius:3px;overflow:hidden;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${suspicion * 10}%;background:${susColor};box-shadow:0 0 6px ${susColor};"></div>
        </div>
      </div>
      <div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:4px;">
        ${cbChip(cbA, ATK_COLOR, "atk")}
        ${cbChip(cbD, DEF_COLOR, "def")}
        ${outChip}
      </div>
    </div>`;
  }

  function _tableauTokens() {
    if (!canvas?.tokens?.placeables) return [];
    return canvas.tokens.placeables.filter(t => t.document?.flags?.[MOD_R]?.tableauActor === true);
  }

  function _favorOf(actor, factionId) {
    if (!actor || !factionId) return 0;
    return Number(actor.flags?.[MOD_R]?.courtFavor?.[factionId] ?? 0);
  }

  function _buildRosterHtml(app, state) {
    const tokens = _tableauTokens();
    const A = game.actors.get(state.attackerId);
    const D = game.actors.get(state.defenderId);

    const rowsHtml = tokens.length === 0
      ? `<div style="padding:.5rem;color:#888;font-style:italic;font-size:0.78rem;text-align:center;">No courtiers flagged on this scene.<br/><span style="font-size:0.7rem;">Mark tokens via the Tableau tuner.</span></div>`
      : tokens.map(t => {
          const a = t.actor;
          const img = a?.img || t.document?.texture?.src || "icons/svg/mystery-man.svg";
          const favA = _favorOf(a, state.attackerId);
          const favD = _favorOf(a, state.defenderId);
          const pill = (n, color) => {
            const sign = n > 0 ? "+" : "";
            const bg = n === 0 ? "transparent" : (n > 0 ? `${color}33` : "#5a1f1f55");
            return `<span class="ft-courtly-favor-pill" data-actor-id="${esc(a?.id || "")}" data-side="${color === ATK_COLOR ? "attacker" : "defender"}" title="Favor — click to adjust (GM)" style="font-size:0.7rem;padding:1px 6px;border:1px solid ${color};color:${color};background:${bg};border-radius:8px;cursor:${game.user?.isGM ? "pointer" : "default"};min-width:24px;text-align:center;">${sign}${n}</span>`;
          };
          return `<div class="ft-courtly-roster-row" data-token-id="${esc(t.id)}" style="display:flex;align-items:center;gap:.4rem;padding:.25rem .35rem;border-radius:4px;cursor:pointer;border:1px solid transparent;">
            <img src="${esc(img)}" style="width:32px;height:32px;object-fit:cover;border-radius:3px;border:1px solid #444;flex:0 0 auto;"/>
            <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8rem;">${esc(a?.name || t.name || "Courtier")}</div>
            <div style="display:flex;gap:3px;flex:0 0 auto;">${pill(favA, ATK_COLOR)}${pill(favD, DEF_COLOR)}</div>
          </div>`;
        }).join("");

    return `<div id="ft-courtly-roster" class="ft-hud-panel ft-hud-acc-cyan" style="position:fixed;right:12px;top:60px;width:280px;max-height:60vh;display:flex;flex-direction:column;padding:.5rem .55rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
        <span style="color:${CYAN};font-weight:600;letter-spacing:.04em;">⚜ Courtiers</span>
        <span style="font-size:0.7rem;color:#888;">${tokens.length}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:#888;padding:0 .35rem .2rem;">
        <span>portrait</span>
        <span><span style="color:${ATK_COLOR};">${esc((A?.name || "atk").slice(0, 10))}</span> / <span style="color:${DEF_COLOR};">${esc((D?.name || "def").slice(0, 10))}</span></span>
      </div>
      <div class="ft-courtly-roster-list" style="overflow-y:auto;display:flex;flex-direction:column;gap:2px;">
        ${rowsHtml}
      </div>
    </div>`;
  }

  function _buildSecretsHtml(app, state, viewerCtx) {
    const A = game.actors.get(state.attackerId);
    const D = game.actors.get(state.defenderId);
    const holders = viewerCtx === "gm" ? [
      { side: "atk", actor: A, color: ATK_COLOR },
      { side: "def", actor: D, color: DEF_COLOR }
    ] : viewerCtx === "attacker" ? [
      { side: "atk", actor: A, color: ATK_COLOR }
    ] : [
      { side: "def", actor: D, color: DEF_COLOR }
    ];

    const sectionHtml = holders.map(({ actor, color }) => {
      const secrets = (actor?.items?.contents || []).filter(i => i.flags?.[MOD_R]?.secret);
      const inner = secrets.length === 0
        ? `<div style="padding:.3rem;color:#888;font-style:italic;font-size:0.74rem;">No secrets held.<br/><span style="font-size:0.68rem;">Earn via Read the Room, Eavesdrop.</span></div>`
        : secrets.map(i => {
            // "template" lands on the actor when an item is dragged via a
            // path that bypasses addSecret (e.g. sidebar portrait drop).
            // Display + treat as earned — only "stolen" carries a real
            // mechanical consequence (suspicion +2 on play).
            const rawAcq = String(i.flags?.[MOD_R]?.secret?.acquisition || "earned");
            const acq = rawAcq === "template" ? "earned" : rawAcq;
            const acqColor = acq === "stolen" ? "#ff7a7a" : "#88cc55";
            return `<div class="ft-courtly-secret" data-item-id="${esc(i.id)}" data-actor-id="${esc(actor.id)}" draggable="true" title="${esc(i.name)} — drag onto Influence panel to play" style="display:flex;align-items:center;gap:.4rem;padding:.2rem .35rem;border:1px solid #444;border-radius:3px;cursor:grab;background:#15151c;">
              <img src="${esc(i.img || "icons/svg/book.svg")}" style="width:24px;height:24px;border-radius:2px;flex:0 0 auto;"/>
              <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.78rem;">${esc(i.name)}</div>
              <span style="font-size:0.66rem;color:${acqColor};border:1px solid ${acqColor};border-radius:6px;padding:0 5px;">${esc(acq)}</span>
            </div>`;
          }).join("");
      return `<div style="display:flex;flex-direction:column;gap:3px;">
        <div style="font-size:0.7rem;color:${color};font-weight:600;">${esc(actor?.name || "Faction")} <span style="color:#666;font-weight:normal;">(${secrets.length})</span></div>
        ${inner}
      </div>`;
    }).join('<div style="height:6px;"></div>');

    return `<div id="ft-courtly-secrets" class="ft-hud-panel ft-hud-acc-violet" style="position:fixed;left:12px;bottom:16px;width:300px;max-height:40vh;display:flex;flex-direction:column;padding:.5rem .55rem;">
      <div style="margin-bottom:.35rem;color:${VIOLET};font-weight:600;letter-spacing:.04em;">⚜ Secrets &amp; Leverage</div>
      <div style="overflow-y:auto;display:flex;flex-direction:column;gap:4px;">${sectionHtml}</div>
    </div>`;
  }

  // ─── Bind / panel render plumbing ─────────────────────────────────────────
  function _bindRoster(el, state) {
    el.querySelectorAll(".ft-courtly-roster-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".ft-courtly-favor-pill")) return;
        const tk = canvas.tokens?.get?.(row.dataset.tokenId);
        if (!tk) return;
        try { tk.control({ releaseOthers: true }); } catch (_) {}
        try { canvas.ping?.(tk.center); } catch (_) {}
      });
    });
    if (!game.user?.isGM) return;
    el.querySelectorAll(".ft-courtly-favor-pill").forEach(pill => {
      pill.addEventListener("click", async (e) => {
        e.stopPropagation();
        await _openFavorDialog(pill.dataset.actorId, pill.dataset.side, state);
      });
    });
  }

  // Phase C — drag-to-play: secret rows on Secrets panel are draggable;
  // drop target is the Influence panel. Effect handlers prompt for any
  // additional inputs (courtier picks etc.) via dialog inside the secrets API.
  function _bindSecrets(el) {
    el.querySelectorAll(".ft-courtly-secret").forEach(row => {
      row.addEventListener("dragstart", (e) => {
        try {
          const payload = JSON.stringify({
            actorId: row.dataset.actorId,
            itemId: row.dataset.itemId,
            kind: "courtly-secret"
          });
          e.dataTransfer.setData("text/plain", payload);
          e.dataTransfer.setData("application/bbttcc-courtly-secret", payload);
          e.dataTransfer.effectAllowed = "move";
          row.style.opacity = "0.5";
          // Highlight drop target while dragging
          if (_infEl) {
            _infEl.style.outline = `2px dashed ${VIOLET}`;
            _infEl.style.outlineOffset = "4px";
          }
        } catch (err) { console.warn(TAG, "dragstart failed", err); }
      });
      row.addEventListener("dragend", () => {
        row.style.opacity = "";
        if (_infEl) { _infEl.style.outline = ""; _infEl.style.outlineOffset = ""; }
      });
    });
  }

  function _bindInfluenceDropZone(el) {
    // Outer panel element persists across innerHTML re-renders, so guard
    // against stacking duplicate dragover/drop listeners on every render
    // tick (any bbttcc:courtly:state hook would otherwise add another).
    if (el.dataset.ftCourtlyDropBound === "1") return;
    el.dataset.ftCourtlyDropBound = "1";
    el.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types?.includes("application/bbttcc-courtly-secret")
       || e.dataTransfer?.types?.includes("text/plain")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    });
    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      let payload = null;
      try {
        const raw = e.dataTransfer.getData("application/bbttcc-courtly-secret")
                 || e.dataTransfer.getData("text/plain");
        payload = JSON.parse(raw || "{}");
      } catch (err) { return; }
      if (payload?.kind !== "courtly-secret" || !payload.actorId || !payload.itemId) return;
      const api = game.bbttcc?.api?.raid?.courtlySecrets;
      if (!api?.playSecret) { ui.notifications?.error?.("Courtly secrets API not loaded."); return; }
      try { await api.playSecret(payload.actorId, payload.itemId); }
      catch (err) { console.warn(TAG, "playSecret failed", err); ui.notifications?.error?.("Play failed — see console."); }
    });
  }

  async function _openFavorDialog(actorId, side, state) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const factionId = side === "attacker" ? state.attackerId : state.defenderId;
    const current = _favorOf(actor, factionId);
    const opts = [-3, -2, -1, 0, 1, 2, 3].map(n =>
      `<option value="${n}" ${n === current ? "selected" : ""}>${n > 0 ? "+" : ""}${n}</option>`
    ).join("");
    const factionName = game.actors.get(factionId)?.name || side;
    const next = await new Promise(resolve => {
      new Dialog({
        title: `Favor — ${actor.name}`,
        content: `<form>
          <p style="font-size:0.85rem;color:#aaa;">Favor with <b>${esc(factionName)}</b></p>
          <div class="form-group"><label>Set favor</label><select name="fav">${opts}</select></div>
        </form>`,
        buttons: {
          ok: { label: "Set", callback: html => resolve(Number(html[0].querySelector("[name=fav]").value)) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }, { width: 320 }).render(true);
    });
    if (next === null) return;
    const cur = foundry.utils.duplicate(actor.flags?.[MOD_R]?.courtFavor || {});
    cur[factionId] = next;
    await actor.update({ [`flags.${MOD_R}.courtFavor`]: cur });
  }

  function _swapPanel(slotRef, html, bindFn, storageKey, collapsedLabel) {
    const tpl = document.createElement("div");
    tpl.innerHTML = html;
    const fresh = tpl.firstElementChild;
    if (!slotRef.el || !document.body.contains(slotRef.el)) {
      slotRef.el = fresh;
      document.body.appendChild(slotRef.el);
    } else {
      slotRef.el.innerHTML = fresh.innerHTML;
      slotRef.el.style.borderColor = fresh.style.borderColor;
    }
    if (bindFn) bindFn(slotRef.el);
    const drag = globalThis._ftMakeHudDraggable;
    if (typeof drag === "function") drag(slotRef.el, { storageKey, collapsedLabel });
  }

  function _teardownAll() {
    if (_infEl) { try { _infEl.remove(); } catch (_) {} _infEl = null; }
    if (_rosEl) { try { _rosEl.remove(); } catch (_) {} _rosEl = null; }
    if (_secEl) { try { _secEl.remove(); } catch (_) {} _secEl = null; }
    _lastInfA = _lastInfD = _lastSusp = null;
  }

  // Phase F polish — brief CSS flash on the Nth bar inside the Influence panel.
  // 0 = attacker bar, 1 = defender bar, 2 = suspicion bar. Class defined in
  // raid-courtly.vfx.js stylesheet.
  function _flashBar(panelEl, idx) {
    if (!panelEl) return;
    const fills = panelEl.querySelectorAll(":scope div[style*='position:absolute']");
    const fill = fills[idx];
    if (!fill) return;
    fill.classList.remove("ft-courtly-valueflash");
    void fill.offsetWidth;
    fill.classList.add("ft-courtly-valueflash");
    setTimeout(() => fill.classList.remove("ft-courtly-valueflash"), 520);
  }

  function _renderAll() {
    const app = _ftActiveCourtlyConsole();
    if (!app || !_isTableauEnabled()) return _teardownAll();
    let state;
    try { state = app.__courtlyScenario.getState(); }
    catch (e) { console.warn(TAG, "getState failed", e); return _teardownAll(); }
    if (!state) return _teardownAll();

    // Influence panel (also drop-zone for Phase C secret drag-to-play)
    const infSlot = { get el() { return _infEl; }, set el(v) { _infEl = v; } };
    _swapPanel(infSlot, _buildInfluenceHtml(app, state), _bindInfluenceDropZone, "courtly:hud:influence", "⚜ Court");
    // Phase F polish — value-change flash on bars when influence or suspicion shifts.
    try {
      const curA = Number(state.influenceA ?? 0);
      const curD = Number(state.influenceD ?? 0);
      const curS = Number(state.suspicion ?? 0);
      const bars = _infEl?.querySelectorAll(":scope > div > div > div") || [];
      if (_lastInfA !== null && curA !== _lastInfA) _flashBar(_infEl, 0);
      if (_lastInfD !== null && curD !== _lastInfD) _flashBar(_infEl, 1);
      if (_lastSusp !== null && curS !== _lastSusp) _flashBar(_infEl, 2);
      _lastInfA = curA; _lastInfD = curD; _lastSusp = curS;
    } catch (_) {}

    // Roster panel
    const rosSlot = { get el() { return _rosEl; }, set el(v) { _rosEl = v; } };
    _swapPanel(rosSlot, _buildRosterHtml(app, state), (el) => _bindRoster(el, state), "courtly:hud:roster", "⚜ Courtiers");

    // Secrets panel — Phase B: holder-only (gm sees both); Phase C: draggable
    const vc = _viewerCtx(state);
    if (vc) {
      const secSlot = { get el() { return _secEl; }, set el(v) { _secEl = v; } };
      _swapPanel(secSlot, _buildSecretsHtml(app, state, vc), _bindSecrets, "courtly:hud:secrets", "⚜ Secrets");
    } else if (_secEl) {
      try { _secEl.remove(); } catch (_) {}
      _secEl = null;
    }
  }

  function _scheduleRender() {
    if (_renderTimer) clearTimeout(_renderTimer);
    _renderTimer = setTimeout(() => { _renderTimer = null; try { _renderAll(); } catch (e) { console.warn(TAG, "render failed", e); } }, 60);
  }

  // ─── Hooks ────────────────────────────────────────────────────────────────
  Hooks.on("renderApplicationV2", _scheduleRender);
  Hooks.on("closeApplicationV2", _scheduleRender);
  Hooks.on("closeApplication", _scheduleRender);
  Hooks.on("canvasReady", _scheduleRender);
  Hooks.on("canvasTearDown", _teardownAll);
  Hooks.on("updateScene", (_s, changes) => {
    if (foundry.utils.getProperty(changes, `flags.${MOD_R}.tableau.enabled`) !== undefined) _scheduleRender();
  });
  Hooks.on("createToken", _scheduleRender);
  Hooks.on("deleteToken", _scheduleRender);
  Hooks.on("updateToken", (_doc, changes) => {
    if (foundry.utils.getProperty(changes, `flags.${MOD_R}.tableauActor`) !== undefined) _scheduleRender();
  });
  Hooks.on("updateActor", (_a, changes) => {
    if (foundry.utils.getProperty(changes, `flags.${MOD_R}.courtFavor`) !== undefined) _scheduleRender();
  });
  Hooks.on("bbttcc:courtly:state", _scheduleRender);

  Hooks.once("ready", () => {
    console.log(TAG, "Phase B HUD loaded (Influence + Roster + Secrets).");
    _scheduleRender();
  });
})();
