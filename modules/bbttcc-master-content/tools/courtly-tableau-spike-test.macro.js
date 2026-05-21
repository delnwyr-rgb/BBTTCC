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
  // Absolute canvas coords. sceneY/sceneHeight from scene.dimensions account
  // for padding so the depth zone covers the actual scene rectangle, not
  // a window mis-offset by Foundry's padding inflation.
  const dims = scene.dimensions || {};
  const sy   = Number(dims.sceneY ?? 0);
  const sh   = Number(dims.sceneHeight ?? 1080);
  // Depth zone covers the upper 80% of the scene by default; bottom 10%
  // of scene reserved as the "footlights" frame.
  const def = {
    frontY:   Number(cur.frontY   ?? Math.round(sy + sh * 0.90)),
    backY:    Number(cur.backY    ?? Math.round(sy + sh * 0.10)),
    minScale: Number(cur.minScale ?? 0.25),
    maxScale: Number(cur.maxScale ?? 1.00),
    curve:    Number(cur.curve    ?? 1.8)
  };
  const selectedIds = canvas.tokens?.controlled?.map(t => t.id) ?? [];
  const selCount = selectedIds.length;

  const content = `
    <form>
      <p class="hint" style="margin-bottom:8px;">
        <b>Tableau status:</b> ${cur.enabled ? "✅ ENABLED" : "⛔ disabled"} on <b>${scene.name}</b>.<br/>
        Scene area: Y ∈ [${sy}, ${sy + sh}] (${sh}px tall).
      </p>
      <div class="form-group"><label>Front Y (closest, scale ${def.maxScale})</label>
        <input type="number" name="frontY" value="${def.frontY}" step="10"/></div>
      <div class="form-group"><label>Back Y (farthest, scale ${def.minScale})</label>
        <input type="number" name="backY" value="${def.backY}" step="10"/></div>
      <div class="form-group"><label>Min scale (back wall)</label>
        <input type="number" name="minScale" value="${def.minScale}" step="0.05" min="0.05" max="1.00"/></div>
      <div class="form-group"><label>Max scale (foreground)</label>
        <input type="number" name="maxScale" value="${def.maxScale}" step="0.05" min="0.10" max="2.00"/></div>
      <div class="form-group"><label>Curve (1.0 = linear, &gt;1 = aggressive falloff)</label>
        <input type="number" name="curve" value="${def.curve}" step="0.1" min="0.2" max="4.0"/></div>
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
            maxScale: Number(f.maxScale.value),
            curve:    Number(f.curve.value)
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
