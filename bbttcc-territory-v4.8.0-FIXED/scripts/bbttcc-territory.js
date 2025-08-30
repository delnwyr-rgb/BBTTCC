/**
 * BBTTCC Territory Control Module v4.8.0 - FIXED
 * Scene-based territory management with modern FoundryVTT v13+ compatibility
 * Uses game.modules.get().api pattern instead of window objects
 */

import { TerritoryManager } from './territory-manager.js';

// Territory types and their resource generation
const TERRITORY_TYPES = {
    settlement: { food: 2, materials: 1, trade: 3 },
    fortress: { materials: 3, military: 4, trade: 1 },
    mine: { materials: 5, trade: 2, food: 0 },
    farm: { food: 5, materials: 1, trade: 2 },
    port: { trade: 4, materials: 2, food: 2 }
};

// Territory size multipliers
const SIZE_MULTIPLIERS = {
    small: 0.5,
    medium: 1.0,
    large: 2.0,
    capital: 4.0
};

/**
 * Initialize the BBTTCC Territory module
 */
Hooks.once('init', () => {
    console.log('BBTTCC Territory | Initializing v4.8.0...');
    
    // Register settings
    game.settings.register('bbttcc-territory', 'autoCalculateResources', {
        name: 'Auto-Calculate Resources',
        hint: 'Automatically calculate faction resources based on controlled territories',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    console.log('BBTTCC Territory | Settings registered');
});

/**
 * Setup hook for final initialization
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Territory | Ready hook fired');
    
    // Expose modern API via game.modules pattern
    const module = game.modules.get('bbttcc-territory');
    if (module) {
        module.api = {
            claimTerritory: claimTerritory,
            contestTerritory: contestTerritory,
            openTerritoryManager: openTerritoryManager,
            calculateTerritoryResources: calculateTerritoryResources,
            TerritoryManager: TerritoryManager,
            TERRITORY_TYPES: TERRITORY_TYPES,
            SIZE_MULTIPLIERS: SIZE_MULTIPLIERS,
            version: '4.8.0'
        };
        console.log('BBTTCC Territory | API exposed via game.modules.get("bbttcc-territory").api');
    }
    
    // Also maintain legacy compatibility temporarily
    window.BBTTCCTerritory = {
        claimTerritory: claimTerritory,
        openTerritoryManager: openTerritoryManager,
        version: '4.8.0'
    };
    
    // Initialize global territory system
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.territory = {
        claimTerritory: claimTerritory,
        contestTerritory: contestTerritory,
        openTerritoryManager: openTerritoryManager,
        calculateTerritoryResources: calculateTerritoryResources
    };
    
    console.log('BBTTCC Territory | Module ready v4.8.0');
});

/**
 * Enhanced territory claiming with retry mechanism and race condition protection
 */
async function claimTerritory(territoryData, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    const startTime = performance.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`BBTTCC Territory | Claiming territory (attempt ${attempt}):`, territoryData);
            
            const {
                name,
                factionId,
                sceneId,
                type = 'settlement',
                size = 'medium',
                description = '',
                coordinates = { x: 0, y: 0 }
            } = territoryData;
            
            // Enhanced validation
            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                throw new Error('Territory name is required and must be a non-empty string');
            }
            
            if (!factionId || !sceneId) {
                throw new Error('Missing required territory data: factionId or sceneId');
            }
            
            // Validate territory type and size
            if (!TERRITORY_TYPES[type]) {
                throw new Error(`Invalid territory type: ${type}. Valid types: ${Object.keys(TERRITORY_TYPES).join(', ')}`);
            }
            
            if (!SIZE_MULTIPLIERS[size]) {
                throw new Error(`Invalid territory size: ${size}. Valid sizes: ${Object.keys(SIZE_MULTIPLIERS).join(', ')}`);
            }
            
            const scene = game.scenes.get(sceneId);
            const faction = game.actors.get(factionId);
            
            if (!scene) {
                throw new Error(`Scene not found: ${sceneId}`);
            }
            
            if (!faction) {
                throw new Error(`Faction not found: ${factionId}`);
            }
            
            if (!faction.flags?.['bbttcc-factions']?.isFaction) {
                throw new Error(`Actor ${factionId} is not a valid BBTTCC faction`);
            }
            
            // Atomic territory claim check - get fresh data each attempt
            const sceneTerritories = scene.flags?.['bbttcc-territory']?.territories || [];
            
            // Check for name conflicts
            const existingTerritory = sceneTerritories.find(t => t.name === name);
            if (existingTerritory) {
                if (existingTerritory.factionId === factionId) {
                    throw new Error(`Territory "${name}" is already claimed by this faction`);
                } else {
                    throw new Error(`Territory "${name}" is already claimed by ${existingTerritory.factionName}`);
                }
            }
            
            // Create territory data with comprehensive information
            const territory = {
                id: foundry.utils.randomID(),
                name: name.trim(),
                factionId: factionId,
                factionName: faction.name,
                type: type,
                size: size,
                description: description.trim(),
                coordinates: coordinates,
                claimedAt: new Date().toISOString(),
                claimedBy: game.user.id,
                version: '4.8.0',
                resources: calculateTerritoryResources(type, size)
            };
            
            // Atomic update operations with verification
            const updatedSceneTerritories = [...sceneTerritories, territory];
            
            // Update scene with new territory
            await scene.update({
                'flags.bbttcc-territory.territories': updatedSceneTerritories
            });
            
            // Verify the scene update was successful
            const verifySceneTerritories = scene.flags?.['bbttcc-territory']?.territories || [];
            const verifyTerritory = verifySceneTerritories.find(t => t.id === territory.id);
            if (!verifyTerritory) {
                throw new Error('Failed to verify territory was added to scene');
            }
            
            // Add territory reference to faction
            const factionTerritories = faction.flags?.['bbttcc-factions']?.territories || [];
            const factionTerritoryRef = {
                id: territory.id,
                name: name.trim(),
                sceneId: sceneId,
                sceneName: scene.name,
                type: type,
                size: size,
                resources: territory.resources,
                claimedAt: territory.claimedAt
            };
            
            await faction.update({
                'flags.bbttcc-factions.territories': [...factionTerritories, factionTerritoryRef]
            });
            
            // Add war log entry to faction
            const warLog = faction.flags?.['bbttcc-factions']?.warLog || [];
            const warLogEntry = {
                id: foundry.utils.randomID(),
                title: `Territory Claimed: ${name}`,
                description: `Claimed ${size} ${type} territory in ${scene.name}`,
                timestamp: territory.claimedAt,
                turn: game.combat?.round || 0
            };
            
            await faction.update({
                'flags.bbttcc-factions.warLog': [...warLog, warLogEntry]
            });
            
            const endTime = performance.now();
            console.log(`BBTTCC Territory | Territory claimed successfully (${(endTime - startTime).toFixed(2)}ms):`, {
                territory: territory,
                attempt: attempt,
                claimTime: endTime - startTime
            });
            
            ui.notifications.info(`Territory "${name}" claimed by ${faction.name}`);
            
            // Notify other modules
            Hooks.callAll('bbttcc-territory.claimed', {
                territory: territory,
                faction: faction,
                scene: scene,
                timestamp: Date.now()
            });
            
            return territory;
            
        } catch (error) {
            if (attempt === maxRetries) {
                const systemInfo = {
                    foundryVersion: game.version,
                    moduleVersion: game.modules.get('bbttcc-territory')?.version || 'unknown',
                    userId: game.user.id,
                    timestamp: new Date().toISOString(),
                    totalAttempts: maxRetries,
                    totalTime: performance.now() - startTime
                };
                
                console.error(`BBTTCC Territory | Failed to claim territory after ${maxRetries} attempts:`, {
                    error: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    },
                    territoryData: territoryData,
                    systemInfo: systemInfo
                });
                
                ui.notifications.error(`Failed to claim territory: ${error.message}. Check console for details.`);
                throw error;
            }
            
            console.warn(`BBTTCC Territory | Claim attempt ${attempt} failed, retrying in ${retryDelay * attempt}ms:`, error.message);
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
    }
}

