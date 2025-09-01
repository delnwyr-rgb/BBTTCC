/**
 * BBTTCC Territory Control Module v4.8.1-ENHANCED
 * Scene-based territory management with fully modern FoundryVTT v13+ patterns
 * Uses modern async/await, proper error handling, and current API patterns
 */

import { TerritoryManager } from './territory-manager.js';

// Territory types and their resource generation
const TERRITORY_TYPES = {
    settlement: { food: 2, materials: 1, trade: 3, name: "Settlement" },
    fortress: { materials: 3, military: 4, trade: 1, name: "Fortress" },
    mine: { materials: 5, trade: 2, food: 0, name: "Mine" },
    farm: { food: 5, materials: 1, trade: 2, name: "Farm" },
    port: { trade: 4, materials: 2, food: 2, name: "Port" },
    factory: { materials: 4, trade: 3, food: 0, name: "Factory" },
    research: { materials: 1, trade: 1, knowledge: 4, name: "Research Facility" }
};

// Territory size multipliers
const SIZE_MULTIPLIERS = {
    small: 0.5,
    medium: 1.0,
    large: 2.0,
    capital: 4.0
};

// Territory status constants
const TERRITORY_STATUS = {
    unclaimed: "Unclaimed",
    claimed: "Claimed",
    contested: "Contested",
    occupied: "Occupied"
};

/**
 * Modern module class with proper async/await patterns
 */
class BBTTCCTerritoryModule {
    static MODULE_ID = 'bbttcc-territory';
    static api = null;
    static initialized = false;
    static hookIds = [];
    
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
            
            this.initialized = true;
            console.log(`${this.MODULE_ID} | Initialization completed successfully`);
            
