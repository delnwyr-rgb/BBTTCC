// Bad Eden — STORY MODEL (Phase 1 of the Director rebuild, 2026-09-13)
// ─────────────────────────────────────────────────────────────────────────────
// One derivation of "where the story stands", read by the Visualizer's NOW card (and, next, the
// Director's slate). Vocabulary, per the owner's ruling: QUEST · CHAPTER · ENDING, nothing else.
//   quest    = a place-story (28 of them; the registry's 68 rows fold into them via QUEST_MAP)
//   chapter  = a former sub-quest inside it; open or done, and when done it has an ENDING
//   ending   = the beat that closed a chapter (today: the beat carrying the chapter's `complete` row)
// Phase 1 DERIVES everything from data that already exists: the beats' questEffects rows say which
// beats start and end what, the coalition quest buckets say what is active/completed, the fired
// ledgers say what has been played. Nothing here writes. Phase 2 makes beats declare
// {quest, chapter, ending} directly and retires the buckets + ledgers as writers.
//
// deriveSituation(ctx) → { act, turn, quests[], anchor, now, inPlay[], doors[] }
//   ctx.beats        campaign beats (authored order)
//   ctx.firedSet     Set<beatId> of beats that have been played
//   ctx.firedTs(id)  → number|0 (freshest fire) — optional
//   ctx.readyOf(id)  → { ready:boolean, reasons:[{met,text,current,kind,seal}] } | null
//   ctx.bucketOf(registryId) → "active"|"completed"|"archived"|null (coalition quest track)
//   ctx.invitedIds   Set<beatId> with an open invitation card — optional
//   ctx.phase, ctx.turn, ctx.anchorId, ctx.seqOf(beat) → number, ctx.questNames{registryId→name}

