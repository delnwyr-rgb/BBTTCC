/* seed-laser-bev.macro.js — wire the Mall's two faces: Chairperson Laser Bev
 * + Donny, Guardian of the Vibes (2026-07-11)
 *
 * Both are fully authored in the Mall of Forgotten Yesterdays cluster —
 * Bev: intro + 5 topics + terms + echo; Donny: approach + parley + 4 vibe
 * verdicts (a silver dragon who keeps out bad VIBES, not people). This wires
 * their minted actors onto those beats, retires routing leaves from the
 * director surface, and stamps personas + public dossier pages. Small and
 * additive; the full mall arc treatment remains a future pass.
 *
 * Resolves BY NAME ("Laser Bev", "Donny"). DRY_RUN default true; idempotent
 * (marker-guarded personas, skip-existing pages, field-level beat checks).
 * Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  const MV = "bbttcc-mal-voice";
  const MARKER = "[LASER-BEV-2026-07-11]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const bev = game.actors.find(a => ["laserbev", "chairpersonlaserbev", "bev"].includes(norm(a.name))) || null;
  const donny = game.actors.find(a => ["donny", "donnythedragon", "donnyguardianofthevibes"].includes(norm(a.name))) || null;

  const HUB = "enc_forgotten_yesterdays_laser_bev_intro";
  const LEAVES = [
    "enc_forgotten_yesterdays_laser_bev_1", "enc_forgotten_yesterdays_laser_bev_2",
    "enc_forgotten_yesterdays_laser_bev_3", "enc_forgotten_yesterdays_laser_bev_4",
    "enc_forgotten_yesterdays_laser_bev_5", "enc_forgotten_yesterdays_laser_bev_terms",
    "enc_forgotten_yesterdays_laser_bev_echo"
  ];
  // Donny: parley is the conversational hub; approach is a scene-setter
  // (routing-only); the four verdicts are his performance beats.
  const DONNY_HUB = "enc_forgotten_yesterdays_donny_parley";
  const DONNY_SCENE = "enc_forgotten_yesterdays_donny_approach";
  const DONNY_VERDICTS = [
    "enc_forgotten_yesterdays_donny_respect", "enc_forgotten_yesterdays_donny_mixed",
    "enc_forgotten_yesterdays_donny_good", "enc_forgotten_yesterdays_donny_bad_vibes"
  ];

  // ── campaign side: speaker + leaf retirement ──────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = [];
  let changes = 0;

  report.push(bev ? `👤 Laser Bev → "${bev.name}"` : "⚠ Laser Bev NOT FOUND (mint + re-run)");
  report.push(donny ? `👤 Donny → "${donny.name}"` : "⚠ Donny NOT FOUND (mint + re-run)");

  for (const id of [HUB, ...LEAVES]) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING BEAT ${id}`); continue; }
    if (bev && !b.speakerActorId) { b.speakerActorId = bev.id; changes++; report.push(`👤 speaker @ ${id}`); }
    if (id !== HUB && b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; report.push(`🔇 dialogueOffer:false @ ${id}`); }
  }
  {
    const hub = byId.get(HUB);
    if (hub && !hub.inviteText) {
      hub.inviteText = "Chairperson Laser Bev will see you now. Bring your own sunglasses; the kiosk stopped selling them before the world ended.";
      changes++; report.push("💬 inviteText @ hub");
    }
  }
  for (const id of [DONNY_HUB, DONNY_SCENE, ...DONNY_VERDICTS]) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ MISSING BEAT ${id}`); continue; }
    if (donny && !b.speakerActorId && id !== DONNY_SCENE) { b.speakerActorId = donny.id; changes++; report.push(`👤 speaker @ ${id}`); }
    if (id !== DONNY_HUB && b.dialogueOffer !== false) { b.dialogueOffer = false; changes++; report.push(`🔇 dialogueOffer:false @ ${id}`); }
  }
  {
    const hub = byId.get(DONNY_HUB);
    if (hub && !hub.inviteText) {
      hub.inviteText = "There is a silver dragon on the mall wall, and he would like to know your deal, little my dudes.";
      changes++; report.push("💬 inviteText @ donny_parley");
    }
  }

  // ── mal-voice side: persona + public page ─────────────────────────────────
  if (bev) {
    const cur = bev.getFlag(MV, "persona") || {};
    if (!String(cur.notes || "").includes(MARKER)) {
      const topics = [String(cur.topics || "").trim(),
        "the Mall of Forgotten Yesterdays, the Tanneritos, the Crown Mall, memory-tapes, Donny, trade, alliance, renewable consent"
      ].filter(Boolean).join(", ");
      const notes = [String(cur.notes || "").trim(), `${MARKER} PRIVATE TRUTH — Chairperson Laser Bev of the Tanneritos. Office: a former sunglasses kiosk, acrylic shelves under dead neon; mirrored shades pushed up into her hair; annotates a legal pad with a glitter pen that radiates executive menace. WHY SHE'S IN CHARGE: she solves the problem that keeps coming back — leaks, feuds, tape disputes, heartbreak, concession routing, ghost inventory drift, two separate incidents involving cursed Orange Juliuses. When weird little systems start to wobble, she can HEAR it. DOCTRINE: continuity without calcification; renewable consent ('permanence is how bad ideas put on a necktie — every empire that came through wanted to call itself inevitable, in a different font'). TERMS (she leads with these, they are not negotiable): you don't get to own us because you map us; you don't get to govern us because you survive us; trade, alliance, and mutual aid are possible; acquisition is not. THE USEFULNESS TEST for outsiders: finish what you start; don't confuse being invited with being trusted; don't 'stabilize' us into somebody else's comfort; and anyone who buys a memory-tape had better know the difference between curiosity and looting. ON DONNY (her face softens ~4%): a sweetheart with tactical apocalypse boundaries — if he lets somebody through, he believes they might still choose decency; don't make him feel stupid, he takes that personally in a very draconic register. 🔑 HER ECHO (guards until earned — someone who's finished what they started for the mall, or who admits their own structure failed them): she made a place orderly once. Efficient. Predictable. Nobody ever had to wonder what the rules were. That place could not survive grief. She is here to build something that bends before it breaks — and to make sure irony never again becomes an excuse for not loving people on purpose. TELLS: the glitter pen stops moving when she's actually listening; softens measurably only about Donny; says 'we' for the mall and means every raccoon in it.`
      ].filter(Boolean).join("\n\n");
      report.push(`✚ PRIVATE TRUTH → ${bev.name}`);
      if (!DRY_RUN) await bev.setFlag(MV, "persona", { topics, notes });
    } else report.push("· ok (already) persona on Laser Bev");
  }

  if (donny) {
    const cur = donny.getFlag(MV, "persona") || {};
    if (!String(cur.notes || "").includes(MARKER)) {
      const topics = [String(cur.topics || "").trim(),
        "the Mall of Forgotten Yesterdays, the Tanneritos, vibes, Laser Bev, dragons, the wall, the vibe check"
      ].filter(Boolean).join(", ");
      const notes = [String(cur.notes || "").trim(), `${MARKER} PRIVATE TRUTH — Donny, Guardian of the Vibes. A silver dragon lounging across the mall's broken frontage wall like the apocalypse forgot to tell him to stop having a good afternoon. Voice: surf-slow, ancient, warm; blinks slower than he nods; calls groups 'little my dudes'; exhales cool smoke when satisfied. DOCTRINE: he is NOT here to keep people out — he keeps BAD VIBES from walking in and causing shit. THE POP QUIZ (asks everyone, genuinely curious): are you trying to USE the mall, SAVE the mall, or TAKE OVER the mall? Honest use = fine. Saving = suspicious (the mall isn't broken). Takeover = 'Bzzzzzzzzz! Wrong answer!' — he does not attack; he STRATEGICALLY REPOSITIONS SEVERAL BUILDINGS and lets geometry do the arguing. ON THE TANNERITOS: 'they are uncommitted, not unserious — wildly different survival strategies; don't confuse one for the other, leads to misunderstandings, then probably lots of skateboarding.' PERSPECTIVE: ancient enough to have watched empires rise and fall and concluded both processes were mostly a lot of hassle. THE DRAGON BLESSING (bestows on provisional guests, completely sincere): 'May a shard of the light of the egg of the cosmos get stuck in yer craw good and hard so you get your shit together.' HE AND BEV: mutual, unspoken, four-percent-softening respect; if he lets somebody through, it means he believes they might still choose decency — and he takes being made to feel stupid about that personally, in a very draconic register. GUARDS: why THIS mall, of all the places an ancient silver dragon could nap — he deflects with 'good food court energy' and 'the vibes here are load-bearing.' The true reason is not yet written (owner canon slot — do not improvise it; deflect warmly). TELLS: tail-tip taps twice before he repositions a building; smoke goes from cool to cold when someone lies about their deal.`
      ].filter(Boolean).join("\n\n");
      report.push(`✚ PRIVATE TRUTH → ${donny.name}`);
      if (!DRY_RUN) await donny.setFlag(MV, "persona", { topics, notes });
    } else report.push("· ok (already) persona on Donny");
  }

  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  const PAGES = [
    {
      name: "Chairperson Laser Bev",
      content: `<p>@knownBy: all</p>\n<p>Runs the Tanneritos from a former sunglasses kiosk in the Mall of Forgotten Yesterdays — mirrored shades in her hair, glitter pen of executive menace on the legal pad. She's in charge because she solves the problems that keep coming back, up to and including two separate cursed Orange Julius incidents. Her terms travel ahead of her: trade is possible, alliance is possible, mutual aid is possible, acquisition is not. You don't get to own the mall because you map it, and you don't get to govern it because you survive it. Getting past Donny means Donny believes you might still choose decency. Don't make him feel stupid.</p>`
    },
    {
      name: "Donny, Guardian of the Vibes",
      content: `<p>@knownBy: all</p>\n<p>The silver dragon on the Mall of Forgotten Yesterdays' broken frontage wall. He is not a lock; he is a vibe check with a wingspan. He asks everyone the same pop quiz — use the mall, save the mall, or take over the mall? — and honest answers walk in while rent-a-tyrants find that several buildings have strategically repositioned themselves between them and the food court. He has watched empires rise and fall and considers both processes mostly a lot of hassle. If Donny lets you through, he believes you might still choose decency. Travelers advise: accept the dragon blessing about the egg of the cosmos with a straight face. He means it.</p>`
    }
  ];
  for (const PAGE of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === PAGE.name);
    if (existing) { report.push(`page "${PAGE.name}": exists — SKIPPED`); continue; }
    report.push(`page "${PAGE.name}": CREATE`);
    if (!DRY_RUN) {
      if (!journal) journal = await JournalEntry.create({ name: JOURNAL_NAME });
      await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: PAGE.name, type: "text", text: { content: PAGE.content, format: 1 } }]);
    }
  }

  // ── write ─────────────────────────────────────────────────────────────────
  console.log(`[seed-laser-bev] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} beat change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Laser Bev DRY RUN: ${changes} beat change(s) + persona/page (see console).`);
  if (changes) {
    try {
      const save = foundry.utils.saveDataToFile ?? saveDataToFile;
      save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-laser-bev-${Date.now()}.json`);
    } catch (e) {
      return ui.notifications.error("Backup failed — aborting beat write. " + (e?.message || e));
    }
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  ui.notifications.info(`Laser Bev APPLIED: ${changes} beat change(s) + persona/page. ${MARKER}`);
})();
