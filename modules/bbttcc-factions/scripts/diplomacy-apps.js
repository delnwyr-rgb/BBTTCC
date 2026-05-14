// modules/bbttcc-factions/scripts/diplomacy-apps.js
// BBTTCC — Diplomacy UI v0.1
//   - BBTTCC_AlliedSendApp  — unilateral grant to a mutual-Allied counterparty
//   - BBTTCC_TradeApp       — bilateral exchange with tier-scaled friction
//   - GM-arbitration chat card listener — player Submit → whispered card → GM Accept/Decline
//
// Both apps consume game.bbttcc.api.factions.exchange.{share, trade} from exchange-engine.js.

const MOD_ID = "bbttcc-factions";
const TAG    = "[bbttcc-diplomacy]";

const OP_KEYS = [
  "violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"
];
const OP_LABELS = {
  violence:"Violence", nonlethal:"Non-Lethal", intrigue:"Intrigue",
  economy:"Economy", softpower:"Soft Power", diplomacy:"Diplomacy",
  logistics:"Logistics", culture:"Culture", faith:"Faith"
};

function _esc(s){ return foundry.utils.escapeHTML(String(s ?? "")); }
function _isFaction(a){ try { return a?.getFlag?.(MOD_ID, "isFaction") === true; } catch { return false; } }
function _bank(a){ return a?.getFlag?.(MOD_ID, "opBank") ?? {}; }
function _bu(a){ return Math.max(0, Math.floor(Number(a?.getFlag?.(MOD_ID, "buildUnits") ?? 0) || 0)); }
function _marksToOp(m){ const op = (Number(m)||0)/10; return Number.isInteger(op) ? String(op) : op.toFixed(1); }
function _stockpile(a){
  try { return game?.bbttcc?.api?.factions?.stockpile?.list?.(a) || []; }
  catch { return []; }
}

function _readOpInput(root, prefix, bucket){
  const el = root.querySelector(`[name="${prefix}.marks.${bucket}"]`);
  // Inputs are in OP units (fractional OK); convert to MARKS at boundary.
  return Math.max(0, Math.round((Number(el?.value || 0) || 0) * 10));
}
function _readBUInput(root, prefix){
  const el = root.querySelector(`[name="${prefix}.bu"]`);
  return Math.max(0, Math.floor(Number(el?.value || 0) || 0));
}
function _collectMaterials(root, prefix){
  const out = {};
  const inputs = root.querySelectorAll(`[name^="${prefix}.mat."]`);
  for (const el of inputs) {
    const key = String(el.name).slice((`${prefix}.mat.`).length);
    const n = Math.max(0, Math.floor(Number(el.value || 0) || 0));
    if (key && n > 0) out[key] = n;
  }
  return out;
}
function _collectResource(root, prefix){
  const marks = {};
  for (const k of OP_KEYS) {
    const m = _readOpInput(root, prefix, k);
    if (m > 0) marks[k] = m;
  }
  return { marks, buildUnits: _readBUInput(root, prefix), materials: _collectMaterials(root, prefix) };
}

