/* patch-wick-meets-kid-order-2026-10-27.macro.js — the kid in your footsteps arrives BEFORE Wick (Dave, 2026-10-27).
 *  Why: "We mention the kid walking in our shoes now walking in Wick's shoes before the beat with the kid lands. It's,
 *   in fact, the next beat." AJ's "Walk your new town" runs ag_walk_wick FIRST, then allesh_gilliam_town_walk — but the
 *   kid (and "by the second street… the wall creaks, the chimes answer") was introduced in the town walk.
 *  Ruling (Dave: "go ahead"): keep the run-in with Wick first; move the arrival into it.
 *   EDIT ag_walk_wick                opens with the town walk's arrival (to-do list line, word of your arrival, the kid,
 *                                     the brisket bus), then "Then the wall creaks, the chimes answer, and one of them doesn't…"
 *                                     — the rest of Wick's text unchanged.
 *   EDIT allesh_gilliam_town_walk    {{#played ag_walk_wick}} short hub text (no kid, no second street) {{else}} the full
 *                                     text as before {{/played}} — a table that never met Wick still meets the kid.
 *  Text only; routing untouched. Idempotent; DRY_RUN default true; `campaigns` as a true JSON copy. GM only.
 *  Back up world settings first. Mirror into the Beat Polish doc (Act 0–1 tab).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const TODO = "Nobody hands you a to-do list. That's tomorrow's problem — today the town wants to be met.";
  const ARRIVAL = "Word of your arrival moves faster than you do. By the second street, people have already sorted you: nod, wave, wary once-over, one kid walking exactly in your footsteps like it's a game with rules. Somebody's smoking brisket in a half-buried school bus.";
  const OLD_WALK_ARRIVAL = ARRIVAL + " The wall creaks. The chimes answer.";
  const HUB = "Allesh-Gilliam doesn't ask what you're going to fix. It asks whether you'll eat here, sleep here, learn names here. Everything else — and there is going to be an EVERYTHING else — keeps until you've been introduced.\n\nWhere to first?";
  const OLD_WALK = `${TODO}\n\n${OLD_WALK_ARRIVAL}\n\n${HUB}`;
  const NEW_WALK = `{{#played ag_walk_wick}}${HUB}{{else}}${OLD_WALK}{{/played}}`;
  const OLD_WICK_OPEN = "Halfway down the second street the wall creaks, the chimes answer, and one of them doesn't:";
  const NEW_WICK_OPEN = `${TODO}\n\n${ARRIVAL}\n\nThen the wall creaks, the chimes answer, and one of them doesn't:`;

  const wick = byId.get("ag_walk_wick");
  const wd = String(wick?.description || "");
  if (!wick) report.push("⚠ ag_walk_wick missing");
  else if (wd.startsWith(TODO) && wd.includes("one kid walking exactly in your footsteps")) report.push("· ok ag_walk_wick already opens with the arrival");
  else if (wd.startsWith(OLD_WICK_OPEN)) { wick.description = NEW_WICK_OPEN + wd.slice(OLD_WICK_OPEN.length); changes++; report.push("✎ ag_walk_wick: opens with the arrival + the kid, then the chime"); }
  else report.push("⚠ ag_walk_wick: opening line not as expected — left alone");

  const walk = byId.get("allesh_gilliam_town_walk");
  const ww = String(walk?.description || "");
  if (!walk) report.push("⚠ allesh_gilliam_town_walk missing");
  else if (ww === NEW_WALK) report.push("· ok allesh_gilliam_town_walk already short after Wick");
  else if (ww === OLD_WALK) { walk.description = NEW_WALK; changes++; report.push("✎ allesh_gilliam_town_walk: short hub text once Wick is met; full arrival otherwise"); }
  else report.push("⚠ allesh_gilliam_town_walk: text not as expected — left alone");

  console.log(`[wick meets kid 2026-10-27] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the kid arrives before Wick.`);
})();
