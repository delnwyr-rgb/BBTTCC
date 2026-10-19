/* seed-muster-contracts-2026-10-18.macro.js — THE MUSTER SELLS CONTRACTS (ruling 15, Dave 2026-10-17: crews and
 *  associations are HIRED; "the Muster becomes a place in AG to recruit crews").
 *
 *  Adds one `kind: "contract"` catalog entry per Crew Type and per Occult Association (the BASE compendium doc,
 *  never the "(Tier N)" items) under the existing vendor "The Muster" (id `the-muster`, seeded by
 *  seed-bestiary-hire-catalog for beast / raider hires — same stall, same Hire tab). A contract runs CONTRACT_TURNS
 *  world turns and sets the steward's crew / occult slot for that long (modules/bbttcc-market/scripts/contracts.js).
 *
 *  Price = CONTRACT_PRICE marks (economy), Tier I / common so it sits inside a Tier 0–1 horizon. ✅ 3 turns / 45 marks BLESSED by Dave 2026-10-18.
 *  Idempotent: an entry whose contract.docId is already listed under the vendor is skipped. DRY_RUN default true. GM only.
 *  Marker: [MUSTER-CONTRACTS-2026-10-18]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MARKET = "bbttcc-market";
  const CONTRACT_TURNS = 3;
  const CONTRACT_PRICE = 45;
  const VENDOR = { id: "the-muster", name: "The Muster", blurb: "Where the road crews, beast-handlers, salvage-tinkers and the quieter associations wait for a banner to pay them. Hire by the turn; they ride with you until the contract runs out.", tags: ["hire", "crew", "association", "allesh_gilliam"] };
  const FAMILIES = {
    crew:   { pack: "bbttcc-character-options.crew-types",         prefix: /^Crew Type:\s*/i,          label: "Crew" },
    occult: { pack: "bbttcc-character-options.occult-associations", prefix: /^Occult Association:\s*/i, label: "Association" },
  };
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const vendors = foundry.utils.deepClone(game.settings.get(MARKET, "vendors") || []);
  const catalog = foundry.utils.deepClone(game.settings.get(MARKET, "catalog") || []);
  const makeId = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
  const report = []; let changes = 0;

  let vendor = vendors.find(v => v.id === VENDOR.id || v.name === VENDOR.name);
  if (!vendor) { vendor = { ...VENDOR, active: false, factionId: "" }; vendors.push(vendor); changes++; report.push("✚ vendor The Muster (inactive until the bandit road is cleared)"); }
  else {
    if (vendor.blurb !== VENDOR.blurb) { vendor.blurb = VENDOR.blurb; changes++; report.push("✚ vendor blurb refreshed"); }
    report.push(`· vendor ${vendor.name} (${vendor.id}) active=${vendor.active === true}`);
  }
  const listed = new Set(catalog.filter(e => e.vendorId === vendor.id && e.kind === "contract").map(e => String(e.contract?.docId || "")));

  for (const [family, fam] of Object.entries(FAMILIES)) {
    const pack = game.packs.get(fam.pack);
    if (!pack) { report.push(`⚠ pack ${fam.pack} not found`); continue; }
    const index = await pack.getIndex({ fields: ["type", "name", "system.identifier", "flags.bbttcc-character-options.option", "img"] });
    const bases = index.filter(e => fam.prefix.test(String(e.name || "")) && !/\(Tier\s*\d+\)\s*$/i.test(String(e.name || "")) && ["feat", "feature"].includes(String(e.type || "")));
    report.push(`· ${fam.label}s in ${fam.pack}: ${bases.length} base doc(s)`);
    for (const e of bases) {
      const display = String(e.name).replace(fam.prefix, "").trim();
      if (listed.has(e._id)) { report.push(`  · ok ${display}`); continue; }
      const opt = foundry.utils.getProperty(e, "flags.bbttcc-character-options.option") || {};
      catalog.push({
        id: makeId("entry"), vendorId: vendor.id, kind: "contract",
        name: `${display} — ${fam.label.toLowerCase()} contract`,
        blurb: `${fam.label} · ${CONTRACT_TURNS} turns. Their maneuvers, bonuses and people ride with the steward who signs. One ${fam.label.toLowerCase()} at a time.${opt.key ? ` (${opt.key})` : ""}`,
        cost: { economy: CONTRACT_PRICE }, tier: 1, rarity: "common", img: e.img || "",
        contract: { family, docId: e._id, pack: fam.pack, turns: CONTRACT_TURNS }
      });
      listed.add(e._id); changes++; report.push(`  ✚ ${display}`);
    }
  }

  console.log(`[seed-muster-contracts] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Muster contracts DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Muster contracts: nothing to do.");
  await game.settings.set(MARKET, "vendors", vendors);
  await game.settings.set(MARKET, "catalog", catalog);
  ui.notifications.info(`Muster contracts APPLIED: ${changes} change(s).`);
})();
