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

/* Onboarding dialogs anchor top-left, clear of centre-rendered sheets; sheets that
 * render right before/after a prompt still steal the z-order, so raiseDialogByTitle
 * re-fronts the dialog a few times over ~2s after it appears.
 *
 * Every onboarding dialog carries an explicit `id` with PROMPT_ID_PREFIX (owner
 * playtest 2026-08-11: title-matching wasn't reliable — completed beats left their
 * fallback prompts hanging). Ids make close/raise an exact Map lookup, and the
 * director sweeps ALL prefix-matched dialogs between beats as the backstop. */
const PROMPT_POSITION = { top: 96, left: 120, width: 440 };
const PROMPT_ID_PREFIX = "bbttcc-ob-prompt-";
const promptIdFor = (title) =>
  PROMPT_ID_PREFIX + String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function _v2Apps() {
  try {
    const inst = foundry?.applications?.instances;
    return inst?.values ? Array.from(inst.values()) : [];
  } catch (_) { return []; }
}
function _findAppByTitle(title) {
  const id = promptIdFor(title);
  try {
    const byId = foundry?.applications?.instances?.get?.(id);
    if (byId) return byId;
  } catch (_) {}
  const v2 = _v2Apps().find(a =>
    a?.id === id || a?.title === title || (a?.window?.title ?? a?.options?.window?.title) === title);
  if (v2) return v2;
  try {
    return Object.values(ui.windows ?? {}).find(a =>
      a?.options?.id === id || a?.title === title || a?.data?.title === title) || null;
  } catch (_) { return null; }
}

/** Keep the named dialog on top through nearby sheet renders. Safe to call before it renders. */
function raiseDialogByTitle(title, { attempts = 16, gapMs = 400, raises = 4 } = {}) {
  let n = 0, raised = 0;
  const iv = setInterval(() => {
    n++;
    const app = _findAppByTitle(title);
    if (app) {
      try { (app.bringToFront ?? app.bringToTop)?.call(app); raised++; } catch (_) {}
      if (raised >= raises) clearInterval(iv);
    } else if (n >= attempts) clearInterval(iv);
  }, gapMs);
  return () => clearInterval(iv);
}

/** Close a lingering onboarding dialog (e.g. a fallback prompt once its hook fired). */
function closeDialogByTitle(title) {
  const app = _findAppByTitle(title);
  if (app) { try { app.close(); } catch (_) {} }
}

/** Sweep: close EVERY onboarding-prefixed dialog. Run between beats so no stale
 *  fallback prompt survives a stage switch, whatever closed the gate. */
function closeAllOnboardingPrompts() {
  for (const a of _v2Apps()) {
    if (String(a?.id ?? "").startsWith(PROMPT_ID_PREFIX)) { try { a.close(); } catch (_) {} }
  }
  try {
    for (const a of Object.values(ui.windows ?? {})) {
      if (String(a?.options?.id ?? "").startsWith(PROMPT_ID_PREFIX)) { try { a.close(); } catch (_) {} }
    }
  } catch (_) {}
}

/** Cross-version "Continue" prompt (DialogV2 on v13+, Dialog fallback). Resolves "ok" or null. */
async function prompt({ title = "Operator", content = "", label = "Continue" } = {}) {
  const body = `<div class="bbttcc-onboarding-prompt">${content}</div>`;
  const DV2 = foundry?.applications?.api?.DialogV2;
  raiseDialogByTitle(title);
  if (DV2?.wait) {
    try {
      await DV2.wait({
        id: promptIdFor(title),
        window: { title }, content: body,
        position: { ...PROMPT_POSITION },
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
    }, { id: promptIdFor(title), ...PROMPT_POSITION }).render(true);
  });
}

/** Slide deck — a stepped teaching card with Back / Next / Finish.
 *
 *  Beats that teach a CONCEPT (Crew, Surge, the manifestation dials) have no UI
 *  element to point a tour ring at, and a wall of Operator chat lines scrolls
 *  away unread. A deck holds still and lets the player go back a step.
 *
 *  Implemented as one dialog PER SLIDE sharing a single id: DialogV2.wait
 *  resolves on button press, so re-opening under the same id swaps the content
 *  and keeps the prefix sweep (closeAllOnboardingPrompts) able to find it.
 *  Slides: { title, body, speak? }. Resolves "done" when finished, or null if
 *  the player closed the deck (a closed deck must never wedge a beat — callers
 *  treat null as "they've seen enough").
 */
