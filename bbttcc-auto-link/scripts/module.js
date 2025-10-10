// modules/bbttcc-auto-link/scripts/module.js
// v0.7.2 — Call the Character Wizard directly (no dynamic import)
// • Keeps the DOM-native "Create Character (BBTTCC)" button
// • Leaves the safe auto-linking behavior intact
// • Assumes "scripts/character-wizard.js" is listed in module.json esmodules

const MOD = "bbttcc-auto-link";
const LOG = (...a) => console.log(`[${MOD}]`, ...a);
const WARN = (...a) => console.warn(`[${MOD}]`, ...a);

// --- Qualifiers -------------------------------------------------------------
function isCharacter(a) { return String(a?.type ?? "").toLowerCase() === "character"; }

/** Qualifies if the actor has the BBTTCC character flag namespace enabled */
function qualifiesForBBTTCC(a) {
  try {
    const fx = a.flags?.["bbttcc-character-options"];
    return !!fx && (fx.enabled !== false);
  } catch { return false; }
}

/** Preferred custom sheet class id (if/when you register one) */
function preferredSheetClassId() {
  // Example: return "bbttcc-character-sheet.BBTTCCCharacterSheet";
  return undefined; // keep system default for now; our sidepanel injects the BBTTCC card
}

// --- Apply preferred sheet if needed ----------------------------------------
async function applyEnhancedSheetIfNeeded(a) {
  if (!isCharacter(a) || !qualifiesForBBTTCC(a)) return;
  const preferred = preferredSheetClassId();
  if (!preferred) return;
  const current = a.getFlag("core", "sheetClass") || foundry.utils.getProperty(a, "flags.core.sheetClass");
  if (current === preferred) return;
  await a.update({ "flags.core.sheetClass": preferred });
}

// --- Actor Directory: header buttons (DOM-native) ---------------------------
function injectButtons(html) {
  const root = html instanceof HTMLElement ? html : (html?.[0] instanceof HTMLElement ? html[0] : null);
  if (!root) return;

  const header = root.querySelector(".directory-header .header-actions") || root.querySelector(".header-actions");
  if (!header) return;

  // Create Character (BBTTCC) — open wizard directly (no dynamic import)
  if (!header.querySelector("[data-bbttcc-create-character]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateCharacter = "1";
    btn.innerHTML = `<i class="fas fa-user-plus"></i> Create Character (BBTTCC)`;
    btn.title = "Open BBTTCC Character Creation Wizard";
    btn.addEventListener("click", async () => {
      try {
        const open = game.bbttcc?.api?.autoLink?.openCharacterWizard;
        if (typeof open === "function") return void open();
        // Helpful diagnostics
        WARN("Character Wizard API not found. Check module.json esmodules and file paths.");
        ui.notifications?.error?.("BBTTCC Character Wizard not available (API missing).");
      } catch (e) {
        WARN("Could not open BBTTCC Character Wizard", e);
        ui.notifications?.error?.("BBTTCC Character Wizard not available.");
      }
    });
    header.appendChild(btn);
  }
}

// --- Hooks ------------------------------------------------------------------
Hooks.once("init", () => {
  console.log(`🌟 ${MOD} | Safe loader starting...`);
});

Hooks.on("renderActorDirectory", (app, html) => injectButtons(html));

Hooks.once("ready", async () => {
  console.log(`🌟 ${MOD} | READY Hook | Applying sheet to existing characters...`);

  const actors = game.actors?.contents ?? [];
  let count = 0;
  for (const a of actors) {
    if (!isCharacter(a)) continue;
    if (!qualifiesForBBTTCC(a)) continue;
    await applyEnhancedSheetIfNeeded(a);
    count++;
  }

  LOG(`Found ${count} actors with BBTTCC data flag.`);

  // Expose a tiny API for other modules/macros
  game.bbttcc = game.bbttcc ?? { api: {} };
  game.bbttcc.api = game.bbttcc.api ?? {};
  game.bbttcc.api.autoLink = game.bbttcc.api.autoLink ?? {};
  Object.assign(game.bbttcc.api.autoLink, {
    applyEnhancedSheetIfNeeded,
    qualifiesForBBTTCC
  });
  LOG("| API exposed for other modules");
});
