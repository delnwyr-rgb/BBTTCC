/* npc-pack-pass3-rulings.macro.js — NPC Pack v1 full pass, PASS 3a: the owner's rulings of 2026-10-06 (rounds 4–5).
 * Paste into a GM macro on EMBER (world: roll-for-initiation-bad-eden). DRY_RUN = true prints the plan, writes nothing.
 * Works on BOTH the live WORLD actors and the compendium bbttcc-master-content.npcs (same ids): world beats bind speakers
 * by actor id and seeders look actors up by world name, so a pack-only fix never reaches play. Backs up the campaigns
 * setting to a download before writing. Every step is idempotent (re-run safe) and name-checked.
 *
 *  1 GILBERT   boss LQS2… becomes "Gilbert, Attendant Eternal" (old name → rfi title); persona/About/token art copied from
 *              the Quest NPC shell; 7 world beats repointed to the boss; shell deleted.
 *  2 MAÎTRE-D' the kind talker keeps its persona; the Wendigo block's stats/defenses/art/loot + its 3 weapons come over as an
 *              "(if provoked)" kit; NO lineage (stays an npc, not a chassis'd monster); level 8 / T II (Forgotten Cause = Act 2).
 *  3 TIFARET   "The Tree Person of Early Tifaret" absorbs the Aggressive Tiferet Tree Person block (ally: friendly
 *              disposition); Sapling Kiddo + the Aggressive block deleted; npcPlacements[12] → the Forest (talker).
 *  4 MACCIO    Human/Cro-Magnon → Oldenborn + Stormborn Nomad heritage + Weatherwise; concept "…Warlord of the Drowned South".
 *  5 TAMSIN    Pactkeeper kit removed (Jurisdiction feat LEFT — ask Dave).
 *  6 RELIABLE  "Hovercraft Frame" minted in the items pack (Rig & Boss Catalog) and swapped onto the rig; archetype/domains.
 *  7 RENAMES   Marr · Sable Nine · Doc Vess Greeley · Captain Ondine Brakk · Dougan Marsh · Rowan of the Loam (+ Khezek Tor
 *              echo stewardName; @knownBy "Dougan" journal pages → "Dougan Marsh").
 *  8 DUPES     27 onboarding leftovers + Doorperson (Copy) deleted; kept Bit/Coll lose the onboarding "spawned" flag.
 *  9 FILING    8 moves by folder NAME; The Swamp Bandits folder → under Evil Bad Faction; Maccio/Perch/Sal linked to the
 *              Evil Bad Faction actor, Gasket to Allesh Gilliam.
 * 10 TABLES    travel-table entries gated to the act→tier ladder (Apex Predator / wildlife T3 → Act 3; wildlife T2 + bandit
 *              ambush → Act 2; Shambler + Slippage Wraith → Act 3). Tier LABELS live in api.encounters.js (repo edit).
 * 11 CACA      Lisa Frank Elemental → "CACA" (title "Cute Aggressive Cover Art (Saturated)"); Miliard's bio: Lumenwrought.
 */
