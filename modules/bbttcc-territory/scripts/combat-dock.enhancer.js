// modules/bbttcc-territory/scripts/combat-dock.enhancer.js
// Combat Dock (2026-10-29): one bottom-docked surface that appears by itself
// when a combat the player is in starts, and leaves when it ends.
//
//   · Initiative ribbon — portraits from the current turn onward; yours says
//     "in N"; click a portrait to pan to the token.
//   · Slot pips — Action / Bonus / Reaction + a draining movement bar. A spent
//     slot greys every ability that costs it. Off your turn the dock shrinks to
//     Bonus + Reaction abilities (ruling U4: the Bonus Action is any-time).
//   · ABILITY-FIRST TARGETING — click an ability (or press 1–9/0), THEN click
//     the token. The dock sets the user's targets itself right before firing, so
//     a buff never leaves you targeting yourself for the next attack. Self moves
//     clear targets; harmful-on-ally / out-of-range picks need a second click.
//     Area abilities go straight to the engine's template placer (which now shows
//     a live "N caught" count).
//   · Queued box — held action, Dodge/Disengage/Hidden, sustained manifestations,
//     ⚡ Act Again, Opportunity Strike armed.
//   · Reaction cards — trigger Offers and Attack-of-Opportunity prompts pop above
//     the dock with Take / Pass; they time out to Pass (the chat card still works).
//   · Players: the macro bar hides and the sidebar folds while the dock is up
//     (the ☰ button brings them back).
//
// It fires everything through the player HUD's own paths
// (game.bbttcc.playerHud.fire.*) and the system's combat moves
// (game.fourththing.combatActions) — no second copy of any rules.

