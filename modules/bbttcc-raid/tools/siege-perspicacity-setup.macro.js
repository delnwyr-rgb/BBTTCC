/* ──────────────────────────────────────────────────────────────────────────
 * Siege of Perspicacity — TEST-BED SETUP  (GM, run once before declaring)
 *
 * Supersedes the older PREP + UNLOCK macros. Does everything needed to make the
 * scenario declarable from the UI:
 *   1. OP top-up — fills each faction's bank to its cap. (FIXED: opBank/opCaps are
 *      stored in MARKS, 1 OP = 10 marks; the old macros wrote OP numbers into a
 *      marks field and under-funded factions 10×. Copying the marks-caps is exact.)
 *   2. Relations — besiegers allied; all besiegers at_war with the Besieged.
 *   3. Doctrine grant — surfaces the siege strategic activities in the planner,
 *      but ONLY for factions whose doctrine gate is already active (granting to a
 *      gate-inactive faction would switch the gate on and hide its other activities).
 *   4. Champions — auto-seeds rosters from the world's PCs/bosses/rigs.
 *   5. Reports target + depot UUIDs, validateDepot, layer count.
 * ────────────────────────────────────────────────────────────────────────── */
(async () => {
  const TAG = "[perspicacity-setup]";
  const ID = {
    EVIL: "oK7VitQikQ6FN3PI", // Evil Bad Faction  — BESIEGED
    UM:   "Zsn8DO6cpTuHHexS", // The Unmoved Movers — PRIMARY attacker
    FB:   "tPLdifKdXl1jxo9w", // Funkie Bunch       — support
    SV:   "H8sSXuuoTZIJKCXP", // Steryo Vights      — support
  };
  const byId = (id, name) => game.actors.get(id) || game.actors.getName(name);
  const evil = byId(ID.EVIL, "Evil Bad Faction");
  const um   = byId(ID.UM,   "The Unmoved Movers");
  const fb   = byId(ID.FB,   "Funkie Bunch");
  const sv   = byId(ID.SV,   "Steryo Vights");
  const all  = { evil, um, fb, sv };
  for (const [k, a] of Object.entries(all)) {
    if (!a) { ui.notifications.error(`${TAG} missing faction: ${k}. Import the actors first.`); return; }
  }
  const besiegers = [um, fb, sv];

  // 1 ── OP top-up — fill banks to cap (caps are in MARKS; copy them exactly) ──
  const fillBank = async (actor) => {
    const caps = actor.getFlag("bbttcc-factions", "opCaps") || {};
    const bank = foundry.utils.duplicate(actor.getFlag("bbttcc-factions", "opBank") || {});
    for (const k of Object.keys(caps)) bank[k] = Math.max(Number(bank[k]) || 0, Number(caps[k]) || 0);
    await actor.setFlag("bbttcc-factions", "opBank", bank);
  };
  for (const a of [evil, um, fb, sv]) await fillBank(a);

  // 2 ── Relations ────────────────────────────────────────────────────────────
  const relApi = game.bbttcc?.api?.relations;
  const setRel = async (A, B, tier) => {
    if (relApi?.set) { await relApi.set(A, B, tier); await relApi.set(B, A, tier); return; }
    for (const [X, Y] of [[A, B], [B, A]]) {
      const m = foundry.utils.duplicate(X.getFlag("bbttcc-factions", "relations") || {});
      m[Y.id] = tier; await X.setFlag("bbttcc-factions", "relations", m);
    }
  };
  await setRel(um, fb, "allied");
  await setRel(um, sv, "allied");
  await setRel(fb, sv, "allied");
  for (const b of besiegers) await setRel(b, evil, "at_war");

  // 3 ── Doctrine grant (safe — only where the gate is already active) ─────────
  const ATTACKER_KEYS = ["begin_siege","establish_siege_camp","interdict_supply_line","escort_supply_line","counter_interdict","demand_surrender","champion_withdraws","champion_returns"];
  const DEFENDER_KEYS = ["sortie","reinforce_garrison","call_relief","sue_for_terms","champion_defends_wall","pray_for_omen","champion_returns","interdict_supply_line"];
  const dApi = game.bbttcc?.api?.factions?.doctrine;
  let grantedTotal = 0;
  const doctrineNotes = [];
  if (dApi?.ownedKeys && dApi?.grant) {
    const ROLES = [[um, ATTACKER_KEYS], [fb, ATTACKER_KEYS], [sv, ATTACKER_KEYS], [evil, DEFENDER_KEYS]];
    for (const [a, keys] of ROLES) {
      const hasDoctrine = (dApi.list?.(a, "strategic") || []).length > 0;
      if (!hasDoctrine) { doctrineNotes.push(`${a.name}: gate inactive (all strategics already show)`); continue; }
      const owned = dApi.ownedKeys(a, "strategic") || new Set();
      const toGrant = keys.filter(k => !owned.has(k));
      for (const key of toGrant) { try { await dApi.grant(a, { kind: "strategic", key, silent: true }); grantedTotal++; } catch (e) { console.warn(TAG, `grant ${a.name}/${key}`, e); } }
      doctrineNotes.push(`${a.name}: +${toGrant.length} granted`);
    }
  } else { doctrineNotes.push("doctrine API unavailable — use the planner's GM 'Show Locked' toggle"); }

  // 4 ── Champion auto-seed ───────────────────────────────────────────────────
  const S = game.bbttcc?.api?.siege;
  const seeded = {};
  if (S?.championCandidates) {
    const FIDS = new Set(Object.values(ID));
    for (const a of [evil, um, fb, sv]) {
      const cands = (S.championCandidates(a.id) || []).filter(c => !FIDS.has(c.actorId)).slice(0, 3).map(c => c.actorId);
      if (cands.length) await a.setFlag("bbttcc-factions", "championRoster", cands);
      seeded[a.name] = cands.length;
    }
  }

  // 5 ── Locate hexes + validate depot + report ───────────────────────────────
  const findHex = (name) => {
    for (const sc of game.scenes) for (const d of sc.drawings)
      if (d.flags?.["bbttcc-territory"]?.name === name) return d;
    return null;
  };
  const target = findHex("Perspicacity Fortress");
  const depot  = findHex("Movers' Depot");
  let depotOk = "n/a";
  if (S?.validateDepot && depot) { const v = S.validateDepot(depot, um.id); depotOk = v?.ok ? "✓ OK" : `✗ ${v?.reason}`; }
  const layerIds = (target?.flags?.["bbttcc-territory"]?.structureActorIds || []).filter(id => game.actors.get(id));

  ChatMessage.create({
    whisper: [game.user.id],
    content: [
      `<h3>⚔ Siege of Perspicacity — SETUP COMPLETE</h3>`,
      `<b>OP banks:</b> all 4 factions filled to cap (marks-correct)`,
      `<b>Relations:</b> besiegers allied · all at_war with ${evil.name}`,
      `<b>Doctrine:</b> ${doctrineNotes.join(" · ")}`,
      `<b>Champions seeded:</b> ${Object.entries(seeded).map(([n,c]) => `${n}:${c}`).join(" · ") || "engine not ready"}`,
      `<hr><b>Target:</b> ${target ? `<code>${target.uuid}</code>` : "⚠ import the SIEGE-READY scene"}`,
      `<b>Depot:</b> ${depot ? `<code>${depot.uuid}</code>` : "⚠ not found"} · validateDepot(${um.name}): ${depotOk}`,
      `<b>Fortress layers:</b> ${layerIds.length} ${layerIds.length ? "✓" : "(run BUILD-FORTRESS)"}`,
      `<hr><b>Next:</b> Planner → Begin Siege → target Perspicacity Fortress → pick Movers' Depot + tick supporters → Plan → Advance Turn.`,
    ].join("<br>")
  });
  console.log(TAG, { grantedTotal, seeded, target: target?.uuid, depot: depot?.uuid, depotOk });
  ui.notifications.info(`${TAG} done — banks filled, see chat for the READY report.`);
})();
