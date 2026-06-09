// modules/bbttcc-character-options/scripts/enlightenment.js
// BBTTCC — Enlightenment Levels → Character Actor bonuses (dnd5e-safe, minimal)
// FIX: ActiveEffect5e requires "name" (not "label") in v13/dnd5e.

const MOD = "bbttcc-character-options";
const FCT = "bbttcc-factions";
const NS  = "[bbttcc-enlightenment]";
const log = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

// Canonical ladder (ascending), unified to the player-facing sheet vocabulary. The corruption
// branch (qliphothic) sits outside the ascension. This is now the SINGLE source of truth — the
// sheet dropdown, the pack, and the AE engine all speak this. The per-level D&D effects below
// are OWNER-TUNABLE (edit the changes arrays freely; one AE per character, so they never stack).
const LEVEL_KEYS = [
  "unawakened",
  "awakening",
  "seeking",
  "wisdom",
  "understanding",
  "enlightened",
  "qliphothic"
];

// Legacy AE-engine vocabulary → canonical, so old saved actors / dragged pack items still resolve
// (and get the nearest canonical effect) instead of being read as "" and clobbered.
const ALIASES = {
  awakened: "awakening",
  adept: "seeking",
  illuminated: "wisdom",
  transcendent: "enlightened",
  sleeper: "unawakened"
};

