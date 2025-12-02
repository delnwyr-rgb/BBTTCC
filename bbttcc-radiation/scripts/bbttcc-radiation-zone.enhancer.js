// ============================================================================
// BBTTCC — Radiation Zone Enhancer (Phase C, Option B)
// Scene-level fallout "weather" that stacks with hex & travel radiation.
//
// Features:
//   • Scene-level zone config on flags["bbttcc-radiation"].zone
//       { intensity: "none|low|moderate|high|storm",
//         drift: "stable|rising|falling",
//         color: "#A3E635",   // overlay tint
//         radius: 1.0,        // 0–1, coverage fraction (not fully used yet)
//         updatedAt: number   // ms
//       }
//
//   • API on game.bbttcc.api.radiation.zone:
//       getScene(sceneOrId)
//       setScene(sceneOrId, config)
//       clearScene(sceneOrId)
//
//   • Hooks:
//       - bbttcc:afterTravel  → zone-based RP gain per travel leg
//       - bbttcc:advanceTurn:end → zone drift per turn (optional)
//
//   • Visual overlay on active scene (tinted fog).
//
// Dependencies:
//   - Turn Driver emits "bbttcc:advanceTurn:begin/end" hooks.  (turn-driver.js)
//   - Travel engines emit "bbttcc:afterTravel" hooks.          (api.travel.js / hex-travel)
//   - Radiation core API is installed (game.bbttcc.api.radiation).
// ============================================================================