/**
 * Contest a territory between factions
 */
async function contestTerritory(territoryId, challengerFactionId, sceneId) {
    try {
        console.log('BBTTCC Territory | Contesting territory:', { territoryId, challengerFactionId, sceneId });
        
        const scene = game.scenes.get(sceneId);
        const challenger = game.actors.get(challengerFactionId);
        
        if (!scene || !challenger) {
            throw new Error('Scene or challenger faction not found');
        }
        
        const territories = scene.flags['bbttcc-territory']?.territories || [];
        const territory = territories.find(t => t.id === territoryId);
        
        if (!territory) {
            throw new Error('Territory not found');
        }
        
        const defender = game.actors.get(territory.factionId);
        if (!defender) {
            throw new Error('Defending faction not found');
        }
        
        // Calculate faction strengths
        const challengerStrength = calculateFactionStrength(challenger);
        const defenderStrength = calculateFactionStrength(defender);
        
        // Roll for contest
        const challengerRoll = new Roll(`1d20 + ${challengerStrength}`);
        const defenderRoll = new Roll(`1d20 + ${defenderStrength}`);
        
        const challengerResult = await challengerRoll.evaluate();
        const defenderResult = await defenderRoll.evaluate();
        
        const success = challengerResult.total > defenderResult.total;
        
        // Create chat message for contest
        const chatData = {
            user: game.user.id,
            content: `
                <div class="bbttcc-territory-contest">
                    <h4>Territory Contest: ${territory.name}</h4>
                    <div class="contest-results">
                        <div><strong>${challenger.name}</strong>: ${challengerResult.total} (${challengerResult.formula})</div>
                        <div><strong>${defender.name}</strong>: ${defenderResult.total} (${defenderResult.formula})</div>
                        <div class="contest-outcome">
                            ${success ? 
                                `<strong>${challenger.name} successfully contests the territory!</strong>` :
                                `<strong>${defender.name} successfully defends the territory!</strong>`
                            }
                        </div>
                    </div>
                </div>
            `
        };
        
        ChatMessage.create(chatData);
        
        if (success) {
            // Transfer territory to challenger
            await transferTerritory(territory, challenger, defender, scene);
        }
        
        return { success, challengerRoll: challengerResult, defenderRoll: defenderResult };
        
    } catch (error) {
        console.error('BBTTCC Territory | Error contesting territory:', error);
        ui.notifications.error(`Failed to contest territory: ${error.message}`);
        throw error;
    }
}

