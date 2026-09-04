/**
 * seed-bestiary-hire-catalog.macro.js — GM script macro (2026-09-04)
 *
 * Makes creatures purchasable: creates (or reuses) a market vendor — "The
 * Muster" — and adds one `kind: "actor"` catalog entry per hireable creature
 * in the NPC Pack's "Bad Eden Monsters" folder, pointing at the compendium
 * UUID so the market's existing clone-into-world delivery does the rest.
 *
 * Price: the market reads flags.fourththing.rfi.actor.price and (since
 * 2026-09-04) charges `hire` for lineage-flagged actors. Bosses have no hire
 * price and are never listed. Only HIREABLE_LINEAGES are listed — you can pay
 * a raider crew, buy a trained beast, or reprogram a Pre-Fall drone; you do
 * not hire a Shell or a sephirah's emanation.
 *
 * DRY_RUN = true lists what would be added. Safe to re-run: existing entries
 * (same uuid under the vendor) are skipped, never duplicated.
 */
const DRY_RUN = false;
const PACK_ID = "bbttcc-master-content.npcs";
const ROOT_FOLDER = "Bad Eden Monsters";
const MARKET = "bbttcc-market";
const VENDOR = { id: "the-muster", name: "The Muster", blurb: "Where the road crews, beast-handlers and salvage-tinkers wait for a banner to pay them. Hire by the scene; they eat what you eat.", tags: ["hire", "bestiary", "mercenaries"], active: true };
const HIREABLE_LINEAGES = ["mortal", "wild", "pre-fall"];

const cap = (s) => String(s ?? "").split("-").map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join("-");
const makeId = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

(async () => {
  if (!game.user.isGM) return ui.notifications.warn("Seed hire catalog: GM only.");
  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications.error(`Seed hire catalog: pack ${PACK_ID} not found.`);
  if (!game.modules.get(MARKET)?.active) return ui.notifications.error("Seed hire catalog: bbttcc-market is not active.");

  const folders = pack.folders;
  const under = (fid) => { let f = folders.get(fid); while (f) { if (f.name === ROOT_FOLDER) return true; f = f.folder; } return false; };
  const F = "flags.fourththing.rfi.actor";
  const index = await pack.getIndex({ fields: [`${F}.lineage`, `${F}.subLineage`, `${F}.tier`, `${F}.bracket`, `${F}.price`, `${F}.title`, "folder", "type"] });

  const vendors = foundry.utils.duplicate(game.settings.get(MARKET, "vendors") || []);
  const catalog = foundry.utils.duplicate(game.settings.get(MARKET, "catalog") || []);
  let vendor = vendors.find(v => v.id === VENDOR.id || v.name === VENDOR.name);
  const vendorNew = !vendor;
  if (!vendor) { vendor = { ...VENDOR }; vendors.push(vendor); }
  const listed = new Set(catalog.filter(e => e.vendorId === vendor.id && e.kind === "actor").map(e => String(e.uuid)));

  const adds = []; const skipped = [];
  for (const e of index) {
    if (e.type !== "npc" || !under(e.folder)) continue;
    const a = foundry.utils.getProperty(e, F) ?? {};
    if (!a.lineage) { skipped.push(`${e.name} (no lineage — run the backfill)`); continue; }
    if (!HIREABLE_LINEAGES.includes(a.lineage)) continue;
    const hire = Number(a.price?.hire);
    if (String(a.bracket).toLowerCase() === "boss" || !Number.isFinite(hire) || hire <= 0) { skipped.push(`${e.name} (not for hire)`); continue; }
    if (listed.has(e.uuid)) continue;
    adds.push({
      id: makeId("entry"), vendorId: vendor.id, kind: "actor", uuid: e.uuid,
      name: e.name,
      blurb: `${cap(a.lineage)}${a.subLineage ? ` · ${cap(a.subLineage)}` : ""} · T${a.tier ?? "?"} ${a.bracket ?? ""}${a.title ? ` — ${a.title}` : ""}. Hire ${hire} marks (${a.price?.currency ?? "violence"}) per scene.`,
      cost: { economy: Math.round(hire / 10) },
      tier: a.tier ?? null,
      tags: ["bestiary", "hire", a.lineage]
    });
  }

  console.log(`[seed-hire-catalog] ${DRY_RUN ? "DRY RUN — would add" : "ADDING"} ${adds.length} entr${adds.length === 1 ? "y" : "ies"} to "${vendor.name}"${vendorNew ? " (new vendor)" : ""}:\n` + adds.map(x => `  • ${x.name} — ${x.blurb}`).join("\n"));
  if (skipped.length) console.log("[seed-hire-catalog] skipped:", skipped);
  if (DRY_RUN) { ui.notifications.warn(`Seed hire catalog: DRY RUN — ${adds.length} entries would be added${vendorNew ? " (+ new vendor)" : ""}. See console (F12).`); return; }

  if (vendorNew) await game.settings.set(MARKET, "vendors", vendors);
  if (adds.length) await game.settings.set(MARKET, "catalog", [...catalog, ...adds]);
  ui.notifications.info(`Seed hire catalog: added ${adds.length} entries to "${vendor.name}"${vendorNew ? " (vendor created)" : ""}.`);
})();
