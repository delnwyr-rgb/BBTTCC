/* Bad Eden Auto-Link — RFI NPC Builder
 *
 * Light dialog (Manifestation Wizard pattern, not Tree of Life) that creates
 * a Roll For Initiation NPC as a CHARACTER-typed actor with an entityKind
 * flag marker. This lets the resulting actor use the full native PC sheet
 * (so all class / ancestry / heritage / archetype / etc. mechanisms work
 * out of the box) while being identifiable as an NPC for downstream hooks
 * via flags.bbttcc-auto-link.entityKind = "npc".
 *
 * Drag class / ancestry / heritage / archetype items onto the resulting
 * sheet — they wire identically to PC drops.
 *
 * 2026-05-16 — Classed Monsters sprint, NPC Builder slice.
 */

const MOD = "bbttcc-auto-link";
const CALLINGS_PACK = "bbttcc-character-options.npc-callings";
const ANCESTRIES_PACK = "bbttcc-master-content.ancestries";
const BRIDGE_PATH = "systems/fourththing/bbttcc-bridge.js";

/* Ancestry + heritage enumeration mirrors the steward sheet's indexers
 * (ftIndexItemPackByType / ftIndexHeritagePack in bbttcc-bridge.js — not
 * exported, so the shapes are replicated here). The GRANTS themselves go
 * through the bridge's exported applyActorAncestryChange /
 * applyActorHeritageChange so builder-made NPCs match sheet-edited ones. */

const _normFam = (s) => String(s ?? "").toLowerCase().replace(/-/g, "_");
// Cross-cutting heritage families bypass the ancestry filter (they key off
// sephirah alignment, not species) — keep in sync with bbttcc-bridge.js.
const CROSS_CUTTING_HERITAGE_FAMILIES = new Set(["sephirotic"]);

