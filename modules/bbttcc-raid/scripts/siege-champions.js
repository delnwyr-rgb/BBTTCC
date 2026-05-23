// bbttcc-raid/scripts/siege-champions.js
// SIEGE_RAID_TYPE_SPEC.md §6 — Phase E.2: champion roster authoring + status state machine.
//
//   • openChampionRosterDialog(factionId) — GM editor for faction.flags.bbttcc-factions.championRoster,
//     with an "auto-suggest top 5" by rough rank (boss tier ×5 / rig tier ×4 / PC level), affiliated first.
//     Surfaced as a "⚔ Champions" button on the faction sheet.
//   • processChampionsTurn(state, turn) — per-campaign-turn status machine: expire championLocks,
//     roll wounded → active recovery (50%/turn). Called by siege-tick.js (single writer per siege/turn,
//     so it never races the supply tick).
//   • computeDefenderBudget(hexUuid) — Anytime budget = holdings (rig×1 + boss×2 + facility×0.5)
//     + active defender champions×2 + wounded×1 + defenderAnytimeBudget (Reinforce / Defends Wall).
//
// Champion statuses (§6): active (+2 budget, can duel) · wounded (+1, 50%/turn recover) ·
// absent (0, deficit penalty) · dead (permanent, cascade in Phase F).

