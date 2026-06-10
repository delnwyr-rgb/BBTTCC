// animate-ancestries.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 afterwards.
// Stamps Automated Animations (flags.autoanimations) onto the activatable ANCESTRY
// abilities in the "Bad Eden Ancestries" compendium (bbttcc-master-content.ancestries).
//
// Sibling of tools/animate-classes.macro.js — same rules:
//   • NON-DESTRUCTIVE — only ADDS AA to features that lack it; never touches features that
//     already have AA (the 17 already-animated ancestry abilities are skipped). Keyed by exact
//     item NAME. Idempotent (safe to re-run).
//   • DRY_RUN=true first (reports only, incl. any mapped name NOT found → fix punctuation).
//     Set DRY_RUN=false to apply.
//
// Scope (from the 2026-06-09 live Ember audit, 157 items): 55 functional-but-unanimated
// CHAR_OPT/handler abilities + the 9 newly-built signature shells (Dragon/Angel/Eidolon/
// Ocean Judge) = 64 here. Passive/lore traits (68) and heritage-anchor container cards that
// are pure narrative are intentionally NOT animated. The 9 ⭐ Tier-A abilities ALSO carry a
// bespoke Sequencer recipe (bbttcc-fx-integration/integrations/class-tier-a-vfx.js) that plays
// on top of this interim AA via the fourththing:itemAnimated hook.
//
// Palette: every effect is a "menu:ontoken" combo already live-validated in the deployed
// Surge/NPC/Classes packs, so it is guaranteed to resolve in the AA database. ontoken plays
// on the user's token on use — the most reliable trigger for plain feats (no template/attack).
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  // ---- proven ontoken palette (live-confirmed db keys from surge/npc/classes) ----
  const PALETTE = {
    bless:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"intro",  color:"yellow"     } }, // radiant buff / ally aid
    bless_loop: { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"loop",   color:"purple"     } }, // shimmer / stealth / teleport / phase
    divine_buff:{ menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"divinesmite", variant:"source", color:"yellowwhite" } }, // bright surge / heavy slam / push
    shield_ice: { menu:"ontoken", v:{ dbSection:"static", menuType:"shieldfx",  animation:"ice",         variant:"03",     color:"purple"     } }, // defensive ward / interpose / anchor
    curse:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"divinesmite", variant:"source", color:"darkpurple" } }, // dark strike / bite / dread / scar
    hold:       { menu:"ontoken", v:{ dbSection:"static", menuType:"magicsign", animation:"enchantment", variant:"02",     color:"purple"     } }, // sigil / mind / memory / mark / conjure
    heal:       { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"curewounds",  variant:"01",     color:"blue"       } }, // healing pulse
  };

  // ---- curated map: exact item NAME -> { anim: palette key, tier: "A"|"B" } ----
  // Tier A = the 9 newly-built signature shells (also get a bespoke Sequencer recipe).
  // Tier B = the 55 already-functional ancestry abilities served by the ontoken preset.
  const MAP = {
    // ===== TIER A — newly-built signature shells (⭐ bespoke VFX layered on top) =====
    "Dragon: Adolescent Breath":                          { anim:"divine_buff", tier:"A" }, // 15ft elemental cone
    "Dragon: Ancient Aura":                               { anim:"curse",       tier:"A" }, // 30ft frighten aura
    "Dragon: Elder Wing":                                 { anim:"bless_loop",  tier:"A" }, // flight manifest
    "Angel: Archon's Word":                               { anim:"bless",       tier:"A" }, // 30ft truth-bind
    "Angel: Seraphic Wings":                              { anim:"bless",       tier:"A" }, // radiant flight
    "Angel: Grace Touch":                                 { anim:"heal",        tier:"A" }, // touch heal + cure
    "Eidolon: Concept-Voice":                             { anim:"hold",        tier:"A" }, // 4d6 psychic naming
    "Eidolon: Whisper Walk":                              { anim:"bless_loop",  tier:"A" }, // invis + phase wall
    "Oldenborn (Tideborne): Ocean Judge":                 { anim:"hold",        tier:"A" }, // oathbreaker mark

    // ===== TIER B — already-functional ancestry abilities (ontoken presets) =====
    // Circuitborn
    "Circuitborn (Exo-Knight Line): Bulwark Protocol":    { anim:"shield_ice",  tier:"B" },
    "Circuitborn (Exo-Knight Line): Shield Projector":    { anim:"shield_ice",  tier:"B" },
    "Circuitborn (Exo-Knight Line): Siegebreaker Frame":  { anim:"divine_buff", tier:"B" },
    "Circuitborn (Parallax Line): Ghost-In-The-Wires":    { anim:"hold",        tier:"B" },
    "Circuitborn (Parallax Line): Light-Bend Cloak":      { anim:"bless_loop",  tier:"B" },
    "Circuitborn (Parallax Line): Perfect Misdirection":  { anim:"bless_loop",  tier:"B" },
    "Circuitborn (Salvage Line): Mobile Facility Node":   { anim:"hold",        tier:"B" },
    "Circuitborn (Salvage Line): Patch-Logic Field":      { anim:"shield_ice",  tier:"B" },
    "Circuitborn (Salvage Line): Scrap Alchemy":          { anim:"hold",        tier:"B" },
    "Circuitborn (Synapse Line): Cognition Crown":        { anim:"hold",        tier:"B" },
    "Circuitborn (Synapse Line): Memory-Print":           { anim:"hold",        tier:"B" },
    "Circuitborn (Synapse Line): Noosphere Hook":         { anim:"hold",        tier:"B" },
    "Circuitborn (Synapse Line): Yesod-Diver":            { anim:"hold",        tier:"B" },
    "Circuitborn Heritage: Exo-Knight":                   { anim:"shield_ice",  tier:"B" },
    "Circuitborn Heritage: Salvage":                      { anim:"hold",        tier:"B" },
    "Circuitborn: Firmware of Identity":                  { anim:"hold",        tier:"B" },
    // Cryptidkin
    "Cryptidkin (Chupacabra): Blood-Drinker":             { anim:"curse",       tier:"B" },
    "Cryptidkin (Chupacabra): Skittering Night-Feeder":   { anim:"bless_loop",  tier:"B" },
    "Cryptidkin (Furrykin): Folklore Echo":               { anim:"bless_loop",  tier:"B" },
    "Cryptidkin (Furrykin): Pack Tongue":                 { anim:"bless",       tier:"B" },
    "Cryptidkin (Jackalope): Can't Catch Me":             { anim:"bless_loop",  tier:"B" },
    "Cryptidkin (Jackalope): Crossroads Hare":            { anim:"bless_loop",  tier:"B" },
    "Cryptidkin (Jackalope): Startle Reflex":             { anim:"bless_loop",  tier:"B" },
    "Cryptidkin: Folklore & Frame":                       { anim:"bless_loop",  tier:"B" },
    // Human
    "Human (Cro-Magnon): First Fire":                     { anim:"bless",       tier:"B" },
    "Human (Cro-Magnon): Pattern-Mind":                   { anim:"hold",        tier:"B" },
    "Human (Denisovan): Peak-Anchor":                     { anim:"shield_ice",  tier:"B" },
    "Human (Florensis): Living Folklore":                 { anim:"bless_loop",  tier:"B" },
    "Human (Neanderthal): Old Hunt":                      { anim:"curse",       tier:"B" },
    "Human (Neanderthal): Protective Instinct":           { anim:"shield_ice",  tier:"B" },
    "Human: Stubborn Spark":                              { anim:"bless",       tier:"B" },
    // Menhirkin
    "Menhirkin Heritage: Igneous":                        { anim:"divine_buff", tier:"B" },
    "Menhirkin Heritage: Metamorphic":                    { anim:"hold",        tier:"B" },
    "Menhirkin Heritage: Sedimentary":                    { anim:"shield_ice",  tier:"B" },
    "Menhirkin: Living Rampart":                          { anim:"shield_ice",  tier:"B" },
    // Oldenborn
    "Oldenborn (Earthbound): Mountain Stance":            { anim:"shield_ice",  tier:"B" },
    "Oldenborn (Earthbound): World-Anchor":               { anim:"shield_ice",  tier:"B" },
    "Oldenborn (Lumenwrought): Moonlit Ward":             { anim:"bless",       tier:"B" },
    "Oldenborn (Lumenwrought): Mythic Recollection":      { anim:"divine_buff", tier:"B" },
    "Oldenborn (Lumenwrought): Sovereign Mask":           { anim:"hold",        tier:"B" },
    "Oldenborn (Rustland Scavenger): Patch & Repurpose":  { anim:"hold",        tier:"B" },
    "Oldenborn (Rustland Scavenger): Salvage King":       { anim:"hold",        tier:"B" },
    "Oldenborn (Stormborn Nomad): Nomad Networks":        { anim:"bless",       tier:"B" },
    "Oldenborn (Stormborn Nomad): Skywalker":             { anim:"bless_loop",  tier:"B" },
    "Oldenborn (Stormborn Nomad): Ward of the Gale":      { anim:"shield_ice",  tier:"B" },
    "Oldenborn (Tideborne): Floodgate of Self":           { anim:"divine_buff", tier:"B" },
    "Oldenborn (Tideborne): Undertow Grip":               { anim:"divine_buff", tier:"B" },
    "Oldenborn Heritage: Rustland Scavenger":             { anim:"hold",        tier:"B" },
    "Oldenborn Heritage: Stormborn Nomad":                { anim:"bless_loop",  tier:"B" },
    // Qliph-Scarred heritages
    "Qliph-Scarred Heritage: Chthonic":                   { anim:"curse",       tier:"B" },
    "Qliph-Scarred Heritage: Diabolic":                   { anim:"curse",       tier:"B" },
    "Qliph-Scarred Heritage: Husk":                       { anim:"curse",       tier:"B" },
    // Sephirotic Scion heritages
    "Sephirotic Scion Heritage: Cherubic":                { anim:"bless",       tier:"B" },
    "Sephirotic Scion Heritage: Ophanic":                 { anim:"bless_loop",  tier:"B" },
    "Sephirotic Scion Heritage: Seraphic":                { anim:"bless",       tier:"B" },
  };

  // ---- AA flag scaffolding (matches animate-classes.macro.js) ----
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

  // ---- locate the ancestries compendium ----
  const pack = game.packs.get("bbttcc-master-content.ancestries")
            || game.packs.find(p => p.metadata?.name === "ancestries" && p.metadata?.type === "Item")
            || game.packs.find(p => (p.title || "").toLowerCase() === "bbttcc ancestries");
  if (!pack) return ui.notifications.error("Could not find the 'Bad Eden Ancestries' compendium in this world.");

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
  const docs = await pack.getDocuments();

  const plan = { A:[], B:[], skipHasAA:[], missing:[] };
  const seen = new Set();
  for (const doc of docs) {
    const m = MAP[doc.name];
    if (!m) continue;
    seen.add(doc.name);
    if (doc.flags?.autoanimations) { plan.skipHasAA.push(doc.name); continue; }
    if (!DRY_RUN) await doc.update({ "flags.autoanimations": buildAA(m.anim, doc.name) });
    plan[m.tier].push(`${doc.name}  [${m.anim}]`);
  }
  for (const name of Object.keys(MAP)) if (!seen.has(name)) plan.missing.push(name);
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });

  const total = plan.A.length + plan.B.length;
  console.log("=== animate-ancestries " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log(`⭐ TIER A (${plan.A.length}) — newly-built shells, bespoke Sequencer layered on top:`); console.log(plan.A.join("\n") || "  (none — all already had AA)");
  console.log(`\n✦ TIER B (${plan.B.length}) — already-functional ancestry abilities:`); console.log(plan.B.join("\n") || "  (none — all already had AA)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.missing.length) console.warn(`⚠ ${plan.missing.length} mapped name(s) NOT found in this pack (fix spelling/punctuation):`, plan.missing);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `Ancestries: ${plan.A.length} Tier-A + ${plan.B.length} Tier-B = ${total} ${DRY_RUN ? "would be stamped" : "stamped"}. ${plan.skipHasAA.length} already had AA.${plan.missing.length ? " ⚠ " + plan.missing.length + " names not found." : ""} See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load."));
})();
