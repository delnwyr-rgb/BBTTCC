// modules/bbttcc-factions/scripts/faction-tier-advance-button.enhancer.js
// BBTTCC — GM Tier Advancement Button (v1.0)
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

  console.log(TAG, "installed");
})();
