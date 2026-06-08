// tikkun-gauntlet-static-audit.macro.js — RUN IN-WORLD (GM). READ-ONLY (never writes).
// ─────────────────────────────────────────────────────────────────────────────
// TIKKUN GAUNTLET · Phase 1 — the static auditor.
// Sister to raid-gauntlet-static-audit. Sweeps the live Great-Work surface for the
// static bug CLASSES without mutating a single actor. Reads the sparks compendium
// (bbttcc-tikkun.sparks), the live API (game.bbttcc.api.tikkun.*), the sephirah
// fallback alignment table, and the registered hook listeners. Catches:
//   P. PACK COMPLETENESS — the 30 expected sparks (10 sephiroth × 3 kinds) present,
//      each with a unique identifier, matching sephirah/kind, and a valid repair
//      recipe (materialKey, opCost.pool ∈ OP_POOLS, numeric amount/DC).
//   M. METHOD-TAG SANITY — aligned/misaligned arrays non-empty, DISJOINT (a method
//      both aligned & misaligned = a contradiction the corruption classifier can't
//      resolve), and every method ∈ the known OP/method-tag set.
//   A. ALIGNMENT-TABLE ↔ PACK DRIFT — the Tikkun analog of the grant-name trap.
//      checkMethodAlignment() uses the spark ITEM's arrays when the ref resolves,
//      but falls back to SEPHIRAH_METHOD_ALIGNMENT when it doesn't. If the authored
//      pack arrays disagree with the fallback table, the SAME method corrupts-or-not
//      depending on whether the beat passed a resolvable ref — silent misclassification.
//   K. API WIRING — every documented game.bbttcc.api.tikkun.* function is installed.
//   H. HOOK WIRING — bbttcc:spark:corrupted has listeners. If ZERO, character-spark
//      corruption fires into the void: nothing ever propagates it to the faction
//      tikkun.corrupted gate that getGreatWorkState() reads (the headline gap — the
//      RUNNER proves the downstream consequence behaviorally).
//
// Output: console tables + a JSON blob (auto-downloaded) + a GM chat card.
// READ-ONLY — never writes packs or actors (feedback_deploy_leveldb_pack_stop_sync_start).
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const MOD = "bbttcc-tikkun";
  const api = game.bbttcc?.api?.tikkun;
  if (!api) return ui.notifications.error("game.bbttcc.api.tikkun not found — is bbttcc-tikkun active?");

  const SEPH = ["keter","chokmah","binah","chesed","gevurah","tiferet","netzach","hod","yesod","malkuth"];
  const KINDS = ["conceptual","vestigial","animate"];
  // Method tags are the OP pools (mirrors tikkun-repair OP_POOLS + the alignment table).
  const METHODS = new Set(["violence","intrigue","softpower","diplomacy","economy","nonlethal","faith","logistics","siege","body","soul","culture"]);

  // findings: { cls, level: "BUG"|"WARN"|"INFO"|"OK", name, detail }
  const F = [];
  const add = (cls, level, name, detail = "") => F.push({ cls, level, name, detail });
  const norm = (s) => String(s ?? "").toLowerCase().trim();
  const setEq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

  // ══════ K · API WIRING ══════
  const REQUIRED = [
    "hasSpark","gatherSpark","gatherSparkByItem","getAllSparks","resolveSparkItem","checkMethodAlignment",
    "createConstellationForActor","markSparkPhase","identifySpark","acquireSpark","integrateSparkCharacter","depositSpark",
    "getGreatWorkState","getGreatWorkStateForAllFactions","listSparks","integrateSpark","revokeSpark",
    "openRepairLedger","openRepairRitual","openDepositLedger","beginRitual"
  ];
  for (const fn of REQUIRED) add("K", typeof api[fn] === "function" ? "OK" : "BUG", `api.${fn}`, typeof api[fn] === "function" ? "installed" : "MISSING — load order or unshipped");

  // ══════ A-prep · alignment fallback table ══════
  const ALIGN = api.SEPHIRAH_METHOD_ALIGNMENT || {};
  for (const s of SEPH) {
    const row = ALIGN[s];
    if (!row) { add("A", "BUG", `alignTable[${s}]`, "sephirah missing from SEPHIRAH_METHOD_ALIGNMENT"); continue; }
    const al = (row.aligned || []).map(norm), mis = (row.misaligned || []).map(norm);
    if (!al.length)  add("A", "WARN", `alignTable[${s}].aligned`, "empty aligned list");
    if (!mis.length) add("A", "WARN", `alignTable[${s}].misaligned`, "empty misaligned list");
    const overlap = al.filter(m => mis.includes(m));
    if (overlap.length) add("A", "BUG", `alignTable[${s}] overlap`, `method(s) both aligned & misaligned: ${overlap.join(", ")}`);
    for (const m of [...al, ...mis]) if (!METHODS.has(m)) add("A", "WARN", `alignTable[${s}] unknown method`, `"${m}" is not a known OP/method tag`);
  }

  // ══════ P + M + A · sparks pack sweep ══════
  const pack = game.packs?.get(`${MOD}.sparks`);
  if (!pack) {
    add("P", "BUG", "sparks pack", `${MOD}.sparks not found — did load-sparks-pack run / is the module's pack registered?`);
  } else {
    const idx = await pack.getIndex({ fields: ["name","type","system.sephirah","system.kind","system.alignedMethods","system.misalignedMethods","system.repair","flags.bbttcc-tikkun.identifier"] });
    const docs = [];
    for (const e of idx) { try { docs.push(await pack.getDocument(e._id)); } catch (_e) {} }
    add("P", docs.length === 30 ? "OK" : "WARN", "pack count", `${docs.length} spark items (expected 30 = 10 sephiroth × 3 kinds)`);

    // identifier uniqueness + expected-set coverage
    const byIdent = new Map();
    for (const d of docs) {
      const id = d.flags?.[MOD]?.identifier ?? "";
      if (!id) { add("P", "BUG", `${d.name}`, "missing flags.bbttcc-tikkun.identifier"); continue; }
      if (byIdent.has(id)) add("P", "BUG", `identifier ${id}`, `duplicated on "${d.name}" and "${byIdent.get(id).name}"`);
      else byIdent.set(id, d);
    }
    const expected = SEPH.flatMap(s => KINDS.map(k => `spark_${s}_${k}`));
    for (const want of expected) if (!byIdent.has(want)) add("P", "BUG", `missing ${want}`, "expected spark identifier not present in pack");

    for (const d of docs) {
      const sys = d.system ?? {};
      const id  = d.flags?.[MOD]?.identifier ?? d.name;
      const seph = norm(sys.sephirah), kind = norm(sys.kind);
      // type
      if (d.type !== "spark") add("P", "WARN", id, `item type is "${d.type}" (expected "spark")`);
      // sephirah / kind validity + identifier agreement
      if (!SEPH.includes(seph)) add("P", "BUG", id, `sephirah "${sys.sephirah}" not one of the 10`);
      if (!KINDS.includes(kind)) add("P", "BUG", id, `kind "${sys.kind}" not conceptual/vestigial/animate`);
      const m = /^spark_([a-z]+)_([a-z]+)$/.exec(String(id));
      if (m && (m[1] !== seph || m[2] !== kind)) add("P", "BUG", id, `identifier disagrees with system: id says ${m[1]}/${m[2]}, system says ${seph}/${kind}`);

      // repair recipe
      const r = sys.repair ?? {};
      const matKey = String(r.materialKey ?? "").trim();
      const matAmt = Number(r.materialAmount);
      const pool   = norm(r.opCost?.pool);
      const opAmt  = Number(r.opCost?.amount);
      const dc     = Number(r.ritualDC);
      if (!matKey) add("P", "WARN", `${id} repair`, "no materialKey (repair needs no material — intended?)");
      if (!Number.isFinite(matAmt) || matAmt < 0) add("P", "BUG", `${id} repair`, `materialAmount not a non-negative number: ${r.materialAmount}`);
      if (pool && !METHODS.has(pool)) add("P", "BUG", `${id} repair`, `opCost.pool "${r.opCost?.pool}" not a valid OP pool`);
      if (!Number.isFinite(opAmt) || opAmt < 0) add("P", "BUG", `${id} repair`, `opCost.amount not a non-negative number: ${r.opCost?.amount}`);
      if (!Number.isFinite(dc) || dc < 1) add("P", "BUG", `${id} repair`, `ritualDC not a positive number: ${r.ritualDC}`);
      else if (dc > 25) add("P", "WARN", `${id} repair`, `ritualDC ${dc} looks high (2d10+ caps near ~26)`);

      // M · method-tag sanity
      const al = Array.isArray(sys.alignedMethods) ? sys.alignedMethods.map(norm) : [];
      const mis = Array.isArray(sys.misalignedMethods) ? sys.misalignedMethods.map(norm) : [];
      if (!al.length)  add("M", "BUG", id, "alignedMethods empty — clean gathers impossible via this item");
      if (!mis.length) add("M", "BUG", id, "misalignedMethods empty — corruption can never trigger via this item");
      const overlap = al.filter(x => mis.includes(x));
      if (overlap.length) add("M", "BUG", id, `method(s) both aligned & misaligned: ${overlap.join(", ")}`);
      for (const x of [...al, ...mis]) if (!METHODS.has(x)) add("M", "WARN", id, `unknown method tag "${x}"`);

      // A · pack ↔ fallback drift (only meaningful when both present)
      const fb = ALIGN[seph];
      if (fb && al.length && mis.length) {
        const fa = new Set((fb.aligned || []).map(norm)), fm = new Set((fb.misaligned || []).map(norm));
        if (!setEq(new Set(al), fa)) add("A", "WARN", `${id} aligned drift`, `item=[${al.join(",")}] vs fallback=[${[...fa].join(",")}] — unresolved-ref gathers classify differently`);
        if (!setEq(new Set(mis), fm)) add("A", "WARN", `${id} misaligned drift`, `item=[${mis.join(",")}] vs fallback=[${[...fm].join(",")}] — unresolved-ref gathers classify differently`);
      }
    }
  }

  // ══════ H · HOOK WIRING (the headline gap, statically detectable) ══════
  const hookCount = (name) => {
    try {
      const ev = Hooks.events ?? Hooks._hooks ?? {};
      const arr = ev[name];
      return Array.isArray(arr) ? arr.length : (arr ? Object.keys(arr).length : 0);
    } catch { return -1; }
  };
  const corrL = hookCount("bbttcc:spark:corrupted");
  if (corrL < 0) add("H", "INFO", "bbttcc:spark:corrupted listeners", "could not introspect the hook registry on this Foundry build — check manually");
  else add("H", corrL > 0 ? "OK" : "BUG", "bbttcc:spark:corrupted listeners",
    corrL > 0 ? `${corrL} listener(s)` : "ZERO listeners — character-spark corruption never propagates to the faction tikkun.corrupted gate (getGreatWorkState noCorruption check stays blind). RUNNER proves the readiness leak.");
  for (const h of ["bbttcc:spark:deposited","bbttcc:spark:repaired"]) {
    const n = hookCount(h);
    add("H", "INFO", `${h} listeners`, `${n} listener(s)`);
  }

  // ══════ REPORT ══════
  const order = { BUG: 0, WARN: 1, INFO: 2, OK: 3 };
  F.sort((a, b) => (order[a.level] - order[b.level]) || a.cls.localeCompare(b.cls));
  const bugs = F.filter(f => f.level === "BUG"), warns = F.filter(f => f.level === "WARN"), infos = F.filter(f => f.level === "INFO");
  const byCls = {};
  for (const f of F) { (byCls[f.cls] ??= { BUG: 0, WARN: 0, INFO: 0, OK: 0 })[f.level]++; }

  console.log(`\n══════ TIKKUN GAUNTLET · STATIC AUDIT ══════`);
  console.log(`${F.length} checks · ${bugs.length} BUG · ${warns.length} WARN · ${infos.length} INFO · ${Math.round(performance.now() - t0)}ms`);
  console.table(Object.entries(byCls).map(([cls, v]) => ({ class: cls, BUG: v.BUG, WARN: v.WARN, INFO: v.INFO, OK: v.OK })));
  if (bugs.length)  { console.log("── BUGS"); console.table(bugs); }
  if (warns.length) { console.log("── WARNINGS"); console.table(warns); }
  if (infos.length) { console.log("── INFO"); console.table(infos); }

  try {
    saveDataToFile(JSON.stringify({ world: game.world?.id, when: new Date().toISOString(), counts: { bug: bugs.length, warn: warns.length, info: infos.length }, byCls, findings: F }, null, 2),
      "application/json", `tikkun-gauntlet-audit-${game.world?.id ?? "world"}.json`);
  } catch (_e) {}

  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#9b7ae8"><div class="ft-roll-header"><span class="ft-roll-name">✦ Tikkun Gauntlet — Static Audit</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem"><b>${F.length}</b> checks · <b style="color:${bugs.length ? "#ff8a8a" : "#a0d8a0"}">${bugs.length} BUG</b> · <b style="color:#e8c84a">${warns.length} WARN</b> · ${infos.length} INFO.</p>
      ${bugs.length ? `<ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.72rem">${bugs.slice(0, 8).map(b => `<li><b>[${b.cls}]</b> ${foundry.utils.escapeHTML(b.name)} — ${foundry.utils.escapeHTML(b.detail)}</li>`).join("")}${bugs.length > 8 ? `<li>…+${bugs.length - 8} more (console)</li>` : ""}</ul>` : `<p style="margin:0.2rem 0;font-size:0.74rem;color:#a0d8a0">No BUG-level findings.</p>`}
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables in console · JSON downloaded.</p></div>`
  });
})();
