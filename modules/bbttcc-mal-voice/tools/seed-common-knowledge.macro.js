/* seed-common-knowledge.macro.js — the River Heart's shared knowledge (2026-07-03)
 *
 * Creates the "NPC Common Knowledge" journal (the name the npcCommonJournal
 * setting already points at — it was never created!) with 15 pages distilled
 * from the world-lore journals (~/Downloads/journals_for_npc_dialog): every
 * NPC knows ALL of it, folk-knowledge register. ALSO adds 3 identity pages to
 * the World Dossier so the newcomer Stewards arrive ALREADY KNOWN:
 *   The Avuncular Order (all) · The Newcomer Stewards (all) ·
 *   The Jackalopes — why we test them (faction-private).
 *
 * DRY_RUN default true. Existing pages skipped unless ALLOW_OVERWRITE.
 * Reopen NPC dialogue windows afterward. Run as GM.
 */
(async () => {
  const DRY_RUN = false;
  const ALLOW_OVERWRITE = false;

  const COMMON_JOURNAL = (() => {
    try { return String(game.settings.get("bbttcc-mal-voice", "npcCommonJournal") || "").trim() || "NPC Common Knowledge"; }
    catch (_e) { return "NPC Common Knowledge"; }
  })();
  const DOSSIER_JOURNAL = "World Dossier";

  const COMMON_PAGES = [
    { name: "The Setting", body: `The world broke, long ago. It used to be one whole thing, held together by something old folk call Adam Kadmon, but that came apart and reality shattered into the hexes we live in now. The pieces are still here, still full of people and old ruins, just not joined up the way they were. You'll see abandoned works, twisted land, strange magic. The world's not finished, but folk say it can still be mended.` },
    { name: "The Shattering", body: `They call it the Collapse, or the Shattering. Before it, the world was one connected place, cities and knowledge and life all bound together. Then something deep inside gave way, all at once, and reality tore apart. Whole regions vanished or drifted off; the land broke into the hexes on every map. Nobody truly knows what caused it. Communities clawed their way back, but the scars are everywhere, and the world never fully healed.` },
    { name: "Adam Kadmon", body: `Adam Kadmon was the great framework that once held reality together, older folk say, more than a machine or a living thing. Through it, imagination shaped matter and knowledge flowed like water. It was built on principles they call the Sephirot. When it broke, the hexes are what was left. Its traces linger still, in old ruins that work strangely, in leylines, in artifacts that answer thought. Mend enough of it, some believe, and it might wake again.` },
    { name: "The Great Work", body: `The long labor of mending the broken world is the Great Work. No one soul finishes it; it's the labor of whole generations, each doing their part. Folk stabilize dangerous hexes, rebuild ruined works, help communities, chase down lost knowledge, and push back the corruption that thrives in the wreckage. Not everyone agrees on how, and some would sooner exploit the chaos. But every mended hex leaves the world a little more whole.` },
    { name: "Darkness", body: `Where the broken world stays unstable, Darkness creeps in. It's not plain evil, folk say, but the corruption that grows when harmony fails, thriving on despair, suffering, and neglect. It doesn't destroy a place outright, it warps it, twisting land and creatures. And then there's radiation, the physical scars, poisoned ground and wild magic where the Collapse tore worst. Both make ruin, both can be pushed back by the Great Work.` },
    { name: "Leylines", body: `Leylines are the hidden currents of energy that once threaded the whole world together, letting far places share power. When Adam Kadmon shattered in the Collapse, the network broke: some lines vanished, others turned wild and dangerous. Where they run strong you find odd magic, strange weather, and old stone set in careful patterns. Ley Gates, if restored, let you cross great distance fast. Mending the lines is part of the Great Work.` },
    { name: "The Shattered Lenses", body: `Old folk say creation once flowed through ten holy Lenses, the Sephirot, set out like a Tree of Life, each shaping raw energy into one thing: wisdom, strength, mercy, harmony, and the rest. Together they kept the world balanced. When Adam Kadmon broke apart, the vessels burst and the lenses cracked, scattering their light. Now one lens rules a region while another's missing, which is why magic runs strange and each place has its own odd faith.` },
    { name: "Restoration", body: `They call it Tikkun: the old belief that even a shattered world can be mended. When the vessels burst, the light of creation didn't die, it scattered into sparks hidden in every broken fragment: a struggling village, old knowledge saved, a place still in balance, a soul that won't give up to despair. Gather and guard those sparks and the world heals a little. It's the work of many hands over lifetimes, and every mended piece pushes back the dark.` },
    { name: "The Harmonized Interior", body: `Beyond the frontier lie the settled lands of the Harmonized Interior, where the Great Work is mostly done: hexes named, orderly, safe. Not perfect, mind, just held together well enough. Newcomers hail from all over, the caretaking Avuncular Marches, the ledger-keeping Coalition states, the tunnel-dwelling Free Peoples of Underground Montana, the scholarly Sephirotic Enclaves, the trader Corridor Republics, and the lately-saved Reclaimed Edge.` },
    { name: "Ancestry Origins", body: `Since the Shattering cracked Yesod, the world stopped making the old peoples. Now folk are born from land, ruin, and story. You'll meet Menhirkin, walking stone that holds walls; Circuitborn, old machines grown into persons; Rustlanders from dead industry, scavengers and mechanics; Stormborn nomads who read weather and run the dangerous roads; and rarer sorts, horned Jackalopes, blood-hungry Chupacabras, and the Qliph-Scarred marked by corruption.` },
    { name: "Gods and Powers", body: `Folk here'll tell you the gods aren't lords above us — they're ideas made real by enough people believing. Somebody's got to hold the Concept of Rain so it don't leak, so we feed the gods attention and prayer, same as keeping the water running. Godhood's no birthright — it's a shift, like jury duty. You're chosen to carry a concept a while, then you're done. Coraliindra carries hers because she was picked, not born to it.` },
    { name: "The Coalitions — Who's Who", body: `The Avuncular Order are the good, competent folk under Avuncular Joans, set on fixing the world. The Attaccountants are number-witch war-shamans who weaponize statistics. Monodynamic Industries is a greedy war-empire under Mr. Monocle; keep your receipts and steer clear. The Threnadonians are aloof dragonriders under Jearagun who won't get involved. The Free Peoples of Underground Montana are humbled bunker lords turned allies under California Tennessee. The Church of We're Tired of Waiting are impatient believers under Simon Sirene. The Circuit Riders are earnest robots and a giant war-machine under Captain Robot. The Valhaulans are sky-pirate Vikings under Sklar Bjrornholt who rob, apologize, then resell your goods. The Tanneritos are nostalgic mall-rat skate punks — chill until they swarm. The Jackalopes are smuggler-traders moving goods through hidden tunnels, loved on the frontier.` },
    { name: "The Local Country", body: `This is the River Heart, hard country once called Texas. Out west the Barrens run empty — wind, thin grass, and folk who reckon nothing's yours for long. The Odaroloc River cuts through where it pleases, and towns cling to it from need. Allesh-Gilliam's the scrappy heart of things; Khezek Tor keeps the warehouses and does the complaining; quiet Lyrenn softens your arguments. Furrier's Fixit Farm and Port Kudzu run on Jackalope trade. Steer clear of the Polygon Forests, where maps turn to guesses, and Probably Beaumont, which only looks like a city.` },
    { name: "Who Are These People", body: `Nobody here comes from nowhere — they come from unfinished. When a place grows stable enough to hold a life, folk simply settle into it, drawn up out of the Great Storehouse where every unlived life waits its turn. They don't recall who they were, but they carry its trade and temper, and match the town that drew them — pious places draw the pious, broken ones the desperate. Let a place thrive and more arrive; let it break and they fade back to waiting.` },
    { name: "Yesodium", body: `Yesodium's the strange ore they pull from under Khezek Tor — metal that hasn't yet made up its mind what to be. A good smith can coax it into iron, steel, silver, gold, even arcane metals, though never into living things. Trouble is, it remembers being ore, and under hard stress it can slip back — a blade losing its edge mid-swing, armor going soft, a wall melting into nothing. If the main vein ever fails, they say every yesodic thing shudders at once.` }
  ];

  const DOSSIER_PAGES = [
    { name: "The Avuncular Order", knownBy: "all", after: null, body:
      `The Avuncular Order is the great good power of the age — inclusive, idealistic, and annoyingly competent, still functional after centuries of nonsense. Their Strategos Supreme, Avuncular Joans, radiates the kind of intentionality that seems to set hexes in order just by standing near her. Their hexes are the prettiest, their potlucks the best, and their patience with everyone else runs thin but never runs out. They carry the torch of fixing things together and actually mean it. It was the Order that brought the newcomer Stewards into Bad Eden to help with the Great Work — around the River Heart, that vouching carries real weight.` },
    { name: "The Newcomer Stewards", knownBy: "all", after: null, body:
      `Everyone in the River Heart knows the newcomer Stewards — the ones the Avuncular Order brought into Bad Eden to help mend this stretch of the world. They steward a young coalition of four banners: The Unmoved Movers, Circuitous Roots, the Shadow Rats (the Mūs Umbral), and The Yips. They're new to the land but not strangers; the Order's vouching arrived ahead of them, and word travels fast on Jackalope routes. Folk greet them by reputation rather than asking who they are, watch what they do with the trust, and reckon the region's fortunes may ride on it.` },
    { name: "The Jackalopes — why we test them", knownBy: "faction:The Jackalopes", after: null, body:
      `The family is on friendly terms with the newcomers' coalition and with the Avuncular Order that vouched for them — Jackalope runners helped bring them this far. But a Jackalope doesn't hand trust to a reputation; we test the person. The Weeping Prisoner rite, the hard bargaining at the Counter — none of it is malice. It's how the family finds out who somebody is when the pressure's on: whether they deal fair, bully, dither, or walk away. What they do goes in the Ledger, and the Ledger decides what the Farm owes them and what it doesn't. Vouched-for means worth testing; it doesn't mean tested already.` }
  ];

  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const report = [];
  let created = 0, updated = 0, skipped = 0;

  const seedJournal = async (journalName, pages, contentFor) => {
    let journal = game.journal.getName(journalName) || game.journal.contents.find(j => j.name === journalName);
    if (!journal) {
      report.push(`journal "${journalName}": CREATE`);
      if (!DRY_RUN) journal = await JournalEntry.create({ name: journalName });
    } else report.push(`journal "${journalName}": exists`);
    for (const p of pages) {
      const existing = journal?.pages?.contents?.find(pg => pg.name === p.name);
      if (existing && !ALLOW_OVERWRITE) { report.push(`  page "${p.name}": exists — SKIPPED`); skipped++; continue; }
      if (existing) {
        report.push(`  page "${p.name}": UPDATE`); updated++;
        if (!DRY_RUN) await existing.update({ "text.content": contentFor(p), "text.format": 1 });
      } else {
        report.push(`  page "${p.name}": CREATE`); created++;
        if (!DRY_RUN && journal) await journal.createEmbeddedDocuments("JournalEntryPage", [{ name: p.name, type: "text", text: { content: contentFor(p), format: 1 } }]);
      }
    }
  };

  await seedJournal(COMMON_JOURNAL, COMMON_PAGES, (p) => `<p>${p.body}</p>`);
  await seedJournal(DOSSIER_JOURNAL, DOSSIER_PAGES, (p) => {
    const tags = [`<p>@knownBy: ${p.knownBy}</p>`];
    if (p.after) tags.push(`<p>@after: ${p.after}</p>`);
    return tags.join("\n") + "\n<p>" + p.body + "</p>";
  });

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-common-knowledge] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  console.log(`[seed-common-knowledge] totals: create=${created} update=${updated} skip=${skipped}`);
  ui.notifications.info(`Common-knowledge seeder: ${banner} create=${created} update=${updated} skip=${skipped} (see console)`);
  if (!DRY_RUN) console.log("[seed-common-knowledge] Reopen NPC dialogue windows. Spot-check: greet Mara cold — she should already know who you are.");
})();
