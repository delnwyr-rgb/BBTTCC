/*
 * creature-loose-ends-2026-11-13.macro.js — the creature audit's loose ends (Dave 11-13: "let's also clean up the loose ends"),
 * applied to the NPC compendium (bbttcc-master-content.npcs) and the world's monster actors (matched by NAME — "Tor-Wrath 7" →
 * "Tor-Wrath" — because world ids differ from the pack):
 *   1. Fractured Will "(N/scene)" → limit per:"scene" (was per:"combat"). The engine has per:"scene" (npc-automation.js limitOk /
 *      limitSpend stamp the Scene id) — the use record lives on the Combat, so a new fight starts fresh either way; the data now
 *      says what the name says. "(N/combat)" names stay per:"combat". Gloomgill skipped (Dave 11-13: no longer a combat).
 *   2. Engulf: Blinded ends WITH Restrained (new verb do.condition.endsWith:"restrained", 2026-11-13) instead of until-saved
 *      (the prose has no Blinded save — it's blind while engulfed); text "Evasion check" (retired) → "Violence save".
 *   3. Reflect The Blow (Please-Stop-Hitting-Yourself) was a WEAPON — it showed up as a Strike ("It does not attack"). Now a
 *      `feature` item (same _id, name, img, flags — the struck rule rides along; rulesOf() reads every item type). VERIFY T34-M7.
 *   4. World Hex-Touched Champion › Taken-Vow Rage effect "Radius 15 ft." → "Radius 3 squares." + the pack's recharge sentence.
 *   5. Every monster whose STORED Integrity / Stress value is above its live derived max (world Hex-Touched Champion 128 / 60)
 *      → value = max. Max = the live prepared system.derived.*.max (the engine already clamps in memory; this fixes the source).
 * The 11-12 fix macro and the npc-verbs follow-up emit the same Fractured Will / Engulf shapes, so re-running either never
 * undoes this. Every fix reads the CURRENT data and only writes what differs: a second run = 0. Unexpected shapes are SKIPPED
 * and reported (hand edits are never overwritten).
 *
 * DRY RUN by default. globalThis.__creatureLooseEndsDry = false applies.
 * Before any write, a JournalEntry "Creature loose ends backup 2026-11-13" stores the before-JSON of every touched item (whole
 * item) and actor (the changed paths). Report → globalThis.__creatureLooseEndsReport { changes, skipped, errors, perActor }.
 */
