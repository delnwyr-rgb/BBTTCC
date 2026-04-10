// modules/bbttcc-territory/scripts/overview-button.js
// Relationships mini-card + editor, Character Enlightenment control,
// floating Overview button, and "Create Faction" button.
// NOTE: No advanceTurn fallback here — the Turn Driver owns turn execution.

const MOD = "bbttcc-territory";
const NS  = "[bbttcc-territory]";
const log = (...a) => console.log(NS, ...a);
const warn = (...a) => console.warn(NS, ...a);



/* ====================================================================================
   TERRITORY HEX DEFAULTS (Playtest Alpha Safety Net)
   Goal: New hexes should start as pristine wilderness:
     - status: unclaimed
     - type: wilderness
     - population: uninhabited  (this is your true “x0 / empty” signal)
     - resources: all 0         (ensures 0 yield until developed)
   NOTE: Some Create Hex flows stamp settlement/town/medium before the editor opens.
         We enforce defaults in TWO places:
           1) preCreateDrawing (mutate incoming data when possible)
           2) createDrawing (post-create correction if the create flow overwrote values)
==================================================================================== */

function _bbttccIsLikelyHexDrawingData(data){
  try {
    const f = foundry.utils.getProperty(data, `flags.${MOD}`) || {};
    if (f.isHex === true || String(f.kind||"").toLowerCase() === "territory-hex") return true;

    // heuristic: polygon 6-gon (12 numbers) used by our hex drawings
    const ptsLen = data?.shape?.points?.length ?? 0;
    const isPoly6 = data?.shape?.type === "p" && ptsLen === 12;
    if (!isPoly6) return false;

    const label = String(data?.text ?? data?.label ?? "").trim();
    return label === "Hex" || label.startsWith("Hex ");
  } catch { return false; }
}

function _bbttccIsLikelyHexDrawingDoc(doc){
  try {
    const f = doc?.flags?.[MOD] ?? {};
    if (f.isHex === true || String(f.kind||"").toLowerCase() === "territory-hex") return true;

    const ptsLen = doc?.shape?.points?.length ?? 0;
    const isPoly6 = doc?.shape?.type === "p" && ptsLen === 12;
    if (!isPoly6) return false;

    const label = String(doc?.text ?? "").trim();
    return label === "Hex" || label.startsWith("Hex ");
  } catch { return false; }
}

function _bbttccApplyPristineWildernessDefaultsToData(data){
  try {
    if (!_bbttccIsLikelyHexDrawingData(data)) return;

    const f = foundry.utils.getProperty(data, `flags.${MOD}`) || {};

    // Ensure recognition
    if (f.isHex !== true) foundry.utils.setProperty(data, `flags.${MOD}.isHex`, true);
    if (!f.kind)          foundry.utils.setProperty(data, `flags.${MOD}.kind`, "territory-hex");

    // Enforce pristine defaults (only if missing or legacy-stamped)
    const curType = f.type;
    const curSize = f.size;
    const curPop  = f.population;

    if (curType == null || curType === "settlement") foundry.utils.setProperty(data, `flags.${MOD}.type`, "wilderness");
    if (curSize == null || curSize === "town")       foundry.utils.setProperty(data, `flags.${MOD}.size`, "outpost");
    if (curPop  == null || curPop  === "medium")     foundry.utils.setProperty(data, `flags.${MOD}.population`, "uninhabited");

    if (f.status == null)  foundry.utils.setProperty(data, `flags.${MOD}.status`, "unclaimed");
    if (f.capital == null) foundry.utils.setProperty(data, `flags.${MOD}.capital`, false);

    // Important: ensure pristine wilderness yields 0 until developed.
    if (f.resources == null) {
      foundry.utils.setProperty(data, `flags.${MOD}.resources`, { food:0, materials:0, trade:0, military:0, knowledge:0 });
    }

    if (f.createdAt == null) foundry.utils.setProperty(data, `flags.${MOD}.createdAt`, Date.now());
    if (!f.name)             foundry.utils.setProperty(data, `flags.${MOD}.name`, String(data?.text ?? "Hex") || "Hex");
  } catch (e) {
    warn("Hex defaulting (data) failed", e);
  }
}

