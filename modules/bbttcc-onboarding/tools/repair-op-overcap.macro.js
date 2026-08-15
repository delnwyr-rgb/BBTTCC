/* bbttcc-onboarding/tools/repair-op-overcap.macro.js
 * GM macro — find factions whose OP banks sit above their per-bucket cap and
 * clamp them back down. Reports first; nothing is written until you confirm.
 *
 * Why this exists: the onboarding training stipend used to ADD its full amount
 * with allowOvercap on EVERY run, so each replay stacked another credit on top
 * (11 playtest runs → a Tier-0 faction holding 143 OP against a 5 OP cap).
 * The stipend now tops up toward cap instead (stage.js `grantOp`), but banks
 * already inflated by the old behaviour need this one-time cleanup.
 *
 * Cap resolution mirrors op-engine's _readCaps:
 *   flags.bbttcc-factions.opCaps → opCapPer → tier band [50,70,90,110,130] marks.
 *
 * Paste into a script macro named "◇ Repair OP Overcap".
 */
(async () => {
  const MOD = "bbttcc-factions";
  const TIER_BAND = [50, 70, 90, 110, 130];   // marks per bucket, T0..T4 (1 OP = 10 marks)

  if (!game.user.isGM) { ui.notifications.warn("Repair OP Overcap: GM only."); return; }

  const KEYS = game.bbttcc?.api?.op?.KEYS
    ?? ["violence", "nonlethal", "intrigue", "economy", "softpower", "diplomacy", "logistics", "culture", "faith"];
  const asOP = (marks) => {
    const n = (Number(marks) || 0) / 10;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const capsFor = (actor) => {
    const f = actor.flags?.[MOD] ?? {};
    if (f.opCaps && typeof f.opCaps === "object") {
      return Object.fromEntries(KEYS.map(k => [k, Math.max(0, Math.floor(Number(f.opCaps[k]) || 0))]));
    }
    const per = Number(f.opCapPer) || 0;
    if (per > 0) return Object.fromEntries(KEYS.map(k => [k, Math.max(0, Math.floor(per))]));
    let tier = Number(f.tier);
    if (!Number.isFinite(tier) || tier < 0) tier = Number(f.progression?.victory?.tierFromBadge) || 0;
    tier = Math.max(0, Math.min(4, Math.floor(tier)));
    return Object.fromEntries(KEYS.map(k => [k, TIER_BAND[tier]]));
  };

  // ── Survey ────────────────────────────────────────────────────────────────
  const findings = [];
  for (const actor of game.actors) {
    if (!actor.getFlag?.(MOD, "isFaction")) continue;
    const bank = actor.getFlag(MOD, "opBank") || {};
    const caps = capsFor(actor);
    const over = [];
    const clamped = {};
    for (const k of KEYS) {
      const cur = Math.max(0, Number(bank[k]) || 0);
      const cap = Number(caps[k]) || 0;
      clamped[k] = cap > 0 ? Math.min(cur, cap) : cur;
      if (cap > 0 && cur > cap) over.push({ pool: k, cur, cap });
    }
    if (over.length) findings.push({ actor, over, clamped, tier: actor.getFlag(MOD, "tier") ?? "?" });
  }

  if (!findings.length) {
    ui.notifications.info("OP banks: every faction is within cap. Nothing to repair.");
    console.log("[repair-op-overcap] clean — no faction over cap.");
    return;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const rows = findings.map(f => `
    <div style="margin:.5em 0; padding:.4em .6em; border-left:3px solid #e07a5f;">
      <b>${esc(f.actor.name)}</b> <span style="opacity:.6">(Tier ${esc(f.tier)})</span><br>
      ${f.over.map(o => `<span style="font-family:monospace;font-size:.85em">${esc(o.pool)}: ${asOP(o.cur)} OP → ${asOP(o.cap)} OP</span>`).join("<br>")}
    </div>`).join("");

  console.log("[repair-op-overcap] over-cap factions:", findings.map(f => ({
    faction: f.actor.name, tier: f.tier,
    over: f.over.map(o => `${o.pool} ${o.cur}→${o.cap} marks`).join(", ")
  })));

  // ── Confirm, then write ───────────────────────────────────────────────────
  const content = `<div>
    <p><b>${findings.length}</b> faction(s) hold OP above their per-bucket cap. Clamping sets each
    over-cap pool down to the cap; pools already within cap are untouched.</p>
    ${rows}
    <p style="opacity:.7;font-size:.9em">Console holds the full mark-level detail.</p>
  </div>`;

  let go = false;
  const DV2 = foundry?.applications?.api?.DialogV2;
  if (DV2?.wait) {
    await DV2.wait({
      window: { title: "◇ Repair OP Overcap" }, content, position: { width: 480 },
      buttons: [
        { action: "clamp", label: `Clamp ${findings.length} faction(s) to cap`, callback: () => { go = true; } },
        { action: "cancel", label: "Report only", default: true }
      ],
      rejectClose: false, modal: false
    }).catch(() => null);
  } else {
    await new Promise((resolve) => {
      new Dialog({
        title: "◇ Repair OP Overcap", content,
        buttons: {
          clamp: { label: `Clamp ${findings.length} to cap`, callback: () => { go = true; } },
          cancel: { label: "Report only" }
        },
        default: "cancel", close: () => resolve()
      }, { width: 480 }).render(true);
    });
  }

  if (!go) { ui.notifications.info("OP overcap: reported only — nothing changed."); return; }

  let fixed = 0;
  for (const f of findings) {
    try {
      await f.actor.setFlag(MOD, "opBank", f.clamped);
      fixed++;
      console.log(`[repair-op-overcap] clamped ${f.actor.name}`, f.clamped);
    } catch (e) {
      console.error(`[repair-op-overcap] failed on ${f.actor.name}`, e);
    }
  }
  ui.notifications.info(`OP overcap repaired on ${fixed}/${findings.length} faction(s).`);
})();
