// modules/bbttcc-core/scripts/scene-nav-folders.js
// Bad Eden — Scene Navigation FOLDERS (2026-10-12, owner QoL ask).
//
// Foundry's top-left Scene Navigation shows every nav-flagged scene as one flat wrapped grid
// when expanded. The Scenes SIDEBAR already nests them in folders; this enhancer regroups the
// nav's inactive list into that same folder tree (collapsible, nested, remembered per client).
//
// It MOVES Foundry's own `li.scene` elements under folder rows rather than re-creating them,
// so the core app's click action (viewScene), GM context menu (.scene) and drag-to-reorder
// (dropSelector #scene-navigation-inactive) all keep working untouched.
//
// Loaded via `import "./scene-nav-folders.js"` from bbttcc-ui-cleanup.enhancer.js — no
// module.json change (= no pm2 restart / cache bust). Client setting `bbttcc-core.sceneNavFolders`
// turns it off. Expanded-folder memory lives in localStorage (per browser, a convenience only).
//
// 2026-10-13: the foldered list is ONE scrolling column (core's column-wrap grid spread folders sideways off-screen).

const MOD = "bbttcc-core";
const SETTING = "sceneNavFolders";
const LS_KEY = "bbttcc.sceneNavFolders.open";
const TAG = "[bbttcc-core/scene-nav-folders]";

function openSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); } catch (_e) { return new Set(); }
}
function saveOpen(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])); } catch (_e) {}
}
function enabled() {
  try { return game.settings.get(MOD, SETTING) !== false; } catch (_e) { return true; }
}

function injectStyles() {
  if (document.getElementById("bbttcc-scene-nav-folders-css")) return;
  const style = document.createElement("style");
  style.id = "bbttcc-scene-nav-folders-css";
  style.textContent = `
    /* 2026-10-13 — Core's inactive menu is a COLUMN flex that WRAPS (height:0 + flex:1 = "full-height wrapping"):
       the flat grid overflows sideways into more columns. A folder tree read that way spread each folder's
       children across a column of its own (flex-basis 100% = one full column each), with the tail pushed off
       the right edge of the screen (owner, 2026-10-13). A tree reads top-to-bottom: ONE column that scrolls. */
    #scene-navigation #scene-navigation-inactive[data-bbttcc-folders="1"] {
      flex-wrap: nowrap; overflow-y: auto; overflow-x: hidden; scrollbar-gutter: stable;
      pointer-events: all; width: 100%; max-width: 20vw; padding-right: 0.25rem; gap: 0.5rem;
    }
    #scene-navigation .bbttcc-nav-folder {
      flex: none; width: 100%; max-width: none; position: relative; display: flex; align-items: center;
      gap: 0.4rem; padding: 0.5rem; font-size: var(--font-size-12); cursor: var(--cursor-pointer);
    }
    #scene-navigation .bbttcc-nav-folder > i.bbttcc-caret { flex: 0 0 auto; font-size: var(--font-size-10); transition: transform 0.2s; }
    #scene-navigation .bbttcc-nav-folder.open > i.bbttcc-caret { transform: rotate(90deg); }
    #scene-navigation .bbttcc-nav-folder > i.bbttcc-folder-icon { flex: 0 0 auto; opacity: 0.8; }
    #scene-navigation .bbttcc-nav-folder > .bbttcc-count { margin-left: auto; opacity: 0.6; font-size: var(--font-size-10); }
    #scene-navigation .bbttcc-nav-folder.has-view { box-shadow: inset 0 0 0 1px var(--color-warm-2, #c9a227); }
    #scene-navigation .bbttcc-nav-children {
      flex: none; width: 100%; display: flex; flex-direction: column; flex-wrap: nowrap; gap: 0.5rem;
      list-style: none; margin: 0; padding: 0 0 0.25rem 0.75rem;
      border-left: 2px solid var(--color-border-light-2, rgba(255,255,255,0.25));
    }
    #scene-navigation .bbttcc-nav-children:not(.open) { display: none; }
    #scene-navigation .bbttcc-nav-children > .scene,
    #scene-navigation .bbttcc-nav-root-scenes > .scene { flex: none; width: 100%; max-width: none; }
    #scene-navigation .bbttcc-nav-root-scenes {
      flex: none; width: 100%; display: flex; flex-direction: column; flex-wrap: nowrap; gap: 0.5rem;
      list-style: none; margin: 0; padding: 0;
    }
  `;
  document.head.appendChild(style);
}

/** Folder sort = the sidebar's: manual `sort` then name. */
function sortFolders(a, b) { return (a.sort - b.sort) || a.name.localeCompare(b.name); }

