// modules/bbttcc-territory/scripts/player-hud.enhancer.js
// Player heads-up display: Faction / Steward / Abilities tray, pinned to canvas.
// Mirrors the GM toolbar look-and-feel (see #bbttcc-toolbar styles).
//
// 2026-05-24 heavy refactor:
//   1) Steward button now opens EITHER the steward sheet OR a rig the steward
//      owns/rides in this scene (picker when both exist), independent of which
//      token is controlled — so a boarded player no longer has the rig sheet
//      hijack their Steward button.
//   2) The Abilities tray is a full accordion that surfaces every USABLE thing
//      from the steward sheet — Faculties, Defenses, Steward Abilities,
//      Ancestry, Strikes, Manifestations, plus a resource strip (Frame Dice,
//      Burn, Authority, Jurisdiction, …) — so the sheet never has to be open.
//   3) Actions fired from the HUD emanate from the RIG token while boarded:
//      before firing we sync the steward's (hidden) token onto the rig so the
//      system's getActiveTokens()[0] origin lookup resolves to the rig.
//
// The HUD lives in bbttcc-territory, so it only calls things exposed on
// game.fourththing.* (rolls.attributeTest, _classAutomation.*, ftOpenEngageDialog,
// ftOpenCastDialog, classifyPrinciple, castManifestation) — never sheet internals.

