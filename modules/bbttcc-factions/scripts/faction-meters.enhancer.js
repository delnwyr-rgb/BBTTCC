// bbttcc-factions/enhancers/faction-meters.enhancer.js
// Wireframe-aligned Loyalty meter for the Bad Eden Faction Sheet.
// Overview-only injector: keeps the meter out of retained/global sheet chrome.
//
// Faction Morale RETIRED 2026-10-18 (ruling 19): the Morale half of the strip is gone and
// setMorale / bumpMorale stay on the API only as tolerant no-ops (they return the stored
// value without writing) so stale callers never throw.
//
// Flags read (0–100 clamped):
// - flags['bbttcc-factions'].loyalty
//
// Helpers exposed:
// - game.bbttcc.api.factions.setLoyalty({ factionId, value })
// - game.bbttcc.api.factions.bumpLoyalty({ factionId, delta })
// - game.bbttcc.api.factions.setMorale / bumpMorale — retired no-ops (see above)
//
(() => {
  const TAG = "[bbttcc-factions/faction-meters]";
  const MOD = "bbttcc-factions";

  const clamp01 = (v)=>Math.min(100, Math.max(0, Number(v||0)));
  const get = (obj, path, dflt) => { try { return foundry.utils.getProperty(obj, path) ?? dflt; } catch { return dflt; } };

  function styleTag() {
    return /* html */`
    <style id="bbttcc-ml-style">
      .bbttcc-ml-strip{display:flex;gap:.75rem;align-items:center;margin:.1rem 0 .75rem 0;padding:0 .1rem}
      .bbttcc-ml-meter{flex:1;display:flex;flex-direction:column;gap:.25rem;min-width:12rem}
      .bbttcc-ml-label{display:flex;align-items:center;justify-content:space-between;font-size:.95rem;font-weight:700;opacity:.95}
      .bbttcc-ml-bar{position:relative;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
      .bbttcc-ml-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
      .bbttcc-ml-loyalty .bbttcc-ml-fill{background:linear-gradient(90deg,#93c5fd,#60a5fa,#2563eb)}
      .bbttcc-ml-val{font-weight:700;opacity:.95}
    </style>`;
  }

  function buildStrip({ loyalty=0 }={}){
    loyalty = clamp01(loyalty);
    const lPct = Math.round(loyalty);
    return /* html */`
      <div class="bbttcc-ml-strip" id="bbttcc-ml-strip" data-bbttcc-overview-meters="true">
        <div class="bbttcc-ml-meter bbttcc-ml-loyalty" title="Population cooperation and internal cohesion.">
          <div class="bbttcc-ml-label"><span>Loyalty</span><span class="bbttcc-ml-val">${lPct}%</span></div>
          <div class="bbttcc-ml-bar"><div class="bbttcc-ml-fill" style="width:${lPct}%"></div></div>
        </div>
      </div>
    `;
  }

  function findOverviewTarget($html) {
    const overview = $html.find('.bbttcc-tab[data-tab="overview"], .bbttcc-tab-overview').first();
    if (!overview.length) return null;

    const anchor = overview.find('[data-bbttcc-overview-meters-anchor="true"], [data-bbttcc-overview-meters-anchor]').first();
    if (anchor.length) return { mode: 'anchor', node: anchor };

    const dashboard = overview.find('[data-bbttcc-overview-dashboard], .bbttcc-overview-dashboard').first();
    if (dashboard.length) return { mode: 'after', node: dashboard };

    const opBankFieldset = overview.find('fieldset legend').filter(function(){
      return String($(this).text() || '').trim().toLowerCase() === 'op bank';
    }).first();
    if (opBankFieldset.length) return { mode: 'after', node: opBankFieldset.closest('fieldset') };

    const healthFieldset = overview.find('fieldset legend').filter(function(){
      const txt = String($(this).text() || '').trim().toLowerCase();
      return txt === 'faction health' || txt === 'pressure';
    }).first();
    if (healthFieldset.length) return { mode: 'before', node: healthFieldset.closest('fieldset') };

    const firstFieldset = overview.find('fieldset').first();
    if (firstFieldset.length) return { mode: 'before', node: firstFieldset };

    return { mode: 'prepend', node: overview };
  }

  function injectMeters(app, html) {
    try {
      const isOurSheet = app?.constructor?.name?.includes?.("BBTTCCFactionSheet") || html?.closest?.(".bbttcc-faction-sheet")?.length;
      if (!isOurSheet) return;
      const A = app.actor;
      const loyalty = get(A, `flags.${MOD}.loyalty`, undefined);
      const loyalty2 = get(A, `flags.${MOD}.${MOD}.loyalty`, undefined);
      const loyaltyV = (loyalty !== undefined) ? loyalty : (loyalty2 !== undefined ? loyalty2 : 0);

      if (!document.querySelector("#bbttcc-ml-style")) {
        document.head.insertAdjacentHTML("beforeend", styleTag());
      }

      const $html = html instanceof jQuery ? html : $(html);
      $html.find('#bbttcc-ml-strip, [data-bbttcc-overview-meters="true"]').remove();

      const target = findOverviewTarget($html);
      if (!target?.node?.length) return;

      const strip = buildStrip({ loyalty: loyaltyV });
      if (target.mode === 'anchor') {
        target.node.replaceWith(strip);
      } else if (target.mode === 'after') {
        target.node.after(strip);
      } else if (target.mode === 'before') {
        target.node.before(strip);
      } else {
        target.node.prepend(strip);
      }
    } catch (e) {
      console.warn(TAG, "injectMeters failed", e);
    }
  }

  function installHelpers(){
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.factions ??= {};

    const setVal = async (A, key, value) => {
      const v = clamp01(value);
      await A.update({ [`flags.${MOD}.${key}`]: v });
      const war = get(A, `flags.${MOD}.warLogs`, []);
      war.push({ type:"turn", date:(new Date()).toLocaleString(), summary:`${key.charAt(0).toUpperCase()+key.slice(1)} set to ${v}%` });
      await A.update({ [`flags.${MOD}.warLogs`]: war });
      if (A.sheet?.rendered) A.sheet.render(false);   // refresh an OPEN sheet only — never pop a closed one on programmatic loyalty changes
      return v;
    };
    const bumpVal = async (A, key, delta) => {
      const cur = Number(get(A, `flags.${MOD}.${key}`, 0))||0;
      return setVal(A, key, cur + Number(delta||0));
    };

    // RETIRED 2026-10-18 (ruling 19): faction Morale is no longer a game meter. These two stay on
    // the API as tolerant no-ops — no flag write, no warLog line — and return whatever value the
    // actor still carries (0 if none / unknown faction) so any stale caller keeps working.
    const retiredMorale = ({ factionId } = {}) => {
      if (!retiredMorale.__warned) { retiredMorale.__warned = true; console.debug(TAG, "setMorale/bumpMorale are retired (ruling 19, 2026-10-18) — ignored"); }
      const A = game.actors.get(String(factionId));
      return clamp01(A ? get(A, `flags.${MOD}.morale`, 0) : 0);
    };
    game.bbttcc.api.factions.setMorale = async (args) => retiredMorale(args);
    game.bbttcc.api.factions.setLoyalty = async ({ factionId, value }) => {
      const A = game.actors.get(String(factionId)); if (!A) throw new Error("Bad factionId");
      return setVal(A, "loyalty", value);
    };
    game.bbttcc.api.factions.bumpMorale = async (args) => retiredMorale(args);
    game.bbttcc.api.factions.bumpLoyalty = async ({ factionId, delta }) => {
      const A = game.actors.get(String(factionId)); if (!A) throw new Error("Bad factionId");
      return bumpVal(A, "loyalty", delta);
    };
  }

  Hooks.on("renderActorSheet", injectMeters);
  Hooks.once("ready", installHelpers);
  if (game?.ready) installHelpers();

  console.log(TAG, "installed");
})();
