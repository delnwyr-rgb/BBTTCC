/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-structures · bulwark-hookups.js · Phase C
 * ─────────────────────────────────────────────────────────────────────────────
 * Enriches the dispatch context of Bulwark Ruin actions — Catastrophic Entry,
 * Siege Cost, Shockwave Footing, Ruin to Renewal — so the existing dialog
 * abilities have real mechanical effect against the Structure damage path.
 *
 * NO new abilities are authored. The existing openBreakerRuin dialog (which
 * Bulwark uses via the bulwark_ruin alias) is left untouched in system code;
 * we observe its chat card via createChatMessage hook and apply effects from
 * the bbttcc-structures side.
 *
 * Mechanical effects per spec §13:
 *   • Catastrophic Entry  → next attack by this Bulwark bypasses Structure
 *                           Threshold (forces pierce mode), suppresses salvage
 *   • Siege Cost          → stamps a TTL flag on the Bulwark's affiliated
 *                           faction (Siege Raid Type sprint consumes it)
 *   • Shockwave Footing   → finds Structures within ~10ft of the Bulwark token
 *                           and chips one fragile-family unit from each
 *   • Ruin to Renewal     → opens a follow-up dialog: pick target Structure +
 *                           faction, roll Faith/Economy DC 15, on success
 *                           deposit 100% of BOM into the faction stockpile
 *
 * Source-actor identification for Catastrophic Entry: wedges
 * applyDamageFromButton to capture the source actor from btn.dataset.itemUuid
 * for the duration of the call. The _applyDamageToActor wedge (damage-wedge.js)
 * reads the captured source from a module-scope variable and applies the
 * Bulwark flag check.
 *
 * Per [[economy-phase-cd-2026-05-09]] + bbttcc-factions stockpile-api.js,
 * faction stockpile is at game.bbttcc.api.factions.stockpile with .adjust()
 * for material credit operations.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MOD_ID = "bbttcc-structures";
const TAG = `[${MOD_ID}/bulwark]`;
const FLAG_SCOPE = MOD_ID;

// ── Source-actor capture state ──────────────────────────────────────────────
// Module-scope variable updated by the applyDamageFromButton wrapper. Read by
// the damage-wedge to know who's dealing the damage.

let _activeDamageSource = null;

export function getActiveDamageSource() {
  return _activeDamageSource;
}

function _setActiveDamageSource(actor) {
  _activeDamageSource = actor ?? null;
}

// ── Bulwark Ruin chat sniffer ───────────────────────────────────────────────
// Matches the header text the system writes (ft-class-automation.js:914):
//   "⚒ Breaker: <Short Label>"
// where short labels are:
//   "Catastrophic Entry" | "Siege Cost Reduced" | "Shockwave Footing"
//   | "Ruin to Renewal"
// Speaker is the Bulwark actor.

const RUIN_HEADER_RX = /⚒\s*Breaker:\s*([^<\n]+?)\s*<\/span>/i;
const ACTION_MAP = {
  "catastrophic entry": "entry",
  "siege cost reduced": "siege",
  "shockwave footing":  "shockwave",
  "ruin to renewal":    "renewal"
};

function _parseRuinCard(message) {
  const content = String(message?.content ?? "");
  const m = content.match(RUIN_HEADER_RX);
  if (!m) return null;
  const labelLower = String(m[1] ?? "").toLowerCase().trim();
  const action = ACTION_MAP[labelLower];
  if (!action) return null;
  const actorId = message.speaker?.actor;
  const actor = actorId ? game.actors?.get(actorId) : null;
  if (!actor) return null;
  return { action, label: m[1], actor };
}

async function _onRuinCard(message) {
  if (!game.user?.isGM) return; // GM-side application (other clients see chat card too)
  const parsed = _parseRuinCard(message);
  if (!parsed) return;
  const { action, actor } = parsed;
  try {
    if (action === "entry")     await _onCatastrophicEntry(actor);
    if (action === "siege")     await _onSiegeCost(actor);
    if (action === "shockwave") await _onShockwave(actor);
    if (action === "renewal")   await _onRenewal(actor);
  } catch (e) {
    console.warn(TAG, `Ruin action '${action}' failed`, e);
  }
}

// ── Catastrophic Entry ──────────────────────────────────────────────────────
// Stamp a one-shot flag on the Bulwark. The next damage they apply via the
// chat-card path will force pierce mode + suppress salvage.

