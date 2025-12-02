// modules/bbttcc-auto-link/scripts/character-sheet.js
// BBTTCC Character & NPC Sheet registration + render enhancements.
//
// Hex Chrome BBTTCC Identity tab with inline editing.
// - Registers custom sheets that extend the default 5E character and NPC sheets.
// - Adds Hex Chrome root class on render.
// - Injects a BBTTCC tab that can read & write core BBTTCC identity fields.
// - Sparks/Tikkun is read-only here and sourced from the Tikkun API.

const MOD  = "bbttcc-auto-link";
const LOG  = (...a) => console.log(`[${MOD}]`, ...a);
const WARN = (...a) => console.warn(`[${MOD}]`, ...a);

/* ---------------------------------------
 * Locate base 5E character & NPC sheets
 * ------------------------------------ */

function findBaseCharacterSheet() {
  try {
    const charSheets = CONFIG?.Actor?.sheetClasses?.character;
    if (!charSheets) return null;

    // Prefer the default sheet if marked.
    for (const [id, entry] of Object.entries(charSheets)) {
      if (entry?.cls && entry.default) return { id, cls: entry.cls };
    }

    // Otherwise, look for something that smells like the DnD5E character sheet.
    for (const [id, entry] of Object.entries(charSheets)) {
      if (!entry?.cls) continue;
      const name = entry.cls.name || "";
      if (id.includes("dnd5e") || id.includes("CharacterActorSheet") || name.includes("CharacterActorSheet")) {
        return { id, cls: entry.cls };
      }
    }

    // Fallback: first entry.
    const [firstId, firstEntry] = Object.entries(charSheets)[0] || [];
    if (firstId && firstEntry?.cls) return { id: firstId, cls: firstEntry.cls };

    return null;
  } catch (err) {
    WARN("Error while locating base character sheet", err);
    return null;
  }
}

function findBaseNPCSheet() {
  try {
    const npcSheets = CONFIG?.Actor?.sheetClasses?.npc;
    if (!npcSheets) return null;

    // Prefer the default sheet if marked.
    for (const [id, entry] of Object.entries(npcSheets)) {
      if (entry?.cls && entry.default) return { id, cls: entry.cls };
    }

    // Otherwise, look for something that smells like the DnD5E NPC sheet.
    for (const [id, entry] of Object.entries(npcSheets)) {
      if (!entry?.cls) continue;
      const name = entry.cls.name || "";
      if (id.includes("dnd5e") || id.toLowerCase().includes("npc") || name.toLowerCase().includes("npc")) {
        return { id, cls: entry.cls };
      }
    }

    // Fallback: first entry.
    const [firstId, firstEntry] = Object.entries(npcSheets)[0] || [];
    if (firstId && firstEntry?.cls) return { id: firstId, cls: firstEntry.cls };

    return null;
  } catch (err) {
    WARN("Error while locating base NPC sheet", err);
    return null;
  }
}

/* ---------------------------------------
 * Sheet registration
 * ------------------------------------ */

export function registerBBTTCCCharacterSheet() {
  const baseChar = findBaseCharacterSheet();
  const baseNPC  = findBaseNPCSheet();

  // --- Character sheet wrapper ---
  if (!baseChar?.cls) {
    WARN("Could not locate a base character sheet; BBTTCC Character Sheet will not be registered.");
  } else {
    class BBTTCCCharacterSheet extends baseChar.cls {}

    const sheetId = `${MOD}.BBTTCCCharacterSheet`;

    Actors.registerSheet(MOD, BBTTCCCharacterSheet, {
      types: ["character"],
      makeDefault: false,
      label: "BBTTCC Character Sheet"
    });

    CONFIG.BBTTCC ??= {};
    CONFIG.BBTTCC.autoLink ??= {};
    CONFIG.BBTTCC.autoLink.characterSheetId = sheetId;

    LOG("Registered BBTTCC Character Sheet", {
      sheetId,
      baseSheetId: baseChar.id,
      baseClass: baseChar.cls.name
    });
  }

  // --- NPC sheet wrapper ---
  if (!baseNPC?.cls) {
    WARN("Could not locate a base NPC sheet; BBTTCC NPC Sheet will not be registered.");
  } else {
    class BBTTCCNPCSheet extends baseNPC.cls {}

    const npcSheetId = `${MOD}.BBTTCCNPCSheet`;

    Actors.registerSheet(MOD, BBTTCCNPCSheet, {
      types: ["npc"],
      makeDefault: false,
      label: "BBTTCC NPC Sheet"
    });

    CONFIG.BBTTCC ??= {};
    CONFIG.BBTTCC.autoLink ??= {};
    CONFIG.BBTTCC.autoLink.npcSheetId = npcSheetId;

    LOG("Registered BBTTCC NPC Sheet", {
      sheetId: npcSheetId,
      baseSheetId: baseNPC.id,
      baseClass: baseNPC.cls.name
    });
  }
}

