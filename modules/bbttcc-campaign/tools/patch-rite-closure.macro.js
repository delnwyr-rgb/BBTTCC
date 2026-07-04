/* patch-rite-closure.macro.js — "Once one of those four beats fires, The Rite Is Done."
 *
 * Scaffolding-native closure: all four Weeping Prisoner outcome beats
 * complete quest_uDuNp2yQxbuKkHx7, so the rite hub's gate becomes
 *   stabilizer COMPLETED  AND  prisoner quest NOT completed.
 * The instant any verdict fires, the quest completes → the gate fails → the
 * moment closes on EVERY surface (dialogue offers, person-doors, invitations,
 * director). The GM menu can always still run it by hand (soft-confirm).
 *
 * DRY_RUN default true; idempotent. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = false;
  const NS = "bbttcc-campaign";
  const BEAT_ID = "fixit_weeping_prisoner";
  const REQUIRES = [
    { questBucket: "quest_bSwOIWzxqNBwJ5NM", is: "completed" },     // the stabilizer deal is done…
    { questBucket: "quest_uDuNp2yQxbuKkHx7", isNot: "completed" }   // …and the rite has not yet been settled
  ];

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  const data = wasString ? JSON.parse(raw) : raw;
  const c = data?.[campaignId];
  if (!c) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const b = (c.beats || []).find(x => x?.id === BEAT_ID);
  if (!b) return ui.notifications.error(`Beat '${BEAT_ID}' not found.`);

  const before = JSON.stringify(b.inject?.requires ?? null);
  const after = JSON.stringify(REQUIRES);
  if (before === after) {
    console.log(`[patch-rite-closure] already patched: ${after}`);
    return ui.notifications.info("Rite closure gate already in place.");
  }
  console.log(`[patch-rite-closure] ${DRY_RUN ? "DRY RUN — would change" : "changing"} requires:\n  before: ${before}\n  after:  ${after}`);
  if (!DRY_RUN) {
    b.inject = b.inject || {};
    b.inject.requires = REQUIRES;
    await game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);
  }
  ui.notifications.info(`Rite closure: ${DRY_RUN ? "DRY RUN — see console. Set DRY_RUN = false to apply." : "APPLIED — the rite closes itself when any verdict fires."}`);
})();
