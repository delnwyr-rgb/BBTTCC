/* ─────────────────────────────────────────────────────────────────────────────
 * Bad Eden 5E · casting.js — the Flow and Artifice (points-based casting)
 * ─────────────────────────────────────────────────────────────────────────────
 * Two casting traditions, each with its own point pool:
 *   the Flow     — inner casting; Sephirotic (Wis), Qliphothic (Cha), Unaligned (best)
 *   Artifice     — gadget and salvage casting; Int
 *
 *  CLASSES  a class (or subclass) carries flags.bad-eden-5e.casting =
 *           { tradition: "flow"|"artifice", progression: "full"|"3/4"|"half"|"arch" }
 *  POOL     max = Σ class levels × points per level (by progression) + the best
 *           tradition ability mod; state at flags.bad-eden-5e.points.<tradition> =
 *           { value, temp, used[] } (value unset ⇒ full).
 *  POWERS   spell items whose system.method is "be5e-flow" / "be5e-artifice"
 *           (registered spellcasting methods without slots). Cost = level + 1;
 *           at-will (level 0) is free. Upcasting costs +1 per level, up to the
 *           caster's highest power level. Powers at or above the high-level limit
 *           can be cast once each per long rest.
 *  REST     the Flow refills on a long rest; Artifice on a short or long rest.
 *  CROSS    a power can be cast THROUGH the other tradition (Flow-Touched, Crossed
 *           Wires, Wired for Both): flags.bad-eden-5e.castThrough = "flow"|"artifice"
 *           on the power wins over its method for cost, pool, ability and the
 *           spellbook. Features that allow it carry flags.bad-eden-5e.crossCast =
 *           { from, to }; a power of tradition `from` landing on an actor who can't
 *           cast `from` natively is stamped automatically. Toggle by hand from the
 *           spellbook row's context menu or game.badEden5e.castThrough(item, trad).
 *
 * Adapted from the SW5E module's powercasting (MIT) — see NOTICE.md.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const MOD = "bad-eden-5e";

const MAX_LEVEL = {
  full:  [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9],
  "3/4": [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 7],
  half:  [0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5],
  arch:  [0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]
};
const LIMIT = { full: 6, "3/4": 5, half: 4, arch: 4 };

export const TRADITIONS = {
  flow: {
    label: "the Flow", short: "Flow", pointsLabel: "Flow points",
    method: "be5e-flow", attrs: ["wis", "cha"], rest: "long",
    perLevel: { full: 4, "3/4": 3, half: 2, arch: 1 },
    schools: {
      seph: { label: "Sephirotic", attrs: ["wis"], icon: "icons/magic/holy/projectiles-blades-salvo-yellow.webp" },
      qliph: { label: "Qliphothic", attrs: ["cha"], icon: "icons/magic/unholy/orb-glowing-purple.webp" },
      unal: { label: "Unaligned", attrs: ["wis", "cha"], icon: "icons/magic/control/silhouette-hold-change-blue.webp" }
    }
  },
  artifice: {
    label: "Artifice", short: "Artifice", pointsLabel: "Artifice points",
    method: "be5e-artifice", attrs: ["int"], rest: "short", halfStartsAt: 2,
    perLevel: { full: 2, "3/4": 1.5, half: 1, arch: 0.5 },
    schools: {
      art: { label: "Artifice", attrs: ["int"], icon: "icons/tools/hand/wrench-steel-grey.webp" }
    }
  }
};
const METHOD_TO_TRADITION = Object.fromEntries(Object.entries(TRADITIONS).map(([k, t]) => [t.method, k]));

/** The tradition a power belongs to by its casting method, or null if it isn't a Bad Eden power. */
export function nativeTraditionOf(item) {
  return METHOD_TO_TRADITION[item?.system?.method] ?? null;
}

