/* BBTTCC Raid — v1.1.4-fallback
 * Stable console + toolbar + War Logs (side-aware) + v13-safe rolls
 * Maneuvers UI + fallback maneuvers for Assault/Infiltration if registry empty.
 */
const RAID_ID = "bbttcc-raid";
const TERR_ID = "bbttcc-territory";
const FCT_ID  = "bbttcc-factions";
const TAG = "[bbttcc-raid v1.1.4-fallback]";

const log  = (...a)=>console.log(TAG, ...a);
const warn = (...a)=>console.warn(TAG, ...a);

/* ---------------- Handlebars helpers ---------------- */
Hooks.once("init", () => {
  try {
    const H = globalThis.Handlebars; if (!H) return;
    if (!H.helpers.add)      H.registerHelper("add", (a,b)=>Number(a||0)+Number(b||0));
    if (!H.helpers.eq)       H.registerHelper("eq",  (a,b)=>String(a)===String(b));
    if (!H.helpers.default)  H.registerHelper("default",(v,fb)=> (v===undefined||v===null)?fb:v);
    if (!H.helpers.upper)    H.registerHelper("upper",(s)=>String(s||"").toUpperCase());
  } catch {}
});

/* ---------------- Config ---------------- */
const RAID_DIFFICULTIES = {
  trivial:{ name:"Trivial", modifier:-2 },
  easy:{ name:"Easy", modifier:-1 },
  medium:{ name:"Medium", modifier:0 },
  hard:{ name:"Hard", modifier:1 },
  extreme:{ name:"Extreme", modifier:2 }
};

const OP_KEYS  = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
const RES_KEYS = ["food","materials","trade","military","knowledge","technology","defense"];

/* Built-in fallback maneuvers (used only if external registry is missing/empty) */
const FALLBACK_MANEUVERS = Object.freeze({
  assault: {
    flankAttack:         { key:"flankAttack",         label:"Flank Attack" },
    supplySurge:         { key:"supplySurge",         label:"Supply Surge" },
    technocratOverride:  { key:"technocratOverride",  label:"Technocrat Override" }
  },
  infiltration: {
    spyNetwork:          { key:"spyNetwork",          label:"Spy Network" }
  }
});

const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v||0)));
const randid=()=> (globalThis.crypto?.randomUUID?.() || (typeof randomID==="function"?randomID():Math.random().toString(36).slice(2)));

/* ---------------- Banks & Stockpile ---------------- */
function emptyOP(){ return Object.fromEntries(OP_KEYS.map(k=>[k,0])); }
function emptyRes(){ return Object.fromEntries(RES_KEYS.map(k=>[k,0])); }

function getOPBank(actor){
  const flags = foundry.utils.duplicate(actor?.flags?.[FCT_ID] ?? {});
  return Object.assign(emptyOP(), flags.opBank || {});
}
async function setOPBank(actor, next){
  await actor.update({ [`flags.${FCT_ID}.opBank`]: Object.assign(emptyOP(), next||{}) });
}
async function spendFromOPBank(actor, key, amount){
  const bank = getOPBank(actor);
  bank[key] = clamp((bank[key]||0) - (amount||0), 0, 999999);
  await setOPBank(actor, bank);
  return bank[key];
}

function getStockpile(actor){
  const flags = foundry.utils.duplicate(actor?.flags?.[FCT_ID] ?? {});
  const s = Object.assign(emptyRes(), flags.stockpile || {});
  RES_KEYS.forEach(k=>s[k]=Number(s[k]||0));
  return s;
}
async function setStockpile(actor, next){
  await actor.update({ [`flags.${FCT_ID}.stockpile`]: Object.assign(emptyRes(), next||{}) });
}
async function drainStockpile(actor, resKey, amount){
  const s = getStockpile(actor);
  const have = Number(s[resKey]||0);
  const take = Math.min(have, Math.max(0, Number(amount||0)));
  if (take <= 0) return { taken:0, clamped: amount>0 };
  s[resKey] = Number(have - take);
  await setStockpile(actor, s);
  return { taken: take, clamped: take < amount };
}

/* ---------------- Dual-spend prefs ---------------- */
const DUAL_SPEND_MAP = {
  violence:   ["military"],
  nonlethal:  ["military","materials"],
  intrigue:   ["knowledge"],
  economy:    ["trade","materials","food"],
  softpower:  ["knowledge","trade"],
  diplomacy:  ["trade"],
  logistics:  ["materials","food"],
  culture:    ["food"],
  faith:      ["knowledge"]
};

