/*
 * patch-fixit-tour-into-hub-mystery-bin-2026-11-10.macro.js — Dave at Fixit (2026-11-10): "Head into town" (fixit_town_walk) did
 * nothing the hub menu didn't already do — an artifact from when Fixit opened from the first crossroads with every door shut.
 * "Let's do option 1" (fold the tour into the intro) + "make the Mystery Bin a one time roll on our consumables and items list and
 * provide a random useful item to each steward once."
 *   fixit_intro_scene (the town hub):
 *     • description: Pip's one-lap tour shows until the party has been through ANY town door (story span keyed on the doors —
 *       never on the hub's own id), then the hub's own line; the closing line stays on every visit.
 *     • "Head into town" (→ fixit_town_walk) is removed; "Browse the yard" (→ ans_fixit_town_walk_browse_the_yard) joins the menu.
 *   ans_fixit_town_walk_browse_the_yard: the bin is now a once-per-Steward roll — worldEffects.stewardLoot
 *     { key: "fixit_mystery_bin", Tier I looted/given gear·weapon·armor from Bad Eden: Items }; text follows; exit → back to the yard (∅).
 *   fixit_town_walk itself stays in the campaign, unreachable (deleting it is Dave's call).
 * Needs bbttcc-campaign world-mutation-engine.js with stewardLoot (2026-11-09). Ember Bad Eden.
 * globalThis.__fixitTourDry = false applies; anything else is a dry run. Idempotent.
 */
(async () => {
  const DRY_RUN = globalThis.__fixitTourDry !== false;
  const report = { DRY_RUN, changed: [] };
  const C = game.bbttcc.api.campaign, cid = C.getActiveCampaignId(), c = C.getCampaign(cid);
  const beats = foundry.utils.deepClone(c.beats);
  const hub = beats.find(b => b.id === "fixit_intro_scene"), bin = beats.find(b => b.id === "ans_fixit_town_walk_browse_the_yard");
  if (!hub || !bin) throw new Error("fixit_intro_scene / browse answer not found");

  const DOORS = "fixit_saloon_cinematic|fixit_arc_bay_exterior|fixit_general_store_exterior|fixit_power_station_exterior|ans_fixit_town_walk_browse_the_yard";
  const TOUR = "Up close, the corpse that refused to lie down turns out to be extremely alive: generators humming, chimes clattering their endless key-and-casing argument, and a hand-painted OPEN sign with three exclamation points — one of which was clearly added later, in different paint. Somebody here believes in customer service. Somebody else here fixed the first somebody's spelling. (It used to say OPNE.)\n\nA Jackalope kid — Pip, or possibly Patter — materializes at your elbow, walks you exactly one lap of the yard, points out the Gullywasher (\"bar\"), the Counter (\"closed till Mara says\"), Arc Bay (\"LOUD later\"), and the Generator hall (\"escort only, it's not personal\"), accepts no questions, and vanishes on the half-hop. Best first-day tour you've ever had, honestly.";
  const BACK = "The yard, from the middle of it: generators, chimes, the OPEN!!! sign.";
  const CLOSE = "Everything here is for sale, for some values of sale, and everybody here is deciding what you are.";
  const hubDesc = `{{#played ${DOORS}}}${BACK}{{else}}${TOUR}{{/played}}\n\n${CLOSE}`;
  if (hub.description !== hubDesc) { hub.description = hubDesc; report.changed.push("hub: tour folded in (first visit, until any door)"); }

  const n0 = hub.choices.length;
  hub.choices = hub.choices.filter(ch => ch.next !== "fixit_town_walk");
  if (hub.choices.length !== n0) report.changed.push("hub: 'Head into town' removed");
  if (!hub.choices.some(ch => ch.next === bin.id)) {
    const at = Math.max(0, hub.choices.findIndex(ch => ch.next === "fixit_general_store_exterior"));
    hub.choices.splice(at, 0, { label: "Browse the yard — the MYSTERY bin", next: bin.id, description: "", checkStat: "", checkDC: 0, failNext: "" });
    report.changed.push("hub: 'Browse the yard — the MYSTERY bin' added");
  }

  const BIN_TEXT = "Rig parts, salvage sorted with terrifying precision, and a bin labeled MYSTERY (AS IS, NO REFUNDS, STOP ASKING). Nobody is minding it. Each of you reaches in exactly once and comes up with something. The mystery is free. That's the part that should worry you.";
  if (bin.description !== BIN_TEXT) { bin.description = BIN_TEXT; report.changed.push("bin: text"); }
  bin.worldEffects = bin.worldEffects || {};
  const want = { key: "fixit_mystery_bin", pack: "bbttcc-master-content.items", tiers: ["I"], types: ["gear", "weapon", "armor"], origins: ["looted", "given"], title: "The Mystery Bin", icon: "📦" };
  if (JSON.stringify(bin.worldEffects.stewardLoot) !== JSON.stringify(want)) { bin.worldEffects.stewardLoot = want; report.changed.push("bin: stewardLoot once per Steward"); }
  for (const ch of bin.choices || []) if (ch.next === "fixit_town_walk") { ch.next = ""; ch.label = "Back to the yard"; report.changed.push("bin: exit → back to the yard"); }

  if (!DRY_RUN && report.changed.length) await C.saveCampaign(cid, { ...c, beats });
  console.log("FIXITTOUR " + JSON.stringify(report));
  return report;
})();
