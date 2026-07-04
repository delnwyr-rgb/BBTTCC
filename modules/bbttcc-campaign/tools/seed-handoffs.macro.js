/* seed-handoffs.macro.js — narrative handoffs: conversation → next scene (2026-07-03)
 *
 * Stamps `beat.handoff = { beatId, focus?, text? }` onto conversation-hub
 * beats. When one of that beat's moments is ENACTED through dialogue, the
 * engine posts a public "way forward" card: the handoff beat's choices as
 * doors, `focus` leading and highlighted, `text` as the diegetic line.
 * (Engine support deployed 2026-07-03: bbttcc:dialogue:choiceEnacted →
 * handoff card; GM clicks route through runBeat.)
 *
 * DRY_RUN default true; idempotent; OVERWRITE_DIFFERENT=false respects
 * hand-authored handoffs. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = false;
  const OVERWRITE_DIFFERENT = false;

  const HANDOFFS = {
    fixit_leyline_stabilizer_negotiation: {
      beatId: "fixit_intro_scene",
      focus: "Arc Bay",
      text: "Mara nods you toward the Arc Bay — Young Gearbox keeps the stabilizer, and he'll be expecting you."
    },
    fixit_weeping_prisoner: {
      beatId: "fixit_intro_scene",
      text: "The enclave disperses around the verdict, and the Farm carries on. Where to?"
    }
  };

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const NS = "bbttcc-campaign";
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  const data = wasString ? JSON.parse(raw) : raw;
  const c = data?.[campaignId];
  if (!c) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);

  const report = [];
  let changed = 0;
  for (const [beatId, h] of Object.entries(HANDOFFS)) {
    const b = (c.beats || []).find(x => x?.id === beatId);
    if (!b) { report.push(`❌ ${beatId}: NOT FOUND`); continue; }
    if (!(c.beats || []).find(x => x?.id === h.beatId)) { report.push(`❌ ${beatId}: handoff target '${h.beatId}' missing`); continue; }
    const cur = b.handoff;
    if (cur && JSON.stringify(cur) === JSON.stringify(h)) { report.push(`= ${beatId}: already set`); continue; }
    if (cur && !OVERWRITE_DIFFERENT) { report.push(`≠ ${beatId}: has a DIFFERENT handoff — left alone`); continue; }
    report.push(`${cur ? "~" : "+"} ${beatId} → ${h.beatId}${h.focus ? ` (focus: ${h.focus})` : ""}`);
    changed++;
    if (!DRY_RUN) b.handoff = h;
  }
  if (!DRY_RUN && changed) await game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);

  const banner = DRY_RUN ? "DRY RUN — nothing written." : `APPLIED (${changed} beats).`;
  console.log(`[seed-handoffs] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Handoff seeder: ${banner} (see console)`);
})();
