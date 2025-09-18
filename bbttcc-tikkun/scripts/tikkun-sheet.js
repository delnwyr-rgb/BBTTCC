/**
 * BBTTCC Tikkun Sheet Integration
 * Adds "The Great Work" tab to D&D 5e character sheets
 * Provides visual Spark Constellation tracker
 */

// BBTTCCTikkun will be available through game.bbttccTikkun

export class TikkunSheetIntegration {
    constructor() {
        this.tabId = 'great-work';
        this.tabLabel = 'The Great Work';
    }

    // Add Great Work tab to character sheet
    addGreatWorkTab(app, html, data) {
        console.log(`🎭 TikkunSheetIntegration.addGreatWorkTab called for: ${app.actor?.name}`);

        if (!app.actor || app.actor.type !== 'character') {
            console.log(`❌ Not a character actor, skipping tab`);
            return;
        }

        // Check multiple ways to access the API
        const api = game.bbttccTikkun || game.modules.get('bbttcc-tikkun')?.api;
        console.log(`🔌 API access:`, { bbttccTikkun: !!game.bbttccTikkun, moduleApi: !!game.modules.get('bbttcc-tikkun')?.api });

        // Check if this is a BBTTCC character by multiple methods
        const sparksData = api?.getSparks ? api.getSparks(app.actor) : null;
        const hasDirectSparks = app.actor.getFlag("bbttcc-tikkun", "sparks");
        const isBBTTCCCharacter = app.actor.getFlag("bbttcc-territory", "bbttccCharacter");
        const bbttccEnhancements = app.actor.flags?.bbttccEnhancements || app.actor.getFlag("bbttcc-territory", "bbttccEnhancements");

        console.log(`🔍 BBTTCC character detection for ${app.actor.name}:`, {
            sparksData: !!sparksData,
            hasDirectSparks: !!hasDirectSparks,
            isBBTTCCCharacter: !!isBBTTCCCharacter,
            bbttccEnhancements: !!bbttccEnhancements
        });

        // Show tab if any BBTTCC indicators are present
        const shouldShowTab = sparksData || hasDirectSparks || isBBTTCCCharacter || bbttccEnhancements;

        if (!shouldShowTab) {
            console.log(`⏭️ ${app.actor.name} is not a BBTTCC character, skipping tab`);
            // Add "Generate Constellation" button for GMs if this looks like it could be a BBTTCC character
            if (game.user.isGM && (isBBTTCCCharacter || bbttccEnhancements)) {
                this.addConstellationGenerationButton(app, html);
            }
            return;
        }

        console.log(`✅ ${app.actor.name} should show BBTTCC tab, proceeding...`);

        // Add tab navigation
        const tabs = html.find('.sheet-tabs[data-group="primary"]');
        console.log(`🗂️ Found ${tabs.length} tab containers:`, tabs);
        if (tabs.length === 0) {
            console.log(`❌ No tab container found, cannot add BBTTCC tab`);
            return;
        }

        const tabHtml = `<a class="item" data-tab="${this.tabId}">
            <i class="fas fa-star"></i> ${this.tabLabel}
        </a>`;

        tabs.append(tabHtml);
        console.log(`📝 Added tab navigation HTML:`, tabHtml);

        // Add tab content
        const tabContent = html.find('.sheet-body .tab');
        const lastTab = tabContent.last();
        console.log(`📄 Found ${tabContent.length} existing tabs, last tab:`, lastTab);

        const contentHtml = `<div class="tab" data-tab="${this.tabId}" data-group="primary">
            <div class="bbttcc-tikkun-content" data-actor-id="${app.actor.id}">
                <div class="loading">Loading constellation...</div>
            </div>
        </div>`;

        lastTab.after(contentHtml);
        console.log(`📄 Added tab content HTML:`, contentHtml);

        // Load tab content when clicked
        html.find(`a[data-tab="${this.tabId}"]`).on('click', async () => {
            console.log(`🖱️ BBTTCC tab clicked for ${app.actor.name}`);
            await this.loadTabContent(app.actor, html.find(`.tab[data-tab="${this.tabId}"] .bbttcc-tikkun-content`));
        });

        console.log(`🎉 BBTTCC tab successfully added to ${app.actor.name}'s character sheet`);
    }

