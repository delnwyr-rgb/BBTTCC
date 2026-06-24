// modules/bbttcc-raid/scripts/orbital-strike.js
//
// Bad Eden — Orbital Bombardment ("Hammer of God")
// ─────────────────────────────────────────────────────────────────────────────
// An Orbital Bunker (a Space-domain rig, from the air vertical) can call down a
// telegraphed area strike on the battle scene below: a pulsing target reticle,
// then a column of fire, a shockwave, screen-shake, and falloff AoE damage to
// everyone in the blast. Indiscriminate by default — danger close.
//
// API:  game.bbttcc.api.raid.orbitalStrike({
//          factionId?, bunkerId?, x?, y?, sceneId?,
//          radiusGrid?=4, damage?=40, damageType?="kinetic",
//          scope?="all"|"enemies"|"allies", telegraphMs?=2200,
//          opCost?=30, cooldownRounds?=3, bypassCost?, bypassCooldown? })
//
// Gating: the faction must own an Orbital Bunker (rig with travel.domains
// including "space"). Costs Violence OP; recharges a few combat rounds.
// VFX are self-contained PIXI (always render) + best-effort transition shake/flash.
// ─────────────────────────────────────────────────────────────────────────────
(() => {
  const TAG = "[bbttcc-raid/orbital-strike]";
  const MOD = "bbttcc-raid";

  const _sys = (a) => a?.system?.system ?? a?.system ?? {};
  const _rigDomains = (rig) => {
    const d = _sys(rig)?.travel?.domains;
    return Array.isArray(d) ? d.map(x => String(x).toLowerCase()) : ["land"];
  };
  const _rigFaction = (rig) =>
    String(_sys(rig)?.identity?.factionOwnerId || rig?.flags?.["bbttcc-factions"]?.factionId || "");

  // Find an orbital bunker (space-domain rig) for the faction, else any.
  function findOrbitalBunker(factionId) {
    const cands = (game.actors?.contents || []).filter(a => a.type === "rig" && _rigDomains(a).includes("space"));
    if (factionId) return cands.find(a => _rigFaction(a) === String(factionId)) || null;
    return cands[0] || null;
  }

  function _actorFactionId(actor) {
    return String(actor?.flags?.["bbttcc-factions"]?.factionId
      || foundry.utils.getProperty(actor, "system.system.identity.factionOwnerId")
      || foundry.utils.getProperty(actor, "flags.bbttcc-factions.factionId") || "");
  }

  function _tokenCenter(tok, scene) {
    if (tok.object?.center) return tok.object.center;
    const gs = scene.grid?.size || canvas?.grid?.size || 100;
    return { x: Number(tok.x) + (Number(tok.width || 1) * gs) / 2, y: Number(tok.y) + (Number(tok.height || 1) * gs) / 2 };
  }

  function _shakeFlash() {
    const t = game.bbttcc?.api?.transition;
    try { t?.shake?.(); } catch (_e) {}
    try { t?.flash?.("#ffd9a0"); } catch (_e) {}
  }

  // Self-contained PIXI telegraph → impact animation. Calls onDetonate exactly
  // once, at the moment the column lands.
  function _runStrikeVfx(x, y, blastPx, { telegraphMs = 2200, onDetonate } = {}) {
    return new Promise((resolve) => {
      const parent = canvas?.interface || canvas?.stage;
      if (!parent || !canvas?.app?.ticker) { try { onDetonate?.(); } catch (_e) {} return resolve(); }
      const root = new PIXI.Container();
      root.zIndex = 999999; root.eventMode = "none"; root.sortableChildren = true;
      parent.addChild(root); parent.sortableChildren = true;
      const g = new PIXI.Graphics();
      root.addChild(g);

      const impactMs = 950;
      let elapsed = 0, detonated = false;

      const cleanup = () => {
        try { canvas.app.ticker.remove(tick); } catch (_e) {}
        try { if (root.parent) root.parent.removeChild(root); } catch (_e) {}
        try { root.destroy({ children: true }); } catch (_e) {}
        resolve();
      };

      const tick = () => {
        elapsed += canvas.app.ticker.deltaMS;
        g.clear();
        if (elapsed < telegraphMs) {
          // Targeting reticle: pulsing red ring + crosshair.
          const pulse = 0.35 + 0.45 * Math.abs(Math.sin(elapsed / 170));
          g.lineStyle(3, 0xff3b3b, pulse);
          g.drawCircle(x, y, blastPx);
          g.lineStyle(2, 0xff7a7a, pulse * 0.9);
          g.drawCircle(x, y, blastPx * 0.55);
          g.lineStyle(2, 0xff5050, pulse);
          g.moveTo(x - blastPx * 1.15, y); g.lineTo(x + blastPx * 1.15, y);
          g.moveTo(x, y - blastPx * 1.15); g.lineTo(x, y + blastPx * 1.15);
        } else {
          if (!detonated) { detonated = true; try { onDetonate?.(); } catch (_e) {} }
          const it = (elapsed - telegraphMs) / impactMs; // 0..1
          if (it >= 1) return cleanup();
          // Column of fire from the top of the canvas down to the impact point.
          g.lineStyle(Math.max(3, 30 * (1 - it)), 0xfff2cc, (1 - it) * 0.9);
          g.moveTo(x, 0); g.lineTo(x, y);
          // Inner white flash, early.
          if (it < 0.32) { g.beginFill(0xffffff, 0.65 * (1 - it / 0.32)); g.drawCircle(x, y, blastPx * 0.5); g.endFill(); }
          // Expanding shockwave ring.
          const r = blastPx * (0.2 + 1.25 * it);
          g.lineStyle(Math.max(2, 20 * (1 - it)), 0xffb060, (1 - it));
          g.drawCircle(x, y, r);
          const r2 = blastPx * (0.05 + 0.9 * it);
          g.lineStyle(Math.max(1, 10 * (1 - it)), 0xff8030, (1 - it) * 0.8);
          g.drawCircle(x, y, r2);
        }
      };
      canvas.app.ticker.add(tick);
    });
  }

  async function _detonate(scene, x, y, blastPx, { damage, damageType, scope, factionId }) {
    const apply = game.bbttcc?.combat?.applyDamage
      || ((a, d, o) => game.fourththing?.rolls?._applyDamageToActor?.(a, d, o));
    const hits = [];
    for (const tok of (scene.tokens?.contents || [])) {
      const actor = tok.actor;
      if (!actor) continue;
      // Scope: "all" hits everyone (default — it's an orbital strike); "enemies"
      // spares your own faction; "allies" hits only your own.
      if (scope === "enemies" && factionId && _actorFactionId(actor) === String(factionId)) continue;
      if (scope === "allies"  && factionId && _actorFactionId(actor) !== String(factionId)) continue;
      const c = _tokenCenter(tok, scene);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist > blastPx) continue;
      // Falloff: full at ground zero, 40% at the rim.
      const f = 1 - 0.6 * (dist / blastPx);
      const dmg = Math.max(1, Math.round(damage * f));
      try {
        await apply(actor, dmg, { track: "integrity", damageType, source: "orbital-strike" });
        hits.push({ name: actor.name, dmg });
      } catch (e) { console.warn(TAG, "damage apply failed", tok.id, e); }
    }
    const body = hits.length
      ? hits.sort((a, b) => b.dmg - a.dmg).map(h => `${foundry.utils.escapeHTML(h.name)}: −${h.dmg}`).join("<br>")
      : "…nothing was caught in the blast.";
    ChatMessage.create({
      content: `<div class="fourththing-roll"><b style="color:#ffb060;">🛰️💥 HAMMER OF GOD</b> — orbital strike lands! ${hits.length} caught in the blast:<br>${body}</div>`
    });
  }

  async function orbitalStrike(opts = {}) {
    if (!game.user?.isGM) { ui.notifications?.warn?.("Orbital strike: GM only."); return { ok: false, reason: "not-gm" }; }
    const scene = opts.sceneId ? game.scenes?.get(opts.sceneId) : canvas?.scene;
    if (!scene) return { ok: false, reason: "no-scene" };

    let factionId = opts.factionId ? String(opts.factionId) : null;
    let bunker = opts.bunkerId ? game.actors?.get(opts.bunkerId) : null;
    if (!bunker) bunker = findOrbitalBunker(factionId);
    if (!bunker) {
      const m = "No Orbital Bunker available — build a Space-domain rig (Rig Builder → Orbital Bunker).";
      ui.notifications?.warn?.(m); return { ok: false, reason: "no-bunker", message: m };
    }
    factionId = factionId || _rigFaction(bunker) || null;

    // Cooldown (combat only): a few rounds between strikes.
    const cd = Number(opts.cooldownRounds ?? 3);
    if (!opts.bypassCooldown && game.combat?.started) {
      const last = Number(bunker.getFlag(MOD, "orbitalLastRound") ?? -999);
      const round = Number(game.combat.round || 0);
      if (round - last < cd) {
        const m = `Orbital strike recharging — ${cd - (round - last)} round(s) left.`;
        ui.notifications?.warn?.(m); return { ok: false, reason: "cooldown", message: m };
      }
    }

    // Cost: Violence OP from the firing faction.
    const cost = Number(opts.opCost ?? 30);
    if (!opts.bypassCost && factionId && cost > 0) {
      const op = game.bbttcc?.api?.op;
      if (op?.commit) {
        const r = await op.commit(factionId, { violence: -cost }, { context: "orbital-strike", bunker: bunker.name });
        if (!r?.ok) { const m = `Not enough Violence OP for the strike (needs ${cost}).`; ui.notifications?.warn?.(m); return { ok: false, reason: "cost", message: m }; }
      }
    }

    // Target point — explicit, else selected token, else scene center.
    let x = Number(opts.x), y = Number(opts.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      const sel = canvas.tokens?.controlled?.[0];
      if (sel?.center) { x = sel.center.x; y = sel.center.y; }
      else { x = scene.width / 2; y = scene.height / 2; }
    }

    const gridSize = scene.grid?.size || canvas?.grid?.size || 100;
    const radiusGrid = Number(opts.radiusGrid ?? 4);
    const blastPx = radiusGrid * gridSize;
    const damage = Number(opts.damage ?? 40);
    const damageType = opts.damageType || "kinetic";
    const scope = opts.scope || "all";

    ChatMessage.create({
      content: `<div class="fourththing-roll"><b style="color:#ff5050;">⚠️ INCOMING — orbital strike inbound.</b> ${foundry.utils.escapeHTML(bunker.name)} has a firing solution. Danger close at the marked point.</div>`
    });

    await _runStrikeVfx(x, y, blastPx, {
      telegraphMs: Number(opts.telegraphMs ?? 2200),
      onDetonate: () => { _shakeFlash(); _detonate(scene, x, y, blastPx, { damage, damageType, scope, factionId }); }
    });

    if (game.combat?.started) { try { await bunker.setFlag(MOD, "orbitalLastRound", Number(game.combat.round || 0)); } catch (_e) {} }
    return { ok: true, bunker: bunker.name, x, y, radiusGrid };
  }

  function install() {
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.api = game.bbttcc.api || {};
    game.bbttcc.api.raid = game.bbttcc.api.raid || {};
    game.bbttcc.api.raid.orbitalStrike = orbitalStrike;
    game.bbttcc.api.raid.findOrbitalBunker = findOrbitalBunker;
    console.log(TAG, "ready. API: game.bbttcc.api.raid.orbitalStrike");
  }
  Hooks.once("ready", install);
  try { if (game?.ready) install(); } catch (_e) {}
})();
