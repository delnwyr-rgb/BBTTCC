// Bad Eden — New Rigs, Content Sprint Batch 1 (2026-06-13)
// ─────────────────────────────────────────────────────────────────────────────
// Mints 6 NEW faction rigs as proper fourththing `rig` actors — NOT the old
// dnd5e `vehicle` junk. Mirrors the canonical authoring path of
// bbttcc-auto-link/scripts/rig-builder.js (_commit + _seedLoadout) and the
// sibling seed-coalition-flagship-rigs.macro.js: builds the rig schema, embeds
// frame/weapons/systems/outputs from the bbttcc-master-content.items compendium
// by name, links faction owner by name, AND stamps a bracket-driven structural
// BOM via game.bbttcc.api.structures.stampBOM so each rig has a hardness model.
//
// RUN IN-WORLD (paste into a script macro, execute as GM). Idempotent: skips
// rigs whose name already exists.
//
//   1. Jackalope Haggle-Wagon           → Jackalopes        (medium · T2)
//   2. Valhaulan Lullaby-Barge          → Valhaulans        (heavy  · T2)
//   3. S'narchy Burger Drive-Thru (Mobile)→ Avuncular/Allesh  (medium · T2 · hybrid)
//   4. Sephirotic Pilgrim-Tram          → Sephirotic Scions (medium · T2)
//   5. Menhir Kin Standing-Stone Crawler→ Menhir Kin        (siege  · T3)
//   6. Sarmoung Whisper-Skiff           → Sarmoung Brotherhd (light · T2)
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const DRY_RUN       = false;   // true: log payloads, write nothing
  const SKIP_EXISTING = true;    // skip rigs whose name already exists
  const STAMP_BOM     = true;    // stamp a bracket-driven structural hardness model

  const PACK_ID = "bbttcc-master-content.items";
  const TAG = "[seed-bad-eden-rigs]";

  // Integrity sizing (matches seed-coalition-flagship-rigs): max = base+(tier-1)×step
  const INTEGRITY_BY_BRACKET = {
    personal: { base: 15, step: 5 }, light: { base: 25, step: 7 },
    medium: { base: 40, step: 10 }, heavy: { base: 60, step: 15 }, siege: { base: 80, step: 20 }
  };
  const rigIntegrity = (bracket, tier) => {
    const b = INTEGRITY_BY_BRACKET[bracket] ?? INTEGRITY_BY_BRACKET.medium;
    return b.base + (Math.max(1, Math.min(4, tier)) - 1) * b.step;
  };

  // Bracket-driven structural BOM (verbatim from rig-builder.js CHASSIS_BRACKET_BOM).
  const CHASSIS_BRACKET_BOM = {
    personal: [{ materialKey: "bog-iron", qty: 4 }, { materialKey: "ash-wood", qty: 2 }, { materialKey: "hex-iron-cleat", qty: 1 }],
    light:    [{ materialKey: "bog-iron", qty: 5 }, { materialKey: "ash-wood", qty: 2 }, { materialKey: "cold-iron", qty: 1 }],
    medium:   [{ materialKey: "scribed-steel", qty: 6 }, { materialKey: "heart-iron", qty: 3 }, { materialKey: "cold-iron", qty: 2 }],
    heavy:    [{ materialKey: "scribed-steel", qty: 8 }, { materialKey: "heart-iron", qty: 4 }, { materialKey: "cold-iron", qty: 3 }, { materialKey: "mountain-stone", qty: 2 }],
    siege:    [{ materialKey: "scribed-steel", qty: 10 }, { materialKey: "heart-iron", qty: 5 }, { materialKey: "cold-iron", qty: 4 }, { materialKey: "mountain-stone", qty: 4 }, { materialKey: "yesodium", qty: 1 }]
  };
  const bracketBOM = (b) => CHASSIS_BRACKET_BOM[String(b||"").toLowerCase()] ?? CHASSIS_BRACKET_BOM.medium;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const isFactionActor = (a) => { try { return a.getFlag?.("bbttcc-factions","isFaction") || a?.flags?.["bbttcc-factions"]?.isFaction || String(foundry.utils.getProperty(a,"system.details.type.value")??"").toLowerCase()==="faction"; } catch { return false; } };
  const factionActors = (game.actors?.contents ?? []).filter(isFactionActor);
  const findFaction = (kws = []) => { for (const kw of kws) { const k = kw.toLowerCase(); const hit = factionActors.find(a => String(a.name).toLowerCase().includes(k)); if (hit) return hit; } return null; };

  const CAP = {
    light:  { pilot:[1,1], gunner:[0,1], engineer:[0,0], crew:[0,2] },
    medium: { pilot:[1,1], gunner:[0,2], engineer:[0,1], crew:[0,4] },
    heavy:  { pilot:[1,1], gunner:[1,3], engineer:[0,1], crew:[0,4] },
    siege:  { pilot:[1,2], gunner:[1,4], engineer:[1,2], crew:[2,8] }
  };

  // ── THE SIX RIGS ────────────────────────────────────────────────────────────
  const SPECS = [
    {
      name: "Jackalope Haggle-Wagon", img: "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_globe_2.png",
      archetype: "Mercantile Wagon", bracket: "medium", tier: 2, mobility: "mobile", disposition: 0,
      travel: { speed: 4, range: 14, hazardResist: 0 },
      tags: ["mercantile","jackalope","trade","faction-rig"],
      factionKeywords: ["jackalope"],
      concept: "A rolling bazaar with more awnings than armor. The Jackalopes bolted a counter onto a chassis and never looked back — it'll sell you the wheels off itself and then sell you back the same wheels at a markup.",
      signature: "At least three of the doors are actually exits for when a deal goes sideways. The ledger amidships is never wrong and never in your favor.",
      loadout: { frame: "Sail Barge Frame", weapons: ["Twin Autocannons"], systems: ["Comms Array","Sensor Suite"], outputs: ["Quartermaster Dispenser"] }
    },
    {
      name: "Valhaulan Lullaby-Barge", img: "art/bbttcc/GOTTGAIT/BBTTCC_Character_Options/AncientBlood3.png",
      archetype: "Raider Barge", bracket: "heavy", tier: 2, mobility: "mobile", disposition: 0,
      travel: { speed: 5, range: 16, hazardResist: 1 },
      tags: ["raider","valhaulan","storm-voiced","faction-rig"],
      factionKeywords: ["valhaul"], resistances: ["kinetic"], vulnerabilities: ["fire"],
      concept: "A techno-Viking barge that traded its sail for a P.A. system and its figurehead for a battle-cradle. It sings as it rams. The Valhaulans insist the song is soothing; the wreckage disagrees.",
      signature: "A drum the size of an argument and a muster-lullaby loud enough to curdle morale three hexes out. Not to be confused with the flagship Valhauler — this is the one they actually fight in.",
      loadout: { frame: "War Rig Frame", weapons: ["Mortar Battery","Twin Autocannons"], systems: ["Reinforced Plating","Repair Bay"] }
    },
    {
      name: "S'narchy Burger Drive-Thru (Mobile Unit)", img: "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/bbttcc_icons_shout_1.png",
      archetype: "Mobile Sanctuary", bracket: "medium", tier: 2, mobility: "hybrid", disposition: 1,
      travel: { speed: 3, range: 14, hazardResist: 1 },
      tags: ["sanctuary","civic","home-town","faction-rig"],
      factionKeywords: ["avuncular","allesh","gilliam"], resistances: ["psychic"], immunities: ["fear"],
      concept: "When Allesh-Gilliam needs to move the whole HQ, it folds the repurposed S'narchy Burger into a self-propelled drive-thru. The order speaker still works. It will take your order whether you stop or not. PROUDLY OVERCOOKED SINCE THE SHATTERING.",
      signature: "A moving home town — the wrongness of the wastes falls quiet around it, and the coffee is, against all odds, fresh.",
      loadout: { frame: "Forge Facility Frame", weapons: [], systems: ["Repair Bay","Comms Array","Sensor Suite"], outputs: ["Quartermaster Dispenser"] }
    },
    {
      name: "Sephirotic Pilgrim-Tram", img: "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_goddess.png",
      archetype: "Pilgrim Conveyance", bracket: "medium", tier: 2, mobility: "mobile", disposition: 1,
      travel: { speed: 3, range: 12, hazardResist: 0 },
      tags: ["faith","softpower","scion","pilgrimage","faction-rig"],
      factionKeywords: ["sephirotic","scion"], resistances: ["psychic"],
      concept: "A Scion conveyance strung with prayer-thread and lit from inside by a Spark someone is definitely supposed to be guarding more carefully. It carries the faithful toward the Great Work and the curious toward awkward theological conversations.",
      signature: "Its passage steadies allied resolve and sways the undecided. The Spark in the lantern hums in a key that makes the air feel load-bearing.",
      loadout: { frame: "Sail Barge Frame", weapons: ["Resonance Howler"], systems: ["Comms Array","Sensor Suite"], outputs: ["Beacon Spire"] }
    },
    {
      name: "Menhir Kin Standing-Stone Crawler", img: "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_war_tower_1.png",
      archetype: "Walking Bastion", bracket: "siege", tier: 3, mobility: "mobile", disposition: 0,
      travel: { speed: 1, range: 6, hazardResist: 2 },
      tags: ["bulwark","menhir-kin","stone","slow","faction-rig"],
      factionKeywords: ["menhir"], resistances: ["kinetic"],
      concept: "The Menhir Kin do not build vehicles so much as convince a standing stone to walk. Slow. Implacable. The kind of slow that arrives anyway. It does not skip encounters; it absorbs them.",
      signature: "A fortress that travels badly and holds excellently. When it finally stops, the ground is grateful and the enemy is not.",
      loadout: { frame: "Forge Facility Frame", weapons: ["Mortar Battery"], systems: ["Reinforced Plating","Sensor Suite"] }
    },
    {
      name: "Sarmoung Whisper-Skiff", img: "art/bbttcc/GOTTGAIT/BBTTCC%20Button%20Icons/BBTTCC_button_icon_golbe_1.png",
      archetype: "Stealth Runabout", bracket: "light", tier: 2, mobility: "mobile", disposition: 0,
      travel: { speed: 5, range: 16, hazardResist: 1 },
      tags: ["intrigue","sarmoung","stealth","fast","faction-rig"],
      factionKeywords: ["sarmoung"],
      concept: "A Sarmoung Brotherhood runabout built for arriving without having been seen to leave. Mufflers on the engine, mufflers on the crew, mufflers on the questions you'd otherwise ask.",
      signature: "It is already gone. It was never here. The Phase Cloak does most of the lying; the crew handles the rest.",
      loadout: { frame: "Light Skiff Frame", weapons: ["Twin Autocannons"], systems: ["Phase Cloak","Sensor Suite"] }
    }
  ];

  // ── builders (mirror seed-coalition-flagship-rigs) ────────────────────────────
  function buildRigData(spec, factionId) {
    const cap = {}; let crewMin = 0, crewMax = 0;
    const grid = CAP[spec.bracket] ?? CAP.medium;
    for (const role of ["pilot","gunner","engineer","crew"]) {
      const [mn, mx] = grid[role] ?? [0,0];
      cap[role] = { min: mn, max: Math.max(mn, mx) }; crewMin += mn; crewMax += Math.max(mn, mx);
    }
    const integrity = rigIntegrity(spec.bracket, spec.tier);
    const bioParts = [];
    if (spec.concept)   bioParts.push(`<p><strong>Concept.</strong> ${esc(spec.concept)}</p>`);
    if (spec.signature) bioParts.push(`<p><strong>Signature.</strong> ${esc(spec.signature)}</p>`);
    const biography = bioParts.join("\n");
    const data = {
      name: spec.name, type: "rig", img: spec.img || "icons/svg/cog.svg",
      flags: { "bbttcc-auto-link": { entityKind: "rig", createdViaContentSprint: "2026-06-13", createdAt: Date.now() } },
      system: {
        identity: { mobility: spec.mobility||"mobile", state: "parked", factionOwnerId: factionId||"", archetype: spec.archetype||"", binding: { hexId:"", sceneId:"", tokenId:"" } },
        crew: { slots: [], capacity: cap, crewMin, crewMax },
        integrity: { value: integrity, max: integrity, tier: spec.tier, bracket: spec.bracket },
        defenses: { resistances: spec.resistances ?? [], immunities: spec.immunities ?? [], vulnerabilities: spec.vulnerabilities ?? [] },
        output: { modules: [], basePerTurn: {} },
        travel: { speed: spec.travel?.speed ?? 3, range: spec.travel?.range ?? 10, hazardResist: spec.travel?.hazardResist ?? 0 },
        tags: spec.tags ?? [],
        details: { biography: { value: biography, public: "" } }, description: biography
      },
      prototypeToken: { actorLink: true, disposition: spec.disposition ?? 0 }
    };
    if (factionId) data.flags["bbttcc-factions"] = { factionId };
    return data;
  }

  async function seedLoadout(actor, loadout) {
    const pack = game.packs?.get?.(PACK_ID);
    if (!pack) { console.warn(TAG, `Compendium '${PACK_ID}' not found — '${actor.name}' minted bare.`); return { embedded: 0, missing: ["<pack missing>"] }; }
    const idx = await pack.getIndex();
    const wanted = [ ...(loadout.frame ? [loadout.frame] : []), ...(loadout.weapons ?? []), ...(loadout.systems ?? []), ...(loadout.outputs ?? []) ];
    const toCreate = [], missing = [];
    for (const nm of wanted) {
      const hit = idx.find(e => e.name === nm);
      if (!hit) { missing.push(nm); continue; }
      const obj = (await pack.getDocument(hit._id))?.toObject?.();
      if (obj) { delete obj._id; toCreate.push(obj); }
    }
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
    if (missing.length) console.warn(TAG, `'${actor.name}' loadout items not found:`, missing);
    return { embedded: toCreate.length, missing };
  }

  // ── run ───────────────────────────────────────────────────────────────────
  const summary = [];
  for (const spec of SPECS) {
    const faction = findFaction(spec.factionKeywords);
    const existing = game.actors?.find?.(a => a.type === "rig" && a.name === spec.name);
    if (existing && SKIP_EXISTING) { summary.push({ rig: spec.name, action: "SKIP (exists)", faction: faction?.name ?? "—" }); continue; }
    const data = buildRigData(spec, faction?.id);
    if (DRY_RUN) { console.log(TAG, "DRY_RUN", spec.name, data); summary.push({ rig: spec.name, action: "DRY_RUN", faction: faction?.name ?? "(none)", integrity: data.system.integrity.max }); continue; }
    let actor;
    try { actor = await Actor.create(data); }
    catch (err) { console.error(TAG, `Actor.create failed for ${spec.name}`, err); summary.push({ rig: spec.name, action: `ERROR: ${err?.message||err}` }); continue; }
    const seed = await seedLoadout(actor, spec.loadout);
    let bom = "—";
    if (STAMP_BOM) {
      try {
        const api = game.bbttcc?.api?.structures;
        if (api?.stampBOM) { await api.stampBOM(actor, bracketBOM(spec.bracket), { facilityMode: spec.mobility === "stationary", resetCurrentPlates: true }); bom = "stamped"; }
        else bom = "no-api";
      } catch (e) { console.warn(TAG, `stampBOM failed for ${spec.name} (non-fatal):`, e); bom = "fail"; }
    }
    summary.push({ rig: spec.name, action: "CREATED", faction: faction?.name ?? "(unlinked)", integrity: data.system.integrity.max, loadout: `${seed.embedded} items${seed.missing.length?` (missing: ${seed.missing.join(", ")})`:""}`, bom });
  }
  console.log(`${TAG} ─── RESULT ───`); console.table(summary);
  const created = summary.filter(s => s.action === "CREATED").length;
  ui.notifications?.info?.(`Bad Eden Rigs: ${DRY_RUN ? "DRY_RUN (nothing written)" : `${created} created`}. See console for table.`);
})();
