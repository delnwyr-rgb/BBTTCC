/* bbttcc-onboarding/scripts/tour-beats.js
 * The finale weave: interface tours offered at their diegetic moments in the
 * onboarding flow. Each beat's own enter() runs FIRST (scene set, sheet open,
 * targets spawned — the owner-validated flow untouched), THEN the Operator
 * offers the matching tour before the beat's detect gate. Declining costs
 * nothing; accepting pauses the narration until the tour ends.
 *
 * Implemented as a WRAPPER layer: beats.register() replaces by id, so we
 * re-register wrapped copies after beats.js — zero edits to the validated
 * beat definitions. Tours stay independently launchable (tours.menu(), the
 * hotbar macro) per the owner-locked skippable+replayable rule.
 *
 * This file must load AFTER beats.js, tours.js and tour-defs.js in module.json.
 */

const TAG = "[onboarding/tour-beats]";
const TOUR_WAIT_CEILING_MS = 10 * 60 * 1000; // safety: never gate a beat forever

// beat id → offer spec. `prompt` is the Operator's pitch; `label` the accept
// button. A spec with menu:true offers the whole tour picker instead.
const TOUR_OFFERS = {
  meatsuit: {
    tour: "steward-sheet",
    prompt: "That sheet is your body's control surface for the whole run. Want the guided walkthrough before you swing? Sixty seconds, every dial explained.",
    label: "Walk me through the meatsuit"
  },
  driving: {
    tour: "rig-sheet",
    prompt: "The rig has a manual. Nobody reads the manual. The manual is now a guided tour with a glowing ring — want it before you drive?",
    label: "Tour the rig"
  },
  stewardship_claim: {
    tour: "hex-sheet",
    prompt: "You just claimed land. Land is an interface too — yields, holdings, radiation, the works. Tour the hex before you steward it?",
    label: "Show me the land"
  },
  stewardship_turn: {
    tour: "faction-sheet",
    prompt: "Before the Turn ticks: your faction sheet is where all of this rolls up — OP banks, health tracks, the queue. Guided tour?",
    label: "Tour the faction"
  },
  travel: {
    tour: "travel-console",
    prompt: "Travel costs OP, courts radiation, and rolls encounters. The console prices all three before you pay. Want the tour before you plot the route?",
    label: "Tour the Travel Console"
  },
  raid_violence: {
    tour: "raid-console",
    prompt: "Last classroom, One. The Raid Console is where factions bleed. Tour it before your first live round?",
    label: "Tour the Raid Console"
  },
  graduation: {
    menu: true,
    prompt: "Graduation gift: every interface manual is unlocked — Bridge, Market, Banks, Planner, all of it — as guided tours you can replay anytime. Open the shelf?",
    label: "Show me the tour shelf"
  }
};

function _tours() { return globalThis.game?.bbttcc?.onboarding?.tours || null; }

/** Operator-styled take-it-or-skip-it prompt. Resolves true if accepted. */
async function _askForTour(spec) {
  const content = `<div class="bbttcc-onboarding-prompt"><p>${spec.prompt}</p></div>`;
  const DV2 = foundry?.applications?.api?.DialogV2;
  if (DV2?.wait) {
    const res = await DV2.wait({
      window: { title: "◇ OPERATOR — Interface Tour" },
      content,
      buttons: [
        { action: "tour", label: spec.label || "Walk me through it", default: true },
        { action: "skip", label: "I've got this" }
      ],
      rejectClose: false, modal: false
    }).catch(() => "skip");
    return res === "tour";
  }
  return new Promise((resolve) => {
    new Dialog({
      title: "◇ OPERATOR — Interface Tour", content,
      buttons: {
        tour: { label: spec.label || "Walk me through it", callback: () => resolve(true) },
        skip: { label: "I've got this", callback: () => resolve(false) }
      },
      default: "tour", close: () => resolve(false)
    }).render(true);
  });
}

/** Offer + (if accepted) run the tour to completion before continuing. */
async function _offerTour(spec) {
  const tours = _tours();
  if (!tours?.start) return;
  if (spec.menu) {
    if (await _askForTour(spec)) await tours.menu();
    return;
  }
  if (!tours.get?.(spec.tour)) {
    console.warn(TAG, `tour "${spec.tour}" not registered — offer skipped`);
    return;
  }
  if (!(await _askForTour(spec))) return;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; Hooks.off("bbttcc:tour:ended", onEnd); resolve(); };
    const onEnd = (payload) => { if (payload?.id === spec.tour) finish(); };
    Hooks.on("bbttcc:tour:ended", onEnd);
    setTimeout(finish, TOUR_WAIT_CEILING_MS);
    Promise.resolve(tours.start(spec.tour)).catch((e) => { console.warn(TAG, "tour start failed", e); finish(); });
  });
}

Hooks.once("ready", () => {
  const beats = globalThis.game?.bbttcc?.onboarding?.beats;
  if (!beats?.get || !beats?.register) {
    console.warn(TAG, "director/beat registry not ready — tour offers NOT woven.");
    return;
  }
  let woven = 0;
  for (const [beatId, spec] of Object.entries(TOUR_OFFERS)) {
    const beat = beats.get(beatId);
    if (!beat) { console.warn(TAG, `beat "${beatId}" not registered — offer skipped`); continue; }
    if (beat.__tourWoven) continue;
    const originalEnter = beat.enter;
    beats.register(Object.assign({}, beat, {
      __tourWoven: true,
      enter: async (ctx) => {
        if (originalEnter) await originalEnter(ctx);          // validated flow first
        try { await _offerTour(spec); } catch (e) { console.warn(TAG, "tour offer failed", e); }
      }
    }));
    woven++;
  }
  console.log(TAG, `wove tour offers into ${woven} beat(s): ${Object.keys(TOUR_OFFERS).join(", ")}`);
});
