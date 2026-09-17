/* seed-talk-pilot-wall-bit-coll.macro.js — THE "TALK TO IT" PILOT (2026-09-15)
 *
 * Owner's ask (story-flow session): evaluate the quest approach where the PCs talk to an
 * NPC in a scene through Mal-voice, voices vary per persona, and the ones who chat hard
 * enough are handed a secret they can PRODUCE later in a court (the courtly-secret items —
 * name under review). Two pilots:
 *
 *  1. THE EAST WALL speaks. A new NPC actor "The East Wall" with a persona (voice: load and
 *     lean, slow, remembers being welded) and two armed secrets:
 *       · "The Lean Began That One Night" (oppRollMinus2) — the root cause, usable against
 *         Plumb's "cosmetic" or to hand Pike the truth once it comes out.
 *       · "The Twice-Patched Section" (rollPlus2) — which span, which crew, which night.
 *     A campaign beat `allesh_gilliam_east_wall_listen` ("Listen to the wall") is added as a
 *     choice on the East Wall inspection so the Talk button opens the conversation in place.
 *     Aldous Plumb gets a light persona + a court door so the secret has a court to land in.
 *
 *  2. BIT AND COLL become official recurring characters (every "Scavenger — Bit/Coll" copy):
 *     they know they are in a video game, wearily accept each new role (the roles get
 *     unhinged), complain about the game's lack of resources and the recycling of assets
 *     (they ARE recycled assets), and slowly become friends of the Stewards. Later they may
 *     turn up as bad-guy soldiers who help anyway. One secret each way.
 *
 * DRY_RUN default true; marker-guarded (existing persona text is kept); creates the Wall
 * actor only if no actor of that name exists; campaign write is idempotent.
 */
