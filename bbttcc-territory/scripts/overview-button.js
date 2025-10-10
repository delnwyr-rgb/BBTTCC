// modules/bbttcc-territory/scripts/overview-button.js
// v0.1.0 — Adds an "Overview" button to the BBTTCC floating toolbar.
// Safe: retries briefly until the toolbar exists; no other behavior touched.

const MOD = "bbttcc-territory";
const LOG = (...a) => console.log(`[${MOD}]`, ...a);

function addOverviewButton() {
  const bar = document.getElementById("bbttcc-toolbar");
  if (!bar) return false;

  // Avoid duplicates
  if (bar.querySelector("[data-bbttcc-overview]")) return true;

  const btn = document.createElement("button");
  btn.setAttribute("data-bbttcc-overview", "1");
  btn.innerHTML = `<i class="fas fa-list"></i> Overview`;
  btn.style.cursor = "pointer";
  btn.addEventListener("click", () => {
    game.bbttcc?.api?.territory?.openCampaignOverview?.() ??
      ui.notifications?.warn?.("Campaign Overview is not available.");
  });

  // Insert near Dashboard for discoverability
  const dash = [...bar.querySelectorAll("button")].find(b => /Dashboard/i.test(b.textContent || ""));
  if (dash && dash.nextSibling) bar.insertBefore(btn, dash.nextSibling);
  else bar.appendChild(btn);

  return true;
}

Hooks.once("ready", () => {
  // Try immediately, then retry a few times in case the toolbar is created later.
  let tries = 0;
  const max = 20;        // ~5s total
  const tick = () => {
    if (addOverviewButton()) {
      LOG("Overview button added to toolbar.");
      return;
    }
    if (++tries < max) setTimeout(tick, 250);
    else console.warn(`[${MOD}] Could not attach Overview button — toolbar not found.`);
  };
  tick();
});
