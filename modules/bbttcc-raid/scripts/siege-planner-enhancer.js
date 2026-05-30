// bbttcc-raid/scripts/siege-planner-enhancer.js
// SIEGE_RAID_TYPE_SPEC.md Phase A.5 — Planner UI extensions for siege activities.
//
// Hooks renderApplicationV2 for the ActivityPlanner (id="bbttcc-activity-planner").
// When the selected activity has flags.bbttcc.siegeRequiresTarget, inject:
//   - Size dial (Skirmish / Standard / Protracted / Epic)
//   - Depot picker (dropdown of attacker's owned hexes; live validateDepot indicator)
//   - Intent picker (Sack / Raze / Capture)
//   - Layer preview (read-only list of layers from target hex's structureActorIds)
// On Plan Activity click, serialize siege config to noteInput.value as JSON
// — the existing planActivity flow passes this through to the begin_siege handler.

(() => {
  const TAG = "[bbttcc/siege-planner-ui]";
  const MOD_R = "bbttcc-raid";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const PLANNER_ID = "bbttcc-activity-planner";

  globalThis.__bbttcc_siege_planner_ui_loaded_v1 = Date.now();

  // ---- State per planner instance ----
  // Stored on the planner app instance as __siegeCfg = { sizeProfile, depotHexUuid, intent, _activityFlags }
  function _getCfg(app){
    if (!app.__siegeCfg) app.__siegeCfg = {
      sizeProfile: "standard",
      depotHexUuid: "",
      intent: "sack"
    };
    return app.__siegeCfg;
  }

  function _resetCfg(app){ app.__siegeCfg = null; }

  // ---- Helpers ----

  async function _loadCatalogActivities(){
    try {
      const mod = game.modules.get(MOD_R);
      const base = (mod?.url || mod?.path || `/modules/${MOD_R}`).replace(/\/+$/, "");
      const r = await fetch(`${base}/data/bbttcc_activities_v1_4.json`, { cache: "force-cache" });
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  }

  function _deriveKeyFromName(name){
    let s = String(name || "").toLowerCase();
    s = s.replace(/\[[^\]]+\]/g, "");
    s = s.replace(/['']/g, "");
    s = s.replace(/[^a-z0-9]+/g, "_");
    s = s.replace(/^_+|_+$/g, "");
    return s;
  }

  let _catalogCache = null;
  async function _findActivityByKey(key){
    if (!_catalogCache) _catalogCache = await _loadCatalogActivities();
    return _catalogCache.find(e => {
      const k = e?.flags?.bbttcc?.activityKey || _deriveKeyFromName(e?.name);
      return k === key;
    });
  }

  function _activityHasFlag(entry, flagName){
    return !!entry?.flags?.bbttcc?.[flagName];
  }

  function _listFactionOwnedHexes(factionId){
    if (!factionId) return [];
    const out = [];
    for (const scene of (game.scenes || [])) {
      const colls = [scene.drawings, scene.notes, scene.tokens, scene.tiles];
      for (const coll of colls) {
        if (!coll) continue;
        for (const doc of coll) {
          const f = doc?.flags?.[MOD_T];
          if (!f?.isHex) continue;
          const ownerId = f.factionId || f.ownerFactionId || f.controllerFactionId;
          if (ownerId === factionId) {
            out.push({
              uuid: doc.uuid,
              name: f.name || doc.id || "Hex",
              sceneName: scene.name,
              doc
            });
          }
        }
      }
    }
    return out;
  }

  async function _loadTargetHexLayers(targetUuid){
    if (!targetUuid) return [];
    try {
      const ref = await fromUuid(targetUuid);
      const doc = ref?.document ?? ref;
      const ids = doc?.flags?.[MOD_T]?.structureActorIds;
      if (!Array.isArray(ids)) return [];
      return ids.map((aid, idx) => {
        const actor = game.actors.get(aid);
        return {
          layerIdx: idx,
          structureActorId: aid,
          name: actor?.name || `(missing actor ${aid})`,
          missing: !actor
        };
      });
    } catch { return []; }
  }

  // ---- UI builder ----

  function _buildSiegePanel(app, root){
    // Find the noteInput so we can insert above it
    const noteInput = root.querySelector('input[data-role="note"]');
    if (!noteInput) return null;
    const noteWrap = noteInput.parentElement;

    // Remove any prior panel first (re-render safety)
    const prior = root.querySelector('[data-siege-config-panel]');
    if (prior) prior.remove();

    const cfg = _getCfg(app);
    const ps = app._plannerState || {};
    const attackerId = ps.factionId || ps.attackerId || null;
    const attackerActor = attackerId ? game.actors.get(attackerId) : null;
    const targetUuid = ps.selectedHexUuid || "";

    const panel = document.createElement("div");
    panel.dataset.siegeConfigPanel = "1";
    panel.style.cssText = `
      margin-top: 8px;
      padding: 8px 10px;
      border: 1px solid rgba(220, 38, 38, 0.4);
      background: rgba(127, 29, 29, 0.18);
      border-radius: 6px;
      font-size: 0.78rem;
    `;

    const header = document.createElement("div");
    header.style.cssText = "font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;color:#fca5a5;";
    header.textContent = "⚔ Siege Configuration";
    panel.appendChild(header);

    // ---- Size dial ----
    const sizeRow = document.createElement("div");
    sizeRow.style.cssText = "display:flex;gap:4px;align-items:center;margin-bottom:6px;";
    const sizeLabel = document.createElement("span");
    sizeLabel.textContent = "Size:";
    sizeLabel.style.cssText = "opacity:0.8;min-width:50px;";
    sizeRow.appendChild(sizeLabel);

    const sizes = [
      { key: "skirmish",   label: "Skirmish",   detail: "~3 turns" },
      { key: "standard",   label: "Standard",   detail: "~6 turns" },
      { key: "protracted", label: "Protracted", detail: "~12 turns" },
      { key: "epic",       label: "Epic",       detail: "~20 turns" }
    ];
    for (const s of sizes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${s.label} (${s.detail})`;
      btn.dataset.siegeSize = s.key;
      btn.style.cssText = `
        padding: 2px 8px; font-size: 0.72rem; border-radius: 4px; cursor: pointer;
        background: ${cfg.sizeProfile === s.key ? 'rgba(220,38,38,0.35)' : 'rgba(15,23,42,0.55)'};
        border: 1px solid ${cfg.sizeProfile === s.key ? 'rgba(248,113,113,0.7)' : 'rgba(148,163,184,0.35)'};
        color: ${cfg.sizeProfile === s.key ? '#fecaca' : '#cbd5e1'};
      `;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        cfg.sizeProfile = s.key;
        _buildSiegePanel(app, root);   // re-render panel only
      });
      sizeRow.appendChild(btn);
    }
    panel.appendChild(sizeRow);

    // ---- Depot picker ----
    const depotRow = document.createElement("div");
    depotRow.style.cssText = "display:flex;gap:4px;align-items:center;margin-bottom:6px;";
    const depotLabel = document.createElement("span");
    depotLabel.textContent = "Depot:";
    depotLabel.style.cssText = "opacity:0.8;min-width:50px;";
    depotRow.appendChild(depotLabel);

    const depotSel = document.createElement("select");
    depotSel.style.cssText = "flex:1;padding:2px 4px;font-size:0.74rem;";
    const depotEmpty = document.createElement("option");
    depotEmpty.value = "";
    depotEmpty.textContent = attackerActor ? "— pick a depot —" : "(select faction first)";
    depotSel.appendChild(depotEmpty);

    const ownedHexes = _listFactionOwnedHexes(attackerId);
    const validationStatus = document.createElement("span");
    validationStatus.style.cssText = "font-size:0.7rem;padding:2px 6px;border-radius:3px;min-width:60px;text-align:center;";

    const siegeAPI = game.bbttcc?.api?.siege;
    for (const h of ownedHexes) {
      const opt = document.createElement("option");
      opt.value = h.uuid;
      let validationGlyph = "";
      if (siegeAPI?.validateDepot) {
        const v = siegeAPI.validateDepot(h.doc, attackerId);
        validationGlyph = v.ok ? " ✓" : " ✗";
        opt.title = v.ok ? "Qualifies as depot" : v.reason;
      }
      opt.textContent = `${h.name}${validationGlyph} — ${h.sceneName}`;
      depotSel.appendChild(opt);
    }
    depotSel.value = cfg.depotHexUuid || "";

    function _updateValidationStatus(){
      if (!cfg.depotHexUuid) {
        validationStatus.textContent = "—";
        validationStatus.style.background = "rgba(148,163,184,0.25)";
        validationStatus.style.color = "#cbd5e1";
        return;
      }
      const h = ownedHexes.find(x => x.uuid === cfg.depotHexUuid);
      if (!h || !siegeAPI?.validateDepot) {
        validationStatus.textContent = "?";
        return;
      }
      const v = siegeAPI.validateDepot(h.doc, attackerId);
      if (v.ok) {
        validationStatus.textContent = "✓ qualified";
        validationStatus.style.background = "rgba(22,163,74,0.3)";
        validationStatus.style.color = "#bbf7d0";
        validationStatus.title = "";
      } else {
        validationStatus.textContent = "✗ rejected";
        validationStatus.style.background = "rgba(220,38,38,0.3)";
        validationStatus.style.color = "#fecaca";
        validationStatus.title = v.reason || "";
      }
    }
    _updateValidationStatus();

    depotSel.addEventListener("change", () => {
      cfg.depotHexUuid = depotSel.value;
      _updateValidationStatus();
    });
    depotRow.appendChild(depotSel);
    depotRow.appendChild(validationStatus);
    panel.appendChild(depotRow);

    // ---- Intent picker ----
    const intentRow = document.createElement("div");
    intentRow.style.cssText = "display:flex;gap:4px;align-items:center;margin-bottom:6px;";
    const intentLabel = document.createElement("span");
    intentLabel.textContent = "Intent:";
    intentLabel.style.cssText = "opacity:0.8;min-width:50px;";
    intentRow.appendChild(intentLabel);

    const intents = [
      { key: "sack",    label: "Sack",    detail: "Loot but don't occupy" },
      { key: "raze",    label: "Raze",    detail: "Destroy holdings" },
      { key: "capture", label: "Capture", detail: "Take hex intact" }
    ];
    for (const i of intents) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = i.label;
      btn.title = i.detail;
      btn.dataset.siegeIntent = i.key;
      btn.style.cssText = `
        padding: 2px 10px; font-size: 0.72rem; border-radius: 4px; cursor: pointer;
        background: ${cfg.intent === i.key ? 'rgba(220,38,38,0.35)' : 'rgba(15,23,42,0.55)'};
        border: 1px solid ${cfg.intent === i.key ? 'rgba(248,113,113,0.7)' : 'rgba(148,163,184,0.35)'};
        color: ${cfg.intent === i.key ? '#fecaca' : '#cbd5e1'};
      `;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        cfg.intent = i.key;
        _buildSiegePanel(app, root);
      });
      intentRow.appendChild(btn);
    }
    panel.appendChild(intentRow);

    // ---- Layer preview ----
    const layerRow = document.createElement("div");
    layerRow.style.cssText = "margin-top:4px;font-size:0.72rem;opacity:0.9;";
    const layerHead = document.createElement("div");
    layerHead.style.cssText = "opacity:0.7;margin-bottom:2px;";
    layerHead.textContent = `Layers (from target hex's structureActorIds):`;
    layerRow.appendChild(layerHead);
    const layerList = document.createElement("ol");
    layerList.style.cssText = "margin:0;padding-left:18px;";
    layerRow.appendChild(layerList);

    _loadTargetHexLayers(targetUuid).then(layers => {
      if (!layers.length) {
        const li = document.createElement("li");
        li.style.cssText = "opacity:0.6;list-style:none;margin-left:-18px;";
        li.textContent = targetUuid
          ? "⚠ Target hex has no structureActorIds — Begin Siege will fail. Populate the hex via Found Fortress or manual edit."
          : "(select a target hex to see layers)";
        layerList.appendChild(li);
      } else {
        for (const l of layers) {
          const li = document.createElement("li");
          li.style.cssText = l.missing ? "color:#fca5a5;" : "color:#cbd5e1;";
          li.textContent = `${l.name}${l.missing ? " (missing)" : ""}`;
          layerList.appendChild(li);
        }
      }
    });
    panel.appendChild(layerRow);

    // ---- Footer hint ----
    const hint = document.createElement("div");
    hint.style.cssText = "margin-top:6px;font-size:0.68rem;opacity:0.65;font-style:italic;";
    hint.textContent = "Siege config is serialized into the Note field as JSON on Plan Activity.";
    panel.appendChild(hint);

    // Insert above noteWrap
    noteWrap.parentElement.insertBefore(panel, noteWrap);
    return panel;
  }

  // ---- Plan-button capture interceptor (serializes cfg into note BEFORE planner reads it) ----

  function _wirePlanButtonInterceptor(app, root){
    if (root.__siegePlanIntercept) return;
    root.__siegePlanIntercept = true;

    const handler = (ev) => {
      const btn = ev.target?.closest?.('[data-act="plan"]');
      if (!btn) return;
      // Are we currently in a siege activity?
      const ps = app._plannerState;
      if (!ps?.selectedKey) return;
      _findActivityByKey(ps.selectedKey).then(actEntry => {
        if (!_activityHasFlag(actEntry, "siegeRequiresTarget")) return;
        // Yes — serialize cfg into note input.
        const cfg = _getCfg(app);
        const noteInput = root.querySelector('input[data-role="note"]');
        if (!noteInput) return;
        const userNote = noteInput.value || "";
        const payload = {
          sizeProfile: cfg.sizeProfile,
          depotHexUuid: cfg.depotHexUuid,
          intent: cfg.intent,
          gmNote: userNote
        };
        noteInput.value = JSON.stringify(payload);
      }).catch(err => console.warn(TAG, "plan-intercept error", err));
    };

    // Capture phase — runs before the planner's own click handler on `wrap`.
    root.addEventListener("click", handler, true);
  }

  // ---- Render hook ----

  async function _onPlannerRender(app, element){
    if (app?.id !== PLANNER_ID) return;
    const root = element?.[0] ?? element;
    if (!root || typeof root.querySelector !== "function") return;

    const ps = app._plannerState || {};
    const selectedKey = ps.selectedKey;
    if (!selectedKey) {
      _resetCfg(app);
      return;
    }

    // Detect siege activities robustly from the in-memory EFFECTS registry first
    // (siegeRequiresTarget is set on EFFECTS.begin_siege / establish_siege_camp at
    // registration). Fall back to the JSON catalog fetch only if EFFECTS is bare —
    // the fetch can silently 404 depending on module.url, which previously left the
    // siege config panel (size dial + depot picker) from ever rendering.
    const eff = game.bbttcc?.api?.raid?.EFFECTS?.[String(selectedKey).toLowerCase()];
    let isSiege = !!eff?.siegeRequiresTarget;
    if (!isSiege) {
      const actEntry = await _findActivityByKey(selectedKey);
      isSiege = _activityHasFlag(actEntry, "siegeRequiresTarget");
    }
    if (!isSiege) {
      // Not a siege activity — strip any prior panel
      const prior = root.querySelector('[data-siege-config-panel]');
      if (prior) prior.remove();
      _resetCfg(app);
      return;
    }

    _buildSiegePanel(app, root);
    _wirePlanButtonInterceptor(app, root);
  }

  Hooks.on("renderApplicationV2", _onPlannerRender);
  // Older bridge: some Foundry V13 builds still fire renderApplication for V2 apps
  Hooks.on("renderApplication", _onPlannerRender);

  console.log(TAG, "loaded");
})();
