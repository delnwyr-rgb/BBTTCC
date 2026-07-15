/* repair-quest-assignments.macro.js — give the 181 orphan beats a questId
 * (2026-07-14, from the Turn-47 Campaign Atlas census)
 *
 * WHY: 181 of 620 beats carry no questId — including the entire Bandit
 * Accord / Cadence / Siege / Trojan Gift vignette suites, the Founders'
 * Garden chain, the Valhaulan Spine director beats, and every travel
 * encounter. Their quest records (where they exist) own zero beats, so
 * quest-mode visualization, per-quest VO accounting, and quest filters
 * can't see them.
 *
 * WHAT IT DOES (idempotent, only ever FILLS an empty questId — never
 * overwrites an existing assignment):
 *  · registers two container quests if missing:
 *      quest_valhaulan_spine   "The Valhaulan Spine"
 *      quest_travel_encounters "Travel & Wandering Encounters"
 *  · assigns orphans by rule (first match wins — see RULES below)
 *  · normalizes quests with a missing/empty status → "active"
 *    (seeders historically omitted status; status-filters skip them)
 *  · fixes the one broken hex link found by the census:
 *      Odaroloc River.c onEnterBeatId "hex1_gloomgill_encounter" (no such
 *      beat) → FIX_HEX.to below (default gloomgill_intro — owner-adjustable)
 *
 * DRY_RUN default true; backs up the campaigns+quests settings to a
 * download before writing. Run as GM on EACH instance (settings are
 * per-world).
 */