const DRY_RUN = false;
const PACK_ID = "bbttcc-master-content.npcs", ITEMS_PACK = "bbttcc-master-content.items", ANC_PACK = "bbttcc-master-content.ancestries";
const NS = "bbttcc-campaign", CAMPAIGN = "l4PTkyhdfGBQXkOj", MAL = "bbttcc-mal-voice";
const ID = {
  gilbertBoss: "LQS2jaeFhzFMDpxA", gilbertShell: "oMKGnPtJsxhhtSpA",
  maitre: "q0pGaJeez8R4HdJl", wendigo: "VWt7r4vT7Ib4Nvl4",
  forest: "7a8md0qYxWVBJrrF", treePerson: "Wlk2fVGEGJKgROfD", aggressiveTree: "uvCBk61En2HZxT4G", sapling: "QrAAauqWw9Z7Kqyc",
  maccio: "3EWTXjRqh06dmD0x", tamsin: "I0Gieq4FAol5mklQ", reliable: "kQl5Nvi32YMUMdfj", lisa: "a9orjOV99MnMObho", miliard: null,
  khezekFaction: "7Z8QNm4VGo6JRJG2", evilBadFaction: "oK7VitQikQ6FN3PI", agFaction: "91Kwu7Vgf11vqxuj",
  perch: "lTao7uqiu0bZ2e8A", gasket: "uUosWdYvj5Sr2dVa", salTench: "QaybKsCohJBxYJZ1", doorCopy: "XpzXIf5owrtfPUmJ",
  bitKeep: "OY7jUQ3KJCZX80bC", collKeep: "8xZwcNcS5iKFHdlP",
};
const DELETE_DUPES = {
  "Hollow Thing": ["5GUcVKqkFnBIDOjr","AHAZcGOpumJ1rmlF","Ew8RaxXiunfC5hDu","Fqph8XCoYOPYCsPD","GwqrwrnInEkuJmQU","PBoxjE7LfSDZqOy9","cH7Pg7fMDpB4Plj4","hCzgG42uMx2pB9IY","lgINqZc8TsFM27Gd","wAt8iozojHcAlRLz","ycUXkvW1eLzR75f1","ylzwBNqTuzV4Ai0y"],
  "Straw Adversary": ["6Prun11TvQbaKp8G","6ypng1CRWyPgysPS","AIZddXh5M5hGUKPx","HrXnRS6WDCfZeVSn","VUdGaTFQFXusfJdT","WkC0CwI4uvyswpzS","mLDyJWg93cjWhmvD","oUcLZ5ggJ0TguUaz","wwfyWxstzMbT5XRJ"],
  "Gantry Hollow": ["4bn5HIPs5uNeJzvv","Ce8nB3Y0As9frvnF","EeTvPGeV9Ve3azhf","OVFOtosTNevpSmY3","Y2NTRgeJARChW2ni","eGB3PshTTfB2O2PK"],
  "Scavenger — Bit": ["Pwvf9JlVILONuuF1","mVeSeZFAAcgqaK5d","oZDZA5rDOFbOnT3j"],
  "Scavenger — Coll": [],   // filled at runtime: every Coll except the keeper
  "Evil Bad Doorperson (Copy)": ["XpzXIf5owrtfPUmJ"],
};
const RENAMES = [
  ["rTYujrg6B9bL5eGl", "Maestra Velvetine Mar", "Maestra Velvetine Marr"],
  ["oogAKHHlUKI2AnO9", "Sable 9", "Sable Nine"],
  ["DSppSI2lCnin4Y1O", "\"Doc\"Vess Greeley", "Doc Vess Greeley"],
  ["AV36WowwN3iR4txH", "Ondine Brakk", "Captain Ondine Brakk"],
  ["7Lee6ROPnc4gWYJh", "Dougan", "Dougan Marsh"],
  ["4kWF2skvyviuaWX8", "Rowan-of-the-Loam", "Rowan of the Loam"],
];
const MOVES = [   // [actorId, name, target folder path (names)]
  [ID.gasket, "Gasket", ["Bad Eden NPCs", "Allesh Gilliam"]],
  ["SsCdl227pes1SJHi", "Bez", ["Bad Eden NPCs", "Khezek Tor"]],
  ["52BxwtefAZTHQlsU", "Wren Ashby", ["Bad Eden NPCs", "Lyrenn"]],
  ["KZ0qjHnY1JHIhExn", "Dilly Marsh", ["Bad Eden NPCs", "The 15 Year Siege"]],
  [ID.salTench, "Sal Tench", ["Bad Eden NPCs", "The Swamp Bandits"]],
  ["ikI7ZIC0Doyke0aY", "Harbourmaster Dot Pellew", ["Bad Eden NPCs", "Furrier's Fixit Farm", "Port Kudzu"]],
  ["oK6BVjLAWntCWxtp", "Donny", ["Bad Eden NPCs", "Tanneritos"]],
  ["48Xvd7KRGNvrbmfZ", "Miss June", ["Bad Eden NPCs", "Tanneritos"]],
];
const TABLE_GATES = { enc_apex_predator: 3, enc_mutant_wildlife_t3: 3, enc_mutant_wildlife_t2: 2, enc_bandit_ambush: 2, enc_qlipothic_shambler: 3, enc_slippage_wraith: 3 };
const HOVERCRAFT_FRAME = { bracket: "medium", baseIntegrity: 32, tierStep: 10, mobilityAllowed: ["mobile"], slots: { weapon: 2, system: 2, output: 3 },
  capacity: { pilot: [1, 1], gunner: [0, 1], engineer: [0, 1], crew: [0, 6] },
  actions: { pilot: ["steer", "skim", "lift-skirt", "evasive"], gunner: ["fire-weapon", "suppression", "reload"], engineer: ["repair", "boost-system", "vent-heat"], crew: ["operate-module", "brace", "signal", "hold-on"] },
  travel: { speed: 4, range: 16 }, visualFrame: "anchor-ring" };

