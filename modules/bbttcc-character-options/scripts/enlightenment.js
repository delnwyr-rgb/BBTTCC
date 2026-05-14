// modules/bbttcc-character-options/scripts/enlightenment.js
// BBTTCC — Enlightenment Levels → Character Actor bonuses (dnd5e-safe, minimal)
// FIX: ActiveEffect5e requires "name" (not "label") in v13/dnd5e.

const MOD = "bbttcc-character-options";
const NS  = "[bbttcc-enlightenment]";
const log = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

const LEVEL_KEYS = [
  "unawakened",
  "sleeper",
  "awakened",
  "adept",
  "illuminated",
  "transcendent",
  "qliphothic"
];

const EFFECTS = {
  unawakened: {
    label: "BBTTCC: Unawakened",
    icon: "systems/dnd5e/icons/svg/items/feature.svg",
    changes: [],
    flags: { "bbttcc.enlightenment.unawakened": true }
  },
  awakened: {
    label: "BBTTCC: Awakened",
    icon: "icons/magic/perception/eye-ringed-glow-angry-red.webp",
    changes: [
      { key: "system.bonuses.abilities.save", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.aura": false }
  },
  adept: {
    label: "BBTTCC: Adept",
    icon: "icons/magic/perception/third-eye-blue.webp",
    changes: [
      { key: "flags.dnd5e.skills.rel.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
      { key: "flags.dnd5e.skills.ins.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.hints": true }
  },
  illuminated: {
    label: "BBTTCC: Illuminated",
    icon: "icons/magic/holy/meditation-chi-focus-blue.webp",
    changes: [],
    flags: {
      "bbttcc.enlightenment.auraClarity": true,
      "bbttcc.enlightenment.auraRange": 10
    }
  },
  transcendent: {
    label: "BBTTCC: Transcendent",
    icon: "icons/magic/holy/barrier-shield-winged-gold.webp",
    changes: [],
    flags: {
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
  },
  sleeper: {
    label: "BBTTCC: Sleeper",
    icon: "icons/magic/air/air-burst-spiral-blue.webp",
    changes: [],
    flags: { "bbttcc.enlightenment.sleeper": true }
  }
};

function detectLevel(actor) {
  const items = (actor.items?.contents ?? actor.items ?? []);
  const exactNames = new Set();
  const identifiers = new Set();

  for (const item of items) {
    const name = String(item?.name ?? "").trim().toLowerCase();
    const identifier = String(item?.system?.identifier ?? "").trim().toLowerCase();
    if (name) exactNames.add(name);
    if (identifier) identifiers.add(identifier);
  }

  if (identifiers.has("enlightenment-unawakened") || exactNames.has("enlightenment: unawakened")) return "unawakened";

  for (const key of LEVEL_KEYS) {
    if (identifiers.has(`enlightenment-${key}`)) return key;
    if (exactNames.has(`enlightenment: ${key}`)) return key;
  }

  return "";
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

async function applyEnlightenment(actor) {
  if (!actor || actor.type !== "character") return;

  const level = detectLevel(actor);

  try { await actor.setFlag(MOD, "enlightenment", { level }); }
  catch (e) { warn("Failed to set enlightenment flag", e); }

  try { await ensureEffect(actor, level); }
  catch (e) { warn("Failed to ensure enlightenment effect: ", e); }
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
    for (const a of game.actors?.contents ?? []) if (a.type === "character") await applyEnlightenment(a);
    log("Enlightenment hook ready.");
  } catch (e) { warn("init error", e); }
});

for (const h of ["createItem","updateItem","deleteItem"]) {
  Hooks.on(h, async (item, _data, _opt, userId) => {
    const actor = item?.parent ?? item?.actor;
    if (!actor || actor.type !== "character") return;
    if (userId !== game.user?.id) return;
    await applyEnlightenment(actor);
  });
}
