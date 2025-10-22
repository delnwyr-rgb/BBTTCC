// modules/bbttcc-auto-link/scripts/module.js
// v0.8.1 — Actors Directory header buttons:
//   • Create Character (BBTTCC) — opens the BBTTCC Character Wizard
// (Removed: extra Create Faction button to avoid duplicates)

const MOD = "bbttcc-auto-link";
const LOG = (...a) => console.log(`[${MOD}]`, ...a);
const WARN = (...a) => console.warn(`[${MOD}]`, ...a);

/* ---------------------------------------
   Helpers (left in place for future use)
----------------------------------------*/
function isCharacter(a) { return String(a?.type ?? "").toLowerCase() === "character"; }

function qualifiesForBBTTCC(a) {
  try {
    const fx = a.flags?.["bbttcc-character-options"];
    return !!fx && (fx.enabled !== false);
  } catch { return false; }
}

function preferredSheetClassId() {
  // If you later register a custom character sheet, return its id here.
  return undefined;
}

async function applyEnhancedSheetIfNeeded(a) {
  if (!isCharacter(a) || !qualifiesForBBTTCC(a)) return;
  const preferred = preferredSheetClassId();
  if (!preferred) return;
  const current = a.getFlag("core", "sheetClass") || foundry.utils.getProperty(a, "flags.core.sheetClass");
  if (current === preferred) return;
  await a.update({ "flags.core.sheetClass": preferred });
}

/* ---------------------------------------
   Actors Directory header injection
----------------------------------------*/
function injectButtons(html) {
  const root = html instanceof HTMLElement ? html : (html?.[0] instanceof HTMLElement ? html[0] : null);
  if (!root) return;

  const header = root.querySelector(".directory-header .header-actions") || root.querySelector(".header-actions");
  if (!header) return;

  // --- Create Character (BBTTCC) ---
  if (!header.querySelector("[data-bbttcc-create-character]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateCharacter = "1";
    const label = game.i18n?.localize?.("BBTTCC.AutoLink.CreateCharacter") || "Create Character (BBTTCC)";
    btn.innerHTML = `<i class="fas fa-user-plus"></i> ${label}`;
    btn.title = "Open BBTTCC Character Creation Wizard";
    btn.addEventListener("click", async () => {
      try {
        const open = game.bbttcc?.api?.autoLink?.openCharacterWizard;
        if (typeof open === "function") return void open();
        WARN("Character Wizard API not found. Check module.json esmodules and file paths.");
        ui.notifications?.error?.("BBTTCC Character Wizard not available (API missing).");
      } catch (e) {
        WARN("Could not open BBTTCC Character Wizard", e);
        ui.notifications?.error?.("BBTTCC Character Wizard not available.");
      }
    });
    header.appendChild(btn);
  }

  // (Intentionally no Create Faction button here — provided by bbttcc-factions module)
}

/* ---------------------------------------
   Hooks
----------------------------------------*/
Hooks.once("init", () => {
  console.log(`🌟 ${MOD} | Safe loader starting...`);
});

Hooks.on("renderActorDirectory", (app, html) => injectButtons(html));

// Some themes re-render via SidebarTab; keep button present.
Hooks.on("renderSidebarTab", (app, html) => {
  const isActors = app?.options?.id === "actors" || app?.id === "actors" || html?.[0]?.id === "actors";
  if (isActors) injectButtons(html);
});

Hooks.once("ready", async () => {
  console.log(`🌟 ${MOD} | READY Hook`);
});
