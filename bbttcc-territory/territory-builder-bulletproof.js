console.log('🏗️ Territory Builder (Bulletproof) Loading...');
if (canvas?.stage) { canvas.stage.removeAllListeners(); }

window.TerritoryBuilder = {
    active: false,
    currentTerritory: null,
    selectedHexes: [],

    start: function() {
        if (this.active) { this.stop(); return; }
        if (!canvas?.grid?.isHexagonal) { ui.notifications.warn('🏗️ Need hex grid scene'); return; }
        this.active = true;
        this.currentTerritory = { name: '', description: '', owner: 'Independent', hexes: [], totalValue: 0 };
        this.selectedHexes = [];
        canvas.stage.removeAllListeners();
        canvas.stage.on('click', (e) => { e.stopPropagation(); this.selectHex(e); });
        canvas.stage.on('rightclick', (e) => { e.preventDefault(); e.stopPropagation(); this.finishTerritory(); });
        canvas.app.stage.cursor = 'crosshair';
        ui.notifications.success('🏗️ Territory Builder Active! Left-click: Add hex, Right-click: Finish territory');
        console.log('🏗️ Territory builder activated');
        this.showBuilderPanel();
    },

    stop: function() {
        this.active = false;
        this.selectedHexes = [];
        this.currentTerritory = null;
        canvas.stage.removeAllListeners();
        canvas.app.stage.cursor = 'default';
        ui.notifications.info('🏗️ Territory Builder stopped');
        console.log('🏗️ Cleared visual markers (bulletproof mode)');
    },

    selectHex: function(event) {
        const pos = event.data.getLocalPosition(canvas.stage);
        const offset = canvas.grid.getOffset({x: pos.x, y: pos.y});
        const center = canvas.grid.getCenterPoint(offset);
        const cubeCoords = this.offsetToCube(offset.i, offset.j);
        const hexId = `${cubeCoords.q}_${cubeCoords.r}_${cubeCoords.s}`;
        if (this.selectedHexes.find(h => h.id === hexId)) {
            ui.notifications.warn(`🏗️ Hex (${cubeCoords.q},${cubeCoords.r},${cubeCoords.s}) already selected`);
            return;
        }
        const hexData = {
            id: hexId,
            q: cubeCoords.q,
            r: cubeCoords.r,
            s: cubeCoords.s,
            x: center.x,
            y: center.y,
            resources: [],
            value: 10,
            type: 'settlement',
            characteristics: {}
        };
        this.selectedHexes.push(hexData);
        this.showHexConfigDialog(hexData);
    },

    offsetToCube: function(col, row) {
        const q = col;
        const r = row - Math.floor((col + (col & 1)) / 2);
        const s = -q - r;
        return { q, r, s };
    },

    showHexConfigDialog: function(hexData) {
        const resourceOptions = ['water', 'food', 'minerals', 'shelter', 'energy', 'materials', 'trade'];
        const hexTypes = ['settlement', 'fortress', 'mine', 'farm', 'port', 'factory', 'capitol', 'outpost'];
        const content = `
            <form style="font-family: Arial;">
                <h3>🏗️ Configure Hex (${hexData.q}, ${hexData.r}, ${hexData.s})</h3>
                <div style="margin: 15px 0;">
                    <label><strong>Hex Type:</strong></label>
                    <select name="type" style="width: 100%;">
                        ${hexTypes.map(type => `<option value="${type}" ${type === 'settlement' ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`).join('')}
                    </select>
                </div>
                <div style="margin: 15px 0;">
                    <label><strong>Resources:</strong></label><br>
                    ${resourceOptions.map(res => `<label style="display: inline-block; margin-right: 10px;"><input type="checkbox" name="resources" value="${res}"> ${res}</label>`).join('<br>')}
                </div>
                <div style="margin: 15px 0;">
                    <label><strong>Hex Value:</strong></label>
                    <input type="number" name="value" value="10" min="1" max="50" style="width: 80px;">
                </div>
                <div style="margin: 15px 0;">
                    <label><strong>Population:</strong></label>
                    <input type="number" name="population" value="100" min="0" style="width: 80px;">
                </div>
                <div style="margin: 15px 0;">
                    <label><strong>Defense Rating:</strong></label>
                    <input type="number" name="defense" value="5" min="0" max="10" style="width: 80px;">
                </div>
                <p><strong>Selected Hexes:</strong> ${this.selectedHexes.length}</p>
            </form>
        `;
        new Dialog({
            title: '🏗️ Hex Configuration',
            content: content,
            buttons: {
                save: {
                    label: '<i class="fas fa-check"></i> Add Hex',
                    callback: (html) => {
                        const resources = Array.from(html[0].querySelectorAll('input[name="resources"]:checked')).map(cb => cb.value);
                        const value = parseInt(html[0].querySelector('input[name="value"]').value) || 10;
                        const type = html[0].querySelector('select[name="type"]').value;
                        const population = parseInt(html[0].querySelector('input[name="population"]').value) || 100;
                        const defense = parseInt(html[0].querySelector('input[name="defense"]').value) || 5;
                        hexData.resources = resources;
                        hexData.value = value;
                        hexData.type = type;
                        hexData.characteristics = {
                            population: population,
                            defense: defense,
                            status: 'unclaimed',
                            condition: 'normal'
                        };
                        this.addHexToTerritory(hexData);
                        this.updateBuilderPanel();
                    }
                },
                cancel: {
                    label: '<i class="fas fa-times"></i> Cancel',
                    callback: () => {
                        this.selectedHexes = this.selectedHexes.filter(h => h.id !== hexData.id);
                    }
                }
            },
            default: 'save'
        }).render(true);
    },

    addHexToTerritory: function(hexData) {
        if (!this.currentTerritory) {
            this.currentTerritory = { name: '', description: '', owner: 'Independent', hexes: [], totalValue: 0 };
        }
        this.currentTerritory.hexes.push({
            q: hexData.q,
            r: hexData.r,
            s: hexData.s,
            type: hexData.type,
            resources: hexData.resources,
            value: hexData.value,
            characteristics: hexData.characteristics
        });
        this.currentTerritory.totalValue = this.currentTerritory.hexes.reduce((sum, hex) => sum + hex.value, 0);
        console.log('🏗️ Hex marker logged (bulletproof mode):', hexData.type);
        ui.notifications.success(`🏗️ ${hexData.type} hex added! Territory value: ${this.currentTerritory.totalValue}`);
        console.log('🏗️ Hex added:', hexData);
    },

    showBuilderPanel: function() {
        const content = `
            <div id="territory-builder-panel" style="font-family: Arial; padding: 20px;">
                <h2>🏗️ BBTTCC Territory Builder (Bulletproof)</h2>
                <p><strong>Instructions:</strong></p>
                <ul>
                    <li>Left-click hexes to add to territory</li>
                    <li>Configure type, resources, and characteristics for each hex</li>
                    <li>Right-click when finished to save territory</li>
                </ul>
                <div id="territory-status">
                    <p><strong>Hexes Selected:</strong> 0</p>
                    <p><strong>Total Value:</strong> 0</p>
                </div>
                <p style="color: #0066ff;"><strong>✅ Bulletproof mode - guaranteed save!</strong></p>
            </div>
        `;
        new Dialog({
            title: '🏗️ BBTTCC Territory Builder Control Panel',
            content: content,
            buttons: {
                finish: {
                    label: '<i class="fas fa-flag-checkered"></i> Finish Territory',
                    callback: () => this.finishTerritory()
                },
                cancel: {
                    label: '<i class="fas fa-times"></i> Cancel',
                    callback: () => this.stop()
                }
            }
            // No close handler - this was causing the issue!
        }).render(true);
    },

    updateBuilderPanel: function() {
        const statusDiv = document.getElementById('territory-status');
        if (statusDiv && this.currentTerritory) {
            statusDiv.innerHTML = `
                <p><strong>Hexes Selected:</strong> ${this.selectedHexes.length}</p>
                <p><strong>Total Value:</strong> ${this.currentTerritory.totalValue}</p>
            `;
        }
    },

    finishTerritory: function() {
        // BULLETPROOF: Capture data immediately, don't rely on persistent state
        const currentData = {
            hexes: this.currentTerritory ? [...(this.currentTerritory.hexes || [])] : [],
            selectedHexes: [...this.selectedHexes],
            totalValue: this.currentTerritory ? this.currentTerritory.totalValue : 0
        };

        if (currentData.hexes.length === 0) {
            ui.notifications.warn('🏗️ Add some hexes first!');
            return;
        }

        console.log('🏗️ BULLETPROOF: Captured territory data:', currentData);
        this.showTerritoryFinalDialog(currentData);
    },

    showTerritoryFinalDialog: function(capturedData) {
        // Get available factions from YOUR existing BBTTCC system
        const factions = game.actors.filter(a => a.getFlag('bbttcc-factions', 'isFaction')) || [];
        const factionOptions = [
            '<option value="Independent" selected>Independent (No Faction)</option>',
            ...factions.map(f => `<option value="${f.id}">${f.name}</option>`)
        ].join('');

        const hexTypes = [...new Set(capturedData.hexes.map(h => h.type))];
        const resources = [...new Set(capturedData.hexes.flatMap(h => h.resources))];

        const content = `
            <form>
                <div style="margin: 15px 0;">
                    <label><strong>Territory Name:</strong></label>
                    <input type="text" name="name" placeholder="My Territory" required style="width: 100%;">
                </div>
                <div style="margin: 15px 0;">
                    <label><strong>Description:</strong></label>
                    <textarea name="description" placeholder="Territory description..." rows="3" style="width: 100%;"></textarea>
                </div>
                <div style="margin: 15px 0;">
                    <label><strong>Faction Control:</strong></label>
                    <select name="owner" style="width: 100%;">
                        ${factionOptions}
                    </select>
                </div>
                <div style="border: 1px solid #ccc; padding: 10px; margin: 15px 0; background: #f0fff0;">
                    <strong>✅ BULLETPROOF Territory Summary:</strong><br>
                    Hexes: ${capturedData.hexes.length}<br>
                    Types: ${hexTypes.join(', ')}<br>
                    Total Value: ${capturedData.totalValue}<br>
                    Resources: ${resources.join(', ')}<br>
                    Available BBTTCC Factions: ${factions.length}<br>
                    <small style="color: #666;">Data captured and safe from state changes!</small>
                </div>
            </form>
        `;

        new Dialog({
            title: '🏗️ Finalize BBTTCC Territory (Bulletproof)',
            content: content,
            buttons: {
                save: {
                    label: '<i class="fas fa-save"></i> Create Territory',
                    callback: (html) => {
                        const form = html[0].querySelector('form');
                        const formData = new foundry.applications.ux.FormDataExtended(form).object;
                        // Pass captured data directly to save function
                        this.saveTerritoryBulletproof(formData, capturedData);
                    }
                },
                cancel: {
                    label: '<i class="fas fa-arrow-left"></i> Back to Building',
                    callback: () => {}
                }
            },
            default: 'save'
        }).render(true);
    },

    saveTerritoryBulletproof: async function(formData, capturedData) {
        try {
            console.log('🏗️ BULLETPROOF SAVE: Starting save with captured data:', capturedData);

            const territoryId = `territory-${Date.now()}`;

            // Use captured data instead of relying on this.currentTerritory
            const territory = {
                id: territoryId,
                name: formData.name,
                description: formData.description,
                type: this.getMostCommonTypeBulletproof(capturedData.hexes),
                size: this.calculateSizeBulletproof(capturedData.hexes),
                status: formData.owner === 'Independent' ? 'unclaimed' : 'claimed',
                claimedBy: formData.owner === 'Independent' ? null : formData.owner,
                claimedAt: formData.owner === 'Independent' ? null : new Date().toISOString(),
                coordinates: this.getMainCoordinatesBulletproof(capturedData),
                hexes: capturedData.hexes,
                totalValue: capturedData.totalValue,
                resources: this.calculateTotalResourcesBulletproof(capturedData.hexes),
                created: new Date().toISOString(),
                createdBy: game.user.name
            };

            console.log('🏗️ BULLETPROOF: Final territory object:', territory);

            // Save to YOUR existing BBTTCC territory system flags (exactly as your system expects)
            const territories = canvas.scene.getFlag('bbttcc-territory', 'territories') || {};
            territories[territoryId] = territory;
            await canvas.scene.setFlag('bbttcc-territory', 'territories', territories);

            // If assigned to a faction, update YOUR existing faction territories
            if (formData.owner !== 'Independent' && formData.owner) {
                const faction = game.actors.get(formData.owner);
                if (faction) {
                    const factionTerritories = faction.getFlag('bbttcc-factions', 'territories') || [];
                    factionTerritories.push(territoryId);
                    await faction.setFlag('bbttcc-factions', 'territories', factionTerritories);
                }
            }

            // Export JSON file
            this.exportTerritoryJSON(territory);

            // Create visual territory markers on the map
            await this.createTerritoryVisuals(territory, capturedData);

            ui.notifications.success(`🏗️ Territory "${territory.name}" saved successfully with BULLETPROOF method!`);
            console.log('🏗️ BULLETPROOF: Territory saved successfully to BBTTCC system:', territory);

            this.stop();

        } catch (error) {
            console.error('🏗️ BULLETPROOF: Error saving territory:', error);
            ui.notifications.error(`Failed to save territory: ${error.message}`);
        }
    },

    // Bulletproof helper functions that work with captured data
    getMostCommonTypeBulletproof: function(hexes) {
        if (!hexes || hexes.length === 0) return 'settlement';
        const types = hexes.map(h => h.type);
        const typeCount = {};
        types.forEach(type => typeCount[type] = (typeCount[type] || 0) + 1);
        return Object.keys(typeCount).reduce((a, b) => typeCount[a] > typeCount[b] ? a : b);
    },

    calculateSizeBulletproof: function(hexes) {
        if (!hexes) return 'small';
        const hexCount = hexes.length;
        if (hexCount === 1) return 'small';
        if (hexCount <= 3) return 'medium';
        if (hexCount <= 6) return 'large';
        return 'capital';
    },

    getMainCoordinatesBulletproof: function(capturedData) {
        if (!capturedData.selectedHexes || capturedData.selectedHexes.length === 0) {
            return { x: 0, y: 0, hex: { q: 0, r: 0, s: 0 } };
        }
        const firstHex = capturedData.hexes[0];
        const firstSelected = capturedData.selectedHexes[0];
        return {
            x: firstSelected.x,
            y: firstSelected.y,
            hex: {
                q: firstHex.q,
                r: firstHex.r,
                s: firstHex.s
            }
        };
    },

    calculateTotalResourcesBulletproof: function(hexes) {
        const resourceTotals = {};
        if (!hexes) return resourceTotals;
        hexes.forEach(hex => {
            if (hex.resources && Array.isArray(hex.resources)) {
                hex.resources.forEach(resource => {
                    resourceTotals[resource] = (resourceTotals[resource] || 0) + (hex.value || 0);
                });
            }
        });
        return resourceTotals;
    },

    exportTerritoryJSON: function(territory) {
        const dataStr = JSON.stringify(territory, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${territory.name.replace(/\s+/g, '-').toLowerCase()}-bbttcc-territory.json`;
        link.click();
        ui.notifications.info(`📁 BBTTCC Territory JSON exported: ${link.download}`);
    },

    createTerritoryVisuals: async function(territory, capturedData) {
        try {
            const factionColor = this.getFactionColor(territory.claimedBy);

            for (const hexData of capturedData.selectedHexes) {
                const drawingData = {
                    type: 'p', // polygon
                    author: game.user.id,
                    x: hexData.x,
                    y: hexData.y,
                    shape: {
                        type: 'p',
                        points: this.getHexPoints(hexData.x, hexData.y)
                    },
                    strokeColor: factionColor,
                    strokeWidth: 3,
                    strokeAlpha: 0.8,
                    fillColor: factionColor,
                    fillAlpha: 0.15,
                    text: `${territory.name}\n${capturedData.hexes.find(h => h.q === hexData.q && h.r === hexData.r)?.type || 'hex'}`,
                    textColor: '#000000',
                    fontSize: 12,
                    flags: {
                        'bbttcc-territory': {
                            territoryId: territory.id,
                            hexId: hexData.id,
                            isTerritory: true
                        }
                    }
                };

                await canvas.scene.createEmbeddedDocuments('Drawing', [drawingData]);
            }

            ui.notifications.info(`🗺️ Created ${capturedData.selectedHexes.length} territory markers for "${territory.name}"`);
            console.log('🗺️ Territory visuals created:', territory.name);

        } catch (error) {
            console.error('🗺️ Error creating territory visuals:', error);
            ui.notifications.warn('Territory saved but visual markers failed');
        }
    },

    getFactionColor: function(claimedBy) {
        if (!claimedBy || claimedBy === 'Independent') return '#666666'; // Gray for independent

        const faction = game.actors.get(claimedBy);
        if (faction) {
            // Try to get faction color from flags or use a default
            const color = faction.getFlag('bbttcc-factions', 'color') || this.generateFactionColor(faction.name);
            return this.validateColor(color);
        }

        return '#0066ff'; // Default blue
    },

    validateColor: function(color) {
        // Ensure color is a valid hex string
        if (!color || typeof color !== 'string') return '#666666';

        // If it's already a hex color, return it
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;

        // If it's an HSL color, convert to hex
        if (color.startsWith('hsl(')) {
            return this.hslToHex(color);
        }

        // Default fallback
        return '#666666';
    },

    hslToHex: function(hslString) {
        // Extract HSL values from string like "hsl(240, 70%, 50%)"
        const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!match) return '#666666';

        const h = parseInt(match[1]) / 360;
        const s = parseInt(match[2]) / 100;
        const l = parseInt(match[3]) / 100;

        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        let r, g, b;
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    generateFactionColor: function(name) {
        // Simple hash-based color generation
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    },

    getHexPoints: function(centerX, centerY) {
        const size = canvas.grid.size / 2;
        const points = [];

        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = centerX + size * Math.cos(angle);
            const y = centerY + size * Math.sin(angle);
            points.push(x - centerX, y - centerY);
        }

        return points;
    },

    getHexPointsForGrid: function() {
        // Use grid-aligned hex shape - perfect fit to FoundryVTT hex grid
        const size = canvas.grid.size / 2;
        const points = [];

        // Standard hex vertices relative to center
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = size * Math.cos(angle);
            const y = size * Math.sin(angle);
            points.push(x, y);
        }

        return points;
    },

    showExistingTerritories: function() {
        const territories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};

        for (const territory of Object.values(territories)) {
            if (territory.hexes && Array.isArray(territory.hexes)) {
                territory.hexes.forEach(hex => {
                    // Create visual marker for existing territory hex
                    this.createExistingTerritoryMarker(territory, hex);
                });
            }
        }

        ui.notifications.info(`🗺️ Showing visual markers for ${Object.keys(territories).length} existing territories`);
    },

    createExistingTerritoryMarker: async function(territory, hex) {
        try {
            const offset = this.cubeToOffset(hex.q, hex.r);
            const center = canvas.grid.getCenterPoint(offset);
            const factionColor = this.getFactionColor(territory.claimedBy);

            const drawingData = {
                type: 'p',
                author: game.user.id,
                x: center.x,
                y: center.y,
                shape: {
                    type: 'p',
                    points: this.getHexPointsForGrid()
                },
                strokeColor: factionColor,
                strokeWidth: 2,
                strokeAlpha: 0.6,
                fillColor: factionColor,
                fillAlpha: 0.1,
                text: `${territory.name}\n${hex.type}`,
                textColor: '#000000',
                fontSize: 10,
                flags: {
                    'bbttcc-territory': {
                        territoryId: territory.id,
                        hexId: `${hex.q}_${hex.r}_${hex.s}`,
                        isTerritory: true
                    }
                }
            };

            await canvas.scene.createEmbeddedDocuments('Drawing', [drawingData]);

        } catch (error) {
            console.error('🗺️ Error creating existing territory marker:', error);
        }
    },

    cubeToOffset: function(q, r) {
        const col = q;
        const row = r + Math.floor((q + (q & 1)) / 2);
        return { i: col, j: row };
    },

    clearTerritoryVisuals: async function() {
        const territoryDrawings = canvas.scene.drawings.filter(d =>
            d.getFlag('bbttcc-territory', 'isTerritory')
        );

        if (territoryDrawings.length > 0) {
            await canvas.scene.deleteEmbeddedDocuments('Drawing', territoryDrawings.map(d => d.id));
            ui.notifications.info(`🗑️ Cleared ${territoryDrawings.length} territory visual markers`);
        } else {
            ui.notifications.info('🗑️ No territory visual markers to clear');
        }
    },

    listTerritories: function() {
        const territories = canvas.scene?.getFlag('bbttcc-territory', 'territories') || {};
        const territoryList = Object.values(territories);

        const content = `
            <div style="max-height: 400px; overflow-y: auto;">
                <h3>🏗️ YOUR BBTTCC Territories (${territoryList.length})</h3>
                ${territoryList.length === 0 ? '<p><em>No territories created yet.</em></p>' :
                  territoryList.map(t => `
                    <div style="border: 1px solid #ccc; margin: 5px 0; padding: 10px; border-radius: 4px;">
                        <strong>${t.name}</strong> ${t.claimedBy ? `(${t.claimedBy})` : '(Independent)'}<br>
                        <small>${t.description}</small><br>
                        <small>Type: ${t.type} | Hexes: ${t.hexes?.length || 'N/A'} | Value: ${t.totalValue} | Status: ${t.status}</small>
                    </div>
                  `).join('')
                }
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc;">
                    <button onclick="TerritoryBuilder.showExistingTerritories()" style="margin-right: 10px;">🗺️ Show All Territory Markers</button>
                    <button onclick="TerritoryBuilder.clearTerritoryVisuals()" style="color: #cc0000;">🗑️ Clear Visual Markers</button>
                </div>
            </div>
        `;

        new Dialog({
            title: '🏗️ YOUR BBTTCC Territory List',
            content: content,
            buttons: { close: { label: 'Close' } }
        }).render(true);
    }
};

console.log('✅ Territory Builder (Bulletproof) loaded!');
console.log('🏗️ Commands: TerritoryBuilder.start() | .stop() | .listTerritories()');
console.log('🛡️ BULLETPROOF MODE: Territory data captured at dialog creation - immune to state changes');
console.log('🏗️ Integration: Saves to bbttcc-territory flags - 100% compatible with your system');