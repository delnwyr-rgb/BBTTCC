/**
 * author-travel-encounter-stubs.macro.js — GM macro/console. DRY_RUN default true.
 *
 * The travel-table importer left 21 beats reading "Imported from Travel Table
 * entry. Set scene + checks here." (found 2026-08-26, owner: "Wilderness Push
 * has nothing going for it"). This macro authors them all in Mal's voice:
 *
 *  · 21 descriptions (only where the placeholder — or nothing — still stands;
 *    hand-authored text is NEVER touched, reported as skipped instead)
 *  · Wilderness Push gets the full Acid-Bog treatment: 3 checked choices +
 *    6 NEW outcome beats (created only if missing; sceneId copied from the
 *    live intro so outcomes stay on the map the owner just wired)
 *  · Qliphotic Whorl's 3 existing choices get checkStat/checkDC + in-voice
 *    choice descriptions (only filled where currently empty)
 *
 * Check lanes are op.* faction checks like the Acid Bog's; DCs follow the
 * Act-1 op ladder (12/16/20). Backup JSON downloads before any write.
 * NOTE: none of these have VO files yet — they are new recording candidates.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  const PLACEHOLDER = /^Imported from Travel Table entry/;
  const blankDesc = b => { const d = String(b?.description || "").trim(); return !d || PLACEHOLDER.test(d); };

  const setDesc = (id, text) => {
    const b = byId.get(id);
    if (!b) { report.push(`✗ missing beat ${id} — description not set`); return; }
    if (!blankDesc(b)) { report.push(`· ok (hand-authored, untouched) ${id}`); return; }
    b.description = text; changes++; report.push(`✚ desc ${id}`);
  };
  const setCheck = (id, idx, stat, dc, cdesc) => {
    const b = byId.get(id); const c = b?.choices?.[idx];
    if (!c) { report.push(`✗ ${id} choice[${idx}] missing — check not set`); return; }
    if (!String(c.checkStat || "").trim()) { c.checkStat = stat; c.checkDC = dc; changes++; report.push(`✚ check ${id}[${idx}] ${stat} DC ${dc}`); }
    else report.push(`· ok check ${id}[${idx}] (already ${c.checkStat})`);
    if (cdesc && !String(c.description || "").trim()) { c.description = cdesc; changes++; report.push(`✚ choice-desc ${id}[${idx}]`); }
  };

  /* ═══════════════ WILDERNESS PUSH — the full family ═══════════════ */
  const WP = "enc_wilderness_push";
  const wp = byId.get(WP);

  setDesc(WP, `The road just... stops being a road.

Not washed out. Not blocked. RECLAIMED. You can see asphalt for maybe twenty feet — after that it's root and briar and a guardrail that something has lovingly braided into a hedge. There's an overpass up ahead wearing a meadow.

And here's the fun part: it's moving. Not wind-moving. GROWING-moving. You can hear the pavement creak as the green pries it up, slab by slab, like the land taking its stuff back — and you're standing on the stuff.

Civilization borrowed this right-of-way. The lease just expired.

Decide fast — the road behind you is starting to look interested in itself too.`);

  const WP_OUT = [
    { id: "wilderness_push_outpace_success", label: "Wilderness Push - Outrun", desc: `You hit the green at speed and the green BLINKED.

Branches closed behind you like a zipper — you'll be picking thorn out of the undercarriage for a week — but you're through, intact, and the road ahead still remembers what it's for.

Do NOT tell anyone how close that was.

Tell them it was cool. It WAS cool.` },
    { id: "wilderness_push_outpace_fail", label: "Wilderness Push - Caught", desc: `The land is faster than your paperwork said.

A root the size of a water main comes up THROUGH the roadbed, and you leave behind... let's call it a donation. Paint. Cargo straps. A bumper the hedge is already wearing as jewelry.

You get out. The road doesn't.

Add a detour and some dignity to the bill.` },
    { id: "wilderness_push_old_road_success", label: "Wilderness Push - The Old Right-of-Way", desc: `There it is. Under all that triumphant green — a culvert line, a row of survey bolts, one dead-straight seam of concrete the roots politely refuse to eat.

You walk the skeleton of the old road while the new wilderness seethes on either side, close enough to touch and weirdly... respectful about it.

Infrastructure never dies, friends. It just goes quiet, and waits for somebody who can read.` },
    { id: "wilderness_push_old_road_fail", label: "Wilderness Push - Bad Map", desc: `The bones lie.

The culvert line dead-ends into a sinkhole full of the most self-satisfied ferns you've ever seen, and the "dead-straight seam" turns out to be the ghost of a fence, not a road.

By the time you've backtracked, the green has taken the way you came in, too.

It costs you hours. The land watches you pay every single one of them.` },
    { id: "wilderness_push_parley_success", label: "Wilderness Push - Safe Passage", desc: `You put down the offering, and the whole green... pauses.

No wind. No creak. Then the briars pull back from the roadbed — just wide enough for you, just long enough for you — like a curtain deciding you're worth the show.

Nobody is going to believe you. I barely believe you, and I WATCHED.

Say thank you on your way out. Out loud. I mean it.` },
    { id: "wilderness_push_parley_fail", label: "Wilderness Push - Declined", desc: `The land considers your offering.

The land keeps your offering.

The land does not otherwise change its position on pavement, or on you. The briars lean in slightly, in the manner of a creditor.

Walk away slow, and take the long way. You do not want to be interesting to it twice.` }
  ];

  if (wp) {
    // Outcome beats — created only if missing, on the intro's live scene.
    const baseStep = Number(wp.questStep || 530);
    WP_OUT.forEach((o, i) => {
      if (byId.get(o.id)) { report.push(`· ok beat (already) ${o.id}`); if (blankDesc(byId.get(o.id))) setDesc(o.id, o.desc); return; }
      const nb = {
        id: o.id, label: o.label, type: "outcome_trigger", description: o.desc,
        tags: "travel", questId: wp.questId || "quest_travel_encounters",
        questStep: baseStep + 1 + i, questRole: null, targetHexUuid: null, turnNumber: null,
        timeScale: "scene", politicalTags: "", outcomes: { success: null, failure: null },
        inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit" },
        actors: [], choices: [], encounter: { key: "", tier: null, actorName: "" },
        worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [] },
        cinematic: { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null },
        journal: { enabled: false, entryId: null, force: false },
        unlocks: { maneuvers: [], strategics: [] },
        timePoints: 0, sceneId: wp.sceneId || null, playerFacing: false,
        pacing: { ambient: true }
      };
      camp.beats.push(nb); byId.set(o.id, nb); changes++;
      report.push(`✚ beat ${o.id} (scene ${nb.sceneId ? "inherited" : "none"})`);
    });

    // Choices — only if the intro has none.
    if (!(wp.choices || []).some(c => (c?.label || "").trim())) {
      wp.choices = [
        { label: "Outpace the reclaim", next: "wilderness_push_outpace_success", failNext: "wilderness_push_outpace_fail",
          checkStat: "op.nonlethal", checkDC: 16,
          description: `Throttle open, heads down, straight through while there's still a through. The green is fast, but it's not rig-fast.

Probably.

Whatever you feel grabbing at the axles — DON'T. STOP.` },
        { label: "Read the bones of the old road", next: "wilderness_push_old_road_success", failNext: "wilderness_push_old_road_fail",
          checkStat: "op.logistics", checkDC: 12,
          description: `Every road is built on an older one. Survey stakes, culverts, the dead-straight line a buried conduit makes even under six feet of moss.

Find the skeleton. Walk its spine.` },
        { label: "Parley with the green", next: "wilderness_push_parley_success", failNext: "wilderness_push_parley_fail",
          checkStat: "op.faith", checkDC: 20,
          description: `Or... you could ask.

Put something down. Salt, seed, a little engine-blood. Tell the land you're just passing through and you didn't vote for the pavement.

I've seen it work once. I've seen it fail six times. The once was GORGEOUS.` }
      ];
      changes++; report.push(`✚ choices ${WP} (3, checked, wired to outcomes)`);
    } else report.push(`· ok choices ${WP} (already authored)`);
  } else report.push(`✗ ${WP} missing from live campaign — family skipped`);

  /* ═══════════════ QLIPHOTIC WHORL — prose onto the skeleton ═══════════════ */
  setDesc("enc_qliphotic_whorl", `Up ahead, the road does a thing roads should not do.

It turns. Then it turns again, same direction, tighter — and it keeps doing that, down into a spiral you cannot see the bottom of. And here's the part I need you to sit with: the LANDSCAPE goes with it. Trees. Fenceline. A silo, wound around itself like a wrung rag.

That's a Qliphotic Whorl — a place where the world's shell cracked, and what's left is draining in a circle around the hole. It isn't angry. It isn't hungry. It's EMPTY, which is worse, because empty PULLS.

Your compass is already lying to you. Decide before your sense of "forward" joins it.`);
  // Live choice order: [Go around, Diffuse the whorl, Move through the whorl]
  setCheck("enc_qliphotic_whorl", 0, "op.logistics", 12, `Respect the drain. Swing wide, keep the spiral in your peripheral vision and NEVER dead center, and re-check your bearings against something honest. Like the sun.`);
  setCheck("enc_qliphotic_whorl", 1, "op.faith", 20, `Shells crack outward, if you know where to press. Somebody in this outfit knows a word, a rite, a frequency.

Now's the time to be brave about it.`);
  setCheck("enc_qliphotic_whorl", 2, "op.nonlethal", 16, `The pull is a current, and currents can be swum. Rope everybody together, pick a point on the far side, and do not look down the middle.

I'm serious. Do NOT look down the middle.`);

  setDesc("enc_qliphotic_whorl_go_around", `Wide worked. The whorl stays in the corner of your eye the whole way — you can feel it politely suggesting a left turn, forever — but the sun stays honest, and so do you.

Behind you the spiral keeps winding, patient as a drain.

Somebody should map that thing. Somebody ELSE.`);
  setDesc("enc_qliphotic_whorl_go_around_fail", `The detour bends. Then the bend bends. Two hours in, you pass a fencepost you have DEFINITELY passed before, wearing your own tire tracks like a trophy.

The whorl didn't chase you. It didn't have to. It just borrowed your idea of "around" and spent it.

You get clear eventually — dizzy, late, and down whatever the road took as interest.`);
  setDesc("enc_qliphotic_whorl_diffuse_the_whorl", `The word lands. Or the rite, or the tone — whatever your brave one did, the spiral HITCHES, like a record skipping...

...and unwinds. One full turn backwards. Trees straighten. The silo un-wrings with a groan you'll be hearing in your sleep.

What's left is a sad bare patch of dirt and a hole that isn't a hole anymore. You didn't fill the empty — nobody fills the empty. But you taught it some manners, and out here that counts as a miracle with paperwork.`);
  setDesc("enc_qliphotic_whorl_diffuse_the_whorl_fail", `The word lands WRONG.

The spiral takes your working the way a drain takes a leaf — a little spin, a little flourish, gone. And for one long second the empty looks BACK up the rite at the one who spoke it, and every head in the outfit aches in the same key.

Back off. Now. It knows a shape it didn't know before, and the shape is yours.

Go around, go home, go anywhere that isn't a circle.`);
  setDesc("enc_qliphotic_whorl_move_through_the_whorl", `You rope up, pick your far point, and swim.

Halfway through, "forward" stops being a direction and becomes an ARGUMENT — but the rope holds, and your far point holds, and whoever anchored the line deserves the good rations tonight.

You come out the other side with every compass spinning and every soul accounted for. The whorl keeps draining behind you, unbothered.

It wasn't a fight. For a minute there, you were just weather to each other.`);
  setDesc("enc_qliphotic_whorl_move_through_the_whorl_fail", `Somebody looked down the middle.

I told— okay. Not the time. The rope snaps taut, three people go down pulling against a direction that doesn't exist, and for a while your whole outfit is a hand of cards being shuffled by nothing.

You drag each other out by stubbornness alone, minus some gear that is now orbiting a hole in the world.

Count heads. Twice. Then get gone — it liked the taste of your attention.`);

  /* ═══════════════ MONSTER INTROS ═══════════════ */
  setDesc("enc_qlipothic_shambler", `Something's coming up the road with the wrong kind of patience.

It was a person once. Person-SHAPED, anyway — that's what a Shambler is: the shell of a thing that stopped being a thing, but kept the outline out of habit. No hunger in it. No hate. Just a shape, walking, because walking is what the shape remembers.

Don't let the shuffle fool you. When it notices you — and it will, you're the most THING-like things for miles — it doesn't want your supplies.

It wants your certainty. And it takes that straight out of the middle of you.

Weapons out. Aim for the habit.`);

  setDesc("enc_slippage_wraith", `Stop. Listen.

Hear how the road's gone quiet in FRONT of you, but not behind? That's not silence. That's subtraction.

Slippage Wraith. It exists a half-step to the left of everything, and it drinks the part of you that keeps you HERE. People it touches don't fall down — they fade back, like a photo left in the sun, still smiling while the edges go.

I'll be straight with you: this one is above your pay grade and MINE. If you fight it, fight it in shifts, and don't let it linger on any one of you.

And if it starts to look familiar — like someone you knew? That's not a memory. That's bait.`);

  setDesc("enc_raider_raze_team", `Smoke line on the horizon, moving with intent. That's not a campfire — that's a SCHEDULE.

Raze team. Raiders with a work ethic, which is the worst kind. They don't want your cargo, they want the ROUTE: burn the culverts, drop the pylons, salt the crossing — and suddenly everybody pays THEIR toll on THEIR detour.

They've got tools, torches, and a foreman. You've got the misfortune of being between them and billable infrastructure.

They'll offer you "employment" first. It is not employment.

Fists up or throttle down — pick one NOW.`);

  setDesc("enc_desenitarius_maarg", `...

Okay. Change of plans. I need you to listen very carefully and make no loud sounds.

That, out there, is Desenitarius Maarg. Don't ask me what it is — the people who could answer stopped being available to answer things. It walks the old roads on its own calendar. It collects. Things, debts... I honestly don't know.

Every story about it agrees on exactly one point: the ones who showed respect got to keep telling stories.

So. Engines to idle. Weapons DOWN. Whatever it does, whatever it asks —

you be POLITE.`);

  setDesc("enc_mutant_wildlife_t3_outcomes", `Well. THAT happened.

That was not "wildlife" in the sense the word was invented for. That was a top-of-the-food-chain audit, and you were briefly a line item.

The dust's settling. Count limbs — yours AND the crew's — and let's get the official record straight while your hands are still shaking:`);

  setDesc("enc_rockslide_cinematic", `You hear it before you see it — a CRACK off the high ground, like the mountain clearing its throat.

Then the whole slope shrugs.

A thousand tons of scree and boulder and one very surprised pine tree come down across the road in a wave. The wave is still moving. And the road you are ON is downhill of ALL of it.

Go go go GO—`);

  /* ═══════════════ QUIET ROAD EVENTS ═══════════════ */
  setDesc("enc_scout_signs", `Hold up. See that?

Three stones stacked on a fencepost. Bent grass in a line that doesn't follow the wind. A cold firepit dug PROPER — drainage trench, smokeless setup, not one bootprint left behind by accident.

Somebody scouted this road. Recently, and professionally. They watched the crossing, counted something — traffic, patrols, maybe YOU — and moved on without wanting to be known.

Nothing here to fight. Plenty here to remember. Anyone who reads a road this well is worth knowing about before they know about you.

Log it and ride on. Eyes up at the next ridge line.`);

  setDesc("enc_scout_signs_valuable", `Same story as every scout sign — stacked stones, clean camp — except this scout left in a HURRY.

And they left their satchel.

Route notes. Watch rotations. A hand-drawn map with tolls and choke points marked in a tidy, paranoid little hand. The kind of intelligence people bleed for, sitting in the grass with dew on it.

Either your luck is beautiful, or somebody made sure their luck ran out. Both are worth thinking about.

Take it. Read it twice. And maybe wonder who, exactly, is missing a very good scout.`);

  setDesc("enc_spark_echo", `Whoa — feel that?

The air just went WARM. Not heat-warm. Hearth-warm. Like walking past a door where something good happened for a hundred years straight.

That's a Spark echo. Something holy burned bright here once — a rescue, a founding, somebody's finest hour — and the place is still humming the last bar of it. It can't hurt you. It isn't even really HERE. It's just the world, remembering out loud.

Stand in it for a second. Yes, that's an order. Out here you take the good ones where they land.

...Okay. Enough communion. Roads don't ride themselves.`);

  setDesc("enc_spark_echo_rare", `Everybody stop. Engines OFF.

That's not an echo. That's a NOTE — still sounding. There is a Spark fragment out here, a live coal of the world's first fire, sitting in the grass like it isn't the most valuable thing in a hundred miles.

The light doesn't cast shadows. Look. LOOK at that. Every shadow in this field just declined to show up for work.

I have exactly zero protocols for this. Approach it like a sleeping god, because the difference is academic. And whatever you decide to do — carry it, guard it, leave it be — do it like the world is watching.

Because the part of the world that MATTERS?

Is.`);

  setDesc("enc_supply_shortage", `Bad news travels in crates, and one of yours just delivered.

The water drum's been weeping through a seam since the last hard mile. The good rope's fused to itself. And somebody — I'm not naming names, the names know who they are — packed the SPARE fuel filter instead of the spare SPARE, which was, and I quote, "basically the same thing."

It is not basically the same thing.

Nothing out here is trying to kill you today. Today it's just arithmetic, and the arithmetic says the next stretch got longer while you weren't looking.

Tighten the belts, re-run the ledger, and be nicer to the quartermaster. They're all that stands between you and eating your boots.`);

  /* ═══════════════ POLITICAL ROAMERS ═══════════════ */
  setDesc("enc_border_incident_remote", `Flash on the horizon. Count with me... and there's the sound. That's ordnance, friends — four miles off, give or take. Somebody's border post is having the worst shift of its life.

Through the glass: two banners you can't quite make out, a watchtower leaning like it's had news, and little running shapes doing the oldest dance there is.

Here's the thing about OTHER people's incidents: they have gravity. Survivors need rides. Victors need witnesses. And everyone involved is about to be very interested in who was on this road with a clear line of sight.

You're not in it. You're just NEAR it — which out here is a genre of decision all its own.

Ride on, ride wide, or ride TOWARD. But pick before somebody's spotter picks for you.`);

  setDesc("enc_faction_parley_roaming", `Now THERE'S a parade you don't see twice a season.

Two columns coming up the road under truce banners — actual white-and-signal-orange, by the book — meeting at the crossing like it's neutral ground. Which, as of about ninety seconds ago, it IS. A roaming parley makes its own borders, and you, congratulations, are inside them.

Honor guards. A table. Somebody brought a TABLECLOTH. This is diplomacy in its Sunday clothes, and every gun on both sides is pointed politely at the sky.

Parley law is simple: no arms drawn, no fast moves, and everything you see is a thing you SAW — which makes you a witness, an opportunity, or a complication.

Hats off, speeds down. History is in session, and it does NOT like hecklers.`);

  /* ═══════════════ report + write ═══════════════ */
  console.log(`[author-travel-encounter-stubs] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Stub-author DRY RUN: ${changes} change(s) (see console). Set DRY_RUN=false to apply.`);

  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-stub-author-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Travel-encounter stubs authored: ${changes} change(s). Mal sends his regards.`);
})();