/** The tradition a power is CAST through: a cross-cast flag first, then its own method. */
export function traditionOf(item) {
  const native = nativeTraditionOf(item);
  if (!native) return null;
  const through = item?.flags?.[MOD]?.castThrough;
  return TRADITIONS[through] ? through : native;
}

/** True when the power is cast through the other tradition. */
export const isCrossCast = (item) => !!nativeTraditionOf(item) && traditionOf(item) !== nativeTraditionOf(item);

/* ── Cross-casting features (Flow-Touched, Crossed Wires, Wired for Both) ─── */
// Built features carry flags.bad-eden-5e.crossCast = { from, to }; the name table covers
// copies made before the flag shipped.
const CROSS_CAST_BY_NAME = {
  "Flow-Touched":   { from: "flow",     to: "artifice" },
  "Crossed Wires":  { from: "artifice", to: "flow" },
  "Wired for Both": { from: "artifice", to: "flow" }
};
/** The cross-cast permissions an actor's features grant: [{ from, to, feature }]. */
export function crossCastsFor(actor) {
  const out = [];
  for (const it of actor?.items ?? []) {
    if (it.type !== "feat") continue;
    const cc = it.flags?.[MOD]?.crossCast ?? CROSS_CAST_BY_NAME[it.name];
    if (cc?.from && cc?.to && TRADITIONS[cc.from] && TRADITIONS[cc.to]) out.push({ from: cc.from, to: cc.to, feature: it });
  }
  return out;
}
/** The tradition a new power should be cast through on this actor, or null to leave it native:
 *  the actor can't cast the power's own tradition, and a feature lets it through one they can. */
export function autoCastThrough(actor, item) {
  const native = nativeTraditionOf(item);
  if (!native) return null;
  const casting = castingFor(actor);
  if (casting[native]) return null;
  const cc = crossCastsFor(actor).find(c => c.from === native && casting[c.to]);
  return cc ? cc.to : null;
}
/** Set (or clear, with null) the tradition a power is cast through; re-keys its casting ability. */
export async function castThrough(item, tradition) {
  if (!nativeTraditionOf(item)) throw new Error(`${item?.name ?? "item"} is not a Bad Eden power`);
  const to = tradition && tradition !== nativeTraditionOf(item) && TRADITIONS[tradition] ? tradition : null;
  // v14 dropped the "-=key" deletion syntax for flags: unsetFlag, then the ability.
  if (!to) await item.unsetFlag(MOD, "castThrough");
  const update = to ? { [`flags.${MOD}.castThrough`]: to } : {};
  if (item.parent instanceof Actor) {
    const trad = TRADITIONS[to ?? nativeTraditionOf(item)];
    const school = to ? null : trad.schools[item.system?.school];
    update["system.ability"] = bestOf(item.parent, school?.attrs ?? trad.attrs);
  }
  return Object.keys(update).length ? item.update(update) : item;
}

const abilityMod = (actor, key) => Number(actor?.system?.abilities?.[key]?.mod) || 0;
const bestOf = (actor, keys) => keys.reduce((best, k) => (abilityMod(actor, k) > abilityMod(actor, best) ? k : best), keys[0]);

/** The ability a power uses: its school's ability, the better one for Unaligned. */
export function abilityFor(actor, item) {
  const trad = TRADITIONS[traditionOf(item)];
  if (!trad) return null;
  // Cast through the other tradition = that tradition's ability (Flow-Touched: Intelligence;
  // Crossed Wires / Wired for Both: the Flow ability), not the power's school.
  const school = isCrossCast(item) ? null : trad.schools[item.system?.school];
  return bestOf(actor, school?.attrs ?? trad.attrs);
}

