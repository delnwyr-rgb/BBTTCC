// bbttcc-core/scripts/art-picker.js
// THE ART PICKER (2026-10-17) — one component every creation flow uses to offer
// portrait + token art instead of a bare FilePicker. Pools come from a tagged
// manifest (art/asli-manifest.json — Aslı's lineage tokens only, owner ruling),
// never from a directory scan, so players without FILES_BROWSE see the grid too.
//
//   game.bbttcc.artPicker.pick({ kind, context, current, title })  → { img, token } | null
//   game.bbttcc.artPicker.renderGrid(el, { kind, context, selected, onPick, autoSelect })
//   game.bbttcc.artPicker.contextForActor(actor)                   → { ancestry, heritage }
//   game.bbttcc.artPicker.applyToActor(actor, sel)
//
// kind ∈ character | echo | npc | rig | manifestation. A kind with no manifest
// entries (rigs, manifestations — no Aslı art yet) falls through to the plain
// FilePicker for seats that may browse, so nothing regresses.
//
// Owner ruling 2026-10-17: the token IS the portrait — one pick fills both.

const MOD = "bbttcc-core";
const MANIFEST_URL = `modules/${MOD}/art/asli-manifest.json`;
const DEFAULT_KINDS = ["character", "echo", "npc"];

let _manifestPromise = null;

function _norm(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function _esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function loadManifest() {
  if (_manifestPromise) return _manifestPromise;
  _manifestPromise = (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const base = String(raw.base || "");
      const lineages = raw.lineages || {};
      const entries = (raw.entries || []).map(e => ({
        path: e.path || (base + e.file),
        label: String(e.label || e.file || e.path || ""),
        lineage: String(e.lineage || ""),
        lineageLabel: lineages[e.lineage]?.label || e.lineage || "",
        heritages: Array.isArray(e.heritages) ? e.heritages.map(_norm) : [],
        kinds: Array.isArray(e.kinds) && e.kinds.length ? e.kinds : DEFAULT_KINDS
      }));
      return { credit: raw.credit || "", lineages, entries };
    } catch (err) {
      console.warn("[bbttcc-core/art-picker] manifest load failed", err);
      return { credit: "", lineages: {}, entries: [] };
    }
  })();
  return _manifestPromise;
}

async function entriesFor(kind) {
  const m = await loadManifest();
  if (!kind) return m.entries.slice();
  return m.entries.filter(e => e.kinds.includes(kind));
}

/** 2 = heritage match, 1 = lineage match, 0 = no match. */
function matchScore(entry, context, lineages) {
  const anc = _norm(context?.ancestry);
  const her = _norm(context?.heritage);
  if (!anc && !her) return 0;
  if (her && entry.heritages.some(h => h && her.includes(h))) return 2;
  const keys = (lineages?.[entry.lineage]?.keys || []).map(_norm).filter(Boolean);
  const hay = `${anc} ${her}`;
  if (keys.some(k => hay.includes(k))) return 1;
  return 0;
}

function rank(entries, context, lineages) {
  return entries
    .map(e => ({ entry: e, score: matchScore(e, context, lineages) }))
    .sort((a, b) => (b.score - a.score) || a.entry.label.localeCompare(b.entry.label));
}

function canBrowse() {
  try { return !!(game.user?.isGM || game.user?.can?.("FILES_BROWSE")); } catch (_e) { return false; }
}

