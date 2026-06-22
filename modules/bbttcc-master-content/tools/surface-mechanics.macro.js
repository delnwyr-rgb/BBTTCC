/**
 * surface-mechanics.macro.js  —  BBTTCC / fourththing (RFI)
 * ---------------------------------------------------------------------------
 * Surfaces each item's MECHANICAL EFFECTS into its player-facing description so
 * players can read what a thing does (damage, range, cost, duration, the rules
 * hook) WITHOUT having to use it. Scope per owner: consumables + items +
 * manifestations only. dnd5e build is handled separately ("later").
 *
 * WHAT IT DOES
 *   • fourththing-custom items/manifestations (damage.formula / manifestation /
 *     power shape): renders a clean "⚙️ Mechanical Effects" block from the
 *     STRUCTURED data into system.description.value. These mostly had EMPTY
 *     descriptions — this is the real win.
 *   • dnd5e-style / prose items: NOT auto-authored. If the prose already states
 *     magnitudes it is left alone; if not, it is added to the GAP REPORT for you
 *     to author by hand (no invented numbers).
 *
 * IDEMPOTENT  — the generated block is wrapped in HTML-comment markers and
 *               stripped+rebuilt on every run, so re-running updates (never
 *               duplicates) and is safe.
 *
 * SAFE BY DEFAULT — CONFIG.DRY_RUN = true: first run only reports + writes the
 *               gap Journal Entry; it changes NO descriptions. Flip to false to
 *               apply. Run on BOTH worlds (ember + foundry); live is the truth.
 *
 * HOW TO RUN — paste into a GM script macro in-world and execute. Read the
 *               console summary + the "⚙️ Mechanical Effects — Report" journal.
 */
