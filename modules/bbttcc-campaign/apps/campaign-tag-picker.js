// modules/bbttcc-campaign/apps/campaign-tag-picker.js
// BBTTCC Campaign Builder — Tag Picker (checkbox modal)

export class BBTTCCCampaignTagPickerApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-tag-picker",
      title: "Select Tags",
      template: "modules/bbttcc-campaign/templates/campaign-tag-picker.hbs",
      width: 560,
      height: "auto",
      resizable: true,
      popOut: true,
      classes: ["bbttcc", "bbttcc-hexchrome", "bbttcc-campaign-tag-picker"]
    });
  }

  constructor(options = {}) {
    super(options);
    this.tagCatalog = Array.isArray(options.tagCatalog) ? options.tagCatalog : [];
    this.selected = new Set(Array.isArray(options.selectedTags) ? options.selectedTags : []);
    this.onSelect = typeof options.onSelect === "function" ? options.onSelect : null;
  }

  async getData(options = {}) {
    const data = await super.getData(options);

    // Allow catalog items as strings or {key,label,hint}
    const tags = this.tagCatalog.map(t => {
      if (typeof t === "string") return { key: t, label: t, hint: "" };
      return { key: t.key, label: t.label || t.key, hint: t.hint || "" };
    });

    const selected = Array.from(this.selected);
    // Precompute a lookup so template doesn't need custom helpers
    const selectedMap = {};
    for (const k of selected) selectedMap[k] = true;

    return { ...data, tags, selected, selectedMap };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='toggle']").on("change", ev => {
      const key = ev.currentTarget?.dataset?.tag;
      if (!key) return;
      if (ev.currentTarget.checked) this.selected.add(key);
      else this.selected.delete(key);
    });

    html.find("[data-action='clear']").on("click", ev => {
      ev.preventDefault();
      this.selected.clear();
      this.render(false);
    });

    html.find("[data-action='cancel']").on("click", ev => {
      ev.preventDefault();
      this.close();
    });

    html.find("[data-action='save']").on("click", ev => {
      ev.preventDefault();
      const out = Array.from(this.selected);
      if (this.onSelect) this.onSelect(out);
      this.close();
    });
  }
}
