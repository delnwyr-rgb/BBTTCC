/* check-wendigo.macro.js — read-only: is the Forgotten-Cause arc applied? */
(async () => {
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");
  let raw = game.settings.get(NS, "campaigns");
  const camps = typeof raw === "string" ? JSON.parse(raw) : raw;
  const want = ["wendigo_confluence_the_long_table","wendigo_confluence_repair",
    "wendigo_confluence_redirect","wendigo_confluence_break",
    "gullywasher_dougan_points_to_confluence","gullywasher_cultural_summit",
    "gullywasher_cultural_summit_success","gullywasher_cultural_summit_failure"];
  const have = new Set();
  for (const c of Object.values(camps || {})) for (const b of (c?.beats || [])) have.add(b.id);
  const out = want.map(id => `  ${have.has(id) ? "✅" : "❌ MISSING"}  ${id}`);
  out.push(`  — rung meter: ${game.settings.get(NS,"wendigoRung")} / 4`);
  out.push(`  — Dougan has pointed: ${game.settings.get(NS,"wendigoDouganPointed")}`);
  console.log("[check-wendigo]\n" + out.join("\n"));
  ui.notifications.info("check-wendigo: see console (F12).");
})();
