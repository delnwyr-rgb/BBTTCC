// Bad Eden — MOMENTS (2026-10-05)
//
// The cool stuff used to happen in the chat log and streak past. A "moment" is an
// on-screen event every seat sees (or the right seats see): a banked Surge, a
// faction's new Receipt, the Adversary turning its head.
//
// One authority: game.bbttcc.api.fx.moment(key, ctx, opts). The CALLING client
// resolves the audience (it knows ownership / faction membership), plays locally
// if it's in it, and broadcasts { t:"moment" } on module.bbttcc-fx-integration so
// every other listed seat plays the same thing. No GM relay needed — module
// sockets reach every client.
//
// What a moment LOOKS like lives in data/moments.json (no code to add one):
//   size     whisper  floating text by the actor's token (+ canvas ring)
//            beat     a centred title card with a tone-coloured edge glow
//            thunder  the screen dims, a hazard-framed warning flashes, shake
//   tone     surge | receipt | adversary | spark | good | bad | info  (colour-blind
//            safe: blue↔amber axis, and every tone carries its icon as a 2nd cue)
//   audience all | gm | owners (of ctx.actorUuid) | faction (members of ctx.factionId)
//   sound    "synth:<name>" (built-in WebAudio sting, no asset) or a file path
//   title / subtitle / kicker take {placeholders} from ctx.
//
// Systems never call this directly when a hook exists — integrations/moment-bridge.js
// maps hooks → moments, so the spine stays "events in, presentation out".

const MOD = "bbttcc-fx-integration";
const CHANNEL = `module.${MOD}`;
const TAG = "[bbttcc-fx/moments]";
const DATA_URL = `modules/${MOD}/data/moments.json`;

const specs = new Map();
let cardChain = Promise.resolve();
let queued = 0;
const MAX_QUEUED = 4; // a seeder replaying 30 quest closures shouldn't hold the screen for a minute

function setting(key, fallback) {
  try { return game.settings.get(MOD, key); } catch { return fallback; }
}
function on() { return !!setting("enabled", true) && !!setting("moments_enabled", true); }
function intensityMult() {
  const i = String(setting("intensity", "normal") || "normal");
  return i === "low" ? 0.75 : i === "high" ? 1.3 : 1;
}
function dur(ms) { return Math.max(60, Math.round((Number(ms) || 0) * intensityMult())); }
const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, Number(ms) || 0)));

function fill(tpl, ctx) {
  return String(tpl ?? "").replace(/\{(\w+)\}/g, (_m, k) => (ctx?.[k] ?? "") === "" ? "" : String(ctx[k]))
    .replace(/\s+—\s*$/, "").trim();
}

// ── Audience ────────────────────────────────────────────────────────────────
function actorFrom(ctx) {
  try {
    if (ctx?.actorUuid) return fromUuidSync(ctx.actorUuid);
    if (ctx?.actorId) return game.actors?.get(ctx.actorId) ?? null;
  } catch (_e) {}
  return null;
}
function ownersOf(doc) {
  if (!doc) return [];
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return (game.users?.contents ?? []).filter(u => !u.isGM && doc.testUserPermission?.(u, OWNER)).map(u => u.id);
}
// A faction's seats = whoever owns the faction actor, plus whoever owns a character
// stamped into that faction (flags.bbttcc-factions.factionId — the same membership
// test tikkun/epic use). GMs always see everything.
function factionUsers(factionId) {
  const fid = String(factionId || "").replace(/^Actor\./, "");
  if (!fid) return [];
  const ids = new Set(ownersOf(game.actors?.get(fid)));
  for (const a of game.actors?.contents ?? []) {
    if (a.type !== "character") continue;
    if (a.getFlag?.("bbttcc-factions", "factionId") !== fid) continue;
    for (const id of ownersOf(a)) ids.add(id);
  }
  return [...ids];
}
function resolveAudience(audience, ctx) {
  const gms = (game.users?.contents ?? []).filter(u => u.isGM).map(u => u.id);
  const a = String(audience || "all");
  if (a === "all") return null; // null = every seat
  if (a === "gm") return gms;
  if (a === "owners") return [...new Set([...gms, ...ownersOf(actorFrom(ctx))])];
  if (a === "faction") return [...new Set([...gms, ...factionUsers(ctx?.factionId)])];
  return null;
}

