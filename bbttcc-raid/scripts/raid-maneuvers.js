// modules/bbttcc-raid/scripts/raid-maneuvers.js
// Safe extender: adds Types, Maneuvers, Activities, and resolveRoundWithManeuvers()
// Does not touch your UI; relies on existing console & API from scripts/module.js.

(function () {
  var NS = "[bbttcc-raid:ext]";

  function merge(dst, extra) {
    dst = dst || {}; extra = extra || {};
    var out = {};
    Object.keys(dst).forEach(function(k){ out[k]=dst[k]; });
    Object.keys(extra).forEach(function(k){ out[k]=extra[k]; });
    return Object.freeze(out);
  }

  // Declarative registries (from your tables)
  var TYPES = Object.freeze({
    assault:      { key:"assault",      label:"Assault",        primaryKey:"violence",  opposedKey:"intrigue",  summary:"Direct force to seize/neutralize a target." },
    infiltration: { key:"infiltration", label:"Infiltration",    primaryKey:"intrigue",  opposedKey:"logistics", summary:"Stealth/guile to penetrate or extract." },
    blockade:     { key:"blockade",     label:"Blockade",        primaryKey:"logistics", opposedKey:"economy",   summary:"Restrict movement; starve supply lines." },
    occupation:   { key:"occupation",   label:"Occupation",      primaryKey:"violence",  opposedKey:"culture",   summary:"Hold captured territory; suppress unrest." },
    liberation:   { key:"liberation",   label:"Liberation",      primaryKey:"culture",   opposedKey:"violence",  summary:"Uplift population; flip control or reduce unrest." },
    propaganda:   { key:"propaganda",   label:"Propaganda",      primaryKey:"softpower", opposedKey:"faith",     summary:"Shape narratives; shift loyalty/attitude." },
    espionage:    { key:"espionage",    label:"Espionage",       primaryKey:"intrigue",  opposedKey:"softpower", summary:"Gather intel; sabotage; set up future ops." },
    ritual:       { key:"ritual",       label:"Ritual / Tikkun", primaryKey:"faith",     opposedKey:"softpower", summary:"Undertake a Tikkun/ritual linked to a Site." }
  });

  var MANEUVERS = Object.freeze({
    flankAttack:           { key:"flankAttack",           label:"Flank Attack",           allowedIn:["assault"],                         resCost:{ military:5 },   effect:{ atkBonus:+2, targetDefenseLoss:1 } },
    supplySurge:           { key:"supplySurge",           label:"Supply Surge",           allowedIn:["assault","blockade","occupation","any"], resCost:{ materials:5 }, effect:{ ignoreClamp:true } },
    spyNetwork:            { key:"spyNetwork",            label:"Spy Network",            allowedIn:["infiltration","espionage"],        resCost:{ knowledge:3 },  effect:{ rerollBest:true } },
    propagandaPush:        { key:"propagandaPush",        label:"Propaganda Push",        allowedIn:["propaganda","liberation","occupation","any"], resCost:{ trade:3 }, effect:{ moraleNote:"+2 morale to friendly hexes if success" } },
    divineFavor:           { key:"divineFavor",           label:"Divine Favor",           allowedIn:["any"],                             resCost:{ faith:5 },      effect:{ atkBonus:+3, onFailRadiation:+1 } },
    technocratOverride:    { key:"technocratOverride",    label:"Technocrat Override",    allowedIn:["assault","espionage","research","any"], resCost:{ technology:5 }, effect:{ dcOffset:-1, nextTurnBonus:"tech+10%" } },
    defensiveEntrenchment: { key:"defensiveEntrenchment", label:"Defensive Entrenchment", allowedIn:["occupation","blockade","defense","any"], resCost:{ military:4 }, effect:{ dcOffset:+3 } }
  });

  var ACTIVITIES = Object.freeze({
    developInfrastructure:{ key:"developInfrastructure", label:"Develop Infrastructure", opCost:{ economy:10 }, boon:"+1 Defense, +5 Trade yield (per chosen hex)" },
    expandTerritory:      { key:"expandTerritory",       label:"Expand Territory",       opCost:{ violence:0 },  note:"Creates a new hex (auto-Claim) — GM flow this sprint" },
    conductResearch:      { key:"conductResearch",       label:"Conduct Research",       opCost:{ intrigue:8 },  boon:"+1 Technology score" },
    diplomaticMission:    { key:"diplomaticMission",     label:"Diplomatic Mission",     opCost:{ diplomacy:6 }, boon:"+5 Loyalty with one faction" },
    culturalFestival:     { key:"culturalFestival",      label:"Cultural Festival",      opCost:{ culture:4 },   boon:"+1 morale across all hexes" },
    faithCampaign:        { key:"faithCampaign",         label:"Faith Campaign",         opCost:{ faith:8 },     boon:"Attempt Enlightenment bump; consumes 1 Spark if available" },
    rearmForces:          { key:"rearmForces",           label:"Rearm Forces",           opCost:{ violence:10 }, boon:"+5 Defense next raid (temporary)" },
    economicBoom:         { key:"economicBoom",          label:"Economic Boom",          opCost:{ economy:10 },  boon:"+10% resource output next turn; exclusive with Infrastructure" }
  });

  // drain helper (stockpile)
  function drainStockpile(actor, resKey, amount){
    try {
      const flags = foundry.utils.duplicate(actor?.flags?.["bbttcc-factions"] || {});
      const s = Object.assign({ food:0, materials:0, trade:0, military:0, knowledge:0, technology:0, defense:0 }, flags.stockpile || {});
      var have = Number(s[resKey]||0);
      var take = Math.min(have, Math.max(0, Number(amount||0)));
      if (take<=0) return Promise.resolve({ taken:0, clamped: amount>0 });
      s[resKey] = have - take;
      return actor.update({ ["flags.bbttcc-factions.stockpile"]: s }).then(function(){
        return { taken: take, clamped: take < amount };
      });
    } catch (e) {
      console.warn(NS, "drainStockpile error", e);
      return Promise.resolve({ taken:0, clamped:true });
    }
  }

  function applyResCosts(actor, resCost){
    resCost = resCost || {};
    var drains = [];
    var sequence = Promise.resolve();
    var clampedAny = false;
    Object.keys(resCost).forEach(function(rk){
      var amt = resCost[rk]; if (!amt) return;
      sequence = sequence.then(function(){
        return drainStockpile(actor, rk, amt).then(function(res){
          if (res.taken>0) drains.push({ resource:rk, amount:res.taken });
          if (res.clamped) clampedAny = true;
        });
      });
    });
    return sequence.then(function(){ return { drains:drains, clampedAny:clampedAny }; });
  }

  Hooks.once("ready", function(){
    try {
      // Ensure API surface exists (provided by your scripts/module.js)
      game.bbttcc = game.bbttcc || { api:{} };
      game.bbttcc.api = game.bbttcc.api || {};
      game.bbttcc.api.raid = game.bbttcc.api.raid || {};

      var raid = game.bbttcc.api.raid;

      // Safe-merge registries
      raid.TYPES      = merge(raid.TYPES,      TYPES);
      raid.MANEUVERS  = merge(raid.MANEUVERS,  MANEUVERS);
      raid.ACTIVITIES = merge(raid.ACTIVITIES, ACTIVITIES);

      // Convenience getters (don’t overwrite if already present)
      if (typeof raid.getTypes !== "function")      raid.getTypes      = function(){ return raid.TYPES; };
      if (typeof raid.getActivities !== "function") raid.getActivities = function(){ return raid.ACTIVITIES; };
      if (typeof raid.getManeuvers !== "function")  raid.getManeuvers  = function(typeKey){
        if (!typeKey) return raid.MANEUVERS;
        var out = {};
        Object.keys(raid.MANEUVERS).forEach(function(k){
          var m = raid.MANEUVERS[k];
          if (!m.allowedIn || m.allowedIn.indexOf(typeKey)!==-1 || m.allowedIn.indexOf("any")!==-1) out[k]=m;
        });
        return out;
      };

      // Round resolver with maneuvers — delegates to your existing commit kernel
      if (typeof raid.resolveRoundWithManeuvers !== "function") {
        raid.resolveRoundWithManeuvers = function (args) {
          var attackerId = args.attackerId, defenderId = args.defenderId, round = args.round;
          var maneuversAtt = args.maneuversAtt || [], maneuversDef = args.maneuversDef || [];

          var attacker = game.actors.get(attackerId);
          var defender = defenderId ? game.actors.get(defenderId) : null;

          if (!attacker || !raid || typeof raid.openConsole !== "function") {
            console.warn(NS, "API not ready or attacker missing.");
          }

          var atkBonusDelta = 0, dcDelta = 0, rerollBest = false;
          var drainsAtk = [], drainsDef = [];
          var clampA = false, clampD = false;
          var onFail = [], onSuccess = [];

          function applySide(sideMans, actor, isDef){
            var seq = Promise.resolve();
            sideMans.forEach(function(key){
              var m = MANEUVERS[key]; if (!m) return;
              if (m.resCost) {
                seq = seq.then(function(){
                  return applyResCosts(actor, m.resCost).then(function(out){
                    (isDef?drainsDef:drainsAtk).push.apply(isDef?drainsDef:drainsAtk, out.drains);
                    if (out.clampedAny && !m.effect?.ignoreClamp) { if (isDef) clampD = true; else clampA = true; }
                  });
                });
              }
              if (m.effect && m.effect.atkBonus) atkBonusDelta += Number(m.effect.atkBonus||0);
              if (m.effect && m.effect.dcOffset)  dcDelta      += Number(m.effect.dcOffset||0);
              if (m.effect && m.effect.rerollBest) rerollBest = true;
              if (m.effect && m.effect.moraleNote) onSuccess.push(m.effect.moraleNote);
              if (m.effect && m.effect.onFailRadiation) onFail.push("+"+m.effect.onFailRadiation+" Radiation risk to hex");
              if (m.effect && m.effect.nextTurnBonus) onSuccess.push("Next Turn: "+m.effect.nextTurnBonus);
            });
            return seq;
          }

          // Require commitLocal() and categoryTotal() from your main script
          function need(fn){ if (typeof fn!=="function") throw new Error("Missing kernel: "+fn.name); }

          try {
            need(window.commitLocal);
            need(window.categoryTotal);
          } catch (e) {
            console.warn(NS, "Kernel unavailable:", e);
          }

          // Chain: drain attacker costs -> drain defender costs -> commitLocal with deltas
          return applySide(maneuversAtt, attacker, false).then(function(){
            return applySide(maneuversDef, defender, true);
          }).then(function(){
            var cat = (round.mode==="infiltration") ? "intrigue" : "violence";
            var baseBonus = window.categoryTotal(attacker, cat);
            return window.commitLocal({
              attackerId: attackerId,
              defenderId: defenderId,
              staged: round.localStaged || { att:{}, def:{} },
              round: round,
              baseBonus: baseBonus,
              extraAtk: atkBonusDelta,
              extraDC: dcDelta,
              rerollBest: rerollBest
            });
          }).then(function(res){
            // tack on drains & flags for the caller (War Log still handled in your main flow)
            res._ext = { drainsAtk:drainsAtk, drainsDef:drainsDef, clampA:clampA, clampD:clampD, atkBonusDelta:atkBonusDelta, dcDelta:dcDelta, rerollBest:rerollBest, onFail:onFail, onSuccess:onSuccess };
            return res;
          }).catch(function(err){
            console.error(NS, "resolveRoundWithManeuvers failed:", err);
            ui.notifications?.error?.("Resolve with maneuvers failed — see console.");
            return null;
          });
        };
      }

      console.log(NS, "registry ready", {
        types: Object.keys(raid.TYPES||{}),
        maneuvers: Object.keys(raid.MANEUVERS||{}),
        activities: Object.keys(raid.ACTIVITIES||{})
      });
    } catch (e) {
      console.warn(NS, "init failed (safe to ignore)", e);
    }
  });
})();