export const QUEST_MAP = {
 "quests": {
  "offices": {
   "name": "Offices of Fates and Destinies",
   "act": 0,
   "keystone": false,
   "hex": "Allesh-Gilliam",
   "registryId": "quest_ycEa0uXzTzsbK4qP",
   "chapters": {
    "opening": {
     "name": "Opening",
     "registryId": "quest_thatwards_opening"
    }
   }
  },
  "allesh_gilliam": {
   "name": "Allesh-Gilliam",
   "act": 2,
   "keystone": false,
   "hex": "Allesh-Gilliam",
   "registryId": "quest_Cq1v3hJpXarX5rXJ",
   "chapters": {
    "the_town_militia": {
     "name": "The Town Militia",
     "registryId": "quest_ag_town_militia"
    },
    "the_confessor_s_debt": {
     "name": "The Confessor's Debt",
     "registryId": "quest_ag_confessors_debt"
    }
   }
  },
  "lyrenn": {
   "name": "Lyrenn",
   "act": 2,
   "keystone": false,
   "hex": "Lyrenn",
   "registryId": "quest_JqCdOo0l6X8K2EcE",
   "chapters": {
    "the_gentle_pest": {
     "name": "The Gentle Pest",
     "registryId": "quest_uMKbX648SllKTpEH"
    },
    "the_field_that_remembers_you": {
     "name": "The Field That Remembers You",
     "registryId": "quest_0HBaQXGlhFvNke2B"
    },
    "the_forest_will_not_be_fought": {
     "name": "The Forest Will Not Be Fought",
     "registryId": "quest_feX6WHsBXuVbtjMM"
    },
    "the_red_thread": {
     "name": "The Red Thread",
     "registryId": "quest_lyrenn_red_thread"
    },
    "the_land_remembers": {
     "name": "The Land Remembers",
     "registryId": "quest_lyrenn_land_remembers"
    }
   }
  },
  "khezek_tor": {
   "name": "Khezek-Tor",
   "act": 2,
   "keystone": false,
   "hex": "Khezek-Tor",
   "registryId": "quest_LJAmlim7oUtlMPiC",
   "chapters": {
    "the_mine_that_answered_back": {
     "name": "The Mine that Answered Back",
     "registryId": "quest_A050y4VtoZFzOfGz"
    },
    "the_shipment_of_utter_darkness_sometimes": {
     "name": "The Shipment of UTTER DARKNESS Sometimes",
     "registryId": "quest_2Gs2dsKhv7G1OYBl"
    },
    "the_sink_watch": {
     "name": "The Sink Watch",
     "registryId": "quest_kt_sink_watch"
    },
    "the_compound_cough": {
     "name": "The Compound Cough",
     "registryId": "quest_kt_compound_cough"
    },
    "the_brace_strain": {
     "name": "The Brace Strain",
     "registryId": "quest_kt_brace_strain"
    }
   }
  },
  "valhaulan_seal": {
   "name": "The Valhaulan Seal",
   "act": 2,
   "keystone": true,
   "hex": "Khezek-Tor",
   "registryId": "quest_AL1aIXiljxPUBH2e",
   "chapters": {}
  },
  "fixit_farm": {
   "name": "Furrier's Fixit Farm",
   "act": 2,
   "keystone": false,
   "hex": "Furrier's Fixit-Farm",
   "registryId": "quest_nrkJabUwZOLAJFYn",
   "chapters": {
    "the_weeping_prisoner": {
     "name": "The Weeping Prisoner",
     "registryId": "quest_uDuNp2yQxbuKkHx7"
    },
    "the_leyline_stabilizer": {
     "name": "The Leyline Stabilizer",
     "registryId": "quest_bSwOIWzxqNBwJ5NM"
    }
   }
  },
  "circuit_riders": {
   "name": "Circuit Rider Parley",
   "act": 2,
   "keystone": false,
   "hex": "",
   "registryId": "quest_circuit_riders_parley",
   "chapters": {}
  },
  "tifaret": {
   "name": "The Forest of Early Tifaret",
   "act": 2,
   "keystone": false,
   "hex": "PolygonForest.d",
   "registryId": "quest_2pZmPy9TEzorMoaj",
   "chapters": {}
  },
  "forgotten_cause": {
   "name": "The Forgotten Cause",
   "act": 2,
   "keystone": false,
   "hex": "Furrier's Fixit-Farm",
   "registryId": "fc_wendigo_confluence",
   "chapters": {
    "the_long_table": {
     "name": "The Long Table",
     "registryId": "fc_long_table"
    },
    "close_the_ledger": {
     "name": "Close the Ledger",
     "registryId": "fc_cultural_summit"
    }
   }
  },
  "bandit_accord": {
   "name": "The Bandit Accord",
   "act": 2,
   "keystone": false,
   "hex": "",
   "registryId": "quest_bandit_accord",
   "chapters": {}
  },
  "cadence": {
   "name": "The Cadence",
   "act": 2,
   "keystone": false,
   "hex": "",
   "registryId": "quest_cadence",
   "chapters": {}
  },
  "chuckle_creek": {
   "name": "Chuckle Creek",
   "act": 2,
   "keystone": false,
   "hex": "Chuckle Creek",
   "registryId": "quest_chuckle_creek",
   "chapters": {}
  },
  "soft_landing": {
   "name": "Soft Landing",
   "act": 2,
   "keystone": false,
   "hex": "Soft Landing",
   "registryId": "quest_soft_landing",
   "chapters": {}
  },
  "stillwater": {
   "name": "Stillwater",
   "act": 2,
   "keystone": false,
   "hex": "Stillwater",
   "registryId": "quest_stillwater",
   "chapters": {}
  },
  "valhaulan_spine": {
   "name": "That One Night",
   "act": 2,
   "keystone": true,
   "hex": "",
   "registryId": "quest_valhaulan_spine",
   "chapters": {}
  },
  "sarmoung_hum": {
   "name": "The Sarmoung Hum",
   "act": 0,
   "keystone": false,
   "hex": "",
   "registryId": "quest_sarmoung_hum",
   "chapters": {}
  },
  "widening_trail": {
   "name": "The Widening Trail",
   "act": 3,
   "keystone": true,
   "hex": "",
   "registryId": "quest_x8T2VkPUjhvp2vDM",
   "chapters": {
    "the_rotating_chapel": {
     "name": "The Rotating Chapel",
     "registryId": "quest_pI4LaZTvh9QmuRaE"
    },
    "anchor_reach": {
     "name": "Anchor Reach",
     "registryId": "quest_OpvVkGwzBTM2Px13"
    },
    "the_singing_mire": {
     "name": "The Singing Mire",
     "registryId": "quest_ZTiNTjhJGtRz7iDu"
    },
    "port_kudzu": {
     "name": "Port Kudzu",
     "registryId": "quest_J4NXb6xZ9M15EesB"
    },
    "legansus_waystation": {
     "name": "Legansus Waystation",
     "registryId": "quest_xBw8cGSC88wX2UeT"
    }
   }
  },
  "hidden_vault": {
   "name": "The Hidden Vault",
   "act": 3,
   "keystone": false,
   "hex": "PolygonWood.a",
   "registryId": "quest_hidden_vault",
   "chapters": {}
  },
  "balcones": {
   "name": "The Balcones Faulting You Line",
   "act": 3,
   "keystone": false,
   "hex": "",
   "registryId": "quest_8II4GEGV7D3RgzPv",
   "chapters": {}
  },
  "flooded_towns": {
   "name": "The Hex Flooded Towns",
   "act": 3,
   "keystone": false,
   "hex": "",
   "registryId": "quest_dYfmXsGFyVseveWY",
   "chapters": {}
  },
  "lost_statues": {
   "name": "The Lost Stone Statues",
   "act": 3,
   "keystone": false,
   "hex": "",
   "registryId": "quest_jivVj3iGErW53Wxl",
   "chapters": {}
  },
  "fifteen_year_siege": {
   "name": "The Fifteen-Year Siege",
   "act": 3,
   "keystone": false,
   "hex": "",
   "registryId": "quest_fifteen_year_siege",
   "chapters": {}
  },
  "trojan_gift": {
   "name": "A Gift. (Not a Trojan.)",
   "act": 3,
   "keystone": false,
   "hex": "",
   "registryId": "quest_trojan_gift",
   "chapters": {
    "the_touring_gift": {
     "name": "The Touring Gift",
     "registryId": "quest_touring_gift"
    }
   }
  },
  "crown_mall": {
   "name": "The Crown Mall",
   "act": 4,
   "keystone": true,
   "hex": "Crown Mall",
   "registryId": "quest_7V8Shz2S0EtDaHSS",
   "chapters": {
    "the_mall_of_forgotten_yesterdays": {
     "name": "The Mall of Forgotten Yesterdays",
     "registryId": "quest_forgotten_yesterdays"
    }
   }
  },
  "maneuver_vault": {
   "name": "The Maneuver Vault",
   "act": 4,
   "keystone": true,
   "hex": "",
   "registryId": "quest_NwiADv8ZDoklqwEJ",
   "chapters": {}
  },
  "ninth_guest": {
   "name": "The Ninth Guest",
   "act": 4,
   "keystone": false,
   "hex": "Static Coast e",
   "registryId": "quest_ninth_guest",
   "chapters": {}
  },
  "finale": {
   "name": "Thatwards Ho! Finale",
   "act": 5,
   "keystone": true,
   "hex": "Allesh-Gilliam",
   "registryId": "quest_thatwards_ho_finale",
   "chapters": {}
  },
  "gloomgill": {
   "name": "Gloomgill",
   "act": 6,
   "keystone": false,
   "hex": "Odaroloc River.c",
   "registryId": "quest_5obLcPkexYRVZqlg",
   "chapters": {}
  }
 },
 "registry": {
  "quest_thatwards_opening": {
   "quest": "offices",
   "chapter": "opening"
  },
  "quest_ycEa0uXzTzsbK4qP": {
   "quest": "offices",
   "chapter": null
  },
  "quest_ag_town_militia": {
   "quest": "allesh_gilliam",
   "chapter": "the_town_militia"
  },
  "quest_ag_confessors_debt": {
   "quest": "allesh_gilliam",
   "chapter": "the_confessor_s_debt"
  },
  "quest_Cq1v3hJpXarX5rXJ": {
   "quest": "allesh_gilliam",
   "chapter": null
  },
  "quest_uMKbX648SllKTpEH": {
   "quest": "lyrenn",
   "chapter": "the_gentle_pest"
  },
  "quest_0HBaQXGlhFvNke2B": {
   "quest": "lyrenn",
   "chapter": "the_field_that_remembers_you"
  },
  "quest_feX6WHsBXuVbtjMM": {
   "quest": "lyrenn",
   "chapter": "the_forest_will_not_be_fought"
  },
  "quest_lyrenn_red_thread": {
   "quest": "lyrenn",
   "chapter": "the_red_thread"
  },
  "quest_lyrenn_land_remembers": {
   "quest": "lyrenn",
   "chapter": "the_land_remembers"
  },
  "quest_JqCdOo0l6X8K2EcE": {
   "quest": "lyrenn",
   "chapter": null
  },
  "quest_A050y4VtoZFzOfGz": {
   "quest": "khezek_tor",
   "chapter": "the_mine_that_answered_back"
  },
  "quest_2Gs2dsKhv7G1OYBl": {
   "quest": "khezek_tor",
   "chapter": "the_shipment_of_utter_darkness_sometimes"
  },
  "quest_kt_sink_watch": {
   "quest": "khezek_tor",
   "chapter": "the_sink_watch"
  },
  "quest_kt_compound_cough": {
   "quest": "khezek_tor",
   "chapter": "the_compound_cough"
  },
  "quest_kt_brace_strain": {
   "quest": "khezek_tor",
   "chapter": "the_brace_strain"
  },
  "quest_LJAmlim7oUtlMPiC": {
   "quest": "khezek_tor",
   "chapter": null
  },
  "quest_AL1aIXiljxPUBH2e": {
   "quest": "valhaulan_seal",
   "chapter": null
  },
  "quest_uDuNp2yQxbuKkHx7": {
   "quest": "fixit_farm",
   "chapter": "the_weeping_prisoner"
  },
  "quest_bSwOIWzxqNBwJ5NM": {
   "quest": "fixit_farm",
   "chapter": "the_leyline_stabilizer"
  },
  "quest_nrkJabUwZOLAJFYn": {
   "quest": "fixit_farm",
   "chapter": null
  },
  "quest_circuit_riders_parley": {
   "quest": "circuit_riders",
   "chapter": null
  },
  "quest_2pZmPy9TEzorMoaj": {
   "quest": "tifaret",
   "chapter": null
  },
  "fc_long_table": {
   "quest": "forgotten_cause",
   "chapter": "the_long_table"
  },
  "fc_cultural_summit": {
   "quest": "forgotten_cause",
   "chapter": "close_the_ledger"
  },
  "fc_wendigo_confluence": {
   "quest": "forgotten_cause",
   "chapter": null
  },
  "quest_bandit_accord": {
   "quest": "bandit_accord",
   "chapter": null
  },
  "quest_cadence": {
   "quest": "cadence",
   "chapter": null
  },
  "quest_chuckle_creek": {
   "quest": "chuckle_creek",
   "chapter": null
  },
  "quest_soft_landing": {
   "quest": "soft_landing",
   "chapter": null
  },
  "quest_stillwater": {
   "quest": "stillwater",
   "chapter": null
  },
  "quest_valhaulan_spine": {
   "quest": "valhaulan_spine",
   "chapter": null
  },
  "quest_pI4LaZTvh9QmuRaE": {
   "quest": "widening_trail",
   "chapter": "the_rotating_chapel"
  },
  "quest_OpvVkGwzBTM2Px13": {
   "quest": "widening_trail",
   "chapter": "anchor_reach"
  },
  "quest_ZTiNTjhJGtRz7iDu": {
   "quest": "widening_trail",
   "chapter": "the_singing_mire"
  },
  "quest_J4NXb6xZ9M15EesB": {
   "quest": "widening_trail",
   "chapter": "port_kudzu"
  },
  "quest_xBw8cGSC88wX2UeT": {
   "quest": "widening_trail",
   "chapter": "legansus_waystation"
  },
  "quest_x8T2VkPUjhvp2vDM": {
   "quest": "widening_trail",
   "chapter": null
  },
  "quest_hidden_vault": {
   "quest": "hidden_vault",
   "chapter": null
  },
  "quest_8II4GEGV7D3RgzPv": {
   "quest": "balcones",
   "chapter": null
  },
  "quest_dYfmXsGFyVseveWY": {
   "quest": "flooded_towns",
   "chapter": null
  },
  "quest_jivVj3iGErW53Wxl": {
   "quest": "lost_statues",
   "chapter": null
  },
  "quest_fifteen_year_siege": {
   "quest": "fifteen_year_siege",
   "chapter": null
  },
  "quest_touring_gift": {
   "quest": "trojan_gift",
   "chapter": "the_touring_gift"
  },
  "quest_trojan_gift": {
   "quest": "trojan_gift",
   "chapter": null
  },
  "quest_sarmoung_hum": {
   "quest": "sarmoung_hum",
   "chapter": null
  },
  "quest_forgotten_yesterdays": {
   "quest": "crown_mall",
   "chapter": "the_mall_of_forgotten_yesterdays"
  },
  "quest_7V8Shz2S0EtDaHSS": {
   "quest": "crown_mall",
   "chapter": null
  },
  "quest_NwiADv8ZDoklqwEJ": {
   "quest": "maneuver_vault",
   "chapter": null
  },
  "quest_ninth_guest": {
   "quest": "ninth_guest",
   "chapter": null
  },
  "quest_thatwards_ho_finale": {
   "quest": "finale",
   "chapter": null
  },
  "quest_5obLcPkexYRVZqlg": {
   "quest": "gloomgill",
   "chapter": null
  }
 },
 "wordTickets": [
  "word_khezek_tor_sable_welcome",
  "word_khezek_tor_drax_welcome",
  "word_lyrenn_rowan_welcome",
  "word_lyrenn_elsin_welcome",
  "word_allesh_gilliam_etta_welcome",
  "word_allesh_gilliam_yarrow_welcome",
  "word_allesh_gilliam_tamsin_welcome",
  "word_lyrenn_word_channels",
  "word_khezek_tor_sable_nine_convo",
  "word_khezek_tor_drax_calder_convo",
  "word_gullywasher_dougan_points_to_confluence",
  "word_lyrenn_rowan_of_the_loam_convo",
  "word_lyrenn_elsin_quade_convo",
  "word_allesh_gilliam_etta_bloom_conversation",
  "word_allesh_gilliam_father_tamsin_conversation",
  "word_allesh_gilliam_introduction_to_hq"
 ],
 "pool": "quest_travel_encounters"
};