    // Add constellation generation button for GMs
    addConstellationGenerationButton(app, html) {
        const tabs = html.find('.sheet-tabs[data-group="primary"]');
        if (tabs.length === 0) return;

        tabs.append(`<a class="item bbttcc-generate-constellation" data-tooltip="Generate Spark Constellation">
            <i class="fas fa-star-of-david"></i> Generate Constellation
        </a>`);

        html.find('.bbttcc-generate-constellation').on('click', async () => {
            const api = game.modules.get('bbttcc-tikkun')?.api;
            if (api) {
                const result = await api.generateConstellation(app.actor);
                if (result) {
                    ui.notifications.info(`Constellation generated for ${app.actor.name}`);
                    app.render(); // Refresh sheet
                }
            }
        });
    }

    // Load and render tab content
    async loadTabContent(actor, contentElement) {
        const api = game.bbttccTikkun || game.modules.get('bbttcc-tikkun')?.api;

        // Get data from multiple sources
        const sparksData = api?.getSparks ? api.getSparks(actor) : null;
        const hasDirectSparks = actor.getFlag("bbttcc-tikkun", "sparks");
        const bbttccEnhancements = actor.flags?.bbttccEnhancements || actor.getFlag("bbttcc-territory", "bbttccEnhancements");

        // Create a unified data structure for display
        let displayData = {};

        if (sparksData) {
            displayData = sparksData;
        } else if (bbttccEnhancements) {
            // Convert bbttccEnhancements to display format
            displayData = {
                tikkunSparks: bbttccEnhancements.tikkunSparks || { conceptual: 0, emotional: 0, physical: 0 },
                radiationExposure: bbttccEnhancements.radiationExposure || { level: "None", effects: [] },
                raidExperience: bbttccEnhancements.raidExperience || { participated: 0, victories: 0, specializations: [] },
                territoryAffiliation: bbttccEnhancements.territoryAffiliation || "Independent"
            };
        } else if (hasDirectSparks || actor.getFlag("bbttcc-territory", "bbttccCharacter")) {
            // Create basic display from individual flags
            displayData = {
                tikkunSparks: {
                    conceptual: Math.floor((hasDirectSparks || 1) / 3),
                    emotional: Math.floor((hasDirectSparks || 1) / 3),
                    physical: (hasDirectSparks || 1) - (Math.floor((hasDirectSparks || 1) / 3) * 2)
                },
                radiationExposure: {
                    level: actor.getFlag("bbttcc-radiation", "points") > 0 ? "Low" : "None",
                    effects: []
                },
                raidExperience: {
                    participated: 0,
                    victories: 0,
                    specializations: [],
                    experience: actor.getFlag("bbttcc-raid", "experience") || 0
                },
                territoryAffiliation: actor.getFlag("bbttcc-territory", "faction") || "Independent"
            };
        }

        if (!displayData || Object.keys(displayData).length === 0) return;

        try {
            // Create simplified template data for display
            const templateData = {
                actor: actor,
                displayData: displayData,
                tikkunSparks: displayData.tikkunSparks || { conceptual: 0, emotional: 0, physical: 0 },
                radiationExposure: displayData.radiationExposure || { level: "None", effects: [] },
                raidExperience: displayData.raidExperience || { participated: 0, victories: 0, specializations: [] },
                territoryAffiliation: displayData.territoryAffiliation || "Independent",
                statusIcons: {
                    [BBTTCCTikkun.SPARK_STATUS.REQUIRED]: '⚫',
                    [BBTTCCTikkun.SPARK_STATUS.IDENTIFIED]: '🔍',
                    [BBTTCCTikkun.SPARK_STATUS.ACTIVE]: '✨',
                    [BBTTCCTikkun.SPARK_STATUS.GATHERED]: '🌟',
                    [BBTTCCTikkun.SPARK_STATUS.CORRUPTED]: '💀'
                },
                typeIcons: {
                    [BBTTCCTikkun.SPARK_TYPES.CONCEPTUAL]: '💭',
                    [BBTTCCTikkun.SPARK_TYPES.VESTIGIAL]: '📜',
                    [BBTTCCTikkun.SPARK_TYPES.ANIMATE]: '👤'
                }
            };

            // Create simple HTML content
            const html = this.createSimpleBBTTCCContent(templateData);
            contentElement.html(html);

        } catch (error) {
            BBTTCCTikkun.log(true, "Error loading tab content:", error);
            contentElement.html('<div class="error">Failed to load The Great Work content</div>');
        }
    }

