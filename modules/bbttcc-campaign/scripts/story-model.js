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
   "hex": "Gullywasher",
   "registryId": "fc_wendigo_confluence",
   "chapters": {
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
   "name": "The Valhaulan Spine",
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
   "registryId": null,
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
   "chapters": {
    "siege_week": {
     "name": "Siege Week",
     "registryId": "quest_siege_festival"
    }
   }
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
  "quest_siege_festival": {
   "quest": "fifteen_year_siege",
   "chapter": "siege_week"
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

  // writers, from the beats themselves
  const starts = {}, endings = {};
  for (const b of beats) {
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
    return { ready: reqsOf(b).length === 0, reasons: [], unknown: true };
  };
  const unmet = (b) => (readiness(b).reasons || []).filter(r => r && r.met === false);
  const questGatesOf = (b) => {
    return reqsOf(b).filter(r => r && r.questBucket != null).map(r => ({ registryId: String(r.questBucket), is: r.is != null ? String(r.is) : null, isNot: r.isNot != null ? String(r.isNot) : null }));
  };
  const pickNext = (list, routedFirst, allowAmbient = false) => {
    const cands = uniq([...(routedFirst || []), ...list.filter(b => (allowAmbient || !isAmbient(b)) && !fired.has(String(b.id)))].filter(Boolean));
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
  const routedFrom = (b, within) => !b ? [] : uniq((b.choices || []).flatMap(c => [c?.next, c?.failNext]).map(x => byId.get(String(x || ""))).filter(t => t && within.has(String(t.id)) && !fired.has(String(t.id))));

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
      const next = state === "done" ? null : (state === "dormant" && sts.length ? pickNext(sts, [], true) : (pickNext(cb, routed) || (sts.length ? pickNext(sts, [], true) : null)));
      chapters.push({ key: chKey, name: ch.name, registryId: ch.registryId, state, ending: firedEnd ? { beatId: String(firedEnd.id), label: firedEnd.label || firedEnd.id, name: rec?.ending?.name || null } : (rec?.ending ? { beatId: rec.ending.beatId || null, label: rec.ending.name, name: rec.ending.name } : null), next, beats: cb, starts: sts, endings: ends });
    }
    const mainEnds = uniq(endings[reg] || []).filter(b => !allIds.size || true);
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
    const body = qb.main.filter(b => !closerIds.has(String(b.id)));
    if (state === "completed") { why = "complete"; }
    else if (state === "dormant" || state === "offered" || state === "closed") {
      // a quest not yet started: its start beat (explicit start rows first, then a dormant chapter's start, then its first body beat)
      const dormantCh = chapters.find(c => c.state === "dormant" && c.next);
      next = (mainStarts.length ? pickNext(mainStarts, [], true) : null) || (dormantCh ? dormantCh.next : null) || pickNext(body, [], true);
      if (dormantCh && next === dormantCh.next) chapter = dormantCh;
      why = next ? (next.ready ? "begin" : "begin-waiting") : "empty";
    } else {
      const inQuest = anchorLoc && anchorLoc.quest === key;
      const anchorCh = inQuest && anchorLoc.chapter ? chapters.find(c => c.key === anchorLoc.chapter) : null;
      const routedAny = inQuest ? routedFrom(anchorBeat, allIds) : [];
      const openCh = chapters.filter(c => c.state === "open" && c.next);
      const dormantCh = chapters.filter(c => c.state === "dormant" && c.next);
      const chaptersLeft = chapters.some(c => c.state !== "done");
      const bodyNext = pickNext(body, routedAny);
      const readyFirst = (arr) => arr.find(x => x && x.next && x.next.ready) || arr[0] || null;
      if (anchorCh && anchorCh.state !== "done" && anchorCh.next) { chapter = anchorCh; next = anchorCh.next; }
      else if (routedAny.length && bodyNext && routedAny.includes(bodyNext.beat)) { next = bodyNext; }
      else if (openCh.length) { chapter = readyFirst(openCh); next = chapter.next; }
      else if (bodyNext && bodyNext.ready) { next = bodyNext; }
      else if (dormantCh.length) { chapter = readyFirst(dormantCh); next = chapter.next; }
      else if (bodyNext) { next = bodyNext; }
      else if (!chaptersLeft && mainEnds.length && !closerFired) { next = pickNext(mainEnds, routedAny, true); why = next ? (next.ready ? "closer" : "closer-waiting") : "closer-empty"; }
      if (why === "next" && next) why = next.ready ? "next" : "waiting";
      else if (why === "next" && !next) why = chaptersLeft ? "chapter-empty" : (mainEnds.length ? "done-no-closer" : "empty");
    }
    const firedCount = all.filter(b => fired.has(String(b.id))).length;
    quests.push({ key, name: def.name, act: def.act, keystone: !!def.keystone, hex: def.hex || "", registryId: reg, state, chapters, next, why, currentChapter: chapter, starts: mainStarts, closers: mainEnds, progress: { fired: firedCount, total: all.length }, beats: all });
  }
  const qByKey = Object.fromEntries(quests.map(q => [q.key, q]));

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
      out.push({ quest: q, chapter: ch, need: g.is || ("not " + g.isNot), beat: target ? target.beat : null, ready: !!(target && target.ready) });
    }
    return out;
  };

  const anchorQuest = anchorLoc ? qByKey[anchorLoc.quest] : null;
  const now = anchorQuest ? {
    quest: anchorQuest, chapter: anchorQuest.currentChapter, next: anchorQuest.next, why: anchorQuest.why,
    roads: anchorQuest.next && !anchorQuest.next.ready ? roadsFor(anchorQuest.next.beat) : []
  } : null;
  const inPlay = quests.filter(q => q.state === "active" && !(anchorQuest && q.key === anchorQuest.key));
  const doors = quests.filter(q => (q.state === "dormant" || q.state === "offered") && q.act <= phase && q.next && q.next.ready);
  return { act: phase, turn, quests, byKey: qByKey, anchor: anchorBeat ? { beatId: anchorId, quest: anchorLoc?.quest || null, chapter: anchorLoc?.chapter || null } : null, now, inPlay, doors, roadsFor };
}


// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2 — THE ONE STORE (2026-09-13). Beats declare `beat.story = {quest, chapter?, role?, ending?,
// alsoStarts?[]}`; the engine records what was played into ONE world setting (bbttcc-campaign.storyState,
// per campaign) and everything else derives from it: quest/chapter state, endings, seals, and the
// coalition quest buckets (a PROJECTION for the Quest Log and questBucket gates — no longer a writer).
// These functions are pure; module.js owns the I/O.
// ═════════════════════════════════════════════════════════════════════════════

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
export function sealOfDecl(beat, state, phase) {
  const d = declOf(beat); if (!d || !d.quest || !QUEST_MAP.quests[d.quest]) return null;
  if (beat?.inject?.evergreen === true) return { sealed: false };
  const def = QUEST_MAP.quests[d.quest];
  if (def.keystone) return { sealed: false };
  if (def.act === 0) return { sealed: false };
  const st = state || emptyState();
  if (st.closed?.[d.quest]) return { sealed: true, kind: "quest", why: `its quest "${def.name}" is complete (${st.closed[d.quest].name})`, quest: d.quest };
  if (!st.started?.[d.quest] && def.act >= 1 && Number(phase) > def.act) return { sealed: true, kind: "act", why: `"${def.name}" was never started and Act ${def.act} is over (the story is in Act ${phase})`, quest: d.quest, act: def.act, phase: Number(phase) };
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
  const nameIn = (regId, id) => { const ids = groups[regId] || [id]; if (ids.length < 2) return id.split("_").slice(-1)[0]; let p = ids[0]; for (const i of ids) while (!i.startsWith(p)) p = p.slice(0, -1); p = p.replace(/[^_]*$/, ""); return id.slice(p.length) || id.split("_").slice(-1)[0]; };
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
