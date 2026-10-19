/* patch-first-signature-2026-10-18.macro.js — TEACHING BEAT 8: YOUR SIGNATURE (Alpha Cut, ruling 14, Dave 2026-10-17:
 *  "the Manifestation Engine, for players, should be ONLY for signature effects, and you get one per tier. They
 *  level up with you. That provides guidance and context and rails.")
 *
 *  Why here: the first night in the Absolutely Reliable is where the party already reads the lease and sleeps —
 *  the one quiet moment in Act 1. The card says what a Signature IS (the effect only you could have made), that
 *  there is one slot per tier and that it grows with you, and points at the ✦ slot on the Core tab. No mechanics
 *  fire: making it is the player's act, in the Manifestation Engine, from the slot.
 *
 *   WIRED ag_first_night_soma_break  + "Sit with the thing only you can do." → ag_first_signature (hidden once read)
 *   NEW   ag_first_signature          narration · "Sleep. Tomorrow, the land." → hum_quiet_tent · "Read the paperwork
 *                                     on the galley table." → reliable_the_lease (if not yet read)
 *
 *  Idempotent (id / label guards); DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [FIRST-SIGNATURE-2026-10-18]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const SIG = "ag_first_signature", NIGHT = "ag_first_night_soma_break", SLEEP = "hum_quiet_tent", LEASE = "reliable_the_lease";
  const night = byId.get(NIGHT);
  if (!night) return ui.notifications.error("ag_first_night_soma_break not found.");
  if (!byId.get(SLEEP)) report.push(`⚠ ${SLEEP}: NOT FOUND — the Sleep row will dead-end`);

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const lbl = (c) => String(c?.label || "").trim().toLowerCase();

  const SIG_DESC =
    "The galley is quiet. Everyone else has found a bunk. You have your hands in front of you, and the thing that lives in them.\n\n" +
    "<b>This is your Signature.</b> Every steward can do one thing nobody else could have made — a working, a form, a weapon that is yours the way your handwriting is yours. " +
    "You get <b>one per tier</b>. The first one is open now. It <b>grows with you</b>: when you cross into a new tier, it rises with you, and a second slot opens beside it.\n\n" +
    "Everything else you can do comes from your Path. This one comes from you.\n\n" +
    "<i>On your sheet, Core tab, under Manifestations: the ✦ slot. Take your time with it. The land will still be there in the morning.</i>";
  const SIG_MEMORY = "Sat with the Signature — the one effect only you could have made. One slot per tier; it grows with you.";

  /* ── 1. the card ────────────────────────────────────────────────────────── */
  {
    const want = {
      id: SIG, label: "The Absolutely Reliable — Your Signature", type: "narration",
      description: SIG_DESC, memoryText: SIG_MEMORY,
      tags: "allesh_gilliam prologue spine teaching signature",
      questId: night.questId || "", questStep: (Number(night.questStep) || 0) + 1, timePoints: 0,
      sceneId: night.sceneId || "", scene: night.scene ? foundry.utils.deepClone(night.scene) : { uuid: "" },
      worldEffects: WE(),
      inject: { repeatable: true, evergreen: false, requires: [] },
      choices: [
        ch("Read the paperwork on the galley table.", "", { next: LEASE, requires: [{ beatMark: LEASE, not: true }] }),
        ch("Sleep. Tomorrow, the land.", "", { next: SLEEP })
      ]
    };
    const have = byId.get(SIG);
    if (!have) { camp.beats.push(want); byId.set(SIG, want); changes++; report.push(`✚ beat ${SIG} — the Signature card`); }
    else {
      let touched = 0;
      for (const k of ["description", "memoryText", "choices", "inject", "worldEffects", "label", "tags"]) if (JSON.stringify(have[k]) !== JSON.stringify(want[k])) { have[k] = want[k]; touched++; }
      if (touched) { changes++; report.push(`✚ beat ${SIG}: ${touched} field(s) refreshed`); } else report.push(`· ok beat ${SIG}`);
    }
  }

  /* ── 2. the first night offers it ───────────────────────────────────────── */
  {
    night.choices = Array.isArray(night.choices) ? night.choices : [];
    const row = ch("Sit with the thing only you can do.", "Your hands, the quiet, and the one effect that is yours alone.", {
      next: SIG, requires: [{ beatMark: SIG, not: true }]
    });
    const have = night.choices.find(c => lbl(c) === lbl(row));
    if (!have) {
      const sleepIx = night.choices.findIndex(c => /^sleep\./i.test(String(c.label || "")));
      night.choices.splice(sleepIx >= 0 ? sleepIx : night.choices.length, 0, row);
      changes++; report.push("✚ first night: + 'Sit with the thing only you can do.' before Sleep (hidden once read)");
    } else if (JSON.stringify(have) !== JSON.stringify(row)) { Object.assign(have, row); changes++; report.push("✚ first night: Signature row refreshed"); }
    else report.push("· ok first night: Signature row");
  }

  console.log(`[patch-first-signature] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`First Signature DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("First Signature: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-first-signature-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`First Signature APPLIED: ${changes} change(s). The first night now offers the Signature.`);
})();
