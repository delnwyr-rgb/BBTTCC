/**
 * repair-onboarded-faction-parity.macro.js — GM console/macro. DRY_RUN=true by default.
 *
 * Brings an onboarding-founded faction up to wizard-package parity. The
 * onboarding founding op (incarnation-forge.js) seeded only name/roster/creed
 * until 2026-09-10; the wizard's standard package also seeds explicit opCaps and
 * morale/loyalty 25. Two live consequences (Act 2 playtest, The Errata Society
 * vs Sweet Release with identical moves):
 *   • turn-driver read the raw opCaps flag and fell back to the BANK when it was
 *     missing → logistics capacity 3 instead of the tier band 7 → STRAINED 1.33
 *     vs 0.67 stable. (turn-driver now derives the band itself, but explicit
 *     caps are what every other faction carries — parity is still right.)
 *   • the sheet's first save wrote morale/loyalty 0 → +1 drift a turn → "2%".
 *
 * What it does, per target faction:
 *   opCaps   — if MISSING: per bucket max(tier band, what is banked) — never
 *              confiscates (the tier-set lowering rule). Present caps untouched.
 *   morale / loyalty — if missing or below RESEED_TRACKS_BELOW: set to TRACK_SEED
 *              (25, the package value). An onboarding faction never received the
 *              seed, so a low value is the unseeded 0 plus ±1 drift a turn (Errata
 *              read 2/2 by turn 2). Set RESEED_TRACKS_BELOW = 1 to touch only
 *              zeros. Read the DRY_RUN table before flipping the switch.
 *   War Log  — one milestone entry naming what changed.
 *
 * Targets: NAMES if non-empty, else every faction flagged
 * bbttcc-onboarding.foundedViaOnboarding. Usage: paste into the GM console,
 * read the table, set DRY_RUN=false, run again.
 */
(async () => {
  const DRY_RUN = true;                       // ← flip to false to write
  const NAMES = [];                           // ← e.g. ["The Errata Society"]; empty = all onboarding-founded
  const TRACK_SEED = 25;
  const RESEED_TRACKS_BELOW = 25;             // ← lift morale/loyalty below this to TRACK_SEED (1 = zeros only)

  const MOD = "bbttcc-factions", ONB = "bbttcc-onboarding";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const BAND = [50, 70, 90, 110, 130];        // T0..T4 marks per bucket (1 OP = 10 marks)
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const targets = game.actors.filter(a => a.flags?.[MOD]?.isFaction === true
    && (NAMES.length ? NAMES.includes(a.name) : a.flags?.[ONB]?.foundedViaOnboarding === true));
  if (!targets.length) return ui.notifications.warn("No target factions (check NAMES / foundedViaOnboarding).");

  const rows = [];
  for (const a of targets) {
    const f = foundry.utils.duplicate(a.flags?.[MOD] ?? {});
    let tier = num(f.tier, -1);
    if (tier < 0) tier = num(f.progression?.victory?.tierFromBadge, 0);
    tier = Math.max(0, Math.min(4, Math.floor(tier)));
    const band = BAND[tier];
    const updates = {}; const notes = [];

    if (!f.opCaps || typeof f.opCaps !== "object") {
      const bank = f.opBank || {};
      const caps = Object.fromEntries(OP_KEYS.map(k => [k, Math.max(band, Math.ceil(Math.max(0, num(bank[k]))))]));
      updates[`flags.${MOD}.opCaps`] = caps;
      notes.push(`opCaps seeded at T${tier} band (${band} marks/bucket, floored to what is banked)`);
    }
    for (const t of ["morale", "loyalty"]) {
      const cur = f[t];
      if (cur === undefined || cur === null || num(cur, 0) < RESEED_TRACKS_BELOW) {
        updates[`flags.${MOD}.${t}`] = TRACK_SEED;
        notes.push(`${t} ${cur ?? "missing"} → ${TRACK_SEED}`);
      }
    }

    rows.push({ faction: a.name, tier, opCaps: f.opCaps ? "present" : "MISSING", morale: f.morale ?? "missing", loyalty: f.loyalty ?? "missing", action: notes.join(" · ") || "nothing to do" });
    if (!notes.length || DRY_RUN) continue;

    const warLogs = (Array.isArray(f.warLogs) ? f.warLogs : []).slice();
    const now = Date.now();
    warLogs.push({ ts: now, date: new Date(now).toLocaleString(), type: "milestone", activity: "parity_repair",
      summary: `Onboarding parity repair: ${notes.join("; ")}.` });
    updates[`flags.${MOD}.warLogs`] = warLogs;
    await a.update(updates, { diff: true, recursive: true });
  }
  console.table(rows);
  ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}parity repair: ${rows.length} faction(s) inspected${DRY_RUN ? " (nothing written; see console table)" : ""}.`);
})();
