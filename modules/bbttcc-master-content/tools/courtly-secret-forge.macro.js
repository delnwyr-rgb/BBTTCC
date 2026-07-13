/* Bad Eden — Courtly Secret FORGE (2026-07-12)
 *
 * Interactive GM builder for the "Bad Eden: Courtly Secrets" compendium
 * (bbttcc-master-content.courtly-secrets) — create, edit, and retire secret
 * templates without hand-authoring JSON. Pairs with:
 *   - bbttcc-raid/scripts/raid-courtly.secrets.api.js (effect handlers;
 *     compound "a+b" effect chains supported since 2026-07-12)
 *   - the bbttcc-mal-voice persona builder (drag secrets from this pack onto
 *     an NPC persona window to make them conversation-extractable)
 *
 * Run from Foundry: paste into a Script Macro and execute (GM only).
 * Reopenable — running again focuses the existing window. The pack is LOCAL
 * to each Foundry instance — run wherever the content should live (see
 * [[lightsail-sync-workflow-and-lessons]]). Auto-unlocks the pack on save.
 */
(async () => {
  const PACK_ID = "bbttcc-master-content.courtly-secrets";
  const MOD_R = "bbttcc-raid";
  const TAG = "[courtly-secret-forge]";
  const VIOLET = "#a78bfa";

  if (!game.user.isGM) return ui.notifications?.warn?.("GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error?.(`Pack ${PACK_ID} not found.`);
  const api = game.bbttcc?.api?.raid?.courtlySecrets;
  if (!api?.EFFECT_KEYS?.length) return ui.notifications?.error?.("Courtly secrets API not loaded (bbttcc-raid).");
  const Base = foundry.applications?.api?.ApplicationV2;
  if (!Base) return ui.notifications?.error?.("ApplicationV2 not available in this Foundry version.");

  if (globalThis.__bbttccSecretForge?.rendered) return globalThis.__bbttccSecretForge.render({ force: true });

  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const norm = (v) => api.normEffectKeys ? api.normEffectKeys(v) : [String(v || "")].filter(Boolean);

  class SecretForge extends Base {
    static DEFAULT_OPTIONS = {
      id: "bbttcc-courtly-secret-forge",
      classes: ["bbttcc-courtly-secret-forge"],
      window: { icon: "fa-solid fa-user-secret", resizable: true },
      position: { width: 700, height: 620 }
    };

    constructor(...args) { super(...args); this._editingId = null; this._els = {}; }

    get title() { return "Courtly Secret Forge"; }

    async _renderHTML(_context, _options) {
      const root = document.createElement("div");
      root.style.cssText = "display:flex;gap:.6em;height:100%;padding:.5em;";

      // ── Left: what the compendium already holds ──
      const left = document.createElement("div");
      left.style.cssText = "flex:0 0 250px;display:flex;flex-direction:column;gap:.4em;min-height:0;";
      const lh = document.createElement("div");
      lh.innerHTML = `<b style="color:${VIOLET};">⚜ In the compendium</b>`;
      left.appendChild(lh);
      const list = document.createElement("div");
      list.style.cssText = "flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:3px;";
      left.appendChild(list);
      this._els.list = list;
      root.appendChild(left);

      // ── Right: the anvil ──
      const form = document.createElement("div");
      form.style.cssText = "flex:1;display:flex;flex-direction:column;gap:.4em;min-width:0;overflow-y:auto;";
      const hint = (h) => { const p = document.createElement("p"); p.style.cssText = "font-size:.78em;opacity:.75;margin:0;"; p.innerHTML = h; return p; };

      form.appendChild(hint(`<b>Name</b>`));
      const name = document.createElement("input");
      name.type = "text";
      name.placeholder = "Compromising Letter";
      form.appendChild(name);
      this._els.name = name;

      form.appendChild(hint(`<b>Icon</b>`));
      const imgRow = document.createElement("div");
      imgRow.style.cssText = "display:flex;gap:.4em;align-items:center;";
      const imgPrev = document.createElement("img");
      imgPrev.style.cssText = "width:36px;height:36px;object-fit:cover;border:1px solid #666;border-radius:4px;flex:0 0 auto;";
      const img = document.createElement("input");
      img.type = "text";
      img.style.cssText = "flex:1;min-width:0;";
      img.value = "icons/sundries/scrolls/scroll-bound-blue.webp";
      img.addEventListener("change", () => { imgPrev.src = img.value; });
      const browse = document.createElement("button");
      browse.type = "button";
      browse.style.cssText = "flex:0 0 auto;width:auto;padding:.2em .6em;";
      browse.innerHTML = `<i class="fa-solid fa-file-image"></i>`;
      browse.addEventListener("click", () => {
        const FP = foundry.applications?.apps?.FilePicker ?? FilePicker;
        new FP({ type: "image", current: img.value, callback: (p) => { img.value = p; imgPrev.src = p; } }).render(true);
      });
      imgPrev.src = img.value;
      imgRow.append(imgPrev, img, browse);
      form.appendChild(imgRow);
      this._els.img = img;
      this._els.imgPrev = imgPrev;

      form.appendChild(hint(`<b>Effects</b> — a compound secret fires all of them, in order, on one play.`));
      const fx = document.createElement("div");
      fx.style.cssText = "display:flex;flex-direction:column;gap:.25em;";
      form.appendChild(fx);
      this._els.fx = fx;
      this._addEffect("");
      const addFx = document.createElement("a");
      addFx.style.cssText = "font-size:.75em;opacity:.7;cursor:pointer;";
      addFx.innerHTML = `<i class="fa-solid fa-plus"></i> add another effect`;
      addFx.addEventListener("click", () => this._addEffect(""));
      form.appendChild(addFx);

      form.appendChild(hint(`<b>Flavor</b> — one or two sentences of fiction. The mechanical "Play:" line is appended automatically from the effects above.`));
      const flavor = document.createElement("textarea");
      flavor.rows = 4;
      flavor.style.cssText = "width:100%;resize:vertical;";
      flavor.placeholder = "A private correspondence — leaked at exactly the wrong moment for someone, exactly the right moment for you.";
      form.appendChild(flavor);
      this._els.flavor = flavor;

      const btns = document.createElement("div");
      btns.style.cssText = "display:flex;gap:.4em;justify-content:flex-end;margin-top:.3em;";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.style.cssText = "width:auto;padding:.3em .9em;";
      clear.textContent = "New";
      clear.addEventListener("click", () => this._loadForm(null));
      const save = document.createElement("button");
      save.type = "button";
      save.style.cssText = "width:auto;padding:.3em .9em;";
      save.innerHTML = `<i class="fa-solid fa-hammer"></i> <span>Forge</span>`;
      save.addEventListener("click", () => this._save());
      btns.append(clear, save);
      form.appendChild(btns);
      this._els.saveBtn = save;

      root.appendChild(form);
      await this._refreshList();
      return root;
    }

    _replaceHTML(result, content, _options) {
      content.replaceChildren(result);
      content.style.display = "flex";
      content.style.flexDirection = "column";
    }

    _addEffect(key) {
      const line = document.createElement("div");
      line.style.cssText = "display:flex;gap:.3em;align-items:center;";
      const sel = document.createElement("select");
      sel.style.cssText = "flex:1;min-width:0;";
      sel.dataset.fx = "1";
      for (const k of api.EFFECT_KEYS) {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = `${k} — ${api.EFFECT_INFO?.[k] || k}`;
        if (k === key) o.selected = true;
        sel.appendChild(o);
      }
      const rm = document.createElement("button");
      rm.type = "button";
      rm.title = "Remove this effect";
      rm.style.cssText = "flex:0 0 auto;width:auto;padding:.15em .45em;line-height:1;";
      rm.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
      rm.addEventListener("click", () => {
        if (this._els.fx.querySelectorAll("select[data-fx]").length <= 1)
          return ui.notifications?.warn?.("A secret needs at least one effect.");
        line.remove();
      });
      line.append(sel, rm);
      this._els.fx.appendChild(line);
    }

    _formKeys() {
      return Array.from(this._els.fx.querySelectorAll("select[data-fx]"))
        .map(s => String(s.value || "").trim()).filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i);
    }

    async _refreshList() {
      const docs = (await pack.getDocuments()).sort((a, b) => a.name.localeCompare(b.name));
      const list = this._els.list;
      list.replaceChildren();
      if (!docs.length) {
        const d = document.createElement("div");
        d.style.cssText = "opacity:.6;font-style:italic;font-size:.8em;padding:.4em;";
        d.textContent = "No secrets forged yet.";
        list.appendChild(d);
      }
      for (const doc of docs) {
        const meta = doc.flags?.[MOD_R]?.secret || {};
        const keys = norm(meta.effectKeys ?? meta.effectKey);
        const row = document.createElement("div");
        row.style.cssText = `display:flex;align-items:center;gap:.4em;padding:.25em .35em;border:1px solid ${doc.id === this._editingId ? VIOLET : "#444"};border-radius:4px;cursor:pointer;`;
        row.innerHTML = `
          <img src="${esc(doc.img || "icons/svg/book.svg")}" style="width:26px;height:26px;object-fit:cover;border-radius:3px;flex:0 0 auto;"/>
          <div style="flex:1;min-width:0;">
            <div style="font-size:.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(doc.name)}</div>
            <div style="font-size:.65em;opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(keys.join(" + ") || "—")}</div>
          </div>`;
        const del = document.createElement("button");
        del.type = "button";
        del.title = "Delete from compendium";
        del.style.cssText = "flex:0 0 auto;width:auto;padding:.15em .45em;line-height:1;";
        del.innerHTML = `<i class="fa-solid fa-trash"></i>`;
        del.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          const content = `<p>Delete <b>${esc(doc.name)}</b> from the compendium? Copies already held by factions are untouched.</p>`;
          const DialogV2 = foundry.applications?.api?.DialogV2;
          const ok = DialogV2?.confirm
            ? await DialogV2.confirm({ window: { title: "Delete secret?" }, content }).catch(() => false)
            : await Dialog.confirm({ title: "Delete secret?", content });
          if (!ok) return;
          await this._unlock();
          await doc.delete();
          if (this._editingId === doc.id) this._loadForm(null);
          await this._refreshList();
          ui.notifications?.info?.(`Deleted "${doc.name}".`);
        });
        row.appendChild(del);
        row.addEventListener("click", () => this._loadForm(doc));
        list.appendChild(row);
      }
    }

    _loadForm(doc) {
      this._editingId = doc?.id ?? null;
      this._els.name.value = doc?.name ?? "";
      this._els.img.value = doc?.img || "icons/sundries/scrolls/scroll-bound-blue.webp";
      this._els.imgPrev.src = this._els.img.value;
      // Flavor = the description minus the auto-composed "Play:" paragraph and
      // the leading bolded name.
      let flavor = "";
      if (doc) {
        const div = document.createElement("div");
        div.innerHTML = String(doc.system?.description?.value || "");
        const nameRe = new RegExp(`^\\s*${String(doc.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.?\\s*`);
        const ps = Array.from(div.querySelectorAll("p")).filter(p => !/^\s*Play:/i.test(p.textContent || ""));
        flavor = ps.map(p => (p.textContent || "").replace(nameRe, "").trim()).filter(Boolean).join("\n\n");
        if (!flavor) flavor = (div.textContent || "").trim();
      }
      this._els.flavor.value = flavor;
      const meta = doc?.flags?.[MOD_R]?.secret || {};
      const keys = doc ? norm(meta.effectKeys ?? meta.effectKey) : [];
      this._els.fx.replaceChildren();
      if (!keys.length) keys.push("");
      for (const k of keys) this._addEffect(k);
      this._els.saveBtn.querySelector("span").textContent = doc ? "Update" : "Forge";
      this._refreshList().catch(() => {});
    }

    async _unlock() {
      if (pack.locked) {
        await pack.configure({ locked: false });
        ui.notifications?.info?.(`Unlocked ${PACK_ID} for editing.`);
      }
    }

    async _save() {
      const name = String(this._els.name.value || "").trim();
      const keys = this._formKeys();
      const flavor = String(this._els.flavor.value || "").trim();
      if (!name) return ui.notifications?.warn?.("A secret needs a name.");
      if (!keys.length) return ui.notifications?.warn?.("A secret needs at least one effect.");
      const playLine = api.describeEffect(keys.join("+"));
      const desc = `<p><strong>${esc(name)}.</strong> ${esc(flavor || "A truth someone would rather stayed buried.")}</p><p><em>Play:</em> ${esc(playLine)}.</p>`;
      const data = {
        name,
        img: String(this._els.img.value || "").trim() || "icons/svg/book.svg",
        system: { description: { value: desc, chat: "", unidentified: "" } },
        flags: { [MOD_R]: { secret: {
          effectKey: keys.join("+"), effectKeys: keys,
          // acquisition stamped at addSecret() time on the holder; template stays neutral
          acquisition: "template", acquiredAt: 0, raidId: ""
        } } }
      };
      await this._unlock();
      if (this._editingId) {
        const doc = (await pack.getDocuments()).find(d => d.id === this._editingId);
        if (!doc) { this._editingId = null; return this._save(); }
        await doc.update(data);
        ui.notifications?.info?.(`Updated "${name}" in ${PACK_ID}.`);
      } else {
        const existing = await pack.getDocuments();
        if (existing.some(d => d.name === name))
          return ui.notifications?.warn?.(`"${name}" already exists — click it in the list to edit it instead.`);
        const [created] = await Item.createDocuments([{ type: "feat", ...data }], { pack: PACK_ID });
        this._editingId = created?.id ?? null;
        this._els.saveBtn.querySelector("span").textContent = "Update";
        ui.notifications?.info?.(`Forged "${name}" into ${PACK_ID}.`);
      }
      await this._refreshList();
    }
  }

  globalThis.__bbttccSecretForge = new SecretForge();
  globalThis.__bbttccSecretForge.render({ force: true });
  console.log(TAG, "Forge opened →", PACK_ID);
})();
