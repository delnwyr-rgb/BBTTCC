// modules/bbttcc-auto-link/scripts/sidepanel.js
// v0.6.0 — BBTTCC panel: Enlightenment Level UI + item sync + auto-recalc + hook

const MOD = "bbttcc-auto-link";
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

/* ---------- enlightenment model & item templates ---------- */
const ENLIGHTENMENT = [
  { key: "unawakened",    label: "Unawakened" },
  { key: "awakening",     label: "Awakening" },
  { key: "seeking",       label: "Seeking" },
  { key: "wisdom",        label: "Wisdom" },
  { key: "understanding", label: "Understanding" },
  { key: "enlightened",   label: "Enlightened" },
  { key: "qliphothic",    label: "Qliphothic" }
];
const labelFor = (k) => ENLIGHTENMENT.find(x => x.key === String(k))?.label ?? "Unawakened";

/** Minimal “source” data for each Enlightenment Item (so we don’t depend on compendium presence). */
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
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { intrigue: 2, softpower: 1 } } }
  },
  wisdom: {
    name: "Enlightenment: Wisdom",
    type: "feat",
    img: "systems/dnd5e/icons/svg/items/feature.svg",
    flags: { "bbttcc-character-options": { category: "enlightenment-levels", bonuses: { diplomacy: 2, softpower: 1 } } }
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
  }
};

/* ---------- faction helpers ---------- */
function factionsList() {
  return (game.actors?.contents ?? [])
    .filter(a =>
      a.getFlag?.("bbttcc-factions","isFaction") === true ||
      String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction"
    )
    .map(a => ({ id: a.id, name: a.name }))
    .sort((A,B)=>A.name.localeCompare(B.name));
}
function resolveFactionForActor(actor) {
  const byId = actor.getFlag("bbttcc-factions","factionId");
  if (byId && game.actors.get(byId)) return { id: byId, name: game.actors.get(byId).name };
  const legacyName = actor.flags?.["bbttcc-territory"]?.faction;
  if (legacyName) {
    const match = factionsList().find(f => f.name === legacyName);
    if (match) return { id: match.id, name: match.name };
    return { id: "", name: legacyName };
  }
  return { id: "", name: "" };
}
async function persistFaction(actor, factionId) {
  const name = factionId ? (game.actors.get(factionId)?.name || "") : "";
  await actor.setFlag("bbttcc-factions",  "factionId", factionId || null);
  await actor.setFlag("bbttcc-territory", "faction",   name || "");
}

/* ---------- mount target ---------- */
function findMount(root) {
  const modern = root.querySelector?.(".sheet-sidebar");
  if (modern) return { el: modern, prepend: true };
  const legacy = root.querySelector?.(".sidebar");
  if (legacy) return { el: legacy, prepend: true };
  const body = root.querySelector?.(".window-content .sheet-body");
  if (body) return { el: body, prepend: true };
  const wc = root.querySelector?.(".window-content");
  if (wc) return { el: wc, prepend: true };
  return { el: root, prepend: true };
}

/* ---------- Enlightenment item sync ---------- */
async function syncEnlightenmentItem(actor, levelKey) {
  const items = actor.items?.filter(it => it.getFlag?.("bbttcc-character-options","category") === "enlightenment-levels") ?? [];
  const toDelete = items.map(it => it.id);
  if (toDelete.length) await actor.deleteEmbeddedDocuments("Item", toDelete);

  const src = ENLIGHTENMENT_ITEM_DATA[levelKey];
  if (!src) return;

  // If a world Item of the same name exists, prefer cloning it (keeps any extra metadata you added).
  const worldSrc = game.items?.find(i =>
    i.name === src.name &&
    i.getFlag?.("bbttcc-character-options","category") === "enlightenment-levels"
  );
  const createData = worldSrc ? worldSrc.toObject() : foundry.utils.deepClone(src);

  // Make sure it has the right category flag either way.
  foundry.utils.setProperty(createData, 'flags["bbttcc-character-options"].category', "enlightenment-levels");
  await actor.createEmbeddedDocuments("Item", [createData]);
}

