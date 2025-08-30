/**
 * BBTTCC Radiation Tracker v4.8.0 - FIXED
 * UI application for managing radiation exposure and zones
 */

export class RadiationTracker extends Application {
    
    constructor(options = {}) {
        super(options);
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-radiation-tracker",
            title: "BBTTCC Radiation Tracker",
            template: "modules/bbttcc-radiation/templates/radiation-tracker.html",
            width: 600,
            height: 700,
            resizable: true,
            classes: ["bbttcc-radiation-tracker"]
        });
    }
    
    /** @override */
    async getData() {
        const data = await super.getData();
        
        // Get all character actors with radiation tracking
        const characters = game.actors.filter(actor => 
            actor.type === 'character' &&
            actor.system.resources?.tertiary?.label === 'Radiation'
        ).map(actor => {
            const radiation = actor.system.resources.tertiary.value || 0;
            const radiationInfo = this.getRadiationLevel(radiation);
            const exposureHistory = actor.flags['bbttcc-radiation']?.exposureHistory || [];
            
            return {
                id: actor.id,
                name: actor.name,
                img: actor.img,
                radiation: radiation,
                radiationInfo: radiationInfo,
                exposureHistory: exposureHistory.slice(-5) // Last 5 exposures
            };
        });
        
        // Get radiation zones from current scene
        const currentScene = game.scenes.current;
        const radiationZones = currentScene?.flags['bbttcc-radiation']?.zones || [];
        
        // Get radiation sources
        const radiationModule = game.modules.get('bbttcc-radiation');
        const RADIATION_SOURCES = radiationModule?.api?.RADIATION_SOURCES || {};
        
        return {
            ...data,
            characters: characters,
            radiationZones: radiationZones,
            radiationSources: RADIATION_SOURCES,
            currentScene: currentScene,
            backgroundRadiation: game.settings.get('bbttcc-radiation', 'backgroundRadiation')
        };
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!game.user.isGM) return;
        
        // Use modern DOM event handling
        const element = html[0];
        
        // Expose character buttons
        element.querySelectorAll('.expose-character').forEach(button => {
            button.addEventListener('click', this._onExposeCharacter.bind(this));
        });
        
        // Reduce radiation buttons
        element.querySelectorAll('.reduce-radiation').forEach(button => {
            button.addEventListener('click', this._onReduceRadiation.bind(this));
        });
        
        // Clear radiation buttons
        element.querySelectorAll('.clear-radiation').forEach(button => {
            button.addEventListener('click', this._onClearRadiation.bind(this));
        });
        
        // Create zone button
        const createZoneButton = element.querySelector('#create-zone');
        if (createZoneButton) {
            createZoneButton.addEventListener('click', this._onCreateZone.bind(this));
        }
        
        // Delete zone buttons
        element.querySelectorAll('.delete-zone').forEach(button => {
            button.addEventListener('click', this._onDeleteZone.bind(this));
        });
        
        // Apply background radiation button
        const applyBackgroundButton = element.querySelector('#apply-background');
        if (applyBackgroundButton) {
            applyBackgroundButton.addEventListener('click', this._onApplyBackground.bind(this));
        }
        
        console.log('BBTTCC Radiation Tracker | Event listeners activated');
    }
    
    /**
     * Handle exposing character to radiation
     */
    async _onExposeCharacter(event) {
        event.preventDefault();
        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        
        if (!actor) {
            ui.notifications.error('Actor not found');
            return;
        }
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            if (radiationModule?.api?.exposeActor) {
                await radiationModule.api.exposeActor(actor);
            } else {
                await game.bbttcc.radiation.exposeActor(actor);
            }
            
            this.render();
            
        } catch (error) {
            console.error('Error exposing character:', error);
            ui.notifications.error(`Failed to expose character: ${error.message}`);
        }
    }
    
    /**
     * Handle reducing character radiation
     */
    async _onReduceRadiation(event) {
        event.preventDefault();
        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        
        if (!actor) return;
        
        const currentRadiation = actor.system.resources?.tertiary?.value || 0;
        const reduction = Math.min(50, currentRadiation);
        
        if (reduction <= 0) {
            ui.notifications.info('Character has no radiation to reduce');
            return;
        }
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            if (radiationModule?.api?.addRadiationExposure) {
                await radiationModule.api.addRadiationExposure(actor, -reduction, 'Medical treatment');
            } else {
                await game.bbttcc.radiation.addRadiationExposure(actor, -reduction, 'Medical treatment');
            }
            
            this.render();
            
        } catch (error) {
            console.error('Error reducing radiation:', error);
            ui.notifications.error(`Failed to reduce radiation: ${error.message}`);
        }
    }
    
    /**
     * Handle clearing all radiation from character
     */
    async _onClearRadiation(event) {
        event.preventDefault();
        const actorId = event.currentTarget.dataset.actorId;
        const actor = game.actors.get(actorId);
        
        if (!actor) return;
        
        const confirmed = await Dialog.confirm({
            title: "Clear Radiation",
            content: `<p>Clear all radiation exposure from <strong>${actor.name}</strong>?</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            if (radiationModule?.api?.setRadiationLevel) {
                await radiationModule.api.setRadiationLevel(actor, 0);
            } else {
                await game.bbttcc.radiation.setRadiationLevel(actor, 0);
            }
            
            this.render();
            
        } catch (error) {
            console.error('Error clearing radiation:', error);
            ui.notifications.error(`Failed to clear radiation: ${error.message}`);
        }
    }
    
    /**
     * Handle creating radiation zone
     */
    async _onCreateZone(event) {
        event.preventDefault();
        
        if (!game.scenes.current) {
            ui.notifications.warn('No active scene to create radiation zone');
            return;
        }
        
        const content = `
            <div class="bbttcc-zone-dialog">
                <h4>Create Radiation Zone</h4>
                <div class="form-group">
                    <label>Zone Name:</label>
                    <input type="text" id="zone-name" value="Radiation Zone">
                </div>
                <div class="form-group">
                    <label>Radiation Level:</label>
                    <select id="zone-level">
                        <option value="25">Low (25)</option>
                        <option value="100">Moderate (100)</option>
                        <option value="300">High (300)</option>
                        <option value="600">Severe (600)</option>
                        <option value="1000">Lethal (1000)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Coordinates:</label>
                    <div class="coordinate-inputs">
                        <input type="number" id="zone-x" placeholder="X" value="0">
                        <input type="number" id="zone-y" placeholder="Y" value="0">
                    </div>
                </div>
                <div class="form-group">
                    <label>Radius (pixels):</label>
                    <input type="number" id="zone-radius" value="100" min="10">
                </div>
                <div class="form-group">
                    <label>Description:</label>
                    <textarea id="zone-description" rows="3" placeholder="Optional description"></textarea>
                </div>
            </div>
        `;
        
        new Dialog({
            title: "Create Radiation Zone",
            content: content,
            buttons: {
                create: {
                    icon: '<i class="fas fa-radiation"></i>',
                    label: "Create",
                    callback: async (html) => {
                        const zoneData = {
                            name: html.find('#zone-name').val(),
                            radiationLevel: parseInt(html.find('#zone-level').val()),
                            x: parseInt(html.find('#zone-x').val()) || 0,
                            y: parseInt(html.find('#zone-y').val()) || 0,
                            radius: parseInt(html.find('#zone-radius').val()) || 100,
                            description: html.find('#zone-description').val()
                        };
                        
                        try {
                            const radiationModule = game.modules.get('bbttcc-radiation');
                            if (radiationModule?.api?.createRadiationZone) {
                                await radiationModule.api.createRadiationZone(game.scenes.current.id, zoneData);
                            } else {
                                await game.bbttcc.radiation.createRadiationZone(game.scenes.current.id, zoneData);
                            }
                            
                            this.render();
                            
                        } catch (error) {
                            console.error('Error creating radiation zone:', error);
                            ui.notifications.error(`Failed to create radiation zone: ${error.message}`);
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            }
        }).render(true);
    }
    
    /**
     * Handle deleting radiation zone
     */
    async _onDeleteZone(event) {
        event.preventDefault();
        const zoneId = event.currentTarget.dataset.zoneId;
        
        if (!game.scenes.current) return;
        
        const zones = game.scenes.current.flags['bbttcc-radiation']?.zones || [];
        const zone = zones.find(z => z.id === zoneId);
        
        if (!zone) {
            ui.notifications.error('Radiation zone not found');
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: "Delete Radiation Zone",
            content: `<p>Delete radiation zone <strong>${zone.name}</strong>?</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const updatedZones = zones.filter(z => z.id !== zoneId);
            
            await game.scenes.current.update({
                'flags.bbttcc-radiation.zones': updatedZones
            });
            
            ui.notifications.info(`Radiation zone "${zone.name}" deleted`);
            this.render();
            
        } catch (error) {
            console.error('Error deleting radiation zone:', error);
            ui.notifications.error(`Failed to delete radiation zone: ${error.message}`);
        }
    }
    
    /**
     * Handle applying background radiation to all characters
     */
    async _onApplyBackground(event) {
        event.preventDefault();
        
        const backgroundLevel = game.settings.get('bbttcc-radiation', 'backgroundRadiation');
        const characters = game.actors.filter(actor => 
            actor.type === 'character' &&
            actor.system.resources?.tertiary?.label === 'Radiation'
        );
        
        if (characters.length === 0) {
            ui.notifications.warn('No characters with radiation tracking found');
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: "Apply Background Radiation",
            content: `<p>Apply ${backgroundLevel} background radiation to all ${characters.length} characters?</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            for (const character of characters) {
                const radiationModule = game.modules.get('bbttcc-radiation');
                if (radiationModule?.api?.addRadiationExposure) {
                    await radiationModule.api.addRadiationExposure(character, backgroundLevel, 'Background radiation');
                } else {
                    await game.bbttcc.radiation.addRadiationExposure(character, backgroundLevel, 'Background radiation');
                }
            }
            
            ui.notifications.info(`Applied background radiation to ${characters.length} characters`);
            this.render();
            
        } catch (error) {
            console.error('Error applying background radiation:', error);
            ui.notifications.error(`Failed to apply background radiation: ${error.message}`);
        }
    }
    
    /**
     * Get radiation level information (duplicated from main module for tracker use)
     */
    getRadiationLevel(exposure) {
        const RADIATION_LEVELS = {
            safe: { name: 'Safe', min: 0, max: 25, color: '#27ae60' },
            low: { name: 'Low', min: 26, max: 100, color: '#f1c40f' },
            moderate: { name: 'Moderate', min: 101, max: 300, color: '#f39c12' },
            high: { name: 'High', min: 301, max: 600, color: '#e74c3c' },
            severe: { name: 'Severe', min: 601, max: 1000, color: '#8e44ad' },
            lethal: { name: 'Lethal', min: 1001, max: 10000, color: '#2c3e50' }
        };
        
        for (const [key, level] of Object.entries(RADIATION_LEVELS)) {
            if (exposure >= level.min && exposure <= level.max) {
                return { ...level, key: key };
            }
        }
        
        if (exposure > RADIATION_LEVELS.lethal.max) {
            return { 
                ...RADIATION_LEVELS.lethal, 
                key: 'lethal', 
                name: 'Extreme Lethal'
            };
        }
        
        return RADIATION_LEVELS.safe;
    }
}