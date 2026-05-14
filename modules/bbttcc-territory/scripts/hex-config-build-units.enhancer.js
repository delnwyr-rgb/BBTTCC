// modules/bbttcc-territory/scripts/hex-config-build-units.enhancer.js
// BBTTCC — Hex Config Build Unit Buttons
//
// Adds three buttons to the BBTTCC Hex Configuration UI:
//   - "Fortify Hex (BU)"
//   - "Repair Hex (BU)"
//   - "Build Asset (BU)" (placeholder)
//
// Each button spends Build Units from the owning faction via
// game.bbttcc.api.territory.buildUnits.spendForAction(...)
// and then re-renders the config window.

(() => {
  const MOD_T = "bbttcc-territory";
  const TAG   = "[bbttcc-hex-config/BU]";





function gmEditEnabled() {
  try { return !!(game.user && game.user.isGM) && !!game.settings.get("bbttcc-core", "gmEditMode"); }
  catch (e) { return false; }
}

function htmlEscape(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function numOrBlank(v){
  if (v === null || typeof v === "undefined") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function _gmPanelInput(root, name){
  return root ? root.querySelector('[name="' + name + '"]') : null;
}

function injectGMPanel(app, html, el) {
  try {
    if (!gmEditEnabled()) return;
    const root = el || (html instanceof jQuery ? html[0] : html);
    if (!root) return;
    if (root.querySelector("[data-bbttcc='gm-edit-panel']")) return;

    // Resolve hex document using existing resolver in this file.
    Promise.resolve(resolveHexDocument(app, html)).then(function (doc) {
      try {
        if (!doc || !doc.uuid) return;

        const flags = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};
        const travel = flags.travel || {};
        const dev = flags.development || {};
        const integ = flags.integration || {};
        const alarm = flags.alarm || {};
        const camp = flags.campaign || {};

        const wrap = document.createElement("fieldset");
        wrap.setAttribute("data-bbttcc", "gm-edit-panel");
        wrap.style.marginTop = "0.75rem";
        wrap.style.border = "1px solid rgba(100,116,139,0.55)";
        wrap.style.borderRadius = "0.75rem";
        wrap.style.padding = "0.6rem 0.7rem 0.65rem";
        wrap.style.background = "linear-gradient(160deg, rgba(15,23,42,0.98), rgba(15,23,42,1))";

        wrap.innerHTML = `
          <legend style="padding:0 0.25rem; opacity:0.9; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:#cbd5f5;">
            GM: Manual Edit
          </legend>

          <div class="form-group">
            <label>Hex UUID</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="text" readonly value="${htmlEscape(doc.uuid)}" style="flex:1;">
              <button type="button" class="bbttcc-btn" data-gm-action="copy-uuid">Copy</button>
            </div>
            <p class="hint">GM-only. Requires bbttcc-core → GM Edit Mode.</p>
          </div>

          <div class="form-group">
            <label>Travel Units Override</label>
            <input type="number" min="0" max="99" step="1" name="gm.travel.unitsOverride" value="${htmlEscape(numOrBlank(travel.unitsOverride))}">
            <p class="hint">Blank = no change. Clear removes override.</p>
          </div>

          <div class="form-group">
            <label>Development Stage</label>
            <input type="number" min="0" max="6" step="1" name="gm.development.stage" value="${htmlEscape(numOrBlank((dev.stage != null) ? dev.stage : integ.progress))}">
            <p class="hint">Writes development.stage + integration.progress (0–6).</p>
          </div>

          <div class="form-group row" style="align-items:center;">
            <label style="margin:0;">Development Locked</label>
            <input type="checkbox" name="gm.development.locked" ${(dev.locked === true || integ.locked === true) ? "checked" : ""}>
          </div>

          <div class="form-group">
            <label>Alarm</label>
            <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="number" min="0" max="99" step="1" name="gm.alarm.value" value="${htmlEscape(numOrBlank(alarm.value))}" style="flex:1;">
              <label class="checkbox" style="display:flex; gap:0.35rem; align-items:center; margin:0;">
                <input type="checkbox" name="gm.alarm.locked" ${(alarm.locked === true) ? "checked" : ""}>
                <span>Lock</span>
              </label>
            </div>
            <p class="hint">Blank = no change.</p>
          </div>

          <div class="form-group">
            <label>On-Enter Beat ID</label>
            <input type="text" name="gm.campaign.onEnterBeatId" value="${htmlEscape(camp.onEnterBeatId || "")}" placeholder="e.g. enc_hidden_ruins">
          </div>

          <div class="form-group">
            <label>GM Note (audit)</label>
            <input type="text" name="gm.note" value="" placeholder="Why are we changing reality?">
          </div>

          <div class="form-group" style="display:flex; gap:0.5rem; justify-content:flex-end;">
            <button type="button" class="bbttcc-btn" data-gm-action="clear">Clear Overrides</button>
            <button type="button" class="bbttcc-btn" data-gm-action="apply">Apply</button>
          </div>
        `;

        root.appendChild(wrap);

        function q(sel){ return wrap.querySelector(sel); }
        function val(name){ const el2 = q('[name="' + name + '"]'); return el2 ? (el2.value || "") : ""; }
        function checked(name){ const el2 = q('[name="' + name + '"]'); return !!(el2 && el2.checked); }

        wrap.addEventListener("click", function (ev) {
          const btn = (ev.target && ev.target.closest) ? ev.target.closest("button[data-gm-action]") : null;
          if (!btn) return;
          ev.preventDefault(); ev.stopPropagation();

          const action = btn.getAttribute("data-gm-action");

          if (action === "copy-uuid") {
            try {
              navigator.clipboard.writeText(doc.uuid);
              if (ui && ui.notifications && ui.notifications.info) ui.notifications.info("Copied Hex UUID to clipboard.");
            } catch (e) {
              console.warn(TAG, "copy uuid failed", e);
              if (ui && ui.notifications && ui.notifications.warn) ui.notifications.warn("Could not copy UUID (see console).");
            }
            return;
          }

          const gmApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.gm;
          if (!gmApi || typeof gmApi.setHex !== "function") {
            if (ui && ui.notifications && ui.notifications.error) ui.notifications.error("GM API not available (bbttcc-core Phase 1 missing).");
            return;
          }

          const note = String(val("gm.note") || "").trim();

          if (action === "clear") {
            gmApi.setHex({
              hexUuid: doc.uuid,
              patch: {
                travel: { unitsOverride: null },
                development: { stage: null, locked: null },
                alarm: { value: null, locked: null },
                campaign: { onEnterBeatId: null }
              },
              note: note || "Clear hex overrides"
            }).then(function () { app.render(true); });
            return;
          }

          if (action === "apply") {
            const patch = {};

            const uo = String(val("gm.travel.unitsOverride") || "").trim();
            if (uo !== "") patch.travel = Object.assign(patch.travel || {}, { unitsOverride: Number(uo) });

            const st = String(val("gm.development.stage") || "").trim();
            patch.development = patch.development || {};
            if (st !== "") patch.development.stage = Number(st);
            patch.development.locked = checked("gm.development.locked");

            const av = String(val("gm.alarm.value") || "").trim();
            patch.alarm = patch.alarm || {};
            if (av !== "") patch.alarm.value = Number(av);
            patch.alarm.locked = checked("gm.alarm.locked");

            const beat = String(val("gm.campaign.onEnterBeatId") || "").trim();
            if (beat !== "") patch.campaign = Object.assign(patch.campaign || {}, { onEnterBeatId: beat });

            gmApi.setHex({ hexUuid: doc.uuid, patch: patch, note: note || "GM edit hex" }).then(function () { app.render(true); });
            return;
          }
        });

        console.log(TAG, "Injected GM manual edit panel into Hex Config.");
      } catch (e2) {
        console.warn(TAG, "GM panel inject failed", e2);
      }
    });
  } catch (e) {
    console.warn(TAG, "GM panel inject failed (outer)", e);
  }
}
function gmEditEnabled() {
  try { return !!(game.user && game.user.isGM) && !!game.settings.get("bbttcc-core","gmEditMode"); }
  catch (e) { return false; }
}

function htmlEscape(s){
  return String(s==null?"":s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function numOrBlank(v){
  if (v === null || typeof v === "undefined") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  function getBUApi() {
    return game.bbttcc?.api?.territory?.buildUnits || null;
  }

  // Try hard to resolve the DrawingDocument being edited.
  async function resolveHexDocument(app) {
    // 1) If the app is bound to a document or object already:
    const maybe = app?.document || app?.object || app?.actor || null;
    if (maybe?.document) return maybe.document;
    if (maybe?.update && maybe?.id) return maybe; // looks like a Document

    // 2) Try from UUID if present
    const uuid = app?.object?.uuid || app?.document?.uuid || app?.options?.uuid || null;
    if (uuid) {
      try {
        const d = await fromUuid(uuid);
        const doc = d?.document ?? d;
        if (doc?.update) return doc;
      } catch (e) {}
    }

    // 3) Fallback: match by name field in the form.
    try {
      const el = app?.element instanceof jQuery ? app.element[0] : app?.element;
      const root = el?.querySelector?.(".bbttcc-hex-config");
      const nameInput = root?.querySelector?.("input[name='name']");
      const nm = nameInput?.value?.trim();
      if (nm) {
        const hit = (canvas.drawings?.placeables || []).find(p => {
          const n = p?.document?.text || p?.document?.name;
          return String(n || "").trim() === nm;
        });
        return hit?.document ?? null;
      }
    } catch (e) {}

    return null;
  }

  function injectButtons(app, html) {
    const buApi = getBUApi();
    if (!buApi || typeof buApi.spendForAction !== "function") {
      return;
    }

    const el = html instanceof jQuery ? html[0] : html;
    if (!el) return;

    const root = el.querySelector(".bbttcc-hex-config");
    if (!root) return; // not our app

    // Avoid double-inject
    if (root.querySelector("[data-bbttcc='bu-buttons']")) return;

    // Find a reasonable insertion point (after modifiers heading if possible)
    let modifiersBlock = root.querySelector(".form-group[data-bbttcc='modifiers']") ||
                         root.querySelector(".modifiers") ||
                         root.querySelector(".modifiers-section");

    const row = document.createElement("div");
    row.className = "form-group";
    row.setAttribute("data-bbttcc", "bu-buttons");
    row.innerHTML = `
      <label>Build Units (Engineering)</label>
      <div class="bbttcc-bu-button-row" style="display:flex; gap:0.35rem; flex-wrap:wrap;">
        <button type="button" data-bu-action="fortify" class="bbttcc-btn bu-btn-fortify">
          Fortify Hex (BU)
        </button>
        <button type="button" data-bu-action="repair" class="bbttcc-btn bu-btn-repair">
          Repair Hex (BU)
        </button>
        <button type="button" data-bu-action="asset" class="bbttcc-btn bu-btn-asset">
          Build Asset (BU)
        </button>
      </div>
      <p class="hint">
        Spend Build Units from the owning faction to reinforce or repair this hex.
        Costs are defined in BBTTCC Territory settings.
      </p>
    `;

    if (modifiersBlock && modifiersBlock.parentElement) {
      modifiersBlock.parentElement.insertBefore(row, modifiersBlock.nextSibling);
    } else {
      root.appendChild(row);
    }

    // Wire click handlers
    row.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("button[data-bu-action]");
      if (!btn) return;
      ev.preventDefault();

      const action = btn.getAttribute("data-bu-action");
      try {
        const hexDoc = await resolveHexDocument(app);
        if (!hexDoc) {
          ui.notifications?.warn?.("Build Units: Could not resolve hex document for this editor.");
          return;
        }
        const tf = hexDoc.flags?.[MOD_T] || {};
        const factionId = tf.factionId || tf.ownerId || null;
        if (!factionId) {
          ui.notifications?.warn?.("Build Units: This hex is not currently owned by a faction.");
          return;
        }

        const note = `Hex Config button: ${action}`;
        const res = await buApi.spendForAction({
          factionId,
          hexUuid: hexDoc.uuid,
          action,
          note
        });
          return;
        }

        const api = game.bbttcc && game.bbttcc.api && game.bbttcc.api.gm;
        if (!api || typeof api.setHex !== "function") {
          ui.notifications?.error?.("GM API not available (bbttcc-core Phase 1 missing).");
          return;
        }

        const note = String(val("gm.note") || "").trim();

        if (action === "clear") {
          await api.setHex({
            hexUuid: doc.uuid,
            patch: {
              travel: { unitsOverride: null },
              development: { stage: null, locked: null },
              alarm: { value: null, locked: null },
              campaign: { onEnterBeatId: null }
            },
            note: note || "Clear hex overrides"
          });
          app.render(true);
          return;
        }

        if (action === "apply") {
          const patch = {};
          const uo = val("gm.travel.unitsOverride").trim();
          if (uo !== "") patch.travel = Object.assign(patch.travel || {}, { unitsOverride: Number(uo) });

          const st = val("gm.development.stage").trim();
          patch.development = patch.development || {};
          if (st !== "") patch.development.stage = Number(st);
          patch.development.locked = checked("gm.development.locked");

          const av = val("gm.alarm.value").trim();
          patch.alarm = patch.alarm || {};
          if (av !== "") patch.alarm.value = Number(av);
          patch.alarm.locked = checked("gm.alarm.locked");

          const beat = val("gm.campaign.onEnterBeatId").trim();
          if (beat !== "") patch.campaign = Object.assign(patch.campaign || {}, { onEnterBeatId: beat });

          await api.setHex({ hexUuid: doc.uuid, patch: patch, note: note || "GM edit hex" });
          app.render(true);
        }
      });
    }
  }
} catch (e) {
  console.warn(TAG, "GM panel inject failed", e);
}
        if (res?.ok) {
          // Re-render the app so modifiers & flags refresh
          app.render(false);
        }
      } catch (e) {
        warn("BU button handler failed:", e);
        ui.notifications?.error?.("Build Units action failed — see console.");
      }
    });

    log("Injected Build Unit buttons into Hex Config.");
  

    // Phase 2: GM Manual Edit panel (render-time)
    injectGMPanel(app, html, el);
}

  function install() {
    Hooks.on("renderApplication", (app, html) => {
      try {
        injectButtons(app, html);
      } catch (e) {
        warn("renderApplication handler failed:", e);
      }
    });

    console.log(TAG, "Hex Config BU enhancer installed.");
  }

  Hooks.once("ready", install);
  try { if (game?.ready) install(); } catch {}

})();
