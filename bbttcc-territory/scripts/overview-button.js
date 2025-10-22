// modules/bbttcc-territory/scripts/overview-button.js
// Purpose: No injected (incorrect) Territory roll-up on Faction sheets.
// Provide: Relationships mini-card + editor (temporary), Character Enlightenment control, Floating Overview button,
//          AND restore a "Create Faction" button in the Actors tab that opens the correct custom BBTTCC faction sheet.
//          + Turn Driver (advanceTurn) late-bound here so the API is guaranteed present.

const MOD = "bbttcc-territory";
const NS  = "[bbttcc-territory]";
const log = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

/* ====================================================================================
   RELATIONSHIPS MINI-CARD (temporary, until we move into the Faction HBS)
==================================================================================== */
const REL_STATUSES = [
  { value:"allied",label:"Allied",hint:"+2 to diplomatic interactions; sharing allowed" },
  { value:"friendly",label:"Friendly",hint:"+1 to diplomatic interactions" },
  { value:"neutral",label:"Neutral",hint:"No modifiers" },
  { value:"unfriendly",label:"Unfriendly",hint:"-1 to diplomatic interactions; raids easier" },
  { value:"hostile",label:"Hostile",hint:"-2 to diplomatic interactions; escalates quickly" },
  { value:"war",label:"At War",hint:"Diplomacy suspended; military priority" }
];

function isFactionActor(a){
  if (!a) return false;
  try {
    if (a.getFlag?.("bbttcc-factions","isFaction")===true) return true;
    return String(a.system?.details?.type?.value ?? "").toLowerCase() === "faction";
  } catch { return false; }
}
function getRelationsMap(actor){
  return foundry.utils.deepClone(actor.getFlag("bbttcc-factions","relations") ?? {});
}
const labelForRel = v => (REL_STATUSES.find(s=>s.value===v)?.label) || "Neutral";
const hintForRel  = v => (REL_STATUSES.find(s=>s.value===v)?.hint)  || "—";

const REL_CARD_ID       = "bbttcc-faction-relations-mini";
const REL_CARD_LIST_ID  = "bbttcc-faction-relations-mini-list";

function relationsListHTML(actor){
  const rels = getRelationsMap(actor);
  const factions = (game.actors?.contents ?? [])
    .filter(a=>isFactionActor(a) && a.id!==actor.id)
    .sort((a,b)=>a.name.localeCompare(b.name));

  if(!factions.length) return `<p style="margin:.25rem 0 .5rem;">No other factions exist yet.</p>`;

  const rows = factions.map(fa=>{
    const st = rels[fa.id] ?? "neutral";
    return `<div class="flexrow" style="gap:.5rem; align-items:baseline;">
      <div class="flex0" style="min-width:14rem;"><strong>${foundry.utils.escapeHTML(fa.name)}</strong></div>
      <div class="flex0" style="min-width:7rem;">${foundry.utils.escapeHTML(labelForRel(st))}</div>
      <div class="flex1"><small style="opacity:.75;">${foundry.utils.escapeHTML(hintForRel(st))}</small></div>
    </div>`;
  }).join("");

  return `<div class="flexcol" id="${REL_CARD_LIST_ID}" style="gap:.25rem; margin:.5rem 0 0;">${rows}</div>`;
}

