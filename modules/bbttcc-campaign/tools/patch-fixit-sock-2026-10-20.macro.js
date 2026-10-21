/* patch-fixit-sock-2026-10-20.macro.js — THE SELF WARMING SOCK (Dave's Beat Polish doc note, 2026-10-20: "a world item for the Fixit mystery bin").
 *  • World Item "Self Warming Sock" (type gear, Tier I, Comfort: +1 Strain recovered per Soma Break while worn) created in the world Items
 *    directory if missing — flag `bbttcc-campaign.fixitMysteryBin = "sock"`. It is the reason the MYSTERY bin was warm.
 *  • `fixit_mystery_bin_fail` "Keep the sock." after-text gains the warmth + a ⚙ GM note (stripped from player cards) to hand the Item over.
 *  Idempotent; DRY_RUN default true; backs up `campaigns`. GM only. The Item is created on APPLY only.
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
  const report = []; let changes = 0; const actorEdits = [];

  // ── the choice after-text ──
  {
    const b = byId.get("fixit_mystery_bin_fail"); const c = b?.choices?.find(x => x.label === "Keep the sock.");
    const TO = "It's a good sock. It is, somehow, still warm. ⚙ GM — hand them the Self Warming Sock from the world Items directory.";
    if (!c) report.push("⚠ fixit_mystery_bin_fail: 'Keep the sock.' choice not found");
    else if (c.description === TO) report.push("· ok fixit_mystery_bin_fail: after-text already warm");
    else if (c.description === "It's a good sock.") { c.description = TO; changes++; report.push("✚ fixit_mystery_bin_fail: 'Keep the sock.' after-text — still warm + GM hand-over note"); }
    else report.push("⚠ fixit_mystery_bin_fail: after-text is not the expected baseline — skipped");
  }

  // ── the Item itself (world Items directory) ──
  if (!game.items) report.push("· (no Items collection here — offline sim; the Item is created on the live seat)");
  else if (game.items.contents.some(it => it.getFlag?.(NS, "fixitMysteryBin") === "sock" || /self warming sock/i.test(String(it.name || "")))) report.push("· ok item Self Warming Sock (already in the world)");
  else { changes++; report.push("✚ item Self Warming Sock → world Items directory"); actorEdits.push(() => Item.create({
    name: "Self Warming Sock", type: "gear", img: "icons/equipment/feet/boots-collared-pink.webp",
    system: { slot: "misc", category: "gear", quantity: 1, source: "Furrier's Fixit Farm — the MYSTERY bin", tags: ["fixit", "mystery-bin", "comfort", "quest"],
      description: { value: "<p>One wool sock. No holes, somebody's initials on the cuff in thread. It came out of the MYSTERY bin at Furrier's Fixit Farm, which is why the bin was warm, and why it isn't any more.</p><p>It is warm. It stays warm. Nobody at the Farm will say how, and every Jackalope who passes it pats it like a dog.</p><p><i>Which foot is a matter of faith.</i></p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Comfort:</strong> once per Soma Break, the bearer who rests with the sock on recovers 1 extra Strain.</p></li><li><p><strong>Tier:</strong> I</p></li><li><p><strong>Cost:</strong> AS IS. NO REFUNDS. STOP ASKING.</p></li></ul>" } },
    flags: { [NS]: { fixitMysteryBin: "sock" } } })); }

  console.log(`[fixit-sock 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-fixit-sock-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  for (const fn of actorEdits) await fn();
  ui.notifications.info(`Applied ${changes} change(s) — the Self Warming Sock.`);
})();
