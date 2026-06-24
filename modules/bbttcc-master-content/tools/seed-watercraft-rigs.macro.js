// Bad Eden — Watercraft & Submersible Rigs (Water Vertical, 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────────
// Mints the four canonical water chassis as fourththing `rig` actors via the
// builder's own minting path (game.bbttcc.api.rigBuilder.mintFromChassis), which
// stamps the loadout AND a bracket-driven structural BOM. Each chassis declares
// system.travel.domains, so the movement-domain travel gate lets them cross
// water (and, for the Submersible, dive the reef/deep bands) while a land-only
// rig stays hard-blocked from the ocean.
//
// RUN IN-WORLD (paste into a script macro, execute as GM). Idempotent: skips a
// chassis whose rig already exists (by starterChassis flag, then by name).
//
//   light_skiff    → Light Skiff      (light  · T1 · water-surface)
//   medium_barge   → Sail Barge       (medium · T2 · water-surface)
//   heavy_warship  → Warship          (heavy  · T3 · water-surface)
//   submersible    → Submersible      (medium · T2 · water-sub, depthRating 2)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const DRY_RUN = false;            // true: log what WOULD be minted, write nothing
  const FREE    = true;             // true: don't charge the owner faction's Economy
  // Optional: assign every minted watercraft to a faction by NAME. "" = unowned.
  const OWNER_FACTION_NAME = "";

  const TAG = "[seed-watercraft-rigs]";
  const CHASSIS = ["light_skiff", "medium_barge", "heavy_warship", "submersible"];

  const api = game.bbttcc?.api?.rigBuilder;
  if (!api?.mintFromChassis) {
    ui.notifications?.error?.("Rig Builder API not ready (game.bbttcc.api.rigBuilder.mintFromChassis missing).");
    return;
  }

  // Resolve optional owner faction by name.
  let factionOwnerId = "";
  if (OWNER_FACTION_NAME) {
    const f = game.actors.find(a => a.name === OWNER_FACTION_NAME && a.getFlag?.("bbttcc-factions", "isFaction"));
    if (!f) { ui.notifications?.warn?.(`Owner faction "${OWNER_FACTION_NAME}" not found — minting unowned.`); }
    else factionOwnerId = f.id;
  }

  const existingByChassis = (key) =>
    game.actors.find(a => a.type === "rig" && a.flags?.["bbttcc-auto-link"]?.starterChassis === key);

  const made = [];
  for (const key of CHASSIS) {
    const dupe = existingByChassis(key);
    if (dupe) { console.log(TAG, `skip ${key} — already exists as "${dupe.name}"`); continue; }

    if (DRY_RUN) { console.log(TAG, `WOULD mint ${key}`, { factionOwnerId, free: FREE }); continue; }

    try {
      const rig = await api.mintFromChassis(key, { factionOwnerId, free: FREE });
      if (rig) {
        const dom = (rig.system?.system ?? rig.system)?.travel?.domains;
        made.push(`${rig.name} [${Array.isArray(dom) ? dom.join(",") : "?"}]`);
        console.log(TAG, `minted ${key} → "${rig.name}"`, { domains: dom });
      }
    } catch (e) {
      console.error(TAG, `mint ${key} failed`, e);
    }
  }

  const msg = DRY_RUN
    ? `${TAG} DRY_RUN — see console.`
    : made.length ? `Minted ${made.length} watercraft: ${made.join(" · ")}` : "No new watercraft (all already existed).";
  ui.notifications?.info?.(msg);
  console.log(TAG, msg);
})();
