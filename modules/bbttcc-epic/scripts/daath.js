// Bad Eden — Epic G1: THE THRESHOLD (Descent Engine) — 2026-09-03
// ─────────────────────────────────────────────────────────────────────────────
// The Ten Lamps and the door at Daath (DESCENT_ENGINE_SPEC Part III, owner
// rulings 2026-09-02: Ten Lamps = each of the 10 sephirot holding ≥1
// INTEGRATED spark on the canonical board; the confrontation is a deliberate
// journey to a dedicated Daath scene; board health scales difficulty, never
// gates; a Threshold-band steward may knock EARLY through the dark door).
//
// G1 ships: lamp detection + per-lamp announcements, the gate opening (the
// long-dormant `egoDragonWarning` prophecy finally fires true), the knock
// verb (standard + dark door), and the Daath scene binding. The Final Ritual
// engine itself is G2 — until it lands, a risen Dragon is run at the table
// (the knock card says so).
//
// Authority: world setting `bbttcc-epic.daath`
//   { opened, openedAt, lampsLit: [sephirah…], risen, darkDoor, outcome }
// plus `bbttcc-epic.daathSceneId` (the bound Daath scene).
// Emits: bbttcc:epic:lampLit {sephirah, count} · bbttcc:epic:daathOpened
//        {lamps} · bbttcc:dragon:risen {darkDoor, lamps} — consumers: this
//        file's cards, adversary.js (dragon-omen overlay), fx/Turn Press/
//        campaign director (future), G2's ritual engine.
// Single writer = active GM (house reconciler pattern).
// ─────────────────────────────────────────────────────────────────────────────

const MOD = "bbttcc-epic";
const TER = "bbttcc-territory";
const TAG = "[bbttcc-epic/daath]";
const log  = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

const SEPHIROT = ["keter", "chokmah", "binah", "chesed", "gevurah", "tiferet", "netzach", "hod", "yesod", "malkuth"];
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

function isHexDoc(d) {
  const tf = d?.flags?.[TER];
  return tf?.isHex === true || tf?.kind === "territory-hex";
}

// Lamps are DERIVED, never stored (spec §4) — the setting only remembers
// which ones have already been ANNOUNCED.
function lampsNow() {
  const seph = new Set();
  const all = game.scenes?.contents ?? [];
  const marked = all.filter(sc => sc.getFlag?.(MOD, "boardScene") === true);
  for (const sc of (marked.length ? marked : all)) {
    for (const d of sc.drawings ?? []) {
      if (!isHexDoc(d)) continue;
      const s = d.flags?.[TER]?.spark;
      if (s?.state !== "integrated") continue;
      const m = /^spark_([a-z]+)_/.exec(String(s.key || ""));
      if (m && SEPHIROT.includes(m[1])) seph.add(m[1]);
    }
  }
  return [...seph];
}

function daathState() {
  const s = game.settings.get(MOD, "daath");
  return (s && typeof s === "object")
    ? { opened: false, openedAt: null, lampsLit: [], risen: false, darkDoor: false, outcome: null, ...s }
    : { opened: false, openedAt: null, lampsLit: [], risen: false, darkDoor: false, outcome: null };
}

async function beatCard(title, body, foot) {
  await ChatMessage.create({
    content: `<div class="bbttcc-epic-beat is-keter">
      <div class="bbttcc-epic-beat-title">${title}</div>
      <div class="bbttcc-epic-beat-body">${body}</div>
      ${foot ? `<div class="bbttcc-epic-beat-foot">${foot}</div>` : ""}
    </div>`
  }).catch(() => {});
}
async function gmCard(html) {
  const gm = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
  await ChatMessage.create({ content: `<p style="font-size:0.78rem">${html}</p>`, whisper: gm }).catch(() => {});
}

// ── Lamp watch (debounced; single writer = active GM) ───────────────────────
let _checkTimer = null;
function queueLampCheck(reason) {
  if (_checkTimer) return;
  _checkTimer = setTimeout(() => { _checkTimer = null; checkLamps(reason); }, 250);
}

