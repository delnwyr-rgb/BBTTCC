/**
 * BBTTCC Raid v4.8.0 - MODERN
 * Advanced raid planning and execution system for FoundryVTT v13+
 * Uses modern async/await patterns and flags-based storage
 */

import { RaidPlanner } from './raid-planner.js';

// Default raid structure
const DEFAULT_RAID_STRUCTURE = {
    status: 'planning',
    type: 'assault',
    target: '',
    objectives: [],
    participants: [],
    resources: {
        violence: 0,
        nonLethal: 0,
        intrigue: 0,
        economy: 0
    },
    timeline: {
        preparation: 24,
        execution: 4,
        extraction: 2
    },
    difficulty: 'medium',
    rewards: [],
    risks: [],
    outcomes: []
};

const RAID_TYPES = {
    assault: 'Direct Military Attack',
    infiltration: 'Stealth Operation',
    sabotage: 'Disruption Mission',
    heist: 'Resource Acquisition',
    rescue: 'Extraction Mission',
    reconnaissance: 'Information Gathering'
};

const RAID_DIFFICULTIES = {
    trivial: { name: 'Trivial', modifier: -2, description: 'Minimal risk, guaranteed success' },
    easy: { name: 'Easy', modifier: -1, description: 'Low risk, high success chance' },
    medium: { name: 'Medium', modifier: 0, description: 'Moderate risk and reward' },
    hard: { name: 'Hard', modifier: 1, description: 'High risk, high reward' },
    extreme: { name: 'Extreme', modifier: 2, description: 'Maximum risk, maximum reward' }
};

class BBTTCCRaidModule {
    static MODULE_ID = 'bbttcc-raid';
    static MODULE_TITLE = 'BBTTCC Raid v4.8.0 - MODERN';
    
    static api = null;
    static isReady = false;
    static readyPromise = null;
    
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
                    
