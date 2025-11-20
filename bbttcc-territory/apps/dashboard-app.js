// modules/bbttcc-territory/apps/dashboard-app.js
const MOD = "bbttcc-territory";
const NS  = "[bbttcc-territory]";
const log  = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

/* ---------- helpers ---------- */
function isHexDrawing(dr) {
  const f = dr.flags?.[MOD] ?? {};
  return f.isHex === true || f.kind === "territory-hex";
}

function buildOwnerList() {
  const out = [];
  for (const a of game.actors?.contents ?? []) {
    const isFaction = a.getFlag?.("bbttcc-factions", "isFaction") === true
      || String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction";
    if (!isFaction) continue;
    out.push({ id: a.id, name: a.name });
  }
  out.sort((A,B)=>A.name.localeCompare(B.name));
  return out;
}

function asDate(ts) {
  try { return ts ? new Date(ts).toLocaleString() : ""; } catch { return ""; }
}

function clampProgress(v) {
  v = Number.isFinite(v) ? Number(v) : 0;
  if (v < 0) v = 0;
  if (v > 6) v = 6;
  return Math.round(v);
}

function stageKeyFromProgress(progress) {
  const p = clampProgress(progress);
  if (p >= 6) return "integrated";
  if (p === 5) return "settled";
  if (p >= 3) return "developing";
  if (p >= 1) return "outpost";
  return "wild";
}

function stageLabelFromKey(key) {
  const map = {
    wild: "Untouched Wilderness",
    outpost: "Foothold / Outpost",
    developing: "Developing Territory",
    settled: "Settled Province",
    integrated: "Integrated Heartland"
  };
  return map[key] || "—";
}

/* ---------- toast + scroll utilities ---------- */
function ensureToastStyles() {
  if (document.getElementById("bbttcc-toast-style")) return;
  const css = `
  .bbttcc-saved-toast {
    position: absolute; inset: 12px auto auto 12px;
    z-index: 9999; padding: 6px 10px; border-radius: 8px;
    background: rgba(60,200,120,.92); color: #fff; font-weight: 700;
    box-shadow: 0 6px 14px rgba(0,0,0,.25); pointer-events: none;
    opacity: 0; transform: translateY(-4px); transition: opacity .15s ease, transform .15s ease;
  }
  .bbttcc-saved-toast.show { opacity: 1; transform: translateY(0); }
  `;
  const style = document.createElement("style");
  style.id = "bbttcc-toast-style";
  style.textContent = css;
  document.head.appendChild(style);
}

function findScroller(root) {
  return root.querySelector?.(".window-content") || root;
}

