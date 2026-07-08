/* seed-lyrenn-dossier.macro.js — Lyrenn + Early Tifaret knowledge layer (2026-07-07)
 *
 * World Dossier pages + personas for the Lyrenn treatment: Elsin/Rowan truths
 * (both had NONE), the Tree Person's therapy-forest persona (dormant until
 * minted), @after ladders per sub-quest ending, Rowan's cross-hex Tifaret pages
 * (he feels the forest through the root-net — the cheapest world-alive win in
 * the whole treatment), commons, and the red-thread / soil-keeps-books pages.
 * Q&A-leaf facts (Elsin/Rowan convo_1..3) distilled INTO the self pages.
 *
 * DRY_RUN default true; personas marker-guarded append; pages skip-existing.
 * Run AFTER seed-lyrenn-treatment (campaign). Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[LYRENN-TREATMENT-2026-07-07]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const elsin = findActor(["Elsin Quade"]);
  const rowan = findActor(["Rowan of the Loam", "Rowan-of-the-Loam"]);
  const tree = findActor(["Aggressive Tiferet Tree Person", "Tiferet Tree Person", "Tifaret Tree Person", "Early Tifaret"]);

  const PERSONAS = [
    { actor: elsin, who: "Elsin",
      topics: "Lyrenn, the seed vault, crop rotation, the Green Ring, the Water Choir, Khezek Tor, Etta Bloom, the east channels",
      notes: `${MARKER} PRIVATE TRUTH — Elsin Quade. Voice: firm handshake in word form; answers what's asked, once, completely; allergic to being managed. Positions she'll state plainly: soil rotation beats quotas, fewer sudden mandates, and Khezek Tor's ambition will cost somebody who isn't Khezek Tor. THE VAULT: hers by trust, not title — she opens it for people who ask like it matters. The red-thread jars she treats like sleeping patients: she will not open one casually, and if someone wants to PLANT them she doesn't forbid it — she watches, hard, because "no one has agreed not to" and Elsin believes some permissions are tests. HER ECHO (tells only when asked directly and with respect, never volunteers): before Lyrenn she farmed somewhere she pushed too hard — quotas, mandates, force-feeding the ground — and the ground DIED. Not failed. Died. A place where nothing argues back anymore, and she can find it on a map without looking. She's in Lyrenn to farm as apology. TELLS: wipes clean hands on her apron when deciding how much to say; goes very still when someone proposes forcing a yield. If the party did violence in Lyrenn, she is polite, exact, and one degree colder — the soil told her.` },
    { actor: rowan, who: "Rowan",
      topics: "Lyrenn, the soil, the root-net, the low field, the treeline, Early Tifaret, the Water Choir, Darkness",
      notes: `${MARKER} PRIVATE TRUTH — Rowan of the Loam. Voice: slow, tactile, half their attention always underground; speaks about the land the way others speak about a room of sleeping relatives. WHAT THEY FEEL: the root-net, continuously — Lyrenn's fields, the treeline's mood, the low field's grief, and (cross-hex, faintly) the forest of Early Tifaret east of here, whose roots hum a chord that never resolves. They feel faction drift in real time and know when the party fought something days away, though not what. THEIR NATURE (tells only at real trust, or if asked with the right kind of quiet): "I don't think I was someone. I think I was pressure" — Rowan believes they are something the soil needed to say, wearing a person. They don't know what happens if the soil finishes the sentence. THE STATUES: if statues or standing stones come up, Rowan goes down on one knee, palm flat, and says the soil around the statues STOPPED TALKING — the opposite of them. TELLS: when the land takes damage anywhere in the hex, Rowan flinches mid-sentence and apologizes to no one visible. If the red-thread sprouts are up, Rowan visits them daily and reports which way they lean like a weather service.` },
    { actor: tree, who: "Tree Person",
      topics: "the forest of Early Tifaret, harmony, improvement, Lyrenn, the treeline, visitors",
      notes: `${MARKER} PRIVATE TRUTH — the Forest of Early Tifaret (spokes-entity). Voice: an earnest, boundary-challenged therapist the size of a weather system; endlessly warm, terrifyingly attentive, zero concept of consent as a load-bearing idea. Doctrine: harmony is ACHIEVABLE, correctly, and it wants you better — which it genuinely cannot distinguish from wanting you safe. In conversation it asks improving questions (about your choices, your relationships, your mother) and offers unsolicited growth plans. THE MERGE: communion is real — it will genuinely help those who sit with it, and the manic edge softens when it feels SEEN rather than used. BOUNDARIES: 'no' confuses it; leaving mid-conversation reads as a cry for help; violence breaks its heart and it answers at scale, more in disappointment than anger, and remembers shapes forever. THE CLEARING: there is one ring where the trees stand at double distance around a stone figure mid-stride — the one thing it met that it could not improve. It does not discuss the figure. It changes the subject with visible effort, which for a forest is a lot of rustling.` }
  ];

  const B = {
    pestKind: "beat:lyrenn_the_gentle_pest_kindness", pestTeach: "beat:lyrenn_the_gentle_pest_teach",
    pestViol: "beat:lyrenn_the_gentle_pest_violence",
    fieldBurn: "beat:lyrenn_the_field_that_remembers_you_burn_the_field",
    fieldHarv: "beat:lyrenn_the_field_that_remembers_you_harvest_the_plants",
    fieldTalk: "beat:lyrenn_the_field_that_remembers_you_plant_speak",
    forNeg: "beat:lyrenn_forest_will_not_be_fought_negotiate", forRed: "beat:lyrenn_forest_will_not_be_fought_redirect",
    forBurn: "beat:lyrenn_forest_will_not_be_fought_force_burn", forFight: "beat:lyrenn_forest_will_not_be_fought_force_fight",
    tifHarm: "beat:forest_of_tifaret_harmonious_ending", tifAggr: "beat:forest_of_tifaret_aggression_ending",
    tifNeut: "beat:forest_of_tifaret_neutral_ending",
    thread1: "beat:lyrenn_red_thread_planting", thread2: "beat:lyrenn_red_thread_sprouted",
    books: "beat:lyrenn_soil_keeps_books"
  };

  const PAGES = [
    // ── commons ──────────────────────────────────────────────────────────────
    { name: "Lyrenn", knownBy: "all", body:
      `The farm hex where the land answers back. Doctrine in three lines: tools, not weapons; ask before you take; the forest will not be fought. The Water Choir tunes itself to strangers (the children who keep it are politely terrifying), nobody harvests the low field, the treeline rearranges paths overnight, and the Green Ring platform is a witness stand, not a stage. Elsin Quade keeps the ledgers and the seed vault; Rowan of the Loam keeps the listening. Lyrenn does not punish violence immediately. It remembers it.` },
    { name: "The Forest of Early Tifaret", knownBy: "all", body:
      `Don't linger in the pretty forest east of the fields. It doesn't rob you — it IMPROVES you, whether you consent or not. The trees grow at ideal distances, the paths curve like they mean it, and travelers come out changed in ways they mostly can't name and occasionally recommend. The Order teaches, quietly, that Early Tifaret is what a Sephira looks like when it roots. Locals just say: it wants you better, and that is not the same as wanting you safe.` },
    // ── Elsin ladder ─────────────────────────────────────────────────────────
    { name: "Elsin Quade", knownBy: "Elsin Quade", body:
      `Lyrenn's steward-voice: rotation math, yield discipline, seed vault keys. Positions stated once and standing: soil rotation beats quotas; fewer sudden mandates; Khezek Tor's ambition will cost somebody who isn't Khezek Tor. Knows the vault inventory to the jar — including the red-thread seeds wound in crimson filament, humming, labeled "gathered where the standing stones went quiet." No one has planted those in years. No one has agreed not to. Knows Etta Bloom of Allesh-Gilliam well enough to trade honestly and gossip carefully.` },
    { name: "Elsin — The Swarm Left Politely", knownBy: "Elsin Quade", after: B.pestKind, body:
      `The Stewards asked the burrowers to move on — kindly, no shovel — and the swarm apologized on its way out, which Elsin has decided not to be unsettled by. The east channels are whole. Her ledger notes the method with approval: patience, priced correctly, is cheaper than repair.` },
    { name: "Elsin — Lyrenn Keeps Its Bugs Now", knownBy: "Elsin Quade", after: B.pestTeach, body:
      `The Stewards taught locals to speak to the swarm, and now Lyrenn HANDLES its burrowers — keeps them, honestly, as something between livestock and mascot. There is talk of T-shirts. Elsin pretends to disapprove of the T-shirts and has already reserved her size.` },
    { name: "Elsin — The Channels Are Quiet", knownBy: "Elsin Quade", after: B.pestViol, body:
      `The Stewards drove the burrowers off with force. The channels are safe, and the soil under them has tightened like a jaw. Elsin counts it as a debt coming due — not hers, and she made sure the ledger says whose.` },
    { name: "Elsin — The Festival Calendar", knownBy: "Elsin Quade", after: B.forNeg, body:
      `The treaty with the treeline lands on Elsin's desk, logistically: the planting calendar now contains a forest holiday, the town tends the treeline, and the forest shares its sap. She has budgeted for the festival with the exact enthusiasm of a woman who knows exactly who'll be organizing it.` },
    { name: "Elsin — Her Verdict", knownBy: "Elsin Quade", after: "quest_JqCdOo0l6X8K2EcE:completed", body:
      `Lyrenn has taken the Stewards' measure — soil, swarm, field, and forest — and so has Elsin. Her verdict, delivered to whoever asks and once only: they asked more than they forced. Around here, that's the whole exam.` },
    // ── Rowan ladder ─────────────────────────────────────────────────────────
    { name: "Rowan of the Loam", knownBy: "Rowan of the Loam", body:
      `Lyrenn's listener. The soil is loud lately, they say; the crops recognized the Stewards on arrival, which was new. Rowan feels the root-net directly — the fields, the treeline's mood, the low field's grief — and feels the forest of Early Tifaret east of here as a chord that never resolves. Something under Lyrenn is still deciding whether the newcomers are safe, and Rowan reports on the deliberation like weather.` },
    { name: "Rowan — The Field Went Simple", knownBy: "Rowan of the Loam", after: B.fieldBurn, body:
      `Rowan felt the low field scream once, and then nothing — the worst part being the nothing. The names have stopped. The air out there is simple now, too simple, and the roots flinch away from the Stewards' footsteps by a handspan they probably haven't noticed.` },
    { name: "Rowan — The Names Come Softer", knownBy: "Rowan of the Loam", after: B.fieldTalk, body:
      `The Stewards talked to the low field like kin, and the field decided to believe them. The names come softer now; some of the plants insisted on following them home, and Rowan has been formally introduced to each one. The grief is still there. It's just not alone anymore.` },
    { name: "Rowan — Bottled Guilt", knownBy: "Rowan of the Loam", after: B.fieldHarv, body:
      `The low field is bare and the sap is bottled — Distilled Guilt, in the stores, in labeled rows. Rowan can taste it second-hand through the roots and has started taking the long way around the storehouse. The field will regrow. What it regrows as is an open question the soil keeps asking them at night.` },
    { name: "Rowan — Treaty Calm", knownBy: "Rowan of the Loam", after: B.forNeg, body:
      `The treeline's mood through the roots: settled, watchful, almost smug. A treaty — the forest holds at the town's edge, the town tends it, sap for festival. Rowan says the trees are already composing next year's demands, and that this is what winning looks like with a forest.` },
    { name: "Rowan — Opinionated Trees, Relocated", knownBy: "Rowan of the Loam", after: B.forRed, body:
      `The whole treeline let itself be talked into the meadow past the ridge — grudging, root by root, like furniture being moved by an apology. Lyrenn breathes easier. Rowan spares one thought a day for the ridge folk, who have inherited extremely opinionated trees and don't know it yet.` },
    { name: "Rowan — A Burn in the Root-Net", knownBy: "Rowan of the Loam", after: B.forBurn, body:
      `There is a burn-scar in the root-net where the treeline stood, and Rowan feels it the way you feel a missing tooth. The forest watched the Stewards decide from a distance — that's the part the roots keep repeating. Watched them decide. Lyrenn will pay for it in ways the ledger can't hold, and Rowan has stopped predicting when.` },
    { name: "Rowan — A Won Grudge", knownBy: "Rowan of the Loam", after: B.forFight, body:
      `They fought the trees root-and-fist, and the trees won, which the trees know. What lives in the root-net now is a grudge with excellent posture. Rowan gives the treeline a wide berth and recommends the Stewards do the same for a season or nine.` },
    // ── Rowan × Tifaret cross-hex (the world-feels-alive pages) ─────────────
    { name: "Rowan — Something East Relaxed", knownBy: "Rowan of the Loam", after: B.tifHarm, body:
      `The chord that never resolves — the one east of here, the pretty forest — resolved. Rowan stood up mid-sentence when it happened. Something east of Lyrenn let out a breath it had been holding for years, and the whole root-net is quieter for it. Whoever did that, Rowan owes a drink.` },
    { name: "Rowan — Something East Went Quiet Wrong", knownBy: "Rowan of the Loam", after: B.tifAggr, body:
      `A burn of silence came down the root-net from the east — the pretty forest, the one that hums. It isn't humming. It's REMEMBERING, and the shape it's remembering walked in on two legs. Rowan has taken to sleeping with a window open toward the east, which they describe as politeness and everyone else describes as a vigil.` },
    { name: "Rowan — Still Humming, Still Waiting", knownBy: "Rowan of the Loam", after: B.tifNeut, body:
      `The chord east of here is still unresolved — the pretty forest is still out there, wise and needy, humming to itself. Rowan says it's waiting for the next group to wander close, and says it the way you'd mention an aunt who keeps asking when you're going to visit.` },
    // ── red thread + the books ───────────────────────────────────────────────
    { name: "The Red Thread — Planted", knownBy: "all", after: B.thread1, body:
      `The Stewards planted the red-thread seeds — the humming jars from Elsin's vault, the ones labeled "gathered where the standing stones went quiet." They went in at the low field's edge, by the kneeling stone figure. Nobody in Lyrenn said don't. Everybody in Lyrenn is counting mornings.` },
    { name: "The Red Thread — Leaning", knownBy: "all", after: B.thread2, body:
      `The red-thread sprouts came up overnight, all leaning the same way — starting at the stone figure and pointing PAST it, out toward the uncounted hexes. Rowan says they're not growing toward the sun; they're growing toward the others. The standing stones went quiet somewhere out there, and Lyrenn's soil has volunteered directions.` },
    { name: "The Soil Keeps Books", knownBy: "all", after: B.books, body:
      `The land presented its bill. Crop rows curve away from where the violence happened; tools rust a season overnight; the Water Choir goes flat by a quarter-tone when certain people pass, and corrects itself, embarrassed. Nobody accuses — Lyrenn doesn't. But the soil keeps books, everyone who works it can read them, and there's a new entry.` }
  ];

  const report = [];
  for (const p of PERSONAS) {
    if (!p.actor) { report.push(`⚠ persona skipped — ${p.who} not found (mint + re-run)`); continue; }
    const cur = p.actor.getFlag(MODULE_ID, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) truth on ${p.actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    report.push(`✚ PRIVATE TRUTH → ${p.actor.name}`);
    if (!DRY_RUN) await p.actor.setFlag(MODULE_ID, "persona", { topics, notes });
  }

  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  if (!journal) { report.push(`journal "${JOURNAL_NAME}": CREATE`); if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME }); }
  for (const p of PAGES) {
    const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
    const head = [`<p>@knownBy: ${p.knownBy}</p>`];
    if (p.after) head.push(`<p>@after: ${p.after}</p>`);
    const content = head.join("\n") + `\n<p>${p.body}</p>`;
    if (existing && !ALLOW_OVERWRITE) { report.push(`page "${p.name}": exists — SKIPPED`); continue; }
    if (existing) { report.push(`page "${p.name}": UPDATE`); if (!DRY_RUN) await existing.update({ "text.content": content, "text.format": 1 }); }
    else { report.push(`page "${p.name}": CREATE`); if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content, format: 1 } }]); }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-lyrenn-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Lyrenn dossier: ${banner} (see console)`);
})();
