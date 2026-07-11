/* seed-beat-timepoints.macro.js — Turn Ledger P2: timePoints backfill, v2
 * (2026-07-08, TURN-LEDGER-DESIGN-2026-07-07.md §2 + §4 P2)
 *
 * v2 REWRITE — the v1 run revealed the corpus truth: the beat editor stamped
 * timeScale "scene" on ~502 beats and "leg" on ~73 as a FORM DEFAULT (never
 * human intent). v1's "respect authored timeScale" guard therefore skipped
 * everything (0 stamped), while the live runtime charged 1 day per beat
 * firing. v2 fixes both:
 *   · the guard respects only an existing explicit timePoints (null-check),
 *     treating the editor-default timeScale as noise;
 *   · EVERY beat gets an EXPLICIT timePoints stamp — including 0 — because
 *     the runtime now honors explicit zero over the timeScale mapping
 *     (module.js _timePointsForBeat, fixed 2026-07-08).
 *
 * CLASS DEFAULTS (days):
 *   · conversation / hub / routing leaf / resolution ...... 0 (inside a visit)
 *   · travel-table encounter (enc_*) ...................... 0 (the leg already paid)
 *   · raid ENTRY/OPEN beat ................................ 2 (days of muster and smoke)
 *   · raid follow-up / outcome / rewards .................. 0 (the entry paid for the raid)
 *   · rite / set-piece / cinematic ........................ 1
 *   · site visit / skill scene (scene-linked ENTRY beat) .. 0.5
 *   · OVERRIDES map — authored exceptions win over every rule
 *
 * DRY_RUN default true: review the console tables, extend OVERRIDES, flip.
 * Backs up the campaigns setting to a downloaded JSON before writing.
 * Idempotent: re-runs skip beats that already carry an explicit timePoints.
 * Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── authored exceptions (beatId -> timePoints) — extend during review ──────
  const OVERRIDES = {
    // Fates & Destinies slide 1 — incarnation happens OUTSIDE time (owner
    // canon: the month starts after the cold open). Slides 2-10 are already
    // free by rule; slide 1 would otherwise price as a site visit.
    fates_and_destinies_1: 0,
    // Khezek upper galleries — a ridge observation trip, half a day out.
    khezek_upper_galleries: 0.5,
    // The Valhaulan Seal set-pieces price at 1d via the set-piece rule
    // (cinematic + one ending fires ≈ 2 days at the mountain's throat).
  };

  // ── classification rules (first match wins) ────────────────────────────────
  const raidish = (b) => /raid|siege|assault/.test(`${b.id || ""} ${b.label || ""}`.toLowerCase());
  const RULES = [
    { key: "encounter",    pts: 0,   test: (b) => /^enc_/.test(b.id || "") },
    { key: "conversation", pts: 0,   test: (b) => !!String(b.speakerActorId || "").trim() },
    { key: "routing-leaf", pts: 0,   test: (b) => b.dialogueOffer === false },
    { key: "hub/menu",     pts: 0,   test: (b) => /(accept|menu|_hub\b|hub_|invite)/.test(String(b.id || "").toLowerCase()) },
    { key: "resolution",   pts: 0,   test: (b) => b.questRole === "resolution" || !!b.memoryText },
    { key: "raid-entry",   pts: 2,   test: (b) => raidish(b) && /(_entry|_open)$/.test(String(b.id || "")) },
    { key: "raid-follow",  pts: 0,   test: (b) => raidish(b) },   // phases/outcomes/rewards — the entry paid
    { key: "set-piece",    pts: 1,   test: (b) => /rite|ritual|summit|seal_|merge|communion|finale|incarnat/.test(`${b.id || ""} ${b.label || ""}`.toLowerCase()) },
    { key: "site-visit",   pts: 0.5, test: (b) => !!String(b.sceneId || "").trim()
        && (b.questRole === "start" || /(main_scene|_intro|_approach|_visit|_scene|_arrival)$/.test(String(b.id || ""))) },
    { key: "scene-other",  pts: 0,   test: (b) => !!String(b.sceneId || "").trim() },
    { key: "unclassified", pts: 0,   test: () => true },
  ];

  // ── load ────────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);

  const rows = [];
  const counts = {};
  let stamps = 0, priced = 0, skippedAuthored = 0, total = 0;

  for (const [cid, camp] of Object.entries(camps || {})) {
    for (const b of (camp?.beats || [])) {
      if (!b || !b.id) continue;
      total++;

      // Respect an EXPLICIT existing timePoints only (a human's or a prior
      // run's). The editor-default timeScale is noise, not authorship.
      if (b.timePoints != null && b.timePoints !== "") {
        skippedAuthored++;
        rows.push({ campaign: cid, id: b.id, class: "authored", pts: b.timePoints, action: "skip (explicit timePoints)" });
        continue;
      }

      let cls, pts;
      if (Object.prototype.hasOwnProperty.call(OVERRIDES, b.id)) {
        cls = "override"; pts = OVERRIDES[b.id];
      } else {
        const rule = RULES.find(r => { try { return r.test(b); } catch (_e) { return false; } });
        cls = rule.key; pts = rule.pts;
      }
      counts[cls] = (counts[cls] || 0) + 1;

      // EVERY beat gets an explicit stamp — 0 silences the timeScale noise.
      rows.push({ campaign: cid, id: b.id, class: cls, pts, action: DRY_RUN ? "WOULD stamp" : "stamp" });
      if (!DRY_RUN) { b.timePoints = pts; }
      stamps++;
      if (pts > 0) priced++;
    }
  }

  // ── report ──────────────────────────────────────────────────────────────────
  console.log(`[seed-beat-timepoints v2] ${total} beats · ${stamps} stamped (${priced} priced > 0, rest explicit 0) · ${skippedAuthored} already-explicit (untouched)`);
  console.log("[seed-beat-timepoints v2] class counts:", counts);
  console.log("[seed-beat-timepoints v2] PRICED (nonzero):");
  console.table(rows.filter(r => Number(r.pts) > 0));
  console.log("[seed-beat-timepoints v2] REVIEW candidates (scene-other / unclassified — stamped 0):");
  console.table(rows.filter(r => r.class === "scene-other" || r.class === "unclassified"));

  if (DRY_RUN) {
    ui.notifications.info(`Turn Ledger backfill v2 DRY RUN: ${stamps} of ${total} beats would get explicit timePoints (${priced} priced). Review console, extend OVERRIDES, set DRY_RUN=false.`);
    return;
  }

  // ── backup + write ──────────────────────────────────────────────────────────
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;   // v13 namespaced; global gone in v15
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-timepoints-v2-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Turn Ledger backfill v2 APPLIED: ${stamps} beats stamped (${priced} priced) across ${Object.keys(camps || {}).length} campaign(s).`);
})();
