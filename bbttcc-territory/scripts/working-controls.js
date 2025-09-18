/**
 * WORKING Territory Controls - Using correct Foundry hook
 * This uses getSceneControlButtons like Sequencer does
 */

console.log('🎯 WORKING Territory Controls loading...');

// Wait for Foundry to be fully ready
Hooks.once('ready', () => {
    console.log('🎯 WORKING: System ready, registering getSceneControlButtons hook...');
    
    // Use the CORRECT hook that actually works
    Hooks.on('getSceneControlButtons', (controls) => {
        console.log('🎯 WORKING: getSceneControlButtons hook fired!');
        console.log('🎯 WORKING: Current controls:', controls.map(c => c.name));
        
        try {
            // Only add for GMs
            if (!game.user.isGM) {
                console.log('🎯 WORKING: Not GM, skipping');
                return;
            }
            
            // Check if already exists
            const existing = controls.find(c => c.name === "bbttcc-territory");
            if (existing) {
                console.log('🎯 WORKING: Already exists, skipping');
                return;
            }
            
            console.log('🎯 WORKING: Adding BBTTCC Territory control...');
            
            // Create the control object exactly like Sequencer does
            const territoryControl = {
                name: "bbttcc-territory",
                title: "BBTTCC Territory",
                icon: "fas fa-chess-board",
                visible: true,
                layer: "DrawingsLayer", // Specify a layer like other controls
                tools: [
                    {
                        name: "territory-manager",
                        title: "Territory Manager",
                        icon: "fas fa-cog",
                        visible: true,
                        button: true,
                        onClick: () => {
                            console.log('🎯 Territory Manager clicked!');
                            ui.notifications.info("🎯 Territory Manager opened!");
                        }
                    },
                    {
                        name: "claim-territory", 
                        title: "Claim Territory",
                        icon: "fas fa-flag",
                        visible: true,
                        button: true,
                        onClick: () => {
                            console.log('🎯 Claim Territory clicked!');
                            ui.notifications.info("🎯 Territory claiming mode activated!");
                        }
                    }
                ]
            };
            
            // Add to controls array
            controls.push(territoryControl);
            
            console.log('🎯 WORKING: ✅ Territory control added successfully!');
            console.log('🎯 WORKING: Updated controls:', controls.map(c => c.name));
            
        } catch (error) {
            console.error('🎯 WORKING: Error adding territory control:', error);
        }
    });
    
    // Global test function
    globalThis.WorkingTerritoryTest = () => {
        console.log('🎯 WORKING: Test function called');
        ui.notifications.info('🎯 Working Territory Control system is active!');
        
        // Force refresh scene controls if possible
        if (ui?.controls?.render) {
            ui.controls.render(true);
            console.log('🎯 WORKING: Forced scene controls refresh');
        }
        
        return "Working system active with getSceneControlButtons hook";
    };
    
    console.log('🎯 WORKING: Setup complete! getSceneControlButtons hook registered.');
    console.log('🎯 WORKING: Test with: WorkingTerritoryTest()');
});

console.log('🎯 WORKING Territory Controls module loaded');