class BBTTCC_RelationshipsConfig extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id:"bbttcc-relationships-config",
    title:"Faction Relationships",
    width:560, height:"auto", resizable:true,
    classes:["bbttcc","bbttcc-relations"]
  };
  constructor(actor, options={}) {
    super(options);
    this.actor = actor;
    this._rels  = getRelationsMap(actor);
  }
  async _renderHTML(){
    const factions=(game.actors?.contents??[])
      .filter(a=>isFactionActor(a)&&a.id!==this.actor.id)
      .sort((a,b)=>a.name.localeCompare(b.name));
    const rows=factions.map(fa=>{
      const cur=this._rels[fa.id]??"neutral";
      const opts=REL_STATUSES.map(s=>`<option value="${s.value}" ${s.value===cur?"selected":""}>${s.label}</option>`).join("");
      return `<tr>
        <td title="${foundry.utils.escapeHTML(fa.name)}"><strong>${foundry.utils.escapeHTML(fa.name)}</strong></td>
        <td class="center"><select data-target="${fa.id}">${opts}</select></td>
        <td><small data-hint-for="${fa.id}" style="opacity:.75;">${foundry.utils.escapeHTML(hintForRel(cur))}</small></td>
      </tr>`;
    }).join("");

    return `<section style="padding:.5rem;">
      <p class="notes" style="opacity:.8;margin:0 0 .5rem;">
        Set how <strong>${foundry.utils.escapeHTML(this.actor.name)}</strong> relates to other factions.
      </p>
      <table class="bbttcc-table" style="width:100%;">
        <thead><tr><th>Faction</th><th style="width:9rem;">Status</th><th>Effect</th></tr></thead>
        <tbody id="rels-body">${rows || `<tr><td colspan="3"><em>No other factions exist yet.</em></td></tr>`}</tbody>
      </table>
      <footer class="flexrow" style="gap:.5rem;justify-content:flex-end;margin-top:.75rem;">
        <button type="button" data-action="cancel"><i class="fas fa-times"></i> Cancel</button>
        <button type="button" data-action="save" class="default"><i class="fas fa-save"></i> Save</button>
      </footer>
    </section>`;
  }
  async _replaceHTML(a,b){
    let element=a, html=b;
    if (typeof a==="string" && (b instanceof HTMLElement || (b && b[0]))) { element=b; html=a; }
    const root=element instanceof HTMLElement?element:(element&&element[0])?element[0]:null;
    if(!root) return;

    root.innerHTML=html;

    root.querySelectorAll("select[data-target]")?.forEach(sel=>{
      sel.addEventListener("change",()=>{
        const t=sel.getAttribute("data-target");
        const val=sel.value;
        this._rels[t]=val;
        const hint=root.querySelector(`[data-hint-for="${CSS.escape(t)}"]`);
        if(hint) hint.textContent = hintForRel(val);
      });
    });

    const save=root.querySelector('[data-action="save"]');
    save?.addEventListener("click", async ()=>{
      const btn = save;
      btn.disabled=true;
      btn.innerHTML=`<i class="fas fa-spinner fa-spin"></i> Saving…`;
      await this.actor.setFlag("bbttcc-factions","relations",this._rels);
      ui.notifications?.info?.("Relationships updated.");
      try {
        if (this.actor.sheet?.rendered) {
          const $root = $(this.actor.sheet.element);
          ensureRelationsMiniCardIn($root, this.actor);
        }
      } catch (e) { warn("post-save inline refresh failed", e); }
      this.close();
    });

    root.querySelector('[data-action="cancel"]')?.addEventListener("click",()=>this.close());
  }
}

function refreshRelationsMiniCardIn($root, actor){
  try {
    if (!$root?.length) return;
    const $card = $root.find(`#${REL_CARD_ID}`).first();
    if (!$card.length) return;
    const $list = $card.find(`#${REL_CARD_LIST_ID}`).first();
    const html = relationsListHTML(actor);
    if ($list.length) $list.replaceWith(html);
    else $card.append(html);
  } catch (e) { warn("refreshRelationsMiniCardIn failed", e); }
}
function ensureRelationsMiniCardIn($root, actor){
  if (!$root?.length) return;
  const $card = $root.find(`#${REL_CARD_ID}`).first();
  if ($card.length) refreshRelationsMiniCardIn($root, actor);
  else insertRelationsMiniCard($root, actor);
}

