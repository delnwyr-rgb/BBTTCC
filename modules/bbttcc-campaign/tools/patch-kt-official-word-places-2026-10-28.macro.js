/**
 * patch-kt-official-word-places-2026-10-28.macro.js — Dave, 10-28 (screenshot of the switchback hub):
 *   "The desk, bench, and cookline choices need descriptions" · "Not sure what the Official Word is here, as we haven't
 *   figured out anything about [who] caused the accident" · "Brennig is currently on The Yard scene, in front of the
 *   Shipment … which doesn't exist" · "two Brennig beats … the same thing, or Brennig stuff?" · "highlight the place on the
 *   map where we want the BT [Brennig Tamsin] encounter to be".
 *
 * PLACES (a map door lights when an active quest's next beat is set on its scene — location-doors.js):
 *   · Brennig's desk → the WAREHOUSE (quartermasters, emptier shelves): kt_brennig_desk(+_fail) sceneId → the Warehouse POV
 *     scene, and the Warehouse door's exterior gains "Find Brennig at his desk". It sat on the Lift Hall scene.
 *   · The bench + the Official Word → the COOKLINE (the Forward Camp door): kt_place_setting / kt_official_word and its
 *     endings sceneId → the cookline scene (they sat on the town map itself, which is no door), and the camp exterior gains
 *     both doors. The Yard disappears on its own (location-doors.js: a door whose opener waits for a later act is off the map).
 *   · Brennig's token is copied onto the Warehouse scene (from the Yard's tainted-shipment scene) — nudge it in place.
 * ORDER (the two Brennig beats are two steps, not one): desk (hear about the middle brother and the manifest below Four) →
 *   the cage shaft with Sable (find the manifest) → the bench (put it on the plate; Brennig tells Night One) → the
 *   Waiting Room roster (Allesh-Gilliam) → the Official Word. The bench now waits for the manifest; the Official Word waits
 *   for the manifest AND the bench; inside it, "with the manifest and the roster" needs both, "with all three" also needs
 *   the Vault's pulled files (Act 4) — those buttons showed with nothing in hand.
 * DESCRIPTIONS on the hub doors (draft lines, Dave to wordsmith).
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const camp = camps?.[game.bbttcc?.api?.campaign?.getActiveCampaignId?.()];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const J = (x) => JSON.stringify(x);
  const report = []; const conflicts = []; let changes = 0;
  const OW = "quest_kt_official_word";
  const WAREHOUSE = "SmH9AjUZdTemiojo", COOKLINE = "zjvWawdpsN48jE3H", YARD = "SQACQa2o9GEhOYHz";
  const active = { questBucket: OW, is: "active" };
  const M = (id) => ({ beatMark: id }), notM = (id) => ({ beatMark: id, not: true });

  // ── scenes ──
  const SCENES = { kt_brennig_desk: WAREHOUSE, kt_brennig_desk_fail: WAREHOUSE,
    kt_place_setting: COOKLINE, kt_official_word: COOKLINE, ans_kt_official_word_let_calder_say_it: COOKLINE,
    kt_official_word_given: COOKLINE, kt_official_word_thin: COOKLINE };
  for (const [id, sc] of Object.entries(SCENES)) {
    const b = byId(id); if (!b) { conflicts.push(`${id}: not found`); continue; }
    if (b.sceneId === sc) continue;
    report.push(`✎ ${id}: sceneId ${b.sceneId || "(none)"} → ${sc}`); b.sceneId = sc; changes++;
  }

  // ── doors: set label/description/gate on an existing choice (by next), or add it before `beforeRe` ──
  const door = (hostId, beforeRe, d) => {
    const host = byId(hostId); if (!host) return conflicts.push(`${hostId}: not found`);
    host.choices = Array.isArray(host.choices) ? host.choices : [];
    let ch = host.choices.find(c => c?.next === d.next);
    if (!ch) {
      ch = { label: d.label, next: d.next, description: d.description, checkStat: "", checkDC: 0, failNext: "", gate: d.gate };
      const at = host.choices.findIndex(c => beforeRe.test(String(c?.label || "").trim()));
      if (at >= 0) host.choices.splice(at, 0, ch); else host.choices.push(ch);
      changes++; return report.push(`+ ${hostId}: "${d.label}" → ${d.next}`);
    }
    const before = J([ch.label, ch.description || "", ch.gate || null]);
    ch.label = d.label; ch.description = d.description; ch.gate = d.gate;
    if (J([ch.label, ch.description, ch.gate]) !== before) { changes++; report.push(`✎ ${hostId}: "${d.label}"`); }
  };
  const DESK = { label: "The Warehouse — Brennig's desk", next: "kt_brennig_desk",
    description: "Quartermaster Brennig keeps the whole mountain's paperwork on two pallets and a door. If anyone knows what that night's shift list should have said, it's him.",
    gate: [active, notM("kt_brennig_desk")] };
  const BENCH = { label: "The cookline — the place Brennig sets", next: "kt_place_setting",
    description: "Every shift, Brennig sets a place on the bench that nobody sits in. You have something that belongs on that plate.",
    gate: [active, M("kt_dropped_manifest"), notM("kt_place_setting")] };
  const WORD = { label: "The cookline — give the Official Word", next: "kt_official_word",
    description: "Nobody from the outfit has said a word about the Cough. Stand up at the cookline and tell the crews what you know, and what you can prove.",
    gate: [active, M("kt_dropped_manifest"), M("kt_place_setting"), notM("kt_official_word")] };
  door("khezek_tor_quest_scene", /^call it a day$/i, DESK);
  door("khezek_tor_quest_scene", /^call it a day$/i, BENCH);
  door("khezek_tor_quest_scene", /^call it a day$/i, WORD);
  door("khezek_tor_warehouse_exterior", /^go in$/i, { ...DESK, label: "Find Brennig at his desk" });
  door("khezek_tor_camp_door_exterior", /^go in$/i, { ...BENCH, label: "The place Brennig sets on the bench" });
  door("khezek_tor_camp_door_exterior", /^go in$/i, { ...WORD, label: "Give the Official Word" });

  // ── the plate needs the manifest; the Official Word's receipts need the receipts ──
  const gateChoice = (hostId, re, gate) => {
    const host = byId(hostId); const ch = (host?.choices || []).find(c => re.test(String(c?.label || "")));
    if (!ch) return conflicts.push(`${hostId}: choice ${re} not found`);
    if (J(ch.gate || null) === J(gate)) return;
    ch.gate = gate; changes++; report.push(`✎ ${hostId}: "${ch.label}" gated`);
  };
  gateChoice("kt_place_setting", /^Put the dropped manifest on the plate/i, [M("kt_dropped_manifest")]);
  for (const host of ["kt_official_word", "ans_kt_official_word_let_calder_say_it"]) {
    gateChoice(host, /^Say it with all three/i, [M("kt_dropped_manifest"), M("kt_back_room_roster"), M("maneuver_vault_pulled_files")]);
    gateChoice(host, /^Say it, with the manifest and the roster/i, [M("kt_dropped_manifest"), M("kt_back_room_roster")]);
  }

  // ── Brennig's token on the Warehouse scene (copied from the Yard's scene) ──
  let tokenCopy = null;
  try {
    const wh = game.scenes.get(WAREHOUSE), yd = game.scenes.get(YARD);
    const have = wh?.tokens?.contents?.some(t => /brennig/i.test(t.name || ""));
    const src = yd?.tokens?.contents?.find(t => /brennig/i.test(t.name || ""));
    if (!wh || !yd) conflicts.push("Warehouse or Yard scene not found");
    else if (!have && src) { tokenCopy = { wh, data: src.toObject() }; changes++; report.push(`+ token "${src.name}" → ${wh.name}`); }
    else if (!have) conflicts.push("no Brennig token on the Yard scene to copy");
  } catch (eT) { conflicts.push("token copy check failed: " + eT.message); }

  console.log(`[kt official word places 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktOwPlaces = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-ow-places-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (tokenCopy) { const d = tokenCopy.data; delete d._id; await tokenCopy.wh.createEmbeddedDocuments("Token", [d]); }
  ui.notifications.info(`Applied ${changes} change(s) — Brennig at the Warehouse, the bench and the Official Word at the cookline.`);
})();
