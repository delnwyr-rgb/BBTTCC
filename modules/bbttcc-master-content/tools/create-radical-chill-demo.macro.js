// create-radical-chill-demo.macro.js — BBTTCC / fourththing (RFI)  [Bucket-B demo]
// ─────────────────────────────────────────────────────────────────────────────
// Authors ONE demo consumable that exercises BOTH halves of the Bucket-B on-use
// model, so you can validate the new On-Use sheet editor + the applyOnUse clone
// path end-to-end:
//
//   • INSTANT half  → flags.fourththing.rfi.item.consume.effects[] — a stress
//     restore the engine ROLLS and applies on [Use] (runConsumeEffects).
//   • DURATIONAL half → an `applyOnUse` template Active Effect on the item:
//     "Radical Chill (1 hr)" = resist cold/energy for 3600s. On use the engine
//     CLONES it onto the user (origin = item.uuid), carrying its duration. The
//     resist payload is read by ftComputeDefenses Phase C via
//     flags.fourththing.manifestationEffect.resists.
//
// Idempotent: re-running updates the existing item + replaces the demo AE
// (matched by name + applyOnUse flag). DRY_RUN previews without writing.
//
// TARGET:'world' drops it in the Items sidebar (easiest to drag onto an actor
// for testing). TARGET:'pack' lands it in bbttcc-master-content.items beside the
// other RFI consumables. To validate the clone: run this → drag the item onto an
// actor → [Use] it → stress restore rolls in chat AND a "Radical Chill (1 hr)"
// effect lands on the actor with a 1-hour duration (resist cold/energy shows on
// the sheet's defenses). The On-Use sheet editor lets you edit both halves in UI.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  'use strict';
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  const CONFIG = {
    DRY_RUN: false,                          // flip true to preview without writing
    TARGET:  'world',                        // 'world' (Items sidebar) | 'pack'
    PACK_ID: 'bbttcc-master-content.items',
    NAME:    'Potion of Radical Chill',
    IMG:     'icons/svg/frozen.svg',
  };

  const ITEM = {
    tier: 'II', charges: 1,
    signature: 'The world stops burning long enough to think.',
    lore: 'A vial of cryo-tincture brewed in a sept-vault freezer. One pull and the body drops a register — composure floods back and the cold rolls in like armor.',
    // INSTANT half — rolled + applied on [Use]. Stress is a composure pool:
    // add = restore (Calmpact Vial / Communion Tea), subtract = cost (Surgeon's Pact).
    consume: { effects: [{ kind: 'track', track: 'stress', op: 'add', formula: '1d4+1' }], decrement: true },
  };
  // DURATIONAL half — cloned onto the user on use. The resist payload lives in
  // NATIVE change rows (key flags.fourththing.grant.resists, mode ADD, value =
  // comma-separated damage types) so the AE shows + edits in the AE Changes tab
  // instead of rendering "empty". ftComputeDefenses reads these change VALUES on
  // the actor (same declarative key as the Bucket-A item grants).
  const AE = {
    name: 'Radical Chill (1 hr)',
    img:  'icons/svg/frozen.svg',
    duration: { seconds: 3600 },
    changes: [
      { key: 'flags.fourththing.grant.resists', mode: 2, value: 'cold,energy', priority: 20 },
    ],
  };

  const RfiItems = game.fourththing?.items;
  if (!RfiItems) return ui.notifications?.error("RFI items API not available (is the world the fourththing system?).");

  const defaults = RfiItems.defaults({ type: 'gear', system: {}, getFlag: () => null });
  const rfiFlag = {
    ...defaults,
    tier:      ITEM.tier,
    frame:     'consumable',
    origin:    'looted',
    signature: ITEM.signature,
    lore:      ITEM.lore,
    upkeep:    { mode: 'passive', per: 'none' },
    charges:   ITEM.charges,
    consume:   ITEM.consume,
  };
  const itemData = {
    name:   CONFIG.NAME,
    type:   'gear',
    img:    CONFIG.IMG,
    system: { slot: 'consumable', tags: ['consumable', `tier-${ITEM.tier.toLowerCase()}`] },
    flags:  { fourththing: { rfi: { item: rfiFlag } } },
  };
  const aeData = {
    name: AE.name, icon: AE.img, img: AE.img,
    transfer: false, disabled: false,
    duration: AE.duration ?? {},
    changes:  AE.changes ?? [],
    flags: { fourththing: { applyOnUse: true } },
  };

  // ── Locate any existing copy (idempotent) ──────────────────────────────────
  const inPack = CONFIG.TARGET === 'pack';
  const pack   = inPack ? game.packs.get(CONFIG.PACK_ID) : null;
  if (inPack && !pack) return ui.notifications?.error(`Pack not found: ${CONFIG.PACK_ID}`);
  let existing = null;
  if (inPack) {
    const docs = await pack.getDocuments();
    existing = docs.find(d => d.name === CONFIG.NAME) ?? null;
  } else {
    existing = game.items.find(i => i.name === CONFIG.NAME) ?? null;
  }

  if (CONFIG.DRY_RUN) {
    console.log('%c[radical-chill] DRY RUN', 'color:#5cf;font-weight:bold',
      { target: CONFIG.TARGET, exists: !!existing, itemData, aeData });
    return ui.notifications?.info(`DRY RUN — would ${existing ? 'update' : 'create'} "${CONFIG.NAME}" (${CONFIG.TARGET}) + author its applyOnUse AE. Flip DRY_RUN to apply.`);
  }

  // ── Create or update the item ───────────────────────────────────────────────
  let item;
  const wasLocked = inPack && pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  try {
    if (existing) {
      await existing.update({ type: 'gear', img: CONFIG.IMG, system: itemData.system, 'flags.fourththing.rfi.item': rfiFlag });
      item = existing;
    } else {
      item = await Item.create(itemData, inPack ? { pack: CONFIG.PACK_ID } : {});
    }
    // Replace any prior demo AE, then author a fresh one.
    const stale = item.effects.filter(e => e.name === AE.name && e.getFlag?.('fourththing', 'applyOnUse') === true).map(e => e.id);
    if (stale.length) await item.deleteEmbeddedDocuments('ActiveEffect', stale);
    await item.createEmbeddedDocuments('ActiveEffect', [aeData]);
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }

  ui.notifications?.info(`"${CONFIG.NAME}" ready (${CONFIG.TARGET}${inPack ? ` — ${CONFIG.PACK_ID}` : ' — Items sidebar'}). Drag onto an actor → [Use]: stress restore rolls + "Radical Chill (1 hr)" clones onto the user.`);
  console.log('%c[radical-chill] done', 'color:#5cf;font-weight:bold', { uuid: item.uuid });
})();
