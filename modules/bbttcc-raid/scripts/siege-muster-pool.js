// bbttcc-raid/scripts/siege-muster-pool.js
// THE MUSTER POOL — the finite host (discrete-costs directive, 2026-06-03/05).
//
// Before this file, the muster was re-derived fresh on every Form Up
// (max(20, 20·tier + 15·crew) in siege-muster.js) — an infinite faucet: casualties were
// bookkeeping and the next battle conjured a brand-new full host. Now every faction owns a
// PERSISTENT, DEPLETABLE pool of troops:
//
//   · CAP — the old formula becomes capacity, not a refill: max(20, 20·tier + 15·crew).
//   · CHECKOUT/CHECKIN — Form Up debits the pool by the strength it fields; Recall credits
//     the SURVIVORS back; casualties simply never come home. (siege-muster.js wires this.)
//   · RAISE TROOPS — replenishment is a costed action: 1 OP per 10 troops (1 mark/troop),
//     paid from the faction's own OP bank via op.commit (refuses underflow).
//   · OVEREXTENSION BITES — the logistics band (turn-driver: stable / stretched /
//     overextended / strained / critical) gates the whole chain:
//       effective cap   ×1 / ×1 / ×0.85 / ×0.70 / ×0.50   (can't FIELD the full host)
//       recruit price   ×1 / ×1.25 / ×1.5 / ×2 / BARRED   (critical can't recruit at all)
//       clash morale    ×1 / ×1 / ×0.95 / ×0.90 / ×0.80   (overextended hosts fight soft)
//   · TRICKLE — peacetime recovery: +10% of cap per Advance Turn, STABLE/STRETCHED only,
//     up to the effective cap. Overextension biting also means no recovery.
//
// Pool state lives on the faction actor at flags.bbttcc-raid.musterPool. Seeding is lazy
// and full-at-cap: a faction with no flag simply HAS a full (virtual) pool — the first
// debit/credit materializes it. Zero migration pain; finitude starts at the first clash.
// A pool can exceed the EFFECTIVE cap (cap cuts limit fielding, they don't confiscate
// troops), but credits never push it above the RAW cap.
//
// API (game.bbttcc.api.siege.pool.*):
//   cap(f) / band(f) / effectiveCap(f) / fieldable(f) / clashMoraleMult(f)
//   get(f)                      → { size, cap, effectiveCap, fieldable, band, virtual }
//   quote(f, troops)            → { ok, troops, costMarks, band, mult, split?, shortfall? }
//   raiseTroops(factionId, { troops, buckets? }) → { ok, troops, costMarks, pool } (GM)
//   debit(f, n, reason) / credit(f, n, reason)   → actual amount moved (GM)

