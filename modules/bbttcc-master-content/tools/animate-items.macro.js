// animate-items.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds. F5 afterwards.
// Stamps Automated Animations (flags.autoanimations) onto the activatable NON-WEAPON
// items in the "BBTTCC Items" compendium (bbttcc-master-content.items).
//
// NOTE on scope (from the 2026-06-09 live Ember audit, 276 items): all 26 WEAPONS are
// already AA-stamped (they animate on attack) — this macro does NOT touch them. Most of the
// other 250 items are passive gear/armor/skill-rank feats (NOT worth animating — a backpack
// or a +1-rank trait has no "use" moment). Only the handful of genuinely active non-weapon
// items below get an effect. The bad slug-ids on the existing weapon stamps are repaired
// separately by tools/fix-aa-ids.macro.js — run that FIRST.
//
//   • NON-DESTRUCTIVE — only ADDS AA to items that lack it; keyed by exact item NAME.
//     Idempotent. DRY_RUN=true first (reports + any name-not-found); set false to apply.
//   • IDs are valid UUIDv4 (AA 7.x requirement — slug ids throw on AA-config open).
//   • Palette = the same live-confirmed ontoken combos as animate-classes/ancestries.
(async () => {
  const DRY_RUN = true;                               // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  const PALETTE = {
    bless:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"intro",  color:"yellow"     } }, // light flare / ally buff
    bless_loop: { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"bless",       variant:"loop",   color:"purple"     } }, // calming tone
    curse:      { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"divinesmite", variant:"source", color:"darkpurple" } }, // intimidation / dread
    hold:       { menu:"ontoken", v:{ dbSection:"static", menuType:"magicsign", animation:"enchantment", variant:"02",     color:"purple"     } }, // sensor / sigil
    heal:       { menu:"ontoken", v:{ dbSection:"static", menuType:"spell",     animation:"curewounds",  variant:"01",     color:"blue"       } }, // cleanse / restore
  };

  // ---- curated map: exact item NAME -> { anim, tier }. tier:"F"=feat (best-effort: verify
  //      it fires AA on use in this system; consumable/equipment use the standard item flow). ----
  const MAP = {
    "Glowstick of the Ancients": { anim:"bless",      tier:"B" }, // crack → bright light + reveal residue
    "Crowd-Calmer Beacon":       { anim:"bless_loop", tier:"B" }, // 60ft soothing tone (Calm Emotions)
    "Geiger Familiar Drone":     { anim:"hold",       tier:"B" }, // release sensor drone
    "Terraformer Ampule":        { anim:"heal",       tier:"B" }, // cleanse 30ft hazard
    "Backline Commander":        { anim:"bless",      tier:"F" }, // bonus-action ally steer/buff
    "Threatening Silence":       { anim:"curse",      tier:"F" }, // bonus-action intimidate
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

  const pack = game.packs.get("bbttcc-master-content.items")
            || game.packs.find(p => p.metadata?.name === "items" && p.metadata?.type === "Item")
            || game.packs.find(p => (p.title || "").toLowerCase() === "bbttcc items");
  if (!pack) return ui.notifications.error("Could not find the 'BBTTCC Items' compendium in this world.");

  const wasLocked = pack.locked;
  if (wasLocked && !DRY_RUN) await pack.configure({ locked:false });
  const docs = await pack.getDocuments();

  const plan = { B:[], F:[], skipHasAA:[], missing:[] };
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

  const total = plan.B.length + plan.F.length;
  console.log("=== animate-items " + (DRY_RUN ? "(DRY RUN — no changes written)" : "(APPLIED)") + " ===");
  console.log(`✦ Consumable/equipment actives (${plan.B.length}):`); console.log(plan.B.join("\n") || "  (none — all already had AA)");
  console.log(`\n⚙ Feat-items (${plan.F.length}) — verify these fire AA on use in-world:`); console.log(plan.F.join("\n") || "  (none)");
  console.log(`\nSkipped — already had AA (${plan.skipHasAA.length}):`, plan.skipHasAA);
  if (plan.missing.length) console.warn(`⚠ ${plan.missing.length} mapped name(s) NOT found (fix spelling):`, plan.missing);
  ui.notifications.info((DRY_RUN ? "[DRY RUN] " : "") + `Items: ${total} ${DRY_RUN ? "would be stamped" : "stamped"} (${plan.B.length} gear + ${plan.F.length} feat). ${plan.skipHasAA.length} already had AA.${plan.missing.length ? " ⚠ " + plan.missing.length + " not found." : ""} See console (F12).` + (DRY_RUN ? " Set DRY_RUN=false to apply." : " F5 to load. Weapons already animated — repair their ids with fix-aa-ids.macro.js."));
})();
