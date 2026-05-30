const MOD = "bbttcc-fx";

function setting(key, fallback) {
  try {
    return game.settings.get(MOD, key);
  } catch {
    return fallback;
  }
}

function isEnabled() {
  return !!setting("enabled", true);
}

function uiEnabled() {
  return !!setting("ui_enabled", true);
}

function turnEnabled() {
  return !!setting("turn_enabled", true);
}

function intensity() {
  return String(setting("intensity", "normal") || "normal");
}

function dur(base) {
  const mult = intensity() === "low" ? 0.75 : intensity() === "high" ? 1.3 : 1;
  return Math.max(40, Math.round(base * mult));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function resolveRoot(root) {
  if (!root) return document.body;
  if (root instanceof HTMLElement) return root;
  if (root?.[0] instanceof HTMLElement) return root[0];
  return document.body;
}

function resolveFXRoot() {
  return document.getElementById("bbttcc-fx-root") || document.body || null;
}

function banner(text, kind = "info", timeout = 1400) {
  if (!isEnabled() || !uiEnabled()) return;
  const el = document.createElement("div");
  el.className = `bbttcc-fx-banner bbttcc-fx-${kind}`;
  el.textContent = String(text || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 260);
  }, dur(timeout));
}

function flashElement(target, cls, ms = 700) {
  if (!isEnabled() || !uiEnabled()) return;
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), dur(ms));
}

function pulseCheckboxLabel(input, family = "martial") {
  if (!input || !uiEnabled()) return;
  const label = input.closest("label") || input.parentElement;
  if (!label) return;
  flashElement(label, `bbttcc-fx-pulse-${family}`, 650);
}

function pulseManagePanel(root, family = "martial") {
  const resolved = resolveRoot(root);
  flashElement(resolved.querySelector(".bbttcc-mans-cell") || resolved, `bbttcc-fx-panel-${family}`, 850);
}

function outcomeFlash(root, outcome = "info") {
  const kind = String(outcome || "").toLowerCase();
  let cls = "bbttcc-fx-outcome-neutral";
  if (kind.includes("great") || kind.includes("success") || kind.includes("win")) cls = "bbttcc-fx-outcome-good";
  else if (kind.includes("fail") || kind.includes("loss") || kind.includes("lockdown")) cls = "bbttcc-fx-outcome-bad";
  flashElement(resolveRoot(root), cls, 1200);
}

function chipPulseForManeuverKey(key) {
  const k = String(key || "").toLowerCase();
  if (["harmonic_chant", "sephirotic_intervention", "unity_surge", "radiant_rally", "bless_the_fallen", "prayer_in_the_smoke", "faithful_intervention", "radiant_retaliation", "crown_of_mercy"].includes(k)) return "faith";
  if (["void_signal_collapse", "qliphothic_gambit", "psychic_disruption", "ego_breaker", "ego_dragon_echo"].includes(k)) return "void";
  if (["chrono_loop_command", "reality_hack", "temporal_armistice"].includes(k)) return "temporal";
  if (["industrial_sabotage", "supply_overrun", "repair_rig", "gradient_surge", "logistical_surge", "engine_of_absolution", "patch_the_breach"].includes(k)) return "industrial";
  if (["flash_bargain", "counter_propaganda_wave", "flash_interdict", "moral_high_ground", "courtly", "signal_hijack", "smoke_and_mirrors", "empathic_surge"].includes(k)) return "political";
  return "martial";
}

