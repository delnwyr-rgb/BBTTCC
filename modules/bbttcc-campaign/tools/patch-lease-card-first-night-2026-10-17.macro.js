/* patch-lease-card-first-night-2026-10-17.macro.js — TEACHING BEAT 4: THE RIG (Alpha Cut, Dave 2026-10-17:
 *  "Yes to all six teaching beats.")
 *
 *  Finding (why/when survey, 2026-10-17): the lease card `reliable_the_lease` — the one card that says the
 *  Absolutely Reliable is leased for three turns and can be renewed, bought or earned — is ORPHANED. Nothing
 *  fires it. Players sleep in a hovercraft nobody tells them they can lose. Its two "Read the terms" / "Look
 *  around" choices also dead-end (next ""), so even fired by hand it closes the night instead of finishing it.
 *
 *  Fix — the card is read on the FIRST NIGHT, where the party already beds down in her:
 *   WIRED ag_first_night_soma_break   + "Read the paperwork on the galley table." → reliable_the_lease
 *                                       (hidden once read, or once she is bought / signed over)
 *   WIRED reliable_the_lease           "Read the terms." → reliable_lease_terms · "Look around your new home." →
 *                                       reliable_lease_home · + "Sleep. Tomorrow, the land." → hum_quiet_tent
 *                                       (the same sleep the first night already uses) · coffee row untouched
 *   NEW   reliable_lease_terms         the why: home + the only water passage; the three ways to keep her
 *                                       (renew = Charter Passage with the Farm · buy = Mara's thirty marks ·
 *                                       earn = a job Gearbox can certify) · and what lapsing costs
 *   NEW   reliable_lease_home          the look-around text as its own card, then terms or sleep
 *
 *  Idempotent (id / label / choice guards); DRY_RUN default true; backs up `campaigns`. GM only.
 *  Marker: [LEASE-CARD-FIRST-NIGHT-2026-10-17]
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

  const LEASE = "reliable_the_lease", TERMS = "reliable_lease_terms", HOME = "reliable_lease_home", NIGHT = "ag_first_night_soma_break", SLEEP = "hum_quiet_tent";
  const lease = byId.get(LEASE), night = byId.get(NIGHT);
  if (!lease || !night) return ui.notifications.error("reliable_the_lease or ag_first_night_soma_break not found — run patch-absolutely-reliable first.");
  if (!byId.get(SLEEP)) report.push(`⚠ ${SLEEP}: NOT FOUND — the Sleep rows will dead-end`);

  const NOT_OWNED = [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }];
  const ch = (label, description, extra = {}) => ({ label, next: "", description, checkStat: "", checkDC: 0, failNext: "", ...extra });
  const WE = (extra = {}) => ({ territoryOutcome: null, factionEffects: [], radiationDelta: 0, sparkKey: null, turnRequests: [], warLog: "", worldModifiers: [], relationshipEffects: [], questEffects: [], ...extra });
  const lbl = (c) => String(c?.label || "").trim().toLowerCase();

  const TERMS_DESC =
    "Three turns, prepaid by the Farm, water passage included. She is where you sleep, where your rigs park, and the only thing you own that crosses a river. When the lease runs out she goes home to Furrier's Fixit Farm, and you go to rooms at the Vacancy.\n\n" +
    "<b>Three ways to keep her:</b>\n" +
    "<b>Renew</b> — Charter Passage with the Fixit Farm. Three more turns, still not yours.\n" +
    "<b>Buy</b> — Mara has a price. Thirty marks from the coalition treasury, and the lease card comes off the wall.\n" +
    "<b>Earn</b> — bring Young Gearbox a thing that is what it says it is. He signs over what he can certify.\n\n" +
    "The card on the galley wall will tell you when the last turn comes. Plan before it does.";
  const TERMS_MEMORY = "Read the lease. Three turns, then renew, buy or earn the Absolutely Reliable — or lose her to the Farm.";
  const HOME_DESC =
    "Bunks for more people than you are. A galley that smells of someone else's cooking. Skirts patched with three colours of canvas. Your rigs fit alongside her like boats at a pier.\n\n" +
    "Nothing here is yours yet, and you notice everything you'd change.";

  /* ── 1. the two cards the lease points at ───────────────────────────────── */
  const upsert = (id, build, label) => {
    const have = byId.get(id); const want = build();
    if (!have) { camp.beats.push(want); byId.set(id, want); changes++; report.push(`✚ beat ${id} — ${label}`); return; }
    let touched = 0;
    for (const k of ["description", "memoryText", "choices", "inject", "worldEffects", "label", "questStep"]) if (JSON.stringify(have[k]) !== JSON.stringify(want[k])) { have[k] = want[k]; touched++; }
    if (touched) { changes++; report.push(`✚ beat ${id}: ${touched} field(s) refreshed`); } else report.push(`· ok beat ${id}`);
  };
  const clone = (id, label, description, memoryText, choices) => {
    const nb = foundry.utils.deepClone(lease);
    Object.assign(nb, { id, label, type: "narration", description, memoryText, worldEffects: WE(), choices, questStep: (Number(lease.questStep) || 0) + (id === TERMS ? 1 : 2), timePoints: 0 });
    nb.inject = { ...(nb.inject || {}), repeatable: true, evergreen: false, requires: NOT_OWNED };
    return nb;
  };
  upsert(TERMS, () => clone(TERMS, "The Absolutely Reliable — The Terms", TERMS_DESC, TERMS_MEMORY, [
    ch("Look around your new home.", "", { next: HOME }),
    ch("Sleep. Tomorrow, the land.", "", { next: SLEEP })
  ]), "the why and the three ways to keep her");
  upsert(HOME, () => clone(HOME, "The Absolutely Reliable — Your New Home", HOME_DESC, null, [
    ch("Read the terms.", "", { next: TERMS }),
    ch("Sleep. Tomorrow, the land.", "", { next: SLEEP })
  ]), "the look-around card");

  /* ── 2. the lease card's rows lead somewhere ────────────────────────────── */
  {
    lease.choices = Array.isArray(lease.choices) ? lease.choices : [];
    const terms = lease.choices.find(c => lbl(c) === "read the terms.");
    const home  = lease.choices.find(c => lbl(c) === "look around your new home.");
    if (terms && terms.next !== TERMS) { terms.next = TERMS; changes++; report.push(`✚ lease: "Read the terms." → ${TERMS}`); } else if (terms) report.push("· ok lease: terms row"); else report.push("⚠ lease: 'Read the terms.' row not found");
    if (home && home.next !== HOME) { home.next = HOME; changes++; report.push(`✚ lease: "Look around your new home." → ${HOME}`); } else if (home) report.push("· ok lease: home row"); else report.push("⚠ lease: 'Look around your new home.' row not found");
    if (!lease.choices.some(c => lbl(c) === "sleep. tomorrow, the land.")) {
      lease.choices.push(ch("Sleep. Tomorrow, the land.", "", { next: SLEEP })); changes++; report.push("✚ lease: + 'Sleep. Tomorrow, the land.' → the first night's sleep");
    } else report.push("· ok lease: sleep row");
  }

  /* ── 3. the first night reads it ────────────────────────────────────────── */
  {
    night.choices = Array.isArray(night.choices) ? night.choices : [];
    const row = ch("Read the paperwork on the galley table.", "A card, block capitals, a spanner for a paperweight. Gearbox's handwriting. It says how long she's yours.", {
      next: LEASE, requires: [{ beatMark: LEASE, not: true }, ...NOT_OWNED]
    });
    const have = night.choices.find(c => lbl(c) === lbl(row));
    if (!have) {
      const sleepIx = night.choices.findIndex(c => /^sleep\./i.test(String(c.label || "")));
      night.choices.splice(sleepIx >= 0 ? sleepIx : night.choices.length, 0, row);
      changes++; report.push("✚ first night: + 'Read the paperwork on the galley table.' before Sleep (hidden once read / once she is yours)");
    } else if (JSON.stringify(have) !== JSON.stringify(row)) { Object.assign(have, row); changes++; report.push("✚ first night: paperwork row refreshed"); }
    else report.push("· ok first night: paperwork row");
  }

  console.log(`[patch-lease-card-first-night] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Lease card DRY RUN: ${changes} change(s) (see console).`);
  if (!changes) return ui.notifications.info("Lease card: nothing to do.");
  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-lease-card-${Date.now()}.json`);
  } catch (e) { return ui.notifications.error("Backup failed — aborting without writing. " + (e?.message || e)); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Lease card APPLIED: ${changes} change(s). The first night now reads the lease.`);
})();
