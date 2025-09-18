/**
 * FOUNDRY V13 COMPATIBLE FIX - ENHANCED EMBEDDED VERSION
 * Complete BBTTCC system with built-in persistence verification and OP calculation
 * Automatically loads on game startup - no manual scripts needed
 */

console.log('🔧 FOUNDRY V13 ENHANCED FIX: Loading complete embedded version with auto-verification...');
/Users/gamingaccount/bbttcc-embedded-fix-enhanced.js
// Prevent duplicate loading
if (window.BBTTCC_V13_ENHANCED_LOADED) {
    console.log('🔧 V13 ENHANCED: Already loaded, skipping');
} else {
    window.BBTTCC_V13_ENHANCED_LOADED = true;

    // Wait for Foundry to be completely ready
    Hooks.once('ready', function() {
        console.log('🔧 V13 ENHANCED: Ready hook fired - loading complete system with auto-verification');

        // Load the complete BBTTCC system (embedded)
        window.loadCompleteBBTTCCSystem = async function() {
            if (window.BBTTCCGUI) {
                console.log('✅ ENHANCED: BBTTCC system already loaded');
                return Promise.resolve();
            }

            console.log('🚀 ENHANCED: Loading complete BBTTCC system...');
            ui.notifications.info('🚀 Loading Complete BBTTCC System...');

            try {
                // EMBEDDED COMPLETE WORKING SYSTEM WITH ENHANCEMENTS
                eval(\`
// ================== ENHANCED CHARACTER CREATION SYSTEM ==================
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
                        console.warn(\`Pack error: \${pack.collection}\`);
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

            console.log(\`✅ Loaded: \${this.races.length} races, \${this.classes.length} classes, \${this.factions.length} factions, \${this.bbttccItems.length} BBTTCC items\`);

        } catch (error) {
            console.error("Data loading error:", error);
        }
    }

    async _renderHTML(context, options) {
        const raceOptions = this.races.map(race => {
            const selected = this.selectedRace && this.selectedRace.uuid === race.uuid ? 'selected' : '';
            return \`<div class="race-option \${selected}" data-uuid="\${race.uuid}" data-action="selectRace" style="padding: 4px; margin: 1px 0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 11px; \${selected ? 'background: #2196f3; color: white;' : ''}">\${race.name}</div>\`;
        }).join('');

        const classOptions = this.classes.map(cls => {
            const selected = this.selectedClass && this.selectedClass.uuid === cls.uuid ? 'selected' : '';
            return \`<div class="class-option \${selected}" data-uuid="\${cls.uuid}" data-action="selectClass" style="padding: 4px; margin: 1px 0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 11px; \${selected ? 'background: #2196f3; color: white;' : ''}">\${cls.name}</div>\`;
        }).join('');

        const factionOptions = this.factions.map(faction => {
            const selected = this.selectedFaction && this.selectedFaction.id === faction.id ? 'selected' : '';
            const ops = faction.getFlag("bbttcc-factions", "ops") || {};
            const totalOPs = Object.values(ops).reduce((sum, op) => sum + (op.value || 0), 0);
            return \`<div class="faction-option \${selected}" data-faction-id="\${faction.id}" data-action="selectFaction" style="padding: 4px; margin: 1px 0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; font-size: 11px; \${selected ? 'background: #6f42c1; color: white;' : ''}">
                \${faction.name}<br><small style="opacity: 0.8;">\${totalOPs} OPs</small>
            </div>\`;
        }).join('');

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

            const categoryName = category.replace(/([A-Z])/g, ' \$1').replace(/^./, str => str.toUpperCase());
            const isExpanded = this.expandedCategories.has(category);

            return \`
                <div style="margin-bottom: 6px; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px;">
                    <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 4px;">
                        <h6 style="margin: 0; color: #6f42c1; font-size: 12px; font-weight: bold;">\${categoryName} (\${items.length})</h6>
                        <button data-action="toggleCategory" data-category="\${category}" style="background: none; border: 1px solid #6f42c1; color: #6f42c1; padding: 1px 4px; border-radius: 3px; font-size: 9px; cursor: pointer; margin-left: auto;">
                            \${isExpanded ? 'Collapse' : 'Expand'}
                        </button>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 2px; \${isExpanded ? '' : 'display: none;'}">
                        \${items.map(item => {
                            const isSelected = this.selectedBBTTCCItems.has(item.id);
                            return \`<div style="display: flex; align-items: center; gap: 4px; padding: 2px; font-size: 10px;">
                                <input type="checkbox" id="bbttcc-\${item.id}" data-item-id="\${item.id}" style="margin: 0;" \${isSelected ? 'checked' : ''}>
                                <label for="bbttcc-\${item.id}" style="line-height: 1.2; cursor: pointer;">\${item.name}</label>
                            </div>\`;
                        }).join('')}
                    </div>
                </div>
            \`;
        }).join('');

        const tikkunGuide = \`
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 4px; border-radius: 4px; font-size: 9px; color: #856404;">
                <strong>Tikkun Guide:</strong> 0=Mundane, 1-2=Awakening, 3-4=Seeking, 5-6=Understanding, 7-8=Wisdom, 9-10=Enlightened
            </div>
        \`;

        const canCreate = !!(this.selectedRace && this.selectedClass && this.characterName && this.characterName.trim().length > 0);

        return \`
            <div style="padding: 12px; font-family: 'Signika', sans-serif; background: white; color: black; font-size: 12px; height: 100%; overflow-y: auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px; margin: -12px -12px 12px -12px;">
                    <h2 style="margin: 0; font-size: 16px;">🧙 BBTTCC Perfect Character Creation</h2>
                    <p style="margin: 3px 0 0 0; opacity: 0.9; font-size: 10px;">Complete Integration: D&D 5e + Factions + Tikkun + All BBTTCC Systems</p>
                </div>

                <div style="display: grid; grid-template-columns: 3fr 1fr; gap: 8px; margin-bottom: 10px;">
                    <div>
                        <label style="display: block; margin-bottom: 2px; font-weight: bold; font-size: 11px;">Character Name:</label>
                        <input type="text" id="character-name-input" value="\${this.characterName}" placeholder="Enter character name" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 2px; font-weight: bold; font-size: 11px;">Tikkun Sparks:</label>
                        <input type="number" id="tikkun-sparks" value="\${this.tikkunSparks}" min="0" max="10" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px;">
                    </div>
                </div>

                \${tikkunGuide}

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 10px 0;">
                    <div>
                        <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
                            🧝 Race \${this.selectedRace ? \`(\${this.selectedRace.name})\` : ''}
                        </h3>
                        <div style="height: 180px; overflow-y: auto; border: 1px solid #ddd; padding: 6px; background: #f8f9fa; border-radius: 3px;">
                            \${raceOptions || '<p style="color: #6c757d; font-size: 10px;">No races</p>'}
                        </div>
                    </div>

                    <div>
                        <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
                            ⚔️ Class \${this.selectedClass ? \`(\${this.selectedClass.name})\` : ''}
                        </h3>
                        <div style="height: 180px; overflow-y: auto; border: 1px solid #ddd; padding: 6px; background: #f8f9fa; border-radius: 3px;">
                            \${classOptions || '<p style="color: #6c757d; font-size: 10px;">No classes</p>'}
                        </div>
                    </div>

                    <div>
                        <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">
                            🏛️ Faction \${this.selectedFaction ? \`(\${this.selectedFaction.name})\` : '(Optional)'}
                        </h3>
                        <div style="height: 180px; overflow-y: auto; border: 1px solid #ddd; padding: 6px; background: #f8f9fa; border-radius: 3px;">
                            \${factionOptions || '<p style="color: #6c757d; font-size: 10px;">No factions</p>'}
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 10px;">
                    <h3 style="color: #495057; margin-bottom: 4px; font-size: 12px; border-bottom: 1px solid #ddd; padding-bottom: 2px;">🏛️ BBTTCC Character Options (\${this.bbttccItems.length} total - Optional)</h3>
                    <div style="height: 260px; overflow-y: auto; border: 1px solid #ddd; padding: 8px; background: #f8f9fa; border-radius: 3px;">
                        \${bbttccOptions || '<p style="color: #6c757d; font-size: 10px;">No BBTTCC options found</p>'}
                    </div>
                </div>

                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 4px; border-top: 2px solid \${canCreate ? '#28a745' : '#dc3545'};">
                    <button type="button" data-action="createCharacter" style="background: \${canCreate ? '#28a745' : '#6c757d'}; color: white; border: none; padding: 12px 40px; border-radius: 4px; cursor: \${canCreate ? 'pointer' : 'not-allowed'}; font-weight: bold; font-size: 14px;" \${canCreate ? '' : 'disabled'}>
                        🧙 Create Perfect BBTTCC Character
                    </button>
                    <p style="margin: 6px 0 0 0; font-size: 10px; color: #6c757d;">
                        \${canCreate ? '✅ Ready! Selected BBTTCC items will be added as feat items on character sheet' : '❌ Select race, class, and enter name'}
                    </p>
                </div>
            </div>
        \`;
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

            // ================== ENHANCED OP CALCULATION ==================
            if (this.selectedFaction) {
                try {
                    console.log(\`🧮 ENHANCED: Calculating OP contributions for \${actor.name}...\`);

                    const characterOPs = {
                        violence: 0, nonlethal: 0, intrigue: 0,
                        economy: 0, softpower: 0, diplomacy: 0
                    };

                    console.log(\`🧮 ENHANCED: Checking \${actor.items.size} items for OP contributions\`);

                    for (const item of actor.items) {
                        const description = item.system?.description?.value || '';
                        const itemName = item.name;

                        let itemOPs = {};

                        // Enhanced OP detection with multiple patterns
                        const opPatterns = {
                            violence: [/Violence OP[:\\s]*([+-]?\\d+)/i, /Violence[:\\s]*([+-]?\\d+)/i],
                            nonlethal: [/Nonlethal OP[:\\s]*([+-]?\\d+)/i, /Non-lethal OP[:\\s]*([+-]?\\d+)/i],
                            intrigue: [/Intrigue OP[:\\s]*([+-]?\\d+)/i, /Intrigue[:\\s]*([+-]?\\d+)/i],
                            economy: [/Economy OP[:\\s]*([+-]?\\d+)/i, /Economic[:\\s]*([+-]?\\d+)/i],
                            softpower: [/Softpower OP[:\\s]*([+-]?\\d+)/i, /Soft Power[:\\s]*([+-]?\\d+)/i],
                            diplomacy: [/Diplomacy OP[:\\s]*([+-]?\\d+)/i, /Diplomatic[:\\s]*([+-]?\\d+)/i]
                        };

                        for (const [opType, patterns] of Object.entries(opPatterns)) {
                            for (const pattern of patterns) {
                                const match = description.match(pattern);
                                if (match) {
                                    const value = parseInt(match[1]) || 0;
                                    characterOPs[opType] += value;
                                    itemOPs[opType] = value;
                                    break;
                                }
                            }
                        }

                        if (Object.keys(itemOPs).length > 0) {
                            console.log(\`🧮 ENHANCED: Found OP contributions in \${itemName}:\`, itemOPs);
                        }
                    }

                    const totalOPs = Object.values(characterOPs).reduce((sum, val) => sum + val, 0);
                    console.log(\`🧮 ENHANCED: \${actor.name} total OP contributions:\`, characterOPs, \`Total: \${totalOPs}\`);

                    // Enhanced faction OP update
                    if (totalOPs > 0) {
                        console.log(\`🧮 ENHANCED: Updating faction \${this.selectedFaction.name} with \${totalOPs} additional OPs\`);

                        const currentFactionOPs = this.selectedFaction.getFlag("bbttcc-factions", "ops") || {};
                        console.log("🧮 ENHANCED: Current faction OPs:", currentFactionOPs);

                        const updatedFactionOPs = { ...currentFactionOPs };

                        for (const [opType, contribution] of Object.entries(characterOPs)) {
                            if (contribution > 0) {
                                if (!updatedFactionOPs[opType]) {
                                    updatedFactionOPs[opType] = { value: 0, max: 10 };
                                }
                                const oldValue = updatedFactionOPs[opType].value || 0;
                                updatedFactionOPs[opType].value = oldValue + contribution;
                                console.log(\`🧮 ENHANCED: Updated \${opType} from \${oldValue} to \${updatedFactionOPs[opType].value}\`);
                            }
                        }

                        await this.selectedFaction.setFlag("bbttcc-factions", "ops", updatedFactionOPs);
                        console.log("✅ ENHANCED: Faction OPs updated successfully");

                        ui.notifications.success(\`🏛️ \${actor.name} joined \${this.selectedFaction.name} (+\${totalOPs} OPs)!\`);
                    } else {
                        ui.notifications.info(\`🏛️ \${actor.name} joined \${this.selectedFaction.name}!\`);
                    }

                    // Add character to faction roster
                    const currentRoster = this.selectedFaction.getFlag("bbttcc-factions", "roster") || [];
                    const existingEntry = currentRoster.find(member => member.actorId === actor.id);

                    if (!existingEntry) {
                        const newMember = {
                            actorId: actor.id,
                            name: actor.name,
                            role: "Member",
                            dateJoined: new Date().toISOString().split('T')[0],
                            status: "Active",
                            contributionPoints: totalOPs
                        };

                        const updatedRoster = [...currentRoster, newMember];
                        await this.selectedFaction.setFlag("bbttcc-factions", "roster", updatedRoster);

                        console.log(\`✅ ENHANCED: \${actor.name} added to \${this.selectedFaction.name} roster\`);
                    }

                } catch (factionError) {
                    console.warn("Enhanced faction roster update failed:", factionError);
                    ui.notifications.warn("Character created but faction roster not updated");
                }
            }

            // Continue with D&D 5e advancement
            const raceData = this.selectedRace.toObject();
            const classData = this.selectedClass.toObject();
            classData.system.levels = 0;

            const advancementItems = [raceData, classData];

            const manager = new dnd5e.applications.advancement.AdvancementManager(actor, {
                automaticApplication: true
            });
            manager.clone.updateSource({ items: advancementItems });

            for (const itemData of advancementItems) {
                const item = manager.clone.items.get(itemData._id);

                if (item.type === "class") {
                    manager.createLevelChangeSteps(item, 1);
                } else {
                    for (let l = 0; l < 2; l++) {
                        const flows = manager.constructor.flowsForLevel(item, l);
                        for (const flow of flows) {
                            manager.steps.push({ type: "forward", flow });
                        }
                    }
                }
            }

            await manager.render(true);
            ui.notifications.info("🎲 Complete D&D 5e advancement - BBTTCC integration active!");

            this.close();

        } catch (error) {
            console.error("Perfect character creation error:", error);
            ui.notifications.error(\`Character creation failed: \${error.message}\`);
        }
    }
}

// ================== ENHANCED DASHBOARD SYSTEM ==================
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

            return \`
                <div class="faction-card" style="border: 1px solid #ccc; margin: 15px 0; padding: 20px; border-radius: 8px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="color: #495057; margin: 0 0 15px 0; display: flex; align-items: center; gap: 10px; font-size: 18px;">
                        <i class="fas fa-flag" style="color: #6f42c1;"></i>
                        \${f.name}
                    </h3>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div>
                            <h4 style="color: #28a745; margin: 0 0 10px 0; font-size: 14px;">📊 Organization Points</h4>
                            <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #28a745; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                                <div style="font-size: 28px; font-weight: bold; color: #28a745;">\${total} / \${maxOPs}</div>
                                <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">Available Organization Points</div>
                            </div>

                            <div style="margin-top: 10px; font-size: 12px; background: white; padding: 8px; border-radius: 4px;">
                                \${Object.entries(ops).map(([type, op]) =>
                                    \`<div style="display: flex; justify-content: space-between; margin: 2px 0;">
                                        <span>\${type}:</span>
                                        <span style="font-weight: bold;">\${op.value}/\${op.max || 20}</span>
                                    </div>\`
                                ).join('') || '<div style="color: #6c757d; font-style: italic;">No OP breakdown available</div>'}
                            </div>
                        </div>

                        <div>
                            <h4 style="color: #dc3545; margin: 0 0 10px 0; font-size: 14px;">👥 Roster (\${linkedCharacters.length + roster.length} total)</h4>
                            <div style="background: white; padding: 12px; border-radius: 6px; max-height: 160px; overflow-y: auto; font-size: 12px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                                \${roster.map(member => \`
                                    <div style="padding: 4px 0; border-bottom: 1px solid #f1f3f4;">
                                        📋 <strong>\${member.name}</strong> <span style="color: #6c757d;">(\${member.role}) - \${member.contributionPoints || 0} OPs</span>
                                    </div>
                                \`).join('')}
                                \${linkedCharacters.map(char => \`
                                    <div style="padding: 4px 0; border-bottom: 1px solid #f1f3f4; background: #f8f4ff; margin: 2px -4px; padding-left: 8px; border-radius: 3px;">
                                        🧙 <strong style="color: #6f42c1;">\${char.name}</strong> <span style="color: #6c757d;">(BBTTCC Character)</span>
                                    </div>
                                \`).join('')}
                                \${(roster.length === 0 && linkedCharacters.length === 0) ? '<div style="color: #6c757d; font-style: italic; text-align: center; padding: 20px;">No members found</div>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            \`;
        }).join('');

        let characterHTML = characters.map(c => {
            const faction = c.getFlag("bbttcc-territory", "faction") || "Independent";
            const sparks = c.getFlag("bbttcc-tikkun", "sparks") || 0;
            const radiation = c.getFlag("bbttcc-radiation", "points") || 0;
            const raid = c.getFlag("bbttcc-raid", "experience") || 0;

            return \`
                <div style="border: 1px solid #ddd; margin: 8px 0; padding: 12px; border-radius: 6px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #6f42c1; font-size: 14px;">\${c.name}</strong>
                        <span style="background: #6f42c1; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px;">\${faction}</span>
                    </div>
                    <div style="font-size: 11px; color: #6c757d; margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                        <div>⭐ Tikkun: <strong>\${sparks}</strong></div>
                        <div>☢️ Radiation: <strong>\${radiation}</strong></div>
                        <div>⚔️ Raid XP: <strong>\${raid}</strong></div>
                    </div>
                </div>
            \`;
        }).join('');

        return \`
            <div style="padding: 20px; font-family: 'Signika', sans-serif; background: white; height: 100%; overflow-y: auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: -20px -20px 25px -20px; border-radius: 0 0 12px 12px;">
                    <h2 style="margin: 0; display: flex; align-items: center; gap: 12px; font-size: 24px;">
                        <i class="fas fa-chart-line"></i>
                        BBTTCC Strategic Dashboard
                    </h2>
                    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Campaign Overview | \${factions.length} Factions | \${characters.length} BBTTCC Characters</p>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 25px;">
                    <div>
                        <h3 style="color: #495057; margin: 0 0 20px 0; border-bottom: 3px solid #dee2e6; padding-bottom: 10px; font-size: 20px;">
                            🏛️ Faction Status & Rosters
                        </h3>
                        <div style="max-height: 500px; overflow-y: auto;">
                            \${factionHTML || '<div style="text-align: center; padding: 40px; color: #6c757d; font-style: italic;">No factions found</div>'}
                        </div>
                    </div>

                    <div>
                        <h3 style="color: #495057; margin: 0 0 20px 0; border-bottom: 3px solid #dee2e6; padding-bottom: 10px; font-size: 20px;">
                            🧙 BBTTCC Characters
                        </h3>
                        <div style="max-height: 500px; overflow-y: auto; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                            \${characterHTML || '<div style="text-align: center; padding: 40px; color: #6c757d; font-style: italic;">No BBTTCC characters found</div>'}
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 25px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-top: 3px solid #28a745;">
                    <button onclick="window.BBTTCCGUI.refreshDashboard()"
                            style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-right: 10px; font-size: 14px;">
                        <i class="fas fa-sync-alt"></i> Refresh Dashboard
                    </button>
                    <button onclick="this.closest('.application').querySelector('.window-header .close').click()"
                            style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                        <i class="fas fa-times"></i> Close Dashboard
                    </button>
                </div>
            </div>
        \`;
    }

    async _replaceHTML(result, content, options) {
        content.innerHTML = result;
        console.log("✅ Enhanced Dashboard HTML replaced successfully");
    }
}

// ================== ENHANCED FACTION CREATION SYSTEM ==================
class BBTTCCFactionCreation {
    static async createFaction() {
        try {
            console.log("🏛️ Starting enhanced faction creation process...");

            const factionName = await BBTTCCFactionCreation.promptForFactionName();
            if (!factionName) return;

            console.log(\`🏛️ Creating faction: \${factionName}\`);

            const factionData = {
                name: factionName,
                type: "npc", // CRITICAL: Always use npc type for factions
                flags: {
                    "bbttcc-factions": {
                        isFaction: true,
                        ops: { // CRITICAL: Use "ops", NOT "organizationPoints"
                            violence: { value: 5, max: 10 },
                            nonlethal: { value: 2, max: 10 },
                            intrigue: { value: 4, max: 10 },
                            economy: { value: 3, max: 10 },
                            softpower: { value: 3, max: 10 },
                            diplomacy: { value: 2, max: 10 }
                        },
                        roster: [],
                        maxOPs: 60,
                        created: new Date().toISOString()
                    }
                }
            };

            const faction = await Actor.create(factionData);

            if (faction) {
                console.log(\`✅ ENHANCED: Faction created: \${faction.name} (ID: \${faction.id})\`);
                ui.notifications.success(\`🏛️ Created faction: \${factionName} with enhanced OP tracking\`);

                setTimeout(() => {
                    faction.sheet.render(true);
                }, 500);

                if (window.BBTTCCGUI && window.BBTTCCGUI.refreshDashboard) {
                    setTimeout(() => window.BBTTCCGUI.refreshDashboard(), 1000);
                }
            }

        } catch (error) {
            console.error("❌ Enhanced faction creation failed:", error);
            ui.notifications.error(\`Failed to create faction: \${error.message}\`);
        }
    }

    static async promptForFactionName() {
        return new Promise((resolve) => {
            const dialog = new Dialog({
                title: "Create New BBTTCC Faction (Enhanced)",
                content: \`
                    <div style="padding: 10px;">
                        <div style="margin-bottom: 15px;">
                            <label for="faction-name" style="font-weight: bold; color: #6f42c1;">Faction Name:</label>
                            <input type="text" id="faction-name" name="faction-name"
                                   placeholder="Enter faction name..."
                                   style="width: 100%; margin-top: 5px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"
                                   maxlength="50">
                        </div>
                        <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px; color: #666;">
                            <strong>Enhanced OP System (19 total):</strong><br>
                            Violence: 5, Nonlethal: 2, Intrigue: 4<br>
                            Economy: 3, Softpower: 3, Diplomacy: 2<br>
                            <em>Auto-calculated from character contributions</em>
                        </div>
                    </div>
                \`,
                buttons: {
                    create: {
                        icon: '<i class="fas fa-plus"></i>',
                        label: "Create Enhanced Faction",
                        callback: (html) => {
                            const name = html.find('#faction-name').val()?.trim();
                            if (!name) {
                                ui.notifications.warn("Please enter a faction name!");
                                return resolve(null);
                            }
                            if (name.length < 2) {
                                ui.notifications.warn("Faction name must be at least 2 characters long!");
                                return resolve(null);
                            }
                            resolve(name);
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "create",
                render: (html) => {
                    const input = html.find('#faction-name');
                    input.focus();
                    input.on('keypress', (e) => {
                        if (e.which === 13) {
                            html.find('[data-button="create"]').click();
                        }
                    });
                }
            });
            dialog.render(true);
        });
    }
}

// ================== ENHANCED BUTTON MANAGEMENT SYSTEM ==================
class BBTTCCEnhancedButtonManager {
    static addAllButtons() {
        console.log("🎮 ENHANCED: Adding all BBTTCC buttons with complete system...");

        const actorDirectoryElement = document.querySelector('.directory#actors');
        if (!actorDirectoryElement) return false;

        const \$html = \$(actorDirectoryElement);
        const \$headerActions = \$html.find('.directory-header .header-actions');
        if (\$headerActions.length === 0) return false;

        // Remove existing buttons
        \$html.find('.persistent-bbttcc-btn, .persistent-faction-btn, .bbttcc-dashboard-btn').remove();

        // CHARACTER CREATION BUTTON
        const \$characterButton = \$(\`
            <button class="bbttcc-perfect-character-creation persistent-bbttcc-btn" title="Create BBTTCC Character" type="button">
                <i class="fas fa-atom"></i> Create BBTTCC Character
            </button>
        \`);

        \$characterButton.css({
            'background': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'color': 'white',
            'border': '1px solid #5a6fd8',
            'border-radius': '3px',
            'padding': '4px 8px',
            'margin-left': '5px',
            'font-size': '12px',
            'cursor': 'pointer',
            'display': 'inline-flex',
            'align-items': 'center',
            'gap': '4px',
            'white-space': 'nowrap'
        });

        \$characterButton.hover(
            function() { \$(this).css('background', 'linear-gradient(135deg, #5a6fd8 0%, #6f42c1 100%)'); },
            function() { \$(this).css('background', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'); }
        );

        \$characterButton.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            \$(this).css('opacity', '0.8');
            setTimeout(() => \$(this).css('opacity', '1'), 200);

            new BBTTCCPerfectCharacterCreation().render(true);
            ui.notifications.info("🧙 BBTTCC Perfect Character Creation opened!");
        });

        // FACTION CREATION BUTTON
        const \$factionButton = \$(\`
            <button class="bbttcc-faction-creation persistent-faction-btn" title="Create BBTTCC Faction" type="button">
                <i class="fas fa-flag"></i> Create Faction
            </button>
        \`);

        \$factionButton.css({
            'background': 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
            'color': 'white',
            'border': '1px solid #c82333',
            'border-radius': '3px',
            'padding': '4px 8px',
            'margin-left': '5px',
            'font-size': '12px',
            'cursor': 'pointer',
            'display': 'inline-flex',
            'align-items': 'center',
            'gap': '4px',
            'white-space': 'nowrap'
        });

        \$factionButton.hover(
            function() { \$(this).css('background', 'linear-gradient(135deg, #c82333 0%, #a71e2a 100%)'); },
            function() { \$(this).css('background', 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'); }
        );

        \$factionButton.on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            \$(this).css('opacity', '0.8');
            setTimeout(() => \$(this).css('opacity', '1'), 200);

            BBTTCCFactionCreation.createFaction();
        });

        // Add buttons to header
        const \$createActorButton = \$headerActions.find('[data-action="create"]');
        if (\$createActorButton.length > 0) {
            \$createActorButton.after(\$characterButton);
            \$characterButton.after(\$factionButton);
        } else {
            \$headerActions.append(\$characterButton);
            \$headerActions.append(\$factionButton);
        }

        // DASHBOARD BUTTON (in scenes directory)
        const \$scenesHeader = \$('.directory#scenes .directory-header .header-actions');
        if (\$scenesHeader.length > 0) {
            \$('.bbttcc-dashboard-btn').remove();

            const \$dashboardButton = \$(\`
                <button class="bbttcc-dashboard-btn" title="Open BBTTCC Strategic Dashboard" type="button">
                    <i class="fas fa-chart-line"></i> BBTTCC Dashboard
                </button>
            \`);

            \$dashboardButton.css({
                'background': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                'color': 'white',
                'border': '1px solid #20c997',
                'border-radius': '3px',
                'padding': '4px 8px',
                'margin-left': '5px',
                'font-size': '12px',
                'cursor': 'pointer',
                'display': 'inline-flex',
                'align-items': 'center',
                'gap': '4px',
                'white-space': 'nowrap'
            });

            \$dashboardButton.hover(
                function() { \$(this).css('background', 'linear-gradient(135deg, #218838 0%, #1ea085 100%)'); },
                function() { \$(this).css('background', 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'); }
            );

            \$dashboardButton.on('click', function(e) {
                e.preventDefault();
                window.BBTTCCGUI.openDashboard();
            });

            \$scenesHeader.append(\$dashboardButton);
        }

        console.log("✅ ENHANCED: All BBTTCC buttons added with complete system loaded");
        return true;
    }

    static monitorButtons() {
        // Enhanced monitoring - more frequent and thorough
        if (window.BBTTCC_ENHANCED_MONITOR) {
            clearInterval(window.BBTTCC_ENHANCED_MONITOR);
        }

        window.BBTTCC_ENHANCED_MONITOR = setInterval(() => {
            const characterBtn = \$('.persistent-bbttcc-btn');
            const factionBtn = \$('.persistent-faction-btn');
            const dashboardBtn = \$('.bbttcc-dashboard-btn');

            const missingButtons = [];
            if (characterBtn.length === 0) missingButtons.push('Character');
            if (factionBtn.length === 0) missingButtons.push('Faction');
            if (dashboardBtn.length === 0) missingButtons.push('Dashboard');

            if (missingButtons.length > 0) {
                console.log(\`🔧 ENHANCED: Re-adding missing buttons: \${missingButtons.join(', ')}\`);
                BBTTCCEnhancedButtonManager.addAllButtons();
            }
        }, 2000); // More frequent monitoring
    }
}

// ================== ENHANCED GLOBAL SETUP ==================
window.BBTTCCGUI = window.BBTTCCGUI || {};
window.BBTTCCGUI.PerfectCharacterCreation = BBTTCCPerfectCharacterCreation;
window.BBTTCCGUI.WorkingDashboard = BBTTCCWorkingDashboard;
window.BBTTCCGUI.FactionCreation = BBTTCCFactionCreation;

window.BBTTCCGUI.openPerfectCharacterCreation = () => {
    new BBTTCCPerfectCharacterCreation().render(true);
    ui.notifications.info("🧙 BBTTCC Perfect Character Creation opened!");
};

window.BBTTCCGUI.openDashboard = () => {
    new BBTTCCWorkingDashboard().render(true);
    ui.notifications.info("📊 BBTTCC Strategic Dashboard opened!");
};

window.BBTTCCGUI.refreshDashboard = () => {
    const existingDashboard = Object.values(ui.windows).find(w => w.id === 'bbttcc-working-dashboard');
    if (existingDashboard) {
        existingDashboard.render(true);
        ui.notifications.info("📊 Dashboard refreshed!");
    } else {
        window.BBTTCCGUI.openDashboard();
    }
};

// Initialize enhanced system
if (BBTTCCEnhancedButtonManager.addAllButtons()) {
    ui.notifications.success("🎮 Enhanced BBTTCC System loaded: Character + Faction + Dashboard!");
} else {
    ui.notifications.warn("Will add enhanced BBTTCC system when directories refresh");
}

BBTTCCEnhancedButtonManager.monitorButtons();

console.log("🎯 ENHANCED COMPLETE BBTTCC SYSTEM RESTORED!");
console.log("===========================================");
console.log("✅ Enhanced button persistence monitoring");
console.log("✅ Enhanced OP auto-calculation");
console.log("✅ Complete D&D 5e integration");
console.log("✅ All BBTTCC subsystem flags");
console.log("✅ Proper character creation workflow");
console.log("✅ ApplicationV2 framework");
console.log("✅ Auto-startup integration");

ui.notifications.success("🧙 ENHANCED BBTTCC system with auto-verification loaded!");
\`);

                console.log("✅ ENHANCED: Complete BBTTCC system loaded successfully");
                return Promise.resolve();

            } catch (error) {
                console.error("❌ ENHANCED: System loading failed:", error);
                ui.notifications.error(`Failed to load BBTTCC system: ${error.message}`);
                return Promise.reject(error);
            }
        };

        // Enhanced button injection function
        const injectEnhancedButtons = () => {
            const actorDirectory = document.querySelector('#sidebar #actors');
            if (!actorDirectory) return;

            const actorHeader = actorDirectory.querySelector('.directory-header');
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

            // Character Creation button with enhanced functionality
            const createBtn = document.createElement('button');
            createBtn.className = 'bbttcc-char-btn';
            createBtn.innerHTML = '🧙 BBTTCC Character';
            createBtn.title = 'Create BBTTCC Character with Enhanced Integration';
            createBtn.style.fontSize = '12px';
            createBtn.style.padding = '6px 12px';
            createBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            createBtn.style.color = 'white';
            createBtn.style.border = 'none';
            createBtn.style.borderRadius = '4px';
            createBtn.style.cursor = 'pointer';

            createBtn.addEventListener('click', () => {
                console.log('🧙 ENHANCED: BBTTCC Character button clicked');
                loadCompleteBBTTCCSystem().then(() => {
                    if (window.BBTTCCGUI && window.BBTTCCGUI.openCharacterCreation) {
                        window.BBTTCCGUI.openCharacterCreation();
                    } else if (window.BBTTCCGUI && window.BBTTCCGUI.openPerfectCharacterCreation) {
                        window.BBTTCCGUI.openPerfectCharacterCreation();
                    } else {
                        ui.notifications.warn('Character creation not available');
                    }
                });
            });

            // Faction Creation button with enhanced functionality
            const factionBtn = document.createElement('button');
            factionBtn.className = 'bbttcc-faction-btn';
            factionBtn.innerHTML = '🏛️ Create Faction';
            factionBtn.title = 'Create BBTTCC Faction with Enhanced OP Tracking';
            factionBtn.style.fontSize = '12px';
            factionBtn.style.padding = '6px 12px';
            factionBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
            factionBtn.style.color = 'white';
            factionBtn.style.border = 'none';
            factionBtn.style.borderRadius = '4px';
            factionBtn.style.cursor = 'pointer';

            factionBtn.addEventListener('click', () => {
                console.log('🏛️ ENHANCED: BBTTCC Faction button clicked');
                loadCompleteBBTTCCSystem().then(() => {
                    if (window.BBTTCCGUI && window.BBTTCCGUI.FactionCreation && window.BBTTCCGUI.FactionCreation.createFaction) {
                        window.BBTTCCGUI.FactionCreation.createFaction();
                    } else {
                        ui.notifications.warn('Faction creation not available');
                    }
                });
            });

            // Dashboard button with enhanced functionality
            const dashboardBtn = document.createElement('button');
            dashboardBtn.className = 'bbttcc-dashboard-btn';
            dashboardBtn.innerHTML = '📊 Dashboard';
            dashboardBtn.title = 'Open Enhanced BBTTCC Strategic Dashboard';
            dashboardBtn.style.fontSize = '12px';
            dashboardBtn.style.padding = '6px 12px';
            dashboardBtn.style.background = 'linear-gradient(135deg, #fd7e14 0%, #e83e8c 100%)';
            dashboardBtn.style.color = 'white';
            dashboardBtn.style.border = 'none';
            dashboardBtn.style.borderRadius = '4px';
            dashboardBtn.style.cursor = 'pointer';

            dashboardBtn.addEventListener('click', () => {
                console.log('📊 ENHANCED: BBTTCC Dashboard button clicked');
                loadCompleteBBTTCCSystem().then(() => {
                    if (window.BBTTCCGUI && window.BBTTCCGUI.openDashboard) {
                        window.BBTTCCGUI.openDashboard();
                    } else {
                        ui.notifications.warn('Dashboard not available');
                    }
                });
            });

            buttonContainer.appendChild(createBtn);
            buttonContainer.appendChild(factionBtn);
            buttonContainer.appendChild(dashboardBtn);
            actorHeader.appendChild(buttonContainer);
            console.log('🔧 V13 ENHANCED: BBTTCC buttons injected into Actor Directory');
        };

        // ENHANCED PERSISTENCE SYSTEM - Multiple hooks and monitoring
        const persistenceHooks = [
            'renderActorDirectory',
            'renderSceneDirectory',
            'renderSidebar'
        ];

        persistenceHooks.forEach(hookName => {
            Hooks.on(hookName, (app, html, data) => {
                console.log(`🔄 ENHANCED: ${hookName} hook fired - checking buttons`);
                setTimeout(() => {
                    // Check if buttons are missing and re-inject if needed
                    const actorDirectory = document.querySelector('#sidebar #actors');
                    if (actorDirectory) {
                        const existingButtons = actorDirectory.querySelectorAll('.bbttcc-button-container');
                        if (existingButtons.length === 0) {
                            console.log('🔧 ENHANCED: Buttons missing, re-injecting...');
                            injectEnhancedButtons();
                        }
                    }
                }, 100);
            });
        });

        // Enhanced monitoring system - checks every 3 seconds for missing buttons
        setInterval(() => {
            const actorDirectory = document.querySelector('#sidebar #actors');
            if (actorDirectory) {
                const existingButtons = actorDirectory.querySelectorAll('.bbttcc-button-container');
                if (existingButtons.length === 0) {
                    console.log('🔧 ENHANCED: Periodic check - buttons missing, re-injecting...');
                    injectEnhancedButtons();
                }
            }
        }, 3000);

        // Initial injection
        setTimeout(() => {
            console.log('⚡ ENHANCED: Running initial injection...');
            injectEnhancedButtons();

            // Load the complete system on startup
            loadCompleteBBTTCCSystem();
        }, 1000);

        console.log('🔧 V13 ENHANCED: Complete setup finished with auto-verification');
    });
}

console.log("🎯 ENHANCED: Foundry V13 compatible fix loaded with built-in persistence and OP verification!");