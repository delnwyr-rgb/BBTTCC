// modules/bbttcc-factions/scripts/trade-history.enhancer.js
// Bad Eden — Trade History ledger card on the faction sheet.
//
// Reads warLogs flag (existing storage), filters to type === "exchange" entries
// (written by exchange-engine.js share/trade), and renders a recent-history card
// inside the Relationships tab beneath the relations card.
//
// Visible to GM + faction owner. Defaults to 10 most-recent entries.

(function () {
  const MOD_ID = "bbttcc-factions";
  const TAG    = "[bbttcc-trade-history]";
  const MAX_ENTRIES = 10;
  const CARD_ID = "bbttcc-trade-history-card";

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

  function _readExchangeLogs(actor) {
    const wl = actor?.getFlag?.(MOD_ID, "warLogs");
    if (!Array.isArray(wl)) return [];
    return wl.filter(e => e && e.type === "exchange").slice(0, MAX_ENTRIES);
  }

  function _escape(s) {
    try { return foundry.utils.escapeHTML(String(s ?? "")); }
    catch { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  }

  function _classifySummary(s) {
    const txt = String(s || "");
    if (/^Allied Send/i.test(txt)) return { kind: "send", icon: "fa-handshake", label: "Send" };
    if (/^Trade/i.test(txt))       return { kind: "trade", icon: "fa-balance-scale", label: "Trade" };
    return { kind: "other", icon: "fa-exchange-alt", label: "Exchange" };
  }

  function _renderCardHTML(actor) {
    const entries = _readExchangeLogs(actor);
    const rows = entries.length
      ? entries.map(e => {
          const meta = _classifySummary(e.summary);
          const when = _escape(e.date || (e.ts ? new Date(e.ts).toLocaleString() : ""));
          return `
            <li class="bbttcc-trade-history-row" data-kind="${meta.kind}">
              <span class="bbttcc-trade-history-icon" data-tooltip="${_escape(meta.label)}"><i class="fas ${meta.icon}"></i></span>
              <span class="bbttcc-trade-history-summary">${_escape(e.summary || "(no summary)")}</span>
              <span class="bbttcc-trade-history-when">${when}</span>
            </li>
          `;
        }).join("")
      : `<li class="bbttcc-trade-history-empty">No trades or sends recorded yet.</li>`;

    return `
      <fieldset id="${CARD_ID}" class="bbttcc-card bbttcc-trade-history">
        <legend><i class="fas fa-scroll"></i> Trade History</legend>
        <style>
          .bbttcc-trade-history { margin-top: .75rem; }
          .bbttcc-trade-history ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .25rem; }
          .bbttcc-trade-history li { display: grid; grid-template-columns: 1.4rem 1fr auto; gap: .5rem; align-items: baseline;
            padding: .35rem .5rem; border-radius: .35rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); }
          .bbttcc-trade-history li[data-kind="send"]  { border-color: rgba(56,189,248,0.35); }
          .bbttcc-trade-history li[data-kind="trade"] { border-color: rgba(167,139,250,0.35); }
          .bbttcc-trade-history-icon { text-align: center; opacity: .85; }
          .bbttcc-trade-history-summary { font-size: .92em; line-height: 1.25; }
          .bbttcc-trade-history-when { font-size: .78em; opacity: .6; white-space: nowrap; }
          .bbttcc-trade-history-empty { font-style: italic; opacity: .6; padding: .35rem .5rem; }
        </style>
        <ul>${rows}</ul>
      </fieldset>
    `;
  }

  function _findRelationshipsHost($root) {
    if (!$root?.length) return null;
    const $tab = $root.find('.bbttcc-tab[data-tab="relationships"], .bbttcc-tab-relationships').first();
    return $tab.length ? $tab : null;
  }

  function _renderInto($root, actor) {
    const $host = _findRelationshipsHost($root);
    if (!$host || !$host.length) return;

    const html = _renderCardHTML(actor);
    const $existing = $host.find(`#${CARD_ID}`).first();
    if ($existing.length) {
      $existing.replaceWith(html);
    } else {
      $host.append(html);
    }
  }

  function _onRenderActorSheet(app, html, _ctx) {
    try {
      const actor = app?.actor;
      if (!actor || !_isFactionActor(actor)) return;

      const isGM = !!game.user?.isGM;
      const isOwner = !!actor?.isOwner;
      if (!isGM && !isOwner) return;

      const $root = (html?.jquery ? html : (window.$ ? $(html) : null));
      if (!$root) return;

      // Defer one tick so the relations card has a chance to mount first.
      setTimeout(() => {
        try { _renderInto($root, actor); } catch (e) { console.warn(TAG, "render failed", e); }
      }, 0);
    } catch (e) {
      console.warn(TAG, "hook failed", e);
    }
  }

  // Refresh open faction sheets when a new exchange/send hook fires.
  function _refreshAllFactionSheets() {
    try {
      for (const app of (Object.values(ui.windows || {}))) {
        const actor = app?.actor;
        if (!actor || !_isFactionActor(actor)) continue;
        const el = app.element;
        const $root = el?.jquery ? el : (window.$ && el ? $(el) : null);
        if ($root) _renderInto($root, actor);
      }
    } catch (e) {
      console.warn(TAG, "refresh failed", e);
    }
  }

  Hooks.on("renderActorSheet", _onRenderActorSheet);
  Hooks.once("ready", () => {
    Hooks.on("bbttcc:economy:exchange", _refreshAllFactionSheets);
    Hooks.on("bbttcc:economy:share", _refreshAllFactionSheets);
    console.log(TAG, "Trade History card enhancer armed.");
  });
})();
