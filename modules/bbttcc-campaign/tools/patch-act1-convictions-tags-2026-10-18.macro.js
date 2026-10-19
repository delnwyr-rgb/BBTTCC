/* patch-act1-convictions-tags-2026-10-18.macro.js — ACT 0–1 CONVICTIONS TAGS (Alpha Cut ruling 17, 2026-10-18)
 *
 *  The Convictions monitor (bbttcc-aae/convictions.js) only moves when a beat choice carries political tags, and the
 *  Act 0–1 spine carried none (0 of 102 choices). This stamps the choices that carry weight — tags are the AAE weight
 *  vocabulary, written in the Beat Editor's canonical "politics.<key>" form on `choice.politicalTags` (or
 *  `beat.politicalTags` for a whole beat). Doors, questions and investigation rows stay untagged on purpose.
 *  Table mirrored in the doc "Bad Eden Alpha Cut" → Rulings 17 and 18. ⚠ Tags = my proposal, Dave to bless.
 *
 *  Idempotent (exact-set compare); DRY_RUN default true; backs up `campaigns`. GM only. Marker: [ACT1-CONVICTIONS-TAGS-2026-10-18]
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

  // [beatId, choiceLabelPrefix | null (= whole beat), tags]
  const STAMPS = [
    ["enc_bandit_ambush_win", "Kill 'em all",                        "purge repression"],
    ["enc_bandit_ambush_win", "Send them to jail",                   "due_process order enforcement"],
    ["enc_bandit_ambush_win", "Set them free",                       "mercy mutual_aid"],
    ["enc_hexknight",         "Pay the road-price",                  "consent order"],
    ["enc_hexknight",         "Meet the lance",                      "direct_action decentralize"],
    ["enc_desenitarius_maarg","The old courtesies",                  "ritual"],
    ["ag_confessor_relief",   "Mercy",                               "mercy harm_reduction"],
    ["ag_confessor_relief",   "Expose him before the town",          "transparency scapegoat purification"],
    ["ag_confessor_relief",   "Bring it to Marshal Pike",            "due_process enforcement order"],
    ["ag_confessor_relief",   "Say nothing",                         "surveillance security"],
    ["ag_caravan_route",      "Keep the route",                      "censorship secular_compromise"],
    ["ag_caravan_route",      "Bring the route to Tamsin",           "transparency consent"],
    ["ag_caravan_route",      "Bring the route to Pike",             "due_process transparency"],
    ["ag_tamsin_pactkeeper",  null,                                  "transparency"],
    ["allesh_gilliam_tamsin_welcome", "Take a bowl from the cauldron", "mutual_aid"],
  ];
  const canon = (s) => String(s || "").split(/\s+/).filter(Boolean).map(t => t.startsWith("politics.") ? t : "politics." + t).sort().join(" ");
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

  for (const [id, prefix, tags] of STAMPS) {
    const b = byId.get(id);
    if (!b) { report.push(`⚠ ${id}: NOT FOUND`); continue; }
    const want = canon(tags);
    let target = b, where = id;
    if (prefix) {
      const c = (b.choices || []).find(ch => norm(ch.label).startsWith(norm(prefix)));
      if (!c) { report.push(`⚠ ${id}: choice "${prefix}" NOT FOUND`); continue; }
      target = c; where = `${id} / ${String(c.label).slice(0, 36)}`;
    }
    const have = canon(target.politicalTags);
    if (have === want) { report.push(`· ok ${where}`); continue; }
    target.politicalTags = want.split(" ").join(" ");
    changes++; report.push(`✚ ${where}: ${have ? have + " → " : ""}${want}`);
  }

  console.log(`[patch-act1-convictions-tags] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Convictions tags DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Convictions tags: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-convictions-tags-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Convictions tags APPLIED: ${changes} change(s). Act 0–1 now tests your convictions.`);
})();