(() => {
  const TAG      = "[bbttcc-radiation/zone]";
  const MOD_SCN  = "bbttcc-radiation";

  // Intensity ladder for drift
  const ORDER = ["none", "low", "moderate", "high", "storm"];

  // Default config for a new zone
  function defaultZone() {
    return {
      intensity: "none",
      drift: "stable",    // stable | rising | falling
      color: "#A3E635",   // a nice toxic green
      radius: 1.0,
      updatedAt: Date.now()
    };
  }

  function intensityIndex(key) {
    const k = String(key || "none").toLowerCase();
    const i = ORDER.indexOf(k);
    return i === -1 ? 0 : i;
  }

  function normalizeIntensity(key) {
    return ORDER[intensityIndex(key)];
  }

  function clamp01(v) {
    const n = Number(v ?? 1);
    return Math.max(0, Math.min(1, n));
  }

  // ---------------------------------------------------------------------------
  // Zone API
  // ---------------------------------------------------------------------------

  function resolveScene(sceneOrId) {
    if (!sceneOrId) return game.scenes?.active ?? null;
    if (sceneOrId instanceof Scene) return sceneOrId;
    const id = String(sceneOrId);
    return game.scenes?.get(id) ?? null;
  }

  function getZoneForScene(sceneOrId) {
    const sc = resolveScene(sceneOrId);
    if (!sc) return null;
    const raw = sc.getFlag?.(MOD_SCN, "zone") || null;
    if (!raw) return null;
    return {
      ...defaultZone(),
      ...raw,
      intensity: normalizeIntensity(raw.intensity),
      drift: (raw.drift === "rising" || raw.drift === "falling" || raw.drift === "stable")
        ? raw.drift
        : "stable",
      radius: clamp01(raw.radius),
      color: raw.color || "#A3E635"
    };
  }

  async function setZoneForScene(sceneOrId, cfg = {}) {
    const sc = resolveScene(sceneOrId);
    if (!sc) throw new Error("RadiationZone: scene not found");

    const prev = getZoneForScene(sc) || defaultZone();
    const next = {
      ...prev,
      ...cfg,
      intensity: normalizeIntensity(cfg.intensity ?? prev.intensity),
      drift: (cfg.drift ?? prev.drift) || "stable",
      color: cfg.color ?? prev.color,
      radius: clamp01(cfg.radius ?? prev.radius),
      updatedAt: Date.now()
    };

    await sc.setFlag(MOD_SCN, "zone", next);
    if (sc === canvas.scene) {
      // Refresh overlay immediately on active scene
      drawZoneOverlay();
    }
    return next;
  }

  async function clearZoneForScene(sceneOrId) {
    const sc = resolveScene(sceneOrId);
    if (!sc) return false;
    await sc.unsetFlag(MOD_SCN, "zone");
    if (sc === canvas.scene) {
      removeZoneOverlay();
    }
    return true;
  }

  // Attach API under game.bbttcc.api.radiation.zone
  function publishAPI() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= game.bbttcc.api || {};
    game.bbttcc.api.radiation ??= game.bbttcc.api.radiation || {};
    const z = game.bbttcc.api.radiation.zone ?? {};

    game.bbttcc.api.radiation.zone = {
      ...z,
      getScene: getZoneForScene,
      setScene: setZoneForScene,
      clearScene: clearZoneForScene
    };

    console.log(TAG, "Zone API published on game.bbttcc.api.radiation.zone");
  }

  // ---------------------------------------------------------------------------
  // Travel Integration — zone exposure on bbttcc:afterTravel
  // ---------------------------------------------------------------------------

  function zoneExposureAmount(intensityKey) {
    const key = normalizeIntensity(intensityKey);
    switch (key) {
      case "low":      return 0.5;  // 50% chance to gain 1 RP
      case "moderate": return 1;
      case "high":     return 2;
      case "storm":    return 3;
      case "none":
      default:         return 0;
    }
  }

  async function handleAfterTravel(ctx) {
    try {
      const radApi = game.bbttcc?.api?.radiation;
      if (!radApi || typeof radApi.add !== "function") return;

      const actor = ctx.actor;
      if (!actor) return;

      // Determine scene of the destination hex
      const toDoc = ctx.to?.doc || ctx.to?.document || null;
      const sc = toDoc?.parent || canvas?.scene || game.scenes?.active;
      if (!sc) return;

      const zone = getZoneForScene(sc);
      if (!zone || normalizeIntensity(zone.intensity) === "none") return;

      let amt = zoneExposureAmount(zone.intensity);

      // Low intensity uses a coin flip
      if (amt === 0.5) {
        if (Math.random() < 0.5) amt = 1; else amt = 0;
      }

      if (amt <= 0) return;

      await radApi.add(actor.id, amt);

      // GM whisper
      const name = actor.name ?? "Unknown Faction";
      const hexName =
        ctx.toHexName ||
        toDoc?.name ||
        toDoc?.text ||
        ctx.to?.id ||
        "destination hex";

      const lines = [
        `<b>Zone Fallout Exposure</b> — ${foundry.utils.escapeHTML(name)}`,
        `Scene: ${foundry.utils.escapeHTML(sc.name || sc.id)} `,
        `Zone Intensity: <b>${normalizeIntensity(zone.intensity).toUpperCase()}</b>`,
        `Location: <i>${foundry.utils.escapeHTML(hexName)}</i>`,
        `Gained <b>${amt} RP</b> from ambient fallout.`
      ].join("<br/>");

      await ChatMessage.create({
        content: `<p>${lines}</p>`,
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        speaker: { alias: "BBTTCC Radiation" }
      });

      console.log(TAG, `Applied +${amt} RP from zone '${zone.intensity}' to`, name);
    } catch (err) {
      console.warn(TAG, "afterTravel zone handler failed:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Advance Turn Integration — zone drift on bbttcc:advanceTurn:end
  // ---------------------------------------------------------------------------

  function nextIntensity(current, drift) {
    const idx = intensityIndex(current);
    if (drift === "rising")  return ORDER[Math.min(ORDER.length - 1, idx + 1)];
    if (drift === "falling") return ORDER[Math.max(0, idx - 1)];
    return ORDER[idx]; // stable
  }

  async function handleAdvanceTurnEnd() {
    const radSettings = game.settings;
    const enableDrift = radSettings?.get(MOD_SCN, "enableZoneDrift") ?? true;

    if (!enableDrift) return;

    const scenes = game.scenes ?? [];
    const updates = [];
    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
    const lines = [];

    for (const sc of scenes) {
      const zone = getZoneForScene(sc);
      if (!zone) continue;

      const before = normalizeIntensity(zone.intensity);
      const drift  = zone.drift || "stable";
      const after  = nextIntensity(before, drift);

      // Optional: random storm spike when high & rising
      let final = after;
      if (before === "high" && drift === "rising" && after === "storm") {
        // 50% chance storm, 50% stay at high
        if (Math.random() < 0.5) {
          final = "storm";
        } else {
          final = "high";
        }
      }

      if (final === before) continue;

      updates.push(
        sc.setFlag(MOD_SCN, "zone", {
          ...zone,
          intensity: final,
          updatedAt: Date.now()
        })
      );

      lines.push(
        `• <b>${foundry.utils.escapeHTML(sc.name || sc.id)}</b>: `
        + `Zone intensity ${before.toUpperCase()} → ${final.toUpperCase()} `
        + `(drift: ${drift})`
      );

      // If active scene changed, refresh overlay
      if (sc === canvas.scene) {
        drawZoneOverlay();
      }
    }

    if (updates.length) await Promise.allSettled(updates);
    if (lines.length && gmIds.length) {
      await ChatMessage.create({
        content: `<p><b>Radiation Weather Drift</b></p>${lines.join("<br/>")}`,
        whisper: gmIds,
        speaker: { alias: "BBTTCC Radiation" }
      }).catch(()=>{});
    }
  }

  // ---------------------------------------------------------------------------
  // Visual Overlay
  // ---------------------------------------------------------------------------

  function removeZoneOverlay() {
    try {
      const layer = canvas.foreground || canvas.stage;
      const old = layer.getChildByName?.("bbttcc-radiation-zone-overlay");
      if (old) old.destroy(true);
    } catch (e) {
      console.warn(TAG, "removeZoneOverlay failed", e);
    }
  }

  function drawZoneOverlay() {
    try {
      removeZoneOverlay();
      const sc = canvas.scene;
      if (!sc) return;

      const show = game.settings?.get(MOD_SCN, "showZoneOverlay") ?? true;
      if (!show) return;

      const zone = getZoneForScene(sc);
      if (!zone || normalizeIntensity(zone.intensity) === "none") return;

      const layer = canvas.foreground || canvas.stage;
      const g = new PIXI.Graphics();
      g.name = "bbttcc-radiation-zone-overlay";

      // Intensity → alpha mapping
      const intens = normalizeIntensity(zone.intensity);
      let alpha = 0.12;
      if (intens === "moderate") alpha = 0.18;
      if (intens === "high")     alpha = 0.24;
      if (intens === "storm")    alpha = 0.32;

      const col = PIXI.utils.string2hex(zone.color || "#A3E635");

      // Simple full-scene overlay for now; radius reserved for future falloff
      const w = canvas.dimensions.width;
      const h = canvas.dimensions.height;

      g.beginFill(col, alpha);
      g.drawRect(0, 0, w, h);
      g.endFill();

      // subtle noise stripes
      g.lineStyle(1, col, alpha * 0.6);
      for (let y = 0; y < h; y += 64) {
        g.moveTo(0, y);
        g.lineTo(w, y + 32);
      }

      layer.addChild(g);
      console.log(TAG, "Zone overlay drawn:", intens, "on scene", sc.name);
    } catch (e) {
      console.warn(TAG, "drawZoneOverlay failed", e);
    }
  }

  // ---------------------------------------------------------------------------
  // Settings & Hook Wiring
  // ---------------------------------------------------------------------------

  Hooks.once("init", () => {
    // World: enable/disable drift
    game.settings.register(MOD_SCN, "enableZoneDrift", {
      name: "Radiation Zones: Enable Drift",
      hint: "If enabled, scene radiation zones will drift according to their 'drift' mode each Advance Turn.",
      scope: "world",
      config: true,
      type: Boolean,
      default: true
    });

    // Client: show/hide overlay
    game.settings.register(MOD_SCN, "showZoneOverlay", {
      name: "Radiation Zones: Show Overlay",
      hint: "Draw a subtle tinted overlay on scenes with active radiation zones.",
      scope: "client",
      config: true,
      type: Boolean,
      default: true
    });
  });

  Hooks.once("ready", () => {
    publishAPI();

    // Zone-based exposure on travel
    Hooks.on("bbttcc:afterTravel", handleAfterTravel);

    // Zone drift after advance turn (driver emits begin/end hooks)
    Hooks.on("bbttcc:advanceTurn:end", handleAdvanceTurnEnd);

    // Draw overlay when canvas comes up
    Hooks.on("canvasReady", drawZoneOverlay);

    // Redraw overlay if active scene's flags change
    Hooks.on("updateScene", (scene, diff) => {
      if (scene.id !== canvas.scene?.id) return;
      if (diff.flags && diff.flags[MOD_SCN] && diff.flags[MOD_SCN].zone !== undefined) {
        drawZoneOverlay();
      }
    });

    console.log(TAG, "Radiation Zone Enhancer ready.");
  });

})();
