/* BBTTCC Auto-Link — RFI Rig Builder
 *
 * Sibling to boss-builder.js. Mints a type:"rig" actor authored against the
 * fourththing rig schema (identity / integrity / capacity / travel / defenses).
 *
 * Modeled on the Manifestation Creation Engine — single resizable panel with
 * a guide block at the top, starter chassis chips that pre-fill the form,
 * and a two-column ft-cast-grid where narrative fields span both columns.
 * Reuses the .ft-manifestation-wizard-window CSS for visual + scroll parity.
 *
 * Starters mirror the rig bracket axis (personal / light / medium / heavy /
 * siege) crossed with mobility (mobile / stationary) — a chassis is the
 * narrative seam, the bracket is the mechanical envelope.
 *
 * 2026-05-17 — B13 Builder UI sprint.
 */

const MOD = "bbttcc-auto-link";

const BRACKETS = [
  { key: "personal", label: "Personal", base: 10, speed: 3, range: 8 },
  { key: "light",    label: "Light",    base: 20, speed: 4, range: 12 },
  { key: "medium",   label: "Medium",   base: 30, speed: 3, range: 10 },
  { key: "heavy",    label: "Heavy",    base: 48, speed: 2, range: 8 },
  { key: "siege",    label: "Siege",    base: 72, speed: 1, range: 6 }
];

const MOBILITIES = [
  { key: "mobile",     label: "Mobile (drives the map)" },
  { key: "stationary", label: "Stationary (emplacement / facility)" },
  { key: "hybrid",     label: "Hybrid (tows, redeploys)" }
];

