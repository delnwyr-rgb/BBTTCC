// modules/bbttcc-territory/scripts/bbttcc-facility-turn-effects.enhancer.js
// Bad Eden — Facility Turn Effects Enhancer v1.1 (alpha-safe)
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
  // Table announcements (2026-10-12): Apply-time turn cards, track updates and raid round cards used
  // to be hard-whispered to the GM list, so players never saw a Turn go by. World setting
  // bbttcc-territory.tableAnnouncements decides: "public" (default) = whole table, "gm" = whisper.
  const tableAudience = () => { try { if (game.settings.get("bbttcc-territory", "tableAnnouncements") === "gm") return (game.users ?? []).filter(u => u.isGM).map(u => u.id); } catch (_e) {} return []; };

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
        "Bad Eden Facilities: Could not parse Turn Effects JSON; ignoring for this hex."
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

          // 10-29 (#16): a facility sieged to breached/destroyed (damageStep >= 3) earns nothing — the effects pay
          // "while operational". Mirrors getFacilityRaidProfile (raid-console), which already treats step >= 3 as inert.
          // Repair (repair_fortifications) lowers damageStep and the income resumes.
          // The numeric step wins: repair_fortifications (compat-bridge) lowers damageStep but leaves the old damageState
          // string behind, so the state name only decides when no step is stored.
          const hasStep  = (facRoot.damageStep ?? facRoot.damageIndex) != null;
          const dmgStep  = Number(facRoot.damageStep ?? facRoot.damageIndex ?? 0) || 0;
          const dmgState = String(facRoot.damageState || "").toLowerCase();
          if (hasStep ? dmgStep >= 3 : (dmgState === "breached" || dmgState === "destroyed")) {
            const dHex = String(dr.name || dr.text || tf.name || `Hex ${dr.id}`);
            const dType = String(facRoot.facilityType || "Facility");
            const dLabel = dType.charAt(0).toUpperCase() + dType.slice(1);
            lines.push(
              `• <b>${esc(dLabel)}</b> in <i>${esc(dHex)}</i> → `
              + `<b>${esc(resolveFactionName(ownerId))}</b>: `
              + `<span style="opacity:0.85;">(${esc(dmgState || "breached")} — no income until repaired)</span>`
            );
            continue;
          }

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

          // #64 (2026-10-28): one channel at its cap used to refuse the WHOLE facility (all-or-nothing) and the card blamed
          // "insufficient". Positive deltas are clamped to each channel's headroom first; what's left over is reported.
          // 10-29: the clamp runs INSIDE the engine's commit queue (clampToCap) against the bank it reads there —
          // a getFlag read here raced same-turn rig/spark credits and the whole delta was refused.
          // Apply to OP Engine (commit refuses underflow)
          const res = await opApi.commit(ownerId, deltas, {
            source: "facility",
            hexUuid: dr.uuid,
            label: facType,
            note: "Per-turn facility effects",
            clampToCap: true
          });
          const capped = {};
          for (const [k, v] of Object.entries(res?.clamped || {})) {
            const n = Number(v) || 0; if (n <= 0) continue;
            capped[k] = n;
            if (k in deltas) deltas[k] = Math.max(0, (Number(deltas[k]) || 0) - n);
          }

          const factionName = resolveFactionName(ownerId);
          const pieces = sumDeltaKeys(deltas);
          const effectsText = appliedKeys.length ? ` (effects: ${appliedKeys.join(", ")})` : "";

          const cappedTxt = Object.keys(capped).length ? ` <span style="opacity:0.85;">(at cap — ${esc(Object.entries(capped).map(([k, v]) => `${v} ${k}`).join(", "))} marks not taken)</span>` : "";
          if (res?.committed) {
            lines.push(
              `• <b>${esc(facLabel)}</b> in <i>${esc(hexName)}</i> → `
              + `<b>${esc(factionName)}</b>: <code>${esc(pieces)}</code>${cappedTxt}${esc(effectsText)}`
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
              + `<span style="opacity:0.85;">(NOT APPLIED: ${res?.underflow && Object.keys(res.underflow).length ? `the bank is short — ${esc(Object.keys(res.underflow).join(", "))}` : "the bank refused it (at cap)"})</span>${esc(effectsText)}`
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

      if (lines.length) {
        await ChatMessage.create({
          content: `<p><b>Facility Turn Effects</b></p>${lines.join("<br/>")}`,
          whisper: tableAudience(),
          speaker: { alias: "Bad Eden Facilities" }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn(TAG, "AdvanceTurn handler failed:", err);
    }
  }

  Hooks.on("bbttcc:advanceTurn:end", async (...args) => {
    try {
      if (!game.user?.isGM) return;   // world-state writes run once, on the GM
      // Defer one tick. (Garrison upkeep may still be running — every bank write goes through op.commit's
      // per-faction queue now, #11 2026-10-28, so the order no longer loses marks.)
      await new Promise(resolve => setTimeout(resolve, 0));
      await handleAdvanceTurnEnd(...args);
    } catch (e) {
      console.warn(TAG, "handleAdvanceTurnEnd failed:", e);
    }
  });

  console.log(TAG, "installed (listening on bbttcc:advanceTurn:end, deferred).");
})();
