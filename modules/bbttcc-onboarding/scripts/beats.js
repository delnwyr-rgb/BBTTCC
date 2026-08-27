/* bbttcc-onboarding/scripts/beats.js
 * The ordered beat definitions.
 *   Phase 1: incarnation
 *   Phase 2: meatsuit (test real abilities), driving (pilot the real rig)
 *   Phase 3: stewardship — claim a sandbox hex, read OP + run a dry-run Turn
 *   Phase 3b: outfitting (gear up at the Market)
 *   Phase 3c: teaching slides — crew_occult → surge → manifestations. Concept
 *           beats, so they use ctx.deck (stepped slides) plus a hands-on gate.
 *           They sit BEFORE the fight (owner 2026-08-17) so the player walks
 *           into it with a crew behind them and something of their own making.
 *   Phase 3d: combat_sim (live-fire on the Proving Ground: qliphothic to kill,
 *           sentient to spare, Darkness for the ones you don't)
 *   Phase 5 (climax): proving_trials → final_showdown. Sits AFTER the three
 *           raids by owner ruling — those teach the consoles, this is them in
 *           practice. Framed in-fiction as an attack on the GAME itself: four
 *           sigil hazards yield four relics (one a dive to the reef scene), all
 *           four unlock the great circle, and the player chooses to storm it or
 *           slip into it. Both roads end at the same parley, where a messenger
 *           hands over two real Courtly Secrets and an offer to stop.
 *   Phase 4 (finale): travel into a hostile hex → triple raid (violence / intrigue /
 *           presence, player-driven pre-targeted consoles) → graduation dive into live Bad Eden
 *
 * Each beat drives a REAL subsystem the player owns and detects completion off that
 * subsystem's existing hook (with manual-prompt fallbacks so a player is never trapped).
 * All spawns are contained to dedicated tutorial Scenes and flagged so teardown only ever
 * removes its own scaffolding; the player practices on their REAL steward, rig and faction.
 */

const MODULE_ID = "bbttcc-onboarding";
const TAG = "[onboarding/beats]";

const _tx = () => globalThis.game?.bbttcc?.api?.transition || null;
const _stage = () => globalThis.game?.bbttcc?.onboarding?.stage || null;
const _pause = (ms) => new Promise(r => setTimeout(r, ms)); // beat pacing — let steps land

/** Resolve a tutorial scene or say so LOUDLY (chat + toast + console). A missing scene
 * must never silently degrade a beat into "nothing visibly happened" (owner playtest
 * 2026-08-12: Proving Range vanished and the whole meatsuit scenario went invisible).
 * Beats resolve scenes by flags["bbttcc-onboarding"].tutorialScene — a scene REBUILT
 * by hand (e.g. swapped for an animated map) loses the flag unless it's re-stamped. */
async function _requireScene(ctx, key, label) {
  const scene = ctx.scene(key);
  if (scene) return scene;
  console.warn(TAG, `No '${key}' tutorial Scene — nothing carries flags["${MODULE_ID}"].tutorialScene="${key}". Run tools/onboarding-setup.macro.js, or re-stamp the flag if the scene was rebuilt: scene.setFlag("${MODULE_ID}","tutorialScene","${key}")`);
  ui.notifications?.warn?.(`Onboarding: the "${label}" tutorial scene is missing (rebuilt without its flag?). GM: run onboarding-setup.macro.js or re-stamp the flag. Continuing without the scene.`);
  await ctx.speak(`Hm. The ${label} stage is dark — someone rearranged my furniture and didn't tell me. *bzzt* We'll run this module without the set dressing.`);
  return null;
}

/** Canvas point at a fractional position inside the VISIBLE scene rect, shifted into
 * this run's LANE. Canvas coordinates include the scene padding — `scene.width * frac`
 * lands shifted into the top-left dead zone (owner playtest 2026-08-13: vehicles spawned
 * off-track). The lane shift keeps concurrent players' scaffolding off each other. */
function _scenePoint(scene, fx, fy, lane = 0) {
  const laneFrac = _stage()?.laneFrac;
  const y = typeof laneFrac === "function" ? laneFrac(fy, lane) : fy;
  const d = scene?.dimensions;
  if (d?.sceneWidth) return { x: Math.round(d.sceneX + d.sceneWidth * fx), y: Math.round(d.sceneY + d.sceneHeight * y) };
  return { x: Math.round((scene?.width ?? 2000) * fx), y: Math.round((scene?.height ?? 1400) * y) };
}

/** Dive into a tutorial Scene (GM-solo/non-destructive), falling back to a plain view. */
async function _enterScene(scene, label, lane = 0) {
  if (!scene) return;
  const tx = _tx();
  try {
    if (tx?.dive) await tx.dive(scene.uuid, { focus: _scenePoint(scene, 0.5, 0.5, lane), audience: "view", label });
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

    const scene = await _requireScene(ctx, "incarnation", "Incarnation");
    if (scene) await _enterScene(scene, "Incarnate", ctx.lane);

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

    const scene = await _requireScene(ctx, "meatsuit-range", "Proving Range");
    if (scene) { await _enterScene(scene, "Proving Range", ctx.lane); await _pause(800); } // let the dive settle before spawning

    // The Proving Ground is a SHARED stage across four beats and many replays —
    // reap whatever scaffolding a previous (or crashed) run left standing
    // before we dress the set again (owner 2026-08-27: two stale "The Deep"
    // markers and old sigils haunting a fresh run's combat sim).
    try { if (scene) await _stage()?.sweepScene?.(scene); } catch (_) {}

    // Contain the steward + dummy to the range (never the live map).
    const stage = _stage();
    if (stage && scene) {
      // Placement tuned to the owner's Proving Ground art (2026-08-17): the old
      // 0.40/0.50 spot put the Steward in the river west of the bridge. Both marks
      // now sit on the dry bank on the near side, Steward just short of the dummy.
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, _scenePoint(scene, 0.60, 0.62, ctx.lane));
      if (st.created) ctx._spawned.push({ token: st.doc });
      const dummy = await stage.spawnDummy(scene, { ..._scenePoint(scene, 0.62, 0.52, ctx.lane), name: "Straw Adversary" });
      if (dummy) ctx._spawned.push(dummy);
    }
    await _pause(500);
    try { ctx.steward?.sheet?.render(true, { focus: true }); } catch (_) {}
    await ctx.speak("Pick one ABILITY and fire it — a real power off your sheet's ability list or the HUD tray, not an aptitude check like Violence. Doesn't matter which; I just need to see the meat answer the mind. Target the straw adversary for a flourish.");
    ctx.riff({ beat: "meatsuit", line: "Player is about to test their real abilities for the first time.", intent: "Encourage them to swing. Dry, glitchy, one line." });
  },

  detect: (ctx, done) => {
    const FALLBACK_TITLE = "◇ OPERATOR — Proof of Life";
    const onAnim = (data = {}) => {
      const a = data.actor || data.sourceToken?.actor;
      if (a?.id === ctx.steward?.id) done();
    };
    // A manifestation IS an ability, and a cast that never animates used to
    // leave this gate waiting (2026-08-17: the system now emits a real cast
    // event, so take it as proof of life too).
    const onCast = (actor) => { if (actor?.id === ctx.steward?.id) done(); };
    // Routed principle clicks (True-Name Touch and the rest of the per-use
    // family) post a chat card but never animate and aren't manifestations —
    // the dispatcher's proof-of-life emission covers them (2026-08-20).
    const onFeature = (actor) => { if (actor?.id === ctx.steward?.id) done(); };
    Hooks.on("fourththing:itemAnimated", onAnim);
    Hooks.on("fourththing.manifestationCast", onCast);
    Hooks.on("fourththing.featureDispatched", onFeature);
    // Untrappable fallback (owner playtest 2026-08-11: this was the only beat
    // without one — a player whose ability never animates was stuck forever).
    ctx.prompt({
      title: FALLBACK_TITLE,
      content:
        `<p>Fire one <b>ability</b> — an actual power from your sheet's ability list (or the HUD tray), <i>not</i> an aptitude check like Violence.</p>` +
        `<p><i>Nothing sparking — empty list, gremlins, stage fright? Use the button and I'll wave you through.</i></p>`,
      label: "Wave me through"
    }).then(() => done());
    return () => {
      Hooks.off("fourththing:itemAnimated", onAnim);
      Hooks.off("fourththing.manifestationCast", onCast);
      Hooks.off("fourththing.featureDispatched", onFeature);
      globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);
    };
  },

  exit: async (ctx) => {
    await ctx.speak("There it is — reflexes intact, soul bolted in. The straw adversary sends its regards— *bzzt* —dismissing it now.");
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
  }
};

/* ───────────────────────── DRIVING ───────────────────────── */
// Pilot the faction's REAL starter rig (mint a player-owned Hexmobile if absent) through
// an obstacle gauntlet: four wrecks block the Test Track (storm brewing at the far end);
// the beat completes when every wreck is destroyed (integrity 0 or token gone), with an
// untrappable Conclude prompt as the escape hatch. Steering still gets its nod via the
// hexesMoved listener — it just no longer ends the beat on its own.
const OBSTACLE_ART = (f) => `modules/${MODULE_ID}/art/${f}`;
// Integrity is deliberately LOW. Ram feeds half the damage dealt back into the
// rammer, and a starter Hexmobile is personal-bracket (ram = 1d6 + Piloting), so
// tough wrecks would scrap the player's own rig before the gauntlet ended. These
// are derelicts — a couple of autocannon bursts or one good ram each.
const DRIVING_OBSTACLES = [
  { name: "Rusted Sedan",   img: OBSTACLE_ART("obstacle-wreck-sedan.webp"),   xFrac: 0.34, yFrac: 0.42, size: 2, integrity: 5 },
  { name: "Dead Hauler",    img: OBSTACLE_ART("obstacle-wreck-hauler.webp"),  xFrac: 0.50, yFrac: 0.58, size: 2, integrity: 7 },
  { name: "Gutted Runner",  img: OBSTACLE_ART("obstacle-wreck-runner.webp"),  xFrac: 0.66, yFrac: 0.40, size: 2, integrity: 5 },
  { name: "Downed Chopper", img: OBSTACLE_ART("obstacle-wreck-chopper.webp"), xFrac: 0.82, yFrac: 0.55, size: 3, integrity: 8 }
];

const driving = {
  id: "driving",
  title: "Test the Driving",
  scope: "personal",

  enter: async (ctx) => {
    ctx._spawned = [];
    ctx._rig = null;
    ctx._obstacles = [];
    await ctx.speak("Every Steward gets a rig. Yours is parked trackside — let's see if you can move it without folding it into a wall.");
    await _pause(900);

    let rig = ctx.rig; // resolves the faction's real rig
    if (!rig && ctx.faction) {
      // Routes through the GM relay; userId grants the onboarding player OWNER on the mint.
      rig = await _stage()?.mintRig?.(ctx.faction.id, "hexmobile", { userId: ctx.user?.id });
      if (rig) { await ctx.speak("No rig on file— *bzzt* —minted you a Hexmobile on the house. Don't get attached."); await _pause(700); }
    }
    ctx._rig = rig || null;

    const scene = await _requireScene(ctx, "driving-course", "Test Track");
    if (scene) { await _enterScene(scene, "Test Track", ctx.lane); await _pause(800); }

    const stage = _stage();
    if (scene && stage) {
      // Place the Steward FIRST — the meatsuit beat removed the range token on cleanup,
      // so without this there's no pilot on the Test Track to board the rig with.
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, _scenePoint(scene, 0.10, 0.5, ctx.lane));
      if (st.created) ctx._spawned.push({ token: st.doc });
      if (rig) {
        const rt = await stage.ensureTokenOnScene(rig, scene, _scenePoint(scene, 0.17, 0.5, ctx.lane));
        if (rt.created) ctx._spawned.push({ token: rt.doc });
      }
      // The gauntlet: wrecks strewn between the start line and the storm.
      for (const ob of DRIVING_OBSTACLES) {
        const sp = await stage.spawnObstacle?.(scene, {
          name: ob.name, img: ob.img, size: ob.size, integrity: ob.integrity,
          ..._scenePoint(scene, ob.xFrac, ob.yFrac, ctx.lane)
        });
        if (sp) { ctx._spawned.push(sp); ctx._obstacles.push(sp); }
      }
    }
    await _pause(500);
    try { rig?.sheet?.render(true, { focus: true }); } catch (_) {}
    if (rig) {
      // Boarding is the one step with no discoverable affordance — it lives in the
      // token HUD, which a new player has no reason to open (owner ask 2026-08-17).
      await ctx.speak(`Getting aboard: select your Steward's token, then RIGHT-CLICK it to open the token HUD and press the 🚚 truck button — that boards the nearest rig and seats you. Your Steward's token tucks into ${rig.name}; from here you drive the rig, not the body.`);
      await _pause(900);
      // 2026-08-17 — boarding now moves the canvas selection onto the rig token
      // (system-side, ftBoardRig → _ftSyncBoardSelection). Say so, or the swap
      // reads as "my token vanished".
      await ctx.speak(`The moment you're seated your selection jumps to ${rig.name} itself — that's deliberate. The lit-up token is the one you move now. Your Steward is inside it, riding along.`);
      await _pause(700);
      await ctx.speak("Seated? Now STEER — watch for the blue ring. (Steer spends a pilot action; if it balks, start or advance a combat turn to refresh one.)");
      await _pause(700);
      await ctx.speak("Then the fun part: four dead vehicles squat on your track — real rigs, just nobody's driving them any more. Put every one back into scrap. Cleanest way is the guns: target a wreck and fire. RAM works too — target it, use Ram — but physics bills both parties, so you'll wear half of what you deal. Clear all four before that storm at the far end gets bored.");
    }
    else await ctx.speak("Couldn't find or mint a rig for your faction. Make sure you lead a faction, then re-run this beat. Skipping the test track for now.");

    ctx.riff({ beat: "driving", line: "Player is about to pilot their rig through a wreck-strewn obstacle course for the first time.", intent: "Gruff driving-instructor daemon. One line." });
  },

  detect: (ctx, done) => {
    const rig = ctx._rig;
    const FALLBACK_TITLE = "◇ OPERATOR — Test Track";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);
    if (!rig) {
      // No rig to test — gate on a manual continue rather than hang.
      ctx.prompt({ title: FALLBACK_TITLE, content: "<p>No rig to test right now. Continue when ready.</p>", label: "Continue" }).then(() => done());
      return closeFallback;
    }

    const obstacleActorIds = new Set((ctx._obstacles || []).map(o => o.actor?.id).filter(Boolean));
    const obstacleTokenIds = new Set((ctx._obstacles || []).map(o => o.token?.id).filter(Boolean));
    const total = obstacleActorIds.size;
    const downed = new Set();
    let steered = false;

    const scrapped = (actor) => {
      const id = actor?.id ?? actor;
      if (downed.has(id)) return;
      downed.add(id);
      const left = total - downed.size;
      if (left > 0 && actor?.name) ctx.speak?.(`${actor.name} — scrapped. ${left} to go.`);
      if (downed.size >= total) done();
    };
    // Wrecks are rig-typed, so the system's own destruction cascade announces them.
    const onRigDestroyed = ({ rig: wreck } = {}) => {
      if (wreck?.id && obstacleActorIds.has(wreck.id)) scrapped(wreck);
    };
    const onUpd = (actor, changed) => {
      if (actor?.id === rig.id) {
        const moved = changed?.flags?.fourththing?.combat?.hexesMoved;
        if (moved !== undefined && Number(moved) > 0 && !steered) {
          steered = true;
          if (total > 0) ctx.speak?.("Rolling. Now the wrecks — flatten all four.");
          else done(); // no obstacles staged (no GM online?) — steering alone completes, as before
        }
        return;
      }
      if (!obstacleActorIds.has(actor?.id) || downed.has(actor?.id)) return;
      // Backstop for the hook: rig integrity, or the destroyed state being set directly.
      const sys = actor.system?.system ?? actor.system;
      const val = Number(foundry.utils.getProperty(sys, "integrity.value") ?? NaN);
      const state = foundry.utils.getProperty(sys, "identity.state");
      if ((!Number.isNaN(val) && val <= 0) || state === "destroyed") scrapped(actor);
    };
    const onDelTok = (tokenDoc) => {
      if (!obstacleTokenIds.has(tokenDoc?.id)) return;
      const aid = tokenDoc?.actorId;
      if (aid && obstacleActorIds.has(aid) && !downed.has(aid)) scrapped(tokenDoc.actor ?? aid);
    };
    Hooks.on("bbttcc:rig:destroyed", onRigDestroyed);
    Hooks.on("updateActor", onUpd);
    Hooks.on("deleteToken", onDelTok);
    // Escape hatch — never trap the player on the track.
    ctx.prompt({
      title: FALLBACK_TITLE,
      content: total > 0
        ? `<p><b>Board:</b> select your Steward's token, right-click it, and press the <b>🚚 truck</b> button in the token HUD. Boarding hands the selection to the <b>rig's</b> token — move that one from here on.</p>` +
          `<p><b>Drive:</b> use <b>Steer</b> from the rig's pilot actions, then destroy all <b>${total} wrecks</b> — target one and fire the rig's weapons, or <b>Ram</b> it (ramming costs you half the damage back).</p>` +
          `<p><i>Stuck, or the track won't cooperate? Conclude and move on.</i></p>`
        : `<p>Steer the rig — that's the whole test today.</p><p><i>Stuck? Conclude and move on.</i></p>`,
      label: "Conclude the test drive"
    }).then(() => done());

    return () => {
      Hooks.off("bbttcc:rig:destroyed", onRigDestroyed);
      Hooks.off("updateActor", onUpd);
      Hooks.off("deleteToken", onDelTok);
      closeFallback();
    };
  },

  exit: async (ctx) => {
    if (ctx._rig) await ctx.speak("Moving, wrecking, surviving — the whole grammar of the road. The rig'll forgive you; the terrain won't. Parking it — next module.");
    const stage = _stage();
    // Sever the boarding connection FIRST (un-hides the Steward's tokens everywhere),
    // THEN remove the tutorial tokens — order matters so no real token is left hidden.
    try { await stage?.disembark?.(ctx.steward?.id, ctx._rig?.id); } catch (_) {}
    try { await stage?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._obstacles = [];
    ctx._rig = null;
  }
};

