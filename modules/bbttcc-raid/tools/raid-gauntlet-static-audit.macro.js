// raid-gauntlet-static-audit.macro.js — RUN IN-WORLD (GM). READ-ONLY (never writes).
// ─────────────────────────────────────────────────────────────────────────────
// RAID GAUNTLET · Phase 1 — the static auditor.
// Sister to steward-gauntlet-static-audit. SIM-BADEDEN for the RAID layer: sweeps
// the live maneuver/grant/siege surface for the static bug CLASSES without firing
// a single maneuver. Reads the runtime catalog (game.bbttcc.api.raid.EFFECTS — the
// unified registry that base maneuvers + sprint/balance/courtly enhancers + siege
// counter-activities + threat-vectors all register into), the grant tables
// (game.bbttcc.api.raid.crewGrants.{crewMap,occultMap,classMap}), the handler maps
// (game.bbttcc.api.agent.__THROUGHPUT + game.bbttcc.api.raid.STRATEGIC_THROUGHPUT +
// the scenario source catalogs), and the compendium packs the grant tables are
// NAME-keyed against. Catches:
//   A. GRANT → MANEUVER ORPHANS — a crew/occult/class grants a maneuver KEY that
//      doesn't exist in the catalog (typo / renamed / never shipped).
//   B. GRANTING-BODY NAME MISMATCHES — a crew/occult/class NAME in a grant table
//      matches NO compendium item (the grant silently never fires).
//   B2. UNGRANTED COMPENDIUM BODIES — pack crews/occult that grant nothing (info).
//   C. UNGRANTED SCENE MANEUVERS — scene maneuvers no crew/occult/class grants, so
//      only standard-availability or hand-authored doctrine can surface them (the
//      survey's "crews don't grant what they own" coverage gap — INFO, not a bug).
//   D. TIER-GATE SANITY — tier missing / < 1 / > MAX_TIER (maneuvers only).
//   E. SCENARIO MANEUVER WITHOUT HANDLER — an intrigue/courtly (scenario-engine)
//      maneuver with no throughput / scenario effects[] anywhere (prose promises,
//      engine silent — the empty-marker-AE disease, raid edition).
//   F. COST-FIELD SANITY — missing cost, non-numeric, <= 0, or the OP-as-marks
//      ×10 class (a positive cost an order of magnitude below its band).
//   G. CLASH vs STRATEGIC COST RULE — a clash-tempo activity whose clash total is
//      NOT a discount on its full strategic cost (the ec6038b design rule).
//   H. SIEGE TAG COMPLETENESS — siege activities missing siegeSide / cost.
//   I. OBSTACLE-KEY COVERAGE — per canonical raid type, confirm the obstacle key +
//      specialist wiring exists (Siege=Bombard/Threshold, Infiltration=alarm/Covert
//      Ops, Social=Suspicion/The Last Word←Cosmic Linguist, Violence=diffuse).
//
// Output: console tables + JSON blob + an auto-downloaded report + a GM chat card.
// READ-ONLY — never writes packs or actors (feedback_deploy_leveldb_pack_stop_sync_start).
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const MAX_TIER = 4;          // raid maneuvers gate on faction tier 1..4
  const COST_FLOOR = 5;        // a positive cost below this smells like OP-as-marks ×10

  const raid = game.bbttcc?.api?.raid;
  if (!raid) return ui.notifications.error("game.bbttcc.api.raid not found — is bbttcc-raid active?");
  const EFFECTS  = raid.EFFECTS ?? game.bbttcc?.api?.EFFECTS ?? {};
  const grants   = raid.crewGrants ?? {};
  const crewMap  = grants.crewMap ?? {};
  const occMap   = grants.occultMap ?? {};
  const classMap = grants.classMap ?? {};
  const TP  = game.bbttcc?.api?.agent?.__THROUGHPUT ?? {};   // scene maneuver throughput
  const STP = raid.STRATEGIC_THROUGHPUT ?? {};                // siege/strategic throughput
  const clashList = game.bbttcc?.api?.siege?.clashManeuvers ?? null; // [{key,label,side,cost,costTotal}]
  if (!Object.keys(EFFECTS).length) ui.notifications.warn("EFFECTS catalog is empty — load order? Auditing what's present.");

  // Mirror module.raid-console.js _normName so name checks match the live gate.
  const normName  = (s) => String(s || "").toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim();
  // Mirror systems/fourththing/bbttcc-bridge.js ftNormalizeAssetName: echoAssets stores the
  // CANONICAL crew/occult name (prefix + "(Tier N)" stripped), and that's what grants match —
  // so compendium item names must be canonicalized the same way before comparison.
  const canonAsset = (s, kind) => {
    let out = String(s ?? "").trim();
    if (kind === "crew") out = out.replace(/^Crew Type:\s*/i, "").replace(/^Awesome Crew:\s*/i, "");
    else if (kind === "occult") out = out.replace(/^Occult Association:\s*/i, "").replace(/^Occult:\s*/i, "");
    return normName(out.replace(/\s*\((?:Tier|T)\s*\d+\)\s*$/i, "").trim());
  };
  const NON_OP_POOLS = new Set(["anytime"]); // budget currencies where small values are normal (not OP ×10 candidates)
  // Accepted empty-cost OPTION stubs — narrative-safe placeholders whose mechanical riders
  // (Slice 4/5) are not yet attached. Reviewed + parked as WIP 2026-06-07; tracked in the
  // raid-gauntlet backlog, so they're reported as INFO, not hard findings.
  const ACCEPTED_EMPTY_COST = new Set(["opt_shock_command", "opt_silent_entry", "optact_doctrine_force_projection", "optact_deep_cover_network"]);
  const stripHtml = (h) => String(h ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lc = (s) => String(s ?? "").toLowerCase();

  // Scenario source catalogs carry m.effects[] / m.throughput (the courtly/intrigue
  // effects[] arrays don't live on the EFFECTS entry — they're on the source item).
  const sourceByKey = new Map();
  for (const cat of [raid.courtlyManeuvers, raid.sprint2Maneuvers, raid.sprint3aManeuvers, raid.balanceManeuvers])
    if (Array.isArray(cat)) for (const m of cat) if (m?.key) sourceByKey.set(String(m.key).toLowerCase(), m);

  const isAutomated = (key, e) => {
    if (typeof TP[key] === "function" || typeof STP[key] === "function") return true;
    if (typeof e.apply === "function" || typeof e.throughput === "function" || typeof e.fn === "function") return true;
    const src = sourceByKey.get(key);
    if (src && (typeof src.throughput === "function" || (Array.isArray(src.effects) && src.effects.length))) return true;
    return false;
  };

  // ── Normalize every catalog entry into one shape (handles base/enhancer/siege) ──
  const mans = [];
  for (const [rawKey, e] of Object.entries(EFFECTS)) {
    if (!e || typeof e !== "object") continue;
    const key = String(rawKey).toLowerCase();
    mans.push({
      key,
      kind: lc(e.kind ?? "maneuver"),
      label: e.label ?? e.name ?? key,
      tier: e.tier ?? e.meta?.tier ?? null,
      engine: lc(e.meta?.engine ?? e.engine ?? ""),
      availability: lc(e.meta?.availability ?? e.availability ?? ""),
      band: lc(e.band ?? e.meta?.costBand ?? e.costBand ?? ""),
      cost: e.cost ?? e.opCosts ?? null,
      raidTypes: e.raidTypes ?? null,
      siege: e.siege === true || e.siegeCounterActivity === true,
      siegeSide: lc(e.siegeSide ?? ""),
      strategic: lc(e.kind ?? "") === "strategic",
      automated: isAutomated(key, e),
      text: stripHtml(e.text ?? e.effectsText ?? ""),
      desc: stripHtml(typeof e.description === "object" ? e.description?.value : e.description),
      raw: e
    });
  }
  const byKey = new Map(mans.map(m => [m.key, m]));
  const has = (k) => byKey.has(String(k).toLowerCase());

  const out = {
    grantOrphans: [], nameMismatch: [], ungrantedBodies: [], ungrantedManeuvers: [],
    tierBad: [], scenarioNoHandler: [], costBad: [], clashRule: [], siegeTags: [], obstacleKey: [],
    wipOptionStubs: []
  };

  // ── A · GRANT → MANEUVER ORPHANS + collect granted-key union ──
  const grantedKeys = new Set();
  const checkGrantMap = (mapObj, kind) => {
    for (const [body, keys] of Object.entries(mapObj)) for (const k of (Array.isArray(keys) ? keys : [])) {
      const lk = String(k).toLowerCase();
      grantedKeys.add(lk);
      if (!has(lk)) out.grantOrphans.push({ kind, body, maneuverKey: lk, problem: "no such maneuver in catalog" });
    }
  };
  checkGrantMap(crewMap, "crew");
  checkGrantMap(occMap, "occult");
  checkGrantMap(classMap, "class");

  // ── B · GRANTING-BODY NAME MISMATCHES (names vs compendium items) ──
  const findPack = (needles) => game.packs.find(p => p.metadata?.type === "Item" &&
    needles.some(n => lc(p.collection).includes(n) || lc(p.metadata?.name).includes(n) || lc(p.metadata?.label).includes(n)));
  // kind drives canonicalization: crew/occult strip prefix+tier; class matches by raw name (_normName).
  const packNames = async (pack, kind) => {
    if (!pack) return null;
    try { const docs = await pack.getDocuments(); return new Set(docs.map(d => kind === "class" ? normName(d.name) : canonAsset(d.name, kind))); }
    catch (e) { console.warn("[raid-gauntlet] pack read failed", pack?.collection, e); return null; }
  };
  const crewPack  = findPack(["crew-types", "crew"]);
  const occPack   = findPack(["occult-associations", "occult"]);
  const classPack = findPack(["classes"]);
  const crewItemNames  = await packNames(crewPack, "crew");
  const occItemNames   = await packNames(occPack, "occult");
  const classItemNames = await packNames(classPack, "class");

  const checkNames = (mapObj, itemNames, kind, packId) => {
    if (!itemNames) { out.nameMismatch.push({ kind, body: "—", problem: `pack not found / unreadable (${packId ?? "?"}) — cannot verify ${kind} names` }); return; }
    const granted = new Set();
    for (const body of Object.keys(mapObj)) {
      const nn = normName(body);
      granted.add(nn);
      if (!itemNames.has(nn)) out.nameMismatch.push({ kind, body, normalized: nn, problem: "no compendium item with this name — grant silently never fires" });
    }
    for (const nm of itemNames) if (!granted.has(nm)) out.ungrantedBodies.push({ kind, body: nm, note: "compendium item grants no maneuvers" });
  };
  checkNames(crewMap, crewItemNames, "crew", crewPack?.collection);
  checkNames(occMap, occItemNames, "occult", occPack?.collection);
  // class names live on character actors, not only a pack — still useful to flag pack mismatches
  checkNames(classMap, classItemNames, "class", classPack?.collection);

  // ── C · UNGRANTED SCENE MANEUVERS (coverage gap — INFO, not a hard bug) ──
  for (const m of mans) {
    if (m.siege || m.strategic) continue;
    if (!grantedKeys.has(m.key)) out.ungrantedManeuvers.push({ key: m.key, label: m.label, engine: m.engine || "—", note: "no crew/occult/class grants this maneuver" });
  }

  // ── D · TIER-GATE SANITY (maneuvers only; strategic/siege aren't tier-gated) ──
  for (const m of mans) {
    if (m.siege || m.strategic) continue;
    const t = m.tier;
    if (t === null || t === undefined) out.tierBad.push({ key: m.key, label: m.label, tier: "(missing)" });
    else if (typeof t !== "number" || !Number.isFinite(t) || t < 1 || t > MAX_TIER) out.tierBad.push({ key: m.key, label: m.label, tier: String(t) });
  }

  // ── E · SCENARIO MANEUVER WITHOUT HANDLER ──
  // intrigue/courtly maneuvers resolve through a throughput fn or a scenario
  // effects[] array. If neither exists anywhere, the prose promises but nothing fires.
  for (const m of mans) {
    if (m.siege || m.strategic) continue;
    if ((m.engine === "intrigue" || m.engine === "courtly") && !m.automated) {
      out.scenarioNoHandler.push({ key: m.key, label: m.label, engine: m.engine, problem: "no throughput / scenario effects[] — engine silent" });
    }
  }

  // ── F · COST-FIELD SANITY (missing / non-numeric / <=0 / OP-as-marks ×10) ──
  const bandFloor = { light: 10, medium: 20, standard: 20, heavy: 40, rare: 20 };
  for (const m of mans) {
    const cost = m.cost;
    const entries = Object.entries(cost ?? {}).filter(([, v]) => v !== undefined && v !== null);
    if (cost == null || !entries.length) {
      const bucket = ACCEPTED_EMPTY_COST.has(m.key) ? out.wipOptionStubs : out.costBad;
      bucket.push({ key: m.key, label: m.label, problem: cost == null ? "no cost defined (free?)" : "cost object empty" });
      continue;
    }
    for (const [pool, v] of entries) {
      const n = Number(v);
      if (!Number.isFinite(n)) { out.costBad.push({ key: m.key, label: m.label, problem: `non-numeric cost ${pool}=${v}` }); continue; }
      if (n < 0) { out.costBad.push({ key: m.key, label: m.label, problem: `negative cost ${pool}=${n}` }); continue; }
      if (n > 0 && n < COST_FLOOR && !NON_OP_POOLS.has(lc(pool))) {
        const expect = bandFloor[m.band];
        const tag = expect && n * 10 <= expect + 5 ? ` — looks like OP-as-marks ×10 (band '${m.band}' expects ~${expect})` : "";
        out.costBad.push({ key: m.key, label: m.label, problem: `suspiciously low cost ${pool}=${n}${tag}` });
      }
    }
  }

  // ── G · CLASH vs STRATEGIC COST RULE (clash must be a discount) ──
  const sumCost = (c) => Object.values(c ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  if (Array.isArray(clashList)) {
    for (const c of clashList) {
      const key = String(c?.key ?? "").toLowerCase();
      if (!has(key)) { out.clashRule.push({ key, label: c?.label ?? key, problem: "in siege.clashManeuvers but absent from EFFECTS" }); continue; }
      const strat = sumCost(byKey.get(key).cost ?? c.cost);
      const clash = Number(c.costTotal);
      if (strat > 0 && Number.isFinite(clash) && clash >= strat) {
        out.clashRule.push({ key, label: c.label ?? key, problem: `clash total ${clash} ≥ strategic total ${strat} (clash must be a FRACTION — ec6038b)` });
      }
    }
  } else out.clashRule.push({ key: "—", label: "—", problem: "siege.clashManeuvers not exposed — cannot verify clash discounts" });

  // ── H · SIEGE TAG COMPLETENESS ──
  for (const m of mans) {
    if (!m.siege) continue;
    const probs = [];
    if (m.siegeSide !== "attacker" && m.siegeSide !== "defender") probs.push(`siegeSide='${m.siegeSide || "(missing)"}'`);
    if (m.cost == null || !Object.keys(m.cost).length) probs.push("no cost");
    if (probs.length) out.siegeTags.push({ key: m.key, label: m.label, problems: probs.join("; ") });
  }

  // ── I · OBSTACLE-KEY COVERAGE (per raid type — the design law) ──
  const cov = [];
  cov.push({ raidType: "Siege", obstacle: "Threshold/Plates", key: "bombard",
    ok: has("bombard") && (clashList ?? []).some(c => String(c.key).toLowerCase() === "bombard"),
    specialist: "Bombard (clash)",
    note: !has("bombard") ? "BOMBARD MISSING" : ((clashList ?? []).some(c => String(c.key).toLowerCase() === "bombard") ? "ok" : "bombard not clash-tempo") });
  const alarmReady = mans.some(m => m.engine === "intrigue");
  cov.push({ raidType: "Infiltration", obstacle: "Alarm", key: "(alarm engine)", ok: alarmReady, specialist: "Covert Ops Cell",
    note: (crewMap["Covert Ops Cell"]?.length ? "" : "Covert Ops Cell grants nothing; ") + (alarmReady ? "ok" : "no intrigue maneuvers found") });
  const lastWordFn = typeof game.bbttcc?.api?.raid?.courtly?.armLastWord === "function" || mans.some(m => m.engine === "courtly");
  const clGrants = (classMap["Cosmic Linguist"] ?? []);
  cov.push({ raidType: "Social", obstacle: "Suspicion≥10 collapse", key: "armLastWord", ok: lastWordFn, specialist: "Cosmic Linguist",
    note: (clGrants.length ? "" : "Cosmic Linguist grants nothing; ") + (lastWordFn ? "ok" : "courtly/armLastWord not found") });
  cov.push({ raidType: "Violence", obstacle: "Guard (diffuse)", key: "—", ok: true, specialist: "(none by design)", note: "diffuse — no single obstacle key expected" });
  for (const c of cov) if (!c.ok) out.obstacleKey.push(c); // ok:true rows (incl. Violence-diffuse by design) are not gaps

  // ── Report ──
  const SECTIONS = [
    ["A · GRANT → MANEUVER ORPHANS (grants a key with no catalog entry)", out.grantOrphans],
    ["B · GRANTING-BODY NAME MISMATCHES (name ≠ any compendium item)", out.nameMismatch],
    ["B2 · UNGRANTED COMPENDIUM BODIES (coverage — info)", out.ungrantedBodies],
    ["C · UNGRANTED SCENE MANEUVERS (no crew home — coverage info)", out.ungrantedManeuvers],
    ["D · TIER-GATE SANITY (missing / <1 / >" + MAX_TIER + ")", out.tierBad],
    ["E · SCENARIO MANEUVER WITHOUT HANDLER (intrigue/courtly, engine silent)", out.scenarioNoHandler],
    ["F · COST-FIELD SANITY (missing / <=0 / OP-as-marks ×10)", out.costBad],
    ["F2 · ACCEPTED WIP OPTION STUBS (empty cost, riders pending — info)", out.wipOptionStubs],
    ["G · CLASH vs STRATEGIC COST RULE (clash must be a discount)", out.clashRule],
    ["H · SIEGE TAG COMPLETENESS (siegeSide / cost)", out.siegeTags],
    ["I · OBSTACLE-KEY COVERAGE GAPS (per raid type)", out.obstacleKey]
  ];
  const HARD = ["A · GRANT → MANEUVER ORPHANS (grants a key with no catalog entry)",
    "B · GRANTING-BODY NAME MISMATCHES (name ≠ any compendium item)",
    "D · TIER-GATE SANITY (missing / <1 / >" + MAX_TIER + ")",
    "E · SCENARIO MANEUVER WITHOUT HANDLER (intrigue/courtly, engine silent)",
    "F · COST-FIELD SANITY (missing / <=0 / OP-as-marks ×10)",
    "G · CLASH vs STRATEGIC COST RULE (clash must be a discount)",
    "H · SIEGE TAG COMPLETENESS (siegeSide / cost)",
    "I · OBSTACLE-KEY COVERAGE GAPS (per raid type)"];

  console.log(`\n══════ RAID GAUNTLET · STATIC AUDIT ══════`);
  console.log(`catalog: ${mans.length} entries (${mans.filter(m=>!m.strategic&&!m.siege).length} scene maneuvers, ${mans.filter(m=>m.siege||m.strategic).length} strategic/siege) · grants: crew ${Object.keys(crewMap).length} / occult ${Object.keys(occMap).length} / class ${Object.keys(classMap).length} · ${Math.round(performance.now()-t0)}ms`);
  console.log(`packs: crew=${crewPack?.collection ?? "?"} occult=${occPack?.collection ?? "?"} class=${classPack?.collection ?? "?"}\n`);
  console.log("── RAID-TYPE OBSTACLE-KEY COVERAGE (full):"); console.table(cov);
  for (const [title, rows] of SECTIONS) {
    const flag = HARD.includes(title) && rows.length ? " ⚠" : "";
    console.log(`── ${title} — ${rows.length}${flag}`);
    if (rows.length) console.table(rows);
  }
  const hardTotal = SECTIONS.filter(([t]) => HARD.includes(t)).reduce((s, [, r]) => s + r.length, 0);
  console.log(`\nHARD findings (excludes B2/C coverage-info): ${hardTotal}`);
  console.log("JSON (copy for the fix sprint):");
  console.log(JSON.stringify(out));
  try {
    saveDataToFile(
      JSON.stringify({ world: game.world?.id, when: new Date().toISOString(), catalog: mans.length,
        grantBodies: { crew: Object.keys(crewMap).length, occult: Object.keys(occMap).length, class: Object.keys(classMap).length },
        hardFindings: hardTotal, coverage: cov, findings: out }, null, 2),
      "application/json", `raid-gauntlet-audit-${game.world?.id ?? "world"}.json`);
  } catch (e) { console.warn("[raid-gauntlet] file download failed — copy the JSON line above", e); }

  const counts = SECTIONS.map(([t, r]) => `<li>${t.split("·")[1].trim().split("(")[0].trim()}: <b>${r.length}</b></li>`).join("");
  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#7ab8e8">
      <div class="ft-roll-header"><span class="ft-roll-name">⚔ Raid Gauntlet — Static Audit</span></div>
      <p style="margin:0.2rem 0;font-size:0.78rem">${mans.length} catalog entries scanned · <b>${hardTotal}</b> hard findings:</p>
      <ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.78rem">${counts}</ul>
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables + JSON in the console (F12). Read-only — nothing was changed.</p>
    </div>`
  });
})();
