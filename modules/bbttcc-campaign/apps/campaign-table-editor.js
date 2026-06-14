// modules/bbttcc-campaign/apps/campaign-table-editor.js
// Bad Eden Campaign Builder - Encounter Table Editor (V1)
//
// Tables select beats. Beats run normally.
// Upgrades:
// - Campaign dropdown + Beat dropdown (filtered)
// - Preview Roll (fires table once)
// - Normalize Weights (optional convenience)

const TAG = "[bbttcc-campaign][TableEditor]";

function _tagArray(tagStr) {
  return String(tagStr || "").split(/\s+/g).map(s => s.trim()).filter(Boolean);
}

function _normalizeTags(tagStr) {
  const arr = _tagArray(tagStr);
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function _safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
}

// Filter: allow encounter beats + talky beats + cinematic beats (to support cinematic->post->encounter chains)
function _isTableEligibleBeat(b) {
  const t = String((b && b.type) || "").trim();
  // NOTE: "travel" here is a beat type (for sorting) not the table scope.
  return (
    t === "encounter" ||
    t === "scene_transition" ||
    t === "dialog" ||
    t === "skill_scene" ||
    t === "cinematic" ||
    t === "post" ||
    t === "travel"
  );
}

function _labelForBeat(campaignId, beatId) {
  try {
    const campApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign;
    const c = campApi && campApi.getCampaign ? campApi.getCampaign(campaignId) : null;
    const beats = Array.isArray(c && c.beats) ? c.beats : [];
    const b = beats.find(x => x && x.id === beatId);
    if (!b) return beatId;
    const lbl = String(b.label || b.title || "").trim();
    return lbl ? lbl : beatId;
  } catch (_err) {
    return beatId;
  }
}

function _labelForTable(tableId) {
  try {
    const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
    const t = tablesApi && tablesApi.getTable ? tablesApi.getTable(tableId) : null;
    const lbl = String((t && t.label) || "").trim();
    return lbl ? lbl : tableId;
  } catch (_err) {
    return tableId;
  }
}

const TERRAIN_OPTIONS = [
  { value: "", label: "(Any)" },
  { value: "plains", label: "Plains" },
  { value: "forest", label: "Forest" },
  { value: "mountains", label: "Mountains" },
  { value: "canyons", label: "Canyons" },
  { value: "swamp", label: "Swamp" },
  { value: "desert", label: "Desert" },
  { value: "river", label: "River" },
  { value: "ocean", label: "Ocean" },
  { value: "ruins", label: "Ruins" },
  { value: "wasteland", label: "Wasteland" }
];

const TIER_OPTIONS = [
  { value: "", label: "(Any)" },
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
  { value: "4", label: "Tier 4" },
  { value: "5", label: "Tier 5" }
];

const REQUIRED_TAG_OPTIONS = [
  { value: "", label: "(None)" },
  { value: "travel", label: "travel" },
  { value: "encounter", label: "encounter" },
  { value: "quest", label: "quest" },
  { value: "faction", label: "faction" },
  { value: "danger.low", label: "danger.low" },
  { value: "danger.mid", label: "danger.mid" },
  { value: "danger.high", label: "danger.high" },
  { value: "settlement", label: "settlement" },
  { value: "wilderness", label: "wilderness" }
];

// --- Travel table identity (structured, fail-proof) -------------------------
// Travel encounter tables MUST be named travel_<terrain>_t<tier> or the engine's
// resolveTravelTableId() (bbttcc-travel/scripts/api.travel.js) can't find them and
// the encounter silently no-fires. We compose the id from dropdowns instead of
// trusting free text. Terrain keys come from the engine's TERRAIN_TABLE (source of
// truth) so the editor and the resolver always agree.

function _canonicalTerrainKeys() {
  try {
    const tt = game.bbttcc?.api?._hexTravel?.TERRAIN_TABLE;
    if (tt && typeof tt === "object") {
      const keys = Object.keys(tt).map(k => String(k).trim()).filter(Boolean);
      if (keys.length) return keys;
    }
  } catch (_e) {}
  // Fallback: the local per-entry terrain list (minus the "(Any)" sentinel).
  return TERRAIN_OPTIONS.map(o => o.value).filter(Boolean);
}

function _travelTerrainOptions() {
  return _canonicalTerrainKeys().map(k => ({
    value: k,
    label: k.charAt(0).toUpperCase() + k.slice(1)
  }));
}

