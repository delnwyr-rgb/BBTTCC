/* bbttcc-fx-integration/integrations/jb2a-db-heal.js
 *
 * Self-heal: ensure JB2A's assets are registered in Sequencer.Database.
 *
 * THE BUG (diagnosed live 2026-06-15 on Foundry 14.364 + Sequencer 4.2.2 +
 * JB2A_DnD5e 0.9.0 / jb2a_patreon 0.8.9): JB2A registers its database from a
 * `Hooks.on("sequencer.ready", …)` listener (JB2A_DnD5e/scripts/jb2a.js ~L84).
 * On this stack that registration loses a load-order race, so Sequencer.Database
 * ends up with ONLY the "psfx" namespace and NO "jb2a.*" keys. Every bbttcc
 * custom VFX looks up a jb2a.* key (fx-engine.jb2aEntryExists) → not found →
 * the effect dies on a null lookup. Automated Animations is unaffected because
 * it references JB2A by direct file paths, not Sequencer.Database keys — which
 * is why "AA works but our custom stuff doesn't."
 *
 * THE FIX: after boot, if jb2a is missing, re-run JB2A's own registration
 * (mirrors JB2A_DnD5e/scripts/jb2a.js: merge free+patreon by version, then
 * Sequencer.Database.registerEntries("jb2a", …)). Idempotent — does nothing
 * when jb2a is already present. Proven on this install: re-firing sequencer.ready
 * registered jb2a (209 paths); this does the same surgically, every boot.
 */
(() => {
  const TAG = "[bbttcc/jb2a-heal]";
  const PROBE = "jb2a.explosion.01.orange";

  const registered = () => {
    try { return !!globalThis.Sequencer?.Database?.entryExists?.(PROBE); }
    catch { return false; }
  };

  // Mirror JB2A's own (version-aware) registration. Returns true if jb2a is
  // present afterwards. deepClone avoids mutating the modules' api objects
  // (foundry mergeObject mutates its first argument).
  function healDirect() {
    const db = globalThis.Sequencer?.Database;
    if (!db) return false;
    const freeMod = game.modules.get("JB2A_DnD5e");
    const patMod = game.modules.get("jb2a_patreon");
    const free = freeMod?.api?.freeDatabase;
    const patreon = patMod?.api?.patreonDatabase;
    try {
      if (free && patreon) {
        const merged = foundry.utils.isNewerVersion(freeMod.version, patMod.version)
          ? foundry.utils.mergeObject(foundry.utils.deepClone(patreon), free)
          : foundry.utils.mergeObject(foundry.utils.deepClone(free), patreon);
        db.registerEntries("jb2a", merged);
      } else if (free) {
        db.registerEntries("jb2a", free);
      } else if (patreon) {
        db.registerEntries("jb2a", patreon);
      } else {
        return false; // JB2A api not exposed yet — caller will retry
      }
    } catch (e) {
      // Fallback to the proven path: re-fire the hook JB2A listens on.
      console.warn(`${TAG} direct register threw; re-firing sequencer.ready`, e);
      try { Hooks.callAll("sequencer.ready"); } catch (_e) {}
    }
    return registered();
  }

  Hooks.once("ready", () => {
    if (registered()) { console.log(`${TAG} jb2a already registered — no heal needed`); return; }
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (registered()) { clearInterval(iv); return; } // JB2A registered on its own
      const apiReady = game.modules.get("JB2A_DnD5e")?.api?.freeDatabase
        || game.modules.get("jb2a_patreon")?.api?.patreonDatabase;
      if (globalThis.Sequencer?.Database && apiReady) {
        const ok = healDirect();
        let n = 0; try { n = Sequencer.Database.getPathsUnder("jb2a").length; } catch (_e) {}
        console.log(`${TAG} healed jb2a registration → present=${ok} (jb2a paths: ${n})`);
        clearInterval(iv);
      } else if (tries > 40) { // ~16s
        console.warn(`${TAG} gave up — Sequencer/JB2A api never became available`);
        clearInterval(iv);
      }
    }, 400);
  });
})();