function insertRelationsMiniCard($root, actor){
  const body = $root.find('.bbttcc-faction-sheet .bbttcc-faction-body').first();
  const target = body.length ? body : ($root.find(".sheet-body").first().length ? $root.find(".sheet-body").first() : $root.find(".window-content").first());
  if (!target.length) return;

  target.find(`#${REL_CARD_ID}`).remove();

  const frag = $(`
  <section id="${REL_CARD_ID}" class="bbttcc card"
           style="clear:both; margin:.5rem 0; padding:.5rem; border:1px solid var(--color-border,#555); border-radius:8px;">
    <header class="flexrow" style="align-items:center; gap:.5rem;">
      <h3 class="flex1" style="margin:0;">Relationships</h3>
      <button type="button" data-action="rels"><i class="fas fa-handshake"></i> Edit</button>
    </header>
    ${relationsListHTML(actor)}
  </section>`);

  const tsLegend = target.find('fieldset > legend').filter((_,el)=>String(el.textContent||"").trim().toLowerCase()==="territory — this scene").first();
  if (tsLegend.length) $(frag).insertAfter(tsLegend.closest('fieldset'));
  else target.append(frag);

  frag.on("click",'[data-action="rels"]', ()=> new BBTTCC_RelationshipsConfig(actor).render(true, { focus:true }));
}

/* ====================================================================================
   CHARACTER ENLIGHTENMENT
==================================================================================== */
const CANON_EFFECTS = {
  sleeper:      { label:"BBTTCC: Sleeper", icon:"icons/magic/air/air-burst-spiral-blue.webp", changes:[] },
  awakened:     { label:"BBTTCC: Awakened (+1 WIS saves)", icon:"icons/magic/perception/eye-slit-glowing-yellow.webp",
                  changes:[{ key:"system.bonuses.abilities.save", mode:CONST.ACTIVE_EFFECT_MODES.ADD, value:"+1", priority:20 }] },
  adept:        { label:"BBTTCC: Adept (Divine Insight)", icon:"icons/magic/perception/eye-tendrils-web-purple.webp",
                  changes:[{ key:"flags.dnd5e.skills.rel.adv", mode:CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value:"true", priority:20 },
                           { key:"flags.dnd5e.skills.ins.adv", mode:CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value:"true", priority:20 }] },
  illuminated:  { label:"BBTTCC: Illuminated (Aura of Clarity)", icon:"icons/magic/light/explosion-star-large-orange-white.webp",
                  changes:[], extraFlags:{ "bbttcc-character-options.enlightenment.auraClarity":true, "bbttcc-character-options.enlightenment.auraRange":10 } },
  transcendent: { label:"BBTTCC: Transcendent (Miracle + OP Regen)", icon:"icons/magic/light/explosion-star-glow-blue-yellow.webp",
                  changes:[], extraFlags:{ "bbttcc-character-options.enlightenment.opRegenBonus":0.10, "bbttcc-character-options.enlightenment.minorMiracles":true } },
  qliphothic:   { label:"BBTTCC: Qliphothic", icon:"icons/magic/unholy/orb-hands-pink.webp",
                  changes:[{ key:"system.traits.dr.value", mode:CONST.ACTIVE_EFFECT_MODES.ADD, value:"necrotic", priority:20 },
                           { key:"flags.dnd5e.skills.itm.adv", mode:CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value:"true", priority:20 }],
                  extraFlags:{ "bbttcc-character-options.enlightenment.healingHalved":true } }
};
const DISPLAY_TO_CANON = {
  unawakened:"sleeper", awakening:"sleeper",
  seeking:"awakened", wisdom:"adept",
  understanding:"illuminated", enlightened:"transcendent",
  qliphothic:"qliphothic"
};
const DISPLAY_LEVELS = [
  { value:"unawakened",   label:"Unawakened" },
  { value:"awakening",    label:"Awakening" },
  { value:"seeking",      label:"Seeking" },
  { value:"wisdom",       label:"Wisdom" },
  { value:"understanding",label:"Understanding" },
  { value:"enlightened",  label:"Enlightened" },
  { value:"qliphothic",   label:"Qliphothic (Corrupted)" }
];

