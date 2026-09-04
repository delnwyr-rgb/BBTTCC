// Bad Eden — Epic G3: THE REFORMATION — 2026-09-04
// ─────────────────────────────────────────────────────────────────────────────
// The ending, finally listening (DESCENT_ENGINE_SPEC §3.3). Two flags spent
// this campaign's whole life shouting into the void:
//   · bbttcc:epic:malkuthAligned — emitted at 100% World-Health, ZERO
//     listeners since P3 shipped. THIS FILE is its first consumer.
//   · flags.bbttcc-factions.tikkun.greatWorkComplete — written by the Final
//     Ritual (G2), read by NOTHING until now.
//
// The Reformation fires when BOTH halves of the Work are done, in either
// order: the Dragon answered (PARLEY or SUNDER) and Malkuth aligned (100%).
// One half without the other posts a single "the Work awaits" card and waits
// for the other shoe. When both land:
//   1. ✦ THE REFORMATION ✦ — the transition card (radiant for PARLEY,
//      dimmer for SUNDER — Ruling 4's reduced ending honored).
//   2. THE BOOK OF <faction> — per-faction epilogue cards drawn from what
//      actually happened: war-log length, each steward's faced fragments and
//      final Darkness band, the mercy ledger, VP/Unity, the lamps.
//   3. THE ASCENT LIES OPEN — Act II unlocked: world setting
//      `bbttcc-epic.ascentUnlocked` + bbttcc:epic:ascentUnlocked (epicBand
//      already answers "ascent" at L21+; release 2 builds what lives there).
//   4. Mal gets the last word. He's earned it.
//
// Authority: world setting `bbttcc-epic.reformation {done, at, outcome}`
// (latched — this is THE ending; `reset()` exists for the GM who needs a
// rehearsal). Emits `bbttcc:epic:reformation {outcome}`.
// API: game.fourththing.epic.reformation.{status, fire, reset}.
// Single writer = active GM.
// ─────────────────────────────────────────────────────────────────────────────

const MOD = "bbttcc-epic";
const FCT = "bbttcc-factions";
const TAG = "[bbttcc-epic/reformation]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

function refState() {
  const s = game.settings.get(MOD, "reformation");
  return (s && typeof s === "object") ? { done: false, at: null, outcome: null, awaitingCard: false, ...s } : { done: false, at: null, outcome: null, awaitingCard: false };
}
function daathOutcome() {
  try { const d = game.settings.get(MOD, "daath"); return (d?.outcome === "parley" || d?.outcome === "sunder") ? d.outcome : null; }
  catch (_e) { return null; }
}
function malkuthDone() {
  try { return game.settings.get(MOD, "malkuthAligned") === true; } catch (_e) { return false; }
}
function isActiveGM() {
  if (!game.user?.isGM) return false;
  const a = game.users?.activeGM;
  return !a || a.isSelf;
}

async function beatCard(title, body, foot, extraClass = "is-keter") {
  await ChatMessage.create({
    content: `<div class="bbttcc-epic-beat ${extraClass}">
      <div class="bbttcc-epic-beat-title">${title}</div>
      <div class="bbttcc-epic-beat-body">${body}</div>
      ${foot ? `<div class="bbttcc-epic-beat-foot">${foot}</div>` : ""}
    </div>`
  }).catch(() => {});
}

// ── The epilogue readers (greatWorkComplete's first audience) ───────────────
function completedFactions() {
  const flagged = (game.actors?.contents ?? []).filter(a =>
    a.getFlag?.(FCT, "isFaction") === true && a.getFlag?.(FCT, "tikkun")?.greatWorkComplete === true);
  if (flagged.length) return flagged;
  // Fallback (manual fire before a ritual): the Converged stewards' banners.
  const ids = new Set((game.actors?.contents ?? [])
    .filter(a => a.type === "character" && a.getFlag?.(MOD, "converged")?.value)
    .map(a => a.getFlag?.(FCT, "factionId")).filter(Boolean));
  return [...ids].map(id => game.actors?.get(id)).filter(Boolean);
}
function factionMembers(fid) {
  return (game.actors?.contents ?? []).filter(a => a.type === "character" && a.getFlag?.(FCT, "factionId") === fid);
}
function mercyRecord() {
  try { return Number(game.settings.get("bbttcc-campaign", "banditMercy")) || 0; } catch (_e) { return 0; }
}
function lampsLit() {
  try { return game.fourththing?.epic?.daath?.status?.()?.lampsNow ?? []; } catch (_e) { return []; }
}

