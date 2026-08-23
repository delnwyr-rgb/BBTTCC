/* seed-stub-quest-descriptions.macro.js — write the ten empty April stubs
 * 2026-08-17. Closes a drift flag that has been open since the June census.
 *
 * WHY: ten quests were created in the April burst as titles with no body.
 * Their BEATS are rich and correctly linked — only the quest wrapper is
 * blank, so any of these locations displays an empty quest to players the
 * moment it goes live. (This is also why "The Lost Stone Statues" reads as
 * though it has one statue: the beats know about three, the quest says
 * nothing at all.)
 *
 * Every description below is written FROM the live beats, not invented —
 * the chapel really does correct its own alignment, the mire really does
 * brighten when someone shades the truth.
 *
 * ⚠ NEVER OVERWRITES. A quest whose description has any content is skipped,
 * reported, and left exactly as the owner wrote it.
 *
 * THE DUPLICATE: "The Singing Mire" exists twice.
 *   · quest_ZTiNTjhJGtRz7iDu — 4 beats. The real one. Gets its description.
 *   · quest_S2E1bogWwoybBuGU — 0 beats, no description. The stray.
 * Default action is to ARCHIVE the stray (status → "archived", name prefixed
 * so it is obvious in any list) rather than delete it — reversible, and the
 * seeder backs the quests setting up first either way. Flip HARD_DELETE if
 * you would rather it were gone; it owns no beats, so nothing is orphaned.
 *
 * DRY_RUN default true. Idempotent. GM only. Run on EACH instance.
 */
