/* seed-halloween-hoard-2026-10-31.macro.js — THE HALLOWEEN HOARD seed (GENERATED 2026-10-31 by build-halloween-hoard.mjs — do not hand-edit; rebuild).
 * Run from a GM seat on EMBER (then on the foundry instance). DRY_RUN = true prints the plan and writes nothing; flip to false to create.
 * What: 27 items → bbttcc-master-content.items in the folder "Halloween Hoard 2077" (created, fixed id) · 9 receipt templates →
 *       bbttcc-master-content.courtly-secrets · 14 boss drops onto the pack NPC docs AND every world actor of the same name (corpse loot shows them).
 *       A name already in a pack is skipped; ids are kept (repo _source == live). Then run patch-halloween-hoard-2026-10-31.macro.js for the campaign.
 */
const DRY_RUN = true;
const FOLDER = {"id":"hH0Folder0000001","name":"Halloween Hoard 2077"};
const ITEMS = [
 {
  "_id": "hH0SparkyMask001",
  "name": "Sparky Mask (Crown Mall, 2077)",
  "type": "gear",
  "img": "icons/equipment/head/mask-carved-face-orange.webp",
  "system": {
   "slot": "mask",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn",
    "set:sparky",
    "costume",
    "mask",
    "grief-towns"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Yellow vinyl, goggles painted on, elastic that never lost its stretch because nothing in Soft Landing wears out. It was under the row of small sneakers at the castle door, face down, where a kid drops a mask the second the grown-ups stop looking. The inside still smells like running.</p><p><em>Resolve +1 and +2 on Performance checks while worn — behind the goggles you could be anybody, which is the point of a mask.</em></p><p>Worn (mask) — equip it on the sheet (◇ → ◆) for the benefit. Part of the Sparky set: wear all three and the Wendigo don't take you.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "self",
      "frame": "vestment",
      "signature": "SPARKY, in the cereal-box font. One ear bent.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Yellow vinyl, goggles painted on, elastic that never lost its stretch because nothing in Soft Landing wears out. It was under the row of small sneakers at the castle door, face down, where a kid drops a mask the second the grown-ups stop looking. The inside still smells like running.</p>",
      "materialOf": [
       "vinyl",
       "elastic",
       "mascot-energy"
      ],
      "price": {
       "marks": 75,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TI vestment × bound free",
       "bound": "free",
       "saleBack": 30
      }
     }
    },
    "passives": {
     "checkBonus": [
      {
       "context": "check",
       "skill": "performance",
       "bonus": 2,
       "note": "Sparky says: nobody can read a dog's face"
      }
     ]
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.resolve",
       "value": 1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0SparkyMasEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0SparkyShirt01",
  "name": "Sparky Reactor-Suit Top (Crown Mall, 2077)",
  "type": "gear",
  "img": "icons/equipment/chest/shirt-collared-yellow.webp",
  "system": {
   "slot": "costume",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn",
    "set:sparky",
    "costume",
    "shirt",
    "grief-towns"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Padded yellow, the trefoil paw over the heart, DUCK AND GLOW! across the shoulders. Bucky Sorrel of Stillwater sold it to you off his own back for buttons, and was wearing another one underneath. Sparky the Reactor Pup taught a generation of children what to do when the sirens went. The sirens went.</p><p><em>Guard +1 while worn, and it is a reactor suit — it says so on the back — so radiation on a hex bites one level softer (the radiation engine reads it like any rad gear).</em></p><p>Worn (costume) — equip it on the sheet (◇ → ◆) for the benefit. Part of the Sparky set: wear all three and the Wendigo don't take you.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "self",
      "frame": "vestment",
      "signature": "The trefoil paw on the chest. A concession uniform, he says.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Padded yellow, the trefoil paw over the heart, DUCK AND GLOW! across the shoulders. Bucky Sorrel of Stillwater sold it to you off his own back for buttons, and was wearing another one underneath. Sparky the Reactor Pup taught a generation of children what to do when the sirens went. The sirens went.</p>",
      "materialOf": [
       "padded-cloth",
       "reflective-tape",
       "mascot-energy"
      ],
      "price": {
       "marks": 75,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TI vestment × bound free",
       "bound": "free",
       "saleBack": 30
      }
     }
    }
   },
   "bbttcc": {
    "radiation": {
     "tierDelta": -1
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0SparkyShiEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0SparkyPants01",
  "name": "Sparky Reactor-Suit Pants (Crown Mall, 2077)",
  "type": "gear",
  "img": "icons/equipment/leg/pants-brown-orange-leather-pants.webp",
  "system": {
   "slot": "costume",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn",
    "set:sparky",
    "costume",
    "pants",
    "grief-towns"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Yellow padded trousers, the paw on one hip, knees out. Dewey of Chuckle Creek traded them for a ride on your rig and did not need them, because nothing there hurts. His brother had the top but got too big. The set was never complete in any one town. That was the whole trouble with that Halloween.</p><p><em>Evasion +1 and +2 on Athletics checks while worn — the knees are gone because the kid who wore them ran everywhere, and the pants remember how.</em></p><p>Worn (costume) — equip it on the sheet (◇ → ◆) for the benefit. Part of the Sparky set: wear all three and the Wendigo don't take you.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "self",
      "frame": "vestment",
      "signature": "Both knees worn through to the lining. Eleven thousand and six pianos.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Yellow padded trousers, the paw on one hip, knees out. Dewey of Chuckle Creek traded them for a ride on your rig and did not need them, because nothing there hurts. His brother had the top but got too big. The set was never complete in any one town. That was the whole trouble with that Halloween.</p>",
      "materialOf": [
       "padded-cloth",
       "reflective-tape",
       "mascot-energy"
      ],
      "price": {
       "marks": 75,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TI vestment × bound free",
       "bound": "free",
       "saleBack": 30
      }
     }
    },
    "passives": {
     "checkBonus": [
      {
       "context": "check",
       "skill": "athletics",
       "bonus": 2,
       "note": "kids run"
      }
     ]
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.evasion",
       "value": 1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0SparkyPanEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0ReeveRing0001",
  "name": "Ring of the Reeve's Toll",
  "type": "gear",
  "img": "icons/equipment/finger/ring-signet-copper.webp",
  "system": {
   "slot": "ring",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Hollis Varn wore it on the hand he held out. He had a rate for everyone and a reason for every rate, and the ring made both sound settled. It will do the same for you, which is not entirely a gift.</p><p><em>+1 on Intimidation and Streetwise checks while worn. Every bridge has a price; the ring remembers which hand to hold out.</em></p><p>Worn (ring) — equip it on the sheet (◇ → ◆) for the benefit.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "talisman",
      "signature": "A copper signet worn smooth on the inside by two centuries of being turned.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Hollis Varn wore it on the hand he held out. He had a rate for everyone and a reason for every rate, and the ring made both sound settled. It will do the same for you, which is not entirely a gift.</p>",
      "materialOf": [
       "copper",
       "toll-stamp"
      ],
      "price": {
       "marks": 180,
       "currency": "softpower",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII talisman × bound free",
       "bound": "free",
       "saleBack": 72
      }
     }
    },
    "passives": {
     "checkBonus": [
      {
       "context": "check",
       "skill": "intimidation",
       "bonus": 1
      },
      {
       "context": "check",
       "skill": "streetwise",
       "bonus": 1
      }
     ]
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0DrownLocket01",
  "name": "Drowned South Locket",
  "type": "gear",
  "img": "icons/equipment/neck/amulet-carved-stone-bottle.webp",
  "system": {
   "slot": "amulet",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>The Ferryman kept it against his chest for the river's sake. Open it and there is water in it, river water, and the water is not still. Wear it and the Drowned South will carry you across instead of down.</p><p><em>Resolve +1 while worn, and you cannot drown — the locket holds one breath, and it is always the next one.</em></p><p>Worn (amulet) — equip it on the sheet (◇ → ◆) for the benefit.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "talisman",
      "signature": "A stoppered stone bottle on a chain. Something moves inside when you are not looking.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>The Ferryman kept it against his chest for the river's sake. Open it and there is water in it, river water, and the water is not still. Wear it and the Drowned South will carry you across instead of down.</p>",
      "materialOf": [
       "river-stone",
       "cork",
       "last-breath"
      ],
      "price": {
       "marks": 180,
       "currency": "softpower",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII talisman × bound free",
       "bound": "free",
       "saleBack": 72
      }
     }
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.resolve",
       "value": 1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      },
      {
       "key": "flags.fourththing.grant.condImmunes",
       "value": "drowning",
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0DrownLockEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0QuizMedal0001",
  "name": "Gloomgill's Quiz Medal",
  "type": "gear",
  "img": "icons/commodities/treasure/medal-ribbon-star-gold-red.webp",
  "system": {
   "slot": "pin",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>The marsh quizmaster gave these out, once a decade, to the one guest who got every question right. There are three in the world. The other two are on the bottom of the marsh, still pinned to the winners.</p><p><em>+2 on Lore and +1 on Occult checks while pinned on. Gloomgill asked the questions; whoever wears this knew the answers.</em></p><p>Worn (pin) — equip it on the sheet (◇ → ◆) for the benefit.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "self",
      "frame": "talisman",
      "signature": "FIRST PLACE, in gilt, over a question mark.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>The marsh quizmaster gave these out, once a decade, to the one guest who got every question right. There are three in the world. The other two are on the bottom of the marsh, still pinned to the winners.</p>",
      "materialOf": [
       "gilt",
       "ribbon",
       "right-answer"
      ],
      "price": {
       "marks": 540,
       "currency": "softpower",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII talisman × bound free",
       "bound": "free",
       "saleBack": 216
      }
     }
    },
    "passives": {
     "checkBonus": [
      {
       "context": "check",
       "skill": "lore",
       "bonus": 2
      },
      {
       "context": "check",
       "skill": "occult",
       "bonus": 1
      }
     ]
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0PirateEarring",
  "name": "Sky-Pirate's Earring",
  "type": "gear",
  "img": "icons/commodities/treasure/trinket-wing-white.webp",
  "system": {
   "slot": "trinket",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Sklar Bjrornholt wore one; the other is on whoever took the last ship before this one. The bead is a drop of the high cold sky, and it wants to be up there, and it will pull you along.</p><p><em>Initiative +2 and +1 on Piloting checks while worn. Valhaulan boarders move first or not at all.</em></p><p>Worn (trinket) — equip it on the sheet (◇ → ◆) for the benefit.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "self",
      "frame": "talisman",
      "signature": "A gold hoop with a blue bead that is not glass.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Sklar Bjrornholt wore one; the other is on whoever took the last ship before this one. The bead is a drop of the high cold sky, and it wants to be up there, and it will pull you along.</p>",
      "materialOf": [
       "gold",
       "sky-bead"
      ],
      "price": {
       "marks": 540,
       "currency": "softpower",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII talisman × bound free",
       "bound": "free",
       "saleBack": 216
      }
     }
    },
    "passives": {
     "checkBonus": [
      {
       "context": "check",
       "skill": "piloting",
       "bonus": 1
      }
     ],
     "initiative": {
      "bonus": 2
     }
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0GeraldLanyard",
  "name": "Gerald's Lanyard, Laminated",
  "type": "gear",
  "img": "icons/sundries/documents/document-official-capital.webp",
  "system": {
   "slot": "amulet",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Laminated, which is why it survived. Gerald wore it to every meeting including the last one. It confers no authority whatsoever and everyone who sees it behaves as though it does, which is the only kind of authority there has ever been.</p><p><em>Surge cap +1 and +1 on Diplomacy checks while worn. It says ASSISTANT REGIONAL MANAGER, and things that read it tend to wait their turn.</em></p><p>Worn (amulet) — equip it on the sheet (◇ → ◆) for the benefit.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "self",
      "frame": "talisman",
      "signature": "GERALD — ASSISTANT REGIONAL MANAGER — APOCALYPSE (REGION 4). The photo is not of Gerald.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Laminated, which is why it survived. Gerald wore it to every meeting including the last one. It confers no authority whatsoever and everyone who sees it behaves as though it does, which is the only kind of authority there has ever been.</p>",
      "materialOf": [
       "laminate",
       "nylon",
       "middle-management"
      ],
      "price": {
       "marks": 540,
       "currency": "softpower",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII talisman × bound free",
       "bound": "free",
       "saleBack": 216
      }
     }
    },
    "passives": {
     "checkBonus": [
      {
       "context": "check",
       "skill": "diplomacy",
       "bonus": 1,
       "note": "the badge opens doors, slowly"
      }
     ]
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.surgeCap",
       "value": 1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0GeraldLanEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0MaargRing0001",
  "name": "Maarg's Collector's Ring",
  "type": "gear",
  "img": "icons/equipment/finger/ring-cabochon-gold-purple.webp",
  "system": {
   "slot": "ring",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "worn"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Desenitarius Maarg wore it on the old roads and took a dream from everyone who paid the toll, and kept them here, in the stone, like coins. Wear it and the dreams press back against whatever presses in. Attunes to one wearer; it is particular about company.</p><p><em>Surge cap +1 and resistance to psychic harm while worn. The Collector kept everyone else's dreams in it; it has room for yours to run hotter.</em></p><p>Worn (ring) — equip it on the sheet (◇ → ◆) for the benefit.</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "IV",
      "footprint": 1,
      "reach": "self",
      "frame": "talisman",
      "signature": "A purple cabochon with something small and sleeping inside it.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Desenitarius Maarg wore it on the old roads and took a dream from everyone who paid the toll, and kept them here, in the stone, like coins. Wear it and the dreams press back against whatever presses in. Attunes to one wearer; it is particular about company.</p>",
      "materialOf": [
       "old-gold",
       "dream-cabochon",
       "collected-sleep"
      ],
      "price": {
       "marks": 1620,
       "currency": "softpower",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIV talisman × bound attuned",
       "bound": "attuned",
       "saleBack": 648
      }
     }
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.surgeCap",
       "value": 1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      },
      {
       "key": "flags.fourththing.grant.resists",
       "value": "psychic",
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0MaargRingEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0FogMachine001",
  "name": "Fog Machine, Party Grade",
  "type": "gear",
  "img": "icons/tools/laboratory/bowl-liquid-orange.webp",
  "system": {
   "slot": "trinket",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "bound-working",
    "gadget"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>The Chuckle Creek showrunner's. It made the series finale look like a series finale. The reservoir refills itself between scenes because that is what reservoirs do on television.</p><p><strong>Bound Working — Dry Ice:</strong> A bank of stage fog boils out around you until your next turn: Evasion +2 while it stands, and you may move 2 squares unseen as part of the cast.</p><p>2 charges, recovers per scene. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "self",
      "frame": "tool",
      "signature": "A dented party fog machine with a reservoir that never runs dry.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>The Chuckle Creek showrunner's. It made the series finale look like a series finale. The reservoir refills itself between scenes because that is what reservoirs do on television.</p>",
      "materialOf": [
       "pre-fall-component",
       "glycol",
       "stage-direction"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 60,
       "currency": "economy",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TI tool × tech 2.0 (bound Working: Dry Ice) × attuned",
       "bound": "attuned",
       "saleBack": 24
      }
     }
    },
    "working": {
     "power": {
      "name": "Dry Ice",
      "img": "icons/magic/air/fog-gas-smoke-dense-gray.webp",
      "system": {
       "intent": "intrigue",
       "channel": "mind",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "self",
       "range": "self",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "A bank of stage fog boils out around you until your next turn: Evasion +2 while it stands, and you may move 2 squares unseen as part of the cast.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "fog",
        "stealth"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'It worked at the finale. Finales are mostly fog.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "cloud",
        "function": "conceal",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 30,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "circle",
         "size": 2
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": false,
         "defense": "evasion",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [
          {
           "stat": "evasion",
           "op": "+",
           "value": 2
          }
         ],
         "resists": [],
         "immunes": []
        }
       },
       "description": {
        "value": "<p>A bank of stage fog boils out around you until your next turn: Evasion +2 while it stands, and you may move 2 squares unseen as part of the cast.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0DoorbellCam01",
  "name": "Doorbell Camera, Still Recording",
  "type": "gear",
  "img": "icons/tools/navigation/spyglass-telescope-brass.webp",
  "system": {
   "slot": "lens",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "bound-working",
    "gadget"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>From Miss June's rare inventory: the camera from a porch on Mallwalker Lane, the night of the thirty-first. It has footage. It will show you the footage if you hold it to your eye, and it will also show you the next thirty seconds, which it should not have.</p><p><strong>Bound Working — Playback:</strong> Review the last thirty seconds from every angle: hidden or invisible things within 6 squares are revealed to you until your next turn, and you may not be surprised this round.</p><p>2 charges, recovers per scene. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "tool",
      "signature": "A doorbell camera, unplugged for two centuries, with a live red light.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>From Miss June's rare inventory: the camera from a porch on Mallwalker Lane, the night of the thirty-first. It has footage. It will show you the footage if you hold it to your eye, and it will also show you the next thirty seconds, which it should not have.</p>",
      "materialOf": [
       "pre-fall-component",
       "witness-glass",
       "porchlight"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 180,
       "currency": "economy",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII tool × tech 2.0 (bound Working: Playback) × attuned",
       "bound": "attuned",
       "saleBack": 72
      }
     }
    },
    "working": {
     "power": {
      "name": "Playback",
      "img": "icons/magic/perception/eye-ringed-glow-angry-small-red.webp",
      "system": {
       "intent": "intrigue",
       "channel": "mind",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "self",
       "range": "near",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "Review the last thirty seconds from every angle: hidden or invisible things within 6 squares are revealed to you until your next turn, and you may not be surprised this round.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "sight",
        "reveal"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'It saw the kid come to the door. It is still seeing it.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "lens",
        "function": "reveal",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 30,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "none",
         "size": 0
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": false,
         "defense": "evasion",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [],
         "resists": [],
         "immunes": []
        }
       },
       "description": {
        "value": "<p>Review the last thirty seconds from every angle: hidden or invisible things within 6 squares are revealed to you until your next turn, and you may not be surprised this round.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0SpiritBoard01",
  "name": "Spirit Board, Travel Edition",
  "type": "gear",
  "img": "icons/sundries/gaming/magic-eight-ball.webp",
  "system": {
   "slot": "trinket",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "bound-working",
    "gadget"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Soft Landing's. The kids played it at the state function the night the ground went soft, and it told them something, and then the Mayor banged the gavel and they never finished asking. It still wants to finish.</p><p><strong>Bound Working — Ask the Board:</strong> One target within 6 squares: Soul defense vs Cast DC. On a fail they are Compelled for 1 round — they answer one question truthfully, and the planchette moves on its own to confirm it.</p><p>2 charges, recovers per scene. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "tool",
      "signature": "A folding spirit board, letters worn smooth at YES and at GOODBYE.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Soft Landing's. The kids played it at the state function the night the ground went soft, and it told them something, and then the Mayor banged the gavel and they never finished asking. It still wants to finish.</p>",
      "materialOf": [
       "pre-fall-component",
       "pressboard",
       "unfinished-question"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 180,
       "currency": "economy",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII tool × tech 2.0 (bound Working: Ask the Board) × attuned",
       "bound": "attuned",
       "saleBack": 72
      }
     }
    },
    "working": {
     "power": {
      "name": "Ask the Board",
      "img": "icons/magic/symbols/runes-triangle-orange-purple.webp",
      "system": {
       "intent": "presence",
       "channel": "soul",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "single",
       "range": "near",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "One target within 6 squares: Soul defense vs Cast DC. On a fail they are Compelled for 1 round — they answer one question truthfully, and the planchette moves on its own to confirm it.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "compel",
        "truth"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'Everyone pushes the planchette. The trick is the board pushes back.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "sigil",
        "function": "compel",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 30,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "none",
         "size": 0
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": true,
         "defense": "resolve",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [],
         "resists": [],
         "immunes": []
        },
        "appliedStates": {
         "states": [
          "compelled"
         ],
         "duration": "1-round"
        }
       },
       "description": {
        "value": "<p>One target within 6 squares: Soul defense vs Cast DC. On a fail they are Compelled for 1 round — they answer one question truthfully, and the planchette moves on its own to confirm it.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0GlowBandoli01",
  "name": "Glow-Stick Bandolier",
  "type": "gear",
  "img": "icons/sundries/lights/lantern-emergency-lit.webp",
  "system": {
   "slot": "trinket",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "bound-working",
    "gadget"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Stillwater parade-marshal issue. Glow sticks are supposed to die by morning; these have been going since 2077 because the parade has not ended. Crack one and for a round the dark remembers it is supposed to be a party.</p><p><strong>Bound Working — Crack and Shake:</strong> Crack a stick and the parade route lights up: you and every ally within 3 squares gain Evasion +1 for 1 round, and the area is brightly lit until your next turn.</p><p>3 charges, recovers per scene. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "self",
      "frame": "tool",
      "signature": "Twelve glow sticks on a sash, all still glowing.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Stillwater parade-marshal issue. Glow sticks are supposed to die by morning; these have been going since 2077 because the parade has not ended. Crack one and for a round the dark remembers it is supposed to be a party.</p>",
      "materialOf": [
       "pre-fall-component",
       "luminol",
       "parade-permit"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 3,
        "max": 3,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 60,
       "currency": "economy",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TI tool × tech 2.0 (bound Working: Crack and Shake) × attuned",
       "bound": "attuned",
       "saleBack": 24
      }
     }
    },
    "working": {
     "power": {
      "name": "Crack and Shake",
      "img": "icons/magic/light/beams-rays-orange-purple-large.webp",
      "system": {
       "intent": "intrigue",
       "channel": "mind",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "self",
       "range": "near",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "Crack a stick and the parade route lights up: you and every ally within 3 squares gain Evasion +1 for 1 round, and the area is brightly lit until your next turn.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "light",
        "ward"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'Green means go. Nobody at the parade ever decided what red meant.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "light",
        "function": "protect",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 30,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "circle",
         "size": 3
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": false,
         "defense": "evasion",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [
          {
           "stat": "evasion",
           "op": "+",
           "value": 1
          }
         ],
         "resists": [],
         "immunes": []
        }
       },
       "description": {
        "value": "<p>Crack a stick and the parade route lights up: you and every ally within 3 squares gain Evasion +1 for 1 round, and the area is brightly lit until your next turn.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 3,
      "max": 3,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0WalkiePair001",
  "name": "Pre-Fall Walkie, One of a Pair",
  "type": "gear",
  "img": "icons/tools/navigation/compass-brass-blue-red.webp",
  "system": {
   "slot": "trinket",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "bound-working",
    "gadget"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Chuckle Creek. The new episode needed a prop and this was in the drawer. It has no batteries and it works, and sometimes when you key it the other one keys back, from somewhere that is not Chuckle Creek, and a courteous voice says thank you for the directions.</p><p><strong>Bound Working — Over.:</strong> Key the walkie: one ally within 12 squares hears you clear as a bell and gains Resolve +2 for 1 round. Occasionally someone else answers. Do not answer back.</p><p>2 charges, recovers per scene. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "tool",
      "signature": "A yellow kids' walkie-talkie, channel 3, battery compartment empty, working.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Chuckle Creek. The new episode needed a prop and this was in the drawer. It has no batteries and it works, and sometimes when you key it the other one keys back, from somewhere that is not Chuckle Creek, and a courteous voice says thank you for the directions.</p>",
      "materialOf": [
       "pre-fall-component",
       "yesodium",
       "channel-three"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 180,
       "currency": "economy",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII tool × tech 2.0 (bound Working: Over.) × attuned",
       "bound": "attuned",
       "saleBack": 72
      }
     }
    },
    "working": {
     "power": {
      "name": "Over.",
      "img": "icons/magic/sonic/projectile-sound-rings-wave.webp",
      "system": {
       "intent": "intrigue",
       "channel": "mind",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "single",
       "range": "far",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "Key the walkie: one ally within 12 squares hears you clear as a bell and gains Resolve +2 for 1 round. Occasionally someone else answers. Do not answer back.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "comms",
        "steady"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'The other one is out there. Somebody has it. Somebody is very polite about it.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "voice",
        "function": "steady",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 60,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "none",
         "size": 0
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": false,
         "defense": "evasion",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [
          {
           "stat": "resolve",
           "op": "+",
           "value": 2
          }
         ],
         "resists": [],
         "immunes": []
        }
       },
       "description": {
        "value": "<p>Key the walkie: one ally within 12 squares hears you clear as a bell and gains Resolve +2 for 1 round. Occasionally someone else answers. Do not answer back.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0CandyScale001",
  "name": "Candy Scale, Calibrated to 2077",
  "type": "gear",
  "img": "icons/commodities/tech/clock-stopwatch-brass.webp",
  "system": {
   "slot": "trinket",
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "bound-working",
    "gadget"
   ],
   "category": "gear",
   "source": "",
   "quantity": 1,
   "description": {
    "value": "<p>Bucky Sorrel's, from the lemonade concession, used to weigh the haul on the thirty-first. It still measures in 2077 candy. Put anything on it and it tells you what that thing would have fetched at the end of the night, and it is never as much as you hoped.</p><p><strong>Bound Working — Weigh It:</strong> Set the scale before one target within 6 squares: Mind defense vs Cast DC. On a fail it tells them exactly what they are worth, in candy, and they are Shaken for 1 round.</p><p>2 charges, recovers per scene. Cast it from the Manifestations tab like any power — it spends a charge instead of Clarity (Noise and misfire still apply).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "self",
      "frame": "tool",
      "signature": "A brass candy scale, pans polished, needle steady at a number that is always a little low.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Bucky Sorrel's, from the lemonade concession, used to weigh the haul on the thirty-first. It still measures in 2077 candy. Put anything on it and it tells you what that thing would have fetched at the end of the night, and it is never as much as you hoped.</p>",
      "materialOf": [
       "pre-fall-component",
       "brass",
       "fun-size"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 60,
       "currency": "economy",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TI tool × tech 2.0 (bound Working: Weigh It) × attuned",
       "bound": "attuned",
       "saleBack": 24
      }
     }
    },
    "working": {
     "power": {
      "name": "Weigh It",
      "img": "icons/magic/control/debuff-energy-hold-levitate-yellow.webp",
      "system": {
       "intent": "presence",
       "channel": "mind",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "single",
       "range": "near",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "Set the scale before one target within 6 squares: Mind defense vs Cast DC. On a fail it tells them exactly what they are worth, in candy, and they are Shaken for 1 round.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "shaken",
        "truth"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'Everybody wants to know. Nobody wants to know in fun-size.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "sigil",
        "function": "shake",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 30,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "none",
         "size": 0
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": true,
         "defense": "resolve",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [],
         "resists": [],
         "immunes": []
        },
        "appliedStates": {
         "states": [
          "shaken"
         ],
         "duration": "1-round"
        }
       },
       "description": {
        "value": "<p>Set the scale before one target within 6 squares: Mind defense vs Cast DC. On a fail it tells them exactly what they are worth, in candy, and they are Shaken for 1 round.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0CandyCleaver1",
  "name": "Inlaid Candy-Corn Cleaver",
  "type": "weapon",
  "img": "icons/weapons/swords/sword-broad-red.webp",
  "system": {
   "category": "melee",
   "intent": "violence",
   "skill": "melee",
   "damage": {
    "formula": "1d8+1",
    "attribute": "violence",
    "type": "kinetic",
    "damageFlavor": "blade",
    "track": "integrity"
   },
   "damageParts": [],
   "range": {
    "short": 1,
    "long": 1,
    "units": "sq"
   },
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "graded",
    "grade-inlaid",
    "machete",
    "cleaver"
   ],
   "effect": "A machete, Inlaid: +1 to hit and +1 damage. Confiscated from a child in 2077 and sharpened since by someone who was not one.",
   "flavor": "Orange at the back, yellow at the edge, white where it bites.",
   "manifestation": {
    "tier": 1,
    "family": "form",
    "concept": "",
    "form": "weapon",
    "function": "harm",
    "stability": "bound",
    "interactionModel": "weapon",
    "costType": "none",
    "costValue": 0,
    "costText": "",
    "duration": "scene",
    "durationText": "",
    "triggerText": "",
    "scale": "personal",
    "targetText": "",
    "rangeAreaText": "",
    "rangeFt": 0,
    "maintenanceCost": "",
    "riskText": "",
    "pathResonance": "",
    "fictionalPermission": "",
    "gmCalibration": "",
    "mechanicalHook": "",
    "signature": "",
    "thirdThing": "",
    "opCost": {
     "pool": "",
     "value": 0
    }
   },
   "description": {
    "value": "<p>Hollis Varn's. The blade is painted in three stripes like the candy and the paint has never chipped, which is not how paint works. He used it at the toll bar on the people who argued about the rate. There were not many arguments.</p><p><em>A machete, Inlaid: +1 to hit and +1 damage. Confiscated from a child in 2077 and sharpened since by someone who was not one.</em></p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "melee",
      "frame": "weapon",
      "signature": "Three stripes. Never chips.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Hollis Varn's. The blade is painted in three stripes like the candy and the paint has never chipped, which is not how paint works. He used it at the toll bar on the people who argued about the rate. There were not many arguments.</p>",
      "materialOf": [
       "scrap-steel",
       "enamel",
       "toll-stamp"
      ],
      "price": {
       "marks": 150,
       "currency": "violence",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII weapon (Inlaid +1) × bound free",
       "bound": "free",
       "saleBack": 60
      }
     }
    },
    "grade": {
     "rank": 1,
     "name": "Inlaid",
     "key": "inlaid",
     "attack": 1,
     "damage": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0LanternFlail1",
  "name": "Inlaid Lantern-Head Flail",
  "type": "weapon",
  "img": "icons/weapons/maces/flail-studded-grey.webp",
  "system": {
   "category": "melee",
   "intent": "violence",
   "skill": "melee",
   "damage": {
    "formula": "1d8+1",
    "attribute": "violence",
    "type": "kinetic",
    "damageFlavor": "blunt",
    "track": "integrity"
   },
   "damageParts": [],
   "range": {
    "short": 1,
    "long": 1,
    "units": "sq"
   },
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "graded",
    "grade-inlaid",
    "flail",
    "mace",
    "light-source"
   ],
   "effect": "A flail, Inlaid: +1 to hit and +1 damage. The hollow iron head holds a candle that will not go out — bright light 4 squares while it is in your hand.",
   "flavor": "A carved iron pumpkin on a chain, grinning, lit from inside.",
   "manifestation": {
    "tier": 1,
    "family": "form",
    "concept": "",
    "form": "weapon",
    "function": "harm",
    "stability": "bound",
    "interactionModel": "weapon",
    "costType": "none",
    "costValue": 0,
    "costText": "",
    "duration": "scene",
    "durationText": "",
    "triggerText": "",
    "scale": "personal",
    "targetText": "",
    "rangeAreaText": "",
    "rangeFt": 0,
    "maintenanceCost": "",
    "riskText": "",
    "pathResonance": "",
    "fictionalPermission": "",
    "gmCalibration": "",
    "mechanicalHook": "",
    "signature": "",
    "thirdThing": "",
    "opCost": {
     "pool": "",
     "value": 0
    }
   },
   "description": {
    "value": "<p>Gloomgill kept it by the quiz lectern for the guests who answered wrong. The face is cut into the iron and the candle behind it has burned since the marsh went dark, and it is cheerful about it, which is worse.</p><p><em>A flail, Inlaid: +1 to hit and +1 damage. The hollow iron head holds a candle that will not go out — bright light 4 squares while it is in your hand.</em></p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "melee",
      "frame": "weapon",
      "signature": "The grin is lit from inside.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Gloomgill kept it by the quiz lectern for the guests who answered wrong. The face is cut into the iron and the candle behind it has burned since the marsh went dark, and it is cheerful about it, which is worse.</p>",
      "materialOf": [
       "cast-iron",
       "chain",
       "tallow-that-will-not"
      ],
      "price": {
       "marks": 150,
       "currency": "violence",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII weapon (Inlaid +1) × bound free",
       "bound": "free",
       "saleBack": 60
      }
     }
    },
    "grade": {
     "rank": 1,
     "name": "Inlaid",
     "key": "inlaid",
     "attack": 1,
     "damage": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0PorchCarbine1",
  "name": "Circuited Porchlight Carbine",
  "type": "weapon",
  "img": "icons/weapons/guns/rifle-brown.webp",
  "system": {
   "category": "ranged",
   "intent": "violence",
   "skill": "firearms",
   "damage": {
    "formula": "1d10+2",
    "attribute": "violence",
    "type": "kinetic",
    "damageFlavor": "ballistic",
    "track": "integrity"
   },
   "damageParts": [],
   "range": {
    "short": 8,
    "long": 32,
    "units": "sq"
   },
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "graded",
    "grade-circuited",
    "bound-working",
    "carbine",
    "rifle",
    "pre-fall"
   ],
   "effect": "A carbine, Circuited: +2 to hit and +2 damage; attunes to one hand. Under the barrel, a porchlight that was a perimeter light once.",
   "flavor": "The light comes on by itself when something is on the step.",
   "manifestation": {
    "tier": 1,
    "family": "form",
    "concept": "",
    "form": "weapon",
    "function": "harm",
    "stability": "bound",
    "interactionModel": "weapon",
    "costType": "none",
    "costValue": 0,
    "costText": "",
    "duration": "scene",
    "durationText": "",
    "triggerText": "",
    "scale": "personal",
    "targetText": "",
    "rangeAreaText": "",
    "rangeFt": 0,
    "maintenanceCost": "",
    "riskText": "",
    "pathResonance": "",
    "fictionalPermission": "",
    "gmCalibration": "",
    "mechanicalHook": "",
    "signature": "",
    "thirdThing": "",
    "opCost": {
     "pool": "",
     "value": 0
    }
   },
   "description": {
    "value": "<p>Compliance Engine PRIME's perimeter arm, re-barrelled by a hex gunsmith who did not ask what the light was for. The light is for knowing who is on the porch. It still knows.</p><p><em>A carbine, Circuited: +2 to hit and +2 damage; attunes to one hand. Under the barrel, a porchlight that was a perimeter light once.</em></p><p><strong>Bound Working — Porchlight:</strong> Light one target within 12 squares: Evasion defense vs Cast DC. On a fail they are lit for 1 round — Evasion −2, and nothing they do is unseen. (2 charges, recovers per scene.)</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "32",
      "frame": "weapon",
      "signature": "The porchlight comes on by itself.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Compliance Engine PRIME's perimeter arm, re-barrelled by a hex gunsmith who did not ask what the light was for. The light is for knowing who is on the porch. It still knows.</p>",
      "materialOf": [
       "gun-steel",
       "pre-fall-component",
       "hex-glyph-plate",
       "perimeter-light"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 900,
       "currency": "violence",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII weapon (Circuited +2) × tech 2.0 (bound Working: Porchlight) × bound attuned",
       "bound": "attuned",
       "saleBack": 360
      }
     }
    },
    "grade": {
     "rank": 2,
     "name": "Circuited",
     "key": "circuited",
     "attack": 2,
     "damage": 2
    },
    "working": {
     "power": {
      "name": "Porchlight",
      "img": "icons/magic/light/beam-rays-yellow.webp",
      "system": {
       "intent": "violence",
       "channel": "body",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "single",
       "range": "far",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "Light one target within 12 squares: Evasion defense vs Cast DC. On a fail they are lit for 1 round — Evasion −2, and nothing they do is unseen.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "mark",
        "light"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'Trick or treat. The porch decides which.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "beam",
        "function": "mark",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 60,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "none",
         "size": 0
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": true,
         "defense": "evasion",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [
          {
           "stat": "evasion",
           "op": "-",
           "value": 2
          }
         ],
         "resists": [],
         "immunes": []
        }
       },
       "description": {
        "value": "<p>Light one target within 12 squares: Evasion defense vs Cast DC. On a fail they are lit for 1 round — Evasion −2, and nothing they do is unseen.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0DoorKnuckle01",
  "name": "Circuited Doorbell Knuckles",
  "type": "weapon",
  "img": "icons/weapons/fist/claw-gauntlet-gray.webp",
  "system": {
   "category": "melee",
   "intent": "violence",
   "skill": "brawl",
   "damage": {
    "formula": "1d6+2",
    "attribute": "violence",
    "type": "kinetic",
    "damageFlavor": "chime",
    "track": "integrity"
   },
   "damageParts": [],
   "range": {
    "short": 1,
    "long": 1,
    "units": "sq"
   },
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "graded",
    "grade-circuited",
    "bound-working",
    "knuckles",
    "fist",
    "doorbell"
   ],
   "effect": "Brass knuckles, Circuited: +2 to hit and +2 damage; attunes to one hand. Each knuckle is a doorbell button. Each one rings.",
   "flavor": "Ding. Dong. Ditch.",
   "manifestation": {
    "tier": 1,
    "family": "form",
    "concept": "",
    "form": "weapon",
    "function": "harm",
    "stability": "bound",
    "interactionModel": "weapon",
    "costType": "none",
    "costValue": 0,
    "costText": "",
    "duration": "scene",
    "durationText": "",
    "triggerText": "",
    "scale": "personal",
    "targetText": "",
    "rangeAreaText": "",
    "rangeFt": 0,
    "maintenanceCost": "",
    "riskText": "",
    "pathResonance": "",
    "fictionalPermission": "",
    "gmCalibration": "",
    "mechanicalHook": "",
    "signature": "",
    "thirdThing": "",
    "opCost": {
     "pool": "",
     "value": 0
    }
   },
   "description": {
    "value": "<p>Kickflip Lazarus wore them for the run-back and gave them to the one who skated it clean. Four doorbell buttons on a brass bar; hit something and every porch on Mallwalker Lane rings at once, two hundred years late.</p><p><em>Brass knuckles, Circuited: +2 to hit and +2 damage; attunes to one hand. Each knuckle is a doorbell button. Each one rings.</em></p><p><strong>Bound Working — Ding-Dong Ditch:</strong> Ring and run: step 3 squares without provoking anything and take Evasion +2 until your next turn. Best used immediately after a hit, which is the only time anyone has ever used it. (2 charges, recovers per scene.)</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "melee",
      "frame": "weapon",
      "signature": "Four buttons. All of them ring.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Kickflip Lazarus wore them for the run-back and gave them to the one who skated it clean. Four doorbell buttons on a brass bar; hit something and every porch on Mallwalker Lane rings at once, two hundred years late.</p>",
      "materialOf": [
       "brass",
       "pre-fall-component",
       "witness-glass",
       "doorbell-button"
      ],
      "tech": {
       "kind": "charged",
       "charges": {
        "value": 2,
        "max": 2,
        "recoverPer": "scene"
       },
       "fuel": null,
       "attunement": {
        "required": true,
        "slots": 1
       },
       "signature": "bound-working",
       "failure": "misfire",
       "origin": "witness-forge",
       "shielded": false
      },
      "price": {
       "marks": 900,
       "currency": "violence",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII weapon (Circuited +2) × tech 2.0 (bound Working: Ding-Dong Ditch) × bound attuned",
       "bound": "attuned",
       "saleBack": 360
      }
     }
    },
    "grade": {
     "rank": 2,
     "name": "Circuited",
     "key": "circuited",
     "attack": 2,
     "damage": 2
    },
    "working": {
     "power": {
      "name": "Ding-Dong Ditch",
      "img": "icons/magic/movement/trail-streak-impact-blue.webp",
      "system": {
       "intent": "intrigue",
       "channel": "body",
       "sephirah": "yesod",
       "mode": "hermetic",
       "clarityRequired": 0,
       "noiseGain": 0,
       "activation": "action",
       "target": "self",
       "range": "self",
       "damage": "",
       "damageType": "energy",
       "damageFlavor": "",
       "damageRoll": {
        "op": "none",
        "number": 0,
        "die": "d6",
        "attribute": "",
        "type": "kinetic",
        "flavor": "",
        "track": "integrity"
       },
       "damageParts": [],
       "effect": "Ring and run: step 3 squares without provoking anything and take Evasion +2 until your next turn. Best used immediately after a hit, which is the only time anyone has ever used it.",
       "tags": [
        "bound-working",
        "halloween-hoard",
        "move",
        "evade"
       ],
       "category": "manifestation",
       "flavor": "Mal: 'The sport of kings. Very short kings.'",
       "manifestation": {
        "tier": 1,
        "family": "working",
        "concept": "",
        "form": "step",
        "function": "move",
        "stability": "instant",
        "interactionModel": "event",
        "costType": "none",
        "costValue": 0,
        "costText": "",
        "duration": "1-round",
        "durationText": "",
        "triggerText": "",
        "scale": "personal",
        "targetText": "",
        "rangeAreaText": "",
        "rangeFt": 30,
        "maintenanceCost": "",
        "riskText": "",
        "pathResonance": "",
        "fictionalPermission": "",
        "gmCalibration": "",
        "mechanicalHook": "",
        "signature": "",
        "thirdThing": "",
        "opCost": {
         "pool": "",
         "value": 0
        },
        "area": {
         "shape": "none",
         "size": 0
        },
        "activation": {
         "type": "action",
         "consumePool": true
        },
        "save": {
         "enabled": false,
         "defense": "evasion",
         "attribute": "",
         "dcMode": "derived",
         "dcFixed": 15
        },
        "maintenanceKey": "none",
        "isSignature": false,
        "chain": {
         "enabled": false,
         "count": 3,
         "range": 30,
         "damageFormula": "1d6",
         "damageType": "",
         "carryConditions": false,
         "carryEffects": false
        },
        "conditionalDamage": [],
        "appliedEffects": {
         "modifiers": [
          {
           "stat": "evasion",
           "op": "+",
           "value": 2
          }
         ],
         "resists": [],
         "immunes": []
        }
       },
       "description": {
        "value": "<p>Ring and run: step 3 squares without provoking anything and take Evasion +2 until your next turn. Best used immediately after a hit, which is the only time anyone has ever used it.</p>",
        "chat": ""
       }
      }
     },
     "charges": {
      "value": 2,
      "max": 2,
      "recoverPer": "scene"
     },
     "tier": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0BoardingAxe01",
  "name": "Crowned Valhaulan Boarding Axe",
  "type": "weapon",
  "img": "icons/weapons/axes/axe-double-engraved-blue.webp",
  "system": {
   "category": "melee",
   "intent": "violence",
   "skill": "melee",
   "damage": {
    "formula": "1d10+3",
    "attribute": "violence",
    "type": "kinetic",
    "damageFlavor": "blade",
    "track": "integrity"
   },
   "damageParts": [],
   "range": {
    "short": 1,
    "long": 1,
    "units": "sq"
   },
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "graded",
    "grade-crowned",
    "axe",
    "valhaulan",
    "capstone"
   ],
   "effect": "A boarding axe, Crowned: +3 to hit and +3 damage; soulbound — keyed to the hand that took it from Sklar, it will not be sold. On a hit, push the target 1 square: Boarding Call.",
   "flavor": "Blue steel, Valhaulan script down the haft, a name you cannot read and will come to.",
   "manifestation": {
    "tier": 1,
    "family": "form",
    "concept": "",
    "form": "weapon",
    "function": "harm",
    "stability": "bound",
    "interactionModel": "weapon",
    "costType": "none",
    "costValue": 0,
    "costText": "",
    "duration": "scene",
    "durationText": "",
    "triggerText": "",
    "scale": "personal",
    "targetText": "",
    "rangeAreaText": "",
    "rangeFt": 0,
    "maintenanceCost": "",
    "riskText": "",
    "pathResonance": "",
    "fictionalPermission": "",
    "gmCalibration": "",
    "mechanicalHook": "",
    "signature": "",
    "thirdThing": "",
    "opCost": {
     "pool": "",
     "value": 0
    }
   },
   "description": {
    "value": "<p>Sklar Bjrornholt's. It has gone over the rail of eleven ships and come back every time. The script on the haft is the new hand, the one Etta knows, and it spells the axe's name, and the axe will tell you the name the first time you kill with it and never again.</p><p><em>A boarding axe, Crowned: +3 to hit and +3 damage; soulbound — keyed to the hand that took it from Sklar, it will not be sold. On a hit, push the target 1 square: Boarding Call.</em></p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "IV",
      "footprint": 1,
      "reach": "melee",
      "frame": "weapon",
      "signature": "It will tell you its name once.",
      "origin": "looted",
      "originator": null,
      "bound": "soulbound",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Sklar Bjrornholt's. It has gone over the rail of eleven ships and come back every time. The script on the haft is the new hand, the one Etta knows, and it spells the axe's name, and the axe will tell you the name the first time you kill with it and never again.</p>",
      "materialOf": [
       "sky-steel",
       "valhaulan-script",
       "a-true-name"
      ],
      "price": {
       "marks": 2025,
       "currency": "violence",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIV weapon (Crowned +3) × bound soulbound",
       "bound": "soulbound",
       "saleBack": 0
      }
     }
    },
    "grade": {
     "rank": 3,
     "name": "Crowned",
     "key": "crowned",
     "attack": 3,
     "damage": 3
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0EggShotgun001",
  "name": "Inlaid Egg-Carton Shotgun",
  "type": "weapon",
  "img": "icons/weapons/guns/gun-blunderbuss-gold.webp",
  "system": {
   "category": "ranged",
   "intent": "violence",
   "skill": "firearms",
   "damage": {
    "formula": "1d10+1",
    "attribute": "violence",
    "type": "kinetic",
    "damageFlavor": "ballistic",
    "track": "integrity"
   },
   "damageParts": [],
   "range": {
    "short": 2,
    "long": 8,
    "units": "sq"
   },
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "graded",
    "grade-inlaid",
    "shotgun",
    "sawed-off",
    "trick-or-treat"
   ],
   "effect": "A sawed-off, Inlaid: +1 to hit and +1 damage. Loaded from an egg carton; when you fire it at one target, an adjacent second target takes the spray too (GM applies the roll's damage once more).",
   "flavor": "A dozen in the carton. You are always one short.",
   "manifestation": {
    "tier": 1,
    "family": "form",
    "concept": "",
    "form": "weapon",
    "function": "harm",
    "stability": "bound",
    "interactionModel": "weapon",
    "costType": "none",
    "costValue": 0,
    "costText": "",
    "duration": "scene",
    "durationText": "",
    "triggerText": "",
    "scale": "personal",
    "targetText": "",
    "rangeAreaText": "",
    "rangeFt": 0,
    "maintenanceCost": "",
    "riskText": "",
    "pathResonance": "",
    "fictionalPermission": "",
    "gmCalibration": "",
    "mechanicalHook": "",
    "signature": "",
    "thirdThing": "",
    "opCost": {
     "pool": "",
     "value": 0
    }
   },
   "description": {
    "value": "<p>Donny on the Wall took it off a party at the mall gate in 2077 and has kept it, like everything else, out of a sense that someone should. He gives it to the ones who answer honestly. The carton is always one egg short and the gun does not seem to mind.</p><p><em>A sawed-off, Inlaid: +1 to hit and +1 damage. Loaded from an egg carton; when you fire it at one target, an adjacent second target takes the spray too (GM applies the roll's damage once more).</em></p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "8",
      "frame": "weapon",
      "signature": "Always one egg short.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Donny on the Wall took it off a party at the mall gate in 2077 and has kept it, like everything else, out of a sense that someone should. He gives it to the ones who answer honestly. The carton is always one egg short and the gun does not seem to mind.</p>",
      "materialOf": [
       "scrap-steel",
       "egg-carton",
       "bad-vibes"
      ],
      "price": {
       "marks": 150,
       "currency": "violence",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII weapon (Inlaid +1) × bound free",
       "bound": "free",
       "saleBack": 60
      }
     }
    },
    "grade": {
     "rank": 1,
     "name": "Inlaid",
     "key": "inlaid",
     "attack": 1,
     "damage": 1
    }
   }
  },
  "effects": [],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0ApexHideCoat1",
  "name": "Inlaid Apex Hide Coat",
  "type": "armor",
  "img": "icons/equipment/chest/breastplate-scale-leather.webp",
  "system": {
   "guardBonus": 3,
   "evasionBonus": 0,
   "resolveBonus": 0,
   "resistances": [
    "thermal"
   ],
   "armorSkill": "bracing",
   "equipped": false,
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "medium",
    "graded",
    "grade-inlaid",
    "coat",
    "hide"
   ],
   "category": "armor",
   "source": "",
   "description": {
    "value": "<p>Whoever skinned the Apex Predator did it fast and did not stay. The hide holds heat the way the animal did, and whatever the animal was immune to, you are now a little immune to, and whatever it was afraid of, you will be afraid of too.</p><p><em>Medium, Inlaid: Guard +3, resists thermal. Needs Bracing. The hide of the thing that ate the things that ate people.</em></p><p>Guard +3 · Evasion +0 · Resolve +0 · resists thermal — medium, needs bracing (Trained = half, Proficient = full).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "armor",
      "signature": "Still warm.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Whoever skinned the Apex Predator did it fast and did not stay. The hide holds heat the way the animal did, and whatever the animal was immune to, you are now a little immune to, and whatever it was afraid of, you will be afraid of too.</p>",
      "materialOf": [
       "apex-hide",
       "sinew",
       "hex-inlay"
      ],
      "price": {
       "marks": 225,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII armor (Inlaid +1) × bound free",
       "bound": "free",
       "saleBack": 90
      }
     }
    },
    "grade": {
     "rank": 1,
     "name": "Inlaid",
     "key": "inlaid",
     "defense": 1
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 3,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0ApexHideCEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0MallVest00001",
  "name": "Inlaid Mall Security Vest",
  "type": "armor",
  "img": "icons/equipment/chest/vest-cloth-tattered-orange.webp",
  "system": {
   "guardBonus": 3,
   "evasionBonus": 0,
   "resolveBonus": 0,
   "resistances": [],
   "armorSkill": "fitting",
   "equipped": false,
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "light",
    "graded",
    "grade-inlaid",
    "vest",
    "security",
    "crown-mall"
   ],
   "category": "armor",
   "source": "",
   "description": {
    "value": "<p>Crown Mall issue, 2077, hi-vis gone to amber. The Tanneritos keep one as a reminder of what not to be and give it away when they make peace, because nothing makes a person less of a cop than being handed the vest by the kids. The inlay is theirs. It is very good inlay.</p><p><em>Light, Inlaid: Guard +3. Needs Fitting. The Tanneritos gave it to you so that you would never, ever wear it like a mall cop.</em></p><p>Guard +3 · Evasion +0 · Resolve +0 — light, needs fitting (Trained = half, Proficient = full).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "armor",
      "signature": "Given by the kids. That is the whole bonus.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Crown Mall issue, 2077, hi-vis gone to amber. The Tanneritos keep one as a reminder of what not to be and give it away when they make peace, because nothing makes a person less of a cop than being handed the vest by the kids. The inlay is theirs. It is very good inlay.</p>",
      "materialOf": [
       "hi-vis-nylon",
       "kevlar-weave",
       "hex-inlay"
      ],
      "price": {
       "marks": 225,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII armor (Inlaid +1) × bound free",
       "bound": "free",
       "saleBack": 90
      }
     }
    },
    "grade": {
     "rank": 1,
     "name": "Inlaid",
     "key": "inlaid",
     "defense": 1
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 3,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0MallVest0Eff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0DrownedCoat01",
  "name": "Circuited Drowned Coat",
  "type": "armor",
  "img": "icons/equipment/chest/coat-trench-brown.webp",
  "system": {
   "guardBonus": 3,
   "evasionBonus": 0,
   "resolveBonus": 3,
   "resistances": [
    "chemical"
   ],
   "armorSkill": "bracing",
   "equipped": false,
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "medium",
    "graded",
    "grade-circuited",
    "coat",
    "revenant",
    "river"
   ],
   "category": "armor",
   "source": "",
   "description": {
    "value": "<p>The Ferryman wore it across the Drowned South for two hundred years and never once came out dry, and never once dripped. The circuit of sigils down the back is the river's own, which is why the water in the coat does you no harm and the river does less.</p><p><em>Medium, Circuited: Guard +3, Resolve +3, resists chemical; attunes to one wearer. Needs Bracing. It is always wet and it never drips.</em></p><p>Guard +3 · Evasion +0 · Resolve +3 · resists chemical — medium, needs bracing (Trained = half, Proficient = full).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "self",
      "frame": "armor",
      "signature": "Wet. Never drips.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>The Ferryman wore it across the Drowned South for two hundred years and never once came out dry, and never once dripped. The circuit of sigils down the back is the river's own, which is why the water in the coat does you no harm and the river does less.</p>",
      "materialOf": [
       "oilcloth",
       "river-sigils",
       "hex-glyph-plate",
       "wardiron"
      ],
      "price": {
       "marks": 675,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII armor (Circuited +2) × bound attuned",
       "bound": "attuned",
       "saleBack": 270
      }
     }
    },
    "grade": {
     "rank": 2,
     "name": "Circuited",
     "key": "circuited",
     "defense": 2
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 3,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      },
      {
       "key": "flags.fourththing.grant.resolve",
       "value": 3,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0DrownedCoEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0CompliancePl1",
  "name": "Circuited Compliance Plate",
  "type": "armor",
  "img": "icons/equipment/chest/breastplate-metal-scaled-grey.webp",
  "system": {
   "guardBonus": 5,
   "evasionBonus": -1,
   "resolveBonus": 0,
   "resistances": [
    "electrical"
   ],
   "armorSkill": "plating",
   "equipped": false,
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "heavy",
    "graded",
    "grade-circuited",
    "plate",
    "construct",
    "pre-fall"
   ],
   "category": "armor",
   "source": "",
   "description": {
    "value": "<p>Cut from the Engine's own shell by someone with a long week ahead of them. The plates still carry the stamp and the stamp still carries the charge, and the charge is why nothing electrical gets through, and also why you will sometimes hear a small, satisfied click when you obey a sign.</p><p><em>Heavy, Circuited: Guard +5, Evasion −1, resists electrical; attunes to one wearer. Needs Plating. Every plate is stamped COMPLIANT.</em></p><p>Guard +5 · Evasion -1 · Resolve +0 · resists electrical — heavy, needs plating (Trained = half, Proficient = full).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "III",
      "footprint": 1,
      "reach": "self",
      "frame": "armor",
      "signature": "Click.",
      "origin": "looted",
      "originator": null,
      "bound": "attuned",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Cut from the Engine's own shell by someone with a long week ahead of them. The plates still carry the stamp and the stamp still carries the charge, and the charge is why nothing electrical gets through, and also why you will sometimes hear a small, satisfied click when you obey a sign.</p>",
      "materialOf": [
       "engine-shell",
       "hex-glyph-plate",
       "rivet-plate",
       "compliance-stamp"
      ],
      "price": {
       "marks": 675,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIII armor (Circuited +2) × bound attuned",
       "bound": "attuned",
       "saleBack": 270
      }
     }
    },
    "grade": {
     "rank": 2,
     "name": "Circuited",
     "key": "circuited",
     "defense": 2
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 5,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      },
      {
       "key": "flags.fourththing.grant.evasion",
       "value": -1,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0CompliancEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0ManagerBlazer",
  "name": "Crowned Regional Manager's Blazer",
  "type": "armor",
  "img": "icons/equipment/chest/coat-collared-red-gold.webp",
  "system": {
   "guardBonus": 4,
   "evasionBonus": 0,
   "resolveBonus": 5,
   "resistances": [],
   "armorSkill": "fitting",
   "equipped": false,
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "light",
    "graded",
    "grade-crowned",
    "blazer",
    "capstone",
    "apocalypse"
   ],
   "category": "armor",
   "source": "",
   "description": {
    "value": "<p>Gerald wore it to the end of everything and it has not a mark on it. Put it on and the collar already has your name, in Gerald's handwriting, which you have never seen, and the Apocalypse (Region 4) treats you as the person it reports to. It is soulbound. It was always going to be.</p><p><em>Light, Crowned: Guard +4, Resolve +5; soulbound. Needs Fitting. Gerald's blazer, with Gerald's name in the collar crossed out and yours, somehow, written in.</em></p><p>Guard +4 · Evasion +0 · Resolve +5 — light, needs fitting (Trained = half, Proficient = full).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "IV",
      "footprint": 1,
      "reach": "self",
      "frame": "armor",
      "signature": "Your name is already in the collar.",
      "origin": "looted",
      "originator": null,
      "bound": "soulbound",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Gerald wore it to the end of everything and it has not a mark on it. Put it on and the collar already has your name, in Gerald's handwriting, which you have never seen, and the Apocalypse (Region 4) treats you as the person it reports to. It is soulbound. It was always going to be.</p>",
      "materialOf": [
       "worsted",
       "shoulder-pad",
       "a-true-name",
       "regional-authority"
      ],
      "price": {
       "marks": 3040,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TIV armor (Crowned +3) × bound soulbound",
       "bound": "soulbound",
       "saleBack": 0
      }
     }
    },
    "grade": {
     "rank": 3,
     "name": "Crowned",
     "key": "crowned",
     "defense": 3
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 4,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      },
      {
       "key": "flags.fourththing.grant.resolve",
       "value": 5,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0ManagerBlEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0TrickHoodie01",
  "name": "Inlaid Trick-or-Treater's Hoodie",
  "type": "armor",
  "img": "icons/equipment/back/cloak-hooded-blue.webp",
  "system": {
   "guardBonus": 2,
   "evasionBonus": 2,
   "resolveBonus": 0,
   "resistances": [],
   "armorSkill": "fitting",
   "equipped": false,
   "tags": [
    "halloween-hoard",
    "mal-voiced",
    "light",
    "graded",
    "grade-inlaid",
    "hoodie",
    "grief-towns",
    "soft-landing"
   ],
   "category": "armor",
   "source": "",
   "description": {
    "value": "<p>Soft Landing. When you went first and grieved with them, somebody left this on the kerb for you, folded, the way a parent folds a thing for a kid who will not fold it. It fits whoever grieves honestly. The inlay in the drawstrings is the Mayor's own needlework.</p><p><em>Light, Inlaid: Guard +2, Evasion +2. Needs Fitting. A kid's hoodie, grown to fit you, left at the castle with the shoes.</em></p><p>Guard +2 · Evasion +2 · Resolve +0 — light, needs fitting (Trained = half, Proficient = full).</p>",
    "chat": ""
   }
  },
  "flags": {
   "fourththing": {
    "rfi": {
     "item": {
      "tier": "II",
      "footprint": 1,
      "reach": "self",
      "frame": "armor",
      "signature": "It fits whoever grieves honestly.",
      "origin": "looted",
      "originator": null,
      "bound": "free",
      "upkeep": {
       "mode": "passive",
       "per": "scene"
      },
      "misfire": {
       "tierClamp": true,
       "table": null
      },
      "signals": {},
      "lore": "<p>Soft Landing. When you went first and grieved with them, somebody left this on the kerb for you, folded, the way a parent folds a thing for a kid who will not fold it. It fits whoever grieves honestly. The inlay in the drawstrings is the Mayor's own needlework.</p>",
      "materialOf": [
       "fleece",
       "drawstring",
       "hex-inlay",
       "fun-size"
      ],
      "price": {
       "marks": 225,
       "currency": "nonlethal",
       "gmOverride": false,
       "altCurrencies": {},
       "split": null,
       "rarityMult": 1,
       "notes": "TII armor (Inlaid +1) × bound free",
       "bound": "free",
       "saleBack": 90
      }
     }
    },
    "grade": {
     "rank": 1,
     "name": "Inlaid",
     "key": "inlaid",
     "defense": 1
    }
   }
  },
  "effects": [
   {
    "name": "⚙️ Defense Grant",
    "transfer": false,
    "disabled": false,
    "flags": {
     "fourththing": {
      "defenseGrant": true
     }
    },
    "system": {
     "changes": [
      {
       "key": "flags.fourththing.grant.guard",
       "value": 2,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      },
      {
       "key": "flags.fourththing.grant.evasion",
       "value": 2,
       "priority": 20,
       "type": "add",
       "phase": "initial"
      }
     ]
    },
    "_id": "hH0TrickHoodEff1",
    "img": "icons/svg/aura.svg",
    "type": "base",
    "start": null,
    "duration": {
     "value": null,
     "units": "seconds",
     "expiry": null,
     "expired": false
    },
    "description": "",
    "origin": null,
    "tint": "#ffffff",
    "statuses": [],
    "showIcon": 1,
    "folder": null,
    "sort": 0,
    "_stats": {
     "coreVersion": "14.369",
     "systemId": "fourththing",
     "systemVersion": "0.6.37",
     "createdTime": 1793491200000,
     "modifiedTime": 1793491200000,
     "lastModifiedBy": "bytUGWIOqq9eT7Or",
     "compendiumSource": null,
     "duplicateSource": null,
     "exportSource": null
    }
   }
  ],
  "folder": "hH0Folder0000001",
  "sort": 0,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 }
];
const SECRETS = [
 {
  "_id": "hH0RecRecess0001",
  "name": "A Recess, Called by Nobody",
  "type": "feat",
  "img": "icons/sundries/documents/document-sealed-signatures-red.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>A Recess, Called by Nobody.</strong> Somebody rings a bell that is not on the agenda, and the whole court stops to listen to a train leave. Nobody loses anything in the next exchange — Influence stands where it was; scandal, Suspicion and marks still happen.</p><p><em>Play:</em> the next exchange deals no Influence damage to either side.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "recess",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3100000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecStrike0001",
  "name": "The Room Remembers Differently",
  "type": "feat",
  "img": "icons/sundries/documents/document-torn-diagram-tan.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>The Room Remembers Differently.</strong> A page comes out of the minutes so cleanly that everyone agrees it was never there. Influence, Suspicion, scandal and the round go back to before the last exchange; the marks spent in it stay spent.</p><p><em>Play:</em> strike the last exchange from the record.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "strikeRecord",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3200000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecPrice00001",
  "name": "The Price List",
  "type": "feat",
  "img": "icons/sundries/documents/document-writing-brown.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>The Price List.</strong> Filed under WEATHER: who in this court wants what, and what it costs. Every courtier's favor toward both sides, and the court bonus each side carries, whispered to you alone.</p><p><em>Play:</em> every courtier's favor, both sides, whispered to you.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "namePrice",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3300000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecCounter001",
  "name": "Counterfeit Truth, Notarized",
  "type": "feat",
  "img": "icons/sundries/documents/document-sealed-brown-red.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>Counterfeit Truth, Notarized.</strong> A notary's seal on a thing nobody said. Your next stolen receipt plays as earned — no Suspicion, and the one you took it from never learns who carried it.</p><p><em>Play:</em> your next stolen receipt plays as earned.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "counterfeit",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3400000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecAgenda0001",
  "name": "The Agenda, Amended in Pencil",
  "type": "feat",
  "img": "icons/sundries/documents/document-bound-white-tan.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>The Agenda, Amended in Pencil.</strong> The word at the top of the page is crossed out and another written above it in a hand everyone recognises. Change what this Parley is for — Persuade, Deceive, or Stay unnoticed.</p><p><em>Play:</em> rewrite the stake — change what this Parley is for.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "rewriteStake",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3500000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecWrit000001",
  "name": "Sovereign Writ",
  "type": "feat",
  "img": "icons/sundries/scrolls/scroll-bound-sealed-red-gold.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>Sovereign Writ.</strong> A writ with a seal older than the court. Produce it and the next exchange is simply yours — the dice are read, and the record says you won by at least three.</p><p><em>Play:</em> you win the next exchange outright.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "decree",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3600000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecDrinks0001",
  "name": "Round of Drinks on the House",
  "type": "feat",
  "img": "icons/consumables/drinks/alcohol-beer-stein-wooden-brown.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>Round of Drinks on the House.</strong> Somebody is paying and it is you. Every courtier at the table warms to your side by one.</p><p><em>Play:</em> +1 Favor with every courtier, your side.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "favorAllPlus1",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3700000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecPickpock01",
  "name": "The Pickpocket's Apology",
  "type": "feat",
  "img": "icons/sundries/documents/envelope-sealed-red-white.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>The Pickpocket's Apology.</strong> A note in the opponent's pocket where a secret used to be: SORRY. They discard a stolen receipt at random.</p><p><em>Play:</em> your opponent discards a random stolen receipt.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "discardStolen",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3800000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 },
 {
  "_id": "hH0RecAudit00001",
  "name": "Audit Notice",
  "type": "feat",
  "img": "icons/sundries/documents/document-official-capital.webp",
  "system": {
   "category": "technique",
   "source": "",
   "tags": [
    "halloween-hoard"
   ],
   "description": {
    "value": "<p><strong>Audit Notice.</strong> Every purse at the table is frozen pending review. No marks may be spent by either side next exchange.</p><p><em>Play:</em> no marks may be spent by either side next exchange.</p>",
    "chat": "",
    "unidentified": ""
   }
  },
  "flags": {
   "bbttcc-raid": {
    "secret": {
     "effectKey": "freezePurse",
     "acquisition": "template",
     "acquiredAt": 0,
     "raidId": ""
    }
   }
  },
  "effects": [],
  "folder": null,
  "sort": 3900000,
  "ownership": {
   "default": 0
  },
  "_stats": {
   "coreVersion": "14.369",
   "systemId": "fourththing",
   "systemVersion": "0.6.37",
   "createdTime": 1793491200000,
   "modifiedTime": 1793491200000,
   "lastModifiedBy": "bytUGWIOqq9eT7Or",
   "compendiumSource": null,
   "duplicateSource": null,
   "exportSource": null
  }
 }
];
const DROPS = [
 {
  "npc": "Hollis Varn, Reeve of the Broken Bridge",
  "itemId": "hH0ReeveRing0001",
  "itemName": "Ring of the Reeve's Toll"
 },
 {
  "npc": "The Ferryman of the Drowned South",
  "itemId": "hH0DrownLocket01",
  "itemName": "Drowned South Locket"
 },
 {
  "npc": "Gloomgill",
  "itemId": "hH0QuizMedal0001",
  "itemName": "Gloomgill's Quiz Medal"
 },
 {
  "npc": "Sklar Bjrornholt",
  "itemId": "hH0PirateEarring",
  "itemName": "Sky-Pirate's Earring"
 },
 {
  "npc": "Gerald, Assistant Regional Manager of the Apocalypse",
  "itemId": "hH0GeraldLanyard",
  "itemName": "Gerald's Lanyard, Laminated"
 },
 {
  "npc": "Desenitarius Maarg",
  "itemId": "hH0MaargRing0001",
  "itemName": "Maarg's Collector's Ring"
 },
 {
  "npc": "Hollis Varn, Reeve of the Broken Bridge",
  "itemId": "hH0CandyCleaver1",
  "itemName": "Inlaid Candy-Corn Cleaver"
 },
 {
  "npc": "Gloomgill",
  "itemId": "hH0LanternFlail1",
  "itemName": "Inlaid Lantern-Head Flail"
 },
 {
  "npc": "Compliance Engine PRIME",
  "itemId": "hH0PorchCarbine1",
  "itemName": "Circuited Porchlight Carbine"
 },
 {
  "npc": "Sklar Bjrornholt",
  "itemId": "hH0BoardingAxe01",
  "itemName": "Crowned Valhaulan Boarding Axe"
 },
 {
  "npc": "Apex Predator",
  "itemId": "hH0ApexHideCoat1",
  "itemName": "Inlaid Apex Hide Coat"
 },
 {
  "npc": "The Ferryman of the Drowned South",
  "itemId": "hH0DrownedCoat01",
  "itemName": "Circuited Drowned Coat"
 },
 {
  "npc": "Compliance Engine PRIME",
  "itemId": "hH0CompliancePl1",
  "itemName": "Circuited Compliance Plate"
 },
 {
  "npc": "Gerald, Assistant Regional Manager of the Apocalypse",
  "itemId": "hH0ManagerBlazer",
  "itemName": "Crowned Regional Manager's Blazer"
 }
];
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const log = []; let created = 0, skipped = 0, dropped = 0;
  const unlock = async (pack, fn) => { const was = pack.locked; try { if (!DRY_RUN && was) await pack.configure({ locked: false }); return await fn(); } finally { if (!DRY_RUN && was) await pack.configure({ locked: true }); } };
  // 1 · items
  const ipack = game.packs.get("bbttcc-master-content.items"); if (!ipack) return ui.notifications.error("No items pack");
  await unlock(ipack, async () => {
    const index = await ipack.getIndex(); const have = new Set(index.map(i => i.name)); const haveId = new Set(index.map(i => i._id));
    let folder = ipack.folders.get(FOLDER.id) ?? ipack.folders.find(f => f.name === FOLDER.name);
    if (!folder) { log.push(`${DRY_RUN ? "·" : "✔"} folder "${FOLDER.name}"`); if (!DRY_RUN) [folder] = await Folder.createDocuments([{ _id: FOLDER.id, name: FOLDER.name, type: "Item", color: "#d4791f", sorting: "m" }], { pack: ipack.collection, keepId: true }); }
    const fresh = [];
    for (const v of ITEMS) {
      if (have.has(v.name) || haveId.has(v._id)) { log.push(`· skip ${v.name} — already in the pack`); skipped++; continue; }
      const r = v.flags.fourththing.rfi.item;
      log.push(`${DRY_RUN ? "·" : "✔"} [${v.type}] ${v.name}  T${r.tier} ${r.frame} ${r.price.marks} ${r.price.currency} marks · ${v.img}`);
      fresh.push({ ...v, folder: folder?.id ?? FOLDER.id });
    }
    if (!DRY_RUN && fresh.length) { const made = await Item.createDocuments(fresh, { pack: ipack.collection, keepId: true }); created += made.length; } else created += fresh.length;
  });
  // 2 · receipts
  const spack = game.packs.get("bbttcc-master-content.courtly-secrets"); if (!spack) return ui.notifications.error("No courtly-secrets pack");
  await unlock(spack, async () => {
    const index = await spack.getIndex(); const have = new Set(index.map(i => i.name)); const haveId = new Set(index.map(i => i._id));
    const fresh = SECRETS.filter(v => { if (have.has(v.name) || haveId.has(v._id)) { log.push(`· skip receipt ${v.name}`); skipped++; return false; } log.push(`${DRY_RUN ? "·" : "✔"} [receipt] ${v.name} → ${v.flags["bbttcc-raid"].secret.effectKey}`); return true; });
    if (!DRY_RUN && fresh.length) { const made = await Item.createDocuments(fresh, { pack: spack.collection, keepId: true }); created += made.length; } else created += fresh.length;
  });
  // 3 · boss drops — pack NPC docs + world actors by name (the item is a clone of the pack record; the corpse vault shows weapon/armor/gear)
  const byId = new Map(ITEMS.map(v => [v._id, v]));
  const npack = game.packs.get("bbttcc-master-content.npcs");
  const npcIndex = npack ? await npack.getIndex() : [];
  await unlock(npack ?? ipack, async () => {
    for (const d of DROPS) {
      const data = foundry.utils.deepClone(byId.get(d.itemId)); delete data._id; delete data.folder; delete data.sort; delete data.ownership; delete data._stats;
      foundry.utils.setProperty(data, "flags.bbttcc-master-content.hoardDrop", { itemId: d.itemId, stamp: "2026-10-31" });
      const targets = [];
      const idx = npcIndex.find(i => i.name === d.npc); if (idx && npack) { const a = await npack.getDocument(idx._id); if (a) targets.push(a); } else log.push(`⚠ pack NPC "${d.npc}" not found`);
      for (const a of game.actors.filter(a => a.name === d.npc)) targets.push(a);
      for (const a of targets) {
        if (a.items.some(it => it.name === d.itemName)) { log.push(`· ${a.name} (${a.pack ? "pack" : "world"}) already carries ${d.itemName}`); continue; }
        log.push(`${DRY_RUN ? "·" : "✔"} drop ${d.itemName} → ${a.name} (${a.pack ? "pack" : "world"})`);
        if (!DRY_RUN) await a.createEmbeddedDocuments("Item", [data]); dropped++;
      }
    }
  });
  console.log(`[seed-halloween-hoard] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${created} created, ${skipped} skipped, ${dropped} drops\n` + log.join("\n"));
  ui.notifications.info(`seed-halloween-hoard ${DRY_RUN ? "dry run" : "applied"}: ${created} created, ${skipped} skipped, ${dropped} drops — see console (F12).`);
  return { created, skipped, dropped, log };
})();
