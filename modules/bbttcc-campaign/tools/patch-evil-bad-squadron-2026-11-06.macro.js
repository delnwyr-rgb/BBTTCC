/*
 * patch-evil-bad-squadron-2026-11-06.macro.js — Dave 2026-11-06: the first road ambush is a Battle against a small enemy Domain, not the party's own hex and not the
 * grown Evil Bad Faction. Evil Bad Squadron is a tier 0 faction with no learned maneuvers, the training bank the Induction's hostile faction uses, led by the Commander Road Bandit.
 * Ember Bad Eden. globalThis.__squadDry = false applies; anything else is a dry run. Idempotent. Fixed actor id so a rerun after a reset finds or rebuilds the same faction.
 */
(async () => {
  const DRY_RUN = globalThis.__squadDry !== false;
  const ID = "EvilBadSquadron1", LEAD = "m3cLv3eURapDXjm9", CMDR = "Ynh2gE8aLtpt8tfW";
  const DOMAINS = [LEAD, "RqN2T6ikoPN0UaaR", "N6XMT6AH3r5GylE0", "6H5Grt3HybAs1rSq"];
  const C = game.bbttcc.api.campaign; const id = C.getActiveCampaignId(); const c = C.getCampaign(id);
  const report = { DRY_RUN, text: [] };
  const beats = foundry.utils.deepClone(c.beats);
  const ambush = beats.find(b => b.id === "first_road_ambush");
  if (ambush?.worldEffects?.raid?.defenderId !== ID) { ambush.worldEffects.raid.defenderId = ID; report.text.push("Ambush: defender is the Squadron"); }
  const evil = game.actors.getName("Evil Bad Faction");
  if (!game.actors.get(ID)) {
    report.text.push("Squadron: created");
    if (!DRY_RUN) await Actor.implementation.create({
      _id: ID, name: "Evil Bad Squadron", type: "npc", img: evil?.img, folder: evil?.folder?.id ?? null, ownership: { default: 0 },
      prototypeToken: { actorLink: false, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE, name: "Evil Bad Squadron" },
      flags: { "bbttcc-factions": {
        isFaction: true, disposition: "hostile", tier: 0, factionLevel: 0, opBankMarksMigrated: true,
        opBank: { violence: 50, nonlethal: 50, intrigue: 50, softpower: 50, diplomacy: 50, economy: 20, logistics: 20, culture: 0, faith: 0 },
        roster: [`Actor.${CMDR}`], leaderId: CMDR, unlocks: { maneuvers: {} },
        relations: Object.fromEntries(DOMAINS.map(d => [d, "hostile"]))
      } }
    }, { keepId: true });
  }
  const cmdr = game.actors.get(CMDR);
  if (cmdr?.flags?.["bbttcc-factions"]?.factionId !== ID) { report.text.push("Commander: leads the Squadron"); if (!DRY_RUN) await cmdr.setFlag("bbttcc-factions", "factionId", ID); }
  const lead = game.actors.get(LEAD);
  const s = lead.getFlag("bbttcc-raid", "raidSession");
  const liveFix = s?.offeredBy === "first_road_ambush" && s.defenderId !== ID;
  if (liveFix) report.text.push("Live session: defender is the Squadron");
  if (!DRY_RUN) {
    if (ambush.worldEffects.raid.defenderId === ID) await C.saveCampaign(id, { ...c, beats });
    if (liveFix) await lead.setFlag("bbttcc-raid", "raidSession", { ...s, defenderId: ID, rev: Number(s.rev || 0) + 1, ts: Date.now() });
  }
  console.log("SQUAD " + JSON.stringify(report));
  ui.notifications.info(`Evil Bad Squadron: ${DRY_RUN ? "dry run" : "applied"}, ${report.text.length} change(s).`);
})();
