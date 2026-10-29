/**
 * patch-etta-old-seal-new-script-2026-10-28.macro.js — Dave, 10-28 (canon): "Make Etta say an old seal, recently re-carved,
 * but with new script. Etta knows it's Valhaulan. She's booked passage with them before. No one else here would know enough
 * to recognize the runes that were used here."
 * Etta said "Nobody alive made it" while Khezek-Tor shows fresh sigils laid over older work. Now:
 *   · her first conversation (both versions — Seal decided or not): she names the script as Valhaulan because she has
 *     booked passage with them and knows their hand;
 *   · "What are they up to in there?": the seal itself is old (before the Shattering), the carving on it is new — Valhaulan
 *     script cut over the old work, recently — and nobody else here could have read it.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const report = []; const conflicts = []; let changes = 0;
  const edit = (id, from, to, note) => {
    const b = byId(id); if (!b) return conflicts.push(`${id}: not found`);
    const cur = String(b.description || "");
    if (cur.includes(to)) return;
    if (!cur.includes(from)) return conflicts.push(`${id}: anchor not found — "${from.slice(0, 60)}…"`);
    b.description = cur.replace(from, to); changes++; report.push(`✎ ${id}: ${note}`);
  };
  const MAIN = "allesh_gilliam_etta_bloom_conversation";
  edit(MAIN, "That’s a Valhaulan seal. Not decorative. Nine sent it to me.",
    "That’s Valhaulan script. Not decorative. I’ve booked passage with them, my loves; I know their hand, and nobody else in this town would. Nine sent it to me.",
    "she knows the script — booked passage with them (Seal not yet decided)");
  edit(MAIN, "That’s a Valhaulan seal. Nine sent me this sketch before you ever got there.",
    "That’s Valhaulan script. I’ve booked passage with them, my loves; I know their hand, and nobody else in this town would. Nine sent me this sketch before you ever got there.",
    "she knows the script — booked passage with them (Seal already decided)");
  edit("allesh_gilliam_etta_bloom_conversation_what_doing",
    "And no, my dears, they did not make that seal. Nobody alive made it. It had to have been there before — before the Shattering, before the Valhaulans, before anybody was keeping books on who pays for what.”\n\nShe spreads her hands as if to show you how long before. Then wider. Then gives up on that too.",
    "And no, my dears, they did not make that seal. The seal is old. It had to have been there before — before the Shattering, before the Valhaulans, before anybody was keeping books on who pays for what.”\n\nShe spreads her hands as if to show you how long before. Then wider. Then gives up on that too.\n\n“The carving on it is new. Somebody cut fresh script over the old work, recently, like a correction in another hand’s margin. Valhaulan script.” She taps the scrap. “Nobody else here could have read it, let alone written it.”",
    "old seal, recently re-carved in new (Valhaulan) script");

  console.log(`[etta old seal new script 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ettaSeal = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-etta-seal-script-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Etta: an old seal, new Valhaulan script.`);
})();
