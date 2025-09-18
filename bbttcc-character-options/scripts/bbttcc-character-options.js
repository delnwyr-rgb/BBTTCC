/**
 * BBTTCC Character Options Module v4.8.1-ENHANCED
 * Character customization options for the BBTTCC Strategic Warfare Suite
 * Provides archetypes, crew types, occult associations, political affiliations, and enlightenment levels
 */

// Import the character options importer
import { BBTTCCCompleteImporter } from './complete-import.js';

class BBTTCCCharacterOptionsModule {
    static MODULE_ID = 'bbttcc-character-options';
    static VERSION = '4.8.1-ENHANCED';
    static api = null;
    static initialized = false;
    static factionsAPI = null;
    
    /**
     * Initialize the module
     */
    static async initialize() {
        if (this.initialized) {
            console.warn(`${this.MODULE_ID} | Already initialized, skipping...`);
            return;
        }
        
        console.log(`${this.MODULE_ID} | Initializing Character Options module...`);
        
        try {
            // Check for required modules
            await this.checkDependencies();
            
            // Setup module components
            await this.setupSettings();
            this.setupHooks();
            this.createAPI();
            
            this.initialized = true;
            console.log(`${this.MODULE_ID} | Initialization completed successfully`);
            
            // Notify other modules
            Hooks.callAll(`${this.MODULE_ID}.ready`, this.api);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to initialize:`, error);
            ui.notifications.error('BBTTCC Character Options failed to initialize. Check console for details.');
            throw error;
        }
    }
    
    /**
     * Check for required dependencies
     */
    static async checkDependencies() {
        // Check for BBTTCC Factions module
        const factionsModule = game.modules.get('bbttcc-factions');
        if (!factionsModule || !factionsModule.active) {
            throw new Error('BBTTCC Factions module is required but not found or inactive');
        }
        
        // Wait for factions API to be available
        if (factionsModule.api) {
            this.factionsAPI = factionsModule.api;
            console.log(`${this.MODULE_ID} | Connected to BBTTCC Factions API`);
        } else {
            // Wait for factions module to be ready
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('BBTTCC Factions API not ready within timeout'));
                }, 10000);
                
                Hooks.once('bbttcc-factions.ready', (api) => {
                    clearTimeout(timeout);
                    this.factionsAPI = api;
                    console.log(`${this.MODULE_ID} | Connected to BBTTCC Factions API via hook`);
                    resolve();
                });
            });
        }
    }
    
    /**
     * Setup module settings
     */
    static async setupSettings() {
        game.settings.register(this.MODULE_ID, 'autoApplyBonuses', {
            name: 'BBTTCC.CharacterOptions.Settings.AutoApplyBonuses.Name',
            hint: 'BBTTCC.CharacterOptions.Settings.AutoApplyBonuses.Hint',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        
        game.settings.register(this.MODULE_ID, 'showTooltips', {
            name: 'BBTTCC.CharacterOptions.Settings.ShowTooltips.Name',
            hint: 'BBTTCC.CharacterOptions.Settings.ShowTooltips.Hint',
            scope: 'world',
            config: true,
            type: Boolean,
            default: true
        });
        
        console.log(`${this.MODULE_ID} | Settings registered successfully`);
    }
    
    /**
     * Setup module hooks
     */
    static setupHooks() {
        // Hook into item creation to handle character options
        Hooks.on('createItem', this.onItemCreate.bind(this));
        Hooks.on('deleteItem', this.onItemDelete.bind(this));
        
        // Hook into actor updates to apply bonuses
        Hooks.on('updateActor', this.onActorUpdate.bind(this));
        
        console.log(`${this.MODULE_ID} | Hooks registered successfully`);
    }
    
    /**
     * Create module API
     */
    static createAPI() {
        this.api = {
            // Core functionality
            applyCharacterOption: this.applyCharacterOption.bind(this),
            removeCharacterOption: this.removeCharacterOption.bind(this),
            getCharacterOptions: this.getCharacterOptions.bind(this),
            calculateBonuses: this.calculateBonuses.bind(this),
            
            // Utility functions
            isCharacterOption: this.isCharacterOption.bind(this),
            getOptionCategory: this.getOptionCategory.bind(this),
            validateCharacterOption: this.validateCharacterOption.bind(this),
            
            // Configuration
            config: {
                categories: [
                    'character-archetypes',
                    'crew-types', 
                    'occult-associations',
                    'political-affiliations',
                    'enlightenment-levels',
                    'sephirothic-alignments'
                ],
                supportedBonuses: ['violence', 'nonlethal', 'intrigue', 'economy', 'softpower', 'diplomacy']
            },
            
            // Module info
            version: this.VERSION,
            moduleId: this.MODULE_ID,
            isReady: () => this.initialized
        };
        
        // Expose API
        const module = game.modules.get(this.MODULE_ID);
        if (module) {
            module.api = this.api;
            console.log(`${this.MODULE_ID} | API exposed via game.modules`);
        }
        
        // Global exposure for cross-module compatibility
        if (!globalThis.BBTTCC) globalThis.BBTTCC = {};
        globalThis.BBTTCC.CharacterOptions = this.api;
        
        // Make importer available globally
        globalThis.BBTTCCCompleteImporter = BBTTCCCompleteImporter;
        
        console.log(`${this.MODULE_ID} | API created successfully`);
    }
    
    /**
     * Handle item creation
     */
    static async onItemCreate(item, options, userId) {
        if (!this.isCharacterOption(item)) return;
        
        try {
            const actor = item.parent;
            if (!actor || actor.type !== 'character') return;
            
            const autoApply = game.settings.get(this.MODULE_ID, 'autoApplyBonuses');
            if (autoApply) {
                await this.applyCharacterOption(actor, item);
            }
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onItemCreate:`, error);
        }
    }
    
    /**
     * Handle item deletion
     */
    static async onItemDelete(item, options, userId) {
        if (!this.isCharacterOption(item)) return;
        
        try {
            const actor = item.parent;
            if (!actor || actor.type !== 'character') return;
            
            const autoApply = game.settings.get(this.MODULE_ID, 'autoApplyBonuses');
            if (autoApply) {
                await this.removeCharacterOption(actor, item);
            }
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onItemDelete:`, error);
        }
    }
    
    /**
     * Handle actor updates
     */
    static async onActorUpdate(actor, data, options, userId) {
        // Could be used for future functionality like faction linking updates
    }
    
    /**
     * Apply character option bonuses to linked faction
     */
    static async applyCharacterOption(actor, item) {
        if (!this.factionsAPI) {
            console.warn(`${this.MODULE_ID} | Factions API not available`);
            return;
        }
        
        try {
            // Find linked faction
            const linkedFactionId = actor.getFlag(this.MODULE_ID, 'linkedFaction');
            if (!linkedFactionId) {
                console.log(`${this.MODULE_ID} | No linked faction for ${actor.name}`);
                return;
            }
            
            const faction = game.actors.get(linkedFactionId);
            if (!faction || !this.factionsAPI.factions.validate(faction)) {
                console.warn(`${this.MODULE_ID} | Invalid linked faction`);
                return;
            }
            
            // Parse bonuses from item description
            const bonuses = this.extractBonuses(item);
            if (!bonuses || Object.keys(bonuses).length === 0) {
                console.log(`${this.MODULE_ID} | No bonuses found in ${item.name}`);
                return;
            }
            
            // Apply bonuses to faction
            for (const [opType, bonus] of Object.entries(bonuses)) {
                if (this.api.config.supportedBonuses.includes(opType)) {
                    const currentOps = await this.factionsAPI.factions.get(faction);
                    const currentValue = currentOps.ops[opType]?.value || 0;
                    await this.factionsAPI.factions.update(faction, opType, currentValue + bonus);
                    
                    console.log(`${this.MODULE_ID} | Applied +${bonus} ${opType} to ${faction.name}`);
                }
            }
            
            ui.notifications.info(`Applied character option bonuses to faction ${faction.name}`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error applying character option:`, error);
            ui.notifications.warn(`Failed to apply character option bonuses`);
        }
    }
    
    /**
     * Remove character option bonuses from linked faction
     */
    static async removeCharacterOption(actor, item) {
        if (!this.factionsAPI) return;
        
        try {
            const linkedFactionId = actor.getFlag(this.MODULE_ID, 'linkedFaction');
            if (!linkedFactionId) return;
            
            const faction = game.actors.get(linkedFactionId);
            if (!faction || !this.factionsAPI.factions.validate(faction)) return;
            
            const bonuses = this.extractBonuses(item);
            if (!bonuses || Object.keys(bonuses).length === 0) return;
            
            // Remove bonuses from faction
            for (const [opType, bonus] of Object.entries(bonuses)) {
                if (this.api.config.supportedBonuses.includes(opType)) {
                    const currentOps = await this.factionsAPI.factions.get(faction);
                    const currentValue = currentOps.ops[opType]?.value || 0;
                    await this.factionsAPI.factions.update(faction, opType, Math.max(0, currentValue - bonus));
                    
                    console.log(`${this.MODULE_ID} | Removed -${bonus} ${opType} from ${faction.name}`);
                }
            }
            
            ui.notifications.info(`Removed character option bonuses from faction ${faction.name}`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error removing character option:`, error);
        }
    }
    
    /**
     * Get all character options for an actor
     */
    static getCharacterOptions(actor) {
        if (!actor) return [];
        
        return actor.items.filter(item => this.isCharacterOption(item));
    }
    
    /**
     * Calculate total bonuses from all character options
     */
    static calculateBonuses(actor) {
        const options = this.getCharacterOptions(actor);
        const totalBonuses = {};
        
        for (const item of options) {
            const bonuses = this.extractBonuses(item);
            for (const [opType, bonus] of Object.entries(bonuses)) {
                if (!totalBonuses[opType]) totalBonuses[opType] = 0;
                totalBonuses[opType] += bonus;
            }
        }
        
        return totalBonuses;
    }
    
    /**
     * Check if an item is a character option
     */
    static isCharacterOption(item) {
        if (!item || item.type !== 'feat') return false;
        
        const source = item.system?.source || '';
        const sourceStr = typeof source === 'string' ? source : '';
        return sourceStr === 'BBTTCC' || sourceStr.includes('BBTTCC');
    }
    
    /**
     * Get the category of a character option
     */
    static getOptionCategory(item) {
        if (!this.isCharacterOption(item)) return null;
        
        const name = item.name.toLowerCase();
        if (name.includes('archetype:')) return 'character-archetypes';
        if (name.includes('crew type:')) return 'crew-types';
        if (name.includes('occult association:')) return 'occult-associations';
        if (name.includes('political affiliation:')) return 'political-affiliations';
        if (name.includes('enlightenment:')) return 'enlightenment-levels';
        if (name.includes('alignment:')) return 'sephirothic-alignments';
        
        return null;
    }
    
    /**
     * Validate a character option item
     */
    static validateCharacterOption(item) {
        if (!this.isCharacterOption(item)) return false;
        
        const category = this.getOptionCategory(item);
        if (!category) return false;
        
        const bonuses = this.extractBonuses(item);
        return bonuses !== null;
    }
    
    /**
     * Extract bonuses from item description
     * Parses bonus text like "+3 Violence OPs", "+2 Economy and Soft Power"
     */
    static extractBonuses(item) {
        if (!item?.system?.description?.value) return {};
        
        const description = item.system.description.value;
        const bonuses = {};
        
        // Patterns to match various bonus formats
        const patterns = [
            /\+(\d+)\s+Violence\s+OP/gi,
            /\+(\d+)\s+Non-?Lethal\s+OP/gi,
            /\+(\d+)\s+Intrigue\s+OP/gi,
            /\+(\d+)\s+Economy\s+OP/gi,
            /\+(\d+)\s+Soft\s+Power\s+OP/gi,
            /\+(\d+)\s+Diplomacy\s+OP/gi
        ];
        
        const opTypes = ['violence', 'nonlethal', 'intrigue', 'economy', 'softpower', 'diplomacy'];
        
        patterns.forEach((pattern, index) => {
            const matches = [...description.matchAll(pattern)];
            if (matches.length > 0) {
                const opType = opTypes[index];
                bonuses[opType] = parseInt(matches[0][1]);
            }
        });
        
        return bonuses;
    }
    
    /**
     * Run module diagnostics
     */
    static async runDiagnostics() {
        const results = {
            timestamp: new Date().toISOString(),
            version: this.VERSION,
            moduleId: this.MODULE_ID,
            tests: []
        };
        
        // Test 1: Module initialization
        results.tests.push({
            name: 'Module Initialization',
            passed: this.initialized,
            details: 'Module initialization status'
        });
        
        // Test 2: Dependencies
        const factionsModule = game.modules.get('bbttcc-factions');
        results.tests.push({
            name: 'BBTTCC Factions Dependency',
            passed: !!(factionsModule && factionsModule.active && this.factionsAPI),
            details: 'BBTTCC Factions module availability and API connection'
        });
        
        // Test 3: World Items Tab
        const worldBBTTCCItems = game.items.filter(item => {
            const source = item.system?.source || '';
            const sourceStr = typeof source === 'string' ? source : '';
            return sourceStr === 'BBTTCC' || sourceStr.includes('BBTTCC');
        });
        
        results.tests.push({
            name: 'World Items Tab',
            passed: worldBBTTCCItems.length > 0,
            details: `${worldBBTTCCItems.length} BBTTCC items available in world Items tab`
        });
        
        console.log(`${this.MODULE_ID} | Diagnostics completed:`, results);
        return results;
    }
}

/**
 * Initialize the module
 */
Hooks.once('init', async () => {
    console.log('BBTTCC Character Options | Starting initialization...');
    
    try {
        await BBTTCCCharacterOptionsModule.initialize();
    } catch (error) {
        console.error('BBTTCC Character Options | Initialization failed:', error);
        ui.notifications.error('BBTTCC Character Options failed to initialize. Check console for details.');
    }
});

/**
 * Final setup when game is ready
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Character Options | Module fully operational');
    ui.notifications.info(game.i18n.localize('BBTTCC.CharacterOptions.Notifications.PacksLoaded'));
});

// Export for ES module compatibility
export { BBTTCCCharacterOptionsModule };