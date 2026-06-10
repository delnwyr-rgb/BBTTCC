// animate-vehicles.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 afterwards.
// Stamps Automated Animations (flags.autoanimations) onto the vehicle-SYSTEM abilities in the
// "Bad Eden Vehicles" compendium (bbttcc-master-content.vehicles).
//
// NOTE: Vehicles is an ACTOR pack — the animatable things are the feat-items EMBEDDED on each
// vehicle actor (their weapons / beams / auras / shields), so this macro iterates actors → their
// items. Scope (2026-06-09 live Ember audit): 5 vehicle actors, 13 embedded feat-items, NONE
// animated, NO build gap (all are functional vehicle systems). This stamps all 13.
//
//   • NON-DESTRUCTIVE — only ADDS AA to embedded items that lack it; keyed by exact item NAME.
//     Idempotent. DRY_RUN=true first; set false to apply.
//   • IDs are valid UUIDv4 (AA 7.x requirement — slug ids throw on AA-config open).
//   • menu:"ontoken" plays on the vehicle's token on use — reliable for feat-items (no attack/
//     template workflow needed). Upgrade a cannon/beam to menu:"range" later if you want a
//     projectile streak to the target (requires the feat to roll an attack with a target).
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  const PALETTE = {
    bless:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"intro",  color:"yellow"     } }, // radiant beam / ally broadcast
    bless_loop: { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"loop",   color:"purple"     } }, // teleport / phase / stealth / calm
    divine_buff:{ menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"divinesmite", variant:"source", color:"yellowwhite" } }, // energy cannon / slam / siege strike
    shield_ice: { menu:"ontoken", v:{ dbSection:"static", menuType:"shieldfx",  animation:"ice",         variant:"03",     color:"purple"     } }, // shield / retaliation ward
    hold:       { menu:"ontoken", v:{ dbSection:"static", menuType:"magicsign", animation:"enchantment", variant:"02",     color:"purple"     } }, // control / debuff field
  };

  // ---- curated map: exact embedded-item NAME -> palette key ----
  const MAP = {
    "Slipstream Jump":                    "bless_loop",  // 600ft teleport
    "Twin Pulsar Cannons":                "divine_buff", // lightning cannon overload
    "Harmony Broadcast":                  "bless_loop",  // 300ft calm-emotions
    "Stealth (Intrigue) (Intrigue) Veil": "bless_loop",  // turn invisible
    "Cherubic Beam":                      "bless",       // radiant charm beam
    "Dimensional Skew":                   "bless_loop",  // ignore terrain / OA (phase)
    "Info-Psalm Broadcast":               "bless",       // 120ft ally +1d4 buff
    "Ramming Horn":                       "divine_buff", // charge slam / prone
    "Ritual Lance":                       "divine_buff", // siege strike vs structures
    "Tooth Halo":                         "shield_ice",  // reaction radiant retaliation
    "Sanctum Shield":                     "shield_ice",  // temp Integrity + ally Guard
    "Audit Field":                        "hold",        // 600ft debuff/control aura
    "Pulsar Array":                       "divine_buff", // radiant+force blast
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

  const pack = game.packs.get("bbttcc-master-content.vehicles")
            || game.packs.find(p => p.metadata?.name === "vehicles" && p.metadata?.type === "Actor")
            || game.packs.find(p => (p.title || "").toLowerCase() === "bbttcc vehicles");
  if (!pack) return ui.notifications.error("Could not find the 'Bad Eden Vehicles' compendium in this world.");

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
  const actors = await pack.getDocuments();

  // Valid fourththing Actor types (template.json). The shipped Vehicles pack actors are
  // legacy dnd5e type:"vehicle" with dnd5e system data — they fail validation on ANY write
  // (the server re-validates the parent actor when you update an embedded item), so embedded
  // AA stamps are impossible until the actors are PORTED to a native "rig". Detect + report
  // instead of crashing on the first update.
  const VALID_ACTOR_TYPES = new Set(["character", "npc", "rig", "boss"]);
  const plan = { stamped:[], skipHasAA:[], missing:[], blockedActors:[], failed:[] };
  const seen = new Set();
  for (const actor of actors) {
    const badType = !VALID_ACTOR_TYPES.has(actor.type);
    if (badType) plan.blockedActors.push(`${actor.name} (type="${actor.type}" — not a valid fourththing actor type; port to "rig" first)`);
    for (const item of actor.items) {
      const tag = MAP[item.name];
      if (!tag) continue;
      seen.add(item.name);
      if (item.flags?.autoanimations) { plan.skipHasAA.push(`${actor.name} → ${item.name}`); continue; }
      if (badType) { plan.failed.push(`${actor.name} → ${item.name} (parent type "${actor.type}" invalid)`); continue; }
      if (!DRY_RUN) {
        try { await item.update({ "flags.autoanimations": buildAA(tag, item.name) }); }
        catch (e) { plan.failed.push(`${actor.name} → ${item.name}: ${e.message}`); continue; }
      }
      plan.stamped.push(`${actor.name} → ${item.name}  [${tag}]`);
    }
  }
  for (const name of Object.keys(MAP)) if (!seen.has(name)) plan.missing.push(name);
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:true });

  console.log("=== animate-vehicles " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log(`Stamped (${plan.stamped.length}):`); console.log(plan.stamped.join("\n") || "  (none)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.blockedActors.length) {
    console.warn(`\n⛔ ${plan.blockedActors.length} vehicle actor(s) have an INVALID type — they are legacy dnd5e "vehicle" actors never ported to the fourththing "rig" schema. Embedded items on them CANNOT be written (parent fails validation). Port them to type "rig" before animating:`);
    for (const b of plan.blockedActors) console.warn("   " + b);
  }
  if (plan.failed.length) { console.warn(`\n✗ ${plan.failed.length} item(s) could NOT be stamped:`); for (const f of plan.failed) console.warn("   " + f); }
  if (plan.missing.length) console.warn(`\n⚠ ${plan.missing.length} mapped name(s) NOT found on any vehicle (fix spelling):`, plan.missing);
  ui.notifications[plan.blockedActors.length ? "warn" : "info"]((DRY_RUN ? "[DRY RUN] " : "") + `Vehicles: ${plan.stamped.length} stamped, ${plan.failed.length} blocked.` + (plan.blockedActors.length ? ` ${plan.blockedActors.length} vehicle actor(s) are legacy dnd5e type — port to "rig" first. See console (F12).` : (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load.")));
})();
