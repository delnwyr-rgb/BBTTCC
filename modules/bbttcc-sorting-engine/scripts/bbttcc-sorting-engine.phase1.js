// BBTTCC Sorting Engine Phase 1
// Conservative syntax-safe Foundry module helper.
// No optional chaining, no nullish coalescing, no object spread.
//
// Expected companion file:
// modules/<your-module-folder>/data/bbttcc_sorting_engine_v1_full_spec.json
//
// Default suggested placement:
// modules/bbttcc-sorting-engine/scripts/bbttcc-sorting-engine.phase1.js
//
// API exposed at:
// game.bbttcc.api.sorting
//
// Main entry points:
// await game.bbttcc.api.sorting.runTest(null, { chat: true })
// await game.bbttcc.api.sorting.runAndCreate(null, { chat: true, name: "Sorting Test Hero" })
// game.bbttcc.api.sorting.randomAnswers()

(function () {
  "use strict";

  var MOD = "bbttcc-sorting-engine";
  var LOG_PREFIX = "[bbttcc-sorting-engine]";
  var DEFAULT_SPEC_PATH = "modules/bbttcc-sorting-engine/data/bbttcc_sorting_engine_v1_full_spec.json";

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    console.log.apply(console, args);
  }

  function warn() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(LOG_PREFIX);
    console.warn.apply(console, args);
  }

  function deepClone(obj) {
    try {
      return foundry.utils.deepClone(obj);
    } catch (_err) {
      return JSON.parse(JSON.stringify(obj));
    }
  }

  function mergeObjectSafe(a, b) {
    try {
      return foundry.utils.mergeObject(a, b, { inplace: false, overwrite: true });
    } catch (_err) {
      var out = deepClone(a || {});
      var k;
      for (k in b) {
        if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
      }
      return out;
    }
  }

  function slugifyKey(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_");
  }

  function titleCase(s) {
    return String(s || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  var CANONICAL_CLASS_IDS = {
    pactkeeper: "pactkeeper",
    harmony_marshal: "harmonymarshal",
    soul_smith: "soul-smith",
    cosmic_linguist: "cosmic_linguist",
    breaker: "breaker",
    chaos_magician: "chaos_magician",
    wyrd_lens_adept: "wyrdlens-adept",
    wyrdlens_adept: "wyrdlens-adept",
    shadowjack: "shadowjack",
    titanbound: "titanbound",
    phantom_courier: "phantomcourier",
    aurablade: "aurablade",
    dreamwalker: "dreamwalker"
  };

  var CANONICAL_ALIGNMENT_IDS = {
    binah: "alignment-binah",
    chokmah: "alignment-chokmah",
    chesed: "alignment-chesed",
    geburah: "alignment-geburah",
    hod: "alignment-hod",
    kether: "alignment-kether",
    malkuth: "alignment-malkuth",
    netzach: "alignment-netzach",
    tiphareth: "alignment-tiphareth"
  };

  var CANONICAL_ARCHETYPE_KEYS = {
    ancient_blood: "ancient-blood",
    "ancient-blood": "ancient-blood",
    hierophant: "hierophant",
    administrator: "mayor-administrator",
    mayor_administrator: "mayor-administrator",
    "mayor-administrator": "mayor-administrator",
    scholar: "wizard_scholar",
    wizard_scholar: "wizard_scholar",
    "wizard-scholar": "wizard_scholar",
    squad_leader: "squad-leader",
    "squad-leader": "squad-leader",
    warlord: "warlord"
  };

  var CANONICAL_CREW_KEYS = {
    covert_ops_cells: "covert-ops-cell",
    covert_ops_cell: "covert-ops-cell",
    "covert-ops-cell": "covert-ops-cell",
    cultural_ambassadors: "cultural-ambassadors",
    "cultural-ambassadors": "cultural-ambassadors",
    diplomatic_envoys: "diplomatic-envoys",
    "diplomatic-envoys": "diplomatic-envoys",
    mercenary_band: "mercenary-band",
    "mercenary-band": "mercenary-band",
    militia: "survivors-militia",
    survivors_militia: "survivors-militia",
    "survivors-militia": "survivors-militia",
    peacekeeper_corp: "peacekeeper-corps",
    peacekeeper_corps: "peacekeeper-corps",
    "peacekeeper-corps": "peacekeeper-corps"
  };

  var CANONICAL_OCCULT_KEYS = {
    alchemist: "alchemist",
    gnostic: "gnostic",
    goetic_summoner: "goetic-summoner",
    "goetic-summoner": "goetic-summoner",
    kabbalist: "kabbalist",
    rosicrucian: "rosicrucian",
    tarot_mage: "tarot-mage",
    "tarot-mage": "tarot-mage"
  };

  var CANONICAL_ANCESTRY_IDS = {
    chupacabra: "chupacabra-bad-eden",
    circuitborn: "circuitborn-salvage",
    echo_diver: "echo-diver",
    furrykin: "furrykin-vulpin",
    menhirkin: "hex-giant-menhirkin",
    human: "human-neanderthal",
    jackalope: "jackalope-bad-eden",
    oldenborn: "oldenborn-earthbound",
    qliph_scarred: "qliph-scarred",
    rustlander_scavenger: "rustlander-scavenger",
    sephirotic_scion: "sephirotic-scion",
    stormborn_nomad: "stormborn-nomad"
  };

  function isTieredIdentifier(identifier) {
    return /-t[1-4]$/.test(String(identifier || "")) || /tier-\d+$/i.test(String(identifier || ""));
  }

  function isTieredName(name) {
    return /\(Tier\s+\d+\)/i.test(String(name || ""));
  }

  function normKey(s) {
    return String(s || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function pickHighest(scoreMap) {
    var bestKey = null;
    var bestVal = -999999;
    var k;
    for (k in scoreMap) {
      if (!Object.prototype.hasOwnProperty.call(scoreMap, k)) continue;
      if (bestKey === null || scoreMap[k] > bestVal) {
        bestKey = k;
        bestVal = scoreMap[k];
      }
    }
    return bestKey;
  }

  function sortEntriesDescending(scoreMap) {
    var arr = [];
    var k;
    for (k in scoreMap) {
      if (!Object.prototype.hasOwnProperty.call(scoreMap, k)) continue;
      arr.push([k, scoreMap[k]]);
    }
    arr.sort(function (a, b) {
      return b[1] - a[1];
    });
    return arr;
  }

  function buildEmptyTotals(spec) {
    var totals = {};
    var traits = (spec && spec.traits) ? spec.traits : [];
    var i;
    for (i = 0; i < traits.length; i++) totals[traits[i]] = 0;
    return totals;
  }

  function scoreQuiz(answers, spec) {
    var totals = buildEmptyTotals(spec);
    var questions = (spec && spec.questions) ? spec.questions : [];
    var i, q, answerKey, ans, tags, tag;

    for (i = 0; i < questions.length; i++) {
      q = questions[i];
      answerKey = answers[String(q.id)] || answers[q.id];
      if (!answerKey) continue;

      ans = q.answers ? q.answers[answerKey] : null;
      if (!ans) continue;

      tags = ans.tags || {};
      for (tag in tags) {
        if (!Object.prototype.hasOwnProperty.call(tags, tag)) continue;
        if (typeof totals[tag] !== "number") totals[tag] = 0;
        totals[tag] += Number(tags[tag] || 0);
      }
    }

    return totals;
  }

  function resolvePhilosophy(traits) {
    var score = {
      authoritarian_statist: (traits.control || 0) + (traits.stability || 0) + (traits.violence || 0) - (traits.freedom || 0),
      liberal: (traits.justice || 0) + (traits.diplomacy || 0) + (traits.mercy || 0) + (traits.freedom || 0) - (traits.violence || 0) - (traits.corruption || 0),
      social_democratic: (traits.justice || 0) + Math.floor((traits.unity || 0) / 2) + Math.floor((traits.economy || 0) / 2) + (traits.mercy || 0),
      libertarian: (traits.freedom || 0) + (traits.diplomacy || 0) + (traits.mobility || 0) - (traits.control || 0),
      fascist: (traits.violence || 0) + (traits.ambition || 0) + (traits.control || 0) - (traits.mercy || 0),
      theocratic: (traits.faith || 0) + (traits.justice || 0) + (traits.ritual || 0) - (traits.corruption || 0),
      marxist_communist: (traits.justice || 0) + (traits.economy || 0) + (traits.unity || 0) + Math.floor((traits.logistics || 0) / 2) - Math.floor((traits.ambition || 0) / 2),
      anarchist: (traits.freedom || 0) + (traits.culture || 0) + (traits.risk || 0) + Math.floor((traits.mobility || 0) / 2) - (traits.control || 0)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function resolveAlignment(traits) {
    var score = {
      kether: (traits.unity || 0) + (traits.diplomacy || 0) + (traits.faith || 0),
      chokmah: (traits.ambition || 0) + (traits.risk || 0),
      binah: Math.floor((traits.control || 0) / 2) + (traits.binah_signal || 0),
      chesed: (traits.mercy || 0) + (traits.justice || 0) + ((traits.chesed_signal || 0) * 2),
      geburah: (traits.violence || 0) + (traits.control || 0),
      hod: (traits.culture || 0) + (traits.diplomacy || 0) + ((traits.hod_signal || 0) * 2),
      malkuth: (traits.economy || 0) + (traits.logistics || 0) + (traits.stability || 0),
      netzach: (traits.ambition || 0) + ((traits.netzach_signal || 0) * 2),
      tiphareth: Math.floor((traits.justice || 0) / 4) + Math.floor((traits.faith || 0) / 4) + (traits.tiphareth_signal || 0)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function resolveArchetype(traits) {
    var score = {
      ancient_blood: (traits.faith || 0) + (traits.ritual || 0) + (traits.risk || 0),
      hierophant: (traits.faith || 0) + (traits.unity || 0) + (traits.justice || 0),
      administrator: (traits.economy || 0) + (traits.logistics || 0) + (traits.stability || 0),
      scholar: (traits.truth || 0) + (traits.intrigue || 0) + (traits.foresight || 0),
      squad_leader: (traits.unity || 0) + (traits.logistics || 0) + (traits.stability || 0),
      warlord: (traits.violence || 0) + (traits.ambition || 0) + (traits.control || 0)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function resolveCrew(traits) {
    var score = {
      covert_ops_cells: (traits.intrigue || 0) + (traits.mobility || 0) + (traits.risk || 0),
      cultural_ambassadors: (traits.culture || 0) + (traits.diplomacy || 0) + (traits.unity || 0),
      diplomatic_envoys: (traits.diplomacy || 0) + (traits.economy || 0) + (traits.mercy || 0),
      mercenary_band: (traits.violence || 0) + (traits.ambition || 0) + (traits.survival || 0) - (traits.mercy || 0),
      militia: (traits.stability || 0) + (traits.unity || 0) + (traits.nonlethal || 0),
      peacekeeper_corp: (traits.control || 0) + (traits.nonlethal || 0) + (traits.justice || 0)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function resolveOccult(traits, alignmentKey) {
    var score = {
      alchemist: (traits.economy || 0) + (traits.ritual || 0) + (traits.truth || 0),
      gnostic: (traits.truth || 0) + (traits.intrigue || 0) + (traits.faith || 0),
      goetic_summoner: (traits.corruption || 0) + (traits.risk || 0) + (traits.ritual || 0),
      kabbalist: (traits.faith || 0) + (traits.ritual || 0) + (traits.unity || 0) + (alignmentKey === "tiphareth" || alignmentKey === "binah" || alignmentKey === "kether" ? 2 : 0),
      rosicrucian: (traits.culture || 0) + (traits.diplomacy || 0) + (traits.ritual || 0),
      tarot_mage: (traits.foresight || 0) + (traits.risk || 0) + (traits.truth || 0)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function resolveClass(traits) {
    var score = {
      aurablade: (traits.violence || 0) + (traits.faith || 0),
      breaker: (traits.violence || 0) + (traits.logistics || 0) + Math.floor((traits.ambition || 0) / 2),
      dreamwalker: (traits.intrigue || 0) + (traits.faith || 0) + (traits.ritual || 0),
      harmony_marshal: (traits.unity || 0) + (traits.diplomacy || 0) + (traits.logistics || 0),
      pactkeeper: (traits.control || 0) + (traits.economy || 0) + (traits.diplomacy || 0),
      shadowjack: (traits.intrigue || 0) + (traits.mobility || 0) + Math.floor((traits.risk || 0) / 2),
      soul_smith: (traits.faith || 0) + (traits.stability || 0) + (traits.ritual || 0),
      titanbound: (traits.stability || 0) + (traits.control || 0) + (traits.nonlethal || 0),
      wyrd_lens_adept: Math.floor((traits.foresight || 0) / 2) + Math.floor((traits.truth || 0) / 2),
      cosmic_linguist: (traits.culture || 0) + (traits.diplomacy || 0) + (traits.truth || 0),
      phantom_courier: (traits.mobility || 0) + (traits.logistics || 0) + (traits.diplomacy || 0) + Math.floor((traits.freedom || 0) / 2)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function resolveAncestry(traits, alignmentKey) {
    var score = {
      chupacabra: (traits.survival || 0) + (traits.violence || 0) + Math.floor((traits.risk || 0) / 2),
      circuitborn: (traits.control || 0) + Math.floor((traits.stability || 0) / 2) + Math.floor((traits.truth || 0) / 4),
      echo_diver: (traits.foresight || 0) + (traits.ritual || 0) + Math.floor((traits.truth || 0) / 2),
      furrykin: (traits.culture || 0) + (traits.mercy || 0) + (traits.freedom || 0),
      menhirkin: (traits.stability || 0) + (traits.nonlethal || 0) + (traits.unity || 0) + Math.floor((traits.logistics || 0) / 4) + Math.floor((traits.mercy || 0) / 2),
      human: 2,
      jackalope: (traits.intrigue || 0) + (traits.mobility || 0) + (traits.risk || 0),
      oldenborn: (traits.faith || 0) + (traits.justice || 0) + (alignmentKey === "tiphareth" || alignmentKey === "kether" || alignmentKey === "chesed" ? 2 : 0),
      qliph_scarred: (traits.corruption || 0) + (traits.survival || 0) + Math.floor((traits.risk || 0) / 2),
      rustlander_scavenger: (traits.economy || 0) + (traits.logistics || 0) + (traits.survival || 0),
      sephirotic_scion: (traits.faith || 0) + (traits.ritual || 0) + (alignmentKey === "tiphareth" || alignmentKey === "binah" || alignmentKey === "kether" || alignmentKey === "chesed" ? 3 : 0),
      stormborn_nomad: (traits.mobility || 0) + (traits.freedom || 0) + (traits.risk || 0)
    };

    return {
      key: pickHighest(score),
      scores: score,
      ranked: sortEntriesDescending(score)
    };
  }

  function topTraitPairs(traits, count) {
    var arr = [];
    var k;
    for (k in traits) {
      if (!Object.prototype.hasOwnProperty.call(traits, k)) continue;
      arr.push([k, traits[k]]);
    }
    arr.sort(function (a, b) { return b[1] - a[1]; });
    return arr.slice(0, count || 5);
  }

  function buildExpandedText(result) {
    var philosophy = result.philosophy.key;
    var alignment = result.alignment.key;
    var cls = result.class.key;

    var meaning = "You solve problems in a way that reveals a coherent pressure-identity. In BBTTCC terms, your instincts point toward a specific political, spiritual, and tactical posture.";
    var strengths = "You tend to be strongest when acting in accordance with your dominant values rather than borrowing someone else's style.";
    var breaks = "Your failure mode appears when your strongest instincts calcify into reflex, and reflex becomes ideology.";
    var mal = "You are, regrettably, making sense. Broken world. Broken people. Functional pattern recognition.";

    if (philosophy === "social_democratic") {
      meaning = "You are a stabilizer under pressure. You believe systems should protect people, not consume them. You are at your best when holding together a group that would otherwise fragment.";
      strengths = "Coordination, morale support, protection, and building durable order without surrendering compassion.";
      breaks = "You can become over-responsible, hesitant, or too willing to absorb burdens that should be shared. If balance becomes fear, you stall when decisive action is required.";
      mal = "You are trying to keep the world from tearing itself apart. Admirable. Also terrible for your blood pressure.";
    } else if (philosophy === "liberal") {
      meaning = "You default toward rights, restraint, and negotiated order. You want power bounded, cruelty checked, and people treated as ends rather than fuel.";
      strengths = "Mediation, diplomacy, civic legitimacy, and keeping violence from becoming the first answer to every question.";
      breaks = "You may overestimate the good faith of people who only understand leverage. Too much procedural trust can become surrender by paperwork.";
      mal = "You believe rules can save people. Sometimes they can. Sometimes they are just prettier knives.";
    } else if (philosophy === "authoritarian_statist") {
      meaning = "You prioritize order, containment, and coherent control. You do not mistake stability for softness; to you, chaos is the first real enemy.";
      strengths = "Command presence, infrastructure thinking, disciplined response, and making systems hold under stress.";
      breaks = "Your shadow is overreach. Once control becomes identity, dissent starts to look like disease.";
      mal = "You can keep the machine running. That is useful. It is also how machines learn to eat their operators.";
    } else if (philosophy === "anarchist") {
      meaning = "You distrust imposed hierarchy and prefer distributed intelligence over centralized command. Freedom is not a decorative value for you; it is structural.";
      strengths = "Adaptive thinking, anti-authoritarian clarity, cultural resilience, and refusal to confuse domination with leadership.";
      breaks = "You can underweight the real need for coordination and continuity. Sometimes the state is the problem. Sometimes the fire still needs a bucket line.";
      mal = "You heard 'chain of command' and immediately reached for bolt cutters. Honestly, fair.";
    } else if (philosophy === "theocratic") {
      meaning = "You orient toward sacred order, moral coherence, and purification. Meaning matters to you as much as outcome, maybe more.";
      strengths = "Moral clarity, ritual leadership, corruption resistance, and holding a group together around shared belief.";
      breaks = "Your danger is sanctified certainty. Once you stop interrogating your own righteousness, every opponent starts to look cosmically disposable.";
      mal = "You want the world to mean something. Cute. Just make sure the meaning doesn't start demanding sacrifices.";
    } else if (philosophy === "fascist") {
      meaning = "You trend toward strength, dominance, and enforced coherence under pressure. Your answers privilege effectiveness, command, and the willingness to harden.";
      strengths = "Decisiveness, force concentration, intimidation, and fast action under collapse conditions.";
      breaks = "Your shadow is cruelty dressed as necessity. When mercy becomes weakness in your head, you start building monsters and calling them institutions.";
      mal = "You do not want order. You want victory wearing order's clothes. Those are not the same garment.";
    } else if (philosophy === "libertarian") {
      meaning = "You prefer voluntary coordination, autonomy, and negotiated exchange over coercive structure. You want breathing room and fewer boots.";
      strengths = "Flexible diplomacy, decentralized systems, initiative, and respect for individual agency.";
      breaks = "You may underrate the need for collective obligation in actual crisis. Freedom without ballast can become abandonment with better branding.";
      mal = "You want fewer hands on the wheel. Reasonable. Less ideal when the bus is already on fire.";
    } else if (philosophy === "marxist_communist") {
      meaning = "You think unjust systems produce unjust lives, and that redistribution is not charity but repair. Collective welfare matters more to you than individual hoarding.";
      strengths = "Solidarity logic, anti-exploitation instinct, structural critique, and building cooperative survival under pressure.";
      breaks = "Your danger is flattening human complexity into historical role. If everyone becomes an instance of class position, you stop seeing the person carrying it.";
      mal = "You identified the machine and asked who profits from it. Finally, someone read the assignment.";
    }

    if (alignment === "tiphareth") {
      strengths += " You also show strong synthesis energy: you reconcile competing forces without pretending they were never in conflict.";
    } else if (alignment === "geburah") {
      strengths += " There is a real cutting edge in you: when judgment lands, it lands hard.";
    } else if (alignment === "chesed") {
      strengths += " Your mercy profile is unusually strong, which means people are likely to feel safer near you.";
    } else if (alignment === "binah") {
      strengths += " You also think in structure, boundary, and safeguards rather than wishful vibes.";
    } else if (alignment === "hod") {
      strengths += " You understand the battlefield of language and symbol better than most.";
    }

    if (cls === "shadowjack") {
      meaning += " Your class profile suggests stealth, leverage, and indirect action rather than frontal heroics.";
    } else if (cls === "harmony_marshal") {
      meaning += " Your class profile points toward coordination, morale, and purposeful group action.";
    } else if (cls === "wyrd_lens_adept") {
      meaning += " Your class profile points toward pattern-recognition, strange truth, and acting from insight rather than impulse.";
    } else if (cls === "pactkeeper") {
      meaning += " Your class profile points toward structure, obligation, and making systems answer for themselves.";
    } else if (cls === "aurablade" || cls === "breaker") {
      meaning += " Your class profile points toward kinetic intervention: when things go wrong, you become the answer with edges.";
    }

    return {
      meaning: meaning,
      strengths: strengths,
      breaks: breaks,
      malVerdict: mal
    };
  }

  function buildResult(traits) {
    var philosophy = resolvePhilosophy(traits);
    var alignment = resolveAlignment(traits);
    var archetype = resolveArchetype(traits);
    var crew = resolveCrew(traits);
    var occult = resolveOccult(traits, alignment.key);
    var cls = resolveClass(traits);
    var ancestry = resolveAncestry(traits, alignment.key);
    var expanded = buildExpandedText({
      philosophy: philosophy,
      alignment: alignment,
      archetype: archetype,
      crew: crew,
      occult: occult,
      class: cls,
      ancestry: ancestry
    });

    return {
      traits: traits,
      topTraits: topTraitPairs(traits, 7),
      philosophy: philosophy,
      alignment: alignment,
      archetype: archetype,
      crew: crew,
      occult: occult,
      class: cls,
      ancestry: ancestry,
      expanded: expanded,
      short: {
        philosophy: philosophy.key,
        alignment: alignment.key,
        archetype: archetype.key,
        crew: crew.key,
        occult: occult.key,
        class: cls.key,
        ancestry: ancestry.key
      }
    };
  }

  function randomAnswers(spec) {
    var out = {};
    var questions = (spec && spec.questions) ? spec.questions : [];
    var letters = ["A", "B", "C", "D", "E"];
    var i;
    for (i = 0; i < questions.length; i++) {
      out[String(questions[i].id)] = letters[Math.floor(Math.random() * letters.length)];
    }
    return out;
  }

  async function loadSpec(path) {
    var p = path || DEFAULT_SPEC_PATH;
    var response;
    try {
      response = await fetch(p);
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } catch (err) {
      warn("Failed to load sorting spec from path:", p, err);
      throw err;
    }
  }

  function buildChatHtml(result, answers, spec) {
    var html = "";
    html += "<div class='bbttcc-sorting-chat'>";
    html += "<h2 style='margin:0 0 0.4em 0;'>Your BBTTCC Identity Stack</h2>";
    html += "<p style='margin:0.2em 0;'><b>Philosophy:</b> " + titleCase(result.short.philosophy) + "</p>";
    html += "<p style='margin:0.2em 0;'><b>Alignment:</b> " + titleCase(result.short.alignment) + "</p>";
    html += "<p style='margin:0.2em 0;'><b>Archetype:</b> " + titleCase(result.short.archetype) + "</p>";
    html += "<p style='margin:0.2em 0;'><b>Crew Type:</b> " + titleCase(result.short.crew) + "</p>";
    html += "<p style='margin:0.2em 0;'><b>Occult Association:</b> " + titleCase(result.short.occult) + "</p>";
    html += "<p style='margin:0.2em 0;'><b>Suggested Class:</b> " + titleCase(result.short.class) + "</p>";
    html += "<p style='margin:0.2em 0 0.8em 0;'><b>Suggested Ancestry:</b> " + titleCase(result.short.ancestry) + "</p>";

    html += "<h3 style='margin:0.8em 0 0.3em 0;'>What this means</h3>";
    html += "<p style='margin:0 0 0.6em 0;'>" + result.expanded.meaning + "</p>";

    html += "<h3 style='margin:0.8em 0 0.3em 0;'>What you are good at</h3>";
    html += "<p style='margin:0 0 0.6em 0;'>" + result.expanded.strengths + "</p>";

    html += "<h3 style='margin:0.8em 0 0.3em 0;'>What may break you</h3>";
    html += "<p style='margin:0 0 0.6em 0;'>" + result.expanded.breaks + "</p>";

    html += "<h3 style='margin:0.8em 0 0.3em 0;'>Mal's Verdict</h3>";
    html += "<p style='margin:0 0 0.6em 0;'><i>" + result.expanded.malVerdict + "</i></p>";

    html += "<details style='margin-top:0.75em;'><summary>Top Traits</summary><ul>";
    var i;
    for (i = 0; i < result.topTraits.length; i++) {
      html += "<li><b>" + titleCase(result.topTraits[i][0]) + ":</b> " + result.topTraits[i][1] + "</li>";
    }
    html += "</ul></details>";

    if (answers && spec && spec.questions) {
      html += "<details style='margin-top:0.75em;'><summary>Answers</summary><ul>";
      for (i = 0; i < spec.questions.length; i++) {
        var q = spec.questions[i];
        var aKey = answers[String(q.id)] || answers[q.id] || "—";
        var aText = (q.answers && q.answers[aKey]) ? q.answers[aKey].text : "—";
        html += "<li><b>Q" + q.id + ":</b> " + aKey + " — " + aText + "</li>";
      }
      html += "</ul></details>";
    }

    html += "</div>";
    return html;
  }

  async function toChat(result, answers, spec) {
    var content = buildChatHtml(result, answers, spec);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker(),
      content: content
    });
  }

  function getIdentityApi() {
    return game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.identity : null;
  }

  function getCharacterOptionsApi() {
    return game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.characterOptions : null;
  }

  function getPackByKey(key) {
    try {
      return game.packs.get(key);
    } catch (_err) {
      return null;
    }
  }

  async function findDocInPackByIdentifier(packId, identifier) {
    var pack = getPackByKey(packId);
    var index, rows, i, row, rid;

    if (!pack) {
      warn("Pack not found:", packId);
      return null;
    }

    try {
      index = await pack.getIndex({ fields: ["name", "type", "system.identifier"] });
      rows = Array.from(index);
    } catch (_err) {
      warn("Index load failed for pack:", packId, _err);
      return null;
    }

    log("Searching pack", packId, "for identifier", identifier, "entries", rows.length);

    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      rid = String((row.system && row.system.identifier) || row["system.identifier"] || "");

      if (i < 5) {
        log("Sample row", {
          name: row.name,
          type: row.type,
          identifier: rid,
          rawSystem: row.system,
          rawFlat: row["system.identifier"]
        });
      }

      if (rid === String(identifier || "")) {
        log("Matched row in pack", packId, row.name, rid);
        return await pack.getDocument(row._id);
      }
    }

    warn("No identifier match in pack", packId, "for", identifier);
    return null;
  }

  async function findOptionDocByOptionKey(packId, optionKey) {
    var pack = getPackByKey(packId);
    var index, rows, i, row, doc, key, rid, rname;
    var wanted = String(optionKey || "");
    var wantedNorm = normKey(wanted);

    if (!pack) {
      warn("Pack not found:", packId);
      return null;
    }

    try {
      index = await pack.getIndex({
        fields: [
          "name",
          "type",
          "system.identifier",
          "flags.bbttcc-character-options.category",
          "flags.bbttcc-character-options.option.key"
        ]
      });
      rows = Array.from(index);
    } catch (_err) {
      warn("Index load failed for pack:", packId, _err);
      return null;
    }

    log("Searching option pack", packId, "for optionKey", optionKey, "entries", rows.length);

    for (i = 0; i < rows.length; i++) {
      row = rows[i];

      key = String(
        (((row.flags || {})["bbttcc-character-options"] || {}).option || {}).key ||
        row["flags.bbttcc-character-options.option.key"] ||
        ""
      );

      rid = String((row.system && row.system.identifier) || row["system.identifier"] || "");
      rname = String(row.name || "");

      if (i < 5) {
        log("Sample option row", {
          name: row.name,
          identifier: rid,
          optionKey: key,
          rawFlags: row.flags,
          rawFlatKey: row["flags.bbttcc-character-options.option.key"]
        });
      }

      if (isTieredIdentifier(rid)) continue;
      if (isTieredName(rname)) continue;

      if (
        key === wanted ||
        rid === wanted ||
        normKey(key) === wantedNorm ||
        normKey(rid) === wantedNorm ||
        normKey(rname) === wantedNorm
      ) {
        log("Matched option row in pack", packId, row.name, key, rid);
        doc = await pack.getDocument(row._id);
        if (doc) return doc;
      }
    }

    warn("No optionKey match in pack", packId, "for", optionKey);
    return null;
  }

  async function findClassDoc(shortKey) {
    var canonical = CANONICAL_CLASS_IDS[normKey(shortKey)] || shortKey;
    return findDocInPackByIdentifier("bbttcc-master-content.classes", canonical);
  }

  async function findAlignmentDoc(shortKey) {
    var canonical = CANONICAL_ALIGNMENT_IDS[normKey(shortKey)] || shortKey;
    return findDocInPackByIdentifier("bbttcc-character-options.sephirothic-alignments", canonical);
  }

  async function findArchetypeDoc(shortKey) {
    var canonical = CANONICAL_ARCHETYPE_KEYS[normKey(shortKey)] || shortKey;
    return findOptionDocByOptionKey("bbttcc-character-options.character-archetypes", canonical);
  }

  async function findCrewDoc(shortKey) {
    var canonical = CANONICAL_CREW_KEYS[normKey(shortKey)] || shortKey;
    return findOptionDocByOptionKey("bbttcc-character-options.crew-types", canonical);
  }

  async function findOccultDoc(shortKey) {
    var canonical = CANONICAL_OCCULT_KEYS[normKey(shortKey)] || shortKey;
    return findOptionDocByOptionKey("bbttcc-character-options.occult-associations", canonical);
  }

  async function findAncestryDoc(shortKey) {
    var canonical = CANONICAL_ANCESTRY_IDS[normKey(shortKey)] || shortKey;
    return findDocInPackByIdentifier("bbttcc-master-content.ancestries", canonical);
  }

  async function findDefaultEnlightenmentDoc() {
    return findDocInPackByIdentifier("bbttcc-character-options.enlightenment-levels", "enlightenment-unawakened");
  }

  function getPoliticalPhilosophyFlagKey(shortKey) {
    var map = {
      authoritarian_statist: "authoritarian",
      liberal: "liberal",
      social_democratic: "social_democratic",
      libertarian: "libertarian",
      fascist: "fascist",
      theocratic: "theocratic",
      marxist_communist: "marxist",
      anarchist: "anarchist"
    };
    return map[shortKey] || shortKey;
  }
  async function buildGuidedPayloadFromResult(result, opts) {
    opts = opts || {};

    var classDoc = await findClassDoc(result.short.class);
    var ancestryDoc = await findAncestryDoc(result.short.ancestry);
    var archetypeDoc = await findArchetypeDoc(result.short.archetype);
    var crewDoc = await findCrewDoc(result.short.crew);
    var occultDoc = await findOccultDoc(result.short.occult);
    var alignmentDoc = await findAlignmentDoc(result.short.alignment);
    var enlightDoc = await findDefaultEnlightenmentDoc();

    if (!classDoc) throw new Error("Missing class doc for " + result.short.class);
    if (!ancestryDoc) throw new Error("Missing ancestry doc for " + result.short.ancestry);
    if (!archetypeDoc) throw new Error("Missing archetype doc for " + result.short.archetype);
    if (!crewDoc) throw new Error("Missing crew doc for " + result.short.crew);
    if (!occultDoc) throw new Error("Missing occult doc for " + result.short.occult);
    if (!alignmentDoc) throw new Error("Missing alignment doc for " + result.short.alignment);
    if (!enlightDoc) throw new Error("Missing default enlightenment doc for enlightenment-unawakened");

    return {
      name: opts.name || ("Sorted " + titleCase(result.short.class)),
      factionId: opts.factionId || "",
      speciesUuid: ancestryDoc.uuid,
      classUuid: classDoc.uuid,
      picks: {
        archetype: {
          pack: "bbttcc-character-options.character-archetypes",
          id: archetypeDoc.id
        },
        crew: {
          pack: "bbttcc-character-options.crew-types",
          id: crewDoc.id
        },
        sephirot: {
          pack: "bbttcc-character-options.sephirothic-alignments",
          id: alignmentDoc.id
        },
        political: {
          pack: null,
          id: getPoliticalPhilosophyFlagKey(result.short.philosophy)
        },
        occult: {
          pack: "bbttcc-character-options.occult-associations",
          id: occultDoc.id
        },
        enlight: {
          pack: "bbttcc-character-options.enlightenment-levels",
          id: enlightDoc.id
        }
      }
    };
  }
  async function createActorFromResult(result, opts) {
    opts = opts || {};
    var actorName = opts.name || ("Sorted " + titleCase(result.short.class));
    var actor = await Actor.create({
      name: actorName,
      type: "character"
    });

    var patchIdentity = {
      archetype: {
        key: CANONICAL_ARCHETYPE_KEYS[normKey(result.short.archetype)] || result.short.archetype,
        pack: "bbttcc-character-options.character-archetypes",
        category: "character-archetypes"
      },
      crew: {
        key: CANONICAL_CREW_KEYS[normKey(result.short.crew)] || result.short.crew,
        pack: "bbttcc-character-options.crew-types",
        category: "crew-types"
      },
      occult: {
        key: CANONICAL_OCCULT_KEYS[normKey(result.short.occult)] || result.short.occult,
        pack: "bbttcc-character-options.occult-associations",
        category: "occult-associations"
      },
      sephirothicAlignment: {
        key: CANONICAL_ALIGNMENT_IDS[normKey(result.short.alignment)] || result.short.alignment,
        pack: "bbttcc-character-options.sephirothic-alignments",
        category: "sephirothic-alignments"
      }
    };

    var identityApi = getIdentityApi();
    if (identityApi && typeof identityApi.setIdentityFlags === "function") {
      try {
        await identityApi.setIdentityFlags(actor.id, patchIdentity);
      } catch (err) {
        warn("Identity API setIdentityFlags failed; storing fallback flag.", err);
        await actor.setFlag("bbttcc-character-options", "identity", patchIdentity);
      }
    } else {
      await actor.setFlag("bbttcc-character-options", "identity", patchIdentity);
    }

    try {
      await actor.setFlag("bbttcc-aae", "politicalPhilosophy", getPoliticalPhilosophyFlagKey(result.short.philosophy));
    } catch (errPol) {
      warn("Failed to set political philosophy flag", errPol);
    }

    try {
      await actor.setFlag("bbttcc-sorting-engine", "result", {
        short: result.short,
        topTraits: result.topTraits,
        traits: result.traits
      });
    } catch (errStore) {
      warn("Failed to store sorting result flag", errStore);
    }

   var embeddedToCreate = [];

   var classDoc = await findClassDoc(result.short.class);
   if (classDoc) embeddedToCreate.push(classDoc.toObject());
   else warn("Missing class doc for", result.short.class);

   var ancestryDoc = await findAncestryDoc(result.short.ancestry);
   if (ancestryDoc) embeddedToCreate.push(ancestryDoc.toObject());
   else warn("Missing ancestry doc for", result.short.ancestry);

   var archetypeDoc = await findArchetypeDoc(result.short.archetype);
   if (archetypeDoc) embeddedToCreate.push(archetypeDoc.toObject());
   else warn("Missing archetype doc for", result.short.archetype);

   var crewDoc = await findCrewDoc(result.short.crew);
   if (crewDoc) embeddedToCreate.push(crewDoc.toObject());
   else warn("Missing crew doc for", result.short.crew);

   var occultDoc = await findOccultDoc(result.short.occult);
   if (occultDoc) embeddedToCreate.push(occultDoc.toObject());
   else warn("Missing occult doc for", result.short.occult);

   var alignmentDoc = await findAlignmentDoc(result.short.alignment);
   if (alignmentDoc) embeddedToCreate.push(alignmentDoc.toObject());
   else warn("Missing alignment doc for", result.short.alignment);

    if (embeddedToCreate.length) {
      try {
        await actor.createEmbeddedDocuments("Item", embeddedToCreate);
      } catch (errItems) {
        warn("Failed to embed one or more generated items", errItems);
      }
    }

    var charApi = getCharacterOptionsApi();
    if (charApi && typeof charApi.recalcActor === "function") {
      try {
        await charApi.recalcActor(actor.id);
      } catch (errRecalc) {
        warn("characterOptions.recalcActor failed", errRecalc);
      }
    }

    return actor;
  }

  async function run(answers, opts) {
    opts = opts || {};
    var spec = opts.spec || await loadSpec(opts.specPath);
    var finalAnswers = answers || randomAnswers(spec);
    var traits = scoreQuiz(finalAnswers, spec);
    var result = buildResult(traits);

    if (opts.chat) await toChat(result, finalAnswers, spec);

    return {
      spec: spec,
      answers: finalAnswers,
      traits: traits,
      result: result
    };
  }

  async function runAndCreate(answers, opts) {
    opts = opts || {};
    var bundle = await run(answers, opts);
    var autoLink = game && game.bbttcc && game.bbttcc.api ? game.bbttcc.api.autoLink : null;

    if (autoLink && typeof autoLink.beginGuidedCreateFromPayload === "function") {
      var payload = await buildGuidedPayloadFromResult(bundle.result, opts);
      var actor = await autoLink.beginGuidedCreateFromPayload(payload);
      bundle.actor = actor;
      bundle.payload = payload;

      if (opts.open !== false && actor && actor.sheet) {
        try {
          actor.sheet.render(true, { focus: true });
        } catch (_err) {}
      }

      return bundle;
    }

    var fallbackActor = await createActorFromResult(bundle.result, opts);
    bundle.actor = fallbackActor;

    if (opts.open !== false && fallbackActor && fallbackActor.sheet) {
      try {
        fallbackActor.sheet.render(true, { focus: true });
      } catch (_err2) {}
    }

    return bundle;
  }

Hooks.once("ready", function () {
  game.bbttcc = game.bbttcc || {};
  game.bbttcc.api = game.bbttcc.api || {};
  game.bbttcc.api.sorting = {
    loadSpec: loadSpec,
    scoreQuiz: scoreQuiz,
    resolvePhilosophy: resolvePhilosophy,
    resolveAlignment: resolveAlignment,
    resolveArchetype: resolveArchetype,
    resolveCrew: resolveCrew,
    resolveOccult: resolveOccult,
    resolveClass: resolveClass,
    resolveAncestry: resolveAncestry,
    buildResult: buildResult,
    buildGuidedPayloadFromResult: buildGuidedPayloadFromResult,
    randomAnswers: function () {
      return loadSpec().then(function (spec) {
        return randomAnswers(spec);
      });
    },
    runTest: async function (answers, opts) {
      return run(answers, opts || {});
    },
    runAndCreate: async function (answers, opts) {
      return runAndCreate(answers, opts || {});
    },
    createActorFromResult: createActorFromResult
  };

  log("API ready at game.bbttcc.api.sorting");
});
})();