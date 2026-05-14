// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Phase 4: Bulk passive flag stamper
// ─────────────────────────────────────────────────────────────────────────────
// Idempotent. Walks every bbttcc-* Item pack and every actor.
//
// For each known identifier, merges the spec into flags.fourththing.{rerolls,
// grants, passives}. Each spec piece is checked individually before being
// added so re-runs are no-ops.
//
// Spec format per identifier:
//   { rerolls?:  [{context, skill?, attribute?, mode, note}], → engine in ft-progression.js
//     grants?:   { resistances?: [{type, flavor?}], immunities?: [...],
//                  vulnerabilities?: [...], conditionImmunities?: ["surprise",...] },
//     passives?: { movement?: {climb, swim, fly, walkBonus, climbEqualsWalk, ignoreDifficultTerrain},
//                  initiative?: {bonus},
//                  vision?:    {darkvision, lowLight, tremorsense, blindsight} }}
//
// Vision changes auto-sync to prototype tokens + active tokens via the
// system-core hook installed 2026-04-29 (game.fourththing.syncTokenVision).
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const STAMPS = {
    // ── HERITAGES — damage resistances ────────────────────────────────────
    "sephirotic_scion_cherubic_heritage": { grants: { resistances: [{ type: "sephirotic" }] } },
    "sephirotic_scion_ophanic_heritage":  { grants: { resistances: [{ type: "sephirotic" }] } },
    "sephirotic_scion_seraphic_heritage": { grants: { resistances: [{ type: "sephirotic" }] } },
    "qliph_scarred_chthonic_heritage":    { grants: { resistances: [{ type: "qliphothic" }] } },
    "qliph_scarred_diabolic_heritage":    { grants: { resistances: [{ type: "qliphothic" }] } },
    "qliph_scarred_husk_heritage":        { grants: { resistances: [{ type: "qliphothic" }] } },
    "menhirkin_metamorphic_heritage":     { grants: { resistances: [{ type: "kinetic" }] } },
    "menhirkin_sedimentary_heritage":     { grants: { resistances: [{ type: "kinetic" }] } },

    // ── TIER FEATS — damage resistances ───────────────────────────────────
    "qliph_scarred_chthonic_tier1": { grants: { resistances: [{ type: "qliphothic", note: "while sunken via Deep Dark" }] } },
    "human-erectus-fire_kin":       { grants: { resistances: [{ type: "energy", flavor: "fire" }] } },
    "oldenborn-skythreaded-stormskin": { grants: { resistances: [{ type: "energy", flavor: "lightning" }] } },
    "oldenborn-embertouched-sun_scar": { grants: { resistances: [{ type: "sephirotic", flavor: "radiant" }] } },

    // ── CONDITION IMMUNITIES ──────────────────────────────────────────────
    "cryptidkin":                     { grants: { conditionImmunities: ["surprise"] } },
    "furrykin-leporid-moon_nerve":    { grants: { conditionImmunities: ["surprise"] },
                                        rerolls: [{ context: "check", attribute: "intrigue", mode: "reroll-lowest", note: "Moon-Nerve (always-on)" }] },

    // ── REROLL GRANTS — always-on passives ────────────────────────────────
    "human-neanderthal-hearth_reader": {
      rerolls: [{ context: "check", skill: "insight", mode: "reroll-lowest", note: "Hearth-Reader (always-on)" }]
    },
    "human-florensis-burrow_memory": {
      rerolls: [{ context: "check", skill: "athletics", mode: "reroll-lowest", note: "Burrow Memory (always-on)" }],
      passives: { movement: { ignoreDifficultTerrain: "in caves, tunnels, and ruins (Burrow Memory)" } }
    },
    "furrykin-felid-predator_patience": {
      rerolls: [
        { context: "check", skill: "perception", mode: "reroll-lowest", note: "Predator Patience — while hidden or observing quietly" },
        { context: "check", skill: "insight",    mode: "reroll-lowest", note: "Predator Patience — while hidden or observing quietly" }
      ]
    },
    "furrykin-mustelid-tunnelcraft": {
      passives: { movement: { ignoreDifficultTerrain: "in caves, tunnels, rubble, and ruins (Tunnelcraft)" } }
    },
    "oldenborn-stormborn-nomad-networks": {
      rerolls: [
        { context: "check", attribute: "presence", mode: "reroll-lowest", note: "Nomad Networks — find shelter / guides / supplies / black-market contacts along major travel routes, in caravan towns, or in any inhabited Desert / Ash Wastes / Swamp / Mire hex" },
        { context: "check", attribute: "soul",     mode: "reroll-lowest", note: "Nomad Networks — find shelter / guides / supplies / black-market contacts along major travel routes" }
      ]
    },
    "oldenborn-rustland-urban-scrounger": {
      rerolls: [{ context: "check", skill: "investigation", mode: "reroll-lowest", note: "Reading the Rust (always-on)" }]
    },
    "oldenborn-earthbound-deep_blooded": {
      rerolls: [{ context: "check", attribute: "body", mode: "reroll-lowest", note: "Deep-Blooded — vs poison and environmental Stress (always-on)" }],
      grants: { conditionImmunities: ["surprise"] } // "can't be surprised by structural failure"
    },
    "human-denisovan-high_altitude": {
      rerolls: [{ context: "check", attribute: "body", mode: "reroll-lowest", note: "High-Altitude Blood — vs poison and environmental suffocation" }],
      passives: { vision: { tremorsense: 10 } }
    },
    "human_denisovan_heritage": {
      passives: { vision: { tremorsense: 10 } }
    },
    "human-denisovan-ancient_logic": {
      rerolls: [
        { context: "check", skill: "investigation", mode: "reroll-lowest", note: "Ancient Logic — structures / mechanisms / ruins" },
        { context: "check", skill: "occult",        mode: "reroll-lowest", note: "Ancient Logic — structures / mechanisms / ruins" }
      ]
    },
    "furrykin-vulpin-scent_secrets": {
      rerolls: [
        { context: "check", skill: "insight",       mode: "reroll-lowest", note: "Scent of Secrets — deception / hidden / concealed (10-min activation)" },
        { context: "check", skill: "investigation", mode: "reroll-lowest", note: "Scent of Secrets — deception / hidden / concealed (10-min activation)" },
        { context: "check", skill: "perception",    mode: "reroll-lowest", note: "Scent of Secrets — deception / hidden / concealed (10-min activation)" }
      ]
    },

    // ── VISION ────────────────────────────────────────────────────────────
    "echo_diver":  { passives: { vision: { darkvision: 60 } } },
    "menhirkin_metamorphic_tier1": { /* low-light vision is conditional via picker — info only */ },

    // ── MOVEMENT ──────────────────────────────────────────────────────────
    "circuitborn_parallax_heritage":   { passives: { movement: { walkBonus: 10 } } },
    "furrykin-felid-king_of_alleys":   {
      // Climb=walk is the active form (1/Soma Break for 10 min). Stamp the
      // ignoreDifficultTerrain note so the upcoming AE-interface UI surfaces it.
      passives: { movement: { ignoreDifficultTerrain: "in urban ruins (King of Alleys — when active)" } }
    },
    "oldenborn-stormborn-weatherwise": {
      passives: { movement: { ignoreDifficultTerrain: "ash, dust, and snow (Ash-Walker)" } }
    },
    "oldenborn_stormborn_nomad_tier1": {
      // Already wired with rerolls — just add the ignore-DT for ash/dust/snow.
      passives: { movement: { ignoreDifficultTerrain: "ash, dust, and snow (Ash-Walker)" } }
    },
    "oldenborn-stormborn-ward-of-the-gale": {
      // Travel-Hardened passive (the always-on companion to Ward of the Gale).
      rerolls: [{ context: "check", skill: "athletics", mode: "reroll-lowest", note: "Travel-Hardened — while travelling within 30 ft of the bearer" }]
    },

    // ── HERITAGE-LEVEL REROLLS (sweep) ────────────────────────────────────
    // Heritage cards mention rerolls in flavor text; surface as flag rerolls.
    "oldenborn_earthbound_heritage": {
      rerolls: [{ context: "check", attribute: "body", mode: "reroll-lowest", note: "Earthbound — defense vs being moved or knocked Prone (always-on)" }]
    },
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const sameNote = (a, b) => (a.note ?? "") === (b.note ?? "");
  const sameGrant = (a, b) => a.context === b.context && (a.skill ?? null) === (b.skill ?? null) &&
                              (a.attribute ?? null) === (b.attribute ?? null) && a.mode === b.mode &&
                              sameNote(a, b);
  const sameRes = (a, b) => a.type === b.type && (a.flavor ?? null) === (b.flavor ?? null) &&
                            (a.note ?? null) === (b.note ?? null);

  const mergeStamp = (existing, spec) => {
    const out = foundry.utils.deepClone(existing ?? {});
    out.fourththing ??= {};
    let changed = false;

    // Rerolls
    if (Array.isArray(spec.rerolls) && spec.rerolls.length) {
      out.fourththing.rerolls ??= [];
      for (const g of spec.rerolls) {
        if (!out.fourththing.rerolls.some(x => sameGrant(x, g))) {
          out.fourththing.rerolls.push(g);
          changed = true;
        }
      }
    }

    // Grants
    if (spec.grants) {
      out.fourththing.grants ??= {};
      const g = out.fourththing.grants;
      if (Array.isArray(spec.grants.resistances)) {
        g.resistances ??= [];
        for (const r of spec.grants.resistances) {
          if (!g.resistances.some(x => sameRes(x, r))) { g.resistances.push(r); changed = true; }
        }
      }
      if (Array.isArray(spec.grants.immunities)) {
        g.immunities ??= [];
        for (const r of spec.grants.immunities) {
          if (!g.immunities.some(x => sameRes(x, r))) { g.immunities.push(r); changed = true; }
        }
      }
      if (Array.isArray(spec.grants.vulnerabilities)) {
        g.vulnerabilities ??= [];
        for (const r of spec.grants.vulnerabilities) {
          if (!g.vulnerabilities.some(x => sameRes(x, r))) { g.vulnerabilities.push(r); changed = true; }
        }
      }
      if (Array.isArray(spec.grants.conditionImmunities)) {
        g.conditionImmunities ??= [];
        for (const c of spec.grants.conditionImmunities) {
          if (!g.conditionImmunities.includes(c)) { g.conditionImmunities.push(c); changed = true; }
        }
      }
    }

    // Passives
    if (spec.passives) {
      out.fourththing.passives ??= {};
      const p = out.fourththing.passives;
      if (spec.passives.movement) {
        p.movement ??= {};
        for (const k of Object.keys(spec.passives.movement)) {
          if (p.movement[k] !== spec.passives.movement[k]) {
            p.movement[k] = spec.passives.movement[k];
            changed = true;
          }
        }
      }
      if (spec.passives.initiative) {
        p.initiative ??= {};
        for (const k of Object.keys(spec.passives.initiative)) {
          if (p.initiative[k] !== spec.passives.initiative[k]) {
            p.initiative[k] = spec.passives.initiative[k];
            changed = true;
          }
        }
      }
      if (spec.passives.vision) {
        p.vision ??= {};
        for (const k of Object.keys(spec.passives.vision)) {
          if (p.vision[k] !== spec.passives.vision[k]) {
            p.vision[k] = spec.passives.vision[k];
            changed = true;
          }
        }
      }
    }

    return { flags: out, changed };
  };

  const patchDoc = async (doc) => {
    const id = doc.system?.identifier ?? "";
    const spec = STAMPS[id];
    if (!spec || Object.keys(spec).length === 0) return { status: "skip" };
    const { flags, changed } = mergeStamp(doc.flags ?? {}, spec);
    if (!changed) return { status: "noop" };
    await doc.update({ flags });
    return { status: "ok" };
  };

  // ── Pack pass ───────────────────────────────────────────────────────────
  let packOK = 0, packNoop = 0;
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    if (!/^bbttcc-/.test(pack.metadata.id)) continue;
    const wasLocked = pack.locked;
    if (wasLocked) await pack.configure({ locked: false });
    try {
      const docs = await pack.getDocuments();
      for (const doc of docs) {
        if (!STAMPS[doc.system?.identifier ?? ""]) continue;
        const r = await patchDoc(doc);
        if (r.status === "ok") {
          packOK++;
          console.log(`  ✓ [${pack.metadata.id}] ${doc.name}`);
        } else if (r.status === "noop") {
          packNoop++;
        }
      }
    } catch (e) { console.warn(`pack walk failed: ${pack.metadata.id} — ${e.message}`); }
    if (wasLocked) await pack.configure({ locked: true });
  }

  // ── Actor pass ──────────────────────────────────────────────────────────
  let actorOK = 0, actorNoop = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      if (!STAMPS[item.system?.identifier ?? ""]) continue;
      const r = await patchDoc(item);
      if (r.status === "ok") {
        actorOK++; touched = true;
        console.log(`  ✓ [actor:${actor.name}] ${item.name}`);
      } else if (r.status === "noop") actorNoop++;
    }
    if (touched) actorTouched++;
  }

  // Re-prepare all actors so derived data (movement / vision / defenses) updates.
  // Vision auto-sync to tokens fires off the updateItem hook above (already
  // wired into the actor.update calls).
  for (const actor of game.actors) actor.prepareData();

  // Force one explicit token vision sync per affected actor (defensive — the
  // hook fires off item update events, but if the run touched actors that
  // weren't open, we want their proto tokens up to date).
  if (game.fourththing?.syncTokenVision) {
    for (const actor of game.actors) {
      if (actor.type === "character") await game.fourththing.syncTokenVision(actor);
    }
  }

  ui.notifications.info(`Phase 4 stamper: pack ${packOK} ok (${packNoop} already canon), ${actorOK} actor items across ${actorTouched} actors.`);
  console.log("DONE");
})();
