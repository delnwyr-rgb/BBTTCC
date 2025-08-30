/**
 * BBTTCC Faction Sheet v4.8.0 - ULTIMATE  
 * Modern FoundryVTT v13+ Application V2 patterns with D&D 5e v5.1+ compatibility
 * Uses NPCActorSheet instead of deprecated ActorSheet5eNPC
 */

export class FactionSheet extends dnd5e.applications.actor.NPCActorSheet {
    
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
        
        // Ensure OPs structure exists with modern pattern
        if (!context.actor.system.ops) {
            console.warn('BBTTCC Faction Sheet | Missing OPs structure, initializing...');
            const defaultOps = {
                violence: { value: 0, max: 10 },
                nonlethal: { value: 0, max: 10 },
                intrigue: { value: 0, max: 10 },
                economy: { value: 0, max: 10 },
                softpower: { value: 0, max: 10 },
                diplomacy: { value: 0, max: 10 }
            };
            await this.actor.update({
                'system.ops': foundry.utils.deepClone(defaultOps)
            });
        }
        
        // Add faction-specific data with safe access
        context.ops = context.actor.system.ops || {};
        context.factionFlags = context.actor.flags['bbttcc-factions'] || {};
        context.warLog = context.factionFlags.warLog || [];
        context.territories = context.factionFlags.territories || [];
        context.bases = context.factionFlags.bases || [];
        
        // Add localized labels with fallbacks
        context.opsLabels = {
            violence: game.i18n.localize("BBTTCC.OPs.Violence") || "Violence",
            nonlethal: game.i18n.localize("BBTTCC.OPs.NonLethal") || "Non-Lethal", 
            intrigue: game.i18n.localize("BBTTCC.OPs.Intrigue") || "Intrigue",
            economy: game.i18n.localize("BBTTCC.OPs.Economy") || "Economy",
            softpower: game.i18n.localize("BBTTCC.OPs.SoftPower") || "Soft Power",
            diplomacy: game.i18n.localize("BBTTCC.OPs.Diplomacy") || "Diplomacy"
        };
        
        // Add BBTTCC-specific context
        context.isBBTTCCFaction = true;
        context.bbttccVersion = '4.8.0';
        
