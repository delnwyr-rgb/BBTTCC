/*
 * RUN ORDER (fix round 2026-11-08 — run the teeth macros in this order, each dry first):
 *   1 teeth-phaseA-range-area-forms   (stamps legacy Forms — later macros read the stamp)
 *   2 teeth-phaseA-frame-fields       3 teeth-phaseA-legacy-intent     4 teeth-phaseA-damage-tracks
 *   5 teeth-phaseA-resolution         6 teeth-phaseA-conditions
 *   7 teeth-phaseA-cost-activation    (clears costType, which the Form test reads — it stamps first itself too)
 *   8 teeth-phaseA-signatures-labels  9 rescore-rubric-v1-2 (LAST — the only one meant to move tiers; 1–8 pin them)
 *
 * teeth-phaseA-legacy-intent-2026-11-08.macro.js — Manifestation Engine teeth, Phase A, cluster C2
 * (legacy fields P37, stance P32, intent P38).
 * Dave's rulings (2026-11-08):
 *   P37  Dead legacy fields go: the V1 wizard, manifestation.family, resolution.attackBonus, the old
 *        manifestation.save block (folded into resolution.shape "save"), the power "Effect Formula" string,
 *        the Resonance Channels cast block.
 *   P32  Stances: "As the rubric says. But Hermetic shouldn't take 2 turns to cast." — the item-level Style
 *        field (system.mode) is gone; stance is chosen at cast time only.
 *   P38  Intent: "all 6 faculties … Weapons use violence, unless stated otherwise. The NPC weapons should keep
 *        violence. A manifestation can pick its intent at creation, and then it uses that intent for its attack
 *        and damage values." — system.damage.attribute (weapon) and damageRoll.attribute (power) are ignored.
 *
 * The system code already ignores every retired key at read time (ftLegacySaveToResolution folds an enabled legacy
 * save into resolution on load). This macro brings STORED data in line and REPORTS what the intent ruling changed.
 * It never rewrites an item's intent (NPC weapons keep Violence) and never re-tiers anything: every write that
 * touches a magnitude path (resolution) carries the item's current tier, so the preUpdateItem re-score stays off.
 *
 * Covers world items + every world actor's embedded items (any actor type). Compendium packs are NOT touched.
 *
 *   DRY RUN by default (report only).
 *   globalThis.__teethPhaseALegacyIntentWrite = true → writes the legacy-save migration: an item whose old
 *        manifestation.save.enabled is true and whose resolution shape is auto/unset gets resolution.shape "save"
 *        with that save's faculty (explicit attribute; else resolve → Soul, guard/evasion → Body; the three
 *        Halloween Hoard powers by name: Ask the Board → Soul, Weigh It → Mind, Porchlight → Body), and the
 *        old block is removed.
 *   globalThis.__teethPhaseALegacyIntentStrip = true → ALSO strips the retired keys: manifestation.family,
 *        manifestation.save (disabled blocks), resolution.attackBonus, system.mode (power Style),
 *        system.damage.attribute (weapon), and blanks damageRoll.attribute (power). Optional tidy-up.
 *
 * Report sections (always filled):
 *   saveMigrate     — legacy enabled saves → resolution "save" (with the faculty chosen)
 *   saveConflict    — enabled legacy save on an item that already has a non-auto resolution (left alone)
 *   npcIntentKeep   — NPC/foe weapons whose intent is NOT violence but whose old damage.attribute WAS violence
 *                     (Dave: NPC weapons keep Violence — review these by hand; intent is NOT rewritten)
 *   weaponFacultyDiff — any other weapon whose old damage.attribute differed from its intent (damage now adds intent)
 *   powerFacultyDiff  — powers whose old damageRoll.attribute differed from intent (damage/heal now adds intent;
 *                     an empty old attribute means the roll gains a faculty add it never had)
 *   badIntent       — items whose intent is not one of the six faculties (they read as Violence)
 *   legacyDamageString — powers still carrying the flat `system.damage` dice string with no structured roll
 *                     (still lifted at read time; open + save in the Engine to make it structured)
 * Idempotent.
 */
