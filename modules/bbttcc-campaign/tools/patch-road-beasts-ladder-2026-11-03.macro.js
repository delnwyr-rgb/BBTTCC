/**
 * patch-road-beasts-ladder-2026-11-03.macro.js — MORE ROAD BEASTS, AND THE LADDER BY ACT (failure pass, Dave 2026-11-03: "we need a wider
 * variety of encounters, and more of them"; the mutant ladder "Scavenger Beast (T1) → Wastes Stalker (T2) → Apex Predator (T3)";
 * "Ash Wolf and Burn Zone Alpha could be another great encounter").
 * With the alpha cut every leg rolls the Tier-1 tables, so the Act-3+ rows had made 3 of 5 beast draws Apex-class
 * (enc_apex_predator w2 + enc_mutant_wildlife_t3 w1 vs the Stalker's w2). The ladder now climbs by ACT:
 *   • NEW enc_scavenger_beast (Scavenger Beast, T1 critter): Act 2+, every Tier-1 terrain, w3 — the common road beast
 *   • enc_mutant_wildlife_t2 (Wastes Stalker) unchanged (w2, Act 2+)
 *   • enc_apex_predator in the Tier-1 tables: Act 4+ (was 3), w1 (was 2); enc_mutant_wildlife_t3 (also the Apex): Act 5+ (was 3)
 *   • NEW enc_ash_wolves (an Ash Wolf pack led by a Burn-Zone Alpha): Act 2+, ash wastes / canyons / plains Tier-1, w2
 * Both new families clone enc_mutant_wildlife_t2's shape (talk-down check → success/fail; fight → Win/Lose/Run; bounty by creature
 * name — both creatures are in the bestiary). Prose = drafts in the road-encounter voice; Dave edits.
 * Idempotent (rerun = 0). DRY_RUN first. Backups (campaigns + encounterTables) → Data/bbttcc-exports/. GM only.
 */
