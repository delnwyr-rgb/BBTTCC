// bbttcc-factions/enhancers/faction-meters.enhancer.js
// Adds read-only Morale and Loyalty meters to the BBTTCC Faction Sheet.
// Non-breaking, single-file enhancer: injects a UI strip on sheet render and exposes small helpers.
//
// Flags read (0–100 clamped):
// - flags['bbttcc-factions'].morale
// - flags['bbttcc-factions'].loyalty
//
// Helpers exposed:
// - game.bbttcc.api.factions.setMorale({ factionId, value })
// - game.bbttcc.api.factions.setLoyalty({ factionId, value })
// - game.bbttcc.api.factions.bumpMorale({ factionId, delta })
// - game.bbttcc.api.factions.bumpLoyalty({ factionId, delta })
//
(() => {
  const TAG = "[bbttcc-factions/faction-meters]";
  const MOD = "bbttcc-factions";

  const clamp01 = (v)=>Math.min(100, Math.max(0, Number(v||0)));
  const get = (obj, path, dflt) => { try { return foundry.utils.getProperty(obj, path) ?? dflt; } catch { return dflt; } };

  function styleTag() {
    return /* html */`
    <style id="bbttcc-ml-style">
      .bbttcc-ml-strip{display:flex;gap:.75rem;align-items:center;margin:.25rem 0 .5rem 0}
      .bbttcc-ml-meter{flex:1;display:flex;flex-direction:column;gap:.25rem;min-width:12rem}
      .bbttcc-ml-label{display:flex;align-items:center;justify-content:space-between;font-size:.85rem;opacity:.9}
      .bbttcc-ml-bar{position:relative;height:10px;border-radius:999px;background:#e5e7eb;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
      .bbttcc-ml-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
      .bbttcc-ml-morale .bbttcc-ml-fill{background:linear-gradient(90deg,#fca5a5,#f59e0b,#4ade80)} /* red→amber→green */
      .bbttcc-ml-loyalty .bbttcc-ml-fill{background:linear-gradient(90deg,#93c5fd,#60a5fa,#2563eb)} /* light→deep blue */
      .bbttcc-ml-val{font-weight:600;opacity:.9}
      .bbttcc-ml-hint{font-size:.8rem;opacity:.65}
    </style>`;
  }

  function buildStrip({ morale=0, loyalty=0 }={}){
    morale = clamp01(morale); loyalty = clamp01(loyalty);
    const mPct = Math.round(morale);
    const lPct = Math.round(loyalty);
    return /* html */`
      <div class="bbttcc-ml-strip" id="bbttcc-ml-strip">
        <div class="bbttcc-ml-meter bbttcc-ml-morale" title="Overall battlefield spirit and willingness to press the attack.">
          <div class="bbttcc-ml-label"><span>Morale</span><span class="bbttcc-ml-val">${mPct}%</span></div>
          <div class="bbttcc-ml-bar"><div class="bbttcc-ml-fill" style="width:${mPct}%"></div></div>
        </div>
        <div class="bbttcc-ml-meter bbttcc-ml-loyalty" title="Population cooperation and internal cohesion.">
          <div class="bbttcc-ml-label"><span>Loyalty</span><span class="bbttcc-ml-val">${lPct}%</span></div>
          <div class="bbttcc-ml-bar"><div class="bbttcc-ml-fill" style="width:${lPct}%"></div></div>
        </div>
      </div>
    `;
  }

  function injectMeters(app, html) {
    try {
      // only act on our sheet
      const isOurSheet = app?.constructor?.name?.includes?.("BBTTCCFactionSheet") || html?.closest(".bbttcc-faction-sheet").length;
      if (!isOurSheet) return;
      const A = app.actor;
      const morale = get(A, `flags.${MOD}.morale`, 0);
      const loyalty = get(A, `flags.${MOD}.loyalty`, 0);

      // ensure style only once per document
      if (!document.querySelector("#bbttcc-ml-style")) {
        document.head.insertAdjacentHTML("beforeend", styleTag());
      }

      const $html = html instanceof jQuery ? html : $(html);
      const header = $html.find(".sheet-header").first();
      if (!header.length) return;

      // remove any previous injection (re-render)
      $html.find("#bbttcc-ml-strip").remove();

      // insert under the first header row
      header.after(buildStrip({ morale, loyalty }));
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
      // small War Log entry
      const war = get(A, `flags.${MOD}.warLogs`, []);
      war.push({ type:"turn", date:(new Date()).toLocaleString(), summary:`${key.charAt(0).toUpperCase()+key.slice(1)} set to ${v}%` });
      await A.update({ [`flags.${MOD}.warLogs`]: war });
      A.sheet?.render(true);
      return v;
    };
    const bumpVal = async (A, key, delta) => {
      const cur = Number(get(A, `flags.${MOD}.${key}`, 0))||0;
      return setVal(A, key, cur + Number(delta||0));
    };

    game.bbttcc.api.factions.setMorale = async ({ factionId, value }) => {
      const A = game.actors.get(String(factionId)); if (!A) throw new Error("Bad factionId");
      return setVal(A, "morale", value);
    };
    game.bbttcc.api.factions.setLoyalty = async ({ factionId, value }) => {
      const A = game.actors.get(String(factionId)); if (!A) throw new Error("Bad factionId");
      return setVal(A, "loyalty", value);
    };
    game.bbttcc.api.factions.bumpMorale = async ({ factionId, delta }) => {
      const A = game.actors.get(String(factionId)); if (!A) throw new Error("Bad factionId");
      return bumpVal(A, "morale", delta);
    };
    game.bbttcc.api.factions.bumpLoyalty = async ({ factionId, delta }) => {
      const A = game.actors.get(String(factionId)); if (!A) throw new Error("Bad factionId");
      return bumpVal(A, "loyalty", delta);
    };
  }

  // Hook into sheet renders
  Hooks.on("renderActorSheet", injectMeters);
  Hooks.once("ready", installHelpers);
  if (game?.ready) installHelpers();

  console.log(TAG, "installed");
})();