/**
 * patch-atrocities-cost-2026-11-02.macro.js — THE ATROCITIES COST WHAT THEY COST (Dave 2026-11-02, failure pass — the explorer burned the
 * Field That Remembers for Loyalty −1 / Darkness +1: "the cost for burning the field should be turning Lyrenn hostile, loyalty -10,
 * darkness +10. They basically commit an atrocity if they burn this field, or the Forest that can't be fought, or open the darkness seal
 * and irradiate Khezek Tor." · "I expect that we didn't build consequences in mechanically").
 *   • lyrenn_the_field_that_remembers_you_burn_the_field, lyrenn_forest_will_not_be_fought_force_burn / _force_fight:
 *       coalition Loyalty −10, Darkness +10; Lyrenn ⇄ coalition set HOSTILE (both directions)
 *   • khezek_tor_the_vaulhaulan_seal_break (already −10/+10): Khezek Tor ⇄ coalition HOSTILE + the Khezek-Tor hex irradiated (level 3)
 *   • THE ASH VARIANT (Dave: "Ash variant works"): lyrenn_field_remembers_forward keeps its id (the seal gate's mark) and, after a burn,
 *     tells the same three costs through the red thread in the ash and the stone figure — a required story step is never lost to an atrocity.
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const ATROCITY_PATCH = (() => {
  const BURN = "lyrenn_the_field_that_remembers_you_burn_the_field";
  const ROWS = {
    [BURN]: "Lyrenn",
    lyrenn_forest_will_not_be_fought_force_burn: "Lyrenn",
    lyrenn_forest_will_not_be_fought_force_fight: "Lyrenn",
    khezek_tor_the_vaulhaulan_seal_break: "Khezek Tor"
  };
  const ASH_INTRO = (span) => "Nothing grows in the low field now. The red thread came up anyway — one thin line through the ash, straight through the stone figure, out toward the hexes nobody counts. When you kneel beside the figure, the ash stirs in a ring around you, and the thread leans.\n\nToward the mountain.\n\nThe field can't remember anymore. You saw to that. But the stone figure was here before the field was, and it kept what the plants knew. With the red thread pulling through it, the stone shows you " + span + " three ways, in the thread's posture — the only language left.";
  const SWAPS = [
    ["A stalk drawing every leaf back into itself", "The thread drawing itself back into the stone"],
    ["A stalk bent hard toward somebody else's row", "The thread bent hard toward somebody else's row"],
    ["The whole field going flat at once", "The ash lifting off the whole field at once"]
  ];
  function apply(camp, ids) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const report = [], conflicts = []; let changes = 0;
    for (const [bid, town] of Object.entries(ROWS)) {
      const b = beats.find(x => x?.id === bid); if (!b) { conflicts.push(`beat ${bid} not found`); continue; }
      const we = b.worldEffects = b.worldEffects || {};
      const fe = Array.isArray(we.factionEffects) ? we.factionEffects : (we.factionEffects = []);
      let row = fe.find(r => r && r.factionId === "@coalition");
      if (!row) { row = { factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: {}, allowOvercap: false }; fe.push(row); }
      if (Number(row.loyaltyDelta) !== -10) { row.loyaltyDelta = -10; changes++; report.push(`✚ ${bid}: Loyalty −10`); }
      if (Number(row.darknessDelta) !== 10) { row.darknessDelta = 10; changes++; report.push(`✚ ${bid}: Darkness +10`); }
      const tid = ids[town]; if (!tid) { conflicts.push(`faction "${town}" not found`); continue; }
      const rel = Array.isArray(we.relationshipEffects) ? we.relationshipEffects : (we.relationshipEffects = []);
      const want = [{ sourceFactionId: tid, targetFactionId: "@coalition" }, { sourceFactionId: "@coalition", targetFactionId: tid }];
      for (const w of want) {
        if (rel.some(r => r && r.sourceFactionId === w.sourceFactionId && r.targetFactionId === w.targetFactionId && String(r.setStatus || "").toLowerCase() === "hostile")) continue;
        rel.push({ ...w, setStatus: "hostile", reason: "atrocity" }); changes++; report.push(`✚ ${bid}: ${w.sourceFactionId === tid ? town + " → Stewards" : "Stewards → " + town} hostile`);
      }
      if (bid === "khezek_tor_the_vaulhaulan_seal_break") {
        const hr = Array.isArray(we.hexRadiation) ? we.hexRadiation : (we.hexRadiation ? [we.hexRadiation] : []);
        if (!hr.some(r => r && r.hexName === "Khezek-Tor" && Number(r.level) >= 3)) { hr.push({ hexName: "Khezek-Tor", level: 3 }); we.hexRadiation = hr; changes++; report.push(`✚ ${bid}: Khezek-Tor irradiated (3)`); }
      }
    }
    // the ash variant
    const fw = beats.find(x => x?.id === "lyrenn_field_remembers_forward");
    if (!fw) conflicts.push("lyrenn_field_remembers_forward not found");
    else if (!String(fw.description || "").startsWith(`{{#played ${BURN}}}`)) {
      const orig = String(fw.description || "");
      const cut = "three ways, in posture, the only language it has.";
      const i = orig.indexOf(cut), s0 = orig.indexOf("it shows you ");
      if (i < 0 || s0 < 0) conflicts.push("forward text no longer matches — ash variant not written");
      else {
        const span = orig.slice(s0 + "it shows you ".length, i).trim();
        let ash = ASH_INTRO(span) + orig.slice(i + cut.length);
        const miss = SWAPS.filter(([a]) => !ash.includes(a));
        if (miss.length) conflicts.push("forward text: missing " + miss.map(m => m[0]).join(" / "));
        else {
          for (const [a, b2] of SWAPS) ash = ash.replace(a, b2);
          fw.description = `{{#played ${BURN}}}${ash}{{else}}${orig}{{/played}}`; changes++; report.push("✚ lyrenn_field_remembers_forward: ash variant after a burn");
        }
      }
    }
    return { changes, report, conflicts };
  }
  return { apply, ROWS };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ATROCITY_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__atrocityDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const fac = (n) => game.actors.find(a => a.name === n && a.flags?.["bbttcc-factions"]?.isFaction === true)?.id || null;
  const ids = { "Lyrenn": fac("Lyrenn"), "Khezek Tor": fac("Khezek Tor") };
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = ATROCITY_PATCH.apply(camp, ids);
  console.log(`[atrocities cost 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__atrocity = { dry: DRY_RUN, changes, report, conflicts, ids };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-atrocities-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — the atrocities cost what they cost (${changes}).`);
})();
