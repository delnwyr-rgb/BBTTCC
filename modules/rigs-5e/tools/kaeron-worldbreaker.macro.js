// rigs-5e · tools/kaeron-worldbreaker.macro.js  (Dave 2026-11-12)
// Make the Third Kaeron War's WORLDBREAKER (a hand-built dnd5e vehicle) a real crewed rig:
//   · ensure() it as a rig: mecha bracket, tier 5, mobile, deployed, its 1200-HP hull kept (integrity.authored)
//   · embed the "Worldbreaker Chassis" frame (rig-builder template worldbreaker_titan, rig-builder.js ~L375):
//     crew seats pilot 1–2 / gunner 4–8 / engineer 2–4 / crew 6–18 and each role's actions
//   · put back its authored AC 34 (the first ensure re-seats AC to bracket + tier) and give it a 60 ft stride
// The 12 "Station NN" feats stay as they are: the ones with activities are the gunners' weapons, the rest are
// modules the crew operate. Idempotent. DRY_RUN = true only reports.
const DRY_RUN = true;
const NAME = "WORLDBREAKER";
const AC = 34, WALK = 60, DT = 30;   // authored values the rig engine would re-seat by bracket

const R = game.bbttcc?.rigs;
if (!game.modules.get("rigs-5e")?.active || !R?.impl?.ensure) return ui.notifications.error("rigs-5e is not enabled in this world.");
const rig = game.actors.find(a => a.type === "vehicle" && a.name === NAME);
if (!rig) return ui.notifications.error(`No vehicle named ${NAME}.`);

const FRAME = {
  name: "Worldbreaker Chassis", type: "loot", img: rig.img,
  system: { description: { value: "<p>Kaiju-class war titan chassis — the apex of the giant-robot ladder, crewed by a dozen. Twelve action stations; each crew member's whole turn.</p>" } },
  flags: { fourththing: { rigFrame: {
    synthName: "Worldbreaker Chassis", bracket: "mecha", baseIntegrity: 200, tierStep: 40,
    mobilityAllowed: ["mobile"], slots: { weapon: 4, system: 4, output: 1 },
    capacity: { pilot: { min: 1, max: 2 }, gunner: { min: 4, max: 8 }, engineer: { min: 2, max: 4 }, crew: { min: 6, max: 18 } },
    actions: { pilot: ["steer", "stomp", "evasive", "vent-heat"], gunner: ["fire-weapon", "aimed-shot"], engineer: ["repair", "vent-heat"], crew: ["operate-module", "brace", "signal", "hold-on"] },
    travel: { speed: 4, range: 14 } } } }
};

const report = [];
const wasRig = R.isRig(rig);
report.push(wasRig ? "already a rig — re-asserting" : "converting to a rig");
if (!DRY_RUN) {
  await R.impl.ensure(rig, { identity: { mobility: "mobile", state: "deployed", archetype: "worldbreaker" },
    integrity: { bracket: "mecha", tier: 5, authored: true }, travel: { speed: 4, range: 14, hazardResist: 3 } });
  await R.update(rig, { "integrity.authored": true });
}
const haveFrame = rig.items.find(i => i.flags?.fourththing?.rigFrame);
report.push(haveFrame ? `frame present: ${haveFrame.name}` : "embedding Worldbreaker Chassis frame");
if (!DRY_RUN && !haveFrame) {
  await rig.createEmbeddedDocuments("Item", [FRAME]);
  await new Promise(r => setTimeout(r, 800));          // the createItem hook applies the frame
  const fr = rig.items.find(i => i.flags?.fourththing?.rigFrame);
  if (fr && !R.data(rig)?.frame?.itemId) await R.impl.applyFrame?.(rig, fr);
}
report.push(`AC → ${AC} (flat), walk → ${WALK} ft, DT → ${DT}`);
// dnd5e 6 stores speed at movement.speeds.<mode>; the frame's bracket re-seats hp.dt, so put the authored DT back too.
if (!DRY_RUN) await rig.update({ "system.attributes.ac.calc": "flat", "system.attributes.ac.flat": AC, "system.attributes.movement.speeds.walk": String(WALK), "system.attributes.hp.dt": DT });
const d = R.data(rig);
report.push(`now: ${d ? `rig · ${d.integrity.bracket} T${d.integrity.tier} · hull ${d.integrity.value}/${d.integrity.max} · frame ${d.frame?.name ?? "—"}` : "not a rig (dry run)"}`);
console.log("[kaeron-worldbreaker]", report);
ui.notifications.info(`${DRY_RUN ? "DRY RUN — " : ""}${report.join(" · ")}`);
return report;