(async () => {
  'use strict';

  const CONFIG = {
    DRY_RUN: false,                                   // <-- set false to actually write descriptions
    GENERATE_AES: false,                              // <-- set true to also mint knob-mapped Active Effects (somaModifiers→attribute)
    PACK_IDS: [                                       // Item compendia in scope (auto-detected if present)
      'fourththing.starter-manifestations',
      'fourththing.surge-abilities',
      'bbttcc-master-content.items',
      'bbttcc-master-content.npc-abilities',
    ],
    INCLUDE_WORLD_ITEMS: true,                        // also process the world Items directory
    INCLUDE_ACTOR_ITEMS: false,                       // embedded items on actors (heavy; off by default)
  };
  const AE_FLAG = 'surfaceMechanics';                 // marks AEs this macro owns (idempotent replace)

  // ---- core logic (mirrors tools-validated /tmp/mech-core) ----------------
  const MARK_START = '<!-- BBTTCC:MECHANICS:START -->';
  const MARK_END   = '<!-- BBTTCC:MECHANICS:END -->';
  const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const titleCase = (s) => String(s||'').replace(/[-_]/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
  const present = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '0';

  function stripBlock(html) {
    if (!html) return '';
    const re = new RegExp(reEsc(MARK_START) + '[\\s\\S]*?' + reEsc(MARK_END), 'g');
    return html.replace(re, '').replace(/\s+$/,'');
  }

  function proseStatesMechanics(html) {
    const t = String(html || '');
    if (!t.trim()) return false;
    const plain = t.replace(/<[^>]+>/g,' ').replace(/[‐-―−]/g,'-').replace(/ /g,' ');
    return /\b\d*d\d+\b/i.test(plain)
      || /\b(heal|heals|restore|restores|regain|regains)\b/i.test(plain)
      || /\b\d+\s*(hp|hit points?|damage|stress|integrity|noise|clarity)\b/i.test(plain)
      || /\b\d+\s*\/\s*(day|turn|scene|round|rest|soma|duration)\b/i.test(plain)
      || /\bresistance|advantage|disadvantage|reroll\b/i.test(plain)
      || /\bDC\s*\d+\b/i.test(plain)
      || /\b\d+\s*(ft|feet|foot|mi|mile|miles|hex|hexes|meters?|metres?)\b/i.test(plain)
      || /\b\d+\s*(hours?|hrs?|minutes?|mins?|rounds?|turns?|days?|weeks?|months?|seasons?|seconds?|secs?)\b/i.test(plain)
      || /\b\d+\s+levels?\b/i.test(plain)
      || /\bonce\s*(per|\/)\s*(a\s+)?(day|turn|scene|round|rest|soma|combat|encounter)/i.test(plain)
      || /\bby\s+\d+\b/i.test(plain)
      || /\bminimum of\s+\d+\b/i.test(plain)
      || /\bequal to\b/i.test(plain)
      || /\bskill rank\b/i.test(plain)
      || /[+\-]\d+\b/.test(plain);
  }

  function isFtCustom(sys) {
    if (!sys) return false;
    return !!sys.manifestation
      || (sys.damage && typeof sys.damage === 'object' && 'formula' in sys.damage)
      || (typeof sys.channel === 'string' && sys.sephirah !== undefined)
      || (typeof sys.intent === 'string' && typeof sys.category === 'string');
  }

  function ftLines(sys) {
    const lines = [];
    const m = sys.manifestation || {};
    const isPower = typeof sys.channel === 'string' || (sys.category === 'manifestation' && !sys.skill);

    let dmgFormula='', dmgType='', dmgTrack='', dmgFlavor='', dmgAttr='';
    if (sys.damage && typeof sys.damage === 'object') {
      dmgFormula=sys.damage.formula||''; dmgType=sys.damage.type||''; dmgTrack=sys.damage.track||''; dmgFlavor=sys.damage.damageFlavor||''; dmgAttr=sys.damage.attribute||'';
    } else if (typeof sys.damage === 'string') {
      dmgFormula=sys.damage; dmgType=sys.damageType||''; dmgFlavor=sys.damageFlavor||''; dmgAttr=sys.attribute||'';
    }
    let anyMagnitude=false;
    if (present(dmgFormula)) {
      anyMagnitude=true;
      let d = `${esc(dmgFormula)}`;
      if (present(dmgType)) d += ` ${esc(titleCase(dmgType))}`;
      d += present(dmgTrack) ? ` damage to <em>${esc(titleCase(dmgTrack))}</em>` : ` damage`;
      if (present(dmgFlavor)) d += ` <span style="opacity:.75">(${esc(dmgFlavor)})</span>`;
      lines.push({ label:'Damage', val:d });
    }
    if (present(dmgAttr)) lines.push({ label:'Faculty', val:esc(titleCase(dmgAttr)) });
    if (present(sys.skill)) lines.push({ label:'Attack', val:`${esc(titleCase(sys.skill))}${present(sys.intent)?` (${esc(titleCase(sys.intent))})`:''}` });
    else if (present(sys.intent) && isPower) lines.push({ label:'Intent', val:esc(titleCase(sys.intent)) });
    if (present(sys.activation)) lines.push({ label:'Action', val:esc(titleCase(sys.activation)) });
    if (sys.range && typeof sys.range === 'object' && (present(sys.range.short) || present(sys.range.long))) {
      const s=sys.range.short, l=sys.range.long;
      if (Number(s)<=1 && Number(l)<=1) lines.push({ label:'Reach', val:'Melee' });
      else lines.push({ label:'Range', val:`${esc(s)}${present(l)&&l!==s?` / ${esc(l)}`:''}` });
    } else if (typeof sys.range === 'string' && present(sys.range)) {
      lines.push({ label:'Range', val:esc(titleCase(sys.range)) });
    }
    if (present(sys.target)) lines.push({ label:'Target', val:esc(titleCase(sys.target)) });
    else if (present(m.scale) && m.scale!=='personal') lines.push({ label:'Scale', val:esc(titleCase(m.scale)) });
    if (present(m.targetText)) lines.push({ label:'Target', val:esc(m.targetText) });
    const costBits=[];
    if (present(m.costType) && m.costType!=='none' && present(m.costValue)) costBits.push(`${esc(m.costValue)} ${esc(titleCase(m.costType))}`);
    if (present(sys.clarityRequired)) costBits.push(`Clarity ${esc(sys.clarityRequired)}`);
    if (present(sys.noiseGain)) costBits.push(`+${esc(sys.noiseGain)} Noise`);
    if (m.opCost && present(m.opCost.value) && present(m.opCost.pool)) costBits.push(`${esc(m.opCost.value)} ${esc(titleCase(m.opCost.pool))} OP`);
    if (present(m.costText)) costBits.push(esc(m.costText));
    if (costBits.length) lines.push({ label:'Cost', val:costBits.join(', ') });
    if (present(m.durationText)) lines.push({ label:'Duration', val:esc(m.durationText) });
    else if (present(m.duration)) lines.push({ label:'Duration', val:esc(titleCase(m.duration)) });
    if (present(m.tier)) lines.push({ label:'Tier', val:`T${esc(m.tier)}` });

    const hook = present(m.mechanicalHook) ? esc(m.mechanicalHook) : (present(sys.effect) ? esc(sys.effect) : '');
    const risk = present(m.riskText) ? esc(m.riskText) : '';
    if (present(m.mechanicalHook)) anyMagnitude = true;
    return { lines, hook, risk, anyMagnitude };
  }

  // ---- RFI flag block (flags.fourththing.rfi.item) — where LIVE gear/
  // consumable mechanics actually live (heal formulas, charges, cost). ----
  // Stress is a COMPOSURE pool (higher = better): content authors add=relief
  // (Calmpact Vial, Communion Tea) and subtract=cost (Surgeon's Pact: "the cost
  // lands in stress"). So it lives with the good-up tracks — add→Restore, not
  // "Inflict". Accumulation pools (noise/corruption) stay good-down.
  const TRACK_GOOD_UP = new Set(['integrity','health','hp','guard','armor','vitality','clarity','focus','stress']);
  const TRACK_GOOD_DOWN = new Set(['noise','corruption','darkness','heat','wound','strain','fatigue']);
  function renderTrackEffect(e) {
    const amt = (e.formula && String(e.formula).trim()) ? String(e.formula) : (e.delta != null ? String(e.delta) : (e.value != null ? String(e.value) : ''));
    if (!present(amt)) return '';
    const key = String(e.track || '').toLowerCase();
    const track = titleCase(e.track || 'track');
    let verb;
    if (e.op === 'add') verb = TRACK_GOOD_DOWN.has(key) ? 'Inflict' : (TRACK_GOOD_UP.has(key) ? 'Restore' : 'Gain');
    else verb = TRACK_GOOD_DOWN.has(key) ? 'Restore' : (TRACK_GOOD_UP.has(key) ? 'Reduce' : 'Lose');
    return `${verb} <strong>${esc(amt)}</strong> ${esc(track)}`;
  }
  const ATTR_KEYS = new Set(['violence','intrigue','presence','body','mind','soul']);
  const normResList = (a) => Array.isArray(a) ? a.map(x => typeof x === 'string' ? x : (x?.type || '')).filter(Boolean) : [];
  // Knob-mapped AE changes from structured grants. ONLY somaModifiers→attribute:
  // resistances/immunities are computed-output fields (clobbered by recompute →
  // an AE there is inert/misleading), so they are NOT AE'd — see report.
  function grantsToAEChanges(rfi) {
    const g = rfi.grants || {};
    const changes = [];
    const MODE_ADD = (CONST?.ACTIVE_EFFECT_MODES?.ADD) ?? 2;
    if (g.somaModifiers && typeof g.somaModifiers === 'object') {
      for (const [k,v] of Object.entries(g.somaModifiers)) {
        const key = String(k).toLowerCase();
        if (ATTR_KEYS.has(key) && present(v)) changes.push({ key:`system.attributes.${key}.value`, mode:MODE_ADD, value:String(v), priority:20 });
      }
    }
    return changes;
  }
  function rfiBlock(rfi, item) {
    const lines = [];
    const sys = item.system || {};
    const c = rfi.consume || {};
    const effects = Array.isArray(c.effects) ? c.effects : [];
    const renderEffect = (e) => {
      if (e.kind === 'track') return renderTrackEffect(e);
      if (e.kind === 'condition') {
        const verb = e.op === 'remove' ? 'Cure' : (e.op === 'add' ? 'Inflict' : titleCase(e.op || ''));
        return `${verb} <strong>${esc(titleCase(e.condition || 'condition'))}</strong>`;
      }
      if (e.kind === 'mutation') {
        if (e.op === 'cleanseAll') return 'Cleanse <strong>all</strong> mutations';
        if (e.op === 'cleanse') { const n = Number(e.count ?? 1); return `Cleanse <strong>${esc(n)}</strong> mutation${n > 1 ? 's' : ''}`; }
        return `${esc(titleCase(e.op || ''))} mutation`;
      }
      return e.text ? esc(e.text) : '';
    };
    const eff = effects.map(renderEffect).filter(Boolean);
    let anyMagnitude = false;
    if (eff.length) { anyMagnitude = true; lines.push({ label:'On use', val:eff.join('; ') }); }
    // Grants live at flags.fourththing.grants (where the DEFENSE ENGINE reads) — prefer
    // that over the rfi-flag copy, so top-level-grant items (e.g. Rad Suits) surface.
    const g = item.flags?.fourththing?.grants ?? rfi.grants ?? {};
    const isArmor = item.type==='armor' || rfi.frame==='armor';

    // Gather GM-editable AE grant rows once (flags.fourththing.grant.*). Numeric
    // stats (guard/evasion/resolve) take precedence over native; lists merge.
    const fromAE = { resists:[], immunes:[], vulns:[], condImmunes:[], guard:undefined, evasion:undefined, resolve:undefined };
    for (const ae of (item.effects || [])) {
      if (ae?.disabled) continue;
      for (const ch of (ae.changes || [])) {
        const m = /^flags\.fourththing\.grant\.(resist\w*|immun\w*|vuln\w*|cond\w*|guard|evasion|resolve)$/.exec(String(ch?.key||''));
        if (!m) continue;
        const key = m[1];
        if (key==='guard' || key==='evasion' || key==='resolve') { fromAE[key] = (fromAE[key] ?? 0) + (Number(ch.value)||0); continue; }
        const vals = String(ch.value??'').split(',').map(s=>s.trim()).filter(Boolean);
        if (key.startsWith('resist')) fromAE.resists.push(...vals);
        else if (key.startsWith('immun')) fromAE.immunes.push(...vals);
        else if (key.startsWith('vuln')) fromAE.vulns.push(...vals);
        else fromAE.condImmunes.push(...vals);
      }
    }

    // Armor weight + defense modifiers (AE grant rows take precedence over native).
    if (isArmor) {
      const WEIGHTS = ['plate','mail','tower','shield','heavy','medium','light','cloth'];
      const wtag = (sys.tags||[]).map(t=>String(t).toLowerCase()).find(t=>WEIGHTS.includes(t));
      if (wtag) { anyMagnitude = true; lines.push({ label:'Armor', val:esc(titleCase(wtag)) }); }
      const fmt = (n)=>`${Number(n)>=0?'+':''}${esc(n)}`;
      const gv = fromAE.guard   !== undefined ? fromAE.guard   : sys.guardBonus;
      const ev = fromAE.evasion !== undefined ? fromAE.evasion : sys.evasionBonus;
      const rv = fromAE.resolve !== undefined ? fromAE.resolve : sys.resolveBonus;
      const defBits = [];
      if (present(gv)) defBits.push(`Guard ${fmt(gv)}`);
      if (present(ev)) defBits.push(`Evasion ${fmt(ev)}`);
      if (present(rv)) defBits.push(`Resolve ${fmt(rv)}`);
      if (defBits.length) { anyMagnitude = true; lines.push({ label:'Defense', val:defBits.join(', ') }); }
      if (present(sys.armorSkill)) lines.push({ label:'Requires', val:`${esc(titleCase(sys.armorSkill))} (trained)` });
    }

    const uniq = (arr) => [...new Set(arr.filter(Boolean))];
    const allRes  = uniq([...normResList(g.resistances), ...(isArmor?normResList(sys.resistances):[]), ...fromAE.resists]);
    const allImm  = uniq([...normResList(g.immunities), ...fromAE.immunes]);
    const allVuln = uniq([...normResList(g.vulnerabilities), ...fromAE.vulns]);
    const allCond = uniq([...(Array.isArray(g.conditionImmunities)?g.conditionImmunities:[]).map(String), ...fromAE.condImmunes]);
    if (allRes.length)  { anyMagnitude = true; lines.push({ label:'Resistance',    val:esc(allRes.map(titleCase).join(', ')) }); }
    if (allImm.length)  { anyMagnitude = true; lines.push({ label:'Immunity',      val:esc(allImm.map(titleCase).join(', ')) }); }
    if (allVuln.length) { anyMagnitude = true; lines.push({ label:'Vulnerability', val:esc(allVuln.map(titleCase).join(', ')) }); }
    if (allCond.length) { anyMagnitude = true; lines.push({ label:'Immune to',     val:esc(allCond.map(titleCase).join(', ')) }); }
    if (g.somaModifiers && typeof g.somaModifiers === 'object') {
      const sm = Object.entries(g.somaModifiers).filter(([k,v])=>present(v)).map(([k,v])=>`${Number(v)>=0?'+':''}${esc(v)} ${esc(titleCase(k))}`);
      if (sm.length) { anyMagnitude = true; lines.push({ label:'Passive', val:sm.join(', ') }); }
    }
    if (present(rfi.charges)) lines.push({ label:'Charges', val:`${esc(rfi.charges)}${c.decrement ? ' (consumed on use)' : ''}` });
    if (present(rfi.reach) && rfi.reach !== 'self') lines.push({ label:'Reach', val:esc(titleCase(rfi.reach)) });
    else if (rfi.reach === 'self' && !isArmor) lines.push({ label:'Target', val:'Self' });
    if (rfi.upkeep && rfi.upkeep.mode && rfi.upkeep.mode !== 'passive' && rfi.upkeep.per && rfi.upkeep.per !== 'none')
      lines.push({ label:'Upkeep', val:`${esc(titleCase(rfi.upkeep.mode))} / ${esc(rfi.upkeep.per)}` });
    if (present(rfi.tier)) lines.push({ label:'Tier', val:esc(String(rfi.tier)) });
    if (rfi.price && present(rfi.price.marks)) lines.push({ label:'Cost', val:`${esc(rfi.price.marks)} ${esc(titleCase(rfi.price.currency||'economy'))} marks` });
    return { lines, anyMagnitude };
  }

  function processItem(item) {
    const sys = item.system || {};
    const curDesc = stripBlock(sys.description?.value ?? '');

    const proseOK = proseStatesMechanics(curDesc);
    const rfi = item.flags?.fourththing?.rfi?.item ?? item.getFlag?.('fourththing','rfi')?.item;

    // Crafting materials & build-templates are noise — suppress from the gap list.
    const tagsLc = (sys.tags||[]).map(t=>String(t).toLowerCase());
    const isMaterial = rfi?.frame === 'material' || rfi?.materialKey != null || tagsLc.includes('material');
    const isBuildPiece = /\b(template|frame)\b/i.test(item.name||'') && !rfi?.consume?.effects?.length && !rfi?.grants;
    if ((isMaterial || isBuildPiece) && !(rfi && (rfi.consume?.effects?.length || rfi.grants)))
      return { action:'suppress', reason: isMaterial ? 'crafting material' : 'build template/frame' };

    // PRIORITY 1: RFI flag block — the live gear/consumable mechanics source.
    const armorRes = (item.type==='armor' || rfi?.frame==='armor') ? normResList(sys.resistances) : [];
    if (rfi && (rfi.consume?.effects?.length || rfi.grants || item.flags?.fourththing?.grants || armorRes.length || rfi.charges != null || rfi.price?.marks != null)) {
      const { lines, anyMagnitude } = rfiBlock(rfi, item);
      const aeChanges = CONFIG.GENERATE_AES ? grantsToAEChanges(rfi) : [];
      if (lines.length && anyMagnitude) {
        if (proseOK && !aeChanges.length) return { action:'skip' };
        let block = `\n${MARK_START}\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n${lines.map(l=>`  <li><strong>${l.label}:</strong> ${l.val}</li>`).join('\n')}\n</ul>\n${MARK_END}`;
        return { action:'render', html: proseOK ? (sys.description?.value ?? '') : (curDesc||'') + block, aeChanges, rendered: !proseOK };
      }
      const tags = (sys.tags||[]).map(t=>String(t).toLowerCase());
      if (rfi.frame==='consumable' || tags.includes('consumable') || sys.slot==='consumable')
        return { action:'gap', gapReason:'RFI consumable but no consume.effects/grants magnitude', gapPriority:'HIGH' };
    }

    if (isFtCustom(sys)) {
      if (proseOK) return { action:'skip' };
      const { lines, hook, risk } = ftLines(sys);
      if (!lines.length && !hook) return { action:'gap', gapReason:'fourththing-custom but no damage/cost/hook/range data', gapPriority:'MED' };
      let block = `\n${MARK_START}\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n`;
      if (hook) block += `<p>${hook}</p>\n`;
      if (lines.length) block += `<ul>\n${lines.map(l=>`  <li><strong>${l.label}:</strong> ${l.val}</li>`).join('\n')}\n</ul>\n`;
      if (risk) block += `<p><strong>Risk:</strong> ${risk}</p>\n`;
      block += `${MARK_END}`;
      return { action:'render', html:(curDesc||'') + block };
    }
    if (proseStatesMechanics(curDesc)) return { action:'skip' };
    const plain = curDesc.replace(/<[^>]+>/g,' ');
    const activeUse = /\b(use|drink|crack|apply|activate|deploy|inject|once per|once\/|1\/day|bonus action|as an action|reaction)\b/i.test(plain);
    const reason = curDesc.trim() ? 'prose present but states no magnitudes' : 'empty description, no structured data';
    const tags = (sys.tags||[]).map(t=>String(t).toLowerCase());
    const isConsumable = item.type==='consumable' || tags.includes('consumable') || sys.slot==='consumable' || rfi?.frame==='consumable';
    let priority = 'LOW';
    if (isConsumable) priority = 'HIGH';
    else if (activeUse) priority = 'MED';
    return { action:'gap', gapReason:reason, gapPriority:priority };
  }

  // ---- runner -------------------------------------------------------------
  const summary = { rendered:0, skipped:0, suppressed:0, gaps:[], aes:[] };
  const writes = [];   // {item, pack, isPack, html?, aeChanges, label}

  async function handleCollection(label, docs, isPack, pack) {
    for (const item of docs) {
      const r = processItem(item);
      if (r.action === 'render') {
        const descChanged = (r.rendered !== false) && item.system?.description?.value !== r.html;
        const aeChanges = r.aeChanges || [];
        if (descChanged) summary.rendered++;
        if (aeChanges.length) summary.aes.push({ src:label, name:item.name, changes:aeChanges });
        if (descChanged || aeChanges.length) writes.push({ item, pack, isPack, html: descChanged ? r.html : null, aeChanges, label });
      } else if (r.action === 'skip') {
        summary.skipped++;
      } else if (r.action === 'suppress') {
        summary.suppressed++;
      } else {
        summary.gaps.push({ src:label, name:item.name, type:item.type, reason:r.gapReason, pri:r.gapPriority });
      }
    }
  }

  // compendium packs
  for (const pid of CONFIG.PACK_IDS) {
    const pack = game.packs.get(pid);
    if (!pack) { console.warn(`[surface-mechanics] pack not found: ${pid}`); continue; }
    if (pack.metadata.type !== 'Item') { console.warn(`[surface-mechanics] skip non-Item pack: ${pid}`); continue; }
    const docs = await pack.getDocuments();
    await handleCollection(`pack:${pid}`, docs, true, pack);
  }
  // world items
  if (CONFIG.INCLUDE_WORLD_ITEMS) await handleCollection('world-items', Array.from(game.items), false);
  // actor-embedded items
  if (CONFIG.INCLUDE_ACTOR_ITEMS) {
    for (const a of game.actors) await handleCollection(`actor:${a.name}`, Array.from(a.items), false);
  }

  // ---- apply (unless dry run) --------------------------------------------
  let applied = 0, aesMade = 0;
  async function applyGroup(ws, packCollection) {
    const descUpdates = ws.filter(w=>w.html != null).map(w=>({ _id:w.item.id, 'system.description.value':w.html }));
    if (descUpdates.length) { await Item.updateDocuments(descUpdates, packCollection ? { pack:packCollection } : {}); applied += descUpdates.length; }
    if (CONFIG.GENERATE_AES) {
      for (const w of ws.filter(w=>w.aeChanges?.length)) {
        const item = packCollection ? await game.packs.get(packCollection).getDocument(w.item.id) : w.item;
        const stale = item.effects.filter(e=>e.getFlag?.('fourththing', AE_FLAG)).map(e=>e.id);
        if (stale.length) await item.deleteEmbeddedDocuments('ActiveEffect', stale);
        await item.createEmbeddedDocuments('ActiveEffect', [{
          name: '⚙️ Mechanical (passive)',
          icon: 'icons/svg/upgrade.svg',
          transfer: true, disabled: false,
          changes: w.aeChanges,
          flags: { fourththing: { [AE_FLAG]: true } },
        }]);
        aesMade++;
      }
    }
  }
  if (!CONFIG.DRY_RUN && writes.length) {
    const byPack = new Map(); const loose = [];
    for (const w of writes) { if (w.isPack) { const k=w.pack.collection; if(!byPack.has(k)) byPack.set(k,[]); byPack.get(k).push(w); } else loose.push(w); }
    for (const [coll, ws] of byPack) {
      const pack = ws[0].pack; const wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked:false });
      try { await applyGroup(ws, coll); } finally { if (wasLocked) await pack.configure({ locked:true }); }
    }
    if (loose.length) await applyGroup(loose, null);
  }

  // ---- gap report journal -------------------------------------------------
  const order = { HIGH:0, MED:1, LOW:2 };
  summary.gaps.sort((a,b)=> (order[a.pri]-order[b.pri]) || a.src.localeCompare(b.src) || a.name.localeCompare(b.name));
  const count = (p)=>summary.gaps.filter(g=>g.pri===p).length;
  const rows = summary.gaps.map(g=>`<tr><td>${g.pri}</td><td>${esc(g.name)}</td><td>${esc(g.type)}</td><td>${esc(g.src)}</td><td>${esc(g.reason)}</td></tr>`).join('\n');
  const aeRows = summary.aes.map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(a.src)}</td><td>${a.changes.map(c=>esc(`${c.key} +${c.value}`)).join('<br/>')}</td></tr>`).join('\n');
  const html =
    `<h2>⚙️ Mechanical Effects — Report</h2>`+
    `<p><em>${CONFIG.DRY_RUN ? 'DRY RUN — nothing written.' : `Applied ${applied} description update(s)${CONFIG.GENERATE_AES?`, minted ${aesMade} Active Effect(s)`:''}.`}</em></p>`+
    `<ul><li><strong>Rendered</strong> (structured block injected): ${summary.rendered}</li>`+
    `<li><strong>Skipped</strong> (prose already states effects): ${summary.skipped}</li>`+
    `<li><strong>Suppressed</strong> (crafting materials / build templates — no combat numbers expected): ${summary.suppressed}</li>`+
    `<li><strong>Active Effects</strong> (knob-mapped, somaModifiers→attribute): ${summary.aes.length}${CONFIG.GENERATE_AES?'':' <em>(disabled — set CONFIG.GENERATE_AES=true)</em>'}</li>`+
    `<li><strong>Gaps</strong> (need authoring): ${summary.gaps.length} — HIGH ${count('HIGH')} / MED ${count('MED')} / LOW ${count('LOW')}</li></ul>`+
    `<p>HIGH = consumables/active items a player can't size up. LOW = passive gear / crafting materials / vehicle frames / templates (usually fine without numbers).</p>`+
    `<p><strong>⚠️ Active Effects note:</strong> This (description) macro only mints <code>grants.somaModifiers</code> → <code>system.attributes.&lt;attr&gt;.value</code> AEs — those are read by no engine code, so the AE makes them actually function. <strong>Defense grants</strong> (resistances/immunities + armor Guard/Evasion/Resolve mods) are migrated to native, GM-editable AEs by the separate <code>grant-effects-to-ae.macro.js</code> (Bucket-A pilot, validated in-world) — <code>ftComputeDefenses</code>/<code>ftComputeArmorBonus</code> read the AE change rows (<code>flags.fourththing.grant.*</code>) inside their gated loops. Run that macro for defenses; this one handles descriptions.</p>`+
    (summary.aes.length ? `<h3>Active Effects ${CONFIG.GENERATE_AES?'minted':'proposed'}</h3><table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Item</th><th>Source</th><th>Changes</th></tr></thead><tbody>\n${aeRows}\n</tbody></table>` : '')+
    `<h3>Gaps</h3><table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Pri</th><th>Name</th><th>Type</th><th>Source</th><th>Reason</th></tr></thead><tbody>\n${rows}\n</tbody></table>`;

  const jname = '⚙️ Mechanical Effects — Report';
  const existing = game.journal.getName(jname);
  if (existing) {
    const page = existing.pages.contents[0];
    if (page) await page.update({ 'text.content': html });
    else await existing.createEmbeddedDocuments('JournalEntryPage', [{ name:'Report', type:'text', text:{ content:html, format:1 } }]);
  } else {
    await JournalEntry.create({ name:jname, pages:[{ name:'Report', type:'text', text:{ content:html, format:1 } }] });
  }

  console.log('%c[surface-mechanics]', 'color:#ffb000;font-weight:bold', CONFIG.DRY_RUN ? 'DRY RUN' : `APPLIED ${applied}`);
  console.table(summary.gaps);
  ui.notifications.info(`Mechanical Effects: rendered ${summary.rendered}, skipped ${summary.skipped}, suppressed ${summary.suppressed}, AEs ${summary.aes.length}, gaps ${summary.gaps.length} (HIGH ${count('HIGH')}/MED ${count('MED')}/LOW ${count('LOW')}). ${CONFIG.DRY_RUN ? 'DRY RUN — flip CONFIG.DRY_RUN to apply.' : `Applied ${applied}, AEs ${aesMade}.`} See journal "${jname}".`);
})();
