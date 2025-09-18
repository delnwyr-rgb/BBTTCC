// BBTTCC Territory Builder - Bulletproof Test Script
console.log('🧪 Loading Bulletproof Territory Builder Test...');

// Load the bulletproof system
fetch('/modules/bbttcc-territory/territory-builder-bulletproof.js')
    .then(response => response.text())
    .then(script => {
        eval(script);
        console.log('✅ Bulletproof Territory Builder loaded successfully!');
        console.log('🏗️ Ready to test! Run: TerritoryBuilder.start()');

        // Verify integration with your BBTTCC system
        console.log('🔍 Checking BBTTCC Integration:');
        console.log('- Scene flags available:', !!canvas?.scene?.getFlag);
        console.log('- Actors available:', !!game?.actors);
        console.log('- Current factions:', game.actors.filter(a => a.getFlag('bbttcc-factions', 'isFaction')).length);
        console.log('- Existing territories:', Object.keys(canvas.scene?.getFlag('bbttcc-territory', 'territories') || {}).length);

        ui.notifications.success('🛡️ Bulletproof Territory Builder ready for testing!');
    })
    .catch(error => {
        console.error('❌ Error loading bulletproof system:', error);
        ui.notifications.error('Failed to load bulletproof system');
    });