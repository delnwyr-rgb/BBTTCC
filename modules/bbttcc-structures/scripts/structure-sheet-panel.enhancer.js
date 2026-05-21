/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · structure-sheet-panel.enhancer.js · Phase A
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the Structure panel on Rig and Boss actor sheets. Read-only for
 * Phase A — shows state, plates, threshold, BOM grid, resists, and stubbed
 * action buttons (Harden / Repair / Reclamation) that surface in later phases.
 *
 * When an actor doesn't have a BOM stamped yet, shows a "Stamp Test BOM"
 * affordance that opens the paper-test macro picker.
 *
 * Per [[appv2-render-hook-html-param]] memory: the `html` param in AppV2 hooks
 * is the rendered PART content, not the full window. For single-part RigSheet
 * / BossSheet that's the whole sheet body — good enough.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/panel]`;
const FLAG_SCOPE = MOD_ID;
const PANEL_MARKER = "data-bbttcc-structures-panel";

// Family color/icon lookup will hydrate from api.structures.FAMILIES at first
// render (data may not be loaded at script-load time).
function _famDef(famKey) {
  const tbl = game.bbttcc?.api?.structures?.FAMILIES ?? {};
  return tbl[famKey] ?? { label: famKey, color: "#888", icon: "•" };
}

// ── State pip ────────────────────────────────────────────────────────────────

const STATE_PIPS = {
  intact:   { glyph: "◇", label: "Intact",   color: "#7cc77c" },
  damaged:  { glyph: "◆", label: "Damaged",  color: "#e8c84a" },
  breached: { glyph: "◈", label: "Breached", color: "#e08a3a" },
  razed:    { glyph: "◾", label: "Razed",    color: "#888" }
};

// ── Panel HTML ──────────────────────────────────────────────────────────────

function _esc(s) {
  return foundry.utils.escapeHTML(String(s ?? ""));
}

function _buildEmptyPanelHTML(actor) {
  return `
    <section class="bbttcc-structures-panel" ${PANEL_MARKER}="empty">
      <header class="bbttcc-st-header">
        <h3>STRUCTURE</h3>
        <span class="bbttcc-st-empty-tag">No BOM stamped</span>
      </header>
      <div class="bbttcc-st-empty-body">
        <p class="bbttcc-st-empty-msg">
          This actor has no Material BOM yet. Stamp one to enable structural
          damage tracking (Phase B+) and to paper-test derivation math now.
        </p>
        <button type="button" class="bbttcc-st-btn bbttcc-st-stamp"
                data-action="bbttccStStampTest">
          Stamp Test BOM ▸
        </button>
      </div>
    </section>
  `;
}

