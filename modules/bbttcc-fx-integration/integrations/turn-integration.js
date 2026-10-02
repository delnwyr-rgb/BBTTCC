const TAG = "[bbttcc-fx/turn]";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

// Finalized planned strategic entries carry { targetUuid, targetType, activityKey }.
// Those are the rows that map to a hex on the map — pop a JB2A loop over each.
function plannedHexRows(rows = []) {
  const out = [];
  for (const r of rows) {
    if (!r || !r.targetUuid) continue;
    const tt = String(r.targetType || "hex").toLowerCase();
    if (tt && tt !== "hex") continue;
    out.push({
      key: String(r.activityKey || r.activity || "turn_activity"),
      hexUuid: r.targetUuid,
      label: r.targetName || r.summary || ""
    });
  }
  return out;
}

async function playHexActivityRows(api, rows = []) {
  const hexes = plannedHexRows(rows);
  for (const h of hexes) {
    try {
      await api.playHexActivity(h.key, h.hexUuid, { label: h.label });
    } catch (err) {
      console.warn(TAG, "hex fx failed", err);
    }
    await wait(650);
  }
}

export function installTurnIntegration(api) {
  // No advanceTurn:begin/end listeners: the turn driver already plays
  // turn_start / turn_complete + the turn cards on APPLIED turns only. Hook
  // listeners here ignored {apply} (dry runs broadcast "Turn Complete") and
  // doubled everything on applied turns.

  const terr = game.bbttcc?.api?.territory;
  if (!terr || typeof terr.advanceTurn !== "function" || terr.__bbttccFXTurnPatched) return;
  terr.__bbttccFXTurnPatched = true;

  const orig = terr.advanceTurn.bind(terr);
  terr.advanceTurn = async function wrappedAdvanceTurn(args = {}) {
    const res = await orig(args);
    // Hex pops are cosmetic: fire-and-forget so callers (and later
    // advanceTurn wrappers) aren't stalled ~650ms per row. Turn cards are
    // owned by the driver.
    if (args?.apply) {
      void playHexActivityRows(api, res?.rows || []).catch((err) => console.warn(TAG, "hex fx failed", err));
    }
    return res;
  };

  console.log(TAG, "Turn integration patched.");
}
