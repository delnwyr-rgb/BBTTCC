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
  } catch (err) {
    console.error("🔮 Esoteric | Failed to load schools.json:", err);
  }

  // 2) Register the world setting (with config: true)
  game.settings.register("esoteric-magic", "enabled", {
    name: "Enable Esoteric Rules",
    hint: "Toggle Hermetic/Chaos bonuses and UI panel",
    scope: "world",
    config: true, //Allows setting to appear in the UI
    type: Boolean,
    default: true
  });

  // 3) Register Handlebars helper for capitalizing
  Handlebars.registerHelper("capitalize", str =>
    str.charAt(0).toUpperCase() + str.slice(1)
  );

  // 4) Preload your template so the panel can render
  await foundry.applications.handlebars.loadTemplates([
    "modules/esoteric-magic/templates/correspondences.html"
  ]);
  console.log("🔮 Esoteric | Template loaded successfully: correspondences.html");
});

Hooks.on("renderActorSheet", (app, html, data) => {
    console.log("🔮 Sheet class ID:", app.constructor.name);
    
    // Detailed dropdown inspection to help identify the dropdown menu to alter.
    const dropdown = html.find("menu.controls-dropdown");
    console.log("🔮 Dropdown analysis:", {
        found: dropdown.length > 0,
        count: dropdown.length,
        visible: dropdown.is(':visible'),
        parent: dropdown.parent().get(0)?.tagName,
        siblings: dropdown.siblings().length,
        classes: dropdown.attr('class'),
        innerHTML: dropdown.length > 0 ? dropdown[0].innerHTML : 'N/A'
    });
    
    // Alternative selectors to try
    const alternatives = [
        'menu.controls-dropdown',
        '.controls-dropdown',
        'menu[class*="controls"]',
        '.sheet-header .controls',
        '.window-header .controls'
    ];
    
    alternatives.forEach(selector => {
        const found = html.find(selector);
        if (found.length > 0) {
            console.log(`🔮 Alternative found: ${selector}`, found[0]);
        }
    });
    
    if (!game.settings.get("esoteric-magic", "enabled")) return;
    // ... rest of your existing code
});

/* Load menu item on actor sheet renders
Hooks.on("renderActorSheet5eCharacter2", (app, html, data) => {
	console.log("🔮 Sheet class ID:", app.constructor.name);
    if (!game.settings.get("esoteric-magic", "enabled")) return; 

    // Find the <menu class="controls-dropdown"> element
    const dropdown = html.find("menu.controls-dropdown");
    if (!dropdown.length) {
		console.warn("Dropdown not found — skipping.");
		return;
	}
*/

    // Prevent duplicate injection, it item is (li)sted already , exits
	if (dropdown.find("[data-action='openEsoteric']").length > 0) {
		console.log("🔮 Skipped injection: 'openEsoteric' already exists in dropdown.");
		return;
	}

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

    // When the new “Esoteric” menu item is clicked, open the panel
    li.on("click", () => {
      new EsotericPanel().render(true);
    });
  });

// Hook into spell rolls
Hooks.on("dnd5e.preRollItem", (item, rollConfig) => {
  if (!game.settings.get("esoteric-magic", "enabled")) return;
  if (item.type !== "spell") return;

  // Safely access school
  const school = item.system?.school;
  if (!school || !SCHOOLS[school]) return;

  const table = SCHOOLS[school];
  const bonus = computeBonus(table);
  if (bonus) {
    rollConfig.modifiers = rollConfig.modifiers || [];
    rollConfig.modifiers.push({ label: bonus.label, mod: bonus.value });
  }
});

// Determine time-based bonus
function computeBonus(table) {
  if (!table) return null;
  const now = new Date(game.time.worldTime * 1000);
  const hour = now.getHours();
  const weekday = now.toLocaleString("en-US", { weekday: "long" }).toLowerCase();

  if (weekday === table.day && table.bonuses[table.day]) return table.bonuses[table.day];
  if (hour === 6 && table.bonuses.dawn) return table.bonuses.dawn;
  if (hour === 18 && table.bonuses.dusk) return table.bonuses.dusk;
  if (hour === 0 && table.bonuses.midnight) return table.bonuses.midnight;

  return null;
}

// The UI panel application
class EsotericPanel extends Application {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "esoteric-panel",
      title: "Esoteric Correspondences",
      template: "modules/esoteric-magic/templates/correspondences.html",
      width: 600
    });
  }

  getData() {
    return { schools: SCHOOLS };
  }
}
