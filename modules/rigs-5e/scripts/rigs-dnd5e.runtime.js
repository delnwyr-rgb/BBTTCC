/* ─────────────────────────────────────────────────────────────────────────────
 * rigs-5e · rigs-dnd5e.runtime.js — the dnd5e RIG RUNTIME (2026-10-08)
 * ─────────────────────────────────────────────────────────────────────────────
 * Port of the June-2026 build's rigs-runtime.js (RIG_SPRINT_PLAN.md) onto the
 * system-agnostic accessor `game.bbttcc.rigs` (bbttcc-core/scripts/rigs.js).
 * On fourththing the SYSTEM owns every piece of rig machinery, so this file is
 * DORMANT there. On dnd5e a rig is a native `vehicle` Actor carrying the June
 * flag layer `flags["rigs-5e"].rig` — the accessor reads/writes that
 * storage; this file never touches the raw flag path except where it must
 * (delete-key semantics → unsetFlag; Foundry 14 killed "-=key").
 *
 *   REGISTERS   game.bbttcc.rigs.impl = { board, disembark, park, deploy, destroy,
 *               restore, outputFor, outputPreview, describeOutput, applyTurnOutput,
 *               setState, applyFrame, applyTemplate, CHANNELS }  (+ helpers: ensure,
 *               rigOf, healCrew, baseActor, frameOf, migrateLegacyRigs, sweepOrphanCrew,
 *               forceUnboard, setRollAs, crewRoller)  and game.bbttcc.rigs.outputPreview.
 *               The accessor's board/disembark/park/deploy/destroy/restore/
 *               outputFor/applyTurnOutput delegate here. game.bbttcc.rigs itself
 *               is NEVER overwritten.
 *
 *   STATE MACHINE  stationary: parked→destroyed
 *                  mobile/hybrid: parked ⇄ deployed → destroyed
 *                  (restore() = explicit GM mercy; not a normal transition)
 *
 *   OUTPUT  RFI's math, verbatim (rigs-rfi.output.js; D&D port review C18/C63, owner
 *           ruling 2026-10-31 "parity is the goal"): each strategic turn
 *           (`bbttcc:advanceTurn:end`, the GM seat that ran it AND apply:true)
 *           every faction-owned rig pays its Domain
 *             base output BY SIZE for rigs that move (RIG_BASE_OUTPUT_OP)
 *             + every equipped output-module's `yield` (bank channels → marks,
 *               anything else → the Domain stockpile as materials)
 *             × the state throttle: parked 1 · deployed 0.5 (mobileLegal:false → 0)
 *               · destroyed 0. Marks halve in MARKS (no OP flooring); materials floor.
 *           outputPreview(rig) = the opportunity cost the Rig tab + 5E Domain tab show.
 *           ONE CLOCK: never the native bastion turn.
 *           The dnd5e-only ORDERS (+1 OP per parked rig) and hand-authored
 *           basePerTurn are RETIRED — RFI never had them; `order` on old rigs is ignored.
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
 *   RELAYS  gmExec "rigs.board" / "rigs.disembark" — the GM seat checks the SOCKET
 *           sender owns the steward (C15); the initiator is meta.fromUserId, never the payload.
 *
 *   CREW    boarded crew's tokens ride the rig; a deleted rig's crew are swept back onto
 *           the grid (sweepOrphanCrew / forceUnboard — C23). Rig d20 tests roll with the
 *           steward's numbers (attacks: gunner; checks/saves/skills/initiative: pilot — C21/C22);
 *           every rig attack card stamps combat.fired for the hit-and-run gate (C24); heat and
 *           the fired stamp clear at deleteCombat (C17).
 *
 *   GEAR    accessor gearOf(item)/isFrame(item) — honours flags.fourththing.rigGear,
 *           flags.bbttcc.rigGear (June) and flags.rigs-5e.rigGear.
 *
 *   MIGRATION  legacy flags.rigs-5e.rigs[] → vehicle rigs, GM-gated,
 *           once per faction (rigsMigrated stamp), legacy array kept as audit.
 * ───────────────────────────────────────────────────────────────────────────── */
