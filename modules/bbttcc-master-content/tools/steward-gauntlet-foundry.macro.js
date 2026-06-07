// steward-gauntlet-foundry.macro.js — RUN IN-WORLD (GM). Phase 2: THE FOUNDRY.
// ─────────────────────────────────────────────────────────────────────────────
// Forges the coverage roster: one L20 "GAUNTLET ·" steward per CLASS × SUBCLASS
// discovered from the packs, with ancestries / heritages / archetypes / crew
// types / occult associations / alignments / BBTTCC techniques / starter
// manifestations / weapons DISTRIBUTED across the roster (covering array — every
// option appears at least once; the cross-product would be thousands).
//
// Build path = the same functions chargen uses, headless:
//   Actor.create → embed species+heritage+class+subclass+option feats →
//   level 20 → applyPathFeatures → applySkillGrantsFromFeatures →
//   promoteStampedAptitudeAEs → techniques + manifestations + weapons rack.
//
// Also builds the GAUNTLET ARENA scene with a HOSTILE "Sponge" (fat pools, the
// runner's target) and a FRIENDLY "Ally" (for buff/heal targets).
//
// IDEMPOTENT + CONTAINED: deletes ONLY actors named "GAUNTLET ·*" inside the
// "GAUNTLET" folder and the "GAUNTLET ARENA" scene, then rebuilds. Touches
// nothing else. READS packs only — never writes them.
//
// DRY_RUN=true prints the roster plan (no documents created). Then apply.
(async () => {
  const DRY_RUN = true;                              // <-- set false to forge
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const P = game.fourththing?._progression ?? {};
  const log = (...a) => console.log("[foundry]", ...a);

  // ── Discovery ──────────────────────────────────────────────────────────────
  const getDocs = async (packId, type = null) => {
    const pack = game.packs.get(packId);
    if (!pack) { console.warn(`[foundry] pack missing: ${packId}`); return []; }
    const docs = await pack.getDocuments();
    return type ? docs.filter(d => d.type === type) : docs;
  };

  const classDocs    = await getDocs("bbttcc-master-content.classes", "class");
  const subclassDocs = await getDocs("bbttcc-master-content.subclasses", "subclass");
  const ancestryDocs = await getDocs("bbttcc-master-content.ancestries");
  const itemsDocs    = await getDocs("bbttcc-master-content.items");
  const starterDocs  = await getDocs("fourththing.starter-manifestations");

  // class ↔ subclass pairing by identifier: class "shadow_courier" →
  // subclasses "bbttcc-shadow-courier-*".
  const norm = (s) => String(s ?? "").toLowerCase().replace(/_/g, "-");
  const pairs = [];
  for (const cls of classDocs) {
    const cid = norm(cls.system?.identifier);
    if (!cid) continue;
    const subs = subclassDocs.filter(s => norm(s.system?.identifier).startsWith(`bbttcc-${cid}`));
    if (subs.length) for (const sub of subs) pairs.push({ cls, sub });
    else pairs.push({ cls, sub: null }); // classes without subclasses still get one actor
  }

  // ancestry bundles: species item + its heritage feat(s) by name prefix.
  const speciesDocs = ancestryDocs.filter(d => ["species", "race"].includes(d.type));
  const ancestryBundles = speciesDocs.map(sp => {
    const mates = ancestryDocs.filter(d => d.id !== sp.id && d.name.startsWith(sp.name));
    return { species: sp, feats: mates.slice(0, 3) };
  });

  // BBTTCC option groups from the items pack, grouped base + "(Tier N)" mates.
  const groupOptions = (prefix) => {
    const bases = itemsDocs.filter(d => d.name.startsWith(prefix) && !/\(Tier \d+\)$/.test(d.name));
    return bases.map(b => ({
      base: b,
      tiers: itemsDocs.filter(d => d.name.startsWith(b.name.replace(/\s*\(.*$/, "")) && /\(Tier \d+\)$/.test(d.name))
    }));
  };
  const archetypes   = groupOptions("Archetype: ");
  const crews        = groupOptions("Crew Type: ");
  const associations = groupOptions("Occult Association: ");
  const alignments   = itemsDocs.filter(d => d.name.startsWith("Alignment: "));
  // BBTTCC techniques (feat folder) — distribute 2 per actor.
  const techniques   = itemsDocs.filter(d => d.type === "feat" && d.folder?.id === "QbGNBV70xh9pF0eh");
  const weapons      = itemsDocs.filter(d => d.type === "weapon");
  const starters     = starterDocs;

  log(`discovered: ${classDocs.length} classes, ${subclassDocs.length} subclasses → ${pairs.length} roster slots`);
  log(`ancestries ${ancestryBundles.length} · archetypes ${archetypes.length} · crews ${crews.length} · associations ${associations.length} · alignments ${alignments.length} · techniques ${techniques.length} · weapons ${weapons.length} · starters ${starters.length}`);

  // ── Roster plan (covering array via round-robin) ───────────────────────────
  const pick = (arr, i) => arr.length ? arr[i % arr.length] : null;
  const plan = pairs.map((p, i) => ({
    name: `GAUNTLET · ${p.cls.name}${p.sub ? ` / ${p.sub.name.replace(/\s*\(BBTTCC\)\s*$/, "")}` : ""}`,
    cls: p.cls, sub: p.sub,
    ancestry: pick(ancestryBundles, i),
    archetype: pick(archetypes, i),
    crew: pick(crews, i),
    assoc: pick(associations, i),
    align: pick(alignments, i),
    techs: [pick(techniques, 2 * i), pick(techniques, 2 * i + 1)].filter(Boolean),
    manifs: [pick(starters, 3 * i), pick(starters, 3 * i + 1), pick(starters, 3 * i + 2)].filter(Boolean),
    weapon: pick(weapons, i)
  }));
  console.table(plan.map(p => ({
    actor: p.name,
    ancestry: p.ancestry?.species?.name ?? "—",
    archetype: p.archetype?.base?.name?.replace("Archetype: ", "") ?? "—",
    crew: p.crew?.base?.name?.replace("Crew Type: ", "") ?? "—",
    assoc: p.assoc?.base?.name?.replace("Occult Association: ", "") ?? "—",
    techs: p.techs.map(t => t.name).join(" + ")
  })));

  if (DRY_RUN) {
    ui.notifications.info(`[DRY RUN] Foundry plan: ${plan.length} gauntlet stewards. Check the console table, then set DRY_RUN=false to forge.`);
    return;
  }

  // ── Teardown (contained) ───────────────────────────────────────────────────
  let folder = game.folders.find(f => f.type === "Actor" && f.name === "GAUNTLET");
  if (folder) {
    const olds = game.actors.filter(a => a.folder?.id === folder.id && a.name.startsWith("GAUNTLET ·"));
    if (olds.length) await Actor.deleteDocuments(olds.map(a => a.id));
    log(`teardown: ${olds.length} prior gauntlet actors deleted`);
  } else {
    folder = await Folder.create({ name: "GAUNTLET", type: "Actor", color: "#e8c84a" });
  }
  const oldScene = game.scenes.find(s => s.name === "GAUNTLET ARENA");
  if (oldScene) await oldScene.delete();

  // ── Forge ──────────────────────────────────────────────────────────────────
  const made = [];
  for (const p of plan) {
    const actor = await Actor.create({
      name: p.name, type: "character", folder: folder.id,
      img: p.cls.img && !/^icons\//.test(p.cls.img) ? p.cls.img : "icons/svg/mystery-man.svg",
      prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY },
      system: {
        details: { level: 20 },
        attributes: {
          violence: { value: 8 }, intrigue: { value: 6 }, presence: { value: 6 },
          body: { value: 8 }, mind: { value: 6 }, soul: { value: 6 }
        }
      }
    });

    // Embed the kit. toObject() so pack docs become owned copies.
    const toEmbed = [];
    const add = (doc) => { if (doc) toEmbed.push(doc.toObject()); };
    if (p.ancestry) { add(p.ancestry.species); p.ancestry.feats.forEach(add); }
    add(p.cls); add(p.sub);
    if (p.archetype) { add(p.archetype.base); p.archetype.tiers.forEach(add); }
    if (p.crew)      { add(p.crew.base);      p.crew.tiers.forEach(add); }
    if (p.assoc)     { add(p.assoc.base);     p.assoc.tiers.forEach(add); }
    add(p.align);
    p.techs.forEach(add);
    p.manifs.forEach(add);
    add(p.weapon);
    await actor.createEmbeddedDocuments("Item", toEmbed);

    // Progression pass — the same machinery chargen + level-up use.
    try { await P.applyPathFeatures?.(actor); } catch (e) { console.warn("[foundry] applyPathFeatures", p.name, e); }
    try { await P.applySkillGrantsFromFeatures?.(actor); } catch (e) { console.warn("[foundry] skillGrants", p.name, e); }
    try { await P.promoteStampedAptitudeAEs?.(actor); } catch (e) { console.warn("[foundry] promoteAEs", p.name, e); }

    // Top up pools to the freshly-derived maxima.
    const sys = actor.system?.system ?? actor.system ?? {};
    await actor.update({
      "system.derived.integrity.value": sys.derived?.integrity?.max ?? 100,
      "system.derived.stress.value":    sys.derived?.stress?.max ?? 50,
      "system.magic.clarity.value":     sys.magic?.clarity?.max ?? 5,
      "system.resources.surge.value":   5
    });
    made.push(actor);
    log(`forged ${actor.name} (${toEmbed.length} items)`);
  }

  // ── Dummies + Arena ────────────────────────────────────────────────────────
  const sponge = await Actor.create({
    name: "GAUNTLET · Sponge", type: "character", folder: folder.id,
    img: "icons/svg/target.svg",
    prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE },
    system: { details: { level: 20 }, attributes: { violence: { value: 2 }, intrigue: { value: 2 }, presence: { value: 2 }, body: { value: 10 }, mind: { value: 10 }, soul: { value: 10 } } }
  });
  const ally = await Actor.create({
    name: "GAUNTLET · Ally", type: "character", folder: folder.id,
    img: "icons/svg/angel.svg",
    prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY },
    system: { details: { level: 5 }, attributes: { violence: { value: 4 }, intrigue: { value: 4 }, presence: { value: 4 }, body: { value: 4 }, mind: { value: 4 }, soul: { value: 4 } } }
  });
  for (const a of [sponge, ally]) {
    const s = a.system?.system ?? a.system ?? {};
    await a.update({
      "system.derived.integrity.value": s.derived?.integrity?.max ?? 100,
      "system.derived.stress.value":    s.derived?.stress?.max ?? 50
    });
  }

  const scene = await Scene.create({
    name: "GAUNTLET ARENA", width: 3000, height: 3000,
    grid: { type: CONST.GRID_TYPES.SQUARE, size: 100, distance: 5, units: "ft" },
    backgroundColor: "#202830", padding: 0,
    tokenVision: false, fog: { exploration: false },
    flags: { "bbttcc-territory": { isNotHexMapScene: true } }   // never hex chrome
  });
  const spongeTok = (await sponge.getTokenDocument({ x: 1500, y: 1400 })).toObject();
  const allyTok   = (await ally.getTokenDocument({ x: 1300, y: 1600 })).toObject();
  await scene.createEmbeddedDocuments("Token", [spongeTok, allyTok]);

  console.log(`=== FOUNDRY COMPLETE — ${made.length} stewards + Sponge + Ally + Arena in ${Math.round(performance.now() - t0)}ms ===`);
  ui.notifications.info(`🏭 Foundry complete: ${made.length} GAUNTLET stewards forged, Arena built. Open a few sheets to sanity-check, then we run the gauntlet.`);
})();
