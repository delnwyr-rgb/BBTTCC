// =========================================================================
// == The Final, Corrected, and Unified bbttcc-community-standard.js
// =========================================================================

// STEP 1: Import the base sheet class from the dnd5e system.
import { ActorSheet5eCharacter } from "../../../systems/dnd5e/module/actor/sheets/character.mjs";

const MODULE_ID = 'bbttcc-auto-link';
const FLAG_SCOPE = 'bbttcc-auto-link';
const ACTIVE_TAB_FLAG = 'activeTab';

// =======================================================
// CLASS DEFINITIONS (Moved to the top)
// =======================================================

/**
 * A static helper class to contain all the "business logic".
 * Defined first so other classes and hooks can use it.
 */
class BBTTCCCommunityTabs {
    static setupHooks() {
        Hooks.on("createActor", (actor) => {
            if (actor.type === 'character' && this.hasBBTTCCData(actor)) {
                this.ensureEnhancedSheet(actor);
            }
        });
    }

    static async applyToExistingBBTTCCCharacters() {
        const characters = game.actors.filter(a => a.type === 'character' && this.hasBBTTCCData(a));
        for (const char of characters) {
            await this.ensureEnhancedSheet(char);
        }
    }
    
    static async ensureEnhancedSheet(actor) {
        const targetSheetClass = `dnd5e.${BBTTCCEnhancedSheet.name}`;
        if (actor.getFlag("core", "sheetClass") !== targetSheetClass) {
            console.log(`${MODULE_ID} | Applying enhanced sheet to ${actor.name}`);
            await actor.setFlag("core", "sheetClass", targetSheetClass);
            if (actor.sheet?.rendered) {
                actor.sheet.close().then(() => actor.sheet.render(true));
            }
        }
    }

    static hasBBTTCCData(actor) {
        return actor.items.some(item => item.type === 'feat' && (item.name.toLowerCase().includes('archetype:')));
    }
    
    static getBBTTCCDataForActor(actor) {
        const hasData = this.hasBBTTCCData(actor);
        if (!hasData) return { enabled: false };
        
        const territoryFaction = actor.getFlag("bbttcc-territory", "faction") || "Independent";
        return {
            enabled: true,
            territoryFaction: territoryFaction
        };
    }
}

/**
 * The Custom Character Sheet Class itself.
 */
class BBTTCCEnhancedSheet extends ActorSheet5eCharacter {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: [...super.defaultOptions.classes, "bbttcc-enhanced"],
            width: 720,
            height: 810,
            tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "attributes" }]
        });
    }

    get title() {
        return `${this.actor.name} ⭐`;
    }

    async getData(options = {}) {
        const context = await super.getData(options);
        // Now this works because BBTTCCCommunityTabs is defined above
        context.bbttcc = BBTTCCCommunityTabs.getBBTTCCDataForActor(this.actor);
        return context;
    }

    activateListeners(html) {
        super.activateListeners(html);
        this._setupTabPersistence(html);
    }

    async _render(force = false, options = {}) {
        await super._render(force, options);
        this._restoreTabState();
    }

    _setupTabPersistence(html) {
        html.find('.tabs .item').on('click', (event) => {
            const tabName = $(event.currentTarget).data('tab');
            this.actor.setFlag(FLAG_SCOPE, ACTIVE_TAB_FLAG, tabName);
        });
    }

    _restoreTabState() {
        const lastTab = this.actor.getFlag(FLAG_SCOPE, ACTIVE_TAB_FLAG);
        if (lastTab && this._tabs && this._tabs[0]) {
            this._tabs[0].activate(lastTab);
        }
    }
}

// =======================================================
// HOOKS (The entry point for the module)
// =======================================================

Hooks.on('init', () => {
    console.log("🌟 BBTTCC | INIT Hook | Registering enhanced character sheet...");
    
    Actors.registerSheet("dnd5e", BBTTCCEnhancedSheet, {
        types: ["character"],
        makeDefault: true,
        label: "BBTTCC Enhanced Sheet"
    });
});

Hooks.on('ready', () => {
    console.log("🌟 BBTTCC | READY Hook | Applying sheet and setting up hooks...");
    
    BBTTCCCommunityTabs.applyToExistingBBTTCCCharacters();
    BBTTCCCommunityTabs.setupHooks();
});

Hooks.on('renderBBTTCCEnhancedSheet', (app, html, data) => {
    if (!data.bbttcc || !data.bbttcc.enabled) return;
    
    console.log(`BBTTCC | Render hook fired for ${app.actor.name}. Adding tab...`);

    const nav = html.find('nav.tabs');
    const body = html.find('section.sheet-body');
    if (nav.length === 0 || body.length === 0) return;
    if (nav.find('[data-tab="bbttcc-profile"]').length > 0) return;

    nav.append(`<a class="item" data-tab="bbttcc-profile"><i class="fas fa-star" style="color: #ffd700;"></i> BBTTCC</a>`);
    body.append(`<div class="tab" data-tab="bbttcc-profile"><h2>BBTTCC Strategic Profile</h2><p>Faction: ${data.bbttcc.territoryFaction}</p></div>`);

    console.log(`BBTTCC | ✅ Tab added to ${app.actor.name}`);
});