/* ───────────────────────── STEWARDSHIP — CLAIM ───────────────────────── */
// Claim the dedicated SANDBOX hex (real Dashboard/click-to-edit interface, tutorial hex
// so nothing touches the living world). Detected via the territory hex-update hook.
const stewardshipClaim = {
  id: "stewardship_claim",
  title: "Stewardship — Claim",
  scope: "shared",

  enter: async (ctx) => {
    ctx._spawned = [];
    ctx._sandboxHex = null;
    await ctx.speak("Now the real work — stewardship. A hex is yours to shape, but first you have to CLAIM it. This one's a sandbox; nothing you do here touches the living world.");
    await _pause(900);

    const scene = await _requireScene(ctx, "sandbox-hex", "Sandbox Hold");
    if (scene) { await _enterScene(scene, "Sandbox Hold", ctx.lane); await _pause(800); }

    const stage = _stage();
    if (scene && stage?.ensureSandboxHex) ctx._sandboxHex = await stage.ensureSandboxHex(scene, "Tutelary Hold");
    if (scene && stage) {
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, _scenePoint(scene, 0.5, 0.66, ctx.lane));
      if (st.created) ctx._spawned.push({ token: st.doc });
    }
    await _pause(500);
    await ctx.speak("See the hex below — unclaimed, neutral ground. Make it yours. Your steward's writ handles the filing; you just give the word.");
    ctx.riff({ beat: "stewardship_claim", line: "Player is about to claim their first hex.", intent: "Dry, a little proud. One line." });
  },

  detect: (ctx, done) => {
    const hexUuid = ctx._sandboxHex?.hexUuid;
    const drawingId = ctx._sandboxHex?.drawingId;
    const isClaimed = (doc) => !!doc?.flags?.["bbttcc-territory"]?.factionId;
    // Fallback: also advance if the hex is claimed externally (e.g. a GM macro/dashboard).
    const onDraw = (doc) => { if (doc?.id === drawingId && isClaimed(doc)) done(); };
    const onHex = async ({ hexUuid: u } = {}) => { if (u && u === hexUuid) { try { if (isClaimed(await fromUuid(u))) done(); } catch (_) {} } };
    Hooks.on("updateDrawing", onDraw);
    Hooks.on("bbttcc:territory:hexUpdated", onHex);
    // Primary path: there is no player-facing claim GUI yet, so the tutorial files the claim.
    ctx.prompt({
      title: "◇ OPERATOR",
      content: `<p>Plant your banner on <b>Tutelary Hold</b> — claim it for your faction.</p><p><i>(No field UI for this yet, so I'll file the writ for you. One day you'll do it from a map menu.)</i></p>`,
      label: "Plant my banner"
    }).then(async () => {
      if (ctx.faction && hexUuid) await _stage()?.claimHex?.(hexUuid, ctx.faction.id);
      else await ctx.speak("No faction on file to claim under— *bzzt* —waving it through. Lead a faction and the banner's real.");
      done();
    });
    return () => { Hooks.off("updateDrawing", onDraw); Hooks.off("bbttcc:territory:hexUpdated", onHex); };
  },

  exit: async (ctx) => {
    await ctx.speak("Claimed. The hex knows your name now. Let's see what it costs to RUN it.");
  }
};

/* ───────────────────────── STEWARDSHIP — OP & TURN ───────────────────────── */
// Familiarise with the OP economy (read-only readout of the REAL faction's banks) and
// the Turn cycle via a NON-COMMITTING dry-run Advance Turn. Resets the sandbox hex after.
const stewardshipTurn = {
  id: "stewardship_turn",
  title: "Stewardship — OP & Turn",
  scope: "shared",

  enter: async (ctx) => {
    const op = globalThis.game?.bbttcc?.api?.op;
    const fmt = (m) => { try { return op?.formatMarksAsOP ? op.formatMarksAsOP(m) : `${(Number(m) || 0) / 10} OP`; } catch (_) { return `${(Number(m) || 0) / 10} OP`; } };
    let said = false;
    if (ctx.faction && op?.preview) {
      try {
        const st = await op.preview(ctx.faction.id, {}, {});
        const b = st?.before || {};
        await ctx.speak(`Your treasury — OPERATIONS POINTS. Economy ${fmt(b.economy)}, Violence ${fmt(b.violence)}, Diplomacy ${fmt(b.diplomacy)}. Every order spends from these buckets; they refill each Turn, capped by your tier.`);
        said = true;
      } catch (_) {}
    }
    if (!said) await ctx.speak("Operations Points — OP — fund every order you give. They refill each Turn, capped by your tier.");
    await _pause(1000);
    await ctx.speak("Now the heartbeat that refills them: the TURN. Advancing one regens your OP toward its caps, resolves every queued order, and ticks the clock. We'll run a true PREVIEW — all rhythm, zero consequences.");
    ctx.riff({ beat: "stewardship_turn", line: "Explaining OP and the Turn cycle; about to run a (now genuinely safe) dry-run preview.", intent: "Clinical, a touch grand. One line." });
  },

  detect: (ctx, done) => {
    ctx.prompt({
      title: "◇ OPERATOR",
      content: `<p>Feel the <b>Turn cycle</b>. This runs a real <b>preview</b> — the rhythm of a Turn with nothing committed to the living world.</p><p>Ready?</p>`,
      label: "Run a practice Turn (preview)"
    }).then(async () => {
      const turn = globalThis.game?.bbttcc?.api?.turn;
      try { if (turn?.advanceTurn) await turn.advanceTurn({ apply: false }); }
      catch (e) { console.warn(TAG, "dry-run turn failed", e); }
      await ctx.speak("That's a Turn — previewed. In the living world it'd refill your OP and resolve every queued order. Nothing was committed here. You've got the rhythm.");
      done();
    });
    return null;
  },

  exit: async (ctx) => {
    try { if (ctx._sandboxHex?.hexUuid) await _stage()?.unclaimHex?.(ctx._sandboxHex.hexUuid); } catch (_) {}
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._sandboxHex = null;
    await ctx.speak("Stewardship: learned. You can hold ground and run it. One thing left before the real test— *bzzt* —you'll have to GO somewhere dangerous.");
  }
};

/* ───────────────────────── OUTFITTING ───────────────────────── */
// Gear up at the Long Market before the frontier (owner call 2026-08-13: "use the
// Market tutorial as a gear-up opportunity so they land geared up"). The training
// STIPEND lands here (moved from the travel beat) so the player has marks to spend;
// the Market opens on the real steward; buying riffs via createItem; the gate is an
// untrappable "geared up" conclude — only the player knows when they're dressed.
const outfitting = {
  id: "outfitting",
  title: "Outfitting",
  scope: "personal",

  enter: async (ctx) => {
    await ctx.speak("Before you cross into hostile ground, two problems: you're broke and you're under-dressed. Fixing both— *bzzt*");
    await _pause(700);

    // Training stipend — a fresh faction's banks are empty, and the Market, Travel
    // and raid maneuvers ahead all bill real OP. 130 marks/pool = the cost-band
    // ceiling, so nothing downstream is money-locked.
    // The Market only lists factions the player OWNS, and every OP write needs it
    // too — repair the grant before anything depends on it.
    try { await _stage()?.ensureOwned?.([ctx.faction?.id, ctx.rig?.id, ctx.steward?.id], ctx.user?.id); }
    catch (e) { console.warn(TAG, "ownership repair failed", e); }

    if (ctx.faction) {
      const g = await _stage()?.grantOp?.(ctx.faction.id, {
        economy: 130, violence: 130, intrigue: 130, diplomacy: 130, nonlethal: 60, softpower: 60
      });
      // Tops up toward the tier cap, so a replay on full banks credits nothing —
      // don't announce a stipend that didn't land. Name the faction and the amount:
      // several playtest runs each found their OWN faction, and "nothing changed"
      // usually means the player was looking at a previous run's banner.
      const granted = g?.granted || {};
      if (g?.ok && Object.keys(granted).length) {
        const econOP = ((Number(granted.economy) || 0) / 10).toFixed(1).replace(/\.0$/, "");
        await ctx.speak(`A training stipend just topped up ${ctx.faction.name} — up to what your tier can hold, not a mark more (Economy +${econOP} OP). Check that banner's sheet, not an older one.`);
        await _pause(600);
      } else if (g?.alreadyFull) {
        await ctx.speak(`${ctx.faction.name}'s banks are already full to the tier cap — nothing to top up. Spend freely.`);
        await _pause(600);
      }
    }

    // Pre-seed the Market's context (client-scoped) so it opens pointed at the
    // player's own faction and Steward. Left unset it opens on "(Select)" and the
    // first Buy dies with "Buyer faction not found" — owner playtest 2026-08-17.
    try {
      const MKT = "bbttcc-market";
      const cur = game.settings.get(MKT, "lastContext") || {};
      await game.settings.set(MKT, "lastContext", {
        ...cur,
        factionId: ctx.faction?.id || cur.factionId || "",
        characterId: ctx.steward?.id || cur.characterId || ""
      });
    } catch (e) { console.warn(TAG, "market context pre-seed failed", e); }

    try { globalThis.game?.bbttcc?.api?.market?.openMarket?.(); }
    catch (e) { console.warn(TAG, "market open failed", e); }
    await _pause(600);
    await ctx.speak(`This is the LONG MARKET. I've already set the buyer to ${ctx.faction?.name || "your faction"} and the receiver to ${ctx.steward?.name || "you"} — if either box reads "(Select)", pick them yourself or the till refuses you.`);
    await _pause(700);
    await ctx.speak("Buy what you can afford and can actually USE — your sheet warns you when a weapon or armor sits beyond your training. Watch the price line: it's in MARKS, and ten marks is one OP. And gear does nothing in a duffel bag: EQUIP it from your sheet once it arrives.");
    ctx.riff({ beat: "outfitting", line: "Player is gearing up at the Market before the finale.", intent: "Quartermaster energy — dry, practical. One line." });
  },

  detect: (ctx, done) => {
    const onBuy = (item) => {
      if (item?.parent?.id === ctx.steward?.id) {
        ctx.riff?.({ beat: "outfitting", line: `Player acquired "${item.name}".`, intent: "One dry quartermaster nod at the purchase." });
      }
    };
    Hooks.on("createItem", onBuy);
    ctx.prompt({
      title: "◇ OPERATOR — Outfitting",
      content:
        `<p>Spend some stipend: buy gear from the <b>Market</b>, then <b>equip it</b> on your sheet.</p>` +
        `<p>Mind the training warnings — owning a cannon isn't the same as being able to aim it.</p>`,
      label: "Geared up — move out"
    }).then(() => done());
    return () => Hooks.off("createItem", onBuy);
  },

  exit: async (ctx) => {
    await ctx.speak("Look at you — dressed for the apocalypse you're about to drive into. The Syndicate won't know what pulled up.");
  }
};

/* ═════════════════════ PHASE 3c — TEACHING SLIDES ═════════════════════
 * Three concept beats between the Market and the Proving Ground. Owner ask
 * 2026-08-17: these come BEFORE the fight, "so the player has a manifestation
 * ready to go, and a crew to summon" — the simulator is then a test of things
 * they own, not a first encounter with ideas they've never met.
 *
 * These teach CONCEPTS, not screen furniture, so they use ctx.deck (stepped
 * slides that hold still) rather than tour rings or a wall of chat lines. Every
 * beat ends in a hands-on gate against the real interface, and every gate has an
 * untrappable escape.
 *
 * Numbers quoted in the slides come from the engine, not from a second copy:
 * the manifestation deck embeds `game.fourththing.manifestationGlossaryHTML()`
 * verbatim — the same glossary the cast dialog's coach panel appends.
 */

/** The engine's own glossary, or a pointer to it if the system isn't exposing it
 *  (older system build) — never a paraphrase that can drift out of true. */
function _glossaryHTML() {
  try {
    const html = globalThis.game?.fourththing?.manifestationGlossaryHTML?.();
    if (html) return html;
  } catch (e) { console.warn(TAG, "glossary unavailable", e); }
  return `<p><em>The full glossary lives under the Invoke dialog's coach panel — open any manifestation and hit Invoke to read it.</em></p>`;
}

/* ───────────────────── CREW & OCCULT ASSOCIATION ───────────────────── */
// The Steward's Crew + Occult choice writes into the FACTION's echoAssets and
// unlocks raid maneuvers for the whole banner — a character-sheet dropdown with
// strategic-layer consequences, which is exactly why it needs saying out loud.
const crewOccult = {
  id: "crew_occult",
  title: "The People You Know",
  scope: "personal",

  enter: async (ctx) => {
    await ctx.speak("Before you point a weapon at anything — you're not alone out here, and the game knows it. *bzzt* Two lines on your sheet decide what your whole faction can do.");
    await _pause(800);

    await ctx.deck({
      title: "◇ OPERATOR — Crew & Occult",
      label: "Show me my sheet",
      slides: [
        {
          title: "Two lines, one big lever",
          speak: "Read these slides. There's a test after, and the test is the rest of your life.",
          body: `<p>Your sheet carries an <b>Awesome Crew</b> and an <b>Occult Association</b>. They look like flavour text. They are not.</p>
            <p>Both feed your faction's <b>Echo Assets</b> — the pool of people and traditions your banner can actually call on.</p>
            <span class="bbttcc-deck-key">One Steward's dropdown changes what an entire faction may attempt. That's the biggest lever on the sheet, and it's two clicks.</span>`
        },
        {
          title: "What they actually unlock",
          body: `<p>Raid <b>maneuvers</b> — the special moves in the Raid Console — are gated. Most are locked until something on your side grants them.</p>
            <p>Three things grant maneuvers:</p>
            <ul>
              <li>your faction's active <b>Crews</b></li>
              <li>its active <b>Occult Associations</b></li>
              <li>the <b>classes</b> on its roster</li>
            </ul>
            <p>In the Raid Console a granted maneuver wears a green <b>✦ badge</b> naming exactly who unlocked it for you.</p>`
        },
        {
          title: "Why it's a real choice",
          body: `<p>You are not picking a favourite. You're picking <b>which options exist</b> when your faction is in trouble.</p>
            <p>A crew of smugglers and a crew of field medics do not open the same doors, and neither does a Kabbalist versus an Alchemist.</p>
            <span class="bbttcc-deck-key">Swap them whenever the fiction supports it — but swap them <em>deliberately</em>. Your GM will notice what you can suddenly do.</span>`
        },
        {
          title: "The roster — they're people, not a stat",
          speak: "Here's the part that surprises everyone.",
          body: `<p>Each Crew and Association carries a <b>roster</b>: the named people you've met through it. Companions, rivals, mentors, debts running both directions.</p>
            <p>You don't have to invent them cold — <b>✨ Suggest members</b> writes setting-flavoured people you can keep, edit or bin.</p>
            <p>And <b>Mint</b> turns a roster entry into a <b>real NPC actor</b> — Calling picked, Echo Boons applied, gear to your tier. They stop being a line of text and start being someone the GM can put on the map.</p>`
        },
        {
          title: "Spotlight — calling one in",
          body: `<p>Once per scene you may <b>Invoke</b> a roster member: pull one of them into the moment, on screen, doing the thing they're good at.</p>
            <p>One spotlight per scene, refreshed by a <b>Scene Break</b>. Members flagged <b>Default present</b> are the ones pre-selected when the crew turns up in a raid.</p>
            <span class="bbttcc-deck-key">This is the summon. Your Crew is not a bonus — it's a rolodex with teeth, and once a scene you get to cash one in.</span>`
        }
      ]
    });

    // Identity edit lives behind the sheet's edit toggle — say so, or they hunt.
    try { ctx.steward?.sheet?.render(true, { focus: true }); } catch (_) {}
    await _pause(600);
    await ctx.speak("Sheet's up. Flip on EDIT mode (the pencil, top right) and find Awesome Crew and Occult Association in the identity block. Pick one of each — anything; you can change them later.");
    await _pause(900);
    // The manager is where Roster / Invoke / Manifest all live — one door for
    // the three verbs the slides just described.
    try {
      const mgr = globalThis.game?.fourththing?.echoAssets?.openManager;
      if (typeof mgr === "function") {
        await mgr(ctx.steward);
        await ctx.speak("That's your Echo Assets panel — every Crew and Association you carry, with ROSTER and INVOKE on each row. Open a roster, hit ✨ Suggest members, and mint one of them into a real person.");
      } else {
        await ctx.speak("Your Echo Assets panel lives on the sheet — that's where each Crew and Association gets its ROSTER and its once-a-scene INVOKE.");
      }
    } catch (e) { console.warn(TAG, "echo assets manager failed to open", e); }
    ctx.riff({ beat: "crew_occult", line: "Player is choosing their Crew and Occult Association for the first time.", intent: "One dry line about the company they keep." });
  },

  detect: (ctx, done) => {
    const FALLBACK_TITLE = "◇ OPERATOR — Crew & Occult";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);
    let spoke = false;

    // The sheet writes these through bbttcc-character-options; watch the actor
    // rather than guessing at the flag path, so any storage shape trips it.
    const onUpd = (actor) => {
      if (actor?.id !== ctx.steward?.id || spoke) return;
      const picked = _crewOccultOf(ctx.steward);
      if (!picked.crew && !picked.occult) return;
      spoke = true;
      const named = [picked.crew, picked.occult].filter(Boolean).join(" · ");
      ctx.speak?.(`Logged: ${named}. Your banner just inherited whatever they know.`);
      _reportGrants(ctx).catch(e => console.warn(TAG, "grant report failed", e));
    };
    // A minted crew member is a brand-new NPC actor — worth a nod, since that's
    // the moment the roster stops being text and starts being someone.
    const onMint = (actor) => {
      if (actor?.type !== "npc") return;
      const co = _crewOccultOf(ctx.steward);
      if (!co.crew && !co.occult) return;
      ctx.speak?.(`${actor.name} just became a real person on the board. That's your crew — findable, killable, and yours to call.`);
    };
    Hooks.on("updateActor", onUpd);
    Hooks.on("createActor", onMint);

    ctx.prompt({
      title: FALLBACK_TITLE,
      content:
        `<p><b>1.</b> On your sheet: turn on <b>Edit</b> (pencil, top right), then set <b>Awesome Crew</b> and <b>Occult Association</b> in the identity block. Both feed your faction's Echo Assets and unlock raid maneuvers for the whole banner.</p>` +
        `<p><b>2.</b> In the <b>Echo Assets</b> panel, open a <b>Roster</b>, try <b>✨ Suggest members</b>, and <b>Mint</b> one into a real NPC.</p>` +
        `<p><i>Once per scene you can <b>Invoke</b> a roster member to pull them on screen — that's your summon.</i></p>` +
        `<p><i>Lists empty or the panel won't open? Continue — you can set all of this any time.</i></p>`,
      label: "Company noted"
    }).then(() => done());

    return () => { Hooks.off("updateActor", onUpd); Hooks.off("createActor", onMint); closeFallback(); };
  },

  exit: async (ctx) => {
    await ctx.speak("Good. People are infrastructure, One — the only kind that argues back. One spotlight a scene; spend it on the moment that deserves it.");
  }
};

