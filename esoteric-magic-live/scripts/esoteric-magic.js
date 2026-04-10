// esoteric-magic.js (BBTTCC Edition)
// Hermetic/Chaos correspondences + BBTTCC resonance hooks for D&D5E spells.
// Parse-safe: no optional chaining, no arrow funcs, no object spread, no async/await.

(function(){
  "use strict";

  var MODULE_ID = "esoteric-magic";
  var TAG = "[esoteric-magic]";

  // Loaded from data/schools.json at init.
  var SCHOOLS = {};

  // D&D5E school codes -> JSON keys
  var SCHOOL_CODE_MAP = {
    abj: "abjuration",
    con: "conjuration",
    div: "divination",
    enc: "enchantment",
    evo: "evocation",
    ill: "illusion",
    nec: "necromancy",
    trs: "transmutation"
  };

  // Sephirah -> OP deltas (positive gains).
  // NOTE: keys must match game.bbttcc.api.op.KEYS
  var SEPH_OP_MAP = {
    chesed:   { softpower: 1, diplomacy: 1 },
    chokhmah: { intrigue: 1, economy: 1 },
    chokmah:  { intrigue: 1, economy: 1 },
    binah:    { intrigue: 1, economy: 1 },
    gevurah:  { violence: 1, nonlethal: 1 },
    tiferet:  { softpower: 1, diplomacy: 1 },
    tifereth: { softpower: 1, diplomacy: 1 },
    netzach:  { softpower: 1, violence: 1 },
    hod:      { intrigue: 1, economy: 1 },
    yesod:    { economy: 1, diplomacy: 1 },
    malkuth:  { economy: 1 }
  };

  function log(){
    try { console.log.apply(console, ["\ud83d\udd2e", TAG].concat([].slice.call(arguments))); } catch(_e) {}
  }
  function warn(){
    try { console.warn.apply(console, ["\u26a0\ufe0f", TAG].concat([].slice.call(arguments))); } catch(_e) {}
  }

  function deepClone(obj){
    try { return foundry.utils.duplicate(obj); } catch(_e) {}
    try { return JSON.parse(JSON.stringify(obj)); } catch(_e2) {}
    return obj;
  }

  function normalizeSephirah(name){
    if (!name) return null;
    var k = String(name).toLowerCase().trim();
    if (SEPH_OP_MAP[k]) return k;
    var simple = k.replace(/\s+/g, "");
    if (SEPH_OP_MAP[simple]) return simple;
    return null;
  }

  function getSetting(key, fallback){
    try { return game.settings.get(MODULE_ID, key); } catch(_e) { return fallback; }
  }

  function registerSettings(){
    try {
      game.settings.register(MODULE_ID, "timeSource", {
        name: "Esoteric Magic: Time Source",
        hint: "Which clock should correspondences use for alignment bonuses? BBTTCC uses World State time; Foundry uses worldTime.",
        scope: "world",
        config: true,
        type: String,
        choices: {
          bbttcc: "BBTTCC World State",
          foundry: "Foundry worldTime"
        },
        default: "bbttcc"
      });
    } catch(e) {
      // ignore double-register
    }
  }

  // ------------------------------------------------------------
  // Time Context
  // ------------------------------------------------------------

  function getBBTTCCTimeContext(){
    // Uses bbttcc-world/api.world.js schema: state.time.{epoch,turnLength,progress}
    // Refactor: resolve BBTTCC turns into 8 watches instead of 4.
    var ctx = {
      source: "bbttcc",
      turn: 1,
      epoch: 0,
      turnLength: 24,
      progress: 0,
      segment: 0,
      watchCount: 8,
      watchIndex: 0,
      slot: "watch_0",
      watchLabel: "First Dawn"
    };
    try {
      if (!game || !game.bbttcc || !game.bbttcc.api || !game.bbttcc.api.world || typeof game.bbttcc.api.world.getState !== "function") {
        return ctx;
      }
      var st = game.bbttcc.api.world.getState();
      if (!st) return ctx;
      ctx.turn = Number(st.turn || 1);
      var t = st.time || {};
      ctx.epoch = Number(t.epoch || 0);
      ctx.turnLength = Number(t.turnLength || 24);
      if (!(ctx.turnLength > 0)) ctx.turnLength = 24;
      ctx.progress = Number(t.progress || 0);
      if (ctx.progress < 0) ctx.progress = 0;
      if (ctx.progress > ctx.turnLength) ctx.progress = ctx.turnLength;

      // Resolve to 8 watches across the turn. We clamp to 0..7 even when progress == turnLength.
      var ratio = ctx.turnLength ? (ctx.progress / ctx.turnLength) : 0;
      var seg = Math.floor(ratio * ctx.watchCount);
      if (seg < 0) seg = 0;
      if (seg >= ctx.watchCount) seg = ctx.watchCount - 1;
      ctx.segment = seg;
      ctx.watchIndex = seg;
      ctx.slot = "watch_" + String(seg);

      // Human-readable labels keep the UI legible without changing the canonical slot id.
      var labels = [
        "First Dawn",
        "Late Dawn",
        "High Sun",
        "Falling Sun",
        "First Dusk",
        "Late Dusk",
        "Midnight",
        "Deep Midnight"
      ];
      ctx.watchLabel = labels[seg] || ("Watch " + String(seg));
      return ctx;
    } catch(e) {
      warn("getBBTTCCTimeContext failed", e);
      return ctx;
    }
  }

  function getFoundryTimeContext(){
    // Fallback: derive from game.time.worldTime (seconds)
    var out = { source: "foundry", hour: 12, weekday: "monday", slot: "noon" };
    try {
      if (!game || !game.time || typeof game.time.worldTime !== "number") return out;
      var now = new Date(game.time.worldTime * 1000);
      var hour = now.getHours();
      var weekday = "monday";
      try { weekday = now.toLocaleString("en-US", { weekday: "long" }).toLowerCase(); } catch(_e2) {}

      var slot = "day";
      if (hour === 0) slot = "midnight";
      else if (hour >= 5 && hour <= 7) slot = "dawn";
      else if (hour >= 11 && hour <= 13) slot = "noon";
      else if (hour >= 17 && hour <= 19) slot = "dusk";
      else if (hour >= 20 || hour <= 4) slot = "night";

      out.hour = hour;
      out.weekday = weekday;
      out.slot = slot;
      return out;
    } catch(e) {
      warn("getFoundryTimeContext failed", e);
      return out;
    }
  }

  function getTimeContext(){
    var pref = String(getSetting("timeSource", "bbttcc") || "bbttcc").toLowerCase();
    if (pref === "foundry") return getFoundryTimeContext();

    // Prefer BBTTCC when available; otherwise fall back.
    var bb = getBBTTCCTimeContext();
    // If bbttcc-world is missing, ctx.turn will still exist; but we can cheaply detect API absence by source.
    if (bb && bb.source === "bbttcc") {
      // If the api isn't present, bb is still valid but uninformative. Fall back to Foundry if desired.
      // We keep bbttcc as default even when minimal; it keeps behavior stable across tables.
      return bb;
    }
    return getFoundryTimeContext();
  }

  // ------------------------------------------------------------
  // Schools & Correspondences
  // ------------------------------------------------------------

  function fetchJSON(url){
    return fetch(url).then(function(r){
      if (!r || !r.ok) throw new Error("HTTP " + (r ? r.status : "?") + " for " + url);
      return r.json();
    });
  }

  function loadSchools(){
    var url = "modules/" + MODULE_ID + "/data/schools.json";
    return fetchJSON(url)
      .then(function(json){
        SCHOOLS = json || {};
        log("Loaded schools.json", Object.keys(SCHOOLS || {}).length);
        return SCHOOLS;
      })
      .catch(function(e){
        warn("Failed to load schools.json", e);
        SCHOOLS = {};
        return SCHOOLS;
      });
  }

  function resolveSchoolKeyFromItem(item){
    try {
      var sys = item && item.system ? item.system : null;
      if (!sys) return null;
      // dnd5e v5+ spell.school is string code like "abj".
      var code = sys.school;
      if (!code) return null;
      var key = SCHOOL_CODE_MAP[String(code)] || String(code);
      return String(key);
    } catch(_e) {
      return null;
    }
  }

  function resolveCorrespondenceForSpell(spellItem){
    var schoolKey = resolveSchoolKeyFromItem(spellItem);
    if (!schoolKey) return null;
    var row = (SCHOOLS && SCHOOLS[schoolKey]) ? deepClone(SCHOOLS[schoolKey]) : null;
    if (!row) return null;
    row.schoolKey = schoolKey;
    return row;
  }

  function computeAlignmentBonus(row, timeCtx){
    // Returns { aligned: boolean, bonus: number, reason: string }
    // We support both schemas:
    // - Foundry-style: row.bonus.weekday / row.bonus.slot
    // - BBTTCC-style: row.bonus.segment / row.bonus.progress / row.bonus.turnMod

    var out = { aligned: false, bonus: 0, reason: "" };
    if (!row || !row.bonus) return out;

    try {
      // Foundry clock path
      if (timeCtx && timeCtx.source === "foundry") {
        var wd = timeCtx.weekday;
        var sl = timeCtx.slot;
        if (row.bonus.weekday && row.bonus.weekday[wd]) {
          out.aligned = true;
          out.bonus += Number(row.bonus.weekday[wd] || 0);
          out.reason = "weekday";
        }
        if (row.bonus.slot && row.bonus.slot[sl]) {
          out.aligned = true;
          out.bonus += Number(row.bonus.slot[sl] || 0);
          out.reason = out.reason ? (out.reason + "+slot") : "slot";
        }
        return out;
      }

      // BBTTCC clock path
      var segKey = "watch_" + String(timeCtx && timeCtx.segment != null ? timeCtx.segment : 0);
      if (row.bonus.segment && row.bonus.segment[segKey]) {
        out.aligned = true;
        out.bonus += Number(row.bonus.segment[segKey] || 0);
        out.reason = "segment";
      }

      // Optional: turn-based cadence (e.g., every 3 turns)
      if (row.bonus.turnMod && typeof row.bonus.turnMod.n === "number" && row.bonus.turnMod.n > 0) {
        var n = row.bonus.turnMod.n;
        var val = Number(row.bonus.turnMod.value || 0);
        var turn = Number(timeCtx && timeCtx.turn ? timeCtx.turn : 1);
        if ((turn % n) === 0) {
          out.aligned = true;
          out.bonus += val;
          out.reason = out.reason ? (out.reason + "+turn") : "turn";
        }
      }

      return out;
    } catch(e) {
      warn("computeAlignmentBonus failed", e);
      return out;
    }
  }

  // ------------------------------------------------------------
  // BBTTCC Integration: OP + Resonance
  // ------------------------------------------------------------

  function getOpAPI(){
    try {
      return (game && game.bbttcc && game.bbttcc.api && game.bbttcc.api.op) ? game.bbttcc.api.op : null;
    } catch(_e) { return null; }
  }

  function awardFactionOPIfPossible(payload){
    try {
      if (!payload || !payload.factionId) return;
      var seph = normalizeSephirah(payload.sephirah);
      if (!seph) return;
      var deltas = SEPH_OP_MAP[seph];
      if (!deltas) return;

      var opApi = getOpAPI();
      if (!opApi || typeof opApi.commit !== "function") return;

      // Commit positive deltas.
      opApi.commit(payload.factionId, deltas, { source: "esoteric_magic", sephirah: seph, spell: payload.spellName || "" });
    } catch(e) {
      warn("awardFactionOPIfPossible failed", e);
    }
  }

  function actorHasCosmicLinguistResonance(actor){
    // We consider someone a Resonance user if they are a Cosmic Linguist (class)
    // OR they explicitly have the Resonance Channel feature.
    try {
      if (!actor || !actor.items) return false;
      var found = false;

      // Class path: look for a class item with system.identifier === "cosmic_linguist".
      try {
        actor.items.forEach(function(it){
          if (found) return;
          if (!it || String(it.type) !== "class") return;
          var sys = it.system || {};
          if (sys.identifier === "cosmic_linguist") found = true;
        });
      } catch(_e0) {}

      actor.items.forEach(function(it){
        try {
          var flags = it.flags || {};
          var bb = flags.bbttcc || {};
          if (bb.identifier === "cosmic_linguist_resonance_channel") found = true;
          // fallback: system.identifier
          var sys = it.system || {};
          if (sys.identifier === "cosmic_linguist_resonance_channel") found = true;
        } catch(_e2) {}
      });
      return found;
    } catch(_e) {
      return false;
    }
  }

  function getCosmicLinguistLevel(actor){
    try {
      if (!actor || !actor.items) return 0;
      var lvl = 0;
      actor.items.forEach(function(it){
        if (!it || String(it.type) !== "class") return;
        var sys = it.system || {};
        if (sys.identifier !== "cosmic_linguist") return;
        // dnd5e class items typically have system.levels.
        var l = Number(sys.levels || 0);
        if (isFinite(l) && l > lvl) lvl = l;
      });
      return lvl;
    } catch(_e) {
      return 0;
    }
  }

  function actorHasSubclassIdentifier(actor, ident){
    try {
      if (!actor || !actor.items || !ident) return false;
      var ok = false;
      actor.items.forEach(function(it){
        if (ok) return;
        if (!it) return;
        if (String(it.type) !== "subclass") return;
        var sys = it.system || {};
        if (sys.identifier === ident) ok = true;
      });
      return ok;
    } catch(_e) {
      return false;
    }
  }

  function getProfBonus(actor){
    try {
      var pb = actor && actor.system && actor.system.attributes ? actor.system.attributes.prof : null;
      pb = Number(pb);
      if (!isFinite(pb) || pb < 1) pb = 2;
      return pb;
    } catch(_e) {
      return 2;
    }

  }

  // ------------------------------------------------------------
  // Per-rest usage tracking (many exported feats don't configure dnd5e uses)
  // ------------------------------------------------------------

  function getPerRestState(actor){
    try {
      var raw = actor.getFlag(MODULE_ID, "perRest");
      if (raw && typeof raw === "object") return raw;
    } catch(_e) {}
    return {};
  }

  function setPerRestState(actor, st){
    try { return actor.setFlag(MODULE_ID, "perRest", st); } catch(_e) { return Promise.resolve(null); }
  }

  function isUsedThisRest(actor, key){
    try {
      var st = getPerRestState(actor);
      return !!st[String(key)];
    } catch(_e) { return false; }
  }

  function markUsedThisRest(actor, key){
    try {
      var st = getPerRestState(actor);
      st[String(key)] = true;
      setPerRestState(actor, st);
    } catch(_e) {}
  }

  function clearPerRest(actor){
    try { actor.unsetFlag(MODULE_ID, "perRest"); } catch(_e) {}
  }
  function getIntMod(actor){
    try {
      var a = actor && actor.system && actor.system.abilities ? actor.system.abilities : null;
      var intel = a && a.int ? a.int : null;
      var mod = intel && typeof intel.mod === "number" ? intel.mod : null;
      mod = Number(mod);
      if (!isFinite(mod)) mod = 0;
      return mod;
    } catch(_e) {
      return 0;
    }
  }

  function getResonanceDieSize(actor){
    var lvl = getCosmicLinguistLevel(actor);
    if (lvl >= 17) return "d12";
    if (lvl >= 11) return "d10";
    if (lvl >= 5) return "d8";
    return "d6";
  }

  function getResonanceMaxDice(actor){
    var n = getIntMod(actor);
    if (n < 1) n = 1;
    // Annotator: disciplined storage. Small safety margin.
    if (actorHasSubclassIdentifier(actor, "bbttcc_cosmic_linguist_annotator")) n += 1;
    return n;
  }

  function getResonanceState(actor){
    // flags.esoteric-magic.resonance
    // Canon shape (v1.3+): { dice, maxDice, die, strain, bySephirah, lastGain }
    var st = {
      dice: 0,
      maxDice: 1,
      die: "d6",
      strain: 0,
      bySephirah: {},
      lastGain: { combatRound: null, ts: 0 }
    };

    try {
      var raw = actor.getFlag(MODULE_ID, "resonance");
      if (raw && typeof raw === "object") {
        // v1.2 legacy migration (current/max)
        if (typeof raw.current === "number" && typeof raw.max === "number") {
          st.dice = Number(raw.current || 0);
          st.maxDice = Number(raw.max || 0) || 1;
        }
        if (typeof raw.dice === "number") st.dice = Number(raw.dice || 0);
        if (typeof raw.maxDice === "number") st.maxDice = Number(raw.maxDice || 0) || st.maxDice;
        if (typeof raw.die === "string") st.die = raw.die;
        if (typeof raw.strain === "number") st.strain = Number(raw.strain || 0);
        if (raw.bySephirah && typeof raw.bySephirah === "object") st.bySephirah = raw.bySephirah;
        if (raw.lastGain && typeof raw.lastGain === "object") {
          st.lastGain.combatRound = raw.lastGain.combatRound != null ? raw.lastGain.combatRound : st.lastGain.combatRound;
          st.lastGain.ts = raw.lastGain.ts != null ? raw.lastGain.ts : st.lastGain.ts;
        }
      }
    } catch(_e) {}

    // Canon recompute: die size + max dice derived from sheet.
    st.die = getResonanceDieSize(actor);
    st.maxDice = getResonanceMaxDice(actor);

    if (!(st.maxDice > 0)) st.maxDice = 1;
    if (!(st.dice >= 0)) st.dice = 0;
    if (st.dice > st.maxDice) st.dice = st.maxDice;
    if (!(st.strain >= 0)) st.strain = 0;
    if (!st.bySephirah || typeof st.bySephirah !== "object") st.bySephirah = {};
    if (!st.lastGain || typeof st.lastGain !== "object") st.lastGain = { combatRound: null, ts: 0 };
    return st;
  }

  function setResonanceState(actor, st){
    try {
      return actor.setFlag(MODULE_ID, "resonance", st);
    } catch(e) {
      warn("setResonanceState failed", e);
      return Promise.resolve(null);
    }
  }

  function postChatMal(content){
    try {
      if (!content) return;
      ChatMessage.create({
        content: content,
        speaker: ChatMessage.getSpeaker({})
      });
    } catch(_e) {}
  }

  function awardCosmicLinguistResonanceIfPossible(payload){
    try {
      var actor = payload && payload.actor ? payload.actor : null;
      if (!actor) return;
      if (!actorHasCosmicLinguistResonance(actor)) return;

      var seph = normalizeSephirah(payload.sephirah);
      if (!seph) seph = "unknown";

      var aligned = !!(payload && payload.alignment && payload.alignment.aligned);
      var st = getResonanceState(actor);

      var gained = 0;
      var strainGained = 0;

      // Gain rules (from class doc):
      // - Gain 1 Resonance Die when aligned.
      // - Limit: 1 gain per round (combat).
      // - Misalignment generates Strain.
      if (aligned) {
        var canGain = true;
        try {
          if (game && game.combat && game.combat.started) {
            var r = Number(game.combat.round || 0);
            if (st.lastGain && st.lastGain.combatRound === r) canGain = false;
            if (canGain) {
              st.lastGain.combatRound = r;
              st.lastGain.ts = Date.now();
            }
          }
        } catch(_e) {}

        if (canGain && st.dice < st.maxDice) {
          st.dice = Math.min(st.maxDice, Number(st.dice || 0) + 1);
          gained = 1;
          if (!st.bySephirah[seph]) st.bySephirah[seph] = 0;
          st.bySephirah[seph] = Number(st.bySephirah[seph] || 0) + 1;
        }
      } else {
        st.strain = Number(st.strain || 0) + 1;
        strainGained = 1;
      }

      setResonanceState(actor, st);

      // Mal voice: clean, readable, not a thesis.
      var spellName = payload.spellName || "a working";
      var header = gained ? "Resonance Answers" : (strainGained ? "Strain Collects" : "No New Momentum");
      var line1 = "<i>" + (actor.name || "The Linguist") + "</i> casts <b>" + foundry.utils.escapeHTML(String(spellName)) + "</b>.";
      var line2 = gained ? "The structure agrees. A die slides into your pocket." : (strainGained ? "You force the sentence. Reality keeps the receipt." : "Not this time. The world stays stingy.");

      postChatMal(
        "<div class='bbttcc-card'>" +
          "<div style='font-weight:700;'>" + header + "</div>" +
          "<div>" + line1 + "</div>" +
          "<div>" + line2 + "</div>" +
          "<div style='opacity:.9; margin-top:.25rem;'>Resonance: <b>" + st.dice + "</b> / " + st.maxDice + " (" + st.die + ") · Strain: <b>" + st.strain + "</b></div>" +
          "<div style='opacity:.85; margin-top:.15rem;'>Sephirah: <b>" + foundry.utils.escapeHTML(String(seph)) + "</b></div>" +
        "</div>"
      );
    } catch(e) {
      warn("awardCosmicLinguistResonanceIfPossible failed", e);
    }
  }

  // ------------------------------------------------------------
  // Spell Hook
  // ------------------------------------------------------------

  function buildPayload(actor, spellItem){
    var row = resolveCorrespondenceForSpell(spellItem);
    if (!row) return null;

    var seph = normalizeSephirah(row.sephirah || row.sefira || row.sphere || row.primary || "") || null;
    var timeCtx = getTimeContext();
    var alignment = computeAlignmentBonus(row, timeCtx);

    // FactionId best-effort: BBTTCC identity tab often stores faction on flags.
    var factionId = null;
    try {
      var bf = actor && actor.flags ? actor.flags["bbttcc"] : null;
      if (bf && bf.factionId) factionId = String(bf.factionId);
    } catch(_e) {}

    return {
      actor: actor,
      actorId: actor ? actor.id : null,
      actorName: actor ? actor.name : "",
      factionId: factionId,
      spellId: spellItem ? spellItem.id : null,
      spellName: spellItem ? spellItem.name : "",
      schoolKey: row.schoolKey || null,
      correspondence: row,
      sephirah: seph,
      alignment: alignment,
      time: timeCtx,
      at: Date.now()
    };
  }

  function onSpellCast(item, config, options){
    try {
      if (!item) return;
      // D&D5e spells are Items of type "spell".
      if (String(item.type) !== "spell") return;

      var actor = item.actor || null;
      if (!actor) return;

      var payload = buildPayload(actor, item);
      if (!payload) return;

      // Global hook for BBTTCC
      try { Hooks.callAll("bbttcc:esotericSpellCast", payload); } catch(_e1) {}

      // If aligned, optionally signal a darkness/tikkun hook (best-effort; you already have listeners elsewhere).
      try {
        if (payload.alignment && payload.alignment.aligned) {
          Hooks.callAll("bbttcc:tikkun:spellCast", payload);
        }
      } catch(_e2) {}

      // Award OP + Resonance (best-effort; non-blocking)
      awardFactionOPIfPossible(payload);
      awardCosmicLinguistResonanceIfPossible(payload);

    } catch(e) {
      warn("onSpellCast failed", e);
    }
  }

  // ------------------------------------------------------------
  // Feat/Feature Activations (Resonance spend + Strain prompts)
  // ------------------------------------------------------------

  function getItemIdentifier(item){
    try {
      if (!item) return null;
      var sys = item.system || {};
      if (sys.identifier) return String(sys.identifier);
      var flags = item.flags || {};
      var bb = flags.bbttcc || {};
      if (bb.identifier) return String(bb.identifier);
    } catch(_e) {}
    return null;
  }

  function rollResonanceDie(actor){
    var die = "d6";
    try { die = getResonanceState(actor).die || "d6"; } catch(_e) { die = "d6"; }
    try {
      var r = new Roll("1" + die);
      // v13: evaluate supports sync via {async:false}
      r.evaluate({ async: false });
      return r;
    } catch(e) {
      try {
        // Fallback: no roll, return null.
        return null;
      } catch(_e2) { return null; }
    }
  }

  function spendResonance(actor, n){
    var st = getResonanceState(actor);
    n = Number(n || 0);
    if (!(n > 0)) n = 1;
    if (st.dice < n) return { ok: false, st: st };
    st.dice = Math.max(0, Number(st.dice || 0) - n);
    setResonanceState(actor, st);
    return { ok: true, st: st };
  }

  function addStrain(actor, n){
    var st = getResonanceState(actor);
    n = Number(n || 0);
    if (!(n > 0)) n = 1;
    st.strain = Number(st.strain || 0) + n;
    setResonanceState(actor, st);
    return st;
  }

  function postAbilityCard(actor, title, body, st, extra){
    try {
      var nm = actor ? actor.name : "Someone";
      var footer = "Resonance: <b>" + st.dice + "</b> / " + st.maxDice + " (" + st.die + ") · Strain: <b>" + st.strain + "</b>";
      var ex = extra ? ("<div style='opacity:.85; margin-top:.15rem;'>" + extra + "</div>") : "";
      postChatMal(
        "<div class='bbttcc-card'>" +
          "<div style='font-weight:700;'>" + foundry.utils.escapeHTML(String(title)) + "</div>" +
          "<div style='margin-top:.15rem;'><i>" + foundry.utils.escapeHTML(String(nm)) + "</i> " + body + "</div>" +
          ex +
          "<div style='opacity:.9; margin-top:.25rem;'>" + footer + "</div>" +
        "</div>"
      );
    } catch(_e) {}
  }

  function handleFeatUse(item){
    try {
      if (!item || String(item.type) !== "feat") return false;
      var actor = item.actor || null;
      if (!actor) return false;
      if (!actorHasCosmicLinguistResonance(actor)) return false;

      var ident = getItemIdentifier(item);
      if (!ident) return false;

      // --- Syntax Warden: Warden's Counter ---
      if (ident === "syntax_wardens_counter") {
        if (isUsedThisRest(actor, ident)) {
          var st0 = getResonanceState(actor);
          postAbilityCard(actor, "No Exceptions", "tries to declare the spell invalid, but the clause is spent for this rest.", st0, "Once per rest.");
          return true;
        }

        var spent = spendResonance(actor, 1);
        if (!spent.ok) {
          var stA = getResonanceState(actor);
          postAbilityCard(actor, "Warden’s Counter", "reaches for Resonance… and finds an empty pocket.", stA, "You need 1 Resonance Die.");
          return true;
        }

        // Always adds strain.
        var stB = addStrain(actor, 1);
        markUsedThisRest(actor, ident);

        var roll = rollResonanceDie(actor);
        var extra = roll ? ("Resonance Roll: <b>" + roll.total + "</b> (" + foundry.utils.escapeHTML(String(stB.die)) + ")") : "Resonance spent.";
        postAbilityCard(actor, "Warden’s Counter", "declares the working grammatically invalid.", stB, extra);
        return true;
      }

      // --- Redactor: Semantic Redaction ---
      if (ident === "redactor_semantic_redaction") {
        var spentR = spendResonance(actor, 1);
        if (!spentR.ok) {
          var stR0 = getResonanceState(actor);
          postAbilityCard(actor, "Semantic Redaction", "tries to delete a sentence without ink.", stR0, "You need 1 Resonance Die.");
          return true;
        }
        var stR1 = addStrain(actor, 1);

        var choices = [
          { key: "erase", label: "Erase presence" },
          { key: "revoke", label: "Revoke permission" },
          { key: "cut", label: "Cut continuity" }
        ];
        var content = "<p><b>Choose a Redaction Effect</b></p><p style='opacity:.85;'>You just paid Resonance and Strain. Now choose what kind of absence you are creating.</p>";
        choices.forEach(function(c){
          content += "<div style='margin:.25rem 0;'><b>" + foundry.utils.escapeHTML(c.label) + "</b></div>";
        });

        var btns = {};
        choices.forEach(function(c){
          btns[c.key] = {
            label: c.label,
            callback: function(){
              var stNow = getResonanceState(actor);
              postAbilityCard(actor, "Semantic Redaction", "cuts the draft: <b>" + foundry.utils.escapeHTML(c.label) + "</b>.", stNow, "The universe notices the missing line.");
            }
          };
        });
        btns.cancel = { label: "Cancel", callback: function(){
          var stNow2 = getResonanceState(actor);
          postAbilityCard(actor, "Semantic Redaction", "hesitates mid-delete. The ink is already spent.", stNow2, "(No refund.)");
        }};

        new Dialog({
          title: "Semantic Redaction",
          content: content,
          buttons: btns
        }, { width: 520 }).render(true);
        return true;
      }

      // Default: not handled.
      return false;
    } catch(e) {
      warn("handleFeatUse failed", e);
      return false;
    }
  }

  function onUseItem(item, config, options){
    try {
      if (!item) return;
      if (String(item.type) === "spell") return onSpellCast(item, config, options);
      if (String(item.type) === "feat") {
        var handled = handleFeatUse(item);
        if (handled) return;
      }
    } catch(e) {
      warn("onUseItem failed", e);
    }
  }
// ------------------------------------------------------------
// ------------------------------------------------------------
// UI: Correspondences App (HexChrome + resizable) [ApplicationV2]
// ------------------------------------------------------------

function watchSlotToInfluenceKey(tc){
  var idx = Number(tc && tc.watchIndex != null ? tc.watchIndex : (tc && tc.segment != null ? tc.segment : 0));
  if (!isFinite(idx) || idx < 0) idx = 0;
  if (idx > 7) idx = 7;

  // Backward-compatible mapping:
  // 0-1 = dawn, 2-3 = noon, 4-5 = dusk, 6-7 = midnight
  if (idx <= 1) return "dawn";
  if (idx <= 3) return "noon";
  if (idx <= 5) return "dusk";
  return "midnight";
}

function buildCorrespondencesRows(tc){
  var key = watchSlotToInfluenceKey(tc);
  var rows = [];

  Object.keys(SCHOOLS || {}).forEach(function(school){
    var r = SCHOOLS[school];
    if (!r) return;

    var bonus = "";
    try {
      if (r.bonuses && r.bonuses[key] && r.bonuses[key].label) bonus = String(r.bonuses[key].label);
      if (!bonus && r.bonus && r.bonus.slot && r.bonus.slot[key]) bonus = String(r.bonus.slot[key]);
    } catch(_e) {}

    rows.push({
      school: String(school),
      sephirah: String(r.sephirah || r.primary || ""),
      tarot: String(r.tarot || ""),
      astro: String(r.astro || r.planet || ""),
      day: String(r.day || ""),
      influence: String(bonus || ""),
      favored: !!bonus
    });
  });

  rows.sort(function(a,b){
    if (!!a.favored !== !!b.favored) return a.favored ? -1 : 1;
    return String(a.school).localeCompare(String(b.school));
  });

  return {
    key: key,
    watchLabel: String(tc && tc.watchLabel ? tc.watchLabel : ""),
    watchIndex: Number(tc && tc.watchIndex != null ? tc.watchIndex : 0),
    rows: rows
  };
}

var CorrespondencesApp = null;
var CORR_APP_ID = "bbttcc-esoteric-correspondences-v2";

function _closeAnyOldCorrespondencesWindows(){
  try {
    var wins = ui && ui.windows ? ui.windows : null;
    if (!wins) return;
    Object.keys(wins).forEach(function(k){
      var w = wins[k];
      if (!w) return;
      try {
        var oid = (w.options && w.options.id) ? String(w.options.id) : "";
        if (oid === "bbttcc-esoteric-correspondences" || oid === CORR_APP_ID) {
          if (typeof w.close === "function") w.close({ force: true });
        }
      } catch(_e) {}
    });
  } catch(_e2) {}
}

function getCorrespondencesAppClass(){
  if (CorrespondencesApp) return CorrespondencesApp;

  var api = null;
  try { api = (foundry && foundry.applications && foundry.applications.api) ? foundry.applications.api : null; } catch(_e0) {}
  if (!api) return null;

  var AppV2 = null;
  var HB = null;
  try { AppV2 = api.ApplicationV2; } catch(_e1) {}
  try { HB = api.HandlebarsApplicationMixin; } catch(_e2) {}
  if (!AppV2 || !HB) return null;

  CorrespondencesApp = class extends HB(AppV2) {
    // IMPORTANT: do NOT mutate super.DEFAULT_OPTIONS (shared). mergeObject is in-place by default.
    // Mutating the shared object causes unrelated AppV2 windows to inherit the wrong id/title/template,
    // producing the exact "chrome from A, body from B" behavior.
    static DEFAULT_OPTIONS = foundry.utils.mergeObject(foundry.utils.deepClone((super.DEFAULT_OPTIONS || {})), {
      id: CORR_APP_ID,
      classes: ["bbttcc", "bbttcc-esoteric-correspondences-app"],
      window: {
        title: "Esoteric Correspondences",
        resizable: true,
        controls: [],
        icon: ""
      },
      position: {
        width: 920,
        height: 560
      }
    }, { inplace: false });

    static PARTS = {
      body: { template: "modules/" + MODULE_ID + "/templates/correspondences.hbs" }
    };

    async _preparePartContext(partId, context){
      if (partId !== "body") return context;

      var tc = getTimeContext();
      var pack = buildCorrespondencesRows(tc);

      return Object.assign({}, context, {
        moduleTitle: (game.modules.get(MODULE_ID) ? game.modules.get(MODULE_ID).title : "Esoteric Magic"),
        slot: String(tc && tc.slot ? tc.slot : ""),
        segment: Number(tc && tc.segment != null ? tc.segment : 0),
        watchIndex: Number(tc && tc.watchIndex != null ? tc.watchIndex : 0),
        watchCount: Number(tc && tc.watchCount != null ? tc.watchCount : 8),
        watchLabel: String(tc && tc.watchLabel ? tc.watchLabel : ""),
        turn: Number(tc && tc.turn ? tc.turn : 1),
        influenceKey: pack.key,
        rows: pack.rows
      });
    }

    async _onRender(ctx, opts){
      await super._onRender(ctx, opts);
      try {
        var root = (this.form && this.form instanceof HTMLElement) ? this.form : null;
      if (!root) {
        try {
          var el = (this.element && this.element[0]) ? this.element[0] : this.element;
          if (el && el instanceof HTMLElement) root = el;
        } catch(_e0) {}
      }
      var appEl = root && root.closest ? root.closest(".app") : null;
        var wc = appEl ? appEl.querySelector(".window-content") : null;
        if (wc) {
          wc.style.padding = "0";
          wc.style.overflow = "hidden";
        }
      } catch(_e) {}
    }

    async close(options){
      try {
        if (game && game.bbttcc && game.bbttcc.apps && game.bbttcc.apps.esotericCorrespondences === this) {
          delete game.bbttcc.apps.esotericCorrespondences;
        }
      } catch(_e) {}
      return super.close(options);
    }
  };

  return CorrespondencesApp;
}

// Legacy fallback (Dialog)
function openCorrespondencesApp(){
  try {
    var tc = getTimeContext();
    var pack = buildCorrespondencesRows(tc);
    var rows = pack.rows || [];
    var html = "<div class='esoteric-correspondences'><p><b>Esoteric Correspondences</b></p>";
    html += "<p style='opacity:.85;'>Slot: " + String(tc.slot || "") + " · Key: " + String(pack.key || "") + "</p>";
    html += "<div style='max-height:420px; overflow:auto;'><table style='width:100%; border-collapse:collapse;'>";
    html += "<tr><th style='text-align:left;'>School</th><th>Sephirah</th><th>Tarot</th><th>Astro</th><th>Day</th><th>Influence</th></tr>";
    rows.forEach(function(r){
      html += "<tr>";
      html += "<td><b>" + foundry.utils.escapeHTML(String(r.school||"")) + "</b></td>";
      html += "<td>" + foundry.utils.escapeHTML(String(r.sephirah||"")) + "</td>";
      html += "<td>" + foundry.utils.escapeHTML(String(r.tarot||"")) + "</td>";
      html += "<td>" + foundry.utils.escapeHTML(String(r.astro||"")) + "</td>";
      html += "<td>" + foundry.utils.escapeHTML(String(r.day||"")) + "</td>";
      html += "<td>" + foundry.utils.escapeHTML(String(r.influence||"")) + "</td>";
      html += "</tr>";
    });
    html += "</table></div></div>";
    new Dialog({ title: "Esoteric Correspondences", content: html, buttons: { ok: { label: "Close" } } }, { width: 720 }).render(true);
  } catch(e) {
    warn("openCorrespondencesApp failed", e);
  }
}

function openCorrespondencesV2(){
  try {
    // Ensure a single canonical window and avoid id collisions with older builds.
    _closeAnyOldCorrespondencesWindows();

    // If schools haven't loaded yet, load them first (non-blocking, but ensures data).
    try {
      if (!SCHOOLS || !Object.keys(SCHOOLS || {}).length) {
        loadSchools().then(function(){
          try { openCorrespondencesV2(); } catch(_e0) {}
        });
        return;
      }
    } catch(_e1) {}

    var C = getCorrespondencesAppClass();
    if (!C) return openCorrespondencesApp();

    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.apps = game.bbttcc.apps || {};

    var inst = game.bbttcc.apps.esotericCorrespondences;
    // Guard: another module may have overwritten this slot with a different app instance.
    try {
      if (inst && inst.constructor && inst.constructor.name !== "CorrespondencesApp") {
        warn("esotericCorrespondences slot was occupied by " + inst.constructor.name + " — replacing.");
        try { if (typeof inst.close === "function") inst.close(); } catch(_e0) {}
        inst = null;
        game.bbttcc.apps.esotericCorrespondences = null;
      }
    } catch(_e1) {}

    if (!inst || typeof inst.render !== "function") {
      inst = new C();
      game.bbttcc.apps.esotericCorrespondences = inst;
    }

    inst.render({ force: true, focus: true });
  } catch(e) {
    warn("openCorrespondencesV2 failed; falling back", e);
    try { openCorrespondencesApp(); } catch(_e2) {}
  }
}



  function injectSheetButton(app, html, data){
    try {
      if (!html) return;
      // Only on Actor sheets.
      var header = html[0] ? html[0].querySelector("header.window-header") : null;
      // In v13, html is a jQuery-ish array; we support both.
      if (!header && html.querySelector) header = html.querySelector("header.window-header");

      // Safer: find title element.
      var root = html[0] || html;
      if (!root || !root.querySelector) return;

      var existing = root.querySelector('[data-action="esoteric-correspondences"]');
      if (existing) return;

      var btn = document.createElement("a");
      btn.className = "header-button control";
      btn.dataset.action = "esoteric-correspondences";
      btn.innerHTML = "<i class='fas fa-hat-wizard'></i> Esoteric";
      btn.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        openCorrespondencesV2();
      });

      // Insert into sheet header controls if possible.
      var controls = root.querySelector(".window-header .window-title");
      if (controls && controls.parentElement) {
        controls.parentElement.appendChild(btn);
      } else {
        // fallback: top of form
        root.prepend(btn);
      }

    } catch(e) {
      // non-fatal
    }
  }

  // ------------------------------------------------------------
  // API surface
  // ------------------------------------------------------------

  function attachApi(){
    try {
      var mod = game && game.modules ? game.modules.get(MODULE_ID) : null;
      if (!mod) return;
      if (mod.api && mod.api.__bbttcc_attached) return;
      if (!mod.api) mod.api = {};
      mod.api.getTimeContext = getTimeContext;
      mod.api.normalizeSephirah = normalizeSephirah;
      mod.api.getResonanceState = getResonanceState;
      mod.api.openCorrespondences = openCorrespondencesV2;
      mod.api.__version = "1.4.1";
      mod.api.__bbttcc_attached = true;
      log("API attached to game.modules.get('esoteric-magic').api");
    } catch(e) {
      warn("attachApi failed", e);
    }
  }

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------

  Hooks.once("init", function(){
    registerSettings();
    // Attach module API as early as possible so other UIs can call it.
    try { attachApi(); } catch(_e0) {}
  });

  Hooks.once("setup", function(){
    try { attachApi(); } catch(_e1) {}
  });

  Hooks.once("ready", function(){
    try { attachApi(); } catch(_e2) {}

    // Load data, then wire hooks.
    loadSchools().then(function(){
      try {
        // D&D5e item usage hook (spells + features)
        Hooks.on("dnd5e.useItem", onUseItem);
      } catch(e) {
        warn("Failed to hook dnd5e.useItem", e);
      }
      // Add the header button to actor sheets (best-effort).
      try {
        Hooks.on("renderActorSheet", injectSheetButton);
      } catch(_e2) {}

      // Decay/cleanup: Resonance is momentum, not savings.
      // - End of combat: clear Resonance dice for combatants.
      try {
        Hooks.on("deleteCombat", function(combat){
          try {
            if (!combat || !combat.combatants) return;
            combat.combatants.forEach(function(c){
              var a = c && c.actor ? c.actor : null;
              if (!a) return;
              var st = getResonanceState(a);
              st.dice = 0;
              st.lastGain = { combatRound: null, ts: 0 };
              setResonanceState(a, st);
            });
          } catch(_e) {}
        });
      } catch(_e3) {}

      // - End of Strategic Turn: dump Resonance dice across the board.
      try {
        Hooks.on("bbttcc:advanceTurn:end", function(){
          try {
            if (!game || !game.actors) return;
            game.actors.forEach(function(a){
              try {
                var raw = a.getFlag(MODULE_ID, "resonance");
                if (!raw && !actorHasCosmicLinguistResonance(a)) return;
                var st = getResonanceState(a);
                st.dice = 0;
                st.lastGain = { combatRound: null, ts: 0 };
                setResonanceState(a, st);
              } catch(_e) {}
            });
          } catch(_e4) {}
        });
      } catch(_e5) {}

      // - Rest completion: clear per-rest feat usage locks (best-effort).
      try {
        Hooks.on("dnd5e.restCompleted", function(actor, data){
          try {
            if (!actor) return;
            clearPerRest(actor);
          } catch(_e) {}
        });
      } catch(_e6) {}

      attachApi();

      log("Ready.");
    });
  });

  try { if (game && game.ready) attachApi(); } catch(_e3) {}

})();