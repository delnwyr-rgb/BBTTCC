/*
 * npc-verbs-followup-2026-11-13.macro.js — switch the monster prompts / reminders the creature audit left behind to the npcAuto
 * verbs the engine gained on 2026-11-13 (systems/fourththing/npc-automation.js):
 *   - if.melee (struck / attacked / hit / attack)       → Inferno of Cruelty › Soulfire Form, Please-Stop-Hitting-Yourself › Reflect The Blow
 *   - dot.ends:"condition" + dot.condition             → Angel of Hollow Glory › Golden Chains, Abomination of Excess › Engulf
 *   - on:"wouldFailSave" + do.passSave:true             → every "Fractured Will (N/scene)" (N per scene — loose ends 11-13; Gloomgill skipped —
 *                                                         Dave 11-13: no longer a combat)
 *   - Satariel Veil-Spinner › Web of Deceit posted TWO save cards against an already-Restrained target (the weapon rider's
 *     Violence DC 12 → restrained + shaken, plus a hit rule's Soul DC 12 → shaken). Now ONE card: the hit rule goes, the rider
 *     keeps restrained + shaken, and Shaken shakes off on Resolve (appliedStates.saveAttributeOverrides.shaken = "soul").
 *
 * Engulf shape: runDo RETURNS right after posting a do.condition.save card (npc-automation.js ~:224), so a saveFail rule that
 * carries both a condition save and a dot never queues the dot (the 11-12 shape). The failed Restrained card (the use rule) IS
 * the engulfing, so the saveFail rule lands Blinded OUTRIGHT (no save key → applyManifestationStates, no second card) and then
 * queues 2d6 chemical with ends:"condition", condition:"restrained". Loose ends (later 11-13): Blinded is duration "scene" +
 * condition.endsWith:"restrained" — it ends the moment Restrained does (creature-loose-ends-2026-11-13.macro.js emits the same shape).
 *
 * The 11-12 fix macro (creature-audit-fixes-2026-11-12.macro.js) emits the same shapes now, so re-running it never undoes this.
 * Every fix reads the CURRENT data and only writes what differs: a second run = 0. Shapes that are neither the original, the
 * 11-12 stand-in nor the target are SKIPPED and reported (hand edits are never overwritten).
 *
 * DRY RUN by default. globalThis.__npcVerbsDry = false applies.
 * Before any write, a JournalEntry "NPC verbs follow-up backup 2026-11-13" stores the before-JSON of every touched item.
 * Report → globalThis.__npcVerbsReport { changes, skipped, errors, perActor }.
 */
