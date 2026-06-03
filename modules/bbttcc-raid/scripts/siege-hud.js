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
  // Buffer is stored in MARKS (1 OP = 10); display as OP to match the OP Bank.
  function _mToOP(m) { const v = (Number(m) || 0) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); }

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
    return `<div title="Named champions on each side — active · wounded ✚ · dead ☠ (NOT faction counts)" style="margin-top:.3rem;display:flex;justify-content:space-between;font-size:0.66rem;color:#bbb;">
        <span><span style="opacity:.6;">champions</span> atk ${fmt(A)}</span><span>def ${fmt(D)}</span></div>`;
  }

  // ─── HTML builders ──────────────────────────────────────────────────────────

  // Live garrison fill on a structure (crew relationship): summed unitStrength of crewing
  // tokens on the current scene / the structure's garrison capacity. null if uncrewable.
  function _garrisonReadout(structureActorId) {
    try {
      const crew = game.bbttcc?.api?.structures?.crew;
      const a = structureActorId && game.actors?.get?.(structureActorId);
      if (!crew || !a) return null;
      const cap = Number(crew.capacity?.(a)) || 0;
      if (cap <= 0) return null;
      const cr = crew.read?.(a) || { assigned: [] };
      let live = 0;
      for (const m of (cr.assigned || [])) {
        const t = canvas?.scene?.tokens?.get?.(m.tokenId);
        if (t) live += Math.max(0, Number(t.flags?.["bbttcc-raid"]?.unitStrength) || 0);
      }
      return { live, cap, frac: cap > 0 ? live / cap : 0 };
    } catch (_e) { return null; }
  }

  function _layersStrip(siege) {
    const layers = Array.isArray(siege.layers) ? siege.layers : [];
    if (!layers.length) return `<span style="color:#888;font-style:italic;">no layers</span>`;
    const structApi = game.bbttcc?.api?.structures;
    return layers.map((l, i) => {
      const cur = i === (siege.currentLayerIdx ?? 0);
      const actor = game.actors?.get?.(l.structureActorId);
      const name = actor?.name || l.layerId || `Layer ${i + 1}`;
      // Read the live STRUCTURE state — so a breach shows even if the siege layer flag lags (the
      // structure can hit "breached"/"razed" plate state before/independent of layer advance).
      const st = structApi?.readState?.(actor) || null;
      const stState = st?.state || (l.breached ? "breached" : "intact");
      const plates = st?.plates && st.plates.max ? st.plates : null;
      const razed = stState === "razed";
      const broken = !!l.breached || stState === "breached" || razed;
      let border = "#444", color = "#aaa", bg = "#1a1a22", weight = "", strike = "", mark = "";
      if (broken)            { border = "#6a3030"; color = "#ff7a7a"; bg = "#241416"; strike = "text-decoration:line-through;"; mark = razed ? " ☠" : " ✗"; weight = "font-weight:600;"; }
      else if (cur)          { border = BRONZE;    color = BRONZE;    bg = "#2a2310"; weight = "font-weight:600;box-shadow:0 0 6px rgba(217,164,65,0.4);"; mark = " ◄"; }
      else if (stState === "damaged") { border = "#6a5a30"; color = "#ffd27a"; bg = "#221c10"; }
      const cur2 = (cur && broken) ? " ◄" : "";   // keep the current marker even when breached
      const plateTxt = plates ? ` <span style="opacity:.7;font-size:.9em;">${plates.current}/${plates.max}</span>` : "";
      const g = _garrisonReadout(l.structureActorId);
      const gCol = g ? (g.frac > 0.6 ? "#9fe09f" : g.frac >= 0.25 ? "#ffd27a" : "#ff9a9a") : null;
      const gBadge = g ? ` <span title="garrison ${g.live}/${g.cap}" style="color:${gCol};font-size:0.92em;">🛡${g.live}</span>` : "";
      const style = `padding:1px 6px;border-radius:8px;font-size:0.68rem;border:1px solid ${border};color:${color};background:${bg};${weight}${strike}`;
      return `<span title="${esc(name)} — ${esc(stState)}${plates ? ` (${plates.current}/${plates.max})` : ""}${g ? ` · garrison ${g.live}/${g.cap}` : ""}" style="${style}">${esc(name)}${mark}${cur2}${plateTxt}${gBadge}</span>`;
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
    const supIds = Array.isArray(s.supportingFactionIds) ? s.supportingFactionIds : [];
    const supNames = supIds.map(id => game.actors?.get?.(id)?.name).filter(Boolean);
    const def = game.actors?.get?.(s.defenderFactionId);
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
    // Muster (§5 / Stage 2) — Form Up deploys both hosts as unit tokens on the battle scene;
    // Resolve the Clash simulates the engagement, depletes them, and reconciles the muster.
    const aMus = Number(s.attackerMuster);
    const dMus = Number(s.defenderMuster);
    const formedUp = (s.musterDeployments?.attacker?.tokenIds?.length || 0) > 0
                  && (s.musterDeployments?.defender?.tokenIds?.length || 0) > 0;
    const musRead = (Number.isFinite(aMus) || Number.isFinite(dMus))
      ? `<span style="font-size:0.66rem;color:#9a8;margin-left:auto;">host ⚔ ${Number.isFinite(aMus) ? aMus : "—"} · 🛡 ${Number.isFinite(dMus) ? dMus : "—"}</span>` : "";
    const musterBtns = isGM
      ? `<div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
          <button type="button" data-act="formup" data-hex="${esc(entry.hexUuid)}" title="Form Up — deploy both hosts as unit tokens (forced-perspective)" style="flex:1;padding:3px 6px;background:#102818;color:#8fd6a0;border:1px solid #3f8a55;border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;">⛺ Form Up</button>
          <button type="button" data-act="clash" data-hex="${esc(entry.hexUuid)}" title="${formedUp ? "Resolve the Clash — simulate the engagement, deplete the muster" : "Form Up both sides first"}" style="flex:1;padding:3px 6px;background:#2a1410;color:${formedUp ? "#ff9a7a" : "#7a5a4a"};border:1px solid ${formedUp ? "#b85a3a" : "#5a3a2a"};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;opacity:${formedUp ? "1" : "0.6"};">⚔ Resolve</button>
          <button type="button" data-act="recall" data-hex="${esc(entry.hexUuid)}" title="Recall the muster — remove all deployed contingents (both sides, incl. boarded garrison) from the scene" style="flex:0 0 auto;padding:3px 7px;background:#1a1a22;color:#bbb;border:1px solid #555;border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;">↩</button>
          ${musRead}
        </div>`
      : "";
    // Clash maneuvers (tactical tempo) — fire a siege maneuver IN THE MOMENT during a battle
    // instead of queuing it for Advance Turn. Cost model A: paid from the Buffer immediately,
    // so each is buffer-gated (dimmed when the siege can't afford it). Descriptor + invoker
    // come from siege-counter-activities (game.bbttcc.api.siege.clashManeuvers / fireManeuver).
    const clashMans = isGM ? (game.bbttcc?.api?.siege?.clashManeuvers || []) : [];
    const clashBtns = (isGM && clashMans.length)
      ? `<div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
          <span style="font-size:0.6rem;color:#c9a;letter-spacing:.05em;text-transform:uppercase;width:100%;opacity:.75;">Clash maneuvers · fire now</span>
          ${clashMans.map(m => {
            const afford = total >= (m.costTotal || 0);   // marks vs marks
            return `<button type="button" data-act="maneuver" data-key="${esc(m.key)}" data-hex="${esc(entry.hexUuid)}" title="${afford ? `Fire ${esc(m.label)} now — Buffer −${_mToOP(m.costTotal)} OP` : `Need ${_mToOP(m.costTotal)} OP (Buffer has ${_mToOP(total)})`}" style="flex:1;padding:3px 6px;background:#2a1810;color:${afford ? "#ffc69a" : "#7a5a4a"};border:1px solid ${afford ? "#b8763a" : "#5a4030"};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;opacity:${afford ? "1" : "0.55"};">${m.icon} ${esc(m.label)} <span style="opacity:.7;font-size:.85em;">−${_mToOP(m.costTotal)}</span></button>`;
          }).join("")}
        </div>`
      : "";
    const gmBtns = isGM
      ? `<div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:5px;">
          <button type="button" data-act="convene" data-hex="${esc(entry.hexUuid)}" style="flex:2;padding:3px 6px;background:#2a2310;color:${BRONZE};border:1px solid ${BRONZE};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;">⚔ Convene</button>
          <button type="button" data-act="duel" data-hex="${esc(entry.hexUuid)}" title="${canDuel ? "Issue a Champion Duel" : "Needs an active champion on both sides"}" style="flex:1;padding:3px 6px;background:#2a2310;color:${canDuel ? "#ff9a9a" : "#7a6a4a"};border:1px solid ${canDuel ? "#ff9a9a" : "#5a4a2a"};border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;opacity:${canDuel ? "1" : "0.55"};">Duel</button>
          ${reliefBtn}
          <button type="button" data-act="trojan" data-hex="${esc(entry.hexUuid)}" title="Trojan Horse (T4 Intrigue gambit)" style="flex:1;padding:3px 6px;background:#1a1530;color:#a78bfa;border:1px solid #6d5aa8;border-radius:4px;font-size:0.74rem;cursor:pointer;font-weight:600;">🐴 Trojan</button>
        </div>`
      : "";

    // Pending-offer prompt — appears when a Sue for Terms / Demand Surrender is on the
    // table (set by the counter-activities) and lets the deciding side resolve by click.
    const pt = (s.pendingTerms && !s.pendingTerms.resolved) ? s.pendingTerms : null;
    const offerBtns = (isGM && pt)
      ? (pt.type === "sue"
          ? `<div style="margin-top:.35rem;padding:4px 6px;background:rgba(40,30,10,0.6);border:1px solid #b8863a;border-radius:4px;">
              <div style="font-size:0.68rem;color:#f0d090;margin-bottom:3px;">⚖ Defender sues for terms — attacker decides:</div>
              <div style="display:flex;gap:5px;">
                <button type="button" data-act="terms-accept" data-hex="${esc(entry.hexUuid)}" title="Accept the negotiated surrender (won_sack)" style="flex:1;padding:3px 6px;background:#15300f;color:#9ae6a0;border:1px solid #4a8a4a;border-radius:4px;font-size:0.72rem;cursor:pointer;font-weight:600;">✔ Accept (Sack)</button>
                <button type="button" data-act="terms-refuse" data-hex="${esc(entry.hexUuid)}" title="Reject the offer — the siege grinds on" style="flex:1;padding:3px 6px;background:#301010;color:#e69a9a;border:1px solid #8a4a4a;border-radius:4px;font-size:0.72rem;cursor:pointer;font-weight:600;">✘ Refuse</button>
              </div>
            </div>`
          : `<div style="margin-top:.35rem;padding:4px 6px;background:rgba(40,30,10,0.6);border:1px solid #b8863a;border-radius:4px;">
              <div style="font-size:0.68rem;color:#f0d090;margin-bottom:3px;">🏳 Surrender demanded — defender responds:</div>
              <div style="display:flex;gap:5px;">
                <button type="button" data-act="surrender-yield" data-hex="${esc(entry.hexUuid)}" title="Yield the fortress (won_surrender; holdings preserved)" style="flex:1;padding:3px 6px;background:#15300f;color:#9ae6a0;border:1px solid #4a8a4a;border-radius:4px;font-size:0.7rem;cursor:pointer;font-weight:600;">🏳 Yield</button>
                <button type="button" data-act="surrender-parley" data-hex="${esc(entry.hexUuid)}" title="Parley — no surrender; besieger re-commits (+10 Buffer)" style="flex:1;padding:3px 6px;background:#101a2a;color:#88bbff;border:1px solid #4a6a8a;border-radius:4px;font-size:0.7rem;cursor:pointer;font-weight:600;">Parley</button>
                <button type="button" data-act="surrender-refuse" data-hex="${esc(entry.hexUuid)}" title="Defiance — refuse (−1 morale)" style="flex:1;padding:3px 6px;background:#301010;color:#e69a9a;border:1px solid #8a4a4a;border-radius:4px;font-size:0.7rem;cursor:pointer;font-weight:600;">✘ Refuse</button>
              </div>
            </div>`)
      : "";

    const statusChip = (label, color) => `<span style="font-size:0.66rem;padding:1px 5px;border:1px solid ${color};border-radius:8px;color:${color};">${esc(label)}</span>`;

    return `<div data-hex="${esc(entry.hexUuid)}" style="padding:.4rem .5rem;border:1px solid #3a3322;border-radius:5px;background:rgba(30,26,16,0.5);margin-bottom:.4rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <span style="font-weight:600;color:#f0e6d0;font-size:0.8rem;">${esc(entry.hexName || "Siege")}</span>
        <span style="display:flex;align-items:center;gap:5px;">${pip}<span style="font-size:0.66rem;color:#999;">${esc(s.sizeProfile || "standard")}</span></span>
      </div>
      <div style="margin:.1rem 0 .15rem;display:flex;justify-content:space-between;gap:8px;font-size:0.66rem;">
        <span title="Besieging coalition${supNames.length ? ` — supporters: ${esc(supNames.join(", "))}` : ""}" style="color:#ffc69a;">⚔ ${atk ? esc(atk.name) : "?"}${supIds.length ? ` <span style="opacity:.85;">+${supIds.length}</span>` : ""}</span>
        <span title="Besieged" style="color:#9fbfff;">🛡 ${def ? esc(def.name) : esc(entry.hexName || "?")}</span>
      </div>
      <div style="margin:.3rem 0 2px;display:flex;justify-content:space-between;font-size:0.7rem;color:#ccc;">
        <span style="color:${BRONZE};">Buffer</span>
        <span>${_mToOP(total)}${start > 0 ? `/${_mToOP(start)}` : ""} OP</span>
      </div>
      <div style="position:relative;height:7px;background:#1a1a22;border:1px solid #333;border-radius:3px;overflow:hidden;">
        <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:${bufColor};box-shadow:0 0 6px ${bufColor};transition:width .3s;"></div>
      </div>
      <div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
        ${statusChip(`supply: ${supply}${graceLeft != null ? ` · grace ${graceLeft}` : ""}`, sc)}
        ${interd ? statusChip(`${interd} cut`, "#ff7a7a") : ""}
        ${reliefArrived ? `<span style="font-size:0.66rem;padding:1px 5px;border:1px solid #88bbff;border-radius:8px;color:#cfe2ff;background:#101a2a;box-shadow:0 0 8px rgba(136,187,255,0.5);font-weight:600;">relief here ×${reliefArrived}</span>` : (reliefPending ? statusChip(`relief ×${reliefPending}`, "#88bbff") : "")}
      </div>
      <div style="margin-top:.35rem;display:flex;flex-wrap:wrap;gap:4px;">${_layersStrip(s)}</div>
      ${_champStrip(s)}
      ${_beatsFooter(s)}
      ${offerBtns}
      ${gmBtns}
      ${clashBtns}
      ${musterBtns}
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

  // ── Scene ↔ besieged-hex binding ─────────────────────────────────────────────
  // A tableau battle scene has no hexes, so any siege op that resolves "which hex/siege
  // am I on?" from the canvas fails there. Binding the scene to its besieged hex
  // (flags.bbttcc-raid.siegeHexUuid) lets that resolution succeed no matter what scene is
  // active. Auto-bound on convene; also settable via game.bbttcc.api.siege.bindScene.
  async function _bindSceneToHex(scene, hexUuid) {
    try { if (scene && hexUuid && scene.getFlag?.(MOD_R, "siegeHexUuid") !== hexUuid) await scene.setFlag(MOD_R, "siegeHexUuid", hexUuid); }
    catch (e) { console.warn(TAG, "bindSceneToHex failed", e); }
  }
  function _sceneHexUuid(scene) { try { return (scene || canvas?.scene)?.getFlag?.(MOD_R, "siegeHexUuid") || null; } catch { return null; } }
  async function bindScene(hexUuid, sceneId) {
    const scene = sceneId ? game.scenes?.get?.(sceneId) : canvas?.scene;
    if (!scene) return { ok: false, error: "no scene" };
    if (!hexUuid) return { ok: false, error: "no hexUuid" };
    await _bindSceneToHex(scene, hexUuid);
    ui.notifications?.info?.(`Bound "${scene.name}" to this siege.`);
    return { ok: true, sceneId: scene.id, hexUuid };
  }
  // One-call "bring everything onto the depth layer": flag the staged wall(s), any deployed
  // rigs/holdings, and the muster as tableauActor so they all forced-perspective scale + move.
  // Retro-fixes tokens staged before this wiring (e.g. an already-convened wall).
  async function tableauStageScene(sceneId) {
    const scene = sceneId ? game.scenes?.get?.(sceneId) : canvas?.scene;
    if (!scene) return { ok: false, error: "no scene" };
    const wallIds = new Set();
    try {
      for (const e of (_siegeApi()?.list?.() || [])) {
        for (const l of (e?.siege?.layers || [])) if (l?.structureActorId) wallIds.add(l.structureActorId);
      }
    } catch (_e) {}
    const updates = [];
    for (const t of (scene.tokens?.contents || [])) {
      const f = t?.flags?.[MOD_R] || {};
      const tf = t?.flags?.["bbttcc-territory"] || {};
      const isSiegeTok = !!(f.musterDeployment || tf.holdingDeployment || (t.actorId && wallIds.has(t.actorId)));
      if (isSiegeTok && f.tableauActor !== true) updates.push({ _id: t.id, [`flags.${MOD_R}.tableauActor`]: true });
    }
    if (updates.length) { try { await scene.updateEmbeddedDocuments("Token", updates); } catch (e) { return { ok: false, error: e.message }; } }
    try { game.bbttcc?.api?.raid?.tableau?.applyAll?.(); } catch (_e) {}
    ui.notifications?.info?.(`Tableau-staged ${updates.length} siege token(s) (walls / rigs / muster).`);
    return { ok: true, staged: updates.length };
  }

  // Resolve the besieged hex for the current context: bound scene flag → the sole active
  // siege → null. Siege commands can use this to work on a hexless battle scene.
  function resolveActiveHexUuid(scene) {
    const bound = _sceneHexUuid(scene); if (bound) return bound;
    try {
      // listActiveSieges() entries are { hexUuid, hexName, sceneId, siege } and ALREADY filtered
      // to active — so any entry qualifies; pick when it's unambiguous (exactly one).
      const list = _siegeApi()?.list?.() || [];
      const arr = Array.isArray(list) ? list : [];
      return (arr.length === 1) ? (arr[0].hexUuid || null) : null;
    } catch (_e) { return null; }
  }

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

    // 1.5 Auto-stage: ensure the current layer's wall has a token on the viewed scene,
    //     so the breach can actually be fought (strikes / Catastrophic Entry hit the
    //     Structure actor → Plates → razed → layer advances). Works whether or not the
    //     layer has a bound scene (we deploy onto whatever scene is now active).
    try {
      const wall = layer ? game.actors.get(layer.structureActorId) : null;
      const scene = canvas?.scene;
      if (wall && scene && !scene.tokens.some(t => t.actorId === wall.id)) {
        let tx = (scene.width || 2000) / 2, ty = (scene.height || 2000) / 2;
        try {
          const ref = await fromUuid(hexUuid);
          const hx = ref?.x ?? ref?.document?.x, hy = ref?.y ?? ref?.document?.y;
          if (Number.isFinite(hx) && Number.isFinite(hy)) { tx = hx; ty = hy; }
        } catch (_e) {}
        const td = await wall.getTokenDocument({ x: Math.round(tx), y: Math.round(ty), disposition: -1, actorLink: true, displayName: 30 });
        const tdObj = td.toObject();
        // Join the forced-perspective layer so the wall depth-scales with the muster + rigs.
        tdObj.flags = tdObj.flags || {};
        tdObj.flags[MOD_R] = Object.assign({}, tdObj.flags[MOD_R] || {}, { tableauActor: true });
        await scene.createEmbeddedDocuments("Token", [tdObj]);
        const pl = game.bbttcc?.api?.structures?.readState?.(wall)?.plates;
        ui.notifications?.info?.(`Breach staged: ${wall.name} deployed (Plates ${pl ? `${pl.current}/${pl.max}` : "?"}). Attack it — or use Catastrophic Entry — to breach.`);
      }
    } catch (e) { console.warn(TAG, "auto-stage wall token failed", e); }

    // 1.6 Bind the now-active battle scene to this besieged hex, so siege commands resolve
    //     the right siege even though the diorama scene has no hexes (see resolveActiveHexUuid).
    try { await _bindSceneToHex(canvas?.scene, hexUuid); } catch (_e) {}

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
    // Muster (Stage 2) — Form Up both hosts / Resolve the Clash.
    el.querySelectorAll('button[data-act="formup"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        const fn = game.bbttcc?.api?.siege?.formUpBoth;
        if (typeof fn === "function") fn({ hexUuid: hex }).catch(e => { console.error(TAG, "formUp failed", e); ui.notifications?.error?.("Form Up failed — see console."); });
        else ui.notifications?.warn?.("Form Up not available (siege-muster.js not loaded?).");
      });
    });
    el.querySelectorAll('button[data-act="clash"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        const fn = game.bbttcc?.api?.siege?.resolveClash;
        if (typeof fn !== "function") return ui.notifications?.warn?.("Resolve the Clash not available (siege-muster.js not loaded?).");
        fn({ hexUuid: hex }).then(r => { if (r && r.ok === false) ui.notifications?.warn?.(r.error || "Clash could not resolve."); })
          .catch(e => { console.error(TAG, "resolveClash failed", e); ui.notifications?.error?.("Resolve the Clash failed — see console."); });
      });
    });
    // Recall the muster — clear both sides (incl. hidden boarded garrison) off the scene.
    el.querySelectorAll('button[data-act="recall"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex;
        const fn = game.bbttcc?.api?.siege?.recallMuster;
        if (typeof fn !== "function") return ui.notifications?.warn?.("Recall not available (siege-muster.js not loaded?).");
        fn({ hexUuid: hex }).then(r => { if (r && r.ok === false) ui.notifications?.warn?.(r.error || "Recall failed."); })
          .catch(e => { console.error(TAG, "recallMuster failed", e); ui.notifications?.error?.("Recall failed — see console."); });
      });
    });
    // Clash maneuvers — fire a siege maneuver in the moment (tactical tempo).
    el.querySelectorAll('button[data-act="maneuver"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex, key = btn.dataset.key;
        const fn = game.bbttcc?.api?.siege?.fireManeuver;
        if (typeof fn !== "function") return ui.notifications?.warn?.("Clash maneuvers not available (siege-counter-activities.js not loaded?).");
        fn(key, { hexUuid: hex }).then(r => { if (r && r.ok === false) ui.notifications?.warn?.(r.reason || "Maneuver could not fire."); })
          .catch(e => { console.error(TAG, "fireManeuver failed", e); ui.notifications?.error?.("Maneuver failed — see console."); });
      });
    });
    // Pending-offer resolution (Sue for Terms / Demand Surrender) — resolve by click.
    const _resolveOffer = (act, hex) => {
      const api = game.bbttcc?.api?.siege;
      switch (act) {
        case "terms-accept":     return api?.resolveTerms?.(hex, { accept: true });
        case "terms-refuse":     return api?.resolveTerms?.(hex, { accept: false });
        case "surrender-yield":  return api?.resolveSurrender?.(hex, { response: "yield" });
        case "surrender-parley": return api?.resolveSurrender?.(hex, { response: "parley" });
        case "surrender-refuse": return api?.resolveSurrender?.(hex, { response: "refuse" });
        default: return undefined;
      }
    };
    el.querySelectorAll('button[data-act^="terms-"], button[data-act^="surrender-"]').forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const hex = btn.dataset.hex; const act = btn.dataset.act;
        const p = _resolveOffer(act, hex);
        if (p && typeof p.catch === "function") p.catch(e => { console.error(TAG, `${act} failed`, e); ui.notifications?.error?.(`${act} failed — see console.`); });
        else if (p === undefined) ui.notifications?.warn?.("Offer resolver not available (siege-counter-activities.js not loaded?).");
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
  Hooks.on("bbttcc:siege:termsOffered", _scheduleRender);
  Hooks.on("bbttcc:siege:surrenderDemanded", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefCalled", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefArrives", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefConvene", _scheduleRender);
  Hooks.on("bbttcc:siege:reliefRepulsed", _scheduleRender);
  Hooks.on("bbttcc:siege:trojanHorse", _scheduleRender);
  Hooks.on("bbttcc:siege:trojanFailed", _scheduleRender);
  Hooks.on("bbttcc:siege:clash", _scheduleRender);
  Hooks.on("bbttcc:siege:outcome", _scheduleRender);

  // PLAYER-SIDE refresh: the bbttcc:siege:* hooks above fire only locally on the GM
  // (no socket relay listener exists). Siege state lives in hex-drawing flags, so a
  // GM mutation broadcasts an updateDrawing to every client — players included. React
  // to changes on territory hexes so non-GM HUDs update live (declare / tick / resolve).
  const _onHexDocChange = (doc) => {
    try {
      const tf = doc?.flags?.["bbttcc-territory"];
      if (tf && (tf.isHex || tf.siege !== undefined)) _scheduleRender();
    } catch (_e) {}
  };
  Hooks.on("updateDrawing", _onHexDocChange);
  Hooks.on("createDrawing", _onHexDocChange);
  Hooks.on("deleteDrawing", _onHexDocChange);

  // Garrison readout: re-render when a muster contingent's strength/position changes or a
  // structure's crew roster changes, so the per-layer 🛡 fill stays live.
  Hooks.on("updateToken", (doc, changes) => {
    try { if (doc?.flags?.["bbttcc-raid"]?.musterDeployment || foundry.utils.getProperty(changes, "flags.bbttcc-raid.unitStrength") !== undefined) _scheduleRender(); } catch (_e) {}
  });
  Hooks.on("createToken", (doc) => { try { if (doc?.flags?.["bbttcc-raid"]?.musterDeployment) _scheduleRender(); } catch (_e) {} });
  Hooks.on("deleteToken", (doc) => { try { if (doc?.flags?.["bbttcc-raid"]?.musterDeployment) _scheduleRender(); } catch (_e) {} });
  Hooks.on("updateActor", (actor, changes) => {
    try { if (foundry.utils.getProperty(changes, "flags.bbttcc-structures.crew") !== undefined) _scheduleRender(); } catch (_e) {}
  });

  function _install() {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.convene = convene;
    game.bbttcc.api.siege.refreshHud = _scheduleRender;
    game.bbttcc.api.siege.bindScene = bindScene;
    game.bbttcc.api.siege.sceneHexUuid = (scene) => _sceneHexUuid(scene);
    game.bbttcc.api.siege.resolveActiveHexUuid = resolveActiveHexUuid;
    game.bbttcc.api.siege.tableauStageScene = tableauStageScene;
  }
  Hooks.once("ready", () => { _install(); _scheduleRender(); console.log(TAG, "Siege HUD loaded (D.1)."); });
  if (game?.ready) { _install(); _scheduleRender(); }
})();
