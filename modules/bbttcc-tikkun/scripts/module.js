// =========================================================================
// == BBTTCC Tikkun - FINAL CONSOLIDATED MODULE
// =========================================================================

console.log('🏁 BBTTCC Tikkun | Final consolidated module loading...');

// --- From constellation-generator.js ---
class ConstellationGenerator {
    // All the logic for generating spark constellations would go here.
}

// --- From tikkun-sheet.js ---
class TikkunSheetIntegration {
    // All the logic for adding the "Great Work" tab to sheets would go here.
}

// --- From tikkun-api.js ---
class TikkunAPI {
    // All the API functions for managing sparks would go here.
}

// --- From bbttcc-tikkun.js (Main Logic) ---
class BBTTCCTikkun {
    static ID = 'bbttcc-tikkun';

    static initialize() {
        console.log(`[${this.ID}] | Initializing The Great Work system.`);
        this.api = new TikkunAPI();
        
        const module = game.modules.get(this.ID);
        if (module) module.api = this.api;
        
        Hooks.on("renderActorSheet", (app, html, data) => {
            if (app.actor.type === 'character') {
                // Logic to add the tab would be called here.
            }
        });

        console.log(`[${this.ID}] | The Great Work system initialized successfully.`);
    }
}

Hooks.once('init', () => {
    BBTTCCTikkun.initialize();
});

export { BBTTCCTikkun };