async function _bbttccApplyPristineWildernessDefaultsToDoc(doc){
  try {
    if (!_bbttccIsLikelyHexDrawingDoc(doc)) return;

    const f = doc.flags?.[MOD] ?? {};
    const updates = {};

    if (f.isHex !== true) updates[`flags.${MOD}.isHex`] = true;
    if (!f.kind)          updates[`flags.${MOD}.kind`]  = "territory-hex";

    if (f.type == null || f.type === "settlement") updates[`flags.${MOD}.type`] = "wilderness";
    if (f.size == null || f.size === "town")       updates[`flags.${MOD}.size`] = "outpost";
    if (f.population == null || f.population === "medium") updates[`flags.${MOD}.population`] = "uninhabited";

    if (f.status == null)  updates[`flags.${MOD}.status`]  = "unclaimed";
    if (f.capital == null) updates[`flags.${MOD}.capital`] = false;

    if (f.resources == null) updates[`flags.${MOD}.resources`] = { food:0, materials:0, trade:0, military:0, knowledge:0 };
    if (f.createdAt == null) updates[`flags.${MOD}.createdAt`] = Date.now();
    if (!f.name)             updates[`flags.${MOD}.name`] = String(doc.text ?? "Hex") || "Hex";

    if (!Object.keys(updates).length) return;
    await doc.update(updates, { diff: true, render: false });
  } catch (e) {
    warn("Hex defaulting (doc) failed", e);
  }
}

// 1) preCreate (mutate incoming data when possible)
Hooks.off?.("preCreateDrawing", _bbttccApplyPristineWildernessDefaultsToData);
Hooks.on?.("preCreateDrawing", (doc, data) => {
  if (!game.user?.isGM) return;
  _bbttccApplyPristineWildernessDefaultsToData(data);
});

