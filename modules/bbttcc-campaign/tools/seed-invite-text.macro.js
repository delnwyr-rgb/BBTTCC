/* seed-invite-text.macro.js — authored inviteText for conversation-hub beats
 *
 * The invitation card ("<NPC> wants a word." + Talk button) reads
 * `beat.inviteText` when authored. This stamps diegetic lines onto the five
 * genuine conversation moments (speaker beats WITH choices). Outcome beats
 * keep no inviteText — after today's fix they are memory-carriers only and
 * never invite.
 *
 * DRY_RUN default true. Idempotent: skips beats whose inviteText already
 * matches; OVERWRITE_DIFFERENT=false leaves any hand-authored line alone.
 * Run as GM on the world with the active "Thatward's Ho!" campaign.
 */
(async () => {
  const DRY_RUN = false;
  const OVERWRITE_DIFFERENT = false;

  const LINES = {
    fixit_weeping_prisoner:             "wants you present before the enclave decides what justice looks like.",
    fixit_leyline_stabilizer_negotiation: "is ready to talk terms on the Leyline Stabilizer.",
    fc_mara_pip_summons:                "sends word: one of her runners hasn't come home.",
    gullywasher_cultural_summit:        "is setting a long table at the Gullywasher, and wants you there.",
    gullywasher_dougan_points_to_confluence: "pours one on the house — he's been thinking about where the wrongness lives."
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const NS = "bbttcc-campaign";
  const api = game.bbttcc?.api?.campaign;
  if (!api) return ui.notifications.error("Campaign API missing.");

  const campaignId = api.getActiveCampaignId();
  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  const data = wasString ? JSON.parse(raw) : raw;
  const c = data?.[campaignId];
  if (!c) return ui.notifications.error(`Active campaign '${campaignId}' not found in setting.`);

  const report = [];
  let changed = 0;
  for (const [beatId, line] of Object.entries(LINES)) {
    const b = (c.beats || []).find(x => x?.id === beatId);
    if (!b) { report.push(`❌ ${beatId}: NOT FOUND`); continue; }
    const cur = String(b.inviteText || "").trim();
    if (cur === line) { report.push(`= ${beatId}: already set`); continue; }
    if (cur && !OVERWRITE_DIFFERENT) { report.push(`≠ ${beatId}: has a DIFFERENT line — left alone ("${cur}")`); continue; }
    report.push(`${cur ? "~" : "+"} ${beatId}: "${line}"`);
    changed++;
    if (!DRY_RUN) b.inviteText = line;
  }

  if (!DRY_RUN && changed) await game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  const banner = DRY_RUN ? "DRY RUN — nothing written." : `APPLIED (${changed} beats).`;
  console.log(`[seed-invite-text] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`inviteText seeder: ${banner} (see console)`);
})();
