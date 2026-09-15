/**
 * patch-spine-gaps.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Executes gaps 1–6 from "The Spine of Thatwards Ho!" under the owner's
 * movie model (2026-08-24): everything through the first turn is prologue;
 * the TITLE CARD (Act 2 advance) drops when the first turn resolves, and
 * the trouble starts. The only prologue choice is the order of visits.
 *
 *  1. Joans routes to the Welcome Round, not the A2 Quest List.
 *  2. The Welcome Round becomes THE prologue hub: every choice that
 *     returned to quest_hub_1 now returns to town_walk; the two dead-end
 *     cinematics (HQ, St Gilliam's) gain a "Back to the Round" choice.
 *  3. NEW ag_crossroads_first_rides — the Khezek-Tor / Lyrenn / Fixit Farm
 *     decision (repeatable; do one, come back, ride the other).
 *  4. Settlement intro scenes gain a "Ride back" return to the Crossroads.
 *  5. NEW ag_days_end — the divvy-hexes / plan-Strategics / lock-the-turn
 *     checklist bridge to the Turn Driver.
 *  6. NEW ag_title_card — phaseAdvance {set:2}; offered to the GM by the
 *     turn-boundary listener (campaign module) after the first turn runs.
 *  +  Prologue roads: combat-forward weights in the tier-1 travel tables
 *     (bandit ambush ×3, apex predator ×2, mutant wildlife ×2).
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;
  const AGQ = byId.get("allesh_gilliam_town_walk")?.questId || null;
  if (!AGQ) return ui.notifications.error("town_walk beat missing — wrong campaign?");

  /* ── 1+2. The Welcome Round becomes the prologue hub ── */
  let rerouted = 0;
  for (const b of camp.beats || []) {
    for (const c of (b.choices || [])) {
      if (String(c?.next) === "allesh_gilliam_quest_hub_1") { c.next = "allesh_gilliam_town_walk"; rerouted++; }
      if (String(c?.failNext) === "allesh_gilliam_quest_hub_1") { c.failNext = "allesh_gilliam_town_walk"; rerouted++; }
    }
  }
  if (rerouted) { changes += rerouted; report.push(`· ${rerouted} route(s) quest_hub_1 → town_walk (Quest List stays as the Act-2 trouble menu)`); }

  const addReturn = (beatId, label, target) => {
    const b = byId.get(beatId);
    if (!b) { report.push(`✗ missing ${beatId}`); return; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => String(c?.next) === target)) { report.push(`· ok ${beatId} (returns already)`); return; }
    b.choices.push({ label, next: target, description: "", checkStat: "", checkDC: 0, failNext: "" });
    changes++; report.push(`· ${beatId}: "${label}" → ${target}`);
  };
  addReturn("allesh_gilliam_hq_cinematics", "Back to the Round", "allesh_gilliam_town_walk");
  addReturn("allesh_gilliam_st_gilliams_cinematics", "Back to the Round", "allesh_gilliam_town_walk");

  // "Call it a day" now leads somewhere: the Crossroads.
  const tw = byId.get("allesh_gilliam_town_walk");
  const cday = (tw.choices || []).find(c => /call it a day/i.test(String(c?.label || "")));
  if (cday && cday.next !== "ag_crossroads_first_rides") { cday.next = "ag_crossroads_first_rides"; changes++; report.push("· Call it a day → the Crossroads"); }

  /* ── 3+4+5+6. The three new beats + settlement returns ── */
  const maxStep = Math.max(0, ...(camp.beats || []).filter(b => b.questId === AGQ).map(b => Number(b.questStep) || 0));
  const mk = (id, label, step, description, choices, extra = {}) => {
    if (byId.get(id)) { report.push(`· ok beat (already) ${id}`); return; }
    const nb = {
      id, label, type: "dialog", questId: AGQ, questStep: step,
      description, choices,
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }] },
      playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      tags: "allesh_gilliam prologue spine", ...extra
    };
    camp.beats.push(nb); byId.set(id, nb); changes++; report.push(`✚ beat ${id} (step ${step})`);
  };

  mk("ag_crossroads_first_rides", "Allesh-Gilliam — The Crossroads", maxStep + 10,
    "The road forks at the edge of your holdings, and both signs are hand-painted. THATWARDS-BY-NORTH: <b>Khezek-Tor</b>, where the mine answered back and the smelters never sleep. THATWARDS-BY-GREEN: <b>Lyrenn</b>, where the fields remember you before you've been introduced. And leaning against the fork-post, a third sign somebody nailed on later: <b>FURRIER'S FIXIT FARM — WE FIX IT (MOSTLY)</b>, which sits on the road either way.\n\nThree towns hold this stretch of Thatwards together, and two of them haven't met you yet. The order is yours. The roads are not entirely yours — ride ready.",
    [
      { label: "Ride for Khezek-Tor", next: "khezek_tor_main_scene", description: "The mountain town. Smoke, ore, and a seal that hums.", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Ride for Lyrenn", next: "lyrenn_opening_scene", description: "The green town. The fields are watching, fondly.", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Stop at the Fixit Farm", next: "fixit_intro_scene", description: "On the way to everywhere. Gullywasher's pouring.", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Back to town", next: "allesh_gilliam_town_walk", description: "", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Enough riding — make camp on the day", next: "ag_days_end", description: "", checkStat: "", checkDC: 0, failNext: "" }
    ]);

  mk("ag_days_end", "Allesh-Gilliam — Day's End", maxStep + 20,
    "The sun goes down wrong-colored and gorgeous, and the coalition's first day Thatwards is spent. Before the world moves, the ledger wants three things:\n\n<b>1. Divvy the holdings.</b> Say it out loud and write it down — which hexes belong to which faction. The coalition holds them together; the deeds are separate. (Hex sheets: claim them now.)\n\n<b>2. Plan your Strategic Activities.</b> Each faction sets its work for the turn — build, patrol, trade, pray, scheme. The Plan console is open.\n\n<b>3. Lock it in.</b> When every faction's plans are set, your GM runs the <b>Turn Driver</b> and the world takes its turn.\n\nAnd then — well. Then we find out what was waiting for the ink to dry.",
    [
      { label: "Back to the crossroads — daylight left", next: "ag_crossroads_first_rides", description: "", checkStat: "", checkDC: 0, failNext: "" },
      { label: "The turn is locked. Run it.", next: "", description: "GM: run the Turn Driver. The title card is waiting on the other side.", checkStat: "", checkDC: 0, failNext: "" }
    ]);

  mk("ag_title_card", "THATWARDS HO! — Title Card", maxStep + 30,
    "The first turn is in the books: hexes held, plans laid, the world moved one tick on its axis. Somewhere a projector hums to life over the Frontier Formerly Known As Texas, and letters two stories tall slam onto the sky:\n\n<b>T H A T W A R D S &nbsp; H O !</b>\n\nRoll credits? No. Roll <i>problems</i>. The towns that welcomed you have lists. The roads you rode have watchers. The bunker rumor has a pulse. Everything that was politely waiting for you to unpack — stops waiting.\n\n⚙ GM: this beat raises the story to <b>Act 2 — the trouble</b>. The Quest Lists, the deep conversations, and the walls that need inspecting all unlock now.",
    [
      { label: "The trouble starts", next: "allesh_gilliam_town_walk", description: "Back to town — where the lists are waiting.", checkStat: "", checkDC: 0, failNext: "" }
    ],
    { inject: { repeatable: false, requires: [{ flag: "storyPhase", gte: 1 }] }, worldEffects: { phaseAdvance: { set: 2 } } });

  for (const sid of ["khezek_tor_main_scene", "lyrenn_main_scene", "fixit_intro_scene"]) {
    addReturn(sid, "Ride back — the other road waits", "ag_crossroads_first_rides");
  }

  /* ── Prologue roads: combat-forward weights on tier-1 travel tables ── */
  const WEIGHTS = { enc_bandit_ambush: 3, enc_apex_predator: 2, enc_mutant_wildlife_t2: 2 };
  let weighted = 0;
  const tablesRaw = game.settings.get(NS, "encounterTables");
  const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : foundry.utils.deepClone(tablesRaw);
  for (const [tid, t] of Object.entries(tables || {})) {
    if (!/_t(?:ier)?1$/i.test(String(tid))) continue;
    for (const e of (t?.entries || [])) {
      const w = WEIGHTS[String(e?.beatId)];
      if (w && Number(e.weight) !== w) { e.weight = w; weighted++; }
    }
  }
  if (weighted) { changes += weighted; report.push(`· prologue roads: ${weighted} combat entry weight(s) boosted across T1 tables (revert at Act 2 if the roads should calm down)`); }

  console.log(`[patch-spine-gaps] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Spine gaps DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-spine-gaps-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (weighted) await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Spine gaps APPLIED: ${changes} change(s). Backup downloaded. The prologue loop is wired.`);
})();