// 2) post-create correction (covers Create Hex flows that stamp settlement/town/medium)
Hooks.off?.("createDrawing", _bbttccApplyPristineWildernessDefaultsToDoc);
Hooks.on?.("createDrawing", async (doc) => {
  if (!game.user?.isGM) return;
  await _bbttccApplyPristineWildernessDefaultsToDoc(doc);
});
/* ====================================================================================
   RELATIONSHIPS CARD + EDITOR (wired into Faction HBS Relationships tab)
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

function findRelationshipsHost($root){
  try {
    if (!$root?.length) return $();
    const $tab = $root.find('.bbttcc-tab[data-tab="relationships"], .bbttcc-tab-relationships').first();
    if ($tab.length) {
      const $placeholder = $tab.find('.bbttcc-relationships-placeholder, .bbttcc-card-relationships-placeholder').first();
      if ($placeholder.length) return $placeholder;
      const $legendMatch = $tab.find('fieldset > legend').filter((_,el)=>{
        const txt = String(el.textContent || "").trim().toLowerCase();
        return txt === "hex relationships" || txt === "relationships";
      }).first();
      if ($legendMatch.length) return $legendMatch.closest('fieldset');
      return $tab;
    }
    return $();
  } catch (e) {
    warn("findRelationshipsHost failed", e);
    return $();
  }
}

function renderRelationsCardHTML(actor){
  return `
    <div class="flexrow" style="justify-content:space-between; align-items:center; gap:.75rem; flex-wrap:wrap;">
      <div class="bbttcc-muted">
        Relationship editing lives here for faction-to-faction standings and future hex/social links.
      </div>
      <button type="button" class="button" data-action="rels">
        <i class="fas fa-link"></i> Edit
      </button>
    </div>
    ${relationsListHTML(actor)}
  `;
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
        <td class="center bbttcc-rel-status"><select data-target="${fa.id}">${opts}</select></td>
        <td><small data-hint-for="${fa.id}" style="opacity:.75;">${foundry.utils.escapeHTML(hintForRel(cur))}</small></td>
      </tr>`;
    }).join("");

    return `<section class="bbttcc-relations-shell" style="padding:.75rem;">
      <style>
        .bbttcc-relations .window-content {
          background: radial-gradient(circle at top left, rgba(59,130,246,0.25), transparent 55%),
                      radial-gradient(circle at bottom right, rgba(14,165,233,0.25), transparent 55%),
                      #020617;
          padding: 0.75rem;
        }
        .bbttcc-relations .bbttcc-rel-card {
          background:
            radial-gradient(circle at top left, rgba(59,130,246,0.20), transparent 60%),
            radial-gradient(circle at bottom right, rgba(34,197,94,0.16), transparent 60%),
            rgba(15,23,42,0.96);
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,0.7);
          box-shadow:
            0 0 0 1px rgba(15,23,42,0.9),
            0 18px 40px rgba(15,23,42,0.95);
          padding: 0.75rem 0.9rem 0.85rem;
          color: #e5e7eb;
        }
        .bbttcc-relations .bbttcc-rel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }
        .bbttcc-relations .bbttcc-rel-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #e5e7eb;
        }
        .bbttcc-relations .bbttcc-rel-subtitle {
          margin: 0.15rem 0 0;
          font-size: 0.8rem;
          opacity: 0.85;
        }
        .bbttcc-relations .bbttcc-rel-subtitle strong {
          color: #38bdf8;
        }
        .bbttcc-relations .bbttcc-rel-table-wrapper {
          margin-top: 0.5rem;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(51,65,85,0.9);
          background: rgba(15,23,42,0.9);
        }
        .bbttcc-relations .bbttcc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .bbttcc-relations .bbttcc-table thead {
          background: linear-gradient(to right, #020617, #020617, #0b1120);
          color: #c7d2fe;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 0.7rem;
        }
        .bbttcc-relations .bbttcc-table th,
        .bbttcc-relations .bbttcc-table td {
          padding: 0.4rem 0.55rem;
          border-bottom: 1px solid rgba(30,64,175,0.35);
        }
        .bbttcc-relations .bbttcc-table th {
          font-weight: 600;
        }
        .bbttcc-relations .bbttcc-table tbody tr:nth-child(odd) {
          background: rgba(15,23,42,0.98);
        }
        .bbttcc-relations .bbttcc-table tbody tr:nth-child(even) {
          background: rgba(15,23,42,0.88);
        }
        .bbttcc-relations .bbttcc-table tbody tr:hover {
          background: rgba(37,99,235,0.25);
        }
        .bbttcc-relations .bbttcc-rel-status {
          min-width: 8rem;
        }
        .bbttcc-relations select[data-target] {
          width: 100%;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.7);
          background: rgba(15,23,42,0.95);
          color: #e5e7eb;
          padding: 0.15rem 0.6rem;
          font-size: 0.8rem;
          appearance: none;
        }
        .bbttcc-relations select[data-target]:focus {
          outline: none;
          border-color: #38bdf8;
          box-shadow: 0 0 0 1px rgba(56,189,248,0.7);
          background: rgba(15,23,42,1);
        }
        .bbttcc-relations small[data-hint-for] {
          font-size: 0.75rem;
        }
        .bbttcc-relations footer.bbttcc-rel-footer {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.75rem;
        }
        .bbttcc-relations footer.bbttcc-rel-footer button {
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,0.65);
          background: rgba(15,23,42,0.98);
          color: #e5e7eb;
          padding: 0.3rem 0.8rem;
          font-size: 0.8rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          cursor: pointer;
        }
        .bbttcc-relations footer.bbttcc-rel-footer button.default {
          border-color: #38bdf8;
          background: linear-gradient(135deg, #0ea5e9, #22c55e);
          color: #020617;
          font-weight: 600;
        }
        .bbttcc-relations footer.bbttcc-rel-footer button.default:disabled {
          opacity: 0.7;
          cursor: default;
        }
      </style>

      <div class="bbttcc-rel-card">
        <header class="bbttcc-rel-header">
          <div>
            <h2 class="bbttcc-rel-title">Faction Relationships</h2>
            <p class="bbttcc-rel-subtitle">
              Set how <strong>${foundry.utils.escapeHTML(this.actor.name)}</strong> relates to other factions. These
              standings inform diplomacy, AI posture, and encounter framing.
            </p>
          </div>
        </header>

        <div class="bbttcc-rel-table-wrapper">
          <table class="bbttcc-table">
            <thead>
              <tr>
                <th>Faction</th>
                <th style="width:9rem;">Status</th>
                <th>Effect</th>
              </tr>
            </thead>
            <tbody id="rels-body">
              ${rows || `<tr><td colspan="3"><em>No other factions exist yet.</em></td></tr>`}
            </tbody>
          </table>
        </div>

        <footer class="bbttcc-rel-footer">
          <button type="button" data-action="cancel">
            <i class="fas fa-times"></i>
            <span>Cancel</span>
          </button>
          <button type="button" data-action="save" class="default">
            <i class="fas fa-save"></i>
            <span>Save</span>
          </button>
        </footer>
      </div>
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
    const $host = findRelationshipsHost($root);
    if (!$host.length) return;
    const $list = $host.find(`#${REL_CARD_LIST_ID}`).first();
    const html = relationsListHTML(actor);
    if ($list.length) $list.replaceWith(html);
    else $host.append(html);
  } catch (e) { warn("refreshRelationsMiniCardIn failed", e); }
}
function ensureRelationsMiniCardIn($root, actor){
  try {
    if (!$root?.length) return;
    // Remove any legacy injected mini-card from older sheet layouts.
    $root.find(`#${REL_CARD_ID}`).remove();

    const $host = findRelationshipsHost($root);
    if (!$host.length) return;

    // Replace placeholder body with the real relationship card content.
    const hasBoundCard = $host.attr("data-bbttcc-relations-bound") === "true";
    if (!hasBoundCard) {
      const $legacyButton = $host.find('button[disabled], button[data-action="rels"]').first();
      const $contentTarget = $legacyButton.length ? $legacyButton.closest('.flexrow') : $();
      if ($contentTarget.length) {
        $contentTarget.after(relationsListHTML(actor));
        $contentTarget.find('button').removeAttr('disabled').attr('data-action','rels');
      } else {
        $host.append(renderRelationsCardHTML(actor));
      }
      $host.attr("data-bbttcc-relations-bound", "true");
    } else {
      refreshRelationsMiniCardIn($root, actor);
    }

    $host.off("click.bbttccrels").on("click.bbttccrels", '[data-action="rels"]', ()=>{
      new BBTTCC_RelationshipsConfig(actor).render(true, { focus:true });
    });
  } catch (e) { warn("ensureRelationsMiniCardIn failed", e); }
}

function insertRelationsMiniCard($root, actor){
  // Legacy name retained for compatibility; relationships now render inside the Relationships tab.
  ensureRelationsMiniCardIn($root, actor);
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
      ensureRelationsMiniCardIn($root, actor);
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


function openMarketSafe() {
  try {
    if (game.bbttcc?.api?.market?.openMarket) {
      return game.bbttcc.api.market.openMarket();
    }
    ui.notifications?.warn?.("BBTTCC Market not available.");
    return null;
  } catch (e) {
    console.error(NS, "openMarketSafe failed", e);
    ui.notifications?.error?.("Could not open Market — see console.");
    return null;
  }
}


/* ====================================================================================
   MARKET BUTTON (Toolbar-only; no floating fallback)
   - Ensures Market is present in the BBTTCC toolbar cluster
   - Never creates fixed-position buttons that can block Scene Controls
==================================================================================== */
function ensureMarketButton() {
  try {
    const toolbar = document.querySelector("#bbttcc-toolbar");
    if (!toolbar) return;

    // Avoid duplicates
    if (toolbar.querySelector("#bbttcc-market-btn")) return;

    const row =
      toolbar.querySelector(".bbttcc-toolbar-main") ||
      toolbar.querySelector(".row") ||
      toolbar;

    const btn = document.createElement("button");
    btn.id = "bbttcc-market-btn";
    btn.className = "bbttcc-btn";
    btn.type = "button";
    btn.title = "Open Market";
    btn.innerHTML = `<i class="fas fa-store"></i><span>Market</span>`;
    btn.addEventListener("click", (ev) => {
      try { ev?.preventDefault?.(); ev?.stopPropagation?.(); } catch {}
      return openMarketSafe();
    });

    row.appendChild(btn);
  } catch (e) {
    console.warn(NS, "ensureMarketButton failed", e);
  }
}