function _buildFullPanelHTML(actor, state) {
  const pip = STATE_PIPS[state.state] ?? STATE_PIPS.intact;
  const platesPct = state.plates.max > 0
    ? Math.max(0, Math.min(100, (state.plates.current / state.plates.max) * 100))
    : 0;
  const platesBar = (() => {
    const filled = Math.round(platesPct / 10);
    return "▰".repeat(filled) + "▱".repeat(10 - filled);
  })();

  // BOM rows — Phase B: bars show qty/originalQty for depletion visualization
  const bomRows = (state.materialBOM ?? []).map(row => {
    const fam = _famDef(row.family);
    const original = Math.max(1, Number(row.originalQty) || Number(row.qty) || 1);
    const qty = Math.max(0, Number(row.qty) || 0);
    const qtyPct = Math.max(0, Math.min(100, (qty / original) * 100));
    const isLB = row.family === "sephirotic";
    const depleted = qty === 0;
    const qtyDisplay = original === qty ? String(qty) : `${qty}/${original}`;
    return `
      <tr class="bbttcc-st-bom-row ${isLB ? "bbttcc-st-bom-loadbearing" : ""} ${depleted ? "bbttcc-st-bom-depleted" : ""}">
        <td class="bbttcc-st-bom-bar">
          <div class="bbttcc-st-qty-bar" style="--qty-pct:${qtyPct}%; --fam-color:${fam.color}"
               data-tooltip="${qty}/${original} remaining"></div>
        </td>
        <td class="bbttcc-st-bom-name">${_esc(row.name ?? row.materialKey)}</td>
        <td class="bbttcc-st-bom-family" style="color:${fam.color}">${fam.icon} ${_esc(fam.label)}</td>
        <td class="bbttcc-st-bom-tier">T${_esc(row.tier ?? "I")}</td>
        <td class="bbttcc-st-bom-qty">${qtyDisplay}</td>
        <td class="bbttcc-st-bom-lb">${isLB ? '<span class="bbttcc-st-lb-tag" data-tooltip="Load-bearing — Structure cannot be razed while this remains">LB</span>' : ""}</td>
      </tr>
    `;
  }).join("");

  const resistsHtml = (state.resists ?? []).length
    ? state.resists.map(r => `<span class="bbttcc-st-resist-pill">${_esc(r)}</span>`).join("")
    : `<span class="bbttcc-st-resist-empty">— none —</span>`;

  const lbBadge = state.loadBearing
    ? `<span class="bbttcc-st-lb-badge" data-tooltip="Sephirotic material present — Structure cannot pass to Razed while load-bearing">⚜ Load-bearing</span>`
    : "";

  return `
    <section class="bbttcc-structures-panel" ${PANEL_MARKER}="full">
      <header class="bbttcc-st-header">
        <h3>STRUCTURE</h3>
        <span class="bbttcc-st-state-pip" style="color:${pip.color}" data-tooltip="State">
          ${pip.glyph} ${pip.label}
        </span>
        ${lbBadge}
      </header>

      <div class="bbttcc-st-summary">
        <div class="bbttcc-st-plates">
          <span class="bbttcc-st-label">Plates</span>
          <span class="bbttcc-st-plates-bar" data-tooltip="${state.plates.current}/${state.plates.max}">${platesBar}</span>
          <span class="bbttcc-st-plates-val">${state.plates.current}/${state.plates.max}</span>
        </div>
        <div class="bbttcc-st-threshold">
          <span class="bbttcc-st-label">Threshold</span>
          <span class="bbttcc-st-threshold-val" data-tooltip="Damage rolls below this chip materials but don't pierce Plates">${state.threshold}</span>
        </div>
        <div class="bbttcc-st-resists-line">
          <span class="bbttcc-st-label">Resists</span>
          <span class="bbttcc-st-resists">${resistsHtml}</span>
        </div>
      </div>

      <div class="bbttcc-st-bom-wrap">
        <table class="bbttcc-st-bom-table">
          <thead>
            <tr>
              <th></th>
              <th>Material</th>
              <th>Family</th>
              <th>T</th>
              <th>Qty</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${bomRows}</tbody>
        </table>
      </div>

      <div class="bbttcc-st-actions">
        <button type="button" class="bbttcc-st-btn" data-action="bbttccStHarden" disabled
                data-tooltip="Append materials to BOM (Phase D)">Harden</button>
        <button type="button" class="bbttcc-st-btn" data-action="bbttccStRepair" disabled
                data-tooltip="Refill chipped Plates (Phase D)">Repair</button>
        <button type="button" class="bbttcc-st-btn" data-action="bbttccStReclamation" disabled
                data-tooltip="Bulwark Ruin to Renewal — recover BOM to stockpile (Phase C)">Reclamation</button>
        <button type="button" class="bbttcc-st-btn bbttcc-st-btn-secondary"
                data-action="bbttccStRestamp"
                data-tooltip="Re-stamp the BOM (resets Plates to max)">Re-stamp</button>
        <button type="button" class="bbttcc-st-btn bbttcc-st-btn-danger"
                data-action="bbttccStClear"
                data-tooltip="Remove all Structure flags from this actor">Clear</button>
      </div>
      ${game.user?.isGM ? `
      <div class="bbttcc-st-gm-test" data-tooltip="GM-only · Phase B paper-test affordance">
        <span class="bbttcc-st-gm-label">⚒ GM TEST</span>
        <input type="number" name="bbttccStDmg" min="1" value="10" class="bbttcc-st-gm-input"/>
        <select name="bbttccStDmgType" class="bbttcc-st-gm-select">
          <option value="">— type —</option>
          <option value="kinetic">kinetic</option>
          <option value="piercing">piercing</option>
          <option value="fire">fire</option>
          <option value="hex">hex</option>
          <option value="qliph">qliph</option>
          <option value="curse">curse</option>
          <option value="concussive">concussive</option>
        </select>
        <button type="button" class="bbttcc-st-btn bbttcc-st-gm-apply" data-action="bbttccStApplyDamage">Apply Damage</button>
        <button type="button" class="bbttcc-st-btn bbttcc-st-btn-secondary" data-action="bbttccStFullRepair"
                data-tooltip="Reset plates to max + restore all BOM qty (Phase B test reset)">Full Repair</button>
        <button type="button" class="bbttcc-st-btn bbttcc-st-btn-secondary" data-action="bbttccStClearCollapseFlag"
                data-tooltip="Reset collapseFired flag so Collapse can re-trigger">Reset Collapse Flag</button>
      </div>
      ` : ""}
    </section>
  `;
}

