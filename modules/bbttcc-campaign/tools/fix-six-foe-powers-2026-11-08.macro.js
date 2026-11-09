/*
 * fix-six-foe-powers-2026-11-08.macro.js — Dave (2026-11-08): make six foe powers do what their rules text says.
 *   Bough of Just Sentence — 2d6 PSYCHIC (sephirotic judgment) to Stress, Soul save negates, Calmed 1 round, 30 ft;
 *                            the stale flat damage "3d6" cleared.
 *   Hollow Hunger          — 15-ft burst centred on the Shambler (range self), Soul save negates, 2d6 qliphothic (Stress),
 *                            Shaken 1 round.
 *   Rainbow Cascade        — 15-ft burst centred on the Elemental, Soul save negates, 2d6 sephirotic, Charmed 1 round
 *                            (the charm's source is the caster — applyManifestationStates stamps it).
 *   Spark Vow              — manifestation.onMissRetaliation {2d8 electrical, scope vow-target, once}: the vowed target's
 *                            next miss vs the Adept or an ally → 2d8 electrical to it; one vow per caster; the scene.
 *   Frame Drift            — attackersDisadvantage + onMissRetaliation {1d6 qliphothic, scope self, every miss} until the
 *                            start of the Wraith's next turn (markDuration "next-turn").
 *   Hammer-Bright Ward     — +1 Guard ward (condition "martial-form": only while a melee / unarmed Form is in hand) +
 *                            damageConvert kinetic → electrical, for the scene.
 * Prose (effect, description, hook, calibration) rewritten to say exactly that. The tier is re-scored with
 * game.fourththing.manifestation.magnitudeTier(preview, "power", owner) and written explicitly (foes included — the
 * re-score hook stands aside for an explicit tier, and foes keep the scored tier).
 * Matches by EXACT item name on type "power". Covers world actors' items, unlinked tokens on every scene, world items,
 * and every Item / Actor compendium that carries one (unlocks, writes, relocks).
 * DRY RUN by default (report only). globalThis.__sixPowersWrite = true writes. Idempotent (re-run reports "already").
 * Needs the 2026-11-08 system build (module.js with marks / onMissRetaliation) deployed first.
 */
