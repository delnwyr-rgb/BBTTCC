/* Bad Eden — Onboarding SETUP  — run as a GM macro IN-WORLD.  Idempotent.
 *
 * Authors the dedicated tutorial Scene(s) the onboarding director dives into, stamping
 * each with flags["bbttcc-onboarding"].tutorialScene = "<key>" so the director resolves
 * them by flag (no stale UUIDs). Re-run anytime — existing scenes are reused, not duped.
 *
 * Phase 1 seeds only the INCARNATION scene (solid-colour background so it always renders;
 * swap in art via Scene config anytime). Later phases extend the SCENES list below
 * (meatsuit range, driving course, sandbox hex, hostile hex...).
 *
 * After running:  game.bbttcc.onboarding.start()
 */
(async () => {
  const MOD = "bbttcc-onboarding";
  if (!game.user.isGM) return ui.notifications.error("Onboarding setup must be run by a GM.");

  const SCENES = [
    { key: "incarnation",    name: "Onboarding — Incarnation",   w: 2000, h: 1400, color: "#0b0e16" },
    { key: "meatsuit-range", name: "Onboarding — Proving Range", w: 2000, h: 1400, color: "#10131c" },
    { key: "driving-course", name: "Onboarding — Test Track",    w: 3000, h: 1800, color: "#0e1018" }
    // future phases:
    // { key: "sandbox-hex",    name: "Onboarding — Sandbox Hex",   w: 2400, h: 2000, color: "#0c120c" },
    // { key: "hostile-hex",    name: "Onboarding — Hostile Hex",   w: 2400, h: 2000, color: "#1a0c0c" },
  ];

  const made = [], reused = [];
  for (const cfg of SCENES) {
    let sc = game.scenes.find(s => s.getFlag(MOD, "tutorialScene") === cfg.key);
    if (!sc) {
      const [created] = await Scene.createDocuments([{
        name: cfg.name,
        width: cfg.w,
        height: cfg.h,
        padding: 0.2,
        backgroundColor: cfg.color,
        background: { src: null },
        grid: { type: CONST.GRID_TYPES.GRIDLESS, size: 100 },
        initial: null,
        navigation: false,                 // keep tutorial scenes out of the nav bar
        flags: { [MOD]: { tutorialScene: cfg.key } }
      }]);
      sc = created;
      made.push(sc.name);
    } else {
      reused.push(sc.name);
    }
  }

  const msg = [
    `<b>Onboarding setup complete.</b>`,
    `<ul style="margin:.25rem 0 0 1rem;padding:0;">`,
    `<li>Created: ${made.length ? made.map(n => foundry.utils.escapeHTML(n)).join(", ") : "—"}</li>`,
    `<li>Reused: ${reused.length ? reused.map(n => foundry.utils.escapeHTML(n)).join(", ") : "—"}</li>`,
    `</ul>`,
    `<div style="margin-top:.4rem;">Begin with <code>game.bbttcc.onboarding.start()</code>. Inspect state with <code>game.bbttcc.onboarding.status()</code>.</div>`
  ].join("");
  ChatMessage.create({ content: msg, whisper: [game.user.id] });
  ui.notifications.info(`Onboarding scenes ready — created ${made.length}, reused ${reused.length}.`);
  console.log("[bbttcc-onboarding] setup:", { made, reused });
})();
