/**
 * BBTTCC Radiation Tracker - Modern UI Application
 * Individual token radiation monitoring and management interface
 */

export class RadiationTracker extends Application {
    
    constructor(token, options = {}) {
        super(options);
        this.token = token;
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-radiation-tracker",
            title: "Radiation Tracker",
            template: "modules/bbttcc-radiation/templates/radiation-tracker.html",
            width: 500,
            height: 400,
            resizable: true,
            classes: ["bbttcc-radiation-tracker"]
        });
    }
    
    /** @override */
    async getData(options) {
        const data = await super.getData(options);
        
        if (!this.token || !this.token.actor) {
            return { ...data, error: 'No valid token selected' };
        }
        
        // Get radiation module API
        const radiationModule = game.modules.get('bbttcc-radiation');
        const api = radiationModule?.api;
        
        if (!api) {
            return { ...data, error: 'BBTTCC Radiation module not available' };
        }
        
        // Get radiation data
        const radiationData = api.getRadiationData(this.token);
        const sceneRadiation = api.getSceneRadiationZone();
        
        // Get available protection types
        const PROTECTION_TYPES = api.PROTECTION_TYPES || {};
        const RADIATION_LEVELS = api.RADIATION_LEVELS || {};
        
        return {
            ...data,
            token: this.token,
            actor: this.token.actor,
            radiationData: radiationData,
            sceneRadiation: sceneRadiation,
            protectionTypes: PROTECTION_TYPES,
            radiationLevels: RADIATION_LEVELS,
            isGM: game.user.isGM
        };
    }
    
    /** @override */
    get title() {
        return `Radiation Tracker - ${this.token?.name || 'Unknown'}`;
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!game.user.isGM) return;
        
        const element = html[0];
        
        // Exposure adjustment buttons
        element.querySelectorAll('.exposure-adjust').forEach(button => {
            button.addEventListener('click', this._onAdjustExposure.bind(this));
        });
        
        // Protection type selection
        const protectionSelect = element.querySelector('#protection-type');
        if (protectionSelect) {
            protectionSelect.addEventListener('change', this._onChangeProtection.bind(this));
        }
        
        // Custom protection input
        const customProtectionInput = element.querySelector('#custom-protection');
        if (customProtectionInput) {
            customProtectionInput.addEventListener('change', this._onCustomProtection.bind(this));
        }
        
        // Reset radiation button
        const resetButton = element.querySelector('#reset-radiation');
        if (resetButton) {
            resetButton.addEventListener('click', this._onResetRadiation.bind(this));
        }
        
        // Remove effects button
        const removeEffectsButton = element.querySelector('#remove-effects');
        if (removeEffectsButton) {
            removeEffectsButton.addEventListener('click', this._onRemoveEffects.bind(this));
        }
        
        // Manual update button
        const updateButton = element.querySelector('#manual-update');
        if (updateButton) {
            updateButton.addEventListener('click', this._onManualUpdate.bind(this));
        }
        
        console.log('BBTTCC Radiation Tracker | Event listeners activated');
    }
    
    /**
     * Handle exposure adjustment
     */
    async _onAdjustExposure(event) {
        event.preventDefault();
        
        try {
            const adjustment = parseFloat(event.target.dataset.adjustment);
            if (isNaN(adjustment)) return;
            
            const radiationModule = game.modules.get('bbttcc-radiation');
            await radiationModule.api.updateRadiationExposure(this.token, adjustment, { notify: true });
            
            // Refresh the tracker
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Tracker | Error adjusting exposure:', error);
            ui.notifications.error(`Failed to adjust exposure: ${error.message}`);
        }
    }
    
    /**
     * Handle protection type change
     */
    async _onChangeProtection(event) {
        event.preventDefault();
        
        try {
            const protectionType = event.target.value;
            if (!protectionType) return;
            
            const radiationModule = game.modules.get('bbttcc-radiation');
            await radiationModule.api.setProtectionLevel(this.token, protectionType);
            
            // Refresh the tracker
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Tracker | Error changing protection:', error);
            ui.notifications.error(`Failed to change protection: ${error.message}`);
        }
    }
    
    /**
     * Handle custom protection input
     */
    async _onCustomProtection(event) {
        event.preventDefault();
        
        try {
            const customValue = parseInt(event.target.value);
            if (isNaN(customValue)) return;
            
            const radiationModule = game.modules.get('bbttcc-radiation');
            await radiationModule.api.setProtectionLevel(this.token, 'custom', customValue);
            
            // Refresh the tracker
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Tracker | Error setting custom protection:', error);
            ui.notifications.error(`Failed to set custom protection: ${error.message}`);
        }
    }
    
    /**
     * Handle radiation reset
     */
    async _onResetRadiation(event) {
        event.preventDefault();
        
        const confirmed = await Dialog.confirm({
            title: "Reset Radiation",
            content: `<p>Are you sure you want to reset all radiation data for <strong>${this.token.name}</strong>?</p><p>This will remove all exposure and effects.</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            const defaultData = foundry.utils.deepClone(radiationModule.api.DEFAULT_RADIATION_STRUCTURE);
            
            await this.token.actor.setFlag('bbttcc-radiation', 'radiation', defaultData);
            
            // Remove all radiation effects
            const radiationEffects = this.token.actor.effects.filter(effect => 
                effect.flags['bbttcc-radiation']?.radiationEffect
            );
            
            if (radiationEffects.length > 0) {
                await this.token.actor.deleteEmbeddedDocuments('ActiveEffect', 
                    radiationEffects.map(e => e.id)
                );
            }
            
            ui.notifications.info(`${this.token.name} radiation data reset`);
            
            // Refresh the tracker
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Tracker | Error resetting radiation:', error);
            ui.notifications.error(`Failed to reset radiation: ${error.message}`);
        }
    }
    
    /**
     * Handle removing radiation effects
     */
    async _onRemoveEffects(event) {
        event.preventDefault();
        
        try {
            const radiationEffects = this.token.actor.effects.filter(effect => 
                effect.flags['bbttcc-radiation']?.radiationEffect
            );
            
            if (radiationEffects.length === 0) {
                ui.notifications.info('No radiation effects to remove');
                return;
            }
            
            await this.token.actor.deleteEmbeddedDocuments('ActiveEffect', 
                radiationEffects.map(e => e.id)
            );
            
            ui.notifications.info(`Removed ${radiationEffects.length} radiation effects from ${this.token.name}`);
            
            // Refresh the tracker
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Tracker | Error removing effects:', error);
            ui.notifications.error(`Failed to remove effects: ${error.message}`);
        }
    }
    
    /**
     * Handle manual update (force recalculation)
     */
    async _onManualUpdate(event) {
        event.preventDefault();
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            
            // Get current data
            const currentData = radiationModule.api.getRadiationData(this.token);
            if (!currentData) return;
            
            // Force a recalculation by updating with zero change
            await radiationModule.api.updateRadiationExposure(this.token, 0, { notify: false });
            
            ui.notifications.info(`${this.token.name} radiation data updated`);
            
            // Refresh the tracker
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Tracker | Error updating radiation:', error);
            ui.notifications.error(`Failed to update radiation: ${error.message}`);
        }
    }
}