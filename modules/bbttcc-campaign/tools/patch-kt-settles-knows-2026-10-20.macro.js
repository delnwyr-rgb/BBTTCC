/* patch-kt-settles-knows-2026-10-20.macro.js — THE MOUNTAIN SQUARES UP knows what the Stewards did (Dave, 2026-10-20 evening:
 *  "The beat should know what the stewards ended up doing :)").
 *
 *  `khezek_hex_settles` closes the Khezek-Tor quest once the mine, the shipment and the Seal are all answered. It used to shrug
 *  ("the crates are whatever you decided they are"). Now each of the three sentences is a {{#played …}} span on the outcome beat
 *  the table actually fired — exploit / seal / open; standardize / rite / ignore; restore / redirect / break — in the words those
 *  outcomes used. The closer's gate (all three quests completed) guarantees one of each has played. The memory line stays as
 *  Calder's summary (memory text is not token-expanded).
 *
 *  Guarded by the live baseline; idempotent; DRY_RUN default true; backs up `campaigns`. GM only.
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
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;

  const P = (id, text) => `{{#played ${id}}} ${text}{{/played}}`;   // the space rides INSIDE the span, so unplayed outcomes leave no gap
  const DESC = [
    "Khezek Tor runs on tonnage, grudges, and things underground answering back — and for the first time in living memory all three are accounted for.",
    P("khezek_tor_mine_that_answered_back_seal", "The breach is sealed and the rumble is gone; the mountain sits easier, and everyone underground knows the Stewards paid for that out of their own banks, with output down and not one name added to any list."),
    P("khezek_tor_mine_that_answered_back_exploit", "The new shaft is working and the numbers are beautiful; Khezek ore is shoring up the Leygate's footings, and Calder keeps the tonnage on one side of his chalk and a list of names on the other."),
    P("khezek_tor_mine_that_answered_back_open", "The new shaft is open all the way down, and what was a sink is slowly becoming a door; the crews work it with the lights on and their backs to it, and Sable charts its edges nightly."),
    P("khezek_tor_darkness_shipment_standardize", "The crates go out under the sacred handling protocol now, marked and oriented and slower, and the dreams stopped riding out with the ore."),
    P("khezek_tor_darkness_shipment_rite", "The crates go out blessed, rite and puppets and all, and word went round the galleries that these ones actually get mines."),
    P("khezek_tor_darkness_shipment_ignore", "The crates go out humming the way they always did; some folk got sick, and the ledgers have never looked better."),
    P("khezek_tor_the_vaulhaulan_seal_restore", "The Valhaulan seal faces inward again, the mountain ran hot for a turn taking its own burden back, and a sympathizer cell got collared for saying so."),
    P("khezek_tor_the_vaulhaulan_seal_redirect", "The Valhaulan seal still points outward, but it points where you aimed it, and the whole coast felt it exhale."),
    P("khezek_tor_the_vaulhaulan_seal_break", "The Valhaulan seal is broken, the heading is lit burning-map bright, and whatever runs supply down that line knows the door opened from your side."),
    " Calder wipes the board. That's the whole ceremony."
  ].join("");
  const b = byId.get("khezek_hex_settles");
  if (!b) return ui.notifications.error("khezek_hex_settles not found.");
  if (b.description === DESC) report.push("· ok khezek_hex_settles: already knows");
  else if (!String(b.description || "").startsWith("Khezek Tor runs on tonnage, grudges, and things underground answering back")) report.push("⚠ khezek_hex_settles: baseline start not found");
  else { b.description = DESC; changes++; report.push("✚ khezek_hex_settles: mine / shipment / Seal sentences are played-spans on the nine outcomes"); }

  console.log(`[kt-settles-knows 2026-10-20] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-kt-settles-knows-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the mountain remembers.`);
})();
