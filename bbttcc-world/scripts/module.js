// bbttcc-world/scripts/module.js
// Boot: register settings + register GM God Panel menu safely.
// Foundry v13: registerMenu type must be an ApplicationV2/FormApplication subclass (CLASS), not an instance.

(function(){
  "use strict";

  var TAG = "[bbttcc-world]";
  function log(){ try{ console.log.apply(console, [TAG].concat([].slice.call(arguments))); }catch(_e){} }
  function warn(){ try{ console.warn.apply(console, [TAG].concat([].slice.call(arguments))); }catch(_e){} }

  function _tryAttachWorldAPI(){
    try{
      if (globalThis && globalThis.BBTTCCWorldAPI && typeof globalThis.BBTTCCWorldAPI.attach === "function") {
        globalThis.BBTTCCWorldAPI.attach();
      }
    }catch(_e0){}
  }

  function registerSettingsSafe(){
    try{
      // If api.world.js already registered these, register() will throw; swallow.
      game.settings.register("bbttcc-world", "worldState", {
        name: "BBTTCC World State",
        hint: "Canonical BBTTCC world state spine.",
        scope: "world",
        config: false,
        type: Object,
        default: { schema: 2, turn: 1, darkness: 0, pressureMod: 1, time: { epoch: 0, turnLength: 12, progress: 0 }, locks: {}, meta: { snapshots: [] } }
      });
    } catch(_e1) {}
    try{
      game.settings.register("bbttcc-world", "worldLogs", {
        name: "BBTTCC World Logs",
        hint: "Audit log for world state changes.",
        scope: "world",
        config: false,
        type: Array,
        default: []
      });
    } catch(_e2) {}
  }

  function registerMenuSafe(){
    // We cannot import via bare specifier; use Foundry route.
    var rel = "/modules/bbttcc-world/apps/world-gm-panel.js";
    var url = null;
    try{
      url = (foundry && foundry.utils && foundry.utils.getRoute) ? foundry.utils.getRoute(rel) : rel;
    }catch(_e){ url = rel; }

    import(url).then(function(mod){
      // Side-effect file attaches globalThis.BBTTCCWorldGMPanelApp; also try export default.
      var Panel = null;
      try{
        Panel = (globalThis && globalThis.BBTTCCWorldGMPanelApp) ? globalThis.BBTTCCWorldGMPanelApp : null;
      }catch(_e1){ Panel = null; }

      if (!Panel) {
        Panel = mod && (mod.BBTTCCWorldGMPanelApp || mod.WorldGMPanelApp || mod.default);
      }

      if (!Panel || typeof Panel !== "function") {
        warn("GM panel class not found after import; menu not registered", mod);
        return;
      }

      try{
        game.settings.registerMenu("bbttcc-world", "gmGodPanel", {
          name: "BBTTCC — GM God Panel",
          label: "Open GM God Panel",
          hint: "Manual world-state editing (Turn, Darkness, Time, Locks). GM only.",
          icon: "fas fa-hand-sparkles",
          type: Panel,
          restricted: true
        });
        log("Registered settings menu: bbttcc-world.gmGodPanel");
      }catch(e){
        warn("registerMenu failed", e);
      }
    }).catch(function(e){
      warn("GM panel import failed", e);
    });
  }

  Hooks.once("init", function(){
    try{ registerSettingsSafe(); }catch(_e){}
    // Try to attach as early as possible (safe if game not ready yet).
    _tryAttachWorldAPI();
  });

  Hooks.once("ready", function(){
    // Re-attach on ready (covers late-loaded/overwritten cases).
    _tryAttachWorldAPI();
    try{ registerMenuSafe(); }catch(_e){}
  });

})();
