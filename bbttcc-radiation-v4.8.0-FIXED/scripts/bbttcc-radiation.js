/**
 * BBTTCC Radiation Exposure Module v4.8.0 - FIXED
 * Real-time radiation tracking with modern FoundryVTT v13+ compatibility
 * Uses game.modules.get().api pattern instead of window objects
 */

import { RadiationTracker } from './radiation-tracker.js';

// Radiation levels and their effects
const RADIATION_LEVELS = {
    safe: { name: 'Safe', min: 0, max: 25, color: '#27ae60' },
    low: { name: 'Low', min: 26, max: 100, color: '#f1c40f' },
    moderate: { name: 'Moderate', min: 101, max: 300, color: '#f39c12' },
    high: { name: 'High', min: 301, max: 600, color: '#e74c3c' },
    severe: { name: 'Severe', min: 601, max: 1000, color: '#8e44ad' },
    lethal: { name: 'Lethal', min: 1001, max: 10000, color: '#2c3e50' }
};

// Common radiation sources
const RADIATION_SOURCES = {
    background: { name: 'Background Radiation', exposure: 1 },
    contaminated_water: { name: 'Contaminated Water', exposure: 25 },
    radioactive_materials: { name: 'Radioactive Materials', exposure: 50 },
    reactor_leak: { name: 'Reactor Leak', exposure: 100 },
    nuclear_fallout: { name: 'Nuclear Fallout', exposure: 200 },
    reactor_core: { name: 'Reactor Core', exposure: 500 }
};

/**
 * Initialize the BBTTCC Radiation module
 */
