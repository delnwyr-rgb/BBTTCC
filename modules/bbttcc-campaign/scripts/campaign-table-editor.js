// modules/bbttcc-campaign/apps/campaign-table-editor.js
// BBTTCC Campaign Builder - Encounter Table Editor (V1)
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

    const tagsRaw = t.tags.join(" ");
    const scopes = ["global", "travel", "hex", "campaign", "engine"];

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

    const id = String(fd.get("id") || this.tableId || "").trim();
    if (!id) {
      ui.notifications && ui.notifications.warn && ui.notifications.warn("Table Editor: table id missing.");
      return;
    }

    const label = String(fd.get("label") || "").trim() || id;
    const scope = String(fd.get("scope") || "global").trim() || "global";
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
    ui.notifications && ui.notifications.info && ui.notifications.info("Encounter Table saved.");
    this.tableId = id;
    this.close();
  }
}