/** Build {folders: Map<folderId, {folder, folders, scenes}>, rootScenes, rootFolders} from the nav's scene nodes. */
function buildTree(sceneNodes) {
  const nodeById = new Map(sceneNodes.map(li => [li.dataset.sceneId, li]));
  const entries = new Map();   // folderId → { folder, scenes: [li], folders: Set<folderId> }
  const rootScenes = [];
  const rootFolders = new Set();
  const ensure = (folder) => {
    if (!entries.has(folder.id)) entries.set(folder.id, { folder, scenes: [], folders: new Set() });
    return entries.get(folder.id);
  };
  for (const [id, li] of nodeById) {
    const scene = game.scenes.get(id);
    const folder = scene?.folder;
    if (!folder) { rootScenes.push(li); continue; }
    ensure(folder).scenes.push(li);
    // walk up so every ancestor exists and links to its child folder
    let f = folder;
    while (f) {
      const parent = f.folder;
      if (parent) { ensure(parent).folders.add(f.id); ensure(f); }
      else rootFolders.add(f.id);
      f = parent;
    }
  }
  return { entries, rootScenes, rootFolders };
}

function countScenes(entries, folderId) {
  const e = entries.get(folderId); if (!e) return 0;
  let n = e.scenes.length;
  for (const cid of e.folders) n += countScenes(entries, cid);
  return n;
}
function hasViewed(entries, folderId) {
  const e = entries.get(folderId); if (!e) return false;
  if (e.scenes.some(li => li.classList.contains("view"))) return true;
  for (const cid of e.folders) if (hasViewed(entries, cid)) return true;
  return false;
}

function renderFolder(entries, folderId, open, depth = 0) {
  const e = entries.get(folderId);
  const folder = e.folder;
  const isOpen = open.has(folderId);
  const row = document.createElement("li");
  row.className = `ui-control bbttcc-nav-folder${isOpen ? " open" : ""}${hasViewed(entries, folderId) ? " has-view" : ""}`;
  row.dataset.folderId = folderId;
  row.dataset.tooltip = folder.name;
  row.setAttribute("aria-label", folder.name);
  const caret = document.createElement("i"); caret.className = "fa-solid fa-caret-right bbttcc-caret"; caret.inert = true;
  const icon = document.createElement("i"); icon.className = `fa-solid ${isOpen ? "fa-folder-open" : "fa-folder"} bbttcc-folder-icon`; icon.inert = true;
  if (folder.color) icon.style.color = folder.color.css ?? String(folder.color);
  const name = document.createElement("span"); name.className = "ellipsis"; name.textContent = folder.name;
  const count = document.createElement("span"); count.className = "bbttcc-count"; count.textContent = String(countScenes(entries, folderId));
  row.append(caret, icon, name, count);

  const children = document.createElement("menu");
  children.className = `scene-navigation-menu bbttcc-nav-children${isOpen ? " open" : ""}`;
  children.dataset.folderId = folderId;
  const subFolders = [...e.folders].map(id => entries.get(id).folder).sort(sortFolders);
  for (const sf of subFolders) {
    const [r, c] = renderFolder(entries, sf.id, open, depth + 1);
    children.append(r, c);
  }
  for (const li of e.scenes) children.append(li);   // keep navOrder (already sorted by core)

  row.addEventListener("click", (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const now = !row.classList.contains("open");
    row.classList.toggle("open", now);
    children.classList.toggle("open", now);
    icon.className = `fa-solid ${now ? "fa-folder-open" : "fa-folder"} bbttcc-folder-icon`;
    const set = openSet(); if (now) set.add(folderId); else set.delete(folderId); saveOpen(set);
  });
  return [row, children];
}

function regroup(app, element) {
  if (!enabled()) return;
  const menu = element.querySelector("#scene-navigation-inactive");
  if (!menu || menu.dataset.bbttccFolders === "1") return;
  const sceneNodes = [...menu.querySelectorAll(":scope > li.scene[data-scene-id]")];
  if (!sceneNodes.length) return;
  const { entries, rootScenes, rootFolders } = buildTree(sceneNodes);
  if (!entries.size) return;   // nothing is foldered — leave the flat grid alone
  injectStyles();
  const open = openSet();
  const frag = document.createDocumentFragment();
  const folders = [...rootFolders].map(id => entries.get(id).folder).sort(sortFolders);
  for (const f of folders) { const [r, c] = renderFolder(entries, f.id, open); frag.append(r, c); }
  if (rootScenes.length) {
    const loose = document.createElement("menu");
    loose.className = "scene-navigation-menu bbttcc-nav-root-scenes";
    for (const li of rootScenes) loose.append(li);
    frag.append(loose);
  }
  menu.replaceChildren(frag);
  menu.dataset.bbttccFolders = "1";
}

Hooks.once("init", () => {
  try {
    game.settings.register(MOD, SETTING, {
      name: "Scene navigation: folder tree",
      hint: "Group the expanded top-left scene list by the Scenes sidebar's folders (collapsible, nested). Off = Foundry's flat grid.",
      scope: "client", config: true, type: Boolean, default: true,
      onChange: () => { try { ui.nav?.render(); } catch (_e) {} }
    });
  } catch (e) { console.warn(TAG, "setting register failed", e); }
});

Hooks.on("renderSceneNavigation", (app, element) => {
  try { regroup(app, element instanceof HTMLElement ? element : (element?.[0] ?? app.element)); }
  catch (e) { console.warn(TAG, "regroup failed", e); }
});

console.log(TAG, "loaded");
