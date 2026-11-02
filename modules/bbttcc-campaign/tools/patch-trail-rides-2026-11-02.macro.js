/**
 * patch-trail-rides-2026-11-02.macro.js — click-through (2026-11-02, Dave: fire things through the systems a GM would): the
 * Widening Trail's site exits ("Follow the harmonic corruption into the Mire", "Go to Port Kudzu", "Cross-check at Crown Mall" …) route
 * STRAIGHT into the next site's arrival opener — three hexes away, so the location guard refused it and the table was left with
 * nothing (no ride, no legs, no days, no road). Each such exit (Acts 3–5 quests) becomes a ride: choice.openTravel = { hexName } (the
 * Travel Console opens on the Main Map and Auto-Plans from the party), next "" — arriving at the hex plays its opener, as every Trail
 * site has one (hexOverrides.onEnterBeatIds). "Go back in" choices at the same site are left alone.
 * Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const QUESTS = new Set(["widening_trail", "crown_mall", "ninth_guest", "finale", "hidden_vault", "lost_statues", "flooded_towns", "balcones", "maneuver_vault", "fifteen_year_siege", "trojan_gift", "gloomgill"]);
  const SAME_SITE = /^\W*(go back in|back in|return inside|try again)/i;
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const opener = new Map();
  for (const [uuid, ov] of Object.entries(camp.hexOverrides || {})) { let d = null; try { d = fromUuidSync(uuid); } catch (_e) {} const nm = d?.flags?.["bbttcc-territory"]?.name; if (!nm) continue; for (const id of [...(ov?.onEnterBeatIds || []), ov?.onEnterBeatId].filter(Boolean)) opener.set(String(id), String(nm)); }
  for (const sc of game.scenes) for (const d of sc.drawings) { const id = d.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId; if (id && d.flags["bbttcc-territory"].name) opener.set(String(id), String(d.flags["bbttcc-territory"].name)); }
  const byId = new Map((camp.beats || []).map(b => [String(b.id), b]));
  const report = []; let changes = 0;
  for (const b of (camp.beats || [])) {
    if (!b || !QUESTS.has(String(b.story?.quest || ""))) continue;
    const own = opener.get(String(b.id)) || null;
    for (const c of (b.choices || [])) {
      const hex = opener.get(String(c?.next || "")); if (!hex) continue;
      const t = byId.get(String(c.next));
      if (c.openTravel || t?.worldEffects?.openTravel || SAME_SITE.test(String(c.label || "")) || (own && own === hex)) continue;
      const was = c.next; c.openTravel = { hexName: hex }; c.next = ""; c._rideTo = was; changes++;
      report.push(`✚ ${b.id} "${String(c.label).slice(0, 48)}": rides to ${hex} (was → ${was})`);
    }
  }
  if (!changes) report.push("· nothing to change");
  console.log(`[trail rides 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__trailRides = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-trail-rides-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — every site exit is a ride.`);
})();
