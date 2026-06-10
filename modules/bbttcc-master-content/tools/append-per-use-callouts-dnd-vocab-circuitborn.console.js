// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Append Per-Use callouts (D&D-vocab scrub Phase 3 — Circuitborn pilot)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent.
// 9 ancestry feats — the Circuitborn buried-per-use pilot batch from the
// 2026-04-29 D&D-vocab scrub sprint Phase 3.
//
// JS routing matches by item.system.identifier — the dispatcher uses the
// data-driven CHAR_OPT_ABILITIES table in
// systems/fourththing/ft-class-automation.js (entries added 2026-04-29).
//
// Walks ALL Item packs under bbttcc-master-content and bbttcc-* (we don't
// hard-code pack ids since Circuitborn feats can be in ancestry-feats AND
// occasionally root JSON drafts). Skip non-matching identifiers.
// Also walks all actors so live characters with imported copies pick up the
// callout.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // identifier → [label, recovery, action, summary, callout-key]
  const A = {
    "circuitborn-exo-bulwark_protocol": [
      "Bulwark Protocol", "1/Soma Break", "Action",
      "For 1 minute, allies within 10 ft. gain +1 Guard and reroll the lowest die on defense checks vs. moved/prone. You must remain conscious.",
      "circExoBulwark"
    ],
    "circuitborn-exo-siegebreaker_frame": [
      "Siegebreaker Frame", "1/Soma Break", "Action",
      "For 1 minute, your attacks ignore resistance to kinetic damage and double damage to objects/structures. Strategic: drop one Facility's defense tier by 1 for one Raid round.",
      "circExoSiegebreaker"
    ],
    "circuitborn-parallax-ghost_in_wires": [
      "Ghost-In-The-Wires", "1/Soma Break", "Action",
      "For 10 min., interface with mechanisms and simple electronics at 30 ft. — doors, lights, locks, speakers. Remote sabotage / mischief, not mind control.",
      "circParGhost"
    ],
    "circuitborn-parallax-perfect_misdirection": [
      "Perfect Misdirection", "1/Soma Break", "Action",
      "For 1 minute, hostiles roll 3d10 keep lowest 2 on attacks vs. you unless they pass a Soul check (DC 8 + tier + Intrigue). Once per minute, force a ranged attack to miss.",
      "circParMisdirection"
    ],
    "circuitborn-salvage-mobile_facility": [
      "Mobile Facility Node", "1/Soma Break", "Action (1 min deploy, 10 min duration)",
      "Deploy a fold-out altar of tools (10 min). Allies within 10 ft. reroll lowest die on crafting / repair / disable checks. Strategic: a Repair activity costs 1 less OP, 1/Turn.",
      "circSalMobileNode"
    ],
    "circuitborn-salvage-patch_logic": [
      "Patch-Logic Field", "1/Soma Break", "Action",
      "For 1 minute, allies within 10 ft. reduce damage from hazards (fire, acid, falling debris, radiation) by your tier (min 1).",
      "circSalPatchLogic"
    ],
    "circuitborn-salvage-scrap_alchemy": [
      "Scrap Alchemy", "1/Soma Break", "Action (10 min crafting)",
      "Convert junk into one: ammo / a simple tool / a small explosive (nonlethal) / a single-use OP chit (+1 Economy or Logistics for the scene).",
      "circSalScrapAlchemy"
    ],
    "circuitborn-synapse-cognition_crown": [
      "Cognition Crown", "1/Soma Break", "Action",
      "For 1 minute, gain resistance to psychic damage and reroll lowest die on Mind/Soul checks. Once during the minute, convert a failed check to success ('recompiling').",
      "circSynCognitionCrown"
    ],
    "circuitborn-synapse-noosphere_hook": [
      "Noosphere Hook", "tier uses / Soma Break", "Action",
      "Lock onto an observed creature/location/faction. For 10 min., know its general direction and reroll lowest die on tracking checks (digital/social included).",
      "circSynNoosphereHook"
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

  // Pack pass — walk every Item pack from bbttcc-master-content.* and bbttcc-*
  // and patch any item whose identifier matches.
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
    `Circuitborn pilot callouts: pack ${packOK} updated (${packSkip} already had marker), ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
