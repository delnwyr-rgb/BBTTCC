/**
 * BBTTCC Territory Manager v4.8.0 - FIXED
 * UI application for managing territories in a scene
 */

export class TerritoryManager extends Application {
    
    constructor(scene, options = {}) {
        super(options);
        this.scene = scene;
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-territory-manager",
            title: "BBTTCC Territory Manager",
            template: "modules/bbttcc-territory/templates/territory-manager.html",
            width: 800,
            height: 600,
            resizable: true,
            classes: ["bbttcc-territory-manager"]
        });
    }
    
    /** @override */
    async getData() {
        const data = await super.getData();
        
        // Get territories for this scene
        const territories = this.scene.flags['bbttcc-territory']?.territories || [];
        
        // Get all factions
        const factions = game.actors.filter(actor => 
            actor.flags['bbttcc-factions']?.isFaction === true
        );
        
        // Territory types and sizes
        const territoryTypes = {
            settlement: game.i18n.localize("BBTTCC.TerritoryTypes.Settlement"),
            fortress: game.i18n.localize("BBTTCC.TerritoryTypes.Fortress"),
            mine: game.i18n.localize("BBTTCC.TerritoryTypes.Mine"),
            farm: game.i18n.localize("BBTTCC.TerritoryTypes.Farm"),
            port: game.i18n.localize("BBTTCC.TerritoryTypes.Port")
        };
        
        const territorySizes = {
            small: game.i18n.localize("BBTTCC.TerritorySizes.Small"),
            medium: game.i18n.localize("BBTTCC.TerritorySizes.Medium"),
            large: game.i18n.localize("BBTTCC.TerritorySizes.Large"),
            capital: game.i18n.localize("BBTTCC.TerritorySizes.Capital")
        };
        
        return {
            ...data,
            scene: this.scene,
            territories: territories,
            factions: factions,
            territoryTypes: territoryTypes,
            territorySizes: territorySizes
        };
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!game.user.isGM) return;
        
        // Use modern DOM event handling
        const element = html[0];
        
        // Claim territory button
        const claimButton = element.querySelector('#claim-territory');
        if (claimButton) {
            claimButton.addEventListener('click', this._onClaimTerritory.bind(this));
        }
        
        // Contest territory buttons
        element.querySelectorAll('.contest-territory').forEach(button => {
            button.addEventListener('click', this._onContestTerritory.bind(this));
        });
        
        // Delete territory buttons
        element.querySelectorAll('.delete-territory').forEach(button => {
            button.addEventListener('click', this._onDeleteTerritory.bind(this));
        });
        
        // Transfer territory buttons
        element.querySelectorAll('.transfer-territory').forEach(button => {
            button.addEventListener('click', this._onTransferTerritory.bind(this));
        });
        
        console.log('BBTTCC Territory Manager | Event listeners activated');
    }
    
    /**
     * Handle claiming a new territory
     */
    async _onClaimTerritory(event) {
        event.preventDefault();
        
        const form = event.target.closest('form');
        const formData = new FormData(form);
        
        const territoryData = {
            name: formData.get('territory-name'),
            factionId: formData.get('faction-id'),
            sceneId: this.scene.id,
            type: formData.get('territory-type'),
            size: formData.get('territory-size'),
            description: formData.get('territory-description'),
            coordinates: {
                x: parseInt(formData.get('coordinate-x')) || 0,
                y: parseInt(formData.get('coordinate-y')) || 0
            }
        };
        
        if (!territoryData.name || !territoryData.factionId) {
            ui.notifications.warn('Territory name and faction are required');
            return;
        }
        
        try {
            // Get the territory module API
            const territoryModule = game.modules.get('bbttcc-territory');
            if (territoryModule?.api?.claimTerritory) {
                await territoryModule.api.claimTerritory(territoryData);
            } else {
                // Fallback to global function
                await game.bbttcc.territory.claimTerritory(territoryData);
            }
            
            // Clear form and refresh
            form.reset();
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error claiming territory:', error);
            ui.notifications.error(`Failed to claim territory: ${error.message}`);
        }
    }
    
    /**
     * Handle contesting a territory
     */
    async _onContestTerritory(event) {
        event.preventDefault();
        
        const territoryId = event.currentTarget.dataset.territoryId;
        if (!territoryId) {
            ui.notifications.error('Territory ID not found');
            return;
        }
        
        // Show faction selection dialog
        const factions = game.actors.filter(actor => 
            actor.flags['bbttcc-factions']?.isFaction === true
        );
        
        if (factions.length === 0) {
            ui.notifications.warn('No factions available to contest territory');
            return;
        }
        
        const factionOptions = factions.map(f => 
            `<option value="${f.id}">${f.name}</option>`
        ).join('');
        
        const content = `
            <div class="bbttcc-contest-dialog">
                <h4>Select Challenging Faction</h4>
                <div class="form-group">
                    <label>Faction:</label>
                    <select id="challenger-faction">
                        ${factionOptions}
                    </select>
                </div>
            </div>
        `;
        
        new Dialog({
            title: "Contest Territory",
            content: content,
            buttons: {
                contest: {
                    icon: '<i class="fas fa-sword"></i>',
                    label: "Contest",
                    callback: async (html) => {
                        const challengerId = html.find('#challenger-faction').val();
                        if (!challengerId) return;
                        
                        try {
                            const territoryModule = game.modules.get('bbttcc-territory');
                            if (territoryModule?.api?.contestTerritory) {
                                await territoryModule.api.contestTerritory(territoryId, challengerId, this.scene.id);
                            } else {
                                await game.bbttcc.territory.contestTerritory(territoryId, challengerId, this.scene.id);
                            }
                            
                            this.render();
                            
                        } catch (error) {
                            console.error('Error contesting territory:', error);
                            ui.notifications.error(`Failed to contest territory: ${error.message}`);
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
     * Handle deleting a territory
     */
    async _onDeleteTerritory(event) {
        event.preventDefault();
        
        const territoryId = event.currentTarget.dataset.territoryId;
        if (!territoryId) return;
        
        const territories = this.scene.flags['bbttcc-territory']?.territories || [];
        const territory = territories.find(t => t.id === territoryId);
        
        if (!territory) {
            ui.notifications.error('Territory not found');
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: "Delete Territory",
            content: `<p>Are you sure you want to delete the territory <strong>${territory.name}</strong>?</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            // Remove from scene
            const updatedTerritories = territories.filter(t => t.id !== territoryId);
            await this.scene.update({
                'flags.bbttcc-territory.territories': updatedTerritories
            });
            
            // Remove from faction
            if (territory.factionId) {
                const faction = game.actors.get(territory.factionId);
                if (faction) {
                    const factionTerritories = (faction.flags['bbttcc-factions']?.territories || [])
                        .filter(t => t.id !== territoryId);
                    
                    await faction.update({
                        'flags.bbttcc-factions.territories': factionTerritories
                    });
                }
            }
            
            ui.notifications.info(`Territory "${territory.name}" deleted`);
            this.render();
            
        } catch (error) {
            console.error('Error deleting territory:', error);
            ui.notifications.error(`Failed to delete territory: ${error.message}`);
        }
    }
    
    /**
     * Handle transferring a territory to another faction
     */
    async _onTransferTerritory(event) {
        event.preventDefault();
        
        const territoryId = event.currentTarget.dataset.territoryId;
        if (!territoryId) return;
        
        const territories = this.scene.flags['bbttcc-territory']?.territories || [];
        const territory = territories.find(t => t.id === territoryId);
        
        if (!territory) {
            ui.notifications.error('Territory not found');
            return;
        }
        
        const factions = game.actors.filter(actor => 
            actor.flags['bbttcc-factions']?.isFaction === true &&
            actor.id !== territory.factionId
        );
        
        if (factions.length === 0) {
            ui.notifications.warn('No other factions available for transfer');
            return;
        }
        
        const factionOptions = factions.map(f => 
            `<option value="${f.id}">${f.name}</option>`
        ).join('');
        
        const content = `
            <div class="bbttcc-transfer-dialog">
                <h4>Transfer Territory: ${territory.name}</h4>
                <div class="form-group">
                    <label>New Faction:</label>
                    <select id="new-faction">
                        ${factionOptions}
                    </select>
                </div>
            </div>
        `;
        
        new Dialog({
            title: "Transfer Territory",
            content: content,
            buttons: {
                transfer: {
                    icon: '<i class="fas fa-exchange-alt"></i>',
                    label: "Transfer",
                    callback: async (html) => {
                        const newFactionId = html.find('#new-faction').val();
                        if (!newFactionId) return;
                        
                        try {
                            const oldFaction = game.actors.get(territory.factionId);
                            const newFaction = game.actors.get(newFactionId);
                            
                            if (!oldFaction || !newFaction) {
                                throw new Error('Faction not found');
                            }
                            
                            // Use the transfer function (we need to import it)
                            await this._transferTerritory(territory, newFaction, oldFaction);
                            this.render();
                            
                        } catch (error) {
                            console.error('Error transferring territory:', error);
                            ui.notifications.error(`Failed to transfer territory: ${error.message}`);
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
     * Transfer territory between factions (duplicated from main module for manager use)
     */
    async _transferTerritory(territory, newFaction, oldFaction) {
        // Update scene territories
        const territories = this.scene.flags['bbttcc-territory']?.territories || [];
        const territoryIndex = territories.findIndex(t => t.id === territory.id);
        
        if (territoryIndex !== -1) {
            territories[territoryIndex].factionId = newFaction.id;
            territories[territoryIndex].factionName = newFaction.name;
            territories[territoryIndex].claimedAt = new Date().toISOString();
            
            await this.scene.update({
                'flags.bbttcc-territory.territories': territories
            });
        }
        
        // Remove from old faction
        const oldTerritories = (oldFaction.flags['bbttcc-factions']?.territories || [])
            .filter(t => t.id !== territory.id);
        
        await oldFaction.update({
            'flags.bbttcc-factions.territories': oldTerritories
        });
        
        // Add to new faction
        const newTerritories = newFaction.flags['bbttcc-factions']?.territories || [];
        newTerritories.push({
            id: territory.id,
            name: territory.name,
            sceneId: this.scene.id,
            sceneName: this.scene.name,
            type: territory.type,
            size: territory.size,
            resources: territory.resources
        });
        
        await newFaction.update({
            'flags.bbttcc-factions.territories': newTerritories
        });
        
        ui.notifications.info(`${territory.name} transferred from ${oldFaction.name} to ${newFaction.name}`);
    }
}