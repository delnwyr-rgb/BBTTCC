/* patch-raid-names-2026-10-18.macro.js — ALPHA CUT RULING 2 WORD PASS, story side (Dave, blessed 2026-10-18):
 *  the three raid types are Battle / Heist / Parley on every player-facing surface. Code keys stay violence / intrigue /
 *  presence; this macro only touches the words players read in beats.
 *
 *  What it touches: beat description / memoryText / title and choice label / description across the ACTIVE campaign,
 *  wherever they say "Violence raid", "Intrigue raid", "Presence raid", "Courtly Intrigue", "Courtly raid/scenario/engine".
 *  What it leaves alone: ⚙ GM notes, beat ids, tags, effect payloads, OP-pool words ("Intrigue OP", "Violence marks") and the
 *  character faculties (Violence / Intrigue / Presence as stats) — those are not raid types.
 *
 *  Regex sweep (the live world is the truth — no fixed list). Idempotent. DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [RAID-NAMES-2026-10-18]
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : foundry.utils.deepClone(campsRaw);
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});

  // Ordered: specific phrases first, then the generic sweeps. Case of the first letter is kept.
  const RULES = [
    [/\bParley with ([^()]+?) \(Courtly Intrigue\)/g, "Parley with $1"],
    [/\bCourtly Intrigue raid scenarios?\b/gi, "Parleys"],
    [/\bCourtly Intrigue (raid|scenario|engagement)s\b/gi, "Parleys"],
    [/\bCourtly Intrigue (raid|scenario|engagement)\b/gi, "Parley"],
    [/\bCourtly (raid|scenario|engagement)s\b/gi, "Parleys"],
    [/\bCourtly (raid|scenario|engagement)\b/gi, "Parley"],
    [/\bCourtly Intrigue\b/g, "Parley"],
    [/\bcourtly intrigue\b/g, "parley"],
    [/\bCourtly engine\b/gi, "Parley engine"],
    [/\bViolence raids\b/g, "Battles"], [/\bviolence raids\b/g, "battles"],
    [/\bViolence raid\b/gi, "Battle"],
    [/\bIntrigue raids\b/g, "Heists"], [/\bintrigue raids\b/g, "heists"],
    [/\bIntrigue raid\b/gi, "Heist"],
    [/\bPresence raids\b/g, "Parleys"], [/\bpresence raids\b/g, "parleys"],
    [/\bPresence raid\b/gi, "Parley"],
  ];
  const sweep = (s) => { let out = s; for (const [re, rep] of RULES) out = out.replace(re, rep); return out; };

  const report = []; let changes = 0;
  const touch = (beatId, field, obj, key) => {
    const v = obj?.[key];
    if (typeof v !== "string" || !v) return;
    const after = sweep(v);
    if (after !== v) {
      const m = RULES.map(([re]) => { re.lastIndex = 0; return v.match(re)?.[0]; }).find(Boolean) || "?";
      report.push(`✚ ${beatId} ${field}: "${m}" → raid name`);
      obj[key] = after; changes++;
    }
  };
  for (const b of camp.beats) {
    touch(b.id, "title", b, "title");
    touch(b.id, "description", b, "description");
    touch(b.id, "memoryText", b, "memoryText");
    (b.choices || []).forEach((c, i) => { touch(b.id, `choice:${i}.label`, c, "label"); touch(b.id, `choice:${i}.description`, c, "description"); });
  }

  console.log(`[patch-raid-names] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s) across ${camp.beats.length} beats\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Raid names DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Raid names: nothing to do — the story already says Battle / Heist / Parley.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-raid-names-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Raid names APPLIED: ${changes} change(s). The story now says Battle / Heist / Parley.`);
})();
