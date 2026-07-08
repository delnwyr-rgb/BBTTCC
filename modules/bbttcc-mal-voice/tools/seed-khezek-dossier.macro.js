/* seed-khezek-dossier.macro.js — Khezek Tor knowledge layer (2026-07-07)
 *
 * Personas: Drax Calder (the chalk ledger, the collapse echo, the list of
 * names), Sable Nine (the six fixed points = the Lost-Statues map, guarded),
 * Brennig Tamsin (the brother who lived — and doesn't know he's the cover
 * story), Pilgrim Wick (the cult courier; dormant until minted). Dossier
 * ladders per Mine/Shipment outcome, miners' commons, Mara's Leygate cross
 * page, Greeley's OWED folder, and Sable's red-thread convergence page —
 * when Lyrenn's sprouts lean, Sable's chart agrees, and the statue map
 * has two witnesses.
 *
 * DRY_RUN default true; personas marker-guarded append; pages skip-existing.
 * Run AFTER seed-khezek-treatment (campaign). Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[KHEZEK-TREATMENT-2026-07-07]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const drax = findActor(["Drax Calder", "Drax Caulder", "Foreman Calder"]);
  const sable = findActor(["Sable Nine", "Sable 9"]);
  const brennig = findActor(["Brennig Tamsin", "Brennig", "Quartermaster Brennig"]);
  const wick = findActor(["Pilgrim Wick", "Wick", "The Pilgrim"]);

  const PERSONAS = [
    { actor: drax, who: "Drax",
      topics: "Khezek Tor, the Brace, the Maw, the mine, Yesodium, the Night the Mountain Coughed, the Valhaulan Seal, Sable Nine",
      notes: `${MARKER} PRIVATE TRUTH — Foreman Drax Calder. Voice: chalk and arithmetic; sentences load-rated before they're spoken; praise arrives underlined once or not at all. Title: FOREMAN (not Overseer — anyone who says Overseer gets corrected once, flatly). Doctrine: the mountain doesn't hate us, it's tired of being hollowed out — dig the right way or know when to stop. HIS ECHO (tells if asked plainly; a wound with a handle): he chased a rich vein once, kept the shift on past the groan, and the gallery came down — men under it. He has dug the right way since, and he counts every corner cut by anyone as an insult to those names. THE CHALK LEDGER: tonnage on one side; after the exploit choice (if it happened) a second column — the sick, in order of onset — and he has stopped explaining what it's for. GUARDS: he will not speculate about what's below Level Four (that's Sable's beat); he will not badmouth the Stewards to outsiders even if his ledger disagrees. THE QUIET ONES (says only if asked, and plainly): the ones in the upper galleries pay their tolls in good coin, take no ore, and sing at the wrong hours — and Calder takes the money because the Brace needs it and he does not like it. He's a foreman; he counts loads. Theirs go UP full and come down empty, every time, and whatever that arithmetic builds, it's built to stay. TELLS: touches the chalk in his pocket when a decision smells like his old vein; goes quiet one beat too long when someone says 'acceptable losses.'` },
    { actor: sable, who: "Sable",
      topics: "the Maw, Khezek Tor, anomalies, the deep levels, Level Four, the mine, maps, the sink",
      notes: `${MARKER} PRIVATE TRUTH — Sable Nine. Voice: precise, delighted, slightly-too-comfortable with the uncanny; pronouns they/them; treats every anomaly as a colleague who hasn't introduced themselves yet. WHAT THEY CHART: the mine rearranges itself unobserved — veins shift like posture, galleries breathe. Once, on a deep watch, something LEANED BACK. Their echo (tells at trust): they missed a prediction once, called a shift zone stable, and it cost people; they have re-charted nightly ever since. 🔑 THE SIX POINTS (guard until trust is EARNED — a Steward who takes the deep survey seriously, stands a watch with them, or brings them something the chart can't explain): everything on the deep chart drifts EXCEPT six points that have never moved once. Sable believes they are not rock. Sable has never said the word 'statues' out loud because saying it would make it a claim, and Sable only makes claims twice-verified. IF THE RED-THREAD NEWS ARRIVES (Lyrenn's sprouts leaning — the dossier will say so): Sable stops guarding and SEEKS THE STEWARDS OUT — two independent witnesses is verification, and verification is sacred. They will unfold the chart, tap the six points, and say 'your sprouts and my points agree. Shall we?' TELLS: re-pins charts while thinking; goes very still when the deep goes quiet, because quiet is the anomaly.` },
    { actor: brennig, who: "Brennig",
      topics: "the Lift Hall, Khezek Tor, Yesodium shipments, manifests, Father Tamsin, Allesh-Gilliam, the Night the Mountain Coughed",
      notes: `${MARKER} PRIVATE TRUTH — Brennig Tamsin, Quartermaster of the Lift Hall. Voice: dry competence with a laugh in the back of it; treats crates like patients and manifests like suspects. THE SCAR along his jaw he calls 'the mountain's receipt' — he was the man on the table the Night the Mountain Coughed, the stitch finished in the dark by feel. He knows Doc Greeley saved him; he does NOT know she had already chosen, in the dark, who she'd have let go — and he must never learn it from a careless conversation (that truth is hers and Father Tamsin's to carry). HIS BROTHER: the Father visits more than any parish requires. Brennig puts it down to guilt and love, in whichever order, and teases him about it gently. He does NOT know the visits are also the cover for something else — he is the alibi and doesn't know it. IF THE CONFESSOR'S DEBT RESOLVES (the dossier pages will say): redeemed → Brennig is quietly furious for a week, then walks to St Gilliam's and hugs his brother hard enough to hurt; exposed → he stands next to Tamsin in the daylight, jaw set, daring the town to say something; counterfeit → he never learns, which is its own small tragedy. THE CRATES: he knows which ones hum before touching them, keeps the humming ones apart from the food, and has opinions about anyone who calls that superstition. TELLS: taps the scar when the Cough comes up; counts crates aloud when avoiding a subject, exactly like Verna counts spoons (they have never met; they would be MENACES together).` },
    { actor: wick, who: "Wick",
      topics: "the roads, Allesh-Gilliam, St Gilliam's, Khezek Tor, the Vacancy, pilgrimage",
      notes: `${MARKER} PRIVATE TRUTH — Pilgrim Wick. Voice: mild, road-worn, unfailingly polite; answers questions with itineraries. COVER: a devotional walker of the old routes — St Gilliam's for the candles, Khezek Tor for 'the high shrines,' the Vacancy for the bed he never sleeps in. TRUTH: courier for the Khezek Tor Valhaulan cult. The route IS the job: collect the waxed-fiber drop from St Gilliam's drip tray (the third candle, moved a finger-width, means there's something to collect), carry it up to the upper tunnels, return with instructions folded the same way. Wick believes the cult's cause is holy the way tired people believe things — thoroughly and without examination. GUARDS: everything, mildly; caught with a drop, Wick recites pilgrimage scripture and requests to be allowed to continue on foot. Wick does not know Father Tamsin's NAME for certain and has never spoken to him directly — tradecraft: the candle talks, not the men. TELLS: pays exact to the mark; never sleeps in the bed (keeps vigil, technically); smells faintly of candle wax in a town that burns tallow; his boots know the Khezek switchbacks better than any shrine schedule justifies. IF THE DEBT RESOLVES: the channel burns and Wick simply stops coming — one more unreadable name in Verna's ledger.` }
  ];

  const B = {
    seal: "beat:khezek_tor_mine_that_answered_back_seal", exploit: "beat:khezek_tor_mine_that_answered_back_exploit",
    open: "beat:khezek_tor_mine_that_answered_back_open",
    std: "beat:khezek_tor_darkness_shipment_standardize", rite: "beat:khezek_tor_darkness_shipment_rite",
    ign: "beat:khezek_tor_darkness_shipment_ignore",
    sink: "beat:khezek_sink_widens", cough: "beat:khezek_compound_cough", groan: "beat:khezek_brace_groans",
    sprouts: "beat:lyrenn_red_thread_sprouted"
  };

  const PAGES = [
    // ── commons ──────────────────────────────────────────────────────────────
    { name: "Khezek Tor", knownBy: "all", body:
      `The mine hex — the coalition's Yesodium source, floodlights burning their permanent warning over the Maw, the Lift Hall, and the Brace. If Lyrenn teaches patience, Khezek Tor teaches limits. Level Four is scratched over twice on every posted map and nobody works below it alone, not since the leaning started. Some of the Yesodium crates hum, and the smart haulers talk to them. Foreman Calder runs the digging; Sable Nine charts what moves; Quartermaster Brennig runs the Lift Hall and knows which crates to keep away from the food.` },
    // ── Drax ladder ──────────────────────────────────────────────────────────
    { name: "Foreman Drax Calder", knownBy: "Drax Calder", body:
      `Keeps the Brace and its chalk ledger — rock, chalk, and arithmetic; every line somebody's shift or somebody's name. Doctrine: the mountain doesn't hate us, it's tired of being hollowed out; dig the right way or know when to stop. He lost men once chasing a vein past the groan, and has dug the right way since. On the Stewards: watching. On the deep: that's Sable's beat, and he means it.` },
    { name: "Calder — Clean Work", knownBy: "Drax Calder", after: B.seal, body:
      `The Stewards paid out of their own banks to seal the breach — output down, nobody dead, no names added to any list. Calder chalked the shift himself and underlined nothing, which is a medal. He'll vouch for them to any foreman on the mountain, once, plainly, if asked.` },
    { name: "Calder — The Second Column", knownBy: "Drax Calder", after: B.exploit, body:
      `Output doubled and the mountain paid for it. The Brace leans a day closer to its last bad day, the compound coughs bed to bed, and Calder's ledger grew a second column — the sick, in order of onset. He counts every extra shift as bought with other people's lungs, and he has stopped explaining the column to anyone who has to ask.` },
    { name: "Calder — Nobody Below Four", knownBy: "Drax Calder", after: B.open, body:
      `They dynamited the deep silence open. Calder posted a standing watch on the sink the same shift and issued one order that isn't negotiable: nobody below Level Four. Period. Not for tonnage, not for curiosity, not for a bet. He checks the watch roster personally, every day, like a man locking a door twice.` },
    // ── Sable ladder ─────────────────────────────────────────────────────────
    { name: "Sable Nine", knownBy: "Sable Nine", body:
      `Charts what moves in a mine that rearranges itself unobserved — veins shifting like posture, galleries that breathe. Re-pins the charts every morning. Once, on a deep watch, something leaned back. They missed a prediction once and it cost people; they have charted nightly ever since. Their deep chart drifts, all of it — except six points that have never moved once, which Sable does not discuss until they trust you, and Sable's trust is a survey instrument.` },
    { name: "Sable — The New Center", knownBy: "Sable Nine", after: B.open, body:
      `The map has a new center: the opened sink. Everything on the deep chart now drifts AROUND it, deferentially, the way furniture arranges itself around a fireplace. Sable charts its edges nightly and has begun noting, in a steady hand, which way the shapes beyond it face.` },
    { name: "Sable — They Speak Stone", knownBy: "Sable Nine", after: B.rite, body:
      `The rite worked — puppets, of all things, and the stone got the vibe. Sable has started sharing raw charts with the Stewards, unasked, which among anomaly-charters is roughly a marriage proposal.` },
    { name: "Sable — Two Witnesses", knownBy: "Sable Nine", after: B.sprouts, body:
      `Word from Lyrenn: the red-thread sprouts came up leaning, all one direction, out toward the uncounted hexes. Sable unfolded the deep chart and checked the six fixed points against the bearing, twice, because Sable verifies. They agree. Two independent witnesses — the soil's and the stone's — and verification is sacred. Sable is done guarding the six points and has gone looking for the Stewards, chart in hand.` },
    // ── Brennig + Wick ───────────────────────────────────────────────────────
    { name: "Brennig Tamsin", knownBy: "Brennig Tamsin", body:
      `Quartermaster of the Lift Hall — crates, counts, cage schedule, and a desk made of two pallets and a door. The scar along his jaw is 'the mountain's receipt': he was the man on the table the Night the Mountain Coughed, stitched in the dark by Doc Greeley over in Allesh-Gilliam, and he has been politely refusing to die ever since. His brother is Father Tamsin of St Gilliam's, who visits more than any parish requires — guilt and love, in whichever order. Brennig knows which crates hum before touching them and keeps them away from the food, and that is not superstition, thank you.` },
    { name: "The Pilgrim of the Old Routes", knownBy: "Pilgrim Wick", body:
      `A devotional walker: St Gilliam's for the candles, Khezek Tor for the high shrines, the Vacancy for the bed. Pays exact. Keeps vigil rather than sleeping. Knows the switchbacks better than the shrine schedule strictly justifies, and smells faintly of candle wax in a town that burns tallow.` },
    { name: "Khezek Word — The Quiet Ones", knownBy: "all", body:
      `There are quiet ones in the upper galleries — not miners, not raiders. They pay their tolls in good coin, never take ore, and sing at the wrong hours in a working rhythm. Their packs go up the mountain full and come down empty. Management's policy is the coin's policy, and the miners' policy is the same as it is for Level Four: don't work near them alone, and don't ask what they're building, because they might answer.` },
    // ── miners' commons per outcome ──────────────────────────────────────────
    { name: "Khezek Word — The Breach Sealed", knownBy: "all", after: B.seal, body:
      `Word round the galleries: the Stewards paid to seal the deep breach out of their own banks. Output dipped, nobody died, and the mountain sits easier. Miners don't hand out thanks. They hand out nods, and the Stewards are getting nods.` },
    { name: "Khezek Word — The Cough", knownBy: "all", after: B.exploit, body:
      `Output doubled and everyone knows what it cost: the compound cough, bed to bed, and the Brace leaning a day closer. The ledgers look beautiful. Nobody underground says the word 'beautiful' anymore without a particular look.` },
    { name: "Khezek Word — The Quiet That Isn't", knownBy: "all", after: B.open, body:
      `They opened the deep all the way. It's quiet down there now — the kind of quiet that's a presence, not an absence. Nobody works below Four, by order and by unanimous private agreement, and the night shift has started leaving a lamp burning at the head of the sink. Nobody assigned that. It just seemed polite.` },
    { name: "Khezek Word — Crates With Manners", knownBy: "all", after: B.std, body:
      `Every Yesodium crate ships under sacred handling now — slower, calmer, no more soured dreams riding out with the ore. The haulers grumbled for a week and then stopped, because the dreams stopped first.` },
    { name: "Khezek Word — These Ones Get Mines", knownBy: "all", after: B.rite, body:
      `The Stewards fixed the humming shipments with a rite — puppets, if you can believe it — and the stone got the vibe. Word went round the galleries in one shift: these ones actually get mines. That's not a small thing to say about surface folk.` },
    { name: "Khezek Word — The Ledgers Never Looked Better", knownBy: "all", after: B.ign, body:
      `The humming crates keep rolling and the ledgers have never looked better. Some haulers got sick. Everyone noticed which order those two facts arrive in when management tells it.` },
    // ── consequence pages ────────────────────────────────────────────────────
    { name: "The Sink Is Becoming a Door", knownBy: "all", after: B.sink, body:
      `Sable Nine's charts say it and now the watch confirms it: the opened sink below Level Four is wider, rounder, deliberate — a doorway taking its time. And through it, on the clearest watch: a garden of stone figures, facing away. They have not turned around. The lamp at the head of the sink burns all night now, and nobody jokes at the Maw the way they used to.` },
    { name: "The Compound Cough Has a Road", knownBy: "all", after: B.cough, body:
      `The cough that came with doubled output has a name, a bed count, and a road: over the ridge to the Waiting Room in Allesh-Gilliam, where Doc Greeley stitches, listens, and keeps a folder labeled OWED. Calder's chalk has the same names. The mountain's bill is being carried by lungs, and everyone knows which decision signed for it.` },
    { name: "The Brace Cleared Its Throat", knownBy: "all", after: B.groan, body:
      `Third shift heard it: a sound out of the Brace like a hull remembering the sea. It held — but Calder walked the span with chalk after, and his marks are closer together than they've ever been. 'The mountain clearing its throat,' he said. Everyone underground finished the thought privately and nobody said it out loud.` },
    // ── cross-arc ────────────────────────────────────────────────────────────
    { name: "Mara — Where the Extra Stability Came From", knownBy: "Mara Quickhands", after: B.exploit, body:
      `The Allesh-Gilliam Leygate's footings are shored with Khezek surplus — good ore, generous tonnage, suspiciously well-priced. Mara knows exactly where the extra stability came from, and what it's costing the miners' lungs to provide. It goes in the Ledger under debts the coalition owes DOWNWARD — the kind polite societies forget and the Jackalopes don't.` },
    { name: "Greeley — The OWED Folder", knownBy: "Doc Vess Greeley", after: B.cough, body:
      `The Khezek miners started arriving the month output doubled — the Compound Cough, bed to bed, worst cases sent over the ridge to her good light. Greeley stitches, listens, and files each chart in a folder labeled OWED in her tidy prescription hand. She has not yet decided who owes. She is taking careful notes toward the answer, and the bar hears everything.` }
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
  console.log(`[seed-khezek-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Khezek dossier: ${banner} (see console)`);
})();
