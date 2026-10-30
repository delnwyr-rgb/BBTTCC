// modules/bbttcc-radiation/scripts/api.radiation.js
// Bad Eden — Radiation Core API (R1)
// *** FIXED VERSION: install() now guaranteed to fire ***

(() => {
  const MOD = "bbttcc-radiation";
  const TAG = "[bbttcc-radiation/api]";

  const LEVELS = [
    { name:"Safe",     key:"safe",     min:0,  max:10 },
    { name:"Low",      key:"low",      min:11, max:25 },
    { name:"Moderate", key:"moderate", min:26, max:50 },
    { name:"High",     key:"high",     min:51, max:75 },
    { name:"Extreme",  key:"extreme",  min:76, max:95 },
    { name:"Lethal",   key:"lethal",   min:96, max:9999 }
  ];

  function _asActor(aOrId) {
    if (!aOrId) return null;
    if (aOrId instanceof Actor) return aOrId;
    const s = String(aOrId);
    // A full uuid (e.g. an unlinked token's synthetic actor "Scene.x.Token.y.Actor.z") resolves to THAT actor.
    if (s.includes(".") && !/^Actor\.[^.]+$/.test(s)) {
      try { const d = fromUuidSync(s); if (d instanceof Actor) return d; if (d?.actor instanceof Actor) return d.actor; } catch (_e) {}
    }
    return game.actors?.get(s.replace(/^Actor\./,"")) ?? null;
  }

  // Per-actor write queue: add() is read-modify-write, and two afterTravel listeners (hex + zone) can
  // hit the same actor back-to-back — serialize so neither exposure is lost.
  const _queue = new Map();
  function _serial(A, fn) {
    const k = A.uuid;
    const p = (_queue.get(k) || Promise.resolve()).then(fn);
    const tail = p.catch(() => {});
    _queue.set(k, tail);
    tail.then(() => { if (_queue.get(k) === tail) _queue.delete(k); });
    return p;
  }
  const RELAY = "radiation.add";   // gmExec type: exposure on an actor this seat cannot write

  // ── Single source of truth ─────────────────────────────────────────────────
  // On the fourththing system, RP lives in the actor data model at
  // system.radiation.rp — the same field the sheet, the damage track, consumables,
  // and the AE-key registry all read/write. We unify here so environmental
  // accumulation (zone/hex/travel, which flow through this API) and the relief
  // valves can no longer drift onto two separate meters. Systems without that
  // field (e.g. dnd5e) fall back to the legacy module flag, unchanged.
  function _useSysStore(A) {
    return game.system?.id === "fourththing"
        && foundry.utils.hasProperty(A, "system.radiation.rp");
  }

  function levelFor(value) {
    const v = Number(value || 0);
    return LEVELS.find(L => v >= L.min && v <= L.max) || LEVELS[LEVELS.length - 1];
  }

  class RadiationAPI {
    static get(actorOrId) {
      const A = _asActor(actorOrId);
      if (!A) return 0;
      if (_useSysStore(A)) return Number(foundry.utils.getProperty(A, "system.radiation.rp") || 0);
      return Number(A.getFlag(MOD, "rp") || 0);
    }

    static async set(actorId, value) {
      const A = _asActor(actorId);
      if (!A) throw new Error("Radiation.set: actor not found");
      const prev = this.get(A);
      const next = Math.max(0, Number(value || 0));

      if (_useSysStore(A)) await A.update({ "system.radiation.rp": next });
      else                 await A.setFlag(MOD, "rp", next);

      const prevLev = levelFor(prev);
      const nextLev = levelFor(next);

      if (prevLev.key !== nextLev.key) {
        ui.notifications?.info?.(
          `${A.name}: Radiation level changed from ${prevLev.name} (${prev}) to ${nextLev.name} (${next}).`
        );
      }

      // Mutation roll. On fourththing this is owned by the sync path in
      // radiation-effects.js (fires for EVERY RP path, GM-authoritative, all
      // bands) — so we DON'T fire here to avoid a double roll. Other systems
      // (e.g. the dnd5e build) keep the original first-cross-50 behavior.
      if (game.system?.id !== "fourththing" && prev < 50 && next >= 50) {
        Hooks.callAll("bbttcc.mutationRoll", A, next);
      }

      return next;
    }

    static async add(actorId, amount) {
      const A = _asActor(actorId);
      if (!A) throw new Error("Radiation.add: actor not found");
      const amt = Number(amount || 0);
      // A seat that cannot write the actor (player-driven travel on a faction it does not own) relays to the GM.
      if (!game.user?.isGM && !A.isOwner) {
        const gx = game.bbttcc?.api?.gmExec;
        if (!gx?.call) throw new Error("Radiation.add: no write permission and gmExec unavailable");
        const r = await gx.call(RELAY, { actorUuid: A.uuid, amount: amt });
        return Number(r?.rp ?? 0);
      }
      return _serial(A, () => this.set(A, this.get(A) + amt));
    }
  }

  // ── Exposure: hex level → gear → RP (owner rulings 2026-10-22) ──────────────
  // ONE function for travel legs, turn-end exposure and the Travel Console preview.
  //   base     = the hex Radiation level (0–3) + any weather radiation on the leg
  //   Radcloth Hood / Scrubber Harness (flags.bbttcc.radiation.tierDelta, or hazardResist
  //            "radiation") → one level cooler. Best one only, no stacking.
  //   Rad Suit worn (flags.bbttcc.radiationResist / resistances "radiation" on the item or
  //            the actor) → halve what is left, rounded down.
  //   Immune to radiation → 0.
  const _has = (list, k) => {
    if (!list) return false;
    if (Array.isArray(list)) return list.some(x => String(x?.type ?? x?.key ?? x).toLowerCase() === k);
    if (list instanceof Set) return list.has(k);
    if (typeof list === "object") return !!list[k];
    return false;
  };
  function _worn(item) {
    // Armor (the suits) must be equipped; gear with no equipped field counts while carried.
    const eq = item?.system?.equipped;
    return eq === undefined || eq === null ? true : !!eq;
  }
  function protectionFor(actorOrId) {
    const A = _asActor(actorOrId);
    const out = { tierDelta: 0, halve: false, immune: false, sources: [] };
    if (!A) return out;
    const d = A.system?.defenses || {};
    if (_has(d.immunities, "radiation")) { out.immune = true; out.sources.push("Radiation immunity"); return out; }
    if (_has(d.resistances, "radiation")) { out.halve = true; out.sources.push("Radiation resistance"); }
    let best = null;
    for (const it of (A.items?.contents ?? [])) {
      if (!_worn(it)) continue;
      const bb = it.flags?.bbttcc || {};
      const td = Number(bb.radiation?.tierDelta ?? (_has(bb.hazardResist, "radiation") ? -1 : 0)) || 0;
      if (td < 0 && (!best || td < best.td)) best = { td, name: it.name };
      if (bb.radiationResist === true || _has(it.system?.resistances, "radiation")) {
        out.halve = true; if (!out.sources.includes(it.name)) out.sources.push(it.name);
      }
    }
    if (best) { out.tierDelta = Math.max(-1, best.td); out.sources.unshift(best.name); }
    return out;
  }
  function exposureFor(actorOrId, base) {
    const prot = protectionFor(actorOrId);
    let rp = Math.max(0, Math.round(Number(base) || 0));
    const raw = rp;
    if (prot.immune) rp = 0;
    else {
      if (prot.tierDelta) rp = Math.max(0, rp + prot.tierDelta);
      if (prot.halve) rp = Math.floor(rp / 2);
    }
    return { raw, rp, protection: prot };
  }
  // A hex's base exposure: its Radiation level (0–3) + active weather's radiation (Harmony Rain −1,
  // Toxic Storm +1, Qliphothic Thunderstorm +2, Ley-Heat Updraft +1 only on a hot hex).
  function hexBase(hexDocOrFlags) {
    const doc = hexDocOrFlags?.document ?? hexDocOrFlags;
    const tf = doc?.flags?.["bbttcc-territory"] ?? doc ?? {};
    const level = Math.max(0, Math.min(3, Math.round(Number(tf?.mods?.radiation) || 0)));
    let weather = 0, weatherLabel = "";
    const w = (tf?.weather && typeof tf.weather === "object") ? tf.weather : null;
    if (w?.key && Number(w.remainingTurns) > 0) {
      const arch = game.bbttcc?.api?.travel?.weather?.get?.(w.key);
      const r = arch?.radiation;
      if (r && Number.isFinite(Number(r.rpDelta)) && (!r.onlyIfRadiated || level > 0)) { weather = Number(r.rpDelta); weatherLabel = w.label || arch.label || w.key; }
    }
    return { level, weather, weatherLabel, base: Math.max(0, level + weather) };
  }

  // The faction's Stewards — the characters who soak a leg's radiation (owner ruling 2026-10-22).
  function stewardsOf(factionOrId) {
    const fid = String(factionOrId?.id ?? factionOrId ?? "").replace(/^Actor\./, "");
    if (!fid) return [];
    return (game.actors?.contents ?? []).filter(a =>
      a?.type === "character" && !a.getFlag?.("bbttcc-factions", "isFaction") &&
      String(a.flags?.["bbttcc-factions"]?.factionId || "") === fid);
  }

  // THE RIDE (Dave 2026-10-29: "Toblerone and Brexit the Terrible should have both taken it as they were riding with the
  // ER"). A ride is the lead faction + every faction stamped `flags.bbttcc-factions.travelingWith.leadId` = that lead (the
  // Travel Console's stack). Either end works: a passenger's id resolves to its lead's whole ride.
  function partyFactionIds(factionOrId) {
    const fid = String(factionOrId?.id ?? factionOrId ?? "").replace(/^Actor\./, "");
    if (!fid) return [];
    const tw = game.actors?.get(fid)?.getFlag?.("bbttcc-factions", "travelingWith");
    const lead = String(tw?.leadId || fid).replace(/^Actor\./, "");
    const out = [lead];
    for (const a of (game.actors?.contents ?? [])) {
      if (!a?.getFlag?.("bbttcc-factions", "isFaction")) continue;
      const t = a.getFlag("bbttcc-factions", "travelingWith");
      if (t?.leadId && String(t.leadId).replace(/^Actor\./, "") === lead && !out.includes(a.id)) out.push(a.id);
    }
    return out;
  }
  // Every Steward on the ride (each faction's stewardsOf, de-duplicated).
  function partyStewardsOf(factionOrId) {
    const seen = new Set(); const out = [];
    for (const id of partyFactionIds(factionOrId)) for (const S of stewardsOf(id)) if (!seen.has(S.id)) { seen.add(S.id); out.push(S); }
    return out;
  }

  function install() {
    try {
      // Attach namespace
      game.bbttcc ??= { api:{} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.radiation ??= {};

      const api = game.bbttcc.api.radiation;
      api.get      = RadiationAPI.get.bind(RadiationAPI);
      api.set      = RadiationAPI.set.bind(RadiationAPI);
      api.add      = RadiationAPI.add.bind(RadiationAPI);
      api.levelFor = levelFor;
      api.protectionFor = protectionFor;
      api.exposureFor   = exposureFor;
      api.stewardsOf    = stewardsOf;
      api.partyFactionIds = partyFactionIds;
      api.partyStewardsOf = partyStewardsOf;
      api.hexBase       = hexBase;
      _registerRelay();

      // Attach to module API
      const mod = game.modules.get(MOD);
      if (mod) {
        mod.api = mod.api || {};
        mod.api.RadiationAPI = RadiationAPI;
      }

      console.log(TAG, "API ready:", Object.keys(api));

    } catch (e) {
      console.warn(TAG, "install failed:", e);
    }
  }

  // GM side of the player-seat exposure relay. Exposure only ever RAISES RP, so the relay accepts
  // positive amounts only (a player seat cannot clear RP through it).
  let _relayRegistered = false;
  function _relayAllowed(A, caller) {
    if (!A || !caller) return false;
    if (caller.isGM || A.testUserPermission?.(caller, "OWNER")) return true;
    const fid = String(A.flags?.["bbttcc-factions"]?.factionId || "");
    if (!fid) return false;
    // Only a Steward of that faction can be hit through the faction path.
    if (!stewardsOf(fid).some(s => s.id === A.id)) return false;
    // Same ride (2026-10-29): the leg's seat may be any faction riding with this Steward's — the lead or a passenger.
    const ride = partyFactionIds(fid);
    if (ride.some(id => game.actors?.get(id)?.testUserPermission?.(caller, "OWNER"))) return true;
    // Member: the sender owns (or plays) a character on a faction in the same ride.
    const mine = [caller.character, ...(game.actors?.contents ?? []).filter(a =>
      a?.type === "character" && a.testUserPermission?.(caller, "OWNER"))].filter(Boolean);
    return mine.some(a => ride.includes(String(a.flags?.["bbttcc-factions"]?.factionId || "")));
  }
  function _registerRelay() {
    try {
      const gx = game.bbttcc?.api?.gmExec;
      if (!gx?.register || _relayRegistered) return;
      gx.register(RELAY, async (p, meta) => {
        const amt = Number(p?.amount);
        if (!Number.isFinite(amt) || amt <= 0 || amt > 50) throw new Error("radiation relay: bad amount");
        const A = _asActor(String(p?.actorUuid || ""));
        if (!A) throw new Error("radiation relay: actor not found");
        // 10-29: authorize the REAL sender (gmExec meta.fromUserId) — they must own the target, or the
        // target must be a Steward of a faction the sender owns or belongs to (the travel leg's case).
        if (!meta?.local && !_relayAllowed(A, game.users?.get(String(meta?.fromUserId || "")))) {
          throw new Error("radiation relay: not permitted for this actor");
        }
        const rp = await RadiationAPI.add(A, amt);
        return { ok: true, rp };
      });
      _relayRegistered = true;
    } catch (e) { console.warn(TAG, "relay register failed", e); }
  }

  // ── One-time flag→system RP unification ─────────────────────────────────────
  // Historically RP accumulated into flags["bbttcc-radiation"].rp while the sheet
  // and damage track used system.radiation.rp, so the two could diverge. We fold
  // the legacy flag value into the canonical system field exactly once (max-merge,
  // so we never clobber a value a consumable/GM has since lowered). The flag is
  // left in place so this is reversible; a later cleanup can drop it. Runs once,
  // gated by a world setting, GM-only, fourththing-only.
  function registerMigrationSetting() {
    try {
      game.settings.register(MOD, "rpStoreUnified", {
        scope: "world", config: false, type: Boolean, default: false
      });
    } catch (e) { /* already registered */ }
  }

  async function migrateRpStore() {
    if (game.system?.id !== "fourththing") return;
    if (!game.user?.isGM) return;
    if (game.users?.activeGM && game.users.activeGM !== game.user) return; // single runner
    if (game.settings.get(MOD, "rpStoreUnified")) return;

    const updates = [];
    for (const A of game.actors ?? []) {
      if (!foundry.utils.hasProperty(A, "system.radiation.rp")) continue;
      const flagRp = Number(A.getFlag(MOD, "rp") || 0);
      if (!flagRp) continue;
      const sysRp  = Number(foundry.utils.getProperty(A, "system.radiation.rp") || 0);
      const merged = Math.max(sysRp, flagRp);
      if (merged !== sysRp) updates.push({ _id: A.id, "system.radiation.rp": merged });
    }
    if (updates.length) {
      await Actor.updateDocuments(updates);
      console.log(TAG, `RP store unification: merged legacy flag→system on ${updates.length} actor(s).`);
    }
    await game.settings.set(MOD, "rpStoreUnified", true);
  }

  // *** FIX: guarantee install fires no matter when module loads ***
  Hooks.once("init", () => { registerMigrationSetting(); install(); });
  Hooks.once("setup", install);
  Hooks.once("ready", install);
  Hooks.once("ready", () => { migrateRpStore().catch(e => console.warn(TAG, "RP migration failed:", e)); });
  if (game?.ready) install();
})();