const isAmbient = b => !!b?.pacing?.ambient || String(b?.timeScale) === "leg" || !!b?.targetHexUuid || /\bdiscovery\b/i.test(String(b?.tags || ""));

// ── WHERE (2026-09-15, owner ruling: "story-based location awareness") ──────────────────────────────
// hexKey: hex names carry NBSP, band suffixes ("Name.c" and "Name c"), and a claimed-mark decoration.
export const hexKey = (s) => String(s || "").replace(/[\s\u00a0]+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/\.(?=[a-z]$)/i, " ").trim().toLowerCase();
// placeOf: the hex a beat is played at — "anywhere" | a hex name | null (unknown; on-arrival beats are the
// injector's business). Letters reach you wherever you stand; rides start where you stand; act openers fire
// from the calendar; pool draws and ambient beats happen on the road. Everything else is at its quest's hex.
// `beat.where` (a hex name or "anywhere") overrides the rule by hand.
export function placeOf(beat, questDef) {
  if (!beat) return null;
  const w = String(beat.where || "").trim();
  if (w) return /^anywhere$/i.test(w) ? "anywhere" : w;
  if (beat.hexName) return String(beat.hexName);
  if (beat.targetHexUuid) return null;
  const id = String(beat.id || ""), label = String(beat.label || "");
  const qk = String(beat.story?.quest || "");
  if (isAmbient(beat) || (qk && qk === String(QUEST_MAP.pool))) return "anywhere";
  if (/(^|_)words?(_|$)/i.test(id) || /^word from\b/i.test(label)) return "anywhere";
  if (/(^|_)ride(_|$)/i.test(id) || /^the road\b/i.test(label)) return "anywhere";
  if (Number.isFinite(Number(beat.worldEffects?.phaseAdvance?.set))) return "anywhere";
  const q = questDef || (qk ? QUEST_MAP.quests[qk] : null);
  return q && q.hex ? String(q.hex) : "anywhere";
}
// The story's ANCHOR is the freshest played beat that can carry it: never a travel leg, a discovery or a
// leaf sighting — but an ambient beat that ROUTES onward (the Tent on rails) stands in the story and anchors.
export const isAnchorable = b => !!b && (!isAmbient(b) || (Array.isArray(b.choices) && b.choices.some(c => c && c.next)));
const norm = s => String(s || "").trim();

export function registryOf(registryId) {
  return QUEST_MAP.registry[norm(registryId)] || null;
}

