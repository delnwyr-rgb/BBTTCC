/* seed-basic-arms-2026-10-14.macro.js — BASIC ARMS seed (GENERATED 2026-10-14 by build-basic-arms.mjs — do not hand-edit; rebuild from a fresh dump).
 * Run from a GM seat on EMBER. DRY_RUN = true prints the plan and writes nothing; flip to false to create.
 * What: 19 weapons (18 T1 + 1 T2) and 8 armor/shield pieces, Standard Issue, into bbttcc-master-content.items
 *       (folders "T1 Baseline Weapons" / "BBTTCC Weapons" / "T1 Baseline Armor"). A name already in the pack is skipped. Ids are kept (repo _source == live).
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.items";
const ITEMS = [
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Longsword",
   "type": "weapon",
   "img": "icons/weapons/swords/sword-guard-worn.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blade",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sword",
     "versatile"
    ],
    "effect": "Versatile: one hand beside a shield, two hands when you mean it. No signature ability.",
    "flavor": "The shape every other sword is apologizing for not being.",
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
     "value": "<p>A straight double-edged blade with a plain cross-guard and a grip long enough for a second hand. Ground from pre-Fall leaf-spring or faction sheet-steel, depending on who made it and what they had. The weapon most hex militias train on first, because it forgives bad footwork and rewards good.</p><p><b>Standard Issue.</b> No signature, no hum, no history worth mentioning. It cuts.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile: one hand beside a shield, two hands when you mean it. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Thirty inches of settled argument.",
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
       "lore": "<p>A straight double-edged blade with a plain cross-guard and a grip long enough for a second hand. Ground from pre-Fall leaf-spring or faction sheet-steel, depending on who made it and what they had. The weapon most hex militias train on first, because it forgives bad footwork and rewards good.</p><p><b>Standard Issue.</b> No signature, no hum, no history worth mentioning. It cuts.</p>",
       "materialOf": [
        "sheet-steel",
        "leather-grip"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "1c222d3f-d59a-410a-8bd3-78a47b2360cb",
     "label": "Longsword",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "sword",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1LongSwrd0001a",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Shortsword",
   "type": "weapon",
   "img": "icons/weapons/swords/shortsword-guard-steel-worn.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blade",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sword",
     "light",
     "finesse"
    ],
    "effect": "Light, finesse-friendly. Pairs with a second weapon or a buckler. No signature ability.",
    "flavor": "Short enough to draw in a doorway. Long enough to matter.",
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
     "value": "<p>Two feet of blade and a grip for one hand. The sidearm of people who do their fighting in corridors, stairwells and crowded markets — courier guards, dock crews, anyone who has ever had to turn around fast. Cheap to make and cheaper to replace.</p><p><b>Standard Issue.</b> Quick, close, honest.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light, finesse-friendly. Pairs with a second weapon or a buckler. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Made for rooms, not fields.",
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
       "lore": "<p>Two feet of blade and a grip for one hand. The sidearm of people who do their fighting in corridors, stairwells and crowded markets — courier guards, dock crews, anyone who has ever had to turn around fast. Cheap to make and cheaper to replace.</p><p><b>Standard Issue.</b> Quick, close, honest.</p>",
       "materialOf": [
        "sheet-steel",
        "leather-grip"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "bb8f2bda-68f7-4022-861e-9254a56223c5",
     "label": "Shortsword",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "sword",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1ShrtSwrd0002b",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Greatsword",
   "type": "weapon",
   "img": "icons/weapons/swords/greatsword-crossguard-steel.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d12",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blade",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sword",
     "two-handed",
     "heavy"
    ],
    "effect": "Two-handed, heavy. Pairs well with Bulwark Frame. No signature ability.",
    "flavor": "Not a sword. A decision.",
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
     "value": "<p>A two-handed blade as tall as its wielder, hammered from a pre-Fall highway sign-post or a faction forge's best sheet. Slow to bring around, impossible to ignore. Favoured by gate-wardens and anyone whose job is to make the first person through a door regret it.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — the weight is the statement.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, heavy. Pairs well with Bulwark Frame. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d12 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Five feet of steel and no plan B.",
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
       "lore": "<p>A two-handed blade as tall as its wielder, hammered from a pre-Fall highway sign-post or a faction forge's best sheet. Slow to bring around, impossible to ignore. Favoured by gate-wardens and anyone whose job is to make the first person through a door regret it.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — the weight is the statement.</p>",
       "materialOf": [
        "sheet-steel",
        "brace-iron",
        "leather-grip"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "f411322d-3f72-4b06-b236-5919b94ec0b1",
     "label": "Greatsword",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "greatsword",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1GrtSword0003c",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Machete",
   "type": "weapon",
   "img": "icons/weapons/swords/machete.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "chop",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "blade",
     "light",
     "utility"
    ],
    "effect": "Light. Doubles as a trail tool — clears brush, opens crates, settles disputes. No signature ability.",
    "flavor": "Half the time it's a tool. The other half, nobody asks.",
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
     "value": "<p>A broad single-edged chopping blade with a wrapped grip. Every travelling crew in Bad Eden owns one and most own three — for the overgrowth on the old roads, the lids on the salvage crates, and the moment the parley goes wrong. Factories stamp them by the gross.</p><p><b>Standard Issue.</b> Light, cheap, always within reach.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light. Doubles as a trail tool — clears brush, opens crates, settles disputes. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(chop)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Clears a path either way.",
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
       "lore": "<p>A broad single-edged chopping blade with a wrapped grip. Every travelling crew in Bad Eden owns one and most own three — for the overgrowth on the old roads, the lids on the salvage crates, and the moment the parley goes wrong. Factories stamp them by the gross.</p><p><b>Standard Issue.</b> Light, cheap, always within reach.</p>",
       "materialOf": [
        "sheet-steel",
        "wrapped-leather"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "e05e6a13-65de-4cf7-8633-5e412656094e",
     "label": "Machete",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "sword",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1Machete00004d",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Spear",
   "type": "weapon",
   "img": "icons/weapons/polearms/spear-flared-worn.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "stab",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "spear",
     "versatile",
     "thrown"
    ],
    "effect": "Versatile. May be thrown at short range as an improvised ranged attack. No signature ability.",
    "flavor": "Reach is a kind of armor.",
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
     "value": "<p>A forged leaf-shaped head on six feet of ash. The weapon of hex pickets, boat crews and anyone who would rather the fight happened a little further away. Easy to make, easy to teach, and the long haft keeps a ring of them steady where a line of knives would break.</p><p><b>Standard Issue.</b> Reach and a throw. Nothing else needed.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile. May be thrown at short range as an improvised ranged attack. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(stab)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "The oldest answer to the oldest problem.",
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
       "lore": "<p>A forged leaf-shaped head on six feet of ash. The weapon of hex pickets, boat crews and anyone who would rather the fight happened a little further away. Easy to make, easy to teach, and the long haft keeps a ring of them steady where a line of knives would break.</p><p><b>Standard Issue.</b> Reach and a throw. Nothing else needed.</p>",
       "materialOf": [
        "pig-iron",
        "ash-haft"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "3aa7dbe7-2fdc-4819-9e2e-53e27d2e1dba",
     "label": "Spear",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "spear",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1Spear0000005e",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Slugger Bat",
   "type": "weapon",
   "img": "icons/weapons/clubs/bat-nail.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blunt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "club",
     "light",
     "improvised"
    ],
    "effect": "Light. Improvised — nobody looks twice at it until it's too late. No signature ability.",
    "flavor": "Pre-Fall sporting goods, post-Fall diplomacy.",
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
     "value": "<p>A hickory baseball bat, usually with a few bronze nails driven through the barrel for emphasis. Found in the back of every bunker, the trunk of every rig and the hands of every bouncer at every drinking hole from Chuckle Creek to the Drowned South. Nobody has to be taught how to use one.</p><p><b>Standard Issue.</b> Light, blunt, cheerful.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light. Improvised — nobody looks twice at it until it's too late. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Batting a thousand.",
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
       "lore": "<p>A hickory baseball bat, usually with a few bronze nails driven through the barrel for emphasis. Found in the back of every bunker, the trunk of every rig and the hands of every bouncer at every drinking hole from Chuckle Creek to the Drowned South. Nobody has to be taught how to use one.</p><p><b>Standard Issue.</b> Light, blunt, cheerful.</p>",
       "materialOf": [
        "hickory-haft",
        "bronze-nail"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "288b15b9-af27-4f5d-b546-d291228ebdea",
     "label": "Slugger Bat",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "club",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1SlugrBat0006f",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Mace",
   "type": "weapon",
   "img": "icons/weapons/maces/mace-flanged-steel-grey.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blunt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "mace",
     "bludgeon"
    ],
    "effect": "One-handed blunt. Good against plate — the armor stays put and the person inside it doesn't. No signature ability.",
    "flavor": "Doesn't need an edge. Needs a reason.",
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
     "value": "<p>A flanged iron head on a short steel haft. Where the longsword is the militia's first lesson, the mace is the constable's — it dents, it stuns, and it doesn't stick in anything. Carried by hex constables, sept wardens and anyone whose job involves bringing people back in one piece, mostly.</p><p><b>Standard Issue.</b> Blunt, one-handed, dependable.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>One-handed blunt. Good against plate — the armor stays put and the person inside it doesn't. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "A flanged opinion.",
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
       "lore": "<p>A flanged iron head on a short steel haft. Where the longsword is the militia's first lesson, the mace is the constable's — it dents, it stuns, and it doesn't stick in anything. Carried by hex constables, sept wardens and anyone whose job involves bringing people back in one piece, mostly.</p><p><b>Standard Issue.</b> Blunt, one-handed, dependable.</p>",
       "materialOf": [
        "pig-iron",
        "leather-grip"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "633c54fb-9cf3-4200-bd4e-1c76f1a8396f",
     "label": "Mace",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "mace",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1Mace00000007g",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Quarterstaff",
   "type": "weapon",
   "img": "icons/weapons/staves/staff-simple-wrapped.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blunt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "staff",
     "two-handed",
     "versatile"
    ],
    "effect": "Two-handed, versatile. A walking stick first; a weapon when the walk goes wrong. No signature ability.",
    "flavor": "Leans on you as much as you lean on it.",
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
     "value": "<p>Six feet of seasoned ash with leather wraps at the grips and iron ferrules at the ends. The traveller's weapon — a pilgrim's stick, a boatman's pole, a teacher's pointer, and the one weapon every Initiate's order lets its novices carry through the gate. Cheap, legal everywhere, and faster than it looks.</p><p><b>Standard Issue.</b> Two-handed blunt. Nothing to confiscate.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, versatile. A walking stick first; a weapon when the walk goes wrong. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Six feet of patience.",
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
       "lore": "<p>Six feet of seasoned ash with leather wraps at the grips and iron ferrules at the ends. The traveller's weapon — a pilgrim's stick, a boatman's pole, a teacher's pointer, and the one weapon every Initiate's order lets its novices carry through the gate. Cheap, legal everywhere, and faster than it looks.</p><p><b>Standard Issue.</b> Two-handed blunt. Nothing to confiscate.</p>",
       "materialOf": [
        "ash-haft",
        "wrapped-leather"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "52a82781-1086-4f30-8a56-9a90b7976661",
     "label": "Quarterstaff",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "quarterstaff",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1QrtrStaf0008h",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Felling Axe",
   "type": "weapon",
   "img": "icons/weapons/axes/axe-double-chopping-black.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d10",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "chop",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "axe",
     "two-handed",
     "heavy"
    ],
    "effect": "Two-handed, heavy. Splits timber, doors and arguments. No signature ability.",
    "flavor": "Built for trees. Trees don't fight back.",
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
     "value": "<p>A heavy double-bit axe on a long hickory haft, straight off the timber crews that keep the hex roads open. Nobody designed it as a weapon; nobody needed to. When the raid alarm sounds in a logging camp, this is what comes out of the shed.</p><p><b>Standard Issue.</b> Heavy two-handed chop. Honest work, either way.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, heavy. Splits timber, doors and arguments. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(chop)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Every swing is the last one, as far as the tree is concerned.",
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
       "lore": "<p>A heavy double-bit axe on a long hickory haft, straight off the timber crews that keep the hex roads open. Nobody designed it as a weapon; nobody needed to. When the raid alarm sounds in a logging camp, this is what comes out of the shed.</p><p><b>Standard Issue.</b> Heavy two-handed chop. Honest work, either way.</p>",
       "materialOf": [
        "pig-iron",
        "hickory-haft"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "083c8ee7-fb7b-4586-b633-0c48016bd6fe",
     "label": "Felling Axe",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "greataxe",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1FellAxe00009i",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Warhammer",
   "type": "weapon",
   "img": "icons/weapons/hammers/hammer-war-rounding.webp",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "blunt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "hammer",
     "versatile"
    ],
    "effect": "Versatile. A hammer face for plate, a spike for everything else. No signature ability.",
    "flavor": "Forge tool. Field tool. Same tool.",
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
     "value": "<p>A squared iron head with a hammer face on one side and a short spike on the other, mounted on an ash haft long enough for two hands. It comes off the same forge as the rivet-plate it's meant to beat in — the smiths of Bad Eden have never seen the point of making two tools where one will do.</p><p><b>Standard Issue.</b> Blunt, versatile, no questions at the forge door.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile. A hammer face for plate, a spike for everything else. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Rounds off the corners of a bad day.",
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
       "lore": "<p>A squared iron head with a hammer face on one side and a short spike on the other, mounted on an ash haft long enough for two hands. It comes off the same forge as the rivet-plate it's meant to beat in — the smiths of Bad Eden have never seen the point of making two tools where one will do.</p><p><b>Standard Issue.</b> Blunt, versatile, no questions at the forge door.</p>",
       "materialOf": [
        "pig-iron",
        "ash-haft"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "3b70d728-a59d-4650-8b84-e2d88779b275",
     "label": "Warhammer",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "warhammer",
       "variant": "01",
       "color": "white",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isWait": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1WarHamr0010j0",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Auto Pistol",
   "type": "weapon",
   "img": "icons/weapons/guns/pistol-automatic.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 20,
     "long": 80
    },
    "tags": [
     "t1-baseline",
     "pistol",
     "ballistic",
     "sidearm",
     "quick-reload"
    ],
    "effect": "Semi-automatic sidearm with a box magazine — reloads in a breath. No signature ability.",
    "flavor": "Fourteen rounds and a slide that never asked permission.",
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
     "value": "<p>A magazine-fed semi-automatic handgun — the pre-Fall service pattern, still turned out by faction armouries from stamped sheet and salvaged barrels. Where the Slug Pistol is the glove-box gun, this is the holster gun: more rounds, faster reload, same honest kick.</p><p><b>Standard Issue.</b> No electronics, no hum. Point, pull, repeat.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Semi-automatic sidearm with a box magazine — reloads in a breath. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 20 / 80</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Drop the magazine, slap the next one, keep talking.",
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
       "lore": "<p>A magazine-fed semi-automatic handgun — the pre-Fall service pattern, still turned out by faction armouries from stamped sheet and salvaged barrels. Where the Slug Pistol is the glove-box gun, this is the holster gun: more rounds, faster reload, same honest kick.</p><p><b>Standard Issue.</b> No electronics, no hum. Point, pull, repeat.</p>",
       "materialOf": [
        "sheet-steel",
        "casing-brass"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "cf4996df-ec8d-454c-95d5-de3d5fa9282e",
     "label": "Auto Pistol",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1AutoPstl0011k",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Holdout Pistol",
   "type": "weapon",
   "img": "icons/weapons/guns/pistol-handgun-small.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 10,
     "long": 40
    },
    "tags": [
     "t1-baseline",
     "pistol",
     "ballistic",
     "concealable"
    ],
    "effect": "Concealable. Fits a boot, a sleeve or a sept-cloth hem. Short range. No signature ability.",
    "flavor": "Nobody checks the boot.",
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
     "value": "<p>A snub-barrelled pocket pistol, two to five rounds, built to vanish. Carried by couriers, card players, Pactkeepers and anyone who walks into rooms where weapons are collected at the door. Useless past a card table. Decisive at one.</p><p><b>Standard Issue.</b> Concealable sidearm. The whole point is that nobody knows.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Concealable. Fits a boot, a sleeve or a sept-cloth hem. Short range. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 10 / 40</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Two rounds. Pick them carefully.",
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
       "lore": "<p>A snub-barrelled pocket pistol, two to five rounds, built to vanish. Carried by couriers, card players, Pactkeepers and anyone who walks into rooms where weapons are collected at the door. Useless past a card table. Decisive at one.</p><p><b>Standard Issue.</b> Concealable sidearm. The whole point is that nobody knows.</p>",
       "materialOf": [
        "sheet-steel",
        "casing-brass"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "0aba4e77-6f85-4c83-83ee-4e7919fd5080",
     "label": "Holdout Pistol",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1HoldPstl0012l",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Machine Pistol",
   "type": "weapon",
   "img": "icons/weapons/guns/machine-gun-sub-pistol.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 15,
     "long": 60
    },
    "tags": [
     "t1-baseline",
     "pistol",
     "ballistic",
     "automatic"
    ],
    "effect": "Automatic sidearm. Loud, fast and over quickly. No signature ability.",
    "flavor": "Empties a magazine faster than a bad apology.",
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
     "value": "<p>A full-auto handgun with an extended magazine and a folding foregrip — a bandit's gun, a bodyguard's gun, a get-out-of-the-alley gun. It climbs, it chews ammunition and it turns every room it is fired in into a conversation nobody can hear. Faction armouries make them; few issue them.</p><p><b>Standard Issue.</b> Automatic, close-range, inaccurate past a doorway.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Automatic sidearm. Loud, fast and over quickly. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 15 / 60</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "The sound of a decision being made for you.",
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
       "lore": "<p>A full-auto handgun with an extended magazine and a folding foregrip — a bandit's gun, a bodyguard's gun, a get-out-of-the-alley gun. It climbs, it chews ammunition and it turns every room it is fired in into a conversation nobody can hear. Faction armouries make them; few issue them.</p><p><b>Standard Issue.</b> Automatic, close-range, inaccurate past a doorway.</p>",
       "materialOf": [
        "sheet-steel",
        "casing-brass",
        "spring-tension-arm"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "ea45ce11-782d-476d-85ac-9a8412b024f8",
     "label": "Machine Pistol",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1MachPstl0013m",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Pump Shotgun",
   "type": "weapon",
   "img": "icons/weapons/guns/shotgun-pump.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 10,
     "long": 40
    },
    "tags": [
     "t1-baseline",
     "shotgun",
     "ballistic",
     "two-handed"
    ],
    "effect": "Two-handed scattergun. Brutal up close, useless at distance. No signature ability.",
    "flavor": "The pump is the warning. The rest is paperwork.",
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
     "value": "<p>A pump-action smoothbore with a tube magazine and a walnut stock, loaded with whatever lead-shot the trade post had. The homestead gun of Bad Eden — behind every bar, under every bunk, in the rack of every hovercraft. Hits like a wall at ten paces and like a rumour at forty.</p><p><b>Standard Issue.</b> Short-range two-handed ballistic. Nobody has ever called it elegant.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed scattergun. Brutal up close, useless at distance. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 10 / 40</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Racks once. That's usually enough.",
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
       "lore": "<p>A pump-action smoothbore with a tube magazine and a walnut stock, loaded with whatever lead-shot the trade post had. The homestead gun of Bad Eden — behind every bar, under every bunk, in the rack of every hovercraft. Hits like a wall at ten paces and like a rumour at forty.</p><p><b>Standard Issue.</b> Short-range two-handed ballistic. Nobody has ever called it elegant.</p>",
       "materialOf": [
        "sheet-steel",
        "walnut-stock",
        "lead-shot"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "2c21f4bc-3a29-459c-b9a8-61383b4cc837",
     "label": "Pump Shotgun",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1PumpShot0014n",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Sawed-Off Shotgun",
   "type": "weapon",
   "img": "icons/weapons/guns/shotgun-short-steel.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 5,
     "long": 20
    },
    "tags": [
     "t1-baseline",
     "shotgun",
     "ballistic",
     "concealable"
    ],
    "effect": "One-handed scattergun, hides under a coat. Point-blank only. No signature ability.",
    "flavor": "Two barrels. One conversation.",
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
     "value": "<p>A double-barrelled shotgun with the barrels and stock cut back to something that fits under a duster. Favoured by rig crews, river smugglers and anyone whose fights happen across a table. Past twenty feet it is a loud way to miss; inside five, nothing standard-issue hits harder.</p><p><b>Standard Issue.</b> Concealable, two shots, no third chance.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>One-handed scattergun, hides under a coat. Point-blank only. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 5 / 20</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Shortened for people who like to be close to their problems.",
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
       "lore": "<p>A double-barrelled shotgun with the barrels and stock cut back to something that fits under a duster. Favoured by rig crews, river smugglers and anyone whose fights happen across a table. Past twenty feet it is a loud way to miss; inside five, nothing standard-issue hits harder.</p><p><b>Standard Issue.</b> Concealable, two shots, no third chance.</p>",
       "materialOf": [
        "sheet-steel",
        "lead-shot"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "c992acbf-ef06-419e-8db8-ada03e298355",
     "label": "Sawed-Off Shotgun",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1SawdShot0015o",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Carbine",
   "type": "weapon",
   "img": "icons/weapons/guns/rifle-assault-carbine.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 40,
     "long": 150
    },
    "tags": [
     "t1-baseline",
     "rifle",
     "ballistic",
     "two-handed"
    ],
    "effect": "Two-handed short rifle. Handles in a rig cab or a stairwell. No signature ability.",
    "flavor": "A rifle that learned to live indoors.",
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
     "value": "<p>A short-barrelled magazine rifle, the pattern faction outriders and rig gunners prefer: light enough to swing through a hatch, accurate enough to answer a Hunting Rifle at road range. Stamped receivers, salvaged optics when the crew can get them.</p><p><b>Standard Issue.</b> Two-handed ballistic. The outrider's compromise.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed short rifle. Handles in a rig cab or a stairwell. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 40 / 150</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Short enough for the cab, long enough for the road.",
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
       "lore": "<p>A short-barrelled magazine rifle, the pattern faction outriders and rig gunners prefer: light enough to swing through a hatch, accurate enough to answer a Hunting Rifle at road range. Stamped receivers, salvaged optics when the crew can get them.</p><p><b>Standard Issue.</b> Two-handed ballistic. The outrider's compromise.</p>",
       "materialOf": [
        "sheet-steel",
        "walnut-stock",
        "casing-brass"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "19f62b25-3a26-4e8a-bdf6-3715def1363e",
     "label": "Carbine",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1Carbine00016p",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Service Rifle",
   "type": "weapon",
   "img": "icons/weapons/guns/rifle-assault-wood-grip.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 40,
     "long": 160
    },
    "tags": [
     "t1-baseline",
     "rifle",
     "ballistic",
     "automatic",
     "two-handed"
    ],
    "effect": "Two-handed select-fire rifle — the faction line-infantry pattern. No signature ability.",
    "flavor": "Issued by the crate. Returned by the handful.",
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
     "value": "<p>The select-fire rifle every faction armoury turns out for its line troops — a wooden-gripped pattern copied from a pre-Fall design nobody remembers the name of. Thirty-round magazines, iron sights, a bayonet lug that mostly holds a bottle opener. When a Garrison Fort empties out, this is what it empties out carrying.</p><p><b>Standard Issue.</b> Two-handed ballistic, automatic. The sound of a faction meaning it.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed select-fire rifle — the faction line-infantry pattern. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 40 / 160</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "The faction's handwriting, in brass.",
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
       "lore": "<p>The select-fire rifle every faction armoury turns out for its line troops — a wooden-gripped pattern copied from a pre-Fall design nobody remembers the name of. Thirty-round magazines, iron sights, a bayonet lug that mostly holds a bottle opener. When a Garrison Fort empties out, this is what it empties out carrying.</p><p><b>Standard Issue.</b> Two-handed ballistic, automatic. The sound of a faction meaning it.</p>",
       "materialOf": [
        "sheet-steel",
        "walnut-stock",
        "casing-brass"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "aa69cf6b-e5a8-401b-80b3-d370ed818d56",
     "label": "Service Rifle",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1ServRifl0017q",
   "effects": []
  }
 },
 {
  "folderId": "H6eMhWQrjwcwZcBi",
  "folderName": "BBTTCC Weapons",
  "v": {
   "name": "Squad Machine Gun",
   "type": "weapon",
   "img": "icons/weapons/guns/machine-gun-drum.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "2d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 40,
     "long": 160
    },
    "tags": [
     "t2-baseline",
     "machine-gun",
     "ballistic",
     "automatic",
     "two-handed",
     "heavy"
    ],
    "effect": "Heavy, two-handed, belt- or drum-fed. Suppresses a street on its own. Best fired braced or from a rig mount. No signature ability.",
    "flavor": "One per squad. One is plenty.",
    "manifestation": {
     "tier": 2,
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
     "value": "<p>A drum-fed light machine gun on a bipod — the heaviest thing a faction hands to one person. Proven kit, not starter kit: the quartermaster signs it out by name, and the crew that carries it carries nothing else. On a rig pintle it is the difference between a convoy and a target.</p><p><b>Proven Issue.</b> Tier II heavy automatic ballistic. No signature — it has never needed one.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Heavy, two-handed, belt- or drum-fed. Suppresses a street on its own. Best fired braced or from a rig mount. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 2d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 40 / 160</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T2</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "II",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Keeps heads down and ledgers open.",
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
       "lore": "<p>A drum-fed light machine gun on a bipod — the heaviest thing a faction hands to one person. Proven kit, not starter kit: the quartermaster signs it out by name, and the crew that carries it carries nothing else. On a rig pintle it is the difference between a convoy and a target.</p><p><b>Proven Issue.</b> Tier II heavy automatic ballistic. No signature — it has never needed one.</p>",
       "materialOf": [
        "brace-iron",
        "sheet-steel",
        "casing-brass"
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon stamp",
        "bound": "free",
        "saleBack": 60
       }
      }
     }
    },
    "autoanimations": {
     "id": "4a60d7cf-377c-4744-9ef9-4fe7b1e05b92",
     "label": "Squad Machine Gun",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "bullet",
       "variant": "1",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA2SquadMG00018r",
   "effects": []
  }
 },
 {
  "folderId": "bQhXd1gwJXtaVLGh",
  "folderName": "T1 Baseline Weapons",
  "v": {
   "name": "Hunting Bow",
   "type": "weapon",
   "img": "icons/weapons/bows/longbow-recurve-leather-brown.webp",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "arrow",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120
    },
    "tags": [
     "t1-baseline",
     "bow",
     "silent",
     "two-handed"
    ],
    "effect": "Two-handed, silent. Arrows can be recovered and re-fletched. No signature ability.",
    "flavor": "Quiet enough to keep the deer, and the neighbours, from noticing.",
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
     "value": "<p>A recurve hunting bow of laminated ash with a hex-rope string, the kind every hex still makes because arrows are free and brass is not. Hunters, scouts and anyone who would rather not announce themselves carry one. It will never out-shoot a Hunting Rifle; it will out-last one, and the ammunition grows on trees.</p><p><b>Standard Issue.</b> Silent two-handed ranged. No signature — it predates the idea.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, silent. Arrows can be recovered and re-fletched. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(arrow)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "I",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Every arrow comes back if you walk far enough.",
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
       "lore": "<p>A recurve hunting bow of laminated ash with a hex-rope string, the kind every hex still makes because arrows are free and brass is not. Hunters, scouts and anyone who would rather not announce themselves carry one. It will never out-shoot a Hunting Rifle; it will out-last one, and the ammunition grows on trees.</p><p><b>Standard Issue.</b> Silent two-handed ranged. No signature — it predates the idea.</p>",
       "materialOf": [
        "ash-haft",
        "hex-rope"
       ],
       "price": {
        "marks": 50,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI weapon stamp",
        "bound": "free",
        "saleBack": 20
       }
      }
     }
    },
    "autoanimations": {
     "id": "b50584ac-20f8-4f1f-b0ba-daee6a90ccab",
     "label": "Hunting Bow",
     "levels3d": {
      "type": "explosion",
      "data": {
       "color01": "#FFFFFF",
       "color02": "#FFFFFF",
       "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
      },
      "sound": {
       "enable": false
      },
      "secondary": {
       "enable": false,
       "data": {
        "color01": "#FFFFFF",
        "color02": "#FFFFFF",
        "spritePath": "modules/levels-3d-preview/assets/particles/dust.png"
       }
      }
     },
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "isReturning": false,
       "isWait": false,
       "onlyX": false,
       "opacity": 1,
       "playbackRate": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "secondary": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": true,
       "isWait": false,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1.5,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "soundOnly": {
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      }
     },
     "source": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "isWait": true,
       "opacity": 1,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "zIndex": 1
      }
     },
     "target": {
      "enable": false,
      "video": {
       "dbSection": "static",
       "menuType": "spell",
       "animation": "curewounds",
       "variant": "01",
       "color": "blue",
       "enableCustom": false,
       "customPath": ""
      },
      "sound": {
       "enable": false,
       "delay": 0,
       "repeat": 1,
       "repeatDelay": 250,
       "startTime": 0,
       "volume": 0.75
      },
      "options": {
       "addTokenWidth": false,
       "anchor": "0.5",
       "contrast": 0,
       "delay": 0,
       "elevation": 1000,
       "fadeIn": 250,
       "fadeOut": 500,
       "isMasked": false,
       "isRadius": false,
       "opacity": 1,
       "persistent": false,
       "repeat": 1,
       "repeatDelay": 250,
       "saturate": 0,
       "size": 1,
       "tint": false,
       "tintColor": "#FFFFFF",
       "unbindAlpha": false,
       "unbindVisibility": false,
       "zIndex": 1
      }
     },
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   },
   "_id": "bA1HuntBow00019s",
   "effects": []
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Ballistic Vest",
   "type": "armor",
   "img": "icons/equipment/chest/bullet-proof-vest-kevlar.webp",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "vest",
     "ballistic"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A sleeveless vest of layered pre-Fall ballistic fibre with foam trauma pads front and back, pulled from an evidence locker or a cop's closet two centuries ago and re-stitched a dozen times since. Light enough to wear under a coat all day; stiff enough to stop a slug. The sidearm's answer.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Zips up the front.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +2</li>\n  <li><strong>Requires:</strong> Fitting (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Pre-Fall fibre that still remembers what it was for.",
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
       "lore": "<p>A sleeveless vest of layered pre-Fall ballistic fibre with foam trauma pads front and back, pulled from an evidence locker or a cop's closet two centuries ago and re-stitched a dozen times since. Light enough to wear under a coat all day; stiff enough to stop a slug. The sidearm's answer.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Zips up the front.</p>",
       "materialOf": [
        "pre-fall-cotton",
        "expanded-polyurethane",
        "rivet-strap"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1BalstVst0020t",
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
       }
      ]
     },
     "_id": "bA1BalstVst0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Riding Leathers",
   "type": "armor",
   "img": "icons/equipment/chest/jacket-motorcycle-leather-brown.webp",
   "system": {
    "guardBonus": 1,
    "evasionBonus": 1,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "leather",
     "road"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A heavy leather riding jacket with doubled elbows and shoulders, cut for a rig saddle or a hovercraft rail. Outriders, couriers and anyone who spends more time on the road than off it. Turns a slide on gravel into a story and a knife into a scuff.</p><p><strong>Standard Issue.</strong> No signature. Smells of fuel and weather.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +1, Evasion +1</li>\n  <li><strong>Requires:</strong> Fitting (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Road-rash insurance with a collar.",
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
       "lore": "<p>A heavy leather riding jacket with doubled elbows and shoulders, cut for a rig saddle or a hovercraft rail. Outriders, couriers and anyone who spends more time on the road than off it. Turns a slide on gravel into a story and a knife into a scuff.</p><p><strong>Standard Issue.</strong> No signature. Smells of fuel and weather.</p>",
       "materialOf": [
        "work-leather",
        "rivet-strap"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1RideLthr0021u",
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
       },
       {
        "key": "flags.fourththing.grant.evasion",
        "value": 1,
        "priority": 20,
        "type": "add",
        "phase": "initial"
       }
      ]
     },
     "_id": "bA1RideLthr0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Flak Jacket",
   "type": "armor",
   "img": "icons/equipment/chest/jacket-modern-military.webp",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "medium",
     "jacket",
     "ballistic"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A canvas field jacket with steel plates sewn into the chest and back panels over a quilted liner — the faction line-infantry pattern, issued by the crate alongside the Service Rifle. Heavier than it looks and warmer than anyone wants in a Bad Eden summer, but it stops what a militia expects to be shot with.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Name on the tape.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Medium</li>\n  <li><strong>Defense:</strong> Guard +2</li>\n  <li><strong>Requires:</strong> Bracing (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Canvas on the outside, sheet-steel on the inside, a faction stencil on the back.",
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
       "lore": "<p>A canvas field jacket with steel plates sewn into the chest and back panels over a quilted liner — the faction line-infantry pattern, issued by the crate alongside the Service Rifle. Heavier than it looks and warmer than anyone wants in a Bad Eden summer, but it stops what a militia expects to be shot with.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Name on the tape.</p>",
       "materialOf": [
        "road-canvas",
        "sheet-steel",
        "quilted-liner"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1FlakJckt0022v",
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
       }
      ]
     },
     "_id": "bA1FlakJckt0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Tactical Harness",
   "type": "armor",
   "img": "icons/equipment/chest/harness-tactical-heavy.webp",
   "system": {
    "guardBonus": 1,
    "evasionBonus": 1,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "medium",
     "harness",
     "utility"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A webbing harness and chest rig over a padded canvas shell — pouches for magazines, a loop for the machete, a ring for the lantern. Scouts and rig crews wear it because it keeps everything where the hands already know to find it; the padding is almost incidental, and still better than nothing.</p><p><strong>Standard Issue.</strong> No signature. Rattles if you run.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Medium</li>\n  <li><strong>Defense:</strong> Guard +1, Evasion +1</li>\n  <li><strong>Requires:</strong> Bracing (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Twelve pockets, and every one has a reason.",
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
       "lore": "<p>A webbing harness and chest rig over a padded canvas shell — pouches for magazines, a loop for the machete, a ring for the lantern. Scouts and rig crews wear it because it keeps everything where the hands already know to find it; the padding is almost incidental, and still better than nothing.</p><p><strong>Standard Issue.</strong> No signature. Rattles if you run.</p>",
       "materialOf": [
        "road-canvas",
        "rivet-strap",
        "tool-loop"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1TactHrns0023w",
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
       },
       {
        "key": "flags.fourththing.grant.evasion",
        "value": 1,
        "priority": 20,
        "type": "add",
        "phase": "initial"
       }
      ]
     },
     "_id": "bA1TactHrns0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Riot Armor",
   "type": "armor",
   "img": "icons/equipment/chest/riot-black.webp",
   "system": {
    "guardBonus": 3,
    "evasionBonus": -1,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "heavy",
     "plate",
     "riot"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Segmented black steel plate over a padded coat — chest, shoulders, forearms, shins — the pattern a pre-Fall riot line wore and a hex constabulary still does. Heavy, loud, and very hard to argue with. The wearer gives up quickness for the certainty that the first swing lands on steel.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Clatters on stairs.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Heavy</li>\n  <li><strong>Defense:</strong> Guard +3, Evasion −1</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Built for a crowd that has stopped listening.",
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
       "lore": "<p>Segmented black steel plate over a padded coat — chest, shoulders, forearms, shins — the pattern a pre-Fall riot line wore and a hex constabulary still does. Heavy, loud, and very hard to argue with. The wearer gives up quickness for the certainty that the first swing lands on steel.</p><p><strong>Standard Issue.</strong> No signature, no harmonization. Clatters on stairs.</p>",
       "materialOf": [
        "sheet-steel",
        "padded-coat",
        "leather-strap"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1RiotArmr0024x",
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
        "key": "flags.fourththing.grant.evasion",
        "value": -1,
        "priority": 20,
        "type": "add",
        "phase": "initial"
       }
      ]
     },
     "_id": "bA1RiotArmr0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Scrap Plate",
   "type": "armor",
   "img": "icons/equipment/chest/breastplate-banded-steel-studded.webp",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 0,
    "resolveBonus": 1,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "heavy",
     "plate",
     "salvaged"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Riveted plates of salvaged sheet — car doors, signage, a pre-Fall refrigerator — strapped over a gambeson by whoever had the rivets and the afternoon. No two suits match and none of them fit, but the weight on your shoulders is the weight of knowing you'll walk out. The Bulwark's second suit; the bandit's first.</p><p><strong>Standard Issue.</strong> No signature. Every dent is a previous owner.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Heavy</li>\n  <li><strong>Defense:</strong> Guard +2, Resolve +1</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Someone's car door. Now it's yours.",
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
       "lore": "<p>Riveted plates of salvaged sheet — car doors, signage, a pre-Fall refrigerator — strapped over a gambeson by whoever had the rivets and the afternoon. No two suits match and none of them fit, but the weight on your shoulders is the weight of knowing you'll walk out. The Bulwark's second suit; the bandit's first.</p><p><strong>Standard Issue.</strong> No signature. Every dent is a previous owner.</p>",
       "materialOf": [
        "rivet-plate",
        "sheet-steel",
        "gambeson"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1ScrpPlat0025y",
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
        "key": "flags.fourththing.grant.resolve",
        "value": 1,
        "priority": 20,
        "type": "add",
        "phase": "initial"
       }
      ]
     },
     "_id": "bA1ScrpPlat0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Scrap Helm",
   "type": "armor",
   "img": "icons/equipment/head/cap-steel.webp",
   "system": {
    "guardBonus": 1,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "helm",
     "salvaged"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A steel skull-cap hammered from sheet, lined with quilted cloth and chin-strapped with whatever was handy. Worn over a hood, under a hat, or on its own by people who have been hit in the head once already and formed an opinion. Pairs with any armor; stacks with none of the arguments.</p><p><strong>Standard Issue.</strong> No signature. One size fits most.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +1</li>\n  <li><strong>Requires:</strong> Fitting (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "armor",
       "signature": "Keeps the rain and the rebar off.",
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
       "lore": "<p>A steel skull-cap hammered from sheet, lined with quilted cloth and chin-strapped with whatever was handy. Worn over a hood, under a hat, or on its own by people who have been hit in the head once already and formed an opinion. Pairs with any armor; stacks with none of the arguments.</p><p><strong>Standard Issue.</strong> No signature. One size fits most.</p>",
       "materialOf": [
        "sheet-steel",
        "quilted-liner"
       ],
       "price": {
        "marks": 75,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI armor stamp",
        "bound": "free",
        "saleBack": 30
       }
      }
     }
    }
   },
   "_id": "bA1ScrpHelm0026z",
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
     "_id": "bA1ScrpHelm0Eff1",
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
     "sort": 0
    }
   ]
  }
 },
 {
  "folderId": "2yW6O57xUFtROfpB",
  "folderName": "T1 Baseline Armor",
  "v": {
   "name": "Riot Shield",
   "type": "armor",
   "img": "icons/equipment/shield/heater-steel-grey.webp",
   "system": {
    "guardBonus": 2,
    "evasionBonus": -1,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "shield",
     "tower"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A tall rectangular shield of sheet-steel on a brace-iron frame with a forearm cuff and a grip, the constabulary pattern. It covers from chin to knee and makes a line of four people into a wall. Heavy enough that nobody carrying one is dodging anything; that was never the plan.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no view.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Shield</li>\n  <li><strong>Defense:</strong> Guard +2, Evasion −1</li>\n  <li><strong>Requires:</strong> Bracing (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 35 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->",
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
       "frame": "shield",
       "signature": "A wall that agreed to come along.",
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
       "lore": "<p>A tall rectangular shield of sheet-steel on a brace-iron frame with a forearm cuff and a grip, the constabulary pattern. It covers from chin to knee and makes a line of four people into a wall. Heavy enough that nobody carrying one is dodging anything; that was never the plan.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no view.</p>",
       "materialOf": [
        "sheet-steel",
        "leather-cuff",
        "brace-iron"
       ],
       "price": {
        "marks": 35,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TI shield stamp",
        "bound": "free",
        "saleBack": 14
       }
      }
     }
    }
   },
   "_id": "bA1RiotShld0027A",
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
        "value": -1,
        "priority": 20,
        "type": "add",
        "phase": "initial"
       }
      ]
     },
     "_id": "bA1RiotShld0Eff1",
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
     "sort": 0
    }
   ]
  }
 }
];
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(`No pack ${PACK_ID}`);
  const index = await pack.getIndex(); const have = new Set(index.map(i => i.name)); const haveId = new Set(index.map(i => i._id));
  const log = []; let created = 0, skipped = 0;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    const folderId = (row) => { const f = pack.folders.get(row.folderId) ?? pack.folders.find(x => x.name === row.folderName); if (!f) throw new Error(`folder ${row.folderName} not in the pack`); return f.id; };
    const fresh = [];
    for (const row of ITEMS) {
      if (have.has(row.v.name) || haveId.has(row.v._id)) { log.push(`· skip ${row.v.name} — already in the pack`); skipped++; continue; }
      const r = row.v.flags.fourththing.rfi.item;
      log.push(`${DRY_RUN ? "·" : "✔"} [${row.folderName}] ${row.v.name}  T${r.tier} ${r.frame} ${r.price.marks} ${r.price.currency} marks · ${row.v.img}`);
      fresh.push({ ...row.v, folder: folderId(row) });
    }
    if (!DRY_RUN && fresh.length) { const docs = await Item.createDocuments(fresh, { pack: pack.collection, keepId: true }); created = docs.length; }
    else created = fresh.length;
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(`[seed-basic-arms] ${DRY_RUN ? "DRY RUN" : "CREATED"} — ${created} item(s), ${skipped} skipped\n` + log.join("\n"));
  ui.notifications.info(`seed-basic-arms ${DRY_RUN ? "dry run" : "created"}: ${created} items, ${skipped} skipped — see console (F12).`);
  return { created, skipped, log };
})();
