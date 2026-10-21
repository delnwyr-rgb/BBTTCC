/* patch-kt-register-2026-10-20.macro.js — the last two Khezek-Tor beats in the old staccato register (Dave, 2026-10-20 evening:
 *  "we need to take a look at some of the KT beats" — his sample was The Mine That Answered Back). A scan of every Khezek-Tor-quest
 *  beat finds exactly two still written as one-line stabs; the rest were rewritten on 10-19 / 10-20. Same treatment as the door set:
 *  same length, facts kept, Mal's ear. Dave wordsmiths after.
 *
 *   khezek_tor_mine_that_answered_back   silence not cavern; tools hum before striking; rock leans in; miners dream of owing, of
 *                                        contracts they do not remember signing; veins rearrange overnight like posture; the survey
 *                                        photo in the Maw, "pillar collapse", nobody believes it, nobody takes it down
 *   khezek_tor_valhaulan_seal_cinematic  Valhaulan sigils, recent, precise, directional; the seal binds outward, a pipe, a siphon
 *
 *  Guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
  const setDesc = (id, startsWith, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b.description || "");
    if (d === to) { report.push(`· ok ${id}: ${note}`); return; }
    if (!d.startsWith(startsWith)) { report.push(`⚠ ${id}: baseline start not found for "${note}"`); return; }
    b.description = to; changes++; report.push(`✚ ${id}: ${note}`);
  };

  setDesc("khezek_tor_mine_that_answered_back", "The new shaft broke into silence.",
    "The new shaft broke through into silence. Not a cavern, not a creature, just a quiet with edges to it, the kind that makes a crew put their tools down without anyone agreeing to. Picks hum in the hand before they strike anything. The rock leans in, the way a room leans in when somebody says a name. The men who work the face dream of owing something, of signing contracts they do not remember reading, and wake up checking their hands for ink. The ore veins rearrange themselves overnight, never at random, more like something adjusting its posture after a long time sitting still.\n\nA survey photo pinned up in the Maw shows the new shaft's mouth flanked by two upright shapes, and the caption calls them pillar collapse. Nobody who has seen the photo believes the caption. Nobody has taken the photo down either.",
    "the mine that answered back, in the Maw's register");
  setDesc("khezek_tor_valhaulan_seal_cinematic", "The sealed shaft bears Valhaulan sigils.",
    "The sealed shaft wears Valhaulan sigils, and they are recent work, precise work, laid with a direction in mind. A seal is supposed to hold something in. This one does not face inward at all. It faces out, down the line, the way a pipe faces, the way a siphon does. Whatever it is keeping, it is keeping for somebody else.",
    "the seal cinematic, one paragraph");

  console.log(`[kt-register 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-kt-register-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Khezek-Tor, last two.`);
})();
