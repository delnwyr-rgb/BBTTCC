/* list-geburah-beats.macro.js — read-only: dump the Geburah chain's real ids.
 * 2026-08-18. Changes nothing. GM only.
 * The extracted beats dump lists beats by INDEX and LABEL but carries no ids,
 * so this asks the live world instead. */
(async () => {
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let raw = game.settings.get(NS, "campaigns");
  const camps = typeof raw === "string" ? JSON.parse(raw) : raw;
  const rows = [];
  for (const c of Object.values(camps || {})) {
    for (const b of (c?.beats || [])) {
      const tags = String(b?.tags || "");
      if (!/spark\.geburah|lost_stone_statues/i.test(tags)) continue;
      const ch = (b.choices || []).map(x => `"${x.label}"→${x.next || "—"}`).join("  ");
      rows.push(`  ${b.id}\n      label: ${b.label}\n      type: ${b.type}   cinematic: ${b.cinematic?.enabled ? "yes" : "no"}\n      choices: ${ch || "(none)"}`);
    }
  }
  console.log(`[list-geburah-beats] ${rows.length} beat(s)\n` + rows.join("\n"));
  ui.notifications.info(`list-geburah-beats: ${rows.length} beats — see console (F12).`);
})();
