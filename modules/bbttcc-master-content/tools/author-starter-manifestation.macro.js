// ─── GM macro: author a starter manifestation in the RFI Starter
// Manifestations compendium ──────────────────────────────────────
// Opens Manifestation Wizard V2 in actor-less mode and writes the
// finished Item into the fourththing.starter-manifestations pack.
// Players can later drag from the compendium onto a sheet, or GMs
// can hand them out as discovered/learned manifestations.
//
// 2026-05-20 — Replaces the previous targetFolder-based macro. The
// wizard now has explicit compendium support via the `targetPack`
// option (added in commit ab5fe94 to systems/fourththing/module.js).
// Folders in the world Items directory are unrelated to compendium
// packs — the old macro created a folder of the same name as the
// pack, which is why authored manifestations weren't appearing in
// the compendium.
//
// V14 script-macro safe (IIFE wrap; no top-level return/await).

(async () => {
  if (!game.user.isGM) {
    ui.notifications?.error("GM only — this macro authors compendium items.");
    return;
  }

  const PACK_ID = "fourththing.starter-manifestations";
  const pack = game.packs?.get(PACK_ID);
  if (!pack) {
    ui.notifications?.error(`Pack ${PACK_ID} not found. Is the fourththing system active?`);
    return;
  }
  if (pack.locked) {
    // Try to unlock; fall back to a clear instruction if it fails.
    try { await pack.configure({ locked: false }); }
    catch (e) {
      ui.notifications?.error(`Pack ${PACK_ID} is locked. Right-click it in the Compendium tab → Edit → uncheck Locked.`);
      return;
    }
  }

  // Pick the manifestation kind. Power = Working/Ritual/Ephemeral. Weapon =
  // Stable Form (Strike profile). The wizard handles the rest from here.
  const kind = await new Promise((resolve) => {
    new Dialog({
      title: "Author Starter Manifestation",
      content: `
        <p style="font-size:0.85rem;margin:0 0 0.5rem">
          Author a new reference manifestation in
          <code>${PACK_ID}</code>. Pick the kind to start with — you can
          change function/stability inside the wizard.
        </p>
        <p style="font-size:0.78rem;opacity:0.7;font-style:italic">
          GM mode skips the TCC gate. Tier suggester runs on Step 7.
        </p>`,
      buttons: {
        power:  { label: "Power (Working / Ritual / Ephemeral)", icon: "<i class='fas fa-bolt'></i>",      callback: () => resolve("power") },
        weapon: { label: "Weapon (Stable Form)",                 icon: "<i class='fas fa-shield-alt'></i>", callback: () => resolve("weapon") },
        cancel: { label: "Cancel",                                                                          callback: () => resolve(null) }
      },
      default: "power"
    }).render(true);
  });
  if (!kind) return;

  const wizardV2 = game.fourththing?.wizardV2;
  if (typeof wizardV2 !== "function") {
    ui.notifications?.error("Manifestation Wizard V2 not loaded — fourththing system missing or not initialized.");
    return;
  }

  // Open the wizard in actor-less + compendium-target mode. The wizard's
  // V2 finish path routes Item.create through { pack: PACK_ID } so the
  // result lands in the compendium rather than the world directory.
  const created = await wizardV2(null, {
    kind,
    starter: kind === "weapon" ? "stable" : "ritual",
    targetPack: PACK_ID
  });

  if (created) {
    ui.notifications?.info(`Authored "${created.name}" in ${PACK_ID}.`);
  } else {
    ui.notifications?.warn("Wizard cancelled — no item created.");
  }
})();
