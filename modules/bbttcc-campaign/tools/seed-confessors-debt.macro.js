/* seed-confessors-debt.macro.js — Father Tamsin's deception mini-arc (2026-07-05)
 *
 * Owner canon: Tamsin works with the Khezek Tor Valhaulan cult — not from belief,
 * but because the Qliphothic darkness convinced him the MOUNTAIN wants the seal's
 * energy released. He spies on the Stewards, gently, believing he serves mercy.
 * Deceived, not corrupt. Redeemable.
 *
 * Creates quest `quest_ag_confessors_debt` + 6 beats:
 *   ag_confessor_dead_drop      — discovery ("The Third Candle"), gated
 *                                 {Stabilizer completed}, accepts the quest
 *   ag_tamsin_confrontation     — speaker hub (Tamsin), gated {Confessor active},
 *                                 4 doors: Mercy / Expose / Pike / Counterfeit
 *   ag_confessor_redeemed / _exposed / _pike / _counterfeit — outcomes, each
 *                                 completes the quest, Tamsin memoryText, aftermath-voiced
 *
 * DRY_RUN default true; idempotent; backup before write. Tamsin resolves by name.
 * Companion: bbttcc-mal-voice/tools/patch-tamsin-confessor.macro.js (PRIVATE TRUTH
 * + pilgrim page + the 4 outcome dossier pages).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const Q = { stabilizer: "quest_bSwOIWzxqNBwJ5NM", confessor: "quest_ag_confessors_debt", ag: "quest_Cq1v3hJpXarX5rXJ" };
  const tamsin = game.actors.find(a => ["father tamsin", "tamsin"].includes(String(a.name).trim().toLowerCase())) || null;

  const mkBeat = (o) => ({
    id: o.id, label: o.label, type: "skill_scene", timeScale: "scene",
    tags: "", politicalTags: "",
    outcomes: { success: null, failure: null },
    inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit",
      fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit",
      requires: o.requires || [] },
    actors: [], choices: o.choices || [],
    encounter: { key: "", tier: null, actorName: "" },
    worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null,
      turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [],
      questEffects: o.questEffects || [] },
    description: o.description, questId: Q.confessor, questStep: null,
    questRole: o.questRole ?? null,
    targetHexUuid: null, turnNumber: 1,
    cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
    journal: { enabled: false, entryId: null, force: false },
    unlocks: { maneuvers: [], strategics: [] }, timePoints: null,
    ...(o.speakerActorId ? { speakerActorId: o.speakerActorId } : {}),
    ...(o.inviteText ? { inviteText: o.inviteText } : {}),
    ...(o.memoryText ? { memoryText: o.memoryText } : {}),
    ...(o.dialogueOffer === false ? { dialogueOffer: false } : {})
  });
  const complete = (text) => ({ action: "complete", questId: Q.confessor, beatId: "", state: "completed", text });

  const BEATS = [
    mkBeat({
      id: "ag_confessor_dead_drop", label: "Allesh-Gilliam — The Third Candle",
      questRole: "start",
      requires: [{ questBucket: Q.stabilizer, is: "completed" }, { questBucket: Q.confessor, isNot: "completed" }],
      questEffects: [{ action: "accept", questId: Q.confessor, beatId: "", state: "active", text: "Someone at St Gilliam's is talking to the mountain's new tenants." }],
      dialogueOffer: false,
      description: "It's the candles. St Gilliam's keeps them for use, not ceremony — but the third candle from the door gets moved, some nights, a finger-width to the left, and always after the same kind of visitor: road-dusted, pays exact, doesn't stay. In the drip tray beneath it, folded small and half-drowned in wax: a scrap of waxed fiber. You've held that material once before — Etta pressed a Valhaulan seal into your hand made of exactly this. Someone in the gentlest building in town is keeping the mountain's new tenants informed, and the arithmetic of who has been asking quiet, patient questions about your business is not difficult. It just hurts."
    }),
    mkBeat({
      id: "ag_tamsin_confrontation", label: "Allesh-Gilliam — The Confessor's Debt",
      requires: [{ questBucket: Q.confessor, is: "active" }],
      speakerActorId: tamsin?.id,
      inviteText: "Father Tamsin has set two cups of tea, and his hands are not quite steady. He knows that you know.",
      choices: [
        { label: "Mercy — reach the man inside the deception", next: "ag_confessor_redeemed",
          description: "The Weeping Prisoner's question, asked for real this time. Bring the evidence AND the compassion — show him the voice he heard was never the mountain's, and leave him somewhere to stand afterward.", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Expose him before the town", next: "ag_confessor_exposed",
          description: "The truth, in daylight, at volume. It IS the truth. It will also cost the town the one chair where nobody is measured.", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Bring it to Marshal Pike", next: "ag_confessor_pike",
          description: "Professional handling. Quiet, contained, cold. Pike measures people for a living — let him measure this.", checkStat: "", checkDC: 0, failNext: "" },
        { label: "Say nothing. Feed him careful truths.", next: "ag_confessor_counterfeit",
          description: "He's a channel to the cult. Channels carry whatever you pour in. Run him — and leave a good, deceived man exactly where he is, because he's useful there.", checkStat: "", checkDC: 0, failNext: "" }
      ],
      description: "The tea is already poured when you arrive, which is how you know. Tamsin does not perform innocence — he was never good at performances, which is presumably why the darkness had to work through something true. What he believes, he will say plainly if asked: the mountain is tired, the mountain asked, and everything he has passed along was in service of a mercy larger than the town's fear. What does justice look like — when the thief in the back room is the man who taught you the question?"
    }),
    mkBeat({
      id: "ag_confessor_redeemed", label: "The Confessor's Debt — Reached",
      speakerActorId: tamsin?.id, questRole: "resolution",
      memoryText: "They brought me proof and did not bring a rope. The voice I obeyed was never the mountain's — the mountain has been quiet all along; the thing beneath it borrowed my debt and wore it. I have confessed everything. Whatever the cult asks of me now goes first to the Stewards. Mercy, it turns out, was still possible. I intend to spend the rest of mine correctly.",
      questEffects: [complete("Tamsin reached, turned, redeemed — the confessor now confesses TO you.")],
      description: "He broke the way honest things break — all at once, and cleanly. It took the evidence AND the kindness; either alone would have bounced. What reached him was the simplest fact in the room: the mountain never had a voice. The thing beneath it did, and it went looking for the one debt in town big enough to wear. Father Tamsin has confessed everything — the candles, the pilgrims, every gentle question he ever passed along — and offered the only restitution that means anything: the channel stays open, and from now on it runs backward. The cult still thinks it has a confessor. It has never been more wrong about anything."
    }),
    mkBeat({
      id: "ag_confessor_exposed", label: "The Confessor's Debt — Daylight",
      speakerActorId: tamsin?.id, questRole: "resolution",
      memoryText: "They told the town, and the town did what frightened towns do. It was the truth. I do not dispute a word of it. The candles are out at St Gilliam's, and I am learning what my own advice tastes like: less noise. Fewer rushed decisions. I was wrong about the mountain. I hope someday to be wrong about being finished.",
      questEffects: [complete("Tamsin exposed publicly — true, and expensive.")],
      description: "The truth went up in daylight and the town did what frightened towns do with it. Nobody threw anything; this is Allesh-Gilliam, they just went QUIET, which is worse, and Tamsin stood in the middle of the quiet and did not dispute one word. St Gilliam's candles are out. The chair where nobody was measured is empty, because the man who kept it is now the most measured man in three hexes. The cult has burned the channel and knows you know — and the town got the truth, paid full price, no discount. Some ledgers only balance in the expensive direction."
    }),
    mkBeat({
      id: "ag_confessor_pike", label: "The Confessor's Debt — Measured",
      speakerActorId: tamsin?.id, questRole: "resolution",
      memoryText: "The Stewards took it to Pike, and Pike came to see me alone, and what happened in that room stays in it. I keep the church. I keep the kettle. I do not keep secrets anymore — the Marshal has arranged for that. It is colder than mercy and warmer than daylight, and it is, I concede, exactly what I'd have advised for anyone else.",
      questEffects: [complete("Tamsin handed to Pike — contained, professional, cold.")],
      description: "Pike listened to all of it without moving anything but his eyes, said 'thank you for bringing it to me first,' and went to St Gilliam's alone. Whatever passed in that room took under an hour and made no noise. The arrangement, as far as anyone can see: Tamsin keeps the church, the kettle, and the chair — and every pilgrim, candle, and scrap of waxed fiber now passes through the Marshal's ledger before it passes anywhere else. The cult's channel didn't close. It grew a supervisor. Pike has added one line to his private arithmetic: proven, the Stewards — they hand over even the hard ones."
    }),
    mkBeat({
      id: "ag_confessor_counterfeit", label: "The Confessor's Debt — The Counterfeit Ledger",
      speakerActorId: tamsin?.id, questRole: "resolution",
      memoryText: "The Stewards visit more often now, and talk more freely, and I pass along what I hear, as I have always done, in service of the mountain's mercy. Lately the mountain's tenants seem — frustrated. As if the world keeps failing to match its description. I pray for their patience. I am told my information is valued.",
      questEffects: [complete("Tamsin left in place — the cult now drinks from a curated cup.")],
      description: "You said nothing. You smiled, accepted the tea, and began to lie with the care of people arranging flowers. Tamsin passes it all along faithfully — troop counts that are wrong by half, timetables that slip, a party that is always somewhere it isn't — and somewhere under Khezek Tor, the darkness is learning that its favorite window has started showing it paintings. It is an advantage, a real one, and it costs exactly what it looks like it costs: a good man kneels every night in a church with moved candles, deceived twice over now, and both times by people who told themselves it was for the best."
    })
  ];

  // ── load + apply ─────────────────────────────────────────────────────────────
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

  report.push(tamsin ? `👤 Tamsin → "${tamsin.name}" (${tamsin.id})` : `⚠ Father Tamsin NOT FOUND — beats seed without speaker; re-run after minting`);

  if (!quests[Q.confessor]) {
    quests[Q.confessor] = { id: Q.confessor, v: 1, name: "Allesh-Gilliam — The Confessor's Debt",
      description: "Someone at St Gilliam's is keeping the mountain's new tenants informed. The candles know. The drip tray knows. The question the town taught you is coming back with the confessor's own face on it: what does justice look like?",
      tags: [], createdTs: 0, updatedTs: 0 };
    changes++; report.push(`✚ quest registered: ${Q.confessor}`);
  } else report.push(`· ok (already) quest ${Q.confessor}`);

  for (const nb of BEATS) {
    const cur = byId.get(nb.id);
    if (cur) {
      if (!cur.speakerActorId && nb.speakerActorId) { cur.speakerActorId = nb.speakerActorId; changes++; report.push(`👤 wired speaker onto existing ${nb.id}`); }
      else report.push(`· ok (already) beat ${nb.id}`);
      continue;
    }
    camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`);
  }

  console.log(`[seed-confessors-debt] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.warn(`DRY RUN — ${changes} change(s) staged. See console. Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Nothing to do.");
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    saveDataToFile(JSON.stringify({ quests, campaigns: camps }, null, 2), "application/json", `confessors-debt-backup-${stamp}.json`);
  } catch (e) { console.error(e); return ui.notifications.error("Backup failed — aborting without writing."); }
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s). Backup downloaded. Run patch-tamsin-confessor (mal-voice) next.`);
})();
