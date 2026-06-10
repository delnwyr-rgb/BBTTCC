// ─────────────────────────────────────────────────────────────────────────────
// Bad Eden — Append Per-Use callouts (Phase 3: species multi-ability pickers)
// ─────────────────────────────────────────────────────────────────────────────
// Paste into F12 console (as GM) and hit Enter. Idempotent.
// 3 species items: Circuitborn, Human, Stormborn Nomad.
// Each gets a callout listing all per-use abilities the species carries.
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const PACK_ID = "bbttcc-master-content.ancestries";

  // Per-species multi-ability callout. `key` distinguishes the callout from
  // others on the same item.
  const SPECS = {
    "Circuitborn": {
      key: "circuitbornAbilities",
      summary: "Click this species feature to open the abilities picker.",
      abilities: [
        ["Attention Resonance", "1/long rest", "GM-triggered (focus on you)",
         "Regain one Bad Eden OP from a category used this scene, OR HP equal to your PB. Two-choice on use."],
        ["Glitch-Surge", "Passive trigger (no daily cap)", "Reaction (on dropping to 0 HP)",
         "Emit a controlled burst of static — loud, disorienting, no damage. Excuse for narrative consequences."]
      ]
    },
    "Human": {
      key: "humanAbilities",
      summary: "Click this species feature to open the abilities picker.",
      abilities: [
        ["Adaptive", "1/long rest", "Free (on failed save)",
         "Treat a failed saving throw as a success."],
        ["Tenacious", "1/round (only at 1 HP)", "Free (declare before roll)",
         "While at exactly 1 HP, advantage on one check of your choice each round."]
      ]
    },
    "Stormborn Nomad": {
      key: "stormbornWardOfTheGale",
      summary: "Click this species feature to invoke Ward of the Gale.",
      abilities: [
        ["Ward of the Gale", "1/long rest", "Reaction (on environmental damage)",
         "Reduce environmental damage (storm, heat, hazard) to half until the start of your next turn."]
      ]
    }
  };

  const calloutFor = (spec) => {
    const rows = spec.abilities.map(([label, recovery, action, body]) => `
    <div style="margin-top:0.35rem;padding:0.4rem 0.55rem;background:rgba(40,55,75,0.35);border-radius:0.25rem">
      <div style="font-size:0.82rem"><strong>${label}</strong></div>
      <div style="font-size:0.78rem;opacity:0.86;margin-top:0.15rem"><strong>Recovery:</strong> ${recovery} &nbsp;·&nbsp; <strong>Action:</strong> ${action}</div>
      <div style="font-size:0.78rem;opacity:0.85;margin-top:0.15rem">${body}</div>
    </div>`).join("");
    return `<div data-ft-per-use="1" data-ft-per-use-key="${spec.key}" style="margin-top:0.7rem;padding:0.55rem 0.75rem;border:1px solid #8aa4c2;border-radius:0.35rem;background:rgba(45,65,95,0.18);">
  <div style="font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;color:#b8d0e8;margin-bottom:0.25rem">⟁ Per-Use Abilities — <strong>Species Set</strong></div>
  <div style="font-size:0.84rem;opacity:0.9">${spec.summary}</div>${rows}
</div>`;
  };

  const patchDoc = async (doc, spec) => {
    const val = doc.system?.description?.value ?? "";
    if (val.includes(`data-ft-per-use-key="${spec.key}"`)) return { status: "skip" };
    await doc.update({ "system.description.value": val + calloutFor(spec) });
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
    const spec = SPECS[e.name];
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
      const spec = SPECS[item.name];
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
    `Phase 3 species callouts: pack ${packOK} updated, ` +
    `${actorOK} actor items updated across ${actorTouched} actors.`
  );
  console.log("DONE");
})();
