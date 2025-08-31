// BBTTCC Faction Creation Macro - MODERN VERSION
// Uses modern FoundryVTT v13+ patterns with proper error handling and async/await

// Enhanced game readiness check
async function waitForGameReady(maxWait = 10000) {
    const start = Date.now();
    
    while (Date.now() - start < maxWait) {
        if (game?.ready && game?.user && game?.actors) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Game did not become ready within timeout');
}

// Enhanced API access with proper error handling
async function getBBTTCCAPI(timeout = 5000) {
    try {
        // Wait for game to be ready first
        await waitForGameReady();
        
        // Modern API access
        const factionsModule = game.modules?.get('bbttcc-factions');
        if (!factionsModule) {
            throw new Error('BBTTCC Factions module not found. Please ensure it is installed and enabled.');
        }
        
        if (!factionsModule.active) {
            throw new Error('BBTTCC Factions module is not active. Please enable it in the module settings.');
        }
        
        // Wait for API to be available
        if (factionsModule.api?.createFaction) {
            return { api: factionsModule.api, source: 'module.api' };
        }
        
        // Wait for module to fully initialize
        console.log('BBTTCC Factions | Waiting for module to fully initialize...');
        
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('BBTTCC Factions API not ready within timeout'));
            }, timeout);
            
            // Listen for module ready event
            const hookId = Hooks.once('bbttcc-factions.ready', (api) => {
                clearTimeout(timeoutId);
                resolve({ api: api, source: 'hook.ready' });
            });
            
            // Also check legacy API as fallback
            const checkLegacy = () => {
                if (window.BBTTCCFactions?.createFaction) {
                    clearTimeout(timeoutId);
                    Hooks.off('bbttcc-factions.ready', hookId);
                    resolve({ api: window.BBTTCCFactions, source: 'legacy' });
                }
            };
            
            setTimeout(checkLegacy, 1000);
        });
        
    } catch (error) {
        console.error('BBTTCC Faction Macro | Error accessing API:', error);
        throw error;
    }
}

// Enhanced faction name prompt with modern dialog patterns
async function promptForFactionName() {
    return new Promise((resolve) => {
        new Dialog({
            title: "Create BBTTCC Faction - MODERN",
            content: `
                <form class="modern-faction-form">
                    <div class="form-group">
                        <label><strong>Faction Name:</strong></label>
                        <input type="text" name="factionName" placeholder="Enter faction name..." autofocus required />
                        <small>Choose a unique name for your faction</small>
                    </div>
                    <div class="form-group">
                        <label><strong>Description (Optional):</strong></label>
                        <textarea name="biography" rows="3" placeholder="Brief description..."></textarea>
                    </div>
                </form>
                <style>
                    .modern-faction-form .form-group { margin-bottom: 15px; }
                    .modern-faction-form label { display: block; margin-bottom: 5px; color: #2c3e50; }
                    .modern-faction-form input, .modern-faction-form textarea { 
                        width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; 
                        font-family: inherit;
                    }
                    .modern-faction-form small { color: #6c757d; font-style: italic; }
                </style>
            `,
            buttons: {
                create: {
                    label: '<i class="fas fa-plus"></i> Create Faction',
                    callback: (html) => {
                        const formData = new FormDataExtended(html[0].querySelector('form')).object;
                        if (formData.factionName && formData.factionName.trim()) {
                            resolve({
                                name: formData.factionName.trim(),
                                biography: formData.biography?.trim() || ""
                            });
                        } else {
                            ui.notifications.warn('Faction name is required');
                            resolve(null);
                        }
                    }
                },
                cancel: {
                    label: '<i class="fas fa-times"></i> Cancel',
                    callback: () => resolve(null)
                }
            },
            default: "create",
            render: (html) => {
                // Focus on the name input
                html.find('input[name="factionName"]').focus();
                
                // Handle Enter key
                html.find('input, textarea').keydown((event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        html.find('.dialog-button[data-button="create"]').click();
                    }
                });
            }
        }).render(true);
    });
}

// Main execution with comprehensive error handling
async function createFaction() {
    const startTime = performance.now();
    
    try {
        console.log('BBTTCC Faction Macro | Starting modern faction creation...');
        
        // Permission check
        if (!game.user?.isGM) {
            ui.notifications?.warn('Only GMs can create factions.');
            return;
        }
        
        // Get faction details from user
        const factionData = await promptForFactionName();
        if (!factionData) {
            console.log('BBTTCC Faction Macro | User cancelled faction creation');
            return;
        }
        
        // Show loading notification
        const loadingId = ui.notifications.info('Creating faction...', { permanent: true });
        
        try {
            // Get API with timeout protection
            console.log('BBTTCC Faction Macro | Accessing modern API...');
            const { api, source } = await getBBTTCCAPI();
            
            console.log(`BBTTCC Faction Macro | API accessed via ${source}`);
            
            // Create faction with timeout protection
            console.log('BBTTCC Faction Macro | Creating faction:', factionData.name);
            
            const faction = await Promise.race([
                api.createFaction(factionData),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Faction creation timed out after 30 seconds')), 30000)
                )
            ]);
            
            // Dismiss loading notification
            if (loadingId) {
                ui.notifications.remove(loadingId);
            }
            
            if (!faction) {
                throw new Error('Faction creation returned null');
            }
            
            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            console.log(`BBTTCC Faction Macro | Faction created successfully in ${duration}s:`, {
                name: faction.name,
                id: faction.id,
                type: faction.type
            });
            
            // Success notification with enhanced info
            ui.notifications.success(`✅ Faction "${faction.name}" created successfully! (${duration}s)`);
            
            // Optional: Open the faction sheet after a brief delay
            setTimeout(() => {
                try {
                    faction.sheet?.render(true);
                } catch (sheetError) {
                    console.warn('Could not open faction sheet:', sheetError);
                }
            }, 1000);
            
            return faction;
            
        } catch (creationError) {
            // Dismiss loading notification if it exists
            if (loadingId) {
                ui.notifications.remove(loadingId);
            }
            throw creationError;
        }
        
    } catch (error) {
        const endTime = performance.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.error(`BBTTCC Faction Macro | Failed after ${duration}s:`, {
            error: error.message,
            stack: error.stack,
            gameReady: game?.ready,
            userExists: !!game?.user,
            moduleExists: !!game.modules?.get('bbttcc-factions'),
            moduleActive: game.modules?.get('bbttcc-factions')?.active
        });
        
        // Enhanced error notification
        let errorMessage = 'Failed to create faction';
        
        if (error.message.includes('not found')) {
            errorMessage = 'BBTTCC Factions module not found. Please install and enable it.';
        } else if (error.message.includes('not active')) {
            errorMessage = 'BBTTCC Factions module is not active. Please enable it in the module settings.';
        } else if (error.message.includes('not ready')) {
            errorMessage = 'BBTTCC Factions module is still loading. Please wait and try again.';
        } else if (error.message.includes('timed out')) {
            errorMessage = 'Faction creation timed out. The system may be overloaded.';
        } else if (error.message.includes('already exists')) {
            errorMessage = error.message; // Use the specific duplicate name message
        } else {
            errorMessage = `Faction creation failed: ${error.message}`;
        }
        
        ui.notifications.error(errorMessage);
        
        // Additional help for common issues
        if (error.message.includes('not found') || error.message.includes('not active')) {
            setTimeout(() => {
                ui.notifications.info('💡 Check the "Manage Modules" section to ensure BBTTCC Factions is installed and enabled.');
            }, 2000);
        }
    }
}

// Execute the faction creation
createFaction();