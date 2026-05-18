/* BBTTCC Auto-Link — RFI Boss Builder
 *
 * Sibling to npc-builder.js / monster-builder.js. Mints a type:"boss" actor
 * authored against the fourththing boss schema (identity / integrity / raid
 * profile / phase ladder / OP-stats / tags / defenses).
 *
 * Modeled on the Manifestation Creation Engine — single resizable panel with
 * a guide block at the top, starter chips that pre-fill the form, and a
 * two-column ft-cast-grid where narrative fields span both columns. Reuses
 * the .ft-manifestation-wizard-window CSS for visual + scroll parity.
 *
 * Starter chips read from `game.bbttcc.api.raid.bossTemplates` (BOSS_TEMPLATES,
 * 5 canonical archetypes) so authoring stays in lockstep with the boss-config
 * app + downstream raid console expectations.
 *
 * 2026-05-17 — B13 Builder UI sprint.
 */

const MOD = "bbttcc-auto-link";

const BRACKETS = [
  { key: "personal", label: "Personal",  base: 20 },
  { key: "light",    label: "Light",     base: 30 },
  { key: "medium",   label: "Medium",    base: 45 },
  { key: "heavy",    label: "Heavy",     base: 60 },
  { key: "siege",    label: "Siege",     base: 90 }
];

const RAID_MODES = [
  { key: "hybrid",    label: "Hybrid (mixed pressure)" },
  { key: "violence",  label: "Violence (force)" },
  { key: "intrigue",  label: "Intrigue (subterfuge)" },
  { key: "softpower", label: "Softpower (narrative)" }
];

const OP_KEYS = [
  "violence", "nonlethal", "intrigue", "economy", "softpower",
  "diplomacy", "logistics", "culture", "faith"
];

const OP_LABELS = {
  violence:  "Violence",
  nonlethal: "Nonlethal",
  intrigue:  "Intrigue",
  economy:   "Economy",
  softpower: "Softpower",
  diplomacy: "Diplomacy",
  logistics: "Logistics",
  culture:   "Culture",
  faith:     "Faith"
};