(async () => {
  const WRITE = globalThis.__sixPowersWrite === true;
  const SPEC = {
    "Bough of Just Sentence": {
      "system.damage": "",
      "system.damageType": "psychic",
      "system.damageFlavor": "sephirotic judgment",
      "system.damageRoll": {
        "op": "damage",
        "number": 2,
        "die": "d6",
        "bonus": 0,
        "attribute": "",
        "type": "psychic",
        "flavor": "sephirotic judgment",
        "track": "stress"
      },
      "system.effect": "A luminous bough extends from the bark toward one creature within 30 ft. The target must speak the truest thing it fears and makes a Soul save; on a failure it takes 2d6 psychic damage to Stress — sephirotic judgment — and is Calmed for 1 round while the tree weighs the answer. A save negates both.",
      "system.description.value": "<p><strong>Working.</strong> <em>A bough that interrogates by judgment.</em></p>\n<p>A luminous bough extends from the bark toward one creature within 30 ft. The target must speak the truest thing it fears and makes a Soul save (DC by tier); on a failure it takes 2d6 psychic damage to Stress — sephirotic judgment — and is Calmed for 1 round while the tree weighs the answer. A save negates both.</p>\n<p><strong>Cost.</strong> 2 Clarity, +1 Noise · action · one creature / 30 ft.</p>\n<p><em>Bark grows over the wound and sings hymns until they answer.</em></p>",
      "system.manifestation.rangeFt": 30,
      "system.manifestation.targetText": "One creature within 30 ft.",
      "system.manifestation.rangeAreaText": "30 ft; the bough reaches.",
      "system.manifestation.durationText": "Calmed for 1 round while the tree weighs the answer.",
      "system.manifestation.area": {
        "shape": "none",
        "size": 0
      },
      "system.manifestation.resolution": {
        "shape": "save",
        "hitSave": false,
        "hitSaveHalf": false,
        "saveAttribute": "soul",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "onSave": "negate",
        "saveByPrompt": false
      },
      "system.manifestation.appliedStates": {
        "states": [
          "calmed"
        ],
        "duration": "1-round",
        "saveEachRound": false,
        "saveAttribute": "soul",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "saveAttributeOverrides": {}
      },
      "system.manifestation.fictionalPermission": "May force a public confession and apply Calmed.",
      "system.manifestation.gmCalibration": "Soul save (negates); psychic damage — sephirotic judgment — to Stress; Calmed 1 round.",
      "system.manifestation.mechanicalHook": "One creature within 30 ft, Soul save (negates): 2d6 psychic to Stress + Calmed 1 round.",
      "flags.fourththing.npcAuto.rules.0.do.damage.type": "psychic"
    },
    "Hollow Hunger": {
      "system.damage": "",
      "system.range": "self",
      "system.damageType": "qliphothic",
      "system.damageRoll": {
        "op": "damage",
        "number": 2,
        "die": "d6",
        "bonus": 0,
        "attribute": "",
        "type": "qliphothic",
        "flavor": "",
        "track": "stress"
      },
      "system.effect": "The Shambler's mouth opens onto a place that isn't here. Each creature within 15 ft of it makes a Soul save; on a failure it takes 2d6 qliphothic damage to Stress and is Shaken for 1 round. A save negates both.",
      "system.description.value": "<p><strong>Working.</strong> <em>Ambient hunger spilled outward from a wound that never closed.</em></p>\n<p>The shambler's mouth opens onto a place that isn't here. Each creature within 15 ft of it makes a Soul save (DC by tier); on a failure it takes 2d6 qliphothic damage to Stress and is Shaken for 1 round. A save negates both.</p>\n<p><strong>Cost.</strong> 2 Clarity, +2 Noise · action · 15-ft burst centred on the shambler.</p>\n<p><em>The room briefly tastes of iron and a memory you didn't have.</em></p>",
      "system.manifestation.rangeFt": 0,
      "system.manifestation.targetText": "Each creature within 15 ft of the Shambler.",
      "system.manifestation.rangeAreaText": "15-ft burst centred on the Shambler.",
      "system.manifestation.area": {
        "shape": "sphere",
        "size": 15
      },
      "system.manifestation.resolution": {
        "shape": "save",
        "hitSave": false,
        "hitSaveHalf": false,
        "saveAttribute": "soul",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "onSave": "negate",
        "saveByPrompt": false
      },
      "system.manifestation.appliedStates": {
        "states": [
          "shaken"
        ],
        "duration": "1-round",
        "saveEachRound": false,
        "saveAttribute": "soul",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "saveAttributeOverrides": {}
      },
      "system.manifestation.gmCalibration": "Soul save (negates); qliphothic to Stress; Shaken 1 round.",
      "system.manifestation.mechanicalHook": "15-ft burst on itself, Soul save (negates): 2d6 qliphothic to Stress + Shaken 1 round."
    },
    "Rainbow Cascade": {
      "system.damage": "",
      "system.range": "self",
      "system.damageType": "sephirotic",
      "system.damageRoll": {
        "op": "damage",
        "number": 2,
        "die": "d6",
        "bonus": 0,
        "attribute": "",
        "type": "sephirotic",
        "flavor": "",
        "track": "integrity"
      },
      "system.effect": "Release a saturated wave. Each creature within 15 ft of the Elemental makes a Soul save; on a failure it takes 2d6 sephirotic damage and is Charmed by the Elemental for 1 round — it sees only beauty in it and can't attack it. A save negates both.",
      "system.description.value": "<p><strong>Working.</strong> <em>An eruption of impossible colour.</em></p>\n<p>Release a saturated wave. Each creature within 15 ft of the Elemental makes a Soul save (DC by tier); on a failure it takes 2d6 sephirotic damage and is Charmed by the Elemental for 1 round — it sees only beauty in the Elemental and can't attack it. A save negates both.</p>\n<p><strong>Cost.</strong> 2 Clarity, +1 Noise · action · 15-ft burst centred on the Elemental.</p>\n<p><em>Animal silhouettes briefly inhabit the landscape behind the targets — a unicorn, a kitten, a dolphin.</em></p>",
      "system.manifestation.rangeFt": 0,
      "system.manifestation.targetText": "Each creature within 15 ft of the Elemental.",
      "system.manifestation.rangeAreaText": "15-ft burst centred on the Elemental.",
      "system.manifestation.durationText": "One pulse; the charm lasts 1 round.",
      "system.manifestation.area": {
        "shape": "sphere",
        "size": 15
      },
      "system.manifestation.resolution": {
        "shape": "save",
        "hitSave": false,
        "hitSaveHalf": false,
        "saveAttribute": "soul",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "onSave": "negate",
        "saveByPrompt": false
      },
      "system.manifestation.appliedStates": {
        "states": [
          "charmed"
        ],
        "duration": "1-round",
        "saveEachRound": false,
        "saveAttribute": "soul",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "saveAttributeOverrides": {}
      },
      "system.manifestation.fictionalPermission": "Charmed targets can't attack the Elemental.",
      "system.manifestation.gmCalibration": "Soul save (negates); 2d6 sephirotic; Charmed by the Elemental 1 round.",
      "system.manifestation.mechanicalHook": "15-ft burst on itself, Soul save (negates): 2d6 sephirotic + Charmed by the Elemental 1 round."
    },
    "Spark Vow": {
      "system.damage": "",
      "system.damageType": "electrical",
      "system.damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "bonus": 0,
        "attribute": "",
        "type": "electrical",
        "flavor": "",
        "track": "integrity"
      },
      "system.effect": "Name a creature within 60 ft and speak a vow against it. The next time it misses an attack against the Adept or one of the Adept's allies, lightning answers — it takes 2d8 electrical damage and the vow ends. The vow lasts the scene; the Adept holds one vow at a time, and a new vow moves it.",
      "system.description.value": "<p><strong>Working.</strong> <em>A martial pact with a sky that keeps score.</em></p>\n<p>Name a creature within 60 ft and speak a vow against it. The next time it misses an attack against the adept or one of the adept's allies, lightning answers: it takes 2d8 electrical damage and the vow ends. The vow lasts the scene; the adept holds one vow at a time, and a new vow moves it.</p>\n<p><strong>Cost.</strong> 2 Clarity, +1 Noise · action · one creature / 60 ft.</p>\n<p><em>Ozone smell, and a bell rings somewhere in Valhaul.</em></p>",
      "system.manifestation.rangeFt": 60,
      "system.manifestation.targetText": "One creature within 60 ft.",
      "system.manifestation.rangeAreaText": "60 ft; sightline.",
      "system.manifestation.durationText": "Until it pays out or the scene ends.",
      "system.manifestation.area": {
        "shape": "none",
        "size": 0
      },
      "system.manifestation.resolution": {
        "shape": "auto",
        "hitSave": false,
        "hitSaveHalf": false,
        "saveAttribute": "body",
        "saveDcMode": "cast-dc",
        "saveDcFixed": 15,
        "onSave": "negate",
        "saveByPrompt": false
      },
      "system.manifestation.onMissRetaliation": {
        "formula": "2d8",
        "type": "electrical",
        "scope": "vow-target",
        "once": true
      },
      "system.manifestation.markDuration": "scene",
      "system.manifestation.fictionalPermission": "Lightning answers the vowed target's next miss.",
      "system.manifestation.gmCalibration": "Fires once and ends; one Spark Vow at a time; lasts the scene.",
      "system.manifestation.mechanicalHook": "Vow on one creature within 60 ft: its next miss against the Adept or an ally → 2d8 electrical to it, once. One vow at a time (a new vow moves it); lasts the scene."
    },
    "Frame Drift": {
      "system.damage": "",
      "system.damageType": "qliphothic",
      "system.damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "bonus": 0,
        "attribute": "",
        "type": "qliphothic",
        "flavor": "",
        "track": "stress"
      },
      "system.effect": "Phase the Wraith partially out of the current frame. Until the start of its next turn, attacks against it roll with disadvantage, and each attack that misses it deals 1d6 qliphothic damage to the attacker's Stress as the slip bleeds back into them.",
      "system.description.value": "<p><strong>Working.</strong> <em>Stop being entirely present.</em></p>\n<p>Phase the wraith partially out of the current frame. Until the start of its next turn, attacks against it roll with disadvantage, and each attack that misses it deals 1d6 qliphothic damage to the attacker's Stress as the slip bleeds back into them.</p>\n<p><strong>Cost.</strong> 1 Clarity, +2 Noise · action · self.</p>\n<p><em>The air around it remembers things that didn't happen.</em></p>",
      "system.manifestation.rangeFt": 0,
      "system.manifestation.durationText": "Until the start of its next turn.",
      "system.manifestation.attackersDisadvantage": true,
      "system.manifestation.onMissRetaliation": {
        "formula": "1d6",
        "type": "qliphothic",
        "scope": "self",
        "once": false
      },
      "system.manifestation.markDuration": "next-turn",
      "system.manifestation.gmCalibration": "Attacks against it at disadvantage; each miss deals 1d6 qliphothic to the attacker's Stress.",
      "system.manifestation.mechanicalHook": "Until its next turn: attacks against it roll with disadvantage; each miss → 1d6 qliphothic to the attacker's Stress."
    },
    "Hammer-Bright Ward": {
      "system.damage": "",
      "system.effect": "For the scene, the Adept has +1 Guard while it wields a melee or unarmed Form, and kinetic damage it deals is dealt as electrical.",
      "system.description.value": "<p><strong>Form.</strong> <em>A bright halo around the haft of any weapon.</em></p>\n<p>For the scene, the adept has +1 Guard while it wields a melee or unarmed Form, and kinetic damage it deals is dealt as electrical.</p>\n<p><strong>Cost.</strong> 1 Clarity · bonus · self.</p>\n<p><em>Sparks crawl up the haft.</em></p>",
      "system.manifestation.durationText": "The scene.",
      "system.manifestation.targetText": "Self, while armed.",
      "system.manifestation.appliedEffects": {
        "modifiers": [
          {
            "stat": "guard",
            "op": "+",
            "value": 1
          }
        ],
        "resists": [],
        "immunes": [],
        "condition": "martial-form"
      },
      "system.manifestation.damageConvert": {
        "from": "kinetic",
        "to": "electrical"
      },
      "system.manifestation.markDuration": "scene",
      "system.manifestation.fictionalPermission": "Kinetic strikes land as lightning.",
      "system.manifestation.gmCalibration": "+1 Guard while a melee or unarmed Form is in hand; kinetic damage it deals becomes electrical.",
      "system.manifestation.mechanicalHook": "For the scene: +1 Guard while wielding a melee or unarmed Form; kinetic damage it deals becomes electrical."
    }
  };
  const report = { WRITE, changed: [], already: [], skipped: [], tiers: {} };
  // Key-order-insensitive compare: Foundry keeps the stored object's key order, so a plain stringify re-flags equal data.
  const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v);
  // Subset compare for objects: every key the SPEC names must match; extra stored defaults (hitSave:false …) are fine.
  const same = (a, b) => {
    if (b && typeof b === "object" && !Array.isArray(b)) return !!a && typeof a === "object" && Object.keys(b).every(k => same(a[k], b[k]));
    return JSON.stringify(canon(a ?? null)) === JSON.stringify(canon(b ?? null));
  };
  const magnitudeTier = game.fourththing?.manifestation?.magnitudeTier;
  if (typeof magnitudeTier !== "function") { ui.notifications?.error("fix-six-foe-powers: game.fourththing.manifestation.magnitudeTier missing — deploy the system first."); return; }

  function planFor(it) {
    if (it?.type !== "power" || !SPEC[it.name]) return null;
    const spec = SPEC[it.name];
    const u = {};
    for (const [path, want] of Object.entries(spec)) {
      // The npcAuto rule list is an array — retype rule 0's damage on a clone (5E side reads it).
      if (path.startsWith("flags.fourththing.npcAuto.rules.")) {
        const rules = foundry.utils.deepClone(it.flags?.fourththing?.npcAuto?.rules ?? null);
        if (!Array.isArray(rules) || !rules[0]?.do?.damage) continue;
        const sub = path.slice("flags.fourththing.npcAuto.rules.0.".length);
        if (same(foundry.utils.getProperty(rules[0], sub), want)) continue;
        foundry.utils.setProperty(rules[0], sub, want);
        u["flags.fourththing.npcAuto.rules"] = rules;
        continue;
      }
      if (!same(foundry.utils.getProperty(it, path), want)) u[path] = foundry.utils.deepClone(want);
    }
    // Score what the item will be, with its owner (fixed DCs score only on foe / unowned items).
    const preview = foundry.utils.mergeObject(it.toObject(), foundry.utils.expandObject(u), { inplace: false });
    let tier = null;
    try { tier = magnitudeTier(preview, "power", it.parent ?? null); } catch (e) { console.warn("fix-six-foe-powers: score failed", it.name, e); }
    if (Number(tier) >= 1 && Number(tier) !== Number(it.system?.manifestation?.tier)) u["system.manifestation.tier"] = Number(tier);
    report.tiers[it.name] = tier;
    return u;
  }
  async function fix(it, where) {
    const u = planFor(it); if (u === null) return;
    const label = `${where} / ${it.name}`;
    if (!Object.keys(u).length) { report.already.push(label); return; }
    report.changed.push({ where: label, paths: Object.keys(u), tier: u["system.manifestation.tier"] ?? it.system?.manifestation?.tier });
    if (WRITE) await it.update(u);
  }

  // World actors (linked + base actors).
  for (const a of game.actors.contents) for (const it of a.items.contents) {
    try { await fix(it, `actor ${a.name}`); } catch (e) { report.skipped.push(`actor ${a.name}: ${e.message}`); }
  }
  // Unlinked tokens — their synthetic actors carry their own item copies in the token delta.
  for (const sc of game.scenes.contents) for (const tok of sc.tokens.contents) {
    if (tok.actorLink || !tok.actor) continue;
    const own = tok.delta?.items?.contents ?? tok.delta?.items ?? [];
    if (!Array.from(own).some(i => SPEC[i.name])) continue;   // only the delta's own copies — base items are fixed above
    for (const it of tok.actor.items.contents) {
      if (!Array.from(own).some(i => i.id === it.id)) continue;
      try { await fix(it, `token ${sc.name}/${tok.name}`); } catch (e) { report.skipped.push(`token ${sc.name}/${tok.name}: ${e.message}`); }
    }
  }
  // World items.
  for (const it of game.items.contents) { try { await fix(it, "world item"); } catch (e) { report.skipped.push(`world item: ${e.message}`); } }
  // Compendiums (Item packs by index name; Actor packs scanned).
  for (const pack of game.packs.filter(p => p.documentName === "Item" || p.documentName === "Actor")) {
    let docs = [];
    try {
      if (pack.documentName === "Item") {
        const idx = await pack.getIndex();
        const hits = Array.from(idx).filter(e => SPEC[e.name] && e.type === "power");
        for (const e of hits) docs.push(await pack.getDocument(e._id));
      } else {
        for (const a of await pack.getDocuments()) for (const it of a.items.contents) if (SPEC[it.name] && it.type === "power") docs.push(it);
      }
    } catch (e) { report.skipped.push(`${pack.collection}: ${e.message}`); continue; }
    if (!docs.length) continue;
    const wasLocked = pack.locked;
    if (WRITE && wasLocked) await pack.configure({ locked: false });
    try {
      for (const it of docs) { try { await fix(it, `${pack.collection}${it.parent ? `/${it.parent.name}` : ""}`); } catch (e) { report.skipped.push(`${pack.collection}: ${e.message}`); } }
    } finally { if (WRITE && wasLocked) await pack.configure({ locked: true }); }
  }

  console.log("fix-six-foe-powers", report);
  ui.notifications?.info(`Six foe powers: ${report.changed.length} ${WRITE ? "changed" : "would change"}, ${report.already.length} already done${report.skipped.length ? `, ${report.skipped.length} skipped` : ""}.${WRITE ? "" : " Dry run — set globalThis.__sixPowersWrite = true to write."}`);
  return report;
})();
