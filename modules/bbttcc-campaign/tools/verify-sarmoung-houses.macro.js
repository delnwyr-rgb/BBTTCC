/* verify-sarmoung-houses.macro.js — read-only audit of the nine dormant houses.
 * 2026-08-15. Changes NOTHING. GM only.
 *
 * Confirms what actually got stamped, and sanity-checks the two houses whose
 * canon definition is a DISTANCE claim:
 *   house 2 — "the bend that hears the lake"  → should sit near Lake Suspicious
 *   house 3 — "keeps the gardeners"           → should sit near Founders' Garden
 * Cross-scene distance is meaningless, so those checks report the scene of both
 * the house and its anchor and refuse to score a mismatch.
 */
(async () => {
  const NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const ALL = game.scenes.contents.flatMap(sc =>
    (sc.drawings?.contents || []).filter(d => d.flags?.[TERR]).map(d => ({
      doc: d, label: d.text || d.flags[TERR]?.name || "(unnamed)",
      key: norm(d.text || d.flags[TERR]?.name), scene: sc.name,
      cx: (d.x || 0) + ((d.shape?.width || 0) / 2),
      cy: (d.y || 0) + ((d.shape?.height || 0) / 2),
      house: d.flags?.[NS]?.sarmoungHouse ?? null
    })));

  const houses = ALL.filter(h => h.house).sort((a, b) => a.house - b.house);
  const anchor = (name) => {
    const w = norm(name);
    return ALL.find(h => h.key === w)
        || ALL.find(h => h.key.startsWith(w) || w.startsWith(h.key))
        || ALL.find(h => h.key.includes(w) || w.includes(h.key)) || null;
  };
  // Median hex spacing → a human-readable "about N hexes away".
  const spacing = (() => {
    const s = ALL.slice(0, 60), d = [];
    for (const a of s) { let m = Infinity;
      for (const b of s) if (a !== b) m = Math.min(m, Math.hypot(a.cx - b.cx, a.cy - b.cy));
      if (isFinite(m) && m > 0) d.push(m); }
    d.sort((x, y) => x - y);
    return d.length ? d[Math.floor(d.length / 2)] : 0;
  })();

  const out = [`[verify-sarmoung-houses] ${houses.length}/9 placed`];
  for (let n = 1; n <= 9; n++) {
    const h = houses.find(x => x.house === n);
    out.push(h ? `  ${n}. ${h.label}   [${h.scene}]` : `  ${n}. ⚠ MISSING — no hex carries sarmoungHouse=${n}`);
  }

  out.push("", "— distance claims (canon says these houses are defined by what they perceive) —");
  for (const [n, anchorName, claim] of [[2, "Lake Suspicious", "hears the lake"], [3, "Founders' Garden", "keeps the gardeners"]]) {
    const h = houses.find(x => x.house === n);
    const a = anchor(anchorName);
    if (!h) { out.push(`  house ${n}: not placed`); continue; }
    if (!a) { out.push(`  house ${n}: ⚠ anchor "${anchorName}" NOT FOUND anywhere — claim "${claim}" unverifiable`); continue; }
    if (a.scene !== h.scene) {
      out.push(`  house ${n}: ⚠ CROSS-SCENE — house on [${h.scene}], "${a.label}" on [${a.scene}]. Distance is meaningless; the "${claim}" claim was NOT honored by proximity. Re-pick by hand if the claim matters.`);
      continue;
    }
    const d = Math.hypot(h.cx - a.cx, h.cy - a.cy);
    const hexes = spacing ? (d / spacing).toFixed(1) : "?";
    out.push(`  house ${n}: ${h.label} → ${a.label} = ~${hexes} hexes  ${Number(hexes) <= 2.5 ? "✅ plausibly '" + claim + "'" : "⚠ far — does that still read as '" + claim + "'?"}`);
  }

  out.push("", "— dormancy + humility audit —");
  let sarm = 0, landmark = 0;
  for (const h of houses) {
    const oe = h.doc.flags?.[TERR]?.campaign?.onEnterBeatId;
    if (!oe) continue;
    if (/sarmoung|house|pilgrim|movement/i.test(oe)) {
      sarm++;
      out.push(`  ⛔ house ${h.house} @ ${h.label} carries a SARMOUNG onEnter '${oe}' — dormancy BROKEN. The hook is Tier 3.`);
    } else {
      landmark++;
      out.push(`  ⓘ house ${h.house} @ ${h.label} sits on a hex with its own pre-existing onEnter '${oe}'. Dormancy of the HOUSE is intact (nothing Sarmoung fires) — but this hex is a LANDMARK, and §1.5 wants the houses on ground no proud eye stops at. Consider the unremarkable neighbour instead.`);
    }
  }
  if (!sarm) out.push("  ✅ no Sarmoung hooks anywhere — the houses are inert. Dormancy intact.");
  if (landmark) out.push(`  ⚠ ${landmark}/9 houses sit on named landmarks. Codex §7 says "near"/"edge" for several — see the humility question.`);

  console.log(out.join("\n"));
  ui.notifications.info(`verify-sarmoung-houses: ${houses.length}/9 placed — see console (F12).`);
})();
