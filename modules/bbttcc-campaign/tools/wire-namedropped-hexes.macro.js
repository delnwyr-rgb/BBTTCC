/* wire-namedropped-hexes.macro.js — stamp on-enter beats on hexes the fiction
 * already references (2026-07-14, from the Turn-47 Campaign Atlas census)
 *
 * The census found 124 blank hexes; ten of them are already name-dropped in
 * beat/quest text. Four have a CANONICAL target — a beat that names that
 * exact hex:
 *
 *   Northreach Expanse b      → spark_geburah_northreach_b   (Lost Stone Statue #1)
 *   Inconvenient Mountains.q  → spark_geburah_mountains_q    (Lost Stone Statue #2)
 *   Inconvenient Mountains.o  → spark_geburah_mountains_o    (Lost Stone Statue #3)
 *   The Polygonal Grove       → enc_hidden_vault_approach    (Hidden Vault approach)
 *
 * The other six (Northreach Expanse a/c/d/e/f/g) merely share the "Northreach
 * Expanse" base name with statue #1's hex — no unique beat targets them. They
 * stay a WRITING backlog, listed in the report, not wired.
 *
 * MAPPING below is owner-editable — add/remove rows freely. Rules:
 *  · skips (with a warning) if the target beat doesn't exist
 *  · skips (with a note) if the hex already has a DIFFERENT onEnterBeatId —
 *    never overwrites existing wiring
 *  · idempotent; DRY_RUN default true. Hex flags are per-world documents:
 *    run on EACH instance.
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";

  // hexName (drawing text / territory flag name) → beat id
  const MAPPING = {
    "Northreach Expanse b":     "spark_geburah_northreach_b",
    "Inconvenient Mountains.q": "spark_geburah_mountains_q",
    "Inconvenient Mountains.o": "spark_geburah_mountains_o",
    "The Polygonal Grove":      "enc_hidden_vault_approach",
  };

  // Blank-but-name-dropped hexes with NO unique target — writing backlog only.
  const WRITING_BACKLOG = [
    "Northreach Expanse a", "Northreach Expanse c", "Northreach Expanse d",
    "Northreach Expanse e", "Northreach Expanse f", "Northreach Expanse g",
  ];

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── load campaign (to verify beat targets exist) ─────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const camps = typeof campsRaw === "string" ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beatIds = new Set((camp.beats || []).map(b => String(b?.id)));

  // ── index hexes by name across all scenes ─────────────────────────────────
  // NOTE: hex drawing TEXT uses non-breaking spaces (U+00A0) between words
  // while the territory flag name uses regular spaces — collapse ALL
  // whitespace before comparing or nothing matches.
  const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const hexByName = new Map();
  for (const scene of game.scenes) {
    for (const dr of scene.drawings.contents) {
      const f = dr.flags?.["bbttcc-territory"];
      if (!f || !(f.isHex === true || f.kind === "territory-hex" || f.hexId)) continue;
      const nm = norm(dr.text || f.name);
      if (nm && !hexByName.has(nm)) hexByName.set(nm, { dr, scene });
    }
  }

  const report = [];
  let changes = 0;

  for (const [hexName, beatId] of Object.entries(MAPPING)) {
    if (!beatIds.has(beatId)) { report.push(`⚠ SKIP ${hexName}: target beat "${beatId}" not found in campaign`); continue; }
    const hit = hexByName.get(norm(hexName));
    if (!hit) { report.push(`⚠ SKIP ${hexName}: no hex drawing with that name on any scene`); continue; }
    const cur = hit.dr.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId;
    if (cur === beatId) { report.push(`· ok (already) ${hexName} → ${beatId}`); continue; }
    if (cur) { report.push(`⚠ SKIP ${hexName}: already wired to "${cur}" — not overwriting`); continue; }
    changes++;
    report.push(`⚡ wire ${hexName} [${hit.scene.name}] → ${beatId}`);
    if (!DRY_RUN) await hit.dr.update({ "flags.bbttcc-territory.campaign.onEnterBeatId": beatId });
  }

  const backlogNotes = WRITING_BACKLOG.map(n => {
    const hit = hexByName.get(norm(n));
    const cur = hit?.dr.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId;
    return `  ○ ${n}${hit ? "" : " (hex not found!)"}${cur ? ` — since wired to ${cur}` : " — still blank, needs authored content"}`;
  });

  console.log(
    `[wire-namedropped-hexes] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n") +
    `\n  WRITING BACKLOG (name-dropped, no unique beat — author these):\n` + backlogNotes.join("\n")
  );
  ui.notifications.info(`${DRY_RUN ? "DRY RUN" : "APPLIED"}: ${changes} hex wiring(s) — see console for the writing backlog.`);
})();
