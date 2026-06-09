// class-tier-a-vfx.js — bespoke JB2A/Sequencer VFX for the 16 Tier-A BBTTCC class features.
//
// Listens for the `fourththing:itemAnimated` hook (emitted by ftPlayAutoAnimation in the
// fourththing system on every animated item use) and plays a HERO-tier Sequencer effect,
// layered on top of the feature's modest base Automated-Animations flag. This is the same
// "emit a hook → a module plays Sequencer" pattern as the Bombard→boulder handoff.
//
// Self-contained: own Sequencer/JB2A existence checks, verified jb2a.* keys with fallback
// chains, and a PIXI ring degrade when JB2A/Sequencer are absent. Plays on the acting client;
// Sequencer broadcasts the effect to all clients automatically (no socket relay needed).
//
// Tuning: edit RECIPES (effect keys / scale / color) and MAP (feature name → family).

const TAG = "[bbttcc-fx:class-tier-a]";

// ---- family recipes. Each lists preferred keys first; first one that exists in the world's
//      Sequencer DB wins. `at` = where to anchor: "source" (caster) or "target" (first target,
//      else caster). `scale` multiplies the grid size. ----
const RECIPES = {
  teleport:    { at:"source", scale:1.6, color:0x66ccff,
                 primary:["jb2a.misty_step.01.blue","jb2a.particle_burst.01.circle.bluepurple","jb2a.magic_signs.circle.02.conjuration.complete.blue"],
                 accent: ["jb2a.misty_step.02.blue","jb2a.explosion.01.blue","jb2a.explosion.01.purple"], accentDelay:350 },
  phase:       { at:"source", scale:1.5, color:0xbfdfff,
                 primary:["jb2a.misty_step.01.blue","jb2a.particle_burst.01.circle.bluepurple"],
                 accent: ["jb2a.particle_burst.01.circle.bluepurple"], accentDelay:200 },
  impact:      { at:"target", scale:1.4, color:0xff8c3c,
                 primary:["jb2a.impact.ground_crack.orange.01","jb2a.impact.ground_crack.white.01","jb2a.impact.001.orange"],
                 accent: ["jb2a.explosion.08.orange","jb2a.explosion.02.orange","jb2a.explosion.01.orange"], accentDelay:120 },
  weather:     { at:"source", scale:2.0, color:0xaad4ff,
                 primary:["jb2a.impact.ground_crack.white.01","jb2a.impact.ground_crack.orange.01","jb2a.particle_burst.01.circle.bluepurple"],
                 accent: ["jb2a.debris.bird","jb2a.explosion.02.orange"], accentDelay:200 },
  bloodstrike: { at:"target", scale:1.3, color:0xaa0022,
                 primary:["jb2a.impact.001.dark_red","jb2a.impact.001.red","jb2a.impact.001.orange"],
                 accent: ["jb2a.explosion.01.purple","jb2a.explosion.02.purple"], accentDelay:100 },
  summon:      { at:"source", scale:1.8, color:0xcc3333,
                 primary:["jb2a.magic_signs.circle.02.conjuration.complete.dark_red","jb2a.magic_signs.circle.02.conjuration.complete.blue","jb2a.magic_signs.circle.02.transmutation.complete.blue"],
                 accent: ["jb2a.particle_burst.01.circle.bluepurple","jb2a.explosion.01.purple"], accentDelay:500 },
  revive:      { at:"target", scale:1.7, color:0xffe27a,
                 primary:["jb2a.magic_signs.circle.02.transmutation.complete.blue","jb2a.magic_signs.circle.02.evocation.complete.blue"],
                 accent: ["jb2a.particle_burst.01.star.yellow","jb2a.explosion.01.yellow"], accentDelay:450 },
  dread:       { at:"source", scale:1.7, color:0x8a2be2,
                 primary:["jb2a.magic_signs.circle.02.necromancy.complete.dark_purple","jb2a.magic_signs.circle.02.necromancy.complete.purple"],
                 accent: ["jb2a.explosion.02.purple","jb2a.explosion.01.purple"], accentDelay:300 },
  rampage:     { at:"source", scale:1.9, color:0xff5522,
                 primary:["jb2a.explosion.08.orange","jb2a.fireball.explosion.orange","jb2a.explosion.02.orange"],
                 accent: ["jb2a.eruption.orange.0","jb2a.explosion.01.orange"], accentDelay:150 },
  reality:     { at:"source", scale:1.8, color:0x66ccff,
                 primary:["jb2a.magic_signs.circle.02.divination.complete.blue","jb2a.magic_signs.circle.02.evocation.complete.blue"],
                 accent: ["jb2a.particle_burst.01.circle.bluepurple"], accentDelay:400 },
  peace_aura:  { at:"source", scale:2.4, color:0xffe27a,   // Accord Mandala / Resonant Truce — ceasefire aura
                 primary:["jb2a.magic_signs.circle.02.enchantment.complete.yellow","jb2a.magic_signs.circle.02.abjuration.complete.yellow","jb2a.magic_signs.circle.02.transmutation.complete.blue"],
                 accent: ["jb2a.particle_burst.01.circle.bluepurple","jb2a.explosion.01.yellow"], accentDelay:450 },
  ward_aura:   { at:"source", scale:2.4, color:0x6fb3ff,   // Unbreakable Front — defensive resolve aura
                 primary:["jb2a.magic_signs.circle.02.abjuration.complete.blue","jb2a.magic_signs.circle.02.abjuration.complete.red","jb2a.magic_signs.circle.02.transmutation.complete.blue"],
                 accent: ["jb2a.particle_burst.01.circle.bluepurple","jb2a.explosion.01.blue"], accentDelay:450 },
  inspire:     { at:"target", scale:1.4, color:0xffe27a,   // Conductor's Beat — single-ally tempo aid
                 primary:["jb2a.particle_burst.01.star.yellow","jb2a.magic_signs.circle.02.enchantment.complete.yellow"],
                 accent: ["jb2a.explosion.01.yellow"], accentDelay:150 },
  bolster:     { at:"target", scale:1.4, color:0x6fb3ff,   // Measured Command / Calm Push / Rally the Quiet — single-ally buff
                 primary:["jb2a.particle_burst.01.circle.bluepurple","jb2a.magic_signs.circle.02.abjuration.complete.blue"],
                 accent: ["jb2a.explosion.01.blue"], accentDelay:150 },
  watch_aura:  { at:"source", scale:2.4, color:0x4fd0d0,   // Sentinel Protocol — awareness / reveal field
                 primary:["jb2a.magic_signs.circle.02.divination.complete.blue","jb2a.magic_signs.circle.02.divination.complete.purple","jb2a.magic_signs.circle.02.evocation.complete.blue"],
                 accent: ["jb2a.particle_burst.01.circle.bluepurple","jb2a.explosion.01.blue"], accentDelay:450 },
};