    // Bind event handlers for tab interactions
    bindTabEvents(contentElement, actor, api) {
        // Spark click handlers for details
        contentElement.find('.spark-icon').on('click', async (event) => {
            const sparkId = event.currentTarget.dataset.sparkId;
            await this.showSparkDetails(sparkId, actor, api);
        });

        // Status change buttons (GM only)
        if (game.user.isGM) {
            contentElement.find('.spark-status-btn').on('click', async (event) => {
                const sparkId = event.currentTarget.dataset.sparkId;
                const newStatus = event.currentTarget.dataset.status;
                await api.updateSparkStatus(actor, sparkId, newStatus, {
                    entry: `Status manually changed by GM to ${newStatus}`
                });
                // Refresh tab
                await this.loadTabContent(actor, contentElement);
            });

            contentElement.find('.generate-hint-btn').on('click', (event) => {
                const sparkId = event.currentTarget.dataset.sparkId;
                this.generateQuestHint(sparkId, actor, api);
            });

            contentElement.find('.corrupt-spark-btn').on('click', async (event) => {
                const sparkId = event.currentTarget.dataset.sparkId;
                await this.showCorruptionDialog(sparkId, actor, api);
            });
        }

        // Constellation overview buttons
        contentElement.find('.repair-constellation-btn').on('click', async () => {
            const repaired = await api.repairSparks(actor);
            if (repaired) {
                ui.notifications.info("Constellation data repaired");
                await this.loadTabContent(actor, contentElement);
            } else {
                ui.notifications.info("No repairs needed");
            }
        });

        contentElement.find('.export-constellation-btn').on('click', () => {
            this.exportConstellation(actor, api);
        });
    }

    // Show detailed spark information
    async showSparkDetails(sparkId, actor, api) {
        const spark = api.getSpark(actor, sparkId);
        if (!spark) return;

        const templateData = {
            spark: spark,
            actor: actor,
            canEdit: game.user.isGM,
            questHint: game.modules.get(BBTTCCTikkun.ID).constellation.generateQuestHints(spark)
        };

        const content = await renderTemplate(BBTTCCTikkun.TEMPLATES.SPARK_DETAILS, templateData);
        
        new Dialog({
            title: `${spark.name} (${spark.sephirah})`,
            content: content,
            buttons: {
                close: {
                    label: "Close",
                    callback: () => {}
                }
            },
            default: "close",
            width: 500,
            height: 400
        }).render(true);
    }

    // Generate and display quest hint
    generateQuestHint(sparkId, actor, api) {
        const spark = api.getSpark(actor, sparkId);
        if (!spark) return;

        const constellation = game.modules.get(BBTTCCTikkun.ID).constellation;
        const hint = constellation.generateQuestHints(spark);

        ChatMessage.create({
            content: `<div class="bbttcc-tikkun-hint">
                <h4>🔮 Divine Guidance</h4>
                <p><strong>${spark.name}</strong> whispers to <strong>${actor.name}</strong>:</p>
                <p><em>"${hint}"</em></p>
            </div>`,
            speaker: ChatMessage.getSpeaker({alias: "The Great Work"}),
            whisper: [game.user.id] // Only to GM
        });
    }

