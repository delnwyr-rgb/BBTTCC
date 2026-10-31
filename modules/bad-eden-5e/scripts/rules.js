// Bad Eden 5E · house rules on top of the SRD (2026-10-31, Dave).
//
// PILOTING (Dex) — a real skill, key `pil`: rigs are a Bad Eden pillar and D&D's vehicle-tool proficiency is the
//   one nobody uses. RFI's Piloting aptitude maps here (rubric skills.piloting → skill pil). The Chariot and The Fool
//   grant it; anyone can take it with the wizard's free skills or Skilled.
// FIREARMS — a weapon category, not a skill (attack rolls never read skills in D&D): weapon type `firearmR`
//   (ranged), proficiency `fir`. The gear lane types RFI's firearms-skill guns as `firearmR` (bows and rig-mounted
//   guns excepted). Proficiency: the martial classes (Barbarian, Fighter, Paladin, Ranger, Rogue) and the Flow Wolf
//   Warden and Vigilant get it when the class lands on a character; `game.badEden5e.rules.grantFirearms()` (GM)
//   backfills existing characters.
import { MOD } from "./casting.js";

export const FIREARM_CLASSES = new Set(["barbarian", "fighter", "paladin", "ranger", "rogue", "warden", "vigilant"]);

/** init: extend dnd5e's config before any actor data is prepared. */
export function registerRules() {
  const D = CONFIG.DND5E;
  D.skills.pil ??= { label: "Piloting", ability: "dex", fullKey: "piloting", reference: "", icon: "icons/environment/settlement/wagon.webp" };
  D.weaponTypes.firearmR ??= "Firearm";
  D.weaponProficiencies.fir ??= "Firearms";
  D.weaponProficienciesMap.firearmR ??= "fir";
  D.weaponTypeMap.firearmR ??= "ranged";
}

const hasFirearmClass = actor => actor?.items?.some?.(i => i.type === "class" && FIREARM_CLASSES.has(i.system?.identifier));
const firearmProficient = actor => (actor?.system?.traits?.weaponProf?.value ?? new Set()).has?.("fir");

async function grantFor(actor) {
  if (!actor || actor.type !== "character" || !hasFirearmClass(actor) || firearmProficient(actor)) return false;
  const cur = [...(actor._source?.system?.traits?.weaponProf?.value ?? [])];
  await actor.update({ "system.traits.weaponProf.value": [...new Set([...cur, "fir"])] });
  return true;
}

/** GM: give Firearms proficiency to every character whose class earns it. Returns the names granted. */
export async function grantFirearms() {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
  const done = [];
  for (const a of game.actors?.contents ?? []) if (await grantFor(a)) done.push(a.name);
  return done;
}

/** ready: a martial class landing on a character brings Firearms with it (the creating client owns the actor). */
export function activateRules() {
  Hooks.on("createItem", (item, _options, userId) => {
    if (userId !== game.user.id || item.type !== "class" || !FIREARM_CLASSES.has(item.system?.identifier)) return;
    grantFor(item.parent).catch(e => console.warn(`${MOD} | firearms grant failed`, e));
  });
}
