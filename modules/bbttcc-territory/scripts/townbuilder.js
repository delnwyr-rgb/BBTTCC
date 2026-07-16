// modules/bbttcc-territory/scripts/townbuilder.js
// Bad Eden — 🏗️ Townbuilder (Phase 1, TOWNBUILDER_SPEC.md v0.2)
//
// Steward-founded settlements: as a hex's size (dev level) rises, a menu of
// buildings unlocks, filtered by the hex's settlement type. Players name each
// building; every build spawns a real structure actor via the bbttcc-structures
// recipe engine and is recorded on the hex at:
//   hex.flags["bbttcc-territory"].settlement = { name, assets:[...], districts:[...] }
//
// Costing doctrine (spec §5): dev level buys the permission, BUILD UNITS buy
// the thing. Civilian buildings cost BU only (1/2/3 by tierGate) — no stockpile
// materials (BU is itself generated from Materials pips; charging both would
// tax the same substrate twice). Fortifications stay expensive: buildUnitCostAsset
// BU + full recipe materials.
//
// API: game.bbttcc.api.territory.townbuilder.{open, getSettlement, ladderFor, LADDER}

(() => {
  const MOD_T = "bbttcc-territory";
  const MOD_F = "bbttcc-factions";
  const TAG   = "[bbttcc-territory/townbuilder]";
  const log   = (...a) => console.log(TAG, ...a);
  const warn  = (...a) => console.warn(TAG, ...a);
  const esc   = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  // ── Unlock ladder (spec §4) ────────────────────────────────────────────────
  const LADDER = {
    outpost:     { maxTier: 1, slots: 2,  districts: 0 },
    village:     { maxTier: 1, slots: 4,  districts: 0 },
    town:        { maxTier: 2, slots: 6,  districts: 0 },
    city:        { maxTier: 3, slots: 9,  districts: 1 },
    metropolis:  { maxTier: 3, slots: 12, districts: 2 },
    megalopolis: { maxTier: 3, slots: 16, districts: 3 }
  };
  const SIZE_LABELS = {
    outpost: "Outpost", village: "Village", town: "Town",
    city: "City", metropolis: "Metropolis", megalopolis: "Megalopolis"
  };
  const CATEGORY_ORDER = ["civic", "dwellings", "utility", "barriers", "fortifications"];
  const CATEGORY_LABELS = {
    civic: "Civic", dwellings: "Dwellings", utility: "Utility",
    barriers: "Barriers", fortifications: "Fortifications"
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setting(key, fb) {
    try { return game.settings.get(MOD_T, key) ?? fb; } catch (_e) { return fb; }
  }
  function buCostForRecipe(recipe) {
    if (String(recipe.category || "") === "fortifications") {
      return Math.max(0, Number(setting("buildUnitCostAsset", 3)) || 0);
    }
    const tier = Math.min(3, Math.max(1, Number(recipe.tierGate || 1)));
    return Math.max(0, Number(setting(`townbuilderBuCostT${tier}`, tier)) || 0);
  }
  function chargesMaterials(recipe) {
    if (String(recipe.category || "") === "fortifications") return true;
    return !!setting("townbuilderChargeMaterials", false);
  }
  function recipesApi() { return game.bbttcc?.api?.structures?.recipes || null; }
  function buApi()      { return game.bbttcc?.api?.territory?.buildUnits || null; }

  function factionOf(hexDoc) {
    const tf = hexDoc?.flags?.[MOD_T] || {};
    const fid = tf.factionId || tf.ownerId || null;
    return fid ? (game.actors?.get(String(fid).replace(/^Actor\./, "")) ?? null) : null;
  }
  function buBalance(faction) {
    return Math.max(0, Math.floor(Number(faction?.getFlag(MOD_F, "buildUnits") ?? 0) || 0));
  }
  function hexName(hexDoc) {
    // Hex names can carry NBSP (U+00A0) — collapse whitespace for display/matching.
    const raw = hexDoc?.text ?? hexDoc?.name ?? hexDoc?.flags?.[MOD_T]?.name ?? "Unnamed Hex";
    return String(raw).replace(/\s+/g, " ").trim() || "Unnamed Hex";
  }

  function getSettlement(hexDoc) {
    const s = hexDoc?.flags?.[MOD_T]?.settlement;
    if (!s || typeof s !== "object") return null;
    return {
      name: String(s.name || hexName(hexDoc)),
      foundedByActorId: s.foundedByActorId || "",
      foundedFactionId: s.foundedFactionId || "",
      foundedTs: Number(s.foundedTs || 0),
      sceneId: s.sceneId || "",
      assets: Array.isArray(s.assets) ? s.assets.slice() : [],
      districts: Array.isArray(s.districts) ? s.districts.slice() : []
    };
  }

  async function writeSettlement(hexDoc, settlement) {
    // Arrays replace wholesale on update; we only add/modify keys, so a plain
    // path-write is safe (no "-=key" deletions needed here).
    await hexDoc.update(
      { [`flags.${MOD_T}.settlement`]: settlement },
      { parent: hexDoc.parent ?? null }
    );
  }

  function ladderFor(hexDoc) {
    const size = String(hexDoc?.flags?.[MOD_T]?.size || "none").toLowerCase();
    return { size, tier: LADDER[size] || null };
  }

  // ── Eligibility (spec §4 + acceptance #1) ──────────────────────────────────
  function eligibility(hexDoc) {
    const tf = hexDoc?.flags?.[MOD_T] || {};
    const { size, tier } = ladderFor(hexDoc);
    if (!factionOf(hexDoc)) return { ok: false, reason: "This hex has no owning faction — claim it first." };
    if (!tier)              return { ok: false, reason: `Hex size is "${size}" — develop it to at least Outpost to unlock the Townbuilder.` };
    if (String(tf.status || "").toLowerCase() === "contested")
      return { ok: false, reason: "This hex is contested — resolve the conflict before building." };
    return { ok: true };
  }

  // ── Recipe menu (spec §6a: missing settlementTypes = show everywhere) ─────
  function menuFor(hexDoc) {
    const api = recipesApi();
    if (!api?.list) return null;
    const type = String(hexDoc?.flags?.[MOD_T]?.type || "").toLowerCase();
    const districtTypes = (getSettlement(hexDoc)?.districts || []).map(d => String(d.type || "").toLowerCase());
    const allowed = new Set([type, ...districtTypes].filter(Boolean));
    const out = [];
    for (const r of api.list()) {
      if (!r?.id || r._section) { if (!r?.id) continue; }
      const tags = Array.isArray(r.settlementTypes) ? r.settlementTypes.map(t => String(t).toLowerCase()) : null;
      if (tags && allowed.size && !tags.some(t => allowed.has(t))) continue;
      out.push(r);
    }
    return out;
  }

  // ── Districts (Phase 3) — "my city is also a port" ────────────────────────
  // A district is additive: it unions its type's recipes into the menu and
  // adds districtYieldShare (default 50%) of its type's baseline profile to
  // hex production (applied inside bbttcc-factions effHexWithAll). The hex's
  // `type` string stays untouched everywhere.
  const DISTRICT_TYPES = ["settlement", "fortress", "mine", "farm", "port", "factory", "research", "temple"];
  const DISTRICT_TYPE_BASE = {
    // mirrors bbttcc-factions calcBaseByType (same convention as the dossier's
    // local copy in main.js) — used only for the founding dialog's preview.
    farm:       { food: 20, trade: 5 },
    mine:       { materials: 20, trade: 5 },
    settlement: { trade: 10, military: 5 },
    fortress:   { military: 20 },
    port:       { trade: 15, food: 5 },
    factory:    { materials: 15, military: 5 },
    research:   { knowledge: 20 },
    temple:     { knowledge: 10, trade: 5 }
  };

  function districtShare() {
    return Math.max(0, Number(setting("districtYieldShare", 0.5)) || 0);
  }
  function districtBuCost() {
    return Math.max(0, Number(setting("buildUnitCostAsset", 3)) || 0) * 2;
  }
  function districtYieldPreview(type) {
    const p = DISTRICT_TYPE_BASE[type] || {};
    const share = districtShare();
    const parts = Object.entries(p).map(([k, v]) => `+${(v * share) % 1 ? (v * share).toFixed(1) : v * share} ${k}`);
    return parts.join(", ") || "no yield";
  }

  async function foundDistrict({ hexDoc, type, name }) {
    const settlement = getSettlement(hexDoc);
    if (!settlement) return { ok: false, error: "Build something first — districts grow out of a living town." };
    const faction = game.actors.get(settlement.foundedFactionId) || factionOf(hexDoc);
    if (!faction) return { ok: false, error: "No owning faction on this hex." };

    const { tier } = ladderFor(hexDoc);
    const isGM = !!game.user?.isGM;
    if (!tier?.districts && !isGM) return { ok: false, error: "Districts unlock at City size." };
    if ((settlement.districts.length >= (tier?.districts ?? 0)) && !isGM) {
      return { ok: false, error: `All ${tier?.districts ?? 0} district slots are used at this size.` };
    }

    const t = String(type || "").toLowerCase();
    const hexType = String(hexDoc.flags?.[MOD_T]?.type || "").toLowerCase();
    if (!DISTRICT_TYPES.includes(t)) return { ok: false, error: `Not a district type: ${t}` };
    if (t === hexType) return { ok: false, error: `This hex already IS a ${t} — found a district that adds something new.` };
    if (settlement.districts.some(d => String(d.type).toLowerCase() === t)) {
      return { ok: false, error: `A ${t} district already exists here.` };
    }

    const districtName = String(name || "").replace(/\s+/g, " ").trim() || `${t[0].toUpperCase()}${t.slice(1)} District`;
    const cost = districtBuCost();
    if (cost > 0) {
      const res = await buApi()?.spendForAction?.({
        factionId: faction.id,
        hexUuid: hexDoc.uuid,
        action: "asset",
        costOverride: cost,
        note: `Townbuilder: founded "${districtName}" (${t} district)`
      });
      if (!res?.ok) return { ok: false, error: `Build Unit spend failed (${res?.reason || "insufficient BU?"}) — districts cost ${cost} BU.` };
    }

    settlement.districts.push({ id: foundry.utils.randomID(16), type: t, name: districtName, addedTs: game.time.worldTime });
    await writeSettlement(hexDoc, settlement);

    try {
      await game.bbttcc?.api?.territory?.recordHexImprovement?.(hexDoc, {
        kind: "district",
        label: `Townbuilder: founded "${districtName}" (${t} district)`,
        description: `${settlement.name} grew a ${t} district — ${districtYieldPreview(t)} at ${Math.round(districtShare() * 100)}% share, and the ${t} building menu unlocks here.`,
        source: { activity: "townbuilder:district", factionId: faction.id },
        reversible: false,
        dedupeKey: `townbuilder:district:${hexDoc.id}:${t}`
      });
    } catch (_e) {}
    await upsertJournal(hexDoc, settlement);
    log(`Founded district "${districtName}" (${t}) in ${settlement.name} — ${cost} BU.`);
    return { ok: true, settlement };
  }

  async function dissolveDistrict({ hexDoc, districtId }) {
    if (!game.user?.isGM) return { ok: false, error: "Only the GM can dissolve a district." };
    const settlement = getSettlement(hexDoc);
    const district = settlement?.districts?.find(d => d.id === districtId);
    if (!district) return { ok: false, error: "District not found." };

    settlement.districts = settlement.districts.filter(d => d.id !== districtId);
    for (const a of settlement.assets) if (a.district === districtId) a.district = null;
    await writeSettlement(hexDoc, settlement);

    try {
      await game.bbttcc?.api?.territory?.recordHexImprovement?.(hexDoc, {
        kind: "district",
        label: `Townbuilder: dissolved "${district.name}" (${district.type} district)`,
        description: `${district.name} was dissolved; its buildings fold back into ${settlement.name} proper.`,
        source: { activity: "townbuilder:district-dissolve", factionId: settlement.foundedFactionId || "" },
        reversible: false,
        dedupeKey: `townbuilder:district-dissolve:${hexDoc.id}:${districtId}`
      });
    } catch (_e) {}
    await upsertJournal(hexDoc, settlement);
    return { ok: true, settlement };
  }

  async function assignAssetDistrict({ hexDoc, assetId, districtId }) {
    const settlement = getSettlement(hexDoc);
    const asset = settlement?.assets?.find(a => a.id === assetId);
    if (!asset) return { ok: false, error: "Asset not found." };
    if (districtId && !settlement.districts.some(d => d.id === districtId)) {
      return { ok: false, error: "District not found." };
    }
    asset.district = districtId || null;
    await writeSettlement(hexDoc, settlement);
    await upsertJournal(hexDoc, settlement);
    return { ok: true, settlement };
  }

  // ── Settlement walk-around scenes (Phase 2) ───────────────────────────────
  // Duplicate a generic town map from the master-content scenes pack, bind it
  // to the hex via the raid battle-scenes API (Scenes panel + Holdings deploy
  // come free), and drop building tokens on it.
  const SCENE_PACK = "bbttcc-master-content.scenes";
  const SCENE_TEMPLATE_RX = /^hex_flooded_town_\d+$|^liberated town$/i;

  function settlementScene(settlement) {
    return settlement?.sceneId ? (game.scenes?.get(settlement.sceneId) ?? null) : null;
  }

  async function ensureSceneFolder() {
    try {
      let f = game.folders.find(x => x.type === "Scene" && x.name === "Settlements" && !x.folder);
      f ??= await Folder.create({ name: "Settlements", type: "Scene" });
      return f;
    } catch (_e) { return null; }
  }

  async function templateSceneChoices() {
    const pack = game.packs?.get(SCENE_PACK);
    if (!pack) return [];
    const index = await pack.getIndex();
    return index.filter(e => SCENE_TEMPLATE_RX.test(String(e.name || "").trim()))
                .map(e => ({ id: e._id, name: e.name }));
  }

  // Row layout inside the map's background rect; GM repositions afterwards.
  function tokenSpotFor(scene, index) {
    const grid = scene.grid?.size || 100;
    const d = scene.dimensions || {};
    const x0 = (d.sceneX ?? 0) + grid * 2;
    const y0 = (d.sceneY ?? 0) + grid * 2;
    const col = index % 6, row = Math.floor(index / 6);
    return { x: x0 + col * grid * 5, y: y0 + row * grid * 5 };
  }

  async function placeAssetToken(scene, asset, index) {
    const actor = fromUuidSync(asset.actorUuid, { strict: false });
    if (!actor || !scene) return false;
    if (scene.tokens.some(t => t.actorId === actor.id)) return false; // already placed
    const rApi = recipesApi();
    const recipe = rApi?.byId?.(asset.recipeId);
    const spot = tokenSpotFor(scene, index);
    const tokenData = await actor.getTokenDocument({
      x: spot.x, y: spot.y,
      width: recipe?.footprintGrid?.w ?? 1,
      height: recipe?.footprintGrid?.h ?? 1,
      texture: { src: recipe?.tokenImg ?? actor.img },
      displayName: CONST.TOKEN_DISPLAY_MODES?.HOVER ?? 30,
      disposition: 0,
      actorLink: true
    });
    await scene.createEmbeddedDocuments("Token", [tokenData.toObject()]);
    return true;
  }

  async function createSettlementScene({ hexDoc, templateId }) {
    if (!game.user?.isGM) return { ok: false, error: "Only the GM can raise the town map." };
    const settlement = getSettlement(hexDoc);
    if (!settlement) return { ok: false, error: "Build something first — the town needs at least one building." };
    if (settlementScene(settlement)) return { ok: false, error: "This settlement already has a town map." };

    const pack = game.packs?.get(SCENE_PACK);
    if (!pack) return { ok: false, error: `Scenes pack ${SCENE_PACK} not found.` };
    const src = await pack.getDocument(templateId);
    if (!src) return { ok: false, error: "Template scene not found in pack." };

    const folder = await ensureSceneFolder();
    const data = src.toObject();
    delete data._id;
    data.name = `🏘️ ${settlement.name}`;
    data.navigation = true;
    data.navName = settlement.name;
    if (folder) data.folder = folder.id;
    const scene = await Scene.create(data);
    if (!scene) return { ok: false, error: "Scene.create failed." };

    settlement.sceneId = scene.id;
    await writeSettlement(hexDoc, settlement);

    // Bind to the hex — Scenes panel + Holdings deploy integration.
    try { await game.bbttcc?.api?.raid?.battleScenes?.bind?.(hexDoc, scene, { label: `🏘️ ${settlement.name}` }); }
    catch (e) { warn("battle-scene bind failed (non-fatal):", e); }

    let placed = 0;
    for (let i = 0; i < settlement.assets.length; i++) {
      try { if (await placeAssetToken(scene, settlement.assets[i], i)) placed++; }
      catch (e) { warn("token placement failed:", e); }
    }

    await upsertJournal(hexDoc, settlement);
    log(`Town map raised for ${settlement.name} (${placed} building tokens placed).`);
    return { ok: true, scene, placed };
  }

  // ── Demolish (Phase 2) — GM-gated, half-salvage only if materials were paid
  async function demolishAsset({ hexDoc, assetId }) {
    if (!game.user?.isGM) return { ok: false, error: "Only the GM can demolish." };
    const settlement = getSettlement(hexDoc);
    const asset = settlement?.assets?.find(a => a.id === assetId);
    if (!asset) return { ok: false, error: "Asset not found." };

    const faction = game.actors.get(settlement.foundedFactionId) || factionOf(hexDoc);
    const rApi = recipesApi();
    const recipe = rApi?.byId?.(asset.recipeId);

    // Salvage: half the BOM back, but ONLY when the build drew materials from
    // the stockpile — BU-only civilian builds salvaging materials would mint
    // an infinite BU→materials faucet.
    const salvage = [];
    if (asset.paidMaterials && recipe?.materialOf?.length) {
      const stock = game.bbttcc?.api?.factions?.stockpile;
      for (const m of recipe.materialOf) {
        const back = Math.floor(Math.max(0, Number(m.qty) || 0) / 2);
        if (back > 0 && stock?.adjust && faction) {
          try { await stock.adjust(faction, m.key, back); salvage.push(`${m.key} ×${back}`); }
          catch (e) { warn("salvage deposit failed:", m.key, e); }
        }
      }
    }

    // Remove tokens everywhere, then the actor.
    const actor = fromUuidSync(asset.actorUuid, { strict: false });
    if (actor) {
      for (const scene of game.scenes ?? []) {
        const ids = scene.tokens.filter(t => t.actorId === actor.id).map(t => t.id);
        if (ids.length) { try { await scene.deleteEmbeddedDocuments("Token", ids); } catch (_e) {} }
      }
      try { await actor.delete(); } catch (e) { warn("actor delete failed:", e); }
    }

    settlement.assets = settlement.assets.filter(a => a.id !== assetId);
    await writeSettlement(hexDoc, settlement);

    try {
      await game.bbttcc?.api?.territory?.recordHexImprovement?.(hexDoc, {
        kind: "demolish",
        label: `Townbuilder: demolished "${asset.customName}" (${recipe?.name || asset.recipeId})`,
        description: `${asset.customName} came down in ${settlement.name}.${salvage.length ? ` Salvaged: ${salvage.join(", ")}.` : ""}`,
        source: { activity: "townbuilder:demolish", factionId: faction?.id || "" },
        reversible: false,
        dedupeKey: `townbuilder:demolish:${hexDoc.id}:${assetId}`
      });
    } catch (_e) {}
    await upsertJournal(hexDoc, settlement);

    const gm = game.users.filter(u => u.isGM).map(u => u.id);
    if (gm.length) {
      await ChatMessage.create({
        content: `<p><b>🧨 Demolished — ${esc(asset.customName)}</b> (${esc(recipe?.name || asset.recipeId)}) in ${esc(settlement.name)}.` +
                 `${salvage.length ? `<br/>Salvage → ${esc(faction?.name ?? "stockpile")}: ${esc(salvage.join(", "))}` : "<br/>No salvage (built with Build Units only)."}</p>`,
        whisper: gm, speaker: { alias: "Bad Eden Economy" }
      }).catch(() => {});
    }
    return { ok: true, salvage, settlement };
  }

  // ── Actor folders: Settlements/<town> ─────────────────────────────────────
  async function ensureActorFolder(townName) {
    try {
      let root = game.folders.find(f => f.type === "Actor" && f.name === "Settlements" && !f.folder);
      root ??= await Folder.create({ name: "Settlements", type: "Actor" });
      let sub = game.folders.find(f => f.type === "Actor" && f.name === townName && f.folder?.id === root.id);
      sub ??= await Folder.create({ name: townName, type: "Actor", folder: root.id });
      return sub;
    } catch (e) { warn("Folder setup failed (non-fatal):", e); return null; }
  }

  // ── Settlement journal (spec §8) — regenerated idempotently ───────────────
  function fmtWorldDay(ts) {
    const days = Math.floor(Number(ts || 0) / 86400);
    return `Day ${days}`;
  }

  async function upsertJournal(hexDoc, settlement) {
    try {
      let folder = game.folders.find(f => f.type === "JournalEntry" && f.name === "Settlements" && !f.folder);
      folder ??= await Folder.create({ name: "Settlements", type: "JournalEntry" });

      let entry = game.journal.find(j => j.getFlag(MOD_T, "settlementHexUuid") === hexDoc.uuid);
      const title = `🏘️ ${settlement.name}`;
      if (!entry) {
        entry = await JournalEntry.create({
          name: title, folder: folder.id,
          flags: { [MOD_T]: { settlementHexUuid: hexDoc.uuid } }
        });
      } else if (entry.name !== title) {
        await entry.update({ name: title });
      }

      const faction = game.actors.get(settlement.foundedFactionId) || factionOf(hexDoc);
      const rApi = recipesApi();
      const dName = (a) => settlement.districts.find(d => d.id === a.district)?.name || "";
      const sortedAssets = settlement.assets.slice().sort((a, b) =>
        (dName(a) || "￿").localeCompare(dName(b) || "￿") || a.builtTs - b.builtTs);
      const rows = sortedAssets.map(a => {
        const recipe = rApi?.byId?.(a.recipeId);
        const razed = a.actorUuid && !fromUuidSync(a.actorUuid, { strict: false });
        return `<tr>
          <td><b>${esc(a.customName)}</b>${razed ? " <em>(razed)</em>" : ""}</td>
          <td>${esc(recipe?.name || a.recipeId)}</td>
          <td>${a.district ? esc((settlement.districts.find(d => d.id === a.district)?.name) || "—") : "—"}</td>
          <td>${esc(fmtWorldDay(a.builtTs))}</td>
        </tr>`;
      }).join("");

      const scn = settlementScene(settlement);
      const content = `
        <p><em>${esc(settlement.name)}</em> — founded ${esc(fmtWorldDay(settlement.foundedTs))}
        on the hex <b>${esc(hexName(hexDoc))}</b>${faction ? ` by <b>${esc(faction.name)}</b>` : ""}.</p>
        ${scn ? `<p>🗺️ Town map: @UUID[Scene.${scn.id}]{${esc(scn.name)}}</p>` : ""}
        ${settlement.districts.length ? `<p>🏛️ Districts: ${settlement.districts.map(d => `<b>${esc(d.name)}</b> (${esc(d.type)} — ${esc(districtYieldPreview(d.type))})`).join(" · ")}</p>` : ""}
        <table>
          <thead><tr><th>Building</th><th>Kind</th><th>District</th><th>Built</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4"><em>Nothing built yet.</em></td></tr>`}</tbody>
        </table>
        <p style="font-size:0.85em; opacity:0.75;">Maintained by the 🏗️ Townbuilder — edits here are overwritten; use the GM Notes page for prose.</p>`;

      const page = entry.pages.find(p => p.name === "Buildings");
      if (page) await page.update({ "text.content": content });
      else await entry.createEmbeddedDocuments("JournalEntryPage", [{ name: "Buildings", type: "text", text: { content: content } }]);

      if (!entry.pages.find(p => p.name === "GM Notes")) {
        await entry.createEmbeddedDocuments("JournalEntryPage", [{ name: "GM Notes", type: "text", text: { content: "<p></p>" } }]);
      }
      return entry;
    } catch (e) { warn("Journal upsert failed (non-fatal):", e); return null; }
  }

  // ── Build flow (spec §8) ───────────────────────────────────────────────────
  async function buildAsset({ hexDoc, recipeId, customName }) {
    const rApi = recipesApi();
    const bApi = buApi();
    if (!rApi?.build) return { ok: false, error: "Structures recipe engine not loaded (bbttcc-structures)." };
    if (!bApi?.spendForAction) return { ok: false, error: "Build Units API not loaded." };

    const recipe = rApi.byId?.(recipeId);
    if (!recipe) return { ok: false, error: `Unknown recipe: ${recipeId}` };

    const faction = factionOf(hexDoc);
    if (!faction) return { ok: false, error: "No owning faction on this hex." };

    const { size, tier } = ladderFor(hexDoc);
    if (!tier) return { ok: false, error: "Hex size does not unlock the Townbuilder yet." };

    const isGM = !!game.user?.isGM;
    if (Number(recipe.tierGate || 1) > tier.maxTier && !isGM) {
      return { ok: false, error: `${recipe.name} unlocks at a larger settlement size.` };
    }

    const settlement = getSettlement(hexDoc) ?? {
      name: hexName(hexDoc),
      foundedByActorId: game.user?.character?.id || "",
      foundedFactionId: faction.id,
      foundedTs: game.time.worldTime,
      sceneId: "",
      assets: [], districts: []
    };
    if (settlement.assets.length >= tier.slots && !isGM) {
      return { ok: false, error: `All ${tier.slots} building slots are used at ${SIZE_LABELS[size]} size — develop the hex further.` };
    }

    const name = String(customName || "").replace(/\s+/g, " ").trim() || recipe.name;
    const buCost = buCostForRecipe(recipe);
    const payMats = chargesMaterials(recipe);

    const before = buBalance(faction);
    if (buCost > 0 && before < buCost && !isGM) {
      return { ok: false, error: `Need ${buCost} BU; ${faction.name} has ${before}.` };
    }
    if (payMats && rApi.canAfford) {
      const aff = rApi.canAfford(faction, recipe.materialOf ?? []);
      if (!aff?.ok && !isGM) {
        const miss = (aff?.missing || []).map(m => `${m.key} ×${m.qty ?? m.short ?? "?"}`).join(", ");
        return { ok: false, error: `Insufficient materials${miss ? `: ${miss}` : ""}.` };
      }
    }

    // 1) Spend BU (war log + GM whisper + Turn Ledger +1 day come free).
    //    Zero-cost recipes skip the spend (spendForAction rejects cost 0).
    let spent = false;
    if (buCost > 0) {
      const res = await bApi.spendForAction({
        factionId: faction.id,
        hexUuid: hexDoc.uuid,
        action: "asset",
        costOverride: buCost,
        note: `Townbuilder: "${name}" (${recipe.name})`
      });
      if (!res?.ok) return { ok: false, error: `Build Unit spend failed (${res?.reason || "unknown"}).` };
      spent = true;
    }

    // 2) Spawn the structure actor. BOM is always stamped (plates/HP derive
    //    from it); skipCostCheck controls whether the stockpile is drawn down.
    const built = await rApi.build(recipeId, faction, { actorName: name, skipCostCheck: !payMats });
    if (!built?.ok) {
      if (spent) { // refund — build failed after the BU left the ledger
        try { await faction.setFlag(MOD_F, "buildUnits", buBalance(faction) + buCost); } catch (_e) {}
      }
      const miss = (built?.missing || []).map(m => `${m.key} ×${m.qty ?? "?"}`).join(", ");
      return { ok: false, error: `${built?.error || "Build failed"}${miss ? ` — missing: ${miss}` : ""}` };
    }

    // 3) File the actor under Settlements/<town> and bind it to its home hex
    //    (system.identity.binding.hexId = drawing id; resolved by the system's
    //    _ftFindHexDrawingById via scene.drawings.get).
    const folder = await ensureActorFolder(settlement.name);
    try {
      const upd = { "system.identity.binding.hexId": hexDoc.id };
      if (folder) upd.folder = folder.id;
      await built.actor.update(upd);
    } catch (_e) {}

    // 4) Record the asset on the hex.
    settlement.assets.push({
      id: foundry.utils.randomID(16),
      recipeId,
      customName: name,
      actorUuid: built.actor.uuid,
      district: null,
      builtTs: game.time.worldTime,
      paidMaterials: payMats // demolish salvages half ONLY when materials were drawn
    });
    await writeSettlement(hexDoc, settlement);

    // Town map exists? Drop the new building straight onto it (GM only —
    // token creation is GM-gated; players' builds get placed on next GM pass).
    const townScene = settlementScene(settlement);
    if (townScene && game.user?.isGM) {
      try { await placeAssetToken(townScene, settlement.assets.at(-1), settlement.assets.length - 1); }
      catch (e) { warn("auto token placement failed:", e); }
    }

    // 5) Dossier ledger (spendForAction only writes one on modifier changes).
    try {
      await game.bbttcc?.api?.territory?.recordHexImprovement?.(hexDoc, {
        kind: "build",
        label: `Townbuilder: built "${name}" (${recipe.name})`,
        description: `${faction.name} raised ${name} — a ${recipe.name} — in ${settlement.name}.`,
        source: { activity: "townbuilder:build", factionId: faction.id },
        reversible: false,
        dedupeKey: `townbuilder:${hexDoc.id}:${settlement.assets.length}:${name}`
      });
    } catch (_e) {}

    // 6) Journal.
    await upsertJournal(hexDoc, settlement);

    log(`Built "${name}" (${recipe.name}) at`, hexName(hexDoc), `— ${buCost} BU${payMats ? " + materials" : ""}`);
    return { ok: true, actor: built.actor, settlement, buCost };
  }

  // ── Rename flow ────────────────────────────────────────────────────────────
  async function renameAsset({ hexDoc, assetId, newName }) {
    const settlement = getSettlement(hexDoc);
    if (!settlement) return { ok: false, error: "No settlement on this hex." };
    const asset = settlement.assets.find(a => a.id === assetId);
    if (!asset) return { ok: false, error: "Asset not found." };
    const name = String(newName || "").replace(/\s+/g, " ").trim();
    if (!name) return { ok: false, error: "Name cannot be empty." };

    asset.customName = name;
    await writeSettlement(hexDoc, settlement);
    try {
      const actor = fromUuidSync(asset.actorUuid, { strict: false });
      if (actor) await actor.update({ name, "prototypeToken.name": name });
    } catch (_e) {}
    await upsertJournal(hexDoc, settlement);
    return { ok: true, settlement };
  }

  // ── Dialog UI ──────────────────────────────────────────────────────────────
  // 🪤 V1 Dialogs reset to open-time HTML on render() — we never call render
  // after open. All refreshes are container.innerHTML swaps that preserve the
  // one piece of user state (the name field), and the delegated listener lives
  // on the container element itself so it survives the swap.

  function contentHTML(hexDoc) {
    const tf = hexDoc.flags?.[MOD_T] || {};
    const faction = factionOf(hexDoc);
    const { size, tier } = ladderFor(hexDoc);
    const settlement = getSettlement(hexDoc);
    const type = String(tf.type || "wilderness").toLowerCase();
    const balance = buBalance(faction);
    const usedSlots = settlement?.assets?.length ?? 0;
    const isGM = !!game.user?.isGM;
    const canBuild = isGM || (!!faction?.isOwner && game.user?.can?.("ACTOR_CREATE"));
    const menu = menuFor(hexDoc);

    const head = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:.6rem; flex-wrap:wrap; margin-bottom:.4rem;">
        <div>
          <div style="font-size:1.05em;"><b>${esc(settlement?.name || hexName(hexDoc))}</b></div>
          <div style="font-size:.82em; opacity:.8;">Hex: ${esc(hexName(hexDoc))} · Type: <b>${esc(type)}</b> · Size: <b>${esc(SIZE_LABELS[size] || size)}</b> (unlocks T${tier?.maxTier ?? "—"})</div>
        </div>
        <div style="display:flex; gap:.4rem; flex-wrap:wrap;">
          <span style="padding:.15rem .55rem; border:1px solid rgba(232,200,74,.45); border-radius:10px; font-size:11px; color:#e8c84a; background:rgba(232,200,74,.08); white-space:nowrap;">
            <i class="fas fa-hammer" style="font-size:10px;"></i> BU: <b>${balance}</b></span>
          <span style="padding:.15rem .55rem; border:1px solid rgba(120,190,255,.4); border-radius:10px; font-size:11px; color:#8cc8ff; background:rgba(120,190,255,.08); white-space:nowrap;">
            Slots: <b>${usedSlots}</b> / ${tier?.slots ?? 0}</span>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; font-size:.78em; opacity:.85; margin-bottom:.5rem;">
        ${(() => {
          const scn = settlementScene(settlement);
          if (scn) return `<button type="button" data-tb-action="visit-scene" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.12rem .55rem;" data-tooltip="Open the town map">🗺️ Visit ${esc(scn.name.replace(/^🏘️\s*/, ""))}</button>`;
          if (isGM && (settlement?.assets?.length ?? 0) > 0) return `<button type="button" data-tb-action="create-scene" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.12rem .55rem;" data-tooltip="Duplicate a generic town map, bind it to this hex, and place all building tokens on it">🗺️ Raise Town Map</button>`;
          return "";
        })()}
        ${(() => {
          const dists = settlement?.districts ?? [];
          const cap = tier?.districts ?? 0;
          const chips = dists.map(d =>
            `<span style="padding:.1rem .5rem; border:1px solid rgba(180,140,255,.45); border-radius:10px; font-size:11px; color:#c9a8ff; background:rgba(180,140,255,.08); white-space:nowrap;" data-tooltip="${esc(d.type)} district — ${esc(districtYieldPreview(d.type))} · unlocks the ${esc(d.type)} building menu">🏛️ ${esc(d.name)}${isGM ? ` <a data-tb-action="dissolve-district" data-district-id="${esc(d.id)}" style="cursor:pointer; opacity:.7;" data-tooltip="Dissolve district">✕</a>` : ""}</span>`
          ).join(" ");
          const canFound = (isGM || canBuild) && cap > dists.length && (settlement?.assets?.length ?? 0) > 0;
          const foundBtn = canFound
            ? `<button type="button" data-tb-action="found-district" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.12rem .55rem;" data-tooltip="Add another settlement type's menu + ${Math.round(districtShare() * 100)}% of its yields — costs ${districtBuCost()} BU">🏛️ Found District (${districtBuCost()} BU)</button>`
            : "";
          const status = cap ? `Districts: ${dists.length}/${cap}` : `Districts unlock at City size.`;
          return `${chips} ${foundBtn} <span style="opacity:.8;">${status}</span>`;
        })()}
        <span style="opacity:.8;">${canBuild ? "" : `<b>Read-only:</b> ask your GM to build (needs faction ownership + actor-creation rights).`}</span>
      </div>`;

    if (!menu) {
      return head + `<p style="color:#e08080;">Structures recipe engine not loaded — enable <b>bbttcc-structures</b>.</p>`;
    }

    const byCat = new Map();
    for (const r of menu) {
      const c = CATEGORY_ORDER.includes(r.category) ? r.category : "utility";
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c).push(r);
    }

    const slotsFull = tier ? usedSlots >= tier.slots : true;
    let list = "";
    for (const cat of CATEGORY_ORDER) {
      const rs = byCat.get(cat);
      if (!rs?.length) continue;
      const rows = rs.map(r => {
        const locked = Number(r.tierGate || 1) > (tier?.maxTier ?? 0);
        const buCost = buCostForRecipe(r);
        const mats = chargesMaterials(r);
        const costTxt = `${buCost} BU${mats ? " + materials" : ""}`;
        const afford = buCost <= balance;
        const disabled = locked || slotsFull || !canBuild || (!afford && !isGM);
        const why = locked ? `Unlocks at ${esc(unlockSizeFor(r))}`
          : slotsFull ? "All building slots used"
          : !canBuild ? "Read-only"
          : (!afford && !isGM) ? `Need ${buCost} BU (have ${balance})`
          : `${esc(r.name)} — ${costTxt}`;
        // Grid, not flex: the theme's .bbttcc-btn stretches to 100% width in
        // dialog forms, which crushed the name column. minmax(0,1fr) keeps the
        // text column shrinkable; the button gets a hard width:auto override.
        return `<div style="display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:.55rem; padding:.24rem .3rem; border-bottom:1px dotted rgba(255,255,255,.08); ${locked ? "opacity:.45;" : ""}">
          <div style="min-width:0;">
            <b style="white-space:nowrap;">${esc(r.name)}</b> <span style="opacity:.65; font-size:.78em; white-space:nowrap;">${r.footprintGrid ? `${r.footprintGrid.w}×${r.footprintGrid.h}` : ""}${locked ? ` · 🔒 ${esc(unlockSizeFor(r))}` : ""}</span>
            <div style="font-size:.76em; opacity:.65; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${esc(r.description || "")}">${esc(r.description || "")}</div>
          </div>
          <span style="font-size:.76em; color:#e8c84a; white-space:nowrap;">${costTxt}</span>
          <button type="button" data-tb-action="build" data-recipe-id="${esc(r.id)}" class="bbttcc-btn"
                  style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.15rem .7rem; white-space:nowrap; justify-self:end;" ${disabled ? "disabled" : ""} data-tooltip="${why}">Build</button>
        </div>`;
      }).join("");
      list += `<details open style="margin-bottom:.35rem;"><summary style="cursor:pointer; color:#8cc8ff; font-size:.85em; letter-spacing:.05em;">${CATEGORY_LABELS[cat]} (${rs.length})</summary>${rows}</details>`;
    }
    if (!list) list = `<p style="opacity:.7;"><em>No recipes match this hex's settlement type (${esc(type)}) yet — the type-flavored content batch is Phase 1.5.</em></p>`;

    const builtRows = (settlement?.assets || []).map(a => {
      const r = recipesApi()?.byId?.(a.recipeId);
      const gone = a.actorUuid && !fromUuidSync(a.actorUuid, { strict: false });
      return `<div style="display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:.5rem; padding:.18rem .3rem;">
        <div style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><b>${esc(a.customName)}</b> <span style="opacity:.6; font-size:.78em;">(${esc(r?.name || a.recipeId)})${gone ? " — <em>razed</em>" : ""}</span></div>
        ${(settlement?.districts?.length ?? 0) ? `<button type="button" data-tb-action="assign-district" data-asset-id="${esc(a.id)}" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.1rem .5rem;" data-tooltip="Assign to a district${a.district ? ` (now: ${esc(settlement.districts.find(d => d.id === a.district)?.name || "—")})` : ""}">🏷️</button>` : ""}
        <button type="button" data-tb-action="rename" data-asset-id="${esc(a.id)}" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.1rem .5rem;" data-tooltip="Rename">✏️</button>
        <button type="button" data-tb-action="open-actor" data-asset-id="${esc(a.id)}" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.1rem .5rem;" ${gone ? "disabled" : ""} data-tooltip="Open sheet">🗺️</button>
        ${isGM ? `<button type="button" data-tb-action="demolish" data-asset-id="${esc(a.id)}" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.1rem .5rem;" data-tooltip="Demolish${a.paidMaterials ? " (salvages half the materials)" : " (no salvage — BU-only build)"}">🧨</button>` : ""}
      </div>`;
    }).join("");

    return head + `
      <div style="max-height:340px; overflow-y:auto; overflow-x:hidden; border:1px solid rgba(255,255,255,.12); border-radius:6px; padding:.35rem .45rem; margin-bottom:.5rem;">${list}</div>
      <div class="form-group" style="margin-bottom:.5rem;">
        <label style="font-size:.85em;">Name your building</label>
        <input type="text" data-tb-field="name" placeholder="e.g. The Waiting Room" maxlength="60" style="width:100%;">
        <p class="hint" style="font-size:.75em;">Blank = the recipe's own name. Buildings become real actors under <b>Settlements/${esc(settlement?.name || hexName(hexDoc))}</b>.</p>
      </div>
      <details ${builtRows ? "open" : ""}><summary style="cursor:pointer; color:#8cc8ff; font-size:.85em;">Built so far (${settlement?.assets?.length ?? 0})</summary>
        <div style="max-height:150px; overflow-y:auto;">${builtRows || `<p style="opacity:.6; font-size:.85em; margin:.3rem;"><em>Nothing yet — raise your first building!</em></p>`}</div>
      </details>`;
  }

  function unlockSizeFor(recipe) {
    const t = Number(recipe.tierGate || 1);
    for (const size of ["outpost", "village", "town", "city", "metropolis", "megalopolis"]) {
      if ((LADDER[size]?.maxTier ?? 0) >= t) return SIZE_LABELS[size];
    }
    return "Megalopolis";
  }

  async function refresh(container, hexDoc) {
    const nameField = container.querySelector('[data-tb-field="name"]');
    const keep = nameField ? nameField.value : "";
    const fresh = await fromUuid(hexDoc.uuid);
    const doc = fresh?.document ?? fresh ?? hexDoc;
    container.innerHTML = contentHTML(doc);
    const nf = container.querySelector('[data-tb-field="name"]');
    if (nf) nf.value = keep;
    return doc;
  }

  async function open({ hexUuid } = {}) {
    let doc = null;
    try { const d = await fromUuid(hexUuid); doc = d?.document ?? d ?? null; } catch (_e) {}
    if (!doc) { ui.notifications?.warn?.("Townbuilder: hex not found."); return null; }

    const elig = eligibility(doc);
    if (!elig.ok && !game.user?.isGM) { ui.notifications?.warn?.(`Townbuilder: ${elig.reason}`); return null; }
    if (!elig.ok) ui.notifications?.info?.(`Townbuilder (GM bypass): ${elig.reason}`);

    let hexDoc = doc;
    const container = document.createElement("div");
    container.className = "bbttcc-townbuilder";
    container.innerHTML = contentHTML(hexDoc);

    container.addEventListener("click", async (ev) => {
      const btn = ev.target?.closest?.("[data-tb-action]");
      if (!btn || btn.disabled) return;
      ev.preventDefault(); ev.stopPropagation();
      const action = btn.getAttribute("data-tb-action");

      try {
        if (action === "build") {
          const recipeId = btn.getAttribute("data-recipe-id");
          const customName = container.querySelector('[data-tb-field="name"]')?.value || "";
          btn.disabled = true;
          const res = await buildAsset({ hexDoc, recipeId, customName });
          if (res.ok) {
            ui.notifications?.info?.(`🏗️ Raised "${res.settlement.assets.at(-1).customName}" in ${res.settlement.name}.`);
            const nf = container.querySelector('[data-tb-field="name"]');
            if (nf) nf.value = "";
          } else {
            ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          }
          hexDoc = await refresh(container, hexDoc);
        } else if (action === "rename") {
          const assetId = btn.getAttribute("data-asset-id");
          const asset = getSettlement(hexDoc)?.assets?.find(a => a.id === assetId);
          if (!asset) return;
          const newName = await Dialog.prompt({
            title: `Rename — ${asset.customName}`,
            content: `<div class="form-group"><label>New name</label><input type="text" name="tb-rename" value="${esc(asset.customName)}" maxlength="60" style="width:100%;"></div>`,
            label: "Rename",
            callback: (html) => (html instanceof jQuery ? html[0] : html).querySelector('input[name="tb-rename"]')?.value ?? "",
            rejectClose: false
          });
          if (newName == null) return;
          const res = await renameAsset({ hexDoc, assetId, newName });
          if (!res.ok) ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          hexDoc = await refresh(container, hexDoc);
        } else if (action === "open-actor") {
          const assetId = btn.getAttribute("data-asset-id");
          const asset = getSettlement(hexDoc)?.assets?.find(a => a.id === assetId);
          const actor = asset ? fromUuidSync(asset.actorUuid, { strict: false }) : null;
          actor?.sheet?.render?.(true);
        } else if (action === "visit-scene") {
          const scn = settlementScene(getSettlement(hexDoc));
          if (scn) { try { await scn.view(); } catch (e) { ui.notifications?.warn?.("Cannot view that scene — ask your GM to activate it."); } }
        } else if (action === "create-scene") {
          const choices = await templateSceneChoices();
          if (!choices.length) { ui.notifications?.warn?.("Townbuilder: no generic town scenes found in the pack."); return; }
          const opts = choices.map((c, i) => `<label style="display:block; padding:.15rem 0;"><input type="radio" name="tb-template" value="${esc(c.id)}" ${i === 0 ? "checked" : ""}> ${esc(c.name)}</label>`).join("");
          const templateId = await Dialog.prompt({
            title: "🗺️ Raise Town Map — pick a base",
            content: `<div class="form-group"><p style="font-size:.85em; opacity:.8;">The map is duplicated from the pack, bound to this hex (Scenes panel + Holdings deploy), and every building gets a token — reposition them to taste.</p>${opts}</div>`,
            label: "Raise it",
            callback: (html) => (html instanceof jQuery ? html[0] : html).querySelector('input[name="tb-template"]:checked')?.value ?? "",
            rejectClose: false
          });
          if (!templateId) return;
          btn.disabled = true;
          const res = await createSettlementScene({ hexDoc, templateId });
          if (res.ok) ui.notifications?.info?.(`🗺️ Town map raised — ${res.placed} building token${res.placed === 1 ? "" : "s"} placed.`);
          else ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          hexDoc = await refresh(container, hexDoc);
        } else if (action === "demolish") {
          const assetId = btn.getAttribute("data-asset-id");
          const asset = getSettlement(hexDoc)?.assets?.find(a => a.id === assetId);
          if (!asset) return;
          const sure = await Dialog.confirm({
            title: `🧨 Demolish — ${asset.customName}`,
            content: `<p>Tear down <b>${esc(asset.customName)}</b>? The actor and its tokens are deleted.` +
                     `${asset.paidMaterials ? " Half the materials return to the stockpile." : " No salvage — it was built with Build Units only."}</p>`,
            defaultYes: false
          });
          if (!sure) return;
          const res = await demolishAsset({ hexDoc, assetId });
          if (res.ok) ui.notifications?.info?.(`🧨 ${asset.customName} came down.${res.salvage.length ? ` Salvaged: ${res.salvage.join(", ")}.` : ""}`);
          else ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          hexDoc = await refresh(container, hexDoc);
        } else if (action === "found-district") {
          const settlement = getSettlement(hexDoc);
          const hexType = String(hexDoc.flags?.[MOD_T]?.type || "").toLowerCase();
          const taken = new Set((settlement?.districts || []).map(d => String(d.type).toLowerCase()));
          const options = DISTRICT_TYPES.filter(t => t !== hexType && !taken.has(t));
          if (!options.length) { ui.notifications?.warn?.("Townbuilder: no district types left to found here."); return; }
          const radios = options.map((t, i) =>
            `<label style="display:block; padding:.15rem 0;"><input type="radio" name="tb-district-type" value="${esc(t)}" ${i === 0 ? "checked" : ""}> <b>${esc(t)}</b> <span style="opacity:.7; font-size:.85em;">— ${esc(districtYieldPreview(t))} · unlocks the ${esc(t)} menu</span></label>`
          ).join("");
          const picked = await Dialog.prompt({
            title: `🏛️ Found District — ${settlement?.name ?? ""}`,
            content: `<div class="form-group"><p style="font-size:.85em; opacity:.8;">Costs <b>${districtBuCost()} BU</b>. Adds ${Math.round(districtShare() * 100)}% of the type's baseline yields (size-scaled) and unions its building menu into this settlement.</p>${radios}
              <label style="display:block; margin-top:.4rem;">District name <input type="text" name="tb-district-name" placeholder="e.g. Saltway District" maxlength="60" style="width:100%;"></label></div>`,
            label: "Found it",
            callback: (html) => {
              const el = html instanceof jQuery ? html[0] : html;
              return {
                type: el.querySelector('input[name="tb-district-type"]:checked')?.value ?? "",
                name: el.querySelector('input[name="tb-district-name"]')?.value ?? ""
              };
            },
            rejectClose: false
          });
          if (!picked?.type) return;
          const res = await foundDistrict({ hexDoc, type: picked.type, name: picked.name });
          if (res.ok) ui.notifications?.info?.(`🏛️ ${res.settlement.districts.at(-1).name} founded — the ${picked.type} menu is open here.`);
          else ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          hexDoc = await refresh(container, hexDoc);
        } else if (action === "dissolve-district") {
          const districtId = btn.getAttribute("data-district-id");
          const district = getSettlement(hexDoc)?.districts?.find(d => d.id === districtId);
          if (!district) return;
          const sure = await Dialog.confirm({
            title: `Dissolve — ${district.name}`,
            content: `<p>Dissolve <b>${esc(district.name)}</b> (${esc(district.type)})? Its yield share and menu union end; its buildings fold back into the settlement. No BU refund.</p>`,
            defaultYes: false
          });
          if (!sure) return;
          const res = await dissolveDistrict({ hexDoc, districtId });
          if (res.ok) ui.notifications?.info?.(`${district.name} dissolved.`);
          else ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          hexDoc = await refresh(container, hexDoc);
        } else if (action === "assign-district") {
          const assetId = btn.getAttribute("data-asset-id");
          const settlement = getSettlement(hexDoc);
          const asset = settlement?.assets?.find(a => a.id === assetId);
          if (!asset || !settlement?.districts?.length) return;
          const radios = [{ id: "", name: "— the settlement proper —" }, ...settlement.districts].map((d, i) =>
            `<label style="display:block; padding:.15rem 0;"><input type="radio" name="tb-assign" value="${esc(d.id)}" ${(asset.district || "") === d.id ? "checked" : (i === 0 && !asset.district ? "" : "")}> ${esc(d.name)}</label>`
          ).join("");
          const pickedId = await Dialog.prompt({
            title: `🏷️ Assign — ${asset.customName}`,
            content: `<div class="form-group">${radios}</div>`,
            label: "Assign",
            callback: (html) => {
              const el = html instanceof jQuery ? html[0] : html;
              return el.querySelector('input[name="tb-assign"]:checked')?.value;
            },
            rejectClose: false
          });
          if (pickedId === undefined || pickedId === null) return;
          const res = await assignAssetDistrict({ hexDoc, assetId, districtId: pickedId || null });
          if (!res.ok) ui.notifications?.warn?.(`Townbuilder: ${res.error}`);
          hexDoc = await refresh(container, hexDoc);
        }
      } catch (e) {
        warn("Townbuilder action failed:", e);
        ui.notifications?.error?.("Townbuilder action failed — see console.");
        try { hexDoc = await refresh(container, hexDoc); } catch (_e) {}
      }
    });

    const dlg = new Dialog({
      title: `🏗️ Townbuilder — ${getSettlement(hexDoc)?.name || hexName(hexDoc)}`,
      content: "<div data-tb-mount></div>",
      buttons: { close: { label: "Close" } },
      default: "close",
      render: (html) => {
        const el = html instanceof jQuery ? html[0] : html;
        el.querySelector("[data-tb-mount]")?.replaceWith(container);
      }
    }, { width: 620, resizable: true, classes: ["dialog", "bbttcc-townbuilder-dialog"] });
    dlg.render(true);
    return dlg;
  }

  // ── Settings + API publish ─────────────────────────────────────────────────
  Hooks.once("init", () => {
    const num = (key, name, hint, def) => game.settings.register(MOD_T, key, {
      name, hint, scope: "world", config: true, type: Number, default: def
    });
    num("townbuilderBuCostT1", "Townbuilder: Tier 1 building cost (BU)",
      "Build Units for a civilian tierGate-1 building. Fortifications use the Construct Asset cost instead.", 1);
    num("townbuilderBuCostT2", "Townbuilder: Tier 2 building cost (BU)",
      "Build Units for a civilian tierGate-2 building.", 2);
    num("townbuilderBuCostT3", "Townbuilder: Tier 3 building cost (BU)",
      "Build Units for a civilian tierGate-3 building.", 3);
    game.settings.register(MOD_T, "townbuilderChargeMaterials", {
      name: "Townbuilder: also charge stockpile materials",
      hint: "OFF (default): civilian buildings cost Build Units only — BU already derives from Materials pips. ON: recipe bills of materials are also withdrawn from the faction stockpile. Fortifications always charge materials.",
      scope: "world", config: true, type: Boolean, default: false
    });
    game.settings.register(MOD_T, "districtYieldShare", {
      name: "Townbuilder: district yield share",
      hint: "Fraction of a district type's baseline resource profile added to the hex's production (applied pre-size-multiplier in the factions engine). 0.5 = a city's Port District adds half a port's base yields, city-scaled.",
      scope: "world", config: true, type: Number, default: 0.5
    });
  });

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= {};
    game.bbttcc.api.territory.townbuilder = {
      open, getSettlement, ladderFor, buildAsset, renameAsset, demolishAsset,
      createSettlementScene, foundDistrict, dissolveDistrict, assignAssetDistrict,
      LADDER, DISTRICT_TYPES
    };
    log("Published API at game.bbttcc.api.territory.townbuilder");
  });
})();
