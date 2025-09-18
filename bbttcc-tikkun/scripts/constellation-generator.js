/**
 * BBTTCC Constellation Generator
 * Procedurally generates character Spark Constellations based on creation choices
 * Implements thematic tension principle: assign opposing Sparks to character strengths
 */

// BBTTCCTikkun will be available through game.bbttccTikkun

export class ConstellationGenerator {
    constructor() {
        // Spark Generation Matrix from PDF
        this.sparkMatrix = {
            archetype: {
                'Warlord': { sephirah: 'GEVURAH', opposingSpark: 'sparkOfMercy_Chesed' },
                'Hierophant': { sephirah: 'TIFERET', opposingSpark: 'sparkOfVictory_Netzach' },
                'Sovereign': { sephirah: 'MALKUTH', opposingSpark: 'sparkOfUnity_Keter' },
                'Wizard': { sephirah: 'HOD', opposingSpark: 'sparkOfWisdom_Chokmah' },
                'Scholar': { sephirah: 'HOD', opposingSpark: 'sparkOfWisdom_Chokmah' },
                'Diplomat': { sephirah: 'CHESED', opposingSpark: 'sparkOfSeverity_Gevurah' },
                'Merchant': { sephirah: 'MALKUTH', opposingSpark: 'sparkOfUnity_Keter' },
                'Explorer': { sephirah: 'NETZACH', opposingSpark: 'sparkOfUnderstanding_Binah' }
            },
            crew: {
                'Mercenary Band': { sephirah: 'GEVURAH', opposingSpark: 'sparkOfPeace_Chesed' },
                'Cultural Ambassadors': { sephirah: 'HOD', opposingSpark: 'sparkOfFoundation_Yesod' },
                'Covert Ops Cell': { sephirah: 'BINAH', opposingSpark: 'sparkOfTruth_Tiferet' },
                'Trade Guild': { sephirah: 'MALKUTH', opposingSpark: 'sparkOfUnity_Keter' },
                'Research Team': { sephirah: 'HOD', opposingSpark: 'sparkOfWisdom_Chokmah' },
                'Diplomatic Corps': { sephirah: 'CHESED', opposingSpark: 'sparkOfSeverity_Gevurah' }
            },
            occult: {
                'Kabbalist': { sephirah: 'KETER', opposingSpark: 'sparkOfManifestation_Malkuth' },
                'Goetic Summoner': { sephirah: 'QLIPHOTH', opposingSpark: 'sparkOfPurity_Tiferet' },
                'Hermetic Scholar': { sephirah: 'HOD', opposingSpark: 'sparkOfWisdom_Chokmah' },
                'Alchemist': { sephirah: 'YESOD', opposingSpark: 'sparkOfFoundation_Yesod' },
                'None': { sephirah: 'MALKUTH', opposingSpark: 'sparkOfUnity_Keter' }
            },
            background: {
                'Soldier': { sephirah: 'GEVURAH', opposingSpark: 'sparkOfMercy_Chesed' },
                'Noble': { sephirah: 'MALKUTH', opposingSpark: 'sparkOfHumility_Hod' },
                'Sage': { sephirah: 'CHOKMAH', opposingSpark: 'sparkOfUnderstanding_Binah' },
                'Criminal': { sephirah: 'QLIPHOTH', opposingSpark: 'sparkOfJustice_Gevurah' },
                'Folk Hero': { sephirah: 'NETZACH', opposingSpark: 'sparkOfHumility_Hod' },
                'Hermit': { sephirah: 'BINAH', opposingSpark: 'sparkOfCommunity_Yesod' }
            }
        };

        // Complete Spark definitions
        this.sparkDefinitions = {
            'sparkOfUnity_Keter': {
                id: 'sparkOfUnity_Keter',
                name: 'Spark of Unity', 
                sephirah: 'Keter',
                type: 'conceptual',
                description: 'The principle of divine oneness and ultimate purpose that unites all creation.',
                status: 'required',
                quest_log: []
            },
            'sparkOfWisdom_Chokmah': {
                id: 'sparkOfWisdom_Chokmah',
                name: 'Spark of Wisdom',
                sephirah: 'Chokmah', 
                type: 'vestigial',
                description: 'The principle of divine inspiration and creative force.',
                status: 'required',
                quest_log: []
            },
            'sparkOfUnderstanding_Binah': {
                id: 'sparkOfUnderstanding_Binah',
                name: 'Spark of Understanding',
                sephirah: 'Binah',
                type: 'vestigial', 
                description: 'The principle of deep, structured comprehension and contemplative wisdom.',
                status: 'required',
                quest_log: []
            },
            'sparkOfMercy_Chesed': {
                id: 'sparkOfMercy_Chesed',
                name: 'Spark of Mercy',
                sephirah: 'Chesed',
                type: 'conceptual',
                description: 'The principle of boundless compassion, kindness, and loving grace.',
                status: 'required',
                quest_log: []
            },
            'sparkOfPeace_Chesed': {
                id: 'sparkOfPeace_Chesed',
                name: 'Spark of Peace',
                sephirah: 'Chesed', 
                type: 'conceptual',
                description: 'The principle of harmony through compassionate governance.',
                status: 'required',
                quest_log: []
            },
            'sparkOfSeverity_Gevurah': {
                id: 'sparkOfSeverity_Gevurah',
                name: 'Spark of Severity',
                sephirah: 'Gevurah',
                type: 'animate',
                description: 'The principle of righteous judgment, discipline, and divine justice.',
                status: 'required',
                quest_log: []
            },
            'sparkOfJustice_Gevurah': {
                id: 'sparkOfJustice_Gevurah', 
                name: 'Spark of Justice',
                sephirah: 'Gevurah',
                type: 'conceptual',
                description: 'The principle of righteous judgment and moral order.',
                status: 'required',
                quest_log: []
            },
            'sparkOfTruth_Tiferet': {
                id: 'sparkOfTruth_Tiferet',
                name: 'Spark of Truth',
                sephirah: 'Tiferet',
                type: 'animate',
                description: 'The principle of harmony, balance, and divine truth.',
                status: 'required',
                quest_log: []
            },
            'sparkOfPurity_Tiferet': {
                id: 'sparkOfPurity_Tiferet',
                name: 'Spark of Purity',
                sephirah: 'Tiferet',
                type: 'conceptual',
                description: 'The principle of spiritual cleansing and moral clarity.',
                status: 'required',
                quest_log: []
            },
            'sparkOfVictory_Netzach': {
                id: 'sparkOfVictory_Netzach',
                name: 'Spark of Victory',
                sephirah: 'Netzach',
                type: 'conceptual',
                description: 'The principle of endurance, perseverance, and the will to overcome.',
                status: 'required',
                quest_log: []
            },
            'sparkOfHumility_Hod': {
                id: 'sparkOfHumility_Hod',
                name: 'Spark of Humility', 
                sephirah: 'Hod',
                type: 'animate',
                description: 'The principle of intellectual humility and acknowledgment of divine glory.',
                status: 'required',
                quest_log: []
            },
            'sparkOfFoundation_Yesod': {
                id: 'sparkOfFoundation_Yesod',
                name: 'Spark of Foundation',
                sephirah: 'Yesod',
                type: 'vestigial',
                description: 'The principle of connection, community, and the bridge between worlds.',
                status: 'required',
                quest_log: []
            },
            'sparkOfCommunity_Yesod': {
                id: 'sparkOfCommunity_Yesod',
                name: 'Spark of Community',
                sephirah: 'Yesod',
                type: 'animate',
                description: 'The principle of human connection and collective strength.',
                status: 'required',
                quest_log: []
            },
            'sparkOfManifestation_Malkuth': {
                id: 'sparkOfManifestation_Malkuth',
                name: 'Spark of Manifestation',
                sephirah: 'Malkuth',
                type: 'vestigial',
                description: 'The principle of bringing divine will into material reality.',
                status: 'required',
                quest_log: []
            }
        };
    }

