// D&D 5e Hybrid Guard — keeps actor data prep alive when Active Effects were
// authored for a different ruleset than the one currently configured.
//
// 1. Tool / skill entries conjured by an AE. `system.tools` is a MappingField:
//    an AE whose key names a tool the actor never had in source (e.g. the SW5E
//    "Jedi" feature's `system.tools.artificersimplements.prof`) creates a bare
//    `{prof: 1}` object with no `roll`/`ability`. dnd5e 6.0's prepareTools then
//    reads `tool.roll.bonus` → TypeError → prepareDerivedData aborts, leaving
//    the sheet with NaN initiative/hit dice, no max HP and 0 speed. We backfill
//    the missing schema before prep (and honour the legacy `.prof` key as the
//    proficiency level). Same for skills; a skill that no longer exists in
//    CONFIG (e.g. SW5E's `lor` with sw5e disabled) is dropped instead.
//
// 2. `system.details.background` is a getter-only LocalDocumentField after
//    prep; any AE change aimed at it throws "Cannot set property background".
//    sw5e ships the same guard, but only while sw5e is enabled — this one is
//    always on. Double-registration is harmless (both just skip the change).

const ID = "dnd5e-hybrid-guard";
const TAG = "[dnd5e-hybrid-guard]";
const BG_KEY = /^system\.(details\.)?background(\.|$)/;
const warned = new Set();

function warnOnce(key, ...args) {
  if ( warned.has(key) ) return;
  warned.add(key);
  console.warn(TAG, ...args);
}

function emptyRoll() {
  return { min: null, max: null, mode: 0, bonus: "" };
}

/** Backfill the RollConfigField shape on an entry an AE created from nothing. */
function repairEntry(entry, cfg, bonuses) {
  const level = Number(entry.value ?? entry.prof ?? 0);
  entry.value = Number.isFinite(level) ? Math.clamp(level, 0, 2) : 0;
  if ( typeof entry.prof !== "object" ) delete entry.prof;
  entry.ability ??= cfg?.ability ?? "int";
  entry.roll ??= emptyRoll();
  entry.bonuses ??= bonuses;
}

function sanitizeTools(system) {
  for ( const [id, tool] of Object.entries(system.tools ?? {}) ) {
    if ( tool?.roll ) continue;
    if ( !tool || (typeof tool !== "object") ) { delete system.tools[id]; continue; }
    repairEntry(tool, CONFIG.DND5E.tools?.[id], {});
    warnOnce(`tool:${system.parent?.id}:${id}`,
      `${system.parent?.name}: an Active Effect added tool "${id}" without a full entry — backfilled.`);
  }
}

function sanitizeSkills(system) {
  for ( const [id, skill] of Object.entries(system.skills ?? {}) ) {
    if ( skill?.roll ) continue;
    const cfg = CONFIG.DND5E.skills?.[id];
    if ( !cfg || !skill || (typeof skill !== "object") ) {
      delete system.skills[id];
      warnOnce(`skill:${system.parent?.id}:${id}`,
        `${system.parent?.name}: an Active Effect targets unknown skill "${id}" — ignored.`);
      continue;
    }
    repairEntry(skill, cfg, { check: "", passive: "" });
    warnOnce(`skill:${system.parent?.id}:${id}`,
      `${system.parent?.name}: an Active Effect added skill "${id}" without a full entry — backfilled.`);
  }
}

/** Find the prototype in the chain that actually owns `name` (CreatureTemplate in 6.x). */
function ownerOf(cls, name) {
  for ( let p = cls?.prototype; p && (p !== Object.prototype); p = Object.getPrototypeOf(p) ) {
    if ( Object.hasOwn(p, name) ) return p;
  }
  return null;
}

function wrapMethod(proto, name, before) {
  if ( !proto || proto[`__${ID}_${name}`] ) return;
  const original = proto[name];
  proto[name] = function(...args) {
    try { before(this); } catch(err) { console.warn(TAG, `${name} pre-guard failed`, err); }
    return original.apply(this, args);
  };
  proto[`__${ID}_${name}`] = true;
}

function patchPrep() {
  const models = dnd5e.dataModels.actor;
  for ( const cls of [models.CharacterData, models.NPCData] ) {
    wrapMethod(ownerOf(cls, "prepareTools"), "prepareTools", sanitizeTools);
    wrapMethod(ownerOf(cls, "prepareSkills"), "prepareSkills", sanitizeSkills);
  }
}

function patchBackground() {
  const skip = function(wrapped, ...args) {
    const change = args[1];
    if ( change && BG_KEY.test(String(change.key ?? "")) ) {
      warnOnce(`bg:${args[0]?.id}`, `${args[0]?.name}: skipped AE change on "${change.key}" (getter-only).`);
      return {};
    }
    return wrapped(...args);
  };
  if ( game.modules.get("lib-wrapper")?.active ) {
    libWrapper.register(ID, "CONFIG.ActiveEffect.documentClass.applyChange", skip, "MIXED");
    return;
  }
  const AE = CONFIG.ActiveEffect.documentClass;
  const original = AE.applyChange;
  AE.applyChange = function(...args) { return skip(original.bind(this), ...args); };
}

/**
 * dnd5e 6 groups initiative by calling `combatant.token.getGroupingKey(...)` on EVERY
 * combatant whenever anyone rolls. A combatant has no token when its combat isn't linked
 * to a scene (v14 allows unlinked combats) or its token was deleted — and then the whole
 * roll throws for whoever triggered it. Treat a tokenless combatant as ungroupable.
 */
function patchCombatantGrouping() {
  const Combatant = CONFIG.Combatant.documentClass;
  for ( const name of ["getInitiativeGroupingKey", "getGroupingKey"] ) {
    const proto = ownerOf(Combatant, name);
    if ( !proto || proto[`__${ID}_${name}`] ) continue;
    const original = proto[name];
    proto[name] = function(...args) {
      if ( !this.group && !this.token ) {
        warnOnce(`init:${this.parent?.id}`, `Combat ${this.parent?.id} has combatants without a token `
          + "(is the combat linked to a scene?) — initiative grouping skipped for them.");
        return null;
      }
      return original.apply(this, args);
    };
    proto[`__${ID}_${name}`] = true;
  }
}

Hooks.once("init", () => {
  if ( game.system.id !== "dnd5e" ) return;
  try { patchPrep(); } catch(err) { console.error(TAG, "could not patch tool/skill prep", err); }
  try { patchBackground(); } catch(err) { console.error(TAG, "could not patch background guard", err); }
  try { patchCombatantGrouping(); } catch(err) { console.error(TAG, "could not patch initiative grouping", err); }
});