/* ---------------- Actor helpers ---------------- */
const isCharacter = (a) => String(a?.type ?? "").toLowerCase() === "character";
const isFaction = (a) => {
  if (!a) return false;
  try {
    if (a.getFlag?.(FCT_ID,"isFaction") === true) return true;
    const t = (foundry.utils.getProperty(a,"system.details.type.value") ?? "").toString().toLowerCase();
    if (t === "faction") return true;
    const cls = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls||"").includes("BBTTCCFactionSheet");
  } catch { return false; }
};
function charBelongsToFaction(char, faction) {
  const fid = char.getFlag?.(FCT_ID,"factionId") ||
              char.getFlag?.("bbttcc-character-options","factionId") ||
              char.getFlag?.("bbttcc-core","factionId") || "";
  if (fid && String(fid) === String(faction.id)) return true;
  const legacyName = char?.flags?.[TERR_ID]?.faction ||
                     char.getFlag?.(FCT_ID,"factionName") ||
                     char.getFlag?.("bbttcc-character-options","factionName") || "";
  return legacyName && String(legacyName).trim() === String(faction.name).trim();
}
function categoryTotal(faction, key) {
  key = key.toLowerCase();
  const opsFlags = foundry.utils.duplicate(faction.getFlag(FCT_ID,"ops") || {});
  const base = Number(opsFlags?.[key]?.value ?? 0);
  let contrib = 0;
  for (const a of game.actors.contents) {
    if (!isCharacter(a)) continue;
    if (!charBelongsToFaction(a, faction)) continue;
    let c = a.getFlag?.(FCT_ID,"opContribution");
    if (!c || Object.values(c).every(v => (Number(v)||0)===0))
      c = a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {};
    contrib += Number(c?.[key] ?? 0);
  }
  return base + contrib;
}

/* ---------------- Hex helpers ---------------- */
function isHexDrawing(d) {
  const doc = d?.document ?? d;
  const f = doc?.flags?.[TERR_ID] ?? {};
  if (f.isHex === true) return true;
  if (String(f.kind||"").toLowerCase() === "territory-hex") return true;
  const sh = doc?.shape ?? d?.shape;
  const n = Array.isArray(sh?.points) ? sh.points.length : 0;
  return sh?.type === "p" && n >= 10;
}
function hexUnderWorldPoint(pt) {
  const list = canvas?.drawings?.placeables ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; if (!isHexDrawing(p)) continue;
    try {
      const local = p.toLocal(new PIXI.Point(pt.x, pt.y));
      if (p.hitArea?.contains?.(local.x, local.y)) return p;
      const sh = p.document.shape;
      if (sh?.type === "p" && Array.isArray(sh.points)) {
        const poly = new PIXI.Polygon(sh.points);
        if (poly.contains(local.x, local.y)) return p;
      }
      const w = sh?.width ?? p.width ?? 0, h = sh?.height ?? p.height ?? 0;
      if (local.x>=0 && local.y>=0 && local.x<=w && local.y<=h) return p;
    } catch {}
  }
  return null;
}
async function pickTargetHex({ prompt="Click a BBTTCC hex…" } = {}) {
  if (!canvas?.ready) { ui.notifications?.error?.("Canvas not ready."); return null; }
  const note = ui.notifications?.info?.(prompt, {permanent:true});
  const res = await new Promise((resolve) => {
    const once = (ev) => {
      try {
        canvas.stage.off("pointerdown", once);
        const fed = ev?.data ?? ev;
        const pt = fed?.global ? { x: fed.global.x, y: fed.global.y } : (canvas.mousePosition ?? {x:0,y:0});
        const hit = hexUnderWorldPoint(pt);
        if (!hit) { ui.notifications?.warn?.("No BBTTCC hex under cursor."); return resolve(null); }
        resolve({ drawing: hit.document, uuid: hit.document.uuid, flags: foundry.utils.duplicate(hit.document.flags?.[TERR_ID] ?? {}) });
      } catch (e) { resolve(null); }
      finally { try { note?.remove?.(); } catch {} }
    };
    canvas.stage.on("pointerdown", once);
  });
  return res;
}
const SIZE_DEF = { outpost:0, village:1, town:1, city:2, metropolis:3, megalopolis:4, small:0, standard:1, large:3 };
const MOD_DEF  = { "Fortified":3, "Difficult Terrain":1 };
async function hexDefense(doc) {
  const f = doc?.flags?.[TERR_ID] ?? {};
  const sizeKey = String(f.size ?? "town").toLowerCase();
  let defense = Number(SIZE_DEF[sizeKey] ?? 1);
  if (Array.isArray(f.modifiers)) for (const m of f.modifiers) defense += Number(MOD_DEF[m] ?? 0);
  if (String(f.type||"").toLowerCase() === "fortress") defense += 2;
  if (f.capital) defense += 1;
  return Math.max(0, Math.round(defense));
}

