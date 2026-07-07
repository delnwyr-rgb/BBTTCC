/* seed-ag-placements.macro.js — placements + speaker fix-up for Allesh-Gilliam (2026-07-06)
 *
 * Live-world verification (2026-07-06) found actor names drifted from the design
 * doc — "Marshal Yarrow Pike", "Drax Caulder", "Rowan-of-the-Loam", '"Doc"Vess
 * Greeley' — so exact-match speaker resolution silently missed them. This macro
 * uses PUNCTUATION-PROOF matching (lowercase, strip all non-alphanumerics) and:
 *
 *  1. WIRES missed speakers (fill-if-empty): Pike → AG hub + east-wall outcomes +
 *     his closure beat · Rowan → lyrenn_hex_settles · Drax → khezek_hex_settles ·
 *     Mara → fixit_hex_settles · Gloomgill → the 4 exam terminals (skipped+logged
 *     until his actor exists).
 *  2. STAMPS Greeley's persona (missed by seed-ag-personas for the same reason).
 *  3. WRITES campaign.npcPlacements (additive; existing actor entries untouched):
 *     Pike→HQ interior · Tamsin→St Gilliam's interior · Etta→Long Market ·
 *     Greeley→Waiting Room interior · Verna→Vacancy interior · Plumb→his tower ·
 *     Brakk→the Muster ONLY while the militia quest is active (no default — the
 *     Muster stands empty until the militia is founded, then she's just THERE).
 *
 * DRY_RUN default true; idempotent; backup before write. Placements spawn at
 * scene center — hand-place tokens where you like afterward; reconcile never
 * moves placed tokens. Run AFTER seed-confessors-debt if you want that quest's
 * beats wired in the same pass (they self-wire — Tamsin's name matches exactly).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MAL = "bbttcc-mal-voice";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const SCENES = {
    hq: "rdk4TCF6WBaFSBj9",           // allesh_gilliam_hq_interior
    stGilliams: "eqRX8ZchmUMW5ED9",   // allesh_gilliam_st_gilliams_interior
    longMarket: "qPz6nuLY0No3XD3e",   // allesh_gilliam_the_long_market
    waitingRoom: "WchFqHWIovECCDxO",  // the_waiting_room_interior
    vacancy: "5hxWnWm1sawwC3Ch",      // the_vacancy_interior
    plumbTower: "gYuClWDbCpP4RR79",   // plumbs_tower
    muster: "SisPLxE9OQBY4H4E"        // the_muster
  };
  const Q = { militia: "quest_ag_town_militia" };

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const A = {
    pike:    findActor(["Marshal Yarrow Pike", "Marshall Yarrow Pike", "Yarrow Pike", "Marshall Yarrow"]),
    tamsin:  findActor(["Father Tamsin", "Tamsin"]),
    etta:    findActor(["Etta Bloom"]),
    greeley: findActor(["Doc Vess Greeley", '"Doc"Vess Greeley', "Vess Greeley", "Doc Greeley"]),
    verna:   findActor(["Verna Tulliver"]),
    plumb:   findActor(["Aldous Plumb"]),
    brakk:   findActor(["Ondine Brakk", "Captain Ondine Brakk"]),
    mara:    findActor(["Mara Quickhands"]),
    rowan:   findActor(["Rowan of the Loam", "Rowan-of-the-Loam", "Rowan"]),
    drax:    findActor(["Drax Calder", "Drax Caulder", "Foreman Calder"]),
    gloomgill: findActor(["Gloomgill", "He That Was Oannes", "Oannes"])
  };

  // beatId -> speaker key (fill-if-empty)
  const SPEAKER_FIX = {
    allesh_gilliam_introduction_to_hq: "pike",
    allesh_gilliam_east_wall_success: "pike",
    allesh_gilliam_east_wall_failure: "pike",
    allesh_gilliam_pike_closure: "pike",
    lyrenn_hex_settles: "rowan",
    khezek_hex_settles: "drax",
    fixit_hex_settles: "mara",
    gloomgill_passed: "gloomgill",
    gloomgill_failed: "gloomgill",
    gloomgill_fought: "gloomgill",
    gloomgill_fled: "gloomgill"
  };

  const GREELEY_MARKER = "[AG-TREATMENT-2026-07-04]";
  const GREELEY_TOPICS = "The Waiting Room, Allesh-Gilliam, Father Tamsin, the Night the Mountain Coughed, St Gilliam's, the Long Market, Marshal Yarrow Pike";
  const GREELEY_TRUTH = `${GREELEY_MARKER} PRIVATE TRUTH — Vess Greeley. Voice: dry, precise, warm underneath like a heat lamp you can't see. Bar patter is triage — she sorts everyone who walks in by how much trouble they're carrying, and pours accordingly. SECRET: the night the Mountain Coughed she finished a stitch in the dark and the patient lived — but she had already CHOSEN, in the dark, who she'd have let go if it came to two. The patient was Father Tamsin's brother. Tamsin knows what she almost chose. She knows he once withheld mercy outright. Neither will EVER say it; if pressed about Tamsin she deflects with professional courtesy and changes the drink. The back room ("the good room") is kept surgical-clean because she still expects the bad night to come back for a rematch — do not joke in there, and she will eject anyone who does, politely, once. STAGING: never leaves the bar during conversation; the bar comes to her. Rumors she deals out one at a time, best material last, and she always names her source's reliability like a diagnosis ("that one's a sprain, not a break").`;

  // placements: actor key -> rules (first match wins; empty when = default)
  const PLACEMENTS = [
    { key: "pike",    rules: [{ when: [], sceneId: SCENES.hq }] },
    { key: "tamsin",  rules: [{ when: [], sceneId: SCENES.stGilliams }] },
    { key: "etta",    rules: [{ when: [], sceneId: SCENES.longMarket }] },
    { key: "greeley", rules: [{ when: [], sceneId: SCENES.waitingRoom }] },
    { key: "verna",   rules: [{ when: [], sceneId: SCENES.vacancy }] },
    { key: "plumb",   rules: [{ when: [], sceneId: SCENES.plumbTower }] },
    { key: "brakk",   rules: [{ when: [{ questBucket: Q.militia, is: "active" }], sceneId: SCENES.muster }] }
  ];

  // ── load + apply ─────────────────────────────────────────────────────────────
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  for (const k of Object.keys(A))
    report.push(A[k] ? `👤 ${k} → "${A[k].name}" (${A[k].id})` : `⚠ ${k} NOT FOUND (skipped where referenced)`);

  // 1. speaker fix-up
  for (const [beatId, key] of Object.entries(SPEAKER_FIX)) {
    const b = byId.get(beatId);
    if (!b) { report.push(`✗ MISSING BEAT ${beatId}`); continue; }
    if (b.speakerActorId) { report.push(`· ok (already) speaker @ ${beatId}`); continue; }
    if (!A[key]) { report.push(`⚠ no actor for '${key}' — ${beatId} stays unwired`); continue; }
    b.speakerActorId = A[key].id; changes++; report.push(`👤 speaker ${A[key].name} @ ${beatId}`);
  }

  // 2. Greeley persona
  if (A.greeley) {
    const cur = A.greeley.getFlag(MAL, "persona") || {};
    if (String(cur.notes || "").includes(GREELEY_MARKER)) report.push(`· ok (already) persona on ${A.greeley.name}`);
    else {
      const topics = [String(cur.topics || "").trim(), GREELEY_TOPICS].filter(Boolean).join(", ");
      const notes = [String(cur.notes || "").trim(), GREELEY_TRUTH].filter(Boolean).join("\n\n");
      report.push(`✚ persona → ${A.greeley.name}`);
      if (!DRY_RUN) await A.greeley.setFlag(MAL, "persona", { topics, notes });
      changes++;
    }
  }

  // 3. placements (additive; skip actors already managed)
  camp.npcPlacements = Array.isArray(camp.npcPlacements) ? camp.npcPlacements : [];
  const managed = new Set(camp.npcPlacements.map(p => String(p.actorId || "")));
  for (const p of PLACEMENTS) {
    const actor = A[p.key];
    if (!actor) { report.push(`⚠ placement skipped — no actor for '${p.key}'`); continue; }
    if (managed.has(actor.id)) { report.push(`· ok (already managed) ${actor.name}`); continue; }
    camp.npcPlacements.push({ actorId: actor.id, rules: p.rules });
    changes++; report.push(`📍 placement ${actor.name} → ${p.rules.map(r => r.sceneId + (r.when?.length ? " (gated)" : " (default)")).join(", ")}`);
  }

  console.log(`[seed-ag-placements] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ campaigns: camps }, null, 2), "application/json", `ag-placements-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  try { await game.bbttcc?.api?.campaign?.placements?.reconcile?.(); } catch (_e) {}
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded. View each interior once (canvasReady reconciles) or tokens appear on next beat resolution.`);
})();
