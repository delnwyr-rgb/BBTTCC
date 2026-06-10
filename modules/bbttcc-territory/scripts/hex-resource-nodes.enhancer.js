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

  async function writeNodeUpdate(hexDoc, idx, arr, patch) {
    const next = arr.map((n, i) => (i === idx ? { ...n, ...patch } : n));
    await hexDoc.update({ [NODES_PATH]: next });
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

      // Resolve material item — try materialUuid first, fall back to a name lookup
      // in the master-content pack (uuid is a placeholder for offline-seeded scenes),
      // fall back to a minimal stub.
      let materialItemData = null;

      if (node.materialUuid) {
        try {
          const src = await fromUuid(node.materialUuid);
          if (src) {
            materialItemData = src.toObject();
            delete materialItemData._id;
            foundry.utils.setProperty(materialItemData, "flags.fourththing.rfi.item.charges", yieldUnits);
          }
        } catch (e) { /* placeholder uuid — fall through to name lookup */ }
      }

      if (!materialItemData && node.materialKey) {
        try {
          const pack = game.packs.get("bbttcc-master-content.items");
          if (pack) {
            const idxFields = await pack.getIndex({ fields: ["flags.fourththing.rfi.item.materialKey"] });
            const hit = idxFields.find(e => foundry.utils.getProperty(e, "flags.fourththing.rfi.item.materialKey") === node.materialKey);
            if (hit) {
              const src = await pack.getDocument(hit._id);
              if (src) {
                materialItemData = src.toObject();
                delete materialItemData._id;
                foundry.utils.setProperty(materialItemData, "flags.fourththing.rfi.item.charges", yieldUnits);
              }
            }
          }
        } catch (e) { /* fall through to stub */ }
      }

      if (!materialItemData) {
        materialItemData = {
          name: node.materialName || node.materialKey,
          type: "gear",
          img: "icons/svg/mystery-man.svg",
          system: { slot: "material", tags: ["material", node.materialKey] },
          flags: { fourththing: { rfi: { item: {
            ...RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null }),
            tier: node.tier || "I",
            frame: "material",
            origin: "found",
            bound: "free",
            materialKey: node.materialKey,
            charges: yieldUnits,
            upkeep: { mode: "passive", per: "none" }
          } } } }
        };
      }
      await actor.createEmbeddedDocuments("Item", [materialItemData]);
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
                        ? `✓ <b>Success</b> — gathered ${yieldUnits} unit${yieldUnits > 1 ? "s" : ""} of ${node.materialName || node.materialKey}.<br>Node has ${nextCharges} attempt${nextCharges === 1 ? "" : "s"} remaining.`
                        : `✗ <b>Failed</b> — no yield. The node's charges are unchanged.`}
                    </p>
                  </div></div>`
    });

    return { ok: true, success, total, dc, yield: yieldUnits, remaining: nextCharges };
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
      discovered:   nodeData.discovered === undefined ? false : !!nodeData.discovered
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
    try {
      game.bbttcc = game.bbttcc || {};
      game.bbttcc.api = game.bbttcc.api || {};
      game.bbttcc.api.territory = game.bbttcc.api.territory || {};
      game.bbttcc.api.territory.harvestHexNode = harvestHexNode;
      game.bbttcc.api.territory.regrowHex      = regrowHex;
      game.bbttcc.api.territory.addHexNode     = addHexNode;
      game.bbttcc.api.territory.deleteHexNode  = deleteHexNode;
      game.bbttcc.api.territory.openAddNodeDialog = openAddNodeDialog;
      console.log(TAG, "API ready: harvestHexNode / regrowHex / addHexNode / deleteHexNode / openAddNodeDialog");
    } catch (e) {
      console.warn(TAG, "ready hook failed", e);
    }
  });
})();
