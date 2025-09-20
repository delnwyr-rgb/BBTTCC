/**
 * BBTTCC Auto-Link Module
 * Persistent module that automatically links BBTTCC character creation to faction OPs
 * Loads on game boot and persists through restarts
 */

class BBTTCCAutoLink {
    static MODULE_ID = 'bbttcc-auto-link';
    static VERSION = '1.0.0';

    /**
     * Initialize the module on Foundry ready
     */
    static async initialize() {
        console.log(`${this.MODULE_ID} | Initializing Auto-Link Module v${this.VERSION}`);

        try {
            // Wait for required modules to be ready
            await this.waitForDependencies();

            // Initialize character tab system
            await this.initializeCharacterTabs();

            // Setup hooks
            this.setupHooks();

            // Create API
            this.createAPI();

            console.log(`${this.MODULE_ID} | Successfully initialized and ready for auto-linking`);
            ui.notifications.info("BBTTCC Auto-Link module loaded - Character OPs will auto-apply to factions");

        } catch (error) {
            console.error(`${this.MODULE_ID} | Failed to initialize:`, error);
            ui.notifications.error("BBTTCC Auto-Link failed to initialize");
        }
    }

    /**
     * Wait for required BBTTCC modules to be ready
     */
    static async waitForDependencies() {
        const requiredModules = ['bbttcc-factions', 'bbttcc-territory', 'bbttcc-character-options'];

        for (const moduleId of requiredModules) {
            const module = game.modules.get(moduleId);
            if (!module || !module.active) {
                throw new Error(`Required module ${moduleId} is not active`);
            }
        }

        // Wait a moment for modules to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log(`${this.MODULE_ID} | All dependencies ready`);
    }

    /**
     * Initialize Foundry v13 character tab system
     */
    static async initializeCharacterTabs() {
        console.log(`${this.MODULE_ID} | Character tab system handled by bbttcc-foundry-v13-tabs.js`);
        console.log(`${this.MODULE_ID} | Tab system will initialize on Foundry ready hook`);
    }

    /**
     * Setup all hooks for character creation auto-linking
     */
    static setupHooks() {
        console.log(`${this.MODULE_ID} | Setting up auto-link hooks...`);

        // Hook 1: Character creation
        Hooks.on('createActor', async (actor, options, userId) => {
            if (actor.type === 'character') {
                console.log(`${this.MODULE_ID} | New character created: ${actor.name}`);

                // Delay to allow BBTTCC modules to process
                setTimeout(async () => {
                    await this.processNewCharacter(actor);
                }, 2000);
            }
        });

        // Hook 2: BBTTCC feat items added
        Hooks.on('createItem', async (item, options, userId) => {
            if (item.type === 'feat' && item.parent?.type === 'character') {
                const name = item.name.toLowerCase();

                if (this.isBBTTCCFeat(name)) {
                    console.log(`${this.MODULE_ID} | BBTTCC feat added: ${item.name} to ${item.parent.name}`);

                    setTimeout(async () => {
                        await this.processCharacterOPs(item.parent);
                    }, 1000);
                }
            }
        });

        // Hook 3: Faction assignment changes
        Hooks.on('updateActor', async (actor, changes, options, userId) => {
            if (actor.type === 'character' && changes.flags) {
                const territoryChanges = changes.flags?.['bbttcc-territory'];

                if (territoryChanges?.faction) {
                    console.log(`${this.MODULE_ID} | ${actor.name} assigned to faction: ${territoryChanges.faction}`);

                    setTimeout(async () => {
                        await this.processCharacterOPs(actor);
                    }, 1000);
                }
            }
        });

        // Hook 4: Sheet rendering fallback
        Hooks.on('renderActorSheet', async (sheet, html, data) => {
            if (sheet.actor.type === 'character') {
                const actor = sheet.actor;
                const factionName = actor.getFlag("bbttcc-territory", "faction");

                if (factionName && await this.needsOPProcessing(actor)) {
                    console.log(`${this.MODULE_ID} | Processing OPs for ${actor.name} on sheet render`);
                    await this.processCharacterOPs(actor);
                }
            }
        });

        // Hook 5: Listen for manual triggers
        Hooks.on(`${this.MODULE_ID}.processCharacter`, async (actor) => {
            await this.processCharacterOPs(actor);
        });

        console.log(`${this.MODULE_ID} | All hooks registered successfully`);
    }