    // Generate complete spark constellation for character
    generateSparkMatrix(characterData) {
        // Log will be available after module initialization
        if (game.bbttccTikkun) {
            game.bbttccTikkun.log(false, "Generating spark matrix for character data:", characterData);
        }

        const assignedSparks = {};
        const usedSparks = new Set();

        // Process each character trait and assign opposing sparks
        for (const [traitType, traitValue] of Object.entries(characterData)) {
            if (!traitValue || !this.sparkMatrix[traitType]) continue;

            const traitData = this.sparkMatrix[traitType][traitValue];
            if (!traitData || usedSparks.has(traitData.opposingSpark)) continue;

            // Get the spark definition
            const sparkDef = this.sparkDefinitions[traitData.opposingSpark];
            if (sparkDef) {
                // Clone the spark definition to avoid mutation
                assignedSparks[traitData.opposingSpark] = {
                    ...sparkDef,
                    assignmentReason: `Character trait: ${traitType} (${traitValue}) → opposing virtue needed`,
                    thematicTension: `${traitValue} strength requires ${sparkDef.name} growth`
                };
                usedSparks.add(traitData.opposingSpark);
            }
        }

        // Ensure minimum constellation size (3-5 sparks as suggested in PDF)
        const minimumSparks = 3;
        if (Object.keys(assignedSparks).length < minimumSparks) {
            this.fillConstellationToMinimum(assignedSparks, usedSparks, minimumSparks);
        }

        // Log constellation generation result
        if (game.bbttccTikkun) {
            game.bbttccTikkun.log(true, `Generated constellation with ${Object.keys(assignedSparks).length} sparks`);
        }
        return assignedSparks;
    }

