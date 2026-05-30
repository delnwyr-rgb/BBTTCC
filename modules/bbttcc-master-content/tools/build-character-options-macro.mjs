#!/usr/bin/env node
// build-character-options-macro.mjs
// Emits tools/animate-character-options.macro.js — a non-destructive, DRY_RUN-default
// in-world macro spanning 4 compendiums (ancestries, doctrines, courtly-secrets,
// occult-associations). Stamps flags.autoanimations onto ACTIVE feats lacking it
// (ancestry + occult-association abilities — they fire via the _onFtUseFeature AA hook)
// and upgrades GENERIC placeholder icons (icons/*) to BBTTCC button icons on passive
// items. Never touches existing AA or custom/button art. Keyed by (collectionId, NAME).
// Handles locked module compendiums (unlock -> write -> re-lock).
//
// Reads ./character-options-anim-map.json + ./character-options-icon-map.json.

import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ANIM = JSON.parse(fs.readFileSync(path.join(HERE, "character-options-anim-map.json"), "utf8"));
const ICON = JSON.parse(fs.readFileSync(path.join(HERE, "character-options-icon-map.json"), "utf8"));
const OUT = path.join(HERE, "animate-character-options.macro.js");

// pack short-name -> in-world collection id
const COLL = {
  "ancestries": "bbttcc-master-content.ancestries",
  "doctrines": "bbttcc-master-content.doctrines",
  "courtly-secrets": "bbttcc-master-content.courtly-secrets",
  "occult-associations": "bbttcc-character-options.occult-associations",
};

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
// collectionId -> { name -> animTag } and { name -> iconFile }
const ANIM_MAP = {}, ICON_MAP = {};
for (const r of ANIM) { const c = COLL[r.pack]; (ANIM_MAP[c] ||= {})[r.name] = r.animTag; }
for (const r of ICON) { const c = COLL[r.pack]; (ICON_MAP[c] ||= {})[r.name] = r.iconFile; }

const macro = `// animate-character-options.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// NON-DESTRUCTIVE across 4 compendiums (ancestries, doctrines, courtly-secrets,
// occult-associations). Stamps Automated Animations on the active ancestry/occult
// abilities that lack it (they fire via the feature-use hook) and upgrades generic
// placeholder icons to BBTTCC button icons on passive items. Never alters existing AA
// or custom/button art. Keyed by (compendium, item NAME). Handles locked module packs.
//
// DRY_RUN=true first (just reports). Set DRY_RUN=false to apply. F5 afterwards.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const ICON_BASE = "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons";
  const PALETTE = ${JSON.stringify(PALETTE)};
  const ANIM_MAP = ${JSON.stringify(ANIM_MAP)};
  const ICON_MAP = ${JSON.stringify(ICON_MAP)};
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
  const COLLS = [...new Set([...Object.keys(ANIM_MAP), ...Object.keys(ICON_MAP)])];
  const grand = { anim:0, icon:0, skipHasAA:0, skipArt:0, missing:[] };
  for (const cid of COLLS) {
    const pack = game.packs.get(cid);
    if (!pack) { console.warn("[char-options] pack not found:", cid); continue; }
    const wasLocked = pack.locked;
    if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
    const docs = await pack.getDocuments();
    const have = new Set(docs.map(d => d.name));
    const animNames = ANIM_MAP[cid] || {}, iconNames = ICON_MAP[cid] || {};
    for (const n of [...Object.keys(animNames), ...Object.keys(iconNames)]) if (!have.has(n)) grand.missing.push(cid+" / "+n);
    let a=0, i=0;
    for (const doc of docs) {
      const upd = {};
      const tag = animNames[doc.name];
      if (tag) { if (!doc.flags?.autoanimations) { upd["flags.autoanimations"] = buildAA(tag, doc.name); } else grand.skipHasAA++; }
      const ic = iconNames[doc.name];
      if (ic) { if (/^icons\\//.test(doc.img || "")) upd["img"] = ICON_BASE + "/" + ic; else grand.skipArt++; }
      if (!Object.keys(upd).length) continue;
      if (upd["flags.autoanimations"]) a++;
      if (upd["img"]) i++;
      if (!DRY_RUN) await doc.update(upd);
    }
    if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });
    grand.anim += a; grand.icon += i;
    console.log(\`[char-options] \${cid}: +\${a} anim, +\${i} icon\` + (wasLocked ? " (was locked)" : ""));
  }
  if (grand.missing.length) console.warn("[char-options] names not found (skipped):", grand.missing);
  console.log("=== animate-character-options "+(DRY_RUN?"(DRY RUN)":"(APPLIED)")+" === anim:"+grand.anim+" icon:"+grand.icon+" | skipped existing-AA:"+grand.skipHasAA+" kept-art:"+grand.skipArt+" missing:"+grand.missing.length);
  ui.notifications.info((DRY_RUN?"[DRY RUN] ":"")+"Character options: +"+grand.anim+" animations, +"+grand.icon+" icon upgrades across "+COLLS.length+" compendiums. Console (F12) for detail."+(DRY_RUN?" Set DRY_RUN=false to apply.":" F5 to load."));
})();
`;
fs.writeFileSync(OUT, macro);
console.log("Wrote", OUT, "(" + macro.length + " bytes)");
console.log("anim:", ANIM.length, "icon:", ICON.length, "collections:", Object.keys(COLL).length);
