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

  // Resists: support both legacy array shape and the new map shape (canonical
  // damage type → best factor). Vulnerabilities stored as a map keyed by
  // "type|flavor" for flavor-modulated rules.
  const resistKeys = Array.isArray(state.resists)
    ? state.resists.map(s => String(s))
    : Object.keys(state.resists ?? {});
  const resistsHtml = resistKeys.length
    ? resistKeys.map(r => `<span class="bbttcc-st-resist-pill">${_esc(r)}</span>`).join("")
    : `<span class="bbttcc-st-resist-empty">— none —</span>`;

  const vulnEntries = Object.values(state.vulnerabilities ?? {});
  const vulnsHtml = vulnEntries.length
    ? vulnEntries.map(v => {
        const flavorPart = v.flavor ? `:${_esc(v.flavor)}` : "";
        return `<span class="bbttcc-st-vuln-pill" data-tooltip="×${v.factor}">${_esc(v.type)}${flavorPart}</span>`;
      }).join("")
    : "";

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
        ${vulnsHtml ? `
        <div class="bbttcc-st-resists-line">
          <span class="bbttcc-st-label" style="color:#e08a3a">Vulns</span>
          <span class="bbttcc-st-resists">${vulnsHtml}</span>
        </div>
        ` : ""}
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
        <button type="button" class="bbttcc-st-btn" data-action="bbttccStHarden"
                data-tooltip="Append materials from a faction stockpile to expand the BOM and grow Plates">Harden</button>
        <button type="button" class="bbttcc-st-btn" data-action="bbttccStRepair"
                data-tooltip="Refill chipped materials from a faction stockpile (same-material; cross-family substitution is Phase D+)">Repair</button>
        <button type="button" class="bbttcc-st-btn" data-action="bbttccStReclamation"
                data-tooltip="Open the Bulwark Ruin to Renewal flow on this Structure as the target">Reclamation</button>
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
        <input type="number" name="bbttccStDmg" min="1" value="10" class="bbttcc-st-gm-input"
               data-tooltip="Damage amount"/>
        <select name="bbttccStDmgType" class="bbttcc-st-gm-select" data-tooltip="Canonical FT.DAMAGE_TYPES">
          <option value="">— type —</option>
          <option value="kinetic">kinetic</option>
          <option value="energy">energy</option>
          <option value="poison">poison</option>
          <option value="psychic">psychic</option>
          <option value="sephirotic">sephirotic</option>
          <option value="qliphothic">qliphothic</option>
          <option value="radiation">radiation</option>
        </select>
        <input type="text" name="bbttccStDmgFlavor" class="bbttcc-st-gm-input" style="width:80px"
               placeholder="flavor" data-tooltip="Optional flavor (e.g. concussive, fire, heat). Modulates family vulns."/>
        <button type="button" class="bbttcc-st-btn bbttcc-st-gm-apply" data-action="bbttccStApplyDamage">Apply Damage</button>
        <button type="button" class="bbttcc-st-btn bbttcc-st-btn-secondary" data-action="bbttccStFullRepair"
                data-tooltip="Reset plates to max + restore all BOM qty + clear collapse-fired flag">Full Repair</button>
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
      const dmgInput    = root.querySelector(`[name="bbttccStDmg"]`);
      const typeInput   = root.querySelector(`[name="bbttccStDmgType"]`);
      const flavorInput = root.querySelector(`[name="bbttccStDmgFlavor"]`);
      const amount  = Math.max(1, parseInt(dmgInput?.value, 10) || 0);
      const dmgType = typeInput?.value || "";
      const dmgFlavor = (flavorInput?.value ?? "").trim();
      const fn = game.fourththing?.rolls?._applyDamageToActor;
      if (typeof fn !== "function") {
        ui.notifications?.error?.("_applyDamageToActor not available — fourththing system not ready.");
        return;
      }
      try {
        const desc = await fn(actor, amount, {
          op: "damage", track: "integrity",
          damageType: dmgType, damageFlavor: dmgFlavor,
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

  // ── Phase D handlers ───────────────────────────────────────────────────────

  // Harden — open faction picker + material qty picker
  root.querySelectorAll(`[data-action="bbttccStHarden"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await _openHardenDialog(actor, () => app?.render?.(false));
    });
  });

  // Repair — pick faction, repair chipped rows
  root.querySelectorAll(`[data-action="bbttccStRepair"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await _openRepairDialog(actor, () => app?.render?.(false));
    });
  });

  // Reclamation — open the Phase C Ruin to Renewal flow, with this actor as
  // the implied target. The Phase C handler accepts the Bulwark as caller;
  // for the sheet button we treat the GM as the caller and let them pick
  // which Bulwark and which faction.
  root.querySelectorAll(`[data-action="bbttccStReclamation"]`).forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await _openReclamationDialog(actor);
    });
  });
}