(async () => {
  const DRY_RUN = false;                 // <-- set false to apply
  const NS = "bbttcc-campaign";

  // Census item 4 — the broken on-enter link. Set `to: null` to skip.
  const FIX_HEX = { name: "Odaroloc River.c", brokenFrom: "hex1_gloomgill_encounter", to: "gloomgill_intro" };

  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : [];
  let questsRaw = game.settings.get(NS, "quests");
  const questsWasStr = typeof questsRaw === "string";
  const quests = questsWasStr ? JSON.parse(questsRaw) : foundry.utils.deepClone(questsRaw);
  const report = [];
  let changes = 0;

  const questIdByName = name => {
    const hit = Object.values(quests).find(q => String(q?.name || "").trim() === name);
    return hit ? hit.id : null;
  };

  // ── container quests ──────────────────────────────────────────────────────
  const ensureQuest = (id, name, description) => {
    if (quests[id]) { report.push(`· ok quest (already) ${name}`); return; }
    quests[id] = { id, v: 1, name, description, tags: [], status: "active", createdTs: 0, updatedTs: 0 };
    changes++; report.push(`✚ quest registered: ${name}`);
  };
  ensureQuest("quest_valhaulan_spine", "The Valhaulan Spine",
    "The Story Director's main-arc chain: five bridge beats that stitch Khezek Tor's seal to the sky. Container quest so the spine is visible to quest-mode tools; the Director still drives firing.");
  ensureQuest("quest_travel_encounters", "Travel & Wandering Encounters",
    "Container for the repeatable travel/wandering encounter suites (enc_*, acid bog, tag-injected events). Ambient content — not a narrative questline.");

  // ── assignment rules (first match wins; only fills EMPTY questId) ────────
  const QID_AG = questIdByName("Allesh-Gilliam");
  const RULES = [
    { test: id => id.startsWith("enc_circuit_riders"), qid: "quest_circuit_riders_parley", why: "Circuit Rider Parley" },
    { test: (id, chain) => id.startsWith("vs_") || chain === "valhaulan_spine", qid: "quest_valhaulan_spine", why: "Valhaulan Spine" },
    { test: id => id.startsWith("founders_garden"), qid: "quest_ninth_guest", why: "The Ninth Guest" },
    { test: id => id.startsWith("thatwards_ho"), qid: "quest_thatwards_ho_finale", why: "Thatwards Ho! Finale" },
    { test: id => id === "allesh_gilliam_opening_scene" || id === "avuncular_joans_speech", qid: QID_AG, why: "Allesh-Gilliam" },
    { test: id => id.startsWith("gullywasher_cultural") || id === "fc_bridge_summit", qid: "fc_cultural_summit", why: "Close the Ledger" },
    { test: (id, chain) => id.startsWith("wendigo_confluence") || id.startsWith("fc_") || id.startsWith("gullywasher_dougan") || chain === "forgotten_cause", qid: "fc_wendigo_confluence", why: "Something a Little Off" },
    { test: id => id === "siege_festival", qid: "quest_siege_festival", why: "Siege Week (Annual)" },
    { test: (id, chain) => id.startsWith("siege_") || chain === "fifteen_year_siege", qid: "quest_fifteen_year_siege", why: "The Fifteen-Year Siege" },
    { test: id => id === "trojan_tour", qid: "quest_touring_gift", why: "The Touring Gift" },
    { test: (id, chain) => id.startsWith("trojan_") || chain === "trojan_gift", qid: "quest_trojan_gift", why: "A Gift. (Not a Trojan.)" },
    { test: (id, chain) => id.startsWith("cadence_") || chain === "cadence", qid: "quest_cadence", why: "The Cadence" },
    { test: (id, chain) => id.startsWith("bandit_") || chain === "bandit_accord", qid: "quest_bandit_accord", why: "The Bandit Accord" },
    { test: id => id.startsWith("enc_") || id.startsWith("acid_bog_") || id.startsWith("apex_predator") || id.startsWith("tags_"), qid: "quest_travel_encounters", why: "Travel & Wandering Encounters" },
    { test: id => id.startsWith("adversary_"), qid: null, why: "adversary-system beat — intentionally unassigned" },
  ];

  const tally = {}; const unmatched = [];
  for (const b of camp.beats) {
    const cur = String(b?.questId || "").trim();
    if (cur) continue; // never overwrite an existing assignment
    const id = String(b?.id || "").trim();
    const chain = String(b?.storyChain || b?.inject?.storyChain || "").trim();
    const rule = RULES.find(r => { try { return r.test(id, chain); } catch { return false; } });
    if (!rule) { unmatched.push(id); continue; }
    if (!rule.qid) { tally[rule.why] = (tally[rule.why] || 0) + 1; continue; } // deliberate leave
    if (!quests[rule.qid]) { unmatched.push(`${id} (target quest ${rule.qid} missing!)`); continue; }
    b.questId = rule.qid;
    changes++; tally[rule.why] = (tally[rule.why] || 0) + 1;
  }
  for (const [why, n] of Object.entries(tally)) report.push(`⚡ ${String(n).padStart(3)} beat(s) → ${why}`);
  if (unmatched.length) report.push(`⚠ unmatched orphans left as-is: ${unmatched.join(", ")}`);

  // ── quest status normalize ────────────────────────────────────────────────
  for (const q of Object.values(quests)) {
    if (String(q?.status || "").trim()) continue;
    q.status = "active";
    changes++; report.push(`⚡ status → active: ${q.name || q.id}`);
  }

  // ── broken hex on-enter fix (census item 4) ───────────────────────────────
  if (FIX_HEX?.to) {
    const beatExists = camp.beats.some(b => String(b?.id) === FIX_HEX.to);
    if (!beatExists) report.push(`⚠ hex fix skipped: target beat "${FIX_HEX.to}" not found in campaign`);
    else {
      // Hex drawing text uses non-breaking spaces (U+00A0) — collapse all whitespace.
      const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
      let hex = null;
      for (const scene of game.scenes) {
        hex = scene.drawings.contents.find(dr => {
          const f = dr.flags?.["bbttcc-territory"];
          return f && norm(dr.text || f.name) === norm(FIX_HEX.name);
        });
        if (hex) break;
      }
      if (!hex) report.push(`⚠ hex fix skipped: drawing "${FIX_HEX.name}" not found on any scene`);
      else {
        const cur = hex.flags?.["bbttcc-territory"]?.campaign?.onEnterBeatId;
        if (cur === FIX_HEX.to) report.push(`· ok hex (already) ${FIX_HEX.name} → ${FIX_HEX.to}`);
        else if (cur && cur !== FIX_HEX.brokenFrom) report.push(`⚠ hex fix skipped: ${FIX_HEX.name} now points at "${cur}" (expected broken "${FIX_HEX.brokenFrom}") — verify by hand`);
        else {
          changes++; report.push(`⚡ hex on-enter: ${FIX_HEX.name} → ${FIX_HEX.to} (was ${cur || "(empty)"})`);
          if (!DRY_RUN) await hex.update({ "flags.bbttcc-territory.campaign.onEnterBeatId": FIX_HEX.to });
        }
      }
    }
  }

  // ── report + write ────────────────────────────────────────────────────────
  console.log(`[repair-quest-assignments] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Quest-assignment repair DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Quest-assignment repair: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-questfix-${Date.now()}.json`);
    save(questsWasStr ? questsRaw : JSON.stringify(questsRaw), "text/json", `backup-quests-before-questfix-${Date.now()}.json`);
  } catch (e) {
    return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e));
  }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  await game.settings.set(NS, "quests", questsWasStr ? JSON.stringify(quests) : quests);
  ui.notifications.info(`Quest-assignment repair APPLIED: ${changes} change(s). Every beat has a home.`);
})();
