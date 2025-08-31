/**
 * BBTTCC Radiation Zone Configuration - Modern UI Application
 * Scene-wide radiation zone management interface
 */

export class RadiationZoneConfig extends Application {
    
    constructor(scene, options = {}) {
        super(options);
        this.scene = scene || canvas.scene;
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-radiation-zone-config",
            title: "Radiation Zone Configuration",
            template: "modules/bbttcc-radiation/templates/radiation-zone.html",
            width: 600,
            height: 500,
            resizable: true,
            classes: ["bbttcc-radiation-zone-config"]
        });
    }
    
    /** @override */
    async getData(options) {
        const data = await super.getData(options);
        
        if (!this.scene) {
            return { ...data, error: 'No scene available' };
        }
        
        // Get radiation module API
        const radiationModule = game.modules.get('bbttcc-radiation');
        const api = radiationModule?.api;
        
        if (!api) {
            return { ...data, error: 'BBTTCC Radiation module not available' };
        }
        
        // Get zone data
        const currentZone = api.getSceneRadiationZone(this.scene);
        const ZONE_TYPES = api.ZONE_TYPES || {};
        const RADIATION_LEVELS = api.RADIATION_LEVELS || {};
        
        // Get tokens in scene for preview
        const tokens = this.scene.tokens.contents || [];
        const tokenCount = tokens.length;
        const affectedTokens = tokens.filter(token => {
            if (!token.actor) return false;
            const radiationData = api.getRadiationData(token);
            return radiationData && radiationData.effectiveLevel > 10; // Above safe level
        });
        
        return {
            ...data,
            scene: this.scene,
            currentZone: currentZone,
            zoneTypes: ZONE_TYPES,
            radiationLevels: RADIATION_LEVELS,
            tokenCount: tokenCount,
            affectedTokens: affectedTokens.length,
            isGM: game.user.isGM,
            previewData: this.calculateZonePreview(currentZone, tokens)
        };
    }
    
    /** @override */
    get title() {
        return `Radiation Zone Configuration - ${this.scene?.name || 'Unknown Scene'}`;
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!game.user.isGM) return;
        
        const element = html[0];
        
        // Zone type selection
        const zoneSelect = element.querySelector('#zone-type');
        if (zoneSelect) {
            zoneSelect.addEventListener('change', this._onZoneTypeChange.bind(this));
        }
        
        // Custom intensity input
        const customIntensityInput = element.querySelector('#custom-intensity');
        if (customIntensityInput) {
            customIntensityInput.addEventListener('input', this._onCustomIntensityChange.bind(this));
        }
        
        // Apply zone button
        const applyButton = element.querySelector('#apply-zone');
        if (applyButton) {
            applyButton.addEventListener('click', this._onApplyZone.bind(this));
        }
        
        // Reset zone button
        const resetButton = element.querySelector('#reset-zone');
        if (resetButton) {
            resetButton.addEventListener('click', this._onResetZone.bind(this));
        }
        
        // Preview button
        const previewButton = element.querySelector('#preview-effects');
        if (previewButton) {
            previewButton.addEventListener('click', this._onPreviewEffects.bind(this));
        }
        
        // Batch operations
        element.querySelectorAll('.batch-operation').forEach(button => {
            button.addEventListener('click', this._onBatchOperation.bind(this));
        });
        
        console.log('BBTTCC Radiation Zone Config | Event listeners activated');
    }
    
    /**
     * Calculate preview data for the zone
     */
    calculateZonePreview(zoneData, tokens) {
        if (!zoneData || !tokens) return null;
        
        const radiationModule = game.modules.get('bbttcc-radiation');
        const api = radiationModule?.api;
        if (!api) return null;
        
        const preview = {
            totalExposure: 0,
            estimatedTime: {
                toModerate: 0,
                toHigh: 0,
                toLethal: 0
            },
            protectionRequired: 0
        };
        
        // Calculate exposure rate per minute
        const exposurePerTick = zoneData.intensity * 0.1;
        const tickInterval = game.settings.get('bbttcc-radiation', 'trackingInterval') || 180; // seconds
        const exposurePerMinute = (exposurePerTick / tickInterval) * 60;
        
        preview.totalExposure = exposurePerMinute;
        
        // Calculate time to reach danger levels (assuming 100 threshold)
        const threshold = 100;
        if (exposurePerMinute > 0) {
            preview.estimatedTime.toModerate = Math.ceil((threshold * 0.26) / exposurePerMinute); // 26% = moderate
            preview.estimatedTime.toHigh = Math.ceil((threshold * 0.51) / exposurePerMinute); // 51% = high
            preview.estimatedTime.toLethal = Math.ceil((threshold * 0.91) / exposurePerMinute); // 91% = lethal
        }
        
        // Calculate required protection to be safe
        const safeLevel = 10; // Safe radiation level
        if (zoneData.intensity > safeLevel) {
            preview.protectionRequired = Math.ceil(((zoneData.intensity - safeLevel) / zoneData.intensity) * 100);
        }
        
        return preview;
    }
    
    /**
     * Handle zone type change
     */
    _onZoneTypeChange(event) {
        const zoneType = event.target.value;
        const radiationModule = game.modules.get('bbttcc-radiation');
        const zoneData = radiationModule.api.ZONE_TYPES[zoneType];
        
        if (zoneData) {
            // Update custom intensity field to match zone type
            const customInput = event.target.closest('form').querySelector('#custom-intensity');
            if (customInput) {
                customInput.value = zoneData.intensity;
            }
            
            // Update preview
            this._updatePreview();
        }
    }
    
    /**
     * Handle custom intensity change
     */
    _onCustomIntensityChange(event) {
        this._updatePreview();
    }
    
    /**
     * Update preview display
     */
    _updatePreview() {
        // This would update the preview section in real-time
        // For now, we'll just trigger a re-render
        setTimeout(() => this.render(), 100);
    }
    
    /**
     * Handle applying zone configuration
     */
    async _onApplyZone(event) {
        event.preventDefault();
        
        try {
            const form = event.target.closest('form');
            const formData = new FormData(form);
            
            const zoneType = formData.get('zone-type');
            const customIntensity = parseInt(formData.get('custom-intensity'));
            
            if (!zoneType) {
                ui.notifications.warn('Please select a zone type');
                return;
            }
            
            const radiationModule = game.modules.get('bbttcc-radiation');
            await radiationModule.api.setSceneRadiationZone(
                this.scene, 
                zoneType, 
                isNaN(customIntensity) ? null : customIntensity
            );
            
            ui.notifications.info(`Radiation zone updated for ${this.scene.name}`);
            
            // Refresh the configuration
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Zone Config | Error applying zone:', error);
            ui.notifications.error(`Failed to apply zone configuration: ${error.message}`);
        }
    }
    
    /**
     * Handle resetting zone to default
     */
    async _onResetZone(event) {
        event.preventDefault();
        
        const confirmed = await Dialog.confirm({
            title: "Reset Radiation Zone",
            content: `<p>Are you sure you want to reset the radiation zone for <strong>${this.scene.name}</strong> to background levels?</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            await radiationModule.api.setSceneRadiationZone(this.scene, 'background');
            
            ui.notifications.info(`Radiation zone reset for ${this.scene.name}`);
            
            // Refresh the configuration
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Radiation Zone Config | Error resetting zone:', error);
            ui.notifications.error(`Failed to reset zone: ${error.message}`);
        }
    }
    
    /**
     * Handle previewing effects on tokens
     */
    async _onPreviewEffects(event) {
        event.preventDefault();
        
        try {
            const form = event.target.closest('form');
            const formData = new FormData(form);
            const customIntensity = parseInt(formData.get('custom-intensity')) || 0;
            
            const radiationModule = game.modules.get('bbttcc-radiation');
            const api = radiationModule.api;
            
            // Calculate what would happen to each token
            const tokens = this.scene.tokens.contents;
            const results = [];
            
            for (const tokenDoc of tokens) {
                if (!tokenDoc.actor) continue;
                
                const currentData = api.getRadiationData(tokenDoc) || api.DEFAULT_RADIATION_STRUCTURE;
                const exposure = customIntensity * 0.1; // Single tick exposure
                const effectiveExposure = Math.max(0, exposure - (exposure * currentData.protection / 100));
                const newLevel = Math.min(100, (currentData.exposure + effectiveExposure) / currentData.threshold * 100);
                const radiationLevel = api.getRadiationLevel(newLevel);
                
                results.push({
                    name: tokenDoc.name,
                    currentLevel: api.getRadiationLevel(currentData.level).name,
                    projectedLevel: radiationLevel.name,
                    exposure: effectiveExposure.toFixed(2),
                    protection: currentData.protection
                });
            }
            
            // Show results in a dialog
            const content = `
                <div style="max-height: 300px; overflow-y: auto;">
                    <h4>Projected Effects (Single Update Cycle)</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f0f0f0;">
                                <th style="padding: 5px; border: 1px solid #ccc;">Token</th>
                                <th style="padding: 5px; border: 1px solid #ccc;">Current</th>
                                <th style="padding: 5px; border: 1px solid #ccc;">Projected</th>
                                <th style="padding: 5px; border: 1px solid #ccc;">Exposure</th>
                                <th style="padding: 5px; border: 1px solid #ccc;">Protection</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.map(r => `
                                <tr>
                                    <td style="padding: 5px; border: 1px solid #ccc;">${r.name}</td>
                                    <td style="padding: 5px; border: 1px solid #ccc;">${r.currentLevel}</td>
                                    <td style="padding: 5px; border: 1px solid #ccc;">${r.projectedLevel}</td>
                                    <td style="padding: 5px; border: 1px solid #ccc;">${r.exposure}</td>
                                    <td style="padding: 5px; border: 1px solid #ccc;">${r.protection}%</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <p style="margin-top: 15px; font-size: 12px; color: #666;">
                        <em>This preview shows the effect of one tracking cycle. Actual accumulation happens over time.</em>
                    </p>
                </div>
            `;
            
            new Dialog({
                title: "Radiation Effects Preview",
                content: content,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "OK"
                    }
                }
            }).render(true);
            
        } catch (error) {
            console.error('BBTTCC Radiation Zone Config | Error previewing effects:', error);
            ui.notifications.error(`Failed to preview effects: ${error.message}`);
        }
    }
    
    /**
     * Handle batch operations on tokens
     */
    async _onBatchOperation(event) {
        event.preventDefault();
        
        const operation = event.target.dataset.operation;
        if (!operation) return;
        
        try {
            const radiationModule = game.modules.get('bbttcc-radiation');
            const api = radiationModule.api;
            const tokens = this.scene.tokens.contents.filter(t => t.actor);
            
            if (tokens.length === 0) {
                ui.notifications.warn('No tokens found in this scene');
                return;
            }
            
            let processed = 0;
            
            switch (operation) {
                case 'reset-all':
                    const confirmed = await Dialog.confirm({
                        title: "Reset All Radiation",
                        content: `<p>Reset radiation data for all ${tokens.length} tokens in this scene?</p>`,
                        yes: () => true,
                        no: () => false
                    });
                    
                    if (!confirmed) return;
                    
                    for (const tokenDoc of tokens) {
                        const defaultData = foundry.utils.deepClone(api.DEFAULT_RADIATION_STRUCTURE);
                        await tokenDoc.actor.setFlag('bbttcc-radiation', 'radiation', defaultData);
                        processed++;
                    }
                    break;
                    
                case 'apply-protection':
                    // Show protection selection dialog
                    const protectionDialog = new Dialog({
                        title: "Apply Protection to All Tokens",
                        content: `
                            <div>
                                <label for="batch-protection">Protection Type:</label>
                                <select id="batch-protection" style="width: 100%; margin-top: 5px;">
                                    ${Object.entries(api.PROTECTION_TYPES).map(([key, data]) => 
                                        `<option value="${key}">${data.name} (${data.protection}%)</option>`
                                    ).join('')}
                                </select>
                            </div>
                        `,
                        buttons: {
                            apply: {
                                icon: '<i class="fas fa-shield-alt"></i>',
                                label: "Apply",
                                callback: async (html) => {
                                    const protectionType = html.find('#batch-protection').val();
                                    for (const tokenDoc of tokens) {
                                        await api.setProtectionLevel(tokenDoc, protectionType);
                                        processed++;
                                    }
                                    ui.notifications.info(`Applied protection to ${processed} tokens`);
                                }
                            },
                            cancel: {
                                icon: '<i class="fas fa-times"></i>',
                                label: "Cancel"
                            }
                        }
                    });
                    
                    protectionDialog.render(true);
                    return; // Don't show success message yet
                    
                default:
                    ui.notifications.warn(`Unknown operation: ${operation}`);
                    return;
            }
            
            if (processed > 0) {
                ui.notifications.info(`Successfully processed ${processed} tokens`);
                this.render();
            }
            
        } catch (error) {
            console.error('BBTTCC Radiation Zone Config | Error in batch operation:', error);
            ui.notifications.error(`Failed to perform batch operation: ${error.message}`);
        }
    }
}