// Bad Eden — Maneuver audit wiring (owner rulings 2026-09-09)
//
// Gives a real body to every maneuver the 2026-09-09 audit found billing OP for
// nothing, fixes the two whose behaviour contradicted their copy (Prayer in the
// Smoke, Signal Hijack), gives all 18 character-option L1 maneuvers a body, and
// retires the duplicate rows. Bodies are PURE throughput handlers returning
// bundles — the console's generic pre-roll consumer reads thisRound dice
// effects before the dice, B2/WME applies factionEffects at commit, scene verbs
// dispatch at commit, scenario verbs in their engine. Four maneuvers that must
// write hex/actor state (Siege Breaker Volley, Engine of Absolution, Crown of
// Mercy, Ego Breaker) are handled in module.raid-console.js post-commit.
//
// Registers into raid.EFFECTS (merge — loader/compat metadata kept) and
// agent.__THROUGHPUT (override) in three passes: script load, ready microtask,
// ready + 600 ms (after the JSON loader's fetch and the agent API's attach).

(() => {
  const TAG = "[bbttcc-raid/maneuvers-audit-wiring]";
  const ok = (ctx) => { const t = String(ctx?.outcomeTier || "").toLowerCase(); return t === "success" || t === "great_success"; };
  const att = (ctx) => ctx?.attackerFactionId || null;
  const def = (ctx) => ctx?.defenderFactionId || null;
  const bundle = (key, o) => Object.assign({ roundEffects: [], factionEffects: [], scenarioEffects: [], worldEffects: [], meta: { source: "throughput", maneuverKey: key, preview: true } }, o || {});
  const bonus = (side, amount, note) => ({ type: "rollBonus", scope: side, amount, window: "thisRound", note });
  const adv   = (side, note) => ({ type: "advantage", scope: side, window: "thisRound", note });
  const dis   = (side, note) => ({ type: "disadvantage", scope: side, window: "thisRound", note });
  const nextAdv = (side, note) => ({ type: "advantage", scope: side, when: "nextRoll", note });

  // ── 1. The audit's no-ops, now wired (JSON / compat keys) ────────────────
  const WIRED = [
    { key: "ghost_slip_infiltration", fireMode: "pre-roll",
      text: "+2 to the attacker's roll this round; in an Infiltration-Alarm raid the alarm also drops 1.",
      throughput: (ctx) => bundle("ghost_slip_infiltration", { roundEffects: [bonus("attacker", 2, "Ghost-Slip: +2")], scenarioEffects: [{ type: "alarmDecay", delta: 1, reason: "Ghost-Slip Infiltration" }] }) },
    { key: "sympathetic_stabilization", fireMode: "pre-roll",
      text: "Defenders ignore the first Structure loss this round; on success your faction's Morale +1.",
      throughput: (ctx) => bundle("sympathetic_stabilization", { roundEffects: [{ type: "ignoreStructureLoss", scope: "defender", count: 1, window: "thisRound", note: "Sympathetic Stabilization" }], factionEffects: ok(ctx) ? [{ factionId: att(ctx), moraleDelta: 1, label: "Sympathetic Stabilization" }] : [] }) },
    { key: "gradient_surge", fireMode: "post-commit",
      text: "Converts 10 marks Economy into 10 marks Logistics on the spot.",
      throughput: (ctx) => bundle("gradient_surge", { factionEffects: [{ factionId: att(ctx), opDeltas: { economy: -10, logistics: 10 }, label: "Gradient Surge" }] }) },
    { key: "supply_surge", fireMode: "pre-roll", retired: true,
      text: "Retired — duplicate of Logistical Surge. (+1 to the roll if already selected.)",
      throughput: (ctx) => bundle("supply_surge", { roundEffects: [bonus("attacker", 1, "Supply Surge: +1")] }) },
    { key: "command_overdrive", fireMode: "post-commit",
      text: "Your NEXT round's roll is made with advantage (initiative).",
      throughput: (ctx) => bundle("command_overdrive", { roundEffects: [nextAdv("attacker", "Command Overdrive: initiative next round")] }) },
    { key: "echo_strike_protocol", fireMode: "pre-roll",
      text: "+2 to the attacker's roll this round; on success, enemy tokens on the bound battle scene take 7 damage.",
      throughput: (ctx) => bundle("echo_strike_protocol", { roundEffects: [bonus("attacker", 2, "Echo Strike: +2")].concat(ok(ctx) ? [{ type: "damageSceneTokens", scope: "enemies", factionId: att(ctx), damage: 7, damageType: "kinetic", note: "Echo Strike Protocol" }] : []) }) },
    { key: "overclock_the_golems", fireMode: "pre-roll",
      text: "+3 to the attacker's roll this round; your own tokens on the bound battle scene take 1 damage (the constructs strain).",
      throughput: (ctx) => bundle("overclock_the_golems", { roundEffects: [bonus("attacker", 3, "Overclock: +3"), { type: "damageSceneTokens", scope: "allies", factionId: att(ctx), damage: 1, damageType: "strain", note: "Overclock the Golems: strain" }] }) },
    { key: "radiant_retaliation", fireMode: "post-commit",
      text: "On success: your faction's Darkness −1 and the enemy faction's Darkness +1.",
      throughput: (ctx) => bundle("radiant_retaliation", { factionEffects: ok(ctx) ? [{ factionId: att(ctx), darknessDelta: -1, label: "Radiant Retaliation" }, ...(def(ctx) ? [{ factionId: def(ctx), darknessDelta: 1, label: "Radiant Retaliation" }] : [])] : [] }) },
    { key: "siege_breaker_volley", fireMode: "post-commit",
      text: "On success the target hex loses its Fortified modifier (applied at commit).",
      throughput: (ctx) => bundle("siege_breaker_volley", {}) },
    { key: "ego_breaker", fireMode: "post-commit",
      text: "On success the enemy faction's Violence cap drops 30 marks (permanent cap bump on the defender).",
      throughput: (ctx) => bundle("ego_breaker", {}) },
    { key: "temporal_armistice", fireMode: "pre-roll",
      text: "All ENEMY maneuvers this round are nullified (yours resolve); on success your Darkness −2 and the enemy's Morale +1.",
      throughput: (ctx) => bundle("temporal_armistice", { roundEffects: [{ type: "nullifyAllManeuvers", scope: "enemy", window: "thisRound", note: "Temporal Armistice" }], factionEffects: ok(ctx) ? [{ factionId: att(ctx), darknessDelta: -2, label: "Temporal Armistice" }, ...(def(ctx) ? [{ factionId: def(ctx), moraleDelta: 1, label: "Temporal Armistice" }] : [])] : [] }) },
    { key: "crown_of_mercy", fireMode: "post-commit",
      text: "On success the corrupted Spark seated on the target hex is repaired (applied at commit).",
      throughput: (ctx) => bundle("crown_of_mercy", {}) },
    { key: "engine_of_absolution", fireMode: "post-commit",
      text: "On success the target hex is restored: Contaminated / Radiation Zone / Damaged Infrastructure removed, darkness pips 0, Purified (applied at commit).",
      throughput: (ctx) => bundle("engine_of_absolution", {}) },
    { key: "ego_dragon_echo", fireMode: "pre-roll",
      text: "+4 to the attacker's roll this round; your faction's Darkness +2 whatever happens.",
      throughput: (ctx) => bundle("ego_dragon_echo", { roundEffects: [bonus("attacker", 4, "Ego-Dragon Echo: +4")], factionEffects: [{ factionId: att(ctx), darknessDelta: 2, label: "Ego-Dragon Echo" }] }) },
    { key: "diplomatic_channel", fireMode: "post-commit",
      text: "On success: your faction's Loyalty +1 and Morale +1; the other side's Morale +1.",
      throughput: (ctx) => bundle("diplomatic_channel", { factionEffects: ok(ctx) ? [{ factionId: att(ctx), loyaltyDelta: 1, moraleDelta: 1, label: "Diplomatic Channel" }, ...(def(ctx) ? [{ factionId: def(ctx), moraleDelta: 1, label: "Diplomatic Channel" }] : [])] : [] }) },
    // Copy-vs-behaviour fixes (owner ruling 3): behaviour fixed, not the copy.
    { key: "prayer_in_the_smoke", fireMode: "pre-roll",
      text: "Advantage on the attacker's roll this round; on success your faction's Darkness −1.",
      throughput: (ctx) => bundle("prayer_in_the_smoke", { roundEffects: [adv("attacker", "Prayer in the Smoke")], factionEffects: ok(ctx) ? [{ factionId: att(ctx), darknessDelta: -1, label: "Prayer in the Smoke" }] : [] }) },
    { key: "signal_hijack", fireMode: "pre-roll",
      text: "Enemy communications fail: the opposing side rolls with disadvantage this round; in an Infiltration-Alarm raid the alarm also drops 1.",
      throughput: (ctx) => bundle("signal_hijack", { roundEffects: [dis("enemy", "Signal Hijack")], scenarioEffects: [{ type: "alarmDecay", delta: 1, reason: "Signal Hijack" }] }) },
    // Duplicate rows retired (ruling 4) — the kept twin: Rally the Line / Take Cover / Read the Room / Sap the Walls / Logistical Surge.
    { key: "faction_wide_rally", retired: true }, { key: "war_chest", retired: true }, { key: "distract", retired: true },
    { key: "courtly_eavesdrop", retired: true }, { key: "suppressive_volley", retired: true }, { key: "logistics_surge_s2", retired: true }
  ];

  // ── 2. Character-option L1 maneuvers — all 18 (ruling 2) ─────────────────
  const L1 = {
    shock_command:          { fireMode: "pre-roll", text: "Warlord: +2 to the attacker's roll this round.", t: (c) => ({ roundEffects: [bonus("attacker", 2, "Shock Command")] }) },
    liturgical_rally:       { fireMode: "pre-roll", text: "Hierophant: advantage on the attacker's roll; on success Morale +1.", t: (c) => ({ roundEffects: [adv("attacker", "Liturgical Rally")], factionEffects: ok(c) ? [{ factionId: att(c), moraleDelta: 1, label: "Liturgical Rally" }] : [] }) },
    bureaucratic_override:  { fireMode: "post-commit", text: "Mayor-Administrator: +10 marks Economy next round.", t: (c) => ({ factionEffects: [{ factionId: att(c), deferred: { when: "nextRound", opDeltas: { economy: 10 } }, label: "Bureaucratic Override" }] }) },
    prepared_insight:       { fireMode: "pre-roll", text: "Wizard-Scholar: the opposing side rolls with disadvantage this round.", t: (c) => ({ roundEffects: [dis("enemy", "Prepared Insight")] }) },
    inherited_deference:    { fireMode: "pre-roll", text: "Ancient Blood: +1 to your roll and any enemy Propaganda maneuver this round is cancelled.", t: (c) => ({ roundEffects: [bonus("attacker", 1, "Inherited Deference"), { type: "cancelEnemyManeuver", tags: ["propaganda"], scope: "enemy" }] }) },
    coordinated_advance:    { fireMode: "pre-roll", text: "Squad Leader: +1 to the attacker's roll; friendly tokens on the bound battle scene gain Coordinated for a round.", t: (c) => ({ roundEffects: [bonus("attacker", 1, "Coordinated Advance"), { type: "buffSceneTokens", scope: "allies", factionId: att(c), ae: { name: "Coordinated", icon: "icons/svg/sword.svg", changes: [], duration: { rounds: 1 }, description: "Coordinated Advance" }, durationRounds: 1 }] }) },
    hardened_advance:       { fireMode: "pre-roll", text: "Mercenary Band: +1 to the attacker's roll; on success Morale +1.", t: (c) => ({ roundEffects: [bonus("attacker", 1, "Hardened Advance")], factionEffects: ok(c) ? [{ factionId: att(c), moraleDelta: 1, label: "Hardened Advance" }] : [] }) },
    containment_protocol:   { fireMode: "pre-roll", text: "Peacekeeper Corps: +2 to the DEFENDER's roll this round.", t: (c) => ({ roundEffects: [bonus("defender", 2, "Containment Protocol")] }) },
    silent_entry:           { fireMode: "pre-roll", text: "Covert Ops Cell: +1 to your roll; in an Infiltration-Alarm raid the alarm drops 1.", t: (c) => ({ roundEffects: [bonus("attacker", 1, "Silent Entry")], scenarioEffects: [{ type: "alarmDecay", delta: 1, reason: "Silent Entry" }] }) },
    psychological_pressure: { fireMode: "pre-roll", text: "Cultural Ambassadors: the opposing side rolls with disadvantage this round.", t: (c) => ({ roundEffects: [dis("enemy", "Psychological Pressure")] }) },
    formal_parley:          { fireMode: "post-commit", text: "Diplomatic Envoys: on success your Loyalty +1 and the other side's Morale +1; in a Courtly raid suspicion falls 1.", t: (c) => ({ factionEffects: ok(c) ? [{ factionId: att(c), loyaltyDelta: 1, label: "Formal Parley" }, ...(def(c) ? [{ factionId: def(c), moraleDelta: 1, label: "Formal Parley" }] : [])] : [], scenarioEffects: [{ type: "suspicionFall", delta: 1, reason: "Formal Parley" }] }) },
    make_do_and_hold:       { fireMode: "pre-roll", text: "Survivors' Militia: defenders ignore the first Structure loss this round and roll +1.", t: (c) => ({ roundEffects: [{ type: "ignoreStructureLoss", scope: "defender", count: 1, window: "thisRound" }, bonus("defender", 1, "Make Do and Hold")] }) },
    sight_of_the_tree:      { fireMode: "pre-roll", text: "Kabbalist: advantage on the attacker's roll; on success Darkness −1.", t: (c) => ({ roundEffects: [adv("attacker", "Sight of the Tree")], factionEffects: ok(c) ? [{ factionId: att(c), darknessDelta: -1, label: "Sight of the Tree" }] : [] }) },
    rapid_transmutation:    { fireMode: "post-commit", text: "Alchemist: converts 10 marks Economy into 10 marks Faith.", t: (c) => ({ factionEffects: [{ factionId: att(c), opDeltas: { economy: -10, faith: 10 }, label: "Rapid Transmutation" }] }) },
    turn_the_card:          { fireMode: "pre-roll", text: "Tarot Mage: advantage on your roll this round.", t: (c) => ({ roundEffects: [adv("attacker", "Turn the Card")] }) },
    pierce_the_veil:        { fireMode: "pre-roll", text: "Gnostic: the opposing side rolls with disadvantage and any enemy Qliphothic maneuver is cancelled.", t: (c) => ({ roundEffects: [dis("enemy", "Pierce the Veil"), { type: "cancelEffectTags", tags: ["qliphothic"], scope: "enemy" }] }) },
    infernal_bargain:       { fireMode: "pre-roll", text: "Goetic Summoner: +3 to the attacker's roll this round; your Darkness +1 whatever happens.", t: (c) => ({ roundEffects: [bonus("attacker", 3, "Infernal Bargain")], factionEffects: [{ factionId: att(c), darknessDelta: 1, label: "Infernal Bargain" }] }) },
    veiled_access:          { fireMode: "pre-roll", text: "Rosicrucian: +1 to your roll; in an Infiltration-Alarm raid progress +1, in a Courtly raid you draw a secret.", t: (c) => ({ roundEffects: [bonus("attacker", 1, "Veiled Access")], scenarioEffects: [{ type: "progressDelta", delta: 1 }, { type: "drawSecret", side: "att", acquisition: "veiled" }] }) }
  };
  for (const [k, spec] of Object.entries(L1)) {
    WIRED.push({ key: `opt_${k}`, fireMode: spec.fireMode, text: spec.text, throughput: (ctx) => bundle(`opt_${k}`, spec.t(ctx)) });
  }

  function _register(pass) {
    const raid = game.bbttcc?.api?.raid; const agent = game.bbttcc?.api?.agent;
    if (!raid?.EFFECTS) return false;
    const EFFECTS = raid.EFFECTS; const T = agent?.__THROUGHPUT || null;
    let bodies = 0, retired = 0;
    for (const m of WIRED) {
      const eff = EFFECTS[m.key];
      if (eff) {
        if (m.fireMode) eff.fireMode = m.fireMode;
        if (m.text) { eff.text = m.text; if (eff.effects && typeof eff.effects === "object") eff.effects.text = m.text; }
        if (m.retired) { eff.retired = true; retired++; }
        if (typeof m.throughput === "function") eff.throughput = m.throughput;
      }
      if (T && typeof m.throughput === "function") { T[m.key] = m.throughput; bodies++; }
    }
    raid.auditWiredManeuvers = WIRED.map(m => m.key);
    console.log(TAG, `pass ${pass}: ${bodies} bodies, ${retired} retired rows`);
    return true;
  }
  _register("load");
  Hooks.once("ready", () => { Promise.resolve().then(() => _register("ready")); setTimeout(() => _register("ready+600"), 600); setTimeout(() => _register("ready+2000"), 2000); });
  Hooks.on("bbttcc:raid:maneuversLoaded", () => _register("maneuversLoaded"));
})();