/* ====================================================================================
   CONTROL PANEL BUTTON CLEANUP (No Floating Buttons + De-Dupe)
   - Removes legacy floating Overview/Market buttons that can block tile controls
   - De-dupes duplicate Overview/Raid/etc inside the BBTTCC Control Panel cluster
   Safe: DOM-only; no API behavior changes.
==================================================================================== */

function _bbttccRemoveFloatingButtons(){
  try {
    // Our legacy fallback container(s)
    document.querySelector("#bbttcc-overview-fallback")?.remove();
    document.querySelector("#bbttcc-campaign-fallback")?.remove();

    // Any other stray BBTTCC fixed-position button shells (defensive)
    const stray = Array.from(document.querySelectorAll("body > div, body > section"))
      .filter(el => {
        const id = String(el.id || "");
        if (id.startsWith("bbttcc-overview") || id.startsWith("bbttcc-market") || id.startsWith("bbttcc-campaign")) return true;
        return false;
      });
    for (const el of stray) el.remove?.();

    // Also remove direct stray buttons near scene controls if present
    const controls = document.querySelector("#controls");
    if (controls) {
      const btns = Array.from(controls.querySelectorAll("button"))
        .filter(b => {
          const t = (b.textContent || "").trim().toLowerCase();
          return t === "overview" || t === "market" || t === "campaigns" || t === "campaign";
        });

      for (const b of btns) {
        const t = (b.textContent || "").trim().toLowerCase();
        const cls = String(b.className || "");
        const id  = String(b.id || "");
        const li  = b.closest("li") || null;
        const lic = li ? String(li.className || "") : "";
        const lid = li ? String(li.id || "") : "";

        // Only remove if it looks BBTTCC-owned:
        // - explicit bbttcc class/id
        // - OR it is a "Campaigns" button (we do not want *any* floating Campaigns chip in the scene controls rail)
        const bbttccish =
          cls.includes("bbttcc") || cls.includes("bbttcc-btn") ||
          id.includes("bbttcc") ||
          lic.includes("bbttcc") || lid.includes("bbttcc") ||
          (t === "campaigns" || t === "campaign");

        if (!bbttccish) continue;

        // remove the whole control (li) if possible; else just the button
        if (li) li.remove();
        else b.remove();
      }
    }
  } catch (e) {
    console.warn(NS, "floating button cleanup failed", e);
  }
}

