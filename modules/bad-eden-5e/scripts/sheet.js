// Bad Eden 5E · the character sheet (2026-10-30, Dave: "the sheet needs work … no Domain tab").
//
// 1. DOMAIN tab — the RFI steward sheet's Domain panel (ruling 16: steward + faction are one being) on the dnd5e
//    character sheet, registered as a real dnd5e tab (CharacterActorSheet.TABS + PARTS). The context and the door
//    actions are a port of systems/fourththing/module.js ftDomainContext / _ftDomainAct; keep them in step.
// 2. ARCHETYPE in the background slot — Bad Eden replaces the SRD Background with the Archetype (Dave 2026-10-30).
//    The empty pill reads "Add Archetype" and opens the Bad Eden Archetypes compendium; a filled pill gets an
//    "Archetype" kicker. An SRD background dropped on a character is refused for players (the GM is warned).
import { MOD } from "./casting.js";

const ARCHETYPE_PACK = `${MOD}.archetypes`;
const TEMPLATE = `modules/${MOD}/templates/domain-tab.hbs`;

/* ── the Domain a character serves (same order as RFI's ftResolveFactionLink) ── */
export function linkedDomain(actor) {
  if (!actor) return null;
  const id = actor.getFlag?.("bbttcc-factions", "factionId") ?? null;
  if (id) {
    const f = game.bbttcc?.api?.factions?.get?.(id) ?? game.actors?.get?.(id) ?? null;
    if (f) return f;
  }
  const name = String(actor.getFlag?.("bbttcc-territory", "faction") ?? "").trim();
  if (name) return game.actors?.find?.(a => a.flags?.["bbttcc-factions"]?.isFaction && a.name === name) ?? null;
  return null;
}

