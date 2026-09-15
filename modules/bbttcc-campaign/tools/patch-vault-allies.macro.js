// Bad Eden — the Vault makes Allies; the Back Stairs and the Generator open (2026-09-15) — DRY_RUN
// ─────────────────────────────────────────────────────────────────────────────
// Owner rulings (2026-09-15) on the authoring items left open by the Director rebuild:
//   1. The Back Stairs + the Generator Hall at Furrier's Fixit Farm open AFTER the players have rescued Pip
//      (IF they do). The game mechanic is the Stewards' standing with the Jackalopes: the two Vault RESCUE
//      closers (Pip shaken · Pip changed) set the coalition ↔ Jackalopes standing to ALLIED; the two gated
//      beats wait on `{ relation: <Jackalopes>, is: "allied" }` (hardGate — checked on every path). "Pip
//      absorbed" makes no allies. Both beats get heavier prose: they are the reward for the alliance.
//   2. Siege Week (fifteen_year_siege · siege_week) is a stub for a Festival arc that was never authored →
//      the chapter goes: `siege_festival` deleted, the Charter closer no longer starts it, registry row gone.
//   3. The Touring Gift is a chapter of "A Gift. (Not a Trojan.)" already; what it lacked was an ENDING.
//      `trojan_tour` gains "Someone finally keeps it" → `trojan_tour_kept` (chapter ending "kept").
//   4. Lars von Replicator's +1 economy OP offer stays prose (owner reminded; not built here).
//   5. The Sarmoung Hum gets a quest registry row (quest_sarmoung_hum) so the Quest Log shows what the store knows.
//   6. The Valhaulan Spine's registry description becomes player-facing (it was Director dev text).
// Idempotent. Backs up `campaigns` before writing. The story-model's QUEST_MAP dropped the siege_week chapter
// in the same commit (story-model.js), so the Quest Log / Visualizer never show it again.

const JACKALOPES = "U5YaO2p189LBMvVq";   // "Furrier's Fixit Farm" faction actor (Ember) — the Jackalopes
const HUM_Q = "quest_sarmoung_hum", SPINE_Q = "quest_valhaulan_spine";
const FIXIT_Q = "quest_nrkJabUwZOLAJFYn", VAULT_Q = "quest_NwiADv8ZDoklqwEJ", TOURING_Q = "quest_touring_gift", SIEGE_WEEK_Q = "quest_siege_festival";