/** Read the Steward's crew / occult labels. `setActorEchoAssetSlot`
 *  (bbttcc-bridge.js) writes BOTH the identity block and a per-slot shortcut
 *  flag, so check the identity block first and fall back to the shortcut. */
function _crewOccultOf(steward) {
  const co = steward?.flags?.["bbttcc-character-options"] ?? {};
  const read = (slot) => {
    const ident = co.identity?.[slot];
    return String(ident?.displayName || ident?.name || co[slot]?.name || "").trim();
  };
  return { crew: read("crew"), occult: read("occult") };
}

/** Tell the player what their choice actually opened, using the raid module's
 *  own grant map — no second copy of the crew→maneuver table lives here. */
async function _reportGrants(ctx) {
  const grants = globalThis.game?.bbttcc?.api?.raid?.crewGrants;
  const faction = ctx.faction;
  if (!grants?.forFaction || !faction) return;
  const keys = grants.forFaction(faction) ?? [];
  if (!keys.length) {
    await ctx.speak("No new maneuvers off that pairing yet — the grant shows up once your faction registers the Echo Asset. Your GM can confirm it.");
    return;
  }
  const named = keys.slice(0, 6).map(k => {
    const by = grants.grantedBy?.(faction, k);
    return by ? `${k} (${by})` : k;
  });
  await ctx.speak(`${faction.name} can now attempt ${keys.length} granted maneuver${keys.length === 1 ? "" : "s"}: ${named.join(", ")}${keys.length > 6 ? "…" : ""}. Look for the ✦ badges in the Raid Console.`);
}

/* ───────────────────────────── SURGE ───────────────────────────── */
// Surge is the meta-currency that pays for the reach/"overcast" move taught in
// the next beat, so it comes first.
const surgeBeat = {
  id: "surge",
  title: "Surge",
  scope: "personal",

  enter: async (ctx) => {
    const sys = ctx.steward?.system?.system ?? ctx.steward?.system ?? {};
    const cur = Number(sys?.resources?.surge?.value) || 0;
    const max = Number(sys?.resources?.surge?.max) || 10;

    await ctx.speak("Next: the currency nobody explains until it's too late. *bzzt* Surge.");
    await _pause(700);

    await ctx.deck({
      title: "◇ OPERATOR — Surge",
      label: "Open my Engagement tab",
      slides: [
        {
          title: "What Surge is",
          speak: "You've been earning this since your first roll. Nobody told you. That's on me.",
          body: `<p><b>Surge</b> is a separate bank sitting beside your health and your Clarity. It never modifies a roll by itself — it <b>buys</b> things.</p>
            <p>Right now you're holding <b>${cur} / ${max}</b>.</p>
            <span class="bbttcc-deck-key">It is the only resource in the game you earn by <em>succeeding</em>, rather than by spending something else.</span>`
        },
        {
          title: "How you bank it",
          body: `<p>Dice in this system <b>explode</b>: roll a ten, roll again and add. Every explosion banks you <b>+1 Surge</b>.</p>
            <p>That means Surge accrues from playing well and rolling hot — attacks, checks, saves, all of it. You've almost certainly banked some already without noticing.</p>
            <p>The bank has a ceiling, so it's use-it-or-waste-it once you're full.</p>`
        },
        {
          title: "How you spend it",
          body: `<p>Your sheet's <b>Engagement</b> tab has a <b>✦ Surge</b> panel with a <b>Spend</b> button.</p>
            <p>It offers universal options plus whatever your class brings — Forge-Weld, Rallying Words, Brace, and the rest. Costs run from cheap tricks to the ones that end an argument.</p>
            <span class="bbttcc-deck-key">And one more use, which the next beat is entirely about: Surge is how you cast <b>above your tier</b>.</span>`
        }
      ]
    });

    try { ctx.steward?.sheet?.render(true, { focus: true }); } catch (_) {}
    await _pause(600);
    await ctx.speak(cur > 0
      ? `Engagement tab, ✦ Surge panel — you're holding ${cur}. Open Spend and read what's on the menu. You don't have to buy anything; just learn where the shop is.`
      : "Engagement tab, ✦ Surge panel. You're empty right now — the bank fills the moment your dice start exploding. Open Spend anyway and read the menu so you know what you're saving for.");
    ctx.riff({ beat: "surge", line: "Player is being shown the Surge economy for the first time.", intent: "One line — the daemon is slightly embarrassed it didn't mention this earlier." });
  },

  detect: (ctx, done) => {
    const FALLBACK_TITLE = "◇ OPERATOR — Surge";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);
    // Banking Surge mid-beat is worth a nod — it's the clearest possible proof
    // of the rule we just described.
    let noted = false;
    const onUpd = (actor, changed) => {
      if (actor?.id !== ctx.steward?.id || noted) return;
      const v = foundry.utils.getProperty(changed, "system.resources.surge.value");
      if (v === undefined) return;
      noted = true;
      ctx.speak?.(`There — Surge just moved to ${v}. That's the dice paying you.`);
    };
    Hooks.on("updateActor", onUpd);
    ctx.prompt({
      title: FALLBACK_TITLE,
      content:
        `<p>Sheet → <b>Engagement</b> tab → the <b>✦ Surge</b> panel. Press <b>Spend</b> and read the menu.</p>` +
        `<p>Banked by exploding dice (+1 per explosion). Spent on class powers — and on reaching above your tier, which is next.</p>`,
      label: "I know where it lives"
    }).then(() => done());
    return () => { Hooks.off("updateActor", onUpd); closeFallback(); };
  },

  exit: async (ctx) => {
    await ctx.speak("Surge banked is a decision you haven't made yet. Try not to die holding ten of them.");
  }
};

/* ──────────────────── MANIFESTATIONS & CASTING ──────────────────── */
// The big one: the dials, then BUILD one in the real Manifestation Engine, then
// FIRE it. Reach (the "overcast" move) is taught here because it's a knob on the
// Invoke dialog, not a separate system.
const manifestations = {
  id: "manifestations",
  title: "The Reality Dials",
  scope: "personal",

  enter: async (ctx) => {
    ctx._maniBefore = new Set((ctx.steward?.items ?? [])
      .filter(i => i.type === "power" || i.type === "weapon").map(i => i.id));

    await ctx.speak("Last classroom module, and it's the one the whole setting hangs on. *bzzt* Manifestations — how a Steward argues with reality and occasionally wins.");
    await _pause(900);

    await ctx.deck({
      title: "◇ OPERATOR — Manifestations",
      label: "Build me one",
      slides: [
        {
          title: "Workings and Forms",
          speak: "Sit up. This is the part the manual gets wrong and I get right.",
          body: `<p>Everything you manifest is one of two shapes.</p>
            <ul>
              <li><b>Workings</b> are instant. They happen, they resolve, they're over.</li>
              <li><b>Forms</b> persist — sustained, bound or enduring — and cost you <b>upkeep</b> every tick to keep holding open.</li>
            </ul>
            <span class="bbttcc-deck-key">Only Trad Caster Classes may manifest Workings. Everyone else shapes the world by <em>holding it open</em>, not by intervening directly. That's a setting statement as much as a rule.</span>`
        },
        {
          title: "Clarity — what it costs",
          body: `<p><b>Clarity</b> is your focus pool, and it is the price of every cast: <b>T1 = 1, T2 = 2, T3 = 3, T4 = 5</b>, plus upkeep per tick on anything you're sustaining.</p>
            <p>Your maximum scales with your own tier (5 / 7 / 10 / 14). A <b>Soma Break</b> refills it; a <b>Scene Break</b> half-fills it and shaves a point of Noise.</p>
            <p>Run dry and you simply cannot cast. Budget it like ammunition.</p>`
        },
        {
          title: "Stance — the three ways to cast",
          body: `<p>Every Invoke asks for a stance, and the stance moves three dials at once:</p>
            <ul>
              <li><b>Hermetic</b> — +1 Clarity, no Noise, misfire shifted <b>−2</b> (safer), slower setup.</li>
              <li><b>Chaos</b> — −1 Clarity, <b>+2 Noise</b>, misfire shifted <b>+2</b> (worse), fast.</li>
              <li><b>Ascendant</b> — T3+ only. Pays <b>+1 Blood Debt</b> instead of Clarity. No Noise, no misfire at all.</li>
            </ul>
            <span class="bbttcc-deck-key">Cheap, safe, quiet: pick two. That's the whole design.</span>`
        },
        {
          title: "Misfire, and the ledgers",
          body: `<p>Fail a cast and you roll <b>misfire</b> — a d10 table running from a mild reality flicker at 1–2 up to catastrophic resonance at 10. Your stance biases that die, and so does your Noise.</p>
            <p><b>Blood Debt</b> is a separate ledger that catches up with you later, on the GM's schedule rather than yours.</p>
            <span class="bbttcc-deck-key">Neither of these is a punishment for playing badly. They're the price list for playing fast.</span>`
        },
        {
          title: "Noise — the one that compounds",
          speak: "Pay attention to this one. It's the resource people ruin themselves with.",
          body: `<p><b>Noise</b> is the residue Chaos leaves behind: <b>+2 per cast</b>, on a 0–10 track. It does <b>not</b> decay on its own — a Scene Break shaves exactly <b>one</b> point.</p>
            <p>It is not decoration. Every single point is a flat <b>−1 to your own cast rolls</b>, forever, until you bring it down.</p>
            <p>And it bands:</p>
            <ul>
              <li><b>Humming</b> (3+) — −1 to Intrigue checks. Something nearby can read you.</li>
              <li><b>Loud</b> (5+) — −2 to Intrigue, and your misfires roll <b>one band worse</b>.</li>
              <li><b>Screaming</b> (8+) — −3 to Intrigue, misfires <b>two bands worse</b>, and the Lattice is looking directly at you.</li>
            </ul>
            <span class="bbttcc-deck-key">Chaos is cheaper and faster. The bill arrives later, it arrives compounding, and it makes you easy to find. Spend it on purpose.</span>`
        },
        {
          title: "Reach — casting above your tier",
          body: `<p>This is the overcast move, and it has a hard limit: you may reach <b>exactly one tier above your own</b>. Two is refused outright.</p>
            <p>Reaching costs one of two things, and the Invoke dialog makes you choose:</p>
            <ul>
              <li><b>Surge</b> — you cast at the higher tier, but if you fail, the misfire rolls on that <em>higher</em> column.</li>
              <li><b>Blood Debt</b> — +1 Blood Debt, a clean cast, and no misfire at all.</li>
            </ul>
            <span class="bbttcc-deck-key">Surge risks the present. Blood Debt mortgages the future. Neither is free, and the game remembers both.</span>
            <p style="opacity:0.8;font-size:0.85em"><i>One honest asterisk: some Paths bend these rules — Trad Caster Classes carry deeper Clarity pools and reach further without penalty. When this slide and your Invoke dialog disagree, the dialog's cost line is the truth.</i></p>`
        },
        {
          title: "The full glossary",
          body: `<p>Straight from the engine — the same reference the Invoke dialog carries under its coach panel:</p>${_glossaryHTML()}`
        }
      ]
    });

    await ctx.speak("Theory's done. Now build one — the Manifestation Engine walks you through it step by step. Make something small and useful; you'll be firing it in a minute, and then again for real.");
    await _pause(600);
    try {
      const ft = globalThis.game?.fourththing;
      // Prefer the shape chooser: it is the canonical "author a new one" door,
      // it TCC-gates Workings for us, and it makes the player spend the
      // Workings-vs-Forms slide they just read. Wizard direct is the fallback.
      if (typeof ft?.openManifestationStarterDialog === "function") {
        ft.openManifestationStarterDialog(ctx.steward);
      } else if (typeof ft?.wizardV2 === "function") {
        ft.wizardV2(ctx.steward, { kind: "power", starter: "ritual" });
      } else {
        ui.notifications?.warn?.("Manifestation Engine unavailable — open it from your sheet's Manifestations tab.");
        await ctx.speak("Engine won't open from here — *bzzt* — use the Manifestations tab on your sheet and hit the build button.");
      }
    } catch (e) {
      console.warn(TAG, "manifestation engine failed to open", e);
      await ctx.speak("Engine threw a spanner. Build one from your sheet's Manifestations tab instead.");
    }
    ctx.riff({ beat: "manifestations", line: "Player is authoring their first manifestation in the engine.", intent: "One line — the daemon is genuinely interested in what they'll make." });
  },

  detect: (ctx, done) => {
    const FALLBACK_TITLE = "◇ OPERATOR — Manifestations";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);
    let built = false, fired = false;
    const finish = () => { if (built && fired) done(); };

    // Built: a new power/weapon lands on the Steward.
    const onCreate = (item) => {
      if (built || item?.parent?.id !== ctx.steward?.id) return;
      if (item.type !== "power" && item.type !== "weapon") return;
      if (ctx._maniBefore?.has(item.id)) return;
      built = true;
      ctx._maniName = item.name;
      ctx.speak?.(`"${item.name}" — authored and on your sheet. Now INVOKE it. Watch the stance buttons and the cost line as you do; that's the whole lesson in one dialog.`);
      // A targeted working (save / attack / contested resolution) needs
      // something to point at, and this classroom spawns no targets — the gap
      // the owner hit when "Sic." (a reaction-trigger Mark) came off the press
      // (2026-08-21). Give them what the meatsuit range gave them: a dummy.
      (async () => {
        try {
          const shape = String(foundry.utils.getProperty(item, "system.resolution.shape")
            ?? foundry.utils.getProperty(item, "flags.fourththing.resolution.shape") ?? "").toLowerCase();
          if (!["save", "attack", "contested"].includes(shape)) return;
          const tok = ctx.steward?.getActiveTokens?.()?.[0];
          const scene = tok?.scene ?? canvas?.scene;
          if (!scene || !tok) return;
          const g = Number(scene.grid?.size) || 100;
          const dummy = await _stage()?.spawnDummy?.(scene, {
            x: tok.document.x + 2 * g, y: tok.document.y, name: "Peer Reviewer"
          });
          if (dummy) {
            (ctx._spawned ??= []).push(dummy);
            await ctx.speak?.("Your working wants a TARGET, so I've printed you a volunteer — say hello to the Peer Reviewer. Target it and invoke. If your working triggers off a failure, have your GM make the poor thing attempt something doomed first.");
          }
        } catch (e) { console.warn(TAG, "practice target spawn failed", e); }
      })();
      finish();
    };
    // Fired: the system's real cast event (added 2026-08-17). It carries the
    // whole moment — tier, stance, reach, success, misfire, cost — so the beat
    // can speak to what the player actually DID instead of guessing.
    //
    // This replaced a Clarity-decrease heuristic, which was silently wrong for
    // every zero-cost cast (Ascendant, TCC Chaos T1, free-Clarity, T0 Fiat).
    // itemAnimated stays as the backstop for a cast routed through a path that
    // doesn't reach castManifestation.
    const markFired = (why) => {
      if (fired) return;
      fired = true;
      console.log(TAG, `manifestations: cast detected via ${why}`);
      finish();
    };
    const onCast = (actor, info = {}) => {
      if (actor?.id !== ctx.steward?.id) return;
      // Say the interesting thing back to them. Reaching above your tier on a
      // first cast deserves more than a generic nod, and so does a misfire.
      if (info.reached) {
        ctx.speak?.(`You reached — T${info.tier} out of a T${info.stewardTier} body, paid in ${info.reachPath === "bloodDebt" ? "Blood Debt" : "Surge"}. Bold. The ledger noticed.`);
      } else if (info.misfire) {
        ctx.speak?.("It got away from you — that's a misfire, and misfires are data. Read the card; the table it rolled on is the one your stance chose.");
      } else if (info.success) {
        ctx.speak?.(`"${info.label}" lands. Cost you ${info.cost?.clarity ?? 0} Clarity${info.cost?.noise ? ` and ${info.cost.noise} Noise` : ""}. Reality filed the paperwork.`);
      } else {
        ctx.speak?.("Didn't take. No shame in it — the cost was paid either way, which is the part worth remembering.");
      }
      markFired("fourththing.manifestationCast");
    };
    const onAnim = (data = {}) => {
      const a = data.actor || data.sourceToken?.actor;
      if (a?.id !== ctx.steward?.id) return;
      ctx.speak?.("There it is. Reality filed the paperwork.");
      markFired("itemAnimated (backstop)");
    };
    Hooks.on("createItem", onCreate);
    Hooks.on("fourththing.manifestationCast", onCast);
    Hooks.on("fourththing:itemAnimated", onAnim);

    ctx.prompt({
      title: FALLBACK_TITLE,
      content:
        `<p><b>1.</b> Build a manifestation in the <b>Manifestation Engine</b> (it should be open; otherwise your sheet's Manifestations tab has the build button).</p>` +
        `<p><b>2.</b> <b>Invoke</b> it from your sheet — read the stance options and the cost line before you commit.</p>` +
        `<p><i>Engine misbehaving, or you'd rather build one later? Move on — you can author manifestations any time.</i></p>`,
      label: "Move on"
    }).then(() => done());

    return () => {
      Hooks.off("createItem", onCreate);
      Hooks.off("fourththing.manifestationCast", onCast);
      Hooks.off("fourththing:itemAnimated", onAnim);
      closeFallback();
    };
  },

  exit: async (ctx) => {
    await ctx.speak(ctx._maniName
      ? `${ctx._maniName} is yours now — it goes where you go. Keep it in reach; you're about to need it.`
      : "You can author manifestations whenever the mood takes you. Keep at least one loaded before trouble finds you.");
    await _pause(700);
    await ctx.speak("Crew at your back, Surge in the bank, something of your own making in your hands. That's a Steward. *bzzt* — Now we find out whether any of it survives contact.");
    // The Peer Reviewer's tenure ends with the classroom.
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._maniBefore = null;
  }
};