// ── Sound: built-in WebAudio stings (no assets) + file paths ───────────────
let actx = null;
function audioCtx() {
  try {
    if (!actx) actx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume().catch(() => {});
    return actx;
  } catch (_e) { return null; }
}
function envGain(ac, dest, t0, peak, attack, decay) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(dest);
  return g;
}
function tone(ac, dest, { type = "sine", f0, f1 = null, t0, attack = 0.01, decay = 0.4, peak = 0.3, detune = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + attack + decay);
  o.detune.value = detune;
  o.connect(envGain(ac, dest, t0, peak, attack, decay));
  o.start(t0);
  o.stop(t0 + attack + decay + 0.05);
}
function noise(ac, dest, { t0, attack = 0.005, decay = 0.2, peak = 0.3, type = "lowpass", freq = 1200, freq1 = null, q = 0.7 }) {
  const len = Math.ceil(ac.sampleRate * (attack + decay + 0.1));
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t0 + attack + decay);
  src.connect(f);
  f.connect(envGain(ac, dest, t0, peak, attack, decay));
  src.start(t0);
  src.stop(t0 + attack + decay + 0.1);
}
// Inharmonic bell (partials of a struck bar) — sparks, gaze tolls.
function bell(ac, dest, t0, f, peak = 0.18, decay = 1.6) {
  [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([m, a]) =>
    tone(ac, dest, { f0: f * m, t0, attack: 0.004, decay: decay / m ** 0.35, peak: peak * a }));
}

