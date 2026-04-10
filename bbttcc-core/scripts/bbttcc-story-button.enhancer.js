// modules/bbttcc-core/scripts/bbttcc-story-button.enhancer.js
// BBTTCC — GM toolbar button for Mal's GOTTGAIT Story Console.
//
// Adds a "Story" button to the existing #bbttcc-toolbar cluster.
// Clicking it calls game.bbttcc.api.story.openGOTTGAITConsole().

(() => {
  const TAG = "[bbttcc-ui/story-button]";

  function attachStoryButton() {
    try {
      if (!game.user?.isGM) return false;

      const storyApi = game.bbttcc?.api?.story;
      if (!storyApi?.openGOTTGAITConsole) {
        // Story API not ready yet; try again later.
        return false;
      }

      const toolbar = document.getElementById("bbttcc-toolbar");
      if (!toolbar) return false;

      // Avoid duplicates
      if (toolbar.querySelector('a.bbttcc-btn[data-act="gottgait-story"]')) return true;

      // Put it on the first .row, or toolbar root if rows aren't used
      const row = toolbar.querySelector(".row") || toolbar;

      const btn = document.createElement("a");
      btn.className = "bbttcc-btn btn";
      btn.dataset.act = "gottgait-story";
      btn.innerHTML = `<i class="fas fa-book-open"></i><span>Story</span>`;

      btn.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          try {
            storyApi.openGOTTGAITConsole();
          } catch (e) {
            console.error(TAG, "Failed to open Story Console:", e);
            ui.notifications?.error?.("Could not open GOTTGAIT Story Console — see console.");
          }
        },
        { capture: true }
      );

      row.appendChild(btn);
      console.log(TAG, "Attached GOTTGAIT Story button to GM toolbar.");
      return true;
    } catch (e) {
      console.warn(TAG, "attachStoryButton failed:", e);
      return false;
    }
  }

  function watchToolbar() {
    if (attachStoryButton()) return;

    // If toolbar or story API aren't ready yet, watch the DOM and try again
    const obs = new MutationObserver(() => {
      if (attachStoryButton()) {
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    globalThis.__bbttccStoryToolbarObserver = obs;
  }

  Hooks.once("ready", () => {
    // Try once after everything is ready...
    watchToolbar();
    // ...and also on canvasReady, in case toolbar is canvas-dependent.
    Hooks.on("canvasReady", watchToolbar);
  });
})();
