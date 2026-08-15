/* bbttcc-onboarding/scripts/incarnation-forge.js
 * The intake seam: Steward forging + Faction founding INSIDE the onboarding
 * flow, so a brand-new player goes soul → body → banner → tutorial in one
 * seamless run. Both remain fully usable OUTSIDE the flow (the Tree wizard
 * and manual faction creation are untouched — this file only adds gates).
 *
 *  1. STEWARD FORGE — wraps ns.start(): when no Steward resolves, instead of
 *     the old hard-stop the Operator opens the Sorting Engine's Tree-of-Life
 *     wizard (game.bbttcc.openTreeWizardV2 — the full guided-create pipeline),
 *     waits for the created character, assigns it as the player's character,
 *     then hands off to the director as if it had been there all along.
 *  2. FACTION FOUNDING — wraps the `driving` and `stewardship_claim` beats:
 *     the first one to run with no faction bound holds a founding ceremony
 *     (name + creed), creates the faction actor via the GM relay (players
 *     lack Create Actor), binds the Steward to it (factionId flag + roster +
 *     OWNER permission), and continues. Idempotent — a bound faction skips.
 *
 * Load AFTER director.js, beats.js and tour-beats.js in module.json: the
 * beat wrappers here compose over the tour-offer wrappers (founding first,
 * then the beat's staged enter + its tour offer).
 */

const MODULE_ID = "bbttcc-onboarding";
const FMOD = "bbttcc-factions";
const TAG = "[onboarding/forge]";

function _ns() { return globalThis.game?.bbttcc?.onboarding; }
function _speak(line, opts) { const s = _ns()?.speak; return s ? s(line, opts) : Promise.resolve(); }

/* ───────────────────── 1 · STEWARD FORGE ───────────────────── */

/** Wait for the wizard to finalize a character (or be closed without one). */
function _awaitForgedSteward() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (actor) => {
      if (settled) return; settled = true;
      Hooks.off("createActor", onCreate);
      clearInterval(watch);
      resolve(actor || null);
    };
    const onCreate = (doc, _options, userId) => {
      if (userId !== game.user.id) return;
      if (doc?.documentName === "Actor" && doc.type === "character") finish(doc);
    };
    Hooks.on("createActor", onCreate);
    // Wizard cancelled/closed without finalizing → give up gracefully. The
    // wizard renders inline HTML with bbttcc-twv2-* classes; absence after it
    // was seen = closed. Grace period covers the pre-render gap.
    let seen = false; let graceTicks = 0;
    const watch = setInterval(() => {
      const open = !!document.querySelector('[class*="bbttcc-twv2"]');
      if (open) { seen = true; return; }
      if (seen) return finish(null);
      if (++graceTicks > 20) return finish(null); // never rendered (~30s)
    }, 1500);
  });
}

async function _forgeSteward(user) {
  const ns = _ns();
  const existing = ns?.resolve?.steward?.(user);
  if (existing) return existing;

  const openWizard = game.bbttcc?.openTreeWizardV2;
  if (typeof openWizard !== "function") {
    ui.notifications?.error?.("No character found, and the Sorting Engine (bbttcc-sorting-engine) isn't loaded — ask the GM to create/assign a Steward, then rerun onboarding.");
    return null;
  }
  if (!game.user.can("ACTOR_CREATE")) {
    ui.notifications?.warn?.("Your player role can't create actors. Ask the GM to grant Create Actor permission (or forge the Steward together), then rerun onboarding.");
    await _speak("The forge needs clay your permissions don't carry, One. Flagging the GM— *bzzt* —try again once they hand it over.", { audience: "self" });
    try {
      const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
      if (gmIds.length) await ChatMessage.create({ whisper: gmIds, speaker: { alias: "◇ OPERATOR" }, content: `<b>${game.user.name}</b> needs the <i>Create Actor</i> permission (or a pre-made Steward) to start onboarding.` });
    } catch (_) {}
    return null;
  }

  await _speak("No meatsuit on file. Good — blank slates pour cleaner. Opening the forge: answer honestly, the Tree sorts the rest.", { audience: "self" });
  try { openWizard(); } catch (e) {
    console.warn(TAG, "wizard open failed", e);
    ui.notifications?.error?.("The Tree-of-Life wizard failed to open — see console.");
    return null;
  }

  const created = await _awaitForgedSteward();
  if (!created) {
    await _speak("Forge closed, nothing poured. The offer stands — rerun onboarding whenever you're ready to be somebody.", { audience: "self" });
    return null;
  }

  try { await game.user.update({ character: created.id }); }
  catch (e) { console.warn(TAG, "user.character assignment failed (continuing — ownership fallback covers resolution)", e); }

  await _speak(`Poured, cooled, and breathing: ${created.name}. That's you now — the sheet is the mirror. Continuing incarnation— *bzzt*`, { audience: "self" });
  return created;
}

