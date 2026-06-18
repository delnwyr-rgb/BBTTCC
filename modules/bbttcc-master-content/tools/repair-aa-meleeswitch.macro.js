/**
 * repair-aa-meleeswitch.macro.js  —  BBTTCC / fourththing (RFI)
 * ---------------------------------------------------------------------------
 * Repairs items whose Automated Animations flag was stamped by our buildAA
 * scaffolds with `menu:"melee"` but NO `meleeSwitch` block. AA's item-config
 * editor (ItemMenuApp → MeleeSwitch.svelte:38) reads `$animation.meleeSwitch.
 * options.switchType` unconditionally for a melee animation, so a missing
 * meleeSwitch throws "Cannot read properties of undefined (reading 'options')"
 * and the editor won't open. (Animations still PLAY — only the editor breaks.)
 *
 * This adds the standard meleeSwitch block (matching AA's native default +
 * autorec data) to any affected item. Idempotent: only touches melee-menu items
 * that lack meleeSwitch. DRY_RUN default. Scans compendium packs + world items +
 * actor-embedded items.
 *
 * Root cause fixed-forward in the buildAA scaffolds so new stamps are complete.
 */
(async () => {
  'use strict';
  const CONFIG = {
    DRY_RUN: true,
    PACK_IDS: [
      'bbttcc-master-content.items',
      'bbttcc-master-content.npc-abilities',
      'fourththing.starter-manifestations',
      'fourththing.surge-abilities',
    ],
    INCLUDE_WORLD_ITEMS: true,
    INCLUDE_ACTOR_ITEMS: true,
  };

  // Standard meleeSwitch block (AA native default; switchType "on" = inert unless configured).
  const MELEE_SWITCH = () => ({
    video: { dbSection: 'range', menuType: 'weapon', animation: 'arrow', variant: 'regular', color: 'regular', enableCustom: false, customPath: '' },
    sound: { enable: false, delay: 0, repeat: 1, repeatDelay: 250, startTime: 0, volume: 0.75 },
    options: { detect: 'automatic', range: 2, returning: false, switchType: 'on' },
  });

  const needsRepair = (item) => {
    const f = item.flags?.autoanimations;
    return !!f && f.menu === 'melee' && (f.meleeSwitch == null);
  };

  const found = [];
  async function scan(label, docs, pack) {
    for (const item of docs) if (needsRepair(item)) found.push({ item, pack, label, name: item.name });
  }

  for (const pid of CONFIG.PACK_IDS) {
    const pack = game.packs.get(pid);
    if (!pack || pack.metadata.type !== 'Item') continue;
    await scan(`pack:${pid}`, await pack.getDocuments(), pack);
  }
  if (CONFIG.INCLUDE_WORLD_ITEMS) await scan('world', Array.from(game.items), null);
  if (CONFIG.INCLUDE_ACTOR_ITEMS) for (const a of game.actors) await scan(`actor:${a.name}`, Array.from(a.items), null);

  let repaired = 0;
  if (!CONFIG.DRY_RUN && found.length) {
    const byPack = new Map(); const loose = [];
    for (const w of found) { if (w.pack) { const k = w.pack.collection; if (!byPack.has(k)) byPack.set(k, []); byPack.get(k).push(w); } else loose.push(w); }
    for (const [coll, ws] of byPack) {
      const pack = ws[0].pack; const wasLocked = pack.locked;
      if (wasLocked) await pack.configure({ locked: false });
      try {
        await Item.updateDocuments(ws.map(w => ({ _id: w.item.id, 'flags.autoanimations.meleeSwitch': MELEE_SWITCH() })), { pack: coll });
        repaired += ws.length;
      } finally { if (wasLocked) await pack.configure({ locked: true }); }
    }
    for (const w of loose) { await w.item.update({ 'flags.autoanimations.meleeSwitch': MELEE_SWITCH() }); repaired++; }
  }

  console.log('%c[repair-aa-meleeswitch]', 'color:#ffb000;font-weight:bold', CONFIG.DRY_RUN ? 'DRY RUN' : `REPAIRED ${repaired}`);
  console.table(found.map(f => ({ name: f.name, src: f.label })));
  ui.notifications.info(`AA meleeSwitch repair: ${found.length} melee-menu item(s) missing meleeSwitch. ${CONFIG.DRY_RUN ? 'DRY RUN — flip CONFIG.DRY_RUN to apply.' : `Repaired ${repaired}. Re-open the AA editor to confirm.`}`);
})();
