/* BBTTCC — Courtly Intrigue Secrets seeder (Phase C)
 *
 * Spec: bbttcc-raid/COURTLY_INTRIGUE_SPEC.md §4.3
 * Pairs with: bbttcc-raid/scripts/raid-courtly.secrets.api.js (effectKey handlers)
 *
 * One-shot macro. Idempotent — skips secrets whose `name` already exists in
 * the pack. Run from Foundry: paste into a Script Macro and execute.
 *
 * Seeds 3 sample secrets covering representative effectKeys so Phase C is
 * smoke-testable end-to-end before Phase D anytimes are wired:
 *   - "Cabinet Whisper"     → rollPlus2
 *   - "Compromising Letter" → influenceDmg2
 *   - "Royal Pardon"        → clearScandal
 *
 * Phase D will add more secrets using these as templates. Pack is local
 * per Foundry instance — must be run on each instance separately per
 * [[lightsail-sync-workflow-and-lessons]].
 */
(async () => {
  const PACK_ID = "bbttcc-master-content.courtly-secrets";
  const MOD_R = "bbttcc-raid";
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error?.(`Pack ${PACK_ID} not found. Reload Foundry after module.json update.`);
  if (pack.locked) return ui.notifications?.error?.(`Pack ${PACK_ID} is locked. Unlock in Compendium settings, then re-run.`);

  const SECRETS = [
    {
      name: "Cabinet Whisper",
      img: "icons/skills/social/diplomacy-handshake.webp",
      effectKey: "rollPlus2",
      desc: "<p><strong>Cabinet Whisper.</strong> A choice morsel of intel from a sympathetic minister, delivered just before the moment of need.</p><p><em>Play:</em> queue +2 to your next courtly exchange roll.</p>"
    },
    {
      name: "Compromising Letter",
      img: "icons/sundries/scrolls/scroll-bound-blue.webp",
      effectKey: "influenceDmg2",
      desc: "<p><strong>Compromising Letter.</strong> A private correspondence — leaked at exactly the wrong moment for someone, exactly the right moment for you.</p><p><em>Play:</em> deal 2 Influence damage to your opponent outside an exchange.</p>"
    },
    {
      name: "Royal Pardon",
      img: "icons/skills/trades/academics-merchant-scribe.webp",
      effectKey: "clearScandal",
      desc: "<p><strong>Royal Pardon.</strong> A signed favor from a higher patron, granted in advance of a rumor's bloom.</p><p><em>Play:</em> clear your own Scandal flag (if any).</p>"
    }
  ];

  // Inventory existing — skip names already authored.
  const existing = await pack.getDocuments();
  const existingNames = new Set(existing.map(d => d.name));
  const toCreate = SECRETS.filter(s => !existingNames.has(s.name));

  if (toCreate.length === 0) {
    return ui.notifications?.info?.(`All ${SECRETS.length} sample secrets already present in ${PACK_ID}. Nothing to seed.`);
  }

  const docs = toCreate.map(s => ({
    name: s.name,
    type: "feat",
    img: s.img,
    system: { description: { value: s.desc, chat: "", unidentified: "" } },
    flags: {
      [MOD_R]: {
        secret: {
          effectKey: s.effectKey,
          // acquisition stamped at addSecret() time on the holder; template stays neutral
          acquisition: "template",
          acquiredAt: 0,
          raidId: ""
        }
      }
    }
  }));

  await Item.createDocuments(docs, { pack: PACK_ID });
  ui.notifications?.info?.(`Seeded ${toCreate.length}/${SECRETS.length} courtly secrets in ${PACK_ID}.`);
  console.log("[bbttcc-courtly-secrets:seeder]", { seeded: toCreate.map(s => s.name), skipped: SECRETS.length - toCreate.length });
})();
