/*
 * road-tables-tier-cleanup-2026-11-13.macro.js — "Tier up - remove, keep on appropriate tier tables; Add the Ash wolves!"
 * (Dave 2026-11-13, answering open question 2 of the road-encounter expansion) + two beat bugs found in that review.
 *
 * THE RULE (systems/fourththing/threat-chassis.js ENCOUNTER.rate): a foe one tier UP is off the chart — never use.
 * Two ways a road row breaks it:
 *   A. TABLE tier-up — the row's foes are above the table's own tier (travel_<terrain>_t<N>). Under the alpha cut
 *      (bbttcc-travel hex-travel.js _alphaTierCap: every leg rolls tier 1) every t1 row is what an Act-2 party draws.
 *      → the row is REMOVED from the lower table and a row is ensured on the foe's OWN tier table for the same terrain
 *        (travel_generic_t<N> for a generic row or a tier with no terrain tables, with conditions.terrains carried).
 *   B. PARTY tier-up — the row sits on a table at/above its foes' tier but opens (conditions.phaseGte) before the party
 *      reaches that tier (storyPhase 2 ≈ L2 · 3 ≈ L4 · 4 ≈ L6 = Tier II · Part Two ≈ L11+ = Tier III). Leg tier comes
 *      from hex DANGER, not party level, so once the cut lifts a dangerous hex would deal T3 to an L2 party.
 *      → phaseGte is raised to the foe tier's phase (same PHASE ladder as expand-road-encounters-2026-11-13).
 *   KEPT: the deliberate alphaMirror:true T2 rows on t1 tables at phaseGte >= 4 (party L6 = Tier II — not a tier up for
 *   the party; they exist only because the cut pins every leg to t1). With MIRROR_T2 on, a removed legacy T2 row (Wastes
 *   Stalker, Hexknight) gets the same kind of mirror on its t1 table, so it stays drawable from Act 4 like the new packets.
 *
 * A row's foe tier: FOE_TIER below for legacy beats whose foes are pre-placed / nameless (Shambler, Wraith, Maarg,
 * Raze Team, Apex, Bandits), else the highest bestiary tier among the beat's encounter.actorName + encounter.also (read
 * from the bbttcc-master-content.npcs index at run time; a FOE_TIER entry that disagrees with the pack is reported).
 *
 * BEAT FIXES:
 *   - enc_ash_wolves (+ its _outcomes / win / lose / run): Burn-Zone Alpha "fights beside three lights" (her bio) — the
 *     spawner now fields 3 Ash Wolves with her (encounter.also). Alpha heavy 4 + 3 lights = 7 points: L2 7/7, L3 7/8,
 *     L4 7/9 — all "average" (rows: plains/canyons/ashwastes t1, phaseGte 2).
 *
 * GILBERT AT THE END OF THE ARC (Dave 11-13: "let's have him and his quest show up when the players are lvl 9, at the end
 * of the arc"). The engine has NO party-level gate: _resolveGateValue (bbttcc-campaign module.js) knows storyPhase, turn,
 * hexesClaimed and the story meters only, and directorState.stewardLevelFloor is a level FLOOR the director raises
 * Stewards to, not a condition. Level follows the act: PHASE_FLOORS[6] = { steward: 9, faction: 4 } — Act 6 is the last
 * act of Part One and the act that puts the party at L9. So the whole Hidden Vault quest (Gilbert's quest — every
 * story.quest "hidden_vault" beat + its hv_ / ans_hv_ answer beats) moves from { flag:"storyPhase", gte:3 } to gte:6:
 *   - inject.requires gates the injector (hex door PolygonWood.a → enc_hidden_vault_approach), the Director, invitations,
 *     the quest log's NOW/doors (readiness), AND executeBeat refuses any beat whose act (_beatActOf = that gte) is ahead
 *     of storyPhase on every path except a forced run — so a chain choice can't walk in early either.
 *   - campaign.story.quests.hidden_vault.act 3 → 6 (the quest log's act; the quest is evergreen, so it never act-seals).
 *   - names: gilbert_theater_fight "Gilbert, Eternally Cleaning Not Leaning Theater Attendant" (matches no actor) →
 *     "Gilbert, Attendant Eternal" (pack + world id LQS2jaeFhzFMDpxA, the beats' own speakerActorId); the hub
 *     enc_hidden_vault_gilbert "Gilbert" (tier 1) → the same name, tier 3 (no sceneId, so it never stages a spawn);
 *     gilbert_theater_intro (a dialog on a POV picture, 058mRogcNeTDsgvs) → actorName "" so the spawner never puts a
 *     token on the picture (he still speaks via speakerActorId).
 *   NOTE for Dave: a T3 heavy against L9 (budget Tier II, ENCOUNTER.budget L6–10) still reads one tier up on the chassis.
 *
 * MAARG SHELVED (Dave 11-13: "Let's shelve the Maarg beat for now."): every road-table row whose beatId starts
 * enc_desenitarius_maarg (canyons/ashwastes t2+t3, generic_t4 cinematic intro) is REMOVED and never re-homed. The beats
 * stay in the campaign, parked the house way (patch-defer-expansion-2026-10-21): { flag:"storyPhase", gte:9 } appended to
 * inject.requires (acts run 0–6 — it never opens), original requires on beat._deferred. Nothing else routes to them (no hex
 * door, quest, script, turnBeats entry or other beat's choice). The "Run the gauntlet" dead end (next "") is left for unshelving.
 *
 * DRY RUN by default; globalThis.__roadTierCleanupDry = false applies. Before any write a JournalEntry
 * "Road tables tier cleanup backup 2026-11-13" stores the before-JSON of encounterTables + every touched beat + touched story.quests defs.
 * Idempotent: a second run = 0 changes. Report → globalThis.__roadTierCleanupReport.
 */
