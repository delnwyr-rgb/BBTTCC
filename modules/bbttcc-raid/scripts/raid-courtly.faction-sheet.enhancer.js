// scripts/raid-courtly.faction-sheet.enhancer.js
//
// BBTTCC — Courtly Intrigue Faction Sheet badges (Phase E)
// Spec: bbttcc-raid/COURTLY_INTRIGUE_SPEC.md §6
//
// Renders Scandal Scar badges on the faction sheet header. Light scars
// stack as a count; heavy scars get their own "Disgraced" pip that
// auto-clears after the timestamp window (~3 weekly sessions, currently
// hardcoded at 3 weeks via state.flags.bbttcc-raid.disgracedUntil).

(() => {
  const MOD_R = "bbttcc-raid";
  const TAG   = "[bbttcc-raid:courtly-faction-badge]";

  function _readScars(actor) {
    const arr = actor?.flags?.[MOD_R]?.scandalScars;
    return Array.isArray(arr) ? arr : [];
  }

  function _buildBadgeHtml(actor) {
    const scars = _readScars(actor);
    const light = scars.filter(s => s.severity === "light").length;
    const heavy = scars.filter(s => s.severity === "heavy").length;
    const disgracedUntil = Number(actor.flags?.[MOD_R]?.disgracedUntil || 0);
    const isDisgraced = disgracedUntil > Date.now();
    const capDelta = Number(actor.flags?.[MOD_R]?.nextCourtlyInfluenceCapDelta || 0);

    if (!light && !heavy && !isDisgraced && !capDelta) return "";

    const pills = [];
    if (light) {
      pills.push(`<span title="Light Scandal Scar — −2 to first roll of next courtly raid. Cleared by Clean Triumph." style="font-size:0.7rem;padding:1px 6px;border:1px solid #ffaa55;border-radius:8px;color:#ffaa55;background:rgba(255,170,85,0.08);">⚠ Scandal ×${light}</span>`);
    }
    if (heavy || isDisgraced) {
      const cnt = heavy || 1;
      pills.push(`<span title="Heavy Scandal Scar — −3 + −1 to first two rolls of next courtly raid. Disgraced for ~3 sessions." style="font-size:0.7rem;padding:1px 6px;border:1px solid #ff5555;border-radius:8px;color:#ff5555;background:rgba(255,85,85,0.10);font-weight:600;">💔 Disgraced ×${cnt}</span>`);
    }
    if (capDelta) {
      pills.push(`<span title="Influence cap penalty pending on next courtly raid" style="font-size:0.7rem;padding:1px 6px;border:1px solid #88aaff;border-radius:8px;color:#88aaff;background:rgba(136,170,255,0.08);">♕ Inf ${capDelta > 0 ? "+" : ""}${capDelta} next raid</span>`);
    }

    return `<div class="ft-courtly-scar-badges" data-bbttcc-courtly-badges="1" style="display:flex;flex-wrap:wrap;gap:4px;margin:.3rem .5rem .1rem;padding:.25rem .4rem;border-radius:4px;background:rgba(20,20,28,0.5);border:1px solid #333;">
      <span style="font-size:0.7rem;color:#888;letter-spacing:.04em;align-self:center;">COURTLY:</span>
      ${pills.join("")}
    </div>`;
  }

  function _injectBadges(app, root) {
    const actor = app?.actor;
    if (!actor) return;
    // Avoid duplicate inject on re-render
    root.querySelectorAll(":scope .ft-courtly-scar-badges[data-bbttcc-courtly-badges]").forEach(n => n.remove());
    const html = _buildBadgeHtml(actor);
    if (!html) return;
    // Inject right under the window header — prefer the form's first
    // header section, fall back to the sheet's article root.
    const target = root.querySelector(".sheet-header, header, .window-content") || root;
    const tpl = document.createElement("div");
    tpl.innerHTML = html;
    target.insertBefore(tpl.firstElementChild, target.firstChild);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const root = (html && html[0]) ? html[0] : (app?.element?.[0] || app?.element);
      if (!root) return;
      _injectBadges(app, root);
    } catch (e) { console.warn(TAG, "render hook failed", e); }
  });

  // Also re-render when courtly state flags change so the badge updates
  // live without needing the sheet to re-open.
  Hooks.on("updateActor", (actor, changes) => {
    try {
      const touched = foundry.utils.getProperty(changes, `flags.${MOD_R}.scandalScars`) !== undefined
                   || foundry.utils.getProperty(changes, `flags.${MOD_R}.disgracedUntil`) !== undefined
                   || foundry.utils.getProperty(changes, `flags.${MOD_R}.nextCourtlyInfluenceCapDelta`) !== undefined;
      if (!touched) return;
      // Find any open sheet for this actor and re-render.
      for (const app of Object.values(actor?.apps || {})) {
        if (app?.rendered) app.render(false);
      }
    } catch (e) { console.warn(TAG, "updateActor reflow failed", e); }
  });

  console.log(TAG, "Phase E faction sheet badges ready.");
})();
