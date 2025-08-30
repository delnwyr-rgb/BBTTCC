/**
 * BBTTCC Raid Planner v4.8.0 - FIXED
 * UI application for planning raids between factions
 */

export class RaidPlanner extends Application {
    
    constructor(faction, options = {}) {
        super(options);
        this.faction = faction;
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-raid-planner",
            title: "BBTTCC Raid Planner",
            template: "modules/bbttcc-raid/templates/raid-planner.html",
            width: 700,
            height: 500,
            resizable: true,
            classes: ["bbttcc-raid-planner"]
        });
    }
    
    /** @override */
    async getData() {
        const data = await super.getData();
        
        // Get all other factions as potential targets
        const targetFactions = game.actors.filter(actor => 
            actor.flags['bbttcc-factions']?.isFaction === true &&
            actor.id !== this.faction.id
        );
        
        // Get raid types and objectives
        const raidModule = game.modules.get('bbttcc-raid');
        const RAID_TYPES = raidModule?.api?.RAID_TYPES || window.RAID_TYPES || {};
        const RAID_OBJECTIVES = raidModule?.api?.RAID_OBJECTIVES || window.RAID_OBJECTIVES || {};
        
        // Get active raids involving this faction
        const activeRaids = game.settings.get('world', 'bbttcc-active-raids') || [];
        const factionRaids = activeRaids.filter(raid => 
            (raid.attackerId === this.faction.id || raid.targetId === this.faction.id) &&
            raid.status === 'planned'
        );
        
        // Calculate faction strength
        const factionStrength = this.calculateFactionStrength();
        
        return {
            ...data,
            faction: this.faction,
            targetFactions: targetFactions,
            raidTypes: RAID_TYPES,
            raidObjectives: RAID_OBJECTIVES,
            activeRaids: factionRaids,
            factionStrength: factionStrength
        };
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!game.user.isGM) return;
        
        // Use modern DOM event handling
        const element = html[0];
        
        // Plan raid button
        const planButton = element.querySelector('#plan-raid');
        if (planButton) {
            planButton.addEventListener('click', this._onPlanRaid.bind(this));
        }
        
        // Execute raid buttons
        element.querySelectorAll('.execute-raid').forEach(button => {
            button.addEventListener('click', this._onExecuteRaid.bind(this));
        });
        
        // Cancel raid buttons
        element.querySelectorAll('.cancel-raid').forEach(button => {
            button.addEventListener('click', this._onCancelRaid.bind(this));
        });
        
        // Force commitment slider
        const forceSlider = element.querySelector('#forces-committed');
        const forceDisplay = element.querySelector('#force-percentage');
        if (forceSlider && forceDisplay) {
            forceSlider.addEventListener('input', (event) => {
                forceDisplay.textContent = `${event.target.value}%`;
                this._updateForcePreview(event.target.value);
            });
        }
        
        console.log('BBTTCC Raid Planner | Event listeners activated');
    }
    
    /**
     * Handle planning a new raid
     */
    async _onPlanRaid(event) {
        event.preventDefault();
        
        const form = event.target.closest('form');
        const formData = new FormData(form);
        
        const raidData = {
            targetFactionId: formData.get('target-faction'),
            raidType: formData.get('raid-type'),
            objective: formData.get('raid-objective'),
            forcesCommitted: parseInt(formData.get('forces-committed')),
            description: formData.get('raid-description') || ''
        };
        
        if (!raidData.targetFactionId) {
            ui.notifications.warn('Target faction must be selected');
            return;
        }
        
        try {
            // Get the raid module API
            const raidModule = game.modules.get('bbttcc-raid');
            if (raidModule?.api?.planRaid) {
                await raidModule.api.planRaid(this.faction.id, raidData);
            } else {
                // Fallback to global function
                await game.bbttcc.raid.planRaid(this.faction.id, raidData);
            }
            
            // Clear form and refresh
            form.reset();
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Raid Planner | Error planning raid:', error);
            ui.notifications.error(`Failed to plan raid: ${error.message}`);
        }
    }
    
    /**
     * Handle executing a planned raid
     */
    async _onExecuteRaid(event) {
        event.preventDefault();
        
        const raidId = event.currentTarget.dataset.raidId;
        if (!raidId) {
            ui.notifications.error('Raid ID not found');
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: "Execute Raid",
            content: "<p>Are you sure you want to execute this raid? This action cannot be undone.</p>",
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const raidModule = game.modules.get('bbttcc-raid');
            if (raidModule?.api?.executeRaid) {
                await raidModule.api.executeRaid(raidId);
            } else {
                await game.bbttcc.raid.executeRaid(raidId);
            }
            
            this.render();
            
        } catch (error) {
            console.error('Error executing raid:', error);
            ui.notifications.error(`Failed to execute raid: ${error.message}`);
        }
    }
    
    /**
     * Handle canceling a planned raid
     */
    async _onCancelRaid(event) {
        event.preventDefault();
        
        const raidId = event.currentTarget.dataset.raidId;
        if (!raidId) return;
        
        const confirmed = await Dialog.confirm({
            title: "Cancel Raid",
            content: "<p>Are you sure you want to cancel this raid?</p>",
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            // Get active raids and remove this one
            const activeRaids = game.settings.get('world', 'bbttcc-active-raids') || [];
            const updatedRaids = activeRaids.filter(raid => raid.id !== raidId);
            await game.settings.set('world', 'bbttcc-active-raids', updatedRaids);
            
            ui.notifications.info('Raid canceled');
            this.render();
            
        } catch (error) {
            console.error('Error canceling raid:', error);
            ui.notifications.error(`Failed to cancel raid: ${error.message}`);
        }
    }
    
    /**
     * Update force commitment preview
     */
    _updateForcePreview(percentage) {
        const element = this.element[0];
        const previewElement = element.querySelector('#force-preview');
        
        if (previewElement) {
            const totalStrength = this.calculateFactionStrength();
            const effectiveStrength = Math.round(totalStrength * (percentage / 100));
            
            previewElement.innerHTML = `
                <div class="force-breakdown">
                    <div>Total Strength: ${totalStrength}</div>
                    <div>Committed: ${effectiveStrength} (${percentage}%)</div>
                    <div>Reserved: ${totalStrength - effectiveStrength}</div>
                </div>
            `;
        }
    }
    
    /**
     * Calculate faction strength for display
     */
    calculateFactionStrength() {
        const ops = this.faction.system?.ops || {};
        const territories = this.faction.flags['bbttcc-factions']?.territories || [];
        const bases = this.faction.flags['bbttcc-factions']?.bases || [];
        
        // Base strength from OPs
        const opStrength = (ops.violence?.value || 0) * 2 + 
                          (ops.nonlethal?.value || 0) * 1.5 + 
                          (ops.economy?.value || 0) * 0.5;
        
        // Territory bonuses
        const territoryBonus = territories.reduce((sum, territory) => {
            const bonus = territory.type === 'fortress' ? 5 : 
                         territory.type === 'settlement' ? 2 : 1;
            return sum + bonus;
        }, 0);
        
        // Base bonuses
        const baseBonus = bases.reduce((sum, base) => {
            const bonus = base.type === 'castle' ? 8 :
                         base.type === 'bunker' ? 6 :
                         base.type === 'tower' ? 4 : 2;
            return sum + bonus;
        }, 0);
        
        return Math.round(opStrength + territoryBonus + baseBonus);
    }
    
    /**
     * Get formatted raid type description
     */
    getRaidTypeDescription(raidType, raidTypes) {
        const type = raidTypes[raidType];
        if (!type) return '';
        
        return `${type.description} (Duration: ${type.duration}x, Casualties: ${type.casualtyMultiplier}x)`;
    }
    
    /**
     * Get raid status color
     */
    getRaidStatusColor(status) {
        switch (status) {
            case 'planned': return '#f39c12';
            case 'executing': return '#3498db';
            case 'completed': return '#27ae60';
            case 'failed': return '#e74c3c';
            default: return '#6c757d';
        }
    }
}