const POOLS = [["violence", "Violence"], ["nonlethal", "Nonlethal"], ["intrigue", "Intrigue"], ["economy", "Economy"], ["softpower", "Softpower"], ["diplomacy", "Diplomacy"], ["logistics", "Logistics"], ["culture", "Culture"], ["faith", "Faith"]];
function loyaltyBand(v) {
  if (v < 15) return { key: "bad", band: "Restive", hint: "Loyalty under 15: the land works against you — income falls, defences weaken, unrest rises." };
  if (v < 30) return { key: "warn", band: "Uneasy", hint: "Loyalty under 30: income and defence suffer. Give the people a reason." };
  if (v < 70) return { key: "ok", band: "Steady", hint: "Loyalty 30–69: the land holds. Above 70 it starts giving back." };
  if (v < 85) return { key: "good", band: "Devoted", hint: "Loyalty 70–84: income and defence improve. Above 85 the land answers freely." };
  return { key: "best", band: "Fervent", hint: "Loyalty 85+: the land is yours in every sense — best income, best defence, no unrest." };
}
function darknessBand(v) {
  if (v < 1) return { key: "ok", band: "Clear", hint: "No Darkness on the land. Darkness never fades by itself — keep it this way." };
  if (v < 4) return { key: "warn", band: "Shaded", hint: "Darkness 1–3: income −5% every turn. It will not fade on its own — cleanse a hex, hold Blessed Ground, or convene the other Domains." };
  if (v < 7) return { key: "bad", band: "Shadowed", hint: "Darkness 4–6: income −10%, Loyalty −1 every turn and no recovery, and unrest can break out. Work it down before it reaches 7." };
  if (v < 10) return { key: "worst", band: "Intrusion", hint: "Darkness 7–9: income −15%, Loyalty −1, and each turn the dark leaks into a neighbouring hex — usually another Domain's. Their Darkness rises with yours. Travel is harder." };
  return { key: "worst", band: "Calamity", hint: "Darkness 10: income −20%, Loyalty −2, the leak, and each turn your least loyal hex loses 2 integration and turns Hostile." };
}
function domainHexes(faction) {
  const list = []; const cur = canvas?.scene?.id;
  const cap = s => { s = String(s || "").trim(); return s ? s[0].toUpperCase() + s.slice(1) : ""; };
  try {
    for (const sc of game.scenes?.contents ?? []) for (const d of sc.drawings?.contents ?? []) {
      const tf = d.flags?.["bbttcc-territory"] ?? {};
      const isHex = tf.isHex === true || tf.kind === "territory-hex" || (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
      if (!isHex) continue;
      const ownerId = tf.factionId || tf.ownerId; const ownerName = tf.faction ?? tf.ownerName;
      if (!((ownerId && ownerId === faction.id) || (ownerName && String(ownerName).trim() === String(faction.name).trim()))) continue;
      const name = String(tf.name || d.text || "").replace(/\s+/g, " ").trim() || "Unnamed hex";
      const kind = [cap(tf.type || "wilderness"), cap(tf.size || "")].filter(Boolean).join(" · ");
      const terrain = cap(tf.terrain?.key || tf.terrain || "");
      list.push({ uuid: d.uuid, name, kind, here: sc.id === cur, hint: [terrain, sc.name, sc.id === cur ? "on this map — click to jump there" : "click to open the hex"].filter(Boolean).join(" · ") });
    }
  } catch (_e) {}
  list.sort((a, b) => (b.here - a.here) || a.name.localeCompare(b.name));
  return list;
}
function domainRigs(faction) {
  try {
    const R = game.bbttcc?.rigs; if (!R?.isRig) return [];
    const icon = { parked: "🅿️", deployed: "🚚", destroyed: "💥" };
    return (game.actors?.contents ?? []).filter(a => R.isRig(a) && String(R.ownerOf(a) ?? "").replace(/^Actor\./, "") === faction.id)
      .map(a => { const p = R.outputPreview?.(a); const st = p?.state ?? String(R.data?.(a)?.identity?.state ?? "parked"); return { name: a.name, state: st, icon: icon[st] || "", produces: !!p?.produces, parked: p?.parkedText ?? "nothing", deployed: p?.deployedText ?? "nothing", lost: p?.lostText ?? "nothing" }; })
      .sort((x, y) => x.name.localeCompare(y.name));
  } catch (_e) { return []; }
}
function retinue(actor) {
  try {
    const C = game.bbttcc?.api?.contracts; if (!C) return [];
    return C.list(actor).map(c => ({ family: c.family, label: c.familyLabel, name: c.displayName, turnsLeft: c.turnsLeft === Infinity ? "standing" : c.turnsLeft, last: c.turnsLeft === 1, portrait: c.portrait || "" }));
  } catch (_e) { return []; }
}

export async function domainContext(actor) {
  const isGM = !!game.user?.isGM;
  const faction = linkedDomain(actor);
  if (!faction) return { linked: false, isGM };
  const F = faction.flags?.["bbttcc-factions"] ?? {};
  const facts = game.bbttcc?.facts?.faction ?? {};
  const bank = F.opBank || {};
  let caps = {}; try { caps = facts.caps?.(faction) ?? {}; } catch (_e) {}
  const pools = POOLS.map(([key, label]) => { const marks = Math.max(0, Math.floor(Number(bank[key]) || 0)); const cap = Math.max(0, Math.floor(Number(caps[key]) || 0)); return { key, label, marks, cap, zero: marks <= 0 }; });
  const total = pools.reduce((s, p) => s + p.marks, 0), max = pools.reduce((s, p) => s + p.cap, 0);
  let tier = 1; try { tier = Math.max(1, Math.min(5, Number(facts.tier?.(faction)) || 1)); } catch (_e) {}
  const loyalty = Math.max(0, Number(F.loyalty ?? 0) || 0);
  const darkRaw = F.darkness; const darkness = Math.max(0, Number((darkRaw && typeof darkRaw === "object") ? darkRaw.global : darkRaw) || 0);
  const momentum = Math.max(0, Number(F.momentum ?? 0) || 0);
  const pressure = [];
  try {
    const P = F.pressure || {}; const band = String(P.overextensionBand || "").toLowerCase();
    if (band && band !== "stable") pressure.push({ label: `Overextended: ${band}`, hint: "Your Domain holds more than its logistics can carry. Secure the perimeter or supply the line before expanding again." });
    if (P.unpaidUpkeep === true) pressure.push({ label: "Upkeep unpaid", hint: "A garrison went unpaid last turn. Loyalty and defence slip until it is settled." });
  } catch (_e) {}
  const hexList = domainHexes(faction);
  const rigList = domainRigs(faction);
  const EFF = game.bbttcc?.api?.raid?.EFFECTS || {}; const turn = game.bbttcc?.api?.turn || {};
  const planned = (Array.isArray(F.warLogs) ? F.warLogs : []).filter(e => String(e?.type || "").toLowerCase() === "planned")
    .sort((a, b) => (Number(a?.ts) || 0) - (Number(b?.ts) || 0)).map(e => {
      const key = String(e.activityKey || e.activity || "");
      const label = String(EFF[key]?.label || EFF[key.toLowerCase()]?.label || e.label || (key ? key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "") || "Planned action");
      let costLine = String(e.costLine || "");
      try { if (!costLine && turn.activityCost) costLine = turn.formatActivityCost?.(turn.activityCost({ entry: e, faction })) || ""; } catch (_e) {}
      return { label, costLine, targetName: String(e.targetName || ""), ref: String(e.id || e.ts || "") };
    });
  let convictions = "Unsworn"; let convictionsMeter = null;
  try {
    const own = String(actor?.getFlag?.("bbttcc-aae", "politicalPhilosophy") || "").trim();
    const st = game.bbttcc?.api?.convictions?.stateFor?.(faction) || null;
    const sworn = own ? own.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : (st?.center?.label || "");
    convictions = sworn || "Unsworn";
    if (st) convictionsMeter = { drift: st.drift, pct: Math.max(0, Math.min(100, st.drift)), band: st.band, bandLabel: st.bandLabel, css: st.css,
      hint: `${st.hint} Every choice that carries weight moves this: hold to your convictions and it falls, betray them and it climbs. Steadfast to 15 · Strained to 35 · Fractured to 65 · Rupturing beyond.`,
      impacts: (st.impacts || []).map(x => String(x).replace(/\s*\[[^\]]*\]\s*$/, "")) };
  } catch (_e) {}
  return {
    linked: true, isGM, id: faction.id, name: faction.name, isOwner: !!faction.isOwner,
    tier, tierRoman: ["I", "I", "II", "III", "IV", "V"][tier] || "I", tierLabel: ["", "Rooted", "Rising", "Established", "Ascendant", "Transcendent"][tier] || "Rooted",
    treasury: { total, max, pools },
    meters: { loyalty: { value: loyalty, ...loyaltyBand(loyalty) }, darkness: { value: darkness, ...darknessBand(darkness) },
      momentum: { value: momentum, canSpend: momentum > 0 && (isGM || !!faction.isOwner), hint: "Momentum: banked +1 each time a Domain check rolls a 10. Spend it before the turn ends — it resets at Day's End." } },
    pressure, hexes: hexList.length, hexList, rigs: rigList.length, rigList, convictions, convictionsMeter, planned, retinue: retinue(actor)
  };
}

