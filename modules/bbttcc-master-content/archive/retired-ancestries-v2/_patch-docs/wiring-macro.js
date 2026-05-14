/* =========================================================================
   BBTTCC Ancestry v2.0 — Post-Import Wiring Macro
   -------------------------------------------------------------------------
   Run this once after importing the v2 ancestry JSONs into
   bbttcc-master-content.ancestries. Does three things:

   1. Scans world actors for legacy ancestry UUIDs and logs their state.
      (Does NOT auto-modify PCs. GM-authoritative per BBTTCC pattern.)

   2. Flags PCs whose heritage was retired (Sky-Threaded, Ember-Touched,
      Erectus) so the GM can have the conversation about what they are now.

   3. Verifies placeholder Tier-I UUIDs and warns if they still point to
      CK*PLACE / HCROMAGNONTIERI0 stubs.

   Usage: paste into a world macro, run as GM, read console output,
   decide next steps with players.
========================================================================= */

(async () => {
  const PACK = "bbttcc-master-content.ancestries";
  const PLACEHOLDER_UUIDS = new Set([
    "CKCORETRAITPLACE",
    "CKCHUPATIER1PLC0",
    "HCROMAGNONTIERI0"
  ]);
  const RETIRED_HERITAGE_IDENTIFIERS = new Set([
    "oldenborn_sky_threaded_heritage",
    "oldenborn_ember_touched_heritage",
    "human_erectus_heritage",
    "furrykin_felid_heritage",
    "furrykin_leporid_heritage",
    "furrykin_mustelid_heritage",
    "furrykin_ursid_heritage",
    "furrykin_vulpin_heritage"
  ]);
  const DEMOTED_SPECIES_IDS = new Map([
    ["yiZiL1OaWx9qX5bF", "Jackalope -> Cryptidkin Heritage: Jackalope"],
    ["a2b5906bad32ad4c", "Furrykin -> Cryptidkin Heritage: Furrykin"],
    ["nKHhfdL3U98tJj6r", "Stormborn Nomad -> Oldenborn Heritage: Stormborn Nomad"],
    ["bILvIQnnHx5eVzYb", "Rustlander -> Oldenborn Heritage: Rustland Scavenger"]
  ]);

  const report = {
    placeholderTierIHits: [],
    retiredHeritageHits: [],
    demotedSpeciesHits: [],
    total: 0
  };

  const pack = game.packs.get(PACK);
  if (!pack) {
    ui.notifications.error(`Pack ${PACK} not found. Aborting.`);
    return;
  }

  const docs = await pack.getDocuments();
  console.group("[BBTTCC Ancestry v2.0] Wiring audit");

  // 1. Placeholder Tier-I scan
  for (const item of docs) {
    const advs = item.system?.advancement ?? [];
    for (const adv of advs) {
      const uuids = (adv.configuration?.items ?? []).map(i => i.uuid ?? "");
      for (const u of uuids) {
        const tail = u.split(".").pop();
        if (PLACEHOLDER_UUIDS.has(tail)) {
          report.placeholderTierIHits.push({ item: item.name, uuid: u });
        }
      }
    }
  }

  // 2. Scan actors for retired heritages and demoted species
  for (const actor of game.actors) {
    if (actor.type !== "character") continue;
    report.total += 1;

    for (const item of actor.items) {
      const ident = item.system?.identifier;
      const compSource = item._stats?.compendiumSource ?? "";
      const sourceTail = compSource.split(".").pop() ?? item.id;

      if (ident && RETIRED_HERITAGE_IDENTIFIERS.has(ident)) {
        report.retiredHeritageHits.push({
          actor: actor.name,
          item: item.name,
          identifier: ident
        });
      }
      if (DEMOTED_SPECIES_IDS.has(sourceTail) || DEMOTED_SPECIES_IDS.has(item.id)) {
        const note = DEMOTED_SPECIES_IDS.get(sourceTail) ?? DEMOTED_SPECIES_IDS.get(item.id);
        report.demotedSpeciesHits.push({
          actor: actor.name,
          item: item.name,
          migration: note
        });
      }
    }
  }

  console.log(`Scanned ${report.total} PCs.`);
  console.log(`Placeholder Tier-I UUIDs still stubbed: ${report.placeholderTierIHits.length}`);
  console.table(report.placeholderTierIHits);
  console.log(`PCs with retired heritages (need GM conversation): ${report.retiredHeritageHits.length}`);
  console.table(report.retiredHeritageHits);
  console.log(`PCs with demoted species items (should still resolve, now as heritage feats): ${report.demotedSpeciesHits.length}`);
  console.table(report.demotedSpeciesHits);
  console.groupEnd();

  ui.notifications.info(`Ancestry v2.0 audit complete. See console. Stubs: ${report.placeholderTierIHits.length}, retired: ${report.retiredHeritageHits.length}, demoted: ${report.demotedSpeciesHits.length}.`);

  // Expose report for follow-up macros
  game.bbttcc ??= {};
  game.bbttcc.ancestryV2Audit = report;
})();
