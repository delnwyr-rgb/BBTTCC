/* Bad Eden — STAGE CUES (2026-10-15)
 *
 * A recorded before/after for a Scene: darkness, every ambient light, every wall, every tile.
 * The GM arranges the scene by hand, snapshots A, re-arranges it, snapshots B — the cue is the
 * diff, and playing it animates the scene from its current state to the target snapshot:
 *   - darkness animates with Foundry's own `animateDarkness` update option
 *   - lights crossfade (color / bright / dim / alpha / luminosity lerp in steps), then switch the rest
 *   - walls are created / deleted / updated at `wallsAt` (start | mid | end of the fade)
 *   - tiles that become visible fade in (hidden:false, alpha 0 → target); hidden ones fade out
 * Every op is a document update, so every seat sees it — no relay. Undo = play the other snapshot
 * (deleted walls come back with their original ids via keepId).
 *
 * Storage: Scene.flags["bbttcc-campaign"].stageCues[key] = { key, label, before, after, opts, lastPlayed }
 *   snapshot = { at, darkness, lights:{id:data}, walls:{id:data}, tiles:{id:data} }
 *   opts     = { fadeMs:2500, wallsAt:"mid" }
 *
 * API (ready): game.bbttcc.api.stage = { snapshot, save, play, undo, remove, list, get, diff, open }
 *   play(sceneRef, key, { direction:"after"|"before", fadeMs?, wallsAt? })
 * Beat effect: worldEffects.stageCue = { key, sceneId?, direction? } (or a list) — world-mutation-engine §2g'.
 * Button: Lighting controls → 🎬 Stage Cues (GM).
 */

const MOD = "bbttcc-campaign";
const FLAG = "stageCues";
const TAG = "[bbttcc-campaign:stage]";
const log = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);
const wait = (ms) => new Promise(r => setTimeout(r, ms));

const DEFAULT_OPTS = { fadeMs: 2500, wallsAt: "mid" };
const STEP_MS = 250;
const LIGHT_LERP_KEYS = ["bright", "dim", "alpha", "luminosity", "attenuation"];

// ---------------------------------------------------------------- scene resolution
function resolveScene(ref) {
  if (!ref) return canvas?.scene ?? null;
  if (ref instanceof Scene) return ref;
  const s = String(ref).trim();
  if (!s) return canvas?.scene ?? null;
  if (s.startsWith("Scene.")) return game.scenes.get(s.slice(6)) ?? null;
  return game.scenes.get(s) ?? game.scenes.getName(s) ?? null;
}

function cuesOf(scene) {
  const raw = scene?.getFlag?.(MOD, FLAG);
  return (raw && typeof raw === "object") ? foundry.utils.deepClone(raw) : {};
}

function slug(s) {
  return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
}

// ---------------------------------------------------------------- snapshots + diff
function snapshot(sceneRef) {
  const scene = resolveScene(sceneRef);
  if (!scene) throw new Error("stage.snapshot: no scene");
  const byId = (coll) => { const o = {}; for (const d of coll.contents) o[d.id] = d.toObject(); return o; };
  return {
    at: Date.now(),
    sceneId: scene.id,
    darkness: Number(scene.environment?.darknessLevel ?? 0),
    lights: byId(scene.lights),
    walls: byId(scene.walls),
    tiles: byId(scene.tiles)
  };
}

function _same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What playing `target` on `scene` would change. Pure. */
function diff(sceneRef, target) {
  const scene = resolveScene(sceneRef);
  if (!scene || !target) return null;
  const out = { darkness: null, lights: { create: [], delete: [], update: [] }, walls: { create: [], delete: [], update: [] }, tiles: { create: [], delete: [], update: [] } };
  const cur = Number(scene.environment?.darknessLevel ?? 0);
  if (Math.abs(cur - Number(target.darkness ?? cur)) > 0.001) out.darkness = { from: cur, to: Number(target.darkness) };
  const pass = (coll, kind) => {
    const want = target[kind] || {};
    const have = {};
    for (const d of coll.contents) have[d.id] = d.toObject();
    for (const id of Object.keys(have)) {
      if (!want[id]) out[kind].delete.push(id);
      else if (!_same(have[id], want[id])) out[kind].update.push(want[id]);
    }
    for (const id of Object.keys(want)) if (!have[id]) out[kind].create.push(want[id]);
  };
  pass(scene.lights, "lights");
  pass(scene.walls, "walls");
  pass(scene.tiles, "tiles");
  return out;
}

