// steward-gauntlet-runner.macro.js — RUN IN-WORLD (GM), ON THE GAUNTLET ARENA
// SCENE. Phase 3: THE RUNNER. Requires the Foundry roster (run
// steward-gauntlet-foundry first) and the GAUNTLET ARENA as the active scene.
// ─────────────────────────────────────────────────────────────────────────────
// Steps every GAUNTLET · steward through their entire surface:
//   · every actionable feat  → dispatchFeatureAction
//   · every weapon           → ftOpenEngageDialog (auto-piloted)
//   · every power            → ftOpenCastDialog   (auto-piloted)
//   · one faculty test + one Surge spend dialog
// under a DIALOG AUTOPILOT that clicks every dialog's default button, auto-
// confirms, and auto-places area templates onto the Sponge. Action economy is
// reset before every fire; Soma Break runs between actors; the Sponge's pools
// and effects reset between actors.
//
// CAPTURES per fire: thrown errors, console.error/warn output, and a
// did-anything-happen heuristic (chat delta). Emits console tables + a JSON
// fail-list (auto-downloaded) for the fix sprint.
//
// ⚠ GM client only. Expect a noisy chat log — that's the point. The autopilot
// restores all patches in finally, even on a crash.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  if (game.scenes.current?.name !== "GAUNTLET ARENA") {
    return ui.notifications.warn("Activate the GAUNTLET ARENA scene first (build it with steward-gauntlet-foundry).");
  }
  const ONLY_ACTOR = "";        // set to a GAUNTLET actor name to test just one
  const FIRE_TIMEOUT_MS = 4000; // per-ability ceiling before force-closing dialogs
  const t0 = performance.now();
  const CA = game.fourththing?._classAutomation ?? {};
  const results = [];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // Cross-version targeting (v14 removed User#updateTokenTargets).
  const setTargets = (toks) => {
    try {
      if (typeof canvas?.tokens?.setTargets === "function") return canvas.tokens.setTargets(toks, { mode: "replace" });
      if (typeof game.user?.updateTokenTargets === "function") return game.user.updateTokenTargets(toks.map(t => t.id));
      for (const t of Array.from(game.user?.targets ?? [])) t.setTarget?.(false, { user: game.user, releaseOthers: false, groupSelection: true });
      for (const t of toks) t.setTarget?.(true, { user: game.user, releaseOthers: false, groupSelection: true });
    } catch (_e) {}
  };

  const roster = game.actors.filter(a => a.name.startsWith("GAUNTLET ·")
    && !["GAUNTLET · Sponge", "GAUNTLET · Ally"].includes(a.name)
    && (!ONLY_ACTOR || a.name === ONLY_ACTOR));
  const sponge = game.actors.getName("GAUNTLET · Sponge");
  const spongeTok = canvas.tokens.placeables.find(t => t.actor?.id === sponge?.id);
  if (!roster.length || !spongeTok) return ui.notifications.warn("Roster or Sponge token missing — run the foundry first.");

  // ── Dialog autopilot ───────────────────────────────────────────────────────
  const origRender  = Dialog.prototype.render;
  const origConfirm = Dialog.confirm;
  const origPrompt  = Dialog.prompt;
  let templateClicker = null;
  const installAutopilot = () => {
    Dialog.prototype.render = function (...args) {
      // Click the default button (or the first) against an off-DOM render of
      // the dialog's own content, then never show the window.
      try {
        const html = $(`<div>${this.data.content ?? ""}</div>`);
        const keys = Object.keys(this.data.buttons ?? {});
        const key  = (this.data.default && this.data.buttons?.[this.data.default]) ? this.data.default : keys[0];
        const btn  = key ? this.data.buttons[key] : null;
        setTimeout(() => {
          try { btn?.callback?.(html); } catch (e) { console.warn("[runner] autopilot button threw", e); }
          try { this.data.close?.(html); } catch (_e) {}
        }, 10);
      } catch (e) { console.warn("[runner] autopilot render failed", e); }
      return this;
    };
    Dialog.confirm = async () => true;
    Dialog.prompt  = async ({ callback } = {}) => { try { return callback?.($("<div></div>")); } catch (_e) { return null; } };
    // Template auto-placer: whenever a preview template appears, nudge it onto
    // the Sponge and click. (ftPlaceAreaTemplate listens on canvas.stage.)
    templateClicker = setInterval(() => {
      try {
        if (!canvas.templates?.preview?.children?.length) return;
        const pos = { x: spongeTok.center.x, y: spongeTok.center.y };
        const ev = { data: { button: 0, getLocalPosition: () => pos } };
        canvas.stage.emit("pointermove", ev);
        canvas.stage.emit("mousedown", ev);
      } catch (_e) {}
    }, 120);
  };
  const removeAutopilot = () => {
    Dialog.prototype.render = origRender;
    Dialog.confirm = origConfirm;
    Dialog.prompt  = origPrompt;
    if (templateClicker) clearInterval(templateClicker);
  };
  const forceCloseDialogs = () => {
    for (const w of Object.values(ui.windows)) {
      if (w instanceof Dialog) { try { w.close({ force: true }); } catch (_e) {} }
    }
  };

  // ── Error capture ──────────────────────────────────────────────────────────
  let captured = [];
  const origErr = console.error, origWarn = console.warn;
  const installCapture = () => {
    console.error = (...a) => { captured.push("ERR: " + a.map(String).join(" ").slice(0, 300)); origErr(...a); };
    console.warn  = (...a) => { const s = a.map(String).join(" "); if (/error|failed|exception/i.test(s)) captured.push("WARN: " + s.slice(0, 300)); origWarn(...a); };
  };
  const removeCapture = () => { console.error = origErr; console.warn = origWarn; };

  // ── One fire, instrumented ─────────────────────────────────────────────────
  const fire = async (actor, label, kind, fn) => {
    captured = [];
    const chatBefore = game.messages.size;
    // fresh economy + a target every time
    try {
      await actor.update({ "system.actions.actionUsed": false, "system.actions.bonusUsed": false, "system.actions.reactionUsed": false });
    } catch (_e) {}
    setTargets([spongeTok]);
    let error = null;
    try {
      await Promise.race([
        Promise.resolve(fn()),
        sleep(FIRE_TIMEOUT_MS).then(() => { forceCloseDialogs(); throw new Error(`timeout ${FIRE_TIMEOUT_MS}ms (dialog stuck?)`); })
      ]);
    } catch (e) { error = String(e?.message ?? e).slice(0, 300); }
    await sleep(60); // let async hooks settle
    const chatDelta = game.messages.size - chatBefore;
    const row = { actor: actor.name.replace("GAUNTLET · ", ""), item: label, kind,
      error, captured: captured.join(" | ") || null, chatDelta };
    results.push(row);
    if (error || captured.length) console.warn(`[runner] ✗ ${row.actor} · ${label}: ${error ?? ""} ${row.captured ?? ""}`);
  };

  // ── The gauntlet ───────────────────────────────────────────────────────────
  installAutopilot(); installCapture();
  ui.notifications.info(`🏟️ Gauntlet running: ${roster.length} stewards…`);
  let myTok = null;
  try {
    for (const actor of roster) {
      // drop the steward's token into the arena (abilities need an origin token)
      const td = (await actor.getTokenDocument({ x: 1500, y: 1700 })).toObject();
      const [tokDoc] = await canvas.scene.createEmbeddedDocuments("Token", [td]);
      myTok = canvas.tokens.get(tokDoc.id);
      myTok?.control({ releaseOthers: true });

      // feats with routes
      for (const it of actor.items.filter(i => ["feat", "feature"].includes(i.type))) {
        let actionable = false;
        try { actionable = CA.isActionableFeature?.(it) === true; } catch (_e) {}
        if (!actionable) continue;
        await fire(actor, it.name, "feat", () => CA.dispatchFeatureAction(actor, it));
      }
      // weapons → engage
      for (const it of actor.items.filter(i => i.type === "weapon")) {
        await fire(actor, it.name, "strike", () => game.fourththing.ftOpenEngageDialog(actor, it));
      }
      // powers → cast
      for (const it of actor.items.filter(i => i.type === "power")) {
        await fire(actor, it.name, "cast", () => game.fourththing.ftOpenCastDialog?.(actor, it)
          ?? game.fourththing.castManifestation?.(actor, it));
      }
      // one faculty test + the surge spend dialog
      await fire(actor, "Violence test", "roll", () => game.fourththing.rolls.attributeTest(actor, { attribute: "violence" }));
      await fire(actor, "Surge spend dialog", "surge", () => game.fourththing.surge?.openSpendDialog?.(actor));

      // resets between actors: steward soma break, sponge wipe, token removal
      try { await game.fourththing.actions.somaBreak(actor, { confirmed: true }); } catch (_e) {}
      try {
        const sSys = sponge.system?.system ?? sponge.system ?? {};
        await sponge.update({
          "system.derived.integrity.value": sSys.derived?.integrity?.max ?? 100,
          "system.derived.stress.value":    sSys.derived?.stress?.max ?? 50
        });
        const effIds = Array.from(sponge.effects ?? []).map(e => e.id);
        if (effIds.length) await sponge.deleteEmbeddedDocuments("ActiveEffect", effIds);
      } catch (_e) {}
      try { await canvas.scene.deleteEmbeddedDocuments("Token", [tokDoc.id]); } catch (_e) {}
      myTok = null;
      console.log(`[runner] ── ${actor.name} complete (${results.filter(r => r.actor === actor.name.replace("GAUNTLET · ", "")).length} fires)`);
    }
  } finally {
    removeAutopilot(); removeCapture(); forceCloseDialogs();
    if (myTok) { try { await canvas.scene.deleteEmbeddedDocuments("Token", [myTok.id]); } catch (_e) {} }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const fails  = results.filter(r => r.error || r.captured);
  const silent = results.filter(r => !r.error && !r.captured && r.chatDelta === 0);
  console.log(`\n══════ STEWARD GAUNTLET · RUNNER ══════`);
  console.log(`${roster.length} stewards · ${results.length} fires · ${fails.length} errors · ${silent.length} silent (no chat) · ${Math.round((performance.now() - t0) / 1000)}s`);
  if (fails.length)  { console.log("── ERRORS"); console.table(fails); }
  if (silent.length) { console.log("── SILENT (fired clean but produced no chat — verify by hand or allowlist)"); console.table(silent); }
  try {
    saveDataToFile(JSON.stringify({ world: game.world?.id, when: new Date().toISOString(),
      stewards: roster.length, fires: results.length, fails, silent, all: results }, null, 2),
      "application/json", `steward-gauntlet-run-${game.world?.id ?? "world"}.json`);
  } catch (_e) {}
  ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [], content:
    `<div class="fourththing-roll" style="border-color:#e8c84a"><div class="ft-roll-header"><span class="ft-roll-name">🏟️ Gauntlet Run Complete</span></div>
     <p style="margin:0.2rem 0;font-size:0.8rem">${roster.length} stewards · <b>${results.length}</b> abilities fired · <b style="color:${fails.length ? "#ff8a8a" : "#a0d8a0"}">${fails.length} errors</b> · ${silent.length} silent.</p>
     <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables in console · JSON report downloaded.</p></div>` });
})();
