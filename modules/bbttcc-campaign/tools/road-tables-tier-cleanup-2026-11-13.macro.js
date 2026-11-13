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
 *   - gilbert_theater_fight: encounter.actorName "Gilbert, Eternally Cleaning Not Leaning Theater Attendant" matches no
 *     actor → "Gilbert, Attendant Eternal" (pack + world id LQS2jaeFhzFMDpxA, the beat's own speakerActorId).
 *     HELD by default (it would field a T3 heavy at storyPhase >= 3 ≈ L4): opt in with globalThis.__roadTierCleanupGilbert = true.
 *   - enc_desenitarius_maarg "Run the gauntlet": next was "" (the dialog just closed — no closure, nothing to read).
 *     → new outcome beat enc_desenitarius_maarg_gauntlet (the GM still calls the cost, as the choice promises); the failed
 *     courtesies (enc_desenitarius_maarg_parley_fail "So be it") lead there too.
 *
 * DRY RUN by default; globalThis.__roadTierCleanupDry = false applies. Before any write a JournalEntry
 * "Road tables tier cleanup backup 2026-11-13" stores the before-JSON of encounterTables + every touched beat.
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
  // HELD (review 11-13): the rename makes a T3 heavy actually spawn behind storyPhase >= 3 (~L4, Tier I) — a two-tier-up
  // story fight, which Dave's ruling says never to field. Flip to true only once Dave re-gates the fight (phase 7) or accepts it.
  const FIX_GILBERT = globalThis.__roadTierCleanupGilbert === true;
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
  const GILBERT = { beat: "gilbert_theater_fight", bad: "Gilbert, Eternally Cleaning Not Leaning Theater Attendant", good: "Gilbert, Attendant Eternal" };
  const MAARG = { beat: "enc_desenitarius_maarg", choiceLabel: /^Run the gauntlet/, failBeat: "enc_desenitarius_maarg_parley_fail", gauntlet: "enc_desenitarius_maarg_gauntlet" };
  const INJECT = { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" };
  const gauntletBeat = () => ({
    id: MAARG.gauntlet, label: "Maarg — The Gauntlet", type: "outcome_trigger", timeScale: "leg", timePoints: 0,
    tags: "travel " + SRC_TAG, politicalTags: "", outcomes: { success: null, failure: null }, inject: { ...INJECT }, actors: [], refs: {},
    choices: [{ label: "Count heads", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    description: "Scatter. Not in a line — lines are what it notices. Rigs one way, walkers the other, everybody low and nobody brave.\n\n" +
      "For a long minute the sky is the colour of a bruise and the road is somewhere else. Something vast passes over, or through, or near — it is genuinely hard to say which — and it does not look down. Or it does, and it simply doesn't care. Either way: it moves on.\n\n" +
      "Now count heads. Count wagons. Count what's missing. (The GM calls what the gauntlet cost you.)",
    memoryText: "The Domain ran Desenitarius Maarg's gauntlet on the road — scattered, endured, regrouped, and paid whatever the passing cost.",
    playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
  });

  const clone = (v) => JSON.parse(JSON.stringify(v));
  const tableTier = (tid) => { const m = String(tid).match(/_t(\d)$/); return m ? Number(m[1]) : null; };
  const tableTerrain = (tid) => { const m = String(tid).match(/^travel_([a-z]+)_t\d$/); return m && m[1] !== "generic" ? m[1] : null; };
  const isMirrorKeep = (row, F, t) => row?.alphaMirror === true && F === 2 && t === 1 && Number(row?.conditions?.phaseGte) >= PHASE[2];

  /** ctx: { campaign, tables, nameTier: Map(name → tier) | null } */
  function plan(ctx) {
    const { campaign, tables } = ctx;
    const out = { rowsRemove: [], rowsAdd: [], phaseRaise: [], beatEdits: [], beatsAdd: [], tierNotes: [], kept: [] };
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
    {
      const b = beatById.get(GILBERT.beat);
      if (!FIX_GILBERT) out.tierNotes.push(`gilbert: ${GILBERT.beat} rename HELD (T3 heavy at storyPhase>=3 = tier up) — set globalThis.__roadTierCleanupGilbert = true to apply`);
      else if (b && String(b.encounter?.actorName || "") === GILBERT.bad)
        out.beatEdits.push({ beatId: GILBERT.beat, what: `encounter.actorName → "${GILBERT.good}"`, apply: (bb) => { bb.encounter.actorName = GILBERT.good; } });
      else if (!b) out.tierNotes.push(`gilbert: ${GILBERT.beat} missing`);
    }
    {
      if (!beatById.has(MAARG.gauntlet)) out.beatsAdd.push(gauntletBeat());
      const b = beatById.get(MAARG.beat);
      const ci = (b?.choices || []).findIndex(c => MAARG.choiceLabel.test(String(c?.label || "")));
      if (ci >= 0 && !String(b.choices[ci].next || "").trim())
        out.beatEdits.push({ beatId: MAARG.beat, what: `choice "${b.choices[ci].label}" next → ${MAARG.gauntlet}`, apply: (bb) => { bb.choices[ci].next = MAARG.gauntlet; } });
      else if (ci < 0) out.tierNotes.push(`maarg: no "Run the gauntlet" choice on ${MAARG.beat}`);
      const f = beatById.get(MAARG.failBeat);
      const fi = (f?.choices || []).findIndex(c => String(c?.label || "") === "So be it");
      if (fi >= 0 && !String(f.choices[fi].next || "").trim())
        out.beatEdits.push({ beatId: MAARG.failBeat, what: `choice "So be it" next → ${MAARG.gauntlet}`, apply: (bb) => { bb.choices[fi].next = MAARG.gauntlet; } });
    }
    return out;
  }

  /** Apply a plan to plain objects (mutates). Returns change count. */
  function applyPlan(pl, campaign, tables) {
    let n = 0;
    const byId = new Map((campaign.beats || []).map(b => [b?.id, b]));
    for (const e of pl.beatEdits) { const b = byId.get(e.beatId); if (b) { e.apply(b); n++; } }
    for (const b of pl.beatsAdd) { campaign.beats.push(b); n++; }
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
  const changes = pl.rowsRemove.length + pl.rowsAdd.length + pl.phaseRaise.length + pl.beatEdits.length + pl.beatsAdd.length;
  const report = {
    DRY_RUN, campaignId, changes,
    rowsRemoved: pl.rowsRemove.map(r => `${r.tableId}:${r.beatId} (w${r.row.weight}, phase ${r.row.conditions?.phaseGte ?? "-"}, foe T${r.foeTier})`),
    rowsAdded: pl.rowsAdd.map(h => `${h.tableId}:${h.row.beatId} (w${h.row.weight}, phase ${h.row.conditions.phaseGte}${h.why === "mirror" ? ", alphaMirror" : ""}${h.row.conditions.terrains ? ", terrains " + h.row.conditions.terrains.join("/") : ""})`),
    phaseRaised: pl.phaseRaise.map(r => `${r.tableId}:${r.beatId} ${r.from ?? "-"}→${r.to}`),
    beatEdits: pl.beatEdits.map(e => `${e.beatId}: ${e.what}`),
    beatsAdded: pl.beatsAdd.map(b => b.id),
    mirrorsKept: pl.kept.length,
    notes: pl.tierNotes,
    gilbertInPack: packNames ? packNames.has(GILBERT.good) : "unverified",
    ashWolfInPack: packNames ? packNames.has(ASH.wolf) : "unverified"
  };

  if (!DRY_RUN && changes) {
    const touched = new Set([...pl.beatEdits.map(e => e.beatId)]);
    const backup = { at: new Date().toISOString(), campaignId, encounterTables: tablesBefore,
      beatsBefore: (campaign.beats || []).filter(b => touched.has(b?.id)).map(b => JSON.parse(JSON.stringify(b))), beatsAdded: pl.beatsAdd.map(b => b.id) };
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
  console.log(`[road-tier-cleanup] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — −${pl.rowsRemove.length} / +${pl.rowsAdd.length} rows, ${pl.phaseRaise.length} phase gates raised, ${pl.beatEdits.length} beat edits, ${pl.beatsAdd.length} beats added`, report);
  ui.notifications?.info(`Road tables tier cleanup ${DRY_RUN ? "dry run" : "applied"}: ${changes} changes (−${pl.rowsRemove.length}/+${pl.rowsAdd.length} rows, ${pl.phaseRaise.length} phase gates, ${pl.beatEdits.length + pl.beatsAdd.length} beat fixes).`);
})();