/**
 * Transfer territory between factions
 */
async function transferTerritory(territory, newFaction, oldFaction, scene) {
    // Update scene territories
    const territories = scene.flags['bbttcc-territory']?.territories || [];
    const territoryIndex = territories.findIndex(t => t.id === territory.id);
    
    if (territoryIndex !== -1) {
        territories[territoryIndex].factionId = newFaction.id;
        territories[territoryIndex].factionName = newFaction.name;
        territories[territoryIndex].claimedAt = new Date().toISOString();
        
        await scene.update({
            'flags.bbttcc-territory.territories': territories
        });
    }
    
    // Remove from old faction
    const oldTerritories = (oldFaction.flags['bbttcc-factions']?.territories || [])
        .filter(t => t.id !== territory.id);
    
    await oldFaction.update({
        'flags.bbttcc-factions.territories': oldTerritories
    });
    
    // Add to new faction
    const newTerritories = newFaction.flags['bbttcc-factions']?.territories || [];
    newTerritories.push({
        id: territory.id,
        name: territory.name,
        sceneId: scene.id,
        sceneName: scene.name,
        type: territory.type,
        size: territory.size,
        resources: territory.resources
    });
    
    await newFaction.update({
        'flags.bbttcc-factions.territories': newTerritories
    });
    
    // Add war log entries
    const timestamp = new Date().toISOString();
    const turn = game.combat?.round || 0;
    
    // Old faction loses territory
    if (oldFaction.flags['bbttcc-factions']) {
        const oldWarLog = oldFaction.flags['bbttcc-factions'].warLog || [];
        oldWarLog.push({
            id: foundry.utils.randomID(),
            title: `Territory Lost: ${territory.name}`,
            description: `Lost control of ${territory.name} to ${newFaction.name}`,
            timestamp: timestamp,
            turn: turn
        });
        
        await oldFaction.update({
            'flags.bbttcc-factions.warLog': oldWarLog
        });
    }
    
    // New faction gains territory
    if (newFaction.flags['bbttcc-factions']) {
        const newWarLog = newFaction.flags['bbttcc-factions'].warLog || [];
        newWarLog.push({
            id: foundry.utils.randomID(),
            title: `Territory Captured: ${territory.name}`,
            description: `Captured ${territory.name} from ${oldFaction.name}`,
            timestamp: timestamp,
            turn: turn
        });
        
        await newFaction.update({
            'flags.bbttcc-factions.warLog': newWarLog
        });
    }
    
    ui.notifications.info(`${territory.name} transferred from ${oldFaction.name} to ${newFaction.name}`);
}

/**
 * Calculate faction strength for territory contests
 */
