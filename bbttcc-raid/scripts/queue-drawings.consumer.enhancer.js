/* queue-drawings.consumer.enhancer.js
 * bbttcc-raid/queue-drawings v1.0.8 — Spam-free readiness gate (hard stop)
 *
 * Legacy intent: wrap raid API queue consumer consumeQueuedTurnEffects when available.
 * Current reality: many builds do not expose consumeQueuedTurnEffects.
 *
 * Alpha safety guarantees:
 * - Never infinite-retry.
 * - After disable, no further scheduled ticks will do work (hard stop).
 * - At most ONE warning when disabled.
 */
(() => {
  const TAG = "[bbttcc-raid/queue-drawings v1.0.8]";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  function getRaidApi() {
    return game?.bbttcc?.api?.raid || null;
  }

  function meta(api) {
    return {
      raidModuleActive: !!game.modules.get("bbttcc-raid")?.active,
      raidVersion: game.modules.get("bbttcc-raid")?.version,
      raidApiKeys: api ? Object.keys(api) : null
    };
  }

  const MAX_TRIES = 20;   // ~5s
  const INTERVAL  = 250;

  let tries = 0;
  let warned = false;
  let stopped = false;
  let timerId = null;

  function stop() {
    stopped = true;
    if (timerId) {
      try { clearTimeout(timerId); } catch (e) {}
      timerId = null;
    }
  }

  function schedule() {
    if (stopped) return;
    timerId = setTimeout(tick, INTERVAL);
  }

  function tick() {
    if (stopped) return;

    tries += 1;
    const api = getRaidApi();
    const fn  = api?.consumeQueuedTurnEffects;

    // If present, wrap once and stop.
    if (typeof fn === "function") {
      if (!fn.__bbttcc_qd_wrapped) {
        const wrapped = async function(...args) { return await fn.apply(this, args); };
        wrapped.__bbttcc_qd_wrapped = true;
        api.consumeQueuedTurnEffects = wrapped;
        log("consumeQueuedTurnEffects wrapper installed.", meta(api));
      }
      stop();
      return;
    }

    if (tries >= MAX_TRIES) {
      if (!warned) {
        warned = true;
        warn("consumeQueuedTurnEffects not available; queue-drawings consumer disabled.", meta(api));
      }
      stop();
      return;
    }

    schedule();
  }

  Hooks.once("ready", () => {
    log("API ready.");
    timerId = setTimeout(tick, 0);
  });
})();
