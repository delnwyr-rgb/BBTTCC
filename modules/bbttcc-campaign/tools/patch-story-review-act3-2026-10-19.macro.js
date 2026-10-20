/* patch-story-review-act3-2026-10-19.macro.js — STORY REVIEW LEDGER, "Act 3 findings" rows 1–11, ALL Accept (Dave, 2026-10-19)
 *  Row 2: Dave rules Odie Thorium EIGHT-legged (Sleipnir) — text stays, the fact sheet changes. Row 7: the 41/9 rhyme is deliberate.
 *  Row 3 uses choice gates on ag_confessor_exposed plus a {{#played …}} span. Row 4 adds a Heist offer (ruling 22) on the Vault door.
 *  Every text edit is guarded by the live baseline. DRY_RUN default true; GM only; backs up `campaigns`.
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
  const byId = new Map(camp.beats.map(b => [String(b.id), b]));
  const report = []; let changes = 0;
  const ok = (m) => report.push("· ok " + m);
  const add = (m) => { changes++; report.push("✚ " + m); };
  const warn = (m) => report.push("⚠ " + m);
  const B = (id) => { const b = byId.get(id); if (!b) warn(`${id}: beat missing`); return b; };
  const rep = (id, from, to, field = "description") => {
    const b = B(id); if (!b) return; const cur = String(b[field] || "");
    if (to ? cur.includes(to) : !cur.includes(from)) return ok(`${id}.${field} already reads the new text`);
    if (!cur.includes(from)) return warn(`${id}.${field}: baseline not found — skipped`);
    b[field] = cur.replace(from, to); add(`${id}.${field}: text`);
  };
  const choice = (b, label) => (b.choices || []).find(c => c && c.label === label);
  const setChoice = (id, label, patch) => {
    const b = B(id); if (!b) return; const c = choice(b, label); if (!c) return warn(`${id}: choice '${label}' not found`);
    let n = 0; for (const [k, v] of Object.entries(patch)) { if (JSON.stringify(c[k]) !== JSON.stringify(v)) { c[k] = v; n++; } }
    if (n) add(`${id} › '${label}': ${Object.keys(patch).join("/")}`); else ok(`${id} › '${label}' already set`);
  };
  const addChoice = (id, ch, where = "end") => {
    const b = B(id); if (!b) return; b.choices = b.choices || [];
    if (b.choices.some(c => c && c.label === ch.label)) return ok(`${id}: choice '${ch.label}' exists`);
    if (where === "start") b.choices.unshift(ch); else b.choices.push(ch);
    add(`${id}: choice '${ch.label}' → ${ch.next || "(close)"}`);
  };
  const setDark = (id, delta) => {
    const b = B(id); if (!b) return; b.worldEffects = b.worldEffects || {};
    const fx = Array.isArray(b.worldEffects.factionEffects) ? b.worldEffects.factionEffects : (b.worldEffects.factionEffects = []);
    const row = fx.find(r => r && r.factionId === "@coalition");
    if (row) { if (Number(row.darknessDelta || 0) === delta) return ok(`${id}: darkness ${delta} set`); row.darknessDelta = delta; add(`${id}: darkness → ${delta}`); }
    else { fx.push({ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: delta, opDeltas: {}, allowOvercap: false }); add(`${id}: @coalition darkness ${delta}`); }
  };

  // ── Row 1: two hundred years ──
  rep("gilbert_theater_intro", "the carpet is sticky with thirty years of deferred tragedy.", "the carpet is sticky with two hundred years of deferred tragedy.");

  // ── Row 3: after Exposed, Verna runs the book ──
  rep("trojan_betting_pool",
    "Of course the Vacancy runs the book. Pilgrim Wick has a slate, a stub of chalk, and odds on what is inside the gift that he updates every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in Wick's own hand, and when you ask he looks pleased in a way that makes you want to check your pockets.",
    "Of course the Vacancy runs the book. {{#played ag_confessor_exposed}}Verna has the slate now — a stub of chalk and odds on what is inside the gift, updated every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in a hand that is not hers. Verna says the guest left it before he left.{{else}}Pilgrim Wick has a slate, a stub of chalk, and odds on what is inside the gift that he updates every time somebody walks past it with an opinion. SOLDIERS is even money. PAPERWORK is three to one. EMPTY is forty to one and has exactly one bet on it, in Wick's own hand, and when you ask he looks pleased in a way that makes you want to check your pockets.{{/played}}");
  setChoice("trojan_betting_pool", "Bet SOLDIERS.", { requires: [{ beatMark: "ag_confessor_exposed", not: true }] });
  setChoice("trojan_betting_pool", "Bet PAPERWORK.", { description: "It gets written down and underlined, which the others do not." });
  setChoice("trojan_betting_pool", "Ask what Wick bet.", { requires: [{ beatMark: "ag_confessor_exposed", not: true }] });
  addChoice("trojan_betting_pool", { label: "Bet SOLDIERS. ", next: "", description: "\"Everybody's bet soldiers,\" Verna says, not looking up from the count. \"That's how you know.\"", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "ag_confessor_exposed" }] });
  addChoice("trojan_betting_pool", { label: "Ask whose hand the EMPTY bet is in.", next: "", description: "\"The guest's.\" Verna taps the slate where the chalk is not hers. \"Paid up front. Guests who pay up front are usually leaving.\"", checkStat: "", checkDC: 0, failNext: "", requires: [{ beatMark: "ag_confessor_exposed" }] });

  // ── Row 4: the door in the hill — a way there, and a Heist for those who never got the password ──
  for (const id of ["enc_hidden_vault_locals_friendly", "enc_hidden_vault_locals_neutral", "enc_hidden_vault_locals_hostile"])
    addChoice(id, { label: "To the door in the hill.", next: "enc_hidden_vault_door", description: "", checkStat: "", checkDC: 0, failNext: "" });
  {
    const b = B("enc_hidden_vault_door"); const c = b && choice(b, "Open the door");
    if (!c) warn("enc_hidden_vault_door: 'Open the door' not found");
    else if (c.worldEffects?.raid) ok("enc_hidden_vault_door: Heist offer present");
    else {
      c.label = "Crack it without the password (a Heist)";
      c.description = "The family's password is the quiet way in. This is the other way: the door's circuitry is old and patient and wired to a projector that wakes the whole grove if it hears the wrong thing. Quiet work on the battlemap, in combat rounds — get it open, leave no trace of how.";
      c.requires = [{ beatMark: "enc_hidden_vault_locals_friendly", not: true }];
      c.worldEffects = { raid: { type: "heist", hexName: "PolygonWood.a", objectiveOnly: true, stake: "The Vault door: open it without GHSTBSTRZ. The grove is the alarm." } };
      add("enc_hidden_vault_door: 'Open the door' → Heist offer, hidden once the family gave the password");
    }
  }

  // ── Row 5: the Balcones — a fair check, a way off each card, a small cost or credit ──
  setChoice("balcones_faulting_you_line_opening", "Impose your will", { checkStat: "op.violence", checkDC: 16 });
  rep("balcones_faulting_you_appease_spirit", "And you sleep past while the land enjoys a good rest", "And you sleep well while the land enjoys a good rest");
  const bal = { balcones_faulting_you_appease_spirit: -1, balcones_faulting_you_narrative: -1, balcones_faulting_you_persuasion: 1, balcones_faulting_you_impose_your_will: 2, balcones_faulting_you_build_a_bridge: -1 };
  for (const [id, d] of Object.entries(bal)) { addChoice(id, { label: "Continue", next: "", description: "", checkStat: "", checkDC: 0, failNext: "" }); setDark(id, d); }

  // ── Row 6: AFTER, not instead ──
  rep("spark_geburah_verdict_taken", "⚙ GM: this fires INSTEAD of the standard verdict when all three came by force", "⚙ GM: this fires AFTER the standard verdict when all three came by force");

  // ── Row 8: GM-speak behind the gear ──
  rep("siege_commander_camp", " (Speak with him properly via conversation — he has TRUTHS, and a locked drawer.)", "\n\n⚙ GM: speak with him properly via conversation — he has TRUTHS, and a locked drawer.");
  rep("siege_commander_town", " (Speak with her properly via conversation — she has TRUTHS.)", "\n\n⚙ GM: speak with her properly via conversation — she has TRUTHS.");

  // ── Row 9: cadence ──
  rep("wt_flats_mud", "The Flats are not a wildfire. They are not a receipt either, yet. They are a page somebody keeps turning while you read.", "The Flats are a page somebody keeps turning while you read.");
  rep("map_singing_mire_intro", "The mire sings before you see it. Not birdsong. Not wind. Harmony. Human-adjacent, wrong-throated, accusatory harmony.", "The mire sings before you see it. Harmony, human-adjacent, wrong-throated, accusatory.");
  rep("map_anchor_reach_intro", " At low tide, the diagram shows its pilings. One of the drowned pilings has shoulders.", " One of the drowned pilings has shoulders.");

  // ── Row 10: the Lens ──
  rep("enc_hidden_vault_inside", "Sometimes you really get why Adam did what it did ...", "Sometimes you really get why the Lens shattered.");

  // ── Row 11: the Crown Mall cross-check waits for Legansus, like the archive itself ──
  setChoice("map_port_kudzu_testimony", "Cross-check it with the Crown Mall archive", { requires: [{ anyOf: [{ beatMark: "map_legansus_waystation_verified" }, { beatMark: "map_legansus_waystation_flagged" }] }] });

  console.log(`[patch-story-review-act3] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Act 3 DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Act 3: nothing to do.");
  try {
    (foundry.utils.saveDataToFile ?? saveDataToFile)(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-story-review-act3-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Act 3 APPLIED: ${changes} change(s). Two hundred years of deferred tragedy.`);
})();
