/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-resolution-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C4
 * (Evasion → Guard P05, Form strikes P10, Form save DC P11, saves on every path P12, contest = save P13,
 * area attacks P14, beneficial lock P15).
 * Dave's rulings (2026-11-08):
 *   P05  "Migrate to guard. Fully derived." — an attack rolls vs Guard, or Resolve for Stress damage; never authored.
 *        resolution.attackVs is retired; Evasion is no longer a ward stat (a stored evasion ward reads as Guard).
 *   P10  "A weapon that, if it hits, does damage and applies an effect. It should be possible to allow for a saving
 *        throw if the creator adds one." — a Form always rolls to hit; resolution.hitSave (+ saveAttribute,
 *        hitSaveHalf) gives the target a save that stops the states. No save-first / contest on Forms. Foe weapons
 *        keep save-first (legacy resolution.mode "save" is read as shape "save" — NOT rewritten here; packs untouched).
 *        statesOnFail is retired (a passed save never lands states on any path).
 *   P13  "Yes same rules." — a target who wins a contest = a passed save.
 *
 * The system reads every legacy shape at load time (normalizer + ftStrikeResolution shims), so NOTHING needs writing
 * for the game to behave. Covers world items + every world actor's embedded items. Compendium packs are READ for the
 * report only (never written).
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseAResolutionWrite = true →
 *        · appliedEffects.modifiers stat "evasion" → "guard" (same value)
 *        · strips resolution.attackVs and resolution.statesOnFail
 *        · Forms with a stored save / contested shape and no hitSave → shape "attack" + hitSave true, saveAttribute
 *          (contested: the contest's target attribute), hitSaveHalf from onSave / onContestLoss "half"
 *        Every write pins the item's current tier (resolution / appliedEffects are magnitude paths).
 *   globalThis.__teethPhaseAResolutionKeepFormSaves = true (with Write) → Forms that rolled the accidental on-hit
 *        save before 11-08 (stored resolution.saveAttribute + states / pool row, no hitSave) get hitSave true so
 *        their strikes keep rolling a save. Off by default: Dave's ruling makes the save opt-in.
 *   globalThis.__teethPhaseAResolutionHitSaveCandidates = true (with Write) → powers listed under hitSaveCandidates
 *        get hitSave true (saveAttribute = their appliedStates.saveAttribute).
 *
 * Report sections:
 *   evasionWards        — items whose wards raise Evasion (now Guard)
 *   attackVsStored      — items still storing resolution.attackVs (ignored; derived defense shown)
 *   attackVsChanged     — attack-shaped items whose stored attackVs differs from the derived defense
 *   statesOnFailStored  — items still storing statesOnFail (ignored)
 *   formShapeToHitSave  — Forms with a save / contested shape (now a hit save after the attack roll)
 *   formRiderLost       — Forms that rolled an on-hit save by accident before (now land states outright)
 *   weaponSaveShapeNoMode — non-Form weapons with shape "save" but no mode "save": their Strike is now save-first
 *   npcModeSave         — world counts of foe weapons on legacy resolution.mode "save" (behaviour unchanged)
 *   packModeSave        — the same, per compendium pack (read-only)
 *   beneficialOverride  — beneficial workings whose stored shape is attack / save / contested (now always Auto)
 *   hitSaveCandidates   — auto-shape powers with states + a states save faculty whose text mentions a save
 *                         (the East Wall pattern) — candidates for an explicit hit save
 *   appliedEvasionAEs   — live ActiveEffects on actors writing system.derived.evasion.aeBonus (report only)
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseAResolutionWrite === true;
  const KEEP_FORM_SAVES = WRITE && globalThis.__teethPhaseAResolutionKeepFormSaves === true;
  const HIT_SAVE_CANDIDATES = WRITE && globalThis.__teethPhaseAResolutionHitSaveCandidates === true;
  const STRESS_TYPES = new Set(["psychic", "qliphothic"]);
  const report = {
    WRITE, KEEP_FORM_SAVES, HIT_SAVE_CANDIDATES, world: game.world?.id,
    evasionWards: [], attackVsStored: [], attackVsChanged: [], statesOnFailStored: [], formShapeToHitSave: [],
    formRiderLost: [], weaponSaveShapeNoMode: [], npcModeSave: { items: 0, actors: 0 }, packModeSave: {},
    beneficialOverride: [], hitSaveCandidates: [], appliedEvasionAEs: [], errors: []
  };
  const arr = (raw) => Array.isArray(raw) ? raw : (raw && typeof raw === "object" ? Object.values(raw) : []);
  const isForm = (it) => it?.type === "weapon" && foundry.utils.getProperty(it, "flags.fourththing.manifested") === true;
  const deriveDefense = (it) => {
    const fn = game.fourththing?.attackDefenseFor;
    if (typeof fn === "function") return fn(it);
    const sys = it.system ?? {};
    const type = String(it.type === "weapon" ? sys.damage?.type : sys.damageRoll?.type ?? "").toLowerCase();
    return STRESS_TYPES.has(type) ? "resolve" : "guard";
  };
  const statesOf = (mf) => {
    const st = mf?.appliedStates?.states;
    return Array.isArray(st) ? st : (st && typeof st === "object" ? Object.keys(st).filter(k => st[k]) : []);
  };
  const hasWards = (mf) => {
    const e = mf?.appliedEffects;
    return !!(e && (arr(e.modifiers).length || arr(e.resists).length || arr(e.immunes).length));
  };
  const poolHostile = (mf) => { const p = mf?.poolShift ?? {}; return Number(p.clarity) < 0 || Number(p.noise) > 0; };
  const beneficial = (it) => {
    try { return typeof game.fourththing?.isBeneficialManifestation === "function" ? game.fourththing.isBeneficialManifestation(it) : false; }
    catch (_e) { return false; }
  };

  async function checkItem(it, where, ownerIsFoe) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const sys = it.system ?? {}, mf = sys.manifestation ?? {}, res = mf.resolution ?? {};
    const label = `${where}: ${it.name} [${it.type}${isForm(it) ? " Form" : ""}]`;
    const u = {};

    // P05 — Evasion wards → Guard.
    const mods = arr(mf.appliedEffects?.modifiers);
    if (mods.some(m => String(m?.stat ?? "").toLowerCase() === "evasion")) {
      report.evasionWards.push(`${label} — ${mods.filter(m => String(m?.stat).toLowerCase() === "evasion").map(m => `${m.op ?? "+"}${m.value} Evasion`).join(", ")} → Guard`);
      u["system.manifestation.appliedEffects.modifiers"] = mods.map(m => String(m?.stat ?? "").toLowerCase() === "evasion" ? { ...m, stat: "guard" } : m);
    }
    if (res.attackVs !== undefined) {
      report.attackVsStored.push(`${label} — attackVs ${res.attackVs}`);
      const want = deriveDefense(it);
      if (res.shape === "attack" && res.attackVs !== want) report.attackVsChanged.push(`${label} — stored ${res.attackVs} → now attacks ${want}`);
      u["system.manifestation.resolution.-=attackVs"] = null;
    }
    if (res.statesOnFail !== undefined) {
      report.statesOnFailStored.push(label);
      u["system.manifestation.resolution.-=statesOnFail"] = null;
    }

    // P10 — Forms.
    if (isForm(it)) {
      const stakes = statesOf(mf).length || hasWards(mf) || poolHostile(mf);
      if (res.hitSave === undefined && (res.shape === "save" || res.shape === "contested")) {
        const attr = res.shape === "contested" ? (res.contestTargetAttribute || "body") : (res.saveAttribute || "body");
        const half = res.shape === "contested" ? res.onContestLoss === "half" : res.onSave === "half";
        report.formShapeToHitSave.push(`${label} — ${res.shape} → attack roll + ${attr} hit save${half ? " (half damage on a save)" : ""}`);
        Object.assign(u, { "system.manifestation.resolution.shape": "attack", "system.manifestation.resolution.hitSave": true,
          "system.manifestation.resolution.saveAttribute": attr, "system.manifestation.resolution.hitSaveHalf": half });
      } else if (res.hitSave === undefined && res.saveAttribute && stakes && res.mode !== "save") {
        report.formRiderLost.push(`${label} — rolled a ${res.saveAttribute} save on every hit before; now its conditions land outright${KEEP_FORM_SAVES ? " → KEPT as a hit save" : ""}`);
        if (KEEP_FORM_SAVES) Object.assign(u, { "system.manifestation.resolution.hitSave": true, "system.manifestation.resolution.hitSaveHalf": false });
      }
    } else if (it.type === "weapon") {
      if (res.mode === "save") report.npcModeSave.items++;
      if (res.shape === "save" && res.mode !== "save" && res.saveAttribute) report.weaponSaveShapeNoMode.push(`${label} — Strike is now save-first (${res.saveAttribute})`);
    }

    // P15 — beneficial workings locked to Auto.
    if ((res.shape === "attack" || res.shape === "save" || res.shape === "contested") && beneficial(it)) {
      report.beneficialOverride.push(`${label} — stored ${res.shape}, now lands with no roll`);
    }

    // P12 — East-Wall pattern: an auto power with states and a states save faculty whose text names a save.
    if (it.type === "power" && (res.shape ?? "auto") === "auto" && res.hitSave !== true && statesOf(mf).length
        && mf.appliedStates?.saveAttribute && !ownerIsFoe
        && /\b(save|defen[cs]e)\b/i.test(`${sys.effect ?? ""} ${sys.description?.value ?? ""}`)) {
      report.hitSaveCandidates.push(`${label} — ${statesOf(mf).join(", ")} · ${mf.appliedStates.saveAttribute} save?${HIT_SAVE_CANDIDATES ? " → hit save SET" : ""}`);
      if (HIT_SAVE_CANDIDATES) Object.assign(u, { "system.manifestation.resolution.hitSave": true, "system.manifestation.resolution.saveAttribute": mf.appliedStates.saveAttribute });
    }

    if (WRITE && Object.keys(u).length) {
      u["system.manifestation.tier"] = Math.max(1, Math.min(4, Number(mf.tier) || 1));   // pin: no re-score
      try { await it.update(u); } catch (e) { report.errors.push(`${label}: ${e.message}`); }
    }
  }

  const foe = (a) => a?.type === "npc";
  for (const it of game.items.contents) await checkItem(it, "world", false);
  for (const a of game.actors.contents) {
    let hadModeSave = false;
    for (const it of a.items.contents) {
      if (it.type === "weapon" && it.system?.manifestation?.resolution?.mode === "save") hadModeSave = true;
      await checkItem(it, a.name, foe(a));
    }
    if (hadModeSave) report.npcModeSave.actors++;
    for (const ef of a.effects.contents) {
      if ((ef.changes ?? []).some(c => c.key === "system.derived.evasion.aeBonus")) report.appliedEvasionAEs.push(`${a.name}: ${ef.name}`);
    }
  }

  // Packs — read-only counts of legacy save-first weapons (mode "save") and stored attackVs / statesOnFail.
  for (const pack of game.packs.contents) {
    if (!["Item", "Actor"].includes(pack.documentName)) continue;
    let modeSave = 0, attackVs = 0, statesOnFail = 0, evasion = 0;
    const scan = (it) => {
      const r = it.system?.manifestation?.resolution ?? {};
      if (it.type === "weapon" && r.mode === "save") modeSave++;
      if (r.attackVs !== undefined) attackVs++;
      if (r.statesOnFail !== undefined) statesOnFail++;
      if (arr(it.system?.manifestation?.appliedEffects?.modifiers).some(m => String(m?.stat).toLowerCase() === "evasion")) evasion++;
    };
    try {
      const docs = await pack.getDocuments();
      for (const d of docs) {
        if (pack.documentName === "Item") scan(d);
        else for (const it of d.items?.contents ?? []) scan(it);
      }
    } catch (e) { report.errors.push(`pack ${pack.collection}: ${e.message}`); continue; }
    if (modeSave || attackVs || statesOnFail || evasion) report.packModeSave[pack.collection] = { modeSave, attackVs, statesOnFail, evasionWards: evasion };
  }

  const summary = `teeth Phase A resolution — ${WRITE ? "WRITTEN" : "DRY RUN"}: Evasion wards ${report.evasionWards.length}; `
    + `attackVs stored ${report.attackVsStored.length} (${report.attackVsChanged.length} change target); statesOnFail ${report.statesOnFailStored.length}; `
    + `Form save/contest → hit save ${report.formShapeToHitSave.length}; Form accidental rider ${report.formRiderLost.length}; `
    + `weapon now save-first ${report.weaponSaveShapeNoMode.length}; foe mode-save weapons ${report.npcModeSave.items} on ${report.npcModeSave.actors} actors; `
    + `packs with legacy keys ${Object.keys(report.packModeSave).length}; beneficial overrides ${report.beneficialOverride.length}; `
    + `hit-save candidates ${report.hitSaveCandidates.length}; live Evasion AEs ${report.appliedEvasionAEs.length}; errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
