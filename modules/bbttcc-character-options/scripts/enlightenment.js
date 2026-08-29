// modules/bbttcc-character-options/scripts/enlightenment.js
// Bad Eden — Enlightenment Levels → Character Actor bonuses (dnd5e-safe, minimal)
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
    label: "Bad Eden: Unawakened",
    icon: "systems/dnd5e/icons/svg/items/feature.svg",
    changes: [],
    flags: { "bbttcc.enlightenment.unawakened": true }
  },
  awakening: {
    label: "Bad Eden: Awakening",
    icon: "icons/magic/perception/eye-ringed-glow-angry-red.webp",
    changes: [
      { key: "system.bonuses.abilities.save", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "+1", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.aura": false }
  },
  seeking: {
    label: "Bad Eden: Seeking",
    icon: "icons/magic/perception/third-eye-blue.webp",
    changes: [
      { key: "flags.dnd5e.skills.rel.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
      { key: "flags.dnd5e.skills.ins.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
    ],
    flags: { "bbttcc.enlightenment.hints": true }
  },
  wisdom: {
    label: "Bad Eden: Wisdom",
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
    label: "Bad Eden: Understanding",
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
    label: "Bad Eden: Enlightened",
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
    label: "Bad Eden: Qliphothic (Corrupted)",
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

    const showMiracle = canMiracle(actor);
    const spent = !!actor.getFlag(MOD, "miracleUsed");
    const miracleBtn = showMiracle
      ? `<button type="button" class="flex0 bbttcc-miracle-btn" ${spent ? "disabled" : ""}
           title="${spent ? "Spent — refreshes on Soma Break" : "Free cast of any power up to Tier 4 — no cost, noise, or backlash"}"
           style="padding:.1rem .4rem;${spent ? "opacity:.5;" : ""}">✦ Miracle${spent ? " (spent)" : ""}</button>`
      : "";

    const row = $(`
      <section id="bbttcc-enlightenment-row" class="bbttcc card" style="margin:.35rem 0; padding:.35rem; border:1px solid var(--color-border,#555); border-radius:8px;">
        <div class="flexrow" style="gap:.5rem; align-items:center;">
          <strong class="flex0">Enlightenment</strong>
          <span class="flex0">${level}</span>
          <span class="flex1"></span>
          ${miracleBtn}
          <small class="flex0" style="opacity:.75;">(Bad Eden)</small>
        </div>
      </section>
    `);
    if (showMiracle && !spent) row.find(".bbttcc-miracle-btn").on("click", () => castMinorMiracle(actor));
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

/* ─────────────────── Enlightened OP Regen Bonus (opRegenBonus 0.10) ───────────────────
 * Implemented 2026-08-28 (atlas dormant #21). A faction with at least one roster
 * character at level "enlightened" gains +10% of whatever OP regen actually landed
 * this Apply turn. Modeled on territory-unitybonus's advanceOPRegen wrapper, but
 * measured by snapshot-delta so it is 10% of the REAL regen (caps still enforced
 * by op.commit). darknessSpikes stays deferred with the personal-Darkness arc. */
const OP_REGEN_BONUS_PCT = 0.10; // mirrors EFFECTS.enlightened flag "bbttcc.enlightenment.opRegenBonus"

function _factionHasEnlightenedMember(faction) {
  try {
    for (const a of game.actors?.contents ?? []) {
      if (a.type !== "character") continue;
      const fid = a.getFlag?.("bbttcc-factions", "factionId") ?? a.system?.faction?.id;
      if (String(fid || "") !== String(faction.id)) continue;
      if (a.getFlag?.(MOD, "enlightenment")?.level === "enlightened") return true;
    }
  } catch (_e) {}
  return false;
}

function _snapOpBanks(factions) {
  const snap = {};
  for (const f of factions) {
    snap[f.id] = foundry.utils.duplicate(f.flags?.["bbttcc-factions"]?.opBank ?? {});
  }
  return snap;
}

function _installOpRegenBonus() {
  const terr = game.bbttcc?.api?.territory;
  const turn = game.bbttcc?.api?.turn;
  const host = (typeof terr?.advanceOPRegen === "function") ? terr
             : (typeof turn?.advanceOPRegen === "function") ? turn : null;
  if (!host) return false;
  if (host.advanceOPRegen.__bbttccEnlightenRegenWrapped) return true;

  const orig = host.advanceOPRegen;
  const wrapped = async function wrappedEnlightenRegen(opts = {}) {
    const apply = !!opts.apply;
    let eligible = [];
    let before = {};
    try {
      if (apply) {
        eligible = (game.actors?.contents ?? []).filter(a =>
          a.getFlag?.("bbttcc-factions", "isFaction") === true && _factionHasEnlightenedMember(a));
        if (opts.factionId) eligible = eligible.filter(a => a.id === String(opts.factionId));
        before = _snapOpBanks(eligible);
      }
    } catch (_e) {}

    const res = await orig(opts);

    try {
      if (apply && eligible.length) {
        const op = game.bbttcc?.api?.op;
        for (const F of eligible) {
          const after = F.flags?.["bbttcc-factions"]?.opBank ?? {};
          const bonus = {};
          for (const [k, v] of Object.entries(after)) {
            const gain = Number(v || 0) - Number(before[F.id]?.[k] || 0);
            if (gain > 0) {
              const b = Math.floor(gain * OP_REGEN_BONUS_PCT);
              if (b > 0) bonus[k] = b;
            }
          }
          if (!Object.keys(bonus).length) continue;
          if (typeof op?.commit === "function") {
            await op.commit(F.id, bonus, { context: "enlightenment-opRegenBonus" });
          }
          log(`OP regen bonus (+10%, enlightened member) → ${F.name}:`, bonus);
        }
      }
    } catch (e) { warn("opRegenBonus wrapper failed:", e); }

    return res;
  };
  wrapped.__bbttccEnlightenRegenWrapped = true;
  host.advanceOPRegen = wrapped;
  log("Enlightened OP regen bonus installed (advanceOPRegen wrapper, +10%).");
  return true;
}

Hooks.once("ready", () => {
  // Territory installs its API on ready too — retry briefly so load order can't lose us.
  let tries = 0;
  const tick = () => { if (!_installOpRegenBonus() && ++tries < 20) setTimeout(tick, 500); };
  tick();
});

/* ─────────────────────── Illuminated Aura (auraClarity) ───────────────────────
 * Wisdom / Understanding / Enlightened emit a clarity aura: friendly tokens within
 * range gain advantage on Perception & Insight. Maintained as a managed AE that
 * follows movement, reconciled by a single client (active GM) to avoid races. */
const AURA_RANGE   = { wisdom: 10, understanding: 10, enlightened: 15 }; // owner-tunable (ft)
const AURA_AE_FLAG = "auraClarityGrant";
const AURA_NAME    = "Clarity (Aura)";

function _auraRangeFor(actor) {
  return AURA_RANGE[actor?.getFlag?.(MOD, "enlightenment")?.level] ?? 0;
}
function _tokCenter(tok, grid) {
  const d = tok.document ?? tok;
  return { x: (d.x ?? 0) + ((d.width ?? 1) * grid) / 2, y: (d.y ?? 0) + ((d.height ?? 1) * grid) / 2 };
}

async function refreshClarityAuras() {
  try {
    const gm = game.users?.activeGM;
    if (gm && !gm.isSelf) return;                 // single reconciler
    const scene = canvas?.scene;
    if (!scene || !canvas?.ready) return;
    const grid = canvas.grid?.size ?? 100;
    const perGrid = scene.grid?.distance ?? 5;
    const toks = canvas.tokens?.placeables ?? [];

    const sources = toks.filter(t => t.actor && _auraRangeFor(t.actor) > 0);
    const recipients = new Set();
    for (const src of sources) {
      const rangePx = (_auraRangeFor(src.actor) / perGrid) * grid + grid / 2;
      const c0 = _tokCenter(src, grid);
      for (const t of toks) {
        if (!t.actor || (t.document?.disposition ?? 0) < 0) continue; // allies/neutral only
        const c1 = _tokCenter(t, grid);
        if (Math.hypot(c0.x - c1.x, c0.y - c1.y) <= rangePx) recipients.add(t);
      }
    }

    for (const t of toks) {
      const actor = t.actor;
      if (!actor) continue;
      const has = actor.effects?.find(e => e.getFlag(MOD, AURA_AE_FLAG) === true);
      const want = recipients.has(t);
      if (want && !has) {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name: AURA_NAME,
          img: "icons/magic/holy/meditation-chi-focus-blue.webp",
          changes: [
            { key: "flags.dnd5e.skills.prc.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
            { key: "flags.dnd5e.skills.ins.adv", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true", priority: 20 },
          ],
          duration: {},
          flags: { [MOD]: { [AURA_AE_FLAG]: true } }
        }]);
      } else if (!want && has) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", [has.id]);
      }
    }
  } catch (e) { warn("clarity aura refresh failed", e); }
}

let _auraTimer = null;
function scheduleAuraRefresh() {
  if (_auraTimer) clearTimeout(_auraTimer);
  _auraTimer = setTimeout(() => { _auraTimer = null; refreshClarityAuras(); }, 200);
}
Hooks.on("canvasReady", scheduleAuraRefresh);
for (const h of ["createToken", "updateToken", "deleteToken"]) Hooks.on(h, () => scheduleAuraRefresh());
Hooks.on("updateActor", (actor, changes) => {
  if (foundry.utils.hasProperty(changes, `flags.${MOD}.enlightenment`)) scheduleAuraRefresh();
});

/* ───────────────────────── Minor Miracles (Enlightened) ───────────────────────
 * A free cast of any power up to Tier 4, bypassing access/tier gating with no
 * Clarity/Blood-Debt cost, no Noise, no misfire/backlash. Once per Soma Break
 * (long rest) — tracked by flags.bbttcc-character-options.miracleUsed, cleared in
 * the system's somaBreak. Routes through fourththing castManifestation({miracle:true}). */
const MIRACLE_LEVELS = new Set(["enlightened"]); // levels granting minorMiracles
const _miracleTier = (i) => Math.max(1, Math.min(4, Number(i?.system?.manifestation?.tier ?? i?.system?.tier) || 1));

function canMiracle(actor) {
  return actor?.type === "character" && MIRACLE_LEVELS.has(actor.getFlag(MOD, "enlightenment")?.level);
}
function miracleAvailable(actor) {
  return canMiracle(actor) && !actor.getFlag(MOD, "miracleUsed");
}

async function _pickMiraclePower(actor) {
  const powers = (actor.items?.contents ?? []).filter(i => (i.type === "power" || i.type === "weapon") && _miracleTier(i) <= 4);
  if (!powers.length) { ui.notifications?.warn(`${actor.name}: no powers/manifestations to work as a miracle.`); return null; }
  const opts = powers.sort((a, b) => _miracleTier(a) - _miracleTier(b) || a.name.localeCompare(b.name))
    .map(p => `<option value="${p.id}">T${_miracleTier(p)} · ${p.name}</option>`).join("");
  const id = await Dialog.wait({
    title: "✦ Minor Miracle",
    content: `<p>Cast any power up to <b>Tier 4</b> — free, silent, no backlash.</p>
      <div class="form-group"><label>Power</label><select id="ft-miracle-pick" style="width:100%">${opts}</select></div>`,
    buttons: {
      cast:   { icon: '<i class="fas fa-star"></i>', label: "Work Miracle", callback: (html) => (html instanceof HTMLElement ? html : html?.[0])?.querySelector("#ft-miracle-pick")?.value },
      cancel: { label: "Cancel", callback: () => null }
    },
    default: "cast"
  }).catch(() => null);
  return id ? actor.items.get(id) : null;
}

async function castMinorMiracle(actor, item = null) {
  if (!canMiracle(actor)) return ui.notifications?.warn(`${actor?.name ?? "Actor"}: Minor Miracles are an Enlightened gift.`);
  if (actor.getFlag(MOD, "miracleUsed")) return ui.notifications?.warn(`${actor.name}: Minor Miracle already spent — refreshes on Soma Break.`);
  const cast = game.fourththing?.castManifestation;
  if (typeof cast !== "function") return ui.notifications?.error("fourththing castManifestation unavailable.");

  if (!item) item = await _pickMiraclePower(actor);
  if (!item) return; // cancelled / none
  const tier = _miracleTier(item);

  await actor.setFlag(MOD, "miracleUsed", true); // claim the charge first (race-safe)
  try {
    const ok = await cast(actor, item, { miracle: true, mode: "hermetic", freeClarity: true, label: `✦ Minor Miracle — ${item.name} (T${tier})` });
    if (ok === false) { await actor.unsetFlag(MOD, "miracleUsed"); return; } // cast aborted → refund
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="bbttcc card">✦ <b>${actor.name}</b> works a <b>Minor Miracle</b> — ${item.name} (T${tier}): free, silent, no backlash.</div>`
    });
  } catch (e) { warn("miracle cast failed", e); await actor.unsetFlag(MOD, "miracleUsed"); }
}

// Public API (merge without clobbering other bbttcc surfaces).
Hooks.on("ready", () => {
  try {
    foundry.utils.setProperty(game, "bbttcc.api.enlightenment", { miracle: castMinorMiracle, canMiracle, miracleAvailable });
  } catch (e) { warn("API expose failed", e); }
});
