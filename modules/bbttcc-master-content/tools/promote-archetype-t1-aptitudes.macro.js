/**
 * Promote Archetype / Crew-Type Tier 1 proficiency grants into real aptitude ranks.
 *
 * WHY (2026-10-14, Cinder Ashthroat + the Death archetype): the character-options
 * "Archetype Tier 1 Proficiencies" / "<Crew> T1 Skills" Active Effects are
 * upgrade-to-1 floors on `system.skills.<x>.value`. The rank pips read SOURCE,
 * so the floor never shows as a rank, and an actor who already held the skill
 * never got the second rank the text promises ("you gain a skill rank in X; if
 * you already have it, its rank rises by one" — Techniques R1 canon).
 *
 * System 0.6.22's promoter (`promoteStampedAptitudeAEs`) now treats those AEs as
 * promotable stamps: +1 source rank once per (item | skill), ledgered at
 * `flags.fourththing.aptitudePromotions`, then the AE is disabled. New archetype
 * drops promote automatically on createItem. This macro is the RETRO pass for
 * actors who already hold the items.
 *
 * DRY_RUN = true lists what would change. Set false to APPLY. GM only. Idempotent.
 */
(async () => {
  const DRY_RUN = true;
  if (!game.user?.isGM) return ui.notifications.warn("GM only.");
  const prog = game.fourththing?._progression;
  const promote = prog?.promoteStampedAptitudeAEs;
  const hasAE   = prog?.itemHasPromotableAptitudeAE;
  if (typeof promote !== "function" || typeof hasAE !== "function") {
    return ui.notifications.error("System 0.6.22+ required (promoter / itemHasPromotableAptitudeAE missing). Reload after the restart.");
  }
  const RE = /tier 1 proficiencies|\bt1 skills\b|tier 1 skills/i;
  const plan = [];
  for (const a of game.actors.filter(x => x.type === "character")) {
    const ledger = a.getFlag("fourththing", "aptitudePromotions") ?? {};
    const src = a.toObject().system?.skills ?? {};
    const rows = [];
    for (const it of a.items) {
      if (!hasAE(it)) continue;
      for (const e of it.effects) {
        if (!(e.flags?.fourththing?.aptitudeStamp || RE.test(String(e.name ?? "")))) continue;
        for (const c of e.changes ?? []) {
          const m = String(c.key ?? "").match(/^system\.skills\.([a-zA-Z0-9_]+)\.value$/);
          if (!m) continue;
          const lk = `${String(it.name).toLowerCase().replace(/\s+/g, " ").trim()}|${m[1]}`;
          if (ledger[lk]) { if (!e.disabled) rows.push(`${m[1]}: already promoted, AE still enabled → will disable`); continue; }
          const cur = Number(src[m[1]]?.value) || 0;
          rows.push(`${m[1]}: ${cur} → ${Math.min(5, cur + 1)} (${it.name})`);
        }
      }
    }
    if (rows.length) plan.push({ actor: a, rows });
  }
  const lines = plan.map(p => `<b>${foundry.utils.escapeHTML(p.actor.name)}</b><br/>&nbsp;&nbsp;${p.rows.map(foundry.utils.escapeHTML).join("<br/>&nbsp;&nbsp;")}`);
  console.log("[promote-archetype-t1-aptitudes]", DRY_RUN ? "DRY RUN" : "APPLY", plan.map(p => ({ actor: p.actor.name, rows: p.rows })));
  if (!plan.length) return ui.notifications.info("Nothing to promote — every Tier 1 proficiency grant is already a rank.");
  if (DRY_RUN) {
    await ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Roll for Initiation" },
      content: `<section class="ft-card"><h3>Promote Tier 1 proficiencies — DRY RUN (${plan.length} actor${plan.length === 1 ? "" : "s"})</h3><p>${lines.join("<br/>")}</p><p><i>Set DRY_RUN = false to apply.</i></p></section>` });
    return ui.notifications.info(`Dry run: ${plan.length} actor(s) would be promoted — see the GM card.`);
  }
  let done = 0;
  for (const p of plan) {
    try { const r = await promote(p.actor); done++; console.log("[promote-archetype-t1-aptitudes] promoted", p.actor.name, r); }
    catch (e) { console.error("[promote-archetype-t1-aptitudes] failed", p.actor.name, e); }
  }
  await ChatMessage.create({ whisper: game.users.filter(u => u.isGM).map(u => u.id), speaker: { alias: "Roll for Initiation" },
    content: `<section class="ft-card"><h3>Promote Tier 1 proficiencies — APPLIED (${done}/${plan.length})</h3><p>${lines.join("<br/>")}</p></section>` });
  ui.notifications.info(`Promoted Tier 1 proficiencies on ${done} actor(s). Reopen sheets to see the ranks.`);
})();
