// BBTTCC Structures — Damage Selected Structure (Phase B test macro)
// ─────────────────────────────────────────────────────────────────────────────
// Pick a structure target (selected token or current speaker), prompt for
// damage + source tag + multiplier + bypass-resists, then route through
// _applyDamageToActor (which is wedged so the Structure damage path fires).
//
// Use this for paper-testing chip queue walks, threshold gates, state
// transitions, and Collapse triggers without needing a real combat. Also
// useful for chained damage runs (apply 30, then 30 again, watch state
// progress Intact → Damaged → Breached over multiple hits).
//
// Spec: bbttcc-structures/STRUCTURE_DAMAGE_SPEC.md §§4–5
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  if (!game.user?.isGM) {
    return ui.notifications?.warn?.("GM only — players cannot deal damage directly.");
  }

  const api = game.bbttcc?.api?.structures;
  const apply = game.fourththing?.rolls?._applyDamageToActor;
  if (!api || typeof apply !== "function") {
    return ui.notifications?.error?.("bbttcc-structures API or fourththing damage path not loaded.");
  }

  // Pick a target — selected token first, else first targeted token
  const target = (canvas.tokens?.controlled?.[0]?.actor)
              ?? (Array.from(game.user.targets)?.[0]?.actor)
              ?? null;
  if (!target) {
    return ui.notifications?.warn?.("Select or target a token first.");
  }

  const state = api.readState(target);
  const hasStructure = !!state?.hasStructure;
  const escName = foundry.utils.escapeHTML(target.name);

  const stateInfo = hasStructure
    ? `<p style="margin:0; font-size:0.74rem; opacity:0.7">
         Plates ${state.plates.current}/${state.plates.max} · Threshold ${state.threshold} · State ${state.state}
         ${state.loadBearing ? " · ⚜ Load-bearing" : ""}
       </p>`
    : `<p style="margin:0; font-size:0.74rem; opacity:0.6; color:#e8c84a">
         <i>No Structure stamped — damage will go straight through to integrity.</i>
       </p>`;

  new Dialog({
    title: "Damage Structure",
    content: `
      <div style="display:flex; flex-direction:column; gap:0.5rem; padding:0.4rem 0; min-width:380px;">
        <div>
          <p style="margin:0; font-size:0.8rem">Target: <b>${escName}</b> <span style="opacity:0.5">(${target.type})</span></p>
          ${stateInfo}
        </div>

        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Damage formula (rolled if dice; raw if number)</span>
          <input type="text" name="formula" value="10" placeholder="e.g. 2d6+4 or 25" style="font-family:monospace;"/>
        </label>

        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Damage type (canonical FT.DAMAGE_TYPES)</span>
          <select name="dmgType">
            <option value="">— none —</option>
            <option value="kinetic">kinetic (metal/stone/wood resist)</option>
            <option value="energy">energy (heat/fire/electricity)</option>
            <option value="poison">poison</option>
            <option value="psychic">psychic (memetic resist)</option>
            <option value="sephirotic">sephirotic (good-magic)</option>
            <option value="qliphothic">qliphothic (ward/sephirotic resist)</option>
            <option value="radiation">radiation</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Damage flavor (modulates vulns)</span>
          <select name="dmgFlavor">
            <option value="">— none —</option>
            <option value="concussive">concussive (stone vuln when type=kinetic)</option>
            <option value="fire">fire (wood/cloth vuln when type=energy)</option>
            <option value="heat">heat (metal vuln when type=energy)</option>
            <option value="ice">ice</option>
            <option value="electricity">electricity</option>
            <option value="piercing">piercing</option>
            <option value="slashing">slashing</option>
            <option value="bludgeoning">bludgeoning</option>
            <option value="hex">hex</option>
            <option value="curse">curse</option>
            <option value="holy">holy</option>
          </select>
        </label>

        <p style="margin:0; font-size:0.66rem; opacity:0.55; font-style:italic; line-height:1.4">
          Legacy aliases ("fire", "concussive", "holy", etc.) are auto-canonicalized to
          their FT type + flavor at apply time — content authors don't have to rewrite
          existing weapons.
        </p>

        <label style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-size:0.72rem; opacity:0.7">Per-target multiplier</span>
          <input type="number" name="mult" value="1" min="0" step="0.5"/>
        </label>

        <p style="margin:0; font-size:0.7rem; opacity:0.55; font-style:italic">
          Damage routes through _applyDamageToActor (wedged). For Structure
          actors: Plates absorb first (after resists); overflow falls through
          to Integrity. State transitions + Collapse fire automatically.
        </p>
      </div>
    `,
    buttons: {
      apply: {
        label: "Apply",
        callback: async (html) => {
          const formula = String(html.find("[name='formula']").val() ?? "").trim();
          const dmgType = String(html.find("[name='dmgType']").val() ?? "").trim();
          const dmgFlavor = String(html.find("[name='dmgFlavor']").val() ?? "").trim();
          const mult = Math.max(0, Number(html.find("[name='mult']").val()) || 1);
          if (!formula) return ui.notifications?.warn?.("Damage formula required.");

          let amount;
          if (/^\d+(\.\d+)?$/.test(formula)) {
            amount = Math.floor(Number(formula));
          } else {
            try {
              const roll = new Roll(formula);
              await roll.evaluate();
              amount = Math.max(0, Math.floor(Number(roll.total) || 0));
              await roll.toMessage({ flavor: `Damage roll: ${formula}`, speaker: ChatMessage.getSpeaker({ actor: target }) });
            } catch (e) {
              console.warn("[damage-structure macro] roll failed", e);
              return ui.notifications?.error?.(`Could not roll "${formula}".`);
            }
          }

          try {
            const desc = await apply(target, amount, {
              op: "damage", track: "integrity",
              damageType: dmgType, damageFlavor: dmgFlavor,
              perTargetMultiplier: mult
            });
            if (desc) ui.notifications?.info?.(desc);
          } catch (e) {
            console.error("[damage-structure macro] apply failed", e);
            ui.notifications?.error?.("Damage application failed — see console.");
          }
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "apply"
  }).render(true);
})();