// Starter chassis — bracket × mobility narrative seeds. Click a chip to
// prefill the form. These are NARRATIVE; the GM can always override the
// underlying bracket/capacity numbers after a chip seeds them.
const CHASSIS_STARTERS = [
  {
    key: "personal_mount",
    label: "Personal Mount",
    description: "A single-rider chassis. Bike, sword-horse, war-saddled creature.",
    defaults: {
      bracket: "personal", mobility: "mobile", tier: 1,
      capacity: { pilot: [1,1], gunner: [0,0], engineer: [0,0], crew: [0,1] },
      tags: "personal, mount, rider",
      loadout: {
        frame:   { synthName: "Personal Mount Frame", bracket: "personal", pilotMount: true, baseIntegrity: 12, tierStep: 4,
                   mobilityAllowed: ["mobile"], slots: { weapon: 0, system: 1, output: 0 },
                   capacity: { pilot: {min:1,max:1}, gunner: {min:0,max:0}, engineer: {min:0,max:0}, crew: {min:0,max:1} },
                   actions: { pilot: ["steer","evasive","swerve"], gunner: [], engineer: [], crew: ["brace","hold-on"] },
                   travel: { speed: 4, range: 8 } },
        weapons: [],
        systems: ["Sensor Suite"]
      }
    }
  },
  {
    key: "light_scout",
    label: "Light Scout",
    description: "Fast, fragile, high-evasion. Runs ahead of the line and reports.",
    defaults: {
      bracket: "light", mobility: "mobile", tier: 1,
      capacity: { pilot: [1,1], gunner: [0,1], engineer: [0,0], crew: [0,2] },
      tags: "scout, recon, fast",
      loadout: { frame: "Light Skiff Frame", weapons: ["Twin Autocannons"], systems: ["Sensor Suite"] }
    }
  },
  {
    key: "medium_workhorse",
    label: "Medium Workhorse",
    description: "Versatile mid-line chassis. Carries, fights, hauls.",
    defaults: {
      bracket: "medium", mobility: "mobile", tier: 2,
      capacity: { pilot: [1,1], gunner: [0,2], engineer: [0,1], crew: [0,4] },
      tags: "workhorse, line, hauler",
      loadout: { frame: "Sail Barge Frame", weapons: ["Twin Autocannons"], systems: ["Repair Bay", "Comms Array"] }
    }
  },
  {
    key: "heavy_combatant",
    label: "Heavy Combatant",
    description: "Armored bruiser. Trades speed for plating and weapon mounts.",
    defaults: {
      bracket: "heavy", mobility: "mobile", tier: 2,
      capacity: { pilot: [1,1], gunner: [1,3], engineer: [0,1], crew: [0,4] },
      tags: "armored, line-breaker, heavy",
      loadout: { frame: "War Rig Frame", weapons: ["Twin Autocannons", "Plasma Lance"], systems: ["Reinforced Plating", "Repair Bay"] }
    }
  },
  {
    key: "siege_engine",
    label: "Siege Engine",
    description: "Slow, immense, structural. Threatens fortifications and crowds.",
    defaults: {
      bracket: "siege", mobility: "mobile", tier: 3,
      capacity: { pilot: [1,2], gunner: [1,4], engineer: [1,2], crew: [2,8] },
      tags: "siege, structural, terror",
      loadout: { frame: "Forge Facility Frame", weapons: ["Mortar Battery"], systems: ["Reinforced Plating", "Sensor Suite"] }
    }
  },
  {
    key: "stationary_battery",
    category: "facility",
    label: "Stationary Battery",
    description: "An emplacement. Doesn't move; threatens an arc. Bind to a hex.",
    defaults: {
      bracket: "medium", mobility: "stationary", tier: 2,
      capacity: { pilot: [0,1], gunner: [1,2], engineer: [0,1], crew: [0,2] },
      tags: "emplacement, battery, fixed",
      loadout: { frame: "Garrison Fort Frame", weapons: ["Mortar Battery"], systems: ["Reinforced Plating", "Sensor Suite"] }
    }
  },
  {
    // Facility chip — a fixed manned strongpoint. Stationary rig under the
    // unified model; the Facilities tab biases mobility to stationary on commit.
    key: "garrison_outpost",
    category: "facility",
    label: "Garrison Outpost",
    description: "A fixed strongpoint. Houses a small garrison, watches an approach, doesn't move.",
    defaults: {
      bracket: "medium", mobility: "stationary", tier: 2,
      capacity: { pilot: [0,0], gunner: [1,2], engineer: [0,1], crew: [2,6] },
      tags: "garrison, outpost, fixed, facility",
      loadout: { frame: "Garrison Fort Frame", weapons: ["Twin Autocannons"], systems: ["Reinforced Plating", "Sensor Suite"] }
    }
  },
  {
    // Facility chip — stationary fabrication & repair bay; anchors a holding.
    key: "field_workshop",
    category: "facility",
    label: "Field Workshop",
    description: "A stationary fabrication & repair bay. Mends rigs, fabricates parts, anchors a holding.",
    defaults: {
      bracket: "medium", mobility: "stationary", tier: 2,
      capacity: { pilot: [0,0], gunner: [0,0], engineer: [1,2], crew: [1,4] },
      tags: "workshop, fabrication, repair, facility",
      loadout: { frame: "Forge Facility Frame", weapons: [], systems: ["Repair Bay", "Comms Array"], outputs: ["Mounted Forge"] }
    }
  },
  {
    // B13.D Phase D — 2026-05-17. Avuncular Transport Rig: medium land
    // chassis, primary role is transport across Bad Eden. Carries crew +
    // cargo, has plating + light firepower for protection in transit.
    // Designed as a faction starter rig.
    key: "atr",
    label: "Avuncular Transport Rig (ATR)",
    description: "Medium land transport. Carries people and matériel across Bad Eden; armored enough to discourage trouble, armed enough to end it.",
    defaults: {
      bracket: "medium", mobility: "mobile", tier: 2,
      capacity: { pilot: [1,1], gunner: [0,1], engineer: [0,1], crew: [2,6] },
      tags: "transport, faction-starter, land, atr",
      loadout: {
        synthName: "ATR Transport Frame",
        frame: { synthName: "ATR Transport Frame", bracket: "medium", baseIntegrity: 36, tierStep: 10,
                 mobilityAllowed: ["mobile"], slots: { weapon: 1, system: 2, output: 1 },
                 capacity: { pilot: {min:1,max:1}, gunner: {min:0,max:1}, engineer: {min:0,max:1}, crew: {min:2,max:6} },
                 actions: { pilot: ["steer","hold-position","evasive","swerve"],
                            gunner: ["fire-weapon","aimed-shot","suppression","reload"],
                            engineer: ["repair","boost-system","vent-heat"],
                            crew: ["operate-module","brace","signal","hold-on"] },
                 travel: { speed: 3, range: 14 } },
        weapons: ["Twin Autocannons"],
        systems: ["Reinforced Plating", "Comms Array"]
      }
    }
  },
  {
    // B13.D Phase D — 2026-05-17. Hexmobile: personal land transport,
    // 2 riders, single pilot-mount weapon. The OTHER faction starter rig.
    key: "hexmobile",
    label: "Hexmobile",
    description: "Personal land transport. Two riders, one weapon mounted at the pilot's hand. Bad Eden's signature scout-and-skirmish ride.",
    defaults: {
      bracket: "personal", mobility: "mobile", tier: 1,
      capacity: { pilot: [1,1], gunner: [0,0], engineer: [0,0], crew: [0,1] },
      tags: "hexmobile, faction-starter, personal, land",
      loadout: {
        frame: { synthName: "Hexmobile Frame", bracket: "personal", pilotMount: true, baseIntegrity: 14, tierStep: 4,
                 mobilityAllowed: ["mobile"], slots: { weapon: 0, system: 1, output: 0 },
                 capacity: { pilot: {min:1,max:1}, gunner: {min:0,max:0}, engineer: {min:0,max:0}, crew: {min:0,max:1} },
                 actions: { pilot: ["steer","evasive","swerve","fire-weapon"], gunner: [], engineer: [],
                            crew: ["brace","hold-on"] },
                 travel: { speed: 5, range: 10 } },
        weapons: ["Twin Autocannons"],
        systems: ["Sensor Suite"]
      }
    }
  },
  // ── ICONIC COALITION FLAGSHIPS — 2026-05-23 ──────────────────────────────
  // One signature flagship per Known Coalition of the Bad Eden. These chips
  // carry their full character (defenses / integrity / travel / disposition /
  // concept / signature) so a single click reproduces the iconic rig.
  // Integrity values match the seed-macro sizing rubric (base+(tier-1)×step:
  // medium 40/10, heavy 60/15, siege 80/20). Companion macro:
  // bbttcc-master-content/tools/seed-coalition-flagship-rigs.macro.js.
  {
    key: "flagship_attaccountant_auditor",
    label: "Attaccountant Auditor",
    description: "Attaccountant flagship. A wandering audit-tribunal on tracks — the IRS as a death-cult war-wagon. Medium · T3.",
    defaults: {
      bracket: "medium", mobility: "mobile", tier: 3, disposition: 0,
      integrity: 60,
      travel: { speed: 3, range: 12, hazardResist: 1 },
      capacity: { pilot: [1,1], gunner: [1,2], engineer: [0,1], crew: [2,6] },
      tags: "numeromancy, audit, war-shaman, attaccountant, faction-flagship",
      resistances: "psychic, energy",
      concept: "A wandering audit-tribunal on tracks — the IRS reincarnated as a death-cult on a war-wagon. Numeromancers ride the gun decks turning averages into blades and standard deviations into force shields. It does not destroy you. It reviews you, and finds you wanting.",
      signature: "A ledger amidships that updates itself in nobody's handwriting. When the Plasma Lance fires it does not burn the target — it EDITS it. The curse rides the beam: “You are found… wanting.”",
      loadout: {
        frame: "Sail Barge Frame",
        weapons: ["Plasma Lance", "Resonance Howler"],
        systems: ["Reinforced Plating", "Sensor Suite", "Comms Array"]
      }
    }
  },
  {
    key: "flagship_avuncular_war_tower",
    label: "Avuncular Order War Tower",
    description: "Avuncular Order flagship. A rolling bastion-cathedral that brings the potluck AND the artillery. Siege · T3.",
    defaults: {
      bracket: "siege", mobility: "mobile", tier: 3, disposition: 1,
      integrity: 120,
      travel: { speed: 1, range: 8, hazardResist: 2 },
      capacity: { pilot: [1,2], gunner: [1,4], engineer: [1,2], crew: [4,12] },
      tags: "bastion, soft-power, morale, community, siege, avuncular, faction-flagship",
      resistances: "psychic, kinetic",
      immunities: "fear",
      concept: "A rolling bastion-cathedral that brings the potluck AND the artillery. The Avuncular Order's mobile strongpoint: it shelters refugees, hosts the best dinners in the wastes, and — if it absolutely must — drags the region into enlightenment kicking and screaming. The prettiest hex is wherever this thing parks.",
      signature: "A galley amidships that never goes cold; the smell of a hundred shared meals soaked into the plate. Strategos Joans' standard flies from the crown, and the hexes seem to align just by it being near.",
      loadout: {
        frame: "Forge Facility Frame",
        weapons: ["Mortar Battery", "Twin Autocannons"],
        systems: ["Reinforced Plating", "Repair Bay", "Comms Array", "Sensor Suite"],
        outputs: ["Quartermaster Dispenser"]
      }
    }
  },
  {
    key: "flagship_proselytizer",
    label: "Proselytizer",
    description: "Church of We're Tired of Waiting flagship. A rolling pulpit & mobile summoning engine. Medium · T2 · hybrid.",
    defaults: {
      bracket: "medium", mobility: "hybrid", tier: 2, disposition: 0,
      integrity: 50,
      travel: { speed: 3, range: 14, hazardResist: 0 },
      capacity: { pilot: [1,1], gunner: [0,2], engineer: [0,1], crew: [2,8] },
      tags: "faith, summoning, conversion, revival, church, faction-flagship",
      resistances: "psychic",
      concept: "A rolling pulpit and mobile summoning engine for the Church of We're Tired of Waiting. It tours the abandoned Walmarts of the Bad Eden, parks, raises the spire, and screams into the cosmos for the prophets who ghosted humanity to PLEASE, finally, return. The summoning works far more often than it has any right to.",
      signature: "A bootleg Shroud of Turin draped over the prow that absolutely works and absolutely should not. A summoning circle painted on the deck. The Phase Disruptor doesn't fire so much as it complains at reality until something answers.",
      loadout: {
        frame: "Sail Barge Frame",
        weapons: ["Resonance Howler", "Phase Disruptor"],
        systems: ["Comms Array", "Sensor Suite"],
        outputs: ["Beacon Spire"]
      }
    }
  },
  {
    key: "flagship_unicorn_vc_class",
    label: "Unicorn VC Class",
    description: "Monodynamic Industries flagship. Late-stage capitalism as a sleek predatory dreadnought. Heavy · T4 · APEX.",
    defaults: {
      bracket: "heavy", mobility: "mobile", tier: 4, disposition: -1,
      integrity: 105,
      travel: { speed: 3, range: 10, hazardResist: 1 },
      capacity: { pilot: [1,2], gunner: [2,5], engineer: [1,2], crew: [2,8] },
      tags: "corporate, qliphothic, hostile-takeover, predatory, monodynamic, faction-flagship",
      resistances: "qliphothic",
      immunities: "morale",
      concept: "Late-stage capitalism rendered as a sleek predatory dreadnought. Monodynamic Industries' flagship hull-class — five weapon divisions, one for each of Mr. Monocle's heads: Synergy, Scale, Growth, Compliance, and pure aesthetic Monocle. It does not win battles. It acquires them. A hostile takeover with a railgun.",
      signature: "A monocle-shaped sensor eye on the prow. An org-chart on the bridge that rewrites itself mid-engagement, promoting whoever's still alive. NDAs enforced via direct psychic assault. The Darkness Track loves this thing.",
      loadout: {
        frame: "War Rig Frame",
        weapons: ["Phase Disruptor", "Plasma Lance", "Resonance Howler"],
        systems: ["Reinforced Plating", "Phase Cloak", "Sensor Suite", "Comms Array"],
        outputs: ["Mounted Forge"]
      }
    }
  },
  {
    key: "flagship_valhauler",
    label: "Valhauler",
    description: "Valhaulan flagship. An aerial techno-Viking longship of dragon hide, sheet metal, and unconvincing optimism. Heavy · T2 · aerial.",
    defaults: {
      bracket: "heavy", mobility: "mobile", tier: 2, disposition: 0,
      integrity: 75,
      travel: { speed: 5, range: 18, hazardResist: 2 },
      capacity: { pilot: [1,2], gunner: [1,4], engineer: [0,2], crew: [4,12] },
      tags: "aerial, airship, pirate, raider, valhaulan, faction-flagship",
      resistances: "kinetic",
      vulnerabilities: "fire",
      concept: "An aerial techno-Viking longship, patched together from dragon hide, sheet metal, and unconvincing optimism. The Valhaulans raid, steal, trade, vanish, return, apologize, steal again — and then sell you your own stuff back at a markup. Part war-barge, part ValLyft ride-share, all enthusiasm and zero accountability.",
      signature: "Dragon-hide hull patches over a ValLyft livery painted over somebody else's raided sigil. Rigging tied by genuine knot-tying champions. The Mortar crew yells coordinates at each other and the math, sometimes, lands.",
      loadout: {
        frame: "War Rig Frame",
        weapons: ["Twin Autocannons", "Mortar Battery"],
        systems: ["Reinforced Plating", "Repair Bay", "Comms Array"],
        outputs: ["Quartermaster Dispenser"]
      }
    }
  }
];

