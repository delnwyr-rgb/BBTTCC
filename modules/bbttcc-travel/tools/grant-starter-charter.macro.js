/* grant-starter-charter.macro.js — RUN IN-WORLD (GM). DRY_RUN default true.
 *
 * Owner ruling 2026-09-25: "the main campaign faction already has an ongoing charter with the Jackalopes for
 * their boat — they left it docked at Bedlam Plains when they dropped off the PCs. Three turns of pre-paid
 * rental, then plan to buy your own or negotiate a renewal."
 *
 * New factions get this at founding (applyStartingPackage, standard package). This macro gives it to the
 * factions that ALREADY exist in a running world: every faction on the active campaign's roster (Errata,
 * Sweet Release), 3 turns from the CURRENT world turn, source "starter". Skips a faction that already holds a
 * live starter charter. Idempotent.
 */
(async () => {
  const DRY_RUN = false;                        // <-- set false to apply
  const ONLY_FIRST_FACTION = false;            // true = only factionIds[0] ("the main campaign faction")
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const fapi = game.bbttcc?.api?.factions, ch = game.bbttcc?.api?.travel?.charters, capi = game.bbttcc?.api?.campaign;
  if (!fapi?.grantStarterCharter || !ch?.list) return ui.notifications.error("APIs missing — hard-reload after the 2026-09-25 deploy.");
  const cid = capi?.getActiveCampaignId?.(); const camp = cid ? capi.getCampaign?.(cid) : null;
  let ids = Array.isArray(camp?.factionIds) && camp.factionIds.length ? camp.factionIds.slice() : (camp?.factionId ? [camp.factionId] : []);
  ids = ids.map(x => String(x).replace(/^Actor\./, "")).filter(x => game.actors.get(x));
  if (ONLY_FIRST_FACTION) ids = ids.slice(0, 1);
  if (!ids.length) return ui.notifications.error("No campaign factions found on the active campaign.");
  const turn = Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0;
  const report = [`Starter charter — world turn ${turn}, ${DRY_RUN ? "DRY RUN" : "APPLY"}`, `carrier: ${fapi.STARTER_CHARTER.carrierName} · boat: ${fapi.STARTER_CHARTER.rigName} · ${fapi.STARTER_CHARTER.turns} turns (through turn ${turn + fapi.STARTER_CHARTER.turns})`];
  for (const id of ids) {
    const A = game.actors.get(id);
    const live = ch.list(id).find(c => c.source === "starter");
    if (live) { report.push(`• ${A.name}: already holds a starter charter (${live.rigName}, through ${live.until ?? "standing"}) — skipped`); continue; }
    if (DRY_RUN) { report.push(`• ${A.name}: would grant`); continue; }
    const r = await fapi.grantStarterCharter(A);
    report.push(`• ${A.name}: ${r?.ok ? `granted — ${r.row.rigName} through turn ${r.row.until}` : `FAILED — ${r?.error}`}`);
    if (r?.ok) try { await A.setFlag("bbttcc-factions", "starterCharterGranted", true); } catch (_e) {}
  }
  console.log("[grant-starter-charter]", report.join("\n"));
  ui.notifications.info(report.join(" | "));
  ChatMessage.create({ content: `<pre style="white-space:pre-wrap">${report.map(s => foundry.utils.escapeHTML(s)).join("\n")}</pre>`, whisper: [game.user.id] });
})();
