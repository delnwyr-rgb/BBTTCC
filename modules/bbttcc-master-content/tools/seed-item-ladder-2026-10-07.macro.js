/* seed-item-ladder-2026-10-07.macro.js — ITEM LADDER seed (GENERATED 2026-10-07 by build-item-ladder.mjs — do not hand-edit; rebuild from a fresh dump).
 * Paste into a GM macro on EMBER and run. DRY_RUN = true prints the plan and writes nothing; flip to false to create.
 * What: 47 graded arms (Inlaid / Circuited / Crowned on the T1 baseline arms + four T2 pieces) and 15 Bound Workings
 *       (a host item carrying one Manifestation on 3 charges) into bbttcc-master-content.items, folders "Graded Arms" / "Bound Workings".
 *       A name that already exists in the pack is skipped. Engine: systems/fourththing/item-ladder.js (needs system ≥ 0.6.6).
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.items";
const ITEMS = [
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Maul",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_hammer_1.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d12 + 1",
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
     "maul",
     "two-handed",
     "heavy",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Two-handed, heavy. Pairs well with Bulwark Frame.",
    "flavor": "Not subtle. Not trying to be.",
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
     "value": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, heavy. Pairs well with Bulwark Frame.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d12 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "When the door is the problem, the maul is the answer.",
       "origin": "crafted",
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
       "lore": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>",
       "materialOf": [
        {
         "key": "pig-iron",
         "qty": 1
        },
        {
         "key": "ash-haft",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Maul) × bound free",
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
    },
    "autoanimations": {
     "id": "295c9eda-4e4c-4533-9aa9-efffa8ebb49e",
     "label": "Maul",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "maul",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Maul",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_hammer_1.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d12 + 2",
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
     "maul",
     "two-handed",
     "heavy",
     "graded",
     "grade-circuited"
    ],
    "effect": "Two-handed, heavy. Pairs well with Bulwark Frame.",
    "flavor": "Not subtle. Not trying to be.",
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
     "value": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, heavy. Pairs well with Bulwark Frame.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d12 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "When the door is the problem, the maul is the answer.",
       "origin": "crafted",
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
       "lore": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>",
       "materialOf": [
        {
         "key": "pig-iron",
         "qty": 1
        },
        {
         "key": "ash-haft",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Maul) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "295c9eda-4e4c-4533-9aa9-efffa8ebb49e",
     "label": "Maul",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "maul",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Maul",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_hammer_1.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d12 + 3",
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
     "maul",
     "two-handed",
     "heavy",
     "graded",
     "grade-crowned"
    ],
    "effect": "Two-handed, heavy. Pairs well with Bulwark Frame.",
    "flavor": "Not subtle. Not trying to be.",
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
     "value": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, heavy. Pairs well with Bulwark Frame.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d12 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "When the door is the problem, the maul is the answer.",
       "origin": "crafted",
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
       "lore": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>",
       "materialOf": [
        {
         "key": "pig-iron",
         "qty": 1
        },
        {
         "key": "ash-haft",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Maul) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "295c9eda-4e4c-4533-9aa9-efffa8ebb49e",
     "label": "Maul",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "maul",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Hand Axe",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_axe.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8 + 1",
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
     "versatile",
     "thrown",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Versatile. May be thrown at short range as an improvised ranged attack.",
    "flavor": "Equally good at cordwood and conversation.",
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
     "value": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile. May be thrown at short range as an improvised ranged attack.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(chop)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Splits firewood in the morning, splits opinions in the evening.",
       "origin": "crafted",
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
       "lore": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "hickory-haft",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Hand Axe) × bound free",
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
    },
    "autoanimations": {
     "id": "ba39b415-c1aa-4828-8ec8-3e184eb852e9",
     "label": "Hand Axe",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "greataxe",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Hand Axe",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_axe.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8 + 2",
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
     "versatile",
     "thrown",
     "graded",
     "grade-circuited"
    ],
    "effect": "Versatile. May be thrown at short range as an improvised ranged attack.",
    "flavor": "Equally good at cordwood and conversation.",
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
     "value": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile. May be thrown at short range as an improvised ranged attack.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(chop)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Splits firewood in the morning, splits opinions in the evening.",
       "origin": "crafted",
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
       "lore": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "hickory-haft",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Hand Axe) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "ba39b415-c1aa-4828-8ec8-3e184eb852e9",
     "label": "Hand Axe",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "greataxe",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Hand Axe",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_axe.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8 + 3",
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
     "versatile",
     "thrown",
     "graded",
     "grade-crowned"
    ],
    "effect": "Versatile. May be thrown at short range as an improvised ranged attack.",
    "flavor": "Equally good at cordwood and conversation.",
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
     "value": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile. May be thrown at short range as an improvised ranged attack.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(chop)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Splits firewood in the morning, splits opinions in the evening.",
       "origin": "crafted",
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
       "lore": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "hickory-haft",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Hand Axe) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "ba39b415-c1aa-4828-8ec8-3e184eb852e9",
     "label": "Hand Axe",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "greataxe",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Combat Knife",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_dagger_2.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6 + 1",
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
     "knife",
     "light",
     "finesse",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Light, finesse-friendly. No signature ability.",
    "flavor": "Cheap. Honest. Always sharp enough.",
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
     "value": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light, finesse-friendly. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Sharpened on a thousand other days like this one.",
       "origin": "crafted",
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
       "lore": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "leather-grip",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Combat Knife) × bound free",
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
    },
    "autoanimations": {
     "id": "bc02ed23-8978-493d-9da4-6f9f745b8c6d",
     "label": "Combat Knife",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "dagger",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Combat Knife",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_dagger_2.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6 + 2",
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
     "knife",
     "light",
     "finesse",
     "graded",
     "grade-circuited"
    ],
    "effect": "Light, finesse-friendly. No signature ability.",
    "flavor": "Cheap. Honest. Always sharp enough.",
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
     "value": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light, finesse-friendly. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Sharpened on a thousand other days like this one.",
       "origin": "crafted",
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
       "lore": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "leather-grip",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Combat Knife) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "bc02ed23-8978-493d-9da4-6f9f745b8c6d",
     "label": "Combat Knife",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "dagger",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Combat Knife",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_dagger_2.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6 + 3",
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
     "knife",
     "light",
     "finesse",
     "graded",
     "grade-crowned"
    ],
    "effect": "Light, finesse-friendly. No signature ability.",
    "flavor": "Cheap. Honest. Always sharp enough.",
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
     "value": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light, finesse-friendly. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Sharpened on a thousand other days like this one.",
       "origin": "crafted",
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
       "lore": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "leather-grip",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Combat Knife) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "bc02ed23-8978-493d-9da4-6f9f745b8c6d",
     "label": "Combat Knife",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "dagger",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Sap",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_quarterstaff%20Background%20Removed.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6 + 1",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "subdual",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sap",
     "concealable",
     "subdual",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Concealable. Damage easily declared nonlethal at the wielder's option.",
    "flavor": "Compact. Apologetic. Functional.",
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
     "value": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Concealable. Damage easily declared nonlethal at the wielder's option.</p>\n<ul>\n <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(subdual)</span></li>\n <li><strong>Faculty:</strong> Violence</li>\n <li><strong>Attack:</strong> Melee (Violence)</li>\n <li><strong>Reach:</strong> Melee</li>\n <li><strong>Duration:</strong> Scene</li>\n <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "A short conversation about the back of a head.",
       "origin": "crafted",
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
       "lore": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>",
       "materialOf": [
        {
         "key": "lead-shot",
         "qty": 1
        },
        {
         "key": "wrapped-leather",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Sap) × bound free",
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
    },
    "autoanimations": {
     "id": "d645f26d-5cd9-4627-8990-7fdd643d681e",
     "label": "Sap",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5,
     "meleeSwitch": {
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     }
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Sap",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_quarterstaff%20Background%20Removed.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6 + 2",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "subdual",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sap",
     "concealable",
     "subdual",
     "graded",
     "grade-circuited"
    ],
    "effect": "Concealable. Damage easily declared nonlethal at the wielder's option.",
    "flavor": "Compact. Apologetic. Functional.",
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
     "value": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Concealable. Damage easily declared nonlethal at the wielder's option.</p>\n<ul>\n <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(subdual)</span></li>\n <li><strong>Faculty:</strong> Violence</li>\n <li><strong>Attack:</strong> Melee (Violence)</li>\n <li><strong>Reach:</strong> Melee</li>\n <li><strong>Duration:</strong> Scene</li>\n <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "A short conversation about the back of a head.",
       "origin": "crafted",
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
       "lore": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>",
       "materialOf": [
        {
         "key": "lead-shot",
         "qty": 1
        },
        {
         "key": "wrapped-leather",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Sap) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "d645f26d-5cd9-4627-8990-7fdd643d681e",
     "label": "Sap",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5,
     "meleeSwitch": {
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     }
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Sap",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_quarterstaff%20Background%20Removed.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6 + 3",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "subdual",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sap",
     "concealable",
     "subdual",
     "graded",
     "grade-crowned"
    ],
    "effect": "Concealable. Damage easily declared nonlethal at the wielder's option.",
    "flavor": "Compact. Apologetic. Functional.",
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
     "value": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Concealable. Damage easily declared nonlethal at the wielder's option.</p>\n<ul>\n <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(subdual)</span></li>\n <li><strong>Faculty:</strong> Violence</li>\n <li><strong>Attack:</strong> Melee (Violence)</li>\n <li><strong>Reach:</strong> Melee</li>\n <li><strong>Duration:</strong> Scene</li>\n <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "A short conversation about the back of a head.",
       "origin": "crafted",
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
       "lore": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>",
       "materialOf": [
        {
         "key": "lead-shot",
         "qty": 1
        },
        {
         "key": "wrapped-leather",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Sap) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "d645f26d-5cd9-4627-8990-7fdd643d681e",
     "label": "Sap",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5,
     "meleeSwitch": {
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     }
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Slug Pistol",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_lazer_pistol_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8 + 1",
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
     "graded",
     "grade-inlaid"
    ],
    "effect": "Standard ballistic sidearm. No signature ability.",
    "flavor": "Boring. Reliable. The two best things a pistol can be.",
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
     "value": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Standard ballistic sidearm. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 20 / 80</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Six rounds, one trigger, no opinions.",
       "origin": "crafted",
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
       "lore": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "casing-brass",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Slug Pistol) × bound free",
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
    },
    "autoanimations": {
     "id": "53aa0b6b-d75b-4b4b-b207-c7e9acd1d303",
     "label": "Slug Pistol",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Slug Pistol",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_lazer_pistol_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8 + 2",
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
     "graded",
     "grade-circuited"
    ],
    "effect": "Standard ballistic sidearm. No signature ability.",
    "flavor": "Boring. Reliable. The two best things a pistol can be.",
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
     "value": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Standard ballistic sidearm. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 20 / 80</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Six rounds, one trigger, no opinions.",
       "origin": "crafted",
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
       "lore": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "casing-brass",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Slug Pistol) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "53aa0b6b-d75b-4b4b-b207-c7e9acd1d303",
     "label": "Slug Pistol",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Slug Pistol",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_lazer_pistol_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8 + 3",
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
     "graded",
     "grade-crowned"
    ],
    "effect": "Standard ballistic sidearm. No signature ability.",
    "flavor": "Boring. Reliable. The two best things a pistol can be.",
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
     "value": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Standard ballistic sidearm. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 20 / 80</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Six rounds, one trigger, no opinions.",
       "origin": "crafted",
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
       "lore": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "casing-brass",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Slug Pistol) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "53aa0b6b-d75b-4b4b-b207-c7e9acd1d303",
     "label": "Slug Pistol",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Bolt-Driver",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_heavy_crossbow.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8 + 1",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "bolt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120
    },
    "tags": [
     "t1-baseline",
     "crossbow",
     "silent",
     "slow-reload",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Silent on discharge. GM may call for a 1-action reload between shots.",
    "flavor": "The kind of weapon that knows how to shut up.",
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
     "value": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Silent on discharge. GM may call for a 1-action reload between shots.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(bolt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Quiet enough to keep your secrets.",
       "origin": "crafted",
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
       "lore": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "spring-tension-arm",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Bolt-Driver) × bound free",
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
    },
    "autoanimations": {
     "id": "43f43748-c581-43b4-82ba-2ff90566f9a2",
     "label": "Bolt-Driver",
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
       "animation": "bolt",
       "variant": "cold",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Bolt-Driver",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_heavy_crossbow.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8 + 2",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "bolt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120
    },
    "tags": [
     "t1-baseline",
     "crossbow",
     "silent",
     "slow-reload",
     "graded",
     "grade-circuited"
    ],
    "effect": "Silent on discharge. GM may call for a 1-action reload between shots.",
    "flavor": "The kind of weapon that knows how to shut up.",
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
     "value": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Silent on discharge. GM may call for a 1-action reload between shots.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(bolt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Quiet enough to keep your secrets.",
       "origin": "crafted",
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
       "lore": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "spring-tension-arm",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Bolt-Driver) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "43f43748-c581-43b4-82ba-2ff90566f9a2",
     "label": "Bolt-Driver",
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
       "animation": "bolt",
       "variant": "cold",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Bolt-Driver",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_heavy_crossbow.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8 + 3",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "bolt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120
    },
    "tags": [
     "t1-baseline",
     "crossbow",
     "silent",
     "slow-reload",
     "graded",
     "grade-crowned"
    ],
    "effect": "Silent on discharge. GM may call for a 1-action reload between shots.",
    "flavor": "The kind of weapon that knows how to shut up.",
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
     "value": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Silent on discharge. GM may call for a 1-action reload between shots.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(bolt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Quiet enough to keep your secrets.",
       "origin": "crafted",
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
       "lore": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "spring-tension-arm",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Bolt-Driver) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "43f43748-c581-43b4-82ba-2ff90566f9a2",
     "label": "Bolt-Driver",
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
       "animation": "bolt",
       "variant": "cold",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Hunting Rifle",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_military_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10 + 1",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 60,
     "long": 200
    },
    "tags": [
     "t1-baseline",
     "rifle",
     "ballistic",
     "two-handed",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Long-arm ballistic. Two-handed.",
    "flavor": "Loud where it counts. Quiet otherwise.",
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
     "value": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Long-arm ballistic. Two-handed.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 60 / 200</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Patient steel for impatient situations.",
       "origin": "crafted",
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
       "lore": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "walnut-stock",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "price": {
        "marks": 150,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon (Inlaid +1 on TI Hunting Rifle) × bound free",
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
    },
    "autoanimations": {
     "id": "0a92a0bd-b1fc-48d7-b730-a046c9c80b50",
     "label": "Hunting Rifle",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Hunting Rifle",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_military_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10 + 2",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 60,
     "long": 200
    },
    "tags": [
     "t1-baseline",
     "rifle",
     "ballistic",
     "two-handed",
     "graded",
     "grade-circuited"
    ],
    "effect": "Long-arm ballistic. Two-handed.",
    "flavor": "Loud where it counts. Quiet otherwise.",
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
     "value": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Long-arm ballistic. Two-handed.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 60 / 200</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Patient steel for impatient situations.",
       "origin": "crafted",
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
       "lore": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "walnut-stock",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Circuited +2 on TI Hunting Rifle) × bound attuned",
        "bound": "attuned",
        "saleBack": 180
       }
      }
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "0a92a0bd-b1fc-48d7-b730-a046c9c80b50",
     "label": "Hunting Rifle",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Hunting Rifle",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_military_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10 + 3",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "ballistic",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 60,
     "long": 200
    },
    "tags": [
     "t1-baseline",
     "rifle",
     "ballistic",
     "two-handed",
     "graded",
     "grade-crowned"
    ],
    "effect": "Long-arm ballistic. Two-handed.",
    "flavor": "Loud where it counts. Quiet otherwise.",
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
     "value": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Long-arm ballistic. Two-handed.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 60 / 200</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 to hit and +3 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
    }
   },
   "flags": {
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "Patient steel for impatient situations.",
       "origin": "crafted",
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
       "lore": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "walnut-stock",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "vow-bound-edge",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Crowned +3 on TI Hunting Rifle) × bound soulbound",
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
    },
    "autoanimations": {
     "id": "0a92a0bd-b1fc-48d7-b730-a046c9c80b50",
     "label": "Hunting Rifle",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Patrolman's Plate",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/patrolpersons_plate.png",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "medium",
     "plate",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><strong>Standard Issue.</strong> No signature, no harmonization, no questions asked at the gate.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Medium</li>\n  <li><strong>Defense:</strong> Guard +2</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Issued, dented, returned, reissued. Honest metal.",
       "origin": "crafted",
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
       "lore": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><b>Standard Issue.</b> No signature, no harmonization, no questions asked at the gate.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "gambeson",
         "qty": 1
        },
        {
         "key": "leather-strap",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 225,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor (Inlaid +1 on TI Patrolman's Plate) × bound free",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Patrolman's Plate",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/patrolpersons_plate.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "medium",
     "plate",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><strong>Standard Issue.</strong> No signature, no harmonization, no questions asked at the gate.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Medium</li>\n  <li><strong>Defense:</strong> Guard +2</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Issued, dented, returned, reissued. Honest metal.",
       "origin": "crafted",
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
       "lore": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><b>Standard Issue.</b> No signature, no harmonization, no questions asked at the gate.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "gambeson",
         "qty": 1
        },
        {
         "key": "leather-strap",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Circuited +2 on TI Patrolman's Plate) × bound attuned",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Patrolman's Plate",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/patrolpersons_plate.png",
   "system": {
    "guardBonus": 5,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "medium",
     "plate",
     "graded",
     "grade-crowned"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><strong>Standard Issue.</strong> No signature, no harmonization, no questions asked at the gate.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Medium</li>\n  <li><strong>Defense:</strong> Guard +2</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 on each of its defense bonuses</strong> → Guard +5 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Issued, dented, returned, reissued. Honest metal.",
       "origin": "crafted",
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
       "lore": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><b>Standard Issue.</b> No signature, no harmonization, no questions asked at the gate.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "gambeson",
         "qty": 1
        },
        {
         "key": "leather-strap",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "hex-lattice",
         "qty": 1
        }
       ],
       "price": {
        "marks": 3040,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Crowned +3 on TI Patrolman's Plate) × bound soulbound",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Bulwark Hauberk",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/bulwark_hauberk.png",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 0,
    "resolveBonus": 2,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "heavy",
     "mail",
     "plate",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><strong>Standard Issue.</strong> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Heavy</li>\n  <li><strong>Defense:</strong> Guard +2, Resolve +1</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +3, Resolve +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Heavy enough to remind you you're standing somewhere on purpose.",
       "origin": "crafted",
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
       "lore": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><b>Standard Issue.</b> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>",
       "materialOf": [
        {
         "key": "mail",
         "qty": 1
        },
        {
         "key": "rivet-plate",
         "qty": 1
        },
        {
         "key": "padded-coat",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 225,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor (Inlaid +1 on TI Bulwark Hauberk) × bound free",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Bulwark Hauberk",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/bulwark_hauberk.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 0,
    "resolveBonus": 3,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "heavy",
     "mail",
     "plate",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><strong>Standard Issue.</strong> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Heavy</li>\n  <li><strong>Defense:</strong> Guard +2, Resolve +1</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +4, Resolve +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Heavy enough to remind you you're standing somewhere on purpose.",
       "origin": "crafted",
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
       "lore": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><b>Standard Issue.</b> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>",
       "materialOf": [
        {
         "key": "mail",
         "qty": 1
        },
        {
         "key": "rivet-plate",
         "qty": 1
        },
        {
         "key": "padded-coat",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Circuited +2 on TI Bulwark Hauberk) × bound attuned",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Bulwark Hauberk",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/bulwark_hauberk.png",
   "system": {
    "guardBonus": 5,
    "evasionBonus": 0,
    "resolveBonus": 4,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "heavy",
     "mail",
     "plate",
     "graded",
     "grade-crowned"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><strong>Standard Issue.</strong> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Heavy</li>\n  <li><strong>Defense:</strong> Guard +2, Resolve +1</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 on each of its defense bonuses</strong> → Guard +5, Resolve +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Heavy enough to remind you you're standing somewhere on purpose.",
       "origin": "crafted",
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
       "lore": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><b>Standard Issue.</b> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>",
       "materialOf": [
        {
         "key": "mail",
         "qty": 1
        },
        {
         "key": "rivet-plate",
         "qty": 1
        },
        {
         "key": "padded-coat",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "hex-lattice",
         "qty": 1
        }
       ],
       "price": {
        "marks": 3040,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Crowned +3 on TI Bulwark Hauberk) × bound soulbound",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Worker's Leathers",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/aurablade_florensis.png",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 2,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "leather",
     "utility",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><strong>Standard Issue.</strong> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Armor:</strong> Light</p></li><li><p><strong>Defense:</strong> Guard +1, Evasion +1</p></li><li><p><strong>Requires:</strong> Weave (trained)</p></li><li><p><strong>Tier:</strong> I</p></li><li><p><strong>Cost:</strong> 75 Nonlethal marks</p></li></ul>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +2, Evasion +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Built for the kind of day where something might fall on you.",
       "origin": "crafted",
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
       "lore": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><b>Standard Issue.</b> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p>",
       "materialOf": [
        {
         "key": "work-leather",
         "qty": 1
        },
        {
         "key": "rivet-strap",
         "qty": 1
        },
        {
         "key": "tool-loop",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 225,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor (Inlaid +1 on TI Worker's Leathers) × bound free",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Worker's Leathers",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/aurablade_florensis.png",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 3,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "leather",
     "utility",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><strong>Standard Issue.</strong> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Armor:</strong> Light</p></li><li><p><strong>Defense:</strong> Guard +1, Evasion +1</p></li><li><p><strong>Requires:</strong> Weave (trained)</p></li><li><p><strong>Tier:</strong> I</p></li><li><p><strong>Cost:</strong> 75 Nonlethal marks</p></li></ul>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +3, Evasion +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Built for the kind of day where something might fall on you.",
       "origin": "crafted",
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
       "lore": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><b>Standard Issue.</b> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p>",
       "materialOf": [
        {
         "key": "work-leather",
         "qty": 1
        },
        {
         "key": "rivet-strap",
         "qty": 1
        },
        {
         "key": "tool-loop",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Circuited +2 on TI Worker's Leathers) × bound attuned",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Worker's Leathers",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/aurablade_florensis.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 4,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "leather",
     "utility",
     "graded",
     "grade-crowned"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><strong>Standard Issue.</strong> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Armor:</strong> Light</p></li><li><p><strong>Defense:</strong> Guard +1, Evasion +1</p></li><li><p><strong>Requires:</strong> Weave (trained)</p></li><li><p><strong>Tier:</strong> I</p></li><li><p><strong>Cost:</strong> 75 Nonlethal marks</p></li></ul>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 on each of its defense bonuses</strong> → Guard +4, Evasion +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Built for the kind of day where something might fall on you.",
       "origin": "crafted",
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
       "lore": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><b>Standard Issue.</b> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p>",
       "materialOf": [
        {
         "key": "work-leather",
         "qty": 1
        },
        {
         "key": "rivet-strap",
         "qty": 1
        },
        {
         "key": "tool-loop",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "hex-lattice",
         "qty": 1
        }
       ],
       "price": {
        "marks": 3040,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Crowned +3 on TI Worker's Leathers) × bound soulbound",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Drifter's Weave",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/drifter_weave.png",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 2,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "cloth",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><strong>Standard Issue.</strong> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +1, Evasion +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +2, Evasion +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Cloth that's already walked further than you have.",
       "origin": "crafted",
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
       "lore": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><b>Standard Issue.</b> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>",
       "materialOf": [
        {
         "key": "road-canvas",
         "qty": 1
        },
        {
         "key": "quilted-liner",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 225,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor (Inlaid +1 on TI Drifter's Weave) × bound free",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Drifter's Weave",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/drifter_weave.png",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 3,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "cloth",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><strong>Standard Issue.</strong> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +1, Evasion +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +3, Evasion +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Cloth that's already walked further than you have.",
       "origin": "crafted",
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
       "lore": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><b>Standard Issue.</b> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>",
       "materialOf": [
        {
         "key": "road-canvas",
         "qty": 1
        },
        {
         "key": "quilted-liner",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Circuited +2 on TI Drifter's Weave) × bound attuned",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Drifter's Weave",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/drifter_weave.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 4,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "light",
     "cloth",
     "graded",
     "grade-crowned"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><strong>Standard Issue.</strong> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +1, Evasion +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 on each of its defense bonuses</strong> → Guard +4, Evasion +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Cloth that's already walked further than you have.",
       "origin": "crafted",
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
       "lore": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><b>Standard Issue.</b> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>",
       "materialOf": [
        {
         "key": "road-canvas",
         "qty": 1
        },
        {
         "key": "quilted-liner",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "hex-lattice",
         "qty": 1
        }
       ],
       "price": {
        "marks": 3040,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Crowned +3 on TI Drifter's Weave) × bound soulbound",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Initiate's Robe",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/initiates_robes.png",
   "system": {
    "guardBonus": 0,
    "evasionBonus": 2,
    "resolveBonus": 2,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "robe",
     "cloth",
     "caster",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><strong>Standard Issue.</strong> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Cloth</li>\n  <li><strong>Defense:</strong> Evasion +1, Resolve +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Evasion +2, Resolve +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Plain cloth. The hem remembers the floor of the room you left.",
       "origin": "crafted",
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
       "lore": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><b>Standard Issue.</b> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>",
       "materialOf": [
        {
         "key": "sept-cloth",
         "qty": 1
        },
        {
         "key": "corded-belt",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 225,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor (Inlaid +1 on TI Initiate's Robe) × bound free",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Initiate's Robe",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/initiates_robes.png",
   "system": {
    "guardBonus": 0,
    "evasionBonus": 3,
    "resolveBonus": 3,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "robe",
     "cloth",
     "caster",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><strong>Standard Issue.</strong> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Cloth</li>\n  <li><strong>Defense:</strong> Evasion +1, Resolve +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Evasion +3, Resolve +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Plain cloth. The hem remembers the floor of the room you left.",
       "origin": "crafted",
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
       "lore": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><b>Standard Issue.</b> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>",
       "materialOf": [
        {
         "key": "sept-cloth",
         "qty": 1
        },
        {
         "key": "corded-belt",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Circuited +2 on TI Initiate's Robe) × bound attuned",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Initiate's Robe",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/initiates_robes.png",
   "system": {
    "guardBonus": 0,
    "evasionBonus": 4,
    "resolveBonus": 4,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "robe",
     "cloth",
     "caster",
     "graded",
     "grade-crowned"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><strong>Standard Issue.</strong> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Cloth</li>\n  <li><strong>Defense:</strong> Evasion +1, Resolve +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 on each of its defense bonuses</strong> → Evasion +4, Resolve +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Plain cloth. The hem remembers the floor of the room you left.",
       "origin": "crafted",
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
       "lore": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><b>Standard Issue.</b> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>",
       "materialOf": [
        {
         "key": "sept-cloth",
         "qty": 1
        },
        {
         "key": "corded-belt",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "hex-lattice",
         "qty": 1
        }
       ],
       "price": {
        "marks": 3040,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Crowned +3 on TI Initiate's Robe) × bound soulbound",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Pressed Buckler",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/pressed_buckler.png",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "shield",
     "buckler",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Shield</li>\n  <li><strong>Defense:</strong> Guard +1</li>\n  <li><strong>Requires:</strong> Warding (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 50 Economy marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier II</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "shield",
       "signature": "A round of stamped steel and the conviction to hold it up.",
       "origin": "crafted",
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
       "lore": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><b>Standard Issue.</b> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>",
       "materialOf": [
        {
         "key": "sheet-steel",
         "qty": 1
        },
        {
         "key": "leather-cuff",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 225,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII shield (Inlaid +1 on TI Pressed Buckler) × bound free",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Pressed Buckler",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/pressed_buckler.png",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "shield",
     "buckler",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Shield</li>\n  <li><strong>Defense:</strong> Guard +1</li>\n  <li><strong>Requires:</strong> Warding (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 50 Economy marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "shield",
       "signature": "A round of stamped steel and the conviction to hold it up.",
       "origin": "crafted",
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
       "lore": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><b>Standard Issue.</b> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>",
       "materialOf": [
        {
         "key": "sheet-steel",
         "qty": 1
        },
        {
         "key": "leather-cuff",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII shield (Circuited +2 on TI Pressed Buckler) × bound attuned",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Crowned Pressed Buckler",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/pressed_buckler.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "shield",
     "buckler",
     "graded",
     "grade-crowned"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Shield</li>\n  <li><strong>Defense:</strong> Guard +1</li>\n  <li><strong>Requires:</strong> Warding (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 50 Economy marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Crowned (+3). Keyed to a true name. It will not be sold.</strong></p>\n<ul>\n  <li><strong>+3 on each of its defense bonuses</strong> → Guard +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · soulbound — one bearer, no sale.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "shield",
       "signature": "A round of stamped steel and the conviction to hold it up.",
       "origin": "crafted",
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
       "lore": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><b>Standard Issue.</b> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>",
       "materialOf": [
        {
         "key": "sheet-steel",
         "qty": 1
        },
        {
         "key": "leather-cuff",
         "qty": 1
        },
        {
         "key": "yesodium",
         "qty": 1
        },
        {
         "key": "hex-lattice",
         "qty": 1
        }
       ],
       "price": {
        "marks": 3040,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV shield (Crowned +3 on TI Pressed Buckler) × bound soulbound",
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Laser Pistol, Rad",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_lazer_pistol_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10 + 1",
     "attribute": "violence",
     "type": "energy",
     "damageFlavor": "laser",
     "track": "integrity",
     "base": {
      "types": [
       "radiant"
      ],
      "custom": {
       "enabled": false
      },
      "scaling": {
       "number": 1
      },
      "number": 1,
      "denomination": 10,
      "bonus": "@mod"
     },
     "versatile": {
      "types": [],
      "custom": {
       "enabled": false
      },
      "scaling": {
       "number": 1
      }
     }
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120,
     "units": "ft",
     "reach": null,
     "value": 60
    },
    "tags": [
     "pistol",
     "energy",
     "stun",
     "graded",
     "grade-inlaid"
    ],
    "effect": "Stun Mode: free-action toggle; on hit, Body DC 12 or Staggered (no Integrity dealt).",
    "flavor": "RIGHT??",
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
    "activities": {
     "WZdqu6ucRTjk7P3I": {
      "_id": "WZdqu6ucRTjk7P3I",
      "type": "attack",
      "sort": 0,
      "activation": {
       "type": "action",
       "override": false
      },
      "consumption": {
       "scaling": {
        "allowed": false
       },
       "spellSlot": true,
       "targets": []
      },
      "description": {},
      "duration": {
       "units": "inst",
       "concentration": false,
       "override": false
      },
      "effects": [],
      "flags": {},
      "range": {
       "units": "self",
       "override": false
      },
      "target": {
       "template": {
        "contiguous": false,
        "units": "ft"
       },
       "affects": {
        "choice": false
       },
       "override": false,
       "prompt": true
      },
      "uses": {
       "spent": 0,
       "recovery": []
      },
      "visibility": {
       "level": {},
       "requireAttunement": false,
       "requireIdentification": false,
       "requireMagic": false
      },
      "attack": {
       "critical": {},
       "flat": false,
       "type": {}
      },
      "damage": {
       "critical": {},
       "includeBase": true,
       "parts": []
      }
     }
    },
    "uses": {
     "spent": 0,
     "recovery": [],
     "max": ""
    },
    "description": {
     "value": "<p>You know that really cool laser blaster that you saw that one time?<br /><br />This is it.</p><p></p><p>It shoots lasers.</p><p></p><p>And has a stun mode.</p><p></p><p>RIGHT??</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Stun Mode: free-action toggle; on hit, Body DC 12 or Staggered (no Integrity dealt).</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Thermal damage to <em>Integrity</em> <span style=\"opacity:.75\">(laser)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 to hit and +1 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
     "chat": ""
    },
    "identifier": "weapon",
    "source": {
     "revision": 1,
     "rules": "2024"
    },
    "identified": true,
    "unidentified": {
     "description": ""
    },
    "container": null,
    "quantity": 1,
    "weight": {
     "value": 0,
     "units": "lb"
    },
    "price": {
     "value": 0,
     "denomination": "gp"
    },
    "rarity": "common",
    "attunement": "",
    "attuned": false,
    "equipped": false,
    "crew": {
     "value": []
    },
    "ammunition": {},
    "armor": {},
    "properties": [
     "fir"
    ],
    "proficient": null,
    "type": {
     "value": "martialR",
     "baseItem": ""
    },
    "mastery": ""
   },
   "flags": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "5",
      "frame": "weapon",
      "signature": "",
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
      "signals": {}
     }
    },
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "III",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "It shoots lasers. And has a stun mode.",
       "origin": "crafted",
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
       "signals": {
        "stun": true
       },
       "lore": "<p>Standard-issue thermal sidearm. Compact, focusing-lens nose, two-position selector for kill/stun.</p><p><b>Stun Mode.</b> Switch as a free action. On a hit in stun mode, target makes a Body test (DC 12) or is Staggered until end of next turn. No Integrity damage delivered.</p>",
       "materialOf": [
        {
         "key": "rad-iron",
         "qty": 1
        },
        {
         "key": "focusing-lens",
         "qty": 1
        },
        {
         "key": "hex-iron-cleat",
         "qty": 1
        }
       ],
       "legacySystem": {
        "category": "melee",
        "intent": "violence",
        "skill": "melee",
        "damage": {
         "formula": "2d6",
         "attribute": "violence",
         "type": "kinetic",
         "damageFlavor": "",
         "track": "integrity",
         "base": {
          "types": [
           "radiant"
          ],
          "custom": {
           "enabled": false
          },
          "scaling": {
           "number": 1
          },
          "number": 1,
          "denomination": 10,
          "bonus": "@mod"
         },
         "versatile": {
          "types": [],
          "custom": {
           "enabled": false
          },
          "scaling": {
           "number": 1
          }
         }
        },
        "range": {
         "short": 1,
         "long": 120,
         "units": "ft",
         "reach": null,
         "value": 60
        },
        "tags": [],
        "effect": "",
        "flavor": "",
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
        "activities": {
         "WZdqu6ucRTjk7P3I": {
          "_id": "WZdqu6ucRTjk7P3I",
          "type": "attack",
          "sort": 0,
          "activation": {
           "type": "action",
           "override": false
          },
          "consumption": {
           "scaling": {
            "allowed": false
           },
           "spellSlot": true,
           "targets": []
          },
          "description": {},
          "duration": {
           "units": "inst",
           "concentration": false,
           "override": false
          },
          "effects": [],
          "flags": {},
          "range": {
           "units": "self",
           "override": false
          },
          "target": {
           "template": {
            "contiguous": false,
            "units": "ft"
           },
           "affects": {
            "choice": false
           },
           "override": false,
           "prompt": true
          },
          "uses": {
           "spent": 0,
           "recovery": []
          },
          "visibility": {
           "level": {},
           "requireAttunement": false,
           "requireIdentification": false,
           "requireMagic": false
          },
          "attack": {
           "critical": {},
           "flat": false,
           "type": {}
          },
          "damage": {
           "critical": {},
           "includeBase": true,
           "parts": []
          }
         }
        },
        "uses": {
         "spent": 0,
         "recovery": [],
         "max": ""
        },
        "description": {
         "value": "<p>You know that really cool laser blaster that you saw that one time?<br /><br />This is it.</p><p></p><p>It shoots lasers.</p><p></p><p>And has a stun mode.</p><p></p><p>RIGHT??</p>",
         "chat": ""
        },
        "identifier": "weapon",
        "source": {
         "revision": 1,
         "rules": "2024"
        },
        "identified": true,
        "unidentified": {
         "description": ""
        },
        "container": null,
        "quantity": 1,
        "weight": {
         "value": 0,
         "units": "lb"
        },
        "price": {
         "value": 0,
         "denomination": "gp"
        },
        "rarity": "common",
        "attunement": "",
        "attuned": false,
        "equipped": false,
        "crew": {
         "value": []
        },
        "ammunition": {},
        "armor": {},
        "properties": [
         "fir"
        ],
        "proficient": null,
        "type": {
         "value": "martialR",
         "baseItem": ""
        },
        "mastery": ""
       },
       "price": {
        "marks": 450,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII weapon (Inlaid +1 on TII Laser Pistol, Rad) × bound free",
        "bound": "free",
        "saleBack": 180
       }
      }
     },
     "manifestSheetMode": {
      "bytUGWIOqq9eT7Or": "display"
     },
     "grade": {
      "rank": 1,
      "name": "Inlaid",
      "key": "inlaid",
      "attack": 1,
      "damage": 1
     }
    },
    "autoanimations": {
     "id": "6fa7c3fc-de8d-4600-b521-64a225eff8ed",
     "label": "Laser Pistol, Rad",
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "spell",
       "animation": "guidingbolt",
       "variant": "01",
       "color": "yellow",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Laser Pistol, Rad",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_lazer_pistol_2.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d10 + 2",
     "attribute": "violence",
     "type": "energy",
     "damageFlavor": "laser",
     "track": "integrity",
     "base": {
      "types": [
       "radiant"
      ],
      "custom": {
       "enabled": false
      },
      "scaling": {
       "number": 1
      },
      "number": 1,
      "denomination": 10,
      "bonus": "@mod"
     },
     "versatile": {
      "types": [],
      "custom": {
       "enabled": false
      },
      "scaling": {
       "number": 1
      }
     }
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120,
     "units": "ft",
     "reach": null,
     "value": 60
    },
    "tags": [
     "pistol",
     "energy",
     "stun",
     "graded",
     "grade-circuited"
    ],
    "effect": "Stun Mode: free-action toggle; on hit, Body DC 12 or Staggered (no Integrity dealt).",
    "flavor": "RIGHT??",
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
    "activities": {
     "WZdqu6ucRTjk7P3I": {
      "_id": "WZdqu6ucRTjk7P3I",
      "type": "attack",
      "sort": 0,
      "activation": {
       "type": "action",
       "override": false
      },
      "consumption": {
       "scaling": {
        "allowed": false
       },
       "spellSlot": true,
       "targets": []
      },
      "description": {},
      "duration": {
       "units": "inst",
       "concentration": false,
       "override": false
      },
      "effects": [],
      "flags": {},
      "range": {
       "units": "self",
       "override": false
      },
      "target": {
       "template": {
        "contiguous": false,
        "units": "ft"
       },
       "affects": {
        "choice": false
       },
       "override": false,
       "prompt": true
      },
      "uses": {
       "spent": 0,
       "recovery": []
      },
      "visibility": {
       "level": {},
       "requireAttunement": false,
       "requireIdentification": false,
       "requireMagic": false
      },
      "attack": {
       "critical": {},
       "flat": false,
       "type": {}
      },
      "damage": {
       "critical": {},
       "includeBase": true,
       "parts": []
      }
     }
    },
    "uses": {
     "spent": 0,
     "recovery": [],
     "max": ""
    },
    "description": {
     "value": "<p>You know that really cool laser blaster that you saw that one time?<br /><br />This is it.</p><p></p><p>It shoots lasers.</p><p></p><p>And has a stun mode.</p><p></p><p>RIGHT??</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Stun Mode: free-action toggle; on hit, Body DC 12 or Staggered (no Integrity dealt).</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Thermal damage to <em>Integrity</em> <span style=\"opacity:.75\">(laser)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 to hit and +2 damage</strong> with this weapon (the hit bonus is read from the weapon you swing).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
     "chat": ""
    },
    "identifier": "weapon",
    "source": {
     "revision": 1,
     "rules": "2024"
    },
    "identified": true,
    "unidentified": {
     "description": ""
    },
    "container": null,
    "quantity": 1,
    "weight": {
     "value": 0,
     "units": "lb"
    },
    "price": {
     "value": 0,
     "denomination": "gp"
    },
    "rarity": "common",
    "attunement": "",
    "attuned": false,
    "equipped": false,
    "crew": {
     "value": []
    },
    "ammunition": {},
    "armor": {},
    "properties": [
     "fir"
    ],
    "proficient": null,
    "type": {
     "value": "martialR",
     "baseItem": ""
    },
    "mastery": ""
   },
   "flags": {
    "rfi": {
     "item": {
      "tier": "I",
      "footprint": 1,
      "reach": "5",
      "frame": "weapon",
      "signature": "",
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
      "signals": {}
     }
    },
    "fourththing": {
     "rfi": {
      "item": {
       "tier": "IV",
       "footprint": 1,
       "reach": "5",
       "frame": "weapon",
       "signature": "It shoots lasers. And has a stun mode.",
       "origin": "crafted",
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
       "signals": {
        "stun": true
       },
       "lore": "<p>Standard-issue thermal sidearm. Compact, focusing-lens nose, two-position selector for kill/stun.</p><p><b>Stun Mode.</b> Switch as a free action. On a hit in stun mode, target makes a Body test (DC 12) or is Staggered until end of next turn. No Integrity damage delivered.</p>",
       "materialOf": [
        {
         "key": "rad-iron",
         "qty": 1
        },
        {
         "key": "focusing-lens",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "heart-iron",
         "qty": 2
        }
       ],
       "legacySystem": {
        "category": "melee",
        "intent": "violence",
        "skill": "melee",
        "damage": {
         "formula": "2d6",
         "attribute": "violence",
         "type": "kinetic",
         "damageFlavor": "",
         "track": "integrity",
         "base": {
          "types": [
           "radiant"
          ],
          "custom": {
           "enabled": false
          },
          "scaling": {
           "number": 1
          },
          "number": 1,
          "denomination": 10,
          "bonus": "@mod"
         },
         "versatile": {
          "types": [],
          "custom": {
           "enabled": false
          },
          "scaling": {
           "number": 1
          }
         }
        },
        "range": {
         "short": 1,
         "long": 120,
         "units": "ft",
         "reach": null,
         "value": 60
        },
        "tags": [],
        "effect": "",
        "flavor": "",
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
        "activities": {
         "WZdqu6ucRTjk7P3I": {
          "_id": "WZdqu6ucRTjk7P3I",
          "type": "attack",
          "sort": 0,
          "activation": {
           "type": "action",
           "override": false
          },
          "consumption": {
           "scaling": {
            "allowed": false
           },
           "spellSlot": true,
           "targets": []
          },
          "description": {},
          "duration": {
           "units": "inst",
           "concentration": false,
           "override": false
          },
          "effects": [],
          "flags": {},
          "range": {
           "units": "self",
           "override": false
          },
          "target": {
           "template": {
            "contiguous": false,
            "units": "ft"
           },
           "affects": {
            "choice": false
           },
           "override": false,
           "prompt": true
          },
          "uses": {
           "spent": 0,
           "recovery": []
          },
          "visibility": {
           "level": {},
           "requireAttunement": false,
           "requireIdentification": false,
           "requireMagic": false
          },
          "attack": {
           "critical": {},
           "flat": false,
           "type": {}
          },
          "damage": {
           "critical": {},
           "includeBase": true,
           "parts": []
          }
         }
        },
        "uses": {
         "spent": 0,
         "recovery": [],
         "max": ""
        },
        "description": {
         "value": "<p>You know that really cool laser blaster that you saw that one time?<br /><br />This is it.</p><p></p><p>It shoots lasers.</p><p></p><p>And has a stun mode.</p><p></p><p>RIGHT??</p>",
         "chat": ""
        },
        "identifier": "weapon",
        "source": {
         "revision": 1,
         "rules": "2024"
        },
        "identified": true,
        "unidentified": {
         "description": ""
        },
        "container": null,
        "quantity": 1,
        "weight": {
         "value": 0,
         "units": "lb"
        },
        "price": {
         "value": 0,
         "denomination": "gp"
        },
        "rarity": "common",
        "attunement": "",
        "attuned": false,
        "equipped": false,
        "crew": {
         "value": []
        },
        "ammunition": {},
        "armor": {},
        "properties": [
         "fir"
        ],
        "proficient": null,
        "type": {
         "value": "martialR",
         "baseItem": ""
        },
        "mastery": ""
       },
       "price": {
        "marks": 1350,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV weapon (Circuited +2 on TII Laser Pistol, Rad) × bound attuned",
        "bound": "attuned",
        "saleBack": 540
       }
      }
     },
     "manifestSheetMode": {
      "bytUGWIOqq9eT7Or": "display"
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "attack": 2,
      "damage": 2
     }
    },
    "autoanimations": {
     "id": "6fa7c3fc-de8d-4600-b521-64a225eff8ed",
     "label": "Laser Pistol, Rad",
     "macro": {
      "enable": false,
      "playWhen": "0"
     },
     "menu": "range",
     "primary": {
      "video": {
       "dbSection": "range",
       "menuType": "spell",
       "animation": "guidingbolt",
       "variant": "01",
       "color": "yellow",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Steelweave Hauberk",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/steelweave_hauberk.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 0,
    "resolveBonus": 2,
    "resistances": [
     "kinetic"
    ],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t2-aspiration",
     "heavy",
     "mail",
     "plate",
     "reactive",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A heavy hauberk woven through with a fine tension-thread of reactive yesodium-doped wire, cut and rivetted by a journeyman armorer in one of the older Bad Eden plate-houses. The weave snags incoming force a half-beat before it lands, redistributing it into the wearer's stance instead of their ribs. Heavy. Expensive. Worth it.</p><p><strong>Reactive Lacing.</strong> While worn, the wearer may shift one die of incoming kinetic damage into Stress instead of Integrity, once per scene. No upkeep, no harmonization — the thread does the thinking.</p>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +4, Resolve +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Mail laced with reactive thread. The thread complains. The mail does not.",
       "origin": "crafted",
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
       "lore": "<p>A heavy hauberk woven through with a fine tension-thread of reactive yesodium-doped wire, cut and rivetted by a journeyman armorer in one of the older Bad Eden plate-houses. The weave snags incoming force a half-beat before it lands, redistributing it into the wearer's stance instead of their ribs. Heavy. Expensive. Worth it.</p><p><b>Reactive Lacing.</b> While worn, the wearer may shift one die of incoming kinetic damage into Stress instead of Integrity, once per scene. No upkeep, no harmonization — the thread does the thinking.</p>",
       "materialOf": [
        {
         "key": "mail",
         "qty": 1
        },
        {
         "key": "yesodium-thread",
         "qty": 1
        },
        {
         "key": "rivet-plate",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "grants": {
        "resistances": [
         "kinetic"
        ]
       },
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Inlaid +1 on TII Steelweave Hauberk) × bound free",
        "bound": "free",
        "saleBack": 270
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Steelweave Hauberk",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/steelweave_hauberk.png",
   "system": {
    "guardBonus": 5,
    "evasionBonus": 0,
    "resolveBonus": 3,
    "resistances": [
     "kinetic"
    ],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t2-aspiration",
     "heavy",
     "mail",
     "plate",
     "reactive",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A heavy hauberk woven through with a fine tension-thread of reactive yesodium-doped wire, cut and rivetted by a journeyman armorer in one of the older Bad Eden plate-houses. The weave snags incoming force a half-beat before it lands, redistributing it into the wearer's stance instead of their ribs. Heavy. Expensive. Worth it.</p><p><strong>Reactive Lacing.</strong> While worn, the wearer may shift one die of incoming kinetic damage into Stress instead of Integrity, once per scene. No upkeep, no harmonization — the thread does the thinking.</p>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +5, Resolve +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Mail laced with reactive thread. The thread complains. The mail does not.",
       "origin": "crafted",
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
       "lore": "<p>A heavy hauberk woven through with a fine tension-thread of reactive yesodium-doped wire, cut and rivetted by a journeyman armorer in one of the older Bad Eden plate-houses. The weave snags incoming force a half-beat before it lands, redistributing it into the wearer's stance instead of their ribs. Heavy. Expensive. Worth it.</p><p><b>Reactive Lacing.</b> While worn, the wearer may shift one die of incoming kinetic damage into Stress instead of Integrity, once per scene. No upkeep, no harmonization — the thread does the thinking.</p>",
       "materialOf": [
        {
         "key": "mail",
         "qty": 1
        },
        {
         "key": "yesodium-thread",
         "qty": 1
        },
        {
         "key": "rivet-plate",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "grants": {
        "resistances": [
         "kinetic"
        ]
       },
       "price": {
        "marks": 2025,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Circuited +2 on TII Steelweave Hauberk) × bound attuned",
        "bound": "attuned",
        "saleBack": 810
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
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Septhide Vestments",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/SephiroticScion4.png",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 2,
    "resolveBonus": 3,
    "resistances": [
     "qliphothic"
    ],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "light-cloth",
     "sept-blessed",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Layered cloth armor stitched in a sept-house. Light, breathable, embroidered with a single prayer running spine to hem.</p><p>Wards the wearer against the static the world drags in — corruption finds the cloth quieter than the body beneath.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Defense:</strong> Guard +2, Evasion +1, Resolve +2</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Resistance:</strong> Qliphothic</li>\n  <li><strong>Tier:</strong> II</li>\n  <li><strong>Cost:</strong> 225 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +3, Evasion +2, Resolve +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Cloth that remembers the prayer it was woven for.",
       "origin": "crafted",
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
       "lore": "<p>Layered cloth armor stitched in a sept-house. Light, breathable, embroidered with a single prayer running spine to hem.</p><p>Wards the wearer against the static the world drags in — corruption finds the cloth quieter than the body beneath.</p>",
       "materialOf": [
        {
         "key": "sept-cloth",
         "qty": 1
        },
        {
         "key": "blessed-thread",
         "qty": 1
        },
        {
         "key": "prayer-resin",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "grants": {
        "resistances": [
         "qliphothic"
        ]
       },
       "price": {
        "marks": 675,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII armor (Inlaid +1 on TII Septhide Vestments) × bound free",
        "bound": "free",
        "saleBack": 270
       }
      }
     },
     "grants": {
      "resistances": [
       "qliphothic"
      ]
     },
     "grade": {
      "rank": 1,
      "name": "Inlaid",
      "key": "inlaid",
      "defense": 1
     }
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Septhide Vestments",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/SephiroticScion4.png",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 3,
    "resolveBonus": 4,
    "resistances": [
     "qliphothic"
    ],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "light-cloth",
     "sept-blessed",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Layered cloth armor stitched in a sept-house. Light, breathable, embroidered with a single prayer running spine to hem.</p><p>Wards the wearer against the static the world drags in — corruption finds the cloth quieter than the body beneath.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Defense:</strong> Guard +2, Evasion +1, Resolve +2</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Resistance:</strong> Qliphothic</li>\n  <li><strong>Tier:</strong> II</li>\n  <li><strong>Cost:</strong> 225 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +4, Evasion +3, Resolve +4 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Cloth that remembers the prayer it was woven for.",
       "origin": "crafted",
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
       "lore": "<p>Layered cloth armor stitched in a sept-house. Light, breathable, embroidered with a single prayer running spine to hem.</p><p>Wards the wearer against the static the world drags in — corruption finds the cloth quieter than the body beneath.</p>",
       "materialOf": [
        {
         "key": "sept-cloth",
         "qty": 1
        },
        {
         "key": "blessed-thread",
         "qty": 1
        },
        {
         "key": "prayer-resin",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "grants": {
        "resistances": [
         "qliphothic"
        ]
       },
       "price": {
        "marks": 2025,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV armor (Circuited +2 on TII Septhide Vestments) × bound attuned",
        "bound": "attuned",
        "saleBack": 810
       }
      }
     },
     "grants": {
      "resistances": [
       "qliphothic"
      ]
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "defense": 2
     }
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Inlaid Wardiron Targe",
   "type": "armor",
   "img": "icons/equipment/shield/heater-emossed-spiral-green.webp",
   "system": {
    "guardBonus": 3,
    "evasionBonus": 0,
    "resolveBonus": 2,
    "resistances": [
     "kinetic"
    ],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "shield",
     "warding",
     "wardiron",
     "graded",
     "grade-inlaid"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A heavy round targe banded in wardiron — anchorstone smelted with the steel so the metal sits a half-beat ahead of the blow. Favored by faction line-holders who'd rather lose the shield than the arm behind it.</p><p><strong>Wardiron.</strong> The banding grounds raw force. Resists kinetic. No attunement — the iron does the remembering.</p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Armor:</strong> Shield</p></li><li><p><strong>Defense:</strong> Guard +2, Resolve +1</p></li><li><p><strong>Requires:</strong> Warding (trained)</p></li><li><p><strong>Resistance:</strong> Kinetic</p></li><li><p><strong>Tier:</strong> II</p></li><li><p><strong>Cost:</strong> 150 Economy marks</p></li></ul>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Inlaid (+1). Hex-inlay along the working edge.</strong></p>\n<ul>\n  <li><strong>+1 on each of its defense bonuses</strong> → Guard +3, Resolve +2 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier III</strong> · free to wield.</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "shield",
       "signature": "Cold-forged to take the hit you didn't see.",
       "origin": "crafted",
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
       "lore": "<p>A heavy round targe banded in wardiron — anchorstone smelted with the steel so the metal sits a half-beat ahead of the blow. Favored by faction line-holders who'd rather lose the shield than the arm behind it.</p><p><b>Wardiron.</b> The banding grounds raw force. Resists kinetic. No attunement — the iron does the remembering.</p>",
       "materialOf": [
        {
         "key": "wardiron",
         "qty": 1
        },
        {
         "key": "anchorstone",
         "qty": 1
        },
        {
         "key": "oak-core",
         "qty": 1
        },
        {
         "key": "sept-silver",
         "qty": 1
        }
       ],
       "price": {
        "marks": 675,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIII shield (Inlaid +1 on TII Wardiron Targe) × bound free",
        "bound": "free",
        "saleBack": 270
       }
      }
     },
     "grants": {
      "resistances": [
       {
        "type": "kinetic"
       }
      ]
     },
     "grade": {
      "rank": 1,
      "name": "Inlaid",
      "key": "inlaid",
      "defense": 1
     }
    }
   }
  }
 },
 {
  "folder": "Graded Arms",
  "v": {
   "name": "Circuited Wardiron Targe",
   "type": "armor",
   "img": "icons/equipment/shield/heater-emossed-spiral-green.webp",
   "system": {
    "guardBonus": 4,
    "evasionBonus": 0,
    "resolveBonus": 3,
    "resistances": [
     "kinetic"
    ],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "shield",
     "warding",
     "wardiron",
     "graded",
     "grade-circuited"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A heavy round targe banded in wardiron — anchorstone smelted with the steel so the metal sits a half-beat ahead of the blow. Favored by faction line-holders who'd rather lose the shield than the arm behind it.</p><p><strong>Wardiron.</strong> The banding grounds raw force. Resists kinetic. No attunement — the iron does the remembering.</p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Armor:</strong> Shield</p></li><li><p><strong>Defense:</strong> Guard +2, Resolve +1</p></li><li><p><strong>Requires:</strong> Warding (trained)</p></li><li><p><strong>Resistance:</strong> Kinetic</p></li><li><p><strong>Tier:</strong> II</p></li><li><p><strong>Cost:</strong> 150 Economy marks</p></li></ul>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Circuited (+2). A closed circuit of sigils; it answers one hand.</strong></p>\n<ul>\n  <li><strong>+2 on each of its defense bonuses</strong> → Guard +4, Resolve +3 (rank-scaled like all armor: Trained half, Proficient full).</li>\n  <li>Grade raises it to <strong>Tier IV</strong> · attuned (one slot).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "shield",
       "signature": "Cold-forged to take the hit you didn't see.",
       "origin": "crafted",
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
       "lore": "<p>A heavy round targe banded in wardiron — anchorstone smelted with the steel so the metal sits a half-beat ahead of the blow. Favored by faction line-holders who'd rather lose the shield than the arm behind it.</p><p><b>Wardiron.</b> The banding grounds raw force. Resists kinetic. No attunement — the iron does the remembering.</p>",
       "materialOf": [
        {
         "key": "wardiron",
         "qty": 1
        },
        {
         "key": "anchorstone",
         "qty": 1
        },
        {
         "key": "oak-core",
         "qty": 1
        },
        {
         "key": "hex-glyph-plate",
         "qty": 1
        },
        {
         "key": "wardiron",
         "qty": 1
        }
       ],
       "price": {
        "marks": 2025,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TIV shield (Circuited +2 on TII Wardiron Targe) × bound attuned",
        "bound": "attuned",
        "saleBack": 810
       }
      }
     },
     "grants": {
      "resistances": [
       {
        "type": "kinetic"
       }
      ]
     },
     "grade": {
      "rank": 2,
      "name": "Circuited",
      "key": "circuited",
      "defense": 2
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Hand Axe of the Keystone Verdict",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_axe.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d8",
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
     "versatile",
     "thrown",
     "bound-working"
    ],
    "effect": "Versatile. May be thrown at short range as an improvised ranged attack.",
    "flavor": "Equally good at cordwood and conversation.",
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
     "value": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Versatile. May be thrown at short range as an improvised ranged attack.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(chop)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Keystone Verdict (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Keystone Verdict</strong>: it appears among your Manifestations as “Keystone Verdict ⟡ Hand Axe of the Keystone Verdict” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>Mark the load-bearing point of a target within 30 ft: 1d6 kinetic (integrity) and Guard −2 for the scene while the mark holds.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Splits firewood in the morning, splits opinions in the evening.",
       "origin": "crafted",
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
       "lore": "<p>Single-bit utility axe with a hickory haft and a leather wrist-thong. Cuts kindling, cuts cord, cuts targets that get within arm's reach. Throws acceptably for short distances.</p><p><b>Standard Issue.</b> Pulls double duty as a tool. No signature, no surprise — just dependable weight.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "hickory-haft",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: Keystone Verdict TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Keystone Verdict",
       "img": "icons/equipment/shield/heater-steel-worn.webp",
       "system": {
        "intent": "intrigue",
        "channel": "mind",
        "sephirah": "binah",
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
         "op": "damage",
         "number": 1,
         "die": "d6",
         "attribute": "intrigue",
         "type": "kinetic",
         "flavor": "the one brick that mattered",
         "track": "integrity"
        },
        "damageParts": [],
        "effect": "Mark the load-bearing point of a target within 30 ft: 1d6 kinetic (integrity) and Guard −2 for the scene while the mark holds.",
        "tags": [
         "starter-kit",
         "debuff",
         "mark",
         "path:bulwark",
         "doctrine-signature",
         "sigil",
         "harm",
         "sustained"
        ],
        "category": "manifestation",
        "flavor": "Everything is load-bearing if you're honest about it. Most people aren't. Walls never are.",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "Every structure has the one brick holding the argument together. You circle it in chalk that was never chalk.",
         "form": "sigil",
         "function": "harm",
         "stability": "sustained",
         "interactionModel": "mark",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "scene",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Bulwark — bulwark cataclyst",
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
            "stat": "guard",
            "op": "-",
            "value": 2
           }
          ],
          "resists": [],
          "immunes": []
         }
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "ba39b415-c1aa-4828-8ec8-3e184eb852e9",
     "label": "Hand Axe",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "greataxe",
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
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Maul of the Pressure Front",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_hammer_1.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d12",
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
     "maul",
     "two-handed",
     "heavy",
     "bound-working"
    ],
    "effect": "Two-handed, heavy. Pairs well with Bulwark Frame.",
    "flavor": "Not subtle. Not trying to be.",
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
     "value": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Two-handed, heavy. Pairs well with Bulwark Frame.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d12 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blunt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Pressure Front (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Pressure Front</strong>: it appears among your Manifestations as “Pressure Front ⟡ Maul of the Pressure Front” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>Release the front in a 15-ft cone: 1d6 kinetic (integrity), and each target saves Body vs Cast DC or is knocked Prone.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "When the door is the problem, the maul is the answer.",
       "origin": "crafted",
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
       "lore": "<p>Two-handed iron-headed maul on a long ash haft. Heavy, slow, and absolutely uninterested in your finesse. The Bulwark's first real weapon — the one you swing when subtlety has already failed.</p><p><b>Standard Issue.</b> Heavy two-handed kinetic. No signature — Frame Dice and Ruin Charges still do their work; the maul just makes the impact mean it.</p>",
       "materialOf": [
        {
         "key": "pig-iron",
         "qty": 1
        },
        {
         "key": "ash-haft",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: Pressure Front TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Pressure Front",
       "img": "icons/equipment/shield/heater-steel-worn.webp",
       "system": {
        "intent": "violence",
        "channel": "body",
        "sephirah": "gevurah",
        "mode": "hermetic",
        "clarityRequired": 0,
        "noiseGain": 0,
        "activation": "action",
        "target": "area",
        "range": "near",
        "damage": "",
        "damageType": "energy",
        "damageFlavor": "",
        "damageRoll": {
         "op": "damage",
         "number": 1,
         "die": "d6",
         "attribute": "violence",
         "type": "kinetic",
         "flavor": "advancing weight",
         "track": "integrity"
        },
        "damageParts": [],
        "effect": "Release the front in a 15-ft cone: 1d6 kinetic (integrity), and each target saves Body vs Cast DC or is knocked Prone.",
        "tags": [
         "starter-kit",
         "aoe",
         "cc",
         "path:bulwark",
         "doctrine-signature",
         "field",
         "harm",
         "sustained",
         "zone"
        ],
        "category": "manifestation",
        "flavor": "Snow doesn't hate anyone. That's what makes it so good at this.",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You carry the exact moment an avalanche decides. Point it somewhere.",
         "form": "field",
         "function": "harm",
         "stability": "sustained",
         "interactionModel": "zone",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "action",
         "durationText": "",
         "triggerText": "",
         "scale": "scene",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 0,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Bulwark — bulwark avalanche",
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
          "shape": "cone",
          "size": 15
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
         "appliedStates": {
          "states": [
           "prone"
          ],
          "duration": "1-round",
          "saveEachRound": false,
          "saveAttribute": "body",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "295c9eda-4e4c-4533-9aa9-efffa8ebb49e",
     "label": "Maul",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "maul",
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
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Combat Knife of Strikethrough",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_dagger_2.png",
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
     "knife",
     "light",
     "finesse",
     "bound-working"
    ],
    "effect": "Light, finesse-friendly. No signature ability.",
    "flavor": "Cheap. Honest. Always sharp enough.",
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
     "value": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Light, finesse-friendly. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(blade)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Melee (Violence)</li>\n  <li><strong>Reach:</strong> Melee</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Strikethrough (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Strikethrough</strong>: it appears among your Manifestations as “Strikethrough ⟡ Combat Knife of Strikethrough” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One target within 30 ft takes 1d6 psychic (stress); Mind defense vs Cast DC or Shaken for 1 round.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Sharpened on a thousand other days like this one.",
       "origin": "crafted",
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
       "lore": "<p>Standard-issue field knife. Single-edge, thumb groove, hard sheath that clips to a belt or boot. The first weapon most Stewards carry and the last one they put down. Honest steel — no signature, no story, just edge.</p><p><b>Standard Issue.</b> Light enough for off-hand work; close enough for the kind of conversation knives are for.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "leather-grip",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: Strikethrough TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Strikethrough",
       "img": "icons/sundries/documents/document-sealed-signatures-red.webp",
       "system": {
        "intent": "intrigue",
        "channel": "mind",
        "sephirah": "gevurah",
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
         "op": "damage",
         "number": 1,
         "die": "d6",
         "attribute": "intrigue",
         "type": "psychic",
         "flavor": "one load-bearing word, deleted",
         "track": "stress"
        },
        "damageParts": [],
        "effect": "One target within 30 ft takes 1d6 psychic (stress); Mind defense vs Cast DC or Shaken for 1 round.",
        "tags": [
         "starter-kit",
         "instant",
         "stress",
         "reused",
         "path:cosmic_linguist",
         "path-core",
         "sigil",
         "harm",
         "event"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'It's still legible under the line. That's the cruel part. They can see what they used to mean.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You draw one clean horizontal line through a word the target was standing on — 'inevitable,' usually. The sentence sags.",
         "form": "sigil",
         "function": "harm",
         "stability": "instant",
         "interactionModel": "event",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Cosmic Linguist",
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
         "appliedStates": {
          "states": [
           "shaken"
          ],
          "duration": "1-round",
          "saveEachRound": false,
          "saveAttribute": "mind",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "bc02ed23-8978-493d-9da4-6f9f745b8c6d",
     "label": "Combat Knife",
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
     "meleeSwitch": {
      "video": {
       "dbSection": "range",
       "menuType": "weapon",
       "animation": "arrow",
       "variant": "regular",
       "color": "regular"
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     },
     "menu": "melee",
     "primary": {
      "video": {
       "dbSection": "melee",
       "menuType": "weapon",
       "animation": "dagger",
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
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Slug Pistol of Correspondence",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_lazer_pistol_2.png",
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
     "bound-working"
    ],
    "effect": "Standard ballistic sidearm. No signature ability.",
    "flavor": "Boring. Reliable. The two best things a pistol can be.",
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
     "value": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Standard ballistic sidearm. No signature ability.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 20 / 80</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Correspondence Strike (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Correspondence Strike</strong>: it appears among your Manifestations as “Correspondence Strike ⟡ Slug Pistol of Correspondence” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One creature within 30 ft: Body defense vs Cast DC. On fail: 1d6 energy and Staggered for 1 round as the correspondence lands.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Six rounds, one trigger, no opinions.",
       "origin": "crafted",
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
       "lore": "<p>Standard-pattern slug-throwing sidearm. Iron sights, six-round chamber, kicks like a polite mule. The most common ranged weapon in Bad Eden — the kind of pistol you find in a glove box, a holster, or the bottom of a trade-post crate.</p><p><b>Standard Issue.</b> No signature, no electronics, no hum. It just shoots.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "casing-brass",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: Correspondence Strike TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Correspondence Strike",
       "img": "icons/magic/perception/eye-tendrils-web-purple.webp",
       "system": {
        "intent": "intrigue",
        "channel": "mind",
        "sephirah": "chokmah",
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
         "op": "damage",
         "number": 1,
         "die": "d6",
         "attribute": "intrigue",
         "type": "electrical",
         "flavor": "",
         "track": "integrity"
        },
        "damageParts": [],
        "effect": "One creature within 30 ft: Body defense vs Cast DC. On fail: 1d6 energy and Staggered for 1 round as the correspondence lands.",
        "tags": [
         "starter-kit",
         "wyrdlens",
         "damage",
         "reused",
         "path:wyrdlens-adept",
         "path-core",
         "sigil",
         "harm",
         "instant",
         "event"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Sympathy is a beautiful force of cosmic unity. Also you can hit a guy with it.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "As above, so below; as the bottle you just cracked, so the knee of the man holding it. You break the small thing and the big thing agrees.",
         "form": "sigil",
         "function": "harm",
         "stability": "instant",
         "interactionModel": "event",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Wyrdlens Adept",
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
         "appliedStates": {
          "states": [
           "staggered"
          ],
          "duration": "1-round",
          "saveEachRound": false,
          "saveAttribute": "body",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "53aa0b6b-d75b-4b4b-b207-c7e9acd1d303",
     "label": "Slug Pistol",
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
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Sap of the Sleep-Loop",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_quarterstaff%20Background%20Removed.png",
   "system": {
    "category": "melee",
    "intent": "violence",
    "skill": "melee",
    "damage": {
     "formula": "1d6",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "subdual",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 1,
     "long": 1
    },
    "tags": [
     "t1-baseline",
     "sap",
     "concealable",
     "subdual",
     "bound-working"
    ],
    "effect": "Concealable. Damage easily declared nonlethal at the wielder's option.",
    "flavor": "Compact. Apologetic. Functional.",
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
     "value": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Concealable. Damage easily declared nonlethal at the wielder's option.</p>\n<ul>\n <li><strong>Damage:</strong> 1d6 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(subdual)</span></li>\n <li><strong>Faculty:</strong> Violence</li>\n <li><strong>Attack:</strong> Melee (Violence)</li>\n <li><strong>Reach:</strong> Melee</li>\n <li><strong>Duration:</strong> Scene</li>\n <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Sleep-Loop (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Sleep-Loop</strong>: it appears among your Manifestations as “Sleep-Loop ⟡ Sap of the Sleep-Loop” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One creature within 30 ft: Soul defense vs Cast DC. On fail: Charmed, re-saving each round until they shake the loop.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "A short conversation about the back of a head.",
       "origin": "crafted",
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
       "lore": "<p>Leather-wrapped lead-shot bludgeon, palm-sized. Lives in a pocket or a sleeve. Designed to put someone out without breaking anything that won't heal in a week.</p><p><b>Standard Issue (Subdual).</b> Damage is subdual-flavored — narratively kinetic but easy to declare nonlethal. Useful for Couriers, intriguers, and anyone whose plan ended with \"and then we walk away.\"</p>",
       "materialOf": [
        {
         "key": "lead-shot",
         "qty": 1
        },
        {
         "key": "wrapped-leather",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: Sleep-Loop TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Sleep-Loop",
       "img": "icons/magic/control/sleep-bubble-purple.webp",
       "system": {
        "intent": "intrigue",
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
        "effect": "One creature within 30 ft: Soul defense vs Cast DC. On fail: Charmed, re-saving each round until they shake the loop.",
        "tags": [
         "starter-kit",
         "dreamwalker",
         "cc",
         "reused",
         "path:dreamwalker",
         "path-core",
         "echo",
         "bind",
         "instant",
         "mark"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'It's the one where their teeth aren't falling out and everyone claps. Of course they went back in.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You hand the target the same ten seconds of a very pleasant dream, on repeat. They keep almost finishing it. It keeps almost being finished.",
         "form": "echo",
         "function": "bind",
         "stability": "instant",
         "interactionModel": "mark",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Dreamwalker",
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
         "appliedStates": {
          "states": [
           "charmed"
          ],
          "duration": "until-saved",
          "saveEachRound": true,
          "saveAttribute": "soul",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "d645f26d-5cd9-4627-8990-7fdd643d681e",
     "label": "Sap",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5,
     "meleeSwitch": {
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
       "detect": "automatic",
       "range": 2,
       "returning": false,
       "switchType": "on"
      }
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Bolt-Driver of Frozen Assets",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_button_icon_heavy_crossbow.png",
   "system": {
    "category": "ranged",
    "intent": "violence",
    "skill": "firearms",
    "damage": {
     "formula": "1d8",
     "attribute": "violence",
     "type": "kinetic",
     "damageFlavor": "bolt",
     "track": "integrity"
    },
    "damageParts": [],
    "range": {
     "short": 30,
     "long": 120
    },
    "tags": [
     "t1-baseline",
     "crossbow",
     "silent",
     "slow-reload",
     "bound-working"
    ],
    "effect": "Silent on discharge. GM may call for a 1-action reload between shots.",
    "flavor": "The kind of weapon that knows how to shut up.",
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
     "value": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Silent on discharge. GM may call for a 1-action reload between shots.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d8 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(bolt)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 30 / 120</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Freeze Assets (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Freeze Assets</strong>: it appears among your Manifestations as “Freeze Assets ⟡ Bolt-Driver of Frozen Assets” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One target within 30 ft: Soul defense vs Cast DC. On fail: Restrained for 1 round pending investigation.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Quiet enough to keep your secrets.",
       "origin": "crafted",
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
       "lore": "<p>Compact crossbow built around a salvaged spring-tension mechanism. Slow to reload, near-silent on release. The Courier's preferred long-touch tool when noise is a tax you can't afford to pay.</p><p><b>Standard Issue.</b> Silent. Slow to reload (1 action between shots, GM call). No signature.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "spring-tension-arm",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: Freeze Assets TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Freeze Assets",
       "img": "icons/sundries/scrolls/scroll-runed-brown-purple.webp",
       "system": {
        "intent": "presence",
        "channel": "soul",
        "sephirah": "gevurah",
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
        "effect": "One target within 30 ft: Soul defense vs Cast DC. On fail: Restrained for 1 round pending investigation.",
        "tags": [
         "starter-kit",
         "instant",
         "cc",
         "path:pactkeeper",
         "doctrine-signature",
         "sigil",
         "bind",
         "event"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Your account has been locked for suspicious activity. The suspicious activity was \"charging at the Pactkeeper.\"'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "Pending review, the target's assets are frozen. All of them. Including the arms and legs, which are, technically, assets.",
         "form": "sigil",
         "function": "bind",
         "stability": "instant",
         "interactionModel": "event",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Pactkeeper — pactkeeper auditor",
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
         "appliedStates": {
          "states": [
           "restrained"
          ],
          "duration": "1-round",
          "saveEachRound": false,
          "saveAttribute": "soul",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "43f43748-c581-43b4-82ba-2ff90566f9a2",
     "label": "Bolt-Driver",
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
       "animation": "bolt",
       "variant": "cold",
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
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Hunting Rifle of the Record",
   "type": "weapon",
   "img": "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_military_2.png",
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
     "short": 60,
     "long": 200
    },
    "tags": [
     "t1-baseline",
     "rifle",
     "ballistic",
     "two-handed",
     "bound-working"
    ],
    "effect": "Long-arm ballistic. Two-handed.",
    "flavor": "Loud where it counts. Quiet otherwise.",
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
     "value": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<p>Long-arm ballistic. Two-handed.</p>\n<ul>\n  <li><strong>Damage:</strong> 1d10 Kinetic damage to <em>Integrity</em> <span style=\"opacity:.75\">(ballistic)</span></li>\n  <li><strong>Faculty:</strong> Violence</li>\n  <li><strong>Attack:</strong> Firearms (Violence)</li>\n  <li><strong>Range:</strong> 60 / 200</li>\n  <li><strong>Duration:</strong> Scene</li>\n  <li><strong>Tier:</strong> T1</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — The Record Shows (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>The Record Shows</strong>: it appears among your Manifestations as “The Record Shows ⟡ Hunting Rifle of the Record” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One target within 30 ft is marked for the scene: Evasion −2 while their every move is a matter of record.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->"
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
       "signature": "Patient steel for impatient situations.",
       "origin": "crafted",
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
       "lore": "<p>Bolt-action long arm, walnut stock, iron sights with an optional clamp-mount for a scope nobody can afford. Slow, accurate, loud. Used for game, for guard duty, and once memorably for an argument over fence lines.</p><p><b>Standard Issue.</b> Long range, no electronics, no magic. The rifle every patrol cabinet has at least one of.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "walnut-stock",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "violence",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII weapon × tech 2.0 (bound Working: The Record Shows TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "The Record Shows",
       "img": "icons/sundries/scrolls/scroll-runed-brown-purple.webp",
       "system": {
        "intent": "intrigue",
        "channel": "mind",
        "sephirah": "binah",
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
        "effect": "One target within 30 ft is marked for the scene: Evasion −2 while their every move is a matter of record.",
        "tags": [
         "starter-kit",
         "debuff",
         "mark",
         "path:pactkeeper",
         "doctrine-signature",
         "sigil",
         "reveal",
         "sustained"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Hard to dodge when your dodge is pre-registered. With diagrams.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You enter the target's position into the record — location, stance, habits, tells. The record is public. The record updates in real time.",
         "form": "sigil",
         "function": "reveal",
         "stability": "sustained",
         "interactionModel": "mark",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "scene",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Pactkeeper — pactkeeper archivist of precedent",
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
         "appliedStates": {
          "states": [],
          "duration": "scene",
          "saveEachRound": false,
          "saveAttribute": "mind",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    },
    "autoanimations": {
     "id": "0a92a0bd-b1fc-48d7-b730-a046c9c80b50",
     "label": "Hunting Rifle",
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
     "isEnabled": true,
     "isCustomized": true,
     "fromAmmo": false,
     "version": 5
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Initiate's Robe of Thick Skin",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/initiates_robes.png",
   "system": {
    "guardBonus": 0,
    "evasionBonus": 1,
    "resolveBonus": 1,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "robe",
     "cloth",
     "caster",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><strong>Standard Issue.</strong> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Cloth</li>\n  <li><strong>Defense:</strong> Evasion +1, Resolve +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Thick Skin, Literally (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Thick Skin, Literally</strong>: it appears among your Manifestations as “Thick Skin, Literally ⟡ Initiate's Robe of Thick Skin” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One ally within 30 ft (or yourself) gains Guard +2 for the scene.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Plain cloth. The hem remembers the floor of the room you left.",
       "origin": "crafted",
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
       "lore": "<p>Undyed sept-cloth cut to a long working robe with a corded belt. Issued to first-circle initiates of any chapterhouse or tutor-cell — the kind of garment that gets traded between students faster than any of them keep notebooks. Comfortable to channel in. Forgettable to anyone watching for trouble.</p><p><b>Standard Issue.</b> Light enough to manifest in. Dignified enough to walk past a sept-warden.</p>",
       "materialOf": [
        {
         "key": "sept-cloth",
         "qty": 1
        },
        {
         "key": "corded-belt",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 450,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor × tech 2.0 (bound Working: Thick Skin, Literally TI) × attuned",
        "bound": "attuned",
        "saleBack": 180
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Thick Skin, Literally",
       "img": "icons/sundries/documents/document-sealed-signatures-red.webp",
       "system": {
        "intent": "presence",
        "channel": "body",
        "sephirah": "chesed",
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
        "effect": "One ally within 30 ft (or yourself) gains Guard +2 for the scene.",
        "tags": [
         "starter-kit",
         "ward",
         "path:cosmic_linguist",
         "doctrine-signature",
         "vestment",
         "protect",
         "sustained",
         "worn"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Rhino-adjacent. Emotionally AND ballistically.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You compliment an ally on being thick-skinned, and the metaphor settles over them like a well-worn duster: insults and shrapnel alike now mostly bounce.",
         "form": "vestment",
         "function": "protect",
         "stability": "sustained",
         "interactionModel": "worn",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "scene",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Cosmic Linguist — cosmic linguist linguist metaphor apostle",
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
            "stat": "guard",
            "op": "+",
            "value": 2
           }
          ],
          "resists": [],
          "immunes": []
         }
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Worker's Leathers, Heavily Redacted",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/aurablade_florensis.png",
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
     "utility",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><strong>Standard Issue.</strong> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p><hr><p><strong>⚙️ Mechanical Effects</strong></p><ul><li><p><strong>Armor:</strong> Light</p></li><li><p><strong>Defense:</strong> Guard +1, Evasion +1</p></li><li><p><strong>Requires:</strong> Weave (trained)</p></li><li><p><strong>Tier:</strong> I</p></li><li><p><strong>Cost:</strong> 75 Nonlethal marks</p></li></ul>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Heavily Redacted (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Heavily Redacted</strong>: it appears among your Manifestations as “Heavily Redacted ⟡ Worker's Leathers, Heavily Redacted” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One ally within 30 ft (or yourself) gains Evasion +2 for the scene — hard to hit what's mostly black bars.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Built for the kind of day where something might fall on you.",
       "origin": "crafted",
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
       "lore": "<p>Heavy work jacket, reinforced gloves, and a thigh-strap of tool loops. The standard kit for hex-laborers, salvage crews, scrap-line foremen, and anyone whose day involves both sharp edges and difficult conversations with their employer. Not glamorous. Hard to ruin.</p><p><b>Standard Issue.</b> Counts as armor for protection rolls and as gear for any skill check you can talk your way into calling \"work.\"</p>",
       "materialOf": [
        {
         "key": "work-leather",
         "qty": 1
        },
        {
         "key": "rivet-strap",
         "qty": 1
        },
        {
         "key": "tool-loop",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 450,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor × tech 2.0 (bound Working: Heavily Redacted TI) × attuned",
        "bound": "attuned",
        "saleBack": 180
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Heavily Redacted",
       "img": "icons/sundries/documents/document-sealed-signatures-red.webp",
       "system": {
        "intent": "intrigue",
        "channel": "mind",
        "sephirah": "binah",
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
        "effect": "One ally within 30 ft (or yourself) gains Evasion +2 for the scene — hard to hit what's mostly black bars.",
        "tags": [
         "starter-kit",
         "ward",
         "stealth",
         "path:cosmic_linguist",
         "doctrine-signature",
         "vestment",
         "protect",
         "sustained",
         "worn"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Witness protection, but for your silhouette.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You strike sensitive details from an ally's public record: outline, heading, current position. Onlookers get the gist and nothing actionable.",
         "form": "vestment",
         "function": "protect",
         "stability": "sustained",
         "interactionModel": "worn",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "scene",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Cosmic Linguist — cosmic linguist linguist redactor",
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Drifter's Weave of the Standing Oath",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/drifter_weave.png",
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
     "cloth",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><strong>Standard Issue.</strong> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Light</li>\n  <li><strong>Defense:</strong> Guard +1, Evasion +1</li>\n  <li><strong>Requires:</strong> Weave (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Standing Oath (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Standing Oath</strong>: it appears among your Manifestations as “Standing Oath ⟡ Drifter's Weave of the Standing Oath” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>You (or one touched ally) gain Resolve +2 for the scene while the oath stands.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Cloth that's already walked further than you have.",
       "origin": "crafted",
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
       "lore": "<p>Layered travel cloth — patchwork canvas over a quilted underlayer, road-stained at the cuffs. Cut for moving. Sold on every frontier table from Allesh Gilliam to the edge of the Lyrenn line. The first armor most Stewards ever buy, and the first they outgrow.</p><p><b>Standard Issue.</b> Worn in the field, not the throne room. Easy to repair, easy to replace, easy to forget you have it on.</p>",
       "materialOf": [
        {
         "key": "road-canvas",
         "qty": 1
        },
        {
         "key": "quilted-liner",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 450,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor × tech 2.0 (bound Working: Standing Oath TI) × attuned",
        "bound": "attuned",
        "saleBack": 180
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Standing Oath",
       "img": "icons/sundries/scrolls/scroll-runed-brown-purple.webp",
       "system": {
        "intent": "presence",
        "channel": "soul",
        "sephirah": "chesed",
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
        "effect": "You (or one touched ally) gain Resolve +2 for the scene while the oath stands.",
        "tags": [
         "starter-kit",
         "ward",
         "reused",
         "path:pactkeeper",
         "path-core",
         "vestment",
         "protect",
         "sustained",
         "worn"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Some armor is riveted. Some is just a sentence somebody refused to take back.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You renew a promise you have never broken and wear it like a coat. It has weathered worse than today.",
         "form": "vestment",
         "function": "protect",
         "stability": "sustained",
         "interactionModel": "worn",
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
         "pathResonance": "Pactkeeper",
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Pressed Buckler of Mutual Aid",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/pressed_buckler.png",
   "system": {
    "guardBonus": 1,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "shield",
     "buckler",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><strong>Standard Issue.</strong> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Shield</li>\n  <li><strong>Defense:</strong> Guard +1</li>\n  <li><strong>Requires:</strong> Warding (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 50 Economy marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Mutual Aid Clause (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Mutual Aid Clause</strong>: it appears among your Manifestations as “Mutual Aid Clause ⟡ Pressed Buckler of Mutual Aid” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One ally within 30 ft immediately gains Guard +2 for 1 round as the neighborhood arrives.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "shield",
       "signature": "A round of stamped steel and the conviction to hold it up.",
       "origin": "crafted",
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
       "lore": "<p>A small round buckler stamped from sheet steel and laced to a leather forearm cuff. Faction-pressed in batches of a thousand and handed out to whoever could close their fingers around the grip. Half ward, half noisemaker — the dent in the front is where someone else's mistake stopped.</p><p><b>Standard Issue.</b> Pairs with any one-handed weapon. No signature, no attunement, no apologies for the dent.</p>",
       "materialOf": [
        {
         "key": "sheet-steel",
         "qty": 1
        },
        {
         "key": "leather-cuff",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 450,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII shield × tech 2.0 (bound Working: Mutual Aid Clause TI) × attuned",
        "bound": "attuned",
        "saleBack": 180
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Mutual Aid Clause",
       "img": "icons/sundries/scrolls/scroll-runed-brown-purple.webp",
       "system": {
        "intent": "presence",
        "channel": "soul",
        "sephirah": "chesed",
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
        "effect": "One ally within 30 ft immediately gains Guard +2 for 1 round as the neighborhood arrives.",
        "tags": [
         "starter-kit",
         "instant",
         "ward",
         "support",
         "path:pactkeeper",
         "doctrine-signature",
         "rite",
         "protect",
         "event"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Forty invisible casseroles and a guy with a truck. You cannot buy this coverage.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You invoke the clause every real community keeps in force: when one of ours is in trouble, the neighbors show up. Briefly, invisibly, they do.",
         "form": "rite",
         "function": "protect",
         "stability": "instant",
         "interactionModel": "event",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Pactkeeper — pactkeeper steward of living communities",
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
         "appliedStates": {
          "states": [],
          "duration": "1-round",
          "saveEachRound": false,
          "saveAttribute": "soul",
          "saveDcMode": "cast-dc",
          "saveDcFixed": 15,
          "saveAttributeOverrides": {}
         },
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
            "stat": "guard",
            "op": "+",
            "value": 2
           }
          ],
          "resists": [],
          "immunes": []
         }
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Bulwark Hauberk of the Wall",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/bulwark_hauberk.png",
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
     "mail",
     "plate",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><strong>Standard Issue.</strong> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Heavy</li>\n  <li><strong>Defense:</strong> Guard +2, Resolve +1</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Wall of My People (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Wall of My People</strong>: it appears among your Manifestations as “Wall of My People ⟡ Bulwark Hauberk of the Wall” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>Sustained zone (30-ft sphere): allies inside gain Guard +2 for the scene. Upkeep 1 Clarity per scene.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Heavy enough to remind you you're standing somewhere on purpose.",
       "origin": "crafted",
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
       "lore": "<p>A long mail hauberk over a padded coat, with riveted plate at the chest and shoulders. The standard heavy issue for Bulwarks who haven't earned signature plate yet. Weight you have to carry. Weight that carries back.</p><p><b>Standard Issue.</b> Path-defining silhouette without path-defining cost. Frame Dice and Ruin Charges still come from your Bulwark features — the hauberk is just the surface they sit on.</p>",
       "materialOf": [
        {
         "key": "mail",
         "qty": 1
        },
        {
         "key": "rivet-plate",
         "qty": 1
        },
        {
         "key": "padded-coat",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 450,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor × tech 2.0 (bound Working: Wall of My People TI) × attuned",
        "bound": "attuned",
        "saleBack": 180
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Wall of My People",
       "img": "icons/equipment/shield/heater-steel-worn.webp",
       "system": {
        "intent": "presence",
        "channel": "soul",
        "sephirah": "chesed",
        "mode": "hermetic",
        "clarityRequired": 0,
        "noiseGain": 0,
        "activation": "action",
        "target": "area",
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
        "effect": "Sustained zone (30-ft sphere): allies inside gain Guard +2 for the scene. Upkeep 1 Clarity per scene.",
        "tags": [
         "starter-kit",
         "ward",
         "aoe",
         "path:bulwark",
         "path-core",
         "field",
         "protect",
         "sustained",
         "zone"
        ],
        "category": "manifestation",
        "flavor": "It's not a metaphor. It's masonry with a mailing list.",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "The names of everyone you're protecting settle over the ground like poured foundation. Allies inside stand behind all of them at once.",
         "form": "field",
         "function": "protect",
         "stability": "sustained",
         "interactionModel": "zone",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "scene",
         "durationText": "",
         "triggerText": "",
         "scale": "scene",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 0,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Bulwark",
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
          "shape": "sphere",
          "size": 30
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
         "maintenanceKey": "1-clarity-scene",
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
            "stat": "guard",
            "op": "+",
            "value": 2
           }
          ],
          "resists": [],
          "immunes": []
         }
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Patrolman's Plate of the Good Dream",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/GOTTGAIT%20Token/patrolpersons_plate.png",
   "system": {
    "guardBonus": 2,
    "evasionBonus": 0,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "plating",
    "equipped": false,
    "tags": [
     "t1-baseline",
     "medium",
     "plate",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><strong>Standard Issue.</strong> No signature, no harmonization, no questions asked at the gate.</p>\n<!-- BBTTCC:MECHANICS:START -->\n<hr/>\n<p><strong>⚙️ Mechanical Effects</strong></p>\n<ul>\n  <li><strong>Armor:</strong> Medium</li>\n  <li><strong>Defense:</strong> Guard +2</li>\n  <li><strong>Requires:</strong> Plating (trained)</li>\n  <li><strong>Tier:</strong> I</li>\n  <li><strong>Cost:</strong> 75 Nonlethal marks</li>\n</ul>\n<!-- BBTTCC:MECHANICS:END -->\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — The Good Dream (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>The Good Dream</strong>: it appears among your Manifestations as “The Good Dream ⟡ Patrolman's Plate of the Good Dream” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>One ally within 30 ft: shake off fear (GM clears Shaken/Charmed from a dream-adjacent source) and gain +2 Resolve for the scene.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "signature": "Issued, dented, returned, reissued. Honest metal.",
       "origin": "crafted",
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
       "lore": "<p>A studded breastplate over a gambeson, with shoulder pauldrons that fit at least three different body types badly. Worn by faction patrols, hex constables, and anyone who needs to look like they have authority without carrying signature gear. Cheap, repairable, and forgivingly average.</p><p><b>Standard Issue.</b> No signature, no harmonization, no questions asked at the gate.</p>",
       "materialOf": [
        {
         "key": "scrap-steel",
         "qty": 1
        },
        {
         "key": "gambeson",
         "qty": 1
        },
        {
         "key": "leather-strap",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 450,
        "currency": "nonlethal",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII armor × tech 2.0 (bound Working: The Good Dream TI) × attuned",
        "bound": "attuned",
        "saleBack": 180
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "The Good Dream",
       "img": "icons/magic/control/sleep-bubble-purple.webp",
       "system": {
        "intent": "presence",
        "channel": "soul",
        "sephirah": "chesed",
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
        "effect": "One ally within 30 ft: shake off fear (GM clears Shaken/Charmed from a dream-adjacent source) and gain +2 Resolve for the scene.",
        "tags": [
         "starter-kit",
         "dreamwalker",
         "quiet-sun",
         "support",
         "new",
         "path:dreamwalker",
         "doctrine-signature",
         "rite",
         "heal",
         "instant",
         "mark"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Thirty seconds of the dream where it all worked out. Non-refundable. Extremely effective.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "You slip an ally thirty seconds of the good one — the flying one, the one where the dog is still alive — and they come back steadier.",
         "form": "rite",
         "function": "heal",
         "stability": "instant",
         "interactionModel": "mark",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Dreamwalker — dreamwalker quiet sun",
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Boots of the Doorframe Discount",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/Items%20and%20Gear/techno_boots.png",
   "system": {
    "guardBonus": 0,
    "evasionBonus": 1,
    "resolveBonus": 0,
    "resistances": [],
    "armorSkill": "fitting",
    "equipped": false,
    "tags": [
     "mal-voiced",
     "footwear",
     "salvaged",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>Salvaged from two different abandoned trucks at two different crossroads. The left boot was loved very much. The right boot was loved less, but more recently. Together they make a pair that walks faster than either of them used to. The previous owners are not asking for them back.</p><p><strong>Mismatched Stride.</strong> +1 zone to your standard Move action. Stealth checks reroll the lowest die because nobody expects a person walking this fast to be sneaky. (Mal: \"It's psychological. They're so confused they don't notice you.\")</p>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Doorframe Discount (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Doorframe Discount</strong>: it appears among your Manifestations as “Doorframe Discount ⟡ Boots of the Doorframe Discount” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>Step through any doorway, arch, or gap and emerge from another within 30 ft. The disorientation you leave behind grants you +1 Evasion for the scene.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "footwear",
       "signature": "Left boot from one couple. Right boot from another. They get along well enough.",
       "origin": "crafted",
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
       "lore": "<p>Salvaged from two different abandoned trucks at two different crossroads. The left boot was loved very much. The right boot was loved less, but more recently. Together they make a pair that walks faster than either of them used to. The previous owners are not asking for them back.</p><p><b>Mismatched Stride.</b> +1 zone to your standard Move action. Stealth checks reroll the lowest die because nobody expects a person walking this fast to be sneaky. (Mal: \"It's psychological. They're so confused they don't notice you.\")</p>",
       "materialOf": [
        {
         "key": "road-leather",
         "qty": 1
        },
        {
         "key": "two-different-stories",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "price": {
        "marks": 300,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII footwear × tech 2.0 (bound Working: Doorframe Discount TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Doorframe Discount",
       "img": "icons/magic/control/sleep-bubble-purple.webp",
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
        "effect": "Step through any doorway, arch, or gap and emerge from another within 30 ft. The disorientation you leave behind grants you +1 Evasion for the scene.",
        "tags": [
         "starter-kit",
         "dreamwalker",
         "sapphire-gate",
         "mobility",
         "new",
         "path:dreamwalker",
         "doctrine-signature",
         "gate",
         "move",
         "instant",
         "event"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Doors are a franchise. She has the loyalty card.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "All doorways are the same doorway if you fell asleep in enough of them. Step into any opening; step out of another one nearby.",
         "form": "gate",
         "function": "move",
         "stability": "instant",
         "interactionModel": "event",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "instant",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 30,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Dreamwalker — dreamwalker sapphire gate",
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
            "value": 1
           }
          ],
          "resists": [],
          "immunes": []
         }
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 },
 {
  "folder": "Bound Workings",
  "v": {
   "name": "Scarf of the Latchkey Lullaby",
   "type": "armor",
   "img": "art/bbttcc/GOTTGAIT/Items%20and%20Gear/cat_scarf2.png",
   "system": {
    "guardBonus": 0,
    "evasionBonus": 0,
    "resolveBonus": 2,
    "resistances": [
     "psychic"
    ],
    "armorSkill": "bracing",
    "equipped": false,
    "tags": [
     "mal-voiced",
     "vestment",
     "companion",
     "bound-working"
    ],
    "category": "armor",
    "source": "",
    "description": {
     "value": "<p>An unreasonably long woolen scarf, two-tone gray, that occasionally shifts position on its own. Sometimes it tightens against the neck on a cold night. Sometimes it falls off your shoulder for no reason. Sometimes, very quietly, when you are alone in a room, it purrs. The previous owner left it to you. The previous owner was very specific that this was a kindness.</p><p><strong>Companion-Texture.</strong> +1 to Resolve while worn. Once per scene, when you would gain a Stress, you may pet the scarf instead. The Stress is averted. The scarf purrs faintly for a few seconds. Allies notice. Allies do not comment.</p>\n<!-- BBTTCC:LADDER:START -->\n<hr/>\n<p><strong>⟡ Bound Working — Latchkey Lullaby (TI).</strong></p>\n<ul>\n  <li>Carries the Working <strong>Latchkey Lullaby</strong>: it appears among your Manifestations as “Latchkey Lullaby ⟡ Scarf of the Latchkey Lullaby” and casts from the item, <strong>no Clarity</strong> — Noise and misfire still apply.</li>\n  <li><strong>3 charges</strong>; one is spent per cast attempt; all recover on a Soma Break.</li>\n  <li><em>Bound tool: once per scene, open one mundane lock, latch, or seal by singing it three descending notes. Wards, alarms, and anything actively watched are beyond it.</em></li>\n  <li>Tier II · attuned (one slot) · technomagical (Witness-forge binding).</li>\n</ul>\n<!-- BBTTCC:LADDER:END -->",
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
       "frame": "vestment",
       "signature": "Long. Soft. Occasionally purrs. The previous owner swears it was a cat. You believe them.",
       "origin": "crafted",
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
       "lore": "<p>An unreasonably long woolen scarf, two-tone gray, that occasionally shifts position on its own. Sometimes it tightens against the neck on a cold night. Sometimes it falls off your shoulder for no reason. Sometimes, very quietly, when you are alone in a room, it purrs. The previous owner left it to you. The previous owner was very specific that this was a kindness.</p><p><b>Companion-Texture.</b> +1 to Resolve while worn. Once per scene, when you would gain a Stress, you may pet the scarf instead. The Stress is averted. The scarf purrs faintly for a few seconds. Allies notice. Allies do not comment.</p>",
       "materialOf": [
        {
         "key": "wool",
         "qty": 1
        },
        {
         "key": "memory",
         "qty": 1
        },
        {
         "key": "small-affection",
         "qty": 1
        },
        {
         "key": "prayer-binding",
         "qty": 1
        },
        {
         "key": "anchor-quartz",
         "qty": 1
        },
        {
         "key": "focused-crystal",
         "qty": 1
        }
       ],
       "grants": {
        "resistances": [
         "psychic"
        ]
       },
       "price": {
        "marks": 300,
        "currency": "economy",
        "gmOverride": false,
        "altCurrencies": {},
        "split": null,
        "rarityMult": 1,
        "notes": "TII vestment × tech 2.0 (bound Working: Latchkey Lullaby TI) × attuned",
        "bound": "attuned",
        "saleBack": 120
       },
       "tech": {
        "kind": "charged",
        "charges": {
         "value": 3,
         "max": 3,
         "recoverPer": "soma-break"
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
       }
      }
     },
     "working": {
      "power": {
       "name": "Latchkey Lullaby",
       "img": "icons/magic/control/sleep-bubble-purple.webp",
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
        "effect": "Bound tool: once per scene, open one mundane lock, latch, or seal by singing it three descending notes. Wards, alarms, and anything actively watched are beyond it.",
        "tags": [
         "starter-kit",
         "dreamwalker",
         "sapphire-gate",
         "utility",
         "bound",
         "new",
         "path:dreamwalker",
         "doctrine-signature",
         "tool",
         "move"
        ],
        "category": "manifestation",
        "flavor": "Mal: 'Every lock dreams of being a door. This key is deeply unethical about that.'",
        "manifestation": {
         "tier": 1,
         "family": "working",
         "concept": "A small blue key that exists because you dreamed you owned it. It opens any lock that is, at that moment, asleep — and most locks are always asleep.",
         "form": "tool",
         "function": "move",
         "stability": "bound",
         "interactionModel": "tool",
         "costType": "none",
         "costValue": 0,
         "costText": "",
         "duration": "persistent",
         "durationText": "",
         "triggerText": "",
         "scale": "personal",
         "targetText": "",
         "rangeAreaText": "",
         "rangeFt": 0,
         "maintenanceCost": "",
         "riskText": "",
         "pathResonance": "Dreamwalker — dreamwalker sapphire gate",
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
        }
       }
      },
      "charges": {
       "value": 3,
       "max": 3,
       "recoverPer": "soma-break"
      },
      "tier": 1
     }
    }
   }
  }
 }
];
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  if (!game.fourththing?.ladder?.GRADES) return ui.notifications.error("item-ladder engine not loaded — deploy system 0.6.6, restart, hard-reload.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(`No pack ${PACK_ID}`);
  const index = await pack.getIndex(); const have = new Set(index.map(i => i.name));
  const log = []; let created = 0, skipped = 0;
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    const folderId = async (name) => { let f = pack.folders.find(x => x.name === name); if (!f && !DRY_RUN) f = await Folder.create({ name, type: "Item" }, { pack: pack.collection }); return f?.id ?? null; };
    const byFolder = {}; for (const row of ITEMS) (byFolder[row.folder] ??= []).push(row.v);
    for (const [folder, docs] of Object.entries(byFolder)) {
      const fid = await folderId(folder);
      const fresh = docs.filter(d => { if (have.has(d.name)) { log.push(`· skip ${d.name} — already in the pack`); skipped++; return false; } return true; });
      for (const d of fresh) log.push(`${DRY_RUN ? "·" : "✔"} [${folder}] ${d.name}  T${d.flags.fourththing.rfi.item.tier} ${d.flags.fourththing.rfi.item.bound} ${d.flags.fourththing.rfi.item.price.marks} marks`);
      if (!DRY_RUN && fresh.length) { await Item.createDocuments(fresh.map(d => ({ ...d, folder: fid })), { pack: pack.collection }); created += fresh.length; }
      else created += fresh.length;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(`[seed-item-ladder] ${DRY_RUN ? "DRY RUN" : "CREATED"} — ${created} item(s), ${skipped} skipped\n` + log.join("\n"));
  ui.notifications.info(`seed-item-ladder ${DRY_RUN ? "dry run" : "created"}: ${created} items, ${skipped} skipped — see console (F12).`);
})();
