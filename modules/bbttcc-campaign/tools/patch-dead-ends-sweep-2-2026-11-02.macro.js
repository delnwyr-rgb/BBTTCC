/* patch-dead-ends-sweep-2-2026-11-02.macro.js — the dead-end replies the 10-26 sweep missed (failure pass, Dave 2026-11-02: "Sweep all
 * 21 now"). Live-caught: the Bandit Envoy → "Ask about the stilt-hall" → any question CLOSED the window and took "Convene the summit"
 * with it. A choice with next "" ends the routed chain; its answer only ever showed as the button subtitle.
 * Same shape and rules as patch-dead-ends-sweep-2026-10-26 (see project_dead_end_sweep_2026_10_26):
 *   • each question → `ans_<parent>_<slug>`: the old subtitle is its text; routing-only (dialogueOffer:false, no questId/story,
 *     the parent's act gate + evergreen, timeScale "moment" + timePoints 0); it NEVER routes back into the parent (effects re-apply).
 *   • LOOP menus: an answer offers the parent's other choices (other questions now open their own answers; exits copied as-is).
 *   • ONE-PICK labels (mutually exclusive picks: the Adversary's reactions, the Trojan bets, the lease plans, the lease parley's
 *     Persuade/Impress — two of which carry effects): their answers offer only the parent's non-pick choices, never a sibling pick.
 *   • a menu with no exit gets one: the stilt-hall gets the Envoy's own exits; the rest get "Leave." (closes to the map).
 * Idempotent (rerun = 0). DRY_RUN first. Backup (campaigns) → Data/bbttcc-exports/. GM only.
 */
