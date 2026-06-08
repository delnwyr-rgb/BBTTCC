// raid-gauntlet-foundry.macro.js — RUN IN-WORLD (GM). CREATES test docs (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
// RAID GAUNTLET · Phase 2 — THE FORGE (faction + scenario factory).
// Sister to steward-gauntlet-foundry. Builds the fireable surface the Phase-3 runner drives:
//   • ONE maxed ATTACKER faction (T4 + all crews + all occult + a roster carrying every class
//     item) so it can use EVERY maneuver — crew/occult/class-granted alike. The raid TYPE comes
//     from which API the runner calls (infiltration/courtly/violence/siege), not the faction, so
//     a single attacker/defender pair serves all four.
//   • ONE DEFENDER faction (T3, defensive crew/occult subset) for defender-access maneuvers.
//   • 4 TIER-PROBE factions (T1–T4, no grants) so the runner can assert tier GATING.
//   • A "Class Bearer" hero carrying all 9 class items (bare type:"class") + generic hero tokens,
//     each LINKED to the attacker via flags.bbttcc-factions.factionId (how _factionRosterClasses
//     detects membership — NOT championRoster). Optionally also imports "GAUNTLET ·" stewards
//     from the bbttcc-master-content.npcs compendium if reachable (bonus realism; READ-ONLY).
//   • An arena scene (hero tokens + HOSTILE sponge + FRIENDLY ally) and a seeded ACTIVE siege.
//   • A MANIFEST (scene flag + journal) the runner reads.
// Idempotent: tears down + rebuilds only its own "RAIDGAUNTLET ·" docs. NEVER writes LevelDB packs.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const PREFIX = "RAIDGAUNTLET ·";
  const ARENA  = `${PREFIX} Arena`;
  const MANIFEST_JOURNAL = `${PREFIX} Manifest`;
  const FCT = "bbttcc-factions";
  const raid  = game.bbttcc?.api?.raid;
  const siege = game.bbttcc?.api?.siege;
  if (!raid)  return ui.notifications.error("game.bbttcc.api.raid not found — is bbttcc-raid active?");
  if (!siege) ui.notifications.warn("game.bbttcc.api.siege not found — siege section will be skipped.");
  const log = (...a) => console.log("[raid-gauntlet:forge]", ...a);
  const warn = (...a) => console.warn("[raid-gauntlet:forge]", ...a);
  const lc = (s) => String(s ?? "").toLowerCase();
  const normName = (s) => lc(s).replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
  const report = { attackerId: null, leadId: null, supporterIds: [], defenderId: null, relationsSet: false,
    tierProbes: {}, heroIds: [], stewardIds: [], classBearerId: null, sceneId: null, hexUuid: null,
    wallActorId: null, targetTokenId: null, allyTokenId: null, heroTokenIds: [], scenarios: {}, grants: {}, errors: [] };

  // ── Grant universe (canonical names straight from the live grant tables) ──
  const grants = raid.crewGrants ?? {};
  const ALL_CREWS  = Object.keys(grants.crewMap ?? {});
  const ALL_OCCULT = Object.keys(grants.occultMap ?? {});
  const ALL_CLASSES= Object.keys(grants.classMap ?? {});
  report.grants = { crews: ALL_CREWS, occult: ALL_OCCULT, classes: ALL_CLASSES };
  log(`grant universe: ${ALL_CREWS.length} crews / ${ALL_OCCULT.length} occult / ${ALL_CLASSES.length} classes`);

  // ── 1. TEARDOWN own docs (never touch imported GAUNTLET stewards) ──
  const ownActors = game.actors.filter(a => a.name?.startsWith(PREFIX));
  if (ownActors.length) { await Actor.deleteDocuments(ownActors.map(a => a.id)); log(`deleted ${ownActors.length} prior ${PREFIX} actors`); }
  const ownScenes = game.scenes.filter(s => s.name === ARENA);
  if (ownScenes.length) await Scene.deleteDocuments(ownScenes.map(s => s.id));
  const ownJournals = game.journal.filter(j => j.name === MANIFEST_JOURNAL);
  if (ownJournals.length) await JournalEntry.deleteDocuments(ownJournals.map(j => j.id));

  // ── 2. Faction factory (seeds a generous OP bank so supporters can self-commit) ──
  const SEED_BANK = { violence: 2000, logistics: 2000, economy: 2000, softPower: 2000, diplomacy: 2000, faith: 2000, intrigue: 2000 };
  async function makeFaction(name, { tier, crews = [], occult = [] }) {
    const a = await Actor.create({ name, type: "character" });
    await a.update({
      "flags.bbttcc-factions.isFaction": true,
      "flags.bbttcc-factions.tier": tier,
      "flags.bbttcc-factions.opBank": foundry.utils.deepClone(SEED_BANK),
      "flags.fourththing.echoAssets": {
        activeCrew: crews.slice(), activeOccult: occult.slice(), reserveCrew: [], reserveOccult: [],
        crewSlots: 99, occultSlots: 99, updatedTs: Date.now()
      }
    });
    return a;
  }

  // Coalition: a LEAD attacker (maxed) + TWO supporters (distinct crew/occult so the coalition is
  // varied) vs the DEFENDER. Supporters must be Friendly+ with the lead (joinSiege gate) and carry
  // their own OP bank (every faction pays its own way — feedback_siege_discrete_costs_realism).
  const DEF_CREWS  = ["Survivors/Militia", "Ashbound Survivors", "Peacekeeper Corps", "Storm Wardens"];
  const DEF_OCCULT = ["Rosicrucian", "Exorcist/Purifier", "Prophet/Oracle"];
  const SUP1_CREWS = ["Covert Ops Cell", "Gridbreakers", "Cultural Ambassadors"];
  const SUP1_OCCULT= ["Tarot Mage", "Gnostic"];
  const SUP2_CREWS = ["Ironbound Ascendants", "Verdant Stalkers", "Diplomatic Envoys"];
  const SUP2_OCCULT= ["Kabbalist", "Alchemist"];
  let attacker = null, sup1 = null, sup2 = null, defender = null;
  try {
    attacker = await makeFaction(`${PREFIX} Lead Attacker`, { tier: 4, crews: ALL_CREWS, occult: ALL_OCCULT });
    sup1     = await makeFaction(`${PREFIX} Supporter Alpha`, { tier: 3, crews: SUP1_CREWS, occult: SUP1_OCCULT });
    sup2     = await makeFaction(`${PREFIX} Supporter Beta`,  { tier: 3, crews: SUP2_CREWS, occult: SUP2_OCCULT });
    defender = await makeFaction(`${PREFIX} Defender`, { tier: 3, crews: DEF_CREWS, occult: DEF_OCCULT });
    report.attackerId = attacker.id; report.leadId = attacker.id;
    report.supporterIds = [sup1.id, sup2.id]; report.defenderId = defender.id;
    // Relations: supporters Allied with the lead (joinSiege needs ≥ Friendly), set both directions.
    const rel = game.bbttcc?.api?.factions?.relations;
    if (rel?.set) {
      for (const s of [sup1, sup2]) { await rel.set(s, attacker, "allied", { reason: "raid-gauntlet coalition" }); await rel.set(attacker, s, "allied", { reason: "raid-gauntlet coalition" }); }
      report.relationsSet = true;
    } else warn("relations API missing — supporters may fail the joinSiege Friendly+ gate");
    log(`coalition: lead=${attacker.name} + [${sup1.name}, ${sup2.name}] vs ${defender.name} · relations=${report.relationsSet}`);
  } catch (e) { warn("faction forge failed", e); report.errors.push(`faction:${e.message}`); }

  for (const tier of [1, 2, 3, 4]) {
    try { const p = await makeFaction(`${PREFIX} Tier Probe T${tier}`, { tier, crews: [], occult: [] }); report.tierProbes[tier] = p.id; }
    catch (e) { warn(`tier probe T${tier} failed`, e); }
  }

  // ── 3. Heroes: Class Bearer (all 9 class items) + optional GAUNTLET stewards, linked to attacker ──
  const heroes = [];
  if (attacker) {
    // 3a. Guaranteed class-grant coverage: one bearer carrying every class as a bare type:"class" item.
    try {
      const bearer = await Actor.create({ name: `${PREFIX} Class Bearer`, type: "character" });
      const classItems = ALL_CLASSES.map(c => ({ name: c, type: "class", system: { identifier: normName(c) } }));
      if (classItems.length) await bearer.createEmbeddedDocuments("Item", classItems);
      report.classBearerId = bearer.id; heroes.push(bearer);
      log(`class bearer minted with ${classItems.length} class items`);
    } catch (e) { warn("class bearer failed", e); report.errors.push(`bearer:${e.message}`); }

    // 3b. Bonus realism: import GAUNTLET stewards from the npcs compendium if available (READ-ONLY).
    try {
      let stewards = game.actors.filter(a => a.name?.startsWith("GAUNTLET ·"));
      if (!stewards.length) {
        const npcPack = game.packs.get("bbttcc-master-content.npcs")
          ?? game.packs.find(p => p.metadata?.label === "BBTTCC NPC Pack v1" || lc(p.metadata?.name) === "npcs");
        if (npcPack) {
          const docs = await npcPack.getDocuments();
          const toImport = docs.filter(d => d.name?.startsWith("GAUNTLET ·"));
          log(`importing ${toImport.length} GAUNTLET stewards from ${npcPack.collection} …`);
          for (const d of toImport) { try { await game.actors.importFromCompendium(npcPack, d.id); } catch (e) { warn(`import ${d.name} failed`, e); } }
          stewards = game.actors.filter(a => a.name?.startsWith("GAUNTLET ·"));
        }
      }
      report.stewardIds = stewards.map(a => a.id);
      heroes.push(...stewards);
      log(stewards.length ? `using ${stewards.length} GAUNTLET stewards (bonus)` : "no GAUNTLET stewards available — class bearer covers class grants");
    } catch (e) { warn("steward import failed", e); report.errors.push(`stewards:${e.message}`); }

    // 3c. Link every hero to the attacker so _factionRosterClasses sees the classes.
    for (const h of heroes) { try { await h.update({ [`flags.${FCT}.factionId`]: attacker.id, [`flags.${FCT}.factionName`]: attacker.name }); } catch (e) { warn(`link ${h.name} failed`, e); } }
    report.heroIds = heroes.map(h => h.id);
    try { await attacker.setFlag(FCT, "championRoster", heroes.map(h => h.id)); } catch (_e) {}
    // Verify class grants now resolve.
    try {
      const seen = grants.rosterClasses ? grants.rosterClasses(attacker) : [];
      log(`attacker roster classes detected: ${Array.isArray(seen) ? seen.length : "?"} (${(seen || []).join(", ")})`);
      report.rosterClassesDetected = seen;
    } catch (_e) {}
  }

  // ── 4. Arena scene ──
  let scene = null;
  try {
    scene = await Scene.create({ name: ARENA, width: 3000, height: 2000, padding: 0, grid: { type: 1, size: 100 }, backgroundColor: "#1b1b22" });
    report.sceneId = scene.id; log(`arena scene: ${scene.id}`);
  } catch (e) { warn("scene create failed", e); report.errors.push(`scene:${e.message}`); }

  // ── 5. Sponge + ally + hero tokens ──
  async function placeToken(actor, x, y, disposition) {
    if (!scene || !actor) return null;
    const td = actor.prototypeToken.toObject();
    Object.assign(td, { x, y, disposition, actorId: actor.id, actorLink: false, name: actor.name });
    const [created] = await scene.createEmbeddedDocuments("Token", [td]);
    return created;
  }
  if (scene) {
    try {
      const sponge = await Actor.create({ name: `${PREFIX} Sponge (HOSTILE)`, type: "npc" });
      const ally   = await Actor.create({ name: `${PREFIX} Ally (FRIENDLY)`, type: "npc" });
      report.spongeActorId = sponge.id; report.allyActorId = ally.id;
      const D = CONST.TOKEN_DISPOSITIONS;
      report.targetTokenId = (await placeToken(sponge, 1500, 600, D.HOSTILE))?.id ?? null;
      report.allyTokenId   = (await placeToken(ally,   1200, 1200, D.FRIENDLY))?.id ?? null;
      let hx = 800;
      for (const h of heroes.slice(0, 4)) { const ht = await placeToken(h, hx, 1400, D.FRIENDLY); if (ht) report.heroTokenIds.push(ht.id); hx += 220; }
      log(`tokens: target=${report.targetTokenId} ally=${report.allyTokenId} heroes=${report.heroTokenIds.length}`);
    } catch (e) { warn("token placement failed", e); report.errors.push(`tokens:${e.message}`); }
  }

  // ── 6. Siege seed: wall structure + hex drawing + ACTIVE siege state ──
  if (scene && siege?.makeSiegeState && siege?.setState) {
    try {
      const wall = await Actor.create({ name: `${PREFIX} Curtain Wall`, type: "rig" });
      report.wallActorId = wall.id;
      const [hex] = await scene.createEmbeddedDocuments("Drawing", [{
        shape: { type: "r", width: 300, height: 300 }, x: 2200, y: 800,
        fillType: 1, fillColor: "#7a2222", fillAlpha: 0.3, strokeColor: "#cc4444",
        flags: { "bbttcc-territory": {
          name: `${PREFIX} Besieged Hex`, factionId: report.defenderId,
          modifiers: ["Fortified"], terrain: { key: "plains" },
          holdings: { rigIds: [wall.id], bossIds: [] }, structureActorIds: [wall.id]
        } }
      }]);
      report.hexUuid = hex.uuid;
      const state = siege.makeSiegeState({
        attackerFactionId: report.attackerId, supportingFactionIds: report.supporterIds, startedTurn: 0, sizeProfile: "standard",
        layers: [{ structureActorId: wall.id, sceneId: scene.id, transitionRule: "threshold", thresholdPct: 50 }],
        buffer: { violence: 200, logistics: 200, economy: 100, softPower: 100, diplomacy: 100, faith: 100, intrigue: 100 },
        bufferStartingTotal: 900, attackerChampions: [], defenderChampions: [], intent: "sack"
      });
      // Seed coalition participants the way handleBeginSiege would: lead joined, supporters INVITED
      // (the runner then exercises joinSiege so each supporter self-commits its own OP + muster).
      state.defenderFactionId = report.defenderId;
      state.participants = { [report.attackerId]: { factionId: report.attackerId, role: "lead", joined: true, invited: true, contribution: {}, joinedTurn: 0 } };
      for (const sid of report.supporterIds) state.participants[sid] = { factionId: sid, role: "supporter", joined: false, invited: true, contribution: {}, joinedTurn: null };
      state.attackerMuster = 120; state.defenderMuster = 90; state.defenderAnytimeBudget = 30; state.renewalPool = 20;
      await siege.setState(hex.uuid, state);
      log(`siege seeded ACTIVE on ${hex.uuid} (lead + ${report.supporterIds.length} invited supporters)`);
    } catch (e) { warn("siege seed failed", e); report.errors.push(`siege:${e.message}`); }
  }

  // ── 7. Smoke-start scene scenarios (verify create APIs; state ephemeral) ──
  try {
    if (report.attackerId && report.defenderId && typeof raid.infiltration === "function") {
      const sc = await raid.infiltration({ attackerId: report.attackerId, defenderId: report.defenderId, alarmMax: 6, progressMax: 6, label: `${PREFIX} Infiltration` });
      report.scenarios.infiltration = sc?.getState ? "ok" : "created";
    }
  } catch (e) { warn("infiltration smoke-start failed", e); report.errors.push(`infil:${e.message}`); }
  try {
    if (report.attackerId && report.defenderId && typeof raid.courtly === "function") {
      const sc = await raid.courtly({ attackerId: report.attackerId, defenderId: report.defenderId, atkInitDip: 30, atkInitSoft: 20, defInitDip: 25, defInitSoft: 20, label: `${PREFIX} Courtly` });
      report.scenarios.social = sc?.getState ? "ok" : "created";
    }
  } catch (e) { warn("courtly smoke-start failed", e); report.errors.push(`courtly:${e.message}`); }
  report.scenarios.violence = "no-headless-api (runner fires via maneuver path)";
  report.scenarios.siege = report.hexUuid ? "seeded-active" : "not-seeded";

  // ── 8. Manifest (scene flag + journal) ──
  report.builtAt = new Date().toISOString();
  if (scene) { try { await scene.setFlag("bbttcc-raid", "gauntletManifest", report); } catch (e) { warn("scene manifest flag failed", e); } }
  try {
    await JournalEntry.create({ name: MANIFEST_JOURNAL, flags: { "bbttcc-raid": { gauntletManifest: report } },
      pages: [{ name: "Manifest", type: "text", text: { content: `<pre>${JSON.stringify(report, null, 2)}</pre>` } }] });
  } catch (e) { warn("manifest journal failed", e); }

  // ── Report ──
  console.log(`\n══════ RAID GAUNTLET · FORGE ══════`);
  console.log(`lead=${report.attackerId} + ${report.supporterIds.length} supporters (relations=${report.relationsSet}) vs defender=${report.defenderId} · ${Object.keys(report.tierProbes).length} tier probes · ${report.heroIds.length} heroes (${report.stewardIds.length} stewards) · scene ${report.sceneId} · hex ${report.hexUuid} · ${Math.round(performance.now() - t0)}ms`);
  console.log("scenarios:", report.scenarios);
  console.log("roster classes detected:", report.rosterClassesDetected);
  if (report.errors.length) console.warn("ERRORS:", report.errors);
  console.log("MANIFEST:", report);
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#7ab8e8">
      <div class="ft-roll-header"><span class="ft-roll-name">⚔ Raid Gauntlet — The Forge</span></div>
      <p style="margin:0.2rem 0;font-size:0.78rem">Lead + <b>${report.supporterIds.length}</b> supporters (relations ${report.relationsSet ? "✓" : "✗"}) vs defender · ${Object.keys(report.tierProbes).length} tier probes · ${report.heroIds.length} heroes · siege ${report.scenarios.siege}.</p>
      <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.76rem">
        <li>Scene: <b>${ARENA}</b></li>
        <li>Coalition: lead + ${report.supporterIds.length} supporters; siege participants seeded (supporters invited → runner fires joinSiege)</li>
        <li>Roster classes: <b>${(report.rosterClassesDetected || []).length}</b> / ${ALL_CLASSES.length}</li>
        <li>Scenarios: infil ${report.scenarios.infiltration ?? "—"} · social ${report.scenarios.social ?? "—"} · siege ${report.scenarios.siege}</li>
        ${report.errors.length ? `<li style="color:#c66">errors: ${report.errors.length} (see console)</li>` : ""}
      </ul>
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Manifest on the scene flag + "${MANIFEST_JOURNAL}" journal. Run the Phase-3 runner next.</p>
    </div>`
  });
})();
