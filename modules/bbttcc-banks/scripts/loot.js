// modules/bbttcc-banks/scripts/loot.js
// Bad Eden — Banks & Loot: Lootable Containers v0.1 (Phase 3, GM-authored)
//
// A lootable container is just a TOKEN: a defeated enemy, a chest, or a terminal.
// Its loot state lives on the TokenDocument flag bbttcc-banks.loot:
//   { lootable, flavor, gate:{skill,dc}|null, cracked }
// Contents = the token actor's own physical gear (incl. salvage items). Taking an
// item routes through vault-core transferVault (container inventory → looter pack).
//
// GM authors containers from the Token HUD; anyone loots one from the Token HUD.
// Because players can't mutate a GM-owned container/token, take + crack-flag writes
// are relayed to the active GM over the module socket.

const MOD_ID = "bbttcc-banks";
const TAG    = "[bbttcc-banks]";
const SOCKET = "module.bbttcc-banks";
const warn   = (...a) => console.warn(TAG, ...a);

const { ApplicationV2 } = foundry.applications.api;

const LOOT_FLAVORS = {
  corpse:   { label: "Corpse",   icon: "fa-skull",       gate: null },
  chest:    { label: "Chest",    icon: "fa-box-archive", gate: { skill: "tinkering", dc: 12 } },
  terminal: { label: "Terminal", icon: "fa-terminal",    gate: { skill: "hacking",   dc: 14 } },
  cache:    { label: "Cache",    icon: "fa-box-open",    gate: null },
};
const GATE_SKILLS = [
  { key: "", label: "— none (free) —" },
  { key: "hacking", label: "Hacking" },
  { key: "tinkering", label: "Tinkering" },
  { key: "stealth", label: "Stealth" },
  { key: "streetwise", label: "Streetwise" },
  { key: "brawl", label: "Brawl (force)" },
];

function _esc(s) { return foundry.utils.escapeHTML(String(s ?? "")); }
function _lootFlag(tokenDoc) { try { return tokenDoc?.getFlag?.(MOD_ID, "loot") || {}; } catch { return {}; } }

// Lootable = real PHYSICAL gear only. Real manifestations (authored weapon-forms,
// powers) are ephemeral — they shut off when the wielder drops, so never loot.
// A mundane NPC weapon carries an empty template-default manifestation block and is
// NOT a real manifestation (system predicate), so it loots correctly.
function _isLootableItem(it) {
  if (!["weapon", "armor", "gear"].includes(it?.type)) return false;
  return !(game?.bbttcc?.api?.banks?.isRealManifestation?.(it) ?? false);
}

function _userStewards() {
  return (game.actors?.contents ?? []).filter(a => a.type === "character" && a.isOwner);
}
function _defaultRecipient() {
  const sel = canvas.tokens?.controlled?.find(t => t.actor?.type === "character" && t.actor?.isOwner);
  return sel?.actor ?? _userStewards()[0] ?? null;
}

// ---- GM-relayed mutations (take an item / set cracked) ---------------------

const _pending = new Map();

async function _execTake({ tokenUuid, itemId, recipientId }) {
  const tokenDoc = await fromUuid(tokenUuid);
  const container = tokenDoc?.actor;
  const recipient = game.actors?.get(recipientId);
  if (!container || !recipient) return { ok: false, error: "Loot source or recipient is missing." };
  return game.bbttcc.api.banks.transferVault({
    source: { kind: "inventory", actor: container },
    target: { kind: "inventory", actor: recipient },
    items: [itemId],
    context: { label: "Loot", userId: game.user?.id },
  });
}

async function _execCrack({ tokenUuid }) {
  const tokenDoc = await fromUuid(tokenUuid);
  if (!tokenDoc) return { ok: false, error: "Token missing." };
  const loot = _lootFlag(tokenDoc);
  await tokenDoc.setFlag(MOD_ID, "loot", { ...loot, cracked: true });
  return { ok: true };
}

