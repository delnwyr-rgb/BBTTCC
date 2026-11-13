/*
 * creature-audit-followups-2026-11-13.macro.js — Dave's 11-13 rulings on the creature audit's held items, applied to the
 * NPC compendium (bbttcc-master-content.npcs) and to the world's monster actors (world copies matched by NAME, as in
 * creature-audit-fixes-2026-11-12.macro.js — run THAT macro first; this one builds on its post-fix state).
 *
 *   1. Hex-Touched Champion: kinetic resistance KEPT (the Hex-Touched lineage signature). Its dice come down instead:
 *      Hex-Blade 2d8 → 1d8, Taken-Vow Rage 2d8 → 1d10 (text follows). Audit CR sim (R5d-n, N=2000): 4× CR 15.5 → 12.9
 *      (the T3 anchor is 13; the old "drop the resistance" fix read 12.8). Even the Stress-track floor 1d6/1d6 only
 *      reaches 12.3 — the resistance, not the dice, holds it above the ~11 median, so ~12.9 is as near as the dice go.
 *   2. "Recharges on a Soma Break" → recharge 5–6 ({mode:"d6",min:5}, npc-automation.js:533-542 rolls it at the owner's
 *      turn start; the Strike gate is module.js ~1741 → useRecharge). The world copies of Sklar "Sideways Landing",
 *      Burn-Zone Alpha ×4 "Cinder Howl", Gloomgill "Lightning Round" and Mechanism 52603 "Harmless Mini-Missiles" had NO
 *      recharge at all (fired every turn); the pack twins were fixed earlier. Every other monster item whose name or text
 *      still says "recharges on a Soma Break" is swept too: the recharge is set (Hex-Touched Stray's min 6 → 5, Dave:
 *      "a 5-6 recharge"), the name reads "(recharge 5–6)" (every if.weapon rule on that actor follows the rename), and the
 *      text line reads like the Tree Person's. Old foot units in those same items ("30-ft. cone") → squares.
 *   3. ELITE TOR-WRATH: a new monster — the (post-fix) pack Tor-Wrath's items / automation / art / bio, bracket HEAVY,
 *      tier I, an elite paragraph in its notes, encounter points 6 (measured — heavy's default 4 under-counts it; see ELITE_POINTS). Created in the npcs pack
 *      (Tor-Wrath's folder) AND as a world actor in the world Tor-Wraths' folder (world copy wears the world Tor-Wraths'
 *      art so it reads as one of them on the table). Skipped when an actor of that name already exists there.
 *
 * DRY RUN by default. globalThis.__creatureFollowupDry = false applies.
 *   globalThis.__creatureFollowupTokens = true  also applies to UNLINKED scene tokens whose delta overrides items.
 * Before any write, a JournalEntry "Creature audit follow-ups backup 2026-11-13" stores the before-JSON of every touched
 * item / changed actor path, and the names of the actors it will create (undo = delete them).
 * Report → globalThis.__creatureFollowupReport {changes, creates, skipped, errors, tokens, perActor}. Re-run = 0.
 */
