/* seed-npc-placements.macro.js — situational NPC placement rules (2026-07-03)
 *
 * Writes campaign.npcPlacements: per NPC, ORDERED rules (first match wins) in
 * the same gate vocabulary as beats. The engine reconciles the viewed scene
 * on canvasReady + after each beat resolution (engine deployed 2026-07-03).
 *
 *   Mara:    prisoner quest ACTIVE  → Arc Bay back room (presiding)
 *            otherwise              → the Counter (default spot)
 *   Miliard: prisoner quest ACTIVE  → Arc Bay back room (the "thief")
 *            prisoner COMPLETED     → the Gullywasher (collecting beers)
 *            otherwise              → the Counter area (about the Farm)
 *
 * ⚠ EDIT THE SCENE NAMES/IDS BELOW to match your world (the macro validates
 * and lists available scenes on a miss). x/y optional — omitted = scene
 * center on first spawn; reposition once by hand and it sticks (reconcile
 * never moves existing tokens, only spawns/removes).
 * Use capture-npc-placement.macro.js (select a token) to print exact coords.
 *
 * DRY_RUN default true. Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = false;

  // ── EDIT ME: your scene anchors ──────────────────────────────────────────
  const SCENES = {
    backRoom:  { sceneId: "xq6QzkNgIcoBsgLi" },            // Arc Bay back room (beat 105's scene)
    counter:   { sceneName: "fixit_general_store_interior" }, // Mara's Counter scene
    gullywasher: { sceneId: "r80yB4XukWUFeoPD" }              // fixit_gullywasher_interior — Dougan's saloon
  };

  const QUEST_PRISONER = "quest_uDuNp2yQxbuKkHx7";
  const PLACEMENTS = [
    { actorId: "GTX6S0gtzoJ7OeSE", /* Mara */ rules: [
      { when: [{ questBucket: QUEST_PRISONER, is: "active" }], ...SCENES.backRoom },
      { when: [], ...SCENES.counter }
    ]},
    { actorId: "OaZGlGHBBdTXfJHr", /* Miliard */ rules: [
      { when: [{ questBucket: QUEST_PRISONER, is: "active" }], ...SCENES.backRoom },
      { when: [{ questBucket: QUEST_PRISONER, is: "completed" }], ...SCENES.gullywasher },
      { when: [], ...SCENES.counter }
    ]}
  ];

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const NS = "bbttcc-campaign";
  const api = game.bbttcc?.api?.campaign;
  const campaignId = api?.getActiveCampaignId?.();
  let raw = game.settings.get(NS, "campaigns");
  const wasString = typeof raw === "string";
  const data = wasString ? JSON.parse(raw) : raw;
  const c = data?.[campaignId];
  if (!c) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);

  // Validate anchors + actors.
  const report = [];
  let bad = 0;
  const resolveScene = (r) => r.sceneId ? game.scenes.get(String(r.sceneId).replace(/^Scene\./, ""))
    : (game.scenes.getName(r.sceneName) || game.scenes.contents.find(s => s.name === r.sceneName));
  for (const [k, r] of Object.entries(SCENES)) {
    const s = resolveScene(r);
    report.push(`${s ? "✓" : "❌"} scene anchor '${k}' → ${s ? `${s.name} (${s.id})` : `NOT FOUND (${JSON.stringify(r)})`}`);
    if (!s) bad++;
  }
  for (const p of PLACEMENTS) {
    const a = game.actors.get(p.actorId);
    report.push(`${a ? "✓" : "❌"} actor ${p.actorId} → ${a?.name || "NOT FOUND"}`);
    if (!a) bad++;
  }
  if (bad) {
    console.log(`[seed-npc-placements] ANCHOR PROBLEMS — fix the SCENES block. Available scenes:\n  ` +
      game.scenes.contents.map(s => `${s.name} (${s.id})`).join("\n  "));
  }

  console.log(`[seed-npc-placements] ${DRY_RUN ? "DRY RUN" : "APPLYING"}\n` + report.map(r => "  • " + r).join("\n"));
  if (bad) return ui.notifications.error("Placement anchors missing — see console for available scenes.");
  if (!DRY_RUN) {
    c.npcPlacements = PLACEMENTS;
    await game.settings.set(NS, "campaigns", wasString ? JSON.stringify(data) : data);
    await api?.placements?.reconcile?.({ reason: "seeded" });
    console.log("[seed-npc-placements] APPLIED + reconciled the current scene. View each anchor scene once to settle everyone.");
  }
  ui.notifications.info(`NPC placements: ${DRY_RUN ? "DRY RUN — see console." : "APPLIED."}`);
})();
