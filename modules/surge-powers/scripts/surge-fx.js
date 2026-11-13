/* ─────────────────────────────────────────────────────────────────────────────
 * Surge Powers · surge-fx.js — the visual layer (Sequencer + JB2A)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every Surge spend reads on the map:
 *   • a signature burst on the spender, tinted by Path (gold for the universal table)
 *   • a body effect picked from the entry's fx descriptor: heal / ward / foe hex /
 *     ally boon / save glyph / teleport / self-cost / surge refill
 *   • ARMED riders ("your next attack…") keep a spinning ring on the token until
 *     the Table Kit consumes the one-shot flag
 *   • Path STANCES (Aurablade auras, …) keep an orbiting aura until the stance ends
 *   • banking Surge from a roll gives a small glint (a nat-20 chain a bigger one)
 *
 * Optional by design: no Sequencer, no JB2A, or the client setting off → silent
 * no-ops. Keys are resolved against Sequencer's database with colour fallbacks,
 * so a missing JB2A variant never throws.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const MOD = "surge-powers";
const TAG = "[surge-powers/fx]";

const PATH_COLOR = {
  bulwark: ["orange", "dark_orange", "yellow"],
  aurablade: ["dark_red", "red", "orange"],
  harmony: ["green", "dark_green", "blue"],
  courier: ["dark_purple", "purple", "dark_black"],
  wyrdlens: ["blue", "dark_blue", "bluepurple"],
  linguist: ["yellow", "orange", "white"],
  dreamwalker: ["purple", "bluepurple", "dark_purple"],
  soulsmith: ["orange", "dark_red", "red"],
  pactkeeper: ["dark_red", "red", "purple"],
};
const GOLD = ["yellow", "orange", "yellow02"];

const RIDER_KEYS = ["bonusDie", "advAttack", "reactionMiss", "ignoreResists", "echoStrike", "surgingCast",
  "autoSaveOnce", "doomstrike", "wrathCascade", "crowningBlow", "powerSurge", "cinderwake", "finalArgument", "absorbStrike"];

const on = () => {
  try { if (!game.settings.get(MOD, "vfx")) return false; } catch { /* unregistered → default on */ }
  return !!(game.modules.get("sequencer")?.active && globalThis.Sequence && globalThis.Sequencer?.Database);
};
const exists = (k) => { try { return !!Sequencer.Database.entryExists(k); } catch { return false; } };
/** First existing `${base}.${colour}${tail}` across the colour chain, else any colour-less base. */
function key(base, colors, tail = "") {
  for (const c of colors) { const k = `${base}.${c}${tail}`; if (exists(k)) return k; }
  for (const c of [...GOLD, "blue", "green", "purple", "white", "red"]) { const k = `${base}.${c}${tail}`; if (exists(k)) return k; }
  return exists(base) ? base : null;
}
const first = (...ks) => ks.find(exists) ?? null;
const tokenOf = (actor) => actor?.getActiveTokens?.(true)?.[0] ?? actor?.getActiveTokens?.()?.[0] ?? null;
const colorsFor = (entry) => PATH_COLOR[entry?.pathKey] ?? GOLD;

function add(seq, file, onToken, opts = {}) {
  if (!file || !onToken) return;
  const e = seq.effect().file(file).atLocation(onToken).scaleToObject(opts.scale ?? 1.6);
  if (opts.below) e.belowTokens();
  if (opts.fade !== false) e.fadeIn(150).fadeOut(250);
  if (opts.wait) e.waitUntilFinished(opts.wait);
  if (opts.duration) e.duration(opts.duration);
}

/** Play the spend: signature on the spender + a body effect per target. Called once, on the spending client
 *  (Sequencer broadcasts to every client). */
