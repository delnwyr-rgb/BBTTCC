/**
 * BBTTCC Character Options Import Script
 * Populates compendium packs with character options from JSON data
 * Run this script from the Foundry VTT console to import all character options
 */

class BBTTCCCharacterOptionsImporter {
    static MODULE_ID = 'bbttcc-character-options';
    
    /**
     * Import all character options into compendium packs
     */
    static async importAllOptions() {
        console.log(`${this.MODULE_ID} | Starting character options import...`);
        
        try {
            // Import each category
            await this.importCharacterArchetypes();
            await this.importCrewTypes();
            await this.importOccultAssociations();
            await this.importPoliticalAffiliations();
            await this.importEnlightenmentLevels();
            await this.importSephirothicAlignments();
            
            console.log(`${this.MODULE_ID} | All character options imported successfully!`);
            ui.notifications.info('BBTTCC Character Options imported successfully!');
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Import failed:`, error);
            ui.notifications.error('Failed to import character options. Check console for details.');
        }
    }
    
    /**
     * Import Character Archetypes
     */
    static async importCharacterArchetypes() {
        const packName = `${this.MODULE_ID}.character-archetypes`;
        const pack = game.packs.get(packName);
        if (!pack) {
            throw new Error(`Pack ${packName} not found`);
        }
        
        const archetypes = [
            {
                "name": "Archetype: Warlord",
                "type": "feat",
                "img": "icons/sundries/flags/banner-worn-frayed-red.webp",
                "system": {
                    "description": {
                        "value": "<p>A hardened battlefield commander from the Wastes. Begins with extra followers and a higher Violence cap.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Intimidation and Athletics.</li><li><strong>(Strategic):</strong> Your faction's Violence OP cap increases by 3.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> When leading a 'Siege' or 'Battlefield' scenario, the first time your faction spends Violence OPs in a round, the expenditure is reduced by 1 (minimum 1).</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You have advantage on saving throws against being frightened. When you reduce an enemy to 0 hit points, you can use your reaction to direct an ally within 30 feet to make one weapon attack.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> During 'Siege & Battlefield' scenarios, any Opposed Strategic Roll made by your faction using Violence OPs is made with Advantage.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            },
            {
                "name": "Archetype: Hierophant",
                "type": "feat",
                "img": "icons/magic/holy/angel-winged-humanoid-blue.webp",
                "system": {
                    "description": {
                        "value": "<p>A spiritual leader. Possesses deep occult knowledge and boosts Soft Power Points generation.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Religion and Insight. You learn the <em>Guidance</em> cantrip.</li><li><strong>(Strategic):</strong> Your faction's Soft Power OP cap increases by 3.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> When spending Soft Power OPs to raise population loyalty or inspire troops during a Siege, the effectiveness of the spent OPs is increased by 25%.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You have advantage on saving throws against effects caused by Qliphothic entities (Fiends, Aberrations) and effects related to the Darkness Track.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> Your spiritual authority aids Tikkun Olam. The OP cost or time required to shift a Hex's alignment towards a beneficial Sephirah is reduced by 20%.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            },
            {
                "name": "Archetype: Mayor/Administrator",
                "type": "feat",
                "img": "icons/skills/trades/academics-merchant-scribe.webp",
                "system": {
                    "description": {
                        "value": "<p>A civic leader who kept a city or bunker running. Master of logistics who provides a bonus to Economy Points.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Investigation and Persuasion.</li><li><strong>(Strategic):</strong> Your faction's Economy OP cap increases by 3.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> During the 'Resource Regeneration' phase of the Strategic Turn, your faction generates 1 additional Economy OP for every three Hexes controlled (rounded down, minimum 1 extra).</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You have advantage on Intelligence checks related to logistics, trade routes, or deciphering bureaucracy. You are adept at finding resources; when searching for supplies in urban areas, you find twice as much.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> When resolving a 'Policy & Crisis Management (Administrative)' scenario, you gain Advantage on all relevant skill checks.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            },
            {
                "name": "Archetype: Wizard/Scholar",
                "type": "feat",
                "img": "icons/skills/trades/academics-book-study-purple.webp",
                "system": {
                    "description": {
                        "value": "<p>A holdover from the old world of magic. Has a personal library and gains extra lore knowledge.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Arcana and History. You learn one cantrip from the Wizard spell list.</li><li><strong>(Strategic):</strong> Your faction's Intrigue OP cap increases by 2. Your faction starts with a 'Personal Library' Base Asset.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> During the 'Identification' phase of The Great Work, the time or resources required to uncover the nature of an assigned Spark (Conceptual, Vestigial, or Animate) is halved.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> When you make an Intelligence check related to lore, magic, or old-world history, you can treat a d20 roll of 9 or lower as a 10.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> When undertaking an 'Asset Retrieval' scenario to recover lost knowledge (e.g., blueprints, ancient texts), the Intrigue OP cost is reduced by 3.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            },
            {
                "name": "Archetype: Ancient Blood",
                "type": "feat",
                "img": "icons/magic/life/cross-life-ankh-gold-red.webp",
                "system": {
                    "description": {
                        "value": "<p>Descends from a mythical lineage. Starts with a unique trait (e.g., psychic gifts) and confers a boon to controlled regions.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You learn the <em>Message</em> cantrip (flavored as minor telepathy). You gain proficiency in History.</li><li><strong>(Strategic):</strong> Your faction's Soft Power OP cap increases by 2.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> Controlled Hexes gain a bonus to stability checks due to the reverence of your lineage, making them resistant to enemy Soft Power attacks.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You can cast <em>Detect Thoughts</em> once per long rest without expending a spell slot. You have advantage on saving throws against being charmed.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> When your faction achieves a 'Justice/Reformation' outcome, the resulting Hex immediately aligns one step closer to Keter (Crown) or Tiferet (Harmony).</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            },
            {
                "name": "Archetype: Squad Leader",
                "type": "feat",
                "img": "icons/skills/social/wave-halt-stop.webp",
                "system": {
                    "description": {
                        "value": "<p>A military specialist who led a small elite team. Gains reliable NPC squadmates and provides a small boost to Violence and Intrigue Points.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Survival and Perception.</li><li><strong>(Strategic):</strong> Your faction's Violence OP cap and Intrigue OP cap increase by 1 each.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> You gain 2 Reliable NPC squadmates (use 'Guard' or 'Scout' stats). If they die, they can be replaced during the next strategic turn at the cost of 2 Non-Lethal OPs.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You can use the 'Help' action as a bonus action during combat, provided the target is an allied NPC or squadmate.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> When undertaking a 'Bunker Busters' (Strategic Raid) scenario, your presence and squad grant Advantage to the Opposed Strategic Roll.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            }
        ];
        
        await this.importToCompendium(pack, archetypes, 'Character Archetypes');
    }
    
    /**
     * Import Crew Types
     */
    static async importCrewTypes() {
        const packName = `${this.MODULE_ID}.crew-types`;
        const pack = game.packs.get(packName);
        if (!pack) {
            throw new Error(`Pack ${packName} not found`);
        }
        
        const crewTypes = [
            {
                "name": "Crew Type: Mercenary Band",
                "type": "feat",
                "img": "icons/skills/melee/swords-crossed-steel-bronze.webp",
                "system": {
                    "description": {
                        "value": "<p>Tough fighters-for-hire. High starting Violence Points and bonuses in combat scenarios.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency with Medium Armor and one Martial Weapon of your choice.</li><li><strong>(Strategic):</strong> Your faction starts with +8 Violence OPs. Starting Diplomacy OPs are reduced by 3.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> During 'Siege & Battlefield' scenarios, when your faction commits Violence OPs, they gain a +1 bonus to the Opposed Strategic Roll.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> When you score a critical hit with a weapon attack, you gain temporary hit points equal to your character level.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> The 'Violence Point Attrition' (war-weariness) mechanic affects your faction 50% less than normal. The cost to replenish Violence OPs is reduced by 10%.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            },
            {
                "name": "Crew Type: Peacekeeper Corps",
                "type": "feat",
                "img": "icons/magic/defensive/shield-barrier-glowing-blue.webp",
                "system": {
                    "description": {
                        "value": "<p>A crew oriented toward security and order. Raises Non-Lethal Force Points and excels at defensive actions.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Insight and Investigation.</li><li><strong>(Strategic):</strong> Your faction starts with +8 Non-Lethal OPs.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> In 'Tower Trashers' (Tactical Defense) scenarios, your faction's defensive structures have 25% more durability against the AI Physics Engine simulations, and 'Demolition' units are less effective.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You have advantage on Charisma (Persuasion) checks made to de-escalate violence or negotiate a surrender. You have advantage on checks to grapple or restrain.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> Controlled Hexes are highly stable. The OP cost to prevent rebellion in 'Triumphant' Hexes is reduced by 2. It is easier to shift Hexes towards Gevurah (Severity/Order).</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Character Creation",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            }
            // Continue with other crew types...
        ];
        
        await this.importToCompendium(pack, crewTypes, 'Crew Types');
    }
    
    /**
     * Generic import function for any compendium
     */
    static async importToCompendium(pack, items, categoryName) {
        console.log(`${this.MODULE_ID} | Importing ${categoryName}...`);
        
        // Clear existing items in pack
        const existingItems = await pack.getDocuments();
        if (existingItems.length > 0) {
            const deleteIds = existingItems.map(item => item.id);
            await pack.deleteEmbeddedDocuments('Item', deleteIds);
            console.log(`${this.MODULE_ID} | Cleared ${deleteIds.length} existing items from ${categoryName}`);
        }
        
        // Import new items
        const createData = items.map(item => ({
            ...item,
            folder: null,
            sort: 0
        }));
        
        const createdItems = await pack.createEmbeddedDocuments('Item', createData);
        console.log(`${this.MODULE_ID} | Created ${createdItems.length} ${categoryName}`);
        
        return createdItems;
    }
    
    // Placeholder methods for other categories
    static async importOccultAssociations() {
        console.log(`${this.MODULE_ID} | Occult Associations import - placeholder`);
    }
    
    static async importPoliticalAffiliations() {
        console.log(`${this.MODULE_ID} | Political Affiliations import - placeholder`);
    }
    
    static async importEnlightenmentLevels() {
        console.log(`${this.MODULE_ID} | Enlightenment Levels import - placeholder`);
    }
    
    static async importSephirothicAlignments() {
        console.log(`${this.MODULE_ID} | Sephirothic Alignments import - placeholder`);
    }
}

// Make available globally for console use
globalThis.BBTTCCCharacterOptionsImporter = BBTTCCCharacterOptionsImporter;

// Export for module use
export { BBTTCCCharacterOptionsImporter };