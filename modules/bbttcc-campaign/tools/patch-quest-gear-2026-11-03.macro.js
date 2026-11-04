/**
 * patch-quest-gear-2026-11-03.macro.js — GEAR AS QUEST REWARDS (Dave, round three). Writes campaign.story.questGear: finishing a quest drops a real item
 * from the master pack to the party Steward best trained for it. Act 2 quests give Tier II, later quests Tier III. First pass: Dave edits the table freely.
 * Names resolve at run time; a missing or ambiguous name refuses the whole patch. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const QUEST_GEAR_PATCH = (() => {
  const TABLE = {
    allesh_gilliam: "Patrolman's Plate of the Go", khezek_tor: "Steelweave Hauberk", valhaulan_seal: "Hand Axe of the Keystone Ve", lyrenn: "Cassock of Quiet Hours",
    fixit_farm: "Bolt-Driver of Frozen Asset", circuit_riders: "Hex-Warded Duster", tifaret: "Drifter's Weave of the Stan", forgotten_cause: "Sept-Blessed Aegis",
    bandit_accord: "Static Aegis", father_tamsin: "Brass Knife of the Quiet Wo",
    widening_trail: "Hexbane Surplice", hidden_vault: "Phase Disruptor", lost_statues: "Singing Hammer", kt_shipment: "Hex-Carved Plate", bitter_sea: "Mirrorface Pavise",
    green_endures: "Vestments of the Standing V", flooded_towns: "Mercy Driver", maneuver_vault: "Frikkin' Laser Blade Saber", ninth_guest: "Gilded Atonement Blade",
    finale: "Oathkeeper's Bulwark", gloomgill: "Resonance Howler"
  };
  function apply(camp, resolve) {
    const report = [], conflicts = []; let changes = 0;
    camp.story = camp.story || {}; camp.story.questGear = camp.story.questGear || {};
    for (const [key, prefix] of Object.entries(TABLE)) {
      if (!camp.story.quests?.[key] && !camp.story.questMap?.[key] && !resolve.questKnown(key)) { conflicts.push(`no such quest: ${key}`); continue; }
      const hits = resolve.items(prefix);
      if (hits.length !== 1) { conflicts.push(`${prefix}: ${hits.length} matches`); continue; }
      if (camp.story.questGear[key]?.uuid === hits[0].uuid) continue;
      camp.story.questGear[key] = { uuid: hits[0].uuid, name: hits[0].name }; changes++; report.push(`✚ ${key} → ${hits[0].name}`);
    }
    return { changes, report, conflicts };
  }
  return { apply, TABLE };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = QUEST_GEAR_PATCH;
} else (async () => {
  const DRY_RUN = (globalThis.__questGearDry ?? true);   // <-- set false (or globalThis.__questGearDry = false) to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const idx = await game.packs.get("bbttcc-master-content.items").getIndex();
  const resolve = {
    items: (prefix) => [...idx].filter(e => String(e.name).startsWith(prefix) && e.type !== "feat").map(e => ({ name: e.name, uuid: e.uuid })),
    questKnown: (k) => !!game.bbttcc.api.campaign.story?.QUEST_MAP?.quests?.[k]
  };
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, conflicts } = QUEST_GEAR_PATCH.apply(camp, resolve);
  console.log(`[quest gear 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__questGear = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (conflicts.length) return ui.notifications.error(`Refused: ${conflicts.join("; ")}`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-quest-gear-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  globalThis.__questGear.done = true;
  ui.notifications.info(`Applied — quest gear table (${changes} change(s)).`);
})();
