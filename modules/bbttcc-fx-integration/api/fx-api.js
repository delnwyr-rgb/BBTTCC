import { engine } from "../core/fx-engine.js";

export function createFXAPI() {
  const registry = new Map();
  let bannerChain = Promise.resolve();
  let lastBannerAt = 0;

  const bannerAccumulator = {
    text: "",
    tone: "",
    raidType: "",
    duration: 0,
    spacing: 0,
    expiresAt: 0,
    count: 0,
    lastSignature: ""
  };

  function familyForKey(key) {
    const k = String(key || "").toLowerCase();
    if (["harmonic_chant", "sephirotic_intervention", "unity_surge", "radiant_rally", "bless_the_fallen", "turn_unity"].includes(k)) return "faith";
    if (["void_signal_collapse", "qliphothic_gambit", "psychic_disruption", "ego_breaker", "turn_darkness"].includes(k)) return "void";
    if (["chrono_loop_command", "reality_hack", "temporal_armistice"].includes(k)) return "temporal";
    if (["industrial_sabotage", "supply_overrun", "repair_rig", "facility_damage", "rig_damage", "turn_build_units", "turn_trade_routes", "turn_logistics_pressure"].includes(k)) return "industrial";
    if (["flash_bargain", "counter_propaganda_wave", "flash_interdict", "moral_high_ground", "courtly", "turn_loyalty"].includes(k)) return "political";
    if (["boss_phase_change"].includes(k)) return "boss";
    return "martial";
  }

  function normalizeRaidType(raidType) {
    const s = String(raidType || "").toLowerCase().trim();
    if (!s) return "";
    if (s.includes("courtly")) return "courtly";
    if (s.includes("infiltration")) return "infiltration";
    if (s.includes("espionage")) return "infiltration";
    if (s.includes("ritual")) return "ritual";
    if (s.includes("tikkun")) return "ritual";
    if (s.includes("siege")) return "siege";
    if (s.includes("occupation")) return "occupation";
    if (s.includes("liberation")) return "liberation";
    if (s.includes("propaganda")) return "courtly";
    if (s.includes("assault")) return "assault";
    return s.replace(/[^a-z0-9]+/g, "_");
  }

  function raidToneForType(raidType) {
    const rt = normalizeRaidType(raidType);
    if (rt === "assault" || rt === "liberation" || rt === "occupation") return "assault";
    if (rt === "infiltration") return "infiltration";
    if (rt === "courtly") return "courtly";
    if (rt === "ritual") return "ritual";
    if (rt === "siege") return "siege";
    return "";
  }

  function register(key, spec = {}) {
    registry.set(String(key), { key: String(key), ...spec });
  }

  function get(key) {
    return registry.get(String(key)) || null;
  }

  function defaultPhaseForKey(key) {
    const k = String(key || "").toLowerCase();
    if (["raid_outcome", "facility_damage", "rig_damage", "boss_phase_change", "turn_complete", "turn_darkness", "turn_loyalty", "turn_build_units", "turn_trade_routes", "turn_logistics_pressure", "infiltration_alarm", "courtly_exchange", "raid_roll"].includes(k)) return "resolve";
    if (["turn_start"].includes(k)) return "invoke";
    return "impact";
  }

  function durationForKey(key, phase) {
    const k = String(key || "").toLowerCase();
    if (phase === "invoke") return 1150;
    if (["raid_outcome", "boss_phase_change"].includes(k)) return 1900;
    if (["facility_damage", "rig_damage", "infiltration_alarm", "courtly_exchange", "raid_roll"].includes(k)) return 1550;
    if (["turn_start", "turn_complete"].includes(k)) return 1750;
    if (phase === "resolve") return 1500;
    return 1000;
  }

  function spacingForKey(key, phase) {
    const k = String(key || "").toLowerCase();
    if (["raid_outcome", "boss_phase_change"].includes(k)) return 1400;
    if (["facility_damage", "rig_damage", "turn_start", "turn_complete", "infiltration_alarm", "courtly_exchange", "raid_roll"].includes(k)) return 1150;
    if (phase === "invoke") return 540;
    return 760;
  }

  function severityForText(text) {
    const s = String(text || "");
    if (/great success|critical|catastrophic|boss|breach|destroy|wins/i.test(s)) return "major";
    if (/fail|loss|lockdown|rupture|darkness|alerted|suspicious|alarm/i.test(s)) return "warn";
    if (/success|repaired|restored|complete|start|quiet|stable/i.test(s)) return "good";
    return "info";
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getRoot() {
    return document.getElementById("bbttcc-fx-root") || document.body || null;
  }

  function setRaidTone(raidType) {
    const tone = raidToneForType(raidType);
    const root = getRoot();
    if (!root) return () => {};
    const prev = root.dataset.raidTone || "";
    if (tone) root.dataset.raidTone = tone;
    else delete root.dataset.raidTone;
    return () => {
      if (!root) return;
      if (prev) root.dataset.raidTone = prev;
      else delete root.dataset.raidTone;
    };
  }

  function toneForFamily(family, fallback = "info") {
    if (family === "void" || family === "boss") return "warn";
    if (family === "faith") return "good";
    return fallback;
  }

  function normalizeBannerText(text) {
    return String(text || "").replace(/\s*×\d+\s*$/i, "").trim();
  }

  function bannerCompressionWindow(text, tone, opts = {}) {
    const baseText = normalizeBannerText(text);
    const lower = baseText.toLowerCase();
    if (/new faction critical/.test(lower)) return 2600;
    if (/critical|warning|logistics pressure|darkness|alarm|lockdown|alerted|suspicious/.test(lower)) return 1800;
    if (tone === "warn" || tone === "major") return 1500;
    if (opts?.compressWindowMs != null) return Number(opts.compressWindowMs) || 0;
    return 0;
  }

  function shouldCompressBanner(text, tone, opts = {}) {
    if (opts?.compress === false) return false;
    const windowMs = bannerCompressionWindow(text, tone, opts);
    return windowMs > 0;
  }

  function enqueueBanner(text, tone = "info", duration = 1100, spacing = 800, opts = {}) {
    const now = Date.now();
    const raidType = String(opts.raidType || "");
    const baseText = normalizeBannerText(text);
    const signature = `${baseText}||${tone}||${raidType}`;
    const compress = shouldCompressBanner(baseText, tone, opts);
    const compressWindowMs = bannerCompressionWindow(baseText, tone, opts);

    let renderText = baseText;
    let effectiveDuration = duration;
    let effectiveSpacing = spacing;

    if (compress) {
      const sameBurst = (
        bannerAccumulator.lastSignature === signature &&
        now <= bannerAccumulator.expiresAt
      );

      if (sameBurst) {
        bannerAccumulator.count += 1;
        bannerAccumulator.duration = Math.max(bannerAccumulator.duration || 0, duration);
        bannerAccumulator.spacing = Math.max(bannerAccumulator.spacing || 0, spacing + 250);
        bannerAccumulator.expiresAt = now + compressWindowMs;
      } else {
        bannerAccumulator.text = baseText;
        bannerAccumulator.tone = tone;
        bannerAccumulator.raidType = raidType;
        bannerAccumulator.duration = duration;
        bannerAccumulator.spacing = spacing;
        bannerAccumulator.expiresAt = now + compressWindowMs;
        bannerAccumulator.count = 1;
        bannerAccumulator.lastSignature = signature;
      }

      renderText = bannerAccumulator.count > 1 ? `${baseText} ×${bannerAccumulator.count}` : baseText;
      effectiveDuration = Math.max(duration, bannerAccumulator.duration + ((bannerAccumulator.count - 1) * 120));
      effectiveSpacing = Math.max(spacing, bannerAccumulator.spacing);
    } else {
      bannerAccumulator.text = "";
      bannerAccumulator.tone = "";
      bannerAccumulator.raidType = "";
      bannerAccumulator.duration = 0;
      bannerAccumulator.spacing = 0;
      bannerAccumulator.expiresAt = 0;
      bannerAccumulator.count = 0;
      bannerAccumulator.lastSignature = "";
    }

    const settle = Math.max(0, effectiveSpacing - (now - lastBannerAt));

    bannerChain = bannerChain
      .then(async () => {
        if (settle > 0) await wait(settle);
        lastBannerAt = Date.now();
        const restoreTone = setRaidTone(raidType);
        engine.banner(renderText, tone, effectiveDuration);
        await wait(Math.max(effectiveDuration, effectiveSpacing));
        restoreTone();
      })
      .catch((err) => console.warn("[bbttcc-fx] banner queue error", err));
    return bannerChain;
  }

  function screenShake(kind = "subtle", ms = 240) {
    const cls = kind === "heavy" ? "bbttcc-fx-shake-heavy" : "bbttcc-fx-shake-subtle";
    const el = document.body;
    if (!el) return;
    el.classList.remove("bbttcc-fx-shake-subtle", "bbttcc-fx-shake-heavy");
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }

  function strengthenSelection(ctx, family) {
    if (ctx.checkbox) engine.pulseCheckboxLabel(ctx.checkbox, family);
    if (ctx.root) engine.pulseManagePanel(ctx.root, family);
    const label = ctx.checkbox?.closest?.("label") || ctx.checkbox?.parentElement || null;
    if (label) engine.flashElement(label, `bbttcc-fx-pulse-${family}`, 1350);
  }

  function createRollChip(text, cls = "", top = 250) {
    const root = getRoot();
    if (!root) return null;
    const el = document.createElement("div");
    el.className = `bbttcc-fx-roll-chip ${cls}`.trim();
    el.textContent = text;
    el.style.top = `${top}px`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    window.setTimeout(() => el.classList.remove("show"), 900);
    window.setTimeout(() => el.remove(), 1300);
    return el;
  }


  function canonicalizeCinematicKey(raw) {
    return String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function aliasCinematicKey(key) {
    const k = canonicalizeCinematicKey(key);
    const aliases = {
      defender_s_reversal: "defenders_reversal"
    };
    return aliases[k] || k;
  }

  function isDefenderContext(ctx = {}) {
    const side = String(ctx.side || ctx.role || ctx.team || "").toLowerCase();
    return side === "defender" || side === "def" || side === "d";
  }

  function maybePulseCanvas(spec = {}, ctx = {}) {
    const pos = engine.inferCanvasPosition ? engine.inferCanvasPosition(ctx) : null;
    if (!pos || !engine.canvasPulse) return null;
    return engine.canvasPulse(pos, {
      color: spec.canvasColor,
      radius: spec.canvasRadius,
      ms: spec.canvasMs,
      alpha: spec.canvasAlpha,
      lineAlpha: spec.canvasLineAlpha
    });
  }

  function maybeOverlay(spec = {}, family, phase) {
    if (!engine.screenOverlay || !engine.overlayForFamily) return null;
    const overlay = spec[phase === "impact" ? "impactOverlay" : "resolveOverlay"] || spec.overlay || "";
    const key = overlay || engine.overlayForFamily(family);
    if (!key) return null;
    return engine.screenOverlay(key, spec[phase === "impact" ? "impactOverlayMs" : "resolveOverlayMs"] || spec.overlayMs || 900);
  }

  function maybeShake(spec = {}, phase, tone) {
    const shake = spec[phase === "impact" ? "impactShake" : "resolveShake"] || (tone === "major" ? "heavy" : tone === "warn" ? "subtle" : "");
    if (!shake || !engine.screenShake) return;
    engine.screenShake(shake, spec[phase === "impact" ? "impactShakeMs" : "resolveShakeMs"] || 260);
  }

  async function maybePlayCinematic(spec = {}, key, phase) {
    const needed = String(spec.cinematicPhase || "resolve");
    if (needed !== phase) return null;

    let cinematic = spec.cinematic;
    if (!cinematic && phase === "resolve") {
      const fallbackKey = aliasCinematicKey(key);
      if (fallbackKey && !["raid_outcome", "facility_damage", "rig_damage", "boss_phase_change", "turn_start", "turn_end"].includes(fallbackKey)) {
        cinematic = `${fallbackKey}.webm`;
      }
    }
    if (!cinematic || !engine.playCinematicBlocking) return null;

    return engine.playCinematicBlocking(cinematic, {
      key: `${key}:${phase}`,
      opacity: spec.cinematicOpacity,
      blendMode: spec.cinematicBlendMode,
      maxMs: spec.cinematicMs || 8000,
      muted: spec.cinematicMuted
    });
  }

  async function playRolls(ctx = {}, opts = {}) {
    if (!engine.isEnabled()) return { ok: true, skipped: true };
    const raidType = opts.raidType || ctx.raidType || "";
    const aName = ctx.attackerName || "Attacker";
    const dName = ctx.defenderName || "Defender";
    const aTotal = Number(ctx.attackerTotal ?? ctx.atkTotal ?? ctx.attackTotal);
    const dTotal = Number(ctx.defenderTotal ?? ctx.defTotal ?? ctx.defenseTotal);
    const marginRaw = ctx.margin ?? ((Number.isFinite(aTotal) && Number.isFinite(dTotal)) ? (aTotal - dTotal) : null);
    const margin = Number(marginRaw);
    const label = String(opts.label || ctx.label || raidType || "Raid Clash").replace(/_/g, " ");

    await enqueueBanner(label, "info", 1200, 900, { raidType });
    if (Number.isFinite(aTotal)) createRollChip(`${aName}: ${aTotal}`, "bbttcc-fx-roll-chip-attacker", 246);
    await wait(320);
    if (Number.isFinite(dTotal)) createRollChip(`${dName}: ${dTotal}`, "bbttcc-fx-roll-chip-defender", 302);
    await wait(340);

    if (Number.isFinite(margin)) {
      const prefix = margin > 0 ? "+" : "";
      const cls = margin > 0 ? "bbttcc-fx-roll-chip-good" : margin < 0 ? "bbttcc-fx-roll-chip-bad" : "bbttcc-fx-roll-chip-neutral";
      createRollChip(`Margin ${prefix}${margin}`, cls, 358);
      if (Math.abs(margin) >= 6) screenShake("subtle", 220);
    }

    return { ok: true, margin };
  }

  async function playScenarioShift(kind, ctx = {}, opts = {}) {
    const raidType = opts.raidType || ctx.raidType || kind;
    const outcome = ctx.outcome || ctx.label || kind;
    return playKey(kind, { ...ctx, outcome, raidType }, { ...opts, phase: "resolve" });
  }

  async function playKey(key, ctx = {}, opts = {}) {
    if (!engine.isEnabled()) return { ok: true, skipped: true };
    const spec = get(key) || {};
    const family = opts.family || spec.family || familyForKey(key);
    const phase = String(opts.phase || ctx.phase || defaultPhaseForKey(key));
    const duration = Number(opts.durationMs || spec.durationMs || durationForKey(key, phase));
    const spacing = Number(opts.spacingMs || spec.spacingMs || spacingForKey(key, phase));
    const raidType = opts.raidType || ctx.raidType || spec.raidType || "";

    if (phase === "invoke") {
      strengthenSelection(ctx, family);
      if (opts.banner !== false) {
        const text = ctx.label || spec.label || String(key).replace(/_/g, " ");
        await enqueueBanner(text, toneForFamily(family, "info"), duration, spacing, { raidType });
      }
    }

    if (phase === "impact") {
      if (ctx.root) engine.pulseManagePanel(ctx.root, family);
      const targetEl = ctx.targetEl || ctx.root?.querySelector?.("tbody") || ctx.root || null;
      if (targetEl) engine.flashElement(targetEl, `bbttcc-fx-pulse-${family}`, 1100);
      if (ctx.floatText && targetEl && engine.showFloatingTextNear) engine.showFloatingTextNear(targetEl, ctx.floatText, family === "void" ? "warn" : "info");
      maybeOverlay(spec, family, "impact");
      maybeShake(spec, "impact", "info");
      maybePulseCanvas(spec, ctx);
      if (!ctx.targetEl && !ctx.root && opts.banner === true) {
        const text = ctx.label || spec.label || String(key).replace(/_/g, " ");
        await enqueueBanner(text, toneForFamily(family, "info"), duration, spacing, { raidType });
      }
    }

    if (phase === "resolve") {
      const text = ctx.outcomeLabel || ctx.outcome || ctx.label || spec.label || key;
      const tone = severityForText(text);
      const defenderLead = isDefenderContext(ctx);

      if (defenderLead) {
        await maybePlayCinematic(spec, key, "resolve");
        await wait(Number(spec.postCinematicGapMs || 220));
      }

      await enqueueBanner(text, tone, duration, spacing, { raidType });
      if (ctx.root) engine.outcomeFlash(ctx.root, text);
      maybeOverlay(spec, family, "resolve");
      maybeShake(spec, "resolve", tone);
      maybePulseCanvas(spec, ctx);

      if (!defenderLead) {
        await maybePlayCinematic(spec, key, "resolve");
      }
    }

    return { ok: true, key, family, phase, duration, spacing, raidType: normalizeRaidType(raidType) };
  }

  async function playTurnPresentation(events = [], opts = {}) {
    if (!engine.turnEnabled()) return { ok: true, skipped: true };
    const speed = String(opts.speed || "normal");
    const gap = Number(opts.pauseBetween || (speed === "fast" ? 300 : speed === "slow" ? 1100 : 600));
    for (const evt of events) {
      engine.playTurnCard(evt);
      await wait(gap);
    }
    return { ok: true, count: events.length, gap };
  }

  return {
    registry,
    register,
    get,
    playKey,
    playRolls,
    playScenarioShift,
    playTurnPresentation,
    familyForKey,
    normalizeRaidType,
    raidToneForType,
    defaultPhaseForKey,
    durationForKey,
    spacingForKey
  };
}
