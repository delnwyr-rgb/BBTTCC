// Bad Eden — grant the SELL SURPLUS activity to every existing faction (2026-09-21)
// New factions get it in the standard package; this hands it to the ones already founded. Idempotent; confirm dialog.
(async () => {
  if (!game.user?.isGM) return ui.notifications?.error("GM only.");
  const grant = game.bbttcc?.api?.factions?.doctrine?.grant; if (!grant) return ui.notifications?.error("Faction doctrine API not ready.");
  const isFaction = a => !!a.flags?.["bbttcc-factions"]?.isFaction;
  const factions = game.actors.contents.filter(isFaction);
  const yes = await Dialog.confirm({ title: "Grant Sell Surplus", content: `<p>Grant the <b>Sell Surplus</b> activity to <b>${factions.length}</b> faction(s)? Factions that already hold it are skipped.</p>` });
  if (!yes) return;
  let n = 0, had = 0; for (const f of factions) { try { const r = await grant(f, { kind: "strategic", key: "sell_surplus", silent: true }); if (r?.already) had++; else n++; } catch (e) { console.warn("[grant-sell-surplus]", f.name, e); } }
  ui.notifications?.info(`Sell Surplus granted to ${n} faction(s); ${had} already had it.`);
})();
