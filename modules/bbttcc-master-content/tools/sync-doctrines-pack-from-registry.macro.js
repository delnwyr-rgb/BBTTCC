/* Bad Eden — Sync Doctrines Pack from the live registry (2026-06-28)
 * ===================================================================
 * Surveys the live maneuver + strategic catalog (game.bbttcc.api.raid.EFFECTS)
 * and ensures every currently-active entry exists in the
 * "Bad Eden: Doctrines" pack (bbttcc-master-content.doctrines) — so the GM can
 * drag ALL of them onto factions from the Assets sheet. Catches Siege content
 * (and anything else the pack was never backfilled with).
 *
 * Idempotent — keyed by flags.bbttcc.key; only MISSING entries are created.
 * DRY_RUN by default: run once to read the survey, then flip DRY_RUN=false to
 * seed. Pack is per-instance — run on each Foundry instance you want updated.
 * ===================================================================*/
(async () => {
  const PACK_ID = "bbttcc-master-content.doctrines";
  const DRY_RUN = true;                       // ← set false to actually seed missing items
  const DEFAULT_IMG = "icons/svg/item-bag.svg";
  const TAG = "[doctrines-sync]";

  const raid = game.bbttcc?.api?.raid;
  const EFFECTS = raid?.EFFECTS || {};
  if (!Object.keys(EFFECTS).length) return ui.notifications?.error?.(`${TAG} raid.EFFECTS is empty — is bbttcc-raid loaded?`);

  const pack = game.packs.get(PACK_ID);
  if (!pack) return ui.notifications?.error?.(`${TAG} Pack ${PACK_ID} not found.`);

  // 1) Live catalog — every maneuver + strategic in the registry.
  const KINDS = new Set(["maneuver", "strategic"]);
  const catalog = [];
  for (const [key, v] of Object.entries(EFFECTS)) {
    const kind = String(v?.kind || "").toLowerCase().trim();
    if (!KINDS.has(kind)) continue;
    catalog.push({ key: String(key).toLowerCase().trim(), kind, label: String(v?.label || key).trim(), spec: v });
  }

  // 2) Pack existing entries, keyed by flags.bbttcc.key.
  const index = await pack.getIndex({ fields: ["name", "flags.bbttcc.kind", "flags.bbttcc.key"] });
  const haveKeys = new Map(); // key -> { kind, name }
  for (const r of index) {
    const f = r?.flags?.bbttcc || {};
    const k = String(f.key || "").toLowerCase().trim();
    if (k) haveKeys.set(k, { kind: String(f.kind || "").toLowerCase().trim(), name: r.name });
  }

  // 3) Gap analysis.
  const missing = catalog.filter(c => !haveKeys.has(c.key));
  const siegeRe = /siege|sortie|garrison|bombard|breach|\bwall|keep|sap_|storm_final|champion|interdict|supply_line|relief|sue_for_terms|pray_for_omen|reinforce/i;
  const isSiege = (c) => siegeRe.test(c.key) || siegeRe.test(c.label)
    || (Array.isArray(c.spec?.raidTypes) && c.spec.raidTypes.some(t => /siege/i.test(String(t))));
  const missingSiege = missing.filter(isSiege);
  const regKeys = new Set(catalog.map(c => c.key));
  const orphans = [...haveKeys.keys()].filter(k => !regKeys.has(k)); // in pack, not in live registry (report only)
  const byKind = (k) => catalog.filter(c => c.kind === k).length;

  console.log(`${TAG} ===== SURVEY =====`);
  console.log(`${TAG} Registry: ${catalog.length} active (maneuver ${byKind("maneuver")}, strategic ${byKind("strategic")})`);
  console.log(`${TAG} Pack keyed entries: ${haveKeys.size}`);
  console.log(`${TAG} MISSING from pack: ${missing.length}`, missing.map(m => `${m.kind}:${m.key}`).sort());
  console.log(`${TAG}   ↳ siege-related missing: ${missingSiege.length}`, missingSiege.map(m => m.key).sort());
  console.log(`${TAG} Pack-only (not in live registry, left untouched): ${orphans.length}`, orphans.sort());

  if (DRY_RUN) {
    ui.notifications?.info?.(`${TAG} DRY RUN — ${missing.length} missing (${missingSiege.length} siege). Set DRY_RUN=false and re-run to seed. Full report in console (F12).`);
    return;
  }
  if (!missing.length) return ui.notifications?.info?.(`${TAG} Pack already complete — nothing to seed.`);

  // 4) Seed missing entries into the pack (additive, idempotent).
  if (pack.locked) {
    try { await pack.configure({ locked: false }); }
    catch (e) { return ui.notifications?.error?.(`${TAG} Pack is locked and unlock failed — unlock it in Compendium settings, then re-run.`); }
  }

  const fmtCost = (spec) => {
    const c = spec?.cost || spec?.opCosts || {};
    const parts = [];
    for (const [k, v] of Object.entries(c)) { const n = Number(v || 0); if (n) parts.push(`${k} ${n}`); }
    return parts.join(", ");
  };
  const buildDesc = (c) => {
    const s = c.spec || {};
    const text = String(s.text || s.description || "").trim() || "<em>No rules text registered.</em>";
    const cost = fmtCost(s);
    const rts = Array.isArray(s.raidTypes) ? s.raidTypes.join(", ") : "";
    let html = `<div class="bbttcc-doctrine-desc"><h3>${c.label}</h3><p>${text}</p>`;
    if (cost) html += `<p><strong>OP Cost:</strong> ${cost}</p>`;
    if (s.tier != null && s.tier !== "") html += `<p><strong>Tier:</strong> ${s.tier}</p>`;
    if (s.rarity) html += `<p><strong>Rarity:</strong> ${s.rarity}</p>`;
    if (rts) html += `<p><strong>Raid Types:</strong> ${rts}</p>`;
    html += `</div>`;
    return html;
  };

  const docs = missing.map(c => ({
    name: c.label,
    type: "feat",
    img: DEFAULT_IMG,
    system: {
      category: c.kind === "maneuver" ? "maneuver" : "strategic",
      source: "Bad Eden Doctrine",
      description: { value: buildDesc(c), chat: "" }
    },
    flags: { bbttcc: { kind: c.kind, key: c.key } }
  }));

  const created = await Item.createDocuments(docs, { pack: PACK_ID });
  ui.notifications?.info?.(`${TAG} Seeded ${created.length}/${missing.length} doctrine items (${missingSiege.length} siege) into "Bad Eden: Doctrines". Re-open a faction sheet to drag them.`);
  console.log(`${TAG} Seeded ${created.length}:`, created.map(d => `${d.flags?.bbttcc?.kind}:${d.flags?.bbttcc?.key}`).sort());
})();
