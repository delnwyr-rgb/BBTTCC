/* modules/bbttcc-territory/scripts/hex-resource-nodes.enhancer.js
 * Bad Eden Hex Resource Nodes — harvest adapter
 *
 * Phase 2 (2026-05-02). Companion to:
 *   - macros/seed-hex-resource-nodes.macro.js (seeder)
 *   - templates/hex-sheet.hbs (UI section)
 *   - bbttcc-hex-sheet.enhancer.js (context + click handler)
 *
 * The existing `game.fourththing.harvest.attempt(actor, sourceDoc)` reads
 * the harvest flag at `flags.fourththing.harvest` on a single doc. Hex
 * nodes live in an array at `flags.bbttcc-territory.resourceNodes` keyed
 * by node id. This adapter fans out to the same roll/yield/decrement
 * pipeline but addresses individual array entries by id.
 *
 * API (registered on ready):
 *   game.bbttcc.api.territory.harvestHexNode(actor, hexDoc, nodeId)
 *     → { ok, success, total, dc, yield, remaining }
 */

(() => {
  const MOD = "bbttcc-territory";
  const NODES_PATH = `flags.${MOD}.resourceNodes`;
  const TAG = "[bbttcc-hex-nodes]";

  function findNode(hexDoc, nodeId) {
    const arr = foundry.utils.getProperty(hexDoc, NODES_PATH);
    if (!Array.isArray(arr)) return { node: null, idx: -1, arr: [] };
    const idx = arr.findIndex(n => n && n.id === nodeId);
    return { node: idx >= 0 ? arr[idx] : null, idx, arr };
  }

  // Drawings belong to their author: a PLAYER seat cannot update the hex Drawing
  // (live 2026-09-07: "User Mags lacks permission to update Drawing … in parent
  // Scene" on Harvest). GM seats write directly; player seats relay the ONE thing
  // a harvest may change — a node's charges, decrement only — to the GM seat via
  // the codebase's seat primitive (bbttcc-core gmExec).
  const RELAY_TYPE = "territory.hexNode.charges";
  async function writeNodeUpdate(hexDoc, idx, arr, patch) {
    const next = arr.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    const gx = game.bbttcc?.api?.gmExec;
    if (game.user?.isGM || !gx?.call) { await hexDoc.update({ [NODES_PATH]: next }); return; }
    const onlyCharges = Object.keys(patch || {}).every(k => k === "charges");
    if (!onlyCharges) throw new Error("hex node write from a player seat may only change charges.");
    await gx.call(RELAY_TYPE, { sceneId: hexDoc.parent?.id, drawingId: hexDoc.id, nodeId: arr[idx]?.id, charges: Number(patch.charges) });
  }
  function _registerChargesRelay() {
    const gx = game.bbttcc?.api?.gmExec;
    if (!gx?.register) return;
    gx.register(RELAY_TYPE, async (p, meta) => {
      const scene = game.scenes?.get(String(p?.sceneId || ""));
      const doc = scene?.drawings?.get(String(p?.drawingId || ""));
      const tf = doc?.flags?.[MOD] || {};
      if (!doc || !(tf.isHex === true || tf.kind === "territory-hex" || tf.hexId)) throw new Error("not a hex drawing");
      const arr = Array.isArray(foundry.utils.getProperty(doc, NODES_PATH)) ? foundry.utils.getProperty(doc, NODES_PATH) : [];
      const idx = arr.findIndex(n => String(n?.id) === String(p?.nodeId));
      if (idx < 0) throw new Error("node not found");
      const cur = Number(arr[idx].charges ?? 0), want = Number(p?.charges);
      if (!Number.isFinite(want) || want < 0 || want >= cur) throw new Error(`charges may only decrement (${cur} → ${want} refused)`);
      const next = arr.map((n, i) => (i === idx ? { ...n, charges: want } : n));
      await doc.update({ [NODES_PATH]: next });
      console.log("[bbttcc-territory] hex node charges", `${arr[idx].label || arr[idx].id}: ${cur} → ${want}`, `(for ${meta?.fromUserName || "?"})`);
      return { ok: true, charges: want };
    });
  }

  // Resolve a material's item data (uuid → master-content pack by key → stub). Shared by the main yield and the drops.
  async function _materialItemData(RfiItems, { uuid, key, name, tier }, units) {
    let data = null;
    if (uuid) { try { const src = await fromUuid(uuid); if (src) { data = src.toObject(); delete data._id; } } catch (_e) {} }
    if (!data && key) {
      try {
        const pack = game.packs.get("bbttcc-master-content.items");
        if (pack) {
          const idx = await pack.getIndex({ fields: ["flags.fourththing.rfi.item.materialKey"] });
          const hit = idx.find(e => foundry.utils.getProperty(e, "flags.fourththing.rfi.item.materialKey") === key);
          const src = hit ? await pack.getDocument(hit._id) : null;
          if (src) { data = src.toObject(); delete data._id; }
        }
      } catch (_e) {}
    }
    if (!data) data = {
      name: name || key, type: "gear", img: "icons/svg/mystery-man.svg",
      system: { slot: "material", tags: ["material", key] },
      flags: { fourththing: { rfi: { item: { ...RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null }),
        tier: tier || "I", frame: "material", origin: "found", bound: "free", materialKey: key, charges: units, upkeep: { mode: "passive", per: "none" } } } } }
    };
    foundry.utils.setProperty(data, "flags.fourththing.rfi.item.charges", units);
    return data;
  }

  // HARVEST GOES TO THE STOCKPILE (owner ruling 2026-09-21): a steward with a faction gathers straight into that
  // faction's stockpile (name/img/lastUuid remembered for pricing); anyone else stacks it in their pockets.
  async function _deliverMaterial(actor, data, units) {
    const fid = String(actor?.system?.faction?.id || "").replace(/^Actor\./, "");
    const F = fid ? game.actors?.get(fid) : null; const stock = game.bbttcc?.api?.factions?.stockpile;
    const key = foundry.utils.getProperty(data, "flags.fourththing.rfi.item.materialKey") || data.name;
    if (F && stock?.adjust) {
      await stock.adjust(F, key, +units, { name: data.name, img: data.img, lastUuid: data.flags?.core?.sourceId || data._stats?.compendiumSource || null });
      return { to: "stockpile", faction: F };
    }
    const stackApi = game.fourththing?.stack?.orCreate;
    if (stackApi) await stackApi(actor, data); else await actor.createEmbeddedDocuments("Item", [data]);
    return { to: "pockets" };
  }

  /**
   * Harvest one node from a hex.
   *
   * Mirrors RfiHarvest.attempt's roll → yield → decrement → chat pattern
   * but indexes into the hex's resourceNodes array. Yields are real Item
   * documents on the actor (cloned from the materialUuid if present;
   * otherwise a stub keyed by materialKey).
   */
  async function harvestHexNode(actor, hexDoc, nodeId) {
    if (!actor) throw new Error("harvestHexNode: no actor.");
    if (!hexDoc) throw new Error("harvestHexNode: no hex doc.");
    if (!nodeId) throw new Error("harvestHexNode: no node id.");

    const RfiItems = game.fourththing?.items;
    if (!RfiItems) {
      ui.notifications?.error("RFI items API not available.");
      return { ok: false, reason: "no-items-api" };
    }

    const { node, idx, arr } = findNode(hexDoc, nodeId);
    if (!node) {
      ui.notifications?.warn("Node not found on this hex.");
      return { ok: false, reason: "missing-node" };
    }

    const charges = Number(node.charges ?? 0);
    if (charges <= 0) {
      ui.notifications?.warn(`${node.materialName || node.materialKey} is depleted.`);
      return { ok: false, reason: "depleted" };
    }

    const skill = node.skill || "body";
    const dc = Number(node.dc ?? 12);
    const sys = actor.system?.system ?? actor.system;
    const baseAttr = Number(sys?.attributes?.[skill]?.value ?? 0);

    // Passive AE bonuses (mode "add") on the attribute being used.
    const aeContribs = [];
    let aeAttr = 0;
    for (const effect of actor.appliedEffects ?? []) {
      if (effect.disabled) continue;
      const src = effect.parent?.name ?? effect.name ?? "Passive";
      for (const change of effect.changes ?? []) {
        if (change.type !== "add" || change.key !== `system.attributes.${skill}.value`) continue;
        const v = Number(change.value) || 0;
        if (!v) continue;
        aeAttr += v;
        aeContribs.push({ src, label: skill, value: v });
      }
    }
    const attr = baseAttr + aeAttr;

    const formula = `2d10 + ${attr}`;
    const roll = new Roll(formula);
    await roll.evaluate();
    const total = roll.total;
    const success = total >= dc;

    let yieldUnits = 0;
    let nextCharges = charges;
    if (success) {
      const yRoll = new Roll(String(node.yieldFormula ?? "1"));
      await yRoll.evaluate();
      yieldUnits = Math.max(1, Number(yRoll.total) || 1);

      // Decrement node charges (success only — gather is low-risk per RfiHarvest convention).
      nextCharges = charges - 1;
      await writeNodeUpdate(hexDoc, idx, arr, { charges: nextCharges });

      const materialItemData = await _materialItemData(RfiItems, { uuid: node.materialUuid, key: node.materialKey, name: node.materialName, tier: node.tier }, yieldUnits);
      var delivered = await _deliverMaterial(actor, materialItemData, yieldUnits);
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll ft-magic-roll">
                  <div class="ft-misfire-box standalone" style="border-color:${success ? "#5fb35f" : "#d4a35f"}">
                    <span class="ft-misfire-label">🜨 Hex Gathering — ${node.materialName || node.materialKey}${node.rich ? " ★ rich" : ""}</span>
                    <p class="ft-misfire-desc">
                      ${formula} → <b>${total}</b> vs DC ${dc} (${skill})<br>
                      ${aeContribs.length ? `<span style="color:#e8c84a;font-size:0.78rem">Passives: ${aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")}</span><br>` : ""}
                      ${success
                        ? `✓ <b>Success</b> — gathered ${yieldUnits} unit${yieldUnits > 1 ? "s" : ""} of ${node.materialName || node.materialKey}${delivered?.to === "stockpile" ? ` → <b>${delivered.faction.name}</b>'s stockpile` : ""}.<br>Node has ${nextCharges} attempt${nextCharges === 1 ? "" : "s"} remaining.`
                        : `✗ <b>Failed</b> — no yield. The node's charges are unchanged.`}
                    </p>
                  </div></div>`
    });

    // DROPS (owner ruling 2026-09-20): a node may carry `drops: [{ key, chance (0..1), qty?: "1"|"1d2", name?, uuid?, tier? }]` —
    // on a successful gather each drop rolls its chance and lands beside the main yield (same shape as the system's scene nodes).
    const dropped = [];
    if (success && Array.isArray(node.drops)) {
      for (const d of node.drops) {
        try {
          if (!d?.key) continue;
          const chance = Number(d.chance); if (!(Math.random() < (Number.isFinite(chance) ? chance : 0))) continue;
          const qr = new Roll(String(d.qty ?? "1")); await qr.evaluate(); const units = Math.max(1, Number(qr.total) || 1);
          const data = await _materialItemData(RfiItems, { uuid: d.uuid, key: d.key, name: d.name, tier: d.tier }, units);
          await _deliverMaterial(actor, data, units); dropped.push({ key: d.key, units, name: data.name || d.name || d.key });
        } catch (eD) { console.warn(TAG, "drop failed", d, eD); }
      }
      if (dropped.length) { try { await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="ft-harvest-drops">✦ <b>Also found</b> — ${dropped.map(x => `${x.units}× ${x.name}`).join(", ")}</div>` }); } catch (_eM) {} }
    }
    return { ok: true, success, total, dc, yield: yieldUnits, drops: dropped, remaining: nextCharges };
  }

  /** Refresh all nodes on a hex (or scene) to their maxCharges. GM tool. */
  async function regrowHex(hexDoc) {
    if (!hexDoc) return { count: 0 };
    const arr = foundry.utils.getProperty(hexDoc, NODES_PATH);
    if (!Array.isArray(arr) || !arr.length) return { count: 0 };
    const next = arr.map(n => ({ ...n, charges: Number(n.maxCharges ?? n.charges ?? 0) }));
    await hexDoc.update({ [NODES_PATH]: next });
    return { count: arr.length };
  }

  /** Every hex on every scene back to its ceiling — the turn driver calls this at the end of an applied turn (ruling 2026-09-20). */
  async function regrowAllHexNodes({ scenes = game.scenes?.contents || [] } = {}) {
    let count = 0, hexes = 0;
    for (const sc of scenes) {
      const updates = [];
      for (const d of (sc.drawings?.contents || [])) {
        const tf = d.flags?.[MOD] || {};
        if (!(tf.isHex === true || tf.kind === "territory-hex" || tf.hexId)) continue;
        const arr = tf.resourceNodes;
        if (!Array.isArray(arr) || !arr.length) continue;
        const next = arr.map(n => ({ ...n, charges: Number(n.maxCharges ?? n.charges ?? 0) }));
        if (next.every((n, i) => Number(n.charges) === Number(arr[i]?.charges ?? 0))) continue;
        updates.push({ _id: d.id, [NODES_PATH]: next }); count += arr.length; hexes++;
      }
      if (updates.length) { try { await sc.updateEmbeddedDocuments("Drawing", updates); } catch (e) { console.warn(TAG, "regrow failed on", sc.name, e); } }
    }
    return { count, hexes };
  }

  // ── GM authoring: add / delete individual nodes (multi-resource canon) ─────
  // The seed macro is great for bulk-populating a scene; these helpers give
  // the GM a sheet-driven path to add or remove nodes one at a time without
  // resorting to console flag edits.

  const TIER_DC    = { I: 10, II: 13, III: 16, IV: 19 };
  const TIER_YIELD = { I: "1d4", II: "1d4+1", III: "1d6+1", IV: "1d6+2" };
  const TIER_CHARGES_DEFAULT = { I: 5, II: 4, III: 3, IV: 2 };
  const SKILLS = ["body", "mind", "soul", "violence", "intrigue", "presence"];

  function _newNodeId() {
    try { return "rn_" + (foundry.utils.randomID?.(16) || globalThis.randomID?.(16) || Math.random().toString(36).slice(2, 18)); }
    catch { return "rn_" + Math.random().toString(36).slice(2, 18); }
  }

  /**
   * Append a node to a hex's resourceNodes array.
   * `nodeData` can be a partial — missing fields are defaulted from tier.
   */
  async function addHexNode(hexDoc, nodeData = {}) {
    if (!hexDoc) return { ok: false, error: "no hex" };
    const arr = Array.isArray(foundry.utils.getProperty(hexDoc, NODES_PATH))
      ? foundry.utils.getProperty(hexDoc, NODES_PATH).slice()
      : [];

    const tier = ["I","II","III","IV"].includes(nodeData.tier) ? nodeData.tier : "I";
    const charges = Number.isFinite(Number(nodeData.charges))
      ? Math.max(1, Math.floor(Number(nodeData.charges)))
      : (TIER_CHARGES_DEFAULT[tier] ?? 4);

    const node = {
      id:           nodeData.id || _newNodeId(),
      materialKey:  String(nodeData.materialKey || "").trim(),
      materialName: String(nodeData.materialName || nodeData.materialKey || "Material"),
      materialUuid: nodeData.materialUuid || null,
      tier,
      dc:           Number(nodeData.dc ?? TIER_DC[tier] ?? 12),
      skill:        String(nodeData.skill || "body"),
      yieldFormula: String(nodeData.yieldFormula || TIER_YIELD[tier] || "1d4"),
      charges,
      maxCharges:   Number.isFinite(Number(nodeData.maxCharges)) ? Math.max(charges, Math.floor(Number(nodeData.maxCharges))) : charges,
      rich:         !!nodeData.rich,
      discovered:   nodeData.discovered === undefined ? false : !!nodeData.discovered,
      ...(Array.isArray(nodeData.drops) ? { drops: nodeData.drops } : {})
    };

    if (!node.materialKey) return { ok: false, error: "materialKey required" };

    arr.push(node);
    await hexDoc.update({ [NODES_PATH]: arr });
    return { ok: true, node };
  }

  /** Remove a node by id. */
  async function deleteHexNode(hexDoc, nodeId) {
    if (!hexDoc || !nodeId) return { ok: false, error: "missing args" };
    const arr = foundry.utils.getProperty(hexDoc, NODES_PATH);
    if (!Array.isArray(arr) || !arr.length) return { ok: false, error: "no nodes" };
    const next = arr.filter(n => n?.id !== nodeId);
    if (next.length === arr.length) return { ok: false, error: "node not found" };
    await hexDoc.update({ [NODES_PATH]: next });
    return { ok: true, removed: arr.length - next.length };
  }

  /** GM material picker dialog. Resolves to the created node, or null on cancel. */
  async function openAddNodeDialog(hexDoc) {
    if (!game.user?.isGM) {
      ui.notifications?.warn("GM only.");
      return null;
    }
    if (!hexDoc) return null;

    // Pull material list from master-content pack.
    const PACK_ID = "bbttcc-master-content.items";
    const pack = game.packs.get(PACK_ID);
    let materials = [];
    if (pack) {
      try {
        const idx = await pack.getIndex({ fields: ["name", "img", "flags.fourththing.rfi.item.materialKey", "flags.fourththing.rfi.item.tier"] });
        for (const e of idx) {
          const k = foundry.utils.getProperty(e, "flags.fourththing.rfi.item.materialKey");
          if (!k) continue;
          materials.push({
            uuid: `Compendium.${PACK_ID}.${e._id}`,
            key:  String(k),
            name: e.name,
            img:  e.img || "icons/svg/mystery-man.svg",
            tier: foundry.utils.getProperty(e, "flags.fourththing.rfi.item.tier") || "I"
          });
        }
        materials.sort((a, b) => a.name.localeCompare(b.name));
      } catch (e) { console.warn(TAG, "material pack read failed", e); }
    }

    const matOpts = materials.length
      ? materials.map(m => `<option value="${m.uuid}" data-key="${m.key}" data-name="${m.name}" data-tier="${m.tier}">${m.name} — ${m.key} (T${m.tier})</option>`).join("")
      : `<option value="" disabled selected>(no materials in master-content pack — type a key manually)</option>`;
    const skillOpts = SKILLS.map(s => `<option value="${s}">${s}</option>`).join("");

    const content = `
      <form>
        <div style="display:flex; flex-direction:column; gap:.5rem; padding:.4rem;">
          <label>Material (compendium)
            <select name="materialUuid" style="width:100%;">${matOpts}</select>
          </label>
          <label>… or material key (override / offline)
            <input type="text" name="materialKeyManual" placeholder="e.g. heart-iron" style="width:100%;">
          </label>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:.5rem;">
            <label>Tier
              <select name="tier" style="width:100%;">
                <option value="I">I</option><option value="II">II</option><option value="III">III</option><option value="IV">IV</option>
              </select>
            </label>
            <label>Skill
              <select name="skill" style="width:100%;">${skillOpts}</select>
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:.5rem;">
            <label>DC <input type="number" name="dc" min="5" max="30" step="1" value="12" style="width:100%;"></label>
            <label>Charges <input type="number" name="charges" min="1" step="1" value="5" style="width:100%;"></label>
            <label>Yield <input type="text" name="yieldFormula" value="1d4" style="width:100%;"></label>
          </div>
          <label class="checkbox" style="display:flex; align-items:center; gap:.35rem;">
            <input type="checkbox" name="rich"> <span>Rich node ★ (extra charges, narrative emphasis)</span>
          </label>
          <p style="font-size:.72rem; opacity:.7; margin:0;">DC / Charges / Yield default to the tier ladder (T-I 10/5/1d4 · T-II 13/4/1d4+1 · T-III 16/3/1d6+1 · T-IV 19/2/1d6+2).</p>
        </div>
      </form>
    `;

    return new Promise(resolve => {
      const dlg = new Dialog({
        title: "Add Resource Node",
        content,
        buttons: {
          add: {
            label: "Add Node",
            callback: async (html) => {
              const root = html[0] ?? html;
              const sel = root.querySelector('[name="materialUuid"]');
              const opt = sel?.options?.[sel.selectedIndex];
              const manual = String(root.querySelector('[name="materialKeyManual"]')?.value || "").trim();
              const materialKey  = manual || (opt?.dataset?.key) || "";
              const materialUuid = manual ? null : (sel?.value || null);
              const materialName = manual ? manual : (opt?.dataset?.name) || materialKey;

              if (!materialKey) {
                ui.notifications?.warn("Pick a material or type a material key.");
                return resolve(null);
              }

              const tier = String(root.querySelector('[name="tier"]')?.value || "I");
              const skill = String(root.querySelector('[name="skill"]')?.value || "body");
              const dc = Number(root.querySelector('[name="dc"]')?.value || 12);
              const charges = Number(root.querySelector('[name="charges"]')?.value || 5);
              const yieldFormula = String(root.querySelector('[name="yieldFormula"]')?.value || "1d4");
              const rich = !!root.querySelector('[name="rich"]')?.checked;

              const res = await addHexNode(hexDoc, {
                materialKey, materialUuid, materialName, tier, skill, dc, charges, yieldFormula, rich
              });
              if (res?.ok) {
                ui.notifications?.info(`Added ${materialName} (T${tier}) to hex.`);
                resolve(res.node);
              } else {
                ui.notifications?.error(res?.error || "Add failed");
                resolve(null);
              }
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "add",
        render: (html) => {
          // Auto-fill DC/yield/charges when the user picks a material (uses its tier).
          try {
            const root = html[0] ?? html;
            const sel = root.querySelector('[name="materialUuid"]');
            const tierSel = root.querySelector('[name="tier"]');
            const dcEl = root.querySelector('[name="dc"]');
            const yEl = root.querySelector('[name="yieldFormula"]');
            const cEl = root.querySelector('[name="charges"]');
            const apply = () => {
              const t = tierSel.value;
              if (dcEl) dcEl.value = TIER_DC[t] ?? 12;
              if (yEl)  yEl.value  = TIER_YIELD[t] ?? "1d4";
              if (cEl)  cEl.value  = TIER_CHARGES_DEFAULT[t] ?? 4;
            };
            sel?.addEventListener("change", () => {
              const opt = sel.options[sel.selectedIndex];
              if (opt?.dataset?.tier) tierSel.value = opt.dataset.tier;
              apply();
            });
            tierSel?.addEventListener("change", apply);
          } catch (_e) {}
        }
      }, { width: 480 });
      dlg.render(true);
    });
  }

  Hooks.once("ready", () => {
    _registerChargesRelay();
    try {
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};
      game.bbttcc.api.territory = game.bbttcc.api.territory || {};
      game.bbttcc.api.territory.harvestHexNode = harvestHexNode;
      game.bbttcc.api.territory.regrowHex      = regrowHex;
      game.bbttcc.api.territory.regrowAllHexNodes = regrowAllHexNodes;
      game.bbttcc.api.territory.addHexNode     = addHexNode;
      game.bbttcc.api.territory.deleteHexNode  = deleteHexNode;
      game.bbttcc.api.territory.openAddNodeDialog = openAddNodeDialog;
      console.log(TAG, "API ready: harvestHexNode / regrowHex / regrowAllHexNodes / addHexNode / deleteHexNode / openAddNodeDialog");
    } catch (e) {
      console.warn(TAG, "ready hook failed", e);
    }
  });
})();
