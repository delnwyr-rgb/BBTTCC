/**
 * BBTTCC GUI System - Persistent ApplicationV2 interfaces
 * Integrates with the existing BBTTCC Factions module for persistence
 * Version: 1.0 - Persistent GUI Integration
 */

console.log("🎨 BBTTCC GUI System | Script file starting to load...");
console.log("🎨 BBTTCC GUI System | Loading persistent interface components...");

/**
 * Perfect Character Creation with Tikkun Sparks Guidance
 * This is the working ApplicationV2 system that successfully created Adam
 */
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

    constructor() {
        super();
        this.selectedRace = null;
        this.selectedClass = null;
        this.selectedFaction = null;
        this.expandedCategories = new Set();
        this.selectedItems = new Map();
        this.bbttccItems = this.getBBTTCCItems();
    }

    getBBTTCCItems() {
        const items = [];
        game.packs.forEach(pack => {
            if (pack.metadata.type === 'Item') {
                pack.index.forEach(item => {
                    if (item.name.includes('Archetype:') || 
                        item.name.includes('Crew Type:') || 
                        item.name.includes('Disadvantage:') ||
                        item.name.includes('Background:')) {
                        items.push({
                            ...item,
                            packName: pack.metadata.id,
                            category: this.getItemCategory(item.name)
                        });
                    }
                });
            }
        });
        return items;
    }

    getItemCategory(name) {
        if (name.includes('Archetype:')) return 'Archetypes';
        if (name.includes('Crew Type:')) return 'Crew Types';
        if (name.includes('Disadvantage:')) return 'Disadvantages';
        if (name.includes('Background:')) return 'Backgrounds';
        return 'Other';
    }

    async _renderHTML(context, options) {
        const factions = game.actors.filter(a => a.getFlag("bbttcc-factions", "isFaction"));
        
        const itemsByCategory = {};
        this.bbttccItems.forEach(item => {
            const category = item.category;
            if (!itemsByCategory[category]) itemsByCategory[category] = [];
            itemsByCategory[category].push(item);
        });

        return `
            <div class="bbttcc-character-creation" style="padding: 20px; height: 100%; overflow-y: auto;">
                <div class="creation-sections" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; height: 100%;">
                    
                    <!-- Left Column: Core D&D Setup -->
                    <div class="core-setup" style="display: flex; flex-direction: column; gap: 15px;">
                        <h2 style="color: #6f42c1; margin-bottom: 15px;">🎯 Core Character Setup</h2>
                        
                        <div class="race-selection">
                            <label style="font-weight: bold; color: #6f42c1;">Race:</label>
                            <select id="race-select" data-action="selectRace" style="width: 100%; padding: 8px; margin-top: 5px;">
                                <option value="">Choose a race...</option>
                                ${CONFIG.DND5E.races ? Object.entries(CONFIG.DND5E.races).map(([key, race]) => 
                                    `<option value="${key}" ${this.selectedRace === key ? 'selected' : ''}>${race.label || race}</option>`
                                ).join('') : ''}
                            </select>
                        </div>

                        <div class="class-selection">
                            <label style="font-weight: bold; color: #6f42c1;">Class:</label>
                            <select id="class-select" data-action="selectClass" style="width: 100%; padding: 8px; margin-top: 5px;">
                                <option value="">Choose a class...</option>
                                ${Object.entries(CONFIG.DND5E.classes).map(([key, cls]) => 
                                    `<option value="${key}" ${this.selectedClass === key ? 'selected' : ''}>${cls.label}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="faction-selection">
                            <label style="font-weight: bold; color: #6f42c1;">Faction Affiliation:</label>
                            <select id="faction-select" data-action="selectFaction" style="width: 100%; padding: 8px; margin-top: 5px;">
                                <option value="">Choose a faction...</option>
                                ${factions.map(faction => 
                                    `<option value="${faction.id}" ${this.selectedFaction?.id === faction.id ? 'selected' : ''}>${faction.name}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <!-- Tikkun Sparks Guidance -->
                        <div class="tikkun-guidance" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: white; margin-top: 20px;">
                            <h3 style="margin: 0 0 10px 0;">✨ Tikkun Sparks Guidance</h3>
                            <div id="guidance-text" style="font-style: italic; line-height: 1.4;">
                                ${this.getGuidanceText()}
                            </div>
                        </div>

                        <button data-action="createCharacter" style="
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; 
                            border: none; 
                            padding: 15px 25px; 
                            font-size: 16px; 
                            font-weight: bold; 
                            border-radius: 8px; 
                            cursor: pointer;
                            margin-top: auto;
                        ">🧙 Create BBTTCC Character</button>
                    </div>

                    <!-- Right Column: BBTTCC Options -->
                    <div class="bbttcc-options" style="display: flex; flex-direction: column; gap: 15px;">
                        <h2 style="color: #6f42c1; margin-bottom: 15px;">⚔️ BBTTCC Character Options</h2>
                        
                        ${Object.entries(itemsByCategory).map(([category, items]) => `
                            <div class="category-section" style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                                <div class="category-header" 
                                     data-action="toggleCategory" 
                                     data-category="${category}"
                                     style="
                                        background: #f8f9fa; 
                                        padding: 12px; 
                                        cursor: pointer; 
                                        font-weight: bold; 
                                        border-bottom: 1px solid #ddd;
                                        user-select: none;
                                     ">
                                    ${this.expandedCategories.has(category) ? '▼' : '▶'} ${category} (${items.length})
                                </div>
                                ${this.expandedCategories.has(category) ? `
                                    <div class="category-items" style="max-height: 200px; overflow-y: auto;">
                                        ${items.map(item => `
                                            <div class="item-option" style="padding: 8px 12px; border-bottom: 1px solid #eee;">
                                                <label style="display: flex; align-items: center; cursor: pointer;">
                                                    <input type="checkbox" 
                                                           value="${item._id}" 
                                                           data-pack="${item.packName}"
                                                           ${this.selectedItems.has(item._id) ? 'checked' : ''}
                                                           style="margin-right: 8px;">
                                                    <span style="font-weight: 500;">${item.name}</span>
                                                </label>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    getGuidanceText() {
        if (!this.selectedRace || !this.selectedClass) {
            return "🌟 Welcome to BBTTCC character creation! Select a race and class to receive personalized guidance from the Tikkun Sparks system.";
        }

        const race = CONFIG.DND5E.races[this.selectedRace]?.label || this.selectedRace;
        const cls = CONFIG.DND5E.classes[this.selectedClass]?.label || this.selectedClass;

        const guidances = [
            `✨ As a ${race} ${cls}, you carry unique potential in this post-apocalyptic world. Your racial heritage provides natural advantages that can be enhanced through BBTTCC character options.`,
            `🔮 The Tikkun Sparks recognize your path as a ${cls}. Consider how your class abilities synergize with BBTTCC archetypes and crew roles.`,
            `⚡ Your ${race} nature offers specific strengths. Look for BBTTCC options that complement your racial traits - some combinations unlock hidden potential.`,
            `🌠 The cosmic order suggests exploring archetypes that align with your ${cls} training. Background choices can provide crucial survival skills.`
        ];

        return guidances[Math.floor(Math.random() * guidances.length)];
    }

    _onSelectRace(event) {
        this.selectedRace = event.target.value;
        this.render();
    }

    _onSelectClass(event) {
        this.selectedClass = event.target.value;
        this.render();
    }

    _onSelectFaction(event) {
        this.selectedFaction = event.target.value ? game.actors.get(event.target.value) : null;
        this.render();
    }

    _onToggleCategory(event) {
        const category = event.target.dataset.category;
        if (this.expandedCategories.has(category)) {
            this.expandedCategories.delete(category);
        } else {
            this.expandedCategories.add(category);
        }
        this.render();
    }

    async _onCreateCharacter(event) {
        if (!this.selectedRace || !this.selectedClass) {
            ui.notifications.warn("Please select both race and class!");
            return;
        }

        try {
            // Trigger native D&D5e character creation with our selections
            const actor = await Actor.create({
                name: `New BBTTCC Character`,
                type: "character",
                system: {
                    details: {
                        race: this.selectedRace,
                        class: this.selectedClass
                    }
                }
            });

            // Add selected BBTTCC items
            const selectedItems = Array.from(this.element.querySelectorAll('input[type="checkbox"]:checked'));
            for (const checkbox of selectedItems) {
                const itemId = checkbox.value;
                const packName = checkbox.dataset.pack;
                
                try {
                    const pack = game.packs.get(packName);
                    const item = await pack.getDocument(itemId);
                    if (item) {
                        await actor.createEmbeddedDocuments("Item", [item.toObject()]);
                    }
                } catch (itemError) {
                    console.warn("Failed to add item:", itemId, itemError);
                }
            }

            // Handle faction assignment with OP synchronization
            if (this.selectedFaction) {
                // Set character faction affiliation
                await actor.setFlag("bbttcc-territory", "faction", this.selectedFaction.name);
                await actor.setFlag("bbttcc-territory", "factionId", this.selectedFaction.id);

                // Calculate character OP contributions
                const characterOPs = {
                    violence: 0, nonlethal: 0, intrigue: 0,
                    economy: 0, softpower: 0, diplomacy: 0
                };

                // Calculate OP contributions from BBTTCC items
                for (const item of actor.items) {
                    const description = item.system?.description?.value || '';
                    
                    if (description.includes('Violence OP')) {
                        const match = description.match(/Violence OP[:\s]*([+-]?\d+)/i);
                        if (match) characterOPs.violence += parseInt(match[1]);
                    }
                    if (description.includes('Nonlethal OP')) {
                        const match = description.match(/Nonlethal OP[:\s]*([+-]?\d+)/i);
                        if (match) characterOPs.nonlethal += parseInt(match[1]);
                    }
                    if (description.includes('Intrigue OP')) {
                        const match = description.match(/Intrigue OP[:\s]*([+-]?\d+)/i);
                        if (match) characterOPs.intrigue += parseInt(match[1]);
                    }
                    if (description.includes('Economy OP')) {
                        const match = description.match(/Economy OP[:\s]*([+-]?\d+)/i);
                        if (match) characterOPs.economy += parseInt(match[1]);
                    }
                    if (description.includes('Softpower OP')) {
                        const match = description.match(/Softpower OP[:\s]*([+-]?\d+)/i);
                        if (match) characterOPs.softpower += parseInt(match[1]);
                    }
                    if (description.includes('Diplomacy OP')) {
                        const match = description.match(/Diplomacy OP[:\s]*([+-]?\d+)/i);
                        if (match) characterOPs.diplomacy += parseInt(match[1]);
                    }
                }

                // Update faction roster and OPs
                const currentRoster = this.selectedFaction.getFlag("bbttcc-factions", "roster") || [];
                const currentFactionOPs = this.selectedFaction.getFlag("bbttcc-factions", "ops") || {};

                // Add to roster if not already there
                if (!currentRoster.some(member => member.id === actor.id)) {
                    currentRoster.push({
                        id: actor.id,
                        name: actor.name,
                        joinedAt: new Date().toISOString(),
                        ops: characterOPs
                    });
                    await this.selectedFaction.setFlag("bbttcc-factions", "roster", currentRoster);
                }

                // Update faction OP totals
                const updatedFactionOPs = { ...currentFactionOPs };
                for (const [opType, contribution] of Object.entries(characterOPs)) {
                    if (contribution > 0 && updatedFactionOPs[opType]) {
                        updatedFactionOPs[opType].value += contribution;
                    }
                }
                await this.selectedFaction.setFlag("bbttcc-factions", "ops", updatedFactionOPs);

                console.log(`✅ Character ${actor.name} added to ${this.selectedFaction.name} with OP contributions:`, characterOPs);
            }

            ui.notifications.success(`🧙 Created BBTTCC character: ${actor.name}!`);
            actor.sheet.render(true);
            this.close();

        } catch (error) {
            console.error("Character creation failed:", error);
            ui.notifications.error(`Character creation failed: ${error.message}`);
        }
    }

    async _replaceHTML(content, element, options) {
        element.innerHTML = content;
        this._activateListeners(element);
    }

    _activateListeners(element) {
        // Handle checkbox changes for BBTTCC items
        element.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemId = e.target.value;
                if (e.target.checked) {
                    this.selectedItems.set(itemId, true);
                } else {
                    this.selectedItems.delete(itemId);
                }
            });
        });
    }
}