function buildPanelHTML(actor) {
  const api = game.bbttcc?.api?.structures;
  if (!api) return "";
  const state = api.readState(actor);
  if (!state) return _buildEmptyPanelHTML(actor);
  return _buildFullPanelHTML(actor, state);
}

// ── Injection ───────────────────────────────────────────────────────────────

function _findInjectionTarget(appEl) {
  // Always search the full window element (app.element) — the `html` param in
  // AppV2 render hooks is the rendered PART content per
  // [[appv2-render-hook-html-param]], which can be partial during the render
  // lifecycle. Using app.element guarantees we see the fully-built DOM.
  if (!appEl || !appEl.querySelector) return null;
  // Prefer identity tab pane
  let host = appEl.querySelector(".tab.identity[data-tab='identity']")
          || appEl.querySelector(".tab[data-tab='identity']");
  if (host) return host;
  // Fallback: any tab pane that's currently active
  host = appEl.querySelector(".tab.active");
  if (host) return host;
  // Last resort: window-content body, NEVER the chrome
  host = appEl.querySelector(".window-content");
  return host || null;
}

function _sweepPriorPanels(appEl) {
  // Sweep the ENTIRE window. Earlier injections may have landed in the wrong
  // place if a partial-render hook fired before the part DOM was complete;
  // this guarantees we don't leave orphan panels in the chrome.
  if (!appEl || !appEl.querySelectorAll) return;
  appEl.querySelectorAll(`[${PANEL_MARKER}]`).forEach(el => el.remove());
}

function injectPanel(app /* html unused — we use app.element */) {
  try {
    const actor = app?.actor ?? app?.object;
    if (!actor) return;
    // Only inject on actor types that can host structures. Rig/Boss now;
    // Phase E may add NPC/character if facility-flagged structure actors
    // turn out to need it.
    if (!["rig", "boss"].includes(actor.type)) return;

    const appEl = app.element;
    if (!appEl) return;

    // Always sweep ALL prior panels first — defensive against earlier
    // misplaced injections from other hook paths.
    _sweepPriorPanels(appEl);

    const target = _findInjectionTarget(appEl);
    if (!target) return;

    const wrap = document.createElement("div");
    wrap.className = "bbttcc-st-panel-wrap";
    wrap.setAttribute(PANEL_MARKER, "wrap");
    wrap.innerHTML = buildPanelHTML(actor);
    target.appendChild(wrap);

    _bindActions(wrap, actor, app);
  } catch (e) {
    console.warn(TAG, "injectPanel failed", e);
  }
}

// ── Action bindings ─────────────────────────────────────────────────────────

