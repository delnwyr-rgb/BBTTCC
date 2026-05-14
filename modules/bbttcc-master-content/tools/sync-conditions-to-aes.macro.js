// One-shot retro-sync: walk all character actors, find condition flags that are
// already TRUE, ensure each has a matching condition-mirror ActiveEffect.
// Mirrors what game.fourththing.toggleCondition now does on every toggle, but
// applied to characters that already had conditions stamped before the AE-mirror
// shipped (2026-04-28). Safe to re-run — idempotent (skips actors that already
// have the AE for that condition).
//
// V14 macro scope: bare `return` throws "Illegal Return Statement" at top level,
// so the body is wrapped in an IIFE. (See feedback_foundry_v14_macro_scope.)
//
// Set DRY_RUN = true to preview without writing.
(async () => {
  const DRY_RUN = false;

  const FT = game.fourththing?.constants ?? globalThis.FT ?? null;
  const CONDITIONS = FT?.CONDITIONS ?? null;
  if (!CONDITIONS) {
    ui.notifications?.error?.("FT.CONDITIONS not found — is the fourththing system loaded?");
    return;
  }

  const condKeys = Object.keys(CONDITIONS);
  let scanned = 0, missingFound = 0, created = 0, skipped = 0;
  const report = [];

  for (const actor of game.actors ?? []) {
    if (actor.type !== "character") continue;
    scanned += 1;
    const sys = actor.system?.system ?? actor.system;
    const flags = sys?.conditions ?? {};

    const toCreate = [];
    for (const key of condKeys) {
      if (flags[key] !== true) continue;
      const existing = actor.effects?.find(e => e.flags?.fourththing?.condition === key);
      if (existing) { skipped += 1; continue; }
      missingFound += 1;
      const cond = CONDITIONS[key];
      toCreate.push({
        name:    cond.label,
        icon:    "icons/svg/aura.svg",
        img:     "icons/svg/aura.svg",
        tint:    cond.color,
        origin:  actor.uuid,
        statuses: [key],
        changes: [],
        flags:   { fourththing: { condition: key } }
      });
    }

    if (toCreate.length) {
      report.push(`• ${actor.name}: ${toCreate.map(d => d.name).join(", ")}`);
      if (!DRY_RUN) {
        try {
          const made = await actor.createEmbeddedDocuments("ActiveEffect", toCreate);
          created += made.length;
        } catch (err) {
          console.error(`sync-conditions | ${actor.name} create failed`, err);
        }
      }
    }
  }

  const heading = DRY_RUN
    ? `<b>DRY RUN</b> — would create ${missingFound} condition AE${missingFound === 1 ? "" : "s"}`
    : `Created ${created} / ${missingFound} condition AE${missingFound === 1 ? "" : "s"}`;

  const body = report.length
    ? `<ul style="margin:0.3rem 0 0;padding-left:1.1rem;font-size:0.78rem">${report.map(l => `<li>${l}</li>`).join("")}</ul>`
    : `<p style="margin:0.2rem 0 0;font-size:0.78rem;opacity:0.7">All actors already in sync — nothing to do.</p>`;

  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<div class="fourththing-roll">
      <div class="ft-roll-header"><span class="ft-roll-name">◈ Retro-sync conditions → AEs</span></div>
      <p style="margin:0.2rem 0;font-size:0.82rem">${heading}</p>
      <p style="margin:0.1rem 0 0;font-size:0.74rem;opacity:0.65">Scanned ${scanned} character actor${scanned === 1 ? "" : "s"} — already-synced flags skipped: ${skipped}.</p>
      ${body}
    </div>`
  });
  console.log("sync-conditions | done", { scanned, missingFound, created, skipped, dryRun: DRY_RUN });
})();
