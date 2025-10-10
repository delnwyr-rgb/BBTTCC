// modules/bbttcc-factions/scripts/module.js
// v1.0.1 — Fix: remove stray top-level 'root' usage so the sheet registers again.
// Keeps: no per-bucket cap, d20 roll buttons, Recalc All, Create Faction,
// Territory (This Scene) summary, War Logs passthrough.

const MODULE_ID = "bbttcc-factions";

const log  = (...a) => console.log(`[${MODULE_ID}]`, ...a);
const warn = (...a) => console.warn(`[${MODULE_ID}]`, ...a);

function isFactionActor(a) {
  if (!a) return false;
  try {
    if (a.getFlag?.(MODULE_ID, "isFaction") === true) return true;
    const t = String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase();
    return t === "faction";
  } catch { return false; }
}
function isCharacter(a) { return String(a?.type ?? "").toLowerCase() === "character"; }
async function ensureFactionHints(a) {
  try {
    if (isFactionActor(a) && a.getFlag(MODULE_ID, "isFaction") !== true) await a.setFlag(MODULE_ID, "isFaction", true);
    if (a.system?.details?.type?.value !== "faction") await a.update({ "system.details.type.value": "faction" });
  } catch (e) { warn("ensureFactionHints failed", e); }
}
function listFactionActors() { return game.actors.contents.filter(isFactionActor); }
const clamp0 = (v) => Math.max(0, Number(v ?? 0) || 0);

/** Power bands for label (unchanged) */
const POWER_BANDS = [
  { key: "Emerging",    min: 0,  max: 9 },
  { key: "Growing",     min: 10, max: 24 },
  { key: "Established", min: 25, max: 39 },
  { key: "Powerful",    min: 40, max: 54 },
  { key: "Dominant",    min: 55, max: Infinity }
];
function computePowerKey(totalOPs) {
  for (const b of POWER_BANDS) if (totalOPs >= b.min && totalOPs <= b.max) return b.key;
  return "Emerging";
}

class BBTTCCFactionSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bbttcc-faction-sheet",
      classes: ["bbttcc", "sheet", "actor"],
      template: `modules/${MODULE_ID}/templates/faction-sheet.hbs`,
      width: 1000,
      height: "auto",
      scrollY: [".bbttcc-faction-body"],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  async _canUserView(u) { return (await super._canUserView(u)) && isFactionActor(this.actor); }

  _normalizeOps(obj = {}) {
    return {
      violence:   Number(obj.violence   ?? 0),
      nonlethal:  Number(obj.nonlethal  ?? obj.nonLethal ?? 0),
      intrigue:   Number(obj.intrigue   ?? 0),
      economy:    Number(obj.economy    ?? 0),
      softpower:  Number(obj.softpower  ?? obj.softPower ?? 0),
      diplomacy:  Number(obj.diplomacy  ?? 0),
      logistics:  Number(obj.logistics  ?? 0),
      culture:    Number(obj.culture    ?? 0),
      faith:      Number(obj.faith      ?? 0)
    };
  }

  _characterBelongsToFaction(char) {
    const byId = char.getFlag?.(MODULE_ID, "factionId");
    if (byId) return byId === this.actor.id;
    const legacyName = char?.flags?.["bbttcc-territory"]?.faction;
    if (!legacyName) return false;
    return String(legacyName).trim() === String(this.actor.name).trim();
  }

  _collectRosterAndContribs() {
    const roster = [];
    const totals = { violence:0, nonlethal:0, intrigue:0, economy:0, softpower:0, diplomacy:0, logistics:0, culture:0, faith:0 };

    for (const a of game.actors.contents) {
      if (!isCharacter(a)) continue;
      if (!this._characterBelongsToFaction(a)) continue;

      let contrib = this._normalizeOps(a.getFlag?.(MODULE_ID, "opContribution") || {});
      if (Object.values(contrib).every(v => v === 0)) {
        const calc = a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {};
        contrib = this._normalizeOps(calc);
      }
      for (const k in totals) totals[k] += Number(contrib[k] || 0);

      roster.push({
        id: a.id, name: a.name, img: a.img,
        total: Object.values(contrib).reduce((s,v)=>s+(Number(v)||0),0),
        ...contrib
      });
    }

    const sumTotal = Object.values(totals).reduce((s,v)=>s+(Number(v)||0),0);
    return { roster, totals, sumTotal };
  }

  _collectTerritoryThisScene() {
    const scene = canvas?.scene;
    if (!scene) return null;

    const resources = { food:0, materials:0, trade:0, military:0, knowledge:0 };
    const names = [];
    let count = 0;

    const drawings = scene.drawings?.contents ?? [];
    for (const d of drawings) {
      const f = d.flags?.["bbttcc-territory"] ?? {};
      const isHex = (f.isHex === true) || (f.kind === "territory-hex") ||
        (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
      if (!isHex) continue;

      const ownerId = f.factionId ?? f.ownerId;
      const ownerName = f.faction ?? f.ownerName;
      const owned = (ownerId && ownerId === this.actor.id) ||
                    (!!ownerName && String(ownerName).trim() === String(this.actor.name).trim());
      if (!owned) continue;

      count++;
      names.push(f.name || d.text || `Hex #${count}`);

      const r = f.resources || {};
      resources.food       += Number(r.food ?? 0);
      resources.materials  += Number(r.materials ?? 0);
      resources.trade      += Number(r.trade ?? 0);
      resources.military   += Number(r.military ?? 0);
      resources.knowledge  += Number(r.knowledge ?? 0);
    }

    if (count === 0) return null;
    return { count, resources, names };
  }

  async getData(opts) {
    const d = await super.getData(opts);

    const opsFlags = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
    const maxOPs   = Number(this.actor.getFlag(MODULE_ID, "maxOPs") ?? 0);

    const { roster, totals: contribTotals, sumTotal: contribGrand } = this._collectRosterAndContribs();
    const KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    const rows = KEYS.map(k => {
      const value = Number(opsFlags[k]?.value ?? 0);
      const contrib = Number(contribTotals[k] ?? 0);
      return {
        key: k,
        label: k.charAt(0).toUpperCase() + k.slice(1),
        value,
        contrib,
        total: value + contrib
      };
    });

    const total = rows.reduce((s,r)=>s + (Number.isFinite(r.value) ? r.value : 0), 0);
    const powerKey   = computePowerKey(total);
    const powerLevelLabel  = game.i18n?.localize?.(`BBTTCC.PowerLevels.${powerKey}`) || powerKey;

    const territoryThisScene = this._collectTerritoryThisScene();
    const warLogs = Array.isArray(this.actor.getFlag(MODULE_ID, "warLogs")) ? this.actor.getFlag(MODULE_ID, "warLogs") : [];

    return {
      ...d,
      fx: {
        ops: rows,
        maxOPs,
        totalOPs: total,
        powerKey,
        powerLevelLabel,
        roster,
        rosterTotals: contribTotals,
        rosterGrandTotal: contribGrand,
        territoryThisScene,
        warLogs
      }
    };
  }

  async _updateObject(e, formData) {
    const ex = foundry.utils.expandObject(formData);

    const core = {};
    if (typeof ex.name === "string") core.name = ex.name;
    if (typeof ex.img  === "string") core.img  = ex.img;
    if (Object.keys(core).length) await this.actor.update(core);

    const curOps = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
    const fxIn   = ex.fx || {};
    let nextOps  = curOps;

    if (Object.prototype.hasOwnProperty.call(fxIn, "maxOPs")) {
      await this.actor.setFlag(MODULE_ID, "maxOPs", clamp0(fxIn.maxOPs));
    }

    if (fxIn.ops && typeof fxIn.ops === "object") {
      nextOps = { ...curOps };
      for (const [k, row] of Object.entries(fxIn.ops)) {
        const existing = nextOps[k] || { value: 0 };
        const val = clamp0(row?.value ?? existing.value); // no cap
        nextOps[k] = { value: val };
      }
      await this.actor.setFlag(MODULE_ID, "ops", nextOps);
    }

    await ensureFactionHints(this.actor);
    this.render(false);
  }

  activateListeners(html) {
    super.activateListeners(html);

    // +/- handlers
    html.find?.("[data-op-inc]")?.on?.("click", async ev => {
      ev.preventDefault(); const key = ev.currentTarget.dataset.opInc; await this._bump(key, +1);
    });
    html.find?.("[data-op-dec]")?.on?.("click", async ev => {
      ev.preventDefault(); const key = ev.currentTarget.dataset.opDec; await this._bump(key, -1);
    });

    // Roll d20 + (value + contrib)
    const root = html?.[0] instanceof HTMLElement ? html[0] : (html instanceof HTMLElement ? html : null);
    (root ?? document).querySelectorAll?.("[data-op-roll]")?.forEach(btn => {
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const key = btn.getAttribute("data-op-roll");
        if (!key) return;

        const opsFlags = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
        const value = Number(opsFlags?.[key]?.value ?? 0);

        const { totals: contribTotals } = this._collectRosterAndContribs();
        const contrib = Number(contribTotals?.[key] ?? 0);

        const bonus = value + contrib;
        const roll = new Roll("1d20 + @b", { b: bonus });
        roll.evaluateSync(); // v13+ safe

        const label = key.charAt(0).toUpperCase() + key.slice(1);
        roll.toMessage({
          speaker: { alias: this.actor.name },
          flavor: `<strong>${this.actor.name}</strong> — ${label} Check<br/><small>Bonus = Value (${value}) + Roster (${contrib})</small>`
        });
      });
    });

    // Open roster actor
    (root ?? document).querySelectorAll?.("[data-open-actor]")?.forEach(btn => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute("data-open-actor");
        game.actors.get(id)?.sheet?.render(true, { focus: true });
      });
    });

    // Header "Recalc All"
    const header = (root ?? document).querySelector?.(".sheet-header") || (root ?? document);
    if (header && !header.querySelector("[data-bbttcc-recalc-all]")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.bbttccRecalcAll = "1";
      btn.innerHTML = `<i class="fas fa-sync"></i> Recalc All`;
      btn.style.marginLeft = ".5rem";
      const place = header.querySelector(".flexrow") || header;
      place.appendChild(btn);

      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        try {
          const res = await game.bbttcc?.api?.characterOptions?.recalcAll?.();
          const n = res ? Object.keys(res).length : 0;
          ui.notifications?.info?.(`Recalculated OPs for ${n} actors.`);
          this.render(false);
        } catch (e) {
          warn("Recalc All failed", e);
          ui.notifications?.warn?.("Couldn’t recalc OPs (see console).");
        }
      });
    }
  }

  async _bump(key, delta) {
    if (!key) return;
    const ops = foundry.utils.duplicate(this.actor.getFlag(MODULE_ID, "ops") || {});
    const row = ops[key] || { value: 0 };
    row.value = clamp0((row.value ?? 0) + delta);   // no cap
    ops[key] = row;
    await this.actor.setFlag(MODULE_ID, "ops", ops);
    this.render(false);
  }
}

