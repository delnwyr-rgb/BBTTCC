// tikkun-gauntlet-foundry.macro.js — RUN IN-WORLD (GM). CREATES test docs (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
// TIKKUN GAUNTLET · Phase 2 — THE FORGE (faction + operatives + materials factory).
// Sister to raid-gauntlet-foundry. Builds the sandbox the Phase-3 runner drives so
// the live campaign is never touched:
//   • ONE faction "TIKKUNGAUNTLET · Faction" (isFaction flag), primed to the DEFAULT
//     Great-Work thresholds — victory.vp 10 / unity 30, darkness.global 0, a fat
//     opBank (faith/softpower/diplomacy) for ritual + repair, and a CLEAN tikkun
//     block (no integrated/corrupted) so the runner starts from zero.
//   • THREE operative characters LINKED to the faction via flags.bbttcc-factions.factionId
//     (how aggregateCharacterSparksForFaction + repair member-scan find them). The
//     "Ritualist" carries a high soul attribute (deterministic repair rolls) AND the
//     repair materials for every target spark.
//   • THREE TARGET SPARKS — distinct sephiroth, each resolved from the live
//     bbttcc-tikkun.sparks pack so corruption/repair use REAL recipes + method tags.
//     Their aligned/misaligned methods + recipes are written into the manifest so the
//     runner can pick an aligned method (clean gather) or a misaligned one (corrupt).
//   • A MANIFEST (journal flag + a "TIKKUNGAUNTLET · Manifest" journal) the runner reads.
// Idempotent: tears down + rebuilds only its own "TIKKUNGAUNTLET ·" docs. NEVER writes packs.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const PREFIX = "TIKKUNGAUNTLET ·";
  const MOD = "bbttcc-tikkun", FCT = "bbttcc-factions";
  const api = game.bbttcc?.api?.tikkun;
  if (!api) return ui.notifications.error("game.bbttcc.api.tikkun not found — is bbttcc-tikkun active?");
  const log = (...a) => console.log("[tikkun-forge]", ...a);
  const warn = (...a) => console.warn("[tikkun-forge]", ...a);

  // ── 1. Teardown prior gauntlet docs ──
  const oldActors = game.actors.filter(a => a.name?.startsWith(PREFIX)).map(a => a.id);
  if (oldActors.length) { try { await Actor.deleteDocuments(oldActors); log(`removed ${oldActors.length} prior actor(s)`); } catch (e) { warn("actor teardown failed", e); } }
  const oldJournal = game.journal.filter(j => j.name?.startsWith(PREFIX)).map(j => j.id);
  if (oldJournal.length) { try { await JournalEntry.deleteDocuments(oldJournal); } catch (e) { warn("journal teardown failed", e); } }

  // ── 2. Pick 3 target sparks (distinct sephiroth, valid aligned+misaligned+recipe) ──
  const pack = game.packs?.get(`${MOD}.sparks`);
  if (!pack) return ui.notifications.error(`${MOD}.sparks pack not found — run load-sparks-pack first.`);
  const idx = await pack.getIndex({ fields: ["name","system.sephirah","system.kind","system.alignedMethods","system.misalignedMethods","system.repair","flags.bbttcc-tikkun.identifier"] });
  const usableBySeph = new Map();
  for (const e of [...idx].sort((a, b) => String(a.flags?.[MOD]?.identifier ?? "").localeCompare(String(b.flags?.[MOD]?.identifier ?? "")))) {
    const sys = e.system ?? {};
    const seph = String(sys.sephirah ?? "").toLowerCase();
    const al = (sys.alignedMethods || []).map(s => String(s).toLowerCase());
    const mis = (sys.misalignedMethods || []).map(s => String(s).toLowerCase());
    if (!seph || !al.length || !mis.length) continue;
    if (usableBySeph.has(seph)) continue;
    usableBySeph.set(seph, {
      identifier: e.flags?.[MOD]?.identifier ?? e._id,
      name: e.name, sephirah: seph, kind: String(sys.kind ?? "").toLowerCase(),
      aligned: al, misaligned: mis,
      recipe: {
        materialKey: String(sys.repair?.materialKey ?? "").trim(),
        materialAmount: Number(sys.repair?.materialAmount) || 0,
        opPool: String(sys.repair?.opCost?.pool ?? "").toLowerCase(),
        opAmount: Number(sys.repair?.opCost?.amount) || 0,
        ritualDC: Number(sys.repair?.ritualDC) || 15
      }
    });
  }
  const targets = [...usableBySeph.values()].slice(0, 3);
  if (targets.length < 3) return ui.notifications.error(`Need 3 usable sparks of distinct sephiroth; found ${targets.length}. Check the sparks pack.`);

  // ── 3. Create faction, primed to default thresholds ──
  const faction = await Actor.create({ name: `${PREFIX} Faction`, type: "character" });
  await faction.update({
    [`flags.${FCT}.isFaction`]: true,
    [`flags.${FCT}.factionName`]: `${PREFIX} Faction`,
    [`flags.${FCT}.victory`]: { vp: 10, unity: 30, sparks: [] },
    [`flags.${FCT}.darkness`]: { global: 0 },
    // Seed ALL 12 OP pools so repair is gated only by the dice, never by a missing pool.
    [`flags.${FCT}.opBank`]: Object.fromEntries(["violence","intrigue","softpower","diplomacy","economy","nonlethal","faith","logistics","siege","body","soul","culture"].map(p => [p, 30])),
    [`flags.${FCT}.tikkun`]: { integrated: {}, corrupted: {} },
    [`flags.${FCT}.sparks`]: {},
    [`flags.${FCT}.warLogs`]: []
  });
  log("faction", faction.id);

  // ── 4. Create 3 operatives, linked. Ritualist gets high soul + materials. ──
  const memberNames = ["Ritualist", "Pilgrim", "Witness"];
  const members = [];
  for (const nm of memberNames) {
    const m = await Actor.create({ name: `${PREFIX} ${nm}`, type: "character" });
    await m.update({
      [`flags.${FCT}.factionId`]: faction.id,
      [`flags.${FCT}.factionName`]: faction.name,
      "system.attributes.soul.value": 8   // deterministic repair rolls (2d10+8+opNeed beats DC easily)
    });
    members.push(m);
  }
  const ritualist = members[0];

  // ── 5. Mint repair materials on the Ritualist — enough for several attempts each. ──
  const matItems = [];
  for (const tgt of targets) {
    const r = tgt.recipe;
    if (!r.materialKey) continue;
    matItems.push({
      name: r.materialKey, type: "gear",
      system: { slot: "material", tags: ["material", r.materialKey] },
      flags: { fourththing: { rfi: { item: { materialKey: r.materialKey, charges: Math.max(4, r.materialAmount * 4) } } } }
    });
  }
  if (matItems.length) { try { await ritualist.createEmbeddedDocuments("Item", matItems); log(`minted ${matItems.length} material stack(s) on ${ritualist.name}`); } catch (e) { warn("material mint failed", e); } }

  // ── 6. Manifest ──
  const manifest = {
    when: new Date().toISOString(),
    factionId: faction.id,
    factionName: faction.name,
    memberIds: members.map(m => m.id),
    ritualistId: ritualist.id,
    targets,
    thresholds: { sparkThreshold: 3, vpThreshold: 10, unityThreshold: 30, maxDarkness: 3 }
  };
  const journal = await JournalEntry.create({
    name: `${PREFIX} Manifest`,
    pages: [{ name: "Manifest", type: "text", text: { content: `<pre>${foundry.utils.escapeHTML(JSON.stringify(manifest, null, 2))}</pre>` } }]
  });
  await journal.setFlag(MOD, "gauntletManifest", manifest);

  // ── 7. Report ──
  const ms = Math.round(performance.now() - t0);
  log("DONE", manifest);
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#9b7ae8"><div class="ft-roll-header"><span class="ft-roll-name">✦ Tikkun Gauntlet — Forge</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem">Built <b>${faction.name}</b> + ${members.length} operatives in ${ms}ms.</p>
      <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.74rem">
        <li>Targets: ${targets.map(t => `${foundry.utils.escapeHTML(t.name)} <span style="opacity:.6">(${t.sephirah})</span>`).join(", ")}</li>
        <li>Faction primed: vp 10 / unity 30 / darkness 0 / opBank faith·softpower·diplomacy 30 each</li>
        <li>Materials on ${ritualist.name}: ${matItems.map(m => m.name).join(", ") || "(none required)"}</li>
      </ul>
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Now run the Runner (tikkun-gauntlet-runner). Re-run this Forge to reset.</p></div>`
  });
})();
