/* ─────────────────────────────────────────────────────────────────────────────
 * bbttcc-factions · rigs-dnd5e.sheet.js — the Rig tab on dnd5e's vehicle sheet
 * (2026-10-08; port of the June-2026 rig-sheet.js onto game.bbttcc.rigs)
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMARY  subclass dnd5e 6's `VehicleActorSheet` (ApplicationV2 BaseActorSheet;
 *          static PARTS/TABS with the `tab-body` container) and add a `bbttcc`
 *          PART + TAB rendered from templates/rig-tab.hbs; registered as the
 *          default vehicle sheet ("Bad Eden — Rig Sheet").
 * FALLBACK if the subclass can't be composed (base missing / statics changed),
 *          a `renderVehicleActorSheet` hook renders the same template and
 *          injects it as a tab. Never throws at load.
 * The tab container carries the stable class `bbttcc-rig-tab` (the structures
 * sheet-panel enhancer injects into it).
 *
 * Tab contents: state chip + park/deploy/restore, faction link, mobility /
 * bracket / tier / archetype, output authoring with the state-multiplied
 * "next turn" preview, travel, order picker, frame summary, crew roster.
 * Data + state machine live in rigs-dnd5e.runtime.js (game.bbttcc.rigs.impl).
 * DORMANT off-dnd5e.
 * ───────────────────────────────────────────────────────────────────────────── */
