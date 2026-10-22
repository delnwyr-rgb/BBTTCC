// bbttcc-factions · rigs-rfi.output.js — RIG OUTPUT for Roll for Initiation worlds (owner ruling 2026-10-21).
//
// The rig sheet has promised "Parked 100% · Deployed 50% · Destroyed 0%" since May and the rig tour tells players a
// parked rig is a little factory — but on fourththing worlds nothing ever paid it ("Phase 6 wiring" was never built;
// rigs-dnd5e.runtime.js is the dnd5e twin and stays DORMANT here). This file is that wiring:
//
//   output(rig, {state})  → { marks: {channel: n}, materials: {key: n}, state }   for ONE strategic turn
//     · base output by size (RIG_BASE_OUTPUT_OP, economy constants) — rigs that MOVE only (mobile / hybrid)
//     · + every equipped output-module's `rigGear.yield`: bank channels (logistics, faith, …) → marks; anything else
//       (steel, parts, supplies, meat …) → the faction stockpile as materials
//     · × the state throttle (RIG_OUTPUT_STATE_MULT): parked 1, deployed 0.5 (modules that are not mobileLegal → 0),
//       destroyed 0. Marks are halved in MARKS (no OP flooring); materials floor.
//   preview(rig)          → { state, parked, deployed, parkedText, deployedText, lostText }  — the opportunity cost
//   applyTurnOutput()     → pays every faction-owned rig at `bbttcc:advanceTurn:end` (apply, active GM) + GM card
//
// Registered on game.bbttcc.rigs.impl as { outputFor, outputPreview, applyTurnOutput, describeOutput } — fourththing only.
import { RIG_BASE_OUTPUT_OP, RIG_OUTPUT_STATE_MULT } from "/modules/bbttcc-core/scripts/economy.constants.js";

