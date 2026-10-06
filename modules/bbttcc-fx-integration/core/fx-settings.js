export function installFXSettings() {
  // MUST match the module id in module.json — was "bbttcc-fx" (a package that
  // doesn't exist), which made every settings read throw and fall back to the
  // hardcoded defaults (atlas 🔴 #7, fixed 2026-08-28).
  const MOD = "bbttcc-fx-integration";
  const reg = (key, data) => {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      game.settings.register(MOD, key, data);
    }
  };

  reg("enabled", {
    name: "Enable Bad Eden FX",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  reg("ui_enabled", {
    name: "Enable Bad Eden UI FX",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  reg("turn_enabled", {
    name: "Enable Turn Presentation FX",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  reg("intensity", {
    name: "FX Intensity",
    hint: "Controls animation duration and screen treatment.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      low: "Low",
      normal: "Normal",
      high: "High"
    },
    default: "normal"
  });

  // MOMENTS (core/fx-moments.js) — on-screen + sound stings for big events.
  reg("moments_enabled", {
    name: "Enable Moments",
    hint: "On-screen moments for big events: Surge banked, Receipts, the Adversary, Sparks, quests.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  reg("moments_sound", {
    name: "Moment Sound Stings",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  reg("moments_volume", {
    name: "Moment Sound Volume",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.7
  });
}
