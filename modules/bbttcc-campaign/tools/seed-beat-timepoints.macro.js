/* seed-beat-timepoints.macro.js — Turn Ledger P2: timePoints backfill by class
 * defaults (2026-07-08, TURN-LEDGER-DESIGN-2026-07-07.md §2 + §4 P2)
 *
 * One World Turn = a 30-day budget; beats debit it via timePoints (the sink,
 * world.addTime, is live as of 2026-07-08). This seeder stamps timePoints on
 * the existing corpus by CLASS DEFAULTS so the backfill is a seeder, not a
 * hand-audit:
 *   · conversation / hub / invite / routing leaf .......... 0  (no stamp — inside a visit)
 *   · travel-table encounter (enc_*) ...................... 0  (no stamp — the leg already paid)
 *   · outcome / resolution beat ........................... 0  (no stamp — the visit's curtain call)
 *   · site visit / skill scene (scene-linked ENTRY beat) ... 0.5 (half a day)
 *   · rite / set-piece / cinematic ........................ 1
 *   · raid ................................................ 2
 *   · OVERRIDES map — authored exceptions win over every rule
 *
 * ZERO-cost classes are left UNSTAMPED (the runtime default is already 0), so
 * the write set is small and the beat editor stays uncluttered. Beats with an
 * authored timePoints or timeScale are NEVER touched.
 *
 * DRY_RUN default true. The DRY_RUN report is the point: review the class
 * table (console.table), move misclassified beats into OVERRIDES, re-run.
 * Backs up the campaigns setting to a downloaded JSON before writing.
 * Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── authored exceptions (beatId -> timePoints) — extend during review ──────
  // The fiction overrides the class: the Summit takes days, a confrontation
  // takes an evening. Set 0 here to force-zero a beat a rule would price.
  const OVERRIDES = {
    // Valhaulan Seal set-pieces — a day each at the mountain's throat.
    seal_restore: 1, seal_redirect: 1, seal_break: 1,
    // Tifaret merge communion — therapy-with-a-forest is a full day.
    forest_of_tifaret_harmonious_ending: 1,
    // Khezek upper galleries — a ridge observation trip, half a day out.
    khezek_upper_galleries: 0.5,
    // Fates & Destinies opener slides — character incarnation, outside time.
    // (Cinematics of the cold open cost nothing; the month starts after.)
    // Gloomgill exam terminals are conversations — rule already zeroes them.
  };

  // ── classification rules (first match wins) ────────────────────────────────
  const RULES = [
    { key: "encounter",   pts: 0,   why: "travel-table encounter — the leg already paid",
      test: (b) => /^enc_/.test(b.id || "") },
    { key: "conversation",pts: 0,   why: "speaker beat — happens inside a visit",
      test: (b) => !!String(b.speakerActorId || "").trim() },
    { key: "routing-leaf",pts: 0,   why: "dialogueOffer:false routing/Q&A leaf",
      test: (b) => b.dialogueOffer === false },
    { key: "hub/menu",    pts: 0,   why: "hub / menu / acceptance / invite surface",
      test: (b) => /(accept|menu|_hub\b|hub_|invite)/.test(String(b.id || "").toLowerCase()) },
    { key: "resolution",  pts: 0,   why: "outcome beat — the visit's curtain call",
      test: (b) => b.questRole === "resolution" || !!b.memoryText },
    { key: "raid",        pts: 2,   why: "raid — days of muster and smoke",
      test: (b) => /raid|siege|assault/.test(`${b.id || ""} ${b.label || ""}`.toLowerCase()) },
    { key: "set-piece",   pts: 1,   why: "rite / set-piece / cinematic — a full day",
      test: (b) => /rite|ritual|summit|seal_|merge|communion|finale|incarnat/.test(`${b.id || ""} ${b.label || ""}`.toLowerCase()) },
    { key: "site-visit",  pts: 0.5, why: "scene-linked entry beat — half a day on site",
      test: (b) => !!String(b.sceneId || "").trim()
        && (b.questRole === "start" || /(main_scene|_intro|_approach|_visit|_scene|_arrival)$/.test(String(b.id || ""))) },
    { key: "scene-other", pts: 0,   why: "scene-linked but not the entry — inside the visit (REVIEW: promote to OVERRIDES if it's its own trip)",
      test: (b) => !!String(b.sceneId || "").trim() },
    { key: "unclassified",pts: 0,   why: "no signal — defaults to free (REVIEW)",
      test: () => true },
  ];

  // ── load ────────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);

  const rows = [];
  const counts = {};
  let stamps = 0, skippedAuthored = 0, total = 0;

  for (const [cid, camp] of Object.entries(camps || {})) {
    for (const b of (camp?.beats || [])) {
      if (!b || !b.id) continue;
      total++;

      // Respect authored time — never overwrite a human's call.
      const hasAuthoredPoints = b.timePoints != null && b.timePoints !== "" && Number(b.timePoints) !== 0;
      const hasAuthoredScale = !!String(b.timeScale || "").trim();
      if (hasAuthoredPoints || hasAuthoredScale) {
        skippedAuthored++;
        rows.push({ campaign: cid, id: b.id, class: "authored", pts: b.timePoints ?? `scale:${b.timeScale}`, action: "skip (authored)" });
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

      if (pts > 0) {
        rows.push({ campaign: cid, id: b.id, class: cls, pts, action: DRY_RUN ? "WOULD stamp" : "stamp" });
        if (!DRY_RUN) { b.timePoints = pts; }
        stamps++;
      } else {
        rows.push({ campaign: cid, id: b.id, class: cls, pts: 0, action: "free (no stamp)" });
      }
    }
  }

  // ── report ──────────────────────────────────────────────────────────────────
  console.log(`[seed-beat-timepoints] ${total} beats · ${stamps} priced · ${skippedAuthored} authored (untouched)`);
  console.log("[seed-beat-timepoints] class counts:", counts);
  console.table(rows.filter(r => r.pts !== 0 && r.pts !== "0"));
  console.log("[seed-beat-timepoints] REVIEW candidates (scene-other / unclassified):");
  console.table(rows.filter(r => r.class === "scene-other" || r.class === "unclassified"));

  if (DRY_RUN) {
    ui.notifications.info(`Turn Ledger backfill DRY RUN: ${stamps} of ${total} beats would be priced (see console). Review, extend OVERRIDES, set DRY_RUN=false.`);
    return;
  }

  // ── backup + write ──────────────────────────────────────────────────────────
  try {
    saveDataToFile(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
      `backup-campaigns-before-timepoints-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Turn Ledger backfill APPLIED: ${stamps} beats priced across ${Object.keys(camps || {}).length} campaign(s).`);
})();
