#!/usr/bin/env node
// build-npc-embedded-macro.mjs
// Emits tools/animate-npc-embedded.macro.js — a non-destructive, DRY_RUN-default in-world
// macro that "applies back" the NPC-ability animations/icons to the EMBEDDED item copies on
// (1) the npcs compendium actors and (2) world NPC actors, matched by item NAME. The library
// pack itself is baked separately (apply-npc-abilities-aa.mjs + deploy). Only adds AA where
// missing; only swaps generic placeholder icons. Handles the locked npcs module pack.
//
// Reads ./npc-abilities-aa-map.json.

import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REF = JSON.parse(fs.readFileSync(path.join(HERE, "npc-abilities-aa-map.json"), "utf8"));
const OUT = path.join(HERE, "animate-npc-embedded.macro.js");

const V = (dbSection, menuType, animation, variant, color) => ({ dbSection, menuType, animation, variant, color, enableCustom: false, customPath: "" });
const PALETTE = {
  fire_bolt:{menu:"range",v:V("range","spell","firebolt","01","orange")}, scorch:{menu:"range",v:V("range","spell","scorchingray","01","orange")},
  frost_ray:{menu:"range",v:V("range","spell","rayoffrost","01","blue")}, holy_bolt:{menu:"range",v:V("range","spell","guidingbolt","01","yellow")},
  force_missile:{menu:"range",v:V("range","spell","magicmissile","01","purple")}, eldritch:{menu:"range",v:V("range","spell","eldritchblast","01","purple")},
  chromatic:{menu:"range",v:V("range","spell","guidingbolt","02","random")}, arrow:{menu:"range",v:V("range","weapon","arrow","regular","regular")},
  sword:{menu:"melee",v:V("melee","weapon","sword","01","white")}, club:{menu:"melee",v:V("melee","weapon","club","01","white")},
  dagger:{menu:"melee",v:V("melee","weapon","dagger","01","white")}, fist:{menu:"melee",v:V("melee","weapon","unarmedstrike","physical","yellow")},
  cone_cold:{menu:"templatefx",v:V("templatefx","cone","coneofcold","01","blue")}, lightning:{menu:"templatefx",v:V("templatefx","ray","lightningbolt","01","blue")},
  shatter:{menu:"templatefx",v:V("templatefx","circle","shatter","01","orange")}, evocation:{menu:"templatefx",v:V("templatefx","circle","magicsign","evocation","red")},
  heal:{menu:"ontoken",v:V("static","spell","curewounds","01","blue")}, heal_generic:{menu:"ontoken",v:V("static","spell","generichealing","01","blue")},
  shield_ice:{menu:"ontoken",v:V("static","shieldfx","ice","03","purple")}, frost_impact:{menu:"ontoken",v:V("static","impact","frost","01","blue")},
  bless:{menu:"ontoken",v:V("static","spell","bless","intro","yellow")}, bless_loop:{menu:"ontoken",v:V("static","spell","bless","loop","purple")},
  divine_buff:{menu:"ontoken",v:V("static","spell","divinesmite","source","yellowwhite")}, music:{menu:"ontoken",v:V("static","music","notes","01","purple")},
  sacred:{menu:"ontoken",v:V("static","spell","sacredflame","target","yellow")}, curse:{menu:"ontoken",v:V("static","spell","divinesmite","source","darkpurple")},
  fear:{menu:"ontoken",v:V("static","conditions","fear","02","darkpurple")}, hold:{menu:"ontoken",v:V("static","magicsign","enchantment","02","purple")},
  necro:{menu:"ontoken",v:V("static","spell","tollthedead","skull","green")}, explosion:{menu:"ontoken",v:V("static","generic","explosion","01","red")},
};
const MAP = {};
for (const r of REF) MAP[r.name] = { anim: r.animTag || null, icon: r.iconFile || null };

