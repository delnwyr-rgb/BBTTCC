/**
 * patch-town-doors-all-acts-2026-11-02.macro.js — the GM click-through, Act 2 (Dave, 11-02: "I don't think Pike should be a default
 * town hub for AG"). Live-caught: in Act 2 the Allesh-Gilliam hex arrival opened Pike's office (hexOverride onEnterBeatIds =
 * [allesh_gilliam_introduction_to_hq, allesh_gilliam_town_walk]) and the town map's building doors were mostly dead — 13 of the 47
 * map doors in every town either SEALED (their town's quest closed, or "it belongs to Act 1") or Act-1-only cinematics (storyPhase ≤ 1).
 *
 *   1. ALLESH-GILLIAM — THE TOWN (new hub, Act 2+): repeatable + evergreen; doors to the HQ (Pike), the Leygate, the East Wall, the Long
 *      Market, St Gilliam's (Tamsin), the Waiting Room, the Vacancy, the Plumb Office, the Muster, Call it a day, Ride on. It leads the
 *      AG hexOverride arrival (Act 1 still lands on the Welcome Round — the new hub's storyPhase ≥ 2 gate fails first). Pike's office
 *      is the HQ door.
 *   2. Every door beat (a location door's beatId) is inject.evergreen — a door is a place; it never seals with its quest or act.
 *      Sealed exteriors gain "Back to town" (Act 2+) so a door whose inside is done is never a dead end.
 *   3. The three Act-1-only door beats lose their storyPhase ≤ 1 gate; their Act 1 route keeps it, and an Act 2 route joins:
 *      St Gilliam's → Father Tamsin's conversation · Khezek-Tor camp door "Go in" → the KT hub · Lyrenn Green Ring → the Lyrenn hub.
 *      The KT warehouse "Go in" gets the same Act 2 route.
 * Draft-1 prose. Pure apply(camp) + Foundry runner. Idempotent (rerun = 0). DRY_RUN first. Backup → Data/bbttcc-exports/. GM only.
 */
