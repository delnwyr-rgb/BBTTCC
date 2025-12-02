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
