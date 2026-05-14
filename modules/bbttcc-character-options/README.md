# 🎭 BBTTCC Character Options v4.8.1-ENHANCED

**Comprehensive character customization options for the BBTTCC Strategic Warfare Suite**

Transform your post-apocalyptic characters from simple adventurers into faction leaders with rich backgrounds, specialized skills, and strategic abilities that directly impact your organization's power and influence.

## 🌟 Features

### **6 Complete Character Option Categories**
- **Character Archetypes** - Your fundamental role and background (Warlord, Hierophant, Mayor, etc.)
- **Crew Types** - The nature of your followers and organization (Mercenaries, Diplomats, Survivors, etc.)
- **Occult Associations** - Mystical traditions and secret knowledge (Kabbalist, Alchemist, Gnostic, etc.)
- **Political Affiliations** - Your ideological alignment (Democrat, Communist, Monarchist, etc.)
- **Enlightenment Levels** - Spiritual advancement stages (Sleeper → Awakened → Transcendent)
- **Sephirothic Alignments** - Cosmic influences and divine attributes (Keter, Chokmah, Tiferet, etc.)

### **Strategic Integration**
- **Organization Point Bonuses** - Each option provides specific OP bonuses to your faction
- **Tiered Progression** - Benefits scale with character level (Levels 1, 5, 11, 17)
- **Tactical & Strategic Abilities** - Both personal combat benefits and faction-wide strategic advantages
- **Cross-Module Compatibility** - Seamlessly integrates with all BBTTCC modules

### **Professional Implementation**
- **FoundryVTT v13+ Compatible** - Modern module architecture
- **D&D 5e Integration** - Implemented as standard feat items
- **Compendium Packs** - Organized, searchable content libraries
- **Automated Bonuses** - Optional auto-application of OP bonuses to linked factions

## 📦 Installation

### **Requirements**
- FoundryVTT v13.0+
- D&D 5e System v5.0+ (v5.4+ recommended)
- **BBTTCC Factions Module** (required)

### **Recommended Modules**
- BBTTCC Territory Control
- BBTTCC Raid Planner
- BBTTCC Radiation Tracker
- BBTTCC Tikkun System

### **Installation Steps**
1. Download the module from the releases page
2. Extract to your FoundryVTT modules folder
3. Enable "BBTTCC Character Options" in Module Management
4. Restart your world
5. The compendium packs will be available in your Items directory

## 🎮 Quick Start Guide

### **Step 1: Choose Your Character Options**
1. Open the **BBTTCC Character Archetypes** compendium
2. Drag your chosen archetype (e.g., "Archetype: Warlord") to your character sheet
3. Repeat for other categories as desired

### **Step 2: Link to Your Faction** (Optional)
```javascript
// In FoundryVTT console
const character = game.actors.get("CHARACTER_ID");
const faction = game.actors.get("FACTION_ID");
await character.setFlag('bbttcc-character-options', 'linkedFaction', faction.id);
```

### **Step 3: Apply Bonuses**
- **Automatic**: Enable "Auto-Apply OP Bonuses" in module settings
- **Manual**: Use the character sheet integration or console commands

## 📚 Character Options Overview

### **🎯 Character Archetypes**
Define your fundamental role and provide major OP cap increases:

- **Warlord** - +3 Violence OP cap, battlefield command abilities
- **Hierophant** - +3 Soft Power OP cap, spiritual leadership benefits  
- **Mayor/Administrator** - +3 Economy OP cap, logistics expertise
- **Wizard/Scholar** - +2 Intrigue OP cap, knowledge-based advantages
- **Ancient Blood** - +2 Soft Power OP cap, psychic abilities and lineage benefits
- **Squad Leader** - +1 Violence & Intrigue OP caps, elite NPC squadmates

### **⚔️ Crew Types**
Determine your followers' nature and provide major starting OP bonuses:

