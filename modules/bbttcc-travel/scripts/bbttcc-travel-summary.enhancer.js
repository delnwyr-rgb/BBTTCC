/* Bad Eden — Travel Summary Enhancer v1.2
 * GM-whisper summary of each travel leg.
 * v1.2 (2026-10-01): a `bbttcc:afterTravel` listener instead of a travelHex wrapper — api.travel's drift guard
 * reverted the wrapper within 250 ms, so no summary was ever posted. The core emit (the one without
 * ctx.encounter) is the leg; encounter re-emits are a second hook for the same leg and are skipped.
 */

(() => {
  const TAG = "[bbttcc-travel-summary]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));

  function hexLabel(ref) {
    const d = ref?.document ?? ref;
    const tf = d?.flags?.["bbttcc-territory"] || {};
    return String(tf.name || d?.text || d?.name || "(hex)").replace(/[\s ]+/g, " ").trim();
  }

  async function onAfterTravel(ctx) {
    try {
      if (!ctx || ctx.encounter || ctx.preview || ctx.relayed) return;
      const fname = ctx.actor?.name || "Unknown Faction";
      const fromLabel = ctx.from ? hexLabel(ctx.from) : "(from)";
      const toLabel = ctx.to ? hexLabel(ctx.to) : "(to)";
      const spent = Object.entries(ctx.cost || {})
        .filter(([_, v]) => Number(v) > 0)
        .map(([k, v]) => `${esc(k)} ${Number(v)} marks`)
        .join(", ") || "—";
      const check = (ctx.rollTotal != null && ctx.dc != null)
        ? `Travel check ${Number(ctx.rollTotal)} vs DC ${Number(ctx.dc)} — ${ctx.success ? "safe" : (ctx.preventHazard ? "hazard prevented" : "encounter")}`
        : "";
      log(`${fname}: traveled ${fromLabel} → ${toLabel}`);
      await ChatMessage.create({
        content: `<p><b>${esc(fname)}</b> traveled ${esc(fromLabel)} → ${esc(toLabel)}<br/>Spent: ${spent}${check ? `<br/>${check}` : ""}</p>`,
        whisper: game.users.filter(u => u.isGM).map(u => u.id) ?? [],
        speaker: { alias: "Bad Eden Travel" }
      });
    } catch (e) {
      warn("summary enhancer error:", e);
    }
  }

  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    Hooks.on("bbttcc:afterTravel", onAfterTravel);
    log("Travel Summary Enhancer installed (afterTravel listener).");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();
