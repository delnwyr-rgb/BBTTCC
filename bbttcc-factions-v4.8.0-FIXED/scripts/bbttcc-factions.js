/**
 * BBTTCC Factions Module v4.8.0 - FIXED
 * Main module file with modern FoundryVTT v13+ compatibility
 * Uses game.modules.get().api pattern instead of window objects
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
 * Initialize the BBTTCC Factions module
 */
Hooks.once('init', () => {
    console.log('BBTTCC Factions | Initializing v4.8.0...');
    
    // Register custom actor sheet for factions
    Actors.registerSheet("dnd5e", FactionSheet, {
        types: ["npc"],
        makeDefault: false,
        label: "BBTTCC Faction Sheet"
    });
    
    console.log('BBTTCC Factions | Registered faction sheet');
});

/**
 * Setup hook for final initialization
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Factions | Ready hook fired');
    
    // Expose modern API via game.modules pattern
    const module = game.modules.get('bbttcc-factions');
    if (module) {
        module.api = {
            createFaction: createFaction,
            FactionSheet: FactionSheet,
            FactionActor: FactionActor,
            DEFAULT_OPS_STRUCTURE: DEFAULT_OPS_STRUCTURE,
            version: '4.8.0'
        };
        console.log('BBTTCC Factions | API exposed via game.modules.get("bbttcc-factions").api');
    }
    
    // Also maintain legacy compatibility temporarily
    window.BBTTCCFactions = {
        createFaction: createFaction,
        version: '4.8.0'
    };
    
    console.log('BBTTCC Factions | Module ready v4.8.0');
});

/**
 * Hook to ensure proper OPs data structure on faction creation
 */
Hooks.on('preCreateActor', (actor, data, options, userId) => {
    if (data.name?.includes('Faction') || data.flags?.['bbttcc-factions']?.isFaction) {
        console.log('BBTTCC Factions | Pre-creating faction with OPs structure');
        
        // Ensure system data exists
        if (!data.system) {
            data.system = {};
        }
        
        // Add OPs structure
        data.system.ops = DEFAULT_OPS_STRUCTURE;
        
        // Add faction-specific flags
        if (!data.flags) {
            data.flags = {};
        }
        data.flags['bbttcc-factions'] = {
            isFaction: true,
            version: '4.8.0',
            warLog: [],
            territories: [],
            bases: []
        };
        
        console.log('BBTTCC Factions | Added OPs structure to faction', data);
    }
});

/**
 * Create a new BBTTCC faction actor
 */
async function createFaction(factionData = {}) {
    try {
        console.log('BBTTCC Factions | Creating faction...', factionData);
        
        // Default faction data
        const defaultData = {
            name: factionData.name || "New BBTTCC Faction",
            type: "npc",
            system: {
                ops: DEFAULT_OPS_STRUCTURE,
                details: {
                    type: { value: "faction" }
                }
            },
            flags: {
                'bbttcc-factions': {
                    isFaction: true,
                    version: '4.8.0',
                    warLog: [],
                    territories: [],
                    bases: []
                }
            }
        };
        
        // Merge with provided data
        const finalData = foundry.utils.mergeObject(defaultData, factionData);
        
        // Create the actor
        const faction = await Actor.create(finalData);
        
        if (faction) {
            console.log('BBTTCC Factions | Faction created successfully:', faction);
            ui.notifications.info(`Faction "${faction.name}" created successfully!`);
            
            // Open the faction sheet
            faction.sheet.render(true);
            
            return faction;
        } else {
            throw new Error('Actor creation returned null');
        }
        
    } catch (error) {
        console.error('BBTTCC Factions | Error creating faction:', error);
        ui.notifications.error(`Failed to create faction: ${error.message}`);
        throw error;
    }
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
            await createFaction();
        }
    });
});

// Export for ES module compatibility
export { createFaction, DEFAULT_OPS_STRUCTURE, FactionSheet, FactionActor };