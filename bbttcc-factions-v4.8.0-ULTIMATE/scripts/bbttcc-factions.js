/**
 * BBTTCC Factions Module v4.8.0 - ULTIMATE
 * Modern FoundryVTT v13+ and D&D 5e v5.1+ compatibility
 * Uses modern API patterns and deprecation-free code
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
    diplomacy: { value: 0, max: 10 }
};

/**
 * Initialize the BBTTCC Factions module with modern patterns
 */
Hooks.once('init', () => {
    console.log('BBTTCC Factions | Initializing v4.8.0 ULTIMATE...');
    
    try {
        // Register custom actor sheet with modern DocumentSheetConfig
        DocumentSheetConfig.registerSheet(Actor, "bbttcc-factions", FactionSheet, {
            types: ["npc"],
            makeDefault: false,
            label: "BBTTCC Faction Sheet"
        });
        
        console.log('BBTTCC Factions | Successfully registered faction sheet with modern pattern');
        
    } catch (error) {
        console.error('BBTTCC Factions | Failed to register faction sheet:', error);
        ui.notifications.warn('BBTTCC Factions: Failed to register custom sheet, using system defaults');
    }
});

/**
 * Setup hook for final initialization with enhanced readiness signaling
 */
Hooks.once('ready', async () => {
    console.log('BBTTCC Factions | Ready hook fired');
    
    try {
        await BBTTCCFactionsModule.initialize();
        console.log('BBTTCC Factions | Module initialization completed successfully');
    } catch (error) {
        console.error('BBTTCC Factions | Failed to initialize:', error);
        ui.notifications.error('BBTTCC Factions failed to initialize. Check console for details.');
    }
});

/**
 * Modern module class with enhanced compatibility and error handling
 */
class BBTTCCFactionsModule {
    static MODULE_ID = 'bbttcc-factions';
    static api = null;
    static initialized = false;
    