export function deriveSituation(ctx) {
  const beats = Array.isArray(ctx.beats) ? ctx.beats : [];
  const fired = ctx.firedSet instanceof Set ? ctx.firedSet : new Set();
  const firedTs = typeof ctx.firedTs === "function" ? ctx.firedTs : () => 0;
  const readyOf = typeof ctx.readyOf === "function" ? ctx.readyOf : () => null;
  const bucketOf = typeof ctx.bucketOf === "function" ? ctx.bucketOf : () => null;
  const invited = ctx.invitedIds instanceof Set ? ctx.invitedIds : new Set();
  const seqOf = typeof ctx.seqOf === "function" ? ctx.seqOf : (b) => beats.indexOf(b);
  const phase = Number(ctx.phase) || 0, turn = Number(ctx.turn) || 0;
  const anchorId = ctx.anchorId ? String(ctx.anchorId) : null;
  const byId = new Map(beats.map(b => [String(b.id), b]));
  // where the party stands (a hex name) and which hex names exist — a place the map does not know is "unknown", never "not here"
  const where = ctx.where ? hexKey(ctx.where) : null;
  const known = ctx.knownHexes instanceof Set ? ctx.knownHexes : null;
  const hereOf = (beat, def) => { if (!where || !beat) return null; const p = placeOf(beat, def); if (!p || p === "anywhere") return null; const k = hexKey(p); if (known && !known.has(k)) return null; return k === where; };
  const stamp = (n, def) => { if (n && n.beat) { n.place = placeOf(n.beat, def); n.here = hereOf(n.beat, def); } return n; };
  // routes in (for orphan detection and hub finding)
  const routesIn = new Map();
  for (const b of beats) for (const c of (b?.choices || [])) for (const t of [c?.next, c?.failNext]) { const id = String(t || "").trim(); if (id) routesIn.set(id, (routesIn.get(id) || 0) + 1); }
  const openingId = String(ctx.openingBeatId || "").trim();
  const isHub = (b) => !!b && b.inject?.repeatable !== false && Array.isArray(b.choices) && b.choices.filter(c => c && c.next).length >= 3 && (routesIn.get(String(b.id)) || 0) >= 3;
  // a beat "leads somewhere" if it is unplayed, or it is a hub with an unplayed door behind it (one hop —
  // two hubs pointing at each other with nothing behind either do NOT lead anywhere, 2026-09-14)
  const leadsSomewhere = (b) => !!b && (!fired.has(String(b.id)) || (isHub(b) && (b.choices || []).some(c => { const t = byId.get(String(c?.next || "")); return t && !fired.has(String(t.id)); })));
  // (2026-09-14, evening) The "orphan" heuristic is GONE. Dead beats are a DATA fact, removed by
  // tools/scrub-orphan-beats; authored order (questStep) is the fallback the authors wrote, and linear
  // ladders with no routes between rungs (the Offices' Sayings) depend on it. The model guesses nothing.
  const isOrphan = () => false;

  // writers, from the beats themselves
  const starts = {}, endings = {};
  for (const b of beats) {
    // a POOL beat (travel encounter) may start or end a quest elsewhere, but it arrives by draw — it is never
    // a quest's door or its "next" (2026-09-14: the bandit ambush's free-them outcome was offered as AG's next)
    const dq = declOf(b); if (!dq || !dq.quest) continue;
    if (String(b?.questRole || "") === "start") (starts[norm(b.questId)] = starts[norm(b.questId)] || []).push(b);
    for (const e of (b?.worldEffects?.questEffects || [])) {
      if (!e || !e.questId) continue;
      if (e.action === "accept") (starts[norm(e.questId)] = starts[norm(e.questId)] || []).push(b);
      if (e.action === "complete") (endings[norm(e.questId)] = endings[norm(e.questId)] || []).push(b);
    }
  }
  const uniq = arr => [...new Set(arr || [])];
  const reqsOf = (b) => { const r = b?.inject?.requires; return Array.isArray(r) ? r.filter(Boolean) : (r && typeof r === "object" ? [r] : []); };
  const readiness = (b) => {
    const r = b ? readyOf(String(b.id)) : null;
    if (r && typeof r.ready === "boolean") return r;
    // unknown readiness: optimistic (ctx.optimistic — the slate's evaluation rounds) or "ready iff ungated"
    return { ready: ctx.optimistic ? true : reqsOf(b).length === 0, reasons: [], unknown: true };
  };
  const unmet = (b) => (readiness(b).reasons || []).filter(r => r && r.met === false);
  const questGatesOf = (b) => {
    return reqsOf(b).filter(r => r && r.questBucket != null).map(r => ({ registryId: String(r.questBucket), is: r.is != null ? String(r.is) : null, isNot: r.isNot != null ? String(r.isNot) : null }));
  };
  const pickNext = (list, routedFirst, allowAmbient = false) => {
    // a route authored FROM where the story stands is explicit intent — it counts even when the target is
    // ambient (the Tent on rails out of the First Night, 2026-09-14); the ambient filter applies to the pool only
    // routed from where the story stands: unplayed targets first, then any HUB the route leads back to (a
    // route to a repeatable hub is never consumed — "Call it a day → the Crossroads" is always open)
    const routed = (routedFirst || []).filter(Boolean);
    const cands = uniq([...routed.filter(b => !fired.has(String(b.id))), ...routed.filter(b => fired.has(String(b.id)) && isHub(b) && String(b.id) !== String(ctx.anchorId || "") && leadsSomewhere(b)), ...list.filter(b => (allowAmbient || !isAmbient(b)) && !fired.has(String(b.id)))].filter(Boolean));
    const ready = cands.find(b => readiness(b).ready);
    if (ready) return { beat: ready, ready: true, reasons: [] };
    const gated = cands[0] || null;
    return gated ? { beat: gated, ready: false, reasons: unmet(gated) } : null;
  };

  // membership — declarations first (Phase 2), the registry map as fallback
  const store = ctx.state && typeof ctx.state === "object" ? ctx.state : null;
  const questBeats = {}; for (const k of Object.keys(QUEST_MAP.quests)) questBeats[k] = { main: [], chapters: {} };
  for (const b of beats) {
    const d = declOf(b); if (!d || !questBeats[d.quest]) continue;
    if (d.chapter) (questBeats[d.quest].chapters[d.chapter] = questBeats[d.quest].chapters[d.chapter] || []).push(b);
    else questBeats[d.quest].main.push(b);
    // declared roles feed the writers table too
    const def = QUEST_MAP.quests[d.quest];
    const regId = d.chapter ? def.chapters?.[d.chapter]?.registryId : def.registryId;
    if (regId && d.role === "start") (starts[regId] = starts[regId] || []).push(b);
    if (regId && (d.role === "ending" || d.role === "closer")) (endings[regId] = endings[regId] || []).push(b);
  }
  const anchorBeat = anchorId ? byId.get(anchorId) : null;
  const anchorLoc = (() => { if (!anchorBeat) return null; const d = declOf(anchorBeat); return d ? { quest: d.quest, chapter: d.chapter || null } : null; })();
  const routedFrom = (b, within) => !b ? [] : uniq((b.choices || []).flatMap(c => [c?.next, c?.failNext]).map(x => byId.get(String(x || ""))).filter(t => t && within.has(String(t.id)) && String(t.id) !== String(b.id) && (!fired.has(String(t.id)) || isHub(t))));

  const quests = [];
  for (const [key, def] of Object.entries(QUEST_MAP.quests)) {
    const qb = questBeats[key]; const all = [...qb.main, ...Object.values(qb.chapters).flat()].sort((a, b) => seqOf(a) - seqOf(b));
    const allIds = new Set(all.map(b => String(b.id)));
    const reg = def.registryId;
    const chapters = [];
    for (const [chKey, ch] of Object.entries(def.chapters || {})) {
      const cb = (qb.chapters[chKey] || []).slice().sort((a, b) => seqOf(a) - seqOf(b));
      const cIds = new Set(cb.map(b => String(b.id)));
      const ends = uniq(endings[ch.registryId] || []);
      const sts = uniq(starts[ch.registryId] || []);
      const bucket = bucketOf(ch.registryId);
      const rec = store?.chapters?.[key]?.[chKey] || null;
      const firedEnd = (rec?.ending?.beatId && byId.get(rec.ending.beatId)) || ends.filter(b => fired.has(String(b.id))).sort((a, b) => firedTs(String(b.id)) - firedTs(String(a.id)))[0] || null;
      const anyFired = cb.some(b => fired.has(String(b.id))) || sts.some(b => fired.has(String(b.id)));
      const state = (rec?.ending || bucket === "completed" || bucket === "archived" || firedEnd) ? "done" : (rec?.started || bucket === "active" || anyFired) ? "open" : "dormant";
      const routed = anchorLoc && anchorLoc.quest === key && anchorLoc.chapter === chKey ? routedFrom(anchorBeat, cIds) : [];
      const cPlayed = cb.filter(b => fired.has(String(b.id))).sort((a, b) => firedTs(String(b.id)) - firedTs(String(a.id)));
      const cFront = uniq(cPlayed.flatMap(pb => (pb.choices || []).flatMap(c => [c?.next, c?.failNext]).map(x => byId.get(String(x || ""))).filter(t => t && cIds.has(String(t.id)) && !fired.has(String(t.id)))));
      const cLadder = cb.filter(b => (routesIn.get(String(b.id)) || 0) === 0 && !fired.has(String(b.id)));
      const next = state === "done" ? null : (state === "dormant" && sts.length ? pickNext(sts, [], true) : (pickNext([...cFront, ...cLadder], routed) || (sts.length ? pickNext(sts, [], true) : null)));
      chapters.push({ key: chKey, name: ch.name, registryId: ch.registryId, state, ending: firedEnd ? { beatId: String(firedEnd.id), label: firedEnd.label || firedEnd.id, name: rec?.ending?.name || null } : (rec?.ending ? { beatId: rec.ending.beatId || null, label: rec.ending.name, name: rec.ending.name } : null), next, beats: cb, starts: sts, endings: ends });
    }
    // a SCRIPTED quest closes only by a DECLARED closer (role) — legacy questEffects 'complete' rows are not consulted
    // (the Offices' "Wake up" still carries one from the pre-onboarding order; the seeder removes it)
    const scDecl = scriptOf(key);
    const mainEnds = uniq(endings[reg] || []).filter(b => !scDecl || declOf(b)?.role === "closer");
    const mainStarts = uniq(starts[reg] || []);
    const bucket = reg ? bucketOf(reg) : null;
    const anyFired = all.some(b => fired.has(String(b.id)));
    const closerFired = mainEnds.some(b => fired.has(String(b.id)));
    const qrec = store ? { closed: store.closed?.[key] || null, started: store.started?.[key] || null } : null;
    let state = (qrec?.closed || bucket === "completed" || bucket === "archived" || closerFired) ? "completed"
      : (qrec?.started || bucket === "active" || anyFired) ? "active"
      : mainStarts.some(b => invited.has(String(b.id))) ? "offered" : "dormant";
    if (state === "dormant" && !def.keystone && def.act >= 1 && phase > def.act) state = "closed";
    // next — one ladder, in order of signal strength:
    //  (a) the anchor's own chapter, if it still has something · (b) routed from the anchor anywhere in
    //  the quest · (c) an open chapter with a next · (d) the quest's own body (main beats, closers last)
    //  · (e) a dormant chapter's start · (f) the closer once every chapter has its ending.
    let next = null, why = "next", chapter = null;
    const closerIds = new Set(mainEnds.map(b => String(b.id)));
    // THE FRONTIER (2026-09-14): a quest's body is offered as (1) beats one route away from anything already
    // played in it — most recently played source first, choices in authored order — then (2) the LADDER: beats
    // nothing routes to, in questStep order (the Offices' Sayings, opening scenes). Step order is never the
    // story's intent for routed content; the routes are.
    const bodyAll = qb.main.filter(b => !closerIds.has(String(b.id)));
    const bodyIds = new Set(bodyAll.map(b => String(b.id)));
    const playedHere = all.filter(b => fired.has(String(b.id))).sort((a, b) => firedTs(String(b.id)) - firedTs(String(a.id)));
    const frontier = uniq(playedHere.flatMap(pb => (pb.choices || []).flatMap(c => [c?.next, c?.failNext]).map(x => byId.get(String(x || ""))).filter(t => t && bodyIds.has(String(t.id)) && !fired.has(String(t.id)))));
    const ladder = bodyAll.filter(b => (routesIn.get(String(b.id)) || 0) === 0 && !fired.has(String(b.id)));
    const body = [...frontier, ...ladder];
    if (state === "completed") { why = "complete"; }
    else if (state === "dormant" || state === "offered" || state === "closed") {
      // a quest not yet started: its start beat (explicit start rows first, then a dormant chapter's start, then its first body beat)
      const dormantCh = chapters.find(c => c.state === "dormant" && c.next);
      next = (mainStarts.length ? pickNext(mainStarts, [], true) : null) || (dormantCh ? dormantCh.next : null) || pickNext(body, [], false);   // an ambient body beat (the Tent on rails) is never a door
      if (dormantCh && next === dormantCh.next) chapter = dormantCh;
      why = next ? (next.ready ? "begin" : "begin-waiting") : "empty";
    } else {
      const inQuest = anchorLoc && anchorLoc.quest === key;
      const anchorCh = inQuest && anchorLoc.chapter ? chapters.find(c => c.key === anchorLoc.chapter) : null;
      // a route authored from where the story stands wins even across quests (First Night → the Tent → the
      // Crossroads); the target's own quest is irrelevant to "what happens next"
      const allBeatIds = new Set(beats.map(b => String(b.id)));
      const routedAny = inQuest ? routedFrom(anchorBeat, allBeatIds) : [];
      const openCh = chapters.filter(c => c.state === "open" && c.next);
      const dormantCh = chapters.filter(c => c.state === "dormant" && c.next);
      const chaptersLeft = chapters.some(c => c.state !== "done");
      const bodyNext = pickNext(body, routedAny);
      const readyFirst = (arr) => arr.find(x => x && x.next && x.next.ready) || arr[0] || null;
      // the door's still open (2026-09-14): when the anchor is a hub (or sits under one) and nothing fresh
      // is routed from it, the story's next is to RETURN to the hub — never a body-order orphan
      // the hub above the anchor: walk the routes upward (welcome → answer sits two levels under the town walk);
      // an EXHAUSTED hub (nothing unfired behind any of its doors) is not offered again — the story moves on
      const parentsOf = (id) => beats.filter(h => (h.choices || []).some(c => String(c?.next) === String(id)));
      // prefer a hub that is READY (an Act-1 hub and an Act-2 hub may both route to the same welcome)
      const hubAbove = (b, depth = 0) => { if (!b || depth > 3) return null; if (isHub(b) && allIds.has(String(b.id))) return b; const ps = parentsOf(b.id); const found = ps.map(p => hubAbove(p, depth + 1)).filter(Boolean); return found.find(h => readiness(h).ready) || found[0] || null; };
      const hub = inQuest ? hubAbove(anchorBeat) : null;
      const hubFresh = hub ? routedFrom(hub, allBeatIds).some(t => !fired.has(String(t.id)) || (isHub(t) && String(t.id) !== String(hub.id) && leadsSomewhere(t))) : false;
      const hubNext = hub && hubFresh ? { beat: hub, ready: readiness(hub).ready, reasons: unmet(hub), revisit: true } : null;
      if (anchorCh && anchorCh.state !== "done" && anchorCh.next) { chapter = anchorCh; next = anchorCh.next; }
      else if (routedAny.length && bodyNext && routedAny.includes(bodyNext.beat)) { next = bodyNext; }
      else if (hubNext && hubNext.ready) { next = hubNext; why = "hub"; }
      else if (openCh.length) { chapter = readyFirst(openCh); next = chapter.next; }
      else if (bodyNext && bodyNext.ready) { next = bodyNext; }
      else if (dormantCh.length) { chapter = readyFirst(dormantCh); next = chapter.next; }
      else if (bodyNext) { next = bodyNext; }
      else if (!chaptersLeft && mainEnds.length && !closerFired) { next = pickNext(mainEnds, routedAny, true); why = next ? (next.ready ? "closer" : "closer-waiting") : "closer-empty"; }
      if (why === "hub") { /* set above */ }
      else if (why === "next" && next) why = next.ready ? "next" : "waiting";
      else if (why === "next" && !next) why = chaptersLeft ? "chapter-empty" : (mainEnds.length ? "done-no-closer" : "empty");
    }
    // SCRIPTED (Phase A, 2026-09-17): a declared order replaces the inference — first unfinished step whose gate is met.
    const sc = scriptOf(key);
    const script = sc ? scriptView(sc, { fired, readiness, phase, byId, store, bucketOf, questKey: key }) : null;
    if (script && state !== "completed") {
      next = script.next; why = script.why;
      chapter = script.chapter ? (chapters.find(c => c.key === script.chapter) || null) : null;
    }
    const firedCount = all.filter(b => fired.has(String(b.id))).length;
    stamp(next, def); for (const c of chapters) stamp(c.next, def);
    if (next && next.hereLine && next.here === true) next.line = next.hereLine;   // "go and see" when already there
    quests.push({ key, name: def.name, act: def.act, keystone: !!def.keystone, hex: def.hex || "", registryId: reg, state, chapters, next, why, currentChapter: chapter, starts: mainStarts, closers: mainEnds, progress: { fired: firedCount, total: all.length }, beats: all, script });
  }
  const qByKey = Object.fromEntries(quests.map(q => [q.key, q]));
  // scripted HANDOFF steps (ride for Fixit → the crate comes from the Fixit Farm's chapter): the beat to run is the
  // target quest's own next; the line is still this quest's step
  for (const q of quests) {
    const h = q.next && q.next.handoff; if (!h) continue;
    const t = qByKey[h.quest]; const target = t ? (h.chapter ? (t.chapters.find(c => c.key === h.chapter)?.next || t.next) : t.next) : null;
    if (target && target.beat) { q.next = { ...q.next, beat: target.beat, ready: !!target.ready, reasons: target.reasons || [], place: target.place ?? null, here: target.here ?? null }; q.why = target.ready ? "next" : "waiting"; }
    else { q.next = null; q.why = "handoff-waiting"; }
  }

  // roads: a gate on quest X resolves to X's own next (one rule)
  const roadsFor = (beat) => {
    const out = [];
    for (const g of questGatesOf(beat)) {
      const m = registryOf(g.registryId); if (!m) continue;
      const q = qByKey[m.quest]; if (!q) continue;
      const ch = m.chapter ? q.chapters.find(c => c.key === m.chapter) : null;
      const cur = ch ? (ch.state === "done" ? "completed" : ch.state === "open" ? "active" : null) : (q.state === "completed" ? "completed" : q.state === "active" ? "active" : null);
      const met = g.is != null ? cur === g.is : (g.isNot != null ? cur !== g.isNot : true);
      if (met) continue;
      const target = ch ? ch.next : q.next;
      out.push({ quest: q, chapter: ch, need: g.is || ("not " + g.isNot), beat: target ? target.beat : null, ready: !!(target && target.ready), place: target ? target.place ?? null : null, here: target ? target.here ?? null : null });
    }
    return out;
  };

  const anchorQuest = anchorLoc ? qByKey[anchorLoc.quest] : null;
  const inPlay = quests.filter(q => q.state === "active" && !(anchorQuest && q.key === anchorQuest.key));
  // THE TURN (2026-09-14): when nothing fresh is left anywhere this turn — every quest's next is a hub
  // revisit or gated, and no door is open — the story's next is the Turn Driver, not a hub to ping-pong.
  const fresh = (q) => !!(q && q.next && q.next.ready && leadsSomewhere(q.next.beat));
  const anyFresh = quests.some(q => (q.state === "active") && fresh(q));
  // ELSEWHERE: when the story's own quest has only a stale hub to offer but another quest in play has
  // something fresh, that is what happens next (the fiddle in Khezek-Tor while you stand at the Crossroads)
  // HERE (2026-09-15): what the party can reach from where it stands comes first — a fresh next in another quest
  // AT THIS HEX beats the anchor's fresh next in a town a ride away (the ride is still offered, as the ride).
  const reachable = (q) => fresh(q) && q.next.here !== false;
  // A DOOR standing at the party's hex counts as reachable too (2026-09-18, live-caught: the party rode to Khezek-Tor on
  // day one and NOW kept offering Allesh-Gilliam's Day's End, a ride away, while the cookline waited right here)
  const doorHere = (q) => (q.state === "dormant" || q.state === "offered") && q.next && q.next.ready && q.next.here === true && leadsSomewhere(q.next.beat);
  const elsewhere = anchorQuest && !reachable(anchorQuest) ? (inPlay.find(reachable) || quests.find(doorHere) || (!fresh(anchorQuest) ? (inPlay.find(fresh) || null) : null)) : null;
  const elsewhereWhy = elsewhere ? (fresh(anchorQuest) ? "here" : "elsewhere") : null;
  inPlay.sort((a, b) => Number(b.next?.here === true) - Number(a.next?.here === true));
  const now = anchorQuest ? ((!anyFresh && !quests.some(q => (q.state === "dormant" || q.state === "offered") && q.next && q.next.ready))
    ? { quest: anchorQuest, chapter: anchorQuest.currentChapter, next: null, why: "turn", roads: [] }
    : elsewhere
      ? { quest: elsewhere, chapter: elsewhere.currentChapter, next: elsewhere.next, why: elsewhereWhy, roads: [] }
      : { quest: anchorQuest, chapter: anchorQuest.currentChapter, next: anchorQuest.next, why: anchorQuest.why, roads: anchorQuest.next && !anchorQuest.next.ready ? roadsFor(anchorQuest.next.beat) : [] }) : null;
  // a door is a quest not yet started whose START is ready NOW — readiness already carries the start beat's own
  // act gate, so the quest's nominal act is not consulted (towns span acts 1–2; Allesh-Gilliam's opening is Act 1)
  const doors = quests.filter(q => (q.state === "dormant" || q.state === "offered") && q.next && q.next.ready)
    .sort((a, b) => Number(b.next.here === true) - Number(a.next.here === true));
  return { act: phase, turn, quests, byKey: qByKey, anchor: anchorBeat ? { beatId: anchorId, quest: anchorLoc?.quest || null, chapter: anchorLoc?.chapter || null } : null, now, inPlay, doors, roadsFor, where: ctx.where || null };
}


// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2 — THE ONE STORE (2026-09-13). Beats declare `beat.story = {quest, chapter?, role?, ending?,
// alsoStarts?[]}`; the engine records what was played into ONE world setting (bbttcc-campaign.storyState,
// per campaign) and everything else derives from it: quest/chapter state, endings, seals, and the
// coalition quest buckets (a PROJECTION for the Quest Log and questBucket gates — no longer a writer).
// These functions are pure; module.js owns the I/O.
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// SCRIPTS — Phase A of the STORY FLOW encode (2026-09-17, owner ruling 2026-09-15: "tell the system what we
// expect, not have it guess"). A scripted quest declares its ORDER: giver, player-facing description, ordered
// steps (each = the beats that play it + one next-step line), doors (open all act, never "next"), epilogues,
// and an Arrival chapter (act 1) that seals when the act turns. For a scripted quest `next` is the first
// unfinished step whose gate is met — FRONTIER/LADDER inference is bypassed. Unscripted quests keep the
// inference byte-for-byte. Scripts are code (versioned, lint-able): Phase B fills QUEST_SCRIPTS.
//   script = { giver, description, steps:[step], doors:[door], after:[beatId], arrival:{act:1, steps:[step]},
//              chapters:{ chKey:{ giver?, line? } } }
//   step   = { id, label, beats:[beatId], line, hereLine?, group?, chapter?, done?, handoff?:{quest, chapter?}, borrow?:true (a beat declared to another quest, used here on purpose) }
//   done   = undefined (any beat played) | {anyOf:[ids]} | {allOf:[ids]} | {mark:id} | {chapter:[quest,ch]} | {quest:key}
//   group  = steps sharing a group are ANY ORDER: every unfinished one is current at once
// ═════════════════════════════════════════════════════════════════════════════
import { STORY_SCRIPTS } from "./story-scripts.js";
export const QUEST_SCRIPTS = {};
export function scriptOf(key) { const s = QUEST_SCRIPTS[String(key || "")]; return s && typeof s === "object" ? s : null; }
export function registerScripts(map) { for (const [k, v] of Object.entries(map || {})) if (v && typeof v === "object") QUEST_SCRIPTS[k] = v; return QUEST_SCRIPTS; }

