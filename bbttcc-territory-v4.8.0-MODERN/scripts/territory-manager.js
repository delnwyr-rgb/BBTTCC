/**
 * BBTTCC Territory Manager v4.8.0 - MODERN
 * Modern UI application for managing territories with proper async patterns
 */

export class TerritoryManager extends Application {
    
    constructor(scene = null, options = {}) {
        super(options);
        this.scene = scene || canvas.scene;
        this.moduleId = 'bbttcc-territory';
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-territory-manager-modern",
            title: "BBTTCC Territory Manager - MODERN",
            template: "modules/bbttcc-territory/templates/territory-manager.html",
            width: 900,
            height: 700,
            resizable: true,
            classes: ["bbttcc-territory-manager", "modern-ui"],
            tabs: [
                {
                    navSelector: ".tabs",
                    contentSelector: ".tab-content",
                    initial: "territories"
                }
            ]
        });
    }
    
    /** @override */
    async getData() {
        try {
            const data = await super.getData();
            
            if (!this.scene) {
                return {
                    ...data,
                    error: "No active scene available",
                    territories: [],
                    factions: []
                };
            }
            
            // Get territories for this scene with safe flag access
            const territories = this.scene.getFlag(this.moduleId, 'territories') || {};
            const territoryList = Object.entries(territories).map(([id, territory]) => ({
                id,
                ...territory
            }));
            
            // Get all factions with enhanced filtering
            const factions = game.actors.filter(actor => {
                try {
                    return actor.getFlag('bbttcc-factions', 'isFaction') === true;
                } catch (error) {
                    return false;
                }
            });
            
            // Territory types and sizes with enhanced data
            const territoryTypes = {
                settlement: { name: "Settlement", icon: "fas fa-home" },
                fortress: { name: "Fortress", icon: "fas fa-shield-alt" },
                mine: { name: "Mine", icon: "fas fa-mountain" },
                farm: { name: "Farm", icon: "fas fa-wheat" },
                port: { name: "Port", icon: "fas fa-anchor" },
                factory: { name: "Factory", icon: "fas fa-industry" },
                research: { name: "Research Facility", icon: "fas fa-flask" }
            };
            
            const territorySizes = {
                small: { name: "Small", multiplier: 0.5 },
                medium: { name: "Medium", multiplier: 1.0 },
                large: { name: "Large", multiplier: 2.0 },
                capital: { name: "Capital", multiplier: 4.0 }
            };
            
            const territoryStatuses = {
                unclaimed: { name: "Unclaimed", color: "#808080", icon: "fas fa-question" },
                claimed: { name: "Claimed", color: "#28a745", icon: "fas fa-flag" },
                contested: { name: "Contested", color: "#ffc107", icon: "fas fa-exclamation-triangle" },
                occupied: { name: "Occupied", color: "#dc3545", icon: "fas fa-times-circle" }
            };
            
            // Calculate territory statistics
            const stats = this.calculateTerritoryStats(territoryList, factions);
            
            return {
                ...data,
                scene: this.scene,
                territories: territoryList,
                factions: factions,
                territoryTypes: territoryTypes,
                territorySizes: territorySizes,
                territoryStatuses: territoryStatuses,
                stats: stats,
                isGM: game.user.isGM,
                moduleVersion: '4.8.0-MODERN'
            };
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error preparing data:', error);
            return {
                error: `Failed to load territory data: ${error.message}`,
                territories: [],
                factions: []
            };
        }
    }
    
    /**
     * Calculate territory statistics
     */
    calculateTerritoryStats(territories, factions) {
        try {
            const stats = {
                total: territories.length,
                byStatus: {},
                byType: {},
                byFaction: {},
                totalResources: {}
            };
            
            // Initialize counters
            const statuses = ['unclaimed', 'claimed', 'contested', 'occupied'];
            statuses.forEach(status => stats.byStatus[status] = 0);
            
            // Calculate statistics
            territories.forEach(territory => {
                // Status distribution
                stats.byStatus[territory.status] = (stats.byStatus[territory.status] || 0) + 1;
                
                // Type distribution
                stats.byType[territory.type] = (stats.byType[territory.type] || 0) + 1;
                
                // Faction distribution
                if (territory.claimedBy) {
                    const faction = factions.find(f => f.id === territory.claimedBy);
                    const factionName = faction ? faction.name : 'Unknown Faction';
                    stats.byFaction[factionName] = (stats.byFaction[factionName] || 0) + 1;
                }
                
                // Resource totals
                if (territory.resources) {
                    Object.entries(territory.resources).forEach(([resource, amount]) => {
                        stats.totalResources[resource] = (stats.totalResources[resource] || 0) + amount;
                    });
                }
            });
            
            return stats;
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error calculating stats:', error);
            return { total: 0, byStatus: {}, byType: {}, byFaction: {}, totalResources: {} };
        }
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        try {
            // Modern event handling with proper cleanup
            const element = html[0] || html;
            
            // Territory management buttons
            this._addEventListeners(element, '.territory-add', this._onTerritoryAdd.bind(this));
            this._addEventListeners(element, '.territory-edit', this._onTerritoryEdit.bind(this));
            this._addEventListeners(element, '.territory-delete', this._onTerritoryDelete.bind(this));
            this._addEventListeners(element, '.territory-claim', this._onTerritoryClaim.bind(this));
            this._addEventListeners(element, '.territory-contest', this._onTerritoryContest.bind(this));
            
            // Bulk operations
            this._addEventListeners(element, '.bulk-recalculate', this._onBulkRecalculate.bind(this));
            this._addEventListeners(element, '.export-data', this._onExportData.bind(this));
            this._addEventListeners(element, '.import-data', this._onImportData.bind(this));
            
            // Refresh button
            this._addEventListeners(element, '.refresh-territories', this._onRefresh.bind(this));
            
            console.log('BBTTCC Territory Manager | Modern event listeners activated');
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error activating listeners:', error);
        }
    }
    
    /**
     * Modern event listener helper
     */
    _addEventListeners(element, selector, handler) {
        try {
            element.querySelectorAll(selector).forEach(button => {
                button.addEventListener('click', handler);
            });
        } catch (error) {
            console.warn(`BBTTCC Territory Manager | Failed to setup listeners for ${selector}:`, error);
        }
    }
    
    /**
     * Add new territory
     */
    async _onTerritoryAdd(event) {
        event.preventDefault();
        
        try {
            const territoryData = await this._getTerritoryDataFromDialog();
            if (!territoryData) return; // User cancelled
            
            // Get the modern API
            const api = game.modules.get(this.moduleId)?.api;
            if (!api) {
                throw new Error('Territory API not available');
            }
            
            // Create territory using modern API
            await api.claimTerritory(territoryData);
            
            // Refresh the manager
            this.render(false);
            
            ui.notifications.info(`Territory "${territoryData.name}" added successfully!`);
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error adding territory:', error);
            ui.notifications.error(`Failed to add territory: ${error.message}`);
        }
    }
    
    /**
     * Edit existing territory
     */
    async _onTerritoryEdit(event) {
        event.preventDefault();
        
        try {
            const territoryId = event.currentTarget.dataset.territoryId;
            if (!territoryId) return;
            
            const territories = this.scene.getFlag(this.moduleId, 'territories') || {};
            const territory = territories[territoryId];
            
            if (!territory) {
                throw new Error('Territory not found');
            }
            
            const updatedData = await this._getTerritoryDataFromDialog(territory);
            if (!updatedData) return; // User cancelled
            
            // Update territory data
            const updatedTerritory = {
                ...territory,
                ...updatedData,
                lastUpdated: new Date().toISOString()
            };
            
            territories[territoryId] = updatedTerritory;
            await this.scene.setFlag(this.moduleId, 'territories', territories);
            
            // Refresh visualization
            const territoryModule = game.modules.get(this.moduleId);
            if (territoryModule && territoryModule.api) {
                await territoryModule.api.refreshTerritoryVisualization?.();
            }
            
            this.render(false);
            ui.notifications.info(`Territory "${updatedTerritory.name}" updated successfully!`);
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error editing territory:', error);
            ui.notifications.error(`Failed to edit territory: ${error.message}`);
        }
    }
    
    /**
     * Delete territory
     */
    async _onTerritoryDelete(event) {
        event.preventDefault();
        
        try {
            const territoryId = event.currentTarget.dataset.territoryId;
            if (!territoryId) return;
            
            const territories = this.scene.getFlag(this.moduleId, 'territories') || {};
            const territory = territories[territoryId];
            
            if (!territory) {
                throw new Error('Territory not found');
            }
            
            const confirmed = await Dialog.confirm({
                title: "Delete Territory",
                content: `<p>Are you sure you want to delete the territory "<strong>${territory.name}</strong>"?</p>
                         <p><em>This action cannot be undone.</em></p>`,
                defaultYes: false
            });
            
            if (!confirmed) return;
            
            // Remove from scene flags
            delete territories[territoryId];
            await this.scene.setFlag(this.moduleId, 'territories', territories);
            
            // Remove from faction territory lists
            if (territory.claimedBy) {
                const faction = game.actors.get(territory.claimedBy);
                if (faction && faction.getFlag('bbttcc-factions', 'isFaction')) {
                    const factionTerritories = faction.getFlag('bbttcc-factions', 'territories') || [];
                    const updatedTerritories = factionTerritories.filter(t => t !== territoryId);
                    await faction.setFlag('bbttcc-factions', 'territories', updatedTerritories);
                }
            }
            
            // Refresh visualization
            const territoryModule = game.modules.get(this.moduleId);
            if (territoryModule && territoryModule.api) {
                await territoryModule.api.refreshTerritoryVisualization?.();
            }
            
            this.render(false);
            ui.notifications.info(`Territory "${territory.name}" deleted successfully!`);
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error deleting territory:', error);
            ui.notifications.error(`Failed to delete territory: ${error.message}`);
        }
    }
    
    /**
     * Claim territory for a faction
     */
    async _onTerritoryClaim(event) {
        event.preventDefault();
        
        try {
            const territoryId = event.currentTarget.dataset.territoryId;
            if (!territoryId) return;
            
            // Get faction selection from user
            const factions = game.actors.filter(actor => 
                actor.getFlag('bbttcc-factions', 'isFaction')
            );
            
            if (factions.length === 0) {
                ui.notifications.warn('No factions available. Create a faction first.');
                return;
            }
            
            const selectedFaction = await this._getFactionSelectionDialog(factions);
            if (!selectedFaction) return;
            
            // Update territory
            const api = game.modules.get(this.moduleId)?.api;
            if (!api) {
                throw new Error('Territory API not available');
            }
            
            await api.updateTerritoryStatus(this.scene, territoryId, 'claimed');
            
            // Update territory with faction info
            const territories = this.scene.getFlag(this.moduleId, 'territories') || {};
            if (territories[territoryId]) {
                territories[territoryId].claimedBy = selectedFaction;
                territories[territoryId].claimedAt = new Date().toISOString();
                await this.scene.setFlag(this.moduleId, 'territories', territories);
            }
            
            this.render(false);
            ui.notifications.info('Territory claimed successfully!');
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error claiming territory:', error);
            ui.notifications.error(`Failed to claim territory: ${error.message}`);
        }
    }
    
    /**
     * Contest territory
     */
    async _onTerritoryContest(event) {
        event.preventDefault();
        
        try {
            const territoryId = event.currentTarget.dataset.territoryId;
            if (!territoryId) return;
            
            const api = game.modules.get(this.moduleId)?.api;
            if (!api) {
                throw new Error('Territory API not available');
            }
            
            await api.contestTerritory(territoryId, game.user.id);
            
            this.render(false);
            ui.notifications.info('Territory contested successfully!');
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error contesting territory:', error);
            ui.notifications.error(`Failed to contest territory: ${error.message}`);
        }
    }
    
    /**
     * Bulk recalculate resources
     */
    async _onBulkRecalculate(event) {
        event.preventDefault();
        
        try {
            const api = game.modules.get(this.moduleId)?.api;
            if (!api) {
                throw new Error('Territory API not available');
            }
            
            const territories = this.scene.getFlag(this.moduleId, 'territories') || {};
            let updated = 0;
            
            for (const [territoryId, territory] of Object.entries(territories)) {
                const newResources = await api.calculateTerritoryResources(territory.type, territory.size);
                territory.resources = newResources;
                territory.lastUpdated = new Date().toISOString();
                updated++;
            }
            
            await this.scene.setFlag(this.moduleId, 'territories', territories);
            
            this.render(false);
            ui.notifications.info(`Recalculated resources for ${updated} territories`);
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error recalculating resources:', error);
            ui.notifications.error(`Failed to recalculate resources: ${error.message}`);
        }
    }
    
    /**
     * Export territory data
     */
    async _onExportData(event) {
        event.preventDefault();
        
        try {
            const territories = this.scene.getFlag(this.moduleId, 'territories') || {};
            
            const exportData = {
                scene: this.scene.name,
                territories: territories,
                exportedAt: new Date().toISOString(),
                moduleVersion: '4.8.0-MODERN'
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `bbttcc-territories-${this.scene.name}-${Date.now()}.json`;
            link.click();
            
            ui.notifications.info('Territory data exported successfully!');
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error exporting data:', error);
            ui.notifications.error(`Failed to export data: ${error.message}`);
        }
    }
    
    /**
     * Import territory data
     */
    async _onImportData(event) {
        event.preventDefault();
        
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const text = await file.text();
                    const importData = JSON.parse(text);
                    
                    if (!importData.territories) {
                        throw new Error('Invalid territory data file');
                    }
                    
                    const confirmed = await Dialog.confirm({
                        title: "Import Territory Data",
                        content: `<p>Import ${Object.keys(importData.territories).length} territories?</p>
                                 <p><em>This will overwrite existing territories.</em></p>`,
                        defaultYes: false
                    });
                    
                    if (confirmed) {
                        await this.scene.setFlag(this.moduleId, 'territories', importData.territories);
                        this.render(false);
                        ui.notifications.info('Territory data imported successfully!');
                    }
                    
                } catch (importError) {
                    console.error('Import error:', importError);
                    ui.notifications.error(`Import failed: ${importError.message}`);
                }
            };
            
            input.click();
            
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error importing data:', error);
            ui.notifications.error(`Failed to import data: ${error.message}`);
        }
    }
    
    /**
     * Refresh territory manager
     */
    async _onRefresh(event) {
        event.preventDefault();
        
        try {
            this.render(false);
            ui.notifications.info('Territory Manager refreshed');
        } catch (error) {
            console.error('BBTTCC Territory Manager | Error refreshing:', error);
        }
    }
    
    /**
     * Get territory data from dialog
     */
    async _getTerritoryDataFromDialog(existingData = null) {
        return new Promise(resolve => {
            const territoryTypes = ['settlement', 'fortress', 'mine', 'farm', 'port', 'factory', 'research'];
            const territorySizes = ['small', 'medium', 'large', 'capital'];
            const territoryStatuses = ['unclaimed', 'claimed', 'contested', 'occupied'];
            
            const content = `
                <form class="modern-territory-form">
                    <div class="form-group">
                        <label><strong>Territory Name:</strong></label>
                        <input type="text" name="name" value="${existingData?.name || ''}" placeholder="Enter territory name..." required />
                    </div>
                    <div class="form-group">
                        <label><strong>Type:</strong></label>
                        <select name="type" required>
                            ${territoryTypes.map(type => `
                                <option value="${type}" ${existingData?.type === type ? 'selected' : ''}>
                                    ${type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label><strong>Size:</strong></label>
                        <select name="size" required>
                            ${territorySizes.map(size => `
                                <option value="${size}" ${existingData?.size === size ? 'selected' : ''}>
                                    ${size.charAt(0).toUpperCase() + size.slice(1)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label><strong>Status:</strong></label>
                        <select name="status" required>
                            ${territoryStatuses.map(status => `
                                <option value="${status}" ${existingData?.status === status ? 'selected' : ''}>
                                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label><strong>Description (Optional):</strong></label>
                        <textarea name="description" rows="3" placeholder="Territory description...">${existingData?.description || ''}</textarea>
                    </div>
                </form>
                <style>
                    .modern-territory-form .form-group { margin-bottom: 15px; }
                    .modern-territory-form label { display: block; margin-bottom: 5px; color: #2c3e50; }
                    .modern-territory-form input, .modern-territory-form select, .modern-territory-form textarea { 
                        width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; 
                        font-family: inherit;
                    }
                </style>
            `;
            
            new Dialog({
                title: existingData ? "Edit Territory" : "Add Territory",
                content: content,
                buttons: {
                    save: {
                        label: `<i class="fas fa-save"></i> ${existingData ? 'Update' : 'Create'}`,
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            if (formData.name && formData.name.trim()) {
                                resolve(formData);
                            } else {
                                ui.notifications.warn('Territory name is required');
                                resolve(null);
                            }
                        }
                    },
                    cancel: {
                        label: '<i class="fas fa-times"></i> Cancel',
                        callback: () => resolve(null)
                    }
                },
                default: "save"
            }).render(true);
        });
    }
    
    /**
     * Get faction selection from dialog
     */
    async _getFactionSelectionDialog(factions) {
        return new Promise(resolve => {
            const content = `
                <form class="faction-selection-form">
                    <div class="form-group">
                        <label><strong>Select Faction:</strong></label>
                        <select name="faction" required>
                            <option value="">Choose a faction...</option>
                            ${factions.map(faction => `
                                <option value="${faction.id}">${faction.name}</option>
                            `).join('')}
                        </select>
                    </div>
                </form>
                <style>
                    .faction-selection-form .form-group { margin-bottom: 15px; }
                    .faction-selection-form label { display: block; margin-bottom: 5px; color: #2c3e50; }
                    .faction-selection-form select { 
                        width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; 
                        font-family: inherit;
                    }
                </style>
            `;
            
            new Dialog({
                title: "Claim Territory",
                content: content,
                buttons: {
                    claim: {
                        label: '<i class="fas fa-flag"></i> Claim',
                        callback: (html) => {
                            const formData = new FormDataExtended(html[0].querySelector('form')).object;
                            resolve(formData.faction || null);
                        }
                    },
                    cancel: {
                        label: '<i class="fas fa-times"></i> Cancel',
                        callback: () => resolve(null)
                    }
                },
                default: "claim"
            }).render(true);
        });
    }
}