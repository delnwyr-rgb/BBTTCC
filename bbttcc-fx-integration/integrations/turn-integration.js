const TAG = "[bbttcc-fx/turn]";

function summarizeRows(rows = []) {
  const events = [];
  for (const row of rows) {
    if (!row) continue;
    if (row.band) {
      events.push({ key: "turn_logistics_pressure", label: `${row.factionName}: ${row.band}`, kind: /critical|strained|overextended/i.test(row.band) ? "warn" : "info" });
      continue;
    }
    if (row.opsDelta) {
      const parts = Object.entries(row.opsDelta).filter(([, v]) => Number(v || 0) > 0).map(([k, v]) => `${v} ${k}`);
      if (parts.length) events.push({ key: "turn_regen", label: `${row.factionName}: ${parts.join(" • ")}`, kind: "info" });
      continue;
    }
    if (row.activity || row.label) {
      events.push({ key: "turn_activity", label: `${row.faction || row.factionName || "Faction"}: ${row.label || row.activity}`, kind: row.canAfford === false ? "warn" : "info" });
    }
  }
  return events;
}

export function installTurnIntegration(api) {
  Hooks.on("bbttcc:advanceTurn:begin", () => {
    api.playKey("turn_start", { label: "Advance Turn" }, { phase: "resolve" });
  });

  Hooks.on("bbttcc:advanceTurn:end", async () => {
    // Base event: the detailed rows arrive on wrapped calls; here we still provide an end cap.
    api.playKey("turn_end", { label: "Turn Complete" }, { phase: "resolve" });
  });

  const terr = game.bbttcc?.api?.territory;
  if (!terr || typeof terr.advanceTurn !== "function" || terr.__bbttccFXTurnPatched) return;
  terr.__bbttccFXTurnPatched = true;

  const orig = terr.advanceTurn.bind(terr);
  terr.advanceTurn = async function wrappedAdvanceTurn(args = {}) {
    const res = await orig(args);
    try {
      if (args?.apply) {
        const events = summarizeRows(res?.rows || []);
        if (events.length) await api.playTurnPresentation(events, { speed: "normal" });
      }
    } catch (err) {
      console.warn(TAG, "turn presentation failed", err);
    }
    return res;
  };

  console.log(TAG, "Turn integration patched.");
}
