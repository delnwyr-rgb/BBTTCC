// BBTTCC Territory - Direct UI Button Integration
// Works with FoundryVTT v13+ by adding buttons directly to the UI

console.log('🎯 BBTTCC Territory UI Buttons loading...');

// Wait for UI to be ready
Hooks.once('ready', function() {
    console.log('🎯 Adding Territory Builder buttons to UI...');

    // Add Territory Builder button to scene controls
    setTimeout(() => {
        addTerritoryBuilderButton();
    }, 2000); // Give UI time to render

    // Also add to toolbar
    setTimeout(() => {
        addTerritoryToolbar();
    }, 3000);
});

function addTerritoryBuilderButton() {
    console.log('🎯 Adding Territory Builder button...');

    try {
        // Find the scene controls toolbar
        const sceneControls = document.querySelector('#controls .scene-control');
        if (!sceneControls) {
            console.log('⚠️ Scene controls not found, trying alternative...');
            addTerritoryToolbar();
            return;
        }

        // Create Territory Builder button
        const territoryBtn = document.createElement('div');
        territoryBtn.className = 'control-tool bbttcc-territory-builder';
        territoryBtn.title = 'BBTTCC Territory Builder - Create New Territories';
        territoryBtn.innerHTML = '<i class="fas fa-hammer"></i>';
        territoryBtn.style.cssText = `
            position: relative;
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            border: 2px solid #fff;
            border-radius: 6px;
            cursor: pointer;
            margin: 2px;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            font-size: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;

        territoryBtn.addEventListener('click', () => {
            console.log('🔨 Territory Builder button clicked!');
            startTerritoryBuilder();
        });

        // Add to controls
        sceneControls.appendChild(territoryBtn);

        // Create Territory Manager button
        const managerBtn = document.createElement('div');
        managerBtn.className = 'control-tool bbttcc-territory-manager';
        managerBtn.title = 'BBTTCC Territory Management Dashboard';
        managerBtn.innerHTML = '<i class="fas fa-chess-board"></i>';
        managerBtn.style.cssText = `
            position: relative;
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            border: 2px solid #fff;
            border-radius: 6px;
            cursor: pointer;
            margin: 2px;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            font-size: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;

        managerBtn.addEventListener('click', () => {
            console.log('🏛️ Territory Manager button clicked!');
            openTerritoryManager();
        });

        sceneControls.appendChild(managerBtn);

        console.log('✅ Territory buttons added to scene controls');
        ui.notifications.success('🎯 BBTTCC Territory buttons added!');

    } catch (error) {
        console.error('❌ Error adding territory buttons:', error);
        // Fallback to toolbar method
        addTerritoryToolbar();
    }
}

function addTerritoryToolbar() {
    console.log('🎯 Adding Territory toolbar...');

    try {
        // Find a good place to add the toolbar
        const ui = document.querySelector('#ui-left') || document.querySelector('#sidebar') || document.body;

        // Remove existing toolbar if present
        const existing = document.querySelector('.bbttcc-territory-toolbar');
        if (existing) existing.remove();

        // Create toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'bbttcc-territory-toolbar';
        toolbar.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 5px;
            z-index: 1000;
            background: rgba(0,0,0,0.1);
            padding: 5px;
            border-radius: 8px;
            backdrop-filter: blur(5px);
        `;

        // Territory Builder button
        const builderBtn = document.createElement('button');
        builderBtn.innerHTML = '<i class="fas fa-hammer"></i> Builder';
        builderBtn.title = 'Start Territory Builder';
        builderBtn.style.cssText = `
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;

        builderBtn.addEventListener('click', () => {
            console.log('🔨 Territory Builder toolbar button clicked!');
            startTerritoryBuilder();
        });

        // Territory Manager button
        const managerBtn = document.createElement('button');
        managerBtn.innerHTML = '<i class="fas fa-chess-board"></i> Manager';
        managerBtn.title = 'Open Territory Manager';
        managerBtn.style.cssText = `
            background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;

        managerBtn.addEventListener('click', () => {
            console.log('🏛️ Territory Manager toolbar button clicked!');
            openTerritoryManager();
        });

        toolbar.appendChild(builderBtn);
        toolbar.appendChild(managerBtn);
        ui.appendChild(toolbar);

        console.log('✅ Territory toolbar added');
        ui.notifications.success('🎯 BBTTCC Territory toolbar ready!');

    } catch (error) {
        console.error('❌ Error adding territory toolbar:', error);
    }
}

async function startTerritoryBuilder() {
    console.log('🔨 Starting Territory Builder...');

    try {
        if (window.TerritoryBuilder) {
            console.log('🔨 Territory Builder already loaded, starting...');
            window.TerritoryBuilder.start();
        } else {
            console.log('🔨 Loading Territory Builder...');
            ui.notifications.info('🔨 Loading Territory Builder...');

            // Load the bulletproof territory builder
            const response = await fetch('/modules/bbttcc-territory/territory-builder-bulletproof.js');
            const script = await response.text();

            // Execute the script
            eval(script);

            if (window.TerritoryBuilder) {
                console.log('✅ Territory Builder loaded and starting...');
                window.TerritoryBuilder.start();
            } else {
                throw new Error('TerritoryBuilder not found after loading');
            }
        }
    } catch (error) {
        console.error('❌ Error starting Territory Builder:', error);
        ui.notifications.error('Failed to start Territory Builder');
    }
}

function openTerritoryManager() {
    console.log('🏛️ Opening Territory Manager...');

    try {
        // Try to use the existing function from bbttcc-working-buttons.js
        if (window.openTerritoryManager) {
            window.openTerritoryManager();
        } else {
            // Fallback: show a simple territory list
            showSimpleTerritoryList();
        }
    } catch (error) {
        console.error('❌ Error opening Territory Manager:', error);
        ui.notifications.error('Territory Manager not available');
    }
}

function showSimpleTerritoryList() {
    const territories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};
    const territoryList = Object.values(territories);

    const content = `
        <div style="max-height: 400px; overflow-y: auto;">
            <h3>🏛️ BBTTCC Territories (${territoryList.length})</h3>
            ${territoryList.length === 0 ? '<p><em>No territories found. Use Territory Builder to create some!</em></p>' :
              territoryList.map(t => `
                <div style="border: 1px solid #ccc; margin: 5px 0; padding: 10px; border-radius: 4px;">
                    <strong>${t.name}</strong> ${t.claimedBy ? `(${t.claimedBy})` : '(Independent)'}<br>
                    <small>${t.description}</small><br>
                    <small>Type: ${t.type} | Hexes: ${t.hexes?.length || 'N/A'} | Value: ${t.totalValue} | Status: ${t.status}</small>
                </div>
              `).join('')
            }
        </div>
    `;

    new Dialog({
        title: '🏛️ BBTTCC Territory List',
        content: content,
        buttons: {
            close: { label: 'Close' },
            builder: {
                label: '<i class="fas fa-hammer"></i> Create New Territory',
                callback: () => startTerritoryBuilder()
            }
        }
    }).render(true);
}

// Expose functions globally for other scripts
window.startTerritoryBuilder = startTerritoryBuilder;
window.openTerritoryManager = openTerritoryManager;

console.log('✅ BBTTCC Territory UI Buttons loaded!');