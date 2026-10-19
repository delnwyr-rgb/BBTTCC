/* patch-act1-offered-fights-2026-10-18.macro.js — TEACHING BEATS 9 + 10 + the Battle's offer (Alpha Cut rulings 21/22/23,
 *  Dave 2026-10-18: "the story offers every fight — stewards can't decide to raid"; "Let's GOOOO").
 *
 *  Finding (why/when survey 10-17, re-run 10-18 on live): Act 0–1 has ONE fight — the first road ambush (Battle, Act 1) — and
 *  no Heist or Parley anywhere before Act 2. With the thirty-minute induction (ruling 23) the practice raids are gone, so the
 *  story has to hand out all three. Each offer is ONE choice on a beat that already exists, carrying `worldEffects.raid`
 *  (ruling 22): taking it opens the console aimed on every seat that owns the Domain; declining is an ordinary choice.
 *
 *   EDIT  first_road_ambush          + worldEffects.raid { battle, Khezek-Tor, objectiveOnly } — the road, not the town (ruling 21)
 *   NEW   ag_wick_room_heist_offer   the Vacancy, upstairs: the second door is a HEIST (the inn is the alarm) → ag_wick_room
 *                                    inserted between ag_vacancy_upstairs and ag_wick_room; Act 1+
 *   NEW   reliable_lease_parley      the Absolutely Reliable: terms across the tarp with Young Gearbox = a PARLEY
 *                                    (Persuade / Impress; Sweeten the deal is the price) — reached from the Last-Turn card
 *                                    and from What She Costs; court scene arc_bay_interior_pov (tableau switched on by the offer)
 *   EDIT  reliable_lease_last_turn   + choice "Sit down with Gearbox over the lease (a Parley)"
 *   EDIT  reliable_price             + choice "Talk him down — a Parley"
 *
 *  Outcome routing (renewal / keys after a won Parley) is the GM's call this pass — the Parley card and the lease beats carry it.
 *  Idempotent (id / choice-label guards); DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [ACT1-OFFERED-FIGHTS-2026-10-18]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const need = (id) => { const b = byId.get(id); if (!b) report.push(`⚠ ${id}: NOT FOUND`); return b; };
  const addChoice = (beat, choice, before = null) => {
    if ((beat.choices || []).some(c => c.label === choice.label)) { report.push(`· ok ${beat.id}: choice "${choice.label}" present`); return; }
    beat.choices ||= [];
    const i = before != null ? beat.choices.findIndex(c => c.label === before) : -1;
    if (i >= 0) beat.choices.splice(i, 0, choice); else beat.choices.push(choice);
    changes++; report.push(`✚ ${beat.id}: + choice "${choice.label}"`);
  };
  const upsert = (id, build) => {
    if (byId.has(id)) { report.push(`· ok ${id}: exists`); return byId.get(id); }
    const nb = build(); camp.beats.push(nb); byId.set(id, nb); changes++; report.push(`✚ NEW ${id} — ${nb.label}`); return nb;
  };

  // ── 1. the Battle: the first road ambush offers itself (ruling 22) — the road, not the town (ruling 21) ──
  const amb = need("first_road_ambush");
  if (amb) {
    amb.worldEffects ||= WE();
    if (!amb.worldEffects.raid) {
      amb.worldEffects.raid = { type: "battle", hexName: "Khezek-Tor", objectiveOnly: true, stake: "The road, not the town. Win and the way to Khezek-Tor is yours; the hex is nobody's prize today." };
      changes++; report.push("✚ first_road_ambush: + worldEffects.raid (battle · Khezek-Tor · objective only)");
    } else report.push("· ok first_road_ambush: raid offer present");
  }

  // ── 2. the Heist: the Vacancy, upstairs — the second door (teaching beat 9) ──
  const upstairs = need("ag_vacancy_upstairs"), room = need("ag_wick_room");
  if (upstairs && room) {
    const HEIST = "ag_wick_room_heist_offer";
    upsert(HEIST, () => ({
      id: HEIST, label: "The Vacancy — The Second Door (a Heist)", type: "dialog",
      sceneId: upstairs.sceneId || "", playerFacing: true,
      tags: "quest:ag-vacancy,teaching.heist,alpha.teaching",
      description:
        "The star is beside the second door. Downstairs, Wick keeps his vigil over a candle that will not run out before you do; Verna's ledger is open on the desk, and her ears are better than her eyes.\n\n" +
        "<b>This is a Heist.</b> Quiet work on the battlemap, in combat rounds: get in, read what the pilgrim keeps, leave it square, get out. The inn is the alarm — every creak the GM counts, and if the meter fills the house wakes and this becomes a different evening. Nothing changes hands but what you learn.\n\n" +
        "<b>Decline</b> and the door stays shut, and so does whatever is behind it, until you find another way to ask.",
      memoryText: "Slipped into the pilgrim's room at the Vacancy. Your first Heist.",
      choices: [
        ch("Slip in while he keeps vigil (a Heist)", "The console opens aimed. Your Domain brings what it owns; the GM counts the creaks.", {
          next: "ag_wick_room",
          worldEffects: { raid: { type: "heist", hexName: "Allesh-Gilliam", objectiveOnly: true, stake: "Wick's drops: read them and leave the room square. The inn is the alarm." } }
        }),
        ch("Think better of it — back down to the desk", "", { next: "allesh_gilliam_vacancy_intro" })
      ],
      worldEffects: WE(),
      inject: { repeatable: true, cooldownTurns: 0, oncePerHex: false, requires: [{ flag: "storyPhase", gte: 1 }] }
    }));
    const star = (upstairs.choices || []).find(c => /second door/i.test(String(c.label || "")));
    if (star && star.next === "ag_wick_room") { star.next = HEIST; changes++; report.push("✚ ag_vacancy_upstairs: the second door now opens the Heist offer"); }
    else if (star && star.next === HEIST) report.push("· ok ag_vacancy_upstairs: already routes to the offer");
    else report.push("⚠ ag_vacancy_upstairs: 'second door' choice not found — route by hand");
  }

  // ── 3. the Parley: terms across the tarp (teaching beat 10) ──
  const lastTurn = need("reliable_lease_last_turn"), price = need("reliable_price");
  if (lastTurn || price) {
    const PARLEY = "reliable_lease_parley";
    const offer = (goal, extra = {}) => ({ raid: Object.assign({ type: "parley", hexName: "Furrier's Fixit-Farm", courtScene: "arc_bay_interior_pov", goal, stake: "The Absolutely Reliable: three more turns at the old rate, or the keys. Marks on the table are Sweeten the deal — the Farm keeps them whatever happens." }, extra) });
    upsert(PARLEY, () => ({
      id: PARLEY, label: "The Absolutely Reliable — Terms Across the Tarp (a Parley)", type: "dialog",
      sceneId: "x4IJo7y7YyUkICxH", playerFacing: true,
      tags: "quest:absolutely-reliable,teaching.parley,alpha.teaching",
      description:
        "Young Gearbox pours the coffee, turns the parts tag face-down, and waits. Behind him Mara pretends to inventory air filters. Outside, the hovercraft ticks as she cools.\n\n" +
        "<b>This is a Parley.</b> Talked out at the table, no dice: your Domain's standing against the Farm's, round by round, until one of you folds or the coffee runs out. Pick what you came to do — <b>Persuade</b> him to renew at the old rate, or <b>Impress</b> the Farm enough that she stays. If marks will help, put them on the table where he can see them: that is <b>Sweeten the deal</b>, the only time marks change hands in a fight, and the Farm keeps them whatever happens.\n\n" +
        "<b>Win</b> and the Absolutely Reliable stays — the lease renews, or the keys come across. <b>Lose</b> and she goes home when the lease runs out, same as the card said. Nobody gets hurt. Mara keeps the filters.",
      memoryText: "Sat down with Young Gearbox over the Absolutely Reliable. Your first Parley.",
      choices: [
        ch("Persuade — renew at the old rate", "The console opens aimed; the goal is set. Your GM runs the rounds from the Arc Bay.", { worldEffects: offer("persuade") }),
        ch("Impress — show the Farm what she'd be part of", "The console opens aimed on a show; the crowd is the Arc Bay.", { worldEffects: offer("impress", { style: "show" }) }),
        ch("Not today.", "The tag stays face-down. The offer keeps.", { next: "" })
      ],
      worldEffects: WE(),
      inject: { repeatable: true, cooldownTurns: 0, oncePerHex: false, requires: [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }] }
    }));
    if (lastTurn) addChoice(lastTurn, ch("Sit down with Gearbox over the lease (a Parley)", "Ride to the Farm and talk terms across the tarp.", { next: PARLEY }));
    if (price) addChoice(price, ch("Talk him down — a Parley", "Thirty each is an opening, not a price.", { next: PARLEY }), "Not yet.");
  }

  console.log(`[patch-act1-offered-fights] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Offered fights DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Offered fights: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-offered-fights-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Offered fights APPLIED: ${changes} change(s). The story now offers the Battle, the Heist and the Parley.`);
})();
