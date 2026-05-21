// BBTTCC Structures — Derivation Sanity Sheet (Phase A)
// ─────────────────────────────────────────────────────────────────────────────
// Computes all 8 preset BOMs through the API + independently re-derives them
// in this script using the same family table. Outputs:
//
//   • Chat card with a clean comparison table
//   • console.table for fast scanning in F12
//   • PASS/FAIL flag per preset (API output == independent calc)
//   • Δ-vs-spec column showing where the live math differs from the spec's
//     example numbers in §7 (spec values were preliminary ballparks; the
//     family table is now source of truth)
//
// Run as a one-off macro from the hotbar. Pure-read — no actor flags touched.
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const api = game.bbttcc?.api?.structures;
  if (!api) return ui.notifications?.error?.("bbttcc-structures API not ready.");

  // Same 8 presets as the stamp-test macro + the sheet's empty-state picker.
  const PRESETS = {
    hexmobile:      { label: "Hexmobile (Rig)",                  facilityMode: false,
                      bom: [{ materialKey:"bog-iron", qty:4 }, { materialKey:"ash-wood", qty:2 }, { materialKey:"hex-iron-cleat", qty:1 }],
                      specPlates: 17, specThreshold: 1.7 },
    atr:            { label: "ATR — Assault Tactical Rig",       facilityMode: false,
                      bom: [{ materialKey:"scribed-steel", qty:6 }, { materialKey:"heart-iron", qty:3 }, { materialKey:"cold-iron", qty:2 }],
                      specPlates: 33, specThreshold: 3.0 },
    pilotMount:     { label: "Pilot Mount (Rig)",                facilityMode: false,
                      bom: [{ materialKey:"cold-iron", qty:3 }, { materialKey:"ash-wood", qty:2 }],
                      specPlates: 13, specThreshold: 2.2 },
    septWall:       { label: "Sept Wall (Facility)",             facilityMode: true,
                      bom: [{ materialKey:"mountain-stone", qty:12 }, { materialKey:"anchorstone", qty:6 }, { materialKey:"blessed-thread", qty:4 }, { materialKey:"yesodium", qty:1 }],
                      specPlates: 67, specThreshold: 3.0 },
    bunkerGate:     { label: "Bunker Gate (Facility)",           facilityMode: true,
                      bom: [{ materialKey:"scribed-steel", qty:10 }, { materialKey:"hex-glyph-plate", qty:4 }, { materialKey:"yesodium", qty:2 }],
                      specPlates: 44, specThreshold: 3.6 },
    watchtower:     { label: "Watchtower (Facility)",            facilityMode: true,
                      bom: [{ materialKey:"ash-wood", qty:8 }, { materialKey:"mountain-stone", qty:4 }, { materialKey:"hex-iron-cleat", qty:2 }, { materialKey:"focusing-lens", qty:1 }],
                      specPlates: 33, specThreshold: 1.6 },
    glyphWardPylon: { label: "Glyph-Ward Pylon (Facility)",      facilityMode: true,
                      bom: [{ materialKey:"hex-glyph-plate", qty:6 }, { materialKey:"sept-tuning-fork", qty:2 }, { materialKey:"tree-of-life-shard", qty:1 }],
                      specPlates: 17, specThreshold: 2.5 },
    septBridge:     { label: "Sept Bridge (Facility)",           facilityMode: true,
                      bom: [{ materialKey:"mountain-stone", qty:8 }, { materialKey:"ash-wood", qty:4 }, { materialKey:"cold-iron", qty:3 }, { materialKey:"yesodium", qty:1 }],
                      specPlates: 39, specThreshold: 2.4 }
  };

  // Independent calculator — re-derives plates/threshold/loadBearing/resists
  // using the SAME family table the API uses, but via a different code path.
  // If API & independent agree → math is internally consistent.
  function independentCalc(bom) {
    const fams = api.FAMILIES;
    const tierN = (t) => ({I:1, II:2, III:3, IV:4}[String(t||"I").toUpperCase()] ?? 1);
    let plates = 0, tierWsum = 0, units = 0, lb = false;
    const resists = new Set();
    const breakdown = {};
    for (const row of bom) {
      const fam = fams[row.family];
      if (!fam) continue;
      const q = Number(row.qty) || 0;
      const tn = tierN(row.tier);
      plates += q * (fam.plateCoef ?? 1);
      tierWsum += q * tn * (fam.threshWeight ?? 1);
      units += q;
      if (fam.loadBearing) lb = true;
      for (const r of (fam.nativeResists ?? [])) {
        if (r === "typed-from-tags") {
          for (const t of (row.tagsCache ?? [])) {
            const lo = String(t).toLowerCase();
            if (lo.includes("hex-resist") || lo === "warded" || lo === "ward") resists.add("hex-resistant");
            if (lo.includes("qliph"))   resists.add("qliphothic-resistant");
            if (lo.includes("curse"))   resists.add("curse-resistant");
            if (lo.includes("blessed")) resists.add("blessed");
          }
        } else if (r === "quirk") {
          // skip
        } else if (r === "truth-affecting") {
          resists.add("truth-affecting");
        } else {
          resists.add(r);
        }
      }
      breakdown[row.family] = (breakdown[row.family] ?? 0) + q;
    }
    return {
      plates,
      threshold: units > 0 ? Number((tierWsum/units).toFixed(2)) : 0,
      loadBearing: lb,
      resists: Array.from(resists).sort(),
      breakdown,
      units
    };
  }

  // Run all presets
  const rows = [];
  for (const [key, preset] of Object.entries(PRESETS)) {
    const bom = await api.normalizeBOM(preset.bom);
    const apiResult = api.deriveBOM(bom);
    const ind = independentCalc(bom);

    const platesMatch = apiResult.platesMax === ind.plates;
    const threshMatch = Math.abs(apiResult.threshold - ind.threshold) < 0.01;
    const lbMatch     = apiResult.loadBearing === ind.loadBearing;
    const resistsMatch = JSON.stringify(apiResult.resists) === JSON.stringify(ind.resists);
    const pass = platesMatch && threshMatch && lbMatch && resistsMatch;

    rows.push({
      key,
      label: preset.label,
      bom,
      apiResult,
      ind,
      pass,
      checks: { platesMatch, threshMatch, lbMatch, resistsMatch },
      specPlates: preset.specPlates,
      specThreshold: preset.specThreshold,
      platesDeltaVsSpec: apiResult.platesMax - preset.specPlates,
      thresholdDeltaVsSpec: Number((apiResult.threshold - preset.specThreshold).toFixed(2))
    });
  }

  // ── Console output ─────────────────────────────────────────────────────────
  console.group("%c[bbttcc-structures] Phase A derivation sanity sheet",
    "color:#d9c47a; font-weight:bold;");

  console.table(rows.map(r => ({
    Preset: r.label,
    Plates: r.apiResult.platesMax,
    Threshold: r.apiResult.threshold,
    LoadBearing: r.apiResult.loadBearing,
    Units: r.ind.units,
    ResistCount: r.apiResult.resists.length,
    APIvsIndep: r.pass ? "✓ match" : "✗ MISMATCH",
    "ΔPlates_vs_spec": r.platesDeltaVsSpec >= 0 ? `+${r.platesDeltaVsSpec}` : r.platesDeltaVsSpec,
    "ΔThresh_vs_spec": r.thresholdDeltaVsSpec >= 0 ? `+${r.thresholdDeltaVsSpec}` : r.thresholdDeltaVsSpec
  })));

  const failed = rows.filter(r => !r.pass);
  if (failed.length) {
    console.warn("FAILED preset(s):", failed.map(f => `${f.label}: ${JSON.stringify(f.checks)}`));
  } else {
    console.log("%c✓ All 8 presets: API output matches independent calculation",
      "color:#7cc77c");
  }

  // Show family breakdown per preset for tuning visibility
  console.group("Family breakdown per preset");
  for (const r of rows) {
    console.log(`${r.label}: ${Object.entries(r.ind.breakdown).map(([f,q]) => `${f}×${q}`).join(", ")}`);
  }
  console.groupEnd();

  console.groupEnd();

  // ── Chat card ──────────────────────────────────────────────────────────────
  const fmtDelta = (d) => {
    if (d === 0) return `<span style="opacity:0.5">±0</span>`;
    const color = Math.abs(d) > 5 ? "#e08a3a" : "#c9bc92";
    return `<span style="color:${color}">${d > 0 ? "+" : ""}${d}</span>`;
  };

  const fmtPass = (p, checks) => {
    if (p) return `<span style="color:#7cc77c">✓</span>`;
    const failed = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k.replace("Match",""));
    return `<span style="color:#e08a3a" data-tooltip="Failed: ${failed.join(', ')}">✗</span>`;
  };

  const fmtLB = (lb) => lb
    ? `<span style="color:#d9b96b">⚜ yes</span>`
    : `<span style="opacity:0.5">—</span>`;

  const fmtResists = (resists) => resists.length
    ? resists.map(r => `<span style="background:rgba(120,100,60,0.18); border:1px solid rgba(217,185,107,0.2); padding:0 4px; border-radius:2px; font-size:0.62rem; margin:0 2px;">${foundry.utils.escapeHTML(r)}</span>`).join("")
    : `<span style="opacity:0.4; font-style:italic">none</span>`;

  const allPass = rows.every(r => r.pass);

  const tableRows = rows.map(r => `
    <tr>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528;">${fmtPass(r.pass, r.checks)}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528;">${foundry.utils.escapeHTML(r.label)}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528; text-align:right; font-family:monospace">${r.apiResult.platesMax}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528; text-align:right; font-family:monospace; font-size:0.7rem">${fmtDelta(r.platesDeltaVsSpec)}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528; text-align:right; font-family:monospace">${r.apiResult.threshold}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528; text-align:right; font-family:monospace; font-size:0.7rem">${fmtDelta(r.thresholdDeltaVsSpec)}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528; text-align:center">${fmtLB(r.apiResult.loadBearing)}</td>
      <td style="padding:3px 6px; border-bottom:1px dotted #3a3528; text-align:right; font-family:monospace">${r.ind.units}</td>
    </tr>
    <tr>
      <td colspan="8" style="padding:0 6px 6px 6px; font-size:0.62rem; opacity:0.6;">
        ${fmtResists(r.apiResult.resists)}
      </td>
    </tr>
  `).join("");

  const summary = allPass
    ? `<div style="color:#7cc77c; font-size:0.78rem; margin-top:6px">✓ All 8 presets: API math is internally consistent (matches independent recalculation).</div>`
    : `<div style="color:#e08a3a; font-size:0.78rem; margin-top:6px">✗ ${rows.filter(r=>!r.pass).length} preset(s) mismatch — check console.</div>`;

  ChatMessage.create({
    speaker: { alias: "Structure Sanity" },
    whisper: [game.user.id],
    content: `
      <div style="border:1px solid #4a4538; padding:0.6rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
        <div style="font-size:0.85rem; color:#d9c47a; letter-spacing:0.1em; border-bottom:1px solid #3a3528; padding-bottom:4px; margin-bottom:6px;">
          STRUCTURE DERIVATION SANITY · Phase A
        </div>

        <table style="width:100%; border-collapse:collapse; font-size:0.74rem;">
          <thead>
            <tr style="opacity:0.6; font-size:0.6rem; letter-spacing:0.08em;">
              <th style="text-align:left; padding:3px 6px;"></th>
              <th style="text-align:left; padding:3px 6px;">Preset</th>
              <th style="text-align:right; padding:3px 6px;">Plates</th>
              <th style="text-align:right; padding:3px 6px;" data-tooltip="Delta vs spec §7 sketch values">Δ-spec</th>
              <th style="text-align:right; padding:3px 6px;">Threshold</th>
              <th style="text-align:right; padding:3px 6px;" data-tooltip="Delta vs spec §7 sketch values">Δ-spec</th>
              <th style="text-align:center; padding:3px 6px;">LB</th>
              <th style="text-align:right; padding:3px 6px;">Units</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        ${summary}

        <div style="margin-top:8px; padding-top:6px; border-top:1px solid #2a2620; font-size:0.7rem; opacity:0.65; line-height:1.45;">
          <b>Reading this:</b><br>
          • <b>Plates / Threshold</b> = live API output<br>
          • <b>Δ-spec</b> = delta vs the example numbers in spec §7 (which were preliminary ballparks; family table is now source of truth)<br>
          • <b>LB</b> = load-bearing (Sephirotic present → cannot reach Razed)<br>
          • <b>✓</b> = API output equals an independent re-derivation in this same script (math is self-consistent)<br>
          <br>
          Big Δ-spec values mean: (a) family coefficients may want tuning, or (b) the spec's example numbers were just sketches that the locked coefficients have superseded. Your call.
        </div>
      </div>
    `
  });

  ui.notifications?.info?.(`Sanity sheet: ${allPass ? "✓ all 8 internally consistent" : "✗ mismatches in console"}.`);
})();
