/*
 * patch-gullywasher-booze-2026-11-11.macro.js — Dave (2026-11-11): the Gullywasher sells drinks.
 *   "We. Would like to buy BOOZE. Please." replaces "What's the house protocol? · Economy DC 14" (no check), and Gully's answer
 *   (fixit_gullywasher_choice_3) takes Dave's text and opens a new market, The Gullywasher — switched on while the party is there,
 *   off again at turn end (openMarket activate + closeOnTurnEnd). The old answer (the Gate's mood / tasting flight) was a leftover
 *   from an earlier draft — the Fixit Leygate isn't malfunctioning — so it goes, and the two "points to the Confluence" beats lose
 *   the line that quoted it. The house-protocol fail beat (fixit_gullywasher_choice_3_fail) is unreachable now and kept.
 *
 *   Drinks (world Items, folder "The Gullywasher — Drinks"; T1 consumables, 10 Economy marks), system consume kind "drink":
 *     Gully's Potency Washer   Violence +1d4, Mind −same
 *     Gully's Celerity Washer  Intrigue +1d4, Soul −same
 *     Gully's Health Tonic     Body +1d4, Presence −same
 *     Jackalope Wine           Intrigue +2
 *   Rolled once on drinking; the mental faculty stops at 0; one drink at a time (a new one replaces the last); ends with the
 *   scene (Scene Break / combat end).
 * Ember Bad Eden. globalThis.__boozeDry = false applies; else dry run. Idempotent (items/vendor/catalog matched by name).
 */
