// Bad Eden Structures — Retro-Stamp Rig BOMs (Phase E companion)
// ─────────────────────────────────────────────────────────────────────────────
// One-shot GM tool. New Rigs auto-stamp a structural BOM at create-time (Phase E
// in bbttcc-auto-link/scripts/rig-builder.js). This back-fills EXISTING campaign
// Rigs that predate that change, so every Rig gains a hardness model.
//
// Bracket-driven (matches rig-builder's CHASSIS_BRACKET_BOM). Idempotent —
// skips any Rig that already has a structure. Facilities (mobility "stationary")
// stamp facilityMode. Shows a dry-run summary + confirm before writing.
//
// Spec §8: bbttcc-structures/STRUCTURE_DAMAGE_SPEC.md
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) { ui.notifications?.warn("Retro-Stamp Rig BOMs is GM-only."); return; }
  const structApi = game.bbttcc?.api?.structures;
  if (!structApi?.stampBOM) { ui.notifications?.error("bbttcc-structures API not available (game.bbttcc.api.structures.stampBOM)."); return; }

  // Mirror of rig-builder.js CHASSIS_BRACKET_BOM (kept self-contained so the
  // macro runs standalone). Keys are valid RFI-catalog material slugs.
  const BRACKET_BOM = {
    personal: [{ materialKey: "bog-iron", qty: 4 }, { materialKey: "ash-wood", qty: 2 }, { materialKey: "hex-iron-cleat", qty: 1 }],
    light:    [{ materialKey: "bog-iron", qty: 5 }, { materialKey: "ash-wood", qty: 2 }, { materialKey: "cold-iron", qty: 1 }],
    medium:   [{ materialKey: "scribed-steel", qty: 6 }, { materialKey: "heart-iron", qty: 3 }, { materialKey: "cold-iron", qty: 2 }],
    heavy:    [{ materialKey: "scribed-steel", qty: 8 }, { materialKey: "heart-iron", qty: 4 }, { materialKey: "cold-iron", qty: 3 }, { materialKey: "mountain-stone", qty: 2 }],
    siege:    [{ materialKey: "scribed-steel", qty: 10 }, { materialKey: "heart-iron", qty: 5 }, { materialKey: "cold-iron", qty: 4 }, { materialKey: "mountain-stone", qty: 4 }, { materialKey: "yesodium", qty: 1 }]
  };
  const bomFor = (bracket) => {
    const b = String(bracket || "").toLowerCase();
    return BRACKET_BOM[b] || (b === "hybrid" ? BRACKET_BOM.medium : BRACKET_BOM.light);
  };

  // Candidate Rigs = type "rig" without an existing structure BOM.
  const rigs = (game.actors?.contents || []).filter(a => a?.type === "rig");
  const targets = rigs.filter(a => !a.flags?.["bbttcc-structures"]?.hasStructure);
  const skipped = rigs.length - targets.length;

  if (!targets.length) {
    ui.notifications?.info(`All ${rigs.length} Rig(s) already have a structural BOM — nothing to do.`);
    return;
  }

  // Dry-run summary.
  const rows = targets.map(a => {
    const sys = a.system?.system ?? a.system ?? {};
    const bracket = String(sys?.integrity?.bracket || "light").toLowerCase();
    const mobility = String(sys?.identity?.mobility || "mobile").toLowerCase();
    const bom = bomFor(bracket);
    return { a, bracket, mobility, bom };
  });
  const listHtml = rows.map(r =>
    `<li><b>${foundry.utils.escapeHTML(r.a.name)}</b> — <i>${r.bracket}</i>${r.mobility === "stationary" ? " (facility)" : ""}: ${r.bom.map(m => `${m.materialKey}×${m.qty}`).join(", ")}</li>`
  ).join("");

  const proceed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Retro-Stamp Rig BOMs" },
    content: `<div style="max-height:55vh;overflow-y:auto;">
      <p>Stamp a bracket-default structural BOM on <b>${targets.length}</b> Rig(s)${skipped ? ` (${skipped} already stamped, skipped)` : ""}. Existing integrity is untouched; this only adds the Plates/hardness layer.</p>
      <ul style="margin:.3rem 0 0 .9rem;padding:0;font-size:.85rem;line-height:1.5;">${listHtml}</ul>
    </div>`,
    rejectClose: false,
    modal: true
  });
  if (!proceed) { ui.notifications?.info("Retro-stamp cancelled — no changes made."); return; }

  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      await structApi.stampBOM(r.a, r.bom, { facilityMode: r.mobility === "stationary", resetCurrentPlates: true });
      ok++;
    } catch (e) { fail++; console.warn("[retro-stamp-rig-boms] failed for", r.a?.name, e); }
  }

  ChatMessage.create({
    whisper: game.users.filter(u => u.isGM).map(u => u.id),
    content: `<div class="bbttcc-raid"><h3 style="margin:0 0 .25rem 0;">⚒ Rig BOM Retro-Stamp</h3>
      <p style="margin:0;">Stamped <b>${ok}</b> Rig(s)${fail ? `, <span style="color:#ff8a8a">${fail} failed (see console)</span>` : ""}${skipped ? `, ${skipped} already had a BOM` : ""}.</p></div>`
  });
  ui.notifications?.info(`Retro-stamped ${ok} Rig(s)${fail ? `, ${fail} failed` : ""}.`);
})();
