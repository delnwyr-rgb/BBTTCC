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
// button; `resume` is spoken AFTER a taken tour ends, restating the beat's gate
// (the original instruction has long scrolled out of chat by then — owner
// playtest 2026-08-11: finished the tour, no cue, thought the flow was stuck).
// A spec with menu:true offers the whole tour picker instead.
const TOUR_OFFERS = {
  meatsuit: {
    tour: "steward-sheet",
    prompt: "That sheet is your body's control surface for the whole run. Want the guided walkthrough before you swing? Sixty seconds, every dial explained.",
    label: "Walk me through the meatsuit",
    resume: "Walkthrough's done — now the live-fire. Pick one ABILITY — a real power off your sheet's list or the HUD tray, not an aptitude check like Violence — and fire it. The straw adversary is right there, begging."
  },
  driving: {
    tour: "rig-sheet",
    prompt: "The rig has a manual. Nobody reads the manual. The manual is now a guided tour with a glowing ring — want it before you drive?",
    label: "Tour the rig",
    resume: "Manual closed. Board the rig, take the pilot seat, STEER — then put it through every wreck on the track. All of them, One. The storm can watch."
  },
  stewardship_claim: {
    tour: "hex-sheet",
    prompt: "You just claimed land. Land is an interface too — yields, holdings, radiation, the works. Tour the hex before you steward it?",
    label: "Show me the land",
    resume: "Tour's over — now make it official. Plant the banner on Tutelary Hold with the button I left you."
  },
  // Multi-offer beat (array = offered in order). Faction-sheet is the skipIfTaken
  // safety net for players who declined it at founding; the BRIDGE is deliberate
  // curriculum here (owner call 2026-08-13: "esoteric enough it needs a specific
  // call-out" — the steward↔faction OP walkway, and this is the OP beat).
  stewardship_turn: [
    {
      tour: "faction-sheet",
      skipIfTaken: true,
      prompt: "Before the Turn ticks: your faction sheet is where all of this rolls up — OP banks, health tracks, the queue. Guided tour?",
      label: "Tour the faction",
      resume: "Good. That sheet is mission control — everything else reports to it."
    },
    {
      tour: "bridge",
      prompt: "One more, and nobody finds this one alone: the BRIDGE — the walkway between your Steward's pockets and the faction's treasury. Personal OP, faction OP, and the transfers between them. Sixty seconds?",
      label: "Tour the Bridge",
      resume: "Bridge crossed. Now feel the heartbeat — run the practice Turn preview when you're ready."
    }
  ],
  outfitting: {
    tour: "market",
    prompt: "The Long Market has a manual too — buyer context, the Horizon chip, who pays versus who receives. Want the tour before you spend the stipend?",
    label: "Tour the Market",
    resume: "Market toured. Now SHOP: buy what your training can carry, equip it on your sheet, and conclude when you're dressed for trouble."
  },
  travel: {
    tour: "travel-console",
    prompt: "Travel costs OP, courts radiation, and rolls encounters. The console prices all three before you pay. Want the tour before you plot the route?",
    label: "Tour the Travel Console",
    resume: "Console toured. Now make the crossing — plot the route into the Rust Syndicate Hold and GO."
  },
  raid_violence: {
    tour: "raid-console",
    prompt: "Last classroom, One. The Raid Console is where factions bleed. Tour it before your first live round?",
    label: "Tour the Raid Console",
    resume: "Class dismissed. The console's hot and pre-aimed — pick maneuvers, commit a round or two, then conclude."
  },
  graduation: {
    menu: true,
    prompt: "Graduation gift: every interface manual is unlocked — Bridge, Market, Banks, Planner, all of it — as guided tours you can replay anytime. Open the shelf?",
    label: "Show me the tour shelf",
    resume: "The shelf stays unlocked forever. The door ahead doesn't wait, though — step into Bad Eden when you're ready."
  }
};

function _tours() { return globalThis.game?.bbttcc?.onboarding?.tours || null; }
function _ui() { return globalThis.game?.bbttcc?.onboarding?.ui || null; }

const OFFER_TITLE = "◇ OPERATOR — Interface Tour";

/** Operator-styled take-it-or-skip-it prompt. Resolves true if accepted. */
async function _askForTour(spec) {
  const content = `<div class="bbttcc-onboarding-prompt"><p>${spec.prompt}</p></div>`;
  const DV2 = foundry?.applications?.api?.DialogV2;
  const pos = _ui()?.PROMPT_POSITION ?? { top: 96, left: 120, width: 440 };
  // Prefix id: the director's between-beat sweep can reap an orphaned offer too.
  const dlgId = _ui()?.promptIdFor?.(OFFER_TITLE) ?? "bbttcc-ob-prompt-interface-tour";
  _ui()?.raiseDialogByTitle?.(OFFER_TITLE); // sheets render just before this — stay on top
  if (DV2?.wait) {
    const res = await DV2.wait({
      id: dlgId,
      window: { title: OFFER_TITLE },
      content,
      position: { ...pos },
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
      title: OFFER_TITLE, content,
      buttons: {
        tour: { label: spec.label || "Walk me through it", callback: () => resolve(true) },
        skip: { label: "I've got this", callback: () => resolve(false) }
      },
      default: "tour", close: () => resolve(false)
    }, { id: dlgId, ...pos }).render(true);
  });
}

// Tours taken this session (by tour id) — lets a spec with skipIfTaken avoid
// re-offering a tour the player already sat through at an earlier seam.
const _toursTaken = new Set();

