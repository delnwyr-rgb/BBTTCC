// modules/combat-dock/scripts/combat-dock.js  (was bbttcc-territory/scripts/combat-dock.enhancer.js)
// 2026-11-12 (Dave): its own module so a plain D&D world (the Third Kaeron War) runs it with nothing
// else from Bad Eden. Bad Eden worlds still load it through the bbttcc-territory shim (same file).
// Without the Bad Eden player HUD it uses a built-in D&D fallback (who it drives, the ability lists,
// firing via item.use), and on D&D it draws the movement circle from the actor's speed minus the
// token's movement this turn (core movement history).
//
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
  // One dock per page: the bbttcc-territory shim and the combat-dock manifest can both load this file.
  if (globalThis.__bbttccCombatDock) return;
  globalThis.__bbttccCombatDock = true;
  const TAG = "[combat-dock]";
  // Settings live under the combat-dock module when it's enabled (plain D&D), else under bbttcc-territory
  // (Bad Eden worlds keep their players' existing dock preferences). Resolved at init — `game` is a
  // placeholder while module scripts load.
  let MOD = "bbttcc-territory";
  const DOCK_ID = "bbttcc-combat-dock";
  const BANNER_ID = "bbttcc-dock-banner";
  const REACT_ID = "bbttcc-dock-reactions";
  const LOG_ID = "bbttcc-dock-log";
  const warn = (...a) => console.warn(TAG, ...a);
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const IS_5E = () => game.system?.id === "dnd5e";
  const hud = () => game.bbttcc?.playerHud ?? (IS_5E() ? FALLBACK_HUD : null);
  const sysOf = (a) => a?.system?.system ?? a?.system ?? {};
  const setting = (k, d) => { try { return game.settings.get(MOD, k); } catch (_e) { return d; } };

  Hooks.once("init", () => {
    if (game.modules?.get?.("combat-dock")?.active) MOD = "combat-dock";
    game.settings.register(MOD, "combatDock", {
      name: "Combat Dock", hint: "Show the Combat Dock (initiative, abilities, targeting) along the bottom of the screen during combat.",
      scope: "client", config: true, type: Boolean, default: true, onChange: () => render()
    });
    // 11-12 (Dave): "have it always available, whether combat is active or not" — on by default for plain D&D
    // (combat-dock module); off in Bad Eden worlds, which already have the player HUD out of combat.
    game.settings.register(MOD, "combatDockAlways", {
      name: "Combat Dock: show out of combat", hint: "Keep the dock up outside combat (abilities, saves, skills, Surge) for your character — or, for the GM, the selected token. The initiative / turn bar appears when a combat starts.",
      scope: "client", config: true, type: Boolean, default: MOD === "combat-dock", onChange: () => render()
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

  // ── Plain-D&D fallback for the Bad Eden player HUD (2026-11-12) ────────
  // The same shape the dock reads from game.bbttcc.playerHud: who it drives, the D&D item lists,
  // firing, icons and a one-line synopsis. Used only when the Bad Eden HUD isn't loaded.
  const has5eActs = (it) => (it.system?.activities?.size ?? 0) > 0;
  const firstAct = (it) => it.system?.activities?.contents?.[0] ?? null;
  const ACT_TYPES = new Set(["action", "bonus", "reaction"]);
  function readySpell(it) {
    const sys = it.system ?? {};
    if (!has5eActs(it)) return false;
    if (!(Number(sys.level) > 0)) return true;                              // cantrips / at-will powers
    // 11-12 (Dave: Darth Babs showed no force powers): only regular "spell"-method / "prepared"-mode spells need
    // preparing. SW5E powers (method "powerCasting"), pact, at-will, innate, ritual… are always ready when known.
    const method = String(sys.method ?? sys.preparation?.mode ?? "");
    if (method && !["spell", "prepared"].includes(method)) return true;
    const prep = sys.prepared ?? sys.preparation?.prepared;
    return prep === true || Number(prep) >= 1;                               // 1 prepared, 2 always
  }
  const FALLBACK_HUD = {
    getSteward() {
      if (game.user?.isGM) {
        const ctl = canvas?.tokens?.controlled?.at?.(-1)?.actor;
        return ctl ?? game.user?.character ?? null;
      }
      const isPC = (a) => a?.type === "character";
      const assigned = game.user?.character ?? null;
      if (isPC(assigned)) return assigned;
      const ctl = (canvas?.tokens?.controlled ?? []).map(t => t.actor).find(a => isPC(a) && a.isOwner);
      return ctl ?? game.actors?.find?.(a => isPC(a) && a.testUserPermission?.(game.user, "OWNER")) ?? null;
    },
    collectSections5e(actor) {
      const strikes = [], spells = [], abilities = [], ancestry = [], items = [];
      for (const it of (actor?.items?.contents ?? [])) {
        if (it.type === "weapon") { if (has5eActs(it) && (it.system?.equipped !== false)) strikes.push(it); continue; }
        if (it.type === "spell" || it.type === "power") { if (readySpell(it)) spells.push(it); continue; }
        if (!["feat", "consumable"].includes(it.type) || !has5eActs(it)) continue;
        const act = String(firstAct(it)?.activation?.type ?? "");
        if (!ACT_TYPES.has(act)) continue;                                   // passives / minute-long rituals stay on the sheet
        if (it.type === "consumable" && !["potion", "scroll", "wand", "rod", "poison"].includes(String(it.system?.type?.value ?? ""))) continue;
        if (it.type === "consumable") { items.push(it); continue; }
        (it.system?.type?.value === "race" ? ancestry : abilities).push(it);
      }
      const byName = (a, b) => a.name.localeCompare(b.name);
      spells.sort((a, b) => (Number(a.system?.level) || 0) - (Number(b.system?.level) || 0) || byName(a, b));
      return { strikes: strikes.sort(byName), spells, abilities: abilities.sort(byName), ancestry: ancestry.sort(byName), items: items.sort(byName) };
    },
    fire: {
      async use5e(actor, item) {
        if (typeof item?.use === "function") return item.use({}, { event: window.event });
        return item?.sheet?.render(true, { focus: true });
      }
    },
    abilityIcon(item) {
      return { weapon: "khanda", spell: "wand-magic-sparkles", power: "wand-magic-sparkles", consumable: "flask" }[item?.type] ?? "bolt";
    },
    synopsisFor(item) {
      const act = firstAct(item);
      const bits = [`<b>${esc(item.name)}</b>`];
      const lvl = Number(item.system?.level);
      if (item.type === "spell" && Number.isFinite(lvl)) bits.push(lvl ? `Level ${lvl}` : "Cantrip");
      const dmg = (act?.damage?.parts ?? []).map(p => p.formula ?? (p.number && p.denomination ? `${p.number}d${p.denomination}` : "")).filter(Boolean).join(" + ")
        || (act?.type === "attack" && item.system?.damage?.base?.formula) || "";
      if (dmg) bits.push(`⚔ ${esc(dmg)}`);
      if (act?.save?.ability?.size) bits.push(`${[...act.save.ability].join("/").toUpperCase()} save${act.save.dc?.value ? ` DC ${act.save.dc.value}` : ""}`);
      const r = act?.range ?? {};
      if (r.units === "self") bits.push("→ self"); else if (r.units === "touch") bits.push("→ touch"); else if (Number(r.value)) bits.push(`→ ${r.value} ${r.units ?? "ft"}`);
      return bits.join("<br>");
    },
  };

  // ── Who the dock drives ────────────────────────────────────────────────
  // Players: their Steward (same resolver as the HUD). GM: the current
  // combatant when no player owns it (monsters), else the controlled token.
  function combatHere() {
    const c = game.combat;
    if (!c?.started) return null;
    if (c.scene && canvas?.scene && c.scene.id !== canvas.scene.id) return null;
    return c;
  }
  // 11-12: out of combat (setting combatDockAlways) the dock drives the player's character / the GM's selected token.
  // 11-12: the RFI player HUD's Abilities button opens the dock out of combat (remembered per user).
  let _manualOpen = false;
  const OPEN_KEY = () => `combat-dock-open:${game.user?.id ?? "anon"}`;
  function setManualOpen(v) { _manualOpen = !!v; try { localStorage.setItem(OPEN_KEY(), _manualOpen ? "1" : "0"); } catch (_e) {} }
  function oocSubject() {
    if (!setting("combatDockAlways", false) && !_manualOpen) return null;
    const actor = hud()?.getSteward?.();
    if (!actor) return null;
    if (game.user.isGM && !canvas?.tokens?.controlled?.length && !actor.hasPlayerOwner && actor !== game.user.character) return null;
    const token = actor.getActiveTokens?.(true)?.find?.(t => t.scene?.id === canvas?.scene?.id) ?? actor.getActiveTokens?.()?.[0] ?? null;
    return { actor, token: token?.document ? token : (token?.object ?? null), combatant: null, ooc: true };
  }
  function subject() { return combatSubject() ?? oocSubject(); }
  function combatSubject() {
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
  // 2026-11-08 (teeth P25): the system's one range — game.fourththing.itemRangeFt (rangeFt; legacy short/long and Range
  // Baseline read through it; touch 5, self 0 = no check). The local reads are only for an older system build.
  const sysRangeFt = (it) => { try { const fn = game.fourththing?.itemRangeFt; if (typeof fn === "function") return Number(fn(it)) || 0; } catch (_e) {} return null; };

  function strikeEntry(it, kind = "strike") {
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    const sq = Math.max(Number(sys.range?.short) || 0, Number(sys.range?.long) || 0) || 1;
    const area = mf.area?.shape && mf.area.shape !== "none";
    // 10-30: a primed Echo Strike (Surge) is a free Strike — the weapon stays live after the Action is spent.
    const echo = it.type === "weapon" && !!it.parent?.flags?.fourththing?.surge?.oneShot?.["echo-strike"];
    const rangeFt = sysRangeFt(it) ?? (sq * gridFt());
    return { kind, item: it, label: it.name, icon: hud()?.abilityIcon?.(it) ?? "khanda",
      cost: echo ? null : engineCost(it, normCost(mf.activation?.type) ?? "action"), aim: area ? "area" : "foe", rangeFt };
  }
  function powerEntry(it) {
    const sys = it.system ?? {}, mf = sys.manifestation ?? {};
    // Aim derives from what the working does (2026-11-08, Target Shape retired): an area shape → engine
    // template; self range → the caster; a heal → an ally; damage → a foe; anything else → any.
    // A legacy item's stored system.target "self" still reads as self.
    const op = String(sys.damageRoll?.op ?? "");
    let aim = "foe";
    if (mf.area?.shape && mf.area.shape !== "none") aim = "area";
    else if (sys.range === "self" || sys.target === "self") aim = "self";
    else if (op === "heal") aim = "ally";
    else if (op !== "damage") aim = "any";
    const rangeFt = sysRangeFt(it) ?? (Number(mf.rangeFt) || RANGE_BASE[sys.range] || 30);
    // One activation field (2026-11-08, teeth P20): manifestation.activation.type. Ritual is gone. The engine reports
    // "mixed" for an Invoke whose stance picks the pools (Shamanic Action · Chaotic Bonus · Hermetic both).
    const act = String(mf.activation?.type ?? "action");
    // Rolls damage? (a legacy power keeps its dice only in the flat system.damage string.)
    const rollsDamage = op === "damage" || (!op && typeof sys.damage === "string" && /\d*d\d+/i.test(sys.damage));
    return { kind: "mani", item: it, label: it.name, icon: "wand-magic-sparkles",
      cost: engineCost(it, normCost(act)), aim, rangeFt, rollsDamage };
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

  // ── Saving throws + skill checks (dnd5e, 2026-11-12) ───────────────────
  const sgn = (n) => (Number(n) >= 0 ? "+" : "") + (Number(n) || 0);
  const PROF_MARK = (m) => (Number(m) >= 2 ? "◆" : Number(m) >= 1 ? "●" : Number(m) > 0 ? "◐" : "");
  function rollGroups5e(actor) {
    const out = [], sys = actor?.system ?? {};
    const abil = CONFIG.DND5E?.abilities ?? {};
    // 11-12 (Dave): ability checks — dnd5e 6 totals them at abilities.<k>.check.value (mod + check bonuses + prof term).
    const checks = Object.keys(abil).filter(k => sys.abilities?.[k]).map(k => {
      const a = sys.abilities[k];
      const mod = a.check?.value ?? a.mod ?? 0;
      const prof = a.check?.prof?.multiplier ?? 0;
      const name = abil[k]?.abbreviation ?? k;
      return { kind: "roll5e", roll: "check", key: `check:${k}`, abil: k, label: `${String(name).toUpperCase()} ${sgn(mod)}${PROF_MARK(prof) ? ` ${PROF_MARK(prof)}` : ""}`,
        tip: `${abil[k]?.label ?? k} check (${sgn(mod)})`, icon: "hand-fist", aim: "none", cost: null };
    });
    if (checks.length) out.push({ id: "checks", label: "Checks", entries: checks });
    const saves = Object.keys(abil).filter(k => sys.abilities?.[k]).map(k => {
      const a = sys.abilities[k];
      const mod = a.save?.value ?? a.save ?? a.mod ?? 0;
      const prof = a.save?.prof?.multiplier ?? a.saveProf?.multiplier ?? a.proficient ?? 0;
      const name = abil[k]?.abbreviation ?? k;
      return { kind: "roll5e", roll: "save", key: `save:${k}`, abil: k, label: `${String(name).toUpperCase()} ${sgn(mod)}${PROF_MARK(prof) ? ` ${PROF_MARK(prof)}` : ""}`,
        tip: `${abil[k]?.label ?? k} saving throw (${sgn(mod)})${prof ? " — proficient" : ""}`, icon: "shield-halved", aim: "none", cost: null };
    });
    if (saves.length) out.push({ id: "saves", label: "Saves", entries: saves });
    const skl = CONFIG.DND5E?.skills ?? {};
    const skills = Object.entries(sys.skills ?? {}).filter(([k]) => skl[k]).map(([k, v]) => {
      const tot = v.total ?? v.mod ?? 0;
      return { kind: "roll5e", roll: "skill", key: `skill:${k}`, skill: k, label: `${skl[k].label} ${sgn(tot)}${PROF_MARK(v.value) ? ` ${PROF_MARK(v.value)}` : ""}`,
        tip: `${skl[k].label} check (${sgn(tot)}) · passive ${v.passive ?? 10 + Number(tot)}${v.value >= 2 ? " — expertise" : v.value >= 1 ? " — proficient" : ""}`, icon: "dice-d20", aim: "none", cost: null };
    }).sort((a, b) => a.label.localeCompare(b.label));
    if (skills.length) out.push({ id: "skills", label: "Skills", entries: skills });
    return out;
  }

  // ── RFI: what the Abilities tray had (2026-11-12) ──────────────────────
  // Retinue (crew feats + Invoke Crew / Association), Faculties, Defenses, Aptitudes, Active States — built from
  // the player HUD's own helpers (game.bbttcc.playerHud.rfi), fired through its roll paths.
  function rfiTrayGroups(actor, sections) {
    const R = hud()?.rfi; if (!R || !actor) return [];
    const out = [];
    const echo = sections?.echo ?? [];
    let contracts = []; try { contracts = R.contracts?.(actor) ?? []; } catch (_e) {}
    if (echo.length || contracts.length) {
      const tip = contracts.map(c => `${c.label}: ${c.name} (${c.clock})`).join("<br>");
      out.push({ id: "retinue", label: "Retinue", entries: [
        { kind: "spot", which: "crew", key: "spot:crew", label: "Invoke Crew", emoji: "⭐", aim: "none", cost: null, noTarget: true, tipHTML: `<b>Invoke Crew</b><br>Spotlight a member from an active crew — one beat per scene${tip ? `<br>${tip}` : ""}` },
        { kind: "spot", which: "occult", key: "spot:occult", label: "Invoke Association", emoji: "⭐", aim: "none", cost: null, noTarget: true, tipHTML: `<b>Invoke Association</b><br>Spotlight a member from an active association — one beat per scene` },
        ...echo.map(featureEntry).map(e => ({ ...e, icon: "ghost" }))] });
    }
    const fac = R.faculties?.(actor) ?? [];
    if (fac.length) out.push({ id: "faculties", label: "Faculties", entries: fac.map(f => ({ kind: "rfiRoll", sub: "faculty", fkey: f.key, key: `fac:${f.key}`,
      label: `${f.label} ${f.value >= 0 ? "+" : ""}${f.value}`, tip: `Roll ${f.label}`, icon: "dice-d20", aim: "none", cost: null, noTarget: true })) });
    const def = R.defenses?.(actor) ?? [];
    if (def.length) out.push({ id: "defenses", label: "Defenses", entries: def.map(d => ({ kind: "rfiRoll", sub: "defense", fkey: d.key, key: `def:${d.key}`,
      label: `${d.label} ${d.value}`, tip: `Roll ${d.label} (DC ${d.value})`, icon: "shield-halved", aim: "none", cost: null, noTarget: true })) });
    const apt = R.aptitudes?.(actor) ?? [];
    if (apt.length) out.push({ id: "aptitudes", label: "Aptitudes", entries: apt.map(a => ({ kind: "rfiRoll", sub: "aptitude", fkey: a.key, attribute: a.attribute, key: `apt:${a.key}`,
      label: `${a.label} · ${R.rankInfo?.[Math.max(0, Math.min(5, a.rank))]?.label ?? a.rank}`, tipHTML: R.rankTip?.(a.label, a.rank) ?? esc(a.label), icon: "dice-d20", aim: "none", cost: null, noTarget: true })) });
    let states = []; try { states = R.liveStates?.(actor) ?? []; } catch (_e) {}
    if (states.length) out.push({ id: "states", label: "States", entries: states.map(e => ({ kind: "state", effectId: e.id, key: `fx:${e.id}`,
      label: `${e.name ?? "Effect"}${(() => { const d = (() => { try { return String(R.effectDurationLabel?.(e) ?? ""); } catch (_e) { return ""; } })();
        const v = e.duration?.value ?? e._source?.duration?.value, u = String(e.duration?.units ?? e._source?.duration?.units ?? "");
        const own = Number(v) > 0 ? `${v}${u.startsWith("round") ? "r" : u.startsWith("turn") ? "t" : u.startsWith("minute") ? "m" : u.startsWith("second") ? "s" : ""}` : "";
        const lbl = own || (/^(none|∞|)$/i.test(d.trim()) ? "" : d);
        return lbl ? ` · ${lbl}` : ""; })()}`, img: e.img ?? e.icon, tip: "Open this effect", aim: "none", cost: null, noTarget: true,
      polarity: R.effectPolarity?.(e) ?? "neutral", off: !!e.disabled })) });
    return out;
  }

  function buildGroups(actor) {
    const H = hud(); if (!H || !actor) return [];
    const groups = [];
    if (IS_5E()) {
      const s = H.collectSections5e?.(actor) ?? {};
      if (s.strikes?.length) groups.push({ id: "strike", label: "Strike", entries: s.strikes.map(i => entry5e(i)) });
      // 11-12: one row per spell level — an 18th-level caster's list is long.
      const byLvl = new Map();
      for (const i of (s.spells ?? [])) { const l = Number(i.system?.level) || 0; if (!byLvl.has(l)) byLvl.set(l, []); byLvl.get(l).push(i); }
      for (const [l, list] of [...byLvl].sort((a, b) => a[0] - b[0]))
        groups.push({ id: `mani${l}`, label: l ? `Level ${l}` : "Cantrips", entries: list.map(i => entry5e(i)) });
      const ab = [...(s.abilities ?? []), ...(s.ancestry ?? [])];
      if (ab.length) groups.push({ id: "ability", label: "Abilities", entries: ab.map(i => entry5e(i)) });
      if (s.items?.length) groups.push({ id: "items", label: "Items", entries: s.items.map(i => entry5e(i)) });   // 11-12: potions & scrolls last
      groups.push(...rollGroups5e(actor));   // 11-12 (Dave): saving throws + skill checks
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
    groups.push(...rfiTrayGroups(actor, s));   // 11-12 (Dave): the dock replaces the RFI Abilities tray
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
    // 11-12: RFI tray rows (faculties, defenses, aptitudes, spotlights, states) leave the targets alone too.
    if (entry.kind === "rfiRoll") {
      try {
        if (entry.sub === "faculty") return await H?.fire?.faculty?.(actor, entry.fkey);
        if (entry.sub === "defense") return await H?.fire?.defense?.(actor, entry.fkey);
        if (entry.sub === "aptitude") return await H?.fire?.aptitude?.(actor, entry.fkey, entry.attribute);
      } catch (e) { warn(`roll failed: ${entry.label}`, e); }
      return;
    }
    if (entry.kind === "spot") return H?.fire?.spotlight?.(actor, entry.which);
    if (entry.kind === "state") { const eff = actor.effects?.get?.(entry.effectId); return eff?.sheet?.render?.(true, { focus: true }); }
    // 11-12: saves / skill checks roll for the actor and leave the user's targets alone.
    if (entry.kind === "roll5e") {
      try {
        const event = window.event;
        if (entry.roll === "save") return await actor.rollSavingThrow?.({ ability: entry.abil, event });
        if (entry.roll === "check") return await actor.rollAbilityCheck?.({ ability: entry.abil, event });
        return await actor.rollSkill?.({ skill: entry.skill, event });
      } catch (e) { warn(`roll failed: ${entry.label}`, e); return; }
    }
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
    if (entry.cost && slotSpent(s.actor, entry.cost)) return ui.notifications?.warn?.(`${s.actor.name}: your ${entry.cost === "action" ? "Action" : entry.cost === "bonus" ? "Bonus Action" : "Reaction"} is spent this round.`);
    // A self manifestation passes the caster's own token so a self-ward lands on them (2026-11-08) — but never one that
    // rolls damage (fix round 2026-11-08, R5): that would aim the damage at the caster.
    if (entry.aim === "self") return fire(entry, s, entry.kind === "mani" && s.token && !entry.rollsDamage ? [s.token] : []);
    if (entry.aim === "none" || entry.aim === "area") return fire(entry, s, []);
    return beginAim(entry, s);
  }

  // ── Movement ring ──────────────────────────────────────────────────────
  // Budget + used, feet. RFI: the system's own action ledger. D&D (2026-11-12, Dave: "it doesn't show the
  // circle of movement distance"): the actor's speed (dnd5e movement.max — the highest mode, after Slowed /
  // multipliers) minus what the token has moved this turn (core TokenDocument#movementHistory, which Foundry
  // records during combat and clears at the combatant's turn start).
  function movementOf(s) {
    if (!IS_5E()) {
      const a = sysOf(s?.actor).actions ?? {};
      return { budget: Number(a.movementBudgetFt) || 0, used: Number(a.movementUsedFt) || 0 };
    }
    const mv = s?.actor?.system?.attributes?.movement ?? {};
    const budget = Number(mv.max) || Math.max(0, ...["walk", "fly", "swim", "climb", "burrow"].map(k => Number(mv[k]) || 0));
    let used = 0;
    try {
      const doc = s?.token?.document;
      const hist = doc?.movementHistory ?? [];
      if (hist.length > 1) {
        const m = typeof doc.measureMovementPath === "function" ? doc.measureMovementPath(hist) : canvas.grid.measurePath(hist);
        used = Number(m?.distance) || 0;
      }
    } catch (_e) {}
    return { budget, used: Math.round(used) };
  }
  let _moveGfx = null;
  function drawMoveRing(s) {
    const show = s && isMyTurn(s) && s.token && canvas?.ready;
    if (!show) { try { _moveGfx?.clear(); } catch (_e) {} return; }
    if (!_moveGfx || _moveGfx.destroyed) { _moveGfx = new PIXI.Graphics(); (canvas.interface ?? canvas.stage).addChild(_moveGfx); }
    const { budget, used } = movementOf(s);
    const left = Math.max(0, budget - used);
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
  const FOLD_KEY = () => `combat-dock-folded:${game.user?.id ?? "anon"}`;
  function foldedGroups() { try { return new Set(JSON.parse(window.localStorage?.getItem(FOLD_KEY()) || "[]")); } catch (_e) { return new Set(); } }
  function toggleFold(gid) {
    const f = foldedGroups(); f.has(gid) ? f.delete(gid) : f.add(gid);
    try { localStorage.setItem(FOLD_KEY(), JSON.stringify([...f])); } catch (_e) {}
  }
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
  // D&D (2026-10-31, Dave mid-shoot: "we need the surge … meter info on the combat HUD"): the Surge heat meter from
  // surge-powers (heat(): Cool / Stoked / Overheated, click = the Surge menu with Vent) + Flow / Artifice points for the
  // bad-eden-5e casters. dnd5e tracks its own action economy, so no A/B/R pips here.
  function slotsHTML5e(s) {
    let surge = "", points = "";
    try {
      const H = game.surgePowers?.heat?.(s.actor);
      if (H && H.cap > 0) {
        const segs = Array.from({ length: H.cap }, (_, i) => `<span class="cd-heat-seg ${i < H.value ? "is-lit" : ""}"></span>`).join("");
        surge = `<button type="button" class="cd-heat ${H.overheated ? "is-overheated" : ""}" data-dock="surge" style="--heat:${H.color}"
          data-tooltip="${esc(`Surge ${H.value}/${H.cap} — ${H.label}<br>${H.tip}<br>Click for the Surge menu (Vent is at the bottom).`)}">
          <i class="fas fa-fire"></i><span class="cd-heat-bar">${segs}</span><span class="cd-heat-val">${H.value}/${H.cap}</span><span class="cd-heat-band">${esc(H.label)}</span></button>`;
      }
    } catch (_e) {}
    try {
      const C = game.badEden5e?.castingFor?.(s.actor) ?? {};
      for (const t of Object.values(C)) {
        if (!t?.max) continue;
        const pct = Math.round(Math.max(0, Math.min(1, t.value / t.max)) * 100);
        points += `<span class="cd-move" data-tooltip="${esc(`${t.pointsLabel}: ${t.value} of ${t.max} — a long rest refills them`)}"><i class="fas fa-${t.key === "artifice" ? "gears" : "water"}"></i><span class="cd-move-bar"><span style="width:${pct}%"></span></span>${t.value}/${t.max} ${esc(t.key === "artifice" ? "Artifice" : "Flow")}</span>`;
      }
    } catch (_e) {}
    let move = "";
    const { budget, used } = movementOf(s);
    if (budget > 0 && !s.ooc) {
      const left = Math.max(0, budget - used), pct = Math.round(left / budget * 100);
      move = `<span class="cd-move" data-tooltip="Movement left this turn — ${used} ft used of ${budget}"><i class="fas fa-shoe-prints"></i><span class="cd-move-bar"><span style="width:${pct}%"></span></span>${left} of ${budget} ft left</span>`;
    }
    if (!surge && !points && !move) return "";
    return `<div class="cd-slots">${move}${points}${surge}</div>`;
  }
  function slotsHTML(s) {
    if (IS_5E()) return slotsHTML5e(s);
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
    const folded = foldedGroups();
    for (const g of groups) {
      // Off your turn: what the engine lets you take then — Bonus (any time, ruling U4) and Reaction. Saves / checks always.
      const shown = g.entries.filter(e => !offTurn || e.kind === "roll5e" || e.noTarget || e.cost === "bonus" || e.cost === "reaction" || e.cost === "mixed" || e.cost === "free");
      if (!shown.length) continue;
      // 11-12 (Dave): every section folds — click its label. Remembered per user.
      const isFolded = folded.has(g.id);
      const labelBtn = `<button type="button" class="cd-group-label cd-fold" data-dock="fold" data-g="${esc(g.id)}" data-tooltip="${isFolded ? "Show" : "Hide"} ${esc(g.label)}"><i class="fas fa-caret-${isFolded ? "right" : "down"}"></i> ${esc(g.label)}${isFolded ? ` <span class="cd-fold-n">${shown.length}</span>` : ""}</button>`;
      if (isFolded) { out.push(`<div class="cd-group is-folded">${labelBtn}</div>`); continue; }
      out.push(`<div class="cd-group ${["checks", "saves", "skills", "faculties", "defenses", "aptitudes"].includes(g.id) ? "is-rolls" : ""}">${labelBtn}` + shown.map(e => {
        const spent = e.cost && slotSpent(s.actor, e.cost);
        let hk = "";
        if (!spent && _hotkeys.length < 10) { _hotkeys.push({ entry: e, s }); hk = String(_hotkeys.length % 10); }
        const _mixTip = e.kind === "mani" ? "Your stance picks: Shamanic uses the Action · Chaotic the Bonus action · Hermetic both" : "Cost depends on which ability you pick";
        const costTag = { action: "A", bonus: "B", reaction: "R", mixed: "±" }[e.cost]
          ? `<span class="cd-cost cd-cost-${e.cost}" ${e.cost === "mixed" ? `data-tooltip="${_mixTip}"` : ""}>${{ action: "A", bonus: "B", reaction: "R", mixed: "±" }[e.cost]}</span>` : "";
        const tip = e.tipHTML ?? (e.item ? (hud()?.synopsisFor?.(e.item) ?? esc(e.label)) : `<b>${esc(e.label)}</b><br>${esc(e.tip ?? "")}`);
        const aimTag = (e.kind === "roll5e" || e.noTarget) ? "" : ({ area: "◎", self: "", none: "" }[e.aim] ?? "🎯");
        return `<button type="button" class="cd-ab ${spent ? "is-spent" : ""} ${_aim?.entry === e ? "is-aiming" : ""} ${e.kind === "state" ? `is-state is-${e.polarity}${e.off ? " is-off" : ""}` : ""}" ${spent ? "disabled" : ""}
          data-dock="fire" data-g="${esc(g.id)}" data-k="${esc(e.item?.id ?? e.key)}" data-tooltip="${esc(tip)}">
          ${hk ? `<span class="cd-hk">${hk}</span>` : ""}${e.img ? `<img class="cd-ab-img" src="${esc(e.img)}" alt="">` : e.emoji ? `<span class="cd-emoji">${e.emoji}</span>` : `<i class="fas fa-${esc(e.icon)}"></i>`}
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
    const s = subject();
    const active = !!(s && setting("combatDock", true) && hud());
    const inCombat = !!(c && active);
    applyBars(inCombat);
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
    dock.classList.toggle("is-ooc", !inCombat);
    const canEnd = inCombat && (myTurn || game.user.isGM);
    if (_collapsed) {
      dock.classList.remove("is-placed", "is-sized"); dock.style.width = dock.style.height = dock.style.left = dock.style.top = "";
      dock.innerHTML = `<button type="button" class="cd-pill" data-dock="expand"><i class="fas fa-crosshairs"></i> ${inCombat ? `Combat · R${c.round}${myTurn ? " · YOUR TURN" : ""}` : esc(s.actor.name)}</button>`;
      drawMoveRing(s);
      return;
    }
    const hint = !inCombat ? "" : myTurn ? `<span class="cd-turn-flag">YOUR TURN</span>`
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
        <span class="cd-grip" data-dock-grip data-tooltip="Drag to move the dock · double-click to put it back at the bottom"><i class="fas fa-grip-vertical"></i></span>
        ${inCombat ? ribbonHTML(c, s) : ""}
        <span class="cd-who"><img src="${esc(s.token?.document?.texture?.src || s.actor.img)}" alt=""> ${esc(s.actor.name)}</span>
        ${hint}
        ${slotsHTML(s)}
        ${!IS_5E() ? `<span class="cd-res">${(() => { try { return hud()?.rfi?.resStripHTML?.(s.actor) ?? ""; } catch (_e) { return ""; } })()}</span>` : ""}
        <span class="cd-spacer"></span>
        <span class="cd-target">${targetLineHTML(s)}</span>
        <span class="cd-queued">${offerChips()}${queuedHTML}</span>
        ${game.bbttcc?.superMode && s.actor?.type === "character" ? `<button type="button" class="cd-super" data-dock="super" data-tooltip="Super Mode: call a Draw from the coalition's maneuvers — everyone pledges marks, it fires on your turn">✦ Draw</button>` : ""}
        ${canEnd ? `<button type="button" class="cd-end" data-dock="end"><i class="fas fa-forward"></i> End Turn</button>` : ""}
        ${!inCombat ? "" : `<button type="button" class="cd-icon ${folded ? "" : "is-on"}" data-dock="bars" data-tooltip="${folded ? "Show Foundry's macro bar + sidebar" : "Fold Foundry's macro bar + sidebar away"}"><i class="fas fa-bars"></i></button>`}
        <button type="button" class="cd-icon" data-dock="collapse" data-tooltip="Shrink the dock"><i class="fas fa-chevron-down"></i></button>
        ${!inCombat && _manualOpen && !setting("combatDockAlways", false) ? `<button type="button" class="cd-icon" data-dock="close" data-tooltip="Close the dock (the Abilities button opens it again)"><i class="fas fa-xmark"></i></button>` : ""}
      </div>
      <div class="cd-abilities">${abilitiesHTML(s, myTurn || !inCombat)}</div>
      <span class="cd-resize" data-dock-resize data-tooltip="Drag to resize"></span>`;
    // The dock's own heat meter already shows Surge — drop the tray strip's duplicate Surge chip.
    dock.querySelectorAll(".cd-res .bbttcc-res-chip").forEach(c => { if (/^\s*(<[^>]*>\s*)*Surge\b/i.test(c.innerHTML) || /^\s*Surge\b/i.test(c.textContent)) c.remove(); });
    applyLayout(dock);
    drawMoveRing(s);
    placeDock();
  }

  // The dock sits on the bottom edge — or just above Foundry's macro bar when that's showing,
  // so the ☰ "show the bars" visibly brings it back instead of leaving it under the dock.
  // Banner / log / reaction cards sit just above the dock, whatever its height.
  function placeDock() {
    requestAnimationFrame(() => {
      const dock = document.getElementById(DOCK_ID); if (!dock) return;
      if (dock.classList.contains("is-placed")) {
        const top = dock.getBoundingClientRect().top;
        document.documentElement.style.setProperty("--cd-dock-h", `${Math.max(0, Math.round(window.innerHeight - top - 8))}px`);
        return;
      }
      const hb = document.getElementById("hotbar");
      const r = (!document.body.classList.contains("bbttcc-dock-hidebars") && hb?.offsetParent) ? hb.getBoundingClientRect() : null;
      const bottom = (r && r.height) ? Math.max(8, Math.round(window.innerHeight - r.top + 6)) : 8;
      dock.style.bottom = `${bottom}px`;
      const h = dock.getBoundingClientRect().height;
      if (h) document.documentElement.style.setProperty("--cd-dock-h", `${Math.round(h + bottom - 8)}px`);
    });
  }

  // ── Move / resize (2026-11-12, Dave: "make the interface draggable, resizable, and scrollable") ──
  // Saved per user in localStorage: { left, top, width, height } in px. No layout = the default bottom bar.
  const LAYOUT_KEY = () => `combat-dock-layout:${game.user?.id ?? "anon"}`;
  function loadLayout() { try { return JSON.parse(window.localStorage?.getItem(LAYOUT_KEY()) || "null"); } catch (_e) { return null; } }
  function saveLayout(L) { try { if (L) localStorage.setItem(LAYOUT_KEY(), JSON.stringify(L)); else localStorage.removeItem(LAYOUT_KEY()); } catch (_e) {} }
  function clampLayout(L) {
    const W = window.innerWidth, H = window.innerHeight;
    const width = Math.max(420, Math.min(Number(L.width) || 900, W - 16));
    const height = L.height ? Math.max(90, Math.min(Number(L.height), H - 16)) : null;
    const left = Math.max(8, Math.min(Number(L.left) || 8, W - width - 8));
    const top = Math.max(8, Math.min(Number(L.top) || 8, H - (height ?? 90) - 8));
    return { left, top, width, height };
  }
  function applyLayout(dock) {
    const L = loadLayout();
    if (!L) { dock.classList.remove("is-placed", "is-sized"); dock.style.left = dock.style.top = dock.style.width = dock.style.height = ""; return; }
    const c = clampLayout(L);
    dock.classList.add("is-placed"); dock.classList.toggle("is-sized", !!c.height);
    Object.assign(dock.style, { left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, height: c.height ? `${c.height}px` : "", bottom: "auto" });
  }
  function startDrag(ev, dock, mode) {
    ev.preventDefault(); ev.stopPropagation();
    const r = dock.getBoundingClientRect();
    const start = { x: ev.clientX, y: ev.clientY, left: r.left, top: r.top, width: r.width, height: r.height };
    const cur = loadLayout();
    const base = { left: r.left, top: r.top, width: r.width, height: mode === "resize" ? r.height : (cur?.height ?? null) };
    dock.classList.add("is-placed", "is-dragging");
    const move = (e) => {
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      const L = mode === "move" ? { ...base, left: start.left + dx, top: start.top + dy } : { ...base, width: start.width + dx, height: start.height + dy };
      const c = clampLayout(L);
      Object.assign(dock.style, { left: `${c.left}px`, top: `${c.top}px`, width: `${c.width}px`, bottom: "auto", ...(c.height ? { height: `${c.height}px` } : {}) });
      dock.classList.toggle("is-sized", !!c.height);
      dock._cdLayout = c;
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      dock.classList.remove("is-dragging");
      if (dock._cdLayout) saveLayout(dock._cdLayout);
      dock._cdLayout = null;
      placeDock();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  window.addEventListener("resize", foundry.utils.debounce(() => { const d = document.getElementById(DOCK_ID); if (d) { applyLayout(d); placeDock(); } }, 150));

  function wireDock(dock) {
    dock.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      if (ev.target.closest("[data-dock-grip]")) return startDrag(ev, dock, "move");
      if (ev.target.closest("[data-dock-resize]")) return startDrag(ev, dock, "resize");
    });
    dock.addEventListener("dblclick", (ev) => {
      if (!ev.target.closest("[data-dock-grip]")) return;
      saveLayout(null); applyLayout(dock); placeDock();
    });
    dock.addEventListener("click", async (ev) => {
      const pan = ev.target.closest("[data-pan]");
      if (pan) {
        const tok = canvas.tokens.get(pan.dataset.pan);
        if (tok) { canvas.animatePan({ x: tok.center.x, y: tok.center.y, duration: 250 }); if (game.user.isGM) tok.control({ releaseOthers: true }); }
        return;
      }
      const res = ev.target.closest(".cd-res [data-fire]");
      if (res) { const s0 = subject(); if (s0 && res.dataset.fire === "pool") hud()?.fire?.pool?.(s0.actor, res.dataset.key); return; }
      const b = ev.target.closest("[data-dock]"); if (!b) return;
      if (b.dataset.dock === "close") { setManualOpen(false); return render(); }
      const s = subject(); if (!s) return;
      switch (b.dataset.dock) {
        case "fire": { const e = findEntry(s, b.dataset.g, b.dataset.k); if (e) activate(e, s); return; }
        case "fold": toggleFold(b.dataset.g); return render();
        case "offer": {
          const o = _offers.get(b.dataset.offer); _offers.delete(b.dataset.offer); render();
          const msg = o ? game.messages?.get?.(o.msgId) : null; if (!msg) return;
          const r = await game.fourththing?.triggers?.accept?.(msg);
          if (r && !r.ok && r.reason) ui.notifications?.warn?.(r.reason);
          return;
        }
        case "surge": return IS_5E() ? game.surgePowers?.openMenu?.(s.actor) : hud()?.fire?.pool?.(s.actor, "surge");
        case "end": {
          if (_aim) endAim();
          try { await game.combat?.nextTurn(); } catch (e) { ui.notifications?.warn?.("Couldn't end the turn — ask the GM."); warn(e); }
          return;
        }
        case "bars": _foldPref = !wantFold(); return render();
        case "collapse": _collapsed = true; try { localStorage.setItem(COLL_KEY(), "1"); } catch (_e) {} return render();
        case "expand": _collapsed = false; try { localStorage.setItem(COLL_KEY(), "0"); } catch (_e) {} return render();
        case "super": return game.bbttcc?.superMode?.openPicker?.(s.actor);
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
  // Round 4 (Dave 2026-11-06): an offer outlives its 8-second card. It waits on the dock as a chip until it's taken, passed or spent.
  const _offers = new Map();
  function offerChips() {
    for (const [k, o] of _offers) { const m = game.messages?.get?.(o.msgId); if (!m || m.flags?.fourththing?.triggerOffer?.used) _offers.delete(k); }
    return [..._offers.entries()].map(([k, o]) => `<button type="button" class="cd-q is-act" data-dock="offer" data-offer="${esc(k)}" data-tooltip="${esc(o.tip)}"><i class="fas fa-bolt"></i> ${esc(o.title.length > 30 ? `${o.title.slice(0, 29)}…` : o.title)}</button>`).join("");
  }
  function reactionCard({ title, body, onTake, onPass }) {
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
      else { try { onPass?.(); } catch (_e) {} }
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
        const key = `${off.actorUuid}::${off.itemId}::${off.triggerIndex}`;
        let tip = title; try { const d = document.createElement("div"); d.innerHTML = msg.content ?? ""; tip = d.textContent.replace(/\s+/g, " ").trim(); } catch (_e) {}
        _offers.set(key, { msgId: msg.id, title: title.replace(/^[^\p{L}]+/u, ""), tip });
        renderSoon();
        reactionCard({ title, body: `${a.name} can react — take it?`, onTake: async () => {
          _offers.delete(key); renderSoon();
          const r = await game.fourththing?.triggers?.accept?.(msg);
          if (r && !r.ok && r.reason) ui.notifications?.warn?.(r.reason);
        }, onPass: () => { _offers.delete(key); renderSoon(); } });
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
    try { _manualOpen = window.localStorage?.getItem(OPEN_KEY()) === "1"; } catch (_e) {}
    // 11-12: open / close / toggle from other UI (the RFI player HUD's Abilities button).
    const api = {
      open() { setManualOpen(true); if (_collapsed) { _collapsed = false; try { localStorage.setItem(COLL_KEY(), "0"); } catch (_e) {} } render(); },
      close() { setManualOpen(false); render(); },
      toggle() {
        const shown = !!document.getElementById(DOCK_ID);
        if (combatHere() && shown) { _collapsed = !_collapsed; try { localStorage.setItem(COLL_KEY(), _collapsed ? "1" : "0"); } catch (_e) {} return render(); }
        if (shown && !_collapsed) return api.close();
        return api.open();
      },
      get isOpen() { return !!document.getElementById(DOCK_ID); }
    };
    game.combatDock = api;
    if (game.bbttcc) game.bbttcc.combatDock = api;
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
  // 11-12: out of combat the dock follows the selected token for everyone (players without an assigned character too).
  Hooks.on("controlToken", () => { if (game.user.isGM || !combatHere()) renderSoon(); });
  Hooks.on("updateToken", (doc) => { const s = subject(); if (s?.token && doc.id === s.token.id) renderSoon(); });
  Hooks.on("refreshToken", (tok) => { const s = subject(); if (s?.token && tok.id === s.token.id) drawMoveRing(s); });
  Hooks.on("createChatMessage", (msg) => {
    try { logLine(msg); } catch (_e) {}
    try { onChatForReactions(msg); } catch (e) { warn("reaction card failed", e); }
  });
})();
