// bbttcc-character-options/scripts/module.js
const MODULE_ID = "bbttcc-character-options";

class BBTTCCActorSheet extends game.dnd5e.applications.actor.ActorSheet5eChar {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    // Ensure our tab system is known
    opts.tabs = (opts.tabs ?? []).concat([{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes" }]);
    return opts;
  }

  _onRender(context, opts) {
    super._onRender?.(context, opts);
    const el = this.element;
    const nav = el.querySelector(".tabs");
    const body = el.querySelector(".sheet-body");
    if (!nav || !body) return;

    // Header tab
    if (!nav.querySelector("[data-tab='bbttcc']")) {
      const a = document.createElement("a");
      a.dataset.tab = "bbttcc";
      a.innerHTML = `<i class="fa-solid fa-hexagon"></i> BBTTCC`;
      nav.appendChild(a);
    }

    // Body tab
    if (!body.querySelector(".tab.bbttcc")) {
      const panel = document.createElement("section");
      panel.className = "tab bbttcc";
      panel.innerHTML = `
        <div class="bbttcc-pane" style="padding:.5rem;">
          <h3>BBTTCC</h3>
          <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
            <button class="button" data-act="link-faction">Link Faction</button>
            <button class="button" data-act="open-faction">Open Faction</button>
            <button class="button" data-act="territories">My Territories</button>
          </div>
        </div>`;
      body.appendChild(panel);

      panel.querySelector("[data-act='link-faction']")?.addEventListener("click", () =>
        game.bbttcc?.api?.factions?.openLinkCharacterToFaction({ actorId: this.actor.id })
      );
      panel.querySelector("[data-act='open-faction']")?.addEventListener("click", () =>
        game.bbttcc?.api?.factions?.openFactionForActor({ actorId: this.actor.id })
      );
      panel.querySelector("[data-act='territories']")?.addEventListener("click", () =>
        game.bbttcc?.api?.territory?.openDashboard()
      );
    }
  }
}

const API = {}; // reserved for future character options functions

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = API;

  // Register our sheet (not default; opt-in per actor)
  Actors.registerSheet("bbttcc", BBTTCCActorSheet, {
    types: ["character"],
    makeDefault: false,
    label: "BBTTCC Character (Enhanced)"
  });

  console.log(`[${MODULE_ID}] init`);
});

Hooks.once("ready", () => {
  if (game.bbttcc?.api) game.bbttcc.api.characterOptions = API;
  console.log(`[${MODULE_ID}] ready`);
});