export function getBBTTCCCharacterSheetId() {
  return foundry.utils.getProperty(CONFIG, "BBTTCC.autoLink.characterSheetId");
}

/* ---------------------------------------
 * Shared helpers
 * ------------------------------------ */

function getRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html && html[0] instanceof HTMLElement) return html[0];
  return null;
}

function factionsList() {
  return (game.actors?.contents ?? [])
    .filter(a =>
      a.getFlag?.("bbttcc-factions", "isFaction") === true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction"
    )
    .map(a => ({ id: a.id, name: a.name }))
    .sort((A, B) => A.name.localeCompare(B.name));
}

function resolveFactionForActor(actor) {
  const byId = actor.getFlag?.("bbttcc-factions", "factionId");
  if (byId && game.actors.get(byId)) {
    return { id: byId, name: game.actors.get(byId).name };
  }

  const legacyName = actor.flags?.["bbttcc-territory"]?.faction;
  if (legacyName) {
    const match = factionsList().find(f => f.name === legacyName);
    if (match) return { id: match.id, name: match.name };
    return { id: "", name: legacyName };
  }

  return { id: "", name: "" };
}

/**
 * Normalize Tikkun sparks for display.
 * We return the count of **integrated** sparks for this actor.
 * Primary source: game.bbttcc.api.tikkun.getAllSparks(actorId) → map of spark records.
 */
function normalizeTikkunSparks(actor) {
  const tApi = game.bbttcc?.api?.tikkun;

  try {
    if (tApi?.getAllSparks) {
      const map    = tApi.getAllSparks(actor.id ?? actor) || {};
      const sparks = Object.values(map);
      if (!sparks.length) return 0;

      // Integrated if s.integrated is truthy OR status === "integrated"
      const integrated = sparks.filter(
        (s) => s?.integrated || String(s?.status || "").toLowerCase() === "integrated"
      ).length;

      return integrated; // even if 0, we want to show "0 integrated"
    }
  } catch (e) {
    WARN("normalizeTikkunSparks via Tikkun API failed", e);
  }

  // Fallback: legacy flag shapes on the actor
  const raw = actor?.getFlag?.("bbttcc-tikkun", "sparks") ?? 0;
  if (raw == null) return 0;

  try {
    if (typeof raw === "object") {
      if (typeof raw.integrated === "number") return raw.integrated;
      // As a last resort, use total if present, otherwise treat as 0.
      if (typeof raw.total === "number") return raw.total;
      return 0;
    }
  } catch {/* ignore */}

  // If it's a primitive, we still treat it as "integrated count" best-effort.
  if (typeof raw === "number" || typeof raw === "string") {
    return Number(raw) || 0;
  }

  return 0;
}

/* ---------------------------------------
 * Enlightenment model
 * ------------------------------------ */

const ENLIGHTENMENT = [
  { key: "unawakened",    label: "Unawakened" },
  { key: "awakening",     label: "Awakening" },
  { key: "seeking",       label: "Seeking" },
  { key: "wisdom",        label: "Wisdom" },
  { key: "understanding", label: "Understanding" },
  { key: "enlightened",   label: "Enlightened" },
  { key: "qliphothic",    label: "Qliphothic" }
];

const labelForEnlight = (k) =>
  ENLIGHTENMENT.find(x => x.key === String(k))?.label ?? "Unawakened";

const ENLIGHTENMENT_ITEM_DATA = {
  unawakened: {
    name: "Enlightenment: Unawakened",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { economy: 1 } } }
  },
  awakening: {
    name: "Enlightenment: Awakening",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 1, softpower: 1 } } }
  },
  seeking: {
    name: "Enlightenment: Seeking",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 1, softpower: 2 } } }
  },
  wisdom: {
    name: "Enlightenment: Wisdom",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 1, intrigue: 1, softpower: 1 } } }
  },
  understanding: {
    name: "Enlightenment: Understanding",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { softpower: 2, diplomacy: 1 } } }
  },
  enlightened: {
    name: "Enlightenment: Enlightened",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 3, softpower: 2 } } }
  },
  qliphothic: {
    name: "Enlightenment: Qliphothic",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { violence: 2, intrigue: 2 } } }
  }
};

