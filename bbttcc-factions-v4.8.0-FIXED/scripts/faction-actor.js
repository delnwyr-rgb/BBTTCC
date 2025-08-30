/**
 * BBTTCC Faction Actor v4.8.0 - FIXED
 * Enhanced Actor class for BBTTCC factions with strategic warfare capabilities
 */

export class FactionActor extends dnd5e.documents.Actor5e {
    
    /**
     * Adjust Organization Points value
     */
    async adjustOPs(opType, adjustment) {
        const currentOps = this.system.ops || {};
        const currentOp = currentOps[opType];
        
        if (!currentOp) {
            console.error(`BBTTCC Faction Actor | Unknown OP type: ${opType}`);
            return false;
        }
        
        const newValue = Math.max(0, Math.min(currentOp.max, currentOp.value + adjustment));
        
        await this.update({
            [`system.ops.${opType}.value`]: newValue
        });
        
        console.log(`BBTTCC Faction Actor | ${opType} adjusted: ${currentOp.value} -> ${newValue}`);
        return newValue;
    }
    
    /**
     * Roll Organization Points
     */
    async rollOPs(opType) {
        const currentOps = this.system.ops || {};
        const opValue = currentOps[opType]?.value || 0;
        
        const roll = new Roll(`1d20 + ${opValue}`);
        const result = await roll.evaluate();
        
        const chatData = {
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this }),
            content: `
                <div class="bbttcc-roll">
                    <h4>${this.name} - ${opType.toUpperCase()} Roll</h4>
                    <div class="roll-result">
                        <strong>${result.total}</strong>
                        <span class="roll-formula">(${result.formula})</span>
                    </div>
                </div>
            `,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: result
        };
        
        ChatMessage.create(chatData);
        return result;
    }
    
    /**
     * Add war log entry
     */
    async addWarLogEntry(entry) {
        const warLog = this.flags['bbttcc-factions']?.warLog || [];
        const newEntry = {
            id: foundry.utils.randomID(),
            title: entry.title || "Event",
            description: entry.description || "",
            timestamp: entry.timestamp || new Date().toISOString(),
            turn: entry.turn || game.combat?.round || 0,
            ...entry
        };
        
        warLog.push(newEntry);
        
        await this.update({
            'flags.bbttcc-factions.warLog': warLog
        });
        
        console.log('BBTTCC Faction Actor | War log entry added:', newEntry);
        return newEntry;
    }
    
    /**
     * Get controlled territories
     */
    getControlledTerritories() {
        return this.flags['bbttcc-factions']?.territories || [];
    }
    
    /**
     * Add controlled territory
     */
    async addTerritory(territoryData) {
        const territories = this.getControlledTerritories();
        territories.push(territoryData);
        
        await this.update({
            'flags.bbttcc-factions.territories': territories
        });
        
        console.log('BBTTCC Faction Actor | Territory added:', territoryData);
    }
    
    /**
     * Remove controlled territory
     */
    async removeTerritory(territoryId) {
        const territories = this.getControlledTerritories().filter(
            territory => territory.id !== territoryId
        );
        
        await this.update({
            'flags.bbttcc-factions.territories': territories
        });
        
        console.log('BBTTCC Faction Actor | Territory removed:', territoryId);
    }
    
    /**
     * Get faction bases
     */
    getBases() {
        return this.flags['bbttcc-factions']?.bases || [];
    }
    
    /**
     * Add faction base
     */
    async addBase(baseData) {
        const bases = this.getBases();
        const newBase = {
            id: foundry.utils.randomID(),
            name: baseData.name || "New Base",
            type: baseData.type || "bunker",
            description: baseData.description || "",
            ...baseData
        };
        
        bases.push(newBase);
        
        await this.update({
            'flags.bbttcc-factions.bases': bases
        });
        
        console.log('BBTTCC Faction Actor | Base added:', newBase);
        return newBase;
    }
    
    /**
     * Calculate faction strength for raids
     */
    calculateStrength() {
        const ops = this.system.ops || {};
        const territories = this.getControlledTerritories();
        const bases = this.getBases();
        
        // Base strength from OPs
        const opStrength = Object.values(ops).reduce((sum, op) => sum + (op.value || 0), 0);
        
        // Territory bonuses
        const territoryBonus = territories.length * 2;
        
        // Base bonuses
        const baseBonus = bases.length * 3;
        
        const totalStrength = opStrength + territoryBonus + baseBonus;
        
        console.log(`BBTTCC Faction Actor | ${this.name} strength: ${totalStrength} (OPs: ${opStrength}, Territories: ${territoryBonus}, Bases: ${baseBonus})`);
        
        return totalStrength;
    }
    
    /**
     * Get faction summary for displays
     */
    getSummary() {
        const ops = this.system.ops || {};
        const territories = this.getControlledTerritories();
        const bases = this.getBases();
        
        return {
            name: this.name,
            ops: ops,
            territoryCount: territories.length,
            baseCount: bases.length,
            strength: this.calculateStrength(),
            version: '4.8.0'
        };
    }
}