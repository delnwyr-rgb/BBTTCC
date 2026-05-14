// modules/bbttcc-factions/scripts/inbox-card.enhancer.js
// BBTTCC — Trade Inbox card on the faction sheet.
//
// Renders the recipient faction's pending trade inbox (managed by
// pending-trades.js). Buttons:
//   Accept  — settles via exchange.trade (GM only)
//   Decline — marks declined (GM only)
//   Counter — opens TradeApp pre-filled with mirrored offer/ask (GM only)
//
// Visible to GM + recipient faction owner. Non-GM viewers see status read-only.

(function () {
  const MOD_ID = "bbttcc-factions";
  const TAG    = "[bbttcc-inbox-card]";
  const CARD_ID = "bbttcc-trade-inbox-card";

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

  function _pendingApi() { return game?.bbttcc?.api?.factions?.pending; }

  function _summarize(r) {
    const parts = [];
    for (const [k, v] of Object.entries(r?.marks || {})) {
      const op = (Number(v) || 0) / 10;
      if (op > 0) parts.push(`${Number.isInteger(op) ? op : op.toFixed(1)} ${k.charAt(0).toUpperCase() + k.slice(1)} OP`);
    }
    if (Number(r?.buildUnits) > 0) parts.push(`${Math.floor(r.buildUnits)} BU`);
    for (const [matKey, qty] of Object.entries(r?.materials || {})) {
      if (Number(qty) > 0) parts.push(`${Math.floor(qty)}× ${matKey}`);
    }
    return parts.length ? parts.join(", ") : "—";
  }

  function _renderCardHTML(faction) {
    const api = _pendingApi();
    const entries = api?.list ? api.list(faction) : [];
    const isGM = !!game.user?.isGM;
    // Recipient faction owners can act on their own inbox via socket relay.
    const isOwner = !isGM && !!faction?.testUserPermission?.(game.user, "OWNER");
    const canAct = isGM || isOwner;
    const actorVia = isGM ? "direct" : (isOwner ? "socket" : "");

    const rows = entries.length
      ? entries.map(e => {
          const ago = e.ts ? new Date(e.ts).toLocaleString() : "";
          return `
            <li class="bbttcc-inbox-row" data-id="${_esc(e.id)}">
              <div class="bbttcc-inbox-head">
                <span class="bbttcc-inbox-from">From <b>${_esc(e.fromName || e.fromId)}</b></span>
                <span class="bbttcc-inbox-when">${_esc(ago)}</span>
              </div>
              <div class="bbttcc-inbox-line"><b>Offer:</b> ${_esc(_summarize(e.offer))}</div>
              <div class="bbttcc-inbox-line"><b>Ask:</b> ${_esc(_summarize(e.ask))}</div>
              ${e.reason ? `<div class="bbttcc-inbox-reason">${_esc(e.reason)}</div>` : ""}
              ${canAct ? `
                <div class="bbttcc-inbox-actions" data-via="${actorVia}">
                  <button type="button" class="button" data-action="accept"  data-id="${_esc(e.id)}"><i class="fas fa-check"></i> Accept</button>
                  <button type="button" class="button" data-action="decline" data-id="${_esc(e.id)}"><i class="fas fa-times"></i> Decline</button>
                  <button type="button" class="button" data-action="counter" data-id="${_esc(e.id)}"><i class="fas fa-rotate"></i> Counter</button>
                </div>
                ${isOwner ? `<div class="bbttcc-inbox-relay-note">Relayed to GM for execution.</div>` : ""}
              ` : `
                <div class="bbttcc-inbox-readonly">Awaiting recipient or GM action.</div>
              `}
            </li>
          `;
        }).join("")
      : `<li class="bbttcc-inbox-empty">No pending trade offers.</li>`;

    return `
      <fieldset id="${CARD_ID}" class="bbttcc-card bbttcc-trade-inbox">
        <legend><i class="fas fa-inbox"></i> Trade Inbox ${entries.length ? `<span class="bbttcc-inbox-count">${entries.length}</span>` : ""}</legend>
        <style>
          .bbttcc-trade-inbox { margin-top: .75rem; }
          .bbttcc-trade-inbox ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .35rem; }
          .bbttcc-trade-inbox li { padding: .5rem .65rem; border-radius: .35rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(167,139,250,0.35); }
          .bbttcc-trade-inbox .bbttcc-inbox-head { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; }
          .bbttcc-trade-inbox .bbttcc-inbox-from { font-size: .9em; }
          .bbttcc-trade-inbox .bbttcc-inbox-when { font-size: .72em; opacity: .6; }
          .bbttcc-trade-inbox .bbttcc-inbox-line { font-size: .85em; line-height: 1.3; }
          .bbttcc-trade-inbox .bbttcc-inbox-reason { font-size: .8em; opacity: .8; font-style: italic; margin-top: .15rem; }
          .bbttcc-trade-inbox .bbttcc-inbox-actions { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .35rem; }
          .bbttcc-trade-inbox .bbttcc-inbox-readonly { font-size: .75em; opacity: .65; margin-top: .35rem; }
          .bbttcc-trade-inbox .bbttcc-inbox-relay-note { font-size: .7em; opacity: .55; margin-top: .25rem; font-style: italic; }
          .bbttcc-trade-inbox .bbttcc-inbox-empty { font-style: italic; opacity: .55; padding: .35rem .5rem; border: 1px dashed rgba(255,255,255,0.1); }
          .bbttcc-trade-inbox .bbttcc-inbox-count { display: inline-block; padding: .05rem .4rem; margin-left: .35rem;
            border-radius: 999px; background: rgba(167,139,250,0.4); font-size: .72em; }
        </style>
        <ul>${rows}</ul>
      </fieldset>
    `;
  }

  function _findHost($root) {
    if (!$root?.length) return null;
    const $tab = $root.find('.bbttcc-tab[data-tab="relationships"], .bbttcc-tab-relationships').first();
    return $tab.length ? $tab : null;
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
    $card.off("click.bbttccinbox");

    const isGM = !!game.user?.isGM;

    $card.on("click.bbttccinbox", '[data-action="accept"]', async (ev) => {
      const id = ev.currentTarget?.dataset?.id;
      if (!id) return;
      const api = _pendingApi();
      if (!api) return ui.notifications?.error?.("Pending API not loaded.");
      ev.currentTarget.disabled = true;
      if (isGM) {
        const res = await api.accept(faction, id);
        if (res?.ok) ui.notifications?.info?.("Trade accepted and settled.");
        else { ui.notifications?.error?.(res?.error || "Accept failed"); ev.currentTarget.disabled = false; }
      } else {
        const ok = api.emitPlayerAction?.({ faction, entryId: id, action: "accept" });
        if (ok) ui.notifications?.info?.("Accept relayed to GM for settlement.");
        else { ui.notifications?.error?.("Could not relay to GM."); ev.currentTarget.disabled = false; }
      }
    });

    $card.on("click.bbttccinbox", '[data-action="decline"]', async (ev) => {
      const id = ev.currentTarget?.dataset?.id;
      if (!id) return;
      const api = _pendingApi();
      if (!api) return ui.notifications?.error?.("Pending API not loaded.");
      ev.currentTarget.disabled = true;
      if (isGM) {
        const res = await api.decline(faction, id);
        if (res?.ok) ui.notifications?.info?.("Trade declined.");
        else { ui.notifications?.error?.(res?.error || "Decline failed"); ev.currentTarget.disabled = false; }
      } else {
        const ok = api.emitPlayerAction?.({ faction, entryId: id, action: "decline" });
        if (ok) ui.notifications?.info?.("Decline relayed to GM.");
        else { ui.notifications?.error?.("Could not relay to GM."); ev.currentTarget.disabled = false; }
      }
    });

    $card.on("click.bbttccinbox", '[data-action="counter"]', (ev) => {
      const id = ev.currentTarget?.dataset?.id;
      if (!id) return;
      const api = _pendingApi();
      if (!api?.list) return;
      const entry = api.list(faction).find(e => e.id === id);
      if (!entry) return ui.notifications?.warn?.("Entry not found (may have already settled).");

      _openCounterDialog(faction, entry);
    });
  }

  // ── Counter-offer composer ───────────────────────────────────────────────
  const OP_KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
  const OP_LABELS = {
    violence:"Violence", nonlethal:"Non-Lethal", intrigue:"Intrigue",
    economy:"Economy", softpower:"Soft Power", diplomacy:"Diplomacy",
    logistics:"Logistics", culture:"Culture", faith:"Faith"
  };

  function _renderResourceFields(prefix, label, prefilled) {
    const m = prefilled?.marks || {};
    const bu = Number(prefilled?.buildUnits || 0);
    const mats = prefilled?.materials || {};
    const matRows = Object.entries(mats).map(([k, v]) => `
      <div class="bbttcc-counter-row">
        <label>${_esc(k)}</label>
        <input type="number" name="${prefix}.mat.${_esc(k)}" min="0" step="1" value="${Math.max(0, Math.floor(Number(v) || 0))}">
      </div>
    `).join("");
    const opRows = OP_KEYS.map(k => {
      const op = (Number(m[k] || 0)) / 10;
      return `
        <div class="bbttcc-counter-row">
          <label>${_esc(OP_LABELS[k])} (OP)</label>
          <input type="number" name="${prefix}.marks.${k}" min="0" step="0.1" value="${Number.isInteger(op) ? op : op.toFixed(1)}">
        </div>
      `;
    }).join("");
    return `
      <fieldset class="bbttcc-counter-block">
        <legend>${_esc(label)}</legend>
        ${opRows}
        <div class="bbttcc-counter-row">
          <label>Build Units</label>
          <input type="number" name="${prefix}.bu" min="0" step="1" value="${Math.max(0, Math.floor(bu))}">
        </div>
        ${matRows ? `<div class="bbttcc-counter-mat-header">Materials</div>${matRows}` : ""}
      </fieldset>
    `;
  }

  function _collectFromForm(root, prefix) {
    const marks = {};
    for (const k of OP_KEYS) {
      const el = root.querySelector(`[name="${prefix}.marks.${k}"]`);
      const opVal = Number(el?.value || 0) || 0;
      const m = Math.max(0, Math.round(opVal * 10));
      if (m > 0) marks[k] = m;
    }
    const bu = Math.max(0, Math.floor(Number(root.querySelector(`[name="${prefix}.bu"]`)?.value || 0) || 0));
    const materials = {};
    for (const el of root.querySelectorAll(`[name^="${prefix}.mat."]`)) {
      const key = String(el.name).slice((`${prefix}.mat.`).length);
      const n = Math.max(0, Math.floor(Number(el.value || 0) || 0));
      if (key && n > 0) materials[key] = n;
    }
    return { marks, buildUnits: bu, materials };
  }

  function _openCounterDialog(faction, entry) {
    // The counter goes from THIS faction back to the original sender. Default
    // values mirror the original (recipient sends what was originally asked,
    // asks for what was originally offered) — the user can edit before sending.
    const orig = game.actors?.get(entry.fromId);
    if (!orig) return ui.notifications?.warn?.("Original sender not found.");

    const content = `
      <form>
        <div style="display:flex; flex-direction:column; gap:.5rem; padding:.5rem;">
          <div style="font-size:.85rem;"><b>${_esc(faction.name)}</b> → <b>${_esc(orig.name)}</b></div>
          <div style="font-size:.78rem; opacity:.7;">Defaults mirror the original. Edit and submit to send a counter-offer back.</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:.5rem;">
            ${_renderResourceFields("offer", `${faction.name} sends`, entry.ask)}
            ${_renderResourceFields("ask",   `${orig.name} sends`,   entry.offer)}
          </div>
          <label>Reason / note
            <input type="text" name="reason" placeholder="(optional)" value="Counter to: ${_esc(entry.reason || "(no note)")}">
          </label>
        </div>
        <style>
          .bbttcc-counter-block { border: 1px solid rgba(148,163,184,0.4); border-radius: 8px; padding: .5rem; }
          .bbttcc-counter-block legend { font-weight: 700; padding: 0 .25rem; }
          .bbttcc-counter-row { display: grid; grid-template-columns: 8rem 1fr; gap: .35rem; align-items: center; padding: .15rem 0; }
          .bbttcc-counter-row label { font-size: .78rem; opacity: .85; }
          .bbttcc-counter-mat-header { margin-top: .35rem; font-size: .72rem; opacity: .6; text-transform: uppercase; letter-spacing: .05em; }
        </style>
      </form>
    `;

    new Dialog({
      title: `Counter-offer to ${orig.name}`,
      content,
      buttons: {
        send: {
          label: "Send Counter",
          callback: async (html) => {
            const root = html[0] ?? html;
            const offer = _collectFromForm(root, "offer");
            const ask   = _collectFromForm(root, "ask");
            const reason = String(root.querySelector('[name="reason"]')?.value || "").trim();
            const api = _pendingApi();
            if (!api?.counter) return ui.notifications?.error?.("Pending API not loaded.");
            if (game.user?.isGM) {
              const res = await api.counter(faction, entry.id, offer, ask, reason);
              if (res?.ok) ui.notifications?.info?.("Counter-offer sent.");
              else ui.notifications?.error?.(res?.error || "Counter failed");
            } else {
              const ok = api.emitPlayerAction?.({
                faction, entryId: entry.id, action: "counter",
                payload: { offer, ask, reason }
              });
              if (ok) ui.notifications?.info?.("Counter relayed to GM.");
              else ui.notifications?.error?.("Could not relay counter to GM.");
            }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "send"
    }, { width: 720 }).render(true);
  }

  function _onRenderActorSheet(app, html) {
    try {
      const actor = app?.actor;
      if (!actor || !_isFactionActor(actor)) return;
      const isGM = !!game.user?.isGM;
      const isOwner = !!actor?.isOwner;
      if (!isGM && !isOwner) return;
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
    Hooks.on("bbttcc:trade:pending", _refreshAllFactionSheets);
    Hooks.on("bbttcc:trade:settled", _refreshAllFactionSheets);
    console.log(TAG, "Trade Inbox card enhancer armed.");
  });
})();
