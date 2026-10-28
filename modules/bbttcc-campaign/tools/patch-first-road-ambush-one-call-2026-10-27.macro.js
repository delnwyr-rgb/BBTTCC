/* patch-first-road-ambush-one-call-2026-10-27.macro.js — call the first-road Battle ONCE (Dave, 2026-10-27).
 *  Why: "It was a little confusing to see a secondary adjudication button pop up … the GM window was asking for a decision
 *   on the overall battle" — the Domain Conflict console's "Battle — call it" (Won / Stalemate / Lost) and the beat's
 *   Aftermath card (Win / Bandits run / Run / Lose) asked the same question. "Yes, please build it and make the
 *   experience a little more clean."
 *   EDIT  first_road_ambush  worldEffects.raid.routes = { win: "pick:first_road_ambush_results#Win",
 *                            stalemate: "pick:…#Bandits run", loss: "pick:…#Lose" } — calling the Battle presses the
 *                            Aftermath card's matching choice (bbttcc-raid _rcStoryRoute → api.campaign.pickOpenBeatChoice).
 *   EDIT  first_road_ambush_results  its opening line says so: the call answers this card; "Run" stays a manual pick.
 *  The card stays open during the fight on purpose: it is what holds the Khezek-Tor arrival until the fight is done.
 *  Needs bbttcc-campaign module.js (pickOpenBeatChoice) + bbttcc-raid module.raid-console.js (pick: routes), both
 *  2026-10-27, deployed FIRST. Idempotent; DRY_RUN default true; `campaigns` as a true JSON copy. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", AMB = "first_road_ambush", RES = "first_road_ambush_results";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const amb = byId.get(AMB), res = byId.get(RES);
  if (!amb?.worldEffects?.raid || !res) return ui.notifications.error(`${AMB} (with its raid offer) or ${RES} missing — nothing changed.`);
  const report = []; let changes = 0;

  const labels = (res.choices || []).map(c => String(c.label || ""));
  const find = (rx) => labels.find(l => rx.test(l));
  const win = find(/^win\b/i), stale = find(/bandits run/i), lose = find(/^lose\b/i);
  if (!win || !stale || !lose) return ui.notifications.error(`${RES}: expected Win / Bandits run / Lose choices, found: ${labels.join(" · ")}`);
  const ROUTES = { win: `pick:${RES}#${win}`, stalemate: `pick:${RES}#${stale}`, loss: `pick:${RES}#${lose}` };
  const cur = amb.worldEffects.raid.routes || null;
  if (cur && cur.win === ROUTES.win && cur.stalemate === ROUTES.stalemate && cur.loss === ROUTES.loss) report.push(`· ok ${AMB}: the Battle call answers the Aftermath card`);
  else { amb.worldEffects.raid.routes = ROUTES; changes++; report.push(`✎ ${AMB}: Won → "${win}" · Stalemate → "${stale}" · Lost → "${lose}"`); }

  const NOTE = "<i>Call the Battle in the Domain Conflict console when the fight is done — your call answers this card. If the party broke and ran, pick Run here.</i>";
  const d = String(res.description || "");
  if (d.includes(NOTE)) report.push(`· ok ${RES}: says the call answers it`);
  else { res.description = d.replace(/\s*$/, "") + "\n\n" + NOTE; changes++; report.push(`✎ ${RES}: + "your call answers this card"`); }

  console.log(`[first road one call 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + `\n(card text was: ${d.slice(0, 200)}…)`);
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — one call for the first-road Battle.`);
})();