        return context;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!this.isEditable) return;
        
        // Use modern DOM event handling with defensive programming
        try {
            const element = html[0] || html;
            
            // OP adjustment buttons with error handling
            this._setupEventListeners(element, '.op-adjust', this._onOpAdjust.bind(this));
            this._setupEventListeners(element, '.op-roll', this._onOpRoll.bind(this));
            
            // D20 roll button
            const d20Button = element.querySelector('.roll-d20');
            if (d20Button) {
                d20Button.addEventListener('click', this._onD20Roll.bind(this));
            }
            
            // War log management
            this._setupEventListeners(element, '.war-log-add', this._onWarLogAdd.bind(this));
            this._setupEventListeners(element, '.war-log-delete', this._onWarLogDelete.bind(this));
            
            // Base management  
            this._setupEventListeners(element, '.base-add', this._onBaseAdd.bind(this));
            this._setupEventListeners(element, '.base-delete', this._onBaseDelete.bind(this));
            
            console.log('BBTTCC Faction Sheet | Event listeners activated using modern patterns');
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error activating listeners:', error);
        }
    }
    
    /**
     * Helper method to safely setup event listeners
     * @param {HTMLElement} element - Parent element
     * @param {string} selector - CSS selector
     * @param {Function} handler - Event handler
     */
    _setupEventListeners(element, selector, handler) {
        try {
            element.querySelectorAll(selector).forEach(button => {
                button.addEventListener('click', handler);
            });
        } catch (error) {
            console.warn(`BBTTCC Faction Sheet | Failed to setup listeners for ${selector}:`, error);
        }
    }
    
    /**
     * Handle OP adjustment (+/- buttons) with enhanced error handling
     */
    async _onOpAdjust(event) {
        event.preventDefault();
        
        try {
            const button = event.currentTarget;
            const opType = button.dataset.op;
            const adjustment = parseInt(button.dataset.adjustment);
            
            // Validation
            if (!opType || isNaN(adjustment)) {
                console.error('BBTTCC Faction Sheet | Invalid OP adjustment data:', { opType, adjustment });
                ui.notifications.warn('Invalid adjustment data');
                return;
            }
            
            const currentOp = this.actor.system.ops?.[opType];
            if (!currentOp) {
                console.error('BBTTCC Faction Sheet | OP type not found:', opType);
                ui.notifications.warn(`Organization Point type "${opType}" not found`);
                return;
            }
            
            const newValue = Math.max(0, Math.min(currentOp.max || 10, currentOp.value + adjustment));
            
            console.log(`BBTTCC Faction Sheet | Adjusting ${opType}: ${currentOp.value} -> ${newValue}`);
            
            await this.actor.update({
                [`system.ops.${opType}.value`]: newValue
            });
            
            ui.notifications.info(`${opType.toUpperCase()} adjusted to ${newValue}`);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error adjusting OP:', error);
            ui.notifications.error('Failed to adjust Organization Points');
        }
    }
    
    /**
     * Handle OP roll buttons with modern Roll API
     */
    async _onOpRoll(event) {
        event.preventDefault();
        
        try {
            const button = event.currentTarget;
            const opType = button.dataset.op;
            
            if (!opType) {
                console.error('BBTTCC Faction Sheet | Missing OP type for roll');
                ui.notifications.warn('Invalid roll request');
                return;
            }
            
            const opValue = this.actor.system.ops?.[opType]?.value || 0;
            const roll = new Roll(`1d20 + ${opValue}`);
            
            const result = await roll.evaluate();
            
            // Modern chat message creation
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
            
            await ChatMessage.create(chatData);
            console.log(`BBTTCC Faction Sheet | ${opType} roll: ${result.total}`);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error rolling OP:', error);
            ui.notifications.error('Failed to roll Organization Points');
        }
    }
    
    /**
     * Handle D20 roll button
     */
    async _onD20Roll(event) {
        event.preventDefault();
        
        try {
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
            
            await ChatMessage.create(chatData);
            console.log(`BBTTCC Faction Sheet | D20 roll: ${result.total}`);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error rolling D20:', error);
            ui.notifications.error('Failed to roll D20');
        }
    }
    
    /**
     * Add war log entry with enhanced data validation
     */
    async _onWarLogAdd(event) {
        event.preventDefault();
        
        try {
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
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error adding war log entry:', error);
            ui.notifications.error('Failed to add war log entry');
        }
    }
    
    /**
     * Delete war log entry
     */
    async _onWarLogDelete(event) {
        event.preventDefault();
        
        try {
            const entryId = event.currentTarget.dataset.entryId;
            
            if (!entryId) {
                ui.notifications.warn('Invalid war log entry');
                return;
            }
            
            const warLog = (this.actor.flags['bbttcc-factions']?.warLog || []).filter(
                entry => entry.id !== entryId
            );
            
            await this.actor.update({
                'flags.bbttcc-factions.warLog': warLog
            });
            
            ui.notifications.info("War log entry deleted");
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error deleting war log entry:', error);
            ui.notifications.error('Failed to delete war log entry');
        }
    }
    
    /**
     * Add base entry with validation
     */
    async _onBaseAdd(event) {
        event.preventDefault();
        
        try {
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
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error adding base:', error);
            ui.notifications.error('Failed to add base');
        }
    }
    
    /**
     * Delete base entry
     */
    async _onBaseDelete(event) {
        event.preventDefault();
        
        try {
            const baseId = event.currentTarget.dataset.baseId;
            
            if (!baseId) {
                ui.notifications.warn('Invalid base entry');
                return;
            }
            
            const bases = (this.actor.flags['bbttcc-factions']?.bases || []).filter(
                base => base.id !== baseId
            );
            
            await this.actor.update({
                'flags.bbttcc-factions.bases': bases
            });
            
            ui.notifications.info("Base deleted");
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error deleting base:', error);
            ui.notifications.error('Failed to delete base');
        }
    }
}