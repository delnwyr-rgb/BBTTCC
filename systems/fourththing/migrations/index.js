/**
 * Roll for Initiation — schema migration framework.
 * ----------------------------------------------------------------------------
 * One-time, GM-gated, idempotent per-world data upgrades.
 *
 * The world stores the last-applied schema version in a hidden world setting
 * (`fourththing.schemaVersion`). On `ready`, every migration newer than the
 * stored version runs in order (oldest first); the stored version is advanced
 * after EACH successful step, so a later failure never replays an earlier
 * success. A brand-new world (stored 0) runs the baseline no-op and is stamped
 * at the current version.
 *
 * WHY THIS EXISTS (see SHIP_ROADMAP.md §3, §5): migrations are ad-hoc paste
 * macros today. Before more saved-data shapes accumulate — and before the
 * eventual `fourththing → rfi` flag/id rename — the system needs versioned,
 * automatic, run-once-per-world data upgrades. The rename becomes one more
 * numbered entry in MIGRATIONS below.
 *
 * ADDING A MIGRATION:
 *   1. Append an entry to MIGRATIONS: { version: N, name, migrate: async () => {...} }
 *      where N = (previous max version) + 1. CURRENT_SCHEMA_VERSION is derived
 *      from the max version, so you cannot add a step without bumping the target.
 *   2. Mirror the value in system.json `flags.fourththing.schemaVersion` (it is
 *      the human-readable manifest record; a mismatch only warns).
 *   3. Make migrate() IDEMPOTENT — it may run against partially-migrated data
 *      and must be safe to re-run. Prefer read-old-or-new / write-new, and
 *      remember Foundry `update()` MERGES objects (use `-=key` to delete).
 *   4. Throw to abort the whole run WITHOUT advancing past the failed step; it
 *      retries on next load.
 */

import { stampActorKind } from "../actor-kind.js";

const SETTING_NS  = "fourththing";
const SETTING_KEY = "schemaVersion";

/**
 * Ordered migration registry. Each entry upgrades a world FROM (version - 1) TO
 * `version`. migrate() runs GM-side, must be idempotent, and may use the full
 * `game.*` API (it runs on `ready`).
 */
export const MIGRATIONS = [
  {
    version: 1,
    name: "baseline",
    // v1 is the baseline marker. It transforms no data — it simply stamps a
    // schemaVersion onto worlds that predate this framework, establishing a
    // known floor for future migrations. Pre-framework ad-hoc macro migrations
    // are NOT replayed here.
    migrate: async () => { /* no-op baseline */ },
  },
  {
    version: 2,
    name: "stamp-actor-kind",
    // Backfill the denormalized flags.fourththing.kind cache on every existing
    // actor so raw queries / templates can filter by canonical kind. Idempotent:
    // stampActorKind() writes only when the cached value differs from the freshly
    // resolved actorKind(), so re-running is a no-op.
    migrate: async () => {
      let stamped = 0;
      for (const a of (game.actors?.contents ?? [])) {
        try { if (await stampActorKind(a)) stamped++; }
        catch (e) { console.warn(`Roll for Initiation | migration v2: stampActorKind failed for ${a?.name}`, e); }
      }
      console.log(`Roll for Initiation | migration v2 "stamp-actor-kind" — stamped ${stamped} actor(s).`);
    },
  },
];

/** The target schema version = highest version in the registry. */
export const CURRENT_SCHEMA_VERSION =
  MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

/** Register the hidden world setting that records the last-applied version. */
export function registerSchemaVersionSetting() {
  game.settings.register(SETTING_NS, SETTING_KEY, {
    name: "Roll for Initiation — data schema version",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
  });
}

/** Read the world's last-applied schema version (0 if never stamped). */
export function getStoredSchemaVersion() {
  try { return Number(game.settings.get(SETTING_NS, SETTING_KEY)) || 0; }
  catch { return 0; }
}

async function setStoredSchemaVersion(v) {
  await game.settings.set(SETTING_NS, SETTING_KEY, Number(v));
}

/**
 * Run all pending migrations. GM-only and run-once-per-load. Safe to call on
 * every world (no-ops when already current). Pass { force: true } to re-run
 * every migration regardless of stored version (debug/repair — migrations must
 * be idempotent, so this is non-destructive by contract).
 */
export async function runMigrations({ force = false } = {}) {
  // Migrations write world data and must run on exactly one client — the GM's.
  if (!game.user?.isGM) return;

  // Sanity-check the manifest record against the code-derived target.
  const declared = Number(game.system?.flags?.[SETTING_NS]?.schemaVersion);
  if (Number.isFinite(declared) && declared !== CURRENT_SCHEMA_VERSION) {
    console.warn(
      `Roll for Initiation | system.json flags.fourththing.schemaVersion (${declared}) ` +
      `!= code CURRENT_SCHEMA_VERSION (${CURRENT_SCHEMA_VERSION}). Keep them in sync.`
    );
  }

  const stored = getStoredSchemaVersion();
  const target = CURRENT_SCHEMA_VERSION;

  if (stored >= target && !force) return;

  const pending = MIGRATIONS
    .filter(m => force || m.version > stored)
    .sort((a, b) => a.version - b.version);

  if (!pending.length) {
    // Nothing to do but the world is behind the target (shouldn't happen) —
    // stamp it so we don't re-check every load.
    if (stored < target) await setStoredSchemaVersion(target);
    return;
  }

  console.log(
    `Roll for Initiation | Migrating world data ${stored} → ${target} ` +
    `(${pending.length} step${pending.length === 1 ? "" : "s"})`
  );
  ui.notifications?.info(
    `Roll for Initiation: applying ${pending.length} data migration` +
    `${pending.length === 1 ? "" : "s"}…`
  );

  for (const m of pending) {
    try {
      console.log(`Roll for Initiation | Migration ${m.version} "${m.name}" — running`);
      await m.migrate();
      // Advance after each successful step so a later failure can't replay it.
      await setStoredSchemaVersion(Math.max(getStoredSchemaVersion(), m.version));
      console.log(`Roll for Initiation | Migration ${m.version} "${m.name}" — done`);
    } catch (err) {
      console.error(
        `Roll for Initiation | Migration ${m.version} "${m.name}" FAILED — ` +
        `aborting; will retry next load`, err
      );
      ui.notifications?.error(
        `Roll for Initiation: migration ${m.version} ("${m.name}") failed — ` +
        `see console (F12). World left at version ${getStoredSchemaVersion()}.`,
        { permanent: true }
      );
      return;
    }
  }

  console.log(`Roll for Initiation | Migrations complete — world at version ${CURRENT_SCHEMA_VERSION}`);
  ui.notifications?.info(
    `Roll for Initiation: data migrations complete (version ${CURRENT_SCHEMA_VERSION}).`
  );
}
