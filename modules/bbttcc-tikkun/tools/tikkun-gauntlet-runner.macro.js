// tikkun-gauntlet-runner.macro.js — RUN IN-WORLD (GM), AFTER the Forge.
// ─────────────────────────────────────────────────────────────────────────────
// TIKKUN GAUNTLET · Phase 3 — THE RUNNER. Reads the Forge manifest ("TIKKUNGAUNTLET ·
// Manifest" journal) and drives the Great-Work spark lifecycle on the sandbox faction,
// ASSERTING the behaviours the system promises:
//   A. CORRUPTION CHAIN + GATE — gather each target via its MISALIGNED method (assert
//      char-spark corrupts), integrate (assert corruption persists), deposit-corrupted
//      (assert it THROWS — the guard works), then call getGreatWorkState and assert it
//      BLOCKS on corruption. ⚑ The headline probe: corrupted-only sparks must NOT make a
//      faction Great-Work-ready, and corruptedKeys must reflect the corruption.
//   B. REPAIR → DEPOSIT — repair a corrupted spark (drives openRepairRitual under a Dialog
//      autopilot; loops as DC drops per attempt), assert corruption clears, then deposit
//      and assert the THREE faction storage shapes (integrated / victory.sparks / sparks)
//      agree.
//   C. 3-SHAPE SYNC — integrateSpark ×N then revokeSpark and assert map/array/integrated
//      stay coherent at every step (the divergence smell).
//   D. RITUAL — assert darkness DC scaling math (correctness), and probe the OP-spend
//      bypass: spend Faith the bank doesn't have and assert no roll bonus is granted.
// Emits console tables + a JSON fail-list (auto-downloaded) + a GM chat card.
// ⚠ GM client only. Operates ONLY on the forged sandbox. Re-run the Forge to reset.
(async () => {
  if (!game.user.isGM) return ui.notifications.warn("GM only.");
  const t0 = performance.now();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const MOD = "bbttcc-tikkun", FCT = "bbttcc-factions";
  const api = game.bbttcc?.api?.tikkun;
  if (!api) return ui.notifications.error("game.bbttcc.api.tikkun missing.");

  // ── Manifest ──
  const journal = game.journal.getName("TIKKUNGAUNTLET · Manifest");
  const M = journal?.getFlag(MOD, "gauntletManifest");
  if (!M) return ui.notifications.error("Manifest not found — run the Forge (tikkun-gauntlet-foundry) first.");
  const faction = game.actors.get(M.factionId);
  const members = (M.memberIds || []).map(id => game.actors.get(id)).filter(Boolean);
  const targets = M.targets || [];
  if (!faction || members.length < 3 || targets.length < 3) return ui.notifications.error("Sandbox incomplete — re-run the Forge.");

  // ── Results harness ──
  const results = [];
  // ok = the system behaved CORRECTLY (no bug). ok=false ⇒ a finding (bug/unexpected).
  const rec = (section, name, ok, detail = "", level = ok ? "ok" : "BUG") => {
    results.push({ section, name, ok, detail, level });
    console.log(`[tikkun-runner] ${ok ? "✓" : "✗"} [${section}] ${name}${detail ? " — " + detail : ""}`);
  };
  const fGet = (path, d) => { try { return foundry.utils.getProperty(faction, `flags.${FCT}.${path}`) ?? d; } catch { return d; } };

  // ── V1 Dialog autopilot (for openRepairRitual) ──
  const origRender = Dialog.prototype.render;
  const installAutopilot = () => {
    Dialog.prototype.render = function () {
      try {
        const html = $(`<div>${this.data.content ?? ""}</div>`);
        const keys = Object.keys(this.data.buttons ?? {});
        const key = (this.data.default && this.data.buttons?.[this.data.default]) ? this.data.default : keys[0];
        const btn = key ? this.data.buttons[key] : null;
        setTimeout(() => { try { btn?.callback?.(html); } catch (_e) {} }, 10);
      } catch (_e) {}
      return this;
    };
  };
  const removeAutopilot = () => { Dialog.prototype.render = origRender; };

  // Helper: gather a target on a member via a chosen method, using the REAL classifier.
  async function gatherVia(member, tgt, method) {
    const item = await api.resolveSparkItem(tgt.identifier);
    const alignment = api.checkMethodAlignment(method, item);
    const corrupted = alignment === "misaligned";
    await api.gatherSparkByItem(member, item?.uuid ?? tgt.identifier, {
      corrupted, note: `gauntlet gather via ${method} (${alignment})`,
      corruptionReason: corrupted ? `Misaligned ${method}` : null
    });
    return { alignment, corrupted };
  }
  const sparkOf = (member, key) => {
    const map = api.getAllSparks(member) || {};
    return map[key] || Object.values(map).find(s => s.key === key) || null;
  };

  try {
    // ══════════════════ SECTION A · CORRUPTION CHAIN + GATE ══════════════════
    // Gather all 3 targets via their MISALIGNED method → integrate → keep corrupted.
    for (let i = 0; i < 3; i++) {
      const tgt = targets[i], member = members[i], method = tgt.misaligned[0];
      try {
        const { alignment, corrupted } = await gatherVia(member, tgt, method);
        rec("A", `gather ${tgt.sephirah} via misaligned "${method}"`, alignment === "misaligned" && corrupted,
          `alignment=${alignment} corrupted=${corrupted}`);
        await api.integrateSparkCharacter({ actorId: member.id, sparkKey: tgt.identifier });
        // re-mark corrupted (mirrors beat-listener integrate path)
        await api.markSparkPhase({ actorId: member.id, sparkKey: tgt.identifier, phase: "corrupted", note: "gauntlet" });
        const s = sparkOf(member, tgt.identifier);
        rec("A", `integrate keeps ${tgt.sephirah} corrupted`, !!(s?.integrated && s?.corrupted),
          `integrated=${s?.integrated} corrupted=${s?.corrupted}`);
      } catch (e) { rec("A", `corruption chain ${tgt.sephirah}`, false, `threw: ${e.message}`); }
    }

    // Deposit a corrupted spark → MUST throw (guard).
    try {
      await api.depositSpark({ actorId: members[1].id, sparkKey: targets[1].identifier, factionId: faction.id });
      rec("A", "deposit corrupted is refused", false, "depositSpark accepted a CORRUPTED spark (guard failed)");
    } catch (e) {
      rec("A", "deposit corrupted is refused", /corrupt/i.test(e.message), `threw: ${e.message}`);
    }

    // ⚑ GATE LEAK — 3 corrupted, integrated, NEVER-deposited sparks. Faction primed to
    // thresholds. Great Work must NOT be ready, and corruption must be visible.
    await sleep(500); // let the async bbttcc:spark:corrupted gate-sync listeners land their faction writes
    const gw = api.getGreatWorkState(faction.id, M.thresholds);
    rec("A", "Great Work blocks on corrupted sparks", gw.ready === false,
      `ready=${gw.ready} · sparkCount=${gw.sparkCount} (all from corrupted char sparks) · corruptedKeys=[${gw.corruptedKeys.join(",")}] · reasons=[${gw.reasons.join(" | ")}]`);
    rec("A", "corruptedKeys reflects member corruption", gw.corruptedKeys.length >= 3,
      `corruptedKeys=[${gw.corruptedKeys.join(",")}] (expected ≥3 from the 3 corrupted member sparks; faction tikkun.corrupted is only ever written by a FAILED final ritual)`);

    // ══════════════════ SECTION B · REPAIR → DEPOSIT ══════════════════
    // Repair target[0] on members[0] (Ritualist holds materials + soul 8). Loop as DC drops.
    installAutopilot();
    let repaired = false;
    for (let attempt = 1; attempt <= 6 && !repaired; attempt++) {
      try {
        await api.openRepairRitual({ ownerActor: members[0], sparkKey: targets[0].identifier, factionId: faction.id });
        await sleep(1300); // let the autopiloted roll + chat + writeback settle
      } catch (e) { rec("B", `repair attempt ${attempt}`, false, `threw: ${e.message}`); break; }
      const s = sparkOf(members[0], targets[0].identifier);
      if (s && !s.corrupted) repaired = true;
    }
    removeAutopilot();
    rec("B", "repair clears corruption", repaired, repaired ? `${targets[0].sephirah} repaired (corrupted=false)` : "still corrupted after 6 attempts (dice — re-run; core findings are deterministic)");

    if (repaired) {
      try {
        await api.depositSpark({ actorId: members[0].id, sparkKey: targets[0].identifier, factionId: faction.id });
        const ls = api.listSparks(faction.id) || {};
        const k = targets[0].sephirah;
        const inInteg = ls.integrated?.[k] === true;
        const inArr = (ls.array || []).some(e => String(e?.key).toLowerCase() === k && Number(e.count) >= 1);
        const inMap = Number(ls.map?.[k] || 0) >= 1;
        rec("B", "deposit clean spark succeeds", true, `deposited ${k}`);
        rec("B", "3 faction shapes agree after deposit", inInteg && inArr && inMap,
          `integrated=${inInteg} array=${inArr} map=${inMap}`);
      } catch (e) { rec("B", "deposit clean spark succeeds", false, `threw: ${e.message}`); }
    }

    // ══════════════════ SECTION C · 3-SHAPE SYNC (integrate/revoke) ══════════════════
    const SK = "gauntletsync"; // synthetic sephirah key
    const shapeState = () => {
      const ls = api.listSparks(faction.id) || {};
      return { integ: ls.integrated?.[SK] === true, arr: Number((ls.array || []).find(e => String(e?.key).toLowerCase() === SK)?.count || 0), map: Number(ls.map?.[SK] || 0) };
    };
    await api.integrateSpark({ factionId: faction.id, key: SK, count: 1 });
    await api.integrateSpark({ factionId: faction.id, key: SK, count: 1 });
    let st = shapeState();
    rec("C", "integrate ×2 → all shapes = 2", st.integ === true && st.arr === 2 && st.map === 2, `integ=${st.integ} arr=${st.arr} map=${st.map}`);
    await api.revokeSpark({ factionId: faction.id, key: SK, count: 1 });
    st = shapeState();
    rec("C", "revoke ×1 → shapes = 1, still integrated", st.integ === true && st.arr === 1 && st.map === 1, `integ=${st.integ} arr=${st.arr} map=${st.map}`);
    await api.revokeSpark({ factionId: faction.id, key: SK, count: 1 });
    st = shapeState();
    rec("C", "revoke to 0 → all shapes cleared in sync", st.integ === false && st.arr === 0 && st.map === 0, `integ=${st.integ} arr=${st.arr} map=${st.map}`);

    // ══════════════════ SECTION D · RITUAL ══════════════════
    // D1 · Darkness DC scaling (correctness): darkness 7 → round-1 DC = 15 + floor((7-3)/2) = 17.
    await faction.update({ [`flags.${FCT}.darkness`]: { global: 7 } });
    const r1 = await api.beginRitual({ factionId: faction.id, label: "Gauntlet DC Probe" });
    const s1 = await r1.step({ spendFaith: 0, spendCulture: 0, spendDiplomacy: 0, skillBonus: 0, note: "dc probe" });
    const dc1 = s1.history?.[0]?.dc;
    rec("D", "darkness 7 scales round-1 DC to 17", dc1 === 17, `round-1 dc=${dc1} (base 15 + floor((7-3)/2)=+2)`);

    // D2 · OP-spend bypass: bank has ZERO faith; spend 10 faith; assert NO bonus granted.
    await faction.update({ [`flags.${FCT}.darkness`]: { global: 0 }, [`flags.${FCT}.opBank`]: { faith: 0, softpower: 0, diplomacy: 0 } });
    const faithBefore = Number(fGet("opBank.faith", 0));
    const r2 = await api.beginRitual({ factionId: faction.id, label: "Gauntlet OP Probe" });
    const s2 = await r2.step({ spendFaith: 10, spendCulture: 0, spendDiplomacy: 0, skillBonus: 0, note: "op bypass probe" });
    const bonus = Number(s2.history?.[0]?.bonus ?? 0);
    const faithAfter = Number(fGet("opBank.faith", 0));
    rec("D", "no roll bonus from unbacked OP spend", bonus === 0,
      `bonus=${bonus} (round-1 weightFaith 2 × ceil(10/2)=5 ⇒ +10 granted despite bank faith ${faithBefore}→${faithAfter}; computeBonus reads the REQUESTED spend, adjustOpBank just floors the bank at 0)`);

  } finally {
    removeAutopilot();
  }

  // ── Report ──
  const findings = results.filter(r => !r.ok);
  const bySection = {};
  for (const r of results) { (bySection[r.section] ??= { n: 0, bug: 0 }); bySection[r.section].n++; if (!r.ok) bySection[r.section].bug++; }
  console.log(`\n══════ TIKKUN GAUNTLET · RUNNER ══════`);
  console.log(`${results.length} assertions · ${findings.length} findings · ${Math.round((performance.now() - t0) / 1000)}s`);
  console.table(Object.entries(bySection).map(([k, v]) => ({ section: k, assertions: v.n, findings: v.bug })));
  if (findings.length) { console.log("── FINDINGS (system behaved unexpectedly / confirmed bugs)"); console.table(findings); }

  try {
    saveDataToFile(JSON.stringify({ world: game.world?.id, when: new Date().toISOString(), assertions: results.length, findings: findings.length, bySection, all: results }, null, 2),
      "application/json", `tikkun-gauntlet-run-${game.world?.id ?? "world"}.json`);
  } catch (_e) {}

  ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients?.("GM")?.map(u => u.id) ?? [],
    content: `<div class="fourththing-roll" style="border-color:#9b7ae8"><div class="ft-roll-header"><span class="ft-roll-name">✦ Tikkun Gauntlet — Runner</span></div>
      <p style="margin:0.2rem 0;font-size:0.8rem"><b>${results.length}</b> assertions · <b style="color:${findings.length ? "#ff8a8a" : "#a0d8a0"}">${findings.length} findings</b>.</p>
      ${findings.length ? `<ul style="margin:0.2rem 0;padding-left:1.2rem;font-size:0.72rem">${findings.map(f => `<li><b>[${f.section}]</b> ${foundry.utils.escapeHTML(f.name)} — ${foundry.utils.escapeHTML(f.detail)}</li>`).join("")}</ul>` : `<p style="margin:0.2rem 0;font-size:0.74rem;color:#a0d8a0">All assertions held.</p>`}
      <p style="margin:0.2rem 0;font-size:0.72rem;opacity:0.6;font-style:italic">Full tables in console · JSON downloaded. Re-run the Forge to reset.</p></div>`
  });
})();