async function checkLamps(reason = "manual") {
  try {
    if (!game.user?.isGM) return;
    const activeGM = game.users?.activeGM;
    if (activeGM && !activeGM.isSelf) return;

    const lit = lampsNow();
    const state = daathState();
    const fresh = lit.filter(s => !state.lampsLit.includes(s));

    for (const seph of fresh) {
      const count = state.lampsLit.length + fresh.indexOf(seph) + 1;
      await beatCard("✦ A LAMP IS LIT",
        `The spark of <b>${cap(seph)}</b> stands integrated — a temple holds its ground. <em>${count} of ten lamps burn.</em>`,
        `Lamp ${count}/10 · Bad Eden — The Great Work`);
      Hooks.callAll("bbttcc:epic:lampLit", { sephirah: seph, count });
    }

    let next = { ...state, lampsLit: [...new Set([...state.lampsLit, ...lit])] };

    if (lit.length >= SEPHIROT.length && !state.opened) {
      next = { ...next, opened: true, openedAt: Date.now() };
      // The prophecy string has waited in lang/en.json since v1. It fires true.
      const prophecy = game.i18n?.localize?.("bbttcc-tikkun.notifications.egoDragonWarning");
      const line = (prophecy && !String(prophecy).startsWith("bbttcc-tikkun."))
        ? prophecy
        : "When the last light is gathered, the Ego-Dragon shall rise for the ultimate confrontation...";
      await beatCard("🐉 THE TEN LAMPS BURN — DAATH OPENS",
        `<em>${line}</em><br/>The aperture stands open in the valley of the shadow. The confrontation is not forced — it is <b>chosen</b>: make the journey, and knock.`,
        `All ten sephirot hold integrated sparks · The Threshold · Bad Eden — Epic Play`);
      await gmCard(`🐉 <b>DAATH IS OPEN.</b> Bind the Daath scene (<code>game.fourththing.epic.daath.bindScene(sceneId)</code>) if you haven't; the party knocks via <code>game.fourththing.epic.daath.knock()</code>. World-Health scales the ritual's difficulty (Ruling 3) — it does not gate the door. Final Ritual engine arrives with G2; until then a risen Dragon is played at the table.`);
      Hooks.callAll("bbttcc:epic:daathOpened", { lamps: lit });
      log("DAATH OPENED —", lit.join(", "));
    }

    if (JSON.stringify(next) !== JSON.stringify(state)) {
      await game.settings.set(MOD, "daath", next);
    }
    if (reason !== "turn" && fresh.length) log(`lamps: ${lit.length}/10 (${reason})`);
  } catch (e) { warn("lamp check failed", e); }
}

