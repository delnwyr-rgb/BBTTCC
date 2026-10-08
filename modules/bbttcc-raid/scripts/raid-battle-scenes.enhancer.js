/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-raid · raid-battle-scenes.enhancer.js — battle scenes + the Phase 5 outcome
 * on systems that aren't fourththing (2026-10-08, step-4 parity for dnd5e)
 * ─────────────────────────────────────────────────────────────────────────────
 * On RFI the SYSTEM owns all of this (systems/fourththing/module.js: the
 * `game.bbttcc.api.raid.battleScenes` API, the GM activation relay and the
 * "Phase 5 orchestrator" that wraps raid.applyPostRoundEffects to prompt the
 * next bound battle scene and, on the final one, flip the hex to Occupation).
 * On dnd5e none of that existed. This file is the same behaviour, module-side,
 * and installs ONLY when the system hasn't (`game.system.id !== "fourththing"`).
 * The GM Hex editor (bbttcc-territory/effects-build-units.enhancer.js) binds
 * scenes through the same API, so binding works on dnd5e too.
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const TAG = "[bbttcc-raid/battle-scenes]";
  const MOD = "bbttcc-raid";
  if (game.system?.id === "fourththing") return;

  const list = (hexDoc) => { const raw = hexDoc?.flags?.[MOD]?.battleScenes ?? []; return Array.isArray(raw) ? raw : []; };
  const current = (hexDoc) => Number(hexDoc?.flags?.[MOD]?.currentSceneIdx) || 0;
  const setList = (hexDoc, l) => hexDoc?.update?.({ [`flags.${MOD}.battleScenes`]: l }, { parent: hexDoc.parent ?? null });
  const setCurrent = (hexDoc, idx) => hexDoc?.update?.({ [`flags.${MOD}.currentSceneIdx`]: Math.max(0, Number(idx) || 0) }, { parent: hexDoc.parent ?? null });

  async function bind(hexDoc, scene, opts = {}) {
    if (!hexDoc || !scene) return false;
    const l = list(hexDoc).slice();
    if (l.some(e => e.sceneId === scene.id)) { ui.notifications?.warn(`"${scene.name}" is already bound to this hex.`); return false; }
    l.push({ sceneId: scene.id, label: opts.label || scene.name, order: l.length });
    await setList(hexDoc, l);
    try { await scene.update({ [`flags.${MOD}.battleScene`]: true }); } catch (_e) {}
    ui.notifications?.info(`Bound "${scene.name}" as battle scene ${l.length}.`);
    return true;
  }
  async function unbind(hexDoc, sceneId) {
    if (!hexDoc) return false;
    const l = list(hexDoc).filter(e => e.sceneId !== sceneId);
    await setList(hexDoc, l);
    if (current(hexDoc) >= l.length) await setCurrent(hexDoc, Math.max(0, l.length - 1));
    ui.notifications?.info("Battle scene unbound.");
    return true;
  }
  async function activate(hexDoc, idx) {
    const entry = list(hexDoc)[idx];
    if (!entry) { ui.notifications?.warn(`No bound battle scene at index ${idx + 1}.`); return false; }
    const scene = game.scenes?.get(entry.sceneId);
    if (!scene) { ui.notifications?.warn("Bound scene not found (it may have been deleted)."); return false; }
    if (!game.user?.isGM) {
      game.socket?.emit?.(`module.${MOD}`, { t: "ft-activateBattleScene", sceneId: scene.id, hexUuid: hexDoc?.uuid, idx });
      ui.notifications?.info(`Requesting GM to activate "${scene.name}"…`);
      return true;
    }
    await scene.activate();
    await setCurrent(hexDoc, idx);
    return true;
  }
  const findHexDrawing = (hexId) => { if (!hexId) return null; for (const s of game.scenes ?? []) { const d = s.drawings?.get?.(hexId); if (d) return d; } return null; };

  const waitFor = (fn, ms = 5000, step = 250) => new Promise((res) => { const t0 = Date.now(); const tick = () => { const v = fn(); if (v) return res(v); if (Date.now() - t0 > ms) return res(null); setTimeout(tick, step); }; tick(); });

  Hooks.once("ready", async () => {
    game.bbttcc ??= {}; game.bbttcc.api ??= {}; game.bbttcc.api.raid ??= {};
    if (!game.bbttcc.api.raid.battleScenes) game.bbttcc.api.raid.battleScenes = { list, current, bind, unbind, activate };

    // Player activation requests land on the GM.
    game.socket?.on?.(`module.${MOD}`, async (msg) => {
      if (msg?.t !== "ft-activateBattleScene" || !game.user?.isGM || game.users.activeGM?.id !== game.user.id) return;
      try {
        const scene = game.scenes?.get(msg.sceneId); if (!scene) return;
        await scene.activate();
        const hexDoc = msg.hexUuid ? await fromUuid(msg.hexUuid) : null;
        if (hexDoc) await setCurrent(hexDoc, msg.idx);
      } catch (e) { console.warn(TAG, "activation relay failed", e); }
    });

    // Phase 5: advance through the bound scenes on a successful hex round; the final one = Occupation.
    const raid = await waitFor(() => (typeof game.bbttcc?.api?.raid?.applyPostRoundEffects === "function" ? game.bbttcc.api.raid : null));
    if (!raid) return console.warn(TAG, "raid.applyPostRoundEffects never appeared — Phase 5 not installed");
    if (raid.applyPostRoundEffects.__be5ePhase5) return;
    const orig = raid.applyPostRoundEffects;
    const wrapped = async function phase5Wrap(args = {}) {
      const res = await orig(args);
      try {
        const targetHexId = args?.targetHexId;
        if (!targetHexId || args?.success !== true) return res;
        const hexDoc = findHexDrawing(targetHexId); if (!hexDoc) return res;
        const l = list(hexDoc); if (!l.length) return res;
        const cur = current(hexDoc), next = cur + 1, isFinal = cur >= l.length - 1;
        if (!isFinal) {
          if (!game.user?.isGM) return res;
          const entry = l[next]; const scene = entry ? game.scenes?.get(entry.sceneId) : null;
          if (!scene) return res;
          foundry.applications.api.DialogV2.confirm({
            window: { title: "Advance to Next Battle Scene?" },
            content: `<p>Round resolved successfully. Advance to <b>${foundry.utils.escapeHTML(entry.label || scene.name)}</b> (${next + 1} of ${l.length})?</p>`,
            yes: { callback: () => activate(hexDoc, next) }
          }).catch(() => {});
        } else {
          const attackerId = args?.attackerId ?? null;
          const attacker = attackerId ? game.actors?.get(String(attackerId)) : null;
          if (game.user?.isGM) await hexDoc.update({ [`flags.${MOD}.lastOutcome`]: { kind: "occupation", attackerId, attackerName: attacker?.name || "", timestamp: Date.now() } }, { parent: hexDoc.parent ?? null });
          if (game.user?.isGM && game.users.activeGM?.id === game.user.id) ChatMessage.create({
            content: `<div class="bbttcc-raid-outcome"><p style="margin:0"><b style="color:#a6e22e">⚑ Raid Victory — Hex Outcome: Occupation</b></p>
              <p style="margin:.2rem 0;font-size:0.82rem">Final battle scene resolved. The hex flips to <b>${foundry.utils.escapeHTML(attacker?.name || "the attacker")}</b>'s control.</p>
              <p style="margin:.2rem 0;font-size:0.74rem;opacity:0.75">The GM may apply a liberation outcome instead if the campaign calls for it.</p></div>`
          });
        }
      } catch (e) { console.warn(TAG, "Phase 5 wrap failed", e); }
      return res;
    };
    wrapped.__be5ePhase5 = true;
    raid.applyPostRoundEffects = wrapped;
    console.log(TAG, `battle scenes API + Phase 5 installed (system=${game.system.id})`);
  });
})();
