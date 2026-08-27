/**
 * patch-crossroads-travel.macro.js — GM macro/console. DRY_RUN default true.
 *
 * "We yadayadayada'd the travel!" (owner, 2026-08-24). The Crossroads rides
 * teleported straight to each settlement's intro beat. Now the ride is real:
 *
 *  1. Three NEW ride beats (ag_ride_khezek_tor / ag_ride_lyrenn /
 *     ag_ride_fixit) with worldEffects.openTravel — firing one returns to
 *     the world-hub map, opens the Travel Console, and names the
 *     destination. Legs, encounters, weather: the travel engine's show.
 *  2. Crossroads choices re-route to the ride beats.
 *  3. ARRIVAL: campaign.hexOverrides[hexUuid].onEnterBeatId = the
 *     settlement intro beat — entering the destination hex fires the
 *     welcome (hex_enter injector, oncePerHex). Hexes are matched by
 *     territory-flag/label name (NBSP-safe); every match is reported, and
 *     an ambiguous or missing town is SKIPPED loudly, never guessed.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;

  const cross = byId.get("ag_crossroads_first_rides");
  if (!cross) return ui.notifications.error("Crossroads beat missing — run patch-spine-gaps first.");
  const AGQ = cross.questId || null;

  const TOWNS = [
    { key: "khezek", rideId: "ag_ride_khezek_tor", hexPatterns: [/khezek/i],
      introId: "khezek_tor_main_scene", hexName: "Khezek-Tor",
      label: "The Road Thatwards-by-North",
      desc: "Boots in stirrups, coffee in the blood. The road to <b>Khezek-Tor</b> climbs out of the green and into country that clinks when the wind moves it. Smelter-glow on the underside of the clouds, and something in the rock that hums back if you hum first.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet." },
    { key: "lyrenn", rideId: "ag_ride_lyrenn", hexPatterns: [/lyrenn/i],
      introId: "lyrenn_opening_scene", hexName: "Lyrenn",
      label: "The Road Thatwards-by-Green",
      desc: "The road to <b>Lyrenn</b> doesn't so much go as it is <i>permitted</i>. Hedgerows lean in to look at you. Somewhere out in the fields, something waves — friendly, probably.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet." },
    { key: "fixit", rideId: "ag_ride_fixit", hexPatterns: [/fixit/i, /furrier/i, /farrier/i],
      introId: "fixit_intro_scene", hexName: "Furrier's Fixit Farm",
      label: "The Road to the Fixit Farm",
      desc: "The sign said <b>WE FIX IT (MOSTLY)</b> and the road agrees with the parenthetical. Gullywasher weather over the low country, and the smell of solder and wet dog getting stronger by the mile.\n\n⚙ Plot the ride on the Travel Console — the road decides what you meet." }
  ];

  /* ── Hex matching: territory-flagged drawings across scenes, NBSP-safe ── */
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  const hexRows = [];
  for (const scene of (game.scenes?.contents || [])) {
    for (const d of (scene.drawings?.contents || [])) {
      const tf = d?.flags?.["bbttcc-territory"];
      if (!tf) continue;
      const name = norm(tf.name || d.text || "");
      if (name) hexRows.push({ name, uuid: d.uuid, scene: scene.name });
    }
  }
  report.push(`◈ ${hexRows.length} named territory hex(es) scanned`);

  /* ── 1. Ride beats ── */
  // The console now arrives WITH the dialog (openTravel applies at beat
  // entry, 2026-08-26), so the dialog gets a real resolve: Saddle up closes
  // it and leaves you on the console; the escape hatch still walks back.
  const rideChoices = () => ([
    { label: "🐎 Saddle up — ride out", next: "", description: "Run the planned route on the Travel Console.", checkStat: "", checkDC: 0, failNext: "" },
    { label: "Actually — back to the Crossroads", next: "ag_crossroads_first_rides", description: "", checkStat: "", checkDC: 0, failNext: "" }
  ]);
  const mkRide = (t) => {
    const ex = byId.get(t.rideId);
    if (ex) {
      if ((ex.choices || []).some(c => /saddle up/i.test(String(c?.label || "")))) {
        report.push(`· ok beat (already) ${t.rideId}`);
      } else {
        ex.choices = rideChoices(); changes++;
        report.push(`✚ ${t.rideId}: saddle-up resolve choice added`);
      }
      return;
    }
    const nb = {
      id: t.rideId, label: t.label, type: "dialog", questId: AGQ,
      questStep: Number(cross.questStep || 0) + 1,
      description: t.desc,
      choices: rideChoices(),
      inject: { repeatable: true, requires: [{ flag: "storyPhase", gte: 1 }] },
      worldEffects: { openTravel: { hexName: t.hexName } },
      playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
      tags: "allesh_gilliam prologue spine travel"
    };
    camp.beats.push(nb); byId.set(t.rideId, nb); changes++;
    report.push(`✚ beat ${t.rideId} (openTravel → ${t.hexName})`);
  };

  /* ── 2+3. Rewire crossroads + arrival overrides ── */
  camp.hexOverrides = (camp.hexOverrides && typeof camp.hexOverrides === "object") ? camp.hexOverrides : {};
  for (const t of TOWNS) {
    mkRide(t);

    const ch = (cross.choices || []).find(c => String(c?.next) === t.introId);
    if (ch) { ch.next = t.rideId; changes++; report.push(`· Crossroads "${norm(ch.label)}" → ${t.rideId} (was direct to intro)`); }
    else if ((cross.choices || []).some(c => String(c?.next) === t.rideId)) report.push(`· ok Crossroads already rides ${t.rideId}`);
    else report.push(`✗ Crossroads has no choice pointing at ${t.introId} — check labels by hand`);

    if (!byId.get(t.introId)) { report.push(`✗ intro beat ${t.introId} missing — no arrival override set`); continue; }
    const matches = hexRows.filter(h => t.hexPatterns.some(p => p.test(h.name)));
    if (matches.length === 1) {
      const hx = matches[0];
      const cur = camp.hexOverrides[hx.uuid];
      if (cur?.onEnterBeatId === t.introId) report.push(`· ok arrival already wired: "${hx.name}" → ${t.introId}`);
      else {
        camp.hexOverrides[hx.uuid] = Object.assign({}, cur, { onEnterBeatId: t.introId });
        changes++; report.push(`✚ arrival: hex "${hx.name}" (${hx.scene}) → ${t.introId}`);
      }
    } else if (!matches.length) {
      report.push(`✗ NO hex matched ${t.key} (${t.hexPatterns.join(" ")}) — arrival not wired`);
    } else {
      report.push(`✗ ${matches.length} hexes matched ${t.key}: ${matches.map(m => `"${m.name}"`).join(", ")} — ambiguous, arrival not wired`);
    }
  }

  console.log(`[patch-crossroads-travel] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Crossroads-travel DRY RUN: ${changes} change(s) (console — read the hex matches!). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-crossroads-travel-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Crossroads-travel APPLIED: ${changes} change(s). The road is real now — ride ready.`);
})();
