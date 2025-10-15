// modules/bbttcc-auto-link/scripts/character-wizard.js
// v0.3.1 — BBTTCC Character Wizard (pack-driven choices + Faction link + OP recalc + dnd5e onboarding)
// Fix: avoid clobbering ApplicationV2's reserved "state" by using a private slot.

const MOD = "bbttcc-auto-link";
const log  = (...a) => console.log(`[${MOD}]`, ...a);
const warn = (...a) => console.warn(`[${MOD}]`, ...a);

/* ---- BBTTCC packs (adjust ids here if your keys change) ---- */
const PACK_KEYS = {
  archetype:   "bbttcc-character-options.character-archetypes",
  crew:        "bbttcc-character-options.crew-types",
  sephirot:    "bbttcc-character-options.sephirothic-alignments",
  political:   "bbttcc-character-options.political-affiliations",
  occult:      "bbttcc-character-options.occult-associations",
  enlight:     "bbttcc-character-options.enlightenment-levels"
};

/* ---------------- helpers ---------------- */
async function importByUUID(uuid) {
  try {
    if (!uuid) return null;
    const doc = await fromUuid(uuid);
    return doc?.toObject?.() ?? null;
  } catch (e) {
    warn("importByUUID failed", uuid, e);
    return null;
  }
}