/** Everything about an actor's casting in each tradition it has (empty object if none). */
export function castingFor(actor) {
  const out = {};
  if (!actor) return out;
  const classes = actor.items?.filter?.(i => i.type === "class") ?? [];
  for (const [key, trad] of Object.entries(TRADITIONS)) {
    let points = 0, casterLevel = 0, classesCount = 0, single = null, maxOf20 = 0;
    for (const cls of classes) {
      const levels = Number(cls.system?.levels) || 0;
      const sub = cls.subclass ?? actor.items.find(i => i.type === "subclass" && i.system?.classIdentifier === cls.system?.identifier);
      const cast = sub?.flags?.[MOD]?.casting?.tradition === key ? sub.flags[MOD].casting
        : cls.flags?.[MOD]?.casting?.tradition === key ? cls.flags[MOD].casting : null;
      const prog = cast?.progression;
      if (!prog || !MAX_LEVEL[prog] || levels < 1) continue;
      if (prog === "half" && trad.halfStartsAt && levels < trad.halfStartsAt) continue;
      classesCount++;
      points += levels * (trad.perLevel[prog] ?? 0);
      casterLevel += levels * MAX_LEVEL[prog][20] / 9;
      maxOf20 = Math.max(maxOf20, MAX_LEVEL[prog][20]);
      if (!single || levels > single.levels) single = { levels, prog };
    }
    // bonus.<trad> is tradition-specific; bonus.points (Deep Well, Drawing Deep: the RFI Clarity
    // bonus) lands on every tradition the actor has class levels in.
    const bonus = (Number(actor.flags?.[MOD]?.bonus?.[key]) || 0) + (classesCount ? Number(actor.flags?.[MOD]?.bonus?.points) || 0 : 0);
    if (!classesCount && !bonus) continue;
    casterLevel = Math.round(casterLevel);
    const maxPowerLevel = classesCount === 1 ? MAX_LEVEL[single.prog][single.levels]
      : Math.min(maxOf20, MAX_LEVEL.full[Math.min(20, casterLevel)] ?? 0);
    const ability = bestOf(actor, trad.attrs);
    // Midstream (Set of the Current): both Flow abilities count, not just the better one.
    const midstream = key === "flow" && classesCount && actor.flags?.[MOD]?.midstream
      ? trad.attrs.filter(a => a !== ability).reduce((s, a) => s + abilityMod(actor, a), 0) : 0;
    const max = Math.max(0, Math.round(points) + (classesCount ? abilityMod(actor, ability) : 0) + midstream + bonus);
    const state = actor.flags?.[MOD]?.points?.[key] ?? {};
    const value = Number.isFinite(state.value) ? Math.min(state.value, max) : max;
    out[key] = {
      key, label: trad.label, pointsLabel: trad.pointsLabel, ability,
      max, value, temp: Number(state.temp) || 0,
      maxPowerLevel, limit: single ? LIMIT[single.prog] : 0, level: casterLevel,
      used: new Set(state.used ?? [])
    };
  }
  return out;
}

/** Point cost of casting a power at a given level. */
export const costAt = (level) => (Number(level) > 0 ? Number(level) + 1 : 0);

/** The cost for THIS actor: costAt(level) less the technique discounts —
 *  flags.bad-eden-5e.discount.upcast (Pay the Toll, Lucid Footing: each upcast step costs 1 less,
 *  never below the base cost) and discount.level1 (Frugal Caster: level-1 powers cost 1 less, min 0). */
export function costFor(actor, base, level) {
  const b = Number(base) || 0, l = Number(level) || 0;
  if (l < 1) return 0;
  const d = actor?.flags?.[MOD]?.discount ?? {};
  let cost = costAt(l);
  if (l > b) cost -= Math.min(Number(d.upcast) || 0, l - b);
  if (l === 1) cost -= Number(d.level1) || 0;
  return Math.max(0, cost);
}

/** Set a tradition's points (value and/or temp). */
export async function setPoints(actor, key, { value, temp } = {}) {
  const update = {};
  if (value !== undefined) update[`flags.${MOD}.points.${key}.value`] = Math.max(0, Math.round(value));
  if (temp !== undefined) update[`flags.${MOD}.points.${key}.temp`] = Math.max(0, Math.round(temp));
  if (Object.keys(update).length) await actor.update(update);
}

