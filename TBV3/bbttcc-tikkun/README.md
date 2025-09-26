# BBTTCC Tikkun: The Great Work v4.8.1-ENHANCED

**The Sparks of Light System - Spiritual Victory Condition for BBTTCC Campaigns**

## 🌟 Overview

BBTTCC Tikkun implements "The Great Work" - a profound spiritual victory condition that transforms your BBTTCC campaign from strategic conquest into a journey of world healing and personal growth. Based on the Kabbalistic concept of **Tikkun Olam** (repairing the world), this system challenges players to gather scattered "Sparks of Light" through righteous action and character development.

## ✨ What is The Great Work?

The Great Work is the ultimate goal of a BBTTCC campaign: to repair the "shattered human Sephira" - a broken divine lens that fractured reality itself. Players must gather Sparks of Light tied to the **10 Sephiroth** from the Kabbalistic Tree of Life, each representing a divine virtue they must embody to heal both the world and themselves.

### Core Philosophy

- **Thematic Tension**: Your character's assigned Sparks are the **opposite** of your starting strengths
- **Personal Growth**: Victory requires overcoming ego and developing complementary virtues
- **Moral Consequences**: The **how** matters more than the **what** - corrupt methods taint Sparks
- **Collaborative Victory**: All players must complete their Constellations for the final ritual

## 🎯 Key Features

### Procedural Constellation Generation
- **Unique Path for Every Character**: Sparks assigned based on Archetype, Crew, Occult Association, and Background
- **Thematic Coherence**: A Warlord must learn Mercy, a Scholar must find Wisdom's balance
- **Minimum 3-5 Sparks**: Ensures meaningful character arcs

### Three Types of Sparks
1. **Conceptual Sparks** 💭: Achieved through specific scenario outcomes (Justice, Mercy, Truth)
2. **Vestigial Sparks** 📜: Physical artifacts hidden in ancient ruins and forgotten places  
3. **Animate Sparks** 👤: Living beings who embody divine principles and must be convinced

### Five Spark States
- ⚫ **Required**: Destined but not yet discovered
- 🔍 **Identified**: Nature revealed through investigation
- ✨ **Active**: Quest currently underway
- 🌟 **Gathered**: Successfully integrated through righteous action
- 💀 **Corrupted**: Tainted by improper methods, requires purification

### Corruption & Purification System
- **Moral Enforcement**: Wrong methods (violence for Mercy, lies for Truth) corrupt Sparks
- **Redemption Paths**: Corrupted Sparks require specific purification quests
- **Meaningful Consequences**: Corruption affects faction standing and blocks final victory

## 🔧 Installation & Setup

### Requirements
- **FoundryVTT**: v13.0+ (verified on v13.348)
- **System**: D&D 5th Edition v5.0.0+
- **Required Module**: bbttcc-factions v4.8.1+
- **Permissions**: GM access for constellation generation

### Installation Steps

1. **Extract Module**
   ```
   Copy bbttcc-tikkun-v4.8.1-ENHANCED/ to your FoundryVTT modules directory
   ```

2. **Enable Module**
   - Open FoundryVTT and navigate to "Manage Modules"
   - Enable "BBTTCC Tikkun: The Great Work"
   - **Important**: Enable bbttcc-factions first (required dependency)
   - Restart FoundryVTT

3. **Verify Installation**
   - Open browser console (F12)
   - Look for: "BBTTCC Tikkun | System fully operational - The Great Work awaits"
   - Run diagnostic: `bbttccTikkunTest()` in console
   - All tests should show success

## 🎮 Quick Start Guide

### 1. Generate Constellation (GM)
```javascript
// Option A: Automatic (when character is created with enough data)
// Constellation generates automatically based on character traits

// Option B: Manual generation
const api = game.bbttccTikkun.api;
await api.generateConstellation(characterActor);
```

### 2. Character Sheet Integration
- Open any PC character sheet
- New tab: **"The Great Work"** appears
- Visual constellation shows all assigned Sparks with status icons
- Click Spark icons for detailed information and quest hints

### 3. Spark Progression (Three Phases)
1. **Identification**: Research and investigation reveal Spark nature
2. **Quest**: Active pursuit through scenarios and roleplay  
3. **Gathering**: Successful completion through appropriate methods

### 4. GM Management
- **Status Updates**: Manually advance Spark states
- **Quest Hints**: Generate contextual guidance for players
- **Corruption**: Apply consequences for improper methods
- **Data Repair**: Automatic validation and corruption recovery

## 📊 API Documentation

### Core API Access
```javascript
const api = game.bbttccTikkun.api;
```

### Character Constellations
```javascript
// Generate constellation for character
await api.generateConstellation(actor);

// Get character's spark data
const sparks = api.getSparks(actor);

// Get specific spark
const spark = api.getSpark(actor, 'sparkOfMercy_Chesed');

// Update spark status
await api.updateSparkStatus(actor, sparkId, 'gathered', {
    entry: 'Completed diplomatic resolution with Justice outcome'
});
```

### Automated Integration
```javascript
// Listen for scenario completion (automatic checking)
Hooks.on("bbttcc:scenarioResolved", (scenarioData) => {
    // System automatically checks gathering/corruption conditions
});

// Manual condition checking
await api.checkForGathering(actor, {
    type: 'Courtly Intrigue',
    outcome: 'Justice/Reformation',
    details: 'Peaceful resolution'
});
```

