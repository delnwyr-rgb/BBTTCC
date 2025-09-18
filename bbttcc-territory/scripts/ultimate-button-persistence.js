/**
 * BBTTCC ULTIMATE BUTTON PERSISTENCE SYSTEM
 * Makes BBTTCC buttons a permanent part of the Foundry interface
 * NO manual intervention required - buttons persist through ALL refreshes
 */

console.log("🛡️ BBTTCC Ultimate Button Persistence System Loading...");

// Prevent multiple initializations
if (window.BBTTCC_ULTIMATE_PERSISTENCE_LOADED) {
    console.log("⚠️ Ultimate persistence already loaded");
} else {
    window.BBTTCC_ULTIMATE_PERSISTENCE_LOADED = true;

    class BBTTCCUltimateButtonPersistence {
        constructor() {
            this.initialized = false;
            this.hooks = [];
            this.monitoringActive = false;
            this.retryAttempts = 0;
            this.maxRetries = 20;
            this.buttonConfigs = this.getButtonConfigurations();
        }

        getButtonConfigurations() {
            return {
                characterButton: {
                    selector: '.bbttcc-ultimate-character-btn',
                    container: '#sidebar #actors .directory-header .header-actions',
                    position: 'after', // after create button
                    html: `<button class="bbttcc-ultimate-character-btn" title="Create BBTTCC Character" type="button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 4px; padding: 4px 8px; margin-left: 5px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;"><i class="fas fa-user-plus"></i> BBTTCC Character</button>`,
                    onClick: () => this.handleCharacterCreation()
                },
                factionButton: {
                    selector: '.bbttcc-ultimate-faction-btn',
                    container: '#sidebar #actors .directory-header .header-actions',
                    position: 'after', // after character button
                    html: `<button class="bbttcc-ultimate-faction-btn" title="Create BBTTCC Faction" type="button" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; border: none; border-radius: 4px; padding: 4px 8px; margin-left: 5px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;"><i class="fas fa-flag"></i> Create Faction</button>`,
                    onClick: () => this.handleFactionCreation()
                },
                dashboardButton: {
                    selector: '.bbttcc-ultimate-dashboard-btn',
                    container: '#sidebar #scenes .directory-header .header-actions',
                    position: 'append',
                    html: `<button class="bbttcc-ultimate-dashboard-btn" title="Open BBTTCC Strategic Dashboard" type="button" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 4px; padding: 4px 8px; margin-left: 5px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;"><i class="fas fa-chart-line"></i> Dashboard</button>`,
                    onClick: () => this.handleDashboard()
                }
            };
        }

        // Initialize the system when Foundry is ready
        initialize() {
            if (this.initialized) return;

            console.log("🚀 Initializing BBTTCC Ultimate Button Persistence...");

            // Wait for game to be fully ready
            if (game.ready) {
                this.doInitialization();
            } else {
                Hooks.once('ready', () => {
                    setTimeout(() => this.doInitialization(), 500);
                });
            }
        }

        doInitialization() {
            console.log("🎯 Starting ultimate button injection and monitoring...");

            // Inject buttons immediately
            this.injectAllButtons();

            // Set up comprehensive hook system
            this.setupPersistenceHooks();

            // Start monitoring
            this.startContinuousMonitoring();

            this.initialized = true;
            console.log("✅ BBTTCC Ultimate Button Persistence fully initialized!");

            ui.notifications.success("🛡️ BBTTCC Buttons are now permanently integrated!");
        }

        // Comprehensive hook system for all possible UI refreshes
        setupPersistenceHooks() {
            const hooks = [
                'renderActorDirectory',
                'renderSceneDirectory',
                'renderSidebar',
                'renderSidebarTab',
                'collapseSidebar',
                'expandSidebar',
                'canvasReady',
                'ready',
                'updateActor',
                'deleteActor',
                'createActor'
            ];

            hooks.forEach(hookName => {
                const hookId = Hooks.on(hookName, (...args) => {
                    console.log(`🎣 Hook triggered: ${hookName} - checking buttons...`);
                    setTimeout(() => {
                        this.checkAndInjectMissingButtons();
                    }, 100);
                });

                this.hooks.push({ name: hookName, id: hookId });
            });

            console.log(`🎣 Registered ${hooks.length} persistence hooks`);
        }

        // Inject all buttons with intelligent positioning
        injectAllButtons() {
            console.log("🔧 Injecting all BBTTCC buttons...");

            let injectedCount = 0;

            Object.entries(this.buttonConfigs).forEach(([buttonName, config]) => {
                if (this.injectButton(buttonName, config)) {
                    injectedCount++;
                }
            });

            if (injectedCount > 0) {
                console.log(`✅ Successfully injected ${injectedCount} buttons`);
                this.retryAttempts = 0; // Reset retry counter on success
            } else {
                console.warn(`⚠️ Could not inject buttons (attempt ${this.retryAttempts + 1}/${this.maxRetries})`);
                this.retryAttempts++;
            }

            return injectedCount;
        }

        // Inject a single button with error handling
        injectButton(buttonName, config) {
            try {
                // Check if button already exists
                if (document.querySelector(config.selector)) {
                    console.log(`ℹ️ ${buttonName} already exists, skipping`);
                    return true;
                }

                // Find container
                const container = document.querySelector(config.container);
                if (!container) {
                    console.warn(`⚠️ Container not found for ${buttonName}: ${config.container}`);
                    return false;
                }

                // Create button element
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = config.html;
                const button = tempDiv.firstElementChild;

                // Add hover effects
                this.addButtonEffects(button);

                // Add click handler
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // Visual feedback
                    button.style.transform = 'scale(0.95)';
                    setTimeout(() => button.style.transform = 'scale(1)', 150);

                    config.onClick();
                });

                // Position the button
                if (config.position === 'after') {
                    // Insert after the create button (if character/faction) or at end
                    const createBtn = container.querySelector('[data-action="create"]');
                    if (createBtn) {
                        createBtn.parentNode.insertBefore(button, createBtn.nextSibling);
                    } else {
                        container.appendChild(button);
                    }
                } else {
                    container.appendChild(button);
                }

                console.log(`✅ ${buttonName} injected successfully`);
                return true;

            } catch (error) {
                console.error(`❌ Error injecting ${buttonName}:`, error);
                return false;
            }
        }

        // Add visual effects to buttons
        addButtonEffects(button) {
            const originalBg = button.style.background;

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-1px)';
                button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
                button.style.filter = 'brightness(1.1)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = 'none';
                button.style.filter = 'brightness(1)';
                button.style.background = originalBg;
            });
        }

        // Check for missing buttons and re-inject
        checkAndInjectMissingButtons() {
            if (!game?.ready) return;

            const missingButtons = [];

            Object.entries(this.buttonConfigs).forEach(([buttonName, config]) => {
                if (!document.querySelector(config.selector)) {
                    missingButtons.push(buttonName);
                }
            });

            if (missingButtons.length > 0) {
                console.log(`🔧 Re-injecting missing buttons: ${missingButtons.join(', ')}`);
                this.injectAllButtons();
            }
        }

        // Continuous monitoring system
        startContinuousMonitoring() {
            if (this.monitoringActive) return;

            this.monitoringActive = true;
            console.log("🔍 Starting continuous button monitoring...");

            // Primary monitor - checks every 2 seconds
            setInterval(() => {
                this.checkAndInjectMissingButtons();
            }, 2000);

            // Secondary monitor - more frequent checks for critical moments
            setInterval(() => {
                if (!game?.ready) return;

                // Quick check for UI state changes
                const actorTab = document.querySelector('#sidebar-tabs a[data-tab="actors"]');
                const scenesTab = document.querySelector('#sidebar-tabs a[data-tab="scenes"]');

                if (actorTab?.classList.contains('active')) {
                    this.ensureActorDirectoryButtons();
                }
                if (scenesTab?.classList.contains('active')) {
                    this.ensureSceneDirectoryButtons();
                }
            }, 1000);

            console.log("✅ Continuous monitoring active");
        }

        // Ensure actor directory buttons
        ensureActorDirectoryButtons() {
            const characterBtn = document.querySelector('.bbttcc-ultimate-character-btn');
            const factionBtn = document.querySelector('.bbttcc-ultimate-faction-btn');

            if (!characterBtn || !factionBtn) {
                this.injectButton('characterButton', this.buttonConfigs.characterButton);
                this.injectButton('factionButton', this.buttonConfigs.factionButton);
            }
        }

        // Ensure scene directory buttons
        ensureSceneDirectoryButtons() {
            const dashboardBtn = document.querySelector('.bbttcc-ultimate-dashboard-btn');

            if (!dashboardBtn) {
                this.injectButton('dashboardButton', this.buttonConfigs.dashboardButton);
            }
        }

        // Button click handlers
        async handleCharacterCreation() {
            console.log("🧙 BBTTCC Character Creation clicked");

            try {
                await this.ensureBBTTCCSystemLoaded();

                if (window.BBTTCCGUI?.PerfectCharacterCreation) {
                    new window.BBTTCCGUI.PerfectCharacterCreation().render(true);
                } else if (window.BBTTCCGUI?.openPerfectCharacterCreation) {
                    window.BBTTCCGUI.openPerfectCharacterCreation();
                } else {
                    ui.notifications.warn("Character creation system not available");
                }
            } catch (error) {
                console.error("Character creation error:", error);
                ui.notifications.error("Could not open character creation");
            }
        }

        async handleFactionCreation() {
            console.log("🏛️ BBTTCC Faction Creation clicked");

            try {
                await this.ensureBBTTCCSystemLoaded();

                if (window.BBTTCCGUI?.FactionCreation?.createFaction) {
                    window.BBTTCCGUI.FactionCreation.createFaction();
                } else {
                    ui.notifications.warn("Faction creation system not available");
                }
            } catch (error) {
                console.error("Faction creation error:", error);
                ui.notifications.error("Could not create faction");
            }
        }

        async handleDashboard() {
            console.log("📊 BBTTCC Dashboard clicked");

            try {
                await this.ensureBBTTCCSystemLoaded();

                if (window.BBTTCCGUI?.openDashboard) {
                    window.BBTTCCGUI.openDashboard();
                } else {
                    ui.notifications.warn("Dashboard system not available");
                }
            } catch (error) {
                console.error("Dashboard error:", error);
                ui.notifications.error("Could not open dashboard");
            }
        }

        // Ensure BBTTCC system is loaded
        async ensureBBTTCCSystemLoaded() {
            if (window.BBTTCCGUI?.PerfectCharacterCreation && window.BBTTCCGUI?.FactionCreation) {
                return Promise.resolve();
            }

            console.log("🔄 Loading BBTTCC system on-demand...");
            ui.notifications.info("Loading BBTTCC system...");

            try {
                // Try existing loader first
                if (typeof window.loadCompleteBBTTCCSystem === 'function') {
                    await window.loadCompleteBBTTCCSystem();
                    return;
                }

                // Fallback: Load from the working script
                console.log("🔄 Loading complete working system...");

                if (window.BBTTCC_V13_ENHANCED_LOADED) {
                    // System is loaded but maybe not initialized
                    if (!window.BBTTCCGUI) {
                        ui.notifications.warn("BBTTCC system loaded but not initialized properly");
                        return Promise.reject(new Error("System not properly initialized"));
                    }
                    return Promise.resolve();
                } else {
                    ui.notifications.warn("BBTTCC system not available - please reload the game");
                    return Promise.reject(new Error("System not loaded"));
                }

            } catch (error) {
                console.error("Failed to load BBTTCC system:", error);
                ui.notifications.error("Could not load BBTTCC system");
                throw error;
            }
        }

        // Cleanup method
        cleanup() {
            console.log("🧹 Cleaning up ultimate button persistence...");

            // Remove all hooks
            this.hooks.forEach(hook => {
                Hooks.off(hook.name, hook.id);
            });
            this.hooks = [];

            // Remove buttons
            Object.values(this.buttonConfigs).forEach(config => {
                const button = document.querySelector(config.selector);
                if (button) button.remove();
            });

            this.initialized = false;
            this.monitoringActive = false;

            console.log("✅ Cleanup complete");
        }
    }

    // Create and initialize the global system
    window.BBTTCC_ULTIMATE_BUTTON_SYSTEM = new BBTTCCUltimateButtonPersistence();
    window.BBTTCC_ULTIMATE_BUTTON_SYSTEM.initialize();

    // Expose utilities for debugging
    window.BBTTCC_ButtonUtils = {
        refresh: () => window.BBTTCC_ULTIMATE_BUTTON_SYSTEM.injectAllButtons(),
        status: () => {
            const configs = window.BBTTCC_ULTIMATE_BUTTON_SYSTEM.buttonConfigs;
            const status = {};
            Object.entries(configs).forEach(([name, config]) => {
                status[name] = !!document.querySelector(config.selector);
            });
            console.table(status);
            return status;
        },
        restart: () => {
            window.BBTTCC_ULTIMATE_BUTTON_SYSTEM.cleanup();
            window.BBTTCC_ULTIMATE_BUTTON_SYSTEM = new BBTTCCUltimateButtonPersistence();
            window.BBTTCC_ULTIMATE_BUTTON_SYSTEM.initialize();
        }
    };

    console.log("🛡️ BBTTCC Ultimate Button Persistence System fully loaded!");
    console.log("═════════════════════════════════════════════════════════════");
    console.log("✅ Buttons will PERMANENTLY persist through ALL refreshes");
    console.log("✅ NO manual intervention required");
    console.log("✅ Comprehensive hook and monitoring system active");
    console.log("✅ On-demand BBTTCC system loading");
    console.log("✅ Visual feedback and error handling");
    console.log("═════════════════════════════════════════════════════════════");
    console.log("🎯 Use window.BBTTCC_ButtonUtils.status() to check button status");
}