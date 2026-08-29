/* consult-gm-advisor.macro.js — hotbar macro (GM).
 * One press = one GM Advisor consult (one API call on the world's key).
 * The advisor whispers strategic advice grounded in the rules engine's
 * canon suggestions (beats / tables / world signals). 2026-08-28.
 */
(async () => {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
  const advisors = game.bbttcc?.mal?.advisors;
  if (!advisors?.gm) return ui.notifications?.warn?.("Advisor wiring not loaded (bbttcc-mal-voice).");
  ui.notifications?.info?.("Consulting the GM Advisor…");
  const res = await advisors.gm({ mode: "free" });
  if (res && res.ok === false) {
    ui.notifications?.warn?.(`GM Advisor: ${res.error || "no response"}${res.message ? " — " + res.message : ""}`);
  }
})();