function _esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function _factionOptions() {
  const factions = (game.actors?.contents ?? [])
    .filter(a => {
      try {
        return a.getFlag?.("bbttcc-factions", "isFaction")
          || a?.flags?.["bbttcc-factions"]?.isFaction
          || String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase() === "faction";
      } catch { return false; }
    })
    .map(a => ({ id: a.id, name: a.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return ['<option value="">— Unaffiliated —</option>']
    .concat(factions.map(f => `<option value="${f.id}">${_esc(f.name)}</option>`))
    .join("");
}

// Render the chassis chips for one category (default "rig"). The global index
// into CHASSIS_STARTERS is preserved on data-bbttcc-idx so _wireStarterChips
// can resolve the original entry regardless of which category it sits in.
function _starterChipsHTML(category = "rig") {
  return CHASSIS_STARTERS
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => (t.category ?? "rig") === category)
    .map(({ t, i }) => `
    <button type="button" class="ft-manifest-chip" data-bbttcc-starter="${_esc(t.key)}"
            data-bbttcc-idx="${i}" title="${_esc(t.description)}"
            style="cursor:pointer; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06);">
      ${_esc(t.label)}
    </button>`).join(" ");
}

// Render infrastructure chips dynamically from the bbttcc-structures recipe
// catalog, grouped by recipe.category. Clicking one selects a recipe to build
// through game.bbttcc.api.structures.recipes.build (see _commitInfrastructure).
function _infraChipsHTML() {
  const recipes = game.bbttcc?.api?.structures?.recipes?.list?.() ?? [];
  if (!recipes.length) {
    return `<div style="font-size:0.74rem; opacity:0.7; padding:0.4rem 0;">
      No structure recipes available — is the <code>bbttcc-structures</code> module active?
    </div>`;
  }
  const LABELS = {
    dwellings: "Dwellings", civic: "Civic & Market", utility: "Utility & Industrial",
    barriers: "Barriers & Cover", fortifications: "Fortifications", misc: "Other"
  };
  const groups = {};
  const order = [];
  for (const r of recipes) {
    const cat = r.category ?? "misc";
    if (!groups[cat]) { groups[cat] = []; order.push(cat); }
    groups[cat].push(r);
  }
  return order.map(cat => `
    <div style="width:100%;">
      <div style="font-size:0.6rem; letter-spacing:0.09em; text-transform:uppercase; opacity:0.5; margin:0.4rem 0 0.2rem;">${_esc(LABELS[cat] ?? cat)}</div>
      <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
        ${groups[cat].map(r => `
          <button type="button" class="ft-manifest-chip" data-bbttcc-recipe="${_esc(r.id)}"
                  title="${_esc(r.description ?? "")}"
                  style="cursor:pointer; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06);">
            ${_esc(r.name)}
          </button>`).join(" ")}
      </div>
    </div>`).join("");
}

/* Extract a field-level draft from a source Rig actor for duplicate flows.
 * Returns null if the actor isn't a rig. The returned object matches the
 * data-bbttcc-field keys the builder dialog uses, plus a `capacity` map of
 * per-role {min, max} pairs.
 */
export function rigSeedFromActor(actor) {
  if (!actor || actor.type !== "rig") return null;
  const sys = actor.system?.system ?? actor.system ?? {};
  const ident = sys.identity ?? {};
  const integ = sys.integrity ?? {};
  const defs  = sys.defenses ?? {};
  const travel = sys.travel ?? {};
  const cap = sys.crew?.capacity ?? {};
  const tagsArr = Array.isArray(sys.tags) ? sys.tags : [];
  return {
    name: `${actor.name} (Copy)`,
    archetype: String(ident.archetype ?? ""),
    factionOwnerId: String(ident.factionOwnerId ?? ""),
    bracket: String(integ.bracket ?? "medium"),
    tier: Number(integ.tier ?? 1),
    integrity: Number(integ.max ?? 30),
    mobility: String(ident.mobility ?? "mobile"),
    speed: Number(travel.speed ?? 3),
    range: Number(travel.range ?? 10),
    hazardResist: Number(travel.hazardResist ?? 0),
    resistances: (defs.resistances ?? []).join(", "),
    immunities: (defs.immunities ?? []).join(", "),
    vulnerabilities: (defs.vulnerabilities ?? []).join(", "),
    tags: tagsArr.join(", "),
    capacity: {
      pilot:    { min: Number(cap.pilot?.min ?? 0),    max: Number(cap.pilot?.max ?? 0) },
      gunner:   { min: Number(cap.gunner?.min ?? 0),   max: Number(cap.gunner?.max ?? 0) },
      engineer: { min: Number(cap.engineer?.min ?? 0), max: Number(cap.engineer?.max ?? 0) },
      crew:     { min: Number(cap.crew?.min ?? 0),     max: Number(cap.crew?.max ?? 0) }
    }
  };
}

export async function openRigBuilder({ seed = null } = {}) {
  const factionOpts = _factionOptions();
  const starterChipsRig = _starterChipsHTML("rig");
  const starterChipsFacility = _starterChipsHTML("facility");

  const bracketOpts = BRACKETS.map(b =>
    `<option value="${b.key}"${b.key === "medium" ? " selected" : ""}>${b.label} · base ${b.base}</option>`
  ).join("");

  const mobilityOpts = MOBILITIES.map(m =>
    `<option value="${m.key}"${m.key === "mobile" ? " selected" : ""}>${m.label}</option>`
  ).join("");

  const tierOpts = [1, 2, 3, 4].map(t =>
    `<option value="${t}"${t === 2 ? " selected" : ""}>Tier ${"I".repeat(t)}</option>`
  ).join("");

  // Capacity grid (4 roles × min/max).
  const capacityHTML = ["pilot", "gunner", "engineer", "crew"].map(role => `
    <div class="ft-cast-field">
      <label>${role.charAt(0).toUpperCase() + role.slice(1)} (min / max)</label>
      <div style="display:flex; gap:0.4rem;">
        <input type="number" data-bbttcc-cap-min="${role}" min="0" max="12" step="1"
               value="${role === "pilot" ? 1 : 0}" style="width:3.4rem; text-align:right;"/>
        <span style="opacity:0.6; align-self:center;">/</span>
        <input type="number" data-bbttcc-cap-max="${role}" min="0" max="12" step="1"
               value="${role === "pilot" ? 1 : (role === "crew" ? 4 : 2)}" style="width:3.4rem; text-align:right;"/>
      </div>
    </div>`).join("");

  const content = `
<div class="ft-cast-dialog ft-manifest-dialog bbttcc-rig-builder">
  <div class="ft-manifest-dialog-guide" style="border-color:#3e8ec8aa; background:rgba(62,142,200,0.08);">
    <div class="ft-manifest-dialog-title">Create Rig</div>
    <div class="ft-manifest-dialog-domain">Frame · Vehicle authoring</div>
    <div class="ft-manifest-dialog-copy">
      Three things live here. A <b>Rig</b> is a mobile chassis with crew slots.
      A <b>Facility</b> is a fixed emplacement bound to a hex. <b>Infrastructure</b>
      is breakable scenery — shacks, fences, sheds — that takes damage, breaches,
      and collapses when a rig rams through. Pick a category, pick a template.
    </div>
    <div class="bbttcc-rb-tabs" style="display:flex; gap:0.3rem; margin-top:0.55rem;">
      <button type="button" class="bbttcc-rb-tab" data-bbttcc-cat="rig">Rigs</button>
      <button type="button" class="bbttcc-rb-tab" data-bbttcc-cat="facility">Facilities</button>
      <button type="button" class="bbttcc-rb-tab" data-bbttcc-cat="infrastructure">Infrastructure</button>
    </div>
    <div class="ft-manifest-guide-body" data-bbttcc-chiprow="rig" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.45rem;">
      ${starterChipsRig}
    </div>
    <div class="ft-manifest-guide-body" data-bbttcc-chiprow="facility" style="display:none; flex-wrap:wrap; gap:0.35rem; margin-top:0.45rem;">
      ${starterChipsFacility}
    </div>
    <div data-bbttcc-chiprow="infrastructure" id="bbttcc-rb-infra-chips" style="display:none; margin-top:0.25rem;"></div>
    <ul class="ft-manifest-dialog-list" style="margin-top:0.4rem;">
      <li><b>Rig / Facility:</b> a template chip seeds bracket, mobility, capacity, and tags. Override anything afterwards.</li>
      <li>Bracket × Tier sets the integrity envelope; Guard/Evasion/Resolve derive from bracket at render time.</li>
      <li><b>Infrastructure:</b> a template builds a structure with a material bill — it has Plates, a Threshold, and a collapse profile. Flimsy by design.</li>
    </ul>
  </div>

  <div class="bbttcc-rb-pane" data-bbttcc-pane="rigform">
  <div class="ft-manifest-dialog-section" style="margin-top:0.6rem;">
    <div class="ft-prev-label">What is this rig?</div>
    <div class="ft-prev-align-note">Name it, name its archetype. Faction owner powers downstream territory + raid integration.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Name <span style="color:#f87171">*</span></label>
      <input type="text" data-bbttcc-field="name" required autofocus placeholder="e.g. Hex-Walker MK II"/></div>
    <div class="ft-cast-field"><label>Archetype</label>
      <input type="text" data-bbttcc-field="archetype" placeholder="e.g. Workhorse, Scout, Siege Engine"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Concept</label>
      <textarea data-bbttcc-field="concept" rows="2" placeholder="What is this rig in plain language? What is it for?"></textarea></div>
    <div class="ft-cast-field"><label>Faction Owner</label>
      <select data-bbttcc-field="factionOwnerId">${factionOpts}</select></div>
    <div class="ft-cast-field"><label>Token Disposition</label>
      <select data-bbttcc-field="disposition">
        <option value="-1">Hostile</option>
        <option value="0" selected>Neutral</option>
        <option value="1">Friendly</option>
        <option value="-2">Secret</option>
      </select></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">How is it built?</div>
    <div class="ft-prev-align-note">Bracket sets the integrity envelope; mobility decides how it moves. Override integrity if the bracket default is wrong.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Bracket</label>
      <select data-bbttcc-field="bracket">${bracketOpts}</select></div>
    <div class="ft-cast-field"><label>Tier</label>
      <select data-bbttcc-field="tier">${tierOpts}</select></div>
    <div class="ft-cast-field"><label>Mobility</label>
      <select data-bbttcc-field="mobility">${mobilityOpts}</select></div>
    <div class="ft-cast-field"><label>Integrity (Max)</label>
      <input type="number" data-bbttcc-field="integrity" value="30" min="1" step="1"/></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Who rides it?</div>
    <div class="ft-prev-align-note">Crew capacity by role. Min = required to operate; Max = how many fit. Set min:0 for optional roles.</div>
  </div>
  <div class="ft-cast-grid">
    ${capacityHTML}
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">How does it move?</div>
    <div class="ft-prev-align-note">Speed = hexes per travel action; Range = hex-band before refit. Hazard Resist offsets travel weather penalties.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Speed (hexes/action)</label>
      <input type="number" data-bbttcc-field="speed" value="3" min="0" max="12" step="1"/></div>
    <div class="ft-cast-field"><label>Range (hex-band)</label>
      <input type="number" data-bbttcc-field="range" value="10" min="0" max="100" step="1"/></div>
    <div class="ft-cast-field"><label>Hazard Resist</label>
      <input type="number" data-bbttcc-field="hazardResist" value="0" min="0" max="10" step="1"/></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Defenses, signature, ledger</div>
    <div class="ft-prev-align-note">Comma-separated damage tags. Signature is the strange detail that tells the crew this rig is them.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field ft-cast-span-2"><label>Resistances</label>
      <input type="text" data-bbttcc-field="resistances" placeholder="e.g. kinetic, fire"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Immunities</label>
      <input type="text" data-bbttcc-field="immunities" placeholder="e.g. radiation, fear"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Vulnerabilities</label>
      <input type="text" data-bbttcc-field="vulnerabilities" placeholder="e.g. lightning, sonic"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Tags</label>
      <input type="text" data-bbttcc-field="tags" placeholder="comma-separated, e.g. scout, fast, recon"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Signature / Third Thing</label>
      <input type="text" data-bbttcc-field="signature" placeholder="The strange detail that makes this rig unmistakable."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>GM Notes</label>
      <textarea data-bbttcc-field="gmNotes" rows="2" placeholder="Special rules, retrofits, history."></textarea></div>
  </div>

  <p style="opacity:0.7; font-size:0.78rem; margin:0.6rem 0 0;">
    After creation: open the sheet to add a frame item, mount weapons, drop in
    output modules, and station the rig as a Holding on a hex if it's a fixed
    deployment.
  </p>

  <!-- Hidden field tracks which chassis chip the user picked. Reading
       through the same data-bbttcc-field plumbing as the rest of the form
       avoids the dataset/jQuery-wrap discrepancy that caused the loadout
       seed to silently skip on first ship (2026-05-17 patch). -->
  <input type="hidden" data-bbttcc-field="_starterKey" value=""/>
  </div><!-- /[data-bbttcc-pane="rigform"] -->

  <div class="bbttcc-rb-pane" data-bbttcc-pane="infra" style="display:none;">
    <div class="ft-manifest-dialog-section" style="margin-top:0.6rem;">
      <div class="ft-prev-label">What are you raising?</div>
      <div class="ft-prev-align-note">Pick an infrastructure template above. These are breakable, drive-through structures — they take real damage, breach, and collapse. Owner is optional; leave it Unaffiliated to drop free GM scenery.</div>
    </div>
    <div class="ft-cast-grid">
      <div class="ft-cast-field ft-cast-span-2"><label>Name override</label>
        <input type="text" data-bbttcc-infra="name" placeholder="(default: template name)"/></div>
      <div class="ft-cast-field"><label>Owner / pay-from faction</label>
        <select data-bbttcc-infra="factionId">${factionOpts}</select></div>
      <div class="ft-cast-field"><label>Placement</label>
        <label style="display:flex; align-items:center; gap:0.4rem; font-weight:normal; margin-top:0.35rem;">
          <input type="checkbox" data-bbttcc-infra="dropToken" checked/> Drop token at view center
        </label></div>
      <div class="ft-cast-field ft-cast-span-2">
        <label style="display:flex; align-items:center; gap:0.4rem; font-weight:normal;">
          <input type="checkbox" data-bbttcc-infra="charge"/> Charge the owner faction's stockpile for the material bill (otherwise it's a free build)
        </label></div>
    </div>
    <div id="bbttcc-rb-infra-preview" style="margin-top:0.5rem;"></div>
  </div>
</div>`;

  const isDuplicate = !!seed;
  const dialogTitle = isDuplicate ? "Duplicate RFI Rig" : "Create RFI Rig";
  const buttonLabel = isDuplicate ? "Duplicate Rig" : "Create Rig";

  return new Promise((resolve) => {
    const dlg = new Dialog({
      title: dialogTitle,
      content,
      buttons: {
        create: {
          icon: "<i class='fas fa-cogs'></i>",
          label: buttonLabel,
          callback: async (html) => {
            const root = (html instanceof HTMLElement ? html : html[0]);
            const actor = await _commit(root);
            resolve(actor);
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "create",
      render: (html) => {
        const root = (html instanceof HTMLElement ? html : html[0]);
        // Inject infrastructure chips from the live structures recipe catalog.
        const infraHost = root?.querySelector("#bbttcc-rb-infra-chips");
        if (infraHost) infraHost.innerHTML = _infraChipsHTML();
        // A duplicated actor is always a rig/facility; open on the matching tab.
        if (root) root.dataset.bbttccCategory = (seed?.mobility === "stationary") ? "facility" : "rig";
        _wireStarterChips(html);
        _wireInfraChips(root);
        _wireCategoryTabs(html);
        _updateInfraPreview(root);
        if (seed) _applySeed(html, seed);
      }
    }, {
      classes: ["fourththing", "ft-manifestation-wizard-window", "bbttcc-rig-builder-window"],
      width: 760,
      height: 820,
      resizable: true
    });
    dlg.render(true);
  });
}

function _applySeed(html, seed) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root || !seed) return;
  const set = (name, val) => {
    if (val == null) return;
    const el = root.querySelector(`[data-bbttcc-field="${name}"]`);
    if (el) el.value = val;
  };
  for (const k of [
    "name", "archetype", "factionOwnerId", "bracket", "tier", "integrity",
    "mobility", "speed", "range", "hazardResist",
    "resistances", "immunities", "vulnerabilities", "tags",
    "concept", "signature", "gmNotes", "disposition"
  ]) {
    if (seed[k] !== undefined) set(k, seed[k]);
  }
  if (seed.capacity && typeof seed.capacity === "object") {
    for (const role of ["pilot", "gunner", "engineer", "crew"]) {
      const c = seed.capacity[role];
      if (!c) continue;
      const minEl = root.querySelector(`[data-bbttcc-cap-min="${role}"]`);
      const maxEl = root.querySelector(`[data-bbttcc-cap-max="${role}"]`);
      if (minEl && c.min != null) minEl.value = Number(c.min) || 0;
      if (maxEl && c.max != null) maxEl.value = Number(c.max) || 0;
    }
  }
}

function _wireStarterChips(html) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root) return;
  root.querySelectorAll("[data-bbttcc-starter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.bbttccIdx);
      const tpl = CHASSIS_STARTERS[idx];
      if (!tpl) return;
      // Track selected starter so _commit can pull its loadout for seeding.
      // Write to BOTH a hidden input (read through the form harvest path)
      // AND the root dataset (defense in depth). The hidden input is the
      // canonical source; dataset is fallback for legacy callers.
      const starterKeyEl = root.querySelector('[data-bbttcc-field="_starterKey"]');
      if (starterKeyEl) starterKeyEl.value = String(tpl.key);
      root.dataset.bbttccSelectedStarter = String(tpl.key);
      const d = tpl.defaults;
      const set = (name, val) => {
        const el = root.querySelector(`[data-bbttcc-field="${name}"]`);
        if (el && val != null) el.value = val;
      };
      set("archetype", tpl.label);
      set("bracket", d.bracket);
      set("mobility", d.mobility);
      set("tier", d.tier);
      set("tags", d.tags ?? "");
      // Flagship chips carry their full character. set() no-ops on undefined,
      // so these only apply when a chip actually defines them — the basic
      // chassis chips leave any GM-typed defenses/prose untouched. (2026-05-23)
      set("resistances", d.resistances);
      set("immunities", d.immunities);
      set("vulnerabilities", d.vulnerabilities);
      set("concept", d.concept);
      set("signature", d.signature);
      set("disposition", d.disposition);
      set("hazardResist", d.travel?.hazardResist);
      // Integrity prefills from bracket base × tier unless the chip pins an
      // explicit value (flagships do, to match their seed-macro sizing).
      const brk = BRACKETS.find(b => b.key === d.bracket);
      if (d.integrity != null) set("integrity", d.integrity);
      if (brk) {
        if (d.integrity == null) set("integrity", brk.base + (d.tier - 1) * Math.round(brk.base * 0.3));
        set("speed", d.travel?.speed ?? brk.speed);
        set("range", d.travel?.range ?? brk.range);
      }
      // Capacity
      for (const role of ["pilot", "gunner", "engineer", "crew"]) {
        const [mn, mx] = d.capacity?.[role] ?? [0, 0];
        const minEl = root.querySelector(`[data-bbttcc-cap-min="${role}"]`);
        const maxEl = root.querySelector(`[data-bbttcc-cap-max="${role}"]`);
        if (minEl) minEl.value = mn;
        if (maxEl) maxEl.value = mx;
      }
      root.querySelectorAll("[data-bbttcc-starter]").forEach(b => {
        b.style.background = b === btn ? "rgba(62,142,200,0.22)" : "rgba(255,255,255,0.06)";
      });
    });
  });
}

