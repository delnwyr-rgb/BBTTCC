/* seed-laser-bev.macro.js — wire Chairperson Laser Bev (2026-07-11)
 *
 * The Tanneritos chairperson is fully authored in the Mall of Forgotten
 * Yesterdays cluster (intro + 5 topics + terms + echo) — this wires her
 * minted actor onto those beats, retires the Q&A leaves from the director
 * surface, and stamps her persona + public dossier page. Small and additive;
 * the full mall arc treatment remains a future pass.
 *
 * Resolves BY NAME ("Laser Bev"). DRY_RUN default true; idempotent
 * (marker-guarded persona, skip-existing page, field-level beat checks).
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

  const HUB = "enc_forgotten_yesterdays_laser_bev_intro";
  const LEAVES = [
    "enc_forgotten_yesterdays_laser_bev_1", "enc_forgotten_yesterdays_laser_bev_2",
    "enc_forgotten_yesterdays_laser_bev_3", "enc_forgotten_yesterdays_laser_bev_4",
    "enc_forgotten_yesterdays_laser_bev_5", "enc_forgotten_yesterdays_laser_bev_terms",
    "enc_forgotten_yesterdays_laser_bev_echo"
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

  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  const PAGE = {
    name: "Chairperson Laser Bev",
    content: `<p>@knownBy: all</p>\n<p>Runs the Tanneritos from a former sunglasses kiosk in the Mall of Forgotten Yesterdays — mirrored shades in her hair, glitter pen of executive menace on the legal pad. She's in charge because she solves the problems that keep coming back, up to and including two separate cursed Orange Julius incidents. Her terms travel ahead of her: trade is possible, alliance is possible, mutual aid is possible, acquisition is not. You don't get to own the mall because you map it, and you don't get to govern it because you survive it. Getting past Donny means Donny believes you might still choose decency. Don't make him feel stupid.</p>`
  };
  {
    const existing = journal?.pages?.contents?.find(pg => pg.name === PAGE.name);
    if (existing) report.push(`page "${PAGE.name}": exists — SKIPPED`);
    else {
      report.push(`page "${PAGE.name}": CREATE`);
      if (!DRY_RUN) {
        if (!journal) journal = await JournalEntry.create({ name: JOURNAL_NAME });
        await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: PAGE.name, type: "text", text: { content: PAGE.content, format: 1 } }]);
      }
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
