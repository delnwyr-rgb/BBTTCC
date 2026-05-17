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

export async function openBossBuilder() {
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
</div>`;

  return new Promise((resolve) => {
    const dlg = new Dialog({
      title: "Create RFI Boss",
      content,
      buttons: {
        create: {
          icon: "<i class='fas fa-crown'></i>",
          label: "Create Boss",
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
      render: (html) => _wireStarterChips(html, tpls)
    }, {
      classes: ["fourththing", "ft-manifestation-wizard-window", "bbttcc-boss-builder-window"],
      width: 760,
      height: 820,
      resizable: true
    });
    dlg.render(true);
  });
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

  actor.sheet?.render(true);
  ui.notifications?.info?.(`Created RFI Boss: ${actor.name} (tier ${tier}, ${bracketDef.label})`);
  return actor;
}

function _install() {
  globalThis.BBTTCC_BossBuilder = globalThis.BBTTCC_BossBuilder || {};
  globalThis.BBTTCC_BossBuilder.open = openBossBuilder;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.bossBuilder = { open: openBossBuilder };
  } catch (_e) {}
}
_install();
Hooks.once("ready", _install);
