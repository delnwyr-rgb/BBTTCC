/* patch-beat-polish-act01e-2026-10-20.macro.js — Dave's FIFTH round of Beat Polish doc edits (Act 0–1 tab, Lyrenn), found by the
 *  pre-rebuild export diff (5 chunks changed since rebuild m; 4 applied, 1 held):
 *
 *   lyrenn_forest_will_not_be_fought              "The treeline does not so much advance as it ... rearranges."
 *                                                 (Dave typed "advancem" — read as "advance"; flagged in chat)
 *   lyrenn_the_field_that_remembers_you           the em-dash becomes a comma ("the low field, the one nobody harvests")
 *   lyrenn_the_field_that_remembers_you_intro     "the bend is that of pure dejection"; "disturb your everything"; dashes out;
 *                                                 the stone-figure paragraph and the Rowan line are ONE paragraph
 *   lyrenn_the_field_that_remembers_you_plant_speak  Dave's pep talk to the plants replaces the narration (closing quote added — Dave's
 *                                                 text opened one and never closed it); Memory line → "like someone standing on a very high ledge"
 *
 *   HELD (not applied): lyrenn_water_choir_reading gained "(I really need to work on my metaphors too, apparently)." after the
 *   congregation line — in-world snark or a note to the editor? Dave rules in chat.
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
  const repField = (field) => (id, from, to, note) => {
    const b = byId.get(id); if (!b) { report.push(`⚠ ${id}: not found`); return; }
    const d = String(b[field] || "");
    if (to && !from.includes(to) && d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    if (d.includes(from)) { b[field] = d.replace(from, to); changes++; report.push(`✚ ${id}: ${note}`); return; }
    if (to === "" || d.includes(to)) { report.push(`· ok ${id}: ${note}`); return; }
    report.push(`⚠ ${id}: baseline ${field} not found for "${note}"`);
  };
  const rep = repField("description"), repMem = repField("memoryText");

  rep("lyrenn_forest_will_not_be_fought", "The treeline does not advance. It rearranges.", "The treeline does not so much advance as it ... rearranges.", "not so much advance");
  rep("lyrenn_the_field_that_remembers_you", "You agreed to walk the low field — the one nobody harvests,", "You agreed to walk the low field, the one nobody harvests,", "dash → comma");
  rep("lyrenn_the_field_that_remembers_you_intro",
    "The low field bends under twilight. Not from wind. From posture. Plants rise in shapes that disturb your breath. A stalk hunched like someone mid-apology. A cluster curled inward like hands that almost reached. A blossom tilted away — as if refusing eye contact.",
    "The low field bends under twilight, and the bend is that of pure dejection. Plants rise in shapes that disturb your everything. A stalk hunched like someone mid-apology. A cluster curled inward like hands that almost reached. A blossom tilted away as if refusing eye contact.",
    "pure dejection / your everything");
  rep("lyrenn_the_field_that_remembers_you_intro",
    "in exactly the posture of the nearest stalk — mid-apology, hands that almost reach. Either the plants are copying it, or it copied them, and nobody in Lyrenn will say which out loud.<p>Ask Rowan when the field first knelt and you get the same answer everyone gives: that one night.</p>",
    "in exactly the posture of the nearest stalk, mid-apology, hands that almost reach. Either the plants are copying it, or it copied them, and nobody in Lyrenn will say which out loud. Ask Rowan when the field first knelt and you get the same answer everyone gives: that one night.",
    "stone figure + Rowan = one paragraph");
  rep("lyrenn_the_field_that_remembers_you_plant_speak",
    "You talked to the field the way you'd talk to someone who'd had a hard year — no fixing, no hurry, just company. It worked better than it had any right to. The names come softer out there now, and some of the plants insisted on coming with you, which nobody in Lyrenn has a protocol for and everybody in Lyrenn is quietly thrilled about.",
    "\"Hey buddies. C'mere. Looks like you could use a hug! And a cup of warm sunshine. No not whiskey. Ok, gonna need to talk about alcoholism too. Stop touching me there. AND boundaries. But Lyrenn is here for you, 'k? Ok we're gonna go over her now. No you can't come with us, you're pla - ok oh shit some of you can come with us.\"",
    "the pep talk");
  repMem("lyrenn_the_field_that_remembers_you_plant_speak", "They talked to the field like kin.", "They talked to the field like someone standing on a very high ledge.", "Memory: a very high ledge");

  console.log(`[beat-polish act01e 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-beat-polish-act01e-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — Beat Polish Act 0–1, round five.`);
})();
