/* BBTTCC — Travel Visuals v2.1
 * Guaranteed trigger: installs immediately on load
 * Draws overlay + animates selected token after route execution
 */
(() => {
  console.log("[bbttcc-travel-visuals] installing immediate listener");

  // Install listener now (no waiting for ready)
  let isAnimating = false;

Hooks.on("updateToken", async (doc, changes) => {
  // prevent recursion from our own animation
  if (isAnimating) return;

    // Only act when a token actually moves
    if (!("x" in changes || "y" in changes)) return;

    const app = game.bbttcc?.ui?.travelConsole;
    if (!app?.rendered) return;

    console.log("[bbttcc-travel-visuals] token movement detected → launching visuals");
    try {
      await new Promise(r => setTimeout(r, 600));
      await runVisuals(app);
    } catch (err) {
      console.warn("[bbttcc-travel-visuals] visual trigger failed:", err);
    }
  });

  async function runVisuals(app) {
    try {
      const token = canvas.tokens?.controlled?.[0];
      if (!token) return;
      const dict = game?.bbttcc?.api?.travel?.__terrain || {};
      const html = app.element?.[0];
      if (!html) return;

      const rows = Array.from(html.querySelectorAll(".rp-legs div"))
        .filter(div => div.textContent.trim().length > 0);
      if (rows.length < 2) return;

      const norm = s => (s || "").toLowerCase().replace(/[\[\]\(\)\s\/]/g, "");
      const toSel = html.querySelector("select[data-role='rp-to']");
      const options = Array.from(toSel?.options || []);
      const uuids = [];
      for (const row of rows) {
        const labelText = norm(row.textContent);
        const matchOpt = options.find(o =>
          norm(o.textContent).includes(
            labelText.split("→").pop()?.slice(0, 12) || ""
          )
        );
        if (matchOpt) uuids.push(matchOpt.value);
      }
      if (uuids.length < 2) return;

      const coords = [];
      for (const uuid of uuids) {
        const obj = await fromUuid(uuid);
        const d = obj?.object ?? null;
        if (d) coords.push([d.center.x, d.center.y, d]);
      }
      if (coords.length < 2) return;

      const parentLayer = canvas.foreground ?? canvas.stage;
      const name = "bbttcc-route-overlay";
      parentLayer.getChildByName?.(name)?.destroy({ children: true });
      const overlay = new PIXI.Container();
      overlay.name = name;
      parentLayer.addChild(overlay);

      const g = new PIXI.Graphics();
      g.lineStyle(3, 0x33aaff, 0.6);
      for (let i = 0; i < coords.length - 1; i++) {
        const [x1, y1] = coords[i];
        const [x2, y2, dest] = coords[i + 1];
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);

        const terr = dest.document.getFlag("bbttcc-territory", "terrain")?.key || "plains";
        const cost = dict[terr]?.cost || {};
        const txt = Object.entries(cost)
          .map(([k, v]) => `${v}${k[0].toUpperCase()}`)
          .join(" ");
        const label = new PIXI.Text(txt || "–", {
          fontSize: 12,
          fill: 0xffffff,
          stroke: 0x000000,
          strokeThickness: 3
        });
        label.position.set(x2 + 8, y2 - 8);
        overlay.addChild(label);
      }
      overlay.addChild(g);

      // Animate the selected token along the route
      async function moveTokenPath(token, points, stepDelay = 1000) {
        for (const [x, y] of points) {
          await token.document.update(
            { x: x - token.w / 2, y: y - token.h / 2 },
            { animate: true }
          );
          await new Promise(r => setTimeout(r, stepDelay));
        }
      }

      await new Promise(r => setTimeout(r, 800));
      isAnimating = true;
      await moveTokenPath(token, coords.map(([x, y]) => [x, y]));
      isAnimating = false;
      ui.notifications.info("BBTTCC route overlay drawn & token moved.");
    } catch (err) {
      console.error("[bbttcc-travel-visuals]", err);
      ui.notifications.error(`Travel Visuals error: ${err.message}`);
    }
  }
})();