export function playSpend(actor, entry, targets = [], { failedSaves = new Set() } = {}) {
  if (!on()) return;
  try {
    const fx = entry?.fx ?? {};
    const col = colorsFor(entry);
    const me = tokenOf(actor);
    const big = (Number(entry?.cost) || 1) >= 7;
    const seq = new Sequence({ moduleName: MOD, softFail: true });

    // Signature: every spend crackles.
    add(seq, key("jb2a.particle_burst.01.circle", [col[0] === "yellow" ? "yellow" : "bluepurple", ...col]), me, { scale: big ? 2.6 : 2.0, below: true });
    if (big) add(seq, key("jb2a.static_electricity.01", col), me, { scale: 1.4 });

    const foeHex = key("jb2a.condition.curse.01.001", col);
    const boon = key("jb2a.condition.boon.01.001", col);
    for (const t of (targets ?? []).filter(Boolean)) {
      const tok = tokenOf(t);
      if (!tok) continue;
      const self = t === actor || t?.id === actor?.id;
      if (fx.heal || fx.phoenix) add(seq, key(fx.phoenix ? "jb2a.healing_generic.03.burst" : "jb2a.healing_generic.200px", fx.phoenix ? ["yellow", "orangepurple", "green"] : ["green", ...col]), tok, { scale: fx.phoenix ? 2.4 : 1.8 });
      if (fx.phoenix) add(seq, key("jb2a.sacred_flame.target", ["yellow", "white"]), tok, { scale: 2 });
      if (fx.dr || fx.acBonus || fx.resistChoice || fx.ward || fx.tempHP || fx.unbroken)
        add(seq, key("jb2a.markers.shield_rampart.complete.01", ["orange", "white", "dark_red"]) ?? key("jb2a.icon.shield", ["blue", ...col]), tok, { scale: 1.8 });
      if (fx.endCondition) add(seq, key("jb2a.healing_generic.200px", ["blue", "yellow"]), tok, { scale: 1.6 });
      if (fx.save) add(seq, failedSaves.has(t.id) ? foeHex : key("jb2a.magic_signs.rune.02.complete.01", col), tok, { scale: 1.5 });
      else if (fx.ae && !fx.stance) add(seq, ["target", "targets"].includes(fx.tgt) && !self ? foeHex : boon, tok, { scale: 1.5 });
      if (fx.arm && !self) add(seq, boon, tok, { scale: 1.4 });
    }
    if (fx.init || /step|crossing|route|door|sapphire/.test(entry?.key ?? "")) add(seq, key("jb2a.misty_step.01", col), me, { scale: 1.8 });
    if (fx.tgt === "alliesProfSq" || /^allies\d+$/.test(fx.tgt ?? "")) add(seq, first("jb2a.extras.tmfx.outpulse.circle.01.normal") ?? key("jb2a.impact.ground_crack.01", col), me, { scale: 3, below: true });
    if (fx.selfDamage) add(seq, key("jb2a.impact.001", ["dark_red", "red"]), me, { scale: 1.4 });
    if (fx.gainSurge || fx.fillSurge) add(seq, key("jb2a.twinkling_stars.points04", ["orange", "white"]), me, { scale: 1.8 });
    if (fx.oneShot || fx.arm) add(seq, key("jb2a.energy_strands.in", col, ".01"), me, { scale: 1.8 });
    seq.play();
  } catch (e) { console.warn(TAG, "spend fx failed", e); }
}

/** Banked Surge from a roll: a glint; 2+ at once (nat-20 chains) a starburst. */
export function playBank(actor, n = 1) {
  if (!on()) return;
  try {
    const tok = tokenOf(actor);
    if (!tok) return;
    const seq = new Sequence({ moduleName: MOD, softFail: true });
    add(seq, n >= 2 ? key("jb2a.particle_burst.01.star", GOLD) : key("jb2a.glint", ["yellow", "orange", "blue"], ".few"), tok, { scale: n >= 2 ? 2.2 : 1.3 });
    seq.play();
  } catch (e) { console.warn(TAG, "bank fx failed", e); }
}


/* ── The ping + above-head pop (ported from Bad Eden's surge_banked / surge_full moments) ──
 * Every seat hears a WebAudio sting (no sound assets) and sees floating text over the
 * token with a ring pulse. Sent once over the module socket by the client that banked
 * or spent; bursts (exploding nat-20s) coalesce into one "+N". */
