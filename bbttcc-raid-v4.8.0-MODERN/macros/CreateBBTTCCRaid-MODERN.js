/**
 * BBTTCC Raid Creator Macro - MODERN v4.8.0
 * Enhanced macro for creating raids with modern async patterns
 */

(async () => {
    'use strict';
    
    console.log('BBTTCC Raid Creator | Modern macro starting');
    
    try {
        // Check if user is GM
        if (!game.user.isGM) {
            ui.notifications.warn('Only GMs can create raids');
            return;
        }
        
        // Get the BBTTCC Raid module with timeout protection
        let raidModule;
        try {
            raidModule = game.modules.get('bbttcc-raid');
            if (!raidModule || !raidModule.active) {
                throw new Error('BBTTCC Raid module not found or not active');
            }
            
            // Wait for API to be ready with timeout
            console.log('BBTTCC Raid Creator | Waiting for module API...');
            const api = await Promise.race([
                raidModule.api?.waitForReady?.(10000) || Promise.resolve(raidModule.api),
                new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 10000))
            ]);
            
            if (!api || !api.createRaid) {
                throw new Error('BBTTCC Raid API not available');
            }
            
            console.log('BBTTCC Raid Creator | API ready, proceeding with dialog');
            
        } catch (error) {
            console.error('BBTTCC Raid Creator | Module/API error:', error);
            ui.notifications.error(`BBTTCC Raid module error: ${error.message}`);
            return;
        }
        
        // Get available factions
        const factions = game.actors.filter(actor => 
            actor.flags['bbttcc-factions']?.isFaction === true
        );
        
        if (factions.length === 0) {
            ui.notifications.warn('No BBTTCC factions found. Create factions first.');
            return;
        }
        
        // Create faction options for select
        const factionOptions = factions.map(faction => 
            `<option value="${faction.id}">${faction.name}</option>`
        ).join('');
        
        // Get raid types and difficulties
        const RAID_TYPES = raidModule.api.RAID_TYPES || {
            assault: 'Direct Military Attack',
            infiltration: 'Stealth Operation',
            sabotage: 'Disruption Mission',
            heist: 'Resource Acquisition',
            rescue: 'Extraction Mission',
            reconnaissance: 'Information Gathering'
        };
        
        const RAID_DIFFICULTIES = raidModule.api.RAID_DIFFICULTIES || {
            trivial: { name: 'Trivial', modifier: -2 },
            easy: { name: 'Easy', modifier: -1 },
            medium: { name: 'Medium', modifier: 0 },
            hard: { name: 'Hard', modifier: 1 },
            extreme: { name: 'Extreme', modifier: 2 }
        };
        
        const typeOptions = Object.entries(RAID_TYPES).map(([key, name]) => 
            `<option value="${key}">${name}</option>`
        ).join('');
        
        const difficultyOptions = Object.entries(RAID_DIFFICULTIES).map(([key, data]) => 
            `<option value="${key}">${data.name} (${data.modifier >= 0 ? '+' : ''}${data.modifier})</option>`
        ).join('');
        
        // Enhanced dialog content with comprehensive form
        const content = `
            <style>
                .bbttcc-raid-dialog { 
                    font-family: 'Roboto', sans-serif; 
                    padding: 10px;
                }
                .bbttcc-raid-dialog .form-group { 
                    margin-bottom: 15px; 
                }
                .bbttcc-raid-dialog label { 
                    display: block; 
                    font-weight: bold; 
                    margin-bottom: 5px; 
                    color: #333;
                }
                .bbttcc-raid-dialog input, 
                .bbttcc-raid-dialog select, 
                .bbttcc-raid-dialog textarea { 
                    width: 100%; 
                    padding: 8px; 
                    border: 2px solid #ccc; 
                    border-radius: 4px; 
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .bbttcc-raid-dialog input:focus, 
                .bbttcc-raid-dialog select:focus, 
                .bbttcc-raid-dialog textarea:focus { 
                    border-color: #8B0000; 
                    outline: none; 
                }
                .bbttcc-raid-dialog .form-row {
                    display: flex;
                    gap: 15px;
                }
                .bbttcc-raid-dialog .form-row .form-group {
                    flex: 1;
                }
                .bbttcc-raid-dialog .hint {
                    font-size: 12px;
                    color: #666;
                    margin-top: 4px;
                    font-style: italic;
                }
                .bbttcc-raid-dialog select[multiple] {
                    height: 120px;
                }
            </style>
            
            <div class="bbttcc-raid-dialog">
                <div class="form-group">
                    <label for="raid-name">Raid Name *</label>
                    <input type="text" id="raid-name" name="raid-name" placeholder="Enter raid name..." required>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="raid-type">Raid Type *</label>
                        <select id="raid-type" name="raid-type" required>
                            ${typeOptions}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="raid-difficulty">Difficulty</label>
                        <select id="raid-difficulty" name="raid-difficulty">
                            ${difficultyOptions}
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="raid-target">Target</label>
                    <input type="text" id="raid-target" name="raid-target" placeholder="What or where is being raided...">
                </div>
                
                <div class="form-group">
                    <label for="raid-description">Description</label>
                    <textarea id="raid-description" name="raid-description" rows="3" placeholder="Detailed raid description..."></textarea>
                </div>
                
                <div class="form-group">
                    <label for="raid-objectives">Objectives *</label>
                    <textarea id="raid-objectives" name="raid-objectives" rows="4" placeholder="Enter objectives, one per line..." required></textarea>
                    <div class="hint">Enter each objective on a separate line</div>
                </div>
                
                <div class="form-group">
                    <label for="raid-participants">Participating Factions *</label>
                    <select id="raid-participants" name="raid-participants" multiple required>
                        ${factionOptions}
                    </select>
                    <div class="hint">Hold Ctrl/Cmd to select multiple factions</div>
                </div>
                
                <div class="form-group">
                    <h4 style="margin-bottom: 10px;">Resource Allocation</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="resource-violence">Violence</label>
                            <input type="number" id="resource-violence" name="resource-violence" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="resource-nonlethal">Non-Lethal</label>
                            <input type="number" id="resource-nonlethal" name="resource-nonlethal" min="0" value="0">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="resource-intrigue">Intrigue</label>
                            <input type="number" id="resource-intrigue" name="resource-intrigue" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="resource-economy">Economy</label>
                            <input type="number" id="resource-economy" name="resource-economy" min="0" value="0">
                        </div>
                    </div>
                    <div class="hint">Assign Organization Points to support the raid</div>
                </div>
            </div>
        `;
        
        // Enhanced dialog with comprehensive validation
        const result = await new Promise((resolve, reject) => {
            const dialog = new Dialog({
                title: "Create BBTTCC Raid - Modern",
                content: content,
                buttons: {
                    create: {
                        icon: '<i class="fas fa-plus"></i>',
                        label: "Create Raid",
                        callback: async (html) => {
                            try {
                                // Gather form data with comprehensive validation
                                const raidName = html.find('#raid-name').val()?.trim();
                                const raidType = html.find('#raid-type').val();
                                const raidDifficulty = html.find('#raid-difficulty').val();
                                const raidTarget = html.find('#raid-target').val()?.trim();
                                const raidDescription = html.find('#raid-description').val()?.trim();
                                const raidObjectives = html.find('#raid-objectives').val()?.trim();
                                const selectedParticipants = html.find('#raid-participants').val() || [];
                                
                                // Resource allocation
                                const resources = {
                                    violence: parseInt(html.find('#resource-violence').val()) || 0,
                                    nonLethal: parseInt(html.find('#resource-nonlethal').val()) || 0,
                                    intrigue: parseInt(html.find('#resource-intrigue').val()) || 0,
                                    economy: parseInt(html.find('#resource-economy').val()) || 0
                                };
                                
                                // Comprehensive validation
                                const validationErrors = [];
                                
                                if (!raidName) validationErrors.push('Raid name is required');
                                if (!raidType) validationErrors.push('Raid type is required');
                                if (!raidObjectives) validationErrors.push('At least one objective is required');
                                if (selectedParticipants.length === 0) validationErrors.push('At least one participating faction is required');
                                
                                const totalResources = Object.values(resources).reduce((sum, val) => sum + val, 0);
                                if (totalResources === 0) validationErrors.push('Some resources are required for the raid');
                                
                                if (validationErrors.length > 0) {
                                    ui.notifications.error(`Validation failed: ${validationErrors.join(', ')}`);
                                    reject(new Error(validationErrors.join(', ')));
                                    return;
                                }
                                
                                // Parse objectives
                                const objectives = raidObjectives.split('\\n')
                                    .map(obj => obj.trim())
                                    .filter(obj => obj.length > 0);
                                
                                // Prepare raid data
                                const raidData = {
                                    name: raidName,
                                    type: raidType,
                                    difficulty: raidDifficulty,
                                    target: raidTarget,
                                    description: raidDescription,
                                    objectives: objectives,
                                    participants: selectedParticipants,
                                    resources: resources,
                                    timeline: {
                                        preparation: 24,
                                        execution: 4,
                                        extraction: 2
                                    }
                                };
                                
                                console.log('BBTTCC Raid Creator | Creating raid with data:', raidData);
                                
                                // Create the raid with timeout protection
                                const createdRaid = await Promise.race([
                                    raidModule.api.createRaid(raidData),
                                    new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Raid creation timeout')), 15000)
                                    )
                                ]);
                                
                                resolve({
                                    success: true,
                                    raid: createdRaid,
                                    message: `Raid "${createdRaid.name}" created successfully!`
                                });
                                
                            } catch (error) {
                                console.error('BBTTCC Raid Creator | Creation error:', error);
                                reject(error);
                            }
                        }
                    },
                    planner: {
                        icon: '<i class="fas fa-cogs"></i>',
                        label: "Open Planner",
                        callback: () => {
                            try {
                                // Open the raid planner instead
                                const planner = new raidModule.api.RaidPlanner();
                                planner.render(true);
                                resolve({
                                    success: true,
                                    message: 'Raid Planner opened'
                                });
                            } catch (error) {
                                console.error('BBTTCC Raid Creator | Planner error:', error);
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
                default: "create",
                close: () => resolve({ success: false, message: 'Dialog closed' })
            });
            
            dialog.render(true);
        });
        
        // Handle result with proper user feedback
        if (result.success) {
            if (result.raid) {
                ui.notifications.info(result.message);
                
                // Show success details
                const successDialog = new Dialog({
                    title: "Raid Created Successfully",
                    content: `
                        <div style="padding: 15px;">
                            <h3 style="color: #006400; margin-bottom: 15px;">
                                <i class="fas fa-check-circle"></i> Raid "${result.raid.name}" Created!
                            </h3>
                            <p><strong>Type:</strong> ${RAID_TYPES[result.raid.type] || result.raid.type}</p>
                            <p><strong>Difficulty:</strong> ${RAID_DIFFICULTIES[result.raid.difficulty]?.name || result.raid.difficulty}</p>
                            <p><strong>Objectives:</strong> ${result.raid.objectives.length}</p>
                            <p><strong>Participants:</strong> ${result.raid.participants.length} factions</p>
                            <p><strong>Total Resources:</strong> ${Object.values(result.raid.resources).reduce((sum, val) => sum + val, 0)}</p>
                            <hr style="margin: 15px 0;">
                            <p><em>The raid is now in planning status. Use the Raid Planner to make further adjustments or execute when ready.</em></p>
                        </div>
                    `,
                    buttons: {
                        planner: {
                            icon: '<i class="fas fa-cogs"></i>',
                            label: "Open Planner",
                            callback: () => {
                                try {
                                    const planner = new raidModule.api.RaidPlanner(result.raid);
                                    planner.render(true);
                                } catch (error) {
                                    console.error('Error opening planner:', error);
                                    ui.notifications.error('Failed to open raid planner');
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
                
            } else {
                ui.notifications.info(result.message);
            }
        } else if (result.message !== 'Cancelled' && result.message !== 'Dialog closed') {
            console.error('BBTTCC Raid Creator | Operation failed:', result.message);
            ui.notifications.error(`Raid creation failed: ${result.message}`);
        }
        
    } catch (error) {
        console.error('BBTTCC Raid Creator | Critical error:', error);
        ui.notifications.error(`Critical error in raid creation: ${error.message}`);
        
        // Enhanced error reporting
        const errorDetails = {
            error: error.message,
            stack: error.stack?.substring(0, 500),
            timestamp: new Date().toISOString(),
            gameVersion: game.version,
            systemVersion: game.system.version
        };
        
        console.error('BBTTCC Raid Creator | Error details:', errorDetails);
    }
})();