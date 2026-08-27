// import-qliphoth-bestiary.macro.js — GM script macro
// Imports the 20 Qliphothic Bestiary actors (RFI-converted from the D&D5E
// exports in "Qlipothic Monsters", per "Qliphothic Beasts and How To Draw
// Them") into an Actor folder named "Qliphothic Bestiary".
//
// Source JSONs are served from Data/bbttcc-tools/qliphoth-bestiary/ (synced to
// local + both Lightsail instances 2026-08-26). Safe to re-run: actors whose
// name already exists in the world are skipped, never overwritten.
//
// Ten Qliphoth, one Lesser and one Greater spawn each. All carry
// flags.fourththing.rfi.actor.qliphah = { name, hullOf, grade }.

const DRY_RUN = false; // true = list what would be imported, create nothing

const BASE = "bbttcc-tools/qliphoth-bestiary";
const FILES = [
  "fvtt-Actor-thaumielite-despot-pOOkAiYa5ZtS5EeW.json",
  "fvtt-Actor-archon-of-the-twin-crown-MLGZz6bAhIZbELTV.json",
  "fvtt-Actor-ghagielite-blinder-HuuqXdrQJ04lRQZV.json",
  "fvtt-Actor-obstructor-demon-LduYiOAoxyuDQzHV.json",
  "fvtt-Actor-satariel-veil-spinner-YbSJwkHXEc8MzgtV.json",
  "fvtt-Actor-whispering-deceiver-mkTqo9Y4Jlt7LHQh.json",
  "fvtt-Actor-gamchicoth-reveller-Q2fXvaOk3nWNgyY5.json",
  "fvtt-Actor-abomination-of-excess-nxgYs6QDBw0jfraa.json",
  "fvtt-Actor-golachab-flayer-Mn6jPjJ55R25T7jA.json",
  "fvtt-Actor-inferno-of-cruelty-QgTuSOOea3Q4soxp.json",
  "fvtt-Actor-thagirion-disputant-6Jv5v6f0jHKS5oOZ.json",
  "fvtt-Actor-war-incarnate-UdYtulFvT1aPi8wD.json",
  "fvtt-Actor-harab-serapel-scavenger-Tcswc5ICzpGYNFFY.json",
  "fvtt-Actor-the-ashen-horde-noX2ayKHtoDnsM8I.json",
  "fvtt-Actor-samaelite-poisoner-1DcKNNPInTtu0ZsB.json",
  "fvtt-Actor-angel-of-hollow-glory-VAfHQqhNFdZeKl25.json",
  "fvtt-Actor-gamalielite-dream-twister-CVVwFj01QPbDMnKL.json",
  "fvtt-Actor-the-lewd-miasma-1cEJLMaGJaJxqBKH.json",
  "fvtt-Actor-nahemoth-husk-jHAX2VchsbAMNuyP.json",
  "fvtt-Actor-the-gilded-tyrant-xNvdt5T0MfXyN1cA.json",
];

(async () => {
  if (!game.user.isGM) return ui.notifications.warn("Qliphoth import: GM only.");

  let folder = game.folders.find(f => f.type === "Actor" && f.name === "Qliphothic Bestiary");
  if (!folder && !DRY_RUN) {
    folder = await Folder.create({ type: "Actor", name: "Qliphothic Bestiary", color: "#3d1f4e" });
  }

  const existing = new Set(game.actors.map(a => a.name));
  const docs = [];
  const skipped = [];
  for (const file of FILES) {
    let data;
    try {
      data = await foundry.utils.fetchJsonWithTimeout(`${BASE}/${file}`);
    } catch (err) {
      console.error(`Qliphoth import: failed to fetch ${file}`, err);
      ui.notifications.error(`Qliphoth import: could not fetch ${file} — is Data/${BASE} synced?`);
      continue;
    }
    if (existing.has(data.name)) { skipped.push(data.name); continue; }
    delete data._id;
    if (folder) data.folder = folder.id;
    docs.push(data);
  }

  console.log("Qliphoth import — would create:", docs.map(d => d.name));
  if (skipped.length) console.log("Qliphoth import — skipped (already in world):", skipped);

  if (DRY_RUN) {
    return ui.notifications.info(
      `Qliphoth import DRY RUN: ${docs.length} to create, ${skipped.length} skipped. See console.`);
  }

  const created = await Actor.createDocuments(docs);
  ui.notifications.info(
    `Qliphothic Bestiary: imported ${created.length} actors` +
    (skipped.length ? `, skipped ${skipped.length} already present.` : "."));
})();
