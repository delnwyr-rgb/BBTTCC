/**
 * patch-kt-word-shipment-darkness-2026-10-28.macro.js — Dave, 10-28 (after the Seal run):
 *   "give the rest of the Official Word doors too" · "bring the Shipment quest back later in the arc, as an indication that
 *   the Mountain is not yet calm and the darkness is still trying to escape" · "darkness should be sitting pretty heavy on
 *   KT until this round of cleansing — but it's not gone until the 100 are redeemed and the energy they are holding
 *   reintegrated into the KT mine."
 *
 * A. OFFICIAL WORD DOORS (its steps were director-only, like the Mine was). Each hides once its beat has played:
 *    switchback hub → Brennig's desk · the bench (place setting, after the desk) · give the Official Word (after the bench);
 *    the Maw → the cage shaft with Sable (after the desk, until the manifest is found);
 *    Allesh-Gilliam Waiting Room "Put the manifest on the bar." now waits for the manifest (it showed from Act 0).
 * B. THE SHIPMENT COMES BACK IN ACT 3 as its own quest `kt_shipment` (registry quest_2Gs2dsKhv7G1OYBl): un-deferred
 *    (storyPhase ≥ 9 gate + _deferred removed), opens at storyPhase ≥ 3 once Khezek-Tor has squared up. "The Mountain
 *    Squares Up" no longer waits on it (it closes the Khezek-Tor quest, and the Act 3 door waits on it). The chapter
 *    leaves the Khezek-Tor quest; the Log gets a two-step script.
 * C. KHEZEK-TOR'S DARKNESS (needs world-mutation-engine `worldEffects.hexDarkness`, 2026-10-28, deployed FIRST):
 *    arriving (town walk / main scene / switchback hub) holds the hex at ≥ 5 pips (dark ground feeds the Domain +1/turn)
 *    until the Seal is decided; restore / redirect → 2 pips, break → 4 pips, all with a FLOOR of 2 that no rite, raid or
 *    cleansing gets under — only the 100's release beat (not written yet) lifts it: { hexName:"Khezek-Tor", floor:0, set:0 }.
 *    The Shipment stirs it (+2 on acceptance); standardize / rite settle it back to 2; ignore adds 1.
 * D. LIVE CATCH-UP: a world where the Seal is already decided gets its post-Seal darkness + floor now.
 * Idempotent (rerun = 0). DRY_RUN first. Backup of `campaigns` → Data/bbttcc-exports/. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid];
  if (!camp) return ui.notifications.error("Active campaign not found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : (camp.beats = Object.values(camp.beats || {}));
  const byId = (id) => beats.find(b => b && String(b.id) === id);
  const J = (x) => JSON.stringify(x);
  const report = []; const conflicts = []; let changes = 0;
  const OW = "quest_kt_official_word", SHIP = "quest_2Gs2dsKhv7G1OYBl", KT = "Khezek-Tor";
  const SEAL_DONE = ["khezek_tor_the_vaulhaulan_seal_restore", "khezek_tor_the_vaulhaulan_seal_redirect", "khezek_tor_the_vaulhaulan_seal_break"];

  // ── A. Official Word doors ──
  const door = (hostId, beforeRe, d) => {
    const host = byId(hostId); if (!host) return conflicts.push(`${hostId}: not found`);
    if (!byId(d.next)) return conflicts.push(`${d.next}: target missing`);
    host.choices = Array.isArray(host.choices) ? host.choices : [];
    if (host.choices.some(c => c?.next === d.next)) return;
    const at = host.choices.findIndex(c => beforeRe.test(String(c?.label || "").trim()));
    const ch = { label: d.label, next: d.next, description: "", checkStat: "", checkDC: 0, failNext: "", gate: d.gate };
    if (at >= 0) host.choices.splice(at, 0, ch); else host.choices.push(ch);
    changes++; report.push(`+ ${hostId}: "${d.label}" → ${d.next}`);
  };
  const active = { questBucket: OW, is: "active" };
  door("khezek_tor_quest_scene", /^call it a day$/i, { label: "Brennig's desk — two pallets and a door", next: "kt_brennig_desk",
    gate: [active, { beatMark: "kt_brennig_desk", not: true }] });
  door("khezek_tor_quest_scene", /^call it a day$/i, { label: "The bench — the place Brennig sets", next: "kt_place_setting",
    gate: [active, { beatMark: "kt_brennig_desk" }, { beatMark: "kt_place_setting", not: true }] });
  door("khezek_tor_quest_scene", /^call it a day$/i, { label: "The cookline — give the Official Word", next: "kt_official_word",
    gate: [active, { beatMark: "kt_place_setting" }, { beatMark: "kt_official_word", not: true }] });
  door("khezek_tor_the_maw", /^leave$/i, { label: "The cage shaft below Four — with Sable Nine", next: "kt_cage_shaft",
    gate: [active, { beatMark: "kt_brennig_desk" }, { beatMark: "kt_dropped_manifest", not: true }] });
  {
    const wr = byId("allesh_gilliam_waiting_room_intro");
    const ch = (wr?.choices || []).find(c => c?.next === "kt_good_room");
    if (!ch) conflicts.push("allesh_gilliam_waiting_room_intro: manifest choice not found");
    else if (!Array.isArray(ch.gate) || !ch.gate.length) {
      ch.gate = [active, { beatMark: "kt_dropped_manifest" }, { beatMark: "kt_back_room_roster", not: true }];
      changes++; report.push(`✎ Waiting Room "${ch.label}": waits for the dropped manifest`);
    }
  }

  // ── B. The Shipment → Act 3, its own quest ──
  const SHIP_BEATS = ["khezek_tor_yard_exterior", "khezek_tor_darkness_shipment_quest_acceptance", "khezek_tor_darkness_shipment",
    "khezek_tor_darkness_shipment_standardize", "khezek_tor_darkness_shipment_rite", "khezek_tor_darkness_shipment_ignore", "khezek_tor_shipment_fail"];
  const OPENERS = ["khezek_tor_yard_exterior", "khezek_tor_darkness_shipment_quest_acceptance"];
  const OPEN_REQ = [{ flag: "storyPhase", gte: 3 }, { beatMark: "khezek_hex_settles" }, { questBucket: SHIP, isNot: "active" }, { questBucket: SHIP, isNot: "completed" }];
  const STORY = {
    khezek_tor_darkness_shipment_quest_acceptance: { quest: "kt_shipment", role: "start" },
    khezek_tor_darkness_shipment: { quest: "kt_shipment" },
    khezek_tor_shipment_fail: { quest: "kt_shipment" },
    khezek_tor_darkness_shipment_standardize: { quest: "kt_shipment", role: "closer", ending: "standardize" },
    khezek_tor_darkness_shipment_rite: { quest: "kt_shipment", role: "closer", ending: "rite" },
    khezek_tor_darkness_shipment_ignore: { quest: "kt_shipment", role: "closer", ending: "ignore" }
  };
  for (const id of SHIP_BEATS) {
    const b = byId(id); if (!b) { conflicts.push(`${id}: not found`); continue; }
    b.inject = b.inject || {};
    const before = J(b.inject.requires || null) + J(b._deferred || null) + J(b.story || null);
    let req = Array.isArray(b.inject.requires) ? b.inject.requires : [];
    req = req.filter(r => !(r && r.flag === "storyPhase" && Number(r.gte) >= 9))
      .map(r => (r && r.flag === "storyPhase" && Number(r.gte) === 2) ? { ...r, gte: 3 } : r);   // the whole chapter is Act 3 now
    if (OPENERS.includes(id)) req = JSON.parse(J(OPEN_REQ));
    b.inject.requires = req;
    delete b._deferred;
    if (STORY[id]) b.story = STORY[id];
    if (J(b.inject.requires || null) + J(b._deferred || null) + J(b.story || null) !== before) { changes++; report.push(`✎ ${id}: un-deferred → Act 3 kt_shipment`); }
  }
  {
    const acc = byId("khezek_tor_darkness_shipment_quest_acceptance");
    const LEAD = "Khezek Tor squared up. It did not calm down. ";
    if (acc && !String(acc.description || "").startsWith(LEAD)) { acc.description = LEAD + String(acc.description || ""); changes++; report.push("✎ Shipment acceptance: lead-in line"); }
  }
  {
    const st = byId("khezek_hex_settles");
    const req = st?.inject?.requires;
    if (Array.isArray(req) && req.some(r => r?.questBucket === SHIP)) {
      st.inject.requires = req.filter(r => r?.questBucket !== SHIP); changes++;
      report.push("✎ khezek_hex_settles: no longer waits on the Shipment");
    }
  }
  camp.story = camp.story || {}; camp.story.quests = camp.story.quests || {}; camp.story.scripts = camp.story.scripts || {};
  const CH = "the_shipment_of_utter_darkness_sometimes";
  if (camp.story.quests.khezek_tor?.chapters?.[CH]) { delete camp.story.quests.khezek_tor.chapters[CH]; changes++; report.push("✎ Khezek-Tor quest: Shipment chapter removed"); }
  if (camp.story.scripts.khezek_tor?.chapters?.[CH]) { delete camp.story.scripts.khezek_tor.chapters[CH]; changes++; report.push("✎ Khezek-Tor script: Shipment chapter removed"); }
  if (!camp.story.quests.kt_shipment) {
    camp.story.quests.kt_shipment = { name: "The Shipment of UTTER DARKNESS Sometimes", act: 3, keystone: false, hex: KT, registryId: SHIP, chapters: {} };
    changes++; report.push("+ story quest kt_shipment (Act 3)");
  }
  if (!camp.story.scripts.kt_shipment) {
    camp.story.scripts.kt_shipment = {
      giver: "Quartermaster Brennig",
      description: "Khezek Tor squared up. The mountain didn't. Crates out of the Yard hum on the road, and whoever hauls them dreams badly.",
      steps: [
        { id: "yard", label: "The Yard", where: KT, line: "Go to the Yard in Khezek-Tor and see what Brennig's manifest won't say.",
          beats: ["khezek_tor_yard_exterior", "khezek_tor_darkness_shipment_quest_acceptance"],
          done: { anyOf: ["khezek_tor_darkness_shipment_quest_acceptance", "khezek_tor_darkness_shipment"] },
          logged: "Brennig's crates hum on the road, and the people who haul them dream badly." },
        { id: "decide", label: "Standardize, Rite, or Ignore", line: "Decide how Khezek Tor ships what it digs: standardize the handling, perform a rite, or ignore it.",
          beats: ["khezek_tor_darkness_shipment", "khezek_tor_shipment_fail"],
          done: { anyOf: ["khezek_tor_darkness_shipment_standardize", "khezek_tor_darkness_shipment_rite", "khezek_tor_darkness_shipment_ignore"] },
          logged: "You decided how Khezek Tor ships what it digs." }
      ],
      doors: [], after: [], chapters: {}
    };
    changes++; report.push("+ story script kt_shipment (2 steps)");
  }

  // ── C. Khezek-Tor's darkness ──
  const FLOOR_NOTE = "Not gone until the hundred are redeemed and what they hold comes home to the mine.";
  const HD = {
    khezek_tor_town_walk:   { hexName: KT, floor: 5, unless: SEAL_DONE, note: "The mountain's grief sits on the town until the Seal is dealt with." },
    khezek_tor_main_scene:  { hexName: KT, floor: 5, unless: SEAL_DONE, note: "The mountain's grief sits on the town until the Seal is dealt with." },
    khezek_tor_quest_scene: { hexName: KT, floor: 5, unless: SEAL_DONE, note: "The mountain's grief sits on the town until the Seal is dealt with." },
    khezek_tor_the_vaulhaulan_seal_restore:  { hexName: KT, set: 2, floor: 2, note: FLOOR_NOTE },
    khezek_tor_the_vaulhaulan_seal_redirect: { hexName: KT, set: 2, floor: 2, note: FLOOR_NOTE },
    khezek_tor_the_vaulhaulan_seal_break:    { hexName: KT, set: 4, floor: 2, note: FLOOR_NOTE },
    khezek_tor_darkness_shipment_quest_acceptance: { hexName: KT, delta: 2 },
    khezek_tor_darkness_shipment_standardize: { hexName: KT, set: 2 },
    khezek_tor_darkness_shipment_rite:        { hexName: KT, set: 2 },
    khezek_tor_darkness_shipment_ignore:      { hexName: KT, delta: 1 }
  };
  for (const [id, row] of Object.entries(HD)) {
    const b = byId(id); if (!b) { conflicts.push(`${id}: not found`); continue; }
    b.worldEffects = b.worldEffects || {};
    if (J(b.worldEffects.hexDarkness || null) === J([row])) continue;
    b.worldEffects.hexDarkness = [row]; changes++;
    report.push(`✎ ${id}: hexDarkness ${J(row)}`);
  }

  // ── D. live catch-up: the Seal already decided here ──
  let liveFix = null;
  try {
    const played = game.bbttcc?.api?.campaign?.story?.state?.(cid)?.played || {};
    const done = SEAL_DONE.find(id => played[id]);
    if (done) {
      const norm = (x) => String(x || "").replace(/[\s ]+/g, " ").trim().replace(/^[^\p{L}\p{N}]+/u, "").trim().toLowerCase();
      let doc = null;
      for (const sc of game.scenes) { for (const d of sc.drawings) { const tf = d.flags?.["bbttcc-territory"]; if (tf && (tf.isHex === true || tf.kind === "territory-hex") && norm(tf.name || d.text) === norm(KT)) { doc = d; break; } } if (doc) break; }
      if (!doc) conflicts.push("live catch-up: Khezek-Tor hex not found");
      else if (!(Number(doc.flags["bbttcc-territory"].darknessFloor) > 0)) {
        const set = done.endsWith("_break") ? 4 : 2;
        liveFix = { doc, set, before: Number(doc.flags["bbttcc-territory"].mods?.darkness || 0) };
        changes++; report.push(`✎ LIVE hex Khezek-Tor: darkness ${liveFix.before} → ${set}, floor 2 (${done} already played)`);
      }
    }
  } catch (eL) { conflicts.push("live catch-up failed: " + eL.message); }

  console.log(`[kt word/shipment/darkness 2026-10-28] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n") + (conflicts.length ? "\n⚠ " + conflicts.join("\n⚠ ") : ""));
  globalThis.__ktWordShipReport = { dry: DRY_RUN, changes, report, conflicts };
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s), ${conflicts.length} conflict(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    try { await FP.createDirectory("data", "bbttcc-exports"); } catch (_e) {}
    await FP.upload("data", "bbttcc-exports", new File([campsWasStr ? campsRaw : JSON.stringify(campsRaw)], `backup-campaigns-pre-kt-word-shipment-${Date.now()}.json`, { type: "application/json" }), {}, { notify: false });
  } catch (e) { return ui.notifications.error("Backup failed — nothing written. " + e.message); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  if (liveFix) {
    const mods = foundry.utils.duplicate(liveFix.doc.flags["bbttcc-territory"].mods || {}); mods.darkness = liveFix.set;
    await liveFix.doc.update({ "flags.bbttcc-territory.mods": mods, "flags.bbttcc-territory.darknessFloor": 2, "flags.bbttcc-territory.darknessFloorNote": FLOOR_NOTE }, { parent: liveFix.doc.parent });
  }
  ui.notifications.info(`Applied ${changes} change(s) — Official Word doors, the Shipment in Act 3, Khezek-Tor's darkness.`);
})();