(async () => {
  const DRY_RUN = globalThis.__roadTierCleanupDry !== false;
  const NS = "bbttcc-campaign";
  const PACK = "bbttcc-master-content.npcs";
  const BACKUP_NAME = "Road tables tier cleanup backup 2026-11-13";
  const SRC_TAG = "road_tier_cleanup_2026_11_13";

  // <plan> — pure (no Foundry globals below this line until </plan>)
  const PHASE = { 1: 2, 2: 4, 3: 7, 4: 10 };   // same ladder as expand-road-encounters-2026-11-13 (T3/T4 = Part Two, Dave to set)
  const MIRROR_T2 = true;                      // removed legacy T2 rows on t1 tables come back as phase-4 alpha mirrors
  const ROMAN = { I: 1, II: 2, III: 3, IV: 4 };
  const tierNum = (v) => { const n = ROMAN[String(v ?? "").trim().toUpperCase()] ?? Number(v); return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null; };

  // Legacy road fights whose foes are not (only) named on the beat — pre-placed scene tokens or a nameless myth.
  const FOE_TIER = {
    enc_bandit_ambush: [1, "Road Bandit / Commander Road Bandit (pre-placed)"],
    enc_geometry_serpent: [1, "Jommetry Serpent"],
    enc_scavenger_beast: [1, "Scavenger Beast"],
    enc_ash_wolves: [1, "Burn-Zone Alpha + Ash Wolf"],
    enc_mutant_wildlife_t2: [2, "Wastes Stalker"],
    enc_hexknight: [2, "Hexknight"],
    enc_raider_raze_team: [2, "Razor Raider / Raider Marauder (raze team)"],
    enc_qlipothic_shambler: [3, "Qliphothic Shambler"],
    enc_slippage_wraith: [3, "Slippage Wraith"],
    enc_mutant_wildlife_t3: [3, "Apex Predator"],
    enc_apex_predator: [3, "Apex Predator"],
    enc_desenitarius_maarg: [4, "Desenitarius Maarg"]
  };

  const ASH = { beats: ["enc_ash_wolves", "enc_ash_wolves_outcomes", "enc_ash_wolves_outcomes_win", "enc_ash_wolves_outcomes_lose", "enc_ash_wolves_outcomes_run"],
    lead: "Burn-Zone Alpha", wolf: "Ash Wolf", wolves: 3 };
  const BAD_GILBERT = "Gilbert, Eternally Cleaning Not Leaning Theater Attendant";
  const GILBERT = {
    quest: "hidden_vault", act: 6,   // Act 6 = PHASE_FLOORS[6] steward L9 — the end of Part One (module.js PHASE_FLOORS)
    beatRe: /^(enc_hidden_vault_|gilbert_theater_|hv_|ans_hv_)/,
    good: "Gilbert, Attendant Eternal",
    names: {
      gilbert_theater_fight: { from: [BAD_GILBERT], to: "Gilbert, Attendant Eternal" },
      enc_hidden_vault_gilbert: { from: ["Gilbert"], to: "Gilbert, Attendant Eternal", tier: 3 },
      gilbert_theater_intro: { from: [BAD_GILBERT], to: "" }   // POV picture — no token on a picture
    }
  };
  const MAARG = { re: /^enc_desenitarius_maarg/, gate: 9 };   // shelved: rows removed, beats left in place behind the Act-9 park

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const tableTier = (tid) => { const m = String(tid).match(/_t(\d)$/); return m ? Number(m[1]) : null; };
  const tableTerrain = (tid) => { const m = String(tid).match(/^travel_([a-z]+)_t\d$/); return m && m[1] !== "generic" ? m[1] : null; };
  const isMirrorKeep = (row, F, t) => row?.alphaMirror === true && F === 2 && t === 1 && Number(row?.conditions?.phaseGte) >= PHASE[2];

  /** ctx: { campaign, tables, nameTier: Map(name → tier) | null } */
  function plan(ctx) {
    const { campaign, tables } = ctx;
    const out = { rowsRemove: [], rowsAdd: [], phaseRaise: [], beatEdits: [], storyEdits: [], tierNotes: [], kept: [] };
    const beatById = new Map((campaign.beats || []).map(b => [b?.id, b]));

    const foeTierOf = (beatId) => {
      const b = beatById.get(beatId);
      const enc = b?.encounter || {};
      const names = [enc.actorName, ...((Array.isArray(enc.also) ? enc.also : []).map(a => a?.actorName))].map(n => String(n || "").trim()).filter(Boolean);
      let byName = null;
      if (ctx.nameTier) for (const n of names) { const t = ctx.nameTier.get(n); if (t) byName = Math.max(byName || 0, t); }
      const ov = FOE_TIER[beatId];
      if (ov && byName && byName !== ov[0]) out.tierNotes.push(`${beatId}: FOE_TIER ${ov[0]} ≠ pack tier ${byName} (${names.join(" + ")}) — FOE_TIER used`);
      return ov ? ov[0] : byName;
    };

    // 1. walk every row: A (remove + home) or B (raise phase)
    const homes = new Map();   // tableId|beatId → row
    const removedIdx = new Map();
    for (const [tid, t] of Object.entries(tables)) {
      const tt = tableTier(tid); if (!tt) continue;
      (t.entries || []).forEach((row, i) => {
        // Maarg shelved (Dave 11-13): every row that leads to him goes, and is never re-homed
        if (MAARG.re.test(String(row?.beatId || ""))) {
          out.rowsRemove.push({ tableId: tid, index: i, beatId: row.beatId, row: clone(row), foeTier: null, why: "shelved" });
          (removedIdx.get(tid) || removedIdx.set(tid, new Set()).get(tid)).add(i);
          return;
        }
        const F = foeTierOf(row?.beatId); if (!F) return;
        const cond = (row.conditions && typeof row.conditions === "object") ? row.conditions : {};
        if (F > tt) {
          if (isMirrorKeep(row, F, tt)) { out.kept.push(`${tid}:${row.beatId}`); return; }
          out.rowsRemove.push({ tableId: tid, index: i, beatId: row.beatId, row: clone(row), foeTier: F });
          (removedIdx.get(tid) || removedIdx.set(tid, new Set()).get(tid)).add(i);
          // home: same terrain on the foe's own tier, else generic (carrying the terrain)
          const terr = tableTerrain(tid) || cond.terrain || null;
          let home = terr ? `travel_${terr}_t${F}` : `travel_generic_t${F}`;
          if (!tables[home]) home = `travel_generic_t${F}`;
          const key = `${home}|${row.beatId}`;
          const c2 = clone(cond); c2.tier = String(F); c2.phaseGte = PHASE[F];
          if (/_generic_/.test(home)) { delete c2.terrain; if (terr) c2.terrains = [terr]; }
          const prev = homes.get(key);
          if (prev) {
            if (prev.row.conditions.terrains && c2.terrains) prev.row.conditions.terrains = [...new Set([...prev.row.conditions.terrains, ...c2.terrains])];
            else if (!c2.terrains) delete prev.row.conditions.terrains;
            prev.row.weight = Math.max(prev.row.weight, Number(row.weight) || 1);
          } else homes.set(key, { tableId: home, row: { campaignId: row.campaignId ?? campaign.id, beatId: row.beatId, weight: Number(row.weight) || 1, conditions: c2, src: SRC_TAG }, from: `${tid}`, foeTier: F, why: "home" });
          if (MIRROR_T2 && F === 2 && tt === 1) {
            const c3 = clone(cond); c3.tier = "1"; c3.phaseGte = PHASE[2];
            homes.set(`${tid}|${row.beatId}|mirror`, { tableId: tid, row: { campaignId: row.campaignId ?? campaign.id, beatId: row.beatId, weight: 1, conditions: c3, src: SRC_TAG, alphaMirror: true }, from: tid, foeTier: F, why: "mirror" });
          }
          return;
        }
        if (F >= 2 && !(Number(cond.phaseGte) >= PHASE[F])) {
          out.phaseRaise.push({ tableId: tid, index: i, beatId: row.beatId, from: cond.phaseGte ?? null, to: PHASE[F], foeTier: F });
        }
      });
    }
    // home rows: skip where the destination already rows the beat (that row is phase-checked by the walk above)
    for (const h of homes.values()) {
      const t = tables[h.tableId];
      if (!t) { out.tierNotes.push(`no table ${h.tableId} for ${h.row.beatId}`); continue; }
      const drop = removedIdx.get(h.tableId) || new Set();
      const exists = (t.entries || []).some((e, i) => !drop.has(i) && e?.beatId === h.row.beatId && (h.why === "mirror" ? e.alphaMirror === true : true));
      if (exists) continue;
      out.rowsAdd.push(h);
    }

    // 2. beat fixes
    for (const id of ASH.beats) {
      const b = beatById.get(id); if (!b) { out.tierNotes.push(`ash: beat ${id} missing`); continue; }
      const enc = b.encounter || {};
      if (String(enc.actorName || "").trim() !== ASH.lead) { out.tierNotes.push(`ash: ${id} actorName is "${enc.actorName}" — skipped`); continue; }
      const also = Array.isArray(enc.also) ? enc.also : [];
      if (also.some(a => String(a?.actorName || "").trim() === ASH.wolf)) continue;
      out.beatEdits.push({ beatId: id, what: `encounter.also += ${ASH.wolf} ×${ASH.wolves}`, apply: (bb) => {
        bb.encounter = bb.encounter || {}; if (bb.encounter.count == null) bb.encounter.count = 1;
        bb.encounter.also = [...(Array.isArray(bb.encounter.also) ? bb.encounter.also : []), { actorName: ASH.wolf, count: ASH.wolves }];
      } });
    }
    // Gilbert: the whole Hidden Vault quest waits for Act 6 (L9, end of Part One)
    const reqArr = (r) => Array.isArray(r) ? r : (r && typeof r === "object" ? [r] : []);
    const isSP = (c) => c && typeof c === "object" && String(c.flag) === "storyPhase" && c.gte != null;
    const hvBeats = (campaign.beats || []).filter(b => b && (String(b.story?.quest || "") === GILBERT.quest || GILBERT.beatRe.test(String(b.id || ""))));
    if (!hvBeats.length) out.tierNotes.push(`gilbert: no ${GILBERT.quest} beats found`);
    for (const b of hvBeats) {
      const sp = reqArr(b.inject?.requires).filter(isSP);
      if (sp.length && sp.every(c => Number(c.gte) >= GILBERT.act)) continue;
      out.beatEdits.push({ beatId: b.id, what: `inject.requires storyPhase ${sp.length ? sp.map(c => c.gte).join("/") : "-"} → gte ${GILBERT.act}`, apply: (bb) => {
        bb.inject = bb.inject || {};
        const arr = reqArr(bb.inject.requires).map(c => clone(c));
        let had = false;
        for (const c of arr) if (isSP(c)) { had = true; if (!(Number(c.gte) >= GILBERT.act)) c.gte = GILBERT.act; }
        if (!had) arr.unshift({ flag: "storyPhase", gte: GILBERT.act });
        bb.inject.requires = arr;
      } });
    }
    {
      const q = campaign.story?.quests?.[GILBERT.quest];
      if (!q) out.tierNotes.push(`gilbert: campaign.story.quests.${GILBERT.quest} missing — the code default act applies`);
      else if (!(Number(q.act) >= GILBERT.act))
        out.storyEdits.push({ key: GILBERT.quest, what: `story.quests.${GILBERT.quest}.act ${q.act} → ${GILBERT.act}`, apply: (c) => { c.story.quests[GILBERT.quest].act = GILBERT.act; } });
    }
    for (const [id, fx] of Object.entries(GILBERT.names)) {
      const b = beatById.get(id); if (!b) { out.tierNotes.push(`gilbert: ${id} missing`); continue; }
      const cur = String(b.encounter?.actorName ?? "");
      const tierOff = fx.tier != null && Number(b.encounter?.tier) !== fx.tier;
      if (cur === fx.to && !tierOff) continue;
      if (cur !== fx.to && !fx.from.includes(cur)) { out.tierNotes.push(`gilbert: ${id} actorName is "${cur}" — not the known bad name, left alone`); continue; }
      out.beatEdits.push({ beatId: id, what: `encounter.actorName "${cur}" → "${fx.to}"${tierOff ? `, tier ${b.encounter?.tier ?? "-"} → ${fx.tier}` : ""}`, apply: (bb) => {
        bb.encounter = bb.encounter || {}; bb.encounter.actorName = fx.to; if (fx.tier != null) bb.encounter.tier = fx.tier;
      } });
    }
    // Maarg shelved: the beats stay, parked the house way (patch-defer-expansion-2026-10-21) — an Act-9 gate appended (the acts
    // run 0–6, so it never opens; lint P10 reads it as deferred), original requires kept on beat._deferred for a restore.
    for (const b of (campaign.beats || [])) {
      if (!b || !MAARG.re.test(String(b.id || "")) || b._deferred) continue;
      out.beatEdits.push({ beatId: b.id, what: `shelved — inject.requires += storyPhase gte ${MAARG.gate} (original on _deferred)`, apply: (bb) => {
        const hadInject = bb.inject != null; bb.inject = bb.inject || {};
        const orig = bb.inject.requires ?? null;
        bb._deferred = { requires: orig == null ? null : clone(orig), hadInject, at: "2026-11-13", why: "Maarg shelved (Dave 11-13)" };
        bb.inject.requires = [...reqArr(orig).map(c => clone(c)), { flag: "storyPhase", gte: MAARG.gate }];
      } });
    }
    out.tierNotes.push(`gilbert: T3 heavy at Act ${GILBERT.act} (L9 = Tier II budget) still reads one tier up on ENCOUNTER.rate — Dave's ruling, flagged`);
    return out;
  }

  /** Apply a plan to plain objects (mutates). Returns change count. */
  function applyPlan(pl, campaign, tables) {
    let n = 0;
    const byId = new Map((campaign.beats || []).map(b => [b?.id, b]));
    for (const e of pl.beatEdits) { const b = byId.get(e.beatId); if (b) { e.apply(b); n++; } }
    for (const e of pl.storyEdits) { e.apply(campaign); n++; }
    for (const r of pl.phaseRaise) { const row = tables[r.tableId].entries[r.index]; row.conditions = { ...(row.conditions || {}), phaseGte: r.to }; n++; }
    const byTable = {};
    for (const r of pl.rowsRemove) (byTable[r.tableId] = byTable[r.tableId] || new Set()).add(r.index);
    for (const [tid, drop] of Object.entries(byTable)) { tables[tid].entries = tables[tid].entries.filter((_, i) => !drop.has(i)); n += drop.size; }
    for (const h of pl.rowsAdd) { tables[h.tableId].entries.push(h.row); n++; }
    return n;
  }
  globalThis.__roadTierCleanupLib = { PHASE, FOE_TIER, ASH, GILBERT, MAARG, plan, applyPlan, tierNum };
  // </plan>

  if (globalThis.__roadTierCleanupLibOnly) return;
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  let campaignId = null;
  try { campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.() || null; } catch (_e) {}
  if (!campaignId) { try { campaignId = game.settings.get(NS, "activeCampaignId") || null; } catch (_e) {} }
  const campaign = camps?.[campaignId];
  if (!campaign) return ui.notifications?.error(`Active campaign '${campaignId}' not found.`);
  if (!campaign.id) campaign.id = campaignId;
  const tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : foundry.utils.deepClone(tablesRaw);
  const tablesBefore = JSON.parse(JSON.stringify(tables));

  // bestiary tier by name (pack index with the rfi tier field)
  let nameTier = null, packNames = null;
  try {
    const pack = game.packs?.get?.(PACK);
    if (pack) {
      const idx = await pack.getIndex({ fields: ["flags.fourththing.rfi.actor.tier"] });
      nameTier = new Map(); packNames = new Set();
      for (const e of idx) { packNames.add(e.name); const t = tierNum(e?.flags?.fourththing?.rfi?.actor?.tier); if (t) nameTier.set(e.name, t); }
    }
  } catch (e) { console.warn("[road-tier-cleanup] pack index failed", e); }

  const pl = plan({ campaign, tables, nameTier });
  const changes = pl.rowsRemove.length + pl.rowsAdd.length + pl.phaseRaise.length + pl.beatEdits.length + pl.storyEdits.length;
  const report = {
    DRY_RUN, campaignId, changes,
    rowsRemoved: pl.rowsRemove.map(r => `${r.tableId}:${r.beatId} (w${r.row.weight}, phase ${r.row.conditions?.phaseGte ?? "-"}, ${r.why === "shelved" ? "SHELVED" : `foe T${r.foeTier}`})`),
    rowsAdded: pl.rowsAdd.map(h => `${h.tableId}:${h.row.beatId} (w${h.row.weight}, phase ${h.row.conditions.phaseGte}${h.why === "mirror" ? ", alphaMirror" : ""}${h.row.conditions.terrains ? ", terrains " + h.row.conditions.terrains.join("/") : ""})`),
    phaseRaised: pl.phaseRaise.map(r => `${r.tableId}:${r.beatId} ${r.from ?? "-"}→${r.to}`),
    beatEdits: pl.beatEdits.map(e => `${e.beatId}: ${e.what}`),
    storyEdits: pl.storyEdits.map(e => e.what),
    maargRowsRemoved: pl.rowsRemove.filter(r => r.why === "shelved").length,
    mirrorsKept: pl.kept.length,
    notes: pl.tierNotes,
    gilbertInPack: packNames ? packNames.has(GILBERT.good) : "unverified",
    ashWolfInPack: packNames ? packNames.has(ASH.wolf) : "unverified"
  };

  if (!DRY_RUN && changes) {
    const touched = new Set([...pl.beatEdits.map(e => e.beatId)]);
    const backup = { at: new Date().toISOString(), campaignId, encounterTables: tablesBefore,
      beatsBefore: (campaign.beats || []).filter(b => touched.has(b?.id)).map(b => JSON.parse(JSON.stringify(b))),
      storyQuestsBefore: Object.fromEntries(pl.storyEdits.map(e => [e.key, JSON.parse(JSON.stringify(campaign.story?.quests?.[e.key] ?? null))])) };
    try {
      const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const existing = (game.journal?.contents ?? []).filter(j => String(j.name).startsWith(BACKUP_NAME)).length;
      await JournalEntry.create({ name: existing ? `${BACKUP_NAME} (pass ${existing + 1})` : BACKUP_NAME, pages: [{ name: "before", type: "text", text: { content: `<pre>${esc(JSON.stringify(backup, null, 1))}</pre>` } }] });
    } catch (e) { report.error = `backup failed — nothing written: ${e?.message || e}`; globalThis.__roadTierCleanupReport = report; return ui.notifications?.error(report.error); }
    applyPlan(pl, campaign, tables);
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
    await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  }

  globalThis.__roadTierCleanupReport = report;
  console.log(`[road-tier-cleanup] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — −${pl.rowsRemove.length} / +${pl.rowsAdd.length} rows, ${pl.phaseRaise.length} phase gates raised, ${pl.beatEdits.length} beat edits, ${pl.storyEdits.length} story edits`, report);
  ui.notifications?.info(`Road tables tier cleanup ${DRY_RUN ? "dry run" : "applied"}: ${changes} changes (−${pl.rowsRemove.length}/+${pl.rowsAdd.length} rows, ${pl.phaseRaise.length} phase gates, ${pl.beatEdits.length + pl.storyEdits.length} beat/story fixes).`);
})();