/* ───────────────────── 2 · FACTION FOUNDING ───────────────────── */

// GM-side op: create the faction actor + bind the steward. Registered on all
// clients; executed on the (primary) GM via the relay.
function _registerFoundingOp() {
  const relay = _ns()?.relay;
  if (!relay?.registerOp) return console.warn(TAG, "relay missing — founding op not registered.");
  relay.registerOp("foundPlayerFaction", async ({ name, creed, stewardId, userId }) => {
    name = String(name || "").trim();
    if (!name) throw new Error("faction name required");
    const steward = game.actors.get(String(stewardId || ""));
    if (!steward) throw new Error("steward not found");

    const ownership = { default: 0 };
    if (userId) ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

    const faction = await Actor.create({
      name,
      type: "npc",
      ownership,
      flags: {
        [FMOD]: {
          isFaction: true,
          roster: [steward.uuid],
          foundedBy: steward.name,
          creed: String(creed || "").trim()
        },
        [MODULE_ID]: { foundedViaOnboarding: true, foundedTs: Date.now() }
      }
    });
    if (!faction) throw new Error("faction creation failed");
    await steward.setFlag(FMOD, "factionId", faction.id);
    return { factionId: faction.id };
  });
}

/** Operator founding ceremony: name + creed → relay-created faction. */
async function _foundFaction(ctx) {
  const ns = _ns();
  const existing = ns?.resolve?.faction?.(ctx.user, ctx.steward);
  if (existing || !ctx.steward) return existing || null;

  await ctx.speak("A body needs a banner, One. Before you drive, claim, or raid, the world wants to know: in whose name?");

  const DV2 = foundry?.applications?.api?.DialogV2;
  const FOUND_TITLE = "◇ OPERATOR — Found Your Faction";
  const nsUi = ns?.ui;
  let picked = null;
  const content =
    `<div class="bbttcc-onboarding-prompt">` +
    `<p>Found your faction — the bigger body your Steward moves inside. You can rename, recrest and rebuild everything later from the faction sheet.</p>` +
    `<div class="form-group"><label><b>Faction name</b></label><input type="text" name="factionName" placeholder="e.g. The Furrier's Fixit Farm" style="width:100%;"/></div>` +
    `<div class="form-group"><label>Creed (optional, one line)</label><input type="text" name="factionCreed" placeholder="What you tell recruits at the fire." style="width:100%;"/></div>` +
    `<div class="form-group"><label><b>Starter rig</b> (free — same choice as faction creation)</label>` +
    `<label style="display:block;margin:0.2em 0;"><input type="radio" name="rigChassis" value="hexmobile" checked/> <b>Hexmobile</b> — scout-and-skirmish land ride, two riders</label>` +
    `<label style="display:block;margin:0.2em 0;"><input type="radio" name="rigChassis" value="space_marine"/> <b>Space Marine</b> — single-pilot power-armor mech</label>` +
    `</div>` +
    `<div class="form-group"><label>Starter rig name (optional)</label><input type="text" name="rigName" placeholder="Name your ride." style="width:100%;"/></div>` +
    `</div>`;
  if (DV2?.wait) {
    nsUi?.raiseDialogByTitle?.(FOUND_TITLE);
    await DV2.wait({
      window: { title: FOUND_TITLE }, content,
      position: { ...(nsUi?.PROMPT_POSITION ?? { top: 96, left: 120, width: 440 }) },
      buttons: [
        { action: "found", label: "Raise the banner", default: true, callback: (_ev, btn) => {
            const rootEl = btn?.form ?? btn;
            picked = {
              name: rootEl?.querySelector?.('[name="factionName"]')?.value || "",
              creed: rootEl?.querySelector?.('[name="factionCreed"]')?.value || "",
              rigName: rootEl?.querySelector?.('[name="rigName"]')?.value || "",
              rigChassis: rootEl?.querySelector?.('[name="rigChassis"]:checked')?.value || "hexmobile"
            };
          } },
        { action: "later", label: "Not yet" }
      ],
      rejectClose: false, modal: false
    }).catch(() => null);
  }
  if (!picked?.name?.trim()) {
    await ctx.speak("No banner, no problem — for now. Some beats ahead need one; I'll ask again when the world does.", { audience: "self" });
    return null;
  }

  const res = await ns.runAsGM("foundPlayerFaction", {
    name: picked.name, creed: picked.creed,
    stewardId: ctx.steward.id, userId: ctx.user?.id || game.user.id
  });
  if (!res?.factionId) {
    ui.notifications?.warn?.("Faction founding failed (no GM online, or creation refused) — you can create one from the Actors tab later.");
    return null;
  }
  const faction = await ns.relay.resolveActor(res.factionId);
  if (ctx && faction) ctx.faction = faction; // refresh the beat context in place

  await ctx.speak(`${faction?.name || picked.name} — raised, rostered, and yours. OP banks empty, reputation unwritten. Best possible start— *bzzt* —nowhere to go but everywhere.`);

  // Every new banner comes with its free starter Hexmobile — minted NOW, named by the
  // player, owned by the player (the driving beat and rig tour both need that ownership).
  try {
    const rigRes = await ns.runAsGM("mintRig", {
      factionId: res.factionId, chassis: picked.rigChassis || "hexmobile",
      userId: ctx.user?.id || game.user.id,
      name: picked.rigName || ""
    });
    if (rigRes?.rigId) {
      const rig = await ns.relay.resolveActor(rigRes.rigId);
      const flavor = picked.rigChassis === "space_marine" ? "power-armor humming" : "keys in it";
      await ctx.speak(`Parked out front: ${rig?.name || "your starter rig"} — ${flavor}. Yours to drive, yours to answer for.`);
    }
  } catch (e) { console.warn(TAG, "starter rig mint failed (driving beat will retry)", e); }

  try { faction?.sheet?.render(true); } catch (_) {}

  // Faction-sheet tour offered HERE, the moment the banner rises (owner ask
  // 2026-08-11 — it used to arrive at stewardship_turn, after the hex review).
  // Same tour id as the stewardship_turn offer; that one is skipIfTaken, so it
  // only re-fires as a safety net if the player declines now.
  try {
    await ns.offerTour?.({
      tour: "faction-sheet",
      prompt: "That banner comes with a control room. Your faction sheet is where everything rolls up — OP banks, roster, health tracks, the order queue. Tour it now, before the world starts billing you?",
      label: "Tour my faction"
    });
  } catch (e) { console.warn(TAG, "founding faction-tour offer failed", e); }

  return faction;
}

