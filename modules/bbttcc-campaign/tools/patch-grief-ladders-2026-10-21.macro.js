/* patch-grief-ladders-2026-10-21.macro.js — GRIEF TOWNS REWORK, the three quest-log LADDERS (campaign.story.scripts).
 *  The live ladders live in the campaign setting (authored in the builder; scripts/story-scripts.js is only the code seed), so the two
 *  beat macros left the Log reading the old order. This sets chuckle_creek / soft_landing / stillwater to the reworked ladders:
 *   Chuckle Creek: arrive → diner (done: the tell) → pie → kid → machine → after closing → r2 → r1 → r3 → r4 → stack → showrunner → credits;
 *                  the "diner" door now opens cc_diner (was the arrival).
 *   Soft Landing:  arrive → checkpoint → session → castle → g3 → card → g1 → g2 → g4 → choice; new door "The Houses" (sl_houses).
 *   Stillwater:    same steps, lines rewritten for the hub-and-doors flow.
 *  Uses api.campaign.story.data.saveQuest when present (re-applies the story model + fires storyUpdated); falls back to a direct settings write.
 *  Idempotent; DRY_RUN default true. GM only. Code mirror: scripts/story-scripts.js (same commit).
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const SPEC = {
  "chuckle_creek": {
    "giver": "nobody. A road that ends in a painted backdrop, and a woman who wants you to eat",
    "description": "The sky is a painted backdrop and the sun has a face. A man takes an anvil to the skull, flattens to the thickness of a playing card, springs back, and tips his hat. Nothing here can hurt anyone, the pie is mostly steam and enthusiasm, and the creek actually chuckles. Everyone is in costume and nobody has mentioned it. Enjoy it. They have, since Halloween night, 2077.",
    "steps": [
      {
        "id": "arrive",
        "label": "Everything Is a Bit",
        "line": "Let yourself enjoy it. The delight is the evidence. Pick a door.",
        "beats": [
          "chuckle_arrival"
        ]
      },
      {
        "id": "diner",
        "label": "The Diner",
        "line": "Pearl will feed you whether or not you're hungry. Ask who the corner table is for.",
        "beats": [
          "cc_diner"
        ],
        "done": {
          "mark": "cc_table_set"
        }
      },
      {
        "id": "pie",
        "label": "The Pie Is Mostly Steam",
        "line": "The pie is mostly steam and enthusiasm, and you will finish it. Pearl has questions about your hat.",
        "beats": [
          "chuckle_pie"
        ]
      },
      {
        "id": "kid",
        "label": "The Piano Kid",
        "line": "A piano lands on a kid. He gets up laughing. Ask him how many times.",
        "beats": [
          "chuckle_piano_kid"
        ]
      },
      {
        "id": "machine",
        "label": "The Movie Machine",
        "line": "The grange hall has a projector all brass and reels. Ask what it plays. Ask what it plays them ON.",
        "beats": [
          "chuckle_projector"
        ]
      },
      {
        "id": "closing",
        "label": "After Closing",
        "line": "Come back after closing. Three cups, then a fourth. Sit in the fourth chair.",
        "beats": [
          "cc_corner_table"
        ]
      },
      {
        "id": "r2",
        "label": "The Chair at the Table",
        "line": "Winnie is off-screen. Now ask Pearl about Winnie, and watch her face.",
        "beats": [
          "chuckle_rung_2"
        ]
      },
      {
        "id": "r1",
        "label": "There Is No Last Winter",
        "line": "Nobody here has a past tense. Ask the piano kid where he goes when it's not his turn.",
        "beats": [
          "chuckle_rung_1"
        ]
      },
      {
        "id": "r3",
        "label": "You Try to Leave With Someone",
        "line": "Nobody leaves Chuckle Creek. Watch the seam where a scene changes.",
        "beats": [
          "chuckle_rung_3"
        ]
      },
      {
        "id": "r4",
        "label": "The Title Card",
        "line": "The title card is a memorial plaque. Read the names. One of them is on a plate at the diner.",
        "beats": [
          "chuckle_rung_4"
        ]
      },
      {
        "id": "stack",
        "label": "The Stack",
        "line": "Marnie's booth is where the show is made. The tapes are stacked weird — remember how. Find the slip.",
        "beats": [
          "chuckle_tape_shelf"
        ],
        "done": {
          "mark": "chuckle_rental_slip"
        }
      },
      {
        "id": "showrunner",
        "label": "The Showrunner",
        "line": "Marnie has the microphone. Ask her what the last thing on the tape was.",
        "beats": [
          "chuckle_showrunner"
        ]
      },
      {
        "id": "credits",
        "label": "Roll Credits",
        "line": "Series finale, new episode, or cancelled. Sit with how badly someone had to want this.",
        "beats": [
          "chuckle_credits"
        ],
        "done": {
          "anyOf": [
            "chuckle_finale",
            "chuckle_new_episode",
            "chuckle_cancelled"
          ]
        }
      }
    ],
    "doors": [
      {
        "id": "diner",
        "label": "Pearl's Diner",
        "line": "Pearl will feed you whether or not you're hungry. Ask who the corner table is for.",
        "beats": [
          "cc_diner"
        ]
      },
      {
        "id": "creek",
        "label": "The Creek",
        "line": "The creek actually chuckles. Stand in it and see if it's laughing with you.",
        "beats": [
          "chuckle_creek_itself"
        ]
      },
      {
        "id": "hollis",
        "label": "Hollis Bandy",
        "line": "Hollis will take an anvil for you. He will not take a question.",
        "beats": [
          "chuckle_hollis"
        ]
      }
    ],
    "after": [],
    "chapters": {}
  },
  "soft_landing": {
    "giver": "nobody. An inflatable arch, two guards with pool noodles, and a grandmother dressed as a bee",
    "description": "The gate is an inflatable arch and the guards challenge you with pool noodles and immense seriousness. The streets give underfoot, a state function is being conducted on a moon-bounce, and a thrown punch lands in foam that apologises. Nobody can be hurt here. Everyone is in costume and nobody has mentioned it. Find the one who isn't bouncing.",
    "steps": [
      {
        "id": "arrive",
        "label": "Challenged by Pool Noodles",
        "line": "Boing. Let yourself. Declare your edges at the gate.",
        "beats": [
          "soft_landing_arrival"
        ]
      },
      {
        "id": "checkpoint",
        "label": "Form 7-B, Declaration of Edges",
        "line": "Captain Falk needs your edges in triplicate. The stamp goes boing. Ask what happens if somebody lands.",
        "beats": [
          "soft_landing_checkpoint"
        ]
      },
      {
        "id": "session",
        "label": "The State of the Bounce",
        "line": "The Mayor is in session on the moon-bounce. Item one is cake. Ask her where she's from and watch the question go.",
        "beats": [
          "soft_landing_state_function"
        ]
      },
      {
        "id": "castle",
        "label": "The Castle",
        "line": "The bouncy castle is still up and the blower has been running since the party. NO SHOES, the sign says. Count the shoes.",
        "beats": [
          "soft_landing_castle"
        ]
      },
      {
        "id": "g3",
        "label": "The Elder Who Isn't Bouncing",
        "line": "One tired woman is sitting down. Sit down next to her. Don't say anything for a bit.",
        "beats": [
          "soft_landing_give_3"
        ]
      },
      {
        "id": "card",
        "label": "The Card",
        "line": "Adaeze has the birthday card. She hands it to anyone who sits. Everybody at the party signed it. Read it. Then take the name back to the Mayor.",
        "beats": [
          "soft_landing_card"
        ],
        "done": {
          "mark": "soft_landing_birthday_card"
        }
      },
      {
        "id": "g1",
        "label": "The Conversation Bounces",
        "line": "Teju's name bounces, every time, from everyone. Go looking for where it's written.",
        "beats": [
          "soft_landing_give_1"
        ]
      },
      {
        "id": "g2",
        "label": "No Graves, No Photographs",
        "line": "No graves, no photographs, no archive. Nothing here has a name written on it. Ask Adaeze what happened.",
        "beats": [
          "soft_landing_give_2"
        ]
      },
      {
        "id": "g4",
        "label": "One Held Breath",
        "line": "Somebody finally says it, badly, in the wrong order. Let them. Somebody has to go first.",
        "beats": [
          "soft_landing_give_4"
        ]
      },
      {
        "id": "choice",
        "label": "The Only Weapon Left",
        "line": "Grieve with them, build them a landing ground, or strip the padding. Vulnerability is the only weapon that works here.",
        "beats": [
          "soft_landing_choice"
        ],
        "done": {
          "anyOf": [
            "soft_landing_go_first",
            "soft_landing_practice",
            "soft_landing_harden"
          ]
        }
      }
    ],
    "doors": [
      {
        "id": "checkpoint",
        "label": "The Checkpoint",
        "line": "Captain Falk will take your edges. He will give you a receipt. The receipt is foam.",
        "beats": [
          "soft_landing_checkpoint"
        ]
      },
      {
        "id": "cake",
        "label": "The Cake",
        "line": "Seven candles, still lit. Make a wish and watch where it goes.",
        "beats": [
          "soft_landing_cake"
        ]
      },
      {
        "id": "blower",
        "label": "The Blower",
        "line": "The hum under everything. Put your hand on it. Don't turn it off. Somebody will.",
        "beats": [
          "soft_landing_blower"
        ]
      },
      {
        "id": "houses",
        "label": "The Houses",
        "line": "Foam mantelpieces and no photographs. Ask for the oldest thing in the house.",
        "beats": [
          "sl_houses"
        ]
      }
    ],
    "after": [],
    "chapters": {}
  },
  "stillwater": {
    "giver": "nobody. A Sunday that doesn't end, and a boy with a lemonade stand",
    "description": "Cut grass, percolator coffee, a kid selling lemonade at a card table. People wave, not warily, just waving. The band is mid-bar. It is the most unsettling thing you have felt in a long time, because nothing here is wounded or watching. Everyone is in costume and nobody has mentioned it. Somebody hands you today's paper. Check the date.",
    "steps": [
      {
        "id": "arrive",
        "label": "A Sunday That Doesn't End",
        "line": "Exhale first. Pick a door: the lemonade stand, the bandstand, the man with the paper, the station, the kerb.",
        "beats": [
          "stillwater_arrival"
        ]
      },
      {
        "id": "lemonade",
        "label": "The Lemonade Monopoly",
        "line": "Five cents, exclusive concession, change in buttons. Tell Bucky about the roads, and watch his face.",
        "beats": [
          "stillwater_lemonade"
        ]
      },
      {
        "id": "bandstand",
        "label": "The Downbeat",
        "line": "The band is mid-bar and Cal Pruett's arm is up. Ask what the song is. Then ask what the next word is.",
        "beats": [
          "stillwater_bandstand"
        ]
      },
      {
        "id": "c1",
        "label": "The Topic Slides Off",
        "line": "It slides off every time. Go and sit on the platform bench.",
        "beats": [
          "stillwater_crack_1"
        ]
      },
      {
        "id": "paper",
        "label": "Today's Paper",
        "line": "Amos Teague prints one edition. Read him the date out loud and watch his face try.",
        "beats": [
          "stillwater_paper"
        ]
      },
      {
        "id": "c2",
        "label": "The Woman at the Station",
        "line": "May Farrow has been waiting for the 4:10 for two hundred years. Show Amos something from the after.",
        "beats": [
          "stillwater_crack_2"
        ]
      },
      {
        "id": "c3",
        "label": "One of Them Sees It",
        "line": "Show Amos a piece of the after. Stay with him while it lands. Then read the permit on the bandstand post.",
        "beats": [
          "stillwater_crack_3"
        ]
      },
      {
        "id": "permit",
        "label": "The Permit",
        "line": "The parade permit is nailed to the bandstand post. Read the small print. One day only.",
        "beats": [
          "stillwater_permit"
        ],
        "done": {
          "mark": "stillwater_parade_permit"
        }
      },
      {
        "id": "c4",
        "label": "The Wall Is Thinning",
        "line": "Walk out to where the road runs out. Then decide whether anybody gets told first.",
        "beats": [
          "stillwater_crack_4"
        ]
      },
      {
        "id": "choice",
        "label": "What You Do With the News",
        "line": "Ring the bell, keep the covenant, or harvest it. You're carrying the news, and the news is the apocalypse.",
        "beats": [
          "stillwater_choice"
        ],
        "done": {
          "anyOf": [
            "stillwater_ring_the_bell",
            "stillwater_covenant",
            "stillwater_harvest"
          ]
        }
      }
    ],
    "doors": [
      {
        "id": "lemonade",
        "label": "The Lemonade Stand",
        "line": "Five cents. He takes marks. He gives change in buttons.",
        "beats": [
          "stillwater_lemonade"
        ]
      },
      {
        "id": "platform",
        "label": "The Platform",
        "line": "One bench, one clock, one board that says ARRIVING. Check your own watch.",
        "beats": [
          "stillwater_platform"
        ]
      },
      {
        "id": "waving",
        "label": "The Waving",
        "line": "Everybody waves. Wave back. See what the third wave does.",
        "beats": [
          "stillwater_waving"
        ]
      }
    ],
    "after": [],
    "chapters": {}
  }
};
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.story = camp.story && typeof camp.story === "object" ? camp.story : { quests: {}, scripts: {} };
  camp.story.scripts = camp.story.scripts || {};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const report = []; const todo = [];
  for (const [k, sc] of Object.entries(SPEC)) {
    if (same(camp.story.scripts[k], sc)) { report.push(`· ok ${k}: ladder already in place`); continue; }
    const before = camp.story.scripts[k]; todo.push(k);
    report.push(`✚ ${k}: ladder ${before ? `rewired (${(before.steps || []).map(s => s.id).join(" → ")}  ⇒  ${sc.steps.map(s => s.id).join(" → ")})` : "created"}`);
    camp.story.scripts[k] = foundry.utils.deepClone(sc);
  }
  console.log(`[grief ladders 2026-10-21] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${todo.length} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${todo.length} change(s); see console.`);
  if (!todo.length) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-grief-ladders-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  const api = game.bbttcc?.api?.campaign?.story?.data;
  if (api?.saveQuest) { for (const k of todo) await api.saveQuest(campaignId, k, { script: foundry.utils.deepClone(SPEC[k]) }); }
  else await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${todo.length} ladder(s) — Grief Towns rework.`);
})();