/* ---------------- Dry run ---------------- */
async function computeDryRun(attacker, { mode="assault", difficulty="medium" } = {}, baseDC) {
  const key = (mode === "infiltration") ? "intrigue" : "violence";
  const attBonus = categoryTotal(attacker, key);
  const diffAdj  = Number(RAID_DIFFICULTIES[difficulty]?.modifier ?? 0);
  const DC       = Math.max(0, Number(baseDC||0) + diffAdj);
  const roll = new Roll("1d20 + @b", { b: attBonus });
  await roll.evaluate();
  const total  = roll.total;
  const outcome = (total >= DC + 5) ? "Great Success" : (total >= DC) ? "Success" : "Fail";
  const detail  = outcome === "Great Success" ? "Decisive result; strong position next turn."
                  : outcome === "Success"     ? "Objective achieved; limited friction."
                                              : "No breakthrough; defenders hold.";
  return { key, attBonus, baseDC:Number(baseDC||0), diffAdj, DC, roll, total, outcome, detail };
}
async function raidDryRun({ attackerId, mode="assault", targetUuid, difficulty="medium", post=false }) {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
  const attacker = await getActorByIdOrUuid(attackerId);
  if (!attacker || !isFaction(attacker)) return ui.notifications?.warn?.("Pick a valid attacker faction.");
  const target = targetUuid ? await fromUuid(targetUuid) : null;
  if (!target) return ui.notifications?.warn?.("Target hex not found.");
  const baseDC = await hexDefense(target);

  const res = await computeDryRun(attacker, { mode, difficulty }, baseDC);
  const out = {
    attackerId: attacker.id, attackerName: attacker.name,
    targetUuid, targetName: (target.flags?.[TERR_ID]?.name || target.text || "Hex"),
    mode, difficulty, ...res
  };
  if (post) {
    const diffName  = RAID_DIFFICULTIES[difficulty]?.name ?? difficulty;
    const modeLabel = (mode === "infiltration") ? "Infiltration (Intrigue)" : "Assault (Violence)";
    const card = `
      <section class="bbttcc-raid">
        <h3 style="margin:0 0 .25rem 0;">BBTTCC — Raid (Dry Run)</h3>
        <p style="margin:.25rem 0;"><strong>Mode:</strong> ${modeLabel} • <strong>Difficulty:</strong> ${diffName}</p>
        <table class="bbttcc-table" style="width:100%;">
          <thead><tr><th style="text-align:left;">Attacker</th><th>Target Hex</th><th>Roll</th><th>DC</th><th>Outcome</th></tr></thead>
          <tbody><tr>
            <td>${foundry.utils.escapeHTML(out.attackerName)} <small>(+${out.key === "intrigue" ? "Intrigue" : "Violence"} ${out.attBonus})</small></td>
            <td>${foundry.utils.escapeHTML(out.targetName)}</td>
            <td class="center"><code>${out.roll.result}</code> = <strong>${out.total}</strong></td>
            <td class="center"><strong>${out.DC}</strong> <small>(Hex ${out.baseDC}${out.diffAdj?` ${out.diffAdj>0?'+':''}${out.diffAdj}`:""})</small></td>
            <td class="center"><strong>${out.outcome}</strong></td>
          </tr></tbody>
        </table>
      </section>`;
    ChatMessage.create({ speaker:{alias:"BBTTCC Raid"}, flavor:card, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });
  }
  return out;
}
async function pickAndDryRun({ attackerId, mode="assault", difficulty="medium", post=false } = {}) {
  const sel = await pickTargetHex({ prompt:"Click a BBTTCC hex to raid…" });
  if (!sel) return null;
  return await raidDryRun({ attackerId, mode, difficulty, targetUuid: sel.uuid, post });
}

/* ---------------- War Log (side-aware) ---------------- */
function buildRaidWarLog(side, round, { ts, dateStr, selfName, oppName, spentAtk=0, spentDef=0, totalFinal=0, sBonus=0, dBonus=0, dcFinal=0, drainsAtk=[], drainsDef=[], clampA=false, clampD=false }) {
  const modeLabel = round.mode==="infiltration" ? "Infiltration" : "Assault";
  const diffName  = RAID_DIFFICULTIES[round.difficulty]?.name ?? round.difficulty;
  const isAtt = side === "att";
  const povAction = isAtt ? modeLabel : "Defense";
  const vs = isAtt ? (round.targetName || oppName || "—") : (round.attackerName || oppName || "—");
  const spendLine = isAtt ? `; spend Atk ${spentAtk} (+${sBonus})` : `; spend Def ${spentDef} (+${dBonus})`;
  const fmtDr = (arr)=> arr.length ? arr.map(d=>`${d.resource} -${d.amount}`).join(", ") : "—";
  const drains = isAtt ? `; drains — Atk: ${fmtDr(drainsAtk)}` : `; drains — Def: ${fmtDr(drainsDef)}`;
  const clamps = ((isAtt?clampA:clampD) ? ` (clamped)` : "");
  const wonAsAtt = (totalFinal >= dcFinal);
  const sideWon  = isAtt ? wonAsAtt : !wonAsAtt;
  const outcome  = sideWon ? (wonAsAtt && isAtt && (totalFinal >= dcFinal + 5) ? "win+" : "win") : "loss";
  const summary = `${povAction} vs ${vs} — ${diffName}; roll ${round.roll?.result ?? "—"} → <b>${totalFinal}</b> vs DC ${dcFinal}${spendLine}${drains}${clamps}.`;
  return {
    ts, date: dateStr, type: "raid", side,
    opponent: oppName || (isAtt ? round.targetName : round.attackerName) || "",
    outcome, summary, mode: round.mode, difficulty: round.difficulty,
    targetUuid: round.targetUuid, targetName: round.targetName,
    total: Number(totalFinal || 0), dc: Number(dcFinal || 0),
    attackerBonus: Number(round.attBonus || 0),
    spendAtk: Number(spentAtk||0), spendDef: Number(spentDef||0),
    spendBonusAttack: Number(sBonus||0), spendBonusDefend: Number(dBonus||0),
    drainsAtk, drainsDef, clampA: !!clampA, clampD: !!clampD
  };
}
async function appendWarLog(actor, entry) {
  if (!actor) return;
  const flags = foundry.utils.duplicate(actor.flags?.[FCT_ID] ?? {});
  const warLogs = Array.isArray(flags.warLogs) ? flags.warLogs : [];
  warLogs.push(entry);
  await actor.update({ [`flags.${FCT_ID}.warLogs`]: warLogs });
}

