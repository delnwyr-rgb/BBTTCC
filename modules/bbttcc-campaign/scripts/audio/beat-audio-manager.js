// modules/bbttcc-campaign/scripts/audio/beat-audio-manager.js
try { console.log("[bbttcc-audio][manager] module top-level executing"); } catch (_e) {}
//
// Phase 1 — Event-sourced BeatAudioManager singleton.
// Phase 2 — Preload-on-edit + gesture-primed AudioContext resume.
//
// Owns all beat-audio state (current Sound, src, play token, inflight promise)
// and is the ONLY place that should call AudioHelper.play / Sound#stop.
// Other code reaches the manager via globalThis.__bbttccBeatAudioManager and
// the game.bbttcc.api.campaign.audio facade installed in module.js.
//
// Structural dedupe (not a heuristic): a second playForBeat for the same
// beat.id while a play is in flight, OR within DEDUPE_MS of the prior start,
// returns the existing promise/Sound without re-firing. This kills the
// autoplay + manual-click double-fire by construction.
//
// Preload (Phase 2): manager.preload(src) warms the Foundry sound cache on
// file-picker pick and on beat-editor render. Kills the "first Play is silent"
// cold-cache race. Uses foundry.audio.AudioHelper.preloadSound with a
// Sound#load fallback. Results tracked in _preloadedSrcs so repeats are cheap.
//
// Gesture prime (Phase 2): one-time document-level pointerdown (capture,
// once) resumes music/environment/interface AudioContexts on the first user
// interaction so that any later AH.play (including autoplay) is already unlocked.

const MOD_ID = "bbttcc-campaign";
const BEAT_AUDIO_SOCKET = `module.${MOD_ID}`;
const DEDUPE_MS = 300;
const TAG = "[bbttcc-audio][manager]";

function _log(...args) { try { console.log(TAG, ...args); } catch (_e) {} }
function _warn(...args) { try { console.warn(TAG, ...args); } catch (_e) {} }

function _audioDebug(tag, payload) {
  let on = false;
  try { on = !!game?.settings?.get?.(MOD_ID, "audio.debug"); } catch (_e) {}
  if (!on) return;
  try {
    const m = globalThis.__bbttccBeatAudioManager;
    const meta = {
      t: Date.now(),
      isGM: !!game?.user?.isGM,
      token: m ? m.playToken : 0,
      srcNow: m ? (m.currentSrc || null) : null
    };
    console.log("[bbttcc-audio]", tag, { ...meta, ...(payload || {}) });
  } catch (_e) {}
}

function _normalizeAudioSrc(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  try { return decodeURIComponent(raw); } catch (_e) { return raw; }
}

function _ctxStateSnapshot() {
  try {
    const g = game?.audio || {};
    return {
      music: g.music?.state || null,
      environment: g.environment?.state || null,
      interface: g.interface?.state || null
    };
  } catch (_e) { return { music: null, environment: null, interface: null }; }
}

async function _resumeAudioContext() {
  const before = _ctxStateSnapshot();
  try {
    const g = game?.audio || {};
    const candidates = [g.music, g.environment, g.interface, g.context].filter(
      c => c && typeof c.resume === "function"
    );
    for (const ctx of candidates) {
      try { if (ctx.state === "suspended") await ctx.resume(); } catch (_e) {}
    }
  } catch (_e) {}
  const after = _ctxStateSnapshot();
  if (before.music !== after.music || before.environment !== after.environment || before.interface !== after.interface) {
    try {
      const on = !!game?.settings?.get?.(MOD_ID, "audio.debug");
      if (on) console.log("[bbttcc-audio] resumeAudioContext", { before, after });
    } catch (_e) {}
  }
}

