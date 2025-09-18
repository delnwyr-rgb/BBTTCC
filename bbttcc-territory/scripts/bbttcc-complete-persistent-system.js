// BBTTCC COMPLETE PERSISTENT SYSTEM - IMMEDIATE EXECUTION TEST
console.log("🎯🎯🎯 BBTTCC COMPLETE PERSISTENT SYSTEM Loading...");
console.warn("🎯🎯🎯 DEBUG: Complete persistent system is executing!");
console.error("🎯🎯🎯 FORCE DEBUG: This should show in console immediately!");

// Force immediate button creation without waiting for hooks
setTimeout(() => {
    console.log("🎯🎯🎯 TIMEOUT: Creating emergency buttons now!");

    const actorHeader = document.querySelector('#sidebar #actors .directory-header .header-actions');
    if (actorHeader) {
        const btn = document.createElement('button');
        btn.textContent = 'BBTTCC TEST';
        btn.style.cssText = 'background:red;color:white;padding:5px;margin:5px;';
        btn.onclick = () => alert('BBTTCC module script is working!');
        actorHeader.appendChild(btn);
        console.log("🎯🎯🎯 EMERGENCY BUTTON CREATED!");
    } else {
        console.log("🎯🎯🎯 NO ACTOR HEADER FOUND YET");
    }
}, 2000);

