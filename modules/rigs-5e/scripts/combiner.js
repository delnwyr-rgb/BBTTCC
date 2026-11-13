/* ─────────────────────────────────────────────────────────────────────────────
 * rigs-5e · combiner.js — COMBINING RIGS (Legansus Tal, Dave 2026-11-12/13)
 * ─────────────────────────────────────────────────────────────────────────────
 * Several component rigs merge into one titan rig and split apart again.
 *
 *   titan.flags.rigs-5e.combiner = {
 *     name, parts: [{ key, label, rigId, role }],      // role = the titan station that part's pilot takes
 *     formed: false, sceneId, tokenId,                    // while formed: where the titan stands
 *     joined: [{ key, rigId, tokenId, crew: [actorId…] }] // which parts went in, and who rode them
 *   }
 *   part.flags.rigs-5e.combinerPart = { titanId, key }
 *
 * COMBINE (on the GM seat; players ask through gmExec "rigs.combine"): every part token on the scene slides into
 * the centroid on a beam of light, the crews step out of their vehicles, the vehicles vanish into the titan, the
 * titan stands up where they met and each pilot is seated at their part's station; everyone sees a screen-wide
 * moment card + hears the sting. SPLIT reverses it: the titan's crew step off, the vehicles burst out in a ring
 * around it with their OWN pre-merge damage, each pilot back in their own cockpit, the titan folds away.
 * The titan's hull is its own (merge rule: "Merge into one titan", Dave 11-12).
 *
 * UI: the floating rig bar (actions.js renderRigBar → barHTML / wireBar) shows ⚡ FORM <name> on a part and
 * ✂ SEPARATE on the titan; the token HUD shows the same for a GM. API: game.rigs5e.combiner.{combine, split,
 * status, titanOf, isTitan, isPart}.
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  if (globalThis.__rigs5eCombiner) return;
  globalThis.__rigs5eCombiner = true;
  const TAG = "[rigs-5e/combiner]";
  const SCOPE = "rigs-5e";
  const CHANNEL = `module.${SCOPE}`;
  const R = () => game.bbttcc?.rigs;
  const I = () => R()?.impl ?? {};
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const cfgOf = (titan) => titan?.flags?.[SCOPE]?.combiner ?? null;
  const partOf = (rig) => rig?.flags?.[SCOPE]?.combinerPart ?? null;
  const isTitan = (a) => !!cfgOf(a)?.parts?.length;
  const isPart = (a) => !!partOf(a)?.titanId;
  function titanOf(a) {
    if (isTitan(a)) return a;
    const p = partOf(a);
    return p?.titanId ? game.actors.get(p.titanId) ?? null : null;
  }
  const seated = (rig) => (R()?.data?.(rig)?.crew?.slots ?? []).map(s => s.actorId).filter(Boolean);
  const visibleToken = (scene, actor) => scene?.tokens?.find(t => t.actorId === actor.id && !t.hidden) ?? null;

  // ── Spectacle: VFX (Sequencer syncs to every client) + the moment card / sting (socket) ──
  const fxKey = (...keys) => { for (const k of keys) { try { if (Sequencer?.Database?.entryExists?.(k)) return k; } catch (_e) {} } return null; };
  function beams(fromTokens, center) {
    try {
      if (!globalThis.Sequence || !game.modules.get("sequencer")?.active) return;
      const beam = fxKey("jb2a.energy_beam.normal.bluepink.03", "jb2a.energy_beam.normal.blue.01", "jb2a.energy_strands.range.standard.blue", "jb2a.chain_lightning.primary.blue");
      const glow = fxKey("jb2a.token_border.circle.spinning.blue.001", "jb2a.extras.tmfx.outpulse.circle.01.normal");
      const seq = new Sequence({ moduleName: SCOPE, softFail: true });
      for (const t of fromTokens) {
        if (glow) seq.effect().file(glow).atLocation(t).scaleToObject(1.8).duration(2600).fadeIn(200).fadeOut(400);
        if (beam) seq.effect().file(beam).atLocation(t).stretchTo(center).duration(2400).fadeIn(200).fadeOut(500);
      }
      seq.play();
    } catch (e) { console.warn(TAG, "beam fx failed", e); }
  }
  function burst(center, big = true) {
    try {
      if (!globalThis.Sequence || !game.modules.get("sequencer")?.active) return;
      const seq = new Sequence({ moduleName: SCOPE, softFail: true });
      const a = fxKey("jb2a.explosion.04.blue", "jb2a.explosion.01.blue", "jb2a.impact.ground_crack.01.blue");
      const b = fxKey("jb2a.particle_burst.01.star.yellow", "jb2a.twinkling_stars.points04.white");
      const c = fxKey("jb2a.impact.ground_crack.01.blue", "jb2a.impact.ground_crack.01.orange");
      if (a) seq.effect().file(a).atLocation(center).scale(big ? 3.2 : 1.8);
      if (b) seq.effect().file(b).atLocation(center).scale(big ? 4 : 2).delay(150);
      if (c && big) seq.effect().file(c).atLocation(center).scale(2.6).belowTokens().delay(250);
      seq.play();
    } catch (e) { console.warn(TAG, "burst fx failed", e); }
  }

  let actx = null;
  function sting(kind) {
    try {
      actx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume().catch(() => {});
      const ac = actx, out = ac.createGain(); out.gain.value = 0.6; out.connect(ac.destination);
      const t0 = ac.currentTime + 0.03;
      const tone = (f0, f1, t, d, peak, type = "sawtooth") => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
        o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + d);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
      };
      if (kind === "combine") {
        tone(55, 110, t0, 1.6, 0.4, "sine");                                   // the rising engine swell
        [196, 247, 294, 392, 494, 587].forEach((f, i) => tone(f, null, t0 + 0.35 + i * 0.16, 0.7, 0.07));   // the parts locking in
        [392, 494, 587, 784].forEach(f => tone(f, null, t0 + 1.45, 2.4, 0.09, "triangle"));                   // the titan stands
        tone(40, 28, t0 + 1.45, 1.8, 0.6, "sine");                             // the landing thump
      } else {
        tone(784, 196, t0, 1.1, 0.08, "triangle"); tone(60, 30, t0, 0.9, 0.4, "sine");
      }
    } catch (_e) {}
  }
  function card({ kind, title, sub }) {
    try {
      let st = document.getElementById("rigs5e-combiner-css");
      if (!st) {
        st = document.createElement("style"); st.id = "rigs5e-combiner-css";
        st.textContent = `
.rigs5e-moment{position:fixed;inset:0;z-index:100003;pointer-events:none;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(ellipse at center,rgba(40,90,180,.35),rgba(0,0,0,.65) 70%);opacity:0;transition:opacity .4s}
.rigs5e-moment.show{opacity:1}
.rigs5e-moment .t{font:900 clamp(48px,9vw,140px)/1 "Signika",Arial,sans-serif;letter-spacing:.14em;color:#fff;text-align:center;
  text-shadow:0 0 18px #6ab0ff,0 0 42px #3a7bff,0 0 90px #b07bff,0 4px 6px #000;transform:scale(.6);transition:transform 1.1s cubic-bezier(.2,.9,.25,1.2)}
.rigs5e-moment.show .t{transform:scale(1)}
.rigs5e-moment .s{margin-top:.6rem;font:700 clamp(14px,1.8vw,26px)/1.2 "Signika",Arial,sans-serif;letter-spacing:.35em;color:#cfe3ff;text-align:center;text-transform:uppercase;text-shadow:0 0 10px #3a7bff,0 2px 3px #000}
.rigs5e-moment.split .t{font-size:clamp(32px,6vw,90px);text-shadow:0 0 14px #ffd36a,0 0 40px #ff9a3a,0 3px 5px #000}`;
        document.head.appendChild(st);
      }
      const n = document.createElement("div");
      n.className = `rigs5e-moment ${kind}`;
      n.innerHTML = `<div><div class="t">${esc(title)}</div><div class="s">${esc(sub ?? "")}</div></div>`;
      document.body.appendChild(n);
      void n.offsetWidth; n.classList.add("show");
      setTimeout(() => n.classList.remove("show"), kind === "combine" ? 3600 : 2200);
      setTimeout(() => n.remove(), kind === "combine" ? 4200 : 2800);
    } catch (e) { console.warn(TAG, "moment card failed", e); }
  }
  function moment(m) { card(m); sting(m.kind); try { game.socket.emit(CHANNEL, { op: "combiner-moment", m }); } catch (_e) {} }

  // ── COMBINE ────────────────────────────────────────────────────────────────
  async function combine(anyPart, { sceneId = null, by = null } = {}) {
    if (!game.user.isGM) return gm("rigs.combine", { actorId: anyPart?.id, sceneId: sceneId ?? canvas?.scene?.id });
    const titan = titanOf(anyPart);
    const cfg = cfgOf(titan);
    if (!titan || !cfg) throw new Error("That rig isn't part of a combining titan.");
    if (cfg.formed) throw new Error(`${titan.name} is already formed.`);
    const scene = game.scenes.get(sceneId) ?? canvas?.scene;
    if (!scene) throw new Error("No scene.");
    const present = cfg.parts.map(p => {
      const rig = game.actors.get(p.rigId); const tok = rig ? visibleToken(scene, rig) : null;
      return rig && tok ? { ...p, rig, tok } : null;
    }).filter(Boolean);
    if (present.length < 2) throw new Error(`Bring at least two of ${titan.name}'s vehicles onto the scene to combine (${present.length} here).`);
    const gs = scene.grid.size;
    const cx = present.reduce((s, p) => s + p.tok.x + p.tok.width * gs / 2, 0) / present.length;
    const cy = present.reduce((s, p) => s + p.tok.y + p.tok.height * gs / 2, 0) / present.length;
    const center = { x: cx, y: cy };
    const joined = present.map(p => ({ key: p.key, rigId: p.rig.id, tokenId: p.tok.id, crew: seated(p.rig) }));
    const all = cfg.parts.length === present.length;

    // 1) the converge: beams + the vehicles slide into the centre
    beams(present.map(p => p.tok.object).filter(Boolean), center);
    await scene.updateEmbeddedDocuments("Token", present.map(p => ({ _id: p.tok.id, x: Math.round(cx - p.tok.width * gs / 2), y: Math.round(cy - p.tok.height * gs / 2) })), { animation: { duration: 1800 } });
    await sleep(1900);
    // 2) crews step out of their cockpits (no auto-park chatter matters — the vehicles are going inside)
    for (const j of joined) for (const id of j.crew) { const a = game.actors.get(id); if (a) { try { await R().disembark(a); } catch (e) { console.warn(TAG, "disembark failed", a.name, e); } } }
    // 3) the vehicles vanish into the titan; the titan stands up where they met
    await scene.updateEmbeddedDocuments("Token", present.map(p => ({ _id: p.tok.id, hidden: true })));
    const proto = (await titan.getTokenDocument({ hidden: false })).toObject(); delete proto._id;
    let tt = scene.tokens.find(t => t.actorId === titan.id);
    const tx = Math.round(cx - (proto.width ?? 8) * gs / 2), ty = Math.round(cy - (proto.height ?? 8) * gs / 2);
    if (tt) await tt.update({ x: tx, y: ty, hidden: false }, { animate: false });
    else [tt] = await scene.createEmbeddedDocuments("Token", [{ ...proto, x: tx, y: ty, hidden: false }]);
    burst(center, true);
    moment({ kind: "combine", title: cfg.name ?? titan.name, sub: all ? `${present.length} become one` : `${present.length} of ${cfg.parts.length} join` });
    // 4) seat every pilot at their part's station on the titan
    await titan.update({ [`flags.${SCOPE}.combiner.formed`]: true, [`flags.${SCOPE}.combiner.sceneId`]: scene.id, [`flags.${SCOPE}.combiner.tokenId`]: tt.id,
      [`flags.${SCOPE}.combiner.joined`]: joined, [`flags.${SCOPE}.combiner.complete`]: all });
    try { await R().deploy?.(titan, { sceneId: scene.id, tokenId: tt.id }); } catch (_e) {}
    for (const j of joined) {
      const part = cfg.parts.find(p => p.key === j.key);
      for (const [i, id] of j.crew.entries()) {
        const a = game.actors.get(id); if (!a) continue;
        const role = i === 0 ? (part?.role ?? "crew") : "crew";
        // 11-13: the part's pilot mans that part's titan station (flags.rigs-5e.station.part === part key)
        const station = i === 0 ? (titan.items.find(it => it.flags?.[SCOPE]?.station?.part === j.key)?.id ?? null) : null;
        try { await R().board(a, titan, { role, station }); }
        catch (e) { try { await R().board(a, titan, { role: "crew" }); } catch (e2) { console.warn(TAG, "seat failed", a.name, e2); } }
      }
    }
    await ChatMessage.create({ speaker: { alias: cfg.name ?? titan.name },
      content: `<div class="bbttcc-class-cue" style="border:1px solid #6ab0ff;border-radius:6px;padding:.4rem .6rem"><p style="margin:0;font-weight:800;letter-spacing:.08em">⚡ ${esc(cfg.name ?? titan.name)} — FORMED</p>
        <p style="margin:.2rem 0 0;font-size:.82rem">${present.map(p => `<b>${esc(p.label)}</b>${p.rig ? ` (${esc(game.actors.get(joined.find(j => j.key === p.key)?.crew?.[0])?.name ?? "uncrewed")})` : ""}`).join(" · ")}</p>
        ${all ? "" : `<p style="margin:.2rem 0 0;font-size:.75rem;opacity:.75">Not every part joined — Final Convergence needs all ${cfg.parts.length}.</p>`}</div>` });
    return { ok: true, titanTokenId: tt.id, joined: joined.length, complete: all };
  }

  // ── SPLIT ──────────────────────────────────────────────────────────────────
  async function split(anyPart, { by = null } = {}) {
    if (!game.user.isGM) return gm("rigs.split", { actorId: anyPart?.id });
    const titan = titanOf(anyPart);
    const cfg = cfgOf(titan);
    if (!titan || !cfg?.formed) throw new Error(`${titan?.name ?? "That titan"} isn't formed.`);
    const scene = game.scenes.get(cfg.sceneId) ?? canvas?.scene;
    const tt = scene?.tokens?.get(cfg.tokenId) ?? scene?.tokens?.find(t => t.actorId === titan.id);
    const gs = scene.grid.size;
    const center = tt ? { x: tt.x + tt.width * gs / 2, y: tt.y + tt.height * gs / 2 } : { x: 0, y: 0 };
    const radius = tt ? Math.max(tt.width, tt.height) * gs / 2 + gs * 1.5 : gs * 4;
    // 1) everyone aboard the titan steps off
    const onTitan = seated(titan);
    for (const id of onTitan) { const a = game.actors.get(id); if (a) { try { await R().disembark(a); } catch (e) { console.warn(TAG, "disembark failed", e); } } }
    // 2) the vehicles burst out in a ring around the titan, the titan folds away
    burst(center, false);
    const joined = cfg.joined ?? [];
    const upd = [];
    joined.forEach((j, i) => {
      const t = scene.tokens.get(j.tokenId); if (!t) return;
      const ang = (i / Math.max(1, joined.length)) * Math.PI * 2 - Math.PI / 2;
      upd.push({ _id: t.id, hidden: false, x: Math.round(center.x + Math.cos(ang) * radius - t.width * gs / 2), y: Math.round(center.y + Math.sin(ang) * radius - t.height * gs / 2) });
    });
    // they reappear AT the centre first, then fly out
    await scene.updateEmbeddedDocuments("Token", upd.map(u => { const t = scene.tokens.get(u._id); return { _id: u._id, hidden: false, x: Math.round(center.x - t.width * gs / 2), y: Math.round(center.y - t.height * gs / 2) }; }), { animate: false });
    if (tt) await tt.update({ hidden: true });
    await scene.updateEmbeddedDocuments("Token", upd, { animation: { duration: 1200 } });
    moment({ kind: "split", title: "SEPARATE!", sub: cfg.name ?? titan.name });
    await sleep(1300);
    // 3) each pilot back into their own vehicle (the riders of a part go back to it; anyone else stays on foot)
    for (const j of joined) {
      const rig = game.actors.get(j.rigId); if (!rig) continue;
      for (const [i, id] of (j.crew ?? []).entries()) {
        const a = game.actors.get(id); if (!a) continue;
        try { await R().board(a, rig, { role: i === 0 ? "pilot" : "crew" }); } catch (e) { console.warn(TAG, "re-board failed", a.name, e); }
      }
    }
    try { await R().park?.(titan, {}); } catch (_e) {}
    await titan.update({ [`flags.${SCOPE}.combiner.formed`]: false, [`flags.${SCOPE}.combiner.joined`]: [], [`flags.${SCOPE}.combiner.complete`]: false });
    return { ok: true, released: joined.length };
  }

  function status(a) {
    const titan = titanOf(a); const cfg = cfgOf(titan);
    if (!cfg) return null;
    return { titan, name: cfg.name ?? titan.name, formed: !!cfg.formed, complete: !!cfg.complete, parts: cfg.parts.map(p => ({ ...p, rig: game.actors.get(p.rigId) ?? null })) };
  }

  // ── player seats → GM ──────────────────────────────────────────────────────
  async function gm(type, payload) {
    const gx = game.bbttcc?.api?.gmExec;
    if (!gx?.call) throw new Error("No GM relay.");
    return gx.call(type, payload, { timeoutMs: 30000 });
  }
  function mayDrive(userId, titan) {
    const u = game.users.get(userId); if (!u) return false;
    if (u.isGM) return true;
    const cfg = cfgOf(titan); if (!cfg) return false;
    // a player may combine / split when they own a character seated in any part — or in the titan
    const rigs = [titan, ...cfg.parts.map(p => game.actors.get(p.rigId)).filter(Boolean)];
    return rigs.some(r => seated(r).some(id => game.actors.get(id)?.testUserPermission?.(u, "OWNER")));
  }

  // ── UI: rig bar buttons + token HUD ───────────────────────────────────────
  function barHTML(rig) {
    const s = status(rig); if (!s) return "";
    const style = "width:auto;padding:.15rem .55rem;font-size:.72rem;font-weight:800;letter-spacing:.06em;border-radius:4px;cursor:pointer;";
    if (isPart(rig) && !s.formed) return `<button type="button" data-rig-combine style="${style}border:1px solid #6ab0ff;background:linear-gradient(90deg,#123a7a,#5a2a8a);color:#fff">⚡ FORM ${esc(s.name.toUpperCase())}</button>`;
    if (isTitan(rig) && s.formed) return `<button type="button" data-rig-split style="${style}border:1px solid #ffd36a;background:rgba(60,40,10,.92);color:#ffe7a8">✂ SEPARATE</button>`;
    return "";
  }
  function wireBar(bar, rig) {
    bar.querySelector("[data-rig-combine]")?.addEventListener("click", () => combine(rig, { sceneId: canvas?.scene?.id }).catch(e => ui.notifications.warn(String(e?.message ?? e))));
    bar.querySelector("[data-rig-split]")?.addEventListener("click", () => split(rig).catch(e => ui.notifications.warn(String(e?.message ?? e))));
  }
  function installHud() {
    Hooks.on("renderTokenHUD", (hud, html) => {
      try {
        if (!game.user.isGM) return;
        const root = html instanceof HTMLElement ? html : html?.[0];
        const actor = hud?.object?.actor; if (!root || !actor) return;
        const s = status(actor); if (!s) return;
        const col = root.querySelector(".col.right") ?? root;
        const add = (label, title, fn) => { const d = document.createElement("div"); d.className = "control-icon rigs5e-combiner-hud"; d.title = title; d.textContent = label; d.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer"; d.addEventListener("click", (ev) => { ev.stopPropagation(); Promise.resolve(fn()).catch(e => ui.notifications.warn(String(e?.message ?? e))); }); col.appendChild(d); };
        if (!s.formed && (isPart(actor) || isTitan(actor))) add("⚡", `Form ${s.name}`, () => combine(actor, { sceneId: canvas?.scene?.id }));
        if (s.formed && isTitan(actor)) add("✂", `Separate ${s.name}`, () => split(actor));
      } catch (e) { console.warn(TAG, "HUD failed", e); }
    });
  }

  Hooks.once("ready", () => {
    if (game.system?.id !== "dnd5e") return;
    game.rigs5e = Object.assign(game.rigs5e ?? {}, { combiner: { combine, split, status, titanOf, isTitan, isPart, barHTML, wireBar, moment } });
    game.socket?.on?.(CHANNEL, (msg) => {
      if (msg?.op !== "combiner-moment" || !msg.m) return;
      if (msg.m.title) card(msg.m);
      if (msg.m.kind === "combine" || msg.m.kind === "split") sting(msg.m.kind);
    });
    const gx = game.bbttcc?.api?.gmExec;
    gx?.register?.("rigs.combine", async ({ actorId, sceneId } = {}, meta = {}) => {
      const a = game.actors.get(String(actorId ?? "")); const titan = titanOf(a);
      if (!titan) throw new Error("not a combining rig");
      if (!mayDrive(meta.fromUserId, titan)) throw new Error("Only someone riding one of its vehicles can call the combine.");
      return combine(titan, { sceneId, by: meta.fromUserName });
    });
    gx?.register?.("rigs.split", async ({ actorId } = {}, meta = {}) => {
      const a = game.actors.get(String(actorId ?? "")); const titan = titanOf(a);
      if (!titan) throw new Error("not a combining rig");
      if (!mayDrive(meta.fromUserId, titan)) throw new Error("Only its crew can call the split.");
      return split(titan, { by: meta.fromUserName });
    });
    installHud();
    // FINAL CONVERGENCE (flags.rigs-5e.requiresComplete): only when every part joined the formed titan.
    Hooks.on("dnd5e.preUseActivity", (activity) => {
      const item = activity?.item;
      if (!item?.flags?.[SCOPE]?.requiresComplete) return;
      const cfg = cfgOf(item.actor);
      if (cfg?.formed && cfg?.complete) return;
      ui.notifications.warn(`${item.name}: all ${cfg?.parts?.length ?? "the"} parts must be joined — ${cfg?.formed ? "not every vehicle combined" : `${item.actor?.name ?? "the titan"} isn't formed`}.`);
      return false;
    });
    console.log(TAG, "combiner ready (game.rigs5e.combiner)");
  });
})();
