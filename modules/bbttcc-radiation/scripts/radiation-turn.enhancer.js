// modules/bbttcc-radiation/scripts/radiation-turn.enhancer.js
// Bad Eden — Radiation Turn Enhancer (R2)
// Per-turn RP for characters standing in radiation on the active scene.
//
// One switch (owner rulings 2026-10-22):
//  - Exposure = the Radiation level of the hex under the token (+ its weather), or — on a
//    battlemap — the green-screen level the scene inherits from the hex that leads to it.
//  - Through gear (api.radiation.exposureFor): Hood/Harness one level cooler, Rad Suit halves.
//  - Characters only (Stewards + party). Factions no longer carry RP.
//  - Fully clean ground: −1 RP (rest/detox).
(() => {
  const TAG      = "[bbttcc-radiation/turn]";
  const MODF     = "bbttcc-factions";
  const MODT     = "bbttcc-territory";

  const gmIds = () => game.users?.filter(u => u.isGM).map(u => u.id) ?? [];

  function drawingContainsPoint(d, x, y) {
    try {
      if (typeof d.containsPoint === "function") {
        return d.containsPoint(new PIXI.Point(x, y));
      }
      const b = d.bounds;
      if (!b) return false;
      return b.contains(x, y);
    } catch {
      return false;
    }
  }

  function findHexAtPoint(x, y) {
    const list = canvas?.drawings?.placeables ?? [];
    for (const d of list) {
      const tf = d.document.flags?.[MODT];
      if (!tf) continue;
      if (drawingContainsPoint(d, x, y)) return d;
    }
    return null;
  }

  async function handleAdvanceTurnEnd(ctx = {}) {
    if (!game.user?.isGM) return;   // world-state writes run once, on the GM
    if (game.users?.activeGM && !game.users.activeGM.isSelf) return; // one GM seat only
    if (ctx?.apply === false) return; // dry-run / preview — never mutate radiation
    try {
      const radApi = game.bbttcc?.api?.radiation;
      if (!radApi || typeof radApi.get !== "function" || typeof radApi.add !== "function") {
        console.warn(TAG, "Radiation API not ready; skipping per-turn actor pass.");
        return;
      }

      const scene = canvas?.scene;
      if (!scene) return;
      // A battlemap inherits its level from the hex that leads to it (the green screen).
      const zone = game.bbttcc?.api?.radiation?.zone?.getScene?.(scene) || null;

      const tokens = canvas.tokens?.placeables ?? [];
      if (!tokens.length) return;

      const gm = gmIds();
      const lines = [];
      const seen = new Set();   // actor uuids charged this turn (a linked actor with two tokens pays once)

      for (const token of tokens) {
        const actor = token.actor;
        if (!actor || actor.type !== "character") continue;
        if (actor.getFlag?.(MODF, "isFaction") === true) continue;
        if (seen.has(actor.uuid)) continue;
        seen.add(actor.uuid);

        const hex = findHexAtPoint(token.center.x, token.center.y);
        let base = 0, why = "";
        if (hex) {
          const hb = radApi.hexBase(hex.document);
          base = hb.base;
          if (base > 0) why = `Hex level ${hb.level}${hb.weather ? `, ${hb.weatherLabel} ${hb.weather > 0 ? "+" : ""}${hb.weather}` : ""}`;
        } else if (zone) {
          base = zone.level; why = `Fallout (${zone.hexes.join(", ")})`;
        }

        let delta = 0, gear = "";
        if (base > 0) {
          const ex = radApi.exposureFor(actor, base);
          delta = ex.rp;
          gear = ex.protection.immune ? "immune" : ex.protection.sources.join(", ");
          if (!delta) { lines.push(`• <b>${foundry.utils.escapeHTML(actor.name)}</b>: shielded — <i>${foundry.utils.escapeHTML(why)}; ${foundry.utils.escapeHTML(gear)}</i>`); continue; }
        } else {
          if (radApi.get(actor) <= 0) continue;
          delta = -1; why = "Safe Rest";
        }

        // The Actor instance, not its id: an unlinked token's synthetic actor must not resolve to the sidebar base actor.
        const before = radApi.get(actor);
        const after  = await radApi.add(actor, delta);
        const bits = [why, gear].filter(Boolean).join(" • ");
        lines.push(
          `• <b>${foundry.utils.escapeHTML(actor.name)}</b>: `
          + `Radiation ${delta > 0 ? "+" : "−"}${Math.abs(delta)} RP (${before} → ${after})`
          + (bits ? ` — <i>${foundry.utils.escapeHTML(bits)}</i>` : "")
        );
      }

      if (lines.length) {
        // To the table unless bbttcc-territory.tableAnnouncements = "gm".
        let whisper = [];
        try { if (game.settings.get("bbttcc-territory", "tableAnnouncements") === "gm") whisper = gm; } catch (_e) {}
        await ChatMessage.create({
          content: `<p><b>☢ Radiation Turn Update</b></p>${lines.join("<br/>")}`,
          whisper,
          speaker: { alias: "Bad Eden Radiation" }
        }).catch(()=>{});
      }

    } catch (e) {
      console.warn(TAG, "handleAdvanceTurnEnd failed:", e);
    }
  }

  Hooks.on("bbttcc:advanceTurn:end", handleAdvanceTurnEnd);
  Hooks.once("ready", () => {
    console.log(TAG, "Per-turn radiation enhancer ready (AdvanceTurn integration).");
  });
})();