/* ---------------- Commit kernels ---------------- */
async function drainForOPSpend(actor, opKey, amount){
  const want = Math.max(0, Number(amount||0));
  if (!want) return { total:0, breakdown:[], clamped:false };
  const prefs = DUAL_SPEND_MAP[opKey] || [];
  const breakdown = [];
  let rem = want; let clampedOut = false;
  for (const rk of prefs){
    if (rem <= 0) break;
    const { taken, clamped } = await drainStockpile(actor, rk, rem);
    if (taken>0) breakdown.push({ resource:rk, amount:taken });
    rem -= taken; clampedOut = clampedOut || clamped;
  }
  if (rem > 0) clampedOut = true;
  return { total: want - rem, breakdown, clamped: clampedOut };
}

async function commitLocal({ attackerId, defenderId, staged, round, baseBonus, extraAtk=0, extraDC=0, rerollBest=false }) {
  const att = game.actors.get(attackerId);
  const def = defenderId ? game.actors.get(defenderId) : null;
  const cat = round.mode==="infiltration" ? "intrigue" : "violence";

  const spentAtk = Number(staged?.att?.[cat]||0);
  const spentDef = Number(staged?.def?.[cat]||0);

  if (att && spentAtk>0) await spendFromOPBank(att, cat, spentAtk);
  if (def && spentDef>0) await spendFromOPBank(def, cat, spentDef);

  let drainsAtk = [], drainsDef = []; let clampA = false, clampD = false;
  if (att && spentAtk>0) {
    const dr = await drainForOPSpend(att, cat, spentAtk);
    drainsAtk = dr.breakdown; clampA = dr.clamped;
  }
  if (def && spentDef>0) {
    const dr = await drainForOPSpend(def, cat, spentDef);
    drainsDef = dr.breakdown; clampD = dr.clamped;
  }

  const sBonus = Math.ceil(spentAtk / 2);
  const dBonus = Math.ceil(spentDef / 2);

  const roll1 = await (new Roll("1d20 + @b + @s + @x", { b: baseBonus, s: sBonus, x: extraAtk })).evaluate({async:true});
  let usedRoll = roll1;
  if (rerollBest) {
    const roll2 = await (new Roll("1d20 + @b + @s + @x", { b: baseBonus, s: sBonus, x: extraAtk })).evaluate({async:true});
    usedRoll = (roll2.total > roll1.total) ? roll2 : roll1;
  }

  const dcFinal = Number(round.DC || 0) + dBonus + Number(round.diffOffset || 0) + Number(extraDC||0);
  const totalFinal = usedRoll.total;

  return { roll: usedRoll, totalFinal, dcFinal, spentAtk, spentDef, sBonus, dBonus, drainsAtk, drainsDef, clampA, clampD };
}

/* ======================================================================
 * ApplicationV2: Raid Console (adds Maneuvers UI + Commit hook)
 * ====================================================================== */
const _appApi = foundry?.applications?.api || {};
const AppV2   = _appApi.ApplicationV2 || Application;
const HBM     = _appApi.HandlebarsApplicationMixin || ((Base)=>class extends Base{});