    // Show corruption dialog for manual corruption
    async showCorruptionDialog(sparkId, actor, api) {
        const spark = api.getSpark(actor, sparkId);
        if (!spark || spark.status === BBTTCCTikkun.SPARK_STATUS.CORRUPTED) return;

        const content = `<form>
            <div class="form-group">
                <label>Corruption Reason:</label>
                <input type="text" name="reason" placeholder="Why was this spark corrupted?" />
            </div>
            <div class="form-group">
                <label>Purification Quest:</label>
                <textarea name="purificationQuest" placeholder="What must be done to purify this spark?"></textarea>
            </div>
            <div class="form-group">
                <label>Effect:</label>
                <input type="text" name="effect" placeholder="Mechanical effect of corruption" />
            </div>
        </form>`;

        new Dialog({
            title: `Corrupt ${spark.name}`,
            content: content,
            buttons: {
                corrupt: {
                    label: "Corrupt Spark",
                    callback: async (html) => {
                        const formData = new FormData(html[0].querySelector('form'));
                        await api.updateSparkStatus(actor, sparkId, BBTTCCTikkun.SPARK_STATUS.CORRUPTED, {
                            reason: formData.get('reason') || "Manually corrupted by GM",
                            effect: formData.get('effect') || "Unknown corruption effect", 
                            purificationQuest: formData.get('purificationQuest') || "Seek redemption through righteous action",
                            entry: "Spark corrupted by GM action"
                        });
                        ui.notifications.warn(`${spark.name} has been corrupted`);
                    }
                },
                cancel: {
                    label: "Cancel",
                    callback: () => {}
                }
            },
            default: "cancel"
        }).render(true);
    }

    // Export constellation data
    exportConstellation(actor, api) {
        const sparksData = api.getSparks(actor);
        if (!sparksData) return;

        const constellation = game.modules.get(BBTTCCTikkun.ID).constellation;
        const exportData = constellation.exportConstellation(sparksData.sparks);
        
        const filename = `${actor.name.replace(/[^a-z0-9]/gi, '_')}_constellation.json`;
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = filename;
        link.click();
        
        ui.notifications.info(`Constellation exported: ${filename}`);
    }

    // Refresh tab content for actor
    async refreshTab(actor) {
        const sheet = actor.sheet;
        if (!sheet || !sheet.rendered) return;

        const contentElement = sheet.element.find(`.tab[data-tab="${this.tabId}"] .bbttcc-tikkun-content`);
        if (contentElement.length > 0) {
            await this.loadTabContent(actor, contentElement);
        }
    }

    // Add context menu options to spark icons
    addSparkContextMenu(contentElement, actor, api) {
        if (!game.user.isGM) return;

        new ContextMenu(contentElement, '.spark-icon', [
            {
                name: "Identify Spark",
                icon: '<i class="fas fa-search"></i>',
                condition: (li) => {
                    const sparkId = li.data('spark-id');
                    const spark = api.getSpark(actor, sparkId);
                    return spark?.status === BBTTCCTikkun.SPARK_STATUS.REQUIRED;
                },
                callback: async (li) => {
                    const sparkId = li.data('spark-id');
                    await api.updateSparkStatus(actor, sparkId, BBTTCCTikkun.SPARK_STATUS.IDENTIFIED, {
                        entry: "Spark nature revealed through investigation"
                    });
                    await this.loadTabContent(actor, contentElement);
                }
            },
            {
                name: "Activate Quest",
                icon: '<i class="fas fa-play"></i>',
                condition: (li) => {
                    const sparkId = li.data('spark-id');
                    const spark = api.getSpark(actor, sparkId);
                    return spark?.status === BBTTCCTikkun.SPARK_STATUS.IDENTIFIED;
                },
                callback: async (li) => {
                    const sparkId = li.data('spark-id');
                    await api.updateSparkStatus(actor, sparkId, BBTTCCTikkun.SPARK_STATUS.ACTIVE, {
                        entry: "Quest for this spark has begun"
                    });
                    await this.loadTabContent(actor, contentElement);
                }
            },
            {
                name: "Generate Hint",
                icon: '<i class="fas fa-lightbulb"></i>',
                callback: (li) => {
                    const sparkId = li.data('spark-id');
                    this.generateQuestHint(sparkId, actor, api);
                }
            }
        ]);
    }