function calculateFactionStrength(faction) {
    const ops = faction.system?.ops || {};
    const territories = faction.flags['bbttcc-factions']?.territories || [];
    const bases = faction.flags['bbttcc-factions']?.bases || [];
    
    // Base strength from OPs (focus on violence, non-lethal, and economy)
    const opStrength = (ops.violence?.value || 0) + (ops.nonlethal?.value || 0) + (ops.economy?.value || 0);
    
    // Territory bonuses
    const territoryBonus = territories.length * 2;
    
    // Base bonuses  
    const baseBonus = bases.length * 3;
    
    return opStrength + territoryBonus + baseBonus;
}

/**
 * Calculate resources generated by a territory
 */
function calculateTerritoryResources(type, size) {
    const baseResources = TERRITORY_TYPES[type] || TERRITORY_TYPES.settlement;
    const multiplier = SIZE_MULTIPLIERS[size] || 1.0;
    
    const resources = {};
    for (const [resource, value] of Object.entries(baseResources)) {
        resources[resource] = Math.round(value * multiplier);
    }
    
    return resources;
}

/**
 * Open territory manager for a scene
 */
async function openTerritoryManager(scene) {
    try {
        console.log('BBTTCC Territory | Opening territory manager for scene:', scene.name);
        
        const manager = new TerritoryManager(scene);
        manager.render(true);
        
    } catch (error) {
        console.error('BBTTCC Territory | Error opening territory manager:', error);
        ui.notifications.error(`Failed to open territory manager: ${error.message}`);
    }
}

/**
 * Scene integration hooks for cleanup and validation
 */
Hooks.on('deleteScene', async (scene) => {
    try {
        const territories = scene.flags?.['bbttcc-territory']?.territories || [];
        
        if (territories.length === 0) {
            console.log(`BBTTCC Territory | No territories to clean up for scene ${scene.id}`);
            return;
        }
        
        console.log(`BBTTCC Territory | Cleaning up ${territories.length} territories for deleted scene ${scene.id}`);
        
        // Remove territory references from all factions
        for (const territory of territories) {
            try {
                const faction = game.actors.get(territory.factionId);
                if (faction?.flags?.['bbttcc-factions']?.territories) {
                    const updatedTerritories = faction.flags['bbttcc-factions'].territories.filter(
                        t => t.sceneId !== scene.id
                    );
                    
                    await faction.update({
                        'flags.bbttcc-factions.territories': updatedTerritories
                    });
                    
                    // Add war log entry
                    const warLog = faction.flags['bbttcc-factions'].warLog || [];
                    warLog.push({
                        id: foundry.utils.randomID(),
                        title: `Territory Lost: ${territory.name}`,
                        description: `Lost territory due to scene deletion: ${scene.name}`,
                        timestamp: new Date().toISOString(),
                        turn: game.combat?.round || 0
                    });
                    
                    await faction.update({
                        'flags.bbttcc-factions.warLog': warLog
                    });
                }
            } catch (factionError) {
                console.error(`BBTTCC Territory | Error cleaning up territory ${territory.id} for faction ${territory.factionId}:`, factionError);
            }
        }
        
        console.log(`BBTTCC Territory | Successfully cleaned up territories for deleted scene ${scene.id}`);
        
    } catch (error) {
        console.error(`BBTTCC Territory | Failed to cleanup territories for deleted scene ${scene.id}:`, error);
    }
});

/**
 * Cross-module communication setup
 */
Hooks.once('ready', async () => {
    try {
        // Wait for factions module if available
        if (game.modules.get('bbttcc-factions')?.active) {
            const factionsModule = game.modules.get('bbttcc-factions');
            if (factionsModule.api || window.BBTTCCFactions) {
                console.log('BBTTCC Territory | Successfully connected to factions module');
            } else {
                // Wait for factions ready signal
                Hooks.once('bbttcc-factions.ready', (api) => {
                    console.log('BBTTCC Territory | Connected to factions module via ready hook');
                });
            }
        } else {
            console.warn('BBTTCC Territory | Factions module not available - some features may be limited');
        }
    } catch (error) {
        console.error('BBTTCC Territory | Error setting up cross-module communication:', error);
    }
});

/**
 * Add context menu options for territory management
 */
Hooks.on('getSceneDirectoryEntryContext', (html, entryOptions) => {
    entryOptions.push({
        name: "Manage Territory",
        icon: '<i class="fas fa-map"></i>',
        condition: game.user.isGM,
        callback: async (li) => {
            const scene = game.scenes.get(li.data('document-id'));
            await openTerritoryManager(scene);
        }
    });
});

// Export for ES module compatibility
export { 
    claimTerritory, 
    contestTerritory, 
    openTerritoryManager, 
    calculateTerritoryResources,
    TerritoryManager,
    TERRITORY_TYPES,
    SIZE_MULTIPLIERS
};