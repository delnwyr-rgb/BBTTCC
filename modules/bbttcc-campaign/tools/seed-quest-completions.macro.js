/* seed-quest-completions.macro.js — Category-A completion wiring + routing repairs
 * + registry hygiene (2026-07-04, campaign treatment deep dive)
 *
 * WHAT IT DOES (three sections, all logged per-row):
 *  1. COMPLETIONS — adds `complete` questEffects to existing terminal/ending beats
 *     for the quests that today can never close (wiring only — no new beats).
 *  2. ROUTES — repairs unambiguous dead choices whose targets already exist
 *     (Balcones outcome wiring, Forest force endings, Gentle Pest/Field "Leave").
 *  3. REGISTRY — deletes the dead "Singing Mire" twin, fixes the "Officed" name
 *     typo, re-buckets the mis-stamped Kickflip runback beat. The vestigial
 *     5-beat circuit_riders skeleton (quest_6EXzFP8uLTXHhzMz) is LOG-ONLY unless
 *     DELETE_VESTIGIAL=true.
 *
 * DRY_RUN default true; idempotent (skips rows already present); backs up the
 * quests + campaigns settings to a downloaded JSON before writing (aborts if
 * backup fails). Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const DELETE_VESTIGIAL = false;       // <-- circuit_riders_parley_* skeleton beats
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ---- section 1: completions (beatId -> {questId, text}) --------------------
  const COMPLETIONS = {
    // Lyrenn — The Field That Remembers You (quest_0HBaQXGlhFvNke2B)
    lyrenn_the_field_that_remembers_you_burn_the_field: { questId: "quest_0HBaQXGlhFvNke2B", text: "The field no longer remembers you. It no longer remembers anything. Great job." },
    lyrenn_the_field_that_remembers_you_harvest_the_plants: { questId: "quest_0HBaQXGlhFvNke2B", text: "Harvested. The field remembers being useful, which is the nicest thing anyone's done for it in years." },
    lyrenn_the_field_that_remembers_you_plant_speak: { questId: "quest_0HBaQXGlhFvNke2B", text: "You talked to the plants. The plants talked back. Nobody in Lyrenn finds this strange, which is itself strange." },
    // Lyrenn — The Forest Will Not Be Fought (quest_feX6WHsBXuVbtjMM)
    lyrenn_forest_will_not_be_fought_redirect: { questId: "quest_feX6WHsBXuVbtjMM", text: "Growth redirected. The forest agreed to disagree, in the direction you pointed." },
    lyrenn_forest_will_not_be_fought_negotiate: { questId: "quest_feX6WHsBXuVbtjMM", text: "Space negotiated. The treaty is verbal, binding, and enforced by roots." },
    lyrenn_forest_will_not_be_fought_force_burn: { questId: "quest_feX6WHsBXuVbtjMM", text: "You burned it. The forest will not be fought — but apparently it can be arsoned. Lyrenn remembers." },
    lyrenn_forest_will_not_be_fought_force_fight: { questId: "quest_feX6WHsBXuVbtjMM", text: "You fought a forest. Entered a land war with lumber. Results as expected. Lyrenn remembers." },
    // Lyrenn — The Gentle Pest (quest_uMKbX648SllKTpEH)
    lyrenn_the_gentle_pest_kindness: { questId: "quest_uMKbX648SllKTpEH", text: "Killed with kindness. Well — relocated with kindness. It sends letters." },
    lyrenn_the_gentle_pest_teach: { questId: "quest_uMKbX648SllKTpEH", text: "A local now knows the trick. The pest problem is officially somebody else's competence." },
    lyrenn_the_gentle_pest_violence: { questId: "quest_uMKbX648SllKTpEH", text: "Violence. Against something described, in writing, as gentle. Lyrenn remembers." },
    // Khezek Tor — The Mine that Answered Back (quest_A050y4VtoZFzOfGz)
    khezek_tor_mine_that_answered_back_seal: { questId: "quest_A050y4VtoZFzOfGz", text: "Sealed. The mine still answers, but now it's muffled, which everyone agrees to call 'solved'." },
    khezek_tor_mine_that_answered_back_exploit: { questId: "quest_A050y4VtoZFzOfGz", text: "Exploited. The mine answers back and you've put it on payroll." },
    khezek_tor_mine_that_answered_back_open: { questId: "quest_A050y4VtoZFzOfGz", text: "Opened. Whatever was answering has been given the floor." },
    // Khezek Tor — The Shipment of UTTER DARKNESS Sometimes (quest_2Gs2dsKhv7G1OYBl)
    khezek_tor_darkness_shipment_standardize: { questId: "quest_2Gs2dsKhv7G1OYBl", text: "Standardized. The UTTER DARKNESS now ships with a manifest, which somehow makes it scarier." },
    khezek_tor_darkness_shipment_rite: { questId: "quest_2Gs2dsKhv7G1OYBl", text: "The rite held. The shipment is DARKNESS, sometimes, on a schedule everyone can live with." },
    khezek_tor_darkness_shipment_ignore: { questId: "quest_2Gs2dsKhv7G1OYBl", text: "Ignored. The shipment question resolved itself, which is never how that works." },
    // The Forest of Early Tifaret (quest_2pZmPy9TEzorMoaj)
    forest_of_tifaret_aggression_ending: { questId: "quest_2pZmPy9TEzorMoaj", text: "Tifaret answered aggression in kind. The forest keeps score differently than you do." },
    forest_of_tifaret_harmonious_ending: { questId: "quest_2pZmPy9TEzorMoaj", text: "Harmony with Early Tifaret. The trees consider you provisionally acceptable." },
    forest_of_tifaret_neutral_ending: { questId: "quest_2pZmPy9TEzorMoaj", text: "You passed through Tifaret and left it as weird as you found it." },
    // The Balcones Faulting You Line (quest_8II4GEGV7D3RgzPv)
    balcones_faulting_you_appease_spirit: { questId: "quest_8II4GEGV7D3RgzPv", text: "The fault-line spirit is appeased. The ground has accepted your apology." },
    balcones_faulting_you_narrative: { questId: "quest_8II4GEGV7D3RgzPv", text: "You told the fault a better story about itself. Geology, it turns out, is susceptible to flattery." },
    balcones_faulting_you_persuasion: { questId: "quest_8II4GEGV7D3RgzPv", text: "A temp deal with a tectonic feature. The paperwork is a handshake and the ground holding still." },
    balcones_faulting_you_impose_your_will: { questId: "quest_8II4GEGV7D3RgzPv", text: "You imposed your will on a landform. It worked. File that away as a thing about you now." },
    balcones_faulting_you_build_a_bridge: { questId: "quest_8II4GEGV7D3RgzPv", text: "A sigil bridge. No, literally. The fault is spanned and faintly glowing." },
    balcones_faulting_you_line_final_fail: { questId: "quest_8II4GEGV7D3RgzPv", text: "The Faulting You Line remains faulted, and remains, pointedly, faulting you." },
    // The Hidden Vault (quest_hidden_vault)
    enc_hidden_vault_resolution_good: { questId: "quest_hidden_vault", text: "The Vault stays balanced — GenPop! and the Attendants agree you were a reasonable anomaly." },
    enc_hidden_vault_resolution_neutral: { questId: "quest_hidden_vault", text: "The Vault carries on its loop. You were a Tuesday to them." },
    enc_hidden_vault_resolution_hostile: { questId: "quest_hidden_vault", text: "The Vault remembers you the way retail remembers its worst customer. Forever." },
    gilbert_theater_resolution: { questId: "quest_hidden_vault", text: "The Gilbert matter is settled, theatrically. The Vault resumes its programming." },
    // The Mall of Forgotten Yesterdays (quest_forgotten_yesterdays)
    enc_forgotten_yesterdays_resolution_good: { questId: "quest_forgotten_yesterdays", text: "The Mall counts you as allies — your names go up on the marquee, spelled almost right." },
    enc_forgotten_yesterdays_resolution_neutral: { questId: "quest_forgotten_yesterdays", text: "The Mall stays uncommitted. Miss June keeps a tape about you, unlabeled." },
    enc_forgotten_yesterdays_resolution_bad: { questId: "quest_forgotten_yesterdays", text: "The Mall has decided you're basically cops. There is no appeals process." },
    // Circuit Rider Parley (quest_circuit_riders_parley)
    enc_circuit_riders_parley_alliance: { questId: "quest_circuit_riders_parley", text: "The Riders ride with you — when the call comes clean, they come." },
    enc_circuit_riders_parley_neutral: { questId: "quest_circuit_riders_parley", text: "The Riders neither friend nor flag you. Out here, that's a compliment." },
    enc_circuit_riders_parley_flagged: { questId: "quest_circuit_riders_parley", text: "Flagged by the Circuit Riders. Their network is faster than your apology." },
    // The Lost Stone Statues (quest_jivVj3iGErW53Wxl)
    spark_geburah_reconstituted: { questId: "quest_jivVj3iGErW53Wxl", text: "The scattered sparks gather home. The statues were never lost — they were waiting." },
    // The Hex Flooded Towns (quest_dYfmXsGFyVseveWY)
    spark_hod_echoes_reconstituting: { questId: "quest_dYfmXsGFyVseveWY", text: "The flooded towns' echoes settle. What drowned in Hod has stopped rehearsing it." },
    // Thatwards Ho! Finale — the victory-bypass fix (quest_thatwards_ho_finale)
    raid_thatwards_rewards_major: { questId: "quest_thatwards_ho_finale", text: "Thatward's Ho! The long line ends where the lying stops. Major spoils." },
    raid_thatwards_rewards_standard: { questId: "quest_thatwards_ho_finale", text: "Thatward's Ho! Done, dusted, and divvied." }
  };

  // ---- section 2: routing repairs (beatId -> [{label, next, failNext?}]) ----
  const ROUTES = {
    balcones_faulting_you_line_choices: [
      { label: "Appease the fault-line spirit", next: "balcones_faulting_you_appease_spirit", failNext: "balcones_faulting_you_appease_spirit_fail" },
      { label: "Use the power of narrative to paint a better picture", next: "balcones_faulting_you_narrative", failNext: "balcones_faulting_you_narrative_fail" },
      { label: "Strike a temp deal", next: "balcones_faulting_you_persuasion", failNext: "balcones_faulting_you_persuasion_fail" },
      { label: "Impose your will", next: "balcones_faulting_you_impose_your_will", failNext: "balcones_faulting_you_impose_your_will_fail" },
      { label: "Build a sigil bridge. No literally.", next: "balcones_faulting_you_build_a_bridge", failNext: "balcones_faulting_you_build_a_bridge_fail" }
    ],
    // opening beat carries the same duplicate menu — route it identically so a
    // click anywhere behaves; the duplicate-set design question stays open for
    // the Balcones arc treatment (double-enact risk noted in the audit).
    balcones_faulting_you_line_opening: [
      { label: "Appease the fault-line spirit", next: "balcones_faulting_you_appease_spirit", failNext: "balcones_faulting_you_appease_spirit_fail" },
      { label: "Use the power of narrative to paint a better picture", next: "balcones_faulting_you_narrative", failNext: "balcones_faulting_you_narrative_fail" },
      { label: "Strike a temp deal", next: "balcones_faulting_you_persuasion", failNext: "balcones_faulting_you_persuasion_fail" },
      { label: "Impose your will", next: "balcones_faulting_you_impose_your_will", failNext: "balcones_faulting_you_impose_your_will_fail" },
      { label: "Build a sigil bridge. No literally.", next: "balcones_faulting_you_build_a_bridge", failNext: "balcones_faulting_you_build_a_bridge_fail" }
    ],
    lyrenn_forest_will_not_be_fought_force: [
      { label: "Burn it down. Burn it ALL down.", next: "lyrenn_forest_will_not_be_fought_force_burn" },
      { label: "You against a forest. LET'S DO THIS.", next: "lyrenn_forest_will_not_be_fought_force_fight" }
    ],
    lyrenn_the_gentle_pest_teach: [
      { label: "Leave", next: "lyrenn_main_scene" }
    ],
    lyrenn_the_field_that_remembers_you_intro: [
      { label: "Leave", next: "lyrenn_main_scene" }
    ]
  };

  // ---- section 3: registry hygiene ------------------------------------------
  const DEAD_QUEST_TWIN = "quest_S2E1bogWwoybBuGU";      // "The Singing Mire" duplicate, zero beat refs
  const NAME_FIXES = { quest_ycEa0uXzTzsbK4qP: "Offices of Fates and Destinies" }; // was "Officed"
  const REBUCKET = { enc_forgotten_yesterdays_kickflip_lazarus_runback_success: "quest_forgotten_yesterdays" }; // was Maneuver Vault
  const VESTIGIAL_BEATS = [
    "circuit_riders_parley_quest_acceptance", "circuit_riders_parley_intro",
    "circuit_riders_parley_friendly_outcome", "circuit_riders_parley_neutral_outcome",
    "circuit_riders_parley_hostile_outcome"
  ]; // empty skeleton on unregistered quest_6EXzFP8uLTXHhzMz

  // ---- load settings ---------------------------------------------------------
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);

  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  // 1. completions
  for (const [beatId, { questId, text }] of Object.entries(COMPLETIONS)) {
    const b = byId.get(beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${beatId}`); continue; }
    b.worldEffects = b.worldEffects || {};
    b.worldEffects.questEffects = b.worldEffects.questEffects || [];
    const has = b.worldEffects.questEffects.some(e => e && e.questId === questId && e.action === "complete");
    if (has) { report.push(`· ok (already) complete ${beatId}`); continue; }
    b.worldEffects.questEffects.push({ action: "complete", questId, beatId: "", state: "completed", text });
    changes++; report.push(`✚ complete ${questId} @ ${beatId}`);
  }

  // 2. routes
  for (const [beatId, rows] of Object.entries(ROUTES)) {
    const b = byId.get(beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${beatId}`); continue; }
    for (const r of rows) {
      const ch = (b.choices || []).find(c => String(c.label || "").trim() === r.label);
      if (!ch) { report.push(`✗ MISSING CHOICE "${r.label}" @ ${beatId}`); continue; }
      if (!byId.get(r.next)) { report.push(`✗ ROUTE TARGET MISSING ${r.next}`); continue; }
      let did = false;
      if (!(ch.next || "").trim()) { ch.next = r.next; did = true; }
      if (r.failNext && !(ch.failNext || "").trim() && byId.get(r.failNext)) { ch.failNext = r.failNext; did = true; }
      if (did) { changes++; report.push(`⤳ route "${r.label}" → ${ch.next}${ch.failNext ? " / fail→" + ch.failNext : ""} @ ${beatId}`); }
      else report.push(`· ok (already routed) "${r.label}" @ ${beatId}`);
    }
  }

  // 3. registry hygiene
  if (quests?.[DEAD_QUEST_TWIN]) {
    const refs = (camp.beats || []).filter(b => JSON.stringify(b).includes(DEAD_QUEST_TWIN)).length;
    if (refs === 0) { delete quests[DEAD_QUEST_TWIN]; changes++; report.push(`🗑 registry: deleted dead twin ${DEAD_QUEST_TWIN} ("The Singing Mire" dup)`); }
    else report.push(`✗ SKIP twin delete — ${refs} beat(s) reference ${DEAD_QUEST_TWIN}`);
  } else report.push(`· ok (already) no dead twin`);
  for (const [qid, name] of Object.entries(NAME_FIXES)) {
    if (quests?.[qid] && quests[qid].name !== name) { quests[qid].name = name; changes++; report.push(`✎ registry: ${qid} name → "${name}"`); }
    else report.push(`· ok (already) name ${qid}`);
  }
  for (const [beatId, qid] of Object.entries(REBUCKET)) {
    const b = byId.get(beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${beatId}`); continue; }
    if (b.questId !== qid) { report.push(`↷ rebucket ${beatId}: ${b.questId} → ${qid}`); b.questId = qid; changes++; }
    else report.push(`· ok (already) bucket ${beatId}`);
  }
  const vestigial = VESTIGIAL_BEATS.filter(id => byId.has(id));
  if (vestigial.length && DELETE_VESTIGIAL) {
    camp.beats = camp.beats.filter(b => !vestigial.includes(b.id));
    changes++; report.push(`🗑 deleted ${vestigial.length} vestigial circuit_riders skeleton beats`);
  } else if (vestigial.length) {
    report.push(`⚠ LOG-ONLY: ${vestigial.length} vestigial skeleton beats on unregistered quest_6EXzFP8uLTXHhzMz (${vestigial.join(", ")}) — set DELETE_VESTIGIAL=true to remove`);
  }

  console.log(`[seed-quest-completions] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do — all rows already present.");

  // backup first (abort if it fails)
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ quests, campaigns: camps }, null, 2), "application/json", `quest-completions-backup-${stamp}.json`);
  } catch (e) {
    console.error(e);
    return ui.notifications.error("Backup failed — aborting without writing.");
  }
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded.`);
})();
