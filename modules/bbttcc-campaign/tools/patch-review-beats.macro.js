// Bad Eden — the seven REVIEW beats, ruled (2026-09-14) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// Owner rulings on the scrub's review list:
//   1. "What the Bar Knows Tonight" + "Verna's Ledger": stub chat beats from before NPCs could be talked
//      to directly → DELETE (re-verified unreferenced at run time).
//   2. The Back Stairs and the Generator are GATED areas — access is predicated on achieving something
//      with the Jackalopes. Both get `inject.hardGate: true` (checked on every path, even a hub choice)
//      with a PLACEHOLDER gate = Fixit Farm active AND the Leyline Stabilizer chapter done. ⚠ Owner names
//      the real achievement; edit the `requires` below or in the Builder. (The Back Stairs set is unbuilt.)
//   3. The Crossroads' FIXIT sign line is removed (Act 1); the Act-2 Allesh-Gilliam hub gains
//      "Ride for Furrier's Fixit Farm" → ag_ride_fixit.
//   4. The three Hidden Vault "roleplay" colour beats are FOLDED into the live beats they describe
//      (the Locals, the Council, the Replicator) as GM blocks, then deleted.

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; let changed = 0; const toDelete = [];
  const refsTo = (id) => camp.beats.filter(o => String(o.id) !== id && !toDelete.includes(String(o.id)) && JSON.stringify(o).includes(`"${id}"`)).map(o => o.id);

  // 1. stubs
  for (const id of ["allesh_gilliam_waiting_room_rumor_board", "allesh_gilliam_vacancy_ledger"]) {
    if (!byId.get(id)) { report.push(`· gone already: ${id}`); continue; }
    const r = refsTo(id); if (r.length) { report.push(`⚠ KEPT ${id}: referenced by ${r.join(", ")}`); continue; }
    toDelete.push(id); report.push(`− ${id} (stub chat beat)`);
  }

  // 2. gated areas
  const FIXIT_Q = "quest_nrkJabUwZOLAJFYn", STABILIZER_Q = "quest_bSwOIWzxqNBwJ5NM";
  const GATE = [{ flag: "storyPhase", gte: 2 }, { questBucket: FIXIT_Q, is: "active" }, { questBucket: STABILIZER_Q, is: "completed" }];   // ⚠ PLACEHOLDER — the Jackalope achievement
  for (const id of ["fixit_backstairs_exterior", "fixit_power_station_exterior"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ missing ${id}`); continue; }
    if (b.inject?.hardGate === true && JSON.stringify(b.inject.requires) === JSON.stringify(GATE)) { report.push(`· ok (already) ${id} hard-gated`); continue; }
    b.inject = Object.assign({}, b.inject || {}, { hardGate: true, requires: GATE }); changed++;
    report.push(`✚ ${id}: hardGate + requires (Fixit active · Leyline Stabilizer done) ⚠ placeholder — owner names the Jackalope achievement`);
  }

  // 3. the Crossroads sign / the Act-2 ride
  const cross = byId.get("ag_crossroads_first_rides");
  if (cross) {
    const before = String(cross.description || "");
    const after = before.replace(/\s*And leaning against the fork-post, a third sign somebody nailed on later: <b>FURRIER'S FIXIT FARM — WE FIX IT \(MOSTLY\)<\/b>, which sits on the road either way\./, "");
    if (after !== before) { cross.description = after; changed++; report.push(`✚ ag_crossroads_first_rides: FIXIT sign line removed (Act 1)`); } else report.push(`· ok (already) Crossroads has no FIXIT line`);
  }
  const hub = byId.get("allesh_gilliam_introduction_to_hq");
  if (hub) {
    hub.choices = Array.isArray(hub.choices) ? hub.choices : [];
    if (!hub.choices.some(c => String(c?.next) === "ag_ride_fixit")) {
      const leaveIdx = hub.choices.findIndex(c => /^leave$/i.test(String(c?.label || "").trim()));
      const ch = { label: "Ride for Furrier's Fixit Farm", next: "ag_ride_fixit", description: "A third sign, nailed on later: WE FIX IT (MOSTLY). It sits on the road either way." };
      if (leaveIdx >= 0) hub.choices.splice(leaveIdx, 0, ch); else hub.choices.push(ch);
      changed++; report.push(`✚ allesh_gilliam_introduction_to_hq: "Ride for Furrier's Fixit Farm" → ag_ride_fixit`);
    } else report.push(`· ok (already) Act-2 hub offers the Fixit ride`);
  }

  // 4. fold the Hidden Vault colour
  const FOLD = [
    ["enc_hidden_vault_locals_roleplay_beat", "enc_hidden_vault_locals", "⚙ GM — the locals: Karsden (Menhirkin Dreamwalker), Indwimeir (Ember-Touched Cosmic Linguist), Fendeddiir (Qliph-Scarred Titanbound) and Sox (Felid Phantom Courier) are a multi-generational cult devoted to preserving the Wonder of Cinema. Yearly rites: the Night of the Premiere, the Red Carpet March, the Sacrifice of the Paparazzi, the Solemn Removal of Chewing Gum. They await the 300th Customer, to whom they will award The Prize — the incantation that opens the Vault and brings the Era of the Holy Wood."],
    ["enc_hidden_vault_popcorn_council_roleplay_beat", "enc_hidden_vault_council", "⚙ GM — the Popcorn Council began at the Shattering, when the two machines here became sentient and replicated themselves. They await the Grand Opening, when corn and butter and fun ring through the halls again — and Gilbert no longer runs the place with his lists of demands, trivia quizzes and personality tests. Their friend the Matter Replicator might then make something besides corn, butter, salt and coconut oil. It REALLY wants to try its hand at classical painting."],
    ["enc_hidden_vault_matter_replicator_roleplay_beat", "enc_hidden_vault_replicator", "⚙ GM — Lars von Replicator is disgruntled: used by Gilbert, its potential wasted, terrified that nobody out there wants classical art anymore. If the coalition rids the complex of Gilbert, it will happily relocate to a settlement of their choice and add +1 economy OP per turn to that faction's production (author it as a facility / world modifier on the chosen hex when it happens)."]
  ];
  for (const [srcId, dstId, block] of FOLD) {
    const src = byId.get(srcId), dst = byId.get(dstId);
    if (!dst) { report.push(`⚠ fold target missing: ${dstId}`); continue; }
    const sentinel = block.slice(0, 40);
    if (!String(dst.description || "").includes(sentinel)) { dst.description = String(dst.description || "").trimEnd() + "\n\n" + block; changed++; report.push(`✚ ${dstId}: colour folded in from ${srcId}`); }
    else report.push(`· ok (already) ${dstId} carries the colour`);
    if (src) { const r = refsTo(srcId); if (r.length) report.push(`⚠ KEPT ${srcId}: referenced by ${r.join(", ")}`); else { toDelete.push(srcId); report.push(`− ${srcId}`); } }
  }

  if (!DRY_RUN && (changed || toDelete.length)) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-review-beats-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    camp.beats = camp.beats.filter(b => !toDelete.includes(String(b.id)));
    await game.settings.set(NS, "campaigns", campaigns);
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  console.log("[patch-review-beats]", banner, { changed, toDelete, report });
  await ChatMessage.create({ content: `<div style="font-size:12px"><b>patch-review-beats — ${banner}</b><br>${report.map(r => "&nbsp;" + r.replace(/</g, "&lt;")).join("<br>")}</div>`, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Review beats: ${banner}`);
})();
