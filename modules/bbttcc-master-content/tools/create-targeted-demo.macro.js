// create-targeted-demo.macro.js — BBTTCC / fourththing (RFI)  [Bucket-B fast-follow]
// ─────────────────────────────────────────────────────────────────────────────
// Demo consumables for TARGETED on-use application (consume.target === "target").
// On [Use] the effects apply to the user's CURRENTLY TARGETED token(s) instead of
// the user — throwables, apply-to-ally heals, offensive consumables. Multiple
// targets are each affected independently (instant rolls re-roll per target).
//
//   • Mending Dart  (beneficial) → target integrity +2d6+1. Target an ally, Use.
//   • Frost Bomb    (harmful)    → target integrity −1d6, applies Staggered, and
//     clones a "Chilled (2 rd)" applyOnUse AE (resist-energy ward as a placeholder
//     debuff payload). Target an enemy (or several), Use.
//
// To test: drag an item onto the USER's actor → select the user's token → TARGET
// another token (hotkey T) → click [Use] on the item in the user's inventory.
// The chat card lists each affected target; the AE lands on the target with its
// duration. NOTE: instant track deltas are RAW (no defense/resist roll) — that's
// the consume model; resistances apply to the attack/manifestation pipeline.
//
// Idempotent (updates existing + replaces demo AEs). DRY_RUN previews. TARGET
// 'world' drops them in the Items sidebar; 'pack' lands them beside RFI gear.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  'use strict';
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const CONFIG = {
    DRY_RUN: false,                          // flip true to preview without writing
    TARGET:  'world',                        // 'world' (Items sidebar) | 'pack'
    PACK_ID: 'bbttcc-master-content.items',
  };

  // Each demo item. `ae` (optional) is authored as an applyOnUse template AE.
  const ITEMS = [
    {
      name: 'Mending Dart', img: 'icons/skills/melee/strike-dagger-white-orange.webp',
      tier: 'I', charges: 1,
      signature: 'Mercy, thrown across the field.',
      lore: 'A dart loaded with restorative gel. Sticks where it lands and knits a wound from across the room.',
      consume: { target: 'target', effects: [{ kind: 'track', track: 'integrity', op: 'add', formula: '2d6+1' }], decrement: true },
    },
    {
      name: 'Frost Bomb', img: 'icons/svg/frozen.svg',
      tier: 'II', charges: 1,
      signature: 'A held breath that shatters outward.',
      lore: 'Cryo-charge in a throwable shell. Bursts in a wash of frost — staggers the unready and leaves the air biting.',
      consume: {
        target: 'target',
        effects: [
          { kind: 'track',     track: 'integrity', op: 'subtract', formula: '1d6' },
          { kind: 'condition', op: 'add',          condition: 'staggered' },
        ],
        decrement: true,
      },
      ae: {
        name: 'Chilled (2 rd)', img: 'icons/svg/frozen.svg',
        duration: { rounds: 2 },
        changes: [{ key: 'flags.fourththing.grant.resists', mode: 2, value: 'energy', priority: 20 }],
      },
    },
  ];

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available (is this the fourththing system?).");

  const inPack = CONFIG.TARGET === 'pack';
  const pack   = inPack ? game.packs.get(CONFIG.PACK_ID) : null;
  if (inPack && !pack) return ui.notifications?.error(`Pack not found: ${CONFIG.PACK_ID}`);
  const docs = inPack ? await pack.getDocuments() : null;
  const findExisting = (name) => inPack ? (docs.find(d => d.name === name) ?? null) : (game.items.find(i => i.name === name) ?? null);

  if (CONFIG.DRY_RUN) {
    console.log('%c[targeted-demo] DRY RUN', 'color:#5cf;font-weight:bold', ITEMS.map(i => i.name));
    return ui.notifications?.info(`DRY RUN — would author ${ITEMS.length} targeted demo items (${CONFIG.TARGET}). Flip DRY_RUN to apply.`);
  }

  const wasLocked = inPack && pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  const results = [];
  try {
    for (const row of ITEMS) {
      const defaults = RfiItems.defaults({ type: 'gear', system: {}, getFlag: () => null });
      const rfiFlag = {
        ...defaults,
        tier: row.tier, frame: 'consumable', origin: 'looted',
        signature: row.signature, lore: row.lore,
        upkeep: { mode: 'passive', per: 'none' },
        charges: row.charges, consume: row.consume,
      };
      const itemData = {
        name: row.name, type: 'gear', img: row.img,
        system: { slot: 'consumable', tags: ['consumable', `tier-${row.tier.toLowerCase()}`] },
        flags: { fourththing: { rfi: { item: rfiFlag } } },
      };

      let item = findExisting(row.name);
      if (item) {
        await item.update({ type: 'gear', img: row.img, system: itemData.system, 'flags.fourththing.rfi.item': rfiFlag });
      } else {
        item = await Item.create(itemData, inPack ? { pack: CONFIG.PACK_ID } : {});
      }

      if (row.ae) {
        const stale = item.effects.filter(e => e.name === row.ae.name && e.getFlag?.('fourththing', 'applyOnUse') === true).map(e => e.id);
        if (stale.length) await item.deleteEmbeddedDocuments('ActiveEffect', stale);
        await item.createEmbeddedDocuments('ActiveEffect', [{
          name: row.ae.name, icon: row.ae.img, img: row.ae.img,
          transfer: false, disabled: false,
          duration: row.ae.duration ?? {}, changes: row.ae.changes ?? [],
          flags: { fourththing: { applyOnUse: true } },
        }]);
      }
      results.push(row.name);
    }
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }

  ui.notifications?.info(`Targeted demo ready: ${results.join(', ')} (${CONFIG.TARGET}). Drag onto the user → target a token → [Use].`);
  console.log('%c[targeted-demo] done', 'color:#5cf;font-weight:bold', results);
})();
