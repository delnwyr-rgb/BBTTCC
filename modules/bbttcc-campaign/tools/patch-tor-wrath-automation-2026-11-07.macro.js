/*
 * patch-tor-wrath-automation-2026-11-07.macro.js — the East Wall fight (Dave, 2026-11-07): the Tor-Wrath's npcAuto rules were
 * copied from another creature (the Ghagielite Blinder's "Mind-Cluttering Bite" / obscuring sphere), so:
 *   • Yesod Gone Dark and Comes Through the Rock BOTH applied Imposed to every roll within 4 squares (JESSIE's maul rolled
 *     3d10-keep-worst every turn) — the text says Soul and Resolve checks within 3 squares.
 *   • Tantrum dropped a 15-ft obscuring sphere ("Mind DC 12 or Compelled") — the text says a 3-square line, Body vs DC 12,
 *     2d6 kinetic and Prone.
 *   • Ore-Fist / Grief Undertow carried a saveFail rule for a weapon the Tor-Wrath doesn't have.
 * Also Dave: the win card must NOT say "the pressure goes back to the mountain" — the clause comes off Comes Through the Rock.
 * Fixes the WORLD actor (ezj270bdRSzb6mAT) and the bbttcc-master-content.npcs record of the same id. Tokens already on a map
 * are unlinked copies and keep their old data (place fresh ones). Uses the system's own npcAuto grammar (disSaves added
 * the same day). Ember Bad Eden. globalThis.__torWrathDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__torWrathDry !== false, report = { DRY_RUN, changed: [] };
  const ID = "ezj270bdRSzb6mAT";
  const WANT = {
    "Yesod Gone Dark": {
      rules: [{ on: "turnStart", who: "enemies", radius: 3, do: { disSaves: true }, label: "Yesod Gone Dark — Soul and Resolve checks roll worse" }],
      desc: null
    },
    "Comes Through the Rock": {
      rules: [{ on: "zero", do: { prompt: "It does not fall — it comes apart into the nearest rock." } }],
      desc: "<p>The Tor-Wrath moves through earth, stone and rubble as if through open ground and can end its move inside it. When it drops to 0 Integrity it does not fall — it comes apart into the nearest rock.</p>"
    },
    "Tantrum (1/scene)": {
      rules: [{ on: "use", limit: { per: "scene", uses: 1 }, label: "Tantrum — a thrown plate down a 3-square line",
        do: { template: { shape: "line", size: 15 }, condition: { key: "prone", duration: "1-round", save: { attr: "body", dc: 12 } }, damage: { formula: "2d6", type: "kinetic" } } }],
      desc: null
    }
  };
  const WEAPONS = ["Ore-Fist", "Grief Undertow"];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  async function fix(actor, where) {
    const updates = [];
    for (const [name, w] of Object.entries(WANT)) {
      const it = actor.items.getName(name); if (!it) { report.changed.push(`${where}: MISSING ${name}`); continue; }
      const cur = it.flags?.fourththing?.npcAuto;
      const u = { _id: it.id };
      if (!cur || !same(cur.rules, w.rules)) { u["flags.fourththing.npcAuto"] = { v: 1, rules: w.rules }; report.changed.push(`${where}: ${name} rules`); }
      if (w.desc && String(it.system?.description?.value ?? "") !== w.desc) { u["system.description.value"] = w.desc; report.changed.push(`${where}: ${name} text`); }
      if (Object.keys(u).length > 1) updates.push(u);
    }
    for (const name of WEAPONS) {
      const it = actor.items.getName(name); if (!it) continue;
      if (it.flags?.fourththing?.npcAuto) { updates.push({ _id: it.id, "flags.fourththing.-=npcAuto": null }); report.changed.push(`${where}: ${name} bogus rule removed`); }
    }
    if (!DRY_RUN && updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  }

  const world = game.actors.get(ID);
  if (world) await fix(world, "world"); else report.changed.push("world actor not found");

  const pack = game.packs.get("bbttcc-master-content.npcs");
  const doc = pack ? await pack.getDocument(ID) : null;
  if (doc) {
    const wasLocked = pack.locked;
    if (!DRY_RUN && wasLocked) await pack.configure({ locked: false });
    try { await fix(doc, "pack"); } finally { if (!DRY_RUN && wasLocked) await pack.configure({ locked: true }); }
  } else report.changed.push("pack record not found");

  console.log("TORWRATH " + JSON.stringify(report));
  return report;
})();
