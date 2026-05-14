// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Append Per-Use callouts (Phase 6 — Caster Discipline pilot ladder)
// ─────────────────────────────────────────────────────────────────────────────
// Surfaces the 16 class-feature items shipped by `update-caster-discipline-pilot.macro.js`:
//
//   • Cosmic Linguist  — Initiation 1 / 6 / 11 / 16 (Reach economy)
//   • Wyrdlens Adept   — Tier 1 / 2 / 3 / 4 (Misfire band)
//   • Dreamwalker      — Tier 1 / 2 / 3 / 4 (Clarity pool)
//   • Pactkeeper       — Initiation 1 / 6 / 11 / 16 (Upkeep / concurrency)
//
// Mirrors the Phase 4 idempotent shape: identifier-keyed, name-lookup-across-
// packs unnecessary here (all 16 live in `bbttcc-master-content.classes`),
// pack-walk + actor-walk, sentinel-gated on `data-ft-per-use-key`.
//
// USAGE
//   1. Open F12 console as GM.
//   2. Paste this whole file. Hit Enter.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // [label, recovery, action, summary, key]
  const A = {
    // ── Cosmic Linguist (Reach economy) ─────────────────────────────────────
    "cl_init1_true_name_touch":   ["True-Name Touch",      "At-will (per scene)",  "Bonus (with manifestation)", "Name a target as part of your manifestation. For the rest of the scene, extending that manifestation's Reach to the named target costs 1 less Surge (min 0).",                "clInit1"],
    "cl_init6_translation":       ["Translation",          "1/scene",              "Reaction",                   "When an ally completes a manifestation within Reach, transcribe it into your idiom. Carry their effect at your tier cap until end of next round; pay upkeep from your Clarity.", "clInit6"],
    "cl_mode_sentence":           ["The Sentence",         "Stance (signature)",   "Action (open / drop)",       "Hold to bind primary targets of sustained manifestations by name (mechanical hook for holds, binds, compelled-truth). Pays ongoing upkeep against Clarity.",                    "clMode"],
    "cl_word_that_was":           ["Word That Was",        "1/Soma Break",         "Reaction (after misfire)",   "Re-narrate one of your misfires as if the manifestation had succeeded one tier lower than the tier you spent for. Pay the lower tier's base upkeep.",                              "clInit16"],

    // ── Wyrdlens Adept (Misfire band) ───────────────────────────────────────
    "wyrdlens_adept_tier_1_lens_read":         ["Lens Read",          "1/scene (loan)",       "Free (loan)",                "Your manifestation misfire band is lowered by 1 always. Once per scene, an adjacent ally borrows the reduction by spending 1 of your Clarity.",                                                                              "wlT1"],
    "wyrdlens_adept_tier_2_probability_overlay": ["Probability Overlay", "1/round",              "Free (after roll)",          "Reroll the lowest die on any manifestation roll — yours, or an adjacent ally's.",                                                                                                                                              "wlT2"],
    "wl_mode_refraction":          ["Refraction",         "Stance (signature)",   "Action (open / drop)",       "While held, declare your manifestation last in the round, after seeing what allies and enemies commit to. Pays ongoing upkeep against Clarity.",                                                                                "wlMode"],
    "wl_tikkun_sight":             ["Tikkun Sight",       "1/Soma Break",         "Reaction (after misfire)",   "Treat one of your misfires as if it landed at base tier; convert the Surge it would have spent into Clarity. In a nonviolent scene, also wipes the Corruption tick the gather would have caused.",                              "wlT4"],

    // ── Dreamwalker (Clarity pool) ──────────────────────────────────────────
    "dw_t1_oneiric_reservoir":     ["Oneiric Reservoir",  "Passive",              "—",                          "Clarity max +2. On Soma Break recover Clarity equal to your tier (instead of flat default). Detect Spark resonance in adjacent hexes (carryover).",                                                                            "dwT1"],
    "dw_t2_dream_cache":           ["Dream-Cache",        "1/scene (between)",    "Free (between scenes)",      "Bank one manifestation in a dream slot between scenes; deploy next scene without paying Clarity (still pay upkeep). While the cache is active, reroll lowest on saves vs. illusion / fear / corruption.",                       "dwT2"],
    "dw_mode_walking_lane":        ["The Walking Lane",   "Stance (signature)",   "Action (open / drop)",       "While open, sustained manifestations reach into adjacent realms — ignore one band of cover or distance for one effect per round. GM may attach a narrative hook (someone notices you went somewhere). Pays ongoing upkeep.", "dwMode"],
    "dw_shared_dream":             ["Shared Dream",       "Passive (trigger)",    "—",                          "Allies who Soma Break in your presence regain Clarity equal to half your tier (round up). Carryover: party that breaks together reads the world more clearly together (GM hint on contemplative scenes).",                  "dwT4"],

    // ── Pactkeeper (Upkeep / concurrency) ───────────────────────────────────
    "pk_init1_the_bargain":        ["The Bargain",        "Passive (per pact)",   "—",                          "While a creature/object/place is your bargained Pact subject, you may sustain one additional manifestation on or near them at no extra upkeep against your Clarity.",                                                       "pkInit1"],
    "pk_init6_renegotiate":        ["Renegotiate",        "Unlimited (debt-bound)", "Reaction (on misfire)",    "When one of your manifestations would misfire, accept a GM-set narrative debt and treat the manifestation as having succeeded at base tier. The debt is real — the GM's table runs the bill.",                              "pkInit6"],
    "pk_mode_sealed_pact":         ["Sealed Pact",        "Stance (signature)",   "Action (open / drop)",       "While the Seal holds, your concurrent-manifestation cap is +2; you cannot voluntarily drop a manifestation sustained on a pact-bound subject. Pays ongoing upkeep against Clarity.",                                       "pkMode"],
    "pk_ledger_day":               ["Ledger Day",         "1/Soma Break",         "Free (during Soma Break)",   "Transfer one of your sustained manifestations to a willing ally — they pick up upkeep from their Clarity from that point on. The pact moves with the paper, not the person who originally signed.",                            "pkInit16"],
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
    `Phase 6 caster-discipline callouts: pack ${packOK}/${packOK + packSkip} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.` +
    (packMissing.length ? ` (${packMissing.length} identifiers missing — see console)` : "")
  );
})();
