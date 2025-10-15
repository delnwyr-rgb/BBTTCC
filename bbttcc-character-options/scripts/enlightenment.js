// modules/bbttcc-character-options/scripts/enlightenment.js
// BBTTCC — Enlightenment Levels → Character Actor bonuses (dnd5e-safe, minimal)
// Source: User’s Guide — Enlightenment Levels (Sleeper → Transcendent, plus Qliphothic)

const MOD = "bbttcc-character-options";
const NS  = "[bbttcc-enlightenment]";
const log = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

// --- Config: names we look for on Items (case-insensitive) ---
const LEVEL_KEYS = [
  "sleeper",
  "awakened",
  "adept",
  "illuminated",
  "transcendent",
  "qliphothic"
];

// Effect definitions (minimal + safe).
// Notes:
// • We prefer native dnd5e-compatible keys where they are stable.
// • For “aura” or narrative benefits we set flags under our namespace so your code can use them in play.
const EFFECTS = {
  awakened: {
    label: "BBTTCC: Awakened",
    icon: "icons/magic/perception/eye-ringed-glow-angry-red.webp",
    // +1 WIS saves (safe, generic bonus)
    changes: [
      { key: "system.bonuses.abilities.save", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1", priority: 20, },
    ],
    flags: { "bbttcc.enlightenment.aura": false }
  },
  adept: {
    label: "BBTTCC: Adept",
    icon: "icons/magic/perception/third-eye-blue.webp",
    // Advantage on checks to understand alignments → we approximate with advantage on Religion/Insight skill checks.
    // dnd5e supports per-skill advantage flags:
    //  - flags.dnd5e.skills.[skillId].adv = true
    changes: [
      { key: "flags.dnd5e.skills.rel.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
      { key: "flags.dnd5e.skills.ins.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.hints": true }
  },
  illuminated: {
    label: "BBTTCC: Illuminated",
    icon: "icons/magic/holy/meditation-chi-focus-blue.webp",
    // Aura of clarity vs fear/despair → give allies advantage vs frightened while near (needs GM adjudication),
    // but we mark this as an aura flag; you can script it in encounters.
    changes: [],
    flags: {
      "bbttcc.enlightenment.auraClarity": true,
      "bbttcc.enlightenment.auraRange": 10
    }
  },
  transcendent: {
    label: "BBTTCC: Transcendent",
    icon: "icons/magic/holy/barrier-shield-winged-gold.webp",
    // Minor miracle (calm emotions/sanctuary at will) is narrative; we avoid auto-granting spells.
    // Strategic: +10% faction OP regen — we expose as a flag so your Faction roll-up can consume it.
    changes: [],
    flags: {
      "bbttcc.enlightenment.minorMiracles": true,
      "bbttcc.enlightenment.opRegenBonus": 0.10
    }
  },
  qliphothic: {
    label: "BBTTCC: Qliphothic (Corrupted)",
    icon: "icons/magic/unholy/beam-impact-red.webp",
    // Resist necrotic; advantage on Intimidation; healing halved (dangerous to automate globally, so we flag)
    changes: [
      { key: "system.traits.dr.value", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "necrotic", priority: 20 },
      { key: "flags.dnd5e.skills.itm.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
    ],
    flags: {
      "bbttcc.enlightenment.healingHalved": true,          // For GM guidance / custom hooks
      "bbttcc.enlightenment.darknessSpikes": true          // For Darkness Track code to consume
    }
  },
  sleeper: {
    label: "BBTTCC: Sleeper",
    icon: "icons/magic/air/air-burst-spiral-blue.webp",
    changes: [], flags: { "bbttcc.enlightenment.sleeper": true }
  }
};

// Returns actor enlightenment key from any owned Item whose name matches LEVEL_KEYS
function detectLevel(actor) {
  const names = (actor.items?.contents ?? actor.items ?? []).map(i => String(i.name ?? "").toLowerCase());
  for (const key of LEVEL_KEYS) {
    if (names.some(n => n.includes(key))) return key;
  }
  return ""; // none
}

async function ensureEffect(actor, key) {
  // remove previous enlightenment effects we own
  const toRemove = actor.effects?.filter(e => e.getFlag(MOD, "enlightenment") === true) ?? [];
  if (toRemove.length) await actor.deleteEmbeddedDocuments("ActiveEffect", toRemove.map(e => e.id));
  if (!key || !EFFECTS[key]) return;

  const def = EFFECTS[key];
  const data = {
    label: def.label,
    icon: def.icon,
    origin: `Actor.${actor.id}`,
    disabled: false,
    changes: def.changes,
    duration: { },
    flags: { [MOD]: { enlightenment: true, level: key }, ...(def.flags ?? {}) }
  };
  await actor.createEmbeddedDocuments("ActiveEffect", [data]);
}

async function applyEnlightenment(actor) {
  if (!actor || actor.type !== "character") return;

  // 1) Detect the current level (items on the actor)
  const level = detectLevel(actor);

  // 2) Persist to flags (so other BBTTCC code can read it)
  try {
    await actor.setFlag(MOD, "enlightenment", { level });
  } catch (e) { warn("Failed to set enlightenment flag", e); }

  // 3) Apply appropriate AE (or remove if none)
  try {
    await ensureEffect(actor, level);
  } catch (e) { warn("Failed to ensure enlightenment effect: ", e); }
}

// Inject a tiny readout into your BBTTCC panel (if present)
function decorateSheet(app, html) {
  try {
    const actor = app.actor;
    if (!actor || actor.type !== "character") return;
    const level = (actor.getFlag(MOD, "enlightenment")?.level || "").toUpperCase() || "—";

    // Find an existing BBTTCC section if you have one; otherwise, place top of the sheet body
    const target = html.find(".sheet-body").first().length ? html.find(".sheet-body").first() : html;
    if (!target.length) return;

    // Remove prior row
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

/* ---------- Hooks ---------- */

// When a character sheet renders, add readout
Hooks.on("renderActorSheet", (app, html) => {
  try { decorateSheet(app, html); } catch(e){ warn("decorateSheet error", e); }
});

// Re-evaluate enlightenment on ready and whenever items are created/updated/deleted
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
    // only respond for the active user to reduce churn
    if (userId !== game.user?.id) return;
    await applyEnlightenment(actor);
  });
}
