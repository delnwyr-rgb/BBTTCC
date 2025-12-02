// modules/bbttcc-raid/scripts/bbttcc-raid-console-ui.enhancer.js
// BBTTCC — Raid Console 3.0 UI Enhancer (Battlefield Card Style)
//
// - Enriches maneuver lists with: OP cost line (icons + labels), tier + rarity tags, and tooltips from EFFECTS.text.
// - Gives each round row a "card" feel via lightweight DOM tweaks.
// - Leaves core BBTTCC_RaidConsole logic in module.raid-console.js unchanged. 

(() => {
  const TAG = "[bbttcc-raid/ui-enhancer]";

  const OP_ICONS = {
    violence:   "⚔",
    nonlethal:  "🛡",
    nonLethal:  "🛡",
    intrigue:   "🕵",
    economy:    "💰",
    softpower:  "🎭",
    softPower:  "🎭",
    diplomacy:  "🕊",
    faith:      "🌞",
    logistics:  "📦",
    culture:    "🎨"
  };

  const OP_LABELS = {
    violence:   "Violence",
    nonlethal:  "Non-Lethal",
    nonLethal:  "Non-Lethal",
    intrigue:   "Intrigue",
    economy:    "Economy",
    softpower:  "Soft Power",
    softPower:  "Soft Power",
    diplomacy:  "Diplomacy",
    faith:      "Faith",
    logistics:  "Logistics",
    culture:    "Culture"
  };

  const RARITY_LABELS = {
    common:     "Common",
    uncommon:   "Uncommon",
    rare:       "Rare",
    very_rare:  "Very Rare",
    legendary:  "Legendary"
  };

  function costLine(opCosts) {
    if (!opCosts || typeof opCosts !== "object") return "";
    const parts = [];
    for (const [raw, v] of Object.entries(opCosts)) {
      const key   = String(raw);
      const icon  = OP_ICONS[key]  || "";
      const label = OP_LABELS[key] || key;
      const val   = Number(v || 0);
      if (!val) continue;
      parts.push(`${icon} ${label} ${val}`);
    }
    if (!parts.length) return "";
    return parts.join("   ");
  }

  function rarityBadge(tier, rarity) {
    const t = tier != null ? `T${tier}` : null;
    const r = rarity ? (RARITY_LABELS[rarity] || rarity) : null;
    if (!t && !r) return "";
    const bits = [];
    if (t) bits.push(t);
    if (r) bits.push(r);
    return bits.join(" • ");
  }

  function applyCardStyling(appEl) {
    try {
      const root = appEl instanceof jQuery ? appEl[0] : appEl;
      if (!root) return;

      const table = root.querySelector("table.bbttcc-raid-table, table"); // be flexible
      if (!table) return;

      // Give each round row a card-like container
      const bodyRows = table.querySelectorAll("tbody tr[data-idx]");
      bodyRows.forEach((row) => {
        row.style.border = "1px solid rgba(148,163,184,0.7)";
        row.style.borderRadius = "8px";
        row.style.boxShadow = "0 4px 12px rgba(15,23,42,0.7)";
        row.style.background = "linear-gradient(135deg, #020617, #111827)";
        row.style.marginBottom = "8px";
        row.style.display = "block";
        row.style.padding = "6px 8px";

        // The "manage" row (next sibling) is part of the card
        const manage = row.nextElementSibling;
        if (manage && manage.dataset && manage.dataset.manageRow === "true") {
          manage.style.border = "1px solid rgba(148,163,184,0.5)";
          manage.style.borderTop = "none";
          manage.style.borderRadius = "0 0 8px 8px";
          manage.style.boxShadow = "0 4px 12px rgba(15,23,42,0.7)";
          manage.style.background = "#020617";
          manage.style.marginTop = "-4px";
          manage.style.marginBottom = "10px";
          manage.style.display = "block";
          manage.style.padding = "8px 10px";
        }
      });
    } catch (e) {
      console.warn(TAG, "applyCardStyling failed:", e);
    }
  }

  function enhanceManeuvers(appEl) {
    try {
      const root = appEl instanceof jQuery ? appEl[0] : appEl;
      if (!root) return;

      const EFFECTS = (game.bbttcc?.api?.raid?.EFFECTS) || {};

      // For each maneuvers fieldset we created in module.raid-console.js 
      const labels = root.querySelectorAll(".bbttcc-mans label");
      labels.forEach((lbl) => {
        const cb = lbl.querySelector("input[type='checkbox'][data-maneuver]");
        if (!cb) return;

        const key = String(cb.dataset.maneuver || "").toLowerCase();
        const spec = EFFECTS[key];
        if (!spec) return;

        const labelTextEl = lbl.querySelector("span");
        if (!labelTextEl) return;

        const baseLabel = labelTextEl.textContent?.trim() || spec.label || key;

        // Tier + rarity badge
        const badge = rarityBadge(spec.tier, spec.rarity);
        const badgeHtml = badge
          ? `<span class="bbttcc-tag" style="margin-left:4px; padding:1px 4px; border-radius:999px; border:1px solid rgba(148,163,184,0.9); font-size:0.7rem; opacity:0.9;">${badge}</span>`
          : "";

        // Cost line
        const costStr = costLine(spec.opCosts || spec.cost || {});
        const costHtml = costStr
          ? `<div class="bbttcc-m-cost" style="font-size:0.7rem; opacity:0.9; margin-left:18px; margin-top:0px;">${costStr}</div>`
          : "";

        // Tooltip
        const text = spec.text || "";
        lbl.title = text;

        // Rebuild the label content
        lbl.innerHTML = `
          <input type="checkbox" ${cb.checked?"checked":""} data-maneuver="${cb.dataset.maneuver}" data-side="${cb.dataset.side}">
          <span>${baseLabel}</span>
          ${badgeHtml}
          ${costHtml}
        `;
      });
    } catch (e) {
      console.warn(TAG, "enhanceManeuvers failed:", e);
    }
  }

  Hooks.on("renderBBTTCC_RaidConsole", (app) => {
    // app.element is a jQuery object
    const el = app.element || app._element;
    if (!el) return;
    applyCardStyling(el);
    enhanceManeuvers(el);
  });

})();