class BBTTCC_RaidConsole extends HBM(AppV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-raid-console",
    title: "BBTTCC — Raid Console",
    classes: ["bbttcc","bbttcc-raid-console","bbttcc-raid-planner"],
    width: 980, height: 720, resizable: true, minimizable: true, positionOrtho: true
  };
  static PARTS = { body: { template: "modules/bbttcc-raid/templates/raid-console.hbs" } };

  vm = { attackerId:"", mode:"assault", difficulty:"medium", targetName:"—", targetUuid:"", rounds:[], logWar:false, includeDefender:true };

  /* Merge external registry with fallbacks */
  _mansForMode(mode){
    try {
      const ext = game.bbttcc?.api?.raid?.getManeuvers ? game.bbttcc.api.raid.getManeuvers(mode) : {};
      const fb  = FALLBACK_MANEUVERS[mode] || {};
      const out = Object.assign({}, fb, ext); // ext can override labels/costs if present
      return out;
    } catch { return FALLBACK_MANEUVERS[mode] || {}; }
  }

  _renderManeuversInto(tr, round){
    try {
      const host = tr.querySelector(".bbttcc-mans-cell"); if (!host) return;
      host.innerHTML = "";
      const map = this._mansForMode(round.mode);
      const keys = Object.keys(map);
      if (!keys.length) { host.innerHTML = `<em>No maneuvers for this mode.</em>`; return; }
      const fs = document.createElement("fieldset");
      fs.className = "bbttcc-mans";
      const lg = document.createElement("legend"); lg.textContent = "Maneuvers (optional)"; fs.appendChild(lg);
      const wrap = document.createElement("div");
      wrap.style.display="grid"; wrap.style.gridTemplateColumns="1fr 1fr"; wrap.style.gap=".25rem .5rem";
      for (const k of keys){
        const m = map[k]; const id = `m-${round.roundId}-${k}`;
        const lbl = document.createElement("label"); lbl.style.display="flex"; lbl.style.alignItems="center"; lbl.style.gap=".25rem";
        lbl.innerHTML = `<input type="checkbox" data-maneuver="${k}" id="${id}"><span title="${m?.label||k}">${m?.label||k}</span>`;
        wrap.appendChild(lbl);
      }
      fs.appendChild(wrap);
      host.appendChild(fs);
    } catch(e){ warn("renderMans", e); }
  }

  _collectMans(idx){
    const row = this.element?.querySelector(`tbody tr[data-idx="${idx}"]`);
    const manage = row?.nextElementSibling;
    const boxes = manage?.querySelectorAll?.('input[type="checkbox"][data-maneuver]');
    const list = boxes ? [...boxes].filter(b=>b.checked).map(b=>b.dataset.maneuver) : [];
    return { att: list, def: [] };
  }

  async _preparePartContext(part, context) {
    const facs = (game.actors?.contents ?? []).filter(isFaction).sort((a,b)=>a.name.localeCompare(b.name));
    const attackerOptions = [{ id:"", name:"(select)" }].concat(facs.map(f => ({ id:f.id, name:f.name })));
    const difficulties = Object.entries(RAID_DIFFICULTIES).map(([k,v]) => ({ key:k, label:`${v.name} (${v.modifier>=0?"+":""}${v.modifier})` }));
    context.vm = this.vm; context.attackerOptions = attackerOptions; context.difficulties = difficulties;
    context.hasRounds = Array.isArray(this.vm.rounds) && this.vm.rounds.length>0;

    const attacker = await getActorByIdOrUuid(this.vm.attackerId);
    const target   = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
    const defId    = target?.flags?.[TERR_ID]?.factionId || "";
    const defender = defId ? game.actors.get(defId) : null;
    const catTop   = (this.vm.mode === "infiltration") ? "intrigue" : "violence";

    const openRound = (this.vm.rounds || []).find(r => r.open) || null;
    let stagedDTop = 0, diffOffsetTop = 0;
    if (openRound && openRound.localStaged) {
      const k = (openRound.mode === "infiltration") ? "intrigue" : "violence";
      stagedDTop    = Number(openRound.localStaged?.def?.[k] || 0);
      diffOffsetTop = Number(openRound.diffOffset || 0);
    }
    let baseTop = null, projTop = null, bonusTop = 0;
    if (target && defender) {
      const baseDC = await hexDefense(target);
      bonusTop = Math.ceil(stagedDTop / 2);
      baseTop = baseDC;
      projTop = baseDC + bonusTop + diffOffsetTop;
    }

    context.currentBank = {
      cat: catTop,
      attacker: attacker ? getOPBank(attacker) : null,
      attackerName: attacker?.name || "(none)",
      defender: defender ? getOPBank(defender) : null,
      defenderName: defender?.name || "(none)",
      hasDef: !!defender,
      topDC: target && defender ? { base: baseTop, defProjBonus: bonusTop, projected: projTop } : null
    };

    for (const r of this.vm.rounds) {
      delete r.view;
      if (!r.open) continue;

      const att = await getActorByIdOrUuid(r.attackerId);
      const tgt = r.targetUuid ? await fromUuid(r.targetUuid) : null;
      const dId = tgt?.flags?.[TERR_ID]?.factionId || "";
      const def = dId ? game.actors.get(dId) : null;

      const cat = (r.mode === "infiltration") ? "intrigue" : "violence";
      const staged = r.localStaged || { att:{}, def:{} };

      const bankAtt = att ? getOPBank(att) : emptyOP();
      const bankDef = def ? getOPBank(def) : emptyOP();

      const stagedA = Number(staged?.att?.[cat]||0);
      const stagedD = Number(staged?.def?.[cat]||0);
      const remainA = Math.max(0, Number(bankAtt[cat]||0) - stagedA);
      const remainD = Math.max(0, Number(bankDef[cat]||0) - stagedD);

      const defProjBonus = Math.ceil(stagedD / 2);
      const dcProjected  = Number(r.DC || 0) + defProjBonus + Number(r.diffOffset || 0);

      r.view = {
        cat, hasDef: !!def,
        staged, bankAtt, bankDef,
        remainA, remainD,
        defProjBonus, dcProjected,
        attackerName: att?.name || "(unknown)",
        defenderName: def?.name || "(none)"
      };
    }
    return context;
  }

  _onRender() {
    try { const el = this.element; if (!this.__centered){ el.style.left="calc(50% - 490px)"; el.style.top="72px"; this.__centered=true; } } catch {}
    this._bindUI();
    for (let i=0;i<(this.vm.rounds||[]).length;i++){
      const r = this.vm.rounds[i]; if (!r.open) continue;
      const manageRow = this.element?.querySelector(`tbody tr[data-idx="${i}"]`)?.nextElementSibling;
      if (manageRow) this._renderManeuversInto(manageRow, r);
    }
  }

  _bindUI() {
    const $root = $(this.element);
    $root.off(".bbttccRaid");

    // Header
    $root.on("change.bbttccRaid","[data-id='attacker']", (ev)=>{ this.vm.attackerId = ev.currentTarget.value || ""; this.render(); });
    $root.on("click.bbttccRaid","[data-id='mode-assault']", (ev)=>{ ev.preventDefault(); this.vm.mode="assault"; this.render(); });
    $root.on("click.bbttccRaid","[data-id='mode-infil']",   (ev)=>{ ev.preventDefault(); this.vm.mode="infiltration"; this.render(); });
    $root.on("change.bbttccRaid","[data-id='difficulty']",  (ev)=>{ this.vm.difficulty = ev.currentTarget.value || "medium"; });
    $root.on("change.bbttccRaid","[data-id='logWar']",      (ev)=>{ this.vm.logWar = ev.currentTarget.checked; });
    $root.on("change.bbttccRaid","[data-id='logDef']",      (ev)=>{ this.vm.includeDefender = ev.currentTarget.checked; });

    // Pick Hex
    $root.on("click.bbttccRaid","[data-id='pick-hex']", async (ev)=>{
      ev.preventDefault();
      const sel = await pickTargetHex({ prompt:"Click a BBTTCC hex to raid…" });
      if (!sel) return;
      this.vm.targetUuid = sel.uuid || "";
      this.vm.targetName = (sel.flags?.name || (sel.uuid ? sel.uuid.split(".").pop() : "—"));
      ui.notifications?.info?.(`Target: ${this.vm.targetName}`);
      this.render();
    });

    // Add Round
    $root.on("click.bbttccRaid","[data-id='add-round']", async (ev)=>{
      ev.preventDefault();
      if (!this.vm.attackerId) return ui.notifications?.warn?.("Pick an attacker faction first.");
      if (!this.vm.targetUuid) return ui.notifications?.warn?.("Pick a target hex first.");

      const attacker = await getActorByIdOrUuid(this.vm.attackerId);
      const target = this.vm.targetUuid ? await fromUuid(this.vm.targetUuid) : null;
      if (!attacker || !target) return;

      const baseDC = await hexDefense(target);
      const comp   = await computeDryRun(attacker, { mode:this.vm.mode, difficulty:this.vm.difficulty }, baseDC);

      const round = {
        ts: Date.now(),
        attackerId: attacker.id, attackerName: attacker.name,
        targetUuid: target.uuid, targetName: (target.flags?.[TERR_ID]?.name || target.text || "Hex"),
        mode: this.vm.mode, difficulty:this.vm.difficulty, ...comp,
        open:true, roundId:randid(), local:true, localStaged:{ att:{}, def:{} },
        diffOffset: 0
      };

      const cat = (round.mode === "infiltration") ? "intrigue" : "violence";
      const plan = foundry.utils.getProperty(attacker, `flags.${FCT_ID}.raidPlan`) || {};
      const want = Number(plan?.[cat]?.value ?? plan?.[cat] ?? 0) || 0;
      const avail = getOPBank(attacker)?.[cat] || 0;
      const staged = Math.min(Math.max(0, want), avail);
      if (staged > 0) round.localStaged.att[cat] = staged;

      ui.notifications?.info?.(`Imported Raid Plan (${cat}): requested ${want} → staged ${staged} (bank ${avail}).`);
      this.vm.rounds.push(round);
      this.render();
    });

    // Reset
    $root.on("click.bbttccRaid","[data-id='reset']", (ev)=>{ ev.preventDefault(); if (!confirm("Clear all rounds in this console?")) return; this.vm.rounds = []; this.render(); });

    // Row actions
    $root.on("click.bbttccRaid","[data-act]", async (ev)=>{
      ev.preventDefault();
      const btn = ev.currentTarget;
      const idx = Number(btn.closest("tr")?.dataset?.idx ?? -1);
      if (idx < 0) return;
      const r = this.vm.rounds[idx]; if (!r) return;
      const act = btn.dataset.act;

      if (act === "manage") {
        r.open = !r.open; this.render();
        if (r.open) {
          const manageRow = this.element?.querySelector(`tbody tr[data-idx="${idx}"]`)?.nextElementSibling;
          if (manageRow) this._renderManeuversInto(manageRow, r);
        }
      }
      else if (act === "post") {
        const diffName = RAID_DIFFICULTIES[r.difficulty]?.name ?? r.difficulty;
        const modeLabel = r.mode==="infiltration" ? "Infiltration (Intrigue)" : "Assault (Violence)";
        const dcShown = (r.dcFinal ?? r.DC) + Number(r.dcFinal ? 0 : (r.diffOffset||0));
        const card = `
          <section class="bbttcc-raid">
            <h3 style="margin:0 0 .25rem 0;">BBTTCC — Raid (Round ${idx+1})</h3>
            <p style="margin:.25rem 0;"><strong>Mode:</strong> ${modeLabel} • <strong>Difficulty:</strong> ${diffName}${r.diffOffset?` • <strong>Adj:</strong> ${r.diffOffset>0?'+':''}${r.diffOffset}`:''}</p>
            <table class="bbttcc-table" style="width:100%;">
              <thead><tr><th style="text-align:left;">Attacker</th><th>Target Hex</th><th>Roll</th><th>DC</th><th>Outcome</th></tr></thead>
              <tbody><tr>
                <td>${foundry.utils.escapeHTML(r.attackerName)} <small>(+${r.attBonus} ${r.key})</small></td>
                <td>${foundry.utils.escapeHTML(r.targetName)}</td>
                <td class="center"><code>${r.roll?.result ?? "—"}</code> ${r.total?`= <strong>${r.total}</strong>`:""}</td>
                <td class="center">${dcShown}</td>
                <td class="center"><strong>${r.outcome ?? "—"}</strong></td>
              </tr></tbody>
            </table>
          </section>`;
        ChatMessage.create({ speaker:{alias:"BBTTCC Raid"}, flavor:card, whisper: game.users.filter(u=>u.isGM).map(u=>u.id) });
      }
      else if (act === "copy") {
        const dcShown = (r.dcFinal ?? r.DC) + Number(r.dcFinal ? 0 : (r.diffOffset||0));
        const txt = `Raid Round ${idx+1} — ${r.attackerName} → ${r.targetName} | ${r.mode}/${r.difficulty} | adj ${r.diffOffset||0} | atk +${r.attBonus} vs DC ${dcShown} | roll ${r.roll?.result ?? "—"} ${r.total?`= ${r.total}`:""} → ${r.outcome ?? "—"}`;
        try {
          if (navigator?.clipboard?.writeText) await navigator.clipboard.writeText(txt);
          else { const ta=document.createElement("textarea"); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
          ui.notifications?.info?.("Round summary copied.");
        } catch { ui.notifications?.warn?.("Could not copy to clipboard."); }
      }
      else if (act === "del") { this.vm.rounds.splice(idx, 1); this.render(); }
    });

    // Manage actions
    $root.on("click.bbttccRaid","[data-manage-act]", async (ev)=>{
      ev.preventDefault();
      const btn = ev.currentTarget;
      const idx = Number(btn.closest("tr")?.dataset?.idx ?? -1);
      if (idx < 0) return;
      const r = this.vm.rounds[idx]; if (!r) return;

      const attacker = await getActorByIdOrUuid(r.attackerId);
      const target   = r.targetUuid ? await fromUuid(r.targetUuid) : null;
      const defId    = target?.flags?.[TERR_ID]?.factionId || "";
      const defender = defId ? game.actors.get(defId) : null;

      const act = btn.dataset.manageAct;
      if (act === "close") { r.open = false; return this.render(); }

      const cat = (r.mode === "infiltration") ? "intrigue" : "violence";

      if (act === "commit") {
        const baseBonus = categoryTotal(attacker, cat);
        const mans = this._collectMans(idx);

        const resolver = game.bbttcc?.api?.raid?.resolveRoundWithManeuvers;
        if (resolver && (mans.att.length || mans.def.length)) {
          try {
            const res = await resolver({
              attackerId: attacker?.id,
              defenderId: defender?.id || null,
              round: r,
              maneuversAtt: mans.att,
              maneuversDef: mans.def
            });
            if (res) {
              const ts = Date.now(), dateStr = new Date(ts).toLocaleString();
              const entryAtt = buildRaidWarLog("att", r, {
                ts, dateStr, selfName: attacker?.name, oppName: defender?.name || r.targetName,
                spentAtk: res.spentAtk, spentDef: res.spentDef, sBonus: res.sBonus, dBonus: res.dBonus,
                totalFinal: res.totalFinal, dcFinal: res.dcFinal,
                drainsAtk: (res.drainsAtk||[]), drainsDef: (res.drainsDef||[]),
                clampA: !!res.clampA, clampD: !!res.clampD
              });
              await appendWarLog(attacker, entryAtt);
              if (defender && this.vm.includeDefender) {
                const entryDef = buildRaidWarLog("def", r, {
                  ts, dateStr, selfName: defender?.name, oppName: attacker?.name,
                  spentAtk: res.spentAtk, spentDef: res.spentDef, sBonus: res.sBonus, dBonus: res.dBonus,
                  totalFinal: res.totalFinal, dcFinal: res.dcFinal,
                  drainsAtk: (res.drainsAtk||[]), drainsDef: (res.drainsDef||[]),
                  clampA: !!res.clampA, clampD: !!res.clampD
                });
                await appendWarLog(defender, entryDef);
              }
              r.committed = true; r.open = false; r.roll = res.roll; r.total = res.totalFinal; r.dcFinal = res.dcFinal;
              r.outcome = (res.totalFinal >= res.dcFinal + 5) ? "Great Success" : (res.totalFinal >= res.dcFinal ? "Success" : "Fail");
              this.render();
              return;
            }
          } catch (e) { warn("resolveRoundWithManeuvers failed (fallback)", e); }
        }

        // Fallback — original flow
        const commitRes = await commitLocal({
          attackerId: attacker?.id, defenderId: defender?.id || null,
          staged: r.localStaged, round: r, baseBonus
        });
        const ts = Date.now(), dateStr = new Date(ts).toLocaleString();
        const entry = buildRaidWarLog("att", r, {
          ts, dateStr, defenderName: defender?.name,
          spentAtk: commitRes.spentAtk, spentDef: commitRes.spentDef,
          sBonus: commitRes.sBonus, dBonus: commitRes.dBonus,
          totalFinal: commitRes.totalFinal, dcFinal: commitRes.dcFinal,
          drainsAtk: commitRes.drainsAtk, drainsDef: commitRes.drainsDef,
          clampA: commitRes.clampA, clampD: commitRes.clampD
        });
        await appendWarLog(attacker, entry);
        if (defender && this.vm.includeDefender) await appendWarLog(defender, { ...entry, side:"def", outcome: (commitRes.totalFinal >= commitRes.dcFinal ? "loss" : "win") });

        r.committed = true; r.open = false;
        r.roll = commitRes.roll; r.total = commitRes.totalFinal;
        r.dcFinal = commitRes.dcFinal;
        r.outcome = (commitRes.totalFinal >= commitRes.dcFinal + 5) ? "Great Success" : (commitRes.totalFinal >= commitRes.dcFinal ? "Success" : "Fail");
        this.render();
        return;
      }

      if (act === "cancel") { r.cancelled = true; r.open = false; this.render(); return; }

      if (act === "diff") {
        const delta = Number(btn.dataset.delta || 0);
        r.diffOffset = clamp(Number(r.diffOffset||0) + delta, -50, 50);
        return this.render();
      }

      // ± staging with bank guard
      r.localStaged ||= { att:{}, def:{} };
      const who    = btn.dataset.who;
      const key    = btn.dataset.key;
      const delta  = Number(btn.dataset.delta||0);
      const bucket = r.localStaged[who] ||= {};

      if ((who==="att" || who==="def") && delta>0) {
        const fac = (who==="att") ? attacker : defender;
        if (!fac) return;
        const bank = getOPBank(fac);
        const stagedAlready = Number(bucket[key]||0);
        const remain = Number(bank[key]||0) - stagedAlready;
        if (remain <= 0) { ui.notifications?.warn?.(`${who==="att"?"Attacker":"Defender"} has no ${key} left in OP Turn Bank.`); return; }
      }
      bucket[key] = Math.max(0, Number(bucket[key]||0) + delta);
      this.render();
    });
  }
}

