/* reset-console.macro.js — 🔄 Bad Eden Reset Console (2026-07-14)
 *
 * GM playtest tool: re-arm fired beats, reset quests, reset the world.
 * One window, four sections — everything shows LIVE state and nothing
 * writes until you click that section's Apply button.
 *
 *  🎬 Beats    — re-arm fired story moments (director fire marks, dialogue
 *                consumption, injector once-per-hex/cooldown/decline gates,
 *                per-beat quest progress marks) so they can fire again.
 *  🗺 Quests   — move quests between coalition buckets (restart fresh /
 *                active / completed / archived / remove from log), fanned
 *                out identically to every coalition faction + registry sync.
 *  🌍 World    — turn number, time spent, ledger entries, director pressure
 *                + level floors, wendigo/bandit/cadence meters, and (opt-in)
 *                📰 un-printing The Turn Press's per-turn editions.
 *  🗣 Dialogue — per-NPC: clear conversation history, clear memories,
 *                re-arm spent secrets.
 *  🧨 Full campaign reset — all of the above back to a fresh world
 *                (double-confirmed; auto-snapshots first).
 *
 * SAFE BY DESIGN: 📸 snapshot button uses the GM World Interface snapshot
 * (worldState + faction flags + current-scene hex flags — faction flags
 * include the quest track, so a rollback restores quest state too).
 * NEVER touched: campaign/beat definitions, quest definitions, personas
 * (except spent-secret marks), hex flags, NPC actors, the NPC common-
 * knowledge gazetteer, and The Turn Press's authored Opening edition.
 */