async function _onCatastrophicEntry(actor) {
  await actor.setFlag(FLAG_SCOPE, "bulwarkPendingEntry", {
    armed: true,
    ts: Date.now()
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div style="border:1px solid #c08060; padding:0.4rem 0.6rem; background:#1a1611; color:#e8c8a0; font-family:sans-serif">
      <div style="font-size:0.76rem; color:#e8c8a0; letter-spacing:0.08em;">
        ⚒ CATASTROPHIC ENTRY armed
      </div>
      <div style="font-size:0.72rem; opacity:0.75; margin-top:3px">
        ${foundry.utils.escapeHTML(actor.name)}'s next strike or cast against a Structure ignores its Threshold — even chip-only hits punch through to Plates. Salvage payouts from any state transition this strike causes are suppressed (broke the latch, not the wall).
      </div>
    </div>`
  });
}

/**
 * Called by damage-wedge to consume the Catastrophic Entry flag at attack time.
 * Returns { bypassThreshold, noSalvage } if the source has it armed; clears
 * the flag. Returns null otherwise.
 */
export async function consumeCatastrophicEntry(sourceActor) {
  if (!sourceActor) return null;
  const pending = sourceActor.getFlag?.(FLAG_SCOPE, "bulwarkPendingEntry");
  if (!pending?.armed) return null;
  await sourceActor.unsetFlag(FLAG_SCOPE, "bulwarkPendingEntry");
  // 2026-05-25 — deferred Ruin spend. The charge stays armed (and UNPAID)
  // through misses; the Ruin cost is only paid here, when the breach actually
  // lands a hit. A miss never reaches this path (damage-wedge early-returns on
  // 0 damage), so the charge is not wasted. Cost stamped by the Breaker dialog.
  const cost = Number(sourceActor.getFlag?.(FLAG_SCOPE, "bulwarkEntryRuinCost")) || 0;
  if (cost > 0) {
    const sys = sourceActor.system?.system ?? sourceActor.system;
    const cur = Number(sys?.resources?.ruinCharges?.current) || 0;
    try {
      await sourceActor.update({ "system.resources.ruinCharges.current": Math.max(0, cur - cost) });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: sourceActor }),
        content: `<div style="font-size:0.72rem; opacity:0.7; padding:0.2rem 0.5rem; color:#e8c8a0">⚒ Catastrophic Entry landed — spent <b>${cost}</b> Ruin Charge${cost === 1 ? "" : "s"} (${Math.max(0, cur - cost)} left).</div>`
      });
    } catch (e) { console.warn(TAG, "deferred Ruin spend failed", e); }
  }
  await sourceActor.unsetFlag?.(FLAG_SCOPE, "bulwarkEntryRuinCost");
  return { bypassThreshold: true, noSalvage: true };
}

// ── Siege Cost (stub for Siege Raid Type sprint) ─────────────────────────────

async function _onSiegeCost(actor) {
  const faction = _findFactionForActor(actor);
  if (!faction) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-size:0.74rem; opacity:0.7; font-style:italic; padding:0.3rem 0.6rem;">
        ⚒ Siege Cost effect ready — but ${foundry.utils.escapeHTML(actor.name)} has no recognized faction affiliation to apply the discount to. (Phase C stub — Siege Raid Type sprint will resolve this fully.)
      </div>`
    });
    return;
  }
  // TTL flag — Siege Raid Type sprint will consume this and clear it after
  // the next Siege scenario ends. For Phase C we just stamp + announce.
  await faction.setFlag(FLAG_SCOPE, "siegeCostDiscount", {
    armed: true,
    grantedBy: actor.id,
    ts: Date.now(),
    expires: "next-siege-end"
  });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div style="border:1px solid #c08060; padding:0.4rem 0.6rem; background:#1a1611; color:#e8c8a0; font-family:sans-serif">
      <div style="font-size:0.76rem; color:#e8c8a0; letter-spacing:0.08em;">
        ⚒ SIEGE COST armed for ${foundry.utils.escapeHTML(faction.name)}
      </div>
      <div style="font-size:0.7rem; opacity:0.65; margin-top:3px; font-style:italic">
        Stamped on faction. Persists until the next Siege ends (Siege Raid Type sprint will consume this flag).
      </div>
    </div>`
  });
}

// ── Shockwave Footing ───────────────────────────────────────────────────────
// Find Structures within ~10ft of the Bulwark token; chip 1 unit of the most-
// fragile family from each. Posts a chat summary of the affected structures.

async function _onShockwave(actor) {
  const sourceToken = canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id);
  if (!sourceToken) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-size:0.74rem; opacity:0.7; font-style:italic; padding:0.3rem 0.6rem;">
        ⚒ Shockwave Footing — ${foundry.utils.escapeHTML(actor.name)} not on canvas; no adjacent structures to ripple to.
      </div>`
    });
    return;
  }
  const grid = canvas?.scene?.grid;
  const pxPerFt = (grid?.size && grid?.distance) ? (grid.size / grid.distance) : 50;
  const RANGE_FT = 10;
  const rangePx = RANGE_FT * pxPerFt;
  const sx = sourceToken.center?.x ?? 0;
  const sy = sourceToken.center?.y ?? 0;

  const candidates = (canvas?.tokens?.placeables ?? []).filter(t => {
    if (!t.actor || t.id === sourceToken.id) return false;
    if (!t.actor.flags?.[FLAG_SCOPE]?.hasStructure) return false;
    const dx = (t.center?.x ?? 0) - sx;
    const dy = (t.center?.y ?? 0) - sy;
    return Math.hypot(dx, dy) <= rangePx;
  });

  if (!candidates.length) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-size:0.74rem; opacity:0.7; font-style:italic; padding:0.3rem 0.6rem;">
        ⚒ Shockwave Footing — no Structure tokens within ${RANGE_FT} ft of ${foundry.utils.escapeHTML(actor.name)}.
      </div>`
    });
    return;
  }

  const api = game.bbttcc?.api?.structures;
  const FAMILIES = api?.FAMILIES ?? {};
  const chipped = [];
  for (const tok of candidates) {
    const tgt = tok.actor;
    const bom = tgt.getFlag(FLAG_SCOPE, "materialBOM") ?? [];
    if (!bom.length) continue;
    // Find fragile-most non-sephirotic family present
    const sorted = [...bom].filter(r => Number(r.qty) > 0).sort((a, b) => {
      const fa = FAMILIES[a.family]?.chipOrder ?? 99;
      const fb = FAMILIES[b.family]?.chipOrder ?? 99;
      if (fa !== fb) return fa - fb;
      const ta = a.tier === "I" ? 1 : a.tier === "II" ? 2 : a.tier === "III" ? 3 : 4;
      const tb = b.tier === "I" ? 1 : b.tier === "II" ? 2 : b.tier === "III" ? 3 : 4;
      return ta - tb;
    });
    if (!sorted.length) continue;
    const pick = sorted[0];
    const newBom = bom.map(r => r.materialKey === pick.materialKey && r.tier === pick.tier && r.qty === pick.qty
      ? { ...r, qty: Math.max(0, r.qty - 1) }
      : r
    ).filter(r => Number(r.qty) > 0);
    await tgt.setFlag(FLAG_SCOPE, "materialBOM", newBom);
    chipped.push({ structName: tgt.name, mat: pick.name ?? pick.materialKey, family: pick.family });
  }

  const rowsHtml = chipped.length
    ? chipped.map(c => `<li><b>${foundry.utils.escapeHTML(c.structName)}</b> — chipped 1× ${foundry.utils.escapeHTML(c.mat)} <span style="opacity:0.55">(${foundry.utils.escapeHTML(c.family)})</span></li>`).join("")
    : `<li style="opacity:0.5; font-style:italic">No materials chipped (structures within range had empty BOMs).</li>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div style="border:1px solid #c08060; padding:0.4rem 0.6rem; background:#1a1611; color:#e8c8a0; font-family:sans-serif">
      <div style="font-size:0.76rem; color:#e8c8a0; letter-spacing:0.08em;">
        ⚒ SHOCKWAVE FOOTING — ${candidates.length} structure${candidates.length === 1 ? "" : "s"} in range
      </div>
      <ul style="margin:4px 0 0 18px; padding:0; font-size:0.72rem;">${rowsHtml}</ul>
    </div>`
  });
}

// ── Ruin to Renewal ─────────────────────────────────────────────────────────
// Opens a follow-up dialog: pick a target Structure + a faction to deposit to;
// roll Faith or Economy attribute vs DC 15. On success, deposit 100% of the
// Structure's BOM into the faction stockpile via the existing stockpile API.

async function _onRenewal(actor) {
  const stockApi = game.bbttcc?.api?.factions?.stockpile;
  if (!stockApi?.adjust) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-size:0.74rem; opacity:0.7; padding:0.3rem 0.6rem;">
        ⚒ Ruin to Renewal — faction stockpile API not loaded.
      </div>`
    });
    return;
  }

  // Candidate structures = all hasStructure actors on canvas, prioritized:
  // selected token first, then any structure tokens in Breached/Razed state
  // (Renewal targets compromised structures).
  const structureTokens = (canvas?.tokens?.placeables ?? []).filter(t =>
    t.actor?.flags?.[FLAG_SCOPE]?.hasStructure);
  if (!structureTokens.length) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-size:0.74rem; opacity:0.7; padding:0.3rem 0.6rem;">
        ⚒ Ruin to Renewal — no Structure tokens on the canvas.
      </div>`
    });
    return;
  }

  const targetOptions = structureTokens.map(t => {
    const state = t.actor.getFlag(FLAG_SCOPE, "state") ?? "intact";
    return `<option value="${t.actor.id}">${foundry.utils.escapeHTML(t.actor.name)} — ${state}</option>`;
  }).join("");

  // Factions are type:"npc" + isFaction flag, so the old `type==="character"`
  // check matched nothing. Route through actorKind (faction-kind), strict fallback.
  const factions = (game.actors?.contents ?? []).filter(a =>
    (game.bbttcc?.api?.actorKind?.(a)
      ?? (a?.flags?.["bbttcc-factions"]?.isFaction === true ? "faction" : a?.type)) === "faction");
  if (!factions.length) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-size:0.74rem; opacity:0.7; padding:0.3rem 0.6rem;">
        ⚒ Ruin to Renewal — no faction actors found to deposit reclaimed BOM to.
      </div>`
    });
    return;
  }
  const factionOptions = factions.map(f => `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`).join("");

  new Dialog({
    title: "Ruin to Renewal — Reclamation",
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0; min-width: 400px;">
        <p style="margin:0; font-size:0.78rem">
          <b>${foundry.utils.escapeHTML(actor.name)}</b> attempts to reclaim a compromised Structure's BOM into a faction stockpile. Faith or Economy vs DC 15.
        </p>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Target Structure</span>
          <select name="targetId">${targetOptions}</select>
        </label>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Faction to deposit reclaimed BOM into</span>
          <select name="factionId">${factionOptions}</select>
        </label>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Roll attribute</span>
          <select name="attribute">
            <option value="faith">Faith</option>
            <option value="economy">Economy</option>
          </select>
        </label>
        <p style="margin:0; font-size:0.7rem; opacity:0.55; font-style:italic">
          On success: 100% of remaining BOM flows into the faction's stockpile via the standard adjust API. The Structure becomes Razed and its BOM is cleared.
        </p>
      </div>
    `,
    buttons: {
      roll: {
        label: "Roll vs DC 15",
        callback: async (html) => {
          const targetId   = html.find("[name='targetId']").val();
          const factionId  = html.find("[name='factionId']").val();
          const attrKey    = html.find("[name='attribute']").val();
          const target  = game.actors.get(targetId);
          const faction = game.actors.get(factionId);
          if (!target || !faction) return ui.notifications?.warn?.("Pick a target and a faction.");

          // Attribute value lookup — fourththing stores attrs at system.attributes.<key>.value
          const rawSys = actor.system?.system ?? actor.system;
          const attrVal = Number(rawSys?.attributes?.[attrKey]?.value) || 0;
          const roll = new Roll(`1d20 + ${attrVal}`);
          await roll.evaluate();
          const total = Number(roll.total) || 0;
          const success = total >= 15;

          await roll.toMessage({
            flavor: `${actor.name} — Ruin to Renewal (${attrKey} ${attrVal >= 0 ? "+" : ""}${attrVal}) vs DC 15`,
            speaker: ChatMessage.getSpeaker({ actor })
          });

          if (!success) {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor }),
              content: `<div style="border:1px solid #804040; padding:0.4rem 0.6rem; background:#1a1611; color:#e8a0a0; font-family:sans-serif">
                <div style="font-size:0.76rem; color:#e8a0a0; letter-spacing:0.08em;">⚒ RUIN TO RENEWAL — failed (${total} vs DC 15)</div>
                <div style="font-size:0.72rem; opacity:0.7; margin-top:3px">The purification falters. No BOM recovered.</div>
              </div>`
            });
            return;
          }

          // Success — deposit each BOM entry into the faction stockpile
          const bom = target.getFlag(FLAG_SCOPE, "materialBOM") ?? [];
          const deposited = [];
          for (const r of bom) {
            const qty = Math.max(0, Number(r.qty) || 0);
            if (qty <= 0) continue;
            await stockApi.adjust(faction, r.materialKey, +qty, {
              name: r.name ?? r.materialKey,
              img:  "icons/svg/mystery-man.svg"
            });
            deposited.push({ key: r.materialKey, name: r.name ?? r.materialKey, qty });
          }

          // Clear the Structure: state razed, BOM empty
          await target.update({
            [`flags.${FLAG_SCOPE}.materialBOM`]: [],
            [`flags.${FLAG_SCOPE}.plates.current`]: 0,
            [`flags.${FLAG_SCOPE}.loadBearing`]: false,
            [`flags.${FLAG_SCOPE}.state`]: "razed",
            [`flags.${FLAG_SCOPE}.reclaimedBy`]: { factionId: faction.id, by: actor.id, ts: Date.now() }
          });

          const rowsHtml = deposited.length
            ? deposited.map(d => `<li>${foundry.utils.escapeHTML(d.name)} <b>×${d.qty}</b></li>`).join("")
            : `<li style="opacity:0.5; font-style:italic">No BOM remaining to reclaim.</li>`;

          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div style="border:2px solid #d9c47a; padding:0.5rem 0.7rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
              <div style="font-size:0.82rem; color:#d9c47a; letter-spacing:0.1em;">
                ⚜ RUIN TO RENEWAL — success (${total} vs DC 15)
              </div>
              <div style="font-size:0.74rem; margin-top:4px;">
                <b>${foundry.utils.escapeHTML(target.name)}</b> reclaimed for <b>${foundry.utils.escapeHTML(faction.name)}</b>:
              </div>
              <ul style="margin:4px 0 0 18px; padding:0; font-size:0.72rem;">${rowsHtml}</ul>
              <div style="margin-top:5px; font-size:0.7rem; font-style:italic; opacity:0.7">
                The structure stands as rubble; its substance is recovered.
              </div>
            </div>`
          });
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "roll"
  }).render(true);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Best-effort: find a faction the Bulwark is associated with. Order:
 *   1. If actor has flags.bbttcc-factions.affiliation set, use that
 *   2. If actor has system.identity.factionOwnerId set, use that
 *   3. If actor is the active user's character and there's exactly one faction
 *      they own, use that
 *   4. Null — caller posts a "no faction" note instead of stamping
 */
