// modules/bbttcc-factions/scripts/faction-tier-advance-button.enhancer.js
// Bad Eden — GM Tier Advancement Button (v1.0)
//
// Adds a GM-only "Advance Tier" button to the Faction Sheet.
// Sheet cleanup compatibility pass: prefer Assets tab / GM admin area placement in the refactored five-tab layout.
// Behavior:
// - Calls getTierAdvancementReport()
// - If blocked → shows a read-only report dialog
// - If allowed → increments flags.bbttcc-factions.tier by +1
//   and writes a War Log entry
//
// No auto-advancement. No side effects. Alpha-safe.

(() => {
  const TAG  = "[bbttcc-factions/tier-advance-btn]";
  const MODF = "bbttcc-factions";

  // OP cap bands per bucket, in MARKS (1 OP = 10 marks) — mirrors op-engine's
  // tier-derived bands. T0=50, T1=70, T2=90, T3=110, T4=130.
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const CAP_BAND = [50, 70, 90, 110, 130];

  // Raise explicit per-bucket opCaps to at least the tier band. Explicit
  // opCaps shadow the tier-derived bands in op-engine's _readCaps forever —
  // so a faction that set caps at creation never felt a tier-up (playtest
  // 2026-06-06: Tier 2 faction stuck at its old max). max() preserves any
  // custom bucket already raised ABOVE the band. Idempotent; never lowers.
  async function raiseOpCapsToTierBand(actor, tier) {
    const t = Math.max(0, Math.min(4, Math.floor(Number(tier) || 0)));
    const band = CAP_BAND[t] ?? CAP_BAND[0];
    const raw = get(actor, `flags.${MODF}.opCaps`, null);
    if (!raw || typeof raw !== "object") return false; // no explicit caps → derived path already follows tier
    const next = {};
    let changed = false;
    for (const k of OP_KEYS) {
      const cur = Math.max(0, Math.floor(Number(raw[k]) || 0));
      const v = Math.max(cur, band);
      next[k] = v;
      if (v !== cur) changed = true;
    }
    if (!changed) return false;
    await actor.update({ [`flags.${MODF}.opCaps`]: next });
    console.log(TAG, `opCaps raised to T${t} band (${band} marks/bucket) for ${actor.name}`);
    return true;
  }

  // GM "set tier" (2026-09-08, owner request): the ONE way to write tier
  // outside the gated +1 button. Raising: caps rise to the band (max, like
  // the button). Lowering: caps fall to the band but never below what is
  // banked — no confiscation (the green-ring reset's rule). Writes a War Log
  // milestone. Returns { ok, from, to, capsChanged, floorWarning } — the
  // Director's factionTierFloor re-promotes any coalition faction below it
  // on the next turn tick, so the caller is told when that will happen.
  async function setTier(actor, tier, opts = {}) {
    if (!actor || !isFactionActor(actor)) return { ok: false, reason: "not a faction" };
    if (!isGM()) return { ok: false, reason: "GM only" };
    const to = Math.max(0, Math.min(4, Math.floor(Number(tier) || 0)));
    const from = Math.max(0, Math.min(4, Math.floor(Number(get(actor, `flags.${MODF}.tier`, 0)) || 0)));
    const update = { [`flags.${MODF}.tier`]: to };
    let capsChanged = false;
    const raw = get(actor, `flags.${MODF}.opCaps`, null);
    if (raw && typeof raw === "object") {
      const band = CAP_BAND[to] ?? CAP_BAND[0];
      const bank = get(actor, `flags.${MODF}.opBank`, {}) || {};
      const next = {};
      for (const k of OP_KEYS) {
        const cur = Math.max(0, Math.floor(Number(raw[k]) || 0));
        const banked = Math.ceil(Math.max(0, Number(bank[k]) || 0));
        const v = (to >= from) ? Math.max(cur, band) : Math.max(band, banked);
        next[k] = v;
        if (v !== cur) capsChanged = true;
      }
      if (capsChanged) update[`flags.${MODF}.opCaps`] = next;
    }
    if (to === from && !capsChanged) return { ok: true, from, to, capsChanged: false, unchanged: true };
    if (to !== from) {
      const warLogs = (get(actor, `flags.${MODF}.warLogs`, []) || []).slice();
      warLogs.push({
        type: "milestone",
        activity: to > from ? "tier_advance" : "tier_reduce",
        date: (new Date()).toLocaleString(),
        summary: `GM set Faction Tier ${from} → ${to}${opts.note ? ` — ${opts.note}` : ""}.`
      });
      update[`flags.${MODF}.warLogs`] = warLogs;
    }
    await actor.update(update);
    let floorWarning = null;
    try {
      const floor = Number(game.bbttcc?.api?.campaign?.director?.state?.()?.factionTierFloor) || 0;
      if (to < floor) floorWarning = `Story Director tier floor is ${floor} — this faction will be re-raised on the next turn tick unless the floor is lowered (Reset Console → World → factionTierFloor).`;
    } catch (_e) {}
    console.log(TAG, `setTier ${actor.name}: ${from} → ${to}${capsChanged ? " (opCaps rebanded)" : ""}`);
    try { actor.sheet?.render(false); } catch (_e) {}
    return { ok: true, from, to, capsChanged, floorWarning };
  }

  Hooks.once("ready", () => {
    try {
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};
      const root = (game.bbttcc.api.factions ??= {});
      root.tier = Object.assign(root.tier || {}, {
        get: (actor) => Math.max(0, Math.min(4, Math.floor(Number(get(actor, `flags.${MODF}.tier`, 0)) || 0))),
        set: setTier,
        band: CAP_BAND.slice()
      });
    } catch (e) { console.warn(TAG, "tier api install failed", e); }
  });

  const esc = (s) => {
    try { return foundry.utils.escapeHTML(String(s ?? "")); }
    catch { return String(s ?? ""); }
  };

  const get = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  };

  function isFactionActor(a) {
    try { return a?.getFlag?.(MODF, "isFaction") === true; } catch { return false; }
  }

  function isGM() {
    return !!game.user?.isGM;
  }

  function formatGateBlock(title, gate) {
    if (!gate) return "";
    const ok = gate.ok ? "✓" : "✗";
    const reasons = (gate.reasons && gate.reasons.length)
      ? `<ul>${gate.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>`
      : `<div class="bbttcc-muted">No issues.</div>`;
    return `
      <div class="bbttcc-tier-gate">
        <h4>${ok} ${esc(title)}</h4>
        ${reasons}
      </div>
    `;
  }

  async function showReportDialog(actor) {
    const api = game.bbttcc?.api?.factions;
    if (!api?.getTierAdvancementReport) {
      ui.notifications?.error?.("Tier Advancement API not available.");
      return;
    }

    const rep = await api.getTierAdvancementReport(actor.id);
    if (!rep || !rep.ok) {
      ui.notifications?.error?.("Could not compute tier advancement report.");
      return;
    }

    const content = `
      <div class="bbttcc-tier-report">
        <p>
          <b>${esc(rep.actorName)}</b><br/>
          Current Tier: <b>T${rep.tier}</b> → Next Tier: <b>T${rep.nextTier}</b>
        </p>

        ${formatGateBlock("Stability", rep.gates?.stability)}
        ${formatGateBlock("Reach", rep.gates?.reach)}
        ${formatGateBlock("Identity", rep.gates?.identity)}
      </div>
    `;

    new Dialog({
      title: "Tier Advancement Report",
      content,
      buttons: {
        ok: { label: "Close" }
      },
      default: "ok"
    }).render(true);
  }

  async function attemptAdvanceTier(actor) {
    const api = game.bbttcc?.api?.factions;
    if (!api?.getTierAdvancementReport) {
      ui.notifications?.error?.("Tier Advancement API not available.");
      return;
    }

    const rep = await api.getTierAdvancementReport(actor.id);
    if (!rep || !rep.ok) {
      ui.notifications?.error?.("Could not compute tier advancement report.");
      return;
    }

    if (!rep.canAdvance) {
      await showReportDialog(actor);
      return;
    }

    const curTier = Number(get(actor, `flags.${MODF}.tier`, 0)) || 0;
    const nextTier = rep.nextTier;

    await actor.update({
      [`flags.${MODF}.tier`]: nextTier
    });

    // Tier-up raises the OP ceiling (playtest 2026-06-06) — without this,
    // explicit opCaps from faction creation shadow the new tier band forever.
    try { await raiseOpCapsToTierBand(actor, nextTier); }
    catch (e) { console.warn(TAG, "opCaps raise failed (non-fatal)", e); }

    // Write War Log entry
    const warLogs = get(actor, `flags.${MODF}.warLogs`, []) || [];
    warLogs.push({
      type: "milestone",
      activity: "tier_advance",
      date: (new Date()).toLocaleString(),
      summary: `Faction advanced from Tier ${curTier} → Tier ${nextTier}.`
    });

    await actor.update({
      [`flags.${MODF}.warLogs`]: warLogs
    });

    ui.notifications?.info?.(`${actor.name} advanced to Tier ${nextTier}.`);
    actor.sheet?.render(true);
  }

  function ensureStyles() {
    if (document.getElementById("bbttcc-tier-advance-style")) return;
    const s = document.createElement("style");
    s.id = "bbttcc-tier-advance-style";
    s.textContent = `
      .bbttcc-tier-advance-wrap {
        margin-top: .4rem;
        display:flex;
        justify-content:flex-end;
      }
      .bbttcc-tier-advance-btn {
        border-radius:999px;
        padding: .25rem .7rem;
        font-size:11px;
        font-weight:800;
        letter-spacing:.05em;
        background: radial-gradient(circle at 0 0, #0ea5e9, #1d4ed8 45%, #020617 100%);
        color:#e5e7eb;
        border:1px solid rgba(56,189,248,0.8);
        cursor:pointer;
      }
      .bbttcc-tier-advance-btn:hover {
        box-shadow:0 0 14px rgba(56,189,248,0.6);
      }
      .bbttcc-tier-report h4 {
        margin: .5rem 0 .2rem 0;
        font-size:12px;
      }
      .bbttcc-tier-report ul {
        margin:.2rem 0 .4rem .9rem;
        padding:0;
      }
      .bbttcc-muted { opacity:.7; font-size:11px; }
    `;
    document.head.appendChild(s);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      if (!isGM()) return;
      const actor = app.actor;
      if (!actor || !isFactionActor(actor)) return;

      ensureStyles();

      const root = html?.[0];
      if (!root) return;

      // Place button in the new Assets tab first, then near the Tier / Assets panel,
      // then fall back to Overview for transitional layouts.
      let anchor =
        root.querySelector('.bbttcc-tab-assets [data-bbttcc-tier-advance-anchor]') ||
        root.querySelector('.bbttcc-tab-assets') ||
        root.querySelector('.bbttcc-tier-assets-wrap') ||
        root.querySelector('.bbttcc-tab-overview .bbttcc-gm-edit') ||
        root.querySelector('.bbttcc-tab-overview') ||
        root;

      if (!anchor || anchor.querySelector("[data-bbttcc-tier-advance='1']")) return;

      const wrap = document.createElement("div");
      wrap.className = "bbttcc-tier-advance-wrap";
      wrap.dataset.bbttccTierAdvance = "1";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bbttcc-tier-advance-btn";
      btn.textContent = "Advance Tier (GM)";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await attemptAdvanceTier(actor);
      });

      wrap.appendChild(btn);

      // Insert after anchor
      anchor.appendChild(wrap);

    } catch (e) {
      console.warn(TAG, "render hook failed:", e);
    }
  });

  // One-shot GM-side repair (2026-06-06): factions that advanced tier BEFORE
  // the opCaps raise existed are stuck at their creation-era ceiling (the
  // playtest Tier 2 faction capped at 510 marks). Sweep all faction actors and
  // raise any explicit opCaps bucket below the current tier band. Idempotent —
  // max() only, never lowers, logs what it touched.
  Hooks.once("ready", async () => {
    try {
      if (!game.user?.isGM) return;
      for (const actor of game.actors ?? []) {
        if (!isFactionActor(actor)) continue;
        const tier = Number(get(actor, `flags.${MODF}.tier`, 0)) || 0;
        if (tier <= 0) continue;
        try {
          const raised = await raiseOpCapsToTierBand(actor, tier);
          if (raised) ui.notifications?.info?.(`${actor.name}: OP pool max raised to its Tier ${tier} band.`);
        } catch (e) { console.warn(TAG, "repair sweep failed for", actor.name, e); }
      }
    } catch (e) { console.warn(TAG, "opCaps repair sweep failed:", e); }
  });

  console.log(TAG, "installed");
})();
