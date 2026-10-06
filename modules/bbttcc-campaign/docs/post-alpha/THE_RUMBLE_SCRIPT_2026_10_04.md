# THE RUMBLE — "Everybody Calm Down" (draft 1, 2026-10-04)
*A new site in the Chuckle Creek shape: a hex so big it counts as several, full of warlords in monster trucks who need to be calmed down. Built on the chase primitive. Has nothing to do with the Circuit Riders: no Riders, no Dennis, no classification, different region. Read it in ten minutes and rule on the §Rulings list at the bottom. Nothing gets seeded until you do.*

---

## What the Rumble is

Halloween night, 2077. The Tri-County Fairgrounds were hosting the **Monster Truck Halloween Spooktacular**: forty trucks, eight thousand people in costume, and a PA announcer named Buck Delacroix with the loudest voice in East Texas. When the sky went white, Buck did what announcers do. He took the mic and shouted, *"FOLKS, NOBODY STOP TILL YOU'RE PAST THE COUNTY LINE!"* Forty trucks and everyone who could climb on one rolled out of the fairgrounds.

Then the map broke, and the county line never came.

Two hundred years later their great-great-grandchildren are still evacuating. They live on the trucks, they marry on the trucks, and they have built a whole government of road rage on top of the trucks. Laws pass by honking. Borders are wherever your tires happen to be. Each of the warlords "rules" a convoy, and nobody rules any ground, because ground is something you drive over. Buck Delacroix IV still calls every second of it from a scaffold tower, play by play, to a crowd that has been gone for two centuries.

**Comic engine:** road rage as government. All diplomacy happens at ninety miles an hour through megaphones. The Rules of the Rumble are painted on the trucks' flanks and amended at speed. The Voice narrates everything, including you.
**The turn:** *"The announcer doesn't end the show, folks. The county does."*
**The receipt:** the Checkered Flag, folded in the booth since 2077, never waved.
**What "calming down" means:** you catch a warlord, pull alongside, and talk them down at speed. Each calmed warlord adds +1 to the `rumbleCalm` meter (0–3). Nobody has to lose a fight. Per the bible, *no arrow is a fight*.

**The size.** The Rumble is one site spread over a cluster of adjacent hexes (proposal: 3–4 blank Iron Reaches hexes, joined through the town-hub `hexAliases`). Every chase route runs 4–5 legs inside it, using terrain keys rather than hex uuids, so a leg is "miles of badlands," not a hex step. It can be as big as the story needs.

---

## Cast (personas, armed secrets)

Secret format: `Label :: effectKey :: unlock :: truth`.

**Big Mama Torque** drives *THE MOTHER-IN-LAW*, a truck with a porch on it. She drives in circles around her convoy like a sheepdog, all day, every day, and has never once been thanked. She has a megaphone in one hand, a casserole in the other, and steers with her knees.
- `Forty Souls :: favorPlus1 :: a Steward asks how many people are in her convoy, instead of how many trucks :: "Forty-one. Forty if you don't count Earl, and I don't, but I feed him."`
- `The Circle :: rollPlus2 :: a Steward asks where she's going :: She isn't going anywhere. She's been circling the same forty people for thirty-one years so nobody falls off. She's never said it out loud, and it's the first time she's heard it.`

**The Reverend Axle Mundy** drives *AMEN CORNER*, which has a steeple and a pipe organ wired to the horn. He preaches the Gospel of Momentum over loudspeakers: *"Blessed are the moving, for the parked shall be towed."* His sermons are terrible and his congregation adores him.
- `The Seventh Day :: oppRollMinus2 :: a Steward quotes scripture back at him, specifically that even the Lord rested :: He loses the argument and is overjoyed about it. Nobody has argued theology with him in years.`
- `The Last Verse :: rollPlus2 :: a Steward asks what's at the end of the road :: "The county line. It's in the Book." His Book is the Spooktacular program, laminated. He has never read past page one, because page two is the parking map.`

