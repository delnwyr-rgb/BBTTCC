/* sync-rig-integrity-to-frame-2026-10-21.macro.js — owner ruling 2026-10-21: a rig's max integrity comes from its FRAME.
 *
 * Minted rigs took a size default (every Hexmobile 10, every medium T2 39) and ignored the frame's own numbers
 * (Hexmobile Frame 14, ATR Transport Frame 36 + 10 per tier). The structure plates used to hide it; with structure gone
 * from moving rigs the gap shows. The builder now syncs on mint; this macro fixes the rigs that already exist.
 *
 *  - Targets: every MOVING (mobile/hybrid) rig actor with an embedded frame carrying rigFrame.baseIntegrity (world actors
 *    + unlinked tokens). Stationary forts/facilities are skipped and listed.
 *  - New max = baseIntegrity + tierStep × (tier − 1), tier floored at 1.
 *  - DAMAGE IS KEPT: new value = new max − (old max − old value), floored at 0. A destroyed rig stays at 0.
 *  - Skips rigs already at the frame's max.
 *  Idempotent; DRY_RUN default true; downloads a JSON backup of the old integrity first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const R = game.bbttcc?.rigs;
  if (!R?.isRig) return ui.notifications.error("game.bbttcc.rigs not available.");

  const frameOf = (a) => (a?.items ?? []).find?.(i => i?.flags?.fourththing?.rigGear?.subtype === "rig-frame" || i?.flags?.fourththing?.rigFrame);
  const rows = []; const seen = new Set(); const skipped = [];
  const consider = (a, where) => {
    if (!a || !R.isRig(a) || seen.has(a.uuid)) return; seen.add(a.uuid);
    const f = frameOf(a)?.flags?.fourththing?.rigFrame;
    if (!f || f.baseIntegrity == null) return;
    // Moving rigs only (same scope as the no-structure ruling): stationary forts/facilities take damage through their
    // structure plates, and resizing their integrity would be a siege balance change nobody asked for.
    if (String(R.data?.(a)?.identity?.mobility ?? a.system?.identity?.mobility ?? "mobile").toLowerCase() === "stationary") { skipped.push(a.name); return; }
    const s = a.system?.integrity || {};
    const tier = Math.max(1, Number(s.tier) || 1);
    const newMax = Math.max(1, Number(f.baseIntegrity) + (tier - 1) * (Number(f.tierStep) || 0));
    const oldMax = Number(s.max) || 0, oldVal = Number(s.value) || 0;
    if (oldMax === newMax) return;
    const destroyed = String(R.data?.(a)?.identity?.state ?? a.system?.identity?.state ?? "") === "destroyed";
    const damage = Math.max(0, oldMax - oldVal);
    const newVal = destroyed ? 0 : Math.max(0, Math.min(newMax, newMax - damage));
    rows.push({ a, where, frame: frameOf(a)?.name, tier, oldMax, oldVal, newMax, newVal });
  };
  for (const a of game.actors) consider(a, "world");
  for (const sc of game.scenes) for (const t of sc.tokens) { if (t.actorLink) continue; consider(t.actor, `token on ${sc.name}`); }

  const lines = rows.map(r => `${r.newMax > r.oldMax ? "▲" : "▼"} ${r.a.name} — ${r.where} · ${r.frame} T${r.tier} · ${r.oldVal}/${r.oldMax} → ${r.newVal}/${r.newMax}`);
  if (skipped.length) { lines.push(""); lines.push(`Skipped (stationary, integrity unchanged): ${skipped.join(", ")}`); }
  const summary = `sync rig integrity to frame — ${rows.length} rig(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log("[sync-rig-integrity-to-frame]", summary); console.log(lines.join("\n"));
  await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" },
    content: `<div style="border-left:3px solid #c9a227;padding:.35em .6em;"><b>${foundry.utils.escapeHTML(summary)}</b><pre style="white-space:pre-wrap;font-size:.8em;max-height:420px;overflow:auto;margin:.3em 0 0;">${foundry.utils.escapeHTML(lines.join("\n"))}</pre></div>` });
  if (DRY_RUN || !rows.length) return;

  try { saveDataToFile(JSON.stringify(rows.map(r => ({ uuid: r.a.uuid, name: r.a.name, before: { value: r.oldVal, max: r.oldMax } })), null, 2), "application/json", `rig-integrity-backup-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  let done = 0;
  for (const r of rows) {
    try {
      if (R.update) await R.update(r.a, { "integrity.max": r.newMax, "integrity.value": r.newVal });
      else await r.a.update({ "system.integrity.max": r.newMax, "system.integrity.value": r.newVal });
      done++;
    } catch (e) { console.warn("integrity sync failed", r.a.name, e); }
  }
  ui.notifications.info(`Synced integrity for ${done}/${rows.length} rig(s).`);
})();
