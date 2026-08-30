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

  // Live run registry — { [userId]: { lane, ts, name } }. Written GM-side via the
  // relay (world settings are GM-only). Powers parallel-safe onboarding: stable
  // spawn LANES so concurrent players never stack scaffolding on each other, and
  // the "is anyone else still in the tutorial?" check that keeps graduation from
  // yanking the table out from under someone mid-flow.
  game.settings.register(MODULE_ID, "activeRuns", {
    scope: "world", config: false, type: Object, default: {}
  });

  // Campaign handoff wiring (owner's Act-0 order-of-operations, 2026-08-23):
  // Offices of Fates and Destinies runs its dream-sayings up to "Wake up" →
  // the table drops into onboarding → graduation hands BACK to the Offices
  // at Teaching Slide 1 (the "employee orientation film") → Thatwards Ho.
  game.settings.register(MODULE_ID, "campaignWakeBeatId", {
    name: "Onboarding — campaign beat that begins training",
    hint: "When this campaign beat resolves, a public 'Report for training' card offers every player a Begin Onboarding button. Blank disables the handoff.",
    scope: "world", config: true, type: String, default: "fates_and_destinies_incarnate"
  });
  game.settings.register(MODULE_ID, "campaignResumeBeatId", {
    name: "Onboarding — campaign beat to run after graduation",
    hint: "When a player graduates, the GM gets a card with a button that runs this campaign beat (the orientation film). Blank disables the handoff.",
    scope: "world", config: true, type: String, default: "fates_and_destinies_1"
  });

  log("Settings registered.");
});

// ----- Campaign ⇄ onboarding handoff (2026-08-23) -----
Hooks.once("ready", () => {
  // Wake Up resolved (GM client runs beats) → public invitation card.
  Hooks.on("bbttcc:beat:resolved", (data = {}) => {
    try {
      if (!game.user.isGM) return;
      const wakeId = String(game.settings.get(MODULE_ID, "campaignWakeBeatId") || "").trim();
      const beatId = String(data?.beat?.id ?? data?.beatId ?? "");
      if (!wakeId || beatId !== wakeId) return;
      // Fresh class per wake: enrollment (user flag campaignClass, stamped by
      // the Begin button) is what makes a graduation touch the campaign at
      // all — clear stale enrollments from earlier classes before inviting.
      for (const u of (game.users?.contents ?? [])) {
        if (u.getFlag?.(MODULE_ID, "campaignClass")) u.unsetFlag(MODULE_ID, "campaignClass").catch(() => {});
      }
      ChatMessage.create({
        content: `<div class="bbttcc-onb-handoff">` +
          `<h3>🎓 Report for training</h3>` +
          `<p>You wake on the Proving Ground. Anyone who hasn't run the gauntlet — or wants the refresher — click below. Everyone else, stretch; the orientation film starts when the class graduates.</p>` +
          `<button type="button" class="bbttcc-onb-begin">▶ Begin Onboarding</button></div>`
      });
    } catch (e) { warn("wake handoff card failed", e); }
  });

  // Button binders — Begin runs on the CLICKING player's client (their lane).
  // v13+ fires renderChatMessageHTML; the legacy hook registers only on old
  // cores (a live legacy registration spams deprecation warnings on v13+).
  const _bindOnbChatButtons = (_msg, html) => {
    const root = html?.[0] ?? html;
    root?.querySelectorAll?.(".bbttcc-onb-begin")?.forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        // Enroll in the class: THIS is what marks the run as campaign
        // session-0 rather than a solo refresher — graduation only hands
        // back to the campaign for enrolled users (2026-08-29).
        try { await game.user?.setFlag?.(MODULE_ID, "campaignClass", true); } catch (_) {}
        game.bbttcc?.onboarding?.start?.({ fromStart: true })
          ?.catch?.(e => { warn("onboarding start failed", e); btn.disabled = false; });
      });
    });
    root?.querySelectorAll?.(".bbttcc-onb-resume")?.forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!game.user.isGM) return ui.notifications.warn("GM runs the orientation film.");
        btn.disabled = true;
        try {
          const resumeId = String(game.settings.get(MODULE_ID, "campaignResumeBeatId") || "").trim();
          const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
          if (!resumeId || !cid) return ui.notifications.warn("Resume beat or active campaign not set.");
          await game.bbttcc.api.campaign.runBeat(cid, resumeId);
          btn.textContent = "🎬 Rolling…";
        } catch (e) { warn("orientation film start failed", e); btn.disabled = false; }
      });
    });
  };
  Hooks.on("renderChatMessageHTML", _bindOnbChatButtons);
  if (Number(globalThis.game?.release?.generation ?? 99) < 13)
    Hooks.on("renderChatMessage", _bindOnbChatButtons);
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

/** Valid tutorial scene keys, in flow order. */
// "reef" added 2026-08-17 — the dive level under the Proving Ground's dark
// water. Two scenes + transition.dive rather than the Levels module, per the
// owner's standing no-Levels ruling; the trials beat resolves it by this key
// and degrades gracefully (hands the relic over on the surface) if unwired.
const TUTORIAL_SCENE_KEYS = ["incarnation", "meatsuit-range", "driving-course", "sandbox-hex", "hostile-hex", "reef",
                             "court-review", "court-parley"];

/**
 * Point a tutorial key at a Scene (GM only), clearing the key off whatever held it —
 * two scenes claiming one key would leave resolution to whichever sorted first.
 * Scenes get rebuilt often here, and a rebuilt scene loses its flag.
 *   game.bbttcc.onboarding.wireScene("meatsuit-range", "6YetGOfAK3IhsZ9k")
 * Accepts a bare id, a "Scene.<id>" uuid, a Scene document, or a scene NAME.
 */
