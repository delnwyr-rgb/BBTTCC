/**
 * BBTTCC Faction Sheet v4.8.1-ENHANCED-D&D5E-V5.4
 * Compatible with D&D5e v5.4+ modern patterns
 * Uses proper async/await, modern event handling, and current sheet patterns
 * 
 * @extends {dnd5e.applications.actor.NPCActorSheet} - Backward compatible, works with v5.4
 * @version 4.8.1-ENHANCED-D&D5E-V5.4
 * @author BBTTCC Team
 * 
 * Note: Uses NPCActorSheet for compatibility. In v5.4+, this points to the modern BaseActorSheet.
 * D&D5e maintains backward compatibility with deprecation warnings.
 */

// Use ActorSheet for D&D5e v5.1.4 compatibility  
// BaseActorSheet may not be available in v5.1.4, fall back to standard ActorSheet
export class FactionSheet extends ActorSheet {
    
    constructor(...args) {
        super(...args);
        this._debouncedRender = foundry.utils.debounce(this.render.bind(this), 100);
        this._contextCache = new Map();
        this._lastCacheUpdate = 0;
    }
    
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
            ],
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
            // ActorSheet specific options
            submitOnChange: true,
            closeOnSubmit: false
        });
    }

    /** @override */
    get template() {
        // Use actual game folder name (bbttcc-factions)
        return "modules/bbttcc-factions/templates/faction-sheet.html";
    }

    /** @override */
    async getData(options) {
        console.log('FactionSheet | getData() called for:', this.actor.name);
        console.log('FactionSheet | Template path:', this.template);
        console.log('FactionSheet | Actor type:', this.actor.type);
        console.log('FactionSheet | Is faction:', this.actor.getFlag('bbttcc-factions', 'isFaction'));
        
        const moduleId = 'bbttcc-factions';
        let context;
        
        try {
            context = await super.getData(options);
            console.log('FactionSheet | Super getData successful, context keys:', Object.keys(context));
        } catch (superError) {
            console.error('FactionSheet | Super getData failed:', superError);
            // Fallback minimal context
            context = {
                actor: this.actor,
                system: this.actor.system,
                isGM: game.user.isGM,
                isOwner: this.actor.isOwner
            };
        }
        
        try {
            // Ensure this is a faction and has proper data structure
            if (!this.actor.getFlag(moduleId, 'isFaction')) {
                console.warn('BBTTCC Faction Sheet | Actor is not a faction, initializing...');
                await this._initializeFactionData();
            }
            
            // Add faction-specific data with safe flag access
            context.factionFlags = this.actor.flags[moduleId] || {};
            context.ops = this.actor.getFlag(moduleId, 'ops') || {};
            context.warLog = this.actor.getFlag(moduleId, 'warLog') || [];
            context.territories = this.actor.getFlag(moduleId, 'territories') || [];
            context.bases = this.actor.getFlag(moduleId, 'bases') || [];
            
            // Add computed properties
            context.totalOPs = Object.values(context.ops).reduce((total, op) => total + (op?.value || 0), 0);
            context.maxTotalOPs = Object.values(context.ops).reduce((total, op) => total + (op?.max || 10), 0);
            context.powerLevel = this._calculatePowerLevel(context.totalOPs);
            
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
            context.bbttccVersion = '4.8.1-ENHANCED';
            
            console.log('BBTTCC Faction Sheet | Context prepared:', {
                hasOps: !!context.ops && Object.keys(context.ops).length > 0,
                totalOPs: context.totalOPs,
                powerLevel: context.powerLevel
            });
            
            return context;
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error preparing context:', error);
            ui.notifications.error('Error loading faction sheet data');
            return context;
        }
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!this.isEditable) return;
        
        try {
            // Modern event handling with proper cleanup
            const element = html[0] || html;
            
            // OP management buttons
            this._addEventListeners(element, '.op-adjust', this._onOpAdjust.bind(this));
            this._addEventListeners(element, '.op-roll', this._onOpRoll.bind(this));
            
            // War log management
            this._addEventListeners(element, '.war-log-add', this._onWarLogAdd.bind(this));
            this._addEventListeners(element, '.war-log-delete', this._onWarLogDelete.bind(this));
            
            // Base management  
            this._addEventListeners(element, '.base-add', this._onBaseAdd.bind(this));
            this._addEventListeners(element, '.base-delete', this._onBaseDelete.bind(this));
            
            // D20 roll button
            const d20Button = element.querySelector('.roll-d20');
            if (d20Button) {
                d20Button.addEventListener('click', this._onD20Roll.bind(this));
            }
            
            console.log('BBTTCC Faction Sheet | Modern event listeners activated');
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Error activating listeners:', error);
        }
    }
    
    /**
     * Modern event listener helper with proper error handling
     * @param {HTMLElement} element - Parent element
     * @param {string} selector - CSS selector
     * @param {Function} handler - Event handler
     */
    _addEventListeners(element, selector, handler) {
        try {
            element.querySelectorAll(selector).forEach(button => {
                button.addEventListener('click', handler);
            });
        } catch (error) {
            console.warn(`BBTTCC Faction Sheet | Failed to setup listeners for ${selector}:`, error);
        }
    }
    
    /**
     * Initialize faction data if missing (recovery mechanism)
     */
    async _initializeFactionData() {
        const moduleId = 'bbttcc-factions';
        const defaultOps = {
            violence: { value: 0, max: 10 },
            nonlethal: { value: 0, max: 10 },
            intrigue: { value: 0, max: 10 },
            economy: { value: 0, max: 10 },
            softpower: { value: 0, max: 10 },
            diplomacy: { value: 0, max: 10 }
        };
        
        try {
            await this.actor.setFlag(moduleId, 'isFaction', true);
            await this.actor.setFlag(moduleId, 'version', '4.8.1-ENHANCED');
            await this.actor.setFlag(moduleId, 'ops', defaultOps);
            await this.actor.setFlag(moduleId, 'warLog', []);
            await this.actor.setFlag(moduleId, 'territories', []);
            await this.actor.setFlag(moduleId, 'bases', []);
            
            console.log('BBTTCC Faction Sheet | Faction data initialized');
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Failed to initialize faction data:', error);
            throw error;
        }
    }
    
    /**
     * Calculate power level based on total OPs
     * @param {number} totalOPs - Total organization points
     * @returns {string} Power level
     */
    _calculatePowerLevel(totalOPs) {
        if (totalOPs < 10) return "Emerging";
        if (totalOPs < 25) return "Growing";
        if (totalOPs < 40) return "Established";
        if (totalOPs < 55) return "Powerful";
        return "Dominant";
    }
    
    /**
     * Modern OP adjustment handler with proper async/await
     */
    async _onOpAdjust(event) {
        event.preventDefault();
        
        try {
            const button = event.currentTarget;
            const opType = button.dataset.op;
            const adjustment = parseInt(button.dataset.adjustment);
            const moduleId = 'bbttcc-factions';
            
            // Validation
            if (!opType || isNaN(adjustment)) {
                throw new Error('Invalid adjustment data');
            }
            
            // Get current OP from flags
            const currentOps = this.actor.getFlag(moduleId, 'ops') || {};
            const currentOp = currentOps[opType];
            
            if (!currentOp) {
                throw new Error(`Organization Point type "${opType}" not found`);
            }
            
            // Calculate new value with bounds checking
            const newValue = Math.max(0, Math.min(currentOp.max || 10, currentOp.value + adjustment));
            
            console.log(`BBTTCC Faction Sheet | Adjusting ${opType}: ${currentOp.value} -> ${newValue}`);
            
            // Update using setFlag (more reliable than update)
            const updatedOps = foundry.utils.deepClone(currentOps);
            updatedOps[opType].value = newValue;
            
            await this.actor.setFlag(moduleId, 'ops', updatedOps);
            
            // Force re-render to show changes immediately
            this.render(false);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | OP adjustment failed:', error);
            ui.notifications.error(`Failed to adjust OP: ${error.message}`);
        }
    }
    
    /**
     * Modern OP roll handler with proper dice integration
     */
    async _onOpRoll(event) {
        event.preventDefault();
        
        try {
            const button = event.currentTarget;
            const opType = button.dataset.op;
            const moduleId = 'bbttcc-factions';
            
            if (!opType) {
                throw new Error('Missing OP type for roll');
            }
            
            // Get OP value from flags
            const ops = this.actor.getFlag(moduleId, 'ops') || {};
            const opValue = ops[opType]?.value || 0;
            const opLabel = opType.charAt(0).toUpperCase() + opType.slice(1);
            
            // Create and evaluate roll
            const roll = new Roll(`1d20 + ${opValue}`, this.actor.getRollData());
            const result = await roll.evaluate();
            
            // Create modern chat message
            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                roll: result,
                content: `
                    <div class="bbttcc-roll">
                        <h4>${this.actor.name} - ${opLabel} Roll</h4>
                        <div class="roll-result">
                            <strong>Result: ${result.total}</strong>
                            <div class="roll-formula">${result.formula}</div>
                        </div>
                    </div>
                `
            });
            
            console.log(`BBTTCC Faction Sheet | ${opLabel} roll: ${result.total} (${result.formula})`);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | OP roll failed:', error);
            ui.notifications.error(`Failed to roll OP: ${error.message}`);
        }
    }
    
    /**
     * General d20 roll handler
     */
    async _onD20Roll(event) {
        event.preventDefault();
        
        try {
            const roll = new Roll('1d20', this.actor.getRollData());
            const result = await roll.evaluate();
            
            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                roll: result,
                content: `
                    <div class="bbttcc-roll">
                        <h4>${this.actor.name} - D20 Roll</h4>
                        <div class="roll-result">
                            <strong>Result: ${result.total}</strong>
                        </div>
                    </div>
                `
            });
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | D20 roll failed:', error);
            ui.notifications.error(`Failed to roll d20: ${error.message}`);
        }
    }
    
    /**
     * Add war log entry
     */
    async _onWarLogAdd(event) {
        event.preventDefault();
        
        try {
            const entry = await this._getWarLogEntryFromDialog();
            if (!entry) return; // User cancelled
            
            const moduleId = 'bbttcc-factions';
            const currentLog = this.actor.getFlag(moduleId, 'warLog') || [];
            
            const newEntry = {
                id: foundry.utils.randomID(),
                title: entry.title,
                description: entry.description,
                type: entry.type,
                date: new Date().toISOString(),
                createdBy: game.user.id
            };
            
            const updatedLog = [...currentLog, newEntry];
            await this.actor.setFlag(moduleId, 'warLog', updatedLog);
            
            this.render(false);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Failed to add war log entry:', error);
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
            if (!entryId) return;
            
            const confirmed = await Dialog.confirm({
                title: "Delete War Log Entry",
                content: "<p>Are you sure you want to delete this war log entry?</p>",
                defaultYes: false
            });
            
            if (!confirmed) return;
            
            const moduleId = 'bbttcc-factions';
            const currentLog = this.actor.getFlag(moduleId, 'warLog') || [];
            const updatedLog = currentLog.filter(entry => entry.id !== entryId);
            
            await this.actor.setFlag(moduleId, 'warLog', updatedLog);
            this.render(false);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Failed to delete war log entry:', error);
            ui.notifications.error('Failed to delete war log entry');
        }
    }
    
    /**
     * Add base
     */
    async _onBaseAdd(event) {
        event.preventDefault();
        
        try {
            const baseData = await this._getBaseDataFromDialog();
            if (!baseData) return; // User cancelled
            
            const moduleId = 'bbttcc-factions';
            const currentBases = this.actor.getFlag(moduleId, 'bases') || [];
            
            const newBase = {
                id: foundry.utils.randomID(),
                name: baseData.name,
                type: baseData.type,
                description: baseData.description,
                createdAt: new Date().toISOString(),
                createdBy: game.user.id
            };
            
            const updatedBases = [...currentBases, newBase];
            await this.actor.setFlag(moduleId, 'bases', updatedBases);
            
            this.render(false);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Failed to add base:', error);
            ui.notifications.error('Failed to add base');
        }
    }
    
    /**
     * Delete base
     */
    async _onBaseDelete(event) {
        event.preventDefault();
        
        try {
            const baseId = event.currentTarget.dataset.baseId;
            if (!baseId) return;
            
            const confirmed = await Dialog.confirm({
                title: "Delete Base",
                content: "<p>Are you sure you want to delete this base?</p>",
                defaultYes: false
            });
            
            if (!confirmed) return;
            
            const moduleId = 'bbttcc-factions';
            const currentBases = this.actor.getFlag(moduleId, 'bases') || [];
            const updatedBases = currentBases.filter(base => base.id !== baseId);
            
            await this.actor.setFlag(moduleId, 'bases', updatedBases);
            this.render(false);
            
        } catch (error) {
            console.error('BBTTCC Faction Sheet | Failed to delete base:', error);
            ui.notifications.error('Failed to delete base');
        }
    }
    
    /**
     * Get war log entry data from dialog
     */
    async _getWarLogEntryFromDialog() {
        return new Promise(resolve => {
            new Dialog({
                title: "Add War Log Entry",
                content: `
                    <form>
                        <div class="form-group">
                            <label>Title:</label>
                            <input type="text" name="title" placeholder="Event title..." />
                        </div>
                        <div class="form-group">
                            <label>Type:</label>
                            <select name="type">
                                <option value="battle">Battle</option>
                                <option value="victory">Victory</option>
                                <option value="defeat">Defeat</option>
                                <option value="alliance">Alliance</option>
                                <option value="betrayal">Betrayal</option>
                                <option value="negotiation">Negotiation</option>
                                <option value="territory_gained">Territory Gained</option>
                                <option value="territory_lost">Territory Lost</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Description:</label>
                            <textarea name="description" placeholder="Description of the event..."></textarea>
                        </div>
                    </form>
                `,
                buttons: {
                    add: {
                        label: "Add Entry",
                        callback: (html) => {
                            const formData = new foundry.applications.ux.FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData.title ? formData : null);
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "add"
            }).render(true);
        });
    }
    
    /**
     * Get base data from dialog
     */
    async _getBaseDataFromDialog() {
        return new Promise(resolve => {
            new Dialog({
                title: "Add Base",
                content: `
                    <form>
                        <div class="form-group">
                            <label>Name:</label>
                            <input type="text" name="name" placeholder="Base name..." />
                        </div>
                        <div class="form-group">
                            <label>Type:</label>
                            <select name="type">
                                <option value="outpost">Outpost</option>
                                <option value="headquarters">Headquarters</option>
                                <option value="bunker">Bunker</option>
                                <option value="safehouse">Safe House</option>
                                <option value="command">Command Center</option>
                                <option value="research">Research Facility</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Description:</label>
                            <textarea name="description" placeholder="Description of the base..."></textarea>
                        </div>
                    </form>
                `,
                buttons: {
                    add: {
                        label: "Add Base",
                        callback: (html) => {
                            const formData = new foundry.applications.ux.FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData.name ? formData : null);
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "add"
            }).render(true);
        });
    }
}