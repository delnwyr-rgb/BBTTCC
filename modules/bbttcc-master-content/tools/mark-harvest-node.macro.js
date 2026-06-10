// Bad Eden — Mark Selected Tile / Token as a Harvest Node
// ─────────────────────────────────────────────────────────────────────────────
// Run as a GM script macro while a Tile or Token is selected on the canvas.
// Opens a dialog to set: materialKey, DC, skill, yield, charges, regrowth,
// and (optional) materialUuid pointing to the compendium material item the
// engine clones for yield delivery.
//
// Existing harvest flags are pre-populated in the dialog so the macro
// double-duties as an editor.
// ─────────────────────────────────────────────────────────────────────────────

const HARVEST_PATH = "flags.fourththing.harvest";

(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");

  // Resolve target: prefer a controlled Token, else a controlled Tile.
  let target = null;
  let docKind = null;
  if (canvas.tokens?.controlled?.length) {
    target = canvas.tokens.controlled[0].document;
    docKind = "Token";
  } else if (canvas.tiles?.controlled?.length) {
    target = canvas.tiles.controlled[0].document;
    docKind = "Tile";
  } else {
    return ui.notifications?.warn("Select a Tile or Token first.");
  }

  const cur = foundry.utils.getProperty(target, HARVEST_PATH) ?? {};

  const skillOpts = ["violence", "intrigue", "presence", "body", "mind", "soul"]
    .map(s => `<option value="${s}"${cur.skill === s ? " selected" : ""}>${s}</option>`).join("");

  const tierOpts = ["I", "II", "III", "IV"]
    .map(t => `<option value="${t}"${cur.tier === t ? " selected" : ""}>${t}</option>`).join("");

  const html = `
    <form>
      <div style="margin-bottom:0.5rem;color:#aaa;font-size:0.85rem">
        Marking ${docKind}: <b>${target.name ?? target.id}</b>
      </div>
      <div class="form-group">
        <label>Material Key</label>
        <input type="text" name="materialKey" value="${cur.materialKey ?? ""}" placeholder="heart-iron">
      </div>
      <div class="form-group">
        <label>Material Display Name (optional)</label>
        <input type="text" name="materialName" value="${cur.materialName ?? ""}" placeholder="Heart-Iron">
      </div>
      <div class="form-group">
        <label>Material Item UUID (optional, source for yields)</label>
        <input type="text" name="materialUuid" value="${cur.materialUuid ?? ""}" placeholder="Compendium.bbttcc-master-content.items.Item.xxx">
      </div>
      <div class="form-group">
        <label>Tier</label>
        <select name="tier">${tierOpts}</select>
      </div>
      <div class="form-group">
        <label>DC</label>
        <input type="number" name="dc" value="${cur.dc ?? 12}" min="0">
      </div>
      <div class="form-group">
        <label>Skill (attribute)</label>
        <select name="skill">${skillOpts}</select>
      </div>
      <div class="form-group">
        <label>Yield Formula</label>
        <input type="text" name="yieldFormula" value="${cur.yieldFormula ?? "1"}" placeholder="1 or 1d4">
      </div>
      <div class="form-group">
        <label>Charges</label>
        <input type="number" name="charges" value="${cur.charges ?? 5}" min="0">
      </div>
      <div class="form-group">
        <label>Regrowth (Soma Breaks)</label>
        <input type="number" name="regrowthSomaBreaks" value="${cur.regrowthSomaBreaks ?? 1}" min="0">
      </div>
    </form>
  `;

  new Dialog({
    title: `Mark Harvest Node — ${docKind}`,
    content: html,
    buttons: {
      save: {
        label: cur.materialKey ? "Update" : "Mark",
        callback: async ($html) => {
          const root = $html?.[0] ?? $html;
          const get = (n) => root.querySelector(`[name="${n}"]`)?.value ?? "";
          const flag = {
            materialKey:  get("materialKey").trim(),
            materialName: get("materialName").trim() || null,
            materialUuid: get("materialUuid").trim() || null,
            tier:         get("tier"),
            dc:           Number(get("dc")) || 12,
            skill:        get("skill"),
            yieldFormula: get("yieldFormula").trim() || "1",
            charges:      Number(get("charges")) || 0,
            regrowthSomaBreaks: Number(get("regrowthSomaBreaks")) || 0
          };
          if (!flag.materialKey) return ui.notifications?.error("materialKey is required.");
          // Stash the original maximum so regrow() can restore.
          flag._maxCharges = flag.charges;
          await target.update({ [HARVEST_PATH]: flag });
          ui.notifications?.info(`Harvest node set: ${flag.materialName || flag.materialKey} (${flag.charges} charges).`);
        }
      },
      clear: {
        label: "Clear",
        callback: async () => {
          await target.update({ [`flags.fourththing.-=harvest`]: null });
          ui.notifications?.info("Harvest flag removed.");
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "save"
  }).render(true);
})();
