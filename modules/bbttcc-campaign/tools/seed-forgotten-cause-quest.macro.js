/* ============================================================================
 * Bad Eden — Seed the Forgotten-Cause arc as a QUEST CHAIN  (GM macro)
 * ----------------------------------------------------------------------------
 * Creates 2 quest definitions and grafts questEffects onto the arc's terminal
 * beats so the Wendigo → Confluence → Cultural Summit arc is tracked as a quest
 * chain. Rides the coalition fan-out (progress lands on every campaign.factionIds
 * faction; survives party wipes).
 *
 *   Q1 fc_wendigo_confluence  "Something a Little Off"
 *   Q2 fc_cultural_summit     "Close the Ledger"   (spawned by Confluence Restore/Redirect)
 *
 * DRY_RUN = true -> preview only. Set false to apply. Idempotent. Backs up both
 * the quests + campaigns settings before writing (aborts if backup fails).
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const QUESTS = {
    fc_wendigo_confluence: {
      name: "Something a Little Off",
      description: "The Wendigo along the leylines keep giving directions — and taking something you can't quite name. Find the long table where they hold what the region forgot, and decide what to do with it."
    },
    fc_cultural_summit: {
      name: "Close the Ledger",
      description: "You carry the recovered cause of an ancient feud. Bring it to Dougan's Cultural Summit at the Gullywasher and enter it in the Ledger — reconcile the Chupacabras and Jackalopes for good."
    }
  };

  const BEAT_QE = {
    gullywasher_dougan_points_to_confluence: [
      { action: "accept", questId: "fc_wendigo_confluence", text: "Dougan pointed you to the Confluence." }
    ],
    wendigo_confluence_repair: [
      { action: "complete", questId: "fc_wendigo_confluence", state: "restored", text: "You restored the node; the cause is recovered." },
      { action: "accept",   questId: "fc_cultural_summit",   text: "Carry the recovered cause to the Cultural Summit." }
    ],
    wendigo_confluence_redirect: [
      { action: "complete", questId: "fc_wendigo_confluence", state: "redirected", text: "You took the ledger onto yourselves; the cause is recovered." },
      { action: "accept",   questId: "fc_cultural_summit",   text: "Carry the recovered cause to the Cultural Summit." }
    ],
    wendigo_confluence_break: [
      { action: "complete", questId: "fc_wendigo_confluence", state: "broken", text: "You severed the network; the feud ends by deletion. No summit is needed." }
    ],
    gullywasher_cultural_summit_success: [
      { action: "complete", questId: "fc_cultural_summit", state: "closed", text: "The Ledger closed; the feud is reconciled." }
    ],
    gullywasher_cultural_summit_failure: [
      { action: "beat", questId: "fc_cultural_summit", beatId: "gullywasher_cultural_summit_failure", state: "seen", text: "The summit faltered — the reason-column stayed blank." }
    ]
  };

  // --- resolve active campaign (campaigns setting) ---
  const activeId = game.settings.get(NS, "activeCampaignId");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : campsRaw;
  const campaign = camps?.[activeId] || Object.values(camps || {}).find(c => c?.id === activeId) || Object.values(camps || {})[0];
  if (!campaign || !Array.isArray(campaign.beats)) return ui.notifications.error("Active campaign / beats not found.");

  // --- quest defs (quests setting) ---
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const questReg = questsWasStr ? JSON.parse(questsRaw) : (questsRaw || {});
  const questsToAdd = Object.keys(QUESTS).filter(id => !questReg[id]);

  // --- plan beat patches (idempotent by action:questId) ---
  const beatById = new Map(campaign.beats.map(b => [b.id, b]));
  const beatPlan = [];
  for (const [beatId, rows] of Object.entries(BEAT_QE)) {
    const b = beatById.get(beatId);
    if (!b) { beatPlan.push({ beatId, status: "BEAT NOT FOUND", rows: [] }); continue; }
    const we = b.worldEffects || {};
    const existing = Array.isArray(we.questEffects) ? we.questEffects : [];
    const have = new Set(existing.map(r => `${r.action}:${r.questId}`));
    const missing = rows.filter(r => !have.has(`${r.action}:${r.questId}`));
    beatPlan.push({ beatId, beat: b, rows: missing, status: missing.length ? (DRY_RUN ? "WOULD PATCH" : "PATCH") : "ok (already)" });
  }

  console.group("%c[forgotten-cause-quest]", "font-weight:bold");
  console.log("Campaign:", campaign.label || campaign.title, "(" + campaign.id + ")");
  console.log("Quest defs to create:", questsToAdd);
  for (const p of beatPlan) console.log(`  ${p.status}  ${p.beatId}${p.rows.length ? "  ← " + p.rows.map(r => r.action + ":" + r.questId).join(", ") : ""}`);
  console.groupEnd();

  const beatsToPatch = beatPlan.filter(p => p.rows.length);
  const notFound = beatPlan.filter(p => p.status === "BEAT NOT FOUND").map(p => p.beatId);
  if (notFound.length) console.warn("NOT FOUND (check beat ids):", notFound);

  if (!questsToAdd.length && !beatsToPatch.length) return ui.notifications.info("Forgotten-Cause quest: already seeded — nothing to do.");

  if (DRY_RUN) {
    ui.notifications.warn(`DRY RUN — would create ${questsToAdd.length} quest(s) + patch ${beatsToPatch.length} beat(s)${notFound.length ? ` · ${notFound.length} NOT FOUND` : ""}. Set DRY_RUN=false to apply.`);
    return;
  }

  // --- backup first (abort if it fails) ---
  try {
    const save = foundry.utils?.saveDataToFile ?? saveDataToFile;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    save(JSON.stringify({ quests: questReg, campaigns: camps }, null, 2), "application/json", `forgotten-cause-quest-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup download failed — ABORTED. No changes written."); }

  // --- write quest defs ---
  if (questsToAdd.length) {
    const now = Date.now();
    for (const id of questsToAdd) {
      questReg[id] = { id, v: 1, name: QUESTS[id].name, description: QUESTS[id].description, tags: ["forgotten-cause"], status: "active", order: 0, campaignId: campaign.id, hexIds: [], createdTs: now, updatedTs: now };
    }
    await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(questReg) : questReg);
  }

  // --- write beat patches ---
  if (beatsToPatch.length) {
    for (const p of beatsToPatch) {
      const we = p.beat.worldEffects = p.beat.worldEffects || {};
      we.questEffects = Array.isArray(we.questEffects) ? we.questEffects : [];
      we.questEffects.push(...p.rows);
    }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }

  ui.notifications.info(`Forgotten-Cause quest: created ${questsToAdd.length} quest(s), patched ${beatsToPatch.length} beat(s). Backup downloaded.${notFound.length ? ` (${notFound.length} not found)` : ""}`);
})();
