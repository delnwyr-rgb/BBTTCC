// modules/bbttcc-world/scripts/save-toolbar-button.js
// 💾 Saves button on the Bad Eden control bar (GM only) — same pattern as
// bbttcc-campaign's Campaigns button.
(() => {
  const ID = "bbttcc-save-btn";
  function ensure() {
    try {
      if (!game.user?.isGM) { document.getElementById(ID)?.remove?.(); return; }
      const toolbar = document.querySelector("#bbttcc-toolbar");
      if (!toolbar || toolbar.querySelector(`#${ID}`)) return;
      const row = toolbar.querySelector(".bbttcc-toolbar-main") || toolbar.querySelector(".row") || toolbar;
      const btn = document.createElement("button");
      btn.id = ID;
      btn.className = "bbttcc-btn";
      btn.type = "button";
      btn.title = "Save Games — full world save slots + the golden master";
      btn.innerHTML = `<i class="fas fa-save"></i><span>Saves</span>`;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        try { globalThis.BBTTCCSaveGameApp?.open?.(); } catch (e) { console.warn("[bbttcc-world/save-btn]", e); }
      });
      row.appendChild(btn);
    } catch (e) { console.warn("[bbttcc-world/save-btn]", e); }
  }
  Hooks.on("canvasReady", ensure);
  Hooks.on("renderSceneControls", ensure);
  Hooks.once("ready", ensure);
})();
