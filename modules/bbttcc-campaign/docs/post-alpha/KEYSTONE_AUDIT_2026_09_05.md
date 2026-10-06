# KEYSTONE AUDIT — the ability pool as it stands · 2026-09-05

Phase 0 worksheet for the classless build (see `KEYSTONE_SPEC.md`). Source: `packs/_source/classes` — 9 path shells, 27 doctrine shells, **275 feats** (the pool).

## Headline counts

| Metric | Count |
|---|---|
| Feats in pool | 275 |
| Proposed keystones | 14 |
| Proposed principles | 103 |
| Proposed refinements (doctrine rungs) | 158 |
| Unlock level stamped (`prerequisites.level`) | 247 |
| Unlock level prose-only | 0 |
| **No derivable unlock level** | **28** |
| Stamped ≠ prose (self-heal cases) | 0 |
| No machine payload (prose-only) | 108 |
| Prose-only AND not router-wired (pure narrative) | 89 |
| Structured `prerequisites.items` populated | 0 |

## Per path

| Path | Feats | Keystone | Principle | Refinement | No level | Prose-only |
|---|---|---|---|---|---|---|
| Aurablade | 20 | 2 | 3 | 15 | 0 | 17 |
| Bulwark | 19 | 1 | 3 | 15 | 0 | 8 |
| Cosmic Linguist | 25 | 3 | 4 | 18 | 5 | 21 |
| Dreamwalker | 40 | 2 | 20 | 18 | 0 | 6 |
| Harmony Marshal | 35 | 1 | 15 | 19 | 0 | 5 |
| Pactkeeper | 29 | 2 | 7 | 20 | 3 | 24 |
| Shadow Courier | 19 | 1 | 3 | 15 | 0 | 5 |
| Soul Smith | 45 | 1 | 24 | 20 | 20 | 14 |
| Wyrdlens Adept | 43 | 1 | 24 | 18 | 0 | 8 |

## Proposed keystones (engine-defining — RULE THESE FIRST)

| Path | Feat | identifier | Engine | Level | Payload |
|---|---|---|---|---|---|
| Aurablade | Aurablade: Burn State | `aurablade_burn_state` | Burn + Aura | 1 | — |
| Aurablade | Aurablade: Core Features | `aurablade_core_features` | Burn + Aura | 1 | — |
| Bulwark | Bulwark — Tier 1: Founding Stance | `bulwark_tier1_founding_stance` | Frame Dice + Ruin | 1 | AE×1 |
| Cosmic Linguist | Cosmic Linguist: Core Features | `cosmic_linguist_core_features` | Lexicon | 1 | — |
| Cosmic Linguist | Cosmic Linguist: Initiation 1 — True-Name Touch | `cl_init1_true_name_touch` | Lexicon | 1 | discipline |
| Cosmic Linguist | Cosmic Linguist: Resonance Channel | `cosmic_linguist_resonance_channel` | Lexicon | 1 | — |
| Dreamwalker | Dreamwalker: Tier 1 — Oneiric Reservoir | `dw_t1_oneiric_reservoir` | Resonance | 1 | discipline |
| Dreamwalker | Initiate of the Great Work | `initiate-of-the-great-work` | Resonance | 1 | act×1 uses 1/lr |
| Harmony Marshal | Harmony Marshal: Tier 1 — Harmony Initiate | `harmony-marshal-tier-1--harmony-initiate` | Mandate (passive) | 1 | AE×1 |
| Pactkeeper | Pactkeeper: Core Features | `pactkeeper_core_features` | Pact ledger | 1 | — |
| Pactkeeper | Pactkeeper: Initiation 1 — The Bargain | `pk_init1_the_bargain` | Pact ledger | 1 | discipline |
| Shadow Courier | Shadow Courier — Tier 1: Liminal Operator | `shadow_courier_tier1_liminal_operator` | Access Dice | 1 | AE×2 trig×1 |
| Soul Smith | Soul-Smith: Tier 1 — Sanctified Forge Initiate | `soul-smith-tier-1--sanctified-forge-initiate` | Forge (Burn) | 1 | AE×1 |
| Wyrdlens Adept | Wyrdlens Adept: Tier 1 — Lens Read | `wyrdlens_adept_tier_1_lens_read` | Refraction (passive) | 1 | AE×1 discipline |

## Feats with NO derivable unlock level (must be ruled or stamped)

