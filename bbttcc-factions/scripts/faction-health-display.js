// modules/bbttcc-factions/scripts/faction-health-display.js
// BBTTCC — Faction Health + Tabs (render hook)
//
// - Reads real faction flags (victory, unity, morale, loyalty, darkness)
//   and overwrites the "Faction Health" meters after render.
// - Updates the Victory / Unity header strip in #bbttcc-victory-strip.
// - Wires simple tab behavior for .bbttcc-tabs / .bbttcc-tab.

(() => {
  const MODF = "bbttcc-factions";
  const TAG  = "[bbttcc-faction-health]";

  function readHealthFlags(actor) {
    const victory  = actor.getFlag(MODF, "victory")  || {};
    const darkness = actor.getFlag(MODF, "darkness") || {};
    const morale   = actor.getFlag(MODF, "morale");
    const loyalty  = actor.getFlag(MODF, "loyalty");

    return {
      vp: Number(victory.vp ?? 0),
      unity: Number(victory.unity ?? 0),
      morale: Number(morale ?? 0),
      loyalty: Number(loyalty ?? 0),
      darkness: (typeof darkness.global === "number")
        ? darkness.global
        : (typeof darkness === "number" ? darkness : 0),
      badgeLabel: victory.badgeLabel ?? (victory.badge?.label ?? null)
    };
  }

  function initTabs(root) {
    const nav  = root.querySelector(".bbttcc-tabs");
    const body = root.querySelector(".bbttcc-faction-body");
    if (!nav || !body) return;
    if (nav.dataset.bbttccTabsInit === "1") return; // already wired
    nav.dataset.bbttccTabsInit = "1";

    const links = Array.from(nav.querySelectorAll(".item[data-tab]"));
    const panels = Array.from(body.querySelectorAll(".bbttcc-tab[data-tab]"));

    const activate = (tabKey) => {
      if (!tabKey) return;
      links.forEach(l => {
        const active = l.dataset.tab === tabKey;
        l.classList.toggle("is-active", active);
      });
      panels.forEach(p => {
        const active = p.dataset.tab === tabKey;
        p.classList.toggle("is-active", active);
      });
    };

    links.forEach(link => {
      link.addEventListener("click", ev => {
        ev.preventDefault();
        activate(link.dataset.tab);
      });
    });

    // Initial activation from any link already marked active, or first link
    const initial = links.find(l => l.classList.contains("is-active")) || links[0];
    if (initial) activate(initial.dataset.tab);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html /*, data */) => {
    try {
      const actor = app.actor;
      if (!actor) return;

      const root = html[0];
      if (!root) return;

      const vals = readHealthFlags(actor);

      // Faction Health fieldset
      const fieldsets = root.querySelectorAll("fieldset");
      const fs = Array.from(fieldsets).find(f =>
        (f.querySelector("legend")?.textContent || "")
          .trim()
          .toLowerCase() === "faction health"
      );
      if (fs) {
        const meters = fs.querySelectorAll(".bbttcc-meter");
        if (meters?.length) {
          if (meters[0]) meters[0].textContent = String(vals.vp);
          if (meters[1]) meters[1].textContent = `${vals.unity}%`;
          if (meters[2]) meters[2].textContent = `${vals.morale}%`;
          if (meters[3]) meters[3].textContent = `${vals.loyalty}%`;
          if (meters[4]) meters[4].textContent = String(vals.darkness);
        }
      } else {
        console.debug(TAG, "Faction Health fieldset not found on sheet.");
      }

      // Victory / Unity header strip
      const vStrip = root.querySelector("#bbttcc-victory-strip");
      if (vStrip) {
        const vpNode        = vStrip.querySelector('[data-role="vp"]');
        const unityTextNode = vStrip.querySelector('[data-role="unity-text"]');
        const unityFillNode = vStrip.querySelector(".bbttcc-meter-fill");
        const badgeNode     = vStrip.querySelector('[data-role="badge-label"]');

        if (vpNode) vpNode.textContent = String(vals.vp);
        if (unityTextNode) unityTextNode.textContent = `${vals.unity}%`;
        if (unityFillNode) {
          const u = Number.isFinite(vals.unity) ? vals.unity : 0;
          const pct = Math.max(0, Math.min(100, u));
          unityFillNode.style.width = `${pct}%`;
        }

        if (badgeNode) {
          if (vals.badgeLabel) {
            badgeNode.textContent = vals.badgeLabel;
            badgeNode.style.display = "";
          } else {
            badgeNode.textContent = "";
            badgeNode.style.display = "none";
          }
        }
      }

      // Tabs
      initTabs(root);

    } catch (e) {
      console.warn(TAG, "render hook error:", e);
    }
  });

  console.log(TAG, "Faction Health + Tabs render hook installed.");
})();
