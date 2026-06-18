/**
 * add-onuse-effect.macro.js  —  BBTTCC / fourththing (RFI)   [Bucket-B helper]
 * ---------------------------------------------------------------------------
 * Authors an `applyOnUse` template Active Effect onto a consumable item, until
 * the On-Use sheet editor lands. When the item is USED (runConsumeEffects), the
 * engine clones this AE onto the user with its duration — the AE-native half of
 * a Bucket-B on-use effect (the dice/track changes are the procedural half).
 *
 * The demo effect = a 1-hour energy resistance ward authored as a NATIVE change
 * row (key flags.fourththing.grant.resists, mode ADD, value = comma-separated
 * damage types) so it shows + edits in the AE Changes tab instead of rendering
 * "empty". ftComputeDefenses reads these change VALUES on the actor. Edit
 * CONFIG.EFFECT to author others; durational conditions can instead use
 * (mode 5 = OVERRIDE):
 *   changes: [{ key: "system.conditions.calmed", mode: 5, value: "true" }],
 *   statuses: ["calmed"], duration: { rounds: 3 }
 *
 * Idempotent (replaces a same-named applyOnUse AE). MODE:'rollback' removes it.
 * Target an item that HAS a consume block (e.g. Surgeon's Pact) so the use button
 * fires runConsumeEffects. DRY_RUN default.
 */
(async () => {
  'use strict';
  const CONFIG = {
    DRY_RUN: true,
    MODE: 'apply',                       // 'apply' | 'rollback'
    ITEM_NAME: "Surgeon's Pact",         // item to attach the on-use effect to
    SEARCH_WORLD: true,
    SEARCH_PACKS: ['bbttcc-master-content.items'],
    EFFECT: {
      name: 'Chill Ward (1 hr)',
      icon: 'icons/svg/frozen.svg',
      duration: { seconds: 3600 },
      // Native change row → visible/editable in the AE Changes tab; ftComputeDefenses
      // reads the change VALUES on the actor (same key as Bucket-A item grants).
      changes: [{ key: 'flags.fourththing.grant.resists', mode: 2, value: 'energy', priority: 20 }],
    },
  };
  const FLAG_NAME = CONFIG.EFFECT.name;

  // locate item
  let item = null;
  if (CONFIG.SEARCH_WORLD) item = game.items.find(i => i.name === CONFIG.ITEM_NAME)
    ?? game.actors.contents.flatMap(a => Array.from(a.items)).find(i => i.name === CONFIG.ITEM_NAME);
  if (!item) for (const pid of CONFIG.SEARCH_PACKS) {
    const pack = game.packs.get(pid); if (!pack) continue;
    const docs = await pack.getDocuments();
    item = docs.find(i => i.name === CONFIG.ITEM_NAME); if (item) break;
  }
  if (!item) { ui.notifications.error(`add-onuse-effect: item not found: ${CONFIG.ITEM_NAME}`); return; }

  const isOurs = (e) => e.name === FLAG_NAME && e.getFlag?.('fourththing', 'applyOnUse') === true;
  const existing = item.effects.filter(isOurs).map(e => e.id);

  const aeData = {
    name: CONFIG.EFFECT.name,
    icon: CONFIG.EFFECT.icon,
    img:  CONFIG.EFFECT.icon,
    transfer: false,                     // template lives on the item; cloned onto user at use-time
    disabled: false,
    duration: CONFIG.EFFECT.duration ?? {},
    changes:  CONFIG.EFFECT.changes ?? [],
    flags: { fourththing: { applyOnUse: true, ...(CONFIG.EFFECT.manifestationEffect ? { manifestationEffect: CONFIG.EFFECT.manifestationEffect } : {}) } },
  };

  const pack = item.pack ? game.packs.get(item.pack) : null;
  const summary = `${item.name} ${item.pack ? `(pack ${item.pack})` : '(world)'} — ${CONFIG.MODE} "${FLAG_NAME}"`;
  if (CONFIG.DRY_RUN) {
    console.log('%c[add-onuse-effect] DRY RUN', 'color:#4af;font-weight:bold', summary, CONFIG.MODE === 'apply' ? aeData : `would remove ${existing.length}`);
    ui.notifications.info(`add-onuse-effect DRY RUN: ${summary}. ${CONFIG.MODE === 'apply' ? 'Would author the AE.' : `Would remove ${existing.length}.`} Flip DRY_RUN to apply.`);
    return;
  }
  if (pack?.locked) await pack.configure({ locked: false });
  try {
    if (existing.length) await item.deleteEmbeddedDocuments('ActiveEffect', existing);
    if (CONFIG.MODE === 'apply') await item.createEmbeddedDocuments('ActiveEffect', [aeData]);
  } finally { if (pack?.locked === false) await pack.configure({ locked: true }); }

  ui.notifications.info(`add-onuse-effect: ${CONFIG.MODE === 'apply' ? 'authored' : 'removed'} "${FLAG_NAME}" on ${item.name}. Use the item to ${CONFIG.MODE === 'apply' ? 'clone it onto the user' : 'confirm removal'}.`);
  console.log('%c[add-onuse-effect] done', 'color:#4af;font-weight:bold', summary);
})();
