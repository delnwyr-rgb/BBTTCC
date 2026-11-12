/* patch-halloween-hoard-2026-10-31.macro.js — THE HALLOWEEN HOARD campaign patch (GENERATED 2026-10-31 by build-halloween-hoard.mjs from
 * halloween-hoard-campaign-patch.mjs — do not hand-edit; rebuild). Run AFTER seed-halloween-hoard-2026-10-31.macro.js (the quest items clone
 * pack records by uuid). GM only; DRY_RUN default true; idempotent; backs up `campaigns` to a download first.
 * Adds: the Sparky costume (one piece per grief town + Proof of Purchase at Miss June), 10 quest rewards, 7 reality-bending receipts.
 */
/* halloween-hoard-campaign-patch.mjs — the PURE campaign edit for the Halloween hoard (2026-10-31, Dave: "items as rewards for
 * quests or looted from defeated enemies … a costume … no town has a complete set … powerful receipts").
 *
 * `applyHoardPatch(camp, HOARD)` mutates a campaign object in place and returns { changes, report }. It runs in two places:
 *   • node — the build script applies it to a `campaigns` backup and runs bin/ft-lint-campaign on the result (offline proof)
 *   • Foundry — patch-halloween-hoard-2026-10-31.macro.js inlines this file's text (generated; DRY_RUN; idempotent)
 * Idempotent: every add checks for its own id / label first, so re-running on a patched campaign reports 0 changes.
 *
 * What it adds (all in the grief towns + Crown Mall, Act 3 content):
 *   THE SPARKY COSTUME — the most popular 9–12 costume of Halloween 2077, bought at Crown Mall. One piece per grief town:
 *     Soft Landing  soft_landing_castle  → "Look under the shoes."           → sl_sparky_mask   (the mask, left with the sneakers)
 *     Stillwater    stillwater_lemonade  → "Where'd you get the shirt?"      → sw_sparky_shirt  (Bucky Sorrel sells the reactor-suit top)
 *     Chuckle Creek chuckle_piano_kid    → "Nice pants."                     → cc_sparky_pants  (Dewey trades the pants for a ride)
 *     Crown Mall    miss_june_inventory  → "Put the costume on the counter." → cm_proof_of_purchase (needs all three; the Receipt)
 *   QUEST REWARDS — `choice.questItems[{key, uuid}]` on existing endings (a real compendium item lands on the Steward who picks).
 *   RECEIPTS — `worldEffects.receipts` on the good endings (the reality-bending set; one per ending).
 */
const PACK_ITEMS = "Compendium.bbttcc-master-content.items.Item.";

// ids of the hoard items (fixed; build-halloween-hoard.mjs mints the same ids — see ID_SEED there)
const HOARD_DEFAULT = {
  items: {
    sparky_mask: "hH0SparkyMask001", sparky_shirt: "hH0SparkyShirt01", sparky_pants: "hH0SparkyPants01",
    fog_machine: "hH0FogMachine001", doorbell_camera: "hH0DoorbellCam01", spirit_board: "hH0SpiritBoard01",
    glow_bandolier: "hH0GlowBandoli01", walkie: "hH0WalkiePair001", candy_scale: "hH0CandyScale001",
    hoodie: "hH0TrickHoodie01", mall_vest: "hH0MallVest00001", egg_shotgun: "hH0EggShotgun001", doorbell_knuckles: "hH0DoorKnuckle01"
  }
};

