/**
 * BBTTCC Raid & Warfare Module v4.8.0 - FIXED
 * Advanced raid planning and execution system with modern FoundryVTT v13+ compatibility
 * Uses game.modules.get().api pattern instead of window objects
 */

import { RaidPlanner } from './raid-planner.js';

// Raid types and their characteristics
const RAID_TYPES = {
    assault: {
        name: "Assault",
        duration: 1.0,
        casualtyMultiplier: 1.2,
        successModifier: 0,
        description: "Direct frontal attack with balanced risk/reward"
    },
    siege: {
        name: "Siege",
        duration: 3.0,
        casualtyMultiplier: 1.5,
        successModifier: -2,
        description: "Extended siege warfare with high casualties but potential for complete victory"
    },
    hitandrun: {
        name: "Hit-and-Run",
        duration: 0.5,
        casualtyMultiplier: 0.8,
        successModifier: 2,
        description: "Fast strike with lower casualties but limited objectives"
    },
    reconnaissance: {
        name: "Reconnaissance", 
        duration: 0.25,
        casualtyMultiplier: 0.3,
        successModifier: 1,
        description: "Intelligence gathering with minimal risk"
    }
};

// Raid objectives
const RAID_OBJECTIVES = {
    resources: {
        name: "Capture Resources",
        difficulty: 0,
        description: "Raid enemy supplies and materials"
    },
    territory: {
        name: "Claim Territory",
        difficulty: 2,
        description: "Take control of enemy territory"
    },
    intelligence: {
        name: "Gather Intelligence",
        difficulty: -1,
        description: "Learn about enemy capabilities and plans"
    },
    sabotage: {
        name: "Destroy Infrastructure",
        difficulty: 1,
        description: "Damage enemy bases and installations"
    }
};

/**
 * Initialize the BBTTCC Raid module
 */
