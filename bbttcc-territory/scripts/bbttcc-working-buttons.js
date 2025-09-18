/**
 * BBTTCC Territory - Working Scene Controls & Persistent Buttons
 * ES Module for Foundry VTT v13+ compatible loading
 * Combines scene controls + sidebar buttons with complete system integration
 */

console.log('🎯 BBTTCC Territory: ES Module Loading...');

// Prevent duplicate loading
if (window.BBTTCC_TERRITORY_LOADED) {
    console.log('⚠️ BBTTCC Territory already loaded, skipping');
} else {
    window.BBTTCC_TERRITORY_LOADED = true;

    // Register scene controls hook early during init phase
    Hooks.once('init', function() {
        console.log('🎯 BBTTCC Territory: Init hook fired - registering scene controls...');
        initializeSceneControls();
    });

    // Character sheet integration handled by individual BBTTCC modules

    // Wait for Foundry to be completely ready
    Hooks.once('ready', function() {
        console.log('🎯 BBTTCC Territory: Ready hook fired - initializing...');

        // Initialize persistent buttons
        initializePersistentButtons();

        // Initialize complete system
        initializeCompleteSystem();

        // Set up monitoring
        setupPersistence();

        // Register BBTTCC character sheet integration hook
        registerBBTTCCSheetHook();

        // Add CSS animations for BBTTCC tabs
        addBBTTCCTabCSS();

        // Auto-add tabs to existing BBTTCC characters
        setTimeout(() => {
            autoAddTabsToExistingCharacters();
        }, 3000);

        console.log('✅ BBTTCC Territory: Complete initialization finished!');
        ui.notifications.success("🎮 BBTTCC Territory System Active!");
    });

    // Single Chessboard Button System (from your working screenshots)
    function initializeSceneControls() {
        console.log('♟️ BBTTCC Territory: Setting up single chessboard button...');

        // Use the EXACT working pattern from your old system - single chessboard button
        Hooks.on('getSceneControlButtons', (controls) => {
            try {
                console.log('♟️ getSceneControlButtons hook fired');

                // Only add for GMs
                if (!game.user.isGM) return;

                console.log('♟️ GM detected, adding single chessboard button control');

                // Add single chessboard button using simplified pattern that will actually work
                const territoryControl = {
                    name: 'bbttcc-territory',
                    title: 'BBTTCC Territory Controls',
                    icon: 'fas fa-chess-board',
                    layer: 'TokenLayer',
                    tools: [
                        {
                            name: 'territory-chessboard',
                            title: 'BBTTCC Territory Builder - Create New Territories',
                            icon: 'fas fa-hammer',
                            visible: true,
                            toggle: false,
                            button: true,
                            onClick: (event) => {
                                console.log('🔨 Territory Builder clicked');
                                startTerritoryBuilder();
                            },
                            onChange: (active) => {
                                console.log('🔨 Territory tool state changed:', active);
                            }
                        },
                        {
                            name: 'territory-dashboard',
                            title: 'BBTTCC Territory Management Dashboard',
                            icon: 'fas fa-chess-board',
                            visible: true,
                            toggle: false,
                            button: true,
                            onClick: (event) => {
                                console.log('🏛️ Territory Dashboard clicked');
                                openTerritoryManager();
                            },
                            onChange: (active) => {
                                console.log('🏛️ Dashboard tool state changed:', active);
                            }
                        }
                    ]
                };

                // In Foundry v13+, controls might be an object instead of array
                if (Array.isArray(controls)) {
                    controls.push(territoryControl);
                } else {
                    controls['bbttcc-territory'] = territoryControl;
                }

                console.log('✅ Single chessboard control added successfully');

            } catch (error) {
                console.error('❌ Error in getSceneControlButtons:', error);
            }
        });

        // Add hook to attach proper event listeners after scene controls render
        Hooks.on('renderSceneControls', (app, html, data) => {
            setTimeout(() => {
                attachChessboardEventListeners();
            }, 100);
        });

        console.log('✅ Single chessboard button hook pattern restored');
    }

    // Attach proper left/right click event listeners to the chessboard button
    function attachChessboardEventListeners() {
        try {
            console.log('♟️ Attaching chessboard event listeners...');

            // Find the chessboard button in the rendered controls
            const chessboardTool = document.querySelector('[data-tool="territory-chessboard"]');
            if (!chessboardTool) {
                console.log('⚠️ Chessboard tool button not found in DOM');
                return;
            }

            console.log('♟️ Found chessboard tool button, attaching listeners');

            // Remove existing listeners to avoid duplicates
            chessboardTool.removeEventListener('click', handleChessboardLeftClick);
            chessboardTool.removeEventListener('contextmenu', handleChessboardRightClick);

            // Add proper event listeners
            chessboardTool.addEventListener('click', handleChessboardLeftClick);
            chessboardTool.addEventListener('contextmenu', handleChessboardRightClick);

            console.log('✅ Chessboard event listeners attached successfully');

        } catch (error) {
            console.error('❌ Error attaching chessboard listeners:', error);
        }
    }

    function handleChessboardLeftClick(event) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🏛️ Territory Dashboard button clicked');
        openTerritoryManager();
    }

    function handleChessboardRightClick(event) {
        event.preventDefault();
        event.stopPropagation();
        console.log('🔨 Territory Builder right-clicked');
        startTerritoryBuilder();
    }

    // Persistent Buttons System (from your working patterns)
    function initializePersistentButtons() {
        console.log('🎮 BBTTCC Territory: Setting up persistent buttons...');

        // Wait a moment for UI to be ready
        setTimeout(() => {
            addPersistentButtons();
        }, 1000);

        // Hook into directory renders for persistence
        Hooks.on('renderActorDirectory', () => {
            setTimeout(addPersistentButtons, 100);
        });

        Hooks.on('renderSceneDirectory', () => {
            setTimeout(addPersistentButtons, 100);
        });
    }

    function addPersistentButtons() {
        const actorDirectory = document.querySelector('#sidebar #actors');
        if (!actorDirectory) return;

        const actorHeader = actorDirectory.querySelector('.directory-header .header-actions');
        if (!actorHeader) return;

        // Remove existing buttons to avoid duplicates
        const existingContainer = actorHeader.querySelector('.bbttcc-button-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'bbttcc-button-container';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.marginLeft = '10px';

        // Character Creation button
        const createBtn = document.createElement('button');
        createBtn.className = 'bbttcc-char-btn persistent-bbttcc-btn';
        createBtn.innerHTML = '<i class="fas fa-atom"></i> BBTTCC Character';
        createBtn.title = 'Create BBTTCC Character with Complete Integration';
        createBtn.style.cssText = `
            font-size: 12px; padding: 4px 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; border: none; border-radius: 4px; cursor: pointer;
            display: inline-flex; align-items: center; gap: 4px;
        `;

        createBtn.addEventListener('click', () => {
            console.log('🧙 BBTTCC Character button clicked');
            initializeCompleteSystem();
            if (window.BBTTCCGUI?.PerfectCharacterCreation) {
                new window.BBTTCCGUI.PerfectCharacterCreation().render(true);
                ui.notifications.info("🧙 BBTTCC Character Creation opened!");
            } else {
                ui.notifications.warn('Character creation not available - system initialization failed');
            }
        });

        // Faction Creation button
        const factionBtn = document.createElement('button');
        factionBtn.className = 'bbttcc-faction-btn persistent-faction-btn';
        factionBtn.innerHTML = '<i class="fas fa-flag"></i> Create Faction';
        factionBtn.title = 'Create BBTTCC Faction with Organization Points';
        factionBtn.style.cssText = `
            font-size: 12px; padding: 4px 8px;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white; border: none; border-radius: 4px; cursor: pointer;
            display: inline-flex; align-items: center; gap: 4px;
        `;

        factionBtn.addEventListener('click', () => {
            console.log('🏛️ BBTTCC Faction button clicked');
            createSimpleFaction();
        });

        // Dashboard button
        const dashboardBtn = document.createElement('button');
        dashboardBtn.className = 'bbttcc-dashboard-btn persistent-dashboard-btn';
        dashboardBtn.innerHTML = '<i class="fas fa-chart-line"></i> Dashboard';
        dashboardBtn.title = 'Open BBTTCC Dashboard';
        dashboardBtn.style.cssText = `
            font-size: 12px; padding: 4px 8px;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white; border: none; border-radius: 4px; cursor: pointer;
            display: inline-flex; align-items: center; gap: 4px;
        `;

        dashboardBtn.addEventListener('click', () => {
            console.log('📊 Dashboard clicked');
            initializeCompleteSystem();
            if (window.BBTTCCGUI?.BBTTCCWorkingDashboard) {
                new window.BBTTCCGUI.BBTTCCWorkingDashboard().render(true);
                ui.notifications.info("📊 BBTTCC Dashboard opened!");
            } else {
                ui.notifications.warn('Dashboard not available - system initialization failed');
            }
        });

        // Add buttons to container
        buttonContainer.appendChild(createBtn);
        buttonContainer.appendChild(factionBtn);
        buttonContainer.appendChild(dashboardBtn);

        // Add container to header
        actorHeader.appendChild(buttonContainer);

        console.log('✅ BBTTCC Territory: Persistent buttons added');
    }

    // Simple faction creation
    async function createSimpleFaction() {
        const name = await promptForFactionName();
        if (!name) return;

        try {
            // Use the proper BBTTCC Factions API instead of hardcoded structure
            const factionsModule = game.modules.get('bbttcc-factions');
            if (factionsModule?.api?.createFaction) {
                console.log(`🏛️ Using BBTTCC Factions API to create: ${name}`);
                const faction = await factionsModule.api.createFaction({
                    name: name,
                    biography: "Created via BBTTCC Territory UI"
                });
                console.log(`✅ Faction created via API: ${name}`);
                if (faction) {
                    faction.sheet.render(true);
                }
                return;
            }

            // Fallback: use modern faction creation if API not available
            console.log(`🏛️ Fallback: Creating faction directly: ${name}`);
            const factionData = {
                name: name,
                type: "npc",
                flags: {
                    "bbttcc-factions": {
                        isFaction: true,
                        ops: {
                            violence: { value: 2, max: 10 },
                            nonlethal: { value: 2, max: 10 },
                            intrigue: { value: 2, max: 10 },
                            economy: { value: 2, max: 10 },
                            softpower: { value: 2, max: 10 },
                            diplomacy: { value: 2, max: 10 },
                            logistics: { value: 2, max: 10 },
                            culture: { value: 2, max: 10 },
                            faith: { value: 1, max: 10 }
                        },
                        organizationPoints: {
                            violence: 2, diplomacy: 2, economy: 2, intrigue: 2,
                            logistics: 2, culture: 2, faith: 1,
                            softPower: 2, nonLethal: 2
                        },
                        roster: [],
                        maxOPs: 60
                    }
                }
            };

            const faction = await Actor.create(factionData);
            ui.notifications.success(`🏛️ Created faction: ${name}`);
            console.log(`✅ Created faction: ${name}`);

        } catch (error) {
            console.error("Faction creation error:", error);
            ui.notifications.error("Failed to create faction");
        }
    }

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

    // Simple dashboard
    function showDashboard() {
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

    // Embedded Complete BBTTCC System
    function initializeCompleteSystem() {
        if (window.BBTTCCGUI?.PerfectCharacterCreation) {
            return; // Already loaded
        }

        console.log("📦 Initializing embedded BBTTCC system...");

        // Initialize BBTTCCGUI namespace
        window.BBTTCCGUI = window.BBTTCCGUI || {};

        // Embed the COMPLETE working BBTTCCPerfectCharacterCreation class with all Tikkun Spark features
        class BBTTCCPerfectCharacterCreation extends foundry.applications.api.ApplicationV2 {
            static DEFAULT_OPTIONS = {
                id: "bbttcc-perfect-character-creation",
                classes: ["bbttcc-gui"],
                tag: "div",
                window: {
                    title: "BBTTCC Perfect Character Creation",
                    resizable: true
                },
                position: { width: 1000, height: 800 },
                actions: {
                    selectRace: BBTTCCPerfectCharacterCreation.prototype._onSelectRace,
                    selectClass: BBTTCCPerfectCharacterCreation.prototype._onSelectClass,
                    selectFaction: BBTTCCPerfectCharacterCreation.prototype._onSelectFaction,
                    toggleCategory: BBTTCCPerfectCharacterCreation.prototype._onToggleCategory,
                    createCharacter: BBTTCCPerfectCharacterCreation.prototype._onCreateCharacter
                }
            };

            constructor(options = {}) {
                super(options);
                this.selectedRace = null;
                this.selectedClass = null;
                this.selectedFaction = null;
                this.characterName = "";
                this.tikkunSparks = 1;
                this.races = [];
                this.classes = [];
                this.factions = [];
                this.bbttccItems = [];
                this.selectedBBTTCCItems = new Set();
                this.expandedCategories = new Set(['archetypes', 'crewTypes', 'occultAssociations', 'politicalAffiliations', 'enlightenmentLevels', 'sephirothicAlignments']);
                this._dataLoaded = false;
                this._nameInputLocked = false;
            }

            async _prepareContext(options) {
                if (!this._dataLoaded) {
                    console.log("Loading character creation data...");
                    await this._loadData();
                    this._dataLoaded = true;
                }
                return { ready: true };
            }

            async _loadData() {
                try {
                    this.races = [];
                    this.classes = [];

                    for (const pack of game.packs) {
                        if (pack.metadata.type === "Item" && pack.metadata.system === "dnd5e") {
                            try {
                                const items = await pack.getDocuments();
                                this.races.push(...items.filter(i => i.type === "race").slice(0, 25));
                                this.classes.push(...items.filter(i => i.type === "class").slice(0, 20));
                            } catch (error) {
                                console.warn(`Pack error: ${pack.collection}`);
                            }
                        }
                    }

                    this.factions = game.actors.filter(actor => {
                        return actor.getFlag("bbttcc-factions", "isFaction") === true;
                    });

                    this.bbttccItems = [];

                    for (const item of game.items) {
                        let isBBTTCC = false;

                        try {
                            const source = item.system?.source;
                            if (source) {
                                const sourceStr = String(source);
                                if (sourceStr === 'BBTTCC' || sourceStr.indexOf('BBTTCC') !== -1) {
                                    isBBTTCC = true;
                                }
                            }
                        } catch (e) {}

                        if (!isBBTTCC && item.name) {
                            const name = item.name.toLowerCase();
                            if (name.includes('archetype:') ||
                                name.includes('crew type:') ||
                                name.includes('occult association:') ||
                                name.includes('political affiliation:') ||
                                name.includes('enlightenment:') ||
                                name.includes('alignment:')) {
                                isBBTTCC = true;
                            }
                        }

                        if (!isBBTTCC && item.type === 'feat') {
                            const description = item.system?.description?.value || '';
                            if (description.includes('Violence OP') ||
                                description.includes('Economy OP') ||
                                description.includes('Intrigue OP') ||
                                description.includes('BBTTCC')) {
                                isBBTTCC = true;
                            }
                        }

                        if (isBBTTCC) {
                            this.bbttccItems.push(item);
                        }
                    }

                    console.log(`✅ Loaded: ${this.races.length} races, ${this.classes.length} classes, ${this.factions.length} factions, ${this.bbttccItems.length} BBTTCC items`);

                } catch (error) {
                    console.error("Data loading error:", error);
                }
            }

            async _renderHTML(context, options) {
                const raceOptions = this.races.map(race => {
                    const selected = this.selectedRace && this.selectedRace.uuid === race.uuid ? 'selected' : '';
                    return `<div class="race-option ${selected}" data-uuid="${race.uuid}" data-action="selectRace" style="padding: 4px; margin: 1px 0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 11px; ${selected ? 'background: #2196f3; color: white;' : ''}">${race.name}</div>`;
                }).join('');

                const classOptions = this.classes.map(cls => {
                    const selected = this.selectedClass && this.selectedClass.uuid === cls.uuid ? 'selected' : '';
                    return `<div class="class-option ${selected}" data-uuid="${cls.uuid}" data-action="selectClass" style="padding: 4px; margin: 1px 0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 11px; ${selected ? 'background: #2196f3; color: white;' : ''}">${cls.name}</div>`;
                }).join('');

                const factionOptions = this.factions.map(faction => {
                    const selected = this.selectedFaction && this.selectedFaction.id === faction.id ? 'selected' : '';
                    const ops = faction.getFlag("bbttcc-factions", "ops") || {};
                    const totalOPs = Object.values(ops).reduce((sum, op) => sum + (op.value || 0), 0);
                    return `<div class="faction-option ${selected}" data-faction-id="${faction.id}" data-action="selectFaction" style="padding: 4px; margin: 1px 0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 11px; ${selected ? 'background: #6f42c1; color: white;' : ''}">
                        ${faction.name}<br><small style="opacity: 0.8;">${totalOPs} OPs</small>
                    </div>`;
                }).join('');

                // BBTTCC Options by Category (the full working version!)
                const bbttccByCategory = {
                    archetypes: this.bbttccItems.filter(i => i.name.toLowerCase().includes('archetype:')),
                    crewTypes: this.bbttccItems.filter(i => i.name.toLowerCase().includes('crew type:')),
                    occultAssociations: this.bbttccItems.filter(i => i.name.toLowerCase().includes('occult association:')),
                    politicalAffiliations: this.bbttccItems.filter(i => i.name.toLowerCase().includes('political affiliation:')),
                    enlightenmentLevels: this.bbttccItems.filter(i => i.name.toLowerCase().includes('enlightenment:')),
                    sephirothicAlignments: this.bbttccItems.filter(i => i.name.toLowerCase().includes('alignment:'))
                };

                const bbttccOptions = Object.entries(bbttccByCategory).map(([category, items]) => {
                    if (items.length === 0) return '';

                    const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    const isExpanded = this.expandedCategories.has(category);

                    return `
                        <div style="margin-bottom: 6px; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px;">
                            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 4px;">
                                <h6 style="margin: 0; color: #6f42c1; font-size: 12px; font-weight: bold;">${categoryName} (${items.length})</h6>
                                <button data-action="toggleCategory" data-category="${category}" style="background: none; border: 1px solid #6f42c1; color: #6f42c1; padding: 1px 4px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-left: auto;">
                                    ${isExpanded ? 'Collapse' : 'Expand'}
                                </button>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 2px; ${isExpanded ? '' : 'display: none;'}">
                                ${items.map(item => {
                                    const isSelected = this.selectedBBTTCCItems.has(item.id);
                                    return `<div style="display: flex; align-items: center; gap: 4px; padding: 2px; font-size: 10px;">
                                        <input type="checkbox" id="bbttcc-${item.id}" data-item-id="${item.id}" style="margin: 0;" ${isSelected ? 'checked' : ''}>
                                        <label for="bbttcc-${item.id}" style="line-height: 1.2; cursor: pointer;">${item.name}</label>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }).join('');

                const tikkunGuide = `
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 4px; border-radius: 4px; font-size: 9px; color: #856404; margin-bottom: 10px;">
                        <strong>Tikkun Guide:</strong> 0=Mundane, 1-2=Awakening, 3-4=Seeking, 5-6=Understanding, 7-8=Wisdom, 9-10=Enlightened
                    </div>
                `;

                const canCreate = !!(this.selectedRace && this.selectedClass && this.characterName && this.characterName.trim().length > 0);

                return `
                    <div style="padding: 12px; font-family: 'Signika', sans-serif; background: white; color: black; font-size: 12px; height: 100%; overflow-y: auto;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px; margin: -12px -12px 12px -12px;">
                            <h2 style="margin: 0; font-size: 16px;">🧙 BBTTCC Perfect Character Creation</h2>
                            <p style="margin: 3px 0 0 0; opacity: 0.9; font-size: 10px;">Complete Integration: D&D 5e + Factions + Tikkun + All BBTTCC Systems</p>
                        </div>

                        <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 8px; margin-bottom: 10px;">
                            <div>
                                <label style="display: block; margin-bottom: 2px; font-weight: bold; font-size: 11px;">Character Name:</label>
                                <input type="text" id="character-name-input" value="${this.characterName}" placeholder="Enter character name" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 2px; font-weight: bold; font-size: 11px;">Tikkun Sparks:</label>
                                <input type="number" id="tikkun-sparks" value="${this.tikkunSparks}" min="0" max="10" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
                            </div>
                        </div>

                        ${tikkunGuide}

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 10px 0;">
                            <div>
                                <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
                                    🧝 Race ${this.selectedRace ? `(${this.selectedRace.name})` : ''}
                                </h3>
                                <div style="height: 180px; overflow-y: auto; border: 1px solid #ddd; padding: 6px; background: #f8f9fa; border-radius: 3px;">
                                    ${raceOptions || '<p style="color: #6c757d; font-size: 10px;">No races</p>'}
                                </div>
                            </div>

                            <div>
                                <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
                                    ⚔️ Class ${this.selectedClass ? `(${this.selectedClass.name})` : ''}
                                </h3>
                                <div style="height: 180px; overflow-y: auto; border: 1px solid #ddd; padding: 6px; background: #f8f9fa; border-radius: 3px;">
                                    ${classOptions || '<p style="color: #6c757d; font-size: 10px;">No classes</p>'}
                                </div>
                            </div>

                            <div>
                                <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
                                    🏛️ Faction ${this.selectedFaction ? `(${this.selectedFaction.name})` : '(Optional)'}
                                </h3>
                                <div style="height: 180px; overflow-y: auto; border: 1px solid #ddd; padding: 6px; background: #f8f9fa; border-radius: 3px;">
                                    ${factionOptions || '<p style="color: #6c757d; font-size: 10px;">No factions</p>'}
                                </div>
                            </div>
                        </div>

                        <div style="margin-bottom: 10px;">
                            <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">🏛️ BBTTCC Character Options (${this.bbttccItems.length} total - Optional)</h3>
                            <div style="height: 260px; overflow-y: auto; border: 1px solid #ddd; padding: 8px; background: #f8f9fa; border-radius: 3px;">
                                ${bbttccOptions || '<p style="color: #6c757d; font-size: 10px;">No BBTTCC options found</p>'}
                            </div>
                        </div>

                        <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px; border-top: 2px solid ${canCreate ? '#28a745' : '#dc3545'};">
                            <button type="button" data-action="createCharacter" style="background: ${canCreate ? '#28a745' : '#6c757d'}; color: white; border: none; padding: 12px 40px; border-radius: 4px; cursor: ${canCreate ? 'pointer' : 'not-allowed'}; font-weight: bold; font-size: 14px;" ${canCreate ? '' : 'disabled'}>
                                🧙 Create Perfect BBTTCC Character
                            </button>
                            <p style="margin: 6px 0 0 0; font-size: 10px; color: #6c757d;">
                                ${canCreate ? '✅ Ready! Selected BBTTCC items will be added as feat items on character sheet' : '❌ Select race, class, and enter name'}
                            </p>
                        </div>
                    </div>
                `;
            }

            async _replaceHTML(result, content, options) {
                content.innerHTML = result;

                const nameInput = content.querySelector('#character-name-input');
                if (nameInput && !this._nameInputLocked) {
                    nameInput.addEventListener('input', (e) => {
                        this._nameInputLocked = true;
                        this.characterName = e.target.value;
                        setTimeout(() => {
                            this._nameInputLocked = false;
                        }, 100);
                    });
                }

                const sparksInput = content.querySelector('#tikkun-sparks');
                if (sparksInput) {
                    sparksInput.addEventListener('input', (e) => {
                        this.tikkunSparks = parseInt(e.target.value) || 1;
                    });
                }

                content.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
                    checkbox.addEventListener('change', (e) => {
                        const itemId = e.target.dataset.itemId;
                        if (e.target.checked) {
                            this.selectedBBTTCCItems.add(itemId);
                        } else {
                            this.selectedBBTTCCItems.delete(itemId);
                        }
                    });
                });
            }

            async _onSelectRace(event, target) {
                try {
                    this.selectedRace = await fromUuid(target.dataset.uuid);
                    this.render();
                } catch (error) {
                    console.error("Race selection error:", error);
                }
            }

            async _onSelectClass(event, target) {
                try {
                    this.selectedClass = await fromUuid(target.dataset.uuid);
                    this.render();
                } catch (error) {
                    console.error("Class selection error:", error);
                }
            }

            async _onSelectFaction(event, target) {
                try {
                    const factionId = target.dataset.factionId;
                    this.selectedFaction = game.actors.get(factionId);
                    this.render();
                } catch (error) {
                    console.error("Faction selection error:", error);
                }
            }

            async _onToggleCategory(event, target) {
                const category = target.dataset.category;
                if (this.expandedCategories.has(category)) {
                    this.expandedCategories.delete(category);
                } else {
                    this.expandedCategories.add(category);
                }
                this.render();
            }

            async _onCreateCharacter(event, target) {
                if (!this.selectedRace || !this.selectedClass || !this.characterName.trim()) {
                    ui.notifications.warn("Please select race, class, and enter character name");
                    return;
                }

                try {
                    ui.notifications.info("🧙 Creating perfect BBTTCC character...");

                    const selectedBBTTCCObjects = [];
                    this.selectedBBTTCCItems.forEach(itemId => {
                        const bbttccItem = game.items.get(itemId);
                        if (bbttccItem) {
                            selectedBBTTCCObjects.push(bbttccItem.toObject());
                        }
                    });

                    const actorData = {
                        name: this.characterName.trim(),
                        type: "character",
                        flags: {
                            "bbttcc-territory": {
                                bbttccCharacter: true,
                                faction: this.selectedFaction ? this.selectedFaction.name : "Independent"
                            },
                            "bbttcc-radiation": { points: 0 },
                            "bbttcc-tikkun": { sparks: this.tikkunSparks },
                            "bbttcc-raid": { experience: 0 },
                            "bbttcc-character-options": {
                                applied: selectedBBTTCCObjects.map(i => i._id),
                                linkedFaction: this.selectedFaction ? this.selectedFaction.id : null
                            }
                        }
                    };

                    const actor = await Actor.create(actorData);

                    if (selectedBBTTCCObjects.length > 0) {
                        await actor.createEmbeddedDocuments("Item", selectedBBTTCCObjects);
                    }

                    // Add character to faction roster automatically if faction selected
                    if (this.selectedFaction) {
                        try {
                            console.log(`🏛️ Adding ${actor.name} to ${this.selectedFaction.name} faction roster...`);

                            const currentRoster = this.selectedFaction.getFlag("bbttcc-factions", "roster") || [];
                            const existingEntry = currentRoster.find(member => member.actorId === actor.id);

                            if (!existingEntry) {
                                const newMember = {
                                    actorId: actor.id,
                                    name: actor.name,
                                    role: "Member",
                                    dateJoined: new Date().toISOString().split('T')[0],
                                    status: "Active",
                                    contributionPoints: 0
                                };

                                const updatedRoster = [...currentRoster, newMember];
                                await this.selectedFaction.setFlag("bbttcc-factions", "roster", updatedRoster);

                                ui.notifications.success(`🏛️ ${actor.name} joined ${this.selectedFaction.name}!`);
                            }
                        } catch (factionError) {
                            console.warn("Faction roster update failed:", factionError);
                        }
                    }

                    const raceData = this.selectedRace.toObject();
                    const classData = this.selectedClass.toObject();
                    classData.system.levels = 0;

                    const manager = new dnd5e.applications.advancement.AdvancementManager(actor, {
                        automaticApplication: true
                    });
                    manager.clone.updateSource({ items: [raceData, classData] });

                    for (const itemData of [raceData, classData]) {
                        const item = manager.clone.items.get(itemData._id);
                        switch (item.type) {
                            case "class":
                                manager.createLevelChangeSteps(item, 1);
                                break;
                            default:
                                // Handle race/species advancement flows (levels 0 and 1)
                                for (let l = 0; l < 2; l++) {
                                    const flows = manager.constructor.flowsForLevel(item, l);
                                    for (const flow of flows) {
                                        manager.steps.push({type: "forward", flow});
                                    }
                                }
                                break;
                        }
                    }

                    await manager.render(true);
                    ui.notifications.info("🎲 Complete D&D 5e advancement - BBTTCC integration active!");

                    // Automatically add BBTTCC tab to the newly created character
                    setTimeout(() => {
                        try {
                            console.log("🎯 Auto-adding BBTTCC tab to newly created character...");

                            // Find the newly created character's sheet using our integrated system
                            const newCharacterSheet = findCharacterSheet(actor);

                            if (newCharacterSheet) {
                                console.log("✅ Found new character sheet, adding BBTTCC tab...");
                                const success = addBBTTCCTabToSheet(newCharacterSheet);
                                if (success) {
                                    ui.notifications.success("🎯 BBTTCC Profile tab automatically added!");
                                } else {
                                    console.log("⚠️ Failed to add tab to new character, will be added when sheet reopens");
                                }
                            } else {
                                console.log("⚠️ Character sheet not found, will be added when opened");
                            }
                        } catch (error) {
                            console.warn("⚠️ Auto-tab addition failed:", error);
                        }
                    }, 2000); // Wait 2 seconds for character sheet to render

                    this.close();

                } catch (error) {
                    console.error("Character creation error:", error);
                    ui.notifications.error(`Character creation failed: ${error.message}`);
                }
            }
        }

        // Embed the BBTTCCWorkingDashboard class
        class BBTTCCWorkingDashboard extends foundry.applications.api.ApplicationV2 {
            static DEFAULT_OPTIONS = {
                id: "bbttcc-working-dashboard",
                classes: ["bbttcc-gui", "working-dashboard"],
                tag: "div",
                window: {
                    title: "BBTTCC Strategic Dashboard",
                    icon: "fas fa-chart-line",
                    resizable: true
                },
                position: { width: 900, height: 700 }
            };

            async _prepareContext(options) {
                return { ready: true };
            }

            async _renderHTML(context, options) {
                const factions = game.actors.filter(a => a.getFlag("bbttcc-factions", "isFaction"));
                const characters = game.actors.filter(a => a.type === "character" && a.getFlag("bbttcc-territory", "bbttccCharacter"));

                let factionHTML = factions.map(f => {
                    const ops = f.getFlag("bbttcc-factions", "ops") || {};
                    const total = Object.values(ops).reduce((sum, op) => sum + (op.value || 0), 0);
                    const maxOPs = f.getFlag("bbttcc-factions", "maxOPs") || 60;
                    const roster = f.getFlag("bbttcc-factions", "roster") || [];

                    const linkedCharacters = characters.filter(c => {
                        const factionName = c.getFlag("bbttcc-territory", "faction");
                        const linkedId = c.getFlag("bbttcc-character-options", "linkedFaction");
                        return factionName === f.name || linkedId === f.id;
                    });

                    return `
                        <div class="faction-card" style="border: 1px solid #ccc; margin: 15px 0; padding: 20px; border-radius: 8px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h3 style="color: #495057; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px; font-size: 18px;">
                                <i class="fas fa-flag" style="color: #6f42c1;"></i>
                                ${f.name}
                            </h3>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div>
                                    <h4 style="color: #28a745; margin: 0 0 10px 0; font-size: 14px;">📊 Organization Points</h4>
                                    <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                                        <div style="font-size: 28px; font-weight: bold; color: #28a745;">${total} / ${maxOPs}</div>
                                        <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">Available Organization Points</div>
                                    </div>
                                </div>

                                <div>
                                    <h4 style="color: #17a2b8; margin: 0 0 10px 0; font-size: 14px;">👥 Linked Characters</h4>
                                    <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #17a2b8;">
                                        <div style="font-size: 28px; font-weight: bold; color: #17a2b8;">${linkedCharacters.length}</div>
                                        <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">Active Characters</div>
                                        ${linkedCharacters.length > 0 ? `
                                            <div style="margin-top: 8px; font-size: 11px;">
                                                ${linkedCharacters.map(c => `<div style="padding: 2px 0; color: #495057;">• ${c.name}</div>`).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div style="padding: 20px; font-family: 'Signika', sans-serif; background: #f8f9fa; color: #212529; height: 100%; overflow-y: auto;">
                        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; margin: -20px -20px 20px -20px; text-align: center;">
                            <h1 style="margin: 0; font-size: 24px; font-weight: bold;">
                                <i class="fas fa-chart-line" style="margin-right: 10px;"></i>
                                BBTTCC Strategic Dashboard
                            </h1>
                            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Complete faction and character oversight system</p>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #6f42c1;">
                                <div style="font-size: 36px; font-weight: bold; color: #6f42c1;">${factions.length}</div>
                                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">Active Factions</div>
                            </div>

                            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #007bff;">
                                <div style="font-size: 36px; font-weight: bold; color: #007bff;">${characters.length}</div>
                                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">BBTTCC Characters</div>
                            </div>

                            <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-left: 4px solid #28a745;">
                                <div style="font-size: 36px; font-weight: bold; color: #28a745;">${factions.reduce((sum, f) => {
                                    const ops = f.getFlag("bbttcc-factions", "ops") || {};
                                    return sum + Object.values(ops).reduce((opSum, op) => opSum + (op.value || 0), 0);
                                }, 0)}</div>
                                <div style="font-size: 14px; color: #6c757d; margin-top: 5px;">Total Organization Points</div>
                            </div>
                        </div>

                        <h2 style="color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; margin: 0 0 20px 0; font-size: 20px;">
                            🏛️ Faction Details
                        </h2>

                        ${factionHTML}
                    </div>
                `;
            }

            async _replaceHTML(result, content, options) {
                content.innerHTML = result;
            }
        }

        // Register classes globally
        window.BBTTCCGUI.PerfectCharacterCreation = BBTTCCPerfectCharacterCreation;
        window.BBTTCCGUI.BBTTCCWorkingDashboard = BBTTCCWorkingDashboard;

        console.log("✅ Embedded BBTTCC system loaded successfully");
    }

    // Function to safely get text content from elements
    function safeGetText(element) {
        try {
            return (element.textContent || element.value || element.innerHTML || '').toString().trim();
        } catch (error) {
            return '';
        }
    }

    // Function to find any character sheet with multiple methods
    function findCharacterSheet(actor) {
        console.log(`🔍 Finding character sheet for ${actor?.name || 'Unknown'}...`);

        const methods = [
            // Method 1: Check Foundry's UI windows
            () => {
                const windows = Object.values(ui.windows || {});
                return windows.find(app =>
                    app.actor?.id === actor.id &&
                    app.actor.type === 'character' &&
                    app.rendered
                );
            },

            // Method 2: Check UI applications
            () => {
                const apps = Object.values(ui.applications || {});
                return apps.find(app =>
                    app.actor?.id === actor.id &&
                    app.actor.type === 'character' &&
                    app.rendered
                );
            },

            // Method 3: Direct actor access
            () => {
                if (actor && actor.sheet && actor.sheet.rendered) {
                    return actor.sheet;
                }
                return null;
            }
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                const result = methods[i]();
                if (result) {
                    console.log(`✅ Found character sheet using method ${i + 1}`);
                    return result;
                }
            } catch (error) {
                console.log(`❌ Method ${i + 1} failed:`, error.message);
            }
        }

        console.log("❌ Could not find character sheet with any method");
        return null;
    }

    // Function to get HTML element from sheet with fallbacks
    function getSheetHTML(sheet) {
        if (sheet.isDOMSheet) {
            return $(sheet.element);
        }

        const htmlMethods = [
            () => sheet.element,
            () => sheet._element,
            () => $(sheet.element),
            () => $(sheet._element),
            () => sheet.form,
            () => $(sheet.form)
        ];

        for (const method of htmlMethods) {
            try {
                const html = method();
                if (html && (typeof html.find === 'function' || html.length > 0)) {
                    return typeof html.find === 'function' ? html : $(html);
                }
            } catch (error) {
                // Continue to next method
            }
        }

        return null;
    }

    // Function to create comprehensive BBTTCC tab content
    function createBBTTCCTabContent(actor) {
        // Get BBTTCC data from multiple sources
        const bbttccEnhancements = actor.getFlag("bbttcc-territory", "bbttccEnhancements") || {};
        const tikkunSparks = actor.getFlag("bbttcc-tikkun", "sparks") || bbttccEnhancements.tikkunSparks || { conceptual: 0, emotional: 0, physical: 0 };
        const territoryFaction = actor.getFlag("bbttcc-territory", "faction") || bbttccEnhancements.territoryAffiliation || "Independent";
        const radiationLevel = actor.getFlag("bbttcc-radiation", "level") || bbttccEnhancements.radiationExposure?.level || "None";
        const raidExperience = actor.getFlag("bbttcc-raid", "participated") || bbttccEnhancements.raidExperience?.participated || 0;

        console.log("📊 Using BBTTCC data:", { tikkunSparks, territoryFaction, radiationLevel, raidExperience });

        const totalSparks = (tikkunSparks.conceptual || 0) + (tikkunSparks.emotional || 0) + (tikkunSparks.physical || 0);

        return `<div class="tab" data-tab="bbttcc-ultimate" data-group="primary">
            <div class="bbttcc-ultimate-content" style="padding: 20px; font-family: 'Roboto', sans-serif;">
                <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 15px; margin-bottom: 25px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
                    <h2 style="margin: 0; font-size: 28px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
                        <i class="fas fa-star" style="color: #ffd700; margin-right: 10px;"></i>
                        BBTTCC Strategic Profile
                    </h2>
                    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">
                        🎯 Integration SUCCESSFUL - All systems operational
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 20px; border-radius: 12px; border: 2px solid #2196f3; box-shadow: 0 4px 15px rgba(33, 150, 243, 0.2);">
                        <h3 style="margin: 0 0 15px 0; color: #1976d2; font-size: 18px;">
                            <i class="fas fa-flag" style="margin-right: 8px;"></i>Territory Affiliation
                        </h3>
                        <div style="font-size: 22px; font-weight: bold; color: #0d47a1; margin-bottom: 8px;">
                            ${territoryFaction}
                        </div>
                        <div style="font-size: 14px; color: #424242; font-style: italic;">
                            Current faction allegiance and territorial authority
                        </div>
                    </div>

                    <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 20px; border-radius: 12px; border: 2px solid ${radiationLevel === 'None' ? '#4caf50' : '#ff9800'}; box-shadow: 0 4px 15px rgba(255, 152, 0, 0.2);">
                        <h3 style="margin: 0 0 15px 0; color: #f57c00; font-size: 18px;">
                            <i class="fas fa-radiation" style="margin-right: 8px;"></i>Radiation Exposure
                        </h3>
                        <div style="font-size: 22px; font-weight: bold; color: ${radiationLevel === 'None' ? '#2e7d32' : '#d84315'}; margin-bottom: 8px;">
                            ${radiationLevel}
                        </div>
                        <div style="font-size: 14px; color: #424242; font-style: italic;">
                            Current radiation exposure and adaptation level
                        </div>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 25px; border-radius: 15px; border: 3px solid #ffd700; margin: 25px 0; box-shadow: 0 8px 32px rgba(255, 215, 0, 0.3);">
                    <h3 style="color: #ffd700; text-align: center; margin-bottom: 20px; font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
                        <i class="fas fa-star" style="margin-right: 10px;"></i>Tikkun Sparks
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center;">
                        <div style="background: rgba(255, 215, 0, 0.15); padding: 20px; border-radius: 12px; border: 2px solid #ffd700; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%); animation: pulse 3s infinite;"></div>
                            <div style="position: relative; z-index: 1;">
                                <div style="color: #ffd700; font-size: 24px; margin-bottom: 10px;">💭</div>
                                <div style="color: #fff; font-weight: bold; margin-bottom: 10px; font-size: 16px;">Conceptual</div>
                                <div style="color: #ffd700; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${tikkunSparks.conceptual || 0}</div>
                            </div>
                        </div>
                        <div style="background: rgba(255, 215, 0, 0.15); padding: 20px; border-radius: 12px; border: 2px solid #ffd700; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%); animation: pulse 3s infinite 1s;"></div>
                            <div style="position: relative; z-index: 1;">
                                <div style="color: #ffd700; font-size: 24px; margin-bottom: 10px;">❤️</div>
                                <div style="color: #fff; font-weight: bold; margin-bottom: 10px; font-size: 16px;">Emotional</div>
                                <div style="color: #ffd700; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${tikkunSparks.emotional || 0}</div>
                            </div>
                        </div>
                        <div style="background: rgba(255, 215, 0, 0.15); padding: 20px; border-radius: 12px; border: 2px solid #ffd700; position: relative; overflow: hidden;">
                            <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,215,0,0.1) 0%, transparent 70%); animation: pulse 3s infinite 2s;"></div>
                            <div style="position: relative; z-index: 1;">
                                <div style="color: #ffd700; font-size: 24px; margin-bottom: 10px;">⚡</div>
                                <div style="color: #fff; font-weight: bold; margin-bottom: 10px; font-size: 16px;">Physical</div>
                                <div style="color: #ffd700; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">${tikkunSparks.physical || 0}</div>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #ffd700; font-size: 18px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">
                        ⭐ Total Sparks: ${totalSparks} ⭐
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%); padding: 20px; border-radius: 12px; border: 2px solid #9c27b0; margin: 20px 0; box-shadow: 0 4px 15px rgba(156, 39, 176, 0.2);">
                    <h3 style="margin: 0 0 15px 0; color: #7b1fa2; font-size: 18px;">
                        <i class="fas fa-sword" style="margin-right: 8px;"></i>Raid Experience
                    </h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <span style="color: #4a148c; font-weight: bold;">Raids Participated:</span>
                            <span style="font-size: 20px; color: #7b1fa2; font-weight: bold; margin-left: 10px;">${raidExperience}</span>
                        </div>
                        <div>
                            <span style="color: #4a148c; font-weight: bold;">Status:</span>
                            <span style="color: ${raidExperience > 0 ? '#2e7d32' : '#d84315'}; font-weight: bold; margin-left: 10px;">
                                ${raidExperience > 0 ? 'Veteran Raider' : 'Recruit'}
                            </span>
                        </div>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%); padding: 20px; border-radius: 12px; border: 2px solid #4caf50; text-align: center; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.2);">
                    <h3 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 20px;">
                        <i class="fas fa-check-circle" style="margin-right: 8px;"></i>System Integration Status
                    </h3>
                    <div style="color: #1b5e20; font-weight: bold; font-size: 18px; margin-bottom: 10px;">
                        ✅ ALL BBTTCC SYSTEMS ONLINE ✅
                    </div>
                    <div style="font-size: 14px; color: #424242; font-style: italic;">
                        Territory • Tikkun • Radiation • Raid • Character Options
                    </div>
                    <div style="margin-top: 15px; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border: 1px solid #4caf50;">
                        <div style="font-size: 16px; color: #1b5e20; font-weight: bold;">
                            🎯 Character sheet successfully enhanced with BBTTCC Strategic Warfare Suite
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // Function to add BBTTCC tab to a sheet
    function addBBTTCCTabToSheet(sheet) {
        console.log(`🛠️ Adding BBTTCC tab to ${sheet.actor?.name || 'Unknown'} character sheet...`);

        const html = getSheetHTML(sheet);
        if (!html) {
            console.log("❌ Could not get HTML element");
            return false;
        }

        console.log("✅ Got HTML element successfully");

        // Remove any existing BBTTCC tabs
        html.find('a[data-tab*="bbttcc"], a[data-tab*="great-work"], a[data-tab*="ultimate"]').remove();
        html.find('.tab[data-tab*="bbttcc"], .tab[data-tab*="great-work"], .tab[data-tab*="ultimate"]').remove();

        // Find tab container using correct D&D 5e structure
        const tabSelectors = [
            'nav.tabs[data-group="primary"]',
            '.tabs[data-group="primary"]',
            'nav.tabs',
            '.tabs'
        ];

        let tabs = null;
        for (const selector of tabSelectors) {
            tabs = html.find(selector);
            if (tabs.length > 0) {
                console.log(`✅ Found tab container with selector: ${selector}`);
                break;
            }
        }

        if (!tabs || tabs.length === 0) {
            console.log("❌ No tab container found with any selector");
            console.log("🔍 Available navigation elements:");
            html.find('nav, .tabs, .sheet-tabs').each((i, el) => {
                console.log(`  ${i + 1}: <${el.tagName.toLowerCase()} class="${el.className}" data-group="${$(el).attr('data-group')}">`);
            });
            return false;
        }

        console.log("✅ Found tab container");

        // Add BBTTCC tab navigation using correct D&D 5e structure
        const tabNavHtml = `<a class="item control"
           data-action="tab"
           data-group="primary"
           data-tab="bbttcc-ultimate"
           data-tooltip
           aria-label="BBTTCC Profile"
           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin: 2px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            <i class="fas fa-star" style="color: #ffd700; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);" inert></i>
        </a>`;
        tabs.append(tabNavHtml);

        // Create and add tab content
        const contentHtml = createBBTTCCTabContent(sheet.actor);

        // Add to sheet body using D&D 5e structure
        const contentSelectors = [
            '.sheet-body',
            '.content',
            '.tab-content',
            '.window-content section'
        ];

        let contentArea = null;
        for (const selector of contentSelectors) {
            contentArea = html.find(selector);
            if (contentArea.length > 0) {
                console.log(`✅ Found content area with selector: ${selector}`);
                break;
            }
        }

        if (!contentArea || contentArea.length === 0) {
            console.log("❌ No content area found");
            return false;
        }

        // Add tab content after existing tabs or at end of content area
        const existingTabs = contentArea.find('.tab');
        if (existingTabs.length > 0) {
            existingTabs.last().after(contentHtml);
            console.log("✅ Added tab content after existing tabs");
        } else {
            contentArea.append(contentHtml);
            console.log("✅ Added tab content to content area");
        }

        // Add click handler with Foundry's tab system integration
        html.find('a[data-tab="bbttcc-ultimate"]').on('click', function(event) {
            console.log(`🖱️ BBTTCC Ultimate tab clicked for ${sheet.actor?.name}`);

            // Let Foundry handle the tab switching
            if (!sheet.isDOMSheet && sheet._tabs && sheet._tabs[0]) {
                sheet._tabs[0].activate("bbttcc-ultimate");
            } else {
                // Manual tab switching for DOM sheets
                html.find('.sheet-body .tab').removeClass('active');
                html.find('.sheet-tabs a.item').removeClass('active');
                html.find('.tab[data-tab="bbttcc-ultimate"]').addClass('active');
                html.find('a[data-tab="bbttcc-ultimate"]').addClass('active');
            }
        });

        console.log(`🎉 BBTTCC Ultimate tab added successfully to ${sheet.actor?.name}!`);
        return true;
    }

    // Function to register BBTTCC character sheet integration hook
    function registerBBTTCCSheetHook() {
        console.log("🪝 Registering BBTTCC character sheet integration hook...");

        // Remove any existing hooks to avoid duplicates
        if (window.bbttccCharacterSheetHookId) {
            Hooks.off("renderActorSheet", window.bbttccCharacterSheetHookId);
            console.log("🧹 Removed existing BBTTCC character sheet hook");
        }

        // Register new hook for BBTTCC character sheets
        window.bbttccCharacterSheetHookId = Hooks.on("renderActorSheet", (app, html, data) => {
            if (app.actor?.type === 'character') {
                console.log(`🪝 BBTTCC character sheet hook triggered for ${app.actor.name}`);

                // Check if this character has BBTTCC data
                const hasBBTTCCData =
                    app.actor.getFlag("bbttcc-territory", "bbttccCharacter") ||
                    app.actor.getFlag("bbttcc-territory", "bbttccEnhancements") ||
                    app.actor.getFlag("bbttcc-tikkun", "sparks") ||
                    app.actor.getFlag("bbttcc-radiation", "level") ||
                    app.actor.getFlag("bbttcc-raid", "participated");

                if (hasBBTTCCData) {
                    console.log(`✅ ${app.actor.name} has BBTTCC data, adding tab...`);

                    // Add delay to ensure sheet is fully rendered
                    setTimeout(() => {
                        try {
                            // Use the integrated BBTTCC tab system
                            const success = addBBTTCCTabToSheet(app);
                            if (success) {
                                console.log(`🎯 BBTTCC tab added to ${app.actor.name}`);
                            } else {
                                console.warn(`❌ Failed to add BBTTCC tab to ${app.actor.name}`);
                            }
                        } catch (error) {
                            console.error(`❌ Error adding BBTTCC tab to ${app.actor.name}:`, error);
                        }
                    }, 300); // Increased delay for better reliability
                } else {
                    console.log(`⏭️ ${app.actor.name} has no BBTTCC data, skipping tab addition`);
                }
            }
        });

        console.log(`✅ BBTTCC character sheet hook registered with ID: ${window.bbttccCharacterSheetHookId}`);
        ui.notifications.info("🪝 BBTTCC character sheet integration is now active!");

        // Expose globally for compatibility with existing systems
        window.addBBTTCCTabToSheet = addBBTTCCTabToSheet;
        window.createBBTTCCTabContent = createBBTTCCTabContent;
        window.findCharacterSheet = findCharacterSheet;
        window.safeGetText = safeGetText;

        console.log("🌍 BBTTCC tab functions exposed globally for compatibility");
    }

    // Function to add CSS animations for BBTTCC tabs
    function addBBTTCCTabCSS() {
        // Check if CSS already exists
        if (document.getElementById('bbttcc-tab-css')) {
            return;
        }

        console.log("🎨 Adding BBTTCC tab CSS animations...");

        const style = document.createElement('style');
        style.id = 'bbttcc-tab-css';
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 0.3; transform: scale(1); }
                50% { opacity: 0.8; transform: scale(1.1); }
                100% { opacity: 0.3; transform: scale(1); }
            }

            /* BBTTCC Tab specific styling */
            .bbttcc-ultimate-content {
                font-family: 'Roboto', 'Segoe UI', sans-serif;
            }

            /* Make sure BBTTCC tab icon is visible */
            a[data-tab="bbttcc-ultimate"] i.fas.fa-star {
                color: #ffd700 !important;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            }

            /* Active state for BBTTCC tab */
            a[data-tab="bbttcc-ultimate"].active {
                background: linear-gradient(135deg, #764ba2 0%, #667eea 100%) !important;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4) !important;
            }

            /* Ensure content visibility */
            .tab[data-tab="bbttcc-ultimate"] {
                display: none;
            }

            .tab[data-tab="bbttcc-ultimate"].active {
                display: block;
            }
        `;
        document.head.appendChild(style);

        console.log("✅ BBTTCC tab CSS added successfully");
    }

    // Function to auto-add tabs to existing BBTTCC characters on startup
    function autoAddTabsToExistingCharacters() {
        console.log("🚀 Auto-adding BBTTCC tabs to existing characters...");

        let addedCount = 0;
        const bbttccCharacters = game.actors.filter(actor => {
            if (actor.type !== 'character') return false;

            // Check if character has BBTTCC data
            return actor.getFlag("bbttcc-territory", "bbttccCharacter") ||
                   actor.getFlag("bbttcc-territory", "bbttccEnhancements") ||
                   actor.getFlag("bbttcc-tikkun", "sparks") ||
                   actor.getFlag("bbttcc-radiation", "level") ||
                   actor.getFlag("bbttcc-raid", "participated");
        });

        console.log(`🔍 Found ${bbttccCharacters.length} BBTTCC characters to process`);

        bbttccCharacters.forEach(actor => {
            // Check if character sheet is currently open
            const sheet = findCharacterSheet(actor);
            if (sheet) {
                console.log(`📋 Adding tab to open sheet for ${actor.name}`);
                const success = addBBTTCCTabToSheet(sheet);
                if (success) {
                    addedCount++;
                }
            }
        });

        if (addedCount > 0) {
            ui.notifications.info(`🎯 Added BBTTCC tabs to ${addedCount} open character sheets`);
            console.log(`✅ Auto-added BBTTCC tabs to ${addedCount} characters`);
        } else {
            console.log("ℹ️ No open character sheets to add tabs to - tabs will be added when sheets are opened");
        }
    }

    // Territory System Functions - Using your existing working system with hex grid support

    // Territory data constants from your working system
    const TERRITORY_TYPES = {
        settlement: { food: 2, materials: 1, trade: 3, name: "Settlement" },
        fortress: { materials: 3, military: 4, trade: 1, name: "Fortress" },
        mine: { materials: 5, trade: 2, food: 0, name: "Mine" },
        farm: { food: 5, materials: 1, trade: 2, name: "Farm" },
        port: { trade: 4, materials: 2, food: 2, name: "Port" },
        factory: { materials: 4, trade: 3, food: 0, name: "Factory" },
        research: { materials: 1, trade: 1, knowledge: 4, name: "Research Facility" }
    };

    const SIZE_MULTIPLIERS = {
        small: 0.5,
        medium: 1.0,
        large: 2.0,
        capital: 4.0
    };

    const TERRITORY_STATUS = {
        unclaimed: "Unclaimed",
        claimed: "Claimed",
        contested: "Contested",
        occupied: "Occupied"
    };

    // Load Territory Builder system
    async function loadTerritoryBuilder() {
        console.log('🏗️ Loading Territory Builder system...');

        try {
            // Load the bulletproof territory builder
            const response = await fetch('/modules/bbttcc-territory/territory-builder-bulletproof.js');
            const script = await response.text();

            // Execute the script to load TerritoryBuilder
            eval(script);

            console.log('✅ Territory Builder loaded successfully');
            ui.notifications.success('🏗️ Territory Builder loaded! Starting...');

            // Start the territory builder
            if (window.TerritoryBuilder) {
                window.TerritoryBuilder.start();
            } else {
                throw new Error('TerritoryBuilder not found after loading');
            }

        } catch (error) {
            console.error('❌ Error loading Territory Builder:', error);
            ui.notifications.error('Failed to load Territory Builder system');
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
        console.log('🏛️ Territory Dashboard clicked - opening Territory Manager');
        showEnhancedTerritoryManager();
    }

    function showEnhancedTerritoryManager() {
        const territories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};
        const territoryCount = Object.keys(territories).length;
        const gridType = canvas.grid.isHexagonal ? 'Hex Grid' : 'Square Grid';

        const territoryList = Object.values(territories).map(t => {
            const resources = Object.entries(t.resources || {}).map(([type, amount]) => `${type}: ${amount}`).join(', ');
            return `
                <div class="territory-item" style="border: 1px solid #ddd; padding: 12px; margin: 8px 0; border-radius: 6px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-left: 4px solid ${getTerritoryStatusColor(t.status)};">
                    <div style="display: flex; justify-content: between; align-items: start;">
                        <div style="flex-grow: 1;">
                            <h4 style="margin: 0 0 4px 0; color: #495057; font-size: 14px;">
                                <i class="fas fa-chess-board" style="margin-right: 6px; color: ${getTerritoryStatusColor(t.status)};"></i>
                                ${t.name}
                            </h4>
                            <div style="font-size: 12px; color: #6c757d; margin-bottom: 6px;">
                                <strong>Type:</strong> ${TERRITORY_TYPES[t.type]?.name || t.type} |
                                <strong>Size:</strong> ${t.size} |
                                <strong>Status:</strong> ${t.status}
                            </div>
                            ${t.claimedBy ? `<div style="font-size: 11px; color: #6c757d;"><strong>Claimed by:</strong> ${t.claimedBy}</div>` : ''}
                            <div style="font-size: 11px; color: #28a745; margin-top: 4px;">
                                <strong>Resources:</strong> ${resources || 'None'}
                            </div>
                        </div>
                        <div style="text-align: right; font-size: 10px; color: #6c757d;">
                            Grid: ${t.x}, ${t.y}<br>
                            ${t.boundaries?.gridType || 'Unknown Grid'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const dialog = new Dialog({
            title: "🏰 BBTTCC Territory Manager",
            content: `
                <div style="padding: 20px; font-family: 'Segoe UI', sans-serif;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                            <i class="fas fa-shield-alt"></i>
                            BBTTCC Territory Management System
                        </h2>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 12px;">
                            ${territoryCount} territories tracked | Current scene: ${canvas.scene?.name || 'Unknown'} | ${gridType}
                        </p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <button id="activate-claim-mode" style="padding: 12px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="fas fa-flag"></i>
                            Enter Claim Mode
                        </button>
                        <button id="refresh-territories" style="padding: 12px; background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
                            <i class="fas fa-sync"></i>
                            Refresh View
                        </button>
                    </div>

                    <h3 style="color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 8px; margin: 0 0 15px 0;">
                        Current Territories (${territoryCount})
                    </h3>

                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 6px; background: #f8f9fa; padding: 10px;">
                        ${territoryList || `
                            <div style="text-align: center; padding: 40px; color: #6c757d;">
                                <i class="fas fa-map" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                                <h4 style="margin: 0; font-size: 16px;">No territories claimed yet</h4>
                                <p style="margin: 8px 0 0 0; font-size: 14px;">Use <strong>Claim Mode</strong> to start claiming territories on your ${gridType.toLowerCase()}.</p>
                            </div>
                        `}
                    </div>

                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 10px; margin-top: 15px; font-size: 12px; color: #6c757d;">
                        <strong><i class="fas fa-info-circle"></i> Territory System Features:</strong><br>
                        • Full hex and square grid compatibility<br>
                        • Resource generation based on territory type and size<br>
                        • Left-click to claim, right-click to contest territories<br>
                        • Automatic faction territory integration
                    </div>
                </div>
            `,
            buttons: {
                close: {
                    label: '<i class="fas fa-times"></i> Close',
                    callback: () => {}
                }
            },
            render: (html) => {
                html.find('#activate-claim-mode').click(() => {
                    dialog.close();
                    activateClaimMode();
                });
                html.find('#refresh-territories').click(() => {
                    dialog.close();
                    showEnhancedTerritoryManager();
                });
            }
        });
        dialog.render(true);
    }

    function getTerritoryStatusColor(status) {
        const colors = {
            unclaimed: "#6c757d",
            claimed: "#28a745",
            contested: "#ffc107",
            occupied: "#dc3545"
        };
        return colors[status] || colors.unclaimed;
    }

    function activateClaimMode() {
        console.log("🚩 Activating enhanced claim territory mode with hex grid support...");

        // Remove existing event listeners
        canvas.stage.off('click.bbttccClaim');
        canvas.stage.off('contextmenu.bbttccClaim');

        // Add enhanced hex-compatible event listeners
        canvas.stage.on('click.bbttccClaim', (event) => {
            const position = event.data.getLocalPosition(canvas.stage);
            const gridPos = getGridPosition(position.x, position.y);
            console.log(`🚩 Left click - Claim territory at grid position:`, gridPos);
            claimTerritory(gridPos.x, gridPos.y, 'claim');
        });

        canvas.stage.on('contextmenu.bbttccClaim', (event) => {
            event.preventDefault();
            const position = event.data.getLocalPosition(canvas.stage);
            const gridPos = getGridPosition(position.x, position.y);
            console.log(`🚩 Right click - Contest territory at grid position:`, gridPos);
            claimTerritory(gridPos.x, gridPos.y, 'contest');
        });

        ui.notifications.info(`🚩 Territory Claim Mode Active! Works with ${canvas.grid.isHexagonal ? 'hex' : 'square'} grids. Left-click to claim, right-click to contest.`);
    }

    function getGridPosition(x, y) {
        // Enhanced grid position calculation that works with both hex and square grids
        if (canvas.grid.isHexagonal) {
            // For hex grids, use Foundry's built-in hex coordinate conversion
            const coords = canvas.grid.getOffset({x, y});
            return { x: coords.i, y: coords.j };
        } else {
            // For square grids, use traditional grid positioning
            const gridPos = canvas.grid.getTopLeft(x, y);
            return { x: gridPos[0], y: gridPos[1] };
        }
    }

    function claimTerritory(x, y, action = 'claim') {
        const territoryId = `territory_${x}_${y}`;
        console.log(`🚩 ${action} territory at grid position:`, x, y, `Grid type: ${canvas.grid.isHexagonal ? 'hex' : 'square'}`);

        // Check for existing territory
        const existingTerritories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};
        const existing = existingTerritories[territoryId];

        if (existing) {
            ui.notifications.warn(`Territory already exists at this location: ${existing.name}`);
            return;
        }

        const territoryName = `Territory at ${x},${y}`;

        // Enhanced territory creation dialog
        const dialog = new Dialog({
            title: action === 'claim' ? '🚩 Claim Territory' : '⚔️ Contest Territory',
            content: `
                <div style="padding: 15px; font-family: 'Segoe UI', sans-serif;">
                    <div style="background: linear-gradient(135deg, ${action === 'claim' ? '#28a745' : '#dc3545'} 0%, ${action === 'claim' ? '#20c997' : '#c82333'} 100%); color: white; padding: 12px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-${action === 'claim' ? 'flag' : 'sword'}"></i>
                            ${action === 'claim' ? 'Claim' : 'Contest'} Territory
                        </h3>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 13px;">
                            Grid Position: ${x}, ${y} | ${canvas.grid.isHexagonal ? 'Hex Grid' : 'Square Grid'} | Scene: ${canvas.scene?.name}
                        </p>
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: #495057;">Territory Name:</label>
                        <input type="text" id="territory-name" value="${territoryName}" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                    </div>

                    <div style="margin-bottom: 12px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: #495057;">Territory Type:</label>
                        <select id="territory-type" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                            ${Object.entries(TERRITORY_TYPES).map(([key, type]) => {
                                const resources = Object.entries(type).filter(([k, v]) => k !== 'name' && typeof v === 'number').map(([k, v]) => `${k}: ${v}`).join(', ');
                                return `<option value="${key}">${type.name} (${resources})</option>`;
                            }).join('')}
                        </select>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: bold; color: #495057;">Territory Size:</label>
                        <select id="territory-size" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                            <option value="small">Small (0.5x resources)</option>
                            <option value="medium" selected>Medium (1.0x resources)</option>
                            <option value="large">Large (2.0x resources)</option>
                            <option value="capital">Capital (4.0x resources)</option>
                        </select>
                    </div>

                    <div style="background: #e9ecef; border: 1px solid #ced4da; border-radius: 4px; padding: 12px; font-size: 12px; color: #495057;">
                        <strong><i class="fas fa-info-circle"></i> Territory System:</strong><br>
                        This territory will be positioned correctly on your ${canvas.grid.isHexagonal ? 'hex' : 'square'} grid and will generate resources based on type and size.
                        ${action === 'contest' ? '<br><br><strong style="color: #dc3545;">Contesting:</strong> This will mark the territory as contested, allowing for faction warfare.' : ''}
                    </div>
                </div>
            `,
            buttons: {
                confirm: {
                    label: `<i class="fas fa-check"></i> ${action === 'claim' ? 'Claim' : 'Contest'} Territory`,
                    callback: (html) => {
                        const name = html.find('#territory-name').val();
                        const type = html.find('#territory-type').val();
                        const size = html.find('#territory-size').val();
                        processTerritoryClaim(territoryId, name, type, size, x, y, action);
                    }
                },
                cancel: {
                    label: '<i class="fas fa-times"></i> Cancel'
                }
            },
            default: 'confirm'
        });
        dialog.render(true);
    }

    function processTerritoryClaim(territoryId, name, type, size, x, y, action) {
        try {
            console.log(`Processing territory ${action} for:`, { territoryId, name, type, size, x, y, action });

            // Calculate resources using your working system
            const resources = calculateTerritoryResources(type, size);

            // Store territory data using your working system's structure
            const territories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};
            territories[territoryId] = {
                id: territoryId,
                name: name,
                type: type,
                size: size,
                status: action === 'claim' ? 'claimed' : 'contested',
                x: x,
                y: y,
                claimedBy: game.user.name,
                claimedAt: new Date().toISOString(),
                resources: resources,
                boundaries: {
                    x: x,
                    y: y,
                    gridType: canvas.grid.isHexagonal ? 'hex' : 'square'
                },
                description: `${TERRITORY_TYPES[type]?.name} territory at grid position ${x},${y}`,
                lastUpdated: new Date().toISOString(),
                createdBy: game.user.id
            };

            // Save to scene flags
            canvas.scene?.setFlag('bbttcc-territory', 'territories', territories);

            // Success notification with resource details
            const resourceString = Object.entries(resources).map(([type, amount]) => `${type}: ${amount}`).join(', ');
            ui.notifications.success(`🏰 Territory "${name}" ${action}ed! Resources: ${resourceString}`);

            console.log(`✅ Territory ${action}ed successfully:`, territories[territoryId]);

            // Deactivate claim mode
            canvas.stage.off('click.bbttccClaim');
            canvas.stage.off('contextmenu.bbttccClaim');
            ui.notifications.info("Territory claim mode deactivated. Use Territory Manager to manage more territories.");

        } catch (error) {
            console.error(`Error processing territory ${action}:`, error);
            ui.notifications.error(`Failed to ${action} territory: ${error.message}`);
        }
    }

    function calculateTerritoryResources(territoryType, territorySize = 'medium') {
        try {
            const typeData = TERRITORY_TYPES[territoryType];
            if (!typeData) {
                console.warn(`Invalid territory type: ${territoryType}, using settlement as default`);
                return TERRITORY_TYPES.settlement;
            }

            const sizeMultiplier = SIZE_MULTIPLIERS[territorySize] || 1.0;
            const resources = {};

            // Calculate resources with size multipliers
            for (const [resource, baseAmount] of Object.entries(typeData)) {
                if (resource !== 'name' && typeof baseAmount === 'number') {
                    resources[resource] = Math.floor(baseAmount * sizeMultiplier);
                }
            }

            console.log(`Calculated resources for ${territoryType} (${territorySize}):`, resources);
            return resources;

        } catch (error) {
            console.error('Error calculating territory resources:', error);
            return { materials: 1, food: 1, trade: 1 }; // Fallback
        }
    }

    // Set up persistence monitoring
    function setupPersistence() {
        // Monitor and re-add buttons if they disappear
        setInterval(() => {
            const charBtn = document.querySelector('.persistent-bbttcc-btn');
            if (!charBtn && game?.ready) {
                console.log('🔧 Re-adding missing buttons...');
                addPersistentButtons();
            }
        }, 5000);

        console.log("✅ BBTTCC Territory: Persistence monitoring active");
    }

    // Left click function - Opens faction management interface
    function openFactionManagementInterface() {
        console.log('🏛️ Opening faction management interface...');

        try {
            // Try multiple ways to access the working faction management
            if (window.BBTTCCGUI && window.BBTTCCGUI.BBTTCCWorkingDashboard) {
                console.log('✅ Using BBTTCCWorkingDashboard');
                new window.BBTTCCGUI.BBTTCCWorkingDashboard().render(true);
            } else if (window.BBTTCC_Territory && window.BBTTCC_Territory.openDashboard) {
                console.log('✅ Using BBTTCC_Territory.openDashboard');
                window.BBTTCC_Territory.openDashboard();
            } else if (window.openTerritoryManagerModern) {
                console.log('✅ Using openTerritoryManagerModern');
                window.openTerritoryManagerModern();
            } else {
                // Fallback to territory manager
                console.log('⚠️ Using territory manager fallback');
                openTerritoryManager();
            }

            ui.notifications.success('🏛️ Faction Management Interface opened');

        } catch (error) {
            console.error('❌ Error opening faction management:', error);
            ui.notifications.error(`Failed to open interface: ${error.message}`);
        }
    }

    // Right click function - Toggles claim system with hex overlay
    let claimModeActive = false;

    function toggleClaimSystemWithHexOverlay() {
        console.log('🎯 Toggling claim system with hex overlay...');

        try {
            if (claimModeActive) {
                deactivateClaimMode();
            } else {
                activateClaimModeWithHexOverlay();
            }
        } catch (error) {
            console.error('❌ Error toggling claim system:', error);
            ui.notifications.error(`Failed to toggle claim system: ${error.message}`);
        }
    }

    function activateClaimModeWithHexOverlay() {
        if (!canvas || !canvas.stage) {
            ui.notifications.error('Canvas not ready for territory claiming');
            return;
        }

        console.log('🎯 Activating claim mode with hex overlay...');

        // DON'T use existing function to avoid recursive loop - use manual setup instead
        console.log('🎯 Setting up hex overlay claim mode directly...');

        // Manual setup for hex grid overlay
        console.log('🎯 Setting up manual hex overlay claim mode...');

        // Clear existing handlers (use working event names)
        canvas.stage.removeAllListeners('click.bbttccClaim');
        canvas.stage.removeAllListeners('rightclick.bbttccClaim');
        canvas.stage.removeAllListeners('contextmenu.bbttccClaim');

        // Add visual feedback
        canvas.app.stage.cursor = 'crosshair';

        // Create hex overlay indication
        ui.notifications.info('🎯 Hex Grid Claim Mode: Left-click to claim, Right-click to contest');

        // Left click for claiming (using working event handler)
        canvas.stage.on('click.bbttccClaim', (event) => {
            try {
                console.log('🎯 CANVAS LEFT-CLICK DETECTED - CLAIMING TERRITORY');

                // Get the position
                const position = event.data.getLocalPosition(canvas.stage);
                console.log('Raw position:', position);

                // Convert to grid coordinates (hex-compatible)
                let gridX, gridY;

                if (canvas.grid.isHexagonal) {
                    const coords = canvas.grid.getOffset({x: position.x, y: position.y});
                    gridX = coords.i;
                    gridY = coords.j;
                    console.log('HEX grid coordinates:', gridX, gridY);
                } else {
                    const gridPos = canvas.grid.getTopLeft(position.x, position.y);
                    gridX = gridPos[0];
                    gridY = gridPos[1];
                    console.log('SQUARE grid coordinates:', gridX, gridY);
                }

                // Use the working territory claim function
                claimTerritoryWorking(gridX, gridY, 'claim');

            } catch (error) {
                console.error('Error handling canvas left click:', error);
                ui.notifications.error('Territory claiming failed - check console');
            }
        });

        // Right click for contesting/hex toggle (using working event handler)
        canvas.stage.on('rightclick.bbttccClaim', (event) => {
            try {
                console.log('🎯 CANVAS RIGHT-CLICK DETECTED - CONTEST/HEX TOGGLE');
                event.preventDefault();

                const position = event.data.getLocalPosition(canvas.stage);

                // Convert to grid coordinates
                let gridX, gridY;

                if (canvas.grid.isHexagonal) {
                    const coords = canvas.grid.getOffset({x: position.x, y: position.y});
                    gridX = coords.i;
                    gridY = coords.j;
                    console.log('HEX grid coordinates for contest:', gridX, gridY);

                    // Toggle hex grid visualization
                    toggleHexGridVisualization();
                } else {
                    const gridPos = canvas.grid.getTopLeft(position.x, position.y);
                    gridX = gridPos[0];
                    gridY = gridPos[1];
                    console.log('SQUARE grid coordinates for contest:', gridX, gridY);
                }

                // Also trigger contest mode
                claimTerritoryWorking(gridX, gridY, 'contest');

            } catch (error) {
                console.error('Error handling canvas right click:', error);
            }
        });

        claimModeActive = true;
        ui.notifications.success('🎯 Territory Claim Mode activated with hex overlay');

        // Auto-deactivate after 2 minutes for safety
        setTimeout(() => {
            if (claimModeActive) {
                deactivateClaimMode();
                ui.notifications.info('🎯 Claim mode auto-deactivated after 2 minutes');
            }
        }, 120000);
    }

    function deactivateClaimMode() {
        console.log('🎯 Deactivating claim mode...');

        // Clear canvas handlers (use working event names)
        if (canvas && canvas.stage) {
            canvas.stage.removeAllListeners('click.bbttccClaim');
            canvas.stage.removeAllListeners('rightclick.bbttccClaim');
            canvas.stage.removeAllListeners('contextmenu.bbttccClaim');
            canvas.app.stage.cursor = 'default';
        }

        claimModeActive = false;
        ui.notifications.success('🎯 Territory Claim Mode deactivated');
    }

    // Working territory claim function (based on your original working system)
    function claimTerritoryWorking(x, y, action = 'claim') {
        const territoryId = `territory_${x}_${y}`;
        console.log(`🚩 ${action.toUpperCase()} territory at grid position:`, x, y);

        // Check if territory already exists
        const existingTerritories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};
        const existing = existingTerritories[territoryId];

        if (existing) {
            ui.notifications.warn(`Territory "${existing.name}" already exists at grid ${x},${y}`);

            // Show existing territory info
            new Dialog({
                title: "Existing Territory",
                content: `
                    <div style="padding: 15px;">
                        <h3>${existing.name}</h3>
                        <p><strong>Type:</strong> ${existing.type}</p>
                        <p><strong>Status:</strong> ${existing.status}</p>
                        <p><strong>Resources:</strong> ${JSON.stringify(existing.resources || {})}</p>
                        <p><strong>Grid:</strong> ${x}, ${y}</p>
                    </div>
                `,
                buttons: {
                    ok: { label: "OK" }
                }
            }).render(true);
            return;
        }

        // Create new territory using existing system's approach
        const territoryName = `${action === 'claim' ? 'Claimed' : 'Contested'} Territory (${x},${y})`;

        // Quick territory creation (matching existing data structure)
        const newTerritory = {
            id: territoryId,
            name: territoryName,
            type: 'settlement', // Default type
            size: 'medium',     // Default size
            status: action === 'claim' ? 'claimed' : 'contested',
            claimedBy: game.user.name,
            claimedAt: new Date().toISOString(),
            boundaries: {
                x: x,
                y: y,
                gridType: canvas.grid.isHexagonal ? 'hex' : 'square'
            },
            resources: {
                food: 2,
                materials: 1,
                trade: 3
            },
            description: `${action} at grid ${x},${y}`,
            lastUpdated: new Date().toISOString(),
            createdBy: game.user.id
        };

        // Save territory
        const updatedTerritories = { ...existingTerritories, [territoryId]: newTerritory };
        canvas.scene.setFlag('bbttcc-territory', 'territories', updatedTerritories);

        // Success feedback
        const resourceString = Object.entries(newTerritory.resources).map(([type, amount]) => `${type}: ${amount}`).join(', ');
        ui.notifications.success(`🏰 Territory "${newTerritory.name}" ${action}ed! Resources: ${resourceString}`);

        console.log(`✅ Territory ${action}ed successfully:`, newTerritory);
    }

    // Hex grid visualization toggle (recreating original functionality)
    function toggleHexGridVisualization() {
        if (!canvas.grid.isHexagonal) {
            ui.notifications.info("Hex grid toggle only works on hex grids");
            return;
        }

        console.log("🔄 Toggling hex grid visualization...");

        // Toggle grid visibility
        const currentAlpha = canvas.grid.alpha;
        const newAlpha = currentAlpha === 0 ? 0.3 : 0;

        canvas.grid.alpha = newAlpha;
        canvas.grid.draw();

        ui.notifications.info(`🔄 Hex grid ${newAlpha > 0 ? 'shown' : 'hidden'}`);
        console.log(`Hex grid alpha changed from ${currentAlpha} to ${newAlpha}`);
    }

    function claimTerritoryAtPosition(position, action) {
        console.log(`🎯 ${action} territory at position:`, position);

        try {
            // Get hex coordinates (since user confirmed this is a hex map)
            let gridCoords;
            if (canvas.grid.isHexagonal) {
                gridCoords = canvas.grid.getOffset({x: position.x, y: position.y});
                console.log(`🎯 Hex coordinates: ${gridCoords.i}, ${gridCoords.j}`);
            } else {
                // Fallback for square grid
                const gridPos = canvas.grid.getTopLeft(position.x, position.y);
                gridCoords = { i: gridPos[0], j: gridPos[1] };
                console.log(`🎯 Square coordinates: ${gridCoords.i}, ${gridCoords.j}`);
            }

            const territoryId = `territory_${gridCoords.i}_${gridCoords.j}`;

            // Try to use existing territory claiming function
            const territoryModule = game.modules.get('bbttcc-territory');
            if (territoryModule && territoryModule.api && territoryModule.api.claimTerritory) {
                const territoryData = {
                    name: `${action === 'claim' ? 'Claimed' : 'Contested'} Territory (${gridCoords.i},${gridCoords.j})`,
                    type: 'settlement',
                    size: 'medium',
                    boundaries: {
                        x: gridCoords.i,
                        y: gridCoords.j,
                        gridType: canvas.grid.isHexagonal ? 'hex' : 'square'
                    }
                };

                territoryModule.api.claimTerritory(territoryData);
                console.log('✅ Used module API for territory claim');
            } else {
                // Use existing claimTerritory function from this module
                claimTerritory(gridCoords.i, gridCoords.j, action);
            }

            ui.notifications.success(`🎯 Territory ${action}ed at ${gridCoords.i}, ${gridCoords.j}!`);

        } catch (error) {
            console.error(`❌ Error claiming territory:`, error);
            ui.notifications.error(`Failed to ${action} territory: ${error.message}`);
        }
    }

    // Backward compatibility function for existing scripts
    window.fixZaraBBTTCCTab = function() {
        console.log("🔧 fixZaraBBTTCCTab() called - using integrated BBTTCC system");

        // Find Zara or any BBTTCC character
        const zara = game.actors.getName("Zara the Seeker") ||
                    game.actors.find(a => a.type === 'character' &&
                                        (a.getFlag("bbttcc-territory", "bbttccCharacter") ||
                                         a.getFlag("bbttcc-tikkun", "sparks")));

        if (!zara) {
            ui.notifications.warn("No BBTTCC character found to apply tab fix to");
            return false;
        }

        const sheet = findCharacterSheet(zara);
        if (!sheet) {
            ui.notifications.warn(`Please open ${zara.name}'s character sheet and try again`);
            return false;
        }

        const success = addBBTTCCTabToSheet(sheet);
        if (success) {
            ui.notifications.success(`✅ BBTTCC tab added to ${zara.name}!`);
            return true;
        } else {
            ui.notifications.error("Failed to add BBTTCC tab");
            return false;
        }
    };

    // Global utilities
    window.BBTTCC_Territory = {
        refreshButtons: addPersistentButtons,
        initializeSystem: initializeCompleteSystem,
        openCharacterCreation: () => {
            initializeCompleteSystem();
            if (window.BBTTCCGUI?.PerfectCharacterCreation) {
                new window.BBTTCCGUI.PerfectCharacterCreation().render(true);
            }
        },
        openDashboard: () => {
            initializeCompleteSystem();
            if (window.BBTTCCGUI?.BBTTCCWorkingDashboard) {
                new window.BBTTCCGUI.BBTTCCWorkingDashboard().render(true);
            }
        },
        openTerritoryManager: openTerritoryManager,
        activateClaimMode: activateClaimModeWithHexOverlay,
        deactivateClaimMode: deactivateClaimMode,
        claimTerritory: claimTerritory,
        claimTerritoryWorking: claimTerritoryWorking,
        toggleHexGridVisualization: toggleHexGridVisualization,
        openFactionManagement: openFactionManagementInterface,
        toggleClaimMode: toggleClaimSystemWithHexOverlay,
        isClaimModeActive: () => claimModeActive,
        status: () => {
            const sceneControl = !!document.querySelector('[data-control="bbttcc-territory-v13"]');
            const charBtn = !!document.querySelector('.persistent-bbttcc-btn');
            const factionBtn = !!document.querySelector('.persistent-faction-btn');
            const dashBtn = !!document.querySelector('.persistent-dashboard-btn');
            const systemLoaded = !!(window.BBTTCCGUI?.PerfectCharacterCreation && window.BBTTCCGUI?.BBTTCCWorkingDashboard);

            console.log('🔍 BBTTCC Territory Status:');
            console.log(`Scene Control: ${sceneControl ? '✅' : '❌'}`);
            console.log(`Character Button: ${charBtn ? '✅' : '❌'}`);
            console.log(`Faction Button: ${factionBtn ? '✅' : '❌'}`);
            console.log(`Dashboard Button: ${dashBtn ? '✅' : '❌'}`);
            console.log(`Complete System: ${systemLoaded ? '✅' : '❌'}`);

            return {
                sceneControl,
                character: charBtn,
                faction: factionBtn,
                dashboard: dashBtn,
                systemLoaded
            };
        }
    };
}

console.log('🎯 BBTTCC Territory: ES Module ready!');