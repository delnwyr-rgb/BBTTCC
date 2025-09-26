// bbttcc-factions/module.js (stub API)
const MODULE_ID = "bbttcc-factions";

const API = {
  // open a wizard to pick/create a faction and link to a drawingId
  async openClaimWizard({ drawingId } = {}) {
    console.log(`[${MODULE_ID}] openClaimWizard`, { drawingId });
    ui.notifications?.info("Factions: Claim Wizard (stub).");
    // return a fake faction id for now
    return { factionId: "FAKE-FACTION-ID" };
  },

  // link a character actor to a faction
  async openLinkCharacterToFaction({ actorId } = {}) {
    console.log(`[${MODULE_ID}] openLinkCharacterToFaction`, { actorId });
    ui.notifications?.info("Factions: Link Character to Faction (stub).");
  },

  async openFactionForActor({ actorId } = {}) {
    console.log(`[${MODULE_ID}] openFactionForActor`, { actorId });
    ui.notifications?.info("Factions: Open Actor's Faction (stub).");
  }
};

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = API;
  console.log(`[${MODULE_ID}] init`);
});

Hooks.once("ready", () => {
  if (game.bbttcc?.api) game.bbttcc.api.factions = API;
  console.log(`[${MODULE_ID}] ready`);
});
