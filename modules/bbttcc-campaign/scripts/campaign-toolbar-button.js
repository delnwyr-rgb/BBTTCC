// modules/bbttcc-campaign/scripts/campaign-toolbar-button.js
// BBTTCC Campaign Builder — Control Bar button hook (top-bar edition)

const MOD_CAM = "bbttcc-campaign";
const NS_CAM  = "[bbttcc-campaign]";
const camLog  = (...a) => console.log(NS_CAM, ...a);

function openCampaignBuilderFromButton() {
  try {
    const fn =
      game.bbttcc?.api?.campaign?.openBuilder ||
      game.modules.get(MOD_CAM)?.api?.openBuilder ||
      null;

    if (typeof fn !== "function") {
      ui.notifications?.warn?.("BBTTCC Campaign Builder API not available.");
      return;
    }

    fn();
  } catch (e) {
    console.error(NS_CAM, "Failed to open Campaign Builder from toolbar button:", e);
    ui.notifications?.error?.("Could not open BBTTCC Campaign Builder — see console.");
  }
}

function cleanupCampaignButtons() {
  try {
    document.querySelector("#bbttcc-campaign-btn")?.remove?.();
    document.querySelector("#bbttcc-campaign-fallback")?.remove?.();
  } catch (_e) {}
}

function getToolbarRoot() {
  return document.querySelector("#bbttcc-toolbar");
}

function getToolbarMainRow(toolbar) {
  return (
    toolbar?.querySelector(".bbttcc-toolbar-main") ||
    toolbar?.querySelector(".row") ||
    toolbar
  );
}

function ensureCampaignButton() {
  if (!game.user?.isGM) {
    cleanupCampaignButtons();
    return;
  }

  const toolbar = getToolbarRoot();
  if (!toolbar) return;

  if (toolbar.querySelector("#bbttcc-campaign-btn")) return;

  const row = getToolbarMainRow(toolbar);

  const btn = document.createElement("button");
  btn.id = "bbttcc-campaign-btn";
  btn.className = "bbttcc-btn";
  btn.type = "button";
  btn.title = "Open BBTTCC Campaign Builder";
  btn.innerHTML = `<i class="fas fa-project-diagram"></i><span>Campaigns</span>`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    openCampaignBuilderFromButton();
  });

  row.appendChild(btn);
  camLog("Campaign Builder button attached to control bar main row.");
}

Hooks.on("canvasReady", ensureCampaignButton);
Hooks.on("renderSceneControls", ensureCampaignButton);
Hooks.once("ready", () => {
  camLog("Campaign Builder toolbar button hook ready.");
  ensureCampaignButton();
});