// BBTTCC — Hammer of God (Orbital Bombardment)
// ─────────────────────────────────────────────────────────────────────────────
// Calls down an orbital strike from your faction's Orbital Bunker. Click the
// impact point on the canvas; the strike telegraphs, then lands with falloff
// AoE damage + VFX. Requires the faction to own a Space-domain rig (Orbital
// Bunker). Costs Violence OP; recharges a few rounds in combat.
//
// Faction is taken from your selected token's faction, else the owner of an
// available Orbital Bunker, else you'll be prompted.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) { ui.notifications.warn("Hammer of God: GM only."); return; }
  const api = game.bbttcc?.api?.raid;
  if (!api?.orbitalStrike) { ui.notifications.error("Orbital strike API not ready (game.bbttcc.api.raid.orbitalStrike)."); return; }

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
        title: "Orbital Strike — firing faction",
        content: `<p>Whose bunker is firing?</p><select id="hog-fac" style="width:100%;">${opts}</select>`,
        buttons: { ok: { label: "Arm", callback: (h) => resolve(h[0].querySelector("#hog-fac")?.value || null) },
                   cancel: { label: "Cancel", callback: () => resolve(null) } },
        default: "ok", close: () => resolve(null)
      }).render(true);
    });
    if (!factionId) return;
  }

  // Pre-check the bunker so we fail fast (before asking for a click).
  if (!api.findOrbitalBunker?.(factionId)) {
    ui.notifications.warn("That faction owns no Orbital Bunker (a Space-domain rig). Build one in the Rig Builder.");
    return;
  }

  // ── Capture one canvas click as the impact point ─────────────────────────
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
  const onKey = (e) => { if (e.key === "Escape") { cleanup(); ui.notifications.info("Orbital strike cancelled."); } };
  const onDown = async (evt) => {
    if (done) return;
    cleanup();
    const p = worldFromEvent(evt);
    const res = await api.orbitalStrike({ factionId, x: p.x, y: p.y });
    if (!res?.ok && res?.message) ui.notifications.warn(res.message);
  };

  ui.notifications.info("🛰️ Hammer of God armed — click the impact point. Esc to cancel.");
  window.addEventListener("keydown", onKey, true);
  canvas.stage.once("pointerdown", onDown);
})();