- **Mercenary Band** - +8 Violence OPs, combat scenario bonuses
- **Peacekeeper Corps** - +8 Non-Lethal OPs, defensive advantages  
- **Covert Ops Cell** - +8 Intrigue OPs, infiltration specialists
- **Cultural Ambassadors** - +8 Soft Power OPs, propaganda warfare
- **Diplomatic Envoys** - +8 Diplomacy OPs, negotiation mastery
- **Survivors/Militia** - Balanced +2 to four OP types, resilience benefits

### **🔮 Occult Associations**
Connect to mystical traditions with specialized knowledge:

- **Kabbalist** - Sephirothic awareness, +3 Soft Power OPs
- **Alchemist** - Transmutation mastery, +3 Economy OPs
- **Tarot Mage** - Divination abilities, +3 Intrigue OPs
- **Gnostic** - Reality perception, philosophical influence
- **Goetic Summoner** - Entity binding, +2 Violence & Intrigue OPs
- **Rosicrucian** - Enlightened networks, +3 Diplomacy OPs

### **🏛️ Political Affiliations**
Shape your faction's ideology with "Best" and "Worst" aspects:

- **Democrat** - High diplomacy, potential for gridlock
- **Communist** - Centralized planning, diplomatic challenges
- **Socialist** - Social safety nets, bureaucratic overhead
- **Capitalist** - Economic dynamism, inequality issues
- **Monarchist** - Traditional stability, rigid hierarchies
- **Theocrat** - Spiritual guidance, sectarian conflicts
- **Militarist** - Disciplined efficiency, authoritarian tendencies
- **Fascist** - Nationalistic unity, totalitarian risks
- **Tribalist** - Community cohesion, xenophobic limitations
- **Anarchist** - Individual freedom, structural challenges
- **Meritocrat** - Competency-based leadership, elitist potential
- **Oligarch** - Growth-oriented wealth concentration

### **✨ Enlightenment Levels**
Progress through spiritual advancement stages:

- **Sleeper** - Unawakened to deeper mysteries
- **Awakened** - +1 Wisdom saves, Spark awareness
- **Adept** - Sephirothic understanding, moral guidance
- **Illuminated** - Aura of Clarity, land blessing abilities
- **Transcendent** - Minor miracles, Darkness Track reduction
- **Qliphothic** - Dark enlightenment path (corruption route)

### **🌟 Sephirothic Alignments**
Cosmic influences affecting characters and territories:

- **Keter (Crown)** - Divine authority, universal bonuses
- **Chokmah (Wisdom)** - Intuitive insight, research acceleration
- **Binah (Understanding)** - Structural comprehension, stability
- **Chesed (Mercy)** - Boundless compassion, population growth
- **Gevurah (Severity)** - Righteous discipline, defensive strength
- **Tiferet (Harmony)** - Perfect balance, inspiring beauty
- **Netzach (Victory)** - Enduring drive, high morale
- **Hod (Glory)** - Analytical mastery, technological advancement
- **Yesod (Foundation)** - Deep connection, communication excellence
- **Malkuth (Kingdom)** - Material mastery, resource abundance

## 🛠️ Advanced Usage

### **Console Commands**
```javascript
// Get character options API
const api = game.modules.get('bbttcc-character-options').api;

// Check if item is a character option
api.isCharacterOption(item);

// Get all character options for an actor
api.getCharacterOptions(actor);

// Calculate total bonuses
api.calculateBonuses(actor);

// Apply option manually
api.applyCharacterOption(actor, item);
```

### **Integration with Other Modules**
The character options automatically work with:
- **Territory Control** - Political affiliations affect hex alignment
- **Raid Planning** - Crew types provide scenario bonuses
- **Radiation Tracking** - Some archetypes have rad resistance
- **Tikkun System** - Enlightenment levels affect spiritual progression

### **Custom Integration**
```javascript
// Listen for character option events
Hooks.on('bbttcc-character-options.optionApplied', (data) => {
    console.log(`${data.option.name} applied to ${data.actor.name}`);
});
```

## 🎭 Roleplaying Guidelines

### **Building Your Character's Story**
Each character option provides rich roleplaying opportunities:

