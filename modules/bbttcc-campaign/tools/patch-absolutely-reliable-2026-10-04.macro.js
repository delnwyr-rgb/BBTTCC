/* patch-absolutely-reliable-2026-10-04.macro.js — RUN IN-WORLD (GM, ember). DRY_RUN default true.
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ABSOLUTELY RELIABLE (Dave, 2026-10-04). Young Gearbox drops the Stewards in Allesh-Gilliam in the Jackalopes' hovercraft mobile
 * home, "The Absolutely Reliable" (Furrier's Fixit Farm's water-surface rig), and takes the Allesh-Gilliam Leygate home (it isn't broken
 * yet). They LEASE it for three turns: the starter charter (bbttcc-factions grantStarterCharter, 3 turns, water passage) is the lease.
 * It is their home and their boat. Three ways to keep it; or it lapses and they move into rooms at the Vacancy:
 *   BUY    — at the Arc Bay, Gearbox relays Mara's price: thirty Economy marks from each leader → reliable_bought
 *   EARN   — after the Leyline Stabilizer is certified (fixit_load_the_crate), Gearbox signs the lease over → reliable_gearbox_signs
 *   RENEW  — the Charter Passage strategic activity (3 turns, 8 marks). No beat; the lease beats stay quiet while a renewal covers it.
 *   LAPSE  — reliable_lease_lapsed (fired by the charter clock when the starter lease ends and nobody holds it): rooms at the Vacancy.
 * Owning it (buy or earn) = worldEffects.rigTransfer: the rig becomes the coalition's (lead faction owns it, the rest hold standing
 * charters, the starter leases are revoked). Owned is the door to MODULES (unbuilt): you can't bolt anything onto a rental.
 *   NEW beats: reliable_the_lease (the lease card — route to it from the arrival script), reliable_lease_last_turn (charter clock, the
 *   lease's last turn), reliable_lease_lapsed, reliable_price, reliable_bought, reliable_gearbox_signs.
 *   Arc Bay (fixit_arc_bay_conversation) gains the two asks. Young Gearbox's persona gains the lease.
 * Needs (2026-10-04): world-mutation-engine (rigTransfer) + hex-travel (lease story hooks). Idempotent; one backup.
 * HOW TO RUN: 1) hard-reload; 2) run (DRY_RUN = true) → console (F12); 3) DRY_RUN = false, run again; 4) F5.
 */
