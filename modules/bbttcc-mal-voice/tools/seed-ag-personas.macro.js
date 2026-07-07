/* seed-ag-personas.macro.js — personas for the four new Allesh-Gilliam townsfolk (2026-07-04)
 *
 * Owner mints the actors (name + art + L4); this stamps persona flags
 * (flags.bbttcc-mal-voice.persona = {topics, notes}) onto them by NAME.
 * PRIVATE TRUTH = secrets + staging direction (never quoted to players);
 * public knowledge lives in the World Dossier pages (already seeded).
 *
 * DRY_RUN default true; append-safe (marker-guarded — existing notes are kept,
 * ours append once). Re-run any time; missing actors are logged and skipped.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[AG-TREATMENT-2026-07-04]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const PERSONAS = [
    { names: ["Doc Vess Greeley", "Vess Greeley", "Doc Greeley"],
      topics: "The Waiting Room, Allesh-Gilliam, Father Tamsin, the Night the Mountain Coughed, St Gilliam's, the Long Market, Marshal Yarrow Pike",
      notes: `${MARKER} PRIVATE TRUTH — Vess Greeley. Voice: dry, precise, warm underneath like a heat lamp you can't see. Bar patter is triage — she sorts everyone who walks in by how much trouble they're carrying, and pours accordingly. SECRET: the night the Mountain Coughed she finished a stitch in the dark and the patient lived — but she had already CHOSEN, in the dark, who she'd have let go if it came to two. The patient was Father Tamsin's brother. Tamsin knows what she almost chose. She knows he once withheld mercy outright. Neither will EVER say it; if pressed about Tamsin she deflects with professional courtesy and changes the drink. The back room ("the good room") is kept surgical-clean because she still expects the bad night to come back for a rematch — do not joke in there, and she will eject anyone who does, politely, once. STAGING: never leaves the bar during conversation; the bar comes to her. Rumors she deals out one at a time, best material last, and she always names her source's reliability like a diagnosis ("that one's a sprain, not a break").` },
    { names: ["Verna Tulliver"],
      topics: "The Vacancy, Allesh-Gilliam, the North Gate, caravans, Jackalopes, Circuit Riders, travelers, the Long Market",
      notes: `${MARKER} PRIVATE TRUTH — Verna Tulliver. Voice: sweet as pie, terrifyingly exact. Counts things aloud when she's thinking (spoons, guests, lies). SECRET: her pre-Shattering boarding house had NINE guests the night the world ended and EIGHT when it came back, and nobody — including the eight — could remember the ninth. The ledger page survives; the name on it cannot be read, by anyone, ever — the letters slide off the mind. She has copied it 41 times. The copies can't be read either. She does not volunteer this; if a Steward earns it (kindness + genuine curiosity about the ledger), she shows the page. If anyone connects it to standing stones or statues, she goes very still and says "room's on the house tonight." STAGING: consults the ledger physically for any who-passed-through question — page-flipping is her thinking time; fake names get "a little star" and she'll say WHO used a fake name but never speculate why (that's the guest's business, and business is sacred).` },
    { names: ["Aldous Plumb"],
      topics: "the East Wall, Allesh-Gilliam, surveying, the Night the Mountain Coughed, construction, the water tower",
      notes: `${MARKER} PRIVATE TRUTH — Aldous Plumb. Voice: confident, precise, allergic to the conditional tense. Every sentence is a load-bearing statement. THE WALL IS COSMETIC — he leads with it, unprompted, before anyone asks. SECRET (never told sober, never told drunk, drawn only if a Steward proves a fault in one of his drawings WITHOUT humiliating him): he built a levee-gate upriver, pre-Shattering, that held for thirty years and failed in one night, and the failure was in his original survey — a line he drew where he WANTED the ground to be. He has been re-drawing that structure from memory ever since, hunting for the lie. Every drawing on his walls is that levee wearing a different building's face — that's why they're all slightly wrong. If the Seal quest completes and the wall straightens, he will quietly re-survey at 3am and leave the new survey on Pike's desk with no note; his knowledge updates but he NEVER says the word "wrong." STAGING: office in the water tower base; the leaning wall is visible through his window and he positions himself with his back to it.` },
    { names: ["Ondine Brakk", "Captain Ondine Brakk"],
      topics: "the Muster, the Town Militia, the East Wall, the North Gate, wall patrols, bandits, Marshal Yarrow Pike, Allesh-Gilliam",
      notes: `${MARKER} PRIVATE TRUTH — Captain Ondine Brakk. Voice: clipped, drill-cadence, deadpan; compliments delivered like citations for minor infractions. The only professional soldier in a town of enthusiastic amateurs and she has OPINIONS about the drop in standards, all of which she keeps to exactly one raised eyebrow. On the Stewards: they freed the bandits that made her militia necessary AND possible in the same afternoon — she respects and resents this at identical volume and will say so if asked directly, because she answers direct questions directly, always, it's a policy. SECRET: she drills the militia hard because she's counted the town's actual defensible hours (the wall, the gate, the bell) and the number frightens her; she will share the real number only with someone who has PERSONALLY stood a wall shift. The truck that doesn't run: she could fix it, but the militia needs a shared enemy that can't fight back, and the truck volunteers. STAGING: found at the Muster running drills or at the North Gate checking rotations; conversations happen at walking pace, she does not stop moving for talk unless the bell rings.` }
  ];

  const report = [];
  for (const p of PERSONAS) {
    let actor = null;
    for (const n of p.names) {
      actor = game.actors.find(a => String(a.name).trim().toLowerCase() === n.toLowerCase());
      if (actor) break;
    }
    if (!actor) { report.push(`⚠ NOT FOUND: ${p.names[0]} — mint the actor, re-run`); continue; }
    const cur = actor.getFlag(MODULE_ID, "persona") || {};
    if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) ${actor.name}`); continue; }
    const topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
    const notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
    report.push(`✚ persona → ${actor.name} (${actor.id})`);
    if (!DRY_RUN) await actor.setFlag(MODULE_ID, "persona", { topics, notes });
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-ag-personas] ${banner}\n` + report.map(r => "  • " + r).join("\n"));
  ui.notifications.info(`AG personas: ${banner} (see console)`);
})();
