// modules/bbttcc-banks/scripts/faction-bank-app.js
// Bad Eden — Banks & Loot: Faction / Coalition Bank UI v0.1 (Phase 2)
//
// The faction-side bank: a read-only Marks treasury (opBank vs caps), the faction's
// stored item vault (withdraw, owner/GM-gated), and a "Host Coalition Treasury"
// toggle. Deposits flow in from a Steward's Personal Bank destination picker;
// salvage refines into Marks on the way in (see vault-core transferVault).

const MOD_ID = "bbttcc-banks";
const TAG    = "[bbttcc-banks]";
const warn   = (...a) => console.warn(TAG, ...a);

const { ApplicationV2 } = foundry.applications.api;

const BUCKET_LABELS = {
  violence: "Violence", nonlethal: "Non-Lethal", intrigue: "Intrigue", economy: "Economy",
  softpower: "Soft Power", diplomacy: "Diplomacy", logistics: "Logistics", culture: "Culture", faith: "Faith",
};

function _esc(s) { return foundry.utils.escapeHTML(String(s ?? "")); }

// marks → OP number (1 OP = 10 marks), via the OP engine when present.
function _op(marks) {
  const fmt = game?.bbttcc?.api?.op?.formatMarksAsOPNumber;
  if (fmt) return fmt(marks);
  const n = Number(marks) || 0;
  return Number.isInteger(n / 10) ? String(n / 10) : (n / 10).toFixed(1);
}

function _isFaction(a) { return !!game?.bbttcc?.api?.banks?.isFactionActor?.(a); }
function _canManage(a) { return !!game?.bbttcc?.api?.banks?.canManage?.(a); }

// Stewards (characters) the current user owns — withdraw recipients.
function _userStewards() {
  return (game.actors?.contents ?? []).filter(a => a.type === "character" && a.isOwner);
}

class FactionBankApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-bank-faction-{id}",
    classes: ["bbttcc", "bbttcc-be", "bbttcc-theme-gm", "bbttcc-bank"],
    position: { width: 680, height: "auto" },
    window: { title: "Faction Bank", icon: "fas fa-landmark", resizable: true },
  };

  constructor(faction, options = {}) {
    super(options);
    this.faction = faction;
  }

  get title() { return `Faction Bank — ${this.faction?.name ?? "Faction"}`; }

  _treasuryHTML() {
    const t = game?.bbttcc?.api?.banks?.factionTreasury?.(this.faction) ?? { marks: {}, caps: {} };
    const buckets = game?.bbttcc?.api?.banks?.OP_BUCKETS ?? Object.keys(BUCKET_LABELS);
    const chips = buckets.map(b => {
      const m = Number(t.marks?.[b] || 0);
      const cap = Number(t.caps?.[b] || 0);
      if (m <= 0 && cap <= 0) return "";
      const near = cap > 0 && m >= cap;
      return `<span class="bbttcc-treasury-chip${near ? " is-full" : ""}"
        data-tooltip="${_esc(BUCKET_LABELS[b] || b)} — ${m} / ${cap || "∞"} marks">
        <span class="lbl">${_esc(BUCKET_LABELS[b] || b)}</span>
        <span class="val">${_op(m)}${cap > 0 ? ` / ${_op(cap)}` : ""} OP</span>
      </span>`;
    }).filter(Boolean).join("");
    return chips || `<span class="bbttcc-bank-empty">Treasury empty.</span>`;
  }

  _storedHTML(kind, label) {
    const stash = game?.bbttcc?.api?.banks?.listVault?.(this.faction, kind) ?? [];
    const canManage = _canManage(this.faction);
    const stewards = _userStewards();
    const noSteward = stewards.length === 0;
    const rows = stash.length
      ? stash.map(e => `<li class="bbttcc-bank-row" data-stash-id="${_esc(e.stashId)}">
          <img src="${_esc(e.img || "icons/svg/item-bag.svg")}" alt="" />
          <span class="bbttcc-bank-name">${_esc(e.name)}${e.tier ? `<span class="bbttcc-bank-tier">T${_esc(e.tier)}</span>` : ""}</span>
          ${e.qty > 1 ? `<span class="bbttcc-bank-qty">×${_esc(e.qty)}</span>` : ""}
          <button type="button" class="bbttcc-bank-btn" data-action="withdraw" data-kind="${_esc(kind)}"
            data-stash-id="${_esc(e.stashId)}" ${(canManage && !noSteward) ? "" : "disabled"}
            data-tooltip="${canManage ? (noSteward ? "No owned Steward to receive it." : "Withdraw to the selected Steward.") : "Only the faction owner or a GM may withdraw."}">
            <i class="fas fa-arrow-left"></i> Withdraw
          </button>
        </li>`).join("")
      : `<li class="bbttcc-bank-empty">${_esc(label)} is empty.</li>`;
    return `<div class="bbttcc-bank-col">
      <h3><i class="fas fa-vault"></i> ${_esc(label)}</h3>
      <ul class="bbttcc-bank-list" data-side="${_esc(kind)}">${rows}</ul>
    </div>`;
  }

  async _renderHTML() {
    const isLead = this.faction?.getFlag?.(MOD_ID, "coalitionLead") === true;
    const canManage = _canManage(this.faction);
    const stewards = _userStewards();
    const stewardOpts = stewards.map(s => `<option value="${_esc(s.id)}">${_esc(s.name)}</option>`).join("")
      || `<option value="">— no owned Steward —</option>`;

    const coalitionToggle = canManage
      ? `<label class="bbttcc-bank-coalition">
          <input type="checkbox" data-role="coalition-lead" ${isLead ? "checked" : ""}/>
          <span>Host Coalition Treasury <small>(mutually-Allied factions may deposit)</small></span>
        </label>`
      : (isLead ? `<span class="bbttcc-bank-coalition-badge"><i class="fas fa-handshake"></i> Coalition Treasury</span>` : "");

    return `<section class="bbttcc-bank-shell">
      <p class="bbttcc-bank-note bbttcc-bank-note-gm">
        <i class="fas fa-coins"></i>
        Faction treasury holds <strong>Marks</strong> (energy) + stored <strong>gear</strong>.
        Deposits flow in from a Steward's Personal Bank; salvage refines into Marks (capped — overflow bounces).
      </p>

      <div class="bbttcc-treasury">
        <h3><i class="fas fa-coins"></i> Treasury — Marks</h3>
        <div class="bbttcc-treasury-grid">${this._treasuryHTML()}</div>
      </div>

      <div class="bbttcc-bank-toolbar">
        ${coalitionToggle}
        <span class="bbttcc-bank-spacer"></span>
        <label class="bbttcc-bank-recipient"><i class="fas fa-arrow-left"></i> Withdraw to
          <select data-role="withdraw-steward">${stewardOpts}</select>
        </label>
      </div>

      <div class="bbttcc-bank-cols">
        ${this._storedHTML("faction", "Faction Vault")}
        ${isLead ? this._storedHTML("coalition", "Coalition Vault") : ""}
      </div>
    </section>`;
  }

  async _replaceHTML(result, content) {
    let html = result, root = content;
    if (typeof content === "string") { html = content; root = result; }
    const el = (root instanceof HTMLElement) ? root : (root?.[0] ?? null);
    if (!el) return;
    el.innerHTML = html;

    const banks = game?.bbttcc?.api?.banks;
    const stewardSel = el.querySelector('[data-role="withdraw-steward"]');

    el.querySelectorAll('[data-action="withdraw"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const sid = btn.getAttribute("data-stash-id");
        const kind = btn.getAttribute("data-kind") || "faction";
        const toActorId = String(stewardSel?.value || "");
        if (!toActorId) { ui.notifications?.warn?.("Select a Steward to receive the item."); return; }
        btn.disabled = true;
        const res = await banks?.withdraw?.(this.faction, sid, { fromScope: kind, toActorId });
        if (!res?.ok) ui.notifications?.warn?.(res?.error || "Withdraw failed.");
        this.render(false);
      });
    });

    const coalBox = el.querySelector('[data-role="coalition-lead"]');
    coalBox?.addEventListener("change", async () => {
      const res = await banks?.setCoalitionLead?.(this.faction, coalBox.checked);
      if (!res?.ok) ui.notifications?.warn?.(res?.error || "Could not update coalition flag.");
      this.render(false);
    });
  }
}

