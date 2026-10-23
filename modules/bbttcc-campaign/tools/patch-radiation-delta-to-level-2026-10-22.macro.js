/* patch-radiation-delta-to-level-2026-10-22.macro.js — ONE RADIATION SWITCH (owner ruling 2026-10-22).
 * `worldEffects.radiationDelta` never applied (it called api.radiation.adjustAll, which never existed). Six live beats
 * carry `radiationDelta: 1` — each is the place getting hotter, so each now raises ITS hex to level 1 (Radiated) with
 * `worldEffects.hexRadiation` (a beat never lowers a hotter hex), and the dead key comes off.
 * Idempotent; DRY_RUN default true; returns the six beats' before-values (the backup). GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const PLAN = {
    map_burnt_flats_pattern:             "The Burnt Flats",
    map_burnt_flats_partial:             "The Burnt Flats",
    map_anchor_reach_break:              "The Anchor Reach",
    hod_flooded_probably_beaumont_surge: "Probably Beaumont",
    hod_flooded_maybe_beaumont_escalate: "Maybe Beaumont?",
    hod_flooded_bedlam_barrens_break:    "Bedlam Barrens"
  };

  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : JSON.parse(JSON.stringify(campsRaw));   // a TRUE copy — deepClone hands back non-plain objects by reference, so an in-place edit can hit the settings cache and settings.set then sees "no change"
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beatList = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(beatList.map(b => [b.id, b]));
  const hexNames = new Set();
  for (const sc of game.scenes) for (const d of sc.drawings) { const n = d.flags?.["bbttcc-territory"]?.name; if (n) hexNames.add(n); }

  const report = [], backup = {}; let changes = 0;
  for (const [id, hexName] of Object.entries(PLAN)) {
    const b = byId.get(id);
    if (!b) { report.push(`✖ ${id}: beat not found`); continue; }
    if (!hexNames.has(hexName)) { report.push(`✖ ${id}: hex '${hexName}' not found — skipped`); continue; }
    const we = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : (b.worldEffects = {});
    const has = (Array.isArray(we.hexRadiation) ? we.hexRadiation : (we.hexRadiation ? [we.hexRadiation] : [])).some(r => r && r.hexName === hexName && Number(r.level) >= 1);
    if (has && we.radiationDelta == null) { report.push(`· ok ${id}: hexRadiation ${hexName} present`); continue; }
    backup[id] = { radiationDelta: we.radiationDelta ?? null, hexRadiation: we.hexRadiation ?? null };
    if (!has) we.hexRadiation = { level: 1, hexName };
    delete we.radiationDelta;
    changes++;
    report.push(`✚ ${id}: radiationDelta ${backup[id].radiationDelta} → hexRadiation { level 1, ${hexName} }`);
  }

  const summary = `radiation patch — ${changes} beat change(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log(summary + "\n" + report.join("\n"));
  ui.notifications.info(summary);
  if (!DRY_RUN && changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  return { dryRun: DRY_RUN, changes, report, backup };
})();
