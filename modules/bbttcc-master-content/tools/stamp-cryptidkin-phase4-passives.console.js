// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Stamp Cryptidkin Phase 4 passive flags
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent — sentinel-gated.
//
// Wires Phase 4 passive-AE engine for the Cryptidkin batch:
//   1. cryptidkin-chupacabra-skittering-night-feeder
//      - flags.fourththing.passives.movement.climbEqualsWalk = true
//        (consumed by FourthThingActor.prepareDerivedData → sys.derived.movement)
//      - flags.fourththing.rerolls += Stealth-check reroll-lowest (note: dark/ruins/confined)
//      - flags.fourththing.rerolls += Attack reroll-lowest (note: surprised/restrained/etc)
//   2. cryptidkin-jackalope-startle-reflex
//      - description scrub: remove the Horns of Bad Luck paragraph; that
//        capability is now a granted Manifestation, not a passive on this feat.
//
// Walks all bbttcc-* Item packs + every actor with the matching identifiers.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const REROLL_NOTE_STEALTH = "in darkness, ruins, or confined environments";
  const REROLL_NOTE_ATTACK  = "first attack vs surprised, unconscious, restrained, or isolated targets";
  const FLAG_SENTINEL_CLIMB = "passives.movement.climbEqualsWalk";
  const STARTLE_SCRUB_SENTINEL = "data-ft-canon-startle-reflex=\"v1\"";

  const STARTLE_SCRUB_DESC =
`<div ${STARTLE_SCRUB_SENTINEL} style="display:none"></div>
<p><em>"You aren't fast because you're fast. You're fast because the world keeps deciding to miss."</em></p>
<p><strong>Startle Reflex (1/Soma Break).</strong> Reaction when you are targeted by an attack roll or fail an Intrigue check — move up to 10 feet without provoking opportunity attacks.</p>
<p><strong>Horns of Bad Luck.</strong> Your natural horns ship as a Jackalope-only Manifestation when you take the heritage — see your Manifestations tab. When violence escalates around you, the GM may describe unsettling omens tied to your presence — a mirror crack, a dropped knife, a candle going out the wrong direction.</p>
<div data-ft-per-use="1" data-ft-per-use-key="crypJackStartleReflex" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>Startle Reflex</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> 1/Soma Break &nbsp;·&nbsp; <strong>Action:</strong> Reaction &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">When targeted by an attack roll or you fail an Intrigue check, move up to 10 ft. without provoking opportunity attacks.</div>
</div>`;

  const SKITTER_REROLLS = [
    { context: "check", skill: "stealth", mode: "reroll-lowest", note: REROLL_NOTE_STEALTH },
    { context: "attack",                  mode: "reroll-lowest", note: REROLL_NOTE_ATTACK  }
  ];

  const stampSkittering = async (doc) => {
    const flags = foundry.utils.deepClone(doc.flags ?? {});
    flags.fourththing ??= {};
    flags.fourththing.passives ??= {};
    flags.fourththing.passives.movement ??= {};
    flags.fourththing.rerolls ??= [];

    let changed = false;

    if (flags.fourththing.passives.movement.climbEqualsWalk !== true) {
      flags.fourththing.passives.movement.climbEqualsWalk = true;
      changed = true;
    }

    // Merge reroll grants — keep idempotent by checking note-text uniqueness.
    const existingNotes = new Set(flags.fourththing.rerolls.map(g => g.note ?? ""));
    for (const grant of SKITTER_REROLLS) {
      if (!existingNotes.has(grant.note)) {
        flags.fourththing.rerolls.push(grant);
        changed = true;
      }
    }

    if (!changed) return { status: "skip" };
    await doc.update({ flags });
    return { status: "ok" };
  };

  const scrubStartleReflex = async (doc) => {
    const val = doc.system?.description?.value ?? "";
    if (val.includes(STARTLE_SCRUB_SENTINEL)) return { status: "skip" };
    await doc.update({ "system.description.value": STARTLE_SCRUB_DESC });
    return { status: "ok" };
  };

  const ROUTES = {
    "cryptidkin-chupacabra-skittering-night-feeder": stampSkittering,
    "cryptidkin-jackalope-startle-reflex":          scrubStartleReflex,
  };

  let packOK = 0, packSkip = 0;
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        const id = doc.system?.identifier ?? "";
        const fn = ROUTES[id];
        if (!fn) continue;
        const r = await fn(doc);
        if (r.status === "ok") {
          packOK++;
          console.log(`  [${pack.metadata.id}] OK  ${doc.name}`);
        } else {
          packSkip++;
        }
      }
    } catch (e) {
      console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`);
    }
    if (wasLocked) await pack.configure({ locked: true });
  }

  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const id = item.system?.identifier ?? "";
      const fn = ROUTES[id];
      if (!fn) continue;
      const r = await fn(item);
      if (r.status === "ok") {
        actorOK++; touched = true;
        console.log(`  [${actor.name}] OK  ${item.name}`);
      }
    }
    if (touched) actorTouched++;
  }

  // Force a sheet re-prepare so derived.movement updates immediately for any
  // actor with the Skittering Night-Feeder item.
  for (const actor of game.actors) actor.prepareData();

  ui.notifications.info(
    `Cryptidkin Phase 4 passives: pack ${packOK} updated (${packSkip} already canon), ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