function summarize(d) {
  if (!d) return "—";
  const parts = [];
  if (d.darkness) parts.push(`darkness ${d.darkness.from.toFixed(2)} → ${d.darkness.to.toFixed(2)}`);
  for (const kind of ["walls", "lights", "tiles"]) {
    const k = d[kind]; const bits = [];
    if (k.delete.length) bits.push(`−${k.delete.length}`);
    if (k.create.length) bits.push(`+${k.create.length}`);
    if (k.update.length) bits.push(`~${k.update.length}`);
    if (bits.length) parts.push(`${bits.join(" ")} ${kind}`);
  }
  return parts.length ? parts.join(" · ") : "no change";
}

// ---------------------------------------------------------------- lerp helpers
function _lerp(a, b, t) { return a + (b - a) * t; }
function _mixColor(a, b, t) {
  try {
    if (!a && !b) return null;
    if (!a) return b;          // appearing color — switch at the end (caller handles t<1)
    if (!b) return a;
    const ca = foundry.utils.Color.from(a), cb = foundry.utils.Color.from(b);
    return ca.mix(cb, t).toString();
  } catch (_e) { return t >= 1 ? b : a; }
}

function _lightStep(curData, want, t) {
  const u = { _id: want._id };
  const cc = curData.config || {}, wc = want.config || {};
  const cfg = {};
  for (const k of LIGHT_LERP_KEYS) {
    const a = Number(cc[k]), b = Number(wc[k]);
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) cfg[k] = t >= 1 ? b : _lerp(a, b, t);
  }
  if ((cc.color ?? null) !== (wc.color ?? null)) {
    if (cc.color && wc.color) cfg.color = _mixColor(cc.color, wc.color, t);
    else if (t >= 1) cfg.color = wc.color ?? null;
  }
  if (Object.keys(cfg).length) u.config = cfg;
  if (t >= 1) {
    // final step: everything else the snapshot says (animation, angle, hidden, position, flags…)
    const final = foundry.utils.deepClone(want);
    delete final._id;
    foundry.utils.mergeObject(u, final, { inplace: true });
    u.config = foundry.utils.mergeObject(final.config || {}, cfg, { inplace: false });
  }
  return u;
}

// ---------------------------------------------------------------- play
/**
 * Animate `scene` from its current state to cue[direction].
 * @returns {Promise<{ok:boolean, summary:string}>}
 */
