// modules/bbttcc-territory/scripts/module.js

console.log("[bbttcc-territory] loading…");

// -----------------------------
// Public API (simple for now)
// -----------------------------
export const API = {
  openDashboard: () => {
    console.log("[bbttcc-territory] Dashboard clicked");
    ui.notifications?.info("Territory Dashboard (placeholder) — UI wiring next.");
  },

  createHex: ({ radius = 140 } = {}) => {
    console.log("[bbttcc-territory] Create Hex request:", { radius });
    const scene = canvas?.scene;
    if (!scene) return ui.notifications?.warn("No active scene.");

    // Center of the scene in document coords
    const cx = Math.round(scene.width / 2);
    const cy = Math.round(scene.height / 2);

    // Flat-top hex positive offsets so it won't clip
    const h = Math.sqrt(3) * radius;
    const pts = [
      radius/2, 0,
      1.5*radius, 0,
      2*radius, h/2,
      1.5*radius, h,
      radius/2, h,
      0, h/2
    ];
    const x = cx - radius;
    const y = cy - h/2;

    const data = {
      x, y,
      shape: { type: "p", points: pts },
      fillType: 1,
      fillColor: "#00ffff",
      fillAlpha: 0.25,
      strokeColor: "#ff00ff",
      strokeAlpha: 1,
      strokeWidth: 4,
      sort: 1001,
      flags: { "bbttcc-territory": { isTerritory: true, radius } }
    };

    scene.createEmbeddedDocuments("Drawing", [data]).then(docs => {
      if (docs?.[0]) {
        console.log("[bbttcc-territory] Hex Drawing created:", docs[0]);
        ui.notifications?.info("Hex created.");
      }
    }).catch(err => {
      console.error("[bbttcc-territory] Failed to create hex:", err);
      ui.notifications?.error("Failed to create hex (see console).");
    });
  },

  claim: () => {
    console.log("[bbttcc-territory] Claim clicked");
    ui.notifications?.info("Claim flow placeholder — will open modern dashboard.");
  }
};

// -----------------------------
// Tools we want to add
// -----------------------------
function toolsArray() {
  return [
    { name:"bbttcc-dashboard",  title:"Territory Dashboard",  icon:"fas fa-hexagon",      button:true, onChange:()=>API.openDashboard() },
    { name:"bbttcc-create-hex", title:"Create Territory Hex", icon:"fas fa-draw-polygon",  button:true, onChange:()=>API.createHex({ radius:140 }) },
    { name:"bbttcc-claim",      title:"Claim Territory",      icon:"fas fa-flag",          button:true, onChange:()=>API.claim() }
  ];
}
function toolsMap() {
  return {
    "bbttcc-dashboard":  { name:"bbttcc-dashboard",  title:"Territory Dashboard",  icon:"fas fa-hexagon",      button:true, onChange:()=>API.openDashboard() },
    "bbttcc-create-hex": { name:"bbttcc-create-hex", title:"Create Territory Hex", icon:"fas fa-draw-polygon",  button:true, onChange:()=>API.createHex({ radius:140 }) },
    "bbttcc-claim":      { name:"bbttcc-claim",      title:"Claim Territory",      icon:"fas fa-flag",          button:true, onChange:()=>API.claim() }
  };
}

// -----------------------------
// Safe merge helpers
// -----------------------------
function mergeIntoDrawingsArray(drawings) {
  if (!Array.isArray(drawings.tools)) return false;     // don't touch if it's not an array
  const arr   = drawings.tools;
  const names = new Set(arr.map(t => t?.name));
  for (const t of toolsArray()) if (!names.has(t.name)) arr.push(t);
  return true;
}

function mergeIntoDrawingsMap(drawings) {
  if (!drawings.tools || Array.isArray(drawings.tools) || typeof drawings.tools !== "object") return false;
  const map = drawings.tools;
  const src = toolsMap();
  for (const k of Object.keys(src)) if (!map[k]) map[k] = src[k];
  return true;
}

