// modules/bbttcc-banks/scripts/personal-bank-app.js
// Bad Eden — Banks & Loot: Personal Bank UI v0.1 (Phase 1)
//
// A steward's personal bank. Items only — Marks are faction-tier energy and never
// sit on a steward (see vault-core.js). Two columns: Carried (live inventory, with
// Deposit) and Stored (vault flag, with Withdraw). All moves route through
// game.bbttcc.api.banks.{deposit,withdraw} so they're atomic + rollback-safe.

const MOD_ID = "bbttcc-banks";
const TAG    = "[bbttcc-banks]";
const warn   = (...a) => console.warn(TAG, ...a);

const { ApplicationV2 } = foundry.applications.api;

// What can be banked: PHYSICAL things only.
//   - Mundane gear: weapon / armor / gear items (no manifestation data).
//   - Manifestations whose form PERSISTS as a carryable/bound object —
//     stability "bound" or "enduring" (mirrors the system's own formLean group,
//     systems/fourththing/module.js: ["bound","enduring"]).
// NOT bankable: ephemeral manifestations (sustained upkeep-forms, instant
//   "workings") and character options (ancestry/heritage/path/doctrine/feat/class…).
const PHYSICAL_GEAR_TYPES = new Set(["weapon", "armor", "gear"]);
const PHYSICAL_STABILITIES = new Set(["bound", "enduring"]);

// Returns "gear" | "manifestation" | null. Uses the system's manifestation predicate
// so mundane weapons (empty template-default manifestation block) bank as gear, while
// real (bound/enduring) manifestations bank as manifestations.
function _bankCategory(item) {
  if (!item) return null;
  const real = game?.bbttcc?.api?.banks?.isRealManifestation?.(item) ?? false;
  if (real) {
    const stab = String(item.system?.manifestation?.stability ?? "").toLowerCase();
    return PHYSICAL_STABILITIES.has(stab) ? "manifestation" : null; // ephemeral → not bankable
  }
  return PHYSICAL_GEAR_TYPES.has(item.type) ? "gear" : null;
}
function _isBankable(item) { return !!_bankCategory(item); }

// Tier for the badge: RFI flag first, then manifestation/system data.
function _itemTier(item) {
  const rfi = (() => { try { return item?.getFlag?.("fourththing", "rfi.item") || null; } catch { return null; } })();
  return rfi?.tier ?? item?.system?.manifestation?.tier ?? item?.system?.tier ?? null;
}

function _esc(s) { return foundry.utils.escapeHTML(String(s ?? "")); }

function _tierBadge(tier) {
  if (!tier) return "";
  return `<span class="bbttcc-bank-tier" data-tooltip="Tier ${_esc(tier)}">T${_esc(tier)}</span>`;
}

class PersonalBankApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-bank-personal-{id}",
    classes: ["bbttcc", "bbttcc-be", "bbttcc-theme-player", "bbttcc-bank"],
    position: { width: 640, height: "auto" },
    window: { title: "Personal Bank", icon: "fas fa-vault", resizable: true },
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  get title() { return `Personal Bank — ${this.actor?.name ?? "Steward"}`; }

  _carriedRows() {
    const items = (this.actor?.items?.contents ?? []).filter(_isBankable);
    if (!items.length) {
      return `<li class="bbttcc-bank-empty">No bankable gear carried.</li>`;
    }
    return items.map(it => {
      const rfi = it.getFlag("fourththing", "rfi.item") || {};
      const qty = Math.max(1, Math.floor(Number(it.system?.quantity ?? rfi?.charges ?? 1)) || 1);
      const sv = (() => { try { return it.getFlag("bbttcc-banks", "salvage"); } catch { return null; } })();
      const svBadge = sv?.markValue
        ? `<span class="bbttcc-bank-salvage" data-tooltip="Refines to ${_esc(sv.markValue)} ${_esc(sv.bucket || "economy")} Marks when banked at a faction"><i class="fas fa-bolt"></i>${_esc(sv.markValue)}</span>`
        : "";
      return `<li class="bbttcc-bank-row" data-item-id="${_esc(it.id)}">
        <img src="${_esc(it.img || "icons/svg/item-bag.svg")}" alt="" />
        <span class="bbttcc-bank-name">${_esc(it.name)}${_tierBadge(_itemTier(it))}${svBadge}</span>
        ${qty > 1 ? `<span class="bbttcc-bank-qty">×${qty}</span>` : ""}
        <button type="button" class="bbttcc-bank-btn" data-action="deposit" data-item-id="${_esc(it.id)}">
          <i class="fas fa-arrow-right"></i> Deposit
        </button>
      </li>`;
    }).join("");
  }

  _storedRows() {
    const stash = game?.bbttcc?.api?.banks?.listVault?.(this.actor, "personal") ?? [];
    if (!stash.length) {
      return `<li class="bbttcc-bank-empty">Vault is empty.</li>`;
    }
    return stash.map(e => {
      return `<li class="bbttcc-bank-row" data-stash-id="${_esc(e.stashId)}">
        <img src="${_esc(e.img || "icons/svg/item-bag.svg")}" alt="" />
        <span class="bbttcc-bank-name">${_esc(e.name)}${_tierBadge(e.tier)}</span>
        ${e.qty > 1 ? `<span class="bbttcc-bank-qty">×${_esc(e.qty)}</span>` : ""}
        <button type="button" class="bbttcc-bank-btn" data-action="withdraw" data-stash-id="${_esc(e.stashId)}">
          <i class="fas fa-arrow-left"></i> Withdraw
        </button>
      </li>`;
    }).join("");
  }

  _destOptions() {
    const banks = game?.bbttcc?.api?.banks;
    let opts = `<option value="personal">🎒 Personal (this Steward)</option>`;
    for (const f of (banks?.accessibleFactions?.() ?? [])) {
      opts += `<option value="faction:${_esc(f.id)}">🏴 ${_esc(f.name)} — treasury</option>`;
    }
    for (const f of (banks?.coalitionLeadFactions?.() ?? [])) {
      opts += `<option value="coalition:${_esc(f.id)}">🤝 Coalition — ${_esc(f.name)}</option>`;
    }
    return opts;
  }

  async _renderHTML() {
    return `<section class="bbttcc-bank-shell">
      <p class="bbttcc-bank-note">
        <i class="fas fa-bolt"></i>
        Personal banks hold <strong>gear</strong> only. <strong>Marks</strong> are faction-tier energy —
        deposit salvage (⚡) to a faction to refine it into Marks.
      </p>
      <div class="bbttcc-bank-dest">
        <label><i class="fas fa-right-to-bracket"></i> Deposit to</label>
        <select data-role="bank-dest">${this._destOptions()}</select>
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
    // ApplicationV2 hands us (rendered, element); normalize defensively.
    let html = result, root = content;
    if (typeof content === "string") { html = content; root = result; }
    const el = (root instanceof HTMLElement) ? root : (root?.[0] ?? null);
    if (!el) return;
    el.innerHTML = html;

    const destSel = el.querySelector('[data-role="bank-dest"]');
    el.querySelectorAll('[data-action="deposit"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-item-id");
        btn.disabled = true;
        const destVal = String(destSel?.value || "personal");
        let dest = { scope: "personal" };
        if (destVal.startsWith("faction:")) dest = { scope: "faction", actorId: destVal.slice(8) };
        else if (destVal.startsWith("coalition:")) dest = { scope: "coalition", actorId: destVal.slice(10) };
        const res = await game.bbttcc?.api?.banks?.deposit?.(this.actor, id, dest);
        if (!res?.ok) {
          ui.notifications?.warn?.(res?.error || "Deposit failed.");
        } else if (res.transmuted) {
          const parts = Object.entries(res.transmuted).map(([b, v]) => `${v} ${b}`).join(", ");
          ui.notifications?.info?.(`Refined salvage → ${parts} Marks.`);
        }
        this.render(false);
      });
    });
    el.querySelectorAll('[data-action="withdraw"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const sid = btn.getAttribute("data-stash-id");
        btn.disabled = true;
        const res = await game.bbttcc?.api?.banks?.withdraw?.(this.actor, sid, { scope: "personal" });
        if (!res?.ok) ui.notifications?.warn?.(res?.error || "Withdraw failed.");
        this.render(false);
      });
    });
  }
}

// ---- Opener + per-actor singleton ------------------------------------------

const _open = new Map(); // actorId → app instance

function openPersonalBank(actorOrId) {
  const actor = (actorOrId instanceof Actor) ? actorOrId
    : game.actors?.get(String(actorOrId ?? "").replace(/^Actor\./, ""));
  if (!actor) { ui.notifications?.warn?.("No actor for Personal Bank."); return null; }
  let app = _open.get(actor.id);
  const dead = !app || app._state === 0 || (app.element && !app.element.isConnected);
  if (dead) {
    app = new PersonalBankApp(actor, { id: `bbttcc-bank-personal-${actor.id}` });
    _open.set(actor.id, app);
  }
  app.render({ force: true, focus: true });
  return app;
}

// ---- Character-sheet button ------------------------------------------------

function _injectBankButton(app, html) {
  try {
    const actor = app?.actor;
    if (!actor || actor.type !== "character") return;
    // ApplicationV2: app.element is the full window root (header + content), and is
    // the most reliable source regardless of what the render hook passes as `html`.
    const root = (app?.element instanceof HTMLElement) ? app.element
      : (html instanceof HTMLElement ? html : (html?.[0] ?? null));
    if (!root) return;
    if (root.querySelector("#bbttcc-bank-open-btn")) return; // already present this render

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "bbttcc-bank-open-btn";
    btn.title = "Open Personal Bank";
    btn.addEventListener("click", (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch {}
      openPersonalBank(actor);
    });

    // Prefer sitting among the V2 window-header controls (the ⋮ / book / ✕ cluster),
    // matching their look. Fall back to a floating pill in content.
    const header = root.querySelector(".window-header");
    if (header) {
      btn.className = "header-control icon bbttcc-bank-open";
      btn.innerHTML = `<i class="fas fa-vault"></i>`;
      const title = header.querySelector(".window-title");
      if (title && title.nextSibling) header.insertBefore(btn, title.nextSibling);
      else header.appendChild(btn);
    } else {
      btn.className = "bbttcc-bank-open bbttcc-bank-open-floating";
      btn.innerHTML = `<i class="fas fa-vault"></i><span>Bank</span>`;
      (root.querySelector(".window-content") || root).prepend(btn);
    }
  } catch (e) { warn("bank button inject failed", e); }
}

// Steward sheet = FourthThingCharacterSheet (HandlebarsApplicationMixin(ActorSheetV2)),
// which fires render<ClassName>, NOT the legacy renderActorSheet. Hook both so the
// button appears on the V2 steward sheet and any V1 fallback.
Hooks.on("renderFourthThingCharacterSheet", _injectBankButton);
Hooks.on("renderActorSheet", _injectBankButton);

// ---- Wire into the API + expose the app class ------------------------------

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.banks ??= {};
    game.bbttcc.api.banks.openPersonalBank = openPersonalBank;
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.PersonalBankApp = PersonalBankApp;
  } catch (e) { warn("personal-bank wiring failed", e); }
}
Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}

export { PersonalBankApp, openPersonalBank };
