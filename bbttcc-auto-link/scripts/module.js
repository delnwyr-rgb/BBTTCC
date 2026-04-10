// modules/bbttcc-auto-link/scripts/module.js
// v0.8.2 — Actors Directory header button restore (Create Character BBTTCC)
// Goal: keep the Create Character button resilient even if other files change.
//
// Key change vs prior:
// - NO top-level imports (avoid module load abort if another file has a syntax error).
// - Character sheet registration is attempted via dynamic import in READY and is non-fatal.

const MOD = "bbttcc-auto-link";
const LOG  = (...a) => console.log(`[${MOD}]`, ...a);
const WARN = (...a) => console.warn(`[${MOD}]`, ...a);

function getRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html && html[0] instanceof HTMLElement) return html[0];
  return null;
}

function findActorDirHeader(root) {
  // Foundry themes vary. Try a few stable selectors.
  return (
    root.querySelector(".directory-header .header-actions") ||
    root.querySelector(".directory-header .action-buttons") ||
    root.querySelector(".directory-header")?.querySelector(".header-actions") ||
    root.querySelector(".header-actions") ||
    root.querySelector(".action-buttons")
  );
}

function injectButtons(html) {
  const root = getRoot(html);
  if (!root) return;

  const header = findActorDirHeader(root);
  if (!header) return;

  // Create Character (BBTTCC)
  if (!header.querySelector("[data-bbttcc-create-character]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateCharacter = "1"; // data-bbttcc-create-character
    const label = game.i18n?.localize?.("BBTTCC.AutoLink.CreateCharacter") || "Create Character (BBTTCC)";
    btn.innerHTML = `<i class="fas fa-user-plus"></i> ${label}`;
    btn.title = "Open BBTTCC Character Creation Wizard";

    btn.addEventListener("click", async () => {
      try {
        // Primary path: API exposed by character-wizard.js
        const open = game.bbttcc?.api?.autoLink?.openCharacterWizard;
        if (typeof open === "function") return void open();

        // Fallback: attempt to dynamically import the wizard script (in case api didn't load yet)
        try {
          await import("./character-wizard.js");
        } catch (e) {
          // ignore; we'll error below if API still missing
          WARN("Dynamic import ./character-wizard.js failed", e);
        }

        const open2 = game.bbttcc?.api?.autoLink?.openCharacterWizard;
        if (typeof open2 === "function") return void open2();

        WARN("Character Wizard API not found. Check module.json esmodules and file paths.");
        ui.notifications?.error?.("BBTTCC Character Wizard not available (API missing).");
      } catch (e) {
        WARN("Could not open BBTTCC Character Wizard", e);
        ui.notifications?.error?.("BBTTCC Character Wizard not available.");
      }
    });

    header.appendChild(btn);
    LOG("Injected Actors Directory button: Create Character (BBTTCC)");
  }
}

/* ---------------------------------------
   Hooks
----------------------------------------*/

Hooks.once("init", () => {
  LOG("init");
});

Hooks.on("renderActorDirectory", (app, html) => injectButtons(html));

// Some themes re-render via SidebarTab; keep button present.
Hooks.on("renderSidebarTab", (app, html) => {
  const isActors = app?.options?.id === "actors" || app?.id === "actors" || html?.[0]?.id === "actors";
  if (isActors) injectButtons(html);
});

Hooks.once("ready", async () => {
  LOG("ready");

  // Ensure the button exists even if the directory was rendered before hooks attached.
  try {
    const el = ui?.actors?.element;
    if (el) injectButtons(el);
  } catch (e) {
    WARN("Late injectButtons failed", e);
  }

  // Register BBTTCC Character Sheet (non-fatal)
  try {
    const mod = await import("./character-sheet.js");
    if (mod?.registerBBTTCCCharacterSheet) {
      mod.registerBBTTCCCharacterSheet();
      LOG("Registered BBTTCC Character/NPC sheets (dynamic import).");
    }
  } catch (err) {
    WARN("Character sheet registration failed (non-fatal).", err);
  }
});
