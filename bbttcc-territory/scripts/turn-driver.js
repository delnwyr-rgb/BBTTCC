// modules/bbttcc-territory/scripts/turn-driver.js
// Adds: game.bbttcc.api.territory.advanceTurn({apply:false|true})
// Also adds a safe global alias: BBTTCC_advanceTurn(opts)
// Robustly (re)binds in case another script overwrites game.bbttcc.api.territory later.

(() => {
  const MOD_TERR = "bbttcc-territory";
  const MOD_FACTIONS = "bbttcc-factions";
  const NS = "[bbttcc-turn]";

  const log  = (...a) => console.log(NS, ...a);
  const warn = (...a) => console.warn(NS, ...a);

  /* ---------- Tables & helpers (match your Campaign Overview math) ---------- */
  const SIZE_TABLE = {
    outpost:{ mult:0.50, defense:0 }, village:{ mult:0.75, defense:1 },
    town:{ mult:1.00, defense:1 },   city:{ mult:1.50, defense:2 },
    metropolis:{ mult:2.00, defense:3 }, megalopolis:{ mult:3.00, defense:4 }
  };
  const SIZE_ALIAS = { small:"outpost", standard:"town", large:"metropolis" };

  const MODS = {
    "Well-Maintained":{ multAll:+0.25, defense:+1, loyalty:+1 },
    "Fortified":{ defense:+3 },
    "Strategic Position":{ multAll:+0.10, flags:{ adjacencyBonus:true } },
    "Hidden Resources":{},
    "Loyal Population":{ multAll:+0.15, loyalty:+2 },
    "Trade Hub":{ multPer:{ trade:+0.50 }, diplomacy:+2 },
    "Contaminated":{ multAll:-0.50, flags:{ radiation:true } },
    "Damaged Infrastructure":{ multAll:-0.25 },
    "Hostile Population":{ multAll:-0.25, loyalty:-2 },
    "Supply Line Vulnerable":{ multAll:-0.10, flags:{ supplyVulnerable:true } },
    "Difficult Terrain":{ multAll:-0.10, defense:+1 },
    "Radiation Zone":{ multAll:-0.75, flags:{ radiation:true, radiationZone:true } }
  };

  const SEPHIROT = {
    keter:{ addPer:{ all:+1 }, tech:+1 },
    chokmah:{ addPer:{ knowledge:+2, trade:+2 } },
    binah:{ addPer:{ knowledge:+2, trade:+2 } },
    chesed:{ diplomacy:+3, loyalty:+3 },
    gevurah:{ addPer:{ military:+3 }, defense:+1 },
    tiferet:{ diplomacy:+2, loyalty:+2 },
    netzach:{ addPer:{ military:+2 }, loyalty:+2 },
    hod:{ addPer:{ knowledge:+2, trade:+2 } },
    yesod:{ addPer:{ trade:+2 }, diplomacy:+2 },
    malkuth:{ addPer:{ trade:+4 } }
  };

  const STATUS_BANDS = [
    { key:"Emerging",min:0,max:99 }, { key:"Growing",min:100,max:199 },
    { key:"Established",min:200,max:299 }, { key:"Powerful",min:300,max:399 },
    { key:"Dominant",min:400,max:Infinity }
  ];
  const bandFor = t => (STATUS_BANDS.find(b => t>=b.min && t<=b.max)?.key) || "Emerging";

  const HR_KEYS = ["food","materials","trade","military","knowledge"];
  const zRes = () => ({ food:0, materials:0, trade:0, military:0, knowledge:0, technology:0 });
  const addRes = (A,B)=>{ for (const k in A) A[k]=Number(A[k])+Number(B?.[k]??0); return A; };
  const stablePick = s => { s=String(s||""); let h=0; for (let i=0;i<s.length;i++) h=(h+s.charCodeAt(i))%9973; return HR_KEYS[h%HR_KEYS.length]; };
  const looksLikeTechnocrat = a => { try { return JSON.stringify(a?.flags??{}).toLowerCase().includes("technocrat"); } catch { return false; } };

  function normalizeSizeKey(raw){ let k=String(raw??"").toLowerCase().trim(); if(!k) k="town"; if(SIZE_ALIAS[k]) k=SIZE_ALIAS[k]; return SIZE_TABLE[k]?k:"town"; }
  function calcBaseByType(type){
    const b={ food:0,materials:0,trade:0,military:0,knowledge:0 };
    switch(String(type??"").toLowerCase()){
      case "farm": b.food=20; b.trade=5; break;
      case "mine": b.materials=20; b.trade=5; break;
      case "settlement": b.trade=10; b.military=5; break;
      case "fortress": b.military=20; break;
      case "port": b.trade=15; b.food=5; break;
      case "factory": b.materials=15; b.military=5; break;
      case "research": b.knowledge=20; break;
      case "temple": b.knowledge=10; b.trade=5; break;
      case "ruins": b.materials=5; break;
    } return b;
  }
  function keyFromName(n){ return String(n||"").toLowerCase().trim().replace(/[^\p{L}]+/gu,""); }
  async function resolveSephirotKeyFromFlags(f){
    if (f.sephirotKey) return String(f.sephirotKey).toLowerCase().trim();
    if (!f.sephirotUuid) return "";
    try { const it = await fromUuid(f.sephirotUuid); return keyFromName(it?.name??""); } catch { return ""; }
  }
  function isHexDrawing(dr){ const f=dr.flags?.[MOD_TERR]??{}; return f.isHex===true || f.kind==="territory-hex"; }

  async function effHexWithAll(dr){
    const f = dr.flags?.[MOD_TERR] ?? {};
    const sizeKey = normalizeSizeKey(f.size);
    const { mult, defense: sizeDefense } = SIZE_TABLE[sizeKey];

    const stored = {
      food:Number(f.resources?.food??0), materials:Number(f.resources?.materials??0),
      trade:Number(f.resources?.trade??0), military:Number(f.resources?.military??0),
      knowledge:Number(f.resources?.knowledge??0)
    };
    const auto = !!f.autoCalc || Object.values(stored).every(n=>n===0);
    const base = auto ? calcBaseByType(f.type??"settlement") : stored;
    const sized = Object.fromEntries(Object.entries(base).map(([k,v])=>[k, Number(v)*mult]));

    let factorAll=1, factorPer={ food:1,materials:1,trade:1,military:1,knowledge:1 }, addPer={ food:0,materials:0,trade:0,military:0,knowledge:0 };
    let defense=sizeDefense;
    let flags={ radiation:false, supplyVulnerable:false, adjacencyBonus:false };

    if (Array.isArray(f.modifiers)) for (const m of f.modifiers){
      const spec = MODS[m]; if (!spec) continue;
      if (typeof spec.multAll === "number") factorAll *= (1+spec.multAll);
      if (spec.multPer) for (const k of Object.keys(spec.multPer)) factorPer[k] *= (1+Number(spec.multPer[k]||0));
      if (spec.addPer)  for (const k of Object.keys(spec.addPer))  addPer[k]   += Number(spec.addPer[k]||0);
      if (typeof spec.defense === "number") defense += spec.defense;
      if (spec.flags?.radiation) flags.radiation = true;
      if (spec.flags?.supplyVulnerable) flags.supplyVulnerable = true;
      if (spec.flags?.adjacencyBonus) flags.adjacencyBonus = true;
      if (m === "Hidden Resources") addPer[stablePick(dr.id||dr.uuid||"")] += 1;
    }

    const eff = {};
    for (const k of Object.keys(sized)) eff[k] = Number(sized[k]) * factorAll * factorPer[k];
    for (const k of Object.keys(addPer)) eff[k] = Number(eff[k]) + Number(addPer[k]||0);

    const seKey = await resolveSephirotKeyFromFlags(f);
    const se = SEPHIROT[seKey];
    if (se?.addPer){
      if (se.addPer.all) for (const k of ["food","materials","trade","military","knowledge"]) eff[k] = Number(eff[k]) + Number(se.addPer.all);
      for (const k of Object.keys(se.addPer)) if (k!=="all") eff[k] = Number(eff[k]) + Number(se.addPer[k]||0);
    }
    if (typeof se?.defense === "number") defense += se.defense;

    for (const k of Object.keys(eff)) eff[k] = Math.round(eff[k]);
    let technology = Number(eff.knowledge||0);
    if ((f.type??"") === "research") technology += 2;
    if (se?.tech) technology += Number(se.tech||0);

    return { ...eff, technology, defenseBonus:Number(defense||0), flags };
  }

  function isFactionActor(a){
    if (!a) return false;
    try{
      if (a.getFlag?.(MOD_FACTIONS,"isFaction") === true) return true;
      const sysType = String(foundry.utils.getProperty(a,"system.details.type.value")??"").toLowerCase();
      if (sysType === "faction") return true;
      const sheetClass = a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
      if (String(sheetClass||"").includes("BBTTCCFactionSheet")) return true;
      const ctorName = a?.sheet?.constructor?.name || "";
      if (ctorName.includes("BBTTCCFactionSheet")) return true;
      return false;
    } catch { return false; }
  }
  function isCharacter(a){ return String(a?.type??"").toLowerCase()==="character"; }
  function normalizeOps(o={}){
    return {
      violence:Number(o.violence??0), nonlethal:Number(o.nonlethal??o.nonLethal??0),
      intrigue:Number(o.intrigue??0), economy:Number(o.economy??0),
      softpower:Number(o.softpower??o.softPower??0), diplomacy:Number(o.diplomacy??0),
      logistics:Number(o.logistics??0), culture:Number(o.culture??0), faith:Number(o.faith??0)
    };
  }
  function characterBelongsToFaction(char, faction){
    const byId = char.getFlag?.(MOD_FACTIONS,"factionId");
    if (byId) return byId === faction.id;
    const legacy = char?.flags?.[MOD_TERR]?.faction;
    if (!legacy) return false;
    return String(legacy).trim() === String(faction.name).trim();
  }
  function computeFactionTotalOPs(fa){
    const KEYS = ["violence","nonlethal","intrigue","economy","softpower","diplomacy","logistics","culture","faith"];
    const opsFlags = foundry.utils.duplicate(fa.getFlag(MOD_FACTIONS,"ops")||{});
    const value = normalizeOps(Object.fromEntries(KEYS.map(k=>[k,Number(opsFlags?.[k]?.value??0)])));
    const contrib = { violence:0,nonlethal:0,intrigue:0,economy:0,softpower:0,diplomacy:0,logistics:0,culture:0,faith:0 };
    for (const a of game.actors.contents){
      if (!isCharacter(a)) continue;
      if (!characterBelongsToFaction(a, fa)) continue;
      let c = a.getFlag?.(MOD_FACTIONS,"opContribution");
      if (!c || Object.values(c).every(v=>(Number(v)||0)===0)) c = a?.flags?.["bbttcc-character-options"]?.calculatedOPs || {};
      const cc = normalizeOps(c);
      for (const k of KEYS) contrib[k] += Number(cc[k]||0);
    }
    return KEYS.reduce((s,k)=> s + Number(value[k]||0) + Number(contrib[k]||0), 0);
  }

  async function advanceTurn({ apply=false } = {}){
    if (!game.user?.isGM) return ui.notifications?.warn?.("Only the GM can advance the strategic turn.");

    const factions = (game.actors?.contents??[]).filter(isFactionActor);
    if (!factions.length) return ui.notifications?.warn?.("No Faction actors found.");

    const all = [];
    for (const sc of game.scenes?.contents??[]){
      for (const dr of sc.drawings?.contents??[]){
        if (!isHexDrawing(dr)) continue;
        all.push({ sc, dr, f: dr.flags?.[MOD_TERR] ?? {} });
      }
    }

    const perFaction = new Map();
    for (const fa of factions) perFaction.set(fa.id, { actor:fa, res:zRes(), defense:0, scenes:new Set(), hexCount:0, notes:new Set() });

    for (const { sc, dr } of all){
      const f = dr.flags?.[MOD_TERR] ?? {};
      const fid = String(f.factionId || "");
      const b = perFaction.get(fid);
      if (!b) continue;
      b.hexCount++; b.scenes.add(sc.id);
      const eff = await effHexWithAll(dr);
      addRes(b.res, eff);
      b.defense += Number(eff.defenseBonus||0);
      if (eff.flags?.radiation)        b.notes.add("Radiation");
      if (eff.flags?.supplyVulnerable) b.notes.add("Supply");
      if (eff.flags?.adjacencyBonus)   b.notes.add("Adjacency");
    }

    for (const [, b] of perFaction) if (looksLikeTechnocrat(b.actor))
      b.res.technology = Math.round(b.res.technology * 1.15);

    const rows = [];
    for (const [, b] of perFaction) {
      const total = computeFactionTotalOPs(b.actor);
      rows.push({
        id:b.actor.id, name:b.actor.name, band:bandFor(total), total,
        hexCount:b.hexCount, res:b.res, defense:b.defense,
        notes:[...b.notes].join(", "), scenes:[...b.scenes]
      });
    }
    rows.sort((A,B)=>A.name.localeCompare(B.name));

    const html = `
    <section class="bbttcc-turn-summary">
      <h3 style="margin:0 0 .25rem 0;">Strategic Turn ${apply ? "(APPLY)" : "(Dry Run)"}</h3>
      <table class="bbttcc-table" style="width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;">Faction</th>
            <th style="width:7rem;">Status</th>
            <th style="width:6rem;">Hexes</th>
            <th style="width:8rem;">Food</th>
            <th style="width:8rem;">Materials</th>
            <th style="width:8rem;">Trade</th>
            <th style="width:8rem;">Military</th>
            <th style="width:8rem;">Knowledge</th>
            <th style="width:8rem;">Technology</th>
            <th style="width:7rem;">Defense</th>
            <th style="width:10rem;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><strong>${foundry.utils.escapeHTML(r.name)}</strong></td>
              <td>${game.i18n?.localize?.(\`BBTTCC.PowerLevels.${r.band}\`) || r.band} <small style="opacity:.65;">(${r.total})</small></td>
              <td class="center">${r.hexCount}</td>
              <td class="center">${r.res.food}</td>
              <td class="center">${r.res.materials}</td>
              <td class="center">${r.res.trade}</td>
              <td class="center">${r.res.military}</td>
              <td class="center">${r.res.knowledge}</td>
              <td class="center">${r.res.technology}</td>
              <td class="center">${r.defense}</td>
              <td>${r.notes || "—"}</td>
            </tr>
          `).join("")}
          ${rows.length ? "" : `<tr><td colspan="11" class="center"><em>No faction yields this turn.</em></td></tr>`}
        </tbody>
      </table>
    </section>`;

    await ChatMessage.create({
      content: html,
      whisper: game.users?.filter(u => u.isGM).map(u => u.id) ?? [],
      speaker: { alias: "BBTTCC Turn Driver" }
    });

    if (!apply) return { rows };

    const ts = Date.now();
    for (const r of rows) {
      const a = game.actors.get(r.id);
      if (!a) continue;
      const flags = foundry.utils.duplicate(a.flags?.[MOD_FACTIONS] ?? {});
      const turnBank = flags.turnBank ?? { food:0, materials:0, trade:0, military:0, knowledge:0, technology:0, defense:0 };

      turnBank.food       = Number(turnBank.food)       + Number(r.res.food);
      turnBank.materials  = Number(turnBank.materials)  + Number(r.res.materials);
      turnBank.trade      = Number(turnBank.trade)      + Number(r.res.trade);
      turnBank.military   = Number(turnBank.military)   + Number(r.res.military);
      turnBank.knowledge  = Number(turnBank.knowledge)  + Number(r.res.knowledge);
      turnBank.technology = Number(turnBank.technology) + Number(r.res.technology);
      turnBank.defense    = Number(turnBank.defense)    + Number(r.defense);

      const warLog = Array.isArray(flags.warLog) ? flags.warLog : [];
      warLog.push({ ts, sceneIds:r.scenes, hexCount:r.hexCount, resources:{...r.res}, defense:r.defense,
        notes: r.notes ? r.notes.split(",").map(s=>s.trim()).filter(Boolean) : [] });

      await a.update({ [`flags.${MOD_FACTIONS}.turnBank`]: turnBank, [`flags.${MOD_FACTIONS}.warLog`]: warLog });
    }

    ui.notifications?.info?.("Turn applied: yields added to Factions’ turnBank and War Log entries appended.");
    return { rows };
  }

  // ---- Robust binding: re-attach if the api.territory object gets replaced ----
  function doBind() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= {};
    if (game.bbttcc.api.territory.advanceTurn !== advanceTurn) {
      game.bbttcc.api.territory.advanceTurn = advanceTurn;
      log("advanceTurn bound on game.bbttcc.api.territory");
    }
    // Global alias as a fallback
    globalThis.BBTTCC_advanceTurn = advanceTurn;
  }

  function bindWithRetries() {
    // try immediately, then a few delayed retries (covers late overwrites)
    doBind();
    setTimeout(doBind, 0);
    setTimeout(doBind, 50);
    setTimeout(doBind, 250);
    setTimeout(doBind, 1000);
  }

  try {
    if (game?.ready) bindWithRetries();
    Hooks.once("ready", bindWithRetries);
    Hooks.on("canvasReady", doBind);
  } catch (e) {
    warn("Binding error; deferring to ready", e);
    Hooks.once("ready", bindWithRetries);
  }
})();
