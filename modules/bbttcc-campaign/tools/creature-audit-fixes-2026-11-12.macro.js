/*
 * creature-audit-fixes-2026-11-12.macro.js — the creature audit's per-monster fixes (VERIFY.md: 40 CONFIRMED + the
 * corrected PARTIAL fixes) plus Dave's 11-12 rulings, applied to the NPC compendium (bbttcc-master-content.npcs) and to
 * the world's monster actors (world copies are matched by NAME — "Tor-Wrath 7" → "Tor-Wrath" — because their ids and
 * item ids differ from the pack). Every fix reads the CURRENT data and only writes what differs, so a second run = 0.
 *
 * Rulings folded in (Dave 2026-11-12):
 *   - The Maître-D' is TIER II medium (rfi.actor merged, never replaced — replacing drops `bestiary`).
 *   - Tree Person Corrective Pulse = recharge 5–6 (d6), the per-combat limit goes; double Restrained saves merged; Roots limited.
 *   - Legendary actions don't exist — the run scans every monster's text + automation and reports any mention (expect 0).
 *   - Tor-Wrath (pack + world 1–9) rfi.actor.points = 2; kinetic resistance KEPT (story anchor); rider fixes applied.
 *   - Ungated ULTIMATEs get { recharge:{mode:"d6",min:5}, requires:{ownerBloodied:true} } — d6 because "combat" recharge is
 *     never reset (npc-automation.js only rolls d6 / nextTurn back), and `requires` is only read inside useRecharge, which
 *     the Strike path calls only when npcAuto.recharge exists (module.js ~1741) — so BOTH keys are needed.
 *   - Impose-every-Steward auras → disSaves (saves only) where the prose is about RESISTING; a narrative prompt where it is
 *     about skill / insight checks. Duplicate auras deleted.
 *   - Dice-budget fixes; text-only mismatches fixed in the TEXT; anything needing a new engine verb = a narrative prompt.
 *
 * DRY RUN by default. globalThis.__creatureFixDry = false applies.
 *   globalThis.__creatureFixTokens = true  also applies to UNLINKED scene tokens whose delta overrides items (else they are
 *                                          only reported).
 * Before any write, a JournalEntry "Creature audit fixes backup 2026-11-12" stores the before-JSON of every touched item
 * (whole item) and actor (the changed paths). Report → globalThis.__creatureFixReport {changes, skipped, errors, …}.
 */