(async () => {
  const DRY_RUN = globalThis.__npcVerbsDry !== false;

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

  // the 2026-11-13 shapes (kept identical to creature-audit-fixes-2026-11-12.macro.js)
  const FW_REMINDER_LABEL = "reminder (no engine verb yet)";
  const isFwReminder = na => isObj(na) && Array.isArray(na.rules) && na.rules.length > 0 && na.rules.every(r => r?.on === "selfTurnStart" && r.narrative && r.label === FW_REMINDER_LABEL) && !na.recharge && !na.requires;
  // loose ends 2026-11-13: "(N/scene)" → per:"scene" (creature-loose-ends-2026-11-13.macro.js); fwOld = the morning per-combat shape
  const FW_RE = /\(\s*(\d+)\s*\/\s*(scene|combat|encounter|fight)\s*\)/i;
  const fwUses = name => { const m = String(name ?? "").match(FW_RE); return m ? Math.max(1, Number(m[1])) : 1; };
  const fwPer = name => { const m = String(name ?? "").match(FW_RE); return m && m[2].toLowerCase() === "scene" ? "scene" : "combat"; };
  const fwWant = name => ({ v: 1, rules: [{ on: "wouldFailSave", limit: { per: fwPer(name), uses: fwUses(name) }, label: "Fractured Will", do: { passSave: true } }] });
  const fwOld = name => ({ v: 1, rules: [{ on: "wouldFailSave", limit: { per: "combat", uses: fwUses(name) }, label: "Fractured Will", do: { passSave: true } }] });
  const SOULFIRE_RULE = () => ({ on: "struck", if: { melee: true }, label: "Soulfire Form", do: { damage: { formula: "2d6", type: "thermal" } } });
  const REFLECT_RULE = () => ({ on: "struck", if: { melee: true }, limit: { per: "round", uses: 1 }, label: "Reflect The Blow", do: { save: { attr: "mind", dc: 15, onSave: "negate" }, damage: { formula: "2d8", type: "qliphothic" } } });
  const CHAINS_DOT = (d) => ({ formula: d?.formula || "2d8", type: d?.type || "psychic", ends: "condition", condition: "restrained" });
  const ENGULF_NA = () => ({ v: 1, rules: [
    { on: "use", label: "Engulf — Violence DC 18 or engulfed", do: { condition: { key: "restrained", duration: "until-saved", save: { attr: "violence", dc: 18 } }, damage: { formula: "2d6", type: "chemical" } } },
    { on: "saveFail", if: { weapon: "Engulf" }, label: "Engulfed — Blinded while Restrained; 2d6 chemical each turn while Restrained", do: { condition: { key: "blinded", duration: "scene", endsWith: "restrained" }, dot: { formula: "2d6", type: "chemical", ends: "condition", condition: "restrained" } } }
  ] });
  // any earlier Engulf saveFail shape (scene Blinded / second Violence card / action DoT / until-saved Blinded without endsWith)
  const oldEngulfRule = r => r?.on === "saveFail" && (!r.do?.condition?.endsWith || !!r.do?.condition?.save || (!!r.do?.dot && r.do.dot.ends !== "condition"));
  const oldStruck = (r, real) => r?.on === "struck" && r.if?.melee === undefined && (!!real(r) || !!r.narrative);
  const WEB_OLD_EFFECT = "On a hit the target is Restrained by shadow-silk (escape: Violence check vs DC 12). While Restrained, the web shows the target its worst fear wearing a familiar face: Resolve check vs DC 12 or Shaken while the web holds.";
  const WEB_NEW_EFFECT = "On a hit the target rolls Violence vs DC 12; on a failure it is Restrained by shadow-silk and Shaken — the web shows it its worst fear wearing a familiar face. Each round it can shake off the silk (Violence) and the fear (Resolve).";
  const SKIP_FW = new Set(["Gloomgill"]);   // Dave 11-13: no longer a combat

  /** ops for one actor; `skipped` collects shapes the planner refuses to overwrite */
  function planVerbs(actorData, itemsData, skipped = []) {
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
    const setI = (it, path, value, why) => {
      if (!it || same(getP(it, path), value)) return;
      const op = itemOp(it); op.updates[path] = clone(value); if (!op.why.includes(why)) op.why.push(why);
    };
    const setNA = (it, na, why) => {
      if (!it) return;
      const old = getP(it, "flags.fourththing.npcAuto");
      if (na === null) { if (old !== undefined) { const op = itemOp(it); op.updates["flags.fourththing.npcAuto"] = DEL; if (!op.why.includes(why)) op.why.push(why); } return; }
      if (same(stripRuntime(old), na)) return;
      const val = clone(na);
      if (isObj(old)) for (const k of Object.keys(old)) if (!(k in val)) val[k] = DEL;
      const op = itemOp(it); op.updates["flags.fourththing.npcAuto"] = val; if (!op.why.includes(why)) op.why.push(why);
    };
    const skip = (it, why) => skipped.push(`${a.name} › ${it?.name ?? "?"}: ${why}`);
    const I = (name) => items.find(i => i.name === name) ?? null;
    const IR = (re) => items.find(i => re.test(i.name)) ?? null;
    const NA = it => getP(it, "flags.fourththing.npcAuto");

    // ── Fractured Will (every monster that has it, Gloomgill excepted) ──
    for (const it of items.filter(i => /^Fractured Will\b/.test(i.name))) {
      if (SKIP_FW.has(bn)) continue;
      const na = NA(it), want = fwWant(it.name);
      if (same(stripRuntime(na), want)) continue;
      if (!na || isFwReminder(na) || same(stripRuntime(na), fwOld(it.name))) setNA(it, want, `T34-M10 Fractured Will → on:"wouldFailSave" passSave, ${fwUses(it.name)} per combat (name: ${it.name})`);
      else if ((na.rules ?? []).some(r => r?.on === "wouldFailSave")) skip(it, `already a wouldFailSave rule (hand-tuned?) — left alone: ${JSON.stringify(na)}`);
      else skip(it, `unexpected npcAuto — left alone: ${JSON.stringify(na).slice(0, 300)}`);
    }

    switch (bn) {
      case "Inferno of Cruelty": {
        const sf = I("Soulfire Form"), na = NA(sf); if (!sf) break;
        const isOld = r => oldStruck(r, x => x.do?.damage);
        if (na?.rules?.some(isOld)) setNA(sf, { ...stripRuntime(na), rules: na.rules.map(r => isOld(r) ? SOULFIRE_RULE() : r) }, "T34-M7 Soulfire Form: struck if.melee:true → 2d6 thermal (the prompt stand-in retired; the use prompt stays)");
        else if (!na?.rules?.some(r => same(r, SOULFIRE_RULE()))) skip(sf, `no old struck rule and no target rule: ${JSON.stringify(na).slice(0, 300)}`);
        break;
      }
      case "Please-Stop-Hitting-Yourself (Qliphothic Loop)": {
        const rb = I("Reflect The Blow"), na = NA(rb); if (!rb) break;
        const isOld = r => oldStruck(r, x => x.do?.save);
        if (na?.rules?.some(isOld)) setNA(rb, { ...stripRuntime(na), rules: na.rules.map(r => isOld(r) ? REFLECT_RULE() : r) }, "T34-M7 Reflect The Blow: struck if.melee:true, 1/round, Mind DC 15 card for 2d8 qliphothic (Stress)");
        else if (!na?.rules?.some(r => same(r, REFLECT_RULE()))) skip(rb, `no old struck rule and no target rule: ${JSON.stringify(na).slice(0, 300)}`);
        break;
      }
      case "Angel of Hollow Glory": {
        const gc = IR(/^Golden Chains/), na = NA(gc); if (!gc) break;
        const old = r => r?.on === "saveFail" && r.do?.dot && r.do.dot.ends !== "condition";
        if (na?.rules?.some(old)) setNA(gc, { ...stripRuntime(na), rules: na.rules.map(r => old(r) ? { ...clone(r), do: { ...clone(r.do), dot: CHAINS_DOT(r.do.dot) } } : r) }, "T34-H4 Golden Chains: the 2d8 psychic DoT now lives while Restrained (dot.ends condition) — the prompt 'Burst the chains…' stays");
        else if (!na?.rules?.some(r => r?.on === "saveFail" && r.do?.dot?.ends === "condition" && r.do.dot.condition === "restrained")) skip(gc, `no chains DoT found: ${JSON.stringify(na).slice(0, 300)}`);
        break;
      }
      case "Abomination of Excess": {
        const en = I("Engulf"), na = NA(en); if (!en) break;
        if (na?.rules?.some(oldEngulfRule)) setNA(en, ENGULF_NA(),
          "T34-M6 Engulf: saveFail lands Blinded outright (no second Violence card — runDo returned before the DoT) + 2d6 chemical while Restrained");
        else if (!same(stripRuntime(na), ENGULF_NA())) skip(en, `unexpected Engulf shape — left alone: ${JSON.stringify(na).slice(0, 300)}`);
        break;
      }
      case "Satariel Veil-Spinner": {
        const wd = I("Web of Deceit"); if (!wd) break;
        const na = NA(wd);
        const dupRule = r => r?.on === "hit" && (r.if?.targetCondition ?? []).includes("restrained") && r.do?.condition?.key === "shaken" && r.do.condition.save;
        const states = getP(wd, "system.manifestation.appliedStates.states");
        const riderShakes = Array.isArray(states) ? states.includes("shaken") : !!states?.shaken;
        if (na && (na.rules ?? []).some(dupRule)) {
          if (!riderShakes) { skip(wd, "hit rule found but the rider no longer applies shaken — left alone"); break; }
          const rest = na.rules.filter(r => !dupRule(r));
          const why = "Web of Deceit posted two save cards vs a Restrained target — the rider's one Violence DC 12 card carries restrained + shaken; the extra Soul hit rule goes";
          setNA(wd, rest.length || na.recharge || na.requires ? { ...stripRuntime(na), rules: rest } : null, why);
        }
        if (riderShakes) {
          const ovr = getP(wd, "system.manifestation.appliedStates.saveAttributeOverrides");
          if (!isObj(ovr) || !ovr.shaken) setI(wd, "system.manifestation.appliedStates.saveAttributeOverrides", { ...(isObj(ovr) ? clone(ovr) : {}), shaken: "soul" }, "Web of Deceit: Shaken shakes off on Resolve (soul) each round — the prose's Resolve check, without a second card");
          const eff = getP(wd, "system.effect");
          if (typeof eff === "string" && eff.includes(WEB_OLD_EFFECT)) setI(wd, "system.effect", eff.split(WEB_OLD_EFFECT).join(WEB_NEW_EFFECT), "Web of Deceit: text matches the one-card rider");
        }
        break;
      }
      default: break;
    }
    return ops;
  }
  // </plan>

  // ── Foundry side ─────────────────────────────────────────────────────────────────────────────────────────
  const report = { DRY_RUN, changes: [], skipped: [], errors: [], perActor: {} };
  const FD = foundry?.data?.operators?.ForcedDeletion;
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
  const plans = [];
  const consider = (doc, where) => {
    try {
      const src = doc.toObject();
      const sk = [];
      const ops = planVerbs(src, src.items ?? [], sk);
      for (const s of sk) report.skipped.push(`${where}: ${s}`);
      if (ops.length) plans.push({ doc, where, ops, src });
    } catch (e) { report.errors.push(`${where} ${doc?.name}: plan failed — ${e.message}`); }
  };

  const pack = game.packs.get("bbttcc-master-content.npcs") ?? game.packs.find(p => p.documentName === "Actor" && /bbttcc-master-content\.npcs$/.test(p.collection));
  if (!pack) report.errors.push("npcs pack bbttcc-master-content.npcs not found");
  else { for (const d of await pack.getDocuments()) consider(d, `pack:${pack.collection}`); }
  for (const a of game.actors) consider(a, "world");

  for (const p of plans) {
    report.perActor[`${p.where} ${p.doc.name}`] = p.ops.length;
    for (const op of p.ops) report.changes.push({ where: p.where, actor: p.doc.name, item: op.itemName ?? "—", paths: Object.keys(op.updates).join(", "), why: op.why.join(" | ") });
  }

  if (!DRY_RUN && plans.length) {
    const backup = plans.map(p => ({ uuid: p.doc.uuid, where: p.where, name: p.doc.name, items: p.ops.map(o => (p.src.items ?? []).find(i => i._id === o.itemId)).filter(Boolean) }));
    const base = "NPC verbs follow-up backup 2026-11-13";
    let n = 1; while (game.journal.getName(n === 1 ? base : `${base} (pass ${n})`)) n++;
    let backedUp = false;
    try {
      const esc = s => (foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s) : s.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
      await JournalEntry.create({ name: n === 1 ? base : `${base} (pass ${n})`, pages: [{ name: "before", type: "text", text: { content: `<pre>${esc(JSON.stringify(backup, null, 1))}</pre>` } }] });
      backedUp = true;
    } catch (e) { report.errors.push(`backup journal failed — NOTHING applied: ${e.message}`); }

    if (backedUp) {
      const wasLocked = pack?.locked;
      try {
        if (pack && wasLocked && plans.some(p => p.where.startsWith("pack:"))) await pack.configure({ locked: false });
        for (const p of plans) {
          try {
            const upd = p.ops.map(o => ({ _id: o.itemId, ...toFoundry(o.updates) }));
            if (upd.length) await p.doc.updateEmbeddedDocuments("Item", upd);
          } catch (e) { report.errors.push(`${p.where} ${p.doc.name}: ${e.message}`); }
        }
      } finally {
        if (pack && wasLocked) { try { await pack.configure({ locked: true }); } catch (e) { report.errors.push(`relock: ${e.message}`); } }
      }
    }
  }

  console.log(`[npc verbs follow-up] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${plans.length} actors, ${report.changes.length} item changes, ${report.skipped.length} skipped, ${report.errors.length} errors`);
  console.table(report.changes);
  if (report.skipped.length) console.warn("[npc verbs follow-up] skipped", report.skipped);
  if (report.errors.length) console.warn("[npc verbs follow-up] errors", report.errors);
  globalThis.__npcVerbsReport = report;
  ui.notifications?.info(`NPC verbs follow-up ${DRY_RUN ? "dry run" : "applied"}: ${report.changes.length} item changes on ${plans.length} actors${report.skipped.length ? `, ${report.skipped.length} skipped` : ""}${report.errors.length ? `, ${report.errors.length} ERRORS (console)` : ""}.`);
})();
