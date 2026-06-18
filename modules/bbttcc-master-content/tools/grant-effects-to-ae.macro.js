/**
 * grant-effects-to-ae.macro.js  —  BBTTCC / fourththing (RFI)   [Bucket-A pilot]
 * ---------------------------------------------------------------------------
 * Migrates PASSIVE DEFENSE GRANTS off the bespoke `flags.fourththing.rfi.item.grants`
 * shape and onto native, GM-visible/editable Active Effects on the item, carrying
 * `flags.fourththing.grant = { resists, immunes, vulns, condImmunes }`.
 *
 * WHY: GMs expect to open an item's Active Effects tab and see/edit/clone the
 * mechanics it ships. It ALSO fixes a live bug — the engine reads passive grants
 * at `flags.fourththing.grants` (top-level), but content authored them at
 * `flags.fourththing.rfi.item.grants`, so those resistances were never applying.
 * The matching engine read (ftComputeDefenses, inside the gated item loop) now
 * merges `item.effects[].flags.fourththing.grant`, inheriting the same equipped +
 * skill gates, and resistMap is Set-keyed so this never double-counts.
 *
 * SAFE: additive only — does NOT remove the old grants flag (so current behaviour
 * is preserved; the AE just makes the grant visible + actually apply). DRY_RUN by
 * default. MODE:'rollback' deletes the AEs this macro created.
 *
 * RUN: paste into a GM script macro. Validate by dragging e.g. Hex-Carved Plate
 * onto an actor, equipping it (with the gating skill trained), and confirming the
 * resistance shows on the sheet + in the item's Effects tab.
 */
