/**
 * patch-discovery-tags.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Stamps the `discovery` tag on location-anchored beat chains (2026-08-23).
 * Tagged beats are excluded from the Story Director's offer pool and moved
 * out of the Visualizer's "Available now" list into the collapsed
 * "📍 On location" group — they fire when the party ARRIVES (travel
 * hex_enter injector / GM on arrival), never as a menu choice. The director
 * was offering Chuckle Creek's delight-open at Turn 1 of Act 0.
 *
 * CHAINS lists the storyChain keys to stamp — extend it as more
 * hex-discovery content ships (Tidepool, Greener Pastures, Wendigo…).
 */
(async () => {
  const DRY_RUN = false;
  const CHAINS = ["chuckle_creek", "stillwater", "soft_landing"];
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);

  let changes = 0;
  for (const b of camp.beats || []) {
    const chain = String(b.storyChain || "").toLowerCase();
    if (!CHAINS.includes(chain)) continue;
    const tags = String(b.tags || "");
    if (/\bdiscovery\b/i.test(tags)) continue;
    b.tags = (tags ? tags + " " : "") + "discovery";
    changes++;
    console.log(`[discovery-tags] ${b.id} (${chain}) tags → "${b.tags}"`);
  }

  console.log(`[patch-discovery-tags] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} beat(s)`);
  if (DRY_RUN) return ui.notifications.info(`Discovery tags DRY RUN: ${changes} beat(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-discovery-tags-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Discovery tags APPLIED to ${changes} beat(s). Backup downloaded.`);
})();
