// animate-occult.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 afterwards.
// Stamps Automated Animations (flags.autoanimations) onto the activatable OCCULT-ASSOCIATION
// abilities in the "Occult Associations" compendium (bbttcc-character-options.occult-associations).
//
// Scope (2026-06-09 live Ember audit, 50 items): NO build gap — all 27 active occult
// abilities are already wired (CHAR_OPT char_opt_lookup). 21 already AA-stamped; this macro
// fills the 8 functional-but-unanimated TIER VARIANTS, each matched to its family's existing
// recipe for visual consistency. The other ~23 items are passive/lore (not animated).
//
//   • NON-DESTRUCTIVE — only ADDS AA to items that lack it; keyed by exact item NAME.
//     Idempotent. DRY_RUN=true first; set false to apply.
//   • IDs are valid UUIDv4 (AA 7.x requirement — slug ids throw on AA-config open).
//   • Palette = the same live-confirmed ontoken combos as the other animate-* macros.
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  const PALETTE = {
    bless:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell", animation:"bless",       variant:"intro",  color:"yellow"     } }, // fate / fortune buff (Tarot)
    divine_buff:{ menu:"ontoken", v:{ dbSection:"static", menuType:"spell", animation:"divinesmite", variant:"source", color:"yellowwhite" } }, // radiant purge (Exorcist)
    heal:       { menu:"ontoken", v:{ dbSection:"static", menuType:"spell", animation:"curewounds",  variant:"01",     color:"blue"       } }, // biological mending (Biomancer)
    curse:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell", animation:"divinesmite", variant:"source", color:"darkpurple" } }, // dark binding (Goetic)
  };

  // ---- curated map: exact item NAME -> palette key (matched to the family's animated tiers) ----
  const MAP = {
    "Occult Association: Tarot Mage (Tier 4)":               "bless",       // matches Tarot T1/T3
    "Occult Association: Exorcist / Purifier (Tier 2)":      "divine_buff", // radiant purge (family had none animated)
    "Occult Association: Exorcist / Purifier (Tier 3)":      "divine_buff",
    "Occult Association: Exorcist / Purifier (Tier 4)":      "divine_buff",
    "Occult Association: Biomancer / Fleshcrafter (Tier 1)": "heal",        // flesh/casualty mending
    "Occult Association: Biomancer / Fleshcrafter (Tier 2)": "heal",
    "Occult Association: Biomancer / Fleshcrafter (Tier 4)": "heal",
    "Occult Association: Goetic Summoner (Tier 4)":          "curse",       // matches Goetic T3 darkpurple
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

  const pack = game.packs.get("bbttcc-character-options.occult-associations")
            || game.packs.find(p => p.metadata?.name === "occult-associations" && p.metadata?.type === "Item")
            || game.packs.find(p => (p.title || "").toLowerCase() === "occult associations");
  if (!pack) return ui.notifications.error("Could not find the 'Occult Associations' compendium in this world.");

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
    plan.stamped.push(`${doc.name}  [${tag}]`);
  }
  for (const name of Object.keys(MAP)) if (!seen.has(name)) plan.missing.push(name);
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });

  console.log("=== animate-occult " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log(`Stamped (${plan.stamped.length}):`); console.log(plan.stamped.join("\n") || "  (none — all already had AA)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.missing.length) console.warn(`⚠ ${plan.missing.length} mapped name(s) NOT found (fix spelling):`, plan.missing);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `Occult: ${plan.stamped.length} tier-variant(s) ${DRY_RUN ? "would be stamped" : "stamped"}. ${plan.skipHasAA.length} already had AA.${plan.missing.length ? " ⚠ " + plan.missing.length + " not found." : ""} See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load."));
})();
