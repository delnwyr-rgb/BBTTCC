// Bad Eden — Aircraft & Orbital Rigs (Air Vertical, 2026-06-23)
// ─────────────────────────────────────────────────────────────────────────────
// Mints the three canonical air/space chassis as fourththing `rig` actors via
// the builder's minting path (stamps loadout + structural BOM). Each declares
// system.travel.domains, so the movement-domain gate lets air rigs fly OVER
// land and water (and Ascend into sky/stratosphere scenes); the orbital bunker
// is a sealed space-domain facility.
//
// RUN IN-WORLD (paste into a script macro, execute as GM). Idempotent: skips a
// chassis whose rig already exists (by starterChassis flag).
//
//   light_flyer     → Skiff Flyer        (light · T2 · air)
//   heavy_dropship  → Dropship / Gunship (heavy · T3 · air)
//   orbital_bunker  → Orbital Bunker     (siege · T3 · space · stationary)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const DRY_RUN = false;
  const FREE    = true;
  const OWNER_FACTION_NAME = "";   // "" = unowned

  const TAG = "[seed-aircraft-rigs]";
  const CHASSIS = ["light_flyer", "heavy_dropship", "orbital_bunker"];

  const api = game.bbttcc?.api?.rigBuilder;
  if (!api?.mintFromChassis) {
    ui.notifications?.error?.("Rig Builder API not ready (game.bbttcc.api.rigBuilder.mintFromChassis missing).");
    return;
  }

  let factionOwnerId = "";
  if (OWNER_FACTION_NAME) {
    const f = game.actors.find(a => a.name === OWNER_FACTION_NAME && a.getFlag?.("bbttcc-factions", "isFaction"));
    if (!f) ui.notifications?.warn?.(`Owner faction "${OWNER_FACTION_NAME}" not found — minting unowned.`);
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
    } catch (e) { console.error(TAG, `mint ${key} failed`, e); }
  }

  const msg = DRY_RUN
    ? `${TAG} DRY_RUN — see console.`
    : made.length ? `Minted ${made.length} aircraft: ${made.join(" · ")}` : "No new aircraft (all already existed).";
  ui.notifications?.info?.(msg);
  console.log(TAG, msg);
})();