/* ----------------- hooks ----------------- */
Hooks.once("init", () => {
  // v13-safe sheet registration
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor, MODULE_ID, BBTTCCFactionSheet,
    { types: ["npc"], makeDefault: false, label: "BBTTCC Faction" }
  );
  log("init — faction sheet registered");

  // Actor Directory header: Create Faction (DOM-native)
  Hooks.on("renderActorDirectory", (app, html) => {
    try {
      const el = html instanceof HTMLElement ? html : (html?.[0] instanceof HTMLElement ? html[0] : null);
      if (!el) return;

      const header = el.querySelector(".directory-header .header-actions") || el.querySelector(".header-actions");
      if (!header) return;
      if (header.querySelector("[data-action='bbttcc-create-faction']")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.action = "bbttcc-create-faction";
      btn.title = "Create a new BBTTCC Faction";
      btn.innerHTML = `<i class="fas fa-users"></i> Create Faction`;
      header.appendChild(btn);

      btn.addEventListener("click", async () => {
        const a = await Actor.create({
          name: game.i18n?.localize?.("BBTTCC.Faction.NewName") || "New Faction",
          type: "npc",
          img: "icons/svg/crown.svg",
          "system.details.type.value": "faction",
          flags: { [MODULE_ID]: { isFaction: true } }
        });
        const RIGHT = `${MODULE_ID}.BBTTCCFactionSheet`;
        await a.update({ "flags.core.sheetClass": RIGHT });
        a.sheet?.render(true, { focus: true });
      });
    } catch (e) {
      warn("renderActorDirectory injection failed", e);
    }
  });
});

Hooks.once("ready", async () => {
  // Reassert our sheet on existing faction actors
  const RIGHT = `${MODULE_ID}.BBTTCCFactionSheet`;
  for (const a of listFactionActors()) {
    await ensureFactionHints(a);
    const cur = a.getFlag("core","sheetClass") || foundry.utils.getProperty(a,"flags.core.sheetClass");
    if (cur !== RIGHT) await a.update({ "flags.core.sheetClass": RIGHT });
  }
  log("ready — migration done");
});

Hooks.on("createActor", ensureFactionHints);
Hooks.on("updateActor", ensureFactionHints);