async function syncEnlightenmentItem(actor, levelKey) {
  const items = actor.items?.filter(
    it => it.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels"
  ) ?? [];
  const toDelete = items.map(it => it.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);

  const src = ENLIGHTENMENT_ITEM_DATA[levelKey];
  if (!src) return;

  const worldSrc = game.items?.find(
    i =>
      i.name === src.name &&
      i.getFlag?.("bbttcc-character-options", "category") === "enlightenment-levels"
  );

  const createData = worldSrc ? worldSrc.toObject() : foundry.utils.deepClone(src);
  foundry.utils.setProperty(
    createData,
    'flags["bbttcc-character-options"].category',
    "enlightenment-levels"
  );

  await actor.createEmbeddedDocuments("Item", [createData]);
}

async function persistFaction(actor, factionId) {
  const name = factionId ? (game.actors.get(factionId)?.name || "") : "";
  await actor.setFlag("bbttcc-factions", "factionId", factionId || null);
  await actor.setFlag("bbttcc-territory", "faction", name || "");
}

/* ---------------------------------------
 * BBTTCC Identity tab
 * ------------------------------------ */

async function ensureBBTTCCTab(app, root) {
  const nav = root.querySelector("nav.sheet-tabs, nav.tabs, .tabs");

  const body =
    root.querySelector(".tab-body[data-container-id]") ||
    root.querySelector(".tab-body") ||
    root.querySelector(".sheet-body, .sheet-content") ||
    root;

  if (!nav || !body) return;

  const exampleItem = nav.querySelector(".item[data-tab]") || nav.querySelector(".item");
  const group  = exampleItem?.dataset.group || nav.dataset.group || "primary";
  const action = exampleItem?.dataset.action || undefined;

  let navItem = nav.querySelector("[data-tab='bbttcc']");
  if (!navItem) {
    navItem = document.createElement(exampleItem?.tagName?.toLowerCase() || "a");
    navItem.classList.add("item");
    navItem.dataset.tab = "bbttcc";
    navItem.textContent = "BBTTCC";
    if (group) navItem.dataset.group = group;
    if (action) navItem.dataset.action = action;
    nav.appendChild(navItem);
  }

  let section = body.querySelector(".tab[data-tab='bbttcc']");
  if (!section) {
    section = document.createElement("section");
    section.classList.add("tab", "bbttcc-tab");
    section.dataset.tab = "bbttcc";
    if (group) section.dataset.group = group;
    body.appendChild(section);
  }

  try {
    const actor = app.actor ?? app.object;
    const resolvedFaction = resolveFactionForActor(actor);
    const radPoints = actor?.getFlag?.("bbttcc-radiation", "points");
    const radRP     = actor?.getFlag?.("bbttcc-radiation", "rp");

    const enlightenmentFlag =
      actor?.getFlag?.("bbttcc-character-options", "enlightenment") ?? {};

    const context = {
      actor,
      system: actor?.system,
      isGM: game.user?.isGM ?? false,
      bbttcc: {
        factionName: resolvedFaction.name,
        factionId: resolvedFaction.id,
        factions: factionsList(),

        radiationPoints: radPoints ?? radRP ?? 0,
        tikkunSparks: normalizeTikkunSparks(actor),
        raidXP: actor?.getFlag?.("bbttcc-raid", "experience") ?? 0,

        enlightenment: {
          level: enlightenmentFlag.level ?? "unawakened",
          display: enlightenmentFlag.display ?? labelForEnlight(enlightenmentFlag.level ?? "unawakened")
        },

        enlightenmentLevels: ENLIGHTENMENT
      }
    };

    const inner = await foundry.applications.handlebars.renderTemplate(
      "modules/bbttcc-auto-link/templates/actors/bbttcc-tab.hbs",
      context
    );
    section.innerHTML = inner;

    wireBBTTCCTabEvents(app, section);
  } catch (err) {
    WARN("Failed to render BBTTCC tab template; falling back to placeholder.", err);
    section.innerHTML = `<div class="bbttcc-tab-placeholder">
      <p style="margin:0;">BBTTCC identity panel failed to load.</p>
    </div>`;
  }
}

