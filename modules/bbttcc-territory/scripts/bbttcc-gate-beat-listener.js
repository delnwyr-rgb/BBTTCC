/* bbttcc-gate-beat-listener.js
 *
 * Subscribes to the campaign-module `bbttcc:beat:resolved` hook and flips
 * `flags.bbttcc-territory.leylines.gate.enabled` on each hex named in
 * `beat.gateUnlocks`. This is the executor side of the Leygate quest-unlock
 * machinery — beats are authored in the Campaign Beat Editor's "Gate
 * Unlocks" panel, the GM resolves a beat, and one or more anchor gates flip
 * open (or closed) automatically.
 *
 * Payload contract (mirrors tikkun-beat-listener):
 *   Hook: bbttcc:beat:resolved
 *   Args: { campaign, beat, ctx, outcome }
 *
 * Beat schema:
 *   beat.gateUnlocks: [{ hexUuid: string, action: "enable" | "disable" }]
 *
 * Only the GM mutates state — beats fire on every client and we don't want
 * N writes for N players.
 */
(() => {
  const TAG = "[bbttcc-territory:gate-beat-listener]";

  Hooks.once("ready", () => {
    Hooks.on("bbttcc:beat:resolved", async ({ campaign, beat, ctx, outcome }) => {
      try {
        const list = Array.isArray(beat?.gateUnlocks) ? beat.gateUnlocks : null;
        if (!list || !list.length) return;

        if (!game.user?.isGM) return;

        const results = [];
        for (const entry of list) {
          const hexUuid = String(entry?.hexUuid || "").trim();
          const action  = String(entry?.action  || "enable").trim().toLowerCase();
          if (!hexUuid) continue;

          let dr = null;
          try { dr = await fromUuid(hexUuid); } catch (e) { /* below */ }
          if (!dr) {
            console.warn(TAG, "gateUnlocks: hex not found", { beat: beat?.id, hexUuid });
            results.push({ hexUuid, action, ok:false, reason:"not-found" });
            continue;
          }

          const currentGate = foundry.utils.deepClone(
            dr.flags?.["bbttcc-territory"]?.leylines?.gate || {}
          );
          const nextEnabled = (action === "disable") ? false : true;

          // Idempotent — skip the write if we'd be a no-op.
          if (currentGate.enabled === nextEnabled) {
            results.push({ hexUuid, action, ok:true, skipped:true, name: dr.flags?.["bbttcc-territory"]?.name || dr.text });
            continue;
          }

          const nextGate = Object.assign(
            { enabled:false, linkHexUuid:"", strength:0.5, minFactionTier:"T2", locked:false },
            currentGate,
            { enabled: nextEnabled }
          );

          try {
            await dr.update({ "flags.bbttcc-territory.leylines.gate": nextGate });
            results.push({
              hexUuid,
              action,
              ok:true,
              name: dr.flags?.["bbttcc-territory"]?.name || dr.text || "Hex",
              partner: nextGate.linkHexUuid || ""
            });
          } catch (e) {
            console.error(TAG, "gate update failed", { beat: beat?.id, hexUuid, error: e });
            results.push({ hexUuid, action, ok:false, reason:"update-failed" });
          }
        }

        if (!results.length) return;

        // Audit log — one chat card per beat, summarizing all flips.
        const rows = results.map(r => {
          const verb = r.action === "disable" ? "Closed" : "Opened";
          const skip = r.skipped ? " <em>(already in state)</em>" : "";
          const fail = r.ok ? "" : ` <span style="color:#c66;">— failed (${r.reason})</span>`;
          const nm   = r.name || r.hexUuid;
          return `<li><strong>${verb}</strong>: ${nm}${skip}${fail}</li>`;
        }).join("");

        const beatLabel = beat?.label || beat?.id || "(beat)";
        const campLabel = campaign?.label || campaign?.id || "campaign";
        await ChatMessage.create({
          content: `<div><h3 style="margin:.1rem 0;">Leygate beat: ${beatLabel}</h3>
                    <p style="margin:0 0 .3rem; opacity:.8;">${campLabel}</p>
                    <ul style="margin:.2rem 0 .1rem .9rem;">${rows}</ul></div>`,
          whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id)
        });

        Hooks.callAll("bbttcc:gate:unlocked", { campaign, beat, results });
      } catch (e) {
        console.error(TAG, "listener failed", e);
      }
    });

    console.log(TAG, "ready");
  });
})();
