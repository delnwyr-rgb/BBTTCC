// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Append Per-Use callouts (Phase 2: heritage-unique + ancestry feats)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM) and hit Enter. Idempotent.
// 6 items: Igneous Heat Memory, Rustland Patch & Repurpose, Predator Patience,
//          Phoenix Oath, Hearth Dominion, Sun-Scar.
//
// Igneous already shows the Hex Recognition callout from Phase 1; this adds a
// SECOND callout for Heat Memory underneath.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";
  const MARKER_ATTR_PREFIX = "data-ft-per-use-key";

  // Each entry: name → ability spec [label, recovery, action, summary, key]
  // `key` distinguishes multiple callouts on the same item (Igneous gets two).
  const HEAT_MEMORY = ["Heat Memory", "1/Soma Break", "Bonus Action (after banking fire damage)",
    "Bank fire damage you take, then spend banked heat as a bonus action to add +1d10 exploding fire damage to your next attack that connects.",
    "heatMemory"];
  const PATCH_REPURPOSE = ["Patch & Repurpose", "1/Soma Break", "Free (during short rest)",
    "During a short rest in a ruin/wreckage hex, recover one expended consumable (bandage, filter, torch, ration) by scavenging.",
    "patchRepurpose"];
  const PREDATOR_PATIENCE = ["Predator Patience", "1/long rest", "Free (on failed attack roll)",
    "Treat a failed attack roll as a hit. Describe the perfect timing.",
    "predatorPatience"];
  const PHOENIX_OATH = ["Phoenix Oath", "1/long rest", "Reaction (auto, on dropping to 0 HP)",
    "When you would drop to 0 HP, instead drop to 1 HP and erupt — hostile creatures within 10 ft take 2d6+PB fire, end one condition (charmed/frightened/restrained).",
    "phoenixOath"];
  const HEARTH_DOMINION = ["Hearth Dominion", "1/long rest", "Action (1-minute ritual)",
    "Sanctify a fire/heat-source. Allies who rest within 30 ft regain an extra Hit Die and have advantage vs. fear until their next long rest.",
    "hearthDominion"];
  const SUN_SCAR = ["Sun-Scar", "Passive trigger (no daily cap)", "Reaction (on successful save)",
    "When you succeed on a saving throw, you may deal psychic damage equal to your PB to a creature within 10 ft (your aura flares).",
    "sunScar"];

  const NAMES = {
    "Menhirkin Heritage: Igneous":               HEAT_MEMORY,
    "Oldenborn Heritage: Rustland Scavenger":    PATCH_REPURPOSE,
    "Furrykin (Felid): Predator Patience":       PREDATOR_PATIENCE,
    "Oldenborn (Ember-Touched): Phoenix Oath":   PHOENIX_OATH,
    "Oldenborn (Ember-Touched): Hearth Dominion": HEARTH_DOMINION,
    "Oldenborn (Ember-Touched): Sun-Scar":        SUN_SCAR,
  };

  const calloutFor = ([label, recovery, action, summary, key]) =>
`<div data-ft-per-use="1" ${MARKER_ATTR_PREFIX}="${key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #c08e6a;border-radius:0.35rem;background:rgba(95,65,45,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#e8b890;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const patchDoc = async (doc, spec) => {
    const val = doc.system?.description?.value ?? "";
    const keyAttr = `${MARKER_ATTR_PREFIX}="${spec[4]}"`;
    if (val.includes(keyAttr)) return { status: "skip" };
    const newVal = val + calloutFor(spec);
    await doc.update({ "system.description.value": newVal });
    return { status: "ok" };
  };

  // Pack
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  const idx = await pack.getIndex({ fields: ["name"] });
  let packOK = 0;
  for (const e of idx) {
    const spec = NAMES[e.name];
    if (!spec) continue;
    const doc = await pack.getDocument(e._id);
    const r = await patchDoc(doc, spec);
    if (r.status === "ok") {
      packOK++;
      console.log(`  [pack] OK  ${e.name}`);
    } else {
      console.log(`  [pack] skip  ${e.name}`);
    }
  }
  if (wasLocked) await pack.configure({ locked: true });

  // Actors
  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const spec = NAMES[item.name];
      if (!spec) continue;
      const r = await patchDoc(item, spec);
      if (r.status === "ok") {
        actorOK++;
        touched = true;
        console.log(`  [${actor.name}] OK  ${item.name}`);
      }
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(
    `Phase 2 callouts: pack ${packOK} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