// pure: patch(camp, registry) → { report, changed, deletedRegistry } — the same function the offline check runs
function patch(camp, registry) {
  const report = []; let changed = 0; const toDelete = [];
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const refsTo = (id) => camp.beats.filter(o => String(o.id) !== id && !toDelete.includes(String(o.id)) && JSON.stringify(o).includes(`"${id}"`)).map(o => o.id);
  const setDesc = (b, html, what) => { if (String(b.description || "") === html) { report.push(`· ok (already) ${b.id} prose`); return; } b.description = html; changed++; report.push(`✚ ${b.id}: ${what}`); };

  // ── 1a. the Vault's rescue closers make ALLIES ────────────────────────────────────────────────
  const ALLY_ROWS = [
    { sourceFactionId: "@coalition", targetFactionId: JACKALOPES, setStatus: "allied", reason: "The Stewards brought Pip home from the Vault" },
    { sourceFactionId: JACKALOPES, targetFactionId: "@coalition", setStatus: "allied", reason: "The Stewards brought Pip home from the Vault" }
  ];
  const GM_ALLY = `<p>(⚙ GM: the Jackalopes are <b>ALLIES</b> now — Mara's word, which she gives once. At Furrier's Fixit Farm the <b>Back Stairs</b> and the <b>Generator Hall</b> open to the Stewards.)</p>`;
  for (const id of ["maneuver_vault_pip_shaken", "maneuver_vault_pip_changed"]) {
    const b = byId.get(id); if (!b) { report.push(`⚠ missing ${id}`); continue; }
    b.worldEffects = Object.assign({}, b.worldEffects || {});
    const have = Array.isArray(b.worldEffects.relationshipEffects) ? b.worldEffects.relationshipEffects : [];
    if (!have.some(r => String(r?.targetFactionId) === JACKALOPES && String(r?.setStatus) === "allied")) { b.worldEffects.relationshipEffects = have.concat(ALLY_ROWS); changed++; report.push(`✚ ${id}: relationshipEffects → coalition ↔ Jackalopes ALLIED`); }
    else report.push(`· ok (already) ${id} sets allied`);
    if (!String(b.description || "").includes("ALLIES</b> now")) { b.description = String(b.description || "") + GM_ALLY; changed++; report.push(`✚ ${id}: GM line (allies; the Farm opens)`); }
    if (!String(b.memoryText || "").includes("Allies")) { b.memoryText = String(b.memoryText || "").trim() + " The Jackalopes call the Stewards Allies now."; changed++; report.push(`✚ ${id}: memoryText`); }
  }

  // ── 1b. the Back Stairs + the Generator Hall: allies only, and worth it ────────────────────────
  const GATE = [{ flag: "storyPhase", gte: 2 }, { relation: JACKALOPES, is: "allied" }];
  const stairs = byId.get("fixit_backstairs_exterior"), hall = byId.get("fixit_power_station_exterior");
  for (const b of [stairs, hall]) {
    if (!b) { report.push(`⚠ missing a gated Farm beat`); continue; }
    if (b.inject?.hardGate === true && JSON.stringify(b.inject.requires) === JSON.stringify(GATE)) report.push(`· ok (already) ${b.id} gated on the alliance`);
    else { b.inject = Object.assign({}, b.inject || {}, { hardGate: true, requires: GATE }); changed++; report.push(`✚ ${b.id}: hardGate + requires (Act 2 · standing with the Jackalopes is ALLIED)`); }
  }
  if (stairs) {
    setDesc(stairs, `<p>The door at the top of the back stairs has a sign — <b>OFF LIMITS. SCRAM.</b> — and, since the Vault, a second sign nailed under it in Mara's hand: <b>EXCEPT STEWARDS.</b></p>
<p>Pip is sitting on the third step with his cap on backwards, pretending he wasn't waiting. "She says you're allowed up. She says it like it costs her something." A beat. "It does."</p>
<p>Up the stairs is the Fixit behind the Fixit: the Jackalopes' <b>runner loft</b>, where every message, light cargo, and rumor that crosses the coast gets a peg on the wall before it gets a road. Allies read the wall. Nobody else knows there is a wall.</p>
<p>(⚙ GM: <b>ALLIES ONLY</b> — the gate is the Jackalopes' standing with the coalition, set when the Stewards brought Pip home from the Vault. The reward is the runner network: a look at the pegs tells the party what is moving between hexes this turn, and who is paying to move it. The loft set is unbuilt — run it as a described scene until it is.)</p>`, "Back Stairs prose (allies' reward: the runner loft)");
    stairs.choices = [
      { label: "Go up", next: "", description: "The loft. (Set unbuilt — described scene.)", checkStat: "", checkDC: 0, failNext: "" },
      { label: "Leave", next: "fixit_intro_scene", description: "", checkStat: "", checkDC: 0, failNext: "" }
    ];
    if (String(stairs.type) !== "dialog") { stairs.type = "dialog"; changed++; report.push(`✚ fixit_backstairs_exterior: type skill_scene → dialog (no raid stub)`); }
  }
  if (hall) {
    setDesc(hall, `<p>Patter walks you around the back of the Generator Hall the way you'd show a friend a scar. Allies get the tour. Nobody else gets within the fence.</p>
<p>The exterior of the Generator Hall is a testimony to the ingenuity of Jackalopes. And their contractors, I suppose. This place shouldn't work. Like — it REALLY should have killed a lot of people. In a several hundred mile radius.</p>
<p>Instead, it provides a community service.</p>
<p>Just goes to show you ... something!</p>
<p>(⚙ GM: <b>ALLIES ONLY</b> — same gate as the Back Stairs. The Hall is how Furrier's keeps the lights on where nothing should, and the Jackalopes will say so, once, to allies: what it burns, what it leaks, and what they would need to run a line from here to one coalition settlement. Author that line as a facility / world modifier on the chosen hex when the table earns it.)</p>`, "Generator Hall prose (allies' tour)");
  }

  // ── 2. Siege Week goes ──────────────────────────────────────────────────────────────────────────
  const charter = byId.get("siege_charter");
  if (charter) {
    const rows = Array.isArray(charter.worldEffects?.questEffects) ? charter.worldEffects.questEffects : [];
    const kept = rows.filter(r => String(r?.questId) !== SIEGE_WEEK_Q);
    if (kept.length !== rows.length) { charter.worldEffects.questEffects = kept; changed++; report.push(`✚ siege_charter: Siege Week accept row removed`); }
    if (charter.story && Array.isArray(charter.story.alsoStarts)) {
      const as = charter.story.alsoStarts.filter(x => String(x?.chapter) !== "siege_week");
      if (as.length !== charter.story.alsoStarts.length) { if (as.length) charter.story.alsoStarts = as; else delete charter.story.alsoStarts; changed++; report.push(`✚ siege_charter: story.alsoStarts siege_week removed`); }
    }
    if (!charter.story?.__hand) { charter.story = Object.assign({}, charter.story || {}, { __hand: true }); changed++; report.push(`✚ siege_charter: story __hand (migration keeps it)`); }
  }
  if (byId.get("siege_festival")) { const r = refsTo("siege_festival"); if (r.length) report.push(`⚠ KEPT siege_festival: referenced by ${r.join(", ")}`); else { toDelete.push("siege_festival"); report.push(`− siege_festival (Siege Week stub)`); } }
  else report.push(`· gone already: siege_festival`);
  let deletedRegistry = false;
  if (registry && registry[SIEGE_WEEK_Q]) { delete registry[SIEGE_WEEK_Q]; deletedRegistry = true; report.push(`− registry row ${SIEGE_WEEK_Q} (Siege Week)`); }

  // ── 3. the Touring Gift ends when someone keeps it ────────────────────────────────────────────
  const tour = byId.get("trojan_tour");
  if (tour) {
    tour.choices = Array.isArray(tour.choices) ? tour.choices : [];
    if (!tour.choices.some(c => String(c?.next) === "trojan_tour_kept")) { tour.choices.push({ label: "Someone finally keeps it", next: "trojan_tour_kept", description: "The tour ends.", checkStat: "", checkDC: 0, failNext: "" }); changed++; report.push(`✚ trojan_tour: "Someone finally keeps it" → trojan_tour_kept`); }
    else report.push(`· ok (already) trojan_tour routes to the ending`);
  } else report.push(`⚠ missing trojan_tour`);
  if (!byId.get("trojan_tour_kept")) {
    camp.beats.push({
      id: "trojan_tour_kept", label: "Kept (The Tour Ends)", type: "narration", timeScale: "scene", timePoints: 0, tags: "trojan_gift story", politicalTags: "",
      description: `<p>Somebody finally <b>KEEPS</b> it. Not in the sense of storing it — in the sense of a household deciding a thing is theirs and putting the good cups in it.</p>
<p>The reports stop. The manifest, at the last inventory anyone bothered to take, was one layer <b>SHORT</b>: whatever had been riding the quiet berth had, by every account, got where it was going. The coast, which had grown fond of the weather report, is briefly bereft and then invents a holiday.</p>
<p>(⚙ GM: name the keeper — a faction, a household, a town — and let the last layer be the one thing they needed. The berth is cold now. Probably.)</p>`,
      memoryText: "The touring gift was finally KEPT. The reports stopped; the last inventory ran one layer short. The coast invented a holiday.",
      inject: { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: 4 }] },
      worldEffects: { questEffects: [{ action: "complete", questId: TOURING_Q, state: "completed", text: "Kept — the tour is over. The last layer was the one they needed." }] },
      choices: [{ label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }],
      questId: TOURING_Q, questStep: 20, storyChain: "trojan_gift", priority: "background",
      playerFacing: true, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true, refs: {},
      story: { quest: "trojan_gift", chapter: "the_touring_gift", role: "ending", ending: "kept", __hand: true }
    });
    changed++; report.push(`✚ trojan_tour_kept (chapter ending "kept", Act 4)`);
  } else report.push(`· ok (already) trojan_tour_kept exists`);

  // ── 5. the Sarmoung Hum gets a registry row (2026-09-15 reconciliation): the store knew the Hum was in play
  //       (the tent on the first night), the Quest Log could not show it — no row to project into ────────────
  let addedRegistry = false;
  if (registry && !registry[HUM_Q]) {
    registry[HUM_Q] = { id: HUM_Q, v: 1, name: "The Sarmoung Hum", description: "A hum on the roads — heard first at a tent on the edge of Allesh-Gilliam, then wherever the Sarmoung are not quite. Its rungs are met on the way, not sought.", tags: ["sarmoung", "road"], createdTs: Date.now() };
    addedRegistry = true; report.push(`✚ registry row ${HUM_Q} (The Sarmoung Hum — the Quest Log can show it now)`);
  } else if (registry) report.push(`· ok (already) registry has ${HUM_Q}`);

  // ── 6. the Valhaulan Spine's registry description was dev text ("The Story Director's main-arc chain…") and the
  //       Quest Log is player-facing (owner, 2026-09-15) ─────────────────────────────────────────────────────
  const SPINE_DESC = "Something moved under Khezek Tor the night everyone felt it. The Seal on the mine was a signature, and somebody is trying to read it from the sky. Five bridges stand between the mountain and the answer — and the Stewards are standing on the first one.";
  if (registry && registry[SPINE_Q]) {
    if (/Story Director|Container quest|quest-mode tools/i.test(String(registry[SPINE_Q].description || ""))) { registry[SPINE_Q].description = SPINE_DESC; addedRegistry = true; report.push(`✚ registry ${SPINE_Q}: player-facing description (dev text removed)`); }
    else report.push(`· ok (already) ${SPINE_Q} description is player-facing`);
  }

  if (toDelete.length) { camp.beats = camp.beats.filter(b => !toDelete.includes(String(b.id))); changed += toDelete.length; }
  return { report, changed, deletedRegistry: deletedRegistry || addedRegistry, toDelete };
}