/** Give back n points in every tradition the actor casts (capped at max). Returns what landed. */
export async function restorePoints(actor, n) {
  const casting = castingFor(actor);
  const update = {}, got = {};
  for (const [k, c] of Object.entries(casting)) {
    const next = Math.min(c.max, c.value + Math.max(0, Math.round(n)));
    if (next === c.value) continue;
    update[`flags.${MOD}.points.${k}.value`] = next; got[k] = next - c.value;
  }
  if (Object.keys(update).length) await actor.update(update);
  return got;
}

/** Refill the given traditions (default: all) and clear their high-level use marks. */
export async function restore(actor, keys = Object.keys(TRADITIONS)) {
  const casting = castingFor(actor);
  const update = {};
  for (const k of keys) {
    if (!casting[k]) continue;
    update[`flags.${MOD}.points.${k}.value`] = casting[k].max;
    if (TRADITIONS[k].rest === "long" || keys.length > 1) update[`flags.${MOD}.points.${k}.used`] = [];
  }
  if (Object.keys(update).length) await actor.update(update);
}

/* ── Registration (init) ──────────────────────────────────────────────────── */
export function registerConfig() {
  // Casting methods without slots; dnd5e turns these into models at i18nInit.
  CONFIG.DND5E.spellcasting["be5e-flow"] = { label: "The Flow", order: 30, img: "icons/magic/light/orb-lightbulb-gray.webp" };
  CONFIG.DND5E.spellcasting["be5e-artifice"] = { label: "Artifice", order: 31, img: "icons/tools/hand/wrench-steel-grey.webp" };
  for (const trad of Object.values(TRADITIONS)) {
    for (const [k, s] of Object.entries(trad.schools)) {
      CONFIG.DND5E.spellSchools[k] ??= { label: s.label, icon: s.icon, fullKey: s.label.toLowerCase() };
    }
  }
}

/* ── The spellbook: one section per tradition and power level ─────────────── */
function patchSpellbook() {
  const Base = dnd5e?.applications?.actor?.BaseActorSheet;
  if (!Base?.prototype?._prepareSpellbook) return console.warn(`${MOD} | spellbook hook not installed`);
  const original = Base.prototype._prepareSpellbook;
  Base.prototype._prepareSpellbook = function (context) {
    const book = original.call(this, context);
    try {
      const sections = {};
      for (const [key, section] of Object.entries(book)) {
        const items = section.items ?? [];
        const powers = items.filter(i => traditionOf(i));
        if (!powers.length) continue;
        for (const item of powers) {
          const tk = traditionOf(item), trad = TRADITIONS[tk];
          const level = Number(item.system.level) || 0;
          const id = `be5e-${tk}-${level}`;
          sections[id] ??= {
            ...section,
            label: level === 0 ? `${trad.short}: At-Will` : `${trad.short}: ${CONFIG.DND5E.spellLevels[level] ?? `Level ${level}`}`,
            order: (tk === "artifice" ? 200 : 100) + level,
            usesSlots: false, pips: undefined,
            id: trad.method, slot: id, items: [],
            dataset: { ...(section.dataset ?? {}), level, method: trad.method, type: "spell" }
          };
          sections[id].items.push(item);
        }
        const rest = items.filter(i => !traditionOf(i));
        if (rest.length) section.items = rest;
        else delete book[key];
      }
      Object.assign(book, sections);
    } catch (e) { console.warn(`${MOD} | spellbook refile failed`, e); }
    return book;
  };
}

/* ── Casting: gate, upcast picker, payment ────────────────────────────────── */
const baseLevel = (activity) => Number(activity?.item?._source?.system?.level ?? activity?.item?.system?.level ?? 0);

