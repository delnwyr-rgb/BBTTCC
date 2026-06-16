/* siege-bombardment-diag.macro.js — paste into the F12 console (or run as a script macro).
 *
 * The siege boulder volley "didn't fire" after the PIXI v8 / Foundry v14 port. The volley
 * (_playProjectileVolley in siege-vfx.js) silently returns false at several guard points:
 *   - Sequencer not active / globalThis.Sequence missing
 *   - JB2A keys don't resolve (entryExists/searchFor return nothing)
 *   - a Sequencer call (e.g. stretchTo) throws on v14
 *
 * This walks each layer in isolation and prints a PASS/FAIL trail so we know EXACTLY which
 * layer is broken — is it Sequencer, JB2A asset resolution, the migrated stretchTo path, or
 * the module's own wiring? Run as GM. Watch the canvas AND the console.
 */
(async () => {
  const TAG = "%c[siege-diag]";
  const CSS = "color:#d9a441;font-weight:bold";
  const L = (...a) => console.log(TAG, CSS, ...a);

  // ── 1. Environment ──────────────────────────────────────────────────────────
  const env = {
    foundry: game.version ?? game.data?.version,
    pixi: globalThis.PIXI?.VERSION,
    isGM: !!game.user?.isGM,
    canvasReady: !!canvas?.ready,
    sequencerActive: !!game.modules.get("sequencer")?.active,
    SequenceCtor: typeof globalThis.Sequence,
    SequencerDB: !!globalThis.Sequencer?.Database,
    jb2a_free: !!game.modules.get("JB2A_DnD5e")?.active,
    jb2a_patreon: !!game.modules.get("jb2a_patreon")?.active,
    raidSiegeApi: !!game.bbttcc?.api?.siege,
    siegeVfxLoaded: !!globalThis.__bbttcc_siege_vfx_loaded_v1,
  };
  console.table(env);
  if (!env.sequencerActive || env.SequenceCtor !== "function") {
    L("❌ STOP: Sequencer is not active / Sequence ctor missing. Nothing canvas-side can fire. Enable the Sequencer module.");
    return;
  }
  if (!env.jb2a_free && !env.jb2a_patreon) {
    L("⚠ WARNING: no JB2A module detected as active — asset keys will not resolve. Continuing to confirm.");
  }

  const db = globalThis.Sequencer?.Database;

  // ── 2. JB2A asset resolution (the boulder family) ───────────────────────────
  const candidates = ["jb2a.boulder.toss.01", "jb2a.boulder.toss", "jb2a.catapult.boulder"];
  const searches   = ["boulder", "catapult", "rock", "explosion"];
  L("— entryExists() on boulder candidates —");
  for (const c of candidates) {
    let ok = "(threw)"; try { ok = db?.entryExists?.(String(c)); } catch (e) { ok = "ERR " + e.message; }
    L("   entryExists", c, "=>", ok);
  }
  const firstString = (hits) => {
    const arr = Array.isArray(hits) ? hits : (hits ? Object.values(hits) : []);
    return arr.find((p) => typeof p === "string" && p.length) || null;
  };
  L("— searchFor() —");
  let resolvedImpact = null, resolvedProj = null;
  for (const s of searches) {
    let hits = null; try { hits = db?.searchFor?.(String(s)); } catch (e) { L("   searchFor THREW", s, e); continue; }
    const arr = Array.isArray(hits) ? hits : (hits ? Object.values(hits) : []);
    const first = firstString(hits);
    L("   searchFor", s, "=>", arr.length, "hits; first:", first);
    if (!resolvedImpact && /explos/i.test(s)) resolvedImpact = first;
    if (!resolvedProj && /(boulder|catapult|rock)/i.test(s)) resolvedProj = first;
  }
  // entryExists wins for the projectile if available
  for (const c of candidates) { try { if (db?.entryExists?.(c)) { resolvedProj = c; break; } } catch (e) {} }
  L("RESOLVED projectile asset:", resolvedProj);
  L("RESOLVED impact asset:", resolvedImpact);

  // ── 3. Center to aim at ─────────────────────────────────────────────────────
  const p = canvas?.stage?.pivot;
  const ctr = (p && Number.isFinite(p.x)) ? { x: Number(p.x), y: Number(p.y) }
            : (canvas?.dimensions?.sceneRect ? { x: canvas.dimensions.sceneRect.x + canvas.dimensions.sceneRect.width / 2, y: canvas.dimensions.sceneRect.y + canvas.dimensions.sceneRect.height / 2 } : { x: 1000, y: 1000 });
  const gs = Number(canvas?.grid?.size || 100);
  L("aim center:", ctr, "gridSize:", gs);

  // ── 4. RAW static effect (no stretch) — does Sequencer render AT ALL on v14? ─
  if (resolvedImpact) {
    try {
      await new Sequence().effect().file(resolvedImpact).atLocation(ctr).size(gs * 5).play();
      L("✅ RAW static impact effect PLAYED — Sequencer + JB2A render fine on v14.");
    } catch (e) { L("❌ RAW static effect THREW:", e); }
  } else {
    L("⚠ skipped static test — no impact asset resolved (JB2A keys missing).");
  }

  // ── 5. RAW stretchTo effect — isolates the migrated stretch/tiling path ──────
  if (resolvedProj) {
    const src = { x: ctr.x, y: ctr.y + gs * 8 };
    try {
      await new Sequence().effect().file(resolvedProj).atLocation(src).stretchTo(ctr, { tiling: false }).scale(1.8).play();
      L("✅ RAW stretchTo effect PLAYED — the migrated tiling:false path works.");
    } catch (e) { L("❌ RAW stretchTo THREW (this is the v14 stretch/tiling crash):", e); }
  } else {
    L("⚠ skipped stretchTo test — no projectile asset resolved.");
  }

  // ── 6. The module's own API ─────────────────────────────────────────────────
  if (!game.bbttcc?.api?.siege) {
    L("❌ game.bbttcc.api.siege is UNDEFINED — siege-vfx.js did not install. Check it's in the module's esmodules/scripts and the world loaded it.");
    return;
  }
  try {
    L("→ previewVfx('bombardment', {volley:2}) …  (banner + GM volley)");
    game.bbttcc.api.siege.previewVfx("bombardment", { volley: 2 });
  } catch (e) { L("❌ previewVfx threw:", e); }

  await new Promise((r) => setTimeout(r, 1500));
  try {
    L("→ projectile({family:'boulder', count:3, banner:'⛰ TEST'}) …  (full relayed path)");
    game.bbttcc.api.siege.projectile({ family: "boulder", count: 3, banner: "⛰ Bombardment TEST" });
  } catch (e) { L("❌ projectile threw:", e); }

  L("diag complete — report which ✅/❌/⚠ lines you saw and I'll target the fix.");
})();