(async () => {
  const WRITE = globalThis.__teethPhaseALegacyIntentWrite === true;
  const STRIP = WRITE && globalThis.__teethPhaseALegacyIntentStrip === true;
  const FAC = ["violence", "intrigue", "presence", "body", "mind", "soul"];
  const HOARD = { "ask the board": "soul", "weigh it": "mind", "porchlight": "body" };
  const report = {
    WRITE, STRIP, world: game.world?.id,
    saveMigrate: [], saveConflict: [], npcIntentKeep: [], weaponFacultyDiff: [], powerFacultyDiff: [],
    badIntent: [], legacyDamageString: [], strip: [], errors: []
  };
  const isFoeActor = (a) => a?.type === "npc";   // stat-block foes (the 116 NPC weapons)

  async function fixItem(it, where, actor) {
    if (it.type !== "power" && it.type !== "weapon") return;
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    const label = `${where}: ${it.name} [${it.type}]`;
    const u = {};
    const stale = [];
    const intentRaw = String(sys.intent ?? "").toLowerCase();
    const intent = FAC.includes(intentRaw) ? intentRaw : "violence";
    if (sys.intent !== undefined && !FAC.includes(intentRaw)) report.badIntent.push(`${label} — intent "${sys.intent}" reads as violence`);

    // ── P37 legacy save block → resolution.shape "save" ──
    const sv = mf.save;
    if (sv && typeof sv === "object") {
      const shape = String(mf.resolution?.shape ?? "auto");
      if (sv.enabled === true && shape !== "auto" && shape !== "") {
        report.saveConflict.push(`${label} — legacy save on, resolution already "${shape}" (kept resolution)`);
        u["system.manifestation.-=save"] = null; stale.push("manifestation.save");
      } else if (sv.enabled === true) {
        const attr = String(sv.attribute ?? "").toLowerCase();
        const fac = HOARD[String(it.name ?? "").trim().toLowerCase()]
          ?? (FAC.includes(attr) ? attr : (sv.defense === "resolve" ? "soul" : "body"));
        const fixed = sv.dcMode === "fixed" && Number(sv.dcFixed) > 0;
        u["system.manifestation.resolution.shape"] = "save";
        u["system.manifestation.resolution.saveAttribute"] = fac;
        u["system.manifestation.resolution.saveDcMode"] = fixed ? "fixed" : "cast-dc";
        if (fixed) u["system.manifestation.resolution.saveDcFixed"] = Number(sv.dcFixed);
        u["system.manifestation.tier"] = Math.max(1, Math.min(4, Number(mf.tier) || 1));   // pin: no re-score
        u["system.manifestation.-=save"] = null;
        report.saveMigrate.push(`${label} — save (${sv.defense ?? "?"}) → resolution save vs ${fac}${fixed ? ` DC ${sv.dcFixed}` : ""}`);
      } else {
        u["system.manifestation.-=save"] = null; stale.push("manifestation.save (off)");
      }
    }

    if ("family" in mf) { u["system.manifestation.-=family"] = null; stale.push("manifestation.family"); }
    if (mf.resolution && typeof mf.resolution === "object" && "attackBonus" in mf.resolution) {
      u["system.manifestation.resolution.-=attackBonus"] = null; stale.push("resolution.attackBonus");
    }

    // ── P32 item-level Style ──
    if (it.type === "power" && "mode" in sys) { u["system.-=mode"] = null; stale.push(`mode (${sys.mode})`); }

    // ── P38 intent drives attack AND damage ──
    if (it.type === "weapon") {
      const dAttr = String(sys.damage?.attribute ?? "").toLowerCase();
      if (sys.damage && typeof sys.damage === "object" && "attribute" in sys.damage) {
        u["system.damage.-=attribute"] = null; stale.push(`damage.attribute (${dAttr || "—"})`);
      }
      if (dAttr && dAttr !== intent) {
        const line = `${label} — intent ${intent}, old damage.attribute ${dAttr}`;
        if (isFoeActor(actor) && intent !== "violence" && dAttr === "violence") report.npcIntentKeep.push(line);
        else report.weaponFacultyDiff.push(line);
      }
    } else {
      const drAttr = String(sys.damageRoll?.attribute ?? "").toLowerCase();
      const op = String(sys.damageRoll?.op ?? "none");
      if (op !== "none" && Number(sys.damageRoll?.number) > 0 && drAttr !== intent) {
        report.powerFacultyDiff.push(`${label} — ${op} roll now adds ${intent} (was ${drAttr || "nothing"})`);
      }
      if (drAttr) { u["system.damageRoll.attribute"] = ""; stale.push(`damageRoll.attribute (${drAttr})`); }
      const untouched = !sys.damageRoll?.op || (sys.damageRoll.op === "none" && !(Number(sys.damageRoll?.number) > 0));
      if (untouched && typeof sys.damage === "string" && sys.damage.trim()) {
        report.legacyDamageString.push(`${label} — "${sys.damage}" (lifted at read time)`);
      }
    }

    if (stale.length) report.strip.push(`${label} — ${stale.join(", ")}`);
    // Without STRIP, keep only the legacy-save migration writes.
    const migrating = "system.manifestation.resolution.shape" in u;
    if (!STRIP) {
      for (const k of Object.keys(u)) {
        if (k === "system.manifestation.-=save" && migrating) continue;
        if (k.includes("-=") || k === "system.damageRoll.attribute") delete u[k];
      }
    }
    // Pin the stored tier on EVERY non-empty write (fix round 2026-11-08, S1) — resolution, damage and the stripped
    // keys are magnitude paths, and the preUpdateItem hook must not re-score here (rescore-rubric-v1-2 does that, last).
    if (Object.keys(u).length) u["system.manifestation.tier"] = Math.max(1, Math.min(4, Number(mf.tier) || 1));

    if (WRITE && Object.keys(u).length) {
      try { await it.update(u); } catch (e) { report.errors.push(`${label}: ${e.message}`); }
    }
  }

  for (const it of game.items.contents) await fixItem(it, "world", null);
  for (const a of game.actors.contents) for (const it of a.items.contents) await fixItem(it, a.name, a);

  const summary = `teeth Phase A legacy+intent — ${WRITE ? "WRITTEN" : "DRY RUN"}: legacy saves ${report.saveMigrate.length} `
    + `(${report.saveConflict.length} conflict); NPC weapons to review ${report.npcIntentKeep.length}; weapon faculty diffs `
    + `${report.weaponFacultyDiff.length}; power faculty diffs ${report.powerFacultyDiff.length}; bad intents ${report.badIntent.length}; `
    + `legacy damage strings ${report.legacyDamageString.length}; stale keys on ${report.strip.length}${STRIP ? " (stripped)" : ""}; `
    + `errors ${report.errors.length}`;
  console.log(summary, report);
  ui.notifications?.info(summary);
  return report;
})();