function findBBTTCCPanel($root){
  const explicit = $root.find('[data-bbttcc-panel="true"]').first();
  if (explicit.length) return explicit;

  const containers = $root.find('section, .card, .app, .window-content, .sheet-sidebar, .sheet-body, div, aside, article');
  let best=null, scoreBest=0;

  containers.each((_,el)=>{
    const txt = (el.textContent||"").replace(/\s+/g," ").toLowerCase();
    let score=0;
    if (/\bbbttcc\b/.test(txt)) score+=3;
    if (/\bradiation\b/.test(txt)) score+=2;
    if (/\btikkun\b/.test(txt)) score+=2;
    if (/\braid\s*xp\b/.test(txt)) score+=2;
    if (/\bsave bbttcc\b/.test(txt)) score+=3;
    if (/\brecalc\s*ops\b/.test(txt)) score+=3;
    const bbox = el.getBoundingClientRect?.() || { width:9999, height:9999 };
    if (bbox.width < 420) score+=1;
    if (score > scoreBest) { scoreBest=score; best=el; }
  });
  if (best && scoreBest>=5) return $(best);

  if ($root.find(".sheet-sidebar").first().length) return $root.find(".sheet-sidebar").first();
  return $root.find(".sheet-body").first().length ? $root.find(".sheet-body").first() : $root.find(".window-content").first();
}

function renderEnlightenmentControl($panel, actor){
  const MODCO = "bbttcc-character-options";
  const det = detectFromItems(actor);
  const currentDisp = actor.getFlag(MODCO,"enlightenment")?.display || det.display || "";
  const label = (DISPLAY_LEVELS.find(e=>e.value===currentDisp)?.label) || "—";
  const select = DISPLAY_LEVELS.map(e=>`<option value="${e.value}" ${e.value===currentDisp?"selected":""}>${e.label}</option>`).join("");

  const id = "bbttcc-enlightenment-control";
  $panel.find(`#${id}`).remove();

  let anchor = $panel.find('button, a').filter((_,el)=>/save bbttcc/i.test(el.textContent||"")).first();
  if (!anchor.length) anchor = $panel.children().first();

  const row = $(`
    <div id="${id}" style="margin:.35rem 0; padding:.35rem; border:1px solid var(--color-border,#555); border-radius:8px;">
      <div class="flexrow" style="gap:.5rem; align-items:center;">
        <label class="flex0" style="min-width:8rem;"><strong>Enlightenment</strong></label>
        <select class="flex1" data-role="bbttcc-enlightenment-select">${select}</select>
        <button type="button" class="flex0" data-action="bbttcc-enlightenment-apply"><i class="fas fa-save"></i> Apply</button>
        <small class="flex0" style="opacity:.7;">Current: ${label}</small>
      </div>
    </div>
  `);

  if (anchor.length) $(row).insertBefore(anchor); else $panel.prepend(row);

  row.on("click",'[data-action="bbttcc-enlightenment-apply"]', async ()=>{
    const val = String(row.find('[data-role="bbttcc-enlightenment-select"]').val()||"");
    await setEnlightenment(actor, val);
    actor.sheet?.render(false);
    ui.notifications?.info?.("Enlightenment updated.");
  });
}

function detectFromItems(actor){
  const items = actor.items?.contents ?? actor.items ?? [];
  const pat = /^enlightenment:\s*(.+)\b/i;
  for (const it of items) {
    const m = String(it.name||"").match(pat); if (!m) continue;
    const raw = m[1].trim().toLowerCase();
    const display = ({
      "unawakened":"unawakened","awakening":"awakening","seeking":"seeking","wisdom":"wisdom","understanding":"understanding","enlightened":"enlightened",
      "sleeper":"unawakened","awakened":"seeking","adept":"wisdom","illuminated":"understanding","transcendent":"enlightened","qliphothic":"qliphothic"
    })[raw];
    if (display) return { display, canon: DISPLAY_TO_CANON[display] };
  }
  return { display:"", canon:"" };
}
async function setEnlightenment(actor, displayValue){
  if (!actor || actor.type!=="character") return;
  const canon = DISPLAY_TO_CANON[displayValue] || "";
  const MODCO = "bbttcc-character-options";
  await actor.setFlag(MODCO, "enlightenment", { display: displayValue, level: canon });

  const owned = (actor.effects ?? []).filter(e=>e.getFlag(MODCO,"enlightenment")==="owned");
  if (owned.length) await actor.deleteEmbeddedDocuments("ActiveEffect", owned.map(e=>e.id));

  if (!canon || !CANON_EFFECTS[canon]) return;
  const spec = CANON_EFFECTS[canon];
  const data = {
    label:spec.label, icon:spec.icon, origin:`Actor.${actor.id}`, disabled:false,
    changes: spec.changes ?? [],
    flags: { [MODCO]: { enlightenment:"owned", level:canon, display:displayValue }, ...(spec.extraFlags||{}) }
  };
  await actor.createEmbeddedDocuments("ActiveEffect", [data]);
}

