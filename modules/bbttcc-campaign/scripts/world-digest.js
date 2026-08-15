//
// THE TURN PRESS — world-state digest for NPC common knowledge (2026-08-12)
// -------------------------------------------------------------
// Each applied turn advance, presses a street-prose "Word Going Round" page
// into the world-digest journal (name from bbttcc-mal-voice setting
// `npcWorldDigestJournal`, default "The Turn Press"). The NPC dialogue engine
// sweeps that journal into every persona prompt, so NPCs speak from the
// world's actual current state — relations, live quests, rumor-band meters,
// and AUTHORED beat headlines (beat.digest) — never raw beat labels.
//
// Ownership rule: the press only creates/updates/prunes pages whose name
// matches its own pattern ("Word Going Round — Turn N"). GM hand-written
// pages in the same journal are never touched, and the mal-voice reader
// honors @after/@knownBy tags on them like any knowledge page.
//
// Exposes: game.bbttcc.api.campaign.digest.{press, render, clear}
//   render({turn?})  -> { turn, html, facts } (no writes — preview)
//   press({turn?})   -> { ok, turn, journalName, pageName, created|updated }
//   clear()          -> { ok, removed } — un-prints every turn edition,
//                       keeping the Opening edition + hand-written pages.
//                       Wired into the Reset Console (World-apply opt-in,
//                       full reset unconditional).
//
(() => {
  const TAG = "[bbttcc-campaign/world-digest]";
  const NS = "bbttcc-campaign";
  const PAGE_RE = /^Word Going Round — Turn (\d+)$/;

  // The authored day-one edition (seed-opening-edition.macro.js): what folk
  // were saying before the Stewards did anything. Deliberately OUTSIDE
  // PAGE_RE so neither the per-turn prune nor clear() can touch it, and
  // sorted after every turn edition (t=1 presses at 999990) so it reads as
  // the oldest talk in the room.
  const OPENING_PAGE = "Word Going Round — Opening";
  const OPENING_SORT = 1000000;

  const warn = (...a) => console.warn(TAG, ...a);
  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = String(s ?? "");
    return d.innerHTML;
  };

  function journalName() {
    try {
      const v = String(game.settings.get("bbttcc-mal-voice", "npcWorldDigestJournal") || "").trim();
      if (v) return v;
    } catch (_e) { /* mal-voice absent or setting unregistered — use default */ }
    return "The Turn Press";
  }

  function worldTurn() {
    try {
      const t = Number(game.bbttcc?.api?.world?.getState?.()?.turn);
      if (Number.isFinite(t) && t > 0) return Math.floor(t);
    } catch (_e) {}
    return 0;
  }

  const getSetting = (k, d = 0) => {
    try { const v = game.settings.get(NS, k); return v == null ? d : v; } catch (_e) { return d; }
  };

  // ── fact gathering ───────────────────────────────────────────────────────
  // Every block fails soft to [] — a missing subsystem thins the paper, never
  // stops the presses.

  function _relationLines() {
    const lines = [];
    try {
      const rel = game.bbttcc?.api?.factions?.relations;
      if (!rel?.list) return lines;
      const factions = game.actors.filter(a => {
        try { return !!a.getFlag("bbttcc-factions", "isFaction") || a.system?.details?.type?.value === "faction"; }
        catch (_e) { return false; }
      });
      // Dedupe the symmetric pair; keep whichever direction is more extreme.
      const pairs = new Map();
      for (const f of factions) {
        for (const r of (rel.list(f.id) || [])) {
          if (!r || String(r.tier) === "neutral") continue;
          const idx = Number(r.tierIdx ?? 3);
          const key = [f.name, r.name].sort().join("|");
          const prev = pairs.get(key);
          if (!prev || Math.abs(idx - 3) > Math.abs(prev.idx - 3)) {
            pairs.set(key, { a: f.name, b: r.name, tier: String(r.tier), idx });
          }
        }
      }
      const PHRASE = {
        at_war:     (a, b) => `It's open war between ${a} and ${b} — folk plan their routes around it.`,
        hostile:    (a, b) => `Blood's bad between ${a} and ${b}; nobody sane carries messages both ways.`,
        unfriendly: (a, b) => `${a} and ${b} aren't sharing a fire these days.`,
        friendly:   (a, b) => `${a} and ${b} trade easy lately — you see their wagons on the same roads.`,
        allied:     (a, b) => `${a} and ${b} stand together now, thick as kin.`
      };
      const sorted = [...pairs.values()].sort((x, y) => Math.abs(y.idx - 3) - Math.abs(x.idx - 3)).slice(0, 8);
      for (const p of sorted) {
        const f = PHRASE[p.tier];
        if (f) lines.push(f(p.a, p.b));
      }
    } catch (e) { warn("relation lines failed:", e?.message); }
    return lines;
  }

  async function _questLines() {
    const lines = [];
    try {
      const state = await game.bbttcc?.api?.campaign?.dialogue?.storyStateFor?.(null);
      const active = (state?.quests?.active || []).map(q => String(q?.title || q?.id || "")).filter(Boolean).slice(0, 5);
      if (active.length) {
        lines.push(`Live business folk keep talking about: ${active.join(" · ")}.`);
      }
    } catch (e) { warn("quest lines failed:", e?.message); }
    return lines;
  }

  function _meterLines() {
    const lines = [];
    try {
      // Wendigo rung — the one meter with a canonical ladder (0..4).
      const wendigo = Number(getSetting("wendigoRung", 0)) || 0;
      const WENDIGO = [
        null,
        "Hunters up north swap stories of something wrong in the deep woods — probably nothing.",
        "Livestock gone, tracks nobody can name. Folks near the treeline bar their doors early now.",
        "Whole camps have gone quiet up north. The roads that way empty out after dark.",
        "The thing in the north woods has a name now, and nobody says it loud."
      ];
      if (wendigo >= 1 && WENDIGO[Math.min(wendigo, 4)]) lines.push(WENDIGO[Math.min(wendigo, 4)]);

      // Bandit read of the Stewards — comparative only; scales are uncalibrated.
      const mercy = Number(getSetting("banditMercy", 0)) || 0;
      const fear = Number(getSetting("banditFear", 0)) || 0;
      if (fear > 0 && fear >= mercy) lines.push("The toll gangs give the Stewards' wagons a wide berth these days — word is they learned the hard way.");
      else if (mercy > 0) lines.push("Even the toll gangs speak half-kindly of the Stewards' dealings — fair-handed, they say, for outsiders.");

      // Cadence posture — whichever note rings loudest.
      const respect = Number(getSetting("cadenceRespect", 0)) || 0;
      const tribute = Number(getSetting("cadenceTribute", 0)) || 0;
      const uncontested = Number(getSetting("cadenceUncontested", 0)) || 0;
      const top = Math.max(respect, tribute, uncontested);
      if (top > 0) {
        if (top === respect) lines.push("The Cadence riders tip their hats to the coalition's people now — grudging, but real.");
        else if (top === tribute) lines.push("The Cadence still counts what it reckons it's owed, and it still collects.");
        else lines.push("The Cadence rides where it pleases lately — nobody's argued the point in a while.");
      }

      // Coalition footprint, banded — never a count.
      const hexes = Number(game.bbttcc?.api?.campaign?.gates?.value?.("hexesClaimed")) || 0;
      if (hexes >= 1) {
        lines.push(hexes < 3
          ? "The newcomers' coalition holds a young toehold of ground — banners up, roots shallow."
          : hexes < 8
            ? "The coalition's banners fly over a proper stretch of country now."
            : "Half the map answers to the coalition these days, feels like.");
      }
    } catch (e) { warn("meter lines failed:", e?.message); }
    return lines;
  }

  // Authored headlines: beats fired on/after `sinceTurn` whose author wrote a
  // beat.digest line. Beats without one never make the papers — the beat
  // ledger is full of GM machinery and secret outcomes, so nothing auto-leaks.
  function _headlineLines(sinceTurn) {
    const lines = [];
    try {
      const api = game.bbttcc?.api?.campaign;
      const ds = api?.director?.state?.() || {};
      const fired = [];
      for (const src of [ds.firedStoryBeats || {}, ds.dialogueFired || {}]) {
        for (const [id, m] of Object.entries(src)) {
          const t = Number(m?.turn);
          if (Number.isFinite(t) && t >= sinceTurn) fired.push({ id, turn: t, ts: Number(m?.ts) || 0 });
        }
      }
      if (!fired.length) return lines;
      const digestById = {};
      const all = api?.getAllCampaigns?.() || {};
      for (const c of Object.values(all)) {
        for (const b of (Array.isArray(c?.beats) ? c.beats : [])) {
          const d = String(b?.digest || "").trim();
          if (d) digestById[String(b.id)] = d;
        }
      }
      const seen = new Set();
      fired.sort((a, b) => b.ts - a.ts);
      for (const f of fired) {
        const d = digestById[f.id];
        if (!d || seen.has(f.id)) continue;
        seen.add(f.id);
        lines.push(d);
        if (lines.length >= 6) break;
      }
    } catch (e) { warn("headline lines failed:", e?.message); }
    return lines;
  }

  // ── render + press ───────────────────────────────────────────────────────

  async function render({ turn = null } = {}) {
    const t = Number(turn) > 0 ? Math.floor(Number(turn)) : worldTurn();
    const facts = [
      ..._headlineLines(Math.max(1, t - 1)),   // news of the turn just lived
      ...await _questLines(),
      ..._relationLines(),
      ..._meterLines()
    ].filter(Boolean);
    const html = facts.length
      ? facts.map(f => `<p>${esc(f)}</p>`).join("\n")
      : `<p>A quiet stretch — no news worth the name. Folk talk weather and prices.</p>`;
    return { turn: t, html, facts };
  }

  async function press({ turn = null } = {}) {
    if (!game.user?.isGM) return { ok: false, reason: "GM only" };
    const { turn: t, html } = await render({ turn });
    if (!(t > 0)) return { ok: false, reason: "world turn unavailable" };

    const name = journalName();
    let journal = game.journal?.getName?.(name) || game.journal?.contents?.find(j => j.name === name);
    if (!journal) journal = await JournalEntry.create({ name });

    const pageName = `Word Going Round — Turn ${t}`;
    // Sort newest-first so the current edition leads the prompt sweep.
    const sort = 1000000 - t * 10;
    const existing = journal.pages?.contents?.find(p => p.name === pageName);
    let action;
    if (existing) {
      await existing.update({ "text.content": html, "text.format": 1, sort });
      action = "updated";
    } else {
      await journal.createEmbeddedDocuments("JournalEntryPage", [
        { name: pageName, type: "text", sort, text: { content: html, format: 1 } }
      ]);
      action = "created";
    }

    // Prune ONLY our own back numbers: keep this edition + the previous one.
    try {
      const stale = (journal.pages?.contents || []).filter(p => {
        const m = PAGE_RE.exec(String(p.name || ""));
        return m && Number(m[1]) < t - 1;
      }).map(p => p.id);
      if (stale.length) await journal.deleteEmbeddedDocuments("JournalEntryPage", stale);
    } catch (e) { warn("back-number prune failed:", e?.message); }

    console.log(TAG, `pressed "${pageName}" into "${name}" (${action})`);
    return { ok: true, turn: t, journalName: name, pageName, [action]: true };
  }

  // Un-print the papers. Deletes ONLY press-owned turn editions (PAGE_RE);
  // the authored Opening edition and any GM hand-written page in the journal
  // are left standing. A world reset rewinds the news, it does not burn the
  // gazetteer. Without this, resetting to Turn 1 leaves NPCs speaking the
  // news of a world that has just been un-happened.
  async function clear() {
    if (!game.user?.isGM) return { ok: false, reason: "GM only" };
    const name = journalName();
    const journal = game.journal?.getName?.(name) || game.journal?.contents?.find(j => j.name === name);
    if (!journal) return { ok: true, removed: 0, journalName: name };
    const ids = (journal.pages?.contents || [])
      .filter(p => PAGE_RE.test(String(p.name || "")))
      .map(p => p.id);
    if (ids.length) await journal.deleteEmbeddedDocuments("JournalEntryPage", ids);
    console.log(TAG, `cleared ${ids.length} turn edition(s) from "${name}"`);
    return { ok: true, removed: ids.length, journalName: name };
  }

  // ── install ──────────────────────────────────────────────────────────────

  Hooks.once("ready", () => {
    try {
      game.bbttcc ??= { api: {} };
      game.bbttcc.api ??= {};
      game.bbttcc.api.campaign ??= {};
      game.bbttcc.api.campaign.digest = {
        press, render, clear,
        journalName,
        opening: { name: OPENING_PAGE, sort: OPENING_SORT }
      };
    } catch (e) { warn("API install failed:", e); }

    Hooks.on("bbttcc:advanceTurn:end", (tctx) => {
      try {
        if (!tctx || tctx.apply !== true) return;
        if (!game.user?.isGM) return;
        // Run LAST: relations/meters/quests mutate on this same hook — the
        // deferred slot (siege-muster-pool precedent) reads the settled world.
        setTimeout(() => { press({}).catch(e => warn("turn press failed:", e)); }, 100);
      } catch (e) { warn("advanceTurn listener failed:", e); }
    });

    console.log(TAG, "installed — The Turn Press runs on each applied turn advance.");
  });
})();
