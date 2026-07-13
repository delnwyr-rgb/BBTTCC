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
        After creation: open the sheet and drag Class / Ancestry / Heritage /
        Archetype / Crew / Occult / Sephirotic items from compendiums to flesh
        out the NPC. All abilities will function the same as on a PC sheet.
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
