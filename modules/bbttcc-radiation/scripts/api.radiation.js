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
  function _registerRelay() {
    try {
      const gx = game.bbttcc?.api?.gmExec;
      if (!gx?.register || _relayRegistered) return;
      gx.register(RELAY, async (p) => {
        const amt = Number(p?.amount);
        if (!Number.isFinite(amt) || amt <= 0 || amt > 50) throw new Error("radiation relay: bad amount");
        const A = _asActor(String(p?.actorUuid || ""));
        if (!A) throw new Error("radiation relay: actor not found");
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