const SOCKET = `module.${MOD}`;
let actx = null;
function audioCtx() {
  try {
    if (!actx) actx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume().catch(() => {});
    return actx;
  } catch { return null; }
}
function envGain(ac, dest, t0, peak, attack, decay) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(dest);
  return g;
}
function tone(ac, dest, { type = "sine", f0, f1 = null, t0, attack = 0.01, decay = 0.4, peak = 0.3 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + attack + decay);
  o.connect(envGain(ac, dest, t0, peak, attack, decay));
  o.start(t0); o.stop(t0 + attack + decay + 0.05);
}
function noise(ac, dest, { t0, attack = 0.005, decay = 0.2, peak = 0.3, type = "lowpass", freq = 1200 }) {
  const len = Math.ceil(ac.sampleRate * (attack + decay + 0.1));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  src.connect(f); f.connect(envGain(ac, dest, t0, peak, attack, decay));
  src.start(t0); src.stop(t0 + attack + decay + 0.1);
}
const STINGS = {
  // the ping: a little electric up-blip
  tick(ac, out, t) {
    tone(ac, out, { type: "triangle", f0: 660, f1: 1320, t0: t, attack: 0.005, decay: 0.12, peak: 0.16 });
    tone(ac, out, { type: "sine", f0: 1980, t0: t + 0.06, attack: 0.004, decay: 0.18, peak: 0.07 });
  },
  // the pool is brimming: rising arpeggio + crackle + low thump
  full(ac, out, t) {
    tone(ac, out, { f0: 70, f1: 45, t0: t, attack: 0.01, decay: 0.5, peak: 0.45 });
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ac, out, { type: "triangle", f0: f, t0: t + i * 0.07, attack: 0.005, decay: 0.5, peak: 0.12 }));
    noise(ac, out, { t0: t + 0.05, decay: 0.5, peak: 0.08, type: "highpass", freq: 4000 });
  },
  // a spend: the charge leaving — a falling zap over a thump
  spend(ac, out, t) {
    tone(ac, out, { f0: 90, f1: 50, t0: t, attack: 0.005, decay: 0.25, peak: 0.35 });
    tone(ac, out, { type: "sawtooth", f0: 1760, f1: 440, t0: t, attack: 0.004, decay: 0.22, peak: 0.06 });
    noise(ac, out, { t0: t, decay: 0.18, peak: 0.07, type: "highpass", freq: 3000 });
  },
};
function playSting(name) {
  try { if (!game.settings.get(MOD, "sound")) return; } catch { /* default on */ }
  let vol = 0.7; try { vol = Number(game.settings.get(MOD, "volume")); } catch { /* */ }
  const fn = STINGS[name], ac = fn && vol > 0 ? audioCtx() : null;
  if (!ac) return;
  try { const out = ac.createGain(); out.gain.value = Math.min(1, vol); out.connect(ac.destination); fn(ac, out, ac.currentTime + 0.02); }
  catch (e) { console.warn(TAG, "sting failed", name, e); }
}
let styled = false;
function ensureStyle() {
  if (styled) return; styled = true;
  const st = document.createElement("style");
  st.textContent = `
.surge-pop{position:fixed;transform:translate(-50%,0) scale(.8);opacity:0;z-index:100002;pointer-events:none;display:flex;align-items:center;gap:6px;
 font:900 20px/1 "Signika",Arial,sans-serif;letter-spacing:.06em;color:#fff;--m:#45d4ff;
 text-shadow:0 0 8px var(--m),0 0 18px var(--m),0 2px 4px #000;transition:transform 1.4s cubic-bezier(.2,.8,.2,1),opacity .25s ease;white-space:nowrap}
.surge-pop .i{font-size:22px;filter:drop-shadow(0 0 6px var(--m))}
.surge-pop.full{font-size:26px;--m:#ffcf4a}.surge-pop.full .i{font-size:28px}
.surge-pop.spend{font-size:17px;--m:#ffb347}
.surge-pop.show{opacity:1;transform:translate(-50%,-46px) scale(1);animation:surge-pop-out 1.9s ease forwards}
.surge-pop.full.show{animation-duration:2.6s}
.surge-pop.unanchored{left:50%;top:22%}
@keyframes surge-pop-out{0%,70%{opacity:1}100%{opacity:0}}`;
  document.head.appendChild(st);
}
function screenPoint(token) {
  try {
    const c = token.center;
    const p = canvas.stage.worldTransform.apply(new PIXI.Point(c.x, c.y));
    const r = canvas.app.view.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return { x: r.left + p.x, y: r.top + p.y - (token.h * canvas.stage.scale.y) / 2 };
  } catch { return null; }
}
function ringPulse(token, color, big) {
  try {
    const g = new PIXI.Graphics();
    const r0 = Math.max(token.w, token.h) * 0.55, r1 = r0 * (big ? 2.1 : 1.6);
    g.position.set(token.center.x, token.center.y);
    (canvas.interface ?? canvas.stage).addChild(g);
    const t0 = performance.now(), ms = big ? 900 : 650;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      g.clear(); g.lineStyle(big ? 6 : 4, color, 0.6 * (1 - k)); g.drawCircle(0, 0, r0 + (r1 - r0) * k);
      if (k < 1 && !g.destroyed) requestAnimationFrame(step); else g.destroy();
    };
    step();
  } catch { /* canvas not ready */ }
}
function renderPop(msg) {
  try {
    const actor = game.actors.get(msg.actorId);
    const token = (msg.tokenId && canvas?.tokens?.get?.(msg.tokenId)) || actor?.getActiveTokens?.(true)?.[0] || null;
    ensureStyle();
    const n = document.createElement("div");
    n.className = `surge-pop ${msg.kind}`;
    const i = document.createElement("span"); i.className = "i"; i.textContent = "⚡";
    const t = document.createElement("span"); t.textContent = String(msg.text ?? "").slice(0, 60);
    n.append(i, t);
    const pt = token ? screenPoint(token) : null;
    if (pt) { n.style.left = `${pt.x}px`; n.style.top = `${pt.y}px`; } else n.classList.add("unanchored");
    document.body.appendChild(n);
    void n.offsetWidth; n.classList.add("show");
    setTimeout(() => n.remove(), msg.kind === "full" ? 3000 : 2300);
    if (token) ringPulse(token, msg.kind === "full" ? 0xffcf4a : msg.kind === "spend" ? 0xffb347 : 0x45d4ff, msg.kind === "full");
    playSting(msg.kind === "full" ? "full" : msg.kind === "spend" ? "spend" : "tick");
  } catch (e) { console.warn(TAG, "pop failed", e); }
}
// On a Bad Eden D&D world, bbttcc-fx-integration already turns Surge into RFI MOMENTS (bad-eden-5e emits
// fourththing.surgeBanked from surgePowers.banked) — defer to it so nobody hears two pings.
const rfiMoments = () => !!(game.modules.get("bbttcc-fx-integration")?.active && game.bbttcc?.api?.fx?.moments);
export function pop(actor, kind, text) {
  if (!actor) return;
  if (rfiMoments()) {
    if (kind === "spend") {
      try {
        Hooks.callAll("fourththing.surgeSpent", { actorId: actor.id, actorUuid: actor.uuid, actorName: actor.name,
          tokenId: actor.getActiveTokens?.(true)?.[0]?.id ?? null, cost: null, label: String(text ?? "").slice(0, 60) });
      } catch { /* */ }
    }
    return;   // bank / full: the RFI surge_banked / surge_full moments already fire
  }
  const msg = { type: "pop", actorId: actor.id, tokenId: actor.getActiveTokens?.(true)?.[0]?.id ?? null, kind, text };
  renderPop(msg);
  try { game.socket.emit(SOCKET, msg); } catch { /* offline */ }
}
const burst = new Map();
function bankPop(actor, n) {
  const b = burst.get(actor.id) ?? { n: 0, timer: null };
  b.n += Number(n) || 0;
  clearTimeout(b.timer);
  b.timer = setTimeout(() => {
    burst.delete(actor.id);
    const sp = game.surgePowers;
    const value = Number(sp?.get?.(actor)) || 0, cap = Number(sp?.max?.(actor)) || 0;
    pop(actor, "bank", `+${b.n} SURGE`);
    playBank(actor, b.n);
    if (cap > 0 && value >= cap) setTimeout(() => pop(actor, "full", `SURGE FULL ${value}/${cap}`), 500);
  }, 450);
  burst.set(actor.id, b);
}