// B13.D Phase E — 2026-05-17. Boss loadouts mirror the rig loadout pattern.
// Each template-key (matching `game.bbttcc.api.raid.bossTemplates[].key`)
// declares the powers + protections that should be embedded on the newly-
// minted boss. The chip click prefills defenses into the visible form so
// the GM can edit them; powerPack + augments are seeded post-create.
//
//   powerPack — BOSS_POWER_PACK key from game.bbttcc.api.raid.bossPowerPacks.
//               Each pack's behaviors get applied to system.raidProfile.behaviorsRaw
//               (same logic as boss-sheet's ftBossPackApply handler).
//   augments  — BOSS_AUGMENT item names from the bbttcc-master-content.items
//               compendium (Phase 2 Surge Burst, Wrath Resistance, Final Roar,
//               Adaptive Defense, Eldritch Aura). Embedded via
//               createEmbeddedDocuments so they surface as clickable items
//               on the boss sheet's GM tab.
//   defenses  — Comma-joined strings written to the form's resistance /
//               immunity / vulnerability inputs at chip-click time so the GM
//               sees + can edit before commit.
const BOSS_LOADOUTS = {
  qliphothic_auditor: {
    powerPack: "audit_pack",
    augments: ["Eldritch Aura"],
    defenses: {
      resistances: "social-shame, intrigue, manipulation",
      immunities: "fear, charm",
      vulnerabilities: "true-name"
    },
    manifestations: [
      { name: "Audit Demand", tier: 2, intent: "intrigue", channel: "soul", sephirah: "binah",
        damageFormula: "2d6", damageType: "psychic", damageTrack: "stress",
        concept: "The ledger lifts a finger. The named one pays the asked-for debt — in clarity, in dignity, or in time.",
        effect: "Target makes a Soul defense (DC 14) or takes 2d6 stress and answers one question truthfully.",
        flavor: "Pages turn. The ink lifts off the paper and lands somewhere it shouldn't.",
        tags: ["audit", "psychic", "social"] },
      { name: "Cite Precedent", tier: 2, intent: "intrigue", channel: "mind", sephirah: "hod",
        concept: "An older ruling supersedes the one in play. The boss claims its citation and the players' last move is undone.",
        effect: "Cancels one player maneuver from this round. Single use until next phase.",
        flavor: "A page in some other book closes audibly. The room remembers it never opened.",
        tags: ["audit", "cancel", "phase-gated"] }
    ]
  },
  megafauna_apex: {
    powerPack: "finale_pack",
    augments: ["Wrath Resistance", "Phase 2 Surge Burst"],
    defenses: {
      resistances: "kinetic, fire",
      immunities: "",
      vulnerabilities: "lightning, sonic"
    },
    manifestations: [
      { name: "Charge", tier: 2, intent: "violence", channel: "body", sephirah: "geburah",
        damageFormula: "3d8", damageType: "kinetic", damageTrack: "integrity",
        concept: "Three tons of bone and weather move in a single line. Things in the way stop being in the way.",
        effect: "Move up to triple speed in a straight line. First target hit takes 3d8 kinetic and is pushed back.",
        flavor: "You hear it before you see it. By the time you see it, you should already be moving.",
        tags: ["charge", "kinetic", "push"] },
      { name: "Bellow", tier: 2, intent: "violence", channel: "soul", sephirah: "geburah",
        damageFormula: "2d6", damageType: "sonic", damageTrack: "stress",
        concept: "It roars. The roar is older than language. Hearing it is its own injury.",
        effect: "All targets within Near range make a Soul defense (DC 13) or take 2d6 stress and lose their next bonus action.",
        flavor: "Birds leave the trees three counties away.",
        tags: ["aoe", "morale", "sonic"] }
    ]
  },
  courtly_horror: {
    powerPack: "courtly_spiral_pack",
    augments: ["Adaptive Defense"],
    defenses: {
      resistances: "social, manipulation",
      immunities: "charm",
      vulnerabilities: "truth, exposure"
    },
    manifestations: [
      { name: "Honeyed Insult", tier: 2, intent: "intrigue", channel: "mind", sephirah: "tiferet",
        damageFormula: "2d6", damageType: "psychic", damageTrack: "stress",
        concept: "A compliment with a hook in it. The target feels seen and that is the wound.",
        effect: "Target makes a Mind defense (DC 14) or takes 2d6 stress and has disadvantage on their next social action.",
        flavor: "Everyone laughs. Almost everyone laughs.",
        tags: ["social", "insult", "stress"] },
      { name: "Veiled Threat", tier: 3, intent: "intrigue", channel: "soul", sephirah: "geburah",
        concept: "A perfectly polite sentence with a wire underneath it. The target understands what was promised.",
        effect: "Target loses 1 Morale and gains a Compromised condition until end of scene.",
        flavor: "Your tea is exactly the right temperature. Yours is not.",
        tags: ["social", "morale", "condition"] }
    ]
  },
  civic_idol: {
    powerPack: "despair_pack",
    augments: ["Eldritch Aura"],
    defenses: {
      resistances: "narrative, faith",
      immunities: "argument",
      vulnerabilities: "counter-narrative"
    },
    manifestations: [
      { name: "Sermon", tier: 2, intent: "presence", channel: "soul", sephirah: "chesed",
        damageFormula: "2d6", damageType: "radiant", damageTrack: "stress",
        concept: "The idol speaks. Words land in the chest like coins in a fountain.",
        effect: "All targets within Far range make a Soul defense (DC 14) or take 2d6 stress; faithful targets are exempt.",
        flavor: "You agree before you hear what was said.",
        tags: ["aoe", "morale", "narrative"] },
      { name: "Excommunicate", tier: 3, intent: "presence", channel: "soul", sephirah: "binah",
        concept: "The idol points. A single target is removed from the story it thought it was in.",
        effect: "Target loses access to one faction OP track until end of scene (GM picks).",
        flavor: "They are still standing here. Nobody sees them anymore.",
        tags: ["social", "narrative", "single-target"] }
    ]
  },
  feral_godling: {
    powerPack: "finale_pack",
    augments: ["Phase 2 Surge Burst", "Wrath Resistance", "Final Roar"],
    defenses: {
      resistances: "kinetic, qliphothic",
      immunities: "",
      vulnerabilities: "bound-true-name"
    },
    manifestations: [
      { name: "Eruption", tier: 3, intent: "violence", channel: "body", sephirah: "geburah",
        damageFormula: "4d8", damageType: "kinetic", damageTrack: "integrity",
        concept: "Reality breaks for a moment around the godling. Things nearby experience the break as damage.",
        effect: "Burst centered on the boss. All targets within Near make a Body defense (DC 15) or take 4d8 kinetic.",
        flavor: "The ground forgets what shape it was. Then remembers a worse one.",
        tags: ["aoe", "burst", "kinetic"] },
      { name: "Unmake", tier: 4, intent: "violence", channel: "soul", sephirah: "binah",
        damageFormula: "3d10", damageType: "qliphothic", damageTrack: "integrity",
        concept: "The godling decides a thing was never there. Most things resist this. Some do not.",
        effect: "Target makes a Soul defense (DC 16) or takes 3d10 qliphothic damage and gains Unmaking 1.",
        flavor: "You think you were here. You cannot say why you thought that.",
        tags: ["single-target", "qliphothic", "high-tier"] }
    ]
  }
};

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