/* ═════════════════════════ COMBAT SIMULATOR ═════════════════════════
 * The Proving Ground, live-fire. Placed AFTER outfitting (so the gear they just
 * bought gets used) and BEFORE travel (so nobody meets the Syndicate having never
 * thrown a punch). Owner's design, 2026-08-17.
 *
 * Two kinds of enemy, and the difference IS the lesson:
 *   QLIPHOTHIC — hollow things wearing a shape. Put them down; nothing is lost.
 *   SENTIENT   — people. They fold once they're clearly losing. Killing them
 *                anyway is ALLOWED — and puts a point on the Steward's DARKNESS
 *                track. The consequence teaches the moral spine, not just the
 *                buttons; the simulator never blocks the kill, it just remembers.
 *
 * The waves also make the player USE the kit: husks shrug off kinetic (so the
 * bought gun alone won't finish them), one waits on a gantry (so elevation and
 * knocking things off it come up), and the last wave is a vehicle (so they board
 * their own rig and fight from it).
 */

// ⚠ POSITIONS ARE FIRST-PASS and want an eyeball pass in-world. Only two points
// on the owner's Proving Ground art are known-good — the dry bank at ~0.60/0.62
// and ~0.62/0.52, from the meatsuit beat's 2026-08-17 nudge (the earlier marks
// put the Steward in the river). Everything below is laid out around that bank
// and kept in ONE table so nudging is a one-line edit per foe.
// 2026-08-21 playtest: (0.62, 0.66) landed the Steward INSIDE the walled
// arena — the finale's venue — while every wave stages in the open ground
// (x 0.38–0.52). The sim happens in the yard; the arena door stays shut
// until the trials send you there. Spawn just south of wave 1 instead.
const SIM_STEWARD_AT = { xFrac: 0.46, yFrac: 0.68 };
const SIM_RIG_AT     = { xFrac: 0.53, yFrac: 0.72 };

const SIM_WAVES = [
  {
    key: "husks",
    // Hollow things. Resistant to kinetic, vulnerable to sephirotic — a bought
    // rifle does half, a manifestation does double. That asymmetry is the
    // damage-type lesson, delivered by the foes rather than by a lecture.
    brief: "Three hollow things on the field. Qliphothic — nobody's home, nothing to save. Put them down.",
    coach: "Read them before you shoot: they're RESISTANT to kinetic and VULNERABLE to sephirotic. Your rifle will feel blunt; anything with light in it will not. This is what the manifestation you just authored is FOR — mix your damage types, that's the whole trick.",
    // fromPack: real pre-gens from the Qliphothic Bestiary (master-content
    // npcs compendium, owner drop 2026-08-26) — authored abilities + art. The
    // resist/vuln pairs still ride along as a mergeDefenses UNION so the
    // damage-type lesson survives any authored profile; if the pack or the
    // name is missing, the spawn falls back to the bespoke hollow below.
    foes: [
      { name: "Hollow Thing",   fromPack: "Ghagielite Blinder",   foeClass: "qliphothic", body: 4, xFrac: 0.46, yFrac: 0.58,
        resistances: ["kinetic"], vulnerabilities: ["sephirotic"] },
      { name: "Hollow Thing",   fromPack: "Nahemoth Husk",        foeClass: "qliphothic", body: 4, xFrac: 0.40, yFrac: 0.46,
        resistances: ["kinetic"], vulnerabilities: ["sephirotic"] },
      { name: "Gantry Hollow",  fromPack: "Satariel Veil-Spinner", foeClass: "qliphothic", body: 3, xFrac: 0.52, yFrac: 0.40, elevation: 20, perch: true,
        resistances: ["kinetic"], vulnerabilities: ["sephirotic"] }
    ]
  },
  {
    key: "scavengers",
    // People. Deliberately tougher than the husks (body 5 ≈ 25 integrity) so
    // there is ROOM to notice the track falling and stop — a one-shot kill would
    // teach nothing except that the lesson was unwinnable.
    brief: "Second wave's different. Two scavengers — Sentient. Living people, scared and armed.",
    coach: "Watch their INTEGRITY as you work. Take them low and they fold — that's a save, and it costs you nothing. Put them at zero and that's a kill: allowed, nobody will stop you, and it goes on your Darkness. Your call, One. It always is.",
    foes: [
      { name: "Scavenger — Bit",  foeClass: "sentient", body: 5, xFrac: 0.44, yFrac: 0.62 },
      { name: "Scavenger — Coll", foeClass: "sentient", body: 5, xFrac: 0.38, yFrac: 0.52 }
    ]
  },
  {
    key: "guntruck",
    // Rig-typed, so it takes ram/weapon damage on system.integrity and fires the
    // system's own bbttcc:rig:destroyed cascade — the same detection the driving
    // beat gates on. Nothing crews it, so there is no sentient question here.
    brief: "Last one's dug in at the far end. A gun-truck — qliphothic-run, no driver worth the name.",
    coach: "This is a VEHICLE. Fight it with yours: select your Steward, right-click, 🚚 board your rig, and bring the guns. On foot you'll be outranged and outweighed.",
    rig: { name: "Qliphothic Gun-Truck", xFrac: 0.36, yFrac: 0.56, size: 2, integrity: 14, bracket: "medium" }
  }
];

const combatSim = {
  id: "combat_sim",
  title: "The Proving Ground",
  scope: "personal",

  enter: async (ctx) => {
    ctx._spawned = [];
    ctx._sim = {
      scene: null,
      waveIdx: -1,
      records: new Map(),          // actorId → foe record for the CURRENT wave
      tally: { husksDown: 0, saved: 0, killed: 0, rigsWrecked: 0, darkness: 0 },
      advancing: false,
      finished: false
    };

    await ctx.speak("Gear's bought, crew's behind you, and you're carrying something you built yourself. Now the part the manuals skip: what all of it does when something is trying to end you. Proving Ground, live-fire. *bzzt*");
    await _pause(900);

    // Same scene as the meatsuit beat — the owner's Proving Ground art, reused
    // rather than authoring a second arena (owner ask 2026-08-17).
    const scene = await _requireScene(ctx, "meatsuit-range", "Proving Ground");
    ctx._sim.scene = scene;
    if (scene) { await _enterScene(scene, "Proving Ground", ctx.lane); await _pause(800); }

    // Shared stage: clear prior runs' leftovers (sigils, dead foes, shards)
    // before the first wave dresses the field.
    try { if (scene) await _stage()?.sweepScene?.(scene); } catch (_) {}

    // Everything below writes to actors the player must own — repair the grant
    // before the first shot rather than after the first permission wall.
    try { await _stage()?.ensureOwned?.([ctx.faction?.id, ctx.rig?.id, ctx.steward?.id], ctx.user?.id); }
    catch (e) { console.warn(TAG, "sim ownership repair failed", e); }

    const stage = _stage();
    if (scene && stage) {
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, _scenePoint(scene, SIM_STEWARD_AT.xFrac, SIM_STEWARD_AT.yFrac, ctx.lane));
      if (st?.created) ctx._spawned.push({ token: st.doc });
      // The rig rides along from the start — wave 3 needs it, and a player who
      // wants to fight the whole sim from the cab should be able to.
      if (ctx.rig) {
        const rt = await stage.ensureTokenOnScene(ctx.rig, scene, _scenePoint(scene, SIM_RIG_AT.xFrac, SIM_RIG_AT.yFrac, ctx.lane));
        if (rt?.created) ctx._spawned.push({ token: rt.doc });
      }
    }

    // The foes have no AI — somebody has to play them. Tell the GM what's coming
    // and what the beat is watching for, so the opposition can actually push back
    // instead of standing there being shot. Same whisper pattern the raid beats use.
    try {
      await ChatMessage.create({
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "◇ OPERATOR" },
        content:
          `<p><b>Onboarding combat simulator — ${ctx.steward?.name || "a student"} is on the Proving Ground.</b></p>` +
          `<p>Three waves, spawned one at a time as each clears: <b>3 hollow</b> (qliphothic — one starts on a gantry at elevation 20)` +
          ` → <b>2 scavengers</b> (sentient) → <b>1 gun-truck</b> (rig).</p>` +
          `<p>Nothing runs them but you — take their turns if you want a real fight. The beat watches integrity itself:` +
          ` a sentient dropped to 40% or less <b>surrenders</b> (Calmed, track floored); killed outright, it adds <b>+1 Darkness</b>` +
          ` to ${ctx.steward?.name || "the student"}. Both outcomes are legal — please don't talk them out of either one.</p>`
      });
    } catch (e) { console.warn(TAG, "combat sim GM briefing failed", e); }

    await _pause(500);
    await ctx.speak("Ground rules. Two kinds of thing come at you out here. QLIPHOTHIC are hollow — a shape with nothing living in it. Kill them; there's nothing to save. SENTIENT are people. People fold when they're losing, and a folded enemy is a saved one.");
    await _pause(1000);
    await ctx.speak("You can kill the sentient ones. I won't stop you, and neither will the rules. It'll just show up on your DARKNESS track, and it stays there. That's not a punishment, One — it's a receipt.");
    ctx.riff({ beat: "combat_sim", line: "Player is about to fight their first live-fire simulation — hollow things first, then people they could spare.", intent: "Drill-instructor daemon with one uneasy note about the second wave. One line." });
  },

  detect: (ctx, done) => {
    const sim = ctx._sim;
    const stage = _stage();
    const FALLBACK_TITLE = "◇ OPERATOR — Proving Ground";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);

    if (!sim?.scene || !stage) {
      // No stage to fight on (missing scene, or no GM online to run the spawn
      // ops) — say so and let them pass rather than gating on foes that will
      // never exist.
      ctx.prompt({
        title: FALLBACK_TITLE,
        content: "<p>The Proving Ground isn't available right now — no arena, or no GM online to run the simulation.</p><p>Continue when ready; you can replay this beat later.</p>",
        label: "Continue"
      }).then(() => done());
      return closeFallback;
    }

    /** Current integrity for either shape of actor. Rigs keep the canonical value
     *  at system.integrity; characters/npcs at system.derived.integrity. */
    const integrityOf = (actor, isRig) => {
      const sys = actor?.system?.system ?? actor?.system;
      const raw = isRig
        ? foundry.utils.getProperty(sys, "integrity.value")
        : foundry.utils.getProperty(sys, "derived.integrity.value");
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const finish = () => {
      if (sim.finished) return;
      sim.finished = true;
      done();
    };

    /** Spawn the next wave, or end the simulation when they're all resolved. */
    const advance = async () => {
      if (sim.advancing || sim.finished) return;
      sim.advancing = true;
      try {
        sim.waveIdx += 1;
        sim.records.clear();
        const wave = SIM_WAVES[sim.waveIdx];
        if (!wave) { finish(); return; }

        await ctx.speak(wave.brief);
        await _pause(700);

        if (wave.rig) {
          const sp = await stage.spawnObstacle?.(sim.scene, {
            name: wave.rig.name, size: wave.rig.size, integrity: wave.rig.integrity, bracket: wave.rig.bracket,
            ..._scenePoint(sim.scene, wave.rig.xFrac, wave.rig.yFrac, ctx.lane)
          });
          if (sp?.actor) {
            ctx._spawned.push(sp);
            sim.records.set(sp.actor.id, {
              actorId: sp.actor.id, tokenId: sp.token?.id || null, name: sp.actor.name,
              foeClass: "qliphothic", isRig: true, perch: false, resolved: false,
              max: Number(wave.rig.integrity) || 0, last: Number(wave.rig.integrity) || 0
            });
          }
        } else {
          for (const f of (wave.foes || [])) {
            // Prefer the authored pre-gen when the wave names one; fall back to
            // the bespoke stat-line spawn if the compendium can't provide it.
            let sp = null;
            if (f.fromPack) {
              sp = await stage.spawnFromPack?.(sim.scene, {
                actorName: f.fromPack, elevation: f.elevation ?? 0,
                mergeDefenses: { resistances: f.resistances ?? [], vulnerabilities: f.vulnerabilities ?? [] },
                conditions: f.conditions ?? [],
                ..._scenePoint(sim.scene, f.xFrac, f.yFrac, ctx.lane)
              });
            }
            if (!sp?.actor) sp = await stage.spawnFoe?.(sim.scene, {
              name: f.name, foeClass: f.foeClass, body: f.body, size: f.size ?? 1,
              elevation: f.elevation ?? 0,
              resistances: f.resistances ?? [], vulnerabilities: f.vulnerabilities ?? [],
              ..._scenePoint(sim.scene, f.xFrac, f.yFrac, ctx.lane)
            });
            if (!sp?.actor) continue;
            ctx._spawned.push(sp);
            const max = Number(sp.integrityMax) || Number(integrityOf(sp.actor, false)) || 0;
            sim.records.set(sp.actor.id, {
              actorId: sp.actor.id, tokenId: sp.token?.id || null, name: sp.actor.name,
              foeClass: f.foeClass, isRig: false, perch: !!f.perch, resolved: false,
              shoved: false, max, last: max
            });
          }
        }

        if (!sim.records.size) {
          // Nothing spawned (relay dropped, or the wave is empty) — don't hang
          // the player on foes that don't exist.
          console.warn(TAG, `combat sim: wave "${wave.key}" spawned nothing — skipping it.`);
          sim.advancing = false;
          return advance();
        }

        await _pause(500);
        await ctx.speak(wave.coach);
      } catch (e) {
        console.warn(TAG, "combat sim wave advance failed", e);
      } finally {
        sim.advancing = false;
      }
    };

    /** Retire one foe and, when the wave is clear, roll on. */
    const resolveFoe = async (rec, how) => {
      if (!rec || rec.resolved) return;
      rec.resolved = true;
      if (how === "saved") {
        sim.tally.saved += 1;
        try { await stage.foeSurrender?.(rec.actorId); } catch (_) {}
        await ctx.speak?.(`${rec.name} drops their weapon — hands up, still breathing. That's a save.`);
      } else if (how === "killed" && rec.foeClass === "sentient") {
        sim.tally.killed += 1;
        // The receipt. Darkness is a manual track — nothing else writes it.
        let landed = null;
        try { landed = await stage.raiseDarkness?.(ctx.steward?.id, 1, `killed ${rec.name} (onboarding sim)`); } catch (_) {}
        if (landed?.ok && landed.after > landed.before) {
          sim.tally.darkness += (landed.after - landed.before);
          await ctx.speak?.(`${rec.name} is dead. Darkness ${landed.before} → ${landed.after}. I'm not scolding you, One — I'm just the one who writes it down.`);
        } else {
          await ctx.speak?.(`${rec.name} is dead. That one was a person.`);
        }
      } else if (how === "gone") {
        console.log(TAG, `combat sim: "${rec.name}" left the board unresolved — not scored.`);
      } else if (rec.isRig) {
        sim.tally.rigsWrecked += 1;
        await ctx.speak?.(`${rec.name} — wrecked. Nothing in it was ever alive.`);
      } else {
        sim.tally.husksDown += 1;
        const left = [...sim.records.values()].filter(r => !r.resolved).length;
        if (left > 0) await ctx.speak?.(`${rec.name} folds into nothing. ${left} still standing.`);
      }
      if ([...sim.records.values()].every(r => r.resolved)) {
        await _pause(600);
        await advance();
      }
    };

    const onUpd = (actor, changed) => {
      const rec = sim.records.get(actor?.id);
      if (!rec || rec.resolved || sim.finished) return;
      const val = integrityOf(actor, rec.isRig);
      if (val === null) return;

      // The gantry gives way. There is no rooftop-scale forced movement in the
      // engine — every push in the system reads "GM resolves the knockback" —
      // so the Proving Ground's rickety gantry resolves it here: first solid hit
      // while it's up there and it goes over the rail (owner ask: knocking
      // enemies out of buildings).
      if (rec.perch && !rec.shoved && val < rec.last) {
        rec.shoved = true;
        (async () => {
          const r = await stage.shoveOffPerch?.(sim.scene, rec.tokenId, rec.actorId);
          if (r?.ok) await ctx.speak?.(`The gantry rail gives — ${rec.name} goes over the side and lands hard (${r.damage} impact). Height is a weapon, One. Use it on them before they use it on you.`);
        })().catch(e => console.warn(TAG, "perch shove failed", e));
      }
      rec.last = val;

      if (val <= 0) { resolveFoe(rec, "killed").catch(e => console.warn(TAG, "resolve(killed) failed", e)); return; }

      // Owner ruling 2026-08-22: both tracks count — Stress 0 = knocked out,
      // Integrity 0 = killed. A stress-out sentient is a save (out cold, not
      // dead); a stress-out husk just unspools. Psychic offense wins fights
      // the old integrity-only watcher couldn't see.
      const _ssys = actor?.system?.system ?? actor?.system;
      const _stress = Number(foundry.utils.getProperty(_ssys, "derived.stress.value"));
      const _stressMax = Number(foundry.utils.getProperty(_ssys, "derived.stress.max")) || 0;
      if (!rec.isRig && _stressMax > 0 && Number.isFinite(_stress) && _stress <= 0) {
        resolveFoe(rec, rec.foeClass === "sentient" ? "saved" : "killed")
          .catch(e => console.warn(TAG, "resolve(stress-out) failed", e));
        return;
      }

      // Sentients fold once they're clearly losing — on EITHER track. Floor of
      // 2 so a tiny-track foe still gets a window instead of jumping straight
      // from full to dead.
      const _losing = (rec.max > 0 && val <= Math.max(2, Math.ceil(rec.max * 0.4)))
        || (_stressMax > 0 && Number.isFinite(_stress) && _stress <= Math.max(2, Math.ceil(_stressMax * 0.4)));
      if (rec.foeClass === "sentient" && _losing) {
        resolveFoe(rec, "saved").catch(e => console.warn(TAG, "resolve(saved) failed", e));
      }
    };

    // Rig-typed foes announce their own death through the system's cascade —
    // the same hook the driving beat's wrecks fire.
    const onRigDestroyed = ({ rig } = {}) => {
      const rec = sim.records.get(rig?.id);
      if (rec) resolveFoe(rec, "killed").catch(e => console.warn(TAG, "resolve(rig) failed", e));
    };

    // Someone deleted the token instead of fighting it — retire it so the wave can
    // still clear, but score it as neither a save nor a kill: the player didn't
    // earn either number.
    const onDelTok = (tokenDoc) => {
      const rec = sim.records.get(tokenDoc?.actorId);
      if (rec) resolveFoe(rec, "gone").catch(() => {});
    };

    Hooks.on("updateActor", onUpd);
    Hooks.on("bbttcc:rig:destroyed", onRigDestroyed);
    Hooks.on("deleteToken", onDelTok);

    // First wave.
    advance().catch(e => console.warn(TAG, "combat sim failed to start", e));

    // Escape hatch — never trap the player in the simulator.
    ctx.prompt({
      title: FALLBACK_TITLE,
      content:
        `<p><b>Qliphothic</b> foes — kill them. <b>Sentient</b> foes — take them low and they surrender; killing them instead is allowed and adds <b>Darkness</b>.</p>` +
        `<p>Mind damage types (the hollow ones shrug off kinetic), use height, and board your rig for the last wave.</p>` +
        `<p><i>Stuck, or the simulation won't cooperate? End it and move on.</i></p>`,
      label: "End the simulation"
    }).then(() => finish());

    return () => {
      Hooks.off("updateActor", onUpd);
      Hooks.off("bbttcc:rig:destroyed", onRigDestroyed);
      Hooks.off("deleteToken", onDelTok);
      closeFallback();
    };
  },

  exit: async (ctx) => {
    const t = ctx._sim?.tally || { husksDown: 0, saved: 0, killed: 0, rigsWrecked: 0, darkness: 0 };
    await ctx.speak(`Simulation closed. ${t.husksDown} hollow put down, ${t.rigsWrecked} vehicle${t.rigsWrecked === 1 ? "" : "s"} wrecked, ${t.saved} spared, ${t.killed} killed.`);
    await _pause(800);
    if (t.killed > 0 && t.saved > 0) {
      await ctx.speak(`You saved some and you didn't save others. That's the honest answer most Stewards give, and Darkness sits at ${t.darkness > 0 ? `+${t.darkness}` : "unchanged"} because of it. Carry it and keep going.`);
    } else if (t.killed > 0) {
      await ctx.speak("Clean, fast, and nobody walked away. It works. It always works. Ask yourself in ten turns whether it was still worth what it cost.");
    } else if (t.saved > 0) {
      await ctx.speak("Everyone who could be spared was spared. Harder than killing, every single time. Darkness track's clean — I noticed, and so will other things.");
    } else {
      await ctx.speak("Field's clear. Whatever else the Bad Eden takes from you, it won't be by surprise now.");
    }

    // Sever any boarding FIRST (un-hides the Steward's tokens everywhere), THEN
    // remove the tutorial tokens — same ordering the driving beat needs.
    try { await _stage()?.disembark?.(ctx.steward?.id, ctx.rig?.id); } catch (_) {}
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._sim = null;
  }
};

