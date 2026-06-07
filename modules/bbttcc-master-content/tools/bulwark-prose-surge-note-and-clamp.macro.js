// bulwark-prose-surge-note-and-clamp.macro.js — RUN IN-WORLD (GM). Run in BOTH worlds.
// Brexit audit 2026-06-07:
//   (1) PROSE — Bulwark class/doctrine items still narrate Frame Dice / Ruin
//       Charges, but those pools were folded into ◆ Surge on 2026-05-28.
//       Prepends a styled ENGINE NOTE banner to each affected embedded item's
//       description (idempotent — skips items already bannered). Original
//       prose is preserved below the banner for flavor/history.
//   (2) SKILL CLAMP — sweeps every character actor's skill ranks to the cap
//       of 5 (Brexit's Athletics sat at 20 from a runaway repeated +1 grant;
//       rolls were getting +20 where Legendary should give +5).
//
// DRY_RUN=true first (reports). Set DRY_RUN=false to apply. F5 afterwards.
(async () => {
  const DRY_RUN = true;                              // <-- set false to apply
  if (!game.user.isGM) return ui.notifications.warn("GM only.");

  // Identifiers of the Frame/Ruin-stale Bulwark items.
  const STALE_IDS = new Set([
    "bulwark",                                   // class core
    "bulwark_tier1_founding_stance",
    "bulwark_avalanche_l1_kinetic_inversion",
    "bulwark_avalanche_l5_shockwave_arrival",
    "bulwark_tier3_polarity_mastery",
    "bulwark_tier4_architect_of_certainty",
    "bulwark_avalanche_l17_running_theology"
  ]);

  const BANNER = `<div class="ft-engine-note" style="border:1px solid #e8c84a;border-left:4px solid #e8c84a;border-radius:6px;padding:0.45rem 0.6rem;margin:0 0 0.5rem;background:rgba(232,200,74,0.07);font-size:0.84rem">
    <b style="color:#b8962a">⚙ ENGINE NOTE — Frame &amp; Ruin are now ◆ Surge.</b>
    Read <b>Frame Die</b> as banked Surge spent defensively and <b>Ruin Charge</b> as banked Surge spent offensively.
    Your Bulwark <b>banks +1 Surge whenever you take Integrity damage</b> (max +2/round; +3 with Polarity Mastery, Mountain).
    The Avalanche kit lives in the <b>◆ Surge menu</b>: Roll Forward 1✦ · Crash 3✦ · Unstoppable 5✦.
    Automated for you: <b>Polarity Mastery</b> (successful melee strike with a base die ≥ 8 → +1 Surge, 1/round),
    <b>Anchor or Advance</b> and <b>The Breach</b> (clickable, 1/scene, recover on Scene/Soma Break),
    <b>Grim Persistence</b> (+2×level Integrity max + 1/Sanctuary hold-at-1), <b>Fluid Footwork</b> (+10 ft), <b>Anchor Point</b> (rerolls).
  </div>`;

  let prosed = 0, clamped = 0, actorsTouched = 0;
  for (const actor of game.actors ?? []) {
    if (actor.type !== "character" && actor.type !== "npc") continue;
    const ups = [];
    // (1) prose banners
    for (const it of actor.items) {
      if (!STALE_IDS.has(String(it.system?.identifier ?? ""))) continue;
      const cur = String(it.system?.description?.value ?? "");
      if (cur.includes("ft-engine-note")) continue; // already bannered
      ups.push({ _id: it.id, "system.description.value": BANNER + cur });
    }
    if (ups.length) {
      prosed += ups.length; actorsTouched++;
      console.log(`[prose] ${actor.name}: ${ups.length} item(s) bannered`);
      if (!DRY_RUN) await actor.updateEmbeddedDocuments("Item", ups);
    }
    // (2) skill clamp (characters only — NPC ranks are stat-block authored)
    if (actor.type === "character") {
      const sysSrc = actor._source?.system?.system ?? actor._source?.system ?? {};
      const skills = sysSrc.skills ?? {};
      const su = {};
      for (const [k, v] of Object.entries(skills)) {
        const cur = Number(v?.value ?? 0);
        if (Number.isFinite(cur) && cur > 5) {
          su[`system.skills.${k}.value`] = 5;
          console.log(`[clamp] ${actor.name}: ${k} ${cur} → 5`);
          clamped++;
        }
      }
      if (Object.keys(su).length && !DRY_RUN) await actor.update(su);
    }
  }
  console.log(`=== bulwark-prose-surge-note-and-clamp ${DRY_RUN ? "(DRY RUN)" : "(APPLIED)"} ===`);
  console.log(`banners: ${prosed} items on ${actorsTouched} actors · skill clamps: ${clamped}`);
  ui.notifications.info(`${DRY_RUN ? "[DRY RUN] " : ""}Bulwark prose: ${prosed} items bannered · ${clamped} over-cap skill ranks clamped.${DRY_RUN ? " Check console, set DRY_RUN=false." : " F5 to load."}`);
})();