(async () => {
  const NS  = "bbttcc-campaign";
  const MAL = "bbttcc-mal-voice";
  const FAC = "bbttcc-factions";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const api   = game.bbttcc?.api?.campaign;
  const world = game.bbttcc?.api?.world;
  const clone = (o) => foundry.utils.deepClone(o);
  const esc   = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ── load live state ───────────────────────────────────────────────────────
  const campaignId = api?.getActiveCampaignId?.();
  let campsRaw = game.settings.get(NS, "campaigns");
  const camps = typeof campsRaw === "string" ? JSON.parse(campsRaw) : (campsRaw || {});
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error("No active campaign found.");
  const beats = Array.isArray(camp.beats) ? camp.beats : [];
  const beatById = new Map(beats.map(b => [String(b?.id || ""), b]));

  const getSetting = (k, d) => { try { const v = game.settings.get(NS, k); return v ?? d; } catch (_e) { return d; } };
  let dstate = clone(getSetting("directorState", {})) || {};
  dstate.firedStoryBeats ||= {}; dstate.dialogueFired ||= {}; dstate.invited ||= {}; dstate.levelPrompts ||= {};
  let istate = clone(getSetting("injectState", {})) || {};
  let questsReg = clone(getSetting("quests", {})) || {};

  // Coalition factions (campaign.factionIds are UUIDs; primary factionId folded in).
  const factionRefs = [...(Array.isArray(camp.factionIds) ? camp.factionIds : []), ...(camp.factionId ? [camp.factionId] : [])];
  const factions = [];
  const seenF = new Set();
  for (const ref of factionRefs) {
    let a = null;
    try { a = String(ref).includes(".") ? await fromUuid(String(ref)) : game.actors.get(String(ref)); } catch (_e) {}
    if (a?.documentName === "Actor" && !seenF.has(a.id)) { seenF.add(a.id); factions.push(a); }
  }
  const track = factions[0]?.getFlag(FAC, "quests") || { active: {}, completed: {}, archived: {} };
  const BUCKETS = ["active", "completed", "archived"];

  // ── fired-beat inventory ──────────────────────────────────────────────────
  // A beat counts as "fired" if it has a director fire mark, a dialogue
  // consumption mark, or any injector gate key (once-per-hex / cooldown /
  // hex-decline naming it). Union them so nothing consumed stays hidden.
  const injectBeatIds = new Set();
  for (const [k, v] of Object.entries(istate)) {
    const m = k.match(/^[^:]*:(.+?):(?:cooldown$|[^:]+$)/);
    if (m && beatById.has(m[1])) injectBeatIds.add(m[1]);
    if (v && typeof v === "object" && v.beatId && beatById.has(String(v.beatId))) injectBeatIds.add(String(v.beatId));
  }
  const firedIds = [...new Set([
    ...Object.keys(dstate.firedStoryBeats),
    ...Object.keys(dstate.dialogueFired),
    ...injectBeatIds
  ])].filter(id => beatById.has(id));
  firedIds.sort((a, b) => String(beatById.get(a)?.label || a).localeCompare(String(beatById.get(b)?.label || b)));

  const firedSourcesOf = (id) => {
    const src = [];
    if (dstate.firedStoryBeats[id]) src.push(`director${dstate.firedStoryBeats[id]?.turn ? ` T${dstate.firedStoryBeats[id].turn}` : ""}`);
    if (dstate.dialogueFired[id]) src.push("dialogue");
    if (injectBeatIds.has(id)) src.push("injector");
    return src.join(" · ");
  };

  // ── dialogue-layer inventory ──────────────────────────────────────────────
  // TWO stores: world actors, and UNLINKED tokens — talking to an unlinked
  // token saves history into its actor-delta, which game.actors never sees
  // (that's how Pike went missing, 2026-07-15). Token rows only count the
  // delta's OWN state: inherited base-actor flags clear via the world row.
  const malCounts = (f) => ({
    msgs:  Array.isArray(f?.dialogue?.messages) ? f.dialogue.messages.length : 0,
    mems:  Array.isArray(f?.memories) ? f.memories.length : 0,
    spent: Object.keys(f?.persona?.secretsUsed || {}).length,
  });
  const npcRows = [];
  for (const a of (game.actors?.contents || [])) {
    const f = a.flags?.[MAL];
    if (!f) continue;
    const n = malCounts(f);
    if (!n.msgs && !n.mems && !n.spent) continue;
    npcRows.push({ uuid: a.uuid, name: a.name, where: "", ...n });
  }
  for (const scene of (game.scenes?.contents || [])) {
    for (const t of (scene.tokens?.contents || [])) {
      if (t.actorLink) continue;                     // linked → the world-actor row covers it
      const f = t.delta?.flags?.[MAL];               // the token's own state only
      if (!f) continue;
      const n = malCounts(f);
      if (!n.msgs && !n.mems && !n.spent) continue;
      npcRows.push({ uuid: t.uuid, name: t.name || t.actor?.name || "(token)", where: ` · token @ ${scene.name}`, ...n });
    }
  }
  npcRows.sort((a, b) => a.name.localeCompare(b.name));

  // ── quest inventory ───────────────────────────────────────────────────────
  const bucketOf = (qid) => BUCKETS.find(bk => track?.[bk]?.[qid]) || null;
  const questRows = Object.entries(questsReg).map(([qid, q]) => {
    const bk = bucketOf(qid);
    const entry = bk ? track[bk][qid] : null;
    const marks = Object.keys(entry?.progress?.beats || {}).length;
    return { qid, name: String(q?.name || qid), status: String(q?.status || "active"), bucket: bk || "—", marks };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ── world snapshot of current values ──────────────────────────────────────
  const wstate = world?.getState?.() || {};
  const METERS = [
    ["wendigoRung",        "Wendigo rung"],
    ["banditMercy",        "Bandit mercy"],
    ["banditFear",         "Bandit fear"],
    ["cadenceRespect",     "Cadence respect"],
    ["cadenceTribute",     "Cadence tribute"],
    ["cadenceUncontested", "Cadence uncontested"]
  ];
  const FLAGS_BOOL = [
    ["wendigoDouganPointed", "Dougan pointed (fire-once)"],
    ["banditLedgerArmed",    "Bandit ledger armed"]
  ];

  // ── write helpers ─────────────────────────────────────────────────────────
  async function writeDirector() { await game.settings.set(NS, "directorState", dstate); }
  async function writeInject()   { await game.settings.set(NS, "injectState", istate); }
  async function writeQuestsReg(){ await game.settings.set(NS, "quests", questsReg); }

  // setFlag deep-merges — deletions inside the object would silently survive.
  // Full unset + rewrite is the v14-clean way (never "-=key"; see memory
  // reference_v14_flag_deletion_syntax).
  async function replaceFlag(actor, scope, key, value) {
    try { await actor.unsetFlag(scope, key); } catch (_e) {}
    if (value !== undefined) await actor.setFlag(scope, key, value);
  }

  async function fanOutTrack(mutator) {
    for (const f of factions) {
      const cur = clone(f.getFlag(FAC, "quests") || {}) || {};
      cur.schemaVersion ||= 1; cur.active ||= {}; cur.completed ||= {}; cur.archived ||= {};
      mutator(cur);
      await replaceFlag(f, FAC, "quests", cur);
      try { if (f.sheet?.rendered) f.sheet.render(false); } catch (_e) {}
    }
  }

  function freshQuestEntry(qid) {
    const ts = Date.now();
    return { v: 1, questId: qid, status: "active", acceptedTs: ts, lastTouchedTs: ts, notes: "",
             progress: { beats: {} }, history: [{ ts, type: "accept", by: game.user.id }] };
  }

  async function reArmBeats(ids) {
    if (!ids.length) return 0;
    const idSet = new Set(ids);
    for (const id of ids) {
      delete dstate.firedStoryBeats[id];
      delete dstate.dialogueFired[id];
      delete dstate.invited[id];
    }
    for (const [k, v] of Object.entries(istate)) {
      const m = k.match(/^[^:]*:(.+?):(?:cooldown$|[^:]+$)/);
      if ((m && idSet.has(m[1])) || (v && typeof v === "object" && idSet.has(String(v.beatId || "")))) delete istate[k];
    }
    await writeDirector();
    await writeInject();
    // Per-beat quest progress marks (seen/completed) — every bucket, every faction.
    await fanOutTrack(cur => {
      for (const bk of BUCKETS) for (const entry of Object.values(cur[bk] || {})) {
        const pb = entry?.progress?.beats;
        if (pb) for (const id of ids) delete pb[id];
      }
    });
    return ids.length;
  }

  async function snapshot(label) {
    if (!world?.createSnapshot) return ui.notifications.warn("World API not available — no snapshot taken.");
    const r = await world.createSnapshot({ label, note: "Reset Console" });
    ui.notifications.info(`📸 Snapshot taken (${r?.count ?? "?"} stored).`);
    return r;
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const beatRowsHtml = firedIds.map(id => {
    const b = beatById.get(id);
    return `<label class="rc-row" data-text="${esc(`${b.label || ""} ${id} ${b.questId || ""}`.toLowerCase())}" style="display:flex;gap:6px;align-items:baseline;padding:2px 4px;">
      <input type="checkbox" class="rc-beat" value="${esc(id)}">
      <span style="flex:1;"><b>${esc(b.label || id)}</b> <code style="font-size:.75em;opacity:.6;">${esc(id)}</code>${b.questId ? ` <span style="opacity:.6;font-size:.8em;">⛩ ${esc(b.questId)}</span>` : ""}</span>
      <span style="opacity:.55;font-size:.78em;white-space:nowrap;">${esc(firedSourcesOf(id))}</span>
    </label>`;
  }).join("") || `<p style="opacity:.6;margin:.3em;">No fired beats — everything is armed.</p>`;

  const questRowsHtml = questRows.map(q => `
    <div class="rc-row" style="display:flex;gap:8px;align-items:center;padding:2px 4px;">
      <span style="flex:1;"><b>${esc(q.name)}</b> <code style="font-size:.75em;opacity:.6;">${esc(q.qid)}</code><br>
        <span style="font-size:.78em;opacity:.6;">registry: ${esc(q.status)} · coalition: ${esc(q.bucket)}${q.marks ? ` · ${q.marks} beat mark${q.marks === 1 ? "" : "s"}` : ""}</span></span>
      <select class="rc-quest" data-qid="${esc(q.qid)}" style="width:170px;">
        <option value="">— leave as is —</option>
        <option value="restart">↺ restart (active, fresh)</option>
        <option value="active">▶ active (keep progress)</option>
        <option value="completed">✔ completed</option>
        <option value="archived">🗄 archived</option>
        <option value="remove">✖ remove from log</option>
      </select>
    </div>`).join("") || `<p style="opacity:.6;margin:.3em;">No quests in the registry.</p>`;

  const npcRowsHtml = npcRows.map(n => `
    <label class="rc-row" style="display:flex;gap:6px;align-items:baseline;padding:2px 4px;">
      <input type="checkbox" class="rc-npc" value="${esc(n.uuid)}">
      <span style="flex:1;"><b>${esc(n.name)}</b><span style="opacity:.55;font-size:.78em;">${esc(n.where)}</span></span>
      <span style="opacity:.6;font-size:.78em;white-space:nowrap;">${n.msgs} msg · ${n.mems} mem · ${n.spent} spent secret${n.spent === 1 ? "" : "s"}</span>
    </label>`).join("") || `<p style="opacity:.6;margin:.3em;">No NPCs carry dialogue state.</p>`;

  const meterInputs = METERS.map(([k, lbl]) =>
    `<label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">${esc(lbl)}
       <input type="number" class="rc-meter" data-key="${esc(k)}" value="${Number(getSetting(k, 0)) || 0}" style="width:70px;"></label>`).join("");
  const boolInputs = FLAGS_BOOL.map(([k, lbl]) =>
    `<label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">${esc(lbl)}
       <input type="checkbox" class="rc-bool" data-key="${esc(k)}" ${getSetting(k, false) ? "checked" : ""}></label>`).join("");

  const sect = (title, inner, open = false) => `
    <details ${open ? "open" : ""} style="border:1px solid #b8974d44;border-radius:6px;margin:6px 0;padding:4px 8px;">
      <summary style="cursor:pointer;font-weight:bold;color:#b8974d;">${title}</summary>
      <div style="padding:6px 2px;">${inner}</div>
    </details>`;

  const content = `
  <div class="bbttcc-reset-console" style="font-size:.9em;">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
      <span style="flex:1;opacity:.75;">Campaign <b>${esc(camp.name || campaignId)}</b> · Turn <b>${Number(wstate.turn) || 0}</b> · ${firedIds.length} fired beat(s) · coalition ${factions.length} faction(s)</span>
      <button type="button" class="rc-snapshot" style="width:auto;">📸 Snapshot first</button>
    </div>

    ${sect(`🎬 Beats — re-arm fired story moments (${firedIds.length})`, `
      <input type="text" class="rc-beat-filter" placeholder="filter…" style="width:100%;margin-bottom:4px;">
      <div class="rc-beat-list" style="max-height:200px;overflow:auto;border:1px solid #0003;border-radius:4px;">${beatRowsHtml}</div>
      <div style="display:flex;gap:6px;margin-top:5px;">
        <button type="button" class="rc-beats-selected" style="width:auto;">↺ Re-arm selected</button>
        <button type="button" class="rc-beats-all" style="width:auto;">↺↺ Re-arm ALL fired beats</button>
      </div>`, true)}

    ${sect(`🗺 Quests — coalition log + registry (${questRows.length})`, `
      <div style="max-height:220px;overflow:auto;border:1px solid #0003;border-radius:4px;">${questRowsHtml}</div>
      <div style="display:flex;gap:6px;margin-top:5px;align-items:center;">
        <button type="button" class="rc-quests-apply" style="width:auto;">Apply quest changes</button>
        <span style="opacity:.6;font-size:.8em;">restart also clears that quest's beat marks; all writes fan out to every coalition faction.</span>
      </div>`)}

    ${sect(`🌍 World — turn, time, director, meters`, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;">
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">World turn
          <input type="number" class="rc-world" data-key="turn" value="${Number(wstate.turn) || 0}" style="width:70px;"></label>
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">Story phase (act 0–6)
          <input type="number" min="0" max="6" class="rc-meter" data-key="storyPhase" value="${Number(getSetting("storyPhase", 0)) || 0}" style="width:70px;"></label>
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">Days spent this turn
          <input type="number" step="0.1" class="rc-world" data-key="timeProgress" value="${Number(wstate.time?.progress) || 0}" style="width:70px;"></label>
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">Director pressure
          <input type="number" class="rc-world" data-key="pressure" value="${Number(dstate.pressure) || 0}" style="width:70px;"></label>
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">Last story turn
          <input type="number" class="rc-world" data-key="lastStoryTurn" value="${Number(dstate.lastStoryTurn) || 0}" style="width:70px;"></label>
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">Steward level floor
          <input type="number" class="rc-world" data-key="stewardLevelFloor" value="${Number(dstate.stewardLevelFloor) || 0}" style="width:70px;"></label>
        <label style="display:flex;justify-content:space-between;gap:8px;align-items:center;">Faction tier floor
          <input type="number" class="rc-world" data-key="factionTierFloor" value="${Number(dstate.factionTierFloor) || 0}" style="width:70px;"></label>
        ${meterInputs}
        ${boolInputs}
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;align-items:center;">
        <button type="button" class="rc-world-apply" style="width:auto;">Apply world changes</button>
        <label style="font-size:.85em;opacity:.8;"><input type="checkbox" class="rc-clear-ledger"> also clear this turn's ledger entries</label>
        <label style="font-size:.85em;opacity:.8;"><input type="checkbox" class="rc-clear-press"> 📰 also un-print The Turn Press editions</label>
      </div>
      <p style="opacity:.55;font-size:.78em;margin:.4em 0 0;">Level floors are normally monotonic — lowering them only matters for a true replay (already-raised stewards/factions are NOT demoted).</p>`)}

    ${sect(`🗣 Dialogue — NPC conversations, memories, secrets (${npcRows.length})`, `
      <label style="font-size:.85em;"><input type="checkbox" class="rc-npc-all"> select all</label>
      <div style="max-height:180px;overflow:auto;border:1px solid #0003;border-radius:4px;">${npcRowsHtml}</div>
      <div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;">
        <button type="button" class="rc-npc-convos" style="width:auto;">🧽 Clear conversations</button>
        <button type="button" class="rc-npc-mems" style="width:auto;">🧠 Clear memories</button>
        <button type="button" class="rc-npc-secrets" style="width:auto;">🗝 Re-arm spent secrets</button>
      </div>`)}

    ${sect(`🧨 Full campaign reset`, `
      <p style="font-size:.85em;opacity:.85;">Everything above at once, back to a fresh world: all beats re-armed, quest log emptied (registry kept, statuses → active), turn → 1, time/pressure/meters → 0, ledger cleared, all NPC dialogue state wiped. Definitions (campaign, beats, quests, personas) and hexes are untouched. Auto-snapshots first.</p>
      <button type="button" class="rc-nuke" style="width:auto;border-color:#a33;color:#c55;">🧨 Reset the world</button>`)}

    <div class="rc-status" style="margin-top:6px;font-size:.82em;opacity:.8;min-height:1.2em;"></div>
  </div>`;

  new Dialog({
    title: "🔄 Bad Eden Reset Console",
    content,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      const root = html[0] ?? html;
      const status = root.querySelector(".rc-status");
      const say = (msg) => { status.innerHTML = `${new Date().toLocaleTimeString()} — ${msg}<br>` + status.innerHTML; };
      const busyWrap = (btn, fn) => async () => {
        btn.disabled = true;
        try { await fn(); } catch (e) { console.error("[reset-console]", e); say(`⚠ ${esc(e?.message || e)}`); }
        btn.disabled = false;
      };

      root.querySelector(".rc-snapshot").addEventListener("click", busyWrap(root.querySelector(".rc-snapshot"), async () => {
        await snapshot("Before Reset Console");
        say("📸 snapshot stored (GM World Interface → snapshots).");
      }));

      // 🎬 Beats
      root.querySelector(".rc-beat-filter").addEventListener("input", (ev) => {
        const q = String(ev.target.value || "").toLowerCase().trim();
        for (const row of root.querySelectorAll(".rc-beat-list .rc-row"))
          row.style.display = !q || row.dataset.text.includes(q) ? "" : "none";
      });
      const doReArm = async (ids) => {
        if (!ids.length) return say("no beats selected.");
        const n = await reArmBeats(ids);
        for (const cb of root.querySelectorAll(".rc-beat")) if (ids.includes(cb.value)) cb.closest(".rc-row").remove();
        say(`↺ re-armed ${n} beat(s) — director marks, dialogue consumption, injector gates, and quest beat-marks cleared.`);
        ui.notifications.info(`Re-armed ${n} beat(s).`);
      };
      const selBtn = root.querySelector(".rc-beats-selected");
      selBtn.addEventListener("click", busyWrap(selBtn, async () =>
        doReArm([...root.querySelectorAll(".rc-beat:checked")].map(cb => cb.value))));
      const allBtn = root.querySelector(".rc-beats-all");
      allBtn.addEventListener("click", busyWrap(allBtn, async () => {
        const ids = [...root.querySelectorAll(".rc-beat")].map(cb => cb.value);
        if (!ids.length) return say("nothing to re-arm.");
        if (!await Dialog.confirm({ title: "Re-arm ALL fired beats?", content: `<p>Re-arm <b>${ids.length}</b> fired beats? They become offerable again wherever their gates allow.</p>` })) return;
        await doReArm(ids);
      }));

      // 🗺 Quests
      const qBtn = root.querySelector(".rc-quests-apply");
      qBtn.addEventListener("click", busyWrap(qBtn, async () => {
        const ops = [...root.querySelectorAll(".rc-quest")].map(s => ({ qid: s.dataset.qid, op: s.value })).filter(o => o.op);
        if (!ops.length) return say("no quest changes chosen.");
        await fanOutTrack(cur => {
          for (const { qid, op } of ops) {
            let entry = null;
            for (const bk of BUCKETS) { if (cur[bk][qid]) { entry = cur[bk][qid]; delete cur[bk][qid]; } }
            if (op === "remove") continue;
            if (op === "restart" || !entry) entry = freshQuestEntry(qid);
            entry.status = op === "restart" ? "active" : op;
            entry.lastTouchedTs = Date.now();
            (entry.history ||= []).push({ ts: Date.now(), type: `reset-console:${op}`, by: game.user.id });
            const bucket = op === "restart" ? "active" : op;
            cur[bucket][qid] = entry;
          }
        });
        for (const { qid, op } of ops) {
          if (questsReg[qid] && op !== "remove")
            questsReg[qid].status = (op === "restart" || op === "active") ? "active" : op;
        }
        await writeQuestsReg();
        for (const s of root.querySelectorAll(".rc-quest")) s.value = "";
        say(`🗺 applied ${ops.length} quest change(s) across ${factions.length} faction(s): ${ops.map(o => `${o.qid}→${o.op}`).join(", ")}`);
        ui.notifications.info(`Quest log updated (${ops.length} change(s)).`);
      }));

      // 🌍 World
      const wBtn = root.querySelector(".rc-world-apply");
      wBtn.addEventListener("click", busyWrap(wBtn, async () => {
        const val = (key) => Number(root.querySelector(`.rc-world[data-key="${key}"]`)?.value) || 0;
        const changed = [];
        if (world?.applyGMEdit && val("turn") !== (Number(world.getState()?.turn) || 0)) {
          await world.applyGMEdit({ turn: val("turn") }, { note: "Reset Console" });
          changed.push(`turn→${val("turn")}`);
        }
        if (world?.getState && world?.setState) {
          const s = world.getState();
          if ((Number(s.time?.progress) || 0) !== val("timeProgress")) {
            const next = clone(s); next.time.progress = val("timeProgress");
            await world.setState(next); changed.push(`days→${val("timeProgress")}`);
          }
        }
        dstate.pressure = Math.max(0, val("pressure"));
        dstate.lastStoryTurn = val("lastStoryTurn");
        dstate.stewardLevelFloor = val("stewardLevelFloor");
        dstate.factionTierFloor = val("factionTierFloor");
        await writeDirector(); changed.push("director");
        for (const inp of root.querySelectorAll(".rc-meter")) {
          try { await game.settings.set(NS, inp.dataset.key, Number(inp.value) || 0); }
          catch (e) { say(`⚠ meter ${esc(inp.dataset.key)}: ${esc(e?.message || e)}`); }
        }
        for (const inp of root.querySelectorAll(".rc-bool")) {
          try { await game.settings.set(NS, inp.dataset.key, !!inp.checked); }
          catch (e) { say(`⚠ flag ${esc(inp.dataset.key)}: ${esc(e?.message || e)}`); }
        }
        changed.push("meters");
        if (root.querySelector(".rc-clear-ledger")?.checked) {
          try { await game.settings.set(NS, "ledgerEntries", []); changed.push("ledger cleared"); } catch (_e) {}
        }
        // 📰 Rewinding the turn without this leaves NPCs quoting news from a
        // future that no longer happened. Opening edition + hand-written
        // pages survive.
        if (root.querySelector(".rc-clear-press")?.checked) {
          try {
            const r = await game.bbttcc?.api?.campaign?.digest?.clear?.();
            if (r?.ok) changed.push(`press un-printed (${r.removed})`);
            else say("⚠ Turn Press clear unavailable (digest API missing).");
          } catch (e) { say(`⚠ press clear: ${esc(e?.message || e)}`); }
        }
        try { await game.settings.set(NS, "lastTurnAnnounced", val("turn")); } catch (_e) {}
        say(`🌍 world applied: ${changed.join(", ")}`);
        ui.notifications.info("World state applied.");
      }));

      // 🗣 Dialogue
      root.querySelector(".rc-npc-all")?.addEventListener("change", (ev) => {
        for (const cb of root.querySelectorAll(".rc-npc")) cb.checked = ev.target.checked;
      });
      // Rows carry uuids: "Actor.X" for world actors, "Scene.X.Token.Y" for
      // unlinked tokens (their delta is its own dialogue store) — resolve to
      // the actor the dialogue window actually wrote to.
      const resolveNpc = async (ref) => {
        let d = null; try { d = await fromUuid(String(ref)); } catch (_e) {}
        if (d?.documentName === "Token") d = d.actor;
        return d?.documentName === "Actor" ? d : null;
      };
      const npcSel = async () => {
        const out = [];
        for (const cb of root.querySelectorAll(".rc-npc:checked")) {
          const a = await resolveNpc(cb.value);
          if (a) out.push(a);
        }
        return out;
      };
      const npcOp = (btn, label, fn) => btn.addEventListener("click", busyWrap(btn, async () => {
        const actors = await npcSel();
        if (!actors.length) return say("no NPCs selected.");
        for (const a of actors) await fn(a);
        say(`🗣 ${label}: ${actors.map(a => esc(a.name)).join(", ")}`);
        ui.notifications.info(`${label} (${actors.length}).`);
      }));
      npcOp(root.querySelector(".rc-npc-convos"), "conversations cleared", async (a) => { try { await a.unsetFlag(MAL, "dialogue"); } catch (_e) {} });
      npcOp(root.querySelector(".rc-npc-mems"), "memories cleared", async (a) => { try { await a.unsetFlag(MAL, "memories"); } catch (_e) {} });
      npcOp(root.querySelector(".rc-npc-secrets"), "secrets re-armed", async (a) => {
        const persona = clone(a.getFlag(MAL, "persona") || {});
        if (!Object.keys(persona.secretsUsed || {}).length) return;
        persona.secretsUsed = {};
        await replaceFlag(a, MAL, "persona", persona);
      });

      // 🧨 Full reset
      const nukeBtn = root.querySelector(".rc-nuke");
      nukeBtn.addEventListener("click", busyWrap(nukeBtn, async () => {
        if (!await Dialog.confirm({ title: "🧨 Reset the world?", content: `<p>Re-arm <b>every</b> beat, empty the quest log, reset turn/time/meters, wipe all NPC dialogue state, and un-print The Turn Press?</p><p><b>A snapshot is taken first.</b> Definitions, hexes, and the Press's authored Opening edition are untouched.</p>` })) return;
        if (!await Dialog.confirm({ title: "Really?", content: `<p>Second confirmation — this rewinds the whole campaign's runtime state to Turn 1.</p>` })) return;
        await snapshot("Before FULL reset");
        // beats + director + injector
        dstate = { firedStoryBeats: {}, dialogueFired: {}, invited: {}, levelPrompts: {}, lastStoryTurn: 0, stewardLevelFloor: 0, factionTierFloor: 0, pressure: 0 };
        istate = {};
        await writeDirector(); await writeInject();
        // quest log + registry statuses
        await fanOutTrack(cur => { cur.active = {}; cur.completed = {}; cur.archived = {}; });
        for (const q of Object.values(questsReg)) if (q && typeof q === "object") q.status = "active";
        await writeQuestsReg();
        // world + meters + ledger
        if (world?.applyGMEdit) await world.applyGMEdit({ turn: 1 }, { note: "Reset Console — full reset" });
        if (world?.getState && world?.setState) { const s = clone(world.getState()); s.time.progress = 0; await world.setState(s); }
        for (const [k] of [...METERS]) { try { await game.settings.set(NS, k, 0); } catch (_e) {} }
        for (const [k] of [...FLAGS_BOOL]) { try { await game.settings.set(NS, k, false); } catch (_e) {} }
        try { await game.settings.set(NS, "ledgerEntries", []); } catch (_e) {}
        try { await game.settings.set(NS, "lastTurnAnnounced", 0); } catch (_e) {}
        // 📰 The Turn Press — un-print every turn edition, so the world's
        // NPCs stop knowing things that no longer happened. The authored
        // Opening edition and hand-written pages survive by design.
        let pressCleared = 0;
        try {
          const r = await game.bbttcc?.api?.campaign?.digest?.clear?.();
          if (r?.ok) pressCleared = r.removed || 0;
        } catch (_e) {}
        // NPC dialogue layer (world actors AND unlinked-token deltas)
        for (const n of npcRows) {
          const a = await resolveNpc(n.uuid);
          if (!a) continue;
          try { await a.unsetFlag(MAL, "dialogue"); } catch (_e) {}
          try { await a.unsetFlag(MAL, "memories"); } catch (_e) {}
          const persona = clone(a.getFlag(MAL, "persona") || {});
          if (Object.keys(persona.secretsUsed || {}).length) { persona.secretsUsed = {}; await replaceFlag(a, MAL, "persona", persona); }
        }
        say(`🧨 FULL RESET complete — ${firedIds.length} beats re-armed, quest log emptied, turn → 1, ${npcRows.length} NPC(s) wiped, ${pressCleared} press edition(s) un-printed. Close and reopen the console to see fresh state.`);
        ui.notifications.info("🧨 World reset to Turn 1. Reopen the console for fresh state.");
      }));
    }
  }, { width: 720, resizable: true }).render(true);
})();
