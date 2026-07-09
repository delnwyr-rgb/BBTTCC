// modules/bbttcc-core/scripts/story.gottgait.js
//
// GOTTGAIT story state store. Slimmed 2026-07-08: the original demo engine
// (runBeat with two demo beats, bindContext, ensureStoryContext, planActivity,
// maybeAdvanceTurn, getStage) was unreachable scaffolding — the Story Console
// routes every button through game.bbttcc.api.campaign.* now. What remains is
// the world-setting state store the console + GM Advisor read, and the beat
// log every campaign/travel fire appends to (now CAPPED — it grew forever and
// rewrote the whole world setting on each append).
(() => {
  const TAG = "[GOTTGAIT Story]";
  const MODULE_ID = "bbttcc-core";
  const SETTING_KEY = "gottgaitStoryState";
  const BEAT_LOG_CAP = 100;

  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, SETTING_KEY, {
      name: "GOTTGAIT Story State",
      hint: "Internal storage for the story console (filters, last dialog values, beat log).",
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });
    console.log(TAG, "Registered world setting", `${MODULE_ID}.${SETTING_KEY}`);
  });

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.story ??= {};

    function getState() {
      try { return game.settings.get(MODULE_ID, SETTING_KEY) ?? {}; }
      catch (e) { console.warn(TAG, "getState failed:", e); return {}; }
    }

    async function setState(state) {
      await game.settings.set(MODULE_ID, SETTING_KEY, state);
      return state;
    }

    async function updateState(patch) {
      const state = getState();
      Object.assign(state, patch);
      return setState(state);
    }

    async function logBeat(message, data = {}) {
      console.log(TAG, "BEAT:", message, data);
      const state = getState();
      state.beats ??= [];
      state.beats.push({ ts: Date.now(), message, data });
      if (state.beats.length > BEAT_LOG_CAP) state.beats = state.beats.slice(-BEAT_LOG_CAP);
      await setState(state);
    }

    game.bbttcc.api.story.gottgait = { getState, setState, updateState, logBeat };
    console.log(TAG, "Installed game.bbttcc.api.story.gottgait (state store, log capped at", BEAT_LOG_CAP, ")");
  });
})();
