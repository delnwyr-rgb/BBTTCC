/**
 * BBTTCC Radiation v4.8.1-ENHANCED
 * Advanced radiation tracking and environmental hazard system for FoundryVTT v13+
 * Uses modern async/await patterns and flags-based storage
 */

import { RadiationTracker } from './radiation-tracker.js';
import { RadiationZoneConfig } from './radiation-zone.js';

// Default radiation structure
const DEFAULT_RADIATION_STRUCTURE = {
    level: 0,
    exposure: 0,
    threshold: 100,
    effects: [],
    protection: 0,
    lastUpdate: null,
    accumulation: 'linear',
    decay: {
        enabled: true,
        rate: 1,
        interval: 3600 // 1 hour in seconds
    }
};

// Radiation levels and effects
const RADIATION_LEVELS = {
    safe: { 
        name: 'Safe', 
        range: [0, 10], 
        color: '#00FF00', 
        description: 'No radiation effects',
        effects: []
    },
    low: { 
        name: 'Low', 
        range: [11, 25], 
        color: '#FFFF00', 
        description: 'Mild discomfort, no mechanical effects',
        effects: ['radiation_sickness_mild']
    },
    moderate: { 
        name: 'Moderate', 
        range: [26, 50], 
        color: '#FFA500', 
        description: 'Constitution saves required, fatigue possible',
        effects: ['radiation_sickness_moderate', 'fatigue']
    },
    high: { 
        name: 'High', 
        range: [51, 75], 
        color: '#FF4500', 
        description: 'Ongoing damage, exhaustion levels',
        effects: ['radiation_sickness_severe', 'exhaustion_1']
    },
    severe: { 
        name: 'Severe', 
        range: [76, 90], 
        color: '#FF0000', 
        description: 'Serious ongoing damage, multiple exhaustion',
        effects: ['radiation_poisoning', 'exhaustion_2', 'vulnerability_poison']
    },
    lethal: { 
        name: 'Lethal', 
        range: [91, 100], 
        color: '#8B0000', 
        description: 'Life-threatening, rapid deterioration',
        effects: ['radiation_poisoning_severe', 'exhaustion_3', 'paralysis_partial']
    }
};

// Radiation protection types
const PROTECTION_TYPES = {
    none: { name: 'None', protection: 0, description: 'No protection' },
    basic: { name: 'Basic Clothing', protection: 5, description: 'Minimal protection from light exposure' },
    enhanced: { name: 'Enhanced Gear', protection: 15, description: 'Specialized clothing and equipment' },
    hazmat: { name: 'Hazmat Suit', protection: 30, description: 'Professional radiation protection' },
    powered: { name: 'Powered Suit', protection: 50, description: 'Advanced powered protection system' },
    shielded: { name: 'Radiation Shielding', protection: 75, description: 'Heavy shielding and isolation' }
};

// Environmental radiation zones
const ZONE_TYPES = {
    background: { name: 'Background', intensity: 1, description: 'Natural background radiation' },
    urban: { name: 'Urban Decay', intensity: 5, description: 'Post-apocalyptic urban environment' },
    industrial: { name: 'Industrial', intensity: 15, description: 'Contaminated industrial areas' },
    military: { name: 'Military Site', intensity: 25, description: 'Former military installations' },
    reactor: { name: 'Reactor Zone', intensity: 40, description: 'Nuclear facility areas' },
    ground_zero: { name: 'Ground Zero', intensity: 60, description: 'Direct bomb impact sites' },
    hot_zone: { name: 'Hot Zone', intensity: 80, description: 'Extreme contamination areas' }
};

class BBTTCCRadiationModule {
    static MODULE_ID = 'bbttcc-radiation';
    static MODULE_TITLE = 'BBTTCC Radiation v4.8.1-ENHANCED';
    
    static api = null;
    static isReady = false;
    static readyPromise = null;
    static radiationTimer = null;
    
