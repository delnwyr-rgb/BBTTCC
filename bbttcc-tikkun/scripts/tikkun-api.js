/**
 * BBTTCC Tikkun API
 * Core functionality for managing the Sparks of Light system
 */

// Constants for spark system
const SPARK_STATUS = {
    REQUIRED: 'required',
    IDENTIFIED: 'identified',
    ACTIVE: 'active',
    GATHERED: 'gathered',
    CORRUPTED: 'corrupted'
};

export class TikkunAPI {
    constructor() {
        this.ready = true;
    }

    // Check if module is ready
    isReady() {
        return this.ready;
    }

    // Get all spark data for an actor
    getSparks(actor) {
        return actor.getFlag('bbttcc-tikkun', 'sparks') || null;
    }

    // Get specific spark data
    getSpark(actor, sparkId) {
        const sparks = this.getSparks(actor);
        return sparks?.sparks?.[sparkId] || null;
    }

    // Generate constellation for character (called once at campaign start)
    async generateConstellation(actor) {
        if (!actor || actor.type !== 'character') {
            console.log("bbttcc-tikkun | Cannot generate constellation: invalid actor");
            return false;
        }

        // Check if already generated
        const existing = this.getSparks(actor);
        if (existing?.constellationGenerated) {
            console.log("bbttcc-tikkun | Constellation already generated for", actor.name);
            return existing;
        }

        console.log("bbttcc-tikkun | Generating constellation for", actor.name);

        // Extract character creation data
        const characterData = this.extractCharacterCreationData(actor);
        
        // Generate spark matrix
        const sparkMatrix = game.bbttccTikkun.constellation.generateSparkMatrix(characterData);
        
        // Create constellation data structure
        const constellationData = {
            version: "1.0.0",
            constellationGenerated: true,
            generatedTimestamp: new Date().toISOString(),
            characterData: characterData,
            sparks: sparkMatrix
        };

        // Save to actor
        await actor.setFlag('bbttcc-tikkun', 'sparks', constellationData);

        // Notify players
        ChatMessage.create({
            content: `<div class="bbttcc-tikkun-notification">
                <h3>🌟 The Great Work Begins</h3>
                <p><strong>${actor.name}</strong> has received their sacred Constellation!</p>
                <p><em>The path to Tikkun Olam is now revealed...</em></p>
                <ul>${Object.values(sparkMatrix).map(spark => 
                    `<li>Spark of ${spark.name} (${spark.sephirah})</li>`
                ).join('')}</ul>
            </div>`,
            speaker: ChatMessage.getSpeaker({alias: "The Great Work"})
        });

        console.log("bbttcc-tikkun | Constellation generated successfully for", actor.name);
        return constellationData;
    }

    // Maybe generate constellation (check conditions first)
    async maybeGenerateConstellation(actor) {
        // Only generate if GM and character doesn't have constellation
        if (!game.user.isGM) return false;
        
        const existing = this.getSparks(actor);
        if (existing?.constellationGenerated) return existing;

        // Check if character has enough creation data
        const characterData = this.extractCharacterCreationData(actor);
        if (!characterData.archetype && !characterData.background) {
            console.log("bbttcc-tikkun | Not enough character data to generate constellation for", actor.name);
            return false;
        }

        return await this.generateConstellation(actor);
    }

    // Extract character creation data for constellation generation
    extractCharacterCreationData(actor) {
        const data = {
            archetype: null,
            crew: null,
            occult: null,
            location: null,
            background: actor.system?.details?.background?.value || null,
            class: actor.system?.details?.class?.value || actor.classes?.[0]?.name || null
        };

        // Try to extract from various sources (flags, items, etc.)
        // This would need customization based on how BBTTCC stores character creation choices
        
        // Check for BBTTCC faction flags
        const factionData = actor.getFlag('bbttcc-factions', 'character');
        if (factionData) {
            data.archetype = factionData.archetype;
            data.crew = factionData.crew;
            data.occult = factionData.occult;
            data.location = factionData.startingLocation;
        }

        return data;
    }

