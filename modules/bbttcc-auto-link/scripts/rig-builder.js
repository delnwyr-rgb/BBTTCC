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
      tags: "personal, mount, rider"
    }
  },
  {
    key: "light_scout",
    label: "Light Scout",
    description: "Fast, fragile, high-evasion. Runs ahead of the line and reports.",
    defaults: {
      bracket: "light", mobility: "mobile", tier: 1,
      capacity: { pilot: [1,1], gunner: [0,1], engineer: [0,0], crew: [0,2] },
      tags: "scout, recon, fast"
    }
  },
  {
    key: "medium_workhorse",
    label: "Medium Workhorse",
    description: "Versatile mid-line chassis. Carries, fights, hauls.",
    defaults: {
      bracket: "medium", mobility: "mobile", tier: 2,
      capacity: { pilot: [1,1], gunner: [0,2], engineer: [0,1], crew: [0,4] },
      tags: "workhorse, line, hauler"
    }
  },
  {
    key: "heavy_combatant",
    label: "Heavy Combatant",
    description: "Armored bruiser. Trades speed for plating and weapon mounts.",
    defaults: {
      bracket: "heavy", mobility: "mobile", tier: 2,
      capacity: { pilot: [1,1], gunner: [1,3], engineer: [0,1], crew: [0,4] },
      tags: "armored, line-breaker, heavy"
    }
  },
  {
    key: "siege_engine",
    label: "Siege Engine",
    description: "Slow, immense, structural. Threatens fortifications and crowds.",
    defaults: {
      bracket: "siege", mobility: "mobile", tier: 3,
      capacity: { pilot: [1,2], gunner: [1,4], engineer: [1,2], crew: [2,8] },
      tags: "siege, structural, terror"
    }
  },
  {
    key: "stationary_battery",
    label: "Stationary Battery",
    description: "An emplacement. Doesn't move; threatens an arc. Bind to a hex.",
    defaults: {
      bracket: "medium", mobility: "stationary", tier: 2,
      capacity: { pilot: [0,1], gunner: [1,2], engineer: [0,1], crew: [0,2] },
      tags: "emplacement, battery, fixed"
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

function _starterChipsHTML() {
  return CHASSIS_STARTERS.map((t, i) => `
    <button type="button" class="ft-manifest-chip" data-bbttcc-starter="${_esc(t.key)}"
            data-bbttcc-idx="${i}" title="${_esc(t.description)}"
            style="cursor:pointer; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06);">
      ${_esc(t.label)}
    </button>`).join(" ");
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
  const starterChips = _starterChipsHTML();

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
      Bring a frame into the world. A rig is a chassis with crew slots — it can
      drive, fly, sail, or stand. Pick the chassis, set who rides where, and
      let the integrity envelope speak for the rest. Weapons, output modules,
      and frame items are added from the sheet after creation.
    </div>
    <div class="ft-manifest-guide-body" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.4rem;">
      ${starterChips}
    </div>
    <ul class="ft-manifest-dialog-list" style="margin-top:0.4rem;">
      <li>Pick a chassis chip above to seed bracket, mobility, capacity, and tags. Override anything afterwards.</li>
      <li>Bracket × Tier sets the integrity envelope; Guard/Evasion/Resolve derive from bracket at render time.</li>
      <li>Stationary chassis bind to a hex (emplacement, facility, battery). Mobile chassis can be deployed to a battle scene.</li>
    </ul>
  </div>

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
        _wireStarterChips(html);
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
      // Integrity prefills from bracket base × tier (caller can override).
      const brk = BRACKETS.find(b => b.key === d.bracket);
      if (brk) {
        set("integrity", brk.base + (d.tier - 1) * Math.round(brk.base * 0.3));
        set("speed", brk.speed);
        set("range", brk.range);
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

async function _commit(root) {
  if (!root) return null;
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
  const mobility = String(read("mobility") || "mobile");
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
        entityKind: "rig",
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

  actor.sheet?.render(true);
  ui.notifications?.info?.(`Created RFI Rig: ${actor.name} (tier ${tier}, ${bracketDef.label}, ${mobility})`);
  return actor;
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