function _bbttccDedupControlPanelButtons(){
  try {
    // We try a few likely roots. If none exist, bail quietly.
    const roots = [
      document.querySelector("#bbttcc-control-panel"),
      document.querySelector(".bbttcc-control-panel"),
      document.querySelector("#bbttcc-toolbar"),
      document.querySelector(".bbttcc-toolbar")
    ].filter(Boolean);

    for (const root of roots) {
      const seen = new Set();
      const buttons = Array.from(root.querySelectorAll("button, a.btn, a[data-act]"));

      for (const btn of buttons) {
        const act = (btn.dataset?.action || btn.getAttribute("data-action") || btn.dataset?.act || btn.getAttribute("data-act") || "").trim().toLowerCase();
        const txt = (btn.textContent || "").trim().toLowerCase();
        const key = act || txt;
        if (!key) continue;

        // Only de-dupe the known offenders / cluster buttons
        const isCandidate =
          key === "overview" || key === "market" || key === "raid" ||
          key === "bosses" || key === "plan" || key === "campaign" || key === "campaigns" ||
          key === "travel" || key === "turn" || key === "turn_driver" || key === "turn driver" ||
          txt === "overview" || txt === "market" || txt === "raid" ||
          txt === "bosses" || txt === "plan" || txt === "campaign" || txt === "campaigns" ||
          txt === "travel" || txt === "travel console" || txt === "turn driver";

        if (!isCandidate) continue;

        if (seen.has(key)) {
          btn.remove();
          continue;
        }
        seen.add(key);
      }
    }
  } catch (e) {
    console.warn(NS, "control panel de-dupe failed", e);
  }
}


