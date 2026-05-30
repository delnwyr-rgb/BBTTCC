#!/usr/bin/env node
// build-manifestation-macro.mjs
// Emits tools/animate-starter-manifestations.macro.js — a non-destructive, DRY_RUN-default
// in-world macro that stamps flags.autoanimations onto starter-manifestations lacking it,
// and upgrades GENERIC Foundry placeholder icons (icons/*) to BBTTCC button icons. It NEVER
// touches items that already have AA or already use non-core art. Keyed by item NAME so it
// works in every world regardless of differing _ids.
//
// Reads /tmp/ftaa/m_refinements.json (validated: name -> {animTag, iconFile|null}).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// validated name -> {animTag, iconFile|null}. Prefer the committed repo copy.
const REPO_MAP = path.join(os.homedir(), "systems/fourththing/tools/manifestation-aa-map.json");
const REF = JSON.parse(fs.readFileSync(fs.existsSync(REPO_MAP) ? REPO_MAP : "/tmp/ftaa/m_refinements.json", "utf8"));
const OUT = path.join(os.homedir(), "systems/fourththing/tools/animate-starter-manifestations.macro.js");

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
// name -> {anim, icon}
const MAP = {};
for (const r of REF) MAP[r.name] = { anim: r.animTag, icon: r.iconFile || null };

const macro = `// animate-starter-manifestations.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// NON-DESTRUCTIVE: only ADDS Automated Animations to manifestations that lack it, and only
// SWAPS generic Foundry placeholder icons (icons/*) for BBTTCC button icons. Never alters
// items that already have AA or already use custom/button art. Keyed by item NAME.
//
// DRY_RUN=true first (just reports). Set DRY_RUN=false to apply. F5 afterwards.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const ICON_BASE = "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons"; // %20 matches existing pack convention
  const PALETTE = ${JSON.stringify(PALETTE)};
  const MAP = ${JSON.stringify(MAP)};
  const SOUND = { enable:false, delay:0, repeat:1, repeatDelay:250, startTime:0, volume:0.75 };
  const POPT = { contrast:0, delay:0, elevation:1000, isWait:false, opacity:1, playbackRate:1, repeat:1, repeatDelay:250, saturate:0, size:1, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const SOPT = { addTokenWidth:false, anchor:"0.5", contrast:0, delay:0, elevation:1000, fadeIn:250, fadeOut:500, isMasked:false, isRadius:true, isWait:false, opacity:1, repeat:1, repeatDelay:250, saturate:0, size:1.5, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const offBlk = () => ({ enable:false, video:{dbSection:"static",menuType:"spell",animation:"curewounds",variant:"01",color:"blue",enableCustom:false,customPath:""}, sound:{...SOUND}, options:{...SOPT} });
  const buildAA = (tag, name) => {
    const p = PALETTE[tag];
    return { id:"ft-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-"), label:name,
      macro:{enable:false,playWhen:"0"}, menu:p.menu,
      primary:{video:{...p.v}, sound:{...SOUND}, options:{...POPT}},
      secondary:offBlk(), soundOnly:{sound:{...SOUND}}, source:offBlk(), target:offBlk(),
      isEnabled:true, isCustomized:true, fromAmmo:false, version:5 };
  };
  const pack = game.packs.find(p => p.metadata?.name === "starter-manifestations")
            || game.packs.find(p => (p.title||"").toLowerCase().includes("starter manifestation"));
  if (!pack) return ui.notifications.error("Could not find the starter-manifestations compendium in this world.");
  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
  const docs = await pack.getDocuments();
  const plan = { anim:[], icon:[], both:[], skipHasAA:0, skipNoMatch:0, skipArt:0 };
  for (const doc of docs) {
    const m = MAP[doc.name];
    if (!m) { plan.skipNoMatch++; continue; }
    const upd = {};
    if (!doc.flags?.autoanimations) upd["flags.autoanimations"] = buildAA(m.anim, doc.name);
    else plan.skipHasAA++;
    const isGeneric = /^icons\\//.test(doc.img || "");
    if (m.icon && isGeneric) upd["img"] = ICON_BASE + "/" + m.icon;
    else if (m.icon && !isGeneric) plan.skipArt++;
    if (!Object.keys(upd).length) continue;
    const tag = (upd["flags.autoanimations"]?"🎬":"") + (upd["img"]?"🎨":"");
    (upd["flags.autoanimations"] && upd["img"] ? plan.both : upd["img"] ? plan.icon : plan.anim).push(doc.name + " " + tag);
    if (!DRY_RUN) await doc.update(upd);
  }
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });
  const n = plan.anim.length + plan.icon.length + plan.both.length;
  console.log("=== animate-starter-manifestations "+(DRY_RUN?"(DRY RUN)":"(APPLIED)")+" ===");
  console.log("anim+icon:", plan.both);
  console.log("anim only:", plan.anim);
  console.log("icon only:", plan.icon);
  console.log("skipped — already had AA:", plan.skipHasAA, "| no match in map:", plan.skipNoMatch, "| icon kept (non-generic art):", plan.skipArt);
  ui.notifications.info((DRY_RUN?"[DRY RUN] ":"")+"Manifestations: "+plan.both.length+" anim+icon, "+plan.anim.length+" anim-only, "+plan.icon.length+" icon-only ("+n+" changes). "+plan.skipHasAA+" already had AA. See console (F12)."+(DRY_RUN?" Set DRY_RUN=false to apply.":" F5 to load."));
})();
`;
fs.writeFileSync(OUT, macro);
console.log("Wrote", OUT, "(" + macro.length + " bytes)");
console.log("MAP entries:", Object.keys(MAP).length, "| with icon:", REF.filter(r => r.iconFile).length);
