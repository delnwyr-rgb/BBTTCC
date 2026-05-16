/* BBTTCC Auto-Link — RFI Monster Builder
 *
 * Sibling to npc-builder.js. Creates a type:"npc" actor that renders with
 * the native fourththing NPC sheet (FACULTIES + MANIFESTATIONS layout —
 * the Apex Predator / Lisa Frank Elemental / Crystal Lurker form factor).
 *
 * Distinct from the classed-NPC pattern (which uses type:"character" + the
 * full PC sheet via npc-builder.js). Use Monster Builder for stat-block
 * creatures with manually authored powers; use NPC Builder for named/classed
 * NPCs that should walk like PCs (ancestry, heritage, archetype, class, etc).
 *
 * 2026-05-16 — Classed Monsters sprint follow-on.
 */

const MOD = "bbttcc-auto-link";

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
    .concat(factions.map(f => `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`))
    .join("");
}

export async function openMonsterBuilder() {
  const factionOpts = _factionOptions();

  const content = `
    <div class="bbttcc-monster-builder" style="display:flex; flex-direction:column; gap:0.6rem;">
      <p style="margin:0 0 0.4rem; opacity:0.85; font-size:0.85rem;">
        Create a Roll For Initiation Monster — a stat-block creature on the
        native fourththing NPC sheet (FACULTIES + MANIFESTATIONS layout).
        Best for beasts, elementals, lurkers, and other creatures with
        manually authored powers. For named/classed NPCs that should walk
        like PCs, use Create NPC instead.
      </p>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Name <span style="color:#f87171">*</span></label>
        <input type="text" data-bbttcc-field="name" required autofocus
               placeholder="e.g. Apex Predator, Crystal Lurker, Lisa Frank Elemental"
               style="padding:0.35rem 0.5rem; border-radius:3px;"/>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Role</label>
        <input type="text" data-bbttcc-field="role"
               placeholder="e.g. Brute, Striker, Lurker, Controller, Skirmisher"
               style="padding:0.35rem 0.5rem; border-radius:3px;"/>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Tier</label>
        <select data-bbttcc-field="tier" style="padding:0.35rem 0.5rem; border-radius:3px;">
          <option value="1">Tier I</option>
          <option value="2">Tier II</option>
          <option value="3">Tier III</option>
          <option value="4">Tier IV</option>
        </select>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Faction</label>
        <select data-bbttcc-field="factionId" style="padding:0.35rem 0.5rem; border-radius:3px;">${factionOpts}</select>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Token Disposition</label>
        <select data-bbttcc-field="disposition" style="padding:0.35rem 0.5rem; border-radius:3px;">
          <option value="-1" selected>Hostile</option>
          <option value="0">Neutral</option>
          <option value="1">Friendly</option>
          <option value="-2">Secret</option>
        </select>
      </div>

      <p style="opacity:0.7; font-size:0.78rem; margin:0.4rem 0 0;">
        After creation: open the sheet, set Faculty values + Integrity / Stress,
        and add powers manually (the native sheet's Features section accepts
        any item type). Apex Predator / Lisa Frank Elemental / Crystal Lurker
        are good reference templates.
      </p>
    </div>
  `;

  const result = await Dialog.wait({
    title: "Create RFI Monster",
    content,
    buttons: {
      create: {
        label: "Create Monster",
        icon: '<i class="fas fa-paw"></i>',
        callback: (html) => {
          const root = (html instanceof HTMLElement ? html : html[0]);
          if (!root) return { ok: false };
          const read = (k) => root.querySelector(`[data-bbttcc-field="${k}"]`)?.value ?? "";
          return {
            ok: true,
            name:        read("name"),
            role:        read("role"),
            tier:        read("tier"),
            factionId:   read("factionId"),
            disposition: read("disposition")
          };
        }
      },
      cancel: { label: "Cancel", callback: () => ({ ok: false }) }
    },
    default: "create"
  });

  if (!result?.ok) return null;
  const name = String(result.name || "").trim();
  if (!name) {
    ui.notifications?.warn?.("RFI Monster needs a name.");
    return null;
  }

  const tier = Math.max(1, Math.min(4, Number(result.tier) || 1));
  const role = String(result.role || "").trim();
  const disposition = Number(result.disposition ?? -1);
  const factionId = String(result.factionId || "").trim();

  // type:"npc" → native fourththing NPC sheet (FACULTIES + MANIFESTATIONS).
  // Distinct from the NPC Builder's type:"character" pattern, which uses
  // the full PC sheet.
  const data = {
    name,
    type: "npc",
    flags: {
      [MOD]: {
        entityKind: "monster",
        createdViaMonsterBuilder: true,
        createdAt: Date.now()
      }
    },
    system: {
      details: { tier, role }
    },
    prototypeToken: {
      actorLink: false,
      disposition
    }
  };

  if (factionId) {
    data.flags["bbttcc-factions"] = { factionId };
  }

  let actor;
  try {
    actor = await Actor.create(data);
  } catch (err) {
    console.error("[bbttcc-auto-link/monster-builder] Actor.create failed", err);
    ui.notifications?.error?.(`Failed to create RFI Monster: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  actor.sheet?.render(true);
  ui.notifications?.info?.(`Created RFI Monster: ${actor.name} (tier ${tier}${role ? `, ${role}` : ""})`);
  return actor;
}

function _install() {
  globalThis.BBTTCC_MonsterBuilder = globalThis.BBTTCC_MonsterBuilder || {};
  globalThis.BBTTCC_MonsterBuilder.open = openMonsterBuilder;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.monsterBuilder = { open: openMonsterBuilder };
  } catch(_e){}
}
_install();
Hooks.once("ready", _install);
