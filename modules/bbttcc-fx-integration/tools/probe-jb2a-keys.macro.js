/*
 * probe-jb2a-keys.macro.js — RUN IN-WORLD (GM). Read-only.
 *
 * Dumps the ACTUAL Sequencer/JB2A keys your install has under the families the
 * doctrine-VFX variety pass wants to use (nature, melee weapons, smoke, ordnance,
 * lightning, necrotic, healing, shields, portals). Paste the console output back so
 * the thematic keys can be locked to the exact strings this world resolves.
 */
const DB = globalThis.Sequencer?.Database;
if (!DB) return ui.notifications.error("[probe] Sequencer.Database not found — is Sequencer active?");

// Roots to explore (one line per family we care about for doctrine variety).
const ROOTS = [
  "jb2a.entangle", "jb2a.entangle.01", "jb2a.entangle.02",
  "jb2a.sword", "jb2a.melee_generic", "jb2a.dagger", "jb2a.greatsword", "jb2a.mace", "jb2a.unarmed_strike", "jb2a.spear",
  "jb2a.toll_the_dead", "jb2a.necrotic", "jb2a.energy_strands",
  "jb2a.smoke", "jb2a.smoke_puff", "jb2a.fog_cloud",
  "jb2a.catapult", "jb2a.boulder", "jb2a.ballista", "jb2a.flaming_boulder", "jb2a.trebuchet",
  "jb2a.lightning_strike", "jb2a.chain_lightning", "jb2a.static_electricity", "jb2a.lightning",
  "jb2a.healing_generic", "jb2a.cure_wounds",
  "jb2a.shield", "jb2a.portals", "jb2a.eruption", "jb2a.fireball"
];

// Recursively collect leaf keys under a path (a leaf = entryExists true). Cap to avoid spam.
const leaves = (root, cap = 24) => {
  const out = [];
  const walk = (p, depth) => {
    if (out.length >= cap || depth > 6) return;
    let subs = [];
    try { subs = DB.getPathsUnder?.(p) || []; } catch { subs = []; }
    if (!subs.length) { // p itself may be a leaf
      try { if (DB.entryExists?.(p)) out.push(p); } catch {}
      return;
    }
    for (const s of subs) {
      if (out.length >= cap) break;
      const child = `${p}.${s}`;
      try { if (DB.entryExists?.(child)) out.push(child); } catch {}
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return [...new Set(out)].slice(0, cap);
};

console.log("%c=== JB2A key probe (paste this back) ===", "font-weight:bold;font-size:14px");
for (const root of ROOTS) {
  const found = leaves(root);
  const exact = (() => { try { return DB.entryExists?.(root); } catch { return false; } })();
  if (!found.length && !exact) { console.log(`%c${root}`, "color:#e06c75", "→ (nothing)"); continue; }
  console.log(`%c${root}`, "color:#98c379", exact ? "[EXACT KEY EXISTS]" : "");
  for (const k of found) console.log("    " + k);
}
ui.notifications.info("[probe] JB2A key dump in console (F12) — copy the whole block back to your partner.");