async function play(sceneRef, key, options = {}) {
  const scene = resolveScene(sceneRef);
  if (!scene) throw new Error("stage.play: no scene");
  if (!game.user.isGM) throw new Error("stage.play: GM only");
  const cues = cuesOf(scene);
  const cue = cues[key];
  if (!cue) throw new Error(`stage.play: no cue '${key}' on scene '${scene.name}'`);
  const direction = options.direction === "before" ? "before" : "after";
  const target = cue[direction];
  if (!target) throw new Error(`stage.play: cue '${key}' has no '${direction}' snapshot`);
  const opts = { ...DEFAULT_OPTS, ...(cue.opts || {}), ...(options.fadeMs != null ? { fadeMs: options.fadeMs } : {}), ...(options.wallsAt ? { wallsAt: options.wallsAt } : {}) };
  const fadeMs = Math.max(0, Number(opts.fadeMs) || 0);
  const d = diff(scene, target);
  const summary = summarize(d);
  log(`play '${key}' → ${direction} on '${scene.name}': ${summary}`, { fadeMs, wallsAt: opts.wallsAt });
  Hooks.callAll("bbttcc:stage:play", { scene, key, direction, diff: d, opts });

  const jobs = [];

  // darkness — Foundry animates it itself
  if (d.darkness) {
    jobs.push(scene.update({ "environment.darknessLevel": d.darkness.to }, { animateDarkness: fadeMs }));
  }

  // walls — at start / mid / end
  const wallsJob = async () => {
    const at = opts.wallsAt === "start" ? 0 : opts.wallsAt === "end" ? fadeMs : Math.round(fadeMs / 2);
    if (at) await wait(at);
    if (d.walls.delete.length) await scene.deleteEmbeddedDocuments("Wall", d.walls.delete);
    if (d.walls.create.length) await scene.createEmbeddedDocuments("Wall", d.walls.create, { keepId: true });
    if (d.walls.update.length) await scene.updateEmbeddedDocuments("Wall", d.walls.update);
  };
  jobs.push(wallsJob());

  // lights + tiles — stepped crossfade
  const fadeJob = async () => {
    const steps = fadeMs > 0 ? Math.max(1, Math.round(fadeMs / STEP_MS)) : 1;
    // appearing lights: create dark, then ramp like the others
    if (d.lights.create.length) {
      const seed = d.lights.create.map(l => { const c = foundry.utils.deepClone(l); c.config = { ...(c.config || {}), bright: 0, dim: 0 }; return c; });
      await scene.createEmbeddedDocuments("AmbientLight", seed, { keepId: true });
    }
    // appearing tiles: show at alpha 0, then ramp
    const tileShow = d.tiles.update.filter(t => t.hidden === false && scene.tiles.get(t._id)?.hidden === true);
    const tileHide = d.tiles.update.filter(t => t.hidden === true && scene.tiles.get(t._id)?.hidden === false);
    if (d.tiles.create.length) {
      const seed = d.tiles.create.map(t => ({ ...foundry.utils.deepClone(t), alpha: 0, hidden: false }));
      await scene.createEmbeddedDocuments("Tile", seed, { keepId: true });
    }
    if (tileShow.length) await scene.updateEmbeddedDocuments("Tile", tileShow.map(t => ({ _id: t._id, hidden: false, alpha: 0 })));

    const lightTargets = [...d.lights.update, ...d.lights.create];
    const lightStart = {}; for (const l of lightTargets) lightStart[l._id] = scene.lights.get(l._id)?.toObject() || {};
    const tileStart = {}; for (const t of [...d.tiles.update, ...d.tiles.create]) tileStart[t._id] = scene.tiles.get(t._id)?.toObject() || {};

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const lu = lightTargets.map(l => _lightStep(lightStart[l._id], l, t)).filter(u => Object.keys(u).length > 1);
      const tu = [];
      for (const tl of [...d.tiles.update, ...d.tiles.create]) {
        const start = tileStart[tl._id] || {};
        const hiding = tileHide.some(h => h._id === tl._id);
        const showing = tileShow.some(h => h._id === tl._id) || d.tiles.create.some(c => c._id === tl._id);
        const a0 = showing ? 0 : Number(start.alpha ?? 1);
        const a1 = hiding ? 0 : Number(tl.alpha ?? 1);
        if (t < 1) { if (a0 !== a1) tu.push({ _id: tl._id, alpha: _lerp(a0, a1, t) }); }
        else { const final = foundry.utils.deepClone(tl); tu.push(hiding ? { ...final, alpha: Number(tl.alpha ?? 1), hidden: true } : final); }
      }
      if (lu.length) await scene.updateEmbeddedDocuments("AmbientLight", lu);
      if (tu.length) await scene.updateEmbeddedDocuments("Tile", tu);
      if (i < steps) await wait(STEP_MS);
    }
    if (d.lights.delete.length) await scene.deleteEmbeddedDocuments("AmbientLight", d.lights.delete);
    if (d.tiles.delete.length) await scene.deleteEmbeddedDocuments("Tile", d.tiles.delete);
  };
  jobs.push(fadeJob());

  await Promise.all(jobs);
  try {
    await scene.setFlag(MOD, `${FLAG}.${key}.lastPlayed`, { direction, at: Date.now(), by: game.user.name });
  } catch (_e) {}
  Hooks.callAll("bbttcc:stage:played", { scene, key, direction, diff: d });
  ui.notifications?.info?.(`🎬 ${cue.label || key}: ${direction === "after" ? "played" : "undone"} — ${summary}`);
  return { ok: true, summary };
}

