/* ============================================================================
 * Bad Eden — SEED: Forgotten-Cause spine + dialogue-driven beats  (GM macro)
 * ----------------------------------------------------------------------------
 * Makes the Forgotten-Cause arc the SECOND storyChain ("forgotten_cause") and
 * bakes in the dialogue-driven-beats contract (speakerActorId + memoryText —
 * see badeden-bible/new-content/dialogue-driven-beats-spec.md). Requires the
 * Phase-2..4 director engine + dialogue engine deployed (2026-07-02 build).
 *
 * Four kinds of writes, all to the campaigns setting, all ADDITIVE:
 *   A. SPEAKER STAMPS on existing beats: Mara embodies the Leygate-part
 *      negotiation, the Miliard test (Weeping Prisoner), and the Vault pip
 *      endings; Dougan embodies the Cultural Summit + his Confluence pointer.
 *      Hubs get inject.requires quest-gates + repeatable where the moment must
 *      stay open ("Delay" / "Not yet"); outcome beats get authored memoryText.
 *   B. questEffects GRAFTS: stabilizer deal outcomes complete the Leyline
 *      Stabilizer quest; prisoner outcomes complete the Weeping Prisoner
 *      quest (these quests become the gates of Mara's chain).
 *   C. ONE NEW dialogue beat: fc_mara_pip_summons — Mara's "find Pip" ask,
 *      offerable in conversation after the Miliard test, until the Vault
 *      quest is underway (uses the new questBucket isNot gate).
 *   D. THREE director bridge beats (storyChain "forgotten_cause") pacing the
 *      Wendigo arc: rung-2 foreshadow -> Confluence nudge -> Summit muster.
 *      NO levelEffects — the Valhaulan spine owns the arc-1 ladder.
 *
 * DRY_RUN = true -> preview only. Idempotent. Backs up the campaigns setting
 * before writing (aborts if backup fails). Run in the live world (Ember) as GM.
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", KEY = "campaigns";
  const CAMPAIGN_ID = "l4PTkyhdfGBQXkOj";   // "Thatward's Ho!"

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const MARA = "GTX6S0gtzoJ7OeSE";      // Mara Quickhands
  const DOUGAN = "7Lee6ROPnc4gWYJh";    // Dougan

  const Q_STABILIZER = "quest_bSwOIWzxqNBwJ5NM";  // Furrier's Fixit Farm - The Leyline Stabilizer
  const Q_PRISONER   = "quest_uDuNp2yQxbuKkHx7";  // Furrier's Fixit Farm - The Weeping Prisoner
  const Q_VAULT      = "quest_NwiADv8ZDoklqwEJ";  // The Maneuver Vault (Pip)
  const Q_FC1        = "fc_wendigo_confluence";   // Something a Little Off
  const Q_FC2        = "fc_cultural_summit";      // Close the Ledger

  // ── A. Speaker stamps: [beatId, fields] — each field set ONLY if absent ────
  const STAMPS = [
    // Mara's chain, step 1: the Leygate part. Repeatable — "Delay"/"No deal"
    // keep the moment open; sealing the deal completes the quest (graft below)
    // and the active-gate closes it.
    ["fixit_leyline_stabilizer_negotiation", {
      speakerActorId: MARA,
      injectRequires: { questBucket: Q_STABILIZER, is: "active" },
      injectRepeatable: true
    }],
    ["fixit_leyline_stabilizer_trade_success", { speakerActorId: MARA,
      memoryText: "Traded the replacement Leygate stabilizer part to the Stewards — a deal fairly struck, by Jackalope standards." }],
    ["fixit_leyline_stabilizer_shared_oversight_success", { speakerActorId: MARA,
      memoryText: "Handed the Stewards the Leygate part under shared oversight — Jackalope hands stay on the work, which is how it should be." }],
    ["fixit_leyline_stabilizer_hard_ask", { speakerActorId: MARA,
      memoryText: "Gave up the Leygate part when the Stewards pressed the whole region's need. Loaded it on a sledge without arguing. It sat wrong anyway." }],
    ["fixit_leyline_stabilizer_delay", { speakerActorId: MARA,
      memoryText: "The Stewards weren't ready to talk equipment for the Leygate. The offer stands whenever they are." }],
    ["fixit_leyline_stabilizer_no_deal", { speakerActorId: MARA,
      memoryText: "The Stewards walked away from the Leygate part deal. Noted, not forgotten." }],

    // Mara's chain, step 2: the Miliard test. One-shot moral moment (NOT
    // repeatable — any resolution consumes it); offerable once the part deal
    // is done.
    ["fixit_weeping_prisoner", {
      speakerActorId: MARA,
      injectRequires: { questBucket: Q_STABILIZER, is: "completed" }
    }],
    ["fixit_weeping_prisoner_justice", { speakerActorId: MARA,
      memoryText: "Watched the Stewards weigh Miliard's theft and choose justice — measured, no cruelty. Filed that away." }],
    ["fixit_weeping_prisoner_punishment", { speakerActorId: MARA,
      memoryText: "The Stewards chose punishment for Miliard. Efficient. Colder than expected." }],
    ["fixit_weeping_prisoner_mercy", { speakerActorId: MARA,
      memoryText: "The Stewards chose mercy for Miliard. Soft, maybe. Or maybe the long game. Either way — remembered." }],
    ["fixit_weeping_prisoner_not_our_problem", { speakerActorId: MARA,
      memoryText: "The Stewards called Miliard 'not our problem' and handed him back. The Jackalopes remember who shows up." }],

    // Mara remembers how the Vault search ended (whatever surface ran it).
    ["maneuver_vault_pip_shaken", { speakerActorId: MARA,
      memoryText: "The Stewards brought Pip home from the Vault — shaken but whole. That debt is real, and Mara pays her debts." }],
    ["maneuver_vault_pip_changed", { speakerActorId: MARA,
      memoryText: "The Stewards pulled Pip out of the Containment Loop. He came back... changed. Something in his chest pulsed green. Watching that." }],
    ["maneuver_vault_pip_absored", { speakerActorId: MARA,
      memoryText: "Pip stayed too long in the Loop before anyone reached him. What came back is not entirely Pip. Grieving and sharpening both." }],

    // Dougan's moments: the Summit is HIS room. Repeatable — "Not yet" keeps
    // it open; success completes fc_cultural_summit and the active-gate closes.
    ["gullywasher_cultural_summit", {
      speakerActorId: DOUGAN,
      injectRequires: { questBucket: Q_FC2, is: "active" },
      injectRepeatable: true
    }],
    ["gullywasher_cultural_summit_success", { speakerActorId: DOUGAN,
      memoryText: "Hosted the Cultural Summit at the Gullywasher. The Stewards entered the recovered cause in the Ledger and the feud finally closed. Poured a round on the house." }],
    ["gullywasher_cultural_summit_failure", { speakerActorId: DOUGAN,
      memoryText: "The Summit broke down — the Ledger's reason-column stayed empty and the grievance grew new teeth. The room remembers." }],
    ["gullywasher_dougan_points_to_confluence", { speakerActorId: DOUGAN,
      memoryText: "Told the Stewards where the forgetting lives — pointed them upstream to the Confluence, where the Wendigo keep the long table." }]
  ];

  // ── B. questEffects grafts (close the loops Mara's gates read) ─────────────
  const done = (questId, text) => ({ action: "complete", questId, state: "completed", text });
  const GRAFTS = [
    ["fixit_leyline_stabilizer_trade_success",            [done(Q_STABILIZER, "The Leygate part — traded fair.")]],
    ["fixit_leyline_stabilizer_shared_oversight_success", [done(Q_STABILIZER, "The Leygate part — shared oversight.")]],
    ["fixit_leyline_stabilizer_hard_ask",                 [done(Q_STABILIZER, "The Leygate part — taken on the hard ask.")]],
    ["fixit_weeping_prisoner_justice",        [done(Q_PRISONER, "Justice for Miliard.")]],
    ["fixit_weeping_prisoner_punishment",     [done(Q_PRISONER, "Punishment for Miliard.")]],
    ["fixit_weeping_prisoner_mercy",          [done(Q_PRISONER, "Mercy for Miliard.")]],
    ["fixit_weeping_prisoner_not_our_problem",[done(Q_PRISONER, "Miliard handed back — not our problem.")]]
  ];

  // ── C+D. New beats ──────────────────────────────────────────────────────────
  const baseBeat = (id, label, description, extra = {}) => ({
    id, label,
    type: "dialog",
    timeScale: "scene",
    tags: extra.tags ?? "forgotten_cause story",
    politicalTags: "",
    description,
    outcomes: { success: null, failure: null },
    inject: {
      cooldownTurns: 0, repeatable: !!extra.repeatable, oncePerHex: false,
      promptGM: "inherit", fallbackOnDecline: "inherit",
      allowMulti: "inherit", oncePerHexGlobal: "inherit",
      ...(extra.requires ? { requires: extra.requires } : {})
    },
    actors: [],
    choices: extra.choices ?? [{ label: "Noted.", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    refs: {},
    playerFacingDialog: true, dialogPlayerFacing: true,
    playerFacingContent: true, showToPlayers: true,
    ...(extra.storyChain ? { storyChain: extra.storyChain } : {}),
    ...(extra.priority ? { priority: extra.priority } : {}),
    ...(extra.speakerActorId ? { speakerActorId: extra.speakerActorId } : {})
  });

  const NEW_BEATS = [
    // Mara's step 3: the Pip summons — a pure DIALOGUE moment (no storyChain;
    // Mara offers it in conversation). Repeatable + isNot gates: stays open
    // until the Stewards actually commit and the Vault quest goes active.
    baseBeat("fc_mara_pip_summons", "Mara — Start Grieving or Start Sharpening",
      "Mara finds you herself, which is how you know it's bad. No preamble. Thumb not clicking, for once. \"Pip went out to that new-found Vault three days back. He always comes back. ALWAYS. Patter's wearing a groove into the floorboards.\" She looks at you the way people look at weather they can't afford. \"I don't need heroes. I need to know if I should start grieving or start sharpening.\"",
      {
        speakerActorId: MARA,
        repeatable: true,
        tags: "forgotten_cause dialogue",
        requires: [
          { questBucket: Q_PRISONER, is: "completed" },
          { questBucket: Q_VAULT, isNot: "active" },
          { questBucket: Q_VAULT, isNot: "completed" }
        ],
        choices: [
          { label: "We'll bring Pip home", next: "maneuver_vault_acceptance", description: "Commit to the search. Mara marks the Vault on your map with a steadiness that costs her something.", checkStat: "", checkDC: 0, failNext: "" },
          { label: "Not now — we can't", next: "", description: "The moment stays open. Mara nods once, files it, and does not ask twice today.", checkStat: "", checkDC: 0, failNext: "" }
        ]
      }),

    // Director bridges (storyChain forgotten_cause) — pacing, no levelEffects.
    baseBeat("fc_bridge_off", "The Shape of the Wrongness",
      "Travelers have started comparing notes without meaning to. The Wendigo along the leyline roads are polite, orderly, helpful — and every account is missing the same piece, like a page with one word inked out. Whatever is OFF about them has stopped being a feeling and started being a shape. Somebody at the Jackalope Exchange keeps a bar where roads and rumors cross; the Gullywasher would be a fine place to say the shape out loud.",
      { storyChain: "forgotten_cause", priority: "background", requires: { flag: "wendigoRung", gte: 2 } }),

    baseBeat("fc_bridge_confluence", "The Long Table Is Set",
      "Dougan's directions hold up. Upstream, where the collapsed leylines knot, there is a place the maps refuse to be casual about — a confluence where the Wendigo keep a long table with name-cards for people nobody else remembers. They are not hoarding the forgotten. They are HOLDING them. Every day you wait, the table grows a setting, and somewhere a debt loses the reason it was owed.",
      { storyChain: "forgotten_cause", priority: "high", requires: { questBucket: Q_FC1, is: "active" } }),

    baseBeat("fc_bridge_summit", "An Empty Reason-Column",
      "The cause has been carried out of the Confluence — a reason, recovered whole, for a feud that has been all interest and no principal for a generation. At the Gullywasher, Dougan is quietly setting a room: a Chupacabra at one end, a Jackalope at the other, the Ledger open between them with its reason-column blank. Rooms like that don't stay set. Ink dries. Grievances don't.",
      { storyChain: "forgotten_cause", priority: "high", requires: { questBucket: Q_FC2, is: "active" } })
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
  const plan = { stamps: [], grafts: [], adds: [], skips: [], missing: [] };

  for (const [beatId, fields] of STAMPS) {
    const b = byId.get(beatId);
    if (!b) { plan.missing.push(beatId); continue; }
    const todo = {};
    if (fields.speakerActorId && !String(b.speakerActorId || "").trim()) todo.speakerActorId = fields.speakerActorId;
    if (fields.memoryText && !String(b.memoryText || "").trim()) todo.memoryText = fields.memoryText;
    if (fields.injectRequires && !(b.inject && b.inject.requires)) todo.injectRequires = fields.injectRequires;
    if (fields.injectRepeatable != null && !(b.inject && b.inject.repeatable)) todo.injectRepeatable = fields.injectRepeatable;
    if (!Object.keys(todo).length) { plan.skips.push(beatId + " (stamps present)"); continue; }
    plan.stamps.push({ beatId, todo });
  }
  for (const [beatId, rows] of GRAFTS) {
    const b = byId.get(beatId);
    if (!b) { plan.missing.push(beatId); continue; }
    const existing = Array.isArray(b.worldEffects?.questEffects) ? b.worldEffects.questEffects : [];
    const fresh = rows.filter(r => !existing.some(e => String(e?.action) === r.action && String(e?.questId) === r.questId));
    if (!fresh.length) { plan.skips.push(beatId + " (questEffects present)"); continue; }
    plan.grafts.push({ beatId, rows: fresh });
  }
  for (const nb of NEW_BEATS) {
    if (byId.has(nb.id)) { plan.skips.push(nb.id + " (beat exists)"); continue; }
    plan.adds.push(nb);
  }

  console.group("%c[Forgotten-Cause spine seeder]", "font-weight:bold");
  console.log("Campaign:", campaign.label || campaign.title, "— beats:", campaign.beats.length);
  console.log("Speaker/memory/gate stamps (" + plan.stamps.length + "):", plan.stamps.map(s => s.beatId + " [" + Object.keys(s.todo).join(",") + "]"));
  console.log("questEffects grafts (" + plan.grafts.length + "):", plan.grafts.map(g => g.beatId));
  console.log("NEW beats (" + plan.adds.length + "):", plan.adds.map(b => b.id));
  if (plan.skips.length) console.log("Skipped (already wired):", plan.skips);
  if (plan.missing.length) console.warn("MISSING beat ids (check before applying!):", plan.missing);
  console.groupEnd();

  const total = plan.stamps.length + plan.grafts.length + plan.adds.length;
  if (!total) return ui.notifications.info("Forgotten-Cause spine: already fully wired — nothing to do.");
  if (plan.missing.length && !DRY_RUN)
    return ui.notifications.error("Forgotten-Cause spine: " + plan.missing.length + " expected beat id(s) MISSING — aborting apply. See console.");

  if (DRY_RUN) {
    ui.notifications.warn("DRY RUN — would stamp " + plan.stamps.length + " beats, graft " + plan.grafts.length +
      " questEffects, add " + plan.adds.length + " new beats (" + campaign.beats.length + " -> " +
      (campaign.beats.length + plan.adds.length) + "). Set DRY_RUN=false to apply.");
    ChatMessage.create({ whisper: [game.user.id], content: "<b>Forgotten-Cause spine seeder (DRY RUN)</b><br>" +
      "Stamps: " + plan.stamps.map(s => s.beatId).join(", ") + "<br>" +
      "Grafts: " + plan.grafts.map(g => g.beatId).join(", ") + "<br>" +
      "New beats: " + plan.adds.map(b => b.id).join(", ") +
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

  for (const s of plan.stamps) {
    const b = byId.get(s.beatId);
    if (s.todo.speakerActorId) b.speakerActorId = s.todo.speakerActorId;
    if (s.todo.memoryText) b.memoryText = s.todo.memoryText;
    if (s.todo.injectRequires || s.todo.injectRepeatable != null) {
      b.inject = b.inject || {};
      if (s.todo.injectRequires) b.inject.requires = s.todo.injectRequires;
      if (s.todo.injectRepeatable != null) b.inject.repeatable = s.todo.injectRepeatable;
    }
  }
  for (const g of plan.grafts) {
    const b = byId.get(g.beatId);
    b.worldEffects = b.worldEffects || {};
    b.worldEffects.questEffects = Array.isArray(b.worldEffects.questEffects) ? b.worldEffects.questEffects : [];
    b.worldEffects.questEffects.push(...g.rows);
  }
  campaign.beats.push(...plan.adds);
  await game.settings.set(NS, KEY, wasString ? JSON.stringify(data) : data);

  ui.notifications.info("Forgotten-Cause spine: wired. " + plan.stamps.length + " stamps, " + plan.grafts.length +
    " grafts, " + plan.adds.length + " new beats (campaign now " + campaign.beats.length + "). Backup downloaded.");
  ChatMessage.create({ whisper: [game.user.id], content: "<b>Forgotten-Cause spine seeder — APPLIED ✓</b><br>" +
    "The arc is the Director's second chain, and Mara + Dougan now EMBODY their story moments: " +
    "talk to Mara about the Leygate part, Miliard, or Pip; talk to Dougan about the Summit. " +
    "Memories will accrue on their actors as moments resolve.<br>A backup file was downloaded first." });
})();
