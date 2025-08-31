/**
 * BBTTCC Faction Actor v4.8.0 - MODERN
 * Modern FoundryVTT v13+ Actor class with proper patterns
 */

export class FactionActor extends Actor {
    
    /**
     * Modern prepareBaseData with proper error handling
     */
    prepareBaseData() {
        super.prepareBaseData();
        
        try {
            const moduleId = 'bbttcc-factions';
            
            // Only process if this is a faction
            if (!this.getFlag(moduleId, 'isFaction')) {
                return;
            }
            
            // Ensure OPs structure exists
            const ops = this.getFlag(moduleId, 'ops');
            if (!ops) {
                console.warn(`BBTTCC Faction Actor | ${this.name} missing OPs, will be initialized`);
                return;
            }
            
            // Calculate derived data
            this.system.factionData = {
                totalOPs: Object.values(ops).reduce((total, op) => total + (op?.value || 0), 0),
                maxTotalOPs: Object.values(ops).reduce((total, op) => total + (op?.max || 10), 0),
                powerLevel: this._calculatePowerLevel(ops),
                status: this._calculateStatus(ops)
            };
            
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error in prepareBaseData for ${this.name}:`, error);
        }
    }
    
    /**
     * Modern getRollData with faction-specific data
     */
    getRollData() {
        const data = super.getRollData();
        const moduleId = 'bbttcc-factions';
        
        try {
            if (this.getFlag(moduleId, 'isFaction')) {
                const ops = this.getFlag(moduleId, 'ops') || {};
                
                // Add OP values to roll data for use in formulas
                data.ops = {};
                Object.keys(ops).forEach(opType => {
                    data.ops[opType] = ops[opType]?.value || 0;
                });
                
                // Add faction-specific roll data
                data.faction = {
                    totalOPs: Object.values(ops).reduce((total, op) => total + (op?.value || 0), 0),
                    powerLevel: this._calculatePowerLevel(ops),
                    warLogCount: (this.getFlag(moduleId, 'warLog') || []).length,
                    territoryCount: (this.getFlag(moduleId, 'territories') || []).length,
                    baseCount: (this.getFlag(moduleId, 'bases') || []).length
                };
            }
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error in getRollData for ${this.name}:`, error);
        }
        
