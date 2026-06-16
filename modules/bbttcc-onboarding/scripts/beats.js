/* bbttcc-onboarding/scripts/beats.js
 * The ordered beat definitions.
 *   Phase 1: incarnation
 *   Phase 2: meatsuit (test real abilities), driving (pilot the real rig)
 *
 * Each beat drives a REAL subsystem the player owns and detects completion off that
 * subsystem's existing hook. All spawns are contained to dedicated tutorial Scenes.
 */

const MODULE_ID = "bbttcc-onboarding";
const TAG = "[onboarding/beats]";

const _tx = () => globalThis.game?.bbttcc?.api?.transition || null;
const _stage = () => globalThis.game?.bbttcc?.onboarding?.stage || null;
const _pause = (ms) => new Promise(r => setTimeout(r, ms)); // beat pacing — let steps land

/** Dive into a tutorial Scene (GM-solo/non-destructive), falling back to a plain view. */
async function _enterScene(scene, label) {
  if (!scene) return;
  const tx = _tx();
  try {
    if (tx?.dive) await tx.dive(scene.uuid, { focus: { x: scene.width / 2, y: scene.height / 2 }, audience: "view", label });
    else await scene.view?.();
  } catch (e) {
    console.warn(TAG, `dive into "${label}" failed; viewing instead`, e);
    try { await scene.view?.(); } catch (_) {}
  }
}

/* ───────────────────────── INCARNATION ───────────────────────── */
const incarnation = {
  id: "incarnation",
  title: "Incarnation",
  scope: "shared",

  enter: async (ctx) => {
    await ctx.speak("Connection established. You were The One — a perfect run, god-mode earned, a story told true enough to become load-bearing in the weave of things.");
    await ctx.speak("So we spun you back in to fix what broke. The catch— *bzzt* —you'll be doing it from inside a homemade Foundry video game. Mine. Try not to touch the walls.");

    const scene = ctx.scene("incarnation");
    if (scene) await _enterScene(scene, "Incarnate");
    else console.warn(TAG, "No 'incarnation' tutorial Scene — run tools/onboarding-setup.macro.js. Continuing without the dive.");

    ctx.riff({ beat: "incarnation", line: "Welcome the reincarnated One into the homemade game and prep them to take a body.", intent: "Ominous, glitchy, a little funny. One short aside." });
  },

  detect: (ctx, done) => {
    ctx.prompt({
      title: "◇ OPERATOR",
      content:
        `<p>Time to put on a body. We're dropping your consciousness into your <b>Steward</b> — your meatsuit for this run.</p>` +
        `<p>Everything from here uses your <i>real</i> interface: your sheet, your rig, your faction. No training wheels, just guard-rails.</p>` +
        `<p>When you're ready, incarnate.</p>`,
      label: "Drop into my meatsuit"
    }).then(() => done());
    return null;
  },

  exit: async (ctx) => {
    await ctx.speak(`You're in, ${ctx.steward?.name || "Steward"}. Wiggle the fingers, check the seams. Next module loading— *bzzt*`);
  }
};

/* ───────────────────────── MEATSUIT ───────────────────────── */
// Test the REAL Steward: open the real sheet, fire any real ability. A disposable dummy
// gives them a target. Detected via the existing `fourththing:itemAnimated` hook.
const meatsuit = {
  id: "meatsuit",
  title: "Test the Meatsuit",
  scope: "personal",

  enter: async (ctx) => {
    ctx._spawned = [];
    await ctx.speak("Body's warm. Let's make sure it works before something tries to end it. Open your sheet — that's YOUR interface now, not a tutorial mock-up.");
    await _pause(900);

    const scene = ctx.scene("meatsuit-range");
    if (scene) { await _enterScene(scene, "Proving Range"); await _pause(800); } // let the dive settle before spawning

    // Contain the steward + dummy to the range (never the live map).
    const stage = _stage();
    if (stage && scene) {
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, { x: Math.round(scene.width * 0.4), y: Math.round(scene.height * 0.5) });
      if (st.created) ctx._spawned.push({ token: st.doc });
      const dummy = await stage.spawnDummy(scene, { x: Math.round(scene.width * 0.6), y: Math.round(scene.height * 0.5), name: "Straw Adversary" });
      if (dummy) ctx._spawned.push(dummy);
    }
    await _pause(500);
    try { ctx.steward?.sheet?.render(true, { focus: true }); } catch (_) {}
    await ctx.speak("Pick any ability and fire it — doesn't matter which, I just need to see the meat answer the mind. Target the straw adversary for a flourish.");
    ctx.riff({ beat: "meatsuit", line: "Player is about to test their real abilities for the first time.", intent: "Encourage them to swing. Dry, glitchy, one line." });
  },

  detect: (ctx, done) => {
    const onAnim = (data = {}) => {
      const a = data.actor || data.sourceToken?.actor;
      if (a?.id === ctx.steward?.id) done();
    };
    Hooks.on("fourththing:itemAnimated", onAnim);
    return () => Hooks.off("fourththing:itemAnimated", onAnim);
  },

  exit: async (ctx) => {
    await ctx.speak("There it is — reflexes intact, soul bolted in. The straw adversary sends its regards— *bzzt* —dismissing it now.");
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
  }
};

