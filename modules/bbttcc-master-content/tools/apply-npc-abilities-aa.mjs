#!/usr/bin/env node
// apply-npc-abilities-aa.mjs
// Bake flags.autoanimations (+ button-icon img for generic placeholders) into the
// npc-abilities LevelDB pack, from npc-abilities-aa-map.json. Non-destructive: only adds AA
// where missing, only swaps icons that are generic (icons/*). The library is repo-canonical
// (generated), so we edit the pack directly here rather than in-world.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let ClassicLevel;
for (const p of ["classic-level", "/opt/homebrew/lib/node_modules/@foundryvtt/foundryvtt-cli/node_modules/classic-level"]) { try { ({ ClassicLevel } = require(p)); break; } catch {} }

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PACK = path.resolve(HERE, "../packs/npc-abilities");
const REF = JSON.parse(fs.readFileSync(path.join(HERE, "npc-abilities-aa-map.json"), "utf8"));
const ICON_BASE = "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons";
const MAP = {}; for (const r of REF) MAP[r.name] = { anim: r.animTag || null, icon: r.iconFile || null };

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
const SOUND = { enable:false, delay:0, repeat:1, repeatDelay:250, startTime:0, volume:0.75 };
const POPT = { contrast:0, delay:0, elevation:1000, isWait:false, opacity:1, playbackRate:1, repeat:1, repeatDelay:250, saturate:0, size:1, tint:false, tintColor:"#FFFFFF", zIndex:1 };
const SOPT = { addTokenWidth:false, anchor:"0.5", contrast:0, delay:0, elevation:1000, fadeIn:250, fadeOut:500, isMasked:false, isRadius:true, isWait:false, opacity:1, repeat:1, repeatDelay:250, saturate:0, size:1.5, tint:false, tintColor:"#FFFFFF", zIndex:1 };
const offBlk = () => ({ enable:false, video:V("static","spell","curewounds","01","blue"), sound:{...SOUND}, options:{...SOPT} });
const buildAA = (tag, name) => { const p = PALETTE[tag]; return { id:"ft-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-"), label:name, macro:{enable:false,playWhen:"0"}, menu:p.menu, primary:{video:{...p.v}, sound:{...SOUND}, options:{...POPT}}, secondary:offBlk(), soundOnly:{sound:{...SOUND}}, source:offBlk(), target:offBlk(), isEnabled:true, isCustomized:true, fromAmmo:false, version:5 }; };

const db = new ClassicLevel(PACK, { valueEncoding: "json" });
await db.open();
const batch = db.batch();
let anim = 0, icon = 0, n = 0;
for await (const [k, v] of db.iterator()) {
  if (!k.startsWith("!items!")) continue;
  const m = MAP[v.name];
  if (!m) continue;
  let changed = false;
  if (m.anim && !v.flags?.autoanimations) { v.flags = v.flags || {}; v.flags.autoanimations = buildAA(m.anim, v.name); anim++; changed = true; }
  if (m.icon && /^icons\//.test(decodeURIComponent(v.img || ""))) { v.img = ICON_BASE + "/" + m.icon; icon++; changed = true; }
  if (changed) { batch.put(k, v); n++; }
}
await batch.write();
await db.close();
console.log(`Library baked: ${n} items changed (+${anim} anim, +${icon} icon).`);
