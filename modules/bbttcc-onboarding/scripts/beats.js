/* bbttcc-onboarding/scripts/beats.js
 * The ordered beat definitions.
 *   Phase 1: incarnation
 *   Phase 2: meatsuit (test real abilities), driving (pilot the real rig)
 *   Phase 3: stewardship — claim a sandbox hex, read OP + run a dry-run Turn
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
    Hooks.on("fourththing:itemAnimated", onAnim);
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
        ? `<p><b>Board:</b> select your Steward's token, right-click it, and press the <b>🚚 truck</b> button in the token HUD.</p>` +
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
function makeRaidBeat({ id, title, activityKey, intro, instruct, after }) {
  return {
    id, title, scope: "shared",

    enter: async (ctx) => {
      const f = ctx.faction;
      const fin = ctx._finale || (ctx._finale = await _finaleTargets(ctx));
      const scene = fin.scene || ctx.scene("hostile-hex");
      if (scene) { await _enterScene(scene, title, ctx.lane); await _pause(500); }

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
      try { await globalThis.game?.bbttcc?.api?.raid?.openConsole?.({ factionId: f.id }); }
      catch (e) { console.warn(TAG, `openConsole (${activityKey}) failed`, e); }

      // Raids are GM-driven — the player's console is staging-only (attacker
      // picker / round commit / end-raid are all {{#if isGM}}). Hand the GM a
      // console already pointed at this faction so the round can actually run.
      const gmRes = await _stage()?.openRaidConsoleForGM?.(f.id, {
        playerName: ctx.steward?.name || ctx.user?.name || "",
        activityKey
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
  intro: "Last approach: the velvet one. PRESENCE — courtly intrigue. You don't break the hold, you out-talk it; bend influence until they fold to your face. Console's re-aimed; hold court.",
  instruct: `<p>The <b>Presence</b> raid — courtly influence against the same hold.</p><p><b>You:</b> stage OP and choose how you press. <b>Your GM:</b> resolves each round.</p><p>When you've felt how soft power lands, conclude.</p>`,
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
    await ctx.speak("Three approaches, one enemy folded. Violence, intrigue, presence — you can take ground any way the moment demands. That's a Steward.");
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
    travel, raidViolence, raidIntrigue, raidPresence, graduation
  ];
  for (const beat of ordered) ns.beats.register(beat);
  console.log(TAG, "Registered beats:", ns.beats.list().map(b => b.id).join(", "));
});
