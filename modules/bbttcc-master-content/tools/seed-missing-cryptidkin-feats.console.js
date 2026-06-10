// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Seed missing Cryptidkin tier feats into bbttcc-master-content.ancestries
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent — skips items already present
// (matched by system.identifier).
//
// Authors the 5 missing Cryptidkin Phase-3 feats:
//   - cryptidkin-chupacabra-blood-drinker          (T1 / L5 surfacing)
//   - cryptidkin-chupacabra-skittering-night-feeder (T4 / L17)
//   - cryptidkin-jackalope-cant-catch-me           (T2 / L5)
//   - cryptidkin-jackalope-crossroads-hare         (T4 / L17)
//   - cryptidkin-jackalope-startle-reflex          (T1 / L5 surfacing)
//
// Source content extracted from packs/ancestries/cryptidkin_*_tier*.json
// (those files were never compiled into the live LevelDB pack). RFI-canon
// scrubbed during seeding: drops [TODO(adv-call)] markers, collapses doubled
// parentheticals, normalizes "qliphothic damage (necrotic)" → "qliphothic
// damage", uses "(1/Soma Break)" form. Per-use callouts baked in with the
// same sentinel the stamper uses, so a later stamper re-run no-ops these.
//
// Preserves _id values from the original JSONs (16-char alphanum, validated
// per Foundry document id constraint). Folder id matches the existing
// Cryptidkin folder in the pack.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";
  const FOLDER_ID = "f95fcfa18822c4e3";

  const calloutFor = ({ label, recovery, action, summary, key }) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  // 5 missing items — base description (RFI-canon-scrubbed) + per-use callout.
  const ITEMS = [
    {
      _id: "CKCHUPATIER1PLC0",
      name: "Cryptidkin (Chupacabra): Blood-Drinker",
      identifier: "cryptidkin-chupacabra-blood-drinker",
      requirements: "Cryptidkin (Chupacabra)",
      level: null,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Cryptidkin_Chupacabra_1.png",
      bbttccFlag: { kind: "cryptidkin", feature: "blood_drinker", lineage: "Chupacabra", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<p><em>"The goats are gone. So is the witness. So is the noise."</em></p>
<p><strong>Blood-Drinker (1/Soma Break).</strong> When you hit a creature with a melee attack, you may bite. Deal 1d6 + Body modifier qliphothic damage on top of the attack's normal damage, and gain temporary Integrity equal to the qliphothic damage dealt.</p>
<p><strong>Hex-Sense.</strong> You can smell magical residue the way most people smell rain. Once per scene, when something supernatural has happened in a place within the last 24 hours, the GM tells you so — and roughly what colour it was.</p>`,
      callout: {
        label: "Blood-Drinker", recovery: "1/Soma Break", action: "Triggered (on melee hit)",
        summary: "When you hit with a melee attack, bite for 1d6 + Body qliphothic damage on top of the attack, and gain temp Integrity equal to the qliphothic damage dealt.",
        key: "crypChupBloodDrinker"
      }
    },
    {
      _id: "fd3175ce8237dfc8",
      name: "Cryptidkin (Chupacabra): Skittering Night-Feeder",
      identifier: "cryptidkin-chupacabra-skittering-night-feeder",
      requirements: "Cryptidkin (Chupacabra)",
      level: 17,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Cryptidkin_Chupacabra_1.png",
      bbttccFlag: { kind: "cryptidkin", feature: "skittering_night_feeder", lineage: "Chupacabra", tierLevel: 17, version: "2.0.0", date: "2026-04-29" },
      base:
`<p><em>"By the time anyone says your name out loud, you're already three farms over."</em></p>
<p><strong>Skittering Horror.</strong> You gain a climbing speed equal to your walking speed. Reroll the lowest die on Stealth (Intrigue) checks made in darkness, ruins, or confined environments such as bunkers, farmsteads, or dense structures.</p>
<p><strong>Night-Feeder.</strong> When you attack a creature that is surprised, unconscious, restrained, or isolated from its allies, reroll the lowest die on the first attack roll you make against it this turn.</p>
<p><strong>First Strike (1/Soma Break).</strong> When you hit a creature meeting any of those conditions, the strike deals an additional 1d6 damage of the weapon's type.</p>`,
      callout: {
        label: "First Strike", recovery: "1/Soma Break", action: "Triggered (on hit)",
        summary: "When you hit a creature that is surprised, unconscious, restrained, or isolated from its allies, the strike deals an additional 1d6 damage of the weapon's type.",
        key: "crypChupFirstStrike"
      }
    },
    {
      _id: "KvTZJ08kUbqxRijn",
      name: "Cryptidkin (Jackalope): Startle Reflex",
      identifier: "cryptidkin-jackalope-startle-reflex",
      requirements: "Cryptidkin (Jackalope)",
      level: null,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Cryptidkin_Jackalope_1.png",
      bbttccFlag: { kind: "cryptidkin", feature: "startle_reflex", lineage: "Jackalope", tierLevel: 0, version: "2.0.0", date: "2026-04-29" },
      base:
`<p><em>"You aren't fast because you're fast. You're fast because the world keeps deciding to miss."</em></p>
<p><strong>Startle Reflex (1/Soma Break).</strong> Reaction when you are targeted by an attack roll or fail an Intrigue check — move up to 10 feet without provoking opportunity attacks.</p>
<p><strong>Horns of Bad Luck.</strong> You possess natural horns. You can use them to make unarmed strikes that deal 1d6 kinetic damage (piercing) on a hit. When violence escalates around you, the GM may describe unsettling omens tied to your presence — a mirror crack, a dropped knife, a candle going out the wrong direction.</p>`,
      callout: {
        label: "Startle Reflex", recovery: "1/Soma Break", action: "Reaction",
        summary: "When targeted by an attack roll or you fail an Intrigue check, move up to 10 ft. without provoking opportunity attacks.",
        key: "crypJackStartleReflex"
      }
    },
    {
      _id: "d677de45803aae2b",
      name: "Cryptidkin (Jackalope): Can't Catch Me",
      identifier: "cryptidkin-jackalope-cant-catch-me",
      requirements: "Cryptidkin (Jackalope)",
      level: 5,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Cryptidkin_Jackalope_1.png",
      bbttccFlag: { kind: "cryptidkin", feature: "cant_catch_me", lineage: "Jackalope", tierLevel: 5, version: "2.0.0", date: "2026-04-29" },
      base:
`<p><em>"By the time the rifle goes off, the rumor has already moved house."</em></p>
<p><strong>Can't Catch Me (1/Soma Break).</strong> Bonus action — take the Dash or Disengage action.</p>
<p><strong>Light-Footed.</strong> Difficult terrain caused by undergrowth, brush, snow drifts, or scrap-strewn ground does not slow you. You can move along narrow ledges, fences, branches, or rooftops at full speed without making a check unless they are actively crumbling.</p>`,
      callout: {
        label: "Can't Catch Me", recovery: "1/Soma Break", action: "Bonus action",
        summary: "Take the Dash or Disengage action.",
        key: "crypJackCantCatch"
      }
    },
    {
      _id: "4da8b68128a3e4a8",
      name: "Cryptidkin (Jackalope): Crossroads Hare",
      identifier: "cryptidkin-jackalope-crossroads-hare",
      requirements: "Cryptidkin (Jackalope)",
      level: 17,
      img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/Cryptidkin_Jackalope_1.png",
      bbttccFlag: { kind: "cryptidkin", feature: "crossroads_hare", lineage: "Jackalope", tierLevel: 17, version: "2.0.0", date: "2026-04-29" },
      base:
`<p><em>"Of course you came back. You weren't supposed to be there to begin with."</em></p>
<p><strong>Crossroads Hare (1/Soma Break).</strong> When you would be reduced to 0 Integrity, you may instead vanish into the place between places. At the start of your next turn, you reappear in any unoccupied space within 1 mile that you have personally visited and clearly remember, with 1 Integrity and one level of Stress. You leave behind a single recognizable token at the spot you vanished from — a horn, a tuft of fur, a footprint that wasn't there before.</p>
<p><strong>The Rumor Runs Faster (1/Soma Break).</strong> Spend 1 minute of focused Clarity hold to ask the GM what one nearby community is currently afraid of. The answer is at least one truth.</p>`,
      callout: {
        label: "Crossroads Hare", recovery: "TWO 1/Soma Break uses (each tracked independently)", action: "Picker (Vanish · Rumor Runs Faster)",
        summary: "Vanish: at 0 Integrity, instead vanish; reappear next turn in an unoccupied space within 1 mile you've personally visited, at 1 Integrity + 1 Stress, leaving behind a token. · Rumor Runs Faster: spend 1 min. of Clarity hold to ask the GM what one nearby community is currently afraid of (at least one truth).",
        key: "crypJackCrossroadsHare"
      }
    },
  ];

  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`Pack not found: ${PACK_ID}`); return; }

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  // Build identifier index of what's already in the pack.
  const existing = new Set();
  try {
    const docs = await pack.getDocuments();
    for (const d of docs) {
      const id = d.system?.identifier;
      if (id) existing.add(id);
    }
  } catch (e) {
    console.warn(`pack scan failed: ${e.message}`);
  }

  let created = 0, skipped = 0;
  const Cls = pack.documentClass; // CONFIG.Item.documentClass binding

  for (const it of ITEMS) {
    if (existing.has(it.identifier)) {
      skipped++;
      console.log(`  SKIP (already present)  ${it.identifier}`);
      continue;
    }
    const descValue = it.base + "\n" + calloutFor(it.callout);
    const data = {
      _id: it._id,
      name: it.name,
      type: "feat",
      img: it.img,
      folder: FOLDER_ID,
      system: {
        description: { value: descValue, chat: "" },
        source: { custom: "Bad Eden", rules: "2024", revision: 2, book: "", license: "" },
        advancement: {},
        identifier: it.identifier,
        requirements: it.requirements,
        prerequisites: { items: [], repeatable: false, level: it.level },
        uses: { spent: 0, recovery: [], max: "" },
        activities: {},
        category: "feature",
        tags: [],
        type: { value: "", subtype: "" },
        properties: []
      },
      effects: [],
      flags: {
        dnd5e: { originType: "feat" },
        bbttcc: it.bbttccFlag
      },
      ownership: { default: 0 }
    };
    try {
      await Cls.create(data, { pack: PACK_ID, keepId: true });
      created++;
      console.log(`  CREATED  ${it.name}  [${it._id}]`);
    } catch (e) {
      console.error(`  FAIL  ${it.identifier} — ${e.message}`);
    }
  }

  if (wasLocked) await pack.configure({ locked: true });

  ui.notifications.info(`Cryptidkin seed: ${created} created, ${skipped} already present.`);
  console.log("DONE");
})();