/* ---------- AppV2 (Handlebars parts) ---------- */
export class BBTTCC_TerritoryDashboard extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-territory-dashboard",
    title: "BBTTCC Territory Dashboard",
    width: 1200,
    height: 600,
    resizable: true,
    classes: ["bbttcc","bbttcc-territory-dashboard"]
  };

  static PARTS = {
    body: { template: `modules/${MOD}/templates/territory-dashboard.hbs` }
  };

  /** Build template context */
  async _preparePartContext(partId, context) {
    if (partId !== "body") return context;

    const scene = canvas?.scene;
    const ownerList = buildOwnerList();
    const rows = [];
    let adoptionCount = 0;

    for (const dr of scene?.drawings?.contents ?? []) {
      // count adoptable geometric 6-gons
      if (!isHexDrawing(dr) && dr.shape?.type === "p" && (dr.shape?.points?.length === 12)) {
        adoptionCount++;
      }
      if (!isHexDrawing(dr)) continue;

      const f = dr.flags?.[MOD] ?? {};

      // Integration: clamp and derive stage
      const integ = f.integration ?? {};
      const rawProg = Number.isFinite(integ.progress) ? integ.progress : 0;
      const integrationProgress = clampProgress(rawProg);
      const integrationStageKey = stageKeyFromProgress(integrationProgress);
      const integrationStageLabel = stageLabelFromKey(integrationStageKey);

      // Normalize legacy "claimed" → "occupied"
      let status = f.status ?? "unclaimed";
      if (status === "claimed") status = "occupied";

      rows.push({
        id: dr.id,
        uuid: dr.uuid,
        name: f.name ?? dr.text ?? "",
        ownerId: f.factionId ?? "",
        status,
        type: f.type ?? "settlement",
        size: f.size ?? "town",
        population: f.population ?? "medium",
        capital: !!f.capital,
        resources: {
          food:       Number(f.resources?.food ?? 0),
          materials:  Number(f.resources?.materials ?? 0),
          trade:      Number(f.resources?.trade ?? 0),
          military:   Number(f.resources?.military ?? 0),
          knowledge:  Number(f.resources?.knowledge ?? 0),
        },
        // Integration display fields
        integrationProgress,
        integrationMax: 6,
        integrationStageKey,
        integrationStageLabel,

        x: Math.round(dr.x), y: Math.round(dr.y),
        createdAt: asDate(f.createdAt ?? 0)
      });
    }

    rows.sort((a,b)=> (a.name||"").localeCompare(b.name||""));

    return {
      sceneName: scene?.name ?? "—",
      ownerList,
      rows,
      adoptionCount
    };
  }

  _rememberScroll(root) {
    try {
      const scroller = findScroller(root);
      this._bbttccScrollTop = scroller?.scrollTop ?? 0;
    } catch {}
  }

  _restoreScroll(root) {
    try {
      const scroller = findScroller(root);
      if (scroller && typeof this._bbttccScrollTop === "number") {
        scroller.scrollTop = this._bbttccScrollTop;
      }
    } catch {}
  }

  _showSavedToast(root) {
    try {
      ensureToastStyles();
      const host = root.querySelector?.(".window-content") || root;
      const old = host.querySelector?.(".bbttcc-saved-toast");
      if (old) old.remove();
      const div = document.createElement("div");
      div.className = "bbttcc-saved-toast";
      div.textContent = "✓ Saved";
      host.appendChild(div);
      requestAnimationFrame(()=> div.classList.add("show"));
      setTimeout(()=> { div.classList.remove("show"); }, 700);
      setTimeout(()=> { div.remove(); }, 900);
    } catch {}
  }

  /** Wire listeners (idempotent, per render) */
  async _onRender(ctx, opts) {
    await super._onRender(ctx, opts);

    const root = this.element[0] ?? this.element;
    if (!root) return;

    // After render, restore any remembered scroll position
    this._restoreScroll(root);

    // Abort previous listeners cleanly
    if (this._abort) { try { this._abort.abort(); } catch {} }
    this._abort = new AbortController();
    const sig = this._abort.signal;

    /* Refresh */
    root.addEventListener("click", (ev) => {
      const btn = ev.target.closest?.('[data-action="refresh"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      // remember scroll before re-render
      this._rememberScroll(root);
      this.render(true);
    }, { capture:true, signal: sig });

    /* Adopt hexes */
    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.('[data-action="adopt-hexes"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      this._rememberScroll(root);

      const scene = canvas?.scene;
      const updates = [];
      for (const dr of scene?.drawings?.contents ?? []) {
        if (isHexDrawing(dr)) continue;
        if (dr.shape?.type !== "p" || (dr.shape?.points?.length ?? 0) !== 12) continue;
        updates.push({
          _id: dr.id,
          [`flags.${MOD}.isHex`]: true,
          [`flags.${MOD}.kind`]: "territory-hex",
          [`flags.${MOD}.name`]: dr.text || "Hex",
          [`flags.${MOD}.status`]: "unclaimed",
          [`flags.${MOD}.type`]: "wilderness",
          [`flags.${MOD}.size`]: "outpost",
          [`flags.${MOD}.population`]: "uninhabited",
          [`flags.${MOD}.capital`]: false,
          [`flags.${MOD}.resources`]: { food:0, materials:0, trade:0, military:0, knowledge:0 },
          [`flags.${MOD}.createdAt`]: Date.now()
        });
      }
      if (updates.length) await scene.updateEmbeddedDocuments("Drawing", updates);
      this.render(true);
    }, { capture:true, signal: sig });

    /* Focus */
    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.('button[data-action="focus"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      try {
        const dr = btn.dataset.uuid ? await fromUuid(btn.dataset.uuid) : canvas?.scene?.drawings?.get(btn.dataset.id);
        if (!dr) return;
        const { x, y, width, height } = dr;
        await canvas.animatePan({ x: x + Math.max(width,1)/2, y: y + Math.max(height,1)/2, scale: 1.25 });
      } catch (e) { warn("Focus failed", e); }
    }, { capture:true, signal: sig });

    /* Edit → Hex Editor (hardened) */
    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.('button[data-action="edit"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const uuid = btn.dataset.uuid;
      log("Edit clicked", { uuid });

      try {
        const claim = game?.bbttcc?.api?.territory?.claim;
        if (typeof claim === "function") {
          await claim(uuid);
          return;
        }

        // Fallback: open by UUID directly if API isn’t registered yet
        const dr = uuid ? await fromUuid(uuid) : null;
        if (!dr) return ui.notifications?.warn?.("Hex not found to edit.");
        if (typeof game?.bbttcc?.api?.territory?.openHexConfig === "function") {
          await game.bbttcc.api.territory.openHexConfig(dr.uuid);
          return;
        }

        // Last-ditch: gentle notify (keeps single-file change)
        ui.notifications?.warn?.("Hex Editor API is not available.");
      } catch (e) {
        warn("Edit failed", e);
        ui.notifications?.error?.("Failed to open Hex Editor.");
      }
    }, { capture:true, signal: sig });

    /* Delete */
    root.addEventListener("click", async (ev) => {
      const btn = ev.target.closest?.('button[data-action="delete"]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();

      const ok = await Dialog.confirm({
        title: "Delete Hex?",
        content: `<p>This will permanently remove this hex from the scene.</p>`,
        yes: () => true, no: () => false, defaultYes: false
      });
      if (!ok) return;

      this._rememberScroll(root);

      try {
        const uuid = btn.dataset.uuid;
        const dr = uuid ? await fromUuid(uuid) : canvas?.scene?.drawings?.get(btn.dataset.id);
        if (!dr) return;
        await dr.delete();
        this.render(true);
      } catch (e) { warn("Delete failed", e); }
    }, { capture:true, signal: sig });

    /* Inline edits (selects / numbers / checkbox) */
    root.addEventListener("change", async (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
      const path = el.dataset.edit;      // e.g. "status" or "resources.food"
      const id   = el.dataset.id;
      if (!path || !id) return;

      const scene = canvas?.scene;
      const dr = scene?.drawings?.get(id);
      const f  = dr?.flags?.[MOD] ?? {};

      let value;
      if (el.type === "checkbox") value = el.checked;
      else if (el.type === "number") value = Number(el.value ?? 0);
      else value = el.value;

      const update = { _id: id, [`flags.${MOD}.${path}`]: value };

      // Owner/Status sanity:
      // - If a faction is chosen while status is "unclaimed", promote to "occupied".
      // - If status is set to "unclaimed" while an owner exists, clear the owner.
      if (path === "factionId") {
        const newOwner = String(value ?? "");
        const curStatus = f.status === "claimed" ? "occupied" : (f.status ?? "unclaimed");
        if (newOwner && curStatus === "unclaimed") {
          update[`flags.${MOD}.status`] = "occupied";
        }
      } else if (path === "status") {
        const newStatus = String(value ?? "unclaimed");
        const curOwner = f.factionId ?? "";
        if (newStatus === "unclaimed" && curOwner) {
          update[`flags.${MOD}.factionId`] = "";
        }
      }

      // group resources.* under an object, preserving siblings
      if (path.startsWith("resources.")) {
        const [_, key] = path.split(".");
        update[`flags.${MOD}.resources`] = {
          food:       Number(key === "food"      ? value : f.resources?.food      ?? 0),
          materials:  Number(key === "materials" ? value : f.resources?.materials ?? 0),
          trade:      Number(key === "trade"     ? value : f.resources?.trade     ?? 0),
          military:   Number(key === "military"  ? value : f.resources?.military  ?? 0),
          knowledge:  Number(key === "knowledge" ? value : f.resources?.knowledge ?? 0),
        };
        delete update[`flags.${MOD}.resources.${key}`];
      }

      try {
        await scene.updateEmbeddedDocuments("Drawing", [update]);
        // toast (no rerender; preserve scroll naturally)
        this._showSavedToast(root);
      } catch (e) { warn("Inline edit failed", e); }
    }, { capture:true, signal: sig });
  }
}

/* Export ctor globally for toolbar opener */
globalThis.BBTTCC_TerritoryDashboardCtor = BBTTCC_TerritoryDashboard;
