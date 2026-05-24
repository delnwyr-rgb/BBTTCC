// BBTTCC — Iconic Coalition Flagship Rigs (2026-05-23)
// ─────────────────────────────────────────────────────────────────────────────
// Mints the five "known methods of transportation" — one signature flagship
// rig per Known Coalition of the Bad Eden. Each is authored against the
// fourththing `rig` schema (identity / crew.capacity / integrity / defenses /
// travel / output / tags), embeds a thematic frame + weapons + systems +
// output module from the `bbttcc-master-content.items` compendium, and links
// its faction owner by name lookup when a matching faction actor exists.
//
// Mirrors the authoring path of bbttcc-auto-link/scripts/rig-builder.js
// (_commit + _seedLoadout) and the sizing rubric of
// seed-rigs-facilities-bosses.macro.js. Concept / signature copy is in Mal's
// voice, drawn from the "Known Coalitions" field guide.
//
//   1. Attaccountant Auditor      → The Attaccountants        (medium · T3)
//   2. Avuncular Order War Tower  → The Avuncular Order        (siege  · T3)
//   3. Proselytizer               → Church of We're Tired...   (medium · T2 · hybrid)
//   4. Unicorn VC Class           → Monodynamic Industries     (heavy  · T4)
//   5. Valhauler                  → The Valhaulans             (heavy  · T2 · aerial)
//
// Knobs:
//   DRY_RUN       — true: log payloads, don't write
//   SKIP_EXISTING — true: skip rigs whose name already exists
//   FORCE_RESEED_LOADOUT — true: (re)embed loadout even on an existing actor
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const DRY_RUN              = false;
  const SKIP_EXISTING        = true;
  const FORCE_RESEED_LOADOUT = false;

  const PACK_ID = "bbttcc-master-content.items";
  const TAG = "[seed-coalition-flagship-rigs]";

  // ── Per-bracket integrity sizing (matches seed-rigs-facilities-bosses) ────
  // max = base + (tier-1) × step
  const INTEGRITY_BY_BRACKET = {
    personal: { base: 15, step: 5  },
    light:    { base: 25, step: 7  },
    medium:   { base: 40, step: 10 },
    heavy:    { base: 60, step: 15 },
    siege:    { base: 80, step: 20 }
  };
  const rigIntegrity = (bracket, tier) => {
    const b = INTEGRITY_BY_BRACKET[bracket] ?? INTEGRITY_BY_BRACKET.medium;
    return b.base + (Math.max(1, Math.min(4, tier)) - 1) * b.step;
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  // ── Faction actor lookup (same detection as rig-builder _factionOptions) ──
  const isFactionActor = (a) => {
    try {
      return a.getFlag?.("bbttcc-factions", "isFaction")
        || a?.flags?.["bbttcc-factions"]?.isFaction
        || String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase() === "faction";
    } catch { return false; }
  };
  const factionActors = (game.actors?.contents ?? []).filter(isFactionActor);
  const findFaction = (keywords = []) => {
    for (const kw of keywords) {
      const k = kw.toLowerCase();
      const hit = factionActors.find(a => String(a.name).toLowerCase().includes(k));
      if (hit) return hit;
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  //  THE FIVE FLAGSHIPS
  //  capacity = [min, max] per role.  disposition: -1 hostile / 0 neutral / 1 friendly
  // ─────────────────────────────────────────────────────────────────────────
  const SPECS = [
    {
      name: "Attaccountant Auditor",
      img: "icons/svg/eye.svg",
      archetype: "Audit-Tribunal",
      bracket: "medium", tier: 3, mobility: "mobile", disposition: 0,
      factionKeywords: ["attaccountant"],
      travel: { speed: 3, range: 12, hazardResist: 1 },
      capacity: { pilot: [1,1], gunner: [1,2], engineer: [0,1], crew: [2,6] },
      resistances: ["psychic", "energy"], immunities: [], vulnerabilities: [],
      tags: ["numeromancy", "audit", "war-shaman", "attaccountant", "faction-flagship"],
      loadout: {
        frame: "Sail Barge Frame",
        weapons: ["Plasma Lance", "Resonance Howler"],
        systems: ["Reinforced Plating", "Sensor Suite", "Comms Array"],
        outputs: []
      },
      concept: "A wandering audit-tribunal on tracks — the IRS reincarnated as a death-cult on a war-wagon. Numeromancers ride the gun decks turning averages into blades and standard deviations into force shields. It does not destroy you. It reviews you, and finds you wanting.",
      signature: "A ledger amidships that updates itself in nobody's handwriting. When the Plasma Lance fires it does not burn the target — it EDITS it. The curse rides the beam: “You are found… wanting.”",
      gmNotes: "Attaccountants on the LEFT, the Audited on the RIGHT. Leadership is a quantum state — whoever signed the last form is in charge. Resonance Howler models the audit-as-curse (morale). Respects the Avuncular Order; does not trust the Circuit Riders (“robots are notoriously resistant to audits”)."
    },
    {
      name: "Avuncular Order War Tower",
      img: "icons/svg/tower.svg",
      archetype: "Rolling Bastion",
      bracket: "siege", tier: 3, mobility: "mobile", disposition: 1,
      factionKeywords: ["avuncular"],
      travel: { speed: 1, range: 8, hazardResist: 2 },
      capacity: { pilot: [1,2], gunner: [1,4], engineer: [1,2], crew: [4,12] },
      resistances: ["psychic", "kinetic"], immunities: ["fear"], vulnerabilities: [],
      tags: ["bastion", "soft-power", "morale", "community", "siege", "avuncular", "faction-flagship"],
      loadout: {
        frame: "Forge Facility Frame",
        weapons: ["Mortar Battery", "Twin Autocannons"],
        systems: ["Reinforced Plating", "Repair Bay", "Comms Array", "Sensor Suite"],
        outputs: ["Quartermaster Dispenser"]
      },
      concept: "A rolling bastion-cathedral that brings the potluck AND the artillery. The Avuncular Order's mobile strongpoint: it shelters refugees, hosts the best dinners in the wastes, and — if it absolutely must — drags the region into enlightenment kicking and screaming. The prettiest hex is wherever this thing parks.",
      signature: "A galley amidships that never goes cold; the smell of a hundred shared meals soaked into the plate. Strategos Joans' standard flies from the crown, and the hexes seem to align just by it being near.",
      gmNotes: "Big Good flagship. Runs on Soft Power, Diplomacy, and high Morale — Comms Array lets allies on-hex coordinate at +1 step, Quartermaster Dispenser stocks faction supplies. Suppression weapons chosen to discourage rather than annihilate. Immune to fear (high morale). Allied with the Free Peoples of Underground Montana; exasperated by everyone else."
    },
    {
      name: "Proselytizer",
      img: "icons/svg/angel.svg",
      archetype: "Revival Engine",
      bracket: "medium", tier: 2, mobility: "hybrid", disposition: 0,
      factionKeywords: ["church", "tired of waiting", "waiting"],
      travel: { speed: 3, range: 14, hazardResist: 0 },
      capacity: { pilot: [1,1], gunner: [0,2], engineer: [0,1], crew: [2,8] },
      resistances: ["psychic"], immunities: [], vulnerabilities: [],
      tags: ["faith", "summoning", "conversion", "revival", "church", "faction-flagship"],
      loadout: {
        frame: "Sail Barge Frame",
        weapons: ["Resonance Howler", "Phase Disruptor"],
        systems: ["Comms Array", "Sensor Suite"],
        outputs: ["Beacon Spire"]
      },
      concept: "A rolling pulpit and mobile summoning engine for the Church of We're Tired of Waiting. It tours the abandoned Walmarts of the Bad Eden, parks, raises the spire, and screams into the cosmos for the prophets who ghosted humanity to PLEASE, finally, return. The summoning works far more often than it has any right to.",
      signature: "A bootleg Shroud of Turin draped over the prow that absolutely works and absolutely should not. A summoning circle painted on the deck in materials purchased from a pre-Shattering novelty outlet mall. The Phase Disruptor doesn't fire so much as it complains at reality until something answers.",
      gmNotes: "Hybrid mobility: drives the circuit, then DEPLOYS to raise the Beacon Spire (signal + faith — stationary-only output; the spire's whole point is being a fixed point others can find). Resonance Howler = the sermon that turns will to wet paper (conversion). Faith + Intrigue. Led by Simon Sirene, smarmy and slippery as a buttered eel."
    },
    {
      name: "Unicorn VC Class",
      img: "icons/svg/coins.svg",
      archetype: "Corporate Dreadnought",
      bracket: "heavy", tier: 4, mobility: "mobile", disposition: -1,
      factionKeywords: ["monodynamic"],
      travel: { speed: 3, range: 10, hazardResist: 1 },
      capacity: { pilot: [1,2], gunner: [2,5], engineer: [1,2], crew: [2,8] },
      resistances: ["qliphothic"], immunities: ["morale"], vulnerabilities: [],
      tags: ["corporate", "qliphothic", "hostile-takeover", "predatory", "monodynamic", "faction-flagship"],
      loadout: {
        frame: "War Rig Frame",
        weapons: ["Phase Disruptor", "Plasma Lance", "Resonance Howler"],
        systems: ["Reinforced Plating", "Phase Cloak", "Sensor Suite", "Comms Array"],
        outputs: ["Mounted Forge"]
      },
      concept: "Late-stage capitalism rendered as a sleek predatory dreadnought. Monodynamic Industries' flagship hull-class — five weapon divisions, one for each of Mr. Monocle's heads: Synergy, Scale, Growth, Compliance, and pure aesthetic Monocle. It does not win battles. It acquires them. A hostile takeover with a railgun.",
      signature: "A monocle-shaped sensor eye on the prow. An org-chart on the bridge that rewrites itself mid-engagement, promoting whoever's still alive. NDAs enforced via direct psychic assault (Resonance Howler). The Darkness Track loves this thing.",
      gmNotes: "Apex adversary flagship — Tier IV, the scariest of the set; scale down to T3 if it overshadows the table. Qliphothic-aligned (Phase Disruptor is on-theme). Immune to morale — no soul to break. Phase Cloak = corporate deniability. Mounted Forge monetizes everything that breathes. Secretly bankrolls the Valhaulans."
    },
    {
      name: "Valhauler",
      img: "icons/svg/wing.svg",
      archetype: "Sky Longship",
      bracket: "heavy", tier: 2, mobility: "mobile", disposition: 0,
      factionKeywords: ["valhaul"],
      travel: { speed: 5, range: 18, hazardResist: 2 },
      capacity: { pilot: [1,2], gunner: [1,4], engineer: [0,2], crew: [4,12] },
      resistances: ["kinetic"], immunities: [], vulnerabilities: ["fire"],
      tags: ["aerial", "airship", "pirate", "raider", "valhaulan", "faction-flagship"],
      loadout: {
        frame: "War Rig Frame",
        weapons: ["Twin Autocannons", "Mortar Battery"],
        systems: ["Reinforced Plating", "Repair Bay", "Comms Array"],
        outputs: ["Quartermaster Dispenser"]
      },
      concept: "An aerial techno-Viking longship, patched together from dragon hide, sheet metal, and unconvincing optimism. The Valhaulans raid, steal, trade, vanish, return, apologize, steal again — and then sell you your own stuff back at a markup. Part war-barge, part ValLyft ride-share, all enthusiasm and zero accountability.",
      signature: "Dragon-hide hull patches over a ValLyft livery painted over somebody else's raided sigil. Rigging tied by genuine knot-tying champions. The Mortar crew yells coordinates at each other and the math, sometimes, lands.",
      gmNotes: "Aerial — it FLIES (high speed, long range, weather-resistant). Vulnerable to fire (dragon hide + optimism burns well). Quartermaster Dispenser is the plunder-locker. Led by Sklar Bjrornholdt, a Valkyrie with sky-high Presence and nonexistent impulse control. Secretly sponsored by Monodynamic Industries. Currently squatting in the Bunker of Great Narrative Importance™."
    }
  ];

  // ── Build a rig actor payload from a spec ────────────────────────────────
  function buildRigData(spec, factionId) {
    const integrity = rigIntegrity(spec.bracket, spec.tier);
    const cap = {};
    let crewMin = 0, crewMax = 0;
    for (const role of ["pilot", "gunner", "engineer", "crew"]) {
      const [mn, mx] = spec.capacity[role] ?? [0, 0];
      cap[role] = { min: mn, max: Math.max(mn, mx) };
      crewMin += cap[role].min;
      crewMax += cap[role].max;
    }

    const descParts = [
      `<p><strong>Concept.</strong> ${esc(spec.concept)}</p>`,
      `<p><strong>Signature.</strong> ${esc(spec.signature)}</p>`,
      `<p><em>GM Notes.</em> ${esc(spec.gmNotes)}</p>`
    ];
    const biography = descParts.join("\n");

    const data = {
      name: spec.name,
      type: "rig",
      img: spec.img || "icons/svg/cog.svg",
      flags: {
        "bbttcc-auto-link": {
          entityKind: "rig",
          createdViaFlagshipSeed: true,
          createdAt: Date.now()
        }
      },
      system: {
        identity: {
          mobility: spec.mobility || "mobile",
          state: "parked",
          factionOwnerId: factionId || "",
          archetype: spec.archetype || "",
          binding: { hexId: "", sceneId: "", tokenId: "" }
        },
        crew: { slots: [], capacity: cap, crewMin, crewMax },
        integrity: { value: integrity, max: integrity, tier: spec.tier, bracket: spec.bracket },
        defenses: {
          resistances: spec.resistances ?? [],
          immunities: spec.immunities ?? [],
          vulnerabilities: spec.vulnerabilities ?? []
        },
        output: { modules: [], basePerTurn: {} },
        travel: {
          speed: spec.travel?.speed ?? 3,
          range: spec.travel?.range ?? 10,
          hazardResist: spec.travel?.hazardResist ?? 0
        },
        tags: spec.tags ?? [],
        details: { biography: { value: biography, public: "" } },
        description: biography
      },
      prototypeToken: { actorLink: true, disposition: spec.disposition ?? 0 }
    };
    if (factionId) data.flags["bbttcc-factions"] = { factionId };
    return data;
  }

  // ── Embed frame + weapons + systems + outputs from the compendium ─────────
  // Mirrors rig-builder _seedLoadout: by-name lookup, non-fatal skip on miss.
  async function seedLoadout(actor, loadout) {
    if (!actor || !loadout) return { embedded: 0, missing: [] };
    const pack = game.packs?.get?.(PACK_ID);
    if (!pack) {
      console.warn(TAG, `Compendium '${PACK_ID}' not found — '${actor.name}' minted bare.`);
      return { embedded: 0, missing: ["<pack missing>"] };
    }
    const idx = await pack.getIndex();
    const wanted = [
      ...(loadout.frame ? [loadout.frame] : []),
      ...(loadout.weapons ?? []),
      ...(loadout.systems ?? []),
      ...(loadout.outputs ?? [])
    ];
    const toCreate = [];
    const missing = [];
    for (const nm of wanted) {
      const hit = idx.find(e => e.name === nm);
      if (!hit) { missing.push(nm); continue; }
      const doc = await pack.getDocument(hit._id);
      const obj = doc?.toObject?.();
      if (obj) { delete obj._id; toCreate.push(obj); }
    }
    if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
    if (missing.length) console.warn(TAG, `'${actor.name}' loadout items not found:`, missing);
    return { embedded: toCreate.length, missing };
  }

  // ── Run ──────────────────────────────────────────────────────────────────
  const summary = [];
  for (const spec of SPECS) {
    const faction = findFaction(spec.factionKeywords);
    const existing = game.actors?.find?.(a => a.type === "rig" && a.name === spec.name);

    if (existing && SKIP_EXISTING) {
      let reseed = "—";
      if (FORCE_RESEED_LOADOUT && !DRY_RUN) {
        const r = await seedLoadout(existing, spec.loadout);
        reseed = `+${r.embedded} items`;
      }
      summary.push({ rig: spec.name, action: "SKIP (exists)", faction: faction?.name ?? "—", integrity: existing.system?.integrity?.max ?? "?", loadout: reseed });
      continue;
    }

    const data = buildRigData(spec, faction?.id);

    if (DRY_RUN) {
      console.log(TAG, "DRY_RUN payload:", spec.name, data);
      summary.push({ rig: spec.name, action: "DRY_RUN", faction: faction?.name ?? "(none)", integrity: data.system.integrity.max, loadout: `would seed ${1 + (spec.loadout.weapons?.length||0) + (spec.loadout.systems?.length||0) + (spec.loadout.outputs?.length||0)}` });
      continue;
    }

    let actor;
    try {
      actor = await Actor.create(data);
    } catch (err) {
      console.error(TAG, `Actor.create failed for ${spec.name}`, err);
      summary.push({ rig: spec.name, action: `ERROR: ${err?.message || err}`, faction: faction?.name ?? "—", integrity: "—", loadout: "—" });
      continue;
    }

    const seed = await seedLoadout(actor, spec.loadout);
    summary.push({
      rig: spec.name,
      action: "CREATED",
      faction: faction?.name ?? "(unlinked)",
      integrity: data.system.integrity.max,
      loadout: `${seed.embedded} items${seed.missing.length ? ` (missing: ${seed.missing.join(", ")})` : ""}`
    });
  }

  console.log(`${TAG} ─── RESULT ───`);
  console.table(summary);
  const created = summary.filter(s => s.action === "CREATED").length;
  const skipped = summary.filter(s => String(s.action).startsWith("SKIP")).length;
  const note = DRY_RUN ? "DRY_RUN — nothing written. See console payloads." : `${created} created, ${skipped} skipped.`;
  ui.notifications?.info?.(`Coalition Flagship Rigs: ${note}`);
})();
