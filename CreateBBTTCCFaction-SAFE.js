// BBTTCC Faction Creation Macro - SAFE VERSION
// Handles initialization timing issues

// Wait for game to be fully ready
if (!game?.ready || !game?.user) {
  ui.notifications?.warn('Game is still initializing. Please wait a moment and try again.');
  return;
}

// Check if user is GM (with null safety)
if (!game.user?.isGM) {
  ui.notifications?.warn('Only GMs can create factions.');
  return;
}

// Enhanced faction name prompt
async function promptForFactionName() {
  try {
    return await Dialog.prompt({
      title: "Create BBTTCC Faction",
      content: `
        <form>
          <div class="form-group">
            <label>Faction Name:</label>
            <input type="text" name="factionName" placeholder="Enter faction name..." autofocus required />
          </div>
        </form>
      `,
      label: "Create Faction",
      callback: (html) => {
        const name = html.find('input[name="factionName"]').val()?.trim();
        return name || null;
      },
      rejectClose: false
    });
  } catch (error) {
    console.error('Error in faction name prompt:', error);
    return null;
  }
}

// Safe API detection
function getBBTTCCAPI() {
  // Check modern API first
  const factionsModule = game.modules?.get('bbttcc-factions');
  if (factionsModule?.active && factionsModule?.api?.createFaction) {
    return { api: factionsModule.api, source: 'module.api' };
  }
  
  // Check legacy window API
  if (window.BBTTCCFactions?.createFaction) {
    return { api: window.BBTTCCFactions, source: 'window (legacy)' };
  }
  
  return null;
}

// Main execution with comprehensive safety checks
async function createBBTTCCFactionSafe() {
  try {
    // Validate module
    const factionsModule = game.modules?.get('bbttcc-factions');
    
    if (!factionsModule) {
      ui.notifications.error('BBTTCC Factions module not found. Please ensure it is installed.');
      return;
    }
    
    if (!factionsModule.active) {
      ui.notifications.error('BBTTCC Factions module is not enabled. Please enable it in Module Management.');
      return;
    }
    
    // Get faction name
    const factionName = await promptForFactionName();
    if (!factionName) {
      console.log('BBTTCC Macro | User cancelled faction creation');
      return;
    }
    
    // Get API
    const apiResult = getBBTTCCAPI();
    if (!apiResult) {
      ui.notifications.error('BBTTCC Factions API not available. Module may still be initializing.');
      return;
    }
    
    console.log(`BBTTCC Macro | Using API: ${apiResult.source}`);
    
    // Create faction
    const faction = await apiResult.api.createFaction({ name: factionName });
    
    if (faction) {
      ui.notifications.info(`Faction "${faction.name}" created successfully!`);
      console.log('BBTTCC Macro | Success:', faction);
      
      // Try to open the faction sheet
      setTimeout(() => {
        try {
          if (faction?.sheet) {
            faction.sheet.render(true);
          }
        } catch (error) {
          console.warn('Could not auto-open faction sheet:', error);
        }
      }, 500);
      
    } else {
      ui.notifications.warn('Faction creation completed but returned no faction object.');
    }

  } catch (error) {
    ui.notifications.error(`Failed to create faction: ${error.message}`);
    console.error('BBTTCC Macro | Error:', error);
  }
}

// Execute the safe macro
await createBBTTCCFactionSafe();