(async () => {
  'use strict';

  const CONFIG = {
    DRY_RUN: true,                    // <-- false to write
    MODE: 'apply',                    // 'apply' | 'rollback'
    PACK_IDS: ['bbttcc-master-content.items'],
    INCLUDE_WORLD_ITEMS: true,
    INCLUDE_ACTOR_ITEMS: true,        // live armor instances live on actors
    INCLUDE_NATIVE_ARMOR_RES: false,  // native system.resistances already apply+show; off by default
  };
  const AE_FLAG = 'defenseGrant';        // dedicated marker (distinct from surface-mechanics' somaModifier AEs)
  const AE_NAME = '⚙️ Defense Grant';
  // Identify our AEs: new (defenseGrant flag), legacy blank ones (old `grant` payload flag), or by name.
  const isOurs = (e) => !!(e.getFlag?.('fourththing', AE_FLAG) || e.getFlag?.('fourththing', 'grant') || e.name === AE_NAME);

  const norm = (a) => Array.isArray(a) ? a.map(x => typeof x === 'string' ? x : (x?.type || '')).filter(Boolean) : [];

  // Build the grant payload for an item, or null if it grants no passive defenses.
  function grantOf(item) {
    const rfi = item.flags?.fourththing?.rfi?.item ?? item.getFlag?.('fourththing','rfi')?.item;
    const g = rfi?.grants || {};
    const resists = [...norm(g.resistances)];
    const immunes = [...norm(g.immunities)];
    const vulns   = [...norm(g.vulnerabilities)];
    const condImmunes = (Array.isArray(g.conditionImmunities) ? g.conditionImmunities : []).map(String);
    const isArmor = item.type === 'armor' || rfi?.frame === 'armor';
    if (CONFIG.INCLUDE_NATIVE_ARMOR_RES && isArmor)
      for (const r of norm(item.system?.resistances)) if (!resists.includes(r)) resists.push(r);
    // Numeric armor defense mods → grant rows (precedence over native in the engine).
    const sys = item.system || {};
    const numeric = {};
    if (isArmor) {
      for (const [stat, field] of [['guard','guardBonus'],['evasion','evasionBonus'],['resolve','resolveBonus']]) {
        const v = Number(sys[field]);
        if (Number.isFinite(v) && v !== 0) numeric[stat] = v;
      }
    }
    if (!resists.length && !immunes.length && !vulns.length && !condImmunes.length && !Object.keys(numeric).length) return null;
    const payload = {};
    if (resists.length) payload.resists = resists;
    if (immunes.length) payload.immunes = immunes;
    if (vulns.length) payload.vulns = vulns;
    if (condImmunes.length) payload.condImmunes = condImmunes;
    Object.assign(payload, numeric);   // guard/evasion/resolve as numbers
    return payload;
  }

  const NUMERIC_STATS = ['guard','evasion','resolve'];
  const summarize = (g) => Object.entries(g)
    .map(([k,v]) => Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k} ${v>=0?'+':''}${v}`).join(' · ');

  const report = { scanned:0, apply:[], rollback:[], skipped:0 };

  async function handle(item) {
    report.scanned++;
    const existing = item.effects.filter(isOurs);
    if (CONFIG.MODE === 'rollback') {
      if (existing.length) report.rollback.push({ item, ids: existing.map(e=>e.id), name:item.name });
      return;
    }
    const grant = grantOf(item);
    if (!grant) { if (existing.length) report.rollback.push({ item, ids: existing.map(e=>e.id), name:item.name, stale:true }); return; }
    report.apply.push({ item, grant, existingIds: existing.map(e=>e.id), name:item.name });
  }

  // gather
  const collections = [];
  for (const pid of CONFIG.PACK_IDS) {
    const pack = game.packs.get(pid);
    if (!pack || pack.metadata.type !== 'Item') { console.warn(`[grant-ae] skip ${pid}`); continue; }
    collections.push({ pack, docs: await pack.getDocuments() });
  }
  if (CONFIG.INCLUDE_WORLD_ITEMS) collections.push({ pack:null, docs: Array.from(game.items) });
  if (CONFIG.INCLUDE_ACTOR_ITEMS) for (const a of game.actors) collections.push({ pack:null, docs: Array.from(a.items) });

  for (const c of collections) for (const it of c.docs) await handle(it);

  // apply
  let made = 0, removed = 0;
  if (!CONFIG.DRY_RUN) {
    const packsTouched = new Set();
    const unlock = async (item) => { const p = item.pack ? game.packs.get(item.pack) : null; if (p?.locked) { await p.configure({locked:false}); packsTouched.add(p); } };
    for (const r of report.rollback) { await unlock(r.item); await r.item.deleteEmbeddedDocuments('ActiveEffect', r.ids); removed += r.ids.length; }
    for (const a of report.apply) {
      await unlock(a.item);
      if (a.existingIds.length) await a.item.deleteEmbeddedDocuments('ActiveEffect', a.existingIds);
      const MODE_ADD = (CONST?.ACTIVE_EFFECT_MODES?.ADD) ?? 2;
      const changes = [];
      for (const t of (a.grant.resists  || [])) changes.push({ key:'flags.fourththing.grant.resists',     mode:MODE_ADD, value:t, priority:20 });
      for (const t of (a.grant.immunes  || [])) changes.push({ key:'flags.fourththing.grant.immunes',     mode:MODE_ADD, value:t, priority:20 });
      for (const t of (a.grant.vulns    || [])) changes.push({ key:'flags.fourththing.grant.vulns',       mode:MODE_ADD, value:t, priority:20 });
      for (const c of (a.grant.condImmunes || [])) changes.push({ key:'flags.fourththing.grant.condImmunes', mode:MODE_ADD, value:c, priority:20 });
      for (const stat of NUMERIC_STATS) if (a.grant[stat] !== undefined) changes.push({ key:`flags.fourththing.grant.${stat}`, mode:MODE_ADD, value:String(a.grant[stat]), priority:20 });
      await a.item.createEmbeddedDocuments('ActiveEffect', [{
        name: AE_NAME,
        icon: 'icons/svg/shield.svg',
        transfer: false,                 // lives on the item; engine reads item.effects (gated)
        disabled: false,
        changes,                         // native, GM-editable change rows; engine reads the values
        flags: { fourththing: { [AE_FLAG]: true } },  // dedicated marker (idempotent re-run / rollback)
      }]);
      made++;
    }
    for (const p of packsTouched) await p.configure({ locked:true });
  }

  // journal report
  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows = (CONFIG.MODE==='rollback' ? report.rollback : report.apply)
    .map(r => `<tr><td>${esc(r.name)}</td><td>${CONFIG.MODE==='rollback' ? `${r.ids.length} AE removed${r.stale?' (stale)':''}` : esc(summarize(r.grant))}</td></tr>`).join('\n');
  const html =
    `<h2>⚙️ Defense Grants → Active Effects (Bucket-A pilot)</h2>`+
    `<p><em>${CONFIG.DRY_RUN ? 'DRY RUN — nothing written.' : `MODE=${CONFIG.MODE}: created ${made}, removed ${removed}.`}</em></p>`+
    `<ul><li>Scanned: ${report.scanned}</li><li>${CONFIG.MODE==='rollback'?'To remove':'To author'}: ${(CONFIG.MODE==='rollback'?report.rollback:report.apply).length}</li></ul>`+
    `<table border="1" cellpadding="3" style="border-collapse:collapse"><thead><tr><th>Item</th><th>${CONFIG.MODE==='rollback'?'Action':'Grant'}</th></tr></thead><tbody>\n${rows}\n</tbody></table>`;
  const jname = '⚙️ Defense Grants → AE Report';
  const ex = game.journal.getName(jname);
  if (ex) { const pg = ex.pages.contents[0]; if (pg) await pg.update({ 'text.content': html }); else await ex.createEmbeddedDocuments('JournalEntryPage',[{name:'Report',type:'text',text:{content:html,format:1}}]); }
  else await JournalEntry.create({ name:jname, pages:[{name:'Report',type:'text',text:{content:html,format:1}}] });

  console.log('%c[grant-effects-to-ae]','color:#4af;font-weight:bold', CONFIG.DRY_RUN?'DRY RUN':`MODE=${CONFIG.MODE} made ${made} removed ${removed}`);
  console.table((CONFIG.MODE==='rollback'?report.rollback:report.apply).map(r=>({item:r.name, grant: r.grant?summarize(r.grant):`${r.ids?.length||0} AE`})));
  ui.notifications.info(`Defense→AE pilot (${CONFIG.MODE}): scanned ${report.scanned}, ${CONFIG.MODE==='rollback'?`remove ${report.rollback.length}`:`author ${report.apply.length}`}. ${CONFIG.DRY_RUN?'DRY RUN — flip CONFIG.DRY_RUN.':`Done (made ${made}, removed ${removed}).`} See journal "${jname}".`);
})();
