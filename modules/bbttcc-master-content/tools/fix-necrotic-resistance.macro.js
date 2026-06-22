// Bad Eden — Fix dead "necrotic" resistance type → qliphothic
// ─────────────────────────────────────────────────────────────────────────────
// "necrotic" is NOT in FT.DAMAGE_TYPES (kinetic / electrical / thermal / chemical
// / poison / psychic / sephirotic / qliphothic / radiation). There is no alias
// shim for it (only the retired "energy" type is aliased forward), so a necrotic
// resistance / immunity / vulnerability matches NO incoming damage and is inert —
// e.g. the "Mantle of Witnessed Silence" carries a dead necrotic resist.
//
// This remaps necrotic → qliphothic (the closest live death/corruption-adjacent
// type; stress-track, fits sept-warding) in EVERY defense location:
//   • system.resistances                          (string array)
//   • flags.fourththing.grants.{resistances,immunities,vulnerabilities}
//   • flags.fourththing.rfi.item.grants.{...}     (the rfi-flag mirror)
// Both string ("necrotic") and structured ({ type: "necrotic" }) shapes handled.
// Condition immunities (charmed/compelled etc.) are condition NAMES, not damage
// types — left untouched. Weapons that DEAL necrotic damage are REPORTED only,
// never auto-changed (that's a theme/balance call for you).
//
// Idempotent — a second run finds nothing. DRY_RUN previews without writing.
// Prefer qliphothic→psychic on the Mantle? change TO below (or edit that one item).
// Run BEFORE surface-mechanics so the surfaced description shows the live type.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";
const FROM    = "necrotic";
const TO      = "qliphothic";
const DRY_RUN = false;   // <-- set true to preview only

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);

  const docs = await pack.getDocuments();

  const isFrom = (x) =>
    (typeof x === "string" && x.toLowerCase() === FROM) ||
    (x && typeof x === "object" && String(x.type).toLowerCase() === FROM);
  const hasFrom  = (arr) => Array.isArray(arr) && arr.some(isFrom);
  const remap    = (arr) => arr.map(x =>
    typeof x === "string" ? (x.toLowerCase() === FROM ? TO : x)
      : (isFrom(x) ? { ...x, type: TO } : x));

  const updates = [];
  const dmgHits = [];

  for (const item of docs) {
    const sys  = item.system ?? {};
    const ffg  = item.flags?.fourththing?.grants ?? null;
    const rfiG = item.flags?.fourththing?.rfi?.item?.grants ?? null;

    const upd = { _id: item.id };
    let changed = false;

    if (hasFrom(sys.resistances)) { upd["system.resistances"] = remap(sys.resistances); changed = true; }

    for (const key of ["resistances", "immunities", "vulnerabilities"]) {
      if (ffg  && hasFrom(ffg[key]))  { upd[`flags.fourththing.grants.${key}`]          = remap(ffg[key]);  changed = true; }
      if (rfiG && hasFrom(rfiG[key])) { upd[`flags.fourththing.rfi.item.grants.${key}`] = remap(rfiG[key]); changed = true; }
    }

    const dt = (sys.damage && typeof sys.damage === "object") ? sys.damage.type : sys.damageType;
    if (String(dt).toLowerCase() === FROM) dmgHits.push(item.name);

    if (changed) updates.push({ name: item.name, upd });
  }

  console.group(`%cfix-necrotic → ${TO}`, "color:#ffb000;font-weight:bold");
  updates.forEach(u => console.log("• " + u.name, u.upd));
  if (dmgHits.length) console.warn("Weapons DEALING necrotic (NOT changed — review):", dmgHits.join(", "));
  if (!updates.length && !dmgHits.length) console.log("No 'necrotic' references found — nothing to do.");
  console.groupEnd();

  if (!DRY_RUN && updates.length) {
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try { await Item.updateDocuments(updates.map(u => u.upd), { pack: PACK_ID }); }
    finally { if (wasLocked) await pack.configure({ locked: true }); }
  }

  ui.notifications.info(
    `necrotic→${TO}: ${updates.length} item(s) ${DRY_RUN ? "WOULD be" : "were"} patched` +
    (dmgHits.length ? `; ${dmgHits.length} necrotic-damage weapon(s) flagged (console)` : "") +
    (DRY_RUN ? " — DRY RUN, flip DRY_RUN=false to apply." : ".")
  );
})();