                    // Set timeout protection
                    setTimeout(() => {
                        if (!this.isReady) {
                            console.warn(`${this.MODULE_TITLE} | Initialization timeout, proceeding anyway`);
                            resolve(this);
                        }
                    }, 5000);
                    
                } catch (error) {
                    console.error(`${this.MODULE_TITLE} | Initialization error:`, error);
                    reject(error);
                }
            });
            
            // Expose modern API
            this.exposeAPI();
            
            console.log(`${this.MODULE_TITLE} | Initialization complete`);
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Fatal initialization error:`, error);
            throw error;
        }
    }
    
    /**
     * Handle ready hook with proper async patterns
     */
    static async onReady() {
        try {
            console.log(`${this.MODULE_TITLE} | Ready hook triggered`);
            
            // Validate dependencies
            if (!game.system.id === 'dnd5e') {
                throw new Error('BBTTCC Raid requires D&D 5e system');
            }
            
            // Initialize UI components
            await this.initializeUI();
            
            // Register settings
            this.registerSettings();
            
            this.isReady = true;
            console.log(`${this.MODULE_TITLE} | Ready and operational`);
            
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
            // Register applications
            console.log(`${this.MODULE_TITLE} | Registering UI applications`);
            
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
            game.settings.register(this.MODULE_ID, 'enableMacroIntegration', {
                name: 'Enable Macro Integration',
                hint: 'Allow macro-based raid creation and management',
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
            
            game.settings.register(this.MODULE_ID, 'autoCalculateDifficulty', {
                name: 'Auto-Calculate Difficulty',
                hint: 'Automatically calculate raid difficulty based on objectives and resources',
                scope: 'world',
                config: true,
                type: Boolean,
                default: true
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
            // Modern API via game.modules pattern
            const module = game.modules.get(this.MODULE_ID);
            if (module) {
                module.api = {
                    // Core API methods
                    createRaid: this.createRaid.bind(this),
                    updateRaid: this.updateRaid.bind(this),
                    executeRaid: this.executeRaid.bind(this),
                    deleteRaid: this.deleteRaid.bind(this),
                    getRaidData: this.getRaidData.bind(this),
                    
                    // Utility methods
                    calculateDifficulty: this.calculateDifficulty.bind(this),
                    validateRaid: this.validateRaid.bind(this),
                    getRaidOutcome: this.getRaidOutcome.bind(this),
                    
                    // Constants
                    RAID_TYPES,
                    RAID_DIFFICULTIES,
                    DEFAULT_RAID_STRUCTURE,
                    
                    // Classes
                    RaidPlanner,
                    
                    // Status
                    isReady: () => this.isReady,
                    waitForReady: (timeout = 10000) => this.waitForReady(timeout)
                };
                
                this.api = module.api;
            }
            
            // Legacy compatibility
            if (!window.BBTTCCRaid) {
                window.BBTTCCRaid = this.api;
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
     * Create a new raid with modern async patterns
     */
    static async createRaid(raidData, options = {}) {
        try {
            console.log(`${this.MODULE_TITLE} | Creating raid:`, raidData);
            
            // Validate input
            if (!raidData || typeof raidData !== 'object') {
                throw new Error('Invalid raid data provided');
            }
            
            if (!raidData.name) {
                throw new Error('Raid name is required');
            }
            
            // Create unique ID
            const raidId = foundry.utils.randomID();
            
            // Merge with defaults
            const fullRaidData = foundry.utils.mergeObject(
                foundry.utils.deepClone(DEFAULT_RAID_STRUCTURE),
                {
                    id: raidId,
                    name: raidData.name,
                    createdAt: new Date().toISOString(),
                    createdBy: game.user.id,
                    version: '4.8.0',
                    ...raidData
                }
            );
            
            // Auto-calculate difficulty if enabled
            if (game.settings.get(this.MODULE_ID, 'autoCalculateDifficulty')) {
                fullRaidData.calculatedDifficulty = this.calculateDifficulty(fullRaidData);
            }
            
            // Store in world flags using modern pattern
            const worldRaids = game.world.getFlag(this.MODULE_ID, 'raids') || {};
            worldRaids[raidId] = fullRaidData;
            
            await game.world.setFlag(this.MODULE_ID, 'raids', worldRaids);
            
            // Add to participating factions if specified
            if (fullRaidData.participants && fullRaidData.participants.length > 0) {
                await this.updateParticipantFactions(fullRaidData);
            }
            
            ui.notifications.info(`Raid "${fullRaidData.name}" created successfully`);
            
            // Trigger hooks for other modules
            Hooks.callAll(`${this.MODULE_ID}.raidCreated`, fullRaidData);
            
            return fullRaidData;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error creating raid:`, error);
            ui.notifications.error(`Failed to create raid: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Update an existing raid
     */
    static async updateRaid(raidId, updateData, options = {}) {
        try {
            console.log(`${this.MODULE_TITLE} | Updating raid:`, raidId, updateData);
            
            if (!raidId || !updateData) {
                throw new Error('Raid ID and update data are required');
            }
            
            const worldRaids = game.world.getFlag(this.MODULE_ID, 'raids') || {};
            const existingRaid = worldRaids[raidId];
            
            if (!existingRaid) {
                throw new Error(`Raid with ID ${raidId} not found`);
            }
            
            // Merge updates
            const updatedRaid = foundry.utils.mergeObject(existingRaid, {
                ...updateData,
                updatedAt: new Date().toISOString(),
                updatedBy: game.user.id
            });
            
            // Auto-calculate difficulty if enabled
            if (game.settings.get(this.MODULE_ID, 'autoCalculateDifficulty')) {
                updatedRaid.calculatedDifficulty = this.calculateDifficulty(updatedRaid);
            }
            
            worldRaids[raidId] = updatedRaid;
            await game.world.setFlag(this.MODULE_ID, 'raids', worldRaids);
            
            // Update participant factions
            if (updatedRaid.participants) {
                await this.updateParticipantFactions(updatedRaid);
            }
            
            ui.notifications.info(`Raid "${updatedRaid.name}" updated successfully`);
            
            // Trigger hooks
            Hooks.callAll(`${this.MODULE_ID}.raidUpdated`, updatedRaid);
            
            return updatedRaid;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error updating raid:`, error);
            ui.notifications.error(`Failed to update raid: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Execute a raid and determine outcomes
     */
    static async executeRaid(raidId, options = {}) {
        try {
            console.log(`${this.MODULE_TITLE} | Executing raid:`, raidId);
            
            const worldRaids = game.world.getFlag(this.MODULE_ID, 'raids') || {};
            const raid = worldRaids[raidId];
            
            if (!raid) {
                throw new Error(`Raid with ID ${raidId} not found`);
            }
            
            if (raid.status !== 'planning') {
                throw new Error(`Raid "${raid.name}" is not in planning status`);
            }
            
            // Validate raid is ready for execution
            const validation = this.validateRaid(raid);
            if (!validation.valid) {
                throw new Error(`Raid validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Determine outcome
            const outcome = await this.getRaidOutcome(raid, options);
            
            // Update raid with execution results
            const executedRaid = await this.updateRaid(raidId, {
                status: 'completed',
                executedAt: new Date().toISOString(),
                executedBy: game.user.id,
                outcome: outcome,
                outcomes: [...(raid.outcomes || []), outcome]
            });
            
            // Apply outcomes to world/factions
            if (outcome.success && outcome.rewards) {
                await this.applyRaidRewards(executedRaid, outcome.rewards);
            }
            
            ui.notifications.info(`Raid "${raid.name}" executed - ${outcome.success ? 'Success' : 'Failure'}`);
            
            // Trigger hooks
            Hooks.callAll(`${this.MODULE_ID}.raidExecuted`, executedRaid, outcome);
            
            return { raid: executedRaid, outcome };
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error executing raid:`, error);
            ui.notifications.error(`Failed to execute raid: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Delete a raid
     */
    static async deleteRaid(raidId, options = {}) {
        try {
            console.log(`${this.MODULE_TITLE} | Deleting raid:`, raidId);
            
            const worldRaids = game.world.getFlag(this.MODULE_ID, 'raids') || {};
            const raid = worldRaids[raidId];
            
            if (!raid) {
                throw new Error(`Raid with ID ${raidId} not found`);
            }
            
            // Remove from world flags
            delete worldRaids[raidId];
            await game.world.setFlag(this.MODULE_ID, 'raids', worldRaids);
            
            // Remove from participant factions
            if (raid.participants) {
                await this.removeFromParticipantFactions(raid);
            }
            
            ui.notifications.info(`Raid "${raid.name}" deleted successfully`);
            
            // Trigger hooks
            Hooks.callAll(`${this.MODULE_ID}.raidDeleted`, raid);
            
            return true;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error deleting raid:`, error);
            ui.notifications.error(`Failed to delete raid: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get raid data with enhanced information
     */
    static getRaidData(raidId) {
        try {
            const worldRaids = game.world.getFlag(this.MODULE_ID, 'raids') || {};
            const raid = worldRaids[raidId];
            
            if (!raid) return null;
            
            // Enhance with calculated fields
            return {
                ...raid,
                difficultyInfo: RAID_DIFFICULTIES[raid.difficulty] || RAID_DIFFICULTIES.medium,
                typeInfo: RAID_TYPES[raid.type] || 'Unknown',
                totalResources: Object.values(raid.resources || {}).reduce((sum, val) => sum + val, 0),
                isValidForExecution: this.validateRaid(raid).valid
            };
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error getting raid data:`, error);
            return null;
        }
    }
    
    /**
     * Calculate raid difficulty based on objectives and resources
     */
    static calculateDifficulty(raid) {
        try {
            let difficultyScore = 0;
            
            // Base difficulty from type
            const typeModifiers = {
                reconnaissance: -1,
                heist: 0,
                infiltration: 1,
                sabotage: 1,
                rescue: 2,
                assault: 3
            };
            
            difficultyScore += typeModifiers[raid.type] || 0;
            
            // Objectives complexity
            difficultyScore += (raid.objectives?.length || 0) * 0.5;
            
            // Resource adequacy
            const totalResources = Object.values(raid.resources || {}).reduce((sum, val) => sum + val, 0);
            if (totalResources < 10) difficultyScore += 2;
            else if (totalResources < 20) difficultyScore += 1;
            else if (totalResources > 50) difficultyScore -= 1;
            
            // Participant count
            const participantCount = raid.participants?.length || 0;
            if (participantCount === 0) difficultyScore += 3;
            else if (participantCount === 1) difficultyScore += 1;
            else if (participantCount > 3) difficultyScore -= 1;
            
            // Map to difficulty levels
            if (difficultyScore <= -1) return 'trivial';
            else if (difficultyScore <= 1) return 'easy';
            else if (difficultyScore <= 3) return 'medium';
            else if (difficultyScore <= 5) return 'hard';
            else return 'extreme';
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error calculating difficulty:`, error);
            return 'medium';
        }
    }
    
    /**
     * Validate raid for execution
     */
    static validateRaid(raid) {
        const errors = [];
        
        if (!raid.name) errors.push('Raid name is required');
        if (!raid.type) errors.push('Raid type is required');
        if (!raid.objectives || raid.objectives.length === 0) errors.push('At least one objective is required');
        if (!raid.participants || raid.participants.length === 0) errors.push('At least one participant is required');
        
        const totalResources = Object.values(raid.resources || {}).reduce((sum, val) => sum + val, 0);
        if (totalResources === 0) errors.push('Some resources are required for the raid');
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Determine raid outcome based on difficulty and resources
     */
    static async getRaidOutcome(raid, options = {}) {
        try {
            const difficulty = RAID_DIFFICULTIES[raid.difficulty] || RAID_DIFFICULTIES.medium;
            const totalResources = Object.values(raid.resources || {}).reduce((sum, val) => sum + val, 0);
            
            // Calculate success chance
            let baseChance = 60; // 60% base success rate
            baseChance += (totalResources / 5); // +1% per 5 resource points
            baseChance -= (difficulty.modifier * 15); // Difficulty modifier
            baseChance += (raid.participants?.length || 0) * 5; // +5% per participant
            
            // Clamp between 5% and 95%
            const successChance = Math.max(5, Math.min(95, baseChance));
            
            // Roll for success
            const roll = Math.random() * 100;
            const success = roll <= successChance;
            
            // Generate outcome details
            const outcome = {
                success,
                roll,
                successChance,
                severity: success ? this.getSuccessSeverity(roll, successChance) : this.getFailureSeverity(roll, successChance),
                timestamp: new Date().toISOString()
            };
            
            // Add consequences based on outcome
            if (success) {
                outcome.rewards = this.generateRewards(raid, outcome.severity);
                outcome.description = this.generateSuccessDescription(raid, outcome.severity);
            } else {
                outcome.consequences = this.generateConsequences(raid, outcome.severity);
                outcome.description = this.generateFailureDescription(raid, outcome.severity);
            }
            
            return outcome;
            
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error determining raid outcome:`, error);
            throw error;
        }
    }
    
    /**
     * Helper methods for outcome generation
     */
    static getSuccessSeverity(roll, successChance) {
        const margin = successChance - roll;
        if (margin > 50) return 'critical';
        else if (margin > 25) return 'major';
        else return 'minor';
    }
    
    static getFailureSeverity(roll, successChance) {
        const margin = roll - successChance;
        if (margin > 50) return 'catastrophic';
        else if (margin > 25) return 'major';
        else return 'minor';
    }
    
    static generateRewards(raid, severity) {
        const rewards = [];
        const multiplier = severity === 'critical' ? 2 : severity === 'major' ? 1.5 : 1;
        
        // Base rewards based on raid type
        switch (raid.type) {
            case 'heist':
                rewards.push({ type: 'economy', amount: Math.floor(10 * multiplier) });
                break;
            case 'assault':
                rewards.push({ type: 'violence', amount: Math.floor(5 * multiplier) });
                rewards.push({ type: 'territory', description: 'Potential territory gain' });
                break;
            case 'infiltration':
                rewards.push({ type: 'intrigue', amount: Math.floor(8 * multiplier) });
                rewards.push({ type: 'information', description: 'Valuable intelligence gained' });
                break;
            case 'reconnaissance':
                rewards.push({ type: 'information', description: 'Detailed target information' });
                break;
        }
        
        return rewards;
    }
    
    static generateConsequences(raid, severity) {
        const consequences = [];
        const multiplier = severity === 'catastrophic' ? 2 : severity === 'major' ? 1.5 : 1;
        
        consequences.push({ 
            type: 'reputation', 
            amount: Math.floor(-5 * multiplier),
            description: 'Reputation damage from failed raid' 
        });
        
        if (severity === 'catastrophic') {
            consequences.push({ 
                type: 'casualties', 
                description: 'Significant casualties among participants' 
            });
        }
        
        return consequences;
    }
    
    static generateSuccessDescription(raid, severity) {
        const descriptions = {
            critical: `The raid on ${raid.target || 'the target'} was executed flawlessly, exceeding all expectations.`,
            major: `The raid on ${raid.target || 'the target'} was highly successful, achieving primary objectives.`,
            minor: `The raid on ${raid.target || 'the target'} succeeded, though not without some difficulties.`
        };
        
        return descriptions[severity] || descriptions.minor;
    }
    
    static generateFailureDescription(raid, severity) {
        const descriptions = {
            catastrophic: `The raid on ${raid.target || 'the target'} was a complete disaster, resulting in significant losses.`,
            major: `The raid on ${raid.target || 'the target'} failed badly, with serious consequences.`,
            minor: `The raid on ${raid.target || 'the target'} failed, but losses were minimal.`
        };
        
        return descriptions[severity] || descriptions.minor;
    }
    
    /**
     * Update participant factions with raid information
     */
    static async updateParticipantFactions(raid) {
        try {
            for (const participantId of raid.participants) {
                const faction = game.actors.get(participantId);
                if (faction && faction.flags['bbttcc-factions']?.isFaction) {
                    const raids = faction.getFlag('bbttcc-factions', 'raids') || [];
                    
                    // Update or add raid reference
                    const existingIndex = raids.findIndex(r => r.id === raid.id);
                    const raidRef = {
                        id: raid.id,
                        name: raid.name,
                        status: raid.status,
                        type: raid.type
                    };
                    
                    if (existingIndex !== -1) {
                        raids[existingIndex] = raidRef;
                    } else {
                        raids.push(raidRef);
                    }
                    
                    await faction.setFlag('bbttcc-factions', 'raids', raids);
                }
            }
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error updating participant factions:`, error);
        }
    }
    
    /**
     * Remove raid from participant factions
     */
    static async removeFromParticipantFactions(raid) {
        try {
            for (const participantId of raid.participants) {
                const faction = game.actors.get(participantId);
                if (faction && faction.flags['bbttcc-factions']?.isFaction) {
                    const raids = faction.getFlag('bbttcc-factions', 'raids') || [];
                    const filteredRaids = raids.filter(r => r.id !== raid.id);
                    
                    await faction.setFlag('bbttcc-factions', 'raids', filteredRaids);
                }
            }
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error removing from participant factions:`, error);
        }
    }
    
    /**
     * Apply rewards from successful raids
     */
    static async applyRaidRewards(raid, rewards) {
        try {
            // Apply rewards to participating factions
            for (const participantId of raid.participants) {
                const faction = game.actors.get(participantId);
                if (faction && faction.flags['bbttcc-factions']?.isFaction) {
                    
                    for (const reward of rewards) {
                        if (reward.type && ['violence', 'nonLethal', 'intrigue', 'economy', 'softPower', 'diplomacy'].includes(reward.type)) {
                            // Update faction OPs
                            const currentOPs = faction.getFlag('bbttcc-factions', 'ops') || {};
                            currentOPs[reward.type] = (currentOPs[reward.type] || 0) + (reward.amount || 0);
                            
                            await faction.setFlag('bbttcc-factions', 'ops', currentOPs);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`${this.MODULE_TITLE} | Error applying raid rewards:`, error);
        }
    }
}

// Initialize the module when script loads
BBTTCCRaidModule.initialize();

console.log('BBTTCC Raid v4.8.0 - MODERN | Module script loaded');

export { BBTTCCRaidModule, RAID_TYPES, RAID_DIFFICULTIES, DEFAULT_RAID_STRUCTURE };