// Start a session-long silent keepalive through the music context so the
// hardware output device stays awake. Without this, CoreAudio / the default
// output device sleeps between gesture-prime and the user's first real
// Play click, and the first mp3 eats 0.5–2s of wake-up latency even though
// the buffer is decoded and Sound.playing=true. A zero-gain ConstantSourceNode
// → GainNode(0) → destination pipeline keeps the device active for ~0 CPU.
// Idempotent: once _keepaliveHandle is set, re-entry is a no-op.
//
// Note: we do NOT gate on `ctx.state === "running"`. Browsers transition
// state from "suspended" to "running" asynchronously after resume() resolves,
// so checking synchronously here races. Creating nodes + source.start(0) on
// a not-yet-running context is safe; the source will produce samples as soon
// as the context reaches "running". The only hard gates are `ctx exists` and
// `createGain is available`.
function _startKeepalive(mgr) {
  try {
    if (mgr._keepaliveHandle) return true;
    const g = game?.audio || {};
    const ctx = g.music || g.environment || g.interface || g.context || null;
    if (!ctx) return false;
    if (typeof ctx.createGain !== "function") return false;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    // Prefer ConstantSourceNode (runs forever, sample-accurate).
    // Fall back to a 10-minute silent AudioBufferSource loop if unavailable.
    let source = null;
    try {
      if (typeof ctx.createConstantSource === "function") {
        source = ctx.createConstantSource();
        source.offset.value = 0;
      } else if (typeof ctx.createBufferSource === "function" && typeof ctx.createBuffer === "function") {
        const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 600)), ctx.sampleRate);
        source = ctx.createBufferSource();
        source.buffer = buf;
        source.loop = true;
      }
    } catch (_eSrc) { source = null; }
    if (!source) return false;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    mgr._keepaliveHandle = { source, gain, ctx, ctxStateAtStart: ctx.state };
    return true;
  } catch (_e) { return false; }
}

function _stopKeepalive(mgr) {
  try {
    const h = mgr._keepaliveHandle;
    if (!h) return;
    try { h.source.stop?.(0); } catch (_eS) {}
    try { h.source.disconnect?.(); } catch (_eDs) {}
    try { h.gain.disconnect?.(); } catch (_eDg) {}
  } catch (_e) {}
  mgr._keepaliveHandle = null;
}

// Poll _startKeepalive until it succeeds or maxWaitMs elapses. Used both
// from gesture-prime (long window) and from _playCore (short window before
// a real play). Returns true if keepalive is running by the time this
// resolves, false on timeout. Also resumes audio contexts defensively on
// each attempt, since state can transition lazily.
async function _ensureKeepalive(mgr, maxWaitMs = 3000, intervalMs = 100) {
  if (mgr._keepaliveHandle) return true;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try { await _resumeAudioContext(); } catch (_e) {}
    if (_startKeepalive(mgr)) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return !!mgr._keepaliveHandle;
}

function _stopOneSound(sound) {
  try {
    if (!sound) return Promise.resolve();
    if (typeof sound.stop === "function") {
      return Promise.resolve(sound.stop({ fade: 0 })).catch(() => {
        try { return sound.stop(); } catch (_e) {}
      });
    }
    if (typeof sound.fade === "function") {
      return Promise.resolve(sound.fade(0, { duration: 0 })).catch(() => {});
    }
  } catch (_e) {}
  return Promise.resolve();
}

class BeatAudioManager {
  constructor() {
    this.currentBeatId = null;
    this.currentSound = null;
    this.currentSrc = "";
    this.playToken = 0;
    this.startedAt = 0;
    this.lastTrigger = null;
    this.lastBeatId = null;
    this.lastPlayStartedAt = 0;
    this.inflightPromise = null;
    this._listeners = new Map();
    this._initialized = false;
    this._preloadedSrcs = new Set();
    this._preloadInflight = new Map();
    this._gesturePrimed = false;
    this._gestureHandler = null;
    this._keepaliveHandle = null;
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;
    try {
      const sock = game?.socket;
      if (sock && typeof sock.on === "function") {
        sock.on(BEAT_AUDIO_SOCKET, (msg) => {
          try {
            if (!msg || msg.type !== "bbttccBeatAudio") return;
            _audioDebug("socket:recv", { action: msg.action || null, src: msg.src || null });
            if (String(msg.action || "") === "stop") {
              this.stopAll({ caller: "socket", srcHint: msg.src || "" });
            }
          } catch (e) {
            _warn("Socket handler failed:", e);
          }
        });
        _log("Socket listener installed.");
      }
    } catch (_e) {}
    this._installGesturePrime();
    this._installGlobalStopDelegation();
  }

