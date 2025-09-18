// Quick reload script for enhanced Territory Builder
console.log('🔄 Reloading Enhanced Territory Builder...');

fetch('/modules/bbttcc-territory/territory-builder-bulletproof.js')
    .then(response => response.text())
    .then(script => {
        // Clear existing window object
        if (window.TerritoryBuilder) {
            window.TerritoryBuilder.stop?.();
        }

        eval(script);
        console.log('✅ Enhanced Territory Builder reloaded!');
        console.log('🆕 New commands available:');
        console.log('   - TerritoryBuilder.showExistingTerritories()');
        console.log('   - TerritoryBuilder.clearTerritoryVisuals()');
        console.log('🗺️ Ready to show visual markers for existing territories!');

        // Auto-show existing territories
        setTimeout(() => {
            TerritoryBuilder.showExistingTerritories();
        }, 1000);
    })
    .catch(error => {
        console.error('❌ Error reloading:', error);
        ui.notifications.error('Failed to reload enhanced system');
    });