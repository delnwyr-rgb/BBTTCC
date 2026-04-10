let SCHOOLS = {};

Hooks.once("init", async () => {
  // 1) Load the JSON data from the server root
  try {
    const response = await fetch("/modules/esoteric-magic/data/schools.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }
    SCHOOLS = await response.json();
    console.log("🔮 Esoteric | Loaded schools.json →", SCHOOLS);
  }
  catch (err) {
    console.error("🔮 Esoteric | Failed to load schools.json:", err);
  }

  // 2) Register the world setting
  game.settings.register("esoteric-magic", "enabled", {
    name: "Enable Esoteric Rules",
    hint: "Toggle Hermetic/Chaos bonuses and UI panel",
    scope: "world",
    type: Boolean,
    default: true
  });

  // 3) Register Handlebars helper for capitalizing
  Handlebars.registerHelper("capitalize", str =>
    str.charAt(0).toUpperCase() + str.slice(1)
  );

  /* 4) Preload your template so the panel can render
  await loadTemplates([
    "modules/esoteric-magic/templates/correspondences.html"
  ]);
});*/

await foundry.applications.handlebars.loadTemplates([
    "modules/esoteric-magic/templates/correspodences.html"
  ]);
});

// Inject a button into every 5E actor sheet
Hooks.on("renderActorSheet5e", (app, html) => {
  if (!game.settings.get("esoteric-magic", "enabled")) return;

  // Find the <menu class="controls-dropdown"> element
  const dropdown = html.find("menu.controls-dropdown");
  if (!dropdown.length) return;

  // Create a new <li> to insert as another item in that dropdown
  const li = $(`
    <li class="header-control" data-action="openEsoteric">
      <button type="button" class="control">
        <i class="control-icon fa-fw fas fa-magic"></i>
        <span class="control-label">Esoteric</span>
      </button>
    </li>
  `);

  // Append it to the dropdown menu
  dropdown.append(li);

  // When the new “Esoteric” menu‐item is clicked, open the panel
  li.on("click", () => {
    new EsotericPanel().render(true);
  });
});

// Hook into spell rolls
Hooks.on("dnd5e.preRollItem", (item, rollConfig) => {
  if (!game.settings.get("esoteric-magic","enabled")) return;
  if (item.type !== "spell") return;

  const school = item.system.school;
  const table  = SCHOOLS[school];
  const bonus  = computeBonus(table);
  if (bonus) {
    rollConfig.modifiers = rollConfig.modifiers || [];
    rollConfig.modifiers.push({ label: bonus.label, mod: bonus.value });
  }
});

// Determine time-based bonus
function computeBonus(table) {
  if (!table) return null;
  const now     = new Date(game.time.worldTime * 1000);
  const hour    = now.getHours();
  const weekday = now.toLocaleString("en-US",{weekday:"long"}).toLowerCase();

  if (weekday === table.day && table.bonuses[table.day]) 
    return table.bonuses[table.day];
  if (hour === 6   && table.bonuses.dawn)     return table.bonuses.dawn;
  if (hour === 18  && table.bonuses.dusk)     return table.bonuses.dusk;
  if (hour === 0   && table.bonuses.midnight) return table.bonuses.midnight;
  return null;
}

// The UI panel application
class EsotericPanel extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id:    "esoteric-panel",
      title: "Esoteric Correspondences",
      template: "modules/esoteric-magic/templates/correspondences.html",
      width: 600
    });
  }
  getData() {
    return { schools: SCHOOLS };
  }
}