async function domainAct(sheet, act) {
  const actor = sheet.actor; const faction = linkedDomain(actor);
  const A = game.bbttcc?.api ?? {};
  if (act.startsWith("portrait:")) { const C = A.contracts; if (!C?.choosePortrait) return; await C.choosePortrait(actor, act.split(":")[1]); return sheet.render(false); }
  if (act.startsWith("release:")) {
    const fam = act.split(":")[1]; const C = A.contracts; const cur = C?.get?.(actor, fam); if (!cur) return;
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Release the contract?" }, content: `<p><b>${foundry.utils.escapeHTML(cur.displayName)}</b> walk now. Their maneuvers and bonuses go with them. No refund.</p>` });
    if (!ok) return; await C.release(actor, fam); return sheet.render(false);
  }
  if (!faction) return ui.notifications?.info?.("No Domain is linked to this character yet.");
  if (act.startsWith("unplan:")) {
    const ref = act.slice(7);
    const fresh = faction.getFlag("bbttcc-factions", "warLogs") || [];
    const hit = fresh.find(e => String(e?.type || "").toLowerCase() === "planned" && (String(e.id || "") === ref || String(e.ts || "") === ref));
    if (!hit) return sheet.render(false);
    const ok = await foundry.applications.api.DialogV2.confirm({ window: { title: "Cancel this order?" }, content: `<p>Take <b>${foundry.utils.escapeHTML(String(A.raid?.EFFECTS?.[hit.activityKey]?.label || hit.activityKey || "this order"))}</b> off next turn's plan? Nothing has been paid for it yet.</p>` });
    if (!ok) return;
    const now = faction.getFlag("bbttcc-factions", "warLogs") || [];
    const keep = now.filter(e => !(String(e?.type || "").toLowerCase() === "planned" && (String(e.id || "") === ref || String(e.ts || "") === ref)));
    if (keep.length !== now.length) await faction.setFlag("bbttcc-factions", "warLogs", keep);
    return sheet.render(false);
  }
  if (act.startsWith("hex:")) {
    const uuid = act.slice(4);
    try {
      const d = await fromUuid(uuid);
      if (d && d.parent?.id === canvas?.scene?.id && canvas?.ready) {
        const w = Number(d.shape?.width) || 0, h = Number(d.shape?.height) || 0;
        await canvas.animatePan({ x: Number(d.x) + w / 2, y: Number(d.y) + h / 2, duration: 450 });
      }
    } catch (_e) {}
    return A.territory?.openHexSheet?.(uuid);
  }
  try {
    switch (act) {
      case "planner": return A.raid?.openActivityPlanner?.({ factionId: faction.id, lockFaction: true });
      case "raid": return (A.raid?.openConsole || A.raid?.openRaidConsole)?.({ factionId: faction.id, mode: "commit" });
      case "quests": return A.quests?.openQuestLog?.({ factionId: faction.id });
      case "market": {
        try { const cur = game.settings.get("bbttcc-market", "lastContext") || {}; await game.settings.set("bbttcc-market", "lastContext", { ...cur, factionId: faction.id, characterId: actor.id }); } catch (_e) {}
        return A.market?.openMarket?.();
      }
      case "vault": {
        if (typeof A.banks?.openTreasury === "function") return A.banks.openTreasury(actor, { steward: actor });
        return A.banks?.openFactionBank?.(faction);
      }
      case "record": if (game.user?.isGM) faction.sheet?.render(true); return;
      case "momentum": {
        if (!(game.user?.isGM || faction.isOwner)) return ui.notifications?.info?.("Only the Domain's steward or the GM can spend Momentum.");
        const fn = faction.sheet?._onMomentumSpend; if (typeof fn !== "function") return;
        await fn.call(faction.sheet); return sheet.render(false);
      }
    }
  } catch (e) { console.warn(`${MOD} | domain action failed`, act, e); }
}

