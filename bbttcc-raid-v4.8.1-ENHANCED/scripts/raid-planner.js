/**
 * BBTTCC Raid Planner - Modern UI Application
 * Advanced planning interface for raids using modern FoundryVTT patterns
 */

export class RaidPlanner extends Application {
    
    constructor(raidData = null, options = {}) {
        super(options);
        this.raidData = raidData;
        this.isEditing = !!raidData;
    }
    
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "bbttcc-raid-planner",
            title: "BBTTCC Raid Planner",
            template: "modules/bbttcc-raid/templates/raid-planner.html",
            width: 900,
            height: 700,
            resizable: true,
            classes: ["bbttcc-raid-planner"],
            tabs: [
                {
                    navSelector: ".tabs",
                    contentSelector: ".content",
                    initial: "basics"
                }
            ]
        });
    }
    
    /** @override */
    async getData(options) {
        const data = await super.getData(options);
        
        // Get available factions
        const factions = game.actors.filter(actor => 
            actor.flags['bbttcc-factions']?.isFaction === true
        );
        
        // Get module API
        const raidModule = game.modules.get('bbttcc-raid');
        const RAID_TYPES = raidModule?.api?.RAID_TYPES || {};
        const RAID_DIFFICULTIES = raidModule?.api?.RAID_DIFFICULTIES || {};
        
        // Prepare raid data
        const raidData = this.raidData || {
            name: '',
            type: 'assault',
            target: '',
            description: '',
            objectives: [],
            participants: [],
            resources: {
                violence: 0,
                nonLethal: 0,
                intrigue: 0,
                economy: 0
            },
            timeline: {
                preparation: 24,
                execution: 4,
                extraction: 2
            },
            difficulty: 'medium',
            rewards: [],
            risks: []
        };
        
        return {
            ...data,
            raidData: raidData,
            factions: factions,
            raidTypes: RAID_TYPES,
            raidDifficulties: RAID_DIFFICULTIES,
            isEditing: this.isEditing,
            isGM: game.user.isGM
        };
    }
    
    /** @override */
    activateListeners(html) {
        super.activateListeners(html);
        
        if (!game.user.isGM) return;
        
        const element = html[0];
        
        // Save/Create raid
        const saveButton = element.querySelector('#save-raid');
        if (saveButton) {
            saveButton.addEventListener('click', this._onSaveRaid.bind(this));
        }
        
        // Execute raid
        const executeButton = element.querySelector('#execute-raid');
        if (executeButton) {
            executeButton.addEventListener('click', this._onExecuteRaid.bind(this));
        }
        
        // Delete raid
        const deleteButton = element.querySelector('#delete-raid');
        if (deleteButton) {
            deleteButton.addEventListener('click', this._onDeleteRaid.bind(this));
        }
        
        // Add/remove objectives
        element.querySelectorAll('.add-objective').forEach(button => {
            button.addEventListener('click', this._onAddObjective.bind(this));
        });
        
        element.querySelectorAll('.remove-objective').forEach(button => {
            button.addEventListener('click', this._onRemoveObjective.bind(this));
        });
        
        // Resource adjustments
        element.querySelectorAll('.resource-adjust').forEach(button => {
            button.addEventListener('click', this._onAdjustResource.bind(this));
        });
        
        // Auto-calculate difficulty
        const autoCalcButton = element.querySelector('#auto-calc-difficulty');
        if (autoCalcButton) {
            autoCalcButton.addEventListener('click', this._onAutoCalculateDifficulty.bind(this));
        }
        
        // Participant selection changes
        const participantSelect = element.querySelector('#raid-participants');
        if (participantSelect) {
            participantSelect.addEventListener('change', this._onParticipantChange.bind(this));
        }
        
        console.log('BBTTCC Raid Planner | Event listeners activated');
    }
    
    /**
     * Handle saving/creating raid
     */
    async _onSaveRaid(event) {
        event.preventDefault();
        
        try {
            const form = event.target.closest('form') || document.querySelector('#raid-planner-form');
            const formData = new FormData(form);
            
            // Gather basic data
            const raidData = {
                name: formData.get('raid-name'),
                type: formData.get('raid-type'),
                target: formData.get('raid-target'),
                description: formData.get('raid-description'),
                difficulty: formData.get('raid-difficulty'),
                resources: {
                    violence: parseInt(formData.get('resource-violence')) || 0,
                    nonLethal: parseInt(formData.get('resource-nonlethal')) || 0,
                    intrigue: parseInt(formData.get('resource-intrigue')) || 0,
                    economy: parseInt(formData.get('resource-economy')) || 0
                },
                timeline: {
                    preparation: parseInt(formData.get('timeline-preparation')) || 24,
                    execution: parseInt(formData.get('timeline-execution')) || 4,
                    extraction: parseInt(formData.get('timeline-extraction')) || 2
                }
            };
            
            // Gather objectives
            const objectiveInputs = form.querySelectorAll('.objective-input');
            raidData.objectives = Array.from(objectiveInputs)
                .map(input => input.value.trim())
                .filter(obj => obj.length > 0);
            
            // Gather participants
            const participantSelect = form.querySelector('#raid-participants');
            if (participantSelect) {
                raidData.participants = Array.from(participantSelect.selectedOptions)
                    .map(option => option.value);
            }
            
            // Validate required fields
            if (!raidData.name) {
                ui.notifications.warn('Raid name is required');
                return;
            }
            
            if (raidData.objectives.length === 0) {
                ui.notifications.warn('At least one objective is required');
                return;
            }
            
            // Get raid API
            const raidModule = game.modules.get('bbttcc-raid');
            if (!raidModule?.api) {
                throw new Error('BBTTCC Raid module not available');
            }
            
            let result;
            if (this.isEditing && this.raidData?.id) {
                // Update existing raid
                result = await raidModule.api.updateRaid(this.raidData.id, raidData);
            } else {
                // Create new raid
                result = await raidModule.api.createRaid(raidData);
            }
            
            ui.notifications.info(`Raid "${result.name}" ${this.isEditing ? 'updated' : 'created'} successfully`);
            
            // Update local data and re-render
            this.raidData = result;
            this.isEditing = true;
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Raid Planner | Error saving raid:', error);
            ui.notifications.error(`Failed to save raid: ${error.message}`);
        }
    }
    
    /**
     * Handle raid execution
     */
    async _onExecuteRaid(event) {
        event.preventDefault();
        
        if (!this.raidData?.id) {
            ui.notifications.warn('Please save the raid before executing');
            return;
        }
        
        const confirmed = await Dialog.confirm({
            title: "Execute Raid",
            content: `<p>Are you sure you want to execute the raid <strong>"${this.raidData.name}"</strong>?</p><p>This action cannot be undone.</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const raidModule = game.modules.get('bbttcc-raid');
            const result = await raidModule.api.executeRaid(this.raidData.id);
            
            // Show outcome dialog
            const outcome = result.outcome;
            const outcomeClass = outcome.success ? 'success' : 'failure';
            
            const content = `
                <div class="raid-outcome ${outcomeClass}">
                    <h3>${outcome.success ? 'Success!' : 'Failure!'}</h3>
                    <p><strong>Roll:</strong> ${outcome.roll.toFixed(1)} (needed ${outcome.successChance.toFixed(1)} or less)</p>
                    <p><strong>Severity:</strong> ${outcome.severity.charAt(0).toUpperCase() + outcome.severity.slice(1)}</p>
                    <p>${outcome.description}</p>
                    
                    ${outcome.rewards ? `
                        <h4>Rewards:</h4>
                        <ul>
                            ${outcome.rewards.map(r => `<li>${r.description || `${r.type}: +${r.amount}`}</li>`).join('')}
                        </ul>
                    ` : ''}
                    
                    ${outcome.consequences ? `
                        <h4>Consequences:</h4>
                        <ul>
                            ${outcome.consequences.map(c => `<li>${c.description || `${c.type}: ${c.amount}`}</li>`).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
            
            new Dialog({
                title: "Raid Outcome",
                content: content,
                buttons: {
                    ok: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "OK"
                    }
                }
            }).render(true);
            
            // Update local data and re-render
            this.raidData = result.raid;
            this.render();
            
        } catch (error) {
            console.error('BBTTCC Raid Planner | Error executing raid:', error);
            ui.notifications.error(`Failed to execute raid: ${error.message}`);
        }
    }
    
    /**
     * Handle raid deletion
     */
    async _onDeleteRaid(event) {
        event.preventDefault();
        
        if (!this.raidData?.id) return;
        
        const confirmed = await Dialog.confirm({
            title: "Delete Raid",
            content: `<p>Are you sure you want to delete the raid <strong>"${this.raidData.name}"</strong>?</p><p>This action cannot be undone.</p>`,
            yes: () => true,
            no: () => false
        });
        
        if (!confirmed) return;
        
        try {
            const raidModule = game.modules.get('bbttcc-raid');
            await raidModule.api.deleteRaid(this.raidData.id);
            
            ui.notifications.info(`Raid "${this.raidData.name}" deleted successfully`);
            this.close();
            
        } catch (error) {
            console.error('BBTTCC Raid Planner | Error deleting raid:', error);
            ui.notifications.error(`Failed to delete raid: ${error.message}`);
        }
    }
    
    /**
     * Handle adding objectives
     */
    _onAddObjective(event) {
        event.preventDefault();
        
        const objectivesContainer = event.target.closest('.form-group').querySelector('.objectives-list');
        const newObjective = document.createElement('div');
        newObjective.className = 'objective-item';
        newObjective.innerHTML = `
            <input type="text" class="objective-input" placeholder="Enter objective...">
            <button type="button" class="remove-objective"><i class="fas fa-times"></i></button>
        `;
        
        objectivesContainer.appendChild(newObjective);
        
        // Activate remove listener for new objective
        const removeButton = newObjective.querySelector('.remove-objective');
        removeButton.addEventListener('click', this._onRemoveObjective.bind(this));
        
        // Focus the new input
        newObjective.querySelector('.objective-input').focus();
    }
    
    /**
     * Handle removing objectives
     */
    _onRemoveObjective(event) {
        event.preventDefault();
        event.target.closest('.objective-item').remove();
    }
    
    /**
     * Handle resource adjustments
     */
    _onAdjustResource(event) {
        event.preventDefault();
        
        const button = event.target.closest('.resource-adjust');
        const resourceType = button.dataset.resource;
        const adjustment = parseInt(button.dataset.adjustment);
        const input = button.parentNode.querySelector('.resource-input');
        
        const currentValue = parseInt(input.value) || 0;
        const newValue = Math.max(0, currentValue + adjustment);
        
        input.value = newValue;
        input.dispatchEvent(new Event('change'));
    }
    
    /**
     * Handle auto-calculating difficulty
     */
    _onAutoCalculateDifficulty(event) {
        event.preventDefault();
        
        try {
            // Gather current form data
            const form = document.querySelector('#raid-planner-form');
            const formData = new FormData(form);
            
            const tempRaidData = {
                type: formData.get('raid-type'),
                objectives: Array.from(form.querySelectorAll('.objective-input'))
                    .map(input => input.value.trim())
                    .filter(obj => obj.length > 0),
                participants: Array.from(form.querySelector('#raid-participants')?.selectedOptions || [])
                    .map(option => option.value),
                resources: {
                    violence: parseInt(formData.get('resource-violence')) || 0,
                    nonLethal: parseInt(formData.get('resource-nonlethal')) || 0,
                    intrigue: parseInt(formData.get('resource-intrigue')) || 0,
                    economy: parseInt(formData.get('resource-economy')) || 0
                }
            };
            
            const raidModule = game.modules.get('bbttcc-raid');
            const calculatedDifficulty = raidModule.api.calculateDifficulty(tempRaidData);
            
            // Update the difficulty select
            const difficultySelect = form.querySelector('#raid-difficulty');
            difficultySelect.value = calculatedDifficulty;
            
            ui.notifications.info(`Difficulty auto-calculated as: ${calculatedDifficulty.charAt(0).toUpperCase() + calculatedDifficulty.slice(1)}`);
            
        } catch (error) {
            console.error('BBTTCC Raid Planner | Error auto-calculating difficulty:', error);
            ui.notifications.error('Failed to auto-calculate difficulty');
        }
    }
    
    /**
     * Handle participant selection changes
     */
    _onParticipantChange(event) {
        // Could add logic to update resource calculations based on participant abilities
        console.log('BBTTCC Raid Planner | Participants changed');
    }
}