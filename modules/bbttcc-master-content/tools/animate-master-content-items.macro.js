// animate-master-content-items.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// NON-DESTRUCTIVE: only ADDS Automated Animations to BBTTCC master-content weapons +
// wondrous use-items that lack it, and only SWAPS generic Foundry placeholder icons
// (icons/*) for BBTTCC button icons. Never alters items that already have AA or custom/
// button art. Keyed by item NAME. NOTE: weapons animate on Strike; the Potion of Radical
// Chill animates on consume; the other wondrous items are PREPPED (flags set) but need a
// real use/consume hook authored before they fire.
//
// DRY_RUN=true first (just reports). Set DRY_RUN=false to apply. F5 afterwards.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const ICON_BASE = "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons";
  const PALETTE = {"fire_bolt":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"firebolt","variant":"01","color":"orange","enableCustom":false,"customPath":""}},"scorch":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"scorchingray","variant":"01","color":"orange","enableCustom":false,"customPath":""}},"frost_ray":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"rayoffrost","variant":"01","color":"blue","enableCustom":false,"customPath":""}},"holy_bolt":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"guidingbolt","variant":"01","color":"yellow","enableCustom":false,"customPath":""}},"force_missile":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"magicmissile","variant":"01","color":"purple","enableCustom":false,"customPath":""}},"eldritch":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"eldritchblast","variant":"01","color":"purple","enableCustom":false,"customPath":""}},"chromatic":{"menu":"range","v":{"dbSection":"range","menuType":"spell","animation":"guidingbolt","variant":"02","color":"random","enableCustom":false,"customPath":""}},"arrow":{"menu":"range","v":{"dbSection":"range","menuType":"weapon","animation":"arrow","variant":"regular","color":"regular","enableCustom":false,"customPath":""}},"sword":{"menu":"melee","v":{"dbSection":"melee","menuType":"weapon","animation":"sword","variant":"01","color":"white","enableCustom":false,"customPath":""}},"club":{"menu":"melee","v":{"dbSection":"melee","menuType":"weapon","animation":"club","variant":"01","color":"white","enableCustom":false,"customPath":""}},"dagger":{"menu":"melee","v":{"dbSection":"melee","menuType":"weapon","animation":"dagger","variant":"01","color":"white","enableCustom":false,"customPath":""}},"fist":{"menu":"melee","v":{"dbSection":"melee","menuType":"weapon","animation":"unarmedstrike","variant":"physical","color":"yellow","enableCustom":false,"customPath":""}},"cone_cold":{"menu":"templatefx","v":{"dbSection":"templatefx","menuType":"cone","animation":"coneofcold","variant":"01","color":"blue","enableCustom":false,"customPath":""}},"lightning":{"menu":"templatefx","v":{"dbSection":"templatefx","menuType":"ray","animation":"lightningbolt","variant":"01","color":"blue","enableCustom":false,"customPath":""}},"shatter":{"menu":"templatefx","v":{"dbSection":"templatefx","menuType":"circle","animation":"shatter","variant":"01","color":"orange","enableCustom":false,"customPath":""}},"evocation":{"menu":"templatefx","v":{"dbSection":"templatefx","menuType":"circle","animation":"magicsign","variant":"evocation","color":"red","enableCustom":false,"customPath":""}},"heal":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"curewounds","variant":"01","color":"blue","enableCustom":false,"customPath":""}},"heal_generic":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"generichealing","variant":"01","color":"blue","enableCustom":false,"customPath":""}},"shield_ice":{"menu":"ontoken","v":{"dbSection":"static","menuType":"shieldfx","animation":"ice","variant":"03","color":"purple","enableCustom":false,"customPath":""}},"frost_impact":{"menu":"ontoken","v":{"dbSection":"static","menuType":"impact","animation":"frost","variant":"01","color":"blue","enableCustom":false,"customPath":""}},"bless":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"bless","variant":"intro","color":"yellow","enableCustom":false,"customPath":""}},"bless_loop":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"bless","variant":"loop","color":"purple","enableCustom":false,"customPath":""}},"divine_buff":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"divinesmite","variant":"source","color":"yellowwhite","enableCustom":false,"customPath":""}},"music":{"menu":"ontoken","v":{"dbSection":"static","menuType":"music","animation":"notes","variant":"01","color":"purple","enableCustom":false,"customPath":""}},"sacred":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"sacredflame","variant":"target","color":"yellow","enableCustom":false,"customPath":""}},"curse":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"divinesmite","variant":"source","color":"darkpurple","enableCustom":false,"customPath":""}},"fear":{"menu":"ontoken","v":{"dbSection":"static","menuType":"conditions","animation":"fear","variant":"02","color":"darkpurple","enableCustom":false,"customPath":""}},"hold":{"menu":"ontoken","v":{"dbSection":"static","menuType":"magicsign","animation":"enchantment","variant":"02","color":"purple","enableCustom":false,"customPath":""}},"necro":{"menu":"ontoken","v":{"dbSection":"static","menuType":"spell","animation":"tollthedead","variant":"skull","color":"green","enableCustom":false,"customPath":""}},"explosion":{"menu":"ontoken","v":{"dbSection":"static","menuType":"generic","animation":"explosion","variant":"01","color":"red","enableCustom":false,"customPath":""}}};
  const MAP = {"Anchor of the Known":{"anim":"shield_ice","icon":null},"Hunting Rifle":{"anim":"arrow","icon":null},"Singing Hammer":{"anim":"club","icon":null},"Plasma Lance":{"anim":"fire_bolt","icon":"bbttcc_icons_ray_1.png"},"Laser Pistol, Rad":{"anim":"holy_bolt","icon":null},"Resonance Howler":{"anim":"shatter","icon":"bbttcc_icons_shout_1.png"},"Horns of Bad Luck":{"anim":"fist","icon":null},"Sap":{"anim":"club","icon":null},"Lantern of Unforgotten Light":{"anim":"bless","icon":null},"Snack Machine Familiar":{"anim":"bless","icon":null},"Scrubber Harness":{"anim":"heal","icon":null},"Soulbound Hex-Reaver":{"anim":"sword","icon":"BBTTCC_button_icon_void_edge_1.png"},"Brass Knife of the Quiet Word":{"anim":"dagger","icon":null},"Pact-Pen Stylus":{"anim":"dagger","icon":null},"Mortar Battery":{"anim":"shatter","icon":"bbttcc_icons_siege_2.png"},"Discount Summoning Circle (10% off)":{"anim":"evocation","icon":null},"Yesodic Hammer of the First Word":{"anim":"club","icon":null},"Gilded Atonement Blade":{"anim":"sword","icon":null},"Potion of Radical Chill":{"anim":"frost_impact","icon":null},"Phase Disruptor":{"anim":"force_missile","icon":"BBTTCC_button_icon_dimensional_1.png"},"Frikkin' Laser Blade Saber":{"anim":"sword","icon":null},"Rad‑Bloom Injector":{"anim":"heal","icon":null},"Apology Knife, Mass-Produced":{"anim":"dagger","icon":null},"Laser Rifle, Rad":{"anim":"holy_bolt","icon":null},"Yesodic Edge":{"anim":"sword","icon":null},"Hex-Script Pistol":{"anim":"eldritch","icon":"BBTTCC_button_icon_hex_1.png"},"Mercy Driver":{"anim":"club","icon":null}};
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
  const pack = game.packs.get("bbttcc-master-content.items")
            || game.packs.find(p => p.metadata?.name === "items" && (p.metadata?.packageName||p.collection||"").includes("master-content"))
            || game.packs.find(p => (p.title||"") === "BBTTCC Items");
  if (!pack) return ui.notifications.error("Could not find the BBTTCC master-content items compendium.");
  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
  const docs = await pack.getDocuments();
  const plan = { anim:[], both:[], skipHasAA:0, skipNoMatch:0, skipArt:0 };
  for (const doc of docs) {
    const m = MAP[doc.name];
    if (!m) { plan.skipNoMatch++; continue; }
    const upd = {};
    if (!doc.flags?.autoanimations) upd["flags.autoanimations"] = buildAA(m.anim, doc.name);
    else plan.skipHasAA++;
    const isGeneric = /^icons\//.test(doc.img || "");
    if (m.icon && isGeneric) upd["img"] = ICON_BASE + "/" + m.icon;
    else if (m.icon && !isGeneric) plan.skipArt++;
    if (!Object.keys(upd).length) continue;
    const tag = (upd["flags.autoanimations"]?"🎬":"") + (upd["img"]?"🎨":"");
    (upd["flags.autoanimations"] && upd["img"] ? plan.both : plan.anim).push(doc.name + " " + tag);
    if (!DRY_RUN) await doc.update(upd);
  }
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });
  const n = plan.anim.length + plan.both.length;
  console.log("=== animate-master-content-items "+(DRY_RUN?"(DRY RUN)":"(APPLIED)")+" ===");
  console.log("anim+icon:", plan.both);
  console.log("anim only:", plan.anim);
  console.log("skipped — already had AA:", plan.skipHasAA, "| not in map (passive/gear):", plan.skipNoMatch, "| icon kept (non-generic art):", plan.skipArt);
  ui.notifications.info((DRY_RUN?"[DRY RUN] ":"")+"Master-content items: "+plan.both.length+" anim+icon, "+plan.anim.length+" anim-only ("+n+" changes). "+plan.skipHasAA+" already had AA. Console (F12) for detail."+(DRY_RUN?" Set DRY_RUN=false to apply.":" F5 to load."));
})();
