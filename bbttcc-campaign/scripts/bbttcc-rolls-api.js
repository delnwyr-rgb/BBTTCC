// modules/bbttcc-campaign/scripts/bbttcc-rolls-api.js
// BBTTCC — Rolls API v0.1 (Hex Chrome)
//
// Goal: provide a single place to resolve bonuses for Campaign Beat "Choice/Check" UI.
//
// Exposes (late-load safe):
//   game.bbttcc.api.rolls.getRoster(factionId)
//   game.bbttcc.api.rolls.getOpBonus(factionId, opKey)
//   game.bbttcc.api.rolls.rollCheck({ statKey, factionId, actorUuid, dc, label })
//
// Design notes:
// - For actor skills/abilities we delegate to the DND5E roll methods when available.
// - For OP checks we try to pull an "OP total" (Value + Roster) from common faction flags.
//   If your world stores OP totals differently, adjust _readFactionOpTotal().

var TAG = "[bbttcc-rolls]";
var MOD_F = "bbttcc-factions";

function log()  { try { console.log.apply(console, [TAG].concat([].slice.call(arguments))); } catch (_e) {} }
function warn() { try { console.warn.apply(console, [TAG].concat([].slice.call(arguments))); } catch (_e) {} }

function _safeNum(v, fb) {
  var n = Number(v);
  return isFinite(n) ? n : (fb == null ? 0 : fb);
}

function _getActorByIdOrUuid(idOrUuid) {
  var s = String(idOrUuid || "");
  if (!s) return Promise.resolve(null);
  try {
    if (s.indexOf("Actor.") === 0) return fromUuid(s);
    var a = game && game.actors ? game.actors.get(s) : null;
    return Promise.resolve(a || null);
  } catch (e) {
    warn("getActor failed", e);
    return Promise.resolve(null);
  }
}

function _getFlagSafe(doc, scope, key) {
  try {
    if (!doc || !doc.getFlag) return null;
    return doc.getFlag(scope, key);
  } catch (_e) {
    return null;
  }
}

// ------------------------------
// Roster helpers
// ------------------------------

function getRoster(factionId) {
  return _getActorByIdOrUuid(factionId).then(function (faction) {
    if (!faction) return [];

    var roster = _getFlagSafe(faction, MOD_F, "roster");
    if (!Array.isArray(roster)) roster = [];

    // roster entries may be actor ids or uuids; normalize.
    var out = [];
    var i;
    for (i = 0; i < roster.length; i++) {
      var raw = roster[i];
      if (!raw) continue;
      out.push(String(raw));
    }

    // Resolve to display objects
    var promises = out.map(function (rid) {
      return _getActorByIdOrUuid(rid).then(function (a) {
        if (!a) return null;
        return {
          id: a.id,
          uuid: a.uuid,
          name: a.name,
          img: a.img
        };
      });
    });

    return Promise.all(promises).then(function (rows) {
      return rows.filter(function (r) { return !!r; });
    });
  });
}

// ------------------------------
// OP bonus resolution
// ------------------------------

function _readFactionOpTotal(faction, opKey) {
  // Best-effort: different worlds store OP values/totals in different places.
  // We try a few common patterns:
  //  - flags.bbttcc-factions.ops.<key>.value
  //  - flags.bbttcc-factions.opsTotals.<key>
  //  - flags.bbttcc-factions.rosterTotals.<key>
  //  - flags.bbttcc-factions.opTotals.<key>
  // If only a base value is found, we return it.

  var ops = _getFlagSafe(faction, MOD_F, "ops") || null;
  if (ops && typeof ops === "object") {
    try {
      if (ops[opKey] && ops[opKey].value != null) return _safeNum(ops[opKey].value, 0);
      if (ops[opKey] != null && typeof ops[opKey] !== "object") return _safeNum(ops[opKey], 0);
    } catch (_e1) {}
  }

  var opsTotals = _getFlagSafe(faction, MOD_F, "opsTotals") || null;
  if (opsTotals && typeof opsTotals === "object" && opsTotals[opKey] != null) {
    return _safeNum(opsTotals[opKey], 0);
  }

  var opTotals = _getFlagSafe(faction, MOD_F, "opTotals") || null;
  if (opTotals && typeof opTotals === "object" && opTotals[opKey] != null) {
    return _safeNum(opTotals[opKey], 0);
  }

  // If we can find both base value and roster contrib, add them.
  var base = 0;
  var contrib = 0;

  var baseOps = _getFlagSafe(faction, MOD_F, "opsBase") || null;
  if (baseOps && typeof baseOps === "object" && baseOps[opKey] != null) base = _safeNum(baseOps[opKey], 0);

  var rosterTotals = _getFlagSafe(faction, MOD_F, "rosterTotals") || null;
  if (rosterTotals && typeof rosterTotals === "object" && rosterTotals[opKey] != null) contrib = _safeNum(rosterTotals[opKey], 0);

  if (base || contrib) return base + contrib;

  return 0;
}

