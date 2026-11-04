// modules/bbttcc-territory/scripts/bbttcc-toolbar-augment.enhancer.js
// Bad Eden Hex Chrome HUD toolbar augment — top control bar edition

(() => {
  const TAG = "[bbttcc-ui/toolbar-augment]";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  function killLegacyTravelPills() {
    try {
      const ids = ["bbttcc-travel-console-btn", "bbttcc-travel-mode-btn"];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.remove();
      }
    } catch (e) {
      warn("killLegacyTravelPills error", e);
    }
  }

  function getToolbarRoot() {
    return document.getElementById("bbttcc-toolbar")
      || document.querySelector("[data-bbttcc-toolbar]")
      || document.querySelector(".bbttcc-toolbar");
  }

  function getMainRow(toolbar) {
    return toolbar?.querySelector(".bbttcc-toolbar-main")
      || toolbar?.querySelector(".row")
      || toolbar;
  }

  function ensureButton(toolbar, { id, label, icon, onClick }) {
    if (!toolbar) return;
    let btn = toolbar.querySelector(`#${id}`);
    if (btn) return;

    const row = getMainRow(toolbar);

    btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.className = "bbttcc-btn";
    btn.innerHTML = `<i class="fas fa-${icon}"></i><span>${label}</span>`;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      try {
        onClick();
      } catch (e) {
        warn(`Button ${id} click handler error`, e);
      }
    }, { capture: true });

    row.appendChild(btn);
  }

  function augmentToolbar() {
    try {
      const toolbar = getToolbarRoot();
      killLegacyTravelPills();
      if (!toolbar) return;

      const overviewButtons = toolbar.querySelectorAll("#bbttcc-overview-btn");
      if (overviewButtons.length > 1) {
        for (let i = 1; i < overviewButtons.length; i++) overviewButtons[i].remove();
        log(`Removed ${overviewButtons.length - 1} duplicate Overview button(s).`);
      }

      // "Return to World Map" — every scene gets a way home. The hub is the
      // scene flagged bbttcc-travel.isWorldHub; ride the shared transition
      // primitive so the zoom-out/flash matches every other scene move.
      // Dave 2026-10-30: the button goes to "The Whole Map" (all 141 hexes on one scene, 10-26) — the flagged hub only as
      // the fallback. The isWorldHub flag itself is untouched (ride fallbacks + return links still read it).
      const hub = game.scenes?.find?.(s => /the whole map/i.test(String(s.name || "")))
        || game.scenes?.find?.(s => s.getFlag?.("bbttcc-travel", "isWorldHub"));
      if (hub) {
        ensureButton(toolbar, {
          id: "bbttcc-btn-world-map",
          label: "World Map",
          icon: "globe",
          onClick: () => {
            if (canvas?.scene?.id === hub.id) {
              ui.notifications?.info?.("Already on the world map.");
              return;
            }
            const back = game.bbttcc?.api?.transition?.back;
            if (back) back(hub.uuid, { label: "World Map" });
            else hub.view();
          }
        });
      }

      const bbttccUi = game.bbttcc?.ui || {};
      if (bbttccUi.travelConsole) {
        ensureButton(toolbar, {
          id: "bbttcc-btn-travel-console",
          label: "Travel Console",
          icon: "route",
          // Dave 2026-11-02: "Opening the travel console is supposed to automatically open the Main Map, like the planner button
          // does" — the console reads hexes off the viewed canvas, so from a town or a battlemap it had nothing to plan on.
          onClick: async () => {
            try {
              const hasHexes = (sc) => (sc?.drawings?.contents || []).some(d => { const f = d.flags?.["bbttcc-territory"]; return !!(f && (f.isHex || f.kind === "territory-hex" || f.name)); });
              if (!hasHexes(canvas?.scene)) {
                const map = game.scenes?.find?.(s => /the whole map/i.test(String(s.name || ""))) || game.scenes?.find?.(s => s.getFlag?.("bbttcc-travel", "isWorldHub"));
                if (map) { const back = game.bbttcc?.api?.transition?.back; if (back) await back(map.uuid, { label: "World Map" }); else await map.view(); }
              }
            } catch (e) { console.warn("[bbttcc-ui/toolbar-augment] travel console → main map failed", e); }
            bbttccUi.travelConsole.render(true);
          }
        });
      }

      const terrApi = game.bbttcc?.api?.territory;
      if (terrApi) {
        ensureButton(toolbar, {
          id: "bbttcc-btn-turn-driver",
          label: "Turn Driver",
          icon: "forward",
          onClick: async () => {
            try {
              if (!game.user?.isGM) {
                ui.notifications?.warn?.("Only the GM can advance the turn.");
                return;
              }

              // Lock the Turn and this button both land here. A second confirm left
              // open would still say Yes after the first one had advanced the month.
              if (window.__bbttccAdvanceConfirmOpen) return;

              const sceneId = canvas?.scene?.id || null;

              // Turn Ledger (2026-07-08): show where the month stands before
              // the GM commits — unspent days bank into development, overspend
              // carries into the next month as debt.
              let ledgerLine = "";
              try {
                const lg = game.bbttcc?.api?.campaign?.ledger?.get?.();
                if (lg && lg.budget > 0) {
                  // Phase 4 (2026-09-13): the turn is a chapter break; days are a prompt, not a budget.
                  // Month framing (Dave 2026-10-28): the Advance IS the rest of the month — the Domain's orders.
                  const month = Math.max(1, Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 1);
                  const _over = Math.round(((Number(lg.spent) || 0) - (Number(lg.budget) || 30)) * 10) / 10;
                  // 2026-11-02 (failure pass): past day 30 there are no "weeks the Stewards weren't watching" left — say so.
                  if (_over > 0) ledgerLine = `<p><i class="fas fa-hourglass-half"></i> <b>Month ${month}, Day ${lg.spent}</b> — the Stewards ran ${_over} day${_over === 1 ? "" : "s"} past the month's end. The Domain's orders, builds, contracts and rigs still land as it closes. Month ${month + 1} begins.</p>`;
                  else ledgerLine = `<p><i class="fas fa-hourglass-half"></i> <b>Month ${month}, Day ${lg.spent}</b> — the rest of Month ${month} passes: the weeks the Stewards weren't watching, when the Domain's orders, builds, contracts and rigs do their work. Month ${month + 1} begins.</p>`;
                }
              } catch (_eLg) {}

              window.__bbttccAdvanceConfirmOpen = true;
              const ok = await Dialog.confirm({
                title: "Advance Turn",
                content: `<p>Advance the strategic turn now? This will apply all pending effects.</p>${ledgerLine}`,
                yes: () => true,
                no: () => false,
                defaultYes: false,
                // Self-theme with HexChrome so it doesn't depend on the global
                // renderDialog hook (which doesn't catch this confirm on v14).
                options: { classes: ["dialog", "bbttcc-hexchrome-dialog"] }
              }).catch(() => false).finally(() => { window.__bbttccAdvanceConfirmOpen = false; });

              if (!ok) return;

              if (typeof terrApi.advanceTurn === "function") {
                // runAdvance holds the WORLD turn lock across every wrapper (strategic review #10, 2026-10-28).
                const run = game.bbttcc?.api?.turn?.runAdvance || ((a) => terrApi.advanceTurn(a));
                const result = await run({ apply: true, sceneId });
                console.log("[bbttcc-ui] Turn advanced via toolbar:", result);
              } else {
                console.warn("[bbttcc-ui] Turn Driver: advanceTurn API not available.");
                ui.notifications?.error?.("Turn Driver: advanceTurn API not available.");
              }
            } catch (e) {
              console.warn("[bbttcc-ui] Turn Driver button error", e);
              ui.notifications?.error?.("Turn Driver encountered an error. See console for details.");
            }
          }
        });
      }

      killLegacyTravelPills();
      log("Bad Eden control bar augmented (World Map + Travel Console + Turn Driver).");
    } catch (e) {
      warn("augmentToolbar error", e);
    }
  }

  function refresh() {
    setTimeout(augmentToolbar, 0);
  }

  // THE MONTH IS SPENT — PROMPT (Dave 2026-11-02, failure pass: "I think we should TOTALLY prompt when 30 days is hit"). Still no
  // auto-advance (the GM's Turn Driver alone ends a month); the primary GM is simply asked, once per month, the moment a debit carries
  // the day count to the month's length or past it. "Lock the Turn" opens the same Turn Driver confirm the toolbar button does.
  Hooks.on("bbttcc:time:accrued", (p) => {
    try {
      if (!game.user?.isGM) return;
      const gx = game.bbttcc?.api?.gmExec; const prim = (typeof gx?.primaryGmId === "function") ? gx.primaryGmId() : game.users?.activeGM?.id;
      if (prim && prim !== game.user.id) return;
      const budget = Number(p?.budget) || 0, spent = Number(p?.spent) || 0, pts = Number(p?.points) || 0;
      if (!(budget > 0) || spent < budget || (spent - pts) >= budget) return;   // only the debit that crosses the line
      const month = Math.max(1, Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 1);
      if (globalThis.__bbttccMonthPrompted === month) return; globalThis.__bbttccMonthPrompted = month;
      new Dialog({
        title: `Month ${month} is spent`,
        content: `<p><i class="fas fa-hourglass-end"></i> The Stewards have used all <b>${budget}</b> days of <b>Month ${month}</b> (Day ${spent}).</p><p>Lock the turn now and let the Domain's month land? Keep playing and the days run past the month's end — nothing carries over, but the month doesn't end until the Turn Driver runs.</p>`,
        buttons: {
          lock: { icon: '<i class="fas fa-forward"></i>', label: "Lock the Turn", callback: () => { try { document.getElementById("bbttcc-btn-turn-driver")?.click(); } catch (_e) {} } },
          keep: { icon: '<i class="fas fa-person-walking"></i>', label: "Keep playing" }
        },
        default: "lock"
      }, { classes: ["dialog", "bbttcc-hexchrome-dialog"] }).render(true);
    } catch (e) { console.warn("[bbttcc-ui/toolbar-augment] month-spent prompt failed", e); }
  });

  Hooks.on("ready", refresh);
  Hooks.on("canvasReady", refresh);
  Hooks.on("renderSceneControls", refresh);
})();