function onPreUseActivity(activity, usageConfig, dialogConfig) {
  const tk = traditionOf(activity?.item);
  if (!tk) return;
  const c = castingFor(activity.actor)[tk];
  const level = baseLevel(activity);
  const label = TRADITIONS[tk].pointsLabel;
  if (level > 0 && !c) {
    ui.notifications?.warn?.(`${activity.actor.name} can't cast ${activity.item.name}: no ${TRADITIONS[tk].label} casting.`);
    return false;
  }
  if (level > 0 && level > c.maxPowerLevel) {
    ui.notifications?.warn?.(`${activity.item.name} is level ${level}; ${activity.actor.name} can cast up to level ${c.maxPowerLevel}.`);
    return false;
  }
  if (level > 0 && (c.value + c.temp) < costFor(activity.actor, level, level)) {
    ui.notifications?.warn?.(`Not enough ${label} for ${activity.item.name} (needs ${costFor(activity.actor, level, level)}, have ${c.value + c.temp}).`);
    return false;
  }
  // A scripted cast can ask for a level: activity.use({ be5eLevel: 3 }, { configure: false }).
  const asked = Number(usageConfig.be5eLevel);
  if (level > 0 && Number.isFinite(asked) && asked > level) {
    if (asked > c.maxPowerLevel) {
      ui.notifications?.warn?.(`${activity.actor.name} can cast up to level ${c.maxPowerLevel}.`);
      return false;
    }
    usageConfig.scaling = asked - level;
    return;
  }
  // Offer the upcast picker whenever a higher level is within reach.
  if (level > 0 && c.maxPowerLevel > level && usageConfig.scaling === false) usageConfig.scaling = 0;
}

function patchUsageDialog() {
  const Dialog = dnd5e?.applications?.activity?.ActivityUsageDialog;
  if (!Dialog?.prototype?._prepareScalingContext) return console.warn(`${MOD} | upcast picker not installed`);
  const prepScaling = Dialog.prototype._prepareScalingContext;
  Dialog.prototype._prepareScalingContext = async function (context, options) {
    context = await prepScaling.call(this, context, options);
    const tk = traditionOf(this.item);
    if (!tk || !this._shouldDisplay?.("scaling")) return context;
    const base = baseLevel(this.activity);
    const c = castingFor(this.actor)[tk];
    if (base < 1 || !c) return context;
    const label = TRADITIONS[tk].pointsLabel;
    const available = c.value + c.temp;
    const options_ = [];
    for (let lvl = base; lvl <= Math.max(base, c.maxPowerLevel); lvl++) {
      const cost = costFor(this.actor, base, lvl);
      const spentHigh = c.limit > 0 && lvl >= c.limit && c.used.has(lvl);
      options_.push({ value: String(lvl), label: `${CONFIG.DND5E.spellLevels[lvl] ?? lvl} (${cost} ${label})`, disabled: spentHigh || cost > available });
    }
    const current = String(base + (Number(this.config.scaling) || 0));
    const chosen = options_.find(o => o.value === current && !o.disabled) ?? options_.find(o => !o.disabled);
    options_.forEach(o => (o.selected = o === chosen));
    context.hasScaling = true;
    delete context.scaling;
    context.spellSlots = {
      field: new foundry.data.fields.StringField({ required: true, blank: false, label: game.i18n.localize("DND5E.SpellCastUpcast") }),
      name: "spell.slot", value: chosen?.value ?? String(base), options: options_
    };
    context.notes = (context.notes ?? []).filter(n => !/spell slot/i.test(n.message ?? ""));
    if (!chosen) context.notes.push({ type: "warn", message: `Not enough ${label} to cast ${this.item.name}.` });
    return context;
  };
  const prepSubmit = Dialog.prototype._prepareSubmitData;
  Dialog.prototype._prepareSubmitData = async function (event, formData) {
    const tk = traditionOf(this.item);
    if (!tk) return prepSubmit.call(this, event, formData);
    // Read our level before dnd5e maps spell.slot onto (absent) spell slots.
    const raw = foundry.utils.expandObject(formData.object)?.spell?.slot;
    const data = await prepSubmit.call(this, event, formData);
    if (raw !== undefined) {
      data.scaling = Math.max(0, (Number(raw) || 0) - baseLevel(this.activity));
      if (data.spell) delete data.spell.slot;
    }
    return data;
  };
}

