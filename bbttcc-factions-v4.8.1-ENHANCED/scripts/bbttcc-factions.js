/**
 * BBTTCC Factions Module v4.8.1-ENHANCED
 * Fully compliant with FoundryVTT v13+ patterns based on research of working modules
 * Uses modern async/await, proper error handling, and current API patterns
 */

// Import with validation - will be null if import fails
import { FactionSheet } from './faction-sheet.js';
import { FactionActor } from './faction-actor.js';

// Make FactionSheet globally available immediately after import
console.log('BBTTCC Factions | FactionSheet imported:', typeof FactionSheet !== 'undefined');
if (typeof FactionSheet !== 'undefined') {
    window.FactionSheet = FactionSheet;
    console.log('BBTTCC Factions | FactionSheet made globally available');
} else {
    console.error('BBTTCC Factions | CRITICAL: FactionSheet import failed!');
}

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
 * Modern module class with proper async/await patterns and enhanced functionality
 * @class BBTTCCFactionsModule
 * @version 4.8.1-ENHANCED
 */
class BBTTCCFactionsModule {
    static MODULE_ID = 'bbttcc-factions';
    static VERSION = '4.8.1-ENHANCED';
    static api = null;
    static initialized = false;
    static hookIds = []; // Store hook IDs for proper cleanup
    static #instance = null; // Singleton pattern
    
