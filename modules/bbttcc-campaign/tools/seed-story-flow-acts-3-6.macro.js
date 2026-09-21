/**
 * seed-story-flow-acts-3-6.macro.js — GM macro/console. Runs as a DRY RUN first and then ASKS to apply (no constant to flip).
 *
 * STORY FLOW · ACTS 3–6 (owner rulings A–M, 2026-09-20; proposals in ~/STORY_FLOW_ACTS_3_6_2026_09_19.md). Every section
 * is idempotent. Companion code: story-model.js (the Burnt Flats chapter, four quest hexes), story-scripts.js (twelve scripts),
 * module.js (`beat.storeFacts` — Gloomgill knows the answers before he asks).
 *
 *  S1  Widening Trail: the Burnt Flats become a CHAPTER (its two outcomes were quest closers — the Trail closed at step 2);
 *      Legansus verified/flagged also close the Trail; the six sites get their hexes (Ruling B) + on-enter openers.
 *  S2  Hidden Vault: hex door at PolygonWood.a, off the travel pool (Ruling D); the Bijou chain is Gilbert's parley/fight
 *      path, its resolution the good ending (Ruling C); a fight can be finished (hostile ending).
 *  S3  Balcones: the opening is the start; the bare hub gets a line; hex = Saltwake Reach j (Ruling E) + on-enter.
 *  S4  Flooded Towns: "Continue the investigation" routes to the next enclave (fixed order, Ruling F); hexes + on-enter.
 *  S5  Lost Statues: hexName on the three statues (Ruling G); the confer beats fire on arrival at statues 2 and 3.
 *  S6  Siege: `siege_join` is an ending; the doors wait for both commanders (Ruling H); hex = Perspicacity Fortress.
 *  S7  A Gift: the arrival is a placeless Word (Ruling I).
 *  S8  Crown Mall: arrival at the hex opens Donny (off the pool); the archive waits for Legansus (Ruling J).
 *  S9  Maneuver Vault: Mara's summons waits for Act 4 + the archive (it could fire in Act 2); Slippage DC 25 (Ruling K);
 *      the Vault stands on Hexen Myre.c (the approach opens on arrival).
 *  S10 Ninth Guest: the approach starts it, the plinth ends it; hex = Founder's Garden.
 *  S11 Finale: the bunker is Inconvenient Mountains.h (Ruling L); outcomes with spoils route on, rewards close the quest;
 *      the act advance comes off two outcomes.
 *  S12 Act 6 title card on ANY finale ending (Ruling A).
 *  S15 THE STORY TEACHES (2026-09-21): recipeGrants on the Mall/Seal/Vault/finale beats; emotional-ingredient RECEIPTS on the Mall and the Bijou.
 *  S13 Gloomgill: `storeFacts` on the ten questions (Ruling M); hex-enter at Odaroloc River.c.
 *  S14 SCENES (owner, 2026-09-20): the three Hex Flooded Towns battlemaps; the Mall of Forgotten Yesterdays — Donny on the
 *      approach, the food court for the Tanneritos and the mall's life, food court 2 for the archive, the halfpipe for
 *      Kickflip, Bev's office, Miss June's store. Bound by scene NAME (ids as fallback), so a rebuilt scene keeps binding.
 *
 * Backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  async function run(apply) {
    let campsRaw = game.settings.get(NS, "campaigns");
    const campsWasStr = typeof campsRaw === "string";
    const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
    const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
    const camp = camps?.[campaignId];
    if (!camp) { ui.notifications.error(`Active campaign '${campaignId}' not found.`); return null; }
    const byId = new Map((camp.beats || []).map(b => [b.id, b]));
    const report = []; let changes = 0; const say = (s) => report.push(s);
    const get = (id) => { const b = byId.get(id); if (!b) say(`✗ MISSING beat ${id}`); return b || null; };
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const setField = (id, k, v) => { const b = get(id); if (!b) return; if (eq(b[k], v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} = ${JSON.stringify(v).slice(0, 120)}`); };
    const setStory = (id, story) => setField(id, "story", story);
    const setReq = (id, requires) => { const b = get(id); if (!b) return; b.inject = b.inject || {}; if (eq(b.inject.requires, requires)) return say(`· ok ${id} requires`); b.inject.requires = requires; changes++; say(`⛩ ${id}: requires = ${JSON.stringify(requires).slice(0, 140)}`); };
    const addReq = (id, cond) => { const b = get(id); if (!b) return; b.inject = b.inject || {}; const rs = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []); b.inject.requires = rs; if (rs.some(c => eq(c, cond))) return say(`· ok ${id} gate`); rs.push(cond); changes++; say(`⛩ ${id}: +gate ${JSON.stringify(cond)}`); };
    const ch = (label, next, extra = {}) => Object.assign({ label, next: next || "", description: "", checkStat: "", checkDC: 0, failNext: "" }, extra);
    const retarget = (id, labelRe, next) => { const b = get(id); if (!b) return; const c = (b.choices || []).find(c => c && labelRe.test(String(c.label || ""))); if (!c) return say(`✗ ${id}: no choice ${labelRe}`); if (c.next === next) return say(`· ok ${id} "${c.label}" → ${next}`); c.next = next; changes++; say(`▸ ${id}: "${c.label}" → ${next}`); };
    const addChoice = (id, row) => { const b = get(id); if (!b) return; b.choices = Array.isArray(b.choices) ? b.choices : []; if (b.choices.some(c => c && c.label === row.label)) return say(`· ok ${id} choice "${row.label}"`); b.choices.push(row); changes++; say(`▸ ${id}: + "${row.label}" → ${row.next || "-"}`); };
    const dropTag = (id, tag) => { const b = get(id); if (!b) return; const tags = String(b.tags || "").split(/[\s,]+/).filter(Boolean); if (!tags.includes(tag)) return say(`· ok ${id} (no tag ${tag})`); b.tags = tags.filter(t => t !== tag).join(" "); changes++; say(`🏷 ${id}: −tag ${tag}`); };
    const setDC = (id, labelRe, dc) => { const b = get(id); if (!b) return; for (const c of (b.choices || [])) { if (!c || !labelRe.test(String(c.label || "")) || !c.checkStat) continue; if (Number(c.checkDC) === dc) { say(`· ok ${id} "${c.label}" DC ${dc}`); continue; } c.checkDC = dc; changes++; say(`🎯 ${id}: "${c.label}" DC → ${dc}`); } };
    const dropPhaseAdvance = (id) => { const b = get(id); if (!b) return; if (b.worldEffects && b.worldEffects.phaseAdvance) { delete b.worldEffects.phaseAdvance; changes++; say(`⚙ ${id}: phaseAdvance removed`); } else say(`· ok ${id} no phaseAdvance`); };
    // hex-enter openers: campaign.hexOverrides[uuid].onEnterBeatIds (tried in order; gated beats fall through)
    const norm = (x) => String(x || "").replace(/[\s ]+/g, " ").trim().toLowerCase();
    const hexUuid = (name) => { for (const sc of (game.scenes || [])) for (const d of (sc.drawings || [])) { const tf = d.flags?.["bbttcc-territory"]; if (tf && (tf.isHex === true || tf.kind === "territory-hex") && norm(tf.name) === norm(name)) return `Scene.${sc.id}.Drawing.${d.id}`; } return null; };
    const onEnter = (hexName, beatIds) => { const u = hexUuid(hexName); if (!u) return say(`✗ hex '${hexName}' not found on any map — on-enter for [${beatIds.join(", ")}] not set`); camp.hexOverrides = camp.hexOverrides || {}; const row = camp.hexOverrides[u] = camp.hexOverrides[u] || {}; const cur = Array.isArray(row.onEnterBeatIds) ? row.onEnterBeatIds : (row.onEnterBeatId ? [row.onEnterBeatId] : []); const want = [...beatIds, ...cur.filter(id => !beatIds.includes(id))]; if (eq(cur, want)) return say(`· ok on-enter ${hexName}`); row.onEnterBeatIds = want; changes++; say(`📍 on-enter ${hexName} = [${want.join(", ")}]`); };
    const placeAt = (id, hexName) => setField(id, "hexName", hexName);

    // S1 ── the Widening Trail
    setStory("map_burnt_flats_intro", { quest: "widening_trail", chapter: "the_burnt_flats", role: "start" });
    setStory("map_burnt_flats_pattern", { quest: "widening_trail", chapter: "the_burnt_flats", role: "ending", ending: "pattern" });
    setStory("map_burnt_flats_partial", { quest: "widening_trail", chapter: "the_burnt_flats", role: "ending", ending: "partial" });
    setStory("map_legansus_waystation_verified", { quest: "widening_trail", chapter: "legansus_waystation", role: "ending", ending: "verified", alsoEnds: [{ quest: "widening_trail", ending: "verified" }] });
    setStory("map_legansus_waystation_flagged", { quest: "widening_trail", chapter: "legansus_waystation", role: "ending", ending: "flagged", alsoEnds: [{ quest: "widening_trail", ending: "flagged" }] });
    for (const [id, hex] of [["map_rotating_chapel_approach", "The Rotating Chapel"], ["map_burnt_flats_intro", "The Burnt Flats"], ["map_singing_mire_intro", "The Singing Mire"], ["map_anchor_reach_intro", "The Anchor Reach"], ["map_port_kudzu_intro", "Port Kudzu"], ["map_legansus_waystation_intro", "Legansus Waystation"]]) { placeAt(id, hex); onEnter(hex, [id]); }
    dropTag("map_rotating_chapel_approach", "inject.travel_threshold");
    // the road is the order: each site waits for the previous site's chapter to END (any of its endings); the legacy
    // `complete` rows the intros carried (they ended the PREVIOUS chapter on arrival, unplayed) come off
    const gateOn = (id, endings) => setReq(id, [{ flag: "storyPhase", gte: 3 }, { anyOf: endings.map(e => ({ beatMark: e })) }]);
    gateOn("map_burnt_flats_intro", ["map_rotating_chapel_map", "map_rotating_chapel_force", "map_rotating_chapel_harmonize"]);
    gateOn("map_singing_mire_intro", ["map_burnt_flats_pattern", "map_burnt_flats_partial"]);
    gateOn("map_anchor_reach_intro", ["map_singing_mire_truth", "map_singing_mire_counter", "map_singing_mire_partial"]);
    gateOn("map_port_kudzu_intro", ["map_anchor_reach_stabilize", "map_anchor_reach_break"]);
    gateOn("map_legansus_waystation_intro", ["map_port_kudzu_testimony", "map_port_kudzu_partial"]);
    for (const id of ["map_rotating_chapel_approach", "map_burnt_flats_intro", "map_singing_mire_intro", "map_anchor_reach_intro", "map_port_kudzu_intro", "map_legansus_waystation_intro"]) { const b = get(id); if (!b) continue;
      if (b.story && (b.story.alsoEnds || b.story.alsoStarts)) { const { alsoEnds, alsoStarts, ...rest } = b.story; b.story = rest; changes++; say(`⚙ ${id}: story alsoEnds/alsoStarts removed (an arrival ends nothing)`); } const rows = b.worldEffects?.questEffects; if (Array.isArray(rows) && rows.some(r => r && /^complete/.test(String(r.action || "")))) { b.worldEffects.questEffects = rows.filter(r => !(r && /^complete/.test(String(r.action || "")))); changes++; say(`⚙ ${id}: legacy 'complete' quest effects removed`); } else say(`· ok ${id} no legacy complete`); }

    // S2 ── the Hidden Vault
    dropTag("enc_hidden_vault_approach", "inject.travel_threshold");
    placeAt("enc_hidden_vault_approach", "PolygonWood.a"); onEnter("PolygonWood.a", ["enc_hidden_vault_approach"]);
    retarget("enc_hidden_vault_gilbert", /^negotiate/i, "gilbert_theater_parley");
    retarget("enc_hidden_vault_gilbert", /^fight/i, "gilbert_theater_fight");
    addChoice("gilbert_theater_fight", ch("Finish it — no more opening nights", "enc_hidden_vault_resolution_hostile", { description: "The broom falls. The lights stay dark." }));
    setStory("gilbert_theater_resolution", { quest: "hidden_vault", role: "closer", ending: "good" });
    setStory("enc_hidden_vault_resolution_good", { quest: "hidden_vault" });   // superseded by the Bijou's resolution; stays as a GM aside
    for (const id of ["gilbert_theater_intro", "gilbert_theater_fight", "gilbert_theater_parley", "gilbert_theater_parley_fail"]) setStory(id, { quest: "hidden_vault" });

    // S3 ── the Balcones
    setStory("balcones_faulting_you_line_opening", { quest: "balcones", role: "start" });
    setStory("balcones_faulting_you_line_choices", { quest: "balcones" });
    setField("balcones_faulting_you_line_choices", "description", "The fault line is still moving. It has not run out of feelings, and you have not run out of approaches. Try another.");
    placeAt("balcones_faulting_you_line_opening", "Saltwake Reach j"); onEnter("Saltwake Reach j", ["balcones_faulting_you_line_opening"]);

    // S4 ── the Flooded Towns
    retarget("hod_flooded_probably_beaumont_stabilize", /^continue/i, "hod_flooded_maybe_beaumont");
    retarget("hod_flooded_probably_beaumont_surge", /^continue/i, "hod_flooded_maybe_beaumont");
    retarget("hod_flooded_maybe_beaumont_interrupt", /^continue/i, "hod_flooded_bedlam_barrens");
    retarget("hod_flooded_maybe_beaumont_escalate", /^continue/i, "hod_flooded_bedlam_barrens");
    for (const [id, hex] of [["hod_flooded_probably_beaumont", "Probably Beaumont"], ["hod_flooded_maybe_beaumont", "Maybe Beaumont?"], ["hod_flooded_bedlam_barrens", "Bedlam Barrens"]]) { placeAt(id, hex); onEnter(hex, [id]); }

    // S5 ── the Lost Statues
    placeAt("spark_geburah_northreach_b", "Northreach Expanse b"); onEnter("Northreach Expanse b", ["spark_geburah_northreach_b"]);
    placeAt("spark_geburah_mountains_q", "Inconvenient Mountains.q"); for (const id of ["spark_geburah_confer_2_clean", "spark_geburah_confer_2_bloodied"]) placeAt(id, "Inconvenient Mountains.q");
    onEnter("Inconvenient Mountains.q", ["spark_geburah_confer_2_clean", "spark_geburah_confer_2_bloodied", "spark_geburah_mountains_q"]);
    placeAt("spark_geburah_mountains_o", "Inconvenient Mountains.o"); for (const id of ["spark_geburah_confer_3_unanimous", "spark_geburah_confer_3_divided"]) placeAt(id, "Inconvenient Mountains.o");
    onEnter("Inconvenient Mountains.o", ["spark_geburah_confer_3_unanimous", "spark_geburah_confer_3_divided", "spark_geburah_mountains_o"]);

    // S6 ── the Fifteen-Year Siege
    setStory("siege_join", { quest: "fifteen_year_siege", role: "closer", ending: "join" });
    addReq("siege_doors", { beatMark: "siege_commander_camp" }); addReq("siege_doors", { beatMark: "siege_commander_town" });
    placeAt("siege_market_day", "Perspicacity Fortress"); onEnter("Perspicacity Fortress", ["siege_market_day"]);

    // S7 ── A Gift: a placeless Word
    setField("trojan_arrival", "where", "anywhere");
    { const b = get("trojan_arrival"); if (b) { const tags = String(b.tags || "").split(/[\s,]+/).filter(Boolean); if (!tags.includes("word")) { b.tags = [...tags, "word"].join(" "); changes++; say("🏷 trojan_arrival: +tag word"); } else say("· ok trojan_arrival tag"); } }

    // S8 ── the Crown Mall
    dropTag("enc_forgotten_yesterdays_approach", "inject.travel_threshold"); dropTag("enc_forgotten_yesterdays_donny_approach", "inject.travel_threshold");
    placeAt("enc_forgotten_yesterdays_approach", "Crown Mall"); onEnter("Crown Mall", ["enc_forgotten_yesterdays_approach"]);
    placeAt("map_crown_mall_intro", "Crown Mall");
    // the archive is the Act 4 DOOR, not the mall's close: with "the spine seals, the asides stay" a close at the archive would seal
    // the Tanneritos hub and the mall's life behind it. The mall closes at its TERMS (the chapter's ending is the quest's ending).
    setStory("map_crown_mall_corroboration", { quest: "crown_mall" }); setStory("map_crown_mall_partial", { quest: "crown_mall" });
    setStory("enc_forgotten_yesterdays_resolution_good", { quest: "crown_mall", chapter: "the_mall_of_forgotten_yesterdays", role: "ending", ending: "good", alsoEnds: [{ quest: "crown_mall", ending: "good" }] });
    setStory("enc_forgotten_yesterdays_resolution_neutral", { quest: "crown_mall", chapter: "the_mall_of_forgotten_yesterdays", role: "ending", ending: "neutral", alsoEnds: [{ quest: "crown_mall", ending: "neutral" }] });
    setStory("enc_forgotten_yesterdays_resolution_bad", { quest: "crown_mall", chapter: "the_mall_of_forgotten_yesterdays", role: "ending", ending: "bad", alsoEnds: [{ quest: "crown_mall", ending: "bad" }] });
    setReq("map_crown_mall_intro", [{ flag: "storyPhase", gte: 3 }, { anyOf: [{ beatMark: "map_legansus_waystation_verified" }, { beatMark: "map_legansus_waystation_flagged" }] }]);   // the Act 4 door: Act 3's evidence, carried here
    // the mall's ENTRANCE is the end of Act 3 (Donny, the Tanneritos, the skate) — the archive behind them opens Act 4; the mall's life (hub, terms, the three talk-NPCs) stays Act 4
    for (const id of ["enc_forgotten_yesterdays_approach", "enc_forgotten_yesterdays_donny_approach", "enc_forgotten_yesterdays_donny_observe", "enc_forgotten_yesterdays_donny_parley", "enc_forgotten_yesterdays_donny_respect", "enc_forgotten_yesterdays_donny_weird", "enc_forgotten_yesterdays_donny_pushy", "enc_forgotten_yesterdays_donny_mixed", "enc_forgotten_yesterdays_donny_good", "enc_forgotten_yesterdays_donny_bad_vibes", "enc_forgotten_yesterdays_donny_withdraw", "enc_forgotten_yesterdays_tanneritos", "enc_forgotten_yesterdays_tanneritos_friendly", "enc_forgotten_yesterdays_tanneritos_intrigue", "enc_forgotten_yesterdays_tanneritos_hostile", "enc_forgotten_yesterdays_skate", "enc_forgotten_yesterdays_skate_success", "enc_forgotten_yesterdays_skate_mixed", "enc_forgotten_yesterdays_skate_failure", "map_crown_mall_corroboration", "map_crown_mall_partial"]) {
      const b = get(id); if (!b) continue; const rs = Array.isArray(b.inject?.requires) ? b.inject.requires : []; const r = rs.find(x => x && x.flag === "storyPhase" && Number(x.gte) === 4); if (r) { r.gte = 3; changes++; say(`⛩ ${id}: storyPhase ≥ 4 → ≥ 3 (the mall's door is Act 3's end)`); } else say(`· ok ${id} act gate`); }

    // S9 ── the Maneuver Vault
    setReq("fc_mara_pip_summons", [{ flag: "storyPhase", gte: 4 }, { questBucket: "quest_7V8Shz2S0EtDaHSS", is: "completed" }, { questBucket: "quest_NwiADv8ZDoklqwEJ", isNot: "active" }, { questBucket: "quest_NwiADv8ZDoklqwEJ", isNot: "completed" }]);
    setDC("maneuver_vault_slippage_chamber", /./, 25);
    placeAt("maneuver_vault_approach", "Hexen Myre.c"); onEnter("Hexen Myre.c", ["maneuver_vault_approach"]);   // the concrete hill (owner, 2026-09-20)

    // S10 ── the Ninth Guest
    setStory("founders_garden_approach", { quest: "ninth_guest", role: "start" });
    setStory("founders_garden_the_count", { quest: "ninth_guest" });
    setStory("founders_garden_the_plinth", { quest: "ninth_guest", role: "closer", ending: "nine" });
    placeAt("founders_garden_approach", "Founder's Garden"); onEnter("Founder's Garden", ["founders_garden_approach"]);

    // S11 ── the Finale
    placeAt("raid_thatwards_ho_finale_entry", "Inconvenient Mountains.h"); onEnter("Inconvenient Mountains.h", ["raid_thatwards_ho_finale_entry"]);
    setStory("raid_thatwards_outcome_friends", { quest: "finale" }); setStory("raid_thatwards_outcome_neutral_spark", { quest: "finale" });
    setStory("raid_thatwards_rewards_major", { quest: "finale", role: "closer", ending: "rewards_major" });
    setStory("raid_thatwards_rewards_standard", { quest: "finale", role: "closer", ending: "rewards_standard" });
    setStory("raid_thatwards_rewards_intel_only", { quest: "finale", role: "closer", ending: "rewards_intel_only" });
    dropPhaseAdvance("raid_thatwards_outcome_friends"); dropPhaseAdvance("raid_thatwards_rewards_major");

    // S12 ── Act 6 opens on any finale ending
    if (!byId.get("a6_title_card")) {
      const nb = { id: "a6_title_card", label: "THATWARDS HO! — Act Six", type: "dialog", questId: "quest_thatwards_ho_finale", questStep: 999,   // legacy order: the finale's last card (the story declares it Gloomgill's) timeScale: "scene", tags: "spine title", politicalTags: "", outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" },
        story: { quest: "gloomgill" }, where: "anywhere",
        inject: { repeatable: false, requires: [{ flag: "storyPhase", gte: 5 }, { anyOf: [{ beatMark: "raid_thatwards_rewards_major" }, { beatMark: "raid_thatwards_rewards_standard" }, { beatMark: "raid_thatwards_rewards_intel_only" }, { beatMark: "raid_thatwards_outcome_neutral_fail" }, { beatMark: "raid_thatwards_outcome_hostile_fail" }] }] },
        worldEffects: { territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], phaseAdvance: { set: 6 } },
        playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, playerFacing: true, refs: {},
        description: "However the sky came down, it came down. The Spark is somebody's now, or nobody's; the paper behind the Valhaulans has a shape, or a scar where a shape should be. The frontier counts what it kept.\n\nThe projector hums one last time over the Frontier Formerly Known As Texas:\n\n<b>A C T &nbsp; S I X &nbsp; — &nbsp; T H E &nbsp; E X A M</b>\n\nA mile before the river the birds stop. Something that taught the first cities how to be cities has a few questions about what you did with yours.\n\n⚙ GM: this beat raises the story to <b>Act 6</b>. Gloomgill is waiting in the Odaroloc.",
        choices: [ch("Onward", "")] };
      const at = (camp.beats || []).findIndex(b => b?.id === "gloomgill_intro"); if (at >= 0) camp.beats.splice(at, 0, nb); else camp.beats.push(nb); byId.set(nb.id, nb); changes++; say("＋ a6_title_card (THATWARDS HO! — Act Six; phaseAdvance 6, waits on any finale ending)");
    } else say("· ok a6_title_card exists");

    // S13 ── Gloomgill knows the answers before he asks
    for (let i = 1; i <= 10; i++) setField(`gloomgill_question_${i}`, "storeFacts", true);
    placeAt("gloomgill_intro", "Odaroloc River.c"); onEnter("Odaroloc River.c", ["gloomgill_intro"]);

    // S14 ── scenes: entering the hex launches the beat, the beat launches the scene
    const sceneId = (name, fallbackId) => (game.scenes?.find?.(sc => sc.name === name) || null)?.id || (game.scenes?.get?.(fallbackId) ? fallbackId : null) || fallbackId;
    const bindScene = (ids, name, fallbackId) => { const sid = sceneId(name, fallbackId); if (!sid) return say(`✗ scene '${name}' not found`); for (const id of ids) { const b = get(id); if (!b) continue; if (b.sceneId === sid) { say(`· ok ${id} scene ${name}`); continue; } b.sceneId = sid; changes++; say(`🎬 ${id}: scene = ${name}`); } };
    bindScene(["hod_flooded_probably_beaumont", "hod_flooded_probably_beaumont_stabilize", "hod_flooded_probably_beaumont_surge", "hod_flooded_probably_beaumont_ride_fail"], "Hex Flooded Town 1", "8EyrUn6kViWV6PgZ");
    bindScene(["hod_flooded_maybe_beaumont", "hod_flooded_maybe_beaumont_interrupt", "hod_flooded_maybe_beaumont_escalate", "hod_flooded_maybe_beaumont_ride_fail"], "hex_flooded_town_2", "b8TGUizrrJuwsc1C");
    bindScene(["hod_flooded_bedlam_barrens", "hod_flooded_bedlam_barrens_ground", "hod_flooded_bedlam_barrens_break", "hod_flooded_bedlam_barrens_break_fail", "spark_hod_echoes_reconstituting"], "hex_flooded_town_3", "WeNRc19bkkQvpVJJ");
    bindScene(["enc_forgotten_yesterdays_approach", "enc_forgotten_yesterdays_donny_approach", "enc_forgotten_yesterdays_donny_observe", "enc_forgotten_yesterdays_donny_parley", "enc_forgotten_yesterdays_donny_respect", "enc_forgotten_yesterdays_donny_weird", "enc_forgotten_yesterdays_donny_pushy", "enc_forgotten_yesterdays_donny_mixed", "enc_forgotten_yesterdays_donny_good", "enc_forgotten_yesterdays_donny_bad_vibes", "enc_forgotten_yesterdays_donny_withdraw"], "Donny", "pkjgY0382z2Jzzds");
    bindScene(["enc_forgotten_yesterdays_tanneritos", "enc_forgotten_yesterdays_tanneritos_friendly", "enc_forgotten_yesterdays_tanneritos_intrigue", "enc_forgotten_yesterdays_tanneritos_hostile", "enc_forgotten_yesterdays_skate", "enc_forgotten_yesterdays_skate_success", "enc_forgotten_yesterdays_skate_mixed", "enc_forgotten_yesterdays_skate_failure", "enc_forgotten_yesterdays_hub", "enc_forgotten_yesterdays_vhs_ghosts", "enc_forgotten_yesterdays_vhs_lean_in", "enc_forgotten_yesterdays_vhs_fail", "enc_forgotten_yesterdays_vhs_mock", "enc_forgotten_yesterdays_escalator", "enc_forgotten_yesterdays_escalator_success", "enc_forgotten_yesterdays_escalator_mixed", "enc_forgotten_yesterdays_escalator_fail", "enc_forgotten_yesterdays_elefem", "enc_forgotten_yesterdays_elefem_success", "enc_forgotten_yesterdays_elefem_mixed", "enc_forgotten_yesterdays_elefem_fail", "enc_forgotten_yesterdays_resolution", "enc_forgotten_yesterdays_resolution_good", "enc_forgotten_yesterdays_resolution_neutral", "enc_forgotten_yesterdays_resolution_bad"], "crown_mall_food_court_pov_1", "Qa8fnrZWZRHGHOjn");
    bindScene(["map_crown_mall_intro", "map_crown_mall_corroboration", "map_crown_mall_partial"], "crown_mall_food_court_pov_2", "KFQK0Rb4qBSUWBeF");
    bindScene(["enc_forgotten_yesterdays_kickflip_lazarus_intro", "enc_forgotten_yesterdays_kickflip_lazarus_1", "enc_forgotten_yesterdays_kickflip_lazarus_2", "enc_forgotten_yesterdays_kickflip_lazarus_3", "enc_forgotten_yesterdays_kickflip_lazarus_4", "enc_forgotten_yesterdays_kickflip_lazarus_5", "enc_forgotten_yesterdays_kickflip_lazarus_runback", "enc_forgotten_yesterdays_kickflip_lazarus_runback_success", "enc_forgotten_yesterdays_kickflip_lazarus_runback_fail", "enc_forgotten_yesterdays_kickflip_lazarus_echo"], "crown_mall_kickflip_lazarus_halfpipe_top_view_pov", "glPwKQepJibWdCU2");
    bindScene(["enc_forgotten_yesterdays_laser_bev_intro", "enc_forgotten_yesterdays_laser_bev_1", "enc_forgotten_yesterdays_laser_bev_2", "enc_forgotten_yesterdays_laser_bev_3", "enc_forgotten_yesterdays_laser_bev_4", "enc_forgotten_yesterdays_laser_bev_5", "enc_forgotten_yesterdays_laser_bev_terms", "enc_forgotten_yesterdays_laser_bev_echo"], "crown_mall_lazer_bev_office_pov", "KOZMFN4vcDF7tKyg");
    bindScene(["enc_forgotten_yesterdays_miss_june_intro", "enc_forgotten_yesterdays_miss_june_1", "enc_forgotten_yesterdays_miss_june_2", "enc_forgotten_yesterdays_miss_june_3", "enc_forgotten_yesterdays_miss_june_4", "enc_forgotten_yesterdays_miss_june_5", "enc_forgotten_yesterdays_miss_june_inventory", "enc_forgotten_yesterdays_miss_june_echo"], "crown_mall_ms_june_store_pov", "cxLnzyDMkaE3Yadg");

    // S15 ── THE STORY TEACHES (owner ruling 2026-09-21): recipes are learned through beats; emotional ingredients are
    // RECEIPTS. worldEffects.recipeGrants = [{ name, to: "coalition" }]; worldEffects.receipts = [{ label, effectKey,
    // truth, ingredientKey }] (the Forge spends the Receipt as that material). Idempotent by row.
    const addFx = (id, key, row) => { const b = get(id); if (!b) return; b.worldEffects = b.worldEffects || {}; const arr = Array.isArray(b.worldEffects[key]) ? b.worldEffects[key] : (b.worldEffects[key] = []); const sig = (r) => JSON.stringify(key === "recipeGrants" ? [r.name] : [r.label]); if (arr.some(r => sig(r) === sig(row))) return say(`· ok ${id} ${key} ${sig(row)}`); arr.push(row); changes++; say(`📖 ${id}: +${key} ${sig(row)}`); };
    const teach = (id, names) => { for (const name of names) addFx(id, "recipeGrants", { name, to: "coalition" }); };
    const receipt = (id, label, truth) => addFx(id, "receipts", { label, effectKey: "rollPlus2", truth, ingredientKey: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") });
    const MALL_WARES = ["Apology Knife, Mass-Produced", "Boots That Knew Each Other Once", "Buc-ee's Beaver Talisman (Tarnished Gold)", "Foam Finger (Structural)", "Pre-Shattering Concert T-Shirt (XL)", "STAY IN MILK Embroidered Tea Towel", "S'narchy Burger Mascot's Final Smile", "S'narchy Burger Spatula of +1 Sass", "S'narchy Burger Special Sauce (Sealed Packet, Pre-Fall)", "Scarf That Was a Cat (Probably)", "Texas-Shaped Belt Buckle of Mild Authority", "The Apologizing Burger", "The Last Working Vending Machine in Bad Eden (Portable Kit)", "Whataburger Coupon, Unredeemed (Vintage)"];
    const SNARCHY = ["S'narchy Burger Spatula of +1 Sass", "S'narchy Burger Special Sauce (Sealed Packet, Pre-Fall)", "S'narchy Burger Mascot's Final Smile", "The Apologizing Burger"];
    const YESODIC = ["Yesodic Edge", "Yesodic Plating", "Yesodic Hammer of the First Word", "Yesodic Gate Frame", "Yesodic Memory Lens", "Yesodic Sigil of the Hearthward", "Yesodium Tongue-Stud"];
    // the Mall: real access teaches every ware; an uncommitted vibe teaches the S'narchy counter; Kickflip teaches what he wears
    teach("enc_forgotten_yesterdays_resolution_good", MALL_WARES);
    teach("enc_forgotten_yesterdays_resolution_neutral", SNARCHY);
    teach("enc_forgotten_yesterdays_kickflip_lazarus_5", ["Boots That Knew Each Other Once", "Pre-Shattering Concert T-Shirt (XL)"]);
    // the Seal restored teaches the yesodic line; redirected, the memory lens and the sigil only
    teach("khezek_tor_the_vaulhaulan_seal_restore", YESODIC);
    teach("khezek_tor_the_vaulhaulan_seal_redirect", ["Yesodic Memory Lens", "Yesodic Sigil of the Hearthward"]);
    // the Vault's archive teaches the pavise; the finale's spoils teach the mantles and the aegis
    for (const id of ["maneuver_vault_the_containment_loop", "maneuver_vault_the_containment_loop_let_pip_learn", "maneuver_vault_the_containment_loop_let_pip_learn_more"]) teach(id, ["Mirrorface Pavise"]);
    teach("raid_thatwards_rewards_major", ["Aegis of the Final Door", "Mantle of Witnessed Silence", "Mantle of the Unbroken Circle"]);
    teach("raid_thatwards_rewards_standard", ["Mantle of Witnessed Silence", "Mantle of the Unbroken Circle"]);
    // emotional ingredients — Receipts the Mall and the Bijou hand over
    receipt("enc_forgotten_yesterdays_vhs_lean_in", "Summer Memory", "A tape of a summer nobody here lived through, and every one of you remembers it now.");
    receipt("enc_forgotten_yesterdays_donny_respect", "Small Affection", "Donny decided you were alright. He does not decide that often.");
    receipt("enc_forgotten_yesterdays_donny_withdraw", "Well-Meant Error", "You got it wrong in a way he could tell you meant well. He'll remember the trying.");
    receipt("enc_forgotten_yesterdays_tanneritos_friendly", "Team Spirit", "The Tanneritos put you on the team. There is a chant. You know the chant.");
    receipt("enc_forgotten_yesterdays_tanneritos_intrigue", "Two Different Stories", "Two tapes of the same night. Neither is lying. Both are wrong.");
    receipt("enc_forgotten_yesterdays_skate_success", "Mascot Energy", "The halfpipe crowd gave you a name. It is not a good name. It is yours.");
    receipt("enc_forgotten_yesterdays_skate_failure", "Indistinct Rebellion", "You were against something. The mall cops were against you. Nobody wrote down what.");
    receipt("enc_forgotten_yesterdays_escalator_success", "Physics Violation", "The escalator agreed you were important enough to arrive. Something in the math gave way.");
    receipt("enc_forgotten_yesterdays_elefem_success", "Cosmic Petty", "Whimsy, redirected, holds a grudge the size of a food court.");
    receipt("enc_forgotten_yesterdays_laser_bev_3", "Metaphysical Bookkeeping", "Bev showed you the ledger where permanence is a liability. The columns balance. That is the problem.");
    receipt("enc_forgotten_yesterdays_laser_bev_5", "Civic Conscientiousness", "Somebody at this mall still fills out the forms. Bev keeps them. She showed you which drawer.");
    receipt("enc_forgotten_yesterdays_donny_pushy", "Frozen Sarcasm", "Donny's last remark before the door. It has not thawed.");
    receipt("enc_forgotten_yesterdays_donny_good", "Sincere Regret", "Donny apologised for the wall. He meant it, and it cost him.");
    receipt("gilbert_theater_parley", "Patience", "Gilbert has waited since the Shattering for opening night. He lent you some of the waiting.");
    receipt("gilbert_theater_resolution", "Stadium Memory", "The Bijou's last full house, remembered by the building. It gave you a seat.");
    receipt("enc_hidden_vault_replicator_friendly", "Vending Machine Soul", "Lars prints disappointment. Today he printed something that wanted to be bought.");
    receipt("enc_forgotten_yesterdays_kickflip_lazarus_3", "Borderline Irrational State Pride", "Kickflip explained style. It was mostly about Texas. It was entirely sincere.");
    receipt("enc_forgotten_yesterdays_miss_june_inventory", "Memory", "Miss June's stock is memory, shelved. She let you take one down.");
    receipt("enc_forgotten_yesterdays_vhs_ghosts", "Regret", "The ghosts on the tape were sorry about something. Now so are you.");

    // S16 ── THE STORY HANDS OUT DOCTRINE (owner ruling 2026-09-21): the grief towns and the Trail teach the Tier 2
    // civics to the coalition (beat.unlocks.strategics → WME grants the doctrine item to every coalition faction).
    const unlock = (id, keys) => { const b = get(id); if (!b) return; b.unlocks = (b.unlocks && typeof b.unlocks === "object") ? b.unlocks : {}; const cur = Array.isArray(b.unlocks.strategics) ? b.unlocks.strategics : []; const add = keys.filter(k => !cur.includes(k)); if (!add.length) return say(`· ok ${id} unlocks`); b.unlocks.strategics = [...cur, ...add]; changes++; say(`🎓 ${id}: +strategics ${add.join(", ")}`); };
    for (const id of ["chuckle_finale", "chuckle_new_episode"]) unlock(id, ["justice_tribunal"]);
    for (const id of ["soft_landing_go_first", "soft_landing_practice"]) unlock(id, ["propaganda_tour"]);
    for (const id of ["stillwater_ring_the_bell", "stillwater_covenant"]) unlock(id, ["peace_accords"]);
    for (const id of ["map_rotating_chapel_map", "map_rotating_chapel_harmonize"]) unlock(id, ["cultural_exchange"]);
    unlock("map_burnt_flats_pattern", ["reconstruction_drive"]);
    unlock("map_singing_mire_truth", ["spy_insertion"]);
    unlock("map_anchor_reach_stabilize", ["smuggling_network"]);
    unlock("map_port_kudzu_testimony", ["courtly_intrigue_council"]);
    unlock("map_legansus_waystation_verified", ["training_drills"]);

    console.log(`[seed-story-flow-acts-3-6] ${apply ? "APPLY" : "DRY RUN"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
    if (!apply) { ui.notifications.info(`Acts 3–6 seeder DRY RUN: ${changes} change(s) (console).`); return changes; }
    const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-acts-3-6-${Date.now()}.json`);
    await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
    ui.notifications.info(`Acts 3–6 seeder APPLIED: ${changes} change(s). Backup downloaded.`);
    return changes;
  }

  const n = await run(!DRY_RUN);
  if (DRY_RUN && n > 0 && typeof Dialog !== "undefined" && Dialog.confirm) {
    const yes = await Dialog.confirm({ title: "Acts 3–6 seeder", content: `<p>The dry run found <b>${n}</b> change(s) (details in the console).</p><p>Apply them now? A backup of the campaigns setting downloads first.</p>` });
    if (yes) await run(true);
  }
})();