(async () => {
  const DRY_RUN      = false;    // <-- set false to apply
  const HARD_DELETE  = false;   // true = remove the stray duplicate outright
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const DUPE_STRAY = "quest_S2E1bogWwoybBuGU";   // the beat-less Singing Mire

  const TEXT = {
    quest_pI4LaZTvh9QmuRaE: /* The Rotating Chapel */
      "A chapel that is abandoned right up until it isn't. The steeple shifts a few degrees when nobody is looking directly at it, and the pews have all quietly agreed to face different directions. It is not haunted and it is not broken — it is ALIGNED, repeatedly and deliberately, and the angles it keeps correcting toward point coastward, through three places you haven't been yet.",

    quest_x8T2VkPUjhvp2vDM: /* The Burnt Flats */
      "Ash country that refuses to go cold. The mud exhales heat in geometric seams, pools flash with an iridescent skin where no oil should be, and the blackened reeds lean toward something that is definitely not wind. The ugly part isn't that something happened here. It's that something was routed THROUGH here on its way somewhere else, and barely noticed.",

    quest_ZTiNTjhJGtRz7iDu: /* The Singing Mire (the real one — 4 beats) */
      "It sings before you see it. Not birdsong, not wind — harmony: human-adjacent, wrong-throated, accusatory, and every one of you hears a slightly different line. The mud brightens when somebody shades the truth. Whatever poisoned this place was TUNED, and if you can stand to be honest in front of it, it will say a name.",

    quest_OpvVkGwzBTM2Px13: /* Anchor Reach */
      "At low tide the harbor floor stops being a harbor floor and becomes a diagram. Anchor chains, drowned pilings and snapped moorings lie in a shape nobody arranged — and that nobody can un-see once they've stood at the other two sites. This is where the triangle closes, and where you choose between reading the machine and breaking it.",

    quest_J4NXb6xZ9M15EesB: /* Port Kudzu */
      "A port that floats on denial, rope, and invoices nobody wants their name anywhere near. Every dock has three stories and at least one of them is true enough to ruin somebody. Somewhere in the bar-talk is a river captain who watched the water move inland against all argument and then split, neatly, along a route that somebody had drawn in advance.",

    quest_xBw8cGSC88wX2UeT: /* Legansus Waystation */
      "Half relay tower, half civic sermon about maintenance. The Circuit Riders here already know the shape of the problem and are visibly deciding whether you are part of it. They will not praise you — that would be weird and emotionally irresponsible — but they will verify what you've found. They will also classify you while they do it.",

    quest_7V8Shz2S0EtDaHSS: /* The Crown Mall */
      "What happens when a ruin decides retail was a valid metaphysics after all. The Tanneritos don't preserve history in the official sense; they preserve route memory, social residue, and dead shipping promos — which turns out to be exactly the kind of evidence nobody ever thought worth destroying. Somewhere past the food court there is a camcorder clip of lights moving wrong over the coast.",

    quest_jivVj3iGErW53Wxl: /* The Lost Stone Statues */
      "Three statues, scattered across the Iron Reaches, each sunk a little deeper into water than the last. They are not guarding anything — they are GRADING something. Each holds a fragment of Geburah: measured strength, endurance, and the willingness to stand between harm and something that cannot survive it alone. Each will give its fragment up whether you earn it or simply take it, and the fragment is identical either way. What changes is what the Spark remembers about the hand that claimed it.",

    quest_dYfmXsGFyVseveWY: /* The Hex Flooded Towns */
      "Three enclaves underwater, and not one of them drowned in any natural sense. Light runs beneath the flood in hard geometries — under storefronts, through shattered windows, along old civic lines — as though the towns are straining to remember that they were once circuit diagrams with opinions. This is a Hod Echo learning to inhabit infrastructure. It did not get here by accident, and something upstream is still paying for it."
  };

  // ── load ──────────────────────────────────────────────────────────────────
  let questsRaw = game.settings.get(NS, "quests");
  const wasStr = typeof questsRaw === "string";
  const quests = wasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const report = [];
  let changes = 0;

  // beat counts, so the report can prove which duplicate is the live one
  let beatsByQuest = new Map();
  try {
    let cRaw = game.settings.get(NS, "campaigns");
    const camps = typeof cRaw === "string" ? JSON.parse(cRaw) : cRaw;
    for (const camp of Object.values(camps || {})) {
      for (const b of (camp?.beats || [])) {
        const q = b?.questId; if (!q) continue;
        beatsByQuest.set(q, (beatsByQuest.get(q) || 0) + 1);
      }
    }
  } catch (_) { /* counts are advisory only */ }

  // ── fill descriptions (never overwrite) ───────────────────────────────────
  for (const [id, text] of Object.entries(TEXT)) {
    const q = quests?.[id];
    if (!q) { report.push(`⚠ quest ${id} NOT FOUND — skipped (was it renamed or removed?)`); continue; }
    const cur = String(q.description || "").trim();
    if (cur) { report.push(`· ok "${q.name}" already has ${cur.length} chars — LEFT ALONE`); continue; }
    changes++;
    report.push(`✚ "${q.name}" ← ${text.length} chars (${beatsByQuest.get(id) ?? "?"} beats)`);
    if (!DRY_RUN) { q.description = text; q.updatedTs = Date.now(); }
  }

  // ── the stray duplicate ───────────────────────────────────────────────────
  const stray = quests?.[DUPE_STRAY];
  if (!stray) report.push(`· ok stray duplicate ${DUPE_STRAY} not present (already handled)`);
  else {
    const n = beatsByQuest.get(DUPE_STRAY) || 0;
    if (n > 0) {
      report.push(`🛑 REFUSING to touch ${DUPE_STRAY} — it owns ${n} beat(s), so it is NOT the stray. Investigate by hand.`);
    } else if (HARD_DELETE) {
      changes++;
      report.push(`🗑 DELETING stray duplicate "${stray.name}" (${DUPE_STRAY}) — 0 beats, no description`);
      if (!DRY_RUN) delete quests[DUPE_STRAY];
    } else if (String(stray.status) === "archived") {
      report.push(`· ok stray duplicate already archived`);
    } else {
      changes++;
      report.push(`📦 ARCHIVING stray duplicate "${stray.name}" (${DUPE_STRAY}) — 0 beats; set HARD_DELETE=true to remove instead`);
      if (!DRY_RUN) {
        stray.status = "archived";
        if (!/^\[dupe\]/i.test(stray.name || "")) stray.name = `[dupe] ${stray.name || "(unnamed)"}`;
        stray.updatedTs = Date.now();
      }
    }
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[seed-stub-quest-descriptions] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Stub quest descriptions DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Stub quest descriptions: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(wasStr ? questsRaw : JSON.stringify(questsRaw), "text/json", `backup-quests-before-stub-descriptions-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "quests", wasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Stub quest descriptions APPLIED: ${changes} change(s).`);
})();
