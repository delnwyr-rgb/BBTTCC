/* mal-voice-smoketest.macro.js
 *
 * Foundry macro — paste contents into a macro slot, execute as GM.
 *
 * Smoke-tests the bbttcc-mal-voice stack (Phase 2A + 2B) end-to-end:
 *   1. Verify game.bbttcc.mal namespace + all sub-systems
 *   2. Verify the agent registry (bbttcc-raid) is reachable for snapshots
 *   3. Confirm API key + provider are configured
 *   4. Fire each registered default voice in turn — Mal, GM Advisor, Faction Advisor
 *   5. Surface each voice's reply (or any error) in a single whisper chat card
 *
 * Expected good result: three ✅ "X responded in Yms" lines and three rendered
 * voice messages (Mal broadcast / GM Advisor whisper to GM / Faction Advisor
 * whisper to faction owners). Each call is ~$0.005-0.02 — total smoketest
 * cost typically under $0.03.
 *
 * Spec: modules/bbttcc-raid/AGENT_API_SPEC.md §8 Phase 2A + 2B
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
    warn("agent registry not reachable — voices will speak without snapshot context");
  }

  // 4. Voices
  const voices = mal.voices.list();
  ok(`${voices.length} voice(s) registered: ${voices.map(v => v.id).join(", ")}`);
  for (const id of ["mal", "gm-advisor", "faction-advisor"]) {
    const v = mal.voices.get(id);
    if (v) ok(`${id} config: ${v.systemPrompt.length} chars prompt, ${v.triggers.length} triggers, audience=${v.audience}`);
    else  fail(`${id} voice config not found`);
  }

  // 5. API key + provider
  const provider = mal.settings.provider();
  const key = mal.settings.apiKey();
  const model = mal.settings.model() || "(provider default)";
  ok(`Provider: ${provider}, model: ${model}`);
  if (!key) {
    fail("No API key configured. Open Module Settings → Bad Eden Mal Voice → API key and paste your Anthropic key, then re-run.");
    _report();
    return;
  }
  ok(`API key configured (${key.length} chars)`);

  // Find a faction for Faction Advisor (and Mal/GM Advisor context).
  const factionActor = game.actors?.find(a => a.type === "faction" || a.flags?.["bbttcc-factions"]);
  const factionId = factionActor?.id || null;
  if (factionId) ok(`Test faction located: "${factionActor.name}" (${factionId.slice(0,8)}...)`);
  else          warn("No faction actor in world — Faction Advisor will fall back to GM whisper");

  // ===== 6. Fire Mal =====
  lines.push("");
  lines.push(`🎤 Firing test trigger for Mal...`);
  _report({ keepOpen: true });

  const malResult = await mal.triggers.fire("mal", {
    hook: "bbttcc:mal:test",
    args: {
      context: "Smoketest. Steward just finished a raid round with outcome greatSuccess.",
      outcome: "greatSuccess",
      raidType: "assault"
    },
    mode: "outcome",
    lengthHint: 30
  });
  if (!malResult.ok) {
    fail(`Mal fire() failed: ${malResult.error} — ${malResult.message || ""}`);
    _report(); return;
  }
  ok(`Mal responded in ${malResult.durationMs}ms (in=${malResult.inputTokens} out=${malResult.outputTokens}, $${(malResult.costUSD||0).toFixed(4)})`);
  lines.push("");
  lines.push(`💬 Mal said:`);
  lines.push(`"${malResult.text}"`);

  // ===== 7. Fire GM Advisor =====
  lines.push("");
  lines.push(`💼 Firing test trigger for GM Advisor...`);
  _report({ keepOpen: true });

  const gmResult = await mal.triggers.fire("gm-advisor", {
    hook: "bbttcc:gm-advisor:test",
    args: factionId ? { factionId } : {},
    mode: "free",
    lengthHint: 50
  });
  if (!gmResult.ok) {
    fail(`GM Advisor fire() failed: ${gmResult.error} — ${gmResult.message || ""}`);
  } else {
    ok(`GM Advisor responded in ${gmResult.durationMs}ms (in=${gmResult.inputTokens} out=${gmResult.outputTokens}, $${(gmResult.costUSD||0).toFixed(4)})`);
    lines.push("");
    lines.push(`💼 GM Advisor said:`);
    lines.push(`"${gmResult.text}"`);
  }

  // ===== 8. Fire Faction Advisor =====
  lines.push("");
  if (!factionId) {
    fail("Faction Advisor skipped — no faction actor in world to advise");
  } else {
    lines.push(`📜 Firing test trigger for Faction Advisor (faction="${factionActor.name}")...`);
    _report({ keepOpen: true });

    const facResult = await mal.triggers.fire("faction-advisor", {
      hook: "bbttcc:faction-advisor:test",
      args: { factionId },
      mode: "sheet-glance",
      lengthHint: 35
    });
    if (!facResult.ok) {
      fail(`Faction Advisor fire() failed: ${facResult.error} — ${facResult.message || ""}`);
    } else {
      ok(`Faction Advisor responded in ${facResult.durationMs}ms (in=${facResult.inputTokens} out=${facResult.outputTokens}, $${(facResult.costUSD||0).toFixed(4)})`);
      lines.push("");
      lines.push(`📜 Faction Advisor said:`);
      lines.push(`"${facResult.text}"`);
    }
  }

  _report();

  function _report(opts = {}) {
    const html = `<div style="font-family:monospace;font-size:.85em;line-height:1.4"><p><strong>Mal Voice Smoketest</strong></p>${lines.map(l => `<div>${_esc(l)}</div>`).join("")}</div>`;
    ChatMessage.create({ content: html, whisper: [game.user.id] });
    if (!opts.keepOpen) {
      const failures = lines.filter(l => l.startsWith("❌")).length;
      const summary = failures === 0
        ? "Mal Voice smoketest passed — all 3 voices responded."
        : `Mal Voice smoketest had ${failures} failure(s) — see chat.`;
      ui.notifications.info(summary);
    }
  }
  function _esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
})();