    /**
     * Check if a feat name indicates it's a BBTTCC feat
     */
    static isBBTTCCFeat(name) {
        return name.includes('archetype:') ||
               name.includes('crew type:') ||
               name.includes('occult association:') ||
               name.includes('political affiliation:') ||
               name.includes('enlightenment:');
    }

    /**
     * Process a newly created character
     */
    static async processNewCharacter(actor) {
        const factionName = this.getCharacterFaction(actor);

        if (!factionName) {
            console.log(`${this.MODULE_ID} | ${actor.name} has no faction assignment yet`);
            return;
        }

        const bbttccFeats = this.getBBTTCCFeats(actor);

        if (bbttccFeats.length === 0) {
            console.log(`${this.MODULE_ID} | ${actor.name} has no BBTTCC feats yet`);
            return;
        }

        console.log(`${this.MODULE_ID} | ${actor.name} has ${bbttccFeats.length} BBTTCC feats and faction ${factionName} - processing OPs`);
        await this.processCharacterOPs(actor);
    }

    /**
     * Main function to process character OPs and apply to faction
     */
    static async processCharacterOPs(actor) {
        try {
            const characterOPs = this.calculateOPsFromFeats(actor);
            const totalOPs = Object.values(characterOPs).reduce((sum, val) => sum + Math.abs(val), 0);

            if (totalOPs === 0) {
                console.log(`${this.MODULE_ID} | ${actor.name} has no OP contributions`);
                return;
            }

            console.log(`${this.MODULE_ID} | ${actor.name} contributes ${totalOPs} total OPs:`, characterOPs);

            await this.applyOPsToFaction(actor, characterOPs);

            // Trigger dashboard updates
            Hooks.callAll("bbttcc.factionOPsUpdated");

            console.log(`${this.MODULE_ID} | ✅ Successfully processed OPs for ${actor.name}`);

        } catch (error) {
            console.error(`${this.MODULE_ID} | Error processing OPs for ${actor.name}:`, error);
        }
    }

    /**
     * Calculate OPs from character's BBTTCC feats
     */
    static calculateOPsFromFeats(character) {
        const ops = {
            violence: 0, diplomacy: 0, economy: 0, intrigue: 0,
            logistics: 0, culture: 0, faith: 0,
            softpower: 0, nonlethal: 0
        };

        character.items.forEach(item => {
            if (item.type !== 'feat') return;

            const description = item.system?.description?.value || '';

            // Parse OP bonuses from descriptions using robust regex
            const opMatches = description.match(/([+-]?\d+)\s*(Violence|Diplomacy|Economy|Intrigue|Logistics|Culture|Faith|Soft\s?Power|Non-?Lethal)\s*OPs?/gi);

            if (opMatches) {
                opMatches.forEach(match => {
                    const parts = match.match(/([+-]?\d+)\s*(Violence|Diplomacy|Economy|Intrigue|Logistics|Culture|Faith|Soft\s?Power|Non-?Lethal)/i);
                    if (parts) {
                        const value = parseInt(parts[1]);
                        const opType = parts[2].toLowerCase().replace(/\s/g, '').replace(/-/g, '');

                        const opTypeMap = {
                            'violence': 'violence',
                            'diplomacy': 'diplomacy',
                            'economy': 'economy',
                            'intrigue': 'intrigue',
                            'logistics': 'logistics',
                            'culture': 'culture',
                            'faith': 'faith',
                            'softpower': 'softpower',
                            'nonlethal': 'nonlethal'
                        };

                        const standardOpType = opTypeMap[opType];
                        if (standardOpType && ops.hasOwnProperty(standardOpType)) {
                            ops[standardOpType] += value;
                        }
                    }
                });
            }
        });

        return ops;
    }