            // Notify other modules
            Hooks.callAll(`${this.MODULE_ID}.ready`, this.api);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to initialize:`, error);
            ui.notifications.error(`BBTTCC Territory failed to initialize: ${error.message}`);
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
            game.settings.register(this.MODULE_ID, 'autoCalculateResources', {
                name: 'BBTTCC.Settings.AutoCalculateResources.Name',
                hint: 'BBTTCC.Settings.AutoCalculateResources.Hint',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true,
                onChange: value => {
                    console.log(`${this.MODULE_ID} | Auto resource calculation ${value ? 'enabled' : 'disabled'}`);
                }
            });
            
            game.settings.register(this.MODULE_ID, 'enableTerritoryNotifications', {
                name: 'BBTTCC.Settings.EnableTerritoryNotifications.Name',
                hint: 'BBTTCC.Settings.EnableTerritoryNotifications.Hint',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true,
                onChange: value => {
                    console.log(`${this.MODULE_ID} | Territory notifications ${value ? 'enabled' : 'disabled'}`);
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
                Hooks.on('canvasReady', this.onCanvasReady.bind(this)),
                Hooks.on('updateScene', this.onUpdateScene.bind(this)),
                Hooks.on('renderSceneControls', this.onRenderSceneControls.bind(this))
            );
            
            console.log(`${this.MODULE_ID} | Hooks registered successfully`);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to setup hooks:`, error);
            throw error;
        }
    }
    
    /**
     * Create modern API with proper async patterns
     */
    static createAPI() {
        this.api = {
            // Core API methods
            claimTerritory: claimTerritoryModern,
            contestTerritory: contestTerritoryModern,
            openTerritoryManager: openTerritoryManagerModern,
            calculateTerritoryResources: calculateTerritoryResourcesModern,
            
            // Territory management
            getTerritoryData: this.getTerritoryData.bind(this),
            updateTerritoryStatus: this.updateTerritoryStatus.bind(this),
            
            // Classes (only include if available)
            ...(typeof TerritoryManager !== 'undefined' ? { TerritoryManager } : {}),
            
            // Data structures
            TERRITORY_TYPES: TERRITORY_TYPES,
            SIZE_MULTIPLIERS: SIZE_MULTIPLIERS,
            TERRITORY_STATUS: TERRITORY_STATUS,
            
            // Utility methods
            waitForReady: this.waitForReady.bind(this),
            validateTerritory: this.validateTerritory.bind(this),
            
            // Module info
            version: '4.8.1-ENHANCED',
            moduleId: this.MODULE_ID
        };
        
        // Log available classes for debugging
        console.log(`${this.MODULE_ID} | Exposing API with available classes:`, {
            TerritoryManager: typeof TerritoryManager !== 'undefined'
        });
        
        // Modern API exposure via game.modules pattern
        const module = game.modules.get(this.MODULE_ID);
        if (module) {
            module.api = this.api;
            console.log(`${this.MODULE_ID} | API exposed via game.modules.get("${this.MODULE_ID}").api`);
        }
        
        // Legacy compatibility
        window.BBTTCCTerritory = {
            claimTerritory: claimTerritoryModern,
            openTerritoryManager: openTerritoryManagerModern,
            version: '4.8.1-ENHANCED'
        };
        
        // Enhanced global API exposure for cross-module compatibility
        if (!globalThis.BBTTCC) globalThis.BBTTCC = {};
        globalThis.BBTTCC.Territory = this.api;
        
        // Legacy compatibility
        window.BBTTCC = window.BBTTCC || {};
        window.BBTTCC.Territory = this.api;
    }
    
    /**
     * Modern canvas ready hook with proper async handling
     */
    static async onCanvasReady() {
        try {
            console.log(`${this.MODULE_ID} | Canvas ready, initializing territory controls`);
            
            // Initialize territory visualization if enabled
            if (canvas.scene) {
                await this.initializeTerritoryVisualization();
            }
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onCanvasReady:`, error);
        }
    }
    
    /**
     * Modern scene update hook
     */
    static async onUpdateScene(scene, changes, options, userId) {
        try {
            if (changes.flags && changes.flags[this.MODULE_ID]) {
                console.log(`${this.MODULE_ID} | Territory data updated for scene:`, scene.name);
                
                // Refresh territory visualization
                await this.refreshTerritoryVisualization();
                
                // Notify about territory changes
                if (game.settings.get(this.MODULE_ID, 'enableTerritoryNotifications')) {
                    const territoryData = scene.getFlag(this.MODULE_ID, 'territories') || {};
                    const territoryCount = Object.keys(territoryData).length;
                    ui.notifications.info(`Territory data updated: ${territoryCount} territories tracked`);
                }
            }
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onUpdateScene:`, error);
        }
    }
    
    /**
     * Modern scene controls rendering hook
     */
    static onRenderSceneControls(app, html, data) {
        try {
            // Add territory management controls if user is GM
            if (game.user.isGM && data.controls) {
                const territoryControls = {
                    name: "bbttcc-territory",
                    title: "BBTTCC Territory Controls",
                    icon: "fas fa-map-marked-alt",
                    layer: "BackgroundLayer",
                    tools: [
                        {
                            name: "territory-manager",
                            title: "Open Territory Manager",
                            icon: "fas fa-cog",
                            onClick: () => openTerritoryManagerModern(),
                            button: true
                        },
                        {
                            name: "claim-territory",
                            title: "Claim Territory",
                            icon: "fas fa-flag",
                            onClick: () => this.startTerritoryClaimMode(),
                            button: true
                        }
                    ]
                };
                
                data.controls.push(territoryControls);
            }
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error in onRenderSceneControls:`, error);
        }
    }
    
    /**
     * Initialize territory visualization
     */
    static async initializeTerritoryVisualization() {
        try {
            if (!canvas.scene) return;
            
            const territories = canvas.scene.getFlag(this.MODULE_ID, 'territories') || {};
            
            // Create visualization for each territory
            for (const [territoryId, territoryData] of Object.entries(territories)) {
                await this.visualizeTerritory(territoryId, territoryData);
            }
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error initializing territory visualization:`, error);
        }
    }
    
    /**
     * Refresh territory visualization
     */
    static async refreshTerritoryVisualization() {
        try {
            // Clear existing visualization
            await this.clearTerritoryVisualization();
            
            // Reinitialize
            await this.initializeTerritoryVisualization();
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error refreshing territory visualization:`, error);
        }
    }
    
    /**
     * Clear territory visualization
     */
    static async clearTerritoryVisualization() {
        try {
            // Remove territory visualization drawings
            const drawings = canvas.drawings?.objects?.children || [];
            const territoryDrawings = drawings.filter(d => d.document.flags?.[this.MODULE_ID]?.isTerritory);
            
            for (const drawing of territoryDrawings) {
                await drawing.document.delete();
            }
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error clearing territory visualization:`, error);
        }
    }
    
    /**
     * Visualize a single territory
     */
    static async visualizeTerritory(territoryId, territoryData) {
        try {
            if (!territoryData.boundaries || !canvas.scene) return;
            
            // Create drawing to represent territory boundaries
            const drawingData = {
                type: "polygon",
                author: game.user.id,
                x: territoryData.boundaries.x || 0,
                y: territoryData.boundaries.y || 0,
                shape: {
                    points: territoryData.boundaries.points || [],
                    type: "polygon"
                },
                strokeColor: this.getTerritoryColor(territoryData.status),
                strokeWidth: 3,
                strokeAlpha: 0.8,
                fillColor: this.getTerritoryColor(territoryData.status),
                fillType: 0,
                fillAlpha: 0.2,
                text: territoryData.name || `Territory ${territoryId}`,
                fontSize: 24,
                textColor: "#FFFFFF",
                flags: {
                    [this.MODULE_ID]: {
                        isTerritory: true,
                        territoryId: territoryId,
                        territoryData: territoryData
                    }
                }
            };
            
            await Drawing.create(drawingData);
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error visualizing territory:`, error);
        }
    }
    
    /**
     * Get color for territory based on status
     */
    static getTerritoryColor(status) {
        const colors = {
            unclaimed: "#808080",    // Gray
            claimed: "#28a745",      // Green
            contested: "#ffc107",    // Yellow
            occupied: "#dc3545"      // Red
        };
        
        return colors[status] || colors.unclaimed;
    }
    
    /**
     * Start territory claim mode (interactive)
     */
    static startTerritoryClaimMode() {
        try {
            ui.notifications.info("Click on the canvas to define territory boundaries");
            
            // Add interactive territory claiming logic here
            // This would involve canvas interaction for drawing territory boundaries
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error starting territory claim mode:`, error);
        }
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
     * Get territory data with safe flag access
     */
    static async getTerritoryData(scene, territoryId) {
        try {
            if (!scene) {
                throw new Error('Scene is required');
            }
            
            const territories = scene.getFlag(this.MODULE_ID, 'territories') || {};
            const territoryData = territories[territoryId];
            
            if (!territoryData) {
                throw new Error(`Territory ${territoryId} not found`);
            }
            
            return territoryData;
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error getting territory data:`, error);
            throw error;
        }
    }
    
    /**
     * Update territory status
     */
    static async updateTerritoryStatus(scene, territoryId, newStatus) {
        try {
            if (!scene) {
                throw new Error('Scene is required');
            }
            
            const territories = scene.getFlag(this.MODULE_ID, 'territories') || {};
            
            if (!territories[territoryId]) {
                throw new Error(`Territory ${territoryId} not found`);
            }
            
            territories[territoryId].status = newStatus;
            territories[territoryId].lastUpdated = new Date().toISOString();
            
            await scene.setFlag(this.MODULE_ID, 'territories', territories);
            
            console.log(`${this.MODULE_ID} | Territory ${territoryId} status updated to ${newStatus}`);
            
            return territories[territoryId];
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error updating territory status:`, error);
            throw error;
        }
    }
    
    /**
     * Validate territory structure
     */
    static validateTerritory(territoryData) {
        try {
            if (!territoryData) return false;
            
            const requiredFields = ['name', 'type', 'size', 'status'];
            return requiredFields.every(field => territoryData.hasOwnProperty(field));
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Error validating territory:`, error);
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
        
        // Clear territory visualization
        this.clearTerritoryVisualization().catch(console.error);
        
        // Reset state
        this.initialized = false;
        this.api = null;
        
        console.log(`${this.MODULE_ID} | Cleanup completed`);
    }
}

/**
 * Modern territory claiming function with proper async/await patterns and error handling
 */
async function claimTerritoryModern(territoryData = {}) {
    const moduleId = BBTTCCTerritoryModule.MODULE_ID;
    const startTime = performance.now();
    
    console.log(`${moduleId} | Starting modern territory claim...`);
    
    try {
        // Validation
        if (!game.ready) {
            throw new Error('Game not ready for territory operations');
        }
        
        if (!game.user.isGM) {
            throw new Error('Only GMs can claim territories');
        }
        
        if (!canvas.scene) {
            throw new Error('No active scene for territory claiming');
        }
        
        // Input validation
        if (!territoryData.name || typeof territoryData.name !== 'string') {
            throw new Error('Territory name is required and must be a string');
        }
        
        if (!territoryData.type || !TERRITORY_TYPES[territoryData.type]) {
            throw new Error(`Invalid territory type. Must be one of: ${Object.keys(TERRITORY_TYPES).join(', ')}`);
        }
        
        // Generate territory ID
        const territoryId = territoryData.id || foundry.utils.randomID();
        
        // Check for existing territory with same name
        const existingTerritories = canvas.scene.getFlag(moduleId, 'territories') || {};
        const nameConflict = Object.values(existingTerritories).find(t => 
            t.name.toLowerCase() === territoryData.name.toLowerCase()
        );
        
        if (nameConflict) {
            throw new Error(`Territory named "${territoryData.name}" already exists in this scene`);
        }
        
        // Prepare territory data with modern patterns
        const newTerritory = {
            id: territoryId,
            name: territoryData.name,
            type: territoryData.type,
            size: territoryData.size || 'medium',
            status: territoryData.status || 'claimed',
            claimedBy: territoryData.claimedBy || null,
            claimedAt: new Date().toISOString(),
            resources: this.calculateTerritoryResources(territoryData.type, territoryData.size),
            boundaries: territoryData.boundaries || null,
            description: territoryData.description || '',
            lastUpdated: new Date().toISOString(),
            createdBy: game.user.id
        };
        
        // Update scene flags with territory data
        const updatedTerritories = {
            ...existingTerritories,
            [territoryId]: newTerritory
        };
        
        await canvas.scene.setFlag(moduleId, 'territories', updatedTerritories);
        
        // Update faction territory list if faction specified
        if (territoryData.claimedBy) {
            await this.updateFactionTerritories(territoryData.claimedBy, territoryId, 'add');
        }
        
        const endTime = performance.now();
        console.log(`${moduleId} | Territory claimed successfully in ${(endTime - startTime).toFixed(2)}ms:`, {
            name: newTerritory.name,
            id: territoryId,
            type: newTerritory.type,
            claimedBy: newTerritory.claimedBy
        });
        
        // Success notification
        ui.notifications.info(`Territory "${newTerritory.name}" claimed successfully!`);
        
        // Refresh visualization
        await BBTTCCTerritoryModule.refreshTerritoryVisualization();
        
        return newTerritory;
        
    } catch (error) {
        const endTime = performance.now();
        console.error(`${moduleId} | Territory claim failed after ${(endTime - startTime).toFixed(2)}ms:`, {
            error: error.message,
            stack: error.stack,
            territoryData: territoryData
        });
        
        ui.notifications.error(`Failed to claim territory: ${error.message}`);
        throw error;
    }
}

/**
 * Modern territory contesting function
 */
async function contestTerritoryModern(territoryId, contestedBy) {
    const moduleId = BBTTCCTerritoryModule.MODULE_ID;
    
    try {
        if (!game.user.isGM) {
            throw new Error('Only GMs can contest territories');
        }
        
        if (!canvas.scene) {
            throw new Error('No active scene');
        }
        
        const territories = canvas.scene.getFlag(moduleId, 'territories') || {};
        const territory = territories[territoryId];
        
        if (!territory) {
            throw new Error(`Territory ${territoryId} not found`);
        }
        
        // Update territory status
        territory.status = 'contested';
        territory.contestedBy = contestedBy;
        territory.contestedAt = new Date().toISOString();
        territory.lastUpdated = new Date().toISOString();
        
        await canvas.scene.setFlag(moduleId, 'territories', territories);
        
        ui.notifications.info(`Territory "${territory.name}" is now contested!`);
        
        // Refresh visualization
        await BBTTCCTerritoryModule.refreshTerritoryVisualization();
        
        return territory;
        
    } catch (error) {
        console.error(`${moduleId} | Error contesting territory:`, error);
        ui.notifications.error(`Failed to contest territory: ${error.message}`);
        throw error;
    }
}

/**
 * Modern territory manager opening function
 */
async function openTerritoryManagerModern() {
    const moduleId = BBTTCCTerritoryModule.MODULE_ID;
    
    try {
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can access the Territory Manager');
            return;
        }
        
        // Get the API to access TerritoryManager class
        const api = await BBTTCCTerritoryModule.waitForReady(5000);
        
        // Create and render territory manager
        const manager = new api.TerritoryManager();
        manager.render(true);
        
        console.log(`${moduleId} | Territory Manager opened successfully`);
        
    } catch (error) {
        console.error(`${moduleId} | Error opening Territory Manager:`, error);
        ui.notifications.error(`Failed to open Territory Manager: ${error.message}`);
        throw error;
    }
}

/**
 * Modern territory resource calculation
 */
async function calculateTerritoryResourcesModern(territoryType, territorySize = 'medium') {
    try {
        const typeData = TERRITORY_TYPES[territoryType];
        if (!typeData) {
            throw new Error(`Invalid territory type: ${territoryType}`);
        }
        
        const sizeMultiplier = SIZE_MULTIPLIERS[territorySize] || 1.0;
        
        const resources = {};
        for (const [resource, baseAmount] of Object.entries(typeData)) {
            if (resource !== 'name' && typeof baseAmount === 'number') {
                resources[resource] = Math.floor(baseAmount * sizeMultiplier);
            }
        }
        
        return resources;
        
    } catch (error) {
        console.error('BBTTCC Territory | Error calculating resources:', error);
        throw error;
    }
}

/**
 * Update faction territory lists
 */
async function updateFactionTerritories(factionId, territoryId, action) {
    try {
        const faction = game.actors.get(factionId);
        if (!faction || !faction.getFlag('bbttcc-factions', 'isFaction')) {
            return; // Not a faction or faction doesn't exist
        }
        
        const currentTerritories = faction.getFlag('bbttcc-factions', 'territories') || [];
        
        let updatedTerritories;
        if (action === 'add' && !currentTerritories.includes(territoryId)) {
            updatedTerritories = [...currentTerritories, territoryId];
        } else if (action === 'remove') {
            updatedTerritories = currentTerritories.filter(t => t !== territoryId);
        } else {
            return; // No change needed
        }
        
        await faction.setFlag('bbttcc-factions', 'territories', updatedTerritories);
        
    } catch (error) {
        console.error('BBTTCC Territory | Error updating faction territories:', error);
    }
}

/**
 * Initialize the module with modern patterns
 */
Hooks.once('init', async () => {
    console.log('BBTTCC Territory v4.8.1-ENHANCED | Starting initialization with FoundryVTT v13+ and D&D5e v5.4+ support...');
    
    // D&D5e v5.4 compatibility note
    if (game.system.id === 'dnd5e') {
        const version = game.system.version;
        if (foundry.utils.isNewerVersion(version, "5.4.0")) {
            console.log(`bbttcc-territory | Running on D&D5e v${version} - fully compatible`);
        } else if (foundry.utils.isNewerVersion(version, "5.0.0")) {
            console.warn(`bbttcc-territory | Running on D&D5e v${version} - compatible but may show deprecation warnings. v5.4+ recommended.`);
        }
    }
    
    try {
        await BBTTCCTerritoryModule.initialize();
    } catch (error) {
        console.error('BBTTCC Territory | Initialization failed:', error);
        ui.notifications.error(`BBTTCC Territory failed to initialize: ${error.message}`);
    }
});

/**
 * Final setup when game is ready
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Territory | Ready hook fired, module fully operational');
});

/**
 * Cleanup on module disable
 */
Hooks.on('closeModule', (moduleId) => {
    if (moduleId === BBTTCCTerritoryModule.MODULE_ID) {
        BBTTCCTerritoryModule.cleanup();
    }
});

// Export for ES module compatibility
export { 
    BBTTCCTerritoryModule, 
    claimTerritoryModern, 
    contestTerritoryModern,
    openTerritoryManagerModern,
    calculateTerritoryResourcesModern,
    TERRITORY_TYPES, 
    SIZE_MULTIPLIERS, 
    TERRITORY_STATUS 
};