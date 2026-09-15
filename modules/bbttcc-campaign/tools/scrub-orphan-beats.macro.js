// Bad Eden — Scrub orphan beats (2026-09-14) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// Live-caught: closing the Welcome Round let the story model's quest-order fallback offer two DEAD beats
// (an HQ interior with a deleted scene, an old church intro that routed into Act 2). The model now
// ignores orphans, and this macro removes the ones that are provably dead: nothing routes to them,
// nothing references them (outcomes/handoff), no table or hex points at them, no gate waits for them,
// and their content is superseded by live beats.
//
// DELETE (14): the two Allesh-Gilliam leftovers + St Gilliam's interior · the ORPHANED first Circuit Rider
//   implementation (acceptance, intro, 3 outcomes — the live 53-beat enc_circuit_riders_* arc replaces it)
//   · bandit_ambush_2 (stub) · fixit_power_station_conversation_1 (superseded by _2) · gloomgill_correct /
//   _incorrect (the questions route straight to question_2) · lyrenn_the_gentle_pest_fail and
//   fixit_leyline_stabilizer_no_deal (fail beats superseded by try_again / delay / trade_fail).
// REVIEW (owner): see the report — beats that look like lost Act-2 venues rather than dead content.
// KEEP: gated orphans (GM-run when their gate opens: the Muster, the Upper Galleries, the Missing Runner,
//   the chase beats), outcome-linked beats, engine-held ids, the Offices ritual, the Sarmoung markers.
// Every deletion is re-verified at run time; anything referenced is skipped and reported.

(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  const DELETE = ["allesh_gilliam_hq_interior", "allesh_gilliam_st_gilliams_interior", "allesh_gilliam_st_gilliams_intro",
    "circuit_riders_parley_friendly_outcome", "circuit_riders_parley_neutral_outcome", "circuit_riders_parley_hostile_outcome",
    "circuit_riders_parley_intro", "circuit_riders_parley_quest_acceptance",
    "bandit_ambush_2", "fixit_power_station_conversation_1", "gloomgill_correct", "gloomgill_incorrect",
    "lyrenn_the_gentle_pest_fail", "fixit_leyline_stabilizer_no_deal"];
  const REVIEW = [
    ["allesh_gilliam_waiting_room_rumor_board", "Act-2 venue ('What the Bar Knows Tonight') with no route in — route it from the Waiting Room in Act 2, or delete"],
    ["allesh_gilliam_vacancy_ledger", "Act-2 venue ('Verna's Ledger') with no route in — route it from the Vacancy in Act 2, or delete"],
    ["fixit_backstairs_exterior", "Fixit venue with no route in — offer it from the Fixit walk, or delete"],
    ["ag_ride_fixit", "the Crossroads sign advertises Fixit but offers no ride; the ride beat is Act 2 — add the choice when Fixit opens (Act 2), or leave the sign as a tease"],
    ["enc_hidden_vault_locals_roleplay_beat", "Hidden Vault roleplay colour with no route — GM-run from the chart, or route from the vault hub"],
    ["enc_hidden_vault_popcorn_council_roleplay_beat", "same"],
    ["enc_hidden_vault_matter_replicator_roleplay_beat", "same"]
  ];
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  let tables = game.settings.get(NS, "encounterTables"); if (typeof tables === "string") { try { tables = JSON.parse(tables); } catch (_e) {} }
  const tabled = new Set((Array.isArray(tables) ? tables : Object.values(tables || {})).flatMap(t => (t.entries || []).map(e => String(e.beatId))));
  const hexWired = new Set();
  for (const v of Object.values(camp.hexOverrides || {})) for (const id of [].concat(v?.onEnterBeatId || [], v?.onEnterBeatIds || [])) hexWired.add(String(id));
  for (const sc of game.scenes) for (const d of sc.drawings) { const cf = d.flags?.["bbttcc-territory"]?.campaign; if (cf) for (const id of [].concat(cf.onEnterBeatId || [], cf.onEnterBeatIds || [])) hexWired.add(String(id)); }
  const del = new Set(DELETE);
  const report = []; const removed = [];
  for (const id of DELETE) {
    const b = camp.beats.find(x => String(x.id) === id);
    if (!b) { report.push(`· gone already: ${id}`); continue; }
    const refs = camp.beats.filter(o => String(o.id) !== id && !del.has(String(o.id)) && JSON.stringify(o).includes(`"${id}"`)).map(o => o.id);
    if (refs.length || tabled.has(id) || hexWired.has(id)) { report.push(`⚠ KEPT ${id}: referenced by ${refs.join(", ") || (tabled.has(id) ? "a table" : "a hex")}`); continue; }
    removed.push(id); report.push(`− ${id} (${b.label || ""})`);
  }
  if (!DRY_RUN && removed.length) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-orphan-scrub-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    camp.beats = camp.beats.filter(b => !removed.includes(String(b.id)));
    await game.settings.set(NS, "campaigns", campaigns);
  }
  const banner = DRY_RUN ? "DRY RUN — nothing written. Set DRY_RUN = false to apply." : "APPLIED.";
  const html = `<div style="font-size:12px"><b>scrub-orphan-beats — ${banner}</b> (${removed.length} to remove)<br>${report.map(r => "&nbsp;" + r.replace(/</g, "&lt;")).join("<br>")}<hr><b>REVIEW (owner's call, untouched)</b><br>${REVIEW.map(([id, why]) => `&nbsp;${id} — ${why}`).join("<br>")}</div>`;
  console.log("[scrub-orphan-beats]", banner, { removed, report, REVIEW });
  await ChatMessage.create({ content: html, whisper: game.users.filter(u => u.isGM).map(u => u.id) });
  ui.notifications?.info(`Orphan scrub: ${banner}`);
})();
