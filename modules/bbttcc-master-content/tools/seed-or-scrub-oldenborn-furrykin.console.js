// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Take-us-home macro: Oldenborn + Furrykin (25 items)
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent — sentinel-gated. For each identifier:
//   - if pack item exists → rewrite description with RFI-canon + per-use callout
//   - if missing → seed into bbttcc-master-content.ancestries
//   - all actor copies → in-place rewrite
// Body text in dispatcher (ft-class-automation.js) is the authoritative spec
// for the picker dialog; this macro only refreshes the source-card description.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID   = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";
  const SENTINEL  = "data-ft-canon-oldenborn-furrykin=\"v1\"";
  const OLD_IMG   = "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Oldenborn_1.png";
  const FUR_IMG   = "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Furrykin_1.png";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  // ── ITEMS ──────────────────────────────────────────────────────────────────
  // Each row: { _id, identifier, name, requirements, img, ancestry, base, callout }
  const ITEMS = [
    // ── Oldenborn ─────────────────────────────────────────────────────────
    { _id: "OLDEARTHMTNST001", identifier: "oldenborn-earthbound-mountain_stance", name: "Oldenborn (Earthbound): Mountain Stance", requirements: "Oldenborn (Earthbound)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"The mountain does not fall. It negotiates."</em></p><p><strong>Mountain Stance (tier uses / Soma Break).</strong> Bonus action — enter a stance for 1 minute. While in the stance: reroll the lowest die on Violence checks; creatures provoke opportunity attacks from you even when they Disengage.</p>`,
      callout: { label: "Mountain Stance", recovery: "tier uses / Soma Break", action: "Bonus action (1-min stance)", summary: "Enter stance: reroll-lowest on Violence checks for 1 min, foes provoke OAs even when Disengaging.", key: "oldEarthboundMountainStance" } },
    { _id: "OLDEARTHWORLDA01", identifier: "oldenborn-earthbound-world_anchor", name: "Oldenborn (Earthbound): World-Anchor", requirements: "Oldenborn (Earthbound)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"Reality tries to slide. You say: no."</em></p><p><strong>World-Anchor (1/Soma Break).</strong> Reaction — when you or an ally within 30 ft would be teleported, displaced, banished, or forcibly moved by magical/metaphysical effect, anchor them. Effect fails; attacker takes psychic backlash = your tier.</p>`,
      callout: { label: "World-Anchor", recovery: "1/Soma Break", action: "Reaction (within 30 ft)", summary: "Negate teleport/displace/banish/forced-movement on you or ally within 30 ft; attacker takes psychic backlash = tier.", key: "oldEarthboundWorldAnchor" } },
    { _id: "OLDLUMENMOON0001", identifier: "oldenborn-lumenwrought-moonlit_ward", name: "Oldenborn (Lumenwrought): Moonlit Ward", requirements: "Oldenborn (Lumenwrought)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"You can make a lie feel tired."</em></p><p><strong>Moonlit Ward (tier uses / Soma Break).</strong> Reaction — when you or an ally within 30 ft would be Charmed or Shaken, grant them reroll-lowest on the defense check. On a success, the aggressor rolls 3d10 keep lowest 2 on their next attack.</p>`,
      callout: { label: "Moonlit Ward", recovery: "tier uses / Soma Break", action: "Reaction (within 30 ft)", summary: "Grant reroll-lowest on defense vs Charmed/Shaken to you or ally; success makes aggressor roll 3d10kl2 next attack.", key: "oldLumenMoonlitWard" } },
    { _id: "OLDLUMENSOVR0001", identifier: "oldenborn-lumenwrought-sovereign_mask", name: "Oldenborn (Lumenwrought): Sovereign Mask", requirements: "Oldenborn (Lumenwrought)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"You put on a story, and the world agrees."</em></p><p><strong>Sovereign Mask (1/Soma Break).</strong> Over 1 minute, assume a mythic persona (King, Trickster, Saint, Monster, etc.). For 10 minutes, gain a skill rank in Diplomacy (Presence), Stealth (Intrigue), and Intimidation (Presence) — or mastery if already proficient. You cannot be magically identified or scryed while masked.</p>`,
      callout: { label: "Sovereign Mask", recovery: "1/Soma Break", action: "1-minute donning", summary: "Assume mythic persona for 10 min: +1 rank Diplomacy/Stealth/Intimidation (mastery if proficient); immune to magical identification/scrying.", key: "oldLumenSovereignMask" } },
    { _id: "OLDLUMENMYTHIC01", identifier: "oldenborn-lumenwrought-mythic_recollection", name: "Oldenborn (Lumenwrought): Mythic Recollection", requirements: "Oldenborn (Lumenwrought)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"You remember yourself. And reality flinches."</em></p><p><strong>Mythic Recollection (1/Soma Break).</strong> For 1 minute, you become painfully real. Gain resistance to all damage except force; hostile creatures within 10 ft roll 3d10 keep lowest 2 on defense checks against your manifestations and abilities (caught in your gravity of meaning).</p>`,
      callout: { label: "Mythic Recollection", recovery: "1/Soma Break", action: "Action (1-min effect)", summary: "1 min: resist all damage except force; foes within 10 ft roll 3d10kl2 on defense vs your manifestations/abilities.", key: "oldLumenMythicRecollection" } },
    { _id: "OLDRUSTPATCH0001", identifier: "oldenborn-rustland-patch-repurpose", name: "Oldenborn (Rustland Scavenger): Patch & Repurpose", requirements: "Oldenborn (Rustland Scavenger)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"You can make almost anything run long past its expiration date. Yourself included."</em></p><p><strong>Patch & Repurpose (1/Soma Break).</strong> During a Soma Break, spend 10 min on a single broken/low-charge item (weapon, tool, power cell, vehicle component, armour). Restore it to one more use, scene, or day. The GM rules how it dies for real after.</p>`,
      callout: { label: "Patch & Repurpose", recovery: "1/Soma Break", action: "10-min repair (during Soma Break)", summary: "Restore one broken/low-charge item to one more use/scene/day. It dies for real after.", key: "oldRustPatchRepurpose" } },
    { _id: "OLDRUSTSALVAGE01", identifier: "oldenborn-rustland-salvage-king", name: "Oldenborn (Rustland Scavenger): Salvage King", requirements: "Oldenborn (Rustland Scavenger)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"If it isn't nailed down, you can sell it. If it is nailed down, you can sell the nails."</em></p><p><strong>Salvage King (1/Scene).</strong> When the party is in any ruin, junkyard, scrap field, abandoned facility, or wrecked vehicle, declare that one specific reasonable object exists somewhere within sight or one room over. GM may set a brief search time, require a minor cost, or rule the object is in worse condition.</p>`,
      callout: { label: "Salvage King", recovery: "1/Scene", action: "Declaration", summary: "Declare one specific reasonable object exists in nearby ruin/junkyard/scrap. GM may set short search time, minor cost, or worse condition.", key: "oldRustSalvageKing" } },
    { _id: "OLDRUSTSCAVTIER1", identifier: "oldenborn_rustland_scavenger_tier1", name: "Oldenborn (Rustland Scavenger): Toxic Lung Filters", requirements: "Oldenborn (Rustland Scavenger)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"You breathe what kills them."</em></p><p><strong>Toxic Lung Filters (passive).</strong> Reroll the lowest die on defense checks against inhaled toxins, smoke, and industrial residue (auto-fires). You can function for up to 1 hour in atmospheres that would hospitalize a normal Medium creature.</p><p><strong>Scavenger's Eye (1/Soma Break).</strong> Spend 10 minutes in a ruin, junkyard, or wreckage site; find one specific reasonable item. The GM may gate exotic items behind a Mind check.</p>`,
      callout: { label: "Toxic Lung Filters + Scavenger's Eye", recovery: "1/Soma Break (active) + always-on passive", action: "Action (10-min search)", summary: "Active: 10-min search → 1 plausible salvage item. Passive: reroll-lowest vs inhaled toxins/smoke/industrial residue (auto-fires); 1 hr in hospitalizing atmospheres.", key: "oldRustToxicLungFilters" } },
    { _id: "OLDSKYJETSTRM001", identifier: "oldenborn-skythreaded-jetstream_traverse", name: "Oldenborn (Sky-Threaded): Jetstream Traverse", requirements: "Oldenborn (Sky-Threaded)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"You don't run. You re-route."</em></p><p><strong>Jetstream Traverse (1/Soma Break).</strong> For 10 minutes, gain a flying speed equal to your walking speed; you must end your turn on solid ground (or fall normally). When this ends, you are not harmed by the fall from the last 10 ft.</p>`,
      callout: { label: "Jetstream Traverse", recovery: "1/Soma Break", action: "Activate", summary: "10 min flying speed = walk speed; end turn on solid ground or fall. Last 10 ft of fall is harmless when it ends.", key: "oldSkyJetstreamTraverse" } },
    { _id: "OLDSKYWEATHER001", identifier: "oldenborn-skythreaded-weather_crown", name: "Oldenborn (Sky-Threaded): Weather Crown", requirements: "Oldenborn (Sky-Threaded)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"The sky knows your name again."</em></p><p><strong>Weather Crown (1/Soma Break).</strong> Over 1 minute, call a localized weather effect in a 60-ft radius for 10 minutes (fog, wind, rain, or clear). The effect is real and interacts with fire, ranged attacks, and travel checks. BBTTCC: 1/Turn your faction may re-roll a Weather event affecting your hex.</p>`,
      callout: { label: "Weather Crown", recovery: "1/Soma Break", action: "1-min ritual", summary: "Call 60-ft localized weather (fog/wind/rain/clear) for 10 min. Real effect on fire/ranged/travel. BBTTCC: 1/Turn faction Weather re-roll.", key: "oldSkyWeatherCrown" } },
    { _id: "OLDSTORMWARDGAL1", identifier: "oldenborn-stormborn-ward-of-the-gale", name: "Oldenborn (Stormborn Nomad): Ward of the Gale", requirements: "Oldenborn (Stormborn Nomad)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"Storms have learned to lean around you instead of straight through you."</em></p><p><strong>Ward of the Gale (1/Soma Break).</strong> Reaction — when you take damage from a visible attack, hazard, or effect, wrap yourself in whirling air and reduce that damage by half until the start of your next turn (apply resistance first, then halve the remainder).</p>`,
      callout: { label: "Ward of the Gale", recovery: "1/Soma Break", action: "Reaction (on damage)", summary: "Halve incoming damage from a visible source until start of next turn (resistance first, then halve).", key: "oldStormWardOfTheGale" } },
    { _id: "OLDSTORMSKYWLK01", identifier: "oldenborn-stormborn-skywalker", name: "Oldenborn (Stormborn Nomad): Skywalker", requirements: "Oldenborn (Stormborn Nomad)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"The sky was the first road. You remember that road in the bones of your feet."</em></p><p><strong>Skywalker (1/Soma Break).</strong> Action — call the wind to hold you up. For 1 minute, walk on air, ash, falling rain, or any equivalent surface as if it were solid ground. Move at your normal walking speed in any direction including straight up. Falling damage negated for the duration. Ends early if you fall unconscious or dismiss it.</p>`,
      callout: { label: "Skywalker", recovery: "1/Soma Break", action: "Action (1-min duration)", summary: "1 min: walk on air/ash/rain as solid ground, move any direction (up included), fall damage negated.", key: "oldStormSkywalker" } },
    { _id: "OLDSTORMNOMTIER1", identifier: "oldenborn_stormborn_nomad_tier1", name: "Oldenborn (Stormborn Nomad): Weatherwise + Wind-Read", requirements: "Oldenborn (Stormborn Nomad)", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"The sky is a language. You were the first to learn the punctuation."</em></p><p><strong>Weatherwise (passive).</strong> Always know the upcoming weather for the next 12 hours within 1 mile, even underground. Reroll the lowest die on defense checks against weather effects (extreme cold, extreme heat, wind, storm) — auto-fires.</p><p><strong>Wind-Read (1/Soma Break).</strong> Reaction — when you would take energy damage (lightning or cold flavor) or kinetic damage (thunder flavor), halve it. The wind shifts as you do.</p>`,
      callout: { label: "Weatherwise + Wind-Read", recovery: "1/Soma Break (active) + always-on passive", action: "Reaction (on weather damage)", summary: "Active: halve incoming lightning/cold/thunder damage as a reaction. Passive: 12-hour weather foresight in 1 mile + reroll-lowest vs weather effects (auto).", key: "oldStormNomadTier1" } },
    { _id: "OLDSTORMHERIT001", identifier: "oldenborn_stormborn_nomad_heritage", name: "Oldenborn Heritage: Stormborn Nomad", requirements: "Oldenborn", img: OLD_IMG, ancestry: "oldenborn",
      base:`<p><em>"Yesod fell. The world remembered old names. You answered."</em></p><p>Your place-soul is a weather front. You are the caravan memory of every tribe that crossed the ash squalls and came out the other side. When you walk, the wind remembers that you used to be the reason it had a name.</p><p><strong>Heritage signature (1/Soma Break).</strong> Surfaces the Stormborn Nomad Tier-I Wind-Read reaction (energy lightning/cold or kinetic thunder damage halved) directly from the heritage card. See the Tier-I feat for full mechanics.</p>`,
      callout: { label: "Stormborn Nomad Heritage", recovery: "1/Soma Break", action: "Reaction (mirrors Wind-Read)", summary: "Heritage card surfaces Wind-Read (Tier-I): halve incoming lightning/cold/thunder damage as a reaction.", key: "oldStormbornNomadHeritage" } },

    // ── Furrykin ──────────────────────────────────────────────────────────
    { _id: "FURFELIDKINGAL01", identifier: "furrykin-felid-king_of_alleys", name: "Furrykin (Felid): King of Alleys", requirements: "Furrykin (Felid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"Cities were made for you. Ruins too."</em></p><p><strong>King of Alleys (1/Soma Break).</strong> For 10 minutes, gain a climbing speed equal to your walking speed and ignore difficult terrain in urban ruins. BBTTCC: 1/Turn, reduce an Intrigue travel cost by 1 if your route passes through ruins.</p>`,
      callout: { label: "King of Alleys", recovery: "1/Soma Break", action: "Action (10-min duration)", summary: "10 min: climb=walk + ignore difficult terrain in urban ruins. BBTTCC: 1/Turn travel-cost reduction through ruins.", key: "furFelidKingOfAlleys" } },
    { _id: "FURFELIDNINELIV1", identifier: "furrykin-felid-nine_lives", name: "Furrykin (Felid): Nine Lives Logic", requirements: "Furrykin (Felid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You do not die. You negotiate."</em></p><p><strong>Nine Lives Logic (1/Soma Break).</strong> When you would drop to 0 Integrity, instead drop to 1 Integrity and immediately Disengage as a reaction.</p>`,
      callout: { label: "Nine Lives Logic", recovery: "1/Soma Break", action: "Triggered (at 0 Integrity)", summary: "Drop to 1 Integrity instead of 0; immediately Disengage as a reaction.", key: "furFelidNineLives" } },
    { _id: "FURLEPORIDIESC01", identifier: "furrykin-leporid-impossible_escape", name: "Furrykin (Leporid): Impossible Escape", requirements: "Furrykin (Leporid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You were never where the trap expected."</em></p><p><strong>Impossible Escape (1/Soma Break).</strong> When you fail an Intrigue check, you may choose to succeed instead. Also, once per minute you may phase through a nonmagical barrier you could plausibly squeeze through.</p>`,
      callout: { label: "Impossible Escape", recovery: "1/Soma Break", action: "Triggered (on Intrigue fail)", summary: "Convert one failed Intrigue check to a success. Plus: 1/min phase through any plausible nonmagical barrier.", key: "furLeporidImpossibleEscape" } },
    { _id: "FURLEPORIDPANIC1", identifier: "furrykin-leporid-panic_geometry", name: "Furrykin (Leporid): Panic Geometry", requirements: "Furrykin (Leporid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You do not flee in a line. You flee in angles."</em></p><p><strong>Panic Geometry (tier uses / Soma Break).</strong> Reaction — when a creature moves adjacent to you, move up to half your speed without provoking opportunity attacks.</p>`,
      callout: { label: "Panic Geometry", recovery: "tier uses / Soma Break", action: "Reaction (on adjacency)", summary: "When a creature moves adjacent, move up to half speed without provoking OAs.", key: "furLeporidPanicGeometry" } },
    { _id: "FURMUSTELIDDIG01", identifier: "furrykin-mustelid-dig_in", name: "Furrykin (Mustelid): Dig-In (Living Tree Root)", requirements: "Furrykin (Mustelid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"Badgers don't retreat. They relocate the fight."</em></p><p><strong>Dig-In (tier uses / Soma Break).</strong> Bonus action — gain temporary Integrity equal to your tier + Body modifier; you cannot be knocked Prone until the start of your next turn.</p>`,
      callout: { label: "Dig-In", recovery: "tier uses / Soma Break", action: "Bonus action", summary: "Temp Integrity = tier + Body mod; immune to Prone until start of next turn.", key: "furMustelidDigIn" } },
    { _id: "FURMUSTELIDBITE1", identifier: "furrykin-mustelid-relentless_bite", name: "Furrykin (Mustelid): Relentless Bite", requirements: "Furrykin (Mustelid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You latch onto a problem and refuse to become a footnote."</em></p><p><strong>Relentless Bite (1/Soma Break).</strong> For 1 minute, once per turn when you hit a creature, reduce their speed to 0 until the start of their next turn (Violence check vs DC 8 + tier + Body resists).</p>`,
      callout: { label: "Relentless Bite", recovery: "1/Soma Break", action: "1-min effect", summary: "1 min: 1/turn on hit, target speed 0 until start of their next turn (Violence vs DC 8 + tier + Body resists).", key: "furMustelidRelentlessBite" } },
    { _id: "FURURSIDAPEXSH01", identifier: "furrykin-ursid-apex_shelter", name: "Furrykin (Ursid): Apex Shelter", requirements: "Furrykin (Ursid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"Your body is a fortification."</em></p><p><strong>Apex Shelter (1/Soma Break).</strong> For 1 minute, allies within 10 ft gain +1 Guard and reroll the lowest die on defense checks against being moved or knocked Prone. You must remain conscious.</p>`,
      callout: { label: "Apex Shelter", recovery: "1/Soma Break", action: "Action (1-min effect)", summary: "1 min: allies within 10 ft gain +1 Guard and reroll-lowest on defense checks vs forced movement/Prone. Stay conscious.", key: "furUrsidApexShelter" } },
    { _id: "FURURSIDHIBERN01", identifier: "furrykin-ursid-hibernate_pain", name: "Furrykin (Ursid): Hibernate the Pain", requirements: "Furrykin (Ursid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You go quiet. You don't go down."</em></p><p><strong>Hibernate the Pain (1/Soma Break).</strong> Bonus action — gain resistance to kinetic damage for 1 minute. When this ends, gain one level of Stress.</p>`,
      callout: { label: "Hibernate the Pain", recovery: "1/Soma Break", action: "Bonus action", summary: "1 min resistance to kinetic damage. +1 Stress when it ends.", key: "furUrsidHibernatePain" } },
    { _id: "FURURSIDROAR0001", identifier: "furrykin-ursid-roar_old_woods", name: "Furrykin (Ursid): Roar of the Old Woods", requirements: "Furrykin (Ursid)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"The room remembers who owns it."</em></p><p><strong>Roar of the Old Woods (tier uses / Soma Break).</strong> Action — force hostile creatures within 10 ft to make a Soul check or become Shaken for 1 round. On a success, they still roll 3d10 keep lowest 2 on their next attack.</p>`,
      callout: { label: "Roar of the Old Woods", recovery: "tier uses / Soma Break", action: "Action (10-ft burst)", summary: "Hostiles within 10 ft Soul check or become Shaken 1 round. On success, they still roll 3d10kl2 next attack.", key: "furUrsidRoarOldWoods" } },
    { _id: "FURVULPINFABLE01", identifier: "furrykin-vulpin-fable_shadow", name: "Furrykin (Vulpin): Fable-Shadow", requirements: "Furrykin (Vulpin)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You become the story that slips between lanternlight."</em></p><p><strong>Fable-Shadow (1/Soma Break).</strong> For 1 minute, hostile creatures roll 3d10 keep lowest 2 on attacks against you unless they succeed a Soul check at the start of their turn (DC 8 + tier + Intrigue). Once per turn, force one attack to miss you (reaction) by "changing the story."</p>`,
      callout: { label: "Fable-Shadow", recovery: "1/Soma Break", action: "1-min effect", summary: "1 min: hostiles roll 3d10kl2 vs you unless Soul check passes (DC 8 + tier + Intrigue). 1/turn force an attack to miss as reaction.", key: "furVulpinFableShadow" } },
    { _id: "FURVULPINSCENT01", identifier: "furrykin-vulpin-scent_secrets", name: "Furrykin (Vulpin): Scent of Secrets", requirements: "Furrykin (Vulpin)", img: FUR_IMG, ancestry: "furrykin",
      base:`<p><em>"You can smell fear. You can smell guilt. You can smell the truth trying to hide."</em></p><p><strong>Scent of Secrets (1/Soma Break).</strong> For 10 minutes, reroll the lowest die on Insight (Soul), Investigation (Mind), and Perception (Mind) checks to detect deception, hidden compartments, secret doors, or concealed items.</p>`,
      callout: { label: "Scent of Secrets", recovery: "1/Soma Break", action: "Activate (10-min duration)", summary: "10 min: reroll-lowest on Insight/Investigation/Perception for deception, hidden compartments, secret doors, concealed items.", key: "furVulpinScentSecrets" } },
  ];

  const buildDesc = (it) => `<div ${SENTINEL} style="display:none"></div>\n${it.base}\n${calloutFor(it.callout)}`;

  // Pass 1: present pack docs → rewrite
  const presentByIdent = new Map();
  let scrubOK = 0, scrubSkip = 0;
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        const id = doc.system?.identifier ?? "";
        const it = ITEMS.find(x => x.identifier === id);
        if (!it) continue;
        presentByIdent.set(id, { pack: pack.metadata.id, doc });
        const val = doc.system?.description?.value ?? "";
        if (val.includes(SENTINEL)) { scrubSkip++; continue; }
        await doc.update({ "system.description.value": buildDesc(it) });
        scrubOK++;
        console.log(`  [${pack.metadata.id}] SCRUB ${doc.name}`);
      }
    } catch (e) { console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`); }
    if (wasLocked) await pack.configure({ locked: true });
  }

  // Pass 2: missing → seed
  const targetPack = game.packs.get(PACK_ID);
  if (!targetPack) { ui.notifications.error(`Pack not found: ${PACK_ID}`); return; }
  const wasLocked2 = targetPack.locked;
  if (wasLocked2) await targetPack.configure({ locked: false });
  let created = 0;
  for (const it of ITEMS) {
    if (presentByIdent.has(it.identifier)) continue;
    const data = {
      _id: it._id, name: it.name, type: "feat", img: it.img, folder: FOLDER_ID,
      system: {
        description: { value: buildDesc(it), chat: "" },
        source: { custom: "BBTTCC", rules: "2024", revision: 2, book: "", license: "" },
        advancement: {},
        identifier: it.identifier, requirements: it.requirements,
        prerequisites: { items: [], repeatable: false, level: null },
        uses: { spent: 0, recovery: [], max: "" },
        activities: {}, category: "feature", tags: [],
        type: { value: "", subtype: "" }, properties: []
      },
      effects: [],
      flags: { dnd5e: { originType: "feat" }, bbttcc: { kind: it.ancestry, version: "2.0.0", date: "2026-04-29" } },
      ownership: { default: 0 }
    };
    try {
      await targetPack.documentClass.create(data, { pack: PACK_ID, keepId: true });
      created++;
      console.log(`  CREATED ${it.name} [${it._id}]`);
    } catch (e) {
      console.error(`  FAIL ${it.identifier} — ${e.message}`);
    }
  }
  if (wasLocked2) await targetPack.configure({ locked: true });

  // Pass 3: actor instances
  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const id = item.system?.identifier ?? "";
      const it = ITEMS.find(x => x.identifier === id);
      if (!it) continue;
      const val = item.system?.description?.value ?? "";
      if (val.includes(SENTINEL)) continue;
      await item.update({ "system.description.value": buildDesc(it) });
      actorOK++; touched = true;
      console.log(`  [${actor.name}] SCRUB ${item.name}`);
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(`Oldenborn+Furrykin seed/scrub: ${created} created, ${scrubOK} scrubbed (${scrubSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