(async () => {
  const DRY_RUN = true;                       // <-- set false to apply
  const NS = "bbttcc-campaign", MAL = "bbttcc-mal-voice";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const report = []; let changes = 0; const say = (m) => report.push(m); const actorEdits = [];
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = wasStr ? JSON.parse(raw) : foundry.utils.deepClone(raw);
  const cid = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[cid]; if (!camp) return ui.notifications.error(`Active campaign '${cid}' not found.`);
  camp.beats = Array.isArray(camp.beats) ? camp.beats : Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const edit = (id, fn, what) => { const b = byId.get(id); if (!b) return say(`✗ MISSING ${id} (its seeder never ran here?)`); const before = JSON.stringify(b); fn(b); if (JSON.stringify(b) !== before) { changes++; say(`✎ ${id}: ${what}`); } else say(`· ok ${id} (already)`); };
  const ch = (label, next = "", extra = {}) => ({ label, next, description: "", checkStat: "", checkDC: 0, failNext: "", ...extra });

  const GEARBOX = "r99sbSaaZfD4FGaZ", RIG = "The Absolutely Reliable";
  const NOT_OWNED = [{ beatMark: "reliable_bought", not: true }, { beatMark: "reliable_gearbox_signs", not: true }];
  const TRANSFER = { rigTransfer: { rigName: RIG, to: "@coalition" } };
  const tpl = byId.get("fixit_arc_bay_conversation"); if (!tpl) return ui.notifications.error("fixit_arc_bay_conversation missing (Fixit never seeded?).");
  const mk = (id, label, description, { type = "dialog", speaker = null, requires = [], choices = [], repeatable = false, worldEffects = {}, memoryText = null, evergreen = true, where = null } = {}) => {
    const b = foundry.utils.deepClone(tpl);
    Object.assign(b, { id, label, description, type, speakerActorId: speaker, choices, worldEffects, tags: "the-absolutely-reliable,home", hexName: null, targetHexUuid: null, sceneId: null });
    b.inject = { ...(tpl.inject || {}), repeatable, oncePerHex: false, requires, ...(evergreen ? { evergreen: true } : {}) };
    delete b.story; delete b.questStep; if (memoryText) b.memoryText = memoryText; else delete b.memoryText;
    if (where) b.where = where; else delete b.where;   // the lease's own beats happen wherever the coalition is (the location guard reads `where`)
    if (b.cinematic) b.cinematic = { enabled: false, startSceneId: null, durationMs: 0, nextSceneId: null };
    return b;
  };
  const NEW = [
    mk("reliable_the_lease", "The Absolutely Reliable — The Lease",
      "Young Gearbox leaves the paperwork on the galley table, weighted with a spanner he forgot or meant to leave, and nobody can tell which. One card, block capitals, a hovercraft drawn in the margin with more love than accuracy: THE ABSOLUTELY RELIABLE. LEASED THREE TURNS TO THE NEW FOLKS. CERTIFIED BY ME. Under that, smaller: IT IS NOT ABSOLUTELY RELIABLE. And under that, smaller still, in Mara's hand: BUT IT IS RELIABLE ENOUGH. BRING IT BACK OR BUY IT.",
      { where: "anywhere", type: "narration", requires: [...NOT_OWNED], repeatable: true, choices: [
        ch("Read the terms.", "", { description: "Three turns, prepaid by the Farm, water passage included. After that: renew it (Charter Passage), buy it from Mara, or give Gearbox a reason to sign it over. Or hand back the keys." }),
        ch("Look around your new home.", "", { description: "Bunks for more people than you are. A galley that smells of someone else's cooking. Skirts patched with three colours of canvas. Your rigs fit alongside it like boats at a pier. Nothing here is yours yet, and you notice everything you'd change." })
      ], memoryText: "The Absolutely Reliable, the Jackalopes' hovercraft mobile home, is leased to the Stewards for three turns." }),
    mk("reliable_lease_last_turn", "The Absolutely Reliable — Last Turn of the Lease",
      "A second card turns up under the galley door in the same block capitals: LAST TURN ON THE LEASE. GEARBOX. Then, as if he couldn't help it: SHE RUNS BEST IF YOU TALK TO HER. The skirts hiss, the engine ticks, and for the first time the hovercraft feels like something that is about to leave.",
      { where: "anywhere", type: "narration", requires: [...NOT_OWNED], choices: [
        ch("Plan to renew it.", "", { description: "Charter Passage with the Fixit Farm: three more turns, and still not yours." }),
        ch("Plan to buy it.", "", { description: "Mara has a price. Gearbox says it's fair. Gearbox says everything is fair." }),
        ch("Plan to earn it.", "", { description: "Gearbox signs things over for things he can certify. He's been eyeing that Leyline Stabilizer job." })
      ] }),
    mk("reliable_lease_lapsed", "The Absolutely Reliable — Gone Home",
      "Somebody from the Farm comes up the road at dawn with a key and an apology, and The Absolutely Reliable goes home with your fingerprints on it. Your rigs look smaller, parked alone. At the Vacancy, Verna already has the rooms made up, because the sign is never wrong. \"Four rooms,\" she says. \"Pays exact or pays late, I'll put a mark either way.\" Upstairs, one door has a star beside it in her ledger. Your new neighbour never sleeps in his bed.",
      { where: "anywhere", type: "narration", requires: [...NOT_OWNED], choices: [ch("Take the rooms.", "", { description: "The Farm will still sell her, or sign her over. You know where she lives." })],
        worldEffects: { warLog: "The lease on The Absolutely Reliable ran out; the coalition has moved into rooms at the Vacancy." },
        memoryText: "The Absolutely Reliable went back to the Fixit Farm when the lease ran out; the Stewards live at the Vacancy now." }),
    mk("reliable_price", "Furrier's Fixit Farm — What She Costs",
      "Young Gearbox wipes his hands on a rag that makes them worse. \"Mara's price,\" he says, the way other people say the weather. \"Thirty Economy marks from each of you. One each, so nobody owns more of her than anybody else.\" He considers this. \"Mara says you'll argue. She says don't. I say she runs best if you talk to her.\"",
      { speaker: GEARBOX, requires: [{ flag: "storyPhase", gte: 2 }, ...NOT_OWNED], repeatable: true, choices: [
        ch("Everybody chips in. Buy her.", "reliable_bought", { description: "Thirty Economy marks from each leader. She's yours: home, boat, and a hull you can finally bolt things onto." }),
        ch("Not yet.", "fixit_arc_bay_conversation")
      ] }),
    mk("reliable_bought", "The Absolutely Reliable — Bought and Paid For",
      "Mara counts it twice and writes it once. Gearbox takes the old lease card off the galley wall and gives it to you, because it's yours now too. Then he walks the hull with you, slapping panels like a horse dealer: here's where a workshop would go, here's where you'd hang a radio mast, here's the bit that rattles, and that one's free. \"She's yours,\" he says. \"Talk to her.\"",
      { type: "narration", speaker: GEARBOX, requires: [{ flag: "storyPhase", gte: 2 }, ...NOT_OWNED], choices: [ch("Talk to her.", "", { description: "The engine ticks back. Probably coincidence." })],
        worldEffects: { ...TRANSFER, warLog: "The coalition bought The Absolutely Reliable from Furrier's Fixit Farm.", factionEffects: [{ factionId: "@coalition", moraleDelta: 0, loyaltyDelta: 0, unityDelta: 0, darknessDelta: 0, opDeltas: { economy: -30 }, allowOvercap: false }] },
        memoryText: "The coalition owns The Absolutely Reliable outright, bought from Mara." }),
    mk("reliable_gearbox_signs", "The Absolutely Reliable — Signed Over",
      "Young Gearbox finds a clean card, which takes a while, and writes on it in his best block capitals: LEASE TRANSFERRED. THE NEW FOLKS. CERTIFIED BY ME. He blows on the ink. \"You brought me a thing that is what it says it is,\" he says. \"First one since the Cough. That's worth a hovercraft.\" He pauses. \"Mara will say it isn't. Mara is wrong about this one.\"",
      { speaker: GEARBOX, requires: [{ flag: "storyPhase", gte: 2 }, ...NOT_OWNED, { beatMark: "fixit_load_the_crate" }], choices: [ch("Shake on it.", "", { description: "His grip is oil and enthusiasm. She's yours." })],
        worldEffects: { ...TRANSFER, warLog: "Young Gearbox signed The Absolutely Reliable over to the coalition." },
        memoryText: "Young Gearbox signed The Absolutely Reliable over to the coalition after the Leyline Stabilizer was certified." })
  ];
  for (const nb of NEW) { if (byId.get(nb.id)) { say(`· ok beat (already) ${nb.id}`); continue; } camp.beats.push(nb); byId.set(nb.id, nb); changes++; say(`✚ beat ${nb.id}`); }

  edit("fixit_arc_bay_conversation", b => {
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    const add = [];
    if (!b.choices.some(c => c.next === "reliable_price")) add.push(ch("What would it take to keep the Absolutely Reliable?", "reliable_price", { requires: NOT_OWNED }));
    if (!b.choices.some(c => c.next === "reliable_gearbox_signs")) add.push(ch("Ask Gearbox to sign the lease over.", "reliable_gearbox_signs", { requires: [...NOT_OWNED, { beatMark: "fixit_load_the_crate" }] }));
    if (add.length) { const i = b.choices.findIndex(c => /^Leave/.test(String(c.label || ""))); b.choices.splice(i >= 0 ? i : b.choices.length, 0, ...add); }
  }, "the price · the signature (after the Stabilizer is certified)");

  const NOTE = "THE ABSOLUTELY RELIABLE (owner ruling 2026-10-04): Young Gearbox dropped the Stewards in Allesh-Gilliam in the Farm's hovercraft mobile home and took the Allesh-Gilliam Leygate home (it was not broken yet). He certified her himself, in block capitals. She is leased three turns; he loves her and says 'she runs best if you talk to her'. Mara's price is thirty Economy marks from each leader. Gearbox will sign the lease over for something he can honestly certify (the Leyline Stabilizer).";
  const G = game.actors?.get(GEARBOX);
  if (!G) say(`✗ MISSING actor Young Gearbox (${GEARBOX})`);
  else {
    const per = foundry.utils.deepClone(G.getFlag(MAL, "persona") || {});
    if (String(per.notes || "").includes("THE ABSOLUTELY RELIABLE")) say("· ok persona Young Gearbox (already)");
    else { per.notes = [String(per.notes || "").trim(), NOTE].filter(Boolean).join("\n\n"); changes++; say("✎ persona Young Gearbox: the lease"); actorEdits.push(() => G.setFlag(MAL, "persona", per)); }
  }

  console.group(`[patch-absolutely-reliable-2026-10-04] ${DRY_RUN ? "DRY RUN — " : ""}${changes} change(s)`); report.forEach(r => console.log(" •", r)); console.groupEnd();
  if (DRY_RUN) return ui.notifications.info(`The Absolutely Reliable DRY RUN: ${changes} change(s) — console (F12). Set DRY_RUN=false to apply.`);
  if (!changes) return ui.notifications.info("The Absolutely Reliable: nothing to change.");
  (foundry.utils.saveDataToFile ?? saveDataToFile)(JSON.stringify(wasStr ? JSON.parse(raw) : raw), "application/json", `backup-campaigns-before-absolutely-reliable-${Date.now()}.json`);
  await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  for (const fn of actorEdits) await fn();
  ui.notifications.info(`The Absolutely Reliable applied: ${changes} change(s). F5.`);
})();