function _bossTemplates() {
  const arr = game?.bbttcc?.api?.raid?.bossTemplates;
  return Array.isArray(arr) ? arr : [];
}

function _starterChipsHTML() {
  const tpls = _bossTemplates();
  if (!tpls.length) return "";
  return tpls.map((t, i) => `
    <button type="button" class="ft-manifest-chip" data-bbttcc-starter="${_esc(t.key)}"
            data-bbttcc-idx="${i}" title="${_esc(t.description || "")}"
            style="cursor:pointer; border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.06);">
      ${_esc(t.label)}
    </button>`).join(" ");
}

function _ladderPlaceholder() {
  return [
    "Wounded — body language shifts; +1 attack",
    "Enraged — drops doctrine, attacks twice",
    "Crippled — phase-three abilities unlock",
    "Slain — final defiance, then end"
  ].join("\n");
}

/* Extract a field-level draft from a source Boss actor for duplicate flows.
 * Returns null if the actor isn't a boss. The returned object matches the
 * data-bbttcc-field keys the builder dialog uses, plus an `opStats` map and
 * an explicit `name` that the caller can append " (Copy)" to.
 */
export function bossSeedFromActor(actor) {
  if (!actor || actor.type !== "boss") return null;
  const sys = actor.system?.system ?? actor.system ?? {};
  const ident = sys.identity ?? {};
  const integ = sys.integrity ?? {};
  const defs  = sys.defenses ?? {};
  const profile = sys.raidProfile ?? {};
  const ladder = Array.isArray(sys.phases?.ladder) ? sys.phases.ladder : [];
  const tagsArr = Array.isArray(sys.tags) ? sys.tags : [];
  return {
    name: `${actor.name} (Copy)`,
    archetype: String(ident.archetype ?? ""),
    factionId: String(ident.factionId ?? ""),
    bracket: String(integ.bracket ?? "heavy"),
    tier: Number(integ.tier ?? 1),
    integrity: Number(integ.max ?? 60),
    doctrine: String(sys.doctrine?.slot ?? ""),
    mode: String(profile.mode ?? "hybrid"),
    moraleHits: Number(profile.moraleHits ?? 4),
    hitTrack: String(profile.hitTrack ?? ""),
    resistances: (defs.resistances ?? []).join(", "),
    immunities: (defs.immunities ?? []).join(", "),
    vulnerabilities: (defs.vulnerabilities ?? []).join(", "),
    tags: tagsArr.join(", "),
    phaseLadder: ladder.map(p => p?.notes ? `${p.label} — ${p.notes}` : (p?.label ?? "")).filter(Boolean).join("\n"),
    opStats: { ...(profile.opStats ?? {}) }
  };
}