/* ═══════════════════ THE PROVING GROUND — TRIALS & SHOWDOWN ═══════════════════
 * Owner's design 2026-08-17, on the new Proving Ground art. The whole block is
 * framed as an EMERGENCY: something is trying to crash the game, and the only
 * tools to hand are the onboarding mechanics the player just learned. The
 * Operator — a daemon who lives inside that game — is exactly the right voice
 * for it, and the tutorial's seams stop being seams and become the fiction.
 *
 *   proving_trials   four sigil-marked hazards, one relic each. One of them is
 *                    underwater: a real dive to the reef scene and back.
 *   final_showdown   the great circle is SEALED until all four relics are in
 *                    hand; then a fight that a messenger interrupts, carrying
 *                    two Courtly Secrets and an offer to stop.
 *
 * Kept deliberately in the same idiom as the rest of beats.js: every gate has an
 * untrappable escape, every spawn is flagged for teardown, and nothing here
 * touches the live world.
 */

// ⚠ POSITIONS are read off the FINAL baked 4400×3900 v2 art (frame-checked
// 2026-08-24) and expressed as fractions of the VISIBLE scene rect, so they
// survive padding. One table — nudging a site is one line.
const PG_TRIALS = [
  {
    key: "lava", name: "The Cinder Sigil", relic: "Cinder Key",
    img: "icons/svg/fire.svg", xFrac: 0.51, yFrac: 0.43,
    approach: "The lava sigil — the burning one, centre of the map. It will cook you while you work.",
    // Hazard fires ON pickup: reaching in costs you something.
    hazard: { formula: "2d6", type: "thermal", flavor: "hot",
              line: "The sigil takes its toll — {n} thermal. Relics are never free." },
    taken: "Cinder Key — still glowing."
  },
  {
    key: "healing", name: "The Still Water", relic: "Still Draught",
    img: "icons/svg/heal.svg", xFrac: 0.78, yFrac: 0.39,
    approach: "The pale pond north-east. That one's healing water — the only kind thing on this map, and it still wants paying attention to.",
    heal: { formula: "2d6", line: "The water closes over the burn — +{n} Integrity. Take it; you'll want it later." },
    taken: "Still Draught — bottled."
  },
  {
    key: "grove", name: "The Green Circle", relic: "Verdant Mark",
    img: "icons/svg/oak.svg", xFrac: 0.13, yFrac: 0.56,
    approach: "West edge, the green ring. Whatever's growing in there is growing WRONG, and it has been waiting.",
    hazard: { formula: "1d6", type: "poison", flavor: "",
              line: "The ring exhales — {n} poison. It doesn't like being read." },
    taken: "Verdant Mark — warm, and faintly moving."
  },
  {
    key: "reef", name: "The Deep", relic: "Reef Shard",
    // Marker sits at the pool's CENTRE (on the painted merkaba sigil); the
    // trigger radius reaches past the bank, so the offer fires as the token
    // hits the water's EDGE — the player is never auto-plunged.
    img: "icons/svg/water.svg", xFrac: 0.36, yFrac: 0.79, dive: true,
    triggerSquares: 3.5,   // pool is ~2.5 squares radius on the v2 art, +1 of bank
    approach: "And the dark water, south-west. That one isn't a puddle — it goes DOWN. The last relic is on the reef floor, and you'll have to swim for it.",
    taken: "Reef Shard — cold enough to ache."
  }
];

// Where the reef relic sits on the dive scene, and where the great circle sits
// on the surface. Same fraction convention.
/** The scene's dive level, if it has one. Foundry v14 scenes carry `levels[]`,
 *  each with its own background and an elevation band; the Proving Ground pairs
 *  "Proving Ground" (0→40) with "Reefer Dive" (−20→0). Any level whose band
 *  goes below zero is the water. Returns { id, name, depth } — depth being the
 *  middle of the band, so the swimmer sits in open water rather than clipping
 *  the floor or the surface. */
function _pgDiveLevel(scene) {
  // `scene.levels` may be a plain array OR an iterable collection depending on
  // build — Array.isArray alone rejected the collection form and sent live
  // playtests down the "no water layer" fallback while the dive band existed.
  const raw = scene?.levels;
  const levels = Array.isArray(raw) ? raw
    : (raw && typeof raw[Symbol.iterator] === "function") ? Array.from(raw)
    : [];
  // Elevation band may sit nested (`l.elevation.bottom`) or flat (`l.bottom`).
  const band = (l) => {
    const e = (l?.elevation && typeof l.elevation === "object") ? l.elevation : l ?? {};
    return { bottom: Number(e.bottom), top: Number(e.top) };
  };
  const below = levels.filter(l => band(l).bottom < 0);
  if (!below.length) return null;
  // Deepest band wins if a scene ever stacks more than one.
  below.sort((a, b) => band(a).bottom - band(b).bottom);
  const l = below[0];
  const bottom = band(l).bottom || 0;
  const top    = band(l).top || 0;
  return { id: l._id ?? l.id, name: l.name || "the deep", depth: Math.round((bottom + top) / 2) || bottom };
}

// Read off the reef art in-world (2026-08-17): you descend into open rock at
// the upper left, then have to swim the width of the reef — past the wreck, the
// anemone-things and that pink horror by the shack — to reach the shard sitting
// in the magenta coral at the centre. The swim IS the encounter; nothing down
// there needs to be spawned.
const PG_REEF_ENTRY = { xFrac: 0.28, yFrac: 0.27 };
const PG_REEF_RELIC = { xFrac: 0.53, yFrac: 0.57 };
const PG_ARENA      = { xFrac: 0.735, yFrac: 0.80 };
const PG_CIRCLE_RADIUS_FRAC = 0.175;   // painted ring radius, as a fraction of scene width
const PG_PICKUP_SQUARES = 1.5;   // how close counts as "reached"

/** Centre of a token document in canvas pixels. */
function _pgTokenCentre(doc, scene) {
  const g = Number(scene?.grid?.size) || 100;
  return { x: Number(doc.x) + (Number(doc.width) || 1) * g / 2,
           y: Number(doc.y) + (Number(doc.height) || 1) * g / 2 };
}

/** Has the Steward's token reached this point? Proximity rather than a native
 *  Region: a Region's behavior schema is version-specific and can't be verified
 *  from the repo, and this is testable here. Swapping in a Region trigger later
 *  is a drop-in — the rest of the beat only cares that `arrive()` fires. */
function _pgReached(doc, scene, pt, squares = PG_PICKUP_SQUARES) {
  const g = Number(scene?.grid?.size) || 100;
  const c = _pgTokenCentre(doc, scene);
  return Math.hypot(c.x - pt.x, c.y - pt.y) <= g * squares;
}

/** Relics live on the Steward as a flag set — survives a reload, and the
 *  showdown beat reads it to decide whether the circle opens. */
function _pgRelics(steward) {
  const held = steward?.getFlag?.(MODULE_ID, "provingRelics");
  return Array.isArray(held) ? held : [];
}
// The relics as REAL inventory — the trials pay in items, not just a flag set
// (owner playtest 2026-08-22: "Still Draught foreshadowed as usable, nothing in
// inventory"). The Draught is genuinely drinkable: an RFI consumable whose
// consume spec heals 2d6 Integrity once, then the bottle deletes itself — the
// system's own sheet Use action drives the whole thing. The rest are keepsakes.
const PG_RELIC_ITEMS = {
  lava: {
    name: "Cinder Key", img: "icons/svg/fire.svg",
    desc: "<p>A key of fused slag, still warm no matter how long it sits in a pocket. It anchored the Proving Ground's lava sigil, and it remembers being load-bearing.</p><p><i>What it opens has not been built yet.</i></p>"
  },
  healing: {
    name: "Still Draught", img: "icons/svg/heal.svg",
    desc: "<p>A stoppered measure of the pale pond, bottled mid-kindness. One swallow closes wounds — <b>2d6 Integrity</b>, once.</p><p><i>The bottle refuses to be refilled.</i></p>",
    consume: { effects: [{ kind: "track", track: "integrity", op: "add", formula: "2d6" }], decrement: true }
  },
  grove: {
    name: "Verdant Mark", img: "icons/svg/oak.svg",
    desc: "<p>A ring of living green that grew wrong on purpose. It is warm, faintly moving, and pretends not to notice being watched.</p><p><i>Whatever is growing in there has been waiting a long time.</i></p>"
  },
  reef: {
    name: "Reef Shard", img: "icons/svg/water.svg",
    desc: "<p>A splinter of magenta coral from the reef below the Proving Ground, cold enough to ache through cloth.</p><p><i>Held to the ear it does not sound like the sea. It sounds like the tide going out.</i></p>"
  }
};

/** Mint the relic as a real gear Item on the Steward. Idempotent by relicKey
 *  flag; the player OWNS their steward (ensureOwned), so this runs client-side.
 *  Never fatal — the flag set stays the showdown's source of truth. */
async function _pgMintRelicItem(steward, key) {
  const spec = PG_RELIC_ITEMS[key];
  if (!spec || !steward?.createEmbeddedDocuments) return null;
  try {
    const has = steward.items?.find?.(i => i.getFlag?.(MODULE_ID, "relicKey") === key);
    if (has) return has;
    const data = {
      name: spec.name, type: "gear", img: spec.img,
      system: { quantity: 1, category: "relic", tags: ["relic", "proving-ground"],
                source: "The Proving Ground — Trials", description: { value: spec.desc, chat: "" } },
      flags: { [MODULE_ID]: { spawned: true, relicKey: key } }
    };
    if (spec.consume) {
      data.flags.fourththing = { rfi: { item: { frame: "consumable", charges: 1, consume: spec.consume } } };
    }
    const [it] = await steward.createEmbeddedDocuments("Item", [data]);
    return it ?? null;
  } catch (e) { console.warn(TAG, "relic item mint failed:", key, e); return null; }
}

async function _pgTakeRelic(steward, key) {
  const held = new Set(_pgRelics(steward));
  if (held.has(key)) return [...held];
  held.add(key);
  const next = [...held];
  try { await steward.setFlag(MODULE_ID, "provingRelics", next); }
  catch (e) { console.warn(TAG, "relic flag write failed", e); }
  await _pgMintRelicItem(steward, key);
  return next;
}