function _relay(kind, payload) {
  // GM executes directly; players ask the active GM over the socket.
  if (game.user.isGM) return (kind === "take" ? _execTake(payload) : _execCrack(payload));
  const gm = game.users?.activeGM;
  if (!gm) return Promise.resolve({ ok: false, error: "No active GM is connected to process loot." });
  const reqId = foundry.utils.randomID();
  return new Promise((resolve) => {
    _pending.set(reqId, resolve);
    game.socket.emit(SOCKET, { t: kind, reqId, payload, fromUserId: game.user.id });
    setTimeout(() => {
      if (_pending.has(reqId)) { _pending.delete(reqId); resolve({ ok: false, error: "Loot request timed out." }); }
    }, 10000);
  });
}

function _onSocket(msg) {
  if (!msg) return;
  if (msg.t === "take" || msg.t === "crack") {
    // Only the designated active GM executes, to avoid double-application.
    if (!game.user.isGM || game.users?.activeGM?.id !== game.user.id) return;
    const exec = msg.t === "take" ? _execTake(msg.payload) : _execCrack(msg.payload);
    exec.then(result => game.socket.emit(SOCKET, { t: "res", reqId: msg.reqId, result, toUserId: msg.fromUserId }));
  } else if (msg.t === "res") {
    if (msg.toUserId !== game.user.id) return;
    const resolve = _pending.get(msg.reqId);
    if (resolve) { _pending.delete(msg.reqId); resolve(msg.result); }
  }
}

// ---- Loot app --------------------------------------------------------------

class LootApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-loot-{id}",
    classes: ["bbttcc", "bbttcc-be", "bbttcc-theme-player", "bbttcc-bank", "bbttcc-loot"],
    position: { width: 560, height: "auto" },
    window: { title: "Loot", icon: "fas fa-hand-sparkles", resizable: true },
  };

  constructor(tokenDoc, options = {}) {
    super(options);
    this.token = tokenDoc;
    this.recipientId = _defaultRecipient()?.id ?? "";
  }

  get container() { return this.token?.actor; }
  get title() {
    const fl = _lootFlag(this.token);
    const flavor = LOOT_FLAVORS[fl.flavor]?.label ?? "Loot";
    return `${flavor} — ${this.container?.name ?? this.token?.name ?? "Container"}`;
  }

  _items() { return (this.container?.items?.contents ?? []).filter(_isLootableItem); }

  async _renderHTML() {
    const fl = _lootFlag(this.token);
    const gate = fl.gate || null;
    const locked = gate && !fl.cracked && !game.user.isGM;

    if (locked) {
      const sk = GATE_SKILLS.find(s => s.key === gate.skill)?.label ?? gate.skill;
      return `<section class="bbttcc-bank-shell">
        <div class="bbttcc-loot-locked">
          <i class="fas fa-lock"></i>
          <p>This ${_esc(LOOT_FLAVORS[fl.flavor]?.label ?? "container")} is secured.
          Attempt <strong>${_esc(sk)}</strong> (DC ${_esc(gate.dc)}) to open it.</p>
          <button type="button" class="bbttcc-bank-btn" data-action="crack">
            <i class="fas fa-key"></i> Attempt ${_esc(sk)}
          </button>
        </div>
      </section>`;
    }

    const stewards = _userStewards();
    const recipientOpts = stewards.map(s =>
      `<option value="${_esc(s.id)}" ${s.id === this.recipientId ? "selected" : ""}>${_esc(s.name)}</option>`).join("")
      || `<option value="">— no owned Steward —</option>`;

    const items = this._items();
    const rows = items.length
      ? items.map(it => {
          const sv = (() => { try { return it.getFlag(MOD_ID, "salvage"); } catch { return null; } })();
          const svBadge = sv?.markValue
            ? `<span class="bbttcc-bank-salvage" data-tooltip="Refines to ${_esc(sv.markValue)} ${_esc(sv.bucket || "economy")} Marks at a faction"><i class="fas fa-bolt"></i>${_esc(sv.markValue)}</span>`
            : "";
          const qty = Math.max(1, Math.floor(Number(it.system?.quantity ?? 1)) || 1);
          return `<li class="bbttcc-bank-row" data-item-id="${_esc(it.id)}">
            <img src="${_esc(it.img || "icons/svg/item-bag.svg")}" alt="" />
            <span class="bbttcc-bank-name">${_esc(it.name)}${svBadge}</span>
            ${qty > 1 ? `<span class="bbttcc-bank-qty">×${qty}</span>` : ""}
            <button type="button" class="bbttcc-bank-btn" data-action="take" data-item-id="${_esc(it.id)}">
              <i class="fas fa-hand-holding"></i> Take
            </button>
          </li>`;
        }).join("")
      : `<li class="bbttcc-bank-empty">Picked clean.</li>`;

    return `<section class="bbttcc-bank-shell">
      <p class="bbttcc-bank-note">
        <i class="fas fa-hand-sparkles"></i>
        Take items into a Steward's pack. Salvage (⚡) refines into Marks when later banked at a faction.
      </p>
      <div class="bbttcc-bank-toolbar">
        <label class="bbttcc-bank-recipient"><i class="fas fa-hand-holding"></i> Take to
          <select data-role="loot-recipient">${recipientOpts}</select>
        </label>
        <span class="bbttcc-bank-spacer"></span>
        ${items.length ? `<button type="button" class="bbttcc-bank-btn" data-action="take-all"><i class="fas fa-box-open"></i> Take All</button>` : ""}
      </div>
      <ul class="bbttcc-bank-list" data-side="loot">${rows}</ul>
    </section>`;
  }

  async _replaceHTML(result, content) {
    let html = result, root = content;
    if (typeof content === "string") { html = content; root = result; }
    const el = (root instanceof HTMLElement) ? root : (root?.[0] ?? null);
    if (!el) return;
    el.innerHTML = html;

    const recSel = el.querySelector('[data-role="loot-recipient"]');
    recSel?.addEventListener("change", () => { this.recipientId = String(recSel.value || ""); });

    el.querySelector('[data-action="crack"]')?.addEventListener("click", async (ev) => {
      const btn = ev.currentTarget; btn.disabled = true;
      await this._attemptCrack();
      this.render(false);
    });

    el.querySelectorAll('[data-action="take"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await this._take(btn.getAttribute("data-item-id"));
        this.render(false);
      });
    });

    el.querySelector('[data-action="take-all"]')?.addEventListener("click", async (ev) => {
      ev.currentTarget.disabled = true;
      for (const it of this._items()) await this._take(it.id);
      this.render(false);
    });
  }

  async _attemptCrack() {
    const fl = _lootFlag(this.token);
    const gate = fl.gate;
    if (!gate) return;
    const actor = game.actors?.get(this.recipientId) || _defaultRecipient();
    if (!actor) { ui.notifications?.warn?.("No Steward to make the attempt."); return; }
    const roll = await game.fourththing?.rolls?.skillCheck?.(actor, { skill: gate.skill });
    const total = Number(roll?.total ?? 0);
    if (total >= Number(gate.dc)) {
      const res = await _relay("crack", { tokenUuid: this.token.uuid });
      if (res?.ok) ui.notifications?.info?.(`Opened! (${total} vs DC ${gate.dc})`);
      else ui.notifications?.warn?.(res?.error || "Could not open the container.");
    } else {
      ui.notifications?.warn?.(`Failed to open — ${total} vs DC ${gate.dc}.`);
    }
  }

  async _take(itemId) {
    const recipientId = this.recipientId || _defaultRecipient()?.id;
    if (!recipientId) { ui.notifications?.warn?.("Pick a Steward to receive the loot."); return; }
    const res = await _relay("take", { tokenUuid: this.token.uuid, itemId, recipientId });
    if (!res?.ok) ui.notifications?.warn?.(res?.error || "Could not take the item.");
  }
}

