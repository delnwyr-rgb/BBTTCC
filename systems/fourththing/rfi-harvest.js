// Roll for Initiation — RFI Gathering / Harvest Engine
// ─────────────────────────────────────────────────────────────────────────────
// Closes the loop with crafting. A "harvest node" is any Tile or Token
// document carrying flags.fourththing.harvest:
//
//   { materialKey: "heart-iron",
//     dc: 12, skill: "soul",
//     yieldFormula: "1",       // dice or flat units yielded on success
//     charges: 5,              // attempts remaining (depleted node has 0)
//     regrowthSomaBreaks: 1,   // refresh hook (manual until SomaBreak engine ships)
//     materialName: "Heart-Iron",   // optional UI label override
//     materialUuid: "Compendium..." // recipe target to clone yields from
//   }
//
// API on game.fourththing.harvest:
//   scanScene(scene)            → [{ doc, harvest, name }]
//   attempt(actor, sourceDoc)   → roll, decrement charges, deliver yield
//   markNode(targetDoc, opts)   → write flags
//
// Yields are real Item documents created on the actor (cloned from the
// source material's compendium item if `materialUuid` is set; otherwise a
// minimal stub with materialKey + charges).
// ─────────────────────────────────────────────────────────────────────────────

import RfiItems from "./rfi-items.js";

const HARVEST_PATH = "flags.fourththing.harvest";

