// modules/bbttcc-territory/scripts/activity-ledger.enhancer.js
// Bad Eden — STRATEGIC ACTIVITY LEDGER + BACK OUT (2026-09-08, owner request:
// "a way to back out effects that are written to hexes as part of Strategic
// Activities").
//
// Every raid EFFECTS[key].apply is wrapped. While an apply runs, the
// preUpdateDrawing / preUpdateActor hooks capture the BEFORE image of each
// hex (flags.bbttcc-territory) and faction (flags.bbttcc-factions) it writes;
// afterwards the changed top-level keys (before → after) are recorded as one
// ledger entry on every hex the activity touched:
//   flags.bbttcc-territory.activityLog[] = { id, ts, turn, key, label,
//     factionId, factionName, targetUuid, hexes: { [uuid]: { name, keys:
//     { routes: {before, after}, integration: {...}, … } } },
//     actors: { [id]: { name, keys: { opBank: {...}, buildUnits: {...} } } },
//     backedOut: ts|null }
// BACK OUT inverts exactly what the activity did (strategic review #16/#17, 2026-10-28):
//   arrays (modifiers, routes, conditions…) → remove what it added, put back what it removed;
//   objects (mods, integration, resources…) → per sub-key, restored only where the hex still
//     holds the value this activity wrote; scalars (status, size, owner…) likewise;
//   anything a later activity changed since is KEPT and reported as a conflict;
//   `turn` (the pending queue) is never restored — queued effects land through the sweep;
//   faction banks get the INVERSE delta plus the marks the turn driver billed (rec.paid),
//     never a stale snapshot. Then the entry is stamped.
//
// UI: "Strategic Activity History" card in the Hex Config → GM Overrides tab.
// Caveat: recording happens on the client that runs the activity (pre-hooks
// are local to the initiator) — the Raid Planner is GM-driven, so that is the
// GM. Ledger capped at 25 entries per hex.
(() => {
  const TAG   = "[bbttcc-territory/activity-ledger]";
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const CAP   = 25;
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const clone = (o) => foundry.utils.deepClone(o);
  const same = (a, b) => { try { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); } catch (_e) { return false; } };
  const esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_e) { return String(s ?? ""); } };

  const HEX_KEY_LABELS = {
    routes: "trade / supply routes", modifiers: "modifiers", resources: "resources", integration: "integration",
    conditions: "conditions", status: "status", type: "type", size: "size", population: "population",
    factionId: "owner", ownerId: "owner", name: "name", turn: "pending turn queue", holdings: "holdings",
    garrison: "garrison", defense: "defense", capital: "capital", alignment: "alignment", nodes: "resource nodes",
    hexNode: "resource node", mods: "GM overrides", radiation: "radiation", darkness: "local darkness", quests: "quest links",
    kind: "kind", isHex: "hex marker", sephirot: "alignment", terrain: "terrain"
  };
  const ACTOR_KEY_LABELS = { opBank: "bank", buildUnits: "build units", opCaps: "caps", victory: "victory", warLogs: "war log", unlocks: "unlocks", quests: "quest track" };
  const turnNow = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch (_e) { return 0; } };

  // ── recorder ─────────────────────────────────────────────────────────────
  let active = null;   // { rec, drawings: Map<uuid, before>, actors: Map<id, before> }

  Hooks.on("preUpdateDrawing", (doc, changes) => {
    try {
      if (!active || !doc?.uuid) return;
      if (!foundry.utils.hasProperty(changes || {}, `flags.${MOD_T}`)) return;
      if (!active.drawings.has(doc.uuid)) active.drawings.set(doc.uuid, clone(doc.flags?.[MOD_T] || {}));
    } catch (_e) {}
  });
  Hooks.on("preUpdateActor", (actor, changes) => {
    try {
      if (!active || !actor?.id) return;
      if (!foundry.utils.hasProperty(changes || {}, `flags.${MOD_F}`)) return;
      if (!active.actors.has(actor.id)) active.actors.set(actor.id, clone(actor.flags?.[MOD_F] || {}));
    } catch (_e) {}
  });

  function diffKeys(before, after) {
    const out = {};
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const k of keys) {
      if (k === "activityLog") continue;
      const b = before?.[k], a = after?.[k];
      if (same(b, a)) continue;
      out[k] = { before: (k in (before || {})) ? clone(b) : undefined, after: (k in (after || {})) ? clone(a) : undefined, hadBefore: k in (before || {}) };
    }
    return out;
  }

  async function finish(ctx) {
    const rec = ctx.rec;
    const hexes = {};
    for (const [uuid, before] of ctx.drawings.entries()) {
      let doc = null; try { doc = fromUuidSync(uuid); } catch (_e) {}
      if (!doc) continue;
      const keys = diffKeys(before, doc.flags?.[MOD_T] || {});
      if (Object.keys(keys).length) hexes[uuid] = { name: String(doc.flags?.[MOD_T]?.name || doc.text || doc.id), keys };
    }
    const actors = {};
    for (const [id, before] of ctx.actors.entries()) {
      const a = game.actors.get(id);
      if (!a) continue;
      const all = diffKeys(before, a.flags?.[MOD_F] || {});
      const keys = {};
      for (const k of ["opBank", "buildUnits", "opCaps"]) if (all[k]) keys[k] = all[k];   // refundable keys only
      if (Object.keys(keys).length) actors[id] = { name: a.name, keys };
    }
    if (!Object.keys(hexes).length) return;   // nothing landed on a hex → not a hex effect
    rec.hexes = hexes; rec.actors = actors;
    for (const uuid of Object.keys(hexes)) {
      let doc = null; try { doc = fromUuidSync(uuid); } catch (_e) {}
      if (!doc) continue;
      const cur = Array.isArray(doc.flags?.[MOD_T]?.activityLog) ? doc.flags[MOD_T].activityLog.slice() : [];
      cur.push(rec);
      while (cur.length > CAP) cur.shift();
      try { await doc.update({ [`flags.${MOD_T}.activityLog`]: cur }); } catch (e) { warn("ledger write failed", uuid, e); }
    }
    log(`recorded “${rec.label}” on ${Object.keys(hexes).length} hex(es)`, rec);
  }

  // One recording window around an activity's code. Nested calls (a wrapper calling another spec, a throughput
  // handler delegating to a sibling) share the outer window. Calls run one at a time inside consumePlanned.
  function makeWrapped(inner, key, label, read) {
    const wrapped = async function ledgerApply(...callArgs) {
      const { actor, entry, paidCost } = read(callArgs[0] || {});
      const outer = !!active;
      if (!outer) {
        active = {
          rec: {
            id: foundry.utils.randomID(10), ts: Date.now(), turn: turnNow(),
            key, label,
            factionId: actor?.id || null, factionName: actor?.name || "", targetUuid: entry?.targetUuid || null,
            paid: (paidCost && typeof paidCost === "object") ? clone(paidCost) : {},   // turn-driver billed this before the effect ran
            backedOut: null
          },
          drawings: new Map(), actors: new Map()
        };
      }
      // 10-29 (#8): a throw or {ok:false} is a failed activity — turn-driver refunds its price itself
      // (refundActivityCost), so the entry keeps the hex diff for Back out but no price to refund twice.
      let failed = true;
      try { const r = await inner.apply(this, callArgs); failed = !!(r && typeof r === "object" && r.ok === false); return r; }
      finally {
        if (!outer) {
          const ctx = active; active = null;
          if (failed && ctx?.rec) { ctx.rec.paid = {}; ctx.rec.failed = true; }
          try { await finish(ctx); } catch (e) { warn("finish failed", e); }
        }
      }
    };
    wrapped.__bbttccLedger = true;
    return wrapped;
  }

  function wrapAll() {
    const raid = game.bbttcc?.api?.raid;
    const E = raid?.EFFECTS;
    if (!E || typeof E !== "object") return 0;
    let n = 0;
    // Strategic rows only (#62, 2026-10-28): maneuvers fired in the raid console are not "strategic activities" and
    // were landing in the hex history.
    for (const [key, spec] of Object.entries(E)) {
      if (!spec || typeof spec !== "object" || typeof spec.apply !== "function") continue;
      if (spec.kind !== "strategic" || spec.apply.__bbttccLedger) continue;
      spec.apply = makeWrapped(spec.apply, key, String(spec.label || key), (args) => ({ actor: args.actor, entry: args.entry, paidCost: args.paidCost }));
      n++;
    }
    // #62: ~70 activities resolve through STRATEGIC_THROUGHPUT (Project Eden, Terraforming, Propaganda…) and never
    // touched the ledger. Their ctx is { factionId, targetUuid, entry, paidCost }.
    const T = raid?.STRATEGIC_THROUGHPUT;
    if (T && typeof T === "object") {
      for (const [key, fn] of Object.entries(T)) {
        if (typeof fn !== "function" || fn.__bbttccLedger) continue;
        T[key] = makeWrapped(fn, key, String(E[key]?.label || key), (ctx) => ({ actor: game.actors.get(String(ctx.factionId || ctx.attackerId || "")) || null, entry: ctx.entry || { targetUuid: ctx.targetUuid || null }, paidCost: ctx.paidCost }));
        n++;
      }
    }
    if (n) log(`wrapped ${n} effect(s)`);
    return n;
  }

  // ── back out ─────────────────────────────────────────────────────────────
  const isPlainObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const NEVER_RESTORE = new Set(["turn"]);   // the pending queue — its effects already landed via the sweep
  const key = (v) => { try { return JSON.stringify(v); } catch (_e) { return String(v); } };

  // Invert one recorded hex key against the CURRENT value. → { set?:value, unset?:true, conflicts:[] } or null (no-op).
  function invertKey(d, cur) {
    const before = d.hadBefore ? d.before : undefined, after = d.after;
    if (Array.isArray(before) || Array.isArray(after)) {
      const b = Array.isArray(before) ? before : [], a = Array.isArray(after) ? after : [];
      const bk = new Set(b.map(key)), ak = new Set(a.map(key));
      const added = new Set(a.map(key).filter(k => !bk.has(k)));
      const removed = b.filter(x => !ak.has(key(x)));
      const c = Array.isArray(cur) ? cur : [];
      const next = c.filter(x => !added.has(key(x)));
      const ck = new Set(next.map(key));
      for (const x of removed) if (!ck.has(key(x))) next.push(clone(x));
      return same(next, c) ? null : { set: next, conflicts: [] };
    }
    if (isPlainObj(before) || isPlainObj(after)) {
      const b = isPlainObj(before) ? before : {}, a = isPlainObj(after) ? after : {};
      const c = isPlainObj(cur) ? clone(cur) : {};
      const conflicts = []; let changed = false;
      for (const sk of new Set([...Object.keys(b), ...Object.keys(a)])) {
        if (same(b[sk], a[sk])) continue;
        if (!same(c[sk], a[sk])) { conflicts.push(sk); continue; }   // a later activity moved it — keep theirs
        if (sk in b) c[sk] = clone(b[sk]); else delete c[sk];
        changed = true;
      }
      return changed ? { set: c, replace: true, conflicts } : (conflicts.length ? { conflicts } : null);
    }
    if (!same(cur, after)) return { conflicts: ["(changed since)"] };
    return d.hadBefore ? { set: clone(before), conflicts: [] } : { unset: true, conflicts: [] };
  }

  // Numeric channel inverse: current − (after − before), per channel.
  function invertNumeric(d, cur) {
    if (typeof d.after === "number" || typeof d.before === "number" || typeof cur === "number") {
      return (Number(cur) || 0) - ((Number(d.after) || 0) - (Number(d.before) || 0));
    }
    const out = isPlainObj(cur) ? clone(cur) : {};
    const b = isPlainObj(d.before) ? d.before : {}, a = isPlainObj(d.after) ? d.after : {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      const delta = (Number(a[k]) || 0) - (Number(b[k]) || 0);
      if (delta) out[k] = (Number(out[k]) || 0) - delta;
    }
    return out;
  }

  const backingOut = new Set();   // 10-29 (#8): rec ids mid-back-out on this client (double click)
  async function backOut(rec) {
    if (!game.user?.isGM) return { ok: false, reason: "GM only" };
    if (!rec?.id) return { ok: false, reason: "no ledger entry" };
    // 10-29 (#8): a stale rec (another open Hex Config, a second GM, a direct API call) must not refund again —
    // re-read every stored copy and bail if any is already stamped.
    if (rec.backedOut || backingOut.has(rec.id)) return { ok: false, reason: "already backed out" };
    for (const uuid of Object.keys(rec.hexes || {})) {
      let doc = null; try { doc = fromUuidSync(uuid); } catch (_e) {}
      const stored = Array.isArray(doc?.flags?.[MOD_T]?.activityLog) ? doc.flags[MOD_T].activityLog : [];
      if (stored.some(r => r?.id === rec.id && r.backedOut)) return { ok: false, reason: "already backed out" };
    }
    backingOut.add(rec.id);
    try { return await backOutOnce(rec); } finally { backingOut.delete(rec.id); }
  }
  async function backOutOnce(rec) {
    const report = [];
    for (const [uuid, h] of Object.entries(rec.hexes || {})) {
      let doc = null; try { doc = fromUuidSync(uuid); } catch (_e) {}
      if (!doc) { report.push(`✗ ${h.name}: hex no longer exists`); continue; }
      const curFlags = doc.flags?.[MOD_T] || {};
      const upd = {}, unset = [], replace = [], done = [], kept = [], skipped = [];
      for (const [k, d] of Object.entries(h.keys || {})) {
        if (NEVER_RESTORE.has(k)) { skipped.push(HEX_KEY_LABELS[k] || k); continue; }
        const inv = invertKey(d, curFlags[k]);
        if (!inv) continue;
        if (inv.conflicts?.length) kept.push(`${HEX_KEY_LABELS[k] || k}${inv.conflicts[0] === "(changed since)" ? "" : ` (${inv.conflicts.join(", ")})`}`);
        if (inv.unset) { unset.push(k); done.push(HEX_KEY_LABELS[k] || k); }
        else if ("set" in inv) { upd[`flags.${MOD_T}.${k}`] = inv.set; if (inv.replace) replace.push(k); done.push(HEX_KEY_LABELS[k] || k); }
      }
      try {
        for (const k of replace) await doc.unsetFlag(MOD_T, k);
        if (Object.keys(upd).length) await doc.update(upd);
        for (const k of unset) { try { await doc.unsetFlag(MOD_T, k); } catch (_e) {} }
        const bits = [];
        if (done.length) bits.push(`restored ${done.join(", ")}`);
        if (kept.length) bits.push(`kept later changes to ${kept.join("; ")}`);
        if (skipped.length) bits.push(`not undone: ${skipped.join(", ")} (already applied by the turn)`);
        report.push(`${done.length ? "✓" : "•"} ${h.name}: ${bits.join(" · ") || "nothing left to undo"}`);
      } catch (e) { warn("hex restore failed", uuid, e); report.push(`✗ ${h.name}: ${e?.message || e}`); }
    }
    // Faction side: inverse deltas on refundable keys + the billed price — never a stale snapshot.
    const actorIds = new Set(Object.keys(rec.actors || {}));
    const paid = isPlainObj(rec.paid) ? rec.paid : {};
    const hasPaid = Object.values(paid).some(v => Number(v) > 0);
    if (hasPaid && rec.factionId) actorIds.add(String(rec.factionId));
    for (const id of actorIds) {
      const actor = game.actors.get(id);
      const a = (rec.actors || {})[id] || { name: actor?.name || rec.factionName || id, keys: {} };
      if (!actor) { report.push(`✗ ${a.name}: faction no longer exists`); continue; }
      const cur = actor.flags?.[MOD_F] || {};
      const upd = {}, bits = [];
      for (const [k, d] of Object.entries(a.keys || {})) {
        upd[`flags.${MOD_F}.${k}`] = invertNumeric(d, cur[k]);
        bits.push(ACTOR_KEY_LABELS[k] || k);
      }
      if (hasPaid && String(id) === String(rec.factionId)) {
        const bank = clone(upd[`flags.${MOD_F}.opBank`] ?? (isPlainObj(cur.opBank) ? cur.opBank : {}));
        for (const [ch, v] of Object.entries(paid)) bank[ch] = (Number(bank[ch]) || 0) + (Number(v) || 0);
        upd[`flags.${MOD_F}.opBank`] = bank;
        bits.push(`price refunded (${Object.entries(paid).filter(([, v]) => Number(v) > 0).map(([ch, v]) => `${v} ${ch}`).join(", ")} marks)`);
      }
      if (!Object.keys(upd).length) continue;
      try { await actor.update(upd); report.push(`✓ ${a.name}: ${bits.join(", ")}`); }
      catch (e) { warn("faction restore failed", id, e); report.push(`✗ ${a.name}: ${e?.message || e}`); }
    }
    // stamp every copy of the entry
    const stamp = Date.now();
    for (const uuid of Object.keys(rec.hexes || {})) {
      let doc = null; try { doc = fromUuidSync(uuid); } catch (_e) {}
      if (!doc) continue;
      const cur = Array.isArray(doc.flags?.[MOD_T]?.activityLog) ? clone(doc.flags[MOD_T].activityLog) : [];
      let hit = false;
      for (const r of cur) if (r?.id === rec.id) { r.backedOut = stamp; hit = true; }
      if (hit) { try { await doc.update({ [`flags.${MOD_T}.activityLog`]: cur }); } catch (_e) {} }
    }
    try {
      await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
        content: `<div class="bbttcc-card"><b>↩ Backed out: ${esc(rec.label)}</b> <span style="opacity:.7">(T${esc(rec.turn)} · ${esc(rec.factionName)})</span><br/>${report.map(esc).join("<br/>")}</div>` });
    } catch (_e) {}
    return { ok: !report.some(r => r.startsWith("✗")), report };
  }

  // ── Hex Config card (GM Overrides tab) ───────────────────────────────────
  function describe(rec) {
    const hexBits = Object.values(rec.hexes || {}).map(h => `${esc(h.name)}: ${Object.keys(h.keys || {}).map(k => HEX_KEY_LABELS[k] || k).join(", ")}`);
    const actBits = Object.values(rec.actors || {}).map(a => `${esc(a.name)}: ${Object.keys(a.keys || {}).map(k => ACTOR_KEY_LABELS[k] || k).join(", ")}`);
    return [...hexBits, ...actBits].join(" · ");
  }
  // Mirrors effects-build-units' resolveHexDocument: bound document, uuid
  // option, then the name field in the form matched against canvas drawings.
  async function resolveDoc(app) {
    try {
      const maybe = app?.document || app?.object || null;
      if (maybe?.documentName === "Drawing") return maybe;
      if (maybe?.document?.documentName === "Drawing") return maybe.document;
      const uuid = app?.object?.uuid || app?.document?.uuid || app?.options?.uuid || app?.hexUuid || null;
      if (uuid) { const d = await fromUuid(uuid); const doc = d?.document ?? d; if (doc?.documentName === "Drawing") return doc; }
      const el = app?.element instanceof jQuery ? app.element[0] : app?.element;
      const nm = el?.querySelector?.(".bbttcc-hex-config input[name='name']")?.value?.trim();
      if (nm) {
        const hit = (canvas?.drawings?.placeables || []).find(p => String(p?.document?.flags?.[MOD_T]?.name || p?.document?.text || "").trim() === nm);
        return hit?.document ?? null;
      }
    } catch (_e) {}
    return null;
  }
  function inject(app, html) {
    try {
      if (!game.user?.isGM) return;
      const root = (html instanceof jQuery) ? html[0] : html;
      const host = root?.querySelector?.('.bbttcc-hex-config [data-ft-tab-panel="gm"]');
      if (!host || host.querySelector("[data-bbttcc='activity-ledger']")) return;
      Promise.resolve(resolveDoc(app)).then((doc) => {
        if (!doc) return;
        const entries = (Array.isArray(doc.flags?.[MOD_T]?.activityLog) ? doc.flags[MOD_T].activityLog : []).slice().reverse();
        const wrap = document.createElement("fieldset");
        wrap.setAttribute("data-bbttcc", "activity-ledger");
        wrap.style.cssText = "margin-top:.75rem;border:1px solid rgba(212,163,95,.45);border-radius:10px;padding:.5rem .6rem;";
        const rows = entries.length ? entries.map(r =>
          `<div style="display:flex;gap:.5rem;align-items:baseline;padding:.25rem 0;border-bottom:1px solid rgba(255,255,255,.06);${r.backedOut ? "opacity:.5;" : ""}">
             <span style="flex:0 0 auto;font-family:ui-monospace,Menlo,monospace;font-size:.75rem;opacity:.8">T${esc(r.turn)}</span>
             <span style="flex:1 1 auto;min-width:0"><b>${esc(r.label)}</b> <span style="opacity:.75">— ${esc(r.factionName)}</span><div style="font-size:.76rem;opacity:.75">${describe(r)}</div></span>
             ${r.backedOut ? `<span style="flex:0 0 auto;font-size:.75rem;color:#4ade80">↩ backed out</span>` : `<button type="button" class="bbttcc-btn bbttcc-btn-xs" data-ledger-backout="${esc(r.id)}" style="flex:0 0 auto;">↩ Back out</button>`}
           </div>`).join("")
          : `<p class="hint" style="margin:0;opacity:.75">No strategic activities recorded on this hex yet. Every planned activity that changes this hex when the Turn runs lands here with what it changed — and ↩ Back out undoes it.</p>`;
        wrap.innerHTML = `<legend style="padding:0 .25rem;opacity:.9;font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#ffd28a;">↩ Strategic Activity History</legend>${rows}`;
        host.appendChild(wrap);
        wrap.addEventListener("click", async (ev) => {
          const btn = ev.target?.closest?.("[data-ledger-backout]");
          if (!btn) return;
          ev.preventDefault(); ev.stopPropagation();
          const rec = entries.find(r => r.id === btn.dataset.ledgerBackout);
          if (!rec) return;
          const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: `Back out “${rec.label}”?` },
            content: `<p>Restore what this activity changed, on every hex and faction it touched:</p><p style="font-size:.9em">${describe(rec) || "(nothing recorded)"}</p><p class="hint">Only what this activity did is undone — anything a later activity changed stays (and is listed). Effects it queued for the turn have already landed and are not undone. ${Object.values(rec.paid || {}).some(v => Number(v) > 0) ? "The marks it cost are refunded." : rec.failed ? "It failed, and the turn already refunded its price, so no marks come back." : "No price was recorded for it (activities logged before 2026-10-28), so no marks come back."}</p>`
          });
          if (!ok) return;
          btn.disabled = true;
          const res = await backOut(rec);
          if (res.reason) ui.notifications?.warn?.(`Not backed out: ${rec.label} — ${res.reason}.`);   // 10-29 (#8): refused, nothing ran
          else ui.notifications?.[res.ok ? "info" : "warn"]?.(`${res.ok ? "Backed out" : "Backed out with problems"}: ${rec.label} — see chat.`);
          try { app.render(false); } catch (_e) {}
        });
      });
    } catch (e) { warn("inject failed", e); }
  }

  // ── install ──────────────────────────────────────────────────────────────
  Hooks.once("ready", () => {
    let tries = 0;
    const tick = () => { if (wrapAll() || ++tries > 20) return; setTimeout(tick, 500); };
    setTimeout(tick, 1000);
    // Late registrations (loader, content packs) get wrapped when the planner/console opens.
    Hooks.on("renderApplication", () => { try { wrapAll(); } catch (_e) {} });
    Hooks.on("bbttcc:advanceTurn:begin", () => { try { wrapAll(); } catch (_e) {} });   // late handlers (siege…) before plans resolve
    Hooks.on("renderApplicationV2", () => { try { wrapAll(); } catch (_e) {} });
    Hooks.on("renderApplication", inject);
    Hooks.on("renderApplicationV2", inject);
    game.bbttcc = game.bbttcc || {}; game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.territory = game.bbttcc.api.territory || {};
    game.bbttcc.api.territory.activityLedger = {
      list: (doc) => (Array.isArray(doc?.flags?.[MOD_T]?.activityLog) ? doc.flags[MOD_T].activityLog.slice() : []),
      backOut, wrapAll
    };
    log("installed");
  });
})();
