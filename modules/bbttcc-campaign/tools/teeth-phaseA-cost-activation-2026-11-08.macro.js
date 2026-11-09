/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-cost-activation-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C6
 * (one honest cost P16/P18, one activation field P20, persistent Forms bill P21, upkeep floor-tiered P23,
 *  one duration knob P24).
 *
 * Dave's rulings (2026-11-08): "Those additional costs should be charged on top of clarity … T4 = 4"; "keep surge out of
 * the resource pool"; "It can be a bonus or reaction … Drop ritual as a manifestation form"; upkeep "floor tiered".
 *
 * The runtime already reads every legacy shape correctly (ftNormalizeManifestationData shims), so nothing NEEDS writing
 * for the game to behave. This macro REPORTS what changed in behaviour and optionally rewrites stored data so sheets,
 * exports and the Engine read the same as the game.
 *
 * Covers world items, every world actor's items, and unlinked scene-token actors' overridden items. Packs NOT touched.
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseACostActivationWrite = true → writes, per item (tier pinned on every write, so the
 *        preUpdateItem re-score stays off — Phase B re-scores):
 *        · costType clarity / none / custom / burn (Surge) / unknown → "none", costValue 0; stress / noise / strain keep
 *          their value (clamped 1–10)
 *        · manifestation.activation: consumePool false → type "none"; ritual / scene / unknown → "action"; free → "none";
 *          the consumePool key is removed; a power's legacy top-level system.activation string is removed
 *        · manifestation.duration → derived from stability (instant / scene / persistent)
 *        · appliedStates.duration stray values (permanent, soma-break, action, turn, …) → "" (= from stability)
 *        · ward-only Sustained / Bound items whose appliedStates.duration is "1-round" → "" (scene-long) — the select sat
 *          under "Conditions", so a ward-only author never saw it. Opt out: globalThis.__teethPhaseACostActivationKeepWardRounds = true
 *        · maintenanceKey: legacy "<n>-<resource>-<cadence>" → "<resource>-<cadence>" when n ≤ tier (no billing change);
 *          the Surge key ("1-burn-scene") → "none" (the stability baseline); Instant → "none"
 *   globalThis.__teethPhaseACostActivationLegacyAct = true → ALSO copies a legacy system.activation "bonus" / "reaction"
 *        into manifestation.activation.type when the structured type is still "action" (the dock showed the legacy one,
 *        the cast charged the structured one — pick per item from the `legacyActMismatch` list first).
 *
 * Report sections:
 *   formStamp          — legacy Forms (system heuristic) stamped flags.fourththing.manifested BEFORE costType is cleared (S5)
 *   surgeCost          — items whose authored cost was Surge ("burn"): no extra cost now (Surge is not a cost)
 *   clarityCost        — authored "clarity" costs: now just the tier floor. formClarityDrop = Forms that charged MORE than
 *                        the tier floor per Strike before (value > floor) — they now pay the floor
 *   customCost         — authored "custom" costs: no extra cost now (the text stays as the "In the fiction" line)
 *   extraNowCharged    — POWERS with a stress / noise / strain cost: Invoke now charges it on top of Clarity (it never did)
 *   costClamp          — extra cost values above 10 (clamped)
 *   t4Items            — T4 items: Clarity floor is now 4 (was 5)
 *   consumePoolFree    — consumePool:false → Free (no action)
 *   ritualAct          — activation ritual / unknown → Action
 *   legacyActMismatch  — power's legacy system.activation (bonus / reaction / ritual) ≠ the structured type
 *   formBonusReaction  — Engine Forms authored Bonus / Reaction: their Strike now spends that slot
 *   durationDerived    — stored manifestation.duration ≠ the stability-derived value
 *   appliedDurStray    — appliedStates.duration not one of the five keys
 *   wardOneRound       — ward-only Sustained / Bound items stuck at 1 round
 *   untilSavedNoSave   — until-saved without save each round (now forced on)
 *   upkeepKeyed        — legacy keys canonicalised · upkeepAboveTier = Clarity keys whose number beats the tier (kept as-is)
 *   upkeepSurge        — Surge upkeep keys (now the baseline)
 *   instantUpkeep      — Instant items carrying an upkeep key (now none)
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseACostActivationWrite === true;
  const KEEP_WARD_ROUNDS = globalThis.__teethPhaseACostActivationKeepWardRounds === true;
  const LEGACY_ACT = globalThis.__teethPhaseACostActivationLegacyAct === true;
  const EXTRA = new Set(["stress", "noise", "strain"]);
  const DURS = new Set(["1-round", "2-rounds", "3-rounds", "scene", "until-saved"]);
  const TIER_CLARITY = { 1: 1, 2: 2, 3: 3, 4: 4 };
  const report = { WRITE, KEEP_WARD_ROUNDS, LEGACY_ACT, world: game.world?.id, scanned: 0, written: 0,
    surgeCost: [], clarityCost: [], formClarityDrop: [], customCost: [], extraNowCharged: [], costClamp: [], t4Items: [],
    formStamp: [], consumePoolFree: [], ritualAct: [], legacyActMismatch: [], formBonusReaction: [],
    durationDerived: [], appliedDurStray: [], wardOneRound: [], untilSavedNoSave: [],
    upkeepKeyed: [], upkeepAboveTier: [], upkeepSurge: [], instantUpkeep: [], errors: [] };

  const stabOf = (mf) => { const s = String(mf.stability ?? "").toLowerCase(); return s === "enduring" ? "bound" : s; };
  const durFor = (stab) => stab === "sustained" ? "scene" : (stab === "bound" ? "persistent" : "instant");
  const statesOf = (st) => Array.isArray(st) ? st.filter(Boolean) : (st && typeof st === "object" ? Object.keys(st).filter(k => st[k] === true || st[k] === "true") : []);
  const hasWards = (eff) => !!eff && ((Array.isArray(eff.modifiers) && eff.modifiers.length) || (Array.isArray(eff.resists) && eff.resists.length) || (Array.isArray(eff.immunes) && eff.immunes.length));

  async function checkItem(it, where) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const src = it._source?.system ?? it.system ?? {};
    const mf = src.manifestation;
    if (!mf || typeof mf !== "object") return;
    report.scanned++;
    const label = `${where}: ${it.name} [${it.type}] (${it.uuid})`;
    const tier = Math.max(1, Math.min(4, Number(mf.tier) || 1));
    let isForm = it.type === "weapon" && it.flags?.fourththing?.manifested === true;
    const stab = stabOf(mf);
    const u = {};
    // Fix round 2026-11-08 (S5): the Form heuristic reads costType, and this macro clears it — stamp a legacy Form FIRST
    // (same test the system uses), or it would lose its Form status for good.
    if (it.type === "weapon" && !isForm) {
      let h = false;
      try { h = typeof game.fourththing?.formWeaponHeuristic === "function" && !!game.fourththing.formWeaponHeuristic(it); } catch (_e) {}
      if (h) { isForm = true; u["flags.fourththing.manifested"] = true; report.formStamp.push(label); }
    }

    // ── Cost ──
    const ct = String(mf.costType ?? "").toLowerCase();
    const cv = Number(mf.costValue ?? 0) || 0;
    if (tier === 4 && (it.type === "power" || isForm)) report.t4Items.push(label);
    if (EXTRA.has(ct)) {
      const v = Math.max(1, Math.min(10, Math.floor(cv) || 1));
      if (cv > 10) report.costClamp.push(`${label} — ${cv} → 10`);
      if (it.type === "power") report.extraNowCharged.push(`${label} — +${v} ${ct} on every Invoke`);
      if (v !== cv) u["system.manifestation.costValue"] = v;
    } else if (ct && ct !== "none") {
      if (ct === "burn" || ct === "surge") report.surgeCost.push(`${label} — was ${cv || 1} Surge`);
      else if (ct === "clarity") {
        report.clarityCost.push(`${label} — ${cv || 1} Clarity (floor T${tier} = ${TIER_CLARITY[tier]})`);
        if (isForm && (cv || 1) > TIER_CLARITY[tier]) report.formClarityDrop.push(`${label} — paid ${cv}, now ${TIER_CLARITY[tier]}`);
      } else report.customCost.push(`${label} — ${ct}${mf.costText ? ` "${mf.costText}"` : ""}`);
      u["system.manifestation.costType"] = "none";
      u["system.manifestation.costValue"] = 0;
    } else if (cv !== 0) u["system.manifestation.costValue"] = 0;

    // ── Activation ──
    const act = (mf.activation && typeof mf.activation === "object") ? mf.activation : null;
    const legacyStr = (it.type === "power" && typeof src.activation === "string") ? src.activation.toLowerCase() : "";
    let at = String(act?.type ?? (legacyStr || "action")).toLowerCase();
    if (act && act.consumePool === false && at !== "none") { report.consumePoolFree.push(`${label} — was ${at}, consumePool off`); at = "none"; }
    if (at === "free" || at === "passive") at = "none";
    if (!["action", "bonus", "reaction", "none"].includes(at)) { report.ritualAct.push(`${label} — ${at} → action`); at = "action"; }
    if (legacyStr && ["bonus", "reaction", "ritual"].includes(legacyStr) && legacyStr !== at) {
      report.legacyActMismatch.push(`${label} — legacy "${legacyStr}" vs structured "${at}"`);
      if (LEGACY_ACT && at === "action" && legacyStr !== "ritual") at = legacyStr;
    }
    if (isForm && (at === "bonus" || at === "reaction")) report.formBonusReaction.push(`${label} — strikes with the ${at === "bonus" ? "Bonus action" : "Reaction"}`);
    if (!act || act.type !== at || "consumePool" in act) {
      u["system.manifestation.activation.type"] = at;
      if (act && "consumePool" in act) u["system.manifestation.activation.-=consumePool"] = null;
    }
    if (it.type === "power" && "activation" in src && typeof src.activation === "string") u["system.-=activation"] = null;

    // ── Duration (derived) ──
    const dWant = durFor(stab);
    if (String(mf.duration ?? "") !== dWant) {
      report.durationDerived.push(`${label} — ${mf.duration ?? "(none)"} → ${dWant}`);
      u["system.manifestation.duration"] = dWant;
    }
    const ap = (mf.appliedStates && typeof mf.appliedStates === "object") ? mf.appliedStates : null;
    if (ap) {
      const ad = String(ap.duration ?? "");
      if (ad && !DURS.has(ad)) {
        report.appliedDurStray.push(`${label} — "${ad}" → from stability`);
        u["system.manifestation.appliedStates.duration"] = "";
      }
      const wardOnly = !statesOf(ap.states).length && hasWards(mf.appliedEffects);
      if (wardOnly && ad === "1-round" && (stab === "sustained" || stab === "bound")) {
        report.wardOneRound.push(`${label} — ${stab} ward stuck at 1 round${KEEP_WARD_ROUNDS ? " (kept)" : " → scene"}`);
        if (!KEEP_WARD_ROUNDS) u["system.manifestation.appliedStates.duration"] = "";
      }
      if (ad === "until-saved" && ap.saveEachRound !== true) report.untilSavedNoSave.push(label);
    }

    // ── Upkeep ──
    const mk = String(mf.maintenanceKey ?? "").toLowerCase().trim();
    if (stab === "instant" && mk && mk !== "none") {
      report.instantUpkeep.push(`${label} — ${mk}`);
      u["system.manifestation.maintenanceKey"] = "none";
    } else if (mk) {
      const m = mk.match(/^(\d+)-(clarity|stress|noise|burn)-(scene|round)$/);
      if (m) {
        const n = Number(m[1]) || 0;
        if (m[2] === "burn") {
          report.upkeepSurge.push(`${label} — ${mk} → baseline`);
          u["system.manifestation.maintenanceKey"] = "none";
        } else if (m[2] === "clarity" && n > tier) {
          report.upkeepAboveTier.push(`${label} — ${mk} at T${tier} (kept; bills ${n})`);
        } else {
          report.upkeepKeyed.push(`${label} — ${mk} → ${m[2]}-${m[3]}${m[2] !== "clarity" && n !== tier ? ` (now bills ${tier}, was ${n})` : (n < tier ? ` (now bills ${tier}, was ${n})` : "")}`);
          u["system.manifestation.maintenanceKey"] = `${m[2]}-${m[3]}`;
        }
      }
    }

    if (!WRITE || !Object.keys(u).length) return;
    u["system.manifestation.tier"] = tier;   // pin: no re-score (Phase B)
    try { await it.update(u); report.written++; } catch (e) { report.errors.push(`${label}: ${e.message}`); }
  }

  for (const it of game.items.contents) await checkItem(it, "world");
  for (const a of game.actors.contents) for (const it of a.items.contents) await checkItem(it, a.name);
  for (const sc of game.scenes.contents) {
    for (const tok of sc.tokens.contents) {
      if (tok.actorLink || !tok.actor) continue;
      for (const it of tok.actor.items.contents) {
        if (!tok.delta?.items?.get?.(it.id)) continue;   // base items were scanned on the world actor
        await checkItem(it, `${sc.name} / ${tok.name}`);
      }
    }
  }

  const n = (k) => report[k].length;
  const summary = `teeth Phase A cost/activation — ${WRITE ? `WRITTEN (${report.written})` : "DRY RUN"}: scanned ${report.scanned}; Form stamped first ${n("formStamp")}; `
    + `surge ${n("surgeCost")} · clarity ${n("clarityCost")} (Form drop ${n("formClarityDrop")}) · custom ${n("customCost")} · power extra now charged ${n("extraNowCharged")} · T4 ${n("t4Items")}; `
    + `free ${n("consumePoolFree")} · ritual ${n("ritualAct")} · legacy act mismatch ${n("legacyActMismatch")} · Form B/R ${n("formBonusReaction")}; `
    + `duration ${n("durationDerived")} · stray applied ${n("appliedDurStray")} · ward 1-round ${n("wardOneRound")} · until-saved ${n("untilSavedNoSave")}; `
    + `upkeep keyed ${n("upkeepKeyed")} · above tier ${n("upkeepAboveTier")} · surge ${n("upkeepSurge")} · instant ${n("instantUpkeep")}; errors ${n("errors")}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
