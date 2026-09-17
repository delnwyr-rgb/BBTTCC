/**
 * patch-story-flow-phase-d.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW ENCODE · PHASE D content (2026-09-17). The rulings that needed engine bridges, now that the
 * bridges exist (module.js: choice.requires + choice.cooldownTurns + anyOf gates; hex-travel.js: beat.pinLeg):
 *
 *  D-1 choice gates
 *    · The Crossroads: "Enough riding — make camp on the day" hides until at least one visit (a ride) has happened.
 *    · Lyrenn's forest: "Show it the Tifaret accord" hides until Tifaret was settled peacefully (Harmonious or lite).
 *    · Tifaret's tree: "Show it the Lyrenn treaty" hides until Lyrenn's forest was negotiated.
 *  D-2 choice cooldown
 *    · The Long Market: "Follow up" holds a turn after it was picked (a brush-off is not re-rolled by walking back).
 *  D-9 pinned road beats
 *    · The Circuit Riders fire on the FIRST leg to Lyrenn after the Act 2 Title Card (pinned; the random pool tag comes off).
 *    · The Forest of Early Tifaret fires on the FIRST ride to Furrier's Fixit-Farm.
 *  D-3 militia
 *    · The Bandit Accord's absorption ending makes the Town Militia STANDING (rung 3).
 *
 * Idempotent; backup download before write; GM only.
 */
(async () => {
  const DRY_RUN = true;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0; const say = (s) => report.push(s);
  const get = (id) => { const b = byId.get(id); if (!b) say(`✗ MISSING beat ${id}`); return b || null; };
  const choiceOf = (id, labelRe) => { const b = get(id); if (!b) return null; const c = (b.choices || []).find(c => c && labelRe.test(String(c.label || ""))); if (!c) say(`✗ ${id}: no choice matching ${labelRe}`); return c; };
  const setChoice = (id, labelRe, key, value) => { const c = choiceOf(id, labelRe); if (!c) return; if (JSON.stringify(c[key]) === JSON.stringify(value)) return say(`· ok ${id} choice ${key}`); c[key] = value; changes++; say(`▸ ${id}: choice "${c.label}" ${key} = ${JSON.stringify(value)}`); };
  const setField = (id, k, v) => { const b = get(id); if (!b) return; if (JSON.stringify(b[k]) === JSON.stringify(v)) return say(`· ok ${id} ${k}`); b[k] = v; changes++; say(`⚙ ${id}: ${k} = ${JSON.stringify(v)}`); };
  const dropTag = (id, tag) => { const b = get(id); if (!b) return; const tags = String(b.tags || "").split(/[\s,]+/).filter(Boolean); if (!tags.includes(tag)) return say(`· ok ${id} (no tag ${tag})`); b.tags = tags.filter(t => t !== tag).join(" "); changes++; say(`🏷 ${id}: −tag ${tag}`); };
  const addGate = (id, cond) => { const b = get(id); if (!b) return; b.inject = b.inject || {}; const rs = Array.isArray(b.inject.requires) ? b.inject.requires : (b.inject.requires ? [b.inject.requires] : []); b.inject.requires = rs; if (rs.some(c => JSON.stringify(c) === JSON.stringify(cond))) return say(`· ok ${id} gate`); rs.push(cond); changes++; say(`⛩ ${id}: +gate ${JSON.stringify(cond)}`); };

  // D-1
  setChoice("ag_crossroads_first_rides", /make camp/i, "requires", [{ anyOf: [{ beatMark: "ag_ride_khezek_tor" }, { beatMark: "ag_ride_lyrenn" }] }]);
  setChoice("lyrenn_forest_will_not_be_fought", /tifaret accord/i, "requires", [{ anyOf: [{ beatMark: "forest_of_tifaret_harmonious_ending" }, { beatMark: "forest_of_tifaret_harmonious_lite" }] }]);
  setChoice("forest_of_tifaret_merge", /lyrenn treaty/i, "requires", [{ beatMark: "lyrenn_forest_will_not_be_fought_negotiate" }]);
  // D-2
  setChoice("allesh_gilliam_the_long_market_intro", /^follow up/i, "cooldownTurns", 1);
  // D-9
  setField("enc_circuit_riders_parley_approach", "pinLeg", { to: "Lyrenn" });
  addGate("enc_circuit_riders_parley_approach", { flag: "turn", gte: 2 });
  dropTag("enc_circuit_riders_parley_approach", "inject.travel_threshold");
  setField("forest_of_tifaret_approach", "pinLeg", { to: "Furrier's Fixit-Farm" });
  // D-3 (militia rungs): the Bandit Accord's ABSORPTION makes the Town Militia STANDING (worldEffects.militia → api.raid.militia)
  { const b = get("bandit_summit_absorption"); if (b) { b.worldEffects = (b.worldEffects && typeof b.worldEffects === "object") ? b.worldEffects : {}; if (JSON.stringify(b.worldEffects.militia) !== JSON.stringify({ rung: 3 })) { b.worldEffects.militia = { rung: 3 }; changes++; say("⚙ bandit_summit_absorption: worldEffects.militia = {rung:3} (STANDING)"); } else say("· ok bandit_summit_absorption militia"); } }

  console.log(`[patch-story-flow-phase-d] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Phase D patch DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-phase-d-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Phase D patch APPLIED: ${changes} change(s). Backup downloaded.`);
})();