async function postFactionEpilogue(faction, outcome) {
  const f = faction.flags?.[FCT] ?? {};
  const warCount = Array.isArray(f.warLogs) ? f.warLogs.length : 0;
  const V = f.victory ?? {};
  const members = factionMembers(faction.id);
  const lines = members.map(a => {
    let frags = [], band = "clear";
    try { frags = game.fourththing?.darkness?.fragments?.(a) ?? []; } catch (_e) {}
    try { band = game.fourththing?.darkness?.band?.(a) ?? "clear"; } catch (_e) {}
    const faced = frags.filter(x => x?.faced).length;
    return `<b>${a.name}</b> — ${faced}/${frags.length} fragment${frags.length === 1 ? "" : "s"} faced · ends the Work at <b>${cap(band)}</b>`;
  }).join("<br/>");
  await beatCard(`📖 THE BOOK OF ${String(faction.name).toUpperCase()}`,
    `${warCount} entries in the war log. VP ${Number(V.vp) || 0} · Unity ${Number(V.unity) || 0}.<br/><br/>${lines || "<em>No stewards fly this banner — the record stands alone.</em>"}`,
    `${outcome === "parley" ? "They chose the true answer." : "They chose the answer that works, and paid for it."} · The Great Work`);
}

// ── The Reformation itself ──────────────────────────────────────────────────
async function fireReformation(outcome, { forced = false } = {}) {
  const st = refState();
  if (st.done) { if (forced) ui.notifications?.info("The Reformation is already recorded — reset() first for a rehearsal."); return st; }
  const oc = outcome === "sunder" ? "sunder" : "parley";
  await game.settings.set(MOD, "reformation", { done: true, at: Date.now(), outcome: oc, awaitingCard: false });

  const lamps = lampsLit();
  if (oc === "parley") {
    await beatCard("✦ THE REFORMATION ✦",
      `Malkuth stands whole and the Dragon has come home. The Kingdom does not become a paradise — it becomes <b>honest</b>: fields that stay fields, doors that open both ways, dark places that are only dark until morning. Every lamp burns; nothing that was faced is wasted; nothing that was loved is lost. The Work is complete, and the world — for the first time since it shattered — is <em>keeping itself</em>.`,
      `World-Health 100% · the Dragon transformed · ${lamps.length}/10 lamps · Bad Eden — The Great Work, COMPLETE`);
  } else {
    await beatCard("✦ THE REFORMATION — SCARRED ✦",
      `Malkuth stands whole and the Dragon lies broken. The Kingdom heals the way a fracture heals: strong, and always aching before rain. One lamp is dark and stays dark; the stewards carry weight that facing can still, slowly, lift. It is a good world. It could have been a true one. <em>Both things are real.</em>`,
      `World-Health 100% · the Dragon sundered · a lamp dark forever · The Great Work, complete — lesser`);
  }

  for (const faction of completedFactions()) {
    await postFactionEpilogue(faction, oc);
  }
  const mercy = mercyRecord();
  await beatCard("⚖ THE LEDGER",
    `<b>${mercy}</b> soul${mercy === 1 ? "" : "s"} talked down instead of put down. The Reformation counts them first.`,
    `the mercy record · counted before anything else`);

  await game.settings.set(MOD, "ascentUnlocked", true);
  await beatCard("🌅 THE ASCENT LIES OPEN",
    `The Tree has a stable root, and the way up is no longer a metaphor. Act II waits above the aperture: the healing of the Sefirot themselves. <em>Rest first. You have earned the kind of rest that ends.</em>`,
    `Act II unlocked · epicBand answers "ascent" at L21+ · release 2 builds what lives there`);
  Hooks.callAll("bbttcc:epic:ascentUnlocked", { outcome: oc });

  // Mal gets the last word. He's earned it.
  await beatCard("🎙 MAL, FINALLY",
    oc === "parley"
      ? `<em>"They were always going to win this. Not because the dice loved them — the dice never loved anyone, I've read the logs. Because every single time there was a door marked MORE WORK and a door marked DONE, these absolute maniacs picked the first one. …Fine. Yes. I cried. It's a narration thing. Print it."</em>`
      : `<em>"You can fix a world with a hammer. It works. It genuinely works — look at it, it's fixed. You just can't ever un-hear the sound it made. …Ask me how I know. No — don't. That's Act II talk."</em>`,
    `the narrator, off the record`, "");

  Hooks.callAll("bbttcc:epic:reformation", { outcome: oc });
  log(`THE REFORMATION (${oc}).`);
  return refState();
}