function _findFactionForActor(actor) {
  if (!actor) return null;
  const affil = actor.getFlag?.("bbttcc-factions", "affiliation");
  if (affil) {
    const f = game.actors?.get(affil);
    if (f) return f;
  }
  const sys = actor.system?.system ?? actor.system;
  const ownerId = sys?.identity?.factionOwnerId;
  if (ownerId) {
    const f = game.actors?.get(ownerId);
    if (f) return f;
  }
  return null;
}

// ── Wedge: capture source actor at applyDamageFromButton entry ──────────────

function installSourceCaptureWedge() {
  const rolls = game?.fourththing?.rolls;
  if (!rolls?.applyDamageFromButton) {
    console.warn(TAG, "applyDamageFromButton not found; source-capture wedge cannot install");
    return;
  }
  const original = rolls.applyDamageFromButton;
  rolls.applyDamageFromButton = async function wrappedApplyDamageFromButton(btn) {
    // Capture source actor from the button's item UUID before delegating
    try {
      const itemUuid = btn?.dataset?.itemUuid ?? "";
      if (itemUuid) {
        const item = await (foundry.utils?.fromUuid ?? fromUuid)?.(itemUuid).catch(() => null);
        const src = item?.parent ?? null;
        if (src?.documentName === "Actor") _setActiveDamageSource(src);
      }
    } catch (_e) { /* swallow */ }
    try {
      return await original.call(this, btn);
    } finally {
      _setActiveDamageSource(null);
    }
  };
  console.log(TAG, "source-capture wedge installed on applyDamageFromButton");
}

// ── Install ─────────────────────────────────────────────────────────────────

Hooks.once("ready", () => {
  Hooks.on("createChatMessage", _onRuinCard);
  installSourceCaptureWedge();
  console.log(TAG, "Bulwark hookups installed");

  // Expose for diagnostic + tests
  if (game.bbttcc?.api?.structures) {
    game.bbttcc.api.structures.bulwark = {
      getActiveDamageSource,
      consumeCatastrophicEntry,
      _onCatastrophicEntry,
      _onSiegeCost,
      _onShockwave,
      _onRenewal
    };
  }
});