function onActivityConsumption(activity, usageConfig, messageConfig, updates) {
  const tk = traditionOf(activity?.item);
  if (!tk) return;
  const c = castingFor(activity.actor)[tk];
  const base = baseLevel(activity);
  const level = base + (Number(usageConfig?.scaling) || 0);
  const cost = costFor(activity.actor, base, level);
  if (!c || !cost) return;
  if ((c.value + c.temp) < cost) {
    ui.notifications?.warn?.(`Not enough ${TRADITIONS[tk].pointsLabel} (needs ${cost}, have ${c.value + c.temp}).`);
    return false;
  }
  if (c.limit > 0 && level >= c.limit && c.used.has(level)) {
    ui.notifications?.warn?.(`${activity.actor.name} has already cast a level ${level} power since the last long rest.`);
    return false;
  }
  const fromTemp = Math.min(c.temp, cost);
  updates.actor ??= {};
  updates.actor[`flags.${MOD}.points.${tk}.temp`] = c.temp - fromTemp;
  updates.actor[`flags.${MOD}.points.${tk}.value`] = c.value - (cost - fromTemp);
  if (c.limit > 0 && level >= c.limit) updates.actor[`flags.${MOD}.points.${tk}.used`] = [...c.used, level];
  messageConfig.data ??= {};
  messageConfig.data.flags = foundry.utils.mergeObject(messageConfig.data.flags ?? {}, { [MOD]: { cast: { tradition: tk, level, cost, through: isCrossCast(activity.item) ? tk : null } } });
}

// A power gets its casting ability when it lands on an actor — and is routed through the
// other tradition when a feature allows it and the actor can't cast it natively.
function onPreCreateItem(item, data) {
  if (!(item.parent instanceof Actor) || !nativeTraditionOf(item)) return;
  const update = {};
  const through = item.flags?.[MOD]?.castThrough ? null : autoCastThrough(item.parent, item);
  if (through) update[`flags.${MOD}.castThrough`] = through;
  if (!item.system?.ability || through) {
    const trad = TRADITIONS[through ?? traditionOf(item)];
    const school = through || isCrossCast(item) ? null : trad.schools[item.system?.school];
    update["system.ability"] = bestOf(item.parent, school?.attrs ?? trad.attrs);
  }
  if (Object.keys(update).length) item.updateSource(update);
}

// After the fact, for the orders preCreateItem can't see: a power created in the same batch
// as its feature, or a cross-cast feature landing on an actor who already holds the powers.
// Runs on the creating client only, once the batch has settled.
function onCreateItem(item, options, userId) {
  if (userId !== game.user.id || !(item.parent instanceof Actor)) return;
  const actor = item.parent;
  const isFeature = item.type === "feat" && !!(item.flags?.[MOD]?.crossCast ?? CROSS_CAST_BY_NAME[item.name]);
  if (!isFeature && !nativeTraditionOf(item)) return;
  setTimeout(async () => {
    try {
      const powers = isFeature ? actor.items.filter(i => nativeTraditionOf(i)) : [actor.items.get(item.id)].filter(Boolean);
      for (const pw of powers) {
        if (pw.flags?.[MOD]?.castThrough) continue;
        const to = autoCastThrough(actor, pw);
        if (to) await castThrough(pw, to);
      }
    } catch (e) { console.warn(`${MOD} | cross-cast routing failed`, e); }
  }, 0);
}