/* ====================================================================================
   ACTOR SHEET RENDER HOOK
==================================================================================== */
async function onRenderActorSheet(app, html){
  try {
    const actor = app?.actor;
    if (!actor) return;

    const $root = html instanceof jQuery ? html : $(html);

    if (isFactionActor(actor)) {
      insertRelationsMiniCard($root, actor);
      return;
    }

    if (actor.type === "character") {
      const $panel = findBBTTCCPanel($root);
      if ($panel?.length) renderEnlightenmentControl($panel, actor);
    }
  } catch (e) { warn("Panel render failed", e); }
}
Hooks.off("renderActorSheet", onRenderActorSheet);
Hooks.on("renderActorSheet", onRenderActorSheet);

/* ====================================================================================
   FLOATING OVERVIEW BUTTON (unchanged)
==================================================================================== */
function ensureOverviewButton() {
  const clickHandler = () => game.bbttcc?.api?.territory?.openCampaignOverview?.();
  const toolbar = document.querySelector("#bbttcc-toolbar");
  if (toolbar) {
    if (!toolbar.querySelector("#bbttcc-overview-btn")) {
      const btn = document.createElement("button");
      btn.id = "bbttcc-overview-btn";
      btn.className = "bbttcc-btn";
      btn.type = "button";
      btn.style.marginLeft = "6px";
      btn.title = "Open Campaign Overview";
      btn.innerHTML = `<i class="fas fa-globe"></i> Overview`;
      btn.addEventListener("click", clickHandler);
      toolbar.appendChild(btn);
    }
    return;
  }
  if (!document.querySelector("#bbttcc-overview-fallback")) {
    const div = document.createElement("div");
    div.id = "bbttcc-overview-fallback";
    div.style.position = "fixed";
    div.style.left = "12px";
    div.style.top = "90px";
    div.style.zIndex = 100;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bbttcc-btn";
    btn.textContent = "Overview";
    btn.addEventListener("click", clickHandler);
    div.appendChild(btn);
    document.body.appendChild(div);
  }
}
Hooks.on("canvasReady", ensureOverviewButton);
Hooks.on("renderSceneControls", ensureOverviewButton);
Hooks.once("ready", () => { log("Overview button + Relationships + Enlightenment + Create Faction ready."); ensureOverviewButton(); });

/* ====================================================================================
   🔧 RESTORE "CREATE FACTION" BUTTON (Actors directory) — forces the BBTTCC sheet
==================================================================================== */
const FACTION_SHEET_CLASS = "bbttcc-factions.BBTTCCFactionSheet"; // matches overview app check

function resolveFactionActorType(){
  try {
    const types = (CONFIG?.Actor?.typeLabels && Object.keys(CONFIG.Actor.typeLabels))
               || (game.system?.model?.Actor && Object.keys(game.system.model.Actor))
               || [];
    if (types.includes("faction")) return "faction";
    // Fallback: npc (DnD5e safe); sheet will be forced via core flag
    return "npc";
  } catch { return "npc"; }
}