(async () => {
  const DRY_RUN = globalThis.__boozeDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const get = (id) => { const b = beats.find(x => x.id === id); if (!b) throw new Error(id + " missing"); return b; };

  // ── beats ──
  const w = get("fixit_gullywasher_welcome");
  const q = (w.choices || []).find(x => x.next === "fixit_gullywasher_choice_3");
  if (!q) throw new Error("house-protocol choice missing");
  const LABEL = "We. Would like to buy BOOZE. Please.";
  if (q.label !== LABEL || q.checkStat || q.failNext) {
    Object.assign(q, { label: LABEL, description: "", checkStat: "", checkDC: 0, failNext: "" });
    report.changed.push("welcome: booze line, no check");
  }
  const a = get("fixit_gullywasher_choice_3");
  const TEXT = "“Right to the point!” he says.\n\nHe then taps the chalkboard, where under POETRY WEDS is a small menu of exquisitely curated liquid methods of altering your consciousness.";
  if (a.description !== TEXT) { a.description = TEXT; report.changed.push("answer: Dave's text"); }
  if (a.label !== "Furrier's Fixit Farm — The Gullywasher, Booze") { a.label = "Furrier's Fixit Farm — The Gullywasher, Booze"; report.changed.push("answer: label"); }
  const OM = { vendorName: "The Gullywasher", activate: true, closeOnTurnEnd: true };
  if (JSON.stringify(a.worldEffects?.openMarket) !== JSON.stringify(OM)) { a.worldEffects = { ...(a.worldEffects || {}), openMarket: OM }; report.changed.push("answer: opens the Gullywasher market"); }
  const FLIGHT = "Anyone who ordered the flight heard me say the Gate remembers something incorrectly. I was being polite. The truth is uglier and simpler: ";
  for (const id of ["gullywasher_dougan_points_to_confluence", "gullywasher_gully_points_to_confluence"]) {
    const b = get(id);
    if (String(b.description).includes(FLIGHT)) { b.description = b.description.replace(FLIGHT, "The truth is ugly and simple: "); report.changed.push(id + ": flight line gone"); }
  }

  // ── items ──
  const DRINKS = [
    { name: "Gully's Potency Washer", img: "icons/consumables/drinks/alcohol-spirits-bottle-blue.webp", up: "violence", down: "mind", formula: "1d4",
      blurb: "Tastes like a dare. Hits like one.", text: "Violence +1d4, Mind −the same (never below 0), until the scene ends." },
    { name: "Gully's Celerity Washer", img: "icons/consumables/drinks/alcohol-spirits-bottle-green.webp", up: "intrigue", down: "soul", formula: "1d4",
      blurb: "Quick on the tongue, quicker on the feet.", text: "Intrigue +1d4, Soul −the same (never below 0), until the scene ends." },
    { name: "Gully's Health Tonic", img: "icons/consumables/drinks/tea-jug-glowing-brown-pink.webp", up: "body", down: "presence", formula: "1d4",
      blurb: "Puts hair on your chest and a little grease in your smile.", text: "Body +1d4, Presence −the same (never below 0), until the scene ends." },
    { name: "Jackalope Wine", img: "icons/consumables/drinks/wine-amphora-clay-pink.webp", up: "intrigue", down: null, formula: "2",
      blurb: "Mediocre and earnest. Somehow it helps.", text: "Intrigue +2 until the scene ends." }
  ];
  const FOLDER = "The Gullywasher — Drinks";
  let folder = game.folders.find(f => f.type === "Item" && f.name === FOLDER);
  if (!folder) { report.changed.push("folder"); if (!DRY_RUN) folder = await Folder.create({ name: FOLDER, type: "Item" }); }
  const itemIds = {};
  for (const d of DRINKS) {
    const eff = { kind: "drink", up: d.up, formula: d.formula, slot: "drink", duration: "scene", ...(d.down ? { down: d.down } : {}) };
    const data = {
      name: d.name, type: "gear", img: d.img, folder: folder?.id ?? null,
      system: { slot: "consumable", category: "gear", quantity: 1, tags: ["consumable", "tier-i", "drink"],
        description: { value: `<p>${d.blurb}</p><hr><p><strong>⚙️ On use:</strong> ${d.text} One drink at a time — a new one replaces the last.</p><p><strong>Charges:</strong> 1 (consumed on use) · <strong>Target:</strong> Self · <strong>Tier:</strong> I · <strong>Cost:</strong> 10 Economy marks</p>` } },
      flags: { fourththing: { rfi: { item: { tier: "I", frame: "consumable", reach: "self", bound: "free", origin: "bought", charges: 1, chargesMax: 1,
        consume: { effects: [eff], decrement: true, target: "self" },
        price: { marks: 10, currency: "economy", gmOverride: false, notes: "Gullywasher drink (Dave 2026-11-11)", bound: "free" } } } } }
    };
    const have = game.items.find(i => i.name === d.name && i.folder?.name === FOLDER);
    if (have) { itemIds[d.name] = have.id; if (!DRY_RUN) await have.update({ img: data.img, system: data.system, flags: data.flags }); continue; }
    report.changed.push("item: " + d.name);
    if (!DRY_RUN) itemIds[d.name] = (await Item.create(data)).id;
  }

  // ── vendor + catalog ──
  const VID = "vendor-gullywasher";
  const vendors = foundry.utils.deepClone(game.settings.get("bbttcc-market", "vendors") || []);
  if (!vendors.some(v => v.id === VID)) {
    vendors.push({ id: VID, name: "The Gullywasher", blurb: "Exquisitely curated liquid methods of altering your consciousness.", tags: ["Furrier's Fixit Farm", "Gully", "Drinks"], active: false, factionId: "" });
    report.changed.push("vendor");
    if (!DRY_RUN) await game.settings.set("bbttcc-market", "vendors", vendors);
  }
  const cat = foundry.utils.deepClone(game.settings.get("bbttcc-market", "catalog") || []);
  let catChanged = false;
  for (const d of DRINKS) {
    if (cat.some(e => e.vendorId === VID && e.name === d.name)) continue;
    report.changed.push("catalog: " + d.name);
    cat.push({ id: "gully-" + d.name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""), vendorId: VID, kind: "gear", name: d.name, blurb: d.blurb,
      uuid: itemIds[d.name] ? `Item.${itemIds[d.name]}` : "(created on apply)", cost: { economy: 10 } });
    catChanged = true;
  }
  if (!DRY_RUN && catChanged) await game.settings.set("bbttcc-market", "catalog", cat);

  if (!DRY_RUN && report.changed.some(x => /^(welcome|answer|gullywasher_)/.test(x))) await C.saveCampaign(cid, { ...c, beats });
  console.log("BOOZE " + JSON.stringify(report));
  return report;
})();
