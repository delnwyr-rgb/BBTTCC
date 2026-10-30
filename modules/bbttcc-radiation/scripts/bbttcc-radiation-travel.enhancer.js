// ============================================================================
// Bad Eden — Radiation-on-Travel Enhancer
// A travel leg into a hot hex exposes the STEWARDS of everyone on the ride (lead + stacked passengers).
//
// One switch (owner rulings 2026-10-22):
//   • the destination hex's Radiation level (0–3, api.territory.radiation) + its active
//     weather's radiation = the leg's base exposure (api.radiation.hexBase)
//   • each Steward of the faction takes it through their gear (api.radiation.exposureFor):
//     Radcloth Hood / Scrubber Harness = one level cooler, a worn Rad Suit halves the rest
//   • RP lands on the Steward (system.radiation.rp) — the sickness ladder lives there
//   • one card per leg, to the table (bbttcc-territory.tableAnnouncements)
// Terrain no longer adds radiation; scene fallout zones are only the green tint now.
// ============================================================================

(() => {
  const TAG = "[bbttcc-radiation/travel]";

  const tableAudience = () => { try { if (game.settings.get("bbttcc-territory", "tableAnnouncements") === "gm") return (game.users ?? []).filter(u => u.isGM).map(u => u.id); } catch (_e) {} return []; };
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

  function destHexDoc(ctx) {
    const t = ctx?.to;
    return t?.document ?? t?.doc ?? t?.obj?.document ?? t?.obj ?? null;
  }

  async function applyExposure(ctx) {
    // The encounter re-emits (travel console + GM arbitration relay) carry ctx.encounter and are a second
    // hook for the SAME leg — expose once. The hook is local to the seat that ran the leg; radApi.add relays
    // to the GM when this seat cannot write the steward.
    if (ctx?.encounter || ctx?.relayed) return;
    const radApi = game.bbttcc?.api?.radiation;
    if (!radApi?.add || !radApi.hexBase || !radApi.exposureFor) return;

    const hex = destHexDoc(ctx);
    if (!hex) return;
    const { level, weather, weatherLabel, base } = radApi.hexBase(hex);
    if (base <= 0) return;

    const faction = ctx.actor;
    // the whole ride, not just the lead (Dave 2026-10-29) — passengers stacked on this faction take the leg too
    const stewards = radApi.partyStewardsOf ? radApi.partyStewardsOf(faction ?? ctx.factionId) : radApi.stewardsOf(faction ?? ctx.factionId);
    if (!stewards.length) { console.log(TAG, "hot hex but no stewards on", faction?.name); return; }

    const rows = [];
    for (const S of stewards) {
      const ex = radApi.exposureFor(S, base);
      if (ex.rp > 0) {
        try { await radApi.add(S, ex.rp); } catch (e) { console.warn(TAG, "add failed", S.name, e); continue; }
      }
      const gear = ex.protection.immune ? "immune"
        : ex.protection.sources.length ? `${ex.protection.sources.join(", ")}` : "";
      rows.push(`<li><b>${esc(S.name)}</b>: +${ex.rp} RP${gear ? ` <span style="opacity:.7">(${esc(gear)})</span>` : ""} → ${radApi.get(S)} RP</li>`);
    }

    const rung = game.bbttcc?.api?.territory?.radiation?.LADDER?.[level]?.name || `level ${level}`;
    const hexName = ctx.toHexName || hex?.flags?.["bbttcc-territory"]?.name || hex?.text || hex?.name || "the hex";
    const why = [`${esc(rung)} (${level})`];
    if (weather) why.push(`${esc(weatherLabel)} ${weather > 0 ? "+" : ""}${weather}`);
    await ChatMessage.create({
      content: `<div class="bbttcc-radiation-card" style="border-left:3px solid #84cc16;padding:.35em .6em;background:rgba(132,204,22,.08);">`
        + `<b>☢ Radiation Exposure</b> — ${esc(hexName)}<br/><small>${why.join(" · ")}</small>`
        + `<ul style="margin:.3em 0 0 1em;padding:0;">${rows.join("")}</ul></div>`,
      whisper: tableAudience(),
      speaker: { alias: "Bad Eden Radiation" }
    }).catch(e => console.warn(TAG, "card failed", e));
    console.log(TAG, `leg into ${hexName}: base ${base}`, rows.length, "steward(s)");
  }

  Hooks.on("bbttcc:afterTravel", async (ctx) => {
    try { await applyExposure(ctx); }
    catch (e) { console.warn(TAG, "afterTravel handler failed", e); }
  });

  console.log(TAG, "Radiation-on-Travel Enhancer installed (hex level → stewards).");
})();
