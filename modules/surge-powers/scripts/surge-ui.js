/* ─────────────────────────────────────────────────────────────────────────────
 * Surge Powers · surge-ui.js — pool meter + menu entry points
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone UI (no custom character sheet required):
 *  • Token HUD — a ⚡ control on the right column showing the current pool.
 *  • Sheet header — a "⚡ n/max" button injected into the dnd5e character
 *    sheet header (both the AppV2 sheet and the legacy V1 sheets); the meter
 *    refreshes on re-render, which the runtime forces after every pool change.
 *  Left-click opens the Surge Powers menu; RIGHT-click opens the pool editor
 *  (set current Surge and the max override — blank max = automatic 2×Prof).
 * ─────────────────────────────────────────────────────────────────────────────
 */
(() => {
  const MOD = "surge-powers";
  const TAG = "[surge-powers/ui]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;

  const rootOf = (el) => el instanceof HTMLElement ? el : el?.[0] instanceof HTMLElement ? el[0] : null;
  const TIP = "Surge — left-click: powers menu · right-click: edit pool";

  // ── Pool editor ────────────────────────────────────────────────────────────
  async function editPool(actor) {
    const s = game.surgePowers;
    if (!s?.set || !actor) return;
    if (!actor.isOwner) return ui.notifications?.warn?.("You don't own this character.");
    const cur = s.get(actor), max = s.max(actor);
    const override = Number(foundry.utils.getProperty(actor, `flags.${MOD}.maxOverride`));
    const hasOverride = Number.isFinite(override) && override > 0;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: `⚡ Edit Surge — ${actor.name}` },
      content: `
        <div class="form-group"><label>Current Surge</label>
          <input type="number" name="value" value="${cur}" min="0" step="1" autofocus/></div>
        <div class="form-group"><label>Max Surge</label>
          <input type="number" name="max" value="${hasOverride ? override : ""}" placeholder="auto: ${hasOverride ? Math.max(4, (s.profOf?.(actor) ?? 2) * 2) : max}" min="1" step="1"/></div>
        <p style="font-size:.72rem;opacity:.6;margin:.3rem 0 0">Leave Max blank for automatic (2 × Proficiency Bonus, min 4).</p>`,
      ok: { label: "Save", callback: (_ev, b) => ({
        value: Number(b.form.elements.value?.value),
        max: String(b.form.elements.max?.value ?? "").trim()
      }) },
      rejectClose: false,
    }).catch(() => null);
    if (!result) return;
    try {
      if (result.max === "") await actor.update({ [`flags.${MOD}.-=maxOverride`]: null });
      else if (Number(result.max) > 0) await actor.update({ [`flags.${MOD}.maxOverride`]: Math.floor(Number(result.max)) });
      if (Number.isFinite(result.value)) await s.set(actor, result.value);  // clamps to the (new) max
    } catch (e) { console.warn(TAG, "pool edit failed", e); }
  }

  // ── Token HUD ──────────────────────────────────────────────────────────────
  Hooks.on("renderTokenHUD", (hud, html) => {
    try {
      const actor = hud.object?.actor;
      if (!actor || actor.type !== "character") return;
      const s = game.surgePowers;
      if (!s?.openMenu) return;
      const col = rootOf(html)?.querySelector?.(".col.right");
      if (!col || col.querySelector(".surge-powers-hud")) return;
      const btn = document.createElement("div");
      btn.className = "control-icon surge-powers-hud";
      btn.title = `${s.get(actor)}/${s.max(actor)} ${TIP}`;
      btn.innerHTML = `<i class="fas fa-bolt" style="color:#e8c84a"></i>
        <span style="position:absolute;bottom:-2px;right:2px;font-size:.62em;font-weight:700;color:#e8c84a;text-shadow:0 0 3px #000">${s.get(actor)}</span>`;
      btn.style.position = "relative";
      btn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); s.openMenu(actor); });
      btn.addEventListener("contextmenu", (ev) => { ev.preventDefault(); ev.stopPropagation(); editPool(actor); });
      col.appendChild(btn);
    } catch (e) { console.warn(TAG, "token HUD failed", e); }
  });

  // ── Character sheet header ─────────────────────────────────────────────────
  // dnd5e 5.x AppV2 sheet (CharacterActorSheet) + legacy V1 sheets. app.element
  // is the window root in both generations (HTMLElement in V2, jQuery in V1).
  const SHEET_HOOKS = ["renderCharacterActorSheet", "renderActorSheet5eCharacter2", "renderActorSheet5eCharacter"];

  function injectHeader(app) {
    try {
      const actor = app.actor ?? app.document;
      if (!actor || actor.type !== "character") return;
      const s = game.surgePowers;
      if (!s?.openMenu) return;
      const el = rootOf(app.element);
      const header = el?.querySelector?.(".window-header");
      if (!header) return;
      header.querySelector(".surge-powers-header")?.remove();  // refresh the meter
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "surge-powers-header";
      btn.title = TIP;
      btn.textContent = `⚡ ${s.get(actor)}/${s.max(actor)}`;
      btn.style.cssText = "flex:0 0 auto;width:auto;margin:0 .25rem;padding:0 .45rem;line-height:1.6;" +
        "font-size:.72rem;font-weight:700;color:#e8c84a;background:rgba(185,136,46,.15);" +
        "border:1px solid #b9882e66;border-radius:4px;cursor:pointer";
      btn.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); s.openMenu(actor); });
      btn.addEventListener("contextmenu", (ev) => { ev.preventDefault(); ev.stopPropagation(); editPool(actor); });
      const close = header.querySelector('[data-action="close"], .close, .header-control');
      header.insertBefore(btn, close ?? null);
    } catch (e) { console.warn(TAG, "sheet header failed", e); }
  }

  for (const h of SHEET_HOOKS) Hooks.on(h, (app) => injectHeader(app));

  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    game.surgePowers = Object.assign(game.surgePowers || {}, { editPool });
  });
})();
