/**
 * seed-long-market-facilities-2026-10-28.macro.js — Dave, 10-28 (the economy sim): "Facilities as a real Domain order."
 * The sim found Settled hexes had nothing to BECOME and the late arc had nothing to spend on; the only facility for sale
 * (Bunker (Small), 40) sat at Furrier's Fixit Farm, an inactive vendor. This adds five facilities to THE LONG MARKET
 * (Allesh-Gilliam, active in Act 2). Each is built on a Settled hex the Domain holds (minIntegration 5 — checked at
 * purchase, one facility per hex) and earns marks every month through the facility turn effects (autoApplyTurnEffects):
 *
 *   Watchtower    60  · +5  Soft Power / month · defenders +1 raid DC
 *   Shrine        75  · +6  Faith / month
 *   Workshop      90  · +8  Economy / month
 *   Meeting Hall 100  · +6  Diplomacy / month
 *   Supply Depot 120  · +10 Logistics / month
 *
 * Prices sit above most pools' caps on purpose: they're paid spread across pools (market.js _spreadPayPlan) — the
 * other half of the sim fix. Payback ≈ 12 months: a facility bought in Act 2 has paid for itself by the finale.
 * Idempotent by entry id (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-market";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const raw = game.settings.get(NS, "catalog");
  const wasStr = typeof raw === "string";
  const cat = JSON.parse(wasStr ? raw : JSON.stringify(raw ?? []));
  if (!Array.isArray(cat)) return ui.notifications.error("Market catalog is not a list — nothing written.");
  const vendor = game.bbttcc?.api?.market?.listVendors?.().find(v => /long market/i.test(v.name || ""));
  if (!vendor) return ui.notifications.error("The Long Market vendor not found — nothing written.");

  const base = (facilityType, size, sdr, raid, travel = "") => ({
    version: "0.1", facilityType, tier: 1, size, structureDefenseRating: sdr, hitTrack: ["light", "heavy", "breached", "destroyed"],
    opModifiers: {}, raidBonuses: { defenderDcBonus: raid, attackerExtraOpCost: { violence: 0, logistics: 0 }, maxDefenderUnits: 1, notes: "" },
    travelEncounterEffects: { encounterTierAdjust: 0, hazardMitigation: [], description: travel },
    hazards: { radiation: 0, corruption: 0, instability: 0, notes: "" }, hexBinding: { notes: "" },
    integration: { autoApplyRaidBonuses: true, autoApplyTurnEffects: true, turnEffects: [], resolutionHooks: {} }
  });
  const fac = (id, name, cost, blurb, patch, key, delta, desc) => {
    patch.integration.turnEffects = [{ key, description: desc, opDelta: delta }];
    return { id, vendorId: vendor.id, kind: "facility", name, blurb, cost: { economy: cost }, buCost: 0, minIntegration: 5, facilityPatch: patch };
  };
  const WANT = [
    fac("long-market-facility-watchtower", "Watchtower", 60, "Somebody up high, all month, watching for you. Settled ground only. +5 Soft Power a month; defenders +1 raid DC.",
      base("watchtower", "small", 2, 1), "watchtower-presence", { softpower: 5 }, "People see the tower and remember whose ground this is. +5 Soft Power marks per month."),
    fac("long-market-facility-shrine", "Shrine", 75, "A quiet place that the hex starts keeping for itself. Settled ground only. +6 Faith a month.",
      base("shrine", "small", 1, 0), "shrine-devotion", { faith: 6 }, "Candles, offerings, people who come back. +6 Faith marks per month."),
    fac("long-market-facility-workshop", "Workshop", 90, "Benches, tools, and someone who knows what to do with salvage. Settled ground only. +8 Economy a month.",
      base("workshop", "medium", 2, 0), "workshop-output", { economy: 8 }, "Salvage in, goods out. +8 Economy marks per month."),
    fac("long-market-facility-meeting-hall", "Meeting Hall", 100, "Somewhere for the neighbours to argue indoors. Settled ground only. +6 Diplomacy a month.",
      base("hall", "medium", 2, 0), "hall-council", { diplomacy: 6 }, "Disputes settled under a roof instead of over a fence. +6 Diplomacy marks per month."),
    fac("long-market-facility-supply-depot", "Supply Depot", 120, "Sheds, carts, a ledger that balances. Settled ground only. +10 Logistics a month.",
      base("depot", "large", 3, 0, "A stocked depot: parties setting out from this hex travel provisioned."), "depot-throughput", { logistics: 10 }, "Stores in, stores out, on schedule. +10 Logistics marks per month.")
  ];

  const report = []; let changes = 0;
  for (const e of WANT) {
    if (cat.some(x => x?.id === e.id)) continue;
    cat.push(e); changes++; report.push(`✚ ${e.name} — ${e.cost.economy} marks · ${JSON.stringify(e.facilityPatch.integration.turnEffects[0].opDelta)}/month (${vendor.name})`);
  }
  console.log(`[long market facilities 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  globalThis.__lmFacilities = { dry: DRY_RUN, changes, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([wasStr ? raw : JSON.stringify(raw)], `backup-market-catalog-pre-facilities-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "catalog", wasStr ? JSON.stringify(cat) : cat);
  ui.notifications.info(`Applied ${changes} change(s) — five facilities at ${vendor.name}.`);
})();