function factionActors() {
  return (game.actors?.contents ?? [])
    .filter(a => a.getFlag?.("bbttcc-factions","isFaction") === true
      || String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction")
    .map(a => ({ id: a.id, name: a.name }))
    .sort((A,B)=>A.name.localeCompare(B.name));
}

async function indexPack(key) {
  const pack = game.packs.get(key);
  if (!pack) return [];
  const idx = await pack.getIndex({ fields: ["name", "type"] });
  const rows = idx.filter(e =>
    e.type === "feat" || e.type === "feat5e" || e.type === "featv2" || e.type === "featV2" || e.type === "feat-5e"
  );
  rows.sort((A,B)=>A.name.localeCompare(B.name));
  return rows.map(({ _id, name }) => ({ id: _id, name }));
}
async function loadPackItem(key, id) {
  const pack = game.packs.get(key);
  if (!pack || !id) return null;
  const doc = await pack.getDocument(id).catch(() => null);
  return doc?.toObject() ?? null;
}

async function persistFactionBothShapes(actor, factionId) {
  const name = factionId ? (game.actors.get(factionId)?.name || "") : "";
  await actor.setFlag("bbttcc-factions",  "factionId", factionId || null);
  await actor.setFlag("bbttcc-territory", "faction",   name || ""); // legacy compatibility
}

function defaultState() {
  return {
    name: "New Operative",
    speciesUuid: "",
    classUuid: "",
    factionId: "",
    lists: { archetype:[], crew:[], sephirot:[], political:[], occult:[], enlight:[] }
  };
}

/* ---------------- Wizard ----------------- */
class BBTTCC_CharacterWizard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-character-wizard",
    title: "Create BBTTCC Character",
    width: 720,
    height: "auto",
    resizable: true,
    classes: ["bbttcc", "bbttcc-character-wizard"]
  };
  static PARTS = { body: { template: `modules/${MOD}/templates/character-wizard.hbs` } };

  // private state holder (not conflicting with AppV2)
  get _bbttccState() {
    if (!this.__bbttcc) this.__bbttcc = defaultState();
    return this.__bbttcc;
  }

  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    // Load lists from packs in parallel
    const [archetype, crew, sephirot, political, occult, enlight] = await Promise.all([
      indexPack(PACK_KEYS.archetype),
      indexPack(PACK_KEYS.crew),
      indexPack(PACK_KEYS.sephirot),
      indexPack(PACK_KEYS.political),
      indexPack(PACK_KEYS.occult),
      indexPack(PACK_KEYS.enlight)
    ]);

    this._bbttccState.lists = { archetype, crew, sephirot, political, occult, enlight };

    return {
      ...context,
      factions: factionActors(),
      defaults: this._bbttccState
    };
  }

  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);
    const root = this.element;
    if (!(root instanceof HTMLElement)) return;

    root.querySelector("form")?.addEventListener("submit", ev => ev.preventDefault());

    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.("[data-action='create']");
      if (!btn) return;
      ev.preventDefault();
      await this._handleCreate();
    }, { capture: true });

    root.addEventListener("keydown", async (ev) => {
      if (ev.key === "Enter" && ev.target?.closest?.("form")) {
        ev.preventDefault();
        await this._handleCreate();
      }
    }, { capture: true });

    log("Wizard listeners attached via _onRender.");
  }

  _val(sel) { return (this.element.querySelector(sel)?.value ?? "").trim(); }

  async _handleCreate() {
    try {
      ui.notifications?.info?.("Creating BBTTCC character…");

      // Gather values
      const name        = this._val("input[name='name']") || "New Operative";
      const factionId   = this._val("select[name='factionId']");
      const speciesUuid = this._val("input[name='speciesUuid']");
      const classUuid   = this._val("input[name='classUuid']");

      const picks = {
        archetype: { pack: PACK_KEYS.archetype, id: this._val("select[name='archetypeId']") },
        crew:      { pack: PACK_KEYS.crew,      id: this._val("select[name='crewId']") },
        sephirot:  { pack: PACK_KEYS.sephirot,  id: this._val("select[name='sephirotId']") },
        political: { pack: PACK_KEYS.political, id: this._val("select[name='politicalId']") },
        occult:    { pack: PACK_KEYS.occult,    id: this._val("select[name='occultId']") },
        enlight:   { pack: PACK_KEYS.enlight,   id: this._val("select[name='enlightId']") }
      };

      // 1) Create actor + BBTTCC scaffold
      const actor = await Actor.create({
        name,
        type: "character",
        img: "icons/svg/mystery-man.svg",
        flags: {
          "bbttcc-character-options": { enabled: true },
          "bbttcc-factions": { factionId: factionId || null },
          "bbttcc-radiation": { points: 0 },
          "bbttcc-tikkun":    { sparks: 0 },
          "bbttcc-raid":      { experience: 0 }
        },
        prototypeToken: { actorLink: true }
      });
      await persistFactionBothShapes(actor, factionId);

      // 2) Optional Species/Class by UUID
      const toEmbed = [];
      const sp = await importByUUID(speciesUuid);
      if (sp?.type === "race") toEmbed.push(sp);
      const cl = await importByUUID(classUuid);
      if (cl?.type === "class") toEmbed.push(cl);

      // 3) Embed selected BBTTCC items from packs (carry official bonuses)
      for (const key of Object.keys(picks)) {
        const { pack, id } = picks[key];
        if (!id) continue;
        const itemData = await loadPackItem(pack, id);
        if (itemData) toEmbed.push(itemData);
      }
      if (toEmbed.length) await actor.createEmbeddedDocuments("Item", toEmbed, { keepId: false });

      // 4) Try dnd5e Advancement; fallback to sheet
      try {
        const AdvMgr = foundry.utils.getProperty(game, "dnd5e.applications.advancement.AdvancementManager")
                    || foundry.utils.getProperty(game, "dnd5e.applications.actor.AdvancementManager");
        if (AdvMgr?.edit) await AdvMgr.edit(actor);
        else actor.sheet?.render(true, { focus: true });
      } catch (e) {
        warn("Advancement open failed; falling back to sheet", e);
        actor.sheet?.render(true, { focus: true });
      }

      // 5) Recalc OPs so Faction roster updates right away
      try {
        await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
      } catch (e) { warn("OP recalc failed (non-fatal)", e); }

      ui.notifications?.info?.("BBTTCC character created. Continue with D&D5E setup.");
      this.close();
    } catch (e) {
      console.error(`[${MOD}] Wizard create failed`, e);
      ui.notifications?.error?.("Could not create BBTTCC character. See console for details.");
    }
  }
}

/** Public entrypoint */
Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc ?? { api: {} };
  game.bbttcc.api = game.bbttcc.api ?? {};
  game.bbttcc.api.autoLink = game.bbttcc.api.autoLink ?? {};
  game.bbttcc.api.autoLink.openCharacterWizard = () =>
    new BBTTCC_CharacterWizard().render(true, { focus: true });
  log("Character Wizard ready — use game.bbttcc.api.autoLink.openCharacterWizard()");
});
