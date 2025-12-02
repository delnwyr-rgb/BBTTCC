// modules/bbttcc-factions/scripts/faction-section-skin.enhancer.js
// BBTTCC — Faction Section Skin (card identity + debug)
//
// Looks at fieldset legends on the Faction sheet Overview / other tabs
// and assigns card classes so CSS can theme them:
//
//  - "Faction Health"                -> bbttcc-card bbttcc-card-health
//  - "BBTTCC — Territory Roll-up"   -> bbttcc-card bbttcc-card-territory
//  - "Territory — This Scene"       -> bbttcc-card bbttcc-card-territory-scene
//  - "Organization Points"          -> bbttcc-card bbttcc-card-ops
//  - "Roster"                       -> bbttcc-card bbttcc-card-roster
//  - "War Logs"                     -> bbttcc-card bbttcc-card-warlogs
//
// Purely cosmetic: no data or logic changes.

(() => {
  const TAG = "[bbttcc-section-skin]";

  function classifyFieldset(fs) {
    if (!fs) return;

    const legendEl = fs.querySelector("legend");
    const rawText = (legendEl?.textContent || "").trim();
    const label = rawText.toLowerCase();
    if (!label) return;

    let cls = null;
    if (label.includes("faction health")) {
      cls = "bbttcc-card-health";
    } else if (label.includes("territory roll-up")) {
      cls = "bbttcc-card-territory";
    } else if (label.includes("territory — this scene") || label.includes("territory - this scene")) {
      cls = "bbttcc-card-territory-scene";
    } else if (label.includes("organization points")) {
      cls = "bbttcc-card-ops";
    } else if (label === "roster") {
      cls = "bbttcc-card-roster";
    } else if (label === "war logs") {
      cls = "bbttcc-card-warlogs";
    }

    console.log(TAG, "fieldset legend:", `"${rawText}"`, "->", cls || "(no match)");

    if (cls) {
      if (!fs.classList.contains("bbttcc-card")) {
        fs.classList.add("bbttcc-card");
      }
      if (!fs.classList.contains(cls)) {
        fs.classList.add(cls);
      }
    }
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const root = html[0];
      if (!root) return;

      const body = root.querySelector(".bbttcc-faction-body");
      if (!body) return;

      const fieldsets = body.querySelectorAll("fieldset");
      console.log(TAG, `render sheet "${app.actor?.name}" — found ${fieldsets.length} fieldsets`);
      fieldsets.forEach(fs => classifyFieldset(fs));
    } catch (e) {
      console.warn(TAG, "render hook error:", e);
    }
  });

  console.log(TAG, "Section skin enhancer active.");
})();
