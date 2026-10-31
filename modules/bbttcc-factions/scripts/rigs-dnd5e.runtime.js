/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-factions · rigs-dnd5e.runtime.js — the dnd5e RIG RUNTIME (2026-10-08)
 * ─────────────────────────────────────────────────────────────────────────────
 * Port of the June-2026 build's rigs-runtime.js (RIG_SPRINT_PLAN.md) onto the
 * system-agnostic accessor `game.bbttcc.rigs` (bbttcc-core/scripts/rigs.js).
 * On fourththing the SYSTEM owns every piece of rig machinery, so this file is
 * DORMANT there. On dnd5e a rig is a native `vehicle` Actor carrying the June
 * flag layer `flags["bbttcc-factions"].rig` — the accessor reads/writes that
 * storage; this file never touches the raw flag path except where it must
 * (delete-key semantics → unsetFlag; Foundry 14 killed "-=key").
 *
 *   REGISTERS   game.bbttcc.rigs.impl = { board, disembark, park, deploy, destroy,
 *               restore, outputFor, applyTurnOutput, setState, applyFrame,
 *               applyTemplate, ORDERS, CHANNELS }  (+ helpers: ensure, rigOf,
 *               healCrew, baseActor, frameOf, runOrder, migrateLegacyRigs)
 *               The accessor's board/disembark/park/deploy/destroy/restore/
 *               outputFor/applyTurnOutput delegate here. game.bbttcc.rigs itself
 *               is NEVER overwritten.
 *
 *   STATE MACHINE  stationary: parked→destroyed
 *                  mobile/hybrid: parked ⇄ deployed → destroyed
 *                  (restore() = explicit GM mercy; not a normal transition)
 *
 *   OUTPUT  each BBTTCC strategic turn (`bbttcc:advanceTurn:end`, the GM seat that ran it
 *           AND apply:true — dry runs never credit), every faction-owned rig
 *           credits its faction's OP bank through game.bbttcc.api.op.commit:
 *             parked ×1.0 · deployed ×0.5 (halved, never floored — the
 *             chokepoint rounds once in MARKS; output-modules with
 *             mobileLegal:false → 0 while deployed) · destroyed ×0
 *           Rig output + orders are AUTHORED IN OP; the bank is MARKS, so the
 *           single write chokepoint converts with op.marksPerOp().
 *           ONE CLOCK: never the native bastion turn.
 *
 *   ORDERS  any PARKED rig runs one order per strategic turn (craft/trade/
 *           harvest/recruit/research → +1 OP on the channel, +1 per equipped
 *           module declaring the order; repair → +10% max HP). 0 HP or
 *           destroyed = "disabled by attack" → skipped.
 *
 *   HOOKS   bbttcc:rig:damaged   { rig, amount, newIntegrity, before, after }
 *           bbttcc:rig:destroyed { rig, finalHit, before, after }
 *           fired from updateActor (the updating client only) when a rig
 *           vehicle's hp.value drops / reaches 0 — the RFI payload shape, so
 *           module listeners (onboarding beats, raid verbs) work on both systems.
 *
 *   HUD     steward tokens: 🛻 Board (≤10 ft of a rig token) / 🪂 Disembark;
 *           rig tokens: 🛻 Deploy / 🅿️ Park / 🎛 Rig actions.
 *
 *   GEAR    accessor gearOf(item)/isFrame(item) — honours flags.fourththing.rigGear,
 *           flags.bbttcc.rigGear (June) and flags.bbttcc-factions.rigGear.
 *
 *   MIGRATION  legacy flags.bbttcc-factions.rigs[] → vehicle rigs, GM-gated,
 *           once per faction (rigsMigrated stamp), legacy array kept as audit.
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const TAG = "[bbttcc-factions/rigs-dnd5e]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;   // DORMANT off-dnd5e

  const SCOPE = "bbttcc-factions";
  const FALLBACK_CHANNELS = ["violence", "nonlethal", "intrigue", "economy", "softpower", "diplomacy", "logistics", "culture", "faith"];
  const CHANNELS = FALLBACK_CHANNELS.slice();   // re-synced to op.KEYS at ready
  const get = (o, p, d) => { try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; } };
  const R = () => game.bbttcc?.rigs;
  const OP = () => game.bbttcc?.api?.op;
  const ICONS = { parked: "🅿️", deployed: "🛻", destroyed: "💥" };
  const ROLES = ["pilot", "gunner", "engineer", "crew"];

  // ── Read helpers (all through the accessor) ────────────────────────────────
  const data = (actor) => R()?.data?.(actor) ?? null;          // normalised view or null
  const isRig = (actor) => !!R()?.isRig?.(actor);
  const list = () => R()?.list?.() ?? [];
  const gearOf = (item) => R()?.gearOf?.(item) ?? null;
  const hpOf = (actor) => ({ value: Number(get(actor, "system.attributes.hp.value", 0)) || 0, max: Number(get(actor, "system.attributes.hp.max", 0)) || 0 });

  // 🪤 UNLINKED-TOKEN TRAP: token.actor on an unlinked token is a synthetic
  // delta — flags written there never reach the base actor. ALL rig/crew
  // operations normalise to the BASE actor; the clicked token rides along.
  function baseActor(actor) {
    if (!actor) return actor;
    return actor.isToken ? (game.actors?.get?.(actor.id) ?? actor) : actor;
  }

  // ── ensure(actor, seed) — idempotent "make this vehicle a rig" ─────────────
  // Accepts a June-flat seed ({mobility, state, factionOwnerId, archetype,
  // tier, bracket, output, travel, legacyRigId}) OR a normalised one
  // ({identity:{…}, integrity:{…}, …}); both land in the same storage.
  const DEFAULTS = {
    identity: { mobility: "mobile", state: "parked", factionOwnerId: "", archetype: "war-rig", binding: { hexId: null, sceneId: null, tokenId: null } },
    integrity: { tier: 1, bracket: "light" },
    output: { basePerTurn: {} },
    travel: { speed: 1, range: 3, hazardResist: 0 },
    order: "none",
  };
  function normaliseSeed(seed = {}) {
    const s = foundry.utils.deepClone(seed || {});
    const out = {};
    const mv = (from, to) => { if (s[from] !== undefined) { foundry.utils.setProperty(out, to, s[from]); delete s[from]; } };
    mv("mobility", "identity.mobility"); mv("state", "identity.state"); mv("factionOwnerId", "identity.factionOwnerId");
    mv("archetype", "identity.archetype"); mv("binding", "identity.binding");
    mv("tier", "integrity.tier"); mv("bracket", "integrity.bracket");
    return foundry.utils.mergeObject(out, s, { inplace: false });   // identity/integrity/output/travel/order/legacyRigId pass through
  }
  async function ensure(actor, seed = {}) {
    actor = baseActor(actor);
    if (actor?.type !== "vehicle") throw new Error(`${TAG} ensure: ${actor?.name} is not a vehicle actor`);
    const Rg = R();
    if (!Rg?.toUpdate) throw new Error(`${TAG} ensure: game.bbttcc.rigs accessor not installed (bbttcc-core)`);
    const cur = data(actor);
    const current = cur ? {
      identity: { mobility: cur.identity.mobility, state: cur.identity.state, factionOwnerId: cur.identity.factionOwnerId, archetype: cur.identity.archetype, binding: cur.identity.binding },
      integrity: { tier: cur.integrity.tier, bracket: cur.integrity.bracket },
      output: { basePerTurn: cur.output.basePerTurn }, travel: cur.travel, order: cur.order,
    } : {};
    const next = foundry.utils.mergeObject(
      foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULTS), current, { inplace: false }),
      normaliseSeed(seed), { inplace: false });
    if (next.identity.mobility === "stationary" && next.identity.state === "deployed") next.identity.state = "parked";
    const upd = Rg.toUpdate(actor, next);
    // DT sanity: seat a damage threshold by bracket if the hull has none —
    // chip damage should bounce off a war rig. Never clobbers an authored dt.
    const dt = Number(get(actor, "system.attributes.hp.dt", 0)) || 0;
    if (dt) delete upd["system.attributes.hp.dt"];
    else if (!upd["system.attributes.hp.dt"]) { const want = (Rg.DT_BY_BRACKET ?? {})[next.integrity.bracket] ?? 0; if (want) upd["system.attributes.hp.dt"] = want; }
    // HP sanity: dnd5e vehicles spawn with a 0/0 pool, so damage on an
    // unauthored hull just evaporates. Seat a bracket-scaled pool, never-clobber.
    const { max } = hpOf(actor);
    const wantHp = (Rg.HP_BY_BRACKET ?? {})[next.integrity.bracket] ?? 0;
    if (!max && wantHp) { upd["system.attributes.hp.max"] = wantHp; upd["system.attributes.hp.value"] = wantHp; }
    await actor.update(upd);
    return data(actor);
  }

  // ── State machine ──────────────────────────────────────────────────────────
  async function setState(actor, state, binding = {}) {
    actor = baseActor(actor);
    const d = data(actor);
    if (!d) throw new Error(`${TAG} ${actor?.name} is not a rig (call ensure() first)`);
    const cur = d.identity;
    if (cur.state === "destroyed" && state !== "parked") throw new Error(`${TAG} ${actor.name} is destroyed — use restore() (explicit GM mercy)`);
    if (state === "deployed" && cur.mobility === "stationary") throw new Error(`${TAG} ${actor.name} is stationary infrastructure — it cannot deploy`);
    const nextBinding = {
      hexId: state === "parked" ? (binding.hexId ?? cur.binding?.hexId ?? null) : null,
      sceneId: state === "deployed" ? (binding.sceneId ?? canvas?.scene?.id ?? null) : null,
      tokenId: state === "deployed" ? (binding.tokenId ?? null) : null,
    };
    await R().update(actor, { "identity.state": state, "identity.binding": nextBinding });
    await chatNote(actor, `${ICONS[state] ?? ""} ${foundry.utils.escapeHTML(actor.name)} → ${state}`,
      state === "deployed" ? [`Deployed${nextBinding.sceneId ? ` on scene ${game.scenes?.get(nextBinding.sceneId)?.name ?? nextBinding.sceneId}` : ""}. Output halves while deployed.`]
      : state === "parked" ? [`Parked${nextBinding.hexId ? ` at hex ${nextBinding.hexId}` : ""}. Full output resumes next strategic turn.`]
      : ["Destroyed. Output ceases until restored."]);
    return data(actor);
  }
  const park = (actor, { hexId = null } = {}) => setState(actor, "parked", { hexId });
  const deploy = (actor, { sceneId = null, tokenId = null } = {}) => setState(actor, "deployed", { sceneId, tokenId });
  const destroy = (actor) => setState(actor, "destroyed");
  async function restore(actor, { hexId = null } = {}) {
    actor = baseActor(actor);
    if (!data(actor)) throw new Error(`${TAG} ${actor?.name} is not a rig`);
    await R().update(actor, { "identity.state": "parked", "identity.binding": { hexId, sceneId: null, tokenId: null } });
    await chatNote(actor, `🔧 ${foundry.utils.escapeHTML(actor.name)} restored`, ["Back to parked (GM restoration)."]);
    return data(actor);
  }

  // ── Output math — { channel: OP } for ONE strategic turn, by state ─────────
  function outputFor(actor) {
    const d = data(actor);
    if (!d) return {};
    const state = d.identity.state ?? "parked";
    if (state === "destroyed") return {};
    const deployed = state === "deployed";
    const acc = {};
    const add = (channel, n, mobileLegal = true) => {
      let v = Number(n) || 0;
      if (v <= 0) return;
      // review P3 (2026-10-28): no OP floor — a 1-OP channel pays half its marks while deployed; creditFaction rounds in marks.
      if (deployed) v = mobileLegal ? v * 0.5 : 0;
      if (v <= 0) return;
      if (!CHANNELS.includes(channel)) console.warn(TAG, `${actor.name}: unknown OP channel "${channel}" (credited anyway)`);
      acc[channel] = (acc[channel] ?? 0) + v;
    };
    for (const [ch, n] of Object.entries(d.output?.basePerTurn ?? {})) add(ch, n, true);
    for (const item of actor.items ?? []) {
      const gear = gearOf(item);
      if (gear?.subtype !== "output-module") continue;
      if (item.system?.equipped === false) continue;
      for (const [ch, n] of Object.entries(gear.perTurn ?? {})) add(ch, n, gear.mobileLegal !== false);
    }
    return acc;
  }

  // The single bank-write chokepoint. `deltasOp` = { channel: OP } (authoring
  // unit); the bank stores MARKS → converted here with the live op engine.
  async function creditFaction(faction, deltasOp, context = {}) {
    if (!faction) return null;
    const op = OP();
    const perOp = Number(op?.marksPerOp?.() ?? op?.OP_TO_MARKS) || 0;   // the live engine is the only ratio authority (marks-everywhere)
    if (!perOp) { console.warn("[rigs-dnd5e] marks ratio unavailable — credit skipped", deltasOp); return null; }
    const marks = {};
    for (const [ch, n] of Object.entries(deltasOp ?? {})) { const m = Math.round((Number(n) || 0) * perOp); if (m) marks[ch] = m; }
    if (!Object.keys(marks).length) return null;
    if (typeof op?.commit === "function") {
      const res = await op.commit(faction.id, marks, { source: "rig", ...context });
      if (!res?.ok) console.warn(TAG, `OP commit refused for ${faction.name}`, res?.error ?? res);
      return res;
    }
    // Stale client without the op engine: write the bank directly (marks).
    const bank = foundry.utils.deepClone(faction.getFlag(SCOPE, "opBank") || {});
    for (const [ch, m] of Object.entries(marks)) bank[ch] = (Number(bank[ch]) || 0) + m;
    await faction.update({ [`flags.${SCOPE}.opBank`]: bank }, { diff: true, recursive: true });
    return { ok: true, committed: true, after: bank };
  }

  // ── Orders (the Bastion steal, executed on OUR clock) ──────────────────────
  const ORDERS = {
    none:     { label: "— (no order)" },
    craft:    { label: "Craft",    channel: "economy",   desc: "+10 Economy marks (forges and workshops run)" },
    trade:    { label: "Trade",    channel: "softpower", desc: "+10 Soft Power marks (markets and favors)" },
    harvest:  { label: "Harvest",  channel: "logistics", desc: "+10 Logistics marks (fields, scrap, water)" },
    recruit:  { label: "Recruit",  channel: "violence",  desc: "+10 Violence marks (muster fodder, drill yards)" },
    research: { label: "Research", channel: "intrigue",  desc: "+10 Intrigue marks (archives, labs, listening posts)" },
    repair:   { label: "Repair",   channel: null,        desc: "Restore 10% of the rig's max HP (no OP)" },
  };
  // Resolves the rig's order; returns { key, note, deltas? } — OP deltas are
  // handed back so applyTurnOutput commits output + order in ONE bank write.
  async function runOrder(rig) {
    const d = data(rig);
    const key = d?.order ?? "none";
    const spec = ORDERS[key];
    if (!spec || key === "none") return null;
    if (d.identity.state !== "parked") return { key, note: "skipped (not parked)" };
    const { value: hp, max } = hpOf(rig);
    if (hp <= 0) return { key, note: "skipped (disabled by damage)" };
    if (key === "repair") {
      const heal = Math.max(1, Math.floor(max * 0.1));
      await R().update(rig, { "integrity.value": Math.min(max, hp + heal) });
      return { key, note: `hull +${heal}` };
    }
    let amount = 1;   // each equipped module declaring this order adds +1
    for (const item of rig.items ?? []) {
      const gear = gearOf(item);
      if (gear?.subtype === "output-module" && gear.order === key && item.system?.equipped !== false) amount += 1;
    }
    return { key, note: `+${amount} ${spec.channel}`, deltas: { [spec.channel]: amount } };
  }

  // The strategic-turn pass: credit every faction-owned rig's output + order.
  async function applyTurnOutput({ quiet = false } = {}) {
    const report = [];
    for (const rig of list()) {
      const d = data(rig);
      const fid = String(d?.identity?.factionOwnerId ?? "").replace(/^Actor\./, "");
      const faction = fid ? game.actors?.get?.(fid) ?? null : null;
      const out = outputFor(rig);
      const order = await runOrder(rig).catch(e => { console.warn(TAG, "order failed", rig.name, e); return null; });
      const entry = { rig: rig.name, state: d?.identity?.state, faction: faction?.name ?? null, out, order, credited: null };
      report.push(entry);
      if (!faction) { if (order?.deltas) order.note += " — no faction linked"; continue; }
      const deltas = foundry.utils.deepClone(out);
      for (const [ch, n] of Object.entries(order?.deltas ?? {})) deltas[ch] = (deltas[ch] ?? 0) + n;
      if (!Object.keys(deltas).length) continue;
      const res = await creditFaction(faction, deltas, { rigId: rig.id, rigName: rig.name, order: order?.key ?? null });
      entry.credited = res?.ok !== false;
      if (res && res.ok === false) entry.refused = res.error ?? "refused (cap?)";
    }
    if (!quiet && report.some(r => Object.keys(r.out).length || r.order)) {
      const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));
      // review P3 (2026-10-28): halved output can be fractional OP — show the card in marks (the bank unit).
      const perOp = Number(OP()?.marksPerOp?.() ?? OP()?.OP_TO_MARKS) || 0;
      const fmt = (n) => perOp ? `${Math.round(n * perOp)} marks` : `${n}`;
      const rows = report.filter(r => r.faction || r.order).map(r =>
        `<tr><td>${ICONS[r.state] ?? ""} ${esc(r.rig)}</td><td>${esc(r.state)}</td><td>${esc(r.faction ?? "—")}</td>
         <td>${Object.entries(r.out).map(([c, n]) => `+${fmt(n)} ${c}`).join(", ") || "—"}${r.order ? ` · 📋 ${r.order.key}: ${r.order.note}` : ""}${r.refused ? ` · ⚠ ${esc(r.refused)}` : ""}</td></tr>`).join("");
      try {
        await ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
          content: `<div class="bbttcc-class-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
            <p style="margin:.1rem 0;font-weight:700">🛻 Rig output — strategic turn</p>
            <table style="font-size:.78rem;width:100%"><tr><th style="text-align:left">Rig</th><th style="text-align:left">State</th><th style="text-align:left">Faction</th><th style="text-align:left">Output</th></tr>${rows}</table>
          </div>`
        });
      } catch (e) { console.warn(TAG, "summary card failed", e); }
    }
    return report;
  }

  // ── Frames — the equipped rig-frame item is load-bearing ───────────────────
  // June shape: { item, ...gear } (the accessor's frameOf returns the Item).
  function frameOf(rig) {
    for (const item of rig?.items ?? []) {
      const gear = gearOf(item);
      if ((R()?.isFrame?.(item) || gear?.subtype === "rig-frame") && item.system?.equipped !== false) return { item, ...(gear ?? {}) };
    }
    return null;
  }
  async function applyFrame(rig, frameItem) {
    rig = baseActor(rig);
    const f = gearOf(frameItem);
    if (!f || f.subtype !== "rig-frame") return;
    const d = data(rig);
    if (!d) return;     // only rigs consume frames
    const tier = Number(d.integrity.tier) || 1;
    const patch = {};
    if (f.baseIntegrity) {
      const max = Number(f.baseIntegrity) + (tier - 1) * (Number(f.tierStep) || 0);
      patch["integrity.max"] = max;
      // a rig sitting at its old full value (a fresh mint seeded by bracket) rides up to the new max
      const hp = hpOf(rig); const atFull = !hp.max || (hp.value ?? 0) >= hp.max;
      // review P2 (2026-10-28): a wreck (0 HP) stays at 0 — `hp.value || max` used to fully repair it on re-equip.
      patch["integrity.value"] = atFull ? max : Math.min(hp.value, max);
    }
    if (f.bracket) patch["integrity.bracket"] = f.bracket;          // accessor seats dt by bracket
    if (Array.isArray(f.mobilityAllowed) && f.mobilityAllowed.length && !f.mobilityAllowed.includes(d.identity.mobility)) patch["identity.mobility"] = f.mobilityAllowed[0];
    if (f.travel) patch["travel"] = f.travel;
    // Cached frame summary (capacity gates, action narrowing, slot counts) —
    // the item is the source; this is a copy.
    patch["frame"] = { name: frameItem.name, itemId: frameItem.id, slots: f.slots ?? {}, capacity: f.capacity ?? {}, actions: f.actions ?? null, bracket: f.bracket ?? d.integrity.bracket };
    await R().update(rig, patch);
    await chatNote(rig, `⚙ Frame equipped: ${foundry.utils.escapeHTML(frameItem.name)}`, [
      `Bracket <b>${f.bracket ?? d.integrity.bracket}</b>${f.baseIntegrity ? ` · hull ${f.baseIntegrity}+${f.tierStep ?? 0}/tier` : ""}.`,
      f.capacity ? `Crew capacity: ${Object.entries(f.capacity).map(([r, c]) => `${r} ${c.min ?? 0}–${c.max ?? 0}`).join(" · ")}.` : ""].filter(Boolean));
  }
  function installFrameHooks() {
    Hooks.on("createItem", (item, _opts, userId) => {
      try {
        if (userId !== game.user?.id) return;
        const rig = baseActor(item?.parent);
        const gear = gearOf(item);
        // review P3 (2026-10-28): a template bootstraps a plain vehicle (applyTemplate → ensure), so dispatch it before the rig check.
        if (gear?.subtype === "rig-template" && rig?.type === "vehicle") { applyTemplate(rig, item); return; }
        if (!rig || !data(rig)) return;
        if (gear?.subtype === "rig-frame") applyFrame(rig, item);
      } catch (e) { console.warn(TAG, "createItem hook failed", e); }
    });
    Hooks.on("deleteItem", (item, _opts, userId) => {
      try {
        if (userId !== game.user?.id) return;
        const rig = baseActor(item?.parent);
        if (!rig || !data(rig)) return;
        if (data(rig)?.frame?.itemId === item.id) rig.unsetFlag(SCOPE, "rig.frame").catch(() => {});
      } catch (e) { /* best-effort */ }
    });
  }

  // ── Templates — drop a rig-template item on a vehicle: configure, import
  //    frame + gear from the items pack by name, consume itself ──
  const GEAR_PACK = "bbttcc-master-content.items";
  async function applyTemplate(rig, tplItem) {
    rig = baseActor(rig);
    const t = gearOf(tplItem);
    if (!t || t.subtype !== "rig-template") return;
    await ensure(rig, t.rig ?? {});
    const pack = game.packs?.get?.(GEAR_PACK);
    const wanted = [t.frame, ...(t.gear ?? [])].filter(Boolean);
    const imported = [];
    if (pack && wanted.length) {
      const index = await pack.getIndex();
      for (const name of wanted) {
        const hit = index.find(e => e.name === name);
        if (!hit) { console.warn(TAG, `template ${tplItem.name}: "${name}" not in ${GEAR_PACK}`); continue; }
        const doc = await pack.getDocument(hit._id);
        await rig.createEmbeddedDocuments("Item", [doc.toObject()]);   // createItem hook applies a frame when it lands
        imported.push(name);
      }
    }
    await tplItem.delete().catch(() => {});
    await chatNote(rig, `📦 Template applied: ${foundry.utils.escapeHTML(tplItem.name)}`, [
      imported.length ? `Installed: ${imported.join(" · ")}.` : "No gear imported (pack missing? install gear by hand).",
      "The template item consumed itself."]);
  }

  // ── Boarding — stewards spend their OWN action economy on rig roles ────────
  // Roster = crew.slots (an array: updates replace it wholesale, so a removed
  // row never lingers). Steward side = flags.bbttcc-factions.boardedRig
  // {rigId, tokenId, sceneId} (what the accessor's boardedRigOf reads).
  const setSlots = (rig, slots) => R().update(rig, { "crew.slots": slots });
  function rigOf(steward) {
    const b = R()?.boardedRigOf?.(baseActor(steward));
    return b?.rigId ? game.actors?.get?.(b.rigId) ?? null : null;
  }
  // Self-heal: drop roster rows whose steward's own flag no longer points at
  // this rig. Label-only rows (no actorId — GM hand-authored) are kept.
  async function healCrew(rig) {
    rig = baseActor(rig);
    const d = data(rig);
    if (!d) return [];
    const slots = d.crew?.slots ?? [];
    const ok = slots.filter(s => !s.actorId || R()?.boardedRigOf?.(game.actors?.get?.(s.actorId))?.rigId === rig.id);
    if (ok.length !== slots.length && rig.canUserModify?.(game.user, "update")) {
      await setSlots(rig, ok);
      console.log(TAG, `healCrew: swept ${slots.length - ok.length} stale row(s) off ${rig.name}`);
    }
    return ok;
  }
  function tokenOf(actor) {
    return actor?.getActiveTokens?.(true)?.[0]?.object ?? actor?.getActiveTokens?.()?.[0] ?? null;
  }
  // ── board / disembark / crew-follow (2026-10-31, Dave mid-shoot: "the boarding and unboarding and token to rig
  // adhesion during movement isn't working properly") — a port of the RFI system's rig boarding (fourththing
  // module.js ftBoardRig / ftDisembarkRig / the updateToken crew-snap hook / _ftSyncBoardSelection). Before this the
  // dnd5e port only hid the steward's token on the current scene: nothing moved it with the rig, nothing handed the
  // player the rig's wheel, and disembark put the steward back off-grid. Now:
  //   board      every steward token on EVERY scene is hidden and displaced into the rig token on that scene, its
  //              sight swapped for the rig's (prior sight kept on the token for disembark), the rig token's own
  //              sight switched on, and whoever boarded (or owns the steward) gets the rig token selected.
  //   rig moves  after the rig's move animation settles, its crew tokens are displaced to its new position (RFI's
  //              dual-source resolution: the rig's crew slots AND each steward's boardedRig flag). GM seats run it;
  //              a hidden tab stops waiting on the animation (it never ticks there) and snaps straight away.
  //   disembark  tokens step out beside the rig on the grid, unhidden, with their prior sight restored; the rig
  //              token's forced vision goes back; the steward's own token is selected again.
  const FLAG_SIGHT = "boardSightOverride", FLAG_RIGVIS = "boardVisionOverride";
  const _tokDocsOf = (scene, actorId) => scene.tokens.filter(t => t.actorId === actorId);
  function _selectAfter({ stewardId, rigId, mode, initiatorUserId }) {
    try {
      if (!canvas?.ready) return;
      const steward = game.actors.get(stewardId);
      const mine = (initiatorUserId && game.user.id === initiatorUserId) || (!game.user.isGM && !!steward?.isOwner);
      if (!mine) return;
      const toks = id => canvas.tokens.placeables.filter(t => t.actor?.id === id);
      const canDrive = t => !!t && (game.user.isGM || !!t.actor?.isOwner);
      if (mode === "board") {
        const rt = toks(rigId).find(canDrive);
        if (!rt) { if (toks(rigId).length) ui.notifications?.info?.("Aboard as crew — whoever owns the rig drives."); return; }
        for (const t of toks(stewardId)) t.release();
        rt.control({ releaseOthers: true });
        ui.notifications?.info?.(`You have the controls — move ${rt.actor?.name ?? "the rig"}, not ${steward?.name ?? "your character"}.`);
      } else {
        const st = toks(stewardId).find(canDrive);
        if (st) { for (const t of toks(rigId)) t.release(); st.control({ releaseOthers: true }); }
      }
    } catch (e) { console.warn(TAG, "selection sync failed", e); }
  }
  const SOCKET = "module.bbttcc-factions";
  function _broadcastSelect(payload) {
    _selectAfter(payload);
    try { game.socket.emit(SOCKET, { t: "rig-select", ...payload }); } catch (_e) {}
  }
  // board(steward, rig, "gunner", { token })  — June signature
  // board(steward, rig, { role, token })      — accessor signature
  async function board(steward, rig, roleOrOpts = "crew", opts = {}) {
    let role = "crew";
    if (typeof roleOrOpts === "string") role = roleOrOpts;
    else if (roleOrOpts && typeof roleOrOpts === "object") { opts = roleOrOpts; role = opts.role ?? "crew"; }
    const token = opts?.token ?? null;
    steward = baseActor(steward);
    rig = baseActor(rig);
    const d = data(rig);
    if (!d) throw new Error(`${rig?.name} is not a rig`);
    if (d.identity.state === "destroyed") throw new Error(`${rig.name} is destroyed — nothing to board`);
    if (!ROLES.includes(role)) role = "crew";
    if (rigOf(steward)) throw new Error(`${steward.name} is already aboard a rig`);
    if ((d.crew?.slots ?? []).some(s => s.actorId === steward.id)) throw new Error(`${steward.name} is already in ${rig.name}'s roster`);
    // A player's board relays to the GM (token hides + rig vision need GM rights on tokens they don't own)
    if (!game.user.isGM) {
      const gx = game.bbttcc?.api?.gmExec;
      if (typeof gx?.call !== "function" || !game.users.some(u => u.isGM && u.active)) throw new Error("No GM is online to confirm boarding.");
      const r = await gx.call("rigs.board", { stewardId: steward.id, rigId: rig.id, role, initiatorUserId: game.user.id });
      if (r?.error) throw new Error(r.error);
      return true;
    }
    const cap = d.frame?.capacity?.[role];
    if (cap && Number.isFinite(Number(cap.max))) {
      const inRole = (d.crew?.slots ?? []).filter(s => s.role === role).length;
      if (inRole >= Number(cap.max)) throw new Error(`${rig.name}: all ${role} stations are taken (${inRole}/${cap.max} — ${d.frame.name})`);
    }
    const slots = foundry.utils.deepClone(d.crew?.slots ?? []);
    slots.push({ role, actorId: steward.id, label: steward.name });
    await setSlots(rig, slots);
    const tok = token?.document ?? token ?? tokenOf(steward)?.document ?? null;
    await steward.setFlag(SCOPE, "boardedRig", { rigId: rig.id, role, tokenId: tok?.id ?? null, sceneId: tok?.parent?.id ?? null });
    // every scene: the steward's tokens step into the rig
    for (const scene of game.scenes) {
      const sts = _tokDocsOf(scene, steward.id); if (!sts.length) continue;
      const rt = _tokDocsOf(scene, rig.id)[0] ?? null;
      const rigSight = rt?.sight?.toObject?.() ?? null;
      const updates = [];
      if (rt && rt.sight?.enabled === false) updates.push({ _id: rt.id, "sight.enabled": true, [`flags.${SCOPE}.${FLAG_RIGVIS}`]: true });
      for (const t of sts) {
        const u = { _id: t.id, hidden: true, action: "displace" };
        if (rt) { u.x = rt.x; u.y = rt.y; if (rt.elevation != null) u.elevation = rt.elevation; }
        if (rigSight) { u.sight = { ...foundry.utils.deepClone(rigSight), enabled: true }; u[`flags.${SCOPE}.${FLAG_SIGHT}`] = { priorSight: t.sight?.toObject?.() ?? null, rigId: rig.id }; }
        updates.push(u);
      }
      try { await scene.updateEmbeddedDocuments("Token", updates, { animate: false }); }
      catch (e) { console.warn(TAG, "board: token sync failed on", scene.name, e); }
    }
    await chatNote(rig, `🛻 ${foundry.utils.escapeHTML(steward.name)} boards ${foundry.utils.escapeHTML(rig.name)}`, [`Role: <b>${role}</b>. They spend their own action economy on rig actions.`]);
    _broadcastSelect({ stewardId: steward.id, rigId: rig.id, mode: "board", initiatorUserId: opts.initiatorUserId ?? game.user.id });
    return true;
  }
  async function disembark(steward, opts = {}) {
    steward = baseActor(steward);
    const rig = rigOf(steward);
    if (!rig) throw new Error(`${steward.name} is not aboard a rig`);
    if (!game.user.isGM) {
      const gx = game.bbttcc?.api?.gmExec;
      if (typeof gx?.call !== "function" || !game.users.some(u => u.isGM && u.active)) throw new Error("No GM is online to confirm disembarking.");
      const r = await gx.call("rigs.disembark", { stewardId: steward.id, initiatorUserId: game.user.id });
      if (r?.error) throw new Error(r.error);
      return true;
    }
    const d = data(rig);
    const slots = foundry.utils.deepClone(d?.crew?.slots ?? []);
    const idx = slots.findIndex(s => s.actorId === steward.id);
    const role = idx >= 0 ? slots[idx].role : null;
    if (idx >= 0) { slots.splice(idx, 1); await setSlots(rig, slots); }
    // every scene: step out beside the rig, on the grid, sight restored
    for (const scene of game.scenes) {
      const sts = _tokDocsOf(scene, steward.id); if (!sts.length) continue;
      const rt = _tokDocsOf(scene, rig.id)[0] ?? null;
      const g = scene.grid.size;
      const updates = [];
      sts.forEach((t, i) => {
        const u = { _id: t.id, hidden: false, action: "displace" };
        if (rt) { u.x = rt.x + (rt.width ?? 1) * g + i * g; u.y = rt.y; }
        const ov = t.getFlag(SCOPE, FLAG_SIGHT);
        if (ov) { if (ov.priorSight) u.sight = ov.priorSight; u[`flags.${SCOPE}.-=${FLAG_SIGHT}`] = null; }
        updates.push(u);
      });
      // nobody left aboard on this scene → the rig's forced vision goes back
      const stillAboard = (slots ?? []).some(s => s.actorId && _tokDocsOf(scene, s.actorId).length);
      if (rt && rt.getFlag(SCOPE, FLAG_RIGVIS) && !stillAboard) updates.push({ _id: rt.id, "sight.enabled": false, [`flags.${SCOPE}.-=${FLAG_RIGVIS}`]: null });
      try { await scene.updateEmbeddedDocuments("Token", updates, { animate: false }); }
      catch (e) { console.warn(TAG, "disembark: token restore failed on", scene.name, e); }
    }
    await steward.unsetFlag(SCOPE, "boardedRig");
    const d2 = data(rig);
    if (role === "pilot" && d2 && d2.identity.mobility !== "stationary" && d2.identity.state === "deployed"
        && !(d2.crew?.slots ?? []).some(s => s.role === "pilot")) {
      await park(rig, {});
      await chatNote(rig, `🅿️ ${foundry.utils.escapeHTML(rig.name)} auto-parks`, ["Its pilot stepped off (canon: no pilot, no motion)."]);
    }
    await chatNote(rig, `🪂 ${foundry.utils.escapeHTML(steward.name)} disembarks ${foundry.utils.escapeHTML(rig.name)}`, []);
    _broadcastSelect({ stewardId: steward.id, rigId: rig.id, mode: "disembark", initiatorUserId: opts.initiatorUserId ?? game.user.id });
    return true;
  }
  // crew-follow: the rig moved → its crew tokens jump to it once the animation settles (GM seats)
  function _strandedCrew(tokenDoc, rig, scene) {
    const ids = new Set((data(rig)?.crew?.slots ?? []).filter(s => s.actorId).map(s => s.actorId));
    const out = [];
    for (const t of scene.tokens) {
      if (t.id === tokenDoc.id) continue;
      const byFlag = t.actor?.flags?.[SCOPE]?.boardedRig?.rigId === rig.id;
      if (!ids.has(t.actorId) && !byFlag) continue;
      const there = t.x === tokenDoc.x && t.y === tokenDoc.y && (tokenDoc.elevation == null || t.elevation === tokenDoc.elevation);
      if (!there) out.push(t);
    }
    return out;
  }
  const _followPending = new Map();
  async function _awaitAnim(anim, capMs = 20000) {
    if (!anim) return;
    const hidden = () => document.visibilityState === "hidden";
    if (hidden()) { await new Promise(r => setTimeout(r, 0)); return; }
    let onVis = null, timer = null;
    const bail = new Promise(res => { onVis = () => { if (hidden()) res(); }; document.addEventListener("visibilitychange", onVis); timer = setTimeout(res, capMs); });
    try { await Promise.race([anim.then(() => {}, () => {}), bail]); }
    finally { if (onVis) document.removeEventListener("visibilitychange", onVis); if (timer) clearTimeout(timer); }
    await new Promise(r => setTimeout(r, 0));
  }
  async function _snapCrew(tokenDoc, rig, scene, attempt = 1) {
    const stranded = _strandedCrew(tokenDoc, rig, scene); if (!stranded.length) return;
    const updates = stranded.map(t => ({ _id: t.id, action: "displace", x: tokenDoc.x, y: tokenDoc.y, ...(tokenDoc.elevation != null ? { elevation: tokenDoc.elevation } : {}) }));
    try { await scene.updateEmbeddedDocuments("Token", updates, { animate: false }); } catch (e) { console.warn(TAG, "crew snap failed", e); }
    if (_strandedCrew(tokenDoc, rig, scene).length && attempt < 2) { await new Promise(r => setTimeout(r, 1200)); return _snapCrew(tokenDoc, rig, scene, attempt + 1); }
  }
  function installCrewFollow() {
    Hooks.on("updateToken", async (tokenDoc, change) => {
      try {
        if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
        if (!("x" in change) && !("y" in change) && !("elevation" in change)) return;
        const rig = baseActor(tokenDoc.actor); if (!rig || !isRig(rig)) return;
        const scene = tokenDoc.parent; if (!scene) return;
        const key = `${scene.id}:${tokenDoc.id}`;
        const pend = _followPending.get(key);
        if (pend && Date.now() - pend.since < 30000) { pend.again = true; return; }
        const st = { again: true, since: Date.now() }; _followPending.set(key, st);
        try { while (st.again) { st.again = false; await _awaitAnim(tokenDoc.object?.movementAnimationPromise); await _snapCrew(tokenDoc, rig, scene); } }
        finally { _followPending.delete(key); }
      } catch (e) { console.warn(TAG, "crew follow failed", e); }
    });
    // the GM looks again → anything stranded while the tab was hidden snaps now
    document.addEventListener("visibilitychange", async () => {
      try {
        if (document.visibilityState !== "visible" || !game.user.isGM) return;
        for (const scene of game.scenes) for (const td of scene.tokens) { const rig = baseActor(td.actor); if (rig && isRig(rig)) await _snapCrew(td, rig, scene); }
      } catch (_e) {}
    });
    game.socket.on(SOCKET, (msg) => { if (msg?.t === "rig-select") _selectAfter(msg); });
    // player seats board/disembark through the GM relay
    const gx = game.bbttcc?.api?.gmExec;
    if (typeof gx?.register === "function") {
      gx.register("rigs.board", async ({ stewardId, rigId, role, initiatorUserId }) => {
        try { await board(game.actors.get(stewardId), game.actors.get(rigId), { role, initiatorUserId }); return { ok: true }; } catch (e) { return { error: e.message }; } });
      gx.register("rigs.disembark", async ({ stewardId, initiatorUserId }) => {
        try { await disembark(game.actors.get(stewardId), { initiatorUserId }); return { ok: true }; } catch (e) { return { error: e.message }; } });
    }
  }

  // ── Token HUD (v13+ HUD is a <form> — unwrap guard) ────────────────────────
  function distFt(t1, t2) {
    const grid = canvas?.scene?.grid;
    if (!t1 || !t2 || !grid?.size || !grid?.distance) return Infinity;
    return Math.hypot(t1.center.x - t2.center.x, t1.center.y - t2.center.y) / (grid.size / grid.distance);
  }
  async function pickRole() {
    return foundry.applications.api.DialogV2.prompt({
      window: { title: "Board rig — choose a role" },
      content: ROLES.map((r, i) => `<label style="display:flex;gap:.4rem;padding:.2rem"><input type="radio" name="role" value="${r}" ${i === 3 ? "checked" : ""}/><span style="text-transform:capitalize">${r}</span></label>`).join(""),
      ok: { label: "Board", callback: (_ev, b) => b.form.elements.role?.value ?? "crew" },
      rejectClose: false,
    }).catch(() => null);
  }
  function installHud() {
    Hooks.on("renderTokenHUD", (hud, html) => {
      try {
        const root = html instanceof HTMLElement ? html : (html?.[0] ?? html);
        if (!(root instanceof HTMLElement)) return;
        const token = hud?.object;
        const actor = baseActor(token?.actor);   // flags live on the BASE
        if (!actor) return;
        const col = root.querySelector(".col.right") ?? root;
        const addBtn = (label, title, fn) => {
          const div = document.createElement("div");
          div.className = "control-icon bbttcc-rig-hud";
          div.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer";
          div.title = title; div.textContent = label;
          div.addEventListener("click", (ev) => { ev.stopPropagation(); Promise.resolve(fn()).catch(e => ui.notifications.warn(String(e?.message ?? e))); });
          col.appendChild(div);
        };
        if (actor.type === "character") {
          if (rigOf(actor)) {
            addBtn("🪂", "Disembark rig", () => disembark(actor));
          } else {
            const rigs = (canvas?.tokens?.placeables ?? []).filter(t => t.actor && isRig(baseActor(t.actor)) && distFt(token, t) <= 10);
            if (rigs.length) addBtn("🛻", `Board ${rigs[0].actor.name}`, async () => {
              const role = await pickRole();
              if (role) await board(actor, baseActor(rigs[0].actor), role, { token });
            });
          }
        } else if (isRig(actor)) {
          const d = data(actor);
          const crewN = (d.crew?.slots ?? []).length;
          if (d.identity.state === "parked" && d.identity.mobility !== "stationary") {
            addBtn("🛻", `Deploy ${actor.name} (crew: ${crewN})`, () => deploy(actor, { sceneId: canvas?.scene?.id ?? null, tokenId: token?.id ?? null }));
          } else if (d.identity.state === "deployed") {
            addBtn("🅿️", `Park ${actor.name} (crew: ${crewN})`, () => park(actor, {}));
          }
          if (crewN && d.identity.state !== "destroyed") {
            addBtn("🎛", `Rig actions (crew: ${crewN})`, () => R()?.impl?.openRigActions?.(actor));
          }
        }
      } catch (e) { console.warn(TAG, "HUD inject failed", e); }
    });
  }

  // ── Damage hooks — RFI fires these from its damage path; here they ride
  //    updateActor on the client that made the change (one fire per hit). ──
  function installDamageHooks() {
    Hooks.on("preUpdateActor", (actor, changes, options) => {
      try {
        if (!isRig(actor) || !foundry.utils.hasProperty(changes, "system.attributes.hp.value")) return;
        foundry.utils.setProperty(options, "bbttccRigHp.before", hpOf(actor).value);
      } catch (e) { /* best-effort */ }
    });
    Hooks.on("updateActor", (actor, changes, options, userId) => {
      try {
        if (userId !== game.user?.id) return;
        if (!isRig(actor) || !foundry.utils.hasProperty(changes, "system.attributes.hp.value")) return;
        const before = Number(options?.bbttccRigHp?.before);
        const after = hpOf(actor).value;
        if (!Number.isFinite(before) || after >= before) return;
        const amount = before - after;
        Hooks.callAll("bbttcc:rig:damaged", { rig: actor, amount, newIntegrity: after, before, after });
        if (after <= 0 && before > 0) Hooks.callAll("bbttcc:rig:destroyed", { rig: actor, finalHit: amount, before, after });
      } catch (e) { console.warn(TAG, "damage hook failed", e); }
    });
  }

  // ── Legacy migration — flags.bbttcc-factions.rigs[] → vehicle rigs ─────────
  // Idempotent, GM-only, once per faction (rigsMigrated stamp). The legacy
  // array stays read-only as the audit trail. damageStep → hp% / state.
  async function migrateLegacyRigs() {
    if (!game.user?.isGM || game.users?.activeGM?.id !== game.user?.id) return;
    const STEP_PCT = { 0: 1, 1: 0.75, 2: 0.5, 3: 0.25, 4: 0 };
    let made = 0;
    for (const faction of game.actors?.contents ?? []) {
      if (!faction.getFlag?.(SCOPE, "isFaction")) continue;
      if (faction.getFlag?.(SCOPE, "rigsMigrated")) continue;
      const legacy = faction.getFlag?.(SCOPE, "rigs");
      if (!Array.isArray(legacy) || !legacy.length) continue;
      for (const r of legacy) {
        const step = Math.max(0, Math.min(4, Number(r.damageStep) || 0));
        const maxHp = 100;
        const actor = await R().create({
          name: r.name || "Migrated Rig",
          identity: { mobility: "mobile", state: step >= 4 ? "destroyed" : "parked", archetype: String(r.type || "rig"), factionOwnerId: faction.id },
          integrity: { max: maxHp, value: Math.floor(maxHp * (STEP_PCT[step] ?? 1)), tier: 1, bracket: "light" },
          travel: { speed: 1, range: 3, hazardResist: 0 },
        });
        await R().update(actor, { legacyRigId: r.rigId ?? null, legacy: {
          raidBonuses: r.raidBonuses ?? {}, passiveBonuses: r.passiveBonuses ?? [],
          mobilityTags: r.mobilityTags ?? [], combat: r.combat ?? {}, damageState: r.damageState ?? null,
        } });
        made++;
      }
      await faction.setFlag(SCOPE, "rigsMigrated", true);
      console.log(TAG, `migrated ${legacy.length} legacy rig(s) for ${faction.name}`);
    }
    if (made) ui.notifications?.info?.(`Bad Eden Rigs: migrated ${made} legacy faction rig(s) to vehicle actors (legacy arrays kept as audit).`);
  }

  async function chatNote(actor, title, lines) {
    try {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div class="bbttcc-class-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
          <p style="margin:.1rem 0;font-weight:700">${title}</p>
          ${(lines || []).map(l => `<p style="margin:.1rem 0;font-size:.82rem">${l}</p>`).join("")}
        </div>`
      });
    } catch (e) { /* best-effort */ }
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    const Rg = R();
    if (!Rg?.impl) { console.warn(TAG, "game.bbttcc.rigs accessor missing (bbttcc-core not loaded?) — dnd5e rig runtime NOT installed"); return; }
    const keys = OP()?.KEYS;
    if (Array.isArray(keys) && keys.length) CHANNELS.splice(0, CHANNELS.length, ...keys);
    installCrewFollow();   // crew tokens ride the rig; player boards relay to the GM (2026-10-31)

    // Turn integration: GM seat only AND the real apply pass — `bbttcc:advanceTurn:end`
    // carries { apply } for dry runs. review P2 (2026-10-28): the hook is a LOCAL
    // Hooks.callAll on the seat that ran the turn, so no activeGM election here.
    Hooks.on("bbttcc:advanceTurn:end", async (payload = {}) => {
      try {
        if (!game.user?.isGM) return;
        if (payload?.apply === false) return;
        await new Promise(r => setTimeout(r, 0));   // let other end-of-turn writers finish
        await applyTurnOutput();
      } catch (e) { console.warn(TAG, "turn output pass failed", e); }
    });
    installHud();
    installFrameHooks();
    installDamageHooks();

    Object.assign(Rg.impl, {
      board, disembark, park, deploy, destroy, restore, outputFor, applyTurnOutput, setState, applyFrame, applyTemplate,
      ORDERS, CHANNELS,
      // helpers the sheet / actions files lean on
      ensure, rigOf, healCrew, baseActor, frameOf, runOrder, migrateLegacyRigs, creditFaction,
    });
    migrateLegacyRigs().catch(e => console.warn(TAG, "legacy migration failed", e));
    console.log(TAG, "dnd5e rig runtime registered on game.bbttcc.rigs.impl (state machine · output/orders · boarding · HUD · frames · damage hooks · migration)");
  });
})();
