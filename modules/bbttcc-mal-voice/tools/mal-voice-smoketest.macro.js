/* mal-voice-smoketest.macro.js
 *
 * Foundry macro — paste contents into a macro slot, execute as GM.
 *
 * Smoke-tests the bbttcc-mal-voice Phase 2A stack end-to-end:
 *   1. Verify game.bbttcc.mal is installed and has all sub-namespaces
 *   2. Verify the agent registry (bbttcc-raid) is reachable for snapshots
 *   3. Confirm API key + provider are configured
 *   4. Fire game.bbttcc.mal.triggers.fire("mal", { hook: "bbttcc:mal:test", ... })
 *   5. Surface Mal's reply (or any error) in chat + notifications
 *
 * Expected good result:
 *   - "OK" indicators across the diagnostic
 *   - A Mal-voiced chat message appears in the chat log within ~3-8 seconds
 *   - Token usage + cost estimate logged to console
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8 Phase 2A
 */

(async () => {
  const mal = game.bbttcc?.mal;
  const agent = game.bbttcc?.api?.agent;
  const lines = [];
  const ok = (s) => lines.push(`✅ ${s}`);
  const warn = (s) => lines.push(`⚠️  ${s}`);
  const fail = (s) => lines.push(`❌ ${s}`);

  // 1. Namespace
  if (!mal) { fail("game.bbttcc.mal not installed — is bbttcc-mal-voice enabled?"); _report(); return; }
  ok(`game.bbttcc.mal installed (v${mal.version})`);

  // 2. Sub-namespaces
  if (mal.providers?.anthropic?.call) ok("providers.anthropic ready");
  else fail("providers.anthropic missing");
  if (mal.voices?.register)            ok("voice registry ready");
  else fail("voices.register missing");
  if (mal.triggers?.fire)              ok("trigger engine ready");
  else fail("triggers.fire missing");
  if (mal.output?.render)              ok("output channel ready");
  else fail("output.render missing");

  // 3. Agent registry (dependency)
  if (agent?.capabilities) {
    const caps = agent.capabilities();
    ok(`agent registry v${caps.version} (${caps.verbs.length} verbs)`);
  } else {
    warn("agent registry not reachable — Mal will speak without snapshot context");
  }

  // 4. Voices
  const voices = mal.voices.list();
  ok(`${voices.length} voice(s) registered: ${voices.map(v => v.id).join(", ")}`);
  const malVoice = mal.voices.get("mal");
  if (!malVoice) { fail("Mal voice config not found"); _report(); return; }
  ok(`Mal config: ${malVoice.systemPrompt.length} chars prompt, ${malVoice.triggers.length} triggers, audience=${malVoice.audience}`);

  // 5. API key + provider
  const provider = mal.settings.provider();
  const key = mal.settings.apiKey();
  const model = mal.settings.model() || "(provider default)";
  ok(`Provider: ${provider}, model: ${model}`);
  if (!key) {
    fail("No API key configured. Open Module Settings → BBTTCC Mal Voice → API key and paste your Anthropic key, then re-run.");
    _report();
    return;
  }
  ok(`API key configured (${key.length} chars)`);

  // 6. Fire the test trigger
  lines.push("");
  lines.push(`🎤 Firing test trigger for Mal...`);
  _report({ keepOpen: true });

  const t0 = performance.now();
  const result = await mal.triggers.fire("mal", {
    hook: "bbttcc:mal:test",
    args: {
      context: "Smoketest. Steward just finished their first raid round, outcome was greatSuccess. They want to hear from Mal.",
      outcome: "greatSuccess",
      raidType: "assault"
    },
    mode: "outcome",
    lengthHint: 30
  });
  const dt = Math.round(performance.now() - t0);

  if (!result.ok) {
    fail(`fire() failed: ${result.error} — ${result.message || ""}`);
    _report();
    return;
  }

  ok(`Mal responded in ${dt}ms`);
  ok(`Tokens: in=${result.inputTokens}, out=${result.outputTokens}`);
  if (result.costUSD != null) ok(`Cost estimate: $${result.costUSD.toFixed(4)}`);
  lines.push("");
  lines.push(`💬 Mal said:`);
  lines.push(`"${result.text}"`);

  _report();

  function _report(opts = {}) {
    const html = `<div style="font-family:monospace;font-size:.85em;line-height:1.4"><p><strong>Mal Voice Smoketest</strong></p>${lines.map(l => `<div>${_esc(l)}</div>`).join("")}</div>`;
    ChatMessage.create({ content: html, whisper: [game.user.id] });
    if (!opts.keepOpen) {
      const summary = lines.filter(l => l.startsWith("❌")).length === 0
        ? "Mal Voice smoketest passed."
        : "Mal Voice smoketest had failures — see chat.";
      ui.notifications.info(summary);
    }
  }
  function _esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
})();