const EFFECTS = {
  unawakened: {
    label: "BBTTCC: Unawakened",
    icon: "systems/dnd5e/icons/svg/items/feature.svg",
    changes: [],
    flags: { "bbttcc.enlightenment.unawakened": true }
  },
  awakening: {
    label: "BBTTCC: Awakening",
    icon: "icons/magic/perception/eye-ringed-glow-angry-red.webp",
    changes: [
      { key: "system.bonuses.abilities.save", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.aura": false }
  },
  seeking: {
    label: "BBTTCC: Seeking",
    icon: "icons/magic/perception/third-eye-blue.webp",
    changes: [
      { key: "flags.dnd5e.skills.rel.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
      { key: "flags.dnd5e.skills.ins.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.hints": true }
  },
  wisdom: {
    label: "BBTTCC: Wisdom",
    icon: "icons/magic/holy/meditation-chi-focus-blue.webp",
    changes: [
      { key: "system.bonuses.abilities.check", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1", priority: 20 },
    ],
    flags: {
      "bbttcc.enlightenment.auraClarity": true,
      "bbttcc.enlightenment.auraRange": 10
    }
  },
  understanding: {
    label: "BBTTCC: Understanding",
    icon: "icons/magic/holy/prayer-hands-glowing-yellow.webp",
    changes: [
      { key: "system.bonuses.abilities.save", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+2", priority: 20 },
    ],
    flags: {
      "bbttcc.enlightenment.auraClarity": true,
      "bbttcc.enlightenment.auraRange": 10
    }
  },
  enlightened: {
    label: "BBTTCC: Enlightened",
    icon: "icons/magic/holy/barrier-shield-winged-gold.webp",
    changes: [
      { key: "system.bonuses.abilities.save",  mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+2", priority: 20 },
      { key: "system.bonuses.abilities.check", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1", priority: 20 },
    ],
    flags: {
      "bbttcc.enlightenment.auraClarity": true,
      "bbttcc.enlightenment.auraRange": 15,
      "bbttcc.enlightenment.minorMiracles": true,
      "bbttcc.enlightenment.opRegenBonus": 0.10
    }
  },
  qliphothic: {
    label: "BBTTCC: Qliphothic (Corrupted)",
    icon: "icons/magic/unholy/beam-impact-red.webp",
    changes: [
      { key: "system.traits.dr.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "necrotic", priority: 20 },
      { key: "flags.dnd5e.skills.itm.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
    ],
    flags: {
      "bbttcc.enlightenment.healingHalved": true,
      "bbttcc.enlightenment.darknessSpikes": true
    }
  }
};

// Dropdown-created items (bbttcc-auto-link) carry this category flag and may use a
// different level vocabulary (awakening/seeking/wisdom/...) than the canonical pack
// names. Recognize BOTH so the sheet selection is never silently clobbered.
const CATEGORY = "enlightenment-levels";

// "Enlightenment: Wisdom" -> "wisdom"  ·  "enlightenment-wisdom" -> "wisdom"
function levelSlug(s) {
  const m = String(s ?? "").trim().toLowerCase().match(/^enlightenment[:\-]\s*(.+)$/);
  return m ? m[1].trim().replace(/\s+/g, "-") : "";
}

const titleCase = (s) =>
  String(s ?? "").replace(/(^|-)([a-z])/g, (_, p, c) => (p ? " " : "") + c.toUpperCase());

function detectLevel(actor) {
  const items = (actor.items?.contents ?? actor.items ?? []);
  const found = new Set();

  const resolve = (k) => ALIASES[k] ?? k; // legacy AE-vocab → canonical
  for (const item of items) {
    const slugFromIdent = levelSlug(item?.system?.identifier);
    const slugFromName  = levelSlug(item?.name);
    const isCategoryItem = item?.getFlag?.(MOD, "category") === CATEGORY;

    if (slugFromIdent) found.add(resolve(slugFromIdent));
    else if (slugFromName) found.add(resolve(slugFromName));
    else if (isCategoryItem) found.add("unawakened");
  }
  found.delete("");
  if (!found.size) return "";

  // Any real level outranks "unawakened"; among canonical levels, highest wins
  // (corruption/qliphothic last in LEVEL_KEYS overrides). Non-canonical dropdown
  // levels are reported as-is so the flag mirrors the actual item.
  if (found.size > 1) found.delete("unawakened");
  for (let i = LEVEL_KEYS.length - 1; i >= 0; i--) {
    if (found.has(LEVEL_KEYS[i])) return LEVEL_KEYS[i];
  }
  return [...found][0];
}

async function ensureEffect(actor, key) {
  const toRemove = actor.effects?.filter(e => e.getFlag(MOD, "enlightenment") === true) ?? [];
  if (toRemove.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toRemove.map(e => e.id));
  if (!key || !EFFECTS[key]) return;

  const def = EFFECTS[key];
  const data = {
    name: def.label,
    img: def.icon,
    origin: `Actor.${actor.id}`,
    disabled: false,
    changes: def.changes,
    duration: {},
    flags: { [MOD]: { enlightenment: true, level: key }, ...(def.flags ?? {}) }
  };
  await actor.createEmbeddedDocuments("ActiveEffect", [data]);
}

// Corruption (qliphothic) is not ascension, so it never represents a faction's enlightenment.
function ascensionRank(level) {
  if (level === "qliphothic") return -1;
  const i = LEVEL_KEYS.indexOf(level);
  return i < 0 ? 0 : i;
}

// Fix D — mirror the owning faction's enlightenmentLevel = highest ascension among its member
// characters, so faction-tier mechanics (Enlightened darkness decay) read a live value instead
// of a hand-set flag that drifts from the roster.
async function syncFactionLevel(actor) {
  try {
    const factionId = actor.getFlag(FCT, "factionId");
    if (!factionId) return;
    const faction = game.actors?.get(factionId);
    if (!faction || !faction.isOwner) return; // only a client that can write the faction does so

    let best = "unawakened", bestRank = 0, sawAny = false;
    for (const a of game.actors?.contents ?? []) {
      if (a.type !== "character" || a.getFlag(FCT, "factionId") !== factionId) continue;
      const lvl = a.getFlag(MOD, "enlightenment")?.level || "";
      if (!lvl) continue;
      sawAny = true;
      const r = ascensionRank(lvl);
      if (r > bestRank) { bestRank = r; best = lvl; }
    }
    if (!sawAny) return;
    if (faction.getFlag(FCT, "enlightenmentLevel") !== best)
      await faction.setFlag(FCT, "enlightenmentLevel", best);
  } catch (e) { warn("Faction enlightenment sync failed", e); }
}

// Per-actor serialization: a batch create of >1 level item (or any rapid-fire trigger) fires
// multiple hooks that would otherwise race ensureEffect's delete-then-create and duplicate the
// AE. Chain calls per actor so they run one-at-a-time and converge on a single effect.
const _enlightLocks = new Map();
async function applyEnlightenment(actor) {
  if (!actor || actor.type !== "character") return;
  const prev = _enlightLocks.get(actor.id) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => _applyEnlightenment(actor));
  _enlightLocks.set(actor.id, next);
  try { await next; } finally { if (_enlightLocks.get(actor.id) === next) _enlightLocks.delete(actor.id); }
}

async function _applyEnlightenment(actor) {
  if (!actor || actor.type !== "character") return;

  const level = detectLevel(actor);
  const prev = actor.getFlag(MOD, "enlightenment");
  // Preserve the dropdown's display label when the level is unchanged; otherwise derive it.
  const display = level ? ((prev?.level === level && prev?.display) || titleCase(level)) : "";

  try { await actor.setFlag(MOD, "enlightenment", { level, display }); }
  catch (e) { warn("Failed to set enlightenment flag", e); }

  try { await ensureEffect(actor, level); }
  catch (e) { warn("Failed to ensure enlightenment effect: ", e); }

  try { await syncFactionLevel(actor); }
  catch (e) { warn("Failed to sync faction enlightenment", e); }
}

function decorateSheet(app, html) {
  try {
    const actor = app.actor;
    if (!actor || actor.type !== "character") return;
    const level = (actor.getFlag(MOD, "enlightenment")?.level || "").toUpperCase() || "—";

    const target = html.find(".sheet-body").first().length ? html.find(".sheet-body").first() : html;
    if (!target.length) return;

    target.find("#bbttcc-enlightenment-row").remove();

    const row = $(`
      <section id="bbttcc-enlightenment-row" class="bbttcc card" style="margin:.35rem 0; padding:.35rem; border:1px solid var(--color-border,#555); border-radius:8px;">
        <div class="flexrow" style="gap:.5rem; align-items:center;">
          <strong class="flex0">Enlightenment</strong>
          <span class="flex0">${level}</span>
          <span class="flex1"></span>
          <small class="flex0" style="opacity:.75;">(BBTTCC)</small>
        </div>
      </section>
    `);
    target.prepend(row);
  } catch (_e) {}
}

Hooks.on("renderActorSheet", (app, html) => {
  try { decorateSheet(app, html); } catch(e){ warn("decorateSheet error", e); }
});

Hooks.on("ready", async () => {
  try {
    // Single reconciler on load: avoid every connected client racing to delete/recreate
    // the same ActiveEffect (duplicate effects + permission-error spam). The active GM
    // runs it; if no GM is connected, each client reconciles only the actors it owns.
    const gm = game.users?.activeGM;
    if (gm && !gm.isSelf) return;
    for (const a of game.actors?.contents ?? []) {
      if (a.type === "character" && a.isOwner) await applyEnlightenment(a);
    }
    log("Enlightenment hook ready.");
  } catch (e) { warn("init error", e); }
});

for (const h of ["createItem","updateItem","deleteItem"]) {
  // Document hooks differ in arity: create/delete = (doc, options, userId) [3 args],
  // update = (doc, changes, options, userId) [4 args]. userId is ALWAYS the last arg —
  // reading a fixed 4th param made create/delete reconciliation dead (userId=undefined).
  Hooks.on(h, async (item, ...rest) => {
    const userId = rest[rest.length - 1];
    const actor = item?.parent ?? item?.actor;
    if (!actor || actor.type !== "character") return;
    if (userId !== game.user?.id) return;
    await applyEnlightenment(actor);
  });
}
