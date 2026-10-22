/* clear-structure-from-mobile-rigs-2026-10-21.macro.js — owner ruling 2026-10-21: NO structure on rigs that move.
 *
 * Every rig used to get a structural material list at creation (Rig Builder + starter rigs). On a personal rig it was
 * seven units, chipped bare in two hits, so the sheet read as broken; it also made every rig count as a WALL for ram
 * recoil, the structure damage path and siege garrisons. The builder no longer stamps mobile/hybrid rigs; this macro
 * clears the structure from the ones that already have it.
 *
 *  - Targets: rig actors (game.bbttcc.rigs.isRig) whose mobility is mobile or hybrid and that carry
 *    flags.bbttcc-structures.hasStructure — world actors AND unlinked rig tokens on every scene.
 *  - Skips: stationary rigs (emplacements, fortifications, facilities) — they keep their structure.
 *  - Integrity is untouched (the rig's own track); only the bbttcc-structures flag block is removed, via
 *    game.bbttcc.api.structures.clearStructure.
 *  Idempotent; DRY_RUN default true; downloads a JSON backup of every removed block first. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const SCOPE = "bbttcc-structures";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  const R = game.bbttcc?.rigs;
  const S = game.bbttcc?.api?.structures;
  if (!R?.isRig) return ui.notifications.error("game.bbttcc.rigs not available.");
  if (!S?.clearStructure) return ui.notifications.error("bbttcc-structures API (clearStructure) not available.");

  const mobilityOf = (a) => String(R.data?.(a)?.identity?.mobility ?? a?.system?.identity?.mobility ?? "mobile").toLowerCase();
  const targets = []; const kept = []; const seen = new Set();
  const consider = (actor, where) => {
    if (!actor || !R.isRig(actor)) return;
    if (actor.flags?.[SCOPE]?.hasStructure !== true) return;
    const key = actor.uuid; if (seen.has(key)) return; seen.add(key);
    const mob = mobilityOf(actor);
    if (mob === "stationary") { kept.push(`${actor.name} (${where}, stationary)`); return; }
    targets.push({ actor, where, mob, backup: foundry.utils.deepClone(actor.flags[SCOPE]) });
  };
  for (const a of game.actors) consider(a, "world");
  for (const sc of game.scenes) for (const t of sc.tokens) { if (t.actorLink) continue; consider(t.actor, `token on ${sc.name}`); }

  const lines = targets.map(t => `✚ ${t.actor.name} — ${t.where} · ${t.mob} · plates ${t.backup?.plates?.current ?? "?"}/${t.backup?.plates?.max ?? "?"} · ${(t.backup?.materialBOM || []).length} materials`);
  if (kept.length) { lines.push(""); lines.push("Kept (stationary, keep their structure):"); for (const k of kept) lines.push(`   · ${k}`); }
  const summary = `clear rig structure — ${targets.length} moving rig(s)${DRY_RUN ? " (DRY RUN — nothing written)" : ""}`;
  console.log("[clear-structure-from-mobile-rigs]", summary); console.log(lines.join("\n"));
  await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id), speaker: { alias: "Bad Eden" },
    content: `<div style="border-left:3px solid #c9a227;padding:.35em .6em;"><b>${foundry.utils.escapeHTML(summary)}</b><pre style="white-space:pre-wrap;font-size:.8em;max-height:420px;overflow:auto;margin:.3em 0 0;">${foundry.utils.escapeHTML(lines.join("\n"))}</pre></div>` });
  if (DRY_RUN || !targets.length) return;

  try { saveDataToFile(JSON.stringify(targets.map(t => ({ uuid: t.actor.uuid, name: t.actor.name, where: t.where, flags: t.backup })), null, 2), "application/json", `rig-structure-backup-${Date.now()}.json`); } catch (e) { console.warn("backup download failed", e); }
  let done = 0;
  for (const t of targets) { try { await S.clearStructure(t.actor); done++; } catch (e) { console.warn("clearStructure failed", t.actor.name, e); } }
  ui.notifications.info(`Cleared structure from ${done}/${targets.length} moving rig(s).`);
})();
