// modules/bbttcc-territory/apps/campaign-overview-app.js
// v0.1.2 — Robust "Open" button (delegated handler)

const MOD = "bbttcc-territory";

class BBTTCC_CampaignOverview extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "bbttcc-campaign-overview",
    title: "BBTTCC — Campaign Overview",
    width: 1100,
    height: 700,
    resizable: true,
    classes: ["bbttcc", "bbttcc-campaign-overview"]
  };
  static PARTS = { body: { template: `modules/${MOD}/templates/campaign-overview.hbs` } };

  _collect() {
    const byFaction = new Map();
    const factions = new Map(
      (game.actors?.contents ?? [])
        .filter(a => a.getFlag?.("bbttcc-factions","isFaction") === true ||
                     String(foundry.utils.getProperty(a, "system.details.type.value") ?? "").toLowerCase() === "faction")
        .map(a => [a.id, a])
    );
    for (const scene of (game.scenes?.contents ?? [])) {
      for (const d of (scene.drawings?.contents ?? [])) {
        const f = d.flags?.[MOD] ?? {};
        const isHex = f.isHex === true || f.kind === "territory-hex" ||
                      (d.shape?.type === "p" && Array.isArray(d.shape?.points) && d.shape.points.length === 12);
        if (!isHex) continue;
        const ownerId = f.factionId ?? f.ownerId ?? null;
        const ownerName = f.faction ?? f.ownerName ?? "";
        const key = ownerId || "__none__";
        if (!byFaction.has(key)) {
          byFaction.set(key, {
            factionId: ownerId,
            factionName: ownerId ? (factions.get(ownerId)?.name || ownerName || "(Unknown)") :
                                   (ownerName || game.i18n?.localize?.("BBTTCC.Common.Unclaimed") || "Unclaimed"),
            scenes: new Set(),
            hexCount: 0,
            resources: { food:0, materials:0, trade:0, military:0, knowledge:0 }
          });
        }
        const agg = byFaction.get(key);
        agg.hexCount += 1;
        const r = f.resources || {};
        agg.resources.food      += Number(r.food ?? 0);
        agg.resources.materials += Number(r.materials ?? 0);
        agg.resources.trade     += Number(r.trade ?? 0);
        agg.resources.military  += Number(r.military ?? 0);
        agg.resources.knowledge += Number(r.knowledge ?? 0);
        agg.scenes.add(scene.name);
      }
    }
    const rows = [];
    for (const agg of byFaction.values()) {
      const a = agg.factionId ? factions.get(agg.factionId) : null;
      const ops = a?.getFlag?.("bbttcc-factions","ops") || {};
      const powerTotal = Object.values(ops).reduce((n,row)=> n + Number(row?.value ?? 0), 0);
      const bands = [
        { key: "Emerging",    min: 0,  max: 9  },
        { key: "Growing",     min: 10, max: 24 },
        { key: "Established", min: 25, max: 39 },
        { key: "Powerful",    min: 40, max: 54 },
        { key: "Dominant",    min: 55, max: 1e9 }
      ];
      const band = bands.find(b => powerTotal >= b.min && powerTotal <= b.max) || bands[0];
      const powerLabel = game.i18n?.localize?.(`BBTTCC.PowerLevels.${band.key}`) || band.key;
      rows.push({
        factionId: agg.factionId,
        factionName: agg.factionName,
        powerLabel,
        powerTotal,
        hexCount: agg.hexCount,
        scenes: Array.from(agg.scenes).sort(),
        resources: agg.resources,
        hasActor: !!a
      });
    }
    rows.sort((a,b) => {
      if (!a.factionId && b.factionId) return 1;
      if (a.factionId && !b.factionId) return -1;
      if (!a.factionId && !b.factionId) return a.factionName.localeCompare(b.factionName);
      return (b.powerTotal - a.powerTotal) || a.factionName.localeCompare(b.factionName);
    });
    return { rows };
  }

  async _preparePartContext(partId, context) {
    if (partId === "body") return { ...context, ...this._collect() };
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html[0].addEventListener("click", (ev) => {
      const el = ev.target.closest?.("[data-open-faction]");
      if (!el) return;
      const id = el.getAttribute("data-open-faction") || "";
      if (!id) return;
      const a = game.actors.get(id);
      if (!a) return ui.notifications?.warn?.("Faction actor not found.");
      a.sheet?.render(true, { focus: true });
    }, { capture: true });
  }
}

/* API attachment (kept) */
Hooks.once("ready", () => {
  game.bbttcc = game.bbttcc ?? { api: {} };
  game.bbttcc.api = game.bbttcc.api ?? {};
  game.bbttcc.api.territory = game.bbttcc.api.territory ?? {};
  game.bbttcc.api.territory.openCampaignOverview = () =>
    (new BBTTCC_CampaignOverview()).render(true, { focus: true });
});