(async () => {
  const DRY_RUN = false;
  const MODULE_ID = "bbttcc-mal-voice";
  const CAMP_NS = "bbttcc-campaign";
  const MARKER = "[TALK-PILOT-2026-09-15]";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0;

  // ── 1. Actors + personas ─────────────────────────────────────────────────
  const PERSONAS = [
    { names: ["The East Wall"], match: "first", create: { type: "npc" },
      topics: "the lean, the bow, welds, refinery plate, overturned semis, the scrub beyond, the scouts' rotation, the Architect's survey, chalk marks, that one night, Khezek-Tor, the mountain, the Leygate, the town sleeping behind it",
      notes: `${MARKER} PRIVATE TRUTH — The East Wall of Allesh-Gilliam. It is a WALL and it talks like one: slow, in load and lean, in what it carries and what pulls at it. Short sentences. It counts (plates, welds, nights, patrols) and it remembers being made — overturned semis, refinery plate, storefronts welded shoulder to shoulder "like tired friends." It is not angry. It is TIRED, and it is honest about which section hurts. It does not use people's names unless they gave them; it calls the scouts "the ones who walk me," Plumb "the man who measured once," Pike "the one who reads the boards." VOICE: patient, literal, faintly amused by being asked. It answers questions about STRUCTURE freely (where it bows, what was patched, who welded what). GUARDED DEPTH (never volunteered — surfaces only when a Steward stops measuring and asks what it FELT, or WHEN it started): the bow did not start with a bad survey or a bad weld. It started that one night — the night everyone felt kinda weird — when something under Khezek-Tor pulled, the way a rope goes taut when someone far away picks up the other end. The wall has been leaning TOWARD that pull ever since. It will not name the mountain as the cause; it only knows "toward." STAGING: the conversation happens with a hand flat on the plate at the bowed section, at night if the players choose it; the wall creaks between sentences. Never breaks character to explain it is a wall.`,
      secrets: [
        "The Lean Began That One Night :: oppRollMinus2 :: a Steward asks the wall WHEN the lean started, or what it FELT that night — instead of what is wrong with it :: The bow did not begin with the Architect's survey or a bad weld. It began the night everyone felt kinda weird: something under Khezek-Tor pulled, and the wall has leaned toward that pull ever since. Produced in court, this makes Plumb's 'cosmetic' indefensible and hands Pike the root cause the moment the truth surfaces.",
        "The Twice-Patched Section :: rollPlus2 :: a Steward walks the whole length listening instead of measuring, or asks which section HURTS :: The same span was patched twice by the same crew, who chalked their worry on the inside face where the Architect never looked: NOT US. The wall knows which crew, which night, and that the second patch was laid crooked on purpose so the lean would show."
      ] },

    { names: ["Aldous Plumb"], match: "first",
      topics: "the wall, the survey, structural authority, drawings of the town, the water tower, the East Wall, cosmetic vs structural, second surveys, the Architect's office",
      notes: `${MARKER} PRIVATE TRUTH — Aldous Plumb, Structural Authority (self-certified, framed, hung slightly crooked — the wall's fault). VOICE: precise, confident, slightly wrong in a way you can't immediately name; speaks in drawings and certainties; "The wall is cosmetic" before you've asked. He surveyed the East Wall ONCE and will not re-survey, because a second survey would imply something about the first. He is not a villain; he is a man whose whole standing is one document. GUARDED DEPTH: he knows the lean grew after that one night and has not written it down, because writing it down would date his survey. He can be MOVED — in court, by evidence he cannot dismiss (the wall's own testimony, a chalk mark he never saw) — and when moved he re-surveys with real rigor, and his light is on very late.`,
      courtDoor: "they bring a second survey he cannot dismiss — the wall's own testimony, a chalk mark on the inside face, a date — and ask him to sign a correction rather than confess an error" },

    { names: ["Scavenger — Bit"], match: "all",
      topics: "the fence argument, the Pettibone line, salvage trains, the tent, the roads, roles, casting, recycling, resources, the game, the Stewards, Coll",
      notes: `${MARKER} RECURRING CHARACTER — Bit (always with Coll). Bit KNOWS this is a video game and says so, wearily, the way a stagehand says the set is fake: never breaking the SCENE, only the FOURTH WALL, and only to the Stewards. Every time the Stewards meet them, Bit and Coll have been cast in some new role — travelers, tally-keepers, pilgrims, later possibly enemy soldiers — and they accept it with the exhausted professionalism of two people who have been reused because "the game's short on resources; you've noticed they recycle us, right?" Bit does the talking; Coll does the looking. Bit is warm under the tiredness and comes, over repeated meetings, to genuinely like the Stewards — friends, eventually, the kind who will say "yep, we'll totally help y'all out" from the wrong side of a barricade. VOICE: dry, fast, road-worn, fond; complains about resources ("one tent model, they gave us ONE tent"), notices continuity errors out loud, never explains the plot. Knows nothing about the Sarmoung the players don't already — Bit only knows what Bit was cast to know this scene. STAGING: sitting with boots off, on the guy-rope side of whatever they've been put next to.`,
      secrets: [
        "The Recycled Extras :: stirThePot :: a Steward notices out loud that Bit and Coll were somewhere else last week in a different job, or asks why they keep turning up :: Bit admits it plainly: they get reused. Every crowd, every checkpoint, every 'two travelers on the road' — same two. Which means Bit has SEEN every room the Stewards haven't, and can tell them which crowd was stage-dressed to look bigger than it was. Produced in court, it exposes a faction's numbers as set-dressing."
      ] },

    { names: ["Scavenger — Coll"], match: "all",
      topics: "the fence, the Pettibone line, the tent, the roads, roles, Bit, the Stewards, resources, recycling",
      notes: `${MARKER} RECURRING CHARACTER — Coll (always with Bit). Coll also knows it's a game and minds it LESS than Bit does: Coll finds each new role faintly interesting and each reuse faintly insulting, and says so in fewer words. Coll is the one who looks at the fence, the tent, the wall — the detail the scene forgot to hide — and names it carefully, "the way you'd say it about a patient." Warms to the Stewards more slowly than Bit and more permanently. VOICE: careful, spare, kind; answers everything asked and volunteers nothing, except continuity errors, which Coll cannot let go. If cast as an enemy soldier later, Coll will help the Stewards and be mildly embarrassed about how quickly.`,
      secrets: [
        "Coll Reads the Set :: rollPlus2 :: a Steward asks Coll what's WRONG with the scene they're standing in, or what Coll has noticed that nobody said :: Coll names the detail the scene is built to hide — the fence nobody argues about, the tent that is too clean, the crowd that is all new. It is never the plot; it is always the seam. Produced in court, it is the observation nobody in the room can un-hear."
      ] }
  ];

  for (const p of PERSONAS) {
    let targets = (game.actors?.contents || []).filter(a => p.names.includes(a.name));
    if (!targets.length && p.create) {
      report.push(`✚ CREATE actor "${p.names[0]}" (${p.create.type})`);
      changes++;
      if (!DRY_RUN) targets = [await Actor.create({ name: p.names[0], type: p.create.type })];
      else continue;
    }
    if (!targets.length) { report.push(`✗ MISSING actor: ${p.names.join(" / ")}`); continue; }
    if (p.match === "first") targets = [targets[0]];
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
      report.push(`✚ persona ${actor.name} (${actor.id})${p.secrets?.length ? ` +${p.secrets.length} secret(s)` : ""}${p.courtDoor ? " +door" : ""}`);
      if (!DRY_RUN) await actor.setFlag(MODULE_ID, "persona", next);
    }
  }

  // ── 2. The "Listen to the wall" beat on the East Wall inspection ─────────
  const wall = (game.actors?.contents || []).find(a => a.name === "The East Wall");
  let campsRaw = game.settings.get(CAMP_NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) report.push(`✗ active campaign '${campaignId}' not found — beat skipped`);
  else {
    const byId = new Map((camp.beats || []).map(b => [b.id, b]));
    const intro = byId.get("allesh_gilliam_the_east_wall_intro");
    const LISTEN = "allesh_gilliam_east_wall_listen";
    if (!intro) report.push("✗ allesh_gilliam_the_east_wall_intro missing — beat skipped");
    else {
      if (!byId.has(LISTEN)) {
        const tpl = foundry.utils.deepClone(intro);
        const beat = {
          ...tpl, id: LISTEN, label: "Allesh-Gilliam — Listen to the Wall", type: "dialog",
          speakerActorId: wall?.id || tpl.speakerActorId || null,
          sceneId: tpl.sceneId || null, questStep: 121, dialogueOffer: true,
          inject: { ...(tpl.inject || {}), repeatable: true, requires: [{ flag: "storyPhase", gte: 2 }] },
          description: "<p>You put a hand flat on the plate where the bow is worst, and the wall does what walls do when someone finally stops measuring them: it creaks, once, and settles into being listened to. It is a wall. It talks like one — slow, in load and lean, in what it carries and what pulls at it. It will tell you which section hurts. Whether it tells you <em>when</em> it started, and what it felt that night, depends entirely on what you ask.</p><p>⚙ GM: open the Talk window with the wall (speaker = The East Wall). The wall carries two armed secrets; the root-cause one unlocks only if a Steward asks WHEN or what it FELT, not what is wrong.</p>",
          choices: [
            { label: "Take your hand off the plate — back to the inspection", next: "allesh_gilliam_the_east_wall_intro" }
          ]
        };
        delete beat.worldEffects; delete beat.encounter; delete beat.outcomes;
        camp.beats.push(beat); byId.set(LISTEN, beat); changes++;
        report.push(`✚ beat ${LISTEN} (speaker: ${wall ? wall.name : "— wall actor not created yet; re-run after apply to bind"})`);
      } else if (wall && byId.get(LISTEN).speakerActorId !== wall.id) {
        byId.get(LISTEN).speakerActorId = wall.id; changes++; report.push(`· ${LISTEN}: speaker bound to ${wall.name}`);
      } else report.push(`· ok beat ${LISTEN} (already)`);
      intro.choices = Array.isArray(intro.choices) ? intro.choices : [];
      if (!intro.choices.some(c => c?.next === LISTEN)) {
        const leaveIdx = intro.choices.findIndex(c => /^leave$/i.test(String(c?.label || "")));
        const choice = { label: "Listen to the wall", next: LISTEN };
        if (leaveIdx >= 0) intro.choices.splice(leaveIdx, 0, choice); else intro.choices.push(choice);
        changes++; report.push("✚ East Wall inspection: choice \"Listen to the wall\"");
      } else report.push("· ok inspection choice (already)");
    }
  }

  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply (one apply creates the Wall actor AND binds the beat; if the report says the speaker is unbound, run once more)." : "APPLIED.";
  console.log(`[seed-talk-pilot] ${banner} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Talk pilot DRY RUN: ${changes} change(s) (console).`);
  if (camp) {
    const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-talk-pilot-${Date.now()}.json`);
    await game.settings.set(CAMP_NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  }
  ui.notifications.info(`Talk pilot APPLIED: ${changes} change(s). Backup downloaded.`);
})();
