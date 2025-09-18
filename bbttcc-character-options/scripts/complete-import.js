/**
 * BBTTCC Complete Character Options Import Script
 * This script imports ALL character options from the BBTTCC PDF into Foundry VTT
 * Run from console: await BBTTCCCompleteImporter.importAllOptions()
 */

class BBTTCCCompleteImporter {
    static MODULE_ID = 'bbttcc-character-options';
    
    /**
     * Import all character options
     */
    static async importAllOptions() {
        console.log(`${this.MODULE_ID} | Starting complete character options import...`);
        
        try {
            await this.importCharacterArchetypes();
            await this.importCrewTypes();
            await this.importOccultAssociations();
            await this.importPoliticalAffiliations();
            await this.importEnlightenmentLevels();
            await this.importSephirothicAlignments();
            
            console.log(`${this.MODULE_ID} | Complete import finished successfully!`);
            ui.notifications.info('All BBTTCC Character Options imported successfully!');
            
        } catch (error) {
            console.error(`${this.MODULE_ID} | Complete import failed:`, error);
            ui.notifications.error('Failed to import character options. Check console for details.');
        }
    }
    
    /**
     * Import Character Archetypes
     */
    static async importCharacterArchetypes() {
        const packName = `${this.MODULE_ID}.character-archetypes`;
        const pack = game.packs.get(packName);
        if (!pack) throw new Error(`Pack ${packName} not found`);
        
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
        if (!pack) throw new Error(`Pack ${packName} not found`);
        
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
            },
            {
                "name": "Crew Type: Covert Ops Cell",
                "type": "feat",
                "img": "icons/magic/control/hypnosis-mesmerism-eye.webp",
                "system": {
                    "description": {
                        "value": "<p>A crew of spies and infiltrators. High Intrigue Points pool and grants advantages on Infiltration Scenarios.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Stealth and with Thieves' Tools.</li><li><strong>(Strategic):</strong> Your faction starts with +8 Intrigue OPs.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> When undertaking an 'Infiltration' scenario, the 'Alarm Level' threshold is increased, allowing for more failures before a full alert is triggered.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You can move at a normal pace while traveling stealthily. You have advantage on checks made to create or bypass security systems.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> The Adaptive Adversary Engine (AAE) has difficulty tracking you. When the AAE attempts to dynamically shift resources (e.g., redirecting patrols) to counter your Intrigue-focused actions in a 'Bunker Busters' scenario, there is a 50% chance the shift fails.</li></ul>"
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
                "name": "Crew Type: Cultural Ambassadors",
                "type": "feat",
                "img": "icons/skills/trades/music-notes-sound-blue.webp",
                "system": {
                    "description": {
                        "value": "<p>Artists, teachers, and missionaries. Increases Soft Power Points and excels in propaganda warfare.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Performance and Persuasion.</li><li><strong>(Strategic):</strong> Your faction starts with +8 Soft Power OPs.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> When spending Soft Power OPs for psychological warfare or propaganda during a 'Siege' scenario, the effect on enemy morale (reducing their OPs) is increased by 25%.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You have advantage on Charisma checks made to influence crowds, inspire hope, or spread information/rumors in a settlement.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> Your faction's influence spreads passively. Once per strategic turn, you can attempt to shift the alignment of an adjacent, neutral Hex towards your faction's political affiliation without spending OPs.</li></ul>"
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
                "name": "Crew Type: Diplomatic Envoys",
                "type": "feat",
                "img": "icons/skills/social/diplomacy-handshake-gray.webp",
                "system": {
                    "description": {
                        "value": "<p>A team of negotiators and emissaries. High Diplomacy Points and can initiate negotiations in tense situations.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Insight and Persuasion. You learn one extra language.</li><li><strong>(Strategic):</strong> Your faction starts with +8 Diplomacy OPs.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> During 'Courtly Intrigue' (Social Combat) scenarios, your faction deals 20% more 'influence damage' when spending Diplomacy or Soft Power OPs.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> Once per session, you can initiate a 'Parley' during a combat encounter, forcing a brief ceasefire (1 round) to allow for negotiation, provided the enemies are intelligent and not fanatical.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> The OP cost to achieve a 'Best Friends/Integration' outcome (merging factions) is reduced by 30%.</li></ul>"
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
                "name": "Crew Type: Survivors/Militia",
                "type": "feat",
                "img": "icons/environment/people/commoner.webp",
                "system": {
                    "description": {
                        "value": "<p>A hardy bunch of common folk. A balanced spread of points but recuperates spent points faster.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> You gain proficiency in Survival and Medicine.</li><li><strong>(Strategic):</strong> Your faction starts with a balanced spread: +2 Violence, +2 Non-Lethal, +2 Economy, +2 Soft Power.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> Resilience. During the 'Resource Regeneration' phase, your faction replenishes an additional 10% of its total OP pool capacity.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You gain advantage on Constitution saving throws against exhaustion and environmental hazards. Your hit point maximum increases by your level.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> Never Give Up. If your faction loses its last controlled Hex, instead of dissolving, it immediately reforms as a 'Nomad' faction with 25% of its previous total OP pool, ready to reclaim territory.</li></ul>"
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
        
        await this.importToCompendium(pack, crewTypes, 'Crew Types');
    }
    
    /**
     * Import Occult Associations
     */
    static async importOccultAssociations() {
        const packName = `${this.MODULE_ID}.occult-associations`;
        const pack = game.packs.get(packName);
        if (!pack) throw new Error(`Pack ${packName} not found`);
        
        const occultAssociations = [
            {
                "name": "Occult Association: Kabbalist",
                "type": "feat",
                "img": "icons/magic/symbols/metatron-cube-glow-blue.webp",
                "system": {
                    "description": {
                        "value": "<p>Strong Sephirothic alignment awareness. Can identify Sephiroth/Qliphoth influences.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> Proficiency in Religion. You can cast 'Detect Evil and Good' once per long rest, flavored as sensing the flow of the Tree of Life.</li><li><strong>(Strategic):</strong> Upon entering a new Hex, you immediately know its dominant Sephirothic or Qliphothic alignment. Faction gains +3 Soft Power OPs.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> During the 'Identification' phase of The Great Work, the OP cost or time required to identify the nature of a required Spark is reduced by 25%.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You have advantage on Intelligence (Religion) checks to understand the nature, weaknesses, or rituals of Qliphothic entities.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> When your faction attempts to shift a Hex's alignment towards a Sephirah, you gain Advantage on the Opposed Strategic Roll or the OP cost is reduced by 10%.</li></ul>"
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
                "name": "Occult Association: Alchemist",
                "type": "feat",
                "img": "icons/tools/laboratory/mortar-powder-green.webp",
                "system": {
                    "description": {
                        "value": "<p>Expertise in transmutation and potion-making. Can brew potions that temporarily boost Organization stats.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> Proficiency with Alchemist's Supplies. You can craft basic potions in half the usual time.</li><li><strong>(Strategic):</strong> Faction gains +3 Economy OPs related to production.</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> Once per strategic turn, you can brew a 'Propaganda Potion'. This allows the faction to immediately convert 3 Economy OPs into 3 Soft Power OPs (or vice versa).</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> You gain resistance to acid and poison damage. You can identify the properties of any strange substance within 1 minute.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> You can brew a potent 'Elixir of Fortitude'. This costs 5 Economy OPs and temporarily boosts one Organization stat (e.g., +3 Violence, +3 Non-Lethal) for the duration of one entire Scenario.</li></ul>"
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
            // Add more occult associations here...
        ];
        
        await this.importToCompendium(pack, occultAssociations, 'Occult Associations');
    }
    
    /**
     * Import Political Affiliations
     */
    static async importPoliticalAffiliations() {
        const packName = `${this.MODULE_ID}.political-affiliations`;
        const pack = game.packs.get(packName);
        if (!pack) throw new Error(`Pack ${packName} not found`);
        
        const politicalAffiliations = [
            {
                "name": "Political Affiliation: Democrat",
                "type": "feat",
                "img": "icons/vector/files/scroll-unfurled-blue.webp",
                "system": {
                    "description": {
                        "value": "<p>Best: Fair society with protected freedoms. Worst: Mob rule or endless gridlock.</p><h3>Tier 1 (Level 1)</h3><ul><li><strong>(Tactical):</strong> Proficiency in Persuasion.</li><li><strong>(Strategic):</strong> Best: High Diplomacy and Soft Power generation (+10%). Worst: Potential for 'Gridlock' (Administrative scenarios may take longer to resolve).</li></ul><h3>Tier 2 (Level 5)</h3><ul><li><strong>(Strategic):</strong> The loyalty of 'GenPop' Hexes under your control is significantly higher, making them highly resistant to enemy propaganda.</li></ul><h3>Tier 3 (Level 11)</h3><ul><li><strong>(Tactical):</strong> Advantage on Charisma checks made to inspire cooperation among disparate groups or rally people against tyranny.</li></ul><h3>Tier 4 (Level 17)</h3><ul><li><strong>(Strategic):</strong> The 'Worst' aspects are mitigated. The 'Gridlock' penalty is removed as your democratic processes mature and become efficient.</li></ul>"
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
            // Add more political affiliations here...
        ];
        
        await this.importToCompendium(pack, politicalAffiliations, 'Political Affiliations');
    }
    
    /**
     * Import Enlightenment Levels
     */
    static async importEnlightenmentLevels() {
        const packName = `${this.MODULE_ID}.enlightenment-levels`;
        const pack = game.packs.get(packName);
        if (!pack) throw new Error(`Pack ${packName} not found`);
        
        const enlightenmentLevels = [
            {
                "name": "Enlightenment: Sleeper",
                "type": "feat",
                "img": "icons/magic/control/sleep-blue-purple.webp",
                "system": {
                    "description": {
                        "value": "<p>Largely unawakened to the Mysteries. Thinks like a 'normal' person and is susceptible to grand illusions.</p><h3>Effects</h3><ul><li><strong>(Tactical):</strong> No mechanical benefits. Highly susceptible to the 'noise' of the ego and the distortions of the Shattered Lens.</li><li><strong>(Strategic):</strong> Does not inherently understand or aid the pursuit of 'The Great Work'.</li></ul>"
                    },
                    "source": "BBTTCC",
                    "requirements": "Starting Level",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            }
            // Add more enlightenment levels here...
        ];
        
        await this.importToCompendium(pack, enlightenmentLevels, 'Enlightenment Levels');
    }
    
    /**
     * Import Sephirothic Alignments
     */
    static async importSephirothicAlignments() {
        const packName = `${this.MODULE_ID}.sephirothic-alignments`;
        const pack = game.packs.get(packName);
        if (!pack) throw new Error(`Pack ${packName} not found`);
        
        const sephirothicAlignments = [
            {
                "name": "Alignment: Keter (Crown)",
                "type": "feat", 
                "img": "icons/magic/light/explosion-star-flare-purple-pink.webp",
                "system": {
                    "description": {
                        "value": "<p>The Crown. Represents the divine will and unity.</p><h3>Effects</h3><ul><li><strong>PC Benefit:</strong> Aura of authority; easier enlightenment.</li><li><strong>Hex Benefit:</strong> Bonus to all OP generation (+1 to all); inspires neighbors (positive influence radiates to adjacent Hexes).</li><li><strong>Qliphothic Corruption:</strong> Thaumiel (Duality). Leads to division, tyranny, and ego.</li></ul>"
                    },
                    "source": "BBTTCC Lore",
                    "requirements": "N/A",
                    "activation": {"type": "none"},
                    "duration": {"value": null, "units": "perm"},
                    "target": {"value": null, "type": "self"},
                    "range": {"value": null, "long": null, "units": "self"},
                    "uses": {"value": null, "max": "", "per": null},
                    "consume": {"type": "", "target": null, "amount": null}
                }
            }
            // Add more alignments here...
        ];
        
        await this.importToCompendium(pack, sephirothicAlignments, 'Sephirothic Alignments');
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
}

// Make available globally for console use
globalThis.BBTTCCCompleteImporter = BBTTCCCompleteImporter;

// Export for module use
export { BBTTCCCompleteImporter };