### Progress Tracking
```javascript
// Campaign-wide progress overview
const progress = api.getSparkProgress();

// Constellation completion check
const isReady = game.bbttccTikkun.constellation.isConstellationComplete(sparks);

// Data validation and repair
const repaired = await api.repairSparks(actor);
```

## 🎲 Spark Quest Examples

### Spark of Mercy (Chesed) - Conceptual
**Character**: Warlord with Mercenary Band crew
**Challenge**: Learn compassion despite military background

**Gathering Conditions**:
- Justice/Reformation scenario outcome
- Alliance/Cooperation diplomatic success
- Compassionate governance of territories

**Corruption Risks**:
- Retribution/Subjugation outcomes  
- Unnecessary violence or cruelty
- Betraying allies for tactical advantage

### Spark of Understanding (Binah) - Vestigial  
**Character**: Anyone lacking wisdom/contemplation
**Challenge**: Seek ancient knowledge through exploration

**Gathering Method**:
- Asset Retrieval scenario in lost library or archive
- Find and preserve ancient wisdom texts
- Share knowledge with others rather than hoarding

### Spark of Truth (Tiferet) - Animate
**Character**: Covert Ops specialist used to deception
**Challenge**: Find someone who embodies honesty

**Gathering Method**:
- Locate NPC sage who represents divine truth
- Protect them from those who would silence truth
- Learn from their example of integrity

## ⚔️ The Final Confrontation

When all players have gathered their purified Sparks, the campaign climaxes with the **Final Ritual** against the **Ego-Dragon** - the metaphysical embodiment of pride and division that shattered the world.

### Final Battle Mechanics
- **Collaborative Skill Challenge**: Not traditional combat
- **Personal Stakes**: Dragon's attacks based on party's past moral failures
- **Spark Powers**: Gathered Sparks are primary tools for victory
- **Ultimate Victory**: Success triggers world-wide "Reformation Outcome"

## 🔍 GM Tools & Diagnostics

### Built-in Diagnostics
```javascript
// Run full system test
bbttccTikkunTest();

// Check module status  
const isReady = game.bbttccTikkun.api.isReady();

// Validate constellation data
const validation = game.bbttccTikkun.constellation.validateConstellation(sparks);
```

### Common GM Actions
- **Generate Hints**: Provide guidance for stuck players
- **Apply Corruption**: Consequence for improper methods
- **Manual Progression**: Skip phases or force advancement
- **Data Export**: Backup constellation progress

## 🎨 Customization

### Spark Conditions
The system includes extensive mapping of scenario outcomes to gathering/corruption conditions. GMs can modify these in `tikkun-api.js`:

```javascript
const conditionsMap = {
    'sparkOfMercy_Chesed': {
        gather: ['Justice/Reformation', 'Alliance/Cooperation'],
        corrupt: ['Retribution/Subjugation', 'Betrayal']
    }
    // Add custom conditions here
};
```

### Visual Theming
All styling is contained in `tikkun-styles.css` with CSS custom properties for easy color scheme modification.

## 🔧 Troubleshooting

### Common Issues

#### ❌ "Module not ready" Error
- **Cause**: Initialization timeout or missing dependencies
- **Solution**: Ensure bbttcc-factions is enabled first, refresh Foundry

#### ❌ No Constellation Generated
- **Cause**: Insufficient character creation data
- **Solution**: Ensure Archetype, Background, or Class are set; use manual generation

#### ❌ Sparks Not Updating
- **Cause**: Inter-module communication failure
- **Solution**: Check that other BBTTCC modules are emitting scenario resolution hooks

### Debug Mode
Enable debug logging in module settings or console:
```javascript
game.modules.get('bbttcc-tikkun').flags.debug = true;
```

## 🔄 Integration with BBTTCC Suite

### Automatic Event Listening
- **bbttcc-factions**: Monitors War Log for corruption tracking
- **bbttcc-raid**: Receives raid outcomes for Spark progression
- **bbttcc-territory**: Tracks Administrative actions for governance Sparks
- **bbttcc-radiation**: Future integration planned for purification themes

### Faction Rewards
Gathering Sparks provides massive Organization Point bonuses:
- **Spark of Mercy**: +50 Diplomacy, +25 Soft Power
- **Spark of Severity**: +50 Violence, +25 Discipline  
- **Spark of Understanding**: +50 Economy, +25 Intrigue

### Hex Bonuses
Gathered Sparks allow permanent Sephirothic alignment of controlled territories, providing lasting mechanical benefits.

## 🎯 Design Philosophy

The Great Work transforms BBTTCC from a game about conquering the wasteland into a game about **healing** the wasteland. Every tactical decision becomes a moral choice, every character build becomes a journey of growth, and every victory requires wisdom rather than just strength.

This system proves that the greatest enemies are not external threats, but our own pride, fear, and ego - and that true victory comes not from defeating others, but from perfecting ourselves.

---

**🌟 "When the last Spark is gathered, the Ego-Dragon shall rise for the ultimate confrontation..."**

*Built with ❤️ for the BBTTCC community using modern FoundryVTT development practices*