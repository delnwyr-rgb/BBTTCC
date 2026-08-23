/* fix-journal-hygiene.macro.js — mechanical repair of the "Thatward's Ho!" journal
 * 2026-08-19. Operates on the LIVE journal, not an export.
 *
 * CONTEXT: that journal's last edit is 2026-04-22 — a frozen April snapshot.
 * The plan is to demote it to a historical design doc and generate the working
 * GM journal from live beats. This pass exists so the ARCHIVE is not actively
 * corrupt when it gets demoted: fix only what is provably wrong, and touch
 * nothing that needs a canon ruling.
 *
 * 🪤 THE FIRST VERSION OF THIS MACRO WAS WRONG AND WOULD HAVE CORRUPTED PROSE.
 * It assumed Body/Mind/Soul/Presence were "attributes" and that Violence and
 * Intrigue were OP-bank channels only, so it "fixed" `Athletics (Violence)
 * (Body)` to `Athletics (Body)`. In fact fourththing has SIX FACULTIES —
 * violence · intrigue · presence · body · mind · soul (see FT_SKILL_MASTER and
 * VALID_FACULTIES in systems/fourththing/module.js) — and Violence/Intrigue
 * merely SHARE NAMES with two of the nine OP-bank channels. `(Violence)` is a
 * perfectly legal faculty tag. Athletics is a VIOLENCE aptitude (its sheet
 * label is "Touched Grass"), so the old rule produced the wrong faculty — and
 * the journal strings cited as corroboration (`Athletics (Body)` ×3) are
 * themselves errors. Never infer this vocabulary FROM the journal: the journal
 * is the thing being audited. Read FT_SKILL_MASTER.
 *
 * Accordingly the skill rules are now ONE rule driven by the system's table.
 *
 * AUTO-FIXED (provable against system data, or unambiguous):
 *  A. SKILL FACULTY TAGS — any recognised skill followed by parenthesised
 *     faculty tag(s) is rewritten to the faculty FT_SKILL_MASTER assigns. One
 *     authoritative rule now covers duplicates (`Insight (Soul) (Soul)`),
 *     mixed pairs (`Athletics (Violence) (Body)`) and plain-wrong single tags
 *     (`Athletics (Body)`). A tag group containing any non-faculty word is
 *     left alone and reported — that's prose, not a tag.
 *  B. `Atlesh–Gilliam` / `Atlesh-Gilliam` → `Allesh-Gilliam` (this one is in
 *     PLAYER-FACING dialogue on the Furrier's page).
 *  C. Unhyphenated `Allesh Gilliam` in body text → `Allesh-Gilliam`.
 *  D. The two retired-boss references — the actor type no longer exists.
 *  E. The shipped `[TODO(adv-call)]`, relabelled as an explicit GM call so it
 *     reads as a decision rather than an unfinished sentence.
 *
 * REPORTED ONLY — these need an owner ruling and are NOT touched:
 *  · "Tifaret" vs "Tiferet" vs "Tipharet". Live beat ids use forest_of_tifaret.
 *  · Four different places called "the Vault".
 *  · "Khezek Tor" vs "Khezek-Tor".
 *  · Two verbatim duplicated blocks (Sable Nine's read-aloud, Dougan's
 *    profile) — deleting prose automatically is the one thing worth refusing.
 *  · Monodynamic Industries named openly in the Bunker finale.
 *  · Rowan as "the Echo Without a Body", against the Echoes ruling.
 *  · Page titles themselves (only page CONTENT is edited here).
 *  · Whether the journal should use canonical skill names at all, or the
 *    sheet's slang labels (Athletics = "Touched Grass").
 *
 * DRY_RUN default true. Idempotent. GM only.
 */
