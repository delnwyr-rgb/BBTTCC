/* =========================================================================
 * Bad Eden — Start Chase (GM macro)
 * =========================================================================
 * Sets up a rig chase via game.bbttcc.api.travel.chase.start(...).
 * Pick quarry + pursuer (faction, or a manual side like "Raider Buggies"),
 * then a route of 3-5 terrain legs (comma-separated keys — see the datalist —
 * and/or click hexes on the canvas with "Pick hexes" armed).
 * The Chase Console opens automatically once started.
 * ========================================================================= */
(async () => {
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const chase = game.bbttcc?.api?.travel?.chase;
  if (!chase) return ui.notifications.error("Chase API not ready (bbttcc-travel/chase.js not loaded?).");
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  const FCT = "bbttcc-factions";
  const factions = game.actors
    .filter(a => a?.getFlag?.(FCT, "isFaction") || a?.flags?.[FCT]?.isFaction)
    .sort((a, b) => a.name.localeCompare(b.name));
  const factionOpts = (sel) =>
    `<option value="">— Manual side —</option>` +
    factions.map(f => `<option value="${f.id}" ${f.id === sel ? "selected" : ""}>${esc(f.name)}</option>`).join("");

  const terrainKeys = Object.keys(chase._consts?.TERRAIN_LABELS ?? {});
  const datalist = `<datalist id="chase-terrains">${terrainKeys.map(k => `<option value="${k}">`).join("")}</datalist>`;

  const sideBlock = (tag, label) => `
    <fieldset style="border:1px solid #445; border-radius:6px; margin-bottom:6px">
      <legend>${label}</legend>
      <div class="form-group"><label>Faction</label>
        <select name="${tag}-faction">${factionOpts()}</select></div>
      <div class="form-group"><label>Manual name</label>
        <input type="text" name="${tag}-name" placeholder="e.g. Raider Buggies (manual side only)"/></div>
      <div class="form-group"><label>Manual speed / tier / bonus</label>
        <input type="number" name="${tag}-speed" value="3" style="width:4em"/>
        <input type="number" name="${tag}-tier" value="1" style="width:4em"/>
        <input type="number" name="${tag}-bonus" value="0" style="width:4em"/></div>
    </fieldset>`;

  const picked = []; // hex uuids picked by canvas clicks
  let picking = false;

  const content = `
    <form>
      ${sideBlock("q", "🏃 Quarry (the one running)")}
      ${sideBlock("p", "🏹 Pursuer (the one hunting)")}
      <div class="form-group"><label>Route (terrain keys, comma-separated)</label>
        <input type="text" name="route" list="chase-terrains" placeholder="badlands, badlands, river"/>${datalist}</div>
      <div class="form-group">
        <button type="button" class="chase-pick">🖱️ Pick hexes on canvas</button>
        <span class="chase-picked" style="font-size:0.8rem;opacity:0.8">0 hexes picked</span>
      </div>
      <div class="form-group"><label>Start lead / escape at</label>
        <input type="number" name="lead" value="3" style="width:4em"/>
        <input type="number" name="escapeAt" value="6" style="width:4em"/></div>
      <div class="form-group"><label>Label</label>
        <input type="text" name="label" placeholder="e.g. The Circuit Rider Doesn't Stop Twice"/></div>
    </form>
    <p style="font-size:0.78rem;opacity:0.75">Faction sides auto-pick their fastest mobile rig + boarded pilot.
    Typed terrain legs and picked hexes combine (typed first). 3-5 legs is the sweet spot.</p>`;

  new Dialog({
    title: "🏁 Start Chase",
    content,
    buttons: {
      go: {
        label: "🏁 Start Chase",
        callback: async (html) => {
          const root = html[0] ?? html;
          const v = (n) => root.querySelector(`[name="${n}"]`)?.value?.trim() ?? "";
          const side = (tag) => {
            const factionId = v(`${tag}-faction`);
            if (factionId) return { factionId };
            return { name: v(`${tag}-name`) || undefined, speed: Number(v(`${tag}-speed`) || 3),
                     tier: Number(v(`${tag}-tier`) || 1), bonus: Number(v(`${tag}-bonus`) || 0) };
          };
          const route = [
            ...v("route").split(",").map(s => s.trim()).filter(Boolean),
            ...picked
          ];
          if (!route.length) return ui.notifications.error("Chase: no route legs given.");
          await chase.start({
            quarry: side("q"), pursuer: side("p"), route,
            lead: Number(v("lead") || 3), escapeAt: Number(v("escapeAt") || 6),
            label: v("label") || undefined
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "go",
    render: (html) => {
      const root = html[0] ?? html;
      const btn = root.querySelector(".chase-pick");
      const status = root.querySelector(".chase-picked");
      if (!btn) return;
      btn.onclick = () => {
        picking = !picking;
        btn.textContent = picking ? "🖱️ Picking… (click hexes, press again to stop)" : "🖱️ Pick hexes on canvas";
        if (!picking) return;
        const onClick = (event) => {
          if (!picking) return canvas.stage.off("pointerdown", onClick);
          const pos = event.getLocalPosition?.(canvas.stage) ?? event.data?.getLocalPosition?.(canvas.stage);
          if (!pos) return;
          const hex = game.bbttcc?.api?._hexTravel?.getHexAtPoint?.(pos.x, pos.y);
          if (!hex) return ui.notifications.warn("No hex there.");
          picked.push(hex.document?.uuid ?? hex.uuid);
          const name = String(hex.document?.text ?? "hex").replace(/[\s ]+/g, " ").trim();
          if (status) status.textContent = `${picked.length} picked (last: ${name})`;
        };
        canvas.stage.on("pointerdown", onClick);
      };
    }
  }, { width: 480 }).render(true);
})();
