/* patch-muster-contracts-only-2026-10-22.macro.js — the Muster sells CONTRACTS only for now (Dave 2026-10-22:
 * "Let's remove the creatures and just leave the contracts for now").
 * The 2026-09-04 bestiary seed (tools/seed-bestiary-hire-catalog.macro.js) listed every mortal / wild / Pre-Fall monster
 * at the Muster, story foes and bosses included. This takes every kind:"actor" entry off the-muster; contracts stay.
 * The removed entries are RETURNED in full (backup) so a keep-list can be restored later by pasting them back.
 * Idempotent; DRY_RUN default true. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MOD = "bbttcc-market";
  const VENDOR = "the-muster";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const raw = game.settings.get(MOD, "catalog") || [];
  const wasArray = Array.isArray(raw);
  const arr = JSON.parse(JSON.stringify(wasArray ? raw : Object.values(raw)));   // a TRUE copy
  const removed = arr.filter(e => e?.vendorId === VENDOR && e?.kind === "actor");
  const keep = arr.filter(e => !(e?.vendorId === VENDOR && e?.kind === "actor"));
  const contracts = keep.filter(e => e?.vendorId === VENDOR && e?.kind === "contract").length;

  const summary = `Muster contracts-only — ${removed.length} creature entr${removed.length === 1 ? "y" : "ies"} off, ${contracts} contract(s) stay${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log(summary + "\n" + removed.map(e => `✖ ${e.name}`).join("\n"));
  ui.notifications.info(summary);
  if (!DRY_RUN && removed.length) {
    let next = keep;
    if (!wasArray) { next = {}; for (const [k, v] of Object.entries(raw)) if (!(v?.vendorId === VENDOR && v?.kind === "actor")) next[k] = v; }
    await game.settings.set(MOD, "catalog", next);
  }
  return { dryRun: DRY_RUN, removed: removed.length, contracts, backup: removed };
})();