    /**
     * Initialize the module with modern patterns
     */
    static async initialize() {
        try {
            console.log(`${this.MODULE_TITLE} | Initializing with modern patterns`);
            
            // Set up ready promise for proper async initialization
            this.readyPromise = new Promise(async (resolve, reject) => {
                try {
                    // Register hooks with proper async handling
                    Hooks.on('ready', async () => {
                        await this.onReady();
                        resolve(this);
                    });
                    
                    // Actor update hooks for radiation tracking
                    Hooks.on('updateToken', this.onUpdateToken.bind(this));
                    Hooks.on('createToken', this.onCreateToken.bind(this));
                    
                    // Scene change hooks
                    Hooks.on('canvasReady', this.onCanvasReady.bind(this));
                    
                    // Mark as ready when initialization completes
                    this.isReady = true;
                    
                } catch (error) {
                    console.error(`${this.MODULE_TITLE} | Initialization error:`, error);
                    reject(error);
                }
            });
            
            console.log(`${this.MODULE_TITLE} | Initialization complete`);
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Fatal initialization error:`, error);
            throw error;
        }
    }
    
    /**
     * Check system compatibility requirements
     */
    static checkCompatibility() {
        const issues = [];
        
        // Check game system
        if (game.system.id !== 'dnd5e') {
            issues.push(`D&D 5e system required, found: ${game.system.id}`);
        }
        
        // Check system version
        if (!foundry.utils.isNewerVersion(game.system.version, "5.0.0")) {
            issues.push(`D&D 5e v5.0.0+ required, found: ${game.system.version}`);
        }
        
        // Check Foundry version
        if (!foundry.utils.isNewerVersion(game.version, "13.0.0")) {
            issues.push(`FoundryVTT v13.0.0+ required, found: ${game.version}`);
        }
        
        return {
            compatible: issues.length === 0,
            issues: issues
        };
    }
    
    /**
     * Handle ready hook with proper async patterns
     */
    static async onReady() {
        try {
            console.log(`${this.MODULE_TITLE} | Ready hook triggered`);
            
            // Comprehensive system compatibility check
            const compatibility = this.checkCompatibility();
            if (!compatibility.compatible) {
                console.error(`${this.MODULE_TITLE} | Compatibility check failed:`, compatibility.issues);
                throw new Error(`Compatibility issues: ${compatibility.issues.join(', ')}`);
            }
            
            // Initialize UI components
            await this.initializeUI();
            
            // Expose API now that game.modules is available
            this.exposeAPI();
            
            // Start radiation tracking if enabled
            try {
                if (game.settings.get(this.MODULE_ID, 'enableAutomaticTracking')) {
                    this.startRadiationTracking();
                }
            } catch (error) {
                console.warn(`${this.MODULE_TITLE} | Setting 'enableAutomaticTracking' not yet registered, skipping automatic tracking`);
            }
            
            this.isReady = true;
            console.log(`${this.MODULE_TITLE} | System fully operational`);
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Ready hook error:`, error);
            ui.notifications.error(`${this.MODULE_TITLE} initialization failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Initialize UI components
     */
    static async initializeUI() {
        try {
            console.log(`${this.MODULE_TITLE} | Registering UI applications`);
            
            // Add radiation controls to token HUD if enabled
            try {
                if (game.settings.get(this.MODULE_ID, 'showTokenControls')) {
                    Hooks.on('renderTokenHUD', this.onRenderTokenHUD.bind(this));
                }
            } catch (error) {
                console.warn(`${this.MODULE_TITLE} | Setting 'showTokenControls' not yet registered, skipping token HUD integration`);
            }
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | UI initialization error:`, error);
            throw error;
        }
    }
    
    /**
     * Register module settings
     */
    static registerSettings() {
        try {
            game.settings.register(this.MODULE_ID, 'enableAutomaticTracking', {
                name: 'Enable Automatic Tracking',
                hint: 'Automatically track radiation exposure for tokens over time',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true,
                onChange: (value) => {
                    if (value) {
                        this.startRadiationTracking();
                    } else {
                        this.stopRadiationTracking();
                    }
                }
            });
            
            game.settings.register(this.MODULE_ID, 'trackingInterval', {
                name: 'Tracking Interval (seconds)',
                hint: 'How often to update radiation exposure (recommended: 60-300 seconds)',
                scope: 'world',
                config: true,
                type: Number,
                default: 180,
                onChange: () => {
                    if (this.radiationTimer) {
                        this.stopRadiationTracking();
                        this.startRadiationTracking();
                    }
                }
            });
            
            game.settings.register(this.MODULE_ID, 'showTokenControls', {
                name: 'Show Token HUD Controls',
                hint: 'Add radiation controls to token HUD for quick access',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true
            });
            
            game.settings.register(this.MODULE_ID, 'enableRadiationDecay', {
                name: 'Enable Radiation Decay',
                hint: 'Allow radiation levels to decrease over time when not in contaminated areas',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true
            });
            
            game.settings.register(this.MODULE_ID, 'debugMode', {
                name: 'Debug Mode',
                hint: 'Enable detailed console logging for troubleshooting',
                scope: 'world',
                config: true,
                type: Boolean,
                default: false
            });
            
            game.settings.register(this.MODULE_ID, 'defaultZoneType', {
                name: 'Default Zone Type',
                hint: 'Default radiation zone type for new scenes',
                scope: 'world',
                config: true,
                type: String,
                choices: Object.fromEntries(Object.entries(ZONE_TYPES).map(([key, data]) => [key, data.name])),
                default: 'background'
            });
            
            console.log(`${this.MODULE_TITLE} | Settings registered`);
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Settings registration error:`, error);
            throw error;
        }
    }
    
    /**
     * Expose modern API for other modules
     */
    static exposeAPI() {
        try {
            // API exposure only called from ready hook when game.modules is available
            console.log(`${this.MODULE_TITLE} | Exposing API with available classes:`, {
                RadiationTracker: typeof RadiationTracker !== 'undefined',
                RadiationZoneConfig: typeof RadiationZoneConfig !== 'undefined'
            });
            
            // Modern API via game.modules pattern
            const module = game.modules.get(this.MODULE_ID);
            if (module) {
                module.api = {
                    // Core API methods
                    getRadiationData: this.getRadiationData.bind(this),
                    updateRadiationExposure: this.updateRadiationExposure.bind(this),
                    setProtectionLevel: this.setProtectionLevel.bind(this),
                    calculateEffectiveLevel: this.calculateEffectiveLevel.bind(this),
                    applyRadiationEffects: this.applyRadiationEffects.bind(this),
                    
                    // Zone management
                    setSceneRadiationZone: this.setSceneRadiationZone.bind(this),
                    getSceneRadiationZone: this.getSceneRadiationZone.bind(this),
                    
                    // Tracking controls
                    startRadiationTracking: this.startRadiationTracking.bind(this),
                    stopRadiationTracking: this.stopRadiationTracking.bind(this),
                    
                    // UI methods
                    openRadiationTracker: this.openRadiationTracker.bind(this),
                    openZoneConfig: this.openZoneConfig.bind(this),
                    
                    // Utility methods
                    getRadiationLevel: this.getRadiationLevel.bind(this),
                    calculateDecay: this.calculateDecay.bind(this),
                    
                    // Constants
                    RADIATION_LEVELS,
                    PROTECTION_TYPES,
                    ZONE_TYPES,
                    DEFAULT_RADIATION_STRUCTURE,
                    
                    // Classes (only include if available)
                    ...(typeof RadiationTracker !== 'undefined' ? { RadiationTracker } : {}),
                    ...(typeof RadiationZoneConfig !== 'undefined' ? { RadiationZoneConfig } : {}),
                    
                    // Status
                    isReady: () => this.isReady,
                    waitForReady: (timeout = 10000) => this.waitForReady(timeout)
                };
                
                this.api = module.api;
            }
            
            // Legacy compatibility
            if (!window.BBTTCCRadiation) {
                window.BBTTCCRadiation = this.api;
            }
            
            console.log(`${this.MODULE_TITLE} | API exposed successfully`);
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | API exposure error:`, error);
            throw error;
        }
    }
    
    /**
     * Wait for module to be ready with timeout protection
     */
    static async waitForReady(timeout = 10000) {
        try {
            if (this.isReady) return this.api;
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Module ready timeout')), timeout)
            );
            
            await Promise.race([this.readyPromise, timeoutPromise]);
            return this.api;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Wait for ready error:`, error);
            throw error;
        }
    }
    
    /**
     * Get radiation data for a token/actor
     */
    static getRadiationData(token) {
        try {
            if (!token || !token.actor) return null;
            
            const radiationData = token.actor.getFlag(this.MODULE_ID, 'radiation') || 
                foundry.utils.deepClone(DEFAULT_RADIATION_STRUCTURE);
            
            // Enhance with calculated fields
            const effectiveLevel = this.calculateEffectiveLevel(radiationData);
            const radiationLevel = this.getRadiationLevel(effectiveLevel);
            
            return {
                ...radiationData,
                effectiveLevel,
                radiationLevel,
                isContaminated: effectiveLevel > RADIATION_LEVELS.safe.range[1],
                protectionInfo: PROTECTION_TYPES[radiationData.protectionType] || PROTECTION_TYPES.none
            };
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error getting radiation data:`, error);
            return null;
        }
    }
    
    /**
     * Update radiation exposure for a token
     */
    static async updateRadiationExposure(token, exposure, options = {}) {
        try {
            if (!token || !token.actor) {
                throw new Error('Valid token required');
            }
            
            const currentData = this.getRadiationData(token) || foundry.utils.deepClone(DEFAULT_RADIATION_STRUCTURE);
            
            // Calculate new exposure
            const newExposure = Math.max(0, currentData.exposure + exposure);
            const newLevel = Math.min(100, newExposure / currentData.threshold * 100);
            
            // Apply protection
            const protection = currentData.protection || 0;
            const effectiveExposure = Math.max(0, exposure - (exposure * protection / 100));
            
            const updatedData = {
                ...currentData,
                exposure: currentData.exposure + effectiveExposure,
                level: Math.min(100, (currentData.exposure + effectiveExposure) / currentData.threshold * 100),
                lastUpdate: new Date().toISOString()
            };
            
            // Store updated data
            await token.actor.setFlag(this.MODULE_ID, 'radiation', updatedData);
            
            // Apply radiation effects if level changed significantly
            const oldRadiationLevel = this.getRadiationLevel(currentData.level);
            const newRadiationLevel = this.getRadiationLevel(updatedData.level);
            
            if (oldRadiationLevel.name !== newRadiationLevel.name) {
                await this.applyRadiationEffects(token, newRadiationLevel, oldRadiationLevel);
            }
            
            // Notify if enabled
            if (game.settings.get(this.MODULE_ID, 'debugMode') || options.notify) {
                const change = exposure >= 0 ? '+' : '';
                ui.notifications.info(`${token.name} radiation: ${change}${exposure.toFixed(1)} (Level: ${newRadiationLevel.name})`);
            }
            
            // Trigger hooks
            Hooks.callAll(`${this.MODULE_ID}.radiationUpdated`, token, updatedData, currentData);
            
            return updatedData;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error updating radiation exposure:`, error);
            ui.notifications.error(`Failed to update radiation: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Set protection level for a token
     */
    static async setProtectionLevel(token, protectionType, customValue = null) {
        try {
            if (!token || !token.actor) {
                throw new Error('Valid token required');
            }
            
            const currentData = this.getRadiationData(token) || foundry.utils.deepClone(DEFAULT_RADIATION_STRUCTURE);
            const protectionInfo = PROTECTION_TYPES[protectionType];
            
            if (!protectionInfo && customValue === null) {
                throw new Error('Invalid protection type');
            }
            
            const protection = customValue !== null ? customValue : protectionInfo.protection;
            
            const updatedData = {
                ...currentData,
                protection: Math.max(0, Math.min(100, protection)),
                protectionType: protectionType,
                lastUpdate: new Date().toISOString()
            };
            
            await token.actor.setFlag(this.MODULE_ID, 'radiation', updatedData);
            
            ui.notifications.info(`${token.name} protection set to ${protectionInfo?.name || 'Custom'} (${protection}%)`);
            
            // Trigger hooks
            Hooks.callAll(`${this.MODULE_ID}.protectionUpdated`, token, updatedData);
            
            return updatedData;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error setting protection:`, error);
            ui.notifications.error(`Failed to set protection: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Calculate effective radiation level considering protection
     */
    static calculateEffectiveLevel(radiationData) {
        if (!radiationData) return 0;
        
        const baseLevel = radiationData.level || 0;
        const protection = radiationData.protection || 0;
        
        return Math.max(0, baseLevel - (baseLevel * protection / 100));
    }
    
    /**
     * Get radiation level info for a given level value
     */
    static getRadiationLevel(level) {
        for (const [key, data] of Object.entries(RADIATION_LEVELS)) {
            if (level >= data.range[0] && level <= data.range[1]) {
                return { key, ...data };
            }
        }
        return { key: 'lethal', ...RADIATION_LEVELS.lethal };
    }
    
    /**
     * Apply radiation effects to a token
     */
    static async applyRadiationEffects(token, newLevel, oldLevel) {
        try {
            if (!token || !token.actor) return;
            
            // Remove old effects
            if (oldLevel && oldLevel.effects) {
                for (const effectId of oldLevel.effects) {
                    const effect = token.actor.effects.find(e => 
                        e.flags[this.MODULE_ID]?.radiationEffect === effectId
                    );
                    if (effect) {
                        await effect.delete();
                    }
                }
            }
            
            // Apply new effects
            if (newLevel && newLevel.effects && newLevel.effects.length > 0) {
                for (const effectId of newLevel.effects) {
                    const effectData = this.createRadiationEffect(effectId, newLevel);
                    if (effectData) {
                        await token.actor.createEmbeddedDocuments('ActiveEffect', [effectData]);
                    }
                }
            }
            
            // Notify level change
            const levelChange = newLevel.key !== (oldLevel?.key || 'safe');
            if (levelChange) {
                ui.notifications.warn(`${token.name} radiation level: ${newLevel.name}`, {
                    permanent: newLevel.key === 'lethal'
                });
            }
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error applying radiation effects:`, error);
        }
    }
    
    /**
     * Create radiation effect data
     */
    static createRadiationEffect(effectId, radiationLevel) {
        const effectConfigs = {
            radiation_sickness_mild: {
                name: 'Mild Radiation Sickness',
                icon: 'icons/svg/poison.svg',
                changes: [],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            },
            radiation_sickness_moderate: {
                name: 'Moderate Radiation Sickness',
                icon: 'icons/svg/poison.svg',
                changes: [
                    { key: 'system.attributes.hp.max', mode: 2, value: '-5' }
                ],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            },
            radiation_sickness_severe: {
                name: 'Severe Radiation Sickness',
                icon: 'icons/svg/poison.svg',
                changes: [
                    { key: 'system.attributes.hp.max', mode: 2, value: '-10' },
                    { key: 'system.abilities.con.save', mode: 2, value: '-2' }
                ],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            },
            fatigue: {
                name: 'Radiation Fatigue',
                icon: 'icons/svg/downgrade.svg',
                changes: [
                    { key: 'system.attributes.movement.walk', mode: 2, value: '-5' }
                ],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            },
            exhaustion_1: {
                name: 'Exhaustion (Level 1)',
                icon: 'icons/svg/downgrade.svg',
                changes: [
                    { key: 'system.attributes.exhaustion', mode: 4, value: '1' }
                ],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            },
            exhaustion_2: {
                name: 'Exhaustion (Level 2)', 
                icon: 'icons/svg/downgrade.svg',
                changes: [
                    { key: 'system.attributes.exhaustion', mode: 4, value: '2' }
                ],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            },
            exhaustion_3: {
                name: 'Exhaustion (Level 3)',
                icon: 'icons/svg/downgrade.svg',
                changes: [
                    { key: 'system.attributes.exhaustion', mode: 4, value: '3' }
                ],
                flags: { [this.MODULE_ID]: { radiationEffect: effectId } }
            }
        };
        
        return effectConfigs[effectId] || null;
    }
    
    /**
     * Set scene radiation zone
     */
    static async setSceneRadiationZone(scene, zoneType, customIntensity = null) {
        try {
            const sceneToUpdate = scene || canvas.scene;
            if (!sceneToUpdate) {
                throw new Error('No scene available');
            }
            
            const zoneInfo = ZONE_TYPES[zoneType];
            if (!zoneInfo && customIntensity === null) {
                throw new Error('Invalid zone type');
            }
            
            const intensity = customIntensity !== null ? customIntensity : zoneInfo.intensity;
            
            const zoneData = {
                type: zoneType,
                intensity: intensity,
                description: zoneInfo?.description || 'Custom radiation zone',
                setAt: new Date().toISOString(),
                setBy: game.user.id
            };
            
            await sceneToUpdate.setFlag(this.MODULE_ID, 'radiationZone', zoneData);
            
            ui.notifications.info(`Scene radiation set to: ${zoneInfo?.name || 'Custom'} (Intensity: ${intensity})`);
            
            // Trigger hooks
            Hooks.callAll(`${this.MODULE_ID}.sceneRadiationUpdated`, sceneToUpdate, zoneData);
            
            return zoneData;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error setting scene radiation:`, error);
            ui.notifications.error(`Failed to set scene radiation: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get scene radiation zone
     */
    static getSceneRadiationZone(scene) {
        const sceneToCheck = scene || canvas.scene;
        if (!sceneToCheck) return null;
        
        return sceneToCheck.getFlag(this.MODULE_ID, 'radiationZone') || {
            type: game.settings.get(this.MODULE_ID, 'defaultZoneType'),
            intensity: ZONE_TYPES[game.settings.get(this.MODULE_ID, 'defaultZoneType')].intensity,
            description: 'Default background radiation'
        };
    }
    
    /**
     * Start automatic radiation tracking
     */
    static startRadiationTracking() {
        try {
            if (this.radiationTimer) {
                clearInterval(this.radiationTimer);
            }
            
            const interval = game.settings.get(this.MODULE_ID, 'trackingInterval') * 1000; // Convert to ms
            
            this.radiationTimer = setInterval(() => {
                this.processRadiationTick();
            }, interval);
            
            console.log(`${this.MODULE_TITLE} | Automatic tracking started (interval: ${interval/1000}s)`);
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error starting tracking:`, error);
        }
    }
    
    /**
     * Stop automatic radiation tracking
     */
    static stopRadiationTracking() {
        if (this.radiationTimer) {
            clearInterval(this.radiationTimer);
            this.radiationTimer = null;
            console.log(`${this.MODULE_TITLE} | Automatic tracking stopped`);
        }
    }
    
    /**
     * Process radiation tick for all tokens
     */
    static async processRadiationTick() {
        try {
            if (!canvas.tokens || !game.user.isGM) return;
            
            const sceneRadiation = this.getSceneRadiationZone();
            const debugMode = game.settings.get(this.MODULE_ID, 'debugMode');
            
            if (debugMode) {
                console.log(`${this.MODULE_TITLE} | Processing radiation tick - Scene intensity: ${sceneRadiation.intensity}`);
            }
            
            for (const token of canvas.tokens.placeables) {
                if (!token.actor) continue;
                
                try {
                    const currentData = this.getRadiationData(token);
                    if (!currentData) continue;
                    
                    // Calculate exposure based on scene radiation and protection
                    const baseExposure = sceneRadiation.intensity * 0.1; // Scale factor
                    const effectiveExposure = Math.max(0, baseExposure - (baseExposure * currentData.protection / 100));
                    
                    // Apply decay if enabled and in safe zones
                    let finalExposure = effectiveExposure;
                    if (game.settings.get(this.MODULE_ID, 'enableRadiationDecay') && 
                        sceneRadiation.intensity <= ZONE_TYPES.background.intensity) {
                        const decay = this.calculateDecay(currentData);
                        finalExposure = Math.max(0, effectiveExposure - decay);
                    }
                    
                    // Update if there's any change
                    if (Math.abs(finalExposure) > 0.01) {
                        await this.updateRadiationExposure(token, finalExposure, { 
                            notify: false 
                        });
                    }
                    
                } catch (tokenError) {
                    console.error(`${this.MODULE_TITLE} | Error processing token ${token.name}:`, tokenError);
                }
            }
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error in radiation tick:`, error);
        }
    }
    
    /**
     * Calculate radiation decay
     */
    static calculateDecay(radiationData) {
        if (!radiationData.decay?.enabled || !radiationData.lastUpdate) return 0;
        
        const timeDiff = (new Date() - new Date(radiationData.lastUpdate)) / 1000; // seconds
        const intervals = Math.floor(timeDiff / radiationData.decay.interval);
        
        return intervals * radiationData.decay.rate;
    }
    
    /**
     * Hook handlers
     */
    static async onUpdateToken(document, change, options, userId) {
        // Handle token movement for radiation exposure
        if (change.x !== undefined || change.y !== undefined) {
            // Token moved - could trigger radiation checks
            try {
                if (game.settings.get(this.MODULE_ID, 'enableAutomaticTracking')) {
                    // Immediate check for high-radiation areas
                    const sceneRadiation = this.getSceneRadiationZone();
                    if (sceneRadiation.intensity > ZONE_TYPES.industrial.intensity) {
                        await this.processTokenRadiation(document);
                    }
                }
            } catch (error) {
                // Settings not ready, skip radiation tracking
            }
        }
    }
    
    static async onCreateToken(document, options, userId) {
        // Initialize radiation data for new tokens
        if (document.actor && !document.actor.getFlag(this.MODULE_ID, 'radiation')) {
            const defaultData = foundry.utils.deepClone(DEFAULT_RADIATION_STRUCTURE);
            await document.actor.setFlag(this.MODULE_ID, 'radiation', defaultData);
        }
    }
    
    static async onCanvasReady() {
        // Scene changed - update all tokens if needed
        try {
            if (game.settings.get(this.MODULE_ID, 'enableAutomaticTracking')) {
                // Brief delay to let canvas settle
                setTimeout(() => {
                    this.processRadiationTick();
                }, 1000);
            }
        } catch (error) {
            console.warn(`${this.MODULE_TITLE} | Settings not ready in onCanvasReady, skipping radiation tracking`);
        }
    }
    
    static onRenderTokenHUD(app, html, data) {
        /* Add radiation controls to token HUD */
        try {
            const token = app.object;
            if (!token || !token.actor || !game.user.isGM) return;
            
            /* Handle both jQuery and DOM element contexts */
            const element = html instanceof jQuery ? html[0] : html;
            
            const radiationData = this.getRadiationData(token);
            if (!radiationData) return;
            
            const radiationLevel = this.getRadiationLevel(radiationData.effectiveLevel);
            
            const button = document.createElement('div');
            button.className = 'control-icon';
            button.dataset.action = 'radiation';
            button.title = `Radiation: ${radiationLevel.name} (${radiationData.level.toFixed(1)}%)`;
            button.innerHTML = `<i class="fas fa-radiation" style="color: ${radiationLevel.color}"></i>`;
            
            element.querySelector('.right')?.appendChild(button);
            
            element.querySelector('[data-action="radiation"]')?.addEventListener('click', () => {
                this.openRadiationTracker(token);
            });
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error rendering token HUD:`, error);
        }
    }
    
    /**
     * UI methods
     */
    static openRadiationTracker(token) {
        try {
            const tracker = new RadiationTracker(token);
            tracker.render(true);
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error opening radiation tracker:`, error);
            ui.notifications.error('Failed to open radiation tracker');
        }
    }
    
    static openZoneConfig(scene) {
        try {
            const zoneConfig = new RadiationZoneConfig(scene);
            zoneConfig.render(true);
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error opening zone config:`, error);
            ui.notifications.error('Failed to open zone configuration');
        }
    }
    
    /**
     * Process radiation for a specific token
     */
    static async processTokenRadiation(token) {
        try {
            const sceneRadiation = this.getSceneRadiationZone();
            const exposure = sceneRadiation.intensity * 0.05; // Immediate exposure
            
            await this.updateRadiationExposure(token, exposure, { notify: true });
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error processing token radiation:`, error);
        }
    }
}

// Register hooks for proper FoundryVTT lifecycle
Hooks.once('init', async () => {
    console.log('BBTTCC Radiation v4.8.1-ENHANCED | Starting initialization with FoundryVTT v13+ and D&D5e v5.4+ support...');
    
    // D&D5e v5.4 compatibility note
    if (game.system.id === 'dnd5e') {
        const version = game.system.version;
        if (foundry.utils.isNewerVersion(version, "5.4.0")) {
            console.log(`bbttcc-radiation | Running on D&D5e v${version} - fully compatible`);
        } else if (foundry.utils.isNewerVersion(version, "5.0.0")) {
            console.warn(`bbttcc-radiation | Running on D&D5e v${version} - compatible but may show deprecation warnings. v5.4+ recommended.`);
        }
    }
    
    // Register settings first per FoundryVTT best practices
    BBTTCCRadiationModule.registerSettings();
    
    await BBTTCCRadiationModule.initialize();
});

console.log('BBTTCC Radiation v4.8.1-ENHANCED | Module script loaded');

export { 
    BBTTCCRadiationModule, 
    RADIATION_LEVELS, 
    PROTECTION_TYPES, 
    ZONE_TYPES, 
    DEFAULT_RADIATION_STRUCTURE 
};