function _columnHTML(prefix, label, actor){
  const bank = _bank(actor);
  const bu = _bu(actor);
  const stock = _stockpile(actor);

  const rows = OP_KEYS.map(k => `
    <div style="display:grid; grid-template-columns: 5.5rem 4rem 1fr; align-items:center; gap:.4rem;">
      <label style="font-size:.78rem; opacity:.85;">${_esc(OP_LABELS[k])}</label>
      <input type="number" min="0" step="0.1" name="${prefix}.marks.${k}" value="0" style="width:100%;">
      <span style="font-size:.72rem; opacity:.65; white-space:nowrap;">have ${_marksToOp(bank?.[k] ?? 0)} OP</span>
    </div>
  `).join("");

  const matRows = stock.length
    ? stock.map(m => `
        <div style="display:grid; grid-template-columns: 5.5rem 4rem 1fr; align-items:center; gap:.4rem;">
          <label style="font-size:.78rem; opacity:.85;" data-tooltip="${_esc(m.name)}">${_esc(m.name)}</label>
          <input type="number" min="0" step="1" max="${m.qty}" name="${prefix}.mat.${_esc(m.key)}" value="0" style="width:100%;">
          <span style="font-size:.72rem; opacity:.65; white-space:nowrap;">have ${m.qty}</span>
        </div>
      `).join("")
    : `<div style="font-size:.72rem; opacity:.55; font-style:italic;">No materials in stockpile.</div>`;

  return `
    <fieldset style="border:1px solid rgba(148,163,184,0.4); border-radius:8px; padding:.6rem .7rem;">
      <legend style="font-weight:700; padding:0 .35rem;">${_esc(label)}</legend>
      <div style="display:flex; flex-direction:column; gap:.25rem;">
        ${rows}
        <div style="border-top:1px solid rgba(148,163,184,0.25); margin:.25rem 0; padding-top:.35rem;
                    display:grid; grid-template-columns: 5.5rem 4rem 1fr; align-items:center; gap:.4rem;">
          <label style="font-size:.78rem; opacity:.85;">Build Units</label>
          <input type="number" min="0" step="1" name="${prefix}.bu" value="0" style="width:100%;">
          <span style="font-size:.72rem; opacity:.65; white-space:nowrap;">have ${bu} BU</span>
        </div>
        <div style="border-top:1px solid rgba(148,163,184,0.25); margin:.25rem 0; padding-top:.35rem;
                    font-size:.72rem; opacity:.7; text-transform:uppercase; letter-spacing:.05em;">
          Materials <span style="opacity:.6;">(face value · no friction)</span>
        </div>
        ${matRows}
      </div>
    </fieldset>
  `;
}