const STINGS = {
  // A little electric up-blip — frequent, so it stays small.
  "surge-tick"(ac, out, t) {
    tone(ac, out, { type: "triangle", f0: 660, f1: 1320, t0: t, attack: 0.005, decay: 0.12, peak: 0.16 });
    tone(ac, out, { type: "sine", f0: 1980, t0: t + 0.06, attack: 0.004, decay: 0.18, peak: 0.07 });
  },
  // The pool is brimming: rising arpeggio + crackle + low thump.
  "surge-full"(ac, out, t) {
    tone(ac, out, { f0: 70, f1: 45, t0: t, attack: 0.01, decay: 0.5, peak: 0.45 });
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      tone(ac, out, { type: "triangle", f0: f, t0: t + i * 0.07, attack: 0.005, decay: 0.5, peak: 0.12 }));
    noise(ac, out, { t0: t + 0.05, decay: 0.5, peak: 0.08, type: "highpass", freq: 4000 });
  },
  // Rubber stamp + till bell: paper thud, then a bright two-note ching.
  "stamp"(ac, out, t) {
    noise(ac, out, { t0: t, decay: 0.12, peak: 0.5, freq: 500 });
    tone(ac, out, { f0: 110, f1: 60, t0: t, attack: 0.003, decay: 0.14, peak: 0.35 });
    tone(ac, out, { f0: 2093, t0: t + 0.16, attack: 0.003, decay: 0.7, peak: 0.12 });
    tone(ac, out, { f0: 2637, t0: t + 0.24, attack: 0.003, decay: 0.9, peak: 0.1 });
  },
  // THE ADVERSARY: reversed swell, sub drop, a minor-second cluster grinding down.
  "adversary"(ac, out, t) {
    noise(ac, out, { t0: t, attack: 0.9, decay: 0.25, peak: 0.22, type: "bandpass", freq: 300, freq1: 2400, q: 1.2 });
    const hit = t + 1.0;
    tone(ac, out, { f0: 90, f1: 28, t0: hit, attack: 0.02, decay: 2.8, peak: 0.6 });
    noise(ac, out, { t0: hit, decay: 0.6, peak: 0.35, freq: 180 });
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(1400, hit); lp.frequency.exponentialRampToValueAtTime(220, hit + 3);
    lp.connect(out);
    [110, 116.5, 164.8, 174.6].forEach((f) =>
      tone(ac, lp, { type: "sawtooth", f0: f, f1: f * 0.94, t0: hit, attack: 0.05, decay: 3.0, peak: 0.07 }));
  },
  // The Gaze (omen-level dread): a low drone swell and one tolled bell.
  "gaze"(ac, out, t) {
    tone(ac, out, { type: "sine", f0: 55, t0: t, attack: 0.8, decay: 2.2, peak: 0.35 });
    tone(ac, out, { type: "sine", f0: 58.3, t0: t, attack: 0.8, decay: 2.2, peak: 0.25 });
    bell(ac, out, t + 0.7, 196, 0.22, 2.6);
  },
  // A spark integrates: a bright bell chord.
  "spark"(ac, out, t) {
    bell(ac, out, t, 784, 0.14, 1.8);
    bell(ac, out, t + 0.09, 988, 0.11, 1.8);
    bell(ac, out, t + 0.18, 1175, 0.1, 2.2);
  },
  // Enlightenment rises: slow shimmering fifth climbing an octave.
  "ascend"(ac, out, t) {
    [[261.6, 523.2], [392, 784]].forEach(([a, b]) => {
      tone(ac, out, { type: "sine", f0: a, f1: b, t0: t, attack: 0.6, decay: 1.4, peak: 0.12 });
      tone(ac, out, { type: "sine", f0: a, f1: b, t0: t, attack: 0.6, decay: 1.4, peak: 0.08, detune: 9 });
    });
    bell(ac, out, t + 1.1, 1046, 0.1, 1.6);
  },
  // Last Stand: two heartbeats then a low hit.
  "heartbeat"(ac, out, t) {
    [0, 0.22, 0.85, 1.07].forEach((d, i) =>
      tone(ac, out, { f0: i % 2 ? 50 : 62, f1: 38, t0: t + d, attack: 0.008, decay: 0.2, peak: 0.55 }));
    noise(ac, out, { t0: t + 1.6, decay: 0.7, peak: 0.25, freq: 220 });
  },
  // Tier up: low swell, a three-chord rising cadence, a bell on top.
  "triumph"(ac, out, t) {
    tone(ac, out, { f0: 55, f1: 82, t0: t, attack: 0.5, decay: 1.6, peak: 0.35 });
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200; lp.connect(out);
    [[262, 330, 392], [294, 370, 440], [392, 494, 587, 784]].forEach((ch, i) =>
      ch.forEach((f) => tone(ac, lp, { type: "sawtooth", f0: f, t0: t + 0.25 + i * 0.3, attack: 0.03, decay: i === 2 ? 1.6 : 0.3, peak: 0.06 })));
    bell(ac, out, t + 0.85, 1568, 0.12, 2.2);
    noise(ac, out, { t0: t + 0.85, decay: 0.9, peak: 0.06, type: "highpass", freq: 5000 });
  },
  // Quest complete: a short two-chord brass-ish cadence.
  "fanfare"(ac, out, t) {
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800; lp.connect(out);
    [[392, 494, 587], [523, 659, 784]].forEach((ch, i) =>
      ch.forEach((f) => tone(ac, lp, { type: "sawtooth", f0: f, t0: t + i * 0.28, attack: 0.03, decay: i ? 1.1 : 0.25, peak: 0.07 })));
  }
};

