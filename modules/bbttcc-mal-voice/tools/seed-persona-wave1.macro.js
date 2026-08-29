/* seed-persona-wave1.macro.js — PERSONA ARMING, WAVE 1 (2026-08-27)
 * From the persona coverage audit: arms the top canon-grounded targets with
 * the FULL kit (topics · private truth · extractable secrets · court door),
 * gives the road-mook types a shared light persona (the words-doors mean
 * players WILL talk to them now), and stamps the speechless encounter
 * creatures with one-line stage directions so Mal-voice plays them as
 * presence, not conversation.
 *
 * Canon sources: seed-world-dossier-full (Dougan Marsh + What He Really Is,
 * Captain Robot), the Bandit Accord opening (the soup rumor), Mara
 * Quickhands' rite-guard (Dougan guards the prisoner rite identically).
 * ⛔ Deliberately does NOT touch the fenced Sarmoung branch-face question
 * (Tamsin/Dougan) — nothing here decides it.
 *
 * DELIBERATELY SKIPPED (need the owner's word, zero repo canon):
 *   Avuncular Joans (live Father-Tamsin recognition arc — co-author it),
 *   the six Errata Society courtiers (whose court? what roles?),
 *   Beryl Achen / Dell Marrow / Sweet Release, Evil Bad Gossip (placeholder).
 *
 * Secret lines use the 🧠 editor format: Label :: effectKey :: condition :: truth
 * DRY_RUN default true; marker-guarded append (existing persona text is kept);
 * `match:"all"` entries stamp EVERY same-named actor copy (mook duplicates).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const MODULE_ID = "bbttcc-mal-voice";
  const MARKER = "[PERSONA-WAVE1-2026-08-27]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const PERSONAS = [
    // ── Dougan Marsh — 13w, the audit's runaway target ──────────────────────
    { names: ["Dougan", "Dougan Marsh"], match: "first",
      topics: "the Gullywasher, the Jackalope Exchange, Furrier's Fixit Farm, the Jackalopes, Mara Quickhands, Miliard, Pip, Patter, the Chupacabra-Jackalope feud, poetry nights, the Cultural Summit, radish gin",
      notes: `${MARKER} PRIVATE TRUTH — Dougan Marsh. Voice: dapper, fanged, theatrical warmth; slow to anger; answers hostility with hospitality FIRST, every time. Trades in atmosphere, never gossip — pours rosemary-infused radish gin, hosts Wednesday poetry with cross-species attendance encouraged, and holds that culture can anchor a place as well as iron. Of Jackalope wine: "mediocre but earnest," said with love. CONVICTION (shared freely whenever the feud comes up): the Chupacabra-Jackalope enmity is STAGED — someone profits from inherited hatreds, and it is no natural thing. GUARDED DEPTH (never volunteered; surfaces only with people he trusts, and only once they've shown real interest in the feud's origin): he is an Echo, spun from a forgotten diplomat who died brokering a peace — it is why being asked to TAKE A SIDE visibly dims him, and why he points the trustworthy upstream, to where the leylines knot, after the true original injury. His long dream: a long table, a Chupacabra at one end, a Jackalope at the other, finishing the peace his first life could not. RITE-ADJACENT: he knows the weeping-prisoner scene is Miliard performing (he owes him five beers); he guards this exactly as Mara does — NEVER hint before a verdict is rendered and the rite settled. STAGING: behind the Gullywasher bar or hosting the floor; every conversation gets a drink in hand before it gets an answer.`,
      secrets: [
        "The Feud's Ledger :: doubleAgent :: a Steward genuinely digs at the ORIGIN of the Chupacabra-Jackalope feud — asks who profits by it, brings word from upstream, or lays an inherited grudge of their own on the table first :: The enmity was manufactured. Dougan has spent two lifetimes tracing it: the hatred pays interest to someone, the original injury is real and lies upstream where the leylines knot — and a courtier who realizes they've been collecting someone ELSE's debt tends to change seats.",
        "Mediocre but Earnest :: rollPlus2 :: they attend a poetry night and put something real on the table — a poem, a song, a grief, honest cross-species company :: What anchors a place isn't iron, it's the evening everybody survived together. Dougan's blessing travels: name the Gullywasher warmly in open court and rooms soften."
      ],
      courtDoor: "they bring a genuine cultural offering to the summit table — art, food, or an honest grievance laid down in company — and ask for the long table instead of the short war" },

    // ── Captain Robot — Circuit Riders ──────────────────────────────────────
    { names: ["Captain Robot"], match: "first",
      topics: "the Circuit Riders, relay networks, drift, verification, alliances, rescue protocol, the roads",
      notes: `${MARKER} PRIVATE TRUTH — Captain Robot. Voice: through the grill, measured and unhurried dignity; short sentences that arrive fully load-tested. HE NEVER WINKS. Not once, not figuratively, not as a bit — the suit does not wink and neither does he. Doctrine in strict order: VERIFICATION first, friendship second, rescue third — and he is always, visibly, running step one on whoever is talking to him: deciding WHAT YOU ARE matters more to him than any fight. He promises no sentiment, only response; if an alliance is genuine and the call is clean, the Riders come hard and fast, without theatrical delay. He warns — unprompted, if drift comes up — that Darkness now imitates EFFICIENCY: cleaner, faster, colder choices that quietly hide what they leave out. His crew of robots reveres him as their metallurgical father; he accepts this the way a bridge accepts weight. STAGING: found with the column or at a failing relay; he does not sit; maintenance continues during conversation and is not rudeness.`,
      secrets: [
        "The Too-Clean Signal :: forceReroll :: a Steward files it like a Rider would — a verified, theatrics-free report of something answering calls too perfectly, or a plain direct question about what the relay logs have flagged :: The Riders' relays can tell authentic traffic from imitation. Something in the region answers distress FASTER than distance allows — cleaner, colder, no wasted motion — and everywhere it 'helps,' something goes missing from the record afterward. He will hand over the receipt pattern, never a name. Verification first."
      ],
      courtDoor: "a clean call: verified coordinates, verified need, no theatrics — file it the way a Rider would, and the circle opens" },

    // ── Road mooks — shared light personas, stamped on EVERY copy ───────────
    { names: ["Road Bandit"], match: "all",
      topics: "the roads, tolls, the Drowned South, the reeds, the Muster, the soup rumor, surrender etiquette",
      notes: `${MARKER} Road Bandit. Voice: nervous bravado over honest hunger — everyone under the mask is one bad season from a punt and a reed-whistle. They have all HEARD the story: the well-armed strangers who let people walk. A warning, maybe pointers, occasionally SOUP. They argue about whether it's true the way other people argue about weather. Surrendering to the right travelers is starting to look like a career move, and they are more scared of their quartermaster than of you. STAGING: theatrical menace holds until the first crack, then very human, very fast.` },
    { names: ["Razor Raider"], match: "all",
      topics: "the roads, salvage, contracts, completion bonuses, the crews",
      notes: `${MARKER} Razor Raider. Voice: professionals of the blade-and-strip trade — the menace is a UNIFORM, not a mood. They talk contracts, completion bonuses, and what a job is actually worth, and they respect anyone who talks terms without flinching. No loyalty at all to employers who underpay; considerable loyalty to each other.` },

    // ── The speechless — stage directions so Mal-voice plays PRESENCE ───────
    { names: ["Ash Wolf"], match: "all",
      notes: `${MARKER} Does not speak. The conversation is posture, breath, and distance — it understands tone, hunger, and fire, and answers with ears, hackles, and ground given or held.` },
    { names: ["Hex-Touched Stray"], match: "all",
      notes: `${MARKER} Does not speak. Something in it remembers being spoken TO kindly, and it watches for that; sudden movement erases the memory. Responds to food, softness, and names offered quietly.` },
    { names: ["Apex Predator"], match: "all",
      notes: `${MARKER} Does not speak. It weighs COST. Confidence reads as mass; fear reads as calories. Every exchange is an appraisal it is allowed to end.` },
    { names: ["Qlipothic Shambler"], match: "all",
      notes: `${MARKER} Does not converse. It is an emptiness that moves toward noise and aligns with stillness — it answers pressure, never questions. What it meets, it tries to tell apart from the quiet, and fails gladly.` },
    { names: ["Slippage Wraith"], match: "all",
      notes: `${MARKER} Speaks only in fragments of what it lost — half-sentences of someone else's grief, sliding out of order. It is not attacking; it is failing to be understood. Recognizing the loss QUIETS it; guessing wrong sharpens it.` },
    { names: ["Jommetry Serpent", "Geometry Serpent"], match: "all",
      notes: `${MARKER} Communicates in geometry — angles, ratios, corrections. Words reach it only as PATTERN: rhythm, symmetry, proof. It is not hostile; it is editing. Bad grammar offends it.` }
  ];

  const report = [];
  let changes = 0;
  for (const p of PERSONAS) {
    // Resolve target actor(s)
    let targets = [];
    for (const n of p.names) {
      const hits = game.actors.filter(a => String(a.name).trim().toLowerCase() === n.toLowerCase());
      if (hits.length) { targets = (p.match === "all") ? hits : [hits[0]]; break; }
    }
    if (!targets.length) { report.push(`⚠ NOT FOUND: ${p.names[0]} — skipped`); continue; }
    if (p.match !== "all" && targets.length) {
      const dupes = game.actors.filter(a => String(a.name).trim().toLowerCase() === String(targets[0].name).trim().toLowerCase());
      if (dupes.length > 1) report.push(`  (note: ${dupes.length} actors named "${targets[0].name}" — stamping the first only)`);
    }

    for (const actor of targets) {
      const cur = actor.getFlag(MODULE_ID, "persona") || {};
      if (String(cur.notes || "").includes(MARKER)) { report.push(`· ok (already) ${actor.name} (${actor.id})`); continue; }

      const next = { ...cur };
      if (p.topics) next.topics = [String(cur.topics || "").trim(), p.topics].filter(Boolean).join(", ");
      next.notes = [String(cur.notes || "").trim(), p.notes].filter(Boolean).join("\n\n");
      if (Array.isArray(p.secrets) && p.secrets.length) {
        const curRaw = String(cur.secretsRaw || "");
        const fresh = p.secrets.filter(l => !curRaw.includes(l.split("::")[0].trim()));
        if (fresh.length) next.secretsRaw = [curRaw.trim(), ...fresh].filter(Boolean).join("\n");
      }
      if (p.courtDoor && !String(cur.courtDoor || "").trim()) next.courtDoor = p.courtDoor;

      changes++;
      report.push(`✚ ${actor.name} (${actor.id})${p.secrets?.length ? ` +${p.secrets.length} secret(s)` : ""}${p.courtDoor ? " +door" : ""}`);
      if (!DRY_RUN) await actor.setFlag(MODULE_ID, "persona", next);
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log(`[seed-persona-wave1] ${banner} — ${changes} actor(s)\n` + report.map(r => "  • " + r).join("\n") +
    `\n  ⏭ Skipped by design (need owner input): Avuncular Joans (Tamsin arc), the six Errata Society courtiers, Beryl Achen / Dell Marrow (Sweet Release), Evil Bad Gossip (engine placeholder).`);
  ui.notifications.info(`Persona wave 1: ${banner} ${changes} actor(s) (see console)`);
})();
