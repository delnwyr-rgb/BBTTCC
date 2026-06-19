/* bbttcc-onboarding/scripts/module.js
 * Phase 1 — module shell, settings, namespace bootstrap, and real-actor resolvers.
 *
 * The onboarding flow is a DIRECTOR over existing primitives. It never clones the
 * player's avatar: players practice on their REAL Steward, rig and faction — only
 * targets/scaffolding (dummy, hostile faction, sandbox hex, tutorial Scenes) are spawned.
 *
 * Namespace: game.bbttcc.onboarding
 *   module.js        -> bootstrap + settings + resolve.{steward,faction,rig,scene}
 *   operator-voice.js-> speak()/riff()  (the guide channel; Operator on top of Mal)
 *   director.js      -> beats registry + state machine + start/skip/reset/status
 *   beats.js         -> the ordered beat definitions (Phase 1: incarnation)
 *
 * Soft deps (runtime-guarded, NOT hard-required so the module activates standalone):
 *   bbttcc-mal-voice  (Operator LLM colour; scripted lines still fire without it)
 *   bbttcc-travel     (game.bbttcc.api.transition.dive for cinematic Scene dives)
 */

const MODULE_ID = "bbttcc-onboarding";
const TAG  = "[onboarding]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// ----- Settings -----
Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "completed", {
    name: "Onboarding — completed in this world",
    hint: "Marks the onboarding as done for the world. Players can still replay via game.bbttcc.onboarding.start().",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, "offerOnReady", {
    name: "Onboarding — announce availability on load",
    hint: "When on, logs an availability hint to the GM console at world load (never auto-launches).",
    scope: "world", config: true, type: Boolean, default: true
  });

  log("Settings registered.");
});

// ----- Real-actor resolvers (NEVER create clones — resolve what the player owns) -----

/** The player's assigned Steward (their real PC actor), or null. */
function resolveSteward(user = game.user) {
  if (!user) return null;
  let a = user.character || null;
  if (!a) {
    a = (game.actors?.contents ?? []).find(
      x => x.type === "character" && x.testUserPermission?.(user, "OWNER")
    ) || null;
  }
  return a;
}

/** The faction the Steward stewards, best-effort. Phase 1 only needs this for later beats. */
function resolveFaction(user = game.user, steward = null) {
  const FMOD = "bbttcc-factions";
  try {
    const fid = steward?.getFlag?.(FMOD, "factionId") ?? steward?.flags?.[FMOD]?.factionId ?? null;
    if (fid) {
      const byId = game.actors?.get?.(fid);
      if (byId) return byId;
      try { const byUuid = (typeof fromUuidSync === "function") ? fromUuidSync(fid) : null; if (byUuid) return byUuid; } catch (_) {}
    }
    return (game.actors?.contents ?? []).find(
      x => (x.getFlag?.(FMOD, "isFaction") || x.flags?.[FMOD]?.isFaction) && x.testUserPermission?.(user, "OWNER")
    ) || null;
  } catch (e) { warn("resolveFaction failed", e); return null; }
}

/** A rig owned by the given faction, best-effort (later beats — driving). */
function resolveRig(faction) {
  if (!faction) return null;
  try {
    return (game.actors?.contents ?? []).find(
      x => x.type === "rig" &&
        (x.getFlag?.("fourththing", "factionOwnerId") === faction.id ||
         x.system?.identity?.factionOwnerId === faction.id)
    ) || null;
  } catch (_) { return null; }
}

/** A dedicated tutorial Scene by key (stamped by tools/onboarding-setup.macro.js). */
function findTutorialScene(key) {
  try { return (game.scenes?.contents ?? []).find(s => s.getFlag?.(MODULE_ID, "tutorialScene") === key) || null; }
  catch (_) { return null; }
}

/**
 * The LIVE Bad Eden map the graduation dive lands on. There is no canonical "main map"
 * flag/setting, so resolve in priority order:
 *   1) a scene a GM opted in via flags[MODULE_ID].mainMap (convention hook for later),
 *   2) the non-tutorial scene with the MOST bbttcc-territory hex drawings (the hex map),
 *   3) the active scene if it isn't a tutorial scene,
 *   4) null (caller falls back to a plain teardown without a dive).
 */
function resolveMainMap() {
  try {
    const scenes = (game.scenes?.contents ?? []);
    const isTut = (s) => !!s.getFlag?.(MODULE_ID, "tutorialScene");
    const opted = scenes.find(s => s.getFlag?.(MODULE_ID, "mainMap"));
    if (opted) return opted;
    const hexCount = (s) => {
      try { return (s.drawings?.contents ?? Array.from(s.drawings ?? [])).filter(d => d.getFlag?.("bbttcc-territory", "isHex") || d.flags?.["bbttcc-territory"]?.isHex).length; }
      catch (_) { return 0; }
    };
    const ranked = scenes.filter(s => !isTut(s)).map(s => ({ s, n: hexCount(s) })).sort((a, b) => b.n - a.n);
    if (ranked[0]?.n > 0) return ranked[0].s;
    const active = game.scenes?.active;
    if (active && !isTut(active)) return active;
    return ranked[0]?.s || null;
  } catch (_) { return null; }
}

// ----- Namespace bootstrap -----
function _install() {
  try {
    globalThis.game.bbttcc ??= { api: {} };
    const ns = (globalThis.game.bbttcc.onboarding ??= {});

    Object.assign(ns, {
      MODULE_ID,
      version: "0.1.0",

      settings: {
        get: (k) => game.settings.get(MODULE_ID, k),
        set: (k, v) => game.settings.set(MODULE_ID, k, v),
        completed: () => !!game.settings.get(MODULE_ID, "completed")
      },

      // per-USER skip preference (survives across worlds)
      user: {
        skipped: () => !!game.user?.getFlag?.(MODULE_ID, "skip"),
        setSkipped: (v) => game.user?.setFlag?.(MODULE_ID, "skip", !!v)
      },

      resolve: {
        steward: resolveSteward,
        faction: resolveFaction,
        rig: resolveRig,
        scene: findTutorialScene,
        mainMap: resolveMainMap
      }

      // .speak/.riff attached by operator-voice.js; .beats/.start/... by director.js
    });

    log(`Installed at game.bbttcc.onboarding (v${ns.version}).`);
  } catch (e) {
    warn("Failed to install game.bbttcc.onboarding:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