/* Wire the Rigs / Facilities / Infrastructure category tabs. Switching a tab
 * swaps the visible chip row + form pane, retitles the guide domain line, and
 * relabels the footer create button. The active category is stashed on
 * root.dataset.bbttccCategory, which _commit reads to route on submit. */
function _wireCategoryTabs(html) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root) return;
  const DOMAINS = {
    rig: "Frame · Vehicle authoring",
    facility: "Emplacement · Facility authoring",
    infrastructure: "Scenery · Breakable infrastructure"
  };
  const BTN_LABELS = { rig: "Create Rig", facility: "Create Facility", infrastructure: "Build Structure" };
  const activeCss = "cursor:pointer; padding:0.25rem 0.75rem; border:1px solid #3e8ec8; border-radius:4px; font-size:0.8rem; background:rgba(62,142,200,0.28); color:inherit;";
  const idleCss   = "cursor:pointer; padding:0.25rem 0.75rem; border:1px solid rgba(255,255,255,0.18); border-radius:4px; font-size:0.8rem; background:rgba(255,255,255,0.06); color:inherit;";

  const setCat = (cat) => {
    root.dataset.bbttccCategory = cat;
    root.querySelectorAll(".bbttcc-rb-tab").forEach(t => {
      t.style.cssText = (t.dataset.bbttccCat === cat) ? activeCss : idleCss;
    });
    root.querySelectorAll("[data-bbttcc-chiprow]").forEach(r => {
      const on = r.dataset.bbttccChiprow === cat;
      r.style.display = on ? (cat === "infrastructure" ? "block" : "flex") : "none";
    });
    root.querySelectorAll("[data-bbttcc-pane]").forEach(p => {
      const isInfra = p.dataset.bbttccPane === "infra";
      p.style.display = ((cat === "infrastructure") === isInfra) ? "block" : "none";
    });
    const dom = root.querySelector(".ft-manifest-dialog-domain");
    if (dom) dom.textContent = DOMAINS[cat] ?? "";
    // Facilities are stationary — reflect that in the (hidden-but-submitted) field.
    if (cat === "facility") {
      const mob = root.querySelector('[data-bbttcc-field="mobility"]');
      if (mob) mob.value = "stationary";
    }
    // Relabel the footer button, preserving its icon.
    const dlgRoot = root.closest(".app, .application, .window-app, .dialog");
    const btn = dlgRoot?.querySelector('.dialog-buttons button[data-button="create"], .dialog-buttons button.create');
    if (btn) {
      const icon = btn.querySelector("i")?.outerHTML ?? "<i class='fas fa-cogs'></i>";
      btn.innerHTML = `${icon} ${BTN_LABELS[cat] ?? "Create"}`;
    }
  };

  root.querySelectorAll(".bbttcc-rb-tab").forEach(tab => {
    tab.addEventListener("click", () => setCat(tab.dataset.bbttccCat));
  });
  setCat(root.dataset.bbttccCategory || "rig");
}