/**
 * Working Dashboard System
 */
class BBTTCCWorkingDashboard extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
        id: "bbttcc-working-dashboard",
        classes: ["bbttcc-gui"],
        tag: "div",
        window: { 
            title: "BBTTCC Campaign Dashboard",
            resizable: true 
        },
        position: { width: 1200, height: 700 },
        actions: {
            refreshData: BBTTCCWorkingDashboard.prototype._onRefreshData
        }
    };

    constructor() {
        super();
        this.factionData = [];
    }

    async _renderHTML(context, options) {
        // Get all factions with their data
        this.factionData = game.actors.filter(a => a.getFlag("bbttcc-factions", "isFaction"))
            .map(faction => {
                const ops = faction.getFlag("bbttcc-factions", "ops") || {};
                const roster = faction.getFlag("bbttcc-factions", "roster") || [];
                
                const totalOPs = Object.values(ops).reduce((sum, op) => sum + (op.value || 0), 0);
                const maxOPs = Object.values(ops).reduce((sum, op) => sum + (op.max || 10), 0);
                
                return {
                    actor: faction,
                    name: faction.name,
                    ops: ops,
                    roster: roster,
                    totalOPs: totalOPs,
                    maxOPs: maxOPs,
                    powerLevel: this.calculatePowerLevel(totalOPs)
                };
            });

        return `
            <div class="bbttcc-dashboard" style="padding: 20px; height: 100%; overflow-y: auto;">
                <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h1 style="color: #6f42c1; margin: 0;">⚔️ BBTTCC Campaign Dashboard</h1>
                    <button data-action="refreshData" style="
                        background: #007bff; 
                        color: white; 
                        border: none; 
                        padding: 8px 16px; 
                        border-radius: 4px; 
                        cursor: pointer;
                    ">🔄 Refresh</button>
                </div>

                <div class="faction-overview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
                    ${this.factionData.map(faction => `
                        <div class="faction-card" style="
                            border: 2px solid #6f42c1; 
                            border-radius: 12px; 
                            padding: 20px; 
                            background: linear-gradient(135deg, rgba(111, 66, 193, 0.1) 0%, rgba(255, 255, 255, 0.1) 100%);
                        ">
                            <div class="faction-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                <h2 style="color: #6f42c1; margin: 0; font-size: 1.2em;">${faction.name}</h2>
                                <span style="
                                    background: ${this.getPowerLevelColor(faction.powerLevel)}; 
                                    color: white; 
                                    padding: 4px 8px; 
                                    border-radius: 12px; 
                                    font-size: 0.8em; 
                                    font-weight: bold;
                                ">${faction.powerLevel}</span>
                            </div>

                            <div class="ops-summary" style="margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                    <span style="font-weight: bold;">Total OPs:</span>
                                    <span style="font-weight: bold; color: #6f42c1;">${faction.totalOPs}/${faction.maxOPs}</span>
                                </div>
                                
                                <div class="ops-breakdown" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.9em;">
                                    ${Object.entries(faction.ops).map(([opType, op]) => `
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="text-transform: capitalize;">${opType}:</span>
                                            <span style="font-weight: bold;">${op.value || 0}/${op.max || 10}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="roster-info">
                                <div style="font-weight: bold; margin-bottom: 8px;">
                                    📋 Roster (${faction.roster.length} members)
                                </div>
                                <div class="roster-list" style="max-height: 120px; overflow-y: auto; font-size: 0.9em;">
                                    ${faction.roster.length > 0 ? faction.roster.map(member => `
                                        <div style="padding: 4px 0; border-bottom: 1px solid rgba(111, 66, 193, 0.2);">
                                            <strong>${member.name}</strong>
                                            ${member.ops ? `<br><span style="color: #666; font-size: 0.8em;">OPs: ${Object.values(member.ops).reduce((sum, val) => sum + val, 0)}</span>` : ''}
                                        </div>
                                    `).join('') : '<em style="color: #666;">No members yet</em>'}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${this.factionData.length === 0 ? `
                    <div style="text-align: center; margin-top: 50px; color: #666;">
                        <h3>No BBTTCC Factions Found</h3>
                        <p>Create your first faction to see it appear here!</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    calculatePowerLevel(totalOPs) {
        if (totalOPs < 10) return "Emerging";
        if (totalOPs < 25) return "Growing"; 
        if (totalOPs < 40) return "Established";
        if (totalOPs < 55) return "Powerful";
        return "Dominant";
    }

    getPowerLevelColor(powerLevel) {
        const colors = {
            "Emerging": "#28a745",
            "Growing": "#17a2b8", 
            "Established": "#ffc107",
            "Powerful": "#fd7e14",
            "Dominant": "#dc3545"
        };
        return colors[powerLevel] || "#6c757d";
    }

    async _onRefreshData(event) {
        await this.render(true);
        ui.notifications.info("Dashboard refreshed!");
    }

    async _replaceHTML(content, element, options) {
        element.innerHTML = content;
    }
}

/**
 * Global GUI System Object
 */
window.BBTTCCGUI = {
    PerfectCharacterCreation: BBTTCCPerfectCharacterCreation,
    WorkingDashboard: BBTTCCWorkingDashboard,
    
    // Quick access methods
    openCharacterCreation() {
        new BBTTCCPerfectCharacterCreation().render(true);
    },
    
    openDashboard() {
        new BBTTCCWorkingDashboard().render(true);
    },
    
    // Faction creation method
    FactionCreation: {
        createFaction() {
            new Dialog({
                title: "Create BBTTCC Faction",
                content: `
                    <div style="padding: 15px;">
                        <label style="font-weight: bold; color: #6f42c1;">Faction Name:</label>
                        <input type="text" id="faction-name" placeholder="Enter faction name..." 
                               style="width: 100%; margin-top: 5px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" maxlength="50">
                    </div>
                `,
                buttons: {
                    create: {
                        label: "Create",
                        callback: async (html) => {
                            const name = html.find('#faction-name').val()?.trim();
                            if (!name || name.length < 2) {
                                ui.notifications.warn("Please enter a valid faction name!");
                                return;
                            }
                            
                            try {
                                // Use the existing BBTTCC factions module API
                                if (window.BBTTCC?.Factions?.factions?.create) {
                                    const faction = await window.BBTTCC.Factions.factions.create({ name });
                                    if (faction) {
                                        ui.notifications.success(`🏛️ Created faction: ${name}`);
                                        faction.sheet.render(true);
                                    }
                                } else {
                                    throw new Error("BBTTCC Factions API not available");
                                }
                            } catch (error) {
                                console.error("Faction creation failed:", error);
                                ui.notifications.error(`Failed to create faction: ${error.message}`);
                            }
                        }
                    },
                    cancel: {
                        label: "Cancel"
                    }
                },
                default: "create"
            }).render(true);
        }
    }
};

console.log("✅ BBTTCC GUI System loaded - ApplicationV2 interfaces ready!");

// ES module export (required for esmodules in manifest)
export { BBTTCCPerfectCharacterCreation, BBTTCCWorkingDashboard };