import { RIG_BASE_OUTPUT_OP, RIG_OUTPUT_STATE_MULT } from "./economy.constants.js";

(() => {
  const TAG = "[rigs-5e/rigs-dnd5e]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;   // DORMANT off-dnd5e

  const SCOPE = "rigs-5e";
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
      output: { basePerTurn: cur.output.basePerTurn }, travel: cur.travel,
    } : {};
    const next = foundry.utils.mergeObject(
      foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULTS), current, { inplace: false }),
      normaliseSeed(seed), { inplace: false });
    if (next.identity.mobility === "stationary" && next.identity.state === "deployed") next.identity.state = "parked";
    const upd = Rg.toUpdate(actor, next);   // also seats AC = bracket + tier when the hull has none (accessor, review C20)
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
    // rigs-5e: the crew-station sheet is opt-in (not every vehicle's default) — a rig gets it here.
    if (!actor.flags?.core?.sheetClass) upd["flags.core.sheetClass"] = `${SCOPE}.BBTTCCRigSheet`;
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

  // ── Output — RFI's math, verbatim (review C18/C63, 2026-10-31; owner ruling: parity) ──────────
  // Was: hand-authored basePerTurn + module `perTurn` in OP, plus dnd5e-only ORDERS (+1 OP per parked rig) RFI never
  // had — the same Domain paid differently per system, and the 5E gear twins carry `yield` (Mounted Forge
  // steel 2 / parts 1), so an output module credited nothing. Now, like rigs-rfi.output.js:
  //   rawOutput(rig)      base output BY SIZE (RIG_BASE_OUTPUT_OP) for rigs that move + equipped output-modules' `yield`
  //                       (`perTurn` honoured as a fallback); bank channels → op, anything else → materials
  //   outputFor(rig,{state}) → { state, marks:{ch:n}, materials:{key:n} } for ONE turn — MARKS, not OP
  //   outputPreview(rig)  → parked / deployed / lost + text, for the Rig tab and the 5E Domain tab
  //   applyTurnOutput()   pays marks through op.commit and materials through api.factions.stockpile.adjust + GM card
  const LABEL = { violence: "Violence", nonlethal: "Nonlethal", intrigue: "Intrigue", economy: "Economy", softpower: "Soft Power", diplomacy: "Diplomacy", logistics: "Logistics", culture: "Culture", faith: "Faith" };
  const marksPerOp = () => { const op = OP(); const n = Number(op?.marksPerOp?.() ?? op?.OP_TO_MARKS); return Number.isFinite(n) && n > 0 ? n : 0; };   // the live engine is the only ratio authority
  const pretty = (k) => String(k || "").replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const bracketOf = (rig) => String(frameOf(rig)?.bracket || data(rig)?.integrity?.bracket || "medium").toLowerCase();
  const stateOf = (rig) => String(data(rig)?.identity?.state ?? "parked").toLowerCase();

  /** Raw (parked, 100%) output: { op: {channel: OP}, opMobile, mats: {key: n}, matMobile } */
  function rawOutput(rig) {
    const op = {}, opMobile = {}, mats = {}, matMobile = {};
    const addOp = (ch, n, mobileLegal) => { const v = Number(n) || 0; if (v <= 0) return; op[ch] = (op[ch] || 0) + v; opMobile[ch] = (opMobile[ch] || 0) + (mobileLegal ? v : 0); };
    const addMat = (k, n, mobileLegal) => { const v = Math.floor(Number(n) || 0); if (v <= 0) return; mats[k] = (mats[k] || 0) + v; matMobile[k] = (matMobile[k] || 0) + (mobileLegal ? v : 0); };
    const d = data(rig);
    if (!d) return { op, opMobile, mats, matMobile };
    if (String(d.identity?.mobility ?? "mobile") !== "stationary") for (const [ch, n] of Object.entries(RIG_BASE_OUTPUT_OP[bracketOf(rig)] || {})) addOp(ch, n, true);
    for (const it of rig?.items ?? []) {
      const g = gearOf(it);   // either flag scope (fourththing / bbttcc / rigs-5e)
      if (g?.subtype !== "output-module") continue;
      if (it.system?.equipped === false) continue;
      const mobileLegal = g.mobileLegal !== false;
      for (const [k, n] of Object.entries(g.yield || g.perTurn || {})) {
        const key = String(k).toLowerCase();
        if (CHANNELS.includes(key)) addOp(key, n, mobileLegal); else addMat(key, n, mobileLegal);
      }
    }
    return { op, opMobile, mats, matMobile };
  }

  /** One turn's output at a given state (default: the rig's current state). Marks, not OP. */
  function outputFor(rig, { state = null } = {}) {
    const st = String(state || stateOf(rig)).toLowerCase();
    const mult = Number(RIG_OUTPUT_STATE_MULT[st] ?? 1);
    const out = { state: st, marks: {}, materials: {} };
    if (!rig || !data(rig) || mult <= 0) return out;
    const per = marksPerOp();
    const raw = rawOutput(rig);
    const deployedish = st !== "parked";
    for (const [ch, v] of Object.entries(raw.op)) {
      const base = deployedish ? raw.opMobile[ch] || 0 : v;
      const m = Math.round(base * per * mult);
      if (m > 0) out.marks[ch] = m;
    }
    for (const [k, v] of Object.entries(raw.mats)) {
      const base = deployedish ? raw.matMobile[k] || 0 : v;
      const n = Math.floor(base * mult);
      if (n > 0) out.materials[k] = n;
    }
    return out;
  }

  function describeOutput(out) {
    const parts = [];
    for (const [ch, m] of Object.entries(out?.marks || {})) parts.push(`+${m} ${LABEL[ch] || pretty(ch)} marks`);
    for (const [k, n] of Object.entries(out?.materials || {})) parts.push(`+${n} ${pretty(k)}`);
    return parts.length ? parts.join(", ") : "nothing";
  }

  /** The opportunity cost, for the Rig tab + the 5E Domain tab (bad-eden-5e/scripts/sheet.js domainRigs). */
  function outputPreview(rig) {
    const parked = outputFor(rig, { state: "parked" });
    const deployed = outputFor(rig, { state: "deployed" });
    const lost = { marks: {}, materials: {} };
    for (const [ch, m] of Object.entries(parked.marks)) { const d = m - (deployed.marks[ch] || 0); if (d > 0) lost.marks[ch] = d; }
    for (const [k, n] of Object.entries(parked.materials)) { const d = n - (deployed.materials[k] || 0); if (d > 0) lost.materials[k] = d; }
    const has = (o) => Object.keys(o.marks).length || Object.keys(o.materials).length;
    return {
      state: stateOf(rig), produces: !!has(parked),
      parked, deployed, lost,
      parkedText: describeOutput(parked), deployedText: describeOutput(deployed),
      lostText: has(lost) ? describeOutput(lost).replace(/\+/g, "−") : "nothing"
    };
  }

  // The strategic-turn pass: pay every faction-owned rig (marks → op.commit, materials → the Domain stockpile).
  async function applyTurnOutput({ quiet = false } = {}) {
    const report = [];
    const op = OP(); const stock = game.bbttcc?.api?.factions?.stockpile || game.bbttcc?.api?.stockpile;
    for (const rig of list()) {
      const fid = String(data(rig)?.identity?.factionOwnerId ?? "").replace(/^Actor\./, "");
      const faction = fid ? game.actors?.get?.(fid) ?? null : null;
      if (!faction) continue;
      const out = outputFor(rig);
      if (!Object.keys(out.marks).length && !Object.keys(out.materials).length) continue;
      const entry = { rig: rig.name, state: out.state, faction: faction.name, out, text: describeOutput(out), refused: null };
      try {
        if (Object.keys(out.marks).length) {
          if (typeof op?.commit !== "function") throw new Error("the marks engine isn't loaded");
          const res = await op.commit(faction.id, out.marks, { source: "rig", context: "rig-output", rigId: rig.id, rigName: rig.name });
          if (res && res.ok === false) entry.refused = String(res.error || "refused (cap?)");
        }
        for (const [k, n] of Object.entries(out.materials)) {
          const r = await stock?.adjust?.(faction, k, n, { name: pretty(k) });
          if (!stock?.adjust) entry.refused = (entry.refused ? entry.refused + "; " : "") + `${k}: no stockpile API`;
          else if (r && r.ok === false) entry.refused = (entry.refused ? entry.refused + "; " : "") + `${k}: ${r.error}`;
        }
      } catch (e) { entry.refused = String(e?.message || e); console.warn(TAG, "credit failed", rig.name, e); }
      report.push(entry);
    }
    if (!quiet && report.length) {
      const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));
      const rows = report.map(r => `<tr><td>${ICONS[r.state] ?? ""} ${esc(r.rig)}</td><td>${esc(r.state)}</td><td>${esc(r.faction)}</td><td>${esc(r.text)}${r.refused ? ` · ⚠ ${esc(r.refused)}` : ""}</td></tr>`).join("");
      try {
        await ChatMessage.create({
          whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
          content: `<div class="bbttcc-class-cue" style="border:1px solid #b9882e;border-radius:6px;padding:.4rem .6rem">
            <p style="margin:.1rem 0;font-weight:700">🛻 Rig output — strategic turn</p>
            <table style="font-size:.78rem;width:100%"><tr><th style="text-align:left">Rig</th><th style="text-align:left">State</th><th style="text-align:left">Domain</th><th style="text-align:left">Earned</th></tr>${rows}</table>
            <div style="opacity:.7;font-size:.72rem;margin-top:.2rem">Parked rigs earn in full; deployed rigs earn half; destroyed rigs earn nothing.</div>
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
    // review C25 (owner ruling 2026-10-31): a chassis that AUTHORS its hull (Siege Titan 140, Worldbreaker 240, the
    // flagships) keeps it — frame math (base + tierStep × (tier−1)) only fills in when nothing was authored.
    if (f.baseIntegrity && !d.integrity.authored) {
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
      `Bracket <b>${f.bracket ?? d.integrity.bracket}</b>${f.baseIntegrity ? (d.integrity.authored ? ` · hull stays at its authored ${d.integrity.max}` : ` · hull ${f.baseIntegrity}+${f.tierStep ?? 0}/tier`) : ""}.`,
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
  // row never lingers). Steward side = flags.rigs-5e.boardedRig
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
  const SOCKET = "module.rigs-5e";
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
    // RFI parity (ftBoardRig 2026-08-27, review C15): monsters don't take the wheel — a bestiary / hostile npc is refused
    // unless the caller forces it. Real NPC crew (friendly hirelings) still board.
    if (!opts.force && steward.type === "npc") {
      const bestiary = !!steward.flags?.fourththing?.rfi?.actor?.bestiary;
      if (bestiary || steward.prototypeToken?.disposition === CONST.TOKEN_DISPOSITIONS.HOSTILE) throw new Error(`${steward.name} is not crew material — it does not get a seat in ${rig.name}.`);
    }
    if (R()?.boardedRigOf?.(steward)?.rigId) throw new Error(`${steward.name} is already aboard a rig`);
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
    const flag = R()?.boardedRigOf?.(steward);
    if (!flag?.rigId) throw new Error(`${steward.name} is not aboard a rig`);
    if (!game.user.isGM) {
      const gx = game.bbttcc?.api?.gmExec;
      if (typeof gx?.call !== "function" || !game.users.some(u => u.isGM && u.active)) throw new Error("No GM is online to confirm disembarking.");
      const r = await gx.call("rigs.disembark", { stewardId: steward.id, initiatorUserId: game.user.id });
      if (r?.error) throw new Error(r.error);
      return true;
    }
    const rig = rigOf(steward);
    if (!rig) {
      // review C23: the rig was deleted with this steward aboard — step off from the flag alone
      await forceUnboard(steward, { why: "its rig no longer exists" });
      await chatNote(steward, `🪂 ${foundry.utils.escapeHTML(steward.name)} steps off`, ["The rig is gone — tokens and sight restored."]);
      _broadcastSelect({ stewardId: steward.id, rigId: flag.rigId, mode: "disembark", initiatorUserId: opts.initiatorUserId ?? game.user.id });
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
  // review C23: a rig deleted with crew aboard left its stewards hidden on every scene with the dead rig's sight and no
  // Disembark control (rigOf() → null; disembark() threw). RFI sweeps orphan crew (_ftSweepOrphanCrew on deleteActor /
  // deleteToken / ready); this is that sweep. forceUnboard() needs no rig: it unhides every token of the steward,
  // restores the prior sight kept on the token flag, and clears boardedRig.
  async function forceUnboard(steward, { why = "rig no longer exists" } = {}) {
    steward = baseActor(steward);
    if (!steward) return false;
    for (const scene of game.scenes) {
      const sts = _tokDocsOf(scene, steward.id); if (!sts.length) continue;
      const updates = sts.map(t => {
        const u = { _id: t.id, hidden: false };
        const ov = t.getFlag(SCOPE, FLAG_SIGHT);
        if (ov) { if (ov.priorSight) u.sight = ov.priorSight; u[`flags.${SCOPE}.-=${FLAG_SIGHT}`] = null; }
        return u;
      });
      try { await scene.updateEmbeddedDocuments("Token", updates, { animate: false }); }
      catch (e) { console.warn(TAG, "forceUnboard: token restore failed on", scene.name, e); }
    }
    try { await steward.unsetFlag(SCOPE, "boardedRig"); } catch (_e) {}
    console.log(TAG, `${steward.name} stepped off (${why})`);
    return true;
  }
  let _sweepTimer = null;
  function sweepOrphanCrew() {
    if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
    if (_sweepTimer) clearTimeout(_sweepTimer);
    _sweepTimer = setTimeout(async () => {
      _sweepTimer = null;
      let n = 0;
      try {
        for (const a of game.actors?.contents ?? []) {
          const b = R()?.boardedRigOf?.(a); if (!b?.rigId) continue;
          const rig = game.actors.get(b.rigId);
          if (rig && isRig(rig)) continue;
          if (await forceUnboard(a)) n++;
        }
      } catch (e) { console.warn(TAG, "orphan crew sweep failed", e); }
      if (n) ui.notifications?.info?.(`Disembarked ${n} steward(s) whose rig no longer exists.`);
    }, 1500);
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
    // the rig is gone → its crew step off (RFI: deleteActor / deleteToken / ready sweeps)
    Hooks.on("deleteActor", (actor) => { try { if (actor?.type === "vehicle" && actor.flags?.[SCOPE]?.rig) sweepOrphanCrew(); } catch (_e) {} });
    sweepOrphanCrew();
    // player seats board/disembark through the GM relay. review C15 (2026-10-31): the GM seat trusts the SOCKET sender
    // (meta.fromUserId — Foundry stamps it; gm-exec refuses a payload id that disagrees), requires that sender to OWN the
    // steward, and takes the initiator from the sender, never the payload — any seat could hide any actor's tokens on
    // every scene before. Same test as rigsActionHandler.
    const gx = game.bbttcc?.api?.gmExec;
    if (typeof gx?.register === "function") {
      const authorise = (payload = {}, meta = {}) => {
        const user = game.users?.get?.(String(meta?.fromUserId || ""));
        if (!user) throw new Error("unknown sender");
        const steward = game.actors?.get?.(String(payload?.stewardId ?? ""));
        if (!steward) throw new Error("unknown steward");
        if (!user.isGM) {
          if (!steward.testUserPermission?.(user, "OWNER")) throw new Error("you don't own that steward");
          if (!["character", "npc"].includes(steward.type)) throw new Error(`${steward.name} can't crew a rig`);
        }
        return { user, steward };
      };
      gx.register("rigs.board", async (payload = {}, meta = {}) => {
        try {
          const { user, steward } = authorise(payload, meta);
          const rig = game.actors?.get?.(String(payload.rigId ?? ""));
          if (!rig || !data(rig)) throw new Error("unknown rig");
          await board(steward, rig, { role: String(payload.role ?? "crew"), initiatorUserId: user.id });
          return { ok: true };
        } catch (e) { return { error: e.message }; } });
      gx.register("rigs.disembark", async (payload = {}, meta = {}) => {
        try {
          const { user, steward } = authorise(payload, meta);
          await disembark(steward, { initiatorUserId: user.id });
          return { ok: true };
        } catch (e) { return { error: e.message }; } });
    }
  }

  // ── Token HUD (v13+ HUD is a <form> — unwrap guard) ────────────────────────
  function distFt(t1, t2) {
    const grid = canvas?.scene?.grid;
    if (!t1 || !t2 || !grid?.size || !grid?.distance) return Infinity;
    // 11-12 (Dave: "I'm not sure how to board"): EDGE to edge, not centre to centre — a 150-ft titan's centre is
    // 15+ ft from a PC standing against its hull, so the 🛻 Board button never appeared beside big rigs.
    const gap = (a, b, sa, sb) => Math.max(0, Math.abs(a - b) - (sa + sb) / 2);
    const dx = gap(t1.center.x, t2.center.x, t1.w ?? 0, t2.w ?? 0), dy = gap(t1.center.y, t2.center.y, t1.h ?? 0, t2.h ?? 0);
    return Math.hypot(dx, dy) / (grid.size / grid.distance);
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
          if (R()?.boardedRigOf?.(actor)?.rigId) {   // C23: offered from the flag, so a dead rig's crew can still step off
            addBtn("🪂", "Disembark rig", () => disembark(actor));
          } else {
            // adjacent = within one grid step, diagonals included (2026-10-31: a diagonal square read 11.2 ft on a
            // 5-ft grid and the button vanished — Dave: "I have lost my ability to board"). Overlap counts too.
            const step = (canvas?.scene?.grid?.distance ?? 5) * 1.5;
            const all = (canvas?.tokens?.placeables ?? []).filter(t => t.actor && isRig(baseActor(t.actor)) && t !== token).map(t => ({ t, ft: distFt(token, t) })).sort((a, b) => a.ft - b.ft);
            const rigs = all.filter(x => x.ft <= step).map(x => x.t);
            if (rigs.length) addBtn("🛻", `Board ${rigs[0].actor.name}`, async () => {
              const role = await pickRole();
              if (role) await board(actor, baseActor(rigs[0].actor), role, { token });
            });
            else if (all.length && all[0].ft <= step * 4) addBtn("🛻", `${all[0].t.actor.name} is ${Math.round(all[0].ft)} ft away — move next to it to board`, () => ui.notifications?.info?.(`Move next to ${all[0].t.actor.name} to board it.`));
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

  // ── Legacy migration — flags.rigs-5e.rigs[] → vehicle rigs ─────────
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

  // ── Crew rolls (2026-10-31, Dave: "RFI uses the stewards own skills for attacks, checks, etc. This is going
  // through the mech, and it has +0 to rolls") — a dnd5e vehicle has Dex 10 and no proficiency, so anything rolled
  // THROUGH the rig (its sheet, a mounted gun's card, the combat dock) came out at +0. RFI rolls the steward's own
  // aptitude; here one hook on every d20 test a rig makes swaps the vehicle's mod/prof for the boarded steward's:
  // attacks use the GUNNER (else the pilot) with their ability mod + proficiency when they're proficient with the
  // gun; checks, saves, skills (Piloting) and initiative use the PILOT. `setRollAs(steward)` lets the dock name the
  // roller explicitly (GM firing for a steward who isn't in the roster yet). Damage is the gun's own dice — the
  // steward's mod isn't added, same as RFI's rig weapons.
  let _rollAs = null;
  const setRollAs = (steward) => { _rollAs = steward ?? null; };
  function crewRoller(rig, kind) {
    if (_rollAs) return _rollAs;
    const slots = data(rig)?.crew?.slots ?? [];
    const pick = role => { const s = slots.find(x => x.role === role && x.actorId); return s ? game.actors?.get?.(s.actorId) : null; };
    return (kind === "attack" ? (pick("gunner") ?? pick("pilot")) : pick("pilot")) ?? slots.map(x => x.actorId && game.actors?.get?.(x.actorId)).find(Boolean) ?? null;
  }
  const roundKey = () => `${game.combat?.id ?? "-"}:${game.combat?.round ?? 0}`;
  // Roll All / Roll NPCs never open the dialog (Combat5e.rollInitiative → Combatant5e#getInitiativeRoll → the vehicle's own
  // +0 roll, no preRollD20TestV2) — review C22. One guarded wrap on the combatant's getInitiativeRoll hands a boarded rig's
  // initiative to its pilot's own roll; the dialog path (rollInitiativeDialog) caches its roll on the actor first and is
  // left alone (it is swapped in the preRollD20TestV2 hook below).
  function installInitiativeWrap() {
    const proto = CONFIG.Combatant?.documentClass?.prototype;
    if (!proto || typeof proto.getInitiativeRoll !== "function" || proto.getInitiativeRoll._bbttccRig) return;
    const orig = proto.getInitiativeRoll;
    const wrapped = function (formula) {
      try {
        const rig = baseActor(this.actor);
        if (rig && rig.type === "vehicle" && isRig(rig) && !rig._cachedInitiativeRoll) {
          const st = crewRoller(rig, "initiative");
          if (st && st.id !== rig.id && typeof st.getInitiativeRoll === "function") { const r = st.getInitiativeRoll(); if (r) return r; }
        }
      } catch (e) { console.warn(TAG, "rig initiative swap failed", e); }
      return orig.call(this, formula);
    };
    wrapped._bbttccRig = true;
    proto.getInitiativeRoll = wrapped;
  }
  function installCrewRolls() {
    installInitiativeWrap();
    Hooks.on("dnd5e.preRollD20TestV2", (config, _dialog, message) => {
      try {
        const subject = config?.subject;
        const isActivity = !!subject?.item && !!subject?.actor;
        const rig = baseActor(isActivity ? subject.actor : subject);
        if (!rig || rig.type !== "vehicle" || !isRig(rig)) return;
        const names = (config.hookNames ?? []).map(String);
        const isInit = names.includes("initiativeDialog");
        const kind = isActivity ? "attack" : isInit ? "initiative" : (config.skill ? "skill" : "check");
        const st = crewRoller(rig, kind);
        if (!st || st.id === rig.id) return;
        const ability = isInit ? (st.system?.attributes?.init?.ability || CONFIG.DND5E?.defaultAbilities?.initiative || "dex")
          : (config.ability ?? config.rolls?.[0]?.data?.roll?.ability ?? (isActivity ? "dex" : null));
        const abil = st.system?.abilities?.[ability];
        let mod = Number(abil?.mod) || 0, prof = null;
        if (kind === "attack") {
          const w = subject.item, profKey = CONFIG.DND5E?.weaponProficienciesMap?.[w?.system?.type?.value];
          const wp = st.system?.traits?.weaponProf?.value;
          const proficient = w?.system?.proficient === 1 || !!(wp?.has?.(profKey) || wp?.has?.(w?.system?.type?.value) || wp?.has?.(w?.system?.type?.baseItem));
          if (proficient) prof = String(Number(st.system?.attributes?.prof) || 0);
        } else if (kind === "skill") {
          const sk = st.system?.skills?.[config.skill];
          if (sk) { mod = Number(sk.mod) || mod; if (sk.prof?.hasProficiency) prof = sk.prof.term; }
        } else if (kind === "initiative") {
          // the pilot's own initiative numbers (C22): their init ability mod + initiative proficiency (Alert / JoaT)
          const init = st.system?.attributes?.init;
          mod = Number(init?.mod ?? abil?.mod) || 0;
          if (init?.prof?.hasProficiency) prof = init.prof.term;
        } else {
          // dnd5e 6.0.5 Actor5e#rollD20Test: hookNames = [..., "SavingThrow" | "AbilityCheck", "d20Test"] — the string
          // "save" is never there, so saves took the pilot's CHECK proficiency (review C21).
          const t = names.some(h => /SavingThrow|^save$/i.test(h)) ? "save" : "check";
          if (abil?.[t]?.prof?.hasProficiency) prof = abil[t].prof.term;
        }
        for (const r of config.rolls ?? []) {
          r.data ??= {}; r.parts ??= [];
          if (isActivity) {
            // attacks: dnd5e's buildConfig adds "@mod"/"@prof" AFTER this hook (AttackActivity._buildAttackConfig,
            // `config.data = { ...data, ...config.data }` — ours wins), so only the values go in here
            r.data.mod = mod; r.data.prof = prof ?? "0";
            continue;
          }
          if (r.parts.includes("@mod")) r.data.mod = mod; else { r.parts.unshift("@mod"); r.data.mod = mod; }
          if (prof != null && prof !== "0") { if (!r.parts.includes("@prof")) r.parts.push("@prof"); r.data.prof = prof; }
          else if (r.parts.includes("@prof")) r.data.prof = 0;
        }
        if (message) { message.data ??= {}; const f = message.data.flavor ?? ""; if (!/at the controls|aims/.test(f)) message.data.flavor = `${f}${f ? " · " : ""}${st.name} ${kind === "attack" ? "aims" : "at the controls"}`; }
      } catch (e) { console.warn(TAG, "crew roll swap failed", e); }
    });
    // review C24: the hit-and-run gate must see EVERY rig shot (sheet, item card, dock, bar) from any seat — the attack
    // card (dnd5e 6: message.type "attack") is the one thing all paths share. The active GM stamps the rig's
    // flags.rigs-5e.combat.fired = "<combat>:<round>"; rigs-dnd5e.actions reads it next to its local gate.
    Hooks.on("createChatMessage", (msg) => {
      try {
        if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
        if (msg?.type !== "attack" && msg?.flags?.dnd5e?.roll?.type !== "attack") return;
        const rig = game.actors?.get?.(String(msg.speaker?.actor ?? ""));
        if (!rig || !isRig(rig)) return;
        const key = roundKey();
        if (rig.flags?.[SCOPE]?.combat?.fired !== key) rig.update({ [`flags.${SCOPE}.combat.fired`]: key }).catch(() => {});
      } catch (_e) {}
    });
    // review C17: heat (stomp +1 / vent −1 −2, rigs-dnd5e.actions) and the fired stamp clear when the fight ends — nothing
    // ever lowered heat between combats, so a Space Marine that stomped four times was overheated for good.
    Hooks.on("deleteCombat", async () => {
      try {
        if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
        for (const rig of list()) {
          const c = rig.flags?.[SCOPE]?.combat ?? {};
          if (!(Number(c.heat) > 0) && !c.fired) continue;
          await rig.update({ [`flags.${SCOPE}.combat.heat`]: 0, [`flags.${SCOPE}.combat.fired`]: null });
        }
      } catch (e) { console.warn(TAG, "combat-end rig sweep failed", e); }
    });
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    const Rg = R();
    if (!Rg?.impl) { console.warn(TAG, "game.bbttcc.rigs accessor missing (bbttcc-core not loaded?) — dnd5e rig runtime NOT installed"); return; }
    const keys = OP()?.KEYS;
    if (Array.isArray(keys) && keys.length) CHANNELS.splice(0, CHANNELS.length, ...keys);
    installCrewFollow();   // crew tokens ride the rig; player boards relay to the GM (2026-10-31)
    installCrewRolls();    // rig d20 tests roll with the boarded steward's mod/prof (2026-10-31)

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
      setRollAs, crewRoller,   // crew rolls (2026-10-31)
      board, disembark, park, deploy, destroy, restore, outputFor, outputPreview, describeOutput, applyTurnOutput, setState, applyFrame, applyTemplate,
      CHANNELS,
      // helpers the sheet / actions files lean on
      ensure, rigOf, healCrew, baseActor, frameOf, migrateLegacyRigs, sweepOrphanCrew, forceUnboard,
    });
    Rg.outputPreview = outputPreview;   // the 5E Domain tab reads game.bbttcc.rigs.outputPreview (C63), as on RFI
    migrateLegacyRigs().catch(e => console.warn(TAG, "legacy migration failed", e));
    console.log(TAG, "dnd5e rig runtime registered on game.bbttcc.rigs.impl (state machine · RFI output math · boarding + orphan sweep · HUD · frames · crew rolls · damage hooks · migration)");
  });
})();