(async () => {
  const DRY_RUN = false;
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications?.error("GM only");
  let campaigns = game.settings.get(NS, "campaigns");
  if (typeof campaigns === "string") { try { campaigns = JSON.parse(campaigns); } catch (_e) {} }
  campaigns = foundry.utils.deepClone(campaigns || {});
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = cid && campaigns[cid];
  if (!camp?.beats) return ui.notifications?.error("No active campaign with beats");
  if (!game.actors?.get(JACKALOPES)) return ui.notifications?.error(`Jackalopes faction actor ${JACKALOPES} not in this world — edit JACKALOPES at the top of the macro`);
  let registry = game.settings.get(NS, "quests"); const regStr = typeof registry === "string"; if (regStr) { try { registry = JSON.parse(registry); } catch (_e) { registry = {}; } }
  registry = foundry.utils.deepClone(registry || {});

  const { report, changed, deletedRegistry, toDelete } = patch(camp, registry);

  // the Siege Week chapter may sit in a faction's quest buckets (projection) — drop it there too
  const trackFixes = [];
  const fids = [].concat(camp.factionIds || [], camp.factionId ? [camp.factionId] : []).map(x => String(x || "").replace(/^Actor\./, ""));
  for (const fid of new Set(fids)) {
    const F = game.actors.get(fid); if (!F) continue;
    const t = foundry.utils.deepClone(F.getFlag("bbttcc-factions", "quests") || {}); let hit = false;
    for (const bk of ["active", "completed", "archived"]) if (t?.[bk]?.[SIEGE_WEEK_Q]) { delete t[bk][SIEGE_WEEK_Q]; hit = true; }
    if (hit) trackFixes.push([F, t]);
  }
  if (trackFixes.length) report.push(`− Siege Week from the quest buckets of ${trackFixes.map(([F]) => F.name).join(", ")}`);

  const head = `${DRY_RUN ? "DRY RUN — nothing written" : "APPLIED"} · ${changed} change(s)${toDelete.length ? ` · deleted ${toDelete.join(", ")}` : ""}`;
  console.log("[patch-vault-allies]", head, "\n" + report.join("\n"));
  if (!DRY_RUN && (changed || deletedRegistry || trackFixes.length)) {
    const raw = game.settings.get(NS, "campaigns");
    (foundry.utils.saveDataToFile || saveDataToFile)(typeof raw === "string" ? raw : JSON.stringify(raw), "application/json", `backup-campaigns-before-vault-allies-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await game.settings.set(NS, "campaigns", campaigns);
    if (deletedRegistry) await game.settings.set(NS, "quests", regStr ? JSON.stringify(registry) : registry);
    for (const [F, t] of trackFixes) { await F.unsetFlag("bbttcc-factions", "quests"); await F.setFlag("bbttcc-factions", "quests", t); }
    try { await game.bbttcc?.api?.campaign?.story?.project?.(); } catch (_e) {}
  }
  ChatMessage.create({ whisper: [game.user.id], content: `<div class="bbttcc-chat"><h3>The Vault makes Allies</h3><p>${head}</p><pre style="white-space:pre-wrap;font-size:11px">${report.map(r => r.replace(/</g, "&lt;")).join("\n")}</pre></div>` });
})();