const ROAD_BEASTS = (() => {
  const J = (v) => JSON.stringify(v);
  const T = "enc_mutant_wildlife_t2";
  const FAMILIES = [
    { root: "enc_scavenger_beast", key: "scavenger_beast", creature: "Scavenger Beast", label: "Scavenger Beast", menace: "scavenger beast",
      check: { label: "Show it you're not worth the trouble", stat: "empathy", dc: 10 }, fight: "Run it off — loud and large",
      text: {
        root: "Something low and patient has been following the smell of your supplies for a mile. It is mostly teeth and opinion, and it is not hungry enough to be brave. Yet.",
        parley_success: "It takes the jerky, looks you over, and decides the next caravan will be easier. Somewhere a scavenger is having a good day, and it isn't at your expense.",
        parley_fail: "It takes the jerky. Then it takes an interest in the rest of the bag.",
        outcomes: "It comes in low and fast, the way things do that have never once won a fair fight and never once needed to. Call it:",
        outcomes_win: "It goes down snapping and stays down. Somebody remembers to check the bag for teeth marks.",
        outcomes_lose: "It gets the bag. It gets a piece of somebody's coat. It does not, thankfully, get anything you need to walk on.",
        outcomes_run: "You leave it the bag and keep the road. A fair trade, on reflection." } },
    { root: "enc_ash_wolves", key: "ash_wolves", creature: "Burn-Zone Alpha", label: "Ash Wolves", menace: "ash wolf pack",
      check: { label: "Read the Alpha, not the pack", stat: "empathy", dc: 13 }, fight: "Hit the Alpha first — the pack will break",
      text: {
        root: "The ash moves before the wind does. Grey shapes pace you along the ridge, and at their head walks something larger, scorched to the bone and smug about it: a Burn-Zone Alpha. The pack is waiting on its word.",
        parley_success: "You hold the Alpha's eye and do not look at the pack. It snorts ash, decides you are somebody else's problem, and the whole grey line melts back into the burn.",
        parley_fail: "The Alpha reads you right back, and does not like the answer. The pack fans out.",
        outcomes: "Grey on grey, and the Alpha in the middle of it. Call it:",
        outcomes_win: "The Alpha goes down and the pack goes with it: not dead, just gone, the way a rumour goes. The ash settles slowly, like it's disappointed.",
        outcomes_lose: "The pack harries you to the edge of the burn and lets you go, which is worse. They wanted you to know they could.",
        outcomes_run: "You give them the ridge. They let you have the road. Everybody knows who won." } }
  ];
  const SUFFIXES = ["", "_outcomes", "_outcomes_win", "_outcomes_lose", "_outcomes_run", "_parley_success", "_parley_fail"];
  function cloneFamily(byId, F) {
    const out = [];
    for (const sfx of SUFFIXES) {
      const src = byId.get(T + sfx); if (!src) return null;
      const b = JSON.parse(J(src));
      b.id = F.root + sfx;
      const txtKey = sfx ? sfx.slice(1) : "root";
      b.description = F.text[txtKey] ?? b.description;
      b.label = sfx === "" ? F.label : sfx === "_outcomes" ? `${F.label} (Outcomes)` : sfx === "_outcomes_win" ? `${F.label} (Win)` : sfx === "_outcomes_lose" ? `${F.label} (Lose)` : sfx === "_outcomes_run" ? `${F.label} (Run)` : sfx === "_parley_success" ? `${F.label} — Read and Released` : `${F.label} — Wrong Read`;
      if (b.encounter && typeof b.encounter === "object") b.encounter = { ...b.encounter, key: F.key, tier: 1, actorName: F.creature };
      if (b.menace && typeof b.menace === "object") b.menace = { ...b.menace, label: F.menace };
      if (b.award && typeof b.award === "object") b.award = { ...b.award, creature: F.creature, creatureId: null };
      b.choices = (b.choices || []).map(c => {
        const n = { ...c, next: String(c.next || "").replace(T, F.root), failNext: String(c.failNext || "").replace(T, F.root) };
        if (sfx === "" && c.checkStat) Object.assign(n, { label: F.check.label, checkStat: F.check.stat, checkDC: F.check.dc });
        if (sfx === "" && !c.checkStat) n.label = F.fight;
        return n;
      });
      for (const k of ["outcomes"]) if (b[k]) for (const kk of Object.keys(b[k])) if (typeof b[k][kk] === "string") b[k][kk] = b[k][kk].replace(T, F.root);
      out.push(b);
    }
    return out;
  }
  function applyCamp(camp) {
    if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
    const byId = new Map(camp.beats.map(b => [b.id, b]));
    const report = [], conflicts = []; let changes = 0;
    const anchor = byId.get(T + "_parley_fail") || byId.get(T); if (!anchor) { conflicts.push(`${T} family not found`); return { changes, report, conflicts }; }
    for (const F of FAMILIES) {
      if (byId.has(F.root)) continue;
      const fam = cloneFamily(byId, F); if (!fam) { conflicts.push(`${T} family incomplete`); continue; }
      camp.beats.splice(camp.beats.indexOf(anchor) + 1, 0, ...fam); for (const b of fam) byId.set(b.id, b);
      changes += fam.length; report.push(`✚ ${F.root} family (${fam.length} beats, ${F.creature})`);
    }
    return { changes, report, conflicts };
  }
  function applyTables(tables, campaignId) {
    const report = []; let changes = 0;
    for (const [tid, t] of Object.entries(tables || {})) {
      const m = /^travel_([a-z]+)_t1$/.exec(tid); if (!m || !Array.isArray(t?.entries)) continue; const terr = m[1];
      for (const e of t.entries) {
        if (e?.beatId === "enc_apex_predator" && (Number(e.conditions?.phaseGte) < 4 || Number(e.weight) > 1)) { e.conditions = { ...(e.conditions || {}), phaseGte: 4 }; e.weight = 1; changes++; report.push(`  ${tid}: apex → Act 4+, w1`); }
        if (e?.beatId === "enc_mutant_wildlife_t3" && Number(e.conditions?.phaseGte) < 5) { e.conditions = { ...(e.conditions || {}), phaseGte: 5 }; changes++; report.push(`  ${tid}: wildlife T3 → Act 5+`); }
      }
      const hasT2 = t.entries.some(e => e?.beatId === "enc_mutant_wildlife_t2");
      if (hasT2 && !t.entries.some(e => e?.beatId === "enc_scavenger_beast")) { t.entries.push({ campaignId, beatId: "enc_scavenger_beast", weight: 3, conditions: { terrain: terr, tier: 1, phaseGte: 2, scale: "foot" } }); changes++; report.push(`✚ ${tid}: Scavenger Beast w3`); }
      if (["ashwastes", "canyons", "plains"].includes(terr) && !t.entries.some(e => e?.beatId === "enc_ash_wolves")) { t.entries.push({ campaignId, beatId: "enc_ash_wolves", weight: 2, conditions: { terrain: terr, tier: 1, phaseGte: 2, scale: "foot" } }); changes++; report.push(`✚ ${tid}: Ash Wolves w2`); }
    }
    return { changes, report };
  }
  return { applyCamp, applyTables };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = ROAD_BEASTS;
} else (async () => {
  const DRY_RUN = (globalThis.__beastsDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.(); const camp = camps?.[cid]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const tabRaw = game.settings.get(NS, "encounterTables"); const tabWasStr = typeof tabRaw === "string";
  const tables = JSON.parse(tabWasStr ? tabRaw : JSON.stringify(tabRaw || {}));
  const a = ROAD_BEASTS.applyCamp(camp), t = ROAD_BEASTS.applyTables(tables, cid);
  const changes = a.changes + t.changes, report = [...a.report, ...t.report];
  console.log(`[road beasts ladder 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (a.conflicts.length ? "\n⚠ " + a.conflicts.join("\n⚠ ") : ""));
  globalThis.__beasts = { dry: DRY_RUN, changes, report, conflicts: a.conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  if (a.conflicts.length) return ui.notifications.error("Conflicts — nothing written; see console.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-road-beasts-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
    await FP.upload("data", "bbttcc-exports", new File([tabWasStr ? tabRaw : JSON.stringify(tabRaw)], `backup-encounterTables-pre-road-beasts-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (a.changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (t.changes) await game.settings.set(NS, "encounterTables", tabWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Applied — road beasts and the ladder by act (${changes}).`);
})();
