// animate-classes.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 afterwards.
// Stamps Automated Animations (flags.autoanimations) onto the curated set of activatable
// CLASS features in the "BBTTCC Classes" compendium (bbttcc-master-content.classes).
//
// Mirrors tools/animate-starter-manifestations.macro.js:
//   • NON-DESTRUCTIVE — only ADDS AA to features that lack it; never touches features that
//     already have AA. Keyed by exact item NAME. Idempotent (safe to re-run).
//   • DRY_RUN=true first (reports only). Set DRY_RUN=false to apply.
//
// Palette note: every effect below is a "menu:ontoken" combo that is ALREADY live-validated
// in the deployed Surge/NPC packs, so it is guaranteed to resolve in the AA database. ontoken
// plays on the caster's token on use — the most reliable trigger for plain feats (no template/
// attack roll required). Tier-A features get a serviceable interim effect now and are tagged
// ⭐ for a later bespoke Sequencer pass (real teleport/wall-shatter/summon VFX).
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  // ---- proven ontoken palette (live-confirmed db keys from surge/npc) ----
  const PALETTE = {
    bless:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"intro",  color:"yellow"     } }, // radiant buff
    bless_loop: { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"loop",   color:"purple"     } }, // arcane swirl / calm / teleport shimmer
    divine_buff:{ menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"divinesmite", variant:"source", color:"yellowwhite" } }, // bright surge / heavy slam / revive
    shield_ice: { menu:"ontoken", v:{ dbSection:"static", menuType:"shieldfx",  animation:"ice",         variant:"03",     color:"purple"     } }, // defensive shield aura
    curse:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"divinesmite", variant:"source", color:"darkpurple" } }, // dark strike / dread / despair
    hold:       { menu:"ontoken", v:{ dbSection:"static", menuType:"magicsign", animation:"enchantment", variant:"02",     color:"purple"     } }, // sigil / conjure circle / dream
    heal:       { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"curewounds",  variant:"01",     color:"blue"       } }, // healing pulse
    necro:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"tollthedead", variant:"skull",  color:"green"      } }, // (unused by default; available)
    music:      { menu:"ontoken", v:{ dbSection:"static", menuType:"music",     animation:"notes",       variant:"01",     color:"purple"     } }, // (unused by default; available)
  };

  // ---- curated map: exact item NAME -> { anim: palette key, tier: "A"|"B" } ----
  // Tier A = bespoke-Sequencer candidates (interim AA now). Tier B = served well by the aura preset.
  const MAP = {
    // ===== TIER A — overt spectacle (⭐ flag for later bespoke VFX) =====
    "Blue Meridian":                                       { anim:"bless_loop",  tier:"A" }, // lucid-corridor teleport
    "Fractal Self":                                        { anim:"bless_loop",  tier:"A" }, // afterimage blink
    "Shadow Courier — Tier 2: The Crossing":               { anim:"bless_loop",  tier:"A" }, // step through a barrier
    "Shadow Courier — Tier 4: Unfound Route":              { anim:"bless_loop",  tier:"A" }, // threshold-to-threshold gate
    "Black Stair L17: The Stair That Does Not End (Capstone)": { anim:"bless_loop", tier:"A" }, // endless-stair portal
    "Last Mile L13: The Quiet Voyage":                     { anim:"bless_loop",  tier:"A" }, // go insubstantial / phase
    "Avalanche L13: The Breach":                           { anim:"divine_buff", tier:"A" }, // charge that shatters walls
    "Avalanche L5: Shockwave Arrival":                     { anim:"divine_buff", tier:"A" }, // line shockwave behind target
    "Cataclyst L9: Decide The Weather":                    { anim:"bless_loop",  tier:"A" }, // debris wall OR windstorm
    "Blood Hymn: Crimson Arc":                             { anim:"curse",       tier:"A" }, // blood cleave splash
    "Metaphor Apostle: Living Allegory":                   { anim:"hold",        tier:"A" }, // conjure allegorical entity
    "Spark Resurrection":                                  { anim:"divine_buff", tier:"A" }, // drag a construct back to life
    "Void Edge: Dread Cut":                                { anim:"curse",       tier:"A" }, // fear contagion to nearby foes
    "Metaphor Apostle: Make It True":                      { anim:"hold",        tier:"A" }, // metaphor becomes literal
    "Metaphor Apostle: Shared Dream":                      { anim:"hold",        tier:"A" }, // group shared dream overlay
    "Blood Hymn: Final Crescendo":                         { anim:"curse",       tier:"A" }, // Burn-4 rampage ignition

    // ===== TIER B — auras / fields / pulses (served by the preset) =====
    "Ascension Layer":             { anim:"bless",       tier:"B" }, // +2 defense aura
    "Unbreakable Front":           { anim:"bless",       tier:"B" }, // 30ft advantage/guard aura
    "Banner of the Final Push":    { anim:"bless",       tier:"B" }, // 30ft +2 atk/def banner
    "Voice of the Mandate":        { anim:"bless",       tier:"B" }, // authority/resolve aura
    "Hold the Line":               { anim:"bless",       tier:"B" }, // +1 guard field
    "Sentinel Protocol":           { anim:"bless",       tier:"B" }, // 30ft reveal/awareness field
    "Truth Horizon":               { anim:"bless",       tier:"B" }, // 30ft reveal invisibility
    "Solar Stillpoint":            { anim:"bless",       tier:"B" }, // 30ft golden-light aura
    "Triumph Weave":               { anim:"bless",       tier:"B" }, // 15ft victory momentum field
    "Covenant Prism":              { anim:"shield_ice",  tier:"B" }, // 30ft resistance aura
    "Sanctuary Engine":            { anim:"shield_ice",  tier:"B" }, // moving 15ft hammered-light zone
    "Shared Burden Harness":       { anim:"shield_ice",  tier:"B" }, // visible damage redirect
    "Pulse of the Forge":          { anim:"heal",        tier:"B" }, // 15ft healing heat wave
    "Unity Field":                 { anim:"heal",        tier:"B" }, // 10ft healing/defense aura
    "Resonant Truce":              { anim:"bless_loop",  tier:"B" }, // 15ft enforced-hesitation aura
    "Lull the Riot":               { anim:"bless_loop",  tier:"B" }, // 20ft calm field
    "Accord Mandala":              { anim:"bless_loop",  tier:"B" }, // 30ft violence-deterrent aura
    "Soft Focus":                  { anim:"bless_loop",  tier:"B" }, // softening presence field
    "Emissary of the Great Accord":{ anim:"bless_loop",  tier:"B" }, // scene-wide peace declaration
    "Stillheart: Centered Breath": { anim:"bless_loop",  tier:"B" }, // 10ft calm aura
    "Stillheart: Quiet Mind":      { anim:"bless_loop",  tier:"B" }, // 10ft fear/charm immunity aura
    "Stillheart: Eye of the Storm":{ anim:"bless_loop",  tier:"B" }, // 20ft burn/fear suppression
    "Stillheart: Shared Aura":     { anim:"bless_loop",  tier:"B" }, // 10ft ally aura share
    "Convergence Horizon":         { anim:"bless_loop",  tier:"B" }, // 30ft probability aura
    "Last Mile L1: The Weight You Carry": { anim:"bless_loop", tier:"B" }, // movement-speed field
    "Void Edge: Final Quiet":      { anim:"curse",       tier:"B" }, // 30ft despair/suppression zone
    "Aurablade: Change Aura":      { anim:"divine_buff", tier:"B" }, // Fury/Resolve/Mercy/Dread ignition
    "Aurablade: Core Features":    { anim:"divine_buff", tier:"B" }, // luminous blade-aura color-shift
  };

  // ---- AA flag scaffolding (matches animate-starter-manifestations.macro.js) ----
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

  // ---- locate the classes compendium ----
  const pack = game.packs.get("bbttcc-master-content.classes")
            || game.packs.find(p => p.metadata?.name === "classes" && p.metadata?.type === "Item")
            || game.packs.find(p => (p.title || "").toLowerCase() === "bbttcc classes");
  if (!pack) return ui.notifications.error("Could not find the 'BBTTCC Classes' compendium in this world.");

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
  // names in MAP that never matched a doc (typo / not in this world's pack)
  for (const name of Object.keys(MAP)) if (!seen.has(name)) plan.missing.push(name);
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });

  const total = plan.A.length + plan.B.length;
  console.log("=== animate-classes " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log(`⭐ TIER A (${plan.A.length}) — interim AA now, bespoke Sequencer later:`); console.log(plan.A.join("\n") || "  (none — all already had AA)");
  console.log(`\n✦ TIER B (${plan.B.length}) — aura/field presets:`); console.log(plan.B.join("\n") || "  (none — all already had AA)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.missing.length) console.warn(`⚠ ${plan.missing.length} mapped name(s) NOT found in this pack (check spelling / world version):`, plan.missing);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `Classes: ${plan.A.length} Tier-A + ${plan.B.length} Tier-B = ${total} ${DRY_RUN ? "would be stamped" : "stamped"}. ${plan.skipHasAA.length} already had AA.${plan.missing.length ? " ⚠ " + plan.missing.length + " names not found." : ""} See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load."));
})();
