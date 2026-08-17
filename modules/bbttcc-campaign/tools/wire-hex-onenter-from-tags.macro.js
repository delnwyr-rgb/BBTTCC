/* wire-hex-onenter-from-tags.macro.js — give hexes their auto-launch beat
 * 2026-08-17.
 *
 * WHY: beats already declare which hex they belong to — they carry a
 * `hex.<slug>` tag (e.g. `hex.northreach_expanse_b` on the first Lost Stone
 * Statue). Nothing points back the other way, so walking into the hex fires
 * nothing and the content is only reachable if the GM knows it exists.
 *
 * THE RULE (derived from the live corpus, not assumed):
 *   · a hex claimed by exactly ONE tagged beat  → that beat is the entry.
 *   · a hex claimed by SEVERAL (the Coastal Triangle tags its whole chain)
 *     → the one with questRole "start". Every multi-claimant hex in the
 *       corpus has exactly one, and it is always the first of the chain.
 *   · anything else → REPORTED AND SKIPPED. It never guesses.
 *
 * ⚠ NEVER OVERWRITES an existing onEnterBeatId. Several hexes are already
 * wired to their own `map_*_intro` beats rather than to the quest chain;
 * those are reported as conflicts for you to rule on, and left untouched.
 * (A likely resolution is to let the map intro CHAIN INTO the quest beat
 * rather than replacing it — that's an authoring call, not a script's.)
 *
 * DRY_RUN default true. Idempotent. Read-only against beats; only ever
 * writes flags.bbttcc-territory.campaign.onEnterBeatId on Drawings. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS   = "bbttcc-campaign";
  const TERR = "bbttcc-territory";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const report = [];
  let changes = 0;

  // ── the hexes ─────────────────────────────────────────────────────────────
  const ALL = game.scenes.contents.flatMap(sc =>
    (sc.drawings?.contents || []).filter(d => d.flags?.[TERR]).map(d => ({
      doc: d,
      label: d.text || d.flags[TERR]?.name || "(unnamed)",
      key: norm(d.text || d.flags[TERR]?.name),
      scene: sc.name,
      onEnter: d.flags?.[TERR]?.campaign?.onEnterBeatId || null
    })));
  // 🪤 names carry NBSP and use both "Foo.b" and "Foo b" forms, and singular
  // sites carry a leading "The" the tag slug omits — so never exact-only.
  const findHex = (slug) => {
    const want = norm(slug);
    for (const test of [
      h => h.key === want,
      h => h.key.startsWith(want) || want.startsWith(h.key),
      h => h.key.includes(want) || want.includes(h.key)
    ]) {
      const hits = ALL.filter(test);
      if (hits.length === 1) return { hex: hits[0], amb: null };
      if (hits.length > 1)   return { hex: null, amb: hits };
    }
    return { hex: null, amb: null };
  };

  // ── the beats ─────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const camps = typeof campsRaw === "string" ? JSON.parse(campsRaw) : campsRaw;
  const claims = new Map();   // slug -> [{id,label,role}]
  for (const camp of Object.values(camps || {})) {
    for (const b of (camp?.beats || [])) {
      const tags = String(b?.tags || "").split(/[,\s]+/).filter(Boolean);
      for (const t of tags) {
        if (!/^hex\./i.test(t)) continue;
        const slug = t.slice(4);
        if (!claims.has(slug)) claims.set(slug, []);
        claims.get(slug).push({
          id: b.id,
          label: b.label || b.id,
          role: String(b.questRole || "").trim().toLowerCase()
        });
      }
    }
  }
  report.push(`🔎 ${claims.size} hex slug(s) claimed across the corpus`);

  // ── decide + wire ─────────────────────────────────────────────────────────
  for (const [slug, beats] of [...claims.entries()].sort()) {
    let entry = null;
    if (beats.length === 1) entry = beats[0];
    else {
      const starts = beats.filter(b => b.role === "start");
      if (starts.length === 1) entry = starts[0];
      else {
        report.push(`⚠ ${slug} — ${beats.length} beats claim it and ${starts.length} are role=start. SKIPPED (mark exactly one as start): ${beats.map(b => b.id).join(", ")}`);
        continue;
      }
    }

    const { hex, amb } = findHex(slug);
    if (amb)  { report.push(`⚠ ${slug} — matches ${amb.length} hexes, SKIPPED: ${amb.map(h => `${h.label} [${h.scene}]`).join(" · ")}`); continue; }
    if (!hex) { report.push(`⚠ ${slug} — no hex found on any scene, SKIPPED (beat "${entry.label}" has nowhere to live)`); continue; }

    if (hex.onEnter === entry.id) { report.push(`· ok ${hex.label} → ${entry.id} (already wired)`); continue; }
    if (hex.onEnter) {
      report.push(`🛑 CONFLICT ${hex.label} already fires '${hex.onEnter}' — NOT overwritten. Tagged entry would be '${entry.id}' ("${entry.label}"). Chain them by hand if both should run.`);
      continue;
    }
    changes++;
    report.push(`⚡ ${hex.label} [${hex.scene}] → ${entry.id}  ("${entry.label}")`);
    if (!DRY_RUN) await hex.doc.update({ [`flags.${TERR}.campaign.onEnterBeatId`]: entry.id });
  }

  console.log(`[wire-hex-onenter-from-tags] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Hex on-enter wiring ${DRY_RUN ? "DRY RUN" : "APPLIED"}: ${changes} change(s) (see console).`);
})();