| Path | Doctrine | Feat | identifier | Payload |
|---|---|---|---|---|
| Cosmic Linguist | Annotator | Annotator: Correspondence Mastery | `annotator_correspondence_mastery` | — |
| Cosmic Linguist | Annotator | Annotator: Ritual Upgrade | `annotator_ritual_upgrade` | — |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Living Allegory | `metaphor_living_allegory` | — |
| Cosmic Linguist | Redactor | Redactor: Name Stripping | `redactor_name_stripping` | — |
| Cosmic Linguist | Redactor | Redactor: Total Redaction | `redactor_total_redaction` | — |
| Pactkeeper | Auditor | Auditor: Deicidal Injunction | `auditor_deicidal_injunction` | — |
| Pactkeeper | Auditor | Auditor: Forensic Audit | `auditor_forensic_audit` | — |
| Pactkeeper | Steward of Living Communities | Steward: Mutual Aid Network | `steward_mutual_aid_network` | — |
| Soul Smith | Forge of Victory | Banner of the Final Push | `soulsmith-forge-victory-banner-final-push` | act×1 uses 1/lr |
| Soul Smith | Forge of Bound Light | Bound Light (Bad Eden) | `soulsmith-forge-bound-light-bound-light` | — |
| Soul Smith | Forge of the Spark Reclaimer | Clean Extraction | `soulsmith-forge-spark-reclaimer-clean-extraction` | uses 1/lr |
| Soul Smith | Forge of the Spark Reclaimer | Echo Temper | `soulsmith-forge-spark-reclaimer-echo-temper` | — |
| Soul Smith | Forge of Bound Light | Forge Blessing | `soulsmith-forge-bound-light-forge-blessing` | uses @prof/? |
| Soul Smith | Forge of Bound Light | Gentle Edges | `soulsmith-forge-bound-light-gentle-edges` | — |
| Soul Smith | Forge of Bound Light | Hearthfield | `soulsmith-forge-bound-light-hearthfield` | — |
| Soul Smith | Forge of Bound Light | Luminous Intercession | `soulsmith-forge-bound-light-luminous-intercession` | — |
| Soul Smith | Forge of Victory | Marchwork | `soulsmith-forge-victory-marchwork` | — |
| Soul Smith | Forge of the Spark Reclaimer | Overcharge Cycle | `soulsmith-forge-spark-reclaimer-overcharge-cycle` | — |
| Soul Smith | Forge of Bound Light | Pattern of Mercy | `soulsmith-forge-bound-light-pattern-of-mercy` | — |
| Soul Smith | Forge of Victory | Rally Stitch | `soulsmith-forge-victory-rally-stitch` | act×1 uses @prof/lr |
| Soul Smith | Forge of the Spark Reclaimer | Residual Charge | `soulsmith-forge-spark-reclaimer-residual-charge` | — |
| Soul Smith | Forge of the Spark Reclaimer | Reverse-Anvil | `soulsmith-forge-spark-reclaimer-reverse-anvil` | uses @prof/? |
| Soul Smith | Forge of Bound Light | Sanctuary Engine | `soulsmith-forge-bound-light-sanctuary-engine` | — |
| Soul Smith | Forge of the Spark Reclaimer | Spark Reclaimer (Bad Eden) | `soulsmith-forge-spark-reclaimer-spark-reclaimer` | — |
| Soul Smith | Forge of the Spark Reclaimer | Spark Resurrection | `soulsmith-forge-spark-reclaimer-spark-resurrection` | uses 1/lr |
| Soul Smith | Forge of Victory | Standard of Will (Bad Eden) | `soulsmith-forge-victory-standard-of-will` | act×1 |
| Soul Smith | Forge of Victory | Triumph Weave | `soulsmith-forge-victory-triumph-weave` | act×1 uses @prof/lr |
| Soul Smith | Forge of Victory | Victory Forge | `soulsmith-forge-victory-victory-forge` | uses 1/lr |

## Stamped level disagrees with prose

| Path | Feat | stamped | prose-derived |
|---|---|---|---|

## Full pool

