/*
 * patch-seal-elite-tor-wrath-2026-11-13.macro.js — Dave (2026-11-13): the Old Seal gallery fight is now
 * "3 Tor-Wraths plus an Elite Tor-Wrath".
 *
 * Beat kt_seal_tor_wrath (made by patch-tor-wrath-seal-gate-2026-10-28, battlemap ewhnzejDEXX69yOl) spawns its foes
 * through bbttcc-encounters' stageReady handler (spawner.interface.js onStageReady): `encounter.actorName` × `count`,
 * then each `encounter.also[] {actorName, count}` — world actor by exact name, else imported once from
 * bbttcc-master-content.npcs. This macro:
 *   1) keeps actorName "Tor-Wrath" × 3 + party:true, and adds  also: [{ actorName: "Elite Tor-Wrath", count: 1 }]
 *   2) rewrites the two lines of beat text that say three wraths (the prose and the ⚙ GM line).
 * The elite is resolved BY NAME at run time (world actor, else the NPC pack). If it doesn't exist yet the macro
 * REFUSES — nothing is written (the dry run still shows the plan).
 *
 * DRY RUN by default. globalThis.__sealEliteDry = false applies. Idempotent (re-run = 0 changes).
 * Before writing, a JournalEntry "Seal elite Tor-Wrath backup 2026-11-13" stores the beat's before-JSON.
 * Report → globalThis.__sealEliteReport { DRY_RUN, changes, conflicts, refused, elite }.
 *
 * ⚠ The Beat Editor's Save rebuilds beat.encounter without `also` (campaign-beat-editor.js ~3956) — saving this beat in the
 *   editor drops the elite again (same for ft_camp_fight). Re-run this macro after any editor save of kt_seal_tor_wrath.
 */
