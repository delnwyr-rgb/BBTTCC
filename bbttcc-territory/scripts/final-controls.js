/**
 * WORKING Territory Controls - Uses correct getSceneControlButtons hook
 */
console.log('♟️  BBTTCC Territory Controls loading...');

Hooks.once('ready', () => {
    console.log('♟️  BBTTCC: Registering getSceneControlButtons hook...');
    
    // Use the CORRECT hook - getSceneControlButtons
    Hooks.on('getSceneControlButtons', (controls) => {
        console.log('♟️  BBTTCC: getSceneControlButtons fired!');
        
        if (!game.user.isGM) return;
        
        const existing = controls.find(c => c.name === "bbttcc-territory-final");
        if (existing) return;
        
        console.log('♟️  BBTTCC: Adding territory control to toolbar...');
        
        controls.push({
            name: "bbttcc-territory-final",
            title: "BBTTCC Territory",
            icon: "fas fa-chess-board",
            visible: true,
            layer: "DrawingsLayer",
            tools: [{
                name: "territory-manager",
                title: "Territory Manager", 
                icon: "fas fa-cog",
                visible: true,
                button: true,
                onClick: () => {
                    console.log('♟️  Territory Manager opened!');
                    ui.notifications.info("♟️  Territory Manager - System is working!");
                }
            }, {
                name: "claim-territory",
                title: "Claim Territory",
                icon: "fas fa-flag", 
                visible: true,
                button: true,
                onClick: () => {
                    console.log('♟️  Claim Territory activated!');
                    ui.notifications.info("♟️  Territory claiming activated!");
                }
            }]
        });
        
        console.log('♟️  BBTTCC: ✅ Chess board control added to Scene Controls!');
    });
    
    globalThis.FinalTerritoryTest = () => {
        ui.notifications.info('♟️  FINAL Territory Control system working!');
        return "Final system using getSceneControlButtons hook";
    };
    
    console.log('♟️  BBTTCC: Territory controls ready!');
});