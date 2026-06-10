// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Seed or scrub Sephirotic Scion (3 Tier-I feats)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent — sentinel-gated.
//
// If item missing in live pack: creates it with full canon description + per-use
// callout baked in. If present: rewrites description to canon (RFI vocab,
// rerolls-lowest, Soma Break) with callout, sentinel-gated.
//
// Walks bbttcc-master-content.ancestries (pack create) + all bbttcc-* Item
// packs + every actor instance for in-place rewrites.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID   = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";
  const SENTINEL  = "data-ft-canon-sephirotic=\"v1\"";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const ITEMS = [
    {
      _id: "SEPHCHERUBIC0001",
      name: "Sephirotic Scion (Cherubic): The Gate Knows You",
      identifier: "sephirotic_scion_cherubic_tier1",
      requirements: "Sephirotic Scion (Cherubic)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Sephirotic_Scion_1.png",
      bbttccFlag: { kind: "sephirotic_scion", feature: "the_gate_knows_you", lineage: "Cherubic", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"Everything is a door if you can read the seams."</em></p>
<p><strong>The Gate Knows You (1/Soma Break).</strong> Reaction — when a creature you can see within 30 ft attempts to open, close, lock, unlock, cross, or pass through a door, gate, threshold, ley-line gate, or named boundary, the target rolls 3d10 keep lowest 2 on any check or defense check related to that crossing. The boundary listens to you.</p>`,
      callout: {
        label: "The Gate Knows You", recovery: "1/Soma Break", action: "Reaction (within 30 ft)",
        summary: "Force a creature attempting to open/close/cross any door, gate, threshold, ley-line gate, or named boundary to roll 3d10 keep lowest 2 on the related check or defense.",
        key: "sephCherubicGate"
      }
    },
    {
      _id: "SEPHOPHANIC00001",
      name: "Sephirotic Scion (Ophanic): The Wheel Never Stops",
      identifier: "sephirotic_scion_ophanic_tier1",
      requirements: "Sephirotic Scion (Ophanic)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Sephirotic_Scion_1.png",
      bbttccFlag: { kind: "sephirotic_scion", feature: "wheel_never_stops", lineage: "Ophanic", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"There is no angle that is not a front, to a thing with no back."</em></p>
<p><strong>The Wheel Never Stops (1/Soma Break).</strong> When you move at least 10 ft on your turn, as a bonus action take either one weapon attack OR the Dash action. Additional uses per Soma Break cost 1 Surge each (player-managed via Surge controls).</p>`,
      callout: {
        label: "The Wheel Never Stops", recovery: "1/Soma Break (+1 Surge per extra use)", action: "Bonus action (after moving 10 ft)",
        summary: "After moving ≥ 10 ft, bonus action: one weapon attack OR Dash. Each additional use this Soma Break costs 1 Surge — spend manually.",
        key: "sephOphanicWheel"
      }
    },
    {
      _id: "SEPHSERAPHIC0001",
      name: "Sephirotic Scion (Seraphic): Cleansing Breath",
      identifier: "sephirotic_scion_seraphic_tier1",
      requirements: "Sephirotic Scion (Seraphic)",
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Sephirotic_Scion_1.png",
      bbttccFlag: { kind: "sephirotic_scion", feature: "cleansing_breath", lineage: "Seraphic", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<div ${SENTINEL} style="display:none"></div>
<p><em>"What couldn't stand the light was never going to last anyway."</em></p>
<p><strong>Cleansing Breath (1/Soma Break).</strong> Action — exhale a 15-ft cone of radiant fire. Each creature in the cone makes an Intrigue check vs. your Resolve. On a failure, take 2d10 exploding sephirotic damage (flavor: holy fire); half on a success.</p>
<p><strong>Tier scaling:</strong> 3d10 at Tier 2 · 4d10 at Tier 3 · 5d10 at Tier 4.</p>`,
      callout: {
        label: "Cleansing Breath", recovery: "1/Soma Break", action: "Action (15-ft cone)",
        summary: "Exhale radiant fire — each creature in the cone makes Intrigue check vs your Resolve. Failure: 2d10 exploding sephirotic (holy fire); success: half. Tier-scaled: T2 3d10, T3 4d10, T4 5d10.",
        key: "sephSeraphicCleansingBreath"
      }
    },
  ];

  const buildDesc = (it) => it.base + "\n" + calloutFor(it.callout);

  // Pass 1: present items → rewrite description (sentinel-gated)
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

  // Pass 2: missing items → create in master-content.ancestries
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
        source: { custom: "Bad Eden", rules: "2024", revision: 2, book: "", license: "" },
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

  // Pass 3: actor instances → rewrite description in place
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

  ui.notifications.info(`Sephirotic seed/scrub: ${created} created, ${scrubOK} scrubbed (${scrubSkip} already canon), ${actorOK} actor items updated across ${actorTouched} actors.`);
  console.log("DONE");
})();
