// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Append Per-Use callouts (Phase 5 — RFI subclasses, REVISED)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM). Idempotent.
// 12 RFI subclass items live in `bbttcc-master-content.classes` (the
// `subclasses` pack is empty — doctrines live with their parent paths).
// Identifiers verified against live compendium 2026-04-27.
//
// Coverage: Soul Smith forges (3), Dreamwalker trances (3), Wyrdlens
// refractions (3), Harmony Marshal mandates (3).
// (Phantom Courier and Breaker subclass items were retired in Sprint F and no
// longer exist in the live compendium — skipped.)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const SPECS = {
    // Soul Smith forges (3)
    "bbttcc-soul-smith-smith-bound-light": {
      key: "soulsmithBoundlight", title: "Forge of Bound Light",
      abilities: [
        { label: "Pattern of Mercy (L14)", recovery: "1/long rest", action: "Free (after Parley)",
          body: "After a successful Parley: convert 1 Economy → 1 Soft Power OP." }
      ]
    },
    "bbttcc-soul-smith-smith-spark-reclaimer": {
      key: "soulsmithSparkReclaimer", title: "Forge of the Spark Reclaimer",
      abilities: [
        { label: "Clean Extraction (L14)", recovery: "1/long rest", action: "Free (after salvage/demolition)",
          body: "Negate a Darkness tick caused by a salvage or demolition you orchestrated." }
      ]
    },
    "bbttcc-soul-smith-smith-victory": {
      key: "soulsmithVictory", title: "Forge of Victory",
      abilities: [
        { label: "Standard of Will (L3)", recovery: "1/scene", action: "Action",
          body: "Raise a standard. Allies within 15 ft +1 vs. fear. At scene end → +1 Unity/VP." },
        { label: "Victory Forge (L14)", recovery: "1/long rest", action: "Free (after peaceful objective)",
          body: "Convert 1 Intrigue → 1 Diplomacy OR 1 Soft Power OP." }
      ]
    },

    // Dreamwalker trances (3)
    "bbttcc-dreamwalker-quiet-sun": {
      key: "dreamQuietSun", title: "Trance of the Quiet Sun",
      abilities: [
        { label: "Somnolent Peace (L3)", recovery: "1/scene", action: "Reaction (on lethal hit)",
          body: "Turn a lethal blow into unconsciousness at 1 HP." },
        { label: "Daybreak (L14)", recovery: "1/long rest", action: "Free (after no-fatalities victory)",
          body: "Darkness −1 and +1 Diplomacy OP." }
      ]
    },
    "bbttcc-dreamwalker-sapphire-gate": {
      key: "dreamSapphire", title: "Trance of the Sapphire Gate",
      abilities: [
        { label: "Lucid Step (L3)", recovery: "1 Soft Power OP / use", action: "Free",
          body: "Spend 1 Soft Power OP to learn if the next Spark lead is Conceptual, Vestigial, or Animate." },
        { label: "Sapphire Conduction (L14)", recovery: "1/long rest", action: "Free (after Spark step success)",
          body: "Darkness −1." }
      ]
    },
    "bbttcc-dreamwalker-thousand-faces": {
      key: "dreamThousand", title: "Trance of the Thousand Faces",
      abilities: [
        { label: "Persona Cache (L3)", recovery: "1 Soft Power OP / switch", action: "Free (Courtly Intrigue)",
          body: "Spend 1 Soft Power OP to switch personas and gain Advantage on your next Deception or Persuasion." },
        { label: "Borrowed Voice (L10)", recovery: "1/short rest", action: "Action",
          body: "Mimic a voice you've heard for up to 1 minute." }
      ]
    },

    // Wyrdlens refractions (3)
    "bbttcc-wyrdlens-adept-foresight": {
      key: "wyrdlensForesight", title: "Refraction of Foresight",
      abilities: [
        { label: "Force Enemy Reroll", recovery: "1/Strategic Turn (1 Intrigue OP)", action: "Strategic",
          body: "Spend 1 Intrigue OP to force an enemy strategic reroll." }
      ]
    },
    "bbttcc-wyrdlens-adept-mercy": {
      key: "wyrdlensMercy", title: "Refraction of Mercy",
      abilities: [
        { label: "Mercy Refraction (L3)", recovery: "1/scene", action: "Reaction (on witnessed lethal hit)",
          body: "Convert a lethal hit you witness into non-lethal. If it forces surrender, +1 Diplomacy OP." },
        { label: "Sephirothic Bloom (L14)", recovery: "1/long rest", action: "Free (after non-lethal victory)",
          body: "Darkness −1 and shift Hex one step toward a beneficial Sephirah." }
      ]
    },
    "bbttcc-wyrdlens-adept-truth": {
      key: "wyrdlensTruth", title: "Refraction of Truth",
      abilities: [
        { label: "Truth Refraction (L3)", recovery: "1 Intrigue OP / use", action: "Free",
          body: "Spend 1 Intrigue OP to treat one Spark Identification roll ≤9 as 10 this Turn." },
        { label: "Unshatter (L14)", recovery: "1/long rest", action: "Action (short penance)",
          body: "Purify a Corrupted Spark step. Darkness −1." }
      ]
    },

    // Harmony Marshal mandates (3)
    "bbttcc-harmony-marshal-marshal-accord": {
      key: "harmAccord", title: "Mandate of Accord",
      abilities: [
        { label: "Accord Engine (L3)", recovery: "1 Diplomacy OP / use", action: "Free (during Parley)",
          body: "Spend 1 Diplomacy OP to treat an opposing roll ≤9 as 10 if outcome moves toward peace." },
        { label: "Unity Cadence (L6)", recovery: "1/scene", action: "Free (at scene end)",
          body: "End a scene you lead with zero fatalities → +1 Unity/VP." },
        { label: "Resonant Truce (L10)", recovery: "1/long rest", action: "Action (1-minute aura)",
          body: "Enemies in 15 ft have disadvantage to attack non-hostiles; advantage on saves to end fear/charm." }
      ]
    },
    "bbttcc-harmony-marshal-marshal-overwatch": {
      key: "harmOverwatch", title: "Mandate of Overwatch",
      abilities: [
        { label: "Counter-Discord (L6)", recovery: "1/short rest", action: "Reaction",
          body: "Cancel a deceit-based reroll/disadvantage within 60 ft." }
      ]
    },
    "bbttcc-harmony-marshal-marshal-resolve": {
      key: "harmResolve", title: "Mandate of Resolve",
      abilities: [
        { label: "Steel & Velvet (L14)", recovery: "1/scene", action: "Free (after averted rout)",
          body: "Gain +1 Soft Power OP and +1 Diplomacy OP." }
      ]
    },
  };

  const calloutFor = (spec) => {
    const rows = spec.abilities.map(a => `
    <div style="margin-top:0.35rem;padding:0.4rem 0.55rem;background:rgba(60,40,75,0.32);border-radius:0.25rem">
      <div style="font-size:0.82rem"><strong>${a.label}</strong></div>
      <div style="font-size:0.78rem;opacity:0.86;margin-top:0.15rem"><strong>Recovery:</strong> ${a.recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${a.action}</div>
      <div style="font-size:0.78rem;opacity:0.85;margin-top:0.15rem">${a.body}</div>
    </div>`).join("");
    return `<div data-ft-per-use="1" data-ft-per-use-key="${spec.key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #b08acc;border-radius:0.35rem;background:rgba(70,55,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#d4b8e8;margin-bottom:0.25rem">⟁ Per-Use Abilities — <strong>${spec.title}</strong></div>
  <div style="font-size:0.84rem;opacity:0.9">Click this subclass on your sheet to invoke. Each ability tracks its own cadence.</div>${rows}
</div>`;
  };

  const patchDoc = async (doc, spec) => {
    const val = doc.system?.description?.value ?? "";
    if (val.includes(`data-ft-per-use-key="${spec.key}"`)) return { status: "skip" };
    await doc.update({ "system.description.value": val + calloutFor(spec) });
    return { status: "ok" };
  };

  // Pack pass — classes pack (subclasses live here, not in the empty subclasses pack)
  const pack = game.packs.get("bbttcc-master-content.classes");
  if (!pack) { ui.notifications.error("Classes pack not found"); return; }
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  const idx = await pack.getIndex({ fields: ["name"] });
  let packOK = 0, packSkip = 0;
  for (const e of idx) {
    const doc = await pack.getDocument(e._id);
    const id = doc.system?.identifier ?? "";
    const spec = SPECS[id];
    if (!spec) continue;
    const r = await patchDoc(doc, spec);
    if (r.status === "ok") {
      packOK++;
      console.log(`  [pack] OK    ${doc.name}`);
    } else {
      packSkip++;
      console.log(`  [pack] skip  ${doc.name} (already patched)`);
    }
  }
  if (wasLocked) await pack.configure({ locked: true });

  // Actors
  let actorOK = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const id = item.system?.identifier ?? "";
      const spec = SPECS[id];
      if (!spec) continue;
      const r = await patchDoc(item, spec);
      if (r.status === "ok") { actorOK++; touched = true; console.log(`  [${actor.name}] OK  ${item.name}`); }
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(
    `Phase 5 RFI-subclass callouts: pack ${packOK}/${packOK+packSkip} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