(async () => {
  const DRY_RUN = globalThis.__creatureLooseEndsDry !== false;

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

  // shapes (kept identical to creature-audit-fixes-2026-11-12.macro.js + npc-verbs-followup-2026-11-13.macro.js)
  const FW_RE = /\(\s*(\d+)\s*\/\s*(scene|combat|encounter|fight)\s*\)/i;
  const fwUses = name => { const m = String(name ?? "").match(FW_RE); return m ? Math.max(1, Number(m[1])) : 1; };
  const fwPer = name => { const m = String(name ?? "").match(FW_RE); return m && m[2].toLowerCase() === "scene" ? "scene" : "combat"; };
  const fwWant = name => ({ v: 1, rules: [{ on: "wouldFailSave", limit: { per: fwPer(name), uses: fwUses(name) }, label: "Fractured Will", do: { passSave: true } }] });
  const FW_REMINDER_LABEL = "reminder (no engine verb yet)";
  const isFwReminder = na => isObj(na) && Array.isArray(na.rules) && na.rules.length > 0 && na.rules.every(r => r?.on === "selfTurnStart" && r.narrative && r.label === FW_REMINDER_LABEL) && !na.recharge && !na.requires;
  const fwOld = name => ({ v: 1, rules: [{ on: "wouldFailSave", limit: { per: "combat", uses: fwUses(name) }, label: "Fractured Will", do: { passSave: true } }] });
  const ENGULF_NA = () => ({ v: 1, rules: [
    { on: "use", label: "Engulf — Violence DC 18 or engulfed", do: { condition: { key: "restrained", duration: "until-saved", save: { attr: "violence", dc: 18 } }, damage: { formula: "2d6", type: "chemical" } } },
    { on: "saveFail", if: { weapon: "Engulf" }, label: "Engulfed — Blinded while Restrained; 2d6 chemical each turn while Restrained", do: { condition: { key: "blinded", duration: "scene", endsWith: "restrained" }, dot: { formula: "2d6", type: "chemical", ends: "condition", condition: "restrained" } } }
  ] });
  // the 11-13 (morning) Engulf shape: Blinded until-saved, no endsWith
  const ENGULF_1113 = () => ({ v: 1, rules: [
    { on: "use", label: "Engulf — Violence DC 18 or engulfed", do: { condition: { key: "restrained", duration: "until-saved", save: { attr: "violence", dc: 18 } }, damage: { formula: "2d6", type: "chemical" } } },
    { on: "saveFail", if: { weapon: "Engulf" }, label: "Engulfed — Blinded; 2d6 chemical each turn while Restrained", do: { condition: { key: "blinded", duration: "until-saved" }, dot: { formula: "2d6", type: "chemical", ends: "condition", condition: "restrained" } } }
  ] });
  const ENGULF_TEXT = [["Each rolls an Evasion check vs DC 18", "Each rolls a Violence save vs DC 18"]];
  const RAGE_TEXT = [
    ["Radius 15 ft. — targets roll vs Resolve", "Radius 3 squares. — targets roll vs Resolve"],
    ["lose the ability to take Reactions until then. Recharge 5–6.", "lose the ability to take Reactions until then. At the start of its turn it rolls 1d6; on a 5–6 it is ready again."]
  ];
  const REFLECT_DESC_OLD = "<strong>Reaction — Reflection.</strong> Attacker rolls Mind vs DC 15.";
  const REFLECT_DESC_NEW = "<strong>Reaction — Reflection</strong> (once per round, when a MELEE attack hits it; it never Strikes). The attacker rolls Mind vs DC 15.";
  const SKIP_FW = new Set(["Gloomgill"]);   // Dave 11-13: no longer a combat

  /** weapon → feature: same _id / name / img / flags / effects; the reaction text says when it fires */
  function reflectAsFeature(it) {
    const s = it.system ?? {};
    const desc = String(s.description?.value ?? "");
    return {
      _id: it._id, name: it.name, type: "feature", img: it.img,
      system: {
        category: "principle", source: s.source || "Qliphothic Bestiary", tags: Array.isArray(s.tags) ? clone(s.tags) : [],
        description: { value: desc.includes(REFLECT_DESC_OLD) ? desc.split(REFLECT_DESC_OLD).join(REFLECT_DESC_NEW) : desc, chat: s.description?.chat ?? "" }
      },
      effects: clone(it.effects ?? []), flags: clone(it.flags ?? {}),
      ...(it.folder !== undefined ? { folder: it.folder } : {}), ...(it.sort !== undefined ? { sort: it.sort } : {}), ...(it.ownership ? { ownership: clone(it.ownership) } : {})
    };
  }

  /**
   * ops for one actor. opts.liveMax = { integrity, stress } — the LIVE derived max (Foundry: the prepared actor; offline: the
   * stored derived.*.max). `skipped` collects shapes the planner refuses to overwrite.
   */
  function planLooseEnds(actorData, itemsData, skipped = [], opts = {}) {
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
    const setNA = (it, na, why) => {
      if (!it) return;
      const old = getP(it, "flags.fourththing.npcAuto");
      if (same(stripRuntime(old), na)) return;
      const val = clone(na);
      if (isObj(old)) for (const k of Object.keys(old)) if (!(k in val)) val[k] = DEL;
      const op = itemOp(it); op.updates["flags.fourththing.npcAuto"] = val; if (!op.why.includes(why)) op.why.push(why);
    };
    const swapText = (it, path, pairs, why) => {
      let cur = getP(it, path); if (typeof cur !== "string") return;
      const before = cur;
      for (const [from, to] of pairs) if (cur.includes(from)) cur = cur.split(from).join(to);
      if (cur !== before) setI(it, path, cur, why);
    };
    const skip = (it, why) => skipped.push(`${a.name} › ${it?.name ?? "?"}: ${why}`);
    const I = (name) => items.find(i => i.name === name) ?? null;
    const NA = it => getP(it, "flags.fourththing.npcAuto");

    // 1 ── Fractured Will "(N/scene)" → per:"scene"
    for (const it of items.filter(i => /^Fractured Will\b/.test(i.name))) {
      if (SKIP_FW.has(bn)) continue;
      const na = stripRuntime(NA(it)), want = fwWant(it.name);
      if (same(na, want)) continue;
      if (!na || isFwReminder(na) || same(na, fwOld(it.name))) setNA(it, want, `Fractured Will "${it.name}" → limit per:"${fwPer(it.name)}" ×${fwUses(it.name)} (the name's own cadence)`);
      else skip(it, `unexpected npcAuto (hand-tuned?) — left alone: ${JSON.stringify(na ?? null).slice(0, 200)}`);
    }

    switch (bn) {
      case "Abomination of Excess": {   // 2 ── Engulf
        const en = I("Engulf"); if (!en) break;
        const na = stripRuntime(NA(en));
        const oldEngulfRule = r => r?.on === "saveFail" && (!r.do?.condition?.endsWith || !!r.do?.condition?.save || (!!r.do?.dot && r.do.dot.ends !== "condition"));
        if (same(na, ENGULF_1113()) || (na?.rules ?? []).some(oldEngulfRule)) setNA(en, ENGULF_NA(), "Engulf: Blinded ends WITH Restrained (condition.endsWith) — no Blinded shake-off save the prose never had");
        else if (!same(na, ENGULF_NA())) skip(en, `unexpected Engulf shape — left alone: ${JSON.stringify(na ?? null).slice(0, 300)}`);
        swapText(en, "system.description.value", ENGULF_TEXT, "Engulf text: Evasion is retired — the use rule rolls a Violence save");
        break;
      }
      case "Please-Stop-Hitting-Yourself (Qliphothic Loop)": {   // 3 ── Reflect The Blow
        const rb = I("Reflect The Blow"); if (!rb) break;
        if (rb.type === "weapon") {
          byItem.delete(rb._id);
          ops.push({ target: "item", kind: "replace", actorId: a._id, actorName: a.name, itemId: rb._id, itemName: rb.name, data: reflectAsFeature(rb),
            why: ["T34-M7 Reflect The Blow was a weapon — it could be used to Strike; now a feature (reaction), its struck rule unchanged"] });
        } else if (rb.type === "feature") {
          swapText(rb, "system.description.value", [[REFLECT_DESC_OLD, REFLECT_DESC_NEW]], "Reflect The Blow text: when it fires");
        } else skip(rb, `unexpected item type "${rb.type}" — left alone`);
        break;
      }
      case "Hex-Touched Champion": {   // 4 ── Taken-Vow Rage text (world copy)
        const tv = items.find(i => /^Taken-Vow Rage\b/.test(i.name));
        if (tv) swapText(tv, "system.effect", RAGE_TEXT, "Taken-Vow Rage effect: feet → squares (Radius 3) + the d6 recharge sentence, as the pack");
        break;
      }
      default: break;
    }

    // 5 ── stored Integrity / Stress above the live derived max
    const lm = opts.liveMax ?? {};
    // review 2026-11-13: the live max is TEMPORARILY low under Strain 4+ (halved), Radiation Sickness (capped), an AE max
    // modifier, or with the threat chassis switched off — clamping then would bake that into the stored value for good. Skip.
    const sysA = a.system?.system ?? a.system ?? {};
    const unsteady = [...(opts.unsteady ?? []),
      ...(Number(sysA.strain?.value) > 0 ? ["Strain"] : []), ...(Number(sysA.radiation?.rp) > 0 ? ["Radiation"] : [])];
    const over = ["integrity", "stress"].some(t => { const m = Number(lm[t]), v = getP(a, `system.derived.${t}.value`); return Number.isFinite(m) && m > 0 && typeof v === "number" && v > m; });
    if (unsteady.length) { if (over) skipped.push(`${a.name}: stored pool above max but the max is temporarily changed (${unsteady.join(", ")}) — clamp skipped`); }
    else for (const track of ["integrity", "stress"]) {
      const max = Number(lm[track]), val = getP(a, `system.derived.${track}.value`);
      if (!(Number.isFinite(max) && max > 0) || typeof val !== "number" || !Number.isFinite(val)) continue;
      if (val > max) setA(`system.derived.${track}.value`, max, `stored ${track} ${val} > derived max ${max} → ${max}`);
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
      const der = doc.system?.derived ?? {};
      const sk = [];
      let chassisOff = false; try { chassisOff = game.settings.get("fourththing", "threatChassis") === false; } catch (_e) {}
      const unsteady = [...((Number(der.integrity?.aeBonus) || Number(der.stress?.aeBonus)) ? ["AE max modifier"] : []), ...(chassisOff ? ["threat chassis off"] : [])];
      const ops = planLooseEnds(src, src.items ?? [], sk, { liveMax: { integrity: der.integrity?.max, stress: der.stress?.max }, unsteady });
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
    for (const op of p.ops) report.changes.push({ where: p.where, actor: p.doc.name, item: op.itemName ?? "—", kind: op.kind, paths: op.updates ? Object.keys(op.updates).join(", ") : `(${op.kind} → ${op.data?.type})`, why: op.why.join(" | ") });
  }

  if (!DRY_RUN && plans.length) {
    const backup = plans.map(p => ({
      uuid: p.doc.uuid, where: p.where, name: p.doc.name,
      actor: Object.fromEntries(p.ops.filter(o => o.target === "actor").flatMap(o => Object.keys(o.updates)).map(k => [k, getP(p.src, k) ?? null])),
      items: p.ops.filter(o => o.target === "item").map(o => (p.src.items ?? []).find(i => i._id === o.itemId)).filter(Boolean)
    }));
    const base = "Creature loose ends backup 2026-11-13";
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
            for (const op of p.ops.filter(o => o.target === "actor")) await p.doc.update(toFoundry(op.updates));
            const upd = p.ops.filter(o => o.target === "item" && o.kind === "update").map(o => ({ _id: o.itemId, ...toFoundry(o.updates) }));
            if (upd.length) await p.doc.updateEmbeddedDocuments("Item", upd);
            // weapon → feature: delete, then re-create with the SAME _id (keepId) — the type can't be updated in place
            for (const op of p.ops.filter(o => o.target === "item" && o.kind === "replace")) {
              await p.doc.deleteEmbeddedDocuments("Item", [op.itemId]);
              await p.doc.createEmbeddedDocuments("Item", [op.data], { keepId: true });
            }
          } catch (e) { report.errors.push(`${p.where} ${p.doc.name}: ${e.message}`); }
        }
      } finally {
        if (pack && wasLocked) { try { await pack.configure({ locked: true }); } catch (e) { report.errors.push(`relock: ${e.message}`); } }
      }
    }
  }

  console.log(`[creature loose ends] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${plans.length} actors, ${report.changes.length} changes, ${report.skipped.length} skipped, ${report.errors.length} errors`);
  console.table(report.changes);
  if (report.skipped.length) console.warn("[creature loose ends] skipped", report.skipped);
  if (report.errors.length) console.warn("[creature loose ends] errors", report.errors);
  globalThis.__creatureLooseEndsReport = report;
  ui.notifications?.info(`Creature loose ends ${DRY_RUN ? "dry run" : "applied"}: ${report.changes.length} changes on ${plans.length} actors${report.skipped.length ? `, ${report.skipped.length} skipped` : ""}${report.errors.length ? `, ${report.errors.length} ERRORS (console)` : ""}.`);
})();
