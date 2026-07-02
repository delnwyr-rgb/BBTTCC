/* ============================================================================
 * Bad Eden — SEED: The Valhaulan Spine  (GM macro)
 * ----------------------------------------------------------------------------
 * Wires the ALREADY-AUTHORED Valhaulan arc (Khezek-Tor Seal -> coastal clue
 * trail -> Maneuver Vault -> Thatwards Ho! Finale raid) into the Story
 * Director as storyChain "valhaulan_spine", with the owner-locked leveling
 * ladder riding the milestones (arc closes at steward L6 / faction T2).
 *
 * Three kinds of writes, all to the campaigns setting, all ADDITIVE:
 *   A. questEffects GRAFTS onto existing terminal beats (their questEffects
 *      arrays are empty today — nothing ever completes the stage quests).
 *      Skip-path safe: each trail hop's NEXT intro also completes its
 *      predecessor (intros link directly to next intros; completion is
 *      idempotent and creates-in-completed if never accepted).
 *   B. levelEffects on the 4 raid outcome beats: stewardLevelFloor 6,
 *      factionTierFloor 2 — the arc capstone lands immediately.
 *   C. 5 NEW director bridge beats (storyChain valhaulan_spine) — the
 *      connective tissue: milestone + diegetic hook to the next stage, fired
 *      by the Phase-3 turn tick with GM veto. levelEffects L2-L5 + T1 ride
 *      these so the Level-Up card arrives AS a story event.
 *
 * DRY_RUN = true -> preview only. Idempotent: skips existing bridge ids and
 * already-present questEffects rows (matched on action+questId). Downloads a
 * FULL campaigns-setting backup BEFORE writing (aborts if backup fails).
 * Run in the live Bad Eden world (Ember) as GM.
 * Spec: ~/badeden-bible/new-content/valhaulan-spine-wiring.md
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", KEY = "campaigns";
  const CAMPAIGN_ID = "l4PTkyhdfGBQXkOj";   // "Thatward's Ho!"

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // Quest ids (live registry — all already exist; acceptance beats already wired)
  const Q_SEAL     = "quest_AL1aIXiljxPUBH2e";  // Khezek-Tor: The Valhaulan Seal
  const Q_CHAPEL   = "quest_pI4LaZTvh9QmuRaE";  // The Rotating Chapel
  const Q_FLATS    = "quest_x8T2VkPUjhvp2vDM";  // The Burnt Flats
  const Q_MIRE     = "quest_ZTiNTjhJGtRz7iDu";  // The Singing Mire (trail)
  const Q_ANCHOR   = "quest_OpvVkGwzBTM2Px13";  // Anchor Reach
  const Q_KUDZU    = "quest_J4NXb6xZ9M15EesB";  // Port Kudzu
  const Q_LEGANSUS = "quest_xBw8cGSC88wX2UeT";  // Legansus Waystation
  const Q_MALL     = "quest_7V8Shz2S0EtDaHSS";  // The Crown Mall
  const Q_VAULT    = "quest_NwiADv8ZDoklqwEJ";  // The Maneuver Vault (Pip)
  const Q_FINALE   = "quest_thatwards_ho_finale";

  const done = (questId, text) => ({ action: "complete", questId, state: "completed", text });

  // ── A. questEffects grafts: [hostBeatId, rows[]] ───────────────────────────
  const GRAFTS = [
    // Stage 1 — the Seal (three resolutions; note "vaulhaulan" spelling is canon in these ids)
    ["khezek_tor_the_vaulhaulan_seal_restore",  [done(Q_SEAL, "Seal restored — Khezek-Tor keeps the burden.")]],
    ["khezek_tor_the_vaulhaulan_seal_redirect", [done(Q_SEAL, "Seal redirected — you chose who pays.")]],
    ["khezek_tor_the_vaulhaulan_seal_break",    [done(Q_SEAL, "Seal broken.")]],
    // Stage 2 — the coastal triangle (outcome beats + skip-path safety on next intros)
    ["map_rotating_chapel_map",        [done(Q_CHAPEL, "The chapel's alignments sketched.")]],
    ["map_rotating_chapel_force",      [done(Q_CHAPEL, "The chapel forced; a bearing recovered.")]],
    ["map_rotating_chapel_harmonize",  [done(Q_CHAPEL, "The chapel witnessed; the bearing held.")]],
    ["map_burnt_flats_intro",          [done(Q_CHAPEL, "The trail moved on to the Burnt Flats.")]],
    ["map_burnt_flats_pattern",        [done(Q_FLATS, "The discharge pattern read.")]],
    ["map_burnt_flats_partial",        [done(Q_FLATS, "A partial read of the flats.")]],
    ["map_singing_mire_intro",         [done(Q_FLATS, "The trail moved on to the Singing Mire.")]],
    ["map_singing_mire_truth",         [done(Q_MIRE, "The mire's harmonic answered true.")]],
    ["map_singing_mire_counter",       [done(Q_MIRE, "The mire countered; the note still carried.")]],
    ["map_singing_mire_partial",       [done(Q_MIRE, "A partial read of the mire.")]],
    ["map_anchor_reach_intro",         [done(Q_MIRE, "The trail moved on to Anchor Reach.")]],
    ["map_anchor_reach_stabilize",     [done(Q_ANCHOR, "The anchor stabilized; the triangle closed.")]],
    ["map_anchor_reach_break",         [done(Q_ANCHOR, "The anchor broken; the triangle closed anyway.")]],
    ["map_port_kudzu_intro",           [done(Q_ANCHOR, "The heading carried to Port Kudzu.")]],
    // Stage 3 — corroboration
    ["map_port_kudzu_testimony",       [done(Q_KUDZU, "Harbor testimony gathered.")]],
    ["map_port_kudzu_partial",         [done(Q_KUDZU, "Partial testimony gathered.")]],
    ["map_legansus_waystation_intro",  [done(Q_KUDZU, "The trail moved on to Legansus Waystation.")]],
    ["map_legansus_waystation_verified", [done(Q_LEGANSUS, "The waystation verified the manifests.")]],
    ["map_legansus_waystation_flagged",  [done(Q_LEGANSUS, "The waystation flagged the manifests.")]],
    ["map_crown_mall_intro",           [done(Q_KUDZU, "The trail reached the Crown Mall."), done(Q_LEGANSUS, "The trail reached the Crown Mall.")]],
    ["map_crown_mall_corroboration",   [done(Q_MALL, "The archives corroborate: the bunker is real.")]],
    ["map_crown_mall_partial",         [done(Q_MALL, "Enough corroboration: the bunker is real.")]],
    // Stage 4 — the Maneuver Vault (Pip)
    ["maneuver_vault_pip_shaken",  [done(Q_VAULT, "Pip pulled out, shaken.")]],
    ["maneuver_vault_pip_changed", [done(Q_VAULT, "Pip pulled out — changed.")]],
    ["maneuver_vault_pip_absored", [done(Q_VAULT, "Pip stayed too long in the Loop.")]],
    // Stage 5 — the finale raid (any outcome closes the arc)
    ["raid_thatwards_outcome_friends",       [done(Q_FINALE, "The Valhaulans deal with you as people worth calling back.")]],
    ["raid_thatwards_outcome_neutral_spark", [done(Q_FINALE, "Clean exit, dirty truth — the Spark secured.")]],
    ["raid_thatwards_outcome_neutral_fail",  [done(Q_FINALE, "Not today. The arc closes; the sky remembers.")]],
    ["raid_thatwards_outcome_hostile_fail",  [done(Q_FINALE, "You will see them again.")]]
  ];

  // ── B. levelEffects on the raid outcomes (arc capstone: L6 / faction T2) ───
  const LEVEL_GRAFTS = {
    raid_thatwards_outcome_friends:       { stewardLevelFloor: 6, factionTierFloor: 2 },
    raid_thatwards_outcome_neutral_spark: { stewardLevelFloor: 6, factionTierFloor: 2 },
    raid_thatwards_outcome_neutral_fail:  { stewardLevelFloor: 6, factionTierFloor: 2 },
    raid_thatwards_outcome_hostile_fail:  { stewardLevelFloor: 6, factionTierFloor: 2 }
  };

  // ── C. Director bridge beats (NEW; storyChain valhaulan_spine) ─────────────
  const bridge = (id, label, description, { requires, priority = "high", levelEffects = null }) => ({
    id, label,
    type: "dialog",
    timeScale: "scene",
    tags: "valhaulan_spine story",
    politicalTags: "",
    description,
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: false, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires
    },
    actors: [],
    choices: [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    storyChain: "valhaulan_spine",
    priority,
    ...(levelEffects ? { worldEffects: { levelEffects } } : {})
  });

  const NEW_BEATS = [
    bridge("vs_overture", "Someone Else's Handwriting",
      "Word filters in from Khezek-Tor with the evening ore tallies: the old sealed shaft has new handwriting. Knotwork sigils, carved fresh and confident, the way you'd sign a receipt for something you intend to keep. Overseer Calder's crews won't work the adjacent gallery — not scared, they insist, just polite. The seal doesn't look like it's holding something in. It looks like it's pointed somewhere.",
      { requires: { flag: "turn", gte: 2 }, priority: "background" }),

    bridge("vs_bridge_seal", "The Seal Was a Signature",
      "However you left the shaft, one fact came out with you: the seal never bound inward. It pointed OUT — a pipe, a siphon, a decision about where somebody else's debt should land. And whoever carved it signed their work the way you sign something you're proud of. Travelers on the coastward roads talk about a chapel that turns to face things nobody else can see. It might be worth learning what it's been looking at.",
      { requires: { questBucket: Q_SEAL, is: "completed" }, levelEffects: { stewardLevelFloor: 2 } }),

    bridge("vs_bridge_triangle", "Three Points Make a Heading",
      "Chapel, flats, mire, anchor: four stations, one geometry. Lay the sightings over one another and the shaking stops — everything agrees on a single line, coastward, ending at a stretch of nothing that gets visited far too regularly to be nothing. Somebody is running supply out there, steady as a heartbeat. Supply means harbors. Harbors mean Port Kudzu, where nothing arrives without at least three people lying about it.",
      { requires: { questBucket: Q_ANCHOR, is: "completed" }, levelEffects: { stewardLevelFloor: 3 } }),

    bridge("vs_bridge_corroboration", "Everyone Saw Something",
      "Harbor testimony, waystation ledgers, a mall's worth of archived gossip — they disagree about everything except the part that matters. There is a bunker out there. Pre-Shattering. Crewed by loud, cheerful people whose airships always land sideways, and provisioned far too well and far too regularly for free spirits. Meanwhile, Patter is wearing a groove into the Fixit Farm floorboards: Pip went out to that newly found Vault and didn't come back. He always comes back. Always.",
      { requires: { questBucket: Q_MALL, is: "completed" }, levelEffects: { stewardLevelFloor: 4 } }),

    bridge("vs_bridge_muster", "The Sky Is Waiting",
      "It holds together now, all of it: the seal that pointed outward, the heading, the manifests, and the ledger of a mine that got hurt so somewhere else wouldn't. The Valhaulans are sitting on a pre-Shattering Containment Sink with a Yesodic Spark inside, reorienting other people's debt on Monodynamic's quiet coin — and they may not even know whose hand is on their tiller. So: muster the coalition. Count your Operations. Ask the Circuit Riders if they feel like riding along. The bunker isn't hidden — they orbit it. You aren't sneaking into a facility. You're crashing a court.",
      { requires: [ { questBucket: Q_MALL, is: "completed" }, { questBucket: Q_VAULT, is: "completed" } ],
        levelEffects: { stewardLevelFloor: 5, factionTierFloor: 1 } })
  ];

  // ── Load, locate, plan ──────────────────────────────────────────────────────
  let raw = game.settings.get(NS, KEY);
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object") return ui.notifications.error("No campaigns setting found.");
  const campaign = Array.isArray(data) ? null : (data[CAMPAIGN_ID] || Object.values(data).find(c => c?.id === CAMPAIGN_ID));
  if (!campaign || !Array.isArray(campaign.beats))
    return ui.notifications.error("Could not locate campaign " + CAMPAIGN_ID + " / beats[].");

  const byId = new Map(campaign.beats.map(b => [b?.id, b]));
  const plan = { grafts: [], levels: [], adds: [], skips: [], missing: [] };

  for (const [beatId, rows] of GRAFTS) {
    const b = byId.get(beatId);
    if (!b) { plan.missing.push(beatId); continue; }
    b.worldEffects = b.worldEffects || {};
    const existing = Array.isArray(b.worldEffects.questEffects) ? b.worldEffects.questEffects : [];
    const fresh = rows.filter(r => !existing.some(e => String(e?.action) === r.action && String(e?.questId) === r.questId));
    if (!fresh.length) { plan.skips.push(beatId + " (questEffects present)"); continue; }
    plan.grafts.push({ beatId, rows: fresh });
  }
  for (const [beatId, fx] of Object.entries(LEVEL_GRAFTS)) {
    const b = byId.get(beatId);
    if (!b) { plan.missing.push(beatId); continue; }
    if (b.worldEffects?.levelEffects) { plan.skips.push(beatId + " (levelEffects present)"); continue; }
    plan.levels.push({ beatId, fx });
  }
  for (const nb of NEW_BEATS) {
    if (byId.has(nb.id)) { plan.skips.push(nb.id + " (bridge exists)"); continue; }
    plan.adds.push(nb);
  }

  console.group("%c[Valhaulan Spine seeder]", "font-weight:bold");
  console.log("Campaign:", campaign.label || campaign.title, "— beats:", campaign.beats.length);
  console.log("questEffects grafts (" + plan.grafts.length + "):", plan.grafts.map(g => g.beatId + " +" + g.rows.length));
  console.log("levelEffects grafts (" + plan.levels.length + "):", plan.levels.map(l => l.beatId));
  console.log("NEW bridge beats (" + plan.adds.length + "):", plan.adds.map(b => b.id));
  if (plan.skips.length) console.log("Skipped (already wired):", plan.skips);
  if (plan.missing.length) console.warn("MISSING beat ids (check before applying!):", plan.missing);
  console.groupEnd();

  const total = plan.grafts.length + plan.levels.length + plan.adds.length;
  if (!total) return ui.notifications.info("Valhaulan Spine: already fully wired — nothing to do.");
  if (plan.missing.length && !DRY_RUN)
    return ui.notifications.error("Valhaulan Spine: " + plan.missing.length + " expected beat id(s) MISSING — aborting apply. See console.");

  if (DRY_RUN) {
    ui.notifications.warn("DRY RUN — would graft " + plan.grafts.length + " questEffects + " + plan.levels.length +
      " levelEffects and add " + plan.adds.length + " bridge beats (" + campaign.beats.length + " -> " +
      (campaign.beats.length + plan.adds.length) + "). Set DRY_RUN=false to apply.");
    ChatMessage.create({ whisper: [game.user.id], content: "<b>Valhaulan Spine seeder (DRY RUN)</b><br>" +
      "questEffects grafts: " + plan.grafts.map(g => g.beatId).join(", ") + "<br>" +
      "levelEffects: " + plan.levels.map(l => l.beatId).join(", ") + "<br>" +
      "New bridge beats: " + plan.adds.map(b => b.id).join(", ") +
      (plan.missing.length ? "<br><b>⚠ MISSING ids:</b> " + plan.missing.join(", ") : "") });
    return;
  }

  // BACKUP first — never write without a restore point.
  try {
    const save = foundry.utils?.saveDataToFile ?? saveDataToFile;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    save(JSON.stringify(data, null, 2), "application/json", "campaigns-backup-" + stamp + ".json");
  } catch (e) {
    console.error(e);
    return ui.notifications.error("Backup download failed — ABORTED. No changes written.");
  }

  for (const g of plan.grafts) {
    const b = byId.get(g.beatId);
    b.worldEffects = b.worldEffects || {};
    b.worldEffects.questEffects = Array.isArray(b.worldEffects.questEffects) ? b.worldEffects.questEffects : [];
    b.worldEffects.questEffects.push(...g.rows);
  }
  for (const l of plan.levels) {
    const b = byId.get(l.beatId);
    b.worldEffects = b.worldEffects || {};
    b.worldEffects.levelEffects = l.fx;
  }
  campaign.beats.push(...plan.adds);
  await game.settings.set(NS, KEY, wasString ? JSON.stringify(data) : data);

  ui.notifications.info("Valhaulan Spine: wired. " + plan.grafts.length + " questEffects grafts, " +
    plan.levels.length + " levelEffects, " + plan.adds.length + " bridge beats (campaign now " +
    campaign.beats.length + "). Backup downloaded.");
  ChatMessage.create({ whisper: [game.user.id], content: "<b>Valhaulan Spine seeder — APPLIED ✓</b><br>" +
    "The arc is on the Director's rails: stage quests now complete themselves, bridge beats pace the story, " +
    "and the ladder lands L2/L3/L4/L5+T1 on the bridges and L6+T2 on the raid outcomes.<br>" +
    "A backup file was downloaded first." });
})();
