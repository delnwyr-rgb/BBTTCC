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
      position: { width: 760, height: "auto" }
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
        const p = a.plan(snap);
        const li = (t) => `<li>${t}</li>`;
        const content = `
          <p>Restore the world to <b>${esc(row.label)}</b> — ${esc(fmtWhen(row.at))}, Turn ${esc(row.turn)}, Act ${esc(row.storyPhase)}?</p>
          <ul style="margin:.3rem 0 .5rem 1.1rem; font-size:.9em; line-height:1.5">
            ${li(`<b>${p.settingsChange}</b> world settings change${p.settingsUnknown ? ` <span class="bbttcc-muted">(${p.settingsUnknown} in the save are no longer registered — skipped)</span>` : ""}`)}
            ${li(`Actors: <b>${p.actorsUpdate}</b> restored in place · <b>${p.actorsCreate}</b> re-created · <b>${p.actorsDelete.length}</b> made since the save${p.actorsDelete.length ? `: <i>${esc(p.actorsDelete.slice(0, 8).join(", "))}${p.actorsDelete.length > 8 ? " …" : ""}</i>` : ""}`)}
            ${li(`Scenes: <b>${p.scenesKnown}</b> restored (flags, hexes, tokens)${p.scenesMissing.length ? ` · ${p.scenesMissing.length} in the save no longer exist (skipped)` : ""}${p.scenesExtra.length ? ` · ${p.scenesExtra.length} made since the save are left alone` : ""}`)}
            ${li(`Journal: <b>${p.journal}</b> Bad Eden entries`)}
          </ul>
          ${p.actorsDelete.length ? `<label style="display:flex;gap:.4rem;align-items:center;font-size:.9em"><input type="checkbox" name="deleteExtras" checked/> Delete the ${p.actorsDelete.length} actor${p.actorsDelete.length === 1 ? "" : "s"} that did not exist at save time (exact restore)</label>` : ""}
          ${p.others.length ? `<p style="color:#fbbf24;font-size:.9em;margin:.5rem 0 0">⚠ ${esc(p.others.join(", "))} ${p.others.length === 1 ? "is" : "are"} connected. Their clients will reload when the load finishes.</p>` : ""}
          <p class="bbttcc-muted" style="font-size:.85em;margin:.5rem 0 0">Every client reloads afterwards — modules cache state in memory. Nothing else is undoable: save first if in doubt.</p>`;
        let deleteExtras = true;
        const ok = await foundry.applications.api.DialogV2.wait({
          window: { title: `Load “${row.label}”?` },
          content,
          buttons: [
            { action: "load", label: "Load", icon: "fas fa-download", default: true, callback: (ev, button) => { const cb = button.form?.elements?.deleteExtras; deleteExtras = cb ? !!cb.checked : true; return true; } },
            { action: "cancel", label: "Cancel", callback: () => false }
          ],
          rejectClose: false
        });
        if (!ok) { this._setStatus(""); return; }
        const res = await a.load(id, { deleteExtras, progress: (stage, i, n) => this._setStatus(`⏳ restoring ${stage} ${i}/${n}…`) });
        const r = res.report;
        this._setStatus(`✓ loaded “${row.label}” — ${r.settings} settings · actors ${r.actorsUpdated}/${r.actorsCreated}/${r.actorsDeleted} · ${r.scenes} scenes${r.errors.length ? ` · ${r.errors.length} error(s)` : ""} — reloading…`);
        ui.notifications?.info?.(`Loaded “${row.label}”. Reloading all clients…`);
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
        hint: "Full save slots: every setting, actor (with items), scene (hexes + tokens) and Bad Eden journal. Mark one as the Golden Master.",
        icon: "fas fa-save",
        type: BBTTCCSaveGameApp,
        restricted: true
      });
    } catch (e) { warn("registerMenu failed", e); }
  });
})();
