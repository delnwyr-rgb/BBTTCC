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
 * Claim a territory for a faction
 */
async function claimTerritory(territoryData) {
    try {
        console.log('BBTTCC Territory | Claiming territory:', territoryData);
        
        const {
            name,
            factionId,
            sceneId,
            type = 'settlement',
            size = 'medium',
            description = '',
            coordinates = { x: 0, y: 0 }
        } = territoryData;
        
        if (!name || !factionId || !sceneId) {
            throw new Error('Missing required territory data: name, factionId, or sceneId');
        }
        
        const scene = game.scenes.get(sceneId);
        const faction = game.actors.get(factionId);
        
        if (!scene) {
            throw new Error(`Scene not found: ${sceneId}`);
        }
        
        if (!faction) {
            throw new Error(`Faction not found: ${factionId}`);
        }
        
        // Get existing territories for this scene
        const sceneTerritories = scene.flags['bbttcc-territory']?.territories || [];
        
        // Check if territory name already exists in this scene
        if (sceneTerritories.some(t => t.name === name)) {
            throw new Error(`Territory "${name}" already exists in this scene`);
        }
        
        // Create territory data
        const territory = {
            id: foundry.utils.randomID(),
            name: name,
            factionId: factionId,
            factionName: faction.name,
            type: type,
            size: size,
            description: description,
            coordinates: coordinates,
            claimedAt: new Date().toISOString(),
            resources: calculateTerritoryResources(type, size)
        };
        
        // Add territory to scene
        sceneTerritories.push(territory);
        await scene.update({
            'flags.bbttcc-territory.territories': sceneTerritories
        });
        
        // Add territory to faction
        const factionTerritories = faction.flags['bbttcc-factions']?.territories || [];
        factionTerritories.push({
            id: territory.id,
            name: name,
            sceneId: sceneId,
            sceneName: scene.name,
            type: type,
            size: size,
            resources: territory.resources
        });
        
        await faction.update({
            'flags.bbttcc-factions.territories': factionTerritories
        });
        
        // Add war log entry to faction
        if (faction.flags['bbttcc-factions']) {
            const warLog = faction.flags['bbttcc-factions'].warLog || [];
            warLog.push({
                id: foundry.utils.randomID(),
                title: `Territory Claimed: ${name}`,
                description: `Claimed ${size} ${type} territory in ${scene.name}`,
                timestamp: new Date().toISOString(),
                turn: game.combat?.round || 0
            });
            
            await faction.update({
                'flags.bbttcc-factions.warLog': warLog
            });
        }
        
        ui.notifications.info(`Territory "${name}" claimed by ${faction.name}`);
        console.log('BBTTCC Territory | Territory claimed successfully:', territory);
        
        return territory;
        
    } catch (error) {
        console.error('BBTTCC Territory | Error claiming territory:', error);
        ui.notifications.error(`Failed to claim territory: ${error.message}`);
        throw error;
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