// ── The knock (standard through the open gate; early through the dark door) ─
async function knock(actorOrId = null) {
  try {
    if (!game.user?.isGM) { ui.notifications?.warn("The knock is played at the table — your GM performs it."); return null; }
    const state = daathState();
    if (state.risen) { ui.notifications?.info("The Dragon has already risen."); return state; }

    const actor = typeof actorOrId === "string" ? game.actors?.get(actorOrId) : actorOrId;

    if (!state.opened) {
      // The dark door (Ruling: a Threshold-band steward may knock alone, early).
      const mayKnock = !!(actor && game.fourththing?.darknessBite?.(actor)?.mayKnock);
      if (!mayKnock) {
        ui.notifications?.warn("The door is not open. Light the ten lamps — or come back when one of you stands at the Threshold (Darkness 10) and dares to knock alone.");
        return state;
      }
      const next = { ...state, risen: true, darkDoor: true };
      await game.settings.set(MOD, "daath", next);
      await beatCard("🐉 THE DARK DOOR",
        `<b>${actor.name}</b> did not wait for the lamps. At Darkness ten, the aperture knows its own, and it opens <em>inward</em>. The Dragon rises early — on its terms, in the dark, for one caller.`,
        `The dark door · ${daathState().lampsLit.length}/10 lamps · this is worse`);
      await gmCard(`🐉 <b>DARK DOOR RISE</b> — ${actor.name} knocked at Threshold band. Run the confrontation harsher: no unlit Lamp lends its instrument, and the party may not be present. (G2 ritual engine will formalize; today the table decides.)`);
      Hooks.callAll("bbttcc:dragon:risen", { darkDoor: true, lamps: state.lampsLit });
      await activateDaathScene();
      return next;
    }

    const next = { ...state, risen: true, darkDoor: false };
    await game.settings.set(MOD, "daath", next);
    const wh = (() => { try { return Number(game.fourththing?.epic?.worldHealth?.()?.pct ?? 0) || 0; } catch (_e) { return 0; } })();
    await beatCard("🐉 THE DRAGON RISES",
      `The party stands at Daath and knocks. What answers is not a stranger: it is every fear the road collected, wearing teeth. <em>The last enemy was always traveling with you.</em>`,
      `Ten lamps burn · World-Health ${wh}% shapes the crossing · Bad Eden — The Great Work`);
    await gmCard(`🐉 <b>THE DRAGON HAS RISEN.</b> Ten spark instruments are available (one per Lamp). The Chain station reads each steward's un-faced fragments as attacks — check ledgers now. PARLEY requires every present steward's fragments faced (Ruling 2). G2's ritual engine will run the stations; until it lands, play them by the spec.`);
    Hooks.callAll("bbttcc:dragon:risen", { darkDoor: false, lamps: state.lampsLit });
    await activateDaathScene();
    return next;
  } catch (e) { warn("knock failed", e); return null; }
}

async function activateDaathScene() {
  try {
    const id = game.settings.get(MOD, "daathSceneId");
    const scene = id ? game.scenes?.get(id) : null;
    if (scene) await scene.activate();
    else await gmCard("⚠ No Daath scene bound — <code>game.fourththing.epic.daath.bindScene(sceneId)</code> when the place is built.");
  } catch (_e) {}
}

async function bindScene(sceneId) {
  if (!game.user?.isGM) return null;
  const scene = game.scenes?.get(String(sceneId));
  if (!scene) { ui.notifications?.warn(`No scene with id ${sceneId}.`); return null; }
  await game.settings.set(MOD, "daathSceneId", scene.id);
  ui.notifications?.info(`Daath bound to scene "${scene.name}".`);
  return scene.id;
}

function status() {
  const state = daathState();
  const lit = lampsNow();
  return {
    ...state,
    lampsNow: lit,
    lampsCount: lit.length,
    sceneBound: (() => { try { return game.scenes?.get(game.settings.get(MOD, "daathSceneId"))?.name ?? null; } catch (_e) { return null; } })()
  };
}

// ── Wiring ──────────────────────────────────────────────────────────────────
Hooks.on("init", () => {
  if (game?.system?.id !== "fourththing") return;
  game.settings.register(MOD, "daath",        { scope: "world", config: false, type: Object, default: { opened: false, openedAt: null, lampsLit: [], risen: false, darkDoor: false, outcome: null } });
  game.settings.register(MOD, "daathSceneId", { scope: "world", config: false, type: String, default: "" });
});

Hooks.on("bbttcc:spark:hexIntegrated", () => queueLampCheck("integration"));
Hooks.on("bbttcc:advanceTurn:end", (p) => { if (p?.apply) queueLampCheck("turn"); });

Hooks.on("ready", () => {
  try {
    if (game.system?.id !== "fourththing") return;
    game.fourththing = game.fourththing || {};
    game.fourththing.epic = game.fourththing.epic || {};
    game.fourththing.epic.daath = { status, knock, bindScene, check: () => checkLamps("manual") };
    log("The Threshold is wired (G1: lamps, gate, knock, dark door).");
  } catch (e) { warn("ready error", e); }
});