export async function openBossBuilder({ seed = null } = {}) {
  const factionOpts = _factionOptions();
  const starterChips = _starterChipsHTML();
  const tpls = _bossTemplates();

  const bracketOpts = BRACKETS.map(b =>
    `<option value="${b.key}"${b.key === "heavy" ? " selected" : ""}>${b.label} · base ${b.base}</option>`
  ).join("");

  const modeOpts = RAID_MODES.map(m =>
    `<option value="${m.key}"${m.key === "hybrid" ? " selected" : ""}>${m.label}</option>`
  ).join("");

  const tierOpts = [1, 2, 3, 4].map(t =>
    `<option value="${t}">Tier ${"I".repeat(t)}</option>`
  ).join("");

  const opGridHTML = OP_KEYS.map(k => `
    <div class="ft-cast-field" style="display:flex; align-items:center; gap:0.35rem;">
      <label style="flex:1 1 auto; margin-bottom:0; text-transform:none; opacity:1; font-size:0.78rem;">${OP_LABELS[k]}</label>
      <input type="number" data-bbttcc-op="${k}" value="0" min="0" max="20"
             style="width:3.2rem; text-align:right;"/>
    </div>`).join("");

  const content = `
<div class="ft-cast-dialog ft-manifest-dialog bbttcc-boss-builder">
  <div class="ft-manifest-dialog-guide" style="border-color:#c83e3eaa; background:rgba(200,62,62,0.08);">
    <div class="ft-manifest-dialog-title">Create Boss</div>
    <div class="ft-manifest-dialog-domain">Crucible · Antagonist authoring</div>
    <div class="ft-manifest-dialog-copy">
      Bring an antagonist into the world. Start with what they are, what they
      threaten with, and what makes them strange. The phase ladder and OP grid
      can be tuned later — the only thing this dialog needs from you is enough
      definition to make a first encounter playable.
    </div>
    <div class="ft-manifest-guide-body" style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.4rem;">
      ${starterChips || '<span class="ft-prev-align-note" style="opacity:0.7;">Boss templates not loaded — author from scratch below.</span>'}
    </div>
    <ul class="ft-manifest-dialog-list" style="margin-top:0.4rem;">
      <li>Pick a starter chip above to seed mode, hit-track, and OP stats. You can edit anything afterwards.</li>
      <li>Tier × Bracket sets the integrity envelope — defenses (Guard/Evasion/Resolve) derive at render time.</li>
      <li>Phase Ladder: one phase per line. The first phase is the entrance state; the last is the exit.</li>
    </ul>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.6rem;">
    <div class="ft-prev-label">Who is this?</div>
    <div class="ft-prev-align-note">Name them, name what they are. Faction is optional but powers downstream raid OP routing.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Name <span style="color:#f87171">*</span></label>
      <input type="text" data-bbttcc-field="name" required autofocus placeholder="e.g. The Hollow Voice"/></div>
    <div class="ft-cast-field"><label>Archetype</label>
      <input type="text" data-bbttcc-field="archetype" placeholder="e.g. Qliphothic Auditor, Feral Godling"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Concept</label>
      <textarea data-bbttcc-field="concept" rows="2" placeholder="What is this antagonist in plain language? What changes in the world by their existence?"></textarea></div>
    <div class="ft-cast-field"><label>Faction</label>
      <select data-bbttcc-field="factionId">${factionOpts}</select></div>
    <div class="ft-cast-field"><label>Token Disposition</label>
      <select data-bbttcc-field="disposition">
        <option value="-1" selected>Hostile</option>
        <option value="0">Neutral</option>
        <option value="1">Friendly</option>
        <option value="-2">Secret</option>
      </select></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">How does it stand?</div>
    <div class="ft-prev-align-note">Bracket sets the integrity envelope; tier scales everything else. Override the integrity number if the bracket default is wrong for the encounter.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Bracket</label>
      <select data-bbttcc-field="bracket">${bracketOpts}</select></div>
    <div class="ft-cast-field"><label>Tier</label>
      <select data-bbttcc-field="tier">${tierOpts}</select></div>
    <div class="ft-cast-field"><label>Integrity (Max)</label>
      <input type="number" data-bbttcc-field="integrity" value="60" min="1" step="1"/></div>
    <div class="ft-cast-field"><label>Doctrine Slot</label>
      <input type="text" data-bbttcc-field="doctrine" placeholder="e.g. Predator's Patience"/></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">How is it brought down?</div>
    <div class="ft-prev-align-note">Raid Mode picks the resolution pressure. Hit Track is the narrative ladder players reveal as they wear it down — commas separate steps.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field"><label>Raid Mode</label>
      <select data-bbttcc-field="mode">${modeOpts}</select></div>
    <div class="ft-cast-field"><label>Morale Hits</label>
      <input type="number" data-bbttcc-field="moraleHits" value="4" min="1" max="12" step="1"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Hit Track (comma-separated steps)</label>
      <input type="text" data-bbttcc-field="hitTrack" placeholder="e.g. wounded, enraged, crippled, slain"/></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">What does it threaten with?</div>
    <div class="ft-prev-align-note">OP stats feed the per-faculty raid math. Leave any pool at 0 if the boss has no purchase there.</div>
  </div>
  <div class="ft-cast-grid" style="grid-template-columns: 1fr 1fr 1fr;">
    ${opGridHTML}
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Phase Ladder</div>
    <div class="ft-prev-align-note">One phase per line — "Label — what changes". The first line is the entrance; the last is the exit. Leave blank to derive a default from the hit track.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field ft-cast-span-2"><label>Ladder (one phase per line)</label>
      <textarea data-bbttcc-field="phaseLadder" rows="4" placeholder="${_esc(_ladderPlaceholder())}"></textarea></div>
  </div>

  <div class="ft-manifest-dialog-section" style="margin-top:0.7rem;">
    <div class="ft-prev-label">Defenses, signature, ledger</div>
    <div class="ft-prev-align-note">Comma-separated damage tags. Signature is the one strange detail that tells the table this is them and not a generic monster.</div>
  </div>
  <div class="ft-cast-grid">
    <div class="ft-cast-field ft-cast-span-2"><label>Resistances</label>
      <input type="text" data-bbttcc-field="resistances" placeholder="e.g. cold, kinetic, social-shame"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Immunities</label>
      <input type="text" data-bbttcc-field="immunities" placeholder="e.g. fear, poison"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Vulnerabilities</label>
      <input type="text" data-bbttcc-field="vulnerabilities" placeholder="e.g. fire, radiant, true-name"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Tags</label>
      <input type="text" data-bbttcc-field="tags" placeholder="comma-separated, e.g. courtly, horror, influence"/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>Signature / Third Thing</label>
      <input type="text" data-bbttcc-field="signature" placeholder="The one strange detail that makes this boss unmistakable."/></div>
    <div class="ft-cast-field ft-cast-span-2"><label>GM Notes</label>
      <textarea data-bbttcc-field="gmNotes" rows="2" placeholder="Triggers, contingencies, scenario calibration. Free-form."></textarea></div>
  </div>

  <p style="opacity:0.7; font-size:0.78rem; margin:0.6rem 0 0;">
    After creation: open the sheet to seed manifestations, refine the phase ladder,
    and station this boss as a Holding on a hex if it's a fixed encounter.
  </p>

  <!-- Hidden field tracks which starter template the user picked. Read
       through the same data-bbttcc-field plumbing as the rest of the form
       to avoid dataset/jQuery-wrap discrepancies (see rig-builder.js for
       the same pattern + history). -->
  <input type="hidden" data-bbttcc-field="_templateKey" value=""/>
</div>`;

  const isDuplicate = !!seed;
  const dialogTitle = isDuplicate ? "Duplicate RFI Boss" : "Create RFI Boss";
  const buttonLabel = isDuplicate ? "Duplicate Boss" : "Create Boss";

  return new Promise((resolve) => {
    const dlg = new Dialog({
      title: dialogTitle,
      content,
      buttons: {
        create: {
          icon: "<i class='fas fa-crown'></i>",
          label: buttonLabel,
          callback: async (html) => {
            const root = (html instanceof HTMLElement ? html : html[0]);
            const actor = await _commit(root, tpls);
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
        _wireStarterChips(html, tpls);
        if (seed) _applySeed(html, seed);
      }
    }, {
      classes: ["fourththing", "ft-manifestation-wizard-window", "bbttcc-boss-builder-window"],
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
    "name", "archetype", "factionId", "bracket", "tier", "integrity",
    "doctrine", "mode", "moraleHits", "hitTrack",
    "resistances", "immunities", "vulnerabilities", "tags", "phaseLadder",
    "concept", "signature", "gmNotes", "disposition"
  ]) {
    if (seed[k] !== undefined) set(k, seed[k]);
  }
  if (seed.opStats && typeof seed.opStats === "object") {
    for (const k of OP_KEYS) {
      const inp = root.querySelector(`[data-bbttcc-op="${k}"]`);
      if (inp && seed.opStats[k] != null) inp.value = Number(seed.opStats[k]) || 0;
    }
  }
}

function _wireStarterChips(html, tpls) {
  const root = (html instanceof HTMLElement ? html : html?.[0]);
  if (!root) return;
  root.querySelectorAll("[data-bbttcc-starter]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.bbttccIdx);
      const tpl = tpls[idx];
      if (!tpl) return;
      const set = (name, val) => {
        const el = root.querySelector(`[data-bbttcc-field="${name}"]`);
        if (el && val != null) el.value = val;
      };
      set("archetype", tpl.label);
      set("mode", tpl.defaults?.mode ?? "hybrid");
      set("hitTrack", tpl.defaults?.hitTrack ?? "");
      set("tags", tpl.defaults?.tags ?? "");
      const stats = tpl.defaults?.stats ?? {};
      for (const k of OP_KEYS) {
        const inp = root.querySelector(`[data-bbttcc-op="${k}"]`);
        if (inp) inp.value = Number(stats[k] ?? 0);
      }
      // B13.D Phase E — 2026-05-17. Loadout-driven prefill for defenses +
      // template key tracking. The _templateKey hidden input mirrors the
      // rig builder's _starterKey pattern so the form-harvest path can
      // recover the selection at commit time.
      const loadout = BOSS_LOADOUTS[String(tpl.key)];
      if (loadout) {
        set("resistances",     loadout.defenses?.resistances     ?? "");
        set("immunities",      loadout.defenses?.immunities      ?? "");
        set("vulnerabilities", loadout.defenses?.vulnerabilities ?? "");
      }
      set("_templateKey", String(tpl.key));
      root.dataset.bbttccSelectedTemplate = String(tpl.key);
      root.querySelectorAll("[data-bbttcc-starter]").forEach(b => {
        b.style.background = b === btn ? "rgba(200,62,62,0.22)" : "rgba(255,255,255,0.06)";
      });
    });
  });
}

async function _commit(root, tpls) {
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
    ui.notifications?.warn?.("RFI Boss needs a name.");
    return null;
  }

  const bracket = String(read("bracket") || "heavy");
  const bracketDef = BRACKETS.find(b => b.key === bracket) ?? BRACKETS[3];
  const tier = Math.max(1, Math.min(4, readNum("tier", 1)));
  const integrityMax = Math.max(1, readNum("integrity", bracketDef.base));
  const archetype = String(read("archetype") || "").trim();
  const factionId = String(read("factionId") || "").trim();
  const disposition = Number(read("disposition") ?? -1);

  const mode = String(read("mode") || "hybrid");
  const moraleHits = Math.max(1, readNum("moraleHits", 4));
  const hitTrack = String(read("hitTrack") || "").trim();
  const doctrine = String(read("doctrine") || "").trim();
  const tags = csv("tags");
  const signature = String(read("signature") || "").trim();
  const gmNotes = String(read("gmNotes") || "").trim();
  const concept = String(read("concept") || "").trim();

  const resistances = csv("resistances");
  const immunities = csv("immunities");
  const vulnerabilities = csv("vulnerabilities");

  const opStats = {};
  for (const k of OP_KEYS) {
    const inp = root.querySelector(`[data-bbttcc-op="${k}"]`);
    opStats[k] = Math.max(0, Number(inp?.value ?? 0) || 0);
  }

  // Phase ladder — split on newlines, then split "Label — body" pattern.
  const ladderRaw = String(read("phaseLadder") || "").trim();
  const ladder = ladderRaw
    ? ladderRaw.split(/\r?\n/).map(line => {
        const s = line.trim();
        if (!s) return null;
        // Em-dash, en-dash, or " - " separates label from body.
        const m = s.match(/^(.*?)\s*[—–\-]\s*(.+)$/);
        if (m) return { label: m[1].trim(), notes: m[2].trim() };
        return { label: s, notes: "" };
      }).filter(Boolean)
    : (hitTrack
        ? hitTrack.split(",").map(s => ({ label: s.trim(), notes: "" })).filter(p => p.label)
        : []);

  // Find canonical raid-profile key from selected starter (best-effort).
  let raidKey = "";
  const archLower = archetype.toLowerCase();
  for (const t of tpls) {
    if (String(t.label || "").toLowerCase() === archLower) { raidKey = t.key; break; }
  }

  const data = {
    name,
    type: "boss",
    flags: {
      [MOD]: {
        entityKind: "boss",
        createdViaBossBuilder: true,
        createdAt: Date.now()
      }
    },
    system: {
      identity: {
        archetype,
        archetypeTags: archetype ? [archetype] : [],
        factionId,
        portraitVariants: []
      },
      phases: {
        ladder,
        currentPhase: 0
      },
      integrity: {
        value: integrityMax,
        max: integrityMax,
        tier,
        bracket
      },
      defenses: {
        resistances,
        immunities,
        vulnerabilities
      },
      manifestations: {
        library: [],
        surge: { current: 0, max: 6, exploded: 0 },
        momentum: 0
      },
      doctrine: {
        slot: doctrine,
        maneuverKeys: []
      },
      raidStats: {
        rounds: 0,
        morale: moraleHits,
        infiltration: 0,
        alarm: 0
      },
      raidProfile: {
        key: raidKey,
        mode,
        moraleHits,
        hitTrack,
        tagsRaw: tags.join(", "),
        opStats,
        behaviorsRaw: "[]"
      },
      tags
    },
    prototypeToken: {
      actorLink: true,
      disposition
    }
  };

  if (factionId) {
    data.flags["bbttcc-factions"] = { factionId };
  }

  // Stash narrative authoring into the actor description / notes so the
  // sheet has something to render even before the GM seeds manifestations.
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
    console.error("[bbttcc-auto-link/boss-builder] Actor.create failed", err);
    ui.notifications?.error?.(`Failed to create RFI Boss: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  // B13.D Phase E — 2026-05-17. Seed power pack + augments from the
  // selected template's loadout. Defenses were already authored into the
  // form (chip prefill) and persisted via Actor.create. Failure is non-
  // fatal — the boss still mints, just without the loadout pieces.
  const selectedTemplateKey = String(read("_templateKey") || root.dataset.bbttccSelectedTemplate || "");
  const loadout = BOSS_LOADOUTS[selectedTemplateKey];
  console.log("[bbttcc-auto-link/boss-builder] commit",
    { actorId: actor?.id, selectedTemplateKey, hasLoadout: !!loadout,
      loadoutKeys: loadout ? Object.keys(loadout) : [] });
  if (loadout) {
    try {
      await _seedBossLoadout(actor, loadout);
    } catch (e) {
      console.warn("[bbttcc-auto-link/boss-builder] Loadout seed failed (non-fatal):", e);
    }
  }

  actor.sheet?.render(true);
  const loadoutHint = loadout
    ? ` — seeded ${[loadout.powerPack ? `${loadout.powerPack} pack` : null,
                    (loadout.augments?.length ? `${loadout.augments.length} augment(s)` : null),
                    (loadout.manifestations?.length ? `${loadout.manifestations.length} manifestation(s)` : null)]
                     .filter(Boolean).join(", ")}`
    : "";
  ui.notifications?.info?.(`Created RFI Boss: ${actor.name} (tier ${tier}, ${bracketDef.label})${loadoutHint}`);
  return actor;
}

/* Parse a damage formula string like "2d6", "3d8", "4d10+2" into a damageRoll
 * object matching the shape ftNormalizeDamageRoll expects:
 *   { op, number, die, attribute, type, flavor, track }
 * Empty/invalid formulas return an op:"none" roll (matches the system
 * default for non-damaging manifestations). The "+N" bonus is not yet
 * carried into the rolled-result side of the engine; we capture number+die
 * which is the load-bearing pair for the cast handler.
 */
function _parseDamageFormula(formula, { type = "kinetic", track = "integrity", attribute = "presence", flavor = "" } = {}) {
  const blank = {
    op: "none", number: 0, die: "d6", attribute: "", type: "kinetic",
    flavor: "", track: "integrity"
  };
  if (!formula || typeof formula !== "string") return blank;
  const m = formula.trim().match(/^(\d+)\s*[dD]\s*(\d+)/);
  if (!m) return blank;
  const number = Math.max(0, Number(m[1]) || 0);
  const dieN = Math.max(2, Number(m[2]) || 6);
  return {
    op: "damage",
    number,
    die: `d${dieN}`,
    attribute,
    type,
    flavor,
    track
  };
}

/* Seed a freshly-minted boss with a power pack + augments per its template
 * loadout. Power packs come from `game.bbttcc.api.raid.bossPowerPacks`
 * (canonical BOSS_POWER_PACKS table) and write to system.raidProfile.
 * behaviorsRaw — same shape boss-sheet's ftBossPackApply produces.
 * Augments come from the bbttcc-master-content.items compendium by name.
 * Defenses are NOT handled here; they're prefilled at chip-click time and
 * authored through the form.
 */
async function _seedBossLoadout(actor, loadout) {
  if (!actor || !loadout) return;
  const TAG = "[bbttcc-auto-link/boss-builder/_seedBossLoadout]";

  // --- Power pack: append behaviors to raidProfile.behaviorsRaw ---
  if (loadout.powerPack) {
    const packs = game?.bbttcc?.api?.raid?.bossPowerPacks ?? [];
    const allPowers = game?.bbttcc?.api?.raid?.bossPowers ?? [];
    const pack = packs.find(p => p.key === loadout.powerPack);
    if (!pack) {
      console.warn(TAG, `Power pack not found: ${loadout.powerPack} (is bbttcc-raid loaded?)`);
    } else {
      const powerKeys = Array.isArray(pack.powers) ? pack.powers : [];
      const sys = actor.system?.system ?? actor.system;
      let parsed;
      try { parsed = JSON.parse(sys.raidProfile?.behaviorsRaw || "[]"); } catch { parsed = []; }
      if (!Array.isArray(parsed)) parsed = [];
      let added = 0;
      for (const pk of powerKeys) {
        const p = allPowers.find(x => x.key === pk);
        if (!p) continue;
        const id = p.behavior?.id ?? p.key;
        if (parsed.some(b => (b.id ?? b.key) === id)) continue;
        parsed.push(foundry.utils.deepClone(p.behavior ?? { id, label: p.label }));
        added++;
      }
      await actor.update({ "system.raidProfile.behaviorsRaw": JSON.stringify(parsed, null, 2) });
      console.log(TAG, "applied power pack",
        { pack: pack.label, added, total: parsed.length });
    }
  }

  // --- Augments + Manifestations: bulk-embed as items ---
  // Augments come from the master-content compendium by name; manifestations
  // are synthesized via the fourththing system's createManifestationItemData
  // (same shape the Manifestation Wizard produces, so they render correctly
  // on the boss sheet's Manifest tab + are Cast-able via ftBossManifestCast).
  //
  // CRITICAL: the boss sheet renders manifestations from
  // `system.manifestations.library` (UUID array), NOT from actor.items
  // directly. After embedding, we must register the manifestation items'
  // UUIDs in the library array or the sheet won't surface them.
  const itemsToCreate = [];
  const manifestationItemIndices = new Set();  // indices in itemsToCreate that are manifestations

  // Augments (compendium lookup).
  const augmentNames = Array.isArray(loadout.augments) ? loadout.augments : [];
  if (augmentNames.length) {
    const PACK_ID = "bbttcc-master-content.items";
    const pack = game.packs?.get?.(PACK_ID);
    if (!pack) {
      console.warn(TAG, `Compendium pack '${PACK_ID}' not found — augments will be skipped.`);
    } else {
      const idx = await pack.getIndex();
      for (const name of augmentNames) {
        const hit = idx.find(e => e.name === name);
        if (!hit) {
          console.warn(TAG, `Augment not found in compendium: ${name}`);
          continue;
        }
        const doc = await pack.getDocument(hit._id);
        const data = doc?.toObject?.();
        if (data) { delete data._id; itemsToCreate.push(data); }
      }
    }
  }

  // Manifestations (synthesized via fourththing system helper).
  // Tier gets clamped to the boss's integrity.tier so the cast engine
  // doesn't reject them at cast time (Out-of-Reach gate: reachBy > 1).
  const manifestationSpecs = Array.isArray(loadout.manifestations) ? loadout.manifestations : [];
  if (manifestationSpecs.length) {
    const builder = game?.fourththing?.createManifestationItemData;
    if (typeof builder !== "function") {
      console.warn(TAG, "game.fourththing.createManifestationItemData not exposed — manifestations skipped. Reload Foundry after system update.");
    } else {
      const bossTier = Math.max(1, Math.min(4,
        Number(actor.system?.system?.integrity?.tier ?? actor.system?.integrity?.tier ?? 1) || 1));
      for (const spec of manifestationSpecs) {
        try {
          // Clamp manifestation tier to boss's tier — author may have
          // specified a higher-tier ability for narrative reasons, but the
          // cast engine rejects manTier > bossTier+1 as Out of Reach.
          const specTier = Math.max(1, Math.min(4, Number(spec.tier ?? bossTier) || bossTier));
          const tier = Math.min(specTier, bossTier);
          // Parse damageFormula ("2d6", "3d8+2") into a damageRoll object.
          // createManifestationItemData reads `damageRoll`, not damageFormula
          // — the standalone formula was being silently dropped on first ship.
          const damageRoll = _parseDamageFormula(spec.damageFormula, {
            type: spec.damageType ?? "kinetic",
            track: spec.damageTrack ?? "integrity",
            attribute: spec.intent ?? "presence",
            flavor: ""
          });
          const values = {
            name: spec.name,
            tier,
            intent: spec.intent ?? "presence",
            channel: spec.channel ?? "soul",
            sephirah: spec.sephirah ?? "tiferet",
            stability: spec.stability ?? "sustained",
            form: spec.form ?? "working",
            function: spec.function ?? "harm",
            interactionModel: spec.interactionModel ?? "directed",
            mode: spec.mode ?? "hermetic",
            damageRoll,
            concept: spec.concept ?? "",
            effect: spec.effect ?? "",
            flavor: spec.flavor ?? "",
            tags: Array.isArray(spec.tags) ? spec.tags : [],
            costType: spec.costType ?? "clarity",
            costValue: Number(spec.costValue ?? 1),
            duration: spec.duration ?? "scene",
            scale: spec.scale ?? "scene",
            activation_block: { type: "action", consumePool: true }
          };
          const itemData = builder(actor, "power", values);
          if (itemData) {
            manifestationItemIndices.add(itemsToCreate.length);
            itemsToCreate.push(itemData);
          }
        } catch (err) {
          console.warn(TAG, `Failed to synthesize manifestation '${spec?.name}':`, err);
        }
      }
    }
  }

  console.log(TAG, "preparing to embed",
    { count: itemsToCreate.length, names: itemsToCreate.map(i => i.name),
      manifestationCount: manifestationItemIndices.size });

  if (itemsToCreate.length) {
    const created = await actor.createEmbeddedDocuments("Item", itemsToCreate);
    console.log(TAG, "embedded",
      { count: created?.length ?? 0, ids: (created ?? []).map(d => d.id) });

    // Register the manifestation items' UUIDs in system.manifestations.library
    // — the boss sheet reads from there (NOT from actor.items directly), so
    // skipping this leaves the manifestations orphaned to the Manifest tab.
    const manifestationUuids = (created ?? [])
      .filter((_, i) => manifestationItemIndices.has(i))
      .map(doc => doc.uuid)
      .filter(Boolean);
    if (manifestationUuids.length) {
      const sys = actor.system?.system ?? actor.system;
      const currentLibrary = Array.isArray(sys?.manifestations?.library) ? sys.manifestations.library : [];
      const nextLibrary = [...currentLibrary, ...manifestationUuids];
      await actor.update({ "system.manifestations.library": nextLibrary });
      console.log(TAG, "registered manifestation UUIDs in library",
        { added: manifestationUuids.length, total: nextLibrary.length });
    }
  }
}

function _install() {
  globalThis.BBTTCC_BossBuilder = globalThis.BBTTCC_BossBuilder || {};
  globalThis.BBTTCC_BossBuilder.open = openBossBuilder;
  globalThis.BBTTCC_BossBuilder.seedFromActor = bossSeedFromActor;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.bossBuilder = { open: openBossBuilder, seedFromActor: bossSeedFromActor };
  } catch (_e) {}
}
_install();
Hooks.once("ready", _install);