// ---------------------------------------------------------------------------
// PLAYER LOCKDOWN (Alpha Safety)
// Goal: Players should not see global BBTTCC control clusters.
// They will open Planner/Raid/Market from their own Faction Sheet instead.
// ---------------------------------------------------------------------------
function _bbttccApplyPlayerLockdown(){
  try {
    if (game.user?.isGM) return;
    const roots = [
      document.querySelector("#bbttcc-toolbar"),
      document.querySelector(".bbttcc-toolbar"),
      document.querySelector("#bbttcc-control-panel"),
      document.querySelector(".bbttcc-control-panel")
    ].filter(Boolean);

    for (const r of roots) {
      // Hide the entire cluster for players
      r.style.display = "none";
    }

    // Also block Territory Dashboard opener if a player somehow calls it.
    try {
      const old = globalThis.BBTTCC_OpenTerritoryDashboard;
      globalThis.BBTTCC_OpenTerritoryDashboard = function(){
        ui.notifications?.warn?.("Territory tools are GM-only right now.");
        return null;
      };
      // Keep reference for GM debugging (not exposed in UI)
      globalThis.__BBTTCC_OpenTerritoryDashboard_GM = old;
    } catch(_e) {}
  } catch (e) {
    console.warn(NS, "player lockdown failed", e);
  }
}

function _bbttccControlPanelCleanupTick(){
  _bbttccApplyPlayerLockdown();
  if (!game.user?.isGM) return;
  ensureMarketButton();
  _bbttccRemoveFloatingButtons();
  // De-dupe immediately + again after layout settles (some panels render async)
  _bbttccDedupControlPanelButtons();
  setTimeout(_bbttccDedupControlPanelButtons, 250);
  setTimeout(_bbttccDedupControlPanelButtons, 750);
}

// Run on key lifecycle events
Hooks.on("canvasReady", _bbttccControlPanelCleanupTick);
Hooks.on("renderSceneControls", _bbttccControlPanelCleanupTick);
Hooks.once("ready", () => {
  log("Overview button cleanup + Relationships + Enlightenment + Create Faction ready.");
  _bbttccControlPanelCleanupTick();
});

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

function normalizeFactionRigsFlag(factionFlags){
  try {
    // Rigs are faction-owned (not Items). We store passive bonuses on each rig object.
    const rigs = Array.isArray(factionFlags?.rigs) ? factionFlags.rigs : [];
    for (const r of rigs) {
      if (!r || typeof r !== "object") continue;
      r.passives ??= {};
      r.passives.travel ??= {};
    }
    factionFlags.rigs = rigs;
    // Canonical active rig pointer (used by travel)
    if (!factionFlags.activeRigId) factionFlags.activeRigId = rigs[0]?.rigId || "";
    return factionFlags;
  } catch (e) {
    warn("normalizeFactionRigsFlag failed", e);
    return factionFlags ?? {};
  }
}

