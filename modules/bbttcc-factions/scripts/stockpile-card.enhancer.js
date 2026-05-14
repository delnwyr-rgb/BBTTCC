// modules/bbttcc-factions/scripts/stockpile-card.enhancer.js
// BBTTCC — Material Stockpile card on the faction sheet.
//
// Injects into the Assets tab (with Overview fallback). Lists current stockpile
// and exposes Deposit / Withdraw / Adjust dialogs that drive stockpile-api.

(function () {
  const MOD_ID = "bbttcc-factions";
  const TAG    = "[bbttcc-stockpile-card]";
  const CARD_ID = "bbttcc-stockpile-card";

  function _esc(s) {
    try { return foundry.utils.escapeHTML(String(s ?? "")); }
    catch { return String(s ?? ""); }
  }

  function _isFactionActor(a) {
    if (!a) return false;
    try {
      if (a.getFlag?.(MOD_ID, "isFaction") === true) return true;
      const t = (foundry.utils.getProperty(a, "system.details.type.value") || "").toString().toLowerCase();
      if (t === "faction") return true;
      const cls = a.getFlag?.("core", "sheetClass") ?? a?.flags?.core?.sheetClass;
      return String(cls || "").includes("BBTTCCFactionSheet");
    } catch { return false; }
  }

  function _stockpileApi() { return game?.bbttcc?.api?.factions?.stockpile; }

  function _readMaterialItems(character) {
    const out = [];
    if (!character?.items) return out;
    for (const it of character.items) {
      const rfi = it.getFlag?.("fourththing", "rfi.item");
      if (!rfi || rfi.frame !== "material" || !rfi.materialKey) continue;
      const qty = Math.max(0, Math.floor(Number(rfi.charges ?? 1) || 1));
      out.push({ id: it.id, name: it.name, materialKey: rfi.materialKey, qty });
    }
    return out;
  }

  function _eligibleCharacters(faction) {
    // Show all characters the user can see; the GM can always pick any.
    const isGM = !!game.user?.isGM;
    const all = (game.actors?.contents ?? []).filter(a => a?.type === "character");
    if (isGM) return all;
    return all.filter(a => a?.isOwner);
  }

  function _renderCardHTML(faction) {
    const api = _stockpileApi();
    const list = api?.list ? api.list(faction) : [];
    const isGM = !!game.user?.isGM;
    const isOwner = !!faction?.isOwner;
    const canEdit = isGM || isOwner;

    const rows = list.length
      ? list.map(m => `
          <li class="bbttcc-stockpile-row" data-key="${_esc(m.key)}">
            <img src="${_esc(m.img || "icons/svg/mystery-man.svg")}" alt="" loading="lazy">
            <span class="bbttcc-stockpile-name" data-tooltip="${_esc(m.key)}">${_esc(m.name || m.key)}</span>
            <span class="bbttcc-stockpile-qty">${m.qty}</span>
            ${canEdit ? `
              <span class="bbttcc-stockpile-rowbtns">
                <button type="button" class="bbttcc-mini" data-action="withdraw" data-key="${_esc(m.key)}" data-tooltip="Withdraw to a character"><i class="fas fa-arrow-up-from-bracket"></i></button>
                ${isGM ? `<button type="button" class="bbttcc-mini" data-action="adjust" data-key="${_esc(m.key)}" data-tooltip="Manual adjust (GM)"><i class="fas fa-pen"></i></button>` : ""}
              </span>
            ` : ""}
          </li>
        `).join("")
      : `<li class="bbttcc-stockpile-empty">Stockpile is empty. Deposit from a character to populate.</li>`;

    return `
      <fieldset id="${CARD_ID}" class="bbttcc-card bbttcc-stockpile">
        <legend><i class="fas fa-warehouse"></i> Material Stockpile</legend>
        <style>
          .bbttcc-stockpile { margin-top: .75rem; }
          .bbttcc-stockpile ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; }
          .bbttcc-stockpile li { display: grid; grid-template-columns: 1.4rem 1fr auto auto; gap: .5rem; align-items: center;
            padding: .3rem .5rem; border-radius: .35rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); }
          .bbttcc-stockpile li img { width: 1.4rem; height: 1.4rem; border-radius: .2rem; object-fit: cover; }
          .bbttcc-stockpile-name { font-size: .9em; line-height: 1.2; }
          .bbttcc-stockpile-qty { font-weight: 700; opacity: .9; min-width: 2rem; text-align: right; }
          .bbttcc-stockpile-rowbtns { display: inline-flex; gap: .25rem; }
          .bbttcc-stockpile-rowbtns .bbttcc-mini { padding: .15rem .35rem; font-size: .75rem; }
          .bbttcc-stockpile-empty { font-style: italic; opacity: .6; padding: .35rem .5rem; }
          .bbttcc-stockpile-actions { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .5rem; }
        </style>
        <ul>${rows}</ul>
        ${canEdit ? `
          <div class="bbttcc-stockpile-actions">
            <button type="button" class="button" data-action="deposit"><i class="fas fa-arrow-down-to-bracket"></i> Deposit from Character</button>
            ${isGM ? `<button type="button" class="button" data-action="adjust-new"><i class="fas fa-plus"></i> Adjust (GM)</button>` : ""}
          </div>
        ` : ""}
      </fieldset>
    `;
  }

  function _findHost($root) {
    if (!$root?.length) return null;
    const $assets = $root.find('.bbttcc-tab[data-tab="assets"], .bbttcc-tab-assets').first();
    if ($assets.length) return $assets;
    const $overview = $root.find('.bbttcc-tab[data-tab="overview"], .bbttcc-tab-overview').first();
    return $overview.length ? $overview : null;
  }

  function _renderInto($root, faction) {
    const $host = _findHost($root);
    if (!$host || !$host.length) return;
    const html = _renderCardHTML(faction);
    const $existing = $host.find(`#${CARD_ID}`).first();
    if ($existing.length) $existing.replaceWith(html);
    else $host.append(html);
    _wireCard($root, faction);
  }

  function _wireCard($root, faction) {
    const $card = $root.find(`#${CARD_ID}`);
    if (!$card.length) return;
    $card.off("click.bbttccstockpile");
    $card.on("click.bbttccstockpile", '[data-action="deposit"]',   () => _openDepositDialog(faction));
    $card.on("click.bbttccstockpile", '[data-action="withdraw"]',  (ev) => _openWithdrawDialog(faction, ev.currentTarget?.dataset?.key));
    $card.on("click.bbttccstockpile", '[data-action="adjust"]',    (ev) => _openAdjustDialog(faction, ev.currentTarget?.dataset?.key));
    $card.on("click.bbttccstockpile", '[data-action="adjust-new"]',()=> _openAdjustDialog(faction, null));
  }

  // ── Deposit dialog ───────────────────────────────────────────────────────
  function _openDepositDialog(faction) {
    const api = _stockpileApi();
    if (!api) return ui.notifications?.error?.("Stockpile API not loaded.");
    const chars = _eligibleCharacters(faction);
    if (!chars.length) return ui.notifications?.warn?.("No eligible characters.");

    const charOpts = chars.map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`).join("");
    const content = `
      <form>
        <div style="display:flex; flex-direction:column; gap:.5rem;">
          <label>Character
            <select name="charId" style="width:100%;">${charOpts}</select>
          </label>
          <label>Material Item
            <select name="itemId" style="width:100%;"></select>
          </label>
          <label>Quantity
            <input type="number" name="qty" min="1" step="1" value="1" style="width:6rem;">
          </label>
          <div style="font-size:.78rem; opacity:.7;">Deposits drain charges from the chosen item; a fully-drained item is deleted.</div>
        </div>
      </form>
    `;
    new Dialog({
      title: `${faction.name} — Deposit Material`,
      content,
      buttons: {
        deposit: {
          label: "Deposit",
          callback: async (html) => {
            const root = html[0];
            const charId = root.querySelector('[name="charId"]')?.value;
            const itemId = root.querySelector('[name="itemId"]')?.value;
            const qty = Math.max(1, Math.floor(Number(root.querySelector('[name="qty"]')?.value || 0) || 0));
            const ch = game.actors.get(charId);
            if (!ch || !itemId) return ui.notifications?.warn?.("Pick a character and a material item.");
            const res = await api.depositFromCharacter(ch, faction, { itemId, qty });
            if (res?.ok) {
              const summary = (res.deposited || []).map(d => `${d.qty}× ${d.name}`).join(", ");
              ui.notifications?.info?.(`Deposited: ${summary}`);
            } else {
              ui.notifications?.error?.(res?.error || "Deposit failed");
            }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "deposit",
      render: (html) => {
        const root = html[0] ?? html;
        const charSel = root.querySelector('[name="charId"]');
        const itemSel = root.querySelector('[name="itemId"]');
        const qtyEl   = root.querySelector('[name="qty"]');
        const refreshItems = () => {
          const ch = game.actors.get(charSel.value);
          const items = ch ? _readMaterialItems(ch) : [];
          itemSel.innerHTML = items.length
            ? items.map(i => `<option value="${_esc(i.id)}" data-max="${i.qty}">${_esc(i.name)} — ${i.qty} (${_esc(i.materialKey)})</option>`).join("")
            : `<option disabled selected>No material items on this character</option>`;
          const sel = itemSel.options[itemSel.selectedIndex];
          if (sel?.dataset?.max && qtyEl) qtyEl.max = sel.dataset.max;
        };
        charSel?.addEventListener("change", refreshItems);
        itemSel?.addEventListener("change", () => {
          const sel = itemSel.options[itemSel.selectedIndex];
          if (sel?.dataset?.max && qtyEl) qtyEl.max = sel.dataset.max;
        });
        refreshItems();
      }
    }, { width: 420 }).render(true);
  }

  // ── Withdraw dialog ──────────────────────────────────────────────────────
  function _openWithdrawDialog(faction, matKey) {
    const api = _stockpileApi();
    if (!api) return ui.notifications?.error?.("Stockpile API not loaded.");
    const have = api.qty(faction, matKey);
    if (!have) return ui.notifications?.warn?.("Stockpile has none of that material.");

    const chars = _eligibleCharacters(faction);
    if (!chars.length) return ui.notifications?.warn?.("No eligible characters.");

    const charOpts = chars.map(c => `<option value="${_esc(c.id)}">${_esc(c.name)}</option>`).join("");
    const content = `
      <form>
        <div style="display:flex; flex-direction:column; gap:.5rem;">
          <div><b>${_esc(matKey)}</b> — stockpile has <b>${have}</b></div>
          <label>To Character
            <select name="charId" style="width:100%;">${charOpts}</select>
          </label>
          <label>Quantity
            <input type="number" name="qty" min="1" max="${have}" step="1" value="1" style="width:6rem;">
          </label>
        </div>
      </form>
    `;
    new Dialog({
      title: `${faction.name} — Withdraw ${matKey}`,
      content,
      buttons: {
        withdraw: {
          label: "Withdraw",
          callback: async (html) => {
            const root = html[0];
            const charId = root.querySelector('[name="charId"]')?.value;
            const qty = Math.max(1, Math.floor(Number(root.querySelector('[name="qty"]')?.value || 0) || 0));
            const ch = game.actors.get(charId);
            if (!ch) return;
            const res = await api.withdrawToCharacter(ch, faction, matKey, qty);
            if (res?.ok) ui.notifications?.info?.(`Withdrew ${qty}× ${matKey} → ${ch.name}`);
            else ui.notifications?.error?.(res?.error || "Withdraw failed");
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "withdraw"
    }, { width: 380 }).render(true);
  }

  // ── Adjust (GM) dialog ───────────────────────────────────────────────────
  function _openAdjustDialog(faction, matKey) {
    const api = _stockpileApi();
    if (!api) return ui.notifications?.error?.("Stockpile API not loaded.");
    if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");

    const have = matKey ? api.qty(faction, matKey) : 0;
    const content = `
      <form>
        <div style="display:flex; flex-direction:column; gap:.5rem;">
          <label>Material Key
            <input type="text" name="key" value="${_esc(matKey || "")}" placeholder="e.g. heart-iron" style="width:100%;" ${matKey ? "readonly" : ""}>
          </label>
          ${matKey ? `<div>Current: <b>${have}</b></div>` : ""}
          <label>Display Name (optional)
            <input type="text" name="name" placeholder="(defaults to key)" style="width:100%;">
          </label>
          <label>Delta (signed integer)
            <input type="number" name="delta" step="1" value="0" style="width:8rem;">
          </label>
          <div style="font-size:.78rem; opacity:.7;">Positive adds, negative subtracts. Stockpile floor is 0.</div>
        </div>
      </form>
    `;
    new Dialog({
      title: `${faction.name} — Adjust Stockpile (GM)`,
      content,
      buttons: {
        apply: {
          label: "Apply",
          callback: async (html) => {
            const root = html[0];
            const key = String(root.querySelector('[name="key"]')?.value || "").trim();
            const name = String(root.querySelector('[name="name"]')?.value || "").trim() || null;
            const delta = Math.floor(Number(root.querySelector('[name="delta"]')?.value || 0) || 0);
            if (!key) return ui.notifications?.warn?.("Material key required.");
            if (!delta) return ui.notifications?.warn?.("Delta must be non-zero.");
            const res = await api.adjust(faction, key, delta, name ? { name } : {});
            if (res?.ok) ui.notifications?.info?.(`${key}: ${res.before} → ${res.after}`);
            else ui.notifications?.error?.(res?.error || "Adjust failed");
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "apply"
    }, { width: 420 }).render(true);
  }

  // ── Hook plumbing ────────────────────────────────────────────────────────
  function _onRenderActorSheet(app, html) {
    try {
      const actor = app?.actor;
      if (!actor || !_isFactionActor(actor)) return;
      const $root = (html?.jquery ? html : (window.$ ? $(html) : null));
      if (!$root) return;
      setTimeout(() => {
        try { _renderInto($root, actor); } catch (e) { console.warn(TAG, "render failed", e); }
      }, 0);
    } catch (e) { console.warn(TAG, "hook failed", e); }
  }

  function _refreshAllFactionSheets() {
    try {
      for (const app of (Object.values(ui.windows || {}))) {
        const actor = app?.actor;
        if (!actor || !_isFactionActor(actor)) continue;
        const el = app.element;
        const $root = el?.jquery ? el : (window.$ && el ? $(el) : null);
        if ($root) _renderInto($root, actor);
      }
    } catch (e) { console.warn(TAG, "refresh failed", e); }
  }

  Hooks.on("renderActorSheet", _onRenderActorSheet);
  Hooks.once("ready", () => {
    Hooks.on("bbttcc:stockpile:changed", _refreshAllFactionSheets);
    Hooks.on("bbttcc:economy:exchange",  _refreshAllFactionSheets);
    Hooks.on("bbttcc:economy:share",     _refreshAllFactionSheets);
    console.log(TAG, "Stockpile card enhancer armed.");
  });
})();