    // Update spark status and details
    async updateSparkStatus(actor, sparkId, newStatus, detailsObject = {}) {
        const sparksData = this.getSparks(actor);
        if (!sparksData || !sparksData.sparks[sparkId]) {
            console.log("bbttcc-tikkun | Cannot update spark: spark not found", sparkId);
            return false;
        }

        const spark = sparksData.sparks[sparkId];
        const oldStatus = spark.status;
        
        // Update status
        spark.status = newStatus;
        spark.lastUpdated = new Date().toISOString();

        // Add quest log entry
        if (!spark.quest_log) spark.quest_log = [];
        
        if (detailsObject.entry) {
            spark.quest_log.push({
                timestamp: new Date().toISOString(),
                entry: detailsObject.entry,
                status: newStatus
            });
        }

        // Handle corruption
        if (newStatus === SPARK_STATUS.CORRUPTED) {
            spark.corruptionDetails = {
                reason: detailsObject.reason || "Spark corrupted through improper means",
                effect: detailsObject.effect || "Unknown corruption effect",
                purificationQuest: detailsObject.purificationQuest || "Seek redemption through righteous action",
                corruptedTimestamp: new Date().toISOString()
            };
        }

        // Handle gathering
        if (newStatus === SPARK_STATUS.GATHERED) {
            spark.gatheredTimestamp = new Date().toISOString();
            
            // Trigger rewards
            await this.applySparkRewards(actor, spark);
        }

        // Save updated data
        await actor.setFlag('bbttcc-tikkun', 'sparks', sparksData);

        // Create chat message for status change
        await this.createSparkStatusMessage(actor, spark, oldStatus, newStatus, detailsObject);

        console.log(`bbttcc-tikkun | Spark ${sparkId} status updated: ${oldStatus} → ${newStatus}`);
        return true;
    }

    // Check if scenario conditions meet spark gathering requirements
    async checkForGathering(actor, scenarioData) {
        const sparksData = this.getSparks(actor);
        if (!sparksData) return;

        console.log("bbttcc-tikkun | Checking spark conditions for", actor.name, scenarioData);

        for (const sparkId in sparksData.sparks) {
            const spark = sparksData.sparks[sparkId];

            // Only check active sparks
            if (spark.status !== SPARK_STATUS.ACTIVE) continue;

            const conditions = this.getSparkConditions(sparkId);
            
            if (this.conditionsMet(conditions.gather, scenarioData)) {
                await this.updateSparkStatus(actor, sparkId, SPARK_STATUS.GATHERED, {
                    entry: `Completed ${scenarioData.type} scenario with '${scenarioData.outcome}' outcome.`
                });
            } else if (this.conditionsMet(conditions.corrupt, scenarioData)) {
                await this.updateSparkStatus(actor, sparkId, SPARK_STATUS.CORRUPTED, {
                    entry: `Attempted to gather via '${scenarioData.outcome}' outcome, tainting the Spark.`,
                    reason: `Used method contrary to the Spark's nature: ${scenarioData.outcome}`,
                    effect: "Faction suffers penalties until Spark is purified"
                });
            }
        }
    }

    // Get gathering/corruption conditions for a spark
    getSparkConditions(sparkId) {
        // This maps specific sparks to their gathering and corruption conditions
        // Based on the PDF requirements
        const conditionsMap = {
            'sparkOfMercy_Chesed': {
                gather: ['Justice/Reformation', 'Alliance/Cooperation', 'Diplomatic Success'],
                corrupt: ['Retribution/Subjugation', 'Massacre', 'Betrayal']
            },
            'sparkOfSeverity_Gevurah': {
                gather: ['Justice/Reformation', 'Disciplined Victory'],  
                corrupt: ['Chaos', 'Unnecessary Violence']
            },
            'sparkOfTruth_Tiferet': {
                gather: ['Honest Diplomacy', 'Revelation', 'Unity'],
                corrupt: ['Deception', 'Betrayal', 'Discord']
            },
            'sparkOfVictory_Netzach': {
                gather: ['Heroic Victory', 'Liberation', 'Endurance'],
                corrupt: ['Pyrrhic Victory', 'Excessive Violence']
            },
            'sparkOfUnderstanding_Binah': {
                gather: ['Knowledge Gained', 'Wisdom Shared', 'Teaching'],
                corrupt: ['Knowledge Hoarded', 'Ignorance Spread']
            }
            // Add more as needed
        };

        return conditionsMap[sparkId] || { gather: [], corrupt: [] };
    }

    // Check if conditions are met
    conditionsMet(conditions, scenarioData) {
        if (!conditions || conditions.length === 0) return false;
        
        return conditions.some(condition => {
            return scenarioData.outcome?.includes(condition) || 
                   scenarioData.type?.includes(condition) ||
                   scenarioData.details?.includes?.(condition);
        });
    }