/** Offer + (if accepted) run the tour to completion before continuing. Resolves true if a tour ran. */
async function _offerTour(spec) {
  const tours = _tours();
  if (!tours?.start) return false;
  if (spec.menu) {
    if (await _askForTour(spec)) { await tours.menu(); return true; }
    return false;
  }
  if (spec.skipIfTaken && _toursTaken.has(spec.tour)) return false;
  if (!tours.get?.(spec.tour)) {
    console.warn(TAG, `tour "${spec.tour}" not registered — offer skipped`);
    return false;
  }
  if (!(await _askForTour(spec))) return false;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; Hooks.off("bbttcc:tour:ended", onEnd); resolve(); };
    const onEnd = (payload) => { if (payload?.id === spec.tour) finish(); };
    Hooks.on("bbttcc:tour:ended", onEnd);
    setTimeout(finish, TOUR_WAIT_CEILING_MS);
    Promise.resolve(tours.start(spec.tour)).catch((e) => { console.warn(TAG, "tour start failed", e); finish(); });
  });
  _toursTaken.add(spec.tour);
  return true;
}

/* ───────────── First-open tour offers (owner call 2026-08-13) ─────────────
 * Some interfaces earn their tour the first time a player actually opens them:
 *   Activity Planner → planner-hud tour (never offered in the flow)
 *   Raid Console     → raid-console tour (again, as a reminder — the flow's
 *                      offer comes mid-finale with a live console open)
 * Implemented by wrapping the public open APIs (same pattern as the forge
 * wrapping ns.start). Offered ONCE per user (persistent user flag, set whether
 * they accept or decline), players only, and suppressed while the onboarding
 * director is running or another tour is active. */
const FIRST_OPEN_OFFERS = [
  {
    api: () => globalThis.game?.bbttcc?.api?.raid, fn: "openActivityPlanner", tour: "planner-hud",
    prompt: "First time in the Activity Planner? This is everything your faction can do that isn't hitting someone — and it compounds. Sixty seconds, every dial explained?",
    label: "Tour the Planner"
  },
  {
    api: () => globalThis.game?.bbttcc?.api?.raid, fn: "openConsole", tour: "raid-console",
    prompt: "Back at the sharp end — want the Raid Console refresher? Stage OP, pick maneuvers, commit the round. Quick walk-through before blood?",
    label: "Refresh me"
  }
];

async function _maybeFirstOpenOffer(spec) {
  try {
    const ns = globalThis.game?.bbttcc?.onboarding;
    if (game.user?.isGM) return;                                  // players only
    if (ns?.isRunning?.()) return;                                // the flow has its own offers
    if (ns?.tours?.active?.()) return;                            // never interrupt a running tour
    if (game.user?.getFlag?.("bbttcc-onboarding", `firstOpenOffered.${spec.tour}`)) return;
    await game.user.setFlag("bbttcc-onboarding", `firstOpenOffered.${spec.tour}`, true);
    await new Promise(r => setTimeout(r, 800));                   // let the app render first
    await _offerTour({ tour: spec.tour, prompt: spec.prompt, label: spec.label });
  } catch (e) { console.warn(TAG, "first-open offer failed", e); }
}

function _installFirstOpenOffers() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    let allWrapped = true;
    for (const spec of FIRST_OPEN_OFFERS) {
      const api = spec.api();
      const orig = api?.[spec.fn];
      if (typeof orig !== "function") { allWrapped = false; continue; }   // api not up yet — retry
      if (orig.__firstOpenTour) continue;
      const wrapped = function (...args) {
        const result = orig.apply(this, args);
        _maybeFirstOpenOffer(spec);                               // fire-and-forget, never blocks the open
        return result;
      };
      wrapped.__firstOpenTour = true;
      api[spec.fn] = wrapped;
      console.log(TAG, `first-open tour offer armed on ${spec.fn} → ${spec.tour}`);
    }
    if (allWrapped || tries > 20) clearInterval(iv);              // ~10s worth of retries
  }, 500);
}

Hooks.once("ready", () => {
  const ns = globalThis.game?.bbttcc?.onboarding;
  // Exposed so other onboarding seams (incarnation-forge's founding ceremony)
  // can offer a tour at their own diegetic moment through the same machinery.
  if (ns) ns.offerTour = _offerTour;
  const beats = ns?.beats;
  if (!beats?.get || !beats?.register) {
    console.warn(TAG, "director/beat registry not ready — tour offers NOT woven.");
    return;
  }
  let woven = 0;
  for (const [beatId, specOrList] of Object.entries(TOUR_OFFERS)) {
    const specs = Array.isArray(specOrList) ? specOrList : [specOrList];
    const beat = beats.get(beatId);
    if (!beat) { console.warn(TAG, `beat "${beatId}" not registered — offer skipped`); continue; }
    if (beat.__tourWoven) continue;
    const originalEnter = beat.enter;
    beats.register(Object.assign({}, beat, {
      __tourWoven: true,
      enter: async (ctx) => {
        if (originalEnter) await originalEnter(ctx);          // validated flow first
        for (const spec of specs) {
          let took = false;
          try { took = await _offerTour(spec); } catch (e) { console.warn(TAG, "tour offer failed", e); }
          // Tours run long — restate the beat's gate so the player lands knowing their next move.
          if (took && spec.resume) { try { await ctx.speak?.(spec.resume); } catch (_) {} }
        }
      }
    }));
    woven++;
  }
  console.log(TAG, `wove tour offers into ${woven} beat(s): ${Object.keys(TOUR_OFFERS).join(", ")}`);
  _installFirstOpenOffers();
});
