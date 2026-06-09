// animate-starter-manifestations.full.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 after.
// COMPLETE coverage of all 48 RFI Starter Manifestations (29 weapons + 19 powers).
// Supersedes the older animate-starter-manifestations.macro.js (whose MAP only matched 26 of
// the 48 and was mixed with non-manifestation names). Keyed by exact item NAME.
//
//   • NON-DESTRUCTIVE — only ADDS flags.autoanimations to manifestations that lack it.
//     Idempotent: skips anything that already has AA. Safe to re-run.
//   • DRY_RUN=true first (reports only). Set DRY_RUN=false to apply.
//
// Palette = ONLY db combos already live-validated in the deployed Surge/NPC packs, so every
// effect is guaranteed to resolve. Menus are manifestation-aware: weapons strike (melee/range),
// zones template (templatefx), worn/mark/command effects play on-token (ontoken).
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  // ---- live-confirmed palette (menu + AA db keys) ----
  const PALETTE = {
    // melee strikes
    sword:       { menu:"melee",     v:{ dbSection:"melee",     menuType:"weapon",   animation:"sword",       variant:"01",       color:"white"      } },
    club:        { menu:"melee",     v:{ dbSection:"melee",     menuType:"weapon",   animation:"club",        variant:"01",       color:"white"      } },
    dagger:      { menu:"melee",     v:{ dbSection:"melee",     menuType:"weapon",   animation:"dagger",      variant:"01",       color:"white"      } },
    fist:        { menu:"melee",     v:{ dbSection:"melee",     menuType:"weapon",   animation:"unarmedstrike", variant:"physical", color:"yellow"   } },
    // ranged bolts
    eldritch:    { menu:"range",     v:{ dbSection:"range",     menuType:"spell",    animation:"eldritchblast", variant:"01",     color:"purple"     } },
    magicmissile:{ menu:"range",     v:{ dbSection:"range",     menuType:"spell",    animation:"magicmissile", variant:"01",      color:"purple"     } },
    arrow:       { menu:"range",     v:{ dbSection:"range",     menuType:"weapon",   animation:"arrow",       variant:"regular",  color:"regular"    } },
    holy_bolt:   { menu:"range",     v:{ dbSection:"range",     menuType:"spell",    animation:"guidingbolt", variant:"01",       color:"yellow"     } },
    chromatic:   { menu:"range",     v:{ dbSection:"range",     menuType:"spell",    animation:"guidingbolt", variant:"02",       color:"random"     } },
    // area / templates
    shatter:     { menu:"templatefx",v:{ dbSection:"templatefx",menuType:"circle",   animation:"shatter",     variant:"01",       color:"orange"     } },
    cone_cold:   { menu:"templatefx",v:{ dbSection:"templatefx",menuType:"cone",     animation:"coneofcold",  variant:"01",       color:"blue"       } },
    evocation:   { menu:"templatefx",v:{ dbSection:"templatefx",menuType:"circle",   animation:"magicsign",   variant:"evocation",color:"red"        } },
    // on-token
    shield_ice:  { menu:"ontoken",   v:{ dbSection:"static",    menuType:"shieldfx", animation:"ice",         variant:"03",       color:"purple"     } },
    bless:       { menu:"ontoken",   v:{ dbSection:"static",    menuType:"spell",    animation:"bless",       variant:"intro",    color:"yellow"     } },
    heal:        { menu:"ontoken",   v:{ dbSection:"static",    menuType:"spell",    animation:"curewounds",  variant:"01",       color:"blue"       } },
    curse:       { menu:"ontoken",   v:{ dbSection:"static",    menuType:"spell",    animation:"divinesmite", variant:"source",   color:"darkpurple" } },
    hold:        { menu:"ontoken",   v:{ dbSection:"static",    menuType:"magicsign",animation:"enchantment", variant:"02",       color:"purple"     } },
    bless_loop:  { menu:"ontoken",   v:{ dbSection:"static",    menuType:"spell",    animation:"bless",       variant:"loop",     color:"purple"     } },
    divine_buff: { menu:"ontoken",   v:{ dbSection:"static",    menuType:"spell",    animation:"divinesmite", variant:"source",   color:"yellowwhite"} },
  };

  // ---- exact item NAME -> palette key (29 weapons + 19 powers) ----
  const MAP = {
    // ===== WEAPONS =====
    "Mercy's Edge":          "sword",        // weapon/protect/kinetic — restrained blade
    "Repaired Memory":       "heal",         // worn/repair/energy
    "Lucid Standard":        "hold",         // structure/command/psychic — command sigil
    "Wayhound Companion":    "hold",         // companion/move — conjured guide
    "Hearing-Field":         "evocation",    // zone/reveal/energy
    "Scribe's Familiar":     "hold",         // companion/reveal
    "Marshal's Mantle":      "bless",        // worn/command/energy — rally
    "Long Ledger":           "hold",         // structure/reveal/psychic
    "Standing Oath":         "hold",         // worn/command/psychic — binding oath
    "Dream-Twin":            "bless_loop",   // companion/transform — duplicate shimmer
    "Threshold Cloak":       "bless_loop",   // worn/move/psychic — phase
    "Reliquary Vow":         "shield_ice",   // worn/protect/energy — ward
    "Cadence Standard":      "bless",        // structure/command/energy
    "Court of Seven":        "evocation",    // zone/reveal — rule circle
    "Wrath-Brand":           "sword",        // weapon/harm/fire — cutting blade
    "Pressure Front":        "shatter",      // structure/move/kinetic — pressure wave
    "Carry-the-Unsayable":   "hold",         // structure/bind/psychic — containment sigil
    "Wall of My People":     "shield_ice",   // zone/protect/kinetic — barrier wall
    "Anvil Stance":          "shield_ice",   // worn/protect/kinetic — grounding ward
    "Borrowed Bastion":      "shield_ice",   // structure/protect/kinetic — fortress
    "Witness Flame":         "bless",        // structure/reveal/energy — illumination
    "Marginalia Drift":      "evocation",    // zone/transform/psychic
    "Sigil of Seeing":       "hold",         // worn/reveal/psychic — sight sigil
    "Living Glossary":       "hold",         // worn/reveal/psychic — word manifestation
    "Apprentice's Echo":     "hold",         // companion/reveal/energy — summoned echo
    "Mercy Arc":             "holy_bolt",    // weapon/harm/sephirotic — golden arc
    "Dread Crown":           "curse",        // worn/command/psychic — dread authority
    "Memory-Bramble":        "evocation",    // zone/bind/psychic — thorny field
    "Atlas Prism":           "evocation",    // zone/reveal/psychic — prismatic lens
    // ===== POWERS =====
    "Footnote":              "hold",         // event/reveal — annotation sigil
    "Threshold Receipt":     "bless_loop",   // event/move — teleport
    "Mirrorstep":            "bless_loop",   // event/move — reflection step
    "Penalty Clause":        "eldritch",     // event/harm/psychic — psychic bolt
    "Correspondence Strike": "magicmissile", // event/harm/psychic — remote bolt
    "Sleep-Loop":            "hold",         // mark/bind — sleep mark
    "Borrowed Face":         "bless_loop",   // transformation — disguise shimmer
    "Italic Emphasis":       "bless",        // event/command — emphasis glow
    "Lensing":               "hold",         // event/reveal — lens unveil
    "Cite Precedent":        "hold",         // event/command — precedent sigil
    "Strikethrough":         "curse",        // event/transform — erasure
    "Measured Breath Accord":"bless_loop",   // zone/protect — calm field
    "Hearth-Nail Covenant":  "heal",         // structure/repair — covenant warmth
    "Bind Witness":          "hold",         // mark/bind — binding mark
    "Margin Note: Not Yet":  "hold",         // mark/command — edit glyph
    "Clause Lantern":        "bless",        // zone/bind/energy — lantern light
    "Wide Angle":            "hold",         // event/reveal — exposure
    "Angle of Witness":      "evocation",    // zone/reveal — geometry glyph
    "Impossible Second Self":"bless_loop",   // companion/transform — duplicate
  };

  // ---- AA flag scaffolding ----
  const SOUND = { enable:false, delay:0, repeat:1, repeatDelay:250, startTime:0, volume:0.75 };
  const POPT  = { contrast:0, delay:0, elevation:1000, isWait:false, opacity:1, playbackRate:1, repeat:1, repeatDelay:250, saturate:0, size:1, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const SOPT  = { addTokenWidth:false, anchor:"0.5", contrast:0, delay:0, elevation:1000, fadeIn:250, fadeOut:500, isMasked:false, isRadius:true, isWait:false, opacity:1, repeat:1, repeatDelay:250, saturate:0, size:1.5, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const offBlk = () => ({ enable:false, video:{ dbSection:"static", menuType:"spell", animation:"curewounds", variant:"01", color:"blue", enableCustom:false, customPath:"" }, sound:{ ...SOUND }, options:{ ...SOPT } });
  const buildAA = (tag, name) => {
    const p = PALETTE[tag];
    return {
      id: (globalThis.crypto?.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); })),   // AA 7.x requires a UUIDv4 id (slug ids throw on AA-config open)
      label: name, macro:{ enable:false, playWhen:"0" }, menu: p.menu,
      primary: { video:{ ...p.v, enableCustom:false, customPath:"" }, sound:{ ...SOUND }, options:{ ...POPT } },
      secondary: offBlk(), soundOnly:{ sound:{ ...SOUND } }, source: offBlk(), target: offBlk(),
      isEnabled:true, isCustomized:true, fromAmmo:false, version:5,
    };
  };

  const pack = game.packs.get("fourththing.starter-manifestations")
            || game.packs.find(p => p.metadata?.name === "starter-manifestations" && p.metadata?.type === "Item")
            || game.packs.find(p => (p.title || "").toLowerCase().includes("starter manifestation"));
  if (!pack) return ui.notifications.error("Could not find the 'RFI Starter Manifestations' compendium.");

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
  const docs = await pack.getDocuments();

  const plan = { stamped:[], skipHasAA:[], missing:[] };
  const seen = new Set();
  for (const doc of docs) {
    const tag = MAP[doc.name];
    if (!tag) continue;
    seen.add(doc.name);
    if (doc.flags?.autoanimations) { plan.skipHasAA.push(doc.name); continue; }
    if (!DRY_RUN) await doc.update({ "flags.autoanimations": buildAA(tag, doc.name) });
    plan.stamped.push(`${doc.name}  [${tag}/${PALETTE[tag].menu}]`);
  }
  for (const name of Object.keys(MAP)) if (!seen.has(name)) plan.missing.push(name);
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });

  console.log("=== animate-starter-manifestations.full " + (DRY_RUN ? "(DRY RUN — no changes)" : "(APPLIED)") + " ===");
  console.log(`Stamped (${plan.stamped.length}):`); console.log(plan.stamped.join("\n") || "  (none — all already had AA)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.missing.length) console.warn(`⚠ ${plan.missing.length} mapped name(s) NOT found in pack:`, plan.missing);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `Manifestations: ${plan.stamped.length} ${DRY_RUN ? "would be stamped" : "stamped"}, ${plan.skipHasAA.length} already had AA.${plan.missing.length ? " ⚠ " + plan.missing.length + " not found." : ""} See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load."));
})();