    // Apply rewards when spark is gathered
    async applySparkRewards(actor, spark) {
        console.log("bbttcc-tikkun | Applying rewards for gathered spark:", spark.name);

        // 1. Enlightenment Level increase
        // This would integrate with BBTTCC's enlightenment system if it exists
        
        // 2. Organization Points injection to faction
        const factionActor = this.getCharacterFaction(actor);
        if (factionActor && game.modules.get('bbttcc-factions')?.api) {
            const factionsApi = game.modules.get('bbttcc-factions').api;
            const opReward = this.calculateOPReward(spark);
            
            for (const [opType, amount] of Object.entries(opReward)) {
                if (amount > 0) {
                    await factionsApi.factions.update(factionActor, opType, 
                        factionsApi.factions.getOP(factionActor, opType) + amount);
                }
            }
        }

        // 3. Create reward notification
        ChatMessage.create({
            content: `<div class="bbttcc-tikkun-reward">
                <h3>✨ Spark of Light Gathered! ✨</h3>
                <p><strong>${actor.name}</strong> has gathered the <strong>${spark.name}</strong>!</p>
                <p><em>"The light of ${spark.sephirah} now illuminates the path forward..."</em></p>
                <p>🌟 Enlightenment flows through your being</p>
                <p>⚡ Your faction gains strength from this divine act</p>
            </div>`,
            speaker: ChatMessage.getSpeaker({alias: "The Great Work"})
        });
    }

    // Get character's faction
    getCharacterFaction(actor) {
        // This would depend on how BBTTCC links characters to factions
        const factionId = actor.getFlag('bbttcc-factions', 'factionId');
        return factionId ? game.actors.get(factionId) : null;
    }

    // Calculate OP rewards based on spark
    calculateOPReward(spark) {
        const baseReward = 50; // Large reward as specified in PDF
        
        const rewardMap = {
            'Chesed': { diplomacy: baseReward, softPower: baseReward / 2 },
            'Gevurah': { violence: baseReward, discipline: baseReward / 2 },
            'Tiferet': { diplomacy: baseReward / 2, softPower: baseReward / 2, economy: baseReward / 2 },
            'Binah': { economy: baseReward, intrigue: baseReward / 2 },
            'Chokmah': { intrigue: baseReward, softPower: baseReward / 2 },
            'Netzach': { violence: baseReward / 2, diplomacy: baseReward / 2 }
        };

        return rewardMap[spark.sephirah] || { economy: baseReward / 3, diplomacy: baseReward / 3, softPower: baseReward / 3 };
    }

    // Create chat message for spark status changes
    async createSparkStatusMessage(actor, spark, oldStatus, newStatus, details) {
        const statusEmoji = {
            [SPARK_STATUS.REQUIRED]: '⚫',
            [SPARK_STATUS.IDENTIFIED]: '🔍',
            [SPARK_STATUS.ACTIVE]: '✨',
            [SPARK_STATUS.GATHERED]: '🌟',
            [SPARK_STATUS.CORRUPTED]: '💀'
        };

        let content = `<div class="bbttcc-tikkun-status">
            <h4>${statusEmoji[newStatus]} ${spark.name}</h4>
            <p><strong>${actor.name}</strong>: ${oldStatus} → ${newStatus}</p>`;

        if (details.entry) {
            content += `<p><em>${details.entry}</em></p>`;
        }

        if (newStatus === SPARK_STATUS.CORRUPTED && spark.corruptionDetails) {
            content += `<div class="corruption-warning">
                <p><strong>⚠️ Corruption:</strong> ${spark.corruptionDetails.reason}</p>
                <p><strong>Purification Required:</strong> ${spark.corruptionDetails.purificationQuest}</p>
            </div>`;
        }

        content += `</div>`;

        await ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker({alias: "The Great Work"}),
            whisper: game.users.filter(u => u.isGM).map(u => u.id)
        });
    }

    // List all factions and their spark progress (GM utility)
    getSparkProgress() {
        const characters = game.actors.filter(a => a.type === 'character');
        const progress = {};

        characters.forEach(actor => {
            const sparks = this.getSparks(actor);
            if (sparks) {
                progress[actor.name] = {
                    actor: actor,
                    totalSparks: Object.keys(sparks.sparks).length,
                    gathered: Object.values(sparks.sparks).filter(s => s.status === SPARK_STATUS.GATHERED).length,
                    corrupted: Object.values(sparks.sparks).filter(s => s.status === SPARK_STATUS.CORRUPTED).length,
                    active: Object.values(sparks.sparks).filter(s => s.status === SPARK_STATUS.ACTIVE).length
                };
            }
        });

        return progress;
    }

    // Validate and repair spark data (auto-repair system)
    async repairSparks(actor) {
        const sparksData = this.getSparks(actor);
        if (!sparksData) return false;

        let repaired = false;

        // Repair missing fields
        for (const sparkId in sparksData.sparks) {
            const spark = sparksData.sparks[sparkId];
            
            if (!spark.quest_log) {
                spark.quest_log = [];
                repaired = true;
            }
            
            if (!spark.status) {
                spark.status = SPARK_STATUS.REQUIRED;
                repaired = true;
            }
        }

        if (repaired) {
            await actor.setFlag('bbttcc-tikkun', 'sparks', sparksData);
            console.log("bbttcc-tikkun | Repaired spark data for", actor.name);
        }

        return repaired;
    }
}