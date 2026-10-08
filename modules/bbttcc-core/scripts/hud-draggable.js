/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-core · hud-draggable.js — the shared HUD drag / collapse / remember helper
 * ─────────────────────────────────────────────────────────────────────────────
 * `globalThis._ftMakeHudDraggable(el, { storageKey, collapsedLabel, resize })`
 * makes a fixed-position HUD draggable and collapsible, and remembers its
 * position per user in localStorage. The RFI system (fourththing) defines the
 * same helper in its own module.js and loads first, so on RFI this file is a
 * no-op (`??=`). On dnd5e there is no system helper: without this file the
 * player HUD and the Bad Eden toolbar both sit fixed at the top centre and draw
 * over each other with no way to move either (the step-4 "toolbar/HUD overlap",
 * 2026-10-08). The function body is a verbatim copy of the system's
 * (systems/fourththing/module.js, `_ftMakeHudDraggable`) — keep them in step.
 * ───────────────────────────────────────────────────────────────────────────── */
function _ftMakeHudDraggable(el, opts = {}) {
  if (!el) return;
  const storageKey   = opts.storageKey   ?? "anon";
  const collapsedLabel = opts.collapsedLabel ?? "•••";
  const skipReset    = !!opts.skipReset;

  const STORAGE = `ft-hud-pos:${(game?.user?.id) || "anon"}:${storageKey}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE) || "null") || {}; } catch { return {}; } };
  const save = (data) => { try { localStorage.setItem(STORAGE, JSON.stringify(data)); } catch (_) {} };

  // 1) Build (or rebuild) the floating ctrl bar at the top-right of the HUD.
  el.querySelectorAll(":scope > .ft-hud-ctrl").forEach(n => n.remove());
  const ctrl = document.createElement("div");
  ctrl.className = "ft-hud-ctrl";
  ctrl.style.cssText = "position:absolute;top:3px;right:4px;display:flex;gap:4px;z-index:5;pointer-events:auto;";
  const mkBtn = (label, title, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.style.cssText = "display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:18px;height:18px;padding:0 5px;font-size:0.74rem;line-height:1;background:rgba(0,0,0,0.4);color:#ffd28a;border:1px solid #666;border-radius:3px;cursor:pointer;";
    b.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); fn(e); });
    b.addEventListener("pointerdown", (e) => e.stopPropagation()); // don't trigger drag
    return b;
  };

  const isCollapsed = () => el.classList.contains("ft-hud-collapsed");
  const setCollapsed = (c) => {
    el.classList.toggle("ft-hud-collapsed", c);
    let chip = el.querySelector(":scope > .ft-hud-chip");
    // Hide every direct child except the chip + ctrl bar when collapsed.
    Array.from(el.children).forEach(child => {
      if (child === ctrl || child.classList?.contains("ft-hud-chip")) return;
      child.style.display = c ? "none" : "";
    });
    if (c) {
      if (!chip) {
        chip = document.createElement("span");
        chip.className = "ft-hud-chip";
        chip.textContent = collapsedLabel;
        chip.style.cssText = "font-size:0.78rem;color:#ffd28a;cursor:pointer;padding:1px 46px 1px 8px;display:inline-block;";
        chip.addEventListener("click", () => setCollapsed(false));
        el.insertBefore(chip, ctrl);
      }
    } else {
      chip?.remove();
    }
    // Resizable HUDs: hide the grip + shrink to the chip while collapsed; restore on expand.
    if (opts.resize) {
      el.style.resize = c ? "none" : "both";
      if (c) { el.style.width = ""; el.style.height = ""; }
      else {
        const sz = load();
        if (sz.width  != null) el.style.width  = sz.width  + "px";
        if (sz.height != null) el.style.height = sz.height + "px";
      }
    }
    save({ ...load(), collapsed: c });
    // Refresh ctrl-bar's collapse-button label.
    const btnCollapse = ctrl.querySelector("[data-act=collapse]");
    if (btnCollapse) { btnCollapse.textContent = c ? "+" : "–"; btnCollapse.title = c ? "Expand" : "Collapse"; }
  };

  const btnCollapse = mkBtn(isCollapsed() ? "+" : "–", isCollapsed() ? "Expand" : "Collapse", () => setCollapsed(!isCollapsed()));
  btnCollapse.dataset.act = "collapse";
  ctrl.appendChild(btnCollapse);
  if (!skipReset) {
    ctrl.appendChild(mkBtn("⟲", opts.resize ? "Reset size & position" : "Reset position", () => {
      try { localStorage.removeItem(STORAGE); } catch (_) {}
      el.style.left = "";
      el.style.top = "";
      el.style.right = "";
      el.style.bottom = "";
      el.style.transform = "";
      if (opts.resize) { el.style.width = ""; el.style.height = ""; }
      if (isCollapsed()) setCollapsed(false);
      ui.notifications?.info?.(opts.resize ? "HUD size & position reset." : "HUD position reset.");
    }));
  }
  el.appendChild(ctrl);

  // 2) Re-apply saved position on every call. The HUDs' own default
  //    positioners (e.g. _ftPositionCrewHud) run before us, so we need
  //    to overwrite them with the user's saved drag position each render.
  //    NEVER while a drag is live on this element — HUDs re-render on
  //    canvasReady etc., and snapping to the saved spot mid-drag makes the
  //    panel fight the cursor (the "window retreats from my cursor" bug).
  const saved = load();
  if (el.__ftHudDrag?.dragging) {
    /* mid-drag render: leave position to the drag handler */
  } else if (saved.left != null && saved.top != null) {
    el.style.left = saved.left + "px";
    el.style.top  = saved.top  + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.style.transform = "none";
  } else if (opts.resize) {
    // Resizable HUDs must be TOP-LEFT anchored or the native grip resizes "backwards"
    // (a right-anchored box grows away from the cursor). Pin the current screen box to
    // left/top once, so the bottom-right grip grows predictably toward the cursor.
    const r = el.getBoundingClientRect();
    if (r.width || r.height) {
      el.style.left = Math.round(r.left) + "px";
      el.style.top  = Math.round(r.top)  + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
      el.style.transform = "none";
    }
  }
  // Re-apply saved size for resizable HUDs (skip while collapsed — the chip stays small).
  if (opts.resize && !saved.collapsed) {
    if (saved.width  != null) el.style.width  = saved.width  + "px";
    if (saved.height != null) el.style.height = saved.height + "px";
  }

  // Re-render of an already-wired HUD that's collapsed: the innerHTML swap
  // brought the full content back and destroyed the chip while the class stuck
  // — re-hide and re-chip (2026-10-01).
  if (el.dataset.ftHudInit === "1" && isCollapsed()) setCollapsed(true);

  // 3) One-time wire-up: collapse-state restore + drag listeners.
  if (el.dataset.ftHudInit !== "1") {
    el.dataset.ftHudInit = "1";
    el.style.position = el.style.position || "fixed";
    el.style.paddingRight = "50px"; // clears the ctrl bar (collapse + reset) so right-aligned header text never slides under it
    if (saved.collapsed) setCollapsed(true);

    // Opt-in user-resizing: native CSS grip + debounced persistence of the
    // chosen size to the same localStorage record as position. Skip saves
    // while collapsed so the chip's tiny height never overwrites the real one.
    if (opts.resize) {
      el.style.resize = el.style.resize || "both";
      if (!el.style.overflow) el.style.overflow = "hidden";
      if (window.ResizeObserver) {
        let rzTimer = null;
        const ro = new ResizeObserver(() => {
          if (isCollapsed()) return;
          if (rzTimer) clearTimeout(rzTimer);
          rzTimer = setTimeout(() => {
            const r = el.getBoundingClientRect();
            save({ ...load(), width: Math.round(r.width), height: Math.round(r.height) });
          }, 250);
        });
        ro.observe(el);
      }
    }

    // 2026-05-19 — Drag uses a movement threshold so a true click on a
    // child element (e.g. a manifest row, which isn't a <button>) still
    // fires its click handler. Without this, pointer capture stole the
    // gesture and the manifest's per-steward click was suppressed.
    const DRAG_THRESHOLD_PX = 4;
    // Drag state lives ON the element so re-renders (which re-run this helper
    // but skip this one-time block) can see a live drag and stay hands-off.
    const drag = el.__ftHudDrag = { down: false, dragging: false };
    let sx = 0, sy = 0, ox = 0, oy = 0, capturedId = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, a, input, select, textarea, .ft-hud-ctrl, .ft-hud-chip")) return;
      const r = el.getBoundingClientRect();
      drag.down = true;
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      capturedId = e.pointerId;
    });
    const endDrag = (e) => {
      const wasDragging = drag.dragging;
      drag.down = false; drag.dragging = false;
      if (wasDragging) {
        try { el.releasePointerCapture?.(e.pointerId); } catch (_) {}
        el.style.cursor = "";
        // Skip the save when the element left the DOM mid-drag (rect is 0,0).
        if (el.isConnected) {
          const r = el.getBoundingClientRect();
          save({ ...load(), left: Math.round(r.left), top: Math.round(r.top) });
        }
      }
    };
    el.addEventListener("pointermove", (e) => {
      if (!drag.down) return;
      // Self-heal: if the primary button is no longer held, the pointerup was
      // lost (re-render/teardown mid-drag) — end the drag instead of letting
      // the panel glue itself to an unpressed cursor.
      if ((e.buttons & 1) === 0) { endDrag(e); return; }
      if (!drag.dragging) {
        if (Math.abs(e.clientX - sx) < DRAG_THRESHOLD_PX
         && Math.abs(e.clientY - sy) < DRAG_THRESHOLD_PX) return;
        drag.dragging = true;
        try { el.setPointerCapture?.(capturedId); } catch (_) {}
        el.style.cursor = "grabbing";
      }
      const left = Math.max(0, Math.min(window.innerWidth - 40,  ox + e.clientX - sx));
      const top  = Math.max(0, Math.min(window.innerHeight - 20, oy + e.clientY - sy));
      el.style.left = left + "px";
      el.style.top  = top  + "px";
      el.style.right = "auto"; el.style.bottom = "auto"; el.style.transform = "none";
    });
    el.addEventListener("pointerup",     endDrag);
    el.addEventListener("pointercancel", endDrag);
    // Fires whenever the browser strips our capture (element hidden/replaced,
    // OS-level cancel) — the case the old code missed, which left ALL pointer
    // events routed to this element: HUD stuck to cursor + dead canvas pan.
    el.addEventListener("lostpointercapture", endDrag);
  }
}
// The system's copy wins when it exists (RFI); dnd5e gets this one.
globalThis._ftMakeHudDraggable ??= _ftMakeHudDraggable;