Hooks.once('init', () => {
    console.log('BBTTCC Raid | Initializing v4.8.0...');
    
    // Register settings
    game.settings.register('bbttcc-raid', 'baseCasualtyRate', {
        name: 'Base Casualty Rate',
        hint: 'Base percentage chance of casualties in raids (0.1 = 10%)',
        scope: 'world',
        config: true,
        type: Number,
        default: 0.1,
        range: {
            min: 0.0,
            max: 1.0,
            step: 0.01
        }
    });
    
    game.settings.register('bbttcc-raid', 'enableDetailedCombat', {
        name: 'Enable Detailed Combat',
        hint: 'Show detailed combat calculations and results',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    console.log('BBTTCC Raid | Settings registered');
});

/**
 * Setup hook for final initialization
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Raid | Ready hook fired');
    
    // Expose modern API via game.modules pattern
    const module = game.modules.get('bbttcc-raid');
    if (module) {
        module.api = {
            planRaid: planRaid,
            executeRaid: executeRaid,
            openRaidPlanner: openRaidPlanner,
            calculateRaidOutcome: calculateRaidOutcome,
            RaidPlanner: RaidPlanner,
            RAID_TYPES: RAID_TYPES,
            RAID_OBJECTIVES: RAID_OBJECTIVES,
            version: '4.8.0'
        };
        console.log('BBTTCC Raid | API exposed via game.modules.get("bbttcc-raid").api');
    }
    
    // Also maintain legacy compatibility temporarily
    window.BBTTCCRaid = {
        planRaid: planRaid,
        openRaidPlanner: openRaidPlanner,
        version: '4.8.0'
    };
    
    // Initialize global raid system
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.raid = {
        planRaid: planRaid,
        executeRaid: executeRaid,
        openRaidPlanner: openRaidPlanner,
        calculateRaidOutcome: calculateRaidOutcome
    };
    
    console.log('BBTTCC Raid | Module ready v4.8.0');
});

/**
 * Plan a raid between factions
 */
async function planRaid(attackerFactionId, raidData) {
    try {
        console.log('BBTTCC Raid | Planning raid:', { attackerFactionId, raidData });
        
        const {
            targetFactionId,
            raidType = 'assault',
            objective = 'resources',
            forcesCommitted = 50,
            description = ''
        } = raidData;
        
        if (!attackerFactionId || !targetFactionId) {
            throw new Error('Both attacker and target faction IDs are required');
        }
        
        const attacker = game.actors.get(attackerFactionId);
        const target = game.actors.get(targetFactionId);
        
        if (!attacker || !target) {
            throw new Error('One or both factions not found');
        }
        
        if (attacker.id === target.id) {
            throw new Error('Faction cannot raid itself');
        }
        
        // Validate raid parameters
        if (!RAID_TYPES[raidType]) {
            throw new Error(`Invalid raid type: ${raidType}`);
        }
        
        if (!RAID_OBJECTIVES[objective]) {
            throw new Error(`Invalid raid objective: ${objective}`);
        }
        
        if (forcesCommitted < 1 || forcesCommitted > 100) {
            throw new Error('Forces committed must be between 1-100%');
        }
        
        // Create raid data
        const raid = {
            id: foundry.utils.randomID(),
            attackerId: attackerFactionId,
            attackerName: attacker.name,
            targetId: targetFactionId,
            targetName: target.name,
            raidType: raidType,
            objective: objective,
            forcesCommitted: forcesCommitted,
            description: description,
            status: 'planned',
            plannedAt: new Date().toISOString(),
            turn: game.combat?.round || 0
        };
        
        // Store raid in world flags
        const activeRaids = game.settings.get('world', 'bbttcc-active-raids') || [];
        activeRaids.push(raid);
        await game.settings.set('world', 'bbttcc-active-raids', activeRaids);
        
        // Add war log entries to both factions
        await addWarLogEntry(attacker, {
            title: `Raid Planned: ${target.name}`,
            description: `Planned ${RAID_TYPES[raidType].name} raid against ${target.name} - Objective: ${RAID_OBJECTIVES[objective].name}`,
            timestamp: raid.plannedAt,
            turn: raid.turn
        });
        
        await addWarLogEntry(target, {
            title: `Incoming Raid: ${attacker.name}`,
            description: `${attacker.name} is planning a ${RAID_TYPES[raidType].name} raid - Objective: ${RAID_OBJECTIVES[objective].name}`,
            timestamp: raid.plannedAt,
            turn: raid.turn
        });
        
        ui.notifications.info(`Raid planned: ${attacker.name} vs ${target.name}`);
        console.log('BBTTCC Raid | Raid planned successfully:', raid);
        
        return raid;
        
    } catch (error) {
        console.error('BBTTCC Raid | Error planning raid:', error);
        ui.notifications.error(`Failed to plan raid: ${error.message}`);
        throw error;
    }
}

/**
 * Execute a planned raid
 */
async function executeRaid(raidId) {
    try {
        console.log('BBTTCC Raid | Executing raid:', raidId);
        
        // Get active raids
        const activeRaids = game.settings.get('world', 'bbttcc-active-raids') || [];
        const raidIndex = activeRaids.findIndex(r => r.id === raidId);
        
        if (raidIndex === -1) {
            throw new Error('Raid not found');
        }
        
        const raid = activeRaids[raidIndex];
        
        if (raid.status !== 'planned') {
            throw new Error('Raid is not in planned status');
        }
        
        const attacker = game.actors.get(raid.attackerId);
        const target = game.actors.get(raid.targetId);
        
        if (!attacker || !target) {
            throw new Error('One or both factions no longer exist');
        }
        
        // Calculate raid outcome
        const outcome = await calculateRaidOutcome(attacker, target, raid);
        
        // Update raid status
        raid.status = 'completed';
        raid.executedAt = new Date().toISOString();
        raid.outcome = outcome;
        
        activeRaids[raidIndex] = raid;
        await game.settings.set('world', 'bbttcc-active-raids', activeRaids);
        
        // Create detailed chat message
        await createRaidResultMessage(raid, outcome);
        
        // Apply raid results
        await applyRaidResults(attacker, target, raid, outcome);
        
        console.log('BBTTCC Raid | Raid executed successfully:', outcome);
        return outcome;
        
    } catch (error) {
        console.error('BBTTCC Raid | Error executing raid:', error);
        ui.notifications.error(`Failed to execute raid: ${error.message}`);
        throw error;
    }
}

/**
 * Calculate the outcome of a raid
 */
async function calculateRaidOutcome(attacker, target, raid) {
    const raidType = RAID_TYPES[raid.raidType];
    const objective = RAID_OBJECTIVES[raid.objective];
    
    // Calculate base strengths
    const attackerStrength = calculateFactionStrength(attacker);
    const targetStrength = calculateFactionStrength(target);
    
    // Apply force commitment
    const effectiveAttackerStrength = Math.round(attackerStrength * (raid.forcesCommitted / 100));
    
    // Apply raid type modifiers
    const attackerModifier = raidType.successModifier + objective.difficulty;
    
    // Roll for combat
    const attackerRoll = new Roll(`1d20 + ${effectiveAttackerStrength} + ${attackerModifier}`);
    const targetRoll = new Roll(`1d20 + ${targetStrength}`);
    
    const attackerResult = await attackerRoll.evaluate();
    const targetResult = await targetRoll.evaluate();
    
    const success = attackerResult.total > targetResult.total;
    const margin = Math.abs(attackerResult.total - targetResult.total);
    
    // Calculate casualties
    const baseCasualtyRate = game.settings.get('bbttcc-raid', 'baseCasualtyRate');
    const casualtyRate = baseCasualtyRate * raidType.casualtyMultiplier;
    
    const attackerCasualties = Math.round(effectiveAttackerStrength * casualtyRate * (success ? 0.7 : 1.3));
    const targetCasualties = Math.round(targetStrength * casualtyRate * (success ? 1.3 : 0.7));
    
    // Calculate resource gains/losses
    let resourceChange = 0;
    let territoryGained = null;
    let intelligenceGained = '';
    let infrastructureDamage = 0;
    
    if (success) {
        switch (raid.objective) {
            case 'resources':
                resourceChange = Math.round(margin * 10 * (raid.forcesCommitted / 100));
                break;
            case 'territory':
                // This would need integration with territory module
                territoryGained = `Potential territory claim available`;
                break;
            case 'intelligence':
                intelligenceGained = `Learned about ${target.name}: Strength ${targetStrength}, OPs distribution`;
                break;
            case 'sabotage':
                infrastructureDamage = Math.round(margin * 5);
                break;
        }
    }
    
    return {
        success: success,
        margin: margin,
        attackerRoll: attackerResult,
        targetRoll: targetResult,
        attackerCasualties: attackerCasualties,
        targetCasualties: targetCasualties,
        resourceChange: resourceChange,
        territoryGained: territoryGained,
        intelligenceGained: intelligenceGained,
        infrastructureDamage: infrastructureDamage,
        duration: raidType.duration
    };
}

/**
 * Calculate faction strength for raids
 */
function calculateFactionStrength(faction) {
    const ops = faction.system?.ops || {};
    const territories = faction.flags['bbttcc-factions']?.territories || [];
    const bases = faction.flags['bbttcc-factions']?.bases || [];
    
    // Base strength from OPs (emphasize violence and non-lethal)
    const opStrength = (ops.violence?.value || 0) * 2 + 
                      (ops.nonlethal?.value || 0) * 1.5 + 
                      (ops.economy?.value || 0) * 0.5;
    
    // Territory bonuses (different types provide different military value)
    const territoryBonus = territories.reduce((sum, territory) => {
        const bonus = territory.type === 'fortress' ? 5 : 
                     territory.type === 'settlement' ? 2 : 1;
        return sum + bonus;
    }, 0);
    
    // Base bonuses
    const baseBonus = bases.reduce((sum, base) => {
        const bonus = base.type === 'castle' ? 8 :
                     base.type === 'bunker' ? 6 :
                     base.type === 'tower' ? 4 : 2;
        return sum + bonus;
    }, 0);
    
    return Math.round(opStrength + territoryBonus + baseBonus);
}

/**
 * Apply raid results to factions
 */
async function applyRaidResults(attacker, target, raid, outcome) {
    const timestamp = new Date().toISOString();
    const turn = game.combat?.round || 0;
    
    // Add war log entries
    await addWarLogEntry(attacker, {
        title: `Raid ${outcome.success ? 'Successful' : 'Failed'}: ${target.name}`,
        description: `${RAID_TYPES[raid.raidType].name} raid ${outcome.success ? 'succeeded' : 'failed'}. Casualties: ${outcome.attackerCasualties}`,
        timestamp: timestamp,
        turn: turn
    });
    
    await addWarLogEntry(target, {
        title: `Raid ${outcome.success ? 'Suffered' : 'Repelled'}: ${attacker.name}`,
        description: `${attacker.name}'s ${RAID_TYPES[raid.raidType].name} raid ${outcome.success ? 'succeeded' : 'was repelled'}. Casualties: ${outcome.targetCasualties}`,
        timestamp: timestamp,
        turn: turn
    });
    
    // Apply OP changes based on casualties and success
    if (outcome.attackerCasualties > 0) {
        const opsLoss = Math.min(2, Math.ceil(outcome.attackerCasualties / 10));
        const currentViolence = attacker.system.ops?.violence?.value || 0;
        await attacker.update({
            'system.ops.violence.value': Math.max(0, currentViolence - opsLoss)
        });
    }
    
    if (outcome.targetCasualties > 0) {
        const opsLoss = Math.min(2, Math.ceil(outcome.targetCasualties / 10));
        const currentNonLethal = target.system.ops?.nonlethal?.value || 0;
        await target.update({
            'system.ops.nonlethal.value': Math.max(0, currentNonLethal - opsLoss)
        });
    }
    
    // Apply resource gains
    if (outcome.success && outcome.resourceChange > 0) {
        const currentEconomy = attacker.system.ops?.economy?.value || 0;
        const maxEconomy = attacker.system.ops?.economy?.max || 10;
        await attacker.update({
            'system.ops.economy.value': Math.min(maxEconomy, currentEconomy + 1)
        });
    }
}

/**
 * Create detailed raid result chat message
 */
async function createRaidResultMessage(raid, outcome) {
    const raidType = RAID_TYPES[raid.raidType];
    const objective = RAID_OBJECTIVES[raid.objective];
    
    const content = `
        <div class="bbttcc-raid-result">
            <h4>${raid.attackerName} raids ${raid.targetName}</h4>
            <div class="raid-details">
                <div><strong>Type:</strong> ${raidType.name}</div>
                <div><strong>Objective:</strong> ${objective.name}</div>
                <div><strong>Forces:</strong> ${raid.forcesCommitted}%</div>
            </div>
            <div class="combat-results">
                <div class="rolls">
                    <div><strong>${raid.attackerName}:</strong> ${outcome.attackerRoll.total} (${outcome.attackerRoll.formula})</div>
                    <div><strong>${raid.targetName}:</strong> ${outcome.targetRoll.total} (${outcome.targetRoll.formula})</div>
                </div>
                <div class="outcome ${outcome.success ? 'success' : 'failure'}">
                    <strong>${outcome.success ? 'RAID SUCCESSFUL' : 'RAID FAILED'}</strong>
                    <div>Margin: ${outcome.margin}</div>
                </div>
            </div>
            <div class="casualties">
                <div><strong>Casualties:</strong></div>
                <div>${raid.attackerName}: ${outcome.attackerCasualties}</div>
                <div>${raid.targetName}: ${outcome.targetCasualties}</div>
            </div>
            ${outcome.success ? `
                <div class="results">
                    ${outcome.resourceChange > 0 ? `<div>Resources gained: ${outcome.resourceChange}</div>` : ''}
                    ${outcome.territoryGained ? `<div>${outcome.territoryGained}</div>` : ''}
                    ${outcome.intelligenceGained ? `<div>Intelligence: ${outcome.intelligenceGained}</div>` : ''}
                    ${outcome.infrastructureDamage > 0 ? `<div>Infrastructure damage: ${outcome.infrastructureDamage}</div>` : ''}
                </div>
            ` : ''}
        </div>
    `;
    
    const chatData = {
        user: game.user.id,
        content: content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
    };
    
    await ChatMessage.create(chatData);
}

/**
 * Add war log entry to faction
 */
async function addWarLogEntry(faction, entry) {
    if (!faction.flags['bbttcc-factions']) return;
    
    const warLog = faction.flags['bbttcc-factions'].warLog || [];
    const newEntry = {
        id: foundry.utils.randomID(),
        title: entry.title,
        description: entry.description,
        timestamp: entry.timestamp || new Date().toISOString(),
        turn: entry.turn || game.combat?.round || 0
    };
    
    warLog.push(newEntry);
    
    await faction.update({
        'flags.bbttcc-factions.warLog': warLog
    });
}

/**
 * Open raid planner for a faction
 */
async function openRaidPlanner(faction) {
    try {
        console.log('BBTTCC Raid | Opening raid planner for faction:', faction.name);
        
        const planner = new RaidPlanner(faction);
        planner.render(true);
        
    } catch (error) {
        console.error('BBTTCC Raid | Error opening raid planner:', error);
        ui.notifications.error(`Failed to open raid planner: ${error.message}`);
    }
}

/**
 * Add context menu options for raid planning
 */
Hooks.on('getActorDirectoryEntryContext', (html, entryOptions) => {
    entryOptions.push({
        name: "Plan Raid",
        icon: '<i class="fas fa-sword"></i>',
        condition: li => {
            const actor = game.actors.get(li.data('document-id'));
            return game.user.isGM && actor?.flags['bbttcc-factions']?.isFaction;
        },
        callback: async (li) => {
            const faction = game.actors.get(li.data('document-id'));
            await openRaidPlanner(faction);
        }
    });
});

// Export for ES module compatibility
export { 
    planRaid, 
    executeRaid, 
    openRaidPlanner, 
    calculateRaidOutcome,
    RaidPlanner,
    RAID_TYPES,
    RAID_OBJECTIVES
};