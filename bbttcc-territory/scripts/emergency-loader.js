/**
 * Emergency Module Loader for BBTTCC Territory
 * Ensures the module loads even if there are import issues
 */

console.log('BBTTCC Territory | Emergency loader activated');

// Emergency Scene Controls registration
Hooks.once('ready', () => {
    console.log('BBTTCC Territory | Emergency Scene Controls setup');
    
    // Manual Scene Controls hook registration
    const emergencySceneControlsHook = (app, html, data) => {
        console.log('BBTTCC Territory | Emergency Scene Controls hook fired');
        
        try {
            if (!game?.user?.isGM) {
                console.log('BBTTCC Territory | User is not GM, skipping');
                return;
            }

            if (!data?.controls) {
                console.log('BBTTCC Territory | No data.controls, skipping');
                return;
            }

            // Check if already exists
            const existing = data.controls.find(c => c.name === "bbttcc-territory");
            if (existing) {
                console.log('BBTTCC Territory | Controls already exist');
                return;
            }

            // Create emergency territory control
            const territoryControl = {
                name: "bbttcc-territory",
                title: "BBTTCC Territory",
                icon: "fas fa-chess-board",
                visible: true,
                layer: null,
                activeTool: null,
                tools: [
                    {
                        name: "emergency-test",
                        title: "Emergency Test",
                        icon: "fas fa-exclamation-triangle",
                        onClick: () => {
                            ui.notifications.info("Emergency Territory Control Active! Module is working.");
                            console.log('BBTTCC Territory | Emergency control clicked - module is working!');
                        },
                        button: true,
                        visible: true
                    }
                ]
            };

            data.controls.push(territoryControl);
            console.log('BBTTCC Territory | ✅ EMERGENCY Territory controls added successfully!');
            
        } catch (error) {
            console.error('BBTTCC Territory | Emergency Scene Controls error:', error);
        }
    };
    
    // Register emergency hook
    Hooks.on('renderSceneControls', emergencySceneControlsHook);
    console.log('BBTTCC Territory | Emergency Scene Controls hook registered');
    
    // Global emergency access
    window.BBTTCCEmergency = {
        refreshSceneControls: () => {
            if (ui?.controls?.render) {
                ui.controls.render(true);
                console.log('BBTTCC Territory | Emergency Scene Controls refresh');
                return true;
            }
            return false;
        },
        testModule: () => {
            ui.notifications.info("BBTTCC Territory Emergency Loader is working!");
            return "Emergency loader active";
        }
    };
    
    console.log('BBTTCC Territory | Emergency module loader ready');
    console.log('BBTTCC Territory | Available as: window.BBTTCCEmergency');
});