const macro = `// animate-npc-embedded.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// "Apply back": stamps Automated Animations + button icons onto the EMBEDDED ability items
// of (1) the npcs compendium actors and (2) world NPC actors, matched by item NAME — so the
// NPCs actually animate at the table. The library pack is baked separately. NON-DESTRUCTIVE:
// only adds AA where missing, only swaps generic placeholder icons (icons/*). Keyed by NAME.
//
// DRY_RUN=true first (just reports). Set DRY_RUN=false to apply. F5 afterwards.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const ICON_BASE = "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons";
  const PALETTE = ${JSON.stringify(PALETTE)};
  const MAP = ${JSON.stringify(MAP)};
  const SOUND = { enable:false, delay:0, repeat:1, repeatDelay:250, startTime:0, volume:0.75 };
  const POPT = { contrast:0, delay:0, elevation:1000, isWait:false, opacity:1, playbackRate:1, repeat:1, repeatDelay:250, saturate:0, size:1, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const SOPT = { addTokenWidth:false, anchor:"0.5", contrast:0, delay:0, elevation:1000, fadeIn:250, fadeOut:500, isMasked:false, isRadius:true, isWait:false, opacity:1, repeat:1, repeatDelay:250, saturate:0, size:1.5, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const offBlk = () => ({ enable:false, video:{dbSection:"static",menuType:"spell",animation:"curewounds",variant:"01",color:"blue",enableCustom:false,customPath:""}, sound:{...SOUND}, options:{...SOPT} });
  const buildAA = (tag, name) => { const p = PALETTE[tag]; return { id:"ft-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-"), label:name, macro:{enable:false,playWhen:"0"}, menu:p.menu, primary:{video:{...p.v}, sound:{...SOUND}, options:{...POPT}}, secondary:offBlk(), soundOnly:{sound:{...SOUND}}, source:offBlk(), target:offBlk(), isEnabled:true, isCustomized:true, fromAmmo:false, version:5 }; };
  const updatesFor = (actor) => {
    const ups = [];
    for (const it of actor.items) {
      const m = MAP[it.name]; if (!m) continue;
      const u = {};
      if (m.anim && !it.flags?.autoanimations) u["flags.autoanimations"] = buildAA(m.anim, it.name);
      if (m.icon && /^icons\\//.test(decodeURIComponent(it.img || ""))) u["img"] = ICON_BASE + "/" + m.icon;
      if (Object.keys(u).length) { u._id = it.id; ups.push(u); }
    }
    return ups;
  };
  let actorsTouched = 0, itemsChanged = 0;
  // (1) npcs compendium actors
  const pack = game.packs.get("bbttcc-master-content.npcs");
  if (pack) {
    const wasLocked = pack.locked;
    if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
    for (const actor of await pack.getDocuments()) {
      const ups = updatesFor(actor);
      if (!ups.length) continue;
      actorsTouched++; itemsChanged += ups.length;
      if (!DRY_RUN) await actor.updateEmbeddedDocuments("Item", ups);
    }
    if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });
  } else console.warn("[npc-embedded] npcs compendium not found");
  // (2) world NPC actors
  let worldActors = 0, worldItems = 0;
  for (const actor of game.actors) {
    if (actor.type !== "npc") continue;
    const ups = updatesFor(actor);
    if (!ups.length) continue;
    worldActors++; worldItems += ups.length;
    if (!DRY_RUN) await actor.updateEmbeddedDocuments("Item", ups);
  }
  console.log("=== animate-npc-embedded "+(DRY_RUN?"(DRY RUN)":"(APPLIED)")+" ===");
  console.log("npcs compendium: "+actorsTouched+" actors, "+itemsChanged+" embedded items");
  console.log("world NPC actors: "+worldActors+" actors, "+worldItems+" embedded items");
  ui.notifications.info((DRY_RUN?"[DRY RUN] ":"")+"NPC abilities applied-back: compendium "+itemsChanged+" items / world "+worldItems+" items."+(DRY_RUN?" Set DRY_RUN=false to apply.":" F5 to load."));
})();
`;
fs.writeFileSync(OUT, macro);
console.log("Wrote", OUT, "(" + macro.length + " bytes)");
console.log("MAP entries:", Object.keys(MAP).length);
