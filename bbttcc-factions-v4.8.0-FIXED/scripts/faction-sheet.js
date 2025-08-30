/**
 * BBTTCC Faction Sheet v4.8.0 - FIXED  
 * Custom actor sheet for BBTTCC factions with modern DOM event handling
 * Compatible with FoundryVTT v13+ and D&D 5e system v5.1.2+
 */

export class FactionSheet extends dnd5e.applications.actor.ActorSheet5eNPC {
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["dnd5e", "sheet", "actor", "npc", "bbttcc-faction"],
            width: 720,
            height: 680,
            tabs: [
                {
                    navSelector: ".sheet-tabs",
                    contentSelector: ".sheet-body",
                    initial: "ops"
                }
            ]
        });
    }

    /** @override */
    get template() {
        return "modules/bbttcc-factions/templates/faction-sheet.html";
    }

    /** @override */
    async getData() {
        const context = await super.getData();
        
        // Ensure OPs structure exists
        if (!context.actor.system.ops) {
            console.warn('BBTTCC Faction Sheet | Missing OPs structure, initializing...');
            await this.actor.update({
                'system.ops': {
                    violence: { value: 0, max: 10 },
                    nonlethal: { value: 0, max: 10 },
                    intrigue: { value: 0, max: 10 },
                    economy: { value: 0, max: 10 },
                    softpower: { value: 0, max: 10 },
                    diplomacy: { value: 0, max: 10 }
                }
            });
        }
        
        // Add faction-specific data
        context.ops = context.actor.system.ops || {};
        context.factionFlags = context.actor.flags['bbttcc-factions'] || {};
        context.warLog = context.factionFlags.warLog || [];
        context.territories = context.factionFlags.territories || [];
        context.bases = context.factionFlags.bases || [];
        
        // Add localized labels
        context.opsLabels = {
            violence: game.i18n.localize("BBTTCC.OPs.Violence"),
            nonlethal: game.i18n.localize("BBTTCC.OPs.NonLethal"), 
            intrigue: game.i18n.localize("BBTTCC.OPs.Intrigue"),
            economy: game.i18n.localize("BBTTCC.OPs.Economy"),
            softpower: game.i18n.localize("BBTTCC.OPs.SoftPower"),
            diplomacy: game.i18n.localize("BBTTCC.OPs.Diplomacy")
        };
        
        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!this.isEditable) return;
        
        // Use modern DOM event handling (no jQuery)
        const element = html[0];
        
        // OP adjustment buttons
        element.querySelectorAll('.op-adjust').forEach(button => {
            button.addEventListener('click', this._onOpAdjust.bind(this));
        });
        
        // Roll buttons
        element.querySelectorAll('.op-roll').forEach(button => {
            button.addEventListener('click', this._onOpRoll.bind(this));
        });
        
        // D20 roll button
        const d20Button = element.querySelector('.roll-d20');
        if (d20Button) {
            d20Button.addEventListener('click', this._onD20Roll.bind(this));
        }
        
        // War log management
        element.querySelectorAll('.war-log-add').forEach(button => {
            button.addEventListener('click', this._onWarLogAdd.bind(this));
        });
        
        element.querySelectorAll('.war-log-delete').forEach(button => {
            button.addEventListener('click', this._onWarLogDelete.bind(this));
        });
        
        // Base management
        element.querySelectorAll('.base-add').forEach(button => {
            button.addEventListener('click', this._onBaseAdd.bind(this));
        });
        
        element.querySelectorAll('.base-delete').forEach(button => {
            button.addEventListener('click', this._onBaseDelete.bind(this));
        });
        
        console.log('BBTTCC Faction Sheet | Event listeners activated');
    }
    
    /**
     * Handle OP adjustment (+/- buttons)
     */
    async _onOpAdjust(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const opType = button.dataset.op;
        const adjustment = parseInt(button.dataset.adjustment);
        
        if (!opType || isNaN(adjustment)) {
            console.error('BBTTCC Faction Sheet | Invalid OP adjustment data:', { opType, adjustment });
            return;
        }
        
        const currentOp = this.actor.system.ops[opType];
        if (!currentOp) {
            console.error('BBTTCC Faction Sheet | OP type not found:', opType);
            return;
        }
        
        const newValue = Math.max(0, Math.min(currentOp.max, currentOp.value + adjustment));
        
        console.log(`BBTTCC Faction Sheet | Adjusting ${opType}: ${currentOp.value} -> ${newValue}`);
        
        await this.actor.update({
            [`system.ops.${opType}.value`]: newValue
        });
        
        ui.notifications.info(`${opType.toUpperCase()} adjusted to ${newValue}`);
    }
    
    /**
     * Handle OP roll buttons
     */
    async _onOpRoll(event) {
        event.preventDefault();
        const button = event.currentTarget;
        const opType = button.dataset.op;
        
        if (!opType) {
            console.error('BBTTCC Faction Sheet | Missing OP type for roll');
            return;
        }
        
        const opValue = this.actor.system.ops[opType]?.value || 0;
        const roll = new Roll(`1d20 + ${opValue}`);
        
        const result = await roll.evaluate();
        
        const chatData = {
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
                <div class="bbttcc-roll">
                    <h4>${this.actor.name} - ${opType.toUpperCase()} Roll</h4>
                    <div class="roll-result">
                        <strong>${result.total}</strong>
                        <span class="roll-formula">(${result.formula})</span>
                    </div>
                </div>
            `,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: result
        };
        
        ChatMessage.create(chatData);
        console.log(`BBTTCC Faction Sheet | ${opType} roll: ${result.total}`);
    }
    
    /**
     * Handle D20 roll button
     */
    async _onD20Roll(event) {
        event.preventDefault();
        
        const roll = new Roll('1d20');
        const result = await roll.evaluate();
        
        const chatData = {
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
                <div class="bbttcc-roll">
                    <h4>${this.actor.name} - D20 Roll</h4>
                    <div class="roll-result">
                        <strong>${result.total}</strong>
                    </div>
                </div>
            `,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: result
        };
        
        ChatMessage.create(chatData);
        console.log(`BBTTCC Faction Sheet | D20 roll: ${result.total}`);
    }
    
    /**
     * Add war log entry
     */
    async _onWarLogAdd(event) {
        event.preventDefault();
        
        const warLog = this.actor.flags['bbttcc-factions']?.warLog || [];
        const newEntry = {
            id: foundry.utils.randomID(),
            title: "New Event",
            description: "",
            timestamp: new Date().toISOString(),
            turn: game.combat?.round || 0
        };
        
        warLog.push(newEntry);
        
        await this.actor.update({
            'flags.bbttcc-factions.warLog': warLog
        });
        
        ui.notifications.info("War log entry added");
    }
    
    /**
     * Delete war log entry
     */
    async _onWarLogDelete(event) {
        event.preventDefault();
        const entryId = event.currentTarget.dataset.entryId;
        
        const warLog = (this.actor.flags['bbttcc-factions']?.warLog || []).filter(
            entry => entry.id !== entryId
        );
        
        await this.actor.update({
            'flags.bbttcc-factions.warLog': warLog
        });
        
        ui.notifications.info("War log entry deleted");
    }
    
    /**
     * Add base entry
     */
    async _onBaseAdd(event) {
        event.preventDefault();
        
        const bases = this.actor.flags['bbttcc-factions']?.bases || [];
        const newBase = {
            id: foundry.utils.randomID(),
            name: "New Base",
            type: "bunker",
            description: ""
        };
        
        bases.push(newBase);
        
        await this.actor.update({
            'flags.bbttcc-factions.bases': bases
        });
        
        ui.notifications.info("Base added");
    }
    
    /**
     * Delete base entry
     */
    async _onBaseDelete(event) {
        event.preventDefault();
        const baseId = event.currentTarget.dataset.baseId;
        
        const bases = (this.actor.flags['bbttcc-factions']?.bases || []).filter(
            base => base.id !== baseId
        );
        
        await this.actor.update({
            'flags.bbttcc-factions.bases': bases
        });
        
        ui.notifications.info("Base deleted");
    }
}