// modules/bbttcc-territory/scripts/overview-button.js
// Relationships mini-card + editor, Character Enlightenment control,
// floating Overview button, and "Create Faction" button.
// NOTE: No advanceTurn fallback here — the Turn Driver owns turn execution.

const MOD = "bbttcc-territory";
const NS  = "[bbttcc-territory]";
const log = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);

/* ====================================================================================
   RELATIONSHIPS MINI-CARD (temporary, until moved to Faction HBS)
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
    const t=(foundry.utils.getProperty(a,"system.details.type.value")||"").toString().toLowerCase();
    if (t==="faction") return true;
    const cls=a.getFlag?.("core","sheetClass") ?? a?.flags?.core?.sheetClass;
    return String(cls||"").includes("BBTTCCFactionSheet");
  }catch{return false;}
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
   CHARACTER ENLIGHTENMENT (lightweight control for character sheets)
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
   FLOATING OVERVIEW BUTTON
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

/* "Create Faction" button (Actors directory) — forces the BBTTCC sheet */
const FACTION_SHEET_CLASS = "bbttcc-factions.BBTTCCFactionSheet";
function resolveFactionActorType(){
  try {
    const types = (CONFIG?.Actor?.typeLabels && Object.keys(CONFIG.Actor.typeLabels))
               || (game.system?.model?.Actor && Object.keys(game.system.model.Actor))
               || [];
    return types.includes("faction") ? "faction" : "npc";
  } catch { return "npc"; }
}
async function createFactionViaBBTTCC(){
  const content = `
    <div class="form-group">
      <label>Faction Name</label>
      <input type="text" name="name" value="New Faction" autofocus style="width:100%;" />
      <p class="notes" style="opacity:.8;margin-top:.35rem;">Creates a new Actor flagged as a BBTTCC Faction and opens the BBTTCC Faction Sheet.</p>
    </div>`;
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
              system: { details: { type: { value: "faction" } } },
              flags: { "bbttcc-factions": { isFaction: true }, core: { sheetClass: FACTION_SHEET_CLASS } }
            });
            ui.notifications?.info?.(`Faction "${name}" created.`);
            await actor?.sheet?.render(true);
            resolve(actor);
          } catch (e) { warn("Failed to create Faction", e); ui.notifications?.error?.("Failed to create Faction."); resolve(null); }
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
    if (!header.length || header.find("#bbttcc-create-faction").length) return;
    const $btn = $(`<button id="bbttcc-create-faction" type="button" class="header-control" title="Create BBTTCC Faction"><i class="fas fa-flag"></i> Create Faction</button>`);
    header.append($btn); $btn.on("click", ()=>createFactionViaBBTTCC());
  } catch (e) { warn("Failed to insert Create Faction button", e); }
}
Hooks.on("renderActorDirectory", (app, html)=>insertCreateFactionButton(html));
Hooks.on("renderSidebarTab", (app, html)=>{ if (app?.id==="actors") insertCreateFactionButton(html); });
