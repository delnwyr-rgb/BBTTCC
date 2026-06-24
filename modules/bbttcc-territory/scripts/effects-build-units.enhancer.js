// modules/bbttcc-territory/scripts/hex-config-build-units.enhancer.js
// Bad Eden — Hex Config Build Unit Buttons
//
// Adds three buttons to the Bad Eden Hex Configuration UI:
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

  async function injectButtons(app, html) {
    // BU surface migrated 2026-05-09 to Hex Sheet → Overview tab (player-accessible).
    // Foundry's drawing-config (Hex Editor) is GM-only, so the BU buttons here
    // were unreachable for players. Single canonical surface now lives in
    // bbttcc-hex-sheet.enhancer.js + templates/hex-sheet.hbs.
    return;

    /* eslint-disable no-unreachable */
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

    // Resolve owning faction + read live BU balance for the panel header / button gating.
    let balance = null;
    let factionName = null;
    try {
      const hexDoc0 = await resolveHexDocument(app);
      const tf0 = hexDoc0?.flags?.[MOD_T] || {};
      const fid = tf0.factionId || tf0.ownerId || null;
      if (fid) {
        const A = game.actors?.get(fid);
        if (A) {
          balance = Math.max(0, Math.floor(Number(A.getFlag("bbttcc-factions", "buildUnits") ?? 0) || 0));
          factionName = A.name;
        }
      }
    } catch (_e) {}

    // Live costs (world settings, defaults match territory-build-units.enhancer.js).
    const cFort = Math.max(0, Number(game.settings.get(MOD_T, "buildUnitCostFortify") ?? 2) || 0);
    const cRep  = Math.max(0, Number(game.settings.get(MOD_T, "buildUnitCostRepair") ?? 1) || 0);
    const cAss  = Math.max(0, Number(game.settings.get(MOD_T, "buildUnitCostAsset") ?? 3) || 0);

    const noOwner = balance === null;
    const balText = noOwner ? "—" : String(balance);
    const balTip  = noOwner
      ? "No owning faction set on this hex; balance is unavailable."
      : `Owning faction: ${factionName} · Build Units available: ${balance}`;
    const dis = (cost) => (noOwner || balance < cost);
    const tip = (cost, label) => {
      if (noOwner) return "No owning faction set on this hex.";
      if (balance < cost) return `Need ${cost} BU; you have ${balance}.`;
      return `${label} — spends ${cost} BU.`;
    };

    // Find a reasonable insertion point (after modifiers heading if possible)
    let modifiersBlock = root.querySelector(".form-group[data-bbttcc='modifiers']") ||
                         root.querySelector(".modifiers") ||
                         root.querySelector(".modifiers-section");

    const row = document.createElement("div");
    row.className = "form-group";
    row.setAttribute("data-bbttcc", "bu-buttons");
    row.innerHTML = `
      <label style="display:flex; align-items:center; justify-content:space-between; gap:.6rem;">
        <span>Build Units (Engineering)</span>
        <span class="bbttcc-bu-balance" data-tooltip="${htmlEscape(balTip)}"
              style="display:inline-flex; align-items:center; gap:.3rem; padding:.1rem .5rem; border:1px solid rgba(232,200,74,.45); border-radius:10px; font-size:11px; color:#e8c84a; background:rgba(232,200,74,.08); white-space:nowrap;">
          <i class="fas fa-hammer" style="font-size:10px; opacity:.85;"></i>
          BU: <b>${htmlEscape(balText)}</b>
        </span>
      </label>
      <div class="bbttcc-bu-button-row" style="display:flex; gap:0.35rem; flex-wrap:wrap;">
        <button type="button" data-bu-action="fortify" class="bbttcc-btn bu-btn-fortify"
                ${dis(cFort) ? "disabled" : ""} data-tooltip="${htmlEscape(tip(cFort, "Fortify Hex"))}">
          Fortify Hex — ${cFort} BU
        </button>
        <button type="button" data-bu-action="repair" class="bbttcc-btn bu-btn-repair"
                ${dis(cRep) ? "disabled" : ""} data-tooltip="${htmlEscape(tip(cRep, "Repair Hex"))}">
          Repair Hex — ${cRep} BU
        </button>
        <button type="button" data-bu-action="asset" class="bbttcc-btn bu-btn-asset"
                ${dis(cAss) ? "disabled" : ""} data-tooltip="${htmlEscape(tip(cAss, "Build Asset"))}">
          Build Asset — ${cAss} BU
        </button>
      </div>
      <p class="hint">
        ${noOwner
          ? "This hex has no owning faction; assign one before spending BU."
          : "Spends Build Units from the owning faction. Generated end-of-turn from owned-hex Materials pips (every 2 pips → 1 BU)."}
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



// ---------------- GM: Manual Edit (Phase 2) ----------------
try {
  if (gmEditEnabled() && !root.querySelector("[data-bbttcc='gm-edit-panel']")) {
    const doc = await resolveHexDocument(app);
    if (doc && doc.uuid) {
      const tf = doc.getFlag ? (doc.getFlag(MOD_T, "") || null) : null;
      const flags = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};
      const travel = flags.travel || {};
      const dev = flags.development || {};
      const integ = flags.integration || {};
      const alarm = flags.alarm || {};
      const camp = flags.campaign || {};

      const wrap = document.createElement("fieldset");
      wrap.setAttribute("data-bbttcc", "gm-edit-panel");
      wrap.style.marginTop = "0.75rem";
      wrap.innerHTML = `
        <legend>GM: Manual Edit</legend>

        <div class="form-group">
          <label>Hex UUID</label>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <input type="text" readonly value="${htmlEscape(doc.uuid)}" style="flex:1;">
            <button type="button" class="bbttcc-btn" data-gm-action="copy-uuid">Copy</button>
          </div>
          <p class="hint">This panel is GM-only and only appears when GM Edit Mode is enabled (bbttcc-core).</p>
        </div>

        <div class="form-group">
          <label>Travel Units Override</label>
          <input type="number" min="0" max="99" step="1" name="gm.travel.unitsOverride" value="${htmlEscape(numOrBlank(travel.unitsOverride))}">
          <p class="hint">Blank = no change. Clear removes override.</p>
        </div>

        <div class="form-group">
          <label>Development Stage</label>
          <input type="number" min="0" max="6" step="1" name="gm.development.stage" value="${htmlEscape(numOrBlank(dev.stage != null ? dev.stage : integ.progress))}">
          <p class="hint">Writes development.stage and integration.progress (0–6).</p>
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
      function val(name){
        const el = q(`[name="${name}"]`);
        return el ? (el.value || "") : "";
      }
      function checked(name){
        const el = q(`[name="${name}"]`);
        return !!(el && el.checked);
      }

      wrap.addEventListener("click", async (ev2) => {
        const btn = ev2.target && ev2.target.closest ? ev2.target.closest("button[data-gm-action]") : null;
        if (!btn) return;
        ev2.preventDefault();
        const action = btn.getAttribute("data-gm-action");

        if (action === "copy-uuid") {
          try {
            await navigator.clipboard.writeText(doc.uuid);
            ui.notifications?.info?.("Copied Hex UUID to clipboard.");
          } catch (e) {
            console.warn(TAG, "copy uuid failed", e);
            ui.notifications?.warn?.("Could not copy UUID (see console).");
          }
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
  }

  // ── Scene Links (water + air verticals, 2026-06-23) ─────────────────────────
  // Generic per-band Scene linker injected into the Hex Config. Picks a pre-built
  // Scene for each band; linking stamps the target scene's environment flag
  // (flags.fourththing.<envFlag> = { band }) + a ⬅ return link + auto-enables the
  // 3D elevation tableau, and records the band→scene map on the hex
  // (flags.bbttcc-travel.<flagKey>). DEPTH_CFG (water→dive) + ALT_CFG (air→ascend).
  const WATER_KEYS = new Set(["river", "lake", "sea", "ocean", "reef", "depths", "abyss"]);
  const UNDERWATER_KEYS = new Set(["reef", "depths", "abyss"]);

  async function _resolveTravelFaction(verb) {
    const tok = canvas.tokens?.controlled?.[0]?.actor;
    const fid = tok && foundry.utils.getProperty(tok, "flags.bbttcc-factions.factionId");
    if (fid && game.actors.get(fid)) return fid;
    const factions = game.actors.filter(a => a?.getFlag?.("bbttcc-factions", "isFaction"));
    if (!factions.length) return null;
    const list = factions.slice().sort((a, b) => a.name.localeCompare(b.name));
    return await new Promise((resolve) => {
      const opts = list.map(f => `<option value="${f.id}">${htmlEscape(f.name)}</option>`).join("");
      new Dialog({
        title: `${verb} — choose faction`,
        content: `<p>Which faction?</p><select id="sl-fac" style="width:100%;">${opts}</select>`,
        buttons: { ok: { label: verb, callback: (h) => resolve(h[0].querySelector("#sl-fac")?.value || null) },
                   cancel: { label: "Cancel", callback: () => resolve(null) } },
        default: "ok", close: () => resolve(null)
      }).render(true);
    });
  }

  function injectSceneLinks(app, html, el, cfg) {
    try {
      if (!game.user?.isGM) return;
      const root = el || (html instanceof jQuery ? html[0] : html);
      // ONLY inject into the Hex Configuration form. No `|| root` fallback —
      // that leaked the panel onto every other window (character sheets, macro
      // editor, …) that lacks a .bbttcc-hex-config host.
      const host = root?.querySelector?.(".bbttcc-hex-config");
      if (!host || host.querySelector(`[data-bbttcc='${cfg.id}']`)) return;

      Promise.resolve(resolveHexDocument(app, html)).then(async (doc) => {
        if (!doc || !doc.uuid) return;
        // Defense in depth: the resolver can return whatever document the app
        // owns (an Actor for a sheet, a Macro, …). Only a territory hex Drawing
        // gets the links.
        if (doc.documentName !== "Drawing") return;
        const tf = (doc.flags && doc.flags[MOD_T]) ? doc.flags[MOD_T] : {};
        const rawTerr = tf.terrain?.key || tf.terrainKey || tf.terrainType || tf.terrain || "";
        const norm = game.bbttcc?.api?.territory?.normalizeTerrainKey?.(rawTerr) || String(rawTerr || "").toLowerCase();
        if (!cfg.showFor(norm)) return;
        if (host.querySelector(`[data-bbttcc='${cfg.id}']`)) return;

        const links = (doc.flags?.["bbttcc-travel"]?.[cfg.flagKey] && typeof doc.flags["bbttcc-travel"][cfg.flagKey] === "object")
          ? doc.flags["bbttcc-travel"][cfg.flagKey] : {};
        const selfSceneId = doc.parent?.id || null;
        const scenes = (game.scenes?.contents || []).filter(s => s.id !== selfSceneId).sort((a, b) => a.name.localeCompare(b.name));

        const rowFor = (band) => {
          const cur = links[band.key] || "";
          const linked = !!cur;
          const opts = [`<option value="">— none —</option>`]
            .concat(scenes.map(s => `<option value="${s.uuid}" ${s.uuid === cur ? "selected" : ""}>${htmlEscape(s.name)}</option>`))
            .join("");
          return `
            <div class="form-group" style="margin:0.3rem 0;">
              <label style="font-size:11px;">${band.label} <span style="opacity:0.6;">— ${band.note}</span></label>
              <div style="display:flex; gap:0.35rem; align-items:center;">
                <select name="sl.${band.key}" style="flex:1;">${opts}</select>
                <button type="button" class="bbttcc-btn" data-sl-link="${band.key}">Link</button>
                <button type="button" class="bbttcc-btn" data-sl-open="${band.key}" ${linked ? "" : "disabled"}>Open</button>
                <button type="button" class="bbttcc-btn" data-sl-go="${band.key}" ${linked ? "" : "disabled"}>${cfg.verb}</button>
              </div>
            </div>`;
        };

        const wrap = document.createElement("fieldset");
        wrap.setAttribute("data-bbttcc", cfg.id);
        wrap.style.cssText = `margin-top:0.75rem; border:1px solid ${cfg.border}; border-radius:0.75rem; padding:0.6rem 0.7rem 0.65rem; background:${cfg.bg};`;
        wrap.innerHTML = `
          <legend style="padding:0 0.25rem; opacity:0.9; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:${cfg.color};">${cfg.legend}</legend>
          <p class="hint" style="margin:0 0 0.4rem;">${cfg.hint}</p>
          ${cfg.bands.map(rowFor).join("")}
        `;
        host.appendChild(wrap);

        wrap.addEventListener("click", async (ev) => {
          const btn = ev.target?.closest?.("button[data-sl-link],button[data-sl-open],button[data-sl-go]");
          if (!btn) return;
          ev.preventDefault(); ev.stopPropagation();
          const band = btn.getAttribute("data-sl-link") || btn.getAttribute("data-sl-open") || btn.getAttribute("data-sl-go");
          const sel = wrap.querySelector(`select[name="sl.${band}"]`);

          if (btn.hasAttribute("data-sl-link")) {
            try {
              const sceneUuid = sel?.value || "";
              const map = { ...(doc.flags?.["bbttcc-travel"]?.[cfg.flagKey] || {}) };
              if (sceneUuid) {
                const scene = await fromUuid(sceneUuid);
                if (scene?.update) {
                  const sceneUpdate = {
                    [`flags.fourththing.${cfg.envFlag}`]: { band },
                    "flags.bbttcc-travel.returnLink": { targetSceneUuid: doc.parent?.uuid, label: cfg.returnLabel },
                    "flags.bbttcc-travel.hexScene": true,
                    // Origin hex + surface scene — lets Surface/Descend step UP one
                    // band at a time (reef→surface, abyss→deep→reef→surface).
                    "flags.bbttcc-travel.diveOrigin": { hexUuid: doc.uuid, surfaceSceneUuid: doc.parent?.uuid, env: cfg.envFlag }
                  };
                  if (!scene.flags?.["bbttcc-raid"]?.tableau) {
                    sceneUpdate["flags.bbttcc-raid.tableau"] = {
                      enabled: true, axis: "elevation", depthSource: "elevation", baseElevation: 0,
                      // Scene-top (surface/ceiling) biggest, ground (elev 0) mid,
                      // deeper = smaller. Render pinned so depth never sinks the token.
                      nearElev: 40, farElev: -40, minScale: 0.35, maxScale: 1.25, curve: 1.5, zSortByY: true
                    };
                  }
                  await scene.update(sceneUpdate);
                }
                map[band] = sceneUuid;
                ui.notifications?.info?.(`Linked ${band} → "${scene?.name || sceneUuid}" (3D depth on).`);
              } else {
                delete map[band];
                ui.notifications?.info?.(`Unlinked ${band}.`);
              }
              await doc.update({ [`flags.bbttcc-travel.${cfg.flagKey}`]: map });
              app.render(false);
            } catch (e) { warn(`${cfg.id} link failed`, e); ui.notifications?.error?.("Link failed — see console."); }
            return;
          }
          if (btn.hasAttribute("data-sl-open")) {
            try { const sc = await fromUuid(sel?.value); if (sc?.view) await sc.view(); } catch (e) { warn("open scene failed", e); }
            return;
          }
          if (btn.hasAttribute("data-sl-go")) {
            const fn = game.bbttcc?.api?.travel?.[cfg.apiName];
            if (!fn) { ui.notifications?.error?.(`${cfg.verb} API not ready.`); return; }
            const factionId = await _resolveTravelFaction(cfg.verb);
            if (!factionId) return;
            const res = await fn(factionId, doc.uuid, { band });
            if (res?.ok) ui.notifications?.info?.(`${cfg.verb} → ${res.band}…`);
            else if (res?.message) ui.notifications?.warn?.(res.message);
            return;
          }
        });

        log(`Injected ${cfg.id} into Hex Config.`);
      });
    } catch (e) { warn(`${cfg.id} inject failed`, e); }
  }

  const DEPTH_CFG = {
    id: "depth-links", legend: "🌊 Underwater — Depth Links", color: "#9ad7ff",
    border: "rgba(31,143,221,0.55)", bg: "linear-gradient(160deg, rgba(8,30,45,0.98), rgba(10,40,58,1))",
    hint: "Link a pre-built scene to each depth. Linking marks it underwater + adds a ⬅ Surface return + 3D depth. Diving needs a submersible rated for the band (reef 1 · deep 2 · abyss 3).",
    bands: [
      { key: "reef",  label: "Reef",   note: "shallow · Submerged + ½ move, no pressure" },
      { key: "deep",  label: "Depths", note: "deep · Crushing 1d4/turn (unrated)" },
      { key: "abyss", label: "Abyss",  note: "crushing · 1d6/turn (unrated)" }
    ],
    flagKey: "diveScenes", envFlag: "underwater", returnLabel: "Surface", verb: "Dive", apiName: "dive",
    showFor: (norm) => WATER_KEYS.has(norm)
  };
  const ALT_CFG = {
    id: "altitude-links", legend: "✈️ Aerial — Altitude Links", color: "#bfe3ff",
    border: "rgba(124,198,255,0.55)", bg: "linear-gradient(160deg, rgba(10,22,40,0.98), rgba(14,30,55,1))",
    hint: "Link a pre-built scene to each altitude. Linking marks it aerial + adds a ⬅ Descend return + 3D depth. Ascending needs a flyer (air); orbit needs a space craft.",
    bands: [
      { key: "sky",          label: "Sky",          note: "low · Airborne, fly-gated move" },
      { key: "stratosphere", label: "Stratosphere", note: "high · thin air, fall if no lift" },
      { key: "orbit",        label: "Orbit",        note: "space · Vacuum 1d6/turn unless sealed" }
    ],
    flagKey: "skyScenes", envFlag: "aloft", returnLabel: "Descend", verb: "Ascend", apiName: "ascend",
    showFor: (_norm) => !UNDERWATER_KEYS.has(_norm)
  };

  function install() {
    // Hook BOTH render events — the Hex Config exists as a V1 Dialog
    // (renderApplication) AND an ApplicationV2 sheet (renderApplicationV2).
    const onRender = (app, html) => {
      try {
        injectButtons(app, html);
      } catch (e) {
        warn("render handler (buttons) failed:", e);
      }
      try {
        const el = (html instanceof jQuery ? html[0] : html);
        injectSceneLinks(app, html, el, DEPTH_CFG);
        injectSceneLinks(app, html, el, ALT_CFG);
      } catch (e) {
        warn("scene-links handler failed:", e);
      }
    };
    Hooks.on("renderApplication", onRender);
    Hooks.on("renderApplicationV2", onRender);

    console.log(TAG, "Hex Config BU enhancer installed (V1 + V2).");
  }

  Hooks.once("ready", install);
  try { if (game?.ready) install(); } catch {}

})();
