// =========================================================================
// == BBTTCC Auto-Link & Enhanced Sheet - V3.0 - Faction Deconfliction
// =========================================================================
console.log('🌟 bbttcc-auto-link | Final consolidated module loading...');

class BBTTCCSheetManager {
    static MODULE_ID = 'bbttcc-auto-link';

    static hasBBTTCCData(actor) {
        return actor.getFlag('bbttcc-territory', 'bbttccCharacter') === true;
    }

    static getBBTTCCDataForActor(actor) {
        if (!this.hasBBTTCCData(actor)) return { enabled: false };
        const territoryFaction = actor.getFlag('bbttcc-territory', 'faction');
        return { enabled: true, territoryFaction: territoryFaction || 'Unknown' };
    }

    static setupHooks() {
        Hooks.on('createActor', (actor) => {
            if (actor.type === 'character') {
                setTimeout(() => this.checkForDataAndApplySheet(actor), 500);
            }
        });
        Hooks.on('createItem', (item) => {
            if (item.parent?.type === 'character') {
                setTimeout(() => this.checkForDataAndApplySheet(item.parent), 500);
            }
        });
    }

    static applyToExistingBBTTCCCharacters() {
        const actorsToProcess = game.actors.filter(a => this.hasBBTTCCData(a));
        console.log(`[${this.MODULE_ID}] | Found ${actorsToProcess.length} actors with BBTTCC data flag.`);

        for (const actor of actorsToProcess) {
            this.ensureEnhancedSheet(actor);
        }
    }
    
    static ensureEnhancedSheet(actor) {
        console.log(`[${this.MODULE_ID}] | > Checking actor: ${actor.name} (Type: ${actor.type})`);

        // --- FIX START: Add robust checks to prevent applying to factions ---
        if (actor.getFlag('bbttcc-factions', 'isFaction')) {
            console.log(`[${this.MODULE_ID}] | ---> SKIPPING ${actor.name}, it is a faction.`);
            return;
        }
        if (actor.type !== 'character') {
            console.log(`[${this.MODULE_ID}] | ---> SKIPPING ${actor.name}, it is not a 'character' type actor.`);
            return;
        }
        // --- FIX END ---
        
        console.log(`[${this.MODULE_ID}] | ---> QUALIFIES. Applying Enhanced Sheet to ${actor.name}.`);
        const currentSheet = actor.getFlag("core", "sheetClass");
        if (currentSheet !== "dnd5e.BBTTCCEnhancedCharacterSheet") {
            actor.setFlag("core", "sheetClass", "dnd5e.BBTTCCEnhancedCharacterSheet");
            if (actor.sheet?.rendered) {
                actor.sheet.close().then(() => actor.sheet.render(true));
            }
        }
    }

    static checkForDataAndApplySheet(actor) {
        if (this.hasBBTTCCData(actor)) {
            this.ensureEnhancedSheet(actor);
        }
    }
}

class BBTTCCEnhancedCharacterSheet extends dnd5e.applications.actor.CharacterActorSheet {
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["dnd5e", "sheet", "actor", "character", "bbttcc-enhanced"],
            width: 800,
            height: 700,
            tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes" }]
        });
    }

    async getData(options) {
        const context = await super.getData(options);
        context.bbttcc = BBTTCCSheetManager.getBBTTCCDataForActor(this.actor);
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);
        if (this.isEditable) {
            this._addBBTTCCTab(html);
        }
    }

    _addBBTTCCTab(html) {
        const bbttccData = BBTTCCSheetManager.getBBTTCCDataForActor(this.actor);
        if (!bbttccData.enabled) return;

        const nav = html.find('nav.tabs');
        const body = html.find('section.sheet-body');

        if (nav.find('[data-tab="bbttcc-profile"]').length > 0) return;

        nav.append('<a class="item" data-tab="bbttcc-profile"><i class="fas fa-star" style="color: #ffd700;"></i> BBTTCC</a>');
        
        const tabContent = `
            <div class="tab" data-tab="bbttcc-profile">
                <h2>BBTTCC Strategic Profile</h2>
                <p><strong>Faction:</strong> ${bbttccData.territoryFaction}</p>
            </div>
        `;
        body.append(tabContent);
    }
}

Hooks.once('init', () => {
    console.log(`🌟 ${BBTTCCSheetManager.MODULE_ID} | INIT Hook | Registering enhanced character sheet...`);
    foundry.applications.apps.DocumentSheetConfig.registerSheet(
        dnd5e.documents.Actor5e, 
        "dnd5e", 
        BBTTCCEnhancedCharacterSheet, 
        {
            types: ["character"],
            makeDefault: false,
            label: "BBTTCC Enhanced Sheet"
        }
    );
});

Hooks.once('ready', () => {
    console.log(`🌟 ${BBTTCCSheetManager.MODULE_ID} | READY Hook | Applying sheet to existing characters...`);
    BBTTCCSheetManager.applyToExistingBBTTCCCharacters();
    BBTTCCSheetManager.setupHooks();
    
    game.modules.get(BBTTCCSheetManager.MODULE_ID).api = {
        // API can be exposed here if needed later
    };
    console.log(`🌟 ${BBTTCCSheetManager.MODULE_ID} | API exposed for other modules`);
});