    /**
     * Initialize the module with modern patterns
     */
    static async initialize() {
        if (this.initialized) {
            console.warn(`${this.MODULE_ID} | Already initialized, skipping...`);
            return;
        }
        
        console.log(`${this.MODULE_ID} | Initializing with modern FoundryVTT v13+ and D&D5e v5.4+ patterns...`);
        
        // D&D5e v5.4 compatibility note
        if (game.system.id === 'dnd5e') {
            const version = game.system.version;
            if (foundry.utils.isNewerVersion(version, "5.4.0")) {
                console.log(`${this.MODULE_ID} | Running on D&D5e v${version} - fully compatible`);
            } else if (foundry.utils.isNewerVersion(version, "5.0.0")) {
                console.warn(`${this.MODULE_ID} | Running on D&D5e v${version} - compatible but may show deprecation warnings. v5.4+ recommended.`);
            } else {
                console.warn(`${this.MODULE_ID} | Running on D&D5e v${version} - outdated, may have compatibility issues.`);
            }
        }
        
        try {
            // Setup components in proper order - but delay sheets until ready
            await this.setupSettings();
            this.setupHooks();
            this.createAPI();
            
            this.initialized = true;
            
            // Double-check sheet registration after everything is initialized
            setTimeout(() => {
                console.log(`${this.MODULE_ID} | Post-init sheet registration check...`);
                if (CONFIG?.Actor?.sheetClasses?.npc) {
                    console.log(`${this.MODULE_ID} | Available NPC sheets (post-init):`, Object.keys(CONFIG.Actor.sheetClasses.npc));
                    const possibleKeys = ["bbttcc-factions.FactionSheet", "FactionSheet", "bbttcc-factions"];
                    for (const key of possibleKeys) {
                        const registered = !!CONFIG.Actor.sheetClasses.npc[key];
                        console.log(`${this.MODULE_ID} | Post-init sheet key "${key}" registered:`, registered);
                        if (registered && !this.registeredSheetKey) {
                            this.registeredSheetKey = key;
                            console.log(`${this.MODULE_ID} | ✓ Updated registered sheet key to: "${key}"`);
                        }
                    }
                } else {
                    console.warn(`${this.MODULE_ID} | CONFIG.Actor.sheetClasses.npc still not available post-init`);
                }
            }, 1000);
            
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
        
        // Check D&D5e version - v5.4+ preferred but v5.0+ supported with deprecation warnings
        if (!foundry.utils.isNewerVersion(game.system.version, "5.0.0")) {
            issues.push(`D&D 5e v5.0.0+ required, found: ${game.system.version}`);
        } else if (!foundry.utils.isNewerVersion(game.system.version, "5.4.0")) {
            console.warn(`${this.MODULE_ID} | D&D 5e v5.4.0+ recommended for best compatibility, found: ${game.system.version}. May show deprecation warnings.`);
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
            console.log(`${this.MODULE_ID} | Starting sheet registration...`);
            console.log(`${this.MODULE_ID} | FactionSheet class:`, FactionSheet);
            console.log(`${this.MODULE_ID} | FactionSheet name:`, FactionSheet?.name);
            console.log(`${this.MODULE_ID} | DocumentSheetConfig available:`, !!foundry.applications.apps.DocumentSheetConfig);
            console.log(`${this.MODULE_ID} | registerSheet method available:`, typeof foundry.applications.apps.DocumentSheetConfig.registerSheet);
            
            // Register the sheet
            foundry.applications.apps.DocumentSheetConfig.registerSheet(Actor, "bbttcc-factions", FactionSheet, {
                types: ["npc"],
                makeDefault: false,
                label: "BBTTCC Faction Sheet"
            });
            
            console.log(`${this.MODULE_ID} | Sheet registration completed - checking registration...`);
            
            // Try to verify registration worked by checking CONFIG
            console.log(`${this.MODULE_ID} | CONFIG available:`, !!CONFIG);
            console.log(`${this.MODULE_ID} | CONFIG.Actor available:`, !!CONFIG?.Actor);
            console.log(`${this.MODULE_ID} | CONFIG.Actor.sheetClasses available:`, !!CONFIG?.Actor?.sheetClasses);
            console.log(`${this.MODULE_ID} | CONFIG.Actor.sheetClasses.npc available:`, !!CONFIG?.Actor?.sheetClasses?.npc);
            
            if (CONFIG?.Actor?.sheetClasses?.npc) {
                console.log(`${this.MODULE_ID} | Available NPC sheets:`, Object.keys(CONFIG.Actor.sheetClasses.npc));
                
                // Check multiple possible registration keys
                const possibleKeys = [
                    "bbttcc-factions.FactionSheet",
                    "FactionSheet", 
                    "bbttcc-factions"
                ];
                
                for (const key of possibleKeys) {
                    const registered = !!CONFIG.Actor.sheetClasses.npc[key];
                    console.log(`${this.MODULE_ID} | Sheet key "${key}" registered:`, registered);
                    if (registered) {
                        console.log(`${this.MODULE_ID} | ✓ Found sheet with key: "${key}"`);
                        console.log(`${this.MODULE_ID} | Sheet class:`, CONFIG.Actor.sheetClasses.npc[key]);
                        
                        // Update sheetClass format based on what's actually registered
                        this.registeredSheetKey = key;
                    }
                }
            }
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | CRITICAL: Sheet registration failed:`, error);
            console.error(`${this.MODULE_ID} | This will prevent custom faction sheets from appearing`);
            // Don't throw - allow module to continue but with clear error
        }
    }
    
    /**
     * Create modern API with proper async patterns and enhanced functionality
     */
    static createAPI() {
        this.api = {
            // Core functionality
            factions: {
                create: createFactionModern,
                get: this.getFactionData.bind(this),
                update: this.updateFactionOPs.bind(this),
                validate: this.validateFaction.bind(this),
                repair: this.validateAndRepair.bind(this),
                list: this.listFactions.bind(this),
                export: this.exportFactionData.bind(this)
            },
            
            // Events system for other modules
            events: {
                subscribe: (event, callback) => {
                    const hookId = Hooks.on(`${this.MODULE_ID}.${event}`, callback);
                    return () => Hooks.off(hookId);
                },
                emit: (event, data) => {
                    Hooks.callAll(`${this.MODULE_ID}.${event}`, data);
                    // Also emit to BBTTCC namespace for cross-module communication
                    Hooks.callAll(`bbttcc.${event}`, { module: 'factions', ...data });
                }
            },
            
            // Utility functions
            utils: {
                calculatePowerLevel: this.calculatePowerLevel.bind(this),
                generateFactionName: this.generateFactionName.bind(this),
                safeExecute: this.safeExecute.bind(this)
            },
            
            // Configuration
            config: {
                getDefaultOPs: () => foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE),
                getSupportedTypes: () => ['violence', 'nonlethal', 'intrigue', 'economy', 'softpower', 'diplomacy'],
                getPowerLevels: () => ['Emerging', 'Growing', 'Established', 'Powerful', 'Dominant']
            },
            
            // Sheet classes (for advanced usage)
            sheets: {
                // Classes (conditionally available based on import success)
                ...(typeof FactionSheet !== 'undefined' ? { FactionSheet } : {}),
                ...(typeof FactionActor !== 'undefined' ? { FactionActor } : {}),
            },
            
            // Data structures
            DEFAULT_OPS_STRUCTURE: DEFAULT_OPS_STRUCTURE,
            
            // Legacy methods for backward compatibility
            createFaction: createFactionModern,
            getFactionData: this.getFactionData.bind(this),
            updateFactionOPs: this.updateFactionOPs.bind(this),
            waitForReady: this.waitForReady.bind(this),
            validateFaction: this.validateFaction.bind(this),
            
            // Module info and diagnostics
            version: this.VERSION,
            apiVersion: '1.0',
            moduleId: this.MODULE_ID,
            isReady: () => this.initialized,
            runDiagnostics: this.runDiagnostics.bind(this)
        };
        
        // Log available classes for debugging
        console.log(`${this.MODULE_ID} | Exposing API with available classes:`, {
            FactionSheet: typeof FactionSheet !== 'undefined',
            FactionActor: typeof FactionActor !== 'undefined'
        });
        
        // Modern API exposure via game.modules pattern
        const module = game.modules.get(this.MODULE_ID);
        if (module) {
            module.api = this.api;
            console.log(`${this.MODULE_ID} | API exposed via game.modules.get("${this.MODULE_ID}").api`);
        }
        
        // Enhanced global API exposure for cross-module compatibility
        if (!globalThis.BBTTCC) globalThis.BBTTCC = {};
        globalThis.BBTTCC.Factions = this.api;
        
        // Legacy compatibility (maintain existing patterns)
        window.BBTTCCFactions = {
            createFaction: createFactionModern,
            waitForReady: this.waitForReady.bind(this),
            version: this.VERSION
        };
        window.BBTTCC = window.BBTTCC || {};
        window.BBTTCC.Factions = this.api;
        
        // Add global diagnostic command
        window.bbttccFactionsTest = this.runDiagnostics.bind(this);
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
                    version: '4.8.1-ENHANCED',
                    createdAt: new Date().toISOString(),
                    createdBy: game.user.id,
                    ops: foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE),
                    warLog: [],
                    territories: [],
                    bases: []
                };
                
                // Set sheet assignment - use the confirmed working key format
                if (!data.flags.core) data.flags.core = {};
                const sheetKey = "bbttcc-factions.FactionSheet";  // This is confirmed to work
                data.flags.core.sheetClass = sheetKey;
                console.log(`${this.MODULE_ID} | Setting sheet class to: "${sheetKey}"`);
                
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
                
                // Success notification removed - handled by createFactionModern function
                console.log(`${this.MODULE_ID} | Faction "${actor.name}" creation verified via hook`);
                
                // Emit integration events using our new event system
                if (this.api?.events) {
                    this.api.events.emit('factionCreated', {
                        actor,
                        userId,
                        timestamp: Date.now()
                    });
                }
                
                // Legacy event for backward compatibility
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
     * Safe execution wrapper with fallback
     * @param {Function} operation - Operation to execute
     * @param {*} fallback - Fallback value if operation fails
     * @returns {*} Result or fallback
     */
    static async safeExecute(operation, fallback = null) {
        try {
            return await operation();
        } catch (error) {
            console.error(`${this.MODULE_ID} | Safe execution failed:`, error);
            ui.notifications.warn(`Operation failed, using fallback behavior`);
            return fallback;
        }
    }
    
    /**
     * Enhanced validation and auto-repair mechanism
     * @param {Actor} actor - Actor to validate and repair
     * @returns {Promise<boolean>} True if valid or successfully repaired
     */
    static async validateAndRepair(actor) {
        const issues = [];
        const moduleId = this.MODULE_ID;
        
        try {
            if (!actor.getFlag(moduleId, 'isFaction')) {
                issues.push('Missing faction flag');
                await actor.setFlag(moduleId, 'isFaction', true);
            }
            
            const ops = actor.getFlag(moduleId, 'ops');
            if (!ops || Object.keys(ops).length === 0) {
                issues.push('Missing OPs structure');
                await actor.setFlag(moduleId, 'ops', foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE));
            } else {
                // Check for missing OP types
                const currentOps = foundry.utils.deepClone(ops);
                let needsUpdate = false;
                
                for (const [opType, defaultValue] of Object.entries(DEFAULT_OPS_STRUCTURE)) {
                    if (!currentOps[opType]) {
                        issues.push(`Missing OP type: ${opType}`);
                        currentOps[opType] = defaultValue;
                        needsUpdate = true;
                    }
                }
                
                if (needsUpdate) {
                    await actor.setFlag(moduleId, 'ops', currentOps);
                }
            }
            
            // Check other required arrays
            const arrays = ['warLog', 'territories', 'bases'];
            for (const arrayName of arrays) {
                if (!Array.isArray(actor.getFlag(moduleId, arrayName))) {
                    issues.push(`Missing ${arrayName} array`);
                    await actor.setFlag(moduleId, arrayName, []);
                }
            }
            
            if (issues.length > 0) {
                console.log(`${moduleId} | Repaired ${issues.length} issues for ${actor.name}`);
                ui.notifications.info(`Faction ${actor.name} data repaired automatically`);
            }
            
            return true;
            
        } catch (error) {
            console.error(`${moduleId} | Validation/repair failed:`, error);
            return false;
        }
    }
    
    /**
     * Calculate power level based on total OPs
     * @param {number} totalOPs - Total organization points
     * @returns {string} Power level
     */
    static calculatePowerLevel(totalOPs) {
        if (totalOPs < 10) return "Emerging";
        if (totalOPs < 25) return "Growing";
        if (totalOPs < 40) return "Established";
        if (totalOPs < 55) return "Powerful";
        return "Dominant";
    }
    
    /**
     * Generate faction name suggestions
     * @param {string} theme - Theme for name generation ('military', 'trade', 'tech', etc.)
     * @returns {string[]} Array of suggested names
     */
    static generateFactionName(theme = 'general') {
        const themes = {
            military: ['Iron Legion', 'Steel Guard', 'Crimson Battalion', 'Shadow Regiment'],
            trade: ['Commerce Guild', 'Trade Consortium', 'Merchant Alliance', 'Trading Company'],
            tech: ['Tech Syndicate', 'Data Collective', 'Cyber Guild', 'Innovation Institute'],
            religious: ['Sacred Order', 'Divine Council', 'Faith Assembly', 'Holy Brotherhood'],
            general: ['New Republic', 'United Coalition', 'Free Alliance', 'Commonwealth']
        };
        
        return themes[theme] || themes.general;
    }
    
    /**
     * List all factions in the world
     * @returns {Actor[]} Array of faction actors
     */
    static listFactions() {
        return game.actors.filter(actor => actor.getFlag(this.MODULE_ID, 'isFaction'));
    }
    
    /**
     * Export faction data for backup/migration
     * @param {Actor} actor - Faction to export
     * @returns {Object} Exportable faction data
     */
    static exportFactionData(actor) {
        const moduleId = this.MODULE_ID;
        return {
            name: actor.name,
            type: actor.type,
            img: actor.img,
            flags: actor.flags[moduleId] || {},
            system: {
                details: actor.system?.details || {},
                biography: actor.system?.details?.biography || {}
            },
            exportedAt: new Date().toISOString(),
            exportedBy: game.user.id,
            version: this.VERSION
        };
    }
    
    /**
     * Run comprehensive diagnostics
     * @returns {Promise<Object>} Diagnostic results
     */
    static async runDiagnostics() {
        const results = {
            timestamp: new Date().toISOString(),
            version: this.VERSION,
            moduleId: this.MODULE_ID,
            tests: []
        };
        
        // Test 1: Core functionality
        try {
            const testFaction = await this.safeExecute(async () => {
                return await createFactionModern({
                    name: `Test Faction ${Date.now()}`
                });
            });
            
            if (testFaction) {
                await this.updateFactionOPs(testFaction, 'violence', 5);
                const isValid = this.validateFaction(testFaction);
                await testFaction.delete();
                
                results.tests.push({
                    name: 'Core Functionality',
                    passed: isValid,
                    details: 'Created, updated, and validated test faction'
                });
            } else {
                results.tests.push({
                    name: 'Core Functionality',
                    passed: false,
                    details: 'Failed to create test faction'
                });
            }
        } catch (error) {
            results.tests.push({
                name: 'Core Functionality',
                passed: false,
                error: error.message
            });
        }
        
        // Test 2: API availability
        const apiTest = {
            name: 'API Availability',
            passed: !!(window.BBTTCC?.Factions && game.modules.get(this.MODULE_ID)?.api),
            details: 'API exposed via multiple methods'
        };
        results.tests.push(apiTest);
        
        // Test 3: Existing factions validation
        const factions = this.listFactions();
        const validationResults = await Promise.all(
            factions.map(faction => this.validateFaction(faction))
        );
        
        results.tests.push({
            name: 'Existing Factions Validation',
            passed: validationResults.every(result => result),
            details: `${validationResults.filter(r => r).length}/${factions.length} factions valid`
        });
        
        console.log(`${this.MODULE_ID} | Diagnostics completed:`, results);
        return results;
    }
    
    /**
     * Cleanup method for proper resource management
     */
    static cleanup() {
        // Clean up hooks
        this.hookIds.forEach(id => Hooks.off(id));
        this.hookIds = [];
        
        // Clear global references
        delete window.bbttccFactionsTest;
        
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
                    version: '4.8.1-ENHANCED',
                    createdAt: new Date().toISOString(),
                    createdBy: game.user.id,
                    ops: foundry.utils.deepClone(DEFAULT_OPS_STRUCTURE),
                    warLog: [],
                    territories: [],
                    bases: []
                },
                core: {
                    sheetClass: "bbttcc-factions.FactionSheet"  // Confirmed working key format
                }
            }
        };
        
        console.log(`${moduleId} | Using sheet class:`, actorData.flags.core.sheetClass);
        console.log(`${moduleId} | Registered sheet key:`, BBTTCCFactionsModule.registeredSheetKey);
        
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
            hasOps: !!faction.getFlag(moduleId, 'ops')
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
    console.log('BBTTCC Factions v4.8.1-ENHANCED | Starting initialization...');
    
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
    
    // Register sheets with delay to ensure D&D5e is fully ready
    setTimeout(() => {
        console.log('BBTTCC Factions | Registering sheets with delay...');
        console.log('BBTTCC Factions | CONFIG.Actor available:', !!CONFIG?.Actor?.sheetClasses?.npc);
        console.log('BBTTCC Factions | FactionSheet available:', typeof FactionSheet !== 'undefined');
        
        BBTTCCFactionsModule.registerSheets();
    }, 2000); // 2 second delay
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