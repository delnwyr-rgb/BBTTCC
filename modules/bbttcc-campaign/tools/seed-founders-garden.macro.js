/* seed-founders-garden.macro.js — the Founders' Garden discovery chain
 * (2026-07-13, canon: FOUNDERS-GARDEN-CANON-2026-07-11.md — The Committed Watch)
 *
 * One hundred consented to living stone to lock the Shattering's worst.
 * Count them and you get ninety-nine. This seeds the discovery:
 *
 *  · 4 new beats — founders_garden_approach (on-enter) → _wonder (walk among
 *    them) → _the_count (THE set-piece: 99; completes Lost Statues
 *    quest_jivVj3iGErW53Wxl + accepts The Ninth Guest) → _the_plinth (the
 *    empty pedestal, feet-marks walking away).
 *  · quest registry: quest_ninth_guest "The Ninth Guest" (container — does
 *    NOT resolve before Gloomgill; the final exam happens with the question
 *    standing).
 *  · stamps onEnterBeatId on the Garden hex in the Saltwake Coast scene
 *    (GARDEN_HEX_NAME below — owner-adjustable).
 *
 * OPEN-WORLD DOCTRINE: the chain is ungated — wanderers who stumble in get
 * the full wonder (completing a never-accepted quest lands it in completed;
 * harmless, house-standard). The statue trail makes it MEANING, not access.
 * The hex keeps its wilderness name until discovered — after the count
 * fires, rename it "The Founders' Garden" by hand (the reveal is the GM's).
 *
 * All beats carry explicit timePoints (Turn Ledger). DRY_RUN default true;
 * idempotent (skips existing ids); backs up the campaigns setting. Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const GARDEN_HEX_NAME = "Static Coast e";              // <-- the Garden's overworld hex
  const SALTWAKE_SCENE = "Bad Eden — The Saltwake Coast"; // scene to stamp
  const Q_LOST_STATUES = "quest_jivVj3iGErW53Wxl";
  const Q_NINTH_GUEST = "quest_ninth_guest";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const report = [];
  let changes = 0;

  // ── quest registry ────────────────────────────────────────────────────────
  if (!quests[Q_NINTH_GUEST]) {
    quests[Q_NINTH_GUEST] = {
      id: Q_NINTH_GUEST, v: 1, name: "The Ninth Guest",
      description: "The Garden holds ninety-nine. The rite held one hundred. Somewhere in the world there is a guest who pays exact, keeps vigil instead of sleeping, and leaves no readable name — and somewhere on the Static Coast there is a plinth with feet-marks walking away from it. This question does not close quickly. It may not close in this age.",
      tags: [], createdTs: 0, updatedTs: 0
    };
    changes++; report.push("✚ quest registered: The Ninth Guest");
  } else report.push("· ok quest (already) The Ninth Guest");

  // ── the beats ─────────────────────────────────────────────────────────────
  const BEATS = [
    {
      id: "founders_garden_approach", label: "The Founders' Garden — Approach",
      type: "narration", timePoints: 0.5, dialogueOffer: false,
      description: "The swamp gives up arguing a mile before the coast, and then the land simply stops pretending. On the last rise before the water: figures. Dozens — no. More. Standing in ranks that aren't quite ranks, weathered to the color of the sky's bad days, facing the sea the way lighthouses face it — like a duty, not a view. An old service road runs in under the grass. A toppled sign at its mouth has been re-set, carefully, by hands unknown, and its dead letters still say: VISIT THE FOUNDERS' GARDEN — ONE HUNDRED FIGURES IN LIVING STONE.",
      choices: [
        { label: "Walk among them", next: "founders_garden_wonder" },
        { label: "Count the figures", next: "founders_garden_the_count" },
        { label: "Leave", next: "" }
      ]
    },
    {
      id: "founders_garden_wonder", label: "The Founders' Garden — Among the Hundred",
      type: "narration", timePoints: 0.5, dialogueOffer: false,
      description: "Up close, the postures resolve into grammar. Most face the water, shoulders set — a watch that never gets relieved. A few stand mid-stride at the garden's edge, arriving from inland at a pace of centuries, grass grown up through where their shadows should move. One near the center has a hand half-raised, and everyone who sees it privately completes the gesture differently. The quiet here is not empty. It is OCCUPIED — the specific, listening silence of a room where everyone is politely not mentioning what they're holding. Some of the faces, weathered as they are, look like they know you came.",
      choices: [
        { label: "Count the figures", next: "founders_garden_the_count" },
        { label: "Leave them to their watch", next: "" }
      ]
    },
    {
      id: "founders_garden_the_count", label: "The Founders' Garden — The Count",
      type: "skill_scene", timePoints: 1, dialogueOffer: false,
      description: "It takes the better part of a day to count honestly — the ranks fold around a low hill, the walkers at the edges keep almost-joining the ranks, and twice you lose the tally because a face makes you forget what number you were on. But the sign says one hundred, and the old ad said one hundred, and the count, done three times, with witnesses, in daylight, says NINETY-NINE. The garden holds its occupied silence while you check. It already knew.",
      worldEffects: { questEffects: [
        { action: "complete", questId: Q_LOST_STATUES, state: "completed", text: "The lost statues are found: the Founders' Garden, on the Static Coast. Ninety-nine of them." },
        { action: "accept", questId: Q_NINTH_GUEST, text: "The count says ninety-nine. The rite held one hundred. One of the Committed is loose in the world." }
      ]},
      memoryText: "They found the Garden and did the arithmetic nobody wanted: ninety-nine. The coast keeps the garrison's silence; the Stewards now keep its question.",
      choices: [
        { label: "Find the gap in the ranks", next: "founders_garden_the_plinth" },
        { label: "Leave", next: "" }
      ]
    },
    {
      id: "founders_garden_the_plinth", label: "The Founders' Garden — The Empty Plinth",
      type: "narration", timePoints: 0, dialogueOffer: false,
      description: "The gap is not hidden. It sits in the second rank with a clear sightline to the sea, a plinth like all the others — except bare. The stone on top is worn in the shape of two feet, the way a doorstep wears. And leading down from it, faint but wrong in the grass, pressed deeper than weather can explain and older than any road: footprints. Walking AWAY. Inland. Whoever stood here served long enough to wear the pedestal — and then, at some hour nobody witnessed, stepped down. The garden's silence does not change when you stand in the gap. But it is, unmistakably, the silence of the ninety-nine not talking about it.",
      choices: [
        { label: "Leave", next: "" }
      ]
    }
  ];
  for (const nb of BEATS) {
    if (byId.get(nb.id)) { report.push(`· ok beat (already) ${nb.id}`); continue; }
    camp.beats.push(nb); byId.set(nb.id, nb);
    changes++; report.push(`✚ beat: ${nb.id} (${nb.timePoints}d)`);
  }

  // ── hex on-enter stamp (Saltwake Coast scene) ─────────────────────────────
  const scene = game.scenes.getName(SALTWAKE_SCENE) || game.scenes.contents.find(s => s.name === SALTWAKE_SCENE);
  if (!scene) report.push(`⚠ scene "${SALTWAKE_SCENE}" not found — onEnter NOT stamped (re-run when present)`);
  else {
    const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const hex = scene.drawings.contents.find(dr => {
      const f = dr.flags?.["bbttcc-territory"];
      if (!f) return false;
      return norm(dr.text || f.name) === norm(GARDEN_HEX_NAME);
    });
    if (!hex) report.push(`⚠ hex "${GARDEN_HEX_NAME}" not found on scene — onEnter NOT stamped`);
    else {
      const cur = hex.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId;
      if (cur === "founders_garden_approach") report.push(`· ok onEnter (already) @ ${GARDEN_HEX_NAME}`);
      else {
        changes++; report.push(`⚡ onEnter: ${GARDEN_HEX_NAME} → founders_garden_approach${cur ? ` (was ${cur})` : ""}`);
        if (!DRY_RUN) await hex.update({ "flags.bbttcc-territory.campaign.onEnterBeatId": "founders_garden_approach" });
      }
    }
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-founders-garden] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Founders' Garden DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Founders' Garden: nothing to do — already seeded.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-garden-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Founders' Garden APPLIED: ${changes} change(s). Ninety-nine stand the watch.`);
})();
