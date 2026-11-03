/**
 * patch-forgotten-cause-wiring-2026-11-03.macro.js — THE FORGOTTEN CAUSE GETS WIRED (Dave 2026-11-03, failure pass: "This is a quest
 * that has not had its tires kicked at all yet"). Mapped offline (fc-map): every hand-off past the road was unreachable.
 * Dave's rulings: A1 pity timer (code, module.js + api.travel.js) · the Confluence = The Anchor Reach · a failed Summit = a
 * Darkness tick (the failure beat already carries +1) + no retry for a round, then "Get people back to the table." · fix the
 * river table (the live table was clean — the weight-100 Broken Bridge sat in a corrupt "[object Object]" copy; removed).
 *   • fc_bridge_off "The Shape of the Wrongness" — autoFire (gate: rung ≥ 2)
 *   • fc_bridge_confluence "The Long Table Is Set" — the Anchor Reach's arrival card (first in its onEnterBeatIds, the Act-3
 *     harbor intro stays behind it), repeatable while the Long Table is open, return text once the table has been seen,
 *     buttons: "Go to the table." / "The harbor floor, at low tide." (the intro's own gate) / "Not yet."
 *   • the Confluence beats declare where = "The Anchor Reach" (the quest log's Ride)
 *   • fc_bridge_summit "An Empty Reason-Column" + grief_quartet_capstone — autoFire
 *   • fixit_gullywasher_welcome — "The Summit room is set." (Summit open, never failed) and "Get people back to the table."
 *     (Summit open, failed ≥ 1 turn ago — beatMark.turnsSince, module.js) → gullywasher_cultural_summit
 * Idempotent (rerun = 0). DRY_RUN first. Backups (campaigns + encounterTables) → Data/bbttcc-exports/. GM only.
 */
const FC_WIRING = (() => {
  const ANCHOR = "The Anchor Reach";
  const RETURN = "The long table is still set. Your chair is still pulled out, and the card with your name on it has not moved.";
  const J = (v) => JSON.stringify(v);
  const ch = (label, next, requires) => Object.assign({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "" }, requires ? { requires } : {});
  function apply(camp, anchorUuid) {
    const beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
    const by = new Map(beats.map(b => [b.id, b]));
    const report = [], conflicts = []; let changes = 0;
    const need = (id) => { const b = by.get(id); if (!b) conflicts.push(`${id} not found`); return b; };
    const set = (b, path, val, note) => { const keys = path.split("."); let o = b; for (const k of keys.slice(0, -1)) o = (o[k] = o[k] || {}); const k = keys.at(-1); if (J(o[k]) !== J(val)) { o[k] = val; changes++; report.push(`✚ ${b.id}: ${note || path}`); } };

    for (const id of ["fc_bridge_off", "fc_bridge_summit", "grief_quartet_capstone"]) { const b = need(id); if (b) set(b, "inject.autoFire", true, "autoFire"); }

    const conf = need("fc_bridge_confluence"), intro = need("map_anchor_reach_intro"), table = need("wendigo_confluence_the_long_table");
    if (conf && intro && table) {
      set(conf, "inject.repeatable", true, "repeatable");
      set(conf, "inject.requires", [{ questBucket: "fc_wendigo_confluence", is: "active" }, { questBucket: "fc_long_table", isNot: "completed" }, { flag: "storyPhase", gte: 2 }], "gate: quest open, Long Table not decided");
      const d = String(conf.description || "");
      if (!d.startsWith("{{#played wendigo_confluence_the_long_table}}")) set(conf, "description", `{{#played wendigo_confluence_the_long_table}}${RETURN}{{else}}${d}{{/played}}`, "return text");
      const introReq = JSON.parse(J(intro.inject?.requires || []));
      set(conf, "choices", [ch("Go to the table.", "wendigo_confluence_the_long_table"), ch("The harbor floor, at low tide.", "map_anchor_reach_intro", introReq), ch("Not yet.", "")], "choices: table / harbor / not yet");
    }
    for (const id of ["fc_bridge_confluence", "wendigo_confluence_the_long_table", "fc_seated", "wendigo_confluence_name_cards", "fc_night_one"]) { const b = by.get(id); if (b) set(b, "where", ANCHOR, `where = ${ANCHOR}`); }

    if (anchorUuid) {
      camp.hexOverrides = camp.hexOverrides || {};
      const rec = camp.hexOverrides[anchorUuid] = camp.hexOverrides[anchorUuid] || {};
      const list = Array.isArray(rec.onEnterBeatIds) ? rec.onEnterBeatIds.slice() : [];
      if (list[0] !== "fc_bridge_confluence") { const nl = ["fc_bridge_confluence", ...list.filter(x => x !== "fc_bridge_confluence")]; rec.onEnterBeatIds = nl; changes++; report.push(`✚ hexOverrides[${ANCHOR}].onEnterBeatIds = ${nl.join(", ")}`); }
    } else conflicts.push("Anchor Reach hex not found");

    const bar = need("fixit_gullywasher_welcome");
    if (bar) {
      const OPEN = { questBucket: "fc_cultural_summit", is: "active" };
      const want = [ch("The Summit room is set.", "gullywasher_cultural_summit", [OPEN, { beatMark: "gullywasher_cultural_summit_failure", not: true }]),
                    ch("Get people back to the table.", "gullywasher_cultural_summit", [OPEN, { beatMark: "gullywasher_cultural_summit_failure", turnsSince: 1 }])];
      for (const w of want) {
        const cur = (bar.choices || []).find(c => c.label === w.label);
        if (!cur) { const at = bar.choices.findIndex(c => /^Back to the yard/.test(c.label)); bar.choices.splice(at >= 0 ? at : bar.choices.length, 0, w); changes++; report.push(`✚ ${bar.id}: "${w.label}"`); }
        else if (J(cur.requires) !== J(w.requires) || cur.next !== w.next) { Object.assign(cur, { next: w.next, requires: w.requires }); changes++; report.push(`✚ ${bar.id}: "${w.label}" synced`); }
      }
    }
    return { changes, report, conflicts };
  }
  function applyTables(tables) {
    const report = []; let changes = 0;
    if (tables && Object.prototype.hasOwnProperty.call(tables, "[object Object]")) { delete tables["[object Object]"]; changes++; report.push("✂ encounterTables['[object Object]'] (a stale river copy with the weight-100 Broken Bridge)"); }
    return { changes, report };
  }
  return { apply, applyTables, ANCHOR };
})();

