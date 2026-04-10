// BBTTCC Campaign Builder – Actor Picker
//
// Simple V1 Application that lists all actors and lets the user pick one.
// The selected actor is passed to an onSelect callback provided in options.

export class BBTTCCCampaignActorPickerApp extends Application {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-campaign-actor-picker",
      title: "Pick Actor",
      template: "modules/bbttcc-campaign/templates/campaign-actor-picker.hbs",
      width: 500,
      height: 600,
      resizable: true,
      minimizable: true,
      classes: ["bbttcc-campaign-actor-picker", "bbttcc-hexchrome"]
    });
  }

  constructor(options = {}) {
    super(options);
    this.onSelect = options.onSelect ?? null;
  }

  async getData(options = {}) {
    const data = await super.getData(options);

    const actors = (game.actors?.contents ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

    return {
      ...data,
      actors
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("[data-action='choose-actor']").on("click", ev => {
      ev.preventDefault();
      const uuid = ev.currentTarget?.dataset?.uuid;
      if (!uuid) return;

      const actor = fromUuidSync?.(uuid) || game.actors.get(uuid) || null;
      if (this.onSelect && actor) {
        this.onSelect(actor);
      }
      this.close();
    });
  }
}
