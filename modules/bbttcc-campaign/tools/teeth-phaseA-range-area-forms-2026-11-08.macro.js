/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-range-area-forms-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C7
 * (range P25, area templates P27, hex-wide, chain P28, one Form test + nonlethal box P30, Form Type P34).
 * Dave's rulings (2026-11-08): range is a weight, not an automatic tier (P25 — the Engine asks for ONE range, in feet);
 * hex-wide is a real area ("a manifestation that impacted an entire hex"); an area never chains (P28).
 *
 * Nothing here is needed for the game to BEHAVE — the system reads every legacy shape through shims:
 *   · _ftItemRangeFt reads a power's old Range Baseline (system.range "near" …) and a Form's Short / Long when rangeFt is 0;
 *   · the normalizer reads a stored Cube as a Sphere, clamps a template size to ≥ 5 ft and turns chain off on an area item;
 *   · ftIsFormWeapon stamps a legacy Form the first time an owner / GM reads it;
 *   · a legacy mercy / nonlethal tag still reads as the Nonlethal box.
 * This macro brings the STORED data up to that, so sheets, exports and the 5E converter read the same as the game.
 *
 * Covers world items, every world actor's items and unlinked scene-token actors' own items. Compendium packs are NOT
 * touched (report counts only for the packs you name in globalThis.__teethPhaseARangeAreaFormsPacks = ["pack.id", …]).
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseARangeAreaFormsWrite = true → writes, per item, everything listed under "writes" below.
 *        Every write pins the item's current tier (system.manifestation.tier) — area / rangeFt / chain are magnitude
 *        paths, and the preUpdateItem re-score must stay off; Phase B re-scores.
 *
 * Writes (and report sections, always filled):
 *   formStamp      — weapons the legacy heuristic reads as Forms (authored concept / signature, a real cost, a
 *                    manifestation / bound / path: tag; never graded arms, Bound Working hosts, foe weapons) → flag.
 *   cubeToSphere   — area.shape cube → sphere (same size, ≥ 5).
 *   areaSizeClamp  — a template shape with size < 5 → 5.
 *   powerRange     — a power with rangeFt 0 and an old Range Baseline → rangeFt (self 0 · touch 5 · near 30 · far 60 ·
 *                    sight 120 · hex 300 · scene / unlimited 999), the Baseline removed (an explicit "self" is KEPT —
 *                    it still marks a self manifestation).
 *   powerNowTouch  — REPORT ONLY: powers with rangeFt 0 and no Baseline at all — they now read as touch (5 ft).
 *   formRange      — a Form with rangeFt 0 and Short / Long beyond touch → rangeFt (the Long, in feet); every Form's
 *                    system.range is rewritten from rangeFt (squares, touch = 1).
 *   rangelessShape — cone / line / hex items with a rangeFt → 0 (they start at the caster).
 *   chainOffArea   — chain enabled on an area item → off (it never fired from an area cast anyway).
 *   nonlethalBox   — weapons tagged mercy / nonlethal → system.nonlethal true (the tag is left in place).
 *   powerCategory  — powers carrying the unread category "manifestation" → removed.
 *   formOnFoe      — REPORT ONLY: foe-owned weapons the heuristic would have matched (never stamped — review by hand).
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseARangeAreaFormsWrite === true;
  const PACKS = Array.isArray(globalThis.__teethPhaseARangeAreaFormsPacks) ? globalThis.__teethPhaseARangeAreaFormsPacks : [];
  const FT = game.fourththing;
  const LABEL_FT = { self: 0, personal: 0, touch: 5, close: 15, near: 30, medium: 60, far: 60, long: 120, sight: 120, hex: 300, scene: 999, unlimited: 999 };
  const report = {
    WRITE, world: game.world?.id, scanned: 0,
    formStamp: [], cubeToSphere: [], areaSizeClamp: [], powerRange: [], powerNowTouch: [], formRange: [],
    rangelessShape: [], chainOffArea: [], nonlethalBox: [], powerCategory: [], formOnFoe: [], packs: {}, errors: []
  };

  const isFoe = (a) => { try { return typeof FT?.isFoeActor === "function" ? !!FT.isFoeActor(a) : false; } catch (_e) { return false; } };
  // The system's own legacy test when deployed; the same rules inline otherwise.
  const heuristic = (it, src) => {
    if (typeof FT?.formWeaponHeuristic === "function") return !!FT.formWeaponHeuristic(it);
    if (it.type !== "weapon") return false;
    const fl = it.flags?.fourththing ?? {};
    if (fl.grade || fl.working || fl.npcAuto || fl.rigGear) return false;
    if (it.parent && isFoe(it.parent)) return false;
    const mf = src.manifestation ?? {};
    const concept = String(mf.concept ?? "").trim();
    if ((concept && concept !== String(src.effect ?? "").trim()) || String(mf.signature ?? "").trim()) return true;
    const ct = String(mf.costType ?? "none").toLowerCase();
    if (ct && ct !== "none") return true;
    return (Array.isArray(src.tags) ? src.tags : []).map(t => String(t).toLowerCase()).some(t => t === "manifestation" || t === "bound" || t.startsWith("path:"));
  };
  const isFeet = (v, units) => {
    const u = String(units ?? "").toLowerCase();
    if (["sq", "squares", "square"].includes(u)) return false;
    if (["ft", "feet", "foot"].includes(u)) return true;
    const n = Number(v); return Number.isFinite(n) && n > 0 && n % 5 === 0;
  };
  const toFt = (v, units) => { const n = Number(v) || 0; return isFeet(n, units) ? n : n * 5; };
  const formRange = (ft) => { const sq = Math.max(1, Math.round(Math.max(0, Number(ft) || 0) / 5)); return { short: sq, long: sq, units: "sq" }; };

  // Returns the update for one item (empty object = nothing to write) and fills the report.
  function plan(it, where) {
    const src = it._source?.system ?? it.system ?? {};
    const mf = src.manifestation ?? {};
    const label = `${where}: ${it.name} [${it.type}] (${it.uuid})`;
    const u = {};
    report.scanned++;

    // Form stamp (P30)
    let isForm = it.type === "weapon" && foundry.utils.getProperty(it, "flags.fourththing.manifested") === true;
    if (it.type === "weapon" && !isForm) {
      if (heuristic(it, src)) { isForm = true; u["flags.fourththing.manifested"] = true; report.formStamp.push(label); }
      else if (it.parent && isFoe(it.parent)) {
        const c = String(mf.concept ?? "").trim();
        if ((c && c !== String(src.effect ?? "").trim()) || String(mf.signature ?? "").trim()) report.formOnFoe.push(label);
      }
    }

    // Area (P27 / hex)
    const area = (mf.area && typeof mf.area === "object") ? mf.area : null;
    let shape = String(area?.shape ?? "none");
    if (shape === "cube") {
      shape = "sphere";
      u["system.manifestation.area.shape"] = "sphere";
      u["system.manifestation.area.size"] = Math.max(5, Number(area.size) || 0);
      report.cubeToSphere.push(`${label} — ${area.size} ft cube → sphere`);
    } else if (!["none", "hex"].includes(shape) && area && (Number(area.size) || 0) < 5) {
      u["system.manifestation.area.size"] = 5;
      report.areaSizeClamp.push(`${label} — ${shape} ${area.size} ft → 5`);
    }

    // Range (P25)
    let rangeFt = Math.max(0, Number(mf.rangeFt) || 0);
    if (["cone", "line", "hex"].includes(shape)) {
      if (rangeFt > 0) { u["system.manifestation.rangeFt"] = 0; report.rangelessShape.push(`${label} — ${shape}, rangeFt ${rangeFt} → 0`); }
      rangeFt = 0;
    } else if (it.type === "power" && !(rangeFt > 0)) {
      const leg = typeof src.range === "string" ? src.range.trim().toLowerCase() : "";
      if (leg && leg in LABEL_FT) {
        const ft = LABEL_FT[leg];
        if (ft > 0) {
          u["system.manifestation.rangeFt"] = ft;
          u["system.-=range"] = null;
          report.powerRange.push(`${label} — Range Baseline "${leg}" → ${ft} ft`);
        } else report.powerRange.push(`${label} — Range Baseline "${leg}" kept (self, rangeFt 0)`);
      } else if (!leg || !(leg in LABEL_FT)) {
        report.powerNowTouch.push(`${label}${leg ? ` — unknown Baseline "${leg}"` : ""} — rangeFt 0 now reads as touch (5 ft)`);
      }
    } else if (it.type === "power" && rangeFt > 0 && typeof src.range === "string" && !["self", "personal"].includes(src.range.toLowerCase())) {
      u["system.-=range"] = null;   // rangeFt already wins — drop the dead Baseline
    }
    if (isForm) {
      if (!(rangeFt > 0) && !["cone", "line", "hex"].includes(shape)) {
        const r = src.range && typeof src.range === "object" ? src.range : {};
        const long = Number(r.long) || 0, short = Number(r.short) || 0;
        const ft = (long || short) ? toFt(long || short, r.units) : 0;
        if (ft > 5) { rangeFt = ft; u["system.manifestation.rangeFt"] = ft; report.formRange.push(`${label} — Short/Long ${short}/${long}${r.units ? ` ${r.units}` : ""} → ${ft} ft`); }
      }
      const want = formRange(rangeFt);
      const cur = src.range && typeof src.range === "object" ? src.range : {};
      if (Number(cur.short) !== want.short || Number(cur.long) !== want.long || cur.units !== want.units) u["system.range"] = want;
    }

    // Chain (P28)
    if (shape !== "none" && mf.chain?.enabled === true) {
      u["system.manifestation.chain.enabled"] = false;
      report.chainOffArea.push(`${label} — ${shape} + chain → chain off`);
    }

    // Nonlethal box (P30)
    if (it.type === "weapon" && src.nonlethal !== true && (Array.isArray(src.tags) ? src.tags : []).some(t => ["mercy", "nonlethal"].includes(String(t).toLowerCase()))) {
      u["system.nonlethal"] = true;
      report.nonlethalBox.push(label);
    }

    // Unread power category (P34)
    if (it.type === "power" && src.category === "manifestation") { u["system.-=category"] = null; report.powerCategory.push(label); }

    if (Object.keys(u).length && (it.type === "power" || it.type === "weapon") && mf && typeof mf === "object")
      u["system.manifestation.tier"] = Math.max(1, Math.min(4, Number(mf.tier) || 1));   // pin: no re-score
    return u;
  }

  async function run(it, where) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const u = plan(it, where);
    if (!WRITE || !Object.keys(u).length) return;
    try { await it.update(u); } catch (e) { report.errors.push(`${where}: ${it.name}: ${e.message}`); }
  }

  for (const it of game.items.contents) await run(it, "world");
  for (const a of game.actors.contents) for (const it of a.items.contents) await run(it, a.name);
  for (const sc of game.scenes.contents) {
    for (const tok of sc.tokens.contents) {
      if (tok.actorLink || !tok.actor) continue;
      for (const it of tok.actor.items.contents) {
        if (!tok.delta?.items?.get?.(it.id)) continue;   // base items were scanned on the world actor
        await run(it, `${sc.name} / ${tok.name}`);
      }
    }
  }
  // Packs: count only, never written.
  for (const id of PACKS) {
    const pack = game.packs.get(id);
    if (!pack) { report.packs[id] = "not found"; continue; }
    const keys = ["formStamp", "cubeToSphere", "areaSizeClamp", "powerRange", "powerNowTouch", "formRange", "rangelessShape", "chainOffArea", "nonlethalBox", "powerCategory"];
    const counts0 = Object.fromEntries(keys.map(k => [k, report[k].length]));
    const docs = await pack.getDocuments();
    for (const d of docs) {
      if (d.documentName === "Item" && (d.type === "power" || d.type === "weapon")) plan(d, `pack ${id}`);
      else if (d.documentName === "Actor") for (const it of d.items.contents) if (it.type === "power" || it.type === "weapon") plan(it, `pack ${id} / ${d.name}`);
    }
    report.packs[id] = Object.fromEntries(keys.map(k => [k, report[k].length - counts0[k]]));
  }

  const n = (k) => report[k].length;
  const summary = `teeth Phase A range/area/forms — ${WRITE ? "WRITTEN" : "DRY RUN"}: scanned ${report.scanned}; `
    + `Form stamps ${n("formStamp")} (foe weapons left ${n("formOnFoe")}); cube→sphere ${n("cubeToSphere")}; size→5 ${n("areaSizeClamp")}; `
    + `power Baseline→rangeFt ${n("powerRange")} (now touch ${n("powerNowTouch")}); Form Short/Long→rangeFt ${n("formRange")}; `
    + `cone/line/hex range→0 ${n("rangelessShape")}; chain off on area ${n("chainOffArea")}; nonlethal box ${n("nonlethalBox")}; `
    + `power category dropped ${n("powerCategory")}; errors ${n("errors")}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
