// Bad Eden — Strategic Throughput Registry (Alpha Consolidated, beacon + watchdog, deduped)

(() => {
  // ---- BEACON: proves this file executed at least once ----
  globalThis.__bbttcc_strategic_throughput_loaded_v6 = Date.now();
  console.log("[bbttcc-strategic] strategic-throughput.js loaded (v6)", globalThis.__bbttcc_strategic_throughput_loaded_v6);

  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];

  function normalizeOPKey(k){
    if(!k) return null;
    const low = String(k).toLowerCase().trim();
    if(low === "softpower" || low === "soft_power") return "softpower";
    if(low === "nonlethal" || low === "non_lethal") return "nonlethal";
    if(OP_KEYS.includes(low)) return low;
    return null;
  }

  function normalizeCost(cost){
    const out = {};
    for(const [k,v] of Object.entries(cost||{})){
      const nk = normalizeOPKey(k);
      if(!nk) continue;
      out[nk] = Math.max(0, Number(v||0));
    }
    return out;
  }

  function pushWarLog(A, summary){
    if (!A) return;
    const wl = Array.isArray(A.getFlag(MODF,"warLogs"))
      ? A.getFlag(MODF,"warLogs").slice()
      : [];
    wl.push({
      ts: Date.now(),
      date: (new Date()).toLocaleString(),
      type: "turn",
      activity: "strategic",
      summary
    });
    return A.update({ [`flags.${MODF}.warLogs`]: wl });
  }

  async function adjustFactionTrack(A,key,delta){
    if (!A) return { before: 0, after: 0 };
    if (key === "darkness") return adjustFactionDarkness(A, delta);   // the box, never a bare number (audit 2026-09-09)
    if (key === "unity") key = "morale";   // "Empathy Meter" = faction Morale — victory.unity is recomputed every turn, so bumps there were wiped
    const before = Number(A.getFlag(MODF,key)||0);
    const after  = Math.max(0,Math.min(100,before+delta));
    await A.update({ [`flags.${MODF}.${key}`]: after });
    return {before,after};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ENGINE ADAPTERS (2026-09-09 — every legendary/T2 row below is wired to a
  // real engine through these; nothing writes a flag that has no reader).
  // ─────────────────────────────────────────────────────────────────────────
  const DARK_CAP = 10;
  // flags.bbttcc-factions.darkness = { global: 0..10, [hexDrawingId]: 0..10 } — a BOX.
  // adjustFactionTrack used to overwrite it with a bare number, wiping every
  // per-hex key (audit 2026-09-09). Always preserve the box.
  async function adjustFactionDarkness(A, delta){
    if (!A) return { before: 0, after: 0 };
    const raw = A.getFlag(MODF, "darkness");
    const box = (raw && typeof raw === "object") ? foundry.utils.duplicate(raw) : {};
    const before = (typeof box.global === "number") ? box.global : (typeof raw === "number" ? raw : 0);
    const after = Math.max(0, Math.min(DARK_CAP, before + Number(delta || 0)));
    box.global = after;
    await A.update({ [`flags.${MODF}.darkness`]: box });
    return { before, after };
  }
  async function zeroFactionDarkness(A){
    if (!A) return { before: 0, after: 0 };
    const raw = A.getFlag(MODF, "darkness");
    const box = (raw && typeof raw === "object") ? foundry.utils.duplicate(raw) : {};
    const before = (typeof box.global === "number") ? box.global : (typeof raw === "number" ? raw : 0);
    for (const k of Object.keys(box)) if (typeof box[k] === "number") box[k] = 0;
    box.global = 0;
    await A.update({ [`flags.${MODF}.darkness`]: box });
    return { before, after: 0, hexKeys: Object.keys(box).length - 1 };
  }
  async function setFactionHexDarkness(A, hexDocId, value){
    if (!A || !hexDocId) return;
    const raw = A.getFlag(MODF, "darkness");
    const box = (raw && typeof raw === "object") ? foundry.utils.duplicate(raw) : { global: (typeof raw === "number" ? raw : 0) };
    box[hexDocId] = Math.max(0, Math.min(DARK_CAP, Number(value || 0)));
    await A.update({ [`flags.${MODF}.darkness`]: box });
  }
  async function bumpFactionMeter(A, key, delta){   // morale | loyalty, 0..100, no sheet re-render
    if (!A) return { before: 0, after: 0 };
    const before = Number(A.getFlag(MODF, key) ?? 50) || 0;
    const after = Math.max(0, Math.min(100, before + Number(delta || 0)));
    if (after !== before) await A.update({ [`flags.${MODF}.${key}`]: after });
    return { before, after };
  }
  async function hexDoc(uuid){ try { const r = await fromUuid(uuid); return r?.document ?? r ?? null; } catch (_e) { return null; } }
  const tfOf = (doc) => doc?.flags?.[MODT] || {};
  const hexName = (doc) => String(tfOf(doc).name || doc?.text || doc?.id || "the hex");
  const hexOwnerId = (doc) => String(tfOf(doc).factionId || tfOf(doc).ownerId || "");
  const isHexDoc = (d) => { const tf = d?.flags?.[MODT]; return !!tf && (tf.isHex === true || tf.kind === "territory-hex" || !!tf.hexId || !!tf.name); };
  function ownedHexes(fid){
    const out = [];
    for (const sc of game.scenes ?? []) for (const d of sc.drawings ?? []) if (isHexDoc(d) && hexOwnerId(d) === String(fid)) out.push(d);
    return out;
  }
  const center = (d) => ({ x: Number(d.x || 0) + Number(d.shape?.width || 0) / 2, y: Number(d.y || 0) + Number(d.shape?.height || 0) / 2 });
  function nearestNeighbors(doc, n = 6){   // the turn engine's own trust model: 6 nearest centroids on the same scene
    const sc = doc?.parent; if (!sc) return [];
    const c0 = center(doc);
    return (sc.drawings?.contents ?? sc.drawings ?? []).filter(d => d.id !== doc.id && isHexDoc(d))
      .map(d => { const c = center(d); return { d, dist: Math.hypot(c.x - c0.x, c.y - c0.y) }; })
      .sort((a, b) => a.dist - b.dist).slice(0, n).map(x => x.d);
  }
  // Immediate modifier write + ledger (the pending sweep is for next-turn effects).
  async function setHexModifiers(doc, add = [], remove = [], meta = {}){
    if (!doc) return { added: [], removed: [] };
    const cur = Array.isArray(tfOf(doc).modifiers) ? tfOf(doc).modifiers.slice() : [];
    const low = (s) => String(s || "").toLowerCase();
    const removed = cur.filter(m => remove.some(r => low(r) === low(m)));
    let next = cur.filter(m => !remove.some(r => low(r) === low(m)));
    const added = add.filter(a => !next.some(m => low(m) === low(a)));
    next = next.concat(added);
    if (added.length || removed.length) {
      await doc.update({ [`flags.${MODT}.modifiers`]: next }, { parent: doc.parent });
      const rec = game.bbttcc?.api?.territory?.recordHexModifierTransition;
      if (typeof rec === "function") {
        for (const m of added)   { try { await rec(doc, m, "added",   meta, `${meta.activity || "strategic"}:${doc.id}:${m}:add`); } catch (_e) {} }
        for (const m of removed) { try { await rec(doc, m, "removed", meta, `${meta.activity || "strategic"}:${doc.id}:${m}:rm`); } catch (_e) {} }
      }
    }
    return { added, removed };
  }
  async function setHexDarkness(doc, { delta = 0, set = null } = {}){   // flags.bbttcc-territory.mods.darkness (hex-local, 0..6 pips)
    if (!doc) return { before: 0, after: 0 };
    const mods = foundry.utils.duplicate(tfOf(doc).mods || {});
    const before = Number(mods.darkness || 0) || 0;
    const after = Math.max(0, set != null ? Number(set) : before + Number(delta || 0));
    if (after !== before) { mods.darkness = after; await doc.update({ [`flags.${MODT}.mods`]: mods }, { parent: doc.parent }); }
    return { before, after };
  }
  async function patchHex(doc, patch){ if (doc) await doc.update(patch, { parent: doc.parent }); }
  async function setCondition(uuid, name, on = true){
    const fn = game.bbttcc?.api?.territory?.setCondition;
    if (typeof fn !== "function") return false;
    try { return await fn(uuid, name, on); } catch (e) { console.warn("[bbttcc-strategic] setCondition failed", e); return false; }
  }
  async function revealHex(doc){ if (doc && doc.hidden) { await doc.update({ hidden: false }, { parent: doc.parent }); return true; } return false; }
  const stewardsOf = (fid) => (game.actors?.contents ?? []).filter(a => a?.type === "character" && String(a.getFlag?.(MODF, "factionId") || "") === String(fid));
  function factionOwnerIds(A){
    const ids = new Set(ChatMessage.getWhisperRecipients("GM").map(u => u.id));
    for (const u of game.users ?? []) { try { if (A?.testUserPermission?.(u, "OWNER")) ids.add(u.id); } catch (_e) {} }
    return [...ids];
  }
  async function whisperFaction(A, title, html){
    try {
      await ChatMessage.create({ whisper: factionOwnerIds(A), speaker: { alias: "Bad Eden" },
        content: `<div style="border-left:3px solid #6c8ebf;padding:.35em .6em;background:rgba(108,142,191,.08);"><b>${foundry.utils.escapeHTML(String(title))}</b><div style="font-size:.9em;margin-top:.25em">${html}</div></div>` });
    } catch (e) { console.warn("[bbttcc-strategic] whisper failed", e); }
  }
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  function bonusesOf(A){ return foundry.utils.duplicate(A?.getFlag(MODF, "bonuses") || {}); }
  async function writeBonuses(A, mut){ const b = bonusesOf(A); await mut(b); await A.update({ [`flags.${MODF}.bonuses`]: b }); return b; }
  // Per-channel regen multiplier plan — consumed by turn-driver advanceOPRegen (inTurns 1 = this Advance's income).
  async function addRegenPlan(A, entries){
    return writeBonuses(A, (b) => { b.regenPlan = Array.isArray(b.regenPlan) ? b.regenPlan : []; for (const e of entries) b.regenPlan.push(e); });
  }
  // Temporary cap bump — consumed by turn-driver's two cap clamps; never touches opCaps (tier-up would make it permanent).
  async function addCapBump(A, channel, add, turns){
    return writeBonuses(A, (b) => { b.capBump = b.capBump || {}; const cur = b.capBump[channel] || { add: 0, turns: 0 }; b.capBump[channel] = { add: Number(cur.add || 0) + Number(add || 0), turns: Math.max(Number(cur.turns || 0), Number(turns || 0)) }; });
  }
  async function setTruce(A, B, turns){
    await writeBonuses(A, (b) => { b.truce = b.truce || {}; b.truce[B.id] = { turns: Number(turns || 2), with: B.name, since: Date.now() }; });
    await writeBonuses(B, (b) => { b.truce = b.truce || {}; b.truce[A.id] = { turns: Number(turns || 2), with: A.name, since: Date.now() }; });
  }
  function relationsApi(){ return game.bbttcc?.api?.factions?.relations || null; }
  function mutuallyAllied(A, B){
    const r = relationsApi(); if (!r || typeof r.get !== "function") return false;
    try { return r.get(A, B) === "allied" && r.get(B, A) === "allied"; } catch (_e) { return false; }
  }
  async function factionOfHex(doc){ const id = hexOwnerId(doc); return id ? game.actors.get(id) || null : null; }
  // OP bank transfer with the engine's own commit (caps respected; a refused credit is scheduled instead of lost).
  async function creditOP(A, channel, marks, label){
    const op = game.bbttcc?.api?.op;
    if (op && typeof op.commit === "function") {
      try { const r = await op.commit(A.id, { [channel]: Math.abs(marks) }, { source: "strategic", label }); if (r && r.ok !== false) return { ok: true, via: "commit" }; } catch (_e) {}
    }
    await scheduleFactionOP(A, { [channel]: Math.abs(marks) }, 1);
    return { ok: true, via: "scheduled" };
  }
  async function debitOP(A, channel, marks, label){
    const have = Number(A.getFlag(MODF, "opBank")?.[channel] || 0);
    const take = Math.max(0, Math.min(have, Math.abs(marks)));
    if (!take) return 0;
    const op = game.bbttcc?.api?.op;
    if (op && typeof op.commit === "function") { try { await op.commit(A.id, { [channel]: -take }, { source: "strategic", label }); return take; } catch (_e) {} }
    const bank = foundry.utils.duplicate(A.getFlag(MODF, "opBank") || {}); bank[channel] = have - take; await A.update({ [`flags.${MODF}.opBank`]: bank }); return take;
  }
  const ENLIGHTENMENT_LADDER = ["unawakened","awakening","seeking","wisdom","understanding","enlightened"];
  async function grantNextEnlightenment(actor){
    const cur = String(actor.getFlag?.("bbttcc-character-options", "enlightenment")?.level || "unawakened").toLowerCase();
    const i = ENLIGHTENMENT_LADDER.indexOf(cur);
    if (i < 0) return { ok: false, why: `${actor.name} is ${cur} — not on the ladder` };
    if (i >= ENLIGHTENMENT_LADDER.length - 1) return { ok: false, why: `${actor.name} is already Enlightened` };
    const next = ENLIGHTENMENT_LADDER[i + 1];
    const pack = game.packs.get("bbttcc-character-options.enlightenment-levels");
    if (!pack) return { ok: false, why: "enlightenment-levels pack missing" };
    const docs = await pack.getDocuments();
    const slug = (s) => { const m = String(s ?? "").trim().toLowerCase().match(/^enlightenment[:\-]\s*(.+)$/); return m ? m[1].trim().replace(/\s+/g, "-") : ""; };
    const item = docs.find(d => slug(d.system?.identifier) === next || slug(d.name) === next || String(d.name || "").toLowerCase().includes(next));
    if (!item) return { ok: false, why: `no "${next}" level item in the pack` };
    const old = actor.items.filter(it => slug(it.system?.identifier) || slug(it.name) || it.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels").map(it => it.id);
    if (old.length) await actor.deleteEmbeddedDocuments("Item", old);
    await actor.createEmbeddedDocuments("Item", [item.toObject()]);
    return { ok: true, from: cur, to: next };
  }
  async function rollCheck({ dc, bonus = 0, label = "" }){
    const fc = game.fourththing?.rolls?.flatCheck;
    if (typeof fc === "function") { try { return await fc({ dc, bonus, label }); } catch (_e) {} }
    const roll = await new Roll("2d10x10 + @b", { b: bonus }).evaluate();
    return { total: roll.total, ok: roll.total >= dc, dc, bonus, roll };
  }
  async function queueRouteEdge(aUuid, bUuid, kind_){   // mirrors effects-establish-trade-route (both ends)
    for (const [a, b] of [[aUuid, bUuid], [bUuid, aUuid]]) {
      const d = await hexDoc(a); if (!d) continue;
      const f0 = foundry.utils.duplicate(d.flags?.[MODT] || {}); const pend0 = foundry.utils.getProperty(f0, "turn.pending") || {};
      pend0.routes = Array.isArray(pend0.routes) ? pend0.routes.slice() : [];
      if (!pend0.routes.some(r => r?.hexUuid === b && r?.kind === kind_)) pend0.routes.push({ hexUuid: b, kind: kind_ });
      await d.update({ [`flags.${MODT}.turn.pending`]: pend0 }, { parent: d.parent });
    }
  }
  const CLEAN_TAGS = ["Contaminated", "Radiation Zone", "Damaged Infrastructure", "Hostile Population", "Propaganda"];

  async function adjustHexTrack(hexUuid, track, delta){
    if (!hexUuid) return;
    const ref = await fromUuid(hexUuid);
    const doc = ref?.document ?? ref;
    if(!doc) return;
    const tf = foundry.utils.duplicate(doc.flags?.[MODT]||{});
    const before = Number(tf[track]||0);
    const after = Math.max(0, before + Number(delta||0));
    tf[track] = after;
    await doc.update({ [`flags.${MODT}`]: tf }, { parent: doc.parent });
  }

  async function spendOP(factionId, cost, reason){
    const op = game.bbttcc && game.bbttcc.api && game.bbttcc.api.op;
    if(!op || typeof op.commit !== "function") return false;

    const norm = normalizeCost(cost);
    const deltas = {};
    for(const [k,v] of Object.entries(norm)){
      deltas[k] = -Math.abs(v);
    }
    try { return await op.commit(factionId, deltas, reason||"strategic"); }
    catch (e) { console.warn("[bbttcc-strategic] OP commit failed", e); return false; }
  }

  // For effects that were previously stored under pending.repairs.{add/remove}Modifiers
  async function enqueuePendingRepairs(hexUuid, addMods, removeMods){
    addMods = Array.isArray(addMods) ? addMods : (addMods ? [addMods] : []);
    removeMods = Array.isArray(removeMods) ? removeMods : (removeMods ? [removeMods] : []);

    const ref = await fromUuid(hexUuid);
    const doc = ref?.document ?? ref;
    if(!doc) return;

    const f = foundry.utils.duplicate(doc.flags?.[MODT] || {});
    const pend = foundry.utils.getProperty(f, "turn.pending") || {};

    pend.repairs = pend.repairs || {};
    pend.repairs.addModifiers = Array.isArray(pend.repairs.addModifiers) ? pend.repairs.addModifiers.slice() : [];
    pend.repairs.removeModifiers = Array.isArray(pend.repairs.removeModifiers) ? pend.repairs.removeModifiers.slice() : [];

    for (const m of addMods) if (m && !pend.repairs.addModifiers.includes(m)) pend.repairs.addModifiers.push(m);
    for (const m of removeMods) if (m && !pend.repairs.removeModifiers.includes(m)) pend.repairs.removeModifiers.push(m);

    await doc.update({ [`flags.${MODT}.turn.pending`]: pend });
  }

  function enqueueRequest(req){
    const turnApi = game.bbttcc && game.bbttcc.api && game.bbttcc.api.turn;
    if (!turnApi || typeof turnApi.enqueueRequest !== "function") {
      console.warn("[bbttcc-strategic] enqueueRequest unavailable; turn API missing");
      return null;
    }
    return turnApi.enqueueRequest(req);
  }

  function scheduleFactionOP(A, opDelta, turns){
    if (!A) return;
    turns = Number(turns || 1) || 1;
    // SIM-BADEDEN fix 2026-06-05: every caller in this file authors opDelta in
    // OP units ("+1 Economy", "+2 Logistics" per the warLog copy) but the bank
    // is denominated in MARKS (1 OP = 10 marks, op-engine canon 2026-05-09).
    // Convert here so deferred income is worth what the copy promises —
    // previously it under-paid 10× (when it paid at all; the scheduled queue
    // also had no consumer until turn-driver's applyScheduledOPBonuses).
    const marksDelta = {};
    for (const [k, v] of Object.entries(opDelta || {})) {
      const n = Number(v) || 0;
      if (n) marksDelta[k] = n;   // authored in MARKS since 2026-09-06 (was OP ×10)
    }
    const bonuses = foundry.utils.duplicate(A.getFlag(MODF,"bonuses")||{});
    bonuses.scheduled = Array.isArray(bonuses.scheduled) ? bonuses.scheduled : [];
    bonuses.scheduled.push({ turnOffset: turns, opDelta: marksDelta });
    return A.update({ [`flags.${MODF}.bonuses`]: bonuses });
  }

  function setNextTurnFlag(A, patch){
    if (!A) return;
    const bonuses = foundry.utils.duplicate(A.getFlag(MODF,"bonuses")||{});
    bonuses.nextTurn = bonuses.nextTurn || {};
    Object.assign(bonuses.nextTurn, patch || {});
    return A.update({ [`flags.${MODF}.bonuses`]: bonuses });
  }

  function incNextTurn(A, key, by){
    by = Number(by || 1) || 1;
    if (!A) return 0;
    const cur = Number(A?.getFlag(MODF,"bonuses")?.nextTurn?.[key] || 0);
    return cur + by;
  }

  // ----------------------------
  // Strategic Throughput (deduped)
  // ----------------------------
  const STRATEGIC_THROUGHPUT = {

    // ═══════════════════════════ T1 ═══════════════════════════
    async harvest_season(ctx){
      const A = game.actors.get(ctx.factionId);
      // OWNER DIAL (2026-06-05): +20 marks Economy into the bank next turn for a 10-mark spend.
      await scheduleFactionOP(A, { economy: 20 }, 1);
      await pushWarLog(A,"Harvest Season: +20 marks Economy next turn (tier cap applies).");
    },
    async ration_distribution(ctx){
      const A = game.actors.get(ctx.factionId);
      if(ctx.targetUuid){ await adjustHexTrack(ctx.targetUuid,"loyalty",+1); await pushWarLog(A,"Ration Distribution: Loyalty +1 (target hex)."); }
    },
    async minor_repair(ctx){
      const A = game.actors.get(ctx.factionId);
      await enqueueRequest({ key:"repairs", factionId: A?.id || ctx.factionId, value:{ hexUuid:ctx.targetUuid, tag:"Damaged Infrastructure" } });
      await pushWarLog(A,"Minor Repair: Repair queued (remove Damaged Infrastructure).");
    },
    async charity_drive(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await adjustFactionDarkness(A,-1);
      await pushWarLog(A,`Charity Drive: Darkness ${r.before} → ${r.after}.`);
    },
    async civic_audit(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await bumpFactionMeter(A,"loyalty",+1);
      await pushWarLog(A,`Civic Audit: Loyalty ${r.before} → ${r.after}.`);
    },
    // Recon Sweep — reveals ONE hidden hex next to the target and reports what stands there.
    async recon_sweep(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc) { await pushWarLog(A, "Recon Sweep: no target hex."); return; }
      const ring = nearestNeighbors(doc, 6);
      const hidden = ring.find(d => d.hidden);
      if (hidden) await revealHex(hidden);
      const rows = ring.map(d => { const tf = tfOf(d); const owner = tf.faction || tf.ownerName || (hexOwnerId(d) ? game.actors.get(hexOwnerId(d))?.name : "") || "unclaimed"; return `<li><b>${esc(hexName(d))}</b> — ${esc(tf.sephirotName || tf.sephirotKey || "unaligned")} · ${esc(owner)}${d.hidden ? " · <i>still fogged</i>" : ""}</li>`; });
      await whisperFaction(A, `Recon Sweep around ${hexName(doc)}`, `${hidden ? `Scouts uncovered <b>${esc(hexName(hidden))}</b>.` : "Nothing new was fogged nearby."}<ul style="margin:.25em 0 0 1em">${rows.join("")}</ul>`);
      await pushWarLog(A, `Recon Sweep at ${hexName(doc)}: ${hidden ? `revealed ${hexName(hidden)}` : "no fogged neighbour"}; ${ring.length} neighbour alignment(s) reported.`);
    },
    // Border Patrol — next turn, Intrigue-type raids against this faction's hexes are refused (turn-driver consumer).
    async border_patrol(ctx){
      const A = game.actors.get(ctx.factionId);
      await setNextTurnFlag(A, { borderPatrol: 2 });   // ticks down at the end of each Advance: covers the NEXT turn's raids
      await pushWarLog(A,"Border Patrol: infiltration (Intrigue raids) against your hexes is refused next turn.");
    },
    async local_festival(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await bumpFactionMeter(A,"morale",+1);
      await pushWarLog(A,`Local Festival: Morale (Empathy) ${r.before} → ${r.after}.`);
    },
    async training_parade(ctx){
      const A = game.actors.get(ctx.factionId);
      const cur = Number(A?.getFlag(MODF,"bonuses")?.nextTurn?.moraleBonus || 0);
      await setNextTurnFlag(A, { moraleBonus: cur + 1 });
      await pushWarLog(A,"Training Parade: +1 Morale next raid.");
    },
    async pilgrimage_route(ctx){
      const A = game.actors.get(ctx.factionId);
      await scheduleFactionOP(A, { faith: 10 }, 1);
      if (ctx.targetUuid) await adjustHexTrack(ctx.targetUuid,"loyalty",+1);
      await pushWarLog(A,"Pilgrimage Route: +10 marks Faith next turn; +1 Loyalty to target hex.");
    },

    // ═══════════════════════════ T2 ═══════════════════════════
    // Mass Mobilization (T4 canon): +25% OP income this turn, −25% the turn after.
    async mass_mobilization(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      await addRegenPlan(A, [{ inTurns: 1, mult: 1.25, label: "Mass Mobilization" }, { inTurns: 2, mult: 0.75, label: "Mass Mobilization (exhaustion)" }]);
      await pushWarLog(A, "Mass Mobilization: OP income ×1.25 this turn, ×0.75 next turn.");
    },
    // Mass Mobilization (std): next raid gets initiative advantage + one free maneuver (raid-roundflags reads bonuses.nextTurn).
    async mass_mobilization_std(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      await setNextTurnFlag(A, { initiativeAdv: true, freeManeuver: true });
      await pushWarLog(A, "Mass Mobilization: next raid — initiative advantage + one free maneuver.");
    },
    async propaganda_tour(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) { await pushWarLog(A, "Propaganda: No target hex."); return; }
      await enqueuePendingRepairs(ctx.targetUuid, ["Propaganda"], []);
      await adjustHexTrack(ctx.targetUuid, "morale", +2);
      await adjustHexTrack(ctx.targetUuid, "loyalty", +1);
      await pushWarLog(A, 'Propaganda: +Propaganda; +2 Morale, +1 Loyalty (target hex).');
    },
    async propaganda_campaign(ctx){ return this.propaganda_tour(ctx); },
    async psych_ops_broadcast(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) { await pushWarLog(A, "Psych Ops Broadcast: No target hex."); return; }
      await enqueuePendingRepairs(ctx.targetUuid, ["Propaganda"], []);
      await adjustHexTrack(ctx.targetUuid, "loyalty", -2);
      await pushWarLog(A, 'Psych Ops Broadcast: +Propaganda; −2 Loyalty (target hex).');
    },
    // Peace Accords — a 2-turn truce with the target hex's holder; raids either way are refused (turn-driver consumer).
    async peace_accords(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid); const B = doc ? await factionOfHex(doc) : null;
      if (!B || B.id === A?.id) { await pushWarLog(A, "Peace Accords: target a hex held by ANOTHER faction — no counterpart found."); return; }
      await setTruce(A, B, 2);
      await pushWarLog(A, `Peace Accords with ${B.name}: no raids either way for 2 turns.`);
      await pushWarLog(B, `Peace Accords: ${A.name} offered terms — no raids either way for 2 turns.`);
    },
    // Resource Expropriation — takes up to 20 marks Economy from the target hex's holder; Darkness +1.
    async resource_expropriation(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid); const B = doc ? await factionOfHex(doc) : null;
      if (!B || B.id === A?.id) { await pushWarLog(A, "Resource Expropriation: the target hex has no rival holder to expropriate."); return; }
      const took = await debitOP(B, "economy", 20, `Expropriated by ${A.name}`);
      if (took > 0) await creditOP(A, "economy", took, `Expropriated from ${B.name}`);
      await adjustHexTrack(ctx.targetUuid, "loyalty", -1);
      const d = await adjustFactionDarkness(A, +1);
      await pushWarLog(A, `Resource Expropriation at ${hexName(doc)}: took ${took} marks Economy from ${B.name}; hex Loyalty −1; Darkness ${d.before} → ${d.after}.`);
      await pushWarLog(B, `${A.name} expropriated ${took} marks Economy at ${hexName(doc)}.`);
    },
    // Training Drills — Violence cap +10 marks for 2 turns (turn-driver cap clamps honour bonuses.capBump).
    async training_drills(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      await addCapBump(A, "violence", 10, 2);
      await pushWarLog(A, "Training Drills: Violence cap +10 marks for 2 turns.");
    },
    // Smuggling Network — a trade route to the TO hex (planner asks for one), +10 marks Diplomacy next turn, Darkness +1.
    async smuggling_network(ctx){
      const A = game.actors.get(ctx.factionId);
      let routeMsg = "no TO hex given — no route";
      if (ctx.targetUuid && ctx.toHexUuid) { await queueRouteEdge(String(ctx.targetUuid), String(ctx.toHexUuid), "trade"); const to = await hexDoc(ctx.toHexUuid); routeMsg = `trade route → ${hexName(to)}`; }
      await scheduleFactionOP(A, { diplomacy: 10 }, 1);
      const d = await adjustFactionDarkness(A, +1);
      await pushWarLog(A, `Smuggling Network: ${routeMsg}; +10 marks Diplomacy next turn; Darkness ${d.before} → ${d.after}.`);
    },
    // Siege Logistics Overhaul — arms the one-shot 25% discount begin_siege already honours.
    async siege_logistics_overhaul(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      await A.update({ "flags.bbttcc-structures.siegeCostDiscount": { armed: true, grantedBy: "siege_logistics_overhaul", ts: Date.now() } });
      await pushWarLog(A, "Siege Logistics Overhaul: your next Begin Siege costs 25% less (one use).");
    },
    // Industrial Revolution — Economy income ×2 for 2 turns; the target hex's people grumble (Loyalty −1).
    async industrial_revolution(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      await addRegenPlan(A, [{ inTurns: 1, mult: 2, channels: ["economy"], label: "Industrial Revolution" }, { inTurns: 2, mult: 2, channels: ["economy"], label: "Industrial Revolution" }]);
      if (ctx.targetUuid) await adjustHexTrack(ctx.targetUuid, "loyalty", -1);
      await pushWarLog(A, "Industrial Revolution: Economy income ×2 for 2 turns; target hex Loyalty −1.");
    },
    // Alliance Summit — with a mutual ally (target hex's holder): both factions' OP income ×1.15 this turn.
    async alliance_summit(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid); const B = doc ? await factionOfHex(doc) : null;
      if (!B || B.id === A?.id) { await pushWarLog(A, "Alliance Summit: target a hex held by an ALLIED faction."); return; }
      if (!mutuallyAllied(A, B)) { await pushWarLog(A, `Alliance Summit: ${B.name} is not a mutual ally — no summit.`); return; }
      await addRegenPlan(A, [{ inTurns: 1, mult: 1.15, label: `Alliance Summit with ${B.name}` }]);
      await addRegenPlan(B, [{ inTurns: 1, mult: 1.15, label: `Alliance Summit with ${A.name}` }]);
      await pushWarLog(A, `Alliance Summit with ${B.name}: both factions' OP income ×1.15 this turn.`);
      await pushWarLog(B, `Alliance Summit with ${A.name}: both factions' OP income ×1.15 this turn.`);
    },
    // Crisis Summit — no faction loses Morale to Darkness this turn (advance-turn.tracks consumer).
    async crisis_summit(ctx){
      const A = game.actors.get(ctx.factionId);
      const facs = (game.actors?.contents ?? []).filter(a => a?.getFlag?.(MODF, "isFaction") === true || a?.flags?.[MODF]?.opBank);
      for (const F of facs) await setNextTurnFlag(F, { noMoraleLoss: true });
      await pushWarLog(A, `Crisis Summit: Darkness costs no faction Morale this turn (${facs.length} factions shielded).`);
    },
    // Cultural Exchange — copies the target hex's sephirot alignment onto the TO hex (if it has none).
    async cultural_exchange(ctx){
      const A = game.actors.get(ctx.factionId);
      const from = await hexDoc(ctx.targetUuid); const to = ctx.toHexUuid ? await hexDoc(ctx.toHexUuid) : null;
      const key = String(tfOf(from).sephirotKey || "").toLowerCase();
      if (!from || !to) { await pushWarLog(A, "Cultural Exchange: needs a FROM hex and a TO hex (planner asks for both)."); return; }
      if (!key) { await pushWarLog(A, `Cultural Exchange: ${hexName(from)} carries no sephirot alignment to share.`); return; }
      const align = game.bbttcc?.api?.territory?.alignHexToSephirot;
      const r = typeof align === "function" ? await align(to, key, { source: "cultural exchange", overwrite: false, byName: A?.name }) : { ok: false, error: "alignHexToSephirot missing" };
      await pushWarLog(A, r?.ok && !r.skipped ? `Cultural Exchange: ${hexName(to)} now shares ${hexName(from)}'s ${r.sephirotName || key} alignment.` : `Cultural Exchange: ${hexName(to)} — ${r?.reason || r?.error || "already aligned"}.`);
    },
    async justice_tribunal(ctx){
      const A = game.actors.get(ctx.factionId);
      const d = await adjustFactionDarkness(A,-1); const m = await bumpFactionMeter(A,"morale",+1);
      await pushWarLog(A, `Justice Tribunal: Darkness ${d.before} → ${d.after}; Morale (Empathy) ${m.before} → ${m.after}.`);
    },
    // Reconstruction Drive (T2 canon row is retired from the planner; kept for already-planned entries).
    async reconstruction_drive(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) { await pushWarLog(A, "Reconstruction Drive: No target hex."); return; }
      await enqueuePendingRepairs(ctx.targetUuid, ["Well-Maintained"], ["Damaged Infrastructure"]);
      const doc = await hexDoc(ctx.targetUuid); const st = String(tfOf(doc).status || "").toLowerCase();
      if (doc && (st === "occupied" || st === "contested")) await patchHex(doc, { [`flags.${MODT}.status`]: "claimed" });
      await pushWarLog(A, "Reconstruction Drive: −Damaged Infrastructure, +Well-Maintained; status → Claimed.");
    },
    // Spy Insertion — next Advance Turn, the target hex holder's OP pools and plans are whispered to you (turn-driver consumer).
    async spy_insertion(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid); const B = doc ? await factionOfHex(doc) : null;
      if (!B || B.id === A?.id) { await pushWarLog(A, "Spy Insertion: target a hex held by a RIVAL faction."); return; }
      await setNextTurnFlag(A, { spyInsertion: { targetFactionId: B.id, targetName: B.name, due: 2 } });   // reports at the NEXT Advance
      await pushWarLog(A, `Spy Insertion: an agent is inside ${B.name} — their OP pools and plans report next turn.`);
    },
    // Courtly Intrigue Council — immediate intel on the target hex's holder: OP bank, standing, what they have planned.
    async courtly_intrigue_council(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid); const B = doc ? await factionOfHex(doc) : null;
      if (!B || B.id === A?.id) { await pushWarLog(A, "Courtly Intrigue Council: target a hex held by ANOTHER faction."); return; }
      const bank = B.getFlag(MODF, "opBank") || {};
      const planned = (B.getFlag(MODF, "warLogs") || []).filter(e => e?.type === "planned").map(e => `${esc(e.activityKey || e.activity)} → ${esc(e.targetName || "?")}`);
      const rel = relationsApi(); let standing = "";
      try { standing = rel ? `${esc(rel.get(B, A))} toward you` : ""; } catch (_e) {}
      await whisperFaction(A, `Courtly Intrigue — ${B.name}`, `OP bank (marks): ${OP_KEYS.map(k => `${k} <b>${Number(bank[k] || 0)}</b>`).join(" · ")}<br>${standing ? `Standing: ${standing}<br>` : ""}Planned this turn: ${planned.length ? planned.join("; ") : "nothing"}`);
      await pushWarLog(A, `Courtly Intrigue Council: ${B.name}'s pools and plans are in your hands (see whisper).`);
    },
    // Gather Intel (std) — +Intel tag next turn, the hex is revealed now, and a dossier is whispered.
    async gather_intel(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc) { await pushWarLog(A, "Gather Intel: no target hex."); return; }
      await enqueuePendingRepairs(ctx.targetUuid, ["Intel"], []);
      await revealHex(doc);
      const tf = tfOf(doc); const owner = tf.faction || tf.ownerName || (hexOwnerId(doc) ? game.actors.get(hexOwnerId(doc))?.name : "") || "unclaimed";
      await whisperFaction(A, `Intel — ${hexName(doc)}`, `Held by <b>${esc(owner)}</b> · ${esc(tf.type || "?")} / ${esc(tf.size || "?")} · status ${esc(tf.status || "?")} · defense <b>${Number(tf.defense || 0)}</b> · loyalty ${Number(tf.loyalty || 0)} · morale ${Number(tf.morale || 0)} · integration ${Number(tf.integration?.progress || 0)}/6<br>Modifiers: ${(tf.modifiers || []).map(esc).join(", ") || "none"}<br>Alignment: ${esc(tf.sephirotName || tf.sephirotKey || "none")}`);
      await pushWarLog(A, `Gather Intel: ${hexName(doc)} scouted — dossier whispered; +Intel next turn.`);
    },
    // Alignment Shift (std) — +Sanctified, +Pilgrimage Site, Morale/Loyalty +1 next turn, and the faith boon is real: +10 marks Faith next turn.
    async alignment_shift(ctx){
      const A = game.actors.get(ctx.factionId);
      if (!ctx.targetUuid) { await pushWarLog(A, "Alignment Shift: no target hex."); return; }
      await enqueuePendingRepairs(ctx.targetUuid, ["Sanctified", "Pilgrimage Site"], []);
      const doc = await hexDoc(ctx.targetUuid);
      if (doc) { const f = foundry.utils.duplicate(doc.flags?.[MODT] || {}); const pend = foundry.utils.getProperty(f, "turn.pending") || {}; pend.moraleDelta = Number(pend.moraleDelta || 0) + 1; pend.loyaltyDelta = Number(pend.loyaltyDelta || 0) + 1; await patchHex(doc, { [`flags.${MODT}.turn.pending`]: pend }); }
      await scheduleFactionOP(A, { faith: 10 }, 1);
      await pushWarLog(A, "Alignment Shift: +Sanctified, +Pilgrimage Site, Morale +1, Loyalty +1 (next turn); +10 marks Faith next turn.");
    },
    // Policy Reforms (std) — OP income ×1.05 this turn (the +5% the copy always promised).
    async policy_reforms(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      await addRegenPlan(A, [{ inTurns: 1, mult: 1.05, label: "Policy Reforms" }]);
      await pushWarLog(A, "Policy Reforms: OP income ×1.05 this turn.");
    },

    // ═══════════════════════════ T3 / T4 — THE LEGENDARY BLOCK ═══════════════════════════
    // World Reformation Council — every faction's Morale (Empathy) +2 now, and its resting point (moraleHome) +2 for good.
    async world_reformation_council(ctx){
      const A = game.actors.get(ctx.factionId);
      const facs = (game.actors?.contents ?? []).filter(a => a?.getFlag?.(MODF, "isFaction") === true || a?.flags?.[MODF]?.opBank);
      for (const F of facs) { await bumpFactionMeter(F, "morale", +2); const home = Number(F.getFlag(MODF, "moraleHome") ?? 50) || 50; await F.update({ [`flags.${MODF}.moraleHome`]: Math.min(100, home + 2) }); }
      const d = await adjustFactionDarkness(A, -1);
      await pushWarLog(A, `World Reformation Council: Morale +2 and resting Morale +2 for ${facs.length} faction(s) — permanent; Darkness ${d.before} → ${d.after}.`);
    },
    // Enlightenment Congress — every steward of this faction climbs one Enlightenment level (real level Items from the pack).
    async enlightenment_congress(ctx){
      const A = game.actors.get(ctx.factionId);
      const stewards = stewardsOf(ctx.factionId);
      const out = [];
      for (const s of stewards) { try { const r = await grantNextEnlightenment(s); out.push(r.ok ? `${s.name}: ${r.from} → ${r.to}` : `${s.name}: ${r.why}`); } catch (e) { out.push(`${s.name}: ${e.message}`); } }
      await pushWarLog(A, `Enlightenment Congress: ${out.join("; ") || "no stewards on the roster"}.`);
    },
    // Oblivion Protocol — the faction's whole Darkness map (institutional + every hex key) resets to 0; stewards wash clean; a corrupted spark on the target is repaired.
    async oblivion_protocol(ctx){
      const A = game.actors.get(ctx.factionId);
      const r = await zeroFactionDarkness(A);
      const wash = game.fourththing?.darkness?.wash;
      let washed = 0;
      for (const s of stewardsOf(ctx.factionId)) { try { if (typeof wash === "function" && s.isOwner) { await wash(s, 10, "oblivion_protocol"); washed++; } } catch (_e) {} }
      let spark = "";
      if (ctx.targetUuid && game.user?.isGM) { try { const rr = await game.bbttcc?.api?.tikkun?.hex?.repair?.(ctx.targetUuid); if (rr?.ok && !rr.already) spark = `; the ${rr.key} spark at the target is repaired`; } catch (_e) {} }
      await pushWarLog(A, `Oblivion Protocol: Darkness ${r.before} → 0 (${r.hexKeys} hex key(s) cleared); ${washed} steward(s) washed to their taint${spark}.`);
    },
    // Inquisition Mandate — exposes the target hex (revealed, dossier of its spark/darkness state); Darkness −1.
    async inquisition_mandate(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (doc) {
        await revealHex(doc);
        let spark = null; try { spark = await game.bbttcc?.api?.tikkun?.hex?.at?.(ctx.targetUuid); } catch (_e) {}
        const tf = tfOf(doc);
        await whisperFaction(A, `Inquisition — ${hexName(doc)}`, `Hex darkness pips: <b>${Number(tf.mods?.darkness || 0)}</b> · conditions: ${(tf.conditions || []).map(esc).join(", ") || "none"} · modifiers: ${(tf.modifiers || []).map(esc).join(", ") || "none"}<br>Spark: ${spark?.key ? `<b>${esc(spark.key)}</b> (${esc(spark.state || "?")})` : "none seated"}`);
      }
      const d = await adjustFactionDarkness(A, -1);
      await pushWarLog(A, `Inquisition Mandate: ${doc ? `${hexName(doc)} exposed (see whisper); ` : ""}Darkness ${d.before} → ${d.after}.`);
    },
    // Dark Harvest — burns 1 Darkness for +20 marks Economy now; Morale (Empathy) −1.
    async dark_harvest(ctx){
      const A = game.actors.get(ctx.factionId);
      const raw = A?.getFlag(MODF, "darkness"); const g = (raw && typeof raw === "object") ? Number(raw.global || 0) : Number(raw || 0);
      if (g < 1) { await pushWarLog(A, "Dark Harvest: no Darkness to harvest — nothing happens."); return; }
      const d = await adjustFactionDarkness(A, -1);
      await creditOP(A, "economy", 20, "Dark Harvest");
      const m = await bumpFactionMeter(A, "morale", -1);
      await pushWarLog(A, `Dark Harvest: Darkness ${d.before} → ${d.after} burned for +20 marks Economy; Morale (Empathy) ${m.before} → ${m.after}.`);
    },
    // Great Work Ritual — integrates the dormant spark seated on the target hex (Tikkun Phase C; debits the faction's Reach).
    async great_work_ritual(ctx){
      const A = game.actors.get(ctx.factionId);
      const hx = game.bbttcc?.api?.tikkun?.hex;
      if (!hx || !game.user?.isGM) { await pushWarLog(A, "Great Work Ritual: the Tikkun hex engine needs a GM seat to integrate."); return; }
      const steward = stewardsOf(ctx.factionId)[0] || null;
      let r = null; try { r = await hx.integrate(ctx.targetUuid, { actorId: steward?.id || null }); } catch (e) { r = { ok: false, error: e.message }; }
      const doc = await hexDoc(ctx.targetUuid);
      await pushWarLog(A, r?.ok ? `Great Work Ritual: the ${r.key} spark at ${hexName(doc)} is INTEGRATED${r.already ? " (already was)" : ""} — a Lamp for the Threshold.` : `Great Work Ritual at ${hexName(doc)}: ${r?.error || "no spark to integrate"}.`);
    },
    // Judgment of Light — purifies a RIVAL hex without taking it: taints and hostile tags removed, its darkness pips zeroed, Purified (cascade runs at the turn).
    async judgment_of_light(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc) { await pushWarLog(A, "Judgment of Light: no target hex."); return; }
      const m = await setHexModifiers(doc, [], CLEAN_TAGS, { activity: "judgment_of_light", factionId: ctx.factionId });
      const z = await setHexDarkness(doc, { set: 0 });
      await setCondition(ctx.targetUuid, "Purified", true);
      const B = await factionOfHex(doc); if (B) await setFactionHexDarkness(B, doc.id, 0);
      await pushWarLog(A, `Judgment of Light on ${hexName(doc)}: Purified; darkness pips ${z.before} → 0; removed ${m.removed.join(", ") || "nothing"}. It stays ${B ? B.name + "'s" : "unclaimed"}.`);
      if (B && B.id !== A?.id) await pushWarLog(B, `${A.name} cast Judgment of Light on ${hexName(doc)} — it is Purified, and still yours.`);
    },
    // Purification Rite — Darkness −2; each owned hex loses a darkness pip; stewards wash 1.
    async purification_rite(ctx){
      const A = game.actors.get(ctx.factionId);
      const d = await adjustFactionDarkness(A, -2);
      let pips = 0; for (const h of ownedHexes(ctx.factionId)) { const r = await setHexDarkness(h, { delta: -1 }); if (r.after !== r.before) pips++; }
      const wash = game.fourththing?.darkness?.wash; let washed = 0;
      for (const s of stewardsOf(ctx.factionId)) { try { if (typeof wash === "function" && s.isOwner) { await wash(s, 1, "purification_rite"); washed++; } } catch (_e) {} }
      await pushWarLog(A, `Purification Rite: Darkness ${d.before} → ${d.after}; ${pips} hex(es) lose a darkness pip; ${washed} steward(s) washed 1.`);
    },
    // Project Eden — the target hex you hold becomes a Garden City: aligned to Tiferet, Purified, Well-Maintained + Loyal Population, darkness pips 0.
    async project_eden(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc || hexOwnerId(doc) !== String(ctx.factionId)) { await pushWarLog(A, "Project Eden: target a hex you HOLD."); return; }
      const align = game.bbttcc?.api?.territory?.alignHexToSephirot;
      const r = typeof align === "function" ? await align(doc, "tiferet", { source: "project eden", overwrite: false, byName: A?.name }) : null;
      await setHexModifiers(doc, ["Well-Maintained", "Loyal Population", "Garden City"], CLEAN_TAGS, { activity: "project_eden", factionId: ctx.factionId });
      await setHexDarkness(doc, { set: 0 });
      await setCondition(ctx.targetUuid, "Purified", true);
      await pushWarLog(A, `Project Eden: ${hexName(doc)} is a Garden City — ${r?.ok && !r.skipped ? "aligned to Tiferet" : (r?.skipped ? "keeps its alignment" : "alignment unchanged")}, Purified, +Well-Maintained, +Loyal Population.`);
    },
    // Terraforming Project — cleanses a hex you hold: taints and damage removed, darkness pips 0, Purified, a corrupted spark repaired.
    async terraforming_project(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc || hexOwnerId(doc) !== String(ctx.factionId)) { await pushWarLog(A, "Terraforming Project: target a hex you HOLD."); return; }
      const m = await setHexModifiers(doc, ["Well-Maintained"], CLEAN_TAGS, { activity: "terraforming_project", factionId: ctx.factionId });
      const z = await setHexDarkness(doc, { set: 0 });
      await setCondition(ctx.targetUuid, "Purified", true);
      let spark = ""; if (game.user?.isGM) { try { const rr = await game.bbttcc?.api?.tikkun?.hex?.repair?.(ctx.targetUuid); if (rr?.ok && !rr.already) spark = `; ${rr.key} spark repaired`; } catch (_e) {} }
      await pushWarLog(A, `Terraforming Project: ${hexName(doc)} cleansed — Purified, darkness pips ${z.before} → 0, removed ${m.removed.join(", ") || "nothing"}${spark}.`);
    },
    // Sanctum Expansion — Blessed Ground on a hex you hold: −1 Darkness every turn while it stands (advance-turn.tracks consumer); +10 marks Faith next turn.
    async sanctum_expansion(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc || hexOwnerId(doc) !== String(ctx.factionId)) { await pushWarLog(A, "Sanctum Expansion: target a hex you HOLD."); return; }
      await setHexModifiers(doc, ["Blessed Ground"], [], { activity: "sanctum_expansion", factionId: ctx.factionId });
      await scheduleFactionOP(A, { faith: 10 }, 1);
      await pushWarLog(A, `Sanctum Expansion: ${hexName(doc)} is Blessed Ground — Darkness −1 every turn it stands; +10 marks Faith next turn.`);
    },
    // The Final Weave — if the Dragon has risen and the Final Ritual is not underway, begins it with your stewards; otherwise reports what is still missing.
    async the_final_weave(ctx){
      const A = game.actors.get(ctx.factionId);
      const epic = game.fourththing?.epic;
      let gw = null; try { gw = game.bbttcc?.api?.tikkun?.getGreatWorkState?.(ctx.factionId); } catch (_e) {}
      const daath = epic?.daath?.status?.() || {};
      const rit = epic?.ritual?.status?.() || { active: false };
      const integrated = Number(gw?.integratedCount || 0);
      if (rit.active) { await pushWarLog(A, `The Final Weave: the Final Ritual is already underway (station ${rit.station || "?"}).`); return; }
      if (daath.risen && game.user?.isGM) {
        const ids = stewardsOf(ctx.factionId).map(s => s.id);
        try { await epic.ritual.begin(ids.length ? { actorIds: ids } : {}); await pushWarLog(A, `The Final Weave: the Final Ritual BEGINS — ${integrated} integrated spark(s) carried in.`); return; } catch (e) { await pushWarLog(A, `The Final Weave: the ritual would not begin — ${e.message}.`); return; }
      }
      await pushWarLog(A, `The Final Weave: not yet — Lamps ${Number(daath.lampsCount || 0)}/10${daath.opened ? ", Daath open" : ""}${daath.risen ? "" : ", the Dragon has not risen"}; ${integrated} integrated spark(s), ${(gw?.corruptedKeys || []).length} corrupted.`);
    },
    // Apocalyptic Weapon Test — the target hex is blasted: Contaminated + Radiation Zone, darkness pips +3, Morale/Loyalty −3, integration reset, contested; your Darkness +3, its holder's +1, your stewards +1.
    async apocalyptic_weapon_test(ctx){
      const A = game.actors.get(ctx.factionId);
      const doc = await hexDoc(ctx.targetUuid);
      if (!doc) { await pushWarLog(A, "Apocalyptic Weapon Test: no target hex."); return; }
      const B = await factionOfHex(doc);
      await setHexModifiers(doc, ["Contaminated", "Radiation Zone"], ["Well-Maintained", "Loyal Population", "Trade Hub", "Garden City", "Blessed Ground"], { activity: "apocalyptic_weapon_test", factionId: ctx.factionId });
      const z = await setHexDarkness(doc, { delta: +3 });
      await adjustHexTrack(ctx.targetUuid, "morale", -3);
      await adjustHexTrack(ctx.targetUuid, "loyalty", -3);
      const integ = foundry.utils.duplicate(tfOf(doc).integration || {}); integ.progress = 0;
      await patchHex(doc, { [`flags.${MODT}.integration`]: integ, [`flags.${MODT}.status`]: B ? "contested" : (tfOf(doc).status || "occupied") });
      await setCondition(ctx.targetUuid, "Purified", false);
      const d = await adjustFactionDarkness(A, +3);
      if (B && B.id !== A?.id) await adjustFactionDarkness(B, +1);
      const gain = game.fourththing?.darkness?.gain; let bit = 0;
      for (const s of stewardsOf(ctx.factionId)) { try { if (typeof gain === "function" && s.isOwner) { await gain(s, 1, "apocalyptic_weapon_test"); bit++; } } catch (_e) {} }
      await pushWarLog(A, `APOCALYPTIC WEAPON TEST on ${hexName(doc)}: Contaminated + Radiation Zone, darkness pips ${z.before} → ${z.after}, Morale/Loyalty −3, integration reset${B ? ", contested" : ""}. Your Darkness ${d.before} → ${d.after}; ${bit} steward(s) took Darkness +1.`);
      if (B && B.id !== A?.id) await pushWarLog(B, `${A.name} detonated a weapon over ${hexName(doc)} — it is Contaminated and contested. Your Darkness +1.`);
    },
    // Dragon's Parley — a 2d10 check (DC 14, +1 per lit Lamp): success = Darkness −3 and stewards wash 1; failure = Darkness +1 and the Adversary stirs.
    async dragon_s_parley(ctx){ return this.dragons_parley(ctx); },
    async dragons_parley(ctx){
      const A = game.actors.get(ctx.factionId); if (!A) return;
      const lamps = Number(game.fourththing?.epic?.daath?.status?.()?.lampsCount || 0);
      const r = await rollCheck({ dc: 14, bonus: lamps, label: "Dragon's Parley" });
      if (r.ok) {
        const d = await adjustFactionDarkness(A, -3);
        const wash = game.fourththing?.darkness?.wash; let washed = 0;
        for (const s of stewardsOf(ctx.factionId)) { try { if (typeof wash === "function" && s.isOwner) { await wash(s, 1, "dragons_parley"); washed++; } } catch (_e) {} }
        await pushWarLog(A, `Dragon's Parley: the fragment LISTENS (rolled ${r.total} vs DC 14, +${lamps} lamps) — Darkness ${d.before} → ${d.after}; ${washed} steward(s) washed 1.`);
      } else {
        const d = await adjustFactionDarkness(A, +1);
        try { await game.fourththing?.epic?.adversary?.force?.("stirring"); } catch (_e) {}
        await pushWarLog(A, `Dragon's Parley: the fragment TURNS AWAY (rolled ${r.total} vs DC 14, +${lamps} lamps) — Darkness ${d.before} → ${d.after}; the Adversary stirs.`);
      }
    }
  };

  // ----------------------------
  // Audit (supports Foundry Item JSON shape)
  // ----------------------------
  async function auditThroughputWiring(){
    let json = [];
    try {
      const mod = game.modules.get("bbttcc-raid");
      const base =
        (mod && typeof mod.url === "string" && mod.url) ? mod.url :
        (mod && typeof mod.path === "string" && mod.path) ? mod.path :
        "/modules/bbttcc-raid";

      const url = `${String(base).replace(/\/+$/,"")}/data/bbttcc_activities_v1_4.json`;
      const r = await fetch(url, { cache:"no-store" });
      if (r.ok) json = await r.json();
    } catch (e) {
      console.warn("[bbttcc-strategic] audit: failed to load activities JSON", e);
      json = [];
    }

    function deriveKeyFromName(name){
      let s = String(name || "").toLowerCase();
      s = s.replace(/\[[^\]]+\]/g, "");
      s = s.replace(/[’']/g, "");
      s = s.replace(/[^a-z0-9]+/g, "_");
      s = s.replace(/^_+|_+$/g, "");
      return s;
    }

    const keys = Object.keys(STRATEGIC_THROUGHPUT);
    const wired = [];
    const unwired = [];

    for (const it of (Array.isArray(json) ? json : [])) {
      const k =
        it?.activityKey ||
        it?.flags?.bbttcc?.activityKey ||
        it?.flags?.bbttcc?.unlockKey ||
        deriveKeyFromName(it?.name);
      if (!k) continue;
      (keys.includes(k) ? wired : unwired).push(k);
    }

    wired.sort(); unwired.sort();
    return { ts: Date.now(), total: (Array.isArray(json) ? json.length : 0), wired: wired.length, unwired: unwired.length, wiredKeys: wired, unwiredKeys: unwired };
  }

  // Global fallback (cannot be wiped by bbttcc API rebuilds)
  globalThis.__bbttcc_auditStrategicThroughput = auditThroughputWiring;

  function attach(){
    game.bbttcc = game.bbttcc || { api:{} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.turn = game.bbttcc.api.turn || {};
    game.bbttcc.api.raid = game.bbttcc.api.raid || {};

    game.bbttcc.api.raid.STRATEGIC_THROUGHPUT = STRATEGIC_THROUGHPUT;
    game.bbttcc.api.raid.auditStrategicThroughput = auditThroughputWiring;

    game.bbttcc.api.auditStrategicThroughput = auditThroughputWiring;
    game.bbttcc.api.turn.auditStrategicThroughput = auditThroughputWiring;
  }

  function boot(){
    attach();

    // Watchdog: if some other file overwrites bbttcc/api later, reattach until stable.
    let stable = 0;
    const maxStable = 8;
    const maxMs = 60_000;
    const start = Date.now();

    const t = setInterval(() => {
      try {
        const ok =
          !!(game.bbttcc && game.bbttcc.api &&
             typeof game.bbttcc.api.auditStrategicThroughput === "function" &&
             game.bbttcc.api.raid &&
             typeof game.bbttcc.api.raid.auditStrategicThroughput === "function");

        if (!ok) { stable = 0; attach(); }
        else stable++;

        if (stable >= maxStable) {
          clearInterval(t);
          console.log("[bbttcc-strategic] audit is stable; watchdog stopped.");
        }

        if ((Date.now() - start) > maxMs) {
          clearInterval(t);
          console.warn("[bbttcc-strategic] watchdog timeout; leaving global fallback __bbttcc_auditStrategicThroughput available.");
        }
      } catch (e) {
        stable = 0;
        try { attach(); } catch (_) {}
      }
    }, 1000);
  }

  Hooks.once("init", boot);
  Hooks.once("ready", boot);
  if (game.ready) boot();

})();
