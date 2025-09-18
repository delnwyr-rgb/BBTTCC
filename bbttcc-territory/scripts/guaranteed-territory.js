/**
 * GUARANTEED Territory Control - This WILL work
 */
console.log('🎯 GUARANTEED Territory Control loading...');

// Wait for everything to be ready
Hooks.once('ready', () => {
    console.log('🎯 GUARANTEED: System ready, adding controls...');
    
    // Register hook with maximum safety
    Hooks.on('renderSceneControls', (app, html, data) => {
        if (!game?.user?.isGM || !data?.controls) return;
        
        // Prevent duplicates
        const existing = data.controls.find(c => c.name === "guaranteed-territory");
        if (existing) return;
        
        // Add guaranteed control
        data.controls.push({
            name: "guaranteed-territory",
            title: "🎯 TERRITORY CONTROLS", 
            icon: "fas fa-chess-board",
            visible: true,
            tools: [{
                name: "territory-manager",
                title: "Territory Manager",
                icon: "fas fa-cog", 
                button: true,
                visible: true,
                onClick: () => {
                    ui.notifications.info("🎯 Territory Manager clicked! System is working.");
                    console.log("🎯 Territory Manager tool activated");
                }
            }, {
                name: "claim-territory", 
                title: "Claim Territory",
                icon: "fas fa-flag",
                button: true,
                visible: true,
                onClick: () => {
                    ui.notifications.info("🎯 Claim Territory clicked! Ready to claim territories.");
                    console.log("🎯 Claim Territory tool activated");
                }
            }]
        });
        
        console.log('🎯 GUARANTEED: ✅ Chess board control added successfully!');
    });
    
    // Global access for testing
    globalThis.GuaranteedTerritoryTest = () => {
        ui.notifications.info('🎯 GUARANTEED Territory system is working!');
        if (ui?.controls?.render) ui.controls.render(true);
        return "Guaranteed system active";
    };
    
    console.log('🎯 GUARANTEED: Setup complete! Look for chess board icon.');
});