/* ───────────────────────── DRIVING ───────────────────────── */
// Pilot the faction's REAL starter rig (mint a Hexmobile if absent). Detected when the
// rig's hexesMoved increments (the "steer" crew action), off `updateActor`.
const driving = {
  id: "driving",
  title: "Test the Driving",
  scope: "personal",

  enter: async (ctx) => {
    ctx._spawned = [];
    ctx._rig = null;
    await ctx.speak("Every Steward gets a rig. Yours is parked — let's see if you can move it without folding it into a wall.");
    await _pause(900);

    let rig = ctx.rig; // resolves the faction's real rig
    if (!rig && ctx.faction) {
      rig = await _stage()?.mintRig?.(ctx.faction.id, "hexmobile"); // routes through GM relay
      if (rig) { await ctx.speak("No rig on file— *bzzt* —minted you a Hexmobile on the house. Don't get attached."); await _pause(700); }
    }
    ctx._rig = rig || null;

    const scene = ctx.scene("driving-course");
    if (scene) { await _enterScene(scene, "Test Track"); await _pause(800); }

    const stage = _stage();
    if (scene && stage) {
      // Place the Steward FIRST — the meatsuit beat removed the range token on cleanup,
      // so without this there's no pilot on the Test Track to board the rig with.
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, { x: Math.round(scene.width * 0.42), y: Math.round(scene.height * 0.5) });
      if (st.created) ctx._spawned.push({ token: st.doc });
      if (rig) {
        const rt = await stage.ensureTokenOnScene(rig, scene, { x: Math.round(scene.width * 0.55), y: Math.round(scene.height * 0.5) });
        if (rt.created) ctx._spawned.push({ token: rt.doc });
      }
    }
    await _pause(500);
    try { rig?.sheet?.render(true, { focus: true }); } catch (_) {}
    if (rig) await ctx.speak("Board it and take the pilot seat, then use the STEER action — watch for the blue ring. (Steer spends a pilot action, so if it balks, start or advance a combat turn to refresh one.)");
    else await ctx.speak("Couldn't find or mint a rig for your faction. Make sure you lead a faction, then re-run this beat. Skipping the test track for now.");

    ctx.riff({ beat: "driving", line: "Player is about to pilot their rig for the first time.", intent: "Gruff driving-instructor daemon. One line." });
  },

  detect: (ctx, done) => {
    const rig = ctx._rig;
    if (!rig) {
      // No rig to test — gate on a manual continue rather than hang.
      ctx.prompt({ title: "◇ OPERATOR", content: "<p>No rig to test right now. Continue when ready.</p>", label: "Continue" }).then(() => done());
      return null;
    }
    const onUpd = (actor, changed) => {
      if (actor?.id !== rig.id) return;
      const moved = changed?.flags?.fourththing?.combat?.hexesMoved;
      if (moved !== undefined && Number(moved) > 0) done();
    };
    Hooks.on("updateActor", onUpd);
    return () => Hooks.off("updateActor", onUpd);
  },

  exit: async (ctx) => {
    if (ctx._rig) await ctx.speak("Moving. Sloppy, but moving. The rig'll forgive you; the terrain won't. Parking it — next module.");
    const stage = _stage();
    // Sever the boarding connection FIRST (un-hides the Steward's tokens everywhere),
    // THEN remove the tutorial tokens — order matters so no real token is left hidden.
    try { await stage?.disembark?.(ctx.steward?.id, ctx._rig?.id); } catch (_) {}
    try { await stage?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._rig = null;
  }
};

/* ───────────────────────── REGISTRATION ───────────────────────── */
Hooks.once("ready", () => {
  const ns = globalThis.game?.bbttcc?.onboarding;
  if (!ns?.beats?.register) {
    console.warn(TAG, "onboarding namespace not ready — beats NOT registered.");
    return;
  }
  for (const beat of [incarnation, meatsuit, driving]) ns.beats.register(beat);
  console.log(TAG, "Registered beats:", ns.beats.list().map(b => b.id).join(", "));
});