/* ── registration ─────────────────────────────────────────────────────────── */
export function registerSheet() {
  const C = dnd5e?.applications?.actor?.CharacterActorSheet;
  if (!C || C.TABS?.some?.(t => t.tab === "domain")) return;
  // Domain sits right after Biography in the tab rail; its body is a template part in the shared tab container.
  const bio = C.TABS.findIndex(t => t.tab === "biography");
  C.TABS.splice(bio >= 0 ? bio + 1 : C.TABS.length, 0, { tab: "domain", label: "Domain", icon: "fas fa-flag" });
  const parts = {};
  for (const [k, v] of Object.entries(C.PARTS)) {
    parts[k] = v;
    if (k === "biography") parts.domain = { container: { classes: ["tab-body"], id: "tabs" }, template: TEMPLATE, scrollable: [""] };
  }
  if (!parts.domain) parts.domain = { container: { classes: ["tab-body"], id: "tabs" }, template: TEMPLATE, scrollable: [""] };
  C.PARTS = parts;

  const prep = C.prototype._preparePartContext;
  C.prototype._preparePartContext = async function (partId, context, options) {
    context = await prep.call(this, partId, context, options);
    if (partId === "domain") {
      try { context.domain = await domainContext(this.actor); } catch (e) { console.warn(`${MOD} | domain context failed`, e); context.domain = { linked: false }; }
      context.tab ??= context.tabs?.domain ?? { id: "domain", group: "primary", cssClass: "" };
    }
    return context;
  };
  foundry.applications.handlebars.loadTemplates([TEMPLATE]);

  Hooks.on("renderCharacterActorSheet", (app, element) => {
    const root = element instanceof HTMLElement ? element : element?.[0];
    if (!root) return;
    bindDomain(app, root);
    archetypePill(app, root);
  });

  // The land changed → open character sheets whose Domain this is redraw (debounced).
  const pending = new Map();
  Hooks.on("updateActor", doc => {
    if (!doc?.flags?.["bbttcc-factions"]?.isFaction) return;
    foundry.applications.instances.forEach(app => {
      if (!(app instanceof C) || !app.rendered || linkedDomain(app.actor)?.id !== doc.id || pending.has(app.id)) return;
      pending.set(app.id, setTimeout(() => { pending.delete(app.id); try { app.render(false); } catch (_e) {} }, 250));
    });
  });

  // An SRD background is not part of Bad Eden: the Archetype is the character's origin.
  Hooks.on("preCreateItem", (item, data, options, userId) => {
    if (userId !== game.user.id || item.type !== "background" || item.parent?.type !== "character") return;
    if (item.getFlag?.(MOD, "archetype") || data?.flags?.[MOD]?.archetype) return;
    if (game.user.isGM) { ui.notifications?.warn?.(`${item.name} is a D&D background. Bad Eden characters take an Archetype in that slot (Bad Eden Archetypes compendium).`); return; }
    ui.notifications?.warn?.(`Bad Eden uses Archetypes instead of backgrounds. Pick one from the Bad Eden Archetypes compendium.`);
    return false;
  });
}

