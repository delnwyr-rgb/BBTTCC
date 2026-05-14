// modules/bbttcc-territory/scripts/player-hud.enhancer.js
// Player heads-up display: Faction / Steward / Abilities tray, pinned to canvas.
// Mirrors the GM toolbar look-and-feel (see #bbttcc-toolbar styles).

(() => {
  const TAG = "[bbttcc-ui/player-hud]";
  const HUD_ID = "bbttcc-player-hud";
  const TRAY_ID = "bbttcc-player-hud-tray";
  const log  = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  let _activeTab = "abilities";

  function shouldShow() {
    return !!game.user && !game.user.isGM;
  }

  function getAssignedCharacter() {
    return game.user?.character ?? null;
  }

  function getControlledActor() {
    const tok = canvas?.tokens?.controlled?.[0];
    return tok?.actor ?? null;
  }

  function getActiveActor() {
    return getControlledActor() ?? getAssignedCharacter();
  }

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

  function getOwnedFactions() {
    const user = game.user;
    if (!user) return [];
    return (game.actors?.contents ?? [])
      .filter(a => isFactionActor(a) && a.testUserPermission(user, "OWNER"));
  }

  async function openFaction() {
    const factions = getOwnedFactions();
    if (!factions.length) {
      ui.notifications?.warn?.("No faction assigned to you yet — ask the GM to grant ownership.");
      return;
    }
    if (factions.length === 1) return factions[0].sheet?.render(true, { focus:true });

    const opts = factions.map(f => `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`).join("");
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

  function openTravelConsole() {
    try {
      const tc = game?.bbttcc?.ui?.travelConsole;
      if (!tc) {
        ui?.notifications?.warn?.("Travel Console not ready yet.");
        return;
      }
      tc.render(true);
    } catch (e) {
      console.warn("[player-hud] openTravelConsole failed", e);
    }
  }

  function openSteward() {
    const actor = getActiveActor();
    if (!actor) {
      ui.notifications?.warn?.("No assigned character. Set one in User Configuration.");
      return;
    }
    actor.sheet?.render(true, { focus:true });
  }

  function collectAbilities(actor) {
    if (!actor) return [];
    const items = actor.items?.contents ?? [];
    const typesAllowed = new Set(["feat","feature","class","subclass","race","spell","weapon","consumable"]);
    const isActionable = game.fourththing?._classAutomation?.isActionableFeature;
    const featLike = new Set(["feat","feature","class","subclass","race"]);
    return items
      .filter(it => {
        if (!typesAllowed.has(it.type)) return false;
        if (featLike.has(it.type) && typeof isActionable === "function") {
          return isActionable(it);
        }
        return true;
      })
      .sort((a,b) => {
        const tw = (t) => ({ class:0, subclass:1, race:2, feat:3, feature:3, spell:4, weapon:5, consumable:6 }[t] ?? 9);
        return tw(a.type) - tw(b.type) || a.name.localeCompare(b.name);
      });
  }

  function abilityIcon(item) {
    switch (item.type) {
      case "spell":      return "wand-magic-sparkles";
      case "weapon":     return "khanda";
      case "consumable": return "flask";
      default:           return "bolt";
    }
  }

  async function fireAbility(item) {
    const actor = item?.parent;
    const ftDispatch = game.fourththing?._classAutomation?.dispatchFeatureAction
                    ?? globalThis.dispatchFeatureAction;
    if (actor && typeof ftDispatch === "function") {
      try {
        const handled = await ftDispatch(actor, item);
        if (handled !== null && handled !== undefined) return handled;
      } catch (e) {
        warn(`fourththing dispatch failed for "${item.name}"`, e);
      }
    }

    const tryFns = [
      () => typeof item.use === "function" ? item.use({}, { event: window.event }) : null,
      () => typeof item.roll === "function" ? item.roll() : null,
      () => typeof item.displayCard === "function" ? item.displayCard() : null,
      () => typeof item.toMessage === "function" ? item.toMessage() : null
    ];
    for (const fn of tryFns) {
      try {
        const r = await fn();
        if (r !== null && r !== undefined && r !== false) return r;
      } catch (e) {
        warn(`Ability path failed for "${item.name}"`, e);
      }
    }
    item.sheet?.render(true, { focus:true });
  }

  function abilitiesPanelHTML(actor) {
    const abilities = collectAbilities(actor);
    if (!abilities.length) {
      return `<div class="bbttcc-player-hud-empty">No usable items on <strong>${foundry.utils.escapeHTML(actor.name)}</strong>.</div>`;
    }
    const buttons = abilities.map(it => {
      const id = foundry.utils.escapeHTML(it.id);
      const name = foundry.utils.escapeHTML(it.name);
      return `<button type="button" class="bbttcc-btn" data-item-id="${id}" title="${name}">
        <i class="fas fa-${abilityIcon(it)}"></i><span>${name}</span>
      </button>`;
    }).join("");
    return `<div class="bbttcc-player-hud-tray-grid">${buttons}</div>`;
  }

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
      const changes = eff.changes ?? [];
      let score = 0;
      for (const c of changes) {
        const v = String(c.value ?? "").trim();
        if (!v) continue;
        const n = parseFloat(v);
        if (!Number.isNaN(n)) score += n;
        else if (/^[-]/.test(v)) score -= 1;
        else if (/^[+]/.test(v)) score += 1;
      }
      if (score > 0) return "buff";
      if (score < 0) return "debuff";
      return "neutral";
    } catch { return "neutral"; }
  }

  function statesPanelHTML(actor) {
    const effects = (actor.effects?.contents ?? []).filter(e => !!e);
    if (!effects.length) {
      return `<div class="bbttcc-player-hud-empty">No active states on <strong>${foundry.utils.escapeHTML(actor.name)}</strong>.</div>`;
    }
    const rows = effects.map(eff => {
      const id = foundry.utils.escapeHTML(eff.id);
      const name = foundry.utils.escapeHTML(eff.name ?? eff.label ?? "Effect");
      const icon = foundry.utils.escapeHTML(eff.icon ?? eff.img ?? "icons/svg/aura.svg");
      const dur = foundry.utils.escapeHTML(effectDurationLabel(eff));
      const pol = effectPolarity(eff);
      const dis = eff.disabled ? "is-disabled" : "";
      return `<button type="button" class="bbttcc-state-chip ${pol} ${dis}" data-effect-id="${id}" title="${name}${eff.disabled?' (disabled)':''}">
        <img src="${icon}" alt="" />
        <span class="bbttcc-state-name">${name}</span>
        <span class="bbttcc-state-dur">${dur}</span>
      </button>`;
    }).join("");
    return `<div class="bbttcc-player-hud-states-grid">${rows}</div>`;
  }

  // Action-economy strip removed 2026-05-05 — relocated to the steward sheet's
  // Engagement tab as canonical home. HUD remains a quick-glance summary of
  // states + abilities; the action pool lives where combat happens.

  function renderTray(host) {
    const actor = getActiveActor();
    let tray = document.getElementById(TRAY_ID);
    if (tray) tray.remove();

    tray = document.createElement("div");
    tray.id = TRAY_ID;
    tray.className = "bbttcc-player-hud-tray";

    if (!actor) {
      tray.innerHTML = `<div class="bbttcc-player-hud-empty">Select a token or assign a character.</div>`;
      host.appendChild(tray);
      return;
    }

    const tabBtn = (id, label) =>
      `<button type="button" class="bbttcc-player-hud-tab ${_activeTab===id?'is-active':''}" data-tab="${id}">${label}</button>`;

    const body = _activeTab === "states" ? statesPanelHTML(actor) : abilitiesPanelHTML(actor);

    tray.innerHTML = `
      <div class="bbttcc-player-hud-tray-header">
        <span>${foundry.utils.escapeHTML(actor.name)}</span>
        <div class="bbttcc-player-hud-tabs">
          ${tabBtn("abilities","Abilities")}
          ${tabBtn("states","States")}
        </div>
      </div>
      <div class="bbttcc-player-hud-tray-body">${body}</div>
    `;

    tray.addEventListener("click", async (ev) => {
      const tabBtnEl = ev.target.closest("button[data-tab]");
      if (tabBtnEl) {
        ev.preventDefault(); ev.stopPropagation();
        _activeTab = tabBtnEl.dataset.tab;
        renderTray(host);
        return;
      }
      const itemBtn = ev.target.closest("button[data-item-id]");
      if (itemBtn) {
        ev.preventDefault(); ev.stopPropagation();
        const item = actor.items.get(itemBtn.dataset.itemId);
        if (item) await fireAbility(item);
        return;
      }
      const effBtn = ev.target.closest("button[data-effect-id]");
      if (effBtn) {
        ev.preventDefault(); ev.stopPropagation();
        const eff = actor.effects.get(effBtn.dataset.effectId);
        if (eff?.sheet?.render) eff.sheet.render(true, { focus:true });
        return;
      }
    });

    host.appendChild(tray);
  }

  function toggleTray(host) {
    const existing = document.getElementById(TRAY_ID);
    if (existing) { existing.remove(); return; }
    renderTray(host);
  }

  // Travel Engine v2 — Phase E2: surface "Traveling with [Lead]" when any of
  // the user's owned factions has flags.bbttcc-factions.travelingWith set.
  // Click opens the Travel Console. Hidden when no stack is active.
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
    pill.innerHTML = `<i class="fas fa-route"></i><span>Riding with ${foundry.utils.escapeHTML(stack.lead.name)}${foundry.utils.escapeHTML(multTxt)}</span>`;
    pill.dataset.tooltip = `${stack.passenger.name} is traveling with ${stack.lead.name}. Click to open Travel Console.`;
  }

  function buildHud() {
    if (!shouldShow()) return;
    if (document.getElementById(HUD_ID)) return;

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
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      switch (btn.dataset.action) {
        case "faction":   return openFaction();
        case "steward":   return openSteward();
        case "abilities": return toggleTray(root);
        case "travel":    return openTravelConsole();
      }
    }, { capture: true });

    document.body.appendChild(root);
    refreshTravelStackPill();
    log("Player HUD mounted.");
  }

  function refreshTrayIfOpen() {
    const tray = document.getElementById(TRAY_ID);
    if (!tray) return;
    const host = document.getElementById(HUD_ID);
    if (host) renderTray(host);
  }

  Hooks.once("ready", buildHud);
  Hooks.on("canvasReady", () => { if (shouldShow()) { buildHud(); refreshTrayIfOpen(); refreshTravelStackPill(); } });
  Hooks.on("controlToken", () => refreshTrayIfOpen());
  Hooks.on("updateActor", (actor, changes) => {
    refreshTrayIfOpen();
    // Phase E2: refresh travel-stack pill when travelingWith flag changes.
    try {
      if (foundry.utils.hasProperty(changes || {}, "flags.bbttcc-factions.travelingWith")) {
        refreshTravelStackPill();
      }
    } catch (_e) {}
  });
  Hooks.on("createItem", (it) => { if (it?.parent === getActiveActor()) refreshTrayIfOpen(); });
  Hooks.on("deleteItem", (it) => { if (it?.parent === getActiveActor()) refreshTrayIfOpen(); });
  Hooks.on("createActiveEffect", (eff) => { if (eff?.parent === getActiveActor()) refreshTrayIfOpen(); });
  Hooks.on("updateActiveEffect", (eff) => { if (eff?.parent === getActiveActor()) refreshTrayIfOpen(); });
  Hooks.on("deleteActiveEffect", (eff) => { if (eff?.parent === getActiveActor()) refreshTrayIfOpen(); });
})();