// Pure: the script's steps with a status each, the current step(s), the doors, and the declared next.
// ctx = { fired:Set, readiness(beat)→{ready,reasons}, phase, byId:Map, store, bucketOf(registryId) }
export function scriptView(sc, ctx) {
  const fired = ctx.fired instanceof Set ? ctx.fired : new Set();
  const readiness = typeof ctx.readiness === "function" ? ctx.readiness : () => ({ ready: true, reasons: [] });
  const bucketOf = typeof ctx.bucketOf === "function" ? ctx.bucketOf : () => null;
  const byId = ctx.byId instanceof Map ? ctx.byId : new Map();
  const store = ctx.store && typeof ctx.store === "object" ? ctx.store : null;
  const phase = Number(ctx.phase) || 0;
  const played = id => fired.has(String(id));
  const bucketDone = (rid) => { const b = rid ? bucketOf(rid) : null; return b === "completed" || b === "archived"; };
  const chDone = (q, ch) => !!store?.chapters?.[q]?.[ch]?.ending || bucketDone(QUEST_MAP.quests[q]?.chapters?.[ch]?.registryId);
  const qDone = (q) => !!store?.closed?.[q] || bucketDone(QUEST_MAP.quests[q]?.registryId);
  const isDone = (st) => {
    const d = st.done, beats = Array.isArray(st.beats) ? st.beats : [];
    if (!d || typeof d !== "object") return beats.some(played);
    if (Array.isArray(d.anyOf)) return d.anyOf.some(played);
    if (Array.isArray(d.allOf)) return d.allOf.every(played);
    if (d.mark) return played(d.mark);
    if (Array.isArray(d.chapter)) return chDone(d.chapter[0], d.chapter[1]);
    if (d.quest) return qDone(d.quest);
    return beats.some(played);
  };
  const list = [
    ...((sc.arrival && Array.isArray(sc.arrival.steps)) ? sc.arrival.steps.map(s => ({ ...s, act: Number(sc.arrival.act ?? 1), arrival: true })) : []),
    ...(Array.isArray(sc.steps) ? sc.steps : [])
  ];
  const steps = []; let currentGroup = null, foundCurrent = false;
  for (const st of list) {
    const done = isDone(st);
    let status;
    if (done) status = "done";
    else if (st.act != null && phase > Number(st.act)) status = "sealed";            // an Arrival step after its act
    else if (!foundCurrent) { status = "current"; foundCurrent = true; currentGroup = st.group || null; }
    else if (currentGroup && st.group === currentGroup) status = "current";
    else status = "todo";
    steps.push({ ...st, status });
  }
  const current = steps.filter(s => s.status === "current");
  // a step's candidates: its unplayed listed beats first; when every listed beat has played and the step is not done
  // (the outcome arrives by a CHOICE — the wall's success/failure, a chapter's ending), the beats routed from the
  // step's played beats that are unplayed and belong to this quest (or to the step's done-list) — the frontier, scoped
  // to the step, so the NOW card can still point at what the table is about to choose
  const questKey = ctx.questKey ? String(ctx.questKey) : null;
  const inQuest = (b) => { if (!questKey) return true; const d = declOf(b); return !!d && d.quest === questKey; };
  const doneIds = (st) => new Set([...(st.done?.anyOf || []), ...(st.done?.allOf || []), ...(st.done?.mark ? [st.done.mark] : [])].map(String));
  const cand = (st) => {
    const listed = (Array.isArray(st.beats) ? st.beats : []).map(id => byId.get(String(id))).filter(Boolean);
    const fresh = listed.filter(b => !played(b.id)); if (fresh.length) return fresh;
    const dl = doneIds(st); const out = []; const seen = new Set();
    for (const pb of listed.filter(b => played(b.id))) for (const c of (pb.choices || [])) for (const t of [c?.next, c?.failNext]) {
      const b = byId.get(String(t || "")); if (!b || played(b.id) || seen.has(b.id)) continue;
      if (dl.has(String(b.id)) || inQuest(b)) { seen.add(b.id); out.push(b); }
    }
    return out;
  };
  const mk = (st, b, ready, reasons) => ({ beat: b, ready, reasons, line: st.line || "", hereLine: st.hereLine || null, step: st.id, stepLabel: st.label || "", scripted: true });
  let next = null, why = "next", stepOf = null;
  for (const st of current) { const b = cand(st).find(x => readiness(x).ready); if (b) { next = mk(st, b, true, []); stepOf = st; break; } }
  if (!next) for (const st of current) { const bs = cand(st); if (bs.length) { const r = readiness(bs[0]); next = mk(st, bs[0], false, (r.reasons || []).filter(x => x && x.met === false)); stepOf = st; why = "waiting"; break; } }
  if (!next) {
    const h = current.find(st => st.handoff || (st.done && (Array.isArray(st.done.chapter) || st.done.quest)));
    if (h) { const handoff = h.handoff || (Array.isArray(h.done.chapter) ? { quest: h.done.chapter[0], chapter: h.done.chapter[1] } : { quest: h.done.quest }); next = { ...mk(h, null, false, []), handoff }; stepOf = h; why = "handoff"; }
  }
  if (!next && !current.length) why = steps.length && steps.every(s => s.status === "done" || s.status === "sealed") ? "complete" : "empty";
  const doors = (Array.isArray(sc.doors) ? sc.doors : []).map(d => {
    const bs = (Array.isArray(d.beats) ? d.beats : []).map(id => byId.get(String(id))).filter(Boolean);
    const first = bs.find(b => !played(b.id)) || bs[0] || null;
    return { id: d.id, label: d.label || "", line: d.line || "", beat: first, ready: first ? !!readiness(first).ready : false, played: bs.some(b => played(b.id)) };
  });
  return {
    giver: String(sc.giver || ""), description: String(sc.description || ""),
    steps: steps.map(s => ({ id: s.id, label: s.label || "", line: s.line || "", status: s.status, group: s.group || null, arrival: !!s.arrival, chapter: s.chapter || null })),
    current: current.map(s => s.id), doors, after: Array.isArray(sc.after) ? sc.after.slice() : [], chapters: sc.chapters && typeof sc.chapters === "object" ? sc.chapters : {},
    next, why, chapter: stepOf?.chapter || null
  };
}