    // Fill constellation to minimum required sparks
    fillConstellationToMinimum(assignedSparks, usedSparks, minimum) {
        const availableSparks = Object.keys(this.sparkDefinitions).filter(id => !usedSparks.has(id));
        
        // Prioritize different sephiroth for variety
        const sephirothUsed = new Set(Object.values(assignedSparks).map(spark => spark.sephirah));
        const prioritySparks = availableSparks.filter(id => 
            !sephirothUsed.has(this.sparkDefinitions[id].sephirah)
        );

        const sparksToAdd = prioritySparks.length > 0 ? prioritySparks : availableSparks;
        
        while (Object.keys(assignedSparks).length < minimum && sparksToAdd.length > 0) {
            const randomIndex = Math.floor(Math.random() * sparksToAdd.length);
            const sparkId = sparksToAdd.splice(randomIndex, 1)[0];
            
            assignedSparks[sparkId] = {
                ...this.sparkDefinitions[sparkId],
                assignmentReason: 'Minimum constellation requirement',
                thematicTension: 'Additional growth opportunity'
            };
            usedSparks.add(sparkId);
        }
    }

    // Get spark by type (for quest generation)
    getSparksByType(constellation, type) {
        return Object.values(constellation).filter(spark => spark.type === type);
    }

    // Get constellation completion percentage
    getCompletionPercentage(constellation) {
        const totalSparks = Object.keys(constellation).length;
        const gatheredSparks = Object.values(constellation).filter(
            spark => spark.status === 'gathered'
        ).length;
        
        return totalSparks > 0 ? Math.round((gatheredSparks / totalSparks) * 100) : 0;
    }

    // Check if constellation is complete (ready for final ritual)
    isConstellationComplete(constellation) {
        return Object.values(constellation).every(
            spark => spark.status === 'gathered'
        );
    }

    // Get corrupted sparks that need purification
    getCorruptedSparks(constellation) {
        return Object.values(constellation).filter(
            spark => spark.status === 'corrupted'
        );
    }

    // Generate quest hints for identified sparks
    generateQuestHints(spark) {
        const hintTemplates = {
            ['conceptual']: [
                "This spark awaits within the resolution of a great moral choice...",
                "The light you seek shines brightest in moments of righteous action...",
                "Look for the path that embodies this virtue in your dealings with others..."
            ],
            ['vestigial']: [
                "Ancient ruins hold fragments of this divine principle...",
                "Seek the forgotten places where knowledge was once preserved...",
                "The scholars of old left traces of this light in their hidden sanctuaries..."
            ],
            ['animate']: [
                "A wise soul carries this spark within their heart...",
                "Find the one who embodies this virtue and learn from them...", 
                "This light lives within someone who has mastered its principle..."
            ]
        };

        const hints = hintTemplates[spark.type] || [];
        return hints[Math.floor(Math.random() * hints.length)];
    }

    // Validate constellation data integrity
    validateConstellation(constellation) {
        const issues = [];

        for (const [sparkId, spark] of Object.entries(constellation)) {
            if (!spark.id || !spark.name || !spark.sephirah) {
                issues.push(`Spark ${sparkId} missing required fields`);
            }
            
            if (!['required', 'identified', 'active', 'gathered', 'corrupted'].includes(spark.status)) {
                issues.push(`Spark ${sparkId} has invalid status: ${spark.status}`);
            }

            if (!['conceptual', 'vestigial', 'animate'].includes(spark.type)) {
                issues.push(`Spark ${sparkId} has invalid type: ${spark.type}`);
            }
        }

        return {
            valid: issues.length === 0,
            issues: issues
        };
    }

    // Export constellation for sharing/backup
    exportConstellation(constellation) {
        return {
            version: "1.0.0",
            exportedAt: new Date().toISOString(),
            constellation: constellation
        };
    }
}