(async () => {
  const DRY_RUN = globalThis.__creatureFollowupDry !== false;
  const DO_TOKENS = globalThis.__creatureFollowupTokens === true;

  // <plan> — pure (no Foundry globals): the offline harness extracts this block and runs it against the dumps.
  const DEL = "__FT_DEL__";
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const getP = (o, p) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : isObj(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
  const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
  const baseName = n => String(n ?? "").replace(/\s+\(?\d+\)?$/, "").trim();
  const RUNTIME_NA_KEYS = ["spent", "spentRound"];
  const stripRuntime = na => { if (!isObj(na)) return na; const o = clone(na); for (const k of RUNTIME_NA_KEYS) delete o[k]; return o; };

  const RECHARGE = { mode: "d6", min: 5 };
  const SOMA_NAME_RE = /\s*\(recharges? on a Soma Break\)/i;
  const SOMA_TEXT = "Recharges on a Soma Break.";
  const RECHARGE_TEXT = "Recharge 5–6: at the start of its turn it rolls 1d6; on a 5–6 it is ready again.";
  const UNIT_SWAPS = [["30-ft. cone", "6-square cone"], ["15-ft. cone", "3-square cone"], ["6-square. cone", "6-square cone"], ["3-square. cone", "3-square cone"], ["<em>Recharge 6.</em>", "<em>Recharge 5–6.</em>"]];

  // Hex-Touched Champion dice (Dave 11-13: keep the kinetic resistance, lower the dice)
  const HTC = { blade: ["2d8", "1d8"], rage: ["2d8", "1d10"] };

  // Elite Tor-Wrath
  const ELITE_NAME = "Elite Tor-Wrath";
  // heavy = 4 by the rule, but the audit sim (2026-11-13, R5d-n/k4, N=2000) says otherwise: alone 1 Elite ≈ 4 Tor-Wraths
  // (CR 3.6 vs 3.5 → 8 pts), 2 Elites ≈ 6 Tor-Wraths (6 pts each), inside 3 Tor-Wraths + 1 Elite it fights like ~2.5 (5 pts).
  // 6 = the middle; 3 Tor-Wraths + 1 Elite = 12 pts vs the L3 budget 8 → ×1.5 HARD.
  const ELITE_POINTS = 6;
  const ELITE_NOTE = "<p><strong>Elite.</strong> Now and then the mountain puts more than one grudge into the same body. An Elite Tor-Wrath is a whole collapsed gallery's worth of fury packed into one shape: broader through the shoulders, slower to come apart, and it hits twice before the lesser ones have finished turning round. The others follow it the way water follows a crack.</p>";

  function planFollowups(actorData, itemsData) {
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
    const I = (name) => items.find(i => i.name === name) ?? null;
    const IR = (re) => items.find(i => re.test(i.name)) ?? null;
    const NA = it => getP(it, "flags.fourththing.npcAuto");
    const descOf = it => String(getP(it, "system.description.value") ?? "");
    const setFormula = (it, from, to, why) => { if (it && getP(it, "system.damage.formula") === from) setI(it, "system.damage.formula", to, why); };
    // text: apply every [from,to] pair present to one string field, as ONE write (idempotent: only when a `from` is present)
    const swapAll = (it, path, pairs, why) => {
      const pend = byItem.get(it?._id)?.updates?.[path];   // a swap already queued on this path builds on, never overwrites
      const cur = pend !== undefined ? pend : getP(it, path); if (typeof cur !== "string") return;
      let s = cur; for (const [f, t] of pairs) if (s.includes(f)) s = s.split(f).join(t);
      if (s !== cur) setI(it, path, s, why);
    };

    // ── 2. Soma Break sweep (every monster) ──
    const somaItems = items.filter(it => ["weapon", "feature", "feat"].includes(it.type)
      && (SOMA_NAME_RE.test(it.name) || descOf(it).includes(SOMA_TEXT)
        || (/\(recharge 5–6\)/i.test(it.name) && NA(it)?.recharge && !(NA(it).recharge.mode === "d6" && NA(it).recharge.min === 5))));
    const renames = new Map();   // old name → new name
    for (const it of somaItems) if (SOMA_NAME_RE.test(it.name)) renames.set(it.name, it.name.replace(SOMA_NAME_RE, " (recharge 5–6)").replace(/\s+/g, " ").trim());
    const renameRules = rules => (rules ?? []).map(r => (r?.if?.weapon && renames.has(r.if.weapon)) ? { ...clone(r), if: { ...clone(r.if), weapon: renames.get(r.if.weapon) } } : clone(r));
    // whole-npcAuto writes (recharge + renamed if.weapon) — compare without the runtime spent flags
    const naWrites = new Map();
    for (const it of somaItems) {
      const na = NA(it), hasUse = (na?.rules ?? []).some(r => r.on === "use");
      if (it.type !== "weapon" && !hasUse) continue;   // a recharge on a feature without ▶ Use rules gates nothing — text only
      if (na?.recharge?.mode === "combat" || na?.requires?.ownerBloodied) continue;   // 1/scene limits + gated ULTIMATEs stay as ruled
      naWrites.set(it._id, { ...(stripRuntime(na) ?? { v: 1, rules: [] }), recharge: { ...RECHARGE } });
    }
    if (renames.size) for (const it of items) {
      const na = NA(it); if (!(na?.rules ?? []).some(r => r?.if?.weapon && renames.has(r.if.weapon))) continue;
      const base = naWrites.get(it._id) ?? stripRuntime(na);
      naWrites.set(it._id, { ...base, rules: renameRules(base.rules) });
    }
    for (const [id, val] of naWrites) {
      const it = items.find(x => x._id === id), old = NA(it);
      if (same(stripRuntime(old), val)) continue;
      const out = clone(val);
      if (isObj(old)) for (const k of Object.keys(old)) if (!(k in out) && !RUNTIME_NA_KEYS.includes(k)) out[k] = DEL;
      if (isObj(old) && old.spent) out.spent = false;   // a recharge that changes mode starts ready
      const why = old?.recharge ? (old.recharge.min !== 5 ? `Dave 11-13: Soma Break recharge = 5–6 (was ${old.recharge.mode} ${old.recharge.min ?? ""})` : "rename: if.weapon follows the item's new name")
        : "Dave 11-13: 'recharges on a Soma Break' had NO recharge (fired every turn) → recharge 5–6";
      const op = itemOp(it); op.updates["flags.fourththing.npcAuto"] = out; if (!op.why.includes(why)) op.why.push(why);
    }
    for (const it of somaItems) {
      if (renames.has(it.name)) setI(it, "name", renames.get(it.name), "Dave 11-13: name matches the 5–6 recharge");
      swapAll(it, "system.description.value", [[SOMA_TEXT, RECHARGE_TEXT], ...UNIT_SWAPS], "Dave 11-13: text matches the 5–6 recharge (and squares, not feet)");
    }

    // ── 1. Hex-Touched Champion ──
    if (bn === "Hex-Touched Champion") {
      const hb = I("Hex-Blade"), tv = IR(/^Taken-Vow Rage/);
      const w = "Dave 11-13: kinetic resist KEPT (lineage), dice down instead — 4× CR 15.5 → 12.9 (T3 anchor 13)";
      for (const [it, [from, to]] of [[hb, HTC.blade], [tv, HTC.rage]]) {
        if (!it) continue;
        setFormula(it, from, to, w);
        if (getP(it, "system.damage.formula") === from || getP(it, "system.damage.formula") === to) swapAll(it, "system.description.value", [[`<code>${from}</code>`, `<code>${to}</code>`]], w);
      }
    }
    return ops;
  }

  /** The Elite's creation data from the (post-fix) pack Tor-Wrath. opts: { img, tokenImg, folder } override the art / folder. */
  function eliteSourceProblems(src, srcItems) {
    const p = [];
    if (!src || src.type !== "npc" || src.name !== "Tor-Wrath") p.push("source is not the pack Tor-Wrath");
    if (Number(getP(src, "flags.fourththing.rfi.actor.points")) !== 2) p.push("Tor-Wrath points ≠ 2 — run creature-audit-fixes-2026-11-12 first");
    const ta = (srcItems ?? []).find(i => /^Tantrum/.test(i.name));
    if (!(getP(ta, "flags.fourththing.npcAuto.rules") ?? []).some(r => r.do?.save?.onSave === "half")) p.push("Tantrum is pre-fix — run creature-audit-fixes-2026-11-12 first");
    return p;
  }
  function planElite(src, srcItems, opts = {}) {
    const d = clone(src);
    for (const k of ["_id", "_stats", "sort", "folder"]) delete d[k];
    d.name = ELITE_NAME;
    if (opts.folder !== undefined) d.folder = opts.folder;
    if (opts.img) d.img = opts.img;
    d.prototypeToken = { ...(d.prototypeToken ?? {}), name: ELITE_NAME };
    d.prototypeToken.texture = { ...(d.prototypeToken.texture ?? {}), ...(opts.tokenImg ? { src: opts.tokenImg } : {}), scaleX: 1.25, scaleY: 1.25 };
    const r = getP(d, "flags.fourththing.rfi.actor") ?? {};
    d.flags.fourththing.rfi.actor = { ...r, bracket: "heavy", tier: "I", points: ELITE_POINTS, archetype: "tor-wrath-elite", eliteOf: "Tor-Wrath",
      title: "Qliphothic Vermin (Ghagiel — Elite)",
      price: { ...(r.price ?? {}), marks: 10, bounty: 10, hire: 15, ransom: 15,
        notes: "TI heavy qliphothic — bounty 10 / hire 15 marks; credited to the pool matching the method (default softpower)" } };
    const notes = String(getP(d, "system.notes") ?? "");
    if (!notes.includes("<strong>Elite.</strong>")) d.system.notes = notes + ELITE_NOTE;
    if (d.system?.derived?.integrity) d.system.derived.integrity.temp = 0;
    d.items = (srcItems ?? []).map(it => {
      const o = clone(it); delete o._stats; delete o.folder; delete o.sort;
      const na = getP(o, "flags.fourththing.npcAuto"); if (isObj(na)) o.flags.fourththing.npcAuto = stripRuntime(na);
      return o;
    });
    d.effects = clone(src.effects ?? []);
    return d;
  }
  // </plan>

  // ── Foundry side ─────────────────────────────────────────────────────────────────────────────────────────
  const report = { DRY_RUN, changes: [], creates: [], skipped: [], errors: [], tokens: [], perActor: {} };
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
  const plans = [];   // { doc, where, ops, src }
  const consider = (doc, where) => {
    try {
      const src = doc.toObject();
      const ops = planFollowups(src, src.items ?? []);
      if (ops.length) plans.push({ doc, where, ops, src });
    } catch (e) { report.errors.push(`${where} ${doc?.name}: plan failed — ${e.message}`); }
  };

  const pack = game.packs.get("bbttcc-master-content.npcs") ?? game.packs.find(p => p.documentName === "Actor" && /bbttcc-master-content\.npcs$/.test(p.collection));
  let packDocs = [];
  if (!pack) report.errors.push("npcs pack bbttcc-master-content.npcs not found");
  else { packDocs = await pack.getDocuments(); for (const d of packDocs) consider(d, `pack:${pack.collection}`); }
  for (const a of game.actors) consider(a, "world");

  for (const sc of game.scenes ?? []) for (const t of sc.tokens ?? []) {
    try {
      if (t.actorLink || !t.actor || t.actor.type !== "npc") continue;
      const dItems = t.delta?._source?.items ?? t._source?.delta?.items ?? [];
      if (!dItems.length) continue;
      const src = t.actor.toObject(); const ops = planFollowups(src, src.items ?? []);
      if (!ops.length) continue;
      report.tokens.push({ scene: sc.name, token: t.name, ops: ops.length, applied: DO_TOKENS && !DRY_RUN });
      if (DO_TOKENS) plans.push({ doc: t.actor, where: `token:${sc.name}`, ops, src });
    } catch (e) { report.errors.push(`token ${sc.name} ${t.name}: ${e.message}`); }
  }

  // Elite Tor-Wrath creates
  const creates = [];   // { where, data }
  const packTW = packDocs.find(d => d.name === "Tor-Wrath" && d.type === "npc");
  if (!packTW) report.errors.push("pack Tor-Wrath not found — no Elite Tor-Wrath");
  else {
    const src = packTW.toObject(), probs = eliteSourceProblems(src, src.items ?? []);
    if (probs.length) report.errors.push(`Elite Tor-Wrath not planned: ${probs.join("; ")}`);
    else {
      if (packDocs.some(d => d.name === ELITE_NAME)) report.skipped.push(`pack already has ${ELITE_NAME}`);
      else creates.push({ where: `pack:${pack.collection}`, data: planElite(src, src.items ?? [], { folder: src.folder ?? null }) });
      if (game.actors.getName(ELITE_NAME)) report.skipped.push(`world already has ${ELITE_NAME}`);
      else {
        const sib = game.actors.find(a => a.type === "npc" && baseName(a.name) === "Tor-Wrath");
        creates.push({ where: "world", data: planElite(src, src.items ?? [], { folder: sib?.folder?.id ?? null, img: sib?.img, tokenImg: sib?.prototypeToken?.texture?.src }) });
      }
    }
  }
  for (const c of creates) report.creates.push({ where: c.where, name: c.data.name, items: c.data.items.length, bracket: c.data.flags.fourththing.rfi.actor.bracket, points: c.data.flags.fourththing.rfi.actor.points, folder: c.data.folder ?? null, img: c.data.img });

  for (const p of plans) {
    report.perActor[`${p.where} ${p.doc.name}`] = p.ops.length;
    for (const op of p.ops) report.changes.push({ where: p.where, actor: p.doc.name, item: op.itemName ?? "—", kind: op.kind, paths: Object.keys(op.updates ?? {}).join(", "), why: op.why.join(" | ") });
  }

  if (!DRY_RUN && (plans.length || creates.length)) {
    const backup = {
      updates: plans.map(p => ({
        uuid: p.doc.uuid, where: p.where, name: p.doc.name,
        items: p.ops.filter(o => o.target === "item").map(o => (p.src.items ?? []).find(i => i._id === o.itemId)).filter(Boolean)
      })),
      creates: creates.map(c => ({ where: c.where, name: c.data.name, undo: "delete this actor" }))
    };
    const base = "Creature audit follow-ups backup 2026-11-13";
    let n = 1; while (game.journal.getName(n === 1 ? base : `${base} (pass ${n})`)) n++;
    try {
      const esc = s => (foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s) : s.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
      await JournalEntry.create({ name: n === 1 ? base : `${base} (pass ${n})`, pages: [{ name: "before", type: "text", text: { content: `<pre>${esc(JSON.stringify(backup, null, 1))}</pre>` } }] });
    } catch (e) { report.errors.push(`backup journal failed — NOTHING applied: ${e.message}`); }

    if (!report.errors.some(e => e.startsWith("backup journal failed"))) {
      const wasLocked = pack?.locked;
      try {
        if (pack && wasLocked && (plans.some(p => p.where.startsWith("pack:")) || creates.some(c => c.where.startsWith("pack:")))) await pack.configure({ locked: false });
        for (const p of plans) {
          try {
            const upd = p.ops.filter(o => o.target === "item" && o.kind === "update").map(o => ({ _id: o.itemId, ...toFoundry(o.updates) }));
            if (upd.length) await p.doc.updateEmbeddedDocuments("Item", upd);
          } catch (e) { report.errors.push(`${p.where} ${p.doc.name}: ${e.message}`); }
        }
        for (const c of creates) {
          try {
            const made = c.where.startsWith("pack:") ? await Actor.implementation.create(c.data, { pack: pack.collection }) : await Actor.implementation.create(c.data);
            const rc = report.creates.find(x => x.where === c.where); if (rc) rc.uuid = made?.uuid ?? null;
            // the copy stores Tor-Wrath's 18/10 pools; the chassis raises max to heavy's at prepare. Fill it here, awaited and
            // while the pack is still unlocked (the createActor fill hook is un-awaited and can lose the race with the relock).
            const dv = made?.system?.derived, fill = {};
            if (dv?.integrity && Number(dv.integrity.value) < Number(dv.integrity.max)) fill["system.derived.integrity.value"] = dv.integrity.max;
            if (dv?.stress && Number(dv.stress.value) < Number(dv.stress.max)) fill["system.derived.stress.value"] = dv.stress.max;
            if (Object.keys(fill).length) await made.update(fill);
          } catch (e) { report.errors.push(`create ${c.where} ${c.data.name}: ${e.message}`); }
        }
      } finally {
        if (pack && wasLocked) { try { await pack.configure({ locked: true }); } catch (e) { report.errors.push(`relock: ${e.message}`); } }
      }
    }
  }

  console.log(`[creature-audit follow-ups] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${plans.length} actors, ${report.changes.length} item changes, ${report.creates.length} creates, ${report.tokens.length} unlinked tokens with item deltas${DO_TOKENS ? "" : " (reported only)"}, ${report.errors.length} errors`);
  console.table(report.changes);
  if (report.creates.length) console.table(report.creates);
  if (report.tokens.length) console.table(report.tokens);
  if (report.skipped.length) console.info("[creature-audit follow-ups] skipped", report.skipped);
  if (report.errors.length) console.warn("[creature-audit follow-ups] errors", report.errors);
  globalThis.__creatureFollowupReport = report;
  ui.notifications?.info(`Creature audit follow-ups ${DRY_RUN ? "dry run" : "applied"}: ${report.changes.length} changes on ${plans.length} actors, ${report.creates.length} creates${report.errors.length ? `, ${report.errors.length} ERRORS (console)` : ""}.`);
})();
