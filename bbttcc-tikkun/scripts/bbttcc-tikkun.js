/**
 * BBTTCC Tikkun: The Great Work v4.8.1-ENHANCED
 * Main module initialization and API system
 * 
 * Implements the Sparks of Light system for spiritual victory conditions
 * Based on Kabbalistic Sephiroth and Tikkun Olam philosophy
 */

// Module imports will be handled through Foundry's module system
import { ConstellationGenerator } from './constellation-generator.js';
import { TikkunSheetIntegration } from './tikkun-sheet.js';
import { TikkunAPI } from './tikkun-api.js';

class BBTTCCTikkun {
    static ID = 'bbttcc-tikkun';
    static FLAGS = {
        TIKKUN: 'tikkun'
    };
    
    static TEMPLATES = {
        GREAT_WORK_TAB: `modules/${this.ID}/templates/great-work-tab.html`,
        SPARK_DETAILS: `modules/${this.ID}/templates/spark-details.html`
    };

    static SEPHIROTH = {
        KETER: { name: 'Crown', theme: 'Unity', opposite: 'MALKUTH' },
        CHOKMAH: { name: 'Wisdom', theme: 'Inspiration', opposite: 'HOD' },
        BINAH: { name: 'Understanding', theme: 'Contemplation', opposite: 'NETZACH' },
        CHESED: { name: 'Mercy', theme: 'Kindness', opposite: 'GEVURAH' },
        GEVURAH: { name: 'Severity', theme: 'Discipline', opposite: 'CHESED' },
        TIFERET: { name: 'Harmony', theme: 'Balance', opposite: 'TIFERET' },
        NETZACH: { name: 'Victory', theme: 'Endurance', opposite: 'BINAH' },
        HOD: { name: 'Glory', theme: 'Intellect', opposite: 'CHOKMAH' },
        YESOD: { name: 'Foundation', theme: 'Connection', opposite: 'YESOD' },
        MALKUTH: { name: 'Kingdom', theme: 'Manifestation', opposite: 'KETER' }
    };

    static SPARK_TYPES = {
        CONCEPTUAL: 'conceptual',
        VESTIGIAL: 'vestigial',
        ANIMATE: 'animate'
    };

    static SPARK_STATUS = {
        REQUIRED: 'required',
        IDENTIFIED: 'identified', 
        ACTIVE: 'active',
        GATHERED: 'gathered',
        CORRUPTED: 'corrupted'
    };

    static log(force, ...args) {
        const shouldLog = force || game.modules.get(BBTTCCTikkun.ID)?.flags?.debug;
        if (shouldLog) {
            console.log(`${BBTTCCTikkun.ID} |`, ...args);
        }
    }

    static initialize() {
        this.log(true, "Initializing The Great Work system...");

        // Initialize constellation generator
        this.constellation = new ConstellationGenerator();

        // Initialize sheet integration
        this.sheetIntegration = new TikkunSheetIntegration();

        // Initialize and expose API
        this.api = new TikkunAPI();

        // Register hooks
        this.registerHooks();

        // Expose API through game.bbttccTikkun for easier access
        game.bbttccTikkun = this;

        // Also expose API through the module for compatibility
        const module = game.modules.get(this.ID);
        if (module) {
            module.api = this.api;
        }

        this.log(true, "The Great Work system initialized successfully");

        // Run diagnostics
        this.runDiagnostics();
    }

    static registerHooks() {
        // Listen for scenario resolution events from other BBTTCC modules
        Hooks.on("bbttcc:scenarioResolved", (scenarioData) => {
            console.log("bbttcc-tikkun | Scenario resolved, checking for Spark gathering conditions", scenarioData);

            const { actor, type, outcome, details } = scenarioData;
            if (actor && actor.type === 'character' && game.bbttccTikkun?.api) {
                game.bbttccTikkun.api.checkForGathering(actor, { type, outcome, details });
            }
        });

        // Listen for character creation/update
        Hooks.on("createActor", (actor) => {
            if (actor.type === 'character' && game.user.isGM && game.bbttccTikkun?.api) {
                console.log("bbttcc-tikkun | Character created, checking for constellation generation", actor.name);
                game.bbttccTikkun.api.maybeGenerateConstellation(actor);
            }
        });

        // Listen for sheet rendering to add Great Work tab
        Hooks.on("renderActorSheet", (app, html, data) => {
            if (app.actor.type === 'character' && game.bbttccTikkun?.sheetIntegration) {
                game.bbttccTikkun.sheetIntegration.addGreatWorkTab(app, html, data);
            }
        });

        // Ready hook for final initialization
        Hooks.once("ready", () => {
            console.log("bbttcc-tikkun | BBTTCC Tikkun | System fully operational - The Great Work awaits");

            // Expose global test function
            window.bbttccTikkunTest = () => game.bbttccTikkun?.runDiagnostics();
        });
    }

    static async runDiagnostics() {
        this.log(true, "Running Tikkun system diagnostics...");
        
        const diagnostics = {
            moduleLoaded: !!game.modules.get(this.ID)?.active,
            apiExposed: !!game.modules.get(this.ID)?.api,
            factionsModulePresent: !!game.modules.get('bbttcc-factions')?.active,
            templatesRegistered: true,
            systemSupported: game.system.id === 'dnd5e'
        };

        // Test constellation generation
        try {
            // Import constellation generator if available
            if (typeof ConstellationGenerator !== 'undefined') {
                this.constellation = new ConstellationGenerator();
                const testConstellation = this.constellation.generateSparkMatrix({
                    archetype: 'Warlord',
                    crew: 'Mercenary Band', 
                    occult: 'Kabbalist',
                    location: 'Bunker'
                });
                diagnostics.constellationGeneration = !!testConstellation;
            } else {
                diagnostics.constellationGeneration = false;
                this.log(true, "ConstellationGenerator class not available");
            }
        } catch (error) {
            diagnostics.constellationGeneration = false;
            this.log(true, "Constellation generation test failed:", error);
        }

        const allPassed = Object.values(diagnostics).every(test => test === true);
        
        this.log(true, "Diagnostic Results:", diagnostics);
        this.log(true, `Overall Status: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (!allPassed) {
            // Only show notification if ui.notifications is available
            if (ui?.notifications?.warn) {
                (ui?.notifications?.warn ? ui.notifications.warn : console.warn)("BBTTCC Tikkun diagnostic issues detected. Check console for details.");
            } else {
                console.warn("BBTTCC Tikkun diagnostic issues detected. ui.notifications not yet available.");
            }
        }
        
        return diagnostics;
    }

    static getFlag(actor, key) {
        return actor.getFlag(this.ID, key);
    }

    static async setFlag(actor, key, value) {
        return actor.setFlag(this.ID, key, value);
    }

    static async unsetFlag(actor, key) {
        return actor.unsetFlag(this.ID, key);
    }
}

// Initialize when Foundry is ready
Hooks.once('init', () => BBTTCCTikkun.initialize());

export { BBTTCCTikkun };