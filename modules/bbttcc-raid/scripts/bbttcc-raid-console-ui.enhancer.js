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

  // Phase 4D — fire-mode badge styling (mirrors module.raid-console.js).
  // Lives here too because this enhancer rebuilds <label> innerHTML.
  const FM_BADGE_STYLES = {
    "pre-roll":    { lbl: "PRE", title: "Pre-roll · applies at round commit (modifies the strategic dice)", bg: "rgba(14,58,94,0.55)", fg: "#7fc8ff", brd: "rgba(30,95,140,0.7)" },
    "anytime":     { lbl: "ANY", title: "Anytime · standalone state change (alarm/morale/etc.)",            bg: "rgba(28,58,28,0.55)", fg: "#7fff7f", brd: "rgba(46,96,46,0.7)" },
    "post-commit": { lbl: "POS", title: "Post-commit · triggers on the round outcome",                      bg: "rgba(58,46,14,0.55)", fg: "#ffb84d", brd: "rgba(108,84,24,0.7)" },
  };
  function fireModeBadgeHTML(mode) {
    const s = FM_BADGE_STYLES[mode] || FM_BADGE_STYLES["anytime"];
    return `<span class="bbttcc-fm-badge" data-fm="${mode}" title="${s.title}" style="display:inline-block;padding:0 .35em;border-radius:3px;font-size:.7em;font-weight:700;letter-spacing:.06em;background:${s.bg};color:${s.fg};border:1px solid ${s.brd};vertical-align:middle;margin-left:.15rem;">${s.lbl}</span>`;
  }
  function resolveFireMode(spec) {
    if (spec?.fireMode) return String(spec.fireMode);
    const infer = game.fourththing?.maneuvers?.inferFireMode;
    if (typeof infer === "function") {
      try { return String(infer(spec)?.fireMode || "anytime"); } catch (_e) {}
    }
    return "anytime";
  }

  // Phase 4D — Surface C: fire-mode action chip (mirrors module.raid-console.js).
  const FM_FIRE_STYLES = {
    "pre-roll":    { lbl: "⏱ at commit",   bg: "rgba(14,58,94,0.35)", fg: "#7fc8ff", brd: "rgba(30,95,140,0.55)", title: "Will fire automatically when the round commits." },
    "anytime":     { lbl: "▶ Fire Now",    bg: "rgba(28,58,28,0.65)", fg: "#bfffbf", brd: "rgba(46,140,46,0.85)", title: "Fire this maneuver now." },
    "post-commit": { lbl: "⏳ on outcome", bg: "rgba(58,46,14,0.35)", fg: "#ffd88c", brd: "rgba(108,84,24,0.55)", title: "Will fire automatically when the round outcome resolves." },
    "fired":       { lbl: "✓ fired",        bg: "rgba(64,64,64,0.45)", fg: "#cfcfcf", brd: "rgba(120,120,120,0.55)", title: "Already fired this round." }
  };
  function fireRowHTML(fireMode, key, side, isFired) {
    const baseStyle = `display:inline-block;padding:1px .4em;border-radius:4px;font-size:.7em;font-weight:600;letter-spacing:.03em;vertical-align:middle;margin-left:.35rem;`;
    if (isFired) {
      const s = FM_FIRE_STYLES.fired;
      return `<span class="bbttcc-fm-fire" data-fired="1" title="${s.title}" style="${baseStyle}background:${s.bg};color:${s.fg};border:1px solid ${s.brd};">${s.lbl}</span>`;
    }
    const s = FM_FIRE_STYLES[fireMode] || FM_FIRE_STYLES.anytime;
    if (fireMode === "anytime") {
      return `<button type="button" class="bbttcc-fm-fire" data-fire-maneuver="${key}" data-fire-side="${side}" title="${s.title}" style="${baseStyle}background:${s.bg};color:${s.fg};border:1px solid ${s.brd};cursor:pointer;">${s.lbl}</button>`;
    }
    return `<span class="bbttcc-fm-fire" data-fm-pending="${fireMode}" title="${s.title}" style="${baseStyle}background:${s.bg};color:${s.fg};border:1px solid ${s.brd};opacity:.85;">${s.lbl}</span>`;
  }
  function roundForLabel(app, lbl) {
    try {
      const tr = lbl.closest?.("tr[data-idx]");
      const idx = Number(tr?.dataset?.idx ?? -1);
      if (idx < 0) return null;
      return app?.vm?.rounds?.[idx] || null;
    } catch (_e) { return null; }
  }
  function wasManFired(round, side, key) {
    return !!round?.meta?.firedManeuvers?.[String(side)]?.[String(key)];
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

  function enhanceManeuvers(appEl, app) {
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

        // Phase 4D — fire-mode chip (PRE/ANY/POS). Also stamps `data-fm-row`
        // on the label so the filter bar in module.raid-console.js can target it.
        const fireMode = resolveFireMode(spec);
        lbl.dataset.fmRow = fireMode;
        const fmBadgeHtml = fireModeBadgeHTML(fireMode);

        // Cost line
        const costStr = costLine(spec.opCosts || spec.cost || {});
        const costHtml = costStr
          ? `<div class="bbttcc-m-cost" style="font-size:0.7rem; opacity:0.9; margin-left:18px; margin-top:0px;">${costStr}</div>`
          : "";

        // Tooltip
        const text = spec.text || "";
        lbl.title = text;

        // Phase 4D — Surface C: per-row fire action chip (anytime → ▶ Fire Now).
        const side = String(cb.dataset.side || "att");
        const round = roundForLabel(app, lbl);
        const fired = wasManFired(round, side, key);
        const roundOpen = !!round?.open && !round?.committed && !round?.cancelled;
        const showFire = (cb.checked || fired) && roundOpen;
        const fireHtml = showFire ? fireRowHTML(fireMode, key, side, fired) : "";

        // ✦ Crew/occult/class grant badge — names the active source that unlocked this maneuver
        // for the side's faction (survey §7a). The enhancer rebuilds the label innerHTML from
        // scratch, so the badge must live HERE (the mkFS copy gets wiped).
        const facId = side === "def" ? round?.defenderId : round?.attackerId;
        const fac = facId ? game.actors.get(facId) : null;
        const grantedBy = fac ? game.bbttcc?.api?.raid?.crewGrants?.grantedBy?.(fac, key) : null;
        const grantHtml = grantedBy
          ? `<span class="bbttcc-crew-grant" title="Unlocked by ${foundry.utils.escapeHTML(fac?.name || "your faction")}'s active crew / association / class: ${foundry.utils.escapeHTML(grantedBy)}" style="margin-left:4px;font-size:0.66rem;font-weight:600;color:#9fe0b0;background:#102818;border:1px solid #3f8a55;border-radius:6px;padding:1px .4em;white-space:nowrap;">✦ ${foundry.utils.escapeHTML(grantedBy)}</span>`
          : "";

        // Rebuild the label content
        lbl.innerHTML = `
          <input type="checkbox" ${cb.checked?"checked":""} data-maneuver="${cb.dataset.maneuver}" data-side="${cb.dataset.side}">
          <span>${baseLabel}</span>
          ${fmBadgeHtml}
          ${badgeHtml}
          ${grantHtml}
          ${costHtml}
          ${fireHtml}
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
    enhanceManeuvers(el, app);
  });

})();
