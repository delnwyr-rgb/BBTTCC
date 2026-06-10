// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Append Per-Use callouts (Phase 7 — Discipline kit + subclasses)
// ─────────────────────────────────────────────────────────────────────────────
// Surfaces 16 buried per-uses across the older class-kit and subclass items
// for the four caster disciplines. Excluded from this pass:
//
//   • Parent class docs (cosmic_linguist, wyrdlens-adept, dreamwalker,
//     pactkeeper) — Phase 6 already stamped their per-feature children.
//   • Pure-overview "resource explainer" docs (cosmic_linguist_resonance_strain,
//     pactkeeper_core_features) — the actual spend lives on the dispatcher
//     items (resonance_channel_action / spend_civic_charge), which ARE stamped.
//
// Pack scope: bbttcc-master-content.classes (all 16 live there).
// Sentinel-gated on data-ft-per-use-key. Idempotent.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // [label, recovery, action, summary, key]
  const A = {
    // ── Cosmic Linguist kit ──────────────────────────────────────────────────
    "cosmic_linguist_resonance_channel_action": ["Resonance Channel (Spend)", "1/round (gain)", "Free (with manifestation)", "Spend 1 Resonance Die and pick one channel: +1 Resolve DC · add an extra damage/effect die · extend duration one step · impose roll 3d10 keep lowest 2 on one defense · stabilize against counter/dispel.", "clResChanAct"],
    "cosmic_linguist_resonance_channel":        ["Resonance Channel",          "Pool-spend",     "Free (with manifestation)", "Each Resonance Die spent stacks one Channel benefit on the manifestation. Aggressive use (forcing contradiction or misaligned power) may add Strain — GM call.",                                                                          "clResChan"],

    // ── Wyrdlens — Foresight refraction ─────────────────────────────────────
    "wyrdlens-refraction-foresight-split-beam":   ["Split Beam",         "Trigger (defense success)", "Free (after success)",     "When you succeed on a defense check, an ally within 30 ft you can see gains advantage on their next defense check within the next minute. Use it before the minute ends or it's lost.",                                                  "wlForesightSplit"],
    "wyrdlens-refraction-foresight-lens-ledger":  ["Lens Ledger",        "Tally-based",                "Free (passive bookkeeping)", "When a Foresight Refraction die converts a failure into a success, mark a tally. With 2+ tallies at scene end, gain an initiative bonus on a future scene of your choice; ledger then resets to 0.",                                       "wlForesightLedger"],
    "wyrdlens-refraction-foresight-refraction":   ["Foresight Refraction", "2d20/scene + 1/Strategic Turn", "Free (declare before d20)", "At scene start, roll 2d20 in secret as refraction dice. Before any d20 (yours or anyone's) replace it with one stored die — declared before the roll. Strategic: 1/Turn, spend 1 Intrigue OP to force an enemy faction reroll.",      "wlForesightRefr"],

    // ── Wyrdlens — Truth refraction ─────────────────────────────────────────
    "wyrdlens-refraction-truth-prism-ledger":     ["Prism Ledger",       "10-min rite",               "Downtime (10 min)",         "Spend 10 minutes on charts/string maps/numerology focused on a planned Alignment Shift. GM tells you whether the upcoming Align-Shift DC is trending easier / normal / harder. Forecast only — no exact numbers.",                       "wlTruthPrism"],
    "wyrdlens-refraction-truth-clear-signal":     ["Clear the Signal",   "tier uses / Soma Break",     "Reaction",                  "Cancel a deceit-based penalty (illusion-imposed disadvantage, fear propaganda, manipulative magic) on one roll within 60 ft. Doesn't end the underlying effect — just refuses to let this moment be distorted. Recovers on Soma Break.", "wlTruthClear"],
    "wyrdlens-refraction-truth-truth-refraction": ["Truth Refraction",   "1/Strategic Turn (1 Intrigue OP)", "Strategic",         "When your faction makes a Spark Identification roll, spend 1 Intrigue OP: if the d20 is 9 or lower, treat it as a 10 instead. Bends the investigation away from false positives — doesn't guarantee success.",                          "wlTruthRefr"],
    "wyrdlens-refraction-truth-researchers-eye":  ["Researcher's Eye",   "Passive + 10-min study",    "Passive / Downtime",        "Advantage on Occult (Mind), Faith (Soul), and Investigation (Mind) checks analyzing occult texts, Spark artifacts, glyphs/wards/Qliphothic sigils. After 10 min of study, GM owes at least one solid clue even on a low roll.",          "wlTruthEye"],

    // ── Wyrdlens — Mercy refraction ─────────────────────────────────────────
    "wyrdlens-refraction-mercy-mercy-refraction": ["Mercy Refraction",   "1/scene",                   "Reaction",                  "When a creature within 30 ft would drop to 0 Integrity, refract the outcome to non-lethal: target falls unconscious-but-stable. If this directly forces a surrender / stand-down / captured-alive resolution, faction gains +1 Diplomacy OP next Strategic Turn.", "wlMercyRefr"],

    // ── Dreamwalker — Sapphire ──────────────────────────────────────────────
    "dreamwalker-sapphire-lucid-step":            ["Lucid Step",         "1/Strategic Turn (1 Soft Power OP)", "Strategic",       "When your faction generates or receives a Spark Lead, spend 1 Soft Power OP for a Sapphire Lucidity check: learn whether the next Spark is Conceptual, Vestigial, or Animate. No power level / danger / location info — class only.",  "dwSapphireLucid"],
    "dreamwalker-sapphire-gate-anchor":           ["Gate Anchor",        "Once per Hex/day",          "Downtime (10 min)",         "Meditate 10 min in a Hex to anchor it. Until your next Soma Break, gain advantage on one attack/attribute/defense check made in that Hex — chosen after rolling but before the GM declares the result.",                                  "dwSapphireGate"],
    "dreamwalker-sapphire-blue-meridian":         ["Blue Meridian",      "1/Soma Break (1-min stance)", "Action (open)",          "Open the Meridian for 1 minute: teleport up to 30 ft as movement/bonus action, jump to any Gate Anchor within 300 ft (no solid barriers crossed), allies within 10 ft of that Anchor may follow as a reaction. Each teleport grants advantage on your next defense check before end of next turn. Strategic Echo: if used to stabilize a Spark Step / metaphysical crisis, reduce a relevant Darkness Track by 1.", "dwSapphireMerid"],

    // ── Dreamwalker — Thousandfold ──────────────────────────────────────────
    "dreamwalker-thousand-persona-cache":         ["Persona Cache",      "Per-scene swap (1 Soft Power OP)", "Bonus action",      "Maintain `tier` cached personas (name, demeanor, short cover). In a Courtly Intrigue / infiltration / social scene, spend 1 Soft Power OP to swap into a cached persona; gain advantage on your next Stealth (Intrigue/Presence) or Diplomacy (Presence) check that scene.", "dwThousandPersona"],

    // ── Dreamwalker — Quiet ─────────────────────────────────────────────────
    "dreamwalker-quiet-somnolent-peace":          ["Somnolent Peace",    "1/scene",                   "Reaction",                  "When a creature you can see within 30 ft would be reduced to 0 Integrity, refract the outcome: target drops to 1 Integrity and falls unconscious (dream-saturated, non-magical for rules). The blow still lands — it lands on a future that can be talked to later.", "dwQuietPeace"],

    // ── Pactkeeper kit ──────────────────────────────────────────────────────
    "pactkeeper_spend_civic_charge":              ["Spend Civic Charge", "1/round (gain)",            "Free (as needed)",          "Spend 1 Civic Charge Die: roll it and pick one — Stabilization (reduce damage/panic/corruption/fallout by rolled amount) · Authority Boost (+roll to a manifestation DC, contested roll, or enforcement) · Enforcement (force a reroll vs. a Contract or Precedent — target takes worse) · Containment (catastrophic → controlled) · Closure (end an ongoing effect cleanly).", "pkSpendCivic"],
  };

  const PACK_ID = "bbttcc-master-content.classes";

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

  // ── Pack pass ──────────────────────────────────────────────────────────────
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  const idx = await pack.getIndex({ fields: ["name"] });
  let packOK = 0, packSkip = 0, packMissing = [];
  const seenIds = new Set();
  for (const e of idx) {
    const doc = await pack.getDocument(e._id);
    const id  = doc.system?.identifier ?? "";
    const spec = A[id];
    if (!spec) continue;
    seenIds.add(id);
    const r = await patchDoc(doc, spec);
    if (r.status === "ok") {
      packOK++;
      console.log(`  [pack] OK    ${doc.name}`);
    } else {
      packSkip++;
      console.log(`  [pack] skip  ${doc.name} (already patched)`);
    }
  }
  for (const id of Object.keys(A)) {
    if (!seenIds.has(id)) packMissing.push(id);
  }
  if (wasLocked) await pack.configure({ locked: true });

  // ── Actor pass ─────────────────────────────────────────────────────────────
  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const id = item.system?.identifier ?? "";
      const spec = A[id];
      if (!spec) continue;
      const r = await patchDoc(item, spec);
      if (r.status === "ok") {
        actorOK++;
        touched = true;
        console.log(`  [${actor.name}] OK  ${item.name}`);
      }
    }
    if (touched) actorTouched++;
  }

  if (packMissing.length) {
    console.warn("Identifiers not found in pack:", packMissing);
  }

  ui.notifications.info(
    `Phase 7 discipline kit/subclass callouts: pack ${packOK}/${packOK + packSkip} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.` +
    (packMissing.length ? ` (${packMissing.length} identifiers missing — see console)` : "")
  );
})();