function playSound(sound, gain = 1) {
  if (!sound || !setting("moments_sound", true)) return;
  const vol = Math.max(0, Math.min(1, Number(setting("moments_volume", 0.7)) || 0)) * gain;
  if (vol <= 0) return;
  const s = String(sound);
  if (s.startsWith("synth:")) {
    const fn = STINGS[s.slice(6)];
    const ac = fn ? audioCtx() : null;
    if (!ac) return;
    try {
      const out = ac.createGain();
      out.gain.value = vol;
      out.connect(ac.destination);
      fn(ac, out, ac.currentTime + 0.02);
    } catch (e) { console.warn(TAG, "sting failed", s, e); }
    return;
  }
  try {
    const AH = foundry?.audio?.AudioHelper ?? globalThis.AudioHelper;
    AH?.play?.({ src: s, volume: vol, autoplay: true, loop: false }, false);
  } catch (e) { console.warn(TAG, "sound failed", s, e); }
}

// ── Rendering ───────────────────────────────────────────────────────────────
function fxRoot() { return document.getElementById("bbttcc-fx-root") || document.body; }

function tokenFor(ctx) {
  try {
    if (ctx?.tokenId) { const t = canvas?.tokens?.get?.(ctx.tokenId); if (t) return t; }
    const actor = actorFrom(ctx);
    if (!actor) return null;
    return actor.getActiveTokens?.(true, false)?.[0] ?? null;
  } catch (_e) { return null; }
}
function screenPointFor(token) {
  try {
    const c = token.center;
    const p = canvas.stage.worldTransform.apply(new PIXI.Point(c.x, c.y));
    const r = canvas.app.view.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    return { x: r.left + p.x, y: r.top + p.y - (token.h * canvas.stage.scale.y) / 2 };
  } catch (_e) { return null; }
}

const TONE_HEX = { surge: 0x45d4ff, receipt: 0xe8c84a, adversary: 0xffb020, spark: 0xbfe9ff, good: 0x4aa8ff, bad: 0xffb020, info: 0xd1d5db };

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderWhisper(spec, ctx) {
  const token = tokenFor(ctx);
  const pt = token ? screenPointFor(token) : null;
  const n = el("div", `bbttcc-moment-whisper tone-${spec.tone || "info"}`);
  n.append(el("span", "icon", spec.icon || ""), el("span", "txt", fill(spec.title, ctx)));
  if (pt) { n.style.left = `${pt.x}px`; n.style.top = `${pt.y}px`; }
  else n.classList.add("unanchored");
  fxRoot().appendChild(n);
  void n.offsetWidth; n.classList.add("show"); // reflow, not rAF — rAF stalls in a backgrounded tab
  setTimeout(() => n.remove(), dur(spec.holdMs ?? 1500) + 400);
  if (token) {
    try { game.bbttcc?.api?.fx?._engine?.canvasPulse?.(token, { color: TONE_HEX[spec.tone] ?? TONE_HEX.info, radius: 60, ms: 650, alpha: 0.22 }); } catch (_e) {}
  }
}

function buildCard(spec, ctx) {
  const card = el("div", `bbttcc-moment-card tone-${spec.tone || "info"} size-${spec.size}`);
  card.append(el("div", "icon", spec.icon || ""));
  const kicker = fill(spec.kicker, ctx);
  if (kicker) card.append(el("div", "kicker", kicker));
  card.append(el("div", "title", fill(spec.title, ctx)));
  const sub = fill(spec.subtitle, ctx);
  if (sub) card.append(el("div", "subtitle", sub));
  return card;
}

async function renderCard(spec, ctx) {
  const thunder = spec.size === "thunder";
  const hold = dur(spec.holdMs ?? (thunder ? 4200 : 2600));
  const stage = el("div", `bbttcc-moment-stage tone-${spec.tone || "info"} size-${spec.size}${spec.dim || thunder ? " dim" : ""}`);
  stage.append(el("div", "veil"), el("div", "edge"));
  if (thunder) stage.append(el("div", "hazard"));
  stage.append(buildCard(spec, ctx));
  fxRoot().appendChild(stage);
  void stage.offsetWidth; stage.classList.add("show");
  if (spec.shake) {
    setTimeout(() => {
      try { game.bbttcc?.api?.fx?._engine?.screenShake?.(spec.shake, thunder ? 420 : 260); } catch (_e) {}
    }, thunder ? 1000 : 120); // thunder shakes on the sting's hit, not its swell
  }
  await wait(hold);
  stage.classList.remove("show");
  stage.classList.add("out");
  await wait(600);
  stage.remove();
}

