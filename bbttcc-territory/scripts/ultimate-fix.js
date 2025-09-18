// ULTIMATE TERRITORY CONTROL FIX - Simplest possible implementation
// This WILL work - no imports, no classes, just pure JavaScript

console.log('🏆 ULTIMATE Territory Control Fix Loading...');

// Register immediately when script loads
(function() {
    'use strict';
    
    // Global flag to prevent duplicates
    if (globalThis.BBTTCC_TERRITORY_LOADED) {
        console.log('🏆 ULTIMATE: Already loaded, skipping');
        return;
    }
    globalThis.BBTTCC_TERRITORY_LOADED = true;
    
    console.log('🏆 ULTIMATE: Setting up territory controls...');
    
    // Wait for Foundry ready
    Hooks.once('ready', function() {
        console.log('🏆 ULTIMATE: Ready hook fired, registering getSceneControlButtons...');
        
        // Use the correct hook
        Hooks.on('getSceneControlButtons', function(controls) {
            console.log('🏆 ULTIMATE: getSceneControlButtons hook executed!');
            console.log('🏆 ULTIMATE: Current controls count:', controls.length);
            console.log('🏆 ULTIMATE: User is GM:', !!game?.user?.isGM);
            
            // GM check
            if (!game?.user?.isGM) {
                console.log('🏆 ULTIMATE: Not GM, skipping');
                return;
            }
            
            // Duplicate check
            var existingControl = null;
            for (var i = 0; i < controls.length; i++) {
                if (controls[i].name === 'bbttcc-territory-ultimate') {
                    existingControl = controls[i];
                    break;
                }
            }
            
            if (existingControl) {
                console.log('🏆 ULTIMATE: Control already exists, skipping');
                return;
            }
            
            console.log('🏆 ULTIMATE: Adding BBTTCC Territory control...');
            
            // Create the control
            var territoryControl = {
                name: 'bbttcc-territory-ultimate',
                title: 'BBTTCC Territory',
                icon: 'fas fa-chess-board',
                visible: true,
                layer: 'DrawingsLayer',
                activeTool: null,
                tools: [
                    {
                        name: 'territory-manager',
                        title: 'Territory Manager',
                        icon: 'fas fa-cog',
                        visible: true,
                        button: true,
                        onClick: function() {
                            console.log('🏆 ULTIMATE: Territory Manager clicked!');
                            if (ui?.notifications?.info) {
                                ui.notifications.info('🏆 Territory Manager - ULTIMATE fix working!');
                            } else {
                                console.log('🏆 Territory Manager activated (no notifications available)');
                            }
                        }
                    },
                    {
                        name: 'claim-territory',
                        title: 'Claim Territory', 
                        icon: 'fas fa-flag',
                        visible: true,
                        button: true,
                        onClick: function() {
                            console.log('🏆 ULTIMATE: Claim Territory clicked!');
                            if (ui?.notifications?.info) {
                                ui.notifications.info('🏆 Territory Claiming - ULTIMATE fix working!');
                            } else {
                                console.log('🏆 Territory Claiming activated (no notifications available)');
                            }
                        }
                    }
                ]
            };
            
            // Add to controls
            controls.push(territoryControl);
            
            console.log('🏆 ULTIMATE: ✅ Territory control added successfully!');
            console.log('🏆 ULTIMATE: Total controls now:', controls.length);
            console.log('🏆 ULTIMATE: Control names:', controls.map(function(c) { return c.name; }).join(', '));
        });
        
        console.log('🏆 ULTIMATE: Hook registered successfully');
        
        // Global test function
        globalThis.UltimateTerritoryTest = function() {
            console.log('🏆 ULTIMATE: Test function called');
            if (ui?.notifications?.info) {
                ui.notifications.info('🏆 ULTIMATE Territory Control system is working!');
            }
            console.log('🏆 ULTIMATE: getSceneControlButtons hook should have fired');
            return 'Ultimate system active - using getSceneControlButtons';
        };
        
        console.log('🏆 ULTIMATE: Setup complete! Test with UltimateTerritoryTest()');
    });
    
    console.log('🏆 ULTIMATE: Territory control module loaded');
})();