    // Create simple BBTTCC content HTML
    createSimpleBBTTCCContent(templateData) {
        const tikkunSparks = templateData.tikkunSparks;
        const radiationExposure = templateData.radiationExposure;
        const raidExperience = templateData.raidExperience;
        const territoryAffiliation = templateData.territoryAffiliation;

        return `
            <div class="bbttcc-content" style="padding: 20px;">
                <h2 style="border-bottom: 2px solid #b5860b; padding-bottom: 10px; margin-bottom: 20px;">
                    <i class="fas fa-star"></i> BBTTCC Profile
                </h2>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div class="bbttcc-section">
                        <h3 style="color: #b5860b; margin-bottom: 10px;">
                            <i class="fas fa-flag"></i> Territory Affiliation
                        </h3>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #b5860b;">
                            <strong>${territoryAffiliation}</strong>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                                Current faction allegiance
                            </div>
                        </div>
                    </div>

                    <div class="bbttcc-section">
                        <h3 style="color: #b5860b; margin-bottom: 10px;">
                            <i class="fas fa-radiation"></i> Radiation Exposure
                        </h3>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid ${radiationExposure.level === 'None' ? '#28a745' : '#dc3545'};">
                            <strong>${radiationExposure.level}</strong>
                            <div style="font-size: 12px; color: #666; margin-top: 5px;">
                                ${radiationExposure.effects.length > 0 ? radiationExposure.effects.join(', ') : 'No radiation effects'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tikkun-sparks-section" style="margin-bottom: 20px;">
                    <h3 style="color: #ffd700; margin-bottom: 15px;">
                        <i class="fas fa-star"></i> Tikkun Sparks
                    </h3>
                    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; border-radius: 10px; border: 2px solid #ffd700;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; text-align: center;">
                            <div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 8px; border: 1px solid #ffd700;">
                                <div style="color: #ffd700; font-size: 18px; margin-bottom: 5px;">💭</div>
                                <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Conceptual</div>
                                <div style="color: #ffd700; font-size: 24px; font-weight: bold;">${tikkunSparks.conceptual || 0}</div>
                            </div>
                            <div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 8px; border: 1px solid #ffd700;">
                                <div style="color: #ffd700; font-size: 18px; margin-bottom: 5px;">❤️</div>
                                <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Emotional</div>
                                <div style="color: #ffd700; font-size: 24px; font-weight: bold;">${tikkunSparks.emotional || 0}</div>
                            </div>
                            <div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 8px; border: 1px solid #ffd700;">
                                <div style="color: #ffd700; font-size: 18px; margin-bottom: 5px;">⚡</div>
                                <div style="color: #fff; font-weight: bold; margin-bottom: 5px;">Physical</div>
                                <div style="color: #ffd700; font-size: 24px; font-weight: bold;">${tikkunSparks.physical || 0}</div>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 15px; color: #ccc; font-size: 12px;">
                            Total: ${(tikkunSparks.conceptual || 0) + (tikkunSparks.emotional || 0) + (tikkunSparks.physical || 0)} Sparks
                        </div>
                    </div>
                </div>

                <div class="raid-experience-section">
                    <h3 style="color: #6f42c1; margin-bottom: 10px;">
                        <i class="fas fa-sword"></i> Raid Experience
                    </h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #6f42c1;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <div><strong>Raids:</strong> ${raidExperience.participated || 0}</div>
                            <div><strong>Victories:</strong> ${raidExperience.victories || 0}</div>
                        </div>
                        ${raidExperience.experience ? `<div><strong>Experience:</strong> ${raidExperience.experience} XP</div>` : ''}
                        ${raidExperience.specializations && raidExperience.specializations.length > 0 ?
                            `<div style="margin-top: 10px;"><strong>Specializations:</strong><br>
                            <span style="font-style: italic;">${raidExperience.specializations.join(', ')}</span></div>` : ''
                        }
                    </div>
                </div>
            </div>
        `;
    }
}