(() => {
  const TAG = "[bbttcc-factions/rigs-rfi.output]";
  if (game?.system?.id && game.system.id !== "fourththing") return;   // the dnd5e runtime owns output there

  const R  = () => game.bbttcc?.rigs;
  const OP = () => game.bbttcc?.api?.op;
  const CHANNELS = ["violence", "nonlethal", "intrigue", "economy", "softpower", "diplomacy", "logistics", "culture", "faith"];
  const LABEL = { violence: "Violence", nonlethal: "Nonlethal", intrigue: "Intrigue", economy: "Economy", softpower: "Soft Power", diplomacy: "Diplomacy", logistics: "Logistics", culture: "Culture", faith: "Faith" };
  const marksPerOp = () => { const op = OP(); const n = Number(op?.marksPerOp?.() ?? op?.OP_TO_MARKS); return Number.isFinite(n) && n > 0 ? n : 0; };
  const pretty = (k) => String(k || "").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  function frameOf(rig) { return (rig?.items ?? []).find?.(i => i?.flags?.fourththing?.rigGear?.subtype === "rig-frame") ?? null; }
  function bracketOf(rig) {
    const fb = frameOf(rig)?.flags?.fourththing?.rigFrame?.bracket;
    return String(fb || R()?.data?.(rig)?.integrity?.bracket || rig?.system?.integrity?.bracket || "medium").toLowerCase();
  }
  function mobilityOf(rig) { return String(R()?.data?.(rig)?.identity?.mobility ?? rig?.system?.identity?.mobility ?? "mobile").toLowerCase(); }
  function stateOf(rig) { return String(R()?.data?.(rig)?.identity?.state ?? rig?.system?.identity?.state ?? "parked").toLowerCase(); }

  /** Raw (parked, 100%) output: { op: {channel: OP}, mats: {key: n, mobileLegal map} } */
  function rawOutput(rig) {
    const op = {}, mats = {}, matMobile = {}, opMobile = {};
    const addOp = (ch, n, mobileLegal) => { const v = Number(n) || 0; if (v <= 0) return; op[ch] = (op[ch] || 0) + v; opMobile[ch] = (opMobile[ch] || 0) + (mobileLegal ? v : 0); };
    const addMat = (k, n, mobileLegal) => { const v = Math.floor(Number(n) || 0); if (v <= 0) return; mats[k] = (mats[k] || 0) + v; matMobile[k] = (matMobile[k] || 0) + (mobileLegal ? v : 0); };
    if (mobilityOf(rig) !== "stationary") for (const [ch, n] of Object.entries(RIG_BASE_OUTPUT_OP[bracketOf(rig)] || {})) addOp(ch, n, true);
    for (const it of (rig?.items ?? [])) {
      const g = it?.flags?.fourththing?.rigGear;
      if (g?.subtype !== "output-module") continue;
      if (it.system?.equipped === false) continue;
      const mobileLegal = g.mobileLegal !== false;
      for (const [k, n] of Object.entries(g.yield || g.perTurn || {})) {
        const key = String(k).toLowerCase();
        if (CHANNELS.includes(key)) addOp(key, n, mobileLegal); else addMat(key, n, mobileLegal);
      }
    }
    return { op, opMobile, mats, matMobile };
  }

  /** One turn's output at a given state (default: the rig's current state). Marks, not OP. */
  function outputFor(rig, { state = null } = {}) {
    const st = String(state || stateOf(rig)).toLowerCase();
    const mult = Number(RIG_OUTPUT_STATE_MULT[st] ?? 1);
    const out = { state: st, marks: {}, materials: {} };
    if (!rig || mult <= 0) return out;
    const per = marksPerOp();
    const raw = rawOutput(rig);
    const deployedish = st !== "parked";
    for (const [ch, v] of Object.entries(raw.op)) {
      const base = deployedish ? raw.opMobile[ch] || 0 : v;
      const m = Math.round(base * per * mult);
      if (m > 0) out.marks[ch] = m;
    }
    for (const [k, v] of Object.entries(raw.mats)) {
      const base = deployedish ? raw.matMobile[k] || 0 : v;
      const n = Math.floor(base * mult);
      if (n > 0) out.materials[k] = n;
    }
    return out;
  }

  function describeOutput(out) {
    const parts = [];
    for (const [ch, m] of Object.entries(out?.marks || {})) parts.push(`+${m} ${LABEL[ch] || pretty(ch)} marks`);
    for (const [k, n] of Object.entries(out?.materials || {})) parts.push(`+${n} ${pretty(k)}`);
    return parts.length ? parts.join(", ") : "nothing";
  }

  /** The opportunity cost, for the sheet + Domain tab. */
  function outputPreview(rig) {
    const parked = outputFor(rig, { state: "parked" });
    const deployed = outputFor(rig, { state: "deployed" });
    const lost = { marks: {}, materials: {} };
    for (const [ch, m] of Object.entries(parked.marks)) { const d = m - (deployed.marks[ch] || 0); if (d > 0) lost.marks[ch] = d; }
    for (const [k, n] of Object.entries(parked.materials)) { const d = n - (deployed.materials[k] || 0); if (d > 0) lost.materials[k] = d; }
    const has = (o) => Object.keys(o.marks).length || Object.keys(o.materials).length;
    return {
      state: stateOf(rig), produces: !!has(parked),
      parked, deployed, lost,
      parkedText: describeOutput(parked), deployedText: describeOutput(deployed),
      lostText: has(lost) ? describeOutput(lost).replace(/\+/g, "−") : "nothing"
    };
  }

  async function applyTurnOutput({ quiet = false } = {}) {
    const report = [];
    const Rg = R(); if (!Rg?.isRig) return report;
    const op = OP(); const stock = game.bbttcc?.api?.factions?.stockpile || game.bbttcc?.api?.stockpile;
    for (const rig of (game.actors?.contents ?? []).filter(a => Rg.isRig(a))) {
      const fid = String(Rg.ownerOf?.(rig) || "").replace(/^Actor\./, "");
      const faction = fid ? game.actors.get(fid) : null;
      if (!faction) continue;
      const out = outputFor(rig);
      if (!Object.keys(out.marks).length && !Object.keys(out.materials).length) continue;
      const entry = { rig: rig.name, state: out.state, faction: faction.name, text: describeOutput(out), refused: null };
      try {
        if (Object.keys(out.marks).length) {
          const res = await op?.commit?.(faction.id, out.marks, { source: "rig", context: "rig-output", rigId: rig.id, rigName: rig.name });
          if (res && res.ok === false) entry.refused = String(res.error || "refused (cap?)");
        }
        for (const [k, n] of Object.entries(out.materials)) {
          const r = await stock?.adjust?.(faction, k, n, { name: pretty(k) });
          if (r && r.ok === false) entry.refused = (entry.refused ? entry.refused + "; " : "") + `${k}: ${r.error}`;
        }
      } catch (e) { entry.refused = String(e?.message || e); console.warn(TAG, "credit failed", rig.name, e); }
      report.push(entry);
    }
    if (!quiet && report.length) {
      const icon = { parked: "🅿️", deployed: "🚚", destroyed: "💥" };
      const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
      const rows = report.map(r => `<tr><td>${icon[r.state] || ""} ${esc(r.rig)}</td><td>${esc(r.faction)}</td><td>${esc(r.text)}${r.refused ? ` · ⚠ ${esc(r.refused)}` : ""}</td></tr>`).join("");
      try {
        await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" },
          content: `<div style="border-left:3px solid #b9882e;padding:.35em .6em;"><b>🛻 Rig output — this turn</b><table style="font-size:.8em;width:100%;margin-top:.25em"><tr><th style="text-align:left">Rig</th><th style="text-align:left">Faction</th><th style="text-align:left">Earned</th></tr>${rows}</table><div style="opacity:.7;font-size:.78em;margin-top:.2em">Parked rigs earn in full; deployed rigs earn half; destroyed rigs earn nothing.</div></div>` });
      } catch (e) { console.warn(TAG, "summary card failed", e); }
    }
    return report;
  }

  Hooks.on("bbttcc:advanceTurn:end", async (payload = {}) => {
    try {
      if (!game.user?.isGM) return;
      if (game.users?.activeGM?.id !== game.user?.id) return;
      if (payload?.apply !== true) return;
      await new Promise(r => setTimeout(r, 0));
      await applyTurnOutput();
    } catch (e) { console.warn(TAG, "turn output pass failed", e); }
  });

  const register = () => {
    const Rg = R(); if (!Rg) return;
    Rg.impl = Rg.impl || {};
    Object.assign(Rg.impl, { outputFor, outputPreview, applyTurnOutput, describeOutput });
    // the accessor's own `outputFor` / `applyTurnOutput` route through impl via via(); expose the preview directly too
    Rg.outputPreview = outputPreview;
  };
  Hooks.once("init", register);
  Hooks.once("setup", register);
  Hooks.once("ready", () => { register(); console.log(TAG, "registered on game.bbttcc.rigs (base output by size · module yields · parked/deployed throttle · turn payout)"); });
})();
