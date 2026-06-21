/**
 * Roll for Initiation — canonical Actor "kind" resolver + stored tag.
 * ----------------------------------------------------------------------------
 * The system distinguishes actor KINDS inconsistently: rigs are a real
 * Foundry actor `type`, but factions are `type:"npc"` + an `isFaction` flag,
 * and the auto-link builders stamp `flags["bbttcc-auto-link"].entityKind`
 * ("monster"/"npc"/"rig"/"facility"). That patchwork is why some actor
 * dropdowns can't filter cleanly.
 *
 * `actorKind(actor)` collapses all of that into ONE canonical answer:
 *   "faction" | "rig" | "facility" | "steward" | "monster" | "npc"
 *
 * It is the single source of truth. `flags.fourththing.kind` is a denormalized
 * CACHE of that answer, stamped on create/update and backfilled by migration v2,
 * so raw DB/compendium queries and templates can filter without recomputation.
 * Always prefer actorKind() in code; treat the stored flag as a hint.
 */

const KIND_FLAG_SCOPE = "fourththing";
const KIND_FLAG_KEY = "kind";
const AUTOLINK = "bbttcc-auto-link";
const FACTIONS = "bbttcc-factions";

/** Canonical kinds, in no particular order. */
export const ACTOR_KINDS = ["faction", "rig", "facility", "steward", "monster", "npc"];

/** Builder-stamped entityKind values that map 1:1 to a canonical kind. */
const ENTITY_KIND_MAP = {
  rig: "rig",
  facility: "facility",
  monster: "monster",
  npc: "npc"
};

/**
 * Resolve an actor's canonical kind. Pure + defensive (safe on partial docs).
 * Priority: faction flag → builder entityKind → Foundry actor type.
 * @param {Actor|object} actor
 * @returns {"faction"|"rig"|"facility"|"steward"|"monster"|"npc"|"unknown"}
 */
export function actorKind(actor) {
  if (!actor) return "unknown";

  // 1. Faction wins. Factions are type:"npc" with an isFaction flag (and
  //    ensureFactionHints also stamps system.details.type.value === "faction").
  //    They carry no entityKind, so this check leads.
  try {
    const flagIsFaction =
      (typeof actor.getFlag === "function" ? actor.getFlag(FACTIONS, "isFaction") : undefined) === true ||
      actor.flags?.[FACTIONS]?.isFaction === true;
    const sysType = String(foundry.utils.getProperty(actor, "system.details.type.value") ?? "").toLowerCase();
    if (flagIsFaction || sysType === "faction") return "faction";
  } catch (_e) { /* fall through */ }

  // 2. Builder-stamped entityKind is explicit authoring intent.
  const ek = String(actor.flags?.[AUTOLINK]?.entityKind ?? "").toLowerCase();
  if (ENTITY_KIND_MAP[ek]) return ENTITY_KIND_MAP[ek];

  // 3. Fall back on the Foundry actor type.
  switch (actor.type) {
    case "rig":       return "rig";
    case "character": return "steward"; // a character with no entityKind:npc is a PC/steward
    case "npc":       return "npc";      // a bare npc that isn't a faction or builder-monster
    default:          return actor.type || "unknown";
  }
}

/** All actors of a given canonical kind. */
export function actorsOfKind(kind) {
  const want = String(kind || "").toLowerCase();
  return (game.actors?.contents ?? []).filter(a => actorKind(a) === want);
}

/**
 * Write the denormalized `flags.fourththing.kind` cache if it's stale.
 * Returns true if it wrote. No-op (and no write) when already correct — this is
 * what keeps the updateActor hook from looping. Swallows permission errors.
 * @param {Actor} actor
 * @param {object} [opts]
 * @param {boolean} [opts.force] write even if unchanged
 */
export async function stampActorKind(actor, { force = false } = {}) {
  if (!actor?.update) return false;
  const kind = actorKind(actor);
  if (kind === "unknown") return false;
  const current = actor.flags?.[KIND_FLAG_SCOPE]?.[KIND_FLAG_KEY];
  if (!force && current === kind) return false;
  try {
    await actor.update({ [`flags.${KIND_FLAG_SCOPE}.${KIND_FLAG_KEY}`]: kind });
    return true;
  } catch (e) {
    console.warn(`Roll for Initiation | stampActorKind failed for ${actor?.name}:`, e);
    return false;
  }
}

/** Expose actorKind/actorsOfKind on game.bbttcc.api (merge, never clobber). */
export function registerActorKindApi() {
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.actorKind = actorKind;
    game.bbttcc.api.actorsOfKind = actorsOfKind;
    game.bbttcc.api.ACTOR_KINDS = ACTOR_KINDS;
  } catch (e) {
    console.warn("Roll for Initiation | registerActorKindApi failed:", e);
  }
}

// Change-keys that can alter an actor's kind — only restamp when one of these
// is touched, so the hook ignores its own flags.fourththing.kind writes.
const KIND_RELEVANT_PATHS = [
  "type",
  `flags.${FACTIONS}.isFaction`,
  `flags.${AUTOLINK}.entityKind`,
  "system.details.type.value"
];

function _changeTouchesKind(changed) {
  try {
    const flat = foundry.utils.flattenObject(changed || {});
    return KIND_RELEVANT_PATHS.some(p => Object.prototype.hasOwnProperty.call(flat, p));
  } catch (_e) {
    return true; // be safe: restamp if we can't tell
  }
}

/**
 * Keep `flags.fourththing.kind` fresh. Only the user who initiated the change
 * stamps (so exactly one client writes, avoiding races), and only when the
 * change could actually alter the kind. createActor arity is (doc, options,
 * userId); updateActor is (doc, changed, options, userId) — read userId LAST.
 */
export function registerActorKindHooks() {
  Hooks.on("createActor", (actor, options, userId) => {
    if (game.userId !== userId) return;
    stampActorKind(actor);
  });
  Hooks.on("updateActor", (actor, changed, options, userId) => {
    if (game.userId !== userId) return;
    if (!_changeTouchesKind(changed)) return;
    stampActorKind(actor);
  });
}