(() => {
  globalThis.__bbttcc_siege_champions_loaded_v1 = Date.now();

  const MOD_F = "bbttcc-factions";
  const MOD_T = "bbttcc-territory";
  const MOD_AL = "bbttcc-auto-link";
  const TAG = "[bbttcc/siege-champions]";

  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const _turn = () => { try { return Number(game.bbttcc?.api?.world?.getState?.()?.turn) || 0; } catch { return 0; } };

  // ─── Candidate ranking ──────────────────────────────────────────────────────

  function _sys(actor){ return actor?.system?.system ?? actor?.system ?? {}; }

  function _actorRank(actor){
    const sys = _sys(actor);
    const kind = actor.getFlag?.(MOD_AL, "entityKind") || actor.type;
    if (kind === "boss") return (Number(sys.integrity?.tier) || 1) * 5;
    if (actor.type === "rig") return (Number(sys.integrity?.tier) || 1) * 4;
    return Number(sys.details?.level) || 1;
  }

  function _affiliated(actor, factionId){
    const owner = foundry.utils.getProperty(actor, "system.identity.factionOwnerId")
               ?? foundry.utils.getProperty(actor, "system.system.identity.factionOwnerId")
               ?? actor.getFlag?.(MOD_F, "factionId")
               ?? actor.getFlag?.(MOD_AL, "factionId");
    return String(owner || "") === String(factionId);
  }

  function _candidates(factionId){
    const S = globalThis.__bbttccSiegeState;
    const isFaction = (a) => S?.isFactionActor ? S.isFactionActor(a) : (a?.type === "faction");
    return (game.actors?.contents || [])
      .filter(a => a && !isFaction(a) && ["character", "npc", "rig"].includes(a.type))
      .map(a => ({
        actorId: a.id,
        name: a.name,
        kind: a.getFlag?.(MOD_AL, "entityKind") || a.type,
        rank: _actorRank(a),
        affiliated: _affiliated(a, factionId)
      }))
      .sort((x, y) => (Number(y.affiliated) - Number(x.affiliated)) || (y.rank - x.rank) || x.name.localeCompare(y.name));
  }

  // ─── Roster authoring dialog ──────────────────────────────────────────────

  function openChampionRosterDialog(factionId){
    if (!game.user?.isGM) return ui.notifications?.warn?.("Only the GM can edit a champion roster.");
    const faction = game.actors?.get?.(factionId);
    if (!faction) return ui.notifications?.warn?.("Faction not found.");

    const current = (faction.getFlag(MOD_F, "championRoster") || []).map(String);
    const currentSet = new Set(current);
    const cands = _candidates(factionId);
    const candIds = new Set(cands.map(c => c.actorId));
    // Keep any current member that isn't in the candidate pool (odd type / stale) so it's not silently dropped.
    const extras = current.filter(id => !candIds.has(id)).map(id => ({ actorId: id, name: game.actors?.get?.(id)?.name || id, kind: "?", rank: 0, affiliated: false }));

    const rows = [...extras, ...cands].map(c =>
      `<option value="${esc(c.actorId)}" ${currentSet.has(c.actorId) ? "selected" : ""}>${esc(c.name)} — ${esc(c.kind)}${c.affiliated ? " ★" : ""} (r${c.rank})</option>`
    ).join("");

    const content = `
      <div style="display:flex;flex-direction:column;gap:.5rem;font-size:0.9rem;">
        <div>Champions for <b>${esc(faction.name)}</b>. Ctrl/Cmd-click to multi-select. ★ = affiliated · r = rank (boss tier×5 / rig tier×4 / level).</div>
        <select name="roster" multiple size="12" style="width:100%;">${rows}</select>
        <div style="display:flex;gap:6px;">
          <button type="button" data-act="suggest" style="flex:1;">✨ Auto-suggest top 5</button>
          <button type="button" data-act="clear" style="flex:1;">Clear</button>
        </div>
      </div>`;

    new Dialog({
      title: `⚔ Champion Roster — ${faction.name}`,
      content,
      buttons: {
        save: {
          icon: '<i class="fas fa-save"></i>',
          label: "Save Roster",
          callback: async (html) => {
            const root = html[0] ?? html;
            const sel = [...root.querySelectorAll('select[name="roster"] option')].filter(o => o.selected).map(o => o.value);
            await faction.setFlag(MOD_F, "championRoster", sel);
            ui.notifications?.info?.(`Champion roster saved: ${sel.length} champion(s) for ${faction.name}.`);
            for (const app of Object.values(faction.apps || {})) { if (app?.rendered) app.render(false); }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "save",
      render: (html) => {
        const root = html[0] ?? html;
        const sel = root.querySelector('select[name="roster"]');
        root.querySelector('[data-act="suggest"]')?.addEventListener("click", () => {
          [...sel.options].forEach((o, i) => { o.selected = i < 5; });
        });
        root.querySelector('[data-act="clear"]')?.addEventListener("click", () => {
          [...sel.options].forEach(o => { o.selected = false; });
        });
      }
    }, { width: 460 }).render(true);
  }

  // ─── Per-turn status machine (called by siege-tick.js before persist) ──────

  function processChampionsTurn(state, turn){
    if (!state) return false;
    const S = globalThis.__bbttccSiegeState;
    let changed = false;

    // Expire Champion Defends Wall locks.
    if (state.championLocks && typeof state.championLocks === "object") {
      for (const [id, until] of Object.entries(state.championLocks)) {
        if (Number(until) < turn) { delete state.championLocks[id]; changed = true; }
      }
    }
    const locked = new Set(Object.keys(state.championLocks || {}));

    // Wounded → active recovery (50%/turn), unless still locked-active.
    const recover = (arr, side) => {
      for (const c of (arr || [])) {
        if (c.status !== "wounded" || locked.has(c.actorId)) continue;
        if (Math.random() < 0.5) {
          c.status = "active";
          c.reason = "recovered";
          changed = true;
          S?.appendNarrativeBeat?.(state, {
            turn,
            kind: "champion_recovered",
            title: `${game.actors?.get?.(c.actorId)?.name || "A champion"} recovers`,
            description: "Wounded → active.",
            actorIds: [c.actorId],
            payload: { side }
          });
        }
      }
    };
    recover(state.attackerChampions, "attacker");
    recover(state.defenderChampions, "defender");
    return changed;
  }

  // ─── Defender Anytime budget ────────────────────────────────────────────────

  async function computeDefenderBudget(hexUuid){
    const S = globalThis.__bbttccSiegeState;
    const state = await S?.getSiegeState?.(hexUuid);
    if (!state) return null;
    const def = state.defenderChampions || [];
    const activeDef = def.filter(c => c.status === "active").length;
    const woundedDef = def.filter(c => c.status === "wounded").length;
    const champBudget = activeDef * 2 + woundedDef * 1;

    let rigs = 0, bosses = 0, facilities = 0;
    try {
      const ref = await fromUuid(hexUuid);
      const doc = ref?.document ?? ref;
      const h = doc?.flags?.[MOD_T]?.holdings || {};
      rigs = (h.rigIds || []).length;
      bosses = (h.bossIds || []).length;
      facilities = (h.facilityIds || []).length;
    } catch (_e) {}
    const holdings = rigs * 1 + bosses * 2 + facilities * 0.5;
    const reinforce = Number(state.defenderAnytimeBudget || 0);
    const total = champBudget + holdings + reinforce;
    return { total, breakdown: { champBudget, activeDef, woundedDef, holdings: { rigs, bosses, facilities, total: holdings }, reinforce } };
  }

  // ─── Faction-sheet button ─────────────────────────────────────────────────

  function _injectRosterButton(app, root){
    if (!root || root.querySelector(".ft-siege-champions-btn")) return;
    const faction = app?.actor;
    if (!faction) return;
    const count = (faction.getFlag(MOD_F, "championRoster") || []).length;
    const target = root.querySelector(".sheet-header, header, .window-content") || root;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ft-siege-champions-btn";
    btn.style.cssText = "margin:.25rem .5rem;padding:3px 8px;font-size:0.8rem;cursor:pointer;";
    btn.innerHTML = `<i class="fas fa-khanda"></i> Champions${count ? ` (${count})` : ""}`;
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openChampionRosterDialog(faction.id); });
    target.insertBefore(btn, target.firstChild);
  }

  Hooks.on("renderBBTTCCFactionSheet", (app, html) => {
    try {
      const root = (html && html[0]) ? html[0] : (app?.element?.[0] || app?.element);
      if (root) _injectRosterButton(app, root);
    } catch (e) { console.warn(TAG, "roster button inject failed", e); }
  });

  // ─── Exposure ────────────────────────────────────────────────────────────
  globalThis.__bbttccSiegeChampions = { processChampionsTurn, computeDefenderBudget, candidates: _candidates };

  Hooks.once("ready", () => {
    game.bbttcc = game.bbttcc || { api: {} };
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.siege = game.bbttcc.api.siege || {};
    game.bbttcc.api.siege.openChampionRosterDialog = openChampionRosterDialog;
    game.bbttcc.api.siege.computeDefenderBudget = computeDefenderBudget;
    game.bbttcc.api.siege.championCandidates = _candidates;
    console.log(TAG, "champion authoring + state machine ready (E.2).");
  });

  console.log(TAG, "loaded");
})();