function _injectStylesOnce() {
  if (document.getElementById("be-art-picker-css")) return;
  const st = document.createElement("style");
  st.id = "be-art-picker-css";
  st.textContent = `
    .be-art { display:flex; flex-direction:column; gap:.5rem; min-width:0; min-height:0; }
    /* Dialog form (2026-10-17, Dave: "scrollable and expandable, much bigger"): the dialog
       is resizable; the grid takes the remaining height and scrolls inside it. */
    .be-art-dialog { display:flex; flex-direction:column; min-height:0; height:100%; }
    .be-art-dialog > p { flex:0 0 auto; }
    .be-art-dialog .be-art { flex:1 1 auto; min-height:0; }
    .be-art-dialog .be-art-bar { flex:0 0 auto; }
    .be-art-dialog .be-art-grid { flex:1 1 auto; min-height:240px; max-height:none; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); grid-auto-rows:max-content; }
    .be-art-dialog .be-art-tile img { width:124px; height:124px; }
    .application.be-art-app .window-content { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
    .application.be-art-app .window-content > form, .application.be-art-app .dialog-content { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; }
    .application.be-art-app .form-footer { flex:0 0 auto; }
    .be-art-bar { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; font-size:.85em; }
    .be-art-bar input[type=search] { flex:1 1 140px; min-width:120px; padding:.2rem .45rem; border-radius:6px; }
    .be-art-bar label { display:inline-flex; gap:.3rem; align-items:center; cursor:pointer; opacity:.9; }
    .be-art-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); grid-auto-rows:max-content; align-items:start; gap:.5rem; max-height: 46vh; overflow:auto; padding:.15rem; }
    .be-art-tile { position:relative; display:flex; flex-direction:column; align-items:center; gap:.25rem; padding:.35rem .25rem .4rem;
      border:1px solid rgba(255,255,255,.12); border-radius:8px; background:rgba(0,0,0,.25); cursor:pointer; text-align:center; color:inherit; }
    .be-art-tile:hover { border-color: rgba(232,200,74,.6); background:rgba(232,200,74,.06); }
    .be-art-tile.is-selected { border-color:#e8c84a; box-shadow:0 0 0 2px rgba(232,200,74,.45) inset; background:rgba(232,200,74,.1); }
    .be-art-tile img { width:84px; height:84px; object-fit:contain; border-radius:50%; background:radial-gradient(circle at 50% 40%, rgba(255,255,255,.08), rgba(0,0,0,.35)); }
    .be-art-tile .be-art-label { font-size:.74em; line-height:1.15; opacity:.9; }
    .be-art-tile .be-art-badge { position:absolute; top:4px; right:4px; font-size:.62em; padding:.05rem .3rem; border-radius:999px; background:#e8c84a; color:#1a1408; font-weight:600; }
    .be-art-tile .be-art-badge.is-lineage { background:rgba(232,200,74,.35); color:#f4f0e0; }
    .be-art-empty { opacity:.75; font-style:italic; padding:.5rem; }
    .be-art-credit { font-size:.72em; opacity:.6; }
    .be-art-current { display:flex; gap:.5rem; align-items:center; font-size:.85em; opacity:.85; }
    .be-art-current img { width:40px; height:40px; object-fit:contain; border-radius:50%; background:rgba(0,0,0,.35); }
  `;
  document.head.appendChild(st);
}

/**
 * Render the grid into `container`. Returns a controller { value, refresh() }.
 * opts: { kind, context:{ancestry, heritage}, selected, onPick(path, {entry, auto}),
 *         autoSelect (pick the top match when nothing is selected), showAll, onShowAll(bool) }
 */
