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

  // PLAYER SEATS (Dave 2026-10-17: "the GM screen has the presence raid info, but the
  // player's doesn't"). The scenario OBJECT lives only on the committing (GM) client;
  // every other client only ever sees the relayed `bbttcc:courtly:state` snapshot and
  // the `courtlyActive` mirror the engine persists on both faction actors. So: any
  // rendered console whose session holds a courtly round is a valid host, and the
  // state comes from (1) the freshest relayed snapshot for that pairing, else (2) the
  // persisted mirror's `state`. Same fallback rescues the GM after a reload.
  let _relayedState = null;
  Hooks.on("bbttcc:courtly:state", (payload) => {
    const st = payload?.state || null;
    if (st && st.attackerId) _relayedState = st;
  });
  function _ftAnyCourtlyConsole() {
    const set = globalThis.__bbttccRaidOpenConsoles;
    if (!set?.size) return null;
    for (const app of set) {
      if (!app?.rendered) continue;
      const rounds = Array.isArray(app?.vm?.rounds) ? app.vm.rounds : [];
      if (rounds.some(r => r?.meta?.scenario?.kind === "courtly")) return app;
    }
    return null;
  }
  function _mirrorStateFor(app) {
    const ids = [app?.__courtlyScenarioAtt, app?.vm?.attackerId, app?.vm?.__lockAttackerId, app?.vm?.defenderId]
      .map(x => String(x || "").replace(/^Actor\./, "")).filter(Boolean);
    let best = null;
    for (const a of game.actors?.contents ?? []) {
      const m = a.flags?.[MOD_R]?.courtlyActive;
      if (!m?.state) continue;
      if (ids.length && !ids.includes(String(m.attackerId)) && !ids.includes(String(m.defenderId))) continue;
      if (!best || Number(m.ts || 0) > Number(best.ts || 0)) best = m;
    }
    return best?.state || null;
  }
  function _fallbackState(app) {
    const mirror = _mirrorStateFor(app);
    const rel = _relayedState;
    if (rel && (!mirror || (rel.attackerId === mirror.attackerId && rel.defenderId === mirror.defenderId))) return rel;
    return mirror || rel || null;
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
  // A Parley runs on ANY scene (owner ruling 2026-10-22): the HUD shows wherever there are courtiers.
  function _isParleyStage() {
    return _isTableauEnabled() || _tableauTokens().length > 0;
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
    // Ruling 3: the goal is a chip; the Suspicion track shows only for Stay unnoticed (Impress shows its crowd track).
    const goalChip = state.goalLabel ? `<span title="Goal" style="font-size:0.7rem;padding:1px 6px;border:1px solid ${CYAN};border-radius:8px;color:${CYAN};">${esc(state.goalLabel)}</span>` : "";
    const showTrack = state.performance ? true : (state.suspicionEnabled !== false);
    const trackLabel = state.performance ? esc(state.trackLabel || "Crowd") : "Suspicion";
    const outChip = outcome === "ongoing" ? "" :
      `<span style="font-size:0.7rem;padding:1px 6px;background:#3a2a1a;color:#ffd28a;border:1px solid #ffd28a;border-radius:3px;">${esc(outcome.toUpperCase())}</span>`;
    // Concluded scenarios linger on the HUD (the record of how it ended)
    // until the next commit replaces them — make that state unmistakable
    // instead of looking like a live board (owner confusion 2026-07-14).
    const ended = outcome !== "ongoing";
    const endedNote = !ended ? "" :
      `<div style="margin-top:.35rem;font-size:0.68rem;color:#ffd28a;opacity:.85;font-style:italic;">Concluded — the next Parley exchange opens a fresh board.</div>`;

    return `<div id="ft-courtly-influence" class="ft-hud-panel ft-hud-acc-cyan" style="position:fixed;left:12px;top:60px;width:300px;padding:.5rem .7rem;${ended ? "opacity:.62;filter:saturate(.6);" : ""}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
        <span style="color:${CYAN};font-weight:600;letter-spacing:.04em;">⚜ Parley${ended ? " — ended" : ""}</span>
        <span style="font-size:0.72rem;color:#999;">Round ${round}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem;">
        ${_bar(`${atkName} ${scandalA}`, ATK_COLOR, state.influenceA ?? 0, maxA)}
        ${_bar(`${defName} ${scandalD}`, DEF_COLOR, state.influenceD ?? 0, maxD)}
      </div>
      ${showTrack ? `<div style="margin-top:.45rem;display:flex;flex-direction:column;gap:2px;">
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#ccc;">
          <span style="color:${susColor};font-weight:600;">${trackLabel}</span>
          <span>${suspicion}/10</span>
        </div>
        <div style="position:relative;height:8px;background:#1a1a22;border:1px solid #333;border-radius:3px;overflow:hidden;">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${suspicion * 10}%;background:${susColor};box-shadow:0 0 6px ${susColor};"></div>
        </div>
      </div>` : ""}
      <div style="margin-top:.4rem;display:flex;flex-wrap:wrap;gap:4px;">
        ${goalChip}
        ${cbChip(cbA, ATK_COLOR, "atk")}
        ${cbChip(cbD, DEF_COLOR, "def")}
        ${outChip}
      </div>
      ${endedNote}
    </div>`;
  }

  function _tableauTokens() {
    if (!canvas?.tokens?.placeables) return [];
    return game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? canvas.tokens.placeables.filter(t => t.document?.flags?.[MOD_R]?.tableauActor === true);   // courtiers on ANY scene (2026-10-22)
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
      // Ruling 4: only receipts from THIS Parley (or unstamped story receipts) show here — others belong to another table.
      const secrets = (actor?.items?.contents || []).filter(i => i.flags?.[MOD_R]?.secret).filter(i => { const pid = i.flags?.[MOD_R]?.secret?.parleyId; return !pid || pid === state.id; });
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
              <button type="button" class="ft-courtly-secret-play" draggable="false" title="Play this secret now" style="font-size:0.66rem;color:${VIOLET};border:1px solid ${VIOLET};background:#1a1426;border-radius:4px;padding:1px 8px;cursor:pointer;flex:0 0 auto;">Play</button>
            </div>`;
          }).join("");
      return `<div style="display:flex;flex-direction:column;gap:3px;">
        <div style="font-size:0.7rem;color:${color};font-weight:600;">${esc(actor?.name || "Faction")} <span style="color:#666;font-weight:normal;">(${secrets.length})</span></div>
        ${inner}
      </div>`;
    }).join('<div style="height:6px;"></div>');

    return `<div id="ft-courtly-secrets" class="ft-hud-panel ft-hud-acc-violet" style="position:fixed;left:12px;bottom:16px;width:300px;max-height:40vh;display:flex;flex-direction:column;padding:.5rem .55rem;">
      <div style="margin-bottom:.35rem;color:${VIOLET};font-weight:600;letter-spacing:.04em;">🧾 Receipts &amp; Leverage</div>
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
    // Phase C.2 — click-to-play: a discoverable button alongside drag-to-play.
    // Same path as the Influence drop zone (playSecret enforces scenario/side).
    el.querySelectorAll(".ft-courtly-secret-play").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const row = btn.closest(".ft-courtly-secret");
        const actorId = row?.dataset?.actorId;
        const itemId  = row?.dataset?.itemId;
        if (!actorId || !itemId) return;
        const api = game.bbttcc?.api?.raid?.courtlySecrets;
        if (!api?.playSecret) { ui.notifications?.error?.("Receipts API not loaded."); return; }
        btn.disabled = true;
        try { await api.playSecret(actorId, itemId); }
        catch (err) { console.warn(TAG, "playSecret(click) failed", err); ui.notifications?.error?.("Play failed — see console."); }
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
      if (!api?.playSecret) { ui.notifications?.error?.("Receipts API not loaded."); return; }
      try { await api.playSecret(payload.actorId, payload.itemId); }
      catch (err) { console.warn(TAG, "playSecret failed", err); ui.notifications?.error?.("Play failed — see console."); }
    });
  }

  async function _openFavorDialog(actorId, side, state) {
    // The courtier TOKEN's actor (unlinked courtiers carry their own delta) — where every favor reader looks (2026-10-28).
    const id = String(actorId || "").replace(/^(Actor|Token)\./, "");
    const toks = (game.bbttcc?.api?.raid?.tableau?.courtiers?.() ?? []);
    const actor = toks.find(t => t.id === id)?.actor || toks.find(t => t.actor?.id === id)?.actor || game.actors.get(id);
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

  // 2026-10-09 — ONE DOCK. The three panels (Influence, Courtiers, Receipts &
  // Leverage) used to float independently and landed on top of the tableau
  // characters. They now mount, stacked, inside a single draggable, collapsible
  // "⚜ Court" dock (left edge by default; position remembered).
  const DOCK_ID = "ft-courtly-dock";
  function _ensureDockStyle() {
    if (document.getElementById(DOCK_ID + "-style")) return;
    const st = document.createElement("style");
    st.id = DOCK_ID + "-style";
    st.textContent = `
      #${DOCK_ID}{position:fixed;left:12px;top:60px;width:310px;max-height:calc(100vh - 150px);overflow-y:auto;
        z-index:60;display:flex;flex-direction:column;gap:.4rem;padding:.35rem;border-radius:10px;
        background:rgba(8,12,18,.72);border:1px solid rgba(96,200,255,.35);box-shadow:0 4px 18px rgba(0,0,0,.45)}
      #${DOCK_ID} > .ft-courtly-dock-head{display:flex;align-items:center;gap:.4rem;cursor:move;user-select:none;
        font-size:.8rem;letter-spacing:.06em;color:#9fdcff;padding:.1rem .25rem}
      #${DOCK_ID} > .ft-courtly-dock-head button{margin-left:auto;padding:0 .45rem;font-size:.75rem;line-height:1.4}
      #${DOCK_ID}.collapsed > .ft-hud-panel{display:none!important}
      #${DOCK_ID} > .ft-hud-panel{position:static!important;left:auto!important;right:auto!important;top:auto!important;
        bottom:auto!important;width:auto!important;max-height:none!important;transform:none!important;margin:0!important}
      #${DOCK_ID} .ft-courtly-roster-list{max-height:30vh}
      /* 2026-10-30 (owner: "a very hard time moving the raid interface around so we could see the courtiers, the raid
         interface, and the courtier's meter") — STRIP: one slim band at the bottom centre, panels side by side, the
         courtiers as a row of chips. ⇄ in the header flips back to the side column. */
      #${DOCK_ID}.ft-court-strip{left:50%!important;top:auto!important;transform:translateX(-50%);width:min(1120px,calc(100vw - 340px));
        max-height:24vh;flex-direction:row;align-items:stretch;overflow:hidden;padding:.3rem .4rem;gap:.35rem}
      #${DOCK_ID}.ft-court-strip > .ft-courtly-dock-head{flex-direction:column;justify-content:flex-start;cursor:default;writing-mode:horizontal-tb;
        padding:.15rem .1rem;gap:.3rem;flex:0 0 auto}
      #${DOCK_ID}.ft-court-strip > .ft-courtly-dock-head button{margin-left:0}
      #${DOCK_ID}.ft-court-strip > .ft-hud-panel{flex:1 1 0;min-width:200px;max-height:calc(24vh - .6rem);overflow-y:auto;padding:.35rem .5rem!important}
      #${DOCK_ID}.ft-court-strip > #ft-courtly-roster{flex:1.6 1 0}
      #${DOCK_ID}.ft-court-strip .ft-courtly-roster-list{flex-direction:row!important;flex-wrap:wrap;max-height:none;gap:4px!important}
      #${DOCK_ID}.ft-court-strip .ft-courtly-roster-row{border:1px solid rgba(96,200,255,.22)!important;padding:.15rem .3rem!important;max-width:220px}
      #${DOCK_ID}.ft-court-strip .ft-courtly-roster-row img{width:24px!important;height:24px!important}
      #${DOCK_ID}.ft-court-strip #ft-courtly-roster > div:nth-child(2){display:none!important}
      #${DOCK_ID}.ft-court-strip.collapsed{width:auto}`;
    document.head.appendChild(st);
  }
  const _stripOn = () => { try { return localStorage.getItem("courtly:hud:dock:layout") !== "column"; } catch (_) { return true; } };
  /** Strip mode: sit just above whatever owns the bottom edge (combat dock, hotbar) — re-run on render and resize. */
  function _placeStrip(d = document.getElementById(DOCK_ID)) {
    if (!d || !d.classList.contains("ft-court-strip")) return;
    let top = window.innerHeight - 8;
    for (const id of ["bbttcc-conflict-bar", "bbttcc-combat-dock", "hotbar", "ft-crew-hud"]) {   // the player Conflict bar (10-30) sits below the strip
      const el = document.getElementById(id); if (!el || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect(); if (r.height > 0 && r.top > window.innerHeight * 0.5) top = Math.min(top, r.top);
    }
    d.style.bottom = Math.max(8, Math.round(window.innerHeight - top + 8)) + "px";
  }
  window.addEventListener("resize", () => _placeStrip());
  Hooks.once("ready", () => { try { const r = (game.bbttcc ??= { api: {} }).api.raid ??= {}; r.courtlyHud = Object.assign(r.courtlyHud || {}, { place: () => _placeStrip(), sync: () => _scheduleRender(), view: _courtView, ping: _pingCourtier }); } catch (_e) {} });
  function _dock() {
    let d = document.getElementById(DOCK_ID);
    if (d) return d;
    _ensureDockStyle();
    d = document.createElement("div");
    d.id = DOCK_ID;
    let collapsed = false;
    try { collapsed = localStorage.getItem("courtly:hud:dock:collapsed") === "1"; } catch (_) {}
    d.classList.toggle("collapsed", collapsed);
    d.classList.toggle("ft-court-strip", _stripOn());
    d.innerHTML = `<div class="ft-courtly-dock-head"><span>⚜ Court</span><button type="button" data-dock-layout title="Strip along the bottom ⇄ column on the left">⇄</button><button type="button" data-dock-toggle title="Collapse / expand">${collapsed ? "▸" : "▾"}</button></div>`;
    d.querySelector("[data-dock-layout]").addEventListener("click", (ev) => {
      ev.stopPropagation();
      const strip = !d.classList.contains("ft-court-strip");
      d.classList.toggle("ft-court-strip", strip);
      try { localStorage.setItem("courtly:hud:dock:layout", strip ? "strip" : "column"); } catch (_) {}
      if (strip) _placeStrip(d); else { d.style.bottom = ""; d.style.transform = ""; }
    });
    d.querySelector("[data-dock-toggle]").addEventListener("click", (ev) => {
      ev.stopPropagation();
      const c = !d.classList.contains("collapsed");
      d.classList.toggle("collapsed", c);
      ev.currentTarget.textContent = c ? "▸" : "▾";
      try { localStorage.setItem("courtly:hud:dock:collapsed", c ? "1" : "0"); } catch (_) {}
    });
    // Drag by the header; remember position.
    try {
      const pos = JSON.parse(localStorage.getItem("courtly:hud:dock:pos") || "null");
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) { d.style.left = pos.left + "px"; d.style.top = pos.top + "px"; }
    } catch (_) {}
    const head = d.querySelector(".ft-courtly-dock-head");
    head.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest("button")) return;
      if (d.classList.contains("ft-court-strip")) return;   // the strip is pinned above the bottom bars
      const r = d.getBoundingClientRect(); const ox = ev.clientX - r.left, oy = ev.clientY - r.top;
      const move = (e) => { d.style.left = Math.max(0, e.clientX - ox) + "px"; d.style.top = Math.max(0, e.clientY - oy) + "px"; };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
        try { localStorage.setItem("courtly:hud:dock:pos", JSON.stringify({ left: parseInt(d.style.left) || 12, top: parseInt(d.style.top) || 60 })); } catch (_) {} };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    });
    document.body.appendChild(d);
    return d;
  }

  function _swapPanel(slotRef, html, bindFn, storageKey, collapsedLabel) {
    const tpl = document.createElement("div");
    tpl.innerHTML = html;
    const fresh = tpl.firstElementChild;
    const dock = _dock();
    if (!slotRef.el || !document.body.contains(slotRef.el)) {
      slotRef.el = fresh;
      dock.appendChild(slotRef.el);
    } else {
      slotRef.el.innerHTML = fresh.innerHTML;
      slotRef.el.style.borderColor = fresh.style.borderColor;
      if (slotRef.el.parentElement !== dock) dock.appendChild(slotRef.el);
    }
    // Keep a stable order inside the dock: Influence, Courtiers, Receipts.
    for (const id of ["ft-courtly-influence", "ft-courtly-roster", "ft-courtly-secrets"]) {
      const el = document.getElementById(id); if (el && el.parentElement === dock) dock.appendChild(el);
    }
    if (bindFn) bindFn(slotRef.el);
    _placeStrip(dock);
    // Individual panels are no longer separately draggable — the dock is.
  }

  function _teardownAll() {
    if (_infEl) { try { _infEl.remove(); } catch (_) {} _infEl = null; }
    if (_rosEl) { try { _rosEl.remove(); } catch (_) {} _rosEl = null; }
    if (_secEl) { try { _secEl.remove(); } catch (_) {} _secEl = null; }
    try { document.getElementById(DOCK_ID)?.remove(); } catch (_) {}
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

  // 10-30 (owner: "add that info to the new bottom HUD proper") — the player Conflict bar draws the court itself, so
  // this module hands it a plain VIEW of the same state the panels render, and stands its own strip down while the
  // bar is up (the GM seat, with no bar, keeps the strip).
  const _barUp = () => !!document.getElementById("bbttcc-conflict-bar");
  function _courtView() {
    let app = _ftActiveCourtlyConsole(); let state = null;
    if (app) { try { state = app.__courtlyScenario.getState(); } catch (_e) { state = null; } }
    if (!state) { app = _ftAnyCourtlyConsole(); state = app ? _fallbackState(app) : null; }
    if (!app || !state || !_isParleyStage()) return null;
    const { maxA, maxD } = _courtlyMaxFromRow(app);
    const A = game.actors.get(state.attackerId), D = game.actors.get(state.defenderId);
    const vc = _viewerCtx(state);
    const holders = !vc ? [] : vc === "gm" ? [["att", A], ["def", D]] : vc === "attacker" ? [["att", A]] : [["def", D]];
    const receipts = holders.filter(([, a]) => a).map(([side, a]) => ({
      side, actorId: a.id, name: a.name,
      items: (a.items?.contents || []).filter(i => i.flags?.[MOD_R]?.secret).filter(i => { const pid = i.flags?.[MOD_R]?.secret?.parleyId; return !pid || pid === state.id; })
        .map(i => { const acq = String(i.flags?.[MOD_R]?.secret?.acquisition || "earned"); return { id: i.id, name: i.name, img: i.img, acq: acq === "template" ? "earned" : acq }; })
    }));
    return {
      round: Number(state.round || 0), outcome: String(state.outcome || "ongoing"), goal: String(state.goalLabel || ""),
      atk: { name: A?.name || "Attacker", val: Number(state.influenceA ?? 0), max: maxA, scandal: !!state.scandalOnA, bonus: Number(state.courtBonusA ?? 0) },
      def: { name: D?.name || "Defender", val: Number(state.influenceD ?? 0), max: maxD, scandal: !!state.scandalOnD, bonus: Number(state.courtBonusD ?? 0) },
      track: (state.performance || state.suspicionEnabled !== false) ? { label: state.performance ? String(state.trackLabel || "Crowd") : "Suspicion", val: clamp(state.suspicion ?? 0, 0, 10) } : null,
      courtiers: _tableauTokens().map(t => ({ tokenId: t.id, name: t.actor?.name || t.name || "Courtier", img: t.actor?.img || t.document?.texture?.src || "icons/svg/mystery-man.svg", favA: _favorOf(t.actor, state.attackerId), favD: _favorOf(t.actor, state.defenderId) })),
      receipts
    };
  }
  function _pingCourtier(tokenId) { const tk = canvas.tokens?.get?.(tokenId); if (!tk) return; try { canvas.ping?.(tk.center); } catch (_e) {} }

  function _renderAll() {
    if (_barUp()) { _teardownAll(); return; }   // the Conflict bar carries the court on this seat
    let app = _ftActiveCourtlyConsole();
    let state = null;
    if (app) {
      try { state = app.__courtlyScenario.getState(); }
      catch (e) { console.warn(TAG, "getState failed", e); state = null; }
    }
    if (!state) {
      // Player seat (or a reloaded GM): no scenario object here — use the relayed / mirrored state.
      app = _ftAnyCourtlyConsole();
      state = app ? _fallbackState(app) : null;
    }
    if (!app || !state || !_isParleyStage()) return _teardownAll();

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
    if (foundry.utils.getProperty(changes, `flags.${MOD_R}.courtlyActive`) !== undefined) _scheduleRender();
  });
  Hooks.on("bbttcc:courtly:state", _scheduleRender);

  Hooks.once("ready", () => {
    console.log(TAG, "Phase B HUD loaded (Influence + Roster + Secrets).");
    _scheduleRender();
  });
})();
