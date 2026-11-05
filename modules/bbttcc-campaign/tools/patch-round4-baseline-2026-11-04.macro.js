/**
 * patch-round4-baseline-2026-11-04.macro.js — ROUND 4 BASELINE (Dave 2026-11-04). World data for the play-through:
 *  - roster: Grengon (primary), The Errata Society, The Clowder, Coachella (Sweet Release off).
 *  - Errata Loyalty 25 and the matching next-turn band, like every other Domain ("Loyalty 1 is a mistake").
 *  - seats: Boaz Marrow unseated from Dave Test; Dave Test → Toran Rôl.
 *  - grief towns moved: Soft Landing → Odaroloc River.a, Stillwater → PolygonForest.c (arrival hooks, beat hexName, story where/hex).
 *  - starting hexes: The Clowder = BarrenPlains.c + BarrenPlains.d + Ynnermire.a; Coachella = Ynnermire.b + Odaroloc River.c + .b.
 *  - Grengon (campaign leader) takes Allesh-Gilliam, Khezek-Tor, Lyrenn; every held Whole Map hex at integration 6, occupied.
 *  - the two hexes swap names; the Flooded Town + its spark stay on the hex called Bedlam Barrens, next to BarrenPlains.d. Clowder's capital = BarrenPlains.c.
 *  - The Errata Society takes Sweet Release's Bedlam Fancies, Thirdword, Plains. CanYAWN Amirite.b goes unclaimed.
 *  - revealed hexes back to the original set (the "Dave Test Campaign Base Save" slot) + every hex a roster Domain holds.
 * Idempotent. DRY_RUN first (globalThis.__r4Dry = false applies). GM only.
 */