    /**
     * Apply character OPs to their assigned faction
     */
    static async applyOPsToFaction(character, characterOPs) {
        const factionName = this.getCharacterFaction(character);
        if (!factionName) {
            console.log(`${this.MODULE_ID} | ${character.name} has no faction assignment`);
            return;
        }

        const faction = game.actors.getName(factionName);
        if (!faction) {
            console.log(`${this.MODULE_ID} | Faction ${factionName} not found`);
            return;
        }

        // Get current faction OPs structure - use only the complex ops structure
        const currentComplexOPs = faction.getFlag("bbttcc-factions", "ops") || {};

        // Convert complex structure to simple for calculations
        const currentOPs = {};
        Object.entries(currentComplexOPs).forEach(([key, op]) => {
            currentOPs[key] = op?.value || 0;
        });

        // Get member contributions for tracking
        const memberContributions = faction.getFlag("bbttcc-factions", "memberContributions") || {};

        // Remove previous contribution from this character
        const previousContribution = memberContributions[character.id] || {};
        Object.entries(previousContribution).forEach(([opType, value]) => {
            if (currentOPs[opType] !== undefined) {
                currentOPs[opType] -= value;
            }
        });

        // Add new contribution
        Object.entries(characterOPs).forEach(([opType, value]) => {
            if (currentOPs[opType] !== undefined) {
                currentOPs[opType] += value;
            }
        });

        // Create updated complex OP structure for faction sheets
        const updatedComplexOPs = {};
        Object.entries(currentOPs).forEach(([opType, value]) => {
            updatedComplexOPs[opType] = {
                value: value,
                max: currentComplexOPs[opType]?.max || 10  // Preserve existing max values
            };
        });

        // Update faction with ONLY the complex ops structure (no more dual system)
        await faction.setFlag("bbttcc-factions", "ops", updatedComplexOPs);
        await faction.setFlag("bbttcc-factions", "memberContributions", {
            ...memberContributions,
            [character.id]: characterOPs
        });
        await faction.setFlag("bbttcc-factions", "isFaction", true);

        const totalOPs = Object.values(currentOPs).reduce((sum, val) => sum + Math.abs(val), 0);
        console.log(`${this.MODULE_ID} | ${factionName} now has ${totalOPs} total OPs`);

        // Force display refresh
        await this.forceDisplayRefresh(faction);
    }

    /**
     * Get character's faction assignment
     */
    static getCharacterFaction(actor) {
        return actor.getFlag("bbttcc-territory", "faction") ||
               actor.getFlag("bbttcc-territory", "bbttccEnhancements")?.territoryAffiliation;
    }

    /**
     * Get all BBTTCC feats from character
     */
    static getBBTTCCFeats(actor) {
        return actor.items.filter(item => {
            if (item.type !== 'feat') return false;
            return this.isBBTTCCFeat(item.name.toLowerCase());
        });
    }

    /**
     * Check if character needs OP processing
     */
    static async needsOPProcessing(actor) {
        const factionName = this.getCharacterFaction(actor);
        if (!factionName) return false;

        const faction = game.actors.getName(factionName);
        if (!faction) return false;

        const memberContributions = faction.getFlag("bbttcc-factions", "memberContributions") || {};
        const hasContribution = memberContributions[actor.id] !== undefined;

        const expectedOPs = this.calculateOPsFromFeats(actor);
        const hasExpectedOPs = Object.values(expectedOPs).reduce((sum, val) => sum + Math.abs(val), 0) > 0;

        return hasExpectedOPs && !hasContribution;
    }

    /**
     * Force faction display refresh to sync UI with updated data
     */
    static async forceDisplayRefresh(faction) {
        console.log(`${this.MODULE_ID} | Forcing display refresh for ${faction.name}`);

        try {
            // CRITICAL: Ensure data structure consistency before refreshing
            await this.syncDataStructures(faction);

            // Force actor re-render
            await faction.update({}, { render: true });

            // Refresh any open faction sheets
            Object.values(ui.windows).forEach(window => {
                if (window.actor && window.actor.id === faction.id) {
                    console.log(`${this.MODULE_ID} | Refreshing open faction sheet`);
                    window.render(true);
                }
            });

            // Trigger BBTTCC-specific refresh hooks
            Hooks.callAll("bbttcc.factionOPsUpdated", faction);
            Hooks.callAll("bbttcc-factions.updated", faction);

            // Comprehensive dashboard refresh
            await this.refreshDashboard();

            // Refresh dashboard windows
            Object.values(ui.windows).forEach(window => {
                if (window.element && window.element.find('.bbttcc-dashboard').length > 0) {
                    console.log(`${this.MODULE_ID} | Refreshing dashboard window`);
                    window.render(true);
                }
            });

            console.log(`${this.MODULE_ID} | Display refresh completed for ${faction.name}`);

        } catch (error) {
            console.error(`${this.MODULE_ID} | Error during display refresh:`, error);
        }
    }

