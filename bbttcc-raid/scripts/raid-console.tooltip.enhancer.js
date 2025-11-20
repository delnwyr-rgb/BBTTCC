// BBTTCC Raid Console — Tooltip Enhancer v1.2 (generic render hook)
(() => {
  const STYLE_ID = "bbttcc-tip-style";
  if (!document.getElementById(STYLE_ID)) {
    const css = document.createElement("style");
    css.id = STYLE_ID;
    css.textContent = `
      .bbttcc-tip{display:inline-block;margin-left:.25rem;cursor:help;font-weight:700;opacity:.85}
      .bbttcc-tip:hover{opacity:1}
      .bbttcc-tip-pop{position:fixed;z-index:10000;max-width:420px;padding:.5rem .6rem;border-radius:.5rem;background:rgba(10,10,15,.96);color:#fff;box-shadow:0 6px 22px rgba(0,0,0,.35);font-size:.9rem;line-height:1.15rem;pointer-events:none;border:1px solid rgba(255,255,255,.12)}
      .bbttcc-tip-pin{pointer-events:auto}
    `;
    document.head.appendChild(css);
  }

  const hide = () => document.querySelectorAll(".bbttcc-tip-pop").forEach(n => n.remove());
  const show = (el, text, pinned=false, evt=null) => {
    hide();
    const tip = document.createElement("div");
    tip.className = "bbttcc-tip-pop" + (pinned ? " bbttcc-tip-pin" : "");
    tip.textContent = text;
    document.body.appendChild(tip);
    const base = el.getBoundingClientRect();
    const x = (evt?.clientX ?? base.right) + 10;
    const y = (evt?.clientY ?? base.top) + 8;
    tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 10) + "px";
    tip.style.top  = Math.min(y, window.innerHeight - tip.offsetHeight - 10) + "px";
    return tip;
  };

  Hooks.on("renderApplication", (app, html) => {
    const rootEl = (html?.[0] || html);
    if (!rootEl?.querySelector?.(".bbttcc-raid-console")) return;

    if (rootEl.__bbttccTipBound) return;
    Object.defineProperty(rootEl, "__bbttccTipBound", {value:true, enumerable:false});

    rootEl.addEventListener("mouseenter", (e) => {
      const t = e.target.closest(".bbttcc-tip[data-tip]");
      if (!t) return;
      const text = t.getAttribute("data-tip") || t.getAttribute("title") || "";
      if (!text) return;
      show(t, text, false, e);
    }, true);

    rootEl.addEventListener("mousemove", (e) => {
      const tip = document.querySelector(".bbttcc-tip-pop:not(.bbttcc-tip-pin)");
      if (!tip) return;
      const t = e.target.closest(".bbttcc-tip[data-tip]");
      if (!t) return hide();
      const x = e.clientX + 10, y = e.clientY + 8;
      tip.style.left = Math.min(x, window.innerWidth - tip.offsetWidth - 10) + "px";
      tip.style.top  = Math.min(y, window.innerHeight - tip.offsetHeight - 10) + "px";
    }, true);

    rootEl.addEventListener("mouseleave", (e) => {
      const within = e.relatedTarget && (rootEl.contains(e.relatedTarget) || e.relatedTarget.classList?.contains("bbttcc-tip-pop"));
      if (!within) hide();
    }, true);

    rootEl.addEventListener("click", (e) => {
      const t = e.target.closest(".bbttcc-tip[data-tip]");
      if (!t) return;
      const text = t.getAttribute("data-tip") || "";
      if (!text) return;
      const existing = document.querySelector(".bbttcc-tip-pop.bbttcc-tip-pin");
      if (existing) { existing.remove(); return; }
      const pin = show(t, text, true, e);
      const closer = (ev) => {
        if (!pin.contains(ev.target) && !t.contains(ev.target)) {
          pin.remove(); document.removeEventListener("mousedown", closer, true);
        }
      };
      document.addEventListener("mousedown", closer, true);
    }, true);
  });
})();