  // Install a single document-level click listener that catches any click
  // on a .bbttcc-beat-audio-stop button, no matter where it lives or how
  // many times its parent dialog re-renders. This replaces the fragile
  // per-dialog $el binding in _runBeatDialog's setTimeout. Safe against
  // multiple init calls — globalThis flag makes it truly one-time.
  _installGlobalStopDelegation() {
    try {
      if (globalThis.__bbttccBeatAudioStopDelegationInstalled) return;
      globalThis.__bbttccBeatAudioStopDelegationInstalled = true;
      const doc = globalThis?.document;
      if (!doc || typeof doc.addEventListener !== "function") return;
      doc.addEventListener("click", (ev) => {
        try {
          const btn = ev.target?.closest?.(".bbttcc-beat-audio-stop");
          if (!btn) return;
          ev.preventDefault();
          _audioDebug("doc:stop-click", {});
          this.stopAll({ caller: "doc-stop-click", push: true }).catch(() => {});
        } catch (_eH) {}
      }, { capture: false });
      _log("Document-level stop delegation installed.");
    } catch (_e) {}
  }

  // Attach a one-time, capture-phase pointerdown listener. The first user
  // interaction resumes all AudioContexts and self-removes — so later
  // AH.play calls (including autoplay) start with an unlocked context.
  // Safe to call repeatedly; no-ops once primed or once armed.
  _installGesturePrime() {
    if (this._gesturePrimed || this._gestureHandler) return;
    try {
      const target = globalThis?.document;
      if (!target || typeof target.addEventListener !== "function") return;
      const handler = async () => {
        if (this._gesturePrimed) return;
        this._gesturePrimed = true;
        _audioDebug("manager:gesture-prime:fire", {});
        await _resumeAudioContext();
        const keepaliveImmediate = _startKeepalive(this);
        _audioDebug("manager:gesture-prime:done", { keepalive: keepaliveImmediate, ctx: _ctxStateSnapshot() });
        try { target.removeEventListener("pointerdown", handler, true); } catch (_eR) {}
        this._gestureHandler = null;
        // If immediate start failed (ctx still mid-transition), keep polling
        // in the background up to 3s. Do NOT await — gesture-prime handler
        // should return promptly so the user's click continues to propagate.
        if (!keepaliveImmediate) {
          _ensureKeepalive(this, 3000, 100).then(ok => {
            _audioDebug("manager:keepalive:polled-start", { ok, ctx: _ctxStateSnapshot() });
          }).catch(() => {});
        }
      };
      this._gestureHandler = handler;
      target.addEventListener("pointerdown", handler, { capture: true, once: false, passive: true });
      _audioDebug("manager:gesture-prime:armed", {});
    } catch (_e) {}
  }

