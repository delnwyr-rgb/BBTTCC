// modules/bbttcc-banks/scripts/treasury-app.js
// Bad Eden — THE TREASURY (ruling 16, 2026-10-17: the steward and the Domain are one being,
// so there is ONE treasury). Replaces the Personal Bank + Faction Bank pair wherever the
// Alpha Cut world setting is on; the two legacy apps still exist for Beta worlds.
//
//   Marks        — the Domain's opBank against its caps (read-only here; Marks move through
//                  the OP engine, the Market and the Exchange).
//   Carried      — the steward's bankable gear, with STORE (salvage refines into Marks on the way in).
//   Stored       — the Domain's vault, plus anything still sitting in the steward's old personal
//                  vault, plus the Coalition vault when this Domain hosts one. TAKE puts it back
//                  in the steward's hands.
//
// Opened from the steward sheet (header vault button, Domain tab "Vault" door), the faction
// sheet (header button, GM) and game.bbttcc.api.banks.openTreasury(stewardOrDomain).
// Imported from personal-bank-app.js so no module.json edit is needed.

const MOD_ID = "bbttcc-banks";
const TAG    = "[bbttcc-banks/treasury]";
const warn   = (...a) => console.warn(TAG, ...a);

const { ApplicationV2 } = foundry.applications.api;

const BUCKET_LABELS = {
  violence: "Violence", nonlethal: "Non-Lethal", intrigue: "Intrigue", economy: "Economy",
  softpower: "Soft Power", diplomacy: "Diplomacy", logistics: "Logistics", culture: "Culture", faith: "Faith",
};
const PHYSICAL_GEAR_TYPES = new Set(["weapon", "armor", "gear"]);
const PHYSICAL_STABILITIES = new Set(["bound", "enduring"]);

const _banks = () => game?.bbttcc?.api?.banks ?? {};
const _esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const _op = (n) => { const f = game?.bbttcc?.api?.op?.fmtNum; return f ? f(n) : String(Math.round(Number(n) || 0)); };
const _coalitionHidden = () => game.bbttcc?.alpha?.hidden?.("coalitionBank") === true;

/** True when the whole world runs the Alpha Cut — the one-treasury fiction applies to every seat. */
export function alphaOneTreasury() {
  try { return game.bbttcc?.alpha?.enabled?.() === true; } catch (_e) { return false; }
}

function _bankCategory(item) {
  if (!item) return null;
  const real = _banks().isRealManifestation?.(item) ?? false;
  if (real) {
    const stab = String(item.system?.manifestation?.stability ?? "").toLowerCase();
    return PHYSICAL_STABILITIES.has(stab) ? "manifestation" : null;
  }
  return PHYSICAL_GEAR_TYPES.has(item.type) ? "gear" : null;
}
function _itemTier(item) {
  const rfi = (() => { try { return item?.flags?.fourththing?.rfi?.item || null; } catch { return null; } })();
  return rfi?.tier ?? item?.system?.manifestation?.tier ?? item?.system?.tier ?? null;
}
const _tierBadge = (t) => t ? `<span class="bbttcc-bank-tier" data-tooltip="Tier ${_esc(t)}">T${_esc(t)}</span>` : "";

function _resolve(aOrId) {
  if (!aOrId) return null;
  if (aOrId instanceof Actor) return aOrId;
  return game.actors?.get(String(aOrId).replace(/^Actor\./, "")) ?? null;
}

/** Which stewards may stand at this treasury: the user's own on a player seat, all of them for the GM. */
function _stewardChoices(domain) {
  const all = domain ? (_banks().stewardsOf?.(domain) ?? []) : [];
  const mine = game.user?.character?.id;
  const owned = all.filter(a => a.isOwner).sort((a, b) => (a.id === mine ? -1 : 0) - (b.id === mine ? -1 : 0));   // the user's own character first
  return game.user?.isGM ? (owned.length ? [...owned, ...all.filter(a => !a.isOwner)] : all) : owned;
}

class TreasuryApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-treasury-{id}",
    classes: ["bbttcc", "bbttcc-be", "bbttcc-theme-player", "bbttcc-bank", "bbttcc-treasury-app"],
    position: { width: 700, height: "auto" },
    window: { title: "Treasury", icon: "fas fa-vault", resizable: true },
  };

  constructor({ steward = null, domain = null } = {}, options = {}) {
    super(options);
    this.steward = steward;
    this.domain = domain;
  }

  get title() { return `Treasury — ${this.domain?.name ?? this.steward?.name ?? "Domain"}`; }

  /** Re-resolve the pair before every render so a late link or a swapped steward shows up. */
  _sync() {
    if (this.steward && !this.domain) this.domain = _banks().domainOf?.(this.steward) ?? null;
    if (this.domain && this.steward && !(_banks().stewardsOf?.(this.domain) ?? []).some(a => a.id === this.steward.id)) {
      // the steward left this Domain — follow the Domain, pick a steward that is still linked
      this.steward = null;
    }
    if (this.domain && !this.steward) this.steward = _stewardChoices(this.domain)[0] ?? null;
  }

  _marksHTML() {
    if (!this.domain) return `<span class="bbttcc-bank-empty">No Domain is linked to this steward yet — Marks live in a Domain's treasury.</span>`;
    const t = _banks().factionTreasury?.(this.domain) ?? { marks: {}, caps: {} };
    const buckets = _banks().OP_BUCKETS ?? Object.keys(BUCKET_LABELS);
    let total = 0, capTotal = 0;
    const chips = buckets.map(b => {
      const m = Number(t.marks?.[b] || 0), cap = Number(t.caps?.[b] || 0);
      total += m; capTotal += cap;
      if (m <= 0 && cap <= 0) return "";
      const full = cap > 0 && m >= cap;
      return `<span class="bbttcc-treasury-chip${full ? " is-full" : ""}" data-tooltip="${_esc(BUCKET_LABELS[b] || b)} — ${m} / ${cap || "∞"} marks">
        <span class="lbl">${_esc(BUCKET_LABELS[b] || b)}</span>
        <span class="val">${_op(m)}${cap > 0 ? ` / ${_op(cap)}` : ""}</span>
      </span>`;
    }).filter(Boolean).join("");
    const totalLine = `<span class="bbttcc-treasury-total" data-tooltip="Every pool together, against the Domain's caps"><span class="lbl">All pools</span><span class="val">${_op(total)}${capTotal > 0 ? ` / ${_op(capTotal)}` : ""}</span></span>`;
    return totalLine + (chips || `<span class="bbttcc-bank-empty">The treasury is empty.</span>`);
  }

  _carriedRows() {
    const s = this.steward;
    if (!s) return `<li class="bbttcc-bank-empty">No steward stands at this treasury.</li>`;
    const items = (s.items?.contents ?? []).filter(it => !!_bankCategory(it));
    if (!items.length) return `<li class="bbttcc-bank-empty">Nothing bankable carried.</li>`;
    const canStore = s.isOwner || game.user?.isGM;
    return items.map(it => {
      const rfi = it.flags?.fourththing?.rfi?.item || {};
      const qty = Math.max(1, Math.floor(Number(it.system?.quantity ?? rfi?.charges ?? 1)) || 1);
      const sv = (() => { try { return it.getFlag(MOD_ID, "salvage"); } catch { return null; } })();
      const svBadge = sv?.markValue
        ? `<span class="bbttcc-bank-salvage" data-tooltip="Refines to ${_esc(sv.markValue)} ${_esc(sv.bucket || "economy")} Marks when stored${this.domain ? "" : " in a Domain's treasury"}"><i class="fas fa-bolt"></i>${_esc(sv.markValue)}</span>`
        : "";
      return `<li class="bbttcc-bank-row" data-item-id="${_esc(it.id)}">
        <img src="${_esc(it.img || "icons/svg/item-bag.svg")}" alt="" />
        <span class="bbttcc-bank-name">${_esc(it.name)}${_tierBadge(_itemTier(it))}${svBadge}</span>
        ${qty > 1 ? `<span class="bbttcc-bank-qty">×${qty}</span>` : ""}
        <button type="button" class="bbttcc-bank-btn" data-action="store" data-item-id="${_esc(it.id)}" ${canStore ? "" : "disabled"}>
          <i class="fas fa-arrow-right"></i> Store
        </button>
      </li>`;
    }).join("");
  }

  _storedRows() {
    const rows = [];
    const push = (entries, holder, kind, badge) => {
      for (const e of entries) {
        rows.push(`<li class="bbttcc-bank-row" data-stash-id="${_esc(e.stashId)}" data-kind="${_esc(kind)}" data-holder="${_esc(holder.id)}">
          <img src="${_esc(e.img || "icons/svg/item-bag.svg")}" alt="" />
          <span class="bbttcc-bank-name">${_esc(e.name)}${_tierBadge(e.tier)}${badge ? `<span class="bbttcc-bank-src" data-tooltip="${_esc(badge.tip)}">${_esc(badge.text)}</span>` : ""}</span>
          ${e.qty > 1 ? `<span class="bbttcc-bank-qty">×${_esc(e.qty)}</span>` : ""}
          <button type="button" class="bbttcc-bank-btn" data-action="take" data-stash-id="${_esc(e.stashId)}" data-kind="${_esc(kind)}" data-holder="${_esc(holder.id)}" ${this._canTake(kind) ? "" : "disabled"} data-tooltip="${_esc(this._takeTip(kind))}">
            <i class="fas fa-arrow-left"></i> Take
          </button>
        </li>`);
      }
    };
    if (this.domain) push(_banks().listVault?.(this.domain, "faction") ?? [], this.domain, "faction", null);
    if (this.steward) push(_banks().listVault?.(this.steward, "personal") ?? [], this.steward, "personal",
      this.domain ? { text: "pocket", tip: "Stored before the treasury was one — it is yours to take; anything you store from now on goes into the Domain's vault." } : null);
    if (this.domain && !_coalitionHidden() && this.domain.getFlag?.(MOD_ID, "coalitionLead") === true) {
      push(_banks().listVault?.(this.domain, "coalition") ?? [], this.domain, "coalition", { text: "coalition", tip: "Held for the Coalition this Domain hosts." });
    }
    return rows.join("") || `<li class="bbttcc-bank-empty">Nothing stored yet.</li>`;
  }

  _canTake(kind) {
    if (!this.steward) return false;
    if (kind === "personal") return this.steward.isOwner || game.user?.isGM;
    return !!_banks().canManage?.(this.domain);
  }
  _takeTip(kind) {
    if (!this.steward) return "No steward to receive it.";
    if (!this._canTake(kind)) return "Only this Domain's stewards or a GM may take from its vault.";
    return `Put it back in ${this.steward.name}'s hands.`;
  }

  _storeDestHTML() {
    // Only a coalition-hosting Domain offers a choice; everyone else stores into the one vault.
    if (!this.domain || _coalitionHidden() || this.domain.getFlag?.(MOD_ID, "coalitionLead") !== true) return "";
    return `<label class="bbttcc-bank-recipient"><i class="fas fa-right-to-bracket"></i> Store to
      <select data-role="bank-dest">
        <option value="faction">${_esc(this.domain.name)}</option>
        <option value="coalition">Coalition — ${_esc(this.domain.name)}</option>
      </select></label>`;
  }

  _stewardPickHTML() {
    const choices = this._choices = _stewardChoices(this.domain);
    if (choices.length <= 1) return "";
    const opts = choices.map(s => `<option value="${_esc(s.id)}" ${this.steward?.id === s.id ? "selected" : ""}>${_esc(s.name)}</option>`).join("");
    return `<label class="bbttcc-bank-recipient"><i class="fas fa-user-shield"></i> Steward
      <select data-role="treasury-steward">${opts}</select></label>`;
  }

  _coalitionToggleHTML() {
    if (!this.domain || _coalitionHidden()) return "";
    const isLead = this.domain.getFlag?.(MOD_ID, "coalitionLead") === true;
    if (game.user?.isGM) {
      return `<label class="bbttcc-bank-coalition" data-tooltip="Several Domains together are a Coalition. The host's vault takes deposits from mutually-Allied Domains.">
        <input type="checkbox" data-role="coalition-lead" ${isLead ? "checked" : ""}/>
        <span>Host a Coalition vault</span></label>`;
    }
    return isLead ? `<span class="bbttcc-bank-coalition-badge"><i class="fas fa-handshake"></i> Coalition host</span>` : "";
  }

  async _renderHTML() {
    this._sync();
    const d = this.domain, s = this.steward;
    const tierFn = game.bbttcc?.facts?.faction?.tier;
    const tier = (d && typeof tierFn === "function") ? (() => { try { return tierFn(d); } catch { return null; } })() : null;
    const head = d
      ? `<div class="bbttcc-treasury-head"><span class="who"><i class="fas fa-mountain-sun"></i> ${_esc(d.name)}${tier ? ` <small>Tier ${_esc(tier)}</small>` : ""}</span>${s ? `<span class="as">steward ${_esc(s.name)}</span>` : `<span class="as">no steward linked</span>`}</div>`
      : `<div class="bbttcc-treasury-head"><span class="who"><i class="fas fa-user-shield"></i> ${_esc(s?.name ?? "Steward")}</span><span class="as">no Domain yet</span></div>`;
    return `<section class="bbttcc-bank-shell">
      ${head}
      <p class="bbttcc-bank-note">
        <i class="fas fa-coins"></i>
        One treasury. <strong>Marks</strong> are the land's; what you <strong>store</strong> goes into the same vault, and salvage (⚡) refines into Marks on the way in.
      </p>
      <div class="bbttcc-treasury">
        <h3><i class="fas fa-coins"></i> Treasury</h3>
        <div class="bbttcc-treasury-grid">${this._marksHTML()}</div>
      </div>
      <div class="bbttcc-bank-toolbar">
        ${this._coalitionToggleHTML()}
        <span class="bbttcc-bank-spacer"></span>
        ${this._stewardPickHTML()}
        ${this._storeDestHTML()}
      </div>
      <div class="bbttcc-bank-cols">
        <div class="bbttcc-bank-col">
          <h3><i class="fas fa-person-rays"></i> Carried</h3>
          <ul class="bbttcc-bank-list" data-side="carried">${this._carriedRows()}</ul>
        </div>
        <div class="bbttcc-bank-col">
          <h3><i class="fas fa-vault"></i> Stored</h3>
          <ul class="bbttcc-bank-list" data-side="stored">${this._storedRows()}</ul>
        </div>
      </div>
    </section>`;
  }

  async _replaceHTML(result, content) {
    let html = result, root = content;
    if (typeof content === "string") { html = content; root = result; }
    const el = (root instanceof HTMLElement) ? root : (root?.[0] ?? null);
    if (!el) return;
    el.innerHTML = html;
    const banks = _banks();
    const destSel = el.querySelector('[data-role="bank-dest"]');

    el.querySelectorAll('[data-action="store"]').forEach(btn => btn.addEventListener("click", async () => {
      if (!this.steward) return;
      btn.disabled = true;
      let dest = { scope: "personal" };
      if (this.domain) dest = { scope: (destSel?.value === "coalition") ? "coalition" : "faction", actorId: this.domain.id };
      const res = await banks.deposit?.(this.steward, btn.getAttribute("data-item-id"), dest);
      if (!res?.ok) ui.notifications?.warn?.(res?.error || "Could not store that.");
      else if (res.transmuted) {
        const parts = Object.entries(res.transmuted).map(([b, v]) => `${v} ${BUCKET_LABELS[b] || b}`).join(", ");
        ui.notifications?.info?.(`Salvage refined → ${parts} Marks.`);
      }
      this.render(false);
    }));

    el.querySelectorAll('[data-action="take"]').forEach(btn => btn.addEventListener("click", async () => {
      if (!this.steward) return;
      btn.disabled = true;
      const kind = btn.getAttribute("data-kind") || "faction";
      const holder = _resolve(btn.getAttribute("data-holder"));
      const sid = btn.getAttribute("data-stash-id");
      const res = (kind === "personal")
        ? await banks.withdraw?.(holder ?? this.steward, sid, { scope: "personal", toActorId: this.steward.id })
        : await banks.withdraw?.(holder ?? this.domain, sid, { fromScope: kind, toActorId: this.steward.id });
      if (!res?.ok) ui.notifications?.warn?.(res?.error || "Could not take that.");
      this.render(false);
    }));

    el.querySelector('[data-role="treasury-steward"]')?.addEventListener("change", (ev) => {
      const pick = (this._choices || []).find(a => a.id === ev.currentTarget.value);
      if (pick) { this.steward = pick; this.render(false); }
    });

    el.querySelector('[data-role="coalition-lead"]')?.addEventListener("change", async (ev) => {
      const res = await banks.setCoalitionLead?.(this.domain, ev.currentTarget.checked);
      if (!res?.ok) ui.notifications?.warn?.(res?.error || "Could not update the Coalition flag.");
      this.render(false);
    });
  }
}