function showFloatingTextNear(el, text, kind = "info") {
  if (!isEnabled() || !uiEnabled() || !el) return;
  const rect = el.getBoundingClientRect();
  const node = document.createElement("div");
  node.className = `bbttcc-fx-float bbttcc-fx-${kind}`;
  node.textContent = String(text || "");
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + window.scrollY - 6}px`;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  setTimeout(() => {
    node.classList.remove("show");
    setTimeout(() => node.remove(), 250);
  }, dur(900));
}

// ---------------------------------------------------------------------------
// Canvas effects (JB2A via Sequencer). Replaces the old full-screen .webm
// cinematics. When Sequencer/JB2A are unavailable (or a key fails to resolve)
// we degrade gracefully to the existing PIXI canvasPulse so the engine stays
// shippable without the animation stack installed.
// ---------------------------------------------------------------------------

function sequencerReady() {
  try {
    return !!globalThis.Sequence && !!game.modules?.get?.("sequencer")?.active;
  } catch {
    return false;
  }
}

// Defensive: only feed Sequencer a path it can actually resolve. A missing key
// throws inside Sequencer, so we check the database first and fall back.
function jb2aEntryExists(path) {
  if (!path) return false;
  try {
    const db = globalThis.Sequencer?.Database;
    if (!db) return false;
    if (typeof db.entryExists === "function") return !!db.entryExists(String(path));
    if (typeof db.getEntry === "function") {
      try {
        return !!db.getEntry(String(path), { softFail: true });
      } catch {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// The world coordinate currently centered in the viewport — Foundry pans by
// moving stage.pivot, so the pivot IS the centre of what the GM is looking at.
function viewportCenter() {
  try {
    if (!canvas?.ready || !canvas?.stage) return null;
    const p = canvas.stage.pivot;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: Number(p.x), y: Number(p.y) };
    const r = canvas.dimensions?.sceneRect;
    if (r) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  } catch {}
  return null;
}

// Append one JB2A effect section to a sequence at a fixed location.
function _addEffectSection(seq, path, where, o = {}) {
  const gs = Number(canvas?.grid?.size || 100);
  const eff = seq.effect()
    .file(String(path))
    .atLocation(where)
    .fadeIn(Number(o.fadeIn ?? 250))
    .fadeOut(Number(o.fadeOut ?? 600));
  if (o.size != null) eff.size(Number(o.size));
  else if (o.scale != null) eff.scale(Number(o.scale));
  else eff.size(gs * (o.centered ? 8 : 3));
  if (o.ms != null) eff.duration(dur(Number(o.ms)));
  if (o.opacity != null) eff.opacity(Number(o.opacity));
  if (o.delay) eff.delay(Number(o.delay));
  if (o.belowTokens) eff.belowTokens();
  eff.zIndex(Number(o.zIndex ?? 1));
  return eff;
}

/**
 * Play a JB2A effect on the canvas.
 * Placement rule: if opts.target resolves to a position, land there; otherwise
 * play a reasonably-sized effect at the centre of the current view (NOT full
 * map). Centred effects are scaled up for "big overhead" raid moments; targeted
 * / hex effects are smaller.
 *
 * Layering: opts.accentPath plays a second JB2A effect at the same location,
 * simultaneously and above the primary — e.g. a one-shot burst detonating over
 * a magic-circle glyph. The accent is best-effort; if its key doesn't resolve
 * it's simply skipped (the primary still plays).
 */
function playSequencerEffect(effectPath, opts = {}) {
  if (!isEnabled()) return null;

  const targetPos = opts.target ? resolveCanvasPosition(opts.target) : null;
  const centered = !targetPos;
  const pos = targetPos || viewportCenter() || inferCanvasPosition(opts);

  const path = jb2aEntryExists(effectPath)
    ? String(effectPath)
    : (jb2aEntryExists(opts.fallbackPath) ? String(opts.fallbackPath) : null);

  // Graceful fallback: no Sequencer/JB2A, or no resolvable key → PIXI pulse.
  if (!sequencerReady() || !path) {
    if (pos) return canvasPulse(pos, { color: opts.color, radius: opts.radius || (centered ? 220 : 130), ms: opts.ms || 800 });
    return null;
  }
  if (!pos) return null;

  try {
    const gs = Number(canvas?.grid?.size || 100);
    const where = opts.target && targetPos ? opts.target : pos;
    const baseSize = opts.size != null ? Number(opts.size) : (opts.scale != null ? null : gs * (centered ? 8 : 3));
    const seq = new globalThis.Sequence();

    // Primary (the magic-circle glyph in our wiring) — sits below the accent.
    _addEffectSection(seq, path, where, {
      centered,
      size: baseSize,
      scale: baseSize == null ? opts.scale : null,
      ms: opts.ms ?? (centered ? 2600 : 2200),
      fadeIn: opts.fadeIn,
      fadeOut: opts.fadeOut,
      opacity: opts.opacity,
      belowTokens: opts.belowTokens,
      zIndex: opts.zIndex ?? 1
    });

    // Accent burst (one-shot) — layered on top, a touch smaller, no forced
    // duration so it plays its natural length.
    const accent = jb2aEntryExists(opts.accentPath) ? String(opts.accentPath) : null;
    if (accent) {
      const accentSize = opts.accentSize != null
        ? Number(opts.accentSize)
        : (baseSize != null ? baseSize * 0.85 : gs * (centered ? 6 : 2.4));
      _addEffectSection(seq, accent, where, {
        centered,
        size: accentSize,
        fadeIn: opts.accentFadeIn ?? 0,
        fadeOut: opts.accentFadeOut ?? 300,
        delay: opts.accentDelay ?? 0,
        zIndex: (opts.zIndex ?? 1) + 1
      });
    }

    seq.play();
    return seq;
  } catch (e) {
    console.warn("[bbttcc-fx] sequencer effect failed:", effectPath, e);
    if (pos) return canvasPulse(pos, { color: opts.color, radius: centered ? 220 : 130, ms: 800 });
    return null;
  }
}

function makeOverlayParticle(className, count) {
  const frag = document.createDocumentFragment();
  const n = Math.max(1, Number(count) || 1);
  for (let i = 0; i < n; i += 1) {
    const node = document.createElement("div");
    node.className = className;
    node.style.setProperty("--i", String(i));
    frag.appendChild(node);
  }
  return frag;
}

function decorateOverlay(node, kind = "info") {
  const k = String(kind || "info").toLowerCase();
  if (["ritual", "ritual-rays", "sephirotic", "faith"].includes(k)) {
    const core = document.createElement("div");
    core.className = "bbttcc-fx-overlay-core bbttcc-fx-overlay-core-ritual";
    node.appendChild(core);
    node.appendChild(makeOverlayParticle("bbttcc-fx-ray", 7));
    return;
  }
  if (["temporal", "temporal-ripple", "chrono"].includes(k)) {
    const core = document.createElement("div");
    core.className = "bbttcc-fx-overlay-core bbttcc-fx-overlay-core-temporal";
    node.appendChild(core);
    node.appendChild(makeOverlayParticle("bbttcc-fx-ripple", 3));
    return;
  }
  if (["boss", "void", "void-fracture", "glitch"].includes(k)) {
    const core = document.createElement("div");
    core.className = "bbttcc-fx-overlay-core bbttcc-fx-overlay-core-void";
    node.appendChild(core);
    node.appendChild(makeOverlayParticle("bbttcc-fx-glitch-bar", 8));
    return;
  }
  if (["courtly", "mirror", "mirror-flash", "political"].includes(k)) {
    const lattice = document.createElement("div");
    lattice.className = "bbttcc-fx-overlay-core bbttcc-fx-overlay-core-courtly";
    node.appendChild(lattice);
    node.appendChild(makeOverlayParticle("bbttcc-fx-diamond", 5));
    return;
  }
  if (["siege", "industrial", "tactical-sweep", "scanline"].includes(k)) {
    const core = document.createElement("div");
    core.className = "bbttcc-fx-overlay-core bbttcc-fx-overlay-core-siege";
    node.appendChild(core);
    node.appendChild(makeOverlayParticle("bbttcc-fx-sweep", 2));
    return;
  }
  const core = document.createElement("div");
  core.className = "bbttcc-fx-overlay-core bbttcc-fx-overlay-core-assault";
  node.appendChild(core);
  node.appendChild(makeOverlayParticle("bbttcc-fx-slash", 3));
}

function screenOverlay(kind = "info", ms = 900) {
  if (!isEnabled() || !uiEnabled()) return null;
  const root = resolveFXRoot();
  if (!root) return null;
  const node = document.createElement("div");
  const overlayKind = String(kind || "info").toLowerCase();
  node.className = `bbttcc-fx-overlay bbttcc-fx-overlay-${overlayKind}`;
  node.dataset.overlayKind = overlayKind;
  decorateOverlay(node, overlayKind);
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));
  window.setTimeout(() => {
    node.classList.remove("show");
    window.setTimeout(() => node.remove(), 280);
  }, dur(ms));
  return node;
}

function overlayForFamily(family = "martial") {
  const f = String(family || "martial").toLowerCase();
  if (f === "faith") return "ritual-rays";
  if (f === "void" || f === "boss") return "void-fracture";
  if (f === "temporal") return "temporal-ripple";
  if (f === "political") return "mirror-flash";
  if (f === "industrial") return "tactical-sweep";
  if (f === "martial") return "assault";
  return "info";
}

function screenShake(kind = "subtle", ms = 240) {
  const cls = kind === "heavy" ? "bbttcc-fx-shake-heavy" : "bbttcc-fx-shake-subtle";
  const el = document.body;
  if (!el) return;
  el.classList.remove("bbttcc-fx-shake-subtle", "bbttcc-fx-shake-heavy");
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), dur(ms));
}

function gridCenterForDocument(docLike) {
  try {
    const x = Number(docLike?.x);
    const y = Number(docLike?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !canvas?.grid) return null;
    if (typeof canvas.grid.getCenterPoint === "function") {
      const pt = canvas.grid.getCenterPoint({ x, y });
      if (pt?.x != null && pt?.y != null) return { x: Number(pt.x), y: Number(pt.y) };
    }
    if (typeof canvas.grid.getCenter === "function") {
      const pt = canvas.grid.getCenter(x, y);
      if (Array.isArray(pt) && pt.length >= 2) return { x: Number(pt[0]), y: Number(pt[1]) };
      if (pt?.x != null && pt?.y != null) return { x: Number(pt.x), y: Number(pt.y) };
    }
  } catch {}
  return null;
}

function resolveCanvasPosition(target) {
  if (!target) return null;
  if (target.center?.x != null && target.center?.y != null) return { x: Number(target.center.x), y: Number(target.center.y) };
  if (target.object?.center?.x != null && target.object.center?.y != null) return { x: Number(target.object.center.x), y: Number(target.object.center.y) };
  const doc = target.document || target;
  const snap = gridCenterForDocument(doc);
  if (snap) return snap;
  if (target.x != null && target.y != null) {
    const snap2 = gridCenterForDocument(target);
    if (snap2) return snap2;
    return { x: Number(target.x), y: Number(target.y) };
  }
  if (doc?.x != null && doc?.y != null) {
    const w = Number(doc.width || target.w || canvas?.grid?.size || 0);
    const h = Number(doc.height || target.h || canvas?.grid?.size || 0);
    return { x: Number(doc.x) + (w / 2), y: Number(doc.y) + (h / 2) };
  }
  return null;
}

function inferCanvasPosition(ctx = {}) {
  const direct =
    resolveCanvasPosition(ctx.position) ||
    resolveCanvasPosition(ctx.token) ||
    resolveCanvasPosition(ctx.tokenObj) ||
    resolveCanvasPosition(ctx.target) ||
    resolveCanvasPosition(ctx.targetToken) ||
    resolveCanvasPosition(ctx.defenderToken) ||
    resolveCanvasPosition(ctx.attackerToken);
  if (direct) return direct;
  try {
    const controlled = canvas?.tokens?.controlled?.[0];
    const center = controlled?.center;
    if (center?.x != null && center?.y != null) return { x: Number(center.x), y: Number(center.y) };
  } catch {}
  return null;
}

function canvasPulse(position, opts = {}) {
  if (!isEnabled()) return null;
  if (!canvas?.stage || !globalThis.PIXI) return null;
  const pos = resolveCanvasPosition(position) || inferCanvasPosition({ position });
  if (!pos) return null;

  const ring = new PIXI.Graphics();
  const color = Number(opts.color != null ? opts.color : 0xff4b4b);
  const radius = Number(opts.radius || 120);
  const alpha = Number(opts.alpha != null ? opts.alpha : 0.32);
  const lineAlpha = Number(opts.lineAlpha != null ? opts.lineAlpha : 0.9);
  const lifetime = dur(Number(opts.ms || 700));
  const start = performance.now();

  ring.position.set(pos.x, pos.y);
  canvas.stage.addChild(ring);

  const ticker = canvas.app?.ticker;
  const update = () => {
    const now = performance.now();
    const t = Math.min(1, (now - start) / Math.max(1, lifetime));
    const currentR = radius + (radius * 0.85 * t);
    ring.clear();
    ring.lineStyle(4, color, Math.max(0, lineAlpha * (1 - t)));
    ring.beginFill(color, Math.max(0, alpha * (1 - t)));
    ring.drawCircle(0, 0, currentR);
    ring.endFill();
    if (t >= 1) {
      if (ticker) ticker.remove(update);
      ring.destroy();
    }
  };

  if (ticker) ticker.add(update);
  else {
    update();
    window.setTimeout(() => ring.destroy(), lifetime + 30);
  }
  return ring;
}

function playTurnCard(evt) {
  if (!isEnabled() || !turnEnabled()) return;
  const label = evt?.label || evt?.key || "Turn Event";
  const kind = evt?.kind || "info";
  banner(label, kind, 1100);
}

export const engine = {
  isEnabled,
  uiEnabled,
  turnEnabled,
  banner,
  flashElement,
  pulseCheckboxLabel,
  pulseManagePanel,
  outcomeFlash,
  chipPulseForManeuverKey,
  showFloatingTextNear,
  playTurnCard,
  playSequencerEffect,
  sequencerReady,
  jb2aEntryExists,
  viewportCenter,
  screenOverlay,
  overlayForFamily,
  screenShake,
  canvasPulse,
  inferCanvasPosition,
  wait
};