// ════════════════════════════════════════════════════════════════════════════
// BBTTCC_AlliedSendApp — one-way grant to a mutual-Allied counterparty
// ════════════════════════════════════════════════════════════════════════════
class BBTTCC_AlliedSendApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-allied-send",
    classes: ["bbttcc","bbttcc-allied-send"],
    tag: "form",
    window: { title: "Allied Send", icon: "fas fa-handshake", resizable: true },
    position: { width: 460, height: "auto" }
  };

  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
  }

  _alliedTargets() {
    const relApi = game?.bbttcc?.api?.factions?.relations;
    if (!relApi?.list) return [];
    const all = relApi.list(this.actor); // sorted by tier desc
    return all.filter(r => {
      // Mutual allied: both A→B and B→A === "allied".
      const back = relApi.get(game.actors.get(r.id), this.actor);
      return r.tier === "allied" && back === "allied";
    });
  }

  async _renderHTML() {
    const targets = this._alliedTargets();
    const opts = targets.map(t => `<option value="${_esc(t.id)}">${_esc(t.name)}</option>`).join("");
    const noTargets = !targets.length;

    return `
      <section style="padding:.75rem; display:flex; flex-direction:column; gap:.6rem;">
        <div style="font-size:.85rem; opacity:.85;">
          One-way grant from <b>${_esc(this.actor.name)}</b> to a counterparty that mutually rates as <b>Allied</b>. No friction loss.
        </div>
        ${noTargets ? `
          <div style="padding:.6rem; border:1px dashed rgba(239,68,68,0.5); border-radius:8px; color:#fca5a5; font-size:.85rem;">
            No mutually-Allied counterparties available. Both sides must rate each other as "Allied" in the Relationships dialog.
          </div>
        ` : `
          <div>
            <label style="font-size:.78rem; opacity:.85; display:block; margin-bottom:.2rem;">Send to</label>
            <select name="targetId" style="width:100%;">${opts}</select>
          </div>
          ${_columnHTML("offer", "Send", this.actor)}
          <div style="display:flex; justify-content:flex-end; gap:.5rem;">
            <button type="button" data-action="cancel">Cancel</button>
            <button type="button" data-action="send" class="default">
              <i class="fas fa-paper-plane"></i> Send
            </button>
          </div>
        `}
      </section>
    `;
  }

  _replaceHTML(html, content) { content.innerHTML = html; this._wire(content); }

  _wire(root) {
    root.querySelector('[data-action="cancel"]')?.addEventListener("click", () => this.close());
    root.querySelector('[data-action="send"]')?.addEventListener("click", async () => {
      const targetSel = root.querySelector('[name="targetId"]');
      const targetId = targetSel?.value;
      if (!targetId) return ui.notifications?.warn?.("Pick a counterparty.");
      const offer = _collectResource(root, "offer");
      const exApi = game?.bbttcc?.api?.factions?.exchange;
      if (!exApi?.share) return ui.notifications?.error?.("Exchange API not loaded.");
      const target = game.actors.get(targetId);
      if (!target) return;

      const btn = root.querySelector('[data-action="send"]');
      btn.disabled = true;
      try {
        const res = await exApi.share({ from: this.actor, to: target, offer, reason: "Allied Send (UI)" });
        if (res?.ok) {
          ui.notifications?.info?.(`Sent to ${target.name}.`);
          this.close();
        } else {
          ui.notifications?.error?.(`Send failed: ${res?.error || "unknown"}`);
        }
      } catch (e) {
        console.warn(TAG, "send failed", e);
        ui.notifications?.error?.(e?.message || "Send failed");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BBTTCC_TradeApp — bilateral exchange w/ tier-scaled friction
// ════════════════════════════════════════════════════════════════════════════
class BBTTCC_TradeApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-trade",
    classes: ["bbttcc","bbttcc-trade"],
    tag: "form",
    window: { title: "Faction Trade", icon: "fas fa-balance-scale", resizable: true },
    position: { width: 760, height: "auto" }
  };

  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
    this._targetId = options?.prefill?.targetId ?? null;
    this._prefill  = options?.prefill ?? null;
  }

  _candidates() {
    const relApi = game?.bbttcc?.api?.factions?.relations;
    if (!relApi?.list || !relApi?.canTrade) return [];
    return (relApi.list(this.actor) || [])
      .map(r => {
        const target = game.actors.get(r.id);
        if (!target) return null;
        const ct = relApi.canTrade(this.actor, target);
        return {
          id: r.id, name: r.name,
          aTier: r.tier, bTier: ct.sides?.bToA?.tier || "neutral",
          ok: !!ct.ok, mutualTier: ct.mutualTier, friction: ct.friction
        };
      })
      .filter(Boolean);
  }

  async _renderHTML() {
    const cands = this._candidates();
    const tradable = cands.filter(c => c.ok);
    if (!this._targetId && tradable.length) this._targetId = tradable[0].id;

    const opts = cands.map(c => {
      const label = c.ok
        ? `${c.name} — mutual ${c.mutualTier} (${(c.friction*100)|0}% friction)`
        : `${c.name} — BLOCKED (you: ${c.aTier} / them: ${c.bTier})`;
      return `<option value="${_esc(c.id)}" ${c.ok ? "" : "disabled"} ${c.id === this._targetId ? "selected" : ""}>${_esc(label)}</option>`;
    }).join("");

    const target = this._targetId ? game.actors.get(this._targetId) : null;
    const meta = cands.find(c => c.id === this._targetId);

    const tierBanner = (meta && meta.ok) ? `
      <div style="padding:.5rem .65rem; border:1px solid rgba(232,200,74,.45); border-radius:8px; background:rgba(232,200,74,.08); color:#fde68a; font-size:.82rem;">
        <b>Mutual tier:</b> ${_esc(meta.mutualTier.replace(/_/g, " "))} ·
        <b>Friction on marks:</b> ${(meta.friction*100)|0}% loss per side ·
        <b>Materials:</b> face value, no friction.
      </div>
    ` : meta ? `
      <div style="padding:.5rem .65rem; border:1px solid rgba(239,68,68,.5); border-radius:8px; background:rgba(239,68,68,.08); color:#fca5a5; font-size:.82rem;">
        Trade blocked — mutual tier too low. Improve relationships before trading.
      </div>
    ` : `
      <div style="padding:.5rem .65rem; border:1px dashed rgba(148,163,184,.45); border-radius:8px; font-size:.82rem; opacity:.85;">
        Pick a counterparty to view trade terms.
      </div>
    `;

    const isGM = !!game.user?.isGM;
    const submitLabel = isGM ? "Submit & Settle" : "Submit Offer (GM Approval)";

    return `
      <section style="padding:.75rem; display:flex; flex-direction:column; gap:.65rem;">
        <div style="display:flex; align-items:center; gap:.6rem;">
          <label style="font-size:.78rem; opacity:.85;">Counterparty</label>
          <select name="targetId" style="flex:1;">${opts || `<option disabled>No other factions</option>`}</select>
        </div>
        ${tierBanner}
        ${target ? `
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:.6rem;">
            ${_columnHTML("offer", `${this.actor.name} sends`, this.actor)}
            ${_columnHTML("ask",   `${target.name} sends`,    target)}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:.5rem;">
            <input type="text" name="reason" placeholder="(optional) deal flavor — e.g. ration shipment for Yesodium" style="flex:1;">
            <button type="button" data-action="cancel">Cancel</button>
            <button type="button" data-action="submit" class="default" ${meta?.ok ? "" : "disabled"}>
              <i class="fas fa-balance-scale"></i> ${submitLabel}
            </button>
          </div>
          <div style="font-size:.72rem; opacity:.65;">
            ${isGM
              ? "GM mode: clicking Submit settles the trade immediately."
              : "Player mode: clicking Submit whispers a chat card to the GM with Accept / Decline."}
            Marks transfer with ${meta ? (meta.friction*100)|0 : 0}% loss per side. Build Units transfer the same way.
          </div>
        ` : ""}
      </section>
    `;
  }

  _replaceHTML(html, content) { content.innerHTML = html; this._wire(content); this._applyPrefill(content); }

  _applyPrefill(root) {
    if (!this._prefill) return;
    try {
      const writeMarks = (prefix, marks) => {
        for (const [k, v] of Object.entries(marks || {})) {
          const op = (Number(v) || 0) / 10;
          const el = root.querySelector(`[name="${prefix}.marks.${k}"]`);
          if (el) el.value = String(op);
        }
      };
      const writeBU = (prefix, bu) => {
        const el = root.querySelector(`[name="${prefix}.bu"]`);
        if (el) el.value = String(Math.max(0, Math.floor(Number(bu) || 0)));
      };
      const writeMats = (prefix, mats) => {
        for (const [matKey, qty] of Object.entries(mats || {})) {
          const el = root.querySelector(`[name="${prefix}.mat.${matKey}"]`);
          if (el) el.value = String(Math.max(0, Math.floor(Number(qty) || 0)));
        }
      };
      const o = this._prefill.offer || {};
      const a = this._prefill.ask   || {};
      writeMarks("offer", o.marks);
      writeBU("offer",    o.buildUnits);
      writeMats("offer",  o.materials);
      writeMarks("ask",   a.marks);
      writeBU("ask",      a.buildUnits);
      writeMats("ask",    a.materials);
      const reasonEl = root.querySelector('[name="reason"]');
      if (reasonEl && this._prefill.reason) reasonEl.value = String(this._prefill.reason);
    } catch (e) { console.warn(TAG, "prefill failed", e); }
  }

  _wire(root) {
    const targetSel = root.querySelector('[name="targetId"]');
    targetSel?.addEventListener("change", () => {
      this._targetId = targetSel.value;
      this.render({ force: false });
    });
    root.querySelector('[data-action="cancel"]')?.addEventListener("click", () => this.close());
    root.querySelector('[data-action="submit"]')?.addEventListener("click", async () => {
      await this._onSubmit(root);
    });
  }

  async _onSubmit(root) {
    const targetId = root.querySelector('[name="targetId"]')?.value;
    if (!targetId) return ui.notifications?.warn?.("Pick a counterparty.");
    const target = game.actors.get(targetId);
    if (!target) return;
    const offer = _collectResource(root, "offer");
    const ask   = _collectResource(root, "ask");
    const offerEmpty = !Object.keys(offer.marks).length && !offer.buildUnits && !Object.keys(offer.materials || {}).length;
    const askEmpty   = !Object.keys(ask.marks).length   && !ask.buildUnits   && !Object.keys(ask.materials   || {}).length;
    if (offerEmpty && askEmpty) {
      return ui.notifications?.warn?.("Empty trade — fill in something.");
    }
    const reason = String(root.querySelector('[name="reason"]')?.value || "").trim();

    const exApi = game?.bbttcc?.api?.factions?.exchange;
    if (!exApi?.trade) return ui.notifications?.error?.("Exchange API not loaded.");

    if (game.user?.isGM) {
      // Direct settle.
      const btn = root.querySelector('[data-action="submit"]');
      btn.disabled = true;
      try {
        const res = await exApi.trade({ from: this.actor, to: target, offer, ask, reason: reason || "Trade (GM settle)" });
        if (res?.ok) {
          ui.notifications?.info?.(`Trade settled: ${this.actor.name} ↔ ${target.name}.`);
          this.close();
        } else {
          ui.notifications?.error?.(`Trade failed: ${res?.error || "unknown"}`);
        }
      } catch (e) {
        console.warn(TAG, "GM trade failed", e);
        ui.notifications?.error?.(e?.message || "Trade failed");
      } finally {
        btn.disabled = false;
      }
    } else {
      // Player → write a persistent pending-trade entry on the recipient faction
      // AND fire the GM whisper notification (which now points to the inbox).
      try {
        const pending = game?.bbttcc?.api?.factions?.pending;
        let pendingId = null;
        if (pending?.create) {
          const res = await pending.create({ from: this.actor, to: target, offer, ask, reason });
          if (res?.ok) pendingId = res.id;
        }
        const offerStr = _summarizeForChat(offer);
        const askStr   = _summarizeForChat(ask);
        const html = `
          <div class="bbttcc-trade-card" style="padding:.5rem;">
            <div style="font-weight:700; margin-bottom:.25rem;">Trade Proposal — Pending</div>
            <div style="font-size:.85rem;"><b>${_esc(this.actor.name)}</b> → <b>${_esc(target.name)}</b></div>
            <div style="font-size:.82rem; margin-top:.25rem;"><b>Offer:</b> ${offerStr || "—"}</div>
            <div style="font-size:.82rem;"><b>Ask:</b> ${askStr || "—"}</div>
            ${reason ? `<div style="font-size:.78rem; opacity:.85; margin-top:.25rem;">${_esc(reason)}</div>` : ""}
            <div style="font-size:.78rem; opacity:.7; margin-top:.4rem;">
              ${pendingId
                ? `Posted to <b>${_esc(target.name)}</b>'s Trade Inbox. GM or recipient can Accept / Decline / Counter from the faction sheet.`
                : `Pending API not available; no inbox entry was created.`}
            </div>
          </div>
        `;
        const gmIds = (game.users?.contents || []).filter(u => u.isGM).map(u => u.id);
        // Whisper to GMs + any user that owns the recipient faction.
        const ownerIds = (game.users?.contents || [])
          .filter(u => !u.isGM && target.testUserPermission?.(u, "OWNER"))
          .map(u => u.id);
        const whisperIds = Array.from(new Set([...gmIds, ...ownerIds]));
        await ChatMessage.create({
          content: html,
          whisper: whisperIds,
          speaker: { alias: "BBTTCC Trade" }
        });
        ui.notifications?.info?.(pendingId ? "Trade offer queued in inbox." : "Trade offer submitted to GM.");
        this.close();
      } catch (e) {
        console.warn(TAG, "trade whisper failed", e);
        ui.notifications?.error?.("Could not submit offer.");
      }
    }
  }
}

function _summarizeForChat(r) {
  const parts = [];
  for (const k of OP_KEYS) {
    if (r.marks?.[k]) parts.push(`${_marksToOp(r.marks[k])} ${OP_LABELS[k]}`);
  }
  if (r.buildUnits) parts.push(`${r.buildUnits} BU`);
  for (const [matKey, qty] of Object.entries(r.materials || {})) {
    if (qty > 0) parts.push(`${qty}× ${matKey}`);
  }
  return parts.join(", ");
}

// GM chat-card listener: Accept / Decline buttons trigger settlement.
function _wireChatListener() {
  document.body.addEventListener("click", async (ev) => {
    const btn = ev.target?.closest?.("[data-bbttcc-trade-action]");
    if (!btn) return;
    if (!game.user?.isGM) {
      ui.notifications?.warn?.("Only the GM can act on trade proposals.");
      return;
    }
    ev.preventDefault(); ev.stopPropagation();
    if (btn.disabled) return;
    btn.disabled = true;

    const action = btn.getAttribute("data-bbttcc-trade-action");
    let payload = null;
    try {
      payload = JSON.parse(btn.getAttribute("data-payload") || "null");
    } catch { /* fallthrough */ }
    if (!payload) {
      ui.notifications?.error?.("Trade payload missing or corrupt.");
      btn.disabled = false; return;
    }

    if (action === "decline") {
      try {
        const card = btn.closest(".message-content") || btn.closest("li.chat-message") || btn.parentElement;
        if (card) card.querySelectorAll("[data-bbttcc-trade-action]").forEach(b => { b.disabled = true; b.style.opacity = ".5"; });
      } catch {}
      ChatMessage.create({
        content: `<i>Trade declined by GM.</i>`,
        whisper: (game.users?.contents || []).filter(u => u.isGM).map(u => u.id)
      });
      return;
    }

    if (action === "accept") {
      try {
        const exApi = game?.bbttcc?.api?.factions?.exchange;
        if (!exApi?.trade) { ui.notifications?.error?.("Exchange API not loaded."); return; }
        const from = game.actors.get(payload.fromId);
        const to   = game.actors.get(payload.toId);
        if (!from || !to) { ui.notifications?.error?.("Trade actors not found."); return; }
        const res = await exApi.trade({
          from, to,
          offer: payload.offer, ask: payload.ask,
          reason: (payload.reason || "Trade (GM-arbitrated)")
        });
        if (res?.ok) {
          ui.notifications?.info?.(`Trade settled.`);
          // Disable the card buttons so it can't be replayed.
          try {
            const card = btn.closest(".message-content") || btn.closest("li.chat-message") || btn.parentElement;
            if (card) card.querySelectorAll("[data-bbttcc-trade-action]").forEach(b => { b.disabled = true; b.style.opacity = ".5"; });
          } catch {}
        } else {
          ui.notifications?.error?.(`Trade settlement failed: ${res?.error || "unknown"}`);
          btn.disabled = false;
        }
      } catch (e) {
        console.warn(TAG, "GM-accept failed", e);
        ui.notifications?.error?.(e?.message || "Trade failed");
        btn.disabled = false;
      }
    }
  }, { capture: false });
}

function _attach() {
  try {
    game.bbttcc ??= {};
    game.bbttcc.apps ??= {};
    game.bbttcc.apps.AlliedSendApp = BBTTCC_AlliedSendApp;
    game.bbttcc.apps.TradeApp = BBTTCC_TradeApp;
    _wireChatListener();
    console.log(TAG, "Diplomacy apps ready → game.bbttcc.apps.{AlliedSendApp, TradeApp}");
  } catch (e) {
    console.warn(TAG, "diplomacy apps wiring failed", e);
  }
}

Hooks.once("ready", _attach);
try { if (game?.ready) _attach(); } catch (_e) {}
