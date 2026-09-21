// Bad Eden — Seed the RECIPE BOOKS (who knows how to make what)
// ─────────────────────────────────────────────────────────────────────────────
// Owner ruling 2026-09-20: "everyone has everything — we could use some variety." The Forge now lists only recipes a
// steward KNOWS: the COMMON book, their faction's book, their own (system setting `fourththing.recipeBook`; beats teach
// through worldEffects.recipeGrants; the GM can Teach from the Forge). This deals the opening hands. Idempotent — adds
// what's missing, never removes (REPLACE=true rewrites the book from this table). Dry list, then a confirm dialog.
//
// Recipes are named by ITEM NAME (slugged). Factions are found by name in the world. A name that matches no faction
// is reported and skipped. STORY entries are NOT seeded — they're taught by beats (the Mall, the Seal, the Vault…).
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const R = game.fourththing?.craft?.recipes; if (!R?.learn) return ui.notifications?.error("Recipe book API not ready (hard reload after deploying the system).");
  const REPLACE = false;

  const COMMON = ["Combat Knife", "Hand Axe", "Maul", "Sap", "Slug Pistol", "Hunting Rifle", "Bolt-Driver", "Pressed Buckler",
    "Patrolman's Plate", "Worker's Leathers", "Drifter's Weave", "Initiate's Robe", "Bulwark Hauberk", "Warded Wayfarer's Shroud",
    "Hex-Script Tinder Box", "Self-Wrapping Sandwich", "Cassette of the Long Drive", "Septlight Lantern"];

  const BOOKS = {
    "The Errata Society": ["Witness Receipt", "Postal Worker's Last Route Map", "Vow-Bone Stamp", "Pact-Pen Stylus", "Jackalope Haggler's Ledger",
      "Witness-Glass Scope", "Witness-Decoy Pin", "Confession Crystal", "Prayer-Resin Censer", "Sigil of Quiet Crossings"],
    "Sweet Release": ["Septhide Vestments", "Cassock of Quiet Hours", "Sept-Hush Amulet", "Sept-Blessed Aegis", "Threshold Bell, Hand-Sized",
      "Vow-Bound Cuffs", "Oath-Anchor Stone", "Marrow Pact Tonic", "Vestments of the Standing Vow", "Hexstrider Cleats"],
    "Allesh Gilliam": ["Hex-Warded Duster", "Hex-Script Pistol", "Laser Pistol, Rad", "Wardiron Targe", "Steelweave Hauberk", "Oathkeeper's Bulwark",
      "Hex-Carved Plate", "Mercy Driver", "Brass Knife of the Quiet Word"],
    "Lyrenn": ["Hex-Wound Coffee Thermos", "Hexbane Surplice", "Singing Hammer", "Null-Field Tower Shield", "Quantum Staff"],
    "Khezek Tor": ["Yesodic Edge", "Yesodic Plating", "Yesodic Hammer of the First Word", "Yesodic Gate Frame", "Yesodic Memory Lens",
      "Yesodic Sigil of the Hearthward", "Yesodium Tongue-Stud", "Soulbound Hex-Reaver", "Frikkin' Laser Blade Saber", "Laser Rifle, Rad", "Gilded Atonement Blade"],
    "Furrier's Fixit Farm": ["Hex-Tuner Cassette Player", "Pre-Fall Comm Bead (paired)", "Pre-Fall Scanner", "Pre-Fall Transmitter", "Static Aegis",
      "Schrödinger's Cudgel", "Pocket Sun (Battery Powered)", "Sephirotic Lens", "Dream-Cache Regulator", "Apex Hex-Engine", "Vow-Bound Forge Core"]
  };
  // Taught by the story, never dealt: the Crown Mall's wares, the finale's mantles, the vault's pavise.
  const STORY = ["Apology Knife, Mass-Produced", "Boots That Knew Each Other Once", "Buc-ee's Beaver Talisman (Tarnished Gold)", "Foam Finger (Structural)",
    "Pre-Shattering Concert T-Shirt (XL)", "STAY IN MILK Embroidered Tea Towel", "S'narchy Burger Mascot's Final Smile", "S'narchy Burger Spatula of +1 Sass",
    "S'narchy Burger Special Sauce (Sealed Packet, Pre-Fall)", "Scarf That Was a Cat (Probably)", "Texas-Shaped Belt Buckle of Mild Authority", "The Apologizing Burger",
    "The Last Working Vending Machine in Bad Eden (Portable Kit)", "Whataburger Coupon, Unredeemed (Vintage)", "Aegis of the Final Door", "Mantle of Witnessed Silence",
    "Mantle of the Unbroken Circle", "Mirrorface Pavise"];

  // sanity: every named recipe exists somewhere with a materialOf
  const known = new Map();
  for (const it of game.items.contents) if ((game.fourththing.craft.recipeFor(it) || []).length) known.set(R.slugOf(it), it.name);
  for (const pack of game.packs) { if (pack.documentName !== "Item") continue; for (const it of await pack.getDocuments()) if ((game.fourththing.craft.recipeFor(it) || []).length) known.set(R.slugOf(it), it.name); }
  const missing = [...COMMON, ...Object.values(BOOKS).flat(), ...STORY].filter(n => !known.has(R.slugOf(n)));
  const dealt = new Set([...COMMON, ...Object.values(BOOKS).flat(), ...STORY].map(R.slugOf));
  const undealt = [...known.entries()].filter(([s]) => !dealt.has(s)).map(([, n]) => n);

  const isFaction = a => !!a.flags?.["bbttcc-factions"]?.isFaction;
  const factionByName = n => game.actors.contents.find(a => isFaction(a) && a.name.trim().toLowerCase() === n.trim().toLowerCase());
  const book = R.book(); const plan = [];
  const add = (list, names) => names.map(R.slugOf).filter(s => known.has(s) && !list.includes(s));
  plan.push({ scope: "common", name: "everyone", add: add(REPLACE ? [] : book.common, COMMON) });
  const noFaction = [];
  for (const [fname, names] of Object.entries(BOOKS)) { const F = factionByName(fname); if (!F) { noFaction.push(fname); continue; } plan.push({ scope: "faction", id: F.id, name: F.name, add: add(REPLACE ? [] : (book.factions[F.id] || []), names) }); }

  console.group("[seed-recipe-books]");
  console.table(plan.map(p => ({ scope: p.scope, who: p.name, adds: p.add.length, recipes: p.add.join(", ") })));
  if (missing.length) console.warn("named recipes with NO item/recipe anywhere:", missing);
  if (noFaction.length) console.warn("factions not found in this world:", noFaction);
  console.log("recipes dealt to no one (story-taught or unassigned):", undealt);
  console.groupEnd();
  const total = plan.reduce((n, p) => n + p.add.length, 0);
  if (!total) return ui.notifications?.info("Recipe books: nothing to add.");
  const yes = await Dialog.confirm({ title: "Seed the recipe books", content: `<p><b>${total}</b> recipe(s) would be dealt across <b>${plan.length}</b> book(s) (table in the console).${missing.length ? `<br><small>${missing.length} named recipe(s) exist nowhere — skipped.</small>` : ""}${noFaction.length ? `<br><small>Factions not found: ${noFaction.join(", ")}.</small>` : ""}</p><p>Apply?</p>` });
  if (!yes) return;
  if (REPLACE) await R.setBook({ common: [], factions: {}, stewards: {} });
  for (const p of plan) if (p.add.length) await R.learn(p.add, { scope: p.scope, id: p.id || null });
  ui.notifications?.info(`Recipe books seeded — ${total} recipe(s) dealt.`);
})();