/* ---------------- API + Toolbar ---------------- */
function bindAPI() {
  const mod = game.modules.get(RAID_ID); if (!mod) return;
  let _console = null;
  async function openConsole() { if (!_console) _console = new BBTTCC_RaidConsole(); await _console.render(true, { focus: true }); return _console; }
  const api = { pickTargetHex, raidDryRun, pickAndDryRun, openRaidConsole:openConsole, openConsole, RAID_DIFFICULTIES };
  mod.api = Object.assign(mod.api || {}, api);
  globalThis.BBTTCC_Raid = Object.assign(globalThis.BBTTCC_Raid || {}, api);
  globalThis.BBTTCC_OpenRaidConsole = openConsole;
  globalThis.BBTTCC_RaidOpen = openConsole;
  try { game.bbttcc ??= { api:{} }; game.bbttcc.api ??= {}; game.bbttcc.api.raid ??= {}; Object.assign(game.bbttcc.api.raid, api); }
  catch(e){ warn("bind game.bbttcc.api.raid", e); }
  log("API ready.");
}
function attachRaidButtonToToolbar() {
  try {
    const el = document.getElementById("bbttcc-toolbar");
    if (!el) return false;
    if (el.querySelector('a.btn[data-act="raid"]')) return true;
    const rows = el.querySelectorAll(".row");
    const targetRow = rows[1] || rows[0] || el;
    const btn = document.createElement("a");
    btn.className = "btn"; btn.setAttribute("data-act","raid");
    btn.innerHTML = `<i class="fas fa-crosshairs"></i><span>Raid</span>`;
    targetRow.appendChild(btn);
    if (!el.__bbttccRaidClickBound) {
      el.addEventListener("click", async (ev) => {
        const a = ev.target.closest?.('a.btn[data-act="raid"]'); if (!a) return;
        ev.preventDefault();
        try {
          const open = game?.bbttcc?.api?.raid?.openConsole || game.modules.get(RAID_ID)?.api?.openRaidConsole || globalThis.BBTTCC_OpenRaidConsole;
          if (typeof open !== "function") return ui.notifications?.warn?.("BBTTCC Raid Console is not available.");
          await open();
        } catch (e) { console.error(TAG, "Toolbar Raid button failed", e); ui.notifications?.error?.("Could not open Raid Console — see console."); }
      });
      el.__bbttccRaidClickBound = true;
    }
    log("Raid button attached to BBTTCC toolbar."); return true;
  } catch (e) { warn("attachRaidButtonToToolbar error", e); return false; }
}
function watchToolbar() {
  if (attachRaidButtonToToolbar()) return;
  const obs = new MutationObserver(() => { if (attachRaidButtonToToolbar()) obs.disconnect(); });
  obs.observe(document.body, { childList: true, subtree: true });
  globalThis.__bbttccRaidToolbarObserver = obs;
}
function bindWithRetries() { bindAPI(); setTimeout(bindAPI,0); setTimeout(bindAPI,50); setTimeout(bindAPI,250); setTimeout(bindAPI,1000); }
Hooks.once("ready", () => { bindWithRetries(); watchToolbar(); });

/* ---------------- utils ---------------- */
async function getActorByIdOrUuid(maybeIdOrUuid) {
  const s = String(maybeIdOrUuid ?? ""); if (!s) return null;
  try { if (s.startsWith("Actor.")) return await fromUuid(s); return game.actors.get(s) ?? null; }
  catch (e) { warn("getActorByIdOrUuid error", e); return null; }
}