// ---- exact feature NAME -> family ----
const MAP = {
  "Blue Meridian":                                            "teleport",
  "Fractal Self":                                             "teleport",
  "Shadow Courier — Tier 2: The Crossing":                    "teleport",
  "Shadow Courier — Tier 4: Unfound Route":                   "teleport",
  "Black Stair L17: The Stair That Does Not End (Capstone)":  "teleport",
  "Last Mile L13: The Quiet Voyage":                          "phase",
  "Avalanche L13: The Breach":                                "impact",
  "Avalanche L5: Shockwave Arrival":                          "impact",
  "Cataclyst L9: Decide The Weather":                         "weather",
  "Blood Hymn: Crimson Arc":                                  "bloodstrike",
  "Metaphor Apostle: Living Allegory":                        "summon",
  "Spark Resurrection":                                       "revive",
  "Void Edge: Dread Cut":                                     "dread",
  "Metaphor Apostle: Make It True":                           "reality",
  "Metaphor Apostle: Shared Dream":                           "reality",
  "Blood Hymn: Final Crescendo":                              "rampage",
  // Harmony Marshal Mandate techniques (wired 2026-06-08, fix-on-touch)
  "Accord Mandala":                                           "peace_aura",
  "Resonant Truce":                                           "peace_aura",
  "Unbreakable Front":                                        "ward_aura",
  "Conductor's Beat":                                         "inspire",
  "Measured Command":                                         "bolster",
  "Calm Push":                                                "bolster",
  "Rally the Quiet (BBTTCC)":                                 "bolster",
  "Sentinel Protocol":                                        "watch_aura",
  // Wyrdlens Adept — Refraction techniques (wired 2026-06-08, fix-on-touch)
  "Convergence Horizon":                                      "watch_aura",
  "Covenant Prism":                                           "ward_aura",
  "Truth Horizon":                                            "watch_aura",
  "Soft Focus":                                               "peace_aura",
  "Clear the Signal":                                         "bolster",
  "Split Beam":                                               "bolster",
  "Gentle Pivot":                                             "bolster",
  "Mercy Refraction (BBTTCC)":                                "bolster",
  // Soul-Smith — Forge techniques (wired 2026-06-08, fix-on-touch)
  "Banner of the Final Push":                                 "peace_aura",
  "Sanctuary Engine":                                         "ward_aura",
  "Standard of Will (BBTTCC)":                                "peace_aura",
  "Triumph Weave":                                            "peace_aura",
  "Forge Blessing":                                           "inspire",
  "Rally Stitch":                                             "bolster",
  "Luminous Intercession":                                    "inspire",
  // Dreamwalker — Sapphire/Quiet/Thousand (wired 2026-06-08; Blue Meridian already maps to teleport)
  "Solar Stillpoint":                                         "peace_aura",
  "Lull the Riot":                                            "peace_aura",
  "Thousandfold Echo":                                        "peace_aura",
  "Persona Cache (BBTTCC)":                                   "peace_aura",
  "Mirror Read":                                              "inspire",
  "Somnolent Peace (BBTTCC)":                                 "bolster",
  // Cross-class shared feats (wired 2026-06-08, fix-on-touch)
  "Coordinated Advance":                                      "bolster",
  "Emissary of the Great Accord":                             "peace_aura",
  "Initiate of the Great Work":                               "peace_aura",
  "Lattice Profiler":                                         "watch_aura",
  "Lucid Step":                                               "ward_aura",
  "Negotiated Advantage":                                     "bolster",
  "Probability Threading":                                    "inspire",
  "Shared Burden Harness":                                    "bolster",
  "Shared Dreamwork":                                         "bolster",
  "Unbroken Line":                                            "bolster",
  // Single-class one-offs (2026-06-08; Final Crescendo→rampage & Living Allegory→summon already mapped)
  "Pulse of the Forge":                                       "peace_aura",
  "Archivist: Akashic Access":                                "watch_aura",
  "Stillheart: Emotional Lock":                               "ward_aura",
  "Auditor: Forensic Audit":                                  "bolster",
  "Cosmic Linguist: Initiation 6 — Translation":              "peace_aura",
};