(async () => {
  const DRY_RUN = globalThis.__sealEliteDry !== false;

  // <plan> — pure (no Foundry globals): the offline harness extracts this block and runs it against the dumps.
  const BEAT_ID = "kt_seal_tor_wrath";
  const FOE = "Tor-Wrath";
  const ELITE = "Elite Tor-Wrath";
  const TEXT_EDITS = [
    {
      why: "prose: four shapes, one of them big",
      from: "Three shapes shoulder out of the rock between you and the seal — ore-grit and old dark, fists like slag, standing up out of the stone the way a man stands up out of a chair he's been sitting in too long.",
      to: "Four shapes shoulder out of the rock between you and the seal — ore-grit and old dark, fists like slag, standing up out of the stone the way a man stands up out of a chair he's been sitting in too long. Three of them are the size of a man. The fourth has to stoop under the gallery roof, and the other three make room for it the way a crew makes room for the foreman."
    },
    {
      why: "GM line: three Tor-Wrath and an Elite Tor-Wrath",
      from: "⚙ GM: a fight in the gallery — three Tor-Wrath; the Stewards are placed.",
      to: "⚙ GM: a fight in the gallery — three Tor-Wrath and an Elite Tor-Wrath (the one that stoops); the Stewards are placed."
    }
  ];
  /** beat → { next (patched copy), changes[], conflicts[] }. Never mutates the input. */
  function planSealElite(beat) {
    const changes = [], conflicts = [];
    if (!beat) return { next: null, changes, conflicts: [`${BEAT_ID}: beat not found`] };
    const next = JSON.parse(JSON.stringify(beat));
    const enc = next.encounter && typeof next.encounter === "object" ? next.encounter : null;
    if (!enc || String(enc.actorName || "").trim() !== FOE) {
      conflicts.push(`${BEAT_ID}: encounter.actorName is "${enc?.actorName ?? "(none)"}", expected "${FOE}" — spawn NOT patched`);
    } else {
      if (Number(enc.count) !== 3) { changes.push(`encounter.count ${enc.count ?? 1} → 3`); enc.count = 3; }
      if (enc.party !== true) { changes.push("encounter.party → true"); enc.party = true; }
      const also = Array.isArray(enc.also) ? enc.also : [];
      const mine = also.filter(x => String(x?.actorName || "").trim() === ELITE);
      if (!(mine.length === 1 && Number(mine[0].count) === 1)) {
        enc.also = [...also.filter(x => String(x?.actorName || "").trim() !== ELITE), { actorName: ELITE, count: 1 }];
        changes.push(`encounter.also + { actorName: "${ELITE}", count: 1 }`);
      }
    }
    let desc = String(next.description || "");
    for (const t of TEXT_EDITS) {
      if (desc.includes(t.to)) continue;
      if (!desc.includes(t.from)) { conflicts.push(`${BEAT_ID}: text anchor not found (${t.why}) — "${t.from.slice(0, 48)}…"`); continue; }
      desc = desc.replace(t.from, t.to); changes.push(`text: ${t.why}`);
    }
    next.description = desc;
    return { next, changes, conflicts };
  }
  // </plan>

  const report = { DRY_RUN, beat: BEAT_ID, elite: null, changes: [], conflicts: [], refused: null, applied: false };
  const done = () => {
    globalThis.__sealEliteReport = report;
    console.log("[seal-elite] " + JSON.stringify(report, null, 1));
    const msg = report.refused ? `Seal elite: REFUSED — ${report.refused}`
      : `Seal elite ${DRY_RUN ? "dry run" : (report.applied ? "applied" : "nothing to do")}: ${report.changes.length} change(s)${report.conflicts.length ? `, ${report.conflicts.length} conflict(s) (console)` : ""}.`;
    (report.refused ? ui.notifications?.error : ui.notifications?.info)?.call(ui.notifications, msg);
    return report;
  };
  if (!game.user?.isGM) { report.refused = "GM only"; return done(); }

  const C = game.bbttcc?.api?.campaign;
  const cid = C?.getActiveCampaignId?.(); const camp = cid ? C.getCampaign(cid) : null;
  if (!camp) { report.refused = "active campaign not found"; return done(); }
  const beats = foundry.utils.deepClone(Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {}));
  const idx = beats.findIndex(b => b && String(b.id) === BEAT_ID);
  const plan = planSealElite(idx >= 0 ? beats[idx] : null);
  report.changes = plan.changes; report.conflicts = plan.conflicts;

  // the elite must exist (world actor by exact name, else the NPC pack) — the same lookup the spawner uses
  const findByName = async (name) => {
    const w = game.actors?.find?.(a => a?.name === name);
    if (w) return `world Actor.${w.id}`;
    const pack = game.bbttcc?.packs?.get?.("bbttcc-master-content.npcs") ?? game.packs?.get("bbttcc-master-content.npcs");
    const e = pack ? (await pack.getIndex()).find(x => x.name === name) : null;
    return e ? `pack ${pack.collection}.${e._id}` : null;
  };
  report.elite = await findByName(ELITE);
  const foeAt = await findByName(FOE);
  if (!foeAt) report.conflicts.push(`"${FOE}" not found as a world actor or in the NPC pack — the three won't spawn either`);
  if (!report.elite) { report.refused = `no actor named "${ELITE}" (world or bbttcc-master-content.npcs) — create it first, then re-run`; return done(); }
  if (idx < 0) { report.refused = `${BEAT_ID} not found in the active campaign`; return done(); }
  if (plan.conflicts.some(c => c.includes("spawn NOT patched"))) { report.refused = "the beat's spawn isn't the Tor-Wrath one this macro expects — nothing written"; return done(); }
  if (DRY_RUN || !plan.changes.length) return done();

  // backup BEFORE the write — abort if it can't be written
  const base = "Seal elite Tor-Wrath backup 2026-11-13";
  let n = 1; while (game.journal.getName(n === 1 ? base : `${base} (pass ${n})`)) n++;
  try {
    const esc = s => (foundry.utils.escapeHTML ? foundry.utils.escapeHTML(s) : s.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
    await JournalEntry.create({ name: n === 1 ? base : `${base} (pass ${n})`, pages: [{ name: "before", type: "text",
      text: { content: `<p>campaign ${esc(String(cid))} · beat ${BEAT_ID}</p><pre>${esc(JSON.stringify(beats[idx], null, 1))}</pre>` } }] });
  } catch (e) { report.refused = `backup journal failed — NOTHING applied: ${e.message}`; return done(); }

  beats[idx] = plan.next;
  try { await C.saveCampaign(cid, { ...camp, beats }); report.applied = true; }
  catch (e) { report.refused = `saveCampaign failed: ${e.message}`; }
  return done();
})();