        return data;
    }
    
    /**
     * Calculate power level based on Organization Points
     * @param {Object} ops - Organization Points object
     * @returns {string} Power level
     */
    _calculatePowerLevel(ops) {
        try {
            const total = Object.values(ops).reduce((sum, op) => sum + (op?.value || 0), 0);
            
            if (total < 10) return "Emerging";
            if (total < 25) return "Growing";
            if (total < 40) return "Established";
            if (total < 55) return "Powerful";
            return "Dominant";
            
        } catch (error) {
            console.error('BBTTCC Faction Actor | Error calculating power level:', error);
            return "Unknown";
        }
    }
    
    /**
     * Calculate faction status
     * @param {Object} ops - Organization Points object
     * @returns {string} Status
     */
    _calculateStatus(ops) {
        try {
            const values = Object.values(ops);
            const total = values.reduce((sum, op) => sum + (op?.value || 0), 0);
            const max = values.reduce((sum, op) => sum + (op?.max || 10), 0);
            const percentage = (total / max) * 100;
            
            if (percentage < 25) return "Weak";
            if (percentage < 50) return "Stable";
            if (percentage < 75) return "Strong";
            return "Dominant";
            
        } catch (error) {
            console.error('BBTTCC Faction Actor | Error calculating status:', error);
            return "Unknown";
        }
    }
    
    /**
     * Modern method to roll specific Organization Point
     * @param {string} opType - Type of OP to roll
     * @returns {Promise<Roll>} The roll result
     */
    async rollOP(opType) {
        try {
            const moduleId = 'bbttcc-factions';
            const ops = this.getFlag(moduleId, 'ops') || {};
            const opValue = ops[opType]?.value || 0;
            
            if (!ops[opType]) {
                throw new Error(`Invalid OP type: ${opType}`);
            }
            
            const roll = new Roll(`1d20 + ${opValue}`, this.getRollData());
            const result = await roll.evaluate();
            
            // Create chat message
            await ChatMessage.create({
                user: game.user.id,
                speaker: ChatMessage.getSpeaker({ actor: this }),
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                roll: result,
                content: `
                    <div class="bbttcc-op-roll">
                        <h4>${this.name} - ${opType.toUpperCase()} Check</h4>
                        <div class="roll-result">
                            <strong>Result: ${result.total}</strong>
                            <div class="roll-formula">${result.formula}</div>
                        </div>
                    </div>
                `
            });
            
            return result;
            
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error rolling ${opType} for ${this.name}:`, error);
            ui.notifications.error(`Failed to roll ${opType}: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Modern method to update Organization Points safely
     * @param {string} opType - Type of OP to update
     * @param {number} value - New value
     * @returns {Promise<Object>} Updated OP structure
     */
    async updateOP(opType, value) {
        try {
            const moduleId = 'bbttcc-factions';
            const currentOps = this.getFlag(moduleId, 'ops') || {};
            
            if (!currentOps[opType]) {
                throw new Error(`Invalid OP type: ${opType}`);
            }
            
            const newValue = Math.max(0, Math.min(currentOps[opType].max || 10, value));
            const updatedOps = foundry.utils.deepClone(currentOps);
            updatedOps[opType].value = newValue;
            
            await this.setFlag(moduleId, 'ops', updatedOps);
            
            console.log(`BBTTCC Faction Actor | Updated ${opType} for ${this.name}: ${currentOps[opType].value} -> ${newValue}`);
            
            return updatedOps[opType];
            
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error updating ${opType} for ${this.name}:`, error);
            throw error;
        }
    }
    
    /**
     * Add entry to war log
     * @param {Object} entry - War log entry data
     * @returns {Promise<Array>} Updated war log
     */
    async addWarLogEntry(entry) {
        try {
            const moduleId = 'bbttcc-factions';
            const currentLog = this.getFlag(moduleId, 'warLog') || [];
            
            const newEntry = {
                id: foundry.utils.randomID(),
                title: entry.title || "Untitled Event",
                description: entry.description || "",
                type: entry.type || "battle",
                date: entry.date || new Date().toISOString(),
                createdBy: game.user.id,
                ...entry
            };
            
            const updatedLog = [...currentLog, newEntry];
            await this.setFlag(moduleId, 'warLog', updatedLog);
            
            console.log(`BBTTCC Faction Actor | Added war log entry to ${this.name}:`, newEntry.title);
            
            return updatedLog;
            
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error adding war log entry to ${this.name}:`, error);
            throw error;
        }
    }
    
    /**
     * Add base to faction
     * @param {Object} baseData - Base data
     * @returns {Promise<Array>} Updated bases list
     */
    async addBase(baseData) {
        try {
            const moduleId = 'bbttcc-factions';
            const currentBases = this.getFlag(moduleId, 'bases') || [];
            
            const newBase = {
                id: foundry.utils.randomID(),
                name: baseData.name || "Unnamed Base",
                type: baseData.type || "outpost",
                description: baseData.description || "",
                createdAt: new Date().toISOString(),
                createdBy: game.user.id,
                ...baseData
            };
            
            const updatedBases = [...currentBases, newBase];
            await this.setFlag(moduleId, 'bases', updatedBases);
            
            console.log(`BBTTCC Faction Actor | Added base to ${this.name}:`, newBase.name);
            
            return updatedBases;
            
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error adding base to ${this.name}:`, error);
            throw error;
        }
    }
    
    /**
     * Get faction summary data
     * @returns {Object} Faction summary
     */
    getFactionSummary() {
        try {
            const moduleId = 'bbttcc-factions';
            
            if (!this.getFlag(moduleId, 'isFaction')) {
                return null;
            }
            
            const ops = this.getFlag(moduleId, 'ops') || {};
            const warLog = this.getFlag(moduleId, 'warLog') || [];
            const territories = this.getFlag(moduleId, 'territories') || [];
            const bases = this.getFlag(moduleId, 'bases') || [];
            
            return {
                name: this.name,
                id: this.id,
                totalOPs: Object.values(ops).reduce((sum, op) => sum + (op?.value || 0), 0),
                powerLevel: this._calculatePowerLevel(ops),
                status: this._calculateStatus(ops),
                warLogEntries: warLog.length,
                territoryCount: territories.length,
                baseCount: bases.length,
                createdAt: this.getFlag(moduleId, 'createdAt'),
                version: this.getFlag(moduleId, 'version') || '4.8.0'
            };
            
        } catch (error) {
            console.error(`BBTTCC Faction Actor | Error getting summary for ${this.name}:`, error);
            return null;
        }
    }
}