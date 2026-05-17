// modules/bbttcc-auto-link/scripts/module.js
// v0.8.3 — Actors Directory header button restore + 5 RFI builders.
// Goal: keep the Create Character button resilient even if other files change.
// 2026-05-17 — Boss + Rig thin shells replaced by full MCE-pattern builders.
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

function _hideNativeCreateActorButton(root) {
  // 2026-05-16 — Classed Monsters sprint. The Roll For Initiation workflow
  // routes actor creation through BBTTCC builders (RFI Character / NPC /
  // Boss / Rig). Hide Foundry's native "Create Actor" button so users
  // don't accidentally create raw type:'npc' actors that bypass the
  // entityKind-flagged PC-sheet workflow.
  if (!root) return;
  // Scan the whole directory, not just the header — Foundry v13 AppV2 places
  // the create button in different containers depending on theme/version.
  const candidates = root.querySelectorAll([
    'button.create-document',
    'button.create-entity',
    'button[data-action="createDocument"]',
    'button[data-action="createEntry"]',
    'button[data-action="createActor"]',
    'button[data-action="create"]',
    'a.create-document',
    'a.create-entity',
    'a[data-action="createDocument"]',
    'header button',
    '.directory-header button'
  ].join(", "));
  for (const el of candidates) {
    // Don't hide our own custom buttons
    if (el.dataset.bbttccCreateCharacter === "1") continue;
    if (el.dataset.bbttccCreateNpc === "1") continue;
    if (el.dataset.bbttccCreateMonster === "1") continue;
    if (el.dataset.bbttccCreateBoss === "1") continue;
    if (el.dataset.bbttccCreateRig === "1") continue;
    // Match by text content for theme variations — anything labeled "Create Actor"
    // or "Create Document" gets hidden. Folder, Search, etc. pass through.
    const txt = (el.textContent || "").trim().toLowerCase();
    const isCreateActor =
      txt === "create actor" ||
      txt === "create document" ||
      txt.startsWith("create actor") ||
      el.classList.contains("create-document") ||
      el.classList.contains("create-entity") ||
      el.dataset.action === "createDocument" ||
      el.dataset.action === "createEntry" ||
      el.dataset.action === "createActor";
    if (!isCreateActor) continue;
    el.style.display = "none";
    el.dataset.bbttccHidden = "1";
  }
}

