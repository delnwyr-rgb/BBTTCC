// modules/bbttcc-core/scripts/story.gottgait.js
(() => {
  const TAG = "[GOTTGAIT Story]";
  const MODULE_ID = "bbttcc-core";
  const SETTING_KEY = "gottgaitStoryState";

  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, SETTING_KEY, {
      name: "GOTTGAIT Story State",
      hint: "Internal storage for the GOTTGAIT adventure story engine.",
      scope: "world",
      config: false,
      type: Object,
      default: {}
    });
    console.log(TAG, "Registered world setting", `${MODULE_ID}.${SETTING_KEY}`);
  });

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.story ??= {};

    function getState() {
      try { return game.settings.get(MODULE_ID, SETTING_KEY) ?? {}; }
      catch (e) { console.warn(TAG, "getState failed:", e); return {}; }
    }

    async function setState(state) {
      await game.settings.set(MODULE_ID, SETTING_KEY, state);
      return state;
    }

    async function updateState(patch) {
      const state = getState();
      Object.assign(state, patch);
      return setState(state);
    }

    async function logBeat(message, data = {}) {
      console.log(TAG, "BEAT:", message, data);
      const state = getState();
      state.beats ??= [];
      state.beats.push({ ts: Date.now(), message, data });
      await setState(state);
    }

    function getAPIs() {
      const api = game.bbttcc?.api ?? {};
      return {
        raid: api.raid,
        encounters: api.encounters,
        travel: api.travel,
        turn: api.turn
      };
    }

    function _listFactionActors() {
      try {
        const all = Array.from(game.actors ?? []);
        // “Faction actors” are those that have bbttcc-factions flags
        return all.filter(a => !!a?.flags?.["bbttcc-factions"]);
      } catch {
        return [];
      }
    }

    async function _promptForContext() {
      const state = getState();

      const factionActors = _listFactionActors();
      const factionOptions = factionActors
        .map(a => `<option value="${a.uuid}">${a.name}</option>`)
        .join("");

      const content = `
        <form class="bbttcc-form">
          <div class="form-group">
            <label>Story Faction (Faction Actor)</label>
            <select name="factionUuid">
              ${factionOptions || `<option value="">(No faction actors found)</option>`}
            </select>
            <p class="notes">This is the default <b>Faction</b> used by Story Console buttons.</p>
          </div>

          <div class="form-group">
            <label>Story Hex ID</label>
            <input type="text"
                   name="hexUuid"
                   value="${state.storyHexUuid || ""}"
                   placeholder="e.g. test-hex-17" />
            <p class="notes">This is your BBTTCC <b>hexUuid</b> (raw string). Not a Foundry UUID.</p>
          </div>
        </form>
      `;

      return await new Promise(resolve => {
        new Dialog({
          title: "GOTTGAIT: Bind Story Context",
          content,
          buttons: {
            save: {
              icon: '<i class="fas fa-save"></i>',
              label: "Save",
              callback: html => {
                const form = html[0]?.querySelector("form");
                const fd = new FormData(form);
                resolve({
                  storyFactionUuid: String(fd.get("factionUuid") || "").trim() || null,
                  storyHexUuid: String(fd.get("hexUuid") || "").trim() || null
                });
              }
            },
            cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
          },
          default: "save"
        }).render(true);
      });
    }

    async function ensureStoryContext() {
      const state = getState();

      let factionUuid = state.storyFactionUuid || null;
      let hexUuid = state.storyHexUuid || null;

      // Validate faction UUID
      let faction = null;
      if (factionUuid) {
        try { faction = await fromUuid(factionUuid); } catch {}
        if (!faction) factionUuid = null;
      }

      // ✅ IMPORTANT CHANGE:
      // hexUuid is a BBTTCC raw string identifier, NOT a Foundry UUID.
      // We accept it as-is (no fromUuid validation), so we don't re-prompt forever.

      if (!factionUuid || !hexUuid) {
        const picked = await _promptForContext();
        if (!picked) throw new Error(`${TAG} Story context not bound (cancelled).`);

        factionUuid = picked.storyFactionUuid || factionUuid;
        hexUuid = picked.storyHexUuid || hexUuid;

        await updateState({ storyFactionUuid: factionUuid, storyHexUuid: hexUuid });
      }

      // Re-resolve faction after save
      faction = factionUuid ? await fromUuid(factionUuid) : null;
      if (!faction) throw new Error(`${TAG} No valid faction bound to story context.`);
      return { faction, hexUuid };
    }

    async function planActivity({ factionId, activityKey, targetUuid, label }) {
      const { raid } = getAPIs();
      if (!raid?.planActivity) {
        ui.notifications?.warn?.("GOTTGAIT Story: raid.planActivity not available.");
        return null;
      }
      const payload = { factionId, activityKey, targetUuid, label };
      console.log(TAG, "Planning Strategic Activity via raid.planActivity:", payload);
      const result = await raid.planActivity(payload);
      await logBeat("Strategic Activity Planned", payload);
      return result;
    }

    async function maybeAdvanceTurn({ label = "GOTTGAIT Demo Turn" } = {}) {
      const { turn } = getAPIs();
      if (!turn?.advanceTurn) return;
      try { await turn.advanceTurn({ source: "gottgait-story", label }); }
      catch (e) { console.warn(TAG, "turn.advanceTurn failed:", e); }
    }

    const gottgait = {
      getState,
      setState,
      updateState,
      logBeat,

      async bindContext() {
        const picked = await _promptForContext();
        if (!picked) return null;
        await updateState(picked);
        ui.notifications?.info?.("GOTTGAIT story context saved.");
        return picked;
      },

      async runBeat(key, arg) {
        const { faction, hexUuid } = await ensureStoryContext();

        switch (key) {
          case "act0.claim_hex": {
            await logBeat("Act 0: Claim Hex / Outpost", { faction: faction.name, hexUuid });
            ui.notifications?.info?.(`Act0 claim_hex bound to ${faction.name} @ ${hexUuid}`);
            return;
          }

          case "turn.establish_outpost": {
            await planActivity({
              factionId: faction.id,
              activityKey: "establish_outpost",
              targetUuid: hexUuid,
              label: "Story Console: Establish Outpost"
            });
            await maybeAdvanceTurn({ label: "GOTTGAIT: Establish Outpost" });
            return;
          }

          default: {
            await logBeat("Story Beat (unhandled)", { key, arg, faction: faction.name, hexUuid });
            ui.notifications?.warn?.(`GOTTGAIT: Beat '${key}' not yet wired in this build.`);
            return;
          }
        }
      },

      getStage() {
        const s = getState();
        return s.stage || "none";
      }
    };

    game.bbttcc.api.story.gottgait = gottgait;
    console.log(TAG, "Installed game.bbttcc.api.story.gottgait (world-safe)");
  });
})();