const TOWN_DOORS_PATCH = (() => {
  const HUB = "allesh_gilliam_town_act2";
  const P2 = { flag: "storyPhase", gte: 2 }, P1 = { flag: "storyPhase", lte: 1 };
  const ch = (label, next, description = "", extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const DOOR_BEATS = ["allesh_gilliam_st_gilliams_cinematics", "allesh_gilliam_muster_exterior", "allesh_gilliam_north_gate_exterior", "allesh_gilliam_east_wall_exterior",
    "allesh_gilliam_plumb_tower_exterior", "allesh_gilliam_vacancy_exterior", "allesh_gilliam_long_market_exterior", "allesh_gilliam_leygate_exterior",
    "allesh_gilliam_waiting_room_exterior", "khezek_tor_warehouse_exterior", "khezek_tor_camp_door_exterior", "lyrenn_green_ring_cinematic",
    "lyrenn_low_field_exterior", "fixit_arc_bay_exterior"];
  const BACK = { allesh_gilliam: HUB, khezek_tor: "khezek_tor_quest_scene", lyrenn: "lyrenn_quest_scene", fixit: "fixit_intro_scene" };
  const townOf = (id) => /^allesh_gilliam_|^ag_/.test(id) ? "allesh_gilliam" : /^khezek_tor_|^kt_/.test(id) ? "khezek_tor" : /^lyrenn_/.test(id) ? "lyrenn" : /^fixit_/.test(id) ? "fixit" : null;
  function apply(camp, { doorBeatIds = DOOR_BEATS } = {}) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const byId = new Map(beats.map(b => [String(b?.id), b]));
    const report = [], conflicts = []; let changes = 0;
    const need = ["allesh_gilliam_introduction_to_hq", "allesh_gilliam_town_walk", "allesh_gilliam_father_tamsin_conversation", "khezek_tor_quest_scene", "lyrenn_quest_scene", "days_end_thatwards", "ride_back_home"];
    for (const id of need) if (!byId.has(id)) conflicts.push(`${id}: beat not found`);
    if (conflicts.length) return { changes, report, conflicts };
    const rows = (b) => Array.isArray(b.inject?.requires) ? b.inject.requires : (b.inject?.requires ? [b.inject.requires] : []);
    // 1 · the Act 2 town hub
    if (!byId.has(HUB)) {
      const walk = byId.get("allesh_gilliam_town_walk");
      const hub = {
        id: HUB, label: "Allesh-Gilliam — The Town", type: "dialog", timeScale: "scene", timePoints: 0, questId: walk.questId || "", tags: "allesh_gilliam town hub", politicalTags: "",
        description: "{{#played allesh_gilliam_introduction_to_hq}}Allesh-Gilliam goes about its business, which these days includes you. The chimes are up, the Long Market is arguing about prices, and somebody at the North Gate is pretending not to watch the road.{{else}}Allesh-Gilliam goes about its business, which these days includes you. A runner finds you before you've finished looking around: Pike wants you at the HQ. He said it the way he says everything, which is to say he didn't say please.{{/played}}",
        outcomes: { success: null, failure: null },
        inject: { cooldownTurns: 0, repeatable: true, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ ...P2 }], evergreen: true },
        actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
        storyChain: walk.storyChain || "", priority: "background", story: { quest: "allesh_gilliam" }, where: "Allesh-Gilliam", sceneId: walk.sceneId || "",
        choices: [
          ch("The HQ — Marshal Pike", "allesh_gilliam_introduction_to_hq", "The boards, the map, and the man who reads them."),
          ch("The Leygate — Garren", "allesh_gilliam_leygate_exterior"),
          ch("The East Wall", "allesh_gilliam_east_wall_exterior"),
          ch("The Long Market — Etta Bloom", "allesh_gilliam_long_market_exterior"),
          ch("St Gilliam's — Father Tamsin", "allesh_gilliam_st_gilliams_cinematics"),
          ch("The Waiting Room — Doc Greeley", "allesh_gilliam_waiting_room_exterior"),
          ch("The Vacancy — Verna", "allesh_gilliam_vacancy_exterior"),
          ch("The Plumb Office", "allesh_gilliam_plumb_tower_exterior"),
          ch("The Muster — Captain Brakk", "allesh_gilliam_muster_exterior", "", { requires: [{ questBucket: "quest_ag_town_militia", is: "active" }] }),
          ch("Call it a day", "days_end_thatwards"),
          ch("Ride on — the road waits", "ride_back_home")
        ],
        worldEffects: {}
      };
      beats.push(hub); byId.set(HUB, hub); changes++; report.push(`✚ beat ${HUB} (Act 2+ town hub)`);
    } else report.push(`· ok beat ${HUB}`);
    // AG arrival: the town hub leads; Pike's office leaves the arrival list
    for (const [k, ov] of Object.entries(camp.hexOverrides || {})) {
      const ids = Array.isArray(ov?.onEnterBeatIds) ? ov.onEnterBeatIds : null; if (!ids || !ids.includes("allesh_gilliam_town_walk")) continue;
      const want = [HUB, ...ids.filter(x => x !== HUB && x !== "allesh_gilliam_introduction_to_hq")];
      if (JSON.stringify(ids) !== JSON.stringify(want)) { ov.onEnterBeatIds = want; changes++; report.push(`✚ hexOverride ${k}: arrival = ${want.join(", ")}`); } else report.push(`· ok hexOverride ${k}`);
    }
    // 2 + 3 · the doors
    for (const id of doorBeatIds) {
      const b = byId.get(id); if (!b) { report.push(`⚠ door beat ${id} not in this world`); continue; }
      b.inject = b.inject || {};
      if (b.inject.evergreen !== true) { b.inject.evergreen = true; changes++; report.push(`✚ ${id}: evergreen`); }
      const r = rows(b); const lte = r.findIndex(x => x && x.flag === "storyPhase" && x.lte != null);
      const town = townOf(id); const back = BACK[town];
      if (lte >= 0) {
        b.inject.requires = r.filter((_, i) => i !== lte); changes++; report.push(`✚ ${id}: storyPhase ≤ ${r[lte].lte} gate removed (the door works in every act)`);
        // its Act 1 routes keep Act 1; an Act 2 route joins
        for (const c of (b.choices || [])) { const t = byId.get(String(c?.next || "")); const tl = t ? rows(t).some(x => x?.flag === "storyPhase" && x.lte != null) : false; if (tl && !(c.requires || []).some?.(x => x?.lte != null)) { c.requires = [...(Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : [])), { ...P1 }]; changes++; report.push(`✚ ${id} "${c.label}": Act 1 only`); } }
      }
      // Act 2 route for doors whose way in is an Act 1 walk
      const act2 = id === "allesh_gilliam_st_gilliams_cinematics" ? ch("The kettle is warm — find Father Tamsin", "allesh_gilliam_father_tamsin_conversation", "", { requires: [{ ...P2 }] })
        : (id === "khezek_tor_camp_door_exterior" || id === "khezek_tor_warehouse_exterior") ? ch("Go in", "khezek_tor_quest_scene", "", { requires: [{ ...P2 }] })
        : id === "lyrenn_green_ring_cinematic" ? ch("Back to the rows", "lyrenn_quest_scene", "", { requires: [{ ...P2 }] }) : null;
      if (act2) {
        b.choices = Array.isArray(b.choices) ? b.choices : [];
        if (!b.choices.some(c => c && c.next === act2.next && (c.requires || []).some?.(x => x?.gte === 2))) {
          // the Act 1 twin of the same label, if any, becomes Act 1 only
          for (const c of b.choices) if (c && c.label === act2.label && c.next !== act2.next && !(c.requires || []).some?.(x => x?.lte != null)) { c.requires = [...(Array.isArray(c.requires) ? c.requires : (c.requires ? [c.requires] : [])), { ...P1 }]; changes++; report.push(`✚ ${id} "${c.label}" → ${c.next}: Act 1 only`); }
          b.choices.push(act2); changes++; report.push(`✚ ${id}: "${act2.label}" → ${act2.next} (Act 2+)`);
        }
      }
      // never a dead end: a way back to the town (Act 2+)
      if (back && back !== id) {
        b.choices = Array.isArray(b.choices) ? b.choices : [];
        if (!b.choices.some(c => c && c.next === back)) { b.choices.push(ch(town === "lyrenn" ? "Back to the rows" : town === "fixit" ? "Back to the yard" : "Back to town", back, "", { requires: [{ ...P2 }] })); changes++; report.push(`✚ ${id}: way back → ${back} (Act 2+)`); }
      }
    }
    return { changes, report, conflicts };
  }
  return { apply, DOOR_BEATS, HUB };
})();
if (typeof game === "undefined" && typeof module !== "undefined") { module.exports = TOWN_DOORS_PATCH; }
else (async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  // every live location door's beat joins the list (worlds differ)
  let doorBeatIds = TOWN_DOORS_PATCH.DOOR_BEATS.slice();
  try { const arr = await game.bbttcc.api.travel.doors.list(); for (const d of (Array.isArray(arr) ? arr : Object.values(arr || {}))) if (d?.beatId && !doorBeatIds.includes(d.beatId)) doorBeatIds.push(d.beatId); } catch (_e) {}
  const { changes, report, conflicts } = TOWN_DOORS_PATCH.apply(camp, { doorBeatIds });
  console.log(`[town doors all acts 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__townDoors = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes || conflicts.length) return ui.notifications.info(conflicts.length ? "Conflicts — nothing written." : "Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {} await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-town-doors-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false }); } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — every door works in every act; AG arrives on the town.`);
})();