Hooks.once('init', () => {
    console.log('BBTTCC Radiation | Initializing v4.8.0...');
    
    // Register settings
    game.settings.register('bbttcc-radiation', 'backgroundRadiation', {
        name: 'Background Radiation Level',
        hint: 'Base radiation level for the campaign world',
        scope: 'world',
        config: true,
        type: Number,
        default: 1,
        range: {
            min: 0,
            max: 100,
            step: 1
        }
    });
    
    game.settings.register('bbttcc-radiation', 'showVisualIndicators', {
        name: 'Show Visual Radiation Indicators',
        hint: 'Display color-coded radiation levels on character sheets',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });
    
    game.settings.register('bbttcc-radiation', 'enableAutomaticDecay', {
        name: 'Enable Automatic Radiation Decay',
        hint: 'Gradually reduce radiation exposure over time',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
    
    console.log('BBTTCC Radiation | Settings registered');
});

/**
 * Setup hook for final initialization
 */
Hooks.once('ready', () => {
    console.log('BBTTCC Radiation | Ready hook fired');
    
    // Expose modern API via game.modules pattern
    const module = game.modules.get('bbttcc-radiation');
    if (module) {
        module.api = {
            addRadiationExposure: addRadiationExposure,
            setRadiationLevel: setRadiationLevel,
            getRadiationLevel: getRadiationLevel,
            exposeActor: exposeActor,
            createRadiationZone: createRadiationZone,
            RadiationTracker: RadiationTracker,
            RADIATION_LEVELS: RADIATION_LEVELS,
            RADIATION_SOURCES: RADIATION_SOURCES,
            version: '4.8.0'
        };
        console.log('BBTTCC Radiation | API exposed via game.modules.get("bbttcc-radiation").api');
    }
    
    // Also maintain legacy compatibility temporarily
    window.BBTTCCRadiation = {
        addRadiationExposure: addRadiationExposure,
        exposeActor: exposeActor,
        getRadiationLevel: getRadiationLevel,
        version: '4.8.0'
    };
    
    // Initialize global radiation system
    game.bbttcc = game.bbttcc || {};
    game.bbttcc.radiation = {
        addRadiationExposure: addRadiationExposure,
        setRadiationLevel: setRadiationLevel,
        getRadiationLevel: getRadiationLevel,
        exposeActor: exposeActor,
        createRadiationZone: createRadiationZone
    };
    
    // Initialize radiation tracking for existing characters
    initializeRadiationTracking();
    
    console.log('BBTTCC Radiation | Module ready v4.8.0');
});

/**
 * Hook to add radiation resource to character sheets
 */
Hooks.on('renderActorSheet5eCharacter', (sheet, html, data) => {
    if (!game.settings.get('bbttcc-radiation', 'showVisualIndicators')) return;
    
    const actor = sheet.actor;
    const radiation = actor.system.resources?.tertiary;
    
    if (radiation && radiation.label === 'Radiation') {
        addRadiationVisualIndicators(html, radiation.value);
    }
});

/**
 * Initialize radiation tracking for all character actors
 */
async function initializeRadiationTracking() {
    for (const actor of game.actors) {
        if (actor.type === 'character') {
            await ensureRadiationResource(actor);
        }
    }
}

/**
 * Ensure actor has radiation resource configured
 */
async function ensureRadiationResource(actor) {
    if (actor.type !== 'character') return;
    
    const tertiary = actor.system.resources?.tertiary;
    
    if (!tertiary || tertiary.label !== 'Radiation') {
        await actor.update({
            'system.resources.tertiary': {
                value: 0,
                max: 10000,
                label: 'Radiation',
                sr: false,
                lr: false
            }
        });
        
        console.log(`BBTTCC Radiation | Initialized radiation tracking for ${actor.name}`);
    }
}

/**
 * Add radiation exposure to an actor
 */
async function addRadiationExposure(actor, exposure, source = 'unknown') {
    try {
        console.log(`BBTTCC Radiation | Adding exposure to ${actor.name}:`, { exposure, source });
        
        if (actor.type !== 'character') {
            throw new Error('Radiation exposure can only be applied to character actors');
        }
        
        // Ensure radiation resource exists
        await ensureRadiationResource(actor);
        
        const currentRadiation = actor.system.resources?.tertiary?.value || 0;
        const newLevel = Math.max(0, Math.min(10000, currentRadiation + exposure));
        
        // Update radiation level
        await actor.update({
            'system.resources.tertiary.value': newLevel
        });
        
        // Add exposure to history
        await addExposureHistory(actor, exposure, source);
        
        // Notify about radiation level change
        const radiationInfo = getRadiationLevel(newLevel);
        const message = exposure > 0 ? 
            `${actor.name} exposed to ${exposure} radiation (${radiationInfo.name})` :
            `${actor.name} radiation reduced by ${Math.abs(exposure)} (${radiationInfo.name})`;
            
        ui.notifications.info(message);
        
        console.log(`BBTTCC Radiation | Updated ${actor.name} radiation: ${currentRadiation} -> ${newLevel}`);
        
        return newLevel;
        
    } catch (error) {
        console.error('BBTTCC Radiation | Error adding radiation exposure:', error);
        ui.notifications.error(`Failed to add radiation exposure: ${error.message}`);
        throw error;
    }
}

/**
 * Set absolute radiation level for an actor
 */
async function setRadiationLevel(actor, level) {
    try {
        console.log(`BBTTCC Radiation | Setting radiation level for ${actor.name}:`, level);
        
        if (actor.type !== 'character') {
            throw new Error('Radiation level can only be set for character actors');
        }
        
        // Ensure radiation resource exists
        await ensureRadiationResource(actor);
        
        const clampedLevel = Math.max(0, Math.min(10000, level));
        
        await actor.update({
            'system.resources.tertiary.value': clampedLevel
        });
        
        const radiationInfo = getRadiationLevel(clampedLevel);
        ui.notifications.info(`${actor.name} radiation set to ${clampedLevel} (${radiationInfo.name})`);
        
        return clampedLevel;
        
    } catch (error) {
        console.error('BBTTCC Radiation | Error setting radiation level:', error);
        ui.notifications.error(`Failed to set radiation level: ${error.message}`);
        throw error;
    }
}

/**
 * Get radiation level information
 */
function getRadiationLevel(exposure) {
    for (const [key, level] of Object.entries(RADIATION_LEVELS)) {
        if (exposure >= level.min && exposure <= level.max) {
            return { ...level, key: key };
        }
    }
    
    // Handle values above maximum
    if (exposure > RADIATION_LEVELS.lethal.max) {
        return { 
            ...RADIATION_LEVELS.lethal, 
            key: 'lethal', 
            name: 'Extreme Lethal'
        };
    }
    
    return RADIATION_LEVELS.safe;
}

/**
 * Add exposure history to actor flags
 */
async function addExposureHistory(actor, exposure, source) {
    const history = actor.flags['bbttcc-radiation']?.exposureHistory || [];
    const newEntry = {
        id: foundry.utils.randomID(),
        exposure: exposure,
        source: source,
        timestamp: new Date().toISOString(),
        turn: game.combat?.round || 0
    };
    
    history.push(newEntry);
    
    // Keep only last 50 entries
    if (history.length > 50) {
        history.splice(0, history.length - 50);
    }
    
    await actor.update({
        'flags.bbttcc-radiation.exposureHistory': history
    });
}

/**
 * Expose actor to radiation via UI dialog
 */
async function exposeActor(actor) {
    if (!actor || actor.type !== 'character') {
        ui.notifications.warn('Please select a character actor');
        return;
    }
    
    // Create source options
    const sourceOptions = Object.entries(RADIATION_SOURCES).map(([key, source]) => 
        `<option value="${key}" data-exposure="${source.exposure}">${source.name} (${source.exposure})</option>`
    ).join('');
    
    const content = `
        <div class="bbttcc-radiation-dialog">
            <h4>Expose ${actor.name} to Radiation</h4>
            <div class="form-group">
                <label>Radiation Source:</label>
                <select id="radiation-source">
                    ${sourceOptions}
                    <option value="custom">Custom Amount</option>
                </select>
            </div>
            <div class="form-group" id="custom-exposure" style="display: none;">
                <label>Custom Exposure:</label>
                <input type="number" id="custom-amount" value="10" min="0" max="1000">
            </div>
            <div class="form-group">
                <label>Source Description:</label>
                <input type="text" id="source-description" placeholder="Optional description">
            </div>
            <div class="current-level">
                <strong>Current Level:</strong> ${actor.system.resources?.tertiary?.value || 0}
            </div>
        </div>
    `;
    
    new Dialog({
        title: "Radiation Exposure",
        content: content,
        buttons: {
            expose: {
                icon: '<i class="fas fa-radiation"></i>',
                label: "Expose",
                callback: async (html) => {
                    const sourceSelect = html.find('#radiation-source');
                    const customAmount = html.find('#custom-amount');
                    const sourceDescription = html.find('#source-description');
                    
                    let exposure = 0;
                    let source = '';
                    
                    if (sourceSelect.val() === 'custom') {
                        exposure = parseInt(customAmount.val()) || 0;
                        source = sourceDescription.val() || 'Custom exposure';
                    } else {
                        const selectedSource = RADIATION_SOURCES[sourceSelect.val()];
                        exposure = selectedSource.exposure;
                        source = sourceDescription.val() || selectedSource.name;
                    }
                    
                    if (exposure > 0) {
                        await addRadiationExposure(actor, exposure, source);
                    }
                }
            },
            reduce: {
                icon: '<i class="fas fa-medical-briefcase"></i>',
                label: "Reduce",
                callback: async (html) => {
                    const customAmount = html.find('#custom-amount');
                    const sourceDescription = html.find('#source-description');
                    
                    const reduction = parseInt(customAmount.val()) || 10;
                    const source = sourceDescription.val() || 'Medical treatment';
                    
                    await addRadiationExposure(actor, -reduction, source);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            }
        },
        render: (html) => {
            // Handle source selection with modern DOM API
            const sourceSelect = html[0].querySelector('#radiation-source');
            const customDiv = html[0].querySelector('#custom-exposure');
            const customAmount = html[0].querySelector('#custom-amount');
            
            if (sourceSelect && customDiv && customAmount) {
                sourceSelect.addEventListener('change', function() {
                    if (this.value === 'custom') {
                        customDiv.style.display = 'block';
                    } else {
                        customDiv.style.display = 'none';
                        const selectedOption = this.options[this.selectedIndex];
                        customAmount.value = selectedOption.dataset.exposure || '0';
                    }
                });
            }
        }
    }).render(true);
}

/**
 * Add visual indicators to character sheet
 */
function addRadiationVisualIndicators(html, radiationLevel) {
    const radiationInfo = getRadiationLevel(radiationLevel);
    
    // Find the tertiary resource element using modern DOM API
    const tertiaryResource = html[0].querySelector('.resource.tertiary');
    if (!tertiaryResource) return;
    
    // Add visual styling
    tertiaryResource.style.border = `2px solid ${radiationInfo.color}`;
    tertiaryResource.style.background = `linear-gradient(90deg, ${radiationInfo.color}20, transparent)`;
    tertiaryResource.style.borderRadius = '4px';
    tertiaryResource.style.position = 'relative';
    
    // Add level indicator
    const levelIndicator = document.createElement('div');
    levelIndicator.className = 'radiation-indicator';
    levelIndicator.textContent = radiationInfo.name;
    levelIndicator.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        background: ${radiationInfo.color};
        color: white;
        padding: 2px 6px;
        border-radius: 12px;
        font-size: 10px;
        font-weight: bold;
        z-index: 10;
    `;
    
    tertiaryResource.appendChild(levelIndicator);
    
    // Add progress bar
    const maxLevel = 1000; // Display max for visual purposes
    const percentage = Math.min(100, (radiationLevel / maxLevel) * 100);
    
    const progressBar = document.createElement('div');
    progressBar.className = 'radiation-progress';
    progressBar.style.cssText = `
        position: absolute;
        bottom: -3px;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(0,0,0,0.1);
        border-radius: 2px;
    `;
    
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `
        width: ${percentage}%;
        height: 100%;
        background: ${radiationInfo.color};
        border-radius: 2px;
        transition: width 0.3s ease;
    `;
    
    progressBar.appendChild(progressFill);
    tertiaryResource.appendChild(progressBar);
}

/**
 * Create radiation zone in scene
 */
async function createRadiationZone(sceneId, zoneData) {
    try {
        const scene = game.scenes.get(sceneId);
        if (!scene) {
            throw new Error('Scene not found');
        }
        
        const {
            name = 'Radiation Zone',
            x = 0,
            y = 0,
            radius = 100,
            radiationLevel = 50,
            description = ''
        } = zoneData;
        
        // Store radiation zones in scene flags
        const radiationZones = scene.flags['bbttcc-radiation']?.zones || [];
        
        const zone = {
            id: foundry.utils.randomID(),
            name: name,
            x: x,
            y: y,
            radius: radius,
            radiationLevel: radiationLevel,
            description: description,
            createdAt: new Date().toISOString()
        };
        
        radiationZones.push(zone);
        
        await scene.update({
            'flags.bbttcc-radiation.zones': radiationZones
        });
        
        ui.notifications.info(`Radiation zone "${name}" created in ${scene.name}`);
        console.log('BBTTCC Radiation | Radiation zone created:', zone);
        
        return zone;
        
    } catch (error) {
        console.error('BBTTCC Radiation | Error creating radiation zone:', error);
        ui.notifications.error(`Failed to create radiation zone: ${error.message}`);
        throw error;
    }
}

/**
 * Hook to initialize radiation resource for new character actors
 */
Hooks.on('createActor', async (actor) => {
    if (actor.type === 'character') {
        await ensureRadiationResource(actor);
    }
});

/**
 * Add context menu options for radiation exposure
 */
Hooks.on('getActorDirectoryEntryContext', (html, entryOptions) => {
    entryOptions.push({
        name: "Expose to Radiation",
        icon: '<i class="fas fa-radiation"></i>',
        condition: li => {
            const actor = game.actors.get(li.data('document-id'));
            return game.user.isGM && actor?.type === 'character';
        },
        callback: async (li) => {
            const actor = game.actors.get(li.data('document-id'));
            await exposeActor(actor);
        }
    });
});

// Export for ES module compatibility
export { 
    addRadiationExposure, 
    setRadiationLevel, 
    getRadiationLevel,
    exposeActor,
    createRadiationZone,
    RadiationTracker,
    RADIATION_LEVELS,
    RADIATION_SOURCES
};