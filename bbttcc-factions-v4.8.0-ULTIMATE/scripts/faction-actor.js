/**
 * BBTTCC Faction Actor v4.8.0 - ULTIMATE
 * Custom Actor class for BBTTCC factions with enhanced capabilities
 */

export class FactionActor extends Actor {
    
    /**
     * Prepare base data for the faction actor
     */
    prepareBaseData() {
        super.prepareBaseData();
        
        // Ensure OPs structure exists
        if (!this.system.ops) {
            this.system.ops = {
                violence: { value: 0, max: 10 },
                nonlethal: { value: 0, max: 10 },
                intrigue: { value: 0, max: 10 },
                economy: { value: 0, max: 10 },
                softpower: { value: 0, max: 10 },
                diplomacy: { value: 0, max: 10 }
            };
        }
    }
    
    /**
     * Prepare derived data for the faction
     */
    prepareDerivedData() {
        super.prepareDerivedData();
        
        // Calculate total organization points
        if (this.system.ops) {
            this.system.totalOPs = Object.values(this.system.ops)
                .reduce((total, op) => total + (op.value || 0), 0);
                
            this.system.maxTotalOPs = Object.values(this.system.ops)
                .reduce((total, op) => total + (op.max || 10), 0);
        }
        
        // Calculate faction power level
        this.system.powerLevel = this._calculatePowerLevel();
        
        // Update faction status
        this.system.status = this._calculateStatus();
    }
    
    /**
     * Calculate faction power level based on OPs and territories
     */
    _calculatePowerLevel() {
        const totalOPs = this.system.totalOPs || 0;
        const territories = this.flags?.['bbttcc-factions']?.territories?.length || 0;
        
        const basePower = totalOPs;
        const territoryBonus = territories * 5;
        
        return basePower + territoryBonus;
    }
    
    /**
     * Calculate faction status based on current state
     */
    _calculateStatus() {
        const powerLevel = this.system.powerLevel || 0;
        
        if (powerLevel >= 100) return "Dominant";
        if (powerLevel >= 75) return "Powerful";
        if (powerLevel >= 50) return "Established";
        if (powerLevel >= 25) return "Growing";
        return "Emerging";
    }
    
    /**
     * Roll an Organization Point check
     */
    async rollOP(opType, options = {}) {
        if (!this.system.ops || !this.system.ops[opType]) {
            ui.notifications.warn(`Invalid OP type: ${opType}`);
            return null;
        }
        
        const opValue = this.system.ops[opType].value;
        const roll = new Roll(`1d20 + ${opValue}`, this.getRollData());
        
        const result = await roll.evaluate();
        
        // Create chat message
        const chatData = {
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `
                <div class="bbttcc-op-roll">
                    <h4>${this.name} - ${opType.toUpperCase()} Check</h4>
                    <div class="roll-result">
                        <strong>${result.total}</strong>
                        <span class="roll-formula">(${result.formula})</span>
                    </div>
                </div>
            `,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: result
        };
        
        if (options.createMessage !== false) {
            await ChatMessage.create(chatData);
        }
        
        return result;
    }
    
    /**
     * Add entry to war log
     */
    async addWarLogEntry(entry) {
        const warLog = this.flags?.['bbttcc-factions']?.warLog || [];
        
        const newEntry = {
            id: foundry.utils.randomID(),
            timestamp: new Date().toISOString(),
            turn: game.combat?.round || 0,
            ...entry
        };
        
        warLog.push(newEntry);
        
        await this.setFlag('bbttcc-factions', 'warLog', warLog);
        
        return newEntry;
    }
    
    /**
     * Add a territory to this faction
     */
    async addTerritory(territoryData) {
        const territories = this.flags?.['bbttcc-factions']?.territories || [];
        
        territories.push({
            id: territoryData.id || foundry.utils.randomID(),
            ...territoryData,
            addedAt: new Date().toISOString()
        });
        
        await this.setFlag('bbttcc-factions', 'territories', territories);
        
        // Add to war log
        await this.addWarLogEntry({
            type: 'territory_gained',
            title: `Territory Acquired: ${territoryData.name}`,
            description: `The faction has gained control of ${territoryData.name}.`
        });
        
        return territories;
    }
    
    /**
     * Remove a territory from this faction
     */
    async removeTerritory(territoryId) {
        const territories = this.flags?.['bbttcc-factions']?.territories || [];
        const territory = territories.find(t => t.id === territoryId);
        
        if (!territory) {
            return territories;
        }
        
        const updatedTerritories = territories.filter(t => t.id !== territoryId);
        await this.setFlag('bbttcc-factions', 'territories', updatedTerritories);
        
        // Add to war log
        await this.addWarLogEntry({
            type: 'territory_lost',
            title: `Territory Lost: ${territory.name}`,
            description: `The faction has lost control of ${territory.name}.`
        });
        
        return updatedTerritories;
    }
    
    /**
     * Get faction relationship with another faction
     */
    getFactionRelationship(otherFactionId) {
        const relationships = this.flags?.['bbttcc-factions']?.relationships || {};
        return relationships[otherFactionId] || {
            status: 'neutral',
            value: 0,
            lastUpdated: null
        };
    }
    
    /**
     * Set faction relationship with another faction
     */
    async setFactionRelationship(otherFactionId, relationshipData) {
        const relationships = this.flags?.['bbttcc-factions']?.relationships || {};
        
        relationships[otherFactionId] = {
            ...relationshipData,
            lastUpdated: new Date().toISOString()
        };
        
        await this.setFlag('bbttcc-factions', 'relationships', relationships);
        
        return relationships[otherFactionId];
    }
}