/* ── Persistent glows: armed riders + Path stances ───────────────────────────
 * Owned by ONE client: the first active non-GM owner of the actor, else the
 * Surge runtime's GM leader window — so two GM windows never double-attach. */
function steward(actor) {
  const players = game.users.filter(u => u.active && !u.isGM && actor.testUserPermission?.(u, "OWNER"));
  if (players.length) return players.sort((a, b) => a.id.localeCompare(b.id))[0].id === game.user.id;
  if (!game.user.isGM) return false;
  return typeof game.surgePowers?.isLeader === "function" ? !!game.surgePowers.isLeader() : game.users.activeGM?.isSelf;
}
const armedName = (actor) => `surge-armed-${actor.id}`;
const stanceName = (actor) => `surge-stance-${actor.id}`;
const hasFx = (name) => { try { return Sequencer.EffectManager.getEffects({ name }).length > 0; } catch { return false; } };
const endFx = (name) => { try { Sequencer.EffectManager.endEffects({ name }); } catch { /* none */ } };

function syncArmed(actor) {
  if (!on() || !actor || !steward(actor)) return;
  const tok = tokenOf(actor);
  const shots = actor.flags?.[MOD]?.oneShot ?? {};
  const armed = RIDER_KEYS.some(k => shots[k] === true);
  const name = armedName(actor);
  if (!armed || !tok) { if (hasFx(name)) endFx(name); return; }
  if (hasFx(name)) return;
  const file = key("jb2a.token_border.circle.spinning", ["orange", "yellow", "blue"], ".001");
  if (!file) return;
  new Sequence({ moduleName: MOD, softFail: true }).effect().file(file).name(name).attachTo(tok).scaleToObject(1.7)
    .belowTokens().persist().fadeIn(300).fadeOut(400).opacity(0.85).play();
}