const ch = (label, next, description, extra = {}) => ({ label, next, description, checkStat: "", checkDC: 0, failNext: "", ...extra });
const beat = (parent, id, label, description, choices, extra = {}) => ({
  id, label, type: "dialog", timeScale: "scene", timePoints: 0,
  questId: parent.questId || "", tags: parent.tags || "", politicalTags: "",
  description, outcomes: { success: null, failure: null },
  // the parent's inject (its storyPhase gate above all) — a hand-off beat sits in the same act as the door it hangs off
  inject: parent.inject ? JSON.parse(JSON.stringify(parent.inject)) : { cooldownTurns: 0, repeatable: false, oncePerHex: false, promptGM: "inherit", fallbackOnDecline: "inherit", allowMulti: "inherit", oncePerHexGlobal: "inherit", requires: [{ flag: "storyPhase", gte: 2 }] },
  actors: [], refs: {}, playerFacingDialog: true, dialogPlayerFacing: true, playerFacingContent: true, showToPlayers: true,
  storyChain: parent.storyChain || "", priority: "background",
  ...(parent.speakerActorId ? { speakerActorId: parent.speakerActorId } : {}),
  story: parent.story ? { ...parent.story } : {}, choices, worldEffects: {}, sceneId: parent.sceneId || "", ...extra
});

