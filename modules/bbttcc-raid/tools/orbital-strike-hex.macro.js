// BBTTCC — Orbital Bombardment: Strategic (bombard a HEX)
// ─────────────────────────────────────────────────────────────────────────────
// World-map variant of the Hammer of God: calls down an orbital strike on a
// TARGET HEX, hammering everything stationed there (rigs / facilities / bosses)
// and raising its alarm — soften it before a raid. Click the target hex.
//
// Requires the faction to own a Space-domain rig (Orbital Bunker). Costs
// Violence OP; recharges once per strategic (world) turn.
//
// Faction is taken from your selected token's faction, else the owner of an
// available Orbital Bunker, else you'll be prompted.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("Orbital Bombardment: GM only."); return; }
  const api = game.bbttcc?.api?.raid;
  if (!api?.orbitalStrikeHex) { ui.notifications.error("Orbital strike API not ready (game.bbttcc.api.raid.orbitalStrikeHex)."); return; }
  const getHexAtPoint = game.bbttcc?.api?._hexTravel?.getHexAtPoint;
  if (typeof getHexAtPoint !== "function") { ui.notifications.error("Hex resolver not ready (api._hexTravel.getHexAtPoint)."); return; }

  // ── Resolve the firing faction ───────────────────────────────────────────
  const isFaction = (a) => a?.getFlag?.("bbttcc-factions", "isFaction");
  let factionId = null;
  const tokActor = canvas.tokens?.controlled?.[0]?.actor;
  const tokFid = tokActor && foundry.utils.getProperty(tokActor, "flags.bbttcc-factions.factionId");
  if (tokFid && game.actors.get(tokFid)) factionId = tokFid;
  if (!factionId) {
    const bunker = api.findOrbitalBunker?.(null);
    const bf = bunker && String(foundry.utils.getProperty(bunker, "system.system.identity.factionOwnerId")
      || foundry.utils.getProperty(bunker, "flags.bbttcc-factions.factionId") || "");
    if (bf && game.actors.get(bf)) factionId = bf;
  }
  if (!factionId) {
    const factions = game.actors.filter(isFaction).sort((a, b) => a.name.localeCompare(b.name));
    if (!factions.length) { ui.notifications.warn("No faction actors found."); return; }
    factionId = await new Promise((resolve) => {
      const opts = factions.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
      new Dialog({
        title: "Orbital Bombardment — firing faction",
        content: `<p>Whose bunker is firing?</p><select id="osh-fac" style="width:100%;">${opts}</select>`,
        buttons: { ok: { label: "Arm", callback: (h) => resolve(h[0].querySelector("#osh-fac")?.value || null) },
                   cancel: { label: "Cancel", callback: () => resolve(null) } },
        default: "ok", close: () => resolve(null)
      }).render(true);
    });
    if (!factionId) return;
  }

  if (!api.findOrbitalBunker?.(factionId)) {
    ui.notifications.warn("That faction owns no Orbital Bunker (a Space-domain rig). Build one in the Rig Builder.");
    return;
  }

  // ── Capture one canvas click → the hex under it ──────────────────────────
  const worldFromEvent = (ev) => {
    try {
      if (ev?.data?.getLocalPosition) return ev.data.getLocalPosition(canvas.app.stage);
      if (ev?.global) return canvas.stage.worldTransform.applyInverse(ev.global);
    } catch (_e) {}
    return canvas.mousePosition ?? { x: 0, y: 0 };
  };

  let done = false;
  const cleanup = () => {
    if (done) return; done = true;
    try { canvas.stage.off("pointerdown", onDown); } catch (_e) {}
    try { window.removeEventListener("keydown", onKey, true); } catch (_e) {}
  };
  const onKey = (e) => { if (e.key === "Escape") { cleanup(); ui.notifications.info("Orbital bombardment cancelled."); } };
  const onDown = async (evt) => {
    if (done) return;
    cleanup();
    const p = worldFromEvent(evt);
    const hex = getHexAtPoint(p.x, p.y);
    if (!hex?.document?.uuid) { ui.notifications.warn("No hex under the click."); return; }
    const res = await api.orbitalStrikeHex({ factionId, hexUuid: hex.document.uuid });
    if (!res?.ok && res?.message) ui.notifications.warn(res.message);
  };

  ui.notifications.info("🛰️ Orbital bombardment armed — click the target hex. Esc to cancel.");
  window.addEventListener("keydown", onKey, true);
  canvas.stage.once("pointerdown", onDown);
})();