function _bindActions(root, actor, app) {
  const api = game.bbttcc?.api?.structures;
  if (!api) return;

  // Stamp test BOM — opens a small picker dialog
  root.querySelectorAll(`[data-action="bbttccStStampTest"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await _openStampPicker(actor, () => app?.render?.(false));
    });
  });

  // Re-stamp — re-applies current BOM, resets Plates to max
  root.querySelectorAll(`[data-action="bbttccStRestamp"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const cur = api.readState(actor);
      if (!cur?.materialBOM?.length) {
        ui.notifications?.warn?.("No BOM to re-stamp.");
        return;
      }
      const raw = cur.materialBOM.map(r => ({ materialKey: r.materialKey, qty: r.qty }));
      await api.stampBOM(actor, raw, { facilityMode: cur.facilityMode, resetCurrentPlates: true });
      ui.notifications?.info?.("BOM re-stamped; Plates reset to max.");
      app?.render?.(false);
    });
  });

  // Clear — remove all structure flags
  root.querySelectorAll(`[data-action="bbttccStClear"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const ok = await Dialog.confirm({
        title: "Clear Structure",
        content: `<p>Remove all Structure flags from <b>${foundry.utils.escapeHTML(actor.name)}</b>?</p>`
      });
      if (!ok) return;
      await api.clearStructure(actor);
      ui.notifications?.info?.("Structure flags cleared.");
      app?.render?.(false);
    });
  });

  // ── Phase B GM affordances ────────────────────────────────────────────────

  // Apply Damage — routes through _applyDamageToActor (which is wedged so the
  // structure damage path fires; integrity overflow flows naturally).
  root.querySelectorAll(`[data-action="bbttccStApplyDamage"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!game.user?.isGM) return;
      const dmgInput  = root.querySelector(`[name="bbttccStDmg"]`);
      const typeInput = root.querySelector(`[name="bbttccStDmgType"]`);
      const amount = Math.max(1, parseInt(dmgInput?.value, 10) || 0);
      const dmgType = typeInput?.value || "";
      const fn = game.fourththing?.rolls?._applyDamageToActor;
      if (typeof fn !== "function") {
        ui.notifications?.error?.("_applyDamageToActor not available — fourththing system not ready.");
        return;
      }
      try {
        const desc = await fn(actor, amount, {
          op: "damage", track: "integrity",
          damageType: dmgType, damageFlavor: "",
          perTargetMultiplier: 1
        });
        if (desc) ui.notifications?.info?.(desc);
      } catch (e) {
        console.warn("[bbttcc-structures] apply-damage button failed", e);
        ui.notifications?.error?.("Damage apply failed — see console.");
      }
      // Sheet re-renders automatically via Foundry's update hook; force a
      // render in case the actor wasn't updated (no-op damage).
      app?.render?.(false);
    });
  });

  // Full Repair — restore plates to max, BOM qty back to originalQty.
  root.querySelectorAll(`[data-action="bbttccStFullRepair"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!game.user?.isGM) return;
      const cur = api.readState(actor);
      if (!cur) return;
      // Re-stamp from the original BOM (using originalQty if present)
      const rawBom = cur.materialBOM.map(r => ({
        materialKey: r.materialKey,
        qty: Number(r.originalQty) > 0 ? r.originalQty : r.qty
      }));
      await api.stampBOM(actor, rawBom, {
        facilityMode: cur.facilityMode,
        collapseProfile: cur.collapseProfile,
        resetCurrentPlates: true
      });
      // Clear the collapse-fired one-shot so Collapse can re-trigger
      await actor.unsetFlag("bbttcc-structures", "collapseFired");
      ui.notifications?.info?.(`Full repair: BOM restored, plates → max, collapse flag cleared.`);
      app?.render?.(false);
    });
  });

  // Reset Collapse Flag — clears collapseFired without doing a full repair
  root.querySelectorAll(`[data-action="bbttccStClearCollapseFlag"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!game.user?.isGM) return;
      await actor.unsetFlag("bbttcc-structures", "collapseFired");
      ui.notifications?.info?.("Collapse-fired flag cleared.");
    });
  });
}

// ── Stamp picker (paper-test affordance) ─────────────────────────────────────

