// modules/bbttcc-world/apps/save-game-app.js
// Bad Eden — Save Games window (2026-09-08). GM-only. See api.save.js for
// what a slot holds and how a load works.
(() => {
  const MOD = "bbttcc-world";
  const TAG = "[bbttcc-world/save-app]";
  const warn = (...a) => console.warn(TAG, ...a);
  const esc = (s) => { try { return foundry.utils.escapeHTML(String(s ?? "")); } catch (_e) { return String(s ?? ""); } };
  const api = () => game.bbttcc?.api?.world?.saves;

  const AppV2 = foundry?.applications?.api?.ApplicationV2;
  const HBS = foundry?.applications?.api?.HandlebarsApplicationMixin;
  if (!AppV2 || !HBS) { warn("ApplicationV2 unavailable — save window not installed"); return; }

  const fmtBytes = (n) => { n = Number(n) || 0; return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`; };
  const fmtWhen = (ts) => { try { return new Date(Number(ts) || 0).toLocaleString(); } catch (_e) { return ""; } };

  class BBTTCCSaveGameApp extends HBS(AppV2) {
    static get PARTS() { return { content: { template: "modules/bbttcc-world/templates/save-game.hbs" } }; }
    static DEFAULT_OPTIONS = {
      id: "bbttcc-save-game",
      classes: ["bbttcc-save-game-app", "bbttcc", "bbttcc-be", "bbttcc-theme-gm"],
      tag: "section",
      window: { title: "Bad Eden — Save Games", icon: "fas fa-save", resizable: true },
      position: { width: 800, height: 720 }   // a fixed height so the list scrolls inside (2026-09-21)
    };
    static _instance = null;
    static open() {
      if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
      if (!this._instance) this._instance = new this();
      this._instance.render(true, { focus: true });
      return this._instance;
    }

    constructor(options) { super(options || {}); this._status = ""; this._busy = false; }

    async _prepareContext() {
      const a = api();
      const slots = (a?.list?.() || []).map(s => ({
        ...s,
        when: fmtWhen(s.at),
        size: fmtBytes(s.bytes),
        summary: s.counts ? `${s.counts.actors} actors · ${s.counts.items} items · ${s.counts.scenes} scenes / ${s.counts.drawings} hexes · ${s.counts.settings} settings` : ""
      }));
      const others = game.users.filter(u => u.active && u.id !== game.user.id).map(u => u.name);
      return { slots, golden: slots.find(s => s.golden) || null, dir: a?.dir?.() || "", others, status: this._status, busy: this._busy };
    }

    _setStatus(text) {
      this._status = text;
      const el = this.element?.querySelector?.("[data-bind='status']");
      if (el) el.textContent = text;
    }

    async _run(label, fn) {
      if (this._busy) return;
      this._busy = true;
      try { await fn(); }
      catch (e) { warn(label, e); ui.notifications?.error?.(`${label} failed — see console (F12).`); this._setStatus(`✗ ${label} failed: ${e?.message || e}`); }
      finally { this._busy = false; try { this.render(false); } catch (_e) {} }
    }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      const root = this.element;
      if (!root) return;

      root.querySelector("[data-action='save']")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        const label = String(root.querySelector("[name='label']")?.value || "").trim();
        const goldenNow = !!root.querySelector("[name='golden']")?.checked;
        this._run("Save", async () => {
          this._setStatus("💾 capturing the world…");
          const row = await api().save({ label, golden: goldenNow });
          ui.notifications?.info?.(`Saved “${row.label}” (${fmtBytes(row.bytes)}).`);
          this._setStatus(`✓ saved “${row.label}” — ${fmtBytes(row.bytes)}`);
        });
      });

      root.querySelector("[data-action='refresh']")?.addEventListener("click", (ev) => { ev.preventDefault(); this.render(false); });
      root.querySelector("[data-action='prune']")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const all = api().list(); const KEEP = 20;
        const doomed = all.filter(s => !s.golden).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0)).slice(KEEP);
        if (!doomed.length) return ui.notifications?.info?.(`Nothing to prune — ${all.length} save(s), within the newest ${KEEP}.`);
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Prune saves?" },
          content: `<p>Delete <b>${doomed.length}</b> save(s) older than the newest ${KEEP}? The golden master always stays.</p><ul class="bbttcc-muted" style="max-height:12rem;overflow:auto;font-size:.85em">${doomed.map(s => `<li>${esc(s.label)} — ${fmtWhen(s.at)}</li>`).join("")}</ul><p class="bbttcc-muted">Each slot leaves the list and its file is overwritten with a stub.</p>`
        });
        if (!ok) return;
        this._run("Prune", async () => { const r = await api().prune({ keep: KEEP }); this._setStatus(`🧹 pruned ${r.removed} save(s); ${r.kept} kept`); ui.notifications?.info?.(`Pruned ${r.removed} save(s).`); });
      });

      // `root` is the persistent window element, so bind the delegated slot listener once
      // per element — per render it stacked (N confirm dialogs / N downloads per click).
      if (this._slotDelegateRoot !== root) {
      this._slotDelegateRoot = root;
      root.addEventListener("click", (ev) => {
        const btn = ev.target?.closest?.("[data-slot-act]");
        if (!btn) return;
        ev.preventDefault();
        const id = String(btn.dataset.id || "");
        const act = String(btn.dataset.slotAct || "");
        if (act === "load") this._load(id);
        else if (act === "golden") this._run("Set golden", async () => { const g = await api().setGolden(id); ui.notifications?.info?.(g ? `★ Golden master: “${g.label}”` : "Golden master cleared."); });
        else if (act === "export") api().exportSlot(id);
        else if (act === "delete") this._delete(id);
      });
      }

      root.querySelector("[data-action='import']")?.addEventListener("change", (ev) => {
        const file = ev.target?.files?.[0];
        if (!file) return;
        this._run("Import", async () => {
          this._setStatus(`⬆ importing ${file.name}…`);
          const row = await api().importFile(file);
          ui.notifications?.info?.(`Imported “${row.label}”.`);
          this._setStatus(`✓ imported “${row.label}”`);
        });
      });
    }

    async _delete(id) {
      const row = api().list().find(s => s.id === id);
      if (!row) return;
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Delete save?" },
        content: `<p>Delete <b>${esc(row.label)}</b> (${fmtWhen(row.at)})?</p><p class="bbttcc-muted">The slot leaves the list and its file is overwritten with a stub. Export first if you want a copy.</p>`
      });
      if (!ok) return;
      this._run("Delete", async () => { await api().remove(id); this._setStatus(`🗑 deleted “${row.label}”`); });
    }

    async _load(id) {
      const a = api();
      const row = a.list().find(s => s.id === id);
      if (!row) return;
      this._run("Load", async () => {
        this._setStatus(`⏳ reading “${row.label}”…`);
        const snap = await a.readSlot(id);
        // Two plans, one dialog (2026-10-14): ⟲ Reset story (default) leaves the GAME layer alone — the
        // campaigns bundle, tables, catalog, tuning, library NPCs, hex definitions; Exact restore = everything.
        const ps = a.plan(snap, { mode: "story" });
        const pe = a.plan(snap, { mode: "exact" });
        const li = (t) => `<li>${t}</li>`;
        const names = (arr, n = 8) => arr.length ? `: <i>${esc(arr.slice(0, n).join(", "))}${arr.length > n ? " …" : ""}</i>` : "";
        const storyList = `
          <ul style="margin:.3rem 0 .5rem 1.1rem; font-size:.9em; line-height:1.5">
            ${li(`<b>${ps.settingsChange}</b> story settings restored · <b>${ps.settingsKeep}</b> game settings kept as they are now${ps.settingsMerge ? ` · <b>${ps.settingsMerge}</b> merged (quest registry: definitions stay, play status comes back)` : ""}${ps.settingsKeepList.length ? ` <span class="bbttcc-muted" title="${esc(ps.settingsKeepList.join(", "))}">(hover)</span>` : ""}${ps.settingsUnknown ? ` <span class="bbttcc-muted">· ${ps.settingsUnknown} no longer registered</span>` : ""}`)}
            ${li(`Stewards, factions, rigs: <b>${ps.actorsUpdate}</b> restored · <b>${ps.actorsCreate}</b> re-created · <b>${ps.actorsDelete.length}</b> made since the save${names(ps.actorsDelete)} · library NPCs: <b>${ps.actorsKept}</b> kept`)}
            ${li(`Hexes: <b>${ps.hexesMerged}</b> get their play state back (owner, builds, pressure, sparks…) — names, terrain, nodes, travel links stay · <b>${ps.hexesLiveOnly}</b> made since the save stay${ps.hexesSavedMissing ? ` · ${ps.hexesSavedMissing} removed since the save stay gone` : ""}`)}
            ${li(`Tokens on <b>${ps.scenesKnown}</b> scenes put back · Journal: <b>${ps.journal}</b> Bad Eden entries`)}
          </ul>
          ${ps.actorsDelete.length ? `<label style="display:flex;gap:.4rem;align-items:center;font-size:.9em"><input type="checkbox" name="deleteExtras" checked/> Delete the ${ps.actorsDelete.length} steward/faction/rig actor${ps.actorsDelete.length === 1 ? "" : "s"} made since the save</label>` : ""}
          ${ps.actorsDeleteGame.length ? `<label style="display:flex;gap:.4rem;align-items:center;font-size:.9em"><input type="checkbox" name="deleteGameExtras"/> Also delete the ${ps.actorsDeleteGame.length} NPC actor${ps.actorsDeleteGame.length === 1 ? "" : "s"} made since the save${names(ps.actorsDeleteGame, 6)} <span class="bbttcc-muted">(play-made crews yes; new bestiary entries no)</span></label>` : ""}`;
        const exactList = `
          <ul style="margin:.3rem 0 .5rem 1.1rem; font-size:.9em; line-height:1.5">
            ${li(`<b>${pe.settingsChange}</b> world settings change${pe.settingsUnknown ? ` <span class="bbttcc-muted">(${pe.settingsUnknown} in the save are no longer registered — skipped)</span>` : ""}`)}
            ${li(`Actors: <b>${pe.actorsUpdate}</b> restored in place · <b>${pe.actorsCreate}</b> re-created · <b>${pe.actorsDelete.length}</b> made since the save${names(pe.actorsDelete)}`)}
            ${li(`Scenes: <b>${pe.scenesKnown}</b> restored (flags, hexes, tokens)${pe.scenesMissing.length ? ` · ${pe.scenesMissing.length} in the save no longer exist (skipped)` : ""}${pe.scenesExtra.length ? ` · ${pe.scenesExtra.length} made since the save are left alone` : ""}`)}
            ${li(`Journal: <b>${pe.journal}</b> Bad Eden entries`)}
          </ul>
          ${pe.actorsDelete.length ? `<label style="display:flex;gap:.4rem;align-items:center;font-size:.9em"><input type="checkbox" name="deleteExtrasExact" checked/> Delete the ${pe.actorsDelete.length} actor${pe.actorsDelete.length === 1 ? "" : "s"} that did not exist at save time (exact restore)</label>` : ""}`;
        const content = `
          <p>Go back to <b>${esc(row.label)}</b> — ${esc(fmtWhen(row.at))}, Turn ${esc(row.turn)}, Act ${esc(row.storyPhase)}?</p>
          <div class="sg-modes" style="display:flex;gap:1rem;margin:.2rem 0 .4rem">
            <label style="display:flex;gap:.35rem;align-items:center"><input type="radio" name="mode" value="story" checked/> <b>⟲ Reset story</b> <span class="bbttcc-muted">— undo the play-through, keep the game as built</span></label>
            <label style="display:flex;gap:.35rem;align-items:center"><input type="radio" name="mode" value="exact"/> <b>Exact restore</b> <span class="bbttcc-muted">— everything, as it was</span></label>
          </div>
          <div data-mode-pane="story">${storyList}</div>
          <div data-mode-pane="exact" hidden>${exactList}</div>
          ${ps.others.length ? `<p style="color:#fbbf24;font-size:.9em;margin:.5rem 0 0">⚠ ${esc(ps.others.join(", "))} ${ps.others.length === 1 ? "is" : "are"} connected. Their clients will reload when the load finishes.</p>` : ""}
          <p class="bbttcc-muted" style="font-size:.85em;margin:.5rem 0 0">Every client reloads afterwards — modules cache state in memory. Nothing else is undoable: save first if in doubt.</p>`;
        let mode = "story", deleteExtras = true, deleteGameExtras = false;
        const ok = await foundry.applications.api.DialogV2.wait({
          window: { title: `Load “${row.label}”?` },
          content,
          render: (_ev, dialog) => {
            const el = dialog.element;
            const sync = () => {
              const m = el.querySelector("input[name='mode']:checked")?.value || "story";
              for (const pane of el.querySelectorAll("[data-mode-pane]")) pane.hidden = pane.dataset.modePane !== m;
              const btn = el.querySelector("button[data-action='load']"); if (btn) btn.innerHTML = m === "story" ? `<i class="fas fa-undo"></i> Reset story` : `<i class="fas fa-download"></i> Restore exactly`;
            };
            for (const r of el.querySelectorAll("input[name='mode']")) r.addEventListener("change", sync);
            sync();
          },
          buttons: [
            { action: "load", label: "Reset story", icon: "fas fa-undo", default: true, callback: (ev, button) => {
                const f = button.form?.elements;
                mode = (f?.mode?.value === "exact") ? "exact" : "story";
                if (mode === "story") { deleteExtras = f?.deleteExtras ? !!f.deleteExtras.checked : true; deleteGameExtras = f?.deleteGameExtras ? !!f.deleteGameExtras.checked : false; }
                else { deleteExtras = f?.deleteExtrasExact ? !!f.deleteExtrasExact.checked : true; deleteGameExtras = deleteExtras; }
                return true;
              } },
            { action: "cancel", label: "Cancel", callback: () => false }
          ],
          rejectClose: false
        });
        if (!ok) { this._setStatus(""); return; }
        const res = await a.load(id, { mode, deleteExtras, deleteGameExtras, progress: (stage, i, n) => this._setStatus(`⏳ restoring ${stage} ${i}/${n}…`) });
        const r = res.report;
        this._setStatus(`✓ ${mode === "story" ? "story reset to" : "loaded"} “${row.label}” — ${r.settings} settings · actors ${r.actorsUpdated}/${r.actorsCreated}/${r.actorsDeleted} · ${r.scenes} scenes${r.errors.length ? ` · ${r.errors.length} error(s)` : ""} — reloading…`);
        ui.notifications?.info?.(`${mode === "story" ? "Story reset to" : "Loaded"} “${row.label}”. Reloading all clients…`);
        try { game.socket.emit("reload"); } catch (_e) {}
        setTimeout(() => { try { foundry.utils.debouncedReload(); } catch (_e) { location.reload(); } }, 1200);
      });
    }
  }

  globalThis.BBTTCCSaveGameApp = BBTTCCSaveGameApp;

  Hooks.once("init", () => {
    try {
      game.settings.registerMenu(MOD, "saveGames", {
        name: "Bad Eden — Save Games",
        label: "Open Save Games",
        hint: "Full save slots: every setting, actor (with items), scene (hexes + tokens) and Bad Eden journal. Loading defaults to ⟲ Reset story (the play-through only; the game as built stays). Mark one as the Golden Master.",
        icon: "fas fa-save",
        type: BBTTCCSaveGameApp,
        restricted: true
      });
    } catch (e) { warn("registerMenu failed", e); }
  });
})();