(async () => {
  const DRY_RUN = true;                 // <-- set false to apply
  const JOURNAL = "Thatward's Ho!";
  if (!game.user?.isGM) return ui.notifications.error("GM only.");

  const je = game.journal.getName(JOURNAL)
    || game.journal.contents.find(j => /thatward/i.test(j.name));
  if (!je) return ui.notifications.error(`Journal "${JOURNAL}" not found.`);

  const FACULTIES = ["Violence", "Intrigue", "Presence", "Body", "Mind", "Soul"];

  // Mirrors FT_SKILL_MASTER in systems/fourththing/module.js (24 skills).
  // If that table changes, re-derive this — do NOT hand-edit it from memory.
  const SKILL_FACULTY = {
    "Brawl": "Violence", "Melee": "Violence", "Firearms": "Violence", "Athletics": "Violence",
    "Stealth": "Intrigue", "Hacking": "Intrigue", "Tinkering": "Intrigue", "Piloting": "Intrigue",
    "Streetwise": "Intrigue", "Weave": "Intrigue",
    "Diplomacy": "Presence", "Intimidation": "Presence", "Empathy": "Presence", "Performance": "Presence",
    "Perception": "Mind", "Investigation": "Mind", "Lore": "Mind", "Occult": "Mind",
    "Faith": "Soul", "Meditation": "Soul", "Ritual": "Soul", "Insight": "Soul", "Warding": "Soul",
    "Plating": "Body"
  };

  const report = [];
  const fixedText = [];                 // post-fix content, so the residual scan
  const changeLog = new Map();          // is honest in DRY RUN too (nothing is
  const oddTags = new Set();            // written yet, so re-reading the pages
  let edits = 0, pagesTouched = 0;      // would report the ORIGINALS).

  const skillAlt = Object.keys(SKILL_FACULTY).join("|");
  const facAlt = FACULTIES.join("|");
  const SKILL_RE = new RegExp(`\\b(${skillAlt})((?:\\s*\\([A-Za-z \\-]+\\))+)`, "g");
  const isFac = (w) => FACULTIES.some(f => f.toLowerCase() === String(w).trim().toLowerCase());

  for (const page of je.pages.contents) {
    const before = String(page.text?.content || "");
    if (!before) continue;
    let s = before;
    const hits = [];
    const note = (what, n) => { if (n) hits.push(`${what} ×${n}`); };

    // A — one authoritative rule for every skill faculty tag
    let n = 0;
    s = s.replace(SKILL_RE, (m, skill, tags) => {
      const words = [...tags.matchAll(/\(([^)]*)\)/g)].map(x => x[1]);
      // Any non-faculty word means this is prose, not a faculty tag. Leave it.
      if (!words.length || !words.every(isFac)) { oddTags.add(m.trim()); return m; }
      const want = `${skill} (${SKILL_FACULTY[skill]})`;
      if (m.trim() === want) return m;              // already correct — idempotent
      n++;
      const k = `${m.trim().replace(/\s+/g, " ")}  →  ${want}`;
      changeLog.set(k, (changeLog.get(k) || 0) + 1);
      return want;
    });
    note("skill faculty tags normalised to FT_SKILL_MASTER", n);

    // B — Atlesh → Allesh-Gilliam (player-facing dialogue)
    n = 0;
    s = s.replace(/Atlesh[‐-―\-− ]?Gilliam/g, () => { n++; return "Allesh-Gilliam"; });
    note("“Atlesh–Gilliam” corrected", n);

    // C — unhyphenated Allesh Gilliam in body text
    n = 0;
    s = s.replace(/\bAllesh Gilliam\b/g, () => { n++; return "Allesh-Gilliam"; });
    note("“Allesh Gilliam” hyphenated", n);

    // D — the retired boss actor type
    n = 0;
    s = s.replace(/Raid[‐-―\-−\s]?Boss[‐-―\-−\s]?style encounter/gi,
      () => { n++; return "faction-scale confrontation (the boss actor type is retired: run the aspect as an NPC monster, or raid its faction hex at strategic scale)"; });
    s = s.replace(/Boss Fight \(Token Combat\)/gi,
      () => { n++; return "NPC monster fight (token combat) — the boss actor type is retired; at strategic scale this is a raid on his faction hex"; });
    note("retired-boss references reframed", n);

    // E — the shipped TODO
    n = 0;
    s = s.replace(/\[TODO\(adv-call\)\]/gi, () => { n++; return "[GM CALL — advantage rule never finalised in design; rule it at the table and note it]"; });
    note("shipped TODO relabelled as an explicit GM call", n);

    // F — 🔒 owner ruling 2026-08-19: the spelling is TIFARET (matches the live
    // beat ids, forest_of_tifaret).
    n = 0;
    s = s.replace(/\bTiferet\b/g, () => { n++; return "Tifaret"; });
    s = s.replace(/\bTipharet\b/g, () => { n++; return "Tifaret"; });
    note("“Tiferet/Tipharet” → “Tifaret”", n);

    // G — 🔒 owner ruling 2026-08-19: Khezek-Tor is hyphenated.
    // 🪤 NBSP: names in this project routinely carry U+00A0 rather than a plain
    // space (see the hex-name trap), so match any whitespace, not " ".
    n = 0;
    s = s.replace(/\bKhezek[\s ]+Tor\b/g, () => { n++; return "Khezek-Tor"; });
    note("“Khezek Tor” hyphenated", n);

    fixedText.push(s);
    if (s !== before) {
      pagesTouched++; edits += hits.length;
      report.push(`✎ ${page.name}\n     ${hits.join("\n     ")}`);
      if (!DRY_RUN) await page.update({ "text.content": s });
    } else {
      report.push(`· ok ${page.name} — nothing mechanical to fix`);
    }
  }

  // page TITLES — only for the two names the owner has actually ruled on
  // (Khezek-Tor hyphenated, Tifaret spelling). Every other title is left alone.
  for (const page of je.pages.contents) {
    const want = page.name
      .replace(/\bKhezek[\s ]+Tor\b/g, "Khezek-Tor")
      .replace(/\bTiferet\b|\bTipharet\b/g, "Tifaret");
    if (want !== page.name) {
      report.push(`✎ TITLE  "${page.name}"  →  "${want}"`);
      edits++;
      if (!DRY_RUN) await page.update({ name: want });
    }
  }

  // every distinct skill-tag rewrite, so nothing changes silently
  if (changeLog.size) {
    report.push(`\n🔧 SKILL TAG REWRITES (authority: FT_SKILL_MASTER):`);
    for (const [k, c] of [...changeLog.entries()].sort()) report.push(`   ${k}   ×${c}`);
  }
  if (oddTags.size) {
    report.push(`\n· left alone — parenthetical is prose, not a faculty tag (${oddTags.size}):`);
    for (const t of [...oddTags].slice(0, 12)) report.push(`   ${t.replace(/\s+/g, " ")}`);
  }

  // residual checks, read from the in-memory result
  {
    const after = fixedText.join("\n").replace(/<[^>]+>/g, " ");
    const left = [...after.matchAll(new RegExp(`\\b(?:${skillAlt})(?:\\s*\\((?:${facAlt})\\)){2,}`, "g"))].map(m => m[0].trim());
    if (left.length) {
      report.push(`\n⚠ RESIDUAL — still multi-tagged (${left.length}); resolve by hand:`);
      for (const l of [...new Set(left)]) report.push(`   ${l}`);
    } else {
      report.push(`\n✅ no multi-tagged skill strings remain`);
    }
    const bad = [];
    for (const m of after.matchAll(new RegExp(`\\b(${skillAlt})\\s*\\((${facAlt})\\)`, "g")))
      if (SKILL_FACULTY[m[1]] !== m[2]) bad.push(m[0]);
    if (bad.length) report.push(`⚠ ${bad.length} tag(s) still disagree with FT_SKILL_MASTER: ${[...new Set(bad)].join(", ")}`);
    else report.push(`✅ every skill tag now matches FT_SKILL_MASTER`);
  }

  // ── 🚨 who can READ this journal? ────────────────────────────────────────
  // This decides whether the Monodynamic mentions are player-facing at all.
  {
    const L = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    const own = je.ownership || {};
    const dflt = own.default ?? L.NONE;
    // 🪤 THIS CHECK CRIED WOLF — it reported "PLAYERS CAN READ THIS" while
    // audit-monodynamic-exposure reported the same journal private.
    // The old code mapped each granted id to a NAME (`game.users.get(k)?.name
    // || k`) and then asked `game.users.getName(name)?.isGM`. For a GM whose
    // id RESOLVES that works fine. The failure is a grant whose id resolves to
    // NOTHING — a stale entry left behind by a deleted user. Then `.map` falls
    // through to the raw id, `getName(rawId)` is undefined, and
    // `!undefined?.isGM` → `!undefined` → true, so the ghost was counted as a
    // player reader. The tell is a raw id in the output where a name belongs.
    // Now: resolve the user ONCE, read isGM off the object, and print every
    // grant with name + role so the verdict is auditable rather than asserted.
    // A stale grant is called out but NOT counted as exposure — a deleted user
    // cannot log in. It should still be cleaned up.
    const grants = Object.entries(own)
      .filter(([k, v]) => k !== "default" && v >= L.OBSERVER)
      .map(([k, v]) => { const u = game.users.get(k); return { k, v, name: u?.name ?? "(unknown user)", gm: !!u?.isGM, missing: !u }; });
    const playerGrants = grants.filter(g => !g.gm && !g.missing);
    const exposed = dflt >= L.OBSERVER || playerGrants.length > 0;
    report.push(`\n${exposed ? "🚨" : "🔒"} JOURNAL VISIBILITY — default ownership = ${dflt} (${dflt >= L.OBSERVER ? "PUBLIC" : "not public"})`);
    for (const g of grants)
      report.push(`     grant ${g.name}${g.missing ? ` [${g.k}]` : ""} = ${g.v} → ${g.missing ? "⚠ USER NOT FOUND — stale grant, treat as unknown" : (g.gm ? "GM (harmless)" : "PLAYER — can read")}`);
    if (!grants.length) report.push(`     (no explicit grants)`);
    report.push(`     → ${exposed
      ? "PLAYERS CAN READ THIS. The Monodynamic mentions below are player-facing."
      : "GM-only. The Monodynamic mentions are NOT exposed by this document."}`);
  }

  // ── context dumps for the three items that need a per-instance decision ──
  const ctxDump = (label, re, limit = 40) => {
    const rows = [];
    for (const p of je.pages.contents) {
      const t = String(p.text?.content || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
      for (const m of t.matchAll(re)) {
        const a = Math.max(0, m.index - 95), b = m.index + m[0].length + 85;
        rows.push(`   [${p.name}] …${t.slice(a, b).replace(/\s+/g, " ").trim()}…`);
        if (rows.length >= limit) break;
      }
    }
    report.push(`\n${label} (${rows.length}${rows.length >= limit ? "+" : ""}):`);
    report.push(...(rows.length ? rows : ["   (none)"]));
  };
  ctxDump("🏛 EVERY “Vault” MENTION — tell me which vault each one is", /\bVault\b/g);
  ctxDump("🏢 EVERY “Monodynamic” MENTION — for expurgation", /\bMonodynamic\b/g);
  ctxDump("👤 ROWAN / “Echo Without a Body”", /Echo Without a Body|\bRowan\b/g, 12);

  // ── report-only findings ─────────────────────────────────────────────────
  const all = je.pages.contents.map(p => `${p.name}\n${String(p.text?.content || "")}`).join("\n");
  const plain = all.replace(/<[^>]+>/g, " ");
  const count = (re) => (plain.match(re) || []).length;
  report.push("\n⛔ STILL NOT TOUCHED:");
  report.push(`   · duplicated blocks (Sable Nine read-aloud, Dougan profile) — deliberately NOT auto-deleted`);
  report.push(`   · page titles: ${je.pages.contents.filter(p => /Khezek[\s ]+Tor|Tiferet|Tipharet/.test(p.name)).map(p => p.name).join(", ") || "(none need the ruled renames)"}`);
  report.push(`   · canonical skill names kept (the sheet shows slang: Athletics = "Touched Grass")`);
  report.push(`   · Monodynamic still ×${count(/\bMonodynamic\b/g)} — expurgation needs the per-mention calls above`);

  console.log(`[fix-journal-hygiene] ${DRY_RUN ? "DRY RUN" : "APPLY"} — ${edits} fix-type(s) across ${pagesTouched} page(s)\n` + report.map(r => "  • " + r).join("\n"));
  if (DRY_RUN) return ui.notifications.info(`Journal hygiene DRY RUN: ${pagesTouched} page(s) would change (see console).`);
  ui.notifications.info(`Journal hygiene APPLIED to ${pagesTouched} page(s).`);
})();
