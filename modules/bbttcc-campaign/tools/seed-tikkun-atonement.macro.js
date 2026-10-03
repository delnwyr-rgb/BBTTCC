/* seed-tikkun-atonement.macro.js — THE RITE OF ATONEMENT (owner ruling 2026-10-02). RUN IN-WORLD (GM). DRY_RUN default true.
 * A failed Final Ritual leaves flags.bbttcc-factions.tikkun.corrupted.finalRitual on the faction. Recovery = a story action AND a beat:
 *   1. the faction stages the RITE OF ATONEMENT strategic activity (bbttcc-raid strategic-throughput ATONEMENT — cost/tier there;
 *      only a stained faction may plan it; the ritual engine teaches it on a failure);
 *   2. at the end of the applied Advance the GM gets a card — ▶ Begin the Rite runs `tikkun_atonement_rite` for that faction;
 *   3. a success ending carries worldEffects.tikkun = { cleanseFinalRitual: true } (world-mutation-engine 2l): stain lifted, war-logged,
 *      doctrine row retired. Refusal carries { endAtonement: true } (stain stays; stage the Rite again). A miss changes nothing.
 * Shape (the Chuckle template, small): one scene, a meaningful choice (Heaven / the people / the rug), two ways to be forgiven,
 * one way to be told "not yet", one way to refuse. No quest, no storyChain (the Director never deals it), evergreen, anywhere.
 * PROSE IS A FIRST DRAFT FOR DAVE'S WORDSMITHING — every beat is tagged `wordsmith-owed`.
 * Sources (real, not pastiche): Pesachim 54a (teshuvah created before the world); Mishnah Yoma 8:9 (Yom Kippur atones between a
 * person and God; between a person and his fellow, only once he has appeased his fellow — R. Elazar ben Azariah); Berakhot 8b /
 * Bava Batra 14b (the broken tablets lie in the Ark beside the whole ones); Lurianic tikkun = birur, sifting sparks from the shards.
 * Idempotent; backs up the campaigns setting; never overwrites a beat edited after seeding. F5 after.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MARKER_TAG = "tikkun_atonement_2026_10_02";
  // ─── TUNING — the Rite's checks (2d10x10 scale; op.* checks auto-roll against the selected steward's faction) ───
  const DC_HEAVEN = 14;                       // Confess it to Heaven (op.faith) — the harder road
  const DC_PEOPLE = 12;                       // Go and make it right with the people first (op.diplomacy) — the Mishnah's road
  // ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);

  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId]; if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  const byId = new Map(camp.beats.map(b => [b.id, b]));

  const TAGS = `tikkun atonement wordsmith-owed ${MARKER_TAG}`;
  const beat = (id, label, description, { type = "dialog", choices = null, worldEffects = {}, memoryText = null, digest = null, routingOnly = true } = {}) => ({
    id, label, type, timeScale: "scene", timePoints: 0, tags: TAGS, politicalTags: "", where: "anywhere",
    description, outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: true, evergreen: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
    actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
    priority: "background", ...(routingOnly ? { dialogueOffer: false } : {}),
    ...(memoryText ? { memoryText } : {}), ...(digest ? { digest } : {}),
    choices: choices || [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
    worldEffects
  });
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const NEW = [
    beat("tikkun_atonement_rite", "The Rite of Atonement",
      "The circle from the Final Ritual is still chalked on the floor. Somebody has stepped in it. Somebody else has set a sandwich down inside it, which the sparks have taken personally. The shards of the Great Work are swept into a pile by the door, catching the light the way broken things do — as if they were still trying. Repair, the old books say, comes before the world: it was made first, so there would always be a way back. The way back is right here. It is just heavy. Who do you owe this to?",
      { routingOnly: true, choices: [
        ch("Confess it to Heaven, plainly. (Faith)", "tikkun_atonement_whole", { checkStat: "op.faith", checkDC: DC_HEAVEN, failNext: "tikkun_atonement_not_yet", description: "No excuses, no committee minutes. You say what you did to the Work, out loud, to whoever is listening above the ceiling tiles." }),
        ch("Go and make it right with the people first. (Diplomacy)", "tikkun_atonement_amends", { checkStat: "op.diplomacy", checkDC: DC_PEOPLE, failNext: "tikkun_atonement_not_yet", description: "The Day of Atonement covers what lies between you and Heaven. What lies between you and the folk whose roof the ritual cracked, it does not touch — not until you have gone and asked them." }),
        ch("Sweep the shards under the rug.", "tikkun_atonement_refused", { description: "It is a big rug. It has held worse." })
      ] }),
    beat("tikkun_atonement_whole", "The Rite of Atonement — Beside the Whole Ones",
      "You say it plainly, and nothing dramatic happens, which is how you know it worked. Someone gathers the shards — not to throw them out; to keep them. The old teachers say the broken tablets rode in the Ark beside the whole ones, carried across the desert as carefully as the law that replaced them. So: a box, a cloth, the shards, a place on the shelf next to the things that never broke. The sparks settle. The sandwich is forgiven too, on a technicality.",
      { worldEffects: { tikkun: { cleanseFinalRitual: true } },
        memoryText: "The faction confessed the failed Final Ritual plainly and kept the shards beside the whole things. The stain lifted.",
        digest: "A faction quietly atones for its failed Great Work. The shards, reportedly, are being kept.",
        choices: [ch("Put the box on the shelf.", "")] }),
    beat("tikkun_atonement_amends", "The Rite of Atonement — First, the Neighbours",
      "You go door to door. It takes all afternoon. The woman whose kiln the ritual blew out wants it relit, and an apology in front of her brother, specifically. The man whose goats went strange wants nothing; he just wanted to be asked. By the time you are back at the chalk circle there is nothing left to say to Heaven that the street has not already heard. That is the order the Mishnah gives it in, and it turns out the Mishnah was right. The sparks settle.",
      { worldEffects: { tikkun: { cleanseFinalRitual: true } },
        memoryText: "The faction atoned for the failed Final Ritual by making it right with the neighbours first. The stain lifted.",
        digest: "Door-to-door apologies reported after last season's ritual mishap. One kiln relit; one brother present.",
        choices: [ch("Relight the kiln on the way out.", "")] }),
    beat("tikkun_atonement_not_yet", "The Rite of Atonement — Not Yet",
      "The words come out in the wrong order, or the right order with the wrong face on them, and the shards just lie there catching the light. Nobody strikes you down. That is almost worse. The door is still open — it was made before the world, it does not close — but it is heavier than you thought, and you are not through it today.",
      { choices: [ch("Let the shards lie for now.", "", { description: "A failed check re-offers the Rite's menu; close it to let the miss stand. The activity can be staged again next turn." })] }),
    beat("tikkun_atonement_refused", "The Rite of Atonement — Under the Rug",
      "It goes under the rug. All of it. The rug now has a lump in the middle shaped exactly like a vessel, and everyone steps around it, and everyone pretends not to, and the sparks hum faintly through the weave at night like a fridge you cannot find. The stain stays. The Rite will still be there next turn. So will the lump.",
      { worldEffects: { tikkun: { endAtonement: true } },
        memoryText: "The faction swept the failed Final Ritual under the rug. The stain stayed; so did the lump.",
        choices: [ch("Step around it.", "")] })
  ];
  // The Rite itself is entered by the GM card (▶ Begin the Rite) — not a dialogue offer, not a Director pick.

  for (const nb of NEW) {
    const have = byId.get(nb.id);
    if (!have) { camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); continue; }
    if (JSON.stringify(have) === JSON.stringify(nb)) { say(`· ok beat ${nb.id}`); continue; }
    // Never clobber: a beat edited after seeding (Beat Editor, a wordsmithing pass) or an unrelated beat with this id is left alone.
    if (!String(have.tags || "").includes(MARKER_TAG)) { say(`⚠ beat ${nb.id} exists and is NOT ours (no ${MARKER_TAG} tag) — NOT overwritten; rename one of them`); continue; }
    say(`⚠ beat ${nb.id}: edited after seeding — NOT overwritten (it still needs worldEffects.tikkun on its success/refusal path)`);
  }

  console.log(`[seed-tikkun-atonement] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Tikkun atonement DRY RUN: ${changes} change(s) — see console (F12).`);
  if (!changes) return ui.notifications.info("Tikkun atonement: nothing to do.");
  try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-tikkun-atonement-${Date.now()}.json`); }
  catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Tikkun atonement APPLIED: ${changes} change(s). F5.`);
})();