/* ---------- panel build/inject ---------- */
function buildPanel(actor) {
  const { id: resolvedId } = resolveFactionForActor(actor);
  const rad     = Number(actor.getFlag("bbttcc-radiation","points") ?? 0);
  const sparks  = Number(actor.getFlag("bbttcc-tikkun","sparks") ?? 0);
  const raidExp = Number(actor.getFlag("bbttcc-raid","experience") ?? 0);

  const eObj    = actor.getFlag("bbttcc-character-options", "enlightenment") ?? {};
  const eLevel  = String(eObj.level ?? "unawakened");
  const eLabel  = String(eObj.display ?? labelFor(eLevel));

  const wrap = document.createElement("section");
  wrap.className = "bbttcc-sidepanel";
  Object.assign(wrap.style, {
    margin: ".5rem 0",
    border: "1px solid var(--color-border, #666)",
    borderRadius: "8px",
    padding: ".6rem",
    background: "var(--color-bg, rgba(0,0,0,.05))"
  });

  const factionOptions = factionsList().map(f =>
    `<option value="${f.id}" ${f.id===resolvedId ? "selected":""}>${esc(f.name)}</option>`
  ).join("");

  const enlightenmentOptions = ENLIGHTENMENT.map(e =>
    `<option value="${e.key}" ${e.key===eLevel ? "selected":""}>${esc(e.label)}</option>`
  ).join("");

  wrap.innerHTML = `
    <h3 style="margin:.1rem 0 .5rem; font-size:1rem;">BBTTCC</h3>
    <div class="bbttcc-card" style="display:grid; grid-template-columns: 1fr 1fr; gap:.5rem;">
      <label>Faction<select data-bbttcc="factionId">${factionOptions}</select></label>
      <label>Radiation<input type="number" data-bbttcc="radiation" value="${rad}" min="0" step="1"/></label>
      <label>Tikkun Sparks<input type="number" data-bbttcc="sparks" value="${sparks}" min="0" step="1"/></label>
      <label>Raid XP<input type="number" data-bbttcc="raid" value="${raidExp}" min="0" step="1"/></label>
      <label>Enlightenment<select data-bbttcc="enlightenment-level">${enlightenmentOptions}</select></label>
      <div><small>Current: <strong data-bbttcc="enlightenment-display">${esc(eLabel)}</strong></small></div>
      <div class="flexrow" style="grid-column:1 / -1; gap:.5rem; justify-content:flex-end;">
        <button type="button" data-bbttcc="openFaction"><i class="fas fa-users-cog"></i> Open Faction</button>
        <button type="button" data-bbttcc="recalc"><i class="fas fa-calculator"></i> Recalc OPs</button>
        <button type="button" data-bbttcc="save"><i class="fas fa-save"></i> Save BBTTCC</button>
      </div>
    </div>
  `;
  return wrap;
}

async function saveFromPanel(actor, root) {
  const newFactionId = root.querySelector("[data-bbttcc='factionId']")?.value || "";
  const newRad   = Number(root.querySelector("[data-bbttcc='radiation']")?.value ?? 0);
  const newSpar  = Number(root.querySelector("[data-bbttcc='sparks']")?.value ?? 0);
  const newRaid  = Number(root.querySelector("[data-bbttcc='raid']")?.value ?? 0);

  const lvlKey  = String(root.querySelector("[data-bbttcc='enlightenment-level']")?.value ?? "unawakened");
  const display = labelFor(lvlKey);

  await persistFaction(actor, newFactionId);
  await actor.setFlag("bbttcc-radiation", "points", newSpar);
  await actor.setFlag("bbttcc-tikkun", "sparks", newSpar);
  await actor.setFlag("bbttcc-raid", "experience", newRaid);
  await actor.setFlag("bbttcc-character-options", "enlightenment", { level: lvlKey, display });

  // Ensure the actor's Item matches the selected level
  await syncEnlightenmentItem(actor, lvlKey);

  // Recompute OPs; notify listeners
  await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
  Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: lvlKey, display });

  ui.notifications?.info?.("BBTTCC values saved.");
}