  // Warm the sound cache for a src so the first Play doesn't eat the load
  // latency. Idempotent: tracks resolved srcs in _preloadedSrcs, inflight
  // promises in _preloadInflight (dedupes concurrent calls on the same src).
  async preload(src) {
    const path = String(src || "").trim();
    if (!path) return null;
    const key = _normalizeAudioSrc(path);
    if (this._preloadedSrcs.has(key)) {
      _audioDebug("manager:preload:cached", { src: path });
      return null;
    }
    const inflight = this._preloadInflight.get(key);
    if (inflight) {
      _audioDebug("manager:preload:inflight", { src: path });
      return inflight;
    }

    const task = (async () => {
      try {
        const AH = foundry?.audio?.AudioHelper || globalThis.AudioHelper || null;
        if (AH && typeof AH.preloadSound === "function") {
          _audioDebug("manager:preload:AH.preloadSound", { src: path });
          const s = await AH.preloadSound(path);
          this._preloadedSrcs.add(key);
          return s || null;
        }
        const SoundCls = foundry?.audio?.Sound || null;
        if (SoundCls) {
          _audioDebug("manager:preload:Sound.load", { src: path });
          const s = new SoundCls({ src: path });
          if (typeof s.load === "function") await s.load();
          this._preloadedSrcs.add(key);
          return s || null;
        }
        _warn("preload: no Foundry audio API available");
        return null;
      } catch (e) {
        _warn("preload failed:", path, e);
        return null;
      } finally {
        this._preloadInflight.delete(key);
      }
    })();

    this._preloadInflight.set(key, task);
    return task;
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  off(event, fn) {
    try { this._listeners.get(event)?.delete(fn); } catch (_e) {}
  }

  emit(event, payload) {
    try {
      const set = this._listeners.get(event);
      if (!set) return;
      for (const fn of set) {
        try { fn(payload); } catch (_e) {}
      }
    } catch (_e) {}
  }

  async playForBeat(beat, opts) {
    opts = opts || {};
    const trigger = opts.trigger || "external";
    const a = beat && beat.audio ? beat.audio : null;
    const beatId = beat?.id || null;
    const src = String(a?.src || "").trim();
    const playlistSoundUuid = String(a?.playlistSoundUuid || "").trim();

    _audioDebug("manager:playForBeat:enter", {
      trigger, beatId,
      enabled: !!a?.enabled, autoplay: !!a?.autoplay,
      broadcastPlayers: !!a?.broadcastPlayers, loop: !!a?.loop, src,
      playlistSoundUuid: playlistSoundUuid || null
    });

    if (!a || !a.enabled) { _audioDebug("manager:playForBeat:skip-disabled", { beatId }); return null; }
    if (!src && !playlistSoundUuid) { _audioDebug("manager:playForBeat:skip-no-source", { beatId }); return null; }
    if (!game.user || !game.user.isGM) { _audioDebug("manager:playForBeat:skip-non-gm", { beatId }); return null; }

    // Structural dedupe #1: a play is already in flight for this beat.
    // Kills the autoplay+click double-fire while the first play is loading.
    if (this.inflightPromise && this.lastBeatId === beatId) {
      _audioDebug("manager:playForBeat:dedupe-inflight", { beatId, trigger, lastTrigger: this.lastTrigger });
      return this.inflightPromise;
    }
    // Structural dedupe #2: this beat's Sound is currently audible. Clicking
    // Play while the track is still playing is a no-op — user must hit Stop
    // or wait for the track to end. Crucially, we check actual audibility
    // (`sound.playing`), not a timer, so a silent-failed first play (no user
    // gesture yet) does NOT block a subsequent gesture-armed retry.
    if (this.lastBeatId === beatId && this.currentSound) {
      const s = this.currentSound;
      const stillAudible = !!(s.playing === true || s.state === true);
      if (stillAudible) {
        _audioDebug("manager:playForBeat:dedupe-playing", { beatId, trigger, lastTrigger: this.lastTrigger });
        return s;
      }
    }
    // Tiny belt-and-suspenders: if we're within the initial-load window for
    // the same beat (Sound not yet registered as playing), still dedupe so
    // a click that races ahead of the resolve doesn't spawn a parallel play.
    const sinceLastStart = Date.now() - (this.lastPlayStartedAt || 0);
    if (this.lastBeatId === beatId && sinceLastStart < DEDUPE_MS) {
      _audioDebug("manager:playForBeat:dedupe-loading", { beatId, trigger, sinceLastStart });
      return this.currentSound;
    }

    this.lastBeatId = beatId;
    this.lastTrigger = trigger;
    this.lastPlayStartedAt = Date.now();

    const promise = this._playCore(beat, { trigger, preview: opts.preview === true });
    this.inflightPromise = promise;
    promise.finally(() => {
      if (this.inflightPromise === promise) this.inflightPromise = null;
    }).catch(() => {});
    return promise;
  }

  async _playCore(beat, { trigger, preview }) {
    const a = beat.audio;
    let src = String(a.src || "").trim();
    const playlistSoundUuid = String(a.playlistSoundUuid || "").trim();
    const vol0 = Number(a.volume);
    const volume = Number.isFinite(vol0) ? Math.max(0, Math.min(1, vol0)) : 0.85;
    const loop = !!a.loop;
    const push = !preview && !!a.broadcastPlayers;

    // Phase 3: if a PlaylistSound UUID is set, it takes precedence — resolve
    // it to the underlying file path and play via the SAME AH.play pipeline
    // as raw src. The PlaylistSound document is NOT modified (no doc.update
    // calls), so:
    //   - No persistent "playing: true" state → no auto-resume on world load.
    //   - No Playlist-sidebar clutter / dual control surfaces.
    //   - The beat dialog's Play/Stop buttons are the only control surface.
    //   - Broadcast still works: AH.play({push: true}) fans to players via
    //     Foundry's native socket.
    if (playlistSoundUuid) {
      try {
        const fn = globalThis.fromUuid || foundry?.utils?.fromUuid || null;
        const doc = typeof fn === "function" ? await fn(playlistSoundUuid) : null;
        if (doc && doc.documentName === "PlaylistSound" && doc.path) {
          src = String(doc.path).trim();
          _audioDebug("manager:playlist.resolved", {
            uuid: playlistSoundUuid,
            src,
            parentName: doc.parent?.name || null,
            soundName: doc.name || null
          });
        } else {
          _warn(`PlaylistSound UUID did not resolve to a usable sound: ${playlistSoundUuid}`);
          if (!src) return null;
        }
      } catch (e) {
        _warn("PlaylistSound resolution failed:", e);
        if (!src) return null;
      }
    }

    try {
      await this.stopAll({ caller: `internal-pre-play:${trigger}`, push: false });

      // Defensive sweep: kill any stale Sound in game.audio.playing matching
      // this src (orphans from reloads, URL-encoding mismatches, etc.).
      try {
        const playing = game?.audio?.playing;
        if (playing && typeof playing.values === "function") {
          const target = _normalizeAudioSrc(src);
          const kills = [];
          for (const snd of playing.values()) {
            try {
              const sndSrc = _normalizeAudioSrc(snd?.src || snd?.path || snd?.data?.src || "");
              if (sndSrc && sndSrc === target) kills.push(_stopOneSound(snd));
            } catch (_e1) {}
          }
          if (kills.length) await Promise.all(kills);
        }
      } catch (_eSweep) {}

      const token = this.playToken;
      await _resumeAudioContext();
      // Ensure keepalive is up BEFORE we trigger playback. Targets the
      // autoplay race: gesture-prime fires when the user clicks "Run Beat";
      // executeBeat then calls _maybePlayBeatAudio within milliseconds,
      // often before the keepalive has had a chance to establish. Poll up
      // to 500ms here so the hardware output device has had time to wake.
      // No-op if keepalive already running.
      if (!this._keepaliveHandle) {
        const ka = await _ensureKeepalive(this, 500, 50);
        _audioDebug("manager:keepalive:pre-play-ensure", { keepalive: ka, trigger, ctx: _ctxStateSnapshot() });
      }

      const AH = foundry?.audio?.AudioHelper || globalThis.AudioHelper || null;
      if (!AH || typeof AH.play !== "function") {
        _warn("AudioHelper unavailable (expected foundry.audio.AudioHelper in v13+)");
        return null;
      }

      // Preload-and-await: a previously untouched src would otherwise hit the
      // network inside AH.play while the AudioContext is still warming up,
      // producing a "ghost" first play — Sound is logically `.playing=true`
      // (so dedupe locks it in) but no audio actually reaches the speakers.
      // preload() is idempotent (Set-backed), so warm cache costs nothing.
      try { await this.preload(src); } catch (_ePreload) {}

      _audioDebug("manager:AH.play", { src, volume, loop, push, trigger, ctx: _ctxStateSnapshot() });
      const s = await AH.play({ src, volume, loop }, { push });
      _audioDebug("manager:AH.play-resolved", {
        src, haveSound: !!s, trigger,
        soundLoaded: s?.loaded,
        soundPlaying: s?.playing,
        soundState: s?.state,
        soundDuration: s?.duration,
        ctx: _ctxStateSnapshot()
      });

      if (token !== this.playToken) {
        _audioDebug("manager:AH.play-cancelled", { src });
        _stopOneSound(s);
        return null;
      }

      this.currentSound = s || null;
      this.currentSrc = src;
      this.currentBeatId = beat?.id || null;
      this.startedAt = Date.now();

      this.emit("BEAT_AUDIO_START", { beatId: this.currentBeatId, src, trigger });
      return this.currentSound;
    } catch (e) {
      _warn("Playback failed:", e);
      this.emit("BEAT_AUDIO_ERROR", { beatId: beat?.id || null, error: e });
      return null;
    }
  }

  async stopAll(opts) {
    opts = opts || {};
    const caller = opts.caller || "unknown";
    const doPush = opts.push === true;
    _audioDebug("manager:stopAll:enter", {
      caller, push: doPush,
      hadCurrent: !!this.currentSound,
      currentBeatId: this.currentBeatId
    });

    if (doPush && game?.user?.isGM && game?.socket?.emit) {
      try {
        game.socket.emit(BEAT_AUDIO_SOCKET, {
          type: "bbttccBeatAudio",
          action: "stop",
          src: this.currentSrc || ""
        });
        _audioDebug("manager:stopAll:socket-emit-stop", { src: this.currentSrc || null });
      } catch (_e) {}
    }

    this.playToken += 1;
    const tasks = [];
    try {
      if (this.currentSound) tasks.push(_stopOneSound(this.currentSound));
      // On player clients the manager never owns the Sound (only the GM calls
      // playForBeat — see skip-non-gm gate). The audio reaches them via
      // AH.play({push:true}) and lives in game.audio.playing. Without srcHint
      // from the GM's stop socket, we'd have no src to match and nothing to
      // stop. With it, the sweep below finds and kills the broadcast Sound.
      const rawHint = this.currentSrc || opts.srcHint || "";
      const srcNow = _normalizeAudioSrc(rawHint);
      const baseNow = srcNow ? srcNow.split("/").pop() : "";
      const playing = game?.audio?.playing;
      const isFromSocket = String(caller || "") === "socket";
      const playingDump = [];
      let matched = 0;
      if (playing && typeof playing.values === "function") {
        for (const snd of playing.values()) {
          try {
            const rawSnd = snd?.src || snd?.path || snd?.data?.src || "";
            const sndSrc = _normalizeAudioSrc(rawSnd);
            const sndBase = sndSrc ? sndSrc.split("/").pop() : "";
            if (isFromSocket) {
              playingDump.push({ src: sndSrc, playing: !!(snd?.playing === true || snd?.state === true) });
            }
            // Match by full normalized path OR by basename. Foundry sometimes
            // round-trips paths differently between encoded URL form and raw
            // disk form when sounds arrive via the AH.play({push:true}) socket
            // broadcast — basename fallback catches that mismatch.
            const isMatch = (srcNow && sndSrc === srcNow) ||
                            (baseNow && sndBase && sndBase === baseNow);
            if (isMatch) {
              matched += 1;
              tasks.push(_stopOneSound(snd));
            }
          } catch (_e) {}
        }
      }
      if (isFromSocket) {
        _audioDebug("manager:stopAll:socket-sweep", {
          rawHint, srcNow, baseNow, matched,
          totalPlaying: playingDump.length,
          playing: playingDump
        });
      }
    } catch (_e) {}

    const stoppedBeatId = this.currentBeatId;
    this.currentSound = null;
    this.currentSrc = "";
    this.currentBeatId = null;
    this.startedAt = 0;

    // Dedupe state (lastBeatId + lastPlayStartedAt) is ONLY reset on external
    // stops (user hit the Stop button, API called stop). The internal stopAll
    // that runs inside _playCore right before AH.play must NOT reset it, or
    // every subsequent click would see lastBeatId=null and bypass dedupe —
    // which is exactly the spam-click bug this method is meant to prevent.
    const isInternal = String(caller || "").startsWith("internal-pre-play");
    if (!isInternal) {
      this.lastBeatId = null;
      this.lastPlayStartedAt = 0;
    }

    try { await Promise.all(tasks); } catch (_e) {}

    if (stoppedBeatId) this.emit("BEAT_AUDIO_STOP", { beatId: stoppedBeatId, caller });
  }

  async previewBeat(beat) {
    const b = beat ? foundry.utils.deepClone(beat) : null;
    if (b?.audio) b.audio.broadcastPlayers = false;
    return this.playForBeat(b, { trigger: "editor-preview", preview: true });
  }

  dispose() {
    try { this.stopAll({ caller: "dispose", push: false }); } catch (_e) {}
    this._listeners.clear();
    this._initialized = false;
    try {
      if (this._gestureHandler && globalThis?.document?.removeEventListener) {
        globalThis.document.removeEventListener("pointerdown", this._gestureHandler, true);
      }
    } catch (_e) {}
    this._gestureHandler = null;
    this._preloadInflight.clear();
    _stopKeepalive(this);
  }
}

// Singleton — expose on globalThis so module.js (not an ES-import consumer)
// can reach it by name. game.bbttcc.api.campaign.audio facade is installed
// in module.js on ready.
globalThis.__bbttccBeatAudioManager = globalThis.__bbttccBeatAudioManager || new BeatAudioManager();

// Also export a constant so the module.json esmodule load succeeds as a
// proper ES module evaluation.
export const BeatAudioManagerInstance = globalThis.__bbttccBeatAudioManager;