async function deck({ title = "Operator", slides = [], label = "Got it", speak = null } = {}) {
  const list = (Array.isArray(slides) ? slides : []).filter(Boolean);
  if (!list.length) return "done";
  const DV2 = foundry?.applications?.api?.DialogV2;
  let i = 0;
  while (i < list.length) {
    const sl = list[i];
    const first = i === 0;
    const last  = i === list.length - 1;
    const heading = `${title} — ${sl.title}`;
    // The Operator narrates a slide only when it asks for it; keeps the chat
    // log from becoming a duplicate of the deck.
    if (sl.speak && typeof speak === "function") { try { await speak(sl.speak); } catch (_) {} }
    const content = `<div class="bbttcc-onboarding-deck">
        <p class="bbttcc-deck-step" style="margin:0 0 .4rem;font-size:.72rem;letter-spacing:.06em;opacity:.6;text-transform:uppercase">Slide ${i + 1} of ${list.length}</p>
        <h3 style="margin:0 0 .5rem;font-size:1rem;color:#d4a35f">${sl.title}</h3>
        <div class="bbttcc-deck-body">${sl.body}</div>
      </div>`;
    const buttons = [];
    if (!first) buttons.push({ action: "back", label: "← Back" });
    buttons.push({ action: "next", label: last ? label : "Next →", default: true });

    let action = null;
    if (DV2?.wait) {
      try {
        action = await DV2.wait({
          id: promptIdFor(title),
          window: { title: heading },
          content,
          position: { ...PROMPT_POSITION, width: 520 },
          buttons, rejectClose: false, modal: false
        });
      } catch (_) { action = null; }
    } else {
      action = await new Promise((res) => {
        const btns = {};
        if (!first) btns.back = { label: "← Back", callback: () => res("back") };
        btns.next = { label: last ? label : "Next →", callback: () => res("next") };
        new Dialog({ title: heading, content, buttons: btns, default: "next", close: () => res(null) },
          { id: promptIdFor(title), ...PROMPT_POSITION, width: 520 }).render(true);
      });
    }
    if (action === null) return null;          // closed — don't wedge the beat
    i = action === "back" ? Math.max(0, i - 1) : i + 1;
  }
  return "done";
}

/** A forked prompt — two or more real choices rather than one Continue.
 *  Same id scheme as prompt()/deck() so the between-beat sweep still finds it.
 *  Resolves the chosen action, or `fallback` if the player closes the window
 *  (a closed dialog must never leave a beat waiting on an answer). */
async function choose({ title = "Operator", content = "", options = [], fallback = null } = {}) {
  const opts = (Array.isArray(options) ? options : []).filter(o => o?.action && o?.label);
  if (!opts.length) return fallback;
  const body = `<div class="bbttcc-onboarding-prompt">${content}</div>`;
  const DV2 = foundry?.applications?.api?.DialogV2;
  raiseDialogByTitle(title);
  if (DV2?.wait) {
    try {
      const picked = await DV2.wait({
        id: promptIdFor(title),
        window: { title }, content: body,
        position: { ...PROMPT_POSITION, width: 500 },
        buttons: opts.map((o, i) => ({ action: o.action, label: o.label, default: i === 0 })),
        rejectClose: false, modal: false
      });
      return picked ?? fallback;
    } catch (_) { return fallback; }
  }
  return new Promise((res) => {
    const buttons = {};
    for (const o of opts) buttons[o.action] = { label: o.label, callback: () => res(o.action) };
    new Dialog({ title, content: body, buttons, default: opts[0].action, close: () => res(fallback) },
      { id: promptIdFor(title), ...PROMPT_POSITION, width: 500 }).render(true);
  });
}

let _running = false;