function injectInto(app, html) {
  const actor = app?.actor;
  if (!actor || String(actor.type).toLowerCase() !== "character") return;

  const root = html instanceof HTMLElement ? html
             : (html?.[0] instanceof HTMLElement ? html[0]
             : (app?.element instanceof HTMLElement ? app.element : null));
  if (!root) return;

  if (root.querySelector(".bbttcc-sidepanel")) return; // already present

  const { el: mount, prepend } = findMount(root);
  if (!mount) return;

  const panel = buildPanel(actor);
  if (prepend && mount.firstChild) mount.insertBefore(panel, mount.firstChild);
  else mount.appendChild(panel);

  // Actions
  panel.querySelector("[data-bbttcc='save']")?.addEventListener("click", () => saveFromPanel(actor, panel));

  panel.querySelector("[data-bbttcc='recalc']")?.addEventListener("click", async () => {
    try {
      await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
      ui.notifications?.info?.("Recalculated OPs for this character.");
    } catch (e) {
      console.warn(`[${MOD}] recalcActor failed`, e);
      ui.notifications?.warn?.("Couldn’t recalc OPs (see console).");
    }
  });

  panel.querySelector("[data-bbttcc='openFaction']")?.addEventListener("click", () => {
    const id = panel.querySelector("[data-bbttcc='factionId']")?.value || "";
    if (!id) return ui.notifications?.warn?.("No faction selected.");
    game.actors.get(id)?.sheet?.render(true, { focus: true }) ??
      ui.notifications?.warn?.("Faction actor not found.");
  });

  // Live Enlightenment change → flag, item sync, recalc, broadcast
  panel.querySelector("[data-bbttcc='enlightenment-level']")?.addEventListener("change", async (ev) => {
    const lvlKey  = String(ev.currentTarget.value || "unawakened");
    const display = labelFor(lvlKey);
    try {
      await actor.setFlag("bbttcc-character-options", "enlightenment", { level: lvlKey, display });

      // Ensure Items reflect the chosen level so the OP aggregator reads the right bonuses
      await syncEnlightenmentItem(actor, lvlKey);

      // Update UI
      const out = panel.querySelector("[data-bbttcc='enlightenment-display']");
      if (out) out.textContent = display;

      // Recalc + hook
      await game.bbttcc?.api?.characterOptions?.recalcActor?.(actor.id);
      Hooks.callAll("bbttcc:enlightenmentChanged", { actorId: actor.id, level: lvlKey, display });

      ui.notifications?.info?.(`Enlightenment set to ${display}.`);
    } catch (e) {
      console.warn(`[${MOD}] enlightenment change failed`, e);
      ui.notifications?.error?.("Failed to apply Enlightenment Level.");
    }
  });
}

/* Hooks: V1/V2 + safety net */
Hooks.once("ready", () => {
  Hooks.on("renderActorSheet", injectInto);
  Hooks.on("renderActorSheet5eCharacter", injectInto);
  Hooks.on("renderApplicationV2", (app, html) => {
    const ctor = app?.constructor?.name || "";
    if (!/ActorSheet/i.test(ctor)) return;
    injectInto(app, html);
  });
  const mo = new MutationObserver(muts => {
    for (const m of muts) for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (!node.matches?.(".window-app[data-appid]")) continue;
      const id = Number(node.getAttribute("data-appid"));
      const win = ui.windows?.[id];
      if (win?.actor && String(win.actor.type).toLowerCase() === "character") injectInto(win, node);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