(() => {
  const TAG = "[bbttcc-ui/combat-dock]";
  const MOD = "bbttcc-territory";
  const DOCK_ID = "bbttcc-combat-dock";
  const BANNER_ID = "bbttcc-dock-banner";
  const REACT_ID = "bbttcc-dock-reactions";
  const LOG_ID = "bbttcc-dock-log";
  const warn = (...a) => console.warn(TAG, ...a);
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const IS_5E = () => game.system?.id === "dnd5e";
  const hud = () => game.bbttcc?.playerHud ?? null;
  const sysOf = (a) => a?.system?.system ?? a?.system ?? {};
  const setting = (k, d) => { try { return game.settings.get(MOD, k); } catch (_e) { return d; } };

  Hooks.once("init", () => {
    game.settings.register(MOD, "combatDock", {
      name: "Combat Dock", hint: "Show the Combat Dock (initiative, abilities, targeting) along the bottom of the screen during combat.",
      scope: "client", config: true, type: Boolean, default: true, onChange: () => render()
    });
    game.settings.register(MOD, "combatDockHideBars", {
      name: "Combat Dock: fold Foundry's bars", hint: "Players: hide the macro bar and fold the sidebar while the Combat Dock is up.",
      scope: "client", config: true, type: Boolean, default: true, onChange: () => render()
    });
    game.settings.register(MOD, "combatDockReactionSeconds", {
      name: "Combat Dock: reaction card timeout (seconds)", hint: "A reaction card passes on its own after this many seconds. The chat card stays usable.",
      scope: "client", config: true, type: Number, default: 8, range: { min: 3, max: 30, step: 1 }
    });
  });

  // ── Who the dock drives ────────────────────────────────────────────────
  // Players: their Steward (same resolver as the HUD). GM: the current
  // combatant when no player owns it (monsters), else the controlled token.
  function combatHere() {
    const c = game.combat;
    if (!c?.started) return null;
    if (c.scene && canvas?.scene && c.scene.id !== canvas.scene.id) return null;
    return c;
  }
  function subject() {
    const c = combatHere(); if (!c) return null;
    if (game.user.isGM) {
      const cur = c.combatant;
      if (cur?.actor && !cur.actor.hasPlayerOwner) return { actor: cur.actor, token: cur.token?.object ?? null, combatant: cur };
      const ctl = canvas.tokens?.controlled?.at(-1);
      if (ctl?.actor) return { actor: ctl.actor, token: ctl, combatant: c.combatants.find(x => x.tokenId === ctl.id) ?? null };
      return cur?.actor ? { actor: cur.actor, token: cur.token?.object ?? null, combatant: cur } : null;
    }
    const st = hud()?.getSteward?.();
    if (!st) return null;
    const cb = c.combatants.find(x => x.actorId === st.id);
    if (!cb) return null;
    return { actor: st, token: cb.token?.object ?? st.getActiveTokens?.()[0] ?? null, combatant: cb };
  }
  const isMyTurn = (s) => !!(s?.combatant && game.combat?.combatant?.id === s.combatant.id);

  // ── Slots ──────────────────────────────────────────────────────────────
  const SLOT_KEY = { action: "actionUsed", bonus: "bonusUsed", reaction: "reactionUsed" };
  const slotSpent = (actor, cost) => !IS_5E() && !!SLOT_KEY[cost] && !!sysOf(actor).actions?.[SLOT_KEY[cost]];
  const normCost = (v) => {
    const s = String(v ?? "").toLowerCase();
    if (s.startsWith("bonus")) return "bonus";
    if (s.startsWith("reaction")) return "reaction";
    if (s === "action" || s === "actionused") return "action";
    return null;
  };

  // What the ENGINE charges for an item (game.fourththing.actionCostOf, 10-29) — the same
  // resolution the fire paths gate on. Older system: fall back to the item's own fields.
  const engineCost = (it, fallback = null) => {
    try {
      const fn = game.fourththing?.actionCostOf;
      if (typeof fn === "function") { const c = fn(it); return c === "mixed" ? "mixed" : (normCost(c) ?? (c === "free" ? "free" : null)); }
    } catch (_e) {}
    return fallback;
  };
  const economyOn = () => { try { return game.settings.get("fourththing", "actionEconomy") === true; } catch (_e) { return false; } };

  // ── Entries: everything the dock can fire, with cost + aim + range ─────
  // aim: foe | ally | any (pick or "No target") | self | area (engine template) | none
  const RANGE_BASE = { self: 0, touch: 5, near: 30, far: 60, sight: 120, hex: 300 };
  const gridFt = () => Number(canvas?.grid?.distance) || 5;

  function strikeEntry(it, kind = "strike") {
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    const sq = Math.max(Number(sys.range?.short) || 0, Number(sys.range?.long) || 0) || 1;
    const area = mf.area?.shape && mf.area.shape !== "none";
    return { kind, item: it, label: it.name, icon: hud()?.abilityIcon?.(it) ?? "khanda",
      cost: engineCost(it, normCost(mf.activation?.type) ?? "action"), aim: area ? "area" : "foe", rangeFt: sq * gridFt() };
  }
  function powerEntry(it) {
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    const tgt = String(sys.target ?? "single");
    const op = String(sys.damageRoll?.op ?? "");
    let aim = "foe";
    if (tgt === "self" || sys.range === "self") aim = "self";
    else if (mf.area?.shape && mf.area.shape !== "none") aim = "area";
    else if (tgt === "faction") aim = "none";
    else if (tgt === "burst" || tgt === "area") aim = "any";
    else if (op === "heal") aim = "ally";
    else if (op !== "damage") aim = "any";
    const rangeFt = Number(mf.rangeFt) || RANGE_BASE[sys.range] || 30;
    const act = String(sys.activation ?? mf.activation?.type ?? "action");
    return { kind: "mani", item: it, label: it.name, icon: "wand-magic-sparkles",
      cost: engineCost(it, normCost(act)), ritual: act === "ritual", aim, rangeFt };
  }
  function featureEntry(it) {
    return { kind: "ability", item: it, label: it.name, icon: hud()?.abilityIcon?.(it) ?? "bolt",
      cost: engineCost(it, normCost(it.system?.activation?.type ?? it.system?.activation)), aim: "any", rangeFt: 0 };
  }
  function entry5e(it, kind) {
    let cost = null, aim = "any", rangeFt = 0;
    try {
      const act = it.system?.activities?.contents?.[0] ?? Array.from(it.system?.activities ?? [])[0];
      cost = normCost(act?.activation?.type);
      const T = act?.target ?? {};
      if (T.template?.type) aim = "area";
      else if (T.affects?.type === "self" || act?.range?.units === "self") aim = "self";
      else if (act?.type === "heal") aim = "ally";
      else if (["attack", "damage", "save"].includes(act?.type)) aim = "foe";
      rangeFt = Number(act?.range?.value) || Number(it.system?.range?.value) || (act?.range?.units === "touch" ? 5 : 0);
      if (!rangeFt && act?.type === "attack") rangeFt = Number(it.system?.range?.reach) || 5;
    } catch (_e) {}
    return { kind: "use5e", item: it, label: it.name, icon: hud()?.abilityIcon?.(it) ?? "bolt", cost, aim, rangeFt, group: kind };
  }

  function buildGroups(actor) {
    const H = hud(); if (!H || !actor) return [];
    const groups = [];
    if (IS_5E()) {
      const s = H.collectSections5e?.(actor) ?? {};
      if (s.strikes?.length) groups.push({ id: "strike", label: "Strike", entries: s.strikes.map(i => entry5e(i)) });
      if (s.spells?.length) groups.push({ id: "mani", label: "Spells", entries: s.spells.map(i => entry5e(i)) });
      const ab = [...(s.abilities ?? []), ...(s.ancestry ?? [])];
      if (ab.length) groups.push({ id: "ability", label: "Abilities", entries: ab.map(i => entry5e(i)) });
      return groups;
    }
    const s = H.collectSections?.(actor) ?? {};
    if (s.strikes?.length) groups.push({ id: "strike", label: "Strike", entries: s.strikes.map(i => strikeEntry(i)) });
    if (s.manifs?.length) groups.push({ id: "mani", label: "Invoke", entries: s.manifs.map(i => i.type === "power" ? powerEntry(i) : strikeEntry(i)) });
    const ab = [...(s.abilities ?? []), ...(s.ancestry ?? [])];
    const defs = game.fourththing?.combatActions?.defs ?? {};
    const moves = Object.entries(defs).map(([key, d]) => ({
      kind: "move", key, label: d.label, emoji: d.icon, tip: d.desc,
      cost: normCost(d.cost), aim: key === "aid" ? "ally" : "self", rangeFt: key === "aid" ? 5 : 0
    }));
    if (moves.length) groups.push({ id: "move", label: "Moves", entries: moves });
    if (ab.length) groups.push({ id: "ability", label: "Abilities", entries: ab.map(featureEntry) });   // the long list goes last
    return groups;
  }

  // ── Targets ────────────────────────────────────────────────────────────
  function setTargets(tokens) {
    const toks = (tokens ?? []).filter(Boolean);
    const fn = game.fourththing?.setUserTargets;
    if (typeof fn === "function") return fn(toks);
    try {
      if (typeof canvas?.tokens?.setTargets === "function") return canvas.tokens.setTargets(toks.map(t => t.id), { mode: "replace" });
      for (const t of Array.from(game.user.targets)) t.setTarget(false, { releaseOthers: false, groupSelection: true });
      for (const t of toks) t.setTarget(true, { releaseOthers: false, groupSelection: true });
    } catch (e) { warn("setTargets failed", e); }
  }
  function relation(src, tok) {
    if (!src || !tok) return "foe";
    if (tok.id === src.id || (tok.actor && src.actor && tok.actor === src.actor)) return "self";
    const a = src.document?.disposition ?? 1, b = tok.document?.disposition ?? 0;
    if (b === 0) return "neutral";
    return (a >= 0) === (b >= 0) ? "ally" : "foe";
  }
  function distFt(a, b) {
    if (!a || !b) return 0;
    try { const r = canvas.grid.measurePath([a.center, b.center]); if (Number.isFinite(r?.distance)) return r.distance; } catch (_e) {}
    return Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) / canvas.grid.size * gridFt();
  }
  // Big tokens: measure to the edge, not the centre.
  function inRange(src, tok, rangeFt) {
    if (!rangeFt) return true;
    const sizeSlack = (t) => Math.max(0, (Math.max(t.document?.width ?? 1, t.document?.height ?? 1) - 1)) * gridFt() / 2;
    return distFt(src, tok) <= rangeFt + sizeSlack(src) + sizeSlack(tok) + 0.01;
  }
  function targetLineHTML(s) {
    const tg = Array.from(game.user.targets ?? []);
    if (!tg.length) return `<span class="cd-tgt-none"><i class="fas fa-crosshairs"></i> No target — pick an ability, then click a token</span>`;
    return `<i class="fas fa-crosshairs"></i> ` + tg.slice(0, 4).map(t => {
      const rel = relation(s?.token, t);
      const d = s?.token ? Math.round(distFt(s.token, t)) : null;
      return `<span class="cd-tgt is-${rel}">${esc(t.name)}${d != null && rel !== "self" ? ` · ${d} ft` : ""}${rel === "self" ? " (you)" : ""}</span>`;
    }).join(" ") + (tg.length > 4 ? ` +${tg.length - 4}` : "");
  }

  // ── Targeting mode ─────────────────────────────────────────────────────
  let _aim = null; // { entry, s, picked:Set<id>, confirm:id|null, gfx, hoverId, cleanup }

  function aimPrompt(e) {
    return { foe: "click a foe", ally: "click an ally", any: "click a target" }[e.aim] ?? "click a target";
  }
  function drawAim() {
    const A = _aim; if (!A?.gfx) return;
    const g = A.gfx; g.clear();
    const src = A.s.token; if (!src) return;
    const pxPerFt = canvas.grid.size / gridFt();
    if (A.entry.rangeFt) {
      const r = A.entry.rangeFt * pxPerFt + (Math.max(src.document.width, src.document.height) * canvas.grid.size) / 2;
      g.lineStyle(3, 0xd6b26a, 0.75).beginFill(0xd6b26a, 0.05).drawCircle(src.center.x, src.center.y, r).endFill();
    }
    for (const t of canvas.tokens.placeables) {
      if (!t.visible || !t.actor || t.id === src.id) continue;
      const rel = relation(src, t);
      const ok = inRange(src, t, A.entry.rangeFt);
      const wanted = A.entry.aim === "foe" ? rel === "foe" : A.entry.aim === "ally" ? rel !== "foe" : true;
      const col = !ok ? 0x777777 : (rel === "foe" ? 0xe05a4a : 0x5ac878);
      const rad = Math.max(t.w, t.h) / 2 + 4;
      const hot = A.hoverId === t.id || A.picked.has(t.id);
      g.lineStyle(hot ? 5 : 2, col, ok && wanted ? 0.95 : 0.35).drawCircle(t.center.x, t.center.y, rad);
    }
  }
  function updateBanner(msg, tone = "") {
    const el = document.getElementById(BANNER_ID); if (!el || !_aim) return;
    const e = _aim.entry;
    el.className = `cd-banner ${tone}`;
    el.innerHTML = `<span class="cd-banner-txt"><i class="fas fa-bullseye"></i> <b>${esc(e.label)}</b> — ${msg ?? `${aimPrompt(e)}${e.rangeFt ? ` (${e.rangeFt} ft)` : ""}`}<span class="cd-banner-sub"> · Shift-click adds more</span></span>
      ${_aim.picked.size ? `<button type="button" data-aim="go"><i class="fas fa-check"></i> Go (${_aim.picked.size}) ↵</button>` : ""}
      ${e.aim === "any" && !_aim.picked.size ? `<button type="button" data-aim="none">No target ↵</button>` : ""}
      <button type="button" data-aim="cancel">Cancel Esc</button>`;
  }
  function tokenAtClient(cx, cy) {
    let pt;
    try { pt = canvas.canvasCoordinatesFromClient?.({ x: cx, y: cy }); } catch (_e) {}
    if (!pt) {
      const r = canvas.app.view.getBoundingClientRect();
      pt = canvas.stage.worldTransform.applyInverse(new PIXI.Point(cx - r.left, cy - r.top));
    }
    const hits = canvas.tokens.placeables.filter(t => t.visible && t.actor && t.bounds?.contains?.(pt.x, pt.y));
    hits.sort((a, b) => (b.document.sort ?? 0) - (a.document.sort ?? 0));
    return hits[0] ?? null;
  }
  function endAim() {
    const A = _aim; _aim = null;
    if (!A) return;
    try { A.cleanup?.(); } catch (_e) {}
    try { A.gfx?.destroy(); } catch (_e) {}
    document.getElementById(BANNER_ID)?.remove();
    render();
  }
  function beginAim(entry, s) {
    endAim();
    if (!canvas?.ready || !s.token) { warn("no token on this scene — firing without aim"); return fire(entry, s, null); }
    const gfx = new PIXI.Graphics();
    (canvas.interface ?? canvas.stage).addChild(gfx);
    _aim = { entry, s, picked: new Set(), confirm: null, gfx, hoverId: null };
    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    document.body.appendChild(banner);
    banner.addEventListener("click", (ev) => {
      const b = ev.target.closest("button[data-aim]"); if (!b) return;
      const act = b.dataset.aim;
      if (act === "cancel") return endAim();
      if (act === "none") return commitAim([]);
      if (act === "go") return commitAim([..._aim.picked].map(id => canvas.tokens.get(id)).filter(Boolean));
    });
    updateBanner(); drawAim();

    const view = canvas.app.view;
    const onDown = (ev) => {
      if (!_aim) return;
      if (ev.button === 2) { ev.preventDefault(); ev.stopImmediatePropagation(); return endAim(); }
      if (ev.button !== 0) return;
      const tok = tokenAtClient(ev.clientX, ev.clientY);
      if (!tok) return; // empty ground: let Foundry pan/select as normal
      ev.preventDefault(); ev.stopImmediatePropagation();
      pickToken(tok, ev.shiftKey);
    };
    const onMove = (ev) => {
      if (!_aim) return;
      const tok = tokenAtClient(ev.clientX, ev.clientY);
      const id = tok?.id ?? null;
      if (id === _aim.hoverId) return;
      _aim.hoverId = id;
      if (tok && tok.id !== s.token.id) {
        const rel = relation(s.token, tok), ok = inRange(s.token, tok, entry.rangeFt);
        updateBanner(`${esc(tok.name)} · ${Math.round(distFt(s.token, tok))} ft ${ok ? "✔ in range" : `✖ out of range (${entry.rangeFt} ft)`}${rel !== "foe" ? ` · ${rel}` : ""}`, ok ? "" : "is-warn");
      } else updateBanner();
      drawAim();
    };
    const onCtx = (ev) => { if (_aim) { ev.preventDefault(); ev.stopImmediatePropagation(); } };
    // Tokens stop taking clicks while aiming — otherwise Foundry also selects the token we picked.
    const tokensInteractive = canvas.tokens.interactiveChildren;
    canvas.tokens.interactiveChildren = false;
    view.addEventListener("pointerdown", onDown, true);
    view.addEventListener("pointermove", onMove, true);
    view.addEventListener("contextmenu", onCtx, true);
    const onPan = () => drawAim();
    Hooks.on("canvasPan", onPan);
    _aim.cleanup = () => {
      view.removeEventListener("pointerdown", onDown, true);
      view.removeEventListener("pointermove", onMove, true);
      view.removeEventListener("contextmenu", onCtx, true);
      Hooks.off("canvasPan", onPan);
      try { canvas.tokens.interactiveChildren = tokensInteractive; } catch (_e) {}
    };
    render();
  }
  function pickToken(tok, add) {
    const A = _aim; if (!A) return;
    const { entry, s } = A;
    const rel = relation(s.token, tok);
    const ok = inRange(s.token, tok, entry.rangeFt);
    const odd = (entry.aim === "foe" && rel !== "foe") || (entry.aim === "ally" && rel === "foe");
    if ((odd || !ok) && A.confirm !== tok.id) {
      A.confirm = tok.id;
      const why = [odd ? (rel === "self" ? "that's you" : rel === "ally" ? "that's an ally" : rel === "neutral" ? "that's a bystander" : "that's a foe") : "", !ok ? `out of range (${Math.round(distFt(s.token, tok))} / ${entry.rangeFt} ft)` : ""].filter(Boolean).join(" and ");
      updateBanner(`⚠ ${esc(tok.name)}: ${why} — click again to use it anyway`, "is-danger");
      return;
    }
    A.confirm = null;
    if (add) {
      A.picked.has(tok.id) ? A.picked.delete(tok.id) : A.picked.add(tok.id);
      updateBanner(); drawAim();
      return;
    }
    A.picked.add(tok.id);
    commitAim([...A.picked].map(id => canvas.tokens.get(id)).filter(Boolean));
  }
  function commitAim(tokens) {
    const A = _aim; if (!A) return;
    const { entry, s } = A;
    endAim();
    fire(entry, s, tokens);
  }

  // ── Fire ───────────────────────────────────────────────────────────────
  async function fire(entry, s, tokens) {
    const H = hud(); const actor = s.actor;
    // The dock owns the target list: what was picked, else nothing at all.
    setTargets(tokens ?? []);
    try {
      switch (entry.kind) {
        case "strike": return await H?.fire?.strike?.(actor, entry.item);
        case "mani":   return await H?.fire?.mani?.(actor, entry.item);
        case "ability":return await H?.fire?.ability?.(actor, entry.item);
        case "use5e":  return await H?.fire?.use5e?.(actor, entry.item);
        case "move":   return await game.fourththing?.combatActions?.perform?.(actor, entry.key);
      }
    } catch (e) { warn(`fire failed: ${entry.label}`, e); ui.notifications?.error?.(`${entry.label}: something went wrong — see console.`); }
  }
  function activate(entry, s) {
    if (entry.ritual) return ui.notifications?.warn?.(`${entry.label} is a ritual — not a combat action.`);
    if (entry.cost && slotSpent(s.actor, entry.cost)) return ui.notifications?.warn?.(`${s.actor.name}: your ${entry.cost === "action" ? "Action" : entry.cost === "bonus" ? "Bonus Action" : "Reaction"} is spent this round.`);
    if (entry.aim === "self" || entry.aim === "none" || entry.aim === "area") return fire(entry, s, []);
    return beginAim(entry, s);
  }

  // ── Movement ring ──────────────────────────────────────────────────────
  let _moveGfx = null;
  function drawMoveRing(s) {
    const show = s && !IS_5E() && isMyTurn(s) && s.token && canvas?.ready;
    if (!show) { try { _moveGfx?.clear(); } catch (_e) {} return; }
    if (!_moveGfx || _moveGfx.destroyed) { _moveGfx = new PIXI.Graphics(); (canvas.interface ?? canvas.stage).addChild(_moveGfx); }
    const a = sysOf(s.actor).actions ?? {};
    const left = Math.max(0, (Number(a.movementBudgetFt) || 0) - (Number(a.movementUsedFt) || 0));
    const g = _moveGfx; g.clear();
    if (!left) return;
    const t = s.token;
    const r = left * canvas.grid.size / gridFt() + Math.max(t.w, t.h) / 2;
    g.lineStyle(2, 0x6ab0d6, 0.7).beginFill(0x6ab0d6, 0.06).drawCircle(t.center.x, t.center.y, r).endFill();
  }

  // ── Fold Foundry's bars (players) ──────────────────────────────────────
  // ☰ flips this for the rest of the combat (null = the default: players fold, GM doesn't).
  let _foldPref = null;
  let _appliedFold = false;       // what's on screen now — act only on a change, so a sidebar
  let _sidebarWasOpen = false;    // the player opens by hand mid-fight isn't folded again
  function sidebarOpen() {
    const sb = ui.sidebar; if (!sb) return false;
    if (typeof sb.expanded === "boolean") return sb.expanded;
    return !sb._collapsed;
  }
  function setSidebar(open) {
    const sb = ui.sidebar; if (!sb) return;
    try {
      if (typeof sb.toggleExpanded === "function") sb.toggleExpanded(open);
      else if (open) sb.expand?.(); else sb.collapse?.();
    } catch (_e) {}
  }
  const wantFold = () => _foldPref ?? (!game.user.isGM && setting("combatDockHideBars", true));
  function applyBars(active) {
    const fold = !!(active && wantFold());
    if (fold === _appliedFold) return;
    _appliedFold = fold;
    document.body.classList.toggle("bbttcc-dock-hidebars", fold);
    if (fold) { _sidebarWasOpen = sidebarOpen(); if (_sidebarWasOpen) setSidebar(false); }
    else if (_sidebarWasOpen || _foldPref === false) { setSidebar(true); _sidebarWasOpen = false; }
  }

  // ── Queued box ─────────────────────────────────────────────────────────
  function queuedChips(actor) {
    if (IS_5E()) return [];
    const f = actor.flags?.fourththing ?? {}, cb = f.combat ?? {}, chips = [];
    if (cb.holding) chips.push({ t: `⏳ Holding: ${cb.holding.trigger ?? "trigger"}` });
    if (cb.dodging) chips.push({ t: "🛡 Dodging" });
    if (cb.disengaged) chips.push({ t: "🚶 Disengaged" });
    if (cb.hidden) chips.push({ t: "🌑 Hidden" });
    for (const m of (f.activeManifestations ?? [])) chips.push({ t: `↻ ${m.itemName}${m.targetName ? ` → ${m.targetName}` : ""}` });
    if (f.actAgainAvailable) chips.push({ t: "⚡ Act Again", act: "actAgain", tip: "Double 10 — click to get your Action back now" });
    if (f.bonusActionAvailable) chips.push({ t: "⚡ Bonus back", act: "bonusAgain", tip: "A freed Bonus Action — click to take it back now" });
    if (f.passives?.combat?.attackOfOpportunity && !sysOf(actor).actions?.reactionUsed) chips.push({ t: "⚔ Opportunity Strike ready" });
    return chips;
  }
  // Double 10 → the Action comes back (owner ruling 2026-10-29) — the system's own handler.
  async function actAgain(actor) {
    const fn = game.fourththing?.actAgain;
    if (typeof fn === "function") return fn(actor);
    await actor.unsetFlag("fourththing", "actAgainAvailable");
    await actor.update({ "system.actions.actionUsed": false });
  }
  async function bonusAgain(actor) {
    await actor.unsetFlag("fourththing", "bonusActionAvailable");
    await actor.update({ "system.actions.bonusUsed": false });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="fourththing-roll"><div class="ft-roll-header"><span class="ft-roll-name">⚡ ${esc(actor.name)} acts again</span></div><p style="margin:0.2rem 0;font-size:0.82rem;opacity:0.8">Bonus action regained — take it now, on your turn or anyone else's.</p></div>` });
  }

  // ── Render ─────────────────────────────────────────────────────────────
  let _collapsed = false;
  const COLL_KEY = () => `bbttcc-combat-dock-collapsed:${game.user?.id ?? "anon"}`;
  let _hotkeys = [];  // [{entry, s}] in hotkey order

  function ribbonHTML(c, s) {
    const turns = c.turns ?? [];
    if (!turns.length) return "";
    const n = turns.length, cur = Math.max(0, c.turn ?? 0);
    const order = Array.from({ length: n }, (_, i) => turns[(cur + i) % n]).filter(cb => game.user.isGM || !cb.hidden);
    const mine = s?.combatant?.id;
    return `<div class="cd-ribbon"><span class="cd-round">R${c.round}</span>` + order.map((cb, i) => {
      const tok = cb.token?.object;
      const rel = s?.token && tok ? relation(s.token, tok) : "neutral";
      const cls = [i === 0 ? "is-current" : "", cb.id === mine ? "is-mine" : "", cb.isDefeated ? "is-defeated" : "", `is-${rel}`].join(" ");
      const tag = cb.id === mine ? (i === 0 ? "YOU" : `in ${i}`) : "";
      return `<button type="button" class="cd-port ${cls}" data-pan="${esc(cb.tokenId ?? "")}" data-tooltip="${esc(cb.name)}${cb.isDefeated ? " (down)" : ""}">
        <img src="${esc(cb.img || cb.token?.texture?.src || "icons/svg/mystery-man.svg")}" alt="">
        ${tag ? `<span class="cd-port-tag">${tag}</span>` : ""}</button>`;
    }).join("") + `</div>`;
  }
  function slotsHTML(s) {
    if (IS_5E()) return "";
    const a = sysOf(s.actor).actions ?? {};
    const pip = (k, label, used) => `<span class="cd-slot ${used ? "is-spent" : ""}" data-tooltip="${label}${used ? " — spent" : " — ready"}">${used ? "◇" : "◆"} ${label}</span>`;
    const budget = Number(a.movementBudgetFt) || 0, used = Number(a.movementUsedFt) || 0;
    const left = Math.max(0, budget - used), pct = budget ? Math.round(left / budget * 100) : 0;
    let surge = "";
    try {
      // Heat meter (Burn folded into Surge, 10-29): one segment per point of the Surge cap,
      // lit = banked, coloured by the heat band (Cool / Stoked / Overheated). Click = spend.
      const H = game.fourththing?.surgeHeat?.(s.actor);
      if (H && H.cap > 0) {
        const col = H.band?.color ?? "#d6b26a";
        const segs = Array.from({ length: H.cap }, (_, i) => `<span class="cd-heat-seg ${i < H.value ? "is-lit" : ""}"></span>`).join("");
        surge = `<button type="button" class="cd-heat ${H.overheated ? "is-overheated" : ""}" data-dock="surge" style="--heat:${col}"
          data-tooltip="${esc(`Surge ${H.value}/${H.cap} — ${H.band?.label ?? ""}${H.band?.desc ? `: ${H.band.desc}` : ""}<br>${H.tooltip ?? ""}<br>Click to spend.`)}">
          <i class="fas fa-fire"></i><span class="cd-heat-bar">${segs}</span><span class="cd-heat-val">${H.value}/${H.cap}</span><span class="cd-heat-band">${esc(H.band?.label ?? "")}</span></button>`;
      }
      const v = H ? null : hud()?.surgeHeatFor?.(s.actor);   // older system: the plain chip
      if (v) surge = `<button type="button" class="cd-surge" data-dock="surge" style="${v.heat?.band ? `border-color:${v.heat.band.color}` : ""}" data-tooltip="Surge — click to spend">
        <i class="fas fa-bolt-lightning"></i> ${v.cur}${v.max != null ? `/${v.max}` : ""}${v.heat?.band ? ` <span style="color:${v.heat.band.color}">${esc(v.heat.band.label)}</span>` : ""}</button>`;
    } catch (_e) {}
    const off = !economyOn();
    const offNote = off ? `<span class="cd-econ-off" data-tooltip="${esc(game.user.isGM
      ? "The engine isn't enforcing Bonus Actions / Reactions on abilities yet. Turn on Game Settings → System Settings → “Steward sheet tracks action economy” to make every A / B / R cost real."
      : "Bonus Action / Reaction costs aren't enforced in this world yet — the GM can switch them on.")}">⚠ not enforced</span>` : "";
    return `<div class="cd-slots ${off ? "is-econ-off" : ""}">${pip("action", "Action", a.actionUsed)}${pip("bonus", "Bonus", a.bonusUsed)}${pip("reaction", "Reaction", a.reactionUsed)}${offNote}
      <span class="cd-move" data-tooltip="Movement left this turn — ${used} ft used of ${budget}"><i class="fas fa-shoe-prints"></i><span class="cd-move-bar"><span style="width:${pct}%"></span></span>${left} of ${budget} ft left</span>${surge}</div>`;
  }
  function abilitiesHTML(s, myTurn) {
    _hotkeys = [];
    const groups = buildGroups(s.actor);
    const offTurn = !myTurn && !game.user.isGM;
    const out = [];
    for (const g of groups) {
      // Off your turn: what the engine lets you take then — Bonus (any time, ruling U4) and Reaction.
      const shown = g.entries.filter(e => !offTurn || e.cost === "bonus" || e.cost === "reaction" || e.cost === "mixed");
      if (!shown.length) continue;
      out.push(`<div class="cd-group"><span class="cd-group-label">${esc(g.label)}</span>` + shown.map(e => {
        const spent = e.cost && slotSpent(s.actor, e.cost);
        let hk = "";
        if (!spent && !e.ritual && _hotkeys.length < 10) { _hotkeys.push({ entry: e, s }); hk = String(_hotkeys.length % 10); }
        const costTag = { action: "A", bonus: "B", reaction: "R", mixed: "±" }[e.cost]
          ? `<span class="cd-cost cd-cost-${e.cost}" ${e.cost === "mixed" ? `data-tooltip="Cost depends on which ability you pick"` : ""}>${{ action: "A", bonus: "B", reaction: "R", mixed: "±" }[e.cost]}</span>` : "";
        const tip = e.item ? (hud()?.synopsisFor?.(e.item) ?? esc(e.label)) : `<b>${esc(e.label)}</b><br>${esc(e.tip ?? "")}`;
        const aimTag = { area: "◎", self: "", none: "" }[e.aim] ?? "🎯";
        return `<button type="button" class="cd-ab ${spent ? "is-spent" : ""} ${_aim?.entry === e ? "is-aiming" : ""}" ${spent || e.ritual ? "disabled" : ""}
          data-dock="fire" data-g="${esc(g.id)}" data-k="${esc(e.item?.id ?? e.key)}" data-tooltip="${esc(tip)}">
          ${hk ? `<span class="cd-hk">${hk}</span>` : ""}${e.emoji ? `<span class="cd-emoji">${e.emoji}</span>` : `<i class="fas fa-${esc(e.icon)}"></i>`}
          <span class="cd-ab-name">${esc(e.label)}</span>${aimTag ? `<span class="cd-aim">${aimTag}</span>` : ""}${costTag}</button>`;
      }).join("") + `</div>`);
    }
    if (!out.length) return `<div class="cd-empty">${offTurn ? "Nothing to do off-turn — no Bonus Action or Reaction abilities." : "No abilities found."}</div>`;
    return out.join("");
  }
  function findEntry(s, gid, key) {
    for (const g of buildGroups(s.actor)) if (g.id === gid) {
      const e = g.entries.find(x => (x.item?.id ?? x.key) === key);
      if (e) return e;
    }
    return null;
  }

  function render() {
    renderNow();
  }
  const renderSoon = foundry.utils.debounce(() => renderNow(), 60);
  function renderNow() {
    const c = combatHere();
    const s = c ? subject() : null;
    const active = !!(c && s && setting("combatDock", true) && hud());
    applyBars(active);
    let dock = document.getElementById(DOCK_ID);
    if (!active) {
      dock?.remove();
      document.getElementById(LOG_ID)?.remove();
      if (_aim) endAim();
      drawMoveRing(null);
      return;
    }
    if (!dock) {
      dock = document.createElement("div");
      dock.id = DOCK_ID;
      document.body.appendChild(dock);
      wireDock(dock);
      try { _collapsed = window.localStorage?.getItem(COLL_KEY()) === "1"; } catch (_e) {}
      try { hud()?.refreshGroups?.(s.actor, null); } catch (_e) {}
    }
    const myTurn = isMyTurn(s);
    dock.classList.toggle("is-myturn", myTurn);
    dock.classList.toggle("is-collapsed", _collapsed);
    const canEnd = myTurn || game.user.isGM;
    if (_collapsed) {
      dock.innerHTML = `<button type="button" class="cd-pill" data-dock="expand"><i class="fas fa-crosshairs"></i> Combat · R${c.round}${myTurn ? " · YOUR TURN" : ""}</button>`;
      drawMoveRing(s);
      return;
    }
    const hint = myTurn ? `<span class="cd-turn-flag">YOUR TURN</span>`
      : `<span class="cd-wait" data-tooltip="${game.user.isGM ? "" : "Off your turn: Bonus Action + Reaction abilities only"}">${esc(c.combatant?.name ?? "")}'s turn</span>`;
    // Queued: three chips inline, the rest behind a "+N" with the full list on hover.
    const q = queuedChips(s.actor);
    const qChip = (x) => `<${x.act ? `button type="button" data-dock="${x.act}"` : "span"} class="cd-q ${x.act ? "is-act" : ""}" ${x.tip ? `data-tooltip="${esc(x.tip)}"` : ""}>${esc(x.t)}</${x.act ? "button" : "span"}>`;
    const qShown = [...q.filter(x => x.act), ...q.filter(x => !x.act)].slice(0, 3);
    const qMore = q.length - qShown.length;
    const queuedHTML = q.length ? `<span class="cd-q-label">Queued</span>${qShown.map(qChip).join("")}${qMore > 0 ? `<span class="cd-q" data-tooltip="${esc(q.slice(3).map(x => x.t).join(" · "))}">+${qMore}</span>` : ""}` : "";
    const folded = wantFold();
    // Two thin rows: [ribbon · who · slots · target · queued · End Turn] then the abilities.
    dock.innerHTML = `
      <div class="cd-row">
        ${ribbonHTML(c, s)}
        <span class="cd-who"><img src="${esc(s.token?.document?.texture?.src || s.actor.img)}" alt=""> ${esc(s.actor.name)}</span>
        ${hint}
        ${slotsHTML(s)}
        <span class="cd-spacer"></span>
        <span class="cd-target">${targetLineHTML(s)}</span>
        <span class="cd-queued">${queuedHTML}</span>
        ${canEnd ? `<button type="button" class="cd-end" data-dock="end"><i class="fas fa-forward"></i> End Turn</button>` : ""}
        <button type="button" class="cd-icon ${folded ? "" : "is-on"}" data-dock="bars" data-tooltip="${folded ? "Show Foundry's macro bar + sidebar" : "Fold Foundry's macro bar + sidebar away"}"><i class="fas fa-bars"></i></button>
        <button type="button" class="cd-icon" data-dock="collapse" data-tooltip="Shrink the dock"><i class="fas fa-chevron-down"></i></button>
      </div>
      <div class="cd-abilities">${abilitiesHTML(s, myTurn)}</div>`;
    drawMoveRing(s);
    placeDock();
  }

  // The dock sits on the bottom edge — or just above Foundry's macro bar when that's showing,
  // so the ☰ "show the bars" visibly brings it back instead of leaving it under the dock.
  // Banner / log / reaction cards sit just above the dock, whatever its height.
  function placeDock() {
    requestAnimationFrame(() => {
      const dock = document.getElementById(DOCK_ID); if (!dock) return;
      const hb = document.getElementById("hotbar");
      const r = (!document.body.classList.contains("bbttcc-dock-hidebars") && hb?.offsetParent) ? hb.getBoundingClientRect() : null;
      const bottom = (r && r.height) ? Math.max(8, Math.round(window.innerHeight - r.top + 6)) : 8;
      dock.style.bottom = `${bottom}px`;
      const h = dock.getBoundingClientRect().height;
      if (h) document.documentElement.style.setProperty("--cd-dock-h", `${Math.round(h + bottom - 8)}px`);
    });
  }

  function wireDock(dock) {
    dock.addEventListener("click", async (ev) => {
      const pan = ev.target.closest("[data-pan]");
      if (pan) {
        const tok = canvas.tokens.get(pan.dataset.pan);
        if (tok) { canvas.animatePan({ x: tok.center.x, y: tok.center.y, duration: 250 }); if (game.user.isGM) tok.control({ releaseOthers: true }); }
        return;
      }
      const b = ev.target.closest("[data-dock]"); if (!b) return;
      const s = subject(); if (!s) return;
      switch (b.dataset.dock) {
        case "fire": { const e = findEntry(s, b.dataset.g, b.dataset.k); if (e) activate(e, s); return; }
        case "surge": return hud()?.fire?.pool?.(s.actor, "surge");
        case "end": {
          if (_aim) endAim();
          try { await game.combat?.nextTurn(); } catch (e) { ui.notifications?.warn?.("Couldn't end the turn — ask the GM."); warn(e); }
          return;
        }
        case "bars": _foldPref = !wantFold(); return render();
        case "collapse": _collapsed = true; try { localStorage.setItem(COLL_KEY(), "1"); } catch (_e) {} return render();
        case "expand": _collapsed = false; try { localStorage.setItem(COLL_KEY(), "0"); } catch (_e) {} return render();
        case "actAgain": return actAgain(s.actor);
        case "bonusAgain": return bonusAgain(s.actor);
      }
    });
  }

  // ── Hotkeys: 1–9, 0 fire the numbered abilities; Esc / Enter in aim mode ─
  window.addEventListener("keydown", (ev) => {
    if (!document.getElementById(DOCK_ID)) return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (_aim && ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); return endAim(); }
    if (_aim && ev.key === "Enter") {
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (_aim.picked.size) return commitAim([..._aim.picked].map(id => canvas.tokens.get(id)).filter(Boolean));
      if (_aim.entry.aim === "any") return commitAim([]);
      return;
    }
    if (!/^[0-9]$/.test(ev.key) || ev.shiftKey) return;
    const i = ev.key === "0" ? 9 : Number(ev.key) - 1;
    const hk = _hotkeys[i]; if (!hk) return;
    ev.preventDefault(); ev.stopImmediatePropagation();   // beat Foundry's hotbar digits
    const s = subject(); if (s) activate(hk.entry, s);
  }, true);

  // ── Combat log: last three results above the dock ──────────────────────
  function logLine(msg) {
    if (!document.getElementById(DOCK_ID) || !msg?.visible) return;
    let text = "";
    try {
      // Flavor is HTML too on roll cards — parse both, prefer a card header.
      const div = document.createElement("div"); div.innerHTML = `${msg.flavor ?? ""}<hr>${msg.content ?? ""}`;
      const head = div.querySelector(".ft-roll-name, .item-name, h3, h4")?.textContent;
      const fl = document.createElement("div"); fl.innerHTML = msg.flavor ?? "";
      text = (head || fl.textContent || div.textContent || "").replace(/\s+/g, " ").trim();
    } catch (_e) {}
    if (!text) return;
    if (text.length > 80) text = text.slice(0, 77) + "…";
    const total = msg.rolls?.length ? ` = ${msg.rolls[0].total}` : "";
    let box = document.getElementById(LOG_ID);
    if (!box) { box = document.createElement("div"); box.id = LOG_ID; document.body.appendChild(box); }
    const line = document.createElement("div");
    line.className = "cd-log-line";
    line.innerHTML = `<b>${esc(msg.speaker?.alias ?? "")}</b> ${esc(text)}${esc(total)}`;
    box.appendChild(line);
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => { line.classList.add("is-fading"); setTimeout(() => line.remove(), 800); }, 15000);
  }

  // ── Reaction cards ─────────────────────────────────────────────────────
  function mineToAnswer(actor) {
    if (!actor) return false;
    const s = subject();
    if (s && (s.actor.id === actor.id || s.actor.uuid === actor.uuid)) return true;
    return !game.user.isGM && actor.isOwner && actor.type === "character";
  }
  function reactionCard({ title, body, onTake }) {
    let box = document.getElementById(REACT_ID);
    if (!box) { box = document.createElement("div"); box.id = REACT_ID; document.body.appendChild(box); }
    const secs = Number(setting("combatDockReactionSeconds", 8)) || 8;
    const card = document.createElement("div");
    card.className = "cd-react";
    card.innerHTML = `<div class="cd-react-title"><i class="fas fa-bolt"></i> ${esc(title)}</div>
      <div class="cd-react-body">${esc(body)}</div>
      <div class="cd-react-btns"><button type="button" data-r="take">Take</button><button type="button" data-r="pass">Pass</button></div>
      <div class="cd-react-timer"><span style="animation-duration:${secs}s"></span></div>`;
    box.appendChild(card);
    const done = () => { clearTimeout(tm); card.remove(); };
    const tm = setTimeout(done, secs * 1000);
    card.addEventListener("click", async (ev) => {
      const b = ev.target.closest("button[data-r]"); if (!b) return;
      done();
      if (b.dataset.r === "take") { try { await onTake(); } catch (e) { warn("reaction take failed", e); } }
    });
  }
  function onChatForReactions(msg) {
    if (!combatHere()) return;
    // Trigger Offers (on-hit wards, aid riders, …) — the engine's own accept path.
    const off = msg.flags?.fourththing?.triggerOffer;
    if (off && !off.used) {
      let a = null; try { a = fromUuidSync(off.actorUuid); a = a?.actor ?? a; } catch (_e) {}
      if (mineToAnswer(a)) {
        let title = "Reaction offer";
        try { const d = document.createElement("div"); d.innerHTML = msg.content ?? ""; title = d.querySelector(".ft-roll-name")?.textContent?.trim() || title; } catch (_e) {}
        reactionCard({ title, body: `${a.name} can react — take it?`, onTake: async () => {
          const r = await game.fourththing?.triggers?.accept?.(msg);
          if (r && !r.ok && r.reason) ui.notifications?.warn?.(r.reason);
        } });
      }
      return;
    }
    // Attack of Opportunity prompt — press the chat card's own button so every engine gate still runs.
    const m = /class="ft-aoo-strike"[^>]*data-observer-uuid="([^"]+)"[^>]*data-mover-uuid="([^"]+)"/.exec(msg.content ?? "");
    if (!m) return;
    let obs = null, mover = null;
    try { obs = fromUuidSync(m[1]); mover = fromUuidSync(m[2]); } catch (_e) {}
    if (!mineToAnswer(obs)) return;
    reactionCard({ title: "Opportunity Strike", body: `${mover?.name ?? "A foe"} is leaving your reach. Strike? (uses your Reaction)`, onTake: async () => {
      const btn = Array.from(document.querySelectorAll(`[data-message-id="${msg.id}"] .ft-aoo-strike`)).find(b => !b.disabled);
      if (btn) return btn.click();
      ui.notifications?.warn?.("Open the chat log and press the Strike button on the Attack of Opportunity card.");
    } });
  }

  // ── Hooks ──────────────────────────────────────────────────────────────
  Hooks.once("ready", () => {
    try { _collapsed = window.localStorage?.getItem(COLL_KEY()) === "1"; } catch (_e) {}
    renderSoon();
    // 10-30: on a refresh mid-combat the Player HUD (and its Steward) can publish after this
    // ready pass, so the dock found no subject and stayed gone until the next combat event.
    // Retry for ~10 s until the dock mounts (or there is no combat here to show).
    let tries = 0;
    const retry = setInterval(() => {
      if (++tries > 20 || document.getElementById(DOCK_ID) || !combatHere()) return clearInterval(retry);
      renderNow();
    }, 500);
  });
  Hooks.on("canvasReady", () => { _moveGfx = null; renderSoon(); });
  for (const h of ["combatStart", "combatTurnChange", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant"]) {
    Hooks.on(h, (...args) => {
      if (h === "deleteCombat") _foldPref = null;
      if (_aim && (h === "combatTurnChange" || h === "deleteCombat")) endAim();
      renderSoon();
    });
  }
  const touchesSubject = (actor) => { const s = subject(); return !!(s && actor && (actor.id === s.actor.id || actor === s.actor)); };
  Hooks.on("updateActor", (a) => { if (touchesSubject(a)) renderSoon(); });
  for (const h of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "deleteActiveEffect"]) {
    Hooks.on(h, (doc) => { if (touchesSubject(doc?.parent)) renderSoon(); });
  }
  Hooks.on("targetToken", (user) => {
    if (user?.id !== game.user.id) return;
    const el = document.querySelector(`#${DOCK_ID} .cd-target`);
    if (el) el.innerHTML = targetLineHTML(subject());
  });
  Hooks.on("controlToken", () => { if (game.user.isGM) renderSoon(); });
  Hooks.on("updateToken", (doc) => { const s = subject(); if (s?.token && doc.id === s.token.id) renderSoon(); });
  Hooks.on("refreshToken", (tok) => { const s = subject(); if (s?.token && tok.id === s.token.id) drawMoveRing(s); });
  Hooks.on("createChatMessage", (msg) => {
    try { logLine(msg); } catch (_e) {}
    try { onChatForReactions(msg); } catch (e) { warn("reaction card failed", e); }
  });
})();