const TRAVEL_TIER_OPTIONS = [
  { value: "1", label: "Tier 1" },
  { value: "2", label: "Tier 2" },
  { value: "3", label: "Tier 3" },
  { value: "4", label: "Tier 4" }
];

// Compose the canonical travel table id from terrain + tier.
function _composeTravelTableId(terrain, tier) {
  const keys = _canonicalTerrainKeys();
  let t = String(terrain || "").trim();
  // Snap to canonical casing if we recognize the terrain (case-insensitive).
  const hit = keys.find(k => k.toLowerCase() === t.toLowerCase());
  if (hit) t = hit;
  const n = Math.max(1, Math.floor(Number(tier) || 1));
  return `travel_${t}_t${n}`;
}

// Parse terrain + tier out of an existing id (tolerant of junk suffixes like _EFyI).
// Returns { terrain, tier } or null.
function _parseTravelTableId(id) {
  const s = String(id || "").trim();
  if (!/^travel_/i.test(s)) return null;
  const rest = s.replace(/^travel_/i, "");
  const m = rest.match(/^(.+?)_t(?:ier)?(\d+)/i);
  if (!m) return null;
  return { terrain: m[1], tier: Number(m[2]) || 1 };
}

// Slugify a free-text (non-travel) id into a safe key: lowercase, [a-z0-9_].
function _slugifyTableId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function _populateSelect(sel, rows, selectedValue) {
  if (!sel) return;

  const target = String(selectedValue == null ? "" : selectedValue).trim();
  sel.innerHTML = "";

  for (const row of rows) {
    const opt = document.createElement("option");
    opt.value = row.value;
    opt.textContent = row.label;
    if (String(row.value) === target) opt.selected = true;
    sel.appendChild(opt);
  }
}

function _hydrateStructuredEntrySelects(rootEl) {
  if (!rootEl) return;

  const rows = rootEl.querySelectorAll("tbody tr");
  for (const tr of rows) {
    const terrainSel = tr.querySelector("select[name='entry-terrain']");
    const tierSel = tr.querySelector("select[name='entry-tier']");
    const reqSel = tr.querySelector("select[name='entry-required-tag']");

    const terrainValue = String(
      (terrainSel && terrainSel.getAttribute("data-current")) ||
      (terrainSel && terrainSel.value) ||
      ""
    ).trim();

    const tierValue = String(
      (tierSel && tierSel.getAttribute("data-current")) ||
      (tierSel && tierSel.value) ||
      ""
    ).trim();

    const reqValue = String(
      (reqSel && reqSel.getAttribute("data-current")) ||
      (reqSel && reqSel.value) ||
      ""
    ).trim();

    _populateSelect(terrainSel, TERRAIN_OPTIONS, terrainValue);
    _populateSelect(tierSel, TIER_OPTIONS, tierValue);
    _populateSelect(reqSel, REQUIRED_TAG_OPTIONS, reqValue);
  }
}

export class BBTTCCCampaignTableEditorApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-table-editor",
      title: "Edit Encounter Table",
      template: "modules/bbttcc-campaign/templates/campaign-table-editor.hbs",
      width: 920,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["bbttcc", "bbttcc-hexchrome", "bbttcc-campaign-table-editor"]
    });
  }

  constructor(options) {
    options = options || {};
    super(options);
    this.tableId = options.tableId || null;
    this.activeTab = options.activeTab || "core";
  }

  async getData(options) {
    options = options || {};
    const data = await super.getData(options);

    const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
    const campApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign;

    const table = this.tableId && tablesApi && tablesApi.getTable
      ? foundry.utils.deepClone(tablesApi.getTable(this.tableId))
      : null;

    const t = table || {
      id: this.tableId || "(new)",
      label: "",
      scope: "global",
      tags: [],
      entries: []
    };

    t.tags = Array.isArray(t.tags) ? t.tags : [];
    t.entries = Array.isArray(t.entries) ? t.entries : [];

    // Transient scope override: when the user switches the Scope dropdown we
    // re-render to swap the Table ID control (text vs terrain/tier) before save.
    if (this._scopeOverride) t.scope = this._scopeOverride;

    const tagsRaw = t.tags.join(" ");
    const scopes = ["global", "travel", "hex", "campaign", "engine"];

    // Travel-scope identity: derive terrain/tier from the current id so the
    // dropdowns pre-select correctly, and expose the canonical option lists.
    const isTravel = String(t.scope || "") === "travel";
    const parsed = _parseTravelTableId(t.id) || { terrain: "", tier: 1 };
    const travelTerrainOptions = _travelTerrainOptions();
    // Snap parsed terrain to a canonical key for the dropdown selection.
    const canonTerrain = travelTerrainOptions.find(o => o.value.toLowerCase() === String(parsed.terrain).toLowerCase());
    const travelTerrain = canonTerrain ? canonTerrain.value : (parsed.terrain || (travelTerrainOptions[0]?.value || "plains"));
    const travelTier = String(parsed.tier || 1);
    const composedId = isTravel ? _composeTravelTableId(travelTerrain, travelTier) : String(t.id || "");

    const campaigns = (campApi && campApi.listCampaigns ? campApi.listCampaigns() : []).map(c => ({
      id: c.id,
      label: c.label || c.title || c.id
    })).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));

    const beatsByCampaign = {};
    for (const c of campaigns) {
      try {
        const cc = campApi && campApi.getCampaign ? campApi.getCampaign(c.id) : null;
        const beats = Array.isArray(cc && cc.beats) ? cc.beats : [];
        beatsByCampaign[c.id] = beats
          .filter(_isTableEligibleBeat)
          .map(b => ({
            id: b.id,
            label: (b.label || b.id) + " (" + (b.type || "beat") + ")"
          }))
          .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
      } catch (_err) {
        beatsByCampaign[c.id] = [];
      }
    }

    const entries = t.entries.map(e => {
      const c = e && e.conditions ? e.conditions : {};
      return {
        campaignId: String((e && e.campaignId) || "").trim(),
        beatId: String((e && e.beatId) || "").trim(),
        weight: Number(e && e.weight != null ? e.weight : 1) || 1,
        terrain: String(c.terrain || "").trim(),
        tier: String(c.tier || "").trim(),
        requiredTag: String(c.requiredTag || "").trim()
      };
    });

    data.table = t;
    data.tableId = this.tableId;
    data.activeTab = this.activeTab;
    data.scopes = scopes;
    data.tagsRaw = tagsRaw;
    data.entries = entries;
    data.campaigns = campaigns;
    data.beatsByCampaign = JSON.stringify(beatsByCampaign);
    data.terrainOptions = TERRAIN_OPTIONS;
    data.tierOptions = TIER_OPTIONS;
    data.requiredTagOptions = REQUIRED_TAG_OPTIONS;

    // Structured travel-id controls
    data.isTravel = isTravel;
    data.travelTerrainOptions = travelTerrainOptions;
    data.travelTierOptions = TRAVEL_TIER_OPTIONS;
    data.travelTerrain = travelTerrain;
    data.travelTier = travelTier;
    data.composedId = composedId;

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    function hydrateFromDom() {
      const root = document.querySelector(".bbttcc-campaign-table-editor");
      if (!root) return;

      function populate(sel, rows) {
        if (!sel) return;
        const current = String(sel.getAttribute("data-current") || "").trim();
        const priorValue = String(sel.value || "").trim();
        const target = current || priorValue || "";

        sel.innerHTML = "";

        for (const row of rows) {
          const opt = document.createElement("option");
          opt.value = row.value;
          opt.textContent = row.label;
          if (String(row.value) === target) opt.selected = true;
          sel.appendChild(opt);
        }
      }

      root.querySelectorAll("tbody tr").forEach(tr => {
        populate(tr.querySelector("select[name='entry-terrain']"), TERRAIN_OPTIONS);
        populate(tr.querySelector("select[name='entry-tier']"), TIER_OPTIONS);
        populate(tr.querySelector("select[name='entry-required-tag']"), REQUIRED_TAG_OPTIONS);
      });
    }

    setTimeout(hydrateFromDom, 0);
    requestAnimationFrame(hydrateFromDom);

    html.find("[data-action='tab']").on("click", ev => {
      ev.preventDefault();
      const tab = ev.currentTarget && ev.currentTarget.dataset ? ev.currentTarget.dataset.tab : null;
      if (!tab) return;
      this.activeTab = tab;
      this.render(false);
    });

    html.find("[data-action='cancel']").on("click", ev => {
      ev.preventDefault();
      this.close();
    });

    // Scope change swaps the Table ID control (text <-> terrain/tier). Re-render
    // with a transient override so the swap happens before the user saves.
    html.find("[data-action='scope-change']").on("change", ev => {
      this._scopeOverride = String(ev.currentTarget?.value || "").trim() || null;
      this.render(false);
    });

    // Live-update the composed travel id readout as terrain/tier change.
    html.find("[data-action='compose-id']").on("change", () => {
      const root = this.element && this.element[0] ? this.element[0] : null;
      if (!root) return;
      const terrain = String(root.querySelector("select[name='travel-terrain']")?.value || "").trim();
      const tier = String(root.querySelector("select[name='travel-tier']")?.value || "1").trim();
      const out = root.querySelector("[data-role='composed-id']");
      if (out) out.textContent = _composeTravelTableId(terrain, tier);
    });

    html.find("[data-action='save-table']").on("click", ev => {
      ev.preventDefault();
      this._saveFromForm(ev.currentTarget);
    });

    html.find("[data-action='add-entry']").on("click", async ev => {
      ev.preventDefault();
      const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
      if (!tablesApi || !tablesApi.getTable || !tablesApi.saveTable) return;

      const t = foundry.utils.deepClone(tablesApi.getTable(this.tableId));
      t.entries = Array.isArray(t.entries) ? t.entries : [];
      t.entries.push({
        campaignId: "",
        beatId: "",
        weight: 1,
        conditions: {}
      });
      await tablesApi.saveTable(this.tableId, t);
      this.render(false);
    });

    html.find("[data-action='remove-entry']").on("click", async ev => {
      ev.preventDefault();
      const idx = Number(ev.currentTarget && ev.currentTarget.dataset ? ev.currentTarget.dataset.index : NaN);
      if (!Number.isFinite(idx)) return;

      const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
      if (!tablesApi || !tablesApi.getTable || !tablesApi.saveTable) return;

      const t = foundry.utils.deepClone(tablesApi.getTable(this.tableId));
      if (!t || !Array.isArray(t.entries)) return;
      t.entries.splice(idx, 1);
      await tablesApi.saveTable(this.tableId, t);
      this.render(false);
    });

    html.find("[data-action='preview-roll']").on("click", async ev => {
      ev.preventDefault();
      await this._previewRoll({ tags: "preview" });
    });

    html.find("[data-action='normalize-weights']").on("click", async ev => {
      ev.preventDefault();
      const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
      if (!tablesApi || !tablesApi.getTable || !tablesApi.saveTable) return;

      const t = foundry.utils.deepClone(tablesApi.getTable(this.tableId));
      if (!t || !Array.isArray(t.entries) || !t.entries.length) return;

      const pool = t.entries
        .map(e => ({ e: e, w: Math.max(0, Number(e && e.weight != null ? e.weight : 0) || 0) }))
        .filter(x => x.w > 0);

      if (!pool.length) {
        ui.notifications && ui.notifications.warn && ui.notifications.warn("No positive weights to normalize.");
        return;
      }

      const sum = pool.reduce((s, x) => s + x.w, 0);
      for (const x of pool) {
        x.e.weight = Math.max(1, Math.round((x.w / sum) * 100));
      }

      await tablesApi.saveTable(this.tableId, t);
      const total = (t.entries || []).reduce((s, e) => s + Math.max(0, Number(e && e.weight != null ? e.weight : 0) || 0), 0);
      const tableLabel = _labelForTable(this.tableId);
      ui.notifications && ui.notifications.info && ui.notifications.info("Weights normalized: " + tableLabel + " (total=" + total + ")");
      this.render(false);
    });

    let beatsByCampaign = {};
    try {
      const raw = html.find("[data-beats-by-campaign]") && html.find("[data-beats-by-campaign]").attr
        ? html.find("[data-beats-by-campaign]").attr("data-beats-by-campaign")
        : "";
      if (raw) beatsByCampaign = JSON.parse(raw);
    } catch (_err) {}

    const _prettyBeatLabel = (campaignId, beatId) => {
      const opts = (beatsByCampaign && beatsByCampaign[campaignId]) || [];
      const hit = opts.find(o => o && o.id === beatId);
      const raw = String((hit && hit.label) || beatId || "").trim();
      return raw.replace(/\s*\([^)]*\)\s*$/, "").trim() || beatId;
    };

    const _updateEntryRowUI = row => {
      if (!row) return;
      const campSel = row.querySelector("select[name='entry-campaign-id']");
      const beatSel = row.querySelector("select[name='entry-beat-id']");
      const weightIn = row.querySelector("input[name='entry-weight']") || row.querySelector("[data-role='entry-weight']");
      const preview = row.querySelector("[data-role='beat-preview']");

      const campaignId = String((campSel && campSel.value) || "").trim();
      const beatId = String((beatSel && beatSel.value) || "").trim();
      const weight = _safeNum(weightIn && weightIn.value, 0);

      if (preview) {
        if (campaignId && beatId) preview.textContent = _prettyBeatLabel(campaignId, beatId);
        else preview.innerHTML = "&nbsp;";
      }

      const shouldFade = (!campaignId || !beatId || weight <= 0);
      row.style.opacity = shouldFade ? "0.55" : "1";
    };

    html.find("select[name='entry-campaign-id']").on("change", ev => {
      const sel = ev.currentTarget;
      const campaignId = String((sel && sel.value) || "").trim();

      const row = sel && sel.closest ? sel.closest("tr") : null;
      if (!row) return;

      const beatSel = row.querySelector("select[name='entry-beat-id']");
      if (!beatSel) return;

      const opts = beatsByCampaign[campaignId] || [];
      beatSel.innerHTML = "";

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "(Pick beat)";
      beatSel.appendChild(empty);

      for (const o of opts) {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.label;
        beatSel.appendChild(opt);
      }

      beatSel.value = "";
      _updateEntryRowUI(row);
    });

    html.find("select[name='entry-beat-id']").on("change", ev => {
      const row = ev.currentTarget && ev.currentTarget.closest ? ev.currentTarget.closest("tr") : null;
      _updateEntryRowUI(row);
    });

    html.find("input[name='entry-weight']").on("input", ev => {
      const row = ev.currentTarget && ev.currentTarget.closest ? ev.currentTarget.closest("tr") : null;
      _updateEntryRowUI(row);
    });

    html.find("tbody tr").each((_, tr) => _updateEntryRowUI(tr));
  }

  async _previewRoll(config) {
    config = config || {};
    const tags = config.tags || "preview";
    const showDialog = config.showDialog !== false;

    const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
    if (!tablesApi || !tablesApi.runRandomTable) {
      ui.notifications && ui.notifications.warn && ui.notifications.warn("Tables API missing runRandomTable().");
      return null;
    }

    const form = this.element && this.element.find ? this.element.find("form")[0] : null;
    const formId = form ? String(new FormData(form).get("id") || "").trim() : "";
    const tableId = String(this.tableId || formId || "").trim();
    if (!tableId) {
      ui.notifications && ui.notifications.warn && ui.notifications.warn("No tableId to preview.");
      return null;
    }

    const tableLabel = _labelForTable(tableId);
    ui.notifications && ui.notifications.info && ui.notifications.info("Preview Roll: " + tableLabel);

    try {
      const res = await tablesApi.runRandomTable({ tableId: tableId, tags: tags });

      const campaignId = String((res && res.campaignId) || "").trim();
      const beatId = String((res && res.beatId) || "").trim();

      const beatLabel = (campaignId && beatId) ? _labelForBeat(campaignId, beatId) : (beatId || "(none)");

      const msg = "Encounter Rolled\n\nTable: " + tableLabel + "\nBeat: " + beatLabel;
      ui.notifications && ui.notifications.info && ui.notifications.info(tableLabel + " -> " + beatLabel);

      if (showDialog) {
        new Dialog({
          title: "Preview Roll",
          content: '<pre style="white-space:pre-wrap; margin:0;">' + foundry.utils.escapeHTML(msg) + "</pre>",
          buttons: {
            again: {
              label: "Roll Again",
              callback: () => this._previewRoll({ tags: tags, showDialog: true })
            },
            close: { label: "Close" }
          },
          default: "again"
        }).render(true);
      }

      console.debug(TAG, "Preview roll result", { tableId: tableId, res: res });
      return res;
    } catch (err) {
      console.error(TAG, "Preview roll failed", err);
      ui.notifications && ui.notifications.error && ui.notifications.error("Preview Roll failed: " + ((err && err.message) || err));
      return null;
    }
  }

  async _saveFromForm(clickedEl) {
    let form = clickedEl && clickedEl.closest ? clickedEl.closest("form") : null;
    if (!form) form = this.element && this.element.find ? this.element.find("form")[0] : null;
    if (!form || !(form instanceof HTMLFormElement)) {
      console.error(TAG, "Could not locate form for save.", { form: form, clickedEl: clickedEl });
      ui.notifications && ui.notifications.error && ui.notifications.error("Table Editor: Could not locate form for Save.");
      return;
    }

    const tablesApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.campaign && game.bbttcc.api.campaign.tables;
    if (!tablesApi || !tablesApi.saveTable) {
      ui.notifications && ui.notifications.warn && ui.notifications.warn("Encounter Tables API not ready.");
      return;
    }

    const fd = new FormData(form);

    const scope = String(fd.get("scope") || "global").trim() || "global";

    // Resolve the table id. Travel tables compose a canonical travel_<terrain>_t<tier>
    // from the dropdowns (never free text). Other scopes slugify the typed id so a
    // stray space or capital can't produce an unfindable key.
    let id;
    if (scope === "travel") {
      const terrain = String(fd.get("travel-terrain") || "").trim();
      const tier = String(fd.get("travel-tier") || "1").trim();
      if (!terrain) {
        ui.notifications?.warn?.("Table Editor: pick a terrain for the travel table.");
        return;
      }
      id = _composeTravelTableId(terrain, tier);
    } else {
      const raw = String(fd.get("id") || this.tableId || "").trim();
      id = _slugifyTableId(raw);
      if (raw && id !== raw) {
        ui.notifications?.info?.(`Table id normalized to '${id}'.`);
      }
    }

    if (!id) {
      ui.notifications && ui.notifications.warn && ui.notifications.warn("Table Editor: table id missing.");
      return;
    }

    // Reject collisions when creating or renaming into an id that already exists.
    const renaming = this.tableId && id !== this.tableId;
    if (id !== this.tableId && tablesApi.getTable?.(id)) {
      ui.notifications?.warn?.(`A table with id '${id}' already exists. Choose a different terrain/tier or id.`);
      return;
    }

    const label = String(fd.get("label") || "").trim() || id;
    const tags = _normalizeTags(fd.get("tags") || "");

    const entryCampaignIds = fd.getAll("entry-campaign-id").map(v => String(v || "").trim());
    const entryBeatIds = fd.getAll("entry-beat-id").map(v => String(v || "").trim());
    const entryWeights = fd.getAll("entry-weight").map(v => _safeNum(v, 0));
    const entryTerrains = fd.getAll("entry-terrain").map(v => String(v || "").trim());
    const entryTiers = fd.getAll("entry-tier").map(v => String(v || "").trim());
    const entryRequiredTags = fd.getAll("entry-required-tag").map(v => String(v || "").trim());

    const entries = [];
    const n = Math.max(
      entryCampaignIds.length,
      entryBeatIds.length,
      entryWeights.length,
      entryTerrains.length,
      entryTiers.length,
      entryRequiredTags.length
    );

    for (let i = 0; i < n; i++) {
      const campaignId = entryCampaignIds[i] || "";
      const beatId = entryBeatIds[i] || "";
      const weight = Number(entryWeights[i] != null ? entryWeights[i] : 0) || 0;

      if (!campaignId || !beatId) continue;
      if (weight <= 0) continue;

      const conditions = {};
      if (entryTerrains[i]) conditions.terrain = entryTerrains[i];
      if (entryTiers[i]) conditions.tier = entryTiers[i];
      if (entryRequiredTags[i]) conditions.requiredTag = entryRequiredTags[i];

      entries.push({
        campaignId: campaignId,
        beatId: beatId,
        weight: weight,
        conditions: conditions
      });
    }

    const payload = {
      id: id,
      label: label,
      scope: scope,
      tags: tags,
      entries: entries
    };

    console.log(TAG, "Saving table", payload);

    await tablesApi.saveTable(id, payload);
    // Rename: drop the stale key so the old (often broken) id doesn't linger.
    if (renaming && tablesApi.deleteTable) {
      try { await tablesApi.deleteTable(this.tableId); } catch (_e) {}
    }
    ui.notifications && ui.notifications.info && ui.notifications.info(
      renaming ? `Encounter Table saved (renamed ${this.tableId} -> ${id}).` : "Encounter Table saved."
    );
    this._scopeOverride = null;
    this.tableId = id;
    this.close();
  }
}