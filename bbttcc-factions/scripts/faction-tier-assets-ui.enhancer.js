// modules/bbttcc-factions/scripts/faction-tier-assets-ui.enhancer.js
// BBTTCC — Tier + Assets + Pressure UI (Hex Chrome injection)
//
// Reads:
// - Tier: flags.bbttcc-factions.tier OR derives from victory badgeKey/badge.key
// - Pressure: flags.bbttcc-factions.pressure (written by faction-pressure.enhancer.js)
// - Rigs: flags.bbttcc-factions.rigs (canonical)
// - Facilities: hex.flags.bbttcc-territory.facilities.primary (canonical)
//
// Non-invasive: injects a compact panel near the top of the Overview tab.
// Updated: Danger chips + banners for unpaid upkeep / overextension.

(() => {
  const TAG = "[bbttcc-factions/ui-tier-assets]";
  const MODF = "bbttcc-factions";
  const MODT = "bbttcc-territory";

  const get = (o, p, d) => {
    try { return foundry.utils.getProperty(o, p) ?? d; } catch { return d; }
  };

  const TIER_NAMES = ["Emergent", "Established", "Ascendant", "Dominant", "Mythic"];

  const CAP_BY_TIER = [
    { minor: 0,   major: 0, legendary: 0 }, // T0
    { minor: 2,   major: 0, legendary: 0 }, // T1
    { minor: 3,   major: 1, legendary: 0 }, // T2
    { minor: 999, major: 2, legendary: 1 }, // T3
    { minor: 999, major: 3, legendary: 2 }  // T4
  ];

  function fmtCap(v) { return (v >= 999) ? "∞" : String(v); }

  function tierFromVictoryBadge(actor) {
    const badgeKey =
      String(get(actor, `flags.${MODF}.victory.badge.key`, "") || get(actor, `flags.${MODF}.victory.badgeKey`, "")).toLowerCase();

    if (badgeKey === "ascendant") return 4;
    if (badgeKey === "transcendent") return 3;
    if (badgeKey === "dominant") return 2;
    if (badgeKey === "rising") return 1;
    return 0;
  }

  function readTier(actor) {
    const raw = get(actor, `flags.${MODF}.tier`, null);
    if (raw === null || raw === undefined) return tierFromVictoryBadge(actor);
    const n = Number(raw);
    if (!Number.isFinite(n)) return tierFromVictoryBadge(actor);
    return Math.max(0, Math.min(4, Math.floor(n)));
  }

  function bandTextFromNum(n) {
    if (n <= 0) return "STABLE";
    if (n === 1) return "STRETCHED";
    if (n === 2) return "STRAINED";
    return "CRITICAL";
  }

  function riskText(r) {
    const k = String(r || "low").toLowerCase();
    if (k === "high") return "HIGH";
    if (k === "medium") return "MED";
    return "LOW";
  }

  function ensureStyles() {
    if (document.getElementById("bbttcc-tier-assets-style")) return;
    const s = document.createElement("style");
    s.id = "bbttcc-tier-assets-style";
    s.textContent = `
      .bbttcc-tier-assets-wrap{
        margin: .35rem 0 .65rem 0;
        padding: .6rem .7rem;
        border-radius: 14px;
        background: radial-gradient(circle at 0 0, rgba(148,163,184,0.18), rgba(15,23,42,0.92));
        box-shadow: 0 0 0 1px rgba(15,23,42,0.85), 0 8px 16px rgba(0,0,0,0.45);
        color: #e5e7eb;
        display:flex;
        flex-direction:column;
        gap:.45rem;
      }

      .bbttcc-tier-row{display:flex; gap:.6rem; align-items:center; flex-wrap:wrap;}
      .bbttcc-tier-badge{
        padding:.25rem .55rem;
        border-radius:999px;
        font-weight:800;
        letter-spacing:.06em;
        font-size:11px;
        border:1px solid rgba(59,130,246,0.7);
        background: rgba(30,58,138,0.35);
      }
      .bbttcc-tier-sub{opacity:.8; font-size:11px;}
      .bbttcc-cap-strip{
        margin-left:auto;
        display:flex;
        gap:.55rem;
        font-size:11px;
        opacity:.9;
      }
      .bbttcc-cap-strip b{font-weight:800;}

      /* ---- pressure chips ---- */
      .bbttcc-pressure{
        display:flex;
        gap:.55rem;
        align-items:center;
        font-size:11px;
        opacity:.98;
        flex-wrap:wrap;
      }
      .bbttcc-chip{
        padding:.18rem .50rem;
        border-radius:999px;
        border:1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06);
        font-weight:800;
        letter-spacing:.02em;
        display:inline-flex;
        align-items:center;
        gap:.35rem;
        user-select:none;
      }

      /* severity styles */
      .bbttcc-chip.ok {
        border-color: rgba(34,197,94,0.55);
        box-shadow: 0 0 10px rgba(34,197,94,0.10);
      }
      .bbttcc-chip.warn {
        border-color: rgba(234,179,8,0.75);
        box-shadow: 0 0 12px rgba(234,179,8,0.18);
      }
      .bbttcc-chip.danger {
        border-color: rgba(248,113,113,0.90);
        box-shadow: 0 0 14px rgba(248,113,113,0.28);
        background: radial-gradient(circle at 0 0, rgba(248,113,113,0.28), rgba(255,255,255,0.04));
      }
      .bbttcc-chip.doom {
        border-color: rgba(244,63,94,0.95);
        box-shadow: 0 0 18px rgba(244,63,94,0.35);
        background: radial-gradient(circle at 0 0, rgba(244,63,94,0.34), rgba(2,6,23,0.22));
      }

      .bbttcc-danger-banner{
        border-radius: 12px;
        padding: .45rem .6rem;
        border: 1px solid rgba(244,63,94,0.85);
        background: radial-gradient(circle at 0 0, rgba(244,63,94,0.22), rgba(2,6,23,0.12));
        box-shadow: 0 0 18px rgba(244,63,94,0.20);
        font-size: 11px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:.5rem;
      }
      .bbttcc-danger-banner b{letter-spacing:.05em;}
      .bbttcc-danger-banner .hint{opacity:.85;}
      .bbttcc-muted2{opacity:.65;}

      .bbttcc-assets-mini{
        display:grid;
        grid-template-columns: 1fr;
        gap:.25rem;
        font-size:11px;
      }
      .bbttcc-asset-line{opacity:.92;}
      .bbttcc-asset-state{opacity:.8; font-style:italic;}

      .bbttcc-asset-actions{display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.15rem;}
      .bbttcc-mini-btn{
        border-radius:999px;
        padding: 0 .5rem;
        font-size: 11px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(37, 99, 235, 0.9);
        color: #e5e7eb;
        cursor:pointer;
      }
      .bbttcc-mini-btn:hover{
        background: rgba(30, 64, 175, 0.95);
        border-color: #38bdf8;
      }
    `;
    document.head.appendChild(s);
  }

  function summarizeRigs(actor) {
    const rigs = get(actor, `flags.${MODF}.rigs`, []);
    const arr = Array.isArray(rigs) ? rigs : [];
    const lines = arr.slice(0, 5).map(r => {
      const name = String(r?.name || "Rig");
      const dmg  = String(r?.damageState || r?.damageStep || "intact");
      return `• ${foundry.utils.escapeHTML(name)} <span class="bbttcc-asset-state">(${foundry.utils.escapeHTML(dmg)})</span>`;
    });
    const extra = arr.length > 5 ? `… +${arr.length - 5} more` : "";
    return { count: arr.length, lines, extra };
  }

  const MAJOR_FACILITY_TYPES = new Set(["bunker", "tower", "castle"]);

  function scanFacilitiesForFaction(actor) {
    const fid = actor.id;
    const rows = [];

    for (const sc of game.scenes?.contents ?? []) {
      for (const dr of sc.drawings?.contents ?? []) {
        const tf = dr.flags?.[MODT];
        if (!tf) continue;

        const owner = String(tf.factionId || tf.ownerId || "");
        if (owner !== String(fid)) continue;

        const primary = tf.facilities?.primary;
        if (!primary) continue;

        const facilityType = String(primary.facilityType || "facility").toLowerCase().trim();
        const tier = Number(primary.tier ?? 1) || 1;

        const hexName = String(tf.name || dr.text || dr.name || "Hex").trim();
        const hexUuid = dr.uuid;

        rows.push({
          facilityType,
          tier,
          class: MAJOR_FACILITY_TYPES.has(facilityType) ? "major" : "minor",
          hexName,
          hexUuid
        });
      }
    }

    return rows;
  }

  function summarizeFacilities(actor) {
    const rows = scanFacilitiesForFaction(actor);
    const count = rows.length;
    const lines = rows.slice(0, 4).map(r => {
      const tag = r.class === "major" ? "Major" : "Minor";
      return `• ${foundry.utils.escapeHTML(r.facilityType)} <span class="bbttcc-muted2">(T${r.tier} • ${tag})</span> — ${foundry.utils.escapeHTML(r.hexName)}`;
    });
    const extra = count > 4 ? `… +${count - 4} more` : "";
    return { count, lines, extra, rows };
  }

  async function openFacilityConsole(hexUuid) {
    try {
      const Ctor = game.bbttcc?.apps?.FacilityConsole;
      if (!Ctor) {
        ui.notifications?.warn?.("Facility Console not registered.");
        return;
      }
      const app = new Ctor({ hexUuid });
      app.render(true, { focus: true });
    } catch (e) {
      console.warn(TAG, "openFacilityConsole failed", e);
    }
  }

  function chipClassForOverext(bandNum) {
    if (bandNum <= 0) return "ok";
    if (bandNum === 1) return "warn";
    if (bandNum === 2) return "danger";
    return "doom";
  }

  function chipClassForUpkeep(unpaid) {
    return unpaid ? "doom" : "ok";
  }

  function chipClassForRisk(risk) {
    const r = String(risk || "low").toLowerCase();
    if (r === "high") return "doom";
    if (r === "medium") return "danger";
    return "ok";
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const actor = app.actor;
      if (!actor) return;

      ensureStyles();

      const root = html?.[0];
      if (!root) return;

      const assetsTab = root.querySelector(".bbttcc-tab-assets");
      const overviewFallback = root.querySelector(".bbttcc-tab-overview");
      const host = assetsTab || overviewFallback || root.querySelector(".bbttcc-faction-body");
      if (!host) return;

      if (host.querySelector("[data-bbttcc-tier-assets='1']")) return;

      const tier = readTier(actor);
      const tierName = TIER_NAMES[tier] || "Emergent";
      const caps = CAP_BY_TIER[tier] || CAP_BY_TIER[0];

      const pressure = get(actor, `flags.${MODF}.pressure`, {}) || {};
      const bandNum = Number(pressure.overextensionBand || 0);
      const unpaid = !!pressure.unpaidUpkeep;
      const risk = String(pressure.risk || "low");

      const rigsSum = summarizeRigs(actor);
      const facSum  = summarizeFacilities(actor);

      const minorUsed = facSum.rows.filter(r => r.class === "minor").length;
      const majorUsed = rigsSum.count + facSum.rows.filter(r => r.class === "major").length;

      const overTxt = bandTextFromNum(bandNum);
      const riskTxt = riskText(risk);

      const overCls = chipClassForOverext(bandNum);
      const upkCls  = chipClassForUpkeep(unpaid);
      const rskCls  = chipClassForRisk(risk);

      const dangerOn = unpaid || bandNum >= 2;

      const wrap = document.createElement("div");
      wrap.className = "bbttcc-tier-assets-wrap";
      wrap.dataset.bbttccTierAssets = "1";

      wrap.innerHTML = `
        <div class="bbttcc-tier-row">
          <span class="bbttcc-tier-badge" title="Faction Tier (growth & unlock band)">T${tier} — ${tierName}</span>
          <span class="bbttcc-tier-sub">Assets & Pressure</span>
          <div class="bbttcc-cap-strip" title="Asset Capacity (from Tier)">
            <span>Minor <b>${minorUsed}/${fmtCap(caps.minor)}</b></span>
            <span>Major <b>${majorUsed}/${fmtCap(caps.major)}</b></span>
            <span>Legendary <b>0/${fmtCap(caps.legendary)}</b></span>
          </div>
        </div>

        ${dangerOn ? `
          <div class="bbttcc-danger-banner">
            <div>
              <b>⚠ DANGER</b>
              <span class="hint">Supply stress is active.</span>
            </div>
            <div class="bbttcc-muted2">
              ${unpaid ? "UNPAID UPKEEP" : "OVEREXTENSION"} • ${String(pressure.logisticsBand || "").toUpperCase()}
            </div>
          </div>
        ` : ``}

        <div class="bbttcc-pressure" title="Overextension is computed by the Turn Driver; unpaid upkeep is detected from garrison_upkeep war logs.">
          <span class="bbttcc-chip ${overCls}">☰ Overext: ${overTxt}</span>
          <span class="bbttcc-chip ${upkCls}">${unpaid ? "⚠" : "✓"} Upkeep: ${unpaid ? "UNPAID" : "OK"}</span>
          <span class="bbttcc-chip ${rskCls}">${risk === "high" ? "☠" : "!"} Risk: ${riskTxt}</span>
          <span class="bbttcc-muted2" style="margin-left:auto;">(${foundry.utils.escapeHTML(String(pressure.logisticsBand||"")).toUpperCase()})</span>
        </div>

        <div class="bbttcc-assets-mini">
          <div class="bbttcc-asset-line"><b>Rigs:</b> ${rigsSum.count} ${rigsSum.extra ? `<span class="bbttcc-muted2">${rigsSum.extra}</span>` : ""}</div>
          ${rigsSum.lines.length ? `<div class="bbttcc-muted2">${rigsSum.lines.join("<br/>")}</div>` : `<div class="bbttcc-muted2">• none</div>`}

          <div style="height:.25rem;"></div>

          <div class="bbttcc-asset-line"><b>Facilities:</b> ${facSum.count} ${facSum.extra ? `<span class="bbttcc-muted2">${facSum.extra}</span>` : ""}</div>
          ${facSum.lines.length ? `<div class="bbttcc-muted2">${facSum.lines.join("<br/>")}</div>` : `<div class="bbttcc-muted2">• none detected</div>`}
          ${game.user?.isGM && facSum.rows.length ? `
            <div class="bbttcc-asset-actions">
              ${facSum.rows.slice(0,3).map(r => `<button type="button" class="bbttcc-mini-btn" data-open-facility="${foundry.utils.escapeHTML(r.hexUuid)}">Open ${foundry.utils.escapeHTML(r.facilityType)}</button>`).join("")}
            </div>
          ` : ``}
        </div>
      `;

      if (game.user?.isGM) {
        wrap.addEventListener("click", (ev) => {
          const btn = ev.target?.closest?.("[data-open-facility]");
          if (!btn) return;
          ev.preventDefault();
          const hexUuid = btn.getAttribute("data-open-facility");
          if (hexUuid) openFacilityConsole(hexUuid);
        });
      }

      const firstFieldset = host.querySelector("fieldset");
      if (firstFieldset && firstFieldset.parentElement) {
        firstFieldset.parentElement.insertBefore(wrap, firstFieldset);
      } else {
        host.prepend(wrap);
      }

    } catch (e) {
      console.warn(TAG, "render hook failed", e);
    }
  });

  console.log(TAG, "installed (danger UI enabled)");
})();