/** Run the arc.
 *    start()                            — resume; finished beats are skipped
 *    start({fromStart:true})            — wipe progress and replay everything
 *    start({from:"proving_trials"})     — jump in at a beat and run to the end
 *    start({only:["final_showdown"]})   — run just these beats, in arc order
 *  `from`/`only` exist for PLAYTESTING (added 2026-08-17): the endgame sits
 *  fifteen beats deep behind three raids, and replaying the whole tutorial to
 *  reach it is not a reasonable test loop. Both ignore stored progress for the
 *  beats they select, so a finished beat still re-runs when you name it. */
async function start({ user = game.user, fromStart = false, from = null, only = null } = {}) {
  if (_running) { ui.notifications?.warn?.("Onboarding is already running."); return; }
  const ns = _ns();
  const steward = ns?.resolve?.steward?.(user);
  if (!steward) {
    ui.notifications?.error?.("Onboarding: no Steward assigned to you. Set your character (player config → Select Character), then run game.bbttcc.onboarding.start().");
    await _speak("No meatsuit on file for you, One. Assign your Steward first— *bzzt* —then ping me again.");
    return;
  }

  _running = true;
  let pingIv = null;   // declared OUTSIDE the try — the finally clears it
  try {
    let p = _progress(steward);
    if (fromStart || !p.startedAt) {
      p = { currentStep: null, steps: {}, startedAt: Date.now(), completedAt: null };
      await _setProgress(steward, p);
    }

    // Parallel-safe: claim a spawn lane + join the live-run registry, so concurrent
    // players get their own scaffolding rows and nobody's teardown reaps another's
    // props. Solo runs land in lane 0 and behave exactly as before.
    let lane = 0, others = 0;
    try {
      const r = await ns?.stage?.runBegin?.(user.id, user.name);
      lane = Number(r?.lane) || 0;
      others = Number(r?.others) || 0;
      ns?.stage?.setRunContext?.({ userId: user.id, lane });
      // Heartbeat: keep our registry entry fresh so a crashed client's entry
      // (which stops pinging) ages out in minutes, not hours.
      pingIv = setInterval(() => { try { ns?.stage?.runPing?.(user.id); } catch (_) {} }, 5 * 60 * 1000);
    } catch (e) { console.warn(TAG, "run registry unavailable — continuing solo-style", e); }
    if (others > 0) {
      await _speak(`Heads up, One — ${others === 1 ? "another Steward is" : `${others} other Stewards are`} running the same program right now. I've given you your own patch of ground; don't mind the neighbours.`);
    }

    const ctx = {
      user, steward, lane,
      faction: ns?.resolve?.faction?.(user, steward) || null,
      get rig() { return ns?.resolve?.rig?.(this.faction) || null; },
      scene: (key) => ns?.resolve?.scene?.(key) || null,
      speak: _speak,
      riff: (a, o) => (ns?.riff ? ns.riff(a, o) : Promise.resolve(null)),
      prompt,
      deck: (opts = {}) => deck({ speak: _speak, ...opts }),
      choose,
      director: { registerBeat, listBeats, getBeat }
    };

    // Resolve the playtest selectors against the registered arc order.
    const onlySet = only ? new Set(Array.isArray(only) ? only : [only]) : null;
    const fromIdx = from ? _beats.findIndex(b => b.id === from) : -1;
    if (from && fromIdx < 0) {
      ui.notifications?.warn?.(`Onboarding: no beat "${from}". Known: ${_beats.map(b => b.id).join(", ")}`);
      return;
    }
    if (onlySet) {
      const unknown = [...onlySet].filter(id => !_beats.some(b => b.id === id));
      if (unknown.length) {
        ui.notifications?.warn?.(`Onboarding: unknown beat(s) ${unknown.join(", ")}. Known: ${_beats.map(b => b.id).join(", ")}`);
        return;
      }
    }
    const selected = (beat, i) => {
      if (onlySet) return onlySet.has(beat.id);
      if (fromIdx >= 0) return i >= fromIdx;
      return true;
    };
    if (onlySet || fromIdx >= 0) {
      const names = _beats.filter(selected).map(b => b.id);
      console.log(TAG, `playtest run — ${names.length} beat(s): ${names.join(" → ")}`);
    }

    for (const [beatIdx, beat] of _beats.entries()) {
      if (!selected(beat, beatIdx)) continue;
      p = _progress(steward);
      // A named beat always runs — that's the point of asking for it.
      const _ignoreDone = fromStart || onlySet || fromIdx >= 0;
      if (p.steps?.[beat.id]?.done && !_ignoreDone) {
        // Progress persists on the Steward — a replayed start() without
        // {fromStart:true} silently skips finished beats. Say so, loudly-ish.
        console.log(TAG, `skipping beat "${beat.id}" — already done for ${steward.name}. Replay everything with game.bbttcc.onboarding.start({fromStart:true}).`);
        continue;
      }

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
        // Never trap the run — but a thrown beat must not vanish invisibly either.
        console.warn(TAG, `beat "${beat.id}" threw — continuing`, e);
        ui.notifications?.warn?.(`Onboarding: the "${beat.title || beat.id}" module hit an error and was skipped — see console (F12).`);
      }

      // Stage switch: no dialog from the finished beat survives into the next.
      closeAllOnboardingPrompts();

      // "Wave me through" (owner playtest 2026-08-20): a player who did what
      // the beat asked should never have to hand-close what the beat opened.
      // Sheets sweep at the same boundary as the dialogs; any beat that needs
      // one re-opens it itself.
      for (const doc of [ctx.steward, ctx.rig, ctx.faction]) {
        try { if (doc?.sheet?.rendered) doc.sheet.close(); } catch (_) {}
      }
      // Module app windows the beats/tours open (hex sheet, Bridge, Market…)
      // stack up across the run otherwise (owner playtest 2026-08-21). Title
      // prefix keeps it conservative — only Bad Eden interface windows sweep.
      const APP_TITLE_RE = /^Bad Eden(\s+(—|-)\s+(Hex Sheet|Manifestation Bridge)|\s+Market)/;
      try {
        const v2 = foundry?.applications?.instances;
        for (const a of (v2?.values ? Array.from(v2.values()) : [])) {
          const t = a?.window?.title ?? a?.options?.window?.title ?? "";
          if (APP_TITLE_RE.test(String(t))) { try { a.close(); } catch (_) {} }
        }
        for (const a of Object.values(ui.windows ?? {})) {
          const t = a?.title ?? a?.options?.title ?? "";
          if (APP_TITLE_RE.test(String(t))) { try { a.close(); } catch (_) {} }
        }
      } catch (_) {}

      p = _progress(steward);
      p.steps[beat.id] = { done: true, at: Date.now() };
      await _setProgress(steward, p);
    }

    p = _progress(steward);
    p.currentStep = null;
    await _setProgress(steward, p);
    console.log(TAG, "Run finished. Completed beats:", Object.keys(p.steps || {}));
  } finally {
    // Release the lane whatever happened (completed, thrown, or bailed early).
    try { if (pingIv) clearInterval(pingIv); } catch (_) {}
    try { await _ns()?.stage?.runEnd?.(user.id); } catch (_) {}
    try { _ns()?.stage?.setRunContext?.({ userId: "", lane: 0 }); } catch (_) {}
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

/** Who is mid-tutorial right now (any client). Async — reads the world registry. */
async function activeRuns() {
  const r = await _ns()?.stage?.runList?.("");
  return r?.others ?? [];
}

function status({ user = game.user } = {}) {
  const ns = _ns();
  const steward = ns?.resolve?.steward?.(user);
  return {
    steward: steward?.name || null,
    lane: ns?.stage?.runContext?.()?.lane ?? null,
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
  ns.ui = Object.assign(ns.ui ?? {}, { raiseDialogByTitle, closeDialogByTitle, closeAllOnboardingPrompts, promptIdFor, PROMPT_POSITION, deck, choose });
  Object.assign(ns, { start, skip, reset, status, activeRuns, isRunning: () => _running });

  try {
    if (game.user.isGM && ns.settings?.get?.("offerOnReady") && !ns.settings.completed() && !ns.user.skipped()) {
      console.log(TAG, "Onboarding available — run game.bbttcc.onboarding.start() to begin (or .status() to inspect).");
    }
  } catch (_) {}
});
