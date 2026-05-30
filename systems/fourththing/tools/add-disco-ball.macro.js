/**
 * Add the Disco Ball Of Hod to the RFI Starter Manifestations — un-lamed (2026-05-29)
 * -----------------------------------------------------------------------------------
 * The disco ball already had teeth (1d6 psychic stress + Blinded, Body save vs Cast DC)
 * but its effect text said "All enemies within Near range" while `area.shape` was "none"
 * — so it only ever hit ONE target. Fixed here: area = Sphere 30 ft (= Near), target = area.
 * On cast it now drops a 30 ft sphere and blinds + stress-dings everyone caught inside
 * (allies too — it's a disco ball; they get a Body save like everyone else).
 *
 * SAFE: in-world create/update via the Foundry API. No LevelDB redeploy.
 * Idempotent — if the item is already in the pack it just fixes the area in place
 * instead of making a duplicate.
 *
 * HOW TO USE:
 *   1. DRY_RUN = true → run, read console (F12).
 *   2. Unlock the compendium (right-click → Toggle Edit Lock).
 *   3. DRY_RUN = false → run to create/update.
 */

const DRY_RUN = true;
const PACK_ID = "fourththing.starter-manifestations";

const ITEM_DATA = {"name":"Disco Ball Of Hod","type":"power","img":"icons/magic/control/mouth-smile-tongue-purple.webp","system":{"intent":"intrigue","channel":"mind","sephirah":"hod","mode":"hermetic","clarityRequired":1,"noiseGain":0,"activation":"action","target":"area","range":"near","damage":"","damageType":"energy","damageFlavor":"","damageRoll":{"op":"damage","number":1,"die":"d6","attribute":"intrigue","type":"psychic","flavor":"","track":"stress"},"damageParts":[],"effect":"All enemies within Near range: Body defense vs Cast DC. On fail: 1d6 psychic (stress) and Blinded for 1 round.","tags":["mal-voiced","aoe","near","blind","tier:2","working","harm","ephemeral","directed"],"category":"manifestation","flavor":"Mal: 'Yes, of course it's the Sephirah of glamour. What else would it be.'","manifestation":{"tier":2,"family":"working","concept":"Spinning light without a light source. Every nearby brain interprets it generously.","form":"working","function":"harm","stability":"ephemeral","interactionModel":"directed","costType":"clarity","costValue":1,"costText":"","duration":"1-round","durationText":"","triggerText":"","scale":"encounter","targetText":"","rangeAreaText":"","maintenanceCost":"","riskText":"","pathResonance":"","fictionalPermission":"","gmCalibration":"","mechanicalHook":"","signature":"","thirdThing":"","opCost":{"pool":"","value":0},"area":{"shape":"sphere","size":30},"activation":{"type":"action","consumePool":true},"save":{"enabled":false,"defense":"evasion","attribute":"","dcMode":"derived","dcFixed":15},"maintenanceKey":"none","appliedStates":{"states":["blinded"],"duration":"1-round","saveEachRound":false,"saveAttribute":"body","saveDcMode":"cast-dc","saveDcFixed":15,"saveAttributeOverrides":{}},"chain":{"enabled":false,"count":3,"range":30,"damageFormula":"1d6","damageType":"","carryConditions":false,"carryEffects":false},"rangeFt":0,"conditionalDamage":[],"appliedEffects":{"modifiers":[],"resists":[],"immunes":[]}}}};

const pack = game.packs.get(PACK_ID);
if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); }
else if (!DRY_RUN && pack.locked) {
  ui.notifications.warn("Pack is locked — right-click the compendium → Toggle Edit Lock, then re-run.");
} else {
  const docs = await pack.getDocuments();
  const existing = docs.find(d => d.name === ITEM_DATA.name);
  if (existing) {
    console.log(`%cDisco Ball already in pack — fixing area in place (sphere 30 ft).`, "font-weight:bold");
    if (!DRY_RUN) await existing.update({ "system.target": "area", "system.manifestation.area": { shape: "sphere", size: 30 } });
    ui.notifications.info(`${DRY_RUN ? "DRY RUN — would fix" : "Fixed"} the Disco Ball's area in place.`);
  } else {
    console.log(`%cCreating Disco Ball Of Hod in ${PACK_ID} (sphere 30 ft AoE blind).`, "font-weight:bold");
    if (!DRY_RUN) {
      const created = await Item.create(ITEM_DATA, { pack: PACK_ID });
      console.log("created:", created?.uuid);
    }
    ui.notifications.info(`${DRY_RUN ? "DRY RUN — would create" : "Created"} the un-lamed Disco Ball in the starter pack.`);
  }
}