(async () => {
  if (!game.user.isGM) return ui.notifications.error("GM only.");
  const pack = game.packs.get(PACK_ID), itemsPack = game.packs.get(ITEMS_PACK), ancPack = game.packs.get(ANC_PACK);
  if (!pack || !itemsPack || !ancPack) return ui.notifications.error("A compendium is missing — are the master-content packs loaded?");
  const log = []; let changes = 0, skipped = 0;
  const say = s => log.push(s), tick = s => { say(`${DRY_RUN ? "·" : "✔"} ${s}`); changes++; }, skip = s => { say(`✗ ${s}`); skipped++; };
  const dc = foundry.utils.deepClone, getP = foundry.utils.getProperty;
  const unlocked = [];
  const unlock = async p => { if (!DRY_RUN && p.locked && !unlocked.includes(p)) { await p.configure({ locked: false }); unlocked.push(p); } };
  const W = id => game.actors.get(id) ?? null;                                     // world
  const P = async id => (await pack.getDocument(id).catch(() => null)) ?? null;   // pack
  const both = async id => [["world", W(id)], ["pack", await P(id)]].filter(([, a]) => a);
  const upd = async (ctx, a, data, label) => { if (!a) return; tick(`[${ctx}] ${label}`); if (!DRY_RUN) { if (ctx === "pack") await unlock(pack); await a.update(data); } };
  const del = async (ctx, a, label) => { if (!a) return; tick(`[${ctx}] DELETE ${a.name} — ${label}`); if (!DRY_RUN) { if (ctx === "pack") await unlock(pack); await a.delete(); } };
  const addItems = async (ctx, a, items, label) => { if (!a || !items.length) return; tick(`[${ctx}] ${a.name}: +${items.length} item(s) — ${label}`); if (!DRY_RUN) { if (ctx === "pack") await unlock(pack); await a.createEmbeddedDocuments("Item", items); } };
  const delItems = async (ctx, a, ids, label) => { ids = ids.filter(i => a?.items.get(i)); if (!a || !ids.length) return; tick(`[${ctx}] ${a.name}: −${ids.length} item(s) — ${label}`); if (!DRY_RUN) { if (ctx === "pack") await unlock(pack); await a.deleteEmbeddedDocuments("Item", ids); } };
  const nameIs = (a, n) => a && a.name === n;
  const folderByPath = (ctx, path) => {
    const coll = ctx === "world" ? game.folders.filter(f => f.type === "Actor") : Array.from(pack.folders);
    let parent = null, f = null;
    for (const name of path) { f = coll.find(x => x.name === name && (x.folder?.id ?? null) === (parent?.id ?? null)) ?? null; if (!f) break; parent = f; }
    // the WORLD's folder tree differs from the pack's — fall back to any Actor folder carrying the leaf name
    return f ?? (ctx === "world" ? (coll.find(x => x.name === path[path.length - 1]) ?? null) : null);
  };

  // ── campaigns setting (beats + placements + travel tables) ────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns"); const campsWasStr = typeof campsRaw === "string";
  const camps = campsWasStr ? JSON.parse(campsRaw) : dc(campsRaw);
  const camp = Array.isArray(camps) ? camps.find(c => c.id === CAMPAIGN) : camps?.[CAMPAIGN];
  if (!camp) say(`✗ campaign ${CAMPAIGN} not found in ${NS}.campaigns — beat/placement steps skipped`);
  let campChanged = false;
  let tablesRaw = game.settings.get(NS, "encounterTables"); const tablesWasStr = typeof tablesRaw === "string";
  const tables = tablesWasStr ? JSON.parse(tablesRaw) : dc(tablesRaw); let tablesChanged = false;

  // 1 ── GILBERT ───────────────────────────────────────────────────────────────────────────────────────────
  say("── 1 Gilbert");
  {   // the Bestiary boss lives in the PACK only — the 7 world beats need a WORLD actor with that id
    const packBoss = await P(ID.gilbertBoss), wShell = W(ID.gilbertShell);
    if (!W(ID.gilbertBoss) && packBoss) {
      tick(`[world] IMPORT Gilbert boss from the pack (same id ${ID.gilbertBoss}, folder ${wShell?.folder?.name ?? "root"}) so the beats keep a speaker`);
      if (!DRY_RUN) { const o = packBoss.toObject(); o.folder = wShell?.folder?.id ?? null; o.ownership = wShell?.ownership ?? o.ownership; await Actor.create(o, { keepId: true }); }
    }
  }
  for (const [ctx, boss] of await both(ID.gilbertBoss)) {
    const shell = ctx === "world" ? W(ID.gilbertShell) : await P(ID.gilbertShell);
    if (!boss.name.startsWith("Gilbert")) { skip(`[${ctx}] boss ${ID.gilbertBoss} is "${boss.name}" — expected Gilbert`); continue; }
    const data = {};
    if (boss.name !== "Gilbert, Attendant Eternal") {
      data.name = "Gilbert, Attendant Eternal"; data["prototypeToken.name"] = "Gilbert, Attendant Eternal";
      data["flags.fourththing.rfi.actor.title"] = "Eternally Cleaning Not Leaning Theater Attendant";
    }
    if (shell) {
      const persona = shell.flags?.[MAL]?.persona; if (persona && !boss.flags?.[MAL]?.persona?.notes) data[`flags.${MAL}.persona`] = dc(persona);
      const bio = shell.system?.biography; if (bio?.concept && !boss.system?.biography?.concept) { data["system.biography.concept"] = bio.concept; data["system.biography.notes"] = bio.notes ?? ""; }
      if (shell.prototypeToken?.texture?.src && /gilbert_token/.test(shell.prototypeToken.texture.src)) data["prototypeToken.texture.src"] = shell.prototypeToken.texture.src;
    }
    if (Object.keys(data).length) await upd(ctx, boss, data, `Gilbert boss → "Gilbert, Attendant Eternal" (+persona/About/token from the shell)`); else say(`· ok [${ctx}] Gilbert already merged`);
  }
  if (camp) {   // repoint every beat that speaks as the shell, then the shell can go
    let n = 0; for (const b of camp.beats ?? []) if (b.speakerActorId === ID.gilbertShell) { b.speakerActorId = ID.gilbertBoss; n++; }
    if (n) { tick(`[world] ${n} beat(s) speaker ${ID.gilbertShell} → ${ID.gilbertBoss}`); campChanged = true; }
    for (const [ctx, shell] of await both(ID.gilbertShell)) if (nameIs(shell, "Gilbert, Attendant Eternal") || /^Gilbert/.test(shell.name)) await del(ctx, shell, "Quest NPC shell merged into the boss");
  } else for (const [ctx, shell] of await both(ID.gilbertShell)) if (ctx === "pack") await del(ctx, shell, "Quest NPC shell merged into the boss (pack)");

  // 2 ── MAÎTRE-D' ─────────────────────────────────────────────────────────────────────────────────────────
  say("── 2 Maître-D'");
  for (const [ctx, talker] of await both(ID.maitre)) {
    const wLocal = ctx === "world" ? W(ID.wendigo) : null, wendigo = wLocal ?? await P(ID.wendigo);
    if (!nameIs(talker, "The Maître-D'")) { skip(`[${ctx}] ${ID.maitre} is "${talker.name}"`); continue; }
    if (!wendigo) { say(`· [${ctx}] no Wendigo Maître-D' left — assuming merged`); continue; }
    if (talker.items.find(t => /\(if provoked\)$/.test(t.name))) { say(`· ok [${ctx}] Maître-D' already carries the if-provoked kit`); if (wLocal) await del(ctx, wLocal, "Wendigo statblock already merged"); continue; }
    const ws = wendigo.system, data = {
      "system.attributes": dc(ws.attributes), "system.details.level": 8, "system.details.tier": 2,
      "system.defenses": dc(ws.defenses), "system.conditionImmunities": dc(ws.conditionImmunities ?? []),
      "flags.fourththing.rfi.actor.bestiary": dc(wendigo.flags?.fourththing?.rfi?.actor?.bestiary ?? {}),
      "flags.fourththing.rfi.actor.price": dc(wendigo.flags?.fourththing?.rfi?.actor?.price ?? {}),
      "flags.fourththing.rfi.actor.title": "The politest monster in the world (if provoked)",
      "flags.fourththing.creatureType": wendigo.flags?.fourththing?.creatureType ?? "fiend",
    };
    if (/mystery-man/.test(talker.img || "")) { data.img = wendigo.img; data["prototypeToken.texture.src"] = wendigo.prototypeToken?.texture?.src ?? wendigo.img; }
    await upd(ctx, talker, data, "Maître-D' takes the Wendigo's stats/defenses/art/loot (L8 · T II, NO lineage — stays an npc)");
    const kit = wendigo.items.filter(i => i.type === "weapon" && !talker.items.find(t => t.name.startsWith(i.name))).map(i => {
      const o = i.toObject(); delete o._id; o.name = `${i.name} (if provoked)`;
      const d = o.system?.description?.value ?? ""; o.system.description = { ...(o.system.description ?? {}), value: `<p><em>Only if the table is refused or violence is offered.</em></p>${d}` };
      return o;
    });
    await addItems(ctx, talker, kit, "Wendigo weapons as the (if provoked) kit");
    if (ctx === "pack" || wLocal) await del(ctx, wendigo, "Wendigo Maître-D' statblock merged into the talker (0 world refs)");
  }

  // 3 ── TIFARET ───────────────────────────────────────────────────────────────────────────────────────────
  say("── 3 Tifaret");
  for (const [ctx, tree] of await both(ID.treePerson)) {
    const aggLocal = ctx === "world" ? W(ID.aggressiveTree) : null, agg = aggLocal ?? await P(ID.aggressiveTree), sap = ctx === "world" ? W(ID.sapling) : await P(ID.sapling);
    if (!nameIs(tree, "The Tree Person of Early Tifaret")) { skip(`[${ctx}] ${ID.treePerson} is "${tree.name}"`); continue; }
    if (agg && tree.items.find(t => t.name === "Root-Limb Slam" || t.name === "Slam")) { say(`· ok [${ctx}] Tree Person already carries the combatant kit`); if (aggLocal) await del(ctx, aggLocal, "already merged"); }
    else if (agg) {
      const as = agg.system, data = {
        "system.attributes": dc(as.attributes), "system.details.level": as.details?.level ?? 13, "system.details.tier": as.details?.tier ?? 3,
        "system.defenses": dc(as.defenses), "system.conditionImmunities": dc(as.conditionImmunities ?? []), "system.role": as.role ?? "hardened",
        "flags.fourththing.rfi.actor": dc(agg.flags?.fourththing?.rfi?.actor ?? {}), "flags.fourththing.creatureType": agg.flags?.fourththing?.creatureType ?? "elemental",
        "prototypeToken.disposition": 1,
      };
      if (/mystery-man/.test(tree.img || "") || !tree.img) { data.img = agg.img; data["prototypeToken.texture.src"] = agg.prototypeToken?.texture?.src ?? agg.img; }
      await upd(ctx, tree, data, "Tree Person absorbs the Aggressive block (ally — FRIENDLY disposition, T III)");
      const items = agg.items.filter(i => !tree.items.find(t => t.name === i.name)).map(i => {
        const o = i.toObject(); delete o._id;
        for (const k of ["name"]) o[k] = String(o[k]).replace(/Early Tiferet/g, "Early Tifaret");
        if (o.system?.description?.value) o.system.description.value = o.system.description.value.replace(/Early Tiferet/g, "Early Tifaret");
        return o;
      });
      await addItems(ctx, tree, items, "the combatant's kit");
      if (ctx === "pack" || aggLocal) await del(ctx, agg, "merged into The Tree Person of Early Tifaret");
    }
    if (sap) await del(ctx, sap, "Aggressive Sapling Kiddo — lesser copy of the same block");
  }
  if (camp) {
    const pl = (camp.npcPlacements ?? []).filter(p => p.actorId === ID.sapling);
    for (const p of pl) { p.actorId = ID.forest; campChanged = true; }
    if (pl.length) tick(`[world] ${pl.length} npcPlacement(s) Sapling → The Forest of Early Tifaret (the talker)`);
  }

  // 4 ── MACCIO ────────────────────────────────────────────────────────────────────────────────────────────
  say("── 4 Lady Ralph Maccio");
  {
    const species = await ancPack.getDocument("7709222f8ff32964").catch(() => null), heritage = await ancPack.getDocument("nKHhfdL3U98tJj6r").catch(() => null), t1 = await ancPack.getDocument("4k4E7fkJnZ76JACZ").catch(() => null);
    if (!species || !heritage || !t1) skip("ancestries pack lacks Oldenborn / Stormborn Nomad / Weatherwise — Maccio untouched");
    else for (const [ctx, a] of await both(ID.maccio)) {
      if (!nameIs(a, "Lady Ralph Maccio")) { skip(`[${ctx}] ${ID.maccio} is "${a.name}"`); continue; }
      await delItems(ctx, a, ["7VUmw1sZJyPaFW6C", "8o4ahKoCzKHE4umk", "60AgcypByAmGzsWp"], "Human / Stubborn Spark / Cro-Magnon");
      const add = [species, heritage, t1].filter(d => !a.items.find(i => i.name === d.name)).map(d => { const o = d.toObject(); delete o._id; o._stats = { ...(o._stats ?? {}), compendiumSource: d.uuid }; return o; });
      await addItems(ctx, a, add, "Oldenborn + Stormborn Nomad heritage + Weatherwise (T1)");
      const concept = a.system?.biography?.concept ?? "";
      await upd(ctx, a, {
        "flags.bbttcc-character-options.heritageUuid": heritage.uuid, "flags.bbttcc-character-options.nativeLinks.heritageUuid": heritage.uuid,
        "flags.bbttcc-character-options.nativeLinks.heritageName": heritage.name, "flags.bbttcc-character-options.nativeLinks.ancestryName": species.name,
        "flags.bbttcc-character-options.nativeLinks.speciesUuid": species.uuid,
        ...(concept.includes("Warlord") ? {} : { "system.biography.concept": "Lady Ralph Maccio, Warlord of the Drowned South — keeps the books at the stilt-hall (Act 2)" }),
      }, "ancestry links → Stormborn Nomad; concept → Warlord of the Drowned South");
    }
  }

  // 5 ── FATHER TAMSIN ─────────────────────────────────────────────────────────────────────────────────────
  say("── 5 Father Tamsin");
  for (const [ctx, a] of await both(ID.tamsin)) {
    if (!nameIs(a, "Father Tamsin")) { skip(`[${ctx}] ${ID.tamsin} is "${a.name}"`); continue; }
    await delItems(ctx, a, ["6PsHU6zkTEYp0dtw", "KhWkoAUIwmSEYef6", "P7Nnqy6ud4cMMQfJ", "FHP1R9gp6FNCDUGs", "SlxRZfVlFRROcQUK"], "Pactkeeper kit (his ending, not his start) — Jurisdiction feat kept pending Dave");
  }

  // 6 ── THE ABSOLUTELY RELIABLE ───────────────────────────────────────────────────────────────────────────
  say("── 6 The Absolutely Reliable");
  {
    let frameDoc = (await itemsPack.getDocuments({ name: "Hovercraft Frame" }).catch(() => []))[0] ?? null;
    const sail = (await itemsPack.getDocuments({ name: "Sail Barge Frame" }).catch(() => []))[0] ?? null;
    if (!frameDoc && sail) {
      const o = sail.toObject(); delete o._id; o.name = "Hovercraft Frame"; o.flags.fourththing.rigFrame = dc(HOVERCRAFT_FRAME);
      o.system.description = { ...(o.system.description ?? {}), value: "<p>A skirted lift-fan hull that rides a cushion of air over mud, reed, water and road alike. Fast, loud, and allergic to sharp rocks.</p>" };
      tick(`[items pack] mint "Hovercraft Frame" in ${sail.folder?.name ?? "Rig & Boss Catalog"}`);
      if (!DRY_RUN) { await unlock(itemsPack); frameDoc = (await itemsPack.importDocument ? null : null) ?? await Item.create(o, { pack: ITEMS_PACK }); }
    } else if (!sail && !frameDoc) skip("items pack has no Sail Barge Frame to template from");
    for (const [ctx, rig] of await both(ID.reliable)) {
      if (!/Absolutely Reliable/.test(rig.name)) { skip(`[${ctx}] ${ID.reliable} is "${rig.name}"`); continue; }
      const old = rig.items.find(i => i.flags?.fourththing?.rigGear?.subtype === "rig-frame");
      if (old?.name === "Hovercraft Frame") { say(`· ok [${ctx}] rig already on a Hovercraft Frame`); continue; }
      const o = (frameDoc ?? sail)?.toObject(); if (!o) continue; delete o._id; o.name = "Hovercraft Frame"; o.flags.fourththing.rigFrame = dc(HOVERCRAFT_FRAME);
      if (old) await delItems(ctx, rig, [old.id], `old ${old.name}`);
      await addItems(ctx, rig, [o], "Hovercraft Frame");
      await upd(ctx, rig, { "system.identity.archetype": "Hovercraft", "system.tags": ["hovercraft", "amphibious", "transport", "water-surface", "land"], "system.travel.domains": ["land", "water-surface"], "system.travel.speed": 4, "system.travel.range": 16 }, "archetype Hovercraft · domains land + water-surface");
    }
  }

  // 7 ── RENAMES ───────────────────────────────────────────────────────────────────────────────────────────
  say("── 7 Spelling renames");
  for (const [id, oldName, newName] of RENAMES) for (const [ctx, a] of await both(id)) {
    if (a.name === newName) { say(`· ok [${ctx}] ${newName}`); continue; }
    if (a.name !== oldName) { skip(`[${ctx}] ${id} is "${a.name}" (expected "${oldName}")`); continue; }
    await upd(ctx, a, { name: newName, "prototypeToken.name": newName }, `${oldName} → ${newName}`);
  }
  for (const [ctx, kt] of await both(ID.khezekFaction)) if (kt.flags?.fourththing?.echoAssets?.stewardName === "Sable 9") await upd(ctx, kt, { "flags.fourththing.echoAssets.stewardName": "Sable Nine" }, "Khezek Tor echo stewardName → Sable Nine");
  for (const j of game.journal) for (const pg of j.pages) {
    const txt = pg.text?.content ?? ""; if (!/@knownBy:\s*Dougan\s*$/m.test(txt)) continue;
    tick(`[world] journal "${j.name}" › "${pg.name}": @knownBy Dougan → Dougan Marsh`);
    if (!DRY_RUN) await pg.update({ "text.content": txt.replace(/(@knownBy:\s*)Dougan(\s*)$/m, "$1Dougan Marsh$2") });
  }

  // 8 ── DUPLICATES ────────────────────────────────────────────────────────────────────────────────────────
  say("── 8 Duplicates");
  for (const ctx of ["world", "pack"]) {
    const all = ctx === "world" ? game.actors.contents : await pack.getDocuments();
    DELETE_DUPES["Scavenger — Coll"] = all.filter(a => a.name === "Scavenger — Coll" && a.id !== ID.collKeep).map(a => a.id);
    for (const [name, ids] of Object.entries(DELETE_DUPES)) for (const id of ids) {
      const a = all.find(x => x.id === id); if (!a) continue;
      if (a.name !== name) { skip(`[${ctx}] ${id} is "${a.name}" (expected "${name}")`); continue; }
      await del(ctx, a, name === "Evil Bad Doorperson (Copy)" ? "byte-identical copy" : "onboarding spawn leftover (flag spawned=true)");
    }
    for (const id of [ID.bitKeep, ID.collKeep]) { const a = all.find(x => x.id === id); if (a?.flags?.["bbttcc-onboarding"]?.spawned) await upd(ctx, a, { "flags.bbttcc-onboarding.-=spawned": null, "flags.bbttcc-onboarding.-=ownerUserId": null, "flags.bbttcc-onboarding.-=kind": null }, `${a.name}: drop the onboarding spawn flag (teardown would delete the recurring character)`); }
  }

  // 9 ── FILING + EVIL BAD FACTION ─────────────────────────────────────────────────────────────────────────
  say("── 9 Filing");
  for (const ctx of ["world", "pack"]) {
    for (const [id, name, path] of MOVES) {
      const a = ctx === "world" ? W(id) : await P(id); if (!a) continue;
      if (a.name !== name) { skip(`[${ctx}] ${id} is "${a.name}" (expected "${name}")`); continue; }
      const f = folderByPath(ctx, path); if (!f) { say(`· [${ctx}] no folder "${path.at(-1)}" — ${name} stays where it is (filing only)`); continue; }
      if (a.folder?.id === f.id) { say(`· ok [${ctx}] ${name} in ${path.at(-1)}`); continue; }
      await upd(ctx, a, { folder: f.id }, `${name} → ${path.join("/")}`);
    }
    const swamp = folderByPath(ctx, ["Bad Eden NPCs", "The Swamp Bandits"]), ebf = folderByPath(ctx, ["Bad Eden NPCs", "Evil Bad Faction"]);
    if (swamp && ebf && swamp.folder?.id !== ebf.id) { tick(`[${ctx}] folder The Swamp Bandits → under Evil Bad Faction`); if (!DRY_RUN) { if (ctx === "pack") await unlock(pack); await swamp.update({ folder: ebf.id }); } }
    const link = async (id, factionId, factionName) => { const a = ctx === "world" ? W(id) : await P(id); if (!a || a.flags?.["bbttcc-factions"]?.factionId === factionId) return;
      await upd(ctx, a, { "flags.bbttcc-factions.factionId": factionId, "system.faction": { id: factionId, loyalty: Number(a.system?.faction?.loyalty) || 0, name: factionName } }, `${a.name} → faction ${factionName}`); };
    await link(ID.maccio, ID.evilBadFaction, "Evil Bad Faction"); await link(ID.perch, ID.evilBadFaction, "Evil Bad Faction"); await link(ID.salTench, ID.evilBadFaction, "Evil Bad Faction"); await link(ID.gasket, ID.agFaction, "Allesh Gilliam");
  }

  // 10 ── TRAVEL TABLES: the act→tier ladder ────────────────────────────────────────────────────────────────
  say("── 10 Travel tables");
  if (tables && typeof tables === "object") {
    for (const [tname, t] of Object.entries(tables)) for (const e of (t?.entries ?? t ?? [])) {
      const want = TABLE_GATES[e?.beatId]; if (!want) continue;
      const cur = Number(e.conditions?.phaseGte) || 0; if (cur >= want) continue;
      e.conditions = { ...(e.conditions ?? {}), phaseGte: want }; tablesChanged = true; tick(`[world] ${tname} › ${e.beatId}: phaseGte ${cur || "—"} → ${want}`);
    }
  } else skip("encounterTables setting missing/unknown shape");

  // 11 ── CACA + MILIARD ───────────────────────────────────────────────────────────────────────────────────
  say("── 11 CACA · Miliard");
  for (const [ctx, a] of await both(ID.lisa)) {
    if (a.name === "CACA") { say(`· ok [${ctx}] CACA`); continue; }
    if (a.name !== "Lisa Frank Elemental") { skip(`[${ctx}] ${ID.lisa} is "${a.name}"`); continue; }
    await upd(ctx, a, { name: "CACA", "prototypeToken.name": "CACA", "flags.fourththing.rfi.actor.title": "Cute Aggressive Cover Art (Saturated)" }, "Lisa Frank Elemental → CACA");
  }
  for (const ctx of ["world", "pack"]) {
    const all = ctx === "world" ? game.actors.contents : await pack.getDocuments();
    const m = all.find(a => a.name === "Miliard"); const bio = m?.system?.biography?.notes ?? "";
    if (m && /a Jackalope of the Fixit Farm enclave/.test(bio)) await upd(ctx, m, { "system.biography.notes": bio.replace("Miliard is a Jackalope of the Fixit Farm enclave and its resident showman", "Miliard is a Lumenwrought of the Fixit Farm enclave — Oldenborn, lit from within — and its resident showman") }, "Miliard bio: Lumenwrought, not a Jackalope");
  }

  // ── write the settings ───────────────────────────────────────────────────────────────────────────────────
  if (!DRY_RUN && (campChanged || tablesChanged)) {
    try { const save = foundry.utils.saveDataToFile ?? saveDataToFile; save(campsWasStr ? campsRaw : JSON.stringify(campsRaw), "text/json", `backup-campaigns-before-pass3-${Date.now()}.json`); if (tablesChanged) save(tablesWasStr ? tablesRaw : JSON.stringify(tablesRaw), "text/json", `backup-encounterTables-before-pass3-${Date.now()}.json`); } catch (_e) {}
    if (campChanged) await game.settings.set(NS, "campaigns", campsWasStr ? JSON.stringify(camps) : camps);
    if (tablesChanged) await game.settings.set(NS, "encounterTables", tablesWasStr ? JSON.stringify(tables) : tables);
  }
  if (!DRY_RUN) for (const p of unlocked) await p.configure({ locked: true });
  const skips = log.filter(l => l.startsWith("✗"));
  console.log(`[npc-pack-pass3-rulings] ${DRY_RUN ? "DRY RUN" : "APPLIED"} — ${changes} change(s), ${skipped} skipped` + (skips.length ? `\nSKIPPED (${skips.length}):\n` + skips.join("\n") + "\n──" : "") + "\n" + log.join("\n"));
  ui.notifications.info(`npc-pack-pass3-rulings ${DRY_RUN ? "dry run" : "applied"}: ${changes} changes, ${skipped} skipped — see console (F12).${DRY_RUN ? "" : " Hard-reload (Cmd-Shift-R) afterwards."}`);
})();