(() => {
  globalThis.__bbttcc_siege_muster_pool_loaded_v1 = Date.now();

  const MOD_R = "bbttcc-raid";
  const MOD_F = "bbttcc-factions";
  const TAG = "[bbttcc/siege-muster-pool]";

  const _num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const _api  = () => game?.bbttcc?.api;
  const _turn = () => { try { return Number(_api()?.world?.getState?.()?.turn) || 0; } catch { return 0; } };
  const _fac  = (f) => (typeof f === "string") ? (game.actors?.get?.(f) || null) : (f || null);

  // ── Band → multipliers (owner-locked 2026-06-05) ─────────────────────────────
  const CAP_MULT    = { stable: 1, stretched: 1,    overextended: 0.85, strained: 0.70, critical: 0.50 };
  const COST_MULT   = { stable: 1, stretched: 1.25, overextended: 1.5,  strained: 2,    critical: Infinity };
  const MORALE_MULT = { stable: 1, stretched: 1,    overextended: 0.95, strained: 0.90, critical: 0.80 };
  const MARKS_PER_TROOP = 1;   // 10 troops = 1 OP

  // ── Faction reads ─────────────────────────────────────────────────────────────
  function _tier(f) {
    const t = Number(f?.flags?.[MOD_F]?.tier);
    return (Number.isFinite(t) && t > 0) ? t : 1;
  }
  function _crewCount(f) {
    const ea = f?.flags?.fourththing?.echoAssets || f?.flags?.["roll-for-initiation"]?.echoAssets || {};
    return Array.isArray(ea.activeCrew) ? ea.activeCrew.length : 0;
  }
  // The 5-level logistics band (turn-driver writes flags.bbttcc-factions.logistics.band each
  // Advance Turn; pressure.logisticsBand is the mirrored copy). Unknown faction → stable.
  function band(f) {
    f = _fac(f); if (!f) return "stable";
    const fl = f.flags?.[MOD_F] || {};
    const b = String(fl.logistics?.band || fl.pressure?.logisticsBand || "stable").toLowerCase();
    return (b in CAP_MULT) ? b : "stable";
  }
  function cap(f) {
    f = _fac(f); if (!f) return 60;
    return Math.max(20, 20 * _tier(f) + 15 * _crewCount(f));
  }
  function effectiveCap(f) {
    f = _fac(f); if (!f) return 60;
    return Math.max(0, Math.round(cap(f) * (CAP_MULT[band(f)] ?? 1)));
  }
  function clashMoraleMult(f) { return MORALE_MULT[band(f)] ?? 1; }

  // ── The pool ──────────────────────────────────────────────────────────────────
  // Lazy full-at-cap seed: no flag = a full virtual pool. Cap cuts gate FIELDING, not holding.
  function get(f) {
    f = _fac(f);
    const c = cap(f), ec = effectiveCap(f), b = band(f);
    const raw = f?.flags?.[MOD_R]?.musterPool || null;
    const size = raw ? Math.max(0, _num(raw.size, c)) : c;
    return { size, cap: c, effectiveCap: ec, fieldable: Math.max(0, Math.min(size, ec)), band: b, virtual: !raw };
  }
  function fieldable(f) { return get(f).fieldable; }

  async function _write(f, patch) {
    const cur = f.flags?.[MOD_R]?.musterPool || { size: cap(f), seededAt: Date.now(), raisedTotal: 0, lostTotal: 0 };
    const next = Object.assign({}, cur, patch, { updatedTurn: _turn(), updatedAt: Date.now() });
    await f.update({ [`flags.${MOD_R}.musterPool`]: next });
    try { _api()?.siege?.refreshHud?.(); } catch (_e) {}   // 🪖 chips track every pool move (debounced)
    return next;
  }
  // Checkout: Form Up fields troops → they leave the pool. Returns the amount actually taken.
  async function debit(f, n, reason = "") {
    if (!game.user?.isGM) return 0;
    f = _fac(f); n = Math.max(0, Math.round(_num(n, 0)));
    if (!f || n <= 0) return 0;
    const p = get(f);
    const take = Math.min(p.size, n);
    if (take <= 0) return 0;
    await _write(f, { size: p.size - take });
    if (reason) console.log(TAG, `${f.name} −${take} troops (${reason}) → pool ${p.size - take}/${p.cap}`);
    return take;
  }
  // Checkin: recalled SURVIVORS come home (never above the raw cap — casualties don't).
  async function credit(f, n, reason = "") {
    if (!game.user?.isGM) return 0;
    f = _fac(f); n = Math.max(0, Math.round(_num(n, 0)));
    if (!f || n <= 0) return 0;
    const p = get(f);
    const give = Math.max(0, Math.min(n, p.cap - p.size));
    if (give <= 0) return 0;
    await _write(f, { size: p.size + give });
    if (reason) console.log(TAG, `${f.name} +${give} troops (${reason}) → pool ${p.size + give}/${p.cap}`);
    return give;
  }

  // ── Raise Troops (the costed faucet) ──────────────────────────────────────────
  // Auto-split the bill across the siege buckets, deepest-pocket-last priority order.
  const PAY_ORDER = ["violence", "logistics", "economy", "softpower", "intrigue", "diplomacy", "culture", "faith", "nonlethal"];
  function _autoSplit(f, costMarks) {
    const bank = f?.getFlag?.(MOD_F, "opBank") || {};
    const split = {}; let left = costMarks;
    for (const b of PAY_ORDER) {
      if (left <= 0) break;
      const have = Math.max(0, _num(bank[b], 0));
      const take = Math.min(have, left);
      if (take > 0) { split[b] = take; left -= take; }
    }
    return { split, shortfall: left };
  }

  // Price + affordability check WITHOUT committing — the HUD dialog's live readout.
  function quote(f, troops) {
    f = _fac(f);
    troops = Math.max(0, Math.round(_num(troops, 0)));
    if (!f) return { ok: false, reason: "no faction" };
    const p = get(f), b = p.band, mult = COST_MULT[b] ?? 1;
    if (!Number.isFinite(mult)) return { ok: false, reason: `${f.name} is critically overextended — in no state to raise troops. Stabilize first.`, band: b };
    const room = Math.max(0, p.effectiveCap - p.size);
    if (room <= 0) return { ok: false, reason: `${f.name} is at capacity (${p.size}/${p.effectiveCap}${p.effectiveCap < p.cap ? ` — overextension caps the host at ${p.effectiveCap} of ${p.cap}` : ""}).`, band: b, pool: p };
    const t = Math.min(troops || room, room);
    const costMarks = Math.ceil(t * MARKS_PER_TROOP * mult);
    const { split, shortfall } = _autoSplit(f, costMarks);
    return { ok: shortfall <= 0, troops: t, room, costMarks, band: b, mult, split, shortfall, pool: p,
             reason: shortfall > 0 ? `${f.name} can't pay ${costMarks / 10} OP — short ${shortfall / 10} OP across all banks.` : undefined };
  }

  async function raiseTroops(factionId, opts = {}) {
    if (!game.user?.isGM) return { ok: false, reason: "GM only (players relay via the siege HUD)" };
    const f = _fac(factionId);
    if (!f) return { ok: false, reason: `faction ${factionId} not found` };
    const q = quote(f, opts.troops);
    if (!q.ok) return { ok: false, reason: q.reason || "can't raise troops" };

    // Explicit buckets override the auto-split; must cover the bill exactly.
    let split = q.split;
    if (opts.buckets && typeof opts.buckets === "object") {
      split = {}; let sum = 0;
      for (const [b, v] of Object.entries(opts.buckets)) {
        const m = Math.max(0, Math.round(_num(v, 0)));
        if (m > 0) { split[b] = m; sum += m; }
      }
      if (sum !== q.costMarks) return { ok: false, reason: `payment (${sum / 10} OP) must equal the bill (${q.costMarks / 10} OP)` };
    }

    const opApi = _api()?.op;
    if (opApi?.commit) {
      const deltas = {}; for (const [b, m] of Object.entries(split)) deltas[b] = -m;
      const res = await opApi.commit(f.id, deltas, { source: "siege", label: `Raise Troops — ${q.troops} troops` });
      if (!res || res.committed === false || res.ok === false) {
        return { ok: false, reason: `${f.name} can't pay ${q.costMarks / 10} OP — bank is short` };
      }
    } else {
      console.warn(TAG, "op API unavailable — raising troops WITHOUT payment");
    }

    const p = get(f);
    const pool = await _write(f, { size: p.size + q.troops, raisedTotal: _num(f.flags?.[MOD_R]?.musterPool?.raisedTotal, 0) + q.troops });

    const surch = (q.mult > 1) ? ` <span style="opacity:.7;">(×${q.mult} — ${q.band})</span>` : "";
    try {
      await ChatMessage.create({
        content: `<div style="border:1px solid #b8863a;border-radius:6px;padding:.45rem .65rem;">
          <h3 style="margin:0 0 .25rem;color:#d9a441;">⚒ ${foundry.utils.escapeHTML(f.name)} beats the drums</h3>
          <div style="font-size:0.82em;color:#ccc;">${q.troops} troops raised for ${q.costMarks / 10} OP${surch} — the host stands at <b>${pool.size}</b>/${p.cap}${p.effectiveCap < p.cap ? ` <span style="opacity:.7;">(fields ${Math.min(pool.size, p.effectiveCap)} — ${q.band})</span>` : ""}.</div>
        </div>`
      });
    } catch (_e) {}
    ui.notifications?.info?.(`${f.name}: +${q.troops} troops (−${q.costMarks / 10} OP) — pool ${pool.size}/${p.cap}.`);
    try { _api()?.siege?.refreshHud?.(); } catch (_e) {}
    return { ok: true, troops: q.troops, costMarks: q.costMarks, band: q.band, pool: get(f) };
  }

  // ── Peacetime trickle (+10% cap/turn, STABLE/STRETCHED only, up to effective cap) ──
  async function _trickle() {
    if (!game.user?.isGM) return;
    const lines = [];
    for (const a of (game.actors?.contents || [])) {
      try {
        if (a?.getFlag?.(MOD_F, "isFaction") !== true) continue;
        if (!a.flags?.[MOD_R]?.musterPool) continue;            // virtual pools are already full
        const p = get(a);
        if (p.band !== "stable" && p.band !== "stretched") continue;   // overextension = no recovery
        if (p.size >= p.effectiveCap) continue;
        const gain = Math.min(Math.max(1, Math.round(p.cap * 0.10)), p.effectiveCap - p.size);
        await _write(a, { size: p.size + gain });
        lines.push(`${a.name} +${gain} (→ ${p.size + gain}/${p.cap})`);
      } catch (e) { console.warn(TAG, "trickle failed for", a?.name, e); }
    }
    if (lines.length) {
      console.log(TAG, "muster trickle:", lines.join(" · "));
      ui.notifications?.info?.(`Musters replenish: ${lines.join(" · ")}`);
    }
  }

  // ── Install ───────────────────────────────────────────────────────────────────
  function _install() {
    const S = _api()?.siege; if (!S) return false;
    S.pool = { cap, band, effectiveCap, fieldable, clashMoraleMult, get, quote, raiseTroops, debit, credit };
    return true;
  }
  Hooks.once("ready", () => {
    if (!_install()) {
      let n = 0;
      const iv = setInterval(() => { if (_install() || ++n > 40) clearInterval(iv); }, 250);
    }
    if (!globalThis.__bbttcc_siege_muster_pool_trickle_hook) {
      // Defer a tick so the turn driver's fresh logistics.band lands first (same pattern
      // as faction-pressure.enhancer.js).
      Hooks.on("bbttcc:advanceTurn:end", () => { setTimeout(() => { _trickle().catch(e => console.warn(TAG, "trickle threw", e)); }, 50); });
      globalThis.__bbttcc_siege_muster_pool_trickle_hook = true;
    }
    console.log(TAG, "ready — game.bbttcc.api.siege.pool.{get,quote,raiseTroops,debit,credit,…}");
  });

  console.log(TAG, "loaded");
})();
