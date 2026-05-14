// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Seed or scrub Qliph-Scarred (3 Tier-I feats)
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent — sentinel-gated. Creates missing items in
// bbttcc-master-content.ancestries with full canon description + per-use
// callout baked in; rewrites present items' descriptions to canon. Walks
// pack docs + every actor instance.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID   = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";
  const SENTINEL  = "data-ft-canon-qliph-scarred=\"v1\"";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const ITEMS = [
    {
      _id: "QLIPHCHTHONIC001",
      name: "Qliph-Scarred (Chthonic): What the Deep Dark Taught You",
      identifier: "qliph_scarred_chthonic_tier1",
      requirements: "Qliph-Scarred (Chthonic)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Qliph_Scarred_1.png",
      bbttccFlag: { kind: "qliph_scarred", feature: "deep_dark_taught", lineage: "Chthonic", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"There are ways to move that the sun never got to review."</em></p>
<p><strong>What the Deep Dark Taught You (1/Soma Break).</strong> Bonus action — sink partially into shadow, earth, or stone. For up to 1 minute, while sunken you gain:</p>
<ul>
  <li>Reroll the lowest die on Stealth (Intrigue) checks.</li>
  <li>Difficult terrain costs you no extra movement.</li>
  <li>You can move through spaces 1 foot wide.</li>
  <li>Resistance to qliphothic damage.</li>
</ul>
<p>The effect ends early if you are fully submerged in running water or take sephirotic damage.</p>`,
      callout: {
        label: "What the Deep Dark Taught You", recovery: "1/Soma Break", action: "Bonus action (1-min duration)",
        summary: "Sink into shadow/earth/stone for up to 1 min: reroll-lowest on Stealth · ignore difficult terrain · squeeze through 1-ft gaps · resist qliphothic damage. Ends early on running water or sephirotic damage.",
        key: "qliphChthonicDeepDark"
      }
    },
    {
      _id: "QLIPHDIABOLIC001",
      name: "Qliph-Scarred (Diabolic): What's Inside You",
      identifier: "qliph_scarred_diabolic_tier1",
      requirements: "Qliph-Scarred (Diabolic)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Qliph_Scarred_1.png",
      bbttccFlag: { kind: "qliph_scarred", feature: "whats_inside_you", lineage: "Diabolic", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"It wasn't your voice. It was a voice you agreed to share."</em></p>
<p><strong>What's Inside You (1/Soma Break).</strong> Action — let the splinter speak. Choose one humanoid you can see within 30 ft who can hear and understand a language you know. They make a Soul check vs. your Resolve.</p>
<p><strong>Failure:</strong> they are <strong>Calmed</strong> by you for 1 minute, or until they take damage or witness you attack them or someone they consider an ally.</p>
<p><strong>Success:</strong> they know someone else briefly spoke through your mouth and can describe it to others — they are probably going to tell their friends.</p>`,
      callout: {
        label: "What's Inside You", recovery: "1/Soma Break", action: "Action (30-ft target)",
        summary: "One humanoid in 30 ft makes Soul check vs your Resolve. Fail → Calmed by you for 1 min (or until damaged / witnesses you attack). Success → they know it happened and may talk.",
        key: "qliphDiabolicWhatsInside"
      }
    },
    {
      _id: "QLIPHHUSK0000001",
      name: "Qliph-Scarred (Husk): The Quiet Inside",
      identifier: "qliph_scarred_husk_tier1",
      requirements: "Qliph-Scarred (Husk)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Qliph_Scarred_1.png",
      bbttccFlag: { kind: "qliph_scarred", feature: "quiet_inside", lineage: "Husk", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"They looked for you in all the usual places. None of them were the right shape."</em></p>
<p><strong>The Quiet Inside (1/Soma Break).</strong> Reaction — when you are targeted by a divination, mind-reading, or truth-detection effect, force the caster to roll their effect against your Resolve instead of its normal save DC.</p>
<p><strong>Failure:</strong> the effect returns nothing — no partial information, no awareness that a target was present.</p>
<p><strong>Success:</strong> you take 1 point of Stress from the pressure of the probe.</p>`,
      callout: {
        label: "The Quiet Inside", recovery: "1/Soma Break", action: "Reaction (when probed)",
        summary: "When divination / mind-read / truth-detect targets you, force caster to roll vs your Resolve. Fail → effect returns nothing, no detection. Success → 1 Stress.",
        key: "qliphHuskQuietInside"
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

  ui.notifications.info(`Qliph-Scarred seed/scrub: ${created} created, ${scrubOK} scrubbed (${scrubSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
