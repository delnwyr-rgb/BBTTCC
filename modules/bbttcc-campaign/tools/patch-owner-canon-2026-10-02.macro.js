/* patch-owner-canon-2026-10-02.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * Dave's plot rulings of 2026-10-02 that touch beats ALREADY seeded live (the seeders skip existing beats, so a re-run would not
 * carry them). The same edits are in seed-crown-mall-retrofit / seed-balcones-retrofit for fresh worlds. One run, one backup.
 *
 *  CROWN MALL — "Marnie on the tape: approved."
 *   • mall_watch_clip gains the hidden choice "That's Marnie." (only if the Stewards have met her at Chuckle Creek:
 *     chuckle_showrunner / chuckle_projector / chuckle_credits); the Camcorder Clip receipt's truth names her for the GM.
 *  BALCONES — "The fault is sliding towards KT. The sigil bridge makes it a real bridge, yes."
 *   • balcones_faulting_you_build_a_bridge gains worldEffects.crossing { hexName: "Saltwake Reach j", name: "The Sigil Bridge" }
 *     (needs world-mutation-engine.js ≥ 2026-10-02: a beat can BUILD a bridge, same flag as the Build Bridge activity), and its
 *     quest text now says which way every sigil points.
 *
 *  TROJAN GIFT — "Keep it. Maybe the Wendigo sent it!"
 *   • trojan_same_hand gains the hidden choice "The name-cards." (only after wendigo_confluence_name_cards): the unreadable hand is
 *     the Long Table's place-card hand. The Clause receipt's truth names the sender for the GM.
 *  FLOODED TOWNS — "The route used to be a military railway."
 *   • The Dispatcher's persona (actor flag bbttcc-mal-voice.persona): the route it is trying to finish is a military railway.
 *
 *  THE HUM RENAME — "Let's go with The Two Tents."
 *   • quest registry (bbttcc-campaign.quests) quest_sarmoung_hum: name + player-facing description + tags carry no "Sarmoung";
 *     the cached questName in every campaign faction's Quest Log buckets; campaign.story.quests.sarmoung_hum.name.
 *  THE CULT CAMP — "the camp needs to be a scene on the Khezek Tor hex itself"
 *   • wt_cult_camp.hexName = "Khezek-Tor" (the wagon's route is a chain, so the location guard still lets it play from Port Kudzu).
 *
 * Safe to re-run if you already applied the first version: everything is idempotent.
 *
 * HOW TO RUN: 1) hard-reload (F5 — loads the engine's new crossing effect); 2) run as-is → console (F12) report;
 *   3) set DRY_RUN = false, run again (backup downloads first); 4) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m);
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id} (already)`); };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  // ── CROWN MALL: Marnie on the tape ──
  const MARNIE = ch("\"That's Marnie.\"", "", { requires: { anyOf: [{ beatMark: "chuckle_showrunner" }, { beatMark: "chuckle_projector" }, { beatMark: "chuckle_credits" }] }, description: "Marnie Vell, before the booth, before the microphone, before the window went white: a projectionist costume she made herself, renting the cartoons Chuckle Creek would watch that night. She is waving at a camera in a mall. Nobody who loved her ever saw this tape. Kickflip stops the deck and does not tape over it." });
  edit("mall_watch_clip", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (!b.choices.some(c => /That's Marnie/.test(String(c.label || "")))) {
      const i = b.choices.findIndex(c => /who was holding the camera/i.test(String(c.label || "")));
      b.choices.splice(i >= 0 ? i + 1 : b.choices.length, 0, MARNIE);
    }
    for (const r of [].concat(b.worldEffects?.receipts || [], b.receipts || [])) {
      if (r && /Camcorder Clip/i.test(String(r.label || "")) && r.truth && !/Marnie/.test(r.truth)) r.truth = String(r.truth).replace("renting cartoons.", "renting cartoons (Marnie Vell of Chuckle Creek, ruled 2026-10-02; the players learn the name only if they have met her).");
    }
  }, "\"That's Marnie.\" (hidden until they've met her) + receipt truth names her");

  // ── BALCONES: the sigil bridge is a real bridge; the fault slides toward Khezek Tor ──
  edit("balcones_faulting_you_build_a_bridge", b => {
    b.worldEffects = b.worldEffects || {};
    if (!b.worldEffects.crossing) b.worldEffects.crossing = { hexName: "Saltwake Reach j", name: "The Sigil Bridge" };
    for (const q of (b.worldEffects.questEffects || [])) if (q && /sigil bridge/i.test(String(q.text || "")) && !/Khezek Tor/.test(q.text)) q.text = String(q.text).trim() + " Every sigil on it leans the same way the land has been sliding: toward Khezek Tor.";
  }, "worldEffects.crossing → a real bridge on Saltwake Reach j; quest text names the slide toward Khezek Tor");

  // ── TROJAN GIFT: the Wendigo sent it ──
  const CARDS = ch("\"The name-cards.\"", "", { requires: { beatMark: "wendigo_confluence_name_cards" }, description: "You have seen this hand before: at the Long Table, on a card for everyone the region forgot, in the same patient copperplate. Pernelle Oday takes her hands off the table. The Wendigo send gifts. They have always sent gifts. They knock first, and they are very sorry about the berth." });
  edit("trojan_same_hand", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (!b.choices.some(c => /name-cards/.test(String(c.label || "")))) b.choices.splice(Math.max(0, b.choices.length - 1), 0, CARDS);
  }, "\"The name-cards.\" (hidden until the Long Table's name-cards) — the hand is the Wendigo's");
  for (const b of camp.beats) for (const r of (b.worldEffects?.receipts || [])) if (r && r.label === "The Clause" && r.truth && !/Wendigo/.test(r.truth)) { r.truth = String(r.truth).trim() + " (GM: the sender is the Wendigo, owner ruling 2026-10-02; the same hand wrote the Siege's year-zero entry and the Long Table's name-cards.)"; changes++; say(`✎ ${b.id}: The Clause receipt names the Wendigo for the GM`); }

  // ── FLOODED TOWNS: the route was a military railway (actor persona, not campaign data) ──
  const RAIL_OLD = "A route. It had one, once, whole,";
  const RAIL_NEW = "A route. A military railway, once: troop trains on a timetable nobody ever cancelled. It had it whole,";
  const actorEdits = [];
  const disp = game.actors?.getName?.("The Dispatcher");
  if (!disp) say("✗ MISSING actor The Dispatcher (seed-flooded-towns-retrofit never ran here?)");
  else {
    const per = foundry.utils.deepClone(disp.getFlag("bbttcc-mal-voice", "persona") || {});
    let hit = false;
    if (typeof per.secretsRaw === "string" && per.secretsRaw.includes(RAIL_OLD)) { per.secretsRaw = per.secretsRaw.replace(RAIL_OLD, RAIL_NEW); hit = true; }
    if (typeof per.notes === "string" && !/military railway/.test(per.notes)) { per.notes = per.notes.trim() + "\n\nTHE ROUTE (owner ruling 2026-10-02): a military railway. The three towns sit on what is left of its line; it reroutes cars because it has no trains."; hit = true; }
    if (hit) { changes++; say("✎ actor The Dispatcher: the route is a military railway"); actorEdits.push(() => disp.setFlag("bbttcc-mal-voice", "persona", per)); } else say("· ok actor The Dispatcher (already)");
  }

  // ── THE CULT CAMP is on the Khezek Tor hex ──
  edit("wt_cult_camp", b => { if (b.hexName !== "Khezek-Tor") b.hexName = "Khezek-Tor"; }, "hexName → Khezek-Tor (the camp is near the mountain)");

  // ── THE HUM RENAME: "The Two Tents" ──
  const HUM_Q = "quest_sarmoung_hum", HUM_NAME = "The Two Tents";
  const HUM_DESC = "Two kinds of tent on the roads now, and Bit and Coll noticed first. Its rungs are met on the way, not sought.";
  const sq = camp.story?.quests?.sarmoung_hum;
  if (sq && sq.name !== HUM_NAME) { sq.name = HUM_NAME; changes++; say(`✎ campaign.story.quests.sarmoung_hum.name → "${HUM_NAME}"`); } else if (sq) say("· ok story quest name (already)");
  let reg = game.settings.get(NS, "quests"); const regStr = typeof reg === "string"; if (regStr) { try { reg = JSON.parse(reg); } catch (_e) { reg = null; } }
  reg = reg ? foundry.utils.deepClone(reg) : null; let regChanged = false;
  if (reg?.[HUM_Q]) {
    const r = reg[HUM_Q];
    if (r.name !== HUM_NAME || r.description !== HUM_DESC || (r.tags || []).includes("sarmoung")) { r.name = HUM_NAME; r.description = HUM_DESC; r.tags = ["road", "tent"]; regChanged = true; changes++; say(`✎ registry ${HUM_Q}: "${HUM_NAME}", description + tags without the word`); } else say("· ok registry name (already)");
  } else say(`✗ registry has no ${HUM_Q}`);
  const fids = [...new Set([].concat(camp.factionIds || [], camp.factionId ? [camp.factionId] : []).map(x => String(x || "").replace(/^Actor\./, "")).filter(Boolean))];
  for (const fid of fids) {
    const F = game.actors.get(fid); if (!F) continue;
    const t = foundry.utils.deepClone(F.getFlag("bbttcc-factions", "quests") || {}); let hit = false;
    for (const bk of ["active", "completed", "archived"]) { const row = t?.[bk]?.[HUM_Q]; if (row && row.questName !== HUM_NAME) { row.questName = HUM_NAME; hit = true; } }
    if (hit) { changes++; say(`✎ ${F.name}'s Quest Log: "${HUM_NAME}"`); actorEdits.push(() => F.setFlag("bbttcc-factions", "quests", t)); }
  }
  if (regChanged) actorEdits.push(() => game.settings.set(NS, "quests", regStr ? JSON.stringify(reg) : reg));

  console.group(`[patch-owner-canon-2026-10-02] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`Owner canon 10-02 DRY RUN: ${changes} change(s) — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("Owner canon 10-02: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-owner-canon-2026-10-02-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  for (const fn of actorEdits) await fn();
  ui.notifications.info(`Owner canon 10-02 applied: ${changes} change(s). F5.`);
})();
