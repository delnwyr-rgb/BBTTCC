/**
 * SUPER SIMPLE Emergency Territory Controls
 * This WILL work - no dependencies, no imports, no complexity
 */

console.log('🚨 EMERGENCY SIMPLE Territory Controls loading...');

// Wait for Foundry to be fully ready
Hooks.once('ready', () => {
    console.log('🚨 EMERGENCY SIMPLE: Ready hook fired, registering controls...');
    
    // Register the most basic possible Scene Controls hook
    Hooks.on('renderSceneControls', (app, html, data) => {
        console.log('🚨 EMERGENCY SIMPLE: renderSceneControls fired');
        
        try {
            // Super basic checks
            if (!game?.user?.isGM) {
                console.log('🚨 EMERGENCY SIMPLE: Not GM, skipping');
                return;
            }
            
            if (!data?.controls || !Array.isArray(data.controls)) {
                console.log('🚨 EMERGENCY SIMPLE: No controls array');
                return;
            }
            
            // Check if already added
            if (data.controls.some(c => c.name === "emergency-territory")) {
                console.log('🚨 EMERGENCY SIMPLE: Already exists');
                return;
            }
            
            console.log('🚨 EMERGENCY SIMPLE: Adding emergency territory control...');
            
            // Add the simplest possible control
            data.controls.push({
                name: "emergency-territory",
                title: "EMERGENCY Territory",
                icon: "fas fa-chess-board", 
                visible: true,
                tools: [{
                    name: "emergency-test",
                    title: "Emergency Test", 
                    icon: "fas fa-exclamation-triangle",
                    button: true,
                    visible: true,
                    onClick: () => {
                        console.log('🚨 EMERGENCY TERRITORY CONTROL CLICKED!');
                        ui.notifications.info('🚨 EMERGENCY Territory Control is working!');
                    }
                }]
            });
            
            console.log('🚨 EMERGENCY SIMPLE: ✅ Control added successfully!');
            console.log('🚨 EMERGENCY SIMPLE: Total controls now:', data.controls.length);
            
        } catch (error) {
            console.error('🚨 EMERGENCY SIMPLE: Error:', error);
        }
    });
    
    console.log('🚨 EMERGENCY SIMPLE: Hook registered successfully');
    
    // Also expose globally for manual testing
    globalThis.EmergencyTerritoryTest = () => {
        console.log('🚨 EMERGENCY SIMPLE: Manual test function called');
        ui.notifications.info('🚨 Emergency Territory system is loaded and working!');
        
        // Try to force refresh scene controls
        if (ui?.controls?.render) {
            ui.controls.render(true);
            console.log('🚨 EMERGENCY SIMPLE: Forced scene controls refresh');
        }
        
        return "Emergency system active";
    };
    
    console.log('🚨 EMERGENCY SIMPLE: Global test function available as EmergencyTerritoryTest()');
});

console.log('🚨 EMERGENCY SIMPLE Territory Controls setup complete');