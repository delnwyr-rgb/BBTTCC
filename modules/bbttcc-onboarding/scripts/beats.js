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

    const scene = ctx.scene("sandbox-hex");
    if (scene) { await _enterScene(scene, "Sandbox Hold"); await _pause(800); }

    const stage = _stage();
    if (scene && stage?.ensureSandboxHex) ctx._sandboxHex = await stage.ensureSandboxHex(scene, "Tutelary Hold");
    if (scene && stage) {
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, { x: Math.round(scene.width * 0.5), y: Math.round(scene.height * 0.66) });
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

    const scene = ctx.scene("hostile-hex");
    if (scene) { await _enterScene(scene, "Hostile Frontier"); await _pause(800); }
    else console.warn(TAG, "No 'hostile-hex' tutorial Scene — run tools/onboarding-setup.macro.js.");

    ctx._finale = await _finaleTargets(ctx);

    const stage = _stage();
    if (scene && stage) {
      const st = await stage.ensureTokenOnScene(ctx.steward, scene, { x: Math.round(scene.width * 0.28), y: Math.round(scene.height * 0.66) });
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
      if (scene) { await _enterScene(scene, title); await _pause(500); }

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
  instruct: `<p>Run the <b>Violence</b> raid — select maneuvers and commit a round or two against the <b>Rust Syndicate Hold</b>.</p><p>When you've felt the rhythm of assault, conclude.</p>`,
  after: "Loud and effective. But not every door wants kicking. Some you pick— *bzzt* —quietly."
});

const raidIntrigue = makeRaidBeat({
  id: "raid_intrigue",
  title: "Raid — Intrigue",
  activityKey: "intrigue",
  intro: "Second approach: the quiet one. INTRIGUE. Same target, different knife — slip in, raise the alarm meter at your own pace, take them from inside. Console's re-aimed; go.",
  instruct: `<p>Run the <b>Intrigue</b> raid — work the infiltration/alarm scenario against the <b>Rust Syndicate Hold</b>.</p><p>When you've felt how the quiet game plays, conclude.</p>`,
  after: "Subtle. They never saw the hand in their pocket. One approach left, and it's the strangest— *bzzt* —winning without a single blow."
});

const raidPresence = makeRaidBeat({
  id: "raid_presence",
  title: "Raid — Presence",
  activityKey: "presence",
  intro: "Last approach: the velvet one. PRESENCE — courtly intrigue. You don't break the hold, you out-talk it; bend influence until they fold to your face. Console's re-aimed; hold court.",
  instruct: `<p>Run the <b>Presence</b> raid — play the courtly/influence scenario against the <b>Rust Syndicate Hold</b>.</p><p>When you've felt how soft power lands, conclude.</p>`,
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

    // Dive into the live Bad Eden map — pull the whole table if a GM is driving.
    const main = ns?.resolve?.mainMap?.();
    const tx = _tx();
    if (main && tx?.dive) {
      try { await tx.dive(main.uuid, { focus: { x: main.width / 2, y: main.height / 2 }, audience: "activate", label: "Bad Eden" }); }
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
    travel, raidViolence, raidIntrigue, raidPresence, graduation
  ];
  for (const beat of ordered) ns.beats.register(beat);
  console.log(TAG, "Registered beats:", ns.beats.list().map(b => b.id).join(", "));
});
