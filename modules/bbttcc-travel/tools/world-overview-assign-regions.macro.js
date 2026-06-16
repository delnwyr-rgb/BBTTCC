/* Bad Eden — World Overview · 2.1 REGION ASSIGNMENT (run as GM macro IN-WORLD)
 *
 * NON-DESTRUCTIVE. Re-derives the geographic 5-region carving against the LIVE hexes
 * (deterministic k-means seeded on the biggest named areas — no randomness), stamps
 * each hex Drawing with flags["bbttcc-travel"].regionKey, and prints a per-region
 * roster for review. MOVES NOTHING — that's the separate 2.2 migration macro.
 *
 * To override a hex's region: add its name to MANUAL below (name -> regionKey) and
 * re-run. Manual picks are recorded (regionKeyManual) and survive future re-runs.
 *
 * Re-runnable / idempotent.
 */
(async () => {
  const SCOPE = "bbttcc-travel";
  const MOD_TERR = "bbttcc-territory";
  if (!game.user.isGM) return ui.notifications.error("Region assignment must be run by a GM.");

  const REGIONS = [
    { key: "r1", name: "The Iron Reaches",     seed: "Inconvenient Mountains" },
    { key: "r2", name: "The Northern Marches", seed: "Static Coast" },
    { key: "r3", name: "The Saltwake Coast",   seed: "Hexen Myre" },
    { key: "r4", name: "The River Heart",      seed: "Odaroloc River" },
    { key: "r5", name: "The Drowned South",    seed: "Drowned Kudzu Reach" },
  ];

  // Hard overrides: hex NAME -> regionKey (edit + re-run to nudge straddlers).
  const MANUAL = {
    // "Hexen Myre.d": "r5",
  };

  // 1) Locate the master hex scene (most territory hexes; prefer name match).
  const countHexes = (s) =>
    s.drawings.filter(d => d.flags?.[MOD_TERR] && Object.keys(d.flags[MOD_TERR]).length > 0).length;
  const cands = game.scenes
    .filter(s => !s.getFlag(SCOPE, "isWorldHub"))
    .map(s => ({ s, n: countHexes(s) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  const scene = cands.find(x => /bad\s*eden/i.test(x.s.name))?.s || cands[0]?.s;
  if (!scene) return ui.notifications.error("No scene with territory hexes found.");

  // 2) Gather hexes.
  const baseName = (nm) => String(nm || "?")
    .replace(/[ ._]*[a-z0-9]+$/i, "").trim()
    .replace(/\s+[a-z]$/i, "").trim() || String(nm || "?");
  const hexes = scene.drawings
    .filter(d => d.flags?.[MOD_TERR] && Object.keys(d.flags[MOD_TERR]).length > 0)
    .map(d => ({
      id: d.id,
      name: d.flags[MOD_TERR].name || d.id,
      x: Number(d.x) || 0, y: Number(d.y) || 0,
      manual: d.flags?.[SCOPE]?.regionKeyManual || null
    }));
  hexes.forEach(h => { h.base = baseName(h.name); });
  if (!hexes.length) return ui.notifications.error("Scene has no hexes.");

  // 3) Deterministic k-means seeded on the named areas.
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const seedCentroid = (seedName, i) => {
    const p = hexes.filter(h => h.base === seedName);
    if (p.length) return { x: p.reduce((s, h) => s + h.x, 0) / p.length, y: p.reduce((s, h) => s + h.y, 0) / p.length };
    // fallback: spread fake seeds if a named area is missing live
    const xs = hexes.map(h => h.x), ys = hexes.map(h => h.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: minX + (maxX - minX) * ((i + 0.5) / REGIONS.length), y: (minY + maxY) / 2 };
  };
  let C = REGIONS.map((r, i) => seedCentroid(r.seed, i));
  let assign = new Array(hexes.length).fill(0);
  for (let iter = 0; iter < 40; iter++) {
    for (let h = 0; h < hexes.length; h++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < C.length; k++) { const dd = d2(hexes[h], C[k]); if (dd < bd) { bd = dd; best = k; } }
      assign[h] = best;
    }
    for (let k = 0; k < C.length; k++) {
      const cl = hexes.filter((_, h) => assign[h] === k);
      if (cl.length) C[k] = { x: cl.reduce((s, h) => s + h.x, 0) / cl.length, y: cl.reduce((s, h) => s + h.y, 0) / cl.length };
    }
  }

  // 4) Resolve final regionKey (MANUAL/override wins), compute straddler distance.
  const keyByIdx = REGIONS.map(r => r.key);
  const updates = [];
  for (let h = 0; h < hexes.length; h++) {
    const hex = hexes[h];
    const autoKey = keyByIdx[assign[h]];
    const override = MANUAL[hex.name] || hex.manual || null;
    hex.regionKey = override || autoKey;
    hex.auto = autoKey;
    hex.dist = Math.round(Math.sqrt(d2(hex, C[assign[h]])));
    const u = { _id: hex.id, [`flags.${SCOPE}.regionKey`]: hex.regionKey };
    if (MANUAL[hex.name]) u[`flags.${SCOPE}.regionKeyManual`] = MANUAL[hex.name];
    updates.push(u);
  }
  await scene.updateEmbeddedDocuments("Drawing", updates);

  // 5) Roster + straddler report.
  const byRegion = Object.fromEntries(REGIONS.map(r => [r.key, []]));
  hexes.forEach(h => byRegion[h.regionKey].push(h));
  const STRADDLE = 360; // px from cluster centroid → worth eyeballing
  const lines = [`<b>Region assignment — "${foundry.utils.escapeHTML(scene.name)}" (${hexes.length} hexes)</b>`];
  for (const r of REGIONS) {
    const list = byRegion[r.key].sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`<div style="margin-top:.4rem;"><b>${r.name}</b> <code>${r.key}</code> — ${list.length} hexes</div>`);
    lines.push(`<div style="color:#9bd; font-size:11px;">${list.map(h => foundry.utils.escapeHTML(h.name)).join(", ")}</div>`);
  }
  const straddlers = hexes.filter(h => !MANUAL[h.name] && !h.manual && h.dist > STRADDLE)
    .sort((a, b) => b.dist - a.dist);
  if (straddlers.length) {
    lines.push(`<div style="margin-top:.5rem; color:#e8b35a;"><b>Check these (far from their region center):</b></div>`);
    lines.push(`<div style="font-size:11px;">${straddlers.map(h => `${foundry.utils.escapeHTML(h.name)} → ${h.auto} (${h.dist}px)`).join("<br>")}</div>`);
  }
  lines.push(`<div style="margin-top:.5rem; color:#888;">Stamped <code>regionKey</code> on all hexes. Nothing moved. Edit MANUAL{} to nudge, re-run, then run the 2.2 migration when happy.</div>`);

  ChatMessage.create({ content: lines.join(""), whisper: [game.user.id] });
  const counts = REGIONS.map(r => `${r.key}:${byRegion[r.key].length}`).join("  ");
  ui.notifications.info(`Region assignment done — ${counts}`);
  console.log("[bbttcc] region assignment", { scene: scene.name, counts: byRegion, straddlers: straddlers.map(h => h.name) });
})();
