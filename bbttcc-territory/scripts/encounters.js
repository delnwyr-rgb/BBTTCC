/* bbttcc-travel/scripts/encounters.js
 * Optional encounter table extender for bbttcc-travel.
 * If loaded, api.travel.rollEncounter(tier) will use this table.
 */
(() => {
  function ensureNS(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.travel ??= {};
  }
  function publish(){
    ensureNS();
    const E = {
      1: [
        { key:"broken_bridge",     label:"Broken Bridge (hazard)" },
        { key:"scout_signs",       label:"Old Scout Signs (discovery)" },
        { key:"minor_radiation",   label:"Minor Radiation Pocket (hazard)" }
      ],
      2: [
        { key:"bandit_ambush",     label:"Bandit Ambush (combat)" },
        { key:"acid_bog",          label:"Acid Bog (hazard)" },
        { key:"hidden_ruins",      label:"Hidden Ruins (discovery)" }
      ],
      3: [
        { key:"rockslide",         label:"Rockslide (hazard)" },
        { key:"leviathan_wake",    label:"Leviathan Wake (hazard)" },
        { key:"raider_raze_team",  label:"Raider Raze Team (combat)" }
      ],
      4: [
        { key:"qliphotic_whorl",   label:"Qliphotic Whorl (corruption)" },
        { key:"apex_predator",     label:"Apex Predator (combat)" },
        { key:"spark_echo",        label:"Spark Echo (mystic event)" }
      ]
    };
    game.bbttcc.api.travel.__encounters = {
      rollEncounter: (tier=1) => {
        const list = E[Number(tier)||1] || E[1];
        const pick = list[Math.floor(Math.random()*list.length)] || { key:"unknown", label:"Unknown" };
        return { tier:Number(tier)||1, key:pick.key, label:pick.label };
      }
    };
    console.log("[bbttcc-travel] Encounter tables installed.");
  }
  if (globalThis?.Hooks?.once) Hooks.once("ready", publish);
  try { if (globalThis?.game?.ready === true) publish(); } catch {}
})();