// ─────────────────────────────────────────────────────────────────────────────
// BBTTCC — Append Per-Use callouts to ancestry cores + heritages
// ─────────────────────────────────────────────────────────────────────────────
// Paste this whole block into the F12 console (as GM) and hit Enter.
// It updates BOTH the compendium master copies AND every existing actor that
// already has one of these items. Idempotent (skips items that already carry
// the callout marker).
//
// Affects 16 items: 4 ancestry cores + 12 heritage variants (3 per ancestry).
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";
  const MARKER  = 'data-ft-per-use="1"';

  const HEX_REC     = ["Hex Recognition", "1/scene", "Action",
    "On a natural surface you're touching, whisper a question — GM answers with one true thing the land knows."];
  const TEMP_FLINCH = ["Temporal Flinch", "1/scene", "Reaction",
    "When an attack would hit you or an ally within 10 ft, shift them 5 ft. If that breaks range/LoS, the attack misses."];
  const SEFIROT_ATT = ["Sefirot Attunement", "1/scene", "Free (declare before roll)",
    "Invoke your chosen sephirah for +1 rank bonus on a check clearly in its domain."];
  const QLIPH_SAT   = ["Qliphothic Saturation", "1/scene", "Free",
    "Reroll a failed Soul check. Cost: scene's Darkness-gain count goes up by 1."];

  // Map item name → ability spec
  const NAMES = {
    "Menhirkin Core: The Land Stood Up":        HEX_REC,
    "Menhirkin Heritage: Igneous":              HEX_REC,
    "Menhirkin Heritage: Metamorphic":          HEX_REC,
    "Menhirkin Heritage: Sedimentary":          HEX_REC,
    "Echo-Diver Core: Half-Second Inheritance": TEMP_FLINCH,
    "Echo-Diver Heritage: Abyssal":             TEMP_FLINCH,
    "Echo-Diver Heritage: Empyrean":            TEMP_FLINCH,
    "Echo-Diver Heritage: Tellurian":           TEMP_FLINCH,
    "Sephirotic Scion Core: The Higher Register": SEFIROT_ATT,
    "Sephirotic Scion Heritage: Cherubic":      SEFIROT_ATT,
    "Sephirotic Scion Heritage: Ophanic":       SEFIROT_ATT,
    "Sephirotic Scion Heritage: Seraphic":      SEFIROT_ATT,
    "Qliph-Scarred Core: What Walked Out":      QLIPH_SAT,
    "Qliph-Scarred Heritage: Chthonic":         QLIPH_SAT,
    "Qliph-Scarred Heritage: Diabolic":         QLIPH_SAT,
    "Qliph-Scarred Heritage: Husk":             QLIPH_SAT,
  };

  const calloutFor = ([label, recovery, action, summary]) =>
`<div data-ft-per-use="1" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #6a8caa;border-radius:0.35rem;background:rgba(55,75,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#a8c4e0;margin-bottom:0.25rem">⟁ Per-Use Ability — <strong>${label}</strong></div>
  <div style="font-size:0.86rem;opacity:0.92;line-height:1.4"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action} &nbsp;·&nbsp; <strong>Use:</strong> Click this feature on your sheet to invoke.</div>
  <div style="font-size:0.82rem;opacity:0.85;margin-top:0.3rem">${summary}</div>
</div>`;

  const patchDoc = async (doc, spec, label) => {
    const val = doc.system?.description?.value ?? "";
    if (val.includes(MARKER)) return { status: "skip", reason: "already patched" };
    const newVal = val + calloutFor(spec);
    await doc.update({ "system.description.value": newVal });
    return { status: "ok", label };
  };

  // ── Pass 1: compendium pack ──────────────────────────────────────────────
  const pack = game.packs.get(PACK_ID);
  if (!pack) { ui.notifications.error(`Pack ${PACK_ID} not found.`); return; }
  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });
  const index = await pack.getIndex({ fields: ["name"] });
  let packOK = 0, packSkip = 0;
  for (const entry of index) {
    const spec = NAMES[entry.name];
    if (!spec) continue;
    const doc = await pack.getDocument(entry._id);
    const r = await patchDoc(doc, spec, entry.name);
    if (r.status === "ok") packOK++; else packSkip++;
    console.log(`  [pack] ${r.status.toUpperCase()}  ${entry.name}`);
  }
  if (wasLocked) await pack.configure({ locked: true });

  // ── Pass 2: every existing actor's items ─────────────────────────────────
  let actorOK = 0, actorSkip = 0, actorTouched = 0;
  for (const actor of game.actors) {
    let touched = false;
    for (const item of actor.items) {
      const spec = NAMES[item.name];
      if (!spec) continue;
      const r = await patchDoc(item, spec, item.name);
      if (r.status === "ok") { actorOK++; touched = true; }
      else { actorSkip++; }
      console.log(`  [${actor.name}] ${r.status.toUpperCase()}  ${item.name}`);
    }
    if (touched) actorTouched++;
  }

  ui.notifications.info(
    `Per-Use callouts: pack ${packOK}/${packOK+packSkip} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