/* ───────────────────────── PROVING TRIALS ───────────────────────── */
const provingTrials = {
  id: "proving_trials",
  title: "The Proving Ground — Trials",
  scope: "personal",

  enter: async (ctx) => {
    ctx._spawned = ctx._spawned || [];
    ctx._pg = { scene: null, markers: new Map(), diving: false, done: new Set() };

    // A Steward already holding all four relics (relics are replay-safe and
    // survive on a flag) gets ASKED, not silently no-opped: without this, a
    // replay spawns no markers, nothing can fire, and the run reads as broken
    // (owner hit exactly that 2026-08-24 after the 08-22 full playthroughs).
    if (_pgRelics(ctx.steward).length >= PG_TRIALS.length) {
      const again = await ctx.choose?.({
        title: "◇ OPERATOR — Trials",
        content:
          `<p><b>You've already pulled all four relics out of this floor once.</b> ` +
          `They're still in your pack, and held relics don't grow back on the map.</p>` +
          `<p>Run the trials again from a clean slate, or keep the set and move on?</p>`,
        options: [
          { action: "replay", label: "⟳ Run the trials again" },
          { action: "keep",   label: "Keep them — move on" }
        ],
        fallback: "keep"
      }) ?? "keep";
      if (again === "replay") {
        try { await ctx.steward.unsetFlag(MODULE_ID, "provingRelics"); }
        catch (e) { console.warn(TAG, "relic reset failed", e); }
        // A clean slate means clean pockets: reap the minted relic items too
        // (a drunk Still Draught is already gone — the filter just skips it).
        try {
          const relicItems = ctx.steward.items?.filter?.(i => i.getFlag?.(MODULE_ID, "relicKey")) ?? [];
          if (relicItems.length) await ctx.steward.deleteEmbeddedDocuments("Item", relicItems.map(i => i.id));
        } catch (e) { console.warn(TAG, "relic item reset failed", e); }
        await ctx.speak("Wiping the ledger. The floor grows its teeth back— *bzzt* —four sigils, four relics, same rules.");
      } else {
        ctx._pg.alreadyComplete = true;
        return;                               // skip the whole staging; detect() completes immediately
      }
    }

    // ── The emergency. Everything after this line is in-fiction panic.
    await ctx.speak("— *bzzt* — hold. Hold. Something just reached into the world model from OUTSIDE and started pulling.");
    await _pause(1100);
    await ctx.speak("Someone is trying to CRASH the game, One. Not your character — the game. And you are the only thing in here with hands and a tutorial's worth of privileges.");
    await _pause(1100);
    await ctx.speak("Four sigils are holding the Proving Ground together. Whatever's chewing on us is prying them loose one at a time. Get to each one, take what's anchoring it, and bring all four to the great circle before the floor stops being a floor.");
    await _pause(900);

    // Ownership repair. Normally outfitting does this, but the playtest
    // selectors make THIS beat a legitimate entry point — and a player without
    // OWNER on their own steward/faction/rig can't take a hazard hit, can't be
    // moved between levels, and can't be handed a relic. Idempotent, so it
    // costs nothing on a full run.
    try { await _stage()?.ensureOwned?.([ctx.faction?.id, ctx.rig?.id, ctx.steward?.id], ctx.user?.id); }
    catch (e) { console.warn(TAG, "trials ownership repair failed", e); }

    const scene = await _requireScene(ctx, "meatsuit-range", "Proving Ground");
    ctx._pg.scene = scene;
    if (scene) { await _enterScene(scene, "Proving Ground", ctx.lane); await _pause(800); }

    // Shared stage: reap stale scaffolding before the sigils go down — a
    // leftover "The Deep" marker from an old run would double the dive.
    try { if (scene) await _stage()?.sweepScene?.(scene); } catch (_) {}

    const stage = _stage();
    if (scene && stage) {
      // The Steward needs to be ON the map to walk it.
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, _scenePoint(scene, 0.30, 0.66, ctx.lane));
      if (st?.created) ctx._spawned.push({ token: st.doc });
      if (ctx.rig) {
        const rt = await stage.ensureTokenOnScene(ctx.rig, scene, _scenePoint(scene, 0.22, 0.72, ctx.lane));
        if (rt?.created) ctx._spawned.push({ token: rt.doc });
      }
      // One marker per un-taken trial. Replay-safe: a relic already held is
      // skipped, so a resumed run doesn't re-litter the map.
      const held = new Set(_pgRelics(ctx.steward));
      for (const t of PG_TRIALS) {
        if (held.has(t.key)) { ctx._pg.done.add(t.key); continue; }
        const pt = _scenePoint(scene, t.xFrac, t.yFrac, ctx.lane);
        const sp = await stage.spawnMarker?.(scene, { name: t.name, img: t.img, ...pt });
        if (sp) { ctx._spawned.push(sp); ctx._pg.markers.set(t.key, { ...t, pt, tokenId: sp.token?.id ?? null, actorId: sp.actor?.id ?? null }); }
      }
    }

    await _pause(500);
    for (const t of PG_TRIALS) {
      if (ctx._pg.done.has(t.key)) continue;
      await ctx.speak(t.approach);
      await _pause(700);
    }
    await ctx.speak("Walk onto a sigil to take its relic. Move your token — this is the map, not a menu.");
    ctx.riff({ beat: "proving_trials", line: "The game itself is under attack and the player is racing to collect four anchoring relics.", intent: "Genuine alarm under the usual dryness. One line." });
  },

  detect: (ctx, done) => {
    const sim = ctx._pg;
    const stage = _stage();
    const FALLBACK_TITLE = "◇ OPERATOR — Trials";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);

    // Kept-relics replay: the player chose to keep the finished set in enter().
    // Complete on the spot — BEFORE the no-scene guard (nothing was staged).
    if (sim?.alreadyComplete) { done(); return () => {}; }

    if (!sim?.scene || !stage) {
      ctx.prompt({ title: FALLBACK_TITLE,
        content: "<p>The Proving Ground isn't available — no arena, or no GM online to stage it.</p><p>Continue; you can replay this later.</p>",
        label: "Continue" }).then(() => done());
      return closeFallback;
    }

    const finish = () => { if (!sim.finished) { sim.finished = true; done(); } };

    /** Take one relic: hazard or boon, flag it, clear the marker, count up. */
    const claim = async (t) => {
      if (sim.done.has(t.key)) return;
      sim.done.add(t.key);
      const marker = sim.markers.get(t.key);
      sim.markers.delete(t.key);

      if (t.hazard) {
        const r = await stage.hurt?.(ctx.steward?.id, t.hazard);
        await ctx.speak?.(t.hazard.line.replace("{n}", String(r?.amount ?? "some")));
      } else if (t.heal) {
        const r = await stage.mend?.(ctx.steward?.id, t.heal.formula);
        await ctx.speak?.(t.heal.line.replace("{n}", String(r?.amount ?? "some")));
      }
      const held = await _pgTakeRelic(ctx.steward, t.key);
      // The tally is spoken from the LIVE count, not baked into the trial —
      // there's no forced order, so any sigil can be first or fourth.
      const n = held.length;
      const COUNT = ["One", "Two", "Three", "Four"];
      const tally = n >= PG_TRIALS.length ? `${COUNT[n - 1] ?? n}. That's the set.` : `${COUNT[n - 1] ?? n}.`;
      await ctx.speak?.(`${t.taken} ${tally}`);
      if (t.key === "healing") {
        await _pause(500);
        await ctx.speak?.("And it's in your PACK now, One — a real bottle. One swallow, 2d6 Integrity, whenever the moment comes. I told you you'd want it later.");
      }
      try { await stage.cleanup?.([marker].filter(Boolean)); } catch (_) {}

      if (held.length >= PG_TRIALS.length) {
        await _pause(700);
        await ctx.speak?.("All four. The floor stops arguing with itself— *bzzt* —and the great circle in the south-east just went LIVE. Get in it.");
        finish();
      }
    };

    /** Reaching the water's edge OFFERS the dive rather than plunging the
     *  token — hitting the bank while lining up a different sigil shouldn't
     *  drop you twenty feet. Declining re-arms once the token leaves the
     *  pool's trigger ring, so walking back to the edge asks again. */
    const offerDive = async (t) => {
      if (sim.diving || sim.done.has(t.key) || sim.diveOfferOpen || sim.diveDeclined) return;
      sim.diveOfferOpen = true;
      try {
        const picked = await ctx.choose?.({
          title: "◇ OPERATOR — The Deep",
          content:
            `<p><b>You're at the water's edge.</b> The last relic is down on the reef floor — ` +
            `the level below this one, and the way back up is the way you came in.</p>` +
            `<p>Ready to go under?</p>`,
          options: [
            { action: "dive", label: "🤿 Dive" },
            { action: "stay", label: "Not yet" }
          ],
          fallback: "stay"
        }) ?? "stay";
        if (picked === "dive") { await dive(t); return; }
        sim.diveDeclined = true;
        await ctx.speak?.("Fair. The water isn't going anywhere — come back to the edge when you're ready and I'll ask again.");
      } catch (e) {
        console.warn(TAG, "dive offer failed", e);
      } finally {
        sim.diveOfferOpen = false;
      }
    };

    /** The dive: down to the reef, grab the shard, back up. */
    const dive = async (t) => {
      if (sim.diving || sim.done.has(t.key)) return;
      sim.diving = true;
      try {
        // PREFERRED: a native dive LEVEL on this very scene. Diving is then just
        // the token's elevation — no scene change, no loading seam, and exactly
        // the "vertical via token.document.elevation" doctrine.
        const lvl = _pgDiveLevel(sim.scene);
        if (lvl) {
          await ctx.speak?.("Down you go. Hold your breath — the system will tell you when that stops being a metaphor.");
          // v14: pass the LEVEL id with the elevation — elevation alone leaves
          // the token on the ground floor, ten feet under its own scenery.
          const moved = await stage.setElevation?.(sim.scene, ctx.steward?.id, lvl.depth, lvl.id);
          if (!moved?.ok) {
            console.warn(TAG, "dive: elevation write failed; handing the relic over");
            sim.diving = false;                       // hand-over path: keep the other sigils live
            await claim(t);
            return;
          }
          // Follow the token down. Which level the canvas RENDERS is per-client
          // state, and this beat runs on the diver's own client — so switch it
          // here, the same way core's changeLevel region behavior does.
          try {
            if (sim.scene.isView && globalThis.canvas?.level?.id !== lvl.id) {
              await sim.scene.view({ level: lvl.id, controlledTokens: moved.tokenIds ?? [] });
            }
          } catch (e) { console.warn(TAG, "dive: level view switch failed (token IS on the dive level)", e); }
          await _pause(900);
          const pt = _scenePoint(sim.scene, PG_REEF_RELIC.xFrac, PG_REEF_RELIC.yFrac, ctx.lane);
          const shard = await stage.spawnMarker?.(sim.scene, { name: t.name, img: t.img, elevation: lvl.depth, levelId: lvl.id, ...pt });
          if (shard) ctx._spawned.push(shard);
          await ctx.speak?.(`${lvl.name} — ${Math.abs(lvl.depth)} feet down. The shard is out in the magenta coral, dead centre. Between you and it: a wreck, a lot of legs, and something pink I'd rather not name. Swim.`);
          // Surface height = where they were, clamped into the origin level's
          // band: a token hand-nudged below its own floor (e.g. a manual −10 on
          // the ground level) must not be "restored" to that nonsense height.
          let surfaceAt = Number(moved.from) || 0;
          try {
            const raw = sim.scene?.levels;
            const arr = Array.isArray(raw) ? raw
              : (raw && typeof raw[Symbol.iterator] === "function") ? Array.from(raw) : [];
            const gl = arr.find(l => (l._id ?? l.id) === moved.fromLevel);
            const e = (gl?.elevation && typeof gl.elevation === "object") ? gl.elevation : {};
            if (Number.isFinite(Number(e.bottom)) && Number.isFinite(Number(e.top))) {
              surfaceAt = Math.min(Math.max(surfaceAt, Number(e.bottom)), Number(e.top));
            }
          } catch (_) {}
          sim.reef = { scene: sim.scene, pt, marker: shard, trial: t, surfaceAt, surfaceLevel: moved.fromLevel ?? null };
          return;
        }

        // FALLBACK: a separate scene wired to the "reef" key.
        const reef = ctx.scene("reef");
        if (!reef) {
          // Neither a dive level nor a reef scene — never strand a relic behind
          // missing art; hand it over and tell the GM exactly what to fix.
          await ctx.speak?.("There's no water layer on this map— *bzzt* —so I'm handing you the shard from the surface. Tell your GM: either add a dive LEVEL with a negative elevation band, or stamp a separate reef scene.");
          console.warn(TAG, 'dive unavailable: no scene level with elevation.bottom < 0, and no "reef" tutorial scene. Add a level, or wireScene("reef", <scene>).');
          sim.diving = false;                         // hand-over path: keep the other sigils live
          await claim(t);
          return;
        }
        await ctx.speak?.("Down you go. Hold your breath — the system will tell you when that stops being a metaphor.");
        await _enterScene(reef, "The Reef", ctx.lane);
        await _pause(900);
        const st = await stage.ensureTokenOnScene(ctx.steward, reef, _scenePoint(reef, PG_REEF_ENTRY.xFrac, PG_REEF_ENTRY.yFrac, ctx.lane));
        if (st?.created) ctx._spawned.push({ token: st.doc });
        const pt = _scenePoint(reef, PG_REEF_RELIC.xFrac, PG_REEF_RELIC.yFrac, ctx.lane);
        const shard = await stage.spawnMarker?.(reef, { name: t.name, img: t.img, ...pt });
        if (shard) ctx._spawned.push(shard);
        await ctx.speak?.("Reef floor. You're in open rock at the shallow end — the shard is out in the magenta coral, dead centre. Swim.");
        sim.reef = { scene: reef, pt, marker: shard, trial: t, surfaceAt: null };
      } catch (e) {
        console.warn(TAG, "dive failed", e);
        sim.diving = false;
      }
    };

    /** Surface again once the shard is in hand. */
    const surface = async () => {
      const r = sim.reef;
      if (!r) return;
      sim.reef = null;
      try { await stage.cleanup?.([r.marker].filter(Boolean)); } catch (_) {}
      await ctx.speak?.("Got it. Up — kick for the light.");
      if (r.surfaceAt === null) {
        await _enterScene(sim.scene, "Proving Ground", ctx.lane);   // separate-scene path
      } else {
        const back = await stage.setElevation?.(sim.scene, ctx.steward?.id, r.surfaceAt, r.surfaceLevel ?? "");
        try {
          if (sim.scene.isView && r.surfaceLevel && globalThis.canvas?.level?.id !== r.surfaceLevel) {
            await sim.scene.view({ level: r.surfaceLevel, controlledTokens: back?.tokenIds ?? [] });
          }
        } catch (e) { console.warn(TAG, "surface: level view switch failed", e); }
      }
      await _pause(800);
      sim.diving = false;
      await claim(r.trial);
    };

    // One listener for the whole map: the Steward moving is the only input.
    const onMove = (tokenDoc) => {
      if (sim.finished) return;
      if (tokenDoc?.actorId !== ctx.steward?.id) return;

      // Underwater leg first — different scene, different target.
      if (sim.reef && tokenDoc.parent?.id === sim.reef.scene.id) {
        if (_pgReached(tokenDoc, sim.reef.scene, sim.reef.pt)) {
          surface().catch(e => console.warn(TAG, "surface failed", e));
        }
        return;
      }
      if (sim.diving) return;                       // mid-transition; ignore
      if (tokenDoc.parent?.id !== sim.scene.id) return;

      for (const t of [...sim.markers.values()]) {
        const near = _pgReached(tokenDoc, sim.scene, t.pt, t.triggerSquares ?? PG_PICKUP_SQUARES);
        if (t.dive && !near) { sim.diveDeclined = false; continue; }  // left the edge — re-arm the offer
        if (!near) continue;
        (t.dive ? offerDive(t) : claim(t)).catch(e => console.warn(TAG, "trial claim failed", e));
        break;                                       // one sigil per step
      }
    };
    Hooks.on("updateToken", onMove);

    // The skip hatch GRANTS every remaining relic, so it must never fire off a
    // DISMISSED window (owner closed a stale-looking dialog 2026-08-24 and the
    // old handler silently completed the whole beat onto his Steward): the
    // button now leads to an explicit confirm, any close or decline re-arms
    // quietly after a pause, and only "yes" grants.
    let skipTimer = null;
    let disposed = false;
    const offerSkip = () => {
      if (disposed || sim.finished) return;
      ctx.prompt({
        title: FALLBACK_TITLE,
        content:
          `<p><b>Walk your Steward's token onto each of the four sigils.</b> Lava (centre), still water (north-east), the green ring (west), and the deep water (south-west — that one's a dive).</p>` +
          `<p>Each relic costs you something on the way in. Collect all four and the great circle opens.</p>` +
          `<p><i>Stuck, or a sigil won't answer? Skip ahead — I'll hand you the rest.</i></p>`,
        label: "Skip the trials"
      }).then(async (r) => {
        if (disposed || sim.finished) return;
        if (r === "ok") {
          const sure = await ctx.choose?.({
            title: FALLBACK_TITLE,
            content:
              `<p><b>Skip the rest of the trials?</b> I'll hand you every relic still on the floor, ` +
              `and the great circle opens as if you'd earned them.</p>`,
            options: [
              { action: "skip", label: "Yes — hand them over" },
              { action: "play", label: "No — keep playing" }
            ],
            fallback: "play"
          }) ?? "play";
          if (sure === "skip" && !disposed && !sim.finished) {
            // Never trap them behind a hazard that won't fire — grant the remainder.
            for (const t of PG_TRIALS) if (!sim.done.has(t.key)) await _pgTakeRelic(ctx.steward, t.key);
            finish();
            return;
          }
        }
        // Dismissed or declined — keep the escape hatch alive without nagging.
        skipTimer = setTimeout(offerSkip, 15000);
      });
    };
    offerSkip();

    return () => { disposed = true; if (skipTimer) clearTimeout(skipTimer); Hooks.off("updateToken", onMove); closeFallback(); };
  },

  exit: async (ctx) => {
    const n = _pgRelics(ctx.steward).length;
    await ctx.speak(`${n} of ${PG_TRIALS.length} anchors in hand. The pull's still there — I can feel it in the tick rate — but the ground will hold long enough for what comes next.`);
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._pg = null;
  }
};

/* ───────────────────────── FINAL SHOWDOWN ───────────────────────── */
// The great circle. A real fight that a MESSENGER interrupts: the thing pulling
// at the game would rather negotiate than be unmade, and it says so in the only
// register the court understands — two Courtly Secrets, handed over.
//
// The two secrets are minted in-memory (`new Item(...)`) and handed to
// addSecret with an explicit effectKey, so this needs no compendium authoring.
// They are real, playable secrets the moment the Courtly scenario opens.
const PG_PARLEY_SECRETS = [
  {
    name: "\"We're Screwed\"",
    effectKey: "oppRollMinus2",
    text: "<p>An unencrypted panic burst, sent to everyone at once and clearly not meant for you. Whatever is on the other end has done the arithmetic and does not like it.</p>"
        + "<p><em>Play in a Courtly scenario: the opposition rolls at −2. They know you have read it.</em></p>"
  },
  {
    name: "\"Please Totally Don't Murder Us, We Give Up For Reals\"",
    effectKey: "favorPlus2+influenceDmg2",
    text: "<p>A formal capitulation, composed at speed by something with no idea how a formal capitulation is composed. It is signed. Repeatedly.</p>"
        + "<p><em>Play in a Courtly scenario: +2 Favor and 2 Influence damage. A surrender entered into the record is worth more than a surrender shouted.</em></p>"
  }
];