/* Wire infrastructure recipe chips + the inputs that affect the cost preview. */
function _wireInfraChips(root) {
  if (!root) return;
  root.querySelectorAll("[data-bbttcc-recipe]").forEach(btn => {
    btn.addEventListener("click", () => {
      root.dataset.bbttccRecipeId = String(btn.dataset.bbttccRecipe || "");
      root.querySelectorAll("[data-bbttcc-recipe]").forEach(b => {
        b.style.background = b === btn ? "rgba(62,142,200,0.22)" : "rgba(255,255,255,0.06)";
      });
      _updateInfraPreview(root);
    });
  });
  root.querySelectorAll('[data-bbttcc-infra="factionId"], [data-bbttcc-infra="charge"]').forEach(el => {
    el.addEventListener("change", () => _updateInfraPreview(root));
  });
}

/* Render the material-bill + footprint preview for the selected structure
 * recipe. Mirrors the build-structure macro's cost preview; the "In stockpile"
 * column only populates when a faction is selected AND charging is enabled. */
function _updateInfraPreview(root) {
  const box = root?.querySelector("#bbttcc-rb-infra-preview");
  if (!box) return;
  const api = game.bbttcc?.api?.structures;
  const recipeId = String(root.dataset.bbttccRecipeId || "");
  const recipe = api?.recipes?.byId?.(recipeId) ?? null;
  if (!recipe) {
    box.innerHTML = `<div style="font-size:0.74rem; opacity:0.6; border-top:1px dotted #3a3528; padding-top:6px;">Pick a template above to preview its material bill and footprint.</div>`;
    return;
  }
  const factionId = root.querySelector('[data-bbttcc-infra="factionId"]')?.value || "";
  const charge = !!root.querySelector('[data-bbttcc-infra="charge"]')?.checked;
  const faction = factionId ? game.actors?.get?.(factionId) : null;
  const stock = game.bbttcc?.api?.factions?.stockpile;
  const showHave = charge && faction && stock?.qty;

  const rows = (recipe.materialOf ?? []).map(c => {
    const have = showHave ? (stock.qty(faction, c.key) ?? 0) : null;
    const short = have != null && have < c.qty;
    const haveColor = have == null ? "#777" : (short ? "#e08a3a" : "#c9bc92");
    return `<tr style="font-size:0.72rem">
      <td style="padding:1px 6px">${_esc(c.key)}</td>
      <td style="padding:1px 6px; text-align:right; font-family:monospace">${c.qty}</td>
      <td style="padding:1px 6px; text-align:right; font-family:monospace; color:${haveColor}">${have == null ? "—" : have}</td>
    </tr>`;
  }).join("");

  const fp = recipe.footprintGrid ?? { w: 1, h: 1 };
  let status;
  if (charge && faction && api?.recipes?.canAfford) {
    const aff = api.recipes.canAfford(faction, recipe.materialOf);
    status = aff.ok
      ? `<div style="font-size:0.7rem; color:#7cc77c; margin-top:4px;">✓ ${_esc(faction.name)}'s stockpile can cover this</div>`
      : `<div style="font-size:0.7rem; color:#e08a3a; margin-top:4px;">✗ short on ${aff.missing.length} material(s)</div>`;
  } else {
    status = `<div style="font-size:0.7rem; opacity:0.6; margin-top:4px;">Free build — no stockpile charge.</div>`;
  }

  box.innerHTML = `
    <div style="border-top:1px dotted #3a3528; padding-top:6px;">
      <div style="font-size:0.82rem; color:#d9c47a;">${_esc(recipe.name)} · ${fp.w}×${fp.h} grid</div>
      <p style="margin:3px 0 5px 0; font-size:0.74rem; opacity:0.82">${_esc(recipe.description ?? "")}</p>
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr style="opacity:0.55; font-size:0.6rem">
          <th style="text-align:left; padding:2px 6px">Material</th>
          <th style="text-align:right; padding:2px 6px">Need</th>
          <th style="text-align:right; padding:2px 6px">In stockpile</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${status}
      <div style="margin-top:5px; font-size:0.68rem; opacity:0.62; font-style:italic;">Breakable structure — takes damage, breaches, and collapses when a rig rams through.${recipe.specialNote ? " " + _esc(recipe.specialNote) : ""}</div>
    </div>`;
}

