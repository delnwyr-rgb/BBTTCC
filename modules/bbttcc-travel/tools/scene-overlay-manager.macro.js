// scene-overlay-manager.macro.js — RUN IN-WORLD (GM). Toggle / remove BBTTCC overlay Tiles.
// ─────────────────────────────────────────────────────────────────────────────
// BAD EDEN · SCENE OVERLAY MANAGER — companion to scene-overlay-helper.macro.js.
// Lists every overlay Tile on the CURRENT scene (those carrying the
// flags["bbttcc-travel"].overlay stamp), with per-overlay show/hide + delete, plus
// bulk Show-all / Hide-all / Delete-all. Use it to declutter, A/B a look, or clean up
// before re-running the placer. Only touches OUR overlay tiles — hand-placed art Tiles
// (no overlay flag) are left alone.
// Self-contained. No ft-deploy / restart needed — paste into a GM Script macro and run.
(async () => {
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  if (!canvas?.scene)   return ui.notifications.warn("No active scene — view a scene first.");

  const MOD = "bbttcc-travel";
  const scene = canvas.scene;
  const log = (...a) => console.log("[overlay-manager]", ...a);

  const overlays = scene.tiles.filter((t) => t.getFlag?.(MOD, "overlay"));
  if (!overlays.length) return ui.notifications.info("No BBTTCC overlays on this scene.");

  const basename = (p) => String(p || "").split("/").pop() || "(no image)";
  const rows = overlays.map((t, i) => {
    const o = t.getFlag(MOD, "overlay") ?? {};
    const dim = `${Math.round(t.width)}×${Math.round(t.height)}`;
    const tags = [o.blend, o.pulse ? "pulse" : null, t.hidden ? "HIDDEN" : null].filter(Boolean).join(" · ");
    return `<tr>
      <td><input type="checkbox" name="sel" value="${t.id}" checked></td>
      <td style="opacity:${t.hidden ? .5 : 1}"><code>${foundry.utils.escapeHTML?.(basename(t.texture?.src)) ?? basename(t.texture?.src)}</code></td>
      <td style="white-space:nowrap"><small>${dim}</small></td>
      <td><small style="opacity:.75">${tags || "normal"}</small></td>
    </tr>`;
  }).join("");

  const content = `
    <p style="margin:0 0 6px"><small style="opacity:.75">Tick the overlays to act on, then choose an action. Bulk buttons act on the ticked rows; “All” buttons ignore the ticks.</small></p>
    <form class="bbttcc-overlay-manager">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;border-bottom:1px solid var(--color-border-light-2,#666)">
          <th><input type="checkbox" name="selAll" checked title="select all"></th>
          <th>Image</th><th>Size</th><th>Look</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </form>
    <p style="margin:8px 0 0"><small style="opacity:.6">${overlays.length} overlay(s) on “${foundry.utils.escapeHTML?.(scene.name) ?? scene.name}”.</small></p>`;

  const DialogV2 = foundry.applications.api?.DialogV2;
  if (!DialogV2) return ui.notifications.error("DialogV2 unavailable — update Foundry.");

  const selectedIds = (dlg) =>
    [...dlg.element.querySelectorAll('input[name="sel"]:checked')].map((el) => el.value);

  const result = await DialogV2.wait({
    window: { title: "Scene Overlay Manager" },
    content,
    rejectClose: false,
    render: (_ev, dlg) => {
      // "select all" header checkbox drives the row checkboxes.
      const all = dlg.element.querySelector('input[name="selAll"]');
      all?.addEventListener("change", () => {
        dlg.element.querySelectorAll('input[name="sel"]').forEach((el) => { el.checked = all.checked; });
      });
    },
    buttons: [
      { action: "hide",      label: "Hide ticked",   callback: (_e, _b, d) => ({ op: "hide",   ids: selectedIds(d) }) },
      { action: "show",      label: "Show ticked",   callback: (_e, _b, d) => ({ op: "show",   ids: selectedIds(d) }) },
      { action: "delete",    label: "Delete ticked", callback: (_e, _b, d) => ({ op: "delete", ids: selectedIds(d) }) },
      { action: "hideAll",   label: "Hide all",      callback: () => ({ op: "hide",   ids: overlays.map((t) => t.id) }) },
      { action: "showAll",   label: "Show all",      callback: () => ({ op: "show",   ids: overlays.map((t) => t.id) }) },
      { action: "deleteAll", label: "Delete ALL",    callback: () => ({ op: "delete", ids: overlays.map((t) => t.id) }) },
      { action: "cancel",    label: "Close", default: true },
    ],
  });
  if (!result || result === "cancel" || !result.ids?.length) return;

  const { op, ids } = result;
  if (op === "delete") {
    if (op === "delete" && ids.length === overlays.length) {
      const ok = await DialogV2.confirm({
        window: { title: "Delete overlays?" },
        content: `<p>Delete <b>${ids.length}</b> overlay tile(s) on this scene? This can’t be undone.</p>`,
      });
      if (!ok) return;
    }
    await scene.deleteEmbeddedDocuments("Tile", ids);
    log(`deleted ${ids.length}`);
    return ui.notifications.info(`Deleted ${ids.length} overlay(s).`);
  }

  const hidden = op === "hide";
  await scene.updateEmbeddedDocuments("Tile", ids.map((id) => ({ _id: id, hidden })));
  log(`${op} ${ids.length}`);
  ui.notifications.info(`${hidden ? "Hid" : "Showed"} ${ids.length} overlay(s).`);
})();