// 🔒 Owner ruling 2026-08-17: the courtly raid has ALREADY happened by now (this
// block sits after raid_presence), so this is that lesson in practice. Once the
// circle opens the player picks their way in — STORM or SLIP — and both roads
// end at the same parley. Violence and intrigue are two of the three real
// activityKeys; presence is what they resolve into.
const PG_APPROACHES = {
  violence: {
    label: "⚔ Storm the gates",
    activityKey: "violence",
    brief: "Front door, then. No subtlety, no second guessing — you walk in loud and let them come to you.",
    coach: "Everything in the circle knows you're here and gets to act. More of them, and they're awake. Lead with the guns and let the rig take the hits.",
    // Loud means MORE of them, all alert.
    foes: [
      { name: "Null Process", foeClass: "qliphothic", body: 4, xFrac: 0.63, yFrac: 0.73, resistances: ["kinetic"], vulnerabilities: ["sephirotic"] },
      { name: "Null Process", foeClass: "qliphothic", body: 4, xFrac: 0.73, yFrac: 0.74, resistances: ["kinetic"], vulnerabilities: ["sephirotic"] },
      { name: "Null Process", foeClass: "qliphothic", body: 4, xFrac: 0.60, yFrac: 0.86, resistances: ["kinetic"], vulnerabilities: ["sephirotic"] },
      { name: "The Pull",     foeClass: "qliphothic", body: 8, size: 2, xFrac: 0.68, yFrac: 0.85, resistances: ["kinetic", "qliphothic"], vulnerabilities: ["sephirotic"] }
    ]
  },
  intrigue: {
    label: "🗡 Slip inside",
    activityKey: "intrigue",
    brief: "Quietly, then. You come in under the noise it's making and it doesn't hear the door.",
    coach: "Fewer of them, and they start SURPRISED — they cannot act on the first round. That round is a gift; spend it on the big one, not the small ones.",
    // Quiet means fewer, and the system's own surprise rule buys the free round.
    foes: [
      { name: "Null Process", foeClass: "qliphothic", body: 4, xFrac: 0.63, yFrac: 0.73, resistances: ["kinetic"], vulnerabilities: ["sephirotic"], conditions: ["surprise"] },
      { name: "The Pull",     foeClass: "qliphothic", body: 8, size: 2, xFrac: 0.68, yFrac: 0.85, resistances: ["kinetic", "qliphothic"], vulnerabilities: ["sephirotic"], conditions: ["surprise"] }
    ]
  }
};

const finalShowdown = {
  id: "final_showdown",
  title: "The Final Show Down",
  scope: "personal",

  enter: async (ctx) => {
    ctx._spawned = ctx._spawned || [];
    ctx._fs = { scene: null, foes: new Map(), parleyed: false, resolved: false, downed: 0 };

    try { await _stage()?.ensureOwned?.([ctx.faction?.id, ctx.rig?.id, ctx.steward?.id], ctx.user?.id); }
    catch (e) { console.warn(TAG, "showdown ownership repair failed", e); }

    const held = _pgRelics(ctx.steward);
    const scene = await _requireScene(ctx, "meatsuit-range", "Proving Ground");
    ctx._fs.scene = scene;

    // Shared stage: the circle deserves a clean floor — reap anything a prior
    // run (or the trials, if they crashed mid-beat) left standing.
    try { if (scene) await _stage()?.sweepScene?.(scene); } catch (_) {}

    if (held.length < PG_TRIALS.length) {
      // Sealed. The owner's ruling: all four or the circle stays inert.
      await ctx.speak(`The great circle won't take you — ${held.length} of ${PG_TRIALS.length} anchors. It isn't being coy, One, it's being LOAD-BEARING. Go back for the rest.`);
      return;
    }

    if (scene) { await _enterScene(scene, "Proving Ground", ctx.lane); await _pause(700); }
    await ctx.speak("Four anchors, one circle. Step in and it closes behind you — that's the point of a circle.");
    await _pause(900);
    await ctx.speak("Whatever's been pulling at us is going to have to come through in person to finish the job. Good. In person, it can be HIT. *bzzt*");
    await _pause(900);
    await ctx.speak("You've run all three consoles by now — violence, intrigue, presence. This is where you stop practising. How do you want to go in?");

    const picked = await ctx.choose?.({
      title: "◇ OPERATOR — How do we do this?",
      content:
        `<p>The circle is open and the thing on the other side doesn't know which door you're using.</p>` +
        `<p><b>⚔ Storm the gates</b> — everything inside is awake and there are more of them. Loud, fast, honest.</p>` +
        `<p><b>🗡 Slip inside</b> — fewer of them, and they start <b>Surprised</b>: they cannot act on the first round. Quiet, precise, and it costs them the opening.</p>` +
        `<p><i>Either way it ends at the same table.</i></p>`,
      options: [
        { action: "violence", label: PG_APPROACHES.violence.label },
        { action: "intrigue", label: PG_APPROACHES.intrigue.label }
      ],
      fallback: "violence"
    }) ?? "violence";
    const approach = PG_APPROACHES[picked] ?? PG_APPROACHES.violence;
    ctx._fs.approach = picked;
    await ctx.speak(approach.brief);
    await _pause(800);

    const stage = _stage();
    if (scene && stage) {
      // INSIDE the circle, both of them — move:true, because "step in and it
      // closes behind you" was silently a no-op for tokens already standing
      // elsewhere on the map from the trials (owner playtest 2026-08-22).
      const st = await stage.ensureTokenOnScene(ctx.steward, scene,
        { ..._scenePoint(scene, PG_ARENA.xFrac - 0.06, PG_ARENA.yFrac + 0.04, ctx.lane), move: true });
      if (st?.created) ctx._spawned.push({ token: st.doc });
      if (ctx.rig) {
        const rt = await stage.ensureTokenOnScene(ctx.rig, scene,
          { ..._scenePoint(scene, PG_ARENA.xFrac - 0.11, PG_ARENA.yFrac + 0.08, ctx.lane), move: true });
        if (rt?.created) ctx._spawned.push({ token: rt.doc });
      }
      for (const f of approach.foes) {
        const sp = await stage.spawnFoe?.(scene, {
          name: f.name, foeClass: f.foeClass, body: f.body, size: f.size ?? 1,
          resistances: f.resistances ?? [], vulnerabilities: f.vulnerabilities ?? [],
          conditions: f.conditions ?? [],
          ..._scenePoint(scene, f.xFrac, f.yFrac, ctx.lane)
        });
        if (!sp?.actor) continue;
        ctx._spawned.push(sp);
        ctx._fs.foes.set(sp.actor.id, { actorId: sp.actor.id, name: sp.actor.name, boss: (f.body ?? 0) >= 8, down: false });
      }

      // The promise kept: the circle CLOSES. A ring of movement-blocking,
      // sight-transparent wall segments on the painted circle — the parley
      // breaks it, and the beat's exit unseals no matter how this ends.
      const d = scene.dimensions ?? {};
      const centre = _scenePoint(scene, PG_ARENA.xFrac, PG_ARENA.yFrac, ctx.lane);
      const radius = Math.round((d.sceneWidth ?? scene.width ?? 4400) * PG_CIRCLE_RADIUS_FRAC);
      const sealed = await stage.sealCircle?.(scene, { cx: centre.x, cy: centre.y, radius });
      if (sealed?.ok) {
        ctx._fs.sealedScene = scene;
        await ctx.speak("And there it is — the circle just closed behind you. Told you it would. Nothing gets out— *bzzt* —which cuts both ways.");
        await _pause(700);
      }

      // Hand the GM a loaded tracker: combat staged with the steward and
      // every spawned foe, whispered handoff. GM rolls initiative and begins.
      try {
        await stage.beginShowdownCombat?.(scene,
          [ctx.steward?.id, ...ctx._fs.foes.keys()].filter(Boolean),
          { playerName: ctx.steward?.name || "" });
      } catch (e) { console.warn(TAG, "showdown combat staging failed", e); }
    }

    await ctx.speak(approach.coach);
    await _pause(700);
    await ctx.speak("The small ones were never people. The big one is the hand on the lever.");
    ctx.riff({ beat: "final_showdown", line: "The player has entered the sealed circle to fight the thing crashing the game.", intent: "All bravado, thinly worn. One line." });
  },

  detect: (ctx, done) => {
    const fs = ctx._fs;
    const stage = _stage();
    const FALLBACK_TITLE = "◇ OPERATOR — Final Show Down";
    const closeFallback = () => globalThis.game?.bbttcc?.onboarding?.ui?.closeDialogByTitle?.(FALLBACK_TITLE);

    if (!fs?.scene || !fs.foes.size) {
      ctx.prompt({ title: FALLBACK_TITLE,
        content: "<p>The circle isn't ready — missing arena, missing anchors, or no GM online to stage it.</p><p>Continue when you like.</p>",
        label: "Continue" }).then(() => done());
      return closeFallback;
    }

    const finish = () => { if (!fs.resolved) { fs.resolved = true; done(); } };

    /** The messenger. Fires once, the moment the fight visibly turns. */
    const parley = async () => {
      if (fs.parleyed) return;
      fs.parleyed = true;
      // The seal lets go for the messenger — the circle opening FROM THE OTHER
      // SIDE is the tell that whatever's out there wants in to talk, not fight.
      if (fs.sealedScene) {
        try { await stage.unsealCircle?.(fs.sealedScene); } catch (_) {}
        fs.sealedScene = null;
        await ctx.speak("— the circle just OPENED. Not from your side. *bzzt* Hold. Hold—");
        await _pause(800);
      }
      await ctx.speak("— wait. Something's coming in on a channel that shouldn't exist. It's not attacking. It's TALKING.");
      await _pause(1000);

      // A wired parley COURT upgrades the exchange: the world folds a formal
      // room around the surrender, and the tableau flag routes the presence
      // raid through the Courtly engine. Unwired → the parley happens right
      // there at the great circle, exactly as before.
      const court = ctx.scene("court-parley");
      if (court) {
        await ctx.speak("The channel reaches out and FOLDS — *bzzt* — a room that wasn't in the world model a second ago. A court. Whatever's talking wants this done formally.");
        await _enterScene(court, "The Parley", ctx.lane);
        const st = await stage.ensureTokenOnScene?.(ctx.steward, court, _scenePoint(court, 0.42, 0.74, ctx.lane));
        if (st?.created) ctx._spawned.push({ token: st.doc });
        await _pause(700);
      }
      const stageScene = court || fs.scene;
      let messenger = null;
      if (stageScene && stage) {
        messenger = await stage.spawnFoe?.(stageScene, {
          name: "A Messenger, Sent In Haste", foeClass: "sentient", body: 2,
          ...(court ? _scenePoint(court, 0.58, 0.56, ctx.lane)
                    : _scenePoint(stageScene, PG_ARENA.xFrac + 0.10, PG_ARENA.yFrac - 0.09, ctx.lane))
        });
        if (messenger) ctx._spawned.push(messenger);
      }
      await ctx.speak("It's a messenger. Unarmed, badly rendered, and carrying paperwork. *bzzt* — I did not have this on the list.");
      await _pause(900);

      // Hand over the two secrets. Minted in memory so no compendium authoring
      // is required; addSecret takes the effectKey from opts when the source
      // carries none, and stamps them EARNED (stolen would cost suspicion).
      const fid = ctx.faction?.id;
      const granted = [];
      for (const spec of PG_PARLEY_SECRETS) {
        const r = await stage.grantSecret?.(fid, spec);
        if (r?.ok) granted.push(r.name || spec.name);
      }
      if (granted.length) {
        await ctx.speak(`It hands you ${granted.length === 2 ? "two documents" : "a document"}: ${granted.join(" and ")}. Those are COURTLY SECRETS, One — real ones, in your faction's hand, playable the moment a parley opens.`);
      } else {
        await ctx.speak("It hands you its paperwork — though the court's filing system just refused it. Your GM can add the secrets by hand if it matters.");
        console.warn(TAG, "parley secrets not granted — courtlySecrets API unavailable or faction missing");
      }
      await _pause(1000);
      await ctx.speak("So here's the shape of it. You can finish what's in the circle — it's losing, and nobody would blame you. Or you can take the surrender, open the parley, and find out what was so frightened of this place that it tried to unmake it.");
      await _pause(700);
      const camePlain = ctx._fs?.approach === "intrigue" ? "You came in quiet, and it still saw you coming" : "You came in loud, and it heard every step";
      await ctx.speak(`${camePlain}. Either way it's talking now. Your GM runs the parley from the Raid Console — PRESENCE, not violence. I've pointed it at you.`);

      // Raids are GM-driven by design: pre-seed the session and open the GM's
      // console, exactly as the raid_presence finale beat does.
      try {
        if (fid) {
          await stage.setRaidSession?.(fid, {
            rev: Date.now(), ts: Date.now(), by: ctx.user?.id ?? "",
            attackerId: fid, supportFactionIds: [], activityKey: "presence",   // pivots off the approach below
            difficulty: "standard", targetType: "hex", targetUuid: "", targetName: "The Pull",
            defenderId: "", rounds: [], logWar: false, includeDefender: false
          });
          await stage.openRaidConsoleForGM?.(fid, { playerName: ctx.steward?.name || "", activityKey: "presence",
                                                   sceneId: court?.id ?? "" });
        }
      } catch (e) { console.warn(TAG, "parley handoff failed", e); }
    };

    // Owner ruling 2026-08-22: BOTH tracks count. Stress 0 = knocked out,
    // Integrity 0 = killed — easier to knock out than kill. The old
    // integrity-only watcher was blind to psychic (stress-track) victories:
    // Marginalia stress-killed The Pull and nothing triggered.
    const tracksOf = (a) => {
      const sys = a?.system?.system ?? a?.system;
      const rd = (p) => { const n = Number(foundry.utils.getProperty(sys, p)); return Number.isFinite(n) ? n : null; };
      return {
        integ: rd("derived.integrity.value"), integMax: rd("derived.integrity.max") ?? 0,
        stress: rd("derived.stress.value"),   stressMax: rd("derived.stress.max") ?? 0
      };
    };

    const onUpd = (actor) => {
      const rec = fs.foes.get(actor?.id);
      if (!rec || rec.down || fs.resolved) return;
      const t = tracksOf(actor);
      if (t.integ === null && t.stress === null) return;

      // The boss dropping below half — on either track — is the moment the
      // fight visibly turns; that's when the other side decides talking is
      // cheaper.
      const halfDown = (v, m) => v !== null && m > 0 && v <= m * 0.5;
      if (rec.boss && !fs.parleyed && (halfDown(t.integ, t.integMax) || halfDown(t.stress, t.stressMax))) {
        parley().catch(e => console.warn(TAG, "parley failed", e));
      }
      const killed = t.integ !== null && t.integ <= 0;
      const koed   = !killed && t.stress !== null && t.stressMax > 0 && t.stress <= 0;
      if (!killed && !koed) return;

      rec.down = true;
      fs.downed += 1;
      if (rec.boss) {
        ctx.speak?.(killed
          ? "The hand comes off the lever. The pull stops— *bzzt* —and the tick rate steadies. You killed it. That was one of the two ways this ends."
          : "The hand slides off the lever. The pull stops— *bzzt* —out cold, not dead. Same silence, cleaner hands. That counts.");
        finish();
      } else {
        ctx.speak?.(`${rec.name} unspools. It was never anyone.`);
        // Processes down but the boss untouched still counts as turning the fight.
        if (fs.downed >= 2 && !fs.parleyed) parley().catch(() => {});
      }
    };
    Hooks.on("updateActor", onUpd);

    ctx.prompt({
      title: FALLBACK_TITLE,
      content:
        `<p>Fight what's in the circle. When it starts losing, a <b>messenger</b> arrives with two <b>Courtly Secrets</b> and an offer.</p>` +
        `<p><b>Finish it</b> — kill the thing on the lever — or <b>take the parley</b>, which your GM runs from the Raid Console on <b>presence</b>.</p>` +
        `<p><i>Either ending is real. Conclude when the table has settled it.</i></p>`,
      label: "This is settled"
    }).then(() => finish());

    return () => { Hooks.off("updateActor", onUpd); closeFallback(); };
  },

  exit: async (ctx) => {
    const fs = ctx._fs || {};
    // Belt and braces: however the beat ended (kill, skip, crash), no wall
    // ring survives it — a sealed arena outliving its fight strands the token.
    try { if (fs.sealedScene) { await _stage()?.unsealCircle?.(fs.sealedScene); fs.sealedScene = null; } } catch (_) {}
    if (fs.parleyed) {
      await ctx.speak("However that ended — it ended with words on the table. Remember that you had the option. Most things in Bad Eden won't offer it twice.");
    } else {
      await ctx.speak("Circle's quiet. The game is still here, and so are you. *bzzt* — I'd call that a pass.");
    }
    await _pause(800);
    await ctx.speak("Training's over, One. Whatever tried that is still out there, and now it knows your name. Go be worth knowing.");
    try { await _stage()?.disembark?.(ctx.steward?.id, ctx.rig?.id); } catch (_) {}
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = [];
    ctx._fs = null;
  }
};

/* ═════════════════════════ PHASE 4 — FINALE ═════════════════════════
 * travel into a hostile hex → triple raid (violence / intrigue / presence,
 * player-driven, pre-targeted consoles) → graduation dive into live Bad Eden.
 * Targets are spawned scaffolding; the player raids with their REAL faction.
 */

/**
 * Find-or-create the finale targets, resolved by FLAG so the finale survives a
 * reload/resume (no reliance on ctx surviving across separate start() calls):
 *   • a disposable hostile faction (the enemy),
 *   • its hold (hostile hex) — the raid target,
 *   • the player's Forward Camp (origin hex) — the travel start.
 * Returns { scene, hostile, hostileHex, originHex }.
 */
