// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Append Per-Use callouts (D&D-vocab scrub Phase 3 — Cryptidkin batch)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent.
// 7 ancestry feats — Cryptidkin batch from the 2026-04-29 Phase 3 sprint.
//
// JS routing matches by item.system.identifier — the dispatcher uses the
// data-driven CHAR_OPT_ABILITIES table in
// systems/fourththing/ft-class-automation.js (Cryptidkin entries added
// 2026-04-29 right below the Circuitborn pilot block).
//
// Crossroads Hare carries TWO independent 1/Soma Break uses (Vanish +
// Rumor Runs Faster) surfaced via the multi-ability picker.
//
// Walks ALL Item packs whose id begins with `bbttcc-` plus all actors so
// live characters with imported copies pick up the callout.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // identifier → [label, recovery, action, summary, callout-key]
  const A = {
    "cryptidkin-chupacabra-blood-drinker": [
      "Blood-Drinker", "1/Soma Break", "Triggered (on melee hit)",
      "When you hit with a melee attack, bite for 1d6 + Body qliphothic damage on top of the attack, and gain temp Integrity equal to the qliphothic damage dealt.",
      "crypChupBloodDrinker"
    ],
    "cryptidkin-chupacabra-skittering-night-feeder": [
      "First Strike", "1/Soma Break", "Triggered (on hit)",
      "When you hit a creature that is surprised, unconscious, restrained, or isolated from its allies, the strike deals an additional 1d6 damage of the weapon's type.",
      "crypChupFirstStrike"
    ],
    "cryptidkin-furrykin-folklore-echo": [
      "Folklore Echo", "1/Soma Break", "Bonus action",
      "For 1 min., become a story: reroll lowest on Stealth/Intimidation; foes who haven't seen you act roll 3d10 keep lowest 2 vs. you; pass through any space larger than Tiny w/o OAs; witnesses' descriptions stay vague.",
      "crypFurFolkloreEcho"
    ],
    "cryptidkin-furrykin-pack-tongue": [
      "Pack Tongue", "1/Soma Break", "Bonus action",
      "Pick one ally within 30 ft. who can see or hear you. They reroll the lowest die on the next Diplomacy, Intimidation, Stealth, or Empathy check before the start of your next turn.",
      "crypFurPackTongue"
    ],
    "cryptidkin-jackalope-cant-catch-me": [
      "Can't Catch Me", "1/Soma Break", "Bonus action",
      "Take the Dash or Disengage action.",
      "crypJackCantCatch"
    ],
    "cryptidkin-jackalope-crossroads-hare": [
      "Crossroads Hare", "TWO 1/Soma Break uses (each tracked independently)", "Picker (Vanish · Rumor Runs Faster)",
      "Vanish: at 0 Integrity, instead vanish; reappear next turn in an unoccupied space within 1 mile you've personally visited, at 1 Integrity + 1 Stress, leaving behind a token. · Rumor Runs Faster: spend 1 min. of Clarity hold to ask the GM what one nearby community is currently afraid of (at least one truth).",
      "crypJackCrossroadsHare"
    ],
    "cryptidkin-jackalope-startle-reflex": [
      "Startle Reflex", "1/Soma Break", "Reaction",
      "When targeted by an attack roll or you fail an Intrigue check, move up to 10 ft. without provoking opportunity attacks.",
      "crypJackStartleReflex"
    ],
  };

  const calloutFor = ([label, recovery, action, summary, key]) =>
`<div data-ft-per-use="1" data-ft-per-use-key="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const patchDoc = async (doc, spec) => {
    const val = doc.system?.description?.value ?? "";
    const keyAttr = `data-ft-per-use-key="${spec[4]}"`;
    if (val.includes(keyAttr)) return { status: "skip" };
    await doc.update({ "system.description.value": val + calloutFor(spec) });
    return { status: "ok" };
  };

  // Pack pass — walk every Item pack from bbttcc-* and patch any item whose
  // identifier matches.
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
        const spec = A[id];
        if (!spec) continue;
        const r = await patchDoc(doc, spec);
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

  // Actor pass
  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const id = item.system?.identifier ?? "";
      const spec = A[id];
      if (!spec) continue;
      const r = await patchDoc(item, spec);
      if (r.status === "ok") {
        actorOK++; touched = true;
        console.log(`  [${actor.name}] OK  ${item.name}`);
      }
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(
    `Cryptidkin batch callouts: pack ${packOK} updated (${packSkip} already had marker), ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
