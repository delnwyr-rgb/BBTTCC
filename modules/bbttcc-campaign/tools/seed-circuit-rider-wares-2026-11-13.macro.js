/*
 * seed-circuit-rider-wares-2026-11-13.macro.js — Dave (2026-11-13): "Let's come up with some cool unique add ons, weapons, etc,
 * that can be had here and nowhere else. Allies get a discount!" + "I love these items … make the control suit special, and have
 * it be a super rare balanced one, that is +3 to resolve and guard."
 *
 * 1. Nine world Items in the folder "Circuit Rider Wares" (marker flags.bbttcc-campaign.crWare = key), each cloned from a pack
 *    template of its kind and re-authored:
 *      stomper (rig frame II, mecha walker) · sidekick (rig frame I, hero suit) · hypercalipers (tool II, +2 Investigation AE)
 *      hoop (talisman II, once per scene: target gains Imposed) · control (body armor IV, FLAT +3 Guard +3 Resolve — armorFlat)
 *      toebonk (weapon II) · fist (weapon III) · polish (consumable I, ×3, clears Restrained) · anchor (rig system II)
 *    AUTOMATED (Dave 2026-11-13, "Let's go ahead and automate those items"): stomper rigFrame.walker (factions beforeTravel),
 *    hypercalipers consume measureReality, control consume parleyBonus (+ Equip beside Use), toe-bonk conditionalDamage vs
 *    construct/circuitborn (rigs count as construct), fist rfi.item.onCrit.hexDarkness, polish consume immunity, anchor
 *    rigGear.realityAnchor (system afterTravel dark-hex).
 * 2. Vendor "The Circuit Rider Camp" (id circuit-rider-camp, owned by the Circuit Riders — allies get 20% off, market.js), inactive
 *    until the camp opens it; nine catalog entries.
 * 3. Beat enc_circuit_riders_wares (openMarket, activate, closes at turn end) + "Browse the Riders’ wares" on the camp hub.
 * Ember Bad Eden. globalThis.__crWaresDry = false applies; else dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__crWaresDry !== false;
  const report = { DRY_RUN, changed: [] };
  const CR_ID = "RgpV6bx2Olk9Z4qW", VID = "circuit-rider-camp", MODC = "bbttcc-campaign";
  if (!game.actors.get(CR_ID)) throw new Error("Circuit Riders faction missing");
  const pack = game.packs.get("bbttcc-master-content.items"); const idx = await pack.getIndex();
  const tpl = async (name) => { const e = idx.find(x => x.name === name); if (!e) throw new Error("template missing: " + name); return (await pack.getDocument(e._id)).toObject(); };
  const P = (...t) => t.map(x => `<p>${x}</p>`).join("");

  const WARES = [
    { key: "stomper", template: "Power-Armor Frame", name: "Leggy-Pattern Stomper Frame", img: "icons/environment/settlement/watchtower-cliff.webp", tier: "II", price: 400,
      glance: "Rig frame · Mecha walker · 1 pilot + 2 weapons · rough terrain is no obstacle · Stomp",
      signature: "Built off the same bones as Legansus Tal. Smaller. Calmer. Probably.",
      desc: P("A walking war-frame patterned on Legansus Tal, scaled down for crews who want a giant robot that fits in a barn.", "<b>Walker.</b> Rough and broken ground does not slow it: a leg over rough land costs what open country costs.", "<b>Stomp.</b> The pilot's stomp lands on buildings and rigs like a ram."),
      rigFrame: { bracket: "mecha", baseIntegrity: 40, tierStep: 10, pilotMount: true, mobilityAllowed: ["mobile"], slots: { weapon: 2, system: 1, output: 0 },
        capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 1 }, engineer: { min: 0, max: 1 }, crew: { min: 0, max: 2 } },
        actions: { pilot: ["steer", "evasive", "stomp", "ram", "hold-position"], gunner: ["fire-weapon", "aimed-shot"], engineer: ["repair", "vent-heat"], crew: ["brace", "hold-on"] },
        travel: { speed: 3, range: 10 }, visualFrame: "open-corners", walker: true } },
    { key: "sidekick", template: "Power-Armor Frame", name: "Sidekick Frame", img: "icons/equipment/chest/breastplate-collared-steel-grey.webp", tier: "I", price: 200,
      glance: "Rig frame · Mecha · hero suit · 1 pilot + 1 weapon",
      signature: "Every hero needs one. Comes with a cape mount.",
      desc: P("A one-person hero suit, the Circuit Riders' idea of a starter giant robot. It is the size of a person, which the Riders consider a technicality."),
      rigFrame: { bracket: "mecha", baseIntegrity: 22, tierStep: 6, pilotMount: true, mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 1, output: 0 },
        capacity: { pilot: { min: 1, max: 1 }, gunner: { min: 0, max: 0 }, engineer: { min: 0, max: 0 }, crew: { min: 0, max: 0 } },
        actions: { pilot: ["steer", "evasive", "stomp", "fire-weapon"], gunner: [], engineer: [], crew: [] },
        travel: { speed: 5, range: 10 }, visualFrame: "open-corners" } },
    { key: "hypercalipers", template: "Grapnel Spool", name: "Hypercalipers", img: "icons/tools/scribal/lens-blue.webp", tier: "II", price: 60,
      glance: "Tool · +2 Investigation · measure a hex's reality",
      signature: "The number keeps changing just as you're about to write it down.",
      desc: P("Arviind's spare pair. They count uncollapsed wave forms, and they will tell you so.", "<b>+2 Investigation</b> while carried.", "<b>Measure Reality.</b> Once per scene, Use: a reading of the hex you stand on is whispered to you — its Darkness, radiation, conditions, and whether a story is hiding there."),
      consume: { decrement: false, target: "self", effects: [{ kind: "measureReality" }], limit: { window: "scene", uses: 1 } },
      effects: [{ name: "Hypercalipers", img: "icons/tools/scribal/lens-blue.webp", transfer: true, disabled: false, changes: [{ key: "system.skills.investigation.value", type: "add", mode: 2, value: "2", priority: null }] }] },
    { key: "hoop", template: "Anchor of the Known", name: "HOOP HOOP Novelty Projector", img: "icons/magic/sonic/projectile-sound-rings-wave.webp", tier: "II", price: 50,
      glance: "Talisman · once per scene · target gains Imposed",
      signature: "My hypothesis is that the less real a place is, the more novel behavior will be considered acceptable.",
      desc: P("Simone's field kit for anomalous novelty experiences. Point it at someone and something startling happens to them.", "<b>Once per scene:</b> your target gains <b>Imposed</b> (their next attack roll or defense check is made with 3d10 keep-lowest-2)."),
      consume: { decrement: false, target: "target", effects: [{ kind: "condition", condition: "imposed", op: "add" }], limit: { window: "scene", uses: 1 } } },
    { key: "control", template: "Circuited Flak Jacket", name: "The Control Suit", img: "icons/equipment/chest/breastplate-banded-steel-gold.webp", tier: "IV", price: 600,
      glance: "Body armor · +3 Guard · +3 Resolve · flat (no line, no rank) · super rare",
      signature: "So I am what I propose to be, or am I what I am? And does it matter?",
      desc: P("A robot costume in the Captain Robot pattern. It makes much of the discussion of what you are moot.", "<b>+3 Guard and +3 Resolve</b>, flat: it needs no armor line and no rank. It is your body armor.", "<b>I Am What I Propose to Be.</b> Once per scene, while you wear it and a Parley is open, Use: declare what you are. Your side gains +2 on the next exchange."),
      consume: { decrement: false, target: "self", effects: [{ kind: "parleyBonus", amount: 2, requiresEquipped: true, text: "I am what I propose to be." }], limit: { window: "scene", uses: 1 } },
      armor: { guardBonus: 3, resolveBonus: 3, evasionBonus: 0, armorSlot: "body", armorLine: "", armorFlat: true } },
    { key: "toebonk", template: "Inlaid Warhammer", name: "Toe-Bonk Hammer", img: "icons/weapons/hammers/hammer-war-rounding.webp", tier: "II", price: 70,
      glance: "Weapon · heavy hammer · +1d6 vs constructs, rigs and Circuitborn",
      signature: "I don't CARE, Leggy, that it hurts.",
      desc: P("Dennis's hammer, or one just like it. Made for persuading very large feet.", "<b>Bonk.</b> +1d6 damage against constructs, rigs and Circuitborn — it rolls itself when you apply the hit."),
      conditionalDamage: [{ vsType: "construct", bonusFormula: "1d6" }, { vsType: "circuitborn", bonusFormula: "1d6" }] },
    { key: "fist", template: "Circuited Knuckle Dusters", name: "Fist of Justice Gauntlets", img: "icons/equipment/hand/gauntlet-armored-red-gold.webp", tier: "III", price: 160,
      glance: "Weapon · huge punches · a critical hit cracks the world (hex Darkness +1)",
      signature: "Punching hard is kind of our deal.",
      desc: P("Hero gauntlets. They hit like the comics say they do.", "<b>Cracks the World.</b> A critical hit (double 10) with these raises the Darkness of the hex you stand on by 1. You punch something too hard, you break the world too."),
      onCrit: { hexDarkness: 1 } },
    { key: "polish", template: "Adrenal Burn", name: "Epic Nail Polish", img: "icons/consumables/potions/bottle-round-corked-pink.webp", tier: "I", price: 15, charges: 3,
      glance: "Consumable ×3 · for the scene: no hands (can't be disarmed or grappled)",
      signature: "And yes, the nail polish I use is epic.",
      desc: P("Howard's. Three coats.", "<b>There Are No Hands.</b> Use: clears Restrained, and you can't be Restrained (grappled, held, pinned) for the rest of the scene."),
      consume: { decrement: true, target: "self", effects: [{ kind: "condition", condition: "restrained", op: "remove" }, { kind: "immunity", conditions: "restrained", duration: "scene" }] } },
    { key: "anchor", template: "Sensor Suite", name: "Reality Anchor", img: "icons/commodities/tech/cog-brass.webp", tier: "II", price: 120,
      glance: "Rig system · your rig's travel doesn't raise Darkness",
      signature: "Holds the world still while you drive through it.",
      desc: P("A rig module the Riders build to keep their own footprints from wearing reality thin.", "<b>Anchored.</b> Install it on a rig. Stewards riding that rig take no Darkness from travelling through dark hexes."),
      rigGear: { subtype: "rig-system", passive: {}, realityAnchor: true } }
  ];

  // folder
  let folder = game.folders.find(f => f.type === "Item" && f.name === "Circuit Rider Wares");
  if (!folder) { report.changed.push("folder Circuit Rider Wares"); if (!DRY_RUN) folder = await Folder.create({ name: "Circuit Rider Wares", type: "Item", color: "#2e7d6b" }); }

  const made = {};
  for (const w of WARES) {
    const t = await tpl(w.template); delete t._id;
    const data = foundry.utils.deepClone(t);
    let imgOk = false; try { imgOk = (await fetch(w.img, { method: "HEAD" })).ok; } catch (_e) {}
    data.name = w.name; data.img = imgOk ? w.img : t.img; data.folder = folder?.id ?? null;   // a missing core icon keeps the template's
    if (!imgOk) report.changed.push(`(icon ${w.img} not found — kept ${t.img})`);
    data.system.description = { ...(data.system.description || {}), value: w.desc };
    const rfi = data.flags.fourththing.rfi.item;
    rfi.tier = w.tier; rfi.glance = w.glance; rfi.signature = w.signature; rfi.lore = w.desc; rfi.origin = "found"; rfi.originator = "The Circuit Riders";
    rfi.price = { ...(rfi.price || {}), marks: w.price, currency: "economy", split: null, rarityMult: 1, gmOverride: false, notes: "Circuit Rider ware (Dave 2026-11-13)" };
    if (w.charges) rfi.charges = w.charges;
    if (w.consume) rfi.consume = w.consume;
    if (w.rigFrame) data.flags.fourththing.rigFrame = w.rigFrame;
    if (w.rigGear) data.flags.fourththing.rigGear = w.rigGear;
    if (w.onCrit) rfi.onCrit = w.onCrit;
    if (w.conditionalDamage) foundry.utils.setProperty(data, "system.manifestation.conditionalDamage", w.conditionalDamage);
    if (w.armor) Object.assign(data.system, w.armor);
    data.effects = w.effects ? w.effects : (w.armor ? [] : (data.effects || []));
    data.flags[MODC] = { ...(data.flags[MODC] || {}), crWare: w.key };
    const have = game.items.find(i => i.flags?.[MODC]?.crWare === w.key);
    if (!have) { report.changed.push("item " + w.name); if (!DRY_RUN) made[w.key] = await Item.create(data); else made[w.key] = { uuid: "Item.(new)" }; continue; }
    made[w.key] = have;
    const cmp = (o) => JSON.stringify([o.name, o.img, o.system?.description?.value, o.flags?.fourththing?.rfi?.item?.glance, o.flags?.fourththing?.rfi?.item?.price?.marks, o.flags?.fourththing?.rfi?.item?.consume || null, o.flags?.fourththing?.rigFrame || null, o.flags?.fourththing?.rigGear || null, o.flags?.fourththing?.rfi?.item?.onCrit || null, o.system?.manifestation?.conditionalDamage || null, w.armor ? [o.system.guardBonus, o.system.resolveBonus, o.system.armorFlat] : null]);
    if (cmp(have.toObject()) !== cmp(data)) { report.changed.push("updated " + w.name); if (!DRY_RUN) { if (w.rigGear) await have.update({ "flags.fourththing.-=rigGear": null }); await have.update({ name: data.name, img: data.img, system: data.system, flags: data.flags }); } }   // rigGear replaced whole (a merge kept the template's passive)
  }

  // vendor + catalog
  const MK = "bbttcc-market";
  const vendors = foundry.utils.deepClone(game.settings.get(MK, "vendors") || []);
  if (!vendors.some(v => v.id === VID)) {
    vendors.push({ id: VID, name: "The Circuit Rider Camp", blurb: "Hero gear, giant-robot parts, and instruments for measuring reality. Found here and nowhere else.", tags: ["Circuit Riders", "Rigs", "Unique"], active: false, factionId: CR_ID });
    report.changed.push("vendor The Circuit Rider Camp"); if (!DRY_RUN) await game.settings.set(MK, "vendors", vendors);
  }
  const catalog = foundry.utils.deepClone(game.settings.get(MK, "catalog") || []);
  let catChanged = false;
  for (const w of WARES) {
    const id = "cr-ware-" + w.key; const uuid = made[w.key]?.uuid || "";
    const entry = { id, vendorId: VID, kind: "gear", name: w.name, blurb: w.glance, uuid, cost: { economy: w.price } };
    const i = catalog.findIndex(e => e.id === id);
    if (i < 0) { catalog.push(entry); catChanged = true; report.changed.push("catalog " + w.name); }
    else if (JSON.stringify(catalog[i]) !== JSON.stringify(entry) && !DRY_RUN) { catalog[i] = entry; catChanged = true; report.changed.push("catalog updated " + w.name); }
  }
  if (catChanged && !DRY_RUN) await game.settings.set(MK, "catalog", catalog);

  // beat + hub choice
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const P0 = "enc_circuit_riders_";
  const camp = beats.find(b => b.id === P0 + "camp"); if (!camp) throw new Error("camp hub missing — run patch-cr-rebuild-to-parley first");
  const legend = beats.find(b => b.id === P0 + "legansus");
  let wares = beats.find(b => b.id === P0 + "wares");
  const WARES_BEAT = { label: "The Riders’ Wares", description: "Between the scanners and the spare capes, the Riders keep a few things for trade. Hero gear. Giant-robot parts. Instruments for measuring reality. You will not find any of it anywhere else.",
    choices: [{ label: "Back to the camp", next: P0 + "camp", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects: { openMarket: { vendorId: VID, activate: true, closeOnTurnEnd: true } } };
  if (!wares) { wares = { ...foundry.utils.deepClone(legend), id: P0 + "wares", ...WARES_BEAT }; beats.push(wares); report.changed.push("beat wares"); }
  else if (JSON.stringify([wares.label, wares.description, wares.choices, wares.worldEffects]) !== JSON.stringify([WARES_BEAT.label, WARES_BEAT.description, WARES_BEAT.choices, WARES_BEAT.worldEffects])) { Object.assign(wares, WARES_BEAT); report.changed.push("beat wares updated"); }
  if (!camp.choices.some(x => x.next === P0 + "wares")) {
    camp.choices.splice(0, 0, { label: "Browse the Riders’ wares", next: P0 + "wares", description: "", checkStat: "", checkDC: 0, failNext: "" });
    report.changed.push("camp: Browse the Riders’ wares");
  }
  if (!DRY_RUN && report.changed.some(x => /^(beat|camp)/.test(x))) await C.saveCampaign(cid, { ...c, beats });

  console.log("CRWARES " + JSON.stringify({ DRY_RUN, n: report.changed.length }));
  return report;
})();
