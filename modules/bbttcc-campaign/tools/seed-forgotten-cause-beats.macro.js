/* ============================================================================
 * Bad Eden — SEED: Forgotten-Cause beats  (GM macro)
 * ----------------------------------------------------------------------------
 * Adds 8 beats to the active campaign ("Thatward's Ho!", l4PTkyhdfGBQXkOj):
 *   • Wendigo Confluence: long table + Restore / Redirect / Break
 *   • Cultural Summit + success / failure
 *   • Dougan -> Confluence interlock
 * Faction id (U5YaO2p189LBMvVq) and Dougan hub (fixit_gullywasher_interior_convo)
 * are already wired into the beats below.
 *
 * DRY_RUN = true  -> preview only (no writes). Set false to apply.
 * Idempotent: skips any beat whose id already exists.
 * On apply: downloads a FULL campaigns-setting backup BEFORE writing (aborts if
 * the backup fails). Run in the live Bad Eden world (Ember) as GM.
 * ==========================================================================*/
(async () => {
  const DRY_RUN = true;                 // <-- set to false to actually write
  const NS = "bbttcc-campaign", KEY = "campaigns";

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const NEW_BEATS = [
    {
      "id": "wendigo_confluence_the_long_table",
      "label": "The Confluence — The Long Table",
      "type": "skill_scene",
      "timeScale": "scene",
      "tags": "wendigo leyline confluence forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Read the name-cards before you decide",
          "next": "wendigo_confluence_the_long_table",
          "description": "Sit. Read every card. Let it cost you. (Success surfaces the recovered cause you can carry to the Cultural Summit; failure, you read too many and lose your footing in the thick time — but you still learn the shape of it.)",
          "checkStat": "Investigation (Mind)",
          "checkDC": 14,
          "failNext": "wendigo_confluence_the_long_table"
        },
        {
          "label": "RESTORE — re-anchor the node; let them finally let go",
          "next": "wendigo_confluence_repair",
          "description": "Give the leyline back its Foundation. The Wendigo can stop holding. Everything they smoothed comes back — including the wound that started it all.",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        },
        {
          "label": "REDIRECT — take the trust onto yourselves; become the ledger",
          "next": "wendigo_confluence_redirect",
          "description": "Tell them you'll carry it. The network can disperse. The dead are owed to YOU now — and you will feel the weight of it.",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        },
        {
          "label": "BREAK — sever the network; let the held memories scatter",
          "next": "wendigo_confluence_break",
          "description": "End it fast. The held memories scatter and the forgotten un-happen, cleanly, forever. The feud's ghost goes with them.",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        },
        {
          "label": "Not yet. Step back from the table.",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "factionEffects": [],
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": []
      },
      "description": "The leyline knots here, and time runs thick as poured honey.\n\nThe Wendigo have set a long table under a sky that won't hold still. Hundreds of chairs. A name-card handwritten at every seat. They move like gracious hosts — pulling out a chair, smoothing a napkin, warping space and time and the souls of others the way other folks straighten the good silver.\n\nThere is a card with your name on it. There is a card, three seats down, with a name you buried.\n\nEvery card is someone this region forgot. The Wendigo have been holding them at the table this whole time, waiting for somebody to come back for what they were keeping.\n\n\"You are not haunted,\" one of them says, kindly, pulling out your chair. \"You are occupied. Sit. Dinner is finally served.\"\n\n(Their hospitality is real. So is the trap inside it. What they hold includes the WHY behind an old feud — the reason a region cannot stop hating itself. Choose what happens to all of it.)",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "wendigo_confluence_repair",
      "label": "The Confluence — Restore",
      "type": "outcome_trigger",
      "timeScale": "scene",
      "tags": "wendigo confluence restore forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Leave",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "Confluence node restored. The region's forgotten grief returned to it; the original feud-injury resurfaced; the Wendigo network began to fade.",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": [],
        "factionEffects": [
          {
            "factionId": "U5YaO2p189LBMvVq",
            "moraleDelta": 0,
            "loyaltyDelta": 0,
            "unityDelta": 1,
            "darknessDelta": -1,
            "opDeltas": {
              "softpower": 1
            },
            "allowOvercap": false
          }
        ]
      },
      "description": "You re-anchor the node. For one breath, Yesod is local again — a Foundation under your feet that has been missing since before you were born.\n\nThe Wendigo set down what they were carrying. All of it. The region's grief floods back into the region: the dead are mourned properly for the first time, and the original injury behind the old feud surfaces, raw and un-smoothed and nobody's favorite.\n\nThe Wendigo, no longer needed, begin to thin at the edges. One tips an imaginary hat. \"Thank you,\" it says, \"for coming back for them.\" Then there is just an empty table, and a region that finally remembers what it lost — which is the only ground you can actually build peace on.\n\nYou leave carrying the recovered cause. The Cultural Summit can close the Ledger now.",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [
          "leyline_remembrance"
        ],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "wendigo_confluence_redirect",
      "label": "The Confluence — Redirect",
      "type": "outcome_trigger",
      "timeScale": "scene",
      "tags": "wendigo confluence redirect forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Leave",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "Confluence network redirected onto the party. The Wendigo dispersed; the held dead are now the players' burden until rehomed.",
        "worldModifiers": [
          "bearers_of_the_confluence"
        ],
        "relationshipEffects": [],
        "questEffects": [],
        "factionEffects": [
          {
            "factionId": "U5YaO2p189LBMvVq",
            "moraleDelta": 0,
            "loyaltyDelta": 0,
            "unityDelta": 1,
            "darknessDelta": 0,
            "opDeltas": {},
            "allowOvercap": false
          }
        ]
      },
      "description": "\"We'll carry it,\" you say. The Wendigo go very still — the stillness of someone who has been waiting a long time to be relieved.\n\nThey hand it over. Not gently; there is no gentle way. Every name at the table, every owed and unmourned thing, settles onto you like a second coat made of lead and other people's love. The network disperses into the leyline, finally allowed to rest.\n\nYou are the ledger now. You will feel them — a standing weight on your Clarity until you find each one a home. It is heroic. It is unsustainable. That is exactly what you signed up for.\n",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [
          "leyline_remembrance"
        ],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "wendigo_confluence_break",
      "label": "The Confluence — Break",
      "type": "outcome_trigger",
      "timeScale": "scene",
      "tags": "wendigo confluence break forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Leave",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "Confluence network severed. Held memories lost permanently; the forgotten un-happened; the Chupacabra/Jackalope feud quietly ended for lack of a grievance to feed it.",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": [],
        "factionEffects": [
          {
            "factionId": "U5YaO2p189LBMvVq",
            "moraleDelta": 0,
            "loyaltyDelta": 0,
            "unityDelta": 1,
            "darknessDelta": 1,
            "opDeltas": {},
            "allowOvercap": false
          }
        ]
      },
      "description": "You sever it.\n\nThe leyline knot comes apart with a sound like a held breath finally let go, and the long table empties all at once — not the residents leaving, the NAMES leaving, scattering off their cards into a wind that does not bring them back. The forgotten un-happen, cleanly, forever. The Wendigo go with them; they were only ever the holding.\n\nIt is, undeniably, peace. The old feud loses its ghost in the same instant — you cannot hate someone over a grievance whose every trace just blew away. A real peace, built on a deletion. Someone always pays. Here you chose the dead, and they could not argue.\n",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "gullywasher_dougan_points_to_confluence",
      "label": "The Gullywasher — Dougan Points the Way",
      "type": "outcome_trigger",
      "timeScale": "scene",
      "tags": "dougan gullywasher interlock forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Back to the bar",
          "next": "fixit_gullywasher_interior_convo",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "factionEffects": [],
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": []
      },
      "description": "Dougan stops polishing the glass. For once, he is not performing.\n\n\"You've met them. The kind ones. The ones with something a little OFF.\" He sets the glass down with deliberate care. \"I told you the Gate remembers something incorrectly. I was being polite. The truth is uglier and simpler: someone is doing this region's grieving FOR it, and doing it badly.\"\n\nHe slides a coaster across the bar. There is a map scratched on the back. \"Where the leylines knot. They've set a table. Go and find out whose name is already written on a card — and then come back and tell me we were ever truly enemies.\"\n\n\"Go. I'll keep the lights on. Someone here should remember how to set a table for peace.\"",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "gullywasher_cultural_summit",
      "label": "The Gullywasher — Host the Cultural Summit",
      "type": "skill_scene",
      "timeScale": "scene",
      "tags": "dougan gullywasher summit feud forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Read the recovered cause aloud — enter it in the Ledger",
          "next": "gullywasher_cultural_summit_success",
          "description": "Name the original wrong, out loud, to both their faces. Give the blank column its missing entry. Let it land where it teaches the right lesson.",
          "checkStat": "Investigation (Mind)",
          "checkDC": 14,
          "failNext": "gullywasher_cultural_summit_failure"
        },
        {
          "label": "Set the table — make them stay long enough to be seen",
          "next": "gullywasher_cultural_summit_success",
          "description": "Soft power. Seating arrangements. Poetry on Wednesdays. Culture can anchor a leyline as well as iron can.",
          "checkStat": "op.softpower",
          "checkDC": 14,
          "failNext": "gullywasher_cultural_summit_failure"
        },
        {
          "label": "Let Dougan host; you provide the room and the nerve",
          "next": "gullywasher_cultural_summit_success",
          "description": "He is an Echo of a diplomat who died trying to do exactly this. Give him the chance to finish it. You just have to hold the room steady.",
          "checkStat": "op.diplomacy",
          "checkDC": 12,
          "failNext": "gullywasher_cultural_summit_failure"
        },
        {
          "label": "Not yet — leave it for now",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "factionEffects": [],
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": []
      },
      "description": "Dougan has given you the room. A Chupacabra at one end, a Jackalope at the other, the Ledger open on the bar between them with its blank reason-column staring up like a missing tooth.\n\n\"Most people enter expecting to confirm a story,\" Dougan murmurs at your shoulder. \"You came to revise one. So: make them sit at the same table long enough to be SEEN. Visibility is the first ingredient of diplomacy. The rest is nerve.\"\n\nYou have the recovered cause — the real, original injury the Wendigo were holding. Enter it in the Ledger and the debt can finally be CLOSED instead of compounding forever. Or fumble it, and you hand two peoples one more grievance with a blank where the reason should be.\n\n(Requires the recovered cause from the Confluence. Without it, the summit can be attempted but cannot truly close the line.)",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "gullywasher_cultural_summit_success",
      "label": "Cultural Summit — Success",
      "type": "outcome_trigger",
      "timeScale": "scene",
      "tags": "dougan summit success feud forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Leave",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "Cultural Summit succeeded. The recovered cause was entered in the Ledger; the manufactured Chupacabra/Jackalope feud closed. Exchange Unity rose; Dougan's Echo work completed.",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": [],
        "factionEffects": [
          {
            "factionId": "U5YaO2p189LBMvVq",
            "moraleDelta": 1,
            "loyaltyDelta": 0,
            "unityDelta": 2,
            "darknessDelta": -1,
            "opDeltas": {
              "diplomacy": 1
            },
            "allowOvercap": false
          }
        ]
      },
      "description": "The reason-column gets its entry. Out loud, with both peoples present, the original wrong is finally named — and the strange thing about a debt is that it cannot compound once it can be SEEN. The Ledger closes the line. Furrier's pen, somewhere, goes still.\n\nIt is not forgiveness, exactly. It is something sturdier: a Chupacabra and a Jackalope sitting at one table, knowing at last what they are actually grieving, and choosing to grieve it together instead of charging each other interest on it.\n\nDougan watches the table the way a man watches a sunrise he wasn't sure he'd live to see. \"Maybe,\" he says quietly, to no one, \"the story changed this time.\"\n\nHe pours three glasses of the rosemary-infused radish gin. \"To revision,\" he says. \"Even myths deserve it.\"",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [],
        "strategics": [
          "cultural_exchange_network"
        ]
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    },
    {
      "id": "gullywasher_cultural_summit_failure",
      "label": "Cultural Summit — Failure",
      "type": "outcome_trigger",
      "timeScale": "scene",
      "tags": "dougan summit failure feud forgotten_cause",
      "politicalTags": "",
      "outcomes": {
        "success": null,
        "failure": null
      },
      "inject": {
        "cooldownTurns": 0,
        "repeatable": true,
        "oncePerHex": false,
        "promptGM": "inherit",
        "fallbackOnDecline": "inherit",
        "allowMulti": "inherit",
        "oncePerHexGlobal": "inherit"
      },
      "actors": [],
      "choices": [
        {
          "label": "Leave",
          "next": "",
          "description": "",
          "checkStat": "",
          "checkDC": 0,
          "failNext": ""
        }
      ],
      "encounter": {
        "key": "",
        "tier": null,
        "actorName": ""
      },
      "worldEffects": {
        "territoryOutcome": null,
        "radiationDelta": 0,
        "sparkKey": null,
        "turnRequests": [],
        "warLog": "Cultural Summit failed. Grievance rose; Dougan pushed one step closer to being forced to choose sides.",
        "worldModifiers": [],
        "relationshipEffects": [],
        "questEffects": [],
        "factionEffects": [
          {
            "factionId": "U5YaO2p189LBMvVq",
            "moraleDelta": 0,
            "loyaltyDelta": 0,
            "unityDelta": -1,
            "darknessDelta": 1,
            "opDeltas": {},
            "allowOvercap": false
          }
        ]
      },
      "description": "The table holds for a moment, then doesn't. A word lands wrong. The Jackalope cites a debit; the Chupacabra cites another; the reason-column stays blank and hungry, and the room remembers it would rather be at war than be confused.\n\nDougan steps between them, smiling, smoothing, buying minutes — but you can see it cost him. He is an Echo of a peace-broker, and the network is asking him, again, to choose a side, and a part of him is dimming under the weight of being asked.\n\n\"Power without elegance is merely noise,\" he says, lightly, hiding the ache. \"Try again. Slower. And bring the reason this time — they cannot forgive a blank.\"\n\n(The feud's Grievance meter rises. Recover the cause from the Confluence, or reduce the heat, before re-hosting.)",
      "questId": null,
      "questStep": null,
      "questRole": null,
      "targetHexUuid": null,
      "turnNumber": null,
      "cinematic": {
        "enabled": false,
        "startSceneId": null,
        "durationMs": 0,
        "nextSceneId": null
      },
      "journal": {
        "enabled": false,
        "entryId": null,
        "force": false
      },
      "unlocks": {
        "maneuvers": [],
        "strategics": []
      },
      "timePoints": null,
      "sceneId": null,
      "audio": {
        "enabled": false,
        "src": "",
        "volume": 0.85,
        "loop": false,
        "autoplay": false,
        "broadcastPlayers": true
      },
      "playerFacing": true,
      "refs": {},
      "playerFacingDialog": true,
      "dialogPlayerFacing": true,
      "playerFacingContent": true,
      "showToPlayers": true
    }
  ];

  let raw = game.settings.get(NS, KEY);
  const wasString = typeof raw === "string";
  let data = wasString ? JSON.parse(raw) : raw;
  if (!data) return ui.notifications.error("No campaigns setting found.");

  // locate active campaign across container shapes (keyed map | array | {campaigns:[]})
  const activeId = game.settings.get(NS, "activeCampaignId");
  const campaign =
      Array.isArray(data)            ? (data.find(c => c?.id === activeId) || data[0])
    : Array.isArray(data?.campaigns) ? (data.campaigns.find(c => c?.id === activeId) || data.campaigns[0])
    :                                  (data[activeId] || Object.values(data).find(c => c?.id === activeId) || Object.values(data)[0]);
  if (!campaign || !Array.isArray(campaign.beats))
    return ui.notifications.error("Could not locate active campaign / beats[].");

  const have    = new Set(campaign.beats.map(b => b?.id));
  const toAdd   = NEW_BEATS.filter(b => !have.has(b.id));
  const skipped = NEW_BEATS.filter(b =>  have.has(b.id)).map(b => b.id);

  console.group("%c[Forgotten-Cause seeder]", "font-weight:bold");
  console.log("Campaign:", campaign.label || campaign.title, "(" + campaign.id + ") — current beats:", campaign.beats.length);
  console.log("To add (" + toAdd.length + "):", toAdd.map(b => b.id));
  if (skipped.length) console.log("Already present, skipping (" + skipped.length + "):", skipped);
  console.groupEnd();

  if (!toAdd.length) return ui.notifications.info("Forgotten-Cause: already seeded — nothing to add.");

  if (DRY_RUN) {
    ui.notifications.warn("DRY RUN — would add " + toAdd.length + " beats (" + campaign.beats.length + " -> " + (campaign.beats.length + toAdd.length) + "). Set DRY_RUN=false to apply.");
    ChatMessage.create({ whisper: [game.user.id], content: "<b>Forgotten-Cause seeder (DRY RUN)</b><br>Would add " + toAdd.length + " beats to &ldquo;" + (campaign.label || campaign.title) + "&rdquo;:<br>" + toAdd.map(b => "&bull; " + b.id).join("<br>") });
    return;
  }

  // BACKUP first — abort if it fails (never write without a restore point)
  try {
    const save = foundry.utils?.saveDataToFile ?? saveDataToFile;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    save(JSON.stringify(data, null, 2), "application/json", "campaigns-backup-" + stamp + ".json");
  } catch (e) {
    console.error(e);
    return ui.notifications.error("Backup download failed — ABORTED. No changes written.");
  }

  campaign.beats.push(...toAdd);
  await game.settings.set(NS, KEY, wasString ? JSON.stringify(data) : data);

  ui.notifications.info("Forgotten-Cause: added " + toAdd.length + " beats — campaign now " + campaign.beats.length + ". Backup downloaded.");
  ChatMessage.create({ whisper: [game.user.id], content: "<b>Forgotten-Cause seeder — APPLIED &check;</b><br>Added " + toAdd.length + " beats to &ldquo;" + (campaign.label || campaign.title) + "&rdquo; (now " + campaign.beats.length + ").<br>A backup file was downloaded first." });
})();
