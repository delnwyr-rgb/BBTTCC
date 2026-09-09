/* patch-act2-town-hubs.macro.js — Act 2 gets its own town hubs (owner ruling 2026-09-09)
 *
 * Ruling: "the walk beats are squarely Act 1" — the act seal now closes them in
 * Act 2. This patch gives Act 2 what it needs to stand on its own:
 *  1. NEW hub `lyrenn_quest_scene` (Act 2 Lyrenn — the Rows, second season).
 *     Khezek-Tor already has `khezek_tor_quest_scene`; Allesh-Gilliam has
 *     `allesh_gilliam_introduction_to_hq`.
 *  2. NEW `lyrenn_word_ride` — a ride beat (openTravel → Lyrenn). Both "Word
 *     from Lyrenn" letters route their "Ride for Lyrenn" choice here instead of
 *     teleporting into a quest-acceptance dialog.
 *  3. Quest ACCEPTANCE beats: every `*acceptance*` beat accepts ITS OWN quest
 *     (10 of 12 accepted nothing; Gentle Pest / Forest accepted the town quest)
 *     and gains a door straight into its investigation beat.
 *  4. Every Act-2+ choice that exited into an Act-1 hub is re-routed to the
 *     town's Act-2 hub (self-routes become "end the dialog").
 *  5. Campaign hexOverrides: Lyrenn / Khezek-Tor / Allesh-Gilliam arrival tries
 *     the Act-2 hub first, then the hex's existing Act-1 on-enter beat
 *     (bbttcc-travel `onEnterBeatIds`, per-act arrival).
 * DRY_RUN default true; idempotent; backs up the campaigns setting to a download.
 * Run as GM with "Thatward's Ho!" active.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign", TERR = "bbttcc-territory";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const api = game.bbttcc?.api?.campaign; const cid = api?.getActiveCampaignId?.();
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error("No active campaign.");
  const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  if (!Array.isArray(camp.beats)) camp.beats = beats;
  const byId = Object.fromEntries(beats.map(b => [b.id, b]));
  const changes = [];
  const reqs = (b) => { const r = b?.inject?.requires; return !r ? [] : (Array.isArray(r) ? r : [r]); };
  const actOf = (b) => { let a = null; for (const r of reqs(b)) if (r && r.flag === "storyPhase" && Number.isFinite(+r.gte)) a = Math.max(a ?? -Infinity, +r.gte); return a; };
  const choice = (label, next, description = "") => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "" });
  const p = (t) => `<p>${t}</p>`;

  // ── 1. Lyrenn Act-2 hub ─────────────────────────────────────────────────
  if (!byId.lyrenn_quest_scene) {
    const anchor = byId.lyrenn_main_scene || {};
    const hub = {
      id: "lyrenn_quest_scene", type: "dialog", label: "Lyrenn — The Rows, Second Season",
      questId: anchor.questId || "quest_JqCdOo0l6X8K2EcE", questStep: 200,
      description: [
        p("Lyrenn has stopped noticing you, which is the highest compliment the rows give. The chimes still argue in the irrigation ditches; the workers still tip a tool as you pass, but now they go straight back to work, because you are furniture here, and furniture gets told things."),
        p("Somebody has been at the east channels with a spade and no manners. Somebody else says the treeline moved in the night and is prepared to swear to it. The field that remembers you has not stopped remembering. Elsin has the ledgers open. Rowan is listening to the ground."),
        p("The Stewards are expected. That is a different thing from being welcome, and better.")
      ].join("\n"),
      choices: [
        choice("The east channels — answer Elsin's word", "lyrenn_the_gentle_pest_acceptance", "Whatever is tearing up the irrigation has a shape. Go and look at it."),
        choice("The fence line — the forest that will not be fought", "lyrenn_forest_will_not_be_fought_quest_acceptance", "The treeline moved. Trees do not do that."),
        choice("The field that remembers you", "lyrenn_the_field_that_remembers_you", "It has not stopped."),
        choice("Water Choir", "lyrenn_water_choir", "Tuning itself to strangers again."),
        choice("Green Ring", "lyrenn_green_ring", "Where Lyrenn talks TO itself, ABOUT itself, in front of itself."),
        choice("Seed Vault", "lyrenn_seed_vault", "Under Elsin's keys."),
        choice("Talk to Elsin Quade", "lyrenn_elsin_quade_convo", "Keeper of the ledgers."),
        choice("Talk to Rowan of the Loam", "lyrenn_rowan_of_the_loam_convo", "Keeper of the listening."),
        choice("Ride on — the road waits", "", "The rows will keep.")
      ],
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 2 }] },
      worldEffects: {}, tags: "lyrenn act2 hub", playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      sceneId: anchor.sceneId || null, speakerActorId: anchor.speakerActorId || null
    };
    const i = beats.findIndex(b => b.id === "lyrenn_main_scene");
    beats.splice(i >= 0 ? i + 1 : beats.length, 0, hub); byId[hub.id] = hub;
    changes.push("NEW hub lyrenn_quest_scene (Act 2 Lyrenn)");
  }
  const HUB_FOR = {   // Act-1 hub → the town's Act-2 hub
    lyrenn_main_scene: "lyrenn_quest_scene", lyrenn_opening_scene: "lyrenn_quest_scene", lyrenn_town_walk: "lyrenn_quest_scene", lyrenn_green_ring_cinematic: "lyrenn_green_ring",
    allesh_gilliam_town_walk: "allesh_gilliam_introduction_to_hq", ag_crossroads_first_rides: "allesh_gilliam_introduction_to_hq", allesh_gilliam_hq_cinematics: "allesh_gilliam_introduction_to_hq", allesh_gilliam_st_gilliams_cinematics: "allesh_gilliam_introduction_to_hq",
    allesh_gilliam_yarrow_welcome: "allesh_gilliam_introduction_to_hq", allesh_gilliam_etta_welcome: "allesh_gilliam_introduction_to_hq",
    khezek_tor_main_scene: "khezek_tor_quest_scene", khezek_tor_town_walk: "khezek_tor_quest_scene"
  };
  for (const v of new Set(Object.values(HUB_FOR))) if (!byId[v]) changes.push(`⚠ Act-2 hub ${v} missing — routes into it will dangle`);

  // ── 2. Ride beat for the Lyrenn letters ─────────────────────────────────
  if (!byId.lyrenn_word_ride) {
    const ride = {
      id: "lyrenn_word_ride", type: "dialog", label: "The Road to Lyrenn — Word Received",
      questId: byId.lyrenn_word_channels?.questId || "quest_JqCdOo0l6X8K2EcE", questStep: 199,
      description: p("The letter is folded into a pocket. The road to Lyrenn is where it always was — Thatwards-by-Green, past the crossroads, along the river's slow bend. Plot the ride on the Travel Console and go and see what the rows are worried about."),
      choices: [choice("🐎 Saddle up — ride for Lyrenn", "", "Run the planned route on the Travel Console."), choice("Not yet — Lyrenn knows how to wait", "", "")],
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 2 }] },
      worldEffects: { openTravel: { hexName: "Lyrenn" } }, tags: "lyrenn word travel", playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
    };
    const i = beats.findIndex(b => b.id === "lyrenn_word_channels");
    beats.splice(i >= 0 ? i + 1 : beats.length, 0, ride); byId[ride.id] = ride;
    changes.push("NEW ride beat lyrenn_word_ride (openTravel → Lyrenn)");
  }
  // Ride-home beat: "Ride back — the other road waits" used to route into the Act-1 Crossroads picker.
  if (!byId.ride_back_home) {
    const home = {
      id: "ride_back_home", type: "dialog", label: "The Road Home",
      questId: byId.allesh_gilliam_introduction_to_hq?.questId || "quest_Cq1v3hJpXarX5rXJ", questStep: 998,
      description: p("The other road waits, the way it always does. Plot the ride on the Travel Console — Allesh-Gilliam, or wherever the ledger says you are needed next."),
      choices: [choice("🐎 Saddle up — ride out", "", "Run the planned route on the Travel Console."), choice("Stay a while longer", "", "")],
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 2 }] },
      worldEffects: { openTravel: { hexName: "Allesh-Gilliam" } }, tags: "travel act2", playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true
    };
    beats.push(home); byId[home.id] = home; changes.push("NEW ride_back_home (openTravel → Allesh-Gilliam)");
  }
  for (const b of beats) for (const ch of (b.choices || [])) if (/^Ride back/i.test(ch.label || "") && ch.next === "ag_crossroads_first_rides") { ch.next = "ride_back_home"; changes.push(`${b.id}: "${ch.label}" → ride_back_home`); }

  for (const wid of ["lyrenn_word_channels", "lyrenn_word_treeline"]) {
    const w = byId[wid]; if (!w) continue;
    for (const ch of (w.choices || [])) if (/^Ride for Lyrenn/i.test(ch.label || "") && ch.next !== "lyrenn_word_ride") { changes.push(`${wid}: "${ch.label}" ${ch.next} → lyrenn_word_ride`); ch.next = "lyrenn_word_ride"; }
  }

  // ── 3. Acceptance beats accept their OWN quest + open the investigation ──
  // Entry beats that are not named "acceptance" but ARE the door (lint Q09, 2026-09-09).
  const ENTRY_ALSO = new Set(["forest_of_tifaret_approach"]);
  for (const b of beats) {
    if (!/acceptance/i.test(b.id) && !/quest acceptance/i.test(b.label || "") && !ENTRY_ALSO.has(b.id)) continue;
    if (!b.questId) { changes.push(`⚠ ${b.id}: no questId — skipped`); continue; }
    b.worldEffects = b.worldEffects || {};
    const qe = Array.isArray(b.worldEffects.questEffects) ? b.worldEffects.questEffects : [];
    const accepts = qe.filter(e => String(e.action || "") === "accept");
    const wrong = accepts.filter(e => e.questId !== b.questId);
    if (wrong.length || !accepts.length) {
      b.worldEffects.questEffects = qe.filter(e => String(e.action || "") !== "accept").concat([{ action: "accept", questId: b.questId, beatId: "", state: "active", text: (accepts[0]?.text) || "The Stewards took the job." }]);
      changes.push(`${b.id}: accepts ${b.questId}${wrong.length ? ` (was ${wrong.map(w => w.questId).join(",")})` : " (was nothing)"}`);
    }
    const base = b.id.replace(/_quest_acceptance$|_acceptance$/, "");
    const target = [base + "_intro", base + "_cinematic", base].filter(t => t !== b.id).find(t => byId[t]);
    if (target && !(b.choices || []).some(c => c.next === target)) {
      b.choices = b.choices || [];
      b.choices.unshift(choice("Go and look now", target, "Straight to it."));
      changes.push(`${b.id}: door → ${target}`);
    }
  }

  // ── 4. Act-2+ exits out of Act-1 hubs → the town's Act-2 hub ─────────────
  let rerouted = 0;
  for (const b of beats) {
    if ((actOf(b) ?? 0) < 2) continue;
    for (const ch of (b.choices || [])) for (const k of ["next", "failNext"]) {
      const t = String(ch[k] || ""); if (!HUB_FOR[t]) continue;
      const hub = HUB_FOR[t]; ch[k] = (hub === b.id) ? "" : hub; rerouted++;
    }
  }
  if (rerouted) changes.push(`${rerouted} Act-2 exit(s) re-routed from Act-1 hubs to Act-2 hubs`);

  // ── 5. Per-act arrival via hexOverrides.onEnterBeatIds ───────────────────
  const ARRIVAL = { "Lyrenn": "lyrenn_quest_scene", "Khezek-Tor": "khezek_tor_quest_scene", "Allesh-Gilliam": "allesh_gilliam_introduction_to_hq" };
  const norm = (s) => String(s || "").replace(/[ \s]+/g, " ").trim().toLowerCase();
  camp.hexOverrides = camp.hexOverrides || {};
  for (const [name, hubId] of Object.entries(ARRIVAL)) {
    let hit = null;
    for (const sc of game.scenes) for (const d of sc.drawings) { const tf = d.flags?.[TERR]; if (tf && (tf.isHex || tf.kind === "territory-hex" || tf.name) && norm(tf.name) === norm(name)) { hit = d; break; } if (hit) break; }
    if (!hit) { changes.push(`⚠ hex "${name}" not found on any scene — arrival override skipped`); continue; }
    const existing = String(hit.flags?.[TERR]?.campaign?.onEnterBeatId || "").trim();
    const rec = camp.hexOverrides[hit.uuid] || {};
    const want = [hubId].concat(existing && existing !== hubId ? [existing] : []);
    if (JSON.stringify(rec.onEnterBeatIds || []) !== JSON.stringify(want)) { camp.hexOverrides[hit.uuid] = Object.assign({}, rec, { onEnterBeatIds: want }); changes.push(`arrival ${name}: [${want.join(" → ")}]`); }
  }

  console.group(`[act2-town-hubs] ${DRY_RUN ? "DRY RUN — " : ""}${changes.length} change(s)`); changes.forEach(c => console.log(" •", c)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Act 2 town hubs DRY RUN: ${changes.length} change(s) in console (F12). Set DRY_RUN=false to apply.`);
  (foundry.utils.saveDataToFile || saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-act2-hubs-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  ChatMessage.create({ whisper: [game.user.id], content: `<b>Act 2 town hubs patched.</b><ul style="font-size:12px">${changes.map(c => `<li>${foundry.utils.escapeHTML(c)}</li>`).join("")}</ul>` });
  ui.notifications.info("Act 2 town hubs applied. Backup downloaded.");
})();