function applyHoardPatch(camp, HOARD = HOARD_DEFAULT) {
  if (!Array.isArray(camp.beats)) camp.beats = Object.values(camp.beats || {});
  const byId = new Map(camp.beats.map(b => [b.id, b]));
  const report = []; let changes = 0;
  const uuid = (key) => PACK_ITEMS + HOARD.items[key];
  const addBeat = (nb) => { if (byId.has(nb.id)) { report.push(`· ok ${nb.id}`); return byId.get(nb.id); } camp.beats.push(nb); byId.set(nb.id, nb); changes++; report.push(`✚ beat ${nb.id}`); return nb; };
  const addChoice = (beatId, choice, { beforeLabelRe = /^(back to the street|leave|ask something else)/i } = {}) => {
    const b = byId.get(beatId); if (!b) { report.push(`⚠ ${beatId}: not found`); return; }
    b.choices = Array.isArray(b.choices) ? b.choices : [];
    if (b.choices.some(c => c?.label === choice.label || (choice.next && c?.next === choice.next))) { report.push(`· ok ${beatId}: "${choice.label}"`); return; }
    const at = b.choices.findIndex(c => beforeLabelRe.test(String(c?.label || "")));
    if (at >= 0) b.choices.splice(at, 0, choice); else b.choices.push(choice);
    changes++; report.push(`✚ ${beatId}: "${choice.label}"`);
  };
  const addQuestItem = (beatId, choiceRe, key, name) => {
    const b = byId.get(beatId); if (!b) { report.push(`⚠ ${beatId}: not found`); return; }
    const c = (b.choices || []).find(x => choiceRe.test(String(x?.label || ""))); if (!c) { report.push(`⚠ ${beatId}: no choice ${choiceRe}`); return; }
    c.questItems = Array.isArray(c.questItems) ? c.questItems : [];
    if (c.questItems.some(q => q?.key === key)) { report.push(`· ok ${beatId}: reward ${key}`); return; }
    c.questItems.push({ key, uuid: uuid(key), name });
    changes++; report.push(`✚ ${beatId}: reward ${name}`);
  };
  const addReceipt = (beatId, row) => {
    const b = byId.get(beatId); if (!b) { report.push(`⚠ ${beatId}: not found`); return; }
    b.worldEffects = b.worldEffects && typeof b.worldEffects === "object" ? b.worldEffects : {};
    b.worldEffects.receipts = Array.isArray(b.worldEffects.receipts) ? b.worldEffects.receipts : [];
    if (b.worldEffects.receipts.some(r => r?.label === row.label)) { report.push(`· ok ${beatId}: receipt ${row.label}`); return; }
    b.worldEffects.receipts.push({ acquisition: "earned", ...row });
    changes++; report.push(`✚ ${beatId}: receipt "${row.label}"`);
  };

  /* 1 · THE MASK — Soft Landing, the castle, with the shoes ───────────────────────────────────────────────── */
  {
    const parent = byId.get("soft_landing_castle");
    if (!parent) report.push("⚠ soft_landing_castle: not found");
    else {
      addBeat(beat(parent, "sl_sparky_mask", "Soft Landing — The Mask With the Shoes",
        "Under the row of small sneakers, face down, where a kid would drop it the second the grown-ups stopped looking: a dog mask. Yellow vinyl, goggles painted on, one ear bent. SPARKY, says the forehead, in the font every cereal box used that year. The elastic has kept its stretch for two hundred years because nothing in Soft Landing is allowed to wear out. Turn it over and the inside still smells like a kid breathing hard from running.",
        [
          ch("Take the mask.", "soft_landing_castle", "You fold it into your coat. Nobody stops you. Nobody is coming back for it, and the castle hums on.",
            { questItems: [{ key: "sparky_mask", uuid: uuid("sparky_mask"), name: "Sparky Mask (Crown Mall, 2077)" }] }),
          ch("Leave it with the shoes.", "soft_landing_castle", "It belongs to the row. You straighten the ear and put it back face down, the way you found it.")
        ]));
      addChoice("soft_landing_castle", ch("Look under the shoes.", "sl_sparky_mask", "", { requires: [{ questItem: "sparky_mask", not: true }] }));
    }
  }
  /* 2 · THE SHIRT — Stillwater, Bucky Sorrel's concession ───────────────────────────────────────────────── */
  {
    const parent = byId.get("stillwater_lemonade");
    if (!parent) report.push("⚠ stillwater_lemonade: not found");
    else {
      addBeat(beat(parent, "sw_sparky_shirt", "Stillwater — The Shirt Off His Back",
        "Under the paper hat and the apron, Bucky Sorrel is wearing the top half of a Sparky the Reactor Pup costume — yellow, padded, the trefoil paw on the chest. \"It's not a costume,\" he says, before you can ask. \"It's a uniform. The parade concession has a uniform.\" He considers you with the eyes of a man who has never once given a refund. \"It's for sale. Everything's for sale. That's what a concession IS.\"",
        [
          ch("Buy it. Pay whatever he names.", "stillwater_lemonade", "\"Four buttons and the nickel.\" You pay. He pulls the shirt over his head without taking the hat off, which should not be possible, and is. Underneath he is wearing another, identical shirt. He does not explain this and you do not ask.",
            { questItems: [{ key: "sparky_shirt", uuid: uuid("sparky_shirt"), name: "Sparky Reactor-Suit Top (Crown Mall, 2077)" }] }),
          ch("Haggle.", "stillwater_lemonade", "He comes down to three buttons and looks at you with something close to love. The shirt comes off over the hat. There is another shirt under it.",
            { checkStat: "presence", checkDC: 12, failNext: "stillwater_lemonade_fail", questItems: [{ key: "sparky_shirt", uuid: uuid("sparky_shirt"), name: "Sparky Reactor-Suit Top (Crown Mall, 2077)" }] }),
          ch("Leave him his uniform.", "stillwater_lemonade", "\"Smart,\" he says. \"It's the only one.\" It is not the only one.")
        ]));
      addChoice("stillwater_lemonade", ch("\"Where'd you get the shirt?\"", "sw_sparky_shirt", "", { requires: [{ questItem: "sparky_shirt", not: true }] }));
    }
  }
  /* 3 · THE PANTS — Chuckle Creek, Dewey under the piano ────────────────────────────────────────────────── */
  {
    const parent = byId.get("chuckle_piano_kid");
    if (!parent) report.push("⚠ chuckle_piano_kid: not found");
    else {
      addBeat(beat(parent, "cc_sparky_pants", "Chuckle Creek — The Pants With the Knees Gone",
        "From under four hundred pounds of piano, Dewey looks down at himself. Yellow padded trousers, the trefoil paw on one hip, both knees worn through to the lining from — you count — eleven thousand and six pianos. \"These? They're Sparky's. Sparky the Reactor Pup. My brother had the top but he got too big.\" He inflates slightly, which is how he shrugs. \"You can have 'em. I don't need pants, nothing here hurts. I want a ride on your thing, though. The big one. With the wheels.\"",
        [
          ch("Trade: a ride on the rig for the pants.", "chuckle_piano_kid", "He is out from under the piano and into the pants-less state of a kid in a cartoon before you finish nodding — the pants hang in the air for one full second, empty, then drop into your hands. The ride, when you give it, is the quietest you ever see him.",
            { questItems: [{ key: "sparky_pants", uuid: uuid("sparky_pants"), name: "Sparky Reactor-Suit Pants (Crown Mall, 2077)" }] }),
          ch("Let him keep them.", "chuckle_piano_kid", "\"Suit yourself.\" The piano lands again. Eleven thousand and seven.")
        ]));
      addChoice("chuckle_piano_kid", ch("\"Nice pants.\"", "cc_sparky_pants", "", { requires: [{ questItem: "sparky_pants", not: true }] }));
    }
  }
  /* 4 · PROOF OF PURCHASE — Crown Mall, Miss June's rare inventory (needs all three pieces) ────────────── */
  {
    const parent = byId.get("enc_forgotten_yesterdays_miss_june_inventory");
    if (!parent) report.push("⚠ enc_forgotten_yesterdays_miss_june_inventory: not found");
    else {
      const nb = beat(parent, "cm_proof_of_purchase", "Crown Mall — Proof of Purchase",
        "Miss June looks at the mask, the top, the pants with the knees gone, and for the first time her smile does something that is not professional. \"Register four,\" she says. \"October thirtieth. Eleven fifty-two at night, because the parents always waited. Sparky Deluxe, nine to twelve, thirty-nine ninety-nine, cash.\" She reaches under the counter without looking and comes up with a slip of thermal paper so faded it is almost blank, and lays it on the glass between you. \"We keep the receipts. That is the whole of the Exchange. Rare inventory, sincerely reciprocated.\" The costume stays yours. The receipt is the fourth piece.",
        [
          ch("Take the receipt.", "enc_forgotten_yesterdays_miss_june_intro", "It weighs nothing. Everything you have ever bought weighs nothing, and this is the first time it has mattered."),
          ch("Leave", "enc_forgotten_yesterdays_tanneritos", "")
        ]);
      nb.worldEffects = { receipts: [{
        label: "Proof of Purchase", effectKey: "favorAllPlus1+coverTracks+clearScandal", acquisition: "earned",
        truth: "Crown Mall, register 4, 10/30/2077, 11:52 PM — SPARKY DLX COSTUME 9–12 ×1, $39.99, CASH. A child's name on the layaway line. Produce it in any court and the room remembers you as one of its own: every courtier warms to you, Suspicion cools, your Scandal is forgotten.",
        source: { name: "Miss June of the Endcap", npcActorId: parent.speakerActorId || null }
      }] };
      addBeat(nb);
      addChoice("enc_forgotten_yesterdays_miss_june_inventory", ch("Put the costume on the counter.", "cm_proof_of_purchase", "",
        { requires: [{ questItem: "sparky_mask" }, { questItem: "sparky_shirt" }, { questItem: "sparky_pants" }, { beatMark: "cm_proof_of_purchase", not: true }] }));
    }
  }
  /* 5 · QUEST REWARDS — real items on the endings' exit choices ──────────────────────────────────────────── */
  addQuestItem("chuckle_finale",                               /^continue/i,              "fog_machine",       "Fog Machine, Party Grade");
  addQuestItem("chuckle_new_episode",                          /^continue/i,              "walkie",            "Pre-Fall Walkie, One of a Pair");
  addQuestItem("stillwater_ring_the_bell",                     /^continue/i,              "candy_scale",       "Candy Scale, Calibrated to 2077");
  addQuestItem("stillwater_covenant",                          /^continue/i,              "glow_bandolier",    "Glow-Stick Bandolier");
  addQuestItem("soft_landing_go_first",                        /^continue/i,              "hoodie",            "Inlaid Trick-or-Treater's Hoodie");
  addQuestItem("soft_landing_practice",                        /^continue/i,              "spirit_board",      "Spirit Board, Travel Edition");
  addQuestItem("enc_forgotten_yesterdays_donny_good",          /^go in/i,                 "egg_shotgun",       "Inlaid Egg-Carton Shotgun");
  addQuestItem("enc_forgotten_yesterdays_skate_success",       /shadow in a hoodie/i,     "doorbell_knuckles", "Circuited Doorbell Knuckles");
  addQuestItem("enc_forgotten_yesterdays_vhs_lean_in",         /mall keeps happening/i,   "doorbell_camera",   "Doorbell Camera, Still Recording");
  addQuestItem("enc_forgotten_yesterdays_resolution_good",     /^continue/i,              "mall_vest",         "Inlaid Mall Security Vest");
  /* 6 · RECEIPTS — the reality-bending set, one per good ending ─────────────────────────────────────────── */
  addReceipt("chuckle_finale",            { label: "The Room Remembers Differently", effectKey: "strikeRecord", truth: "A series finale, aired once. Everyone who watched agrees on what happened, and they are all wrong in the same direction. Strike the last exchange from the record." });
  addReceipt("chuckle_new_episode",       { label: "Counterfeit Truth, Notarized",   effectKey: "counterfeit",  truth: "New episode, same cast, a line nobody remembers being written. Your next stolen receipt plays as earned." });
  addReceipt("stillwater_ring_the_bell",  { label: "A Recess, Called by Nobody",     effectKey: "recess",       truth: "The 4:10 came. Nobody got on. For one exchange the court simply stops to listen to it leave — nobody loses Influence." });
  addReceipt("stillwater_covenant",       { label: "Sovereign Writ",                 effectKey: "decree",       truth: "A covenant with a town that has agreed to keep being itself. Signed by every hand in it. You win the next exchange outright." });
  addReceipt("soft_landing_go_first",     { label: "Everyone Came Down Together",    effectKey: "favorAllPlus1", truth: "You grieved first and they followed, and for a moment every person in the room was on the ground with you. Every courtier warms to you by one." });
  addReceipt("enc_forgotten_yesterdays_resolution_good", { label: "The Agenda, Amended in Pencil", effectKey: "rewriteStake", truth: "Laser Bev's terms, in her own hand, with the word ACQUISITION crossed out and ALLIANCE written above it. Change what a Parley is for." });
  addReceipt("map_crown_mall_corroboration", { label: "The Price List",              effectKey: "namePrice",    truth: "The Tanneritos' archive, filed under WEATHER: who in this court wants what, and what it costs. Every courtier's favor, both sides, whispered to you." });

  return { changes, report };
}

(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const campsRaw = game.settings.get(NS, "campaigns");
  const campsWasStr = typeof campsRaw === "string";
  const camps = JSON.parse(campsWasStr ? campsRaw : JSON.stringify(campsRaw));   // true copy (never deepClone a setting — 2026-10-22)
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const { changes, report } = applyHoardPatch(camp, HOARD_DEFAULT);
  console.log(`[halloween-hoard 2026-10-31] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${changes} change(s)\n` + report.join("\n"));
  if (DRY_RUN) return ui.notifications.info(`DRY RUN — ${changes} change(s); see console.`);
  if (!changes) return ui.notifications.info("Nothing to change — already applied.");
  try { saveDataToFile(JSON.stringify(campsWasStr ? JSON.parse(campsRaw) : campsRaw, null, 2), "application/json", `campaigns-backup-pre-halloween-hoard-${Date.now()}.json`); } catch (e) { console.warn(e); }
  await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
  ui.notifications.info(`Applied ${changes} change(s) — the hoard is in the towns.`);
})();