| Path | Doctrine | Feat | Kind | Lvl | Src | Payload | Wired |
|---|---|---|---|---|---|---|---|
| Aurablade |  | Aurablade Action | principle | 1 | stamped | act×1 | ✓ |
| Aurablade |  | Aurablade: Burn State | keystone | 1 | stamped | — | ✓ |
| Aurablade |  | Aurablade: Change Aura | principle | 1 | stamped | act×1 | ✓ |
| Aurablade |  | Aurablade: Core Features | keystone | 1 | stamped | — |  |
| Aurablade |  | Aurablade: Stabilize Burn | principle | 1 | stamped | act×1 | ✓ |
| Aurablade | Blood Hymn | Blood Hymn: Escalation | refinement | 3 | stamped | — |  |
| Aurablade | Blood Hymn | Blood Hymn: Lifetithe | refinement | 6 | stamped | — |  |
| Aurablade | Blood Hymn | Blood Hymn: Crimson Arc | refinement | 10 | stamped | — |  |
| Aurablade | Blood Hymn | Blood Hymn: Terror Charge | refinement | 14 | stamped | — |  |
| Aurablade | Blood Hymn | Blood Hymn: Final Crescendo | refinement | 18 | stamped | — | ✓ |
| Aurablade | Stillheart | Stillheart: Centered Breath | refinement | 3 | stamped | — |  |
| Aurablade | Stillheart | Stillheart: Shared Aura | refinement | 6 | stamped | — |  |
| Aurablade | Stillheart | Stillheart: Quiet Mind | refinement | 10 | stamped | — |  |
| Aurablade | Stillheart | Stillheart: Emotional Lock | refinement | 14 | stamped | — | ✓ |
| Aurablade | Stillheart | Stillheart: Eye of the Storm | refinement | 18 | stamped | — |  |
| Aurablade | Void Edge | Void Edge: Null Field | refinement | 3 | stamped | — |  |
| Aurablade | Void Edge | Void Edge: Silence of Will | refinement | 6 | stamped | — |  |
| Aurablade | Void Edge | Void Edge: Dread Cut | refinement | 10 | stamped | — |  |
| Aurablade | Void Edge | Void Edge: Emotional Erasure | refinement | 14 | stamped | — |  |
| Aurablade | Void Edge | Void Edge: Final Quiet | refinement | 18 | stamped | — |  |
| Bulwark |  | Bulwark — Tier 1: Founding Stance | keystone | 1 | stamped | AE×1 |  |
| Bulwark |  | Bulwark — Tier 2: Anchor or Advance | principle | 6 | stamped | uses 1/sr | ✓ |
| Bulwark |  | Bulwark — Tier 3: Polarity Mastery | principle | 11 | stamped | trig×1 |  |
| Bulwark |  | Bulwark — Tier 4: Architect of Certainty | principle | 16 | stamped | — |  |
| Bulwark | Path of the Avalanche | Avalanche L1: Kinetic Inversion | refinement | 1 | stamped | trig×1 |  |
| Bulwark | Path of the Avalanche | Avalanche L5: Shockwave Arrival | refinement | 5 | stamped | trig×1 |  |
| Bulwark | Path of the Avalanche | Avalanche L9: No Terminal Velocity | refinement | 9 | stamped | — |  |
| Bulwark | Path of the Avalanche | Avalanche L13: The Breach | refinement | 13 | stamped | uses 1/sr | ✓ |
| Bulwark | Path of the Avalanche | Avalanche L17: Running Theology (Capstone) | refinement | 17 | stamped | grants trig×1 |  |
| Bulwark | Path of the Cataclyst | Cataclyst L1: The Exchange | refinement | 1 | stamped | — |  |
| Bulwark | Path of the Cataclyst | Cataclyst L5: Stance Dance | refinement | 5 | stamped | trig×1 |  |
| Bulwark | Path of the Cataclyst | Cataclyst L9: Decide The Weather | refinement | 9 | stamped | uses 1/sr |  |
| Bulwark | Path of the Cataclyst | Cataclyst L13: The Third Door | refinement | 13 | stamped | uses 1/sr |  |
| Bulwark | Path of the Cataclyst | Cataclyst L17: Both Things At Once (Capstone) | refinement | 17 | stamped | — |  |
| Bulwark | Path of the Mountain | Mountain L1: Inverted Foundation | refinement | 1 | stamped | trig×1 |  |
| Bulwark | Path of the Mountain | Mountain L5: Denial | refinement | 5 | stamped | — |  |
| Bulwark | Path of the Mountain | Mountain L9: The Hold | refinement | 9 | stamped | — |  |
| Bulwark | Path of the Mountain | Mountain L13: Grave Weight | refinement | 13 | stamped | — |  |
| Bulwark | Path of the Mountain | Mountain L17: The Patient Edifice (Capstone) | refinement | 17 | stamped | — |  |
| Cosmic Linguist |  | Cosmic Linguist: Core Features | keystone | 1 | stamped | — |  |
| Cosmic Linguist |  | Cosmic Linguist: Initiation 1 — True-Name Touch | keystone | 1 | stamped | discipline | ✓ |
| Cosmic Linguist |  | Cosmic Linguist: Resonance Channel | keystone | 1 | stamped | — | ✓ |
| Cosmic Linguist |  | Cosmic Linguist: Semantic Editor | principle | 1 | stamped | — |  |
| Cosmic Linguist |  | Cosmic Linguist: Initiation 6 — Translation | principle | 6 | stamped | discipline | ✓ |
| Cosmic Linguist |  | Cosmic Linguist: Initiation 11 — The Sentence (Signature Mode) | principle | 11 | stamped | discipline | ✓ |
| Cosmic Linguist |  | Cosmic Linguist: Initiation 16 — Word That Was | principle | 16 | stamped | discipline | ✓ |
| Cosmic Linguist | Annotator | Annotator: Circle Discipline | refinement | 3 | stamped | — |  |
| Cosmic Linguist | Annotator | Annotator: Ritual Annotation | refinement | 3 | stamped | — |  |
| Cosmic Linguist | Annotator | Annotator: Stored Annotation | refinement | 6 | stamped | — |  |
| Cosmic Linguist | Annotator | Annotator: Great Work Rite | refinement | 18 | stamped | — |  |
| Cosmic Linguist | Annotator | Annotator: Correspondence Mastery | refinement | ? | NONE | — |  |
| Cosmic Linguist | Annotator | Annotator: Ritual Upgrade | refinement | ? | NONE | — |  |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Myth Hook | refinement | 3 | stamped | — |  |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Symbolic Substitution | refinement | 3 | stamped | — |  |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Archetype Binding | refinement | 6 | stamped | — |  |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Shared Dream | refinement | 10 | stamped | — |  |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Make It True | refinement | 18 | stamped | — |  |
| Cosmic Linguist | Metaphor Apostle | Metaphor Apostle: Living Allegory | refinement | ? | NONE | — | ✓ |
| Cosmic Linguist | Redactor | Redactor: Semantic Redaction | refinement | 3 | stamped | — |  |
| Cosmic Linguist | Redactor | Redactor: Redaction Savant | refinement | 6 | stamped | — |  |
| Cosmic Linguist | Redactor | Redactor: Persistent Deletion | refinement | 10 | stamped | — |  |
| Cosmic Linguist | Redactor | Redactor: Redline the Draft | refinement | 14 | stamped | — |  |
| Cosmic Linguist | Redactor | Redactor: Name Stripping | refinement | ? | NONE | — |  |
| Cosmic Linguist | Redactor | Redactor: Total Redaction | refinement | ? | NONE | — |  |
| Dreamwalker |  | Dream-Sense | principle | 1 | stamped | AE×1 |  |
| Dreamwalker |  | Dreamwalker: Tier 1 — Oneiric Reservoir | keystone | 1 | stamped | discipline | ✓ |
| Dreamwalker |  | Initiate of the Great Work | keystone | 1 | stamped | act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Lucid Step | principle | 1 | stamped | AE×1 act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Oneiric Pulse | principle | 1 | stamped | AE×1 |  |
| Dreamwalker |  | Dream-Thread Tuning | principle | 2 | stamped | AE×3 act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Shared Dreamwork | principle | 3 | stamped | AE×3 act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Dream Rite | principle | 5 | stamped | AE×4 act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Dreamwalker: Tier 2 — Dream-Cache | principle | 5 | stamped | discipline | ✓ |
| Dreamwalker |  | Dream Stability | principle | 6 | stamped | AE×1 |  |
| Dreamwalker |  | Symbolic Cartography | principle | 7 | stamped | AE×1 |  |
| Dreamwalker |  | Dreamer’s Poise | principle | 9 | stamped | AE×1 |  |
| Dreamwalker |  | Omen-Thread Weaving | principle | 10 | stamped | AE×1 uses 1/lr | ✓ |
| Dreamwalker |  | Dreamwalker: Tier 3 — The Walking Lane (Signature Mode) | principle | 11 | stamped | discipline | ✓ |
| Dreamwalker |  | Vision of the Great Work | principle | 11 | stamped | AE×1 uses 1/lr |  |
| Dreamwalker |  | Dream Echo Reservoir | principle | 13 | stamped | AE×1 act×1 uses 2/lr | ✓ |
| Dreamwalker |  | Mnemonic Spillway | principle | 14 | stamped | AE×1 | ✓ |
| Dreamwalker |  | Waking Dreamfield | principle | 15 | stamped | AE×1 act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Ascension Layer | principle | 17 | stamped | AE×1 act×1 uses 1/lr | ✓ |
| Dreamwalker |  | Dreamwalker: Tier 4 — Shared Dream | principle | 17 | stamped | discipline | ✓ |
| Dreamwalker |  | Fractal Self | principle | 18 | stamped | AE×1 uses 1/lr | ✓ |
| Dreamwalker |  | Apotheosis of the Oneiric | principle | 20 | stamped | AE×1 uses 1/lr | ✓ |
| Dreamwalker | Trance of the Quiet Sun | Somnolent Peace (Bad Eden) | refinement | 3 | stamped | uses 1/? | ✓ |
| Dreamwalker | Trance of the Quiet Sun | Stillness Between | refinement | 3 | stamped | — |  |
| Dreamwalker | Trance of the Quiet Sun | Lull the Riot | refinement | 6 | stamped | act×1 uses 1/sr | ✓ |
| Dreamwalker | Trance of the Quiet Sun | Quiet March | refinement | 10 | stamped | — |  |
| Dreamwalker | Trance of the Quiet Sun | Daybreak | refinement | 14 | stamped | uses 1/lr |  |
| Dreamwalker | Trance of the Quiet Sun | Solar Stillpoint | refinement | 18 | stamped | act×1 uses 1/lr | ✓ |
| Dreamwalker | Trance of the Sapphire Gate | Gate Anchor | refinement | 3 | stamped | uses 1/lr | ✓ |
| Dreamwalker | Trance of the Sapphire Gate | Lucid Step (Bad Eden) | refinement | 3 | stamped | uses 1/? | ✓ |
| Dreamwalker | Trance of the Sapphire Gate | Dream Relay | refinement | 6 | stamped | — |  |
| Dreamwalker | Trance of the Sapphire Gate | Bright Hypnopomp | refinement | 10 | stamped | — |  |
| Dreamwalker | Trance of the Sapphire Gate | Sapphire Conduction | refinement | 14 | stamped | uses 1/lr |  |
| Dreamwalker | Trance of the Sapphire Gate | Blue Meridian | refinement | 18 | stamped | uses 1/lr | ✓ |
| Dreamwalker | Trance of the Thousand Faces | Mirror Read | refinement | 3 | stamped | act×1 | ✓ |
| Dreamwalker | Trance of the Thousand Faces | Persona Cache (Bad Eden) | refinement | 3 | stamped | — | ✓ |
| Dreamwalker | Trance of the Thousand Faces | Crowd Current | refinement | 6 | stamped | — |  |
| Dreamwalker | Trance of the Thousand Faces | Borrowed Voice | refinement | 10 | stamped | uses 1/sr |  |
| Dreamwalker | Trance of the Thousand Faces | Mask of Accord | refinement | 14 | stamped | uses 1/lr |  |
| Dreamwalker | Trance of the Thousand Faces | Thousandfold Echo | refinement | 18 | stamped | uses 1/lr | ✓ |
| Harmony Marshal |  | Harmony Marshal: Tier 1 — Harmony Initiate | keystone | 1 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Peacekeeper's Poise | principle | 1 | stamped | AE×1 |  |
| Harmony Marshal |  | Silver Tongue Protocol | principle | 1 | stamped | AE×1 |  |
| Harmony Marshal |  | Rallying Words | principle | 2 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Read the Room | principle | 2 | stamped | AE×1 |  |
| Harmony Marshal |  | Extra Attack (Harmony Marshal) | principle | 5 | stamped | AE×1 |  |
| Harmony Marshal |  | Harmony Marshal: Tier 2 — Attrition Easer | principle | 5 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Unity Field | principle | 6 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Negotiated Advantage | principle | 7 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Crisis Mediator | principle | 9 | stamped | AE×1 |  |
| Harmony Marshal |  | Voice of the Mandate | principle | 10 | stamped | AE×1 |  |
| Harmony Marshal |  | Harmony Marshal: Tier 3 — Loyalty Steward | principle | 11 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Coordinated Advance | principle | 13 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Unbroken Line | principle | 15 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Harmony Marshal: Tier 4 — Unity Conductor | principle | 17 | stamped | AE×1 | ✓ |
| Harmony Marshal |  | Diplomatic Immunity | principle | 18 | stamped | AE×1 |  |
| Harmony Marshal | Mandate of Accord | Accord Engine (Bad Eden) | refinement | 3 | stamped | — |  |
| Harmony Marshal | Mandate of Accord | Conductor's Beat | refinement | 3 | stamped | act×1 uses @prof/lr | ✓ |
| Harmony Marshal | Mandate of Accord | Unity Cadence | refinement | 6 | stamped | — |  |
| Harmony Marshal | Mandate of Accord | Resonant Truce | refinement | 10 | stamped | act×1 uses 1/lr | ✓ |
| Harmony Marshal | Mandate of Accord | Treatywave | refinement | 14 | stamped | uses 1/lr |  |
| Harmony Marshal | Mandate of Accord | Accord Mandala | refinement | 18 | stamped | act×1 uses 1/lr | ✓ |
| Harmony Marshal | Mandate of Accord | Emissary of the Great Accord | refinement | 20 | stamped | AE×1 | ✓ |
| Harmony Marshal | Mandate of Overwatch | Overwatch (Bad Eden) | refinement | 3 | stamped | act×1 uses @prof/lr | ✓ |
| Harmony Marshal | Mandate of Overwatch | Signal Boost | refinement | 3 | stamped | act×1 uses @prof/? | ✓ |
| Harmony Marshal | Mandate of Overwatch | Counter-Discord | refinement | 6 | stamped | uses 1/sr | ✓ |
| Harmony Marshal | Mandate of Overwatch | Rally Net | refinement | 10 | stamped | — |  |
| Harmony Marshal | Mandate of Overwatch | Chorus of the People | refinement | 14 | stamped | uses 1/lr |  |
| Harmony Marshal | Mandate of Overwatch | Sentinel Protocol | refinement | 18 | stamped | uses 1/lr | ✓ |
| Harmony Marshal | Mandate of Resolve | Measured Command | refinement | 3 | stamped | act×1 uses @prof/lr | ✓ |
| Harmony Marshal | Mandate of Resolve | Rally the Quiet (Bad Eden) | refinement | 3 | stamped | act×1 uses @prof/lr | ✓ |
| Harmony Marshal | Mandate of Resolve | Hold the Line | refinement | 6 | stamped | — |  |
| Harmony Marshal | Mandate of Resolve | Calm Push | refinement | 10 | stamped | act×1 | ✓ |
| Harmony Marshal | Mandate of Resolve | Steel & Velvet | refinement | 14 | stamped | — |  |
| Harmony Marshal | Mandate of Resolve | Unbreakable Front | refinement | 18 | stamped | act×1 uses 1/lr | ✓ |
| Pactkeeper |  | Jurisdiction: Records & Precedent | principle | 1 | stamped | — |  |
| Pactkeeper |  | Pactkeeper: Contract of Binding Precedent | principle | 1 | stamped | — |  |
| Pactkeeper |  | Pactkeeper: Core Features | keystone | 1 | stamped | — | ✓ |
| Pactkeeper |  | Pactkeeper: Initiation 1 — The Bargain | keystone | 1 | stamped | discipline | ✓ |
| Pactkeeper |  | Pactkeeper: Invoke Precedent | principle | 1 | stamped | — |  |
| Pactkeeper |  | Pactkeeper: Invoke Precedent | principle | 1 | stamped | act×1 |  |
| Pactkeeper |  | Pactkeeper: Initiation 6 — Renegotiate | principle | 6 | stamped | discipline | ✓ |
| Pactkeeper |  | Pactkeeper: Initiation 11 — Sealed Pact (Signature Mode) | principle | 11 | stamped | discipline | ✓ |
| Pactkeeper |  | Pactkeeper: Initiation 16 — Ledger Day | principle | 16 | stamped | discipline | ✓ |
| Pactkeeper | Archivist of Precedent | Archivist: Akashic Access | refinement | 3 | stamped | — | ✓ |
| Pactkeeper | Archivist of Precedent | Archivist: Immutable Record | refinement | 3 | stamped | — |  |
| Pactkeeper | Archivist of Precedent | Archivist: Archival Recall | refinement | 6 | stamped | — |  |
| Pactkeeper | Archivist of Precedent | Archivist: Cross-Reference Reality | refinement | 6 | stamped | — |  |
| Pactkeeper | Archivist of Precedent | Archivist: Expectation Gravity | refinement | 10 | stamped | — |  |
| Pactkeeper | Archivist of Precedent | Archivist: Redundant Recordkeeping | refinement | 10 | stamped | — |  |
| Pactkeeper | Archivist of Precedent | Archivist: Historiographic Authority | refinement | 14 | stamped | — |  |
| Pactkeeper | Archivist of Precedent | Archivist: Akashic Override | refinement | 18 | stamped | — |  |
| Pactkeeper | Auditor | Auditor: Compliance Action | refinement | 3 | stamped | — |  |
| Pactkeeper | Auditor | Auditor: Quarantine Order | refinement | 6 | stamped | — |  |
| Pactkeeper | Auditor | Auditor: Sanction Protocol | refinement | 10 | stamped | — |  |
| Pactkeeper | Auditor | Auditor: Hard Shutdown | refinement | 18 | stamped | — |  |
| Pactkeeper | Auditor | Auditor: Deicidal Injunction | refinement | ? | NONE | — |  |
| Pactkeeper | Auditor | Auditor: Forensic Audit | refinement | ? | NONE | — | ✓ |
| Pactkeeper | Steward of Living Communities | Steward: Community Contract | refinement | 3 | stamped | — |  |
| Pactkeeper | Steward of Living Communities | Steward: Cohesion Pulse | refinement | 6 | stamped | — |  |
| Pactkeeper | Steward of Living Communities | Steward: Public Works Miracle | refinement | 10 | stamped | — |  |
| Pactkeeper | Steward of Living Communities | Steward: Integration Charter | refinement | 14 | stamped | — |  |
| Pactkeeper | Steward of Living Communities | Steward: Civic Apotheosis | refinement | 18 | stamped | — |  |
| Pactkeeper | Steward of Living Communities | Steward: Mutual Aid Network | refinement | ? | NONE | — |  |
| Shadow Courier |  | Shadow Courier — Tier 1: Liminal Operator | keystone | 1 | stamped | AE×2 trig×1 |  |
| Shadow Courier |  | Shadow Courier — Tier 2: The Crossing | principle | 6 | stamped | uses 1/sr | ✓ |
| Shadow Courier |  | Shadow Courier — Tier 3: Package Mastery | principle | 11 | stamped | trig×1 |  |
| Shadow Courier |  | Shadow Courier — Tier 4: Unfound Route | principle | 16 | stamped | uses 1/lr | ✓ |
| Shadow Courier | Route of the Black Stair | Black Stair L1: The Crossing, Weaponized | refinement | 1 | stamped | trig×1 |  |
| Shadow Courier | Route of the Black Stair | Black Stair L5: The Threshold Is A Lie | refinement | 5 | stamped | trig×1 |  |
| Shadow Courier | Route of the Black Stair | Black Stair L9: Extraction | refinement | 9 | stamped | trig×1 |  |
| Shadow Courier | Route of the Black Stair | Black Stair L13: Reverse Crossing | refinement | 13 | stamped | — |  |
| Shadow Courier | Route of the Black Stair | Black Stair L17: The Stair That Does Not End (Capstone) | refinement | 17 | stamped | uses 1/lr | ✓ |
| Shadow Courier | Route of the Last Mile | Last Mile L1: The Weight You Carry | refinement | 1 | stamped | trig×1 |  |
| Shadow Courier | Route of the Last Mile | Last Mile L5: The Arms That Carry | refinement | 5 | stamped | — |  |
| Shadow Courier | Route of the Last Mile | Last Mile L9: Funeral Rites | refinement | 9 | stamped | — |  |
| Shadow Courier | Route of the Last Mile | Last Mile L13: The Quiet Voyage | refinement | 13 | stamped | — | ✓ |
| Shadow Courier | Route of the Last Mile | Last Mile L17: The Ferryman's Right (Capstone) | refinement | 17 | stamped | uses 1/lr |  |
| Shadow Courier | Route of the Wayfarer Tongue | Wayfarer Tongue L1: The Tongue That Does Not Lie | refinement | 1 | stamped | trig×2 |  |
| Shadow Courier | Route of the Wayfarer Tongue | Wayfarer Tongue L5: Preceding Rumor | refinement | 5 | stamped | trig×1 |  |
| Shadow Courier | Route of the Wayfarer Tongue | Wayfarer Tongue L9: The Protected Word | refinement | 9 | stamped | — |  |
| Shadow Courier | Route of the Wayfarer Tongue | Wayfarer Tongue L13: Reply With Interest | refinement | 13 | stamped | trig×1 |  |
| Shadow Courier | Route of the Wayfarer Tongue | Wayfarer Tongue L17: The Standing Appointment (Capstone) | refinement | 17 | stamped | trig×1 |  |
| Soul Smith |  | Soul-Smith: Tier 1 — Sanctified Forge Initiate | keystone | 1 | stamped | AE×1 |  |
| Soul Smith |  | Tempered Vitality | principle | 1 | stamped | AE×1 |  |
| Soul Smith |  | Forge-Blessed Tools | principle | 2 | stamped | AE×1 |  |
| Soul Smith |  | Salvage the Ruined | principle | 2 | stamped | AE×1 |  |
| Soul Smith |  | Ember of Restoration | principle | 3 | stamped | AE×1 |  |
| Soul Smith |  | Ironbedside Manner | principle | 3 | stamped | AE×1 |  |
| Soul Smith |  | Grief-Smith's Insight (Soul) (Soul) | principle | 4 | stamped | AE×1 |  |
| Soul Smith |  | Harmonic Heat-Treat | principle | 4 | stamped | AE×1 |  |
| Soul Smith |  | Alloy of Trust | principle | 5 | stamped | — |  |
| Soul Smith |  | Soul-Smith: Tier 2 — Atonement Crucible | principle | 5 | stamped | — |  |
| Soul Smith |  | Anvil of Refuge | principle | 7 | stamped | — |  |
| Soul Smith |  | Living Relic Artificer | principle | 8 | stamped | AE×1 |  |
| Soul Smith |  | Hardened Frame | principle | 9 | stamped | AE×1 |  |
| Soul Smith |  | Pulse of the Forge | principle | 10 | stamped | AE×1 | ✓ |
| Soul Smith |  | Soul-Smith: Tier 3 — Furnace of Renewal | principle | 11 | stamped | AE×1 |  |
| Soul Smith |  | Bastion-Shell Plating | principle | 12 | stamped | AE×1 |  |
| Soul Smith |  | Hex-Ward Filigree | principle | 13 | stamped | AE×1 |  |
| Soul Smith |  | Shared Burden Harness | principle | 13 | stamped | AE×1 | ✓ |
| Soul Smith |  | Structural Empathy | principle | 14 | stamped | AE×1 |  |
| Soul Smith |  | Workshop Demi-Sanctum | principle | 15 | stamped | AE×1 |  |
| Soul Smith |  | Forge-Line Stabilizer | principle | 16 | stamped | AE×1 |  |
| Soul Smith |  | Great Work Keystone | principle | 17 | stamped | AE×1 |  |
| Soul Smith |  | Soul-Smith: Tier 4 — Relic of Rebirth | principle | 17 | stamped | AE×1 |  |
| Soul Smith |  | Forge-Heart Anchor | principle | 18 | stamped | AE×1 |  |
| Soul Smith |  | Heartforge of the Great Work | principle | 20 | stamped | AE×1 |  |
| Soul Smith | Forge of Bound Light | Bound Light (Bad Eden) | refinement | ? | NONE | — |  |
| Soul Smith | Forge of Bound Light | Forge Blessing | refinement | ? | NONE | uses @prof/? | ✓ |
| Soul Smith | Forge of Bound Light | Gentle Edges | refinement | ? | NONE | — |  |
| Soul Smith | Forge of Bound Light | Hearthfield | refinement | ? | NONE | — |  |
| Soul Smith | Forge of Bound Light | Luminous Intercession | refinement | ? | NONE | — | ✓ |
| Soul Smith | Forge of Bound Light | Pattern of Mercy | refinement | ? | NONE | — |  |
| Soul Smith | Forge of Bound Light | Sanctuary Engine | refinement | ? | NONE | — | ✓ |
| Soul Smith | Forge of the Spark Reclaimer | Clean Extraction | refinement | ? | NONE | uses 1/lr |  |
| Soul Smith | Forge of the Spark Reclaimer | Echo Temper | refinement | ? | NONE | — |  |
| Soul Smith | Forge of the Spark Reclaimer | Overcharge Cycle | refinement | ? | NONE | — | ✓ |
| Soul Smith | Forge of the Spark Reclaimer | Residual Charge | refinement | ? | NONE | — |  |
| Soul Smith | Forge of the Spark Reclaimer | Reverse-Anvil | refinement | ? | NONE | uses @prof/? | ✓ |
| Soul Smith | Forge of the Spark Reclaimer | Spark Reclaimer (Bad Eden) | refinement | ? | NONE | — | ✓ |
| Soul Smith | Forge of the Spark Reclaimer | Spark Resurrection | refinement | ? | NONE | uses 1/lr | ✓ |
| Soul Smith | Forge of Victory | Banner of the Final Push | refinement | ? | NONE | act×1 uses 1/lr | ✓ |
| Soul Smith | Forge of Victory | Marchwork | refinement | ? | NONE | — |  |
| Soul Smith | Forge of Victory | Rally Stitch | refinement | ? | NONE | act×1 uses @prof/lr | ✓ |
| Soul Smith | Forge of Victory | Standard of Will (Bad Eden) | refinement | ? | NONE | act×1 | ✓ |
| Soul Smith | Forge of Victory | Triumph Weave | refinement | ? | NONE | act×1 uses @prof/lr | ✓ |
| Soul Smith | Forge of Victory | Victory Forge | refinement | ? | NONE | uses 1/lr |  |
| Wyrdlens Adept |  | Lens-Tuned Recall | principle | 1 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Wyrdlens Adept: Tier 1 — Lens Read | keystone | 1 | stamped | AE×1 discipline | ✓ |
| Wyrdlens Adept |  | Pattern-Seeking Mind | principle | 2 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Qliphothic Diagnostics | principle | 2 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Field Identification Protocols | principle | 3 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Symbolic Cartographer's Eye | principle | 3 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Cognitive Sandbox | principle | 4 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Hazard Prediction Matrix | principle | 4 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Archivist of the Fracture | principle | 5 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Wyrdlens Adept: Tier 2 — Probability Overlay | principle | 5 | stamped | AE×1 discipline | ✓ |
| Wyrdlens Adept |  | Probability Threading | principle | 6 | stamped | AE×1 | ✓ |
| Wyrdlens Adept |  | Fractal Cross-Reference | principle | 7 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Anomaly Backtrace | principle | 8 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Narrative Refactor | principle | 9 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Spark Topology Surveyor | principle | 10 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Tikkun Patch Commit | principle | 10 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Wyrdlens Adept: Tier 3 — Refraction (Signature Mode) | principle | 11 | stamped | AE×1 discipline | ✓ |
| Wyrdlens Adept |  | Error Budget Accounting | principle | 12 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Predictive Convergence Map | principle | 12 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Causal Spine Trace | principle | 16 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Global Symbol Index | principle | 16 | stamped | — |  |
| Wyrdlens Adept |  | Wyrdlens Adept: Tier 4 — Tikkun Sight | principle | 17 | stamped | AE×1 discipline | ✓ |
| Wyrdlens Adept |  | Hex-Scope Refactor | principle | 18 | stamped | AE×1 |  |
| Wyrdlens Adept |  | Lattice Profiler | principle | 18 | stamped | AE×1 | ✓ |
| Wyrdlens Adept |  | Root Access to the Lattice | principle | 20 | stamped | AE×1 |  |
| Wyrdlens Adept | Refraction of Foresight | Foresight Refraction (Bad Eden) | refinement | 3 | stamped | — | ✓ |
| Wyrdlens Adept | Refraction of Foresight | Lens Ledger | refinement | 3 | stamped | — | ✓ |
| Wyrdlens Adept | Refraction of Foresight | Parallax Step | refinement | 6 | stamped | — |  |
| Wyrdlens Adept | Refraction of Foresight | Split Beam | refinement | 10 | stamped | act×1 | ✓ |
| Wyrdlens Adept | Refraction of Foresight | Perfect Angle | refinement | 14 | stamped | uses 1/lr |  |
| Wyrdlens Adept | Refraction of Foresight | Convergence Horizon | refinement | 18 | stamped | act×1 uses 1/lr | ✓ |
| Wyrdlens Adept | Refraction of Mercy | Gentle Pivot | refinement | 3 | stamped | uses @prof/lr | ✓ |
| Wyrdlens Adept | Refraction of Mercy | Mercy Refraction (Bad Eden) | refinement | 3 | stamped | uses 1/? | ✓ |
| Wyrdlens Adept | Refraction of Mercy | Kind Light | refinement | 6 | stamped | — |  |
| Wyrdlens Adept | Refraction of Mercy | Soft Focus | refinement | 10 | stamped | act×1 uses 1/lr | ✓ |
| Wyrdlens Adept | Refraction of Mercy | Sephirothic Bloom | refinement | 14 | stamped | uses 1/lr |  |
| Wyrdlens Adept | Refraction of Mercy | Covenant Prism | refinement | 18 | stamped | act×1 uses 1/lr | ✓ |
| Wyrdlens Adept | Refraction of Truth | Researcher's Eye | refinement | 3 | stamped | — | ✓ |
| Wyrdlens Adept | Refraction of Truth | Truth Refraction (Bad Eden) | refinement | 3 | stamped | — | ✓ |
| Wyrdlens Adept | Refraction of Truth | Clear the Signal | refinement | 6 | stamped | uses @prof/lr | ✓ |
| Wyrdlens Adept | Refraction of Truth | Prism Ledger | refinement | 10 | stamped | — | ✓ |
| Wyrdlens Adept | Refraction of Truth | Unshatter | refinement | 14 | stamped | uses 1/lr |  |
| Wyrdlens Adept | Refraction of Truth | Truth Horizon | refinement | 18 | stamped | act×1 uses 1/lr | ✓ |

---
Generated by `bin/ft-keystone-audit`. Worksheet: `data/keystone-worksheet.json` (edit `kind`, `gate`, `prereqIds`, `slotCost`, `ruling`; a later stamp macro reads it).
