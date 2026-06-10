// animate-npc-abilities.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 afterwards.
// Stamps Automated Animations (flags.autoanimations) onto the activatable NPC abilities in the
// "Bad Eden NPC Abilities" compendium (bbttcc-master-content.npc-abilities).
//
// Scope (2026-06-09 live Ember audit, 190 items): 97 already AA-stamped, ~89 unanimated are
// PASSIVE traits/auras/multiattack tags (not animated), and 8 are genuinely active abilities
// (attacks / teleport / reaction wards / last-stand) that lack AA — this macro fills those 8.
// NO build gap (these are functional NPC features that fire on use). Unlike the ontoken-only
// sibling macros, NPC attacks use the full menu range (melee/range) like the existing 97 —
// every combo below is copied byte-for-byte from a live-validated stamp in this same pack.
//
//   • NON-DESTRUCTIVE — only ADDS AA to items that lack it; keyed by exact item NAME.
//     Idempotent. DRY_RUN=true first; set false to apply.
//   • IDs are valid UUIDv4 (AA 7.x requirement — slug ids throw on AA-config open).
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  // ---- palette: each entry carries its OWN menu + full primary.video (live-validated in
  //      this pack). melee/range fire on the NPC's attack workflow; ontoken on any use. ----
  const PALETTE = {
    bite:      { menu:"melee",   v:{ dbSection:"melee",  menuType:"weapon",   animation:"unarmedstrike", variant:"physical", color:"yellow" } },
    blade:     { menu:"melee",   v:{ dbSection:"melee",  menuType:"weapon",   animation:"sword",         variant:"01",       color:"white"  } },
    blink:     { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",    animation:"bless",         variant:"loop",     color:"purple" } },
    psyBolt:   { menu:"range",   v:{ dbSection:"range",  menuType:"spell",    animation:"eldritchblast", variant:"01",       color:"purple" } },
    ward:      { menu:"ontoken", v:{ dbSection:"static", menuType:"shieldfx", animation:"ice",           variant:"03",       color:"purple" } },
    foresight: { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",    animation:"bless",         variant:"intro",    color:"yellow" } },
    laststand: { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",    animation:"tollthedead",   variant:"skull",    color:"green"  } },
  };

  // ---- curated map: exact item NAME -> palette key ----
  const MAP = {
    "Territorial":          "bite",      // reaction bite when a creature ends turn within 10 ft
    "Overkill":             "blade",     // bonus chainblade attack on a kill
    "Slip the Frame":       "blink",     // reaction teleport 15 ft (attack at disadvantage)
    "Broken Pact":          "psyBolt",   // reaction Mumbled Prayer attack on psychic/qliphothic dmg
    "Pre-Fall Diagnostics": "ward",      // construct recalibrate — reroll-highest on the attacker
    "Read the Vector":      "foresight", // 1/scene reroll-lowest defense (sees the strike coming)
    "Minor Ward":           "ward",      // reaction grant an ally resistance
    "Hex-Iron Heart":       "laststand", // act 1 more round at 0 Integrity, then fall
  };

  // ---- AA flag scaffolding (UUIDv4 id — AA 7.x ObjectEntryStore requires it) ----
  const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); }));
  const SOUND = { enable:false, delay:0, repeat:1, repeatDelay:250, startTime:0, volume:0.75 };
  const POPT  = { contrast:0, delay:0, elevation:1000, isWait:false, opacity:1, playbackRate:1, repeat:1, repeatDelay:250, saturate:0, size:1, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const SOPT  = { addTokenWidth:false, anchor:"0.5", contrast:0, delay:0, elevation:1000, fadeIn:250, fadeOut:500, isMasked:false, isRadius:true, isWait:false, opacity:1, repeat:1, repeatDelay:250, saturate:0, size:1.5, tint:false, tintColor:"#FFFFFF", zIndex:1 };
  const offBlk = () => ({ enable:false, video:{ dbSection:"static", menuType:"spell", animation:"curewounds", variant:"01", color:"blue", enableCustom:false, customPath:"" }, sound:{ ...SOUND }, options:{ ...SOPT } });
  const buildAA = (tag, name) => {
    const p = PALETTE[tag];
    return {
      id: newId(), label: name, macro:{ enable:false, playWhen:"0" }, menu: p.menu,
      primary: { video:{ ...p.v, enableCustom:false, customPath:"" }, sound:{ ...SOUND }, options:{ ...POPT } },
      secondary: offBlk(), soundOnly:{ sound:{ ...SOUND } }, source: offBlk(), target: offBlk(),
      isEnabled:true, isCustomized:true, fromAmmo:false, version:5,
    };
  };

  const pack = game.packs.get("bbttcc-master-content.npc-abilities")
            || game.packs.find(p => p.metadata?.name === "npc-abilities" && p.metadata?.type === "Item")
            || game.packs.find(p => (p.title || "").toLowerCase() === "bbttcc npc abilities");
  if (!pack) return ui.notifications.error("Could not find the 'Bad Eden NPC Abilities' compendium in this world.");

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
    plan.stamped.push(`${doc.name}  [${tag} · ${PALETTE[tag].menu}]`);
  }
  for (const name of Object.keys(MAP)) if (!seen.has(name)) plan.missing.push(name);
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });

  console.log("=== animate-npc-abilities " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log(`Stamped (${plan.stamped.length}):`); console.log(plan.stamped.join("\n") || "  (none — all already had AA)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.missing.length) console.warn(`⚠ ${plan.missing.length} mapped name(s) NOT found (fix spelling):`, plan.missing);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `NPC abilities: ${plan.stamped.length} ${DRY_RUN ? "would be stamped" : "stamped"} (97 already animated). ${plan.skipHasAA.length} already had AA.${plan.missing.length ? " ⚠ " + plan.missing.length + " not found." : ""} See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load."));
})();