// ── Harden dialog ──────────────────────────────────────────────────────────

async function _openHardenDialog(actor, onDone) {
  const api = game.bbttcc?.api?.structures;
  const stockApi = game.bbttcc?.api?.factions?.stockpile;
  if (!api?.recipes?.harden || !stockApi) {
    return ui.notifications?.error?.("Recipes API or Stockpile API not loaded.");
  }

  const factions = (game.actors?.contents ?? []).filter(a =>
    a.type === "character" && a.getFlag("bbttcc-factions", "isFaction"));
  if (!factions.length) return ui.notifications?.warn?.("No faction actors found.");

  // Default to actor's affiliated faction if any
  const sys = actor.system?.system ?? actor.system;
  const ownerId = sys?.identity?.factionOwnerId;
  const defaultFaction = ownerId ? game.actors?.get(ownerId) : factions[0];

  const factionOptions = factions.map(f =>
    `<option value="${f.id}" ${defaultFaction?.id === f.id ? "selected" : ""}>${foundry.utils.escapeHTML(f.name)}</option>`
  ).join("");

  // Render: list of materials in faction stockpile + qty picker
  function _stockpileRowsHtml(faction) {
    const list = stockApi.list?.(faction) ?? [];
    if (!list.length) return `<p style="opacity:0.5; font-style:italic; margin:4px 0">Stockpile is empty.</p>`;
    return `
      <table style="width:100%; border-collapse:collapse; margin-top:4px;">
        <thead><tr style="opacity:0.6; font-size:0.62rem">
          <th style="text-align:left; padding:2px 6px">Material</th>
          <th style="text-align:right; padding:2px 6px">In Stockpile</th>
          <th style="text-align:right; padding:2px 6px">Add</th>
        </tr></thead>
        <tbody>
          ${list.map(m => `
            <tr>
              <td style="padding:2px 6px; font-size:0.74rem">${foundry.utils.escapeHTML(m.name)} <span style="opacity:0.5; font-size:0.62rem">(${foundry.utils.escapeHTML(m.key)})</span></td>
              <td style="padding:2px 6px; text-align:right; font-family:monospace; font-size:0.74rem">${m.qty}</td>
              <td style="padding:2px 6px; text-align:right;">
                <input type="number" name="add_${foundry.utils.escapeHTML(m.key)}" min="0" max="${m.qty}" value="0" style="width:60px; font-family:monospace; text-align:right;"/>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  const dialog = new Dialog({
    title: `Harden — ${actor.name}`,
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0; min-width: 480px;">
        <p style="margin:0; font-size:0.78rem">
          Append materials to this Structure's BOM. Each unit added contributes
          its family's plate value to both Plates Max AND Plates Current.
        </p>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Pay from faction stockpile</span>
          <select name="factionId">${factionOptions}</select>
        </label>
        <div id="bbttcc-harden-rows"></div>
      </div>
    `,
    buttons: {
      harden: {
        label: "Harden",
        callback: async (html) => {
          const factionId = html.find("[name='factionId']").val();
          const faction = game.actors.get(factionId);
          if (!faction) return ui.notifications?.warn?.("Pick a faction.");
          const list = stockApi.list?.(faction) ?? [];
          const additions = [];
          for (const m of list) {
            const inp = html.find(`[name='add_${m.key}']`);
            const qty = Math.max(0, parseInt(inp.val(), 10) || 0);
            if (qty > 0) additions.push({ key: m.key, qty });
          }
          if (!additions.length) return ui.notifications?.warn?.("Pick at least one material to add.");
          const res = await api.recipes.harden(actor, additions, faction);
          if (!res.ok) {
            const missingList = (res.missing ?? []).map(m => `${m.name} (need ${m.need}, have ${m.have})`).join(", ");
            ui.notifications?.error?.(`${res.error}${missingList ? " — " + missingList : ""}`);
            return;
          }
          ui.notifications?.info?.(`Hardened ${actor.name} (+${res.addedPlateValue} plates).`);
          onDone?.();
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "harden",
    render: (html) => {
      const fSel = html.find("[name='factionId']");
      const rowsHost = html.find("#bbttcc-harden-rows");
      const update = () => {
        const f = game.actors.get(fSel.val());
        rowsHost.html(_stockpileRowsHtml(f));
      };
      fSel.on("change", update);
      update();
    }
  });
  dialog.render(true);
}

// ── Repair dialog ──────────────────────────────────────────────────────────

async function _openRepairDialog(actor, onDone) {
  const api = game.bbttcc?.api?.structures;
  const stockApi = game.bbttcc?.api?.factions?.stockpile;
  if (!api?.recipes?.repair || !stockApi) {
    return ui.notifications?.error?.("Recipes API or Stockpile API not loaded.");
  }

  const bom = actor.getFlag("bbttcc-structures", "materialBOM") ?? [];
  const chipped = bom.filter(r => {
    const qty = Number(r.qty) || 0;
    const orig = Number(r.originalQty) || qty;
    return qty < orig;
  });

  if (!chipped.length) {
    return ui.notifications?.info?.("Nothing to repair — BOM is at full qty.");
  }

  const factions = (game.actors?.contents ?? []).filter(a =>
    a.type === "character" && a.getFlag("bbttcc-factions", "isFaction"));
  if (!factions.length) return ui.notifications?.warn?.("No faction actors found.");

  const sys = actor.system?.system ?? actor.system;
  const ownerId = sys?.identity?.factionOwnerId;
  const defaultFaction = ownerId ? game.actors?.get(ownerId) : factions[0];

  const factionOptions = factions.map(f =>
    `<option value="${f.id}" ${defaultFaction?.id === f.id ? "selected" : ""}>${foundry.utils.escapeHTML(f.name)}</option>`
  ).join("");

  function _chippedRowsHtml(faction) {
    return `
      <table style="width:100%; border-collapse:collapse; margin-top:4px;">
        <thead><tr style="opacity:0.6; font-size:0.62rem">
          <th style="text-align:left; padding:2px 6px">Material</th>
          <th style="text-align:right; padding:2px 6px">Chipped</th>
          <th style="text-align:right; padding:2px 6px">In Stockpile</th>
          <th style="text-align:right; padding:2px 6px">Refill</th>
        </tr></thead>
        <tbody>
          ${chipped.map(r => {
            const qty = Number(r.qty) || 0;
            const orig = Number(r.originalQty) || qty;
            const need = orig - qty;
            const have = stockApi.qty?.(faction, r.materialKey) ?? 0;
            const max = Math.min(need, have);
            return `<tr>
              <td style="padding:2px 6px; font-size:0.74rem">${foundry.utils.escapeHTML(r.name ?? r.materialKey)}</td>
              <td style="padding:2px 6px; text-align:right; font-family:monospace; font-size:0.74rem; color:#e08a3a">−${need}</td>
              <td style="padding:2px 6px; text-align:right; font-family:monospace; font-size:0.74rem">${have}</td>
              <td style="padding:2px 6px; text-align:right;">
                <input type="number" name="repair_${foundry.utils.escapeHTML(r.materialKey)}" min="0" max="${max}" value="${max}" style="width:60px; font-family:monospace; text-align:right;"/>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  const dialog = new Dialog({
    title: `Repair — ${actor.name}`,
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0; min-width: 520px;">
        <p style="margin:0; font-size:0.78rem">
          Refill chipped BOM rows from faction stockpile. Same-material only.
        </p>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Pay from faction stockpile</span>
          <select name="factionId">${factionOptions}</select>
        </label>
        <div id="bbttcc-repair-rows"></div>
      </div>
    `,
    buttons: {
      repair: {
        label: "Repair",
        callback: async (html) => {
          const factionId = html.find("[name='factionId']").val();
          const faction = game.actors.get(factionId);
          if (!faction) return ui.notifications?.warn?.("Pick a faction.");
          const selective = {};
          for (const r of chipped) {
            const v = Math.max(0, parseInt(html.find(`[name='repair_${r.materialKey}']`).val(), 10) || 0);
            if (v > 0) selective[r.materialKey] = v;
          }
          const res = await api.recipes.repair(actor, faction, { selective });
          if (!res.ok) {
            ui.notifications?.error?.(res.error ?? "Repair failed.");
            return;
          }
          ui.notifications?.info?.(`Repaired ${actor.name} (+${res.addedPlateValue} plates → ${res.newPlatesCurrent}).`);
          onDone?.();
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "repair",
    render: (html) => {
      const fSel = html.find("[name='factionId']");
      const rowsHost = html.find("#bbttcc-repair-rows");
      const update = () => {
        const f = game.actors.get(fSel.val());
        rowsHost.html(_chippedRowsHtml(f));
      };
      fSel.on("change", update);
      update();
    }
  });
  dialog.render(true);
}

// ── Reclamation: invoke Phase C Renewal handler ────────────────────────────

async function _openReclamationDialog(actor) {
  // Phase C provides game.bbttcc.api.structures.bulwark._onRenewal(actor)
  // which expects the BULWARK as caller and prompts for target + faction. For
  // the sheet button on a Structure, we pivot: we need a Bulwark caller.
  // Simplest: prompt the GM to pick a Bulwark from the world, then invoke
  // the Phase C handler.
  const bulwark = game.bbttcc?.api?.structures?.bulwark;
  if (!bulwark?._onRenewal) return ui.notifications?.error?.("Bulwark hookups not loaded.");

  // Candidate Bulwark actors = characters whose class includes "bulwark"
  // (looser match: any character with ruinCharges resource since Bulwark
  // owns that resource per the system).
  const candidates = (game.actors?.contents ?? []).filter(a => {
    if (a.type !== "character") return false;
    const sys = a.system?.system ?? a.system;
    return !!sys?.resources?.ruinCharges;
  });
  if (!candidates.length) {
    return ui.notifications?.warn?.("No Bulwark actors found (no character has Ruin Charges).");
  }

  const escName = foundry.utils.escapeHTML(actor.name);
  const candidateOptions = candidates.map(c =>
    `<option value="${c.id}">${foundry.utils.escapeHTML(c.name)}</option>`
  ).join("");

  new Dialog({
    title: `Reclamation — ${actor.name}`,
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0; min-width: 380px;">
        <p style="margin:0; font-size:0.78rem">
          Invoke Bulwark Ruin to Renewal targeting <b>${escName}</b>. The Bulwark spends a Ruin Charge themselves; this just opens the follow-up dialog.
        </p>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Bulwark caster</span>
          <select name="bulwarkId">${candidateOptions}</select>
        </label>
        <p style="margin:0; font-size:0.68rem; opacity:0.55; font-style:italic">
          Note: this convenience button does NOT charge a Ruin Charge — that
          remains the Bulwark dialog's responsibility. Use this when the
          Bulwark has already declared the spend in fiction and you want to
          jump straight to the reclamation roll.
        </p>
      </div>
    `,
    buttons: {
      go: {
        label: "Open Reclamation",
        callback: async (html) => {
          const id = html.find("[name='bulwarkId']").val();
          const caller = game.actors.get(id);
          if (!caller) return ui.notifications?.warn?.("Pick a Bulwark.");
          await bulwark._onRenewal(caller);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "go"
  }).render(true);
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