function renderGrid(container, opts = {}) {
  _injectStylesOnce();
  const ctl = { value: opts.selected || "", refresh: () => {} };
  if (!container) return ctl;
  container.classList.add("be-art");
  container.innerHTML = `<div class="be-art-empty">Loading Aslı's gallery…</div>`;

  (async () => {
    const m = await loadManifest();
    const pool = (await entriesFor(opts.kind));
    const ranked = rank(pool, opts.context, m.lineages);
    const hasMatches = ranked.some(r => r.score > 0);
    let showAll = opts.showAll ?? !hasMatches;
    let query = "";

    // Auto-select the top match so a player who never clicks still gets Aslı art.
    const inPool = (p) => ranked.some(r => r.entry.path === p);
    if (opts.autoSelect && (!ctl.value || !inPool(ctl.value)) && ranked.length) {
      ctl.value = ranked[0].entry.path;
      try { opts.onPick?.(ctl.value, { entry: ranked[0].entry, auto: true }); } catch (_e) {}
    }

    const draw = () => {
      const q = _norm(query);
      const rows = ranked.filter(r => (showAll || r.score > 0) && (!q || _norm(r.entry.label).includes(q) || _norm(r.entry.lineageLabel).includes(q)));
      const tiles = rows.map(r => {
        const e = r.entry;
        const badge = r.score === 2 ? `<span class="be-art-badge">Your heritage</span>`
                    : r.score === 1 ? `<span class="be-art-badge is-lineage">Your lineage</span>` : "";
        return `<button type="button" class="be-art-tile${e.path === ctl.value ? " is-selected" : ""}" data-art-path="${_esc(e.path)}" title="${_esc(e.label)}">
          ${badge}<img src="${_esc(e.path)}" alt="" loading="lazy"/><span class="be-art-label">${_esc(e.label)}</span></button>`;
      }).join("");
      container.innerHTML = `
        <div class="be-art-bar">
          <input type="search" data-art-search placeholder="Search the gallery…" value="${_esc(query)}"/>
          ${hasMatches ? `<label><input type="checkbox" data-art-showall ${showAll ? "checked" : ""}/> Show all lineages</label>` : ""}
          <span class="be-art-credit">${_esc(m.credit)}</span>
        </div>
        <div class="be-art-grid">${tiles || `<div class="be-art-empty">${pool.length ? "Nothing matches that search." : "No Aslı art for this yet."}</div>`}</div>`;

      container.querySelectorAll(".be-art-tile").forEach(btn => {
        btn.querySelector("img")?.addEventListener("error", () => btn.remove(), { once: true });
        btn.addEventListener("click", () => {
          ctl.value = btn.dataset.artPath || "";
          container.querySelectorAll(".be-art-tile").forEach(b => b.classList.toggle("is-selected", b === btn));
          const entry = ranked.find(r => r.entry.path === ctl.value)?.entry ?? null;
          try { opts.onPick?.(ctl.value, { entry, auto: false }); } catch (_e) {}
        });
      });
      container.querySelector("[data-art-search]")?.addEventListener("input", (ev) => {
        query = ev.currentTarget.value; const keep = container.querySelector("[data-art-search]"); draw();
        const el = container.querySelector("[data-art-search]"); if (el && keep) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      });
      container.querySelector("[data-art-showall]")?.addEventListener("change", (ev) => {
        showAll = !!ev.currentTarget.checked;
        try { opts.onShowAll?.(showAll); } catch (_e) {}
        draw();
      });
    };
    ctl.refresh = draw;
    draw();
  })();
  return ctl;
}

function _openFilePicker({ current = "", activeSource } = {}) {
  return new Promise((resolve) => {
    try {
      const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
      const fp = new FP({
        type: "image",
        current: current || "",
        ...(activeSource ? { activeSource } : {}),
        callback: (path) => resolve(path || null)
      });
      // Resolve null if the picker is closed without a choice.
      const origClose = fp.close.bind(fp);
      fp.close = async (...a) => { const r = await origClose(...a); setTimeout(() => resolve(null), 0); return r; };
      fp.render(true);
    } catch (e) {
      console.warn("[bbttcc-core/art-picker] FilePicker failed", e);
      resolve(null);
    }
  });
}

/**
 * Open the picker dialog. Resolves { img, token } (same path — the token is the
 * portrait) or null. Falls back to a plain FilePicker when the pool for `kind`
 * is empty and the seat may browse.
 * opts: { kind, context, current, title, filePicker:{current, activeSource} }
 */