**Baby Ruckus** is eleven years old and drives *NAPTIME*, which her late grandma painted with sleepy clouds and a skull. She inherited the warlordship last spring. She is very serious about it, very small, and very tired. **Her chase runs backwards:** she chases *you*.
- `Grandma's Rules :: favorPlus1 :: a Steward asks who painted the truck :: "Grandma Ruckus. She said a warlord should look scary and feel cozy." She shows you the blanket in the cab.`
- `Past Bedtime :: rollPlus2 :: a Steward asks when she last slept :: She doesn't know. Warlords don't sleep. Grandma never slept either. She's asleep before she finishes the sentence.`

**Buck "The Voice" Delacroix IV** is the announcer, fourth of his name, in a scaffold booth above the old fairgrounds infield. He calls every move in the Rumble, to everybody and nobody. He is warm, fast, and loud, and he cannot stop, because the show is live. Not a villain: a man holding his great-great-grandfather's last line.
- `The Crowd :: stirThePot :: a Steward asks who he's talking to :: "The crowd, folks!" There isn't one. He knows. He waves to the empty grandstand anyway, and the grandstand gets a wave from you too if you're kind.`
- `Not My Line :: rollPlus2 :: a Steward asks him to call the end of the show :: "Can't, folks. The announcer doesn't end the show. The county does." (the turn; gate rumbleCalm ≥ 2)`

**Dot Ambrose** runs the Rental Lot, the only stationary business in the Rumble. She rents monster trucks to outsiders by the hour and has never once got one back on time. (Door NPC. She solves the "our faction has no rig" problem in fiction.)
- `The Loaner :: favorPlus1 :: a Steward asks which truck is hers :: *BEATRICE*, the slowest truck in the Rumble and the only one with working brakes. She'll lend it to you if you promise to bring it back. Nobody ever has.`

---

## The steps

Ten on the card. Funny for three, three warlords in any order (each a chase), the turn at seven, the booth at eight, the summit at nine, the flag at ten. The meter is `flags.fourththing.rumble.calm` (0–3). The turn is gated on calm ≥ 2, the summit on calm = 3.

| # | step | Next: line | beats | done |
|---|---|---|---|---|
| 1 | **Welcome to the Rumble** | Somebody is announcing you over a PA. Wave. | `rumble_arrival` | any |
| 2 | **The Rules of the Rumble** | The laws are painted on the trucks. Read one going past. Rule Two is "See Rule One." | `rumble_rules` | any |
| 3 | **Big Mama Torque** | She's driving circles around forty people. Catch her and say something nobody's said in thirty years. | `rumble_mama_hook` → chase → `rumble_mama_calm` / `rumble_mama_lapped` | `mark: rumble_mama_calm` |
| 4 | **The Reverend Axle Mundy** | Blessed are the moving. Catch the steeple and argue theology at ninety. | `rumble_axle_hook` → chase → `rumble_axle_calm` / `rumble_axle_lapped` | `mark: rumble_axle_calm` |
| 5 | **Baby Ruckus** | The smallest warlord wants to chase you. Let her win. That's the hard part. | `rumble_ruckus_hook` → chase (she's the pursuer) → `rumble_ruckus_calm` (caught) / `rumble_ruckus_tantrum` (escaped) | `mark: rumble_ruckus_calm` |
| 6 | **The Voice** | The announcer has called every second for two hundred years. Ask who he's talking to. | `rumble_voice` | any |
| 7 | **The County Line** ← *the turn* | Ask Buck to call the end of the show. Then don't say anything for a bit. | `rumble_county_line` (gate calm ≥ 2) | any |
| 8 | **The Booth** | Somewhere in the booth is a flag nobody ever waved. Find it. | `rumble_booth` | `mark: rumble_checkered_flag` |
| 9 | **The Big Stop** | Three warlords, engines idling, one infield. Turning a key is the hardest thing they'll ever do. | `rumble_big_stop` (gate calm = 3) | any |
| 10 | **Wave the Flag** | Park it, race it, or point it somewhere. Somebody official finally has to say it. | `rumble_flag` | `anyOf: rumble_parked, rumble_season_two, rumble_convoy` |

