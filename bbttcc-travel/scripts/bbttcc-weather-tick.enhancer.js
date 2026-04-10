// modules/bbttcc-territory/scripts/bbttcc-weather-tick.enhancer.js
// BBTTCC — Weather Tick (Alpha)
// Decrements flags.bbttcc-territory.weather.remainingTurns and clears when expired.
// Must be passive: never blocks turn driver.

(() => {
  const TAG = "[bbttcc-weather-tick]";
  const warn = (...a) => console.warn(TAG, ...a);

  async function tickWeather() {
    try {
      // Best-effort: walk all scenes + drawings (matches how other territory systems scan)
      for (const sc of (game.scenes || [])) {
        const draws = sc.drawings || [];
        for (const d of draws) {
          const tf = d.flags?.["bbttcc-territory"];
          const w = tf?.weather;
          if (!w) continue;

          const turns = Number(w.remainingTurns || 0);
          if (turns <= 1) {
            // Clear whole weather object
            await d.unsetFlag("bbttcc-territory", "weather").catch(() => {});
          } else {
            await d.update({
              "flags.bbttcc-territory.weather.remainingTurns": turns - 1
            }, { parent: sc }).catch(() => {});
          }
        }
      }
    } catch (e) {
      warn("tickWeather failed (non-fatal)", e);
    }
  }

  function install() {
    Hooks.on("bbttcc:advanceTurn:end", () => {
      // Let other end-of-turn hooks finish first
      setTimeout(() => { tickWeather(); }, 0);
    });
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();