async function createFactionViaBBTTCC(){
  const content = `
    <div class="form-group">
      <label>Faction Name</label>
      <input type="text" name="name" value="New Faction" autofocus style="width:100%;" />
      <p class="notes" style="opacity:.8;margin-top:.35rem;">Creates a new Actor flagged as a BBTTCC Faction and opens the BBTTCC Faction Sheet.</p>
    </div>
  `;
  return new Promise((resolve)=>{
    new Dialog({
      title:"Create Faction",
      content,
      buttons:{
        cancel:{ icon:'<i class="fas fa-times"></i>', label:'Cancel', callback:()=>resolve(null) },
        create:{ icon:'<i class="fas fa-flag"></i>',  label:'Create', callback: async (html)=>{
          const name = String(html.find('input[name="name"]').val()||"New Faction").trim();
          const type = resolveFactionActorType();
          try {
            const actor = await Actor.create({
              name, type,
              img: "icons/commodities/treasure/crown-gold-jewels.webp",
              system: { details: { type: { value: "faction" } } }, // DnD5e hint; ignored elsewhere
              flags: {
                "bbttcc-factions": { isFaction: true },
                core: { sheetClass: FACTION_SHEET_CLASS } // ⬅️ force the correct sheet class
              }
            });
            ui.notifications?.info?.(`Faction "${name}" created.`);
            await actor?.sheet?.render(true);
            resolve(actor);
          } catch (e) {
            warn("Failed to create Faction", e);
            ui.notifications?.error?.("Failed to create Faction. See console for details.");
            resolve(null);
          }
        }}
      },
      default:"create",
      close: ()=>resolve(null)
    }).render(true, { focus:true });
  });
}

function insertCreateFactionButton(html){
  try {
    const $html = html instanceof jQuery ? html : $(html);
    const header = $html.find(".directory-header .header-actions, .directory-header .action-buttons, .directory-header").first();
    if (!header.length) return;
    if (header.find("#bbttcc-create-faction").length) return;

    const $btn = $(`
      <button id="bbttcc-create-faction" type="button" class="header-control" title="Create BBTTCC Faction">
        <i class="fas fa-flag"></i> Create Faction
      </button>
    `);
    header.append($btn);
    $btn.on("click", ()=>createFactionViaBBTTCC());
  } catch (e) {
    warn("Failed to insert Create Faction button", e);
  }
}
Hooks.on("renderActorDirectory", (app, html)=>insertCreateFactionButton(html));
Hooks.on("renderSidebarTab", (app, html)=>{ if (app?.id==="actors") insertCreateFactionButton(html); });

/* ====================================================================================
   ✅ TURN DRIVER — late-bound here so it always lands even if API was overwritten earlier
==================================================================================== */
(() => {
  const MOD_TERR = "bbttcc-territory";
  const MOD_FACTIONS = "bbttcc-factions";
  const NS_TURN = "[bbttcc-turn]";
  const logT  = (...a) => console.log(NS_TURN, ...a);
  const warnT = (...a) => console.warn(NS_TURN, ...a);

  // --- Tables & helpers (mirrors Campaign Overview math) ---
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
    { key: "Emerging", min: 0,   max: 99 },
    { key: "Growing",  min: 100, max: 199 },
    { key: "Established", min: 200, max: 299 },
    { key: "Powerful", min: 300, max: 399 },
    { key: "Dominant", min: 400, max: Infinity }
  ];
  const bandFor = (t) => (STATUS_BANDS.find(b => t>=b.min && t<=b.max)?.key) || "Emerging";

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

  function isFactionActor2(a){
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

    const factions = (game.actors?.contents??[]).filter(isFactionActor2);
    if (!factions.length) return ui.notifications?.warn?.("No Faction actors found.");

    // Scan hexes across all scenes
    const all = [];
    for (const sc of game.scenes?.contents??[]){
      for (const dr of sc.drawings?.contents??[]){
        if (!isHexDrawing(dr)) continue;
        all.push({ sc, dr, f: dr.flags?.[MOD_TERR] ?? {} });
      }
    }

    // Aggregate per faction
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
              <td>${game.i18n?.localize?.(`BBTTCC.PowerLevels.${r.band}`) || r.band} <small style="opacity:.65;">(${r.total})</small></td>
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

  function bindTurnDriver() {
    game.bbttcc ??= { api:{} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= {};
    game.bbttcc.api.territory.advanceTurn = advanceTurn;
    // Fallback alias
    globalThis.BBTTCC_advanceTurn = advanceTurn;
    logT("advanceTurn bound late via overview-button.js");
  }

  if (game?.ready) bindTurnDriver();
  Hooks.once("ready", bindTurnDriver);
  Hooks.on("canvasReady", bindTurnDriver); // re-bind if something replaced the object
})();