async function createFactionViaBBTTCC(){
  if (!game.user?.isGM) { ui.notifications?.warn?.('Only the GM can create factions.'); return null; }
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
              flags: { "bbttcc-factions": normalizeFactionRigsFlag({ isFaction: true, rigs: [], activeRigId: "" }), core: { sheetClass: FACTION_SHEET_CLASS } }
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
    // Player lockdown: only GMs can create factions.
    if (!game.user?.isGM) return;
    const $html = html instanceof jQuery ? html : $(html);
    const header = $html.find(".directory-header .header-actions, .directory-header .action-buttons, .directory-header").first();
    if (!header.length || header.find("#bbttcc-create-faction").length) return;
    const $btn = $(`<button id="bbttcc-create-faction" type="button" class="header-control" title="Create BBTTCC Faction"><i class="fas fa-flag"></i> Create Faction</button>`);
    header.append($btn); $btn.on("click", async (ev) => {
      try {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
      } catch {}
      const openWizard = game.bbttcc?.api?.factions?.openCreationWizard;
      if (typeof openWizard === "function") {
        return openWizard();
      }
      // Fallback to legacy V1 dialog if the new wizard is not available.
      return createFactionViaBBTTCC();
    });
} catch (e) { warn("Failed to insert Create Faction button", e); }
}
Hooks.on("renderActorDirectory", (app, html)=>insertCreateFactionButton(html));
Hooks.on("renderSidebarTab", (app, html)=>{ if (app?.id==="actors") insertCreateFactionButton(html); });


/* ====================================================================================
   TERRITORY DASHBOARD OPENER (AppV2-safe)
   - Fixes "Dashboard button stops working after closing Hex Sheet / other AppV2 windows"
   - Ensures we always have a live instance and uses AppV2 render options object
==================================================================================== */
function _bbttccCleanupLegacyTerritoryDashboardSingleton() {
  try {
    // Known legacy singleton instance reference
    if (Object.getOwnPropertyDescriptor(globalThis, "__bbttcc_dashboard")) {
      delete globalThis.__bbttcc_dashboard;
    }

    // Common “opening/lock” sentinels that can wedge the dashboard button
    const suspects = [
      "__bbttcc_dashboard_opening",
      "__bbttcc_dashboardOpening",
      "__bbttcc_dashboard_lock",
      "__bbttcc_dashboardLock",
      "__bbttcc_openTerritoryDashboard",
      "__bbttcc_openTerritoryDashboardLock"
    ];

    for (const k of suspects) {
      if (Object.getOwnPropertyDescriptor(globalThis, k)) delete globalThis[k];
    }
  } catch (e) {
    console.warn(NS, "legacy dashboard singleton cleanup failed", e);
  }
}

function bbttccOpenTerritoryDashboardSafe() {
  try {
    _bbttccCleanupLegacyTerritoryDashboardSingleton();
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.apps = game.bbttcc.apps || {};

    const Ctor = globalThis.BBTTCC_TerritoryDashboardCtor;
    if (typeof Ctor !== "function") {
      ui.notifications?.warn?.("BBTTCC Territory Dashboard not available (ctor missing).");
      return null;
    }

    let inst = game.bbttcc.apps.territoryDashboard;

    // AppV2: closed apps commonly report _state===0; also guard missing render method
    // and detect “zombie” instances whose element is detached.
    const dead =
      !inst ||
      typeof inst.render !== "function" ||
      inst._state === 0 ||
      (inst.element && inst.element[0] && !inst.element[0].isConnected);
    if (dead) {
      inst = new Ctor();
      game.bbttcc.apps.territoryDashboard = inst;
    }

    // AppV2 render signature: options object (not render(true,{focus:true}))
    inst.render({ force: true, focus: true });
    return inst;
  } catch (e) {
    console.error(NS, "bbttccOpenTerritoryDashboardSafe failed", e);
    ui.notifications?.error?.("Could not open Territory Dashboard — see console.");
    try { delete game.bbttcc?.apps?.territoryDashboard; } catch {}
    return null;
  }
}

// Prefer to override any earlier opener (including ones from dashboard-app.js) with the safe one.
Hooks.once("ready", () => {
  try {
    globalThis.BBTTCC_OpenTerritoryDashboard = bbttccOpenTerritoryDashboardSafe;
  } catch (e) {
    console.warn(NS, "Failed to install BBTTCC_OpenTerritoryDashboard override", e);
  }
});

