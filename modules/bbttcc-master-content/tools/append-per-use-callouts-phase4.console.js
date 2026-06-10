// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Append Per-Use callouts (Phase 4: character-options — Archetypes /
// Crews / Occult Associations)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent.
// 39 items across 3 packs in `bbttcc-character-options`.
// JS routing matches by item.system.identifier — these callouts are descriptive
// only; the dispatcher uses the data-driven CHAR_OPT_ABILITIES table in
// systems/fourththing/ft-class-automation.js.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  // identifier → [label, recovery, action, summary, key]
  const A = {
    // Archetypes (9)
    "archetype-wheel-of-fortune-t2":  ["Tilt the Table",       "1/Strategic Turn",  "Strategic (after roll reveal)",       "After any random table / encounter / variable result reveal, shift one step up or down if a legal adjacent result exists.",                          "wheelT2"],
    "archetype-wheel-of-fortune-t3":  ["Treat as 10",          "1/long rest",       "Free (on miss / failed check)",       "Treat the roll as a 10 before modifiers.",                                                                                                              "wheelT3"],
    "archetype-wheel-of-fortune-t4":  ["Force the Reroll",     "1/Strategic Turn",  "Strategic (after outcome reveal)",    "Force a reroll on a raid / beat / travel / crisis table, OR pick between rolled and rerolled outcome.",                                                "wheelT4"],
    "archetype-moon-t3":              ["Detect Thoughts",      "1/long rest",       "Action",                              "Cast Detect Thoughts without expending a spell slot. (Permanent advantage vs. charm is passive.)",                                                       "moonT3"],
    "archetype-hanged-man-t3":        ["Reroll Failed Save",   "1/long rest",       "Reaction (on failed save)",           "When you fail a save vs. charmed / frightened / restrained, immediately reroll it.",                                                                    "hangedT3"],
    "archetype-hanged-man-t4":        ["Sacrifice Refund",     "1/Strategic Turn",  "Strategic (after failed action)",     "After a failed raid / intrigue / diplomatic action, regain 1 spent OP of the type used and apply +1 to the next related strategic roll.",              "hangedT4"],
    "archetype-temperance-t2":        ["Overflow Retention",   "Passive (every turn)", "Auto",                            "Retain 1 overflow OP per turn that would otherwise be lost. No daily cap; reminder card only.",                                                          "tempT2"],
    "archetype-star-t3":              ["Hopebringer Aura",     "1/short rest",      "Action (during major scene)",         "Allies within earshot who can see/hear you have advantage on saves vs. frightened.",                                                                    "starT3"],
    "archetype-sun-t3":               ["Beacon Aura",          "1/short rest",      "Action (during major scene)",         "Allies within earshot who can see/hear you have advantage on saves vs. frightened or charmed.",                                                          "sunT3"],

    // Crews (3)
    "crew-storm-wardens-t2":          ["Weather Veto",         "1/Strategic Turn",  "Strategic",                           "Suppress, blunt, or redirect a weather-based hazard affecting a local route, hex, or operation.",                                                       "stormT2"],
    "crew-gridbreakers-t3":           ["Reactivate Asset",     "1/Strategic Turn",  "Strategic",                           "Temporarily reactivate a dormant urban asset, granting a short-lived but meaningful local benefit.",                                                    "gridT3"],
    "crew-cultural-ambassadors-t4":   ["Soft Annex",           "1/Strategic Turn",  "Strategic",                           "Shift the alignment of an adjacent neutral Hex toward your faction's political affiliation without spending OPs.",                                       "culturalT4"],

    // Occult Associations (27)
    "occult-association-kabbalist-t1":         ["Sense the Leak",            "1/long rest",      "Action",                "Cast Detect Evil and Good (sephirothic flow / qliphothic pressure).",                                                                                            "kabT1"],
    "occult-association-kabbalist-t3":         ["Read the Rot",              "1/Scenario",       "Strategic",             "In a Scenario involving Qliphothic forces or corrupted Hex conditions, gain Advantage on one relevant Strategic Roll.",                                          "kabT3"],
    "occult-association-shaman-t1":            ["Hex Attunement",            "1/Strategic Turn", "Strategic",             "+1 to one travel/terrain/wilderness OP roll. (On-entry hex read is passive.)",                                                                                    "shamT1"],
    "occult-association-shaman-t2":            ["Read the Path",             "1/Strategic Turn", "Strategic",             "Reduce one weather/terrain complication by one step OR gain Advantage on one travel/wilderness Strategic Roll.",                                                  "shamT2"],
    "occult-association-shaman-t3":            ["Spirit-Walk",               "1/Scenario",       "Strategic",             "In a corrupted-terrain / leyline / weather / spirit unrest scenario: Advantage on one Strategic Roll OR negate one terrain/corruption penalty.",                  "shamT3"],
    "occult-association-shaman-t4":            ["Stabilize the Hex",         "1/Strategic Turn", "Strategic",             "Target a Hex: stabilize a leyline/environmental state for one Scenario, OR reduce a corruption/weather/terrain pressure by one significant step.",               "shamT4"],
    "occult-association-tarot-mage-t1":        ["Draw the Line (Tactical)",  "1/long rest",      "Free (before check)",   "Before an ability check, gain Advantage on it.",                                                                                                                   "tarotT1"],
    "occult-association-tarot-mage-t2":        ["Tilt the Draw",             "1/Scenario",       "Strategic",             "After a key faction check, +2 to result OR reduce severity of one failed consequence by one step.",                                                                "tarotT2"],
    "occult-association-tarot-mage-t3":        ["Foretelling Roll",          "1/long rest",      "Free (declare before)", "On long rest, roll a d20 and record. Replace any attack/save/check with this roll.",                                                                                "tarotT3"],
    "occult-association-tarot-mage-t4":        ["Force the Reroll",          "5 Intrigue OP",    "Strategic (Phase 3)",   "Force the GM to reroll one NPC faction's strategic action outcome. Backlash guaranteed — use sparingly.",                                                          "tarotT4"],
    "occult-association-alchemist-t1":         ["Production Reliability",    "1/Strategic Turn", "Strategic",             "When faction spends Economy OP on production / infrastructure / supply, reduce spend by 1 (min 1).",                                                              "alchT1"],
    "occult-association-alchemist-t2":         ["Propaganda Distillate",     "1/Strategic Turn", "Strategic",             "Convert 3 Economy ↔ 3 Soft Power. Doesn't count as OP generation. Leaves narrative residue.",                                                                      "alchT2"],
    "occult-association-alchemist-t4":         ["Elixir of Fortitude",       "1/Strategic Turn", "Strategic (5 Eco)",     "Spend 5 Economy OP. Pick an OP category: gains +3 OP for one Scenario. Unspent expires.",                                                                          "alchT4"],
    "occult-association-goetic-summoner-t3":   ["Binding Posture",           "1/Strategic Turn", "Strategic (declare)",   "Before a Scenario, declare a Binding Posture: +3 to one Intrigue OP roll during it. (Failure may introduce a binding-tied complication.)",                       "goeticT3"],
    "occult-association-goetic-summoner-t4":   ["Major Binding",             "1/Scenario",       "Strategic (10 Int)",    "After defeating a major Qliphothic entity: spend 10 Intrigue OP, GM-adjudicated roll. Success: bound asset (+5 Vio or Int rolls). Failure: entity escapes with a grudge.",  "goeticT4"],
    "occult-association-prophet-oracle-t1":    ["Omen Question",             "1/long rest",      "Free",                  "Ask the GM one focused omen-question. Truthful but limited / symbolic / pressure-based.",                                                                          "prophT1"],
    "occult-association-prophet-oracle-t2":    ["Bias the Arrival",          "1/Scenario",       "Strategic",             "When a complication is about to be introduced, ask GM to bias it toward a category: warning / negotiation / hazard / omen / hostile contact / opportunity.",       "prophT2"],
    "occult-association-prophet-oracle-t3":    ["Foreseen Failure",          "1/long rest",      "Free (before roll)",    "Declare a creature/ally/event-thread; grant Advantage on one attack/save/check tied to avoiding meaningful failure.",                                              "prophT3"],
    "occult-association-prophet-oracle-t4":    ["Major Foresight",           "1/Strategic Turn", "Strategic",             "Ask GM one major foresight question about an impending threat / faction move / fracture point. (Tier 4 also has a 1/Scenario unusually-accurate prep — separate.)", "prophT4"],
    "occult-association-exorcist-t2":          ["Reduce Darkness",           "1/Strategic Turn", "Strategic",             "Reduce Darkness/corruption pressure in a Hex by one step, OR remove one minor corruption effect from a scenario.",                                                "exorcT2"],
    "occult-association-exorcist-t3":          ["Negate Corruption",         "1/Scenario",       "Strategic",             "Negate one corruption-based penalty or hostile effect.",                                                                                                            "exorcT3"],
    "occult-association-exorcist-t4":          ["Major Purge",               "1/Strategic Turn", "Strategic",             "Fully purge a major corruption event / Qliphothic effect / Darkness spike, OR negate a major hostile environmental / metaphysical threat.",                       "exorcT4"],
    "occult-association-biomancer-t1":         ["Reduce Survival Penalty",   "1/Strategic Turn", "Strategic",             "Reduce one survival/hazard/casualty penalty by one step.",                                                                                                          "biomT1"],
    "occult-association-biomancer-t2":         ["Casualty Conversion",       "1/Scenario",       "Strategic",             "Reduce casualty severity by one step, OR convert a catastrophic loss into a contained loss with consequences.",                                                    "biomT2"],
    "occult-association-biomancer-t4":         ["Negate Crisis",             "1/Strategic Turn", "Strategic",             "Negate a major environmental/casualty/biological crisis affecting your faction, OR convert a lethal condition into a survivable but transformed state.",         "biomT4"],
    "occult-association-gnostic-t3":           ["Ignore Deception",          "1/Scenario",       "Strategic",             "Automatically ignore a single deception-based complication without spending OPs.",                                                                                  "gnosT3"],
    "occult-association-rosicrucian-t3":       ["Bypass Bureaucracy",        "1/Strategic Turn", "Strategic (Diplo op)",  "Negate a single 'lost time' complication caused by bureaucracy / checkpoints / local authorities during a Diplomacy-forward op.",                                "rosiT3"],
  };

  const PACKS = [
    "bbttcc-character-options.character-archetypes",
    "bbttcc-character-options.crew-types",
    "bbttcc-character-options.occult-associations",
  ];

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

  // Pack pass — match by identifier (more robust than name)
  let packOK = 0;
  for (const packId of PACKS) {
    const pack = game.packs.get(packId);
    if (!pack) { console.warn(`Pack ${packId} not found`); continue; }
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    const idx = await pack.getIndex({ fields: ["name"] });
    for (const e of idx) {
      const doc = await pack.getDocument(e._id);
      const id  = doc.system?.identifier ?? "";
      const spec = A[id];
      if (!spec) continue;
      const r = await patchDoc(doc, spec);
      if (r.status === "ok") {
        packOK++;
        console.log(`  [${packId}] OK  ${doc.name}`);
      }
    }
    if (wasLocked) await pack.configure({ locked: true });
  }

  // Actors
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

  ui.notifications.info(
    `Phase 4 callouts: pack ${packOK} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