function syncStance(actor) {
  if (!on() || !actor || !steward(actor)) return;
  const tok = tokenOf(actor);
  const stance = actor.effects?.find?.(e => e.flags?.[MOD]?.stance && !e.disabled);
  const name = stanceName(actor);
  const want = stance ? `${name}-${stance.id}` : null;
  let current = [];
  try { current = Sequencer.EffectManager.getEffects({ object: tok ?? undefined }).map(e => e.data?.name).filter(n => n?.startsWith(name)); } catch { /* */ }
  for (const n of current) if (n !== want) endFx(n);
  if (!want || !tok || current.includes(want)) return;
  const col = PATH_COLOR[stance.flags[MOD].pathKey] ?? GOLD;
  const file = key("jb2a.aura_themed.01.orbit.loop.metal.01", col) ?? key("jb2a.aura_themed.01.orbit.loop.cold.01", col);
  if (!file) return;
  new Sequence({ moduleName: MOD, softFail: true }).effect().file(file).name(want).attachTo(tok).scaleToObject(2.2)
    .belowTokens().persist().fadeIn(400).fadeOut(400).opacity(0.75).play();
}

export function activateFx() {
  Hooks.once("init", () => {
    game.settings.register(MOD, "vfx", {
      name: "Surge visual effects",
      hint: "Play JB2A animations (via Sequencer) for Surge spends, armed riders, Path stances and banked Surge. Needs Sequencer + JB2A.",
      scope: "client", config: true, type: Boolean, default: true,
    });
    game.settings.register(MOD, "sound", {
      name: "Surge sounds",
      hint: "The ping when Surge banks, the sting when a pool fills, and the zap when Surge is spent (built-in synth, no files).",
      scope: "client", config: true, type: Boolean, default: true,
    });
    game.settings.register(MOD, "volume", {
      name: "Surge sound volume", scope: "client", config: true, type: Number, default: 0.7,
      range: { min: 0, max: 1, step: 0.05 },
    });
  });
  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    Hooks.on("updateActor", (actor, diff) => { if (foundry.utils.hasProperty(diff, `flags.${MOD}.oneShot`)) syncArmed(actor); });
    const stanceHook = (eff) => { const a = eff?.parent; if (a?.documentName === "Actor" && (eff.flags?.[MOD]?.stance)) syncStance(a); };
    Hooks.on("createActiveEffect", stanceHook);
    Hooks.on("deleteActiveEffect", stanceHook);
    Hooks.on("updateActiveEffect", stanceHook);
    // A scene change / reload drops persistent effects' anchors — re-sync once the canvas is up.
    Hooks.on("canvasReady", () => { for (const t of canvas.tokens?.placeables ?? []) if (t.actor?.type === "character") { syncArmed(t.actor); syncStance(t.actor); } });
    // grant() fires this hook only on the client that banked (the roller, or the leader for combat ticks).
    Hooks.on("surgePowers.banked", (actor, n) => { if (actor) bankPop(actor, n); });
    game.socket.on(SOCKET, (msg) => { if (msg?.type === "pop") renderPop(msg); });
    game.surgePowers = Object.assign(game.surgePowers || {}, { fx: { playSpend, playBank, pop, syncArmed, syncStance } });
    console.log(TAG, "Surge VFX ready", on() ? "(Sequencer on)" : "(Sequencer/JB2A absent — silent)");
  });
}
activateFx();