function injectButtons(html) {
  const root = getRoot(html);
  if (!root) return;

  const header = findActorDirHeader(root);
  if (!header) return;

  _hideNativeCreateActorButton(root);

  // Create RFI Character (rebranded 2026-05-16 from "Create Character (BBTTCC)").
  // Same underlying wizard (openTreeWizardV2) — produces a Tree-of-Life-walked
  // PC. The label change reflects that this is the canonical RFI character path.
  if (!header.querySelector("[data-bbttcc-create-character]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateCharacter = "1";
    btn.innerHTML = `<i class="fas fa-user-plus"></i> Create RFI Character`;
    btn.title = "Open the Roll For Initiation Character Creation Wizard (Tree of Life walkthrough)";

    btn.addEventListener("click", () => {
      try {
        const open = game.bbttcc?.openTreeWizardV2;
        if (typeof open !== "function") {
          WARN("Tree Wizard v2 not found. Is bbttcc-sorting-engine enabled?");
          ui.notifications?.error?.("BBTTCC Tree Wizard v2 not available — enable the bbttcc-sorting-engine module.");
          return;
        }
        open(null);
      } catch (e) {
        WARN("Could not open BBTTCC Tree Wizard v2", e);
        ui.notifications?.error?.("BBTTCC Tree Wizard v2 failed to open.");
      }
    });

    header.appendChild(btn);
    LOG("Injected Actors Directory button: Create RFI Character");
  }

  // Create NPC (light dialog — flag-stamped PC under the hood, full PC sheet).
  // See bbttcc-auto-link/scripts/npc-builder.js for the dialog + actor shape.
  if (!header.querySelector("[data-bbttcc-create-npc]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateNpc = "1";
    btn.innerHTML = `<i class="fas fa-skull"></i> Create NPC`;
    btn.title = "Create a Roll For Initiation NPC (full PC sheet under the hood; flag-marked as NPC)";

    btn.addEventListener("click", async () => {
      try {
        const api = globalThis.BBTTCC_NPCBuilder || game.bbttcc?.api?.npcBuilder;
        if (typeof api?.open !== "function") {
          WARN("NPC Builder not loaded.");
          ui.notifications?.error?.("NPC Builder not available — check that bbttcc-auto-link/scripts/npc-builder.js loaded.");
          return;
        }
        await api.open();
      } catch (e) {
        WARN("Could not open NPC Builder", e);
        ui.notifications?.error?.("NPC Builder failed to open.");
      }
    });

    header.appendChild(btn);
    LOG("Injected Actors Directory button: Create NPC");
  }

  // Create Monster (native fourththing NPC sheet — Apex Predator / Lisa Frank
  // Elemental / Crystal Lurker form factor). Distinct from Create NPC which
  // produces classed PC-with-flag actors. See monster-builder.js.
  if (!header.querySelector("[data-bbttcc-create-monster]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateMonster = "1";
    btn.innerHTML = `<i class="fas fa-paw"></i> Create Monster`;
    btn.title = "Create a Roll For Initiation Monster (native NPC sheet — stat-block creature with manually authored powers)";

    btn.addEventListener("click", async () => {
      try {
        const api = globalThis.BBTTCC_MonsterBuilder || game.bbttcc?.api?.monsterBuilder;
        if (typeof api?.open !== "function") {
          WARN("Monster Builder not loaded.");
          ui.notifications?.error?.("Monster Builder not available — check that bbttcc-auto-link/scripts/monster-builder.js loaded.");
          return;
        }
        await api.open();
      } catch (e) {
        WARN("Could not open Monster Builder", e);
        ui.notifications?.error?.("Monster Builder failed to open.");
      }
    });

    header.appendChild(btn);
    LOG("Injected Actors Directory button: Create Monster");
  }

  // Also make sure existing Monster button isn't tagged as a Create-Actor
  // target by the hider — add to the skip list.

  // Create Boss (B13 Builder UI — MCE-pattern authoring dialog).
  // See bbttcc-auto-link/scripts/boss-builder.js for the dialog + actor shape.
  if (!header.querySelector("[data-bbttcc-create-boss]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateBoss = "1";
    btn.innerHTML = `<i class="fas fa-crown"></i> Create Boss`;
    btn.title = "Create an RFI Boss actor (Crucible-style authoring dialog with starter chips and phase ladder).";

    btn.addEventListener("click", async () => {
      try {
        const api = globalThis.BBTTCC_BossBuilder || game.bbttcc?.api?.bossBuilder;
        if (typeof api?.open !== "function") {
          WARN("Boss Builder not loaded.");
          ui.notifications?.error?.("Boss Builder not available — check that bbttcc-auto-link/scripts/boss-builder.js loaded.");
          return;
        }
        await api.open();
      } catch (e) {
        WARN("Could not open Boss Builder", e);
        ui.notifications?.error?.("Boss Builder failed to open.");
      }
    });

    header.appendChild(btn);
    LOG("Injected Actors Directory button: Create Boss");
  }

  // Create Rig (B13 Builder UI — MCE-pattern authoring dialog).
  // See bbttcc-auto-link/scripts/rig-builder.js for the dialog + actor shape.
  if (!header.querySelector("[data-bbttcc-create-rig]")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.bbttccCreateRig = "1";
    btn.innerHTML = `<i class="fas fa-cogs"></i> Create Rig`;
    btn.title = "Create an RFI Rig actor (Frame-style authoring dialog with chassis chips and capacity grid).";

    btn.addEventListener("click", async () => {
      try {
        const api = globalThis.BBTTCC_RigBuilder || game.bbttcc?.api?.rigBuilder;
        if (typeof api?.open !== "function") {
          WARN("Rig Builder not loaded.");
          ui.notifications?.error?.("Rig Builder not available — check that bbttcc-auto-link/scripts/rig-builder.js loaded.");
          return;
        }
        await api.open();
      } catch (e) {
        WARN("Could not open Rig Builder", e);
        ui.notifications?.error?.("Rig Builder failed to open.");
      }
    });

    header.appendChild(btn);
    LOG("Injected Actors Directory button: Create Rig");
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
