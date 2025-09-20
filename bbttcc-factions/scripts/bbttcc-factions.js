/**
 * BBTTCC Factions Module v4.8.0 - MODERN
 * Fully compliant with FoundryVTT v13+ patterns based on research of working modules
 * Uses modern async/await, proper error handling, and current API patterns
 */

import { FactionSheet } from './faction-sheet.js';
import { FactionActor } from './faction-actor.js';

// Default Organization Points structure
const DEFAULT_OPS_STRUCTURE = {
    violence: { value: 0, max: 10 },
    nonlethal: { value: 0, max: 10 },
    intrigue: { value: 0, max: 10 },
    economy: { value: 0, max: 10 },
    softpower: { value: 0, max: 10 },
    diplomacy: { value: 0, max: 10 },
    logistics: { value: 0, max: 10 },
    culture: { value: 0, max: 10 },
    faith: { value: 0, max: 10 }
};

/**
 * Modern module class with proper async/await patterns
 */
class BBTTCCFactionsModule {
    static MODULE_ID = 'bbttcc-factions';
    static api = null;
    static initialized = false;
    static hookIds = []; // Store hook IDs for proper cleanup
    
    /**
     * Initialize the module with modern patterns
     */
    static async initialize() {
        if (this.initialized) {
            console.warn(`${this.MODULE_ID} | Already initialized, skipping...`);
            return;
        }
        
        console.log(`${this.MODULE_ID} | Initializing with modern FoundryVTT v13+ patterns...`);
        
        try {
            // Setup components in proper order
            await this.checkCompatibility();
            await this.setupSettings();
            this.setupHooks();
            this.createAPI();
            this.registerSheets();
            
            this.initialized = true;
            console.log(`${this.MODULE_ID} | Initialization completed successfully`);
            
            // Notify other modules
            Hooks.callAll(`${this.MODULE_ID}.ready`, this.api);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to initialize:`, error);
            ui.notifications.error('BBTTCC Factions failed to initialize. Check console for details.');
            throw error;
        }
    }
    
    /**
     * Modern compatibility check
     */
    static async checkCompatibility() {
        const issues = [];
        
        // FoundryVTT version check
        if (!foundry.utils.isNewerVersion(game.version, "13.0")) {
            issues.push(`FoundryVTT v13.0+ required, found: ${game.version}`);
        }
        
        // System check
        if (game.system.id !== 'dnd5e') {
            issues.push(`D&D 5e system required, found: ${game.system.id}`);
        }
        
        if (!foundry.utils.isNewerVersion(game.system.version, "5.0.0")) {
            issues.push(`D&D 5e v5.0.0+ required, found: ${game.system.version}`);
        }
        
        if (issues.length > 0) {
            throw new Error(`Compatibility issues: ${issues.join(', ')}`);
        }
    }
    
    /**
     * Modern settings registration with proper error handling
     */
    static async setupSettings() {
        try {
            game.settings.register(this.MODULE_ID, 'enableMacroIntegration', {
                name: 'BBTTCC.Settings.EnableMacroIntegration.Name',
                hint: 'BBTTCC.Settings.EnableMacroIntegration.Hint',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true,
                onChange: value => {
                    console.log(`${this.MODULE_ID} | Macro integration ${value ? 'enabled' : 'disabled'}`);
                }
            });
            
            game.settings.register(this.MODULE_ID, 'debugMode', {
                name: 'BBTTCC.Settings.DebugMode.Name',
                hint: 'BBTTCC.Settings.DebugMode.Hint',
                scope: 'world',
                config: true,
                type: Boolean,
                default: false,
                onChange: value => {
                    console.log(`${this.MODULE_ID} | Debug mode ${value ? 'enabled' : 'disabled'}`);
                }
            });
            
            console.log(`${this.MODULE_ID} | Settings registered successfully`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to setup settings:`, error);
            throw error;
        }
    }
    
    /**
     * Modern hook setup with proper error handling and cleanup tracking
     */
    static setupHooks() {
        try {
            // Store hook IDs for cleanup
            this.hookIds.push(
                Hooks.on('preCreateActor', this.onPreCreateActor.bind(this)),
                Hooks.on('createActor', this.onCreateActor.bind(this))
            );
            
            console.log(`${this.MODULE_ID} | Hooks registered successfully`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to setup hooks:`, error);
            throw error;
        }
    }
    
    /**
     * Modern sheet registration using correct FoundryVTT v13+ patterns
     */
    static registerSheets() {
        try {
            // Use the modern Actors.registerSheet pattern (equivalent to DocumentSheetConfig.registerSheet)
            Actors.registerSheet(this.MODULE_ID, FactionSheet, {
                types: ["npc"],
                makeDefault: false,
                label: "BBTTCC.Sheets.FactionSheet"
            });
            
            console.log(`${this.MODULE_ID} | Modern faction sheet registered successfully`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to register faction sheet:`, error);
            throw error;
        }
    }
    
    /**
     * Create modern API with proper async patterns
     */
    static createAPI() {
        this.api = {
            // Core API methods
            createFaction: createFactionModern,
            getFactionData: this.getFactionData.bind(this),
            updateFactionOPs: this.updateFactionOPs.bind(this),
            
            // Sheet classes
            FactionSheet: FactionSheet,
            FactionActor: FactionActor,
            
            // Data structures
            DEFAULT_OPS_STRUCTURE: DEFAULT_OPS_STRUCTURE,
            
            // Utility methods
            waitForReady: this.waitForReady.bind(this),
            validateFaction: this.validateFaction.bind(this),
            
            // Module info
            version: '4.8.0',
            moduleId: this.MODULE_ID
        };
        
        // Modern API exposure via game.modules pattern
        const module = game.modules.get(this.MODULE_ID);
        if (module) {
            module.api = this.api;
            console.log(`${this.MODULE_ID} | API exposed via game.modules.get("${this.MODULE_ID}").api`);
        }
        
        // Legacy compatibility
        window.BBTTCCFactions = {
            createFaction: createFactionModern,
            waitForReady: this.waitForReady.bind(this),
            version: '4.8.0'
        };
        
        // Global API exposure for cross-module compatibility
        window.BBTTCC = window.BBTTCC || {};
        window.BBTTCC.Factions = this.api;
    }
    
    /**
     * Modern preCreateActor hook with proper async handling
     */
    static async onPreCreateActor(document, data, options, userId) {
        try {
            const isFaction = this.detectFaction(data);
            
            if (isFaction) {
                console.log(`${this.MODULE_ID} | Pre-creating faction with modern patterns`);
                
                // Set faction flags (safe approach)
                if (!data.flags) data.flags = {};
                
                data.flags[this.MODULE_ID] = {
                    isFaction: true,
                    version: '4.8.0',
                    createdAt: new Date().toISOString(),
                    createdBy: game.user.id,
                    ops: foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE),
                    warLog: [],
                    territories: [],
                    bases: []
                };
                
                // Set sheet assignment
                if (!data.flags.core) data.flags.core = {};
                data.flags.core.sheetClass = `${this.MODULE_ID}.FactionSheet`;
                
                console.log(`${this.MODULE_ID} | Faction flags prepared successfully`);
            }
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onPreCreateActor:`, error);
        }
    }
    
    /**
     * Modern createActor hook with proper async handling
     */
    static async onCreateActor(actor, options, userId) {
        try {
            if (actor.flags?.[this.MODULE_ID]?.isFaction) {
                console.log(`${this.MODULE_ID} | Faction created, performing verification`);
                
                // Verify OPs structure exists in flags
                const ops = actor.getFlag(this.MODULE_ID, 'ops');
                if (!ops || Object.keys(ops).length === 0) {
                    console.warn(`${this.MODULE_ID} | OPs missing, fixing...`);
                    await actor.setFlag(this.MODULE_ID, 'ops', foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE));
                    console.log(`${this.MODULE_ID} | OPs structure added via setFlag`);
                }
                
                // Success notification
                ui.notifications.info(`Faction "${actor.name}" created successfully!`);
                
                // Notify other modules
                Hooks.callAll(`${this.MODULE_ID}.created`, {
                    actor: actor,
                    timestamp: Date.now(),
                    userId: userId
                });
            }
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onCreateActor:`, error);
        }
    }
    
    /**
     * Enhanced faction detection with multiple criteria
     */
    static detectFaction(data) {
        return data.name?.toLowerCase().includes('faction') || 
               data.flags?.[this.MODULE_ID]?.isFaction ||
               (data.type === 'npc' && data.system?.details?.type?.value === 'faction');
    }
    
    /**
     * Modern waitForReady with proper timeout handling
     */
    static async waitForReady(timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (this.initialized && this.api) {
                return resolve(this.api);
            }
            
            const timeoutId = setTimeout(() => {
                reject(new Error(`${this.MODULE_ID} API not ready within ${timeout}ms`));
            }, timeout);
            
            const hookId = Hooks.once(`${this.MODULE_ID}.ready`, (api) => {
                clearTimeout(timeoutId);
                resolve(api);
            });
        });
    }
    
    /**
     * Get faction data with safe flag access
     */
    static async getFactionData(actor) {
        try {
            if (!actor || !actor.getFlag(this.MODULE_ID, 'isFaction')) {
                throw new Error('Actor is not a valid BBTTCC faction');
            }
            
            return {
                ops: actor.getFlag(this.MODULE_ID, 'ops') || {},
                flags: actor.flags[this.MODULE_ID] || {},
                warLog: actor.getFlag(this.MODULE_ID, 'warLog') || [],
                territories: actor.getFlag(this.MODULE_ID, 'territories') || [],
                bases: actor.getFlag(this.MODULE_ID, 'bases') || []
            };
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error getting faction data:`, error);
            throw error;
        }
    }
    
    /**
     * Update faction OPs with proper validation
     */
    static async updateFactionOPs(actor, opType, value) {
        try {
            if (!actor.getFlag(this.MODULE_ID, 'isFaction')) {
                throw new Error('Actor is not a faction');
            }
            
            const currentOps = actor.getFlag(this.MODULE_ID, 'ops') || {};
            if (!currentOps[opType]) {
                throw new Error(`Invalid OP type: ${opType}`);
            }
            
            const newOps = foundry.utils.deepClone(currentOps);
            newOps[opType].value = Math.max(0, Math.min(newOps[opType].max, value));
            
            await actor.setFlag(this.MODULE_ID, 'ops', newOps);
            return newOps[opType];
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error updating faction OPs:`, error);
            throw error;
        }
    }
    
    /**
     * Validate faction structure
     */
    static validateFaction(actor) {
        try {
            if (!actor) return false;
            if (!actor.getFlag(this.MODULE_ID, 'isFaction')) return false;
            
            const ops = actor.getFlag(this.MODULE_ID, 'ops');
            if (!ops) return false;
            
            const requiredOPs = Object.keys(DEFAULT_OPS_STRUCTURE);
            return requiredOPs.every(op => ops[op] && typeof ops[op].value === 'number');
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error validating faction:`, error);
            return false;
        }
    }
    
    /**
     * Cleanup method for proper resource management
     */
    static cleanup() {
        // Clean up hooks
        this.hookIds.forEach(id => Hooks.off(id));
        this.hookIds = [];
        
        // Reset state
        this.initialized = false;
        this.api = null;
        
        console.log(`${this.MODULE_ID} | Cleanup completed`);
    }
}

/**
 * Modern faction creation function with proper async/await patterns and error handling
 */
async function createFactionModern(factionData = {}) {
    const moduleId = BBTTCCFactionsModule.MODULE_ID;
    const startTime = performance.now();
    
    console.log(`${moduleId} | Starting modern faction creation...`);
    
    try {
        // Validation with proper error handling
        if (!game.ready) {
            throw new Error('Game not ready for faction creation');
        }
        
        if (!game.user.isGM) {
            const macroEnabled = game.settings.get(moduleId, 'enableMacroIntegration');
            if (!macroEnabled) {
                throw new Error('Only GMs can create factions when macro integration is disabled');
            }
        }
        
        // Input validation
        if (factionData.name && (typeof factionData.name !== 'string' || factionData.name.trim().length === 0)) {
            throw new Error('Faction name must be a non-empty string');
        }
        
        // Check for name conflicts
        const name = factionData.name || `New BBTTCC Faction ${Date.now()}`;
        const existingFaction = game.actors.find(actor => 
            actor.name.toLowerCase() === name.toLowerCase() && 
            actor.getFlag(moduleId, 'isFaction')
        );
        
        if (existingFaction) {
            throw new Error(`A faction named "${name}" already exists`);
        }
        
        // Prepare faction data with modern patterns
        const actorData = {
            name: name,
            type: "npc",
            system: {
                details: {
                    type: { value: "faction" },
                    biography: { value: factionData.biography || "" }
                }
            },
            flags: {
                [moduleId]: {
                    isFaction: true,
                    version: '4.8.0',
                    createdAt: new Date().toISOString(),
                    createdBy: game.user.id,
                    ops: foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE),
                    warLog: [],
                    territories: [],
                    bases: []
                },
                core: {
                    sheetClass: `${moduleId}.FactionSheet`
                }
            }
        };
        
        // Merge with provided data safely
        const finalData = foundry.utils.mergeObject(actorData, factionData, { 
            inplace: false, 
            insertKeys: true, 
            insertValues: true 
        });
        
        // Ensure OPs structure is preserved
        finalData.flags[moduleId].ops = foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE);
        
        console.log(`${moduleId} | Creating faction with data:`, {
            name: finalData.name,
            hasOps: !!finalData.flags[moduleId].ops,
            opsKeys: Object.keys(finalData.flags[moduleId].ops)
        });
        
        // Create actor with timeout protection
        const faction = await Promise.race([
            Actor.create(finalData),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Faction creation timed out')), 30000)
            )
        ]);
        
        if (!faction) {
            throw new Error('Actor creation returned null');
        }
        
        // Verify faction was created properly
        const verifyOps = faction.getFlag(moduleId, 'ops');

        if (!verifyOps || Object.keys(verifyOps).length === 0) {
            console.warn(`${moduleId} | OPs missing after creation, fixing...`);
            await faction.setFlag(moduleId, 'ops', foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE));
        }
        
        const endTime = performance.now();
        console.log(`${moduleId} | Faction created successfully in ${(endTime - startTime).toFixed(2)}ms:`, {
            name: faction.name,
            id: faction.id,
            hasOps: !!faction.getFlag(moduleId, 'ops'),
            opsCount: Object.keys(faction.getFlag(moduleId, 'ops') || {}).length
        });
        
        // Success notification
        ui.notifications.info(`Faction "${faction.name}" created successfully!`);
        
        // Delayed sheet opening to prevent race conditions
        setTimeout(() => {
            try {
                faction.sheet?.render(true);
            } catch (sheetError) {
                console.warn(`${moduleId} | Could not open faction sheet:`, sheetError);
            }
        }, 500);
        
        return faction;
        
    } catch (error) {
        const endTime = performance.now();
        console.error(`${moduleId} | Faction creation failed after ${(endTime - startTime).toFixed(2)}ms:`, {
            error: error.message,
            stack: error.stack,
            factionData: factionData
        });
        
        ui.notifications.error(`Failed to create faction: ${error.message}`);
        throw error;
    }
}

/**
 * Initialize the module with modern patterns
 */
Hooks.once('init', async () => {
    console.log('BBTTCC Factions | Initializing v4.8.0 MODERN...');
    
    try {
        await BBTTCCFactionsModule.initialize();
    } catch (error) {
        console.error('BBTTCC Factions | Initialization failed:', error);
        ui.notifications.error('BBTTCC Factions failed to initialize. Check console for details.');
    }
});

/**
 * Final setup when game is ready
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Factions | Ready hook fired, module fully operational');
});

/**
 * Cleanup on module disable (good practice)
 */
Hooks.on('closeModule', (moduleId) => {
    if (moduleId === BBTTCCFactionsModule.MODULE_ID) {
        BBTTCCFactionsModule.cleanup();
    }
});

// Export for ES module compatibility
export { BBTTCCFactionsModule, createFactionModern, DEFAULT_OPS_STRUCTURE };