(async () => {
  const DRY_RUN = globalThis.__r4Dry !== false;
  const NS = "bbttcc-campaign", T = "bbttcc-territory", F = "bbttcc-factions";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const capi = game.bbttcc.api.campaign;
  const sc = game.scenes.getName("Bad Eden — The Whole Map"); if (!sc) throw new Error("no whole map");
  const uuidOf = (id) => `Scene.${sc.id}.Drawing.${id}`;
  const report = []; const note = (s) => report.push(s);
  // Name swap (Dave 2026-11-04): the Flooded Town's hex is Bedlam Barrens, Clowder's capital is BarrenPlains.c. Everything below uses the new names.
  const swapA = sc.drawings.get("NYq5qFCQ9OoKltoF"), swapB = sc.drawings.get("tv3NvclOoTbbQpSo");
  if (swapA?.flags?.[T]?.name === "Bedlam Barrens" && swapB?.flags?.[T]?.name === "BarrenPlains.c") {
    if (DRY_RUN) { console.log("[round4 baseline] DRY RUN — names not swapped yet; apply to swap and continue."); globalThis.__r4 = { dry: true, campChanges: null, report: ["names not swapped yet"] }; return; }
    await sc.updateEmbeddedDocuments("Drawing", [
      { _id: swapA.id, text: "BarrenPlains.c", [`flags.${T}.name`]: "BarrenPlains.c" },
      { _id: swapB.id, text: "Bedlam Barrens", [`flags.${T}.name`]: "Bedlam Barrens" }
    ]);
    note("names swapped");
  }
  const fac = (n) => { const a = game.actors.getName(n); if (!a) throw new Error(`no actor ${n}`); return a; };
  const hexNamed = (n) => { const d = sc.drawings.find(x => (x.flags?.[T]?.name || x.text) === n); if (!d) throw new Error(`no hex ${n}`); return d; };

  // ── campaign (roster, town hooks, beats, story) ──
  const raw = game.settings.get(NS, "campaigns"); const wasStr = typeof raw === "string";
  const camps = JSON.parse(wasStr ? raw : JSON.stringify(raw));
  const cid = capi.getActiveCampaignId(); const camp = camps[cid]; if (!camp) throw new Error("no active campaign");
  let campChanges = 0;
  const roster = ["Grengon", "The Errata Society", "The Clowder", "Coachella"].map(n => `Actor.${fac(n).id}`);
  if (JSON.stringify(camp.factionIds) !== JSON.stringify(roster)) { camp.factionIds = roster; campChanges++; note(`roster → ${roster.length}`); }
  const primary = `Actor.${fac("Grengon").id}`;
  if (String(camp.factionId).replace(/^Actor\./, "") !== fac("Grengon").id) { camp.factionId = primary; campChanges++; note("primary → Grengon"); }

  const TOWNS = [
    { beat: "soft_landing_arrival", from: "Ynnermire.b", to: "Odaroloc River.a" },
    { beat: "stillwater_arrival", from: "Odaroloc River.d", to: "PolygonForest.c" }
  ];
  camp.hexOverrides = camp.hexOverrides || {};
  for (const t of TOWNS) {
    for (const [k, v] of Object.entries(camp.hexOverrides)) {
      const ids = Array.isArray(v?.onEnterBeatIds) ? v.onEnterBeatIds : [];
      if (ids.includes(t.beat) && k !== uuidOf(hexNamed(t.to).id)) { delete camp.hexOverrides[k]; campChanges++; note(`hook off ${k.split(".").pop()} (${t.beat})`); }
    }
    const key = uuidOf(hexNamed(t.to).id);
    if (!camp.hexOverrides[key]?.onEnterBeatIds?.includes(t.beat)) { camp.hexOverrides[key] = { onEnterBeatIds: [t.beat] }; campChanges++; note(`hook on ${t.to} (${t.beat})`); }
    const swap = (o) => { const a = JSON.stringify(o); const b = a.split(`"${t.from}"`).join(`"${t.to}"`); return a === b ? null : JSON.parse(b); };
    const prefix = t.beat.split("_arrival")[0];
    camp.beats.forEach((b, i) => {
      if (!String(b.id).startsWith(prefix)) return;
      const n = swap(b); if (n) { camp.beats[i] = n; campChanges++; note(`beat ${b.id}: ${t.from} → ${t.to}`); }
    });
    const story = camp.story;
    if (story?.scripts?.[prefix]) { const n = swap(story.scripts[prefix]); if (n) { story.scripts[prefix] = n; campChanges++; note(`story script ${prefix} → ${t.to}`); } }
    for (const bag of [story?.quests, story?.model?.quests, story?.questModel]) {
      if (bag?.[prefix]) { const n = swap(bag[prefix]); if (n) { bag[prefix] = n; campChanges++; note(`story quest ${prefix} → ${t.to}`); } }
    }
  }
  const leftovers = TOWNS.map(t => [t.from, JSON.stringify(camp.story || {}).split(`"${t.from}"`).length - 1]);
  note(`story refs left: ${JSON.stringify(leftovers)}`);
  note(`beats naming spark_yesod_vestigial: ${camp.beats.filter(b => JSON.stringify(b).includes("spark_yesod_vestigial")).map(b => b.id).join(",") || "none"}`);

  // ── Domains + seats ──
  const errata = fac("The Errata Society");
  const errPatch = {};
  if (errata.getFlag(F, "loyalty") !== 25) errPatch[`flags.${F}.loyalty`] = 25;
  const bon = errata.getFlag(F, "bonuses")?.nextTurn || {};
  if (bon.opGainPct !== -10 || bon.defenseDC !== -1) { errPatch[`flags.${F}.bonuses.nextTurn.opGainPct`] = -10; errPatch[`flags.${F}.bonuses.nextTurn.defenseDC`] = -1; }
  note(`Errata: ${Object.keys(errPatch).length} field(s)`);
  const dave = game.users.getName("Dave Test"); const toran = fac("Toran Rôl"); const boaz = fac("Boaz Marrow");
  const seat = [];
  if (dave.character?.id !== toran.id) seat.push(["Dave Test → Toran Rôl", () => dave.update({ character: toran.id })]);
  if ((toran.ownership?.[dave.id] ?? 0) < 3) seat.push(["Toran owner: Dave Test", () => toran.update({ [`ownership.${dave.id}`]: 3 })]);
  if ((boaz.ownership?.[dave.id] ?? 0) > 0) seat.push(["Boaz: Dave Test ownership off", () => boaz.update({ [`ownership.${dave.id}`]: 0 })]);
  seat.forEach(([s]) => note(s));

  // ── starting hexes ──
  const STARTS = [
    { domain: "The Clowder", hexes: ["BarrenPlains.c", "BarrenPlains.d", "Ynnermire.a"] },
    { domain: "Coachella", hexes: ["Ynnermire.b", "Odaroloc River.c", "Odaroloc River.b"] }
  ];
  const assign = game.bbttcc.api.factions.assignStartingTerritory;
  const toClaim = [];
  for (const s of STARTS) {
    const a = fac(s.domain); const docs = s.hexes.map(hexNamed);
    const owners = docs.map(d => d.flags[T].factionId || d.flags[T].ownerId || "");
    if (owners.every(o => o === a.id)) { note(`${s.domain}: already holds its 3`); continue; }
    if (owners.some(o => o && o !== a.id)) throw new Error(`${s.domain}: a hex is held by someone else`);
    const args = { factionActor: a, baseHexUuid: docs[0].uuid, genHexUuid1: docs[1].uuid, genHexUuid2: docs[2].uuid, selectionKey: `round4:${a.id}` };
    const dry = await assign({ ...args, dryRun: true });
    note(`${s.domain}: ${dry.territoryPatches.map(p => `${p.name}=${p.type}/${p.integration.progress}${p.capital ? "*" : ""}`).join(", ")}`);
    toClaim.push({ a, docs, args });
  }

  // ── the leader's three + integration (Dave 2026-11-04: "The campaign leader gets those 3. And all owned hexes need to be set to 6") ──
  const leader = fac("Grengon");
  const hexUps = new Map();
  const up = (d, k, v) => { const m = hexUps.get(d.id) || { _id: d.id }; m[`flags.${T}.${k}`] = v; hexUps.set(d.id, m); };
  for (const n of ["Allesh-Gilliam", "Khezek-Tor", "Lyrenn"]) {
    const d = hexNamed(n), t = d.flags[T];
    if (t.factionId !== leader.id || t.ownerId !== leader.id || t.faction !== leader.name || t.ownerName !== leader.name) {
      up(d, "factionId", leader.id); up(d, "ownerId", leader.id); up(d, "faction", leader.name); up(d, "ownerName", leader.name);
    }
  }
  // Errata gets Sweet Release's three (Dave 2026-11-04).
  const errataOwner = fac("The Errata Society");
  for (const n of ["Bedlam Fancies", "Bedlam Thirdword", "Bedlam Plains"]) {
    const d = hexNamed(n), t = d.flags[T];
    if (t.factionId !== errataOwner.id || t.ownerId !== errataOwner.id || t.faction !== errataOwner.name || t.ownerName !== errataOwner.name) {
      up(d, "factionId", errataOwner.id); up(d, "ownerId", errataOwner.id); up(d, "faction", errataOwner.name); up(d, "ownerName", errataOwner.name);
    }
  }
  // CanYAWN Amirite.b belonged to Torvaal, who is gone (Dave 2026-11-04: unclaim it).
  const canyawn = hexNamed("CanYAWN Amirite.b");
  if (canyawn.flags[T].factionId || canyawn.flags[T].ownerId || canyawn.flags[T].status !== "unclaimed") {
    up(canyawn, "factionId", ""); up(canyawn, "ownerId", ""); up(canyawn, "faction", ""); up(canyawn, "ownerName", ""); up(canyawn, "status", "unclaimed"); up(canyawn, "capital", false);
  }
  // Whole Map hexes held by a Domain that still exists. A deleted Domain's hex is left for Dave to rule on.
  const toSix = [];
  for (const s of STARTS) for (const n of s.hexes) toSix.push(hexNamed(n));
  for (const d of sc.drawings) { const t = d.flags?.[T]; const o = t?.factionId || t?.ownerId; if (o && game.actors.get(String(o))) toSix.push(d); }
  for (const d of new Set(toSix)) {
    const t = d.flags[T];
    if (Number(t.integration?.progress) !== 6) up(d, "integration.progress", 6);
    if (Number(t.integrationProgress) !== 6) up(d, "integrationProgress", 6);
    if (t.status !== "occupied") up(d, "status", "occupied");
  }
  note(`hexes: ${hexUps.size} updated`);

  // ── the third Flooded Town moves (Dave 2026-11-04: BarrenPlains.c). The town keeps the name Bedlam Barrens in its text;
  // only the hex it points at changes. Its corrupted spark goes with it. ──
  const FLOOD = "hod_flooded_bedlam_barrens";
  const floodFrom = hexNamed("BarrenPlains.c"), floodTo = hexNamed("Bedlam Barrens");
  for (const [k, v] of Object.entries(camp.hexOverrides)) {
    if ((Array.isArray(v?.onEnterBeatIds) ? v.onEnterBeatIds : []).includes(FLOOD) && k !== uuidOf(floodTo.id)) { delete camp.hexOverrides[k]; campChanges++; note(`hook off ${k.split(".").pop()} (${FLOOD})`); }
  }
  if (!camp.hexOverrides[uuidOf(floodTo.id)]?.onEnterBeatIds?.includes(FLOOD)) { camp.hexOverrides[uuidOf(floodTo.id)] = { onEnterBeatIds: [FLOOD] }; campChanges++; note(`hook on Bedlam Barrens (${FLOOD})`); }
  const repoint = (o) => { const a0 = JSON.stringify(o); const b0 = a0.split('"hexName":"BarrenPlains.c"').join('"hexName":"Bedlam Barrens"').split('"where":"BarrenPlains.c"').join('"where":"Bedlam Barrens"'); return a0 === b0 ? null : JSON.parse(b0); };
  camp.beats.forEach((b, i) => { const n = repoint(b); if (n) { camp.beats[i] = n; campChanges++; note(`beat ${b.id} → Bedlam Barrens`); } });
  if (camp.story) { const n = repoint(camp.story); if (n) { camp.story = n; campChanges++; note("story where → Bedlam Barrens"); } }
  const floodSpark = floodFrom.flags[T].spark;
  if (floodSpark && floodTo.flags[T].spark) throw new Error("the Flooded Town hex already has a spark");
  note(`spark to move: ${floodSpark?.key || "none"}; on the Flooded Town hex: ${floodTo.flags[T].spark?.key || "none"}`);
  note(`"BarrenPlains.c" refs left in the campaign: ${JSON.stringify(camp).split("BarrenPlains.c").length - 1}`);

  // ── reveal baseline ──
  const list = await game.bbttcc.api.world.saves.list();
  const baseRow = list.find(x => x.label === "Dave Test Campaign Base Save"); if (!baseRow) throw new Error("no base save");
  const base = await game.bbttcc.api.world.saves.readSlot(baseRow.id);
  const bs = base.scenes.find(s => s._id === sc.id);
  const shown = new Set((bs.drawings || []).filter(d => d.flags?.[T] && !d.hidden).map(d => d._id));
  note(`original revealed: ${shown.size}`);
  const rosterIds = new Set(roster.map(r => r.replace(/^Actor\./, "")));
  for (const s of STARTS) for (const n of s.hexes) shown.add(hexNamed(n).id);
  for (const d of sc.drawings) { const t = d.flags?.[T]; if (t && rosterIds.has(String(t.factionId || t.ownerId || ""))) shown.add(d.id); }
  const hideUps = sc.drawings.filter(d => d.flags?.[T]).filter(d => !!d.hidden === shown.has(d.id)).map(d => ({ _id: d.id, hidden: !shown.has(d.id) }));
  note(`reveal: ${shown.size} shown, ${hideUps.length} drawing(s) change`);

  console.log(`[round4 baseline] ${DRY_RUN ? "DRY RUN" : "APPLY"} — campaign ${campChanges}\n` + report.join("\n"));
  globalThis.__r4 = { dry: DRY_RUN, campChanges, report };
  if (DRY_RUN) return;

  if (campChanges) await game.settings.set(NS, "campaigns", wasStr ? JSON.stringify(camps) : camps);
  const oldHook = hexNamed("Ynnermire.b");
  if (oldHook.flags[T].campaign?.onEnterBeatId === "soft_landing_arrival") await oldHook.update({ [`flags.${T}.campaign.onEnterBeatId`]: null });
  if (Object.keys(errPatch).length) await errata.update(errPatch);
  for (const [, fn] of seat) await fn();
  for (const c of toClaim) {
    await assign(c.args);
    // A starting hex begins clean: old play's loyalty scars don't come with it.
    const ups = c.docs.map(d => ({ _id: d.id, [`flags.${T}.mods.loyalty`]: 0 }));
    await sc.updateEmbeddedDocuments("Drawing", ups);
  }
  if (hideUps.length) await sc.updateEmbeddedDocuments("Drawing", hideUps);
  if (hexUps.size) await sc.updateEmbeddedDocuments("Drawing", [...hexUps.values()]);
  if (floodFrom.flags[T].campaign?.onEnterBeatId === FLOOD) await floodFrom.update({ [`flags.${T}.campaign.onEnterBeatId`]: null });
  if (floodSpark) {
    await floodTo.update({ [`flags.${T}.spark`]: floodSpark });
    await floodFrom.update({ [`flags.${T}.-=spark`]: null });
  }
  ui.notifications.info("Round 4 baseline applied.");
})();
