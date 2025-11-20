/* BBTTCC — Travel Summary Enhancer v1.0
 * Lightweight logger for api.travel.travelHex() results.
 * Prints readable summaries to console and Foundry chat for GMs.
 */
(() => {
  const TAG = "[bbttcc-travel-summary]";
  const MOD = "bbttcc-travel";
  const log = (...a)=>console.log(TAG, ...a);
  const warn = (...a)=>console.warn(TAG, ...a);

  function install(){
    const api = game.bbttcc?.api?.travel;
    if (!api || typeof api.travelHex !== "function") {
      return warn("api.travel.travelHex not found; summary enhancer idle.");
    }

    // Wrap once
    if (api.__summaryWrapped) return;
    const base = api.travelHex.bind(api);

    api.travelHex = async function travelHex_withSummary(args={}){
      const res = await base(args).catch(e=>{
        warn("travelHex failed", e);
        return { ok:false, error:e };
      });

      try {
        const factionId = args.factionId || args.attackerId;
        const A = factionId
          ? game.actors.get(String(factionId).replace(/^Actor\./,""))
          : null;
        const fname = A?.name || "Unknown Faction";
        const from = args.hexFrom ? (await fromUuid(args.hexFrom))?.name ?? "(from)" : "";
        const to   = args.hexTo   ? (await fromUuid(args.hexTo))?.name   ?? "(to)"   : "";

        if (res?.ok) {
          const spent = Object.entries(res.cost||{})
            .filter(([_,v])=>v>0)
            .map(([k,v])=>`${v} ${k}`)
            .join(", ") || "—";
          const encounter = res.encounter?.triggered
            ? `Encounter (Tier ${res.encounter.tier}): ${res.encounter.result?.label ?? "Unknown"}`
            : "No encounter";

          const summary = `<p><b>${fname}</b> traveled ${from} → ${to}<br/>
            Spent: ${spent}<br/>${encounter}</p>`;

          log(`${fname}: ${res.summary}`);
          await ChatMessage.create({
            content: summary,
            whisper: game.users.filter(u=>u.isGM).map(u=>u.id) ?? [],
            speaker: { alias: "BBTTCC Travel" }
          });
        }
      } catch(e){ warn("summary enhancer error:", e); }

      return res;
    };

    api.__summaryWrapped = true;
    log("Travel Summary Enhancer installed.");
  }

  Hooks.once("ready", install);
  if (game?.ready) install();
})();