async function undo(sceneRef, key, options = {}) {
  return play(sceneRef, key, { ...options, direction: "before" });
}

// ---------------------------------------------------------------- storage
async function save(sceneRef, key, { label, before, after, opts } = {}) {
  const scene = resolveScene(sceneRef);
  if (!scene) throw new Error("stage.save: no scene");
  if (!game.user.isGM) throw new Error("stage.save: GM only");
  key = slug(key || label);
  if (!key) throw new Error("stage.save: a key is required");
  const cues = cuesOf(scene);
  const prev = cues[key] || {};
  const cue = {
    key,
    label: String(label ?? prev.label ?? key),
    before: before ?? prev.before ?? null,
    after: after ?? prev.after ?? null,
    opts: { ...DEFAULT_OPTS, ...(prev.opts || {}), ...(opts || {}) },
    lastPlayed: prev.lastPlayed ?? null,
    updatedAt: Date.now()
  };
  // 🪤 setFlag MERGES nested objects — a re-snapshot would keep stale wall/light ids from the old
  // snapshot. Delete the cue key first, then write it whole (slug keys are dot-path safe).
  if (prev.key) await scene.update({ [`flags.${MOD}.${FLAG}.-=${key}`]: null });
  await scene.update({ [`flags.${MOD}.${FLAG}.${key}`]: cue });
  log(`saved cue '${key}' on '${scene.name}'`);
  return cue;
}

async function remove(sceneRef, key) {
  const scene = resolveScene(sceneRef);
  if (!scene) throw new Error("stage.remove: no scene");
  const cues = cuesOf(scene);
  if (!cues[key]) return false;
  await scene.update({ [`flags.${MOD}.${FLAG}.-=${key}`]: null });
  return true;
}

