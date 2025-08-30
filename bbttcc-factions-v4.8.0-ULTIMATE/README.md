# BBTTCC Factions v4.8.0 - ULTIMATE

Strategic faction management for FoundryVTT using the D&D 5e system. Part of the BBTTCC Strategic Warfare Suite.

## Features

### Organization Points System
- **Violence**: Direct military action and combat
- **Non-Lethal**: Subduing and capture operations  
- **Intrigue**: Espionage and covert operations
- **Economy**: Trade, resources, and financial power
- **Soft Power**: Influence, reputation, and cultural impact
- **Diplomacy**: Negotiation and alliance building

### Advanced Faction Management
- Custom faction actor sheets with dedicated UI
- Territory control and resource management
- War log for tracking faction history
- Base establishment and management
- Power level calculation and status tracking
- Cross-faction relationship system

### Modern FoundryVTT Integration
- FoundryVTT v13+ compatibility
- D&D 5e system v5.1+ support
- Modern Application V2 sheet architecture
- Hook-based API exposure for module integration
- Comprehensive error handling and validation

## Installation

1. Extract to your FoundryVTT `Data/modules/` directory
2. Rename folder to `bbttcc-factions` (remove version suffix)
3. Enable the module in Foundry VTT
4. Restart if necessary

## Usage

### Creating Factions
- Use the included macro or the context menu
- Factions automatically use the custom BBTTCC sheet
- Organization Points are initialized automatically

### Managing Organization Points
- Adjust values using +/- buttons
- Roll checks using the d20 button next to each OP
- Track totals and power levels automatically

### Territory Integration
- Works with BBTTCC Territory module
- Territories automatically link to faction data
- Resource generation based on controlled areas

### War Log & History
- Track important faction events
- Automatic entries for territory changes
- Custom entries for diplomatic events

## API

### Module API Access
```javascript
// Modern API (recommended)
const api = game.modules.get('bbttcc-factions').api;
await api.createFaction({ name: "My Faction" });

// Legacy compatibility
const faction = await window.BBTTCCFactions.createFaction();
```

### Available Methods
- `createFaction(data)` - Create new faction
- `getFactionData(actor)` - Get faction-specific data
- `updateFactionOPs(actor, opType, value)` - Update organization points
- `validateFaction(actor)` - Validate faction data structure

## Compatibility

- **FoundryVTT**: v13.0+ required
- **System**: D&D 5e v5.1+ required
- **Modules**: 
  - Integrates with other BBTTCC modules
  - No required dependencies

## Settings

- **Enable Macro Integration**: Allow macro-based faction creation
- **Debug Mode**: Enable detailed console logging

## Troubleshooting

### Common Issues
1. **Deprecation warnings**: Ensure you're using v4.8.0 with modern patterns
2. **Sheet not opening**: Check that the module is properly enabled
3. **Missing OPs**: Delete and recreate faction, or manually assign sheet

### Debug Information
Enable debug mode in settings for detailed logging of all operations.

## Version History

### v4.8.0 - ULTIMATE
- Complete modernization for FoundryVTT v13+
- Fixed all deprecation warnings
- Enhanced error handling and validation
- Cross-module integration improvements
- Modern Application V2 sheet architecture

## Support

For issues and feature requests, check the module's GitHub repository or contact the BBTTCC development team.

## License

MIT License - see LICENSE file for details.