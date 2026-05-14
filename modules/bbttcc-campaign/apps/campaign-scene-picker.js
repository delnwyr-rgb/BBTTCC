// modules/bbttcc-campaign/apps/campaign-scene-picker.js
//
// BBTTCC Campaign Builder – Scene Picker (Hardened)
// - Returns plain scene rows {name,id,uuid} so the picker never leaks Document objects into HBS.
// - Ensures uuid is always "Scene.<id>" for world scenes.
// - onSelect receives { id, uuid, name }.

export class BBTTCCCampaignScenePickerApp extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-scene-picker",
      title: "Pick Scene",
      template: "modules/bbttcc-campaign/templates/campaign-scene-picker.hbs",
      width: 500,
      height: 600,
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

    html.find("[data-action='choose-scene']").on("click", ev => {
      ev.preventDefault();
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