// ---- Opener + singleton per Domain (or per unlinked steward) -------------------------

const _open = new Map();

/**
 * openTreasury(stewardOrDomain) — pass a character (the steward) or a faction actor (the Domain),
 * or either one's id. One window per Domain, whichever door it was opened from.
 */
function openTreasury(actorOrId, { steward: stewardHint = null } = {}) {
  const a = _resolve(actorOrId);
  if (!a) { ui.notifications?.warn?.("No actor for the Treasury."); return null; }
  const banks = _banks();
  let steward = null, domain = null;
  if (banks.isFactionActor?.(a)) { domain = a; steward = _resolve(stewardHint) ?? _stewardChoices(a)[0] ?? null; }
  else { steward = a; domain = banks.domainOf?.(a) ?? null; }
  const key = domain ? `d:${domain.id}` : `s:${steward.id}`;
  let app = _open.get(key);
  const dead = !app || app._state === 0 || (app.element && !app.element.isConnected);
  if (dead) {
    app = new TreasuryApp({ steward, domain }, { id: `bbttcc-treasury-${domain?.id ?? steward.id}` });
    _open.set(key, app);
  } else if (steward && stewardHint) app.steward = steward;
  app.render({ force: true, focus: true });
  return app;
}

// ---- Keep open treasuries honest ------------------------------------------------------

let _pending = null;
function _refresh(pred = () => true) {
  if (_pending) return;
  _pending = setTimeout(() => {
    _pending = null;
    for (const app of _open.values()) { try { if (app?.rendered && pred(app)) app.render(false); } catch (_e) {} }
  }, 60);
}
const _touches = (app, id) => id && (app.domain?.id === id || app.steward?.id === id);
Hooks.on("bbttcc:vault:changed", () => _refresh());
Hooks.on("bbttcc:economy:share", () => _refresh());
Hooks.on("bbttcc:economy:exchange", () => _refresh());
Hooks.on("updateActor", (actor) => _refresh(app => _touches(app, actor?.id)));
for (const h of ["createItem", "updateItem", "deleteItem"]) Hooks.on(h, (item) => _refresh(app => _touches(app, item?.parent?.id)));

// ---- Wire into the API ------------------------------------------------------------------

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.banks ??= {};
    game.bbttcc.api.banks.openTreasury = openTreasury;
    game.bbttcc.api.banks.alphaOneTreasury = alphaOneTreasury;
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.TreasuryApp = TreasuryApp;
  } catch (e) { warn("treasury wiring failed", e); }
}
Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}

export { TreasuryApp, openTreasury };
