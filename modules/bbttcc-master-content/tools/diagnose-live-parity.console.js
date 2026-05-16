// scripts/tools/diagnose-live-parity.console.js
// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC Live Parity Diagnostic
//
// PASTE INTO A SCRIPT MACRO on each Foundry instance (foundry + ember) and run.
// Reports content state vs expected counts + suggests the seeder macro to run
// when something is missing.
//
// READS ONLY — no writes, no migrations. Safe to run anywhere.
//
// Output: structured GM-whispered chat card with ✅ / ⚠️ / ❌ per check.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const fmt = (n, expected) => {
    if (expected === null || expected === undefined) return `<b>${n}</b>`;
    if (n >= expected) return `✅ <b>${n}</b> / ${expected}`;
    if (n === 0)      return `❌ <b>${n}</b> / ${expected} <i>(missing)</i>`;
    return `⚠️ <b>${n}</b> / ${expected} <i>(partial)</i>`;
  };

  const section = (title) => `<h4 style="margin:.45rem 0 .2rem 0; color:#7dd3fc; font-size:12px; letter-spacing:.04em; text-transform:uppercase;">${title}</h4>`;
  const line = (label, value, hint) => `<div style="padding:.1rem 0;"><b>${label}:</b> ${value}${hint ? `<div style="font-size:10.5px; opacity:.7; padding-left:1rem; line-height:1.3;">→ ${hint}</div>` : ""}</div>`;
  const code = (s) => `<code style="background:rgba(125, 211, 252, 0.12); padding:.05rem .25rem; border-radius:3px;">${s}</code>`;

  const rows = [];
  const summary = { ok: 0, warn: 0, fail: 0 };

  // Helper: read pack index size safely
  async function packSize(packId) {
    try {
      const pack = game.packs.get(packId);
      if (!pack) return { exists: false, size: 0 };
      const idx = await pack.getIndex();
      return { exists: true, size: idx.size, pack };
    } catch (e) { return { exists: false, size: 0, err: e.message }; }
  }

  // Helper: track summary
  function tally(actual, expected) {
    if (expected == null) return;
    if (actual === 0) summary.fail += 1;
    else if (actual < expected) summary.warn += 1;
    else summary.ok += 1;
  }

  // ── Maneuvers (runtime EFFECTS registry) ─────────────────────────────
  rows.push(section("Maneuvers — Runtime EFFECTS Registry"));
  const EFFECTS = game.bbttcc?.api?.raid?.EFFECTS || {};
  const maneuvers = Object.values(EFFECTS).filter(e => e?.kind === "maneuver");
  const s2  = maneuvers.filter(e => e?.meta?.authoredSprint === 2).length;
  const s3a = maneuvers.filter(e => e?.meta?.authoredSprint === "3a").length;
  const taggedEngine   = maneuvers.filter(e => e?.meta?.engine).length;
  const taggedFireMode = maneuvers.filter(e => e?.fireMode).length;

  rows.push(line("Total maneuvers", fmt(maneuvers.length, 59), maneuvers.length < 59 ? `Catalog incomplete. Run ${code("refresh-maneuver-catalog.macro.js")}` : ""));
  rows.push(line("Sprint-2 maneuvers", fmt(s2, 10), s2 < 10 ? `Run ${code("seed-sprint2-maneuvers.macro.js")}` : ""));
  rows.push(line("Sprint-3a maneuvers", fmt(s3a, 10), s3a < 10 ? "S3a registers from code at script-load. Hard-reload if 0 — check console for <code>[bbttcc-raid:s3a-content]</code>." : ""));
  rows.push(line("Engine-tagged", fmt(taggedEngine, maneuvers.length), taggedEngine < maneuvers.length ? `${maneuvers.length - taggedEngine} untagged — run ${code("tag-maneuver-engines.macro.js")}` : ""));
  rows.push(line("Fire-mode-tagged", fmt(taggedFireMode, Math.min(55, maneuvers.length)), taggedFireMode < 55 ? "Auto-tags at load. Hard-reload first." : ""));
  tally(s2, 10); tally(s3a, 10); tally(taggedEngine, maneuvers.length);

  // ── NP Ancestries ────────────────────────────────────────────────────
  rows.push(section("NP Ancestries — Dragon / Devil / Angel / Eidolon"));
  const anc = await packSize("bbttcc-master-content.ancestries");
  if (anc.exists) {
    const docs = await anc.pack.getDocuments();
    const npDocs = docs.filter(d => d.flags?.bbttcc?.npAncestry || ["dragon","devil","infernal","angel","empyrean","eidolon","outsider"].some(s => (d.flags?.bbttcc?.kind || "").toLowerCase().includes(s) || (d.flags?.bbttcc?.lineage || "").toLowerCase().includes(s)));
    rows.push(line("Total ancestry items", fmt(anc.size, null), `expect ~30+ after NP seed`));
    rows.push(line("NP ancestry items", fmt(npDocs.length, 20), npDocs.length < 20 ? `Unlock pack → run ${code("create-np-ancestries.macro.js")}` : ""));
    tally(npDocs.length, 20);
  } else {
    rows.push(line("Ancestries pack", "❌ NOT FOUND", `Expected ${code("bbttcc-master-content.ancestries")}`));
    summary.fail += 1;
  }

  // ── Rig Frames (vehicles pack) ───────────────────────────────────────
  rows.push(section("Rig Frames — Vehicles Pack"));
  const vehicles = await packSize("bbttcc-master-content.vehicles");
  if (vehicles.exists) {
    rows.push(line("Frame items", fmt(vehicles.size, 15), vehicles.size < 15 ? `Low — run ${code("add-frames-audit-fix.macro.js")} and ${code("add-personal-rigs.macro.js")}` : ""));
    tally(vehicles.size, 15);
  } else {
    rows.push(line("Vehicles pack", "❌ NOT FOUND", `Expected ${code("bbttcc-master-content.vehicles")}`));
    summary.fail += 1;
  }

  // ── Bestiary (NPCs pack) ─────────────────────────────────────────────
  rows.push(section("Bestiary — Schema-Unified NPCs"));
  const npcs = await packSize("bbttcc-master-content.npcs");
  if (npcs.exists) {
    rows.push(line("NPC entries", fmt(npcs.size, 44), npcs.size < 44 ? `Run ${code("seed-bestiary.macro.js")} → ${code("seed-bestiary-attacks.macro.js")}` : ""));
    tally(npcs.size, 44);
  } else {
    rows.push(line("NPCs pack", "❌ NOT FOUND", `Expected ${code("bbttcc-master-content.npcs")}`));
    summary.fail += 1;
  }

  // ── Doctrines / Maneuver pack docs ───────────────────────────────────
  rows.push(section("Doctrine Pack Docs"));
  const doctrines = await packSize("bbttcc-master-content.doctrines");
  if (doctrines.exists) {
    rows.push(line("Doctrine items", fmt(doctrines.size, 59), doctrines.size < 59 ? `Run ${code("refresh-maneuver-catalog.macro.js")} (full refresh) or ${code("refresh-orphan-pack-docs.macro.js")} (orphan rescue, flip <code>DRY_RUN=false</code>)` : ""));
    tally(doctrines.size, 59);
  } else {
    rows.push(line("Doctrines pack", "❌ NOT FOUND", `Expected ${code("bbttcc-master-content.doctrines")}`));
    summary.fail += 1;
  }

  // ── Items (gear/weapons/materials/consumables) ───────────────────────
  rows.push(section("Items — Gear / Weapons / Materials"));
  const items = await packSize("bbttcc-master-content.items");
  if (items.exists) {
    const docs = await items.pack.getDocuments();
    const priced = docs.filter(d => d.system?.price?.value > 0 || d.flags?.bbttcc?.price);
    rows.push(line("Total items", fmt(items.size, null), ""));
    rows.push(line("Priced items", fmt(priced.length, Math.floor(items.size * 0.8)), priced.length < items.size * 0.5 ? `Run ${code("price-stamp.macro.js")}` : ""));
    tally(priced.length, Math.floor(items.size * 0.5));
  } else {
    rows.push(line("Items pack", "❌ NOT FOUND", `Expected ${code("bbttcc-master-content.items")}`));
    summary.fail += 1;
  }

  // ── Sparks (Tikkun) ──────────────────────────────────────────────────
  rows.push(section("Tikkun Sparks"));
  const sparks = await packSize("bbttcc-tikkun.sparks");
  if (sparks.exists) {
    rows.push(line("Spark entries", fmt(sparks.size, 10), sparks.size === 0 ? `Run ${code("bbttcc-tikkun/tools/load-sparks-pack.macro.js")}` : ""));
    tally(sparks.size, 10);
  } else {
    rows.push(line("Sparks pack", "❌ NOT FOUND", `Expected ${code("bbttcc-tikkun.sparks")}`));
    summary.fail += 1;
  }

  // ── Leygates ─────────────────────────────────────────────────────────
  rows.push(section("Leygate Network — Bad Eden"));
  let totalGates = 0;
  let totalQuestBeatUnlocks = 0;
  for (const scene of game.scenes ?? []) {
    for (const drawing of scene.drawings ?? []) {
      const flag = drawing.flags?.["bbttcc-territory"];
      if (flag?.leygate || flag?.isLeygate || flag?.gateAnchor) totalGates += 1;
      if (drawing.flags?.["bbttcc-campaign"]?.questBeatUnlock) totalQuestBeatUnlocks += 1;
    }
  }
  rows.push(line("Leygate-flagged drawings", fmt(totalGates, 6), totalGates < 6 ? `Run ${code("setup-bad-eden-leygates.macro.js")} on the right scene` : ""));
  rows.push(line("Quest-beat-unlock drawings", fmt(totalQuestBeatUnlocks, null), totalQuestBeatUnlocks === 0 ? `Optional: run ${code("stamp-leygate-quest-beats.macro.js")}` : ""));
  tally(totalGates, 6);

  // ── Affiliation OP Table (faction OP-roll engine) ────────────────────
  rows.push(section("Faction OP-Roll Engine — Affiliation Table"));
  const hasOpTable = !!(game.bbttcc?.api?.factions?.rosterContribution || game.bbttcc?.api?.raid?.affiliationOpTable);
  rows.push(line("affiliation-op-table.enhancer", hasOpTable ? "✅ loaded" : "❌ NOT loaded", hasOpTable ? "" : "Should auto-load on world boot. Hard-reload first."));

  // ── Footer ──────────────────────────────────────────────────────────
  const verdictColor = summary.fail > 0 ? "#ef4444" : (summary.warn > 0 ? "#fbbf24" : "#2dd4bf");
  const verdictText  = summary.fail > 0 ? "⚠️ Action needed" : (summary.warn > 0 ? "🟡 Mostly ready, some gaps" : "✅ All clear");
  const footer = `<div style="margin-top:.5rem; padding-top:.4rem; border-top:1px dashed rgba(148, 163, 184, 0.3); font-size:11px;">
    <b style="color:${verdictColor};">${verdictText}</b>
    <span style="opacity:.7;"> · ${summary.ok} OK · ${summary.warn} partial · ${summary.fail} missing</span>
    <div style="margin-top:.3rem; font-size:10.5px; opacity:.75;">Run the suggested macros above on this instance, then run this diagnostic again to verify.</div>
  </div>`;

  // ── Emit chat card ───────────────────────────────────────────────────
  const content = `<div style="padding:.55rem .65rem; background:linear-gradient(135deg, rgba(125, 211, 252, 0.10), rgba(45, 212, 191, 0.05)); border:1px solid rgba(125, 211, 252, 0.25); border-radius:6px; font-size:11.5px; line-height:1.45;">
    <h3 style="margin:0 0 .15rem 0; color:#7dd3fc;">🔍 BBTTCC Live Parity Diagnostic</h3>
    <p style="margin:.1rem 0 .35rem 0; opacity:.7; font-size:10.5px;">World: <b>${game.world.id}</b> · ${new Date().toLocaleString()}</p>
    ${rows.join("\n")}
    ${footer}
  </div>`;

  await ChatMessage.create({
    content,
    speaker: { alias: "BBTTCC Parity" },
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id)
  });

  // Console mirror for quick scan
  console.log("[BBTTCC Parity]", {
    maneuvers: { total: maneuvers.length, s2, s3a, taggedEngine, taggedFireMode },
    ancestries: anc.size,
    vehicles: vehicles.size,
    npcs: npcs.size,
    doctrines: doctrines.size,
    items: items.size,
    sparks: sparks.size,
    leygates: totalGates,
    summary
  });
})();