const _PRESETS = {
  hexmobile: {
    label: "Hexmobile (Rig)",
    bom: [
      { materialKey: "bog-iron", qty: 4 },
      { materialKey: "ash-wood", qty: 2 },
      { materialKey: "hex-iron-cleat", qty: 1 }
    ],
    facilityMode: false
  },
  atr: {
    label: "ATR — Assault Tactical Rig",
    bom: [
      { materialKey: "scribed-steel", qty: 6 },
      { materialKey: "heart-iron", qty: 3 },
      { materialKey: "cold-iron", qty: 2 }
    ],
    facilityMode: false
  },
  pilotMount: {
    label: "Pilot Mount",
    bom: [
      { materialKey: "cold-iron", qty: 3 },
      { materialKey: "ash-wood", qty: 2 }
    ],
    facilityMode: false
  },
  septWall: {
    label: "Sept Wall (Facility)",
    bom: [
      { materialKey: "mountain-stone", qty: 12 },
      { materialKey: "anchorstone", qty: 6 },
      { materialKey: "blessed-thread", qty: 4 },
      { materialKey: "yesodium", qty: 1 }
    ],
    facilityMode: true
  },
  bunkerGate: {
    label: "Bunker Gate (Facility)",
    bom: [
      { materialKey: "scribed-steel", qty: 10 },
      { materialKey: "hex-glyph-plate", qty: 4 },
      { materialKey: "yesodium", qty: 2 }
    ],
    facilityMode: true
  },
  watchtower: {
    label: "Watchtower (Facility)",
    bom: [
      { materialKey: "ash-wood", qty: 8 },
      { materialKey: "mountain-stone", qty: 4 },
      { materialKey: "hex-iron-cleat", qty: 2 },
      { materialKey: "focusing-lens", qty: 1 }
    ],
    facilityMode: true
  },
  glyphWardPylon: {
    label: "Glyph-Ward Pylon (Facility)",
    bom: [
      { materialKey: "hex-glyph-plate", qty: 6 },
      { materialKey: "sept-tuning-fork", qty: 2 },
      { materialKey: "tree-of-life-shard", qty: 1 }
    ],
    facilityMode: true
  },
  septBridge: {
    label: "Sept Bridge (Facility)",
    bom: [
      { materialKey: "mountain-stone", qty: 8 },
      { materialKey: "ash-wood", qty: 4 },
      { materialKey: "cold-iron", qty: 3 },
      { materialKey: "yesodium", qty: 1 }
    ],
    facilityMode: true,
    collapseOverride: { triggerState: "damaged" }
  }
};

async function _openStampPicker(actor, onDone) {
  const api = game.bbttcc?.api?.structures;
  if (!api) {
    ui.notifications?.error?.("Structures API not ready.");
    return;
  }

  const options = Object.entries(_PRESETS).map(([k, p]) =>
    `<option value="${k}">${foundry.utils.escapeHTML(p.label)}</option>`
  ).join("");

  new Dialog({
    title: "Stamp Test BOM",
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0;">
        <p style="margin:0; font-size:0.8rem; opacity:0.75">
          Pick a preset BOM to stamp onto <b>${foundry.utils.escapeHTML(actor.name)}</b>.
          Phase A: paper-test only — no damage path yet.
        </p>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.75rem; opacity:0.8">Preset</span>
          <select name="preset" style="font-size:0.85rem">${options}</select>
        </label>
      </div>
    `,
    buttons: {
      stamp: {
        label: "Stamp",
        callback: async (html) => {
          const key = html.find("[name='preset']").val();
          const preset = _PRESETS[key];
          if (!preset) return;
          const opts = { facilityMode: preset.facilityMode };
          if (preset.collapseOverride) {
            opts.collapseProfile = {
              fallFt: 10, damageDice: "2d10", nonlethal: true, knockbackFt: 5,
              ...preset.collapseOverride
            };
          }
          const derived = await api.stampBOM(actor, preset.bom, opts);
          ui.notifications?.info?.(
            `Stamped ${preset.label}: Plates ${derived.plates.max}, Threshold ${derived.threshold}, ${derived.resists.length} resist(s).`
          );
          onDone?.();
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "stamp"
  }).render(true);
}

// ── Hook install ────────────────────────────────────────────────────────────

let _installed = false;
function install() {
  if (_installed) return;
  _installed = true;
  // Defer the injection one microtask so the part DOM is fully attached
  // before we walk it. Some AppV2 versions fire the hook before the part
  // wrapper is integrated into app.element.
  const handler = (app) => {
    queueMicrotask(() => {
      try { injectPanel(app); }
      catch (e) { console.warn(TAG, "handler error", e); }
    });
  };
  // ONLY hook the class-specific render hooks. The renderApplicationV2
  // catch-all is too aggressive — it fires for dialogs and partial renders
  // where the sheet DOM isn't fully assembled yet, causing orphan panels
  // to land in the window chrome.
  Hooks.on("renderFourthThingRigSheet", handler);
  Hooks.on("renderFourthThingBossSheet", handler);
  console.log(TAG, "panel enhancer installed");
}

Hooks.once("ready", install);
