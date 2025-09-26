// =========================================================================
// == BBTTCC Radiation - FINAL CONSOLIDATED MODULE
// =========================================================================

console.log('🏁 BBTTCC Radiation | Final consolidated module loading...');

// --- From radiation-tracker.js ---
class RadiationTracker extends FormApplication {
    // Placeholder for the tracker UI
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-radiation-tracker",
            title: "Radiation Tracker",
            width: 500
            // template would be defined here if you have one
        });
    }
}

// --- From radiation-zone.js ---
class RadiationZoneConfig extends FormApplication {
    // Placeholder for the zone config UI
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-radiation-zone-config",
            title: "Radiation Zone Configuration",
            width: 600
        });
    }
}

// --- From bbttcc-radiation.js (Main Logic) ---
class BBTTCCRadiationModule {
    static MODULE_ID = 'bbttcc-radiation';

    static initialize() {
        console.log(`[${this.MODULE_ID}] | Initializing.`);
        this.registerSettings();
        this.exposeAPI();
    }

    static registerSettings() {
        game.settings.register(this.MODULE_ID, 'enableAutomaticTracking', {
            name: 'Enable Automatic Radiation Tracking',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        console.log(`[${this.MODULE_ID}] | Settings registered.`);
    }

    static exposeAPI() {
        const api = {
            openRadiationTracker: (token) => new RadiationTracker(token).render(true)
        };
        game.modules.get(this.MODULE_ID).api = api;
        console.log(`[${this.MODULE_ID}] | API exposed.`);
    }
}

Hooks.once('init', () => {
    BBTTCCRadiationModule.initialize();
});

export { BBTTCCRadiationModule };