/* groom-political-tags.macro.js — Political Tags pass v1 (2026-07-15)
 *
 * Survey + apply politicalTags so decisions feed the AAE political-pressure
 * pipeline (faction drift, minority pressure among stewards, meter fallout).
 * Before this pass NO beat in the corpus carried a populated politicalTags.
 *
 * DOCTRINE (why tags sit where they sit):
 *  - When a decision's branches land on DISTINCT outcome beats, the tags go
 *    on the OUTCOME beat — it always fires, and tagging both the choice and
 *    its outcome would double-count the drift.
 *  - When branches converge (or stay open), the tags go on the CHOICE
 *    (choice.politicalTags), read by _choicePoliticalTags at fire time.
 *  - Tags are canonical AAE weight keys (bbttcc-aae TAG_WEIGHTS — the editor
 *    picker now pulls this catalog). 1–3 tags per site; the meter is a knife,
 *    not a firehose.
 *
 * WHAT IT DOES (idempotent; DRY_RUN default true; backs up campaigns to
 * downloads before writing):
 *  1. SURVEY census — beats, true decision beats (2+ meaningful choices),
 *     current politicalTags coverage, per-quest gaps.
 *  2. Applies the CURATED map below (merge-only union: existing tags are
 *     never removed or overwritten).
 *  3. HEURISTIC keyword proposals for everything still untagged — printed
 *     for redline ONLY, never auto-applied. Promote keepers into CURATED.
 *
 * Run as GM on EACH instance. Validate after: run any tagged outcome beat
 * from the Beats tab and watch for the 🗳️ Political Pressure GM chat card.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── CURATED MAP (owner-tunable) ───────────────────────────────────────────
  // beatId → { tags: "space separated", choices: { "choice label prefix": "tags" } }
  const CURATED = {
    // — Valhaulan Seal (the Act-2 closer decision; outcomes carry the weight)
    khezek_tor_the_vaulhaulan_seal_restore:  { tags: "order harm_reduction ritual" },
    khezek_tor_the_vaulhaulan_seal_redirect: { tags: "coercive collective_punishment scapegoat" },
    khezek_tor_the_vaulhaulan_seal_break:    { tags: "direct_action" },

    // — Thatwards Ho! Finale outcomes
    raid_thatwards_outcome_friends:       { tags: "consent pluralism compromise" },
    raid_thatwards_outcome_neutral_spark: { tags: "procedural_violation" },   // clean exit, dirty truth
    raid_thatwards_outcome_hostile_fail:  { tags: "coercive" },

    // — Gloomgill, the final exam
    gloomgill_passed: { tags: "transparency" },
    gloomgill_fought: { tags: "coercive direct_action" },

    // — Bandit Accord (mercy vs fear made political)
    bandit_arms_down_accept:   { tags: "mercy due_process harm_reduction" },
    bandit_arms_down_violence: { tags: "purge coercive collective_punishment" },
    bandit_summit_accord:      { tags: "pluralism compromise consent" },
    bandit_summit_absorption:  { tags: "centralize order" },
    bandit_summit_humiliation: { tags: "domination scapegoat" },
    bandit_summit_refuse:      { tags: "enforcement" },
    bandit_envoy: { choices: { "send him back": "order" } },

    // — The Cadence
    cadence_win_style: { tags: "pluralism voluntary" },
    cadence_win_ugly:  { tags: "coercive" },
    cadence_lose:      { tags: "taxation" },   // tribute + a standing rematch

    // — Fifteen-Year Siege
    siege_break:   { tags: "coercive domination" },
    siege_mediate: { tags: "compromise due_process pluralism" },
    siege_join:    { tags: "enforcement" },
    siege_charter: { tags: "regulation ritual" },

    // — Confessor's Debt (Father Tamsin)
    ag_confessor_redeemed:    { tags: "mercy harm_reduction" },
    ag_confessor_exposed:     { tags: "transparency" },
    ag_confessor_pike:        { tags: "due_process enforcement" },
    ag_confessor_counterfeit: { tags: "surveillance procedural_violation" },

    // — Trojan Gift
    trojan_inspect: { tags: "transparency" },
    trojan_refuse:  { tags: "order security" },

    // — Wendigo Confluence (the Seal's mirror)
    wendigo_confluence_repair:   { tags: "harm_reduction ritual mercy" },
    wendigo_confluence_redirect: { tags: "welfare centralize" },
    wendigo_confluence_break:    { tags: "direct_action" },

    // — Gullywasher summit (branches converge → tags ride the choices)
    gullywasher_cultural_summit: { choices: {
      "read the recovered cause": "transparency ritual",
      "set the table":            "pluralism compromise",
      "let dougan host":          "decentralize voluntary",
    } },
    gullywasher_cultural_summit_success: { tags: "solidarity" },

    // — Mara / Pip (commitment beat; routes into live-world Vault beats)
    fc_mara_pip_summons: { choices: { "we'll bring pip home": "solidarity welfare" } },

    // — Khezek-Tor: the mine that answered back
    khezek_tor_mine_that_answered_back_exploit: { tags: "profit_extraction deregulation" },
    khezek_tor_mine_that_answered_back_seal:    { tags: "harm_reduction regulation" },
    khezek_tor_mine_that_answered_back_open:    { tags: "direct_action" },

    // — Khezek-Tor: the darkness shipment
    khezek_tor_darkness_shipment_standardize: { tags: "regulation order" },
    khezek_tor_darkness_shipment_rite:        { tags: "ritual sacred_law" },
    khezek_tor_darkness_shipment_ignore:      { tags: "profit_extraction austerity" },

    // — Lyrenn (the land remembers how you govern)
    lyrenn_the_gentle_pest_kindness: { tags: "mercy mutual_aid" },
    lyrenn_the_gentle_pest_teach:    { tags: "mutual_aid voluntary" },
    lyrenn_the_gentle_pest_violence: { tags: "coercive" },
    lyrenn_the_field_that_remembers_you_burn_the_field:   { tags: "coercive" },
    lyrenn_the_field_that_remembers_you_harvest_the_plants:{ tags: "profit_extraction" },
    lyrenn_the_field_that_remembers_you_plant_speak:       { tags: "consent ritual" },
    lyrenn_forest_will_not_be_fought_negotiate:  { tags: "compromise consent" },
    lyrenn_forest_will_not_be_fought_redirect:   { tags: "harm_reduction" },
    lyrenn_forest_will_not_be_fought_force_burn: { tags: "coercive domination" },
    lyrenn_forest_will_not_be_fought_force_fight:{ tags: "coercive domination" },
  };

  // ── HEURISTICS (propose-only; promote keepers into CURATED) ──────────────
  const HEURISTICS = [
    [/\b(curfew|patrol|martial law|lockdown|checkpoint|impose order)\b/i, "order"],
    [/\b(spy|informant|surveil|eavesdrop|watch(ing)? post|listening post)\b/i, "surveillance"],
    [/\b(crack ?down|suppress|silence (him|her|them|the)|quell)\b/i, "repression"],
    [/\b(execute|hang (him|her|them)|exile|banish|purge)\b/i, "purge"],
    [/\b(conscript|at gunpoint|force them|coerce)\b/i, "coercive"],
    [/\b(trial|tribunal|hearing|testimony|due process)\b/i, "due_process"],
    [/\b(publish|come clean|open the (books|records)|tell the town the truth)\b/i, "transparency"],
    [/\b(spare|pardon|clemency|forgive (him|her|them))\b/i, "mercy"],
    [/\b(feed the|shelter the|clinic|relief|care for the)\b/i, "welfare"],
    [/\b(mutual aid|help each other|neighbors? help)\b/i, "mutual_aid"],
    [/\b(redistribute|share the (land|grain|wealth|water)|ration equally)\b/i, "redistributive"],
    [/\b(tax|tithe|toll|tribute|levy)\b/i, "taxation"],
    [/\b(union|strike committee|collective bargain)\b/i, "unionized"],
    [/\b(sacred|holy law|scripture|blasphem|heresy)\b/i, "sacred_law"],
    [/\b(rite of|ritual|consecrat|blessing)\b/i, "ritual"],
    [/\b(outsiders? (out|go home)|our kind|purity of|true folk)\b/i, "ethnonationalism"],
    [/\b(local control|self-rule|let the town decide|autonomy)\b/i, "decentralize"],
    [/\b(sabotage|riot|storm the|take matters into)\b/i, "direct_action"],
  ];

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];

  const report = [];
  const proposals = [];
  let changes = 0;

  const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); // NBSP-safe
  const tagsOf = raw => Array.isArray(raw)
    ? raw.map(s => String(s || "").trim()).filter(Boolean)
    : String(raw || "").split(/\s+/g).map(s => s.trim()).filter(Boolean);
  const mergeTags = (existing, add) => {
    const set = new Set(tagsOf(existing));
    let grew = false;
    for (const t of tagsOf(add)) if (!set.has(t)) { set.add(t); grew = true; }
    return { grew, str: Array.from(set).join(" ") };
  };
  const choiceTagsOf = c => tagsOf(c?.politicalTags ?? c?.political ?? c?.politics?.tags ?? "");
  const beatTagsOf = b => tagsOf(
    b?.politicalTags ?? b?.politics?.tags ?? b?.worldEffects?.politicalTags ??
    b?.worldEffects?.politics?.tags ?? b?.inject?.politicalTags ?? "");
  const meaningfulChoices = b => (Array.isArray(b?.choices) ? b.choices : [])
    .filter(c => norm(c?.label) && !/^(noted\.?|continue|leave|back to|go to|withdraw)/.test(norm(c.label)));

  // ── 1. survey ─────────────────────────────────────────────────────────────
  const stats = { beats: camp.beats.length, decision: 0, beatTagged: 0, choiceTagged: 0 };
  for (const b of camp.beats) {
    if (meaningfulChoices(b).length >= 2) stats.decision++;
    if (beatTagsOf(b).length) stats.beatTagged++;
    if ((b?.choices || []).some(c => choiceTagsOf(c).length)) stats.choiceTagged++;
  }

  // ── 2. curated apply ──────────────────────────────────────────────────────
  const byId = new Map(camp.beats.map(b => [String(b?.id), b]));
  for (const [bid, spec] of Object.entries(CURATED)) {
    const b = byId.get(bid);
    if (!b) { report.push(`⚠ curated beat not found: ${bid}`); continue; }

    if (spec.tags) {
      const m = mergeTags(b.politicalTags, spec.tags);
      if (m.grew) { b.politicalTags = m.str; changes++; report.push(`✍ ${bid} ← [${m.str}]`); }
      else report.push(`· ok (already) ${bid}`);
    }
    for (const [prefix, ctags] of Object.entries(spec.choices || {})) {
      const c = (b.choices || []).find(x => norm(x?.label).startsWith(norm(prefix)));
      if (!c) { report.push(`⚠ ${bid}: no choice starting "${prefix}"`); continue; }
      const m = mergeTags(c.politicalTags, ctags);
      if (m.grew) { c.politicalTags = m.str; changes++; report.push(`✍ ${bid} › "${c.label.slice(0, 40)}" ← [${m.str}]`); }
      else report.push(`· ok (already) ${bid} › choice "${prefix}"`);
    }
  }

  // ── 3. heuristic proposals (report only) ──────────────────────────────────
  for (const b of camp.beats) {
    if (!b?.id || CURATED[String(b.id)]) continue;
    if (beatTagsOf(b).length) continue;
    const hay = [b.label, b.description, ...(b.choices || []).map(c => c?.label)].join(" \n ");
    const hits = [];
    for (const [rx, tag] of HEURISTICS) if (rx.test(hay) && !hits.includes(tag)) hits.push(tag);
    if (hits.length) proposals.push(`🔎 ${b.id} "${String(b.label || "").slice(0, 48)}" → propose [${hits.slice(0, 3).join(" ")}]`);
  }

  // ── report + write ────────────────────────────────────────────────────────
  const head =
    `[groom-political-tags] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` +
    `  census: ${stats.beats} beats · ${stats.decision} decision beats · ` +
    `${stats.beatTagged} beat-tagged · ${stats.choiceTagged} choice-tagged (before this pass)\n`;
  console.log(head + report.map(r => "  • " + r).join("\n") +
    (proposals.length ? `\n  — ${proposals.length} heuristic proposal(s) (NOT applied — redline into CURATED):\n` +
      proposals.map(p => "  " + p).join("\n") : "\n  — no heuristic proposals"));

  if (DRY_RUN) return ui.notifications.info(`Political tags DRY RUN: ${changes} change(s), ${proposals.length} proposal(s) (see console).`);
  if (!changes) return ui.notifications.info("Political tags: nothing to do — already groomed.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-poltags-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Political tags APPLIED: ${changes} change(s). Fire a tagged beat and watch for the 🗳️ card.`);
})();
