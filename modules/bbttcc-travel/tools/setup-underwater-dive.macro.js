// Bad Eden — Underwater Dive Setup (Water Vertical P2, 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────────
// Links a SURFACE-water hex (a terrain Drawing on the current scene) to an
// UNDERWATER scene you can dive into with a depth-rated submersible. Wires both
// ends of game.bbttcc.api.travel.dive / .surface:
//
//   • Surface hex Drawing  → flags["bbttcc-travel"].diveScene  = <underwater uuid>
//                            flags["bbttcc-travel"].diveBand   = BAND
//   • Underwater Scene     → flags["bbttcc-travel"].returnLink = { surface, "Surface" }
//                            flags["bbttcc-travel"].hexScene   = true
//                            flags.fourththing.underwater      = { band: BAND }  ← P4 combat reads this
//
// HOW TO RUN (GM, in-world):
//   1. Open the SURFACE scene. SELECT the water hex Drawing you want to dive from
//      (click it with the Drawing tool so it's controlled).
//   2. Set BAND below, then run this as a script macro.
//   It creates the underwater scene if one of UNDERWATER_SCENE_NAME doesn't exist,
//   paints nothing (you author the reef/depths/abyss hexes there with the terrain
//   picker), and is idempotent — re-running just re-asserts the links.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // reef = shallow (depthRating 1) · deep = depths (2) · abyss = crushing (3)
  // Pre-selected default in the band prompt below. Set BAND_PROMPT=false to skip
  // the dialog and use this value directly.
  const BAND_DEFAULT = "reef";               // "reef" | "deep" | "abyss"
  const BAND_PROMPT = true;
  const UNDERWATER_SCENE_NAME = "";          // "" → auto-name from the hex + band
  // Hardwired surface-water hex Drawing. Blank it ("") to fall back to whatever
  // Drawing you currently have selected on canvas.
  const HEX_UUID = "Scene.zjVbB2ykTV6PcSiv.Drawing.Nc6RCdcwgUnvGsV7";

  const SCOPE = "bbttcc-travel";
  const TAG = "[setup-underwater-dive]";
  if (!game.user?.isGM) { ui.notifications?.warn?.("GM only."); return; }

  // Resolve the surface-water hex Drawing — by hardwired UUID, else selection.
  let hexDoc = null;
  if (HEX_UUID) { try { hexDoc = await fromUuid(HEX_UUID); } catch (_e) {} }
  if (!hexDoc) hexDoc = canvas.drawings?.controlled?.[0]?.document || null;
  if (!hexDoc) { ui.notifications?.warn?.(`Hex not found — set HEX_UUID or select the surface water hex (Drawing).`); return; }

  // The surface scene is the scene the Drawing lives on (not necessarily active).
  const surfaceScene = hexDoc.parent;
  if (!surfaceScene) { ui.notifications?.warn?.("Could not resolve the hex's surface scene."); return; }

  // Sanity: warn (don't block) if the hex isn't tagged as water terrain.
  const terr = String(
    foundry.utils.getProperty(hexDoc, "flags.bbttcc-territory.terrain.key") ||
    foundry.utils.getProperty(hexDoc, "flags.bbttcc-territory.terrainKey") || ""
  ).toLowerCase();
  // Choose the depth band (drives Crushing pressure underwater; reef = none).
  let BAND = BAND_DEFAULT;
  if (BAND_PROMPT) {
    BAND = await new Promise((resolve) => {
      const opt = (v, l) => `<option value="${v}"${v === BAND_DEFAULT ? " selected" : ""}>${l}</option>`;
      new Dialog({
        title: "Underwater Dive — depth band",
        content: `<p>How deep does this dive go?</p>
          <select id="uw-band" style="width:100%;">
            ${opt("reef", "Reef — shallow (no pressure)")}
            ${opt("deep", "Depths — deep (Crushing 1d4/turn)")}
            ${opt("abyss", "Abyss — crushing (1d6/turn)")}
          </select>`,
        buttons: {
          ok: { label: "Link", callback: (html) => resolve(html[0].querySelector("#uw-band")?.value || BAND_DEFAULT) },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "ok",
        close: () => resolve(null)
      }).render(true);
    });
    if (!BAND) { ui.notifications?.info?.("Underwater dive setup cancelled."); return; }
  }

  if (terr && !["river", "lake", "sea", "ocean"].includes(terr)) {
    ui.notifications?.warn?.(`${TAG} selected hex terrain is "${terr}", not surface water — linking anyway.`);
  }

  const bandLabel = { reef: "Reef", deep: "Depths", abyss: "Abyss" }[BAND] || BAND;
  const sceneName = UNDERWATER_SCENE_NAME || `${surfaceScene.name} — Underwater (${bandLabel})`;

  // Create or reuse the underwater scene.
  let uScene = game.scenes.find(s => s.name === sceneName);
  if (!uScene) {
    uScene = await Scene.create({
      name: sceneName,
      width: surfaceScene.width, height: surfaceScene.height,
      grid: foundry.utils.duplicate(surfaceScene.grid ?? {}),
      backgroundColor: BAND === "abyss" ? "#04141f" : BAND === "deep" ? "#062535" : "#0c4a63",
      navigation: true
    });
    console.log(TAG, `created underwater scene "${sceneName}"`);
  }

  // Wire the underwater scene: return link, hexScene marker, and the P4 combat flag.
  await uScene.update({
    [`flags.${SCOPE}.returnLink`]: { targetSceneUuid: surfaceScene.uuid, label: "Surface" },
    [`flags.${SCOPE}.hexScene`]: true,
    "flags.fourththing.underwater": { band: BAND }
  });

  // Wire the surface hex Drawing → dive target.
  await hexDoc.update({
    [`flags.${SCOPE}.diveScene`]: uScene.uuid,
    [`flags.${SCOPE}.diveBand`]: BAND
  });

  const msg = `Linked this water hex → "${sceneName}" (${bandLabel}). Dive with: game.bbttcc.api.travel.dive(factionId, "${hexDoc.uuid}"). Paint reef/depths/abyss hexes on the new scene with the terrain picker.`;
  ui.notifications?.info?.(msg);
  console.log(TAG, msg, { surfaceHex: hexDoc.uuid, underwater: uScene.uuid, band: BAND });
})();
