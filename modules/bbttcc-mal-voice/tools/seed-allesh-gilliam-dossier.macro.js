/* seed-allesh-gilliam-dossier.macro.js — the front door's knowledge layer (2026-07-04)
 *
 * World Dossier pages for the Allesh-Gilliam treatment: the Misfire canon
 * ("the Night the Mountain Coughed"), the four hub NPCs' knowledge + @after
 * ladders, the four NEW townsfolk (Greeley/Verna/Plumb/Brakk — dormant-by-design
 * until their actors are minted), and the two new places as common knowledge.
 * Q&A-leaf text (Pike's convo_1..4, Tamsin's 1..4) retires INTO these pages —
 * the live AI performs it from knowledge instead of firing beats.
 *
 * DRY_RUN default true; existing pages skipped unless ALLOW_OVERWRITE. Run as GM.
 * Companion: bbttcc-campaign/tools/seed-allesh-gilliam-treatment.macro.js
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const ALLOW_OVERWRITE = false;
  const JOURNAL_NAME = "World Dossier";
  const Q = { stabilizer: "quest_bSwOIWzxqNBwJ5NM", seal: "quest_AL1aIXiljxPUBH2e", militia: "quest_ag_town_militia" };

  const PAGES = [
    // ── the Misfire canon ──────────────────────────────────────────────────
    { name: "The Night the Mountain Coughed", knownBy: "all", body:
      `Everyone in Allesh-Gilliam counts from the same bad night. The Leygate flickered — people trusted yesterday's report over the live signal, and people died for it. The East Wall started leaning before morning. And out under Khezek Tor, something shifted that nobody has a good word for, so folk just say the mountain coughed. Three wounds, one night. Nobody has proven they're connected. Nobody believes they aren't.` },
    { name: "What the Cough Was", knownBy: "all", after: `${Q.seal}:completed`, body:
      `It's out now: the Night the Mountain Coughed was the old Valhaulan seal under Khezek Tor misfiring. The gate flicker, the East Wall's lean — symptoms, both of them, of a containment older than the town shrugging in its sleep. The Stewards went down and answered the seal question, whichever way they answered it, and the town got to stop arguing about ghosts. The Architect has not issued a correction. The wall, notably, has.` },
    { name: "The New Stewards Took Charge", knownBy: "all", body:
      `The new Stewards came in on a Jackalope transport, and Avuncular Joan herself handed them the keys — a fortress, a farm, and a hole in the ground, her words. Then she left for Coraliindra through the Leygate, which is labeled EMERGENCIES ONLY, so draw your own conclusions about how big a deal this was. Her advice on the way out: don't try to save everything at once, start by keeping one promise. The town is watching to see which promise they pick.` },

    // ── hub NPCs (knowledge absorbs the retired Q&A leaves) ────────────────
    { name: "Marshal Yarrow Pike", knownBy: "Yarrow Pike", body:
      `Runs the HQ in the old S'narchy Burger and measures everything, including people. The gate flicker is personal: they believed the previous report instead of the current signal — belief killed timing — and he was supposed to hold a gate once, and it failed, or he failed it, depending how history gets written. The East Wall section bows inward since the Night the Mountain Coughed; Plumb surveyed it three days BEFORE and still calls it cosmetic on the strength of a survey older than the damage. Pike has done that math and does not like it. On the Stewards: unproven, which is neutral. His advice to anyone trying to earn a town: pick something visible, finish it, no speeches. He is privately here to watch one promise actually hold — just one, clean, no hedging. After that, maybe he goes quiet.` },
    { name: "Pike — The Wall Was Fixed", knownBy: "Yarrow Pike", after: "beat:allesh_gilliam_east_wall_success", body:
      `The new Stewards took the East Wall seriously and fixed it clean — no theater, proper work. One visible promise, finished, witnessed. Pike lends patience now. Not trust yet. Patience.` },
    { name: "Pike — The Wall Attempt Failed", knownBy: "Yarrow Pike", after: "beat:allesh_gilliam_east_wall_failure", body:
      `The Stewards took a swing at the East Wall and it went wide. The section still bows. Pike is not surprised, which everyone agrees is worse than angry. Filed under: unproven — still neutral, barely.` },
    { name: "Pike — A Promise Held", knownBy: "Yarrow Pike", after: `${Q.stabilizer}:completed`, body:
      `The Leygate has a working stabilizer in it. It remembers right. Pike stood at the readout longer than he needed to, watching a promise hold all the way through for the first time since his gate. He's gone quieter since — the kind of quiet he told people he was waiting for.` },
    { name: "Father Tamsin", knownBy: "Father Tamsin", body:
      `Keeps St Gilliam's — candles for use, not ceremony; a bed-and-breakfast in the back; a chair where nobody is measured. On Khezek Tor: it feeds the town and asks for more than it admits; the mountain isn't angry, it's tired, and fatigue is worse than anger. What forgiveness would look like: less noise, fewer rushed decisions, more gratitude — the mountain wants to not be extracted like an enemy. Why he stays: because leaving is easier, and that's all he gives. His echo he tells freely: he was a healer, and one night he chose who to save, told himself there wasn't enough mercy to go around. There was. He is here to never withhold comfort again, and to see if the mountain can forgive.` },
    { name: "Etta Bloom", knownBy: "Etta Bloom", body:
      `The Long Market is hers the way weather belongs to the sky — closest thing Allesh-Gilliam has to a mayor, which is not very close, and exactly how she likes it. A Menhirkin, robed, matronly, forgiving you in advance. What she knows and most don't: the coastal bunker is no vault — it's a pre-Shattering containment sink, infrastructure-grade, and the Valhaulans have been inside it three cycles, long enough to call it their Rightful Sacred Battle-Bassinet. Their seal is directional and it is facing OUTWARD. Khezek Tor has had unusual containment audits; Valhaulans sighted in its upper tunnels — quiet, technical, not raiding, which is not their usual hymn. Her echo: she was a treasurer, and she balanced something that wasn't meant to balance — she moved consequence, not money — and she is here to watch it come due, and to make sure it lands where it teaches the right lesson. She also knows about old mistakes buried nearby. Best to ask before someone else does.` },
    { name: "Etta — The Stewards Know", knownBy: "Etta Bloom", after: "beat:allesh_gilliam_etta_bloom_convo_exit", body:
      `She told them the whole shape of it — Valhaulans in the sink, the seal turned outward, the hum — and pressed the sigil into their hands with the arithmetic attached: restore, redirect, or break. Now she's watching which of the three doors they walk through, and adjusting inventory accordingly.` },

    // ── the new townsfolk (dormant until actors are minted) ────────────────
    { name: "Doc Vess Greeley", knownBy: "Doc Vess Greeley", body:
      `Barkeep at the Waiting Room, and the town's only surgeon — in that order, now. Pours like she's writing prescriptions, knows everyone's blood type and everyone's tab, and treats both as medical records. The back room stays spotless and shut; nobody jokes in there. Her echo: she was mid-surgery the Night the Mountain Coughed, finished the stitch in the dark by feel, and the patient lived — but she'd already decided, in the dark, whose life she'd have chosen if it came to it. She's here to never have to choose again. She and Father Tamsin do not talk about the thing they do not talk about, and everyone knows they don't.` },
    { name: "Verna Tulliver", knownBy: "Verna Tulliver", body:
      `Runs the Vacancy — the motel whose sign has never been wrong. Sweet as pie and counts everything: guests in, guests out, spoons, lies. Remembers every name she's ever heard, including the fake ones — especially the fake ones; those get a little star in the ledger. Her echo: she kept a boarding house before the Shattering; the night everything ended she had nine guests, and when the world came back she had eight, and no one — including the eight — could remember who the ninth was. The ledger page is still there, a name that can't be read. She is here to never lose count again.` },
    { name: "Aldous Plumb", knownBy: "Aldous Plumb", body:
      `Structural Authority (self-certified, framed) with an office in the water tower's base, walls covered in drawings of the town that are all slightly, confidently wrong. He surveyed the East Wall three days before the Night the Mountain Coughed and will not re-survey it, because a second survey would imply something about the first, and the first survey was correct. The wall is cosmetic. He can see it leaning from his window. His echo, which he does not tell: he built a thing once that held for thirty years and failed in one night, and he has been re-drawing it from memory ever since, looking for the line where he lied to the land.` },
    { name: "Captain Ondine Brakk", knownBy: "Captain Ondine Brakk", body:
      `The only professional soldier in a town of enthusiastic amateurs. Runs the Muster out of the gutted fire station by the North Gate — one truck that doesn't run, one bell that does, correct order of priorities. Drills wall rotations out of farmers, teamsters, and one extremely committed teenager. Opinion of the Stewards: they made the militia necessary and possible in the same afternoon, which she respects and resents at the same volume.` },

    // ── places + institutions as common knowledge ──────────────────────────
    { name: "The Waiting Room", knownBy: "all", body:
      `The bar. It's the old medical clinic and the sign still says WAITING ROOM because it's never needed changing. Doc Greeley pours, stitches, and hears everything; the town's rumors go there to metabolize. There's one room in back kept spotless where nobody jokes. Scratched into the counter: everyone ends up in the Waiting Room eventually.` },
    { name: "The Vacancy", knownBy: "all", body:
      `The motel by the wall's elbow. Sign's said VACANCY longer than anyone's been alive to argue, and it's never once been wrong. Rooms have names, not numbers. Verna Tulliver runs it, counts everything, and knows who passed through town before they've finished passing. If you want to know who's been on the roads, buy a room or buy her tea.` },
    { name: "The Town Militia", knownBy: "all", after: Q.militia, body:
      `Allesh-Gilliam has a militia now — founded, depending who tells it, either the day the Stewards showed mercy to a pack of bandits or the day the town decided mercy needs backup. Captain Brakk runs drills out of the old fire station. The bell works. Attendance is better than anyone predicted, which says something about how safe everybody actually felt before.` }
  ];

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  let journal = game.journal.getName(JOURNAL_NAME) || game.journal.contents.find(j => j.name === JOURNAL_NAME);
  const report = [];
  if (!journal) {
    report.push(`journal "${JOURNAL_NAME}": CREATE`);
    if (!DRY_RUN) journal = await JournalEntry.create({ name: JOURNAL_NAME });
  } else report.push(`journal "${JOURNAL_NAME}": exists`);

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
  console.log(`[seed-ag-dossier] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`Allesh-Gilliam dossier: ${banner} (see console)`);
})();