(() => {
  const TAG = "[bbttcc-factions/rigs-dnd5e-sheet]";
  if (game?.system?.id && game.system.id !== "dnd5e") return;   // DORMANT off-dnd5e

  const SCOPE = "bbttcc-factions";
  const TEMPLATE = "modules/bbttcc-factions/templates/rig-tab.hbs";
  const R = () => game.bbttcc?.rigs;
  const I = () => game.bbttcc?.rigs?.impl ?? {};
  const data = (a) => R()?.data?.(a) ?? null;
  const baseActor = (a) => I().baseActor?.(a) ?? (a?.isToken ? (game.actors?.get?.(a.id) ?? a) : a);
  // sheet field → accessor path
  const FIELD_PATH = {
    factionOwnerId: "identity.factionOwnerId", archetype: "identity.archetype", mobility: "identity.mobility",
    bracket: "integrity.bracket", tier: "integrity.tier", order: "order",
    "travel.speed": "travel.speed", "travel.range": "travel.range", "travel.hazardResist": "travel.hazardResist",
  };

  // One-time self-repair: a token delta carrying rig flags the base lacks
  // (initialised from a token sheet) is migrated up to the BASE actor.
  async function migrateDeltaToBase(sheetActor, base) {
    if (!sheetActor?.isToken) return;
    try {
      const deltaRig = foundry.utils.getProperty(sheetActor.token?.delta?._source ?? {}, `flags.${SCOPE}.rig`);
      if (deltaRig && !data(base)) {
        await base.update({ [`flags.${SCOPE}.rig`]: foundry.utils.deepClone(deltaRig) });   // storage copy, same shape
        await sheetActor.unsetFlag(SCOPE, "rig");
        console.log(TAG, `migrated rig flags from token delta to base for ${base.name}`);
      }
    } catch (e) { console.warn(TAG, "delta->base rig migration failed", e); }
  }

  // ── Context (shared by the subclass PART and the hook fallback) ────────────
  async function buildContext(sheetActor, editable) {
    const Rg = R();
    const a = baseActor(sheetActor);   // rig data lives on the BASE (the turn pass iterates game.actors)
    if (editable) await migrateDeltaToBase(sheetActor, a);
    let rig = data(a);
    if (!rig) return { isRig: false, editable };
    try { await I().healCrew?.(a); } catch (e) { /* best-effort */ }
    rig = data(a) ?? rig;
    const id = rig.identity, ig = rig.integrity;
    const sel = (options, cur) => options.map(o => ({ value: o, label: o, selected: o === cur }));
    const factionActors = (game.actors?.contents ?? [])
      .filter(x => x.getFlag?.(SCOPE, "isFaction"))
      .map(f => ({ value: f.id, label: f.name, selected: f.id === id.factionOwnerId }));
    const out = (typeof I().outputFor === "function" ? I().outputFor(a) : {}) ?? {};
    const base = rig.output?.basePerTurn ?? {};
    const mult = id.state === "parked" ? "×1.0 (parked)" : id.state === "deployed" ? "×0.5 (deployed)" : "×0 (destroyed)";
    const crew = (rig.crew?.slots ?? []).map((s, i) => ({ i, role: s.role, name: game.actors?.get?.(s.actorId)?.name ?? s.label ?? "(empty)" }));
    const channels = I().CHANNELS ?? game.bbttcc?.api?.op?.KEYS ?? [];
    const frame = (() => {
      const f = rig.frame;
      if (!f) return null;
      const count = (sub) => (a.items ?? []).filter(i => Rg.gearOf?.(i)?.subtype === sub && i.system?.equipped !== false).length;
      const slots = f.slots ?? {};
      return { name: f.name, usage: ["weapon", "system", "output"].map(s => `${s} ${count(s === "weapon" ? "rig-weapon" : s === "system" ? "rig-system" : "output-module")}/${slots[s] ?? "∞"}`).join(" · ") };
    })();
    return {
      isRig: true, editable,
      state: id.state, stateIcon: { parked: "🅿️", deployed: "🛻", destroyed: "💥" }[id.state] ?? "",
      canDeploy: editable && id.state === "parked" && id.mobility !== "stationary",
      canPark: editable && id.state === "deployed",
      destroyed: id.state === "destroyed",
      mobility: sel(["stationary", "mobile", "hybrid"], id.mobility),
      bracket: sel(["personal", "light", "medium", "heavy", "siege"], ig.bracket),
      tier: sel(["1", "2", "3", "4"], String(ig.tier ?? 1)),
      archetype: id.archetype ?? "",
      showTravel: id.mobility !== "stationary",
      travel: rig.travel ?? { speed: 1, range: 3, hazardResist: 0 },
      faction: {
        name: id.factionOwnerId ? (game.actors.get(id.factionOwnerId)?.name ?? "(missing)") : null,
        options: editable ? [{ value: "", label: "— (unowned)", selected: !id.factionOwnerId }].concat(factionActors) : null,
      },
      mult,
      output: channels.map(ch => ({ channel: ch, base: Number(base[ch] ?? 0) || 0, effective: out[ch] ?? 0 })),
      crew, hasCrew: crew.length > 0,
      showOrder: id.state === "parked",
      order: Object.entries(I().ORDERS ?? {}).map(([k, o]) => ({ value: k, label: o.label + (o.desc ? ` — ${o.desc}` : ""), selected: (rig.order ?? "none") === k })),
      frame,
    };
  }

  // ── Listeners (shared) — `root` is the tab element, `rerender` refreshes ───
  function wireTab(root, sheetActor, rerender) {
    const a = baseActor(sheetActor);
    const on = (sel, ev, fn) => {
      for (const el of root.querySelectorAll(sel)) {
        el.addEventListener(ev, (e) => { e.stopPropagation(); Promise.resolve(fn(e)).catch(err => { console.error(TAG, err); ui.notifications.warn(String(err?.message ?? err)); }); });
      }
    };
    on("[data-rig-init]", "click", async () => { await I().ensure?.(a); rerender(); });
    on("[data-rig-deploy]", "click", async () => { await R().deploy(a, { sceneId: canvas?.scene?.id ?? null }); rerender(); });
    on("[data-rig-park]", "click", async () => { await R().park(a, {}); rerender(); });
    on("[data-rig-restore]", "click", async () => { await R().restore(a, {}); rerender(); });
    on("select[data-rig-field], input[data-rig-field]", "change", async (e) => {
      const field = e.currentTarget.dataset.rigField;
      let v = e.currentTarget.value;
      if (["tier", "travel.speed", "travel.range", "travel.hazardResist"].includes(field)) v = Number(v) || 0;
      if (field === "factionOwnerId" && v === "") v = "";
      await R().update(a, { [FIELD_PATH[field] ?? field]: v });
      rerender();
    });
    on("input[data-rig-output]", "change", async (e) => {
      const ch = e.currentTarget.dataset.rigOutput;
      const v = Math.max(0, Number(e.currentTarget.value) || 0);
      await R().update(a, { [`output.basePerTurn.${ch}`]: v });
      rerender();
    });
    on("[data-rig-act]", "click", async (e) => {
      const slot = (data(a)?.crew?.slots ?? [])[Number(e.currentTarget.dataset.rigAct)];
      const steward = slot?.actorId ? game.actors?.get?.(slot.actorId) : null;
      await I().openRigActions?.(a, steward);
    });
    on("[data-rig-unboard]", "click", async (e) => {
      const idx = Number(e.currentTarget.dataset.rigUnboard);
      const slots = foundry.utils.deepClone(data(a)?.crew?.slots ?? []);
      const slot = slots[idx];
      const steward = slot?.actorId ? game.actors?.get?.(slot.actorId) : null;
      // Full disembark only when the steward's flag points at THIS rig;
      // otherwise (stale/duplicate row) just drop the row.
      if (steward && I().rigOf?.(steward)?.id === a.id) await R().disembark(steward);
      else { slots.splice(idx, 1); await R().update(a, { "crew.slots": slots }); }
      rerender();
    });
  }

  // ── Fallback: hook injection ───────────────────────────────────────────────
  function installHookFallback() {
    Hooks.on("renderVehicleActorSheet", (app, element) => {
      queueMicrotask(async () => {
        try {
          const root = app?.element ?? (element instanceof HTMLElement ? element : element?.[0]);
          if (!(root instanceof HTMLElement) || !app?.actor) return;
          root.querySelector(".tab[data-tab='bbttcc']")?.remove();
          root.querySelector("[data-tab='bbttcc'][data-action='tab']")?.remove();
          const body = root.querySelector(".tab-body, .sheet-body");
          const nav = root.querySelector("nav[data-group='primary'], nav.tabs, .sheet-tabs");
          if (!body) return;
          const active = app.tabGroups?.primary === "bbttcc";
          const ctx = { tab: { id: "bbttcc", group: "primary", cssClass: active ? "active" : "" }, bbttccRig: await buildContext(app.actor, !!app.isEditable) };
          const html = await (foundry.applications.handlebars?.renderTemplate ?? renderTemplate)(TEMPLATE, ctx);
          const wrap = document.createElement("div"); wrap.innerHTML = html;
          const section = wrap.firstElementChild;
          if (!section) return;
          body.appendChild(section);
          if (nav) {
            const link = document.createElement("a");
            link.className = `item control${active ? " active" : ""}`;
            link.dataset.action = "tab"; link.dataset.group = "primary"; link.dataset.tab = "bbttcc";
            link.title = "Rig"; link.innerHTML = `<i class="fas fa-truck-monster"></i>`;
            nav.appendChild(link);
          }
          wireTab(section, app.actor, () => app.render(false));
        } catch (e) { console.warn(TAG, "fallback tab inject failed", e); }
      });
    });
    console.log(TAG, "Rig tab installed via renderVehicleActorSheet hook (fallback)");
  }

  // ── Primary: the subclass ──────────────────────────────────────────────────
  Hooks.once("setup", () => {
    if (game.system?.id !== "dnd5e") return;
    try {
      const Base = globalThis.dnd5e?.applications?.actor?.VehicleActorSheet
        ?? CONFIG.Actor?.sheetClasses?.vehicle?.["dnd5e.VehicleActorSheet"]?.cls;
      if (!Base?.PARTS || !Array.isArray(Base.TABS)) throw new Error("dnd5e VehicleActorSheet (AppV2 PARTS/TABS) not found");

      class BBTTCCRigSheet extends Base {
        static DEFAULT_OPTIONS = { classes: ["bbttcc-rig"] };

        /** @inheritDoc */
        async _preparePartContext(partId, context, options) {
          context = await super._preparePartContext(partId, context, options);
          if (partId !== "bbttcc") return context;
          if (!context.tab) {
            const active = this.tabGroups?.primary === "bbttcc";
            context.tab = { id: "bbttcc", group: "primary", cssClass: active ? "active" : "" };
          }
          context.bbttccRig = await buildContext(this.actor, this.isEditable);
          return context;
        }

        /** @inheritDoc */
        _onRender(context, options) {
          super._onRender(context, options);
          const tab = this.element?.querySelector?.(".tab[data-tab='bbttcc']");
          if (tab) wireTab(tab, this.actor, () => this.render(false));
        }
      }

      // Subclass statics REPLACE (not merge) — compose from the live dnd5e base.
      BBTTCCRigSheet.PARTS = foundry.utils.mergeObject(Base.PARTS, {
        bbttcc: { container: { classes: ["tab-body"], id: "tabs" }, template: TEMPLATE, scrollable: [""] }
      }, { inplace: false });
      BBTTCCRigSheet.TABS = [...Base.TABS, { tab: "bbttcc", label: "Rig", icon: "fas fa-truck-monster" }];

      const DSC = foundry.applications.apps.DocumentSheetConfig;
      DSC.registerSheet(Actor, SCOPE, BBTTCCRigSheet, { types: ["vehicle"], makeDefault: true, label: "Bad Eden — Rig Sheet" });
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.BBTTCCRigSheet = BBTTCCRigSheet;
      console.log(TAG, "Rig sheet registered (subclass of dnd5e VehicleActorSheet + bbttcc PART/TAB, makeDefault)");
    } catch (e) {
      console.warn(TAG, "subclass registration failed — using the render-hook fallback:", e?.message ?? e);
      installHookFallback();
    }
  });
})();
