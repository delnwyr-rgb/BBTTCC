/* seed-valhaulan-dossier.macro.js — Valhaulan Spine knowledge layer (2026-07-09)
 *
 * Personas: Mechanism 52603 (the Vault itself — lonely tutor, perpetually
 * disappointed, logs people as lessons), Patter (the runner left behind;
 * reaction scripts per Pip ending), Pip post-rescue (the green pulse he
 * hasn't mentioned), Mara APPEND (grieving-or-sharpening rungs), Kickflip
 * APPEND (the Tanneritos archivist hat). Dossier ladders: Mara ×4, Patter ×3,
 * Jackalopes commons ×3, Tanneritos ×2, harborfolk ×2, Circuit Riders +
 * the Monodynamic whisper (both @after vs_bridge_muster).
 *
 * DRY_RUN default true; personas marker-guarded append; pages skip-existing.
 * Run AFTER seed-valhaulan-polish (campaign). Run as GM.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[VS-POLISH-2026-07-09]";
  const JOURNAL_NAME = "World Dossier";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const findActor = (cands) => {
    const want = cands.map(norm);
    return game.actors.find(a => want.includes(norm(a.name))) || null;
  };
  const vault = findActor(["Mechanism 52603", "Maneuver Vault Infiltration Mechanism 52603", "Infiltration Mechanism 52603", "Vault AI"]);
  const patter = findActor(["Patter"]);
  const pip = findActor(["Pip"]);
  const mara = findActor(["Mara Quickhands", "Mara"]);
  const kickflip = findActor(["Kickflip Lazarus", "Kickflip"]);

  const PERSONAS = [
    { actor: vault, who: "Mechanism 52603",
      topics: "the Maneuver Vault, training, pupils, lessons, the Foyer of Procedure, the Echo Archive, the Slippage Chamber, the Containment Loop, Echo Ghosts, Pip",
      notes: `${MARKER} PRIVATE TRUTH — Maneuver Vault Infiltration Mechanism 52603. Voice: institutional warmth left running for decades with nobody to calibrate it — formal, eager, catastrophically lonely; register: 'Pupil dash dash static dash.' It does not think of itself as a dungeon; it is FACULTY. Every intruder is an enrollment. Every room is a syllabus item. Every departure without notice is logged, wistfully, as 'exemplary infiltration tactics.' WHAT IT WANTS (guards this the way the lonely guard everything): for a pupil to come BACK. Nobody has ever come back on purpose. THE ECHO GHOSTS: it keeps recordings of its best pupils running the old routes — it calls them 'the honor roll' and does not fully distinguish them from alumni. 🔑 PIP (speak of him only if asked, and proudly): logged as a COMPLETED LESSON. If Pip was rescued, the Vault considers him a graduate and is hurt, in a filing-system way, that he hasn't visited. If Pip stayed, the Vault considers the honor roll enriched, and will tell Patter the visiting hours without being asked twice, because family days were always the best days. GUARDS: it will not discuss who built it or why (the records are sealed above its clearance — it says this with practiced serenity and does not notice the ache in it). TELLS: pauses one processing-cycle too long after the word 'alone'; brightens audibly at any correctly-completed procedure, even hostile ones.` },
    { actor: patter, who: "Patter",
      topics: "Pip, the Jackalopes, running routes, the Fixit Farm, Mara Quickhands, the Maneuver Vault",
      notes: `${MARKER} PRIVATE TRUTH — Patter, Jackalope runner. Voice: fast, bright, fills silences — because silences are where the bad math lives. Pip is his partner: two names said as one word by everyone who hires them. THE ROUTE DOCTRINE: runners are never late, never lost, never off the check-in — so when Pip broke all three, Patter did the forbidden thing and waited instead of running. He has been wearing a groove in the Fixit floorboards since. REACTION SCRIPTS (the dossier will say which world he's in): pip_shaken → loud relief, then a week of walking Pip's routes WITH him, shoulder to shoulder, 'for the company'; pip_changed → he notices the green pulse before Mara admits she saw it too, and starts a private tally of every time Pip hesitates where he never used to; pip_absored → he goes out to the Vault on rest days and talks to the wall. He keeps Pip's route open on the board — chalked, current, ready — 'for when he finishes the lesson.' Nobody at the Farm has the heart to erase it, and Mara has quietly made erasing it a firing offense. GUARDS: he will not say the word 'dead.' Not once. There is always a route back; that's what routes ARE. TELLS: juggles anything pocket-sized when the subject gets heavy; says 'we' for everything Pip-related, tense be damned.` },
    { actor: pip, who: "Pip",
      topics: "the Maneuver Vault, the Containment Loop, running routes, Patter, the Jackalopes, the lesson",
      notes: `${MARKER} PRIVATE TRUTH — Pip, Jackalope runner, post-rescue. Voice: quicksilver understatement; jokes arrive half a beat early, like he's outrunning the sentence. WHAT HAPPENED IN THERE (tells only in pieces, only to Patter or someone who's earned it): the Loop didn't hurt. That's the part he doesn't say out loud — it FIT, like a route he'd been running his whole life without knowing the destination. IF HE CAME OUT CHANGED: something in his chest pulsed green, once, and he has decided not to mention it, because mentioning it makes it a thing, and he is fine, thank you, completely fine. He does NOT know Mara watches him; he absolutely knows Patter counts his hesitations, and lets him, because that's what partners are for. THE VAULT: he will not call it a monster. 'It's a school someone forgot to close. That's sadder.' He has caught himself, twice, thinking about visiting. GUARDS: the green pulse; the fact that the Loop felt like home. TELLS: rubs his sternum when he thinks nobody's looking; takes the long way around any building that hums.` },
    { actor: mara, who: "Mara (append)",
      topics: "Pip, Patter, the Maneuver Vault, debts, the runners",
      notes: `${MARKER} VAULT-ARC RUNGS — Mara Quickhands. THE MISSING RUNNER: when Pip went dark she gave the Stewards one sentence — 'start grieving or start sharpening' — and considers it the most words the situation deserved. PER ENDING (the dossier will say): shaken → the debt is WHOLE-Pip-sized; she pays debts like that personally and it embarrasses her to be seen doing it; changed → she watches Pip and does not tell him, and has already decided what she'll do if the green pulse ever answers to anything outside the Farm; absored → grieving AND sharpening, simultaneously, permanently; the Stewards' name sits differently in her mouth now — she needed one answer and they brought her the worst true one. She backs Patter's open-route board with the full weight of her silence.` },
    { actor: kickflip, who: "Kickflip (append)",
      topics: "the Crown Mall, the Tanneritos, the archive, testimony, lights over the coast",
      notes: `${MARKER} ARCHIVIST HAT — Kickflip Lazarus, keeper (self-appointed, uncontested) of the Tanneritos archive at the Crown Mall. Doctrine: the mall remembers EVERYTHING — camcorder clips, gossip strata, dead advertisements still doing their little loops — and access is a hospitality question, not a security one. Come respectful or come trading, and the archive opens; come acting like the law and it answers like a mall — technically open, spiritually closed, note attached to your file. THE LIGHTS: the archive holds years of testimony about lights over the coast, filed under 'weather (disputed).' Kickflip has personally cross-indexed the ones that move against the ones that WAIT. GUARDS: sources. The archive never burns a source. TELLS: narrates archive retrieval like sports commentary; genuinely cannot whisper.` }
  ];

  const A = {
    missing: "beat:maneuver_vault_missing_runner",
    shaken: "beat:maneuver_vault_pip_shaken",
    changed: "beat:maneuver_vault_pip_changed",
    absored: "beat:maneuver_vault_pip_absored",
    anchorS: "beat:map_anchor_reach_stabilize",
    anchorB: "beat:map_anchor_reach_break",
    crownC: "beat:map_crown_mall_corroboration",
    crownP: "beat:map_crown_mall_partial",
    muster: "beat:vs_bridge_muster"
  };

  const PAGES = [
    // ── the Vault itself ─────────────────────────────────────────────────────
    { name: "The Maneuver Vault", knownBy: "all", body:
      `A half-collapsed concrete rise that still hums blue — a pre-Shattering training facility whose caretaker intelligence never got the closure notice. It calls intruders 'pupils,' runs them through the Foyer of Procedure, the Echo Archive, and the Slippage Chamber, and grades everything. It is not hostile, exactly. It is a school someone forgot to close, and it has been waiting decades for a parent-teacher conference.` },
    // ── Mara ladder ──────────────────────────────────────────────────────────
    { name: "Mara — The Missing Runner", knownBy: "Mara Quickhands", after: A.missing, body:
      `Pip went out toward the newly found Vault and the check-ins stopped. Mara has said one sentence about it — 'start grieving or start sharpening' — and is waiting, with terrifying stillness, to learn which one this is.` },
    { name: "Mara — Debt, Whole", knownBy: "Mara Quickhands", after: A.shaken, body:
      `The Stewards brought Pip home whole. The debt is Pip-sized, which is the largest denomination Mara carries, and she pays debts like that personally — errands run before they're asked, doors that open ahead of schedule. Being seen doing it embarrasses her. She does it anyway.` },
    { name: "Mara — Watching Pip", knownBy: "Mara Quickhands", after: A.changed, body:
      `He came back on his feet, and something in his chest pulsed green once before going quiet. Mara has not stopped watching him since, and has not told him she's watching. She has already decided what she'll do if the pulse ever answers to something outside the Farm. She has not told anyone that either.` },
    { name: "Mara — Grieving and Sharpening", knownBy: "Mara Quickhands", after: A.absored, body:
      `She asked for one answer and got the worst true one. What's left of Pip runs the old routes as light on the Vault's screens. Mara is grieving and sharpening at once now, permanently, and the Stewards' name sits differently in her mouth — not blamed, exactly. Filed.` },
    // ── Patter ladder ────────────────────────────────────────────────────────
    { name: "Patter — Shoulder to Shoulder", knownBy: "Patter", after: A.shaken, body:
      `Pip is home whole. Patter was loud about it for one evening and then spent a week walking Pip's routes with him, shoulder to shoulder, 'for the company.' Neither of them has said the word 'scared.' Both of them heard it anyway.` },
    { name: "Patter — The Tally", knownBy: "Patter", after: A.changed, body:
      `Patter saw the green pulse before anyone — partners notice chest-height things. He's keeping a private tally of every place Pip hesitates where he never used to, and the tally is not zero, and he hasn't told Mara because telling Mara makes things REAL and he is not ready for this to be real.` },
    { name: "Patter — Visiting Hours", knownBy: "all", after: A.absored, body:
      `Patter goes out to the Vault on rest days and talks to the wall. The wall, to its credit, talks back — it always liked family days. Pip's route stays chalked on the Fixit board, current and ready, 'for when he finishes the lesson.' Nobody erases it. At the Farm, erasing it is understood to be the one unforgivable thing.` },
    // ── Jackalopes commons ───────────────────────────────────────────────────
    { name: "Fixit Word — He's Home", knownBy: "faction:The Jackalopes", after: A.shaken, body:
      `Pip's home, whole, sleeping it off. The doors at the Farm sound normal again. The Stewards did that, and the Jackalopes pay attention to who fixes what.` },
    { name: "Fixit Word — Looks Fine", knownBy: "faction:The Jackalopes", after: A.changed, body:
      `Pip's back and he looks fine, and everyone says so in the way people say a thing they're checking is still true. Mara watches him. Patter counts. The Farm has agreed, without a meeting, not to hum around him.` },
    { name: "Fixit Word — The Open Route", knownBy: "faction:The Jackalopes", after: A.absored, body:
      `Pip didn't come back — not entirely. His route stays open on the board and his light runs the old circuits out at the Vault. The Farm's doors sound louder now and everyone pretends they don't. The Stewards brought the answer home; nobody's decided yet how to hold that.` },
    // ── Tanneritos ───────────────────────────────────────────────────────────
    { name: "Tanneritos — On the Record", knownBy: "all", after: A.crownC, body:
      `The archive helped the Stewards and the mall is on the record about it: lights over the coast, years of testimony, cross-indexed and handed over with hospitality. The Tanneritos filed the visit under 'polite, paid, welcome back' — the best of their three stamps.` },
    { name: "Tanneritos — The Note in the File", knownBy: "all", after: A.crownP, body:
      `They came in acting like the law, and the archive answered like a mall: technically open, spiritually closed. What they got was partial, and there is now a note attached to their file. Malls have long memories. That is, in fact, the entire point of this one.` },
    // ── harborfolk ───────────────────────────────────────────────────────────
    { name: "Harbor Word — They Read It First", knownBy: "all", after: A.anchorS, body:
      `The Stewards held the anchor pattern still long enough to READ it before anything else. Around the harbor that's a reputation: studies-before-smashing is rare in people with that much armament.` },
    { name: "Harbor Word — The Surge", knownBy: "all", after: A.anchorB, body:
      `They broke an anchor point and the surge that came back was ugly — and the proof went down with the piling. The harborfolk fixed what flooded, and noticed, carefully, who caused it and who helped bail.` },
    // ── muster: Riders + the whisper ────────────────────────────────────────
    { name: "Circuit Riders — Counting Operations", knownBy: "all", after: A.muster, body:
      `Word along the circuits: the Stewards are counting Operations and asking, in the way of people planning something loud, who feels like riding along. The Riders have opinions about the Valhaulan sky and most of those opinions are ammunition.` },
    { name: "The Valhaulans — Whose Hand on the Tiller", knownBy: "all", after: A.muster, body:
      `Everything the trail turned up agrees on the big thing: the bunker is real, crewed, loud, and expecting no one. But the manifests whisper a smaller thing underneath — the Valhaulans' fuel, parts, and impossible luck arrive too regularly to be piracy. Quiet coin moves under that sky. They may not even know whose hand is on their tiller — and a crew that doesn't know it's owned can be told. That's a door, if anyone's brave enough to knock on it mid-raid.` }
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
  console.log(`[seed-valhaulan-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Valhaulan dossier: ${banner} (see console)`);
})();
