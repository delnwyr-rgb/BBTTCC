// install-fourththing-autorec.macro.js  — RUN IN-WORLD (GM), then F5.
// Merges the fourththing keyword menu into Automated Animations' Automatic Recognition
// menu WITHOUT clobbering existing entries (appends labels not already present per section).
// AA matches each label as a substring of an item's normalized name; per-item AA flags
// (already stamped on the 136 Surge abilities) take precedence over these fallbacks.
// Fetches the menu from the deployed system path (kept small so it pastes easily).
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (!game.modules.get("autoanimations")?.active) return ui.notifications.error("Automated Animations is not active.");
  const URL = "systems/fourththing/packs/_source/fourththing-autorec.json";
  let MENU;
  try { MENU = await foundry.utils.fetchJsonWithTimeout(URL); }
  catch (e) { return ui.notifications.error("Could not load " + URL + " — is the file deployed? " + e.message); }
  const SECTIONS = ["melee","range","ontoken","templatefx","preset","aura","aefx"];
  const cur = foundry.utils.deepClone(game.settings.get("autoanimations","aaAutorec") || {});
  for (const s of SECTIONS) if (!Array.isArray(cur[s])) cur[s] = [];
  // next id across all sections
  let nextId = 1;
  for (const s of SECTIONS) for (const e of cur[s]) { const n = parseInt(e.id); if (Number.isFinite(n) && n >= nextId) nextId = n + 1; }
  let added = 0, skipped = 0;
  for (const s of SECTIONS) {
    const have = new Set(cur[s].map(e => String(e.label || "").toLowerCase()));
    for (const e of (MENU[s] || [])) {
      if (have.has(String(e.label).toLowerCase())) { skipped++; continue; }
      cur[s].push({ ...foundry.utils.deepClone(e), id: String(nextId++) });
      added++;
    }
  }
  cur.version = Math.max(cur.version || 0, MENU.version || 0);
  await game.settings.set("autoanimations","aaAutorec", cur);
  ui.notifications.info(`fourththing autorec: +${added} keyword labels added, ${skipped} already present. F5 to apply.`);
  console.log("[fourththing] autorec merged:", { added, skipped });
})();