async function pick(opts = {}) {
  _injectStylesOnce();
  const kind = opts.kind || "character";
  const pool = await entriesFor(kind);
  const browse = canBrowse();
  const fpOpts = { current: opts.filePicker?.current ?? opts.current ?? "", activeSource: opts.filePicker?.activeSource };

  if (!pool.length) {
    if (browse) { const p = await _openFilePicker(fpOpts); return p ? { img: p, token: p } : null; }
    ui.notifications?.info?.("No Aslı art for this yet, and this seat cannot browse files. Ask the GM to set the image.");
    return null;
  }

  const title = opts.title || "Choose portrait & token";
  let chosen = opts.current && pool.some(e => e.path === opts.current) ? opts.current : "";
  const content = `
    <div class="be-art-dialog">
      <p style="margin:.1rem 0 .5rem;opacity:.85;font-size:.9em">One pick fills both the portrait and the map token.</p>
      <div data-art-grid></div>
    </div>`;

  const wire = (root) => {
    const el = root?.querySelector?.("[data-art-grid]");
    if (!el) return;
    renderGrid(el, { kind, context: opts.context, selected: chosen, autoSelect: !chosen, onPick: (p) => { chosen = p; } });
  };

  const DialogV2 = foundry.applications?.api?.DialogV2;
  let result = null;
  if (DialogV2?.wait) {
    result = await DialogV2.wait({
      window: { title, icon: "fas fa-image", resizable: true },
      classes: ["be-art-app"],
      position: { width: 960, height: 760 },
      content,
      rejectClose: false,
      render: (_ev, dialog) => wire(dialog?.element ?? dialog),
      buttons: [
        { action: "use", label: "Use this art", icon: "fas fa-check", default: true, callback: () => chosen || null },
        ...(browse ? [{ action: "browse", label: "Browse files…", icon: "fas fa-folder-open", callback: () => _openFilePicker(fpOpts) }] : []),
        { action: "cancel", label: "Cancel", icon: "fas fa-times", callback: () => null }
      ]
    }).catch(() => null);
  } else {
    result = await new Promise((resolve) => {
      new Dialog({
        title, content,
        render: (html) => wire(html instanceof HTMLElement ? html : html?.[0]),
        buttons: {
          use: { icon: "<i class='fas fa-check'></i>", label: "Use this art", callback: () => resolve(chosen || null) },
          ...(browse ? { browse: { icon: "<i class='fas fa-folder-open'></i>", label: "Browse files…", callback: async () => resolve(await _openFilePicker(fpOpts)) } } : {}),
          cancel: { icon: "<i class='fas fa-times'></i>", label: "Cancel", callback: () => resolve(null) }
        },
        default: "use",
        close: () => resolve(null)
      }, { width: 960, height: 760, resizable: true, classes: ["be-art-app"] }).render(true);
    });
  }
  if (!result || typeof result !== "string") return null;
  return { img: result, token: result };
}

/** Ancestry/heritage context from an actor's creation flags or its owned items. */
function contextForActor(actor) {
  const ctx = { ancestry: "", heritage: "" };
  if (!actor) return ctx;
  try {
    const nl = actor.flags?.["bbttcc-character-options"]?.nativeLinks || {};
    ctx.ancestry = String(nl.ancestryName || "");
    ctx.heritage = String(nl.heritageName || "");
  } catch (_e) {}
  if (!ctx.ancestry || !ctx.heritage) {
    try {
      for (const it of actor.items ?? []) {
        const t = String(it.type || "").toLowerCase();
        const kind = String(it.flags?.["bbttcc-character-options"]?.kind || it.system?.kind || "").toLowerCase();
        if (!ctx.ancestry && (t === "species" || t === "race" || t === "ancestry" || kind === "ancestry")) ctx.ancestry = it.name;
        if (!ctx.heritage && (kind === "heritage" || /heritage/i.test(it.name))) ctx.heritage = it.name;
      }
    } catch (_e) {}
  }
  return ctx;
}

async function applyToActor(actor, sel) {
  if (!actor || !sel?.img) return null;
  return actor.update({ img: sel.img, "prototypeToken.texture.src": sel.token || sel.img });
}

const api = { loadManifest, entriesFor, rank, matchScore, renderGrid, pick, canBrowse, contextForActor, applyToActor, MANIFEST_URL };

function _install() {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.artPicker = api;
  globalThis.BBTTCCArtPicker = api;
  Hooks.callAll("bbttcc:artPickerReady", api);
}
if (globalThis.game && game.bbttcc !== undefined) _install();
Hooks.once("init", _install);
Hooks.once("ready", () => { try { loadManifest(); } catch (_e) {} });

export default api;
