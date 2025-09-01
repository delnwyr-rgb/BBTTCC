/**
 * BBTTCC Radiation Zone Creator Macro - v4.8.1-ENHANCED
 * Enhanced macro for setting up radiation zones with modern async patterns
 */

(async () => {
    'use strict';
    
    console.log('BBTTCC Radiation Zone Creator | Modern macro starting');
    
    try {
        // Check if user is GM
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can configure radiation zones');
            return;
        }
        
        // Check if we have a current scene
        if (!canvas.scene) {
            ui.notifications.error('No active scene found');
            return;
        }
        
        // Get the BBTTCC Radiation module with timeout protection
        let radiationModule;
        try {
            radiationModule = game.modules.get('bbttcc-radiation');
            if (!radiationModule || !radiationModule.active) {
                throw new Error('BBTTCC Radiation module not found or not active');
            }
            
            // Wait for API to be ready with timeout
            console.log('BBTTCC Radiation Zone Creator | Waiting for module API...');
            const api = await Promise.race([
                radiationModule.api?.waitForReady?.(10000) || Promise.resolve(radiationModule.api),
                new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 10000))
            ]);
            
            if (!api || !api.setSceneRadiationZone) {
                throw new Error('BBTTCC Radiation API not available');
            }
            
            console.log('BBTTCC Radiation Zone Creator | API ready, proceeding with dialog');
            
        } catch (error) {
            console.error('BBTTCC Radiation Zone Creator | Module/API error:', error);
            ui.notifications.error(`BBTTCC Radiation module error: ${error.message}`);
            return;
        }
        
        // Get current zone data
        const currentZone = radiationModule.api.getSceneRadiationZone();
        const ZONE_TYPES = radiationModule.api.ZONE_TYPES || {};
        
        // Create zone type options
        const zoneOptions = Object.entries(ZONE_TYPES).map(([key, data]) => 
            `<option value="${key}" ${currentZone.type === key ? 'selected' : ''}>${data.name} (Intensity: ${data.intensity})</option>`
        ).join('');
        
        // Get scene statistics
        const tokens = canvas.scene.tokens.contents || [];
        const tokenCount = tokens.length;
        const affectedTokens = tokens.filter(token => {
            if (!token.actor) return false;
            const radiationData = radiationModule.api.getRadiationData(token);
            return radiationData && radiationData.effectiveLevel > 10;
        }).length;
        
        // Enhanced dialog content
        const content = `
            <style>
                .bbttcc-radiation-zone-dialog { 
                    font-family: 'Roboto', sans-serif; 
                    padding: 10px;
                }
                .dialog-header {
                    background: linear-gradient(90deg, #4a5c2a 0%, #6b8e23 100%);
                    color: white;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                    text-align: center;
                }
                .scene-stats {
                    display: flex;
                    justify-content: space-around;
                    background: #f5f5f5;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                }
                .stat-item {
                    text-align: center;
                }
                .stat-value {
                    font-size: 1.5em;
                    font-weight: bold;
                    color: #6b8e23;
                }
                .stat-label {
                    font-size: 0.9em;
                    color: #666;
                }
                .current-zone {
                    background: #e8f5e8;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 15px;
                }
                .bbttcc-radiation-zone-dialog .form-group { 
                    margin-bottom: 15px; 
                }
                .bbttcc-radiation-zone-dialog label { 
                    display: block; 
                    font-weight: bold; 
                    margin-bottom: 5px; 
                    color: #333;
                }
                .bbttcc-radiation-zone-dialog input, 
                .bbttcc-radiation-zone-dialog select { 
                    width: 100%; 
                    padding: 8px; 
                    border: 2px solid #ccc; 
                    border-radius: 4px; 
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .bbttcc-radiation-zone-dialog input:focus, 
                .bbttcc-radiation-zone-dialog select:focus { 
                    border-color: #6b8e23; 
                    outline: none; 
                }
                .bbttcc-radiation-zone-dialog .hint {
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    font-style: italic;
                }
                .zone-descriptions {
                    background: #f9f9f9;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 10px;
                    font-size: 0.9em;
                }
                .zone-description-item {
                    margin-bottom: 5px;
                    padding: 3px 0;
                    border-bottom: 1px solid #ddd;
                }
                .zone-description-item:last-child {
                    border-bottom: none;
                }
                .warning-box {
                    background: #fff3cd;
                    border: 2px solid #ffeeba;
                    color: #856404;
                    padding: 10px;
                    border-radius: 4px;
                    margin-top: 15px;
                }
            </style>
            
            <div class="bbttcc-radiation-zone-dialog">
                <div class="dialog-header">
                    <h3>Configure Radiation Zone</h3>
                    <h4>${canvas.scene.name}</h4>
                </div>
                
                <div class="scene-stats">
                    <div class="stat-item">
                        <div class="stat-value">${tokenCount}</div>
                        <div class="stat-label">Total Tokens</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${affectedTokens}</div>
                        <div class="stat-label">Affected by Radiation</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${currentZone.intensity}</div>
                        <div class="stat-label">Current Intensity</div>
                    </div>
                </div>
                
                <div class="current-zone">
                    <strong>Current Zone:</strong> ${currentZone.description || 'Unknown'}
                    ${currentZone.setAt ? `<br><small>Last updated: ${new Date(currentZone.setAt).toLocaleString()}</small>` : ''}
                </div>
                
                <div class="form-group">
                    <label for="zone-type">Zone Type *</label>
                    <select id="zone-type" name="zone-type" required>
                        ${zoneOptions}
                    </select>
                    <div class="hint">Select the type of radiation environment for this scene</div>
                </div>
                
                <div class="form-group">
                    <label for="custom-intensity">Custom Intensity (0-100)</label>
                    <input type="number" id="custom-intensity" name="custom-intensity" 
                           min="0" max="100" value="${currentZone.intensity}" 
                           placeholder="Override default intensity">
                    <div class="hint">Optional: Override the default intensity for the selected zone type</div>
                </div>
                
                <div class="zone-descriptions">
                    <h4>Zone Type Descriptions:</h4>
                    ${Object.entries(ZONE_TYPES).map(([key, data]) => 
                        `<div class="zone-description-item"><strong>${data.name} (${data.intensity}):</strong> ${data.description}</div>`
                    ).join('')}
                </div>
                
                ${currentZone.intensity > 25 ? `
                    <div class="warning-box">
                        <strong><i class="fas fa-exclamation-triangle"></i> High Radiation Warning</strong><br>
                        This intensity level (${currentZone.intensity}) will cause rapid radiation accumulation. 
                        Ensure tokens have adequate protection before applying.
                    </div>
                ` : ''}
            </div>
        `;
        
        // Enhanced dialog with comprehensive options
        const result = await new Promise((resolve, reject) => {
            const dialog = new Dialog({
                title: "BBTTCC Radiation Zone Configuration - Modern",
                content: content,
                buttons: {
                    apply: {
                        icon: '<i class="fas fa-radiation"></i>',
                        label: "Apply Zone",
                        callback: async (html) => {
                            try {
                                const element = html instanceof jQuery ? html[0] : html;
                                const zoneType = element.querySelector('#zone-type')?.value;
                                const customIntensity = element.querySelector('#custom-intensity')?.value;
                                
                                if (!zoneType) {
                                    ui.notifications.error('Zone type is required');
                                    reject(new Error('Zone type required'));
                                    return;
                                }
                                
                                console.log('BBTTCC Radiation Zone Creator | Applying zone:', { zoneType, customIntensity });
                                
                                // Apply the zone with timeout protection
                                const zoneData = await Promise.race([
                                    radiationModule.api.setSceneRadiationZone(
                                        canvas.scene,
                                        zoneType,
                                        customIntensity ? parseInt(customIntensity) : null
                                    ),
                                    new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Zone application timeout')), 10000)
                                    )
                                ]);
                                
                                resolve({
                                    success: true,
                                    zoneData: zoneData,
                                    message: `Radiation zone applied to ${canvas.scene.name}`
                                });
                                
                            } catch (error) {
                                console.error('BBTTCC Radiation Zone Creator | Application error:', error);
                                reject(error);
                            }
                        }
                    },
                    configure: {
                        icon: '<i class="fas fa-cogs"></i>',
                        label: "Advanced Config",
                        callback: () => {
                            try {
                                // Open the advanced zone configuration
                                const zoneConfig = new radiationModule.api.RadiationZoneConfig(canvas.scene);
                                zoneConfig.render(true);
                                resolve({
                                    success: true,
                                    message: 'Advanced configuration opened'
                                });
                            } catch (error) {
                                console.error('BBTTCC Radiation Zone Creator | Config error:', error);
                                reject(error);
                            }
                        }
                    },
                    reset: {
                        icon: '<i class="fas fa-undo"></i>',
                        label: "Reset to Safe",
                        callback: async () => {
                            try {
                                const confirmed = await Dialog.confirm({
                                    title: "Reset Zone",
                                    content: `Reset ${canvas.scene.name} to background radiation levels?`,
                                    yes: () => true,
                                    no: () => false
                                });
                                
                                if (!confirmed) {
                                    resolve({ success: false, message: 'Reset cancelled' });
                                    return;
                                }
                                
                                const zoneData = await radiationModule.api.setSceneRadiationZone(
                                    canvas.scene,
                                    'background'
                                );
                                
                                resolve({
                                    success: true,
                                    zoneData: zoneData,
                                    message: `${canvas.scene.name} reset to safe radiation levels`
                                });
                                
                            } catch (error) {
                                console.error('BBTTCC Radiation Zone Creator | Reset error:', error);
                                reject(error);
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => resolve({ success: false, message: 'Cancelled' })
                    }
                },
                default: "apply",
                close: () => resolve({ success: false, message: 'Dialog closed' }),
                render: (html) => {
                    /* Handle both jQuery and DOM element contexts */
                    const element = html instanceof jQuery ? html[0] : html;
                    
                    /* Add dynamic intensity updates */
                    element.querySelector('#zone-type')?.addEventListener('change', function() {
                        const selectedType = this.value;
                        const zoneData = ZONE_TYPES[selectedType];
                        if (zoneData) {
                            const intensityField = element.querySelector('#custom-intensity');
                            if (intensityField) intensityField.value = zoneData.intensity;
                        }
                    });
                }
            });
            
            dialog.render(true);
        });
        
        // Handle result with proper user feedback
        if (result.success) {
            ui.notifications.info(result.message);
            
            if (result.zoneData) {
                // Show success details
                const successDialog = new Dialog({
                    title: "Zone Configuration Applied",
                    content: `
                        <div style="padding: 15px;">
                            <h3 style="color: #6b8e23; margin-bottom: 15px;">
                                <i class="fas fa-radiation"></i> Zone Updated Successfully!
                            </h3>
                            <p><strong>Scene:</strong> ${canvas.scene.name}</p>
                            <p><strong>Zone Type:</strong> ${ZONE_TYPES[result.zoneData.type]?.name || result.zoneData.type}</p>
                            <p><strong>Intensity:</strong> ${result.zoneData.intensity}</p>
                            <p><strong>Description:</strong> ${result.zoneData.description}</p>
                            <hr style="margin: 15px 0;">
                            <p><em>The radiation zone has been updated. ${tokenCount > 0 ? 'Monitor existing tokens for radiation effects.' : 'No tokens currently in scene.'}</em></p>
                            ${result.zoneData.intensity > 25 ? '<p style="color: #856404;"><strong>Warning:</strong> High radiation environment. Ensure adequate protection.</p>' : ''}
                        </div>
                    `,
                    buttons: {
                        tracker: {
                            icon: '<i class="fas fa-eye"></i>',
                            label: "Monitor Tokens",
                            callback: () => {
                                try {
                                    // Open radiation tracker for the first token if available
                                    const firstToken = canvas.tokens.placeables.find(t => t.actor);
                                    if (firstToken) {
                                        const tracker = new radiationModule.api.RadiationTracker(firstToken);
                                        tracker.render(true);
                                    } else {
                                        ui.notifications.info('No tokens available to monitor');
                                    }
                                } catch (error) {
                                    console.error('Error opening tracker:', error);
                                    ui.notifications.error('Failed to open radiation tracker');
                                }
                            }
                        },
                        ok: {
                            icon: '<i class="fas fa-check"></i>',
                            label: "OK"
                        }
                    }
                });
                
                successDialog.render(true);
            }
            
        } else if (result.message !== 'Cancelled' && result.message !== 'Dialog closed') {
            console.error('BBTTCC Radiation Zone Creator | Operation failed:', result.message);
            ui.notifications.error(`Zone configuration failed: ${result.message}`);
        }
        
    } catch (error) {
        console.error('BBTTCC Radiation Zone Creator | Critical error:', error);
        ui.notifications.error(`Critical error in zone configuration: ${error.message}`);
        
        // Enhanced error reporting
        const errorDetails = {
            error: error.message,
            stack: error.stack?.substring(0, 500),
            timestamp: new Date().toISOString(),
            gameVersion: game.version,
            systemVersion: game.system.version,
            scene: canvas.scene?.name || 'None'
        };
        
        console.error('BBTTCC Radiation Zone Creator | Error details:', errorDetails);
    }
})();