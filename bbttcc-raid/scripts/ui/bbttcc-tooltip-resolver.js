/* bbttcc-raid/scripts/ui/bbttcc-tooltip-resolver.js
 * Global tooltip resolver for BBTTCC (Raid + Planner)
 * - Canonical text hydration from Expansion v1.0 (PDF) for keys that lack descriptions.
 * - Safe, parser-friendly JS (no optional chaining / nullish / spread).
 */
(() => {
  const TAG = "[bbttcc-tooltips/resolver]";

  function lc(s){ return String(s || "").toLowerCase(); }
  function normKey(k){
    // normalize dash/space/case into snake_case
    return lc(k).trim().replace(/[\s\-]+/g, "_").replace(/_+/g, "_");
  }

  // ---------------------------------------------------------------------------
  // Canonical fallback descriptions (Expansion v1.0 — pages 1–2)
  // Keys here are the EFFECTS keys you actually use (snake_case).
  // ---------------------------------------------------------------------------
  const FALLBACK_TEXT = {
    // Maneuvers (in-round)
    suppressive_fire:          "Force enemy reroll lowest d20 this round.",
    smoke_and_mirrors:         "Reduce Alarm Level by 1.",
    rally_the_line:            "+1 to next attack/defense for allies.",
    patch_the_breach:          "Restore 1 Structure Point.",
    flash_bargain:             "Borrow +1 enemy OP for this round.",
    saboteurs_edge:            "Ignore one Fortified modifier this turn.",
    bless_the_fallen:          "Negate first casualty this round.",
    logistical_surge:          "Repeat last round's maneuver at no cost.",
    command_overdrive:         "Gain initiative for next round.",
    psychic_disruption:        "Opponents roll at Disadvantage this round.",
    echo_strike_protocol:      "Apply attack effect twice vs different targets.",
    moral_high_ground:         "+2 to Empathy Meter after victory.",
    quantum_shield:            "Reduce incoming damage by half for one round.",
    overclock_the_golems:      "+3 attack for one construct unit; loses 1 HP.",
    counter_propaganda_wave:   "Cancel enemy Soft Power effect this round.",
    sephirotic_intervention:   "Auto-win one opposed roll; Darkness −1.",
    ego_breaker:               "Reduce enemy leader’s OP cap by 3 permanently.",
    reality_hack:              "Re-run last round as if it never occurred.",
    unity_surge:               "All allies gain +2 to every OP next round.",
    qliphothic_gambit:         "+6 to Violence roll; Darkness +2.",

    // Strategic Activities (strategic turn)
    harvest_season:            "+1 Economy regen next turn.",
    recon_sweep:               "Reveal alignment of 1 adjacent Hex.",
    ration_distribution:       "+1 Loyalty to one controlled Hex.",
    minor_repair:              "Remove 'Damaged Infrastructure'.",
    local_festival:            "+1 Empathy Meter.",
    smuggling_network:         "Establish 1 Trade Route (+1 Diplomacy regen).",
    training_drills:           "Increase Violence cap +1 for 2 turns.",
    reconstruction_drive:      "Upgrade Hex status to 'Claimed'.",
    cultural_exchange:         "Share Alignment bonus between Hexes.",
    spy_insertion:             "Reveal enemy OP pools next turn.",
    terraforming_project:      "Cleanse 1 Corrupted Hex.",
    alliance_summit:           "Merge resources for 1 Strategic Turn.",
    industrial_revolution:     "Double Economy output for 2 turns.",
    psych_ops_broadcast:       "−2 Loyalty to enemy Hex.",
    purification_rite:         "Reduce Darkness Track −2.",
    great_work_ritual:         "Trigger Tikkun Phase C for one Spark.",
    mass_mobilization:         "+25% OP generation next turn, then −25%.",
    enlightenment_congress:    "Raise Enlightenment for all PCs by 1.",
    project_eden:              "Create 'Garden City' Hex aligned to Tiferet.",
    apocalyptic_weapon_test:   "Destroy enemy Hex; Darkness +3."
  };

  // ---------------------------------------------------------------------------
  // Helpers to pull the best available description from multiple sources
  // ---------------------------------------------------------------------------
  function extractTextFromEffectsDef(def){
    // Prefer explicit text fields (our convention)
    if (def && typeof def.text === "string" && def.text.trim()) return def.text.trim();
    if (def && typeof def.description === "string" && def.description.trim()) return def.description.trim();

    // Planner JSON convention: effects.text
    const fx = def && def.effects;
    if (fx && typeof fx.text === "string" && fx.text.trim()) return fx.text.trim();

    // Some defs use effects object (like { autowin: "..."}); stringify lightly
    if (fx && typeof fx === "object") {
      if (typeof fx.effect === "string" && fx.effect.trim()) return fx.effect.trim();
      // pick first short string value if present
      for (const k in fx) {
        if (!Object.prototype.hasOwnProperty.call(fx, k)) continue;
        const v = fx[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
    }
    return "";
  }

  function dominantOpKey(cost){
    // Find the largest OP cost key for display ordering hints (optional)
    if (!cost || typeof cost !== "object") return "";
    let bestK = "", bestV = -1;
    for (const k in cost) {
      if (!Object.prototype.hasOwnProperty.call(cost, k)) continue;
      const v = Number(cost[k] || 0);
      if (v > bestV) { bestV = v; bestK = k; }
    }
    return bestV > 0 ? bestK : "";
  }

  function formatCostLine(cost){
    if (!cost || typeof cost !== "object") return "";
    const parts = [];
    for (const k in cost) {
      if (!Object.prototype.hasOwnProperty.call(cost, k)) continue;
      const v = Number(cost[k] || 0);
      if (!v) continue;
      parts.push(`${k}:${v}`);
    }
    return parts.length ? parts.join(", ") : "";
  }

  function resolveFromRaidEffects(kind, key){
    try {
      const raid = (game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.raid) ? game.bbttcc.api.raid : null;
      const E = raid ? raid.EFFECTS : null;
      if (!E) return null;

      const def = E[key] || null;
      if (!def) return null;

      // kind sanity (optional)
      if (kind && def.kind && String(def.kind) !== String(kind)) {
        // still allow if caller asked for "strategic" and def says "strategic", etc.
      }

      return { key: key, def: def };
    } catch (e) {
      return null;
    }
  }

  function getFallbackText(key, def){
    const k = normKey(key);
    if (FALLBACK_TEXT[k]) return FALLBACK_TEXT[k];

    // Also try to resolve by label → normalized (for edge cases)
    const label = def && (def.label || def.name);
    const lk = normKey(label || "");
    if (lk && FALLBACK_TEXT[lk]) return FALLBACK_TEXT[lk];

    return "";
  }

  function buildTooltipHTML(kind, key, def){
    const label = String(def.label || def.name || key || "—");
    const tier = (def.tier != null) ? String(def.tier) : "";
    const rarity = def.rarity ? String(def.rarity) : "";
    const raidTypes = Array.isArray(def.raidTypes) ? def.raidTypes.slice() : (def.raidTypes ? [def.raidTypes] : []);
    const defenderAccess = def.defenderAccess ? String(def.defenderAccess) : "";
    const storyOnly = def.storyOnly === true;

    const cost = def.opCosts || def.cost || {};
    const costLine = formatCostLine(cost);

    let text = extractTextFromEffectsDef(def);
    if (!text) text = getFallbackText(key, def);

    const lines = [];
    lines.push(`<div class="bbttcc-tip-title">${escapeHtml(label)}</div>`);

    if (text) lines.push(`<div class="bbttcc-tip-text">${escapeHtml(text)}</div>`);

    const meta = [];
    if (costLine) meta.push(`<b>Cost</b>: ${escapeHtml(costLine)}`);
    if (tier) meta.push(`<b>Tier</b>: T${escapeHtml(tier)}`);
    if (rarity) meta.push(`<b>Rarity</b>: ${escapeHtml(rarity)}`);
    if (storyOnly) meta.push(`<b>Resolution</b>: Story-driven`);
    if (kind === "maneuver" && raidTypes.length) meta.push(`<b>Modes</b>: ${escapeHtml(raidTypes.join(", "))}`);
    if (kind === "maneuver" && defenderAccess) meta.push(`<b>Defender</b>: ${escapeHtml(defenderAccess)}`);

    if (meta.length) lines.push(`<div class="bbttcc-tip-meta">${meta.join("<br>")}</div>`);

    return `<div class="bbttcc-tip">${lines.join("")}</div>`;
  }

  function escapeHtml(s){
    return String(s || "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  // Public API
  function getBBTTCCTooltip(opts){
    opts = opts || {};
    const kind = String(opts.kind || "");
    const keyRaw = String(opts.key || "");
    if (!keyRaw) return { html:"", text:"" };

    // Most callers use EFFECTS keys; normalize but keep original for lookup attempts
    const key = keyRaw;

    // 1) Prefer raid EFFECTS registry
    const hit = resolveFromRaidEffects(kind, key);
    if (hit && hit.def) {
      const html = buildTooltipHTML(kind, key, hit.def);
      const text = (extractTextFromEffectsDef(hit.def) || getFallbackText(key, hit.def) || "");
      return { html: html, text: text, label: hit.def.label || hit.def.name || key };
    }

    // 2) Fallback only (no EFFECTS)
    const faux = { label: keyRaw, kind: kind, cost: {} };
    const html2 = buildTooltipHTML(kind, normKey(keyRaw), faux);
    const text2 = getFallbackText(keyRaw, faux);
    return { html: html2, text: text2, label: keyRaw };
  }

  // Export globally (so Raid + Planner + any future app can share the same resolver)
  globalThis.BBTTCC_GetTooltip = getBBTTCCTooltip;

  try { console.log(TAG, "ready"); } catch (e) {}
})();
