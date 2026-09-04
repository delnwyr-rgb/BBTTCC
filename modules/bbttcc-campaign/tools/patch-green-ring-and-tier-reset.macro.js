/* patch-green-ring-and-tier-reset.macro.js — Green Ring stays Act 2;
 * factions come back down to earth (2026-09-04, From-The-Top run 4 catches).
 *
 * 1) GREEN RING: the Lyrenn Walk's Green Ring visit is the ≥1 CINEMATIC —
 *    but the cinematic had NO exit choice, so the chain dead-ended and the
 *    quest-order hero dangled the ≥2 Green Ring scene (whose "Chat with
 *    Elsin Quade" is the Act-2 echo convo) behind an override button.
 *    Fix: the cinematic gets "Back to the rows" → lyrenn_town_walk. The ≥2
 *    scene stays exactly as authored — it becomes reachable in Act 2.
 *    (Engine side, same day: future-act steps no longer appear as
 *    quest-order NEXT at all.)
 *
 * 2) TIER RESET: the Title Card front-run raised storyPhase to 2, and
 *    directorReconcileLevels promoted the coalition factions to Tier 1 and
 *    raised their OP caps to the T1 band (70). The world reset restored the
 *    phase but not the ACTORS. Reset coalition factions: tier → 0, opCaps →
 *    T0 band (50) — but never below current banked marks (no confiscation).
 *
 * Idempotent; DRY_RUN default true; backs up campaigns (actor changes are
 * reported before/after in the console). Run as GM.
 * Marker: [GREEN-RING-TIER-2026-09-04]
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const report = [];
  let changes = 0;

  // ── 1. Green Ring cinematic return choice (campaign data) ─────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  let campChanged = false;
  {
    const cin = (camp.beats || []).find(b => b.id === "lyrenn_green_ring_cinematic");
    if (!cin) { report.push("⚠ lyrenn_green_ring_cinematic: NOT FOUND — skipped"); }
    else {
      const chs = Array.isArray(cin.choices) ? cin.choices : (cin.choices = []);
      if (chs.some(c => String(c?.next) === "lyrenn_town_walk")) {
        report.push("· ok green ring cinematic: already returns to the rows");
      } else {
        chs.push({ label: "Back to the rows", next: "lyrenn_town_walk", description: "", checkStat: "", checkDC: 0, failNext: "" });
        changes++; campChanged = true;
        report.push("✚ green ring cinematic: \"Back to the rows\" → lyrenn_town_walk (no more dead-end)");
      }
    }
  }

  // ── 2. coalition faction tier reset (actor flags) ─────────────────────────
  const T0_CAP = 50;
  const capi = game.bbttcc?.api?.campaign;
  const refs = [ ...(Array.isArray(camp.factionIds) ? camp.factionIds : []), camp.factionId ].filter(Boolean);
  const seen = new Set();
  const factions = [];
  for (const ref of refs) {
    let a = null;
    const s = String(ref);
    try { a = s.startsWith("Actor.") ? await fromUuid(s) : game.actors.get(s); } catch (_e) {}
    if (a?.id && !seen.has(a.id)) { seen.add(a.id); factions.push(a); }
  }
  if (!factions.length) report.push("⚠ no coalition factions resolved — tier reset skipped");
  const actorOps = [];
  for (const f of factions) {
    const tier = Number(f.getFlag("bbttcc-factions", "tier") ?? 0) || 0;
    const caps = foundry.utils.deepClone(f.getFlag("bbttcc-factions", "opCaps") || {});
    const bank = f.getFlag("bbttcc-factions", "opBank") || {};
    const newCaps = {};
    let capChanged = false;
    for (const k of Object.keys(caps)) {
      // T0 band (50 marks/key), but never below what's actually banked —
      // lowering a cap under the balance would confiscate marks.
      const banked = Math.ceil(Math.max(0, Number(bank[k]) || 0));
      newCaps[k] = Math.max(T0_CAP, banked);
      if (newCaps[k] !== Number(caps[k])) capChanged = true;
    }
    if (tier === 0 && !capChanged) { report.push(`· ok ${f.name}: already T0, caps unchanged`); continue; }
    report.push(`✚ ${f.name}: tier ${tier} → 0${capChanged ? `, opCaps → ${JSON.stringify(newCaps)}` : ""}`);
    actorOps.push({ f, update: { "flags.bbttcc-factions.tier": 0, ...(capChanged ? { "flags.bbttcc-factions.opCaps": newCaps } : {}) } });
    changes++;
  }

  console.log(`[patch-green-ring-and-tier-reset] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Green-Ring/tier DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Green-Ring/tier: nothing to do.");
  if (campChanged) {
    try {
      const save = foundry.utils.saveDataToFile ?? saveDataToFile;
      save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json",
        `backup-campaigns-before-green-ring-${Date.now()}.json`);
    } catch (e) {
      return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
    }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  for (const op of actorOps) await op.f.update(op.update);
  ui.notifications.info(`Green-Ring/tier APPLIED: ${changes} change(s). The Ring waits for Act 2; the factions are newborn again.`);
})();