async function _finaleTargets(ctx) {
  const stage = _stage();
  const scene = ctx.scene("hostile-hex");
  if (!scene || !stage) return { scene: scene || null, hostile: null, hostileHex: null, originHex: null };
  const hostile = await stage.spawnHostileFaction?.("The Rust Syndicate");
  const originHex = await stage.ensureHex?.(scene, {
    key: "origin", name: "Forward Camp", factionId: ctx.faction?.id || "",
    status: "occupied", xFrac: 0.28, yFrac: 0.5, fillColor: "#3aa0ff", strokeColor: "#bfe3ff"
  });
  const hostileHex = await stage.ensureHex?.(scene, {
    key: "hostile", name: "Rust Syndicate Hold", factionId: hostile?.id || "",
    status: "occupied", xFrac: 0.72, yFrac: 0.5, fillColor: "#ff5a3a", strokeColor: "#ffd0c2"
  });
  return { scene, hostile: hostile || null, hostileHex: hostileHex || null, originHex: originHex || null };
}

/* ───────────────────────── TRAVEL ───────────────────────── */
// Cross from the Forward Camp into the hostile hold using the REAL Travel interface.
// Detected off `bbttcc:afterTravel`; a manual fallback prompt prevents a trap if the
// travel engine won't plot a course on a gridless practice scene.
const travel = {
  id: "travel",
  title: "Cross Into Hostile Ground",
  scope: "shared",

  enter: async (ctx) => {
    ctx._spawned = [];
    await ctx.speak("Stewardship is holding what's yours. The real test is TAKING what isn't. There's a frontier hold squatting on contested ground — the Rust Syndicate. We're going to pay them a visit.");
    await _pause(900);

    const scene = await _requireScene(ctx, "hostile-hex", "Hostile Frontier");
    if (scene) { await _enterScene(scene, "Hostile Frontier", ctx.lane); await _pause(800); }

    ctx._finale = await _finaleTargets(ctx);

    const stage = _stage();
    if (scene && stage) {
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, _scenePoint(scene, 0.28, 0.66, ctx.lane));
      if (st.created) ctx._spawned.push({ token: st.doc });
    }
    await _pause(500);
    await ctx.speak("Two holds ahead: your Forward Camp, and the Syndicate's. Plot a course and TRAVEL across — open your Travel interface and make the crossing.");
    ctx.riff({ beat: "travel", line: "Player is about to travel into hostile territory for the finale.", intent: "Tense, conspiratorial. One line." });
  },

  detect: (ctx, done) => {
    const hostileUuid = ctx._finale?.hostileHex?.hexUuid;
    const sceneId = ctx._finale?.scene?.id;
    const onTravel = (data = {}) => {
      const toUuid = data?.to?.uuid;
      const onScene = (data?.to?.obj?.parent?.id === sceneId) || (data?.hexTo?.parent?.id === sceneId);
      if ((hostileUuid && toUuid === hostileUuid) || (sceneId && onScene)) done();
    };
    Hooks.on("bbttcc:afterTravel", onTravel);
    // Fallback — never trap the player if Travel won't drive on a practice scene.
    ctx.prompt({
      title: "◇ OPERATOR",
      content: `<p>Make the crossing to the <b>Rust Syndicate Hold</b> through your Travel interface.</p><p><i>(Practice scene — if Travel won't plot a course here, I'll wave you across.)</i></p>`,
      label: "Make the crossing"
    }).then(() => done());
    return () => Hooks.off("bbttcc:afterTravel", onTravel);
  },

  exit: async (ctx) => {
    await ctx.speak("You're across. They've seen you now — no walking this back. Time to choose HOW you take them.");
  }
};

/* ───────────────────────── TRIPLE RAID (factory) ───────────────────────── */
// One pre-targeted, player-driven raid per approach. We pre-seed the Raid Console's
// session flag on the player's REAL faction (the same flag the console persists) so it
// opens already pointed at the hostile hold + the right raid type; the player runs the
// rounds. Advance is a player-driven "Conclude" prompt (un-trappable), coloured by the
// real `bbttcc:raid:roundCommit` hook as they commit rounds.
function makeRaidBeat({ id, title, activityKey, intro, instruct, after, courtKey = "", delegation = [] }) {
  return {
    id, title, scope: "shared",

    enter: async (ctx) => {
      const f = ctx.faction;
      const fin = ctx._finale || (ctx._finale = await _finaleTargets(ctx));
      // A wired COURT upgrades this raid's stage: the player holds court on the
      // tableau scene, and "presence" + the scene's tableau flag routes the raid
      // through the Courtly engine instead of plain opposed rolls. Unwired →
      // exactly the old behavior on the hostile hex.
      const court = courtKey ? ctx.scene(courtKey) : null;
      const scene = court || fin.scene || ctx.scene("hostile-hex");
      if (scene) { await _enterScene(scene, title, ctx.lane); await _pause(500); }
      if (court) {
        // The Steward's token on the tableau auto-enrols as a courtier.
        const st = await _stage()?.ensureTokenOnScene?.(ctx.steward, court, _scenePoint(court, 0.40, 0.74, ctx.lane));
        if (st?.created) (ctx._spawned = ctx._spawned || []).push({ token: st.doc });
        // The opposing delegation: named faces with authored dispositions
        // (courtFavor toward THIS faction) and, where authored, an armed
        // extractable secret. Idempotent — replays reuse the standing court.
        for (const d of delegation) {
          const sp = await _stage()?.spawnCourtier?.(court, {
            name: d.name, img: d.img || "", favor: d.favor || 0,
            favorFactionId: ctx.faction?.id || "",
            persona: d.persona || "", secretLine: d.secretLine || "",
            ..._scenePoint(court, d.xFrac, d.yFrac, ctx.lane)
          });
          if (sp && !sp.reused) (ctx._spawned = ctx._spawned || []).push(sp);
        }
      }

      if (!f) { await ctx.speak("No faction on file to raid under— *bzzt* —I can't open a war console without one. Lead a faction, then replay the finale."); return; }

      const hex = fin.hostileHex;
      // Pre-seed the console session (read on first render via the console's session-apply).
      const session = {
        rev: Date.now(), ts: Date.now(), by: globalThis.game?.user?.id || "",
        attackerId: f.id, supportFactionIds: [],
        activityKey, difficulty: "normal",
        targetType: "hex", targetUuid: hex?.hexUuid || "",
        targetName: hex ? "Rust Syndicate Hold" : "—",
        defenderId: fin.hostile?.id || "",
        rounds: [], logWar: false, includeDefender: true
      };
      try { await _stage()?.setRaidSession?.(f.id, session); } catch (_) {}

      await ctx.speak(intro);
      await _pause(400);
      if (court && delegation.length) {
        for (const d of delegation) {
          if (!d.line) continue;
          await ctx.speak(d.line);
          await _pause(700);
        }
      }
      try { await globalThis.game?.bbttcc?.api?.raid?.openConsole?.({ factionId: f.id }); }
      catch (e) { console.warn(TAG, `openConsole (${activityKey}) failed`, e); }

      // Raids are GM-driven — the player's console is staging-only (attacker
      // picker / round commit / end-raid are all {{#if isGM}}). Hand the GM a
      // console already pointed at this faction so the round can actually run.
      const gmRes = await _stage()?.openRaidConsoleForGM?.(f.id, {
        playerName: ctx.steward?.name || ctx.user?.name || "",
        activityKey,
        sceneId: court?.id ?? ""            // courtly raids need the GM viewing the tableau
      });
      if (!globalThis.game?.user?.isGM) {
        if (gmRes?.ok) await ctx.speak("Your GM's console just lit up on your banner — they run the rounds, you feed them. Stage your OP and pick your maneuvers; they'll roll it.");
        else await ctx.speak("Heads up: rounds are resolved GM-side, and I couldn't reach one. Stage what you like — you'll need a GM at the table to actually roll this raid.");
        await _pause(500);
      }

      ctx.riff({ beat: id, line: `Player is about to run a ${activityKey} raid against the tutorial hostile hold.`, intent: "Coach them through this one approach. One line." });
    },

    detect: (ctx, done) => {
      const fid = ctx.faction?.id;
      let rounds = 0;
      const onCommit = (data = {}) => {
        if (fid && String(data.attackerId || "") !== String(fid)) return;
        rounds++;
        ctx.riff?.({ beat: id, line: `Player committed round ${rounds} of the ${activityKey} raid (outcome: ${data.outcome || "?"}).`, intent: "React to the round outcome. One short line." });
      };
      Hooks.on("bbttcc:raid:roundCommit", onCommit);
      ctx.prompt({ title: "◇ OPERATOR", content: instruct, label: "Conclude this raid" }).then(() => done());
      return () => Hooks.off("bbttcc:raid:roundCommit", onCommit);
    },

    exit: async (ctx) => {
      if (after) await ctx.speak(after);
    }
  };
}

const raidViolence = makeRaidBeat({
  id: "raid_violence",
  title: "Raid — Violence",
  activityKey: "violence",
  intro: "First approach: the blunt one. VIOLENCE. Your console's loaded and aimed at the Rust hold — pick your maneuvers and run the rounds. Make it loud.",
  instruct: `<p>The <b>Violence</b> raid on the <b>Rust Syndicate Hold</b> is staged and aimed.</p><p><b>You:</b> stage your OP and pick maneuvers in the console. <b>Your GM:</b> commits the rounds — their console is already open on your banner.</p><p>When you've felt the rhythm of assault, conclude.</p>`,
  after: "Loud and effective. But not every door wants kicking. Some you pick— *bzzt* —quietly."
});

const raidIntrigue = makeRaidBeat({
  id: "raid_intrigue",
  title: "Raid — Intrigue",
  activityKey: "intrigue",
  intro: "Second approach: the quiet one. INTRIGUE. Same target, different knife — slip in, raise the alarm meter at your own pace, take them from inside. Console's re-aimed; go.",
  instruct: `<p>The <b>Intrigue</b> raid is aimed at the same hold — infiltration and the alarm meter.</p><p><b>You:</b> stage OP and choose the quiet maneuvers. <b>Your GM:</b> rolls the rounds.</p><p>When you've felt how the quiet game plays, conclude.</p>`,
  after: "Subtle. They never saw the hand in their pocket. One approach left, and it's the strangest— *bzzt* —winning without a single blow."
});

const raidPresence = makeRaidBeat({
  id: "raid_presence",
  title: "Raid — Presence",
  activityKey: "presence",
  courtKey: "court-review",   // wired court scene → the Courtly engine engages
  // The Rust Syndicate's delegation: one face per courtly lesson. Grudge is
  // the principal (the mind to change / Call-the-Question target), Boltcutter
  // is the wall charm bounces off (Expose/Intimidate — and the suspicion
  // lesson when pressed wrong), Verge is the swayable ledger-keeper with an
  // ARMED extractable secret (courtiers are loot, not scenery).
  delegation: [
    {
      name: "Foreman Ozzie Grudge", xFrac: 0.55, yFrac: 0.50, favor: 0,
      persona: "Foreman of the Rust Syndicate Hold and principal of its delegation. Pragmatic, proud, keeps score in salvage quotas and favors owed. Movable by patient, material argument — never by charm alone. Voice: short declaratives; taps the table once, softly, when a point actually lands.",
      line: "Three faces across the tableau. Centre: FOREMAN OZZIE GRUDGE. The Hold is his, and so is the decision — he's the mind you're bending, One."
    },
    {
      name: "Auntie Boltcutter", xFrac: 0.42, yFrac: 0.47, favor: -2,
      persona: "The Syndicate's enforcer-matriarch. Despises courtly talk, counts the exits, arrived certain this parley is a trick. Warms only to demonstrated strength or a genuinely uncovered truth — flattery raises her hackles and the room's suspicion with them. Voice: dry, cutting, economical.",
      line: "His left hand: AUNTIE BOLTCUTTER. She decided you were a trick before you sat down. Charm will bounce — find a crack in her, or make one, and mind the room's SUSPICION while you try."
    },
    {
      name: "Tallyman Verge", xFrac: 0.68, yFrac: 0.53, favor: 1,
      persona: "Quartermaster and keeper of the Hold's ledgers. Nervous, precise, loyal to the supply lines above the banner. Folds readily to a good trade; the state of the books weighs on him visibly.",
      secretLine: "The Hold's Ledger Doesn't Balance :: oppRollMinus2 :: someone shows genuine interest in the Hold's supply troubles, or offers a trade that would cover a shortfall :: The winter stores are a fiction — Verge has papered over a thirty-crate shortfall for two seasons, and if the Foreman learns the ledger's true state mid-parley, the Hold's bargaining position collapses.",
      line: "And his right: TALLYMAN VERGE, holding the ledgers like a shield. He wants a deal more than he wants a winner — and men who keep the books KNOW things. Courtiers aren't scenery, One. Work the court."
    }
  ],
  intro: "Last approach: the velvet one. PRESENCE — courtly intrigue. You don't break the hold, you out-talk it; bend influence until they fold to your face. Console's re-aimed; hold court.",
  instruct: `<p>The <b>Presence</b> raid — courtly influence against the same hold.</p><p><b>You:</b> stage OP and choose how you press. <b>Your GM:</b> resolves each round.</p><p>Watch the <b>courtiers</b>: favor moves them, pressing wrong raises suspicion — and one of them knows something worth extracting.</p><p>When you've felt how soft power lands, conclude.</p>`,
  after: "And that's the whole grammar of taking ground — fist, knife, and word."
});

/* ───────────────────────── GRADUATION ───────────────────────── */
// Tear down ALL finale scaffolding, clear the real faction's stale raid pointer, mark the
// world's onboarding complete, and dive into the LIVE Bad Eden map (pull the table if a GM
// is driving). Players keep their real steward/rig/faction — they just walk out the door.
const graduation = {
  id: "graduation",
  title: "Graduation",
  scope: "shared",

  enter: async (ctx) => {
    await ctx.speak("Three consoles, four anchors, one circle, and something that tried to unmake the whole board and had to sit down at a table instead. Violence, intrigue, presence — you can take ground any way the moment demands. That's a Steward.");
    await _pause(1000);
    await ctx.speak("Training's done, One. No more sandbox, no more straw adversaries. From here it's the real Bad Eden — your hold, your rig, your faction, live in the weave. Go fix what broke. *bzzt*");
  },

  detect: (ctx, done) => {
    ctx.prompt({
      title: "◇ OPERATOR",
      content: `<p>You're ready. Step out of the tutorial and into the <b>living world</b>.</p><p>Everything you practiced is real now.</p>`,
      label: "Enter Bad Eden"
    }).then(() => done());
    return null;
  },

  exit: async (ctx) => {
    const ns = globalThis.game?.bbttcc?.onboarding;
    const f = ctx.faction;
    const sceneId = ctx._finale?.scene?.id || ctx.scene("hostile-hex")?.id;

    // Sever the real faction's stale raid pointer + delete every spawned finale prop.
    try { await _stage()?.teardownFinale?.(f?.id, sceneId); } catch (_) {}
    try { await _stage()?.cleanup?.(ctx._spawned || []); } catch (_) {}
    ctx._spawned = []; ctx._finale = null;

    // Mark the world's onboarding complete (GM only; players can still replay).
    try { if (globalThis.game?.user?.isGM) await ns?.settings?.set?.("completed", true); } catch (_) {}

    // Dive into the live Bad Eden map. "activate" pulls the WHOLE table — never do
    // that while another Steward is still mid-tutorial (it would yank them out of
    // their own run). Solo graduations keep the original table-pull behaviour.
    let othersLive = 0;
    try { othersLive = Number((await _stage()?.runList?.(ctx.user?.id))?.count) || 0; } catch (_) {}
    const audience = othersLive > 0 ? "view" : "activate";
    if (othersLive > 0) console.log(TAG, `graduation: ${othersLive} other run(s) live — diving solo (audience:"view").`);

    const main = ns?.resolve?.mainMap?.();
    const tx = _tx();
    if (main && tx?.dive) {
      try { await tx.dive(main.uuid, { focus: _scenePoint(main, 0.5, 0.5, ctx.lane), audience, label: "Bad Eden" }); }
      catch (e) { console.warn(TAG, "graduation dive failed; viewing instead", e); try { await main.view?.(); } catch (_) {} }
    } else if (main) {
      try { await main.view?.(); } catch (_) {}
    } else {
      console.warn(TAG, "No live Bad Eden map resolved for the graduation dive.");
    }

    await ctx.speak("Connection handed off. You're live. Good luck, One — you'll need it. *bzzt* —Operator out.");

    // Campaign handoff (2026-08-23): graduation hands BACK to the Offices of
    // Fates and Destinies at Teaching Slide 1 — the orientation film. Player
    // clients can post a GM-whispered card, so no socket is needed; the GM
    // clicks once when the whole class is out.
    try {
      const resumeId = String(globalThis.game?.settings?.get?.(MODULE_ID, "campaignResumeBeatId") || "").trim();
      if (resumeId) {
        const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        await ChatMessage.create({
          whisper: gmIds,
          content: `<div class="bbttcc-onb-handoff">` +
            `<h3>🎬 ${ctx.steward?.name || ctx.user?.name || "A Steward"} graduated</h3>` +
            `<p>When the whole class is out, roll the orientation film (Teaching Slide 1).</p>` +
            `<button type="button" class="bbttcc-onb-resume">🎬 Roll the orientation film</button></div>`
        });
      }
    } catch (e) { console.warn(TAG, "graduation → campaign handoff card failed", e); }
  }
};

/* ───────────────────────── REGISTRATION ───────────────────────── */
Hooks.once("ready", () => {
  const ns = globalThis.game?.bbttcc?.onboarding;
  if (!ns?.beats?.register) {
    console.warn(TAG, "onboarding namespace not ready — beats NOT registered.");
    return;
  }
  const ordered = [
    incarnation, meatsuit, driving,
    stewardshipClaim, stewardshipTurn,
    outfitting,
    crewOccult, surgeBeat, manifestations,
    combatSim,
    travel, raidViolence, raidIntrigue, raidPresence,
    provingTrials, finalShowdown,
    graduation
  ];
  for (const beat of ordered) ns.beats.register(beat);
  console.log(TAG, "Registered beats:", ns.beats.list().map(b => b.id).join(", "));
});