1. **Choose options that create internal tension** - A Democratic Warlord or Socialist Oligarch
2. **Consider your faction's needs** - Match crew types to your strategic goals
3. **Plan character progression** - How will your enlightenment journey unfold?
4. **Embrace the "Worst" aspects** - They create the best dramatic moments

### **Example Character Builds**

**🗡️ The Reluctant Warlord**
- *Archetype*: Warlord (+3 Violence OP cap)
- *Crew*: Survivors/Militia (balanced OPs, resilience)
- *Political*: Socialist (compassion vs. military efficiency)
- *Enlightenment*: Adept (moral guidance in warfare)
- *Story*: A military leader struggling to balance necessary violence with humanitarian ideals

**🎭 The Charismatic Revolutionary** 
- *Archetype*: Hierophant (+3 Soft Power OP cap)
- *Crew*: Cultural Ambassadors (+8 Soft Power OPs)
- *Political*: Communist (ideological purity)
- *Occult*: Gnostic (sees through propaganda)
- *Story*: A spiritual leader using faith and culture to build a new society

**🏛️ The Pragmatic Builder**
- *Archetype*: Mayor/Administrator (+3 Economy OP cap)
- *Crew*: Diplomatic Envoys (+8 Diplomacy OPs)  
- *Political*: Meritocrat (competency-based leadership)
- *Enlightenment*: Illuminated (inspires others)
- *Story*: A practical leader focused on rebuilding civilization through cooperation

## 🔧 Module Settings

### **Auto-Apply OP Bonuses**
- **Default**: Enabled
- **Description**: Automatically applies Organization Point bonuses when character options are added to characters with linked factions

### **Show Enhanced Tooltips**
- **Default**: Enabled  
- **Description**: Displays detailed tooltips explaining strategic benefits and mechanical effects

## 🤝 Integration Examples

### **Session Zero Character Creation**
1. Players choose their character options collaboratively
2. DM ensures faction synergy and party balance
3. Political affiliations create interesting inter-party dynamics
4. Enlightenment levels provide shared spiritual goals

### **Mid-Campaign Character Development**
- Characters can gain new Enlightenment Levels through story progression
- Political Affiliations can shift based on faction experiences
- New Occult Associations can be discovered through exploration
- Crew Types can evolve as the faction grows and changes

## 🏆 Best Practices

### **For Players**
- **Balance is key** - Don't min-max; choose options that create interesting stories
- **Coordinate with party** - Ensure faction synergy and complementary abilities  
- **Embrace complexity** - The most interesting characters have conflicting motivations
- **Think long-term** - Plan how your character will grow and change

### **For GMs**
- **Use the "Worst" aspects** - They're not penalties but story opportunities
- **Create faction interactions** - Political differences drive great conflicts
- **Reward progression** - Enlightenment advancement should feel earned
- **Integrate with setting** - Make character backgrounds matter to the world

## 📋 Troubleshooting

### **Common Issues**
- **Options not appearing**: Ensure module is enabled and world restarted
- **Bonuses not applying**: Check faction linking and auto-apply settings
- **Compendium empty**: Run the item generation script in console
- **Cross-module issues**: Verify all BBTTCC modules are compatible versions

### **Console Diagnostics**
```javascript
// Run module diagnostics
const api = game.modules.get('bbttcc-character-options').api;
api.runDiagnostics ? await api.runDiagnostics() : 'API not ready';
```

## 🎯 Future Plans

- **Additional Archetypes** - Expanded character role options
- **Cultural Variations** - Regional differences for political affiliations  
- **Advanced Enlightenment** - Additional spiritual progression paths
- **Custom Builder** - In-game character option creation tools
- **Visual Sheets** - Enhanced character sheet integration

## 🙏 Credits

- **Module Development**: BBTTCC Team
- **Foundry Integration**: Modern v13+ patterns and best practices
- **D&D 5e Compatibility**: Professional feat item implementation  
- **Community**: Playtesting and feedback from BBTTCC community

## 📄 License

This module is licensed under the MIT License. Feel free to modify and redistribute according to your needs.

---

*Part of the BBTTCC Strategic Warfare Suite - Transform your D&D campaign into an epic post-apocalyptic strategic experience!*