export function emptyState() {
  return { v: 1, played: {}, started: {}, chapters: {}, closed: {} };
}

export function declOf(beat) {
  const d = beat?.story;
  if (d && typeof d === "object" && d.quest) return d;
  if (d && typeof d === "object" && (Array.isArray(d.alsoStarts) || Array.isArray(d.alsoEnds))) return d;   // a pool beat that starts/ends a quest elsewhere
  if (/^hum_/.test(String(beat?.id || ""))) return { quest: "sarmoung_hum" };
  const m = registryOf(beat?.questId);
  return m ? { quest: m.quest, chapter: m.chapter || undefined } : null;
}

// Record one played beat. Returns the list of state changes (for the ledger/whisper).
export function applyRecord(state, beat, meta = {}) {
  const st = state && typeof state === "object" ? state : emptyState();
  st.played = st.played || {}; st.started = st.started || {}; st.chapters = st.chapters || {}; st.closed = st.closed || {};
  const id = String(beat?.id || ""); if (!id) return [];
  const ts = Number(meta.ts) || Date.now(), turn = Number(meta.turn) || 0;
  const changes = [];
  const prev = st.played[id];
  st.played[id] = { ts, turn, n: (prev?.n || 0) + 1, firstTs: prev?.firstTs || prev?.ts || ts, firstTurn: prev?.firstTurn ?? prev?.turn ?? turn };
  const d = declOf(beat); if (!d) return changes;
  const stamp = { ts, turn, beatId: id };
  const endChapter = (q, ch, name, why) => { if (!QUEST_MAP.quests[q]?.chapters?.[ch]) return; st.chapters[q] = st.chapters[q] || {}; st.chapters[q][ch] = st.chapters[q][ch] || {}; const c = st.chapters[q][ch]; if (c.ending) return; c.started = c.started || { ...stamp, via: why }; st.started[q] = st.started[q] || { ...stamp, via: why }; c.ending = { name: String(name || "passed"), ...stamp }; changes.push({ kind: "chapter-ended", quest: q, chapter: ch, ending: c.ending.name }); };
  const closeQuest = (q, name, why) => { if (!QUEST_MAP.quests[q] || st.closed[q]) return; st.started[q] = st.started[q] || { ...stamp, via: why }; st.closed[q] = { name: String(name || "passed"), ...stamp }; changes.push({ kind: "quest-closed", quest: q, ending: st.closed[q].name }); };
  if (!d.quest) {
    for (const a of (Array.isArray(d.alsoStarts) ? d.alsoStarts : [])) { if (!a?.quest || !QUEST_MAP.quests[a.quest]) continue; if (!st.started[a.quest]) { st.started[a.quest] = { ...stamp, via: "also:" + id }; changes.push({ kind: "quest-started", quest: a.quest }); } if (a.chapter) { st.chapters[a.quest] = st.chapters[a.quest] || {}; st.chapters[a.quest][a.chapter] = st.chapters[a.quest][a.chapter] || {}; if (!st.chapters[a.quest][a.chapter].started) { st.chapters[a.quest][a.chapter].started = { ...stamp, via: "also:" + id }; changes.push({ kind: "chapter-started", quest: a.quest, chapter: a.chapter }); } } }
    for (const e of (Array.isArray(d.alsoEnds) ? d.alsoEnds : [])) { if (!e?.quest) continue; if (e.chapter) endChapter(e.quest, e.chapter, e.ending, "also:" + id); else closeQuest(e.quest, e.ending, "also:" + id); }
    return changes;
  }
  const startQuest = (q, why) => { if (!st.started[q]) { st.started[q] = { ...stamp, via: why }; changes.push({ kind: "quest-started", quest: q }); } };
  const startChapter = (q, ch, why) => { st.chapters[q] = st.chapters[q] || {}; st.chapters[q][ch] = st.chapters[q][ch] || {}; if (!st.chapters[q][ch].started) { st.chapters[q][ch].started = { ...stamp, via: why }; changes.push({ kind: "chapter-started", quest: q, chapter: ch }); } };
  // playing any beat of a quest means the quest is in play (a town walk starts the town)
  startQuest(d.quest, d.role === "start" ? "start" : "played");
  if (d.chapter) startChapter(d.quest, d.chapter, d.role === "start" ? "start" : "played");
  if (d.role === "ending" && d.chapter) {
    st.chapters[d.quest][d.chapter].ending = { name: String(d.ending || id.split("_").slice(-1)[0]), ...stamp };
    changes.push({ kind: "chapter-ended", quest: d.quest, chapter: d.chapter, ending: st.chapters[d.quest][d.chapter].ending.name });
  }
  if (d.role === "closer") {
    if (d.chapter && !st.chapters[d.quest][d.chapter].ending) {   // closing the quest closes the chapter it stands in
      st.chapters[d.quest][d.chapter].ending = { name: String(d.ending || id.split("_").slice(-1)[0]), ...stamp };
      changes.push({ kind: "chapter-ended", quest: d.quest, chapter: d.chapter, ending: st.chapters[d.quest][d.chapter].ending.name });
    }
    st.closed[d.quest] = { name: String(d.ending || id.split("_").slice(-1)[0]), ...stamp };
    changes.push({ kind: "quest-closed", quest: d.quest, ending: st.closed[d.quest].name });
  }
  for (const a of (Array.isArray(d.alsoStarts) ? d.alsoStarts : [])) {
    if (!a || !a.quest || !QUEST_MAP.quests[a.quest]) continue;
    startQuest(a.quest, "also:" + id);
    if (a.chapter) startChapter(a.quest, a.chapter, "also:" + id);
  }
  for (const e of (Array.isArray(d.alsoEnds) ? d.alsoEnds : [])) {
    if (!e || !e.quest) continue;
    if (e.chapter) endChapter(e.quest, e.chapter, e.ending, "also:" + id); else closeQuest(e.quest, e.ending, "also:" + id);
  }
  return changes;
}

