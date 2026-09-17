/**
 * patch-story-flow-fixes.macro.js — GM macro/console. DRY_RUN default true.
 *
 * STORY FLOW EXERCISE (2026-09-15) — the bugs found while curating Acts 0–2 beat by beat
 * (worksheet ~/STORY_FLOW_2026_09_15.md). Owner ruled every item; this macro is the fix.
 *
 *  A. Welcome Round "The Long Market" door → Etta's arrival-day Tea (`allesh_gilliam_etta_welcome`),
 *     not the Act 2 inspection beat.
 *  B. `allesh_gilliam_quest_hub_1` (legacy Act 2 menu, no text) REMOVED. Nothing routes into it.
 *  C. `hum_quiet_tent` is no longer ambient — it fired early (the slate draws ambient beats
 *     anywhere at phase 1). It now plays only from First Night's "Sleep. Tomorrow, the land."
 *  D. Cold Open gets its one line: "This is probably important, please pay attention."
 *  E. Rowan's treeline letter: "Toward you." was appended once per patch run — deduped to one.
 *  F. The forest's two force endings (burn / fight) route to the Lyrenn hub, not back to the forest.
 *  G. Six placeholder stubs get prose: the three Water Choir inspects, the three Seed Vault inspects.
 *  H. Dougan's invite line (Forgotten Cause start) removed — the Gullywasher is found, not announced.
 *
 * Backup download before write, idempotent, GM only.
 */