// Prevent multiple loading
if (window.BBTTCC_COMPLETE_SYSTEM_LOADED) {
    console.log("⚠️ BBTTCC Complete System already loaded, skipping");
} else {
    window.BBTTCC_COMPLETE_SYSTEM_LOADED = true;

    // Wait for Foundry to be ready
    Hooks.once('ready', function() {
        console.log("🚀 BBTTCC Complete System: Foundry ready, loading complete system...");

        // Load the complete working system
        loadCompleteBBTTCCSystem();

        console.log("✅ BBTTCC Complete Persistent System active!");
    });

    function loadCompleteBBTTCCSystem() {
        console.log("🔄 Loading COMPLETE working BBTTCC system with Tikkun Sparks guidance!");

        // Load the complete system from the working script
        const script = document.createElement('script');
        script.src = '/Restore-Complete-Working-System.js';
        script.onload = function() {
            console.log("✅ Complete BBTTCC system loaded successfully!");
            ui.notifications.success("🎮 Complete BBTTCC System loaded with persistence!");
        };
        script.onerror = function() {
            console.warn("Could not load from file, implementing system directly...");
            implementSystemDirectly();
        };
        document.head.appendChild(script);
    }

    function implementSystemDirectly() {
        // If we can't load the external file, we'll need to implement the system here
        // For now, let's create the basic persistent buttons that call your working system
        console.log("🔧 Implementing BBTTCC system directly...");

        setupPersistentButtons();
        setupPersistence();

        ui.notifications.success("🎮 BBTTCC System active! Use your Restore-Complete-Working-System.js for full functionality.");
    }

    function setupPersistentButtons() {
        console.log("🔧 Setting up persistent BBTTCC buttons...");

        // Character Creation Button
        const actorHeader = document.querySelector('#sidebar #actors .directory-header .header-actions');
        if (actorHeader && !document.querySelector('.bbttcc-persistent-char-btn')) {
            const characterBtn = document.createElement('button');
            characterBtn.className = 'bbttcc-persistent-char-btn';
            characterBtn.innerHTML = '<i class="fas fa-magic"></i> BBTTCC Character';
            characterBtn.title = 'Complete BBTTCC Character Creation (With Tikkun Sparks)';
            characterBtn.style.cssText = `
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border: none; border-radius: 4px; padding: 4px 8px;
                margin-left: 5px; font-size: 12px; cursor: pointer;
                display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
            `;

            characterBtn.addEventListener('click', () => {
                console.log("🧙 Character creation clicked - looking for complete system...");

                // Try to use the complete system if available
                if (window.BBTTCCGUI && window.BBTTCCGUI.PerfectCharacterCreation) {
                    new window.BBTTCCGUI.PerfectCharacterCreation().render(true);
                } else if (window.BBTTCCPerfectCharacterCreation) {
                    new window.BBTTCCPerfectCharacterCreation().render(true);
                } else {
                    ui.notifications.warn("Please run your Restore-Complete-Working-System.js script first to enable full character creation.");
                }
            });

            actorHeader.appendChild(characterBtn);
            console.log("✅ Persistent Character button created");
        }

        // Faction Creation Button
        if (actorHeader && !document.querySelector('.bbttcc-persistent-faction-btn')) {
            const factionBtn = document.createElement('button');
            factionBtn.className = 'bbttcc-persistent-faction-btn';
            factionBtn.innerHTML = '<i class="fas fa-flag"></i> Create Faction';
            factionBtn.title = 'Create BBTTCC Faction';
            factionBtn.style.cssText = `
                background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                color: white; border: none; border-radius: 4px; padding: 4px 8px;
                margin-left: 5px; font-size: 12px; cursor: pointer;
                display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
            `;

            factionBtn.addEventListener('click', async () => {
                console.log("🏛️ Faction creation clicked");

                // Try to use the complete system if available
                if (window.BBTTCCButtonManager && window.BBTTCCButtonManager.showFactionDialog) {
                    window.BBTTCCButtonManager.showFactionDialog();
                } else {
                    // Fallback simple faction creation
                    const name = await promptForFactionName();
                    if (name) {
                        createSimpleFaction(name);
                    }
                }
            });

            actorHeader.appendChild(factionBtn);
            console.log("✅ Persistent Faction button created");
        }

        // Dashboard Button
        const scenesHeader = document.querySelector('#sidebar #scenes .directory-header .header-actions');
        if (scenesHeader && !document.querySelector('.bbttcc-persistent-dashboard-btn')) {
            const dashboardBtn = document.createElement('button');
            dashboardBtn.className = 'bbttcc-persistent-dashboard-btn';
            dashboardBtn.innerHTML = '<i class="fas fa-chart-line"></i> Dashboard';
            dashboardBtn.title = 'Open BBTTCC Dashboard';
            dashboardBtn.style.cssText = `
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                color: white; border: none; border-radius: 4px; padding: 4px 8px;
                margin-left: 5px; font-size: 12px; cursor: pointer;
                display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
            `;

            dashboardBtn.addEventListener('click', () => {
                console.log("📊 Dashboard clicked");

                // Try to use the complete system if available
                if (window.BBTTCCButtonManager && window.BBTTCCButtonManager.showDashboard) {
                    window.BBTTCCButtonManager.showDashboard();
                } else {
                    showSimpleDashboard();
                }
            });

            scenesHeader.appendChild(dashboardBtn);
            console.log("✅ Persistent Dashboard button created");
        }
    }

    // Helper functions for fallback functionality
    async function promptForFactionName() {
        return new Promise((resolve) => {
            const dialog = new Dialog({
                title: "Create BBTTCC Faction",
                content: `
                    <div style="padding: 10px;">
                        <label for="faction-name" style="font-weight: bold;">Faction Name:</label>
                        <input type="text" id="faction-name" name="faction-name"
                               placeholder="Enter faction name..."
                               style="width: 100%; margin-top: 5px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                    </div>
                `,
                buttons: {
                    create: {
                        label: "Create Faction",
                        callback: (html) => {
                            const name = html.find('#faction-name').val()?.trim();
                            resolve(name || null);
                        }
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "create"
            });
            dialog.render(true);
        });
    }

    async function createSimpleFaction(name) {
        try {
            const factionData = {
                name: name,
                type: "npc",
                flags: {
                    "bbttcc-factions": {
                        isFaction: true,
                        ops: {
                            violence: { value: 5, max: 10 },
                            nonlethal: { value: 2, max: 10 },
                            intrigue: { value: 4, max: 10 },
                            economy: { value: 3, max: 10 },
                            softpower: { value: 3, max: 10 },
                            diplomacy: { value: 2, max: 10 }
                        },
                        roster: [],
                        maxOPs: 60
                    }
                }
            };

            const faction = await Actor.create(factionData);
            ui.notifications.success(`Created faction: ${name}`);
            console.log(`✅ Created faction: ${name}`);

        } catch (error) {
            console.error("Faction creation error:", error);
            ui.notifications.error("Failed to create faction");
        }
    }

    function showSimpleDashboard() {
        const factions = game.actors.filter(a => a.getFlag("bbttcc-factions", "isFaction"));
        const characters = game.actors.filter(a => a.type === "character" && a.getFlag("bbttcc-territory", "bbttccCharacter"));

        let content = `
            <h2>BBTTCC Dashboard</h2>
            <p><strong>Factions:</strong> ${factions.length}</p>
            <p><strong>BBTTCC Characters:</strong> ${characters.length}</p>
            <hr>
            <h3>Factions:</h3>
        `;

        factions.forEach(f => {
            const ops = f.getFlag("bbttcc-factions", "ops") || {};
            const total = Object.values(ops).reduce((sum, op) => sum + (op.value || 0), 0);
            content += `<p><strong>${f.name}:</strong> ${total} OPs</p>`;
        });

        const dialog = new Dialog({
            title: "BBTTCC Dashboard",
            content: content,
            buttons: {
                close: {
                    label: "Close",
                    callback: () => {}
                }
            }
        });
        dialog.render(true);
    }

    function setupPersistence() {
        console.log("🔍 Setting up button persistence...");

        // Monitor every 3 seconds
        setInterval(() => {
            if (!game?.ready) return;

            const charBtn = document.querySelector('.bbttcc-persistent-char-btn');
            const factionBtn = document.querySelector('.bbttcc-persistent-faction-btn');
            const dashBtn = document.querySelector('.bbttcc-persistent-dashboard-btn');

            if (!charBtn || !factionBtn || !dashBtn) {
                console.log("🔧 Re-creating missing buttons...");
                setupPersistentButtons();
            }
        }, 3000);

        // Hook system
        const hooks = ['renderActorDirectory', 'renderSceneDirectory', 'renderSidebar'];
        hooks.forEach(hookName => {
            Hooks.on(hookName, () => {
                setTimeout(setupPersistentButtons, 100);
            });
        });

        console.log("✅ Button persistence active");
    }

    // Global utilities
    window.BBTTCC_PersistentSystem = {
        refresh: setupPersistentButtons,
        loadComplete: loadCompleteBBTTCCSystem,
        status: () => {
            const charBtn = !!document.querySelector('.bbttcc-persistent-char-btn');
            const factionBtn = !!document.querySelector('.bbttcc-persistent-faction-btn');
            const dashBtn = !!document.querySelector('.bbttcc-persistent-dashboard-btn');

            console.log("🔍 BBTTCC Persistent System Status:");
            console.log(`Character Button: ${charBtn ? '✅' : '❌'}`);
            console.log(`Faction Button: ${factionBtn ? '✅' : '❌'}`);
            console.log(`Dashboard Button: ${dashBtn ? '✅' : '❌'}`);
            console.log(`Complete System: ${window.BBTTCCGUI?.PerfectCharacterCreation ? '✅' : '❌'}`);

            return { character: charBtn, faction: factionBtn, dashboard: dashBtn };
        }
    };
}

console.log("🎯 BBTTCC Complete Persistent System script ready!");