/* ───────────────────── wiring ───────────────────── */

Hooks.once("ready", () => {
  const ns = _ns();
  if (!ns) return console.warn(TAG, "onboarding namespace missing — forge not installed.");

  _registerFoundingOp();

  // Gate 1: steward forge in front of the director's start().
  const originalStart = ns.start;
  if (typeof originalStart === "function" && !originalStart.__forgeWrapped) {
    const wrapped = async function (opts = {}) {
      const user = opts.user || game.user;
      const steward = await _forgeSteward(user);
      if (!steward) return; // messaging already handled; director would only re-error
      return originalStart.call(this, opts);
    };
    wrapped.__forgeWrapped = true;
    ns.start = wrapped;
  }

  // Gate 2: faction founding in front of the first faction-hungry beats.
  // (Composes over tour-beats' wrappers: founding → staged enter → tour offer.)
  const beats = ns.beats;
  if (beats?.get && beats?.register) {
    for (const beatId of ["driving", "stewardship_claim"]) {
      const beat = beats.get(beatId);
      if (!beat || beat.__factionGate) continue;
      const originalEnter = beat.enter;
      beats.register(Object.assign({}, beat, {
        __factionGate: true,
        enter: async (ctx) => {
          try { await _foundFaction(ctx); } catch (e) { console.warn(TAG, "founding gate failed", e); }
          if (originalEnter) return originalEnter(ctx);
        }
      }));
    }
  }

  console.log(TAG, "incarnation forge installed (steward gate on start(), founding gate on driving + stewardship_claim).");
});
