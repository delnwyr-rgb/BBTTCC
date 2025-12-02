/* BBTTCC — Travel Summary Enhancer v1.1
 * Lightweight logger for api.travel.travelHex() results.
 * Prints readable summaries to console and Foundry chat for GMs.
 */

(() => {
  const TAG = "[bbttcc-travel-summary]";
  const log = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);

  /** Resolve a hex identifier (ID or UUID) to a nice label. */
  async function resolveHexLabel(ident) {
    if (!ident) return "";

    // 1) Try as drawing ID on the active canvas.
    const byId = canvas?.drawings?.get(ident);
    if (byId) {
      const doc = byId.document;
      return doc.text || doc.name || "(hex)";
    }

    // 2) Try as UUID.
    try {
      const doc = await fromUuid(ident);
      const obj = doc?.object ?? doc ?? null;
      if (!obj) return "(hex)";
      const d = obj.document ?? obj;
      return d.text || d.name || obj.name || "(hex)";
    } catch {
      return "(hex)";
    }
  }

  function install() {
    const api = game.bbttcc?.api?.travel;
    if (!api || typeof api.travelHex !== "function") {
      return warn("api.travel.travelHex not found; summary enhancer idle.");
    }

    // Wrap once
    if (api.__summaryWrapped) return;
    const base = api.travelHex.bind(api);

    api.travelHex = async function travelHex_withSummary(args = {}) {
      const res = await base(args).catch(e => {
        warn("travelHex failed", e);
        return { ok: false, error: e };
      });

      try {
        const factionId = args.factionId || args.attackerId;
        const A = factionId
          ? game.actors.get(String(factionId).replace(/^Actor\./, ""))
          : null;
        const fname = A?.name || "Unknown Faction";

        // NEW: resolve IDs OR UUIDs to labels
        const fromLabel = args.hexFrom ? await resolveHexLabel(args.hexFrom) : "(from)";
        const toLabel   = args.hexTo   ? await resolveHexLabel(args.hexTo)   : "(to)";

        if (res?.ok) {
          const spent = Object.entries(res.cost || {})
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(", ") || "—";

          const encounter = res.encounter?.triggered
            ? `Encounter (Tier ${res.encounter.tier}): ${res.encounter.result?.label ?? "Unknown"}`
            : "No encounter";

          const summaryHtml = `<p><b>${fname}</b> traveled ${fromLabel} → ${toLabel}<br/>
            Spent: ${spent}<br/>${encounter}</p>`;

          // Console log still uses res.summary from api.travel (nice for debugging)
          if (res.summary) log(`${fname}: ${res.summary}`);
          else log(`${fname}: traveled ${fromLabel} → ${toLabel}`);

          await ChatMessage.create({
            content: summaryHtml,
            whisper: game.users.filter(u => u.isGM).map(u => u.id) ?? [],
            speaker: { alias: "BBTTCC Travel" }
          });
        }
      } catch (e) {
        warn("summary enhancer error:", e);
      }

      return res;
    };

    api.__summaryWrapped = true;
    log("Travel Summary Enhancer installed.");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();