// ---- self-contained Sequencer helpers ----
const seqReady = () => { try { return !!globalThis.Sequence && !!game.modules?.get?.("sequencer")?.active; } catch { return false; } };
const dbExists = (key) => {
  try {
    const db = globalThis.Sequencer?.Database; if (!db || !key) return false;
    if (typeof db.entryExists === "function") return !!db.entryExists(String(key));
    if (typeof db.getEntry === "function") { try { return !!db.getEntry(String(key), { softFail:true }); } catch { return false; } }
    return true;
  } catch { return false; }
};
const firstKey = (arr) => (Array.isArray(arr) ? arr.find(dbExists) : (dbExists(arr) ? arr : null)) || null;

const resolvePos = (t) => {
  if (!t) return null;
  if (t.center?.x != null) return { x:Number(t.center.x), y:Number(t.center.y) };
  if (t.object?.center?.x != null) return { x:Number(t.object.center.x), y:Number(t.object.center.y) };
  const doc = t.document || t;
  if (doc?.x != null) { const w = Number(doc.width ?? 1) * Number(canvas?.grid?.size || 100); const h = Number(doc.height ?? 1) * Number(canvas?.grid?.size || 100); return { x:Number(doc.x) + w/2, y:Number(doc.y) + h/2 }; }
  return null;
};

// PIXI degrade — an expanding ring, so something still reads on canvas without JB2A.
function pixiPulse(pos, color = 0x66ccff) {
  try {
    if (!canvas?.stage || !globalThis.PIXI || !pos) return;
    const ring = new PIXI.Graphics(); ring.position.set(pos.x, pos.y); canvas.stage.addChild(ring);
    const gs = Number(canvas?.grid?.size || 100), start = performance.now(), life = 850, base = gs * 0.9;
    const ticker = canvas.app?.ticker; if (!ticker) { ring.destroy(); return; }
    const step = () => { const t = Math.min(1, (performance.now() - start) / life); ring.clear(); ring.lineStyle(4, color, Math.max(0, 0.9 * (1 - t))); ring.drawCircle(0, 0, base + base * 0.9 * t); if (t >= 1) { ticker.remove(step); ring.destroy(); } };
    ticker.add(step);
  } catch (_e) {}
}

function playRecipe(recipe, sourceToken, targets) {
  const target = (recipe.at === "target" && targets?.length) ? targets[0] : sourceToken;
  const loc = target || sourceToken;
  const pos = resolvePos(loc);
  if (!seqReady()) { pixiPulse(pos, recipe.color); return; }
  const primary = firstKey(recipe.primary);
  const accent  = firstKey(recipe.accent);
  if (!primary && !accent) { pixiPulse(pos, recipe.color); return; }
  try {
    const gs = Number(canvas?.grid?.size || 100);
    const anchor = loc || pos; // Sequencer accepts a token/doc or a {x,y}
    const seq = new globalThis.Sequence();
    if (primary) seq.effect().file(primary).atLocation(anchor).size(gs * (recipe.scale || 1.5)).fadeIn(200).fadeOut(500).zIndex(2);
    if (accent)  seq.effect().file(accent).atLocation(anchor).delay(recipe.accentDelay ?? 200).size(gs * (recipe.scale || 1.5) * 0.9).fadeOut(400).zIndex(3);
    seq.play();
  } catch (e) { console.warn(TAG, "sequence failed", e); pixiPulse(pos, recipe.color); }
}

Hooks.on("fourththing:itemAnimated", ({ item, sourceToken, targets } = {}) => {
  try {
    const fam = item?.name ? MAP[item.name] : null;
    if (!fam) return;
    const recipe = RECIPES[fam];
    if (!recipe) return;
    playRecipe(recipe, sourceToken, targets);
  } catch (e) { console.warn(TAG, "handler error", e); }
});

console.log(TAG, `loaded — ${Object.keys(MAP).length} Tier-A class features wired to bespoke Sequencer recipes.`);
