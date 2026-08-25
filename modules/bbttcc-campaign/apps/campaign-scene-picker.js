// modules/bbttcc-campaign/apps/campaign-scene-picker.js
//
// Bad Eden Campaign Builder – Scene Picker (Hardened)
// - Returns plain scene rows {name,id,uuid} so the picker never leaks Document objects into HBS.
// - Ensures uuid is always "Scene.<id>" for world scenes.
// - onSelect receives { id, uuid, name }.

export class BBTTCCCampaignScenePickerApp extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-scene-picker",
      title: "Pick Scene",
      template: "modules/bbttcc-campaign/templates/campaign-scene-picker.hbs",
      width: 720,
      height: 640,
      resizable: true,
      minimizable: true,
      classes: ["bbttcc-campaign-scene-picker", "bbttcc-hexchrome"]
    });
  }

  constructor(options = {}) {
    super(options);
    this.onSelect = options.onSelect ?? null;
  }

  async getData(options = {}) {
    const data = await super.getData(options);

    const scenes = (game.scenes?.contents ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang))
      .map(s => ({
        name: s.name,
        id: s.id,
        uuid: `Scene.${s.id}`
      }));

    return { ...data, scenes };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html?.[0] ?? html;

    // Live filter — collapse whitespace (hex/scene names can carry NBSP) and
    // match case-insensitively on name or uuid.
    const search = root?.querySelector?.(".bbttcc-scene-picker-search");
    if (search) {
      const rows = Array.from(root.querySelectorAll(".bbttcc-scene-picker-row"));
      const empty = root.querySelector("[data-empty-note]");
      const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
      search.addEventListener("input", () => {
        const q = norm(search.value);
        let shown = 0;
        for (const row of rows) {
          const hit = !q || norm(row.textContent).includes(q);
          row.style.display = hit ? "" : "none";
          if (hit) shown++;
        }
        if (empty) {
          empty.textContent = "No scenes match the filter.";
          empty.style.display = shown ? "none" : "";
        }
      });
      setTimeout(() => { try { search.focus(); } catch (_e) {} }, 50);
    }

    html.find("[data-action='choose-scene']").on("click", ev => {
      ev.preventDefault();
      ev.stopPropagation();   // row and button both carry the action — fire once
      const uuid = ev.currentTarget?.dataset?.uuid;
      if (!uuid) return;

      // We pass a simple payload back to the editor.
      const id = uuid.startsWith("Scene.") ? uuid.slice("Scene.".length) : uuid;
      const scn = game.scenes?.get?.(id) || null;

      if (this.onSelect) {
        this.onSelect({
          id,
          uuid: uuid.startsWith("Scene.") ? uuid : `Scene.${id}`,
          name: scn?.name || "(unknown scene)"
        });
      }
      this.close();
    });
  }
}