function play(key, ctx = {}) {
  if (!on()) return;
  const spec = specs.get(key);
  if (!spec) { console.warn(TAG, "unknown moment", key); return; }
  if (spec.size === "whisper") {
    playSound(spec.sound, spec.soundGain ?? 1);
    renderWhisper(spec, ctx);
    return;
  }
  if (queued >= MAX_QUEUED && spec.size !== "thunder") { console.log(TAG, "queue full — dropped", key); return; }
  queued++;
  cardChain = cardChain.then(async () => {
    try {
      playSound(spec.sound, spec.soundGain ?? 1);
      await renderCard(spec, ctx);
    } catch (e) { console.warn(TAG, "render failed", key, e); }
    finally { queued--; }
  });
}

// ── Public surface ──────────────────────────────────────────────────────────
// moment(key, ctx, { audience, users }) — ctx must be socket-safe (strings/numbers).
// Returns { ok, users } where users=null means everyone.
function moment(key, ctx = {}, opts = {}) {
  const spec = specs.get(key);
  if (!spec) { console.warn(TAG, "unknown moment", key); return { ok: false, reason: "unknown-key" }; }
  const safe = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    if (v == null || ["string", "number", "boolean"].includes(typeof v)) safe[k] = v;
  }
  const users = Array.isArray(opts.users) ? opts.users : resolveAudience(opts.audience ?? spec.audience, safe);
  try { game.socket?.emit?.(CHANNEL, { t: "moment", key, ctx: safe, users, from: game.user?.id }); }
  catch (e) { console.warn(TAG, "emit failed", e); }
  if (!users || users.includes(game.user?.id)) play(key, safe);
  return { ok: true, users };
}

// How long to wait after firing `key` before yanking the table elsewhere (the
// Adversary dims the screen, THEN the beat's scene loads under the veil).
function lead(key) {
  const ms = Number(specs.get(key)?.leadMs) || 0;
  return wait(ms);
}

async function loadSpecs() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    const json = await res.json();
    for (const [k, v] of Object.entries(json || {})) {
      if (k.startsWith("_")) continue;
      specs.set(k, { size: "beat", tone: "info", audience: "all", ...v });
    }
    console.log(TAG, `${specs.size} moments loaded.`);
  } catch (e) { console.warn(TAG, "could not load", DATA_URL, e); }
}

export async function installMoments(api, engine) {
  await loadSpecs();
  api._engine ??= engine;
  api.moment = moment;
  api.moments = {
    play: moment,
    lead,
    audience: resolveAudience, // ("all"|"gm"|"owners"|"faction", ctx) → userIds[] | null (= everyone)
    preview: (key, ctx = {}) => play(key, ctx), // this seat only — for tuning
    register: (key, spec) => specs.set(key, { size: "beat", tone: "info", audience: "all", ...spec }),
    get: (key) => specs.get(key) ?? null,
    keys: () => [...specs.keys()],
    stings: () => Object.keys(STINGS),
    sting: (name) => playSound(`synth:${name}`)
  };
  game.socket?.on?.(CHANNEL, (msg) => {
    try {
      if (!msg || msg.t !== "moment") return;
      if (msg.from === game.user?.id) return;
      if (Array.isArray(msg.users) && !msg.users.includes(game.user?.id)) return;
      play(msg.key, msg.ctx || {});
    } catch (e) { console.warn(TAG, "socket receive failed", e); }
  });
  // Browsers won't start audio before a gesture; warm the context on the first click.
  document.addEventListener("pointerdown", () => audioCtx(), { once: true, capture: true });
}