function bindDomain(app, root) {
  const panel = root.querySelector(".be5e-domain-tab");
  if (!panel || panel.dataset.be5eBound) return;
  panel.dataset.be5eBound = "1";
  panel.addEventListener("click", ev => {
    const b = ev.target?.closest?.("[data-domain-act]");
    if (!b || !panel.contains(b)) return;
    ev.preventDefault(); ev.stopPropagation();
    domainAct(app, String(b.dataset.domainAct || ""));
  });
}

function archetypePill(app, root) {
  const empty = root.querySelector('.pill-lg.empty[data-item-type="background"]');
  if (empty && !empty.dataset.be5eArchetype) {
    empty.dataset.be5eArchetype = "1";
    empty.textContent = "Add Archetype";
    empty.dataset.tooltip = "Your Archetype: the tarot card you were dealt. It sets your ability increases, two skills and an Origin feat.";
    // capture phase so dnd5e's findItem (the SRD background browser) never opens
    empty.addEventListener("click", ev => {
      ev.preventDefault(); ev.stopImmediatePropagation();
      const pack = game.packs.get(ARCHETYPE_PACK);
      if (pack) pack.render(true); else ui.notifications?.warn?.("The Bad Eden Archetypes compendium isn't loaded.");
    }, { capture: true });
  }
  const bg = app.actor?.system?.details?.background;
  const filled = bg?.id ? root.querySelector(`.pill-lg[data-item-id="${bg.id}"]`) : null;
  if (filled && !filled.querySelector(".be5e-pill-kicker") && bg.getFlag?.(MOD, "archetype")) {
    filled.classList.add("be5e-archetype-pill");
    const name = filled.querySelector(".name, .title, span") ?? null;
    const k = document.createElement("span"); k.className = "be5e-pill-kicker roboto-upper"; k.textContent = "Archetype";
    if (name?.parentElement) name.parentElement.insertBefore(k, name); else filled.prepend(k);
  }
}