    static async initialize() {
        if (this.initialized) {
            console.warn(`${this.MODULE_ID} | Already initialized, skipping...`);
            return;
        }
        
        console.log(`${this.MODULE_ID} | Initializing module systems...`);
        
        try {
            // Check compatibility
            await this.checkCompatibility();
            
            // Setup module systems
            await this.setupSettings();
            await this.setupHooks();
            await this.createAPI();
            
            // Mark as initialized
            this.initialized = true;
            
            console.log(`${this.MODULE_ID} | All systems initialized successfully`);
            
            // Hook-based readiness notification
            Hooks.callAll(`${this.MODULE_ID}.ready`, this.api);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to initialize:`, error);
            throw error;
        }
    }
    
    static async checkCompatibility() {
        const issues = [];
        
        // FoundryVTT version check
        if (!foundry.utils.isNewerVersion(game.version, "13.0")) {
            issues.push("FoundryVTT v13.0 or higher required");
        }
        
        // D&D 5e system check
        if (game.system.id !== "dnd5e") {
            issues.push("D&D 5e system required");
        } else if (!foundry.utils.isNewerVersion(game.system.version, "5.1.0")) {
            issues.push("D&D 5e system v5.1.0 or higher required");
        }
        
        if (issues.length > 0) {
            const message = `BBTTCC Factions compatibility issues:\n${issues.join('\n')}`;
            console.warn(`${this.MODULE_ID} | ${message}`);
            ui.notifications.warn(`BBTTCC Factions: ${issues.join(', ')}`);
        }
    }
    
    static async setupSettings() {
        try {
            // Enhanced settings with validation
            game.settings.register(this.MODULE_ID, 'enableMacroIntegration', {
                name: 'Enable Macro Integration',
                hint: 'Allow macros to create and manage factions',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true,
                onChange: (value) => {
                    console.log(`${this.MODULE_ID} | Macro integration ${value ? 'enabled' : 'disabled'}`);
                }
            });
            
            game.settings.register(this.MODULE_ID, 'debugMode', {
                name: 'Debug Mode',
                hint: 'Enable detailed debug logging',
                scope: 'world',
                config: true,
                type: Boolean,
                default: false
            });
            
            // Listen for setting changes with validation
            Hooks.on('updateSetting', (setting) => {
                if (setting.key.startsWith(`${this.MODULE_ID}.`)) {
                    try {
                        this.validateSetting(setting.key, setting.value);
                    } catch (error) {
                        ui.notifications.warn(`Invalid setting for ${setting.key}: ${error.message}`);
                    }
                }
            });
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to setup settings:`, error);
        }
    }
    
    static async setupHooks() {
        try {
            // Enhanced preCreateActor hook with modern patterns
            Hooks.on('preCreateActor', this.onPreCreateActor.bind(this));
            
            // Post-creation hook for additional setup
            Hooks.on('createActor', this.onCreateActor.bind(this));
            
            // Update hook for data validation
            Hooks.on('preUpdateActor', this.onPreUpdateActor.bind(this));
            
            console.log(`${this.MODULE_ID} | Hooks registered successfully`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to setup hooks:`, error);
        }
    }
    
    static async createAPI() {
        this.api = {
            // Core API methods
            createFaction: createFactionEnhanced,
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
        
        // Expose modern API via game.modules pattern
        const module = game.modules.get(this.MODULE_ID);
        if (module) {
            module.api = this.api;
            console.log(`${this.MODULE_ID} | API exposed via game.modules.get("${this.MODULE_ID}").api`);
        }
        
        // Legacy compatibility (deprecated but maintained for backward compatibility)
        window.BBTTCCFactions = {
            createFaction: createFactionEnhanced,
            waitForReady: this.waitForReady.bind(this),
            version: '4.8.0'
        };
        
        // Global API exposure for cross-module compatibility
        window.BBTTCC = window.BBTTCC || {};
        window.BBTTCC.Factions = this.api;
    }
    
    static async waitForReady(timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (this.initialized && this.api) {
                return resolve(this.api);
            }
            
            const timeoutId = setTimeout(() => {
                reject(new Error(`${this.MODULE_ID} API not ready within ${timeout}ms`));
            }, timeout);
            
            Hooks.once(`${this.MODULE_ID}.ready`, (api) => {
                clearTimeout(timeoutId);
                resolve(api);
            });
        });
    }
    
    static validateSetting(key, value) {
        if (key === `${this.MODULE_ID}.enableMacroIntegration`) {
            if (typeof value !== 'boolean') {
                throw new Error('enableMacroIntegration must be a boolean');
            }
        }
        
        if (key === `${this.MODULE_ID}.debugMode`) {
            if (typeof value !== 'boolean') {
                throw new Error('debugMode must be a boolean');
            }
        }
    }
    
    static onPreCreateActor(actor, data, options, userId) {
        const moduleId = 'bbttcc-factions'; // Use literal string to avoid context issues
        
        // Enhanced faction detection with multiple criteria
        const isFaction = data.name?.toLowerCase().includes('faction') || 
                         data.flags?.[moduleId]?.isFaction ||
                         data.flags?.['bbttcc-factions']?.isFaction ||
                         (data.type === 'npc' && data.system?.details?.type?.value === 'faction');
        
        if (isFaction) {
            console.log(`${moduleId} | Pre-creating faction with enhanced OPs structure`);
            
            try {
                // Ensure system data exists
                if (!data.system) {
                    data.system = {};
                }
                
                // FORCE OPs structure creation with deep clone
                data.system.ops = foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE);
                console.log(`${moduleId} | OPs structure forcibly added:`, data.system.ops);
                
                // Add faction-specific flags with enhanced data
                if (!data.flags) {
                    data.flags = {};
                }
                if (!data.flags[moduleId]) {
                    data.flags[moduleId] = {
                        isFaction: true,
                        version: '4.8.0',
                        createdAt: new Date().toISOString(),
                        createdBy: game.user.id,
                        warLog: [],
                        territories: [],
                        bases: []
                    };
                }
                
                // Ensure proper sheet assignment
                if (!data.flags.core) {
                    data.flags.core = {};
                }
                data.flags.core.sheetClass = 'bbttcc-factions.FactionSheet';
                
                console.log(`${moduleId} | Enhanced faction data prepared:`, {
                    hasOPs: !!data.system.ops,
                    opsKeys: data.system.ops ? Object.keys(data.system.ops) : [],
                    hasFlags: !!data.flags[moduleId]
                });
                
            } catch (error) {
                console.error(`${moduleId} | Error in preCreateActor:`, error);
            }
        }
    }
    
    static async onCreateActor(actor, options, userId) {
        if (actor.flags?.[this.MODULE_ID]?.isFaction) {
            this.debugLog('Faction created, performing post-creation setup');
            
            try {
                // Verify OPs structure exists
                if (!actor.system.ops) {
                    await actor.update({
                        'system.ops': foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE)
                    });
                    this.debugLog('Fixed missing OPs structure post-creation');
                }
                
                // Notify other modules about faction creation
                Hooks.callAll(`${this.MODULE_ID}.created`, {
                    actor: actor,
                    timestamp: Date.now(),
                    userId: userId
                });
                
            } catch (error) {
                console.error(`${this.MODULE_ID} | Error in post-creation setup:`, error);
            }
        }
    }
    
    static onPreUpdateActor(actor, changes, options, userId) {
        if (actor.flags?.[this.MODULE_ID]?.isFaction) {
            // Validate OPs structure changes
            if (changes.system?.ops) {
                this.validateOPsStructure(changes.system.ops);
            }
        }
    }
    
    static validateOPsStructure(ops) {
        const requiredOPs = Object.keys(DEFAULT_OPS_STRUCTURE);
        for (const opType of requiredOPs) {
            if (!ops[opType] || typeof ops[opType] !== 'object') {
                throw new Error(`Invalid OPs structure: missing or invalid ${opType}`);
            }
            if (typeof ops[opType].value !== 'number' || typeof ops[opType].max !== 'number') {
                throw new Error(`Invalid OPs structure: ${opType} must have numeric value and max`);
            }
        }
    }
    
    static async getFactionData(actor) {
        if (!actor || !actor.flags?.[this.MODULE_ID]?.isFaction) {
            throw new Error('Actor is not a valid BBTTCC faction');
        }
        
        return {
            ops: actor.system.ops,
            flags: actor.flags[this.MODULE_ID],
            warLog: actor.flags[this.MODULE_ID]?.warLog || [],
            territories: actor.flags[this.MODULE_ID]?.territories || [],
            bases: actor.flags[this.MODULE_ID]?.bases || []
        };
    }
    
    static async updateFactionOPs(actor, opType, newValue) {
        if (!actor || !actor.flags?.[this.MODULE_ID]?.isFaction) {
            throw new Error('Actor is not a valid BBTTCC faction');
        }
        
        if (!DEFAULT_OPS_STRUCTURE[opType]) {
            throw new Error(`Invalid OP type: ${opType}`);
        }
        
        const currentOp = actor.system.ops[opType];
        const clampedValue = Math.max(0, Math.min(currentOp.max, newValue));
        
        await actor.update({
            [`system.ops.${opType}.value`]: clampedValue
        });
        
        return clampedValue;
    }
    
    static validateFaction(actor) {
        const issues = [];
        
        if (!actor) {
            issues.push('Actor is null or undefined');
        } else {
            if (!actor.flags?.[this.MODULE_ID]?.isFaction) {
                issues.push('Actor is not marked as a BBTTCC faction');
            }
            
            if (!actor.system.ops) {
                issues.push('Missing OPs structure');
            } else {
                try {
                    this.validateOPsStructure(actor.system.ops);
                } catch (error) {
                    issues.push(`Invalid OPs structure: ${error.message}`);
                }
            }
        }
        
        return issues;
    }
    
    static debugLog(message, data = null) {
        if (game.settings.get(this.MODULE_ID, 'debugMode')) {
            console.log(`${this.MODULE_ID} | DEBUG: ${message}`, data || '');
        }
    }
}

/**
 * Enhanced faction creation with comprehensive error handling and modern patterns
 */
async function createFactionEnhanced(factionData = {}) {
    const startTime = performance.now();
    const moduleId = BBTTCCFactionsModule.MODULE_ID;
    
    try {
        console.log(`${moduleId} | Creating faction with enhanced error handling...`, factionData);
        
        // Settings validation
        const macroIntegrationEnabled = game.settings.get(moduleId, 'enableMacroIntegration');
        if (!macroIntegrationEnabled && !game.user.isGM) {
            throw new Error('Faction creation via macro is disabled. Please enable it in module settings or contact your GM.');
        }
        
        // Input validation with modern patterns
        if (factionData.name && typeof factionData.name !== 'string') {
            throw new Error('Faction name must be a string');
        }
        
        if (factionData.name && factionData.name.trim().length === 0) {
            throw new Error('Faction name cannot be empty');
        }
        
        // Check for name conflicts with case-insensitive comparison
        if (factionData.name) {
            const existingFaction = game.actors.find(actor => 
                actor.name.toLowerCase() === factionData.name.toLowerCase() && 
                actor.flags?.[moduleId]?.isFaction
            );
            if (existingFaction) {
                throw new Error(`A faction named "${factionData.name}" already exists`);
            }
        }
        
        // Default faction data with comprehensive structure
        const defaultData = {
            name: factionData.name || "New BBTTCC Faction",
            type: "npc",
            system: {
                ops: foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE),
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
                    warLog: [],
                    territories: [],
                    bases: []
                },
                core: {
                    sheetClass: 'bbttcc-factions.FactionSheet'
                }
            }
        };
        
        // Merge with provided data using modern utility
        const finalData = foundry.utils.mergeObject(defaultData, factionData, { inplace: false });
        
        // Ensure OPs structure is properly set with deep clone for safety
        finalData.system.ops = foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE);
        
        BBTTCCFactionsModule.debugLog('Final faction data prepared', finalData);
        
        // Create the actor with retry mechanism
        let faction = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                faction = await Actor.create(finalData);
                break;
            } catch (createError) {
                if (attempt === maxRetries) {
                    throw createError;
                }
                console.warn(`${moduleId} | Creation attempt ${attempt} failed, retrying...`, createError.message);
                await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            }
        }
        
        if (!faction) {
            throw new Error('Actor creation returned null after all attempts');
        }
        
        // Verify the faction was created with proper data structure
        const verificationOps = faction.system?.ops;
        console.log(`${moduleId} | Verifying faction OPs structure:`, {
            hasSystem: !!faction.system,
            hasOPs: !!verificationOps,
            opsType: typeof verificationOps,
            opsKeys: verificationOps ? Object.keys(verificationOps) : [],
            fullSystemData: faction.system
        });
        
        if (!verificationOps || typeof verificationOps !== 'object' || Object.keys(verificationOps).length === 0) {
            console.warn(`${moduleId} | Faction created but OPs structure is missing or empty, fixing...`);
            await faction.update({
                'system.ops': foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE)
            });
            console.log(`${moduleId} | OPs structure has been added to faction post-creation`);
        } else {
            console.log(`${moduleId} | OPs structure verified successfully`);
        }
        
        // Ensure proper sheet assignment with modern method
        try {
            await faction.setFlag('core', 'sheetClass', 'bbttcc-factions.FactionSheet');
        } catch (sheetError) {
            console.warn(`${moduleId} | Failed to set custom sheet, using default:`, sheetError.message);
        }
        
        const endTime = performance.now();
        console.log(`${moduleId} | Faction created successfully:`, {
            faction: faction,
            creationTime: `${(endTime - startTime).toFixed(2)}ms`,
            dataStructureValid: !!faction.system?.ops
        });
        
        ui.notifications.info(`Faction "${faction.name}" created successfully!`);
        
        // Open the faction sheet with delay for proper rendering
        setTimeout(() => {
            if (faction?.sheet) {
                faction.sheet.render(true);
            }
        }, 500);
        
        // Notify other modules
        Hooks.callAll(`${moduleId}.created`, {
            faction: faction,
            timestamp: Date.now()
        });
        
        return faction;
        
    } catch (error) {
        const systemInfo = {
            foundryVersion: game.version,
            moduleVersion: game.modules.get(moduleId)?.version || 'unknown',
            systemId: game.system.id,
            systemVersion: game.system.version,
            userId: game.user.id,
            userName: game.user.name,
            worldTitle: game.world.title,
            timestamp: new Date().toISOString(),
            performanceNow: performance.now()
        };
        
        console.error(`${moduleId} | Enhanced error details:`, {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            factionData: factionData,
            systemInfo: systemInfo,
            moduleState: {
                initialized: BBTTCCFactionsModule.initialized,
                settingsEnabled: game.settings.get(moduleId, 'enableMacroIntegration'),
                existingFactions: game.actors.filter(a => a.flags?.[moduleId]?.isFaction).length
            }
        });
        
        ui.notifications.error(`Failed to create faction: ${error.message}. Check console (F12) for detailed error information.`);
        throw error;
    }
}

/**
 * Legacy createFaction function for backward compatibility
 */
async function createFaction(factionData = {}) {
    console.warn(`${BBTTCCFactionsModule.MODULE_ID} | Using legacy createFaction function. Consider updating to use the enhanced version.`);
    return await createFactionEnhanced(factionData);
}

/**
 * Add context menu options for creating factions
 */
Hooks.on('getActorDirectoryEntryContext', (html, entryOptions) => {
    entryOptions.push({
        name: "Create BBTTCC Faction",
        icon: '<i class="fas fa-flag"></i>',
        condition: game.user.isGM,
        callback: async () => {
            await createFactionEnhanced();
        }
    });
});

// Export for ES module compatibility
export { 
    createFaction, 
    createFactionEnhanced, 
    DEFAULT_OPS_STRUCTURE, 
    FactionSheet, 
    FactionActor, 
    BBTTCCFactionsModule 
};