const DEAD_ENDS_2 = (() => {
  const PARENTS = ["adversary_reality_tear_watcher_notices", "ag_tamsin_pactkeeper", "fixit_mystery_bin", "fixit_route_board_after",
    "wt_chapel_keeper", "wt_kudzu_saloon", "hv_service_manifest", "maneuver_vault_honor_roll", "enc_circuit_riders_colossus",
    "fc_road_wendigo", "siege_pie_tally", "siege_year_zero", "bandit_stilt_hall", "trojan_betting_pool", "cadence_the_drum",
    "ninth_guest_the_made_room", "fixit_late_run_success", "founders_garden_the_dates", "reliable_lease_last_turn", "reliable_lease_parley"];
  const ONE_PICK = {
    adversary_reality_tear_watcher_notices: /./,
    trojan_betting_pool: /^Bet /,
    reliable_lease_last_turn: /^Plan to /,
    reliable_lease_parley: /^(Persuade|Impress)/
  };
  const EXIT_RE = /^\W*(leave|back|return|ride|onward|go back|actually|not now|not yet|not today|another time|ready to move on|continue|ok\b|noted|done|send him back|sit down with)/i;
  const J = (v) => JSON.stringify(v);
  const ch = (label, next, over = {}) => Object.assign({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" }, over);
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).slice(0, 5).join("_");
  const title = (p, label) => `${p.label || p.id} — ${String(label).replace(/^["“]+|["”]+$/g, "").replace(/[.!]+\s*$/, "").trim()}`;
  const actOf = (b) => { const r = (Array.isArray(b?.inject?.requires) ? b.inject.requires : []).find(x => x && x.flag === "storyPhase" && x.gte != null); return r ? Number(r.gte) : null; };
  const isQuestion = (c) => c && !c.next && !c.openTravel && !c.checkStat && String(c.description || "").trim().length > 20 && !EXIT_RE.test(String(c.label || ""));
  function apply(camp) {
    if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
    const byId = new Map(camp.beats.map(b => [b.id, b]));
    const report = []; let changes = 0; const made = [];
    const extraExits = (pid) => {
      if (pid === "bandit_stilt_hall") { const env = byId.get("bandit_envoy"); return (env?.choices || []).filter(c => /^(Convene the summit|Send him back)/.test(c.label)).map(c => JSON.parse(J(c))); }
      return [ch("Leave.", "")];
    };
    for (const pid of PARENTS) {
      const p = byId.get(pid); if (!p) { report.push(`⚠ ${pid}: not found`); continue; }
      const qs = (p.choices || []).filter(isQuestion);
      if (!qs.length && !(p.choices || []).some(c => String(c.next || "").startsWith(`ans_${pid}_`))) { report.push(`· ${pid}: no open questions`); continue; }
      for (const c of qs) {
        let id = `ans_${pid}_${slug(c.label)}`; let k = 2;
        while (byId.has(id) && byId.get(id).__dePid !== pid && !String(byId.get(id).id).startsWith(`ans_${pid}_`)) id = `ans_${pid}_${slug(c.label)}_${k++}`;
        let a = byId.get(id);
        if (!a) {
          a = { id, label: title(p, c.label), type: ["dialog", "narration", "exploration"].includes(p.type) ? p.type : "dialog",
            tags: p.tags || "", politicalTags: "", speakerActorId: p.speakerActorId || null, sceneId: p.sceneId || null,
            hexName: p.hexName ?? null, targetHexUuid: p.targetHexUuid ?? null,
            outcomes: { success: null, failure: null }, actors: [], encounter: { key: "", tier: null, actorName: "" }, worldEffects: {}, refs: {},
            playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
            description: String(c.description).trim(), choices: [],
            dialogueOffer: false, timeScale: "moment", timePoints: 0,
            inject: { repeatable: true, oncePerHex: false, evergreen: true, requires: actOf(p) != null ? [{ flag: "storyPhase", gte: actOf(p) }] : [] } };
          camp.beats.splice(camp.beats.indexOf(p) + 1, 0, a); byId.set(id, a); changes++; report.push(`✚ ${id}`);
        }
        c.next = id; c.description = ""; changes++;
        made.push([pid, c.label, id]);
      }
    }
    // answers' choices
    for (const [pid, label, id] of made) {
      const p = byId.get(pid), a = byId.get(id), op = ONE_PICK[pid];
      const answeredIsPick = !!(op && op.test(label));
      let want = (p.choices || []).filter(x => x && x.label !== label && x.next !== pid && !(answeredIsPick && op.test(x.label))).map(x => JSON.parse(J(x)));
      if (!want.some(x => EXIT_RE.test(String(x.label || "")) || (x.next && !String(x.next).startsWith(`ans_${pid}_`)))) want.push(...extraExits(pid));
      if (J(a.choices) !== J(want)) { a.choices = want; changes++; report.push(`  ${id}: ${want.map(x => x.label.slice(0, 22)).join(" | ")}`); }
    }
    // the parent itself gets an exit if it has none (cadence drum, stilt-hall, late run, …)
    for (const pid of PARENTS) {
      const p = byId.get(pid); if (!p) continue;
      const hasExit = (p.choices || []).some(x => EXIT_RE.test(String(x.label || "")) || (x.next && !String(x.next).startsWith(`ans_${pid}_`)));
      if (!hasExit) { const add = extraExits(pid).filter(e => !(p.choices || []).some(x => x.label === e.label)); if (add.length) { p.choices.push(...add); changes++; report.push(`✚ ${pid}: exit ${add.map(x => x.label).join(" / ")}`); } }
    }
    return { changes, report, made: made.length };
  }
  return { apply, PARENTS };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = DEAD_ENDS_2;
} else (async () => {
  const DRY_RUN = (globalThis.__deadEnds2Dry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const { changes, report, made } = DEAD_ENDS_2.apply(camp);
  console.log(`[dead ends sweep 2 2026-11-02] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s), ${made} answered\n` + report.join("\n"));
  globalThis.__deadEnds2 = { dry: DRY_RUN, changes, made, report };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-dead-ends-2-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied — ${made} dead-end replies now answer (${changes}).`);
})();