// -----------------------------
// Injector (named so we can reorder it later)
// -----------------------------
const BBTTCC_INJECTOR = function inject(controls) {
  try {
    // Modern object-map (v13): controls is an object keyed by group id
    if (controls && !Array.isArray(controls) && typeof controls === "object") {
      // Find the drawings group
      let drawings = controls.drawings || controls.Drawings || null;
      if (!drawings) {
        drawings = Object.values(controls).find(g => {
          const t = (g?.title || "").toLowerCase();
          return g?.name === "drawings" || g?.layer === "drawings" || t.includes("draw");
        }) || null;
      }

      if (drawings) {
        // Try array path first; if not, try map path.
        if (!mergeIntoDrawingsArray(drawings)) {
          if (!mergeIntoDrawingsMap(drawings)) {
            // If neither shape is safe to merge, add a separate group instead of mutating drawings
            controls.bbttccTerritory = controls.bbttccTerritory || {
              name: "bbttccTerritory",
              title: "Territory",
              icon: "fas fa-hexagon",
              tools: toolsArray()
            };
          }
        }
        return controls;      // return the mutated object/map
      }

      // If no drawings group found, create our own group key on the map
      controls.bbttccTerritory = controls.bbttccTerritory || {
        name: "bbttccTerritory",
        title: "Territory",
        icon: "fas fa-hexagon",
        tools: toolsArray()
      };
      return controls;
    }

    // Classic array signature
    if (Array.isArray(controls)) {
      let grp = controls.find(g => g?.name === "bbttccTerritory");
      if (!grp) controls.push({ name: "bbttccTerritory", title: "Territory", icon: "fas fa-hexagon", tools: toolsArray() });
      else {
        const names = new Set((grp.tools||[]).map(t=>t?.name));
        for (const t of toolsArray()) if (!names.has(t.name)) grp.tools.push(t);
      }
      return controls;
    }

    // Map signature (edge cases)
    if (controls instanceof Map) {
      const g = controls.get("drawings");
      if (g) {
        if (!mergeIntoDrawingsArray(g)) mergeIntoDrawingsMap(g);
        return controls;
      }
      controls.set("bbttccTerritory", { name:"bbttccTerritory", title:"Territory", icon:"fas fa-hexagon", tools: toolsArray() });
      return controls;
    }

    // Unknown shape — do nothing
    return controls;
  } catch (e) {
    console.error("[bbttcc-territory] Toolbar injection failed:", e);
    return controls;
  }
};
Object.defineProperty(BBTTCC_INJECTOR, "name", { value: "bbttccTerritoryInjector" });
Hooks.on("getSceneControlButtons", BBTTCC_INJECTOR);

// -----------------------------
// Boot / registry / run-last nudge
// -----------------------------
Hooks.once("init", () => {
  console.log("[bbttcc-territory] init");
});

Hooks.once("ready", () => {
  // expose API into the core registry
  if (!game.bbttcc) game.bbttcc = { api: {} };
  game.bbttcc.api.territory = API;
  console.log("[bbttcc-territory] ready (API registered)");
});

// Ensure our injector runs last and tools are visible without breaking stock tools
Hooks.once("canvasReady", () => {
  try {
    // Remove any prior registrations of our injector
    const list = Hooks.events.getSceneControlButtons || [];
    for (const fn of [...list]) {
      if (fn?.name === "bbttccTerritoryInjector") Hooks.off("getSceneControlButtons", fn);
    }
    // Re-register at the tail
    Hooks.on("getSceneControlButtons", BBTTCC_INJECTOR);

    // Ask Foundry to prepare Drawings controls and then render
    ui.controls?.render(true, { controls: "drawings" });
    setTimeout(() => ui.controls?.render(true), 50);

    console.log("[bbttcc-territory] late injector registered and controls nudged.");
  } catch (e) {
    console.warn("[bbttcc-territory] late re-register failed:", e);
  }
});
