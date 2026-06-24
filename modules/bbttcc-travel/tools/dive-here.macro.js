// Bad Eden — Dive Here (Water Vertical P2, 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────────
// Dives the chosen faction from the SELECTED surface-water hex into its linked
// underwater scene. Gated on the faction owning a submersible rated for the
// band (game.bbttcc.api.travel.dive does the gate + cinematic transition).
//
// HOW TO RUN: on the surface scene, SELECT the water hex Drawing that was linked
// via setup-underwater-dive.macro.js, then run this. Faction is taken from your
// selected token's faction, or you'll be prompted to pick one.
// To come back up, run:  game.bbttcc.api.travel.surface()
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // Hardwired surface-water hex Drawing. Blank it ("") to fall back to whatever
  // Drawing you currently have selected on canvas.
  const HEX_UUID = "Scene.zjVbB2ykTV6PcSiv.Drawing.Nc6RCdcwgUnvGsV7";

  const dive = game.bbttcc?.api?.travel?.dive;
  if (!dive) { ui.notifications?.error?.("Dive API not ready (game.bbttcc.api.travel.dive)."); return; }

  let hexUuid = HEX_UUID;
  if (!hexUuid) {
    const placed = canvas.drawings?.controlled?.[0];
    if (!placed) { ui.notifications?.warn?.("Set HEX_UUID or select the surface water hex (Drawing) to dive from."); return; }
    hexUuid = placed.document.uuid;
  }

  // Resolve the diving faction.
  const isFaction = (a) => a?.getFlag?.("bbttcc-factions", "isFaction");
  let factionId = null;

  // 1) From a selected token's faction.
  const tokActor = canvas.tokens?.controlled?.[0]?.actor;
  const tokFid = tokActor && foundry.utils.getProperty(tokActor, "flags.bbttcc-factions.factionId");
  if (tokFid && game.actors.get(tokFid)) factionId = tokFid;

  // 2) Else, prompt — list factions (prefer ones owned by the user).
  if (!factionId) {
    const factions = game.actors.filter(isFaction);
    if (!factions.length) { ui.notifications?.warn?.("No faction actors found."); return; }
    const owned = factions.filter(f => f.isOwner);
    const list = (owned.length ? owned : factions).sort((a, b) => a.name.localeCompare(b.name));
    factionId = await new Promise((resolve) => {
      const opts = list.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
      new Dialog({
        title: "Dive — choose faction",
        content: `<p>Which faction is diving?</p><select id="dive-fac" style="width:100%;">${opts}</select>`,
        buttons: {
          ok: { label: "Dive", callback: (html) => resolve(html[0].querySelector("#dive-fac")?.value || null) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
    if (!factionId) return;
  }

  const res = await dive(factionId, hexUuid);
  if (res?.ok) ui.notifications?.info?.(`Diving to the ${res.band}…`);
  else if (res?.message) ui.notifications?.warn?.(res.message);
})();
