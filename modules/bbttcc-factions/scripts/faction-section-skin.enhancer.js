// modules/bbttcc-factions/scripts/faction-section-skin.enhancer.js
// BBTTCC — Faction Section Skin (card identity + debug)
//
// Cosmetic only. Assigns card classes based on fieldset legends so CSS can
// theme Overview / Activities / Assets / Relationships / War Logs content.
// Updated for the refactored five-tab faction sheet layout.

(() => {
  const TAG = "[bbttcc-section-skin]";

  function normLabel(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function addCardClass(fs, cls) {
    if (!fs || !cls) return;
    fs.classList.add("bbttcc-card");
    fs.classList.add(cls);
  }

  function classifyFieldset(fs) {
    if (!fs) return;

    const legendEl = fs.querySelector("legend");
    const rawText = ((legendEl && legendEl.textContent) || "").trim();
    const label = normLabel(rawText);
    if (!label) return;

    let cls = null;

    if (
      label.includes("faction health") ||
      label.includes("pressure") ||
      label.includes("political pressure") ||
      label.includes("gm manual edit")
    ) {
      cls = "bbttcc-card-health";
    } else if (
      label.startsWith("rigs") ||
      label.includes("mobile infrastructure")
    ) {
      cls = "bbttcc-card-rigs";
    } else if (
      label.includes("territory roll-up") ||
      label.includes("owned hexes") ||
      label.includes("hex relationships")
    ) {
      cls = "bbttcc-card-territory";
    } else if (
      label.includes("territory — this scene") ||
      label.includes("territory - this scene")
    ) {
      cls = "bbttcc-card-territory-scene";
    } else if (
      label.includes("organization points") ||
      label.includes("op budget") ||
      label.includes("op pile") ||
      label.includes("op bank")
    ) {
      cls = "bbttcc-card-ops";
    } else if (
      label === "roster" ||
      label.includes("relationships")
    ) {
      cls = "bbttcc-card-roster";
    } else if (
      label === "war logs" ||
      label.includes("quest log") ||
      label.includes("next turn queue") ||
      label.includes("doctrine") ||
      label.includes("faction actions") ||
      label.includes("activities")
    ) {
      cls = "bbttcc-card-warlogs";
    }

    console.log(TAG, 'fieldset legend:', '"' + rawText + '"', '->', cls || '(no match)');
    addCardClass(fs, cls);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const root = html && html[0];
      if (!root) return;

      const body = root.querySelector(".bbttcc-faction-body");
      if (!body) return;

      const fieldsets = body.querySelectorAll("fieldset");
      console.log(TAG, 'render sheet "' + ((app.actor && app.actor.name) || '') + '" — found ' + fieldsets.length + ' fieldsets');
      fieldsets.forEach(fs => classifyFieldset(fs));
    } catch (e) {
      console.warn(TAG, "render hook error:", e);
    }
  });

  console.log(TAG, "Section skin enhancer active.");
})();
