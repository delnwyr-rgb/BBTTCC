// Bad Eden Structures — Build Structure (Phase D)
// ─────────────────────────────────────────────────────────────────────────────
// Spawn a new Facility actor (type:rig + facilityMode + BOM stamped) by
// drawing materials from a faction stockpile. Drops a token at the center of
// the current view on the active scene (or holds in directory if no canvas).
//
// Recipes are loaded from data/structure-recipes.json on module ready and
// exposed via game.bbttcc.api.structures.recipes.list().
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");

  const api = game.bbttcc?.api?.structures;
  if (!api?.recipes?.list) return ui.notifications?.error?.("bbttcc-structures recipes API not loaded.");

  const recipes = api.recipes.list();
  if (!recipes.length) return ui.notifications?.warn?.("No structure recipes available.");

  const factions = (game.actors?.contents ?? []).filter(a =>
    a.type === "character" && a.getFlag("bbttcc-factions", "isFaction"));
  if (!factions.length) return ui.notifications?.warn?.("No faction actors found.");

  const recipeOptions = recipes.map(r =>
    `<option value="${r.id}">${foundry.utils.escapeHTML(r.name)} — T${r.tierGate ?? 1}</option>`
  ).join("");
  const factionOptions = factions.map(f =>
    `<option value="${f.id}">${foundry.utils.escapeHTML(f.name)}</option>`
  ).join("");

  // Render a cost-preview that updates when the recipe selection changes.
  function _previewHtml(recipe, factionId) {
    if (!recipe) return "";
    const faction = game.actors.get(factionId);
    const aff = api.recipes.canAfford(faction, recipe.materialOf);
    const rows = (recipe.materialOf ?? []).map(c => {
      const have = game.bbttcc?.api?.factions?.stockpile?.qty?.(faction, c.key) ?? 0;
      const insufficient = have < c.qty;
      return `<tr style="font-size:0.72rem">
        <td style="padding:1px 6px">${foundry.utils.escapeHTML(c.key)}</td>
        <td style="padding:1px 6px; text-align:right; font-family:monospace">${c.qty}</td>
        <td style="padding:1px 6px; text-align:right; font-family:monospace; color:${insufficient ? '#e08a3a' : '#c9bc92'}">${have}</td>
      </tr>`;
    }).join("");
    const statusColor = aff.ok ? "#7cc77c" : "#e08a3a";
    const statusText = aff.ok ? "✓ all materials in stockpile" : `✗ short on ${aff.missing.length} material(s)`;
    return `
      <div style="margin-top:6px; border-top:1px dotted #3a3528; padding-top:5px;">
        <p style="margin:0 0 4px 0; font-size:0.74rem; opacity:0.8">${foundry.utils.escapeHTML(recipe.description ?? "")}</p>
        <table style="width:100%; border-collapse:collapse; margin-top:4px;">
          <thead><tr style="opacity:0.6; font-size:0.62rem">
            <th style="text-align:left; padding:2px 6px">Material</th>
            <th style="text-align:right; padding:2px 6px">Need</th>
            <th style="text-align:right; padding:2px 6px">In Stockpile</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:4px; font-size:0.7rem; color:${statusColor}">${statusText}</div>
        ${recipe.specialNote ? `<div style="margin-top:3px; font-size:0.68rem; opacity:0.6; font-style:italic">${foundry.utils.escapeHTML(recipe.specialNote)}</div>` : ""}
      </div>
    `;
  }

  const dialog = new Dialog({
    title: "Build Structure",
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0; min-width:480px;">
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Recipe</span>
          <select name="recipeId">${recipeOptions}</select>
        </label>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Pay from faction stockpile</span>
          <select name="factionId">${factionOptions}</select>
        </label>
        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Token name override (optional)</span>
          <input type="text" name="actorName" placeholder="(default: recipe name)"/>
        </label>
        <label style="display:flex; align-items:center; gap:0.4rem;">
          <input type="checkbox" name="dropToken" checked/>
          <span style="font-size:0.78rem">Place token at view center on current scene</span>
        </label>
        <label style="display:flex; align-items:center; gap:0.4rem;">
          <input type="checkbox" name="skipCostCheck"/>
          <span style="font-size:0.78rem; opacity:0.7">GM: bypass cost (paper-test)</span>
        </label>
        <div id="bbttcc-build-preview"></div>
      </div>
    `,
    buttons: {
      build: {
        label: "Build",
        callback: async (html) => {
          const recipeId = html.find("[name='recipeId']").val();
          const factionId = html.find("[name='factionId']").val();
          const actorName = String(html.find("[name='actorName']").val() ?? "").trim() || undefined;
          const dropToken = html.find("[name='dropToken']").is(":checked");
          const skipCostCheck = html.find("[name='skipCostCheck']").is(":checked");
          const faction = game.actors.get(factionId);
          if (!faction) return ui.notifications?.warn?.("Pick a faction.");

          // Drop position — center of viewport on active scene if requested
          let dropPosition = null;
          if (dropToken && canvas?.scene) {
            const stage = canvas.stage;
            const center = stage?.toLocal?.(new PIXI.Point(window.innerWidth / 2, window.innerHeight / 2)) ?? null;
            if (center) dropPosition = { x: center.x, y: center.y };
          }

          const res = await api.recipes.build(recipeId, faction, {
            actorName,
            dropPosition,
            skipCostCheck
          });
          if (!res.ok) {
            const missingList = (res.missing ?? []).map(m => `${m.name} (need ${m.need}, have ${m.have})`).join(", ");
            ui.notifications?.error?.(`${res.error}${missingList ? " — " + missingList : ""}`);
            return;
          }
          ui.notifications?.info?.(`Built ${res.actor.name}${res.token ? " (token placed)" : ""}.`);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "build",
    render: (html) => {
      // Live preview update when recipe / faction changes
      const recipeSel = html.find("[name='recipeId']");
      const factionSel = html.find("[name='factionId']");
      const preview = html.find("#bbttcc-build-preview");
      const update = () => {
        const r = api.recipes.byId(recipeSel.val());
        preview.html(_previewHtml(r, factionSel.val()));
      };
      recipeSel.on("change", update);
      factionSel.on("change", update);
      update();
    }
  });
  dialog.render(true);
})();
