// bbttcc-travel/scripts/menace.js — MENACES (owner ruling 2026-10-21, "the predator beats already say
// 'these are the kinds of problems you have on your land' — I never developed that").
//
// Three things live here:
//
//  1. PARTY SCALE — what the party is riding in. A travel-table entry may say `conditions.scale: "foot" | "rig"
//     | "any"`; a party in a big rig (bracket medium/heavy) never draws a foot-scale entry unless that beat is a
//     MENACE (then the warning card explains the rig waits at the edge). Personal/light rigs read as foot — a
//     Hexmobile is a personal rig; the Absolutely Reliable is not.
//
//  2. THE WARNING CARD — a beat that carries `beat.menace = { label, warning?, speaker?, clock?, declineTags?,
//     helpTags?, declineLoyalty?, billLoyalty?, billDarkness? }` is prefaced, on the road, by a public card:
//     the locals of the settled end of the leg (or the road itself) warn the party, and the party answers
//     HELP (go in on foot — the beat runs) or NOT NOW (ride on — the menace is recorded on the hex). Either
//     answer carries political tags through the Convictions monitor (ruling 17): helping is `protection` +
//     `mutual_aid`, walking away is `abandonment` — measured against who the steward says they are, never
//     a flat penalty.
//
//  3. THE HEX MENACE STATE — `flags.bbttcc-territory.menaces = [{ key, label, beatId, campaignId, factionId,
//     since, dueTurn, overdue }]` plus the named hex state "Menace" (economy constants: −10% production,
//     −2 loyalty score while it stands). A declined menace costs the hex a little loyalty at once; when its
//     clock runs out the bill lands (hex loyalty, faction darkness) and the row turns overdue. Dealing with
//     it — `worldEffects.hexMenace {action:"clear"}` on the beat's winning endings — lifts the state and PAYS
//     (hex loyalty back up, darkness relief if authored, a public card). Every later leg that touches a
//     menaced hex re-posts a short reminder.
//
// API: game.bbttcc.api.travel.menace = { partyScale, entryScaleOk, list, find, add, clear, gateEncounter,
//      tick, DEFAULTS, STATE_NAME }. Setting bbttcc-travel.menaceGate (world, default ON) turns the whole
//      layer off (no scale filter, no cards, no ticks). GM-side writes; player clicks relay via gmExec
//      `travel.menace.answer`.
(() => {
  const TAG   = "[bbttcc-travel/menace]";
  const MOD   = "bbttcc-travel";
  const MODT  = "bbttcc-territory";
  const FLAG  = "menaces";
  const STATE_NAME = "Menace";
  const EXEC_TYPE  = "travel.menace.answer";
  const log  = (...a) => console.log(TAG, ...a);
  const warn = (...a) => console.warn(TAG, ...a);
  const esc  = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_e) { return String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c])); } };

  // ✅ BLESSED by the owner 2026-10-21. Loyalty numbers are hex mods.loyalty points (the hex Loyalty score);
  // darkness is the faction meter; clock is world turns.
  const DEFAULTS = Object.freeze({
    clock: 3,
    declineLoyalty: -1,      // the locals remember, at once
    billLoyalty: -2,         // when the clock runs out
    billDarkness: 1,         // when the clock runs out (the faction that rode past)
    rewardLoyalty: 2,        // a cleared menace, paid by hexMenace clear
    rewardDarkness: 0,       // authored per beat (a clear can relieve darkness)
    helpTags: ["protection", "mutual_aid"],
    declineTags: ["abandonment"]
  });
  // mecha = rig (owner ruling 2026-10-21: a walker is a rig, not a scout — it skips foot-scale fights).
  const BRACKET_SCALE = { personal: "foot", light: "foot", medium: "rig", mecha: "rig", heavy: "rig", siege: "rig" };
  const BRACKET_RANK  = { personal: 0, light: 1, medium: 2, mecha: 2, heavy: 3, siege: 4 };

  // ── settings ───────────────────────────────────────────────────────────────
  Hooks.once("init", () => {
    try {
      game.settings.register(MOD, "menaceGate", {
        name: "Menaces: scale gate + warning cards",
        hint: "When ON, travel-table entries may declare a scale (foot / rig) and a party in a medium or heavy rig never draws foot-scale fights; beats that carry a menace block are prefaced by the locals' warning card (Help / Not now), and a declined menace is recorded on the hex with a clock. OFF = the old behaviour (every entry draws for everyone, no cards, no menace states). Default ON.",
        scope: "world", config: true, type: Boolean, default: true
      });
    } catch (e) { warn("settings register failed", e); }
  });
  const enabled = () => { try { return game.settings.get(MOD, "menaceGate") !== false; } catch (_e) { return true; } };

  // ── helpers ────────────────────────────────────────────────────────────────
  const gmIds = () => (game.users || []).filter(u => u.isGM).map(u => u.id);
  const isGM  = () => !!game.user?.isGM;
  function worldTurn() {
    try { const st = game.bbttcc?.api?.world?.getState?.() || {}; const t = Number(st.turn || 0); return Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0; } catch (_e) { return 0; }
  }
  function normName(x) { return String(x || "").replace(/[\s ]+/g, " ").trim().toLowerCase(); }
  function hexFlags(doc) { return (doc && doc.flags && doc.flags[MODT]) ? doc.flags[MODT] : {}; }
  function isHexDoc(doc) { const tf = hexFlags(doc); return !!(tf && (tf.isHex === true || tf.kind === "territory-hex")); }
  function hexName(doc) { const tf = hexFlags(doc); return String(tf.name || tf.hexName || doc?.text || doc?.id || "the hex").replace(/[\s ]+/g, " ").trim(); }
  function hexIsSettled(doc) { const tf = hexFlags(doc); const type = String(tf.type || "").toLowerCase(); const size = String(tf.size || "none").toLowerCase(); return type === "settlement" && size !== "none" || ["outpost", "village", "town", "city"].includes(size); }
  function* allHexDocs() { for (const sc of (game.scenes || [])) for (const d of (sc.drawings || [])) if (isHexDoc(d)) yield d; }
  function findHexByName(name) { const want = normName(name); if (!want) return null; for (const d of allHexDocs()) if (normName(hexName(d)) === want) return d; return null; }
  async function resolveHex(ref) {
    if (!ref) return null;
    if (typeof ref === "object") {
      if (ref.documentName === "Drawing") return ref;
      if (ref.document?.documentName === "Drawing") return ref.document;
      if (ref.obj?.documentName === "Drawing") return ref.obj;
      if (ref.obj?.document?.documentName === "Drawing") return ref.obj.document;
      if (ref.uuid) return resolveHex(String(ref.uuid));
      if (ref.hexUuid) return resolveHex(String(ref.hexUuid));
      if (ref.hexName) return findHexByName(ref.hexName);
      return null;
    }
    const s = String(ref);
    if (s.startsWith("Scene.")) { try { const d = await fromUuid(s); if (d?.documentName === "Drawing") return d; if (d?.document?.documentName === "Drawing") return d.document; } catch (_e) {} return null; }
    return findHexByName(s);
  }
  function factionOf(id) { if (!id) return null; const a = game.actors?.get?.(String(id).replace(/^Actor\./, "")); return a || null; }
  function rigsApi() { return game.bbttcc?.rigs || null; }
  function rigBracket(rig) { try { const R = rigsApi(); const b = R?.data ? R.data(rig)?.integrity?.bracket : (rig?.system?.integrity?.bracket); return String(b || "medium").toLowerCase(); } catch (_e) { return "medium"; } }
  function rigMobility(rig) { try { const R = rigsApi(); return String((R?.data ? R.data(rig)?.identity?.mobility : rig?.system?.identity?.mobility) || "mobile").toLowerCase(); } catch (_e) { return "mobile"; } }
  function stewardsOf(faction) { try { return (game.bbttcc?.api?.banks?.stewardsOf?.(faction) || []).filter(a => a?.type === "character"); } catch (_e) { return []; } }

  // ── 1. PARTY SCALE ─────────────────────────────────────────────────────────
  // A boarded rig outranks an owned one (who is actually riding); among several, the largest bracket wins.
  function partyScale(factionId) {
    const out = { scale: "foot", bracket: null, rigName: null, rigId: null, via: "foot" };   // rigId: the ridden rig (road-speed scout bonus reads it, 2026-10-21)
    try {
      if (!enabled()) return Object.assign(out, { via: "gate-off" });
      const faction = factionOf(factionId);
      if (!faction) return out;
      const R = rigsApi();
      const pick = (rigs, via) => {
        let best = null;
        for (const rig of rigs) { if (!rig) continue; if (rigMobility(rig) === "stationary") continue; const b = rigBracket(rig); if (!best || (BRACKET_RANK[b] ?? 2) > (BRACKET_RANK[best.b] ?? 2)) best = { rig, b }; }
        if (!best) return false;
        out.bracket = best.b; out.rigName = best.rig.name; out.rigId = best.rig.id; out.via = via; out.scale = BRACKET_SCALE[best.b] || "rig";
        return true;
      };
      // boarded first
      const boarded = [];
      for (const st of stewardsOf(faction)) {
        try { const b = R?.boardedRigOf ? R.boardedRigOf(st) : (st?.flags?.fourththing?.boardedRig || null); const id = b?.rigId || (typeof b === "string" ? b : null); const rig = id ? game.actors.get(id) : null; if (rig) boarded.push(rig); } catch (_e) {}
      }
      if (pick(boarded, "boarded")) return out;
      // then the faction's mobile rigs (the travel domains' own list, same authority as the medium gate)
      let owned = [];
      try { owned = game.bbttcc?.api?.travel?.domains?.factionRigs?.(faction.id) || []; } catch (_e) {}
      if (!owned.length && R?.listByFaction) { try { owned = R.listByFaction(faction.id) || []; } catch (_e) {} }
      if (pick(owned, "owned")) return out;
    } catch (e) { warn("partyScale failed", e); }
    return out;
  }
  function entryScaleOk(entry, scale) {
    try {
      if (!enabled()) return true;
      const want = String(entry?.conditions?.scale || entry?.scale || "any").trim().toLowerCase();
      if (!want || want === "any") return true;
      const have = (typeof scale === "string") ? scale : (scale && scale.scale) || "foot";
      return want === have;
    } catch (_e) { return true; }
  }

  // ── 3. THE HEX MENACE STATE ────────────────────────────────────────────────
  function list(doc) { const rows = hexFlags(doc)[FLAG]; return Array.isArray(rows) ? rows.filter(r => r && typeof r === "object") : []; }
  function find({ key = null, beatId = null } = {}) {
    const k = String(key || "").trim(), b = String(beatId || "").trim();
    if (!k && !b) return null;
    for (const d of allHexDocs()) for (const row of list(d)) { if ((k && String(row.key) === k) || (b && String(row.beatId) === b)) return { doc: d, row }; }
    return null;
  }
  async function writeRows(doc, rows) { await doc.update({ [`flags.${MODT}.${FLAG}`]: rows }, { parent: doc.parent }); }
  async function setState(doc, on, via) {
    const tf = hexFlags(doc);
    const cur = Array.isArray(tf.modifiers) ? tf.modifiers.slice() : [];
    const has = cur.some(m => normName(m) === normName(STATE_NAME));
    if (on && has) return false; if (!on && !has) return false;
    const next = on ? cur.concat([STATE_NAME]) : cur.filter(m => normName(m) !== normName(STATE_NAME));
    await doc.update({ [`flags.${MODT}.modifiers`]: next }, { parent: doc.parent });
    try { const rc = game.bbttcc?.api?.territory?.recomputeHexResources; if (typeof rc === "function") await rc(doc, { source: `menace:${via}` }); } catch (e) { warn("recompute failed", e); }
    return true;
  }
  async function ledger(doc, { kind, label, description, before, after }) {
    try { const rec = game.bbttcc?.api?.territory?.recordHexImprovement; if (typeof rec === "function") await rec(doc, { kind, label, description, source: "menace", before, after, reversible: false }); } catch (_e) {}
  }
  async function bumpHexLoyalty(doc, delta, why) {
    const d = Number(delta) || 0; if (!d) return 0;
    const tf = hexFlags(doc); const before = Number(tf.mods?.loyalty || 0) || 0; const after = before + d;
    await doc.update({ [`flags.${MODT}.mods.loyalty`]: after }, { parent: doc.parent });
    await ledger(doc, { kind: "menace_loyalty", label: `Loyalty ${d > 0 ? "+" : ""}${d}`, description: why, before: { loyalty: before }, after: { loyalty: after } });
    return d;
  }
  async function factionDarkness(factionId, delta, why) {
    const d = Number(delta) || 0; const fid = String(factionId || "").replace(/^Actor\./, ""); if (!d || !fid) return 0;
    try {
      const wm = game.bbttcc?.api?.worldMutation;
      if (wm?.applyWorldEffects) { await wm.applyWorldEffects({ factionEffects: [{ factionId: fid, darknessDelta: d }] }, { beatId: "menace", beatType: "menace", beatLabel: why || "Menace" }); return d; }
      const f = game.bbttcc?.api?.factions; if (f?.applyDelta) { await f.applyDelta({ factionId: fid, darknessDelta: d, reason: why || "Menace", activity: "world_effect" }); return d; }
    } catch (e) { warn("darkness delta failed", e); }
    return 0;
  }
  async function political(factionId, tags, source) {
    const fid = String(factionId || "").replace(/^Actor\./, ""); const t = (Array.isArray(tags) ? tags : String(tags || "").split(/[\s,]+/)).map(x => String(x || "").trim()).filter(Boolean);
    if (!fid || !t.length) return null;
    try { const aae = game.bbttcc?.api?.aae; if (aae?.applyPoliticalImpact) return await aae.applyPoliticalImpact({ factionId: fid, tags: t, source }); } catch (e) { warn("political impact failed", e); }
    return null;
  }
  async function card(html, { whisper = null } = {}) {
    try { await ChatMessage.create({ content: html, speaker: { alias: "Bad Eden" }, whisper: whisper || undefined }); } catch (e) { warn("card failed", e); }
  }
  const box = (color, inner) => `<div class="bbttcc-menace-card" style="border-left:3px solid ${color};padding:.45em .7em;background:rgba(0,0,0,.06);line-height:1.4;">${inner}</div>`;

  /** Record a menace on a hex. Idempotent per key. */
  async function add(hexRef, { key, label, beatId = "", campaignId = "", factionId = "", clock = null, source = "beat", note = "" } = {}) {
    if (!isGM()) return { ok: false, error: "GM only" };
    const doc = await resolveHex(hexRef); if (!doc) return { ok: false, error: "hex not found" };
    const k = String(key || beatId || label || "").trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_"); if (!k) return { ok: false, error: "menace needs a key" };
    const rows = list(doc);
    if (rows.some(r => String(r.key) === k)) return { ok: true, already: true, doc, row: rows.find(r => String(r.key) === k) };
    const turn = worldTurn(); const c = Math.max(1, Number(clock ?? DEFAULTS.clock) || DEFAULTS.clock);
    const row = { key: k, label: String(label || key || beatId || "a menace").trim(), beatId: String(beatId || ""), campaignId: String(campaignId || ""), factionId: String(factionId || "").replace(/^Actor\./, ""), since: turn, clock: c, dueTurn: turn + c, overdue: false, warnedTurn: turn, source: String(source || "beat"), note: String(note || "") };
    await writeRows(doc, rows.concat([row]));
    await setState(doc, true, "add");
    await ledger(doc, { kind: "menace_added", label: `Menace: ${row.label}`, description: `Recorded on ${hexName(doc)} (turn ${turn}, due turn ${row.dueTurn}).`, before: { menaces: rows.length }, after: { menaces: rows.length + 1 } });
    log("menace added", { hex: hexName(doc), row });
    return { ok: true, doc, row };
  }

  /** Lift a menace (by hex + key, or by key / beatId anywhere) and PAY the reward. */
  async function clear(hexRef, { key = null, beatId = null, reward = null, factionId = "", why = "", quiet = false } = {}) {
    if (!isGM()) return { ok: false, error: "GM only" };
    let doc = hexRef ? await resolveHex(hexRef) : null;
    let rows = doc ? list(doc) : [];
    let idx = -1;
    const k = String(key || "").trim().toLowerCase(), b = String(beatId || "").trim();
    if (doc) idx = rows.findIndex(r => (k && String(r.key) === k) || (b && String(r.beatId) === b) || (!k && !b));
    if (idx < 0) { const hit = find({ key: k, beatId: b }); if (hit) { doc = hit.doc; rows = list(doc); idx = rows.findIndex(r => r === hit.row || String(r.key) === String(hit.row.key)); } }
    if (!doc || idx < 0) return { ok: false, error: "no such menace", key: k, beatId: b };
    const row = rows[idx]; const rest = rows.slice(0, idx).concat(rows.slice(idx + 1));
    await writeRows(doc, rest);
    if (!rest.length) await setState(doc, false, "clear");
    const rw = Object.assign({ hexLoyalty: DEFAULTS.rewardLoyalty, darkness: DEFAULTS.rewardDarkness }, (reward && typeof reward === "object") ? reward : {});
    const fid = String(factionId || row.factionId || hexFlags(doc).factionId || "").replace(/^Actor\./, "");
    const dl = await bumpHexLoyalty(doc, rw.hexLoyalty, `The ${row.label} at ${hexName(doc)} dealt with.`);
    const dd = await factionDarkness(fid, rw.darkness, `Menace cleared: ${row.label}`);
    await ledger(doc, { kind: "menace_cleared", label: `Menace cleared: ${row.label}`, description: why || `Dealt with (${row.overdue ? "overdue" : "in time"}).`, before: { menaces: rows.length }, after: { menaces: rest.length } });
    if (!quiet) {
      const fx = [dl ? `hex loyalty ${dl > 0 ? "+" : ""}${dl}` : null, dd ? `darkness ${dd > 0 ? "+" : ""}${dd}` : null].filter(Boolean).join(" · ");
      await card(box("#4db870", `🐺 <b>${esc(row.label)}</b> at <b>${esc(hexName(doc))}</b> — dealt with.${row.overdue ? " <span style=\"opacity:.75\">(late, but done)</span>" : ""}${fx ? `<div style="opacity:.8;font-size:.92em;margin-top:.2em">${esc(fx)}</div>` : ""}`));
    }
    log("menace cleared", { hex: hexName(doc), row, reward: rw });
    return { ok: true, doc, row, reward: rw };
  }

  // ── 2. THE WARNING CARD ────────────────────────────────────────────────────
  const PENDING = new Map();   // card id → { resolve, timer }
  function beatOf(campaignId, beatId) {
    try { const g = game.bbttcc?.api?.travel?.getBeat; if (typeof g === "function") return g(campaignId, beatId) || null; } catch (_e) {}
    try { const capi = game.bbttcc?.api?.campaign; const c = capi?.getCampaign?.(campaignId); const beats = c?.beats; if (!beats) return null; if (Array.isArray(beats)) return beats.find(x => x && x.id === beatId) || null; return beats[beatId] || null; } catch (_e) { return null; }
  }
  function menaceOf(beat) {
    const m = beat && beat.menace; if (!m) return null;
    if (m === true) return { label: beat.label || beat.id };
    if (typeof m !== "object") return null;
    if (m.enabled === false) return null;
    return Object.assign({ label: beat.label || beat.id }, m);
  }
  function speakerFor(fromDoc, toDoc, m) {
    if (m && m.speaker) return String(m.speaker);
    if (toDoc && hexIsSettled(toDoc)) return `The folk of ${hexName(toDoc)}`;
    if (fromDoc && hexIsSettled(fromDoc)) return `The folk of ${hexName(fromDoc)}`;
    return "The road";
  }
  function warningText(m, speaker, toDoc) {
    if (m && m.warning) return String(m.warning);
    const where = toDoc ? hexName(toDoc) : "the next hex";
    return speaker === "The road"
      ? `Tracks, a carcass, a silence where there should be birds: a ${m.label} works ${where}.`
      : `${speaker} stop you before the trail: a ${m.label} has been taking people and stock around ${where}. Nobody here can face it. They ask if you will.`;
  }
  async function renderCard({ id, m, speaker, text, scale, hexDoc, factionName }) {
    const rigLine = (scale && scale.scale === "rig")
      ? `<div style="margin-top:.35em;opacity:.85;">The ground there is too tight for <b>${esc(scale.rigName || "the rig")}</b>. It waits at the edge of the hex; whoever goes in goes on foot.</div>`
      : "";
    const clock = Math.max(1, Number(m.clock ?? DEFAULTS.clock) || DEFAULTS.clock);
    const inner = `
      <div style="font-weight:700;">🐺 ${esc(m.label)}${hexDoc ? ` <span style="opacity:.7;font-weight:400">— ${esc(hexName(hexDoc))}</span>` : ""}</div>
      <div style="margin-top:.3em;"><i>${esc(speaker)}:</i> ${esc(text)}</div>
      ${rigLine}
      <div style="margin-top:.5em;display:flex;gap:.5em;flex-wrap:wrap;">
        <button type="button" data-bbttcc-menace="help" data-menace-id="${esc(id)}" style="width:auto;padding:.25em .8em;">Help — go in${scale && scale.scale === "rig" ? " on foot" : ""}</button>
        <button type="button" data-bbttcc-menace="decline" data-menace-id="${esc(id)}" style="width:auto;padding:.25em .8em;">Not now — ride on</button>
      </div>
      <div style="margin-top:.35em;opacity:.65;font-size:.85em;">${esc(factionName || "The party")} decides. Walking away is remembered here; in ${clock} turn${clock === 1 ? "" : "s"} the bill comes due.</div>`;
    const msg = await ChatMessage.create({ content: box("#c9a227", inner), speaker: { alias: "Bad Eden" }, flags: { [MOD]: { menaceCard: { id, label: m.label, answered: false } } } });
    return msg;
  }
  async function settleCard(msg, choice, byName) {
    try {
      if (!msg) return;
      const line = choice === "help" ? `✅ <b>Help</b> — ${esc(byName || "the party")} goes in.` : `↪ <b>Not now</b> — ${esc(byName || "the party")} rides on. The hex remembers.`;
      const html = String(msg.content || "").replace(/<div style="margin-top:\.5em;display:flex;[\s\S]*?<\/div>\s*<div style="margin-top:\.35em;opacity:\.65[\s\S]*?<\/div>/, `<div style="margin-top:.5em;">${line}</div>`);
      await msg.update({ content: html, [`flags.${MOD}.menaceCard.answered`]: true, [`flags.${MOD}.menaceCard.choice`]: choice });
    } catch (e) { warn("settleCard failed", e); }
  }
  function askTable(args) {
    return new Promise(async (resolve) => {
      const id = foundry.utils.randomID();
      let msg = null;
      try { msg = await renderCard(Object.assign({ id }, args)); } catch (e) { warn("card render failed", e); return resolve({ choice: "help", by: "engine", error: String(e?.message || e) }); }
      PENDING.set(id, { resolve: (choice, by) => { PENDING.delete(id); settleCard(msg, choice, by); resolve({ choice, by }); }, msg });
    });
  }
  // GM-side answer handler (player clicks relay here through gmExec).
  Hooks.once("ready", () => {
    try {
      const ge = game.bbttcc?.api?.gmExec;
      if (ge?.register) ge.register(EXEC_TYPE, async (payload, meta) => {
        const id = String(payload?.id || ""); const choice = payload?.choice === "decline" ? "decline" : "help";
        const p = PENDING.get(id);
        if (!p) return { ok: false, why: "no such pending card (already answered, or the GM seat that posted it is gone)" };
        p.resolve(choice, meta?.fromUserName || game.user?.name || "the party");
        return { ok: true, choice };
      });
      else warn("gmExec not available — player seats cannot answer menace cards (GM can)");
    } catch (e) { warn("gmExec register failed", e); }
  });
  function bindButtons(message, html) {
    const root = html instanceof HTMLElement ? html : (html && html[0]) || null; if (!root) return;
    for (const btn of root.querySelectorAll("[data-bbttcc-menace]")) {
      if (btn.__bbttccMenaceBound) continue; btn.__bbttccMenaceBound = true;
      const answered = !!message?.flags?.[MOD]?.menaceCard?.answered; if (answered) { btn.disabled = true; continue; }
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const id = btn.getAttribute("data-menace-id"); const choice = btn.getAttribute("data-bbttcc-menace");
        btn.disabled = true;
        try {
          const ge = game.bbttcc?.api?.gmExec;
          let res = null;
          if (isGM() && PENDING.has(id)) { PENDING.get(id).resolve(choice, game.user?.name); res = { ok: true }; }
          else if (ge?.call) res = await ge.call(EXEC_TYPE, { id, choice }, { timeoutMs: 15000 });
          else res = { ok: false, why: "no GM relay" };
          if (!res?.ok) { ui.notifications?.warn?.(`Menace card: ${res?.why || "could not answer"}`); btn.disabled = false; }
        } catch (e) { warn("answer failed", e); ui.notifications?.warn?.("Menace card: no GM answered."); btn.disabled = false; }
      });
    }
  }
  Hooks.on("renderChatMessageHTML", (m, h) => { try { bindButtons(m, h); } catch (_e) {} });
  Hooks.on("renderChatMessage", (m, h) => { try { bindButtons(m, h); } catch (_e) {} });

  /**
   * The gate the encounter launcher calls before running a road beat. Returns { proceed, choice, ... }.
   * proceed:true when the beat carries no menace (or the layer is off); otherwise after the table answers.
   */
  async function gateEncounter({ ctx, campaignId, beatId } = {}) {
    const out = { proceed: true, menace: false };
    try {
      if (!enabled() || !isGM()) return out;
      const beat = beatOf(campaignId, beatId); const m = menaceOf(beat);
      if (!m) return out;
      out.menace = true;
      const factionId = String(ctx?.factionId || ctx?.actor?.id || "").replace(/^Actor\./, "");
      const faction = factionOf(factionId);
      const toDoc = await resolveHex(ctx?.to || ctx?.toHexUuid || ctx?.hexUuid || null);
      const fromDoc = await resolveHex(ctx?.from || ctx?.fromHexUuid || null);
      const scale = partyScale(factionId);
      const speaker = speakerFor(fromDoc, toDoc, m);
      const text = warningText(m, speaker, toDoc);
      const ans = await askTable({ m, speaker, text, scale, hexDoc: toDoc, factionName: faction?.name || null });
      out.choice = ans.choice; out.by = ans.by; out.hexUuid = toDoc?.uuid || null; out.scale = scale;
      const src = { kind: "menace", campaignId, beatId, choice: ans.choice, hex: toDoc ? hexName(toDoc) : null };
      if (ans.choice === "decline") {
        out.proceed = false;
        if (toDoc) {
          const r = await add(toDoc, { key: m.key || beatId, label: m.label, beatId, campaignId, factionId, clock: m.clock, source: "declined" });
          out.added = !!(r && r.ok && !r.already);
          await bumpHexLoyalty(toDoc, m.declineLoyalty ?? DEFAULTS.declineLoyalty, `${faction?.name || "The party"} rode past the ${m.label}.`);
        }
        await political(factionId, m.declineTags || DEFAULTS.declineTags, src);
        const clock = Math.max(1, Number(m.clock ?? DEFAULTS.clock) || DEFAULTS.clock);
        await card(box("#b05a3a", `🐺 <b>${esc(m.label)}</b>${toDoc ? ` at <b>${esc(hexName(toDoc))}</b>` : ""} — ${esc(faction?.name || "the party")} rides on. The locals will remember. <span style="opacity:.75">The bill comes due in ${clock} turn${clock === 1 ? "" : "s"}; the hex carries the Menace state until someone deals with it.</span>`));
      } else {
        await political(factionId, m.helpTags || DEFAULTS.helpTags, src);
        try { if (ctx && typeof ctx === "object") ctx.__menace = { key: m.key || beatId, beatId, hexUuid: toDoc?.uuid || null, scale: scale.scale }; } catch (_e) {}
      }
    } catch (e) { warn("gateEncounter failed (beat runs as before)", e); }
    return out;
  }

  // ── the clock: bills at bbttcc:advanceTurn:end, reminders on every leg ────
  async function tick({ turn = null } = {}) {
    const out = { billed: 0 };
    if (!isGM() || !enabled()) return out;
    const now = Number.isFinite(Number(turn)) ? Number(turn) : worldTurn();
    for (const d of Array.from(allHexDocs())) {
      const rows = list(d); if (!rows.length) continue;
      let dirty = false; const next = rows.map(r => Object.assign({}, r));
      for (const r of next) {
        if (r.overdue) continue;
        if (now < Number(r.dueTurn || 0)) continue;
        r.overdue = true; dirty = true; out.billed++;
        const m = menaceOf(beatOf(r.campaignId, r.beatId)) || {};
        const dl = await bumpHexLoyalty(d, m.billLoyalty ?? DEFAULTS.billLoyalty, `The ${r.label} at ${hexName(d)} went unanswered.`);
        const dd = await factionDarkness(r.factionId || hexFlags(d).factionId, m.billDarkness ?? DEFAULTS.billDarkness, `Menace unanswered: ${r.label}`);
        const fx = [dl ? `hex loyalty ${dl}` : null, dd ? `darkness +${dd}` : null].filter(Boolean).join(" · ");
        await card(box("#8b2d2d", `🐺 <b>${esc(r.label)}</b> at <b>${esc(hexName(d))}</b> has had its way. Nobody came.${fx ? `<div style="opacity:.8;font-size:.92em;margin-top:.2em">${esc(fx)}</div>` : ""}<div style="opacity:.7;font-size:.85em;margin-top:.2em">The Menace state stays on the hex until it is dealt with.</div>`));
      }
      if (dirty) await writeRows(d, next);
    }
    return out;
  }
  Hooks.on("bbttcc:advanceTurn:end", (t) => { try { if (!t || t.apply !== true || !isGM()) return; tick({}).then(r => { if (r.billed) log("menaces billed:", r.billed); }).catch(e => warn("tick failed", e)); } catch (_e) {} });

  const REMINDED = new Map();   // hexUuid → turn
  Hooks.on("bbttcc:afterTravel", async (ctx) => {
    try {
      if (!isGM() || !enabled()) return;
      const toDoc = await resolveHex(ctx?.to || null); if (!toDoc) return;
      const rows = list(toDoc); if (!rows.length) return;
      const encBeat = String(ctx?.encounter?.beatId || ""); if (encBeat && rows.some(r => String(r.beatId) === encBeat)) return;   // the menace itself is on the card
      const now = worldTurn(); if (REMINDED.get(toDoc.uuid) === now) return; REMINDED.set(toDoc.uuid, now);
      const who = hexIsSettled(toDoc) ? `The folk of ${hexName(toDoc)}` : "The road";
      const lines = rows.map(r => { const left = Number(r.dueTurn || 0) - now; return `<b>${esc(r.label)}</b> ${r.overdue ? "<span style=\"color:#e57373\">(overdue)</span>" : `(${left} turn${left === 1 ? "" : "s"} left)`}`; });
      await card(box("#c9a227", `🐺 <i>${esc(who)}</i> ${hexIsSettled(toDoc) ? "remind you" : "says it plainly"}: ${lines.join(", ")} still ${rows.length === 1 ? "works" : "work"} <b>${esc(hexName(toDoc))}</b>.`));
    } catch (e) { warn("reminder failed", e); }
  });

  // ── publish ────────────────────────────────────────────────────────────────
  // Publish at init AND ready (2026-10-21 live fix): a classic script parses before Foundry builds the real `game`
  // object, so anything hung on `game` at parse time is lost. Hooks registered above survive (global Hooks registry).
  const API = { partyScale, entryScaleOk, list, find, add, clear, gateEncounter, tick, enabled, DEFAULTS, STATE_NAME, resolveHex };
  const publish = () => { try { game.bbttcc = game.bbttcc || {}; game.bbttcc.api = game.bbttcc.api || {}; game.bbttcc.api.travel = game.bbttcc.api.travel || {}; game.bbttcc.api.travel.menace = API; } catch (e) { warn("publish failed", e); } };
  Hooks.once("init", publish);
  Hooks.once("setup", publish);
  Hooks.once("ready", publish);
  log("loaded (party scale · warning cards · hex menace state) — API publishes at init/setup/ready");
})();