async function wireScene(key, sceneOrId) {
  if (!game.user?.isGM) { ui.notifications?.warn?.("wireScene: GM only."); return null; }
  if (!TUTORIAL_SCENE_KEYS.includes(key)) {
    ui.notifications?.error?.(`wireScene: unknown key "${key}". Valid: ${TUTORIAL_SCENE_KEYS.join(", ")}`);
    return null;
  }
  const raw = sceneOrId?.documentName === "Scene" ? sceneOrId
    : game.scenes?.get?.(String(sceneOrId ?? "").replace(/^Scene\./, ""))
      ?? game.scenes?.getName?.(String(sceneOrId ?? ""));
  if (!raw) { ui.notifications?.error?.(`wireScene: no scene matches "${sceneOrId}".`); return null; }

  for (const s of (game.scenes ?? [])) {
    if (s.id !== raw.id && s.getFlag?.(MODULE_ID, "tutorialScene") === key) {
      try { await s.unsetFlag(MODULE_ID, "tutorialScene"); }   // v14: unsetFlag, never "-=key"
      catch (e) { warn("wireScene: could not clear old flag on", s.name, e); }
    }
  }
  await raw.setFlag(MODULE_ID, "tutorialScene", key);

  // Players have to be able to VIEW the scene or the beat's dive lands nowhere —
  // scenes default to no player ownership, and a hand-built replacement won't have
  // been granted any. Raise to OBSERVER (never lower an existing higher grant).
  const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  if ((raw.ownership?.default ?? 0) < OBSERVER) {
    try {
      await raw.update({ ownership: { ...(raw.ownership ?? {}), default: OBSERVER } });
      log(`wireScene: raised "${raw.name}" to default OBSERVER so players can enter it.`);
    } catch (e) { warn("wireScene: ownership raise failed — players may not be able to enter", raw.name, e); }
  }

  // Court scenes host the Courtly engine, which only engages when the VIEWED
  // scene carries the tableau flag (raid-console _isCourtlyKey). Stamp it at
  // wire time so a rebuilt court comes back ready. Dotted setFlag key merges,
  // so an existing tableau tune (stage bounds, token size) is never clobbered.
  if (key.startsWith("court-") && raw.flags?.["bbttcc-raid"]?.tableau?.enabled !== true) {
    try {
      await raw.setFlag("bbttcc-raid", "tableau.enabled", true);
      log(`wireScene: tableau-enabled "${raw.name}" — the courtly engine engages here.`);
    } catch (e) { warn("wireScene: tableau enable failed on", raw.name, e); }
  }

  log(`wired "${key}" → ${raw.name} (${raw.id}).`);
  ui.notifications?.info?.(`Onboarding: "${key}" now uses scene "${raw.name}".`);
  return raw;
}

/**
 * Pin the scene graduation dives into (GM only). Without this, resolveMainMap
 * guesses — "the non-tutorial scene with the most territory hexes" — which lands
 * wherever the hex map happens to be densest (the Iron Reaches, in practice).
 *   game.bbttcc.onboarding.setKickoffMap("Bad Eden — Port Kudzu")
 * Pass null to clear the pin and go back to auto-resolving.
 */
async function setKickoffMap(sceneOrId) {
  if (!game.user?.isGM) { ui.notifications?.warn?.("setKickoffMap: GM only."); return null; }
  for (const s of (game.scenes ?? [])) {
    if (s.getFlag?.(MODULE_ID, "mainMap")) { try { await s.unsetFlag(MODULE_ID, "mainMap"); } catch (_) {} }
  }
  if (sceneOrId === null || sceneOrId === "") {
    ui.notifications?.info?.("Onboarding: graduation landing unpinned (auto-resolves again).");
    return null;
  }
  const sc = sceneOrId?.documentName === "Scene" ? sceneOrId
    : game.scenes?.get?.(String(sceneOrId ?? "").replace(/^Scene\./, ""))
      ?? game.scenes?.getName?.(String(sceneOrId ?? ""));
  if (!sc) { ui.notifications?.error?.(`setKickoffMap: no scene matches "${sceneOrId}".`); return null; }
  await sc.setFlag(MODULE_ID, "mainMap", true);
  log(`graduation landing pinned to "${sc.name}" (${sc.id}).`);
  ui.notifications?.info?.(`Onboarding: graduates now land on "${sc.name}".`);
  return sc;
}

/**
 * Diagnostic: what each tutorial key resolves to, and whether a player could
 * actually enter it. `playersCanView:false` means the dive will fail for players
 * even though the flag is correct — re-run wireScene to grant OBSERVER.
 */
function sceneWiring() {
  const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  return Object.fromEntries(TUTORIAL_SCENE_KEYS.map(k => {
    const sc = findTutorialScene(k);
    return [k, sc
      ? { scene: sc.name, id: sc.id, playersCanView: (sc.ownership?.default ?? 0) >= OBSERVER }
      : null];
  }));
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
      },

      // Scene wiring (GM): tutorial beats resolve scenes by flag, and a rebuilt
      // scene loses that flag. See tools/wire-tutorial-scenes.macro.js for a GUI.
      wireScene,
      sceneWiring,
      setKickoffMap,
      TUTORIAL_SCENE_KEYS

      // .speak/.riff attached by operator-voice.js; .beats/.start/... by director.js
    });

    log(`Installed at game.bbttcc.onboarding (v${ns.version}).`);
  } catch (e) {
    warn("Failed to install game.bbttcc.onboarding:", e?.message || e);
  }
}

Hooks.once("ready", _install);
if (globalThis.game?.ready) _install();
