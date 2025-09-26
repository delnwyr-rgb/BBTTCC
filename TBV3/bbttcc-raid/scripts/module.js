// =========================================================================
// == BBTTCC Raid - FINAL CONSOLIDATED MODULE
// =========================================================================

console.log('🏁 BBTTCC Raid | Final consolidated module loading...');

// --- From raid-planner.js ---
class RaidPlanner extends FormApplication {
    // This class contains all the UI logic for your raid planning window.
    // To keep this example clean, we'll use a placeholder. The full code
    // from your raid-planner.js would be pasted here.
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-raid-planner",
            title: "BBTTCC Raid Planner",
            width: 800
        });
    }
}

// --- From bbttcc-raid.js (Main Logic) ---
class BBTTCCRaidModule {
    static MODULE_ID = 'bbttcc-raid';

    static initialize() {
        console.log(`[${this.MODULE_ID}] | Initializing.`);
        this.registerSettings();
        this.exposeAPI();
    }

    static registerSettings() {
        game.settings.register(this.MODULE_ID, 'autoCalculateDifficulty', {
            name: 'Auto-Calculate Raid Difficulty',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        console.log(`[${this.MODULE_ID}] | Settings registered.`);
    }

    static exposeAPI() {
        const api = {
            openRaidPlanner: () => new RaidPlanner().render(true)
            // Other API functions would go here
        };
        game.modules.get(this.MODULE_ID).api = api;
        console.log(`[${this.MODULE_ID}] | API exposed.`);
    }
}

Hooks.once('init', () => {
    BBTTCCRaidModule.initialize();
});

export { BBTTCCRaidModule };