// Quest-bucket projection: registryId → "active" | "completed" | null, for every registry row in QUEST_MAP.
export function projection(state) {
  const st = state || emptyState(); const out = {};
  for (const [key, def] of Object.entries(QUEST_MAP.quests)) {
    if (def.registryId) out[def.registryId] = st.closed?.[key] ? "completed" : (st.started?.[key] ? "active" : null);
    for (const [chKey, ch] of Object.entries(def.chapters || {})) {
      const c = st.chapters?.[key]?.[chKey];
      if (ch.registryId) out[ch.registryId] = c?.ending ? "completed" : (c?.started ? "active" : null);
    }
  }
  return out;
}

// Seal verdict for a declared beat, from state alone (owner ruling R3, 2026-09-13):
// a keystone never seals · a started quest stays open across acts · a never-started quest closes with its act.
export function sealOfDecl(beat, state, phase, { sealQuests = true, sealActs = true } = {}) {
  const d = declOf(beat); if (!d || !d.quest || !QUEST_MAP.quests[d.quest]) return null;
  if (beat?.inject?.evergreen === true) return { sealed: false };
  const def = QUEST_MAP.quests[d.quest];
  if (def.keystone) return { sealed: false };
  if (def.act === 0) return { sealed: false };
  const st = state || emptyState();
  if (sealQuests && st.closed?.[d.quest]) return { sealed: true, kind: "quest", why: `its quest "${def.name}" is complete (${st.closed[d.quest].name})`, quest: d.quest };
  // A chapter that has ENDED seals its own start and endings (2026-09-18, live-caught: the Weeping Prisoner re-offered from the
  // Arc Bay after Justice). Other beats declared in the chapter (hubs, asides) stay open.
  if (sealQuests && d.chapter && (d.role === "start" || d.role === "ending")) {
    const ch = st.chapters?.[d.quest]?.[d.chapter];
    if (ch?.ending) return { sealed: true, kind: "chapter", why: `its chapter "${def.chapters?.[d.chapter]?.name || d.chapter}" has ended (${ch.ending.name})`, quest: d.quest, chapter: d.chapter };
  }
  if (sealActs && !st.started?.[d.quest] && def.act >= 1 && Number(phase) > def.act) return { sealed: true, kind: "act", why: `"${def.name}" was never started and Act ${def.act} is over (the story is in Act ${phase})`, quest: d.quest, act: def.act, phase: Number(phase) };
  return { sealed: false };
}


// Declarations for every beat, derived once from the pre-Phase-2 data (the migration seeder
// stamps these onto beat.story; the offline lint replays it). Pure.
export function declarationsFor(beats) {
  const out = {}; const report = { starts: 0, endings: 0, closers: 0, also: 0, dropped: [], unmapped: [] };
  const regOfBeat = (b) => /^hum_/.test(String(b?.id || "")) ? { quest: "sarmoung_hum", chapter: null } : registryOf(b?.questId);
  const regIdFor = (m) => { const def = QUEST_MAP.quests[m.quest]; return m.chapter ? (def?.chapters?.[m.chapter]?.registryId || null) : (def?.registryId || null); };
  // ending-name inference: strip the common prefix among a chapter's (or quest's) closer ids
  const groups = {};
  for (const b of beats) { for (const e of (b?.worldEffects?.questEffects || [])) if (e?.action === "complete" && e.questId) (groups[e.questId] = groups[e.questId] || []).push(String(b.id)); }
  const nameIn = (regId, id) => { const ids = groups[regId] || [id]; if (ids.length < 2) return id.split("_").slice(-1)[0]; let p = ids[0]; for (const i of ids) while (!i.startsWith(p)) p = p.slice(0, -1); p = p.replace(/[^_]*$/, ""); if (p.length < 4) return id.split("_").slice(-1)[0]; /* one outlier closer (gilbert_theater_resolution) must not turn every ending into its full id */ return id.slice(p.length) || id.split("_").slice(-1)[0]; };
  for (const b of beats) {
    const id = String(b?.id || ""); if (!id) continue;
    const m = regOfBeat(b);
    const rows = b?.worldEffects?.questEffects || [];
    if (!m) {
      // a pool beat (travel encounter) may still start or end a quest elsewhere — keep only that
      const d = {};
      for (const e of rows) { const tgt = e?.questId ? registryOf(e.questId) : null; if (!tgt) continue; if (e.action === "accept") { (d.alsoStarts = d.alsoStarts || []).push(tgt.chapter ? { quest: tgt.quest, chapter: tgt.chapter } : { quest: tgt.quest }); report.also++; } else if (e.action === "complete" || e.action === "completed") { (d.alsoEnds = d.alsoEnds || []).push(tgt.chapter ? { quest: tgt.quest, chapter: tgt.chapter, ending: "passed" } : { quest: tgt.quest, ending: "passed" }); report.also++; } }
      if (d.alsoStarts || d.alsoEnds) out[id] = d; else if (b?.questId && !/^word_/.test(String(b.questId))) report.unmapped.push(id);
      continue;
    }
    const d = { quest: m.quest }; if (m.chapter) d.chapter = m.chapter;
    const own = regIdFor(m);
    const ownStart = String(b?.questRole || "") === "start" || rows.some(e => e && e.action === "accept" && String(e.questId) === String(own));
    for (const e of rows) {
      if (!e || !e.questId) continue;
      const tgt = registryOf(e.questId);
      if (e.action === "accept") {
        if (String(e.questId) === String(own)) d.role = d.role || "start";
        else if (tgt) { (d.alsoStarts = d.alsoStarts || []).push(tgt.chapter ? { quest: tgt.quest, chapter: tgt.chapter } : { quest: tgt.quest }); report.also++; }
      } else if (e.action === "complete" || e.action === "completed") {
        if (String(e.questId) === String(own)) { d.role = m.chapter ? "ending" : "closer"; d.ending = nameIn(String(own), id); }
        else if (tgt && tgt.quest === m.quest && tgt.chapter && !m.chapter && !ownStart && !d.role) {
          // a consequence beat filed under the town that ENDS one of the town's chapters (Red Thread sprouted,
          // the soil keeps books, the sink widens…): it IS that chapter's ending — move it in, name it
          d.chapter = tgt.chapter; d.role = "ending"; d.ending = nameIn(String(e.questId), id); report.also++;
        }
        else if (tgt) { (d.alsoEnds = d.alsoEnds || []).push(tgt.chapter ? { quest: tgt.quest, chapter: tgt.chapter, ending: "passed" } : { quest: tgt.quest, ending: "passed" }); report.also++; report.dropped.push({ beat: id, completes: String(e.questId), as: `${tgt.quest}${tgt.chapter ? "·" + tgt.chapter : ""} (carried as alsoEnds:passed)` }); }
        else report.dropped.push({ beat: id, completes: String(e.questId), as: "? (unknown quest — dropped)" });
      }
    }
    if (!d.role && String(b?.questRole || "") === "start") d.role = "start";
    if (id === "vs_bridge_muster" && !d.role) { d.role = "closer"; d.ending = "muster"; }   // owner ruling R6: the Spine completes at the muster
    if (d.role === "start") report.starts++; else if (d.role === "ending") report.endings++; else if (d.role === "closer") report.closers++;
    out[id] = d;
  }
  return { decls: out, report };
}

// Phase B (2026-09-17): the authored scripts for Acts 0–2 register at load.
registerScripts(STORY_SCRIPTS);
