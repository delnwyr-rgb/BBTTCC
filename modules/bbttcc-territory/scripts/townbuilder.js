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
      const rows = settlement.assets.map(a => {
        const recipe = rApi?.byId?.(a.recipeId);
        const razed = a.actorUuid && !fromUuidSync(a.actorUuid, { strict: false });
        return `<tr>
          <td><b>${esc(a.customName)}</b>${razed ? " <em>(razed)</em>" : ""}</td>
          <td>${esc(recipe?.name || a.recipeId)}</td>
          <td>${a.district ? esc((settlement.districts.find(d => d.id === a.district)?.name) || "—") : "—"}</td>
          <td>${esc(fmtWorldDay(a.builtTs))}</td>
        </tr>`;
      }).join("");

      const content = `
        <p><em>${esc(settlement.name)}</em> — founded ${esc(fmtWorldDay(settlement.foundedTs))}
        on the hex <b>${esc(hexName(hexDoc))}</b>${faction ? ` by <b>${esc(faction.name)}</b>` : ""}.</p>
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
      builtTs: game.time.worldTime
    });
    await writeSettlement(hexDoc, settlement);

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
      <div style="font-size:.78em; opacity:.7; margin-bottom:.5rem;">
        ${tier?.districts ? `Districts: ${settlement?.districts?.length ?? 0}/${tier.districts} (founding arrives in Phase 3).` : `Districts unlock at City size.`}
        ${canBuild ? "" : ` <b>Read-only:</b> ask your GM to build (needs faction ownership + actor-creation rights).`}
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
        <button type="button" data-tb-action="rename" data-asset-id="${esc(a.id)}" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.1rem .5rem;" data-tooltip="Rename">✏️</button>
        <button type="button" data-tb-action="open-actor" data-asset-id="${esc(a.id)}" class="bbttcc-btn" style="width:auto !important; min-width:0 !important; margin:0 !important; padding:.1rem .5rem;" ${gone ? "disabled" : ""} data-tooltip="Open sheet">🗺️</button>
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
      const btn = ev.target?.closest?.("button[data-tb-action]");
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
  });

  Hooks.once("ready", () => {
    game.bbttcc ??= { api: {} };
    game.bbttcc.api ??= {};
    game.bbttcc.api.territory ??= {};
    game.bbttcc.api.territory.townbuilder = { open, getSettlement, ladderFor, buildAsset, renameAsset, LADDER };
    log("Published API at game.bbttcc.api.territory.townbuilder");
  });
})();
