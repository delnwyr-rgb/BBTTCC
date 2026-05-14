// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Seed or scrub Menhirkin (3 Tier-I feats + species root)
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent — sentinel-gated. Creates missing items in
// bbttcc-master-content.ancestries with full canon description + per-use
// callout baked in; rewrites present items' descriptions to canon.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID   = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";
  const SENTINEL  = "data-ft-canon-menhirkin=\"v1\"";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const ITEMS = [
    {
      _id: "MENHIRKINSPC0001",
      type: "species",
      name: "Menhirkin",
      identifier: "menhirkin",
      requirements: "",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Menhirkin_1.png",
      bbttccFlag: { kind: "menhirkin", feature: "core", lineage: "Menhirkin", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"The land is not scenery. The land is a person. You are the version of it that finally stood up and walked over to complain."</em></p>
<p>You are not descended from the land. You are the land. A hex decided to become a person and the person is you. The standing stones on the ridge are distant cousins. The bedrock under the bunker is a grandparent. Mortals call you a Hex-Giant. You don't correct them.</p>
<p><strong>Creature Type.</strong> Humanoid (Menhirkin). <strong>Size.</strong> Medium, but you count as Large for carrying capacity and the size of creatures you can shove or grapple. <strong>Speed.</strong> 30 ft.</p>
<p><strong>Heartstone (passive).</strong> A fragment of your home hex is literally inside you. While in any hex your faction controls or has claimed: reroll the lowest die on Body checks (auto-fires), and you cannot be forcibly removed from the hex against your will (teleportation, banishment, forced march) without first being reduced to 0 Integrity.</p>
<p><strong>Land Memory (1/Soma Break).</strong> Lay a hand on any surface older than you; the GM tells you one true thing the land remembers.</p>
<p><strong>Living Rampart (1/Soma Break).</strong> Reaction — when a creature you can see targets an ally adjacent to you with an attack, the attacker rolls 3d10 keep lowest 2 on that attack roll.</p>
<p><strong>Stonebound (passive).</strong> Reroll the lowest die on Body checks to resist being pushed, knocked Prone, or otherwise forcibly moved (auto-fires). Reroll the lowest die on Body checks to build, repair, or fortify structures, siegeworks, and defensive emplacements (auto-fires).</p>
<p><strong>Strategic Hooks.</strong> <em>OP Edge:</em> +2 Non-Lethal OP and +1 Violence OP at campaign start. <em>Fortify Hex:</em> first Patch the Breach or structure-repair Siege activity each Turn costs 1 fewer OP (min 0). <em>Logistics Frame:</em> 1/Turn, treat one raid/operation Logistics cost as Logistics −1 (min 0). <em>Sentient Land (1/Strategic Turn):</em> consult the hex itself about a pending decision; one-sentence honest answer from the land's perspective.</p>`,
      callout: {
        label: "Menhirkin: Hex-Giant", recovery: "3 active per-uses (2 Soma Break · 1 Strategic Turn) + 2 reroll passives + Heartstone hex-protection", action: "Picker (Land Memory · Living Rampart · Sentient Land · Heartstone)",
        summary: "4-slot picker — Land Memory (touch-the-old-stones), Living Rampart (ally-cover reaction), Sentient Land (1/Strategic Turn faction question), Heartstone passive. Stonebound reroll grants auto-fire on Body checks for forced-movement and build/repair/fortify.",
        key: "menhirkinHexGiant"
      }
    },
    {
      _id: "MENHIRKINIGNEO01",
      type: "feat",
      name: "Menhirkin (Igneous): Magma Memory",
      identifier: "menhirkin_igneous_tier1",
      requirements: "Menhirkin (Igneous)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Menhirkin_1.png",
      bbttccFlag: { kind: "menhirkin", feature: "magma_memory", lineage: "Igneous", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"Some things you carry around because you haven't figured out where to put them yet."</em></p>
<p><strong>Magma Memory (1/Soma Break).</strong> Reaction — when you take energy damage (any flavor) from a single source, bank a portion of the heat. Until your next Soma Break, spend the banked heat as a bonus action to add +2d10 exploding energy damage (flavor: fire) to your next weapon attack or unarmed strike that hits.</p>
<p>While the heat is held, reroll the lowest die on Body checks against environmental cold.</p>`,
      callout: {
        label: "Magma Memory", recovery: "1/Soma Break (bank + spend)", action: "Reaction (bank) → Bonus action (spend)",
        summary: "Reaction on energy damage: bank the heat. Until next Soma Break, spend as bonus action to add +2d10 exploding energy (fire) to next hitting attack. While held: reroll-lowest on Body checks vs cold.",
        key: "menhirkinIgneousMagmaMemory"
      }
    },
    {
      _id: "MENHIRKINMETAMO1",
      type: "feat",
      name: "Menhirkin (Metamorphic): The Thing You Were",
      identifier: "menhirkin_metamorphic_tier1",
      requirements: "Menhirkin (Metamorphic)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Menhirkin_1.png",
      bbttccFlag: { kind: "menhirkin", feature: "thing_you_were", lineage: "Metamorphic", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"The first shape was softer. The second shape remembers."</em></p>
<p><strong>The Thing You Were (1/Scene).</strong> Bonus action — briefly re-surface a trait of your pre-pressure self. Pick one of three options; it lasts until the end of your next turn:</p>
<ul>
  <li><strong>Softer:</strong> your movement increases by 10 ft and you reroll the lowest die on Intrigue checks to squeeze or slip past.</li>
  <li><strong>Older:</strong> you gain low-light vision 60 ft if you don't already have it, or +30 ft if you do.</li>
  <li><strong>Wetter:</strong> you become immune to the Burning and Prone conditions, and difficult terrain does not slow you.</li>
</ul>
<p>Each option refreshes on Soma Break — you cannot pick the same option twice before a Soma Break.</p>`,
      callout: {
        label: "The Thing You Were", recovery: "1/Scene total — each option refreshes on Soma Break", action: "Picker (Softer · Older · Wetter)",
        summary: "Bonus action — re-surface one of three pre-pressure traits (Softer / Older / Wetter) until end of next turn. Each option's individual use refreshes on Soma Break.",
        key: "menhirkinMetamorphicThingYouWere"
      }
    },
    {
      _id: "MENHIRKINSEDIME1",
      type: "feat",
      name: "Menhirkin (Sedimentary): Read the Strata",
      identifier: "menhirkin_sedimentary_tier1",
      requirements: "Menhirkin (Sedimentary)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Menhirkin_1.png",
      bbttccFlag: { kind: "menhirkin", feature: "read_the_strata", lineage: "Sedimentary", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"The stones keep what the rest of us tried to throw away."</em></p>
<p><strong>Read the Strata (1/Soma Break).</strong> Spend 10 minutes with a structure, ruin, battlefield, or natural formation older than a century. The GM answers two true questions about it — one about how it was built or formed, and one about the last decade of its occupation or use.</p>
<p>This is a separate use from the ancestry's Hex Recognition; they do not share a pool.</p>`,
      callout: {
        label: "Read the Strata", recovery: "1/Soma Break", action: "Action (10-minute ritual)",
        summary: "10-min focus on a structure / ruin / formation older than a century → GM answers 2 true questions: one about origin / construction, one about last decade of use. Separate pool from Hex Recognition.",
        key: "menhirkinSedimentaryReadStrata"
      }
    },
  ];

  const buildDesc = (it) => it.base + "\n" + calloutFor(it.callout);

  // Pass 1: present pack docs → rewrite description
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

  // Pass 2: missing items → create
  const targetPack = game.packs.get(PACK_ID);
  if (!targetPack) { ui.notifications.error(`Pack not found: ${PACK_ID}`); return; }
  const wasLocked2 = targetPack.locked;
  if (wasLocked2) await targetPack.configure({ locked: false });
  let created = 0;
  for (const it of ITEMS) {
    if (presentByIdent.has(it.identifier)) continue;
    const data = {
      _id: it._id, name: it.name, type: it.type, img: it.img, folder: FOLDER_ID,
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
      flags: { dnd5e: { originType: it.type === "species" ? "species" : "feat" }, bbttcc: it.bbttccFlag },
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

  ui.notifications.info(`Menhirkin seed/scrub: ${created} created, ${scrubOK} scrubbed (${scrubSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