(() => {
  const TAG = "[bbttcc-ui/player-hud]";
  const HUD_ID = "bbttcc-player-hud";
  const TRAY_ID = "bbttcc-player-hud-tray";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);
  const esc  = (s)=>foundry.utils.escapeHTML(String(s ?? ""));
  const cap  = (s)=>{ s=String(s??""); return s.charAt(0).toUpperCase()+s.slice(1); };

  // ── Accordion open/closed state (per user, persisted) ───────────────────
  const SEC_KEY = () => `bbttcc-player-hud-acc:${game.user?.id ?? "anon"}`;
  const SEC_DEFAULTS = {
    faculties: true, defenses: false, abilities: true,
    echo: true, ancestry: false, strikes: true, manifestations: true, states: false
  };
  let _secOpen = { ...SEC_DEFAULTS };
  function loadSecState() {
    try {
      const raw = window.localStorage?.getItem(SEC_KEY());
      if (raw) _secOpen = { ...SEC_DEFAULTS, ...JSON.parse(raw) };
    } catch (_e) { _secOpen = { ...SEC_DEFAULTS }; }
  }
  function saveSecState() {
    try { window.localStorage?.setItem(SEC_KEY(), JSON.stringify(_secOpen)); } catch (_e) {}
  }

  // ── Steward item classification (path / ancestry / identity / echo) ──────
  // Resolved by the system helper game.fourththing.classifyStewardItems, which
  // can see class/ancestry grant data the HUD can't. Cached per actor; render
  // uses the cache + a type fallback and re-renders when the async refine lands.
  let _groupCache = { actorId: null, map: {} };
  async function refreshGroups(steward, host) {
    if (!steward) return;
    let map = {};
    try {
      const fn = game.fourththing?.classifyStewardItems;
      if (typeof fn === "function") map = (await fn(steward)) || {};
    } catch (e) { warn("classifyStewardItems failed", e); }
    _groupCache = { actorId: steward.id, map };
    if (host && document.getElementById(TRAY_ID) && getSteward()?.id === steward.id) renderTray(host);
  }
  function groupOf(item) { return _groupCache.map?.[item?.id] ?? null; }
  function fallbackGroup(item) {
    return (item?.type === "race" || item?.type === "species") ? "ancestry" : "other";
  }
  function isManifestationItem(item) {
    try {
      const fn = game.fourththing?.items?.is?.isManifestation;
      if (typeof fn === "function") return !!fn(item);
    } catch (_e) {}
    return item?.type === "power";
  }

  function shouldShow() {
    return !!game.user && !game.user.isGM;
  }

  // ── Actor resolution ────────────────────────────────────────────────────
  function isFactionActor(a) {
    if (!a) return false;
    try {
      if (a.getFlag?.("bbttcc-factions","isFaction") === true) return true;
      const t = String(foundry.utils.getProperty(a,"system.details.type.value")||"").toLowerCase();
      if (t === "faction") return true;
      const cls = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
      return String(cls||"").includes("BBTTCCFactionSheet");
    } catch { return false; }
  }

  // The player's STEWARD — their assigned character if it's a PC (never a rig
  // or faction), else a controlled non-rig PC token they own, else the first
  // owned character actor. Deliberately decoupled from the controlled token so
  // a boarded player (controlling the rig) still drives steward abilities.
  function getSteward() {
    const isPC = (a) => a && a.type === "character" && !isFactionActor(a);
    const assigned = game.user?.character ?? null;
    if (isPC(assigned)) return assigned;
    const ctrl = (canvas?.tokens?.controlled ?? [])
      .map(t => t.actor)
      .find(a => isPC(a) && a.testUserPermission?.(game.user, "OWNER"));
    if (ctrl) return ctrl;
    return (game.actors?.contents ?? [])
      .find(a => isPC(a) && a.testUserPermission?.(game.user, "OWNER")) ?? assigned ?? null;
  }

  function getBoardedRig(steward) {
    const b = steward?.getFlag?.("fourththing", "boardedRig");
    const rig = b?.rigId ? game.actors?.get(b.rigId) : null;
    return rig && rig.type === "rig" ? rig : null;
  }

  // Rigs present on the current scene the player can at least observe.
  function getSceneRigs() {
    const scene = canvas?.scene;
    if (!scene) return [];
    const seen = new Set();
    const out = [];
    for (const t of scene.tokens) {
      const a = t.actor;
      if (!a || a.type !== "rig" || seen.has(a.id)) continue;
      if (!a.testUserPermission?.(game.user, "OBSERVER")) continue;
      seen.add(a.id);
      out.push(a);
    }
    return out;
  }

  function isFactionOwned(a, user) {
    return isFactionActor(a) && a.testUserPermission(user, "OWNER");
  }
  function getOwnedFactions() {
    const user = game.user;
    if (!user) return [];
    return (game.actors?.contents ?? []).filter(a => isFactionOwned(a, user));
  }

  // ── Emanate-from-rig: keep the boarded steward token on the rig so the
  // system's origin lookup (actor.getActiveTokens()[0]) measures range/AoE
  // from the rig. The GM-side follow-sync handles live moves; this is the
  // belt-and-suspenders pass right before a HUD-fired action. Gated by the
  // boardedRig flag, so it won't trip the (now passenger-gated) on-move proc.
  async function ensureEmanateFromRig(steward) {
    try {
      const rig = getBoardedRig(steward);
      const scene = canvas?.scene;
      if (!rig || !scene) return;
      const rigTok = scene.tokens.find(t => t.actorId === rig.id);
      if (!rigTok) return;
      const updates = scene.tokens
        .filter(t => t.actorId === steward.id && (t.x !== rigTok.x || t.y !== rigTok.y))
        .map(t => {
          const u = { _id: t.id, x: rigTok.x, y: rigTok.y };
          if (rigTok.elevation != null) u.elevation = rigTok.elevation;
          return u;
        });
      if (updates.length) await scene.updateEmbeddedDocuments("Token", updates);
    } catch (e) { warn("emanate-from-rig sync failed", e); }
  }

  // ── Sheet openers ───────────────────────────────────────────────────────
  async function openFaction() {
    const factions = getOwnedFactions();
    if (!factions.length) {
      ui.notifications?.warn?.("No faction assigned to you yet — ask the GM to grant ownership.");
      return;
    }
    if (factions.length === 1) return factions[0].sheet?.render(true, { focus:true });
    const opts = factions.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join("");
    new Dialog({
      title: "Open Faction",
      content: `<div class="form-group"><label>Faction</label><select name="fid" style="width:100%;">${opts}</select></div>`,
      buttons: {
        open: { icon:'<i class="fas fa-flag"></i>', label:"Open", callback: html => {
          const fid = String(html.find('select[name="fid"]').val()||"");
          game.actors?.get(fid)?.sheet?.render(true, { focus:true });
        }},
        cancel: { icon:'<i class="fas fa-times"></i>', label:"Cancel" }
      },
      default: "open"
    }).render(true);
  }

  // Steward button — open the Steward sheet OR a rig the steward owns/rides
  // here. Picker when more than one target exists (the boarded rig is listed
  // first); otherwise opens directly.
  function openStewardOrRig() {
    const steward = getSteward();
    const targets = [];
    if (steward) targets.push({ actor: steward, label: `Steward — ${steward.name}`, icon: "user-shield" });

    const seen = new Set(steward ? [steward.id] : []);
    const bRig = getBoardedRig(steward);
    if (bRig && !seen.has(bRig.id)) { targets.push({ actor: bRig, label: `Rig (riding) — ${bRig.name}`, icon: "truck-monster" }); seen.add(bRig.id); }
    for (const r of getSceneRigs()) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      targets.push({ actor: r, label: `Rig — ${r.name}`, icon: "truck-monster" });
    }

    if (!targets.length) {
      ui.notifications?.warn?.("No assigned character. Set one in User Configuration.");
      return;
    }
    if (targets.length === 1) return targets[0].actor.sheet?.render(true, { focus:true });

    const buttons = {};
    targets.forEach((t, i) => {
      buttons["t" + i] = {
        icon: `<i class="fas fa-${t.icon}"></i>`,
        label: t.label,
        callback: () => t.actor.sheet?.render(true, { focus:true })
      };
    });
    new Dialog({
      title: "Open Sheet",
      content: `<p style="margin:0 0 6px;">You're piloting more than one thing — open which sheet?</p>`,
      buttons,
      default: "t0"
    }, { width: 420 }).render(true);
  }

  function openTravelConsole() {
    try {
      const tc = game?.bbttcc?.ui?.travelConsole;
      if (!tc) { ui?.notifications?.warn?.("Travel Console not ready yet."); return; }
      tc.render(true);
    } catch (e) { warn("openTravelConsole failed", e); }
  }

  // ── Section data collectors ─────────────────────────────────────────────
  const FACULTIES = [
    ["violence","Violence"], ["intrigue","Intrigue"], ["presence","Presence"],
    ["body","Body"], ["mind","Mind"], ["soul","Soul"]
  ];
  const DEFENSES = [ ["guard","Guard"], ["evasion","Evasion"], ["resolve","Resolve"] ];

  function isActionable(it) {
    const fn = game.fourththing?._classAutomation?.isActionableFeature;
    return typeof fn === "function" ? !!fn(it) : true;
  }
  function abilitySorter(a, b) {
    const tw = (t) => ({ class:0, subclass:1, feature:2, feat:3, race:4, species:4 }[t] ?? 9);
    return tw(a.type) - tw(b.type) || a.name.localeCompare(b.name);
  }
  // Bucket the steward's usable items into HUD sections using the system's
  // authoritative group classification (cached) with a type fallback. Weapons
  // split by isManifestation: mundane → Strikes, form-manifestations → Manifest.
  function collectSections(steward) {
    const featLike = new Set(["feat","feature","class","subclass","race","species"]);
    const abilities = [], ancestry = [], echo = [], strikes = [], manifs = [];
    for (const it of (steward.items?.contents ?? [])) {
      if (featLike.has(it.type)) {
        if (!isActionable(it)) continue;
        const g = groupOf(it) ?? fallbackGroup(it);
        if (g === "ancestry") ancestry.push(it);
        else if (g === "echo") echo.push(it);
        else abilities.push(it);
      } else if (it.type === "weapon") {
        (isManifestationItem(it) ? manifs : strikes).push(it);
      } else if (it.type === "power") {
        manifs.push(it);
      }
    }
    abilities.sort(abilitySorter); ancestry.sort(abilitySorter); echo.sort(abilitySorter);
    strikes.sort((a,b)=>a.name.localeCompare(b.name));
    manifs.sort((a,b)=>a.name.localeCompare(b.name));
    return { abilities, ancestry, echo, strikes, manifs };
  }
  function abilityIcon(item) {
    switch (item.type) {
      case "power":      return "wand-magic-sparkles";
      case "weapon":     return isManifestationItem(item) ? "hand-sparkles" : "khanda";
      case "consumable": return "flask";
      case "race": case "species": return "dna";
      case "class": case "subclass": return "chess-knight";
      default:           return "bolt";
    }
  }

  // ── Resource strip ──────────────────────────────────────────────────────
  // Surge is now the central engine of action — every class spends from one
  // Surge pool via the unified spend table (system: game.fourththing.surge.
  // openSpendDialog). The old per-class pools (Bulwark Frame Dice / Ruin Charges,
  // Shadow Courier Pace, Cosmic Linguist Authority, Pactkeeper Jurisdiction) were
  // FOLDED INTO SURGE during the Phase-4 redesign, so they're no longer shown
  // here. Clarity + Surge are universal; Burn (Aurablade / forge heat) survives.
  const CLASS_POOL_KEYS = {
    aurablade: ["burn"]
  };
  const POOL_DEFS = {
    clarity: { label:"Clarity", icon:"brain",             path:"system.magic.clarity",      open:null },
    surge:   { label:"Surge",   icon:"bolt-lightning",    path:"system.resources.surge",    open:"__surge" },
    burn:    { label:"Burn",    icon:"fire-flame-curved", path:"system.resources.burn",     open:"openStabilizeBurn" }
  };
  const POOL_ORDER = ["clarity","surge","burn"];

  function getStewardClassKeys(steward) {
    return (steward.items?.contents ?? [])
      .filter(i => i.type === "class")
      .map(i => String(i.system?.identifier || "").toLowerCase().replace(/-/g, "_"));
  }
  function poolsFor(steward) {
    const keys = new Set(["clarity", "surge"]);
    for (const c of getStewardClassKeys(steward)) for (const p of (CLASS_POOL_KEYS[c] || [])) keys.add(p);
    return POOL_ORDER.filter(k => keys.has(k));
  }
  function readPool(steward, key) {
    const def = POOL_DEFS[key];
    const obj = foundry.utils.getProperty(steward, def.path);
    if (!obj || typeof obj !== "object") return null;
    const cur = Number(obj.current ?? obj.value ?? 0);
    const max = (obj.max != null) ? Number(obj.max) : null;
    return { cur, max };
  }
  function resStripHTML(steward) {
    const keys = poolsFor(steward);
    if (!keys.length) return "";
    const chips = keys.map(key => {
      const def = POOL_DEFS[key];
      const v = readPool(steward, key);
      if (!v) return "";
      const valTxt = (v.max != null) ? `${v.cur}/${v.max}` : `${v.cur}`;
      // Surge opens the unified spend table; other pools fire their class handler.
      const clickable = (key === "surge")
        ? !!game.fourththing?.surge?.openSpendDialog
        : !!(def.open && def.open !== "__surge" && game.fourththing?._classAutomation?.[def.open]);
      const empty = (v.cur <= 0);
      return `<button type="button" class="bbttcc-res-chip ${clickable?'is-clickable':''} ${empty?'is-empty':''}"
        ${clickable ? `data-fire="pool" data-key="${key}"` : 'disabled'}
        title="${esc(def.label)}${clickable ? (key === "surge" ? ' — click to spend' : ' — click to use') : ''}">
        <i class="fas fa-${def.icon}"></i><span>${esc(def.label)}</span>
        <span class="bbttcc-res-val">${valTxt}</span>
      </button>`;
    }).join("");
    return `<div class="bbttcc-resstrip">${chips}</div>`;
  }

  // Prominent "Spend Surge" action — the headline of the new action economy.
  // Opens the full spend table (class kit + universal options). Disabled with a
  // reason when nothing is banked or Surge is gated off for a foe.
  function surgeActionHTML(steward) {
    const obj = foundry.utils.getProperty(steward, "system.resources.surge") ?? {};
    const cur = Number(obj.value ?? 0);
    const max = Number(obj.max ?? 0);
    const hasApi = !!game.fourththing?.surge?.openSpendDialog;
    const disabled = !hasApi || cur <= 0;
    const reason = !hasApi ? "Surge engine not ready"
                 : cur <= 0 ? "No Surge banked yet"
                 : "Open the Surge spend table — your class kit + universal options";
    return `<div class="bbttcc-surge-action" style="padding:.1rem .4rem .45rem;">
      <button type="button" class="bbttcc-res-chip bbttcc-surge-spend ${disabled?'is-empty':'is-clickable'}"
        ${disabled ? 'disabled' : 'data-fire="pool" data-key="surge"'}
        title="${esc(reason)}"
        style="width:100%;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.35rem .5rem;font-weight:600;">
        <i class="fas fa-bolt-lightning"></i> Spend Surge
        <span class="bbttcc-res-val">${cur}${max?`/${max}`:''} ◆</span>
      </button>
    </div>`;
  }

  // ── Active-states helpers (kept from v1) ────────────────────────────────
  function effectDurationLabel(eff) {
    try {
      const d = eff.duration ?? {};
      if (d.rounds)  return `${d.rounds}r`;
      if (d.turns)   return `${d.turns}t`;
      if (d.seconds) return `${Math.ceil(d.seconds/60)}m`;
      if (d.label)   return String(d.label);
      return "∞";
    } catch { return "∞"; }
  }
  function effectPolarity(eff) {
    try {
      let score = 0;
      for (const c of (eff.changes ?? [])) {
        const v = String(c.value ?? "").trim();
        if (!v) continue;
        const n = parseFloat(v);
        if (!Number.isNaN(n)) score += n;
        else if (/^[-]/.test(v)) score -= 1;
        else if (/^[+]/.test(v)) score += 1;
      }
      return score > 0 ? "buff" : score < 0 ? "debuff" : "neutral";
    } catch { return "neutral"; }
  }

  // ── Section HTML builders ───────────────────────────────────────────────
  function btn(dataAttrs, icon, label, title) {
    return `<button type="button" class="bbttcc-btn" ${dataAttrs} title="${esc(title ?? label)}">
      <i class="fas fa-${icon}"></i><span>${esc(label)}</span>
    </button>`;
  }

  function facultiesBody(steward) {
    return FACULTIES.map(([key, label]) => {
      const v = Number(foundry.utils.getProperty(steward, `system.attributes.${key}.value`) ?? 0);
      const sign = v >= 0 ? "+" : "";
      return btn(`data-fire="faculty" data-key="${key}"`, "dice-d20", `${label} ${sign}${v}`, `Roll ${label}`);
    }).join("");
  }
  function defensesBody(steward) {
    return DEFENSES.map(([key, label]) => {
      const v = Number(foundry.utils.getProperty(steward, `system.derived.${key}.value`) ?? 10);
      return btn(`data-fire="defense" data-key="${key}"`, "shield", `${label} ${v}`, `Roll ${label} (DC ${v})`);
    }).join("");
  }
  // ── Hover synopsis (playtest 2026-06-06) ─────────────────────────────────
  // Rich data-tooltip for ability buttons: name + a compact stat strip
  // (damage/heal dice, AoE, range, cost, action type) + a trimmed description.
  // Rendered by Foundry's TooltipManager, so light HTML is fine — all dynamic
  // text is escaped before being wrapped in tags.
  function synopsisFor(it) {
    const sys = it?.system ?? {};
    const mf  = sys.manifestation ?? {};
    const bits = [];
    const dr = sys.damageRoll ?? {};
    const dmgF = String(sys.damage?.formula ?? "").trim()
      || ((dr.op && dr.op !== "none" && Number(dr.number) > 0) ? `${dr.number}${dr.die ?? "d6"}` : "");
    if (dmgF) {
      const heal = dr.op === "heal";
      const dmgT = heal ? (dr.track ?? "") : String(sys.damage?.type ?? dr.type ?? "");
      bits.push(`${heal ? "❤" : "⚔"} ${dmgF}${dmgT ? ` ${dmgT}` : ""}`);
    }
    if (mf.area?.shape && mf.area.shape !== "none") bits.push(`◎ ${mf.area.size ?? "?"}ft ${mf.area.shape}`);
    const rng = Number(mf.rangeFt) ? `${mf.rangeFt}ft`
      : (mf.rangeAreaText ? String(mf.rangeAreaText)
      : (sys.range?.short ? `${sys.range.short} sq` : ""));
    if (rng) bits.push(`→ ${rng}`);
    if (mf.costType && mf.costType !== "none") bits.push(`✦ ${[mf.costValue, mf.costType].filter(Boolean).join(" ")}`);
    if (mf.maintenanceCost) bits.push(`↻ ${mf.maintenanceCost}`);
    const act = mf.activation?.type ?? sys.activation?.type;
    if (act) bits.push(`⏱ ${act}`);
    let desc = String(sys.description?.value ?? sys.effect ?? sys.body ?? sys.flavor ?? "")
      .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (desc.length > 260) desc = desc.slice(0, 257) + "…";
    const parts = [`<b>${esc(it.name)}</b>`];
    if (bits.length) parts.push(`<span style="opacity:.85">${esc(bits.join(" · "))}</span>`);
    if (desc) parts.push(esc(desc));
    return parts.join("<br>");
  }

  function itemsBody(items, fireKindOf, iconOverride) {
    return items.map(it => {
      const kind = (typeof fireKindOf === "function") ? fireKindOf(it) : fireKindOf;
      const icon = iconOverride ?? abilityIcon(it);
      // data-tooltip carries the rich synopsis; title is blanked so the native
      // browser tooltip doesn't double up with Foundry's.
      return btn(`data-fire="${kind}" data-item-id="${esc(it.id)}" data-tooltip="${esc(synopsisFor(it))}"`, icon, it.name, "");
    }).join("");
  }
  function statesBody(steward) {
    const effects = (steward.effects?.contents ?? []).filter(e => !!e);
    if (!effects.length) return "";
    return effects.map(eff => {
      const id = esc(eff.id);
      const name = esc(eff.name ?? eff.label ?? "Effect");
      const icon = esc(eff.icon ?? eff.img ?? "icons/svg/aura.svg");
      const dur = esc(effectDurationLabel(eff));
      const pol = effectPolarity(eff);
      const dis = eff.disabled ? "is-disabled" : "";
      return `<button type="button" class="bbttcc-state-chip ${pol} ${dis}" data-effect-id="${id}" title="${name}${eff.disabled?' (disabled)':''}">
        <img src="${icon}" alt="" /><span class="bbttcc-state-name">${name}</span><span class="bbttcc-state-dur">${dur}</span>
      </button>`;
    }).join("");
  }

  function section(id, title, count, bodyHTML) {
    const collapsed = !_secOpen[id];
    return `<div class="bbttcc-acc-section ${collapsed?'is-collapsed':''}" data-sec="${id}">
      <button type="button" class="bbttcc-acc-header" data-sec-toggle="${id}">
        <span class="bbttcc-acc-chev"><i class="fas fa-chevron-${collapsed?'right':'down'}"></i></span>
        <span class="bbttcc-acc-title">${esc(title)}</span>
        <span class="bbttcc-acc-count">${count}</span>
      </button>
      <div class="bbttcc-acc-body">${bodyHTML}</div>
    </div>`;
  }

  function abilitiesTrayHTML(steward) {
    const { abilities, ancestry, echo, strikes, manifs } = collectSections(steward);
    const states = (steward.effects?.contents ?? []).filter(e => !!e);
    // Manifestations mix powers (Invoke→cast) and form-weapons (Engage→strike);
    // fire each through the same path the sheet uses for that kind.
    const manifFireKind = (it) => it.type === "power" ? "mani" : "strike";

    const parts = [];
    parts.push(resStripHTML(steward));
    parts.push(surgeActionHTML(steward));
    parts.push(section("faculties", "Faculties", 6, facultiesBody(steward)));
    parts.push(section("defenses",  "Defenses",  3, defensesBody(steward)));
    if (abilities.length) parts.push(section("abilities", "Steward Abilities", abilities.length, itemsBody(abilities, "ability")));
    if (ancestry.length)  parts.push(section("ancestry",  "Ancestry Abilities", ancestry.length, itemsBody(ancestry, "ability")));
    if (echo.length) {
      const echoInvokeBtns = `<div class="bbttcc-echo-actions" style="display:flex;gap:.35rem;padding:.3rem .4rem .4rem;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:.3rem;">
        <button type="button" data-ft-spotlight="crew" title="Spotlight a member from an active crew — one beat per scene" style="padding:.2rem .55rem;display:flex;align-items:center;gap:.25rem;font-size:.82rem;"><i class="fas fa-star"></i> Invoke Crew</button>
        <button type="button" data-ft-spotlight="occult" title="Spotlight a member from an active association — one beat per scene" style="padding:.2rem .55rem;display:flex;align-items:center;gap:.25rem;font-size:.82rem;"><i class="fas fa-star"></i> Invoke Association</button>
      </div>`;
      parts.push(section("echo", "Echo Assets", echo.length, echoInvokeBtns + itemsBody(echo, "ability", "ghost")));
    }
    if (strikes.length)   parts.push(section("strikes",   "Strikes", strikes.length, itemsBody(strikes, "strike")));
    if (manifs.length)    parts.push(section("manifestations", "Manifestations", manifs.length, itemsBody(manifs, manifFireKind)));
    if (states.length)    parts.push(section("states", "Active States", states.length, statesBody(steward)));
    return parts.join("");
  }

  // ── Fire dispatchers ────────────────────────────────────────────────────
  async function fireFaculty(steward, key) {
    const rolls = game.fourththing?.rolls;
    if (rolls?.attributeTest) return rolls.attributeTest(steward, { attribute: key });
    ui.notifications?.warn?.("Roll engine not ready.");
  }
  async function fireDefense(steward, which) {
    const v = Number(foundry.utils.getProperty(steward, `system.derived.${which}.value`) ?? 10);
    const roll = await new Roll(`2d10x10 + ${v}`).roll();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: steward }),
      flavor: `${steward.name} — ${cap(which)} check (DC ${v})`
    });
  }
  async function fireAbility(steward, item) {
    await ensureEmanateFromRig(steward);
    const dispatch = game.fourththing?._classAutomation?.dispatchFeatureAction;
    if (typeof dispatch === "function") {
      try {
        const handled = await dispatch(steward, item);
        if (handled !== null && handled !== undefined) return handled;
      } catch (e) { warn(`dispatch failed for "${item.name}"`, e); }
    }
    // Fallbacks for non-routed items.
    for (const fn of [
      () => typeof item.use === "function" ? item.use({}, { event: window.event }) : null,
      () => typeof item.roll === "function" ? item.roll() : null,
      () => typeof item.displayCard === "function" ? item.displayCard() : null,
      () => typeof item.toMessage === "function" ? item.toMessage() : null
    ]) {
      try { const r = await fn(); if (r !== null && r !== undefined && r !== false) return r; }
      catch (e) { warn(`Ability path failed for "${item.name}"`, e); }
    }
    item.sheet?.render(true, { focus:true });
  }
  async function fireStrike(steward, weapon) {
    await ensureEmanateFromRig(steward);
    const fn = game.fourththing?.ftOpenEngageDialog;
    if (typeof fn === "function") return fn(steward, weapon);
    return weapon.sheet?.render(true, { focus:true });
  }
  async function fireManifestation(steward, power) {
    await ensureEmanateFromRig(steward);
    const fn = game.fourththing?.ftOpenCastDialog;
    if (typeof fn === "function") return fn(steward, power);
    return power.sheet?.render(true, { focus:true });
  }
  async function firePool(steward, key) {
    // Surge → open the unified spend table (the engine of action).
    if (key === "surge") {
      const fn = game.fourththing?.surge?.openSpendDialog;
      if (typeof fn !== "function") return ui.notifications?.warn?.("Surge spend table not ready.");
      await ensureEmanateFromRig(steward);
      return fn(steward);
    }
    const def = POOL_DEFS[key];
    const handler = def?.open && game.fourththing?._classAutomation?.[def.open];
    if (typeof handler !== "function") return;
    await ensureEmanateFromRig(steward);
    return handler(steward);
  }

  // ── Tray sizing (playtest 2026-06-06: "standard expandable, scrollable
  //    window"). Size persists per user; ⛶ toggles an expanded preset; the
  //    bottom-right grip drag-resizes like a normal window.
  const SIZE_KEY = () => `bbttcc-player-hud-tray-size:${game.user?.id ?? "anon"}`;
  function loadTraySize() {
    try { return JSON.parse(window.localStorage?.getItem(SIZE_KEY()) || "null"); } catch (_e) { return null; }
  }
  function saveTraySize(sz) {
    try { window.localStorage?.setItem(SIZE_KEY(), JSON.stringify(sz ?? null)); } catch (_e) {}
  }
  function applyTraySize(tray) {
    const sz = loadTraySize();
    if (!sz) return;
    if (sz.expanded) {
      tray.classList.add("is-expanded");
      tray.style.maxHeight = "85vh";
      return;
    }
    if (sz.w) tray.style.width = `${sz.w}px`;
    if (sz.h) { tray.style.height = `${sz.h}px`; tray.style.maxHeight = "none"; }
  }
  function wireTrayResize(tray) {
    const grip = tray.querySelector("[data-tray-grip]");
    if (!grip) return;
    grip.addEventListener("pointerdown", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const startX = ev.clientX, startY = ev.clientY;
      const r = tray.getBoundingClientRect();
      tray.style.maxHeight = "none";
      tray.classList.remove("is-expanded");
      const onMove = (mv) => {
        tray.style.width  = `${Math.max(380, r.width  + (mv.clientX - startX))}px`;
        tray.style.height = `${Math.max(140, r.height + (mv.clientY - startY))}px`;
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const fr = tray.getBoundingClientRect();
        saveTraySize({ w: Math.round(fr.width), h: Math.round(fr.height), expanded: false });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  // ── Tray render ─────────────────────────────────────────────────────────
  function renderTray(host) {
    const steward = getSteward();
    let tray = document.getElementById(TRAY_ID);
    if (tray) tray.remove();

    tray = document.createElement("div");
    tray.id = TRAY_ID;
    tray.className = "bbttcc-player-hud-tray";

    if (!steward) {
      tray.innerHTML = `<div class="bbttcc-player-hud-empty">No steward found — assign a character in User Configuration.</div>`;
      host.appendChild(tray);
      return;
    }

    // Refine item grouping (accurate Ancestry / Echo / Steward buckets). Async
    // — needs class/ancestry grant data — so render now with the cache + type
    // fallback, then re-render when the refine lands.
    if (_groupCache.actorId !== steward.id) refreshGroups(steward, host);

    const rig = getBoardedRig(steward);
    const badge = rig
      ? `<span class="bbttcc-hud-badge" title="Acting from ${esc(rig.name)} — abilities emanate from the rig"><i class="fas fa-truck-monster"></i>${esc(rig.name)}</span>`
      : "";

    tray.innerHTML = `
      <div class="bbttcc-player-hud-tray-header">
        <span>${esc(steward.name)}${badge}</span>
        <span class="bbttcc-tray-winbtns">
          <button type="button" data-tray-expand title="Expand / restore">⛶</button>
          <button type="button" data-tray-close title="Close">✕</button>
        </span>
      </div>
      <div class="bbttcc-player-hud-tray-body">${abilitiesTrayHTML(steward)}</div>
      <div class="bbttcc-tray-grip" data-tray-grip title="Drag to resize"></div>
    `;
    applyTraySize(tray);
    wireTrayResize(tray);

    tray.addEventListener("click", async (ev) => {
      // Window buttons — expand/restore preset + close.
      if (ev.target.closest("button[data-tray-close]")) {
        ev.preventDefault(); ev.stopPropagation();
        tray.remove();
        return;
      }
      if (ev.target.closest("button[data-tray-expand]")) {
        ev.preventDefault(); ev.stopPropagation();
        const nowExpanded = !tray.classList.contains("is-expanded");
        tray.classList.toggle("is-expanded", nowExpanded);
        tray.style.width = ""; tray.style.height = "";
        tray.style.maxHeight = nowExpanded ? "85vh" : "";
        saveTraySize(nowExpanded ? { expanded: true } : null);
        return;
      }
      // Accordion toggle
      const secBtn = ev.target.closest("button[data-sec-toggle]");
      if (secBtn) {
        ev.preventDefault(); ev.stopPropagation();
        const id = secBtn.dataset.secToggle;
        _secOpen[id] = !_secOpen[id];
        saveSecState();
        renderTray(host);
        return;
      }
      // Echo Spotlight invoke buttons → quickInvoke (handles 0/1/many active)
      const spotBtn = ev.target.closest("button[data-ft-spotlight]");
      if (spotBtn) {
        ev.preventDefault(); ev.stopPropagation();
        const fn = game.fourththing?.echoAssets?.spotlight?.quickInvoke;
        if (typeof fn === "function") return fn(steward, spotBtn.dataset.ftSpotlight);
        ui.notifications?.warn?.("Spotlight not ready.");
        return;
      }
      // Fire actions
      const fireBtn = ev.target.closest("button[data-fire]");
      if (fireBtn) {
        ev.preventDefault(); ev.stopPropagation();
        const kind = fireBtn.dataset.fire;
        const key  = fireBtn.dataset.key;
        const itemId = fireBtn.dataset.itemId;
        const item = itemId ? steward.items.get(itemId) : null;
        switch (kind) {
          case "faculty": return fireFaculty(steward, key);
          case "defense": return fireDefense(steward, key);
          case "ability": if (item) return fireAbility(steward, item); break;
          case "strike":  if (item) return fireStrike(steward, item); break;
          case "mani":    if (item) return fireManifestation(steward, item); break;
          case "pool":    return firePool(steward, key);
        }
        return;
      }
      // Active-state chip → open its config (steward sheet must be open for owner)
      const effBtn = ev.target.closest("button[data-effect-id]");
      if (effBtn) {
        ev.preventDefault(); ev.stopPropagation();
        const eff = steward.effects.get(effBtn.dataset.effectId);
        if (eff?.sheet?.render) eff.sheet.render(true, { focus:true });
        return;
      }
    });

    host.appendChild(tray);
    // (Tray is a child of the draggable HUD root, so it moves with the bar — no
    // separate draggable wiring, which would detach it via its own position.)
  }

  function toggleTray(host) {
    const existing = document.getElementById(TRAY_ID);
    if (existing) { existing.remove(); return; }
    renderTray(host);
  }

  // ── Travel-stack pill (kept from v1) ────────────────────────────────────
  function getActiveTravelStack() {
    for (const f of getOwnedFactions()) {
      const tw = f?.getFlag?.("bbttcc-factions", "travelingWith");
      if (tw?.leadId) {
        const lead = game.actors?.get(tw.leadId);
        if (lead) return { passenger: f, lead, multiplier: Number(tw.multiplier ?? 1) };
      }
    }
    return null;
  }
  function refreshTravelStackPill() {
    const root = document.getElementById(HUD_ID);
    if (!root) return;
    const pill = root.querySelector('[data-role="travel-stack-pill"]');
    if (!pill) return;
    const stack = getActiveTravelStack();
    if (!stack) {
      pill.style.display = "none";
      pill.removeAttribute("data-tooltip");
      return;
    }
    const multTxt = stack.multiplier === 1 ? "" : ` (${stack.multiplier}×)`;
    pill.style.display = "";
    pill.innerHTML = `<i class="fas fa-route"></i><span>Riding with ${esc(stack.lead.name)}${esc(multTxt)}</span>`;
    pill.dataset.tooltip = `${stack.passenger.name} is traveling with ${stack.lead.name}. Click to open Travel Console.`;
  }

  // ── Mount ───────────────────────────────────────────────────────────────
  function buildHud() {
    if (!shouldShow()) return;
    if (document.getElementById(HUD_ID)) return;
    loadSecState();

    const root = document.createElement("div");
    root.id = HUD_ID;
    root.className = "bbttcc-player-hud-wrap";
    root.innerHTML = `
      <div class="bbttcc-player-hud-bar">
        <button type="button" class="bbttcc-btn" data-action="faction">
          <i class="fas fa-flag"></i><span>Faction</span>
        </button>
        <button type="button" class="bbttcc-btn" data-action="steward">
          <i class="fas fa-user-shield"></i><span>Steward</span>
        </button>
        <button type="button" class="bbttcc-btn" data-action="abilities">
          <i class="fas fa-bolt"></i><span>Abilities</span>
        </button>
        <button type="button" class="bbttcc-btn" data-action="travel">
          <i class="fas fa-route"></i><span>Travel</span>
        </button>
        <button type="button" class="bbttcc-btn bbttcc-travel-stack-pill" data-action="travel" data-role="travel-stack-pill" style="display:none;"></button>
      </div>
    `;

    root.addEventListener("click", (ev) => {
      const btnEl = ev.target.closest("button[data-action]");
      if (!btnEl) return;
      ev.preventDefault();
      ev.stopPropagation();
      switch (btnEl.dataset.action) {
        case "faction":   return openFaction();
        case "steward":   return openStewardOrRig();
        case "abilities": return toggleTray(root);
        case "travel":    return openTravelConsole();
      }
    }, { capture: true });

    document.body.appendChild(root);
    refreshTravelStackPill();
    // 2026-05-25 — make the player HUD bar draggable + collapsible (same helper
    // the system uses for the Crew/Manifest/Raid HUDs). Position persists per user.
    try { globalThis._ftMakeHudDraggable?.(root, { storageKey: "player-hud-bar", collapsedLabel: "⚙ HUD" }); } catch (_e) {}
    log("Player HUD mounted.");
  }

  function refreshTrayIfOpen() {
    const tray = document.getElementById(TRAY_ID);
    if (!tray) return;
    const host = document.getElementById(HUD_ID);
    if (!host) return;
    _groupCache.actorId = null; // data changed — re-classify on next render
    renderTray(host);
  }

  // ── Hooks ───────────────────────────────────────────────────────────────
  function affectsSteward(actor) {
    const steward = getSteward();
    if (!steward || !actor) return false;
    if (actor.id === steward.id) return true;
    // resource/boarding changes on the ridden rig also matter for the strip/badge
    const rig = getBoardedRig(steward);
    return !!rig && actor.id === rig.id;
  }

  Hooks.once("ready", buildHud);
  Hooks.on("canvasReady", () => { if (shouldShow()) { buildHud(); refreshTrayIfOpen(); refreshTravelStackPill(); } });
  Hooks.on("controlToken", () => refreshTrayIfOpen());
  Hooks.on("updateActor", (actor, changes) => {
    if (affectsSteward(actor)) refreshTrayIfOpen();
    try {
      if (foundry.utils.hasProperty(changes || {}, "flags.bbttcc-factions.travelingWith")) refreshTravelStackPill();
    } catch (_e) {}
  });
  Hooks.on("createItem", (it) => { if (affectsSteward(it?.parent)) refreshTrayIfOpen(); });
  Hooks.on("updateItem", (it) => { if (affectsSteward(it?.parent)) refreshTrayIfOpen(); });
  Hooks.on("deleteItem", (it) => { if (affectsSteward(it?.parent)) refreshTrayIfOpen(); });
  Hooks.on("createActiveEffect", (eff) => { if (affectsSteward(eff?.parent)) refreshTrayIfOpen(); });
  Hooks.on("updateActiveEffect", (eff) => { if (affectsSteward(eff?.parent)) refreshTrayIfOpen(); });
  Hooks.on("deleteActiveEffect", (eff) => { if (affectsSteward(eff?.parent)) refreshTrayIfOpen(); });
})();