(async () => {
  const DRY_RUN = false;
  const NS = "bbttcc-campaign";
  if (!game.user.isGM) return ui.notifications.error("GM only.");

  let campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw)
    : foundry.utils.deepClone(campsRaw); // clone: object-typed settings return the LIVE cache — a dry run must never mutate it
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const byId = new Map((camp.beats || []).map(b => [b.id, b]));
  const report = []; let changes = 0;
  const plain = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // A. Long Market door → Etta's Tea.
  {
    const walk = byId.get("allesh_gilliam_town_walk");
    const ch = (walk?.choices || []).find(c => /long market/i.test(String(c.label || c.text || "")));
    if (!walk || !ch) report.push("✗ A: Welcome Round / Long Market choice missing");
    else if (ch.next !== "allesh_gilliam_etta_welcome") {
      report.push(`· A: Long Market door "${ch.next}" → "allesh_gilliam_etta_welcome"`);
      ch.next = "allesh_gilliam_etta_welcome"; changes++;
    } else report.push("· ok A (Long Market door already → Etta's Tea)");
  }

  // B. Remove the legacy quest hub.
  {
    const id = "allesh_gilliam_quest_hub_1";
    const refs = (camp.beats || []).filter(b => b.id !== id && JSON.stringify(b).includes(id)).map(b => b.id);
    if (!byId.has(id)) report.push("· ok B (quest hub 1 already gone)");
    else if (refs.length) report.push(`✗ B: quest hub 1 still referenced by ${refs.join(", ")} — not removed`);
    else { camp.beats = camp.beats.filter(b => b.id !== id); byId.delete(id); changes++; report.push("· B: allesh_gilliam_quest_hub_1 REMOVED"); }
  }

  // C. The tent is a scripted step, not an ambient draw.
  {
    const t = byId.get("hum_quiet_tent");
    if (!t) report.push("✗ C: hum_quiet_tent missing");
    else {
      let n = 0;
      if (t.pacing?.ambient) { t.pacing.ambient = false; n++; }
      const tags = String(t.tags || "").split(/\s+/).filter(Boolean);
      if (tags.includes("ambient")) { t.tags = tags.filter(x => x !== "ambient").join(" "); n++; }
      if (t.priority === "background") { t.priority = "normal"; n++; }
      if (n) { changes += n; report.push(`· C: hum_quiet_tent de-ambiented (${n} field(s)) — plays only from First Night`); }
      else report.push("· ok C (tent already scripted)");
    }
  }

  // D. Cold Open text.
  {
    const c0 = byId.get("thatwards_ho_cold_open");
    const LINE = "This is probably important, please pay attention.";
    if (!c0) report.push("✗ D: thatwards_ho_cold_open missing");
    else if (!plain(c0.description).includes(LINE)) { c0.description = `<p>${LINE}</p>`; changes++; report.push("· D: Cold Open line ADDED"); }
    else report.push("· ok D (Cold Open line already)");
  }

  // E. Dedupe "Toward you." in Rowan's letter.
  {
    const w = byId.get("lyrenn_word_treeline");
    const TAIL = " — and, pressed smaller underneath: 'Toward you.'";
    if (!w) report.push("✗ E: lyrenn_word_treeline missing");
    else {
      const d = String(w.description || "");
      const count = d.split(TAIL).length - 1;
      if (count > 1) { w.description = d.split(TAIL).join("") .replace("'Trees. Moving. Come.'", "'Trees. Moving. Come.'" + TAIL); changes++; report.push(`· E: "Toward you." ×${count} → ×1`); }
      else report.push(`· ok E (Toward you ×${count})`);
    }
  }

  // F. Force endings route to the hub.
  for (const id of ["lyrenn_forest_will_not_be_fought_force_burn", "lyrenn_forest_will_not_be_fought_force_fight"]) {
    const b = byId.get(id);
    const ch = (b?.choices || []).find(c => c.next === "lyrenn_forest_will_not_be_fought");
    if (!b) report.push(`✗ F: ${id} missing`);
    else if (ch) { ch.next = "lyrenn_quest_scene"; changes++; report.push(`· F: ${id} Leave → lyrenn_quest_scene`); }
    else report.push(`· ok F (${id} already routes to the hub)`);
  }

  // G. Stub prose.
  const PROSE = {
    lyrenn_water_choir_inspect_perception:
      "<p>You stop moving, and the Choir stops adjusting. The note that shifted when you arrived is still there — half a step under the wide basin, held, patient. It shifted for you. It is waiting to see what you do with that.</p>",
    lyrenn_water_choir_inspect_insight:
      "<p>It isn't the water reading you. It's the water reading what you're feeling, and playing it back a half-second late, gentler. Somebody nervous in the party gets a nervous note; somebody calm gets a low, wide hum. The children have known this for years. They're not showing off. They're translating.</p>",
    lyrenn_water_choir_inspect_arcana:
      "<p>The channels are cut to a tuning. Not a melody — a calibration: each basin a fixed interval from the last, the whole hex laid out like a struck string held open. Someone built Lyrenn to resonate. The Choir isn't singing at you. It's measuring you against a pitch that was set before the town had a name.</p>",
    lyrenn_seed_vault_inspect_arcana:
      "<p>Hold a hand over the red-thread jars and the hum wobbles — not louder, but off, the way a plucked string goes when something touches it. Harmonic instability. They're not dormant. They're straining against the glass.</p>",
    lyrenn_seed_vault_inspect_nature:
      "<p>Under the crimson filament the seed coats are sound, the germ plump, the pattern one you know from every viable stock you've ever handled. They'd grow. Elsin can see it on your face before you say it, and she does not look relieved.</p>",
    lyrenn_seed_vault_darkness_sensitivity:
      "<p>Step toward the red thread and the pressure spikes — a hand on the sternum, a breath you can't finish. It isn't malice. It's WEIGHT, the specific weight of something gathered where the standing stones went quiet and left waiting in a jar to be carried back. Then it passes, and the vault is just cold.</p>"
  };
  for (const [id, html] of Object.entries(PROSE)) {
    const b = byId.get(id);
    if (!b) { report.push(`✗ G: ${id} missing`); continue; }
    const cur = plain(b.description);
    if (cur.length < 60) { b.description = html; changes++; report.push(`· G: ${id} stub "${cur}" → prose`); }
    else report.push(`· ok G (${id} has prose)`);
  }

  // H. Dougan's invite (the Forgotten Cause start beat) — players find the Chupacabra unprompted; the surprise is the door.
  {
    const b = byId.get("gullywasher_dougan_points_to_confluence");
    if (!b) report.push("✗ H: gullywasher_dougan_points_to_confluence missing");
    else if (String(b.inviteText || "").trim()) { b.inviteText = ""; changes++; report.push("· H: Dougan's invite line REMOVED (Forgotten Cause starts at the bar, not by card)"); }
    else report.push("· ok H (no Dougan invite)");
  }

  console.log(`[patch-story-flow-fixes] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Story-flow fixes DRY RUN: ${changes} change(s) (console). Set DRY_RUN=false to apply.`);
  const save = (data, type, name) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([data], { type }));
    a.download = name; a.click();
  };
  save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-flow-fixes-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Story-flow fixes APPLIED: ${changes} change(s). Backup downloaded.`);
})();
