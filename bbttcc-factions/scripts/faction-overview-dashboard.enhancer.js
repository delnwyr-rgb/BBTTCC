// modules/bbttcc-factions/scripts/faction-overview-dashboard.enhancer.js
// BBTTCC — Faction Overview Dashboard (Hex Chrome cards)
//
// Adds a dark, neon-edged dashboard row to the Overview tab:
// Victory, Unity, Morale, Loyalty, Darkness cards with mini-meters.
//
// Non-invasive: does not change templates or sheet registration.

(() => {
  const MODF = "bbttcc-factions";
  const TAG  = "[bbttcc-fdash]";

  function ensureStyles() {
    if (document.getElementById("bbttcc-fdash-style")) return;

    const s = document.createElement("style");
    s.id = "bbttcc-fdash-style";
    s.textContent = `
      .bbttcc-fdash-row {
        display:flex;
        flex-wrap:wrap;
        gap:0.5rem;
        margin-bottom:0.6rem;
      }
      .bbttcc-fdash-card {
        flex:1 1 140px;
        min-width:140px;
        max-width:220px;
        padding:0.45rem 0.55rem;
        border-radius:0.7rem;
        background:radial-gradient(circle at 0 0, rgba(148,163,184,0.24), rgba(15,23,42,0.96));
        box-shadow:0 0 0 1px rgba(15,23,42,0.85), 0 8px 16px rgba(0,0,0,0.55);
        display:flex;
        flex-direction:column;
        gap:0.25rem;
        font-size:11px;
        color:#e5e7eb;
      }
      .bbttcc-fdash-card .fdash-label {
        text-transform:uppercase;
        letter-spacing:0.08em;
        font-weight:700;
        font-size:10px;
        opacity:0.9;
      }
      .bbttcc-fdash-card .fdash-main {
        display:flex;
        align-items:baseline;
        gap:0.25rem;
      }
      .bbttcc-fdash-card .fdash-value {
        font-size:1.1rem;
        font-weight:700;
      }
      .bbttcc-fdash-card .fdash-unit {
        font-size:10px;
        opacity:0.8;
      }
      .bbttcc-fdash-card .fdash-meta {
        margin-left:auto;
        font-size:10px;
        opacity:0.85;
        display:flex;
        align-items:center;
        gap:0.25rem;
      }
      .bbttcc-fdash-card .fdash-trend {
        font-size:10px;
      }
      .bbttcc-fdash-card .fdash-bar {
        position:relative;
        height:4px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(15,23,42,0.9);
        box-shadow:0 0 0 1px rgba(15,23,42,0.85), inset 0 0 4px rgba(0,0,0,0.65);
      }
      .bbttcc-fdash-card .fdash-bar-fill {
        position:absolute;
        left:0;
        top:0;
        bottom:0;
        width:0%;
        border-radius:999px;
        box-shadow:0 0 6px currentColor;
      }

      .bbttcc-fdash-card.metric-victory {
        border:1px solid rgba(59,130,246,0.9);
        color:#bfdbfe;
      }
      .bbttcc-fdash-card.metric-victory .fdash-bar-fill {
        background:linear-gradient(90deg,#0ea5e9,#22c55e);
      }

      .bbttcc-fdash-card.metric-unity {
        border:1px solid rgba(45,212,191,0.9);
        color:#a5f3fc;
      }
      .bbttcc-fdash-card.metric-unity .fdash-bar-fill {
        background:linear-gradient(90deg,#14b8a6,#3b82f6);
      }

      .bbttcc-fdash-card.metric-morale {
        border:1px solid rgba(234,179,8,0.95);
        color:#facc15;
      }
      .bbttcc-fdash-card.metric-morale .fdash-bar-fill {
        background:linear-gradient(90deg,#facc15,#f97316);
      }

      .bbttcc-fdash-card.metric-loyalty {
        border:1px solid rgba(34,197,94,0.95);
        color:#bbf7d0;
      }
      .bbttcc-fdash-card.metric-loyalty .fdash-bar-fill {
        background:linear-gradient(90deg,#22c55e,#4ade80);
      }

      .bbttcc-fdash-card.metric-darkness {
        border:1px solid rgba(248,113,113,0.95);
        color:#fecaca;
      }
      .bbttcc-fdash-card.metric-darkness .fdash-bar-fill {
        background:linear-gradient(90deg,#f97316,#dc2626);
      }

      .bbttcc-fdash-card .fdash-trend.up {
        color:#22c55e;
      }
      .bbttcc-fdash-card .fdash-trend.down {
        color:#ef4444;
      }
      .bbttcc-fdash-card .fdash-trend.neutral {
        color:#9ca3af;
      }
    `;
    document.head.appendChild(s);
  }

  function readHealthFlags(actor) {
    const victory  = actor.getFlag(MODF, "victory")  || {};
    const darkness = actor.getFlag(MODF, "darkness") || {};
    const morale   = actor.getFlag(MODF, "morale");
    const loyalty  = actor.getFlag(MODF, "loyalty");

    const moraleHome  = actor.getFlag(MODF, "moraleHome");
    const loyaltyHome = actor.getFlag(MODF, "loyaltyHome");

    const darkVal = (typeof darkness.global === "number")
      ? darkness.global
      : (typeof darkness === "number" ? darkness : 0);

    return {
      vp: Number(victory.vp ?? 0),
      unity: Number(victory.unity ?? 0),
      morale: Number(morale ?? 0),
      loyalty: Number(loyalty ?? 0),
      darkness: Number(darkVal ?? 0),
      moraleHome: (typeof moraleHome === "number") ? moraleHome : null,
      loyaltyHome: (typeof loyaltyHome === "number") ? loyaltyHome : null
    };
  }

  function makeTrend(value, home) {
    if (typeof home !== "number" || !Number.isFinite(value)) {
      return { cls: "neutral", label: "—" };
    }
    const delta = value - home;
    if (delta > 1)  return { cls: "up",   label: `▲ ${delta.toFixed(0)}` };
    if (delta < -1) return { cls: "down", label: `▼ ${Math.abs(delta).toFixed(0)}` };
    return { cls: "neutral", label: "■" };
  }

  function buildDashboardHTML(vals) {
    const clamp = (n) => Math.max(0, Math.min(100, n));

    const vpPct       = clamp(vals.vp <= 0 ? 0 : (vals.vp / 25) * 100);
    const unityPct    = clamp(vals.unity);
    const moralePct   = clamp(vals.morale);
    const loyaltyPct  = clamp(vals.loyalty);
    const darknessPct = clamp(vals.darkness);

    const mTrend = makeTrend(vals.morale, vals.moraleHome);
    const lTrend = makeTrend(vals.loyalty, vals.loyaltyHome);

    return `
      <div class="bbttcc-fdash-row" data-bbttcc-fdash="1">
        <div class="bbttcc-fdash-card metric-victory">
          <div class="fdash-label">Victory</div>
          <div class="fdash-main">
            <span class="fdash-value">${vals.vp}</span>
            <span class="fdash-unit">VP</span>
            <div class="fdash-meta">
              <span>${vpPct.toFixed(0)}%</span>
            </div>
          </div>
          <div class="fdash-bar">
            <div class="fdash-bar-fill" style="width:${vpPct}%;"></div>
          </div>
        </div>

        <div class="bbttcc-fdash-card metric-unity">
          <div class="fdash-label">Unity</div>
          <div class="fdash-main">
            <span class="fdash-value">${vals.unity.toFixed(0)}</span>
            <span class="fdash-unit">%</span>
            <div class="fdash-meta">
              <span>${unityPct.toFixed(0)}%</span>
            </div>
          </div>
          <div class="fdash-bar">
            <div class="fdash-bar-fill" style="width:${unityPct}%;"></div>
          </div>
        </div>

        <div class="bbttcc-fdash-card metric-morale">
          <div class="fdash-label">Morale</div>
          <div class="fdash-main">
            <span class="fdash-value">${vals.morale.toFixed(0)}</span>
            <span class="fdash-unit">%</span>
            <div class="fdash-meta">
              <span class="fdash-trend ${mTrend.cls}">${mTrend.label}</span>
            </div>
          </div>
          <div class="fdash-bar">
            <div class="fdash-bar-fill" style="width:${moralePct}%;"></div>
          </div>
        </div>

        <div class="bbttcc-fdash-card metric-loyalty">
          <div class="fdash-label">Loyalty</div>
          <div class="fdash-main">
            <span class="fdash-value">${vals.loyalty.toFixed(0)}</span>
            <span class="fdash-unit">%</span>
            <div class="fdash-meta">
              <span class="fdash-trend ${lTrend.cls}">${lTrend.label}</span>
            </div>
          </div>
          <div class="fdash-bar">
            <div class="fdash-bar-fill" style="width:${loyaltyPct}%;"></div>
          </div>
        </div>

        <div class="bbttcc-fdash-card metric-darkness">
          <div class="fdash-label">Darkness</div>
          <div class="fdash-main">
            <span class="fdash-value">${vals.darkness.toFixed(0)}</span>
            <span class="fdash-unit">pt</span>
            <div class="fdash-meta">
              <span>${darknessPct.toFixed(0)}%</span>
            </div>
          </div>
          <div class="fdash-bar">
            <div class="fdash-bar-fill" style="width:${darknessPct}%;"></div>
          </div>
        </div>
      </div>
    `;
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const actor = app.actor;
      if (!actor) return;

      const root = html[0];
      if (!root) return;

      ensureStyles();

      const overview = root.querySelector(".bbttcc-tab-overview");
      if (!overview) return;

      // Only add once per render instance.
      if (overview.querySelector("[data-bbttcc-fdash]")) return;

      const vals = readHealthFlags(actor);

      // Insert dashboard before the first fieldset (Faction Health).
      const firstFieldset = overview.querySelector("fieldset");
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildDashboardHTML(vals);

      if (firstFieldset && firstFieldset.parentElement) {
        firstFieldset.parentElement.insertBefore(wrapper.firstElementChild, firstFieldset);
      } else {
        overview.prepend(wrapper.firstElementChild);
      }

    } catch (e) {
      console.warn(TAG, "render hook error:", e);
    }
  });

  console.log(TAG, "Faction Overview Dashboard enhancer active.");
})();
