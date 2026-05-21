// BBTTCC — Courtly Tableau Phase A spike: test harness macro
// ─────────────────────────────────────────────────────────────────────────────
// Drop this into your macro hotbar (or run via the script-macro creator).
// Provides a tiny GM control panel for the depth-scale tableau spike:
//   1. Enable / disable tableau on the current scene
//   2. Adjust frontY (close, scale 1.0) and backY (far, scale min)
//   3. Mark/unmark all currently-selected tokens as tableau actors
//   4. Read the current config back to chat
//
// Tableau API surface (also usable from console):
//   game.bbttcc.api.raid.tableau.enable({ frontY: 800, backY: 200 })
//   game.bbttcc.api.raid.tableau.setFrontBack(900, 150)
//   game.bbttcc.api.raid.tableau.markActor(canvas.tokens.controlled[0], true)
//   game.bbttcc.api.raid.tableau.readConfig()
//   game.bbttcc.api.raid.tableau.disable()
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) {
    ui.notifications.warn("Tableau spike: GM only.");
    return;
  }
  const api = foundry.utils.getProperty(game, "bbttcc.api.raid.tableau");
  if (!api) {
    ui.notifications.error("Tableau spike script not loaded. Check bbttcc-raid module.");
    return;
  }
  const scene = canvas?.scene;
  if (!scene) {
    ui.notifications.warn("No active scene.");
    return;
  }

  const cur = api.readConfig(scene);
  const sh  = scene.dimensions?.sceneHeight ?? 1080;
  const def = {
    frontY: Number(cur.frontY ?? Math.round(sh * 0.85)),
    backY:  Number(cur.backY  ?? Math.round(sh * 0.20)),
    minScale: Number(cur.minScale ?? 0.40),
    maxScale: Number(cur.maxScale ?? 1.00)
  };
  const selectedIds = canvas.tokens?.controlled?.map(t => t.id) ?? [];
  const selCount = selectedIds.length;

  const content = `
    <form>
      <p class="hint" style="margin-bottom:8px;">
        <b>Tableau status:</b> ${cur.enabled ? "✅ ENABLED" : "⛔ disabled"} on <b>${scene.name}</b>.
        Scene height: ${sh}px.
      </p>
      <div class="form-group"><label>Front Y (closest, scale ${def.maxScale})</label>
        <input type="number" name="frontY" value="${def.frontY}" step="10"/></div>
      <div class="form-group"><label>Back Y (farthest, scale ${def.minScale})</label>
        <input type="number" name="backY" value="${def.backY}" step="10"/></div>
      <div class="form-group"><label>Min scale</label>
        <input type="number" name="minScale" value="${def.minScale}" step="0.05" min="0.10" max="1.00"/></div>
      <div class="form-group"><label>Max scale</label>
        <input type="number" name="maxScale" value="${def.maxScale}" step="0.05" min="0.10" max="2.00"/></div>
      <hr/>
      <p class="hint">Selected tokens: <b>${selCount}</b>. The "Mark Selected" buttons below will toggle
        <code>flags.bbttcc-raid.tableauActor</code> on each.</p>
    </form>
  `;

  new Dialog({
    title: "Courtly Tableau — Phase A Spike",
    content,
    buttons: {
      enable: {
        label: "Enable + Apply",
        callback: async (html) => {
          const f = html[0].querySelector("form");
          const partial = {
            frontY:   Number(f.frontY.value),
            backY:    Number(f.backY.value),
            minScale: Number(f.minScale.value),
            maxScale: Number(f.maxScale.value)
          };
          const next = await api.enable(partial, scene);
          ChatMessage.create({
            whisper: [game.user.id],
            content: `<b>Tableau enabled on ${scene.name}</b><br/>${JSON.stringify(next, null, 2).replace(/\n/g, "<br/>")}`
          });
        }
      },
      mark: {
        label: `Mark ${selCount} as Courtier`,
        callback: async () => {
          if (!selCount) return ui.notifications.warn("No tokens selected.");
          for (const id of selectedIds) {
            const tk = canvas.tokens.get(id);
            if (tk) await api.markActor(tk, true);
          }
          ui.notifications.info(`Marked ${selCount} token(s) as tableau actors.`);
        }
      },
      unmark: {
        label: `Unmark ${selCount}`,
        callback: async () => {
          if (!selCount) return ui.notifications.warn("No tokens selected.");
          for (const id of selectedIds) {
            const tk = canvas.tokens.get(id);
            if (tk) await api.markActor(tk, false);
          }
          ui.notifications.info(`Unmarked ${selCount} token(s).`);
        }
      },
      disable: {
        label: "Disable",
        callback: async () => {
          await api.disable(scene);
          ui.notifications.info("Tableau disabled. Tokens restored to vanilla scale.");
        }
      },
      cancel: { label: "Close" }
    },
    default: "enable"
  }, { width: 480 }).render(true);
})();