const _openLootApps = new Map();
function openLoot(tokenOrDoc) {
  const tokenDoc = tokenOrDoc?.document ?? tokenOrDoc; // accept Token placeable or TokenDocument
  if (!tokenDoc?.uuid) { ui.notifications?.warn?.("No token to loot."); return null; }
  if (!_lootFlag(tokenDoc).lootable) { ui.notifications?.warn?.("That isn't a lootable container."); return null; }
  let app = _openLootApps.get(tokenDoc.uuid);
  const dead = !app || app._state === 0 || (app.element && !app.element.isConnected);
  if (dead) {
    app = new LootApp(tokenDoc, { id: `bbttcc-loot-${tokenDoc.id}` });
    _openLootApps.set(tokenDoc.uuid, app);
  }
  app.render({ force: true, focus: true });
  return app;
}

// ---- GM authoring dialog ---------------------------------------------------

function openLootConfig(tokenDoc) {
  if (!game.user.isGM) return;
  const cur = _lootFlag(tokenDoc);
  const flavor = cur.flavor || "corpse";
  const gate = cur.gate || LOOT_FLAVORS[flavor]?.gate || null;

  const flavorOpts = Object.entries(LOOT_FLAVORS)
    .map(([k, v]) => `<option value="${k}" ${k === flavor ? "selected" : ""}>${v.label}</option>`).join("");
  const skillOpts = GATE_SKILLS
    .map(s => `<option value="${s.key}" ${s.key === (gate?.skill || "") ? "selected" : ""}>${s.label}</option>`).join("");

  const content = `
    <div style="display:flex;flex-direction:column;gap:.5rem;">
      <p style="margin:0;opacity:.85;">Mark <b>${_esc(tokenDoc.name || tokenDoc.actor?.name || "this token")}</b> as a lootable container.
      Its physical gear (incl. salvage) becomes lootable.</p>
      <label><input type="checkbox" name="lootable" ${cur.lootable ? "checked" : ""}/> Lootable</label>
      <label>Flavor <select name="flavor">${flavorOpts}</select></label>
      <label>Gate skill <select name="skill">${skillOpts}</select></label>
      <label>Gate DC <input type="number" name="dc" value="${Number(gate?.dc || 12)}" min="1" step="1"/></label>
      <p style="margin:0;font-size:.78rem;opacity:.7;">Tip: stamp Marks-bearing salvage onto the container with the make-salvage macro (select its token first).</p>
    </div>`;

  new Dialog({
    title: "Configure Loot",
    content,
    buttons: {
      clear: {
        label: "Not Lootable",
        callback: async () => { await tokenDoc.unsetFlag(MOD_ID, "loot"); ui.notifications?.info?.("Loot cleared."); canvas.tokens?.hud?.render(); },
      },
      save: {
        label: "Save",
        callback: async (html) => {
          const lootable = html.find('[name="lootable"]').is(":checked");
          const fl = String(html.find('[name="flavor"]').val() || "corpse");
          const skill = String(html.find('[name="skill"]').val() || "");
          const dc = Math.max(1, Math.floor(Number(html.find('[name="dc"]').val()) || 12));
          const next = { ...cur, lootable, flavor: fl, gate: skill ? { skill, dc } : null };
          if (!skill) next.cracked = false;
          await tokenDoc.setFlag(MOD_ID, "loot", next);
          ui.notifications?.info?.(lootable ? `Lootable ${LOOT_FLAVORS[fl]?.label || fl} set.` : "Loot updated.");
          canvas.tokens?.hud?.render();
        },
      },
    },
    default: "save",
  }).render(true);
}

// ---- Token HUD buttons -----------------------------------------------------