(async () => {
  const DRY_RUN = globalThis.__creatureFixDry !== false;
  const DO_TOKENS = globalThis.__creatureFixTokens === true;

  // <plan> — pure (no Foundry globals): the offline harness extracts this block and runs it against the dumps.
  const DEL = "__FT_DEL__";
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const getP = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
  const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  const baseName = n => String(n ?? "").replace(/\s+\d+$/, "").trim();
  const RUNTIME_NA_KEYS = ["spent", "spentRound"];
  const stripRuntime = na => { if (!isObj(na)) return na; const o = clone(na); for (const k of RUNTIME_NA_KEYS) delete o[k]; return o; };

  // Tor-Wrath's ULTIMATE / reminder helpers
  const ULT = (old) => ({ v: 1, rules: clone(old?.rules ?? []), recharge: { mode: "d6", min: 5 }, requires: { ownerBloodied: true } });
  const remind = (prompt) => ({ v: 1, rules: [{ on: "selfTurnStart", narrative: true, limit: { per: "combat", uses: 1 }, label: "reminder (no engine verb yet)", do: { prompt } }] });
  const usePrompt = (prompt, extra = {}) => ({ v: 1, rules: [{ on: "use", who: "self", narrative: true, do: { prompt } }], ...extra });
  const auraDisSaves = r => { const d = { ...clone(r.do) }; delete d.impose; d.disSaves = true; return { ...clone(r), do: d }; };
  const auraPrompt = (r, prompt) => { const o = clone(r); o.do = { prompt }; o.narrative = true; return o; };

  function planFixes(actorData, itemsData) {
    const ops = [];
    const a = actorData ?? {};
    if (a.type !== "npc") return ops;
    const items = Array.isArray(itemsData) ? itemsData : [];
    const bn = baseName(a.name);
    const byItem = new Map();
    const itemOp = (it) => {
      let op = byItem.get(it._id);
      if (!op) { op = { target: "item", kind: "update", actorId: a._id, actorName: a.name, itemId: it._id, itemName: it.name, updates: {}, why: [] }; byItem.set(it._id, op); ops.push(op); }
      return op;
    };
    let actorOp = null;
    const setA = (path, value, why) => {
      if (same(getP(a, path), value)) return;
      if (!actorOp) { actorOp = { target: "actor", kind: "update", actorId: a._id, actorName: a.name, updates: {}, why: [] }; ops.push(actorOp); }
      actorOp.updates[path] = clone(value); if (!actorOp.why.includes(why)) actorOp.why.push(why);
    };
    const setI = (it, path, value, why) => {
      if (!it || same(getP(it, path), value)) return;
      const op = itemOp(it); op.updates[path] = clone(value); if (!op.why.includes(why)) op.why.push(why);
    };
    const delI = (it, path, why) => {
      if (!it || getP(it, path) === undefined) return;
      const op = itemOp(it); op.updates[path] = DEL; if (!op.why.includes(why)) op.why.push(why);
    };
    // whole-object npcAuto write: compare without the runtime spent flags; leftover top-level keys are deleted in the same write
    const setNA = (it, na, why) => {
      if (!it) return;
      const old = getP(it, "flags.fourththing.npcAuto");
      if (na === null) { delI(it, "flags.fourththing.npcAuto", why); return; }
      if (same(stripRuntime(old), na)) return;
      const val = clone(na);
      if (isObj(old)) for (const k of Object.keys(old)) if (!(k in val)) val[k] = DEL;
      const op = itemOp(it); op.updates["flags.fourththing.npcAuto"] = val; if (!op.why.includes(why)) op.why.push(why);
    };
    const dropItem = (it, why) => { if (!it) return; byItem.delete(it._id); for (let i = ops.length - 1; i >= 0; i--) if (ops[i].itemId === it._id) ops.splice(i, 1); ops.push({ target: "item", kind: "delete", actorId: a._id, actorName: a.name, itemId: it._id, itemName: it.name, why: [why] }); };
    const I = (name) => items.find(i => i.name === name) ?? null;
    const IR = (re) => items.find(i => re.test(i.name)) ?? null;
    const IRall = (re) => items.filter(i => re.test(i.name));
    const NA = it => getP(it, "flags.fourththing.npcAuto");
    const descOf = it => String(getP(it, "system.description.value") ?? "");
    // text swap: only when the old fragment is present (idempotent; a hand-edited text is left alone)
    const swapText = (it, path, from, to, why) => {
      const cur = getP(it, path); if (typeof cur !== "string" || !cur.includes(from)) return;
      setI(it, path, cur.split(from).join(to), why);
    };
    const setFormula = (it, from, to, why) => { if (it && getP(it, "system.damage.formula") === from) setI(it, "system.damage.formula", to, why); };
    // turnStart impose aura → disSaves | narrative prompt (only rules that still impose)
    const fixImposeAura = (it, mode, prompt, why) => {
      const na = NA(it); if (!na?.rules?.some(r => r.on === "turnStart" && r.do?.impose)) return;
      const rules = na.rules.map(r => (r.on === "turnStart" && r.do?.impose) ? (mode === "dis" ? auraDisSaves(r) : auraPrompt(r, prompt)) : r);
      setNA(it, { ...stripRuntime(na), rules }, why);
    };
    const gateUltimate = (it, why) => {
      if (!it) return;
      const na = NA(it);
      if (na?.recharge?.mode === "d6" && na?.requires?.ownerBloodied) return;
      setNA(it, { ...stripRuntime(na ?? {}), ...ULT(na) }, why);
    };
    const remindIfBare = (it, prompt, why) => { if (it && !NA(it)) setNA(it, remind(prompt), why); };
    const fractured = (why = "T34-M10 Fractured Will has no engine reader → once-per-combat GM reminder (engine work owed)") => {
      for (const it of IRall(/^Fractured Will/)) {
        const n = (it.name.match(/\(([^)]*)\)/) || [])[1] || "per scene";
        remindIfBare(it, `${it.name}: when ${a.name.split(",")[0]} fails a check or save, the GM may declare a success instead (${n}) — track the uses by hand.`, why);
      }
    };
    const hitSave = (it, attr, dc, why) => {   // M13 data route: a hit rule that posts the save card → the existing saveFail rule fires
      if (!it) return; const na = NA(it) ?? { v: 1, rules: [] };
      if (na.rules.some(r => r.on === "hit" && r.do?.save && r.if?.weapon === it.name)) return;
      setNA(it, { ...stripRuntime(na), rules: [{ on: "hit", if: { weapon: it.name }, label: `${it.name} — on-hit save`, do: { save: { attr, dc, onSave: "negate" } } }, ...clone(na.rules)] }, why);
    };
    const addCondImm = (key, why) => { const ci = Array.isArray(a.system?.conditionImmunities) ? a.system.conditionImmunities : []; if (!ci.includes(key)) setA("system.conditionImmunities", [...ci, key], why); };
    const dropResist = (key, why) => { const r = a.system?.defenses?.resistances; if (Array.isArray(r) && r.includes(key)) setA("system.defenses.resistances", r.filter(x => x !== key), why); };
    const multiattack = (newHtml, oldHtml, why) => { const it = I("Multiattack"); if (it && descOf(it) === oldHtml) setI(it, "system.description.value", newHtml, why); };

    switch (bn) {
      // ─────────────────────────────── TIER 1–2 ───────────────────────────────
      case "Tor-Wrath": {
        setA("flags.fourththing.rfi.actor.points", 2, "Dave 11-12: Tor-Wrath = 2 encounter points (kinetic resist kept as the story anchor)");
        const gu = I("Grief Undertow");
        if (gu) { const w = "T12-M7 Grief Undertow: Resolve DC 12 or Shaken had no states → no save card";
          setI(gu, "system.manifestation.appliedStates.states", ["shaken"], w); setI(gu, "system.manifestation.appliedStates.duration", "1-round", w); setI(gu, "system.manifestation.appliedStates.saveAttribute", "soul", w); }
        const of = I("Ore-Fist");
        if (of) { const w = "T12-M7 Ore-Fist: Body DC 12 or pushed 1 + Prone (was Soul, no states → nothing happened)";
          setI(of, "system.manifestation.resolution.saveAttribute", "body", w);
          setI(of, "system.manifestation.appliedStates.states", ["prone"], w); setI(of, "system.manifestation.appliedStates.duration", "1-round", w); setI(of, "system.manifestation.appliedStates.saveAttribute", "body", w);
          const na = NA(of) ?? { v: 1, rules: [] };
          if (!na.rules.some(r => r.on === "saveFail" && r.do?.push)) setNA(of, { ...stripRuntime(na), rules: [...clone(na.rules), { on: "saveFail", if: { weapon: "Ore-Fist" }, do: { push: 1 } }] }, w); }
        const ta = IR(/^Tantrum/);
        if (ta) setNA(ta, { v: 1, rules: [
          { on: "use", who: "self", limit: { per: "scene", uses: 1 }, label: "Tantrum — a thrown plate down a 3-square line", do: { template: { shape: "line", size: 15 } } },
          { on: "use", limit: { per: "scene", uses: 1 }, label: "Tantrum — Body DC 12, half on a success", do: { save: { attr: "body", dc: 12, onSave: "half" }, damage: { formula: "2d6", type: "kinetic" } } },
          { on: "saveFail", if: { weapon: ta.name }, label: "Tantrum — knocked Prone on a failure", do: { condition: { key: "prone", duration: "1-round" } } }
        ] }, "T12-M7 Tantrum: half on a success (do.save onSave half) + Prone on a failure (saveFail) — the condition branch hard-codes negate");
        break;
      }
      case "Yesodium Tick-Hound": {
        const bite = I("Irradiated Bite"), w = "O2/T12-M2 no teeth: bite lands on Integrity (kinetic), the +1 RP rider stays";
        if (bite) { setI(bite, "system.damage.type", "kinetic", w); setI(bite, "system.damage.track", "integrity", w); }
        const sh = I("Shake It Off"); if (sh && getP(sh, "system.damage.formula")) setI(sh, "system.damage.formula", "", "T12-M2 Shake It Off: prose = no Integrity damage (save → +1 RP only)");
        break;
      }
      case "Gamchicoth Reveller": {
        setFormula(I("Addictive Touch"), "3d6", "2d6", "O3 Addictive Touch 3d6 → 2d6 (12x CR 15.2 → 12.4)");
        multiattack("<p>The Reveller makes one Strike a round — usually an Addictive Touch.</p>", "<p>The Reveller makes two Addictive Touch attacks.</p>", "T12-M3 Multiattack text vs the 1-Strike chassis (text fixed to the engine)");
        break;
      }
      case "Golachab Flayer":
        multiattack("<p>The Flayer makes one Strike a round, usually with its Whip of Agony.</p>", "<p>The Flayer makes two attacks with its Whip of Agony.</p>", "T12-M3 Multiattack text vs the 1-Strike chassis");
        break;
      case "Thagirion Disputant":
        multiattack("<p>The Disputant uses Inciting Word as its one Strike each round.</p>", "<p>The Disputant uses Inciting Word twice.</p>", "T12-M3 Multiattack text vs the 1-Strike chassis");
        break;
      case "Harab Serapel Scavenger": {
        multiattack("<p>The Scavenger makes one Strike a round: its Soulfire Beak or its Talons.</p>", "<p>The Scavenger makes two attacks: one with its Soulfire Beak and one with its Talons.</p>", "T12-M3 Multiattack text vs the 1-Strike chassis");
        const gz = IR(/^Avaricious Gaze/), na = NA(gz);
        if (na?.rules?.some(r => r.on === "saveFail" && r.do?.condition?.key === "staggered" && r.do.condition.duration === "scene")) {
          const rules = na.rules.map(r => (r.on === "saveFail" && r.do?.condition?.key === "staggered") ? { ...clone(r), do: { ...clone(r.do), condition: { key: "staggered", duration: "until-saved", save: { attr: "soul", dc: 14 } } } } : r);
          setNA(gz, { ...stripRuntime(na), rules }, "T12-M8 Gaze Staggered lasted the scene — now until-saved on Soul 14, like the Charm");
        }
        hitSave(I("Soulfire Beak"), "body", 14, "T12-M13 Beak rider never rolled (no stakes) — hit rule posts the Body DC 14 card so the saveFail prompt fires");
        break;
      }
      case "Razor Raider": {
        const cb = I("Chainblade"), st = getP(cb, "system.manifestation.appliedStates.states");
        if (Array.isArray(st) && st.includes("prone")) setI(cb, "system.manifestation.appliedStates.states", st.filter(s => s !== "prone"), "T12-M1 Chainblade: Prone only on a critical (the crit rule already does it)");
        break;
      }
      case "The Maître-D'": {
        const w = "Dave 11-12: The Maître-D' is Tier II medium (rfi.actor MERGED; system tier fields agree)";
        setA("flags.fourththing.rfi.actor.tier", "II", w); setA("flags.fourththing.rfi.actor.bracket", "medium", w);
        setA("system.details.tier", 2, w); if (a.system && "tier" in a.system) setA("system.tier", 2, w);
        const lr = IR(/^The Long Reach/), na = NA(lr);
        if (lr && na?.rules?.some(r => r.if?.weapon && r.if.weapon !== lr.name)) setNA(lr, { ...stripRuntime(na), rules: na.rules.map(r => r.if?.weapon ? { ...clone(r), if: { ...clone(r.if), weapon: lr.name } } : r) }, "T12-M6 +1d10 never fired: if.weapon must equal the item name");
        setFormula(lr, "2d10", "2d8", "O6 Long Reach 2d10 over the T2 cap (10.5) now that it is Tier II → 2d8 (normalizeDamage)");
        const sy = IR(/^Seat You Now/); if (sy && getP(sy, "system.damage.formula")) setI(sy, "system.damage.formula", "", "T12-M6 Seat You Now is a pure compel — no damage");
        break;
      }
      case "Satariel Veil-Spinner":
        setFormula(I("Web of Deceit"), "1d4", "1d6", "O12 Web of Deceit 1d4 under the T1 budget → 1d6");
        fixImposeAura(I("Aura of Concealment"), "prompt", "Aura of Concealment: twice-keep-worse on checks to read intentions or see through deception until its next turn starts (GM applies — attacks untouched).", "T12-H3 aura Imposed every attack — prose is insight checks only → prompt");
        break;
      case "Ghagielite Blinder":
        fixImposeAura(I("Droning Stupor"), "dis", null, "T12-H3 Droning Stupor Imposed attacks — prose is Mind checks / holding a working → disSaves");
        fixImposeAura(I("Aura of Obstruction"), "dis", null, "T12-H3 Aura of Obstruction Imposed attacks — prose is Mind checks → disSaves");
        hitSave(I("Mind-Cluttering Bite"), "soul", 12, "T12-M13 Bite rider never rolled — hit rule posts the Resolve DC 12 card so noReactions fires");
        break;
      case "Samaelite Poisoner": {
        const b = I("Bite of Pride"), st = getP(b, "system.manifestation.appliedStates.states");
        if (Array.isArray(st) && st.includes("shaken")) setI(b, "system.manifestation.appliedStates.states", st.filter(s => s !== "shaken"), "T12-M4 Bite of Pride: the victim is IMMUNE to Shaken, Compelled only");
        fixImposeAura(I("Aura of Vanity"), "dis", null, "T12-H3 Aura of Vanity Imposed attacks — prose is resisting Charm → disSaves");
        break;
      }
      case "Thaumielite Despot": {
        // Tyrant's Aura and Aura of Duality are one ability; "Aura of Duality" is the lineage trait (lint L2) so it stays,
        // carries the DC 12 shrug-off in its prompt, and Tyrant's Aura goes.
        fixImposeAura(I("Aura of Duality"), "prompt", "Aura of Duality: twice-keep-worse on skill checks until its next turn starts; a Resolve DC 12 check shrugs it off (GM applies — attacks untouched).", "T12-H3 aura Imposed every attack — prose is skill checks → prompt");
        const ty = I("Tyrant's Aura"); if (ty) dropItem(ty, "T12-H3 / Dave 11-12: Tyrant's Aura duplicates Aura of Duality — deleted");
        break;
      }
      case "Witness Initiate": {
        const ru = I("Reports Up"); if (getP(ru, "flags.fourththing.passives.aura.rerolls")) delI(ru, "flags.fourththing.passives.aura.rerolls", "T12-H4 copied lieutenant aura gave every ally reroll-lowest map-wide — removed (note kept)");
        const da = IR(/^Gathers, Reports/), na = NA(da);
        if (na?.rules?.some(r => r.on === "zero" && r.do?.bankReroll) && getP(da, "flags.fourththing.triggers")?.length) setNA(da, null, "T12-H4 Dies Anonymously granted its bank-reroll twice (npcAuto + trigger) — npcAuto removed, trigger kept");
        break;
      }
      case "Hexknight": {
        const ln = I("Hex-Iron Lance"), want = { v: 1, rules: [{ on: "attack", if: { weapon: "Hex-Iron Lance", targetNotActed: true }, label: "Hex-Iron Lance — the hex gets there first", do: { reroll: "damage" } }] };
        if (ln && NA(ln)?.rules?.some(r => r.if?.targetCondition)) setNA(ln, want, "T12-M5 Lance ran the bandit Shiv rule — now damage reroll-lowest vs a target that hasn't acted");
        const lnD = descOf(ln); if (ln && /Prone or Restrained target, \+1d4/.test(lnD)) setI(ln, "system.description.value", "<p><strong>Strike.</strong> reach 2 squares, one target. Damage: <code>1d8</code> kinetic + violence. On a hit against a target that hasn't acted yet this combat, the damage die rerolls the lowest — the hex gets there first.</p>", "T12-M5 Lance text matched the bandit Shiv");
        const dk = I("Hex-Iron Dirk"); if (dk && /Shiv hit/.test(descOf(dk))) setI(dk, "system.description.value", descOf(dk).replace(/reach (1 square\.|5 ft\.)/, "reach 1 square").replace("<code>1d6</code>", "<code>1d8</code>").replace("Shiv hit", "Lance hit"), "T12-M5 Dirk text said Shiv / 1d6");
        const cb = I("Scatter Carbine");
        if (cb && NA(cb)?.rules?.some(r => /Signal shot/i.test(r.do?.prompt ?? ""))) setNA(cb, { v: 1, rules: [{ on: "hit", if: { weapon: "Scatter Carbine" }, label: "Scatter Carbine — no reactions", do: { noReactions: true } }] }, "T12-M5 Carbine ran the bandit signal-shot prompt — now on a hit the target can't take reactions");
        if (cb && /ally bandit/.test(descOf(cb))) setI(cb, "system.description.value", "<p><strong>Strike.</strong> range 12/36 squares, one target. Damage: <code>1d8</code> kinetic + violence. On a hit the target can't take reactions until the start of its next turn.</p><p><em>Knight's carbine, sighted for the road.</em></p>", "T12-M5 Carbine text was the bandit Pipe Rifle");
        break;
      }
      case "Burn-Zone Alpha": {
        const lh = I("Lead the Hunt"), na = NA(lh);
        if (na?.rules?.some(r => r.on === "bloodied" && r.do?.tempIntegrity && !r.who)) {
          const rules = na.rules.map(r => (r.on === "bloodied" && r.do?.tempIntegrity && !r.who) ? { on: "bloodied", who: "allies", radius: 6, limit: clone(r.limit ?? { per: "scene", uses: 1 }), label: "Lead the Hunt", do: { tempIntegrity: r.do.tempIntegrity, shift: 2 } } : r);
          setNA(lh, { ...stripRuntime(na), rules }, "T12-M9 Lead the Hunt gave the 5 temp Integrity to the Alpha — now every ally within 6 (+2 squares)");
        }
        break;
      }
      case "Hex-Iron Berserker": addCondImm("shaken", "T12-M10 prose: immune to Shaken (Shaken doubles Stress)"); break;
      case "Vow-Bound Thrall": {
        addCondImm("shaken", "T12-M10 prose: immune to Shaken");
        const ls = IR(/^Last-Stand/), na = NA(ls);
        if (na && !na.requires?.ownerBloodied) setNA(ls, { ...stripRuntime(na), recharge: clone(na.recharge ?? { mode: "combat" }), requires: { ownerBloodied: true } }, "T12-M11 Last-Stand is 'triggered when the thrall is bloodied' — gated");
        break;
      }
      case "Valhaulan Spark Adept": {
        const hw = IR(/^Hammer-Ward/), na = NA(hw);
        if (na?.rules?.some(r => r.on === "struck" && r.do?.bankBonus)) setNA(hw, { v: 1, rules: [{ on: "attacked", limit: clone(na.rules.find(r => r.on === "struck")?.limit ?? { per: "scene", uses: 3 }), label: "Hammer-Ward — the attacker rerolls its highest die", do: { reroll: "attack-highest" } }] },
          "T12-M12 Hammer-Ward banked +2 after the hit (never touched that attack) — now reroll-highest on the attack itself (closest engine verb to '+2 Guard vs that attack')");
        break;
      }
      case "Pre-Fall Sentinel": hitSave(I("Pre-Fall Halberd"), "body", 13, "T12-M13 Halberd rider never rolled — hit rule posts the Body DC 13 card so push 1 fires"); break;
      case "CACA": {
        const cs = I("Chromatic Slam"), na = NA(cs);
        if (na?.rules?.some(r => r.on === "hit" && r.do?.impose)) setNA(cs, { ...stripRuntime(na), rules: na.rules.map(r => (r.on === "hit" && r.do?.impose) ? { on: "hit", if: clone(r.if), narrative: true, label: r.label, do: { prompt: "Chromatic Slam: the target rerolls the highest die on its next DAMAGE roll against the Elemental (apply by hand)." } } : r) },
          "T12-M14 Chromatic Slam Imposed the next attack vs anyone — prose is a damage reroll vs the Elemental (no engine verb → prompt)");
        remindIfBare(I("Saturation Field"), "Saturation Field: all Integrity damage from any source −1 (minimum 1); manifestations cost +1 Clarity while the Elemental is here.", "T12-M14 Saturation Field did nothing (no damage-reduction / Clarity-cost verb) → reminder");
        break;
      }
      case "Hollis Varn, Reeve of the Broken Bridge":
        gateUltimate(I("Burn the Bridge (1/scene)"), "T12-H1 ULTIMATE was ungated (L1 win 7% live) → recharge d6 5+ AND ownerBloodied");
        fractured();
        break;
      case "The Ferryman of the Drowned South":
        gateUltimate(I("The River Remembers (1/scene)"), "T12-H2 ULTIMATE was ungated (L8 win 1.4% live) → recharge d6 5+ AND ownerBloodied");
        fractured();
        break;
      // ─────────────────────────────── TIER 3–4 ───────────────────────────────
      case "Gilbert, Attendant Eternal":
        fixImposeAura(I("Aura of Vanity"), "dis", null, "T34-H1 Aura of Vanity Imposed attacks — prose is resisting Charm → disSaves");
        fractured();
        break;
      case "Qliphothic Shambler":
        fixImposeAura(I("Aura of Contention"), "prompt", "Aura of Contention: twice-keep-worse on Presence checks to persuade or de-escalate until its next turn starts (GM applies — attacks untouched).", "T34-H1 aura Imposed attacks — prose is persuasion checks → prompt");
        break;
      case "Whispering Deceiver":
        fixImposeAura(I("Aura of Concealment"), "prompt", "Aura of Concealment: twice-keep-worse on checks to read intentions or see through deception until its next turn starts (GM applies — attacks untouched).", "T34-H1 aura Imposed attacks — prose is insight checks → prompt");
        fixImposeAura(I("Whispering Aura"), "dis", null, "T34-H1 Whispering Aura duplicated Concealment's Impose — its own part (resisting Charm/Shaken) → disSaves");
        fractured();
        break;
      case "Obstructor Demon":
        fixImposeAura(I("Aura of Stagnation"), "dis", null, "T34-H1 Aura of Stagnation Imposed attacks — keeps slow, holding-a-working disadvantage → disSaves");
        break;
      case "Gerald, Assistant Regional Manager of the Apocalypse": {
        fixImposeAura(I("Aura of Obstruction"), "dis", null, "T34-H1 Aura of Obstruction Imposed attacks — prose is Mind checks → disSaves");
        const es = I("Escalate To Management"); if (es && getP(es, "system.damage.formula")) setI(es, "system.damage.formula", "", "T34-M9 Escalate is Compelled only — no 2d10 kinetic");
        break;
      }
      case "Archon of the Twin Crown":
        fixImposeAura(I("Aura of Duality"), "prompt", "Aura of Duality: twice-keep-worse on skill checks until its next turn starts (GM applies — attacks untouched).", "T34-H1 aura Imposed attacks — prose is skill checks → prompt");
        fractured();
        break;
      case "Angel of Hollow Glory": {
        fixImposeAura(I("Aura of Vanity"), "dis", null, "T34-H1 Aura of Vanity Imposed attacks — prose is resisting Charm → disSaves");
        const gc = IR(/^Golden Chains/), na = NA(gc);
        if (na?.rules?.length) {
          const rules = na.rules.map(r => {
            if (r.on === "use" && r.do?.condition?.key === "restrained" && r.do.condition.save?.attr !== "presence") return { ...clone(r), do: { ...clone(r.do), condition: { ...clone(r.do.condition), save: { ...clone(r.do.condition.save), attr: "presence" } } } };
            if (r.on === "saveFail" && r.do?.dot?.ends === "rounds") { const d = clone(r.do); d.dot = { formula: d.dot.formula, type: d.dot.type, ends: "action" }; return { ...clone(r), do: d }; }
            return r;
          });
          setNA(gc, { ...stripRuntime(na), rules }, "T34-H4 chains DoT ticked 10 rounds whatever happened — now ends on the action that bursts them; the shake-off is Presence");
        }
        fractured();
        remindIfBare(I("Hollow Radiance"), "Hollow Radiance: the Angel rolls twice-keep-better on checks to resist manifestations (apply by hand).", "T34-M10 no engine verb for 'advantage vs manifestations' → reminder");
        break;
      }
      case "Apex Predator": {
        const tr = I("Territorial"), na = NA(tr);
        if (na?.rules?.some(r => r.on === "turnStart" && r.do?.damage)) setNA(tr, { ...stripRuntime(na), rules: na.rules.filter(r => !(r.on === "turnStart" && r.do?.damage)) }, "T34-H3 / Dave 11-12: free 2d10 turnStart damage on top of the real reaction Bite — deleted (the trigger stays)");
        break;
      }
      case "Varrenthyx, the Laser Dragon": {
        const nova = I("Overcharge Nova"), na = NA(nova);
        if (nova) {
          const st = getP(nova, "system.manifestation.appliedStates.states");
          if (Array.isArray(st) && st.includes("staggered")) setI(nova, "system.manifestation.appliedStates.states", st.filter(s => s !== "staggered"), "T34-M8 Nova staggered its TARGETS — the text staggers the dragon");
          const selfStag = { on: "saveFail", if: { weapon: "Overcharge Nova" }, to: "self", limit: { per: "round", uses: 1 }, label: "Overcharge Nova — the dragon vents (Staggered)", do: { condition: { key: "staggered", duration: "1-round" } } };
          let rules = clone(na?.rules ?? []).map(r => (r.on === "bloodied" && r.do?.prompt && !r.narrative && !Object.keys(r.do).some(k => k !== "prompt")) ? { ...r, narrative: true } : r);
          if (!rules.some(r => r.to === "self" && r.do?.condition?.key === "staggered")) rules.push(selfStag);
          const gated = !!na?.requires?.ownerBloodied;
          const want = gated ? { ...stripRuntime(na), rules } : { ...stripRuntime(na ?? {}), rules, recharge: { mode: "d6", min: 5 }, requires: { ownerBloodied: true } };
          setNA(nova, want, gated ? "T34-M8 the dragon is Staggered after the Nova (self rule)" : "T34-H2 world Nova had recharge combat but no gate → d6 5+ AND ownerBloodied; T34-M8 self-Stagger");
        }
        const br = I("Coherent Breath"), bna = NA(br);
        if (br && bna?.recharge?.mode !== "nextTurn") setNA(br, { v: 1, rules: [], recharge: { mode: "nextTurn" } }, "T34-H6 world Breath could fire every turn (prompt only) — pack's nextTurn recharge copied");
        const tal = I("Rending Talons");
        if (tal && Number(getP(tal, "system.range.short")) !== 2) { setI(tal, "system.range.short", 2, "T34-M8 Talons are reach 2 (range was 10)"); setI(tal, "system.range.long", 2, "T34-M8 Talons are reach 2 (range was 10)"); }
        break;
      }
      case "Pre-Fall Apex Construct": {
        const def = a.system?.defenses ?? {}, r = Array.isArray(def.resistances) ? def.resistances : [], v = Array.isArray(def.vulnerabilities) ? def.vulnerabilities : [];
        if (r.includes("sephirotic")) setA("system.defenses.resistances", r.filter(x => x !== "sephirotic"), "T34-M1 Pre-Fall Frame text: sephirotic = critical weakness (it RESISTED it) → vulnerability");
        if (!v.includes("sephirotic")) setA("system.defenses.vulnerabilities", [...v, "sephirotic"], "T34-M1 sephirotic vulnerability");
        break;
      }
      case "Witness Apotheon": {
        const ru = I("Reports Up"); if (getP(ru, "flags.fourththing.passives.aura")) delI(ru, "flags.fourththing.passives.aura", "T34-M2 copied lieutenant aura (map-wide ally reroll) — deleted");
        for (const nm of ["Terminal Observation", "Sight-Cuts-Sight"]) { const it = I(nm); if (getP(it, "system.damage.formula") === "2d12") { setI(it, "system.damage.formula", "3d10", "O9 2d12 at the bottom of the T4 band → 3d10"); swapText(it, "system.description.value", "<code>2d12</code>", "<code>3d10</code>", "O9 text matches the dice"); } }
        break;
      }
      case "Witness-Warden Lieutenant": {
        const ru = I("Reports Up"), na = NA(ru);
        if (na?.rules?.some(r => r.on === "turnStart" && r.do?.bankReroll)) { const rest = na.rules.filter(r => !(r.on === "turnStart" && r.do?.bankReroll)); setNA(ru, rest.length ? { ...stripRuntime(na), rules: rest } : null, "T34-M3 banked a reroll for every ally every turn on top of the aura — banking removed, aura kept"); }
        const gz = I("Commander's Gaze"), gna = NA(gz);
        if (gna?.rules?.some(r => r.on === "hit" && r.do?.bankReroll)) setNA(gz, { v: 1, rules: [{ on: "hit", if: { weapon: "Commander's Gaze" }, narrative: true, label: "Commander's Gaze — priority target", do: { prompt: "Priority target: friendly Witnesses reroll the lowest die on attacks against THIS target this round." } }] }, "T34-M3 Gaze banked rerolls usable vs anyone, any time — now a prompt (no 'vs this target' verb)");
        break;
      }
      case "Hex-Warlord's Honored Guard": {
        const sw = I("Sworn"), na = NA(sw);
        if (na?.rules?.some(r => r.on === "allyDamaged" && r.do?.ward !== undefined && !r.do.redirect)) setNA(sw, { ...stripRuntime(na), rules: na.rules.map(r => (r.on === "allyDamaged" && r.do?.ward !== undefined) ? { ...clone(r), do: { ...clone(r.do), redirect: true } } : r) }, "T34-M4 the warded half vanished — the guard now takes it (redirect)");
        remindIfBare(I("Last to Fall"), "Last to Fall: while the warlord stands, no single attack takes the guard below 1 Integrity (apply by hand).", "T34-M10 no engine verb → reminder");
        break;
      }
      case "Hex-Touched Champion": {
        // O7 (kinetic resist → CR 14.6 vs cell ~11) HELD for Dave: kinetic resistance is the Hex-Touched LINEAGE signature (lint L1),
        // so dropping it on one monster breaks the lineage. Not applied 2026-11-12.
        const ht = I("The Hex Tries One More Thing");
        if (NA(ht)?.rules?.some(r => r.on === "zero") && NA(I("Hex-Iron Heart"))?.rules?.some(r => r.on === "zero")) setNA(ht, null, "T34-M5 two zero rules fired together (heal 1 twice, contradictory rerolls) — Hex-Iron Heart keeps the one rule");
        break;
      }
      case "Abomination of Excess": {
        const en = I("Engulf"), na = NA(en);
        if (na?.rules?.some(r => r.on === "saveFail" && r.do?.condition?.duration === "scene")) setNA(en, { v: 1, rules: [
          { on: "use", label: "Engulf — Violence DC 18 or engulfed", do: { condition: { key: "restrained", duration: "until-saved", save: { attr: "violence", dc: 18 } }, damage: { formula: "2d6", type: "chemical" } } },
          { on: "saveFail", if: { weapon: "Engulf" }, label: "Engulfed — Blinded until it escapes; 2d6 chemical each turn until an action ends it", do: { condition: { key: "blinded", duration: "until-saved", save: { attr: "violence", dc: 18 } }, dot: { formula: "2d6", type: "chemical", ends: "action" } } }
        ] }, "T34-M6 Engulf: Blinded lasted the scene, Restrained 1 round, no ongoing 2d6 — now until-saved (Violence 18) + an action-ended DoT");
        fractured();
        break;
      }
      case "Inferno of Cruelty": {
        const sf = I("Soulfire Form"), na = NA(sf);
        if (na?.rules?.some(r => r.on === "struck" && r.do?.damage)) setNA(sf, { ...stripRuntime(na), rules: na.rules.map(r => (r.on === "struck" && r.do?.damage) ? { on: "struck", narrative: true, label: "Soulfire Form", do: { prompt: "Soulfire Form: a MELEE attacker takes 2d6 thermal (apply by hand — ranged attackers are spared)." } } : r) },
          "T34-M7 retaliation burned RANGED attackers too (no melee predicate) → prompt; engine if.melee owed");
        fractured();
        break;
      }
      case "Please-Stop-Hitting-Yourself (Qliphothic Loop)": {
        const rb = I("Reflect The Blow"), na = NA(rb);
        if (na?.rules?.some(r => r.on === "struck" && r.do?.save)) setNA(rb, { ...stripRuntime(na), rules: na.rules.map(r => (r.on === "struck" && r.do?.save) ? { on: "struck", narrative: true, limit: { per: "round", uses: 1 }, label: "Reflect The Blow", do: { prompt: "Reflect The Blow (1/round): a MELEE attacker rolls Mind DC 15 or takes 2d8 qliphothic to Stress (roll by hand — ranged attackers are spared)." } } : r) },
          "T34-M7 reflection hit ranged attackers, no 1/round → prompt; engine if.melee owed");
        break;
      }
      case "Desenitarius Maarg":
        gateUltimate(I("Debt Called In (1/scene)"), "T34-H2 ULTIMATE was ungated → recharge d6 5+ AND ownerBloodied");
        fractured();
        break;
      case "Sklar Bjrornholt":
        gateUltimate(I("Boarding Action (1/scene)"), "T34-H2 ULTIMATE was ungated → recharge d6 5+ AND ownerBloodied");
        setFormula(I("Crowned Valhaulan Boarding Axe"), "1d10+3", "2d10+3", "O13 Boarding Axe under the T4 budget → 2d10+3");
        fractured();
        break;
      case "Gloomgill":
        gateUltimate(I("Final Exam (1/scene)"), "T34-H2 ULTIMATE was ungated → recharge d6 5+ AND ownerBloodied");
        setFormula(I("Inlaid Lantern-Head Flail"), "1d8+1", "2d10+1", "O10 Flail under the T4 budget → 2d10+1");
        fractured();
        break;
      case "Compliance Engine PRIME":
        gateUltimate(I("Total Compliance (1/scene)"), "T34-H2 ULTIMATE was ungated (CR >20 live) → recharge d6 5+ AND ownerBloodied");
        setFormula(I("Circuited Porchlight Carbine"), "1d10+2", "2d6+2", "O11 carbine under the T3 budget → 2d6+2");
        fractured();
        break;
      case "The Lewd Miasma": case "The Ashen Horde": case "War Incarnate":
        fractured();
        if (bn === "The Ashen Horde") { const cm = I("Consume Magic"); if (cm && !NA(cm)) setNA(cm, usePrompt("Consume Magic: one creature/object within 12 squares — its active manifestation ends; a substantial working (GM's call) heals the Horde 10 Integrity."), "T34-M10 no 'end a manifestation' verb → ▶ Use prompt"); }
        if (bn === "War Incarnate") { const as = I("Armor Shatter"); if (as && !NA(as)) setNA(as, usePrompt("Armor Shatter: one Weapon Limb attack vs an armored creature; on a hit its Guard −2 until repaired / its next Soma Break (once per creature)."), "T34-M10 no 'lower Guard' verb → ▶ Use prompt"); }
        break;
      case "The Gilded Tyrant":
        remindIfBare(I("Gilded Bulk"), "Gilded Bulk: the Tyrant rolls twice-keep-better on checks to resist manifestations (apply by hand).", "T34-M10 no 'advantage vs manifestations' verb → reminder");
        break;
      case "Gamalielite Dream-Twister": {
        const ds = IR(/^Dream-Shallows Slip/);
        if (ds && !NA(ds)) setNA(ds, usePrompt("Dream-Shallows Slip: until the start of its next turn only psychic or sephirotic damage touches it (apply by hand).", { recharge: { mode: "d6", min: 5 } }), "T34-M10 no 'immune except types' verb → ▶ Use prompt with its recharge");
        break;
      }
      case "The Tree Person of Early Tifaret": {
        const pu = IR(/^Corrective Pulse/), na = NA(pu);
        if (pu && na) {
          const rules = (na.rules ?? []).map(r => { const o = clone(r); if (o.on === "use") delete o.limit; return o; });
          setNA(pu, { ...stripRuntime(na), rules, recharge: { mode: "d6", min: 5 } }, "Dave 11-12 / T34-M11: Corrective Pulse = recharge 5–6 (the per-combat limit cancelled the d6)");
          if (pu.name !== "Corrective Pulse (recharge 5–6)") setI(pu, "name", "Corrective Pulse (recharge 5–6)", "Dave 11-12: name matches the recharge");
          swapText(pu, "system.description.value", "Recharges on a Soma Break.", "Recharge 5–6: at the start of its turn it rolls 1d6; on a 5–6 it is ready again.", "Dave 11-12: text matches the d6 recharge");
        }
        const hr = I("Harmonic Rejection"); if (hr && NA(hr)?.rules?.some(r => r.on === "struck") && NA(I("Correction, Not Anger"))?.rules?.some(r => r.on === "struck")) dropItem(hr, "T34-M11 / Dave 11-12: two Restrained saves per qliphothic hit — merged into Correction, Not Anger (Harmonic Rejection deleted)");
        const ro = I("Roots of Tiferet"), rna = NA(ro);
        if (rna?.rules?.some(r => r.on === "struck" && !r.limit)) setNA(ro, { ...stripRuntime(rna), rules: rna.rules.map(r => (r.on === "struck" && !r.limit) ? { ...clone(r), limit: { per: "round", uses: 1 } } : r) }, "T34-M11 / Dave 11-12: Roots fired on every hit — once per round (its reaction)");
        if (getP(a, "flags.fourththing.rfi.actor.tier") === "III" && a.system && "tier" in a.system && Number(a.system.tier) !== 3) setA("system.tier", 3, "OUTLIERS data check: world copy system.tier 1 vs rfi III");
        break;
      }
      default: break;
    }
    return ops;
  }
  /** Legendary actions don't exist (Dave 11-12): any mention in a monster's text / automation is reported. */
  function legendaryMentions(actorData, itemsData) {
    const out = []; const re = /legendary\s+(action|resistance)/i;
    for (const it of itemsData ?? []) {
      const blob = JSON.stringify([it.name, it.system?.description, it.system?.effect, it.flags?.fourththing?.npcAuto, it.flags?.fourththing?.triggers]);
      if (re.test(blob)) out.push(`${actorData?.name} › ${it.name}`);
    }
    if (re.test(JSON.stringify([actorData?.system?.biography, actorData?.flags?.fourththing?.rfi]))) out.push(`${actorData?.name} (actor text)`);
    return out;
  }
  // </plan>

  // ── Foundry side ─────────────────────────────────────────────────────────────────────────────────────────
  const report = { DRY_RUN, changes: [], skipped: [], errors: [], tokens: [], legendary: [], perActor: {} };
  const FD = foundry?.data?.operators?.ForcedDeletion;
  // DEL sentinel → ForcedDeletion (V14) or the legacy "-=key" form; recurses into object values (npcAuto leftovers)
  function toFoundry(updates) {
    const conv = (v) => {
      if (!isObj(v)) return v;
      const o = {};
      for (const [k, x] of Object.entries(v)) {
        if (x === DEL) { if (FD) o[k] = new FD(); else o[`-=${k}`] = null; }
        else o[k] = conv(x);
      }
      return o;
    };
    const out = {};
    for (const [p, v] of Object.entries(updates)) {
      if (v === DEL) { if (FD) out[p] = new FD(); else { const i = p.lastIndexOf("."); out[`${p.slice(0, i)}.-=${p.slice(i + 1)}`] = null; } }
      else out[p] = conv(v);
    }
    return out;
  }
  const plans = [];   // { doc, where, ops }
  const consider = (doc, where) => {
    try {
      const src = doc.toObject();
      const ops = planFixes(src, src.items ?? []);
      for (const l of legendaryMentions(src, src.items ?? [])) report.legendary.push(`${where}: ${l}`);
      if (ops.length) plans.push({ doc, where, ops, src });
    } catch (e) { report.errors.push(`${where} ${doc?.name}: plan failed — ${e.message}`); }
  };

  const pack = game.packs.get("bbttcc-master-content.npcs") ?? game.packs.find(p => p.documentName === "Actor" && /bbttcc-master-content\.npcs$/.test(p.collection));
  let packDocs = [];
  if (!pack) report.errors.push("npcs pack bbttcc-master-content.npcs not found");
  else { packDocs = await pack.getDocuments(); for (const d of packDocs) consider(d, `pack:${pack.collection}`); }
  for (const a of game.actors) consider(a, "world");

  // unlinked scene tokens: only those whose delta overrides items can differ from their (fixed) base actor
  for (const sc of game.scenes ?? []) for (const t of sc.tokens ?? []) {
    try {
      if (t.actorLink || !t.actor || t.actor.type !== "npc") continue;
      const dItems = t.delta?._source?.items ?? t._source?.delta?.items ?? [];
      if (!dItems.length) continue;
      const src = t.actor.toObject(); const ops = planFixes(src, src.items ?? []);
      if (!ops.length) continue;
      report.tokens.push({ scene: sc.name, token: t.name, ops: ops.length, applied: DO_TOKENS && !DRY_RUN });
      if (DO_TOKENS) plans.push({ doc: t.actor, where: `token:${sc.name}`, ops, src });
    } catch (e) { report.errors.push(`token ${sc.name} ${t.name}: ${e.message}`); }
  }

  for (const p of plans) {
    report.perActor[`${p.where} ${p.doc.name}`] = p.ops.length;
    for (const op of p.ops) report.changes.push({ where: p.where, actor: p.doc.name, item: op.itemName ?? "—", kind: op.kind, paths: op.updates ? Object.keys(op.updates).join(", ") : "(delete)", why: op.why.join(" | ") });
  }

  if (!DRY_RUN && plans.length) {
    // 1) backup BEFORE any write — abort the run if it can't be written
    const backup = plans.map(p => ({
      uuid: p.doc.uuid, where: p.where, name: p.doc.name,
      actor: Object.fromEntries(p.ops.filter(o => o.target === "actor").flatMap(o => Object.keys(o.updates)).map(k => [k, getP(p.src, k) ?? null])),
      items: p.ops.filter(o => o.target === "item").map(o => (p.src.items ?? []).find(i => i._id === o.itemId)).filter(Boolean)
    }));
    const base = "Creature audit fixes backup 2026-11-12";
    let n = 1; while (game.journal.getName(n === 1 ? base : `${base} (pass ${n})`)) n++;
    try {
      const esc = s => (foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s) : s.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
      await JournalEntry.create({ name: n === 1 ? base : `${base} (pass ${n})`, pages: [{ name: "before", type: "text", text: { content: `<pre>${esc(JSON.stringify(backup, null, 1))}</pre>` } }] });
    } catch (e) { report.errors.push(`backup journal failed — NOTHING applied: ${e.message}`); }

    if (!report.errors.some(e => e.startsWith("backup journal failed"))) {
      const wasLocked = pack?.locked;
      try {
        if (pack && wasLocked && plans.some(p => p.where.startsWith("pack:"))) await pack.configure({ locked: false });
        for (const p of plans) {
          try {
            for (const op of p.ops.filter(o => o.target === "actor")) await p.doc.update(toFoundry(op.updates));
            const upd = p.ops.filter(o => o.target === "item" && o.kind === "update").map(o => ({ _id: o.itemId, ...toFoundry(o.updates) }));
            if (upd.length) await p.doc.updateEmbeddedDocuments("Item", upd);
            const del = p.ops.filter(o => o.target === "item" && o.kind === "delete").map(o => o.itemId);
            if (del.length) await p.doc.deleteEmbeddedDocuments("Item", del);
          } catch (e) { report.errors.push(`${p.where} ${p.doc.name}: ${e.message}`); }
        }
      } finally {
        if (pack && wasLocked) { try { await pack.configure({ locked: true }); } catch (e) { report.errors.push(`relock: ${e.message}`); } }
      }
    }
  }

  console.log(`[creature-audit fixes] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${plans.length} actors, ${report.changes.length} changes, ${report.tokens.length} unlinked tokens with item deltas${DO_TOKENS ? "" : " (reported only)"}, legendary mentions ${report.legendary.length}, ${report.errors.length} errors`);
  console.table(report.changes);
  if (report.tokens.length) console.table(report.tokens);
  if (report.legendary.length) console.warn("[creature-audit fixes] legendary mentions", report.legendary);
  if (report.errors.length) console.warn("[creature-audit fixes] errors", report.errors);
  globalThis.__creatureFixReport = report;
  ui.notifications?.info(`Creature audit fixes ${DRY_RUN ? "dry run" : "applied"}: ${report.changes.length} changes on ${plans.length} actors${report.errors.length ? `, ${report.errors.length} ERRORS (console)` : ""}.`);
})();
