// Seed or scrub Human ancestry batch (9 Tier feats). Idempotent / sentinel-gated.
(async () => {
  const PACK_ID   = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";
  const SENTINEL  = "data-ft-canon-human=\"v1\"";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const HUMAN_IMG = "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Human_1.png";

  const ITEMS = [
    {
      _id: "HUMCROMAGNTIER01", identifier: "human_cro_magnon_tier1",
      name: "Human (Cro-Magnon): Coalition Tongue",
      requirements: "Human (Cro-Magnon)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"The first thing worth defending was a circle of people who had decided, against all sense, to defend each other."</em></p>
<p><strong>Coalition Tongue (1/Soma Break).</strong> Bonus action — choose one ally within 30 ft who can hear and understand you. Their next attack roll, skill check, or defense check before the start of your next turn is made at +1 rank (max rank 5). Name the thing you said, even if it was wordless.</p>
<p><strong>Symbolic Memory (passive).</strong> After spending 10 minutes in any inhabited or formerly-inhabited space, ask the GM one of: <em>Who lived here? · What did they fear? · What did they leave?</em> The answer is at least one truth, even if the GM colours it.</p>`,
      callout: { label: "Coalition Tongue + Symbolic Memory", recovery: "1/Soma Break + always-on passive", action: "Picker (Coalition Tongue · Symbolic Memory)", summary: "Bonus-action ally bump (+1 rank to next roll, max 5) and 10-min space-reading GM-info passive.", key: "humCroMagnonCoalitionTongue" }
    },
    {
      _id: "HUMCROMAGNPATRN1", identifier: "human-cro-magnon-pattern-mind",
      name: "Human (Cro-Magnon): Pattern-Mind",
      requirements: "Human (Cro-Magnon)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"The first time anyone drew an antelope on a wall, they were already two thoughts ahead of the antelope."</em></p>
<p><strong>Pattern-Mind (1/Soma Break).</strong> Spend 1 minute observing a situation — a battle line, a marketplace, a council, a storm system, a faction's public posture — then ask the GM one of: <em>"What is the actual goal here?" · "What is being deliberately hidden?" · "Who is about to break first?"</em> The GM gives at least one true answer. They may colour it; they may not lie about it.</p>`,
      callout: { label: "Pattern-Mind", recovery: "1/Soma Break", action: "Action (1-min observation)", summary: "Observe situation 1 min → ask GM one of three deep questions; at least one truth.", key: "humCroMagnonPatternMind" }
    },
    {
      _id: "HUMCROMAGNFIRST1", identifier: "human-cro-magnon-first-fire",
      name: "Human (Cro-Magnon): First Fire",
      requirements: "Human (Cro-Magnon)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"The first thing worth defending was the circle of people who decided, against all sense, to keep each other warm through the night."</em></p>
<p><strong>First Fire (1/Soma Break).</strong> Spend 10 minutes building a coalition fire — a real one, not a metaphor. While it burns and creatures shelter within 30 ft (up to 1 hour, longer if tended):</p>
<ul>
  <li>Friendly creatures reroll the lowest die on defense checks against being Shaken or exhausted.</li>
  <li>After a Soma Break taken at the fire, each friendly creature present gains a single banked reroll-lowest they may spend on any check before the next Soma Break.</li>
  <li>The first time any hostile creature crosses within 30 ft, every friendly creature there knows it.</li>
  <li>The fire counts as a defensible camp narratively.</li>
</ul>`,
      callout: { label: "First Fire (Cro-Magnon)", recovery: "1/Soma Break", action: "10-min build", summary: "Build a coalition fire — 30-ft shelter zone for up to 1 hour granting friend reroll-lowest vs Shaken/Stressed, banked reroll-lowest after Soma Break at the fire, hostile-crossing alarm, narrative defensible camp.", key: "humCroMagnonFirstFire" }
    },
    {
      _id: "HUMDENISPEAKANCH", identifier: "human-denisovan-peak_anchor",
      name: "Human (Denisovan): Peak-Anchor",
      requirements: "Human (Denisovan)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"Gravity listens to you."</em></p>
<p><strong>Peak-Anchor (1/Soma Break).</strong> Reaction — when you or an ally within 30 ft would be moved or teleported against your will, negate it. The effect fails, and the aggressor takes psychic backlash equal to your tier.</p>`,
      callout: { label: "Peak-Anchor", recovery: "1/Soma Break", action: "Reaction (within 30 ft)", summary: "Negate forced movement / teleport on you or ally within 30 ft; aggressor takes psychic backlash = your tier.", key: "humDenisovanPeakAnchor" }
    },
    {
      _id: "HUMERECTUSFIRST1", identifier: "human-erectus-first_fire",
      name: "Human (Erectus): First Fire",
      requirements: "Human (Erectus)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"You were never supposed to stop."</em></p>
<p><strong>First Fire (1/Soma Break).</strong> When you would drop to 0 Integrity, instead drop to 1 Integrity and gain temporary Integrity equal to twice your tier. Allies who can see you reroll the lowest die on their next defense check (because you refuse to quit and it's fucking inspiring).</p>`,
      callout: { label: "First Fire (Erectus)", recovery: "1/Soma Break", action: "Triggered (at 0 Integrity)", summary: "Drop-save: at 0 Integrity, instead drop to 1 + (tier×2) temp Integrity. Visible allies reroll-lowest on next defense check.", key: "humErectusFirstFire" }
    },
    {
      _id: "HUMERECTUSTRAILS", identifier: "human-erectus-trail_sovereign",
      name: "Human (Erectus): Trail-Sovereign",
      requirements: "Human (Erectus)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"You turn chaos into a route."</em></p>
<p><strong>Trail-Sovereign (passive).</strong> Reroll the lowest die on Athletics (Body and Violence) checks during chases, escapes, or travel hazards (auto-fires).</p>
<p><strong>Call the Pace (1/Soma Break).</strong> Grant your party a reroll-lowest on a travel-related group check.</p>`,
      callout: { label: "Trail-Sovereign", recovery: "1/Soma Break (active) + always-on passive", action: "Picker (Trail-Sovereign · Call the Pace)", summary: "Passive reroll-lowest on Athletics in chases/escapes/travel-hazards (auto-fires). Active: 1/Soma Break grant party a travel-group reroll.", key: "humErectusTrailSovereign" }
    },
    {
      _id: "HUMFLORENSILIVNG", identifier: "human-florensis-living_folklore",
      name: "Human (Florensis): Living Folklore",
      requirements: "Human (Florensis)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"People tell stories about you and then you do THIS to them."</em></p>
<p><strong>Living Folklore (1/Soma Break).</strong> For 1 minute, you cannot be targeted by opportunity attacks. Once per turn during the minute, force an enemy's attack to miss you (reaction) by "being somewhere else in the story."</p>`,
      callout: { label: "Living Folklore", recovery: "1/Soma Break", action: "1-minute zone-out", summary: "1 min: immune to opportunity attacks. Once/turn during the minute, force an attack to miss you as a reaction.", key: "humFlorensisLivingFolklore" }
    },
    {
      _id: "HUMNEANDOLDHUNT1", identifier: "human-neanderthal-old_hunt",
      name: "Human (Neanderthal): Old Hunt",
      requirements: "Human (Neanderthal)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"Endurance predation, but metaphysical."</em></p>
<p><strong>Old Hunt (1/Soma Break).</strong> Choose a target you can see and mark them for 1 hour. You always know the direction to them, and once per turn you deal +tier damage to them when you hit.</p>`,
      callout: { label: "Old Hunt", recovery: "1/Soma Break", action: "Action (mark target)", summary: "Mark target for 1 hour: know direction to them, deal +tier damage 1/turn on hit.", key: "humNeanderthalOldHunt" }
    },
    {
      _id: "HUMNEANDPROTECT1", identifier: "human-neanderthal-protective_instinct",
      name: "Human (Neanderthal): Protective Instinct",
      requirements: "Human (Neanderthal)",
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"Someone moves toward your people. You move first."</em></p>
<p><strong>Protective Instinct (tier uses / Soma Break).</strong> Reaction — when an ally within 10 ft is hit, reduce the damage by 1d6 + your tier.</p>`,
      callout: { label: "Protective Instinct", recovery: "tier uses / Soma Break", action: "Reaction (ally within 10 ft hit)", summary: "Reduce damage to a hit ally within 10 ft by 1d6 + tier. Tier-many uses per Soma Break.", key: "humNeanderthalProtectiveInstinct" }
    },
  ].map(it => ({
    ...it,
    type: "feat",
    img: HUMAN_IMG,
    bbttccFlag: { kind: "human", lineage: "Human", version: "2.0.0", date: "2026-04-29" }
  }));

  const buildDesc = (it) => it.base + "\n" + calloutFor(it.callout);

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
      flags: { dnd5e: { originType: "feat" }, bbttcc: it.bbttccFlag },
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

  ui.notifications.info(`Human seed/scrub: ${created} created, ${scrubOK} scrubbed (${scrubSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