function getOpBonus(factionId, opKey) {
  opKey = String(opKey || "").trim().toLowerCase();
  return _getActorByIdOrUuid(factionId).then(function (faction) {
    if (!faction) return 0;
    return _readFactionOpTotal(faction, opKey);
  });
}

// ------------------------------
// Roll execution
// ------------------------------

function rollCheck(opts) {
  opts = opts || {};
  var statKey = String(opts.statKey || "").trim();
  var factionId = opts.factionId || null;
  var actorUuid = opts.actorUuid || null;
  var dc = _safeNum(opts.dc, 0);
  var label = String(opts.label || "Check");

  // OP check
  if (statKey.indexOf("op.") === 0) {
    var opKey = statKey.slice(3);
    return getOpBonus(factionId, opKey).then(function (bonus) {
      var formula = "1d20 + " + String(bonus);
      var roll = new Roll(formula, {});
      return roll.evaluate({ async: true }).then(function (r) {
        try {
          r.toMessage({
            flavor: "<b>" + label + "</b><br/>OP " + opKey + " (" + bonus + ")" + (dc ? (" vs DC " + dc) : "")
          });
        } catch (_eMsg) {}
        return { roll: r, bonus: bonus, dc: dc, statKey: statKey, mode: "op" };
      });
    });
  }

  // Actor-based check
  return _getActorByIdOrUuid(actorUuid).then(function (actor) {
    if (!actor) {
      ui.notifications && ui.notifications.warn && ui.notifications.warn("No actor selected for this roll.");
      return { error: "No actor", dc: dc, statKey: statKey, mode: "actor" };
    }

    // ability.<str>
    if (statKey.indexOf("ability.") === 0) {
      var abil = statKey.slice("ability.".length);
      // DND5E expects ability keys like str/dex/con/int/wis/cha
      abil = abil.substring(0, 3);
      if (actor.rollAbilityTest) {
        return actor.rollAbilityTest(abil, { fastForward: true }).then(function (r) {
          return { roll: r, dc: dc, statKey: statKey, mode: "ability", actorUuid: actor.uuid };
        });
      }
    }

    // skill key (dnd5e skill id)
    if (actor.rollSkill) {
      return actor.rollSkill(statKey, { fastForward: true }).then(function (r) {
        return { roll: r, dc: dc, statKey: statKey, mode: "skill", actorUuid: actor.uuid };
      });
    }

    // Fallback: 1d20
    var roll = new Roll("1d20", {});
    return roll.evaluate({ async: true }).then(function (r) {
      try { r.toMessage({ flavor: "<b>" + label + "</b>" + (dc ? (" vs DC " + dc) : "") }); } catch (_e2) {}
      return { roll: r, dc: dc, statKey: statKey, mode: "fallback", actorUuid: actor.uuid };
    });
  });
}

// ------------------------------
// API wiring (late-load safe)
// ------------------------------

function _attach() {
  try {
    if (!game) return;
    if (!game.bbttcc) game.bbttcc = { api: {} };
    if (!game.bbttcc.api) game.bbttcc.api = {};
    if (!game.bbttcc.api.rolls) game.bbttcc.api.rolls = {};

    game.bbttcc.api.rolls.getRoster = getRoster;
    game.bbttcc.api.rolls.getOpBonus = getOpBonus;
    game.bbttcc.api.rolls.rollCheck = rollCheck;

    log("Rolls API ready → game.bbttcc.api.rolls.{getRoster, getOpBonus, rollCheck}");
  } catch (e) {
    warn("attach failed", e);
  }
}

Hooks.once("ready", _attach);
try { if (game && game.ready) _attach(); } catch (_e) {}