function list(sceneRef) {
  const scene = resolveScene(sceneRef);
  if (!scene) return [];
  return Object.values(cuesOf(scene)).sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

function get(sceneRef, key) {
  const scene = resolveScene(sceneRef);
  return scene ? (cuesOf(scene)[key] ?? null) : null;
}

/** Every scene that carries cues → [{id, name, keys:[{key,label}]}] (for the Beat Editor). */
function catalog() {
  const out = [];
  for (const s of game.scenes.contents) {
    const cues = cuesOf(s);
    const keys = Object.values(cues).map(c => ({ key: c.key, label: c.label }));
    if (keys.length) out.push({ id: s.id, name: s.name, keys });
  }
  return out;
}

// ---------------------------------------------------------------- the panel
const { ApplicationV2 } = foundry.applications.api;

class StageCuesApp extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-stage-cues",
    classes: ["bbttcc-stage-cues"],
    tag: "div",
    window: { title: "🎬 Stage Cues", icon: "fa-solid fa-clapperboard", resizable: true },
    position: { width: 560, height: "auto" },
    actions: {
      snapA: StageCuesApp.#onSnap,
      snapB: StageCuesApp.#onSnap,
      saveDraft: StageCuesApp.#onSaveDraft,
      play: StageCuesApp.#onPlay,
      undo: StageCuesApp.#onUndo,
      resnapA: StageCuesApp.#onResnap,
      resnapB: StageCuesApp.#onResnap,
      remove: StageCuesApp.#onRemove,
      saveOpts: StageCuesApp.#onSaveOpts
    }
  };

  constructor(scene, options = {}) {
    super(options);
    this.scene = scene;
    this.draft = { label: "", before: null, after: null, fadeMs: DEFAULT_OPTS.fadeMs, wallsAt: DEFAULT_OPTS.wallsAt };
    this.busy = false;
  }

  get title() { return `🎬 Stage Cues — ${this.scene?.name ?? "?"}`; }

  async _prepareContext() {
    const cues = list(this.scene).map(c => ({
      ...c,
      summaryAfter: summarize(c.after ? diff(this.scene, c.after) : null),
      summaryBefore: summarize(c.before ? diff(this.scene, c.before) : null),
      hasA: !!c.before, hasB: !!c.after,
      fadeMs: c.opts?.fadeMs ?? DEFAULT_OPTS.fadeMs, wallsAt: c.opts?.wallsAt ?? DEFAULT_OPTS.wallsAt,
      last: c.lastPlayed ? `${c.lastPlayed.direction === "after" ? "played" : "undone"} ${new Date(c.lastPlayed.at).toLocaleTimeString()}` : ""
    }));
    const dr = this.draft;
    const draftSummary = (dr.before && dr.after) ? summarize(_diffSnapshots(dr.before, dr.after)) : null;
    return { cues, draft: dr, draftSummary, busy: this.busy, sceneName: this.scene?.name };
  }

  async _renderHTML(ctx) {
    const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
    const wallsAtSel = (v, name) => `<select name="${name}" style="width:auto;">${["start", "mid", "end"].map(o => `<option value="${o}" ${o === v ? "selected" : ""}>walls at ${o}</option>`).join("")}</select>`;
    const rows = ctx.cues.map(c => `
      <div class="bbttcc-stage-cue" data-key="${esc(c.key)}" style="border:1px solid #555; border-radius:6px; padding:8px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <b style="flex:1;">${esc(c.label)} <span style="opacity:.6; font-weight:400;">(${esc(c.key)})</span></b>
          <span style="opacity:.7; font-size:11px;">${esc(c.last)}</span>
        </div>
        <div style="font-size:12px; opacity:.85; margin:4px 0;">▶ to B: ${esc(c.summaryAfter)}<br/>⟲ to A: ${esc(c.summaryBefore)}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button type="button" data-action="play" data-key="${esc(c.key)}" ${c.hasB && !ctx.busy ? "" : "disabled"} style="flex:1;">▶ Play (A→B)</button>
          <button type="button" data-action="undo" data-key="${esc(c.key)}" ${c.hasA && !ctx.busy ? "" : "disabled"} style="flex:1;">⟲ Undo (B→A)</button>
          <button type="button" data-action="resnapA" data-key="${esc(c.key)}" title="Re-snapshot A from the scene as it is now">📸 A</button>
          <button type="button" data-action="resnapB" data-key="${esc(c.key)}" title="Re-snapshot B from the scene as it is now">📸 B</button>
          <button type="button" data-action="remove" data-key="${esc(c.key)}" title="Delete this cue" style="color:#e66;">🗑</button>
        </div>
        <div style="display:flex; gap:6px; align-items:center; margin-top:6px; font-size:12px;">
          <label>Fade <input type="number" name="fadeMs" value="${Number(c.fadeMs)}" min="0" step="100" style="width:80px;"/> ms</label>
          ${wallsAtSel(c.wallsAt, "wallsAt")}
          <button type="button" data-action="saveOpts" data-key="${esc(c.key)}">💾 timing</button>
        </div>
      </div>`).join("");

    const dr = ctx.draft;
    return `
      <div style="padding:8px; max-height:70vh; overflow:auto;">
        <p style="margin:0 0 8px; font-size:12px; opacity:.8;">Arrange <b>${esc(ctx.sceneName)}</b> by hand, snapshot <b>A</b>, re-arrange it, snapshot <b>B</b>, save. Playing a cue animates the scene from wherever it is to that snapshot — darkness, lights, walls, tiles — on every seat. Beats fire a cue with <code>worldEffects.stageCue = {key}</code>.</p>
        ${rows || '<p style="opacity:.7;">No cues on this scene yet.</p>'}
        <fieldset style="border:1px dashed #777; border-radius:6px; padding:8px; margin-top:10px;">
          <legend>New cue</legend>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <input type="text" name="draftLabel" value="${esc(dr.label)}" placeholder="Name, e.g. Bridge healed" style="flex:1; min-width:160px;"/>
            <button type="button" data-action="snapA" ${ctx.busy ? "disabled" : ""}>📸 Snapshot A ${dr.before ? "✓" : ""}</button>
            <button type="button" data-action="snapB" ${ctx.busy ? "disabled" : ""}>📸 Snapshot B ${dr.after ? "✓" : ""}</button>
          </div>
          <div style="display:flex; gap:6px; align-items:center; margin-top:6px; font-size:12px;">
            <label>Fade <input type="number" name="draftFadeMs" value="${Number(dr.fadeMs)}" min="0" step="100" style="width:80px;"/> ms</label>
            ${wallsAtSel(dr.wallsAt, "draftWallsAt")}
            <button type="button" data-action="saveDraft" ${dr.before && dr.after && !ctx.busy ? "" : "disabled"} style="flex:1;">💾 Save cue</button>
          </div>
          ${ctx.draftSummary ? `<div style="font-size:12px; opacity:.85; margin-top:6px;">A→B: ${esc(ctx.draftSummary)}</div>` : ""}
        </fieldset>
      </div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  _readDraftInputs() {
    const el = this.element;
    const label = el.querySelector('[name="draftLabel"]')?.value ?? this.draft.label;
    const fadeMs = Number(el.querySelector('[name="draftFadeMs"]')?.value ?? this.draft.fadeMs);
    const wallsAt = el.querySelector('[name="draftWallsAt"]')?.value ?? this.draft.wallsAt;
    this.draft.label = label; this.draft.fadeMs = Number.isFinite(fadeMs) ? fadeMs : DEFAULT_OPTS.fadeMs; this.draft.wallsAt = wallsAt;
  }

  async _run(fn) {
    if (this.busy) return;
    this.busy = true; this.render();
    try { await fn(); }
    catch (e) { console.error(TAG, e); ui.notifications?.error?.(`Stage Cues: ${e.message}`); }
    finally { this.busy = false; this.render(); }
  }

  static #onSnap(_ev, target) {
    this._readDraftInputs();
    const which = target.dataset.action === "snapA" ? "before" : "after";
    this.draft[which] = snapshot(this.scene);
    ui.notifications?.info?.(`📸 Snapshot ${which === "before" ? "A" : "B"} taken (${Object.keys(this.draft[which].walls).length} walls · ${Object.keys(this.draft[which].lights).length} lights · ${Object.keys(this.draft[which].tiles).length} tiles · darkness ${this.draft[which].darkness.toFixed(2)})`);
    this.render();
  }

  static async #onSaveDraft() {
    this._readDraftInputs();
    const dr = this.draft;
    if (!dr.before || !dr.after) return;
    await this._run(async () => {
      await save(this.scene, slug(dr.label), { label: dr.label || slug(dr.label), before: dr.before, after: dr.after, opts: { fadeMs: dr.fadeMs, wallsAt: dr.wallsAt } });
      this.draft = { label: "", before: null, after: null, fadeMs: DEFAULT_OPTS.fadeMs, wallsAt: DEFAULT_OPTS.wallsAt };
    });
  }

  static async #onPlay(_ev, target) { await this._run(() => play(this.scene, target.dataset.key, { direction: "after" })); }
  static async #onUndo(_ev, target) { await this._run(() => play(this.scene, target.dataset.key, { direction: "before" })); }

  static async #onResnap(_ev, target) {
    const which = target.dataset.action === "resnapA" ? "before" : "after";
    const key = target.dataset.key;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Re-snapshot" }, content: `<p>Replace snapshot <b>${which === "before" ? "A" : "B"}</b> of <b>${key}</b> with the scene as it is right now?</p>` });
    if (!ok) return;
    await this._run(() => save(this.scene, key, { [which]: snapshot(this.scene) }));
  }

  static async #onRemove(_ev, target) {
    const key = target.dataset.key;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Delete cue" }, content: `<p>Delete cue <b>${key}</b>? Its snapshots go with it.</p>` });
    if (!ok) return;
    await this._run(() => remove(this.scene, key));
  }

  static async #onSaveOpts(_ev, target) {
    const key = target.dataset.key;
    const row = target.closest(".bbttcc-stage-cue");
    const fadeMs = Number(row?.querySelector('[name="fadeMs"]')?.value);
    const wallsAt = row?.querySelector('[name="wallsAt"]')?.value || DEFAULT_OPTS.wallsAt;
    await this._run(() => save(this.scene, key, { opts: { fadeMs: Number.isFinite(fadeMs) ? fadeMs : DEFAULT_OPTS.fadeMs, wallsAt } }));
  }
}

function _diffSnapshots(a, b) {
  // diff of two snapshots (no live scene) — for the draft summary
  const out = { darkness: null, lights: { create: [], delete: [], update: [] }, walls: { create: [], delete: [], update: [] }, tiles: { create: [], delete: [], update: [] } };
  if (Math.abs(Number(a.darkness) - Number(b.darkness)) > 0.001) out.darkness = { from: Number(a.darkness), to: Number(b.darkness) };
  for (const kind of ["lights", "walls", "tiles"]) {
    const have = a[kind] || {}, want = b[kind] || {};
    for (const id of Object.keys(have)) { if (!want[id]) out[kind].delete.push(id); else if (!_same(have[id], want[id])) out[kind].update.push(want[id]); }
    for (const id of Object.keys(want)) if (!have[id]) out[kind].create.push(want[id]);
  }
  return out;
}

let _app = null;
function open(sceneRef) {
  const scene = resolveScene(sceneRef);
  if (!scene) { ui.notifications?.warn?.("Stage Cues: no scene"); return null; }
  if (!game.user.isGM) { ui.notifications?.warn?.("Stage Cues are GM-only"); return null; }
  if (_app && _app.scene?.id !== scene.id) { try { _app.close(); } catch (_e) {} _app = null; }
  _app = _app || new StageCuesApp(scene);
  _app.render({ force: true });
  return _app;
}

// ---------------------------------------------------------------- wiring
Hooks.on("getSceneControlButtons", (controls) => {
  try {
    const lighting = controls?.lighting;
    if (!lighting?.tools || !game.user?.isGM) return;
    lighting.tools.bbttccStageCues = {
      name: "bbttccStageCues",
      title: "Stage Cues (Bad Eden)",
      icon: "fa-solid fa-clapperboard",
      order: 50,
      button: true,
      visible: true,
      onChange: () => open(canvas?.scene)
    };
  } catch (e) { warn("scene control button failed", e); }
});

// keep the panel honest when the scene changes under it
for (const h of ["createWall", "deleteWall", "updateWall", "createAmbientLight", "deleteAmbientLight", "createTile", "deleteTile", "updateTile", "updateScene"]) {
  Hooks.on(h, () => { if (_app?.rendered && !_app.busy) _app.render(); });
}
Hooks.on("canvasReady", () => { if (_app?.rendered && _app.scene?.id !== canvas.scene?.id) { try { _app.close(); } catch (_e) {} _app = null; } });

Hooks.once("ready", () => {
  game.bbttcc ??= {}; game.bbttcc.api ??= {};
  game.bbttcc.api.stage = { snapshot, save, play, undo, remove, list, get, diff, summarize, catalog, open, resolveScene, DEFAULT_OPTS };
  log("Stage Cues API ready:", Object.keys(game.bbttcc.api.stage));
});

export { snapshot, save, play, undo, remove, list, get, diff, summarize, catalog, open, resolveScene };
