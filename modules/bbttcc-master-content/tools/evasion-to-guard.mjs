// EVASION → GUARD on manifestations (Dave 2026-11-12: "let's convert those evasion ones to guard").
// Evasion was retired 2026-11-11 (binary defenses: Guard / Resolve). The engine already lands a legacy "evasion" ward on
// Guard (ftApplyStatModifier, FT_EFFECT_MOD_AE_KEYS) — this pass fixes the stored data + the words players read. "Evasion" naming a save becomes the faculty the item rolls (foe packs: Intrigue; none set: Body).
// Self-contained (inlined into the live macro with Function#toString): no imports, no outer references.

/** Build dot-path updates for one item's data (a power, or a host carrying a bound Working), or null. */
export function evasionToGuardUpdate(d) {
  const upd = {};
  const FAC = { violence: "Violence", intrigue: "Intrigue", presence: "Presence", body: "Body", mind: "Mind", soul: "Soul" };
  // "Evasion" naming a SAVE ("rolls Evasion vs DC 12", "Evasion check", "vs Evasion (DC 12)", "Evasion defense") → the faculty
  // the item actually rolls (resolution / appliedStates saveAttribute — foe packs store intrigue), else Body. Anywhere else → Guard.
  const facOf = (sys) => FAC[sys?.manifestation?.resolution?.saveAttribute] ?? FAC[sys?.manifestation?.appliedStates?.saveAttribute] ?? "Body";
  const word = (s, fac = "Body") => typeof s === "string"
    ? s.replace(/\bEvasion\b(?=\s*(?:<\/(?:strong|b|em)>)?\s*(?:check|defense|save|vs\.?\s*DC|\(DC))/g, fac)
       .replace(/\bEvasion\b/g, "Guard").replace(/\bevasion\b/g, "guard")
    : s;
  const one = (sys, base) => {
    if (!sys || typeof sys !== "object") return;
    const fac = facOf(sys);
    const mods = sys.manifestation?.appliedEffects?.modifiers;
    const hasMod = Array.isArray(mods) && mods.some(m => m?.stat === "evasion");
    const txt = [sys.effect, sys.description?.value, typeof sys.description === "string" ? sys.description : null];
    const hasText = txt.some(t => typeof t === "string" && /\bEvasion\b/.test(t));
    if (!hasMod && !hasText) return;
    if (hasMod) upd[`${base}.manifestation.appliedEffects.modifiers`] = mods.map(m => m?.stat === "evasion" ? { ...m, stat: "guard" } : m);
    if (typeof sys.effect === "string" && word(sys.effect, fac) !== sys.effect) upd[`${base}.effect`] = word(sys.effect, fac);
    if (typeof sys.description?.value === "string" && word(sys.description.value, fac) !== sys.description.value) upd[`${base}.description.value`] = word(sys.description.value, fac);
    else if (typeof sys.description === "string" && word(sys.description, fac) !== sys.description) upd[`${base}.description`] = word(sys.description, fac);
  };
  if (d.type === "power" || d.type === "weapon") {
    one(d.system, "system");
    const lore = d.flags?.fourththing?.rfi?.item?.lore;   // Brass Knife's rules line lives in its lore too
    if (typeof lore === "string" && word(lore, facOf(d.system)) !== lore) upd["flags.fourththing.rfi.item.lore"] = word(lore, facOf(d.system));
  }
  const w = d.flags?.fourththing?.working?.power;
  if (w?.system) one(w.system, "flags.fourththing.working.power.system");
  return Object.keys(upd).length ? upd : null;
}
