/* tune-bestiary-2026-10-07.macro.js — BESTIARY TUNING PASS (GENERATED 2026-10-08 by build-bestiary-tuning.mjs — do not hand-edit; rebuild from a fresh dump).
 * Paste into a GM macro on EMBER and run. DRY_RUN = true prints the whole plan and writes nothing; flip to false to write.
 * What: 23 monsters · 28 faculty change(s) · 15 weapon dice change(s), found by bin/ft-tune-bestiary against
 *       bin/ft-sim-encounter --chassis system (targets ruled 2026-10-06: 3 lights / 1 medium = fair vs one Steward, heavy = duo, boss = party).
 * Where: the PACK actor (by id) and then every WORLD actor of the same name carrying the lineage flag. Every field is guarded by
 *        its expected old value — a changed field is skipped and logged as drift, never overwritten.
 */
const DRY_RUN = true;
const PACK_ID = "bbttcc-master-content.npcs";
const PLAN = [
 {
  "id": "GZeM7IAl471weU8b",
  "name": "Ash Wolf",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 2
  },
  "expect": {
   "system.attributes.violence.value": 3
  },
  "items": [],
  "why": [
   "violence 3→2"
  ],
  "verdict": "OK"
 },
 {
  "id": "juFbGL3HEuoWcuHV",
  "name": "Bog-Skitter Swarm",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 1,
   "system.attributes.presence.value": 1
  },
  "expect": {
   "system.attributes.violence.value": 3,
   "system.attributes.presence.value": 2
  },
  "items": [],
  "why": [
   "violence 3→1",
   "presence 2→1"
  ],
  "verdict": "OK"
 },
 {
  "id": "tXgo1gl88cgf1hcc",
  "name": "Hex-Touched Stray",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 2
  },
  "expect": {
   "system.attributes.violence.value": 3
  },
  "items": [
   {
    "id": "ef9tfqjntgjrmloy",
    "name": "Howl-of-the-Hex (recharges on a Soma Break)",
    "set": {
     "system.damage.formula": "1d4"
    },
    "expect": {
     "system.damage.formula": "1d6"
    },
    "why": "Howl-of-the-Hex (recharges on a Soma Break) 1d6→1d4"
   },
   {
    "id": "vZTtrBbZiNKzjBmv",
    "name": "Yellowing Bite",
    "set": {
     "system.damage.formula": "1d4"
    },
    "expect": {
     "system.damage.formula": "1d6"
    },
    "why": "Yellowing Bite 1d6→1d4"
   }
  ],
  "why": [
   "violence 3→2"
  ],
  "verdict": "OK"
 },
 {
  "id": "tYObKsKdkK5JHB0i",
  "name": "Jackalope Tinker-Scout",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.intrigue.value": 2,
   "system.attributes.body.value": 1
  },
  "expect": {
   "system.attributes.intrigue.value": 4,
   "system.attributes.body.value": 2
  },
  "items": [
   {
    "id": "hKFvNefe18tWHmPE",
    "name": "Bolt-Spitter Carbine",
    "set": {
     "system.damage.formula": "1d6"
    },
    "expect": {
     "system.damage.formula": "1d8"
    },
    "why": "Bolt-Spitter Carbine 1d8→1d6"
   }
  ],
  "why": [
   "intrigue 4→2",
   "body 2→1"
  ],
  "verdict": "OK"
 },
 {
  "id": "jo8jbDD5O01VQcxG",
  "name": "Pre-Fall Drone",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 1
  },
  "expect": {
   "system.attributes.violence.value": 2
  },
  "items": [],
  "why": [
   "violence 2→1"
  ],
  "verdict": "OK"
 },
 {
  "id": "5QNrUdqGtIcr1f5Z",
  "name": "Road Bandit",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 1
  },
  "expect": {
   "system.attributes.violence.value": 3
  },
  "items": [
   {
    "id": "IknBNvAVYXRCelYc",
    "name": "Pipe Rifle",
    "set": {
     "system.damage.formula": "1d6"
    },
    "expect": {
     "system.damage.formula": "1d8"
    },
    "why": "Pipe Rifle 1d8→1d6"
   }
  ],
  "why": [
   "violence 3→1"
  ],
  "verdict": "OK"
 },
 {
  "id": "d6E2m6vnxKrKOzBS",
  "name": "Scavenger Beast",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 2
  },
  "expect": {
   "system.attributes.violence.value": 4
  },
  "items": [],
  "why": [
   "violence 4→2"
  ],
  "verdict": "OK"
 },
 {
  "id": "QT2xnNzPOYRA0Wz4",
  "name": "Thaumielite Despot",
  "folder": "Qliphothic Bestiary",
  "tier": "I",
  "bracket": "medium",
  "set": {
   "system.attributes.violence.value": 3
  },
  "expect": {
   "system.attributes.violence.value": 2
  },
  "items": [],
  "why": [
   "violence 2→3"
  ],
  "verdict": "OK"
 },
 {
  "id": "DCFDuwrSVxC3xIDZ",
  "name": "Yesodium Tick-Hound",
  "folder": "Bad Eden Monsters",
  "tier": "I",
  "bracket": "medium",
  "set": {
   "system.attributes.body.value": 2
  },
  "expect": {
   "system.attributes.body.value": 3
  },
  "items": [],
  "why": [
   "body 3→2"
  ],
  "verdict": "OK"
 },
 {
  "id": "OhNxMsImWa4bBZYA",
  "name": "Witness Initiate",
  "folder": "Bad Eden Monsters",
  "tier": "II",
  "bracket": "light",
  "set": {
   "system.attributes.violence.value": 1
  },
  "expect": {
   "system.attributes.violence.value": 3
  },
  "items": [],
  "why": [
   "violence 3→1"
  ],
  "verdict": "OK"
 },
 {
  "id": "NZwUSJxiR3jQWWP5",
  "name": "S'narchy Burger Mascot (Reanimated)",
  "folder": "Bad Eden Monsters",
  "tier": "II",
  "bracket": "medium",
  "set": {
   "system.attributes.presence.value": 3,
   "system.attributes.body.value": 4
  },
  "expect": {
   "system.attributes.presence.value": 4,
   "system.attributes.body.value": 5
  },
  "items": [
   {
    "id": "M1sRZZgRKwRJgMg9",
    "name": "Aggressive Up-Sell",
    "set": {
     "system.damage.formula": "1d4"
    },
    "expect": {
     "system.damage.formula": "1d8"
    },
    "why": "Aggressive Up-Sell 1d8→1d4"
   },
   {
    "id": "nDEiJ8UOrST2D8tA",
    "name": "Combo-Meal Slam",
    "set": {
     "system.damage.formula": "1d10"
    },
    "expect": {
     "system.damage.formula": "2d6"
    },
    "why": "Combo-Meal Slam 2d6→1d10"
   }
  ],
  "why": [
   "presence 4→3",
   "body 5→4"
  ],
  "verdict": "OK"
 },
 {
  "id": "VWK3Fg8ozMPRipmD",
  "name": "Thagirion Disputant",
  "folder": "Qliphothic Bestiary",
  "tier": "II",
  "bracket": "medium",
  "set": {
   "system.attributes.body.value": 3
  },
  "expect": {
   "system.attributes.body.value": 4
  },
  "items": [
   {
    "id": "TSg0Wp4Tc3eI1CGQ",
    "name": "Inciting Word",
    "set": {
     "system.damage.formula": "2d6"
    },
    "expect": {
     "system.damage.formula": "2d8"
    },
    "why": "Inciting Word 2d8→2d6"
   }
  ],
  "why": [
   "body 4→3"
  ],
  "verdict": "OK"
 },
 {
  "id": "ipexaGZlhurZKpc3",
  "name": "Please-Stop-Hitting-Yourself (Qliphothic Loop)",
  "folder": "Bad Eden Monsters",
  "tier": "III",
  "bracket": "light",
  "set": {
   "system.attributes.body.value": 1
  },
  "expect": {
   "system.attributes.body.value": 2
  },
  "items": [
   {
    "id": "8k1Bpp0KyqhavyAj",
    "name": "Recursion Ache",
    "set": {
     "system.damage.formula": "1d12"
    },
    "expect": {
     "system.damage.formula": "2d6"
    },
    "why": "Recursion Ache 2d6→1d12"
   },
   {
    "id": "c4VSQ6rhQy2mXkNN",
    "name": "Reflect The Blow",
    "set": {
     "system.damage.formula": "2d6"
    },
    "expect": {
     "system.damage.formula": "2d8"
    },
    "why": "Reflect The Blow 2d8→2d6"
   }
  ],
  "why": [
   "body 2→1"
  ],
  "verdict": "OK"
 },
 {
  "id": "lAn4USFvKWoAVVwy",
  "name": "Soma-Reaper",
  "folder": "Bad Eden Monsters",
  "tier": "III",
  "bracket": "medium",
  "set": {
   "system.attributes.body.value": 3,
   "system.attributes.violence.value": 3
  },
  "expect": {
   "system.attributes.body.value": 4,
   "system.attributes.violence.value": 4
  },
  "items": [
   {
    "id": "8YPlYjNTBg5RE28x",
    "name": "Dreamcut",
    "set": {
     "system.damage.formula": "2d6"
    },
    "expect": {
     "system.damage.formula": "2d8"
    },
    "why": "Dreamcut 2d8→2d6"
   },
   {
    "id": "gMbhnuYsqpyBIRSG",
    "name": "Echo-Pluck",
    "set": {
     "system.damage.formula": "2d6"
    },
    "expect": {
     "system.damage.formula": "2d8"
    },
    "why": "Echo-Pluck 2d8→2d6"
   },
   {
    "id": "vV2mcWIDEMnk7QlK",
    "name": "Soma-Drain Field (recharges on a Soma Break)",
    "set": {
     "system.damage.formula": "2d6"
    },
    "expect": {
     "system.damage.formula": "2d8"
    },
    "why": "Soma-Drain Field (recharges on a Soma Break) 2d8→2d6"
   }
  ],
  "why": [
   "body 4→3",
   "violence 4→3"
  ],
  "verdict": "OK"
 },
 {
  "id": "hIOAU3bYR4KkdPhw",
  "name": "Whispering Deceiver",
  "folder": "Qliphothic Bestiary",
  "tier": "III",
  "bracket": "medium",
  "set": {
   "system.attributes.violence.value": 2
  },
  "expect": {
   "system.attributes.violence.value": 1
  },
  "items": [],
  "why": [
   "violence 1→2"
  ],
  "verdict": "OK"
 },
 {
  "id": "LQS2jaeFhzFMDpxA",
  "name": "Gilbert, Attendant Eternal",
  "folder": "Bad Eden Monsters",
  "tier": "III",
  "bracket": "heavy",
  "set": {
   "system.attributes.body.value": 4
  },
  "expect": {
   "system.attributes.body.value": 6
  },
  "items": [],
  "why": [
   "body 6→4"
  ],
  "verdict": "OK"
 },
 {
  "id": "nAl4cJIYsqzvJtOd",
  "name": "Pre-Fall Battlemind",
  "folder": "Bad Eden Monsters",
  "tier": "III",
  "bracket": "heavy",
  "set": {
   "system.attributes.body.value": 5
  },
  "expect": {
   "system.attributes.body.value": 6
  },
  "items": [],
  "why": [
   "body 6→5"
  ],
  "verdict": "OK"
 },
 {
  "id": "CdNx8WLo0aZO6q8c",
  "name": "Slippage Wraith",
  "folder": "Bad Eden Monsters",
  "tier": "III",
  "bracket": "heavy",
  "set": {
   "system.attributes.body.value": 3,
   "system.attributes.intrigue.value": 5
  },
  "expect": {
   "system.attributes.body.value": 4,
   "system.attributes.intrigue.value": 6
  },
  "items": [],
  "why": [
   "body 4→3",
   "intrigue 6→5"
  ],
  "verdict": "OK"
 },
 {
  "id": "P8e2EX1lbLBFk2gL",
  "name": "Abomination of Excess",
  "folder": "Qliphothic Bestiary",
  "tier": "IV",
  "bracket": "heavy",
  "set": {
   "system.attributes.violence.value": 7
  },
  "expect": {
   "system.attributes.violence.value": 6
  },
  "items": [],
  "why": [
   "violence 6→7"
  ],
  "verdict": "soft"
 },
 {
  "id": "mUM4tXeqeUagkLRJ",
  "name": "Hex-Warlord's Honored Guard",
  "folder": "Bad Eden Monsters",
  "tier": "IV",
  "bracket": "heavy",
  "set": {},
  "expect": {},
  "items": [
   {
    "id": "3GwtnUotnVE5MVx3",
    "name": "Sworn Intercept",
    "set": {
     "system.damage.formula": "3d10"
    },
    "expect": {
     "system.damage.formula": "2d12"
    },
    "why": "Sworn Intercept 2d12→3d10"
   },
   {
    "id": "8KO0jBULI7awWQSK",
    "name": "Warlord's Blade",
    "set": {
     "system.damage.formula": "3d10"
    },
    "expect": {
     "system.damage.formula": "2d12"
    },
    "why": "Warlord's Blade 2d12→3d10"
   },
   {
    "id": "YNwVCgkGjqBsH6YG",
    "name": "Wall-of-Honor (recharges on a Soma Break)",
    "set": {
     "system.damage.formula": "3d10"
    },
    "expect": {
     "system.damage.formula": "2d12"
    },
    "why": "Wall-of-Honor (recharges on a Soma Break) 2d12→3d10"
   }
  ],
  "why": [],
  "verdict": "soft"
 },
 {
  "id": "IU1ykPyFaiFNFDRW",
  "name": "Archon of the Twin Crown",
  "folder": "Qliphothic Bestiary",
  "tier": "IV",
  "bracket": "boss",
  "set": {
   "system.attributes.body.value": 5
  },
  "expect": {
   "system.attributes.body.value": 6
  },
  "items": [],
  "why": [
   "body 6→5"
  ],
  "verdict": "OK"
 },
 {
  "id": "knO0GK8qKCeyNC6N",
  "name": "The Ashen Horde",
  "folder": "Qliphothic Bestiary",
  "tier": "IV",
  "bracket": "boss",
  "set": {
   "system.attributes.body.value": 8,
   "system.attributes.violence.value": 5
  },
  "expect": {
   "system.attributes.body.value": 5,
   "system.attributes.violence.value": 4
  },
  "items": [],
  "why": [
   "body 5→8",
   "violence 4→5"
  ],
  "verdict": "OK"
 },
 {
  "id": "Tw8Qy7Bg0pwKC29k",
  "name": "The Lewd Miasma",
  "folder": "Qliphothic Bestiary",
  "tier": "IV",
  "bracket": "boss",
  "set": {
   "system.attributes.violence.value": 2
  },
  "expect": {
   "system.attributes.violence.value": 1
  },
  "items": [],
  "why": [
   "violence 1→2"
  ],
  "verdict": "OK"
 }
];
(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID); if (!pack) return ui.notifications.error(`No pack ${PACK_ID}`);
  const get = (doc, k) => foundry.utils.getProperty(doc, k);
  const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const log = []; let wrote = 0, worldWrote = 0, skipped = 0;
  const apply = async (a, p, where) => {
    const upd = {}; for (const [k, v] of Object.entries(p.set)) { if (eq(get(a, k), p.expect[k])) upd[k] = v; else { log.push(`✗ drift ${where} ${p.name} ${k} = ${JSON.stringify(get(a, k))} (expected ${JSON.stringify(p.expect[k])})`); skipped++; } }
    const iu = [];
    for (const it of p.items) {
      const doc = where === "[pack]" ? a.items.get(it.id) : a.items.find(d => d.type === "weapon" && d.name === it.name);
      if (!doc) { log.push(`✗ drift ${where} ${p.name} › ${it.name} gone`); skipped++; continue; }
      const u = { _id: doc.id }; for (const [k, v] of Object.entries(it.set)) { if (eq(get(doc, k), it.expect[k])) u[k] = v; else { log.push(`✗ drift ${where} ${p.name} › ${it.name} ${k} = ${JSON.stringify(get(doc, k))}`); skipped++; } }
      if (Object.keys(u).length > 1) iu.push(u);
    }
    if (!Object.keys(upd).length && !iu.length) return false;
    log.push(`${DRY_RUN ? "·" : "✔"} ${where} ${p.folder ? p.folder + " › " : ""}${p.name} [T${p.tier} ${p.bracket}] ${p.why.join(", ")}${iu.length ? " · " + p.items.filter(i => iu.some(u => u._id === (where === "[pack]" ? i.id : a.items.find(d => d.name === i.name)?.id))).map(i => i.why).join(", ") : ""}`);
    if (!DRY_RUN) { if (Object.keys(upd).length) await a.update(upd); if (iu.length) await a.updateEmbeddedDocuments("Item", iu); }
    return true;
  };
  const wasLocked = pack.locked;
  try {
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    for (const p of PLAN) {
      const a = await pack.getDocument(p.id);
      if (!a || a.name !== p.name) { log.push(`✗ SKIP ${p.name} — not found / renamed in the pack`); skipped++; continue; }
      if (await apply(a, p, "[pack]")) wrote++;
      for (const w of game.actors.filter(x => x.name === p.name && x.flags?.fourththing?.rfi?.actor?.lineage)) if (await apply(w, p, "[world]")) worldWrote++;
    }
  } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  console.log(`[tune-bestiary] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${wrote} pack actor(s), ${worldWrote} world actor(s), ${skipped} skip/drift\n` + log.join("\n"));
  ui.notifications.info(`tune-bestiary ${DRY_RUN ? "dry run" : "applied"}: ${wrote} pack / ${worldWrote} world actors, ${skipped} skipped — see console (F12).`);
})();