if (typeof game === "undefined" && typeof module !== "undefined") {
  module.exports = FC_WIRING;
} else (async () => {
  const DRY_RUN = (globalThis.__fcWireDry ?? true);
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let anchorUuid = null;
  for (const s of game.scenes) { const d = s.drawings.find(x => x.flags?.["bbttcc-territory"]?.name === FC_WIRING.ANCHOR); if (d) { anchorUuid = d.uuid; break; } }
  const campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()]; if (!camp) return ui.notifications.error("Active campaign not found.");
  const tabRaw = game.settings.get(NS, "encounterTables"); const tabWasStr = typeof tabRaw === "string";
  const tables = JSON.parse(tabWasStr ? tabRaw : JSON.stringify(tabRaw || {}));
  const a = FC_WIRING.apply(camp, anchorUuid), t = FC_WIRING.applyTables(tables);
  const changes = a.changes + t.changes, report = [...a.report, ...t.report];
  console.log(`[forgotten cause wiring 2026-11-03] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (a.conflicts.length ? "\n⚠ " + a.conflicts.join("\n⚠ ") : ""));
  globalThis.__fcWire = { dry: DRY_RUN, changes, report, conflicts: a.conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change.");
  if (a.conflicts.length) return ui.notifications.error("Conflicts — nothing written; see console.");
  try { const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker; try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-fc-wiring-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
    await FP.upload("data", "bbttcc-exports", new File([tabWasStr ? tabRaw : JSON.stringify(tabRaw)], `backup-encounterTables-pre-fc-wiring-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  if (a.changes) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (t.changes) await game.settings.set(NS, "encounterTables", tabWasStr ? JSON.stringify(tables) : tables);
  ui.notifications.info(`Applied — the Forgotten Cause is wired (${changes}).`);
})();