export const RfiHarvest = {
  /**
   * Walks the scene's Tiles and Tokens, returning every doc with a populated
   * harvest flag. Empty/depleted nodes (charges <= 0) are still included so
   * the GM can see them; the player UI filters them out.
   */
  scanScene(scene = canvas?.scene ?? game.scenes?.current) {
    if (!scene) return [];
    const out = [];
    // hex DRAWINGS can be nodes too (2026-09-20): the region maps' hexes carry the flag, so Gather works from the world map
    for (const dd of (scene.drawings ?? [])) {
      const h = foundry.utils.getProperty(dd, HARVEST_PATH);
      if (h?.materialKey) out.push({ doc: dd, harvest: h, name: h.materialName || h.materialKey });
    }
    for (const td of (scene.tiles ?? [])) {
      const h = foundry.utils.getProperty(td, HARVEST_PATH);
      if (h?.materialKey) out.push({ doc: td, harvest: h, name: h.materialName || h.materialKey });
    }
    for (const tk of (scene.tokens ?? [])) {
      const h = foundry.utils.getProperty(tk, HARVEST_PATH);
      if (h?.materialKey) out.push({ doc: tk, harvest: h, name: h.materialName || tk.name || h.materialKey });
    }
    return out;
  },

  /**
   * Mark or update a Tile/Token as a harvest node.
   */
  async markNode(targetDoc, {
    materialKey, dc = 12, skill = "soul",
    yieldFormula = "1", charges = 5, drops = null,
    regrowthSomaBreaks = 1,
    materialName = null, materialUuid = null
  } = {}) {
    if (!targetDoc) throw new Error("markNode: no target document.");
    if (!materialKey) throw new Error("markNode: materialKey is required.");
    return targetDoc.update({
      [HARVEST_PATH]: {
        materialKey, dc, skill, yieldFormula, charges, ...(Array.isArray(drops) ? { drops } : {}),
        regrowthSomaBreaks, materialName, materialUuid
      }
    });
  },

  /**
   * Refresh node charges to their original maximum. `originalMax` defaults to
   * 5 if the node doesn't track its own ceiling. Used by the (future) Soma
   * Break refresh hook; safe to call manually as a GM tool.
   */
  /** Where a gather lands (owner ruling 2026-09-21): the steward's faction stockpile when they have one, else stacked in the pockets. */
  async _deliver(actor, data, units) {
    const fid = String(actor?.system?.faction?.id || "").replace(/^Actor\./, "");
    const F = fid ? game.actors?.get(fid) : null; const stock = game.bbttcc?.api?.factions?.stockpile;
    const key = foundry.utils.getProperty(data, "flags.fourththing.rfi.item.materialKey") || data.name;
    if (F && stock?.adjust) { await stock.adjust(F, key, +units, { name: data.name, img: data.img, lastUuid: data.flags?.core?.sourceId || null }); return { to: "stockpile", faction: F }; }
    const orCreate = game.fourththing?.stack?.orCreate;
    if (orCreate) await orCreate(actor, data); else await actor.createEmbeddedDocuments("Item", [data]);
    return { to: "pockets" };
  },

  async regrow(scene = canvas?.scene, { multiplier = 1 } = {}) {
    if (!scene) return { count: 0 };
    let count = 0;
    for (const { doc, harvest } of RfiHarvest.scanScene(scene)) {
      const original = Number(harvest._maxCharges ?? harvest.charges ?? 5) || 5;
      const next = Math.min(original, Math.ceil(original * multiplier));
      await doc.update({ [`${HARVEST_PATH}.charges`]: next });
      count++;
    }
    return { count };
  },

  /**
   * GM-side: open a dialog to mark or edit the harvest flag on any document
   * (Tile, Token, JournalEntry, hex doc, etc.). Pre-populates from existing
   * flags so it doubles as an editor. Returns when the user closes/saves.
   */
  async openMarkDialog(targetDoc, { titleSuffix = "" } = {}) {
    if (!targetDoc) return ui.notifications?.warn("No target to mark.");
    const cur = foundry.utils.getProperty(targetDoc, HARVEST_PATH) ?? {};

    const skillOpts = ["violence", "intrigue", "presence", "body", "mind", "soul"]
      .map(s => `<option value="${s}"${cur.skill === s ? " selected" : ""}>${s}</option>`).join("");
    const tierOpts = ["I", "II", "III", "IV"]
      .map(t => `<option value="${t}"${cur.tier === t ? " selected" : ""}>${t}</option>`).join("");

    const html = `
      <form>
        <div style="margin-bottom:0.5rem;color:#aaa;font-size:0.85rem">
          ${targetDoc.documentName}: <b>${targetDoc.name ?? targetDoc.id}</b>${titleSuffix ? ` — ${titleSuffix}` : ""}
        </div>
        <div class="form-group"><label>Material Key</label>
          <input type="text" name="materialKey" value="${cur.materialKey ?? ""}" placeholder="heart-iron"></div>
        <div class="form-group"><label>Material Display Name (optional)</label>
          <input type="text" name="materialName" value="${cur.materialName ?? ""}" placeholder="Heart-Iron"></div>
        <div class="form-group"><label>Material Item UUID (optional, source for yields)</label>
          <input type="text" name="materialUuid" value="${cur.materialUuid ?? ""}" placeholder="Compendium.bbttcc-master-content.items.Item.xxx"></div>
        <div class="form-group"><label>Tier</label><select name="tier">${tierOpts}</select></div>
        <div class="form-group"><label>DC</label>
          <input type="number" name="dc" value="${cur.dc ?? 12}" min="0"></div>
        <div class="form-group"><label>Skill (attribute)</label><select name="skill">${skillOpts}</select></div>
        <div class="form-group"><label>Yield Formula</label>
          <input type="text" name="yieldFormula" value="${cur.yieldFormula ?? "1"}" placeholder="1 or 1d4"></div>
        <div class="form-group"><label>Charges</label>
          <input type="number" name="charges" value="${cur.charges ?? 5}" min="0"></div>
        <div class="form-group"><label>Regrowth (Soma Breaks)</label>
          <input type="number" name="regrowthSomaBreaks" value="${cur.regrowthSomaBreaks ?? 1}" min="0"></div>
      </form>`;

    return new Promise((resolve) => {
      new Dialog({
        title: `Resource Node — ${targetDoc.name ?? targetDoc.documentName}`,
        content: html,
        buttons: {
          save: {
            label: cur.materialKey ? "Update" : "Mark",
            callback: async ($html) => {
              const root = $html?.[0] ?? $html;
              const get = (n) => root.querySelector(`[name="${n}"]`)?.value ?? "";
              const flag = {
                materialKey:        get("materialKey").trim(),
                materialName:       get("materialName").trim() || null,
                materialUuid:       get("materialUuid").trim() || null,
                tier:               get("tier"),
                dc:                 Number(get("dc")) || 12,
                skill:              get("skill"),
                yieldFormula:       get("yieldFormula").trim() || "1",
                charges:            Number(get("charges")) || 0,
                regrowthSomaBreaks: Number(get("regrowthSomaBreaks")) || 0
              };
              if (!flag.materialKey) { ui.notifications?.error("materialKey is required."); resolve(null); return; }
              flag._maxCharges = flag.charges;
              await targetDoc.update({ [HARVEST_PATH]: flag });
              ui.notifications?.info(`Resource node set: ${flag.materialName || flag.materialKey} (${flag.charges} charges).`);
              resolve(flag);
            }
          },
          clear: {
            label: "Clear",
            callback: async () => {
              await targetDoc.update({ [`flags.fourththing.-=harvest`]: null });
              ui.notifications?.info("Harvest flag removed.");
              resolve(null);
            }
          },
          cancel: { label: "Cancel", callback: () => resolve(null) }
        },
        default: "save"
      }).render(true);
    });
  },

  /**
   * Roll the harvest check. On success deliver yield to the actor, decrement
   * node charges, post chat receipt. Failure costs no charges (unlike crafting
   * which wastes half) — gathering is a low-risk activity.
   */
  async attempt(actor, sourceDoc) {
    if (!actor)       throw new Error("attempt: no actor.");
    if (!sourceDoc)   throw new Error("attempt: no source document.");
    const h = foundry.utils.getProperty(sourceDoc, HARVEST_PATH);
    if (!h?.materialKey) {
      ui.notifications?.warn("That node has no harvest data.");
      return { ok: false, reason: "no-harvest-flag" };
    }
    const charges = Number(h.charges ?? 0);
    if (charges <= 0) {
      ui.notifications?.warn(`${h.materialName || h.materialKey} is depleted.`);
      return { ok: false, reason: "depleted" };
    }

    const skill = h.skill || "soul";
    const dc    = Number(h.dc ?? 12);
    const sys   = actor.system?.system ?? actor.system;
    const baseAttr = Number(sys?.attributes?.[skill]?.value ?? 0);

    // Passive AE bonuses (mode 2 = ADD) on the attribute being used.
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
    if (success) {
      const yRoll = new Roll(String(h.yieldFormula ?? "1"));
      await yRoll.evaluate();
      yieldUnits = Math.max(1, Number(yRoll.total) || 1);

      // Decrement node charges.
      await sourceDoc.update({ [`${HARVEST_PATH}.charges`]: charges - 1 });

      // Deliver yield.
      let materialItemData;
      if (h.materialUuid) {
        const src = await fromUuid(h.materialUuid);
        if (src) {
          materialItemData = src.toObject();
          delete materialItemData._id;
          foundry.utils.setProperty(materialItemData, "flags.fourththing.rfi.item.charges", yieldUnits);
        }
      }
      if (!materialItemData) {
        // Minimal stub if no compendium item is configured.
        materialItemData = {
          name: h.materialName || h.materialKey,
          type: "gear",
          img:  "icons/svg/mystery-man.svg",
          system: { slot: "material", tags: ["material", h.materialKey] },
          flags: { fourththing: { rfi: { item: {
            ...RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null }),
            tier:        "I",
            frame:       "material",
            origin:      "found",
            bound:       "free",
            materialKey: h.materialKey,
            charges:     yieldUnits,
            upkeep:      { mode: "passive", per: "none" }
          } } } }
        };
      }
      var delivered = await RfiHarvest._deliver(actor, materialItemData, yieldUnits);
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="fourththing-roll ft-magic-roll">
                  <div class="ft-misfire-box standalone" style="border-color:${success ? "#5fb35f" : "#d4a35f"}">
                    <span class="ft-misfire-label">🜨 Gathering — ${h.materialName || h.materialKey}</span>
                    <p class="ft-misfire-desc">
                      ${formula} → <b>${total}</b> vs DC ${dc} (${skill})<br>
                      ${aeContribs.length ? `<span style="color:#e8c84a;font-size:0.78rem">Passives: ${aeContribs.map(c => `${c.value >= 0 ? "+" : ""}${c.value} ${c.label} (${c.src})`).join(", ")}</span><br>` : ""}
                      ${success
                        ? `✓ <b>Success</b> — gathered ${yieldUnits} unit${yieldUnits > 1 ? "s" : ""} of ${h.materialName || h.materialKey}.<br>Node has ${charges - 1} attempt${charges - 1 === 1 ? "" : "s"} remaining.${delivered?.to === "stockpile" ? ` → <b>${delivered.faction.name}</b>'s stockpile` : ""}`
                        : `✗ <b>Failed</b> — no yield. The node's charges are unchanged; the harvester walks away empty-handed.`}
                    </p>
                  </div></div>`
    });

    // DROPS (owner ruling 2026-09-20): a node may carry `drops: [{ key, chance (0..1), qty?: "1"|"1d2", name?, uuid? }]` —
    // on a successful gather each drop rolls its chance and lands beside the main yield.
    const dropped = [];
    if (success && Array.isArray(h.drops)) {
      for (const d of h.drops) {
        try {
          if (!d?.key) continue; const chance = Number(d.chance); if (!(Math.random() < (Number.isFinite(chance) ? chance : 0))) continue;
          const qr = new Roll(String(d.qty ?? "1")); await qr.evaluate(); const units = Math.max(1, Number(qr.total) || 1);
          let data = null;
          if (d.uuid) { const src = await fromUuid(d.uuid); if (src) { data = src.toObject(); delete data._id; foundry.utils.setProperty(data, "flags.fourththing.rfi.item.charges", units); } }
          if (!data) data = { name: d.name || d.key, type: "gear", img: "icons/svg/mystery-man.svg", system: { slot: "material", tags: ["material", d.key] },
            flags: { fourththing: { rfi: { item: { ...RfiItems.defaults({ type: "gear", system: {}, getFlag: () => null }), tier: d.tier || "I", frame: "material", origin: "found", bound: "free", materialKey: d.key, charges: units, upkeep: { mode: "passive", per: "none" } } } } } };
          await RfiHarvest._deliver(actor, data, units); dropped.push({ key: d.key, units, name: d.name || d.key });
        } catch (eD) { console.warn("Roll for Initiation | harvest drop failed", d, eD); }
      }
      if (dropped.length) { try { await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div class="ft-harvest-drops">✦ <b>Also found</b> — ${dropped.map(x => `${x.units}× ${x.name}`).join(", ")}</div>` }); } catch (_eM) {} }
    }
    return { ok: true, success, total, dc, yield: yieldUnits, drops: dropped, remaining: charges - (success ? 1 : 0) };
  }
};

export default RfiHarvest;
