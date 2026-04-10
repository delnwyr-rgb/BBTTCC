// modules/bbttcc-territory/scripts/bbttcc-facility-turn-effects.enhancer.js
// BBTTCC — Facility Turn Effects Enhancer v1.1 (alpha-safe)
//
// Reads per-turn OP effects from hex facilities and applies them to the
// owning faction each Advance Turn (Apply only).
//
// Source:
//   hex.flags["bbttcc-territory"].facilities.primary.integration.turnEffectsRaw
//
// Entry shape (array):
//   {
//     "key": "facility-op-upkeep",
//     "description": "...",
//     "opDelta": { "economy": 1, "logistics": 0, ... }
//   }
//
// Notes:
// - Effects only apply if integration.autoApplyTurnEffects === true
// - Deltas are applied via game.bbttcc.api.op.commit (if available)
// - One summary whisper is sent to GMs per Apply turn
// - Hook deferred one tick to run after other end-of-turn enhancers

(() => {
  const MOD_TERR = "bbttcc-territory";
  const TAG      = "[bbttcc-facility/turn-effects]";

  const esc = (s) => {
    try { return foundry.utils.escapeHTML(String(s ?? "")); }
    catch { return String(s ?? ""); }
  };

  function isHexDrawing(dr) {
    const f = dr?.flags?.[MOD_TERR] ?? {};
    // Accept canonical markers + polygon heuristic used elsewhere in your codebase.
    if (f.isHex === true || f.kind === "territory-hex") return true;
    const pts = dr?.shape?.points;
    if (dr?.shape?.type === "p" && Array.isArray(pts) && pts.length === 12) return true;
    return false;
  }

  function ownerFactionId(tfFlags) {
    return tfFlags?.factionId || tfFlags?.ownerId || null;
  }

  function parseTurnEffects(raw, fallback = []) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== "string" || !raw.trim()) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      ui.notifications?.warn?.(
        "BBTTCC Facilities: Could not parse Turn Effects JSON; ignoring for this hex."
      );
      console.warn(TAG, "Failed to parse turnEffectsRaw:", e);
      return fallback;
    }
  }

  function accumulateOps(acc, delta) {
    if (!delta || typeof delta !== "object") return acc;
    const out = { ...acc };
    for (const [k, v] of Object.entries(delta)) {
      const key = String(k);
      const n   = Number(v ?? 0);
      if (!Number.isFinite(n) || n === 0) continue;
      out[key] = (Number(out[key] ?? 0) + n);
    }
    return out;
  }

  function sumDeltaKeys(deltas) {
    return Object.entries(deltas || {})
      .map(([k, v]) => `${k}: ${v > 0 ? "+" : ""}${v}`)
      .join(", ");
  }

  function resolveFactionName(ownerId) {
    try {
      const a = game.actors?.get?.(String(ownerId));
      return a?.name ? String(a.name) : String(ownerId);
    } catch {
      return String(ownerId);
    }
  }

  function shouldApplyFromHookArgs(args) {
    // Hook is called as Hooks.callAll("bbttcc:advanceTurn:end", { apply, ... })
    // We accept either:
    //  - args[0] is an object with {apply:true|false}
    //  - args is empty/unknown (default to apply, since this is end-of-turn)
    const ctx = args?.[0];
    if (ctx && typeof ctx === "object" && "apply" in ctx) {
      return !!ctx.apply;
    }
    return true; // safest default
  }

  async function handleAdvanceTurnEnd(...hookArgs) {
    try {
      if (!shouldApplyFromHookArgs(hookArgs)) return;

      const opApi = game.bbttcc?.api?.op;
      if (!opApi || typeof opApi.commit !== "function") {
        console.warn(TAG, "OP Engine not available; skipping facility turn effects.");
        return;
      }

      const gmIds  = (game.users ?? []).filter(u => u.isGM).map(u => u.id);
      const lines  = [];

      for (const sc of (game.scenes?.contents ?? [])) {
        for (const dr of (sc.drawings?.contents ?? [])) {
          if (!isHexDrawing(dr)) continue;

          const tf = dr.flags?.[MOD_TERR] ?? {};
          const facRoot = tf.facilities?.primary;
          if (!facRoot) continue;

          const integ = facRoot.integration ?? {};
          if (!integ.autoApplyTurnEffects) continue;

          const ownerId = ownerFactionId(tf);
          if (!ownerId) continue;

          const rawEffects =
            integ.turnEffects ??
            integ.turnEffectsRaw ??
            facRoot.integration?.turnEffectsRaw;

          const list = parseTurnEffects(rawEffects, []);
          if (!list.length) continue;

          let deltas = {};
          const appliedKeys = [];

          for (const eff of list) {
            if (!eff || typeof eff !== "object") continue;
            const key   = eff.key || "facility_effect";
            const delta = eff.opDelta || eff.delta || eff.deltas;
            deltas = accumulateOps(deltas, delta);
            appliedKeys.push(String(key));
          }

          if (!Object.keys(deltas).length) continue;

          const hexName = String(dr.name || dr.text || tf.name || `Hex ${dr.id}`);
          const facType = String(facRoot.facilityType || "Facility");
          const facLabel = facType ? (facType.charAt(0).toUpperCase() + facType.slice(1)) : "Facility";

          // Apply to OP Engine (commit refuses underflow)
          const res = await opApi.commit(ownerId, deltas, {
            source: "facility",
            hexUuid: dr.uuid,
            label: facType,
            note: "Per-turn facility effects"
          });

          const factionName = resolveFactionName(ownerId);
          const pieces = sumDeltaKeys(deltas);
          const effectsText = appliedKeys.length ? ` (effects: ${appliedKeys.join(", ")})` : "";

          if (res?.committed) {
            lines.push(
              `• <b>${esc(facLabel)}</b> in <i>${esc(hexName)}</i> → `
              + `<b>${esc(factionName)}</b>: <code>${esc(pieces)}</code>${esc(effectsText)}`
            );

            console.log(TAG, "Applied per-turn facility OP", {
              hex: hexName,
              facility: facType,
              faction: ownerId,
              deltas
            });
          } else {
            lines.push(
              `• <b>${esc(facLabel)}</b> in <i>${esc(hexName)}</i> → `
              + `<b>${esc(factionName)}</b>: <code>${esc(pieces)}</code> `
              + `<span style="opacity:0.85;">(NOT APPLIED: insufficient OP capacity/bank)</span>${esc(effectsText)}`
            );

            console.log(TAG, "Facility OP commit refused (underflow)", {
              hex: hexName,
              facility: facType,
              faction: ownerId,
              underflow: res?.underflow ?? null
            });
          }
        }
      }

      if (lines.length && gmIds.length) {
        await ChatMessage.create({
          content: `<p><b>Facility Turn Effects</b></p>${lines.join("<br/>")}`,
          whisper: gmIds,
          speaker: { alias: "BBTTCC Facilities" }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn(TAG, "AdvanceTurn handler failed:", err);
    }
  }

  Hooks.on("bbttcc:advanceTurn:end", async (...args) => {
    try {
      // Defer one tick so all other end-of-turn enhancers
      // (garrison upkeep, war logs, etc.) have finished writing.
      await new Promise(resolve => setTimeout(resolve, 0));
      await handleAdvanceTurnEnd(...args);
    } catch (e) {
      console.warn(TAG, "handleAdvanceTurnEnd failed:", e);
    }
  });

  console.log(TAG, "installed (listening on bbttcc:advanceTurn:end, deferred).");
})();
