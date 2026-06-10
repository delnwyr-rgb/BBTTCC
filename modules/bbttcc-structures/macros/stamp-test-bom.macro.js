// Bad Eden Structures — Stamp Test BOM (Phase A paper-test tool)
// ─────────────────────────────────────────────────────────────────────────────
// Drop into the macro hotbar. Drag the macro onto a Rig or Boss token first
// to set the speaker, OR select a token then run.
//
// Picker covers all 8 starter presets + a "Custom (entered raw)" option and
// a "Show derivation only (no stamp)" preview mode.
//
// Spec: bbttcc-structures/STRUCTURE_DAMAGE_SPEC.md
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  const api = game.bbttcc?.api?.structures;
  if (!api) return ui.notifications?.error?.("bbttcc-structures not loaded.");

  const actor = (() => {
    const t = canvas.tokens?.controlled?.[0]?.actor;
    if (t) return t;
    const sel = game.users?.current?.character;
    return sel ?? null;
  })();

  if (!actor) return ui.notifications?.warn?.("Select a Rig/Boss token first.");
  if (!["rig", "boss", "npc", "character"].includes(actor.type)) {
    const ok = await Dialog.confirm({
      title: "Unusual actor type",
      content: `<p>This is a <b>${actor.type}</b> actor, not a Rig or Boss. Stamp anyway?</p>`
    });
    if (!ok) return;
  }

  const PRESETS = {
    hexmobile:      { label: "Hexmobile (Rig)",                  facilityMode: false,
                      bom: [{ materialKey:"bog-iron", qty:4 }, { materialKey:"ash-wood", qty:2 }, { materialKey:"hex-iron-cleat", qty:1 }] },
    atr:            { label: "ATR — Assault Tactical Rig",       facilityMode: false,
                      bom: [{ materialKey:"scribed-steel", qty:6 }, { materialKey:"heart-iron", qty:3 }, { materialKey:"cold-iron", qty:2 }] },
    pilotMount:     { label: "Pilot Mount (Rig)",                facilityMode: false,
                      bom: [{ materialKey:"cold-iron", qty:3 }, { materialKey:"ash-wood", qty:2 }] },
    septWall:       { label: "Sept Wall (Facility)",             facilityMode: true,
                      bom: [{ materialKey:"mountain-stone", qty:12 }, { materialKey:"anchorstone", qty:6 }, { materialKey:"blessed-thread", qty:4 }, { materialKey:"yesodium", qty:1 }] },
    bunkerGate:     { label: "Bunker Gate (Facility)",           facilityMode: true,
                      bom: [{ materialKey:"scribed-steel", qty:10 }, { materialKey:"hex-glyph-plate", qty:4 }, { materialKey:"yesodium", qty:2 }] },
    watchtower:     { label: "Watchtower (Facility)",            facilityMode: true,
                      bom: [{ materialKey:"ash-wood", qty:8 }, { materialKey:"mountain-stone", qty:4 }, { materialKey:"hex-iron-cleat", qty:2 }, { materialKey:"focusing-lens", qty:1 }] },
    glyphWardPylon: { label: "Glyph-Ward Pylon (Facility)",      facilityMode: true,
                      bom: [{ materialKey:"hex-glyph-plate", qty:6 }, { materialKey:"sept-tuning-fork", qty:2 }, { materialKey:"tree-of-life-shard", qty:1 }] },
    septBridge:     { label: "Sept Bridge (Facility, collapse on Damaged)", facilityMode: true,
                      collapseOverride: { triggerState: "damaged" },
                      bom: [{ materialKey:"mountain-stone", qty:8 }, { materialKey:"ash-wood", qty:4 }, { materialKey:"cold-iron", qty:3 }, { materialKey:"yesodium", qty:1 }] }
  };

  const presetOptions = Object.entries(PRESETS)
    .map(([k, p]) => `<option value="${k}">${foundry.utils.escapeHTML(p.label)}</option>`)
    .join("");

  const escName = foundry.utils.escapeHTML(actor.name);

  new Dialog({
    title: "Stamp Test BOM",
    content: `
      <div style="display:flex; flex-direction:column; gap:0.6rem; padding:0.4rem 0; min-width: 380px;">
        <p style="margin:0; font-size:0.8rem">
          Target: <b>${escName}</b> <span style="opacity:0.5">(${actor.type})</span>
        </p>

        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Preset BOM</span>
          <select name="preset">${presetOptions}</select>
        </label>

        <label style="display:flex; align-items:center; gap:0.4rem;">
          <input type="checkbox" name="previewOnly"/>
          <span style="font-size:0.78rem">Preview derivation only — do not stamp</span>
        </label>

        <p style="margin:0; font-size:0.7rem; opacity:0.55; font-style:italic">
          Phase A — math + sheet panel only. No damage path yet.
        </p>
      </div>
    `,
    buttons: {
      go: {
        label: "Stamp",
        callback: async (html) => {
          const key = html.find("[name='preset']").val();
          const preview = html.find("[name='previewOnly']").is(":checked");
          const preset = PRESETS[key];
          if (!preset) return;

          // Normalize first so we get the denormalized BOM with family/tier
          const bom = await api.normalizeBOM(preset.bom);
          const derived = api.deriveBOM(bom);
          const state = api.stateFromPlates(derived.platesMax, derived.platesMax, derived.loadBearing);

          // Build a derivation breakdown chat card
          const breakdownRows = Object.entries(derived.breakdownByFamily)
            .sort(([a],[b]) => a.localeCompare(b))
            .map(([fam, v]) => {
              const f = api.FAMILIES[fam] ?? {};
              return `<tr>
                <td style="padding:2px 6px; color:${f.color ?? '#ccc'}">${f.icon ?? '•'} ${foundry.utils.escapeHTML(f.label ?? fam)}</td>
                <td style="padding:2px 6px; text-align:right; font-family:monospace">${v.qty}</td>
                <td style="padding:2px 6px; text-align:right; font-family:monospace">${v.plates}</td>
              </tr>`;
            }).join("");

          const bomRows = bom.map(r => {
            const f = api.FAMILIES[r.family] ?? {};
            return `<tr>
              <td style="padding:2px 6px">${foundry.utils.escapeHTML(r.name)}</td>
              <td style="padding:2px 6px; color:${f.color ?? '#ccc'}">${f.icon ?? '•'} ${foundry.utils.escapeHTML(f.label ?? r.family)}</td>
              <td style="padding:2px 6px; font-family:monospace">T${r.tier}</td>
              <td style="padding:2px 6px; text-align:right; font-family:monospace">${r.qty}</td>
            </tr>`;
          }).join("");

          const resistsHtml = derived.resists.length
            ? derived.resists.map(r => `<span style="background:rgba(120,100,60,0.18); border:1px solid rgba(217,185,107,0.2); padding:1px 6px; border-radius:2px; font-size:0.7rem; margin-right:3px;">${foundry.utils.escapeHTML(r)}</span>`).join("")
            : `<i style="opacity:0.5">none</i>`;

          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
              <div style="border:1px solid #4a4538; padding:0.5rem; background:#1a1611; color:#cfc4a8; font-family:sans-serif">
                <div style="font-size:0.85rem; color:#d9c47a; letter-spacing:0.1em; border-bottom:1px solid #3a3528; padding-bottom:3px; margin-bottom:6px;">
                  STRUCTURE BOM ${preview ? "PREVIEW" : "STAMPED"} — ${foundry.utils.escapeHTML(preset.label)}
                </div>
                <div style="font-size:0.78rem; margin-bottom:6px">
                  <b>Target:</b> ${escName} ·
                  <b>State:</b> ${state} ·
                  <b>Plates:</b> ${derived.platesMax} ·
                  <b>Threshold:</b> ${derived.threshold} ·
                  ${derived.loadBearing ? '<b style="color:#d9b96b">⚜ Load-bearing</b>' : ''}
                </div>

                <details open>
                  <summary style="font-size:0.7rem; opacity:0.75; cursor:pointer">BOM (${bom.length} entries)</summary>
                  <table style="width:100%; font-size:0.72rem; border-collapse:collapse; margin-top:4px;">
                    <thead><tr style="opacity:0.6; font-size:0.6rem;">
                      <th style="text-align:left; padding:2px 6px">Material</th>
                      <th style="text-align:left; padding:2px 6px">Family</th>
                      <th style="text-align:left; padding:2px 6px">Tier</th>
                      <th style="text-align:right; padding:2px 6px">Qty</th>
                    </tr></thead>
                    <tbody>${bomRows}</tbody>
                  </table>
                </details>

                <details style="margin-top:6px">
                  <summary style="font-size:0.7rem; opacity:0.75; cursor:pointer">Family breakdown</summary>
                  <table style="width:100%; font-size:0.72rem; border-collapse:collapse; margin-top:4px;">
                    <thead><tr style="opacity:0.6; font-size:0.6rem;">
                      <th style="text-align:left; padding:2px 6px">Family</th>
                      <th style="text-align:right; padding:2px 6px">Qty</th>
                      <th style="text-align:right; padding:2px 6px">Plates</th>
                    </tr></thead>
                    <tbody>${breakdownRows}</tbody>
                  </table>
                </details>

                <div style="margin-top:6px; font-size:0.72rem">
                  <b>Resists:</b> ${resistsHtml}
                </div>
                ${preview ? '<div style="margin-top:6px; font-size:0.7rem; opacity:0.55; font-style:italic">Preview only — actor flags NOT modified.</div>' : ''}
              </div>
            `
          });

          if (preview) return;

          const opts = { facilityMode: preset.facilityMode };
          if (preset.collapseOverride) {
            opts.collapseProfile = { fallFt:10, damageDice:"2d10", nonlethal:true, knockbackFt:5, ...preset.collapseOverride };
          }
          await api.stampBOM(actor, preset.bom, opts);
          ui.notifications?.info?.(`Stamped ${preset.label} on ${actor.name}.`);
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "go"
  }).render(true);
})();