// ---- Opener + per-faction singleton ----------------------------------------

const _open = new Map();

function openFactionBank(factionOrId) {
  const faction = (factionOrId instanceof Actor) ? factionOrId
    : game.actors?.get(String(factionOrId ?? "").replace(/^Actor\./, ""));
  if (!faction || !_isFaction(faction)) { ui.notifications?.warn?.("Not a faction."); return null; }
  let app = _open.get(faction.id);
  const dead = !app || app._state === 0 || (app.element && !app.element.isConnected);
  if (dead) {
    app = new FactionBankApp(faction, { id: `bbttcc-bank-faction-${faction.id}` });
    _open.set(faction.id, app);
  }
  app.render({ force: true, focus: true });
  return app;
}

// ---- Faction-sheet button (BBTTCCFactionSheet extends ActorSheet → V1) ------

function _rootEl(app, html) {
  const e = app?.element;
  if (e instanceof HTMLElement) return e;
  if (e && e[0] instanceof HTMLElement) return e[0]; // jQuery
  if (html instanceof HTMLElement) return html;
  if (html && html[0] instanceof HTMLElement) return html[0];
  return null;
}

function _injectFactionBankButton(app, html) {
  try {
    const actor = app?.actor;
    if (!actor || !_isFaction(actor)) return;
    const root = _rootEl(app, html);
    if (!root || root.querySelector("#bbttcc-faction-bank-btn")) return;

    const header = root.querySelector(".window-header");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "bbttcc-faction-bank-btn";
    btn.title = "Open Faction Bank";
    btn.addEventListener("click", (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch {}
      openFactionBank(actor);
    });
    if (header) {
      btn.className = "header-control icon bbttcc-bank-open";
      btn.innerHTML = `<i class="fas fa-landmark"></i>`;
      const title = header.querySelector(".window-title");
      if (title && title.nextSibling) header.insertBefore(btn, title.nextSibling);
      else header.appendChild(btn);
    } else {
      btn.className = "bbttcc-bank-open bbttcc-bank-open-floating";
      btn.innerHTML = `<i class="fas fa-landmark"></i><span>Bank</span>`;
      (root.querySelector(".window-content") || root).prepend(btn);
    }
  } catch (e) { warn("faction bank button inject failed", e); }
}

Hooks.on("renderBBTTCCFactionSheet", _injectFactionBankButton);
Hooks.on("renderActorSheet", _injectFactionBankButton);

// Refresh open faction banks when their treasury changes (exchange/op or vault moves).
function _refreshFactionBanks(ids) {
  const want = new Set((ids || []).filter(Boolean).map(String));
  for (const [fid, app] of _open) {
    if ((!want.size || want.has(String(fid))) && app?.rendered) app.render(false);
  }
}
Hooks.on("bbttcc:vault:changed", (d) => _refreshFactionBanks([d?.sourceId, d?.targetId]));
Hooks.on("bbttcc:economy:share", (d) => _refreshFactionBanks([d?.fromId, d?.toId]));
Hooks.on("bbttcc:economy:exchange", (d) => _refreshFactionBanks([d?.fromId, d?.toId]));

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.banks ??= {};
    game.bbttcc.api.banks.openFactionBank = openFactionBank;
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.FactionBankApp = FactionBankApp;
  } catch (e) { warn("faction-bank wiring failed", e); }
}
Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}

export { FactionBankApp, openFactionBank };