async function saveFromTab(actor, root) {
  const newFactionId = root.querySelector("[data-bbttcc='factionId']")?.value || "";
  const newRad   = Number(root.querySelector("[data-bbttcc='radiation']")?.value ?? 0);
  const newRaid  = Number(root.querySelector("[data-bbttcc='raid']")?.value ?? 0);

  const lvlKey  = String(root.querySelector("[data-bbttcc='enlightenment-level']")?.value ?? "unawakened");
  const display = labelForEnlight(lvlKey);

  await persistFaction(actor, newFactionId);

  await actor.setFlag("bbttcc-radiation", "points", newRad);
  await actor.setFlag("bbttcc-radiation", "rp", newRad);

  // Sparks are now managed by the Tikkun engine & overlay; we do NOT overwrite
  // flags["bbttcc-tikkun"].sparks from here to avoid trashing constellations.

  await actor.setFlag("bbttcc-raid", "experience", newRaid);
  await actor.setFlag("bbttcc-character-options", "enlightenment", { level: lvlKey, display });

  await syncEnlightenmentItem(actor, lvlKey);

  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: lvlKey, display });

  ui.notifications?.info?.("BBTTCC values saved.");
}

function wireBBTTCCTabEvents(app, section) {
  const actor = app.actor ?? app.object;
  if (!actor) return;

  const factionSelect = section.querySelector("[data-bbttcc='factionId']");
  if (factionSelect) {
    factionSelect.value = actor.getFlag("bbttcc-factions", "factionId") || "";
  }

  const enlightSelect = section.querySelector("[data-bbttcc='enlightenment-level']");
  if (enlightSelect) {
    const current = actor.getFlag("bbttcc-character-options", "enlightenment")?.level || "unawakened";
    enlightSelect.value = current;
  }

  const radInput = section.querySelector("[data-bbttcc='radiation']");
  if (radInput) {
    const radPoints = actor.getFlag("bbttcc-radiation", "points");
    const radRP     = actor.getFlag("bbttcc-radiation", "rp");
    radInput.value = radPoints ?? radRP ?? 0;
  }

  const sparksInput = section.querySelector("[data-bbttcc-readonly='sparks']");
  if (sparksInput) {
    sparksInput.value = normalizeTikkunSparks(actor);
  }

  const raidInput = section.querySelector("[data-bbttcc='raid']");
  if (raidInput) {
    raidInput.value = actor.getFlag("bbttcc-raid", "experience") ?? 0;
  }

  const saveBtn = section.querySelector("[data-bbttcc-action='save']");
  if (saveBtn) {
    saveBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await saveFromTab(actor, section);
      app.render(false);
    });
  }

  const recalcBtn = section.querySelector("[data-bbttcc-action='recalc']");
  if (recalcBtn) {
    recalcBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
      ui.notifications?.info?.("BBTTCC OPs recalculated.");
    });
  }

  const openFactionBtn = section.querySelector("[data-bbttcc-action='open-faction']");
  if (openFactionBtn) {
    openFactionBtn.addEventListener("click", (ev) => {
      ev.preventDefault();

      const factionId = actor.getFlag("bbttcc-factions", "factionId") || "";
      if (!factionId) {
        return ui.notifications?.warn?.("No faction linked for this character yet.");
      }

      const faction = game.actors.get(factionId);
      if (!faction) {
        return ui.notifications?.warn?.("Linked faction actor not found.");
      }

      faction.sheet?.render(true, { focus: true });
    });
  }
}

/* ---------------------------------------
 * Hooks: render BBTTCC sheets
 * ------------------------------------ */

async function enhanceBBTTCCSheet(app, html) {
  try {
    const root = getRoot(html);
    if (!root) return;

    // Reuse the same Hex Chrome frame styling for both PCs and NPCs.
    root.classList.add("bbttcc-character-sheet");
    await ensureBBTTCCTab(app, root);
  } catch (err) {
    WARN("Failed during BBTTCC sheet enhancement", err);
  }
}

Hooks.on("renderBBTTCCCharacterSheet", enhanceBBTTCCSheet);
Hooks.on("renderBBTTCCNPCSheet", enhanceBBTTCCSheet);