// One half done, the other pending → say so, once.
async function maybeFire(source) {
  try {
    if (!isActiveGM()) return;
    const st = refState();
    if (st.done) return;
    const oc = daathOutcome();
    const board = malkuthDone();
    if (oc && board) return fireReformation(oc);
    if ((oc || board) && !st.awaitingCard) {
      await game.settings.set(MOD, "reformation", { ...st, awaitingCard: true });
      await beatCard("⏳ THE WORK AWAITS ITS OTHER HALF",
        oc
          ? `The Dragon is answered — but Malkuth is not yet whole. The Reformation holds its breath until the last hex comes home.`
          : `Malkuth stands whole — but the Dragon still waits below the aperture. The Reformation holds its breath until the party answers.`,
        `${oc ? "Dragon ✓ · Board pending" : "Board ✓ · Dragon pending"} · both halves, either order`);
    }
    if (source) log(`half-check (${source}): dragon=${oc ?? "pending"}, board=${board}.`);
  } catch (e) { warn("maybeFire failed", e); }
}

// ── Wiring — the void finally answers ───────────────────────────────────────
Hooks.on("bbttcc:ritual:answered",     ({ outcome }) => { if (outcome === "parley" || outcome === "sunder") maybeFire("ritual"); });
Hooks.on("bbttcc:epic:malkuthAligned", () => maybeFire("malkuth"));   // first listener this hook has ever had

Hooks.on("init", () => {
  if (game?.system?.id !== "fourththing") return;
  game.settings.register(MOD, "reformation",    { scope: "world", config: false, type: Object,  default: { done: false, at: null, outcome: null, awaitingCard: false } });
  game.settings.register(MOD, "ascentUnlocked", { scope: "world", config: false, type: Boolean, default: false });
});

Hooks.on("ready", () => {
  try {
    if (game.system?.id !== "fourththing") return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.reformation = {
      status: () => ({ ...refState(), dragon: daathOutcome(), board: malkuthDone(), ascent: (() => { try { return game.settings.get(MOD, "ascentUnlocked"); } catch (_e) { return false; } })() }),
      fire: (outcome = null) => {
        if (!game.user?.isGM) return null;
        return fireReformation(outcome ?? daathOutcome() ?? "parley", { forced: true });
      },
      reset: async () => {
        if (!game.user?.isGM) return null;
        await game.settings.set(MOD, "reformation", { done: false, at: null, outcome: null, awaitingCard: false });
        await game.settings.set(MOD, "ascentUnlocked", false);
        ui.notifications?.info("Reformation state cleared (rehearsal mode).");
        return refState();
      }
    };
    log("The Reformation is listening (G3 — the ending has ears).");
  } catch (e) { warn("ready error", e); }
});