/* Build an infrastructure structure through the bbttcc-structures recipe
 * engine. Returns the created structure actor (a stationary type:"rig" with a
 * stamped BOM) or null. Ownerless / unaffiliated builds are always free. */
async function _commitInfrastructure(root) {
  const api = game.bbttcc?.api?.structures;
  if (!api?.recipes?.build) {
    ui.notifications?.error?.("bbttcc-structures recipe API not loaded — cannot build infrastructure.");
    return null;
  }
  const recipeId = String(root.dataset.bbttccRecipeId || "");
  if (!recipeId) {
    ui.notifications?.warn?.("Pick an infrastructure template first.");
    return null;
  }
  const recipe = api.recipes.byId(recipeId);
  if (!recipe) {
    ui.notifications?.warn?.("That template is no longer available.");
    return null;
  }

  const nameOverride = String(root.querySelector('[data-bbttcc-infra="name"]')?.value || "").trim() || undefined;
  const factionId = String(root.querySelector('[data-bbttcc-infra="factionId"]')?.value || "");
  const charge = !!root.querySelector('[data-bbttcc-infra="charge"]')?.checked;
  const dropToken = !!root.querySelector('[data-bbttcc-infra="dropToken"]')?.checked;
  const faction = factionId ? game.actors?.get?.(factionId) : null;

  if (charge && !faction) {
    ui.notifications?.warn?.("Choose an owner faction to charge, or uncheck the stockpile-charge box.");
    return null;
  }
  // No faction (or charging disabled) ⇒ free build that bypasses the stockpile.
  const skipCostCheck = !charge || !faction;

  let dropPosition = null;
  if (dropToken && canvas?.scene) {
    const center = canvas.stage?.toLocal?.(new PIXI.Point(window.innerWidth / 2, window.innerHeight / 2)) ?? null;
    if (center) dropPosition = { x: center.x, y: center.y };
  }

  const res = await api.recipes.build(recipeId, faction, { actorName: nameOverride, dropPosition, skipCostCheck });
  if (!res?.ok) {
    const missing = (res?.missing ?? []).map(m => `${m.name} (need ${m.need}, have ${m.have})`).join(", ");
    ui.notifications?.error?.(`${res?.error ?? "Build failed"}${missing ? " — " + missing : ""}`);
    return null;
  }

  // Stamp builder provenance + entityKind so downstream tooling recognises
  // builder-made infrastructure (parity with the rig/facility commit path).
  try {
    await res.actor?.setFlag?.(MOD, "entityKind", "infrastructure");
    await res.actor?.setFlag?.(MOD, "createdViaRigBuilder", true);
  } catch (_e) { /* non-fatal */ }

  res.actor?.sheet?.render?.(true);
  ui.notifications?.info?.(`Built infrastructure: ${res.actor?.name}${res.token ? " (token placed)" : ""}.`);
  return res.actor;
}

