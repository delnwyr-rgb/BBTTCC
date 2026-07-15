/* campaign-census.macro.js — regenerate the Campaign Atlas census in-world
 * (2026-07-14; button-ified version of the Turn-47 SSH extraction)
 *
 * READ-ONLY. Computes, from live world data:
 *  · VO coverage — authored beats (narrative body ≥ 40 chars) vs voiced
 *    (audio.enabled + src/playlistSoundUuid), per quest, sorted by gap
 *  · orphan beats (no questId)
 *  · hex census — devoted (on-enter beat / quest link / encounter-table
 *    whitelist) vs blank, per region scene
 *  · broken links — hex onEnterBeatId pointing at a missing beat; beat
 *    choice/outcome targets pointing at missing beats
 *  · gate + story-chain counts
 *
 * Output: console tables + a GM-whispered chat summary + a downloadable
 * JSON snapshot. Optional CHECK_AUDIO_FILES fetches each referenced audio
 * file (HEAD) to catch dead paths — slower, off by default.
 */
(async () => {
  const CHECK_AUDIO_FILES = false;      // <-- true = also verify audio files exist (~1 fetch per file)
  const NS = "bbttcc-campaign";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const strip = s => String(s || "").replace(/<[^>]+>/g, " ").trim();
  const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); // NBSP-safe (hex text uses U+00A0)

  // ── load ──────────────────────────────────────────────────────────────────
  let campsRaw = game.settings.get(NS, "campaigns");
  const camps = typeof campsRaw === "string" ? JSON.parse(campsRaw) : campsRaw;
  const campaignId = game.bbttcc?.api?.campaign?.getActiveCampaignId?.();
  const camp = camps?.[campaignId];
  if (!camp) return ui.notifications.error(`Active campaign '${campaignId}' not found.`);
  const beats = Array.isArray(camp.beats) ? camp.beats : [];
  let questsRaw = game.settings.get(NS, "quests");
  const quests = typeof questsRaw === "string" ? JSON.parse(questsRaw) : (questsRaw || {});
  let tablesRaw = game.settings.get(NS, "encounterTables");
  const tables = typeof tablesRaw === "string" ? JSON.parse(tablesRaw) : (tablesRaw || {});
  const beatIds = new Set(beats.map(b => String(b?.id)));
  const questName = qid => quests[qid]?.name || qid || "(no quest)";

  // ── VO coverage ───────────────────────────────────────────────────────────
  const hasAudio = b => !!(b?.audio?.enabled && (b.audio.src || b.audio.playlistSoundUuid));
  const authored = b => strip(b?.description).length >= 40;
  const byQuest = {};
  const silentList = [];
  let nAuthored = 0, nVoiced = 0;
  beats.forEach((b, i) => {
    const a = authored(b), v = hasAudio(b);
    if (a) nAuthored++;
    if (v) nVoiced++;
    const k = String(b?.questId || "").trim() || "(no quest)";
    byQuest[k] ??= { quest: k === "(no quest)" ? k : questName(k), authored: 0, voiced: 0, silent: 0 };
    if (a) byQuest[k].authored++;
    if (v) byQuest[k].voiced++;
    if (a && !v) { byQuest[k].silent++; silentList.push({ pos: i + 1, id: b.id, label: b.label || "", quest: byQuest[k].quest }); }
  });
  const voTable = Object.values(byQuest).filter(r => r.authored || r.voiced).sort((x, y) => y.silent - x.silent);

  // ── orphans ───────────────────────────────────────────────────────────────
  const orphans = beats.filter(b => !String(b?.questId || "").trim()).map(b => String(b.id));

  // ── broken beat links ─────────────────────────────────────────────────────
  const brokenLinks = [];
  for (const b of beats) {
    const chk = (target, kind) => {
      const t = String(target || "").trim();
      if (t && !beatIds.has(t)) brokenLinks.push({ from: b.id, kind, missing: t });
    };
    chk(b?.next, "next");
    chk(b?.outcomes?.success, "success"); chk(b?.outcomes?.failure, "failure");
    for (const c of (Array.isArray(b?.choices) ? b.choices : [])) { chk(c?.next, "choice"); chk(c?.failNext, "choice_fail"); }
  }

  // ── gates + chains + Phase Charter lint ──────────────────────────────────
  const gated = beats.filter(b => b?.inject?.requires).length;
  // Charter Law 1 (default-closed): every beat carries a gate or an explicit
  // pacing.ambient marking. Anything else is a lint hit.
  const lintUngated = beats.filter(b => b?.id && !b?.inject?.requires && !b?.pacing?.ambient).map(b => String(b.id));
  const storyPhase = (() => { try { return Number(game.settings.get(NS, "storyPhase")) || 0; } catch (_e) { return 0; } })();
  const chains = {};
  for (const b of beats) {
    const c = String(b?.storyChain || b?.inject?.storyChain || "").trim();
    if (c) chains[c] = (chains[c] || 0) + 1;
  }

  // ── hex census ────────────────────────────────────────────────────────────
  const tableHexRefs = new Set();
  for (const t of Object.values(tables)) {
    for (const e of (t?.entries || t?.rows || [])) for (const u of (e?.hexWhitelist || [])) tableHexRefs.add(String(u));
  }
  const hexOverrides = Object.assign({}, camp.hexOverrides || {}, camp.overrides?.hex || {});
  const hexRows = [];
  for (const scene of game.scenes) {
    for (const dr of scene.drawings.contents) {
      const f = dr.flags?.["bbttcc-territory"];
      if (!f || !(f.isHex === true || f.kind === "territory-hex" || f.hexId)) continue;
      const uuid = `Scene.${scene.id}.Drawing.${dr.id}`;
      const name = f.name || dr.text || "(unnamed)";
      const onEnter = f.campaign?.onEnterBeatId || hexOverrides[uuid]?.onEnterBeatId || hexOverrides[uuid]?.beatId || null;
      const onEnterBroken = onEnter && !beatIds.has(String(onEnter));
      const questLinks = Object.keys(f.quests || {}).length;
      const inTables = tableHexRefs.has(uuid) || tableHexRefs.has(name);
      hexRows.push({ region: scene.name, name, uuid, onEnter, onEnterBroken, questLinks, inTables,
        devoted: !!((onEnter && !onEnterBroken) || questLinks || inTables) });
    }
  }
  const hexByRegion = {};
  for (const h of hexRows) {
    hexByRegion[h.region] ??= { total: 0, devoted: 0, blank: 0 };
    hexByRegion[h.region].total++;
    hexByRegion[h.region][h.devoted ? "devoted" : "blank"]++;
  }
  const brokenHexes = hexRows.filter(h => h.onEnterBroken).map(h => `${h.name} → ${h.onEnter}`);
  const blankHexes = hexRows.filter(h => !h.devoted).map(h => `${h.region.replace(/^Bad Eden — /, "")} · ${h.name}`);

  // ── optional: audio file existence ────────────────────────────────────────
  let missingAudio = [];
  if (CHECK_AUDIO_FILES) {
    const files = [...new Set(beats.filter(hasAudio).map(b => b.audio.src).filter(s => s))];
    for (const f of files) {
      try {
        const res = await fetch(encodeURI(decodeURIComponent(f)), { method: "HEAD" });
        if (!res.ok) missingAudio.push(f);
      } catch (_e) { missingAudio.push(f); }
    }
  }

  // ── output ────────────────────────────────────────────────────────────────
  const snapshot = {
    generated: new Date().toISOString(), world: game.world?.id, campaignId,
    totals: { beats: beats.length, quests: Object.keys(quests).length, authored: nAuthored, voiced: nVoiced,
      silent: nAuthored ? silentList.length : 0, orphans: orphans.length, gated, hexes: hexRows.length,
      hexesDevoted: hexRows.filter(h => h.devoted).length,
      storyPhase, lintUngatedNonAmbient: lintUngated.length },
    lintUngated: lintUngated.slice(0, 40),
    voByQuest: voTable, silentBeats: silentList, orphanBeatIds: orphans,
    brokenBeatLinks: brokenLinks, brokenHexOnEnter: brokenHexes, blankHexes, hexByRegion, chains,
    missingAudioFiles: CHECK_AUDIO_FILES ? missingAudio : "(not checked)"
  };

  console.log("[campaign-census] snapshot", snapshot);
  console.table(voTable);
  console.table(hexByRegion);
  if (brokenLinks.length) console.table(brokenLinks);

  try {
    const save = foundry.utils.saveDataToFile ?? saveDataToFile;
    save(JSON.stringify(snapshot, null, 1), "text/json", `campaign-census-${Date.now()}.json`);
  } catch (_e) {}

  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const topSilent = voTable.filter(r => r.silent).slice(0, 8)
    .map(r => `<tr><td>${esc(r.quest)}</td><td style="text-align:right">${r.silent}</td><td style="text-align:right">${r.voiced}/${r.authored}</td></tr>`).join("");
  const regionRows = Object.entries(hexByRegion)
    .map(([r, v]) => `<tr><td>${esc(r.replace(/^Bad Eden — /, ""))}</td><td style="text-align:right">${v.devoted}/${v.total}</td></tr>`).join("");
  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
    content: `
      <div class="bbttcc-census">
        <h3>📊 Campaign Census</h3>
        <p><b>ACT ${storyPhase}</b> · <b>${beats.length}</b> beats · <b>${nVoiced}</b> voiced / <b>${nAuthored}</b> authored
        (<b style="color:#c95555">${silentList.length} silent</b>) · <b>${orphans.length}</b> orphan beat(s)
        · <b>${gated}</b> gated · hexes devoted <b>${hexRows.filter(h => h.devoted).length}/${hexRows.length}</b></p>
        <p><b>Charter lint:</b> ${lintUngated.length
          ? `<b style="color:#c4622d">${lintUngated.length} ungated non-ambient beat(s)</b> — first ones in console`
          : `<b style="color:#4e9d62">0 ungated non-ambient — default-closed holds</b>`}</p>
        <p><b>Top silent quests</b></p>
        <table><tr><th>Quest</th><th>Silent</th><th>Voiced</th></tr>${topSilent}</table>
        <p><b>Hex coverage by region</b></p>
        <table><tr><th>Region</th><th>Devoted</th></tr>${regionRows}</table>
        ${brokenHexes.length ? `<p><b style="color:#c95555">Broken hex on-enter:</b> ${esc(brokenHexes.join("; "))}</p>` : ""}
        ${brokenLinks.length ? `<p><b style="color:#c95555">${brokenLinks.length} broken beat link(s)</b> — see console</p>` : ""}
        <p class="notes">Full snapshot downloaded as JSON; details in console (F12).</p>
      </div>`
  });
  ui.notifications.info("Campaign census complete — chat summary + JSON download + console detail.");
})();