// Spellbook row context menu: route a power through the other tradition, or back.
function onItemContextOptions(item, options) {
  const actor = item?.parent;
  const native = nativeTraditionOf(item);
  if (!(actor instanceof Actor) || !native || !actor.isOwner) return;
  const other = Object.keys(TRADITIONS).find(k => k !== native);
  const casting = castingFor(actor);
  if (!casting[other] && !isCrossCast(item)) return;
  const through = isCrossCast(item);
  options.push({
    name: through ? `Cast as ${TRADITIONS[native].short} again` : `Cast through ${TRADITIONS[other].label}`,
    icon: '<i class="fas fa-exchange-alt"></i>',
    group: "action",
    callback: () => castThrough(item, through ? null : other)
  });
}

function onRestCompleted(actor, result) {
  if (!actor?.isOwner) return;   // restCompleted fires on the resting client
  const keys = result?.longRest ? Object.keys(TRADITIONS) : Object.keys(TRADITIONS).filter(k => TRADITIONS[k].rest === "short");
  if (keys.length) restore(actor, keys).catch(e => console.warn(`${MOD} | rest restore failed`, e));
}

/* ── The points meters on the character sheet ─────────────────────────────── */
function meterHTML(c) {
  const pct = c.max ? Math.min(100, Math.round(100 * c.value / c.max)) : 0;
  return `<div class="be5e-points" data-be5e-trad="${c.key}" data-tooltip="${c.pointsLabel}: ${c.value}/${c.max}${c.temp ? ` (+${c.temp} temp)` : ""} · highest power level ${c.maxPowerLevel}">
    <span class="be5e-points-label">${c.pointsLabel}</span>
    <div class="be5e-points-meter"><div class="be5e-points-bar" style="width:${pct}%"></div>
      <span class="be5e-points-value"><input type="number" min="0" value="${c.value}" data-be5e-edit="${c.key}" aria-label="${c.pointsLabel}"> / ${c.max}${c.temp ? ` <em>+${c.temp}</em>` : ""}</span>
    </div>
  </div>`;
}
function onRenderSheet(app, element) {
  const actor = app.actor ?? app.document;
  if (actor?.type !== "character") return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root) return;
  root.querySelector(".be5e-points-group")?.remove();
  const casting = Object.values(castingFor(actor));
  if (!casting.length) return;
  const anchor = root.querySelector(".sidebar .meter-group") ?? root.querySelector(".sidebar");
  if (!anchor) return;
  const group = document.createElement("div");
  group.className = "be5e-points-group";
  group.innerHTML = casting.map(meterHTML).join("");
  if (anchor.classList.contains("meter-group")) anchor.after(group); else anchor.prepend(group);
  group.querySelectorAll("input[data-be5e-edit]").forEach(input => {
    if (!actor.isOwner) { input.disabled = true; return; }
    input.addEventListener("change", ev => setPoints(actor, ev.currentTarget.dataset.be5eEdit, { value: Number(ev.currentTarget.value) }));
  });
}

export function activateCasting() {
  // dnd5e builds its spellcasting models at i18nInit from the base type, which has no
  // getSpellSlotKey; a scalable spell's usage config calls it anyway. Answer with the
  // method key, exactly as dnd5e falls back to elsewhere.
  for (const trad of Object.values(TRADITIONS)) {
    const model = CONFIG.DND5E?.spellcasting?.[trad.method];
    if (model && typeof model.getSpellSlotKey !== "function") Object.defineProperty(model, "getSpellSlotKey", { value: () => trad.method, configurable: true });
  }
  patchSpellbook();
  patchUsageDialog();
  Hooks.on("dnd5e.preUseActivity", onPreUseActivity);
  Hooks.on("dnd5e.activityConsumption", onActivityConsumption);
  Hooks.on("preCreateItem", onPreCreateItem);
  Hooks.on("createItem", onCreateItem);
  Hooks.on("dnd5e.getItemContextOptions", onItemContextOptions);
  Hooks.on("dnd5e.restCompleted", onRestCompleted);
  Hooks.on("renderCharacterActorSheet", onRenderSheet);
}
