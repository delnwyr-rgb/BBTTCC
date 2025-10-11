// =========================================================================
// == BBTTCC Factions & GUI - V2.6 - Add Template to Faction Sheet
// =========================================================================

console.log('🏁 BBTTCC Factions & GUI | Final consolidated module loading...');

class BBTTCCWorkingDashboard extends Application {
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-dashboard-working",
            title: "BBTTCC Campaign Dashboard",
            template: "modules/bbttcc-factions/templates/dashboard.html",
            width: 500,
            height: "auto",
            resizable: true,
            classes: ["dnd5e", "bbttcc-app"]
        });
    }

    getData(options = {}) {
        const factions = game.actors.filter(a => a.getFlag('bbttcc-factions', 'isFaction'));
        
        return {
            factions: factions,
            totalFactions: factions.length
        };
    }
}

class BBTTCCFactionSheet extends dnd5e.applications.actor.NPCActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            // FIX: Point the custom sheet to the default NPC HTML template for now.
            template: "systems/dnd5e/templates/actors/npc-sheet.hbs",
            classes: ["dnd5e", "sheet", "actor", "npc", "bbttcc-faction-sheet"]
        });
    }
}

class BBTTCCFactionsModule {
    static ID = 'bbttcc-factions';
    
    static initialize() {
        console.log(`[${this.ID}] | Initializing.`);
        
        console.log("BBTTCC Factions | Attempting to register BBTTCCFactionSheet...");
        foundry.applications.apps.DocumentSheetConfig.registerSheet(dnd5e.documents.Actor5e, "dnd5e", BBTTCCFactionSheet, {
            types: ["npc"],
            makeDefault: false,
            label: "BBTTCC Faction Sheet"
        });

        Hooks.once('ready', () => {
            console.log(`[${this.ID}] | Ready hook: Checking existing actors for correct faction sheet.`);
            for (const actor of game.actors) {
                if (actor.getFlag(this.ID, 'isFaction')) {
                    const currentSheet = actor.getFlag('core', 'sheetClass');
                    if (currentSheet !== 'dnd5e.BBTTCCFactionSheet') {
                        console.log(`[${this.ID}] | Updating sheet for existing faction: ${actor.name}`);
                        actor.setFlag('core', 'sheetClass', 'dnd5e.BBTTCCFactionSheet');
                    }
                }
            }
        });

        Hooks.on("createActor", async (actor, options, userId) => {
            if (userId !== game.user.id) return;
            if (actor.getFlag(this.ID, 'isFaction')) {
                console.log(`[${this.ID}] | Applying Faction Sheet to newly created actor: ${actor.name}`);
                await actor.setFlag('core', 'sheetClass', 'dnd5e.BBTTCCFactionSheet');
                if (actor.sheet.rendered) {
                    actor.sheet.close();
                    actor.sheet.render(true);
                }
            }
        });

        this.exposeAPI();
    }

    static exposeAPI() {
        const api = {
            openDashboard: () => {
                new BBTTCCWorkingDashboard().render(true);
            },
            createFaction: async (data) => {
                if (!data.name?.trim()) return ui.notifications.warn("Faction name cannot be empty.");
                
                const actorData = {
                    name: data.name,
                    type: "npc",
                    flags: {
                        'bbttcc-factions': { isFaction: true },
                        'core': { 'sheetClass': 'dnd5e.BBTTCCFactionSheet' }
                    }
                };
                
                try {
                    console.log(`BBTTCC Factions | Creating new faction: ${actorData.name}`);
                    const newActor = await Actor.create(actorData);
                    ui.notifications.info(`Faction "${data.name}" created successfully.`);
                    newActor?.sheet.render(true);
                } catch(e) {
                    console.error("BBTTCC | Failed to create faction", e);
                    ui.notifications.error("Failed to create faction. See console for details.");
                }
            }
        };
        game.modules.get(this.ID).api = api;
        console.log(`[${this.ID}] | API exposed.`);
    }
}

Hooks.once('init', () => BBTTCCFactionsModule.initialize());