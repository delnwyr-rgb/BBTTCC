// modules/bbttcc-structures/scripts/destruction.vfx.js
// "Blowed-up" effects for structures (owner ask 2026-10-09 — the driving / demolition demo).
//
// A structure that hits Razed now has a payoff: explosion + shrapnel + falling rocks +
// ground cracks + lingering smoke + board shake, and its token turns into a scorched
// ruin. Breached gets a smaller burst. A siege layer that falls gets the full treatment
// on its wall token. Repairs (→ intact / damaged) restore the original look.
//
// Triggers
//   bbttcc:structure:stateChanged  { actor, fromState, toState }   (damage-path.js)
//   bbttcc:siege:layerBreached     { structureActorId, layerName } (siege-layer-transition.js)
//
// Ruin look (per token, persisted so every client and every reload sees it)
//   * actor flag bbttcc-structures.ruinedImg / breachedImg — authored art wins (texture swap)
//   * otherwise a scorch tint + alpha
//   * the original { src, tint, alpha } is kept in token flag bbttcc-structures.preRuin
//
// API: game.bbttcc.api.structures.destruction = { play(actorOrToken, kind), ruin(token, kind), restore(token) }
//      kind = "razed" | "breached"

(() => {
  const MOD = "bbttcc-structures";
  const TAG = "[bbttcc-structures/destruction-vfx]";
  const LOOK = {
    razed:    { tint: "#4f4640", alpha: 0.82 },
    breached: { tint: "#a39282", alpha: 1 }
  };
  const _recent = new Map();   // actorId → ts (dedupe stateChanged + layerBreached on one client)

  const _seqReady = () => { try { return !!globalThis.Sequence && !!game.modules.get("sequencer")?.active; } catch { return false; } };

  // First JB2A key that exists (candidates are real paths on the live library, 2026-10-09).
  function _pick(...cands) {
    const db = globalThis.Sequencer?.Database;
    for (const c of cands) { try { if (db?.entryExists?.(c)) return c; } catch {} }
    return null;
  }

  function _tokensOf(actor) {
    if (!actor || !canvas?.ready) return [];
    const out = actor.getActiveTokens?.() ?? [];
    if (out.length) return out;
    return canvas.tokens.placeables.filter(t => t.document?.actorId === actor.id);
  }

  function _shake(ms = 900) {
    try {
      const b = document.getElementById("board");
      if (!b?.animate) return;
      b.animate([
        { transform: "translate(0,0)" }, { transform: "translate(-9px,5px)" }, { transform: "translate(8px,-6px)" },
        { transform: "translate(-6px,-4px)" }, { transform: "translate(5px,6px)" }, { transform: "translate(0,0)" }
      ], { duration: ms, easing: "ease-out" });
    } catch {}
  }

  // ── The spectacle (Sequencer broadcasts to every client from whoever plays it) ──
  function playAt(token, kind = "razed") {
    if (!token) return;
    _shake(kind === "razed" ? 1000 : 600);
    try { game.socket?.emit?.(`module.${MOD}`, { t: "destructionShake", kind }); } catch {}
    if (!_seqReady()) return;
    const c = token.center;
    const w = Math.max(token.w, token.h, canvas.grid.size);
    const big = kind === "razed";
    const boom  = _pick("jb2a.explosion.01.orange", "jb2a.explosion.02.orange", "jb2a.explosion.01");
    const shrap = _pick("jb2a.explosion.shrapnel.bomb.01.black", "jb2a.explosion.shrapnel");
    const rocks = _pick("jb2a.falling_rocks.top.1x1", "jb2a.falling_rocks.top");
    const crack = _pick("jb2a.impact.ground_crack.orange.02", "jb2a.impact.ground_crack.orange", "jb2a.impact.ground_crack.01");
    const smoke = _pick("jb2a.smoke.plumes.01.grey", "jb2a.smoke.plumes", "jb2a.smoke.puff.centered.grey", "jb2a.smoke.puff.centered");
    try {
      const s = new Sequence({ moduleName: MOD, softFail: true });
      if (crack) s.effect().file(crack).atLocation(c).size(w * (big ? 1.5 : 1.0)).belowTokens().fadeOut(1500).duration(big ? 9000 : 5000);
      if (boom)  s.effect().file(boom).atLocation(c).size(w * (big ? 1.9 : 1.1)).zIndex(5);
      if (big && shrap) s.effect().file(shrap).atLocation(c).size(w * 1.5).delay(120).zIndex(6);
      if (big) {
        const n = Math.max(2, Math.min(5, Math.round(w / canvas.grid.size)));
        for (let i = 0; i < n; i++) {
          const ox = (Math.random() - 0.5) * w * 0.9, oy = (Math.random() - 0.5) * w * 0.9;
          s.effect().file(boom).atLocation({ x: c.x + ox, y: c.y + oy }).size(w * 0.55).delay(250 + i * 180).zIndex(5);
        }
        if (rocks) s.effect().file(rocks).atLocation(c).size(w * 1.2).delay(400).zIndex(4);
      }
      if (smoke) s.effect().file(smoke).atLocation(c).size(w * (big ? 1.6 : 1.0)).delay(big ? 700 : 400).fadeIn(600).fadeOut(2500).duration(big ? 11000 : 6000).opacity(0.85).zIndex(3);
      s.play();
    } catch (e) { console.warn(TAG, "sequence failed", e); }
  }

  // ── Ruin look (GM writes; players relay through gmExec) ──
  async function ruin(token, kind = "razed") {
    const doc = token?.document ?? token;
    if (!doc) return;
    const actor = doc.actor;
    const art = kind === "razed" ? actor?.getFlag?.(MOD, "ruinedImg") : actor?.getFlag?.(MOD, "breachedImg");
    const pre = doc.getFlag?.(MOD, "preRuin") ?? { src: doc.texture?.src, tint: doc.texture?.tint ?? "#ffffff", alpha: doc.alpha ?? 1 };
    const look = LOOK[kind] || LOOK.razed;
    const upd = {
      [`flags.${MOD}.preRuin`]: pre,
      [`flags.${MOD}.ruinLook`]: kind,
      "texture.tint": art ? pre.tint : look.tint,
      alpha: art ? pre.alpha : look.alpha
    };
    if (art) upd["texture.src"] = art;
    await _write(doc, upd);
  }

  async function restore(token) {
    const doc = token?.document ?? token;
    const pre = doc?.getFlag?.(MOD, "preRuin");
    if (!pre) return;
    await _write(doc, {
      "texture.src": pre.src, "texture.tint": pre.tint ?? "#ffffff", alpha: pre.alpha ?? 1,
      [`flags.${MOD}.-=preRuin`]: null, [`flags.${MOD}.-=ruinLook`]: null
    });
  }

  async function _write(doc, upd) {
    if (doc.canUserModify?.(game.user, "update")) return doc.update(upd, { animate: false });
    const gx = game.bbttcc?.api?.gmExec;
    if (gx?.call) { try { await gx.call("structures.ruinToken", { uuid: doc.uuid, upd }); } catch (e) { console.warn(TAG, "ruin relay failed", e); } }
  }

  function _dupe(actorId) {
    const now = Date.now(), last = _recent.get(actorId) || 0;
    _recent.set(actorId, now);
    return now - last < 5000;
  }

  // One entry point: spectacle + ruin for every token of the actor on this scene.
  async function play(actorOrToken, kind = "razed") {
    const tok = actorOrToken?.document ? actorOrToken : null;
    const actor = tok ? tok.actor : actorOrToken;
    const toks = tok ? [tok] : _tokensOf(actor);
    for (const t of toks) {
      playAt(t, kind);
      setTimeout(() => { ruin(t, kind).catch(e => console.warn(TAG, "ruin failed", e)); }, kind === "razed" ? 650 : 400);
    }
  }

  // ── Wiring ──
  Hooks.on("bbttcc:structure:stateChanged", ({ actor, fromState, toState } = {}) => {
    if (!actor) return;
    if (toState === "razed" || toState === "breached") {
      if (_dupe(actor.id)) return;
      play(actor, toState);
    } else if ((toState === "intact" || toState === "damaged") && (fromState === "razed" || fromState === "breached")) {
      for (const t of _tokensOf(actor)) restore(t);
    }
  });

  // Fires on every client (GM callAll + socket relay) — only the active GM plays it.
  Hooks.on("bbttcc:siege:layerBreached", (p = {}) => {
    if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
    const actor = p.structureActorId ? game.actors.get(p.structureActorId) : null;
    if (!actor || _dupe(actor.id)) return;
    play(actor, "razed");
  });

  function _init() {
    if (globalThis.__bbttccDestructionVfxInit) return;
    globalThis.__bbttccDestructionVfxInit = true;
    try {
      game.socket?.on?.(`module.${MOD}`, (msg) => { if (msg?.t === "destructionShake") _shake(msg.kind === "razed" ? 1000 : 600); });
    } catch {}
    try {
      game.bbttcc?.api?.gmExec?.register?.("structures.ruinToken", async ({ uuid, upd }) => {
        const d = await fromUuid(uuid);
        if (d) await d.update(upd, { animate: false });
        return { ok: !!d };
      });
    } catch (e) { console.warn(TAG, "gmExec register failed", e); }
    game.bbttcc = game.bbttcc || {}; game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.structures = game.bbttcc.api.structures || {};
    game.bbttcc.api.structures.destruction = { play, ruin, restore, playAt };
    // fullRepair writes plates directly (no stateChanged) — restore the ruin look with it.
    const S = game.bbttcc.api.structures;
    if (typeof S.fullRepair === "function" && !S.fullRepair.__ruinWrapped) {
      const orig = S.fullRepair;
      S.fullRepair = async function (actor, ...rest) {
        const r = await orig.call(this, actor, ...rest);
        try { for (const t of _tokensOf(actor)) await restore(t); } catch (e) { console.warn(TAG, "restore after fullRepair failed", e); }
        return r;
      };
      S.fullRepair.__ruinWrapped = true;
    }
    console.log(TAG, "ready — game.bbttcc.api.structures.destruction");
  }
  Hooks.once("ready", _init);
  if (game?.ready) _init();
})();
