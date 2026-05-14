# BBTTCC Auto-Link Module

Automatically links BBTTCC character creation options to faction Organization Points.

## Features

- **Automatic OP Application**: When characters are created with BBTTCC feats, their OP bonuses are automatically applied to their assigned faction
- **Multiple Hook Points**: Catches character creation, feat addition, faction assignment, and sheet rendering
- **Persistent**: Loads automatically on game boot and persists through restarts
- **Smart Processing**: Only processes characters with both BBTTCC feats and faction assignments
- **Manual Controls**: Provides API for manual processing when needed

## Installation

1. Copy the `bbttcc-auto-link` folder to your Foundry modules directory:
   ```
   [Foundry Data]/modules/bbttcc-auto-link/
   ```

2. Enable the module in Foundry VTT's Module Management

3. Restart Foundry VTT

## Dependencies

Requires these BBTTCC modules to be active:
- `bbttcc-factions`
- `bbttcc-territory`
- `bbttcc-character-options`

## Usage

The module works automatically once enabled. It will:

1. Monitor character creation for BBTTCC characters
2. Detect when BBTTCC feats are added to characters
3. Watch for faction assignments
4. Automatically calculate and apply OP bonuses to factions

## Manual API

Available functions:
- `BBTTCCAutoLink.processCharacter(actor)` - Process specific character
- `BBTTCCAutoLink.processAllCharacters()` - Process all existing characters
- `BBTTCCAutoLink.calculateOPs(actor)` - Calculate OPs for character

## Supported OP Types

- Violence
- Diplomacy
- Economy
- Intrigue
- Logistics
- Culture
- Faith
- Soft Power
- Non-Lethal

## Version

1.0.0 - Initial release with comprehensive auto-linking functionality