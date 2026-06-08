// travel-gauntlet-foundry.macro.js — RUN IN-WORLD (GM). CREATES test docs (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL GAUNTLET · Phase 2 — THE FORGE (real-map clone + goodie seeder).
// Sister to raid/tikkun gauntlet forges. CLONES the live "Bad Eden, Starting Map"
// (leaving the original untouched), then seeds test conditions onto real hexes so the
// Phase-3 runner drives travel across a map that ACTUALLY reads terrain (synthetic
// Drawings tripped a canvas-readiness race; real hexes on a rendered clone don't):
//   • Clone scene "TRAVELGAUNTLET · Bad Eden".
//   • Role-tag real hexes by terrain: home/plains(T1)/forest(T2)/mountains(T3)/ocean(T4)/swamp(T3).
//   • LEY GATE pair: gateSrc.leylines.gate {enabled, linkHexUuid→gateDst, strength 0.5, minFactionTier T1}.
//   • radiated (conditions:["Radiated"] + mods.radiation:2) + contaminated (["Contaminated"]) → RP accrual.
//   • weather hex PRE-SEEDED { key:"dustfront", remainingTurns:2 } → no-reroll probe.
//   • ONE faction "TRAVELGAUNTLET · Faction" (isFaction, tier 4, darkness 0, fat opBank), owns gateSrc.
//   • A MANIFEST (journal flag) with role→{drawingId, terrain}.
// Idempotent: tears down + rebuilds only its own "TRAVELGAUNTLET ·" docs. NEVER edits the source map.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const PREFIX = "TRAVELGAUNTLET ·";
  const TERR = "bbttcc-territory", FCT = "bbttcc-factions";
  const log = (...a) => console.log("[travel-forge]", ...a);
  const warn = (...a) => console.warn("[travel-forge]", ...a);

  // ── 1. Teardown prior gauntlet docs (NEVER the source map) ──
  for (const [coll, cls] of [[game.scenes, Scene], [game.actors, Actor], [game.journal, JournalEntry]]) {
    const ids = coll.filter(d => d.name?.startsWith(PREFIX)).map(d => d.id);
    if (ids.length) { try { await cls.deleteDocuments(ids); log(`removed ${ids.length} ${cls.name}`); } catch (e) { warn("teardown failed", cls.name, e); } }
  }

  // ── 2. Clone the real Bad Eden map (create shell, then drawings EXPLICITLY) ──
  // Scene.create() with embedded `drawings` in the payload does NOT reliably create
  // them on all builds (we saw a 0-drawing clone). Build the shell, then create the
  // embedded Drawings via createEmbeddedDocuments so scene.drawings is populated.
  const src = game.scenes.find(s => /bad eden/i.test(s.name) && !s.name.startsWith(PREFIX));
  if (!src) return ui.notifications.error('Source scene not found — import "Bad Eden, Starting Map" into the world first.');
  const data = src.toObject();
  const drawingsData = (data.drawings || []).map(x => { const c = foundry.utils.deepClone(x); delete c._id; return c; });
  delete data._id; delete data.drawings;
  data.name = `${PREFIX} Bad Eden`; data.active = false; data.navigation = false;
  const scene = await Scene.create(data);
  if (drawingsData.length) await scene.createEmbeddedDocuments("Drawing", drawingsData);
  log("cloned scene", scene.id, "drawings:", scene.drawings.size, "/ source", drawingsData.length);
  if (!scene.drawings.size) return ui.notifications.error(`Clone has 0 drawings (source had ${drawingsData.length}) — aborting; re-run to clean up.`);

  // ── 3. Faction (funded, tier 4) ──
  const OP_KEYS = ["violence","intrigue","softpower","diplomacy","economy","nonlethal","faith","logistics","siege","body","soul","culture"];
  const faction = await Actor.create({ name: `${PREFIX} Faction`, type: "character" });
  await faction.update({
    [`flags.${FCT}.isFaction`]: true,
    [`flags.${FCT}.factionName`]: `${PREFIX} Faction`,
    [`flags.${FCT}.tier`]: 4,
    [`flags.${FCT}.darkness`]: { global: 0 },
    [`flags.${FCT}.opBank`]: Object.fromEntries(OP_KEYS.map(k => [k, 9999]))
  });

  // Roster member carrying a WEATHER-mitigation ability (Storm Wardens — Weather Veto).
  // Registry match is by item.system.identifier vs CHAR_OPT_ABILITIES — item type is irrelevant.
  const warden = await Actor.create({ name: `${PREFIX} Storm Warden`, type: "character" });
  await warden.update({ [`flags.${FCT}.factionId`]: faction.id, [`flags.${FCT}.factionName`]: faction.name });
  await warden.createEmbeddedDocuments("Item", [{ name: "Storm Wardens — Weather Veto", type: "class", system: { identifier: "crew-storm-wardens-t2" } }]);

  // ── 4. Pick distinct real hexes by terrain ──
  const used = new Set();
  const hexesOf = (key) => scene.drawings.filter(d => {
    const tf = d.flags?.[TERR]; return tf?.isHex && String(tf?.terrain?.key || "").toLowerCase() === key;
  });
  // Diagnostic: terrain distribution on the clone (helps if a role comes up short).
  const dist = {};
  for (const d of scene.drawings) { const tf = d.flags?.[TERR]; if (tf?.isHex) { const k = String(tf?.terrain?.key || "(none)").toLowerCase(); dist[k] = (dist[k] || 0) + 1; } }
  log("terrain distribution:", dist);
  const take = (key, n = 1) => {
    const pool = hexesOf(key).filter(d => !used.has(d.id));
    const got = pool.slice(0, n); got.forEach(d => used.add(d.id));
    return got;
  };
  const [home, plains2, gateDst, gateSrc, dev6] = take("plains", 5);
  const [forest] = take("forest");
  const [mountains] = take("mountains");
  const [ocean] = take("ocean");
  const [swamp] = take("swamp");
  const [radiated, contaminated, weather] = take("river", 3);   // plenty of river hexes for env roles

  const roleDocs = { home, plains: plains2, forest, mountains, ocean, swamp, gateSrc, gateDst, dev6, radiated, contaminated, weather };
  const missing = Object.entries(roleDocs).filter(([, d]) => !d).map(([k]) => k);
  if (missing.length) return ui.notifications.error(`Map lacks hexes for roles: ${missing.join(", ")} — needs plains×5, forest, mountains, ocean, swamp, river×3.`);

  // ── 5. Seed goodies onto the chosen hexes ──
  await gateSrc.update({
    [`flags.${TERR}.leylines.gate`]: { enabled: true, linkHexUuid: gateDst.uuid, strength: 0.5, minFactionTier: "T1", locked: false },
    [`flags.${TERR}.factionId`]: faction.id
  });
  await radiated.update({ [`flags.${TERR}.conditions`]: ["Radiated"], [`flags.${TERR}.mods.radiation`]: 2 });
  await contaminated.update({ [`flags.${TERR}.conditions`]: ["Contaminated"] });
  await weather.update({ [`flags.${TERR}.weather`]: { key: "dustfront", label: "Dustfront", remainingTurns: 2, ts: 0 } });
  // Dev-6 free passage: fully-developed hex OWNED by our faction → cost 0 for the owner.
  await dev6.update({ [`flags.${TERR}.development`]: { stage: 6 }, [`flags.${TERR}.factionId`]: faction.id });

  // ── 6. Manifest ──
  // Read flags directly — getFlag(scope) with no key returns undefined.
  const role = (d) => { const tf = d.flags?.[TERR] || {}; return { id: d.id, uuid: d.uuid, terrain: String(tf.terrain?.key || "").toLowerCase(), name: tf.name || d.text }; };
  const manifest = {
    when: new Date().toISOString(),
    sceneId: scene.id,
    factionId: faction.id,
    wardenId: warden.id,
    weatherMitigationAbility: "crew-storm-wardens-t2",
    roles: Object.fromEntries(Object.entries(roleDocs).map(([k, d]) => [k, role(d)])),
    gateStrength: 0.5,
    radiation: { radiated: 3, contaminated: 1 }, // Radiated +1 + mods 2 = 3; Contaminated +1
    weatherSeed: "dustfront"
  };
  const journal = await JournalEntry.create({
    name: `${PREFIX} Manifest`,
    pages: [{ name: "Manifest", type: "text", text: { content: `<pre>${foundry.utils.escapeHTML(JSON.stringify(manifest, null, 2))}</pre>` } }]
  });
  await journal.setFlag(TERR, "gauntletManifest", manifest);

  // ── 7. Report ──
  const ms = Math.round(performance.now() - t0);
  log("DONE", manifest);
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#7ab8e8"><div class="ft-roll-header"><span class="ft-roll-name">🛤️ Travel Gauntlet — Forge</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem">Cloned <b>${src.name}</b> → <b>${scene.name}</b> + funded T4 faction in ${ms}ms.</p>
      <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.74rem">
        <li>Terrain roles: ${["plains","forest","mountains","ocean","swamp"].map(k => `${k}=<i>${manifest.roles[k].name}</i>`).join(", ")}</li>
        <li>Ley Gate: <i>${manifest.roles.gateSrc.name}</i>→<i>${manifest.roles.gateDst.name}</i> (str 0.5) · Env on river hexes</li>
      </ul>
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Now run the Runner. Re-run this Forge to reset (source map untouched).</p></div>`
  });
})();
