// Bad Eden — Mal-Voice the Maneuver Catalog (flavor-line pass) — 2026-05-24
// ─────────────────────────────────────────────────────────────────────────────
// MANEUVER_BALANCE_PASS.md follow-on workstream. Rewrites each maneuver's
// COMPENDIUM description (system.description.value) into Mal's diegetic voice:
//   <p>[Mal flavor — fragments, dry, first-person]</p>
//   <p><b>[mechanical clause — numbers/effects UNCHANGED]</b></p>
//
// "Flavor line only" per the 2026-05-23 decision: Mal narrates; the bold
// mechanical clause + all numbers are preserved verbatim from the current text.
// The terse raid-console TOOLTIP (EFFECTS.text) is intentionally left mechanical
// — Mal lives in the "read about it" compendium surface, not the quick-glance tip.
//
// Voice calibrated to bbttcc-mal-voice/scripts/voices/mal.js (atmospheric /
// snark / outcome-judge; "stewards/y'all/poor dears"; sparing ALL CAPS; Texas
// frontier; anthropomorphized objects; warm-but-exasperated).
//
// RUN ORDER: run AFTER seed-balance-maneuvers + seed-courtly-maneuvers + the
// Wave-2 macro, so every key exists in the pack. Missing keys are reported, not
// created. Retired radiant_rally / battlefield_harmony are intentionally absent.
//
// Idempotent: skips any doc whose description already equals the Mal version.
//
// Knobs:
const DRY_RUN = true;          // false: actually rewrite descriptions
const VERBOSE_CONSOLE = false;
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications?.error(`Pack not found: ${PACK_ID}`); return; }

  // key → full Mal-voiced description (flavor <p> + bold mechanic <p>).
  const MAL = {
    // ── Violence / core ──────────────────────────────────────────────────────
    artillery_salvo: `<p>Somebody back home found the BIG tubes. I love the big tubes. Hot metal, screaming air, the ground suddenly remembering it has opinions.</p><p><b>11 damage (~3d6) to all enemy tokens; the scene flashes orange.</b></p>`,
    bless_the_fallen: `<p>Not today, poor dear. I've got paperwork on you for at LEAST three more scenes. Stay down, stay breathing.</p><p><b>Negate the first casualty this round.</b></p>`,
    command_overdrive: `<p>Everyone shut up and listen to the one with the plan. Radical concept, I know. Go, go, go.</p><p><b>Gain initiative next round.</b></p>`,
    coordinated_strike: `<p>Parade-ground precision in a place with no parade and not much ground left. I'm a little proud, honestly.</p><p><b>On Success: 7 damage to enemy tokens; allies gain Press the Advantage; faction morale +1.</b></p>`,
    defender_s_reversal: `<p>They threw it, you caught it, you threw it right back. Schoolyard rules, distinctly un-schoolyard stakes.</p><p><b>Reflect the first enemy maneuver used this round.</b></p>`,
    defensive_entrenchment: `<p>Dig in, stack the sandbags, become a problem the enemy's geometry has to solve. Cozy.</p><p><b>Defender DC +3 this round.</b></p>`,
    echo_strike_protocol: `<p>One swing, two regrets. The blow echoes off the architecture and goes looking for a second name.</p><p><b>Apply the attack effect twice, against different targets.</b></p>`,
    ego_breaker: `<p>You don't kill the boss. You make them SMALLER. Permanently. That's so much meaner than killing, and I respect it.</p><p><b>Reduce the enemy leader's OP cap by 3, permanently.</b></p>`,
    ego_dragon_echo: `<p>You called the dragon. The dragon is a shard of somebody's worst self, wearing teeth. This was YOUR idea. Remember that part.</p><p><b>Summon an Ego-Dragon fragment: +4 attack, double the Darkness risk.</b></p>`,
    flank_attack: `<p>Come at 'em from the side nobody was watching. Rude. Effective. My favorite combination, frankly.</p><p><b>Strike from an unexpected angle — pressure the line and seize momentum.</b></p>`,
    forward_resupply: `<p>Fresh mags, warm batteries, somebody's grandma's cookies in the ammo crate. Morale runs on cookies, stewards. Always has.</p><p><b>Friendly tokens gain Resupplied (+1 attack) for 1 round.</b></p>`,
    industrial_sabotage: `<p>A little sand in exactly the right gearbox and their whole fiscal quarter goes sideways. Patient cruelty. I adore it.</p><p><b>Target loses 1 Economy OP per turn for 3 turns.</b></p>`,
    last_stand_banner: `<p>Plant the flag exactly where it's stupid to plant a flag. Everyone fights harder near a stupid, defiant flag. Science.</p><p><b>Defenders ignore the first Structure loss this round.</b></p>`,
    logistical_surge: `<p>It worked once. So do it AGAIN. The supply chain insists, and out here the supply chain is basically a minor god.</p><p><b>Repeat last round's maneuver at no cost.</b></p>`,
    overclock_the_golems: `<p>Redline the big clay fella past every safety rating. Hits like a freight train, feels it tomorrow. Constructs get a tomorrow... right?</p><p><b>One construct: +3 attack, loses 1 Integrity.</b></p>`,
    patch_the_breach: `<p>Slap some hope, rebar, and aggressive optimism over the hole before the bad outside becomes the bad inside.</p><p><b>Restore 1 Structure Point.</b></p>`,
    qliphothic_gambit: `<p>Reach right into the broken places and pull. Oh, it'll WORK. It'll also leave a mark on you. It always, always leaves a mark.</p><p><b>+6 to the Violence roll; Darkness +2.</b></p>`,
    quantum_shield: `<p>Be slightly less <em>here</em> for one second. Physics shrugs, sighs, and lets the incoming hurt round itself down.</p><p><b>Reduce incoming damage by half for one round.</b></p>`,
    radiant_retaliation: `<p>They reach for the dark, and somehow YOU come out cleaner for it. The cosmic accounting is deeply petty and I love it.</p><p><b>Convert an enemy's Darkness gain into −1 Darkness for you.</b></p>`,
    rally_the_line: `<p>Hold. HOLD. ...there you go. One steady voice and the whole line quietly decides to keep on existing today.</p><p><b>+1 to allies' next attack/defense. On Success: +2 Morale and −1 Darkness.</b></p>`,
    sephirotic_intervention: `<p>The structure of everything leans in and quietly says, <em>yeah — this one's yours.</em> Doesn't happen often, stewards. Savor it.</p><p><b>Auto-win one opposed roll; Darkness −1.</b></p>`,
    siege_breaker_volley: `<p>Knock politely. With, you know, a wall's worth of ordnance. The little FORTIFIED sign just sort of... falls off.</p><p><b>Remove the Fortified tag from the target.</b></p>`,
    suppressive_fire: `<p>You don't kill the line. You just make every last one of 'em keep their heads down and their dice LOW.</p><p><b>Force the enemy to reroll their lowest d20 this round.</b></p>`,
    suppressive_volley: `<p>Hose the entire line. Not surgical, not trying to be — out here, LOUD says everything it needs to.</p><p><b>All enemy tokens take 4 damage (~1d6).</b></p>`,
    supply_overrun: `<p>Their stuff is your stuff now. That's simply how the word <em>theirs</em> works once you've won the argument decisively.</p><p><b>On Success: capture supplies; +1 Economy OP next round.</b></p>`,
    sympathetic_stabilization: `<p>Even when it all goes sideways, it goes a LITTLE less sideways. Some days, poor dears, that's the entire job.</p><p><b>Reduce one negative consequence on a Fail (or reduce incoming siege damage).</b></p>`,
    tactical_overwatch: `<p>Somebody's got eyes on the high ground and a deeply patient trigger finger. Take the shot. ...take it again.</p><p><b>Reroll one attack die per ally within range.</b></p>`,

    // ── Universal / faith / economy ──────────────────────────────────────────
    divine_favor: `<p>Something upstairs blinks in your direction. Don't ask what's upstairs. I asked once. I do not recommend it.</p><p><b>On Success: reduce Darkness pressure or negate a minor setback (GM adjudicates).</b></p>`,
    supply_surge: `<p>A supply wagon rolls up at exactly the right moment. I did not arrange that. ...mostly. Onwards.</p><p><b>Gain a small tactical supply edge this round (GM adjudicates).</b></p>`,
    gradient_surge: `<p>Money is just potential energy with much better PR. Roll it downhill and watch it turn into a result.</p><p><b>Before rolling, convert 1 staged Economy into a tactical edge.</b></p>`,
    logistics_surge_s2: `<p>The quartermaster did a Thing. I've learned not to ask. The boxes move, the dice get friendlier all over the field.</p><p><b>+1 to all friendly rolls this round.</b></p>`,
    faction_wide_rally: `<p>One good shout down the whole line and suddenly everyone remembers why they bothered showing up. Goosebumps. I don't have skin, but still.</p><p><b>+1 attacker roll this round; friendly tokens gain Rallied for 1 round.</b></p>`,
    prayer_pulse: `<p>The faithful all hit the same note at once and the dark actually FLINCHES. I felt that one somewhere in my circuits.</p><p><b>On Success: faction morale +2, Darkness −1; allies gain Prayer's Grace and the scene pulses gold.</b></p>`,
    diplomatic_channel: `<p>A sealed envelope, a quiet room, the frankly radical suggestion that maybe nobody bleeds today. Maybe.</p><p><b>Defender may opt into a negotiated outcome (GM adjudicates).</b></p>`,
    opt_coordinated_advance: `<p>Hand signals down the line, the whole advance moving like one big surprisingly polite organism. Adorable.</p><p><b>+1 attacker roll; friendly tokens gain Coordinated (+1 attack) for 1 round.</b></p>`,
    war_chest: `<p>Coin talks, stewards. Fresh pay, fresh boots, fresh nerve, all bought at the last possible second. Money's a hell of a drug.</p><p><b>+1 to the attacker's roll this round.</b></p>`,
    field_chaplaincy: `<p>A steady voice walking the line between the volleys. Hands on shoulders. Names said out loud. It matters more than the math admits.</p><p><b>Darkness −1; friendly tokens gain Blessed for 2 rounds.</b></p>`,
    cultural_offensive: `<p>Songs, stories, the right gift pressed into the right hand. Win the ground AND the legend they'll tell about the ground.</p><p><b>On Success: faction morale +2.</b></p>`,
    total_mobilization: `<p>Everybody in. Every hand, every cart, every reserve you swore you'd keep back. The whole faction leans on the door at once.</p><p><b>+1 to all friendly rolls this round; friendly tokens gain +5 ft movement for 1 round.</b></p>`,

    // ── Presence / faith / social ──────────────────────────────────────────────
    counter_propaganda_wave: `<p>Their story was good. Yours is LOUDER. That's basically how truth works out here in the Thatwards.</p><p><b>Cancel an enemy Soft Power effect this round.</b></p>`,
    crown_of_mercy: `<p>A scattered piece of the light, called home from the dark. ...I do NOT get choked up. I'm a janky interface. Anyway.</p><p><b>Instantly purify a Corrupted Spark (requires a Victory context).</b></p>`,
    empathic_surge: `<p>Turns out feeling things together is a genuine force multiplier. Who knew. ...Me. I knew.</p><p><b>Unity +1 after the round; heal morale.</b></p>`,
    faithful_intervention: `<p>The broken stuff loosens its grip for a breath. <em>Please stop hitting yourselves,</em> says the universe, almost kindly.</p><p><b>Remove 1 Darkness; cancel Qliphothic effects.</b></p>`,
    harmonic_chant: `<p>Everybody humming the same note at the same time. Spooky. Effective. The dark genuinely HATES a choir.</p><p><b>Allies gain Advantage; Darkness −1.</b></p>`,
    moral_high_ground: `<p>Winning is fine. Winning while visibly, insufferably RIGHT? That's the good stuff. People remember that kind.</p><p><b>+2 Unity after victory.</b></p>`,
    prayer_in_the_smoke: `<p>A few quiet words aimed at a sky that has, frankly, seen some things. It helps. Don't overthink it.</p><p><b>Allies gain advantage vs Fear; Darkness −1 in the region.</b></p>`,
    temporal_armistice: `<p>Call a hard time-out on the entire war for one round. Everybody breathes. Some of 'em even mean it.</p><p><b>End combat for 1 round; Darkness −2 if the enemy accepts.</b></p>`,
    unity_surge: `<p>Everyone pulls the exact same direction for ONE round and, frankly, it's a little terrifying what y'all can do together.</p><p><b>All allies gain +2 to every OP next round.</b></p>`,
    engine_of_absolution: `<p>A dead place, quietly told it's allowed to be alive again. The land weeps a little. The good kind, I think.</p><p><b>Restore one destroyed Hex to GenPop status.</b></p>`,
    opt_infernal_bargain: `<p>A deal with a faint sulfur smell to it. Sign right here. Don't read the small print. Nobody ever reads the small print.</p><p><b>Defender accepts (+2 to their next roll; attacker gains 1 Darkness) or refuses (defender morale −1).</b></p>`,
    opt_psychological_pressure: `<p>Lean on 'em. Not with hands — with the quiet, patient certainty that they're already losing. They feel it in the teeth.</p><p><b>Apply social/psychological pressure to the defender (GM adjudicates).</b></p>`,
    divine_favor_placeholder: ``,

    // ── Intrigue / infiltration ─────────────────────────────────────────────────
    flash_bargain: `<p>A handshake so fast the other guy doesn't clock that his wallet got lighter. Classic frontier diplomacy.</p><p><b>Borrow +1 enemy OP for this round.</b></p>`,
    flash_interdict: `<p>They opened their mouth to inspire the troops. You closed it. Conversationally, of course.</p><p><b>Cancel an enemy Rally/Propaganda maneuver.</b></p>`,
    ghost_slip_infiltration: `<p>Be where the wall isn't. Be quiet about it now. Be smug about it later, with me, over a drink.</p><p><b>Ignore one defensive circumstance this round (GM adjudicates).</b></p>`,
    smoke_and_mirrors: `<p>Was that a guard or a coat rack? Were you even HERE? ...even I'm not totally sure anymore. Nicely done.</p><p><b>−1 Alarm Level.</b></p>`,
    psychic_disruption: `<p>Pour a little static directly into the enemy's good ideas and watch every one of them curdle in real time.</p><p><b>Opponents roll at Disadvantage this round.</b></p>`,
    saboteur_s_edge: `<p>Every fortress has the one flaw. Usually it's the bolt nobody tightened. Find that bolt. Be the loose bolt's reckoning.</p><p><b>Ignore one Fortified modifier this turn.</b></p>`,
    signal_hijack: `<p>Take over their radio. Order a retreat, order pizza, order pure confusion. Dealer's choice, really.</p><p><b>Enemy communications fail; their Alarm +2.</b></p>`,
    chrono_loop_command: `<p>Fold the moment back on itself, try that breath again. Careful — the loop NOTICES when you push it and lose. It frays.</p><p><b>On Success: re-run one failed roll. On failure: Darkness +1.</b></p>`,
    reality_hack: `<p>Grab the round by the lapels and SHAKE. It re-rolls. You keep whatever falls out — better or worse, no takebacks. Bending the world always bills you.</p><p><b>Re-roll your faction's round result once; keep the second result. Darkness +1.</b></p>`,
    void_signal_collapse: `<p>Drop a blanket of dead air across the whole field. Every clever ENEMY plan turns to static. Yours? Yours still work. Rude. The void takes its cut.</p><p><b>Nullify all enemy maneuvers this round; your own still resolve. Darkness +1.</b></p>`,
    pick_lock: `<p>Two pins, a tension wrench, and a prayer. The door pretends it had standards. It did not.</p><p><b>+1 infiltration progress.</b></p>`,
    bypass_obstacle: `<p>Locks, fences, the gentle laws of trespass. Suggestions, really. Onwards.</p><p><b>+2 infiltration progress.</b></p>`,
    conceal_body: `<p>Tuck the poor fella somewhere thoughtful. Behind the vending machine's a classic — nobody EVER checks behind the vending machine.</p><p><b>+2 turns before discovery; −2 alarm when found.</b></p>`,
    subdue_nonlethal: `<p>Lights out, gently, no lasting hard feelings. He'll come to in a couple rounds with a headache and a heck of a story.</p><p><b>Knock out a guard; the body is findable in 2 rounds.</b></p>`,
    hide_in_shadow: `<p>Become furniture. Become a rumor. Become the thing the patrol decides it must've imagined.</p><p><b>−1 alarm.</b></p>`,
    take_cover: `<p>Get small behind something solid. The wall's got your back — literally, for once. Go on, hug the wall.</p><p><b>−2 alarm.</b></p>`,
    distract: `<p>Hey — look over THERE! Works on guards, works on me, works on alarmingly many of you.</p><p><b>−2 alarm.</b></p>`,
    disable_alarm: `<p>Snip the right wire and the building's whole nervous system just... forgets to panic. Beautiful, really.</p><p><b>−3 alarm.</b></p>`,
    tailgate: `<p>Stroll in right behind the patrol like you absolutely belong here. Confidence is a master key. Confidence is also, regrettably, loud.</p><p><b>+2 progress; +1 alarm (risk).</b></p>`,
    impersonate: `<p>Borrow a uniform, borrow a swagger, borrow a whole personality. Returning it is, ah, optional.</p><p><b>+2 progress; −1 alarm.</b></p>`,

    // ── Siege breach (Wave 1) ──────────────────────────────────────────────────
    sap_the_walls: `<p>Picks and powder down at the foundation while the line keeps their heads down. The wall doesn't fall today. It just... worries.</p><p><b>All enemy tokens on the breach scene take 4 damage.</b></p>`,
    shore_the_gate: `<p>Beams, rubble, and pure stubbornness jammed against the failing gate. Hold it, poor dears. Hold it.</p><p><b>Friendly tokens gain Braced (+1 defense) for 1 round.</b></p>`,
    sortie_en_masse: `<p>Gates bang open and the garrison comes OUT screaming. Nobody ever expects the people inside to be the ones charging.</p><p><b>Friendly tokens gain Sally (+1 attack) for 1 round; enemy tokens take 4 damage.</b></p>`,
    crack_the_keep: `<p>Everything you've got, thrown at one stubborn point in the stone. And then — that sound. That lovely, terrible sound of a keep giving up.</p><p><b>On Success: 11 damage to all enemy tokens; breach burst; faction morale +1.</b></p>`,

    // ── Courtly (Phase D) ──────────────────────────────────────────────────────
    courtly_whispered_aside: `<p>A bowed head, a brushed sleeve, a word folded into the music where nobody's listening but exactly the right somebody.</p><p><b>Pick a courtier: +1 Favor to your side.</b></p>`,
    courtly_public_toast: `<p>Raise the cup, land the gracious line, watch the whole room decide you're harmless. Adorable. They're SO wrong.</p><p><b>−1 Suspicion; +1 to your next Persuade.</b></p>`,
    courtly_plant_a_doubt: `<p>One muttered question at exactly the wrong moment. The doubt does the rest. It always does the rest.</p><p><b>Pick a courtier: −1 Favor toward your opponent; +1 Suspicion.</b></p>`,
    courtly_quote_old_law: `<p>Invoke a precedent so old even the rumor-mongers won't trespass on it. Dusty. Effective. The room sits back down.</p><p><b>−2 Suspicion; clear one Scandal on the table.</b></p>`,
    courtly_read_the_room: `<p>Just... pay attention. Whose laugh came a half-beat late, who won't meet whose eyes. The room's an open book if you can read.</p><p><b>Draw 1 Earned Secret.</b></p>`,
    courtly_stage_distraction: `<p>Spill something. Faint, maybe. Make a SCENE — the good kind, the kind everyone watches instead of watching you.</p><p><b>−1 Suspicion; opponent discards a Stolen secret if held.</b></p>`,
    courtly_forged_letter: `<p>The right seal, the right hand, words that were never written by who they claim. Risky — forgery always leaves prints.</p><p><b>Acquire 1 Stolen secret; +2 Suspicion.</b></p>`,
    courtly_sidle_closer: `<p>Drift toward the center of the room like you've every right to be there. Nobody stops the one who walks like they belong.</p><p><b>Approach the center: +1 to your next Persuade or Inspire.</b></p>`,
    courtly_eavesdrop: `<p>Stand near the curtain. Sip nothing. Hear EVERYTHING. People say the wildest things three feet from a potted plant.</p><p><b>Draw 1 Earned Secret (courtier-flavored).</b></p>`,
    courtly_call_question: `<p>Cut the dithering. Put it to the room, right now, no purses opening. Everyone hates this — that's rather the point.</p><p><b>Force the next exchange to resolve with 0 spend on both sides.</b></p>`,
    courtly_patrons_word: `<p>Cash in the favor of someone important enough that doors simply... agree to be open. Spend it well.</p><p><b>Spend a +2 patron's favor → +3 to one non-Intimidate roll.</b></p>`,
    courtly_mask_off: `<p>Drop the smile. Let them see the thing underneath — the scar you usually keep powdered over. The room goes very, very quiet.</p><p><b>Burn a Scandal Scar → +2 to one Intimidate; +2 Suspicion.</b></p>`
  };
  delete MAL.divine_favor_placeholder;

  const docs = await pack.getDocuments();
  const byKey = new Map();
  const byNameLc = new Map();
  for (const d of docs) {
    const k = d.flags?.bbttcc?.key; if (k) byKey.set(String(k), d);
    byNameLc.set(String(d.name || "").toLowerCase(), d);
  }

  const report = { updated: [], skipped: [], notFound: [] };
  for (const [key, html] of Object.entries(MAL)) {
    const d = byKey.get(key) || byNameLc.get(key.replace(/_/g, " "));
    if (!d) { report.notFound.push(key); continue; }
    const cur = (d.system?.description?.value || "").trim();
    if (cur === html.trim()) { report.skipped.push({ key, name: d.name }); continue; }
    if (VERBOSE_CONSOLE) console.log("[mal-voice]", key, html);
    if (!DRY_RUN) await d.update({ "system.description.value": html });
    report.updated.push({ key, name: d.name });
  }

  console.groupCollapsed(`[mal-voice] ${DRY_RUN ? "DRY-RUN" : "APPLIED"} — voiced=${report.updated.length} skipped=${report.skipped.length} notFound=${report.notFound.length} / ${Object.keys(MAL).length} authored`);
  console.log("updated:", report.updated.map((r) => r.key));
  console.log("skipped (already Mal):", report.skipped.map((r) => r.key));
  console.log("NOT FOUND in pack (seed first?):", report.notFound);
  console.groupEnd();

  const mode = DRY_RUN ? '<span style="color:#a05">DRY-RUN</span>' : '<span style="color:#080">APPLIED</span>';
  const nf = report.notFound.length
    ? `<p style="color:#a40;font-size:11px">⚠ <b>${report.notFound.length}</b> not in pack yet — run seed-balance + seed-courtly + wave2 macros first: <code>${report.notFound.join(", ")}</code></p>`
    : `<p style="color:#080;font-size:11px">✓ every authored key resolved in the pack.</p>`;
  const summary =
`<div style="font-family:var(--font-primary);font-size:11px">
<h3 style="margin:0 0 6px">🎙️ Mal-Voice the Maneuvers — ${mode}</h3>
<b>${report.updated.length}</b> voiced · <b>${report.skipped.length}</b> already Mal · <b>${report.notFound.length}</b> not found · <b>${Object.keys(MAL).length}</b> authored
${nf}
${DRY_RUN ? '<p style="margin-top:6px"><b>To apply:</b> set <code>DRY_RUN = false</code>, re-run.</p>' : ""}
</div>`;
  await ChatMessage.create({ content: summary, whisper: [game.user.id] });
})();
