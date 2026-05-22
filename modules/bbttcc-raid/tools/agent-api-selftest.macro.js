/* agent-api-selftest.macro.js
 *
 * Foundry macro — paste contents into a macro slot and execute (as GM).
 * Calls every Layer 1 (query) verb in the agent registry and dumps results
 * to console + a whisper chat card. Regression check for any schema change.
 *
 * Run after hot-reloading bbttcc-raid. Expected: all queries pass, schema
 * gate negative test passes, socket envelopes registered.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §7.5
 */

(async () => {
  const agent = game.bbttcc?.api?.agent;
  if (!agent?.capabilities) {
    ui.notifications.error("[agent-selftest] Registry not installed. Hot-reload bbttcc-raid.");
    return;
  }

  const caps = agent.capabilities();
  console.group("[agent-selftest] capabilities snapshot");
  console.log("Version:", caps.version);
  console.log(`Verbs: ${caps.verbs.length}  (Q:${caps.queries.length} S:${caps.simulations.length} A:${caps.actions.length})`);
  console.log("Socket envelopes:", Object.keys(caps.sockets || {}));
  console.log("Enums available:", Object.keys(caps.enums || {}));
  console.groupEnd();

  const factionId = game.actors?.find(a => a.type === "faction" || a.flags?.["bbttcc-factions"])?.id || null;

  // Pre-fetch a single observation snapshot; reused by gm.suggest* verbs.
  let observation = null;
  if (factionId) {
    try {
      const obs = await agent.invoke("observation.snapshot", { factionId });
      if (obs && obs.ok !== false) observation = obs;
    } catch (_) { /* leave null */ }
  }

  const NEEDS_FACTION = new Set([
    "observation.snapshot", "strategic.legalActions"
  ]);
  const NEEDS_OBSERVATION = new Set([
    "gm.suggestCampaignBeats", "gm.suggestCampaignTables"
  ]);

  const results = [];
  for (const name of caps.queries) {
    let args = {};
    if (NEEDS_FACTION.has(name)) {
      if (!factionId) { results.push({ name, ok: false, durationMs: 0, error: "no faction in world" }); continue; }
      args.factionId = factionId;
    }
    if (NEEDS_OBSERVATION.has(name)) {
      if (!observation) { results.push({ name, ok: false, durationMs: 0, error: "no observation available" }); continue; }
      args = { observation };
    }
    if (name === "validate.maneuver") args = { maneuverKey: "rally_the_line", outcomeTier: "success" };

    const t0 = performance.now();
    try {
      const r = await agent.invoke(name, args);
      const dt = +(performance.now() - t0).toFixed(1);
      const ok = !(r && r.ok === false);
      results.push({ name, ok, durationMs: dt, error: ok ? "" : (r?.error || r?.message || "?") });
    } catch (e) {
      results.push({ name, ok: false, durationMs: +(performance.now() - t0).toFixed(1), error: e?.message || String(e) });
    }
  }

  // Negative test: schema validation gate should reject malformed args
  const negTest = await agent.invoke("observation.snapshot", { factionId: 42 });
  const gateOK = (negTest?.ok === false && negTest?.error === "INVALID_ARGS");

  console.group("[agent-selftest] query verb results");
  console.table(results);
  console.log("Schema-gate negative test:", gateOK ? "PASS" : "FAIL", negTest);
  console.groupEnd();

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  const summary = `<div><p><strong>Agent API Self-Test</strong> — registry v${caps.version}</p>
    <ul>
      <li>Verbs: <strong>${caps.verbs.length}</strong> (Q ${caps.queries.length} · S ${caps.simulations.length} · A ${caps.actions.length})</li>
      <li>Queries passed: <strong>${passed} / ${results.length}</strong>${failed ? ` (${failed} failed — see console)` : ""}</li>
      <li>Schema gate: <strong>${gateOK ? "PASS" : "FAIL"}</strong></li>
      <li>Socket envelopes: <strong>${Object.keys(caps.sockets || {}).length}</strong></li>
    </ul></div>`;
  ChatMessage.create({ content: summary, whisper: [game.user.id] });
  ui.notifications[failed || !gateOK ? "warn" : "info"](`[agent-selftest] ${passed}/${results.length} passed${gateOK ? "" : " — schema gate FAIL"}.`);
})();
