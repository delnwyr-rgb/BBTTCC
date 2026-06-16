/* bbttcc-onboarding/scripts/director.js
 * The state machine. Walks the ordered beat list, gating each on the real hook the
 * subsystem already fires, and persisting progress onto the player's REAL Steward actor.
 *
 * A beat is:
 *   {
 *     id: string,
 *     title: string,
 *     scope: "shared" | "personal",   // (orchestration hint; honoured as beats land)
 *     enter?:  async (ctx) => {},      // play lines / spawn targets / dive
 *     detect?: (ctx, done) => cleanup, // wire a hook; call done() when satisfied; return cleanup
 *     exit?:   async (ctx) => {}       // teardown
 *   }
 *
 * ctx = { user, steward, faction, rig (getter), scene(key), speak, riff, prompt, director }
 *
 * Public API (game.bbttcc.onboarding):
 *   start({fromStart})  skip()  reset()  status()   beats.{register,list,get}
 */

const MODULE_ID    = "bbttcc-onboarding";
const TAG          = "[onboarding/director]";
const PROGRESS_FLAG = "progress";

const _beats = []; // ordered

function registerBeat(beat) {
  if (!beat?.id) return;
  const i = _beats.findIndex(b => b.id === beat.id);
  if (i >= 0) _beats[i] = beat; else _beats.push(beat);
}
function listBeats() { return _beats.slice(); }
function getBeat(id) { return _beats.find(b => b.id === id) || null; }

function _ns() { return globalThis.game?.bbttcc?.onboarding; }

async function _speak(line, opts) {
  const s = _ns()?.speak;
  if (typeof s === "function") return s(line, opts);
  try { await ChatMessage.create({ content: String(line ?? "") }); } catch (_) {}
}

function _progress(steward) {
  return steward?.getFlag?.(MODULE_ID, PROGRESS_FLAG)
    || { currentStep: null, steps: {}, startedAt: null, completedAt: null };
}
async function _setProgress(steward, p) {
  if (steward) { try { await steward.setFlag(MODULE_ID, PROGRESS_FLAG, p); } catch (e) { console.warn(TAG, "setProgress failed", e); } }
}

/** Cross-version "Continue" prompt (DialogV2 on v13+, Dialog fallback). Resolves "ok" or null. */
async function prompt({ title = "Operator", content = "", label = "Continue" } = {}) {
  const body = `<div class="bbttcc-onboarding-prompt">${content}</div>`;
  const DV2 = foundry?.applications?.api?.DialogV2;
  if (DV2?.wait) {
    try {
      await DV2.wait({
        window: { title }, content: body,
        buttons: [{ action: "ok", label, default: true }],
        rejectClose: false, modal: false
      });
      return "ok";
    } catch (_) { return null; }
  }
  return new Promise((res) => {
    new Dialog({
      title, content: body,
      buttons: { ok: { label, callback: () => res("ok") } },
      default: "ok", close: () => res(null)
    }).render(true);
  });
}

let _running = false;

async function start({ user = game.user, fromStart = false } = {}) {
  if (_running) { ui.notifications?.warn?.("Onboarding is already running."); return; }
  const ns = _ns();
  const steward = ns?.resolve?.steward?.(user);
  if (!steward) {
    ui.notifications?.error?.("Onboarding: no Steward assigned to you. Set your character (player config → Select Character), then run game.bbttcc.onboarding.start().");
    await _speak("No meatsuit on file for you, One. Assign your Steward first— *bzzt* —then ping me again.");
    return;
  }

  _running = true;
  try {
    let p = _progress(steward);
    if (fromStart || !p.startedAt) {
      p = { currentStep: null, steps: {}, startedAt: Date.now(), completedAt: null };
      await _setProgress(steward, p);
    }

    const ctx = {
      user, steward,
      faction: ns?.resolve?.faction?.(user, steward) || null,
      get rig() { return ns?.resolve?.rig?.(this.faction) || null; },
      scene: (key) => ns?.resolve?.scene?.(key) || null,
      speak: _speak,
      riff: (a, o) => (ns?.riff ? ns.riff(a, o) : Promise.resolve(null)),
      prompt,
      director: { registerBeat, listBeats, getBeat }
    };

    for (const beat of _beats) {
      p = _progress(steward);
      if (p.steps?.[beat.id]?.done && !fromStart) continue;

      p.currentStep = beat.id;
      await _setProgress(steward, p);

      try {
        await beat.enter?.(ctx);
        if (typeof beat.detect === "function") {
          await new Promise((resolve) => {
            let done = false, cleanup = null;
            const finish = () => {
              if (done) return; done = true;
              try { if (typeof cleanup === "function") cleanup(); } catch (_) {}
              resolve();
            };
            cleanup = beat.detect(ctx, finish) || null;
          });
        }
        await beat.exit?.(ctx);
      } catch (e) {
        console.warn(TAG, `beat "${beat.id}" threw — continuing`, e);
      }

      p = _progress(steward);
      p.steps[beat.id] = { done: true, at: Date.now() };
      await _setProgress(steward, p);
    }

    // Phase 1 is the skeleton: only "incarnation" is wired. Mark the run resolved.
    p = _progress(steward);
    p.currentStep = null;
    await _setProgress(steward, p);
    console.log(TAG, "Run finished. Completed beats:", Object.keys(p.steps || {}));
  } finally {
    _running = false;
  }
}

async function skip() {
  await _ns()?.user?.setSkipped?.(true);
  ui.notifications?.info?.("Onboarding skipped for you. Replay anytime: game.bbttcc.onboarding.start({fromStart:true}).");
}

async function reset({ user = game.user } = {}) {
  const steward = _ns()?.resolve?.steward?.(user);
  if (steward) { try { await steward.unsetFlag(MODULE_ID, PROGRESS_FLAG); } catch (_) {} }
  await _ns()?.user?.setSkipped?.(false);
  ui.notifications?.info?.(`Onboarding progress reset${steward ? ` for ${steward.name}` : ""}.`);
}

function status({ user = game.user } = {}) {
  const ns = _ns();
  const steward = ns?.resolve?.steward?.(user);
  return {
    steward: steward?.name || null,
    skipped: ns?.user?.skipped?.() ?? null,
    completed: ns?.settings?.completed?.() ?? null,
    operatorLLM: ns?.operatorAvailable?.() ?? false,
    progress: steward ? _progress(steward) : null,
    beats: _beats.map(b => b.id)
  };
}

Hooks.once("ready", () => {
  const ns = globalThis.game?.bbttcc?.onboarding;
  if (!ns) return;
  ns.beats = { register: registerBeat, list: listBeats, get: getBeat };
  Object.assign(ns, { start, skip, reset, status });

  try {
    if (game.user.isGM && ns.settings?.get?.("offerOnReady") && !ns.settings.completed() && !ns.user.skipped()) {
      console.log(TAG, "Onboarding available — run game.bbttcc.onboarding.start() to begin (or .status() to inspect).");
    }
  } catch (_) {}
});