async function _ancestryIndex() {
  const pack = game.packs.get(ANCESTRIES_PACK);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier", "flags.bbttcc.family", "flags.bbttcc.ancestryKey"] });
    return idx
      .filter(e => e.type === "species" || e.type === "race")
      .map(e => {
        const flags = e.flags?.bbttcc ?? {};
        return {
          id: e._id, name: e.name,
          family: _normFam(flags.family ?? e["flags.bbttcc.family"]
            ?? flags.ancestryKey ?? e["flags.bbttcc.ancestryKey"]
            ?? e.system?.identifier ?? e["system.identifier"])
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn("[bbttcc-auto-link/npc-builder] ancestry index failed", err);
    return [];
  }
}

async function _heritageIndex() {
  const pack = game.packs.get(ANCESTRIES_PACK);
  if (!pack) return [];
  try {
    const idx = await pack.getIndex({ fields: ["name", "type", "system.identifier", "flags.bbttcc.kind", "flags.bbttcc.family"] });
    const candidates = idx
      .filter(e => String(e.type || "").toLowerCase() === "feat")
      .map(e => {
        const identifier = String(e.system?.identifier ?? e["system.identifier"] ?? "").toLowerCase();
        const flags = e.flags?.bbttcc ?? {};
        const kind = String(flags.kind ?? e["flags.bbttcc.kind"] ?? "").toLowerCase();
        // Shape 1: explicit heritage root. Shape 2: lineage tier-1 standing in
        // as the root for species that ship no separate root item.
        const isRoot = kind === "heritage" || identifier.endsWith("_heritage");
        const isTier1 = kind && identifier.endsWith("_tier1") && identifier.startsWith(`${kind}_`);
        if (!isRoot && !isTier1) return null;
        let family = _normFam(flags.family ?? e["flags.bbttcc.family"]);
        if (!family) {
          if (isTier1) family = _normFam(kind);
          else { const m = identifier.match(/^([a-z0-9]+)_/); if (m) family = m[1]; }
        }
        return { id: e._id, name: e.name, family, isRoot };
      })
      .filter(Boolean);
    // Families with an explicit root drop their tier-1 fallbacks (those are
    // heritage CONTENTS, not selectable heritages).
    const familiesWithRoot = new Set(candidates.filter(c => c.isRoot).map(c => c.family));
    return candidates
      .filter(c => c.isRoot || !familiesWithRoot.has(c.family))
      .map(({ id, name, family }) => ({ id, name, family }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } catch (err) {
    console.warn("[bbttcc-auto-link/npc-builder] heritage index failed", err);
    return [];
  }
}

async function _callingOptions() {
  const pack = game.packs.get(CALLINGS_PACK);
  if (!pack) return null;
  try {
    const index = await pack.getIndex({ fields: ["type"] });
    const callings = index.filter(e => e.type === "class")
      .map(e => ({ id: e._id, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!callings.length) return null;
    return ['<option value="">— None (drag items later) —</option>']
      .concat(callings.map(c => `<option value="${c.id}">${foundry.utils.escapeHTML(c.name)}</option>`))
      .join("");
  } catch { return null; }
}

/* Grant a Calling to a freshly-built NPC: the class item, every tier feature
 * at or below the NPC's tier, and the aptitude kit (signature rank = tier,
 * secondary = tier − 1) read from the class item's flags. */
async function _grantCalling(actor, callingId, tier) {
  const pack = game.packs.get(CALLINGS_PACK);
  if (!pack) return;
  const classDoc = await pack.getDocument(callingId);
  const calling = classDoc?.flags?.fourththing?.calling;
  if (!classDoc || !calling?.key) return;

  const docs = await pack.getDocuments();
  const feats = docs
    .filter(d => d.type === "feature"
      && d.flags?.fourththing?.calling?.key === calling.key
      && Number(d.flags.fourththing.calling.tier ?? 99) <= tier)
    .sort((a, b) => Number(a.flags.fourththing.calling.tier) - Number(b.flags.fourththing.calling.tier));
  await actor.createEmbeddedDocuments("Item", [classDoc, ...feats].map(d => d.toObject()));

  const kit = {};
  if (calling.signature) kit[`system.skills.${calling.signature}.value`] = tier;
  if (calling.secondary) kit[`system.skills.${calling.secondary}.value`] = Math.max(0, tier - 1);
  if (Object.keys(kit).length) await actor.update(kit);
}

function _factionOptions() {
  const factions = (game.actors?.contents ?? [])
    .filter(a => {
      try {
        const k = game.bbttcc?.api?.actorKind?.(a);
        if (k) return k === "faction";
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

export async function openNPCBuilder() {
  const factionOpts = _factionOptions();
  const callingOpts = await _callingOptions();
  const ancestries  = await _ancestryIndex();
  const heritages   = await _heritageIndex();
  const esc = (s) => foundry.utils.escapeHTML(String(s));

  const ancestryOpts = ['<option value="">— None —</option>']
    .concat(ancestries.map(a => `<option value="${a.id}" data-family="${esc(a.family)}">${esc(a.name)}</option>`))
    .join("");

  const callingGroup = callingOpts ? `
      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Calling</label>
        <select data-bbttcc-field="callingId" style="padding:0.35rem 0.5rem; border-radius:3px;">${callingOpts}</select>
        <span style="opacity:0.65; font-size:0.75rem;">Non-Surge NPC-grade class: grants the Calling, its tier features, and its aptitude kit.</span>
      </div>` : "";

  // No outer <form> tag — Foundry's Dialog wraps content in its own <form>
  // element and nested forms get stripped by the browser. Use a <div> wrapper
  // and read inputs by querySelector in the callback.
  const content = `
    <div class="bbttcc-npc-builder" style="display:flex; flex-direction:column; gap:0.6rem;">
      <p style="margin:0 0 0.4rem; opacity:0.85; font-size:0.85rem;">
        Create a Roll For Initiation NPC. The actor uses the full PC sheet so
        every class, ancestry, heritage, archetype, crew, occult, alignment,
        and political-philosophy option works natively. It's flag-marked as
        an NPC for downstream targeting and behavior hooks.
      </p>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Name <span style="color:#f87171">*</span></label>
        <input type="text" data-bbttcc-field="name" required placeholder="e.g. Hex-Touched Champion" autofocus
               style="padding:0.35rem 0.5rem; border-radius:3px;"/>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Tier</label>
        <select data-bbttcc-field="tier" style="padding:0.35rem 0.5rem; border-radius:3px;">
          <option value="1">Tier I (level 1–4)</option>
          <option value="2">Tier II (level 5–10)</option>
          <option value="3">Tier III (level 11–16)</option>
          <option value="4">Tier IV (level 17+)</option>
        </select>
      </div>

      ${callingGroup}

      ${ancestries.length ? `
      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Ancestry</label>
        <select data-bbttcc-field="ancestryId" style="padding:0.35rem 0.5rem; border-radius:3px;">${ancestryOpts}</select>
      </div>

      <div class="form-group" style="display:flex; flex-direction:column; gap:0.2rem;">
        <label style="font-weight:600;">Heritage</label>
        <select data-bbttcc-field="heritageId" style="padding:0.35rem 0.5rem; border-radius:3px;"></select>
        <span style="opacity:0.65; font-size:0.75rem;">Filtered by the chosen ancestry (Sephirotic heritages are always available).</span>
      </div>` : ""}

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
        After creation: open the sheet and drag Archetype / Crew / Occult /
        Sephirotic items from compendiums to flesh out the NPC further. All
        abilities will function the same as on a PC sheet.
      </p>
    </div>
  `;

  const result = await Dialog.wait({
    title: "Create RFI NPC",
    content,
    buttons: {
      create: {
        label: "Create NPC",
        icon: '<i class="fas fa-skull"></i>',
        callback: (html) => {
          const root = (html instanceof HTMLElement ? html : html[0]);
          if (!root) return { ok: false };
          const read = (k) => root.querySelector(`[data-bbttcc-field="${k}"]`)?.value ?? "";
          return {
            ok: true,
            name:        read("name"),
            tier:        read("tier"),
            callingId:   read("callingId"),
            ancestryId:  read("ancestryId"),
            heritageId:  read("heritageId"),
            factionId:   read("factionId"),
            disposition: read("disposition")
          };
        }
      },
      cancel: { label: "Cancel", callback: () => ({ ok: false }) }
    },
    default: "create",
    // Heritage dropdown re-filters live as the ancestry changes — same
    // family rules as the steward sheet's edit dropdowns.
    render: (html) => {
      const root = (html instanceof HTMLElement ? html : html[0]);
      const ancSel = root?.querySelector('[data-bbttcc-field="ancestryId"]');
      const herSel = root?.querySelector('[data-bbttcc-field="heritageId"]');
      if (!ancSel || !herSel) return;
      const rebuild = () => {
        const fam = _normFam(ancSel.selectedOptions[0]?.dataset?.family ?? "");
        const keep = herSel.value;
        const opts = heritages.filter(h => !fam || !h.family
          || _normFam(h.family) === fam
          || CROSS_CUTTING_HERITAGE_FAMILIES.has(_normFam(h.family)));
        herSel.innerHTML = ['<option value="">— None —</option>']
          .concat(opts.map(h => `<option value="${h.id}">${esc(h.name)}</option>`))
          .join("");
        if (opts.some(h => h.id === keep)) herSel.value = keep;
      };
      ancSel.addEventListener("change", rebuild);
      rebuild();
    }
  });

  if (!result?.ok) return null;
  const name = String(result.name || "").trim();
  if (!name) {
    ui.notifications?.warn?.("RFI NPC needs a name.");
    return null;
  }

  const tier = Math.max(1, Math.min(4, Number(result.tier) || 1));
  const disposition = Number(result.disposition ?? -1);
  const factionId = String(result.factionId || "").trim();

  // Build the actor payload. type:"character" so the full PC sheet renders
  // and every existing PC-side mechanism (FEATURE_ROUTER, identity bridge,
  // Bad Eden quickbar, Affiliations card, etc.) Just Works.
  const data = {
    name,
    type: "character",
    flags: {
      [MOD]: {
        entityKind: "npc",
        createdViaNPCBuilder: true,
        createdAt: Date.now()
      }
    },
    system: {
      details: { tier }
    },
    prototypeToken: {
      // NPCs default to UNLINKED tokens so each placed token is an independent
      // instance — matches Foundry's NPC convention.
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
    console.error("[bbttcc-auto-link/npc-builder] Actor.create failed", err);
    ui.notifications?.error?.(`Failed to create RFI NPC: ${err?.message || err}`);
    return null;
  }
  if (!actor) return null;

  const callingId = String(result.callingId || "").trim();
  if (callingId) {
    try {
      await _grantCalling(actor, callingId, tier);
    } catch (err) {
      console.error("[bbttcc-auto-link/npc-builder] Calling grant failed", err);
      ui.notifications?.warn?.(`NPC created, but the Calling grant failed: ${err?.message || err}`);
    }
  }

  // Ancestry + heritage go through the system bridge — the same apply
  // functions the steward sheet's edit dropdowns call, so the NPC gets the
  // species item, L1 advancement grants, lineage stamps, and nativeLinks
  // flags exactly as if edited by hand. Ancestry FIRST (its cascade clears
  // heritage), then heritage.
  const ancestryId = String(result.ancestryId || "").trim();
  const heritageId = String(result.heritageId || "").trim();
  if (ancestryId || heritageId) {
    try {
      const bridge = await import(foundry.utils.getRoute(BRIDGE_PATH));
      if (ancestryId) await bridge.applyActorAncestryChange(actor, ancestryId);
      if (heritageId) await bridge.applyActorHeritageChange(actor, heritageId);
    } catch (err) {
      console.error("[bbttcc-auto-link/npc-builder] ancestry/heritage grant failed", err);
      ui.notifications?.warn?.(`NPC created, but the ancestry/heritage grant failed: ${err?.message || err} — drag them onto the sheet instead.`);
    }
  }

  actor.sheet?.render(true);
  ui.notifications?.info?.(`Created RFI NPC: ${actor.name} (tier ${tier})`);
  return actor;
}

// Expose for the directory-button click handler in module.js, and as a
// scriptable API for downstream macros / agents.
function _install() {
  globalThis.BBTTCC_NPCBuilder = globalThis.BBTTCC_NPCBuilder || {};
  globalThis.BBTTCC_NPCBuilder.open = openNPCBuilder;
  try {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.npcBuilder = { open: openNPCBuilder };
  } catch(_e){}
}
_install();
Hooks.once("ready", _install);