    /**
     * Sync data structures - now only validates the single ops structure
     */
    static async syncDataStructures(faction) {
        console.log(`${this.MODULE_ID} | Validating data structure for ${faction.name}`);

        // Get the ops structure (now the only source of truth)
        const ops = faction.getFlag("bbttcc-factions", "ops");
        if (!ops) {
            console.log(`${this.MODULE_ID} | No ops structure found for ${faction.name}`);
            return;
        }

        // Calculate total for reporting
        const total = Object.values(ops).reduce((sum, op) => sum + (op?.value || 0), 0);
        console.log(`${this.MODULE_ID} | Validated ops structure with ${total} total OPs`);

        // Remove any lingering organizationPoints structure
        const organizationPoints = faction.getFlag("bbttcc-factions", "organizationPoints");
        if (organizationPoints) {
            console.log(`${this.MODULE_ID} | Removing obsolete organizationPoints structure`);
            await faction.unsetFlag("bbttcc-factions", "organizationPoints");
        }
    }

    /**
     * Comprehensive dashboard refresh
     */
    static async refreshDashboard() {
        console.log(`${this.MODULE_ID} | Refreshing BBTTCC Dashboard...`);

        try {
            // Method 1: Try BBTTCCDashboard if available
            if (window.BBTTCCDashboard && window.BBTTCCDashboard.refresh) {
                await window.BBTTCCDashboard.refresh();
                console.log(`${this.MODULE_ID} | Refreshed via BBTTCCDashboard.refresh()`);
            }

            // Method 2: Try BBTTCCGUISystem
            if (window.BBTTCCGUISystem) {
                if (window.BBTTCCGUISystem.refresh) {
                    await window.BBTTCCGUISystem.refresh();
                    console.log(`${this.MODULE_ID} | Refreshed via BBTTCCGUISystem.refresh()`);
                }
                if (window.BBTTCCGUISystem.render) {
                    await window.BBTTCCGUISystem.render(true);
                    console.log(`${this.MODULE_ID} | Re-rendered via BBTTCCGUISystem.render()`);
                }
            }

            // Method 3: Force re-render any open dashboard windows
            Object.values(ui.windows).forEach(window => {
                if (window.title && (
                    window.title.includes('BBTTCC') ||
                    window.title.includes('Dashboard') ||
                    window.title.includes('Campaign')
                )) {
                    console.log(`${this.MODULE_ID} | Force refreshing window: ${window.title}`);
                    window.render(true);
                }
            });

            // Method 4: Trigger global refresh hooks
            Hooks.callAll("renderApplication");
            Hooks.callAll("bbttcc.dashboardRefresh");

        } catch (error) {
            console.error(`${this.MODULE_ID} | Error refreshing dashboard:`, error);
        }
    }

    /**
     * Create module API
     */
    static createAPI() {
        // Create global API
        window.BBTTCCAutoLink = {
            processCharacter: this.processCharacterOPs.bind(this),
            processAllCharacters: async () => {
                const characters = game.actors.contents.filter(actor =>
                    actor.type === 'character' && this.getCharacterFaction(actor)
                );

                console.log(`${this.MODULE_ID} | Processing ${characters.length} characters...`);

                for (const character of characters) {
                    await this.processCharacterOPs(character);
                }

                console.log(`${this.MODULE_ID} | Completed processing all characters`);
            },
            refreshAllFactionDisplays: async () => {
                const factions = game.actors.contents.filter(actor =>
                    actor.getFlag("bbttcc-factions", "isFaction")
                );

                console.log(`${this.MODULE_ID} | Refreshing ${factions.length} faction displays...`);

                for (const faction of factions) {
                    await this.forceDisplayRefresh(faction);
                }

                console.log(`${this.MODULE_ID} | All faction displays refreshed`);
            },
            refreshFactionDisplay: this.forceDisplayRefresh.bind(this),
            refreshDashboard: this.refreshDashboard.bind(this),
            calculateOPs: this.calculateOPsFromFeats.bind(this),
            version: this.VERSION,
            moduleId: this.MODULE_ID
        };

        // Expose via module
        const module = game.modules.get(this.MODULE_ID);
        if (module) {
            module.api = window.BBTTCCAutoLink;
        }

        console.log(`${this.MODULE_ID} | API created and exposed`);
    }
}

// Initialize when Foundry is ready
Hooks.once('ready', () => {
    BBTTCCAutoLink.initialize();
});

// Export for module system
export default BBTTCCAutoLink;