async function _commit(root) {
  if (!root) return null;

  // Three-category router: infrastructure goes through the structures recipe
  // engine; rig + facility share the chassis form below (facility just locks
  // mobility to stationary and stamps a distinct entityKind).
  const category = String(root.dataset.bbttccCategory || "rig");
  if (category === "infrastructure") return _commitInfrastructure(root);

  const read = (name) => root.querySelector(`[data-bbttcc-field="${name}"]`)?.value ?? "";
  const readNum = (name, fallback = 0) => {
    const v = Number(read(name));
    return Number.isFinite(v) ? v : fallback;
  };
  const csv = (name) => String(read(name) || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const name = String(read("name") || "").trim();
  if (!name) {
    ui.notifications?.warn?.("RFI Rig needs a name.");
    return null;
  }

  const bracket = String(read("bracket") || "medium");
  const bracketDef = BRACKETS.find(b => b.key === bracket) ?? BRACKETS[2];
  const tier = Math.max(1, Math.min(4, readNum("tier", 1)));
  const integrityMax = Math.max(1, readNum("integrity", bracketDef.base));
  // Facilities are stationary by definition; the form value is a hint at best.
  const mobility = (category === "facility") ? "stationary" : String(read("mobility") || "mobile");
  const archetype = String(read("archetype") || "").trim();
  const factionOwnerId = String(read("factionOwnerId") || "").trim();
  const disposition = Number(read("disposition") ?? 0);

  const speed = Math.max(0, readNum("speed", bracketDef.speed));
  const range = Math.max(0, readNum("range", bracketDef.range));
  const hazardResist = Math.max(0, readNum("hazardResist", 0));

  const tags = csv("tags");
  const resistances = csv("resistances");
  const immunities = csv("immunities");
  const vulnerabilities = csv("vulnerabilities");

  const signature = String(read("signature") || "").trim();
  const gmNotes = String(read("gmNotes") || "").trim();
  const concept = String(read("concept") || "").trim();

  // Capacity grid.
  const capacity = {};
  let crewMinTotal = 0;
  let crewMaxTotal = 0;
  for (const role of ["pilot", "gunner", "engineer", "crew"]) {
    const mn = Math.max(0, Number(root.querySelector(`[data-bbttcc-cap-min="${role}"]`)?.value ?? 0) || 0);
    const mx = Math.max(mn, Number(root.querySelector(`[data-bbttcc-cap-max="${role}"]`)?.value ?? 0) || 0);
    capacity[role] = { min: mn, max: mx };
    crewMinTotal += mn;
    crewMaxTotal += mx;
  }

  const data = {
    name,
    type: "rig",
    flags: {
      [MOD]: {
        entityKind: (category === "facility") ? "facility" : "rig",
        createdViaRigBuilder: true,
        createdAt: Date.now()
      }
    },
    system: {
      identity: {
        mobility,
        state: "parked",
        factionOwnerId,
        archetype,
        binding: { hexId: "", sceneId: "", tokenId: "" }
      },
      crew: {
        slots: [],
        capacity,
        crewMin: crewMinTotal,
        crewMax: crewMaxTotal
      },
      integrity: {
        value: integrityMax,
        max: integrityMax,
        tier,
        bracket
      },
      defenses: { resistances, immunities, vulnerabilities },
      output: { modules: [], basePerTurn: {} },
      travel: { speed, range, hazardResist },
      tags
    },
    prototypeToken: {
      actorLink: true,
      disposition
    }
  };

  if (factionOwnerId) {
    data.flags["bbttcc-factions"] = { factionId: factionOwnerId };
  }

  const descParts = [];
  if (concept)   descParts.push(`<p><strong>Concept.</strong> ${_esc(concept)}</p>`);
  if (signature) descParts.push(`<p><strong>Signature.</strong> ${_esc(signature)}</p>`);
  if (gmNotes)   descParts.push(`<p><em>GM Notes.</em> ${_esc(gmNotes)}</p>`);
  if (descParts.length) {
    foundry.utils.setProperty(data, "system.details.biography", { value: descParts.join("\n"), public: "" });
    foundry.utils.setProperty(data, "system.description", descParts.join("\n"));
  }

  let actor;
  try {
    actor = await Actor.create(data);
  } catch (err) {
    console.error("[bbttcc-auto-link/rig-builder] Actor.create failed", err);
    ui.notifications?.error?.(`Failed to create RFI Rig: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  // B13.D Phase C — 2026-05-17. Seed embedded frame/weapons/systems from
  // the selected starter chip's loadout (if any). Pulls from the
  // bbttcc-master-content.items compendium by name, or synthesizes the
  // frame inline when the loadout declares a `frame` object instead of a
  // string. Failure is non-fatal — the rig still mints, just bare.
  // Source of truth for the selected key is the _starterKey hidden input
  // (read through the same form harvest as every other field); dataset
  // is fallback for safety.
  const selectedKey = String(read("_starterKey") || root.dataset.bbttccSelectedStarter || "");
  const chosen = CHASSIS_STARTERS.find(s => s.key === selectedKey);
  const loadout = chosen?.defaults?.loadout;
  console.log("[bbttcc-auto-link/rig-builder] commit",
    { actorId: actor?.id, selectedKey, hasLoadout: !!loadout,
      loadoutKeys: loadout ? Object.keys(loadout) : [] });
  if (loadout) {
    try {
      await _seedLoadout(actor, loadout, { tier });
    } catch (e) {
      console.warn("[bbttcc-auto-link/rig-builder] Loadout seed failed (non-fatal):", e);
    }
  } else if (selectedKey) {
    console.warn(`[bbttcc-auto-link/rig-builder] Starter chip '${selectedKey}' had no loadout — rig minted bare.`);
  }

  actor.sheet?.render(true);
  const loadoutHint = loadout
    ? ` — seeded ${[loadout.frame ? "frame" : null,
                    (loadout.weapons?.length ? `${loadout.weapons.length} weapon(s)` : null),
                    (loadout.systems?.length ? `${loadout.systems.length} system(s)` : null)]
                     .filter(Boolean).join(", ")}`
    : "";
  const kindLabel = (category === "facility") ? "Facility" : "RFI Rig";
  ui.notifications?.info?.(`Created ${kindLabel}: ${actor.name} (tier ${tier}, ${bracketDef.label}, ${mobility})${loadoutHint}`);
  return actor;
}

/* Seed embedded frame + weapons + systems on a newly-minted rig from a
 * chassis loadout. Looks up named items in the `bbttcc-master-content.items`
 * compendium; if a `frame` field is an object (not a string), builds it
 * synthetically inline (used for personal-bracket frames that aren't in the
 * canonical 5-frame catalog, e.g. Hexmobile).
 */
async function _seedLoadout(actor, loadout, { tier = 1 } = {}) {
  if (!actor || !loadout) return;
  const TAG = "[bbttcc-auto-link/rig-builder/_seedLoadout]";
  const PACK_ID = "bbttcc-master-content.items";
  const pack = game.packs?.get?.(PACK_ID);
  if (!pack && (typeof loadout.frame === "string" || loadout.weapons?.length || loadout.systems?.length)) {
    console.warn(TAG, `Compendium pack '${PACK_ID}' not found — only synthetic frame (if any) will be created.`);
  }
  const idx = pack ? await pack.getIndex() : null;
  const itemsToCreate = [];

  // Frame: either a compendium name lookup, or a synthetic spec object.
  if (loadout.frame) {
    if (typeof loadout.frame === "string") {
      const hit = idx?.find?.(e => e.name === loadout.frame);
      if (hit) {
        const doc = await pack.getDocument(hit._id);
        const data = doc?.toObject?.();
        if (data) { delete data._id; itemsToCreate.push(data); }
      } else {
        console.warn(TAG, `Frame not found in compendium: ${loadout.frame}`);
      }
    } else if (typeof loadout.frame === "object") {
      itemsToCreate.push(_buildSyntheticFrame(loadout.frame));
    }
  }

  // Weapons + systems — by-name lookup in compendium. Failure to find any
  // single item is non-fatal; we just skip it.
  const namedItems = [
    ...(loadout.weapons ?? []),
    ...(loadout.systems ?? []),
    ...(loadout.outputs ?? [])
  ];
  if (namedItems.length && idx) {
    for (const name of namedItems) {
      const hit = idx.find(e => e.name === name);
      if (!hit) {
        console.warn(TAG, `Loadout item not found in compendium: ${name}`);
        continue;
      }
      const doc = await pack.getDocument(hit._id);
      const data = doc?.toObject?.();
      if (data) { delete data._id; itemsToCreate.push(data); }
    }
  }

  console.log(TAG, "preparing to embed",
    { count: itemsToCreate.length, names: itemsToCreate.map(i => i.name) });

  if (itemsToCreate.length) {
    const created = await actor.createEmbeddedDocuments("Item", itemsToCreate);
    console.log(TAG, "embedded",
      { count: created?.length ?? 0, ids: (created ?? []).map(d => d.id) });
  }
}

/* Build a synthetic rig-frame Item from an inline spec. Used when the
 * loadout doesn't reference a canonical catalog frame (e.g. personal-bracket
 * frames that don't exist in bbttcc-master-content yet). Stamps the same
 * shape the catalog macro stamps: type:"gear" + flags.fourththing.rigGear +
 * flags.fourththing.rigFrame.
 */
function _buildSyntheticFrame(spec) {
  return {
    name: spec.synthName ?? "Custom Frame",
    type: "gear",
    img: "icons/svg/oak.svg",
    system: {
      description: {
        value: `<p>Synthetic frame authored by the Rig Builder. Bracket: ${spec.bracket ?? "—"}. ${spec.pilotMount ? "Pilot Mount enabled — one pilot-fired weapon." : ""}</p>`,
        chat: ""
      }
    },
    flags: {
      fourththing: {
        rigGear: { subtype: "rig-frame" },
        rigFrame: {
          bracket: spec.bracket ?? "medium",
          baseIntegrity: Number(spec.baseIntegrity) || 30,
          tierStep: Number(spec.tierStep) || 0,
          pilotMount: !!spec.pilotMount,
          mobilityAllowed: Array.isArray(spec.mobilityAllowed) ? spec.mobilityAllowed : ["mobile"],
          slots: spec.slots ?? { weapon: 0, system: 0, output: 0 },
          capacity: spec.capacity ?? {},
          actions: spec.actions ?? {},
          travel: spec.travel ?? { speed: 0, range: 0 }
        }
      }
    }
  };
}

function _install() {
  globalThis.BBTTCC_RigBuilder = globalThis.BBTTCC_RigBuilder || {};
  globalThis.BBTTCC_RigBuilder.open = openRigBuilder;
  globalThis.BBTTCC_RigBuilder.seedFromActor = rigSeedFromActor;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.rigBuilder = { open: openRigBuilder, seedFromActor: rigSeedFromActor };
  } catch (_e) {}
}
_install();
Hooks.once("ready", _install);
