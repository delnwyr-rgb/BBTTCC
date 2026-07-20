// Bad Eden — Dump live structured data for the items-pack GAP items (READ-ONLY)
// ─────────────────────────────────────────────────────────────────────────────
// surface-mechanics couldn't auto-fill these because they carry no structured
// magnitude. Before authoring numbers we need to SEE their current live state
// (repo packs strip flags). This writes a compact snapshot of each named item
// to a journal "⚙️ Gap Items — Live Dump" — export that and send it back.
//
// WRITES NOTHING to items. Only creates/updates one journal entry.
// Edit NAMES if you want a different set. Missing names are reported.
// ─────────────────────────────────────────────────────────────────────────────

const PACK_ID = "bbttcc-master-content.items";

const NAMES = [
  // ── HIGH — usable consumables, no consume.effects ──
  "Antidote Cartridge", "Discount Summoning Circle (10% off)", "Gene-Cleanse Serum",
  "Gene-Purge Infusion", "Memory Restorative", "Self-Wrapping Sandwich",
  "S'narchy Burger Special Sauce (Sealed Packet, Pre-Fall)", "The Apologizing Burger",
  "Witness-Decoy Pin",
  // ── MED — prose, no magnitudes ──
  "Whataburger Coupon, Unredeemed (Vintage)", "Witness Receipt",
  // ── LOW — items-pack gear/armor/feat lacking structured numbers ──
  "Abacus Gauntlet", "Anchor of the Known", "Apex Hex-Engine", "Archivist's Spectacles",
  "Audit Oversight Module", "Beacon Spire", "Blessed Blockbuster Membership Card",
  "Cloak of Null Profile", "Confession Crystal", "Crowd-Calmer Beacon", "Dream-Cache Regulator",
  "Ego‑Dragon Scale Aegis", "Eldritch Aura", "Filtermask Mk II", "Geiger Familiar Drone",
  "Glowstick of the Ancients", "Grapnel Spool", "Hex Boots", "Hex Compass",
  "Hex-Bound Garrison Plate", "Hex-Script Tinder Box", "Horizon Courier Pack", "Hunter Pen",
  "Lantern of Unforgotten Light", "Lens of Tikkun", "Mounted Forge", "Neon Spirit Armor",
  "Oath-Anchor Stone", "Phase 2 Surge Burst", "Phase Cloak", "Prayer-Resin Censer",
  "Pre-Fall Comm Bead (paired)", "Pre-Fall Scanner", "Pre-Fall Transmitter",
  "Proselyte Recon Drone", "Proselytizer 'Eye of Ezekiel'", "Quartermaster Dispenser",
  "Quipu Ledger Strap", "Rad Suit (Mk I)", "Rad Suit (Mk II)", "Rad Suit (Mk III)",
  "Rad‑Bloom Injector", "Radcloth Hood", "Reactor Shield Cape", "Reinforced Plating",
  "Repair Bay", "Rust-Ooze Solvent Vial", "Salvager's Crown", "Scavenged Insight (Soul) (Soul)",
  "Scrapwork Toolkit", "Scrubber Harness", "Sensor Suite", "Sephirotic Anchor",
  "Sephirotic Lens", "Septlight Lantern", "Sigil of Quiet Crossings", "Snack Machine Familiar",
  "Spark‑Tuned Rosary", "Stabilizer Patch", "Terraformer Ampule", "Tesseract Map",
  "Threshold Bell, Hand-Sized", "Unicorn Ramming Module", "Valhauler Pulsar Core",
  "Veilbreaker Mantle", "Vow-Bone Stamp", "Vow-Bound Cuffs", "Vow-Bound Forge Core",
  "War Tower Teeth Halo", "Wardstone of Gevurah", "Witness-Glass Scope", "Wrath Resistance",
  "Yesodic Sigil of the Hearthward",
];

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error(`Pack not found: ${PACK_ID}`);
  const docs = await pack.getDocuments();
  const byName = new Map(docs.map(d => [d.name, d]));

  const plain = (h) => String(h ?? "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const snap = [];
  const missing = [];
  for (const name of NAMES) {
    const d = byName.get(name);
    if (!d) { missing.push(name); continue; }
    const sys = d.system ?? {};
    const rfi = d.flags?.fourththing?.rfi?.item ?? {};
    const grants = d.flags?.fourththing?.grants ?? rfi.grants ?? null;
    const desc = plain(sys.description?.value);
    snap.push({
      name: d.name,
      type: d.type,
      tier: rfi.tier ?? null,
      frame: rfi.frame ?? null,
      origin: rfi.origin ?? null,
      bound: rfi.bound ?? null,
      slot: sys.slot ?? null,
      armorSkill: sys.armorSkill ?? null,
      guard: sys.guardBonus ?? null,
      evasion: sys.evasionBonus ?? null,
      resolve: sys.resolveBonus ?? null,
      resistances: sys.resistances ?? null,
      grants,
      charges: rfi.charges ?? null,
      consume: rfi.consume ?? null,
      upkeep: rfi.upkeep ?? null,
      uses: sys.uses ?? null,
      price: rfi.price ?? null,
      tags: sys.tags ?? null,
      signature: rfi.signature ?? null,
      descLen: desc.length,
      desc: desc.slice(0, 320),
    });
  }

  const json = JSON.stringify({ found: snap.length, missing, items: snap }, null, 2);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<h2>⚙️ Gap Items — Live Dump</h2><p>Found ${snap.length} / ${NAMES.length}`
    + (missing.length ? `; missing ${missing.length}` : "") + `. Export this entry and send it back.</p>`
    + `<pre style="white-space:pre-wrap;font-size:11px">${esc(json)}</pre>`;

  const jname = "⚙️ Gap Items — Live Dump";
  const existing = game.journal.getName(jname);
  if (existing) {
    const page = existing.pages.contents[0];
    if (page) await page.update({ "text.content": html });
    else await existing.createEmbeddedDocuments("JournalEntryPage", [{ name: "Dump", type: "text", text: { content: html, format: 1 } }]);
  } else {
    await JournalEntry.create({ name: jname, pages: [{ name: "Dump", type: "text", text: { content: html, format: 1 } }] });
  }

  console.log("[dump-gap-items] found", snap.length, "missing", missing);
  console.table(snap.map(s => ({ name: s.name, type: s.type, tier: s.tier, frame: s.frame, slot: s.slot, guard: s.guard, res: Array.isArray(s.resistances) ? s.resistances.join(",") : s.resistances, charges: s.charges, consumeEffects: s.consume?.effects?.length ?? 0, descLen: s.descLen })));
  ui.notifications.info(`Gap dump: ${snap.length} found, ${missing.length} missing. See journal "${jname}" → export it.`);
})();
