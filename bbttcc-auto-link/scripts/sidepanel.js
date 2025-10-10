// modules/bbttcc-auto-link/scripts/sidepanel.js
// v0.4.0 — BBTTCC panel: adds "Recalc OPs" + "Open Faction" actions
// Reads legacy faction name + modern factionId; saves both for compatibility.

const MOD = "bbttcc-auto-link";
const esc = s => foundry.utils.escapeHTML(String(s ?? ""));

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

/** Resolve the actor's faction using modern flag first, then legacy name. */
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

/** Write both modern + legacy flags so other UIs stay in sync. */
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

/* ---------- panel build/inject ---------- */
function buildPanel(actor) {
  const { id: resolvedId } = resolveFactionForActor(actor);
  const rad     = Number(actor.getFlag("bbttcc-radiation","points") ?? 0);
  const sparks  = Number(actor.getFlag("bbttcc-tikkun","sparks") ?? 0);
  const raidExp = Number(actor.getFlag("bbttcc-raid","experience") ?? 0);

  const wrap = document.createElement("section");
  wrap.className = "bbttcc-sidepanel";
  Object.assign(wrap.style, {
    margin: ".5rem 0",
    border: "1px solid var(--color-border, #666)",
    borderRadius: "8px",
    padding: ".6rem",
    background: "var(--color-bg, rgba(0,0,0,.05))"
  });

  const options = factionsList().map(f =>
    `<option value="${f.id}" ${f.id===resolvedId ? "selected":""}>${esc(f.name)}</option>`
  ).join("");

  wrap.innerHTML = `
    <h3 style="margin:.1rem 0 .5rem; font-size:1rem;">BBTTCC</h3>

    <div class="form-group" style="margin-bottom:.4rem;">
      <label style="display:block; font-weight:600;">Faction</label>
      <select data-bbttcc="factionId">
        <option value="">(None)</option>
        ${options}
      </select>
    </div>

    <div class="grid" style="display:grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap:.4rem;">
      <div class="form-group">
        <label style="display:block; font-weight:600;">Radiation</label>
        <input type="number" data-bbttcc="radiation" value="${rad}" min="0" step="1"/>
      </div>
      <div class="form-group">
        <label style="display:block; font-weight:600;">Tikkun Sparks</label>
        <input type="number" data-bbttcc="sparks" value="${sparks}" min="0" step="1"/>
      </div>
      <div class="form-group">
        <label style="display:block; font-weight:600;">Raid XP</label>
        <input type="number" data-bbttcc="raid" value="${raidExp}" min="0" step="1"/>
      </div>
    </div>

    <div class="flexrow" style="gap:.5rem; justify-content:flex-end; margin-top:.6rem; flex-wrap: wrap;">
      <button type="button" data-bbttcc="openFaction"><i class="fas fa-users"></i> Open Faction</button>
      <button type="button" data-bbttcc="recalc"><i class="fas fa-sync"></i> Recalc OPs</button>
      <button type="button" data-bbttcc="save"><i class="fas fa-save"></i> Save BBTTCC</button>
    </div>
  `;
  return wrap;
}

async function saveFromPanel(actor, root) {
  const newFactionId = root.querySelector("[data-bbttcc='factionId']")?.value || "";
  const newRad   = Number(root.querySelector("[data-bbttcc='radiation']")?.value ?? 0);
  const newSpar  = Number(root.querySelector("[data-bbttcc='sparks']")?.value ?? 0);
  const newRaid  = Number(root.querySelector("[data-bbttcc='raid']")?.value ?? 0);

  await persistFaction(actor, newFactionId);
  await actor.setFlag("bbttcc-radiation", "points", newRad);
  await actor.setFlag("bbttcc-tikkun", "sparks", newSpar);
  await actor.setFlag("bbttcc-raid", "experience", newRaid);

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
