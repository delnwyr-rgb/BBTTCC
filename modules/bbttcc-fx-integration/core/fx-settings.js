export function installFXSettings() {
  const MOD = "bbttcc-fx";
  const reg = (key, data) => {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      game.settings.register(MOD, key, data);
    }
  };

  reg("enabled", {
    name: "Enable BBTTCC FX",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  reg("ui_enabled", {
    name: "Enable BBTTCC UI FX",
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
}