Steps 3–5 run in any order. The Log shows all three once step 2 is done.

**Doors** (open the whole visit, never Next):
- **Dot's Rental Lot**: "Dot rents monster trucks by the hour. Nobody has ever brought one back on time." → `rumble_rental_lot`
- **The Grandstand**: "Eight thousand empty seats. Buck waves to them every lap. Wave back." → `rumble_grandstand` (one gag; +1 to the hidden `heard` flag, which unlocks a hidden line at the turn)
- **The Pit**: "The convoys refuel without stopping. Watch how. Then try it." → `rumble_pit` (pure gag: a refueling operation run by forty people leaping between moving trucks, which works perfectly)

---

## The chases

Every chase is a `beat.chase` on the hook beat's "Go" choice. `fromCtx` is the playing faction. The warlords are manual sides: land-only, no gambit cost. Escaping is never a failure state. They lap you, the Voice makes fun of you, and the hook beat comes back next turn (repeatable). *Rumble trucks are huge and slow off the line but brutal over broken ground,* so their speed is middling and their bonus is high.

| warlord | who runs | route (terrain keys, all inside the Rumble) | side spec | the joke in the route |
|---|---|---|---|---|
| Big Mama Torque | she runs, you chase | `badlands, desert, badlands, desert, badlands` | `{name:"THE MOTHER-IN-LAW", speed:3, tier:3, bonus:2, hazardResist:1, domains:["land"]}` | It's a circle. The route repeats because she does. |
| Rev. Axle Mundy | he runs, you chase | `canyons, ruins, canyons, badlands` | `{name:"AMEN CORNER", speed:3, tier:2, bonus:3, domains:["land"]}` | Canyons: the organ echoes. He's easier to track than to catch. |
| Baby Ruckus | **she chases, you run** | `wasteland, badlands, wasteland` (short; she's eleven) | `{name:"NAPTIME", speed:4, tier:2, bonus:1, domains:["land"]}` | **Caught = you win.** Escaping her is the bad outcome. |

**Gambits** stay as the engine has them, with two story hooks the follow-up beats can read. This needs one small engine add (§Engineering):
- **🧨 Potshot** at a warlord you're trying to calm works mechanically, but the calm beat opens cold. One choice is greyed out, and the Voice mentions it on air: *"AND THE STEWARDS HAVE SHOT AT A CHURCH, FOLKS."*
- **🕳️ Feint** on Baby Ruckus is "letting her think she's winning," and the calm beat thanks you for it.

---

## The new beats (prose, choices, effects)

Voice: funny first. The Voice gets most of the laughs and none of the narration. Mal gets one line in the whole site, at the flag.

**`rumble_arrival` — Welcome to the Rumble** *(speaker The Voice; hex on-enter)*
> The ground is shaking before you see why. Then forty monster trucks come over the rise at once, every one of them in a hurry and none of them going anywhere, and a voice the size of a weather system rolls across the badlands: *"LADIES AND GENTLEMEN, WE HAVE VISITORS! LOOK AT THAT RIG, FOLKS! LOOK AT THOSE FACES! THEY HAVE NO IDEA WHAT'S HAPPENING!"* A truck with a porch on it laps you twice. A woman on the porch throws you a casserole.
> Choices: **Wave.** (+ Voice: *"THEY WAVED, FOLKS! CLASS ACT!"*) · **Catch the casserole.** (Body 12; success: it's still warm, so somebody's oven is still moving; fail: it's on your windshield, and the Voice calls it a "TEXAS WELCOME") · **Look for whoever's talking.** → the scaffold tower over the old infield, lit like a birthday cake.

**`rumble_rules` — The Rules of the Rumble** *(exploration; the trucks themselves)*
> The law here is painted on the trucks, and the trucks don't stop, so reading the law is a sport. RULE 1: NOBODY STOPS. RULE 2: SEE RULE 1. RULE 9: YIELD TO THE PORCH. RULE 31: NO LEFT TURNS ON TUESDAYS (REPEALED) (UNREPEALED). RULE 47: IF YOU CAN READ THIS YOU ARE TOO CLOSE. Each rule is in a different hand. Some are crossed out and repainted at speed, with drips that run sideways.
> Choices: **Read Rule 1 slowly.** (Mind 12: under the paint, in older paint, the original says NOBODY STOP TILL YOU'RE PAST THE COUNTY LINE. +1 `heard`) · **Propose an amendment.** (Presence 14: somebody honks twice, which is a second, and somebody honks three times, which is a filibuster. Your amendment is painted on a truck. It says something slightly different from what you said.) · **Ask who's in charge.** → three trucks are pointed out. Then a fourth, very small one.

**`rumble_mama_hook` — The Porch Comes Round Again** *(speaker Big Mama Torque)*
> She laps you a third time, and this time she leans off the porch with the megaphone: *"YOU EAT? YOU LOOK LIKE YOU DON'T EAT. IF YOU WANT TO TALK, YOU'LL HAVE TO KEEP UP, SUGAR, I'VE GOT FORTY PEOPLE AND EARL."*
> Choices: **Go — catch the porch.** (chase: Mama quarry) · **Ask how many people, not how many trucks.** (arms `Forty Souls`) · **Not today.** (the porch keeps circling; it'll be there)

**`rumble_mama_calm` — Alongside the Porch** *(on caught; speaker Big Mama Torque)*
> You pull alongside at sixty, close enough to hand her something. She looks at you the way you look at a dog that's learned to open the fridge: annoyed, impressed, already planning to feed it.
> Choices: **"Thank you. For all of it. For every lap."** (Presence 14; success: she takes her foot off the gas for the first time in thirty-one years, only for a second, and the Voice goes very quiet and then says *"...folks."* +1 calm, mark `rumble_mama_calm`; fail: she hears "thank you for the casserole," which also counts but she knows it doesn't. Try again next lap) · **"Where are you going?"** (arms `The Circle`; she has no answer and laughs until she has to wipe her eyes) · *(greyed if you Potshot her)* **"Can I ride the porch?"** → yes. You are now family. You cannot undo this.

**`rumble_mama_lapped` — Lapped** *(on escaped)*
> *"AND THE PORCH LAPS THE VISITORS, FOLKS! THAT'S A FOUR-HUNDRED-TON MOTHER-IN-LAW AND SHE HAS LAPPED YOU! I'D GO HOME AND THINK ABOUT THAT!"* A second casserole hits your hood. She's not mad. She's never mad. She'll come round again.

**`rumble_axle_hook` — The Gospel of Momentum** *(speaker Rev. Axle Mundy)*
> The steeple arrives before the truck: a whole white church spire bolted to a monster truck called AMEN CORNER, the pipe organ wired to the horn, playing a hymn in a key that hurts. *"BROTHERS AND SISTERS,"* the Reverend booms, *"BLESSED ARE THE MOVING, FOR THE PARKED SHALL BE TOWED!"* Forty people in the back say AMEN at highway speed.
> Choices: **Go — catch the church.** (chase: Axle quarry) · **Shout a verse back.** (arms `The Seventh Day`) · **Ask what's in the Book.** (arms `The Last Verse`)

**`rumble_axle_calm` — Theology at Ninety** *(on caught; speaker Rev. Axle Mundy)*
> Alongside the steeple, door to door, you can see the Book on his dash: a laminated program from 2077 with a cartoon pumpkin on the cover. He is delighted you're here. Nobody comes alongside the church.
> Choices: **"Even the Lord rested on the seventh day."** (Spirit 14; success: he loses, and he's ecstatic. "A SABBATH! WHY DID NOBODY SAY!" He coasts. The congregation coasts with him and is very confused about it. +1 calm, mark `rumble_axle_calm`) · **"Read me page two."** (Mind 12: it's the parking map. There is a parking lot in the Book. He goes quiet and turns the program over and over. +1 `heard`) · **"Amen."** (it's a good amen; he blesses your vehicle, which does nothing, but the Voice reports it as a "SPIRITUAL UPGRADE")

**`rumble_axle_lapped` — Lapped by a Church** *(on escaped)*
> *"YOU HAVE BEEN LAPPED BY A HOUSE OF WORSHIP, FOLKS!"* The organ plays you out. It's the slowest hymn it has, which is somehow worse.

**`rumble_ruckus_hook` — NAPTIME** *(speaker Baby Ruckus)*
> The smallest truck in the Rumble has a skull and sleepy clouds on it, and it pulls up beside you with a squeal of brakes it has clearly been practising. The warlord inside has to stand on the seat to see over the dash. She has a cape. She has a juice box. She has the most serious face you've ever seen. *"I'm Baby Ruckus,"* she says, *"Warlord of the Southern Convoy. I'm going to chase you now. Run."*
> Choices: **Run. (But maybe not too fast.)** (chase: Ruckus pursuer; *caught is the good outcome*) · **"Who painted your truck?"** (arms `Grandma's Rules`) · **"Shouldn't you be in bed?"** → *"WARLORDS DON'T HAVE BEDS."* She revs to make the point. It's a small rev.

**`rumble_ruckus_calm` — Caught** *(on caught; speaker Baby Ruckus)*
> She catches you. She is so happy that she forgets to be a warlord for a second and is just a kid who won, bouncing in the cab, telling the PA, telling her convoy, telling the sky. Then she climbs into your cab to explain the rules of what she just did, which take a while, and halfway through Rule Four she puts her head on your arm.
> Choices: **Let her sleep.** (+1 calm, mark `rumble_ruckus_calm`. The whole Southern Convoy slows to a crawl so they don't wake her. Forty trucks, tiptoeing. The Voice whispers the play-by-play.) · **"When did you last sleep?"** (arms `Past Bedtime`; she's out before she finishes) · **Read her the Rules of the Rumble as a bedtime story.** (Presence 12: she's asleep by Rule 9; +1 `heard`, because you notice how many of the rules are about not stopping, and how few are about anything else)

**`rumble_ruckus_tantrum` — You Got Away** *(on escaped)*
> You got away from an eleven-year-old, and the whole Rumble heard her find out about it over the PA. Big Mama Torque's porch arrives in under a minute, and so does the steeple. Nobody is angry at you. They're disappointed, and they're bringing her a juice box. *"FOLKS,"* says the Voice, *"WE'VE ALL BEEN THERE."* (`rumbleCalm` unaffected; the Rev's next calm check is −2 this turn, because he saw.)

**`rumble_voice` — The Voice** *(speaker Buck Delacroix IV; at the tower)*
> You climb the scaffold. Buck Delacroix IV is a big man in a sequinned jacket four generations old, a headset older than the jacket, and a voice so practised it sounds like weather. He doesn't stop calling the race while he talks to you. He just alternates. *"Pleasure, folks. AND THE PORCH IS ON THE BACK STRETCH. Sit, sit. Coffee's in the thermos. BABY RUCKUS IS IN THE PIT, FOLKS, SHE'S FOUND A SNACK."*
> Choices: **"Who are you talking to?"** (arms `The Crowd`) · **"How long have you been up here?"** → *"Me? Thirty years. The Voice? Two hundred, folks, give or take a Delacroix."* · **Look at the booth.** (shows the booth's clutter: the 2077 race card, a lunchbox, a flag case; this opens step 8 early, but the case is locked until the turn)

**`rumble_county_line` — The County Line** *(the turn; speaker Buck; gate rumbleCalm ≥ 2; priority high)*
> You ask him to call it. The end of the show. And for the first time since you got here, the Voice stops. Out on the badlands forty trucks keep circling without a soundtrack, and it's the loudest thing you've ever heard. *"Can't, folks,"* Buck says quietly, and you realise you've never heard him say anything quietly. *"Great-great-granddaddy said nobody stop till we're past the county line. The announcer doesn't end the show. The county does."* He looks out at the empty grandstand. *"And the county never called."*
> Choices: **Say nothing for a bit.** (the only right answer; he picks the mic back up when he's ready and his voice cracks on the first word) · **"Who IS the county now?"** (Mind 14; success: he looks at you, at your badge, at the Order you work for, the one that's famous for never sending official word, and he says *"...you might be, folks."* This is the hand-off to step 10) · *(hidden, `heard ≥ 2`)* **"Your great-great-granddaddy's line was 'past the county line.' Not 'forever.'"** (Buck laughs for the first time without the mic. Unlocks the hidden ending line at step 10.)

**`rumble_booth` — The Flag Case** *(exploration; the booth; gate rumble_county_line seen)*
> The flag case is glass, with a brass plate: TRI-COUNTY SPOOKTACULAR — FINAL HEAT — 10/31/2077. Inside, a checkered flag, folded the way you fold one that's about to be used. Nobody waved it, because the final heat never finished. Buck gives you the key without being asked.
> Choices: **Take the flag.** → RECEIPT *The Checkered Flag*; mark `rumble_checkered_flag` · **Leave it in the case.** → nothing changes, which is what four Delacroixs have chosen. Buck doesn't blame you.

**`rumble_big_stop` — The Big Stop** *(gate rumbleCalm = 3; speaker Buck; the summit)*
> For the first time in two hundred years, three convoys pull into the old fairgrounds infield at once. The porch, the steeple, and the little truck with sleepy clouds on it, engines idling, in a triangle facing each other, with a hundred and twenty people watching from the beds. Nobody's turned a key off since 2077. Big Mama Torque's hand is on hers, shaking. The Reverend is praying at it. Baby Ruckus is asleep, so her grandma's blanket is doing the deciding. Buck, up in the booth, has the mic in one hand and nothing to say.
> Choices: → step 10, with the flag if you hold it. (Presence 16 to talk all three into the same ending without the flag; the flag makes it automatic.)

**`rumble_flag` — Wave the Flag** *(the choice; speaker Buck, Mal's one line)*
> Mal, low, in your ear: *"Somebody official finally has to say it. Today that's you."*
> Choices:
> - **Park it — the race is over.** → `rumble_parked` (ending *parked*)
> - **Season Two — keep the trucks, give them a track.** → `rumble_season_two` (ending *season*)
> - **Point them somewhere — a county line worth reaching.** → `rumble_convoy` (ending *convoy*)
> - *(hidden, holds the flag AND unlocked at the county line)* **Hand Buck the flag. Let the Voice call it.** → `rumble_parked`, but Buck waves the flag himself and calls the finish of a heat that started in 2077, to a grandstand where, for the first time, the convoys are sitting. The best ending. It spends the flag.

---

## The receipt

**The Checkered Flag** :: `rollPlus2` :: *acquisition:* earned, from the flag case in Buck's booth :: *truth:* the final heat of the 2077 Spooktacular never finished. The flag proves it, and waving it ends it.
- **Convinces:** the Rumble. Waving it at the Big Stop makes the ending automatic. Handing it to Buck is the best ending.
- **Also convinces:** **Khezek-Tor (THE OFFICIAL WORD)**. Proof that a Steward *can* deliver official word and that it lands. A hidden choice there: *"I've done this before."* (Needs a one-line addition to the KT retrofit.)
- **Also:** the Finale muster. A convoy that finally has a county line to reach is a mobile wing (only on the *convoy* ending).

---

## Endings

| ending | what happens | world effects |
|---|---|---|
| **parked** (Park it / Buck waves it) | Engines off. People step onto ground they've never stood on and some of them sit right down on it. By spring the infield is a town: Pit Row. Big Mama Torque puts the porch on cinder blocks. The Reverend finds out about pews. Baby Ruckus sleeps for two days. | quest closes (closer); the Rumble hexes lose their travel hazard (free passage, ruling owed on mechanism); Darkness −1 across the cluster; Pit Row available as a town-hub settlement |
| **season** (Season Two) | The trucks keep running, but inside a track, with rules, a season and a trophy. Buck finally has an *ending* to call, every weekend. Spectators come from three regions. | quest closes; standing income for the faction that holds the league charter (ruling: how much); the hex keeps its hazard outside race days |
| **convoy** (Point them somewhere) | You give them a county line: somewhere real, on the map, that needs forty monster trucks. They go. For the first time in two hundred years, they arrive. | quest closes; mark `rumble_convoy` feeds the Finale muster as a mobile wing; the Rumble hexes empty out (blank again, quiet) |
| *(fail state, not a choice)* **wreck** | If a faction tries to stop the Rumble by force (Potshot on every warlord, or a raid on the convoys), the trucks scatter as raiders across the region. | quest fails; regional raider encounter weight up; no receipt |

---

## The tone check

Laughs before the turn: the casserole on the windshield, Rule 31 repealed and unrepealed, the honking filibuster, the porch, "forty people and Earl," "the parked shall be towed," lapped by a church, the juice box, forty trucks tiptoeing past a sleeping kid, "SHE'S FOUND A SNACK." That's ten or so across six steps. The turn is one line: *"The announcer doesn't end the show. The county does."* After it the Voice keeps calling, and it lands differently, which is the trick.

**Why it fits Bad Eden:** it's Night One from the other side. Chuckle Creek is the people who refused to let it count. The Rumble is the people who were told to run and never told to stop. It rhymes with Night Two, the locals still waiting for official word, and for once the Order *is* the official word. A Steward gets to be the county.

---

## ✦ Script block (paste into the editor's JSON hatch)

```json
{
  "key": "the_rumble",
  "quest": { "name": "Everybody Calm Down", "act": 3, "keystone": false, "hex": "The Rumble", "registryId": "quest_the_rumble", "evergreen": true, "chapters": {} },
  "script": {
    "giver": "a voice the size of a weather system, announcing you to a grandstand with nobody in it",
    "description": "Forty monster trucks, three warlords, and a government made of road rage. Laws pass by honking, borders are wherever your tires are, and an announcer has been calling the race since 2077. Nobody stops. Rule Two is \"See Rule One.\" Calm them down.",
    "steps": [
      { "id": "arrive", "label": "Welcome to the Rumble",       "line": "Somebody is announcing you over a PA. Wave.", "beats": ["rumble_arrival"] },
      { "id": "rules",  "label": "The Rules of the Rumble",     "line": "The laws are painted on the trucks. Read one going past. Rule Two is \"See Rule One.\"", "beats": ["rumble_rules"] },
      { "id": "mama",   "label": "Big Mama Torque",             "line": "She's driving circles around forty people. Catch her and say something nobody's said in thirty years.", "beats": ["rumble_mama_hook"], "done": { "mark": "rumble_mama_calm" } },
      { "id": "axle",   "label": "The Reverend Axle Mundy",     "line": "Blessed are the moving. Catch the steeple and argue theology at ninety.", "beats": ["rumble_axle_hook"], "done": { "mark": "rumble_axle_calm" } },
      { "id": "ruckus", "label": "Baby Ruckus",                 "line": "The smallest warlord wants to chase you. Let her win. That's the hard part.", "beats": ["rumble_ruckus_hook"], "done": { "mark": "rumble_ruckus_calm" } },
      { "id": "voice",  "label": "The Voice",                   "line": "The announcer has called every second for two hundred years. Ask who he's talking to.", "beats": ["rumble_voice"] },
      { "id": "county", "label": "The County Line",             "line": "Ask Buck to call the end of the show. Then don't say anything for a bit.", "beats": ["rumble_county_line"] },
      { "id": "booth",  "label": "The Booth",                   "line": "Somewhere in the booth is a flag nobody ever waved. Find it.", "beats": ["rumble_booth"], "done": { "mark": "rumble_checkered_flag" } },
      { "id": "stop",   "label": "The Big Stop",                "line": "Three warlords, engines idling, one infield. Turning a key is the hardest thing they'll ever do.", "beats": ["rumble_big_stop"] },
      { "id": "flag",   "label": "Wave the Flag",               "line": "Park it, race it, or point it somewhere. Somebody official finally has to say it.", "beats": ["rumble_flag"], "done": { "anyOf": ["rumble_parked", "rumble_season_two", "rumble_convoy"] } }
    ],
    "doors": [
      { "id": "lot",        "label": "Dot's Rental Lot", "line": "Dot rents monster trucks by the hour. Nobody has ever brought one back on time.", "beats": ["rumble_rental_lot"] },
      { "id": "grandstand", "label": "The Grandstand",   "line": "Eight thousand empty seats. Buck waves to them every lap. Wave back.", "beats": ["rumble_grandstand"] },
      { "id": "pit",        "label": "The Pit",          "line": "The convoys refuel without stopping. Watch how. Then try it.", "beats": ["rumble_pit"] }
    ],
    "after": [],
    "chapters": {}
  }
}
```

---

## Engineering notes (checked against `chase.js` today)

**Works as-is:**
- `beat.chase` with `{fromCtx:true}` on either side, manual warlord sides, terrain-key routes (`badlands`, `desert`, `canyons`, `ruins`, `wasteland` all resolve), `onCaught`/`onEscaped` follow-up beats. **Reverse chase** for Baby Ruckus is just `pursuer: NAPTIME, quarry: {fromCtx:true}`, with onCaught → calm.
- One site over several hexes: town-hub `hexAliases` + the same `onEnterBeatId` on each hex.

**Small adds (all in `modules/bbttcc-travel/scripts/chase.js`):**
1. **No-rig fallback.** If the playing faction owns no rig, `normalizeSide` silently gives it speed 2 / tier 1. Add `fromCtx` + `fallback: {name, speed, tier}`, used when `factionRigs` is empty. *BEATRICE* from Dot's lot becomes the fallback (`speed:3, tier:2`), and the rental-lot door says so in fiction.
2. **Gambits in follow-up ctx.** Pass `ctx.chaseGambits = {quarry:[...], pursuer:[...]}` to the onCaught/onEscaped beat so the calm beats can grey a choice after a Potshot. About three lines.
3. **Calm meter.** No engine work: `worldEffects.meters` +1 on each `_calm` beat, as Chuckle does with `seen`.

**New content:** 5 personas (Mama, Axle, Ruckus, Buck, Dot) · ~20 beats · 1 receipt · the ✦ Script above · a `towns.json` hub block (doors: Lot / Grandstand / Pit / Booth) · DA scenes: the fairground infield + scaffold booth, and a badlands strip for chase framing. The DA monster-truck asset hunt goes through the licence policy (no Monster Jam names or liveries; Sketchfab Standard / CC-BY only).

**Not touched:** the Circuit Riders, Dennis, the Classification Review chain. They share the chase engine and nothing else.

---

## Rulings (Dave)

1. **Where:** a 3–4 hex cluster in the Iron Reaches (33/33 blank by design)? Or somewhere you'd rather have monster trucks?
2. **When:** Act 3, evergreen side quest (my pick: it doesn't seal, so it can be found any time after)? Or tied to a phase?
3. **The turn:** the 2077 Spooktacular evacuation ("nobody stop till you're past the county line"), as drafted? Or keep it pure comedy with no Night One link?
4. **Names:** Big Mama Torque / THE MOTHER-IN-LAW · Rev. Axle Mundy / AMEN CORNER · Baby Ruckus / NAPTIME · Buck "The Voice" Delacroix IV · Dot Ambrose / BEATRICE · quest "Everybody Calm Down" · site "The Rumble." Keep, swap, or add a warlord?
5. **Endings:** parked / season / convoy (+ wreck fail). Does Season Two pay income, and how much?
6. **Free passage after *parked*:** a real travel-cost waiver (needs a ruling on the mechanism; dev-6 FREE is the only current authority) or flavour only?
7. **KT hand-off:** OK to add the Checkered Flag as a hidden choice in THE OFFICIAL WORD?
