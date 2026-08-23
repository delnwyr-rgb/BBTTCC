/**
 * patch-skill-scene-dcs.macro.js — GM macro/console. DRY_RUN default true.
 *
 * Implements the owner's skill-scene rulings (2026-08-22, from The Skill-Scene
 * Ledger review):
 *  · Maneuver Vault "gm" checks → real skills (Occult / Athletics) at DC 17.
 *  · The eleven DC-0 checks → DC 14–16 (Vault "Leave" navigation un-gated).
 *  · Blank-stat checks → Culture OP (Bijou) and Soft Power (statue vigil).
 *  · Khezek-Tor rite choices → the `ritual` skill (finally in play), DC 14.
 *  · FAILURE BEATS for every stakes-free check — twelve new beats, with
 *    `meditation` / `ritual` recovery checks woven in.
 *  · Broken Bridge "Convince the bridge" gets its missing success route.
 *
 * Pattern per seed-geburah-confer: backup download before write, idempotent,
 * GM only. Character stats roll through the fourththing adapter (2d10×10 +
 * faculty + rank); op.* rolls 1d20 + bank OP + roster OP.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  /** Patch one choice by beat id + index, guarded by a label fragment. */
  function patchChoice(beatId, idx, labelFrag, patch) {
    const b = byId.get(beatId);
    if (!b) { report.push(`✗ missing beat ${beatId}`); return; }
    const c = (b.choices || [])[idx];
    if (!c || !String(c.label || "").includes(labelFrag)) {
      report.push(`✗ ${beatId}[${idx}] label mismatch (wanted "${labelFrag}", got "${c?.label ?? "—"}")`);
      return;
    }
    const before = { stat: c.checkStat, dc: c.checkDC, fail: c.failNext, next: c.next };
    let touched = false;
    for (const [k, v] of Object.entries(patch)) {
      if (c[k] !== v) { c[k] = v; touched = true; }
    }
    if (touched) { changes++; report.push(`· ${beatId}[${idx}] "${labelFrag}" ${JSON.stringify(before)} → ${JSON.stringify(patch)}`); }
    else report.push(`· ok (already) ${beatId}[${idx}]`);
  }

  function addBeat(nb) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); return; }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++;
    report.push(`✚ beat ${nb.id}`);
  }
  const mk = (id, questId, type, label, description, choices) =>
    ({ id, questId, type, label, description, choices, tags: ["seeded-failure-2026-08-22"] });

  /* ── 1. Maneuver Vault — gm → Occult / Athletics @ DC 17 (fails already wired) ── */
  patchChoice("maneuver_vault_echo_archive", 0, "Arcana",      { checkStat: "occult",    checkDC: 17 });
  patchChoice("maneuver_vault_echo_archive", 1, "History",     { checkStat: "occult",    checkDC: 17 });
  patchChoice("maneuver_vault_echo_archive", 2, "Insight",     { checkStat: "occult",    checkDC: 17 });
  patchChoice("maneuver_vault_echo_archive", 3, "Leave",       { checkStat: "",          checkDC: 0  });
  patchChoice("maneuver_vault_slippage_chamber", 0, "Athletics",   { checkStat: "athletics", checkDC: 17 });
  patchChoice("maneuver_vault_slippage_chamber", 1, "Survival",    { checkStat: "athletics", checkDC: 17 });
  patchChoice("maneuver_vault_slippage_chamber", 2, "Arcana",      { checkStat: "occult",    checkDC: 17 });
  patchChoice("maneuver_vault_slippage_chamber", 3, "Performance", { checkStat: "athletics", checkDC: 17 });

  /* ── 2. DC-0 checks → 14–16 (fails already exist where noted) ── */
  patchChoice("fixit_gullywasher_interior_convo", 2, "3. Chat", { checkDC: 14 });
  patchChoice("fixit_gullywasher_interior_convo", 3, "4. Chat", { checkDC: 14 });
  patchChoice("forest_of_tifaret_leave", 2, "Diplomacy", { checkDC: 14 });
  patchChoice("fixit_leyline_stabilizer_negotiation", 1, "Shared Oversight",
    { checkStat: "op.diplomacy", checkDC: 14, failNext: "fixit_leyline_stabilizer_delay" });

  /* ── 3. Blank stats → Culture OP / Soft Power (fails already exist) ── */
  patchChoice("gilbert_theater_parley", 1, "Appeal to culture", { checkStat: "op.cult", checkDC: 14 });
  patchChoice("spark_geburah_mountains_o", 0, "Offer protection", { checkStat: "op.softpower", checkDC: 14 });

  /* ── 4. Ritual enters play — Khezek-Tor rites become `ritual` checks ── */
  patchChoice("khezek_tor_darkness_shipment", 1, "Rite",
    { checkStat: "ritual", checkDC: 14, failNext: "khezek_tor_shipment_fail" });
  patchChoice("khezek_tor_the_vaulhaulan_seal", 1, "Redirect",
    { checkStat: "ritual", checkDC: 14, failNext: "khezek_tor_seal_fail" });

  /* ── 5. Failure wiring for the stakes-free checks ── */
  patchChoice("lyrenn_seed_vault", 0, "Inspect the seeds", { failNext: "lyrenn_seed_vault_fail_reading" });
  patchChoice("lyrenn_seed_vault", 1, "Inspect the seeds", { failNext: "lyrenn_seed_vault_fail_reading" });
  patchChoice("lyrenn_the_gentle_pest_teach", 0, "Leave", { failNext: "lyrenn_gentle_pest_teach_fail" });
  patchChoice("khezek_tor_darkness_shipment", 0, "Standardize", { failNext: "khezek_tor_shipment_fail" });
  patchChoice("khezek_tor_the_vaulhaulan_seal", 0, "Restore the seal", { failNext: "khezek_tor_seal_fail" });
  patchChoice("khezek_tor_the_vaulhaulan_seal", 2, "Break the seal", { failNext: "khezek_tor_seal_fail" });
  patchChoice("fixit_leyline_stabilizer_negotiation", 0, "Trade", { failNext: "fixit_leyline_trade_fail" });
  patchChoice("enc_broken_bridge", 1, "Wade on through", { failNext: "enc_broken_bridge_wade_fail" });
  patchChoice("enc_broken_bridge", 2, "Convince the bridge",
    { next: "enc_broken_bridge_wade_success", failNext: "enc_broken_bridge_go_around_fail" });
  patchChoice("spark_geburah_northreach_b", 1, "Challenge the statue",
    { checkDC: 16, failNext: "spark_geburah_northreach_b_challenge_fail" });
  patchChoice("spark_geburah_mountains_q", 1, "Break the basin",
    { checkDC: 16, failNext: "spark_geburah_mountains_q_challenge_fail" });
  patchChoice("spark_geburah_mountains_o", 1, "Take the fragment",
    { checkDC: 16, failNext: "spark_geburah_mountains_o_challenge_fail" });
  patchChoice("hod_flooded_probably_beaumont", 1, "Ride the surge",
    { checkDC: 14, failNext: "hod_flooded_probably_beaumont_ride_fail" });
  patchChoice("hod_flooded_maybe_beaumont", 1, "Push through",
    { checkDC: 14, failNext: "hod_flooded_maybe_beaumont_ride_fail" });
  patchChoice("hod_flooded_bedlam_barrens", 1, "Break the pattern",
    { checkDC: 16, failNext: "hod_flooded_bedlam_barrens_break_fail" });

  /* ── 6. The twelve failure beats ── */
  addBeat(mk("lyrenn_seed_vault_fail_reading", "quest_JqCdOo0l6X8K2EcE", "skill_scene",
    "Lyrenn - Seed Vault - The Script Slides Away",
    "The seed-script refuses to hold still — every glyph you fix your eye on politely becomes a different glyph. The vault is not hostile. It simply does not believe you are ready to read it, and the longer you push, the more certain it becomes.",
    [
      { label: "Steady your mind and look again", description: "Stop reading. Breathe until the glyphs stop performing for you.", checkStat: "meditation", checkDC: 14, next: "lyrenn_seed_vault", failNext: "lyrenn_main_scene" },
      { label: "Withdraw with your notes", description: "Some pages want a second visit.", next: "lyrenn_main_scene" }
    ]));

  addBeat(mk("lyrenn_gentle_pest_teach_fail", "quest_uMKbX648SllKTpEH", "skill_scene",
    "Lyrenn - The Lesson Doesn't Land",
    "Your student nods along, and you can see the exact moment the nod becomes politeness instead of understanding. The technique will be misremembered by supper and folklore by winter. Lyrenn will manage — Lyrenn always manages — but this particular kindness leaves half-taught.",
    [
      { label: "Leave it be", description: "A half-lesson is still a seed.", next: "lyrenn_main_scene" }
    ]));

  addBeat(mk("khezek_tor_shipment_fail", "quest_2Gs2dsKhv7G1OYBl", "skill_scene",
    "Khezek-Tor - The Crate Disagrees",
    "The Utter Darkness does not stay standardized. It seeps through the manifest categories like ink through cheap paper, and two dockhands are now speaking in a language neither of them knows. The shipment is intact — barely — but it has opinions now.",
    [
      { label: "Contain it with a steadier rite", description: "Chalk, cadence, and the correct order of names.", checkStat: "ritual", checkDC: 14, next: "khezek_tor_darkness_shipment_rite", failNext: "khezek_tor_darkness_shipment" },
      { label: "Seal the crate and step away", description: "Let it be tomorrow's problem, formally.", next: "khezek_tor_darkness_shipment_ignore" }
    ]));

  addBeat(mk("khezek_tor_seal_fail", "quest_AL1aIXiljxPUBH2e", "skill_scene",
    "Khezek-Tor - The Seal Flares",
    "The Valhaulan seal answers your touch with a flare of old authority — a full second of someone else's certainty pressed against yours. When your vision clears, the seal is unchanged and faintly smug, and your hands remember heat that never happened.",
    [
      { label: "Center yourself and read it properly", description: "The seal rewards patience. It has had a great deal of practice.", checkStat: "meditation", checkDC: 14, next: "khezek_tor_the_vaulhaulan_seal", failNext: "khezek_tor_quest_scene" },
      { label: "Withdraw", description: "It has waited centuries. It can wait for you.", next: "khezek_tor_quest_scene" }
    ]));

  addBeat(mk("fixit_leyline_trade_fail", "quest_bSwOIWzxqNBwJ5NM", "dialog",
    "Furrier's Fixit Farm - The Price Goes Up",
    "You watched the wrong detail and named the wrong number, and the negotiation cools by exactly four degrees of neighborliness. Nothing is broken — this is still the Fixit Farm — but the stabilizer will not change hands on today's terms.",
    [
      { label: "Fall back to shared oversight", description: "Half a machine on good terms beats a whole machine on bad ones.", checkStat: "op.diplomacy", checkDC: 14, next: "fixit_leyline_stabilizer_shared_oversight_success", failNext: "fixit_leyline_stabilizer_delay" },
      { label: "Let it rest for today", next: "fixit_leyline_stabilizer_delay" }
    ]));

  addBeat(mk("enc_broken_bridge_wade_fail", "quest_travel_encounters", "skill_scene",
    "Broken Bridge - The River Wins",
    "The riverbed is not where the river said it was. Gear goes under, a crate goes downstream, and the crossing spits your column back onto the same bank it started from — wetter, later, and short one afternoon of daylight.",
    [
      { label: "Regroup and reconsider the crossing", description: "The bridge, still broken, declines to comment.", next: "enc_broken_bridge" }
    ]));

  const statueFail = (id, questId, back) => mk(id, questId, "skill_scene",
    "Lost Stone Statue - The Statue Does Not Move",
    "You put your strength against it and the statue simply continues — not resisting, continuing, the way a mountain continues. Somewhere in the stone, something files your attempt under the correct heading and goes back to waiting. You are the one breathing hard.",
    [
      { label: "Step back and take its measure again", next: back }
    ]);
  addBeat(statueFail("spark_geburah_northreach_b_challenge_fail", "quest_jivVj3iGErW53Wxl", "spark_geburah_northreach_b"));
  addBeat(statueFail("spark_geburah_mountains_q_challenge_fail",  "quest_jivVj3iGErW53Wxl", "spark_geburah_mountains_q"));
  addBeat(statueFail("spark_geburah_mountains_o_challenge_fail",  "quest_jivVj3iGErW53Wxl", "spark_geburah_mountains_o"));

  const rideFail = (id, back, target, flavor) => mk(id, "quest_dYfmXsGFyVseveWY", "skill_scene",
    "Hex-Flooded Town - The Surge Throws You",
    flavor,
    [
      { label: "Find the rhythm and go again", description: "The pattern repeats. That is the one mercy of patterns.", checkStat: "meditation", checkDC: 14, next: target, failNext: back },
      { label: "Pull out of the flow", next: back }
    ]);
  addBeat(rideFail("hod_flooded_probably_beaumont_ride_fail", "hod_flooded_probably_beaumont", "hod_flooded_probably_beaumont_surge",
    "The leyflow bucks and you come up forty feet from where you went under, holding data that is mostly about you. The town that is probably Beaumont ripples on, unharvested."));
  addBeat(rideFail("hod_flooded_maybe_beaumont_ride_fail", "hod_flooded_maybe_beaumont", "hod_flooded_maybe_beaumont_escalate",
    "The imposed logic notices you documenting it and, with bureaucratic malice, assigns you a role in it. It takes a hard minute to remember which of your names is real. The town that might be Beaumont continues without you."));
  addBeat(rideFail("hod_flooded_bedlam_barrens_break_fail", "hod_flooded_bedlam_barrens", "hod_flooded_bedlam_barrens_break",
    "The pattern refuses to break cleanly — it bends, takes your force into itself, and hands it back as noise. The Barrens hum a fraction louder, and you would swear the hum has your accent now."));

  /* ── report + write ── */
  console.log(`[patch-skill-scene-dcs] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Skill-scene DC patch DRY RUN: ${changes} change(s) (see console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-skill-scene-dcs-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Skill-scene DC patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();