Hooks.on("renderTokenHUD", (hud, html /*, data */) => {
  try {
    const tokenDoc = hud?.object?.document;
    if (!tokenDoc) return;
    const $html = (html instanceof jQuery) ? html : $(html);
    const col = $html.find(".col.right").first();
    if (!col.length) return;
    const loot = _lootFlag(tokenDoc);

    if (game.user.isGM) {
      const cfg = $(`<button type="button" class="control-icon bbttcc-loot-hud" data-tooltip="Configure Loot"><i class="fas fa-coins"></i></button>`);
      cfg.on("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); openLootConfig(tokenDoc); });
      col.append(cfg);
    }
    if (loot.lootable) {
      const lt = $(`<button type="button" class="control-icon bbttcc-loot-hud bbttcc-loot-hud-active" data-tooltip="Loot"><i class="fas fa-hand-sparkles"></i></button>`);
      lt.on("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); openLoot(tokenDoc); });
      col.append(lt);
    }
  } catch (e) { warn("token HUD loot buttons failed", e); }
});

// Re-render an open loot app when its container's contents change.
Hooks.on("bbttcc:vault:changed", (d) => {
  for (const [uuid, app] of _openLootApps) {
    if (app?.rendered) app.render(false);
  }
});

// ---- Phase 4: auto-loot on defeat ------------------------------------------
// A monster (type "npc") that drops to 0 integrity OR 0 stress becomes a lootable
// corpse (free, no gate) — its ephemeral manifestations have "shut off"; only its
// physical gear remains. Healing it back above 0 clears the auto-loot. GM-authored
// loot (chests/terminals) is never auto-cleared. Runs on the active GM only.

function _amActiveGM() {
  return !!(game.user?.isGM && game.users?.activeGM?.id === game.user.id);
}

// Downed = a health pool that exists (max > 0) has hit 0. Stress here is the
// derived health pool (system.derived.stress), NOT the manifestation cast pool.
function _isDownedNPC(actor) {
  if (!actor || actor.type !== "npc") return false;
  const d = actor.system?.derived || {};
  const iv = Number(d.integrity?.value), im = Number(d.integrity?.max);
  const sv = Number(d.stress?.value), sm = Number(d.stress?.max);
  const downByIntegrity = Number.isFinite(im) && im > 0 && Number.isFinite(iv) && iv <= 0;
  const downByStress    = Number.isFinite(sm) && sm > 0 && Number.isFinite(sv) && sv <= 0;
  return downByIntegrity || downByStress;
}

async function _reconcileLootForActor(actor) {
  if (!actor || actor.type !== "npc") return;
  const downed = _isDownedNPC(actor);
  for (const tok of (actor.getActiveTokens?.() ?? [])) {
    const tdoc = tok?.document ?? tok;
    if (!tdoc?.setFlag) continue;
    const loot = tdoc.getFlag(MOD_ID, "loot") || {};
    if (downed) {
      if (!loot.lootable) {
        await tdoc.setFlag(MOD_ID, "loot", { lootable: true, flavor: "corpse", gate: null, cracked: false, auto: true });
      }
    } else if (loot.auto) {
      // Revived above 0 → drop only the auto-applied corpse loot.
      await tdoc.unsetFlag(MOD_ID, "loot");
      const app = _openLootApps.get(tdoc.uuid);
      if (app?.rendered) app.close();
    }
  }
  try { if (canvas.tokens?.hud?.rendered) canvas.tokens.hud.render(); } catch (_e) {}
}

Hooks.on("updateActor", (actor, changes) => {
  if (!_amActiveGM() || actor?.type !== "npc") return;
  // Only react when a health pool actually changed.
  if (!foundry.utils.hasProperty(changes, "system.derived.integrity")
    && !foundry.utils.hasProperty(changes, "system.derived.stress")) return;
  _reconcileLootForActor(actor);
});

// Catch direct token-actor-data writes on unlinked tokens (some damage paths).
Hooks.on("updateToken", (tokenDoc, changes) => {
  if (!_amActiveGM()) return;
  if (!foundry.utils.hasProperty(changes, "actorData") && !foundry.utils.hasProperty(changes, "delta")) return;
  if (tokenDoc?.actor?.type === "npc") _reconcileLootForActor(tokenDoc.actor);
});

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.api ??= {};
    game.bbttcc.api.banks ??= {};
    game.bbttcc.api.banks.openLoot = openLoot;
    game.bbttcc.api.banks.openLootConfig = openLootConfig;
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.LootApp = LootApp;
  } catch (e) { warn("loot wiring failed", e); }
}
Hooks.once("ready", () => { _attach(); try { game.socket.on(SOCKET, _onSocket); } catch (e) { warn("socket bind failed", e); } });
try { if (game?.ready) _attach(); } catch (_e) {}

export { LootApp, openLoot, openLootConfig };
