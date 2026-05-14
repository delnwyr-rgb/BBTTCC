/* audit-maneuvers-fire-mode.macro.js
 *
 * Read-only audit. Reads game.bbttcc.api.raid.EFFECTS, classifies every
 * maneuver into a fireMode ∈ {"pre-roll", "anytime", "post-commit"} via
 * heuristic keyword matching on its effect text, and posts a sortable
 * report to chat + console.table.
 *
 * Does NOT mutate EFFECTS, the JSON catalog, or compat-bridge. Output is
 * a downloadable JSON payload the GM can review before any tagging pass.
 *
 * fireMode semantics:
 *   pre-roll    → must fire BEFORE strategic dice commit (modifies the roll)
 *   anytime     → standalone state change, no dice coupling
 *   post-commit → triggered by round outcome (on success / next round / etc.)
 */

(() => {
  const raid = game.bbttcc?.api?.raid;
  const EFFECTS = raid?.EFFECTS;
  if (!EFFECTS) {
    ui.notifications.error("game.bbttcc.api.raid.EFFECTS not available — is bbttcc-raid loaded?");
    return;
  }

  // ─── Classifier ──────────────────────────────────────────────────────
  const POST_COMMIT_PATTERNS = [
    /\bon\s+success\b/i,
    /\bon\s+victory\b/i,
    /\bon\s+fail(ure)?\b/i,
    /\bafter\s+(the\s+)?(round|victory|combat|raid)\b/i,
    /\bnext\s+(round|turn)\b/i,
    /\brequires?\s+(victory|success)/i,
    /\bif\s+(you\s+)?win\b/i,
    /\bif\s+the\s+(attacker|defender)\s+(wins|succeeds)/i,
    /\bgain\s+initiative\s+for\s+next/i,
    /\bre-?run\s+last\s+round/i,
    /\brepeat\s+last\s+round/i,
  ];

  const PRE_ROLL_PATTERNS = [
    /\bthis\s+round\b/i,
    /\bthis\s+turn\b/i,
    /\breroll\b/i,
    /\b(dis)?advantage\b/i,
    /\bauto-?win\b/i,
    /\bnullify\b/i,
    /\breflect\b/i,
    /\bcancel\s+enemy\b/i,
    /\bnegate\b/i,
    /\bignore\s+(one|first|.{0,15}?(modifier|loss|effect|circumstance))/i,
    /[+\-]\d+\s+.{0,30}?(attack|defense|defence|roll|dc|morale|guard|evasion)/i,
    /\bnext\s+(attack|defense|defence|roll)/i,
    /\bdefender\s+dc\b/i,
    /\bopposed\s+roll\b/i,
    /\bapply\s+.{0,20}twice\b/i,
    /\breduce\s+(incoming\s+)?damage\b/i,
    /\boppon(ents?|ent's)\s+roll\b/i,
    /\bborrow\s+\+?\d*\s*enemy\s+op\b/i,
    /\bbefore\s+rolling\b/i,
  ];

  function classify(text) {
    const t = String(text || "").trim();
    if (!t) return { fireMode: "needs-text", confidence: 0.0, reason: "no effect text in registry" };
    for (const p of POST_COMMIT_PATTERNS) if (p.test(t)) return { fireMode: "post-commit", confidence: 0.9, reason: `matched ${p}` };
    for (const p of PRE_ROLL_PATTERNS)    if (p.test(t)) return { fireMode: "pre-roll",    confidence: 0.85, reason: `matched ${p}` };
    return { fireMode: "anytime", confidence: 0.5, reason: "default (no keyword match)" };
  }

  // ─── Walk the registry ───────────────────────────────────────────────
  const rows = [];
  for (const [key, eff] of Object.entries(EFFECTS)) {
    if (!eff || eff.kind !== "maneuver") continue;
    const text = String(eff.text || eff.effects?.text || "");
    const c = classify(text);
    const currentFireMode = eff.fireMode || null;
    rows.push({
      key,
      label: String(eff.label || key),
      tier:  Number(eff.tier || 1),
      currentFireMode,
      inferredFireMode: c.fireMode,
      tagStatus: !currentFireMode ? "untagged"
               : currentFireMode === c.fireMode ? "tagged-match"
               : "tagged-differs",
      confidence: c.confidence,
      reason: c.reason,
      text,
    });
  }
  rows.sort((a, b) => (a.tier - b.tier) || a.label.localeCompare(b.label));

  // ─── Tally ───────────────────────────────────────────────────────────
  const tally = { "pre-roll": 0, "anytime": 0, "post-commit": 0, "needs-text": 0, total: rows.length };
  for (const r of rows) tally[r.inferredFireMode] = (tally[r.inferredFireMode] || 0) + 1;

  const tagTally = { tagged: 0, untagged: 0, differs: 0 };
  for (const r of rows) {
    if (r.tagStatus === "tagged-match")   tagTally.tagged++;
    else if (r.tagStatus === "tagged-differs") tagTally.differs++;
    else tagTally.untagged++;
  }

  // ─── Console table (sortable, full visibility) ───────────────────────
  console.table(rows.map(r => ({
    tier: r.tier,
    label: r.label,
    inferred: r.inferredFireMode,
    conf: r.confidence,
    text: r.text.slice(0, 80),
  })));
  console.log("[maneuver-fire-mode-audit] tally:", tally);
  console.log("[maneuver-fire-mode-audit] full rows (use copy-as-json):", rows);

  // ─── JSON payload (for GM review / future tag merge) ─────────────────
  const payload = {
    generatedAt: new Date().toISOString(),
    tally,
    rules: {
      "post-commit": POST_COMMIT_PATTERNS.map(p => p.source),
      "pre-roll":    PRE_ROLL_PATTERNS.map(p => p.source),
      "anytime":     "default (no match)",
    },
    tagTally,
    maneuvers: rows.map(r => ({
      key: r.key, label: r.label, tier: r.tier,
      currentFireMode: r.currentFireMode,
      inferredFireMode: r.inferredFireMode,
      tagStatus: r.tagStatus,
      confidence: r.confidence,
      reason: r.reason,
      text: r.text,
    })),
  };
  // Stash on globalThis so user can re-grab from console / re-export
  globalThis._ftLastManeuverAudit = payload;

  // Immediately trigger a download via Foundry's helper (bypasses chat sanitizer)
  try {
    saveDataToFile(JSON.stringify(payload, null, 2), "application/json", `maneuvers-fire-mode-${Date.now()}.json`);
  } catch (err) {
    console.warn("[maneuver-fire-mode-audit] saveDataToFile failed:", err);
    console.info("[maneuver-fire-mode-audit] copy from console: copy(JSON.stringify(_ftLastManeuverAudit, null, 2))");
  }

  // ─── Chat card ───────────────────────────────────────────────────────
  const groupedHtml = ["pre-roll", "anytime", "post-commit", "needs-text"].map(mode => {
    const subset = rows.filter(r => r.inferredFireMode === mode);
    if (!subset.length) return "";
    const items = subset.map(r => {
      const conf = Math.round(r.confidence * 100);
      const confColor = conf >= 80 ? "#5a8" : conf >= 60 ? "#c93" : "#a55";
      const tagBadge = r.tagStatus === "tagged-match"   ? '<span style="color:#5a8;" title="tagged in EFFECTS, matches inference">✓ tagged</span>'
                     : r.tagStatus === "tagged-differs" ? `<span style="color:#fa3;" title="tagged as ${r.currentFireMode}, differs from inference">⚠ tagged as ${r.currentFireMode}</span>`
                     : '<span style="color:#888;" title="not yet tagged in EFFECTS — falls through to runtime classifier">○ untagged</span>';
      return `<li style="margin:1px 0;"><b>T${r.tier}</b> ${r.label} <span style="color:${confColor};font-size:.85em;">${conf}%</span> ${tagBadge}<br><i style="opacity:.75;font-size:.85em;">${r.text || "—"}</i></li>`;
    }).join("");
    return `<details ${mode === "pre-roll" ? "open" : ""} style="margin:.5em 0;">
      <summary><b>${mode}</b> — ${subset.length} maneuver${subset.length === 1 ? "" : "s"}</summary>
      <ul style="margin:.25em 0 .25em 1em;padding:0;list-style:disc;">${items}</ul>
    </details>`;
  }).join("");

  const html = `<div class="bbttcc-card">
    <h3 style="margin:0 0 .25em 0;">Maneuver Fire-Mode Audit</h3>
    <div style="opacity:.8;font-size:.9em;margin-bottom:.25em;">
      <b>Inference</b>: ${tally.total} total · ${tally["pre-roll"]} pre-roll · ${tally["anytime"]} anytime · ${tally["post-commit"]} post-commit · ${tally["needs-text"]} needs-text
    </div>
    <div style="opacity:.85;font-size:.9em;margin-bottom:.5em;padding:.25em .5em;background:rgba(0,0,0,.15);border-radius:3px;">
      <b>Tag status</b>: <span style="color:#5a8;">✓ ${tagTally.tagged} tagged</span> · <span style="color:#888;">○ ${tagTally.untagged} untagged</span>${tagTally.differs ? ` · <span style="color:#fa3;">⚠ ${tagTally.differs} differs</span>` : ""}
    </div>
    ${groupedHtml}
    <div style="margin-top:.5em;padding-top:.5em;border-top:1px solid #555;font-size:.85em;opacity:.85;">
      JSON auto-downloaded · also at <code>globalThis._ftLastManeuverAudit</code> · full row dump in console
    </div>
  </div>`;
  ChatMessage.create({ whisper: [game.user.id], content: html, flags: { core: { canPopout: true } } });

  ui.notifications.info(`Audited